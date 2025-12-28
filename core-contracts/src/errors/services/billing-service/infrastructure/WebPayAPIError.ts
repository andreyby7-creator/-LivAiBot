/**
 * @file WebPayAPIError.ts - API ошибки WebPay для LivAiBot Billing Service
 *
 * Специфичные ошибки WebPay платежного агрегатора.
 * Основной белорусский провайдер для LivAiBot с поддержкой BYN/RUB/USD/EUR.
 *
 * WebPay особенности:
 * - iframe/форма или API интеграция
 * - Комиссия: 1.5–2.5%
 * - Поддержка: карты, интернет-банкинг, ЕРИП
 */

import { SERVICE_ERROR_CODES } from '../../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';
import { SUPPORTED_CURRENCIES, SUPPORTED_PAYMENT_METHODS } from '../domain/index.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { SupportedCurrency, SupportedPaymentMethod } from '../domain/index.js';

// ==================== CENTRALIZED LOGGER ====================

/** Интерфейс centralized logger */
type CentralizedLogger = {
  error: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
};

/** JSON indentation для красивого форматирования логов */
const JSON_INDENT = 2;

/** Простая реализация centralized logger (можно заменить на продвинутую систему) */
const createCentralizedLogger = (): CentralizedLogger => ({
  error: (message: string, context?: Record<string, unknown>): void => {
    console.error(
      `[WebPayAPIError] ${message}`,
      context ? JSON.stringify(context, null, JSON_INDENT) : '',
    );
  },
  warn: (message: string, context?: Record<string, unknown>): void => {
    console.warn(
      `[WebPayAPIError] ${message}`,
      context ? JSON.stringify(context, null, JSON_INDENT) : '',
    );
  },
  info: (message: string, context?: Record<string, unknown>): void => {
    console.info(
      `[WebPayAPIError] ${message}`,
      context ? JSON.stringify(context, null, JSON_INDENT) : '',
    );
  },
});

/** Экземпляр centralized logger (можно заменить в runtime) */
let logger = createCentralizedLogger();

// Экспортируем текущий logger для чтения
export const getWebPayLogger = (): CentralizedLogger => logger;

// Заменяет logger на кастомную реализацию для интеграции с monitoring системами
export const setWebPayLogger = (customLogger: CentralizedLogger): void => {
  logger = customLogger;
};

// HTTP статусы WebPay API (для metadata)
/** @description Client errors (4xx) - не retryable */
export const WEBPAY_HTTP_STATUSES = {
  BAD_REQUEST: 400, // Неверный запрос
  UNAUTHORIZED: 401, // Не авторизован
  FORBIDDEN: 403, // Доступ запрещен
  NOT_FOUND: 404, // Не найдено
  CONFLICT: 409, // Конфликт
  UNPROCESSABLE_ENTITY: 422, // Невалидные данные
  TOO_MANY_REQUESTS: 429, // Слишком много запросов
  /** @description Server errors (5xx) - retryable */
  INTERNAL_SERVER_ERROR: 500, // Внутренняя ошибка сервера
  BAD_GATEWAY: 502, // Плохой шлюз
  SERVICE_UNAVAILABLE: 503, // Сервис недоступен
  GATEWAY_TIMEOUT: 504, // Таймаут шлюза
} as const;

export type WebPayHttpStatus = typeof WEBPAY_HTTP_STATUSES[keyof typeof WEBPAY_HTTP_STATUSES];

// ==================== HELPER FUNCTIONS FOR VALIDATION ====================

/** Проверяет, является ли значение строкой */
const isString = (value: unknown): value is string => typeof value === 'string';

/** Проверяет, является ли значение числом */
const isNumber = (value: unknown): value is number => typeof value === 'number';

/** Проверяет, является ли значение неотрицательным целым числом */
const isNonNegativeInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value >= 0;

/** Проверяет, является ли значение поддерживаемой валютой */
const isSupportedCurrency = (value: unknown): value is SupportedCurrency =>
  isString(value) && Object.values(SUPPORTED_CURRENCIES).includes(value as SupportedCurrency);

/** Проверяет, является ли значение поддерживаемым методом оплаты */
const isSupportedPaymentMethod = (value: unknown): value is SupportedPaymentMethod =>
  isString(value)
  && Object.values(SUPPORTED_PAYMENT_METHODS).includes(value as SupportedPaymentMethod);

// WebPay-специфичные коды ошибок
/** @description Client/card errors - не retryable */
export const WEBPAY_ERROR_CODES = {
  // CARD: Ошибки связанные с картой и аутентификацией
  INVALID_SIGNATURE: 'invalid_signature', // Неверная подпись
  CARD_EXPIRED: 'card_expired', // Карта истекла
  CARD_BLOCKED: 'card_blocked', // Карта заблокирована
  INVALID_CARD_NUMBER: 'invalid_card_number', // Неверный номер карты
  INVALID_CVV: 'invalid_cvv', // Неверный CVV

  // PAYMENT: Общие ошибки платежа
  PAYMENT_DECLINED: 'payment_declined', // Платеж отклонен
  INSUFFICIENT_FUNDS: 'insufficient_funds', // Недостаточно средств
  DUPLICATE_TRANSACTION: 'duplicate_transaction', // Дубликат транзакции

  // AMOUNT: Ошибки связанные с суммой
  AMOUNT_TOO_SMALL: 'amount_too_small', // Сумма слишком мала
  AMOUNT_TOO_LARGE: 'amount_too_large', // Сумма слишком велика
  CURRENCY_NOT_SUPPORTED: 'currency_not_supported', // Валюта не поддерживается

  // NETWORK: Инфраструктурные ошибки - retryable
  ISSUER_UNAVAILABLE: 'issuer_unavailable', // Эмитент недоступен
  ACQUIRER_ERROR: 'acquirer_error', // Ошибка эквайера
} as const;

export type WebPayErrorCode = typeof WEBPAY_ERROR_CODES[keyof typeof WEBPAY_ERROR_CODES];

// Статус транзакции WebPay (из API response)
export type WebPayTransactionStatus = 'success' | 'declined' | 'error' | 'processing';

// ==================== ERROR CODE CATEGORIES ====================

/** Категории WebPay кодов ошибок для фильтрации и логирования */
export const WEBPAY_ERROR_CATEGORIES = {
  /** Ошибки связанные с картой и аутентификацией */
  CARD: [
    WEBPAY_ERROR_CODES.INVALID_SIGNATURE,
    WEBPAY_ERROR_CODES.CARD_EXPIRED,
    WEBPAY_ERROR_CODES.CARD_BLOCKED,
    WEBPAY_ERROR_CODES.INVALID_CARD_NUMBER,
    WEBPAY_ERROR_CODES.INVALID_CVV,
  ] as readonly WebPayErrorCode[],

  /** Общие ошибки платежа */
  PAYMENT: [
    WEBPAY_ERROR_CODES.PAYMENT_DECLINED,
    WEBPAY_ERROR_CODES.INSUFFICIENT_FUNDS,
    WEBPAY_ERROR_CODES.DUPLICATE_TRANSACTION,
  ] as readonly WebPayErrorCode[],

  /** Ошибки связанные с суммой */
  AMOUNT: [
    WEBPAY_ERROR_CODES.AMOUNT_TOO_SMALL,
    WEBPAY_ERROR_CODES.AMOUNT_TOO_LARGE,
    WEBPAY_ERROR_CODES.CURRENCY_NOT_SUPPORTED,
  ] as readonly WebPayErrorCode[],

  /** Инфраструктурные ошибки (retryable) */
  NETWORK: [
    WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE,
    WEBPAY_ERROR_CODES.ACQUIRER_ERROR,
  ] as readonly WebPayErrorCode[],
} as const;

/** Все категории WebPay кодов ошибок */
export type WebPayErrorCategory = keyof typeof WEBPAY_ERROR_CATEGORIES;

/** Проверяет, относится ли код ошибки к указанной категории */
export function isWebPayErrorInCategory(
  code: WebPayErrorCode,
  category: WebPayErrorCategory,
): boolean {
  // eslint-disable-next-line security/detect-object-injection
  return WEBPAY_ERROR_CATEGORIES[category].includes(code);
}

/** Возвращает категорию WebPay кода ошибки */
export function getWebPayErrorCategory(code: WebPayErrorCode): WebPayErrorCategory | undefined {
  for (const [category, codes] of Object.entries(WEBPAY_ERROR_CATEGORIES)) {
    if (codes.includes(code)) {
      return category as WebPayErrorCategory;
    }
  }
  return undefined;
}

/** Фильтрует WebPay ошибки по категории */
export function filterWebPayErrorsByCategory(
  errors: readonly WebPayAPIError[],
  category: WebPayErrorCategory,
): WebPayAPIError[] {
  return errors.filter((error) => {
    const code = error.details?.webpayCode;
    return code !== undefined && isWebPayErrorInCategory(code, category);
  });
}

// Контекст ошибки WebPay API
export type WebPayAPIErrorContext = {
  /** HTTP статус ответа */
  readonly httpStatus?: WebPayHttpStatus;
  /** WebPay-специфичный код ошибки */
  readonly webpayCode?: WebPayErrorCode;
  /** Описание ошибки от WebPay */
  readonly webpayMessage?: string;
  /** ID транзакции в WebPay */
  readonly webpayTransactionId?: string;
  /** Статус транзакции WebPay */
  readonly transactionStatus?: WebPayTransactionStatus;
  /** Merchant order ID (ключевой идентификатор для WebPay) */
  readonly orderId?: string;
  /** Валюта операции */
  readonly currency?: SupportedCurrency;
  /** Сумма операции (в минимальных единицах) */
  readonly amount?: number;
  /** Метод оплаты */
  readonly paymentMethod?: SupportedPaymentMethod;
  /** Время ответа WebPay (мс) */
  readonly responseTimeMs?: number;
  /** Время ожидания перед повтором (мс) - для retry-менеджера */
  readonly retryAfterMs?: number;
  /** Endpoint WebPay, где произошла ошибка */
  readonly endpoint?: string;
  /** ID запроса для трассировки */
  readonly requestId?: string;
  /** Raw API response snapshot (для forensic/debug анализа) */
  readonly rawPayload?: unknown;
};

// TaggedError тип для ошибок WebPay API
export type WebPayAPIError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.HIGH;
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_WEBPAY_API_ERROR;
  readonly message: string;
  readonly details: WebPayAPIErrorContext | undefined;
  readonly timestamp: string;
}, 'WebPayAPIError'>;

// Создает WebPayAPIError с указанным сообщением, контекстом и timestamp
export function createWebPayAPIError(
  message: string,
  context?: WebPayAPIErrorContext,
  timestamp?: string,
): WebPayAPIError {
  const error = {
    _tag: 'WebPayAPIError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.HIGH,
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_WEBPAY_API_ERROR,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as const;

  // Логируем создание ошибки для centralized observability
  try {
    logger.error('WebPay API error created', {
      message,
      httpStatus: context?.httpStatus,
      webpayCode: context?.webpayCode,
      transactionId: context?.webpayTransactionId,
      endpoint: context?.endpoint,
      requestId: context?.requestId,
      timestamp: error.timestamp,
    });
  } catch {
    // Тихо игнорируем ошибки логгера, чтобы не ломать создание ошибки
    // В продакшене это должно обрабатываться полноценной системой логирования
  }

  return error;
}

// Проверяет валидность WebPayAPIErrorContext с полными типовыми проверками
export function isValidWebPayAPIErrorContext(context: unknown): context is WebPayAPIErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем опциональные поля с использованием helper функций
  if (
    ctx['httpStatus'] !== undefined
    && !Object.values(WEBPAY_HTTP_STATUSES).includes(ctx['httpStatus'] as WebPayHttpStatus)
  ) {
    return false;
  }
  if (
    ctx['webpayCode'] !== undefined
    && !Object.values(WEBPAY_ERROR_CODES).includes(ctx['webpayCode'] as WebPayErrorCode)
  ) {
    return false;
  }
  if (ctx['webpayMessage'] !== undefined && !isString(ctx['webpayMessage'])) return false;
  if (ctx['webpayTransactionId'] !== undefined && !isString(ctx['webpayTransactionId'])) {
    return false;
  }
  if (
    ctx['transactionStatus'] !== undefined
    && (!isString(ctx['transactionStatus'])
      || !['success', 'declined', 'error', 'processing'].includes(ctx['transactionStatus']))
  ) return false;
  if (ctx['orderId'] !== undefined && !isString(ctx['orderId'])) return false;
  if (ctx['currency'] !== undefined && !isSupportedCurrency(ctx['currency'])) return false;
  if (ctx['amount'] !== undefined && !isNonNegativeInteger(ctx['amount'])) return false;
  if (ctx['paymentMethod'] !== undefined && !isSupportedPaymentMethod(ctx['paymentMethod'])) {
    return false;
  }
  if (ctx['responseTimeMs'] !== undefined && !isNonNegativeInteger(ctx['responseTimeMs'])) {
    return false;
  }
  if (ctx['retryAfterMs'] !== undefined && !isNonNegativeInteger(ctx['retryAfterMs'])) return false;
  if (ctx['endpoint'] !== undefined && !isString(ctx['endpoint'])) return false;
  if (ctx['requestId'] !== undefined && !isString(ctx['requestId'])) return false;

  return true;
}

// Type guard для проверки WebPayAPIError с валидацией tag, code и details
export function isWebPayAPIError(error: unknown): error is WebPayAPIError {
  if (
    typeof error !== 'object'
    || error === null
    || !('_tag' in error)
    || !('code' in error)
    || !('details' in error)
  ) {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Проверяем основные поля ошибки
  const hasValidTag = err['_tag'] === 'WebPayAPIError';
  const hasValidCode = err['code'] === SERVICE_ERROR_CODES.SERVICE_BILLING_WEBPAY_API_ERROR;

  // Проверяем валидность контекста ошибки
  const hasValidDetails = isValidWebPayAPIErrorContext(err['details']);

  return hasValidTag && hasValidCode && hasValidDetails;
}

// Извлекает WebPay transaction ID из ошибки для tracing
export function getWebPayTransactionId(error: WebPayAPIError): string | undefined {
  return error.details?.webpayTransactionId;
}

// Извлекает HTTP статус из WebPay ошибки для retry логики
export function getWebPayHttpStatus(error: WebPayAPIError): WebPayHttpStatus | undefined {
  return error.details?.httpStatus;
}

// Извлекает WebPay код ошибки для категоризации и обработки
export function getWebPayErrorCode(error: WebPayAPIError): WebPayErrorCode | undefined {
  return error.details?.webpayCode;
}

// Извлекает статус транзакции WebPay для UI и decision engine
export function getWebPayTransactionStatus(
  error: WebPayAPIError,
): WebPayTransactionStatus | undefined {
  return error.details?.transactionStatus;
}

// Извлекает merchant order ID из WebPay ошибки для correlation
export function getWebPayOrderId(error: WebPayAPIError): string | undefined {
  return error.details?.orderId;
}

// Извлекает raw API payload для forensic/debug анализа
export function getWebPayRawPayload(error: WebPayAPIError): unknown {
  return error.details?.rawPayload;
}

// HTTP статусы, при которых ошибка считается повторяемой
const RETRYABLE_HTTP_STATUSES: readonly WebPayHttpStatus[] = [
  WEBPAY_HTTP_STATUSES.INTERNAL_SERVER_ERROR,
  WEBPAY_HTTP_STATUSES.BAD_GATEWAY,
  WEBPAY_HTTP_STATUSES.SERVICE_UNAVAILABLE,
  WEBPAY_HTTP_STATUSES.GATEWAY_TIMEOUT,
];

// WebPay коды ошибок, при которых ошибка считается повторяемой
const RETRYABLE_WEBPAY_CODES: readonly WebPayErrorCode[] = [
  WEBPAY_ERROR_CODES.ISSUER_UNAVAILABLE,
  WEBPAY_ERROR_CODES.ACQUIRER_ERROR,
];

// Определяет retryable статус ошибки на основе HTTP и WebPay кодов
export function isWebPayRetryableError(error: WebPayAPIError): boolean {
  const httpStatus = error.details?.httpStatus;
  const webpayCode = error.details?.webpayCode;

  // Повторяемые HTTP статусы
  if (httpStatus && RETRYABLE_HTTP_STATUSES.includes(httpStatus)) {
    return true;
  }

  // Повторяемые WebPay коды
  if (webpayCode && RETRYABLE_WEBPAY_CODES.includes(webpayCode)) {
    return true;
  }

  return false;
}

// Определяет card-related ошибки (не retryable) по WebPay кодам
export function isWebPayCardError(error: WebPayAPIError): boolean {
  const webpayCode = error.details?.webpayCode;

  const cardErrorCodes: readonly WebPayErrorCode[] = [
    'invalid_signature',
    'card_expired',
    'insufficient_funds',
    'card_blocked',
    'invalid_card_number',
    'invalid_cvv',
  ] as const;

  return webpayCode ? cardErrorCodes.includes(webpayCode) : false;
}
