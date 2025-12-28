/**
 * @file GenericAPIError.ts - Универсальная ошибка для неизвестных API ответов
 *
 * Fallback ошибка для случаев, когда невозможно распарсить или интерпретировать
 * ответ от платежного API провайдера. Не содержит бизнес-логики или retry решений.
 *
 * Особенности:
 * - Для всех неизвестных/непонятных API ответов
 * - Не делает предположений о причинах ошибки
 * - Только факт: "получили непонятный ответ от API"
 * - Severity: HIGH (системная ошибка интерпретации API)
 * - Raw response только для internal debugging
 * - Используется только в orchestration layer (PaymentOrchestrator)
 * - НИКОГДА не раскрывается за пределами границы сервиса (GDPR/PII compliance)
 */

import { SERVICE_ERROR_CODES } from '../../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';
import { isPaymentProviderId } from '../../../shared/PaymentProviderId.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { PaymentProviderId } from '../../../shared/PaymentProviderId.js';

// ==================== HTTP STATUS CONSTANTS ====================

/** Минимальный HTTP статус код */
const MIN_HTTP_STATUS = 100;

/** Максимальный HTTP статус код */
const MAX_HTTP_STATUS = 599;

// ==================== HELPER FUNCTIONS ====================

/** Проверяет, является ли значение числом */
const isNumber = (value: unknown): value is number => typeof value === 'number';

/** Проверяет, является ли значение строкой */
const isString = (value: unknown): value is string => typeof value === 'string';

/** Проверяет, является ли значение валидным HTTP статусом (100-599) */
const isValidHttpStatus = (value: unknown): value is number =>
  isNumber(value)
  && value >= MIN_HTTP_STATUS
  && value <= MAX_HTTP_STATUS
  && Number.isInteger(value);

// ==================== TYPES & CONSTANTS ====================

/** Контекст универсальной API ошибки */
export type GenericAPIErrorContext = {
  /** Провайдер, от которого получен непонятный ответ */
  readonly provider: PaymentProviderId;

  /** HTTP статус ответа (100-599, если удалось определить) */
  readonly httpStatus?: number;

  /**
   * Raw API response для debugging
   * @internal Только для internal debugging, не использовать в production логике
   */
  readonly rawResponse?: unknown;

  /** Сообщение об ошибке из API (если удалось извлечь) */
  readonly errorMessage?: string;

  /** Correlation ID для tracing */
  readonly correlationId?: string;
};

/** TaggedError тип для универсальной API ошибки */
export type GenericAPIError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.SYSTEM;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.HIGH;
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_GENERIC_API_ERROR;
  readonly message: string;
  readonly details?: GenericAPIErrorContext;
  readonly timestamp: string;
}, 'GenericAPIError'>;

// ==================== FACTORY FUNCTION ====================

/**
 * Создает GenericAPIError для случаев, когда невозможно распарсить API ответ
 *
 * Используется в provider clients при получении неизвестного/непонятного ответа.
 * НЕ содержит retry/failover логики - это задача orchestration layer.
 */
export function createGenericAPIError(
  message: string,
  context: GenericAPIErrorContext,
  timestamp?: string,
): GenericAPIError {
  return {
    _tag: 'GenericAPIError',
    category: ERROR_CATEGORY.SYSTEM,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.HIGH,
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_GENERIC_API_ERROR,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as const;
}

// ==================== VALIDATION ====================

/**
 * Проверяет валидность GenericAPIErrorContext
 */
export function isValidGenericAPIErrorContext(
  context: unknown,
): context is GenericAPIErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Обязательные поля
  if (!isPaymentProviderId(ctx['provider'])) return false;

  // Опциональные поля
  if (ctx['httpStatus'] !== undefined && !isValidHttpStatus(ctx['httpStatus'])) return false;
  if (ctx['errorMessage'] !== undefined && !isString(ctx['errorMessage'])) return false;
  if (ctx['correlationId'] !== undefined && !isString(ctx['correlationId'])) return false;
  // rawResponse может быть любым типом

  return true;
}

// ==================== TYPE GUARD ====================

/**
 * Type guard для проверки GenericAPIError
 */
export function isGenericAPIError(error: unknown): error is GenericAPIError {
  if (
    typeof error !== 'object'
    || error === null
    || !('_tag' in error)
    || !('code' in error)
  ) {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Проверяем основные поля ошибки
  const hasValidTag = err['_tag'] === 'GenericAPIError';
  const hasValidCode = err['code'] === SERVICE_ERROR_CODES.SERVICE_BILLING_GENERIC_API_ERROR;

  // Проверяем валидность контекста ошибки (если он есть)
  const hasValidDetails = err['details'] === undefined
    || isValidGenericAPIErrorContext(err['details']);

  return hasValidTag && hasValidCode && hasValidDetails;
}

// ==================== GETTER FUNCTIONS ====================

/** Извлекает провайдера из GenericAPIError */
export function getGenericAPIErrorProvider(error: GenericAPIError): PaymentProviderId | undefined {
  return error.details?.provider;
}

/** Извлекает HTTP статус из GenericAPIError */
export function getGenericAPIErrorHttpStatus(error: GenericAPIError): number | undefined {
  return error.details?.httpStatus;
}

/** Извлекает raw response из GenericAPIError (⚠️ internal debugging only) */
export function getGenericAPIErrorRawResponse(error: GenericAPIError): unknown {
  return error.details?.rawResponse;
}

/** Извлекает error message из GenericAPIError */
export function getGenericAPIErrorMessage(error: GenericAPIError): string | undefined {
  return error.details?.errorMessage;
}

/** Извлекает correlation ID из GenericAPIError */
export function getGenericAPIErrorCorrelationId(error: GenericAPIError): string | undefined {
  return error.details?.correlationId;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Создает GenericAPIError из любого неизвестного API ответа
 * Удобный helper для provider clients
 */
export function createGenericAPIErrorFromResponse(
  provider: PaymentProviderId,
  rawResponse: unknown,
  correlationId?: string,
): GenericAPIError {
  // Пытаемся извлечь HTTP статус, если возможно
  let httpStatus: number | undefined;
  let errorMessage: string | undefined;

  if (typeof rawResponse === 'object' && rawResponse !== null) {
    // Простая попытка извлечь статус из типичных структур
    const response = rawResponse as Record<string, unknown>;
    if (typeof response['status'] === 'number') {
      httpStatus = response['status'];
    }
    if (typeof response['message'] === 'string') {
      errorMessage = response['message'];
    }
    if (typeof response['error'] === 'string') {
      errorMessage = response['error'];
    }
  }

  const context: GenericAPIErrorContext = {
    provider,
    ...(httpStatus !== undefined && { httpStatus }),
    ...(errorMessage !== undefined && { errorMessage }),
    ...(correlationId !== undefined && { correlationId }),
    rawResponse, // ⚠️ internal only
  };

  return createGenericAPIError(
    `Unable to parse API response from ${provider}`,
    context,
  );
}
