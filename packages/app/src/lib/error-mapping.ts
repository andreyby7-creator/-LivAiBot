/**
 * @file packages/app/src/lib/error-mapping.ts
 * ============================================================================
 * 🔹 УНИВЕРСАЛЬНЫЙ МАППИНГ ОШИБОК
 * ============================================================================
 * Цель:
 * - Универсальный mapper для любых DomainError (не только auth)
 * - Консолидировать обработку ошибок по всем микросервисам
 * - Строго типизированные коды ошибок
 * - Чистые, детерминированные мапперы
 * - Поддержка fallback и originError для telemetry и трассировки
 * - Расширяемость и локализация
 * Принципы:
 * - Чистый TypeScript, без side-effects
 * - Domain-agnostic (работает с любыми DomainError)
 * - Микросервисно-ориентированный дизайн
 * - Максимальная безопасность и ясность
 * - Детерминированность: все параметры передаются явно
 */

import type { EffectError } from './effect-utils.js';
import type { ISODateString } from '../types/common.js';
import type { AppError, ErrorBoundaryErrorCode, UnknownError } from '../types/errors.js';

/** Типизированная ошибка с кодом для маппинга */
export type TaggedError<T extends ServiceErrorCode = ServiceErrorCode> = {
  readonly code: T;
  readonly service?: ServicePrefix | undefined; // опциональный сервис для автоматического определения
};

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

/**
 * Опциональный маппинг EffectError.kind → ServiceErrorCode.
 * Может быть расширен для поддержки новых сервисов.
 * Если kind не найден в маппинге, используется универсальное определение сервиса из префикса kind.
 */
export const kindToErrorCode: Partial<Record<string, ServiceErrorCode>> = {
  'auth/invalid-token': 'AUTH_INVALID_TOKEN',
  'auth/user-not-found': 'AUTH_USER_NOT_FOUND',
  'billing/insufficient-funds': 'BILLING_INSUFFICIENT_FUNDS',
  'ai/model-not-found': 'AI_MODEL_NOT_FOUND',
} as const;

/* ============================================================================
 * 🧱 MappedError
 * ========================================================================== */

/** Безопасное представление оригинальной ошибки без stack trace */
export type SafeOriginError = {
  readonly name: string;
  readonly message: string;
};

/** Расширенный объект ошибки для использования в runtime и telemetry */
export type MappedError<TDetails = unknown> = {
  readonly code: ServiceErrorCode;
  readonly message: string;
  readonly details?: TDetails | undefined;
  readonly originError?: SafeOriginError | undefined; // безопасное представление оригинальной ошибки (без stack trace)
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

/** Конфигурация для mapError (детерминированная, без side-effects) */
export type MapErrorConfig = {
  readonly locale: string; // локаль для сообщений (обязательна для детерминированности)
  readonly timestamp: number; // время генерации ошибки (обязательно для детерминированности)
};

/**
 * Универсальный mapper для любых DomainError.
 * Преобразует любую ошибку в MappedError:
 * - Использует код ошибки TaggedError или EffectError если есть
 * - Фолбек на UNKNOWN_ERROR
 * - Сохраняет безопасное представление оригинальной ошибки (без stack trace)
 * - Работает с любыми доменными ошибками (auth, billing, chat, bots и т.д.)
 * - Pure функция: не имеет side-effects, детерминирована
 * @param err - Ошибка для маппинга
 * @param details - Дополнительные детали ошибки
 * @param config - Конфигурация маппинга (locale, timestamp) - обязательна для детерминированности
 * @param service - Опциональный сервис (автоматически определяется если не передан)
 * @returns MappedError с детерминированным timestamp и безопасным originError
 */
export function mapError<TDetails = unknown>(
  err: unknown,
  details: TDetails | undefined,
  config: MapErrorConfig,
  service?: ServicePrefix,
): MappedError<TDetails> {
  const effectiveLocale = config.locale;

  // Сначала проверяем TaggedError с кодом и автоматическим определением сервиса
  const errorInfo = getErrorInfo(err);
  let code = errorInfo.code;
  let detectedService = errorInfo.service;

  // Если не нашли код, проверяем EffectError с kind
  if (code === undefined && isEffectError(err) && typeof err.kind === 'string') {
    // Проверяем опциональный маппинг kind → code
    const mappedCode = kindToErrorCode[err.kind];
    if (mappedCode != null) {
      code = mappedCode;
    }

    // Универсальное определение сервиса из kind (например, 'auth/...' -> 'AUTH', 'billing/...' -> 'BILLING')
    // Работает для любого сервиса из SERVICES
    const kindParts = err.kind.split('/');
    const kindPrefix = kindParts.length > 0 && kindParts[0] != null && kindParts[0] !== ''
      ? kindParts[0].toUpperCase()
      : undefined;
    if (kindPrefix != null && kindPrefix in SERVICES) {
      detectedService = kindPrefix as ServicePrefix;
    }
  }

  // Используем переданный сервис или автоматически определенный
  const finalService = service ?? detectedService;
  const mappedCode = code ?? 'SYSTEM_UNKNOWN_ERROR';

  // Создаем безопасное представление оригинальной ошибки (без stack trace)
  const safeOriginError: SafeOriginError | undefined = err instanceof Error
    ? {
      name: err.constructor.name,
      message: err.message,
    }
    : undefined;

  return {
    code: mappedCode,
    message: code !== undefined && isValidErrorCode(code)
      ? errorMessages[code as keyof typeof errorMessages](effectiveLocale)
      : errorMessages.SYSTEM_UNKNOWN_ERROR(effectiveLocale),
    details,
    originError: safeOriginError,
    timestamp: config.timestamp,
    service: finalService,
  };
}

/** Конфигурация для mapErrorBoundaryError (детерминированная, без side-effects) */
export type MapErrorBoundaryConfig = {
  readonly timestamp: ISODateString; // ISO строка времени (обязательна для детерминированности)
};

/** Данные для telemetry после маппинга error-boundary ошибки */
export type ErrorBoundaryTelemetryData = {
  readonly originalErrorType: string;
  readonly mappedErrorCode: ErrorBoundaryErrorCode;
  readonly errorMessage: string;
};

/** Результат маппинга error-boundary ошибки */
export type MapErrorBoundaryResult = {
  readonly appError: AppError;
  readonly telemetryData: ErrorBoundaryTelemetryData;
};

/**
 * Преобразует Error в AppError для error-boundary компонента.
 * Используется для унифицированной обработки ошибок в UI слое.
 * Pure функция: не имеет side-effects, детерминирована.
 * @param error - Ошибка для маппинга
 * @param config - Конфигурация маппинга (timestamp)
 * @returns Результат маппинга с AppError и данными для telemetry
 */
export function mapErrorBoundaryError(
  error: Error,
  config: MapErrorBoundaryConfig,
): MapErrorBoundaryResult {
  // Определяем тип ошибки по сообщению для унифицированной обработки
  let errorCode: ErrorBoundaryErrorCode = 'UNKNOWN_ERROR';
  const messageLower = error.message.toLowerCase();

  if (messageLower.includes('network') || messageLower.includes('fetch')) {
    errorCode = 'NETWORK_ERROR';
  } else if (messageLower.includes('validation')) {
    errorCode = 'VALIDATION_ERROR';
  }

  // Создаем UnknownError с соответствующими полями
  // В будущем можно расширить для возврата разных типов AppError
  const appError: UnknownError = {
    type: 'UnknownError',
    severity: 'error',
    message: error.message,
    original: error,
    timestamp: config.timestamp,
  };

  // Возвращаем данные для telemetry (вызывается снаружи)
  const telemetryData: ErrorBoundaryTelemetryData = {
    originalErrorType: error.constructor.name,
    mappedErrorCode: errorCode,
    errorMessage: error.message,
  };

  return {
    appError,
    telemetryData,
  };
}

/* ============================================================================
 * 🎯 СОЗДАНИЕ DOMAIN ERROR ИЗ VALIDATION ERRORS
 * ========================================================================== */

/**
 * Тип для ошибок валидации, совместимый с error-mapping.
 * Используется для создания DomainError из validation errors.
 */
export type ValidationErrorLike = TaggedError & {
  readonly field?: string | undefined;
  readonly message?: string | undefined;
  readonly details?: unknown;
};

/**
 * Создает DomainError (MappedError) из массива ошибок валидации.
 * Универсальный helper для преобразования ValidationError[] в DomainError.
 * @param errors - Массив ошибок валидации
 * @param errorCode - Опциональный код ошибки (по умолчанию SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID)
 * @param service - Опциональный сервис (по умолчанию определяется из первой ошибки или 'SYSTEM')
 * @param config - Конфигурация маппинга (locale, timestamp)
 * @returns MappedError с деталями валидации
 *
 * @example
 * ```ts
 * import { createDomainError } from './error-mapping';
 * import type { ValidationError } from './validation';
 * const validationErrors: ValidationError[] = [
 *   { code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID', field: 'email', message: 'Invalid email' }
 * ];
 * const domainError = createDomainError(validationErrors, undefined, undefined, {
 *   locale: 'en',
 *   timestamp: Date.now()
 * });
 * // domainError.code === 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID'
 * // domainError.details === { validationErrors: [...] }
 * ```
 */
export function createDomainError(
  errors: readonly ValidationErrorLike[],
  config: MapErrorConfig,
  errorCode?: ServiceErrorCode | undefined,
  service?: ServicePrefix | undefined,
): MappedError<{ readonly validationErrors: readonly ValidationErrorLike[]; }> {
  // Определяем код ошибки: из параметра, из первой ошибки, или fallback
  const firstError = errors.length > 0 ? errors[0] : undefined;
  const code = errorCode ?? firstError?.code ?? 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID';

  // Определяем сервис: из параметра, из первой ошибки, или fallback
  const detectedService = service ?? firstError?.service ?? 'SYSTEM';

  // Создаем TaggedError для передачи в mapError
  const taggedError: TaggedError = {
    code,
    service: detectedService,
  };

  // Используем mapError для создания унифицированного DomainError
  return mapError(
    taggedError,
    { validationErrors: errors },
    config,
    detectedService,
  );
}

/* ============================================================================
 * 🔄 CHAINABLE МАППЕРЫ (опционально)
 * ========================================================================== */

// Позволяет комбинировать несколько мапперов
export type ErrorMapper<TDetails = unknown> = (
  err: unknown,
  details: TDetails | undefined,
  config: MapErrorConfig,
  service?: ServicePrefix,
) => MappedError<TDetails>;

export function chainMappers<TDetails = unknown>(
  ...mappers: ErrorMapper<TDetails>[]
): ErrorMapper<TDetails> {
  return (
    err: unknown,
    details: TDetails | undefined,
    config: MapErrorConfig,
    service?: ServicePrefix,
  ): MappedError<TDetails> => {
    for (const mapper of mappers) {
      const mapped = mapper(err, details, config, service);
      if (mapped.code !== 'SYSTEM_UNKNOWN_ERROR') return mapped;
    }
    return {
      code: 'SYSTEM_UNKNOWN_ERROR',
      message: errorMessages.SYSTEM_UNKNOWN_ERROR(config.locale),
      originError: err instanceof Error
        ? { name: err.constructor.name, message: err.message }
        : undefined,
      details,
      timestamp: config.timestamp,
      service,
    };
  };
}
