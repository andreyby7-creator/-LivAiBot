/**
 * @file AIServiceValidators.ts - Валидаторы AI операций: модели, токены, API ответы
 *
 * Система валидации AI для LivAiBot:
 * - Проверка моделей: доступность и совместимость
 * - Проверка токенов: лимиты input/output
 * - Проверка API ответов: структура, статус и таймаут
 */

import type { ModelUnavailableReason } from './infrastructure/ModelUnavailableError.js';

/* ========================== TYPES & CONFIG ========================== */

/** Семейство модели AI */
export type AIModelFamily = 'gpt-like' | 'embedding' | 'vision' | 'audio' | 'code' | 'multimodal';
/** Тип задачи AI */
export type AITaskType =
  | 'text-generation'
  | 'text-classification'
  | 'text-summarization'
  | 'question-answering'
  | 'code-generation'
  | 'image-generation'
  | 'image-analysis'
  | 'speech-recognition'
  | 'embedding'
  | 'translation';
/** Тип ответа API */
export type APIResponseType =
  | 'completion'
  | 'chat_completion'
  | 'embedding'
  | 'image_generation'
  | 'moderation'
  | 'error';

/** Конфигурация совместимости задач и моделей */
export interface TaskModelCompatibility {
  readonly taskType: AITaskType;
  readonly compatibleFamilies: readonly AIModelFamily[];
  readonly errorMessage: string;
}

/** Конфигурация валидации моделей */
export interface ModelValidationConfig {
  readonly knownModels: readonly string[];
  readonly defaultFallbackModel?: string;
  readonly taskCompatibility?: readonly TaskModelCompatibility[];
}

/** Конфигурация валидации токенов */
export interface TokenValidationConfig {
  readonly safetyBufferPercent?: number;
  readonly maxTotalTokens?: number;
}

/** Конфигурация валидации API */
export interface APIValidationConfig {
  readonly maxResponseTimeMs?: number;
  readonly allowedResponseTypes?: readonly APIResponseType[];
}

/** Унифицированная конфигурация AI валидации */
export interface AIValidationConfig {
  readonly models?: ModelValidationConfig;
  readonly tokens?: TokenValidationConfig;
  readonly api?: APIValidationConfig;
}

/* ========================== UTILS ========================== */

/** Проверяет, что значение — непустая строка */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}
/** Проверяет, что значение — положительное число */
function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && v > 0;
}
/** Проверяет и возвращает массив из поля объекта, или undefined */
function ensureArrayField(obj: Record<string, unknown>, field: string): unknown[] | undefined {
  const val = obj[field];
  return Array.isArray(val) ? val : undefined;
}

/* ========================== MODEL VALIDATION ========================== */

/** Контекст валидации модели */
export interface ModelValidationContext {
  readonly modelId: string;
  readonly modelFamily?: AIModelFamily;
  readonly taskType?: AITaskType;
  readonly maxContextTokens?: number;
  readonly maxOutputTokens?: number;
  readonly supportedModalities?: readonly string[];
  readonly config?: AIValidationConfig;
}

/** Результат валидации модели */
export interface ModelValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
  readonly suggestedAlternative?: string;
  readonly reason?: ModelUnavailableReason | 'incompatible_task';
  readonly normalizedError?: { readonly code: string; readonly message: string; };
}

/** Валидирует модель на известность и совместимость */
export function validateAIModel(
  modelId: string,
  ctx: ModelValidationContext,
): ModelValidationResult {
  if (!isNonEmptyString(modelId)) {
    return {
      isValid: false,
      error: 'Model ID must be a non-empty string',
      reason: 'model_not_found',
      normalizedError: { code: 'MODEL_ID_INVALID', message: 'Model ID must be a non-empty string' },
    };
  }

  const modelsCfg = ctx.config?.models;
  const knownModels = modelsCfg?.knownModels
    ?? ['yandexgpt-lite', 'yandexgpt', 'yandexgpt-pro', 'yandexgpt-32k', 'yandexart'];
  const fallback = modelsCfg?.defaultFallbackModel ?? 'yandexgpt-lite';

  if (!knownModels.includes(modelId.toLowerCase())) {
    return {
      isValid: false,
      error: `Unknown model: ${modelId}`,
      suggestedAlternative: fallback,
      reason: 'model_not_found',
      normalizedError: { code: 'MODEL_UNKNOWN', message: `Unknown model: ${modelId}` },
    };
  }

  if (ctx.taskType && ctx.modelFamily) {
    const issues = validateModelTaskCompatibility(
      modelId,
      ctx.taskType,
      ctx.modelFamily,
      modelsCfg,
    );
    if (issues.length) {
      return {
        isValid: false,
        error: `Model ${modelId} incompatible with task ${ctx.taskType}: ${issues.join(', ')}`,
        reason: 'incompatible_task',
        normalizedError: { code: 'MODEL_INCOMPATIBLE_TASK', message: issues.join(', ') },
      };
    }
  }

  return { isValid: true };
}

/** Проверяет совместимость модели с типом задачи */
export function validateModelTaskCompatibility(
  _modelId: string,
  taskType: AITaskType,
  modelFamily: AIModelFamily,
  cfg?: ModelValidationConfig,
): readonly string[] {
  const defaultCompat: TaskModelCompatibility[] = [
    {
      taskType: 'text-generation',
      compatibleFamilies: ['gpt-like', 'code'],
      errorMessage: 'text generation requires gpt-like or code model family',
    },
    {
      taskType: 'image-analysis',
      compatibleFamilies: ['vision', 'multimodal'],
      errorMessage: 'image analysis requires vision or multimodal model family',
    },
    {
      taskType: 'embedding',
      compatibleFamilies: ['embedding'],
      errorMessage: 'embedding tasks require embedding model family',
    },
    {
      taskType: 'code-generation',
      compatibleFamilies: ['code'],
      errorMessage: 'code generation requires code model family',
    },
  ];
  const compat = cfg?.taskCompatibility ?? defaultCompat;
  const taskConf = compat.find((c) => c.taskType === taskType);
  if (!taskConf) return [`Unknown task type: ${taskType}`];
  return taskConf.compatibleFamilies.includes(modelFamily) ? [] : [taskConf.errorMessage];
}

/* ========================== TOKEN VALIDATION ========================== */

/** Контекст валидации токенов */
export interface TokenValidationContext {
  readonly currentTokens: number;
  readonly maxAllowedTokens: number;
  readonly contentType: 'input' | 'output' | 'total';
  readonly modelId?: string;
  readonly safetyBufferPercent?: number;
  readonly config?: AIValidationConfig;
}

/** Результат валидации токенов */
export interface TokenValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
  readonly excessTokens?: number;
  readonly usagePercent?: number;
  readonly effectiveLimit?: number;
  readonly normalizedError?: { readonly code: string; readonly message: string; };
}

/** Валидирует лимиты токенов с учётом буфера безопасности */
export function validateTokenLimits(ctx: TokenValidationContext): TokenValidationResult {
  const safety = ctx.config?.tokens?.safetyBufferPercent ?? ctx.safetyBufferPercent ?? 10;
  const { currentTokens, maxAllowedTokens } = ctx;

  if (currentTokens < 0) {
    return {
      isValid: false,
      error: 'Token count cannot be negative',
      normalizedError: { code: 'INVALID_TOKEN_COUNT', message: 'Token count cannot be negative' },
    };
  }
  if (!isPositiveNumber(maxAllowedTokens)) {
    return {
      isValid: false,
      error: 'Max allowed tokens must be positive',
      normalizedError: {
        code: 'INVALID_TOKEN_LIMIT',
        message: 'Max allowed tokens must be positive',
      },
    };
  }

  const effectiveLimit = maxAllowedTokens - Math.floor(maxAllowedTokens * (safety / 100));
  const excess = Math.max(0, currentTokens - effectiveLimit);
  const usagePercent = Math.round((currentTokens / maxAllowedTokens) * 100);

  return currentTokens > effectiveLimit
    ? {
      isValid: false,
      error:
        `${ctx.contentType} token limit exceeded: ${currentTokens}/${effectiveLimit} (${usagePercent}%)`,
      excessTokens: excess,
      usagePercent,
      effectiveLimit,
      normalizedError: {
        code: 'TOKEN_LIMIT_EXCEEDED',
        message: `${ctx.contentType} token limit exceeded`,
      },
    }
    : { isValid: true, usagePercent, effectiveLimit };
}

/** Рассчитывает оптимальный размер чанка для больших текстов */
export function calculateOptimalChunkSize(
  totalTokens: number,
  maxChunkTokens: number,
  overlapTokens = 100,
): { chunkSize: number; overlap: number; chunksCount: number } {
  if (totalTokens <= maxChunkTokens) return { chunkSize: totalTokens, overlap: 0, chunksCount: 1 };
  const effective = maxChunkTokens - overlapTokens;
  return {
    chunkSize: maxChunkTokens,
    overlap: overlapTokens,
    chunksCount: Math.ceil(totalTokens / effective),
  };
}

/* ========================== API RESPONSE VALIDATION ========================== */

/** Контекст валидации API ответа */
export interface APIResponseValidationContext {
  readonly responseType: APIResponseType;
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly responseTimeMs?: number;
  readonly expectedFormat?: 'json' | 'text' | 'binary';
  readonly config?: AIValidationConfig;
}

/** Результат валидации API ответа */
export interface APIResponseValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
  readonly warnings?: readonly string[];
  readonly responseTimeValid?: boolean;
  readonly apiErrorCode?: string;
  readonly normalizedError?: { readonly code: string; readonly message: string; };
}

/** Валидирует API ответ по статусу, формату и таймауту */
export function validateAPIResponse(
  ctx: APIResponseValidationContext,
): APIResponseValidationResult {
  const { statusCode, responseType, responseTimeMs, expectedFormat = 'json' } = ctx;
  const conf = ctx.config?.api;
  const maxTime = conf?.maxResponseTimeMs ?? 30000;
  const allowedTypes = conf?.allowedResponseTypes;
  const warnings: string[] = [];

  if (statusCode < 200 || statusCode >= 300) {
    const msg = `HTTP ${statusCode}: ${getHttpStatusDescription(statusCode)}`;
    if (statusCode >= 400) {
      const norm = extractAPINormalizedError(ctx.body);
      return {
        isValid: false,
        error: msg,
        ...(norm && { apiErrorCode: norm.code, normalizedError: norm }),
      };
    }
    return { isValid: false, error: msg };
  }

  let responseTimeValid = true;
  let updatedWarnings = [...warnings];
  if (responseTimeMs !== undefined) {
    if (responseTimeMs > maxTime) {
      responseTimeValid = false;
      updatedWarnings = [...updatedWarnings, `Response time too slow: ${responseTimeMs}ms`];
    } else if (responseTimeMs > maxTime * 0.33) {
      updatedWarnings = [...updatedWarnings, `Response time slow: ${responseTimeMs}ms`];
    }
  }

  if (allowedTypes && !allowedTypes.includes(responseType)) {
    return {
      isValid: false,
      error: `Response type '${responseType}' not allowed. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  if (expectedFormat === 'json' && typeof ctx.body === 'string') {
    try {
      JSON.parse(ctx.body);
    } catch {
      return { isValid: false, error: 'Invalid JSON format in response body' };
    }
  }

  const typeCheck = validateResponseTypeSpecific(ctx);
  if (!typeCheck.isValid) return typeCheck;

  return {
    isValid: true,
    ...(updatedWarnings.length > 0 && { warnings: updatedWarnings }),
    responseTimeValid,
  };
}

/** Проверка специфичных для типа ответа полей */
function validateResponseTypeSpecific(
  ctx: APIResponseValidationContext,
): APIResponseValidationResult {
  const body = ctx.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') return { isValid: true };
  const arrFields: Record<APIResponseType, string> = {
    completion: 'choices',
    chat_completion: 'choices',
    embedding: 'data',
    image_generation: 'data',
    moderation: 'results',
    error: 'error',
  };
  const field = arrFields[ctx.responseType];
  if (!field) return { isValid: true };
  const val = ensureArrayField(body, field);
  if (!val) {
    return {
      isValid: false,
      error: `${ctx.responseType} response missing required "${field}" array`,
    };
  }
  return { isValid: true };
}

function getHttpStatusDescription(status: number): string {
  const desc: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return desc[status] ?? 'Unknown Error';
}
function extractAPINormalizedError(body: unknown): { code: string; message: string; } | undefined {
  if (body === null || body === undefined || typeof body !== 'object') return undefined;
  const err = (body as Record<string, unknown>)['error'] as Record<string, unknown> | undefined;
  if (!err) return undefined;
  const code = err['code'] ?? err['type'];
  const msg = err['message'] ?? 'Unknown error';
  if (typeof code !== 'string') return undefined;
  return { code, message: String(msg) };
}

/* ========================== COMPOSITE VALIDATION ========================== */

export interface AIValidationContext {
  readonly model: ModelValidationContext;
  readonly inputTokens?: TokenValidationContext;
  readonly outputTokens?: TokenValidationContext;
  readonly apiResponse?: APIResponseValidationContext;
  readonly config?: AIValidationConfig;
}

export interface AggregatedNormalizedErrors {
  readonly primary: { readonly code: string; readonly message: string; } | undefined;
  readonly byComponent: {
    readonly model?: { readonly code: string; readonly message: string; };
    readonly inputTokens?: { readonly code: string; readonly message: string; };
    readonly outputTokens?: { readonly code: string; readonly message: string; };
    readonly apiResponse?: { readonly code: string; readonly message: string; };
  };
}

export interface AIValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly details: {
    readonly model?: ModelValidationResult;
    readonly inputTokens?: TokenValidationResult;
    readonly outputTokens?: TokenValidationResult;
    readonly apiResponse?: APIResponseValidationResult;
  };
  readonly normalizedErrors?: AggregatedNormalizedErrors;
}

/** Комплексная валидация AI операции (модель+токены+API) */
export function validateAIOperation(ctx: AIValidationContext): AIValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const modelResult = validateAIModel(ctx.model.modelId, {
    ...ctx.model,
    ...(ctx.config && { config: ctx.config }),
  });
  let currentErrors = [...errors];
  if (!modelResult.isValid && modelResult.error !== undefined) {
    currentErrors = [...currentErrors, `Model: ${modelResult.error}`];
  }

  const inputResult = ctx.inputTokens
    ? validateTokenLimits({ ...ctx.inputTokens, ...(ctx.config && { config: ctx.config }) })
    : undefined;
  if (inputResult?.error !== undefined) {
    currentErrors = [...currentErrors, `Input tokens: ${inputResult.error}`];
  }

  const outputResult = ctx.outputTokens
    ? validateTokenLimits({ ...ctx.outputTokens, ...(ctx.config && { config: ctx.config }) })
    : undefined;
  if (outputResult?.error !== undefined) {
    currentErrors = [...currentErrors, `Output tokens: ${outputResult.error}`];
  }

  const apiResult = ctx.apiResponse
    ? validateAPIResponse({ ...ctx.apiResponse, ...(ctx.config && { config: ctx.config }) })
    : undefined;
  let currentWarnings = [...warnings];
  if (apiResult?.error !== undefined) {
    currentErrors = [...currentErrors, `API response: ${apiResult.error}`];
  }
  if (apiResult?.warnings !== undefined) {
    currentWarnings = [...currentWarnings, ...apiResult.warnings];
  }

  const byComponent: AggregatedNormalizedErrors['byComponent'] = {
    ...(modelResult.normalizedError && { model: modelResult.normalizedError }),
    ...(inputResult?.normalizedError && { inputTokens: inputResult.normalizedError }),
    ...(outputResult?.normalizedError && { outputTokens: outputResult.normalizedError }),
    ...(apiResult?.normalizedError && { apiResponse: apiResult.normalizedError }),
  };

  const normalizedErrors: AggregatedNormalizedErrors | undefined = Object.keys(byComponent).length
    ? {
      byComponent,
      primary: byComponent.apiResponse
        ?? byComponent.model
        ?? byComponent.inputTokens
        ?? byComponent.outputTokens,
    }
    : undefined;

  return {
    isValid: currentErrors.length === 0,
    errors: currentErrors,
    warnings: currentWarnings,
    details: {
      model: modelResult,
      ...(inputResult && { inputTokens: inputResult }),
      ...(outputResult && { outputTokens: outputResult }),
      ...(apiResult && { apiResponse: apiResult }),
    },
    ...(normalizedErrors && { normalizedErrors }),
  };
}
