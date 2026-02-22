/**
 * @file packages/core/src/pipeline/runtime-overrides.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Runtime Overrides / On-Call Safety Switches)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Runtime overrides для экстренного управления pipeline
 * - On-call safety switches для быстрого реагирования на инциденты
 * - Причина изменения: operational readiness / incident response
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, HELPERS, PROVIDERS, API
 * - ✅ Deterministic: pure functions для применения overrides (чтение env через injectable provider, fail-safe механизмы)
 * - ✅ Domain-pure: generic по конфигурации через TConfig, без привязки к domain-специфичным типам
 * - ✅ Extensible: strategy pattern (OverrideApplier, OverrideProvider, OverridePriorityMap) без изменения core логики
 * - ✅ Strict typing: union-типы для override keys и приоритетов, без string literals в domain
 * - ✅ Microservice-ready: stateless, injectable env provider для тестирования, без скрытого coupling
 * - ✅ Scalable: поддержка множественных источников overrides с dynamic priority per key и event hooks для мониторинга
 */

/* ============================================================================
 * 1. TYPES — RUNTIME OVERRIDE MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Ключ runtime override
 * @public
 */
export type OverrideKey =
  | 'force_version'
  | 'disable_provider'
  | 'fail_open_mode'
  | 'enable_shadow_mode'
  | 'disable_circuit_breaker';

/**
 * Источник runtime override
 * @public
 */
export type OverrideSource =
  | Readonly<{ kind: 'environment'; key: string; }>
  | Readonly<{ kind: 'custom'; provider: string; }>
  | Readonly<{ kind: 'runtime'; timestamp: number; }>;

/**
 * Приоритет override для применения
 * @public
 */
export type OverridePriority = 'custom' | 'runtime' | 'environment';

/**
 * Маппинг приоритетов для каждого override key
 * @public
 */
export type OverridePriorityMap = Readonly<Partial<Record<OverrideKey, OverridePriority>>>;

/**
 * Функция для применения одного override к конфигурации
 * @template TConfig - Тип конфигурации pipeline (generic, domain-agnostic)
 * @public
 */
export type OverrideApplier<TConfig extends Readonly<Record<string, unknown>>> = (
  config: TConfig,
  overrideKey: OverrideKey,
) => TConfig;

/**
 * Runtime override для pipeline
 * @public
 */
export type RuntimeOverride = Readonly<{
  /** Ключ override */
  readonly key: OverrideKey;
  /** Значение override */
  readonly value: boolean;
  /** Источник override (для observability) */
  readonly source: OverrideSource;
  /** Timestamp создания override */
  readonly timestamp: number;
}>;

/**
 * Набор runtime overrides
 * @public
 */
export type RuntimeOverrides = Readonly<{
  /** Принудительно использовать старую версию */
  readonly forceVersion?: boolean;
  /** Отключить внешний provider */
  readonly disableProvider?: boolean;
  /** Включить fail-open режим (только для emergency) */
  readonly failOpenMode?: boolean;
  /** Включить shadow mode */
  readonly enableShadowMode?: boolean;
  /** Отключить circuit breaker */
  readonly disableCircuitBreaker?: boolean;
}>;

/**
 * Результат применения overrides
 * @public
 */
export type OverrideResult = Readonly<{
  /** Применены ли overrides */
  readonly applied: boolean;
  /** Какие override keys применены */
  readonly activeKeys: readonly OverrideKey[];
  /** Timestamp применения */
  readonly appliedAt: number;
  /** Источники примененных overrides */
  readonly sources: readonly OverrideSource[];
}>;

/**
 * Событие применения override
 * @public
 */
export type OverrideEvent = Readonly<{
  /** Ключ примененного override */
  readonly key: OverrideKey;
  /** Источник override */
  readonly source: OverrideSource;
  /** Timestamp применения */
  readonly timestamp: number;
  /** Конфигурация до применения */
  readonly configBefore: Readonly<Record<string, unknown>>;
  /** Конфигурация после применения */
  readonly configAfter: Readonly<Record<string, unknown>>;
}>;

/**
 * Callback для событий применения overrides
 * @note Используется для мониторинга и telemetry
 * @public
 */
export type OverrideEventHandler = (event: OverrideEvent) => void;

/**
 * Provider для чтения environment variables
 * @note Injectable для тестирования и детерминированности
 * @public
 */
export type EnvProvider = Readonly<{
  /** Читает значение environment variable */
  readonly get: (key: string) => string | undefined;
  /** Проверяет доступность environment variables */
  readonly isAvailable: () => boolean;
}>;

/**
 * Provider для чтения runtime overrides
 * @template TOverrides - Тип overrides (generic для extensibility)
 * @public
 */
export type OverrideProvider<TOverrides extends Readonly<Record<string, unknown>>> = (
  env: EnvProvider,
) => TOverrides;

/* ============================================================================
 * 2. CONSTANTS — DEFAULT VALUES
 * ============================================================================
 */

/** Дефолтные overrides (все отключены) */
export const DEFAULT_RUNTIME_OVERRIDES: RuntimeOverrides = {
  forceVersion: false,
  disableProvider: false,
  failOpenMode: false,
  enableShadowMode: false,
  disableCircuitBreaker: false,
} as const;

/** Префикс для environment variable keys */
const ENV_PREFIX = 'PIPELINE_OVERRIDE_';

/** Маппинг override keys на environment variable names */
const OVERRIDE_KEY_TO_ENV: Readonly<Record<OverrideKey, string>> = {
  force_version: `${ENV_PREFIX}FORCE_VERSION`,
  disable_provider: `${ENV_PREFIX}DISABLE_PROVIDER`,
  fail_open_mode: `${ENV_PREFIX}FAIL_OPEN_MODE`,
  enable_shadow_mode: `${ENV_PREFIX}ENABLE_SHADOW_MODE`,
  disable_circuit_breaker: `${ENV_PREFIX}DISABLE_CIRCUIT_BREAKER`,
} as const;

/* ============================================================================
 * 3. HELPERS — PURE FUNCTIONS (Validation & Normalization)
 * ============================================================================
 */

/**
 * Парсит boolean значение из строки с нормализацией
 * @note Pure function: детерминированное преобразование с защитой от пустых строк
 * @internal
 */
function parseBoolean(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '') {
    return false;
  }
  return normalized === '1' || normalized === 'true';
}

/**
 * Удаляет ключ из объекта (immutable)
 * @template T - Тип объекта
 * @template K - Тип ключа для удаления
 * @note Pure function: создает новый объект без указанного ключа
 * @internal
 */
function omitKey<T extends Readonly<Record<string, unknown>>, K extends keyof T>(
  obj: T,
  key: K,
): Omit<T, K> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ключ удаляется из объекта через rest
  const { [key]: omittedValue, ...rest } = obj;
  return rest;
}

/**
 * Создает источник override из environment variable
 * @internal
 */
function createEnvOverrideSource(envKey: string): OverrideSource {
  return { kind: 'environment', key: envKey };
}

/**
 * Создает источник override из custom provider
 * @internal
 */
function createCustomOverrideSource(provider: string): OverrideSource {
  return { kind: 'custom', provider };
}

/**
 * Создает источник override из runtime
 * @internal
 */
function createRuntimeOverrideSource(timestamp: number): OverrideSource {
  return { kind: 'runtime', timestamp };
}

/* ============================================================================
 * 4. PROVIDERS — OVERRIDE SOURCES (Extensible Strategy Pattern)
 * ============================================================================
 */

/**
 * Создает дефолтный env provider (Node.js process.env)
 * @note Для production использования
 * @public
 */
export function createDefaultEnvProvider(): EnvProvider {
  return {
    get: (key: string): string | undefined => {
      if (typeof process === 'undefined' || typeof process.env === 'undefined') {
        return undefined;
      }
      return process.env[key];
    },
    isAvailable: (): boolean => {
      return typeof process !== 'undefined' && typeof process.env !== 'undefined';
    },
  };
}

/**
 * Создает env provider из объекта (для тестирования)
 * @note Для deterministic testing
 * @public
 */
export function createEnvProviderFromObject(
  env: Readonly<Record<string, string | undefined>>,
): EnvProvider {
  return {
    get: (key: string): string | undefined => {
      return env[key];
    },
    isAvailable: (): boolean => {
      return true;
    },
  };
}

/**
 * Читает runtime overrides из environment variables с fail-safe
 * @note Pure function: детерминированное чтение через injectable provider
 * @note Fail-safe: защита от ошибок чтения env vars
 * @public
 */
export function readRuntimeOverridesFromEnv(
  env: EnvProvider = createDefaultEnvProvider(),
): RuntimeOverrides {
  if (!env.isAvailable()) {
    return DEFAULT_RUNTIME_OVERRIDES;
  }

  // Читаем каждый override key из environment variables с fail-safe
  const readOverride = (key: OverrideKey): boolean => {
    try {
      const envKey = OVERRIDE_KEY_TO_ENV[key];
      const value = env.get(envKey);
      return parseBoolean(value);
    } catch {
      // Fail-safe: при ошибке чтения возвращаем false
      return false;
    }
  };

  const forceVersion = readOverride('force_version');
  const disableProvider = readOverride('disable_provider');
  const failOpenMode = readOverride('fail_open_mode');
  const enableShadowMode = readOverride('enable_shadow_mode');
  const disableCircuitBreaker = readOverride('disable_circuit_breaker');

  // Создаем новый объект (immutable)
  return {
    ...DEFAULT_RUNTIME_OVERRIDES,
    ...(forceVersion && { forceVersion: true }),
    ...(disableProvider && { disableProvider: true }),
    ...(failOpenMode && { failOpenMode: true }),
    ...(enableShadowMode && { enableShadowMode: true }),
    ...(disableCircuitBreaker && { disableCircuitBreaker: true }),
  };
}

/**
 * Создает custom override provider с fail-safe
 * @template TOverrides - Тип overrides
 * @note Extensible: позволяет добавлять custom источники overrides
 * @note Fail-safe: защита от ошибок в custom provider
 * @public
 */
export function createCustomOverrideProvider<TOverrides extends Readonly<Record<string, unknown>>>(
  provider: OverrideProvider<TOverrides>, // Provider для чтения custom overrides
): OverrideProvider<TOverrides> {
  return (env: EnvProvider): TOverrides => {
    try {
      return provider(env);
    } catch {
      // Fail-safe: при ошибке в custom provider возвращаем пустой объект
      return {} as TOverrides;
    }
  };
}

/* ============================================================================
 * 5. API — OVERRIDE APPLICATION & VALIDATION
 * ============================================================================
 */

/**
 * Создает дефолтный mapper для применения overrides
 * @template TConfig - Тип конфигурации pipeline
 * @note Generic, domain-agnostic: использует только общие паттерны конфигурации
 * @public
 */
export function createDefaultOverrideMapper<
  TConfig extends Readonly<Record<string, unknown>>,
>(): Readonly<
  Record<OverrideKey, OverrideApplier<TConfig>>
> {
  const forceVersionApplier: OverrideApplier<TConfig> = (config: TConfig): TConfig => {
    if ('version' in config) {
      return { ...config, version: 1 };
    }
    return config;
  };

  const disableProviderApplier: OverrideApplier<TConfig> = (config: TConfig): TConfig => {
    if ('provider' in config) {
      return omitKey(config as Readonly<Record<string, unknown>>, 'provider') as TConfig;
    }
    return config;
  };

  const failOpenModeApplier: OverrideApplier<TConfig> = (config: TConfig): TConfig => {
    if ('failClosed' in config) {
      return { ...config, failClosed: false };
    }
    return config;
  };

  const enableShadowModeApplier: OverrideApplier<TConfig> = (config: TConfig): TConfig => {
    if ('shadowMode' in config) {
      return { ...config, shadowMode: true };
    }
    return config;
  };

  const disableCircuitBreakerApplier: OverrideApplier<TConfig> = (config: TConfig): TConfig => {
    if ('circuitBreakerEnabled' in config) {
      return { ...config, circuitBreakerEnabled: false };
    }
    return config;
  };

  // Используем Object.fromEntries для создания объекта с snake_case ключами
  const mapperEntries: readonly (readonly [OverrideKey, OverrideApplier<TConfig>])[] = [
    ['force_version', forceVersionApplier],
    ['disable_provider', disableProviderApplier],
    ['fail_open_mode', failOpenModeApplier],
    ['enable_shadow_mode', enableShadowModeApplier],
    ['disable_circuit_breaker', disableCircuitBreakerApplier],
  ];

  return Object.fromEntries(mapperEntries) as Readonly<
    Record<OverrideKey, OverrideApplier<TConfig>>
  >;
}

/**
 * Создает источник override на основе приоритета
 * @internal
 */
function createSourceForPriority(
  key: OverrideKey,
  priority: OverridePriority,
  timestamp: number,
): OverrideSource {
  switch (priority) {
    case 'custom':
      return createCustomOverrideSource('customProvider');
    case 'runtime':
      return createRuntimeOverrideSource(timestamp);
    case 'environment':
    default:
      return createEnvOverrideSource(OVERRIDE_KEY_TO_ENV[key]);
  }
}

/**
 * Применяет runtime overrides к конфигурации pipeline
 * @template TConfig - Тип конфигурации pipeline (generic, domain-agnostic)
 * @note Pure function: детерминированное применение overrides с приоритетами
 * @public
 */
export function applyRuntimeOverrides<TConfig extends Readonly<Record<string, unknown>>>(
  config: TConfig, // Конфигурация pipeline для применения overrides
  overrides: RuntimeOverrides, // Набор runtime overrides для применения
  now: number = Date.now(), // Timestamp для deterministic testing (опционально)
  overrideMapper: Readonly<Record<OverrideKey, OverrideApplier<TConfig>>> =
    createDefaultOverrideMapper<TConfig>(), // Кастомный mapper для применения overrides (опционально, по умолчанию дефолтный)
  overridePriorityMap?: OverridePriorityMap, // Маппинг приоритетов для каждого ключа (опционально, приоритет по ключу или общий fallback)
  overridePriority: OverridePriority = 'environment', // Общий приоритет источников overrides (опционально, по умолчанию environment, используется как fallback)
  onOverrideApplied?: OverrideEventHandler, // Callback для событий применения overrides (опционально, для мониторинга)
): Readonly<TConfig & OverrideResult> {
  // Применяем каждый override последовательно (детерминированный порядок)
  const overrideMappings: readonly (readonly [OverrideKey, boolean | undefined])[] = [
    ['force_version', overrides.forceVersion],
    ['disable_provider', overrides.disableProvider],
    ['fail_open_mode', overrides.failOpenMode],
    ['enable_shadow_mode', overrides.enableShadowMode],
    ['disable_circuit_breaker', overrides.disableCircuitBreaker],
  ];

  const getPriorityForKey = (key: OverrideKey): OverridePriority => {
    return overridePriorityMap?.[key] ?? overridePriority;
  };

  const result = overrideMappings.reduce(
    (acc, [key, value]) => {
      if (value === true) {
        const applier = overrideMapper[key];
        const configBefore = acc.config;
        const configAfter = applier(configBefore, key);
        const priority = getPriorityForKey(key);
        const source = createSourceForPriority(key, priority, now);

        // Вызываем callback для мониторинга (если предоставлен)
        if (onOverrideApplied !== undefined) {
          try {
            onOverrideApplied({
              key,
              source,
              timestamp: now,
              configBefore,
              configAfter,
            });
          } catch {
            // Fail-safe: ошибка в callback не должна ломать применение overrides
          }
        }

        return {
          config: configAfter,
          activeKeys: [...acc.activeKeys, key],
          sources: [...acc.sources, source],
        };
      }
      return acc;
    },
    {
      config,
      activeKeys: [] as readonly OverrideKey[],
      sources: [] as readonly OverrideSource[],
    },
  );

  return {
    ...result.config,
    applied: result.activeKeys.length > 0,
    activeKeys: result.activeKeys,
    appliedAt: now,
    sources: result.sources,
  };
}

/**
 * Проверяет, активны ли какие-либо overrides
 * @note Pure function: детерминированная проверка
 * @public
 */
export function hasActiveOverrides(overrides: RuntimeOverrides): boolean {
  return (
    overrides.forceVersion === true
    || overrides.disableProvider === true
    || overrides.failOpenMode === true
    || overrides.enableShadowMode === true
    || overrides.disableCircuitBreaker === true
  );
}

/**
 * Получает список активных override keys
 * @note Pure function: детерминированное извлечение ключей
 * @public
 */
export function getActiveOverrideKeys(overrides: RuntimeOverrides): readonly OverrideKey[] {
  const keys: readonly OverrideKey[] = [
    ...(overrides.forceVersion === true ? ['force_version'] as const : []),
    ...(overrides.disableProvider === true ? ['disable_provider'] as const : []),
    ...(overrides.failOpenMode === true ? ['fail_open_mode'] as const : []),
    ...(overrides.enableShadowMode === true ? ['enable_shadow_mode'] as const : []),
    ...(overrides.disableCircuitBreaker === true ? ['disable_circuit_breaker'] as const : []),
  ];
  return keys;
}

/**
 * Валидирует runtime overrides
 * @note Pure function: детерминированная валидация
 * @public
 */
export function validateRuntimeOverrides(overrides: unknown): overrides is RuntimeOverrides {
  if (typeof overrides !== 'object' || overrides === null) {
    return false;
  }

  const obj = overrides as Readonly<Record<string, unknown>>;

  // Проверяем, что все поля (если есть) являются boolean или undefined
  const allowedKeys: readonly (keyof RuntimeOverrides)[] = [
    'forceVersion',
    'disableProvider',
    'failOpenMode',
    'enableShadowMode',
    'disableCircuitBreaker',
  ];

  const allKeysValid = allowedKeys.every((key) => {
    if (key in obj) {
      const value = obj[key];
      return value === undefined || typeof value === 'boolean';
    }
    return true;
  });

  if (!allKeysValid) {
    return false;
  }

  // Проверяем, что нет лишних полей
  const objKeys = Object.keys(obj);
  const hasOnlyAllowedKeys = objKeys.every((key) =>
    allowedKeys.includes(key as keyof RuntimeOverrides)
  );
  if (!hasOnlyAllowedKeys) {
    return false;
  }

  return true;
}
