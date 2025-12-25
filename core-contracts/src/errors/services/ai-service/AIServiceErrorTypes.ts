/**
 * @file AIServiceErrorTypes.ts - Специализированные типы ошибок для AI сервиса LivAiBot
 *
 * Содержит AI-specific типы ошибок с полным наследованием от базовых примитивов Base Layer.
 * Расширяет SharedErrorTypes для domain-специфичной функциональности.
 * Использует namespace SERVICE_AI_* для кодов ошибок и метаданных.
 *
 * Основные типы ошибок:
 * - ModelLoadError: проблемы загрузки моделей ИИ
 * - InferenceError: ошибки выполнения инференса
 * - TokenLimitError: превышение лимитов токенов
 * - APIRateLimitError: ограничения API Yandex Cloud
 *
 * Полностью type-safe с discriminated unions для pattern matching.
 */

import type { AIProvider } from './AIServiceInstrumentation.js';
import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { SharedError } from '../../shared/SharedErrorTypes.js';

// ==================== AI SERVICE ERROR NAMESPACE ====================

/** Тип для кодов AI service ошибок с обязательным namespace. Защищает AI сервис от попадания других типов ошибок. */
export type AIServiceErrorCodeString = `SERVICE_AI_${string}`;

/** Категории AI service ошибок - единая точка истины для type-safe категоризации. */
export type AIServiceErrorCategory =
  | 'model'
  | 'inference'
  | 'token'
  | 'api'
  | 'validation';

/** Виды AI service ошибок - type-level routing для observability/metrics/contracts/tracing. */
export type AIServiceErrorKind =
  | 'ModelLoadError'
  | 'InferenceError'
  | 'TokenLimitError'
  | 'APIRateLimitError'
  | 'PromptValidationError'
  | 'ContextOverflowError';

// ==================== AI SERVICE ERROR TYPES ====================

/** ModelLoadError — проблемы с загрузкой/инициализацией модели ИИ */
export type ModelLoadError = TaggedError<{
  readonly category: AIServiceErrorCategory;
  readonly code: AIServiceErrorCodeString;
  readonly message: string;
  readonly modelId: string;
  readonly modelVersion?: string;
  readonly provider: AIProvider;
  readonly loadAttempt: number;
  readonly details?: {
    readonly modelPath?: string;
    readonly memoryRequired?: number;
    readonly memoryAvailable?: number;
    readonly gpuRequired?: boolean;
    readonly gpuAvailable?: boolean;
  };
}, 'ModelLoadError'>;

/** InferenceError — ошибка выполнения инференса */
export type InferenceError = TaggedError<{
  readonly category: AIServiceErrorCategory;
  readonly code: AIServiceErrorCodeString;
  readonly message: string;
  readonly modelId: string;
  readonly operation: 'generation' | 'classification' | 'embedding' | 'translation';
  readonly inputTokens: number;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly details?: {
    readonly processingTime?: number;
    readonly gpuMemoryUsed?: number;
    readonly errorPhase?: 'preprocessing' | 'inference' | 'postprocessing';
    readonly modelResponse?: unknown;
  };
}, 'InferenceError'>;

/** TokenLimitError — превышение лимита токенов */
export type TokenLimitError = TaggedError<{
  readonly category: AIServiceErrorCategory;
  readonly code: AIServiceErrorCodeString;
  readonly message: string;
  readonly requestedTokens: number;
  readonly maxAllowedTokens: number;
  readonly tokenType: 'input' | 'output' | 'total';
  readonly modelId: string;
  readonly details?: {
    readonly currentUsage?: number;
    readonly monthlyLimit?: number;
    readonly resetDate?: string;
    readonly canUpgrade?: boolean;
  };
}, 'TokenLimitError'>;

/** APIRateLimitError — превышение rate limit API */
export type APIRateLimitError = TaggedError<{
  readonly category: AIServiceErrorCategory;
  readonly code: AIServiceErrorCodeString;
  readonly message: string;
  readonly limitType:
    | 'requests_per_minute'
    | 'requests_per_hour'
    | 'requests_per_day'
    | 'tokens_per_minute';
  readonly currentUsage: number;
  readonly limitValue: number;
  readonly resetTime: number; // Unix timestamp
  readonly provider: 'yandex_cloud';
  readonly details?: {
    readonly retryAfter?: number;
    readonly upgradeUrl?: string;
    readonly contactSupport?: boolean;
  };
}, 'APIRateLimitError'>;

/** PromptValidationError — некорректный формат/содержимое промпта */
export type PromptValidationError = TaggedError<{
  readonly category: AIServiceErrorCategory;
  readonly code: AIServiceErrorCodeString;
  readonly message: string;
  readonly validationRule: string;
  readonly promptLength: number;
  readonly maxAllowedLength?: number;
  readonly details?: {
    readonly invalidParts?: readonly string[];
    readonly suggestions?: readonly string[];
    readonly promptPreview?: string;
  };
}, 'PromptValidationError'>;

/** ContextOverflowError — превышен размер контекста модели */
export type ContextOverflowError = TaggedError<{
  readonly category: AIServiceErrorCategory;
  readonly code: AIServiceErrorCodeString;
  readonly message: string;
  readonly contextSize: number;
  readonly maxContextSize: number;
  readonly overflowAmount: number;
  readonly modelId: string;
  readonly details?: {
    readonly canTruncate?: boolean;
    readonly suggestedTruncation?: number;
    readonly contextPreview?: string;
  };
}, 'ContextOverflowError'>;

// ==================== DISCRIMINATED UNIONS ====================

/** Объединение всех типов AIServiceError */
export type AIServiceError =
  | ModelLoadError
  | InferenceError
  | TokenLimitError
  | APIRateLimitError
  | PromptValidationError
  | ContextOverflowError;

/** AIServiceError + SharedError объединение */
export type AIServiceOrSharedError = AIServiceError | SharedError;

// ==================== TYPE GUARDS ====================

/** Допустимые теги AIServiceError для быстрой проверки */
const AISERVICE_ERROR_TAGS = new Set<AIServiceErrorKind>([
  'ModelLoadError',
  'InferenceError',
  'TokenLimitError',
  'APIRateLimitError',
  'PromptValidationError',
  'ContextOverflowError',
]);

/** Генератор type guard функций для AIServiceError */
function createAIServiceErrorGuard<Tag extends AIServiceErrorKind>(
  tag: Tag,
): (error: unknown) => error is Extract<AIServiceError, { _tag: Tag; }> {
  return (error: unknown): error is Extract<AIServiceError, { _tag: Tag; }> => {
    return (
      typeof error === 'object'
      && error !== null
      && '_tag' in error
      && (error as Record<string, unknown>)['_tag'] === tag
      && 'code' in error
      && typeof (error as Record<string, unknown>)['code'] === 'string'
      && ((error as Record<string, unknown>)['code'] as string).startsWith('SERVICE_AI_')
    );
  };
}

/** Проверяет ModelLoadError */
export const isModelLoadError = createAIServiceErrorGuard('ModelLoadError');

/** Проверяет InferenceError */
export const isInferenceError = createAIServiceErrorGuard('InferenceError');

/** Проверяет TokenLimitError */
export const isTokenLimitError = createAIServiceErrorGuard('TokenLimitError');

/** Проверяет APIRateLimitError */
export const isAPIRateLimitError = createAIServiceErrorGuard('APIRateLimitError');

/** Проверяет PromptValidationError */
export const isPromptValidationError = createAIServiceErrorGuard('PromptValidationError');

/** Проверяет ContextOverflowError */
export const isContextOverflowError = createAIServiceErrorGuard('ContextOverflowError');

/** Проверяет любую AIServiceError */
export function isAIServiceError(error: unknown): error is AIServiceError {
  if (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && 'code' in error
    && typeof (error as Record<string, unknown>)['code'] === 'string'
    && ((error as Record<string, unknown>)['code'] as string).startsWith('SERVICE_AI_')
  ) {
    return AISERVICE_ERROR_TAGS.has(
      (error as Record<string, unknown>)['_tag'] as AIServiceErrorKind,
    );
  }
  return false;
}

/** Проверяет SharedError */
function isSharedError(error: unknown): error is SharedError {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && typeof (error as Record<string, unknown>)['_tag'] === 'string'
    && ((error as Record<string, unknown>)['_tag'] as string).startsWith('Shared')
  );
}

/** Проверяет AIServiceError или SharedError */
export function isAIServiceOrSharedError(error: unknown): error is AIServiceOrSharedError {
  return isAIServiceError(error) || isSharedError(error);
}

// ==================== ERROR CREATION ====================

/** Компактная фабрика AIServiceError с перегрузками для type safety */
export function makeAIServiceError(
  tag: 'ModelLoadError',
  code: AIServiceErrorCodeString,
  message: string,
  modelId: string,
  provider: 'yandex' | 'local' | 'external',
  loadAttempt: number,
  details?: ModelLoadError['details'],
): ModelLoadError;

export function makeAIServiceError(
  tag: 'InferenceError',
  code: AIServiceErrorCodeString,
  message: string,
  modelId: string,
  operation: 'generation' | 'classification' | 'embedding' | 'translation',
  inputTokens: number,
  details?: InferenceError['details'],
): InferenceError;

export function makeAIServiceError(
  tag: 'TokenLimitError',
  code: AIServiceErrorCodeString,
  message: string,
  requestedTokens: number,
  maxAllowedTokens: number,
  tokenType: 'input' | 'output' | 'total',
  modelId: string,
  details?: TokenLimitError['details'],
): TokenLimitError;

export function makeAIServiceError(
  tag: 'APIRateLimitError',
  code: AIServiceErrorCodeString,
  message: string,
  limitType: 'requests_per_minute' | 'requests_per_hour' | 'requests_per_day' | 'tokens_per_minute',
  currentUsage: number,
  limitValue: number,
  resetTime: number,
  details?: APIRateLimitError['details'],
): APIRateLimitError;

export function makeAIServiceError(
  tag: 'PromptValidationError',
  code: AIServiceErrorCodeString,
  message: string,
  validationRule: string,
  promptLength: number,
  details?: PromptValidationError['details'],
): PromptValidationError;

export function makeAIServiceError(
  tag: 'ContextOverflowError',
  code: AIServiceErrorCodeString,
  message: string,
  contextSize: number,
  maxContextSize: number,
  overflowAmount: number,
  modelId: string,
  details?: ContextOverflowError['details'],
): ContextOverflowError;

/** Реализация фабрики AIServiceError */
export function makeAIServiceError(
  tag: AIServiceErrorKind,
  code: AIServiceErrorCodeString,
  message: string,
  ...args: readonly unknown[]
): AIServiceError {
  const base = { _tag: tag, code, message } as const;

  switch (tag) {
    case 'ModelLoadError': {
      const [modelId, provider, loadAttempt, details] = args as [
        string,
        'yandex' | 'local' | 'external',
        number,
        ModelLoadError['details']?,
      ];
      return {
        ...base,
        category: 'model',
        modelId,
        provider,
        loadAttempt,
        details,
      } as ModelLoadError;
    }

    case 'InferenceError': {
      const [modelId, operation, inputTokens, details] = args as [
        string,
        'generation' | 'classification' | 'embedding' | 'translation',
        number,
        InferenceError['details']?,
      ];
      return {
        ...base,
        category: 'inference',
        modelId,
        operation,
        inputTokens,
        details,
      } as InferenceError;
    }

    case 'TokenLimitError': {
      const [requestedTokens, maxAllowedTokens, tokenType, modelId, details] = args as [
        number,
        number,
        'input' | 'output' | 'total',
        string,
        TokenLimitError['details']?,
      ];
      return {
        ...base,
        category: 'token',
        requestedTokens,
        maxAllowedTokens,
        tokenType,
        modelId,
        details,
      } as TokenLimitError;
    }

    case 'APIRateLimitError': {
      const [limitType, currentUsage, limitValue, resetTime, details] = args as [
        'requests_per_minute' | 'requests_per_hour' | 'requests_per_day' | 'tokens_per_minute',
        number,
        number,
        number,
        APIRateLimitError['details']?,
      ];
      return {
        ...base,
        category: 'api',
        limitType,
        currentUsage,
        limitValue,
        resetTime,
        provider: 'yandex_cloud',
        details,
      } as APIRateLimitError;
    }

    case 'PromptValidationError': {
      const [validationRule, promptLength, details] = args as [
        string,
        number,
        PromptValidationError['details']?,
      ];
      return {
        ...base,
        category: 'validation',
        validationRule,
        promptLength,
        details,
      } as PromptValidationError;
    }

    case 'ContextOverflowError': {
      const [contextSize, maxContextSize, overflowAmount, modelId, details] = args as [
        number,
        number,
        number,
        string,
        ContextOverflowError['details']?,
      ];
      return {
        ...base,
        category: 'validation',
        contextSize,
        maxContextSize,
        overflowAmount,
        modelId,
        details,
      } as ContextOverflowError;
    }

    default:
      throw new Error(`Unknown AIServiceError tag: ${String(tag)}`);
  }
}

// ==================== PATTERN MATCHING HELPERS ====================

/** AIServiceError матчер функция */
export type AIServiceErrorMatcher<R> = {
  readonly modelLoadError: (error: ModelLoadError) => R;
  readonly inferenceError: (error: InferenceError) => R;
  readonly tokenLimitError: (error: TokenLimitError) => R;
  readonly apiRateLimitError: (error: APIRateLimitError) => R;
  readonly promptValidationError: (error: PromptValidationError) => R;
  readonly contextOverflowError: (error: ContextOverflowError) => R;
  readonly fallback: (error: AIServiceError) => R;
};

/** Pattern matching AIServiceError с exhaustiveness */
export function matchAIServiceError<R>(
  error: AIServiceError,
  matcher: AIServiceErrorMatcher<R>,
): R {
  switch (error._tag) {
    case 'ModelLoadError':
      return matcher.modelLoadError(error);
    case 'InferenceError':
      return matcher.inferenceError(error);
    case 'TokenLimitError':
      return matcher.tokenLimitError(error);
    case 'APIRateLimitError':
      return matcher.apiRateLimitError(error);
    case 'PromptValidationError':
      return matcher.promptValidationError(error);
    case 'ContextOverflowError':
      return matcher.contextOverflowError(error);
    default:
      return matcher.fallback(error);
  }
}

/** Safe pattern matching AIServiceError (возвращает undefined для неверного типа) */
export function safeMatchAIServiceError<R>(
  error: unknown,
  matcher: AIServiceErrorMatcher<R>,
): R | undefined {
  return isAIServiceError(error) ? matchAIServiceError(error, matcher) : undefined;
}

// ==================== UTILITY TYPES ====================

/** Извлекает детали из AIServiceError */
export type AIServiceErrorDetails<E extends AIServiceError> = E extends AIServiceError ? E : never;

/** Union кодов для категории AIServiceError */
export type AIServiceErrorCode<
  C extends AIServiceError['category'],
> = Extract<AIServiceError, { category: C; }>['code'];

/** Тип для создания AIServiceError */
export type AIServiceErrorInput<T = unknown> = {
  readonly code: AIServiceErrorCodeString;
  readonly message: string;
  readonly details?: T;
};

// ==================== ERROR KIND UTILITIES ====================

/** Извлекает AIServiceErrorKind из ошибки */
export function getAIServiceErrorKind(error: AIServiceError): AIServiceErrorKind {
  return error._tag as AIServiceErrorKind;
}

/** Проверяет конкретный вид AIServiceError */
export function isAIServiceErrorKind<E extends AIServiceError>(
  error: AIServiceError,
  kind: AIServiceErrorKind,
): error is E {
  return error._tag === kind;
}

/** Группирует AIServiceError по виду */
export function groupAIServiceErrorsByKind(
  errors: readonly AIServiceError[],
): Map<AIServiceErrorKind, AIServiceError[]> {
  let groups = new Map<AIServiceErrorKind, AIServiceError[]>();
  for (const error of errors) {
    const kind = getAIServiceErrorKind(error);
    const current = groups.get(kind) ?? [];
    // Создаем новый Map для immutable подхода
    groups = new Map(groups).set(kind, [...current, error]);
  }

  return groups;
}

// ==================== VALIDATION HELPERS ====================

/** Проверяет AIServiceError, возвращает результат валидации */
export function validateAIServiceError(error: unknown): {
  isValid: boolean;
  error?: string;
  value?: AIServiceError;
} {
  if (isAIServiceError(error)) {
    return { isValid: true, value: error };
  }
  return { isValid: false, error: `Expected AIServiceError: ${JSON.stringify(error)}` };
}

/** Проверяет конкретный вид AIServiceError */
export function validateAIServiceErrorKind<E extends AIServiceError>(
  error: AIServiceError,
  kind: AIServiceErrorKind,
): {
  isValid: boolean;
  error?: string;
  value?: E;
} {
  if (isAIServiceErrorKind<E>(error, kind)) {
    return { isValid: true, value: error };
  }
  return { isValid: false, error: `Expected AIServiceError of kind ${kind}: got ${error._tag}` };
}

/** Проверяет категорию AIServiceError */
export function validateAIServiceErrorCategory(
  error: AIServiceError,
  category: AIServiceErrorCategory,
): {
  isValid: boolean;
  error?: string;
} {
  if (error.category === category) {
    return { isValid: true };
  }
  return {
    isValid: false,
    error: `Expected AIServiceError with category ${category}: got ${error.category}`,
  };
}

/** Проверяет код ошибки SERVICE_AI_ */
export function validateAIServiceErrorCode(code: string): {
  isValid: boolean;
  error?: string;
  value?: AIServiceErrorCodeString;
} {
  if (!code.startsWith('SERVICE_AI_')) {
    return {
      isValid: false,
      error: `Expected AIServiceError code with SERVICE_AI_ prefix: got ${code}`,
    };
  }

  // Дополнительная проверка на формат: SERVICE_AI_ + 3 цифры
  const codePattern = /^SERVICE_AI_\d{3}$/;
  if (!codePattern.test(code)) {
    return {
      isValid: false,
      error: `Invalid SERVICE_AI_ code format, expected SERVICE_AI_XXX: got ${code}`,
    };
  }

  return { isValid: true, value: code as AIServiceErrorCodeString };
}
