/**
 * @file index.ts - Экспорт доменных ошибок AI service
 *
 * Специализированные доменные ошибки для AI операций.
 * Включает валидацию промптов, выбор моделей и управление контекстом.
 */

// ==================== DOMAIN ERRORS ====================

export type {
  PromptValidationError,
  PromptValidationErrorContext,
} from './PromptValidationError.js';

export type { ModelSelectionError, ModelSelectionErrorContext } from './ModelSelectionError.js';

export type {
  ContextLimitRule,
  ContextOverflowError,
  ContextOverflowErrorContext,
} from './ContextOverflowError.js';

export {
  createPromptForbiddenContentError,
  createPromptFormatError,
  createPromptTooLongError,
  createPromptValidationError,
  isPromptForbiddenContentError,
  isPromptFormatError,
  isPromptLengthError,
  isValidPromptValidationErrorContext,
} from './PromptValidationError.js';

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
} from './ModelSelectionError.js';

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
  isTokenLimitError,
  isValidContextOverflowErrorContext,
} from './ContextOverflowError.js';
