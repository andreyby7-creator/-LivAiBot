/**
 * @file PromptValidationError.ts - Доменные ошибки валидации промптов AI
 *
 * Специализированные ошибки для валидации содержимого промптов.
 * Включает правила безопасности, контент-фильтры и форматные ограничения.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/** Дефолтная уверенность для запрещенного контента */
const DEFAULT_FORBIDDEN_CONTENT_CONFIDENCE = 0.8;

/** Максимальное количество частей промпта в превью */
const MAX_PROMPT_PREVIEW_PARTS = 3;

/** Контекст ошибки валидации промпта с ML-специфичными полями */
export type PromptValidationErrorContext = {
  /** Тип контекста домена */
  readonly type: 'prompt_validation';
  /** Правило валидации, которое было нарушено */
  readonly validationRule: string;
  /** Длина промпта в символах */
  readonly promptLength: number;
  /** Максимально допустимая длина */
  readonly maxAllowedLength?: number;
  /** Части промпта, которые не прошли валидацию */
  readonly invalidParts?: readonly string[];
  /** Предложения по исправлению */
  readonly suggestions?: readonly string[];
  /** Превью проблемной части промпта */
  readonly promptPreview?: string;
  /** Тип контента (text, code, json, etc.) */
  readonly contentType?: string;
  /** Уровень доверия к валидации (0-1) */
  readonly confidence?: number;
  /** Модель, которая выполняла валидацию */
  readonly validationModel?: string;
};

/** TaggedError тип для ошибок валидации промптов */
export type PromptValidationError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.SECURITY;
    readonly origin: typeof ERROR_ORIGIN.DOMAIN;
    readonly severity: typeof ERROR_SEVERITY.HIGH;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: PromptValidationErrorContext;
    readonly timestamp: string;
  },
  'PromptValidationError'
>;

/** Создает PromptValidationError с доменными правилами валидации */
export function createPromptValidationError(
  code: ErrorCode,
  message: string,
  validationRule: string,
  promptLength: number,
  context?: Omit<PromptValidationErrorContext, 'validationRule' | 'promptLength'>,
  timestamp?: string,
): PromptValidationError {
  return {
    _tag: 'PromptValidationError',
    category: ERROR_CATEGORY.SECURITY,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: ERROR_SEVERITY.HIGH,
    code,
    message,
    details: {
      type: 'prompt_validation',
      validationRule,
      promptLength,
      ...context,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as PromptValidationError;
}

/** Проверяет PromptValidationErrorContext */
export function isValidPromptValidationErrorContext(
  context: unknown,
): context is PromptValidationErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем обязательные поля
  if (ctx['type'] !== 'prompt_validation') return false;
  if (typeof ctx['validationRule'] !== 'string') return false;
  if (typeof ctx['promptLength'] !== 'number') return false;

  // Проверяем опциональные поля
  if (ctx['maxAllowedLength'] !== undefined && typeof ctx['maxAllowedLength'] !== 'number') {
    return false;
  }
  if (ctx['invalidParts'] !== undefined && !Array.isArray(ctx['invalidParts'])) {
    return false;
  }
  if (ctx['suggestions'] !== undefined && !Array.isArray(ctx['suggestions'])) {
    return false;
  }
  if (ctx['promptPreview'] !== undefined && typeof ctx['promptPreview'] !== 'string') {
    return false;
  }
  if (ctx['contentType'] !== undefined && typeof ctx['contentType'] !== 'string') {
    return false;
  }
  if (ctx['confidence'] !== undefined && typeof ctx['confidence'] !== 'number') {
    return false;
  }
  if (ctx['validationModel'] !== undefined && typeof ctx['validationModel'] !== 'string') {
    return false;
  }

  return true;
}

/** Создает PromptValidationError для превышения длины промпта */
export function createPromptTooLongError(
  promptLength: number,
  maxAllowedLength: number,
  suggestions: readonly string[] = [],
): PromptValidationError {
  return createPromptValidationError(
    'SERVICE_AI_009' as ErrorCode, // SERVICE_AI_PROMPT_VALIDATION_FAILED
    `Промпт слишком длинный: ${promptLength} символов (макс. ${maxAllowedLength})`,
    'max_length_exceeded',
    promptLength,
    {
      type: 'prompt_validation' as const,
      maxAllowedLength,
      suggestions,
      promptPreview: `Длина: ${promptLength}/${maxAllowedLength}`,
    },
  );
}

/** Создает PromptValidationError для запрещенного контента */
export function createPromptForbiddenContentError(
  invalidParts: readonly string[],
  validationRule: string,
  confidence: number = DEFAULT_FORBIDDEN_CONTENT_CONFIDENCE,
): PromptValidationError {
  return createPromptValidationError(
    'SERVICE_AI_009' as ErrorCode, // SERVICE_AI_PROMPT_VALIDATION_FAILED
    `Промпт содержит запрещенный контент по правилу: ${validationRule}`,
    validationRule,
    invalidParts.join('').length,
    {
      type: 'prompt_validation' as const,
      invalidParts,
      confidence,
      suggestions: [
        'Удалите запрещенный контент',
        'Перефразируйте запрос',
        'Используйте более безопасные формулировки',
      ],
      promptPreview: invalidParts.slice(0, MAX_PROMPT_PREVIEW_PARTS).join('...'), // Показываем первые части
    },
  );
}

/** Создает PromptValidationError для некорректного формата */
export function createPromptFormatError(
  contentType: string,
  promptPreview: string,
  suggestions: readonly string[] = [],
): PromptValidationError {
  return createPromptValidationError(
    'SERVICE_AI_009' as ErrorCode, // SERVICE_AI_PROMPT_VALIDATION_FAILED
    `Некорректный формат промпта для типа контента: ${contentType}`,
    'invalid_format',
    promptPreview.length,
    {
      type: 'prompt_validation' as const,
      contentType,
      promptPreview,
      suggestions: suggestions.length > 0 ? suggestions : [
        `Используйте правильный формат для ${contentType}`,
        'Проверьте синтаксис',
        'Следуйте документации по формату',
      ],
    },
  );
}

/** Проверяет ошибку на превышение длины промпта */
export function isPromptLengthError(error: PromptValidationError): boolean {
  return error.details?.validationRule === 'max_length_exceeded';
}

/** Проверяет ошибку на запрещенный контент */
export function isPromptForbiddenContentError(error: PromptValidationError): boolean {
  const rule = error.details?.validationRule;
  return typeof rule === 'string' && (rule.includes('forbidden')
    || rule.includes('unsafe')
    || rule.includes('prohibited'));
}

/** Проверяет ошибку на проблемы с форматом */
export function isPromptFormatError(error: PromptValidationError): boolean {
  const rule = error.details?.validationRule;
  return typeof rule === 'string' && (rule === 'invalid_format'
    || rule.includes('format'));
}
