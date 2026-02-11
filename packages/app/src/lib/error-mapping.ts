/**
 * @file packages/app/src/lib/error-mapping.ts
 * ============================================================================
 * 🔹 УНИВЕРСАЛЬНЫЙ МАППИНГ ОШИБОК
 * ============================================================================
 *
 * Цель:
 * - Универсальный mapper для любых DomainError (не только auth)
 * - Консолидировать обработку ошибок по всем микросервисам
 * - Строго типизированные коды ошибок
 * - Чистые, детерминированные мапперы
 * - Поддержка fallback и originError для telemetry и трассировки
 * - Расширяемость и локализация
 *
 * Принципы:
 * - Чистый TypeScript, без side-effects
 * - Domain-agnostic (работает с любыми DomainError)
 * - Микросервисно-ориентированный дизайн
 * - Максимальная безопасность и ясность
 */

import type { EffectError } from './effect-utils.js';
import { errorFireAndForget } from './telemetry.js';
import type { ISODateString } from '../types/common.js';
import type { AppError, ErrorBoundaryErrorCode, UnknownError } from '../types/errors.js';

/** Типизированная ошибка с кодом для маппинга */
export type TaggedError<T extends ServiceErrorCode = ServiceErrorCode> = {
  readonly code: T;
  readonly service?: ServicePrefix | undefined; // опциональный сервис для автоматического определения
};

/* ============================================================================
 * 🔧 RUNTIME CONFIGURATION
 * ========================================================================== */

/** Текущая локаль для сообщений об ошибках */
let currentLocale: string | undefined = undefined;

/**
 * Устанавливает текущую локаль для сообщений об ошибках
 * @param locale - код локали ('en', 'ru', etc.) или undefined для дефолтной
 */
export function setErrorLocale(locale: string | undefined): void {
  currentLocale = locale;
}

// Получает текущую локаль для сообщений об ошибках
export function getErrorLocale(): string | undefined {
  return currentLocale;
}

/* ============================================================================
 * 🧱 СЕРВИСНЫЕ ПРЕФИКСЫ
 * ========================================================================== */

export const SERVICES = {
  AUTH: 'AUTH',
  BILLING: 'BILLING',
  AI: 'AI',
  SYSTEM: 'SYSTEM', // для системных ошибок
  // добавлять новые сервисы здесь
} as const;

export type ServicePrefix = keyof typeof SERVICES;

export type ServiceErrorCode = `${ServicePrefix}_${string}`;

/* ============================================================================
 * 🧱 КОДЫ ОШИБОК
 * ========================================================================== */

export const errorMessages = {
  'AUTH_INVALID_TOKEN': (locale?: string) =>
    locale === 'en' ? 'Invalid token' : 'Токен недействителен',
  'AUTH_USER_NOT_FOUND': (locale?: string) =>
    locale === 'en' ? 'User not found' : 'Пользователь не найден',
  'BILLING_INSUFFICIENT_FUNDS': (locale?: string) =>
    locale === 'en' ? 'Insufficient funds' : 'Недостаточно средств на счете',
  'AI_MODEL_NOT_FOUND': (locale?: string) =>
    locale === 'en' ? 'AI model not found' : 'Модель AI не найдена',
  'SYSTEM_UNKNOWN_ERROR': (locale?: string) =>
    locale === 'en' ? 'Unknown error' : 'Неизвестная ошибка',
  'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID': (locale?: string) =>
    locale === 'en' ? 'Request schema validation failed' : 'Ошибка валидации схемы запроса',
  'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID': (locale?: string) =>
    locale === 'en' ? 'Response schema validation failed' : 'Ошибка валидации схемы ответа',
  'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE': (locale?: string) =>
    locale === 'en' ? 'Request payload too large' : 'Размер запроса превышает допустимый',
  'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE': (locale?: string) =>
    locale === 'en' ? 'Response payload too large' : 'Размер ответа превышает допустимый',
  'SYSTEM_VALIDATION_REQUEST_HEADERS_INVALID': (locale?: string) =>
    locale === 'en' ? 'Request headers validation failed' : 'Ошибка валидации заголовков запроса',
  'SYSTEM_VALIDATION_RESPONSE_HEADERS_INVALID': (locale?: string) =>
    locale === 'en' ? 'Response headers validation failed' : 'Ошибка валидации заголовков ответа',
  'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH': (locale?: string) =>
    locale === 'en' ? 'Schema version mismatch' : 'Несовпадение версии схемы',
  'SYSTEM_VALIDATION_TIMEOUT_EXCEEDED': (locale?: string) =>
    locale === 'en' ? 'Validation timeout exceeded' : 'Превышено время ожидания валидации',
} as const satisfies Record<ServiceErrorCode, (locale?: string) => string>;

/* ============================================================================
 * 🧱 МАППИНГ EFFECTERROR.KIND → SERVICE ERROR CODE
 * ========================================================================== */

export const kindToErrorCode = {
  'auth/invalid-token': 'AUTH_INVALID_TOKEN',
  'auth/user-not-found': 'AUTH_USER_NOT_FOUND',
  'billing/insufficient-funds': 'BILLING_INSUFFICIENT_FUNDS',
  'ai/model-not-found': 'AI_MODEL_NOT_FOUND',
} as const;

/* ============================================================================
 * 🧱 MappedError
 * ========================================================================== */

/** Расширенный объект ошибки для использования в runtime и telemetry */
export type MappedError<TDetails = unknown> = {
  readonly code: ServiceErrorCode;
  readonly message: string;
  readonly details?: TDetails | undefined;
  readonly originError?: Error | undefined; // оригинальная ошибка для дебага и трассировки
  readonly timestamp: number; // время генерации ошибки для трассировки
  readonly service?: ServicePrefix | undefined; // микросервис, где произошла ошибка
};

/* ============================================================================
 * 🔧 ПОЛЕЗНЫЕ HELPERS
 * ========================================================================== */

// Проверяет, что объект является TaggedError
function isTaggedError(err: unknown): err is TaggedError {
  return err !== null
    && err !== undefined
    && typeof err === 'object'
    && 'code' in (err as TaggedError);
}

// Получает код ошибки и сервис из TaggedError
function getErrorInfo(
  err: unknown,
): Readonly<{ code?: ServiceErrorCode; service?: ServicePrefix | undefined; }> {
  if (!isTaggedError(err)) return {};

  return {
    code: err.code, // Благодаря namespaced типу, код уже гарантированно корректный
    service: err.service, // Автоматическое определение сервиса
  };
}

// Проверяет, что код ошибки существует в справочнике сообщений
function isValidErrorCode(code: string): code is ServiceErrorCode {
  return code in errorMessages;
}

// Проверяет, что объект является EffectError
function isEffectError(err: unknown): err is EffectError {
  return err !== null
    && err !== undefined
    && typeof err === 'object'
    && 'kind' in (err as EffectError);
}

/* ============================================================================
 * 🎯 МАППЕР ОШИБОК
 * ========================================================================== */

/**
 * Универсальный mapper для любых DomainError.
 * Преобразует любую ошибку в MappedError:
 * - Использует код ошибки TaggedError или EffectError если есть
 * - Фолбек на UNKNOWN_ERROR
 * - Сохраняет оригинальную ошибку для telemetry
 * - Работает с любыми доменными ошибками (auth, billing, chat, bots и т.д.)
 */
export function mapError<TDetails = unknown>(
  err: unknown,
  details?: TDetails,
  locale?: string,
  service?: ServicePrefix,
): MappedError<TDetails>;

export function mapError<TDetails = unknown>(
  err: unknown,
  details?: TDetails,
  locale?: string,
  service?: ServicePrefix,
): MappedError<TDetails> {
  // Используем переданный locale или из конфига с fallback на 'ru'
  const effectiveLocale = locale ?? getErrorLocale() ?? 'ru';

  // Сначала проверяем TaggedError с кодом и автоматическим определением сервиса
  const errorInfo = getErrorInfo(err);
  let code = errorInfo.code;
  let detectedService = errorInfo.service;

  // Если не нашли код, проверяем EffectError с kind
  if (code === undefined && isEffectError(err) && typeof err.kind === 'string') {
    if (err.kind in kindToErrorCode) {
      code = kindToErrorCode[err.kind as keyof typeof kindToErrorCode];
    }

    // Универсальное определение сервиса из kind (например, 'auth/...' -> 'AUTH', 'billing/...' -> 'BILLING')
    // Работает для любого сервиса из SERVICES
    if (typeof err.kind === 'string') {
      const kindPrefix = err.kind.split('/')[0]?.toUpperCase();
      if (kindPrefix != null && kindPrefix !== '' && kindPrefix in SERVICES) {
        detectedService = kindPrefix as ServicePrefix;
      }
    }
  }

  // Используем переданный сервис или автоматически определенный
  const finalService = service ?? detectedService;
  const mappedCode = code ?? 'SYSTEM_UNKNOWN_ERROR';

  // Логируем mapped ошибку для observability
  errorFireAndForget('Error mapped', {
    code: mappedCode,
    originalErrorType: err instanceof Error ? err.constructor.name : typeof err,
    service: finalService ?? 'UNKNOWN_SERVICE',
    ...(details !== undefined && details !== null && { details }),
  });

  return {
    code: mappedCode,
    message: code !== undefined && isValidErrorCode(code)
      ? errorMessages[code as keyof typeof errorMessages](effectiveLocale)
      : errorMessages.SYSTEM_UNKNOWN_ERROR(effectiveLocale),
    details,
    originError: err instanceof Error ? err : undefined,
    timestamp: Date.now(),
    service: finalService,
  };
}

/**
 * Преобразует Error в AppError для error-boundary компонента
 * Используется для унифицированной обработки ошибок в UI слое
 */
export function mapErrorBoundaryError(error: Error, telemetryEnabled = true): AppError {
  // Определяем тип ошибки по сообщению для унифицированной обработки
  let errorCode: ErrorBoundaryErrorCode = 'UNKNOWN_ERROR';

  if (error.message.includes('Network') || error.message.includes('fetch')) {
    errorCode = 'NETWORK_ERROR';
  } else if (error.message.includes('Validation') || error.message.includes('validation')) {
    errorCode = 'VALIDATION_ERROR';
  }

  // Логируем маппинг ошибки для observability (только если telemetry включена)
  if (telemetryEnabled) {
    try {
      errorFireAndForget('ErrorBoundary error mapped', {
        originalErrorType: error.constructor.name,
        mappedErrorCode: errorCode as string, // ErrorBoundaryErrorCode
        errorMessage: error.message,
      });
    } catch (telemetryError) {
      // Игнорируем ошибки telemetry, чтобы не ломать UI
      // eslint-disable-next-line no-console
      console.warn('ErrorBoundary mapping telemetry failed:', telemetryError);
    }
  }

  // Создаем UnknownError с соответствующими полями
  // В будущем можно расширить для возврата разных типов AppError
  const appError: UnknownError = {
    type: 'UnknownError',
    severity: 'error',
    message: error.message,
    original: error,
    timestamp: new Date().toISOString() as ISODateString,
  };

  return appError;
}

/* ============================================================================
 * 🔄 CHAINABLE МАППЕРЫ (опционально)
 * ========================================================================== */

// Позволяет комбинировать несколько мапперов
export type ErrorMapper<TDetails = unknown> = (
  err: unknown,
  details?: TDetails,
  locale?: string,
  service?: ServicePrefix,
) => MappedError<TDetails>;

export function chainMappers<TDetails = unknown>(
  ...mappers: ErrorMapper<TDetails>[]
): ErrorMapper<TDetails> {
  return (
    err: unknown,
    details?: TDetails,
    locale?: string,
    service?: ServicePrefix,
  ): MappedError<TDetails> => {
    for (const mapper of mappers) {
      const mapped = mapper(err, details, locale, service);
      if (mapped.code !== 'SYSTEM_UNKNOWN_ERROR') return mapped;
    }
    return {
      code: 'SYSTEM_UNKNOWN_ERROR',
      message: errorMessages.SYSTEM_UNKNOWN_ERROR(locale ?? getErrorLocale() ?? 'ru'),
      originError: err instanceof Error ? err : undefined,
      details,
      timestamp: Date.now(),
      service,
    };
  };
}
