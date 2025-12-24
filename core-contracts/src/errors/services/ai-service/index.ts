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
