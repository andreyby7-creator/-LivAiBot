/**
 * @file ValidationError.ts - Ошибки валидации домена LivAiBot
 *
 * TaggedError типы для ошибок валидации данных.
 * Использует BaseError + ErrorBuilders для type-safe создания ошибок.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';
import type { ErrorMetadataDomainContext } from '../../base/ErrorMetadata.js';

/**
 * Контекст ошибки валидации с дополнительными полями
 */
export type ValidationErrorContext = ErrorMetadataDomainContext & {
  /** Поле, которое не прошло валидацию */
  readonly field?: string;
  /** Значение поля */
  readonly value?: unknown;
  /** Правило валидации, которое было нарушено */
  readonly rule?: string;
  /** Ожидаемый тип данных */
  readonly expectedType?: string;
  /** Фактический тип данных */
  readonly actualType?: string;
  /** Дополнительные ограничения */
  readonly constraints?: Record<string, unknown>;
};

/**
 * TaggedError тип для ошибок валидации данных
 */
export type ValidationError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.BUSINESS;
    readonly origin: typeof ERROR_ORIGIN.DOMAIN;
    readonly severity: typeof ERROR_SEVERITY.MEDIUM;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: ValidationErrorContext;
    readonly timestamp: string;
  },
  'ValidationError'
>;

/**
 * Создает ValidationError с автоматической генерацией метаданных
 * @param code - код ошибки из LivAi error codes
 * @param message - человекочитаемое сообщение
 * @param context - контекст ошибки валидации
 * @param timestamp - опциональный timestamp для тестов
 * @returns ValidationError
 */
export function createValidationError(
  code: ErrorCode,
  message: string,
  context?: ValidationErrorContext,
  timestamp?: string,
): ValidationError {
  return {
    _tag: 'ValidationError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: ERROR_SEVERITY.MEDIUM,
    code,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as ValidationError;
}

/**
 * Проверяет, является ли объект допустимым ValidationErrorContext
 * @param context - объект для проверки
 * @returns true если соответствует ValidationErrorContext
 */
export function isValidValidationErrorContext(
  context: unknown,
): context is ValidationErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем базовые поля ErrorMetadataDomainContext
  if (typeof ctx['type'] !== 'string') return false;

  // Проверяем опциональные поля ValidationErrorContext
  if (ctx['field'] !== undefined && typeof ctx['field'] !== 'string') {
    return false;
  }
  if (ctx['rule'] !== undefined && typeof ctx['rule'] !== 'string') {
    return false;
  }
  if (
    ctx['expectedType'] !== undefined
    && typeof ctx['expectedType'] !== 'string'
  ) {
    return false;
  }
  if (ctx['actualType'] !== undefined && typeof ctx['actualType'] !== 'string') {
    return false;
  }
  if (
    ctx['constraints'] !== undefined
    && (ctx['constraints'] === null
      || typeof ctx['constraints'] !== 'object'
      || Array.isArray(ctx['constraints']))
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard для проверки, является ли ошибка ValidationError
 * @param error - ошибка для проверки
 * @returns true если это ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  const candidate = error as Record<string, unknown>;

  return (
    typeof error === 'object'
    && error !== null
    && candidate['_tag'] === 'ValidationError'
    && candidate['category'] === ERROR_CATEGORY.BUSINESS
    && candidate['origin'] === ERROR_ORIGIN.DOMAIN
    && candidate['severity'] === ERROR_SEVERITY.MEDIUM
    && typeof candidate['code'] === 'string'
    && typeof candidate['message'] === 'string'
    && typeof candidate['timestamp'] === 'string'
    && (candidate['details'] === undefined
      || isValidValidationErrorContext(candidate['details']))
  );
}

/**
 * Извлекает информацию о поле из ValidationError
 * @param error - ValidationError
 * @returns информация о поле или undefined
 */
export function getValidationField(error: ValidationError): string | undefined {
  return error.details?.field;
}

/**
 * Извлекает правило валидации из ValidationError
 * @param error - ValidationError
 * @returns правило валидации или undefined
 */
export function getValidationRule(error: ValidationError): string | undefined {
  return error.details?.rule;
}

/**
 * Извлекает значение поля из ValidationError
 * @param error - ValidationError
 * @returns значение поля или undefined
 */
export function getValidationValue(error: ValidationError): unknown {
  return error.details?.value;
}

/**
 * Извлекает ожидаемый тип данных из ValidationError
 * @param error - ValidationError
 * @returns ожидаемый тип или undefined
 */
export function getExpectedType(error: ValidationError): string | undefined {
  return error.details?.expectedType;
}

/**
 * Извлекает фактический тип данных из ValidationError
 * @param error - ValidationError
 * @returns фактический тип или undefined
 */
export function getActualType(error: ValidationError): string | undefined {
  return error.details?.actualType;
}

/**
 * Извлекает ограничения валидации из ValidationError
 * @param error - ValidationError
 * @returns ограничения или undefined
 */
export function getValidationConstraints(
  error: ValidationError,
): Record<string, unknown> | undefined {
  return error.details?.constraints;
}
