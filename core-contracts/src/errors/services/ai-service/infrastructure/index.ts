/**
 * @file index.ts - Экспорт инфраструктурных ошибок AI service
 *
 * Специализированные инфраструктурные ошибки для AI операций.
 * Включает ошибки подключения к Yandex AI API.
 */

export type {
  InfrastructureFailureKind,
  InfrastructurePolicyHint,
  YandexAIConnectionError,
  YandexAIConnectionErrorContext,
} from './YandexAIConnectionError.js';

export type {
  RateLimitError,
  RateLimitErrorContext,
  RateLimitKind,
  RateLimitRecoveryStrategy,
  RateLimitUnit,
} from './RateLimitError.js';

export {
  AI_VENDOR,
  createYandexAIConnectionError,
  createYandexAINetworkError,
  createYandexAIServiceUnavailableError,
  createYandexAITimeoutError,
  createYandexAIUnknownInfrastructureError,
  getYandexAIRecoveryStrategy,
  isYandexAIRetriableError,
  shouldTriggerCircuitBreaker,
} from './YandexAIConnectionError.js';

export {
  createBurstLimitError,
  createPerDayLimitError,
  createPerHourLimitError,
  createPerMinuteLimitError,
  createQuotaExhaustionError,
  createRateLimitError,
  getRateLimitRecoveryStrategy,
  getRateLimitUsagePercentage,
  getRecommendedRetryDelay,
  getTimeUntilReset,
  isHardLimit,
  isRateLimitCritical,
  isRateLimitRetriable,
} from './RateLimitError.js';

export type {
  ModelFallbackPriority,
  ModelRecoveryStrategy,
  ModelUnavailableError,
  ModelUnavailableErrorContext,
  ModelUnavailableReason,
} from './ModelUnavailableError.js';

export {
  createModelDeprecatedError,
  createModelGpuConstraintError,
  createModelMaintenanceError,
  createModelMemoryConstraintError,
  createModelNotFoundInfraError,
  createModelRegionRestrictedError,
  createModelTemporarilyUnavailableError,
  createModelUnavailableError,
  getAvailableModelAlternatives,
  getAvailableRegions,
  getModelRecoveryStrategy,
  getModelRetryDelay,
  getRecommendedFallbackModel,
  hasHighPriorityFallback,
  hasRegionalAlternatives,
  isModelRetryable,
} from './ModelUnavailableError.js';
