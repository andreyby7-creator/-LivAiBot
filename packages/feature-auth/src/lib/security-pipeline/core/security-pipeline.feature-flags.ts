/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.feature-flags.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Feature Flags)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Feature flag management для безопасного rollout v2 pipeline
 * - Причина изменения: rollout strategy changes
 *
 * Принципы:
 * - ✅ Gradual rollout — постепенный rollout через проценты трафика
 * - ✅ Multi-source — поддержка разных источников (user bucket, tenant, процент)
 * - ✅ Safety-first — безопасный rollout с возможностью отката
 * - ✅ Deterministic — одинаковый вход → одинаковый результат
 */

import type { SecurityPipelineContext } from '../security-pipeline.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Версия risk engine для rollout
 */
export type RiskEngineVersion = 'forced_v1' | 'shadow_v2' | 'active_v2';

/**
 * Источник feature flag
 */
export type FeatureFlagSource = 'user_bucket' | 'tenant' | 'traffic_percentage';

/**
 * Конфигурация feature flag для rollout
 */
export type FeatureFlagConfig = {
  /** Версия engine (forced_v1, shadow_v2, active_v2) */
  readonly version: RiskEngineVersion;
  /** Источник feature flag */
  readonly source: FeatureFlagSource;
  /** Значение для источника (bucket ID, tenant ID, или процент трафика 0-100) */
  readonly value: string | number;
};

/**
 * Функция для получения feature flag
 * @note Должна быть детерминированной: одинаковый вход → одинаковый выход
 */
export type FeatureFlagResolver = (
  context: SecurityPipelineContext,
) => RiskEngineVersion;

/**
 * Конфигурация rollout для risk engine
 */
export type RolloutConfig = {
  /** Feature flag resolver (опционально, по умолчанию forced_v1) */
  readonly featureFlagResolver?: FeatureFlagResolver;
  /** Процент трафика для shadow_v2 (0-100, по умолчанию 0) */
  readonly shadowV2TrafficPercentage?: number;
  /** Процент трафика для active_v2 (0-100, по умолчанию 0) */
  readonly activeV2TrafficPercentage?: number;
  /** Tenant IDs для принудительного включения v2 (опционально) */
  readonly v2EnabledTenants?: readonly string[];
  /** User bucket IDs для принудительного включения v2 (опционально) */
  readonly v2EnabledBuckets?: readonly string[];
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтная конфигурация rollout (все на v1) */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Constant for default rollout config
export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  shadowV2TrafficPercentage: 0,
  activeV2TrafficPercentage: 0,
};

/* ============================================================================
 * 🎯 HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Определяет версию на основе процента трафика для tenant/bucket
 */
function determineVersionFromTrafficPercentage(
  shadowPercentage: number,
  activePercentage: number,
  bucketValue: number,
): RiskEngineVersion {
  if (bucketValue < shadowPercentage) {
    return 'shadow_v2';
  }
  if (bucketValue < shadowPercentage + activePercentage) {
    return 'active_v2';
  }
  return 'forced_v1';
}

/* ============================================================================
 * 🎯 FEATURE FLAG RESOLVERS
 * ============================================================================
 */

/**
 * Создает resolver на основе user bucket
 * @note Deterministic: одинаковый userId → одинаковый bucket → одинаковый результат
 */
export function createUserBucketResolver(
  config: RolloutConfig,
): FeatureFlagResolver {
  return (context: SecurityPipelineContext): RiskEngineVersion => {
    // Если userId не указан, используем v1
    if (context.userId === undefined || context.userId === '') {
      return 'forced_v1';
    }

    // Вычисляем bucket на основе userId (детерминированно)
    // Используем простой hash для детерминированности
    const bucketHash = simpleHash(context.userId);
    const bucketId = (bucketHash % 100).toString();

    // Проверяем, включен ли bucket для v2
    const isBucketEnabled = config.v2EnabledBuckets?.includes(bucketId) ?? false;
    if (!isBucketEnabled) {
      return 'forced_v1';
    }

    // Определяем, shadow или active на основе процента трафика
    const shadowPercentage = config.shadowV2TrafficPercentage ?? 0;
    const activePercentage = config.activeV2TrafficPercentage ?? 0;
    const totalV2Percentage = shadowPercentage + activePercentage;

    if (totalV2Percentage <= 0) {
      return 'forced_v1';
    }

    // Детерминированно определяем shadow vs active на основе bucket
    const bucketValue = bucketHash % 100;
    return determineVersionFromTrafficPercentage(shadowPercentage, activePercentage, bucketValue);
  };
}

/**
 * Определяет версию для tenant на основе процента трафика
 */
function determineTenantVersion(
  config: RolloutConfig,
  context: SecurityPipelineContext,
): RiskEngineVersion {
  const shadowPercentage = config.shadowV2TrafficPercentage ?? 0;
  const activePercentage = config.activeV2TrafficPercentage ?? 0;
  const totalV2Percentage = shadowPercentage + activePercentage;

  if (totalV2Percentage <= 0) {
    return 'forced_v1';
  }

  // Детерминированно определяем shadow vs active на основе userId (если есть)
  if (context.userId !== undefined && context.userId !== '') {
    const bucketHash = simpleHash(context.userId);
    const bucketValue = bucketHash % 100;
    return determineVersionFromTrafficPercentage(shadowPercentage, activePercentage, bucketValue);
  }

  // Если userId нет, используем shadow по умолчанию для tenant
  return shadowPercentage > 0 ? 'shadow_v2' : 'forced_v1';
}

/**
 * Создает resolver на основе tenant
 */
export function createTenantResolver(
  config: RolloutConfig,
): FeatureFlagResolver {
  return (context: SecurityPipelineContext): RiskEngineVersion => {
    // Если tenant не указан, используем v1
    // tenantId может быть в signals или как отдельное поле
    const tenantId = (context as { readonly tenantId?: string; }).tenantId;
    if (tenantId === undefined || tenantId === '') {
      return 'forced_v1';
    }

    // Проверяем, включен ли tenant для v2
    const isTenantEnabled = config.v2EnabledTenants?.includes(tenantId) ?? false;
    if (!isTenantEnabled) {
      return 'forced_v1';
    }

    return determineTenantVersion(config, context);
  };
}

/**
 * Создает resolver на основе процента трафика
 * @note Deterministic: одинаковый userId → одинаковый процент → одинаковый результат
 */
export function createTrafficPercentageResolver(
  config: RolloutConfig,
): FeatureFlagResolver {
  return (context: SecurityPipelineContext): RiskEngineVersion => {
    const shadowPercentage = config.shadowV2TrafficPercentage ?? 0;
    const activePercentage = config.activeV2TrafficPercentage ?? 0;
    const totalV2Percentage = shadowPercentage + activePercentage;

    if (totalV2Percentage <= 0) {
      return 'forced_v1';
    }

    // Детерминированно определяем версию на основе userId (если есть)
    if (context.userId !== undefined && context.userId !== '') {
      const bucketHash = simpleHash(context.userId);
      const bucketValue = bucketHash % 100;
      return determineVersionFromTrafficPercentage(shadowPercentage, activePercentage, bucketValue);
    }

    // Если userId нет, используем IP для детерминированности
    const ipHash = context.ip !== undefined && context.ip !== ''
      ? simpleHash(context.ip)
      : Math.random() * 100;
    const bucketValue = ipHash % 100;
    return determineVersionFromTrafficPercentage(shadowPercentage, activePercentage, bucketValue);
  };
}

/**
 * Создает комбинированный resolver (tenant → user bucket → traffic percentage)
 */
export function createCombinedResolver(
  config: RolloutConfig,
): FeatureFlagResolver {
  const tenantResolver = createTenantResolver(config);
  const bucketResolver = createUserBucketResolver(config);
  const trafficResolver = createTrafficPercentageResolver(config);

  return (context: SecurityPipelineContext): RiskEngineVersion => {
    // 1. Проверяем tenant (приоритет 1)
    const tenantVersion = tenantResolver(context);
    if (tenantVersion !== 'forced_v1') {
      return tenantVersion;
    }

    // 2. Проверяем user bucket (приоритет 2)
    const bucketVersion = bucketResolver(context);
    if (bucketVersion !== 'forced_v1') {
      return bucketVersion;
    }

    // 3. Проверяем traffic percentage (приоритет 3)
    return trafficResolver(context);
  };
}

/**
 * Простой hash для детерминированного bucket assignment
 * @note Должен быть детерминированным: одинаковый вход → одинаковый выход
 */
function simpleHash(str: string): number {
  let hash = 0;
  const SHIFT_BITS = 5; // Константа для bit shift
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << SHIFT_BITS) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/* ============================================================================
 * 🎯 HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Определяет версию pipeline на основе feature flag
 */
export function resolvePipelineVersion(
  context: SecurityPipelineContext,
  config: RolloutConfig,
): number {
  const resolver = config.featureFlagResolver ?? createCombinedResolver(config);
  const version = resolver(context);

  switch (version) {
    case 'forced_v1':
      return 1;
    case 'shadow_v2':
    case 'active_v2':
      return 2;
    default:
      return 1;
  }
}

/**
 * Определяет, включен ли shadow mode на основе feature flag
 */
export function shouldUseShadowMode(
  context: SecurityPipelineContext,
  config: RolloutConfig,
): boolean {
  const resolver = config.featureFlagResolver ?? createCombinedResolver(config);
  const version = resolver(context);
  return version === 'shadow_v2';
}
