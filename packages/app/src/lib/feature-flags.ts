/**
 * @file packages/app/src/lib/feature-flags.ts
 * ============================================================================
 * 🔹 FEATURE FLAGS CORE — ПЛАТФОРМЕННОЕ ЯДРО УПРАВЛЕНИЯ ФУНКЦИОНАЛОМ
 * ============================================================================
 * Уровень: Platform / Infrastructure kernel
 * Свойства:
 * - детерминированность
 * - отказоустойчивость
 * - расширяемость
 * - микросервисная изоляция
 * - поддержка distributed систем
 */

import React from 'react';

import type { ServicePrefix } from './error-mapping.js';

/* ============================================================================
 * 🔢 МУРМУРХЭШ КОНСТАНТЫ
 * ========================================================================== */

/**
 * Стандартные константы MurmurHash3 для детерминированного хэширования.
 * Не изменять - это проверенная криптографическая реализация.
 */
const MURMURHASH_C1 = 0xcc9e2d51; // Первая константа смешивания
const MURMURHASH_C2 = 0x1b873593; // Вторая константа смешивания
const MURMURHASH_R1 = 15; // Первый угол поворота
const MURMURHASH_R2 = 13; // Второй угол поворота
const MURMURHASH_M = 5; // Константа умножения
const MURMURHASH_N = 0xe6546b64; // Константа сложения
const MURMURHASH_FINALIZE_MIX_1 = 0x85ebca6b; // Финализация 1
const MURMURHASH_FINALIZE_MIX_2 = 0xc2b2ae35; // Финализация 2
const MURMURHASH_BLOCK_SIZE = 4; // Размер блока обработки в байтах
const MURMURHASH_BYTE_BITS = 8; // Бит в байте
const MURMURHASH_WORD_BITS = 32; // Бит в 32-bit слове
const MURMURHASH_FINALIZE_SHIFT_1 = 16; // Первый сдвиг финализации
const MURMURHASH_FINALIZE_SHIFT_2 = 13; // Второй сдвиг финализации
const MURMURHASH_FINALIZE_SHIFT_3 = 16; // Третий сдвиг финализации

/* ============================================================================
 * 🧠 КОНТЕКСТ
 * ========================================================================== */

export type FeatureAttributeValue = string | number | boolean;

/**
 * Известные структурированные атрибуты для feature flags.
 * Обеспечивают типобезопасность и автодополнение.
 */
export type KnownFeatureAttributes = {
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
};

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
 *
 * @example
 * ```typescript
 * // Настройка глобального logger'а
 * setGlobalFeatureFlagLogger((message, error) => {
 *   telemetry.error('FeatureFlag', message, { error });
 * });
 * // Теперь все стратегии будут использовать этот logger
 * const strategy = percentageRollout(50);
 * ```
 */
let globalFeatureFlagLogger: FeatureFlagLogger | undefined;

/**
 * Устанавливает глобальный logger для feature flags.
 * Используется всеми стратегиями, когда не передан явный logger.
 */
export function setGlobalFeatureFlagLogger(logger: FeatureFlagLogger): void {
  globalFeatureFlagLogger = logger;
}

/**
 * Получает текущий глобальный logger для feature flags.
 */
export function getGlobalFeatureFlagLogger(): FeatureFlagLogger | undefined {
  return globalFeatureFlagLogger;
}

export type FeatureContext = {
  readonly userId?: string;
  readonly tenantId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly service?: ServicePrefix;
  readonly locale?: string;
  readonly attributes?: FeatureAttributes;
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

/**
 * Создает стратегию для пользователей.
 * Принцип: функциональная чистота и иммутабельность.
 * Set создается в локальном замыкании при каждом вызове.
 * Оптимизация: стратегии должны создаваться один раз при старте сервиса,
 * а не на каждый запрос. Для миллионов пользователей рассмотрите
 * отдельный оптимизированный кэш на уровне сервиса.
 *
 * @example
 * ```typescript
 * const vipUsers = enabledForUsers(['user-123', 'user-456']);
 * const flag: FeatureFlagDefinition = {
 *   name: 'SYSTEM_premium_features',
 *   description: 'Premium features for VIP users',
 *   default: false,
 *   service: 'SYSTEM',
 *   strategy: vipUsers,
 * };
 * ```
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

/**
 * Создает стратегию rollout'а на основе процента.
 * Использует детерминированное хэширование для обеспечения консистентности
 * rollout'а между платформами и развертываниями.
 * Один и тот же пользователь/тенант всегда получит одинаковый результат для одного процента.
 *
 * @example
 * ```typescript
 * const gradualRollout = percentageRollout(25); // 25% пользователей
 * const tenantRollout = percentageRollout(50, 'tenantId'); // 50% тенантов
 * const flag: FeatureFlagDefinition = {
 *   name: 'SYSTEM_new_ui',
 *   description: 'New UI rollout',
 *   default: false,
 *   service: 'SYSTEM',
 *   strategy: gradualRollout,
 * };
 * ```
 */
export function percentageRollout(
  percentage: number,
  key: 'userId' | 'tenantId' = 'userId',
): FeatureFlagStrategy {
  // Безопасная валидация диапазона: от 0 до 100
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  if (safePercentage <= 0) return alwaysOff;
  if (safePercentage >= 100) return alwaysOn;

  return (ctx) => {
    const id = ctx[key];
    if (id === undefined) {
      // Критично: логируем в dev mode когда ключ undefined
      if (process.env['NODE_ENV'] === 'development') {
        // eslint-disable-next-line no-console
        console.warn(`percentageRollout: ${key} is undefined in context, returning false`);
      }
      return false;
    }
    // Детерминированное распределение: один ID всегда дает одинаковый результат
    // >>> 0 обеспечивает беззнаковый 32-bit перед взятием модуля
    return ((stableHash(id) >>> 0) % 100) < safePercentage;
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

    const value = safeExecuteStrategy(flag.strategy, ctx);

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
 * 🎣 REACT HOOKS
 * ========================================================================== */

/**
 * React хук для проверки feature flag отключения компонента.
 * Возвращает true если компонент должен быть отключен через feature flag.
 */
export function useFeatureFlag(flagValue?: boolean): boolean {
  return Boolean(flagValue);
}

/* ============================================================================
 * 📦 BULK API
 * ========================================================================== */

/**
 * Оптимизированная bulk-оценка feature flags.
 * Выполняет freeze один раз для всего массива результатов вместо отдельных freeze вызовов.
 */
export async function evaluateFeatures(
  provider: FeatureFlagProvider,
  names: readonly FeatureFlagName[],
  ctx: FeatureContext,
): Promise<readonly FeatureEvaluationResult[]> {
  if (provider.getFlags) {
    const map: ReadonlyMap<FeatureFlagName, FeatureFlagDefinition> = await provider.getFlags(names);
    const results = names.map((name) => evaluateFromMap(name, map.get(name), ctx));
    return Object.freeze(results);
  }

  const results = await Promise.all(names.map((name) => evaluateFeature(provider, name, ctx)));
  return Object.freeze(results);
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
  logger?: FeatureFlagLogger,
): boolean {
  try {
    return strategy(freezeContext(ctx));
  } catch (err) {
    const errorMessage = `Feature flag strategy error for userId=${ctx.userId ?? 'unknown'}`;

    // Приоритет: явный logger > глобальный logger > development console
    if (logger) {
      logger(errorMessage, err);
    } else if (globalFeatureFlagLogger) {
      globalFeatureFlagLogger(errorMessage, err);
    } else if (process.env['NODE_ENV'] === 'development') {
      // Fallback только для development без глобального logger'а
      // eslint-disable-next-line no-console
      console.error(`${errorMessage}:`, err);
    }
    return false; // безопасное fallback значение
  }
}

function evaluateFromMap(
  name: FeatureFlagName,
  flag: FeatureFlagDefinition | undefined,
  ctx: FeatureContext,
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

  return {
    name,
    value: safeExecuteStrategy(flag.strategy, ctx),
    reason: 'STRATEGY',
    flag,
    timestamp,
  };
}

/**
 * Реализация MurmurHash3 32-bit для детерминированного распределения.
 * Обеспечивает лучшую устойчивость к коллизиям по сравнению с простым хэшированием строк.
 * Используется для процентных rollout'ов фич.
 */
function stableHash(input: string): number {
  let hash = 0;

  // Обрабатываем по 4 байта за раз
  for (let i = 0; i < input.length; i += MURMURHASH_BLOCK_SIZE) {
    let k = 0;
    for (let j = 0; j < MURMURHASH_BLOCK_SIZE && i + j < input.length; j++) {
      k |= input.charCodeAt(i + j) << (j * MURMURHASH_BYTE_BITS);
    }

    k = Math.imul(k, MURMURHASH_C1);
    k = (k << MURMURHASH_R1) | (k >>> (MURMURHASH_WORD_BITS - MURMURHASH_R1));
    k = Math.imul(k, MURMURHASH_C2);

    hash ^= k;
    hash = (hash << MURMURHASH_R2) | (hash >>> (MURMURHASH_WORD_BITS - MURMURHASH_R2));
    hash = Math.imul(hash, MURMURHASH_M) + MURMURHASH_N;
  }

  // Финальное смешивание (стандартная финализация MurmurHash3)
  hash ^= input.length;
  hash ^= hash >>> MURMURHASH_FINALIZE_SHIFT_1;
  hash = Math.imul(hash, MURMURHASH_FINALIZE_MIX_1);
  hash ^= hash >>> MURMURHASH_FINALIZE_SHIFT_2;
  /* istanbul ignore next */
  hash = Math.imul(hash, MURMURHASH_FINALIZE_MIX_2);
  /* istanbul ignore next */
  hash ^= hash >>> MURMURHASH_FINALIZE_SHIFT_3;

  return hash >>> 0; // Гарантируем беззнаковый 32-bit
}

export function freezeContext(ctx: FeatureContext): FeatureContext {
  if (Object.isFrozen(ctx)) return ctx;
  return Object.freeze({
    ...ctx,
    ...(ctx.attributes && { attributes: Object.freeze({ ...ctx.attributes }) }),
  });
}

/* ============================================================================
 * 🎭 RUNTIME FLAG OVERRIDE CONTEXT (Критично для A/B тестов)
 * ========================================================================== */

/**
 * Context для runtime переопределения feature flags.
 * Позволяет динамически изменять состояние флагов без перезапуска приложения.
 */
export const FeatureFlagOverrideContext = React.createContext<FeatureFlagOverrides | null>(null);

/**
 * Provider для runtime переопределения feature flags.
 * Используется для A/B тестирования и динамических изменений.
 *
 * @example
 * ```typescript
 * function App() {
 *   const overrides: FeatureFlagOverrides = {
 *     'SYSTEM_new_ui': true,
 *     'SYSTEM_telemetry_enabled': false,
 *   };
 *   return (
 *     <FeatureFlagOverrideProvider overrides={overrides}>
 *       <MyApp />
 *     </FeatureFlagOverrideProvider>
 *   );
 * }
 * ```
 */
export const FeatureFlagOverrideProvider: React.FC<{
  overrides: FeatureFlagOverrides;
  children: React.ReactNode;
}> = ({ overrides, children }) => {
  return React.createElement(
    FeatureFlagOverrideContext.Provider,
    { value: overrides },
    children,
  );
};

/**
 * Hook для получения переопределенных значений feature flags.
 * Приоритет: override > исходное значение.
 * Критично для A/B тестирования и runtime управления.
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const isNewFeatureEnabled = useFeatureFlagOverride('SYSTEM_new_feature', false);
 *   return isNewFeatureEnabled ? <NewFeature /> : <OldFeature />;
 * }
 * ```
 */
export function useFeatureFlagOverride(flagName: FeatureFlagName, defaultValue = false): boolean {
  const overrides = React.useContext(FeatureFlagOverrideContext);
  return overrides?.[flagName] ?? defaultValue;
}

/* ============================================================================
 * 🎭 RUNTIME FLAG OVERRIDE CONTEXT
 * ========================================================================== */

export type FeatureFlagOverrides = Record<FeatureFlagName, boolean>;
