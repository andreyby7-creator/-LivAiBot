/**
 * @file index.ts - Экспорт AI service ошибок LivAiBot
 *
 * Единая точка входа для всех AI service типов ошибок.
 * Предоставляет selective exports для поддержания чистого API.
 */

// ==================== CORE AI SERVICE TYPES ====================

export type {
  AIServiceError,
  AIServiceErrorCategory,
  AIServiceErrorCode,
  AIServiceErrorCodeString,
  AIServiceErrorInput,
  AIServiceErrorKind,
  AIServiceErrorMatcher,
  AIServiceOrSharedError,
  APIRateLimitError,
  ContextOverflowError,
  InferenceError,
  ModelLoadError,
  PromptValidationError,
  TokenLimitError,
} from './AIServiceErrorTypes.js';

// ==================== TYPE GUARDS ====================

export {
  isAIServiceError,
  isAIServiceOrSharedError,
  isAPIRateLimitError,
  isContextOverflowError,
  isInferenceError,
  isModelLoadError,
  isPromptValidationError,
  isTokenLimitError,
} from './AIServiceErrorTypes.js';

// ==================== PATTERN MATCHING ====================

export { matchAIServiceError, safeMatchAIServiceError } from './AIServiceErrorTypes.js';

// ==================== ERROR CREATION ====================

export { makeAIServiceError } from './AIServiceErrorTypes.js';

// ==================== ERROR REGISTRY ====================

export {
  AI_SERVICE_ERROR_CODE_LIST,
  AI_SERVICE_ERROR_CODES,
  AI_SERVICE_ERROR_COUNT,
  getAIServiceErrorMeta,
  getAllAIServiceErrorMeta,
  getAllOperationTypes,
  getErrorsByOperationType,
  getRetryStrategyForError,
  getStreamingCapableErrors,
  getTokenCostForError,
  groupErrorsByModelType,
  requiresGpuForError,
} from './AIServiceErrorRegistry.js';

export type { AIMetadata, AIServiceErrorMetadata } from './AIServiceErrorRegistry.js';

// ==================== UTILITIES ====================

export {
  getAIServiceErrorKind,
  groupAIServiceErrorsByKind,
  isAIServiceErrorKind,
} from './AIServiceErrorTypes.js';

// ==================== VALIDATION ====================

export {
  validateAIServiceError,
  validateAIServiceErrorCategory,
  validateAIServiceErrorCode,
  validateAIServiceErrorKind,
} from './AIServiceErrorTypes.js';

// ==================== DOMAIN ERRORS ====================

export type {
  ContextLimitRule,
  ContextOverflowErrorContext,
  ModelSelectionError,
  ModelSelectionErrorContext,
  PromptValidationErrorContext,
} from './domain/index.js';

export {
  createPromptForbiddenContentError,
  createPromptFormatError,
  createPromptTooLongError,
  createPromptValidationError,
  isPromptForbiddenContentError,
  isPromptFormatError,
  isPromptLengthError,
  isValidPromptValidationErrorContext,
} from './domain/index.js';

export {
  createModelNotFoundError,
  createModelSelectionError,
  createModelTaskMismatchError,
  createModelUnavailableInRegionError,
  createTechnicalConstraintError,
  createUserTierLimitError,
  isModelNotFoundError,
  isRegionUnavailableError,
  isTaskIncompatibleError,
  isTechnicalConstraintError,
  isTierLimitError,
  isValidModelSelectionErrorContext,
} from './domain/index.js';

export {
  createContextOverflowError,
  createConversationHistoryOverflowError,
  createDocumentOverflowError,
  createStreamingContextOverflowError,
  createSystemPromptOverflowError,
  createTokenLimitExceededError,
  getOverflowPercentage,
  getRecommendedTruncationStrategy,
  isConversationHistoryError,
  isCriticalOverflow,
  isDocumentOverflowError,
  isStreamingOverflowError,
  isSystemPromptError,
  isValidContextOverflowErrorContext,
} from './domain/index.js';

// ==================== INFRASTRUCTURE ERRORS ====================

export type {
  InfrastructureFailureKind,
  InfrastructurePolicyHint,
  ModelFallbackPriority,
  ModelRecoveryStrategy,
  ModelUnavailableError,
  ModelUnavailableErrorContext,
  ModelUnavailableReason,
  RateLimitError,
  RateLimitErrorContext,
  RateLimitKind,
  RateLimitRecoveryStrategy,
  RateLimitUnit,
  YandexAIConnectionError,
  YandexAIConnectionErrorContext,
} from './infrastructure/index.js';

export {
  AI_VENDOR,
  createBurstLimitError,
  createModelDeprecatedError,
  createModelGpuConstraintError,
  createModelMaintenanceError,
  createModelMemoryConstraintError,
  createModelNotFoundInfraError,
  createModelRegionRestrictedError,
  createModelTemporarilyUnavailableError,
  createModelUnavailableError,
  createPerDayLimitError,
  createPerHourLimitError,
  createPerMinuteLimitError,
  createQuotaExhaustionError,
  createRateLimitError,
  createYandexAIConnectionError,
  createYandexAINetworkError,
  createYandexAIServiceUnavailableError,
  createYandexAITimeoutError,
  createYandexAIUnknownInfrastructureError,
  getAvailableModelAlternatives,
  getAvailableRegions,
  getModelRecoveryStrategy,
  getModelRetryDelay,
  getRateLimitRecoveryStrategy,
  getRateLimitUsagePercentage,
  getRecommendedFallbackModel,
  getRecommendedRetryDelay,
  getTimeUntilReset,
  getYandexAIRecoveryStrategy,
  hasHighPriorityFallback,
  hasRegionalAlternatives,
  isHardLimit,
  isModelRetryable,
  isRateLimitCritical,
  isRateLimitRetriable,
  isYandexAIRetriableError,
  shouldTriggerCircuitBreaker,
} from './infrastructure/index.js';

// ==================== VALIDATORS ====================

export type {
  AggregatedNormalizedErrors,
  AIModelFamily,
  AITaskType,
  AIValidationConfig,
  AIValidationContext,
  AIValidationResult,
  APIResponseType,
  APIResponseValidationContext,
  APIResponseValidationResult,
  APIValidationConfig,
  ModelValidationConfig,
  ModelValidationContext,
  ModelValidationResult,
  TaskModelCompatibility,
  TokenValidationConfig,
  TokenValidationContext,
  TokenValidationResult,
} from './AIServiceValidators.js';

export {
  calculateOptimalChunkSize,
  validateAIModel,
  validateAIOperation,
  validateAPIResponse,
  validateModelTaskCompatibility,
  validateTokenLimits,
} from './AIServiceValidators.js';

// ==================== SERIALIZATION ====================

export {
  createAIResponseSerializer,
  serializeAIResponseGrpc,
  serializeAIResponseHttp,
  serializeGrpcToJsonString,
  serializeGrpcWithMetadataToJsonString,
  serializeHttpToJsonString,
  serializeHttpWithMetadataToJsonString,
} from './serialization/index.js';

export type {
  AIErrorDetails,
  AIResponse,
  AIResponseError,
  AIResponseSerializationOutcome,
  AIResponseSerializerConfig,
  AIResponseSerializerRequestConfig,
  AIResponseSuccess,
  AIUsage,
  BaseErrorPlainObject,
  GrpcAISerializationResult,
  GrpcDetailsFormatter,
  HttpAISerializationResult,
} from './serialization/index.js';

export { GRPC_STATUS, HTTP_STATUS } from './serialization/index.js';

// ==================== INSTRUMENTATION ====================

export {
  aiServiceInstrumentationLayer,
  aiServiceTracerContext,
  instrumentAIInference,
} from './AIServiceInstrumentation.js';

export { AIProvider } from './AIServiceInstrumentation.js';

export type {
  AIInferenceResult,
  AIInstrumentationContext,
  AIMetricAttributes,
} from './AIServiceInstrumentation.js';
