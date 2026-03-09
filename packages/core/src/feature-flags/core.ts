/**
 * @file packages/core/src/feature-flags/core.ts
 * ============================================================================
 * 🚩 CORE — Feature Flags Engine (Core Logic)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Детерминированный engine для управления feature flags
 * - Стратегии rollout/segmentation (percentage, users, tenants, attributes)
 * - Evaluation API + provider pattern (single/bulk)
 * - Strategy meta (flag name/version) для rollout/observability
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, STRATEGIES, EVALUATION, PROVIDER (+ internal helpers)
 * - ✅ Deterministic: одинаковый вход → одинаковый результат
 * - ✅ Domain-pure: без React/env/console зависимостей, платформо-агностично
 * - ✅ Extensible: strategy pattern без изменения core логики
 * - ✅ Strict typing: discriminated unions + interfaces, строгие контракты стратегий
 * - ✅ Microservice-ready: stateless evaluation (кроме опционального глобального logger для DX)
 */

import type { ServicePrefix } from '@livai/core/effect';

import { stableHash } from '../hash.js';

/* ============================================================================
 * TYPES — FEATURE FLAG MODEL
 * ========================================================================== */

export type FeatureAttributeValue = string | number | boolean;

/**
 * Известные структурированные атрибуты для feature flags.
 * Обеспечивают типобезопасность и автодополнение.
 */
export interface KnownFeatureAttributes {
  /** Среда выполнения */
  readonly environment?: 'production' | 'staging' | 'development' | 'test';

  /** Версия приложения (semver) */
  readonly version?: string;

  /** Платформа */
  readonly platform?: 'web' | 'mobile' | 'desktop' | 'api';

  /** Тип устройства */
  readonly deviceType?: 'desktop' | 'tablet' | 'mobile' | 'server';

  /** ID эксперимента */
  readonly experimentId?: string;

  /** Регион/зона */
  readonly region?: string;

  /** Сегмент пользователя */
  readonly userSegment?: string;

  /** Уровень подписки */
  readonly subscriptionTier?: 'free' | 'premium' | 'enterprise';

  /** Язык интерфейса */
  readonly locale?: string;

  /** Временная зона */
  readonly timezone?: string;

  /** Тип подключения */
  readonly connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'offline';
}

/**
 * Атрибуты feature flags: известные + кастомные.
 * Известные атрибуты типизированы для лучшей DX и безопасности.
 */
export type FeatureAttributes = KnownFeatureAttributes & Record<string, FeatureAttributeValue>;

/**
 * Callback для логирования ошибок в feature flag стратегиях.
 * Позволяет гибкую настройку логирования без side effects.
 */
export type FeatureFlagLogger = (message: string, error?: unknown) => void;

/**
 * Глобальный logger для feature flags. Используется как fallback,
 * когда не передан явный logger в стратегии.
 */
const globalLoggerState: { logger: FeatureFlagLogger | undefined; } = {
  logger: undefined,
};

/**
 * Устанавливает глобальный logger для feature flags.
 * Используется всеми стратегиями, когда не передан явный logger.
 */
export function setGlobalFeatureFlagLogger(logger: FeatureFlagLogger): void {
  // eslint-disable-next-line fp/no-mutation, functional/immutable-data -- Глобальный logger требует мутабельного состояния для установки через setGlobalFeatureFlagLogger (локально в этом модуле).
  globalLoggerState.logger = logger;
}

// Получает текущий глобальный logger для feature flags.
export function getGlobalFeatureFlagLogger(): FeatureFlagLogger | undefined {
  return globalLoggerState.logger;
}

export interface FeatureContext {
  readonly userId?: string;
  readonly tenantId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly service?: ServicePrefix;
  readonly locale?: string;
  readonly attributes?: FeatureAttributes;
}

// Имена feature flags с префиксом сервиса.
export type FeatureFlagName<T extends ServicePrefix = ServicePrefix> = `${T}_${string}`;

// Определение feature flag.
export interface FeatureFlagDefinition {
  readonly name: FeatureFlagName;
  readonly description: string;
  readonly default: boolean;
  readonly service: ServicePrefix;
  readonly strategy?: FeatureFlagStrategy | null;
  readonly version?: number;
}

// Provider API для получения feature flags.
export interface FeatureFlagProvider {
  getFlag(name: FeatureFlagName): Promise<FeatureFlagDefinition | undefined>;

  getFlags?(
    names: readonly FeatureFlagName[],
  ): Promise<ReadonlyMap<FeatureFlagName, FeatureFlagDefinition>>;

  snapshot?(): Promise<readonly FeatureFlagDefinition[]>;
}

// Причина результата оценки feature flag.
export type FeatureEvaluationReason =
  | 'DEFAULT'
  | 'STRATEGY'
  | 'NOT_FOUND'
  | 'ERROR';

// Результат оценки feature flag.
export interface FeatureEvaluationResult {
  readonly name: FeatureFlagName;
  readonly value: boolean;
  readonly reason: FeatureEvaluationReason;
  readonly flag?: FeatureFlagDefinition;
  readonly timestamp: number;
}

// Тип для runtime overrides (используется в React частях).
// Partial важен: overrides обычно задаются только для небольшого набора флагов.
export type FeatureFlagOverrides = Partial<Record<FeatureFlagName, boolean>>;

/* ============================================================================
 * STRATEGIES — FEATURE FLAG STRATEGIES
 * ========================================================================== */

export interface FeatureFlagStrategyMeta {
  readonly name: FeatureFlagName;
  readonly version?: number;
}

// Стратегия для оценки feature flag на основе контекста.
export type FeatureFlagStrategy = (ctx: FeatureContext, meta?: FeatureFlagStrategyMeta) => boolean;

// Стратегия: всегда включено.
export const alwaysOn: FeatureFlagStrategy = () => true;

// Стратегия: всегда выключено.
export const alwaysOff: FeatureFlagStrategy = () => false;

/**
 * Создает стратегию для пользователей.
 * Принцип: функциональная чистота и иммутабельность.
 * Set создается в локальном замыкании при каждом вызове.
 * Оптимизация: стратегии должны создаваться один раз при старте сервиса,
 * а не на каждый запрос. Для миллионов пользователей рассмотрите
 * отдельный оптимизированный кэш на уровне сервиса.
 */
export function enabledForUsers(userIds: readonly string[]): FeatureFlagStrategy;
export function enabledForUsers(userIds: ReadonlySet<string>): FeatureFlagStrategy;
export function enabledForUsers(
  userIds: readonly string[] | ReadonlySet<string>,
): FeatureFlagStrategy {
  // Создаем иммутабельный Set в локальном замыкании
  const allowedUsers = userIds instanceof Set ? userIds : new Set(userIds);

  return (ctx: FeatureContext) => ctx.userId !== undefined && allowedUsers.has(ctx.userId);
}

/**
 * Создает стратегию для тенантов.
 * Принцип: функциональная чистота и иммутабельность.
 * Set создается в локальном замыкании при каждом вызове.
 * Оптимизация: стратегии должны создаваться один раз при старте сервиса,
 * а не на каждый запрос. Для миллионов пользователей рассмотрите
 * отдельный оптимизированный кэш на уровне сервиса.
 */
export function enabledForTenants(tenantIds: readonly string[]): FeatureFlagStrategy;
export function enabledForTenants(tenantIds: ReadonlySet<string>): FeatureFlagStrategy;
export function enabledForTenants(
  tenantIds: readonly string[] | ReadonlySet<string>,
): FeatureFlagStrategy {
  // Создаем иммутабельный Set в локальном замыкании
  const allowedTenants = tenantIds instanceof Set ? tenantIds : new Set(tenantIds);

  return (ctx: FeatureContext) => ctx.tenantId !== undefined && allowedTenants.has(ctx.tenantId);
}

export function enabledForAttribute<K extends keyof KnownFeatureAttributes>(
  key: K,
  values: readonly NonNullable<KnownFeatureAttributes[K]>[],
): FeatureFlagStrategy;
export function enabledForAttribute(
  key: string,
  values: readonly FeatureAttributeValue[],
): FeatureFlagStrategy;
export function enabledForAttribute(
  key: string,
  values: readonly FeatureAttributeValue[],
): FeatureFlagStrategy {
  const allowed = new Set(values);
  return (ctx: FeatureContext) => {
    const v = ctx.attributes?.[key];
    return v !== undefined && allowed.has(v);
  };
}

/**
 * Создает стратегию rollout'а на основе процента.
 * Использует детерминированное хэширование для обеспечения консистентности
 * rollout'а между платформами и развертываниями.
 * Один и тот же пользователь/тенант всегда получит одинаковый результат для одного процента.
 */
export function percentageRollout(
  percentage: number,
  key: 'userId' | 'tenantId' = 'userId',
): FeatureFlagStrategy {
  // Безопасная валидация диапазона: от 0 до 100
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  if (safePercentage <= 0) return alwaysOff;
  if (safePercentage >= 100) return alwaysOn;

  return (ctx, meta) => {
    const id = ctx[key];
    if (id === undefined) {
      // Логируем через глобальный logger если доступен
      const logger = getGlobalFeatureFlagLogger();
      if (logger) {
        logger(`percentageRollout: ${key} is undefined in context, returning false`);
      }
      return false;
    }
    // Детерминированное распределение: зависит от имени флага + id (избегаем correlated rollouts)
    // >>> 0 обеспечивает беззнаковый 32-bit перед взятием модуля
    const seed = `${meta?.name ?? 'rollout'}:${id}`;
    return ((stableHash(seed) >>> 0) % 100) < safePercentage;
  };
}

// Комбинирует стратегии через логическое И (AND).
export const and =
  (...strategies: readonly FeatureFlagStrategy[]): FeatureFlagStrategy => (ctx, meta) =>
    strategies.every((s) => s(ctx, meta));

// Комбинирует стратегии через логическое ИЛИ (OR).
export const or =
  (...strategies: readonly FeatureFlagStrategy[]): FeatureFlagStrategy => (ctx, meta) =>
    strategies.some((s) => s(ctx, meta));

// Инвертирует стратегию (NOT).
export const not = (strategy: FeatureFlagStrategy): FeatureFlagStrategy => (ctx, meta) =>
  !strategy(ctx, meta);

// Замораживает контекст для иммутабельности.
export function freezeContext(ctx: FeatureContext): FeatureContext {
  if (Object.isFrozen(ctx)) return ctx;
  return Object.freeze({
    ...ctx,
    ...(ctx.attributes && { attributes: Object.freeze({ ...ctx.attributes }) }),
  });
}

/* ============================================================================
 * EVALUATION — FEATURE FLAG EVALUATION
 * ========================================================================== */

// Оценивает feature flag на основе provider и контекста.
export async function evaluateFeature(
  provider: FeatureFlagProvider, // Provider для получения определения флага
  name: FeatureFlagName, // Имя feature flag
  ctx: FeatureContext, // Контекст для оценки
  logger?: FeatureFlagLogger, // Опциональный logger (DI) для стратегий
): Promise<FeatureEvaluationResult> { // Результат оценки с метаданными
  const timestamp = Date.now();

  try {
    const flag = await provider.getFlag(name);

    if (!flag) {
      return {
        name,
        value: false,
        reason: 'NOT_FOUND',
        timestamp,
      };
    }

    if (!flag.strategy) {
      return {
        name,
        value: flag.default,
        reason: 'DEFAULT',
        flag,
        timestamp,
      };
    }

    // Замораживаем контекст один раз для всех стратегий
    const frozenCtx = freezeContext(ctx);
    const meta: FeatureFlagStrategyMeta = flag.version === undefined
      ? { name: flag.name }
      : { name: flag.name, version: flag.version };
    const value = safeExecuteStrategy(flag.strategy, frozenCtx, meta, logger);

    return {
      name,
      value,
      reason: 'STRATEGY',
      flag,
      timestamp,
    };
  } catch {
    return {
      name,
      value: false,
      reason: 'ERROR',
      timestamp,
    };
  }
}

// Проверяет включен ли feature flag (совместимость с предыдущим API).
export async function isFeatureEnabled(
  provider: FeatureFlagProvider, // Provider для получения определения флага
  name: FeatureFlagName, // Имя feature flag
  ctx: FeatureContext, // Контекст для оценки
  logger?: FeatureFlagLogger, // Опциональный logger (DI) для стратегий
): Promise<boolean> { // true если флаг включен, false иначе
  const result = await evaluateFeature(provider, name, ctx, logger);
  return result.value;
}

/**
 * Оптимизированная bulk-оценка feature flags.
 * Выполняет freeze один раз для всего массива результатов вместо отдельных freeze вызовов.
 */
export async function evaluateFeatures(
  provider: FeatureFlagProvider, // Provider для получения определений флагов
  names: readonly FeatureFlagName[], // Массив имен feature flags
  ctx: FeatureContext, // Контекст для оценки
  logger?: FeatureFlagLogger, // Опциональный logger (DI) для стратегий
): Promise<readonly FeatureEvaluationResult[]> { // Массив результатов оценки
  // Замораживаем контекст один раз для всех оценок
  const frozenCtx = freezeContext(ctx);

  if (provider.getFlags) {
    const map: ReadonlyMap<FeatureFlagName, FeatureFlagDefinition> = await provider.getFlags(names);
    const results = names.map((name) => evaluateFromMap(name, map.get(name), frozenCtx, logger));
    return Object.freeze(results);
  }

  const results = await Promise.all(
    names.map((name) => evaluateFeature(provider, name, frozenCtx, logger)),
  );
  return Object.freeze(results);
}

/* ============================================================================
 * PROVIDER — IN-MEMORY PROVIDER
 * ========================================================================== */

/**
 * Создает in-memory provider для feature flags.
 * Полезно для тестирования и статических конфигураций.
 */
export function createInMemoryFeatureFlagProvider(
  flags: readonly FeatureFlagDefinition[], // Массив определений feature flags
): FeatureFlagProvider { // FeatureFlagProvider
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
 * INTERNAL UTILITIES — ВНУТРЕННИЕ УТИЛИТЫ
 * ========================================================================== */

/**
 * Безопасно выполняет стратегию с обработкой ошибок.
 * Контекст должен быть уже заморожен перед вызовом этой функции.
 * @internal
 */
function safeExecuteStrategy(
  strategy: FeatureFlagStrategy,
  ctx: FeatureContext,
  meta?: FeatureFlagStrategyMeta,
  logger?: FeatureFlagLogger,
): boolean {
  try {
    // Контекст уже заморожен в evaluateFeature/evaluateFromMap
    return strategy(ctx, meta);
  } catch (err) {
    const errorMessage = `Feature flag strategy error for userId=${ctx.userId ?? 'unknown'}`;

    // Приоритет: явный logger > глобальный logger
    if (logger) {
      logger(errorMessage, err);
    } else {
      const globalLogger = getGlobalFeatureFlagLogger();
      if (globalLogger) {
        globalLogger(errorMessage, err);
      }
    }
    // Без fallback на console - core должен быть platform neutral
    return false; // безопасное fallback значение
  }
}

/**
 * Оценивает feature flag из map (для bulk операций).
 * Контекст должен быть уже заморожен перед вызовом этой функции.
 * @internal
 */
function evaluateFromMap(
  name: FeatureFlagName,
  flag: FeatureFlagDefinition | undefined,
  ctx: FeatureContext,
  logger?: FeatureFlagLogger,
): FeatureEvaluationResult {
  const timestamp = Date.now();

  if (!flag) {
    return {
      name,
      value: false,
      reason: 'NOT_FOUND',
      timestamp,
    };
  }

  if (!flag.strategy) {
    return {
      name,
      value: flag.default,
      reason: 'DEFAULT',
      flag,
      timestamp,
    };
  }

  // Контекст уже заморожен в evaluateFeatures
  const meta: FeatureFlagStrategyMeta = flag.version === undefined
    ? { name: flag.name }
    : { name: flag.name, version: flag.version };
  return {
    name,
    value: safeExecuteStrategy(flag.strategy, ctx, meta, logger),
    reason: 'STRATEGY',
    flag,
    timestamp,
  };
}
