/**
 * @file BePaidAPIError.ts - API ошибки BePaid для LivAiBot Billing Service
 *
 * Специфичные ошибки BePaid платежного агрегатора согласно официальной API спецификации.
 * Один из основных белорусских провайдеров для LivAiBot с поддержкой BYN/RUB/USD/EUR.
 *
 * BePaid особенности (docs.bepaid.by):
 * - Полнофункциональный API с поддержкой платежей, токенизации, подписок, payouts, P2P
 * - Комиссия: 1.8–2.5% + фикс.
 * - Поддержка: карты, интернет-банкинг, ЕРИП, APM, 3D Secure, Smart Routing
 * - PCI DSS Level 1 compliance
 * - Детальная система кодов ошибок (S.xxxx, F.xxxx, E.xxxx)
 *
 * Структура ошибок:
 * - message: человекочитаемое описание
 * - errors.system: детальные причины по полям
 * - code: специфичный код ошибки (F.0102, E.1003 и т.д.)
 * - rawResponse: полный snapshot API ответа (для forensic анализа)
 *
 * Архитектурный код ошибки: SERVICE_BILLING_107 (SERVICE_BILLING_BEPAID_API_ERROR)
 */

import { SERVICE_ERROR_CODES } from '../../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';
import { SUPPORTED_CURRENCIES, SUPPORTED_PAYMENT_METHODS } from '../domain/index.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { SupportedCurrency, SupportedPaymentMethod } from '../domain/index.js';

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

// HTTP статусы BePaid API (для metadata)
/** @description Client errors (4xx) - не retryable */
export const BEPAID_HTTP_STATUSES = {
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

export type BePaidHttpStatus = typeof BEPAID_HTTP_STATUSES[keyof typeof BEPAID_HTTP_STATUSES];

// BePaid-специфичные коды ошибок согласно официальной API спецификации
/** @description BePaid error codes based on official API specification */
export const BEPAID_ERROR_CODES = {
  // SUCCESS CODES
  SUCCESS: 'S.0000', // Транзакция успешно выполнена

  // SYSTEM ERRORS (S.xxxx, F.xxxx, E.xxxx)
  SYSTEM_ERROR: 'S.9999', // Системная ошибка

  // PROCESSING ERRORS (F.0100–F.0999) - Ошибки по операциям с картами
  PROCESSING_AUTH_ERROR: 'F.0102', // Authorization error
  PROCESSING_CARD_DECLINE: 'F.0103', // Card decline
  PROCESSING_INSUFFICIENT_FUNDS: 'F.0114', // Insufficient funds
  PROCESSING_CARD_EXPIRED: 'F.0111', // Card expired
  PROCESSING_INVALID_CVV: 'F.0112', // CVV verification failed
  PROCESSING_INVALID_CARD: 'F.0115', // Invalid card number
  PROCESSING_CARD_BLOCKED: 'F.0116', // Card blocked

  // ALTERNATIVE PAYMENT METHODS (F.0200–F.0399) - APM ошибки
  APM_ORDER_NOT_FOUND: 'F.0204', // Order ID not found
  APM_CURRENCY_NOT_SUPPORTED: 'F.0214', // Currency not supported
  APM_METHOD_NOT_SUPPORTED: 'F.0220', // Payment method not supported

  // VALIDATION ERRORS (E.1000–E.1899) - Ошибки валидации запросов
  VALIDATION_UNKNOWN_METHOD: 'E.1000', // Unknown payment method
  VALIDATION_INVALID_URL: 'E.1001', // Invalid URL
  VALIDATION_GATEWAY_NOT_FOUND: 'E.1003', // gateway_id not found
  VALIDATION_UNSUPPORTED_CURRENCY: 'E.1007', // Unsupported currency
  VALIDATION_INVALID_AMOUNT: 'E.1010', // Invalid amount
  VALIDATION_MISSING_PARAMETER: 'E.1020', // Missing required parameter

  // ALTERNATIVE PAYMENT VALIDATION (E.0600–E.0999) - APM валидация
  APM_VALIDATION_SHOP_NOT_FOUND: 'E.0604', // Shop not found
  APM_VALIDATION_INVALID_TOKEN: 'E.0630', // Invalid payment token
  APM_VALIDATION_ORDER_EXISTS: 'E.0650', // Order already exists

  // 3-D SECURE ERRORS (F.4001–F.4999) - 3DS ошибки
  THREEDS_AUTH_FAILED: 'F.4001', // Card authentication failed
  THREEDS_NOT_ENROLLED: 'F.4002', // Card is not enrolled
  THREEDS_INVALID_PARAMS: 'F.4005', // Invalid 3DS parameters
  THREEDS_TIMEOUT: 'F.4010', // 3DS timeout

  // SMART ROUTING ERRORS (F.2001–F.3999) - Маршрутизация
  ROUTING_CONNECTION_ERROR: 'F.2001', // SmartRouting - Connection error
  ROUTING_GATEWAY_UNAVAILABLE: 'F.2005', // Gateway unavailable
  ROUTING_RATE_LIMIT: 'F.2010', // Rate limit exceeded

  // DUPLICATE AND SUBSCRIPTION ERRORS
  DUPLICATE_TRANSACTION: 'F.0300', // Duplicate transaction
  SUBSCRIPTION_ERROR: 'F.0501', // Subscription error
  SUBSCRIPTION_NOT_FOUND: 'F.0502', // Subscription not found

  // RISK AND SECURITY
  RISK_DECLINE: 'F.0601', // Risk decline
  FRAUD_DETECTED: 'F.0605', // Fraud detected
  SECURITY_VIOLATION: 'F.0610', // Security violation
} as const;

export type BePaidErrorCode = typeof BEPAID_ERROR_CODES[keyof typeof BEPAID_ERROR_CODES];

// Контекст ошибки BePaid API согласно официальной спецификации
export type BePaidAPIErrorContext = {
  /** HTTP статус ответа */
  readonly httpStatus?: BePaidHttpStatus;
  /** BePaid-специфичный код ошибки (F.xxxx, E.xxxx, S.xxxx) */
  readonly bepaidCode?: BePaidErrorCode;
  /** Описание ошибки от BePaid (message) */
  readonly bepaidMessage?: string;
  /** Детальные ошибки по полям согласно BePaid API структуре */
  readonly bepaidErrors?: {
    /** Системные ошибки (errors.system) */
    system?: string[];
    /** Ошибки валидации (errors.validation) */
    validation?: string[];
    /** APM специфичные ошибки (errors.apm) */
    apm?: string[];
    /** Другие типы ошибок */
    [key: string]: string[] | undefined;
  };
  /** ID транзакции в BePaid */
  readonly bepaidTransactionId?: string;
  /** BePaid tracking ID */
  readonly trackingId?: string;
  /** Transaction state */
  readonly transactionState?: string;
  /** Валюта операции */
  readonly currency?: SupportedCurrency;
  /** Сумма операции (в минимальных единицах) */
  readonly amount?: number;
  /** Метод оплаты */
  readonly paymentMethod?: SupportedPaymentMethod;
  /** Время ответа BePaid (мс) */
  readonly responseTimeMs?: number;
  /** Время ожидания перед повтором (мс) - для retry-менеджера */
  readonly retryAfterMs?: number;
  /** Endpoint BePaid, где произошла ошибка */
  readonly endpoint?: string;
  /** ID запроса для трассировки */
  readonly requestId?: string;
  /** BePaid gateway ID */
  readonly gatewayId?: string;
  /** BePaid shop ID */
  readonly shopId?: string;
  /** BePaid order ID */
  readonly orderId?: string;
  /** 3D Secure статус */
  readonly threeDsStatus?: string;
  /** Provider specific code (оригинальный код от провайдера) */
  readonly providerCode?: string;
  /** Raw API response snapshot (для forensic/debug анализа) */
  readonly rawResponse?: unknown;
};

// TaggedError тип для ошибок BePaid API
export type BePaidAPIError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
  readonly severity: typeof ERROR_SEVERITY.HIGH;
  readonly code: typeof SERVICE_ERROR_CODES.SERVICE_BILLING_BEPAID_API_ERROR;
  readonly message: string;
  readonly details: BePaidAPIErrorContext | undefined;
  readonly timestamp: string;
}, 'BePaidAPIError'>;

// ==================== HELPER FUNCTIONS FOR VALIDATION ====================

/** Проверяет, является ли объект допустимым BePaidAPIErrorContext */
export function isValidBePaidAPIErrorContext(context: unknown): context is BePaidAPIErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем опциональные поля с использованием helper функций
  if (
    ctx['httpStatus'] !== undefined
    && !Object.values(BEPAID_HTTP_STATUSES).includes(ctx['httpStatus'] as BePaidHttpStatus)
  ) {
    return false;
  }
  if (
    ctx['bepaidCode'] !== undefined
    && !Object.values(BEPAID_ERROR_CODES).includes(ctx['bepaidCode'] as BePaidErrorCode)
  ) {
    return false;
  }
  if (ctx['bepaidMessage'] !== undefined && !isString(ctx['bepaidMessage'])) return false;
  if (ctx['bepaidErrors'] !== undefined) {
    if (typeof ctx['bepaidErrors'] !== 'object' || ctx['bepaidErrors'] === null) return false;
    // Валидируем структуру bepaidErrors - каждый ключ должен иметь массив строк
    const errors = ctx['bepaidErrors'] as Record<string, unknown>;
    const errorValues = Object.values(errors);
    if (
      !errorValues.every((value) =>
        Array.isArray(value) && value.every((item) => typeof item === 'string')
      )
    ) {
      return false;
    }
  }
  if (ctx['bepaidTransactionId'] !== undefined && !isString(ctx['bepaidTransactionId'])) {
    return false;
  }
  if (ctx['trackingId'] !== undefined && !isString(ctx['trackingId'])) return false;
  if (ctx['transactionState'] !== undefined && !isString(ctx['transactionState'])) return false;
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
  if (ctx['gatewayId'] !== undefined && !isString(ctx['gatewayId'])) return false;
  if (ctx['shopId'] !== undefined && !isString(ctx['shopId'])) return false;
  if (ctx['orderId'] !== undefined && !isString(ctx['orderId'])) return false;
  if (ctx['threeDsStatus'] !== undefined && !isString(ctx['threeDsStatus'])) return false;
  if (ctx['providerCode'] !== undefined && !isString(ctx['providerCode'])) return false;

  return true;
}

// Создает BePaidAPIError с указанным сообщением, контекстом и timestamp
export function createBePaidAPIError(
  message: string,
  context?: BePaidAPIErrorContext,
  timestamp?: string,
): BePaidAPIError {
  const error = {
    _tag: 'BePaidAPIError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.HIGH,
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_BEPAID_API_ERROR,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as const;

  // Логируем создание ошибки для centralized observability
  try {
    logger.error('BePaid API error created', {
      message,
      httpStatus: context?.httpStatus,
      bepaidCode: context?.bepaidCode,
      transactionId: context?.bepaidTransactionId,
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

// Type guard для проверки BePaidAPIError с валидацией tag, code и details
export function isBePaidAPIError(error: unknown): error is BePaidAPIError {
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
  const hasValidTag = err['_tag'] === 'BePaidAPIError';
  const hasValidCode = err['code'] === SERVICE_ERROR_CODES.SERVICE_BILLING_BEPAID_API_ERROR;

  // Проверяем валидность контекста ошибки
  const hasValidDetails = isValidBePaidAPIErrorContext(err['details']);

  return hasValidTag && hasValidCode && hasValidDetails;
}

// Извлекает BePaid transaction ID из ошибки для tracing
export function getBePaidTransactionId(error: BePaidAPIError): string | undefined {
  return error.details?.bepaidTransactionId;
}

// Извлекает HTTP статус из BePaid ошибки для retry логики
export function getBePaidHttpStatus(error: BePaidAPIError): BePaidHttpStatus | undefined {
  return error.details?.httpStatus;
}

// Извлекает BePaid код ошибки для категоризации и обработки
export function getBePaidErrorCode(error: BePaidAPIError): BePaidErrorCode | undefined {
  return error.details?.bepaidCode;
}

// ==================== ERROR CODE CATEGORIES ====================

/** Категории BePaid кодов ошибок согласно официальной API спецификации */
export const BEPAID_ERROR_CATEGORIES = {
  /** System and Success codes */
  SYSTEM: [
    BEPAID_ERROR_CODES.SUCCESS,
    BEPAID_ERROR_CODES.SYSTEM_ERROR,
  ] as readonly BePaidErrorCode[],

  /** Card Processing Errors (F.0100–F.0999) */
  CARD_PROCESSING: [
    BEPAID_ERROR_CODES.PROCESSING_AUTH_ERROR,
    BEPAID_ERROR_CODES.PROCESSING_CARD_DECLINE,
    BEPAID_ERROR_CODES.PROCESSING_INSUFFICIENT_FUNDS,
    BEPAID_ERROR_CODES.PROCESSING_CARD_EXPIRED,
    BEPAID_ERROR_CODES.PROCESSING_INVALID_CVV,
    BEPAID_ERROR_CODES.PROCESSING_INVALID_CARD,
    BEPAID_ERROR_CODES.PROCESSING_CARD_BLOCKED,
  ] as readonly BePaidErrorCode[],

  /** Alternative Payment Methods (F.0200–F.0399) */
  APM: [
    BEPAID_ERROR_CODES.APM_ORDER_NOT_FOUND,
    BEPAID_ERROR_CODES.APM_CURRENCY_NOT_SUPPORTED,
    BEPAID_ERROR_CODES.APM_METHOD_NOT_SUPPORTED,
  ] as readonly BePaidErrorCode[],

  /** Validation Errors (E.1000–E.1899) */
  VALIDATION: [
    BEPAID_ERROR_CODES.VALIDATION_UNKNOWN_METHOD,
    BEPAID_ERROR_CODES.VALIDATION_INVALID_URL,
    BEPAID_ERROR_CODES.VALIDATION_GATEWAY_NOT_FOUND,
    BEPAID_ERROR_CODES.VALIDATION_UNSUPPORTED_CURRENCY,
    BEPAID_ERROR_CODES.VALIDATION_INVALID_AMOUNT,
    BEPAID_ERROR_CODES.VALIDATION_MISSING_PARAMETER,
  ] as readonly BePaidErrorCode[],

  /** Alternative Payment Validation (E.0600–E.0999) */
  APM_VALIDATION: [
    BEPAID_ERROR_CODES.APM_VALIDATION_SHOP_NOT_FOUND,
    BEPAID_ERROR_CODES.APM_VALIDATION_INVALID_TOKEN,
    BEPAID_ERROR_CODES.APM_VALIDATION_ORDER_EXISTS,
  ] as readonly BePaidErrorCode[],

  /** 3-D Secure Errors (F.4001–F.4999) */
  THREEDS: [
    BEPAID_ERROR_CODES.THREEDS_AUTH_FAILED,
    BEPAID_ERROR_CODES.THREEDS_NOT_ENROLLED,
    BEPAID_ERROR_CODES.THREEDS_INVALID_PARAMS,
    BEPAID_ERROR_CODES.THREEDS_TIMEOUT,
  ] as readonly BePaidErrorCode[],

  /** Smart Routing Errors (F.2001–F.3999) */
  ROUTING: [
    BEPAID_ERROR_CODES.ROUTING_CONNECTION_ERROR,
    BEPAID_ERROR_CODES.ROUTING_GATEWAY_UNAVAILABLE,
    BEPAID_ERROR_CODES.ROUTING_RATE_LIMIT,
  ] as readonly BePaidErrorCode[],

  /** Subscription and Duplicate Errors */
  SUBSCRIPTION: [
    BEPAID_ERROR_CODES.DUPLICATE_TRANSACTION,
    BEPAID_ERROR_CODES.SUBSCRIPTION_ERROR,
    BEPAID_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
  ] as readonly BePaidErrorCode[],

  /** Risk and Security Errors */
  SECURITY: [
    BEPAID_ERROR_CODES.RISK_DECLINE,
    BEPAID_ERROR_CODES.FRAUD_DETECTED,
    BEPAID_ERROR_CODES.SECURITY_VIOLATION,
  ] as readonly BePaidErrorCode[],
} as const;

/** Все категории BePaid кодов ошибок */
export type BePaidErrorCategory = keyof typeof BEPAID_ERROR_CATEGORIES;

/** Проверяет, относится ли код ошибки к указанной категории */
export function isBePaidErrorInCategory(
  code: BePaidErrorCode,
  category: BePaidErrorCategory,
): boolean {
  const categoryCodes = getBePaidCategoryCodes(category);
  return categoryCodes.includes(code);
}

/** Возвращает категорию BePaid кода ошибки */
export function getBePaidErrorCategory(code: BePaidErrorCode): BePaidErrorCategory | undefined {
  for (const [category, codes] of Object.entries(BEPAID_ERROR_CATEGORIES)) {
    if (codes.includes(code)) {
      return category as BePaidErrorCategory;
    }
  }
  return undefined;
}

/** Безопасно получает коды ошибок для категории */
function getBePaidCategoryCodes(category: BePaidErrorCategory): readonly BePaidErrorCode[] {
  switch (category) {
    case 'SYSTEM':
      return BEPAID_ERROR_CATEGORIES.SYSTEM;
    case 'CARD_PROCESSING':
      return BEPAID_ERROR_CATEGORIES.CARD_PROCESSING;
    case 'APM':
      return BEPAID_ERROR_CATEGORIES.APM;
    case 'VALIDATION':
      return BEPAID_ERROR_CATEGORIES.VALIDATION;
    case 'APM_VALIDATION':
      return BEPAID_ERROR_CATEGORIES.APM_VALIDATION;
    case 'THREEDS':
      return BEPAID_ERROR_CATEGORIES.THREEDS;
    case 'ROUTING':
      return BEPAID_ERROR_CATEGORIES.ROUTING;
    case 'SUBSCRIPTION':
      return BEPAID_ERROR_CATEGORIES.SUBSCRIPTION;
    case 'SECURITY':
      return BEPAID_ERROR_CATEGORIES.SECURITY;
    default:
      return [];
  }
}

/** Фильтрует BePaid ошибки по категории */
export function filterBePaidErrorsByCategory(
  errors: readonly BePaidAPIError[],
  category: BePaidErrorCategory,
): BePaidAPIError[] {
  return errors.filter((error) => {
    const code = error.details?.bepaidCode;
    return code !== undefined && isBePaidErrorInCategory(code, category);
  });
}

/** HTTP статусы, при которых ошибка считается повторяемой */
const RETRYABLE_HTTP_STATUSES: readonly BePaidHttpStatus[] = [
  BEPAID_HTTP_STATUSES.INTERNAL_SERVER_ERROR,
  BEPAID_HTTP_STATUSES.BAD_GATEWAY,
  BEPAID_HTTP_STATUSES.SERVICE_UNAVAILABLE,
  BEPAID_HTTP_STATUSES.GATEWAY_TIMEOUT,
];

/** BePaid коды ошибок, при которых ошибка считается повторяемой */
const RETRYABLE_BEPAID_CODES: readonly BePaidErrorCode[] = [
  // ROUTING ошибки - инфраструктурные проблемы (retryable)
  ...BEPAID_ERROR_CATEGORIES.ROUTING,
  // SYSTEM ошибки - общие системные проблемы (retryable)
  BEPAID_ERROR_CODES.SYSTEM_ERROR,
];

// Определяет retryable статус ошибки на основе HTTP и BePaid кодов
export function isBePaidRetryableError(error: BePaidAPIError): boolean {
  const httpStatus = error.details?.httpStatus;
  const bepaidCode = error.details?.bepaidCode;

  // Повторяемые HTTP статусы
  if (httpStatus && RETRYABLE_HTTP_STATUSES.includes(httpStatus)) {
    return true;
  }

  // Повторяемые BePaid коды
  if (bepaidCode && RETRYABLE_BEPAID_CODES.includes(bepaidCode)) {
    return true;
  }

  return false;
}

// Определяет card-related ошибки (не retryable) по BePaid кодам
export function isBePaidCardError(error: BePaidAPIError): boolean {
  const bepaidCode = error.details?.bepaidCode;

  // Используем CARD_PROCESSING категорию из официальной спецификации
  const cardErrorCodes = BEPAID_ERROR_CATEGORIES.CARD_PROCESSING;

  return bepaidCode ? cardErrorCodes.includes(bepaidCode) : false;
}

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
      `[BePaidAPIError] ${message}`,
      context ? JSON.stringify(context, null, JSON_INDENT) : '',
    );
  },
  warn: (message: string, context?: Record<string, unknown>): void => {
    console.warn(
      `[BePaidAPIError] ${message}`,
      context ? JSON.stringify(context, null, JSON_INDENT) : '',
    );
  },
  info: (message: string, context?: Record<string, unknown>): void => {
    console.info(
      `[BePaidAPIError] ${message}`,
      context ? JSON.stringify(context, null, JSON_INDENT) : '',
    );
  },
});

/** Экземпляр centralized logger (можно заменить в runtime) */
let logger = createCentralizedLogger();

/** Получить текущий logger */
export const getBePaidLogger = (): CentralizedLogger => logger;

/** Заменяет logger на кастомную реализацию для интеграции с monitoring системами */
export const setBePaidLogger = (customLogger: CentralizedLogger): void => {
  logger = customLogger;
};
