/**
 * @file packages/app/src/lib/error-mapping.ts
 * ============================================================================
 * 🔹 МАППИНГ ОШИБОК МИКРОСЕРВИСОВ
 * ============================================================================
 *
 * Цель:
 * - Консолидировать обработку ошибок по всем микросервисам
 * - Строго типизированные коды ошибок
 * - Чистые, детерминированные мапперы
 * - Поддержка fallback и originError для telemetry и трассировки
 * - Расширяемость и локализация
 *
 * Принципы:
 * - Чистый TypeScript, без side-effects
 * - Микросервисно-ориентированный дизайн
 * - Максимальная безопасность и ясность
 */

import type { EffectError } from './effect-utils.js';

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
): { code?: ServiceErrorCode; service?: ServicePrefix | undefined; } {
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
 * Преобразует любую ошибку в MappedError
 * - Использует код ошибки TaggedError или EffectError если есть
 * - Фолбек на UNKNOWN_ERROR
 * - Сохраняет оригинальную ошибку для telemetry
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
  // Используем переданный locale или из конфига
  const effectiveLocale = locale ?? getErrorLocale();

  // Сначала проверяем TaggedError с кодом и автоматическим определением сервиса
  const errorInfo = getErrorInfo(err);
  let code = errorInfo.code;
  let detectedService = errorInfo.service;

  // Если не нашли код, проверяем EffectError с kind
  if (code === undefined && isEffectError(err)) {
    code = kindToErrorCode[err.kind as keyof typeof kindToErrorCode];

    // Для EffectError можно попробовать определить сервис из kind (например, 'auth/...' -> 'AUTH')
    if (err.kind.startsWith('auth/')) {
      detectedService = 'AUTH';
    } else if (err.kind.startsWith('billing/')) {
      detectedService = 'BILLING';
    } else if (err.kind.startsWith('ai/')) {
      detectedService = 'AI';
    }
  }

  // Используем переданный сервис или автоматически определенный
  const finalService = service ?? detectedService;

  return {
    code: code ?? 'SYSTEM_UNKNOWN_ERROR',
    message: code !== undefined && isValidErrorCode(code)
      ? errorMessages[code as keyof typeof errorMessages](effectiveLocale)
      : errorMessages.SYSTEM_UNKNOWN_ERROR(effectiveLocale),
    details,
    originError: err instanceof Error ? err : undefined,
    timestamp: Date.now(),
    service: finalService,
  };
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
      message: errorMessages.SYSTEM_UNKNOWN_ERROR(locale ?? getErrorLocale()),
      originError: err instanceof Error ? err : undefined,
      details,
      timestamp: Date.now(),
      service,
    };
  };
}
