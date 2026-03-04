/**
 * @file packages/core/src/pipeline/feature-flags.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Feature Flags)
 * ============================================================================
 * Архитектурная роль:
 * - Feature flag management для безопасного rollout pipeline версий
 * - Детерминированное разрешение версий на основе контекста
 * - Причина изменения: rollout strategy changes, A/B testing
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, HELPERS (hash, валидация ID), RESOLVERS, API
 * - ✅ Deterministic: одинаковый вход → одинаковый результат (pure functions, детерминированный hash с | 0 для 32-bit)
 * - ✅ Domain-pure: generic по TContext, без привязки к domain-специфичным типам
 * - ✅ Extensible: strategy pattern (customResolver, resolverPipeline, resolverPriorities) без изменения core логики
 * - ✅ Strict typing: union-типы (PipelineVersion, PipelineMode, FeatureFlagSource, ResolverPriority), без string literals в domain
 * - ✅ Microservice-ready: stateless, без side-effects (Date.now() опционально для deterministic testing), без скрытого coupling
 * - ✅ Scalable: поддержка множественных источников (tenant, bucket, percentage) с конфигурируемыми приоритетами
 */

/* ============================================================================
 * 1. TYPES — FEATURE FLAG MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Версия pipeline для rollout
 * @public
 */
export type PipelineVersion = 'v1' | 'v2' | 'v3';

/**
 * Режим выполнения pipeline
 * @public
 */
export type PipelineMode =
  | Readonly<{ kind: 'forced'; version: PipelineVersion; }>
  | Readonly<{ kind: 'shadow'; version: PipelineVersion; }>
  | Readonly<{ kind: 'active'; version: PipelineVersion; }>;

/**
 * Источник feature flag для разрешения версии
 * @public
 */
export type FeatureFlagSource =
  | Readonly<{ kind: 'user_bucket'; bucketId: string; }>
  | Readonly<{ kind: 'tenant'; tenantId: string; }>
  | Readonly<{ kind: 'traffic_percentage'; percentage: number; }>
  | Readonly<{ kind: 'custom'; resolver: string; }>;

/**
 * Приоритет resolver для комбинированного разрешения
 * @public
 */
export type ResolverPriority = 'tenant' | 'user_bucket' | 'traffic_percentage';

/**
 * Конфигурация rollout для pipeline
 * @template TContext - Тип контекста для разрешения feature flags (generic, domain-agnostic)
 * @public
 */
export type RolloutConfig<TContext extends Readonly<Record<string, unknown>>> = Readonly<{
  /** Custom resolver для разрешения версии (опционально, имеет приоритет над встроенными) */
  readonly customResolver?: FeatureFlagResolver<TContext>;
  /** Pipeline resolvers для каскадного разрешения (опционально, заменяет встроенный combined resolver) */
  readonly resolverPipeline?: readonly FeatureFlagResolver<TContext>[];
  /** Приоритеты resolvers для комбинированного разрешения (опционально, по умолчанию tenant → user_bucket → traffic_percentage) */
  readonly resolverPriorities?: readonly ResolverPriority[];
  /** Процент трафика для shadow mode (0-100, по умолчанию 0) */
  readonly shadowTrafficPercentage?: number;
  /** Процент трафика для active mode (0-100, по умолчанию 0) */
  readonly activeTrafficPercentage?: number;
  /** Tenant IDs для принудительного включения (опционально) */
  readonly enabledTenants?: readonly string[];
  /** User bucket IDs для принудительного включения (опционально) */
  readonly enabledBuckets?: readonly string[];
  /** Версия для forced mode (по умолчанию 'v1') */
  readonly defaultVersion?: PipelineVersion;
  /** Версия для shadow mode (по умолчанию 'v2') */
  readonly shadowVersion?: PipelineVersion;
  /** Версия для active mode (по умолчанию 'v2') */
  readonly activeVersion?: PipelineVersion;
}>;

/**
 * Функция для разрешения feature flag на основе контекста
 * @template TContext - Тип контекста для разрешения feature flags
 * @note Должна быть детерминированной: одинаковый вход → одинаковый выход
 * @public
 */
export type FeatureFlagResolver<TContext extends Readonly<Record<string, unknown>>> = (
  context: TContext,
) => PipelineMode;

/**
 * Результат разрешения feature flag
 * @public
 */
export type FeatureFlagResult = Readonly<{
  /** Режим выполнения pipeline */
  readonly mode: PipelineMode;
  /** Источник разрешения (для observability) */
  readonly source: FeatureFlagSource;
  /** Timestamp разрешения (для observability) */
  readonly timestamp: number;
}>;

/* ============================================================================
 * 2. CONSTANTS — DEFAULT VALUES
 * ============================================================================
 */

/** Дефолтная конфигурация rollout (все на v1, forced mode) */
export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig<Readonly<Record<string, unknown>>> = {
  shadowTrafficPercentage: 0,
  activeTrafficPercentage: 0,
  defaultVersion: 'v1',
  shadowVersion: 'v2',
  activeVersion: 'v2',
} as const;

/** Максимальный процент трафика (100) */
const MAX_TRAFFIC_PERCENTAGE = 100;

/** Минимальный процент трафика (0) */
const MIN_TRAFFIC_PERCENTAGE = 0;

/** Количество buckets для детерминированного распределения */
const BUCKET_COUNT = 100;

/* ============================================================================
 * 3. HELPERS — PURE FUNCTIONS (Deterministic Hash & Version Resolution)
 * ============================================================================
 */

/**
 * Детерминированный hash для bucket assignment
 * @note Pure function: одинаковый вход → одинаковый выход
 * @note Явное преобразование в 32-bit integer через | 0 для избежания побочных эффектов JS
 * @internal
 */
function deterministicHash(str: string): number {
  const SHIFT_BITS = 5;
  const hash = Array.from(str).reduce((acc, _, index) => {
    const char = str.charCodeAt(index);
    const newHash = ((acc << SHIFT_BITS) - acc) + char;
    return (newHash | 0); // Convert to 32bit integer (explicit)
  }, 0);
  return Math.abs(hash);
}

/**
 * Вычисляет bucket ID на основе строки (детерминированно)
 * @note Pure function: одинаковый вход → одинаковый bucket ID (0-99)
 * @internal
 */
function computeBucketId(value: string): number {
  const hash = deterministicHash(value);
  return hash % BUCKET_COUNT;
}

/**
 * Определяет режим на основе процента трафика и bucket value
 * @note Pure function: детерминированное разрешение режима
 * @internal
 */
function determineModeFromTrafficPercentage(
  shadowPercentage: number,
  activePercentage: number,
  bucketValue: number,
  defaultVersion: PipelineVersion,
  shadowVersion: PipelineVersion,
  activeVersion: PipelineVersion,
): PipelineMode {
  if (bucketValue < shadowPercentage) {
    return { kind: 'shadow', version: shadowVersion };
  }
  if (bucketValue < shadowPercentage + activePercentage) {
    return { kind: 'active', version: activeVersion };
  }
  return { kind: 'forced', version: defaultVersion };
}

/**
 * Валидирует и нормализует процент трафика (0-100)
 * @internal
 */
function normalizeTrafficPercentage(percentage: number | undefined): number {
  if (percentage === undefined) {
    return 0;
  }
  return Math.min(Math.max(percentage, MIN_TRAFFIC_PERCENTAGE), MAX_TRAFFIC_PERCENTAGE);
}

/**
 * Извлекает значение из контекста по ключу (type-safe)
 * @internal
 */
function getContextValue<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
  key: string,
): string | undefined {
  const value = context[key];
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return undefined;
}

/**
 * Валидирует формат ID (UUID или alphanumeric)
 * @note Защита от случайных некорректных значений
 * @internal
 */
function isValidId(value: string): boolean {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Alphanumeric ID (минимум 1 символ)
  const alphanumericPattern = /^[a-z0-9_-]+$/i;
  return uuidPattern.test(value) || (alphanumericPattern.test(value) && value.length >= 1);
}

/**
 * Извлекает и валидирует userId из контекста
 * @internal
 */
function getUserId<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
): string | undefined {
  const userId = getContextValue(context, 'userId');
  if (userId !== undefined && isValidId(userId)) {
    return userId;
  }
  return undefined;
}

/**
 * Извлекает и валидирует tenantId из контекста
 * @internal
 */
function getTenantId<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
): string | undefined {
  const tenantId = getContextValue(context, 'tenantId');
  if (tenantId !== undefined && isValidId(tenantId)) {
    return tenantId;
  }
  return undefined;
}

/**
 * Извлекает ip из контекста
 * @internal
 */
function getIp<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
): string | undefined {
  return getContextValue(context, 'ip');
}

/* ============================================================================
 * 4. RESOLVERS — FACTORY FUNCTIONS (Extensible Strategy Pattern)
 * ============================================================================
 */

/**
 * Создает resolver на основе user bucket
 * @note Deterministic: одинаковый userId → одинаковый bucket → одинаковый результат
 * @template TContext - Тип контекста (должен содержать userId или аналогичное поле)
 * @public
 */
export function createUserBucketResolver<TContext extends Readonly<Record<string, unknown>>>(
  config: RolloutConfig<TContext>,
): FeatureFlagResolver<TContext> {
  const shadowPercentage = normalizeTrafficPercentage(config.shadowTrafficPercentage);
  const activePercentage = normalizeTrafficPercentage(config.activeTrafficPercentage);
  const defaultVersion = config.defaultVersion ?? 'v1';
  const shadowVersion = config.shadowVersion ?? 'v2';
  const activeVersion = config.activeVersion ?? 'v2';
  const enabledBuckets = config.enabledBuckets ?? [];

  return (context: TContext): PipelineMode => {
    // Извлекаем и валидируем userId из контекста
    const userId = getUserId(context);
    if (userId === undefined) {
      return { kind: 'forced', version: defaultVersion };
    }

    // Вычисляем bucket детерминированно
    const bucketId = computeBucketId(userId);
    const bucketIdStr = bucketId.toString();

    // Проверяем, включен ли bucket
    if (enabledBuckets.length > 0 && !enabledBuckets.includes(bucketIdStr)) {
      return { kind: 'forced', version: defaultVersion };
    }

    // Определяем режим на основе процента трафика
    const totalPercentage = shadowPercentage + activePercentage;
    if (totalPercentage <= 0) {
      return { kind: 'forced', version: defaultVersion };
    }

    return determineModeFromTrafficPercentage(
      shadowPercentage,
      activePercentage,
      bucketId,
      defaultVersion,
      shadowVersion,
      activeVersion,
    );
  };
}

/**
 * Создает resolver на основе tenant
 * @note Deterministic: одинаковый tenantId → одинаковый результат
 * @template TContext - Тип контекста (должен содержать tenantId или аналогичное поле)
 * @public
 */
export function createTenantResolver<TContext extends Readonly<Record<string, unknown>>>(
  config: RolloutConfig<TContext>,
): FeatureFlagResolver<TContext> {
  const shadowPercentage = normalizeTrafficPercentage(config.shadowTrafficPercentage);
  const activePercentage = normalizeTrafficPercentage(config.activeTrafficPercentage);
  const defaultVersion = config.defaultVersion ?? 'v1';
  const shadowVersion = config.shadowVersion ?? 'v2';
  const activeVersion = config.activeVersion ?? 'v2';
  const enabledTenants = config.enabledTenants ?? [];

  return (context: TContext): PipelineMode => {
    // Извлекаем и валидируем tenantId из контекста
    const tenantId = getTenantId(context);
    if (tenantId === undefined) {
      return { kind: 'forced', version: defaultVersion };
    }

    // Проверяем, включен ли tenant
    if (enabledTenants.length > 0 && !enabledTenants.includes(tenantId)) {
      return { kind: 'forced', version: defaultVersion };
    }

    // Определяем режим на основе процента трафика (детерминированно через userId, если есть)
    const totalPercentage = shadowPercentage + activePercentage;
    if (totalPercentage <= 0) {
      return { kind: 'forced', version: defaultVersion };
    }

    // Используем userId для детерминированного распределения внутри tenant
    const userId = getUserId(context);
    const bucketValue = userId !== undefined
      ? computeBucketId(userId)
      : computeBucketId(tenantId);

    return determineModeFromTrafficPercentage(
      shadowPercentage,
      activePercentage,
      bucketValue,
      defaultVersion,
      shadowVersion,
      activeVersion,
    );
  };
}

/**
 * Создает resolver на основе процента трафика
 * @note Deterministic: одинаковый userId/ip → одинаковый результат
 * @template TContext - Тип контекста (должен содержать userId или ip для детерминированности)
 * @public
 */
export function createTrafficPercentageResolver<TContext extends Readonly<Record<string, unknown>>>(
  config: RolloutConfig<TContext>,
): FeatureFlagResolver<TContext> {
  const shadowPercentage = normalizeTrafficPercentage(config.shadowTrafficPercentage);
  const activePercentage = normalizeTrafficPercentage(config.activeTrafficPercentage);
  const defaultVersion = config.defaultVersion ?? 'v1';
  const shadowVersion = config.shadowVersion ?? 'v2';
  const activeVersion = config.activeVersion ?? 'v2';

  return (context: TContext): PipelineMode => {
    const totalPercentage = shadowPercentage + activePercentage;
    if (totalPercentage <= 0) {
      return { kind: 'forced', version: defaultVersion };
    }

    // Детерминированно определяем bucket на основе userId (приоритет) или ip
    const userId = getUserId(context);
    const ip = getIp(context);
    const bucketValue = userId !== undefined
      ? computeBucketId(userId)
      : ip !== undefined
      ? computeBucketId(ip)
      : computeBucketId(JSON.stringify(context)); // Fallback: hash всего контекста

    return determineModeFromTrafficPercentage(
      shadowPercentage,
      activePercentage,
      bucketValue,
      defaultVersion,
      shadowVersion,
      activeVersion,
    );
  };
}

/**
 * Создает комбинированный resolver с приоритетами (tenant → user bucket → traffic percentage)
 * @note Deterministic: каскадное разрешение с приоритетами
 * @note Поддерживает кастомные приоритеты через config.resolverPriorities
 * @template TContext - Тип контекста
 * @public
 */
export function createCombinedResolver<TContext extends Readonly<Record<string, unknown>>>(
  config: RolloutConfig<TContext>,
): FeatureFlagResolver<TContext> {
  const defaultVersion = config.defaultVersion ?? 'v1';

  // Если указан resolverPipeline, используем его
  if (config.resolverPipeline !== undefined && config.resolverPipeline.length > 0) {
    return (context: TContext): PipelineMode => {
      const pipeline = config.resolverPipeline;
      if (pipeline === undefined) {
        return { kind: 'forced', version: defaultVersion };
      }
      const resolvedMode = pipeline.find((resolver) => {
        const mode = resolver(context);
        return mode.kind !== 'forced' || mode.version !== defaultVersion;
      });
      return resolvedMode !== undefined
        ? resolvedMode(context)
        : { kind: 'forced', version: defaultVersion };
    };
  }

  // Используем приоритеты из config или дефолтные
  const priorities = config.resolverPriorities ?? ['tenant', 'user_bucket', 'traffic_percentage'];
  const resolvers: Readonly<Partial<Record<ResolverPriority, FeatureFlagResolver<TContext>>>> = {
    ...(priorities.includes('tenant') && { tenant: createTenantResolver(config) }),
    ...(priorities.includes('user_bucket') && { user_bucket: createUserBucketResolver(config) }),
    ...(priorities.includes('traffic_percentage')
      && { traffic_percentage: createTrafficPercentageResolver(config) }),
  };

  return (context: TContext): PipelineMode => {
    // Каскадное разрешение по приоритетам
    const resolvedMode = priorities
      .map((priority) => resolvers[priority])
      .find((resolver) => {
        if (resolver === undefined) {
          return false;
        }
        const mode = resolver(context);
        return mode.kind !== 'forced' || mode.version !== defaultVersion;
      });
    return resolvedMode !== undefined
      ? resolvedMode(context)
      : { kind: 'forced', version: defaultVersion };
  };
}

/* ============================================================================
 * 5. API — PUBLIC FUNCTIONS (Feature Flag Resolution)
 * ============================================================================
 */

/**
 * Разрешает режим выполнения pipeline на основе feature flag
 * @template TContext - Тип контекста для разрешения feature flags
 * @note Pure function: детерминированное разрешение без side-effects
 * @public
 */
export function resolvePipelineMode<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
  config: RolloutConfig<TContext>,
): PipelineMode {
  const resolver = config.customResolver ?? createCombinedResolver(config);
  return resolver(context);
}

/**
 * Определяет источник разрешения feature flag (для observability)
 * @template TContext - Тип контекста для разрешения feature flags
 * @note Pure function: детерминированное определение источника
 * @internal
 */
function determineFeatureFlagSource<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
  config: RolloutConfig<TContext>,
): FeatureFlagSource {
  if (config.customResolver !== undefined) {
    return { kind: 'custom', resolver: 'customResolver' };
  }
  if (config.resolverPipeline !== undefined && config.resolverPipeline.length > 0) {
    return { kind: 'custom', resolver: 'resolverPipeline' };
  }
  const tenantId = getTenantId(context);
  const userId = getUserId(context);
  if (tenantId !== undefined) {
    return { kind: 'tenant', tenantId };
  }
  if (userId !== undefined) {
    const bucketId = computeBucketId(userId);
    return { kind: 'user_bucket', bucketId: bucketId.toString() };
  }
  const shadowPercentage = normalizeTrafficPercentage(config.shadowTrafficPercentage);
  const activePercentage = normalizeTrafficPercentage(config.activeTrafficPercentage);
  return { kind: 'traffic_percentage', percentage: shadowPercentage + activePercentage };
}

/**
 * Разрешает feature flag и возвращает полный результат с метаданными
 * @template TContext - Тип контекста для разрешения feature flags
 * @note Pure function: детерминированное разрешение с observability metadata
 * @param now - Timestamp для deterministic testing (опционально, по умолчанию Date.now())
 * @public
 */
export function resolveFeatureFlag<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
  config: RolloutConfig<TContext>,
  now: number = Date.now(),
): FeatureFlagResult {
  const mode = resolvePipelineMode(context, config);
  const source = determineFeatureFlagSource(context, config);

  return {
    mode,
    source,
    timestamp: now,
  };
}

/**
 * Проверяет, включен ли shadow mode для контекста
 * @template TContext - Тип контекста для разрешения feature flags
 * @note Pure function: детерминированная проверка
 * @public
 */
export function isShadowMode<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
  config: RolloutConfig<TContext>,
): boolean {
  const mode = resolvePipelineMode(context, config);
  return mode.kind === 'shadow';
}

/**
 * Проверяет, включен ли active mode для контекста
 * @template TContext - Тип контекста для разрешения feature flags
 * @note Pure function: детерминированная проверка
 * @public
 */
export function isActiveMode<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
  config: RolloutConfig<TContext>,
): boolean {
  const mode = resolvePipelineMode(context, config);
  return mode.kind === 'active';
}

/**
 * Получает версию pipeline для контекста
 * @template TContext - Тип контекста для разрешения feature flags
 * @note Pure function: детерминированное получение версии
 * @public
 */
export function getPipelineVersion<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext,
  config: RolloutConfig<TContext>,
): PipelineVersion {
  const mode = resolvePipelineMode(context, config);
  return mode.version;
}
