/**
 * @file packages/app/src/lib/feature-flags.ts
 * ============================================================================
 * 🔹 FEATURE FLAGS CORE — ПЛАТФОРМЕННОЕ ЯДРО УПРАВЛЕНИЯ ФУНКЦИОНАЛОМ
 * ============================================================================
 *
 * Уровень: Platform / Infrastructure kernel
 *
 * Свойства:
 * - детерминированность
 * - отказоустойчивость
 * - расширяемость
 * - микросервисная изоляция
 * - поддержка distributed систем
 */

import type { ServicePrefix } from './error-mapping.js';

/* ============================================================================
 * 🧠 КОНТЕКСТ
 * ========================================================================== */

export type FeatureContext = {
  readonly userId?: string;
  readonly tenantId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly service?: ServicePrefix;
  readonly locale?: string;
  readonly attributes?: Record<string, string | number | boolean>;
};

/* ============================================================================
 * 🏷️ ИМЕНА ФЛАГОВ
 * ========================================================================== */

export type FeatureFlagName<T extends ServicePrefix = ServicePrefix> = `${T}_${string}`;

/* ============================================================================
 * 🧱 ОПРЕДЕЛЕНИЕ ФЛАГА
 * ========================================================================== */

export type FeatureFlagDefinition = {
  readonly name: FeatureFlagName;
  readonly description: string;
  readonly default: boolean;
  readonly service: ServicePrefix;
  readonly strategy?: FeatureFlagStrategy;
  readonly version?: number;
};

/* ============================================================================
 * 🧠 СТРАТЕГИИ
 * ========================================================================== */

export type FeatureFlagStrategy = (ctx: FeatureContext) => boolean;

export const alwaysOn: FeatureFlagStrategy = () => true;
export const alwaysOff: FeatureFlagStrategy = () => false;

export function enabledForUsers(userIds: readonly string[]): FeatureFlagStrategy {
  const set = new Set(userIds);
  return (ctx) => ctx.userId !== undefined && set.has(ctx.userId);
}

export function enabledForTenants(tenantIds: readonly string[]): FeatureFlagStrategy {
  const set = new Set(tenantIds);
  return (ctx) => ctx.tenantId !== undefined && set.has(ctx.tenantId);
}

export function percentageRollout(
  percentage: number,
  key: 'userId' | 'tenantId' = 'userId',
): FeatureFlagStrategy {
  if (percentage <= 0) return alwaysOff;
  if (percentage >= 100) return alwaysOn;

  return (ctx) => {
    const id = ctx[key];
    if (id === undefined) return false;
    return ((stableHash(id) >>> 0) % 100) < percentage;
  };
}

export const and = (...strategies: readonly FeatureFlagStrategy[]): FeatureFlagStrategy => (ctx) =>
  strategies.every((s) => s(ctx));

export const or = (...strategies: readonly FeatureFlagStrategy[]): FeatureFlagStrategy => (ctx) =>
  strategies.some((s) => s(ctx));

export const not = (strategy: FeatureFlagStrategy): FeatureFlagStrategy => (ctx) => !strategy(ctx);

/* ============================================================================
 * 🧱 PROVIDER API
 * ========================================================================== */

export type FeatureFlagProvider = {
  getFlag(name: FeatureFlagName): Promise<FeatureFlagDefinition | undefined>;

  getFlags?(
    names: readonly FeatureFlagName[],
  ): Promise<ReadonlyMap<FeatureFlagName, FeatureFlagDefinition>>;

  snapshot?(): Promise<readonly FeatureFlagDefinition[]>;
};

/* ============================================================================
 * 📊 РЕЗУЛЬТАТ ОЦЕНКИ
 * ========================================================================== */

export type FeatureEvaluationReason =
  | 'DEFAULT'
  | 'STRATEGY'
  | 'NOT_FOUND'
  | 'ERROR';

export type FeatureEvaluationResult = {
  readonly name: FeatureFlagName;
  readonly value: boolean;
  readonly reason: FeatureEvaluationReason;
  readonly flag?: FeatureFlagDefinition;
  readonly timestamp: number;
};

/* ============================================================================
 * 🎯 ОСНОВНОЙ API
 * ========================================================================== */

export async function evaluateFeature(
  provider: FeatureFlagProvider,
  name: FeatureFlagName,
  ctx: FeatureContext,
): Promise<FeatureEvaluationResult> {
  const timestamp = Date.now();

  try {
    const flag = await provider.getFlag(name);

    if (!flag) {
      return freeze({
        name,
        value: false,
        reason: 'NOT_FOUND',
        timestamp,
      });
    }

    if (!flag.strategy) {
      return freeze({
        name,
        value: flag.default,
        reason: 'DEFAULT',
        flag,
        timestamp,
      });
    }

    const value = safeExecuteStrategy(flag.strategy, ctx);

    return freeze({
      name,
      value,
      reason: 'STRATEGY',
      flag,
      timestamp,
    });
  } catch {
    return freeze({
      name,
      value: false,
      reason: 'ERROR',
      timestamp,
    });
  }
}

// Совместимость с предыдущим API
export async function isFeatureEnabled(
  provider: FeatureFlagProvider,
  name: FeatureFlagName,
  ctx: FeatureContext,
): Promise<boolean> {
  const result = await evaluateFeature(provider, name, ctx);
  return result.value;
}

/* ============================================================================
 * 📦 BULK API
 * ========================================================================== */

export async function evaluateFeatures(
  provider: FeatureFlagProvider,
  names: readonly FeatureFlagName[],
  ctx: FeatureContext,
): Promise<readonly FeatureEvaluationResult[]> {
  if (provider.getFlags) {
    const map = await provider.getFlags(names);
    return names.map((name) => evaluateFromMap(name, map.get(name), ctx));
  }

  return Promise.all(names.map((name) => evaluateFeature(provider, name, ctx)));
}

/* ============================================================================
 * 🧪 IN-MEMORY PROVIDER
 * ========================================================================== */

export function createInMemoryFeatureFlagProvider(
  flags: readonly FeatureFlagDefinition[],
): FeatureFlagProvider {
  const map = new Map(flags.map((f) => [f.name, f]));

  return {
    getFlag(name): Promise<FeatureFlagDefinition | undefined> {
      return Promise.resolve(map.get(name));
    },

    getFlags(names): Promise<ReadonlyMap<FeatureFlagName, FeatureFlagDefinition>> {
      const entries = names
        .map((name) => {
          const flag = map.get(name);
          return flag ? ([name, flag] as const) : null;
        })
        .filter((entry): entry is [FeatureFlagName, FeatureFlagDefinition] => entry !== null);
      return Promise.resolve(new Map(entries));
    },

    snapshot(): Promise<readonly FeatureFlagDefinition[]> {
      return Promise.resolve(Object.freeze([...map.values()]));
    },
  };
}

/* ============================================================================
 * 🔧 ВНУТРЕННИЕ УТИЛИТЫ
 * ========================================================================== */

function safeExecuteStrategy(
  strategy: FeatureFlagStrategy,
  ctx: FeatureContext,
): boolean {
  try {
    return strategy(freezeContext(ctx));
  } catch {
    return false;
  }
}

function evaluateFromMap(
  name: FeatureFlagName,
  flag: FeatureFlagDefinition | undefined,
  ctx: FeatureContext,
): FeatureEvaluationResult {
  const timestamp = Date.now();

  if (!flag) {
    return freeze({
      name,
      value: false,
      reason: 'NOT_FOUND',
      timestamp,
    });
  }

  if (!flag.strategy) {
    return freeze({
      name,
      value: flag.default,
      reason: 'DEFAULT',
      flag,
      timestamp,
    });
  }

  return freeze({
    name,
    value: safeExecuteStrategy(flag.strategy, ctx),
    reason: 'STRATEGY',
    flag,
    timestamp,
  });
}

function stableHash(input: string): number {
  const HASH_CONSTANT = 5;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << HASH_CONSTANT) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function freeze<T>(obj: T): T {
  return Object.freeze(obj);
}

function freezeContext(ctx: FeatureContext): FeatureContext {
  return Object.isFrozen(ctx) ? ctx : Object.freeze({ ...ctx });
}
