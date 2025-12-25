/**
 * @file AIServiceErrorRegistry.ts - Реестр SERVICE_AI_* кодов с ML-specific метаданными
 *
 * Регистрирует AI service ошибки в UnifiedErrorRegistry.services с расширенными метаданными:
 * - ML-specific контекст (model types, token costs, inference parameters)
 * - AI operation metadata (generation, classification, embedding modes)
 * - Provider-specific information (Yandex Cloud, local models)
 * - Performance metrics (latency thresholds, memory requirements)
 *
 * Интегрируется с Effect для type-safe error handling и observability.
 */

import { SERVICE_ERROR_CODES } from '../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { ErrorCode } from '../../base/ErrorCode.js';
import type { ExtendedErrorCodeMetadata } from '../../base/ErrorCodeMeta.js';

// ==================== AI-SPECIFIC METADATA TYPES ====================

/** ML-specific метаданные для AI операций */
export type AIMetadata = {
  /** Тип модели (text, vision, multimodal) */
  readonly modelType: 'text' | 'vision' | 'multimodal' | 'embedding';

  /** Провайдер модели */
  readonly provider: 'yandex' | 'local' | 'external';

  /** Тип AI операции */
  readonly operationType:
    | 'generation'
    | 'classification'
    | 'embedding'
    | 'translation'
    | 'analysis';

  /** Ориентировочная стоимость в токенах */
  readonly estimatedTokens?: number;

  /** Максимальное время выполнения в ms */
  readonly timeoutMs?: number;

  /** Требования к памяти (MB) */
  readonly memoryRequiredMb?: number;

  /** GPU requirements flag */
  readonly requiresGpu?: boolean;

  /** Поддерживает streaming responses */
  readonly supportsStreaming?: boolean;

  /** Retry policy recommendation */
  readonly retryRecommended?: boolean;

  /** Circuit breaker threshold */
  readonly circuitBreakerThreshold?: number;
};

/** Расширенные метаданные для AI service ошибок */
export type AIServiceErrorMetadata = ExtendedErrorCodeMetadata & AIMetadata;

// ==================== AI SERVICE ERROR CODES ====================

/** SERVICE_AI_* коды с ML-specific метаданными */
export const AI_SERVICE_ERROR_CODES = {
  // Model Operations (001-099)
  [SERVICE_ERROR_CODES.SERVICE_AI_MODEL_UNAVAILABLE]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_MODEL_UNAVAILABLE,
    description: 'Запрашиваемая модель ИИ недоступна или не существует',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.EXTERNAL,
    httpStatus: 503,
    internalCode: 'AI_MODEL_UNAVAILABLE',
    loggable: true,
    userVisible: true,
    remediation: 'Проверьте доступность модели или выберите альтернативную',
    docsUrl: 'https://docs.livaibot.ai/errors/model-unavailable',

    // AI-specific metadata
    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    timeoutMs: 30000,
    memoryRequiredMb: 1024,
    requiresGpu: true,
    supportsStreaming: true,
    retryRecommended: true,
    circuitBreakerThreshold: 5,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_PROCESSING_FAILED]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_PROCESSING_FAILED,
    description: 'Ошибка обработки AI запроса на стороне сервиса',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.SERVICE,
    httpStatus: 500,
    internalCode: 'AI_PROCESSING_FAILED',
    loggable: true,
    userVisible: false,
    remediation: 'Повторите запрос или обратитесь в поддержку',
    docsUrl: 'https://docs.livaibot.ai/errors/processing-failed',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 100,
    timeoutMs: 60000,
    memoryRequiredMb: 2048,
    requiresGpu: true,
    supportsStreaming: false,
    retryRecommended: false,
    circuitBreakerThreshold: 3,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_INVALID_INPUT]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_INVALID_INPUT,
    description: 'Некорректный формат входных данных для AI операции',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    httpStatus: 400,
    internalCode: 'AI_INVALID_INPUT',
    loggable: false,
    userVisible: true,
    remediation: 'Проверьте формат входных данных согласно документации',
    docsUrl: 'https://docs.livaibot.ai/errors/invalid-input',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 50,
    timeoutMs: 5000,
    memoryRequiredMb: 256,
    requiresGpu: false,
    supportsStreaming: false,
    retryRecommended: false,
    circuitBreakerThreshold: 10,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_RATE_LIMIT_EXCEEDED]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_RATE_LIMIT_EXCEEDED,
    description: 'Превышен лимит запросов к AI сервису',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.PERFORMANCE,
    origin: ERROR_ORIGIN.DOMAIN,
    httpStatus: 429,
    internalCode: 'AI_RATE_LIMIT_EXCEEDED',
    loggable: true,
    userVisible: true,
    remediation: 'Дождитесь сброса лимита или увеличьте план',
    docsUrl: 'https://docs.livaibot.ai/errors/rate-limit',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 0,
    timeoutMs: 1000,
    memoryRequiredMb: 0,
    requiresGpu: false,
    supportsStreaming: false,
    retryRecommended: true,
    circuitBreakerThreshold: 10,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_MODEL_TIMEOUT]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_MODEL_TIMEOUT,
    description: 'Превышено время ожидания ответа от AI модели',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.PERFORMANCE,
    origin: ERROR_ORIGIN.EXTERNAL,
    httpStatus: 504,
    internalCode: 'AI_MODEL_TIMEOUT',
    loggable: true,
    userVisible: true,
    remediation: 'Попробуйте упростить запрос или использовать другую модель',
    docsUrl: 'https://docs.livaibot.ai/errors/model-timeout',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 500,
    timeoutMs: 120000,
    memoryRequiredMb: 4096,
    requiresGpu: true,
    supportsStreaming: true,
    retryRecommended: true,
    circuitBreakerThreshold: 3,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_MODEL_LOAD_FAILED]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_MODEL_LOAD_FAILED,
    description: 'Не удалось загрузить модель ИИ в память',
    severity: ERROR_SEVERITY.CRITICAL,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    httpStatus: 503,
    internalCode: 'AI_MODEL_LOAD_FAILED',
    loggable: true,
    userVisible: false,
    remediation: 'Требуется вмешательство DevOps для проверки инфраструктуры',
    docsUrl: 'https://docs.livaibot.ai/errors/model-load-failed',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    timeoutMs: 300000,
    memoryRequiredMb: 8192,
    requiresGpu: true,
    supportsStreaming: false,
    retryRecommended: false,
    circuitBreakerThreshold: 1,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_INFERENCE_ERROR]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_INFERENCE_ERROR,
    description: 'Ошибка выполнения инференса AI модели',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.EXTERNAL,
    httpStatus: 502,
    internalCode: 'AI_INFERENCE_ERROR',
    loggable: true,
    userVisible: false,
    remediation: 'Модель может быть повреждена, требуется перезагрузка',
    docsUrl: 'https://docs.livaibot.ai/errors/inference-error',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 200,
    timeoutMs: 45000,
    memoryRequiredMb: 3072,
    requiresGpu: true,
    supportsStreaming: true,
    retryRecommended: true,
    circuitBreakerThreshold: 3,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_TOKEN_LIMIT_EXCEEDED]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_TOKEN_LIMIT_EXCEEDED,
    description: 'Превышен лимит токенов для AI операции',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    httpStatus: 413,
    internalCode: 'AI_TOKEN_LIMIT_EXCEEDED',
    loggable: true,
    userVisible: true,
    remediation: 'Уменьшите размер запроса или используйте модель с большим контекстом',
    docsUrl: 'https://docs.livaibot.ai/errors/token-limit',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 8000,
    timeoutMs: 10000,
    memoryRequiredMb: 1024,
    requiresGpu: false,
    supportsStreaming: false,
    retryRecommended: false,
    circuitBreakerThreshold: 5,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_PROMPT_VALIDATION_FAILED]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_PROMPT_VALIDATION_FAILED,
    description: 'Промпт не прошел валидацию по правилам безопасности',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.SECURITY,
    origin: ERROR_ORIGIN.DOMAIN,
    httpStatus: 400,
    internalCode: 'AI_PROMPT_VALIDATION_FAILED',
    loggable: true,
    userVisible: true,
    remediation: 'Исправьте содержимое промпта согласно правилам использования',
    docsUrl: 'https://docs.livaibot.ai/errors/prompt-validation',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 100,
    timeoutMs: 5000,
    memoryRequiredMb: 256,
    requiresGpu: false,
    supportsStreaming: false,
    retryRecommended: false,
    circuitBreakerThreshold: 10,
  } satisfies AIServiceErrorMetadata,

  [SERVICE_ERROR_CODES.SERVICE_AI_CONTEXT_OVERFLOW]: {
    code: SERVICE_ERROR_CODES.SERVICE_AI_CONTEXT_OVERFLOW,
    description: 'Превышен максимальный размер контекста модели',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    httpStatus: 413,
    internalCode: 'AI_CONTEXT_OVERFLOW',
    loggable: true,
    userVisible: true,
    remediation: 'Сократите контекст или используйте модель с большим контекстом',
    docsUrl: 'https://docs.livaibot.ai/errors/context-overflow',

    modelType: 'text' as const,
    provider: 'yandex' as const,
    operationType: 'generation' as const,
    estimatedTokens: 32000,
    timeoutMs: 15000,
    memoryRequiredMb: 2048,
    requiresGpu: true,
    supportsStreaming: false,
    retryRecommended: false,
    circuitBreakerThreshold: 5,
  } satisfies AIServiceErrorMetadata,
} satisfies Record<ErrorCode, AIServiceErrorMetadata>;

// ==================== REGISTRY CONSTANTS ====================

/** Получает метаданные для AI service ошибки по коду */
export function getAIServiceErrorMeta(code: ErrorCode): AIServiceErrorMetadata | undefined {
  return AI_SERVICE_ERROR_CODES[code as keyof typeof AI_SERVICE_ERROR_CODES];
}

/** Получает все AI service метаданные ошибок */
export function getAllAIServiceErrorMeta(): Record<ErrorCode, AIServiceErrorMetadata> {
  return AI_SERVICE_ERROR_CODES;
}

// ==================== AI-SPECIFIC UTILITIES ====================

/** Дефолтное значение circuit breaker threshold */
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5;

/** Проверяет GPU требования для ошибки - используется для выбора инфраструктуры */
export function requiresGpuForError(code: ErrorCode): boolean {
  const metadata = getAIServiceErrorMeta(code);
  return metadata?.requiresGpu ?? false;
}

/** Получает retry стратегию для ошибки - определяет поведение при повторных попытках */
export function getRetryStrategyForError(code: ErrorCode): {
  shouldRetry: boolean;
  circuitBreakerThreshold: number;
} {
  const metadata = getAIServiceErrorMeta(code);
  return {
    shouldRetry: metadata?.retryRecommended ?? false,
    circuitBreakerThreshold: metadata?.circuitBreakerThreshold ?? DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
  };
}

/** Получает оценку стоимости в токенах для ошибки - используется для биллинга */
export function getTokenCostForError(code: ErrorCode): number {
  const metadata = getAIServiceErrorMeta(code);
  return metadata?.estimatedTokens ?? 0;
}

/** Группирует ошибки по типу модели - для аналитики и маршрутизации */
export function groupErrorsByModelType(
  codes: readonly ErrorCode[],
): Partial<Record<AIMetadata['modelType'], ErrorCode[]>> {
  let groups = new Map<AIMetadata['modelType'], ErrorCode[]>();
  for (const code of codes) {
    const metadata = getAIServiceErrorMeta(code);
    if (metadata) {
      const modelType = metadata.modelType;
      const current = groups.get(modelType) ?? [];
      groups = new Map(groups).set(modelType, [...current, code]);
    }
  }
  return Object.fromEntries(groups) as Partial<Record<AIMetadata['modelType'], ErrorCode[]>>;
}

/** Получает ошибки с streaming поддержкой - для выбора протокола ответа */
export function getStreamingCapableErrors(): ErrorCode[] {
  const allErrors = getAllAIServiceErrorMeta();

  return Object.entries(allErrors)
    .filter(([, metadata]) => metadata.supportsStreaming ?? false)
    .map(([code]) => code);
}

/** Получает ошибки по типу операции - для фильтрации по AI operation type */
export function getErrorsByOperationType(operationType: AIMetadata['operationType']): ErrorCode[] {
  const allErrors = getAllAIServiceErrorMeta();

  return Object.entries(allErrors)
    .filter(([, metadata]) => metadata.operationType === operationType)
    .map(([code]) => code);
}

/** Получает уникальные типы операций из всех ошибок */
export function getAllOperationTypes(): AIMetadata['operationType'][] {
  const allErrors = getAllAIServiceErrorMeta();

  const operationTypes = Object.values(allErrors).reduce((types, metadata) => {
    if (!types.includes(metadata.operationType)) {
      return [...types, metadata.operationType];
    }
    return types;
  }, [] as AIMetadata['operationType'][]);

  return operationTypes;
}

// ==================== CONSTANTS EXPORT ====================

/** Все SERVICE_AI_* коды для быстрого доступа */
export const AI_SERVICE_ERROR_CODE_LIST = Object.keys(
  AI_SERVICE_ERROR_CODES,
) as readonly ErrorCode[];

/** Количество зарегистрированных AI ошибок */
export const AI_SERVICE_ERROR_COUNT = AI_SERVICE_ERROR_CODE_LIST.length;
