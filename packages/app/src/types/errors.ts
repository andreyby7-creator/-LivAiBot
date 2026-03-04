/**
 * @file packages/app/src/types/errors.ts
 * ============================================================================
 * ❌ ЕДИНЫЙ КОНТРАКТ ДЛЯ ОШИБОК ПРИЛОЖЕНИЯ
 * ============================================================================
 * Этот файл описывает типы ошибок, которые используются на уровне frontend
 * и backend микросервисов, обеспечивая строгую типизацию и совместимость
 * с распределенными системами.
 * Принципы:
 * - Discriminated unions для всех ошибок
 * - Severity для UI-семантики (info/warning/error)
 * - Полная иммутабельность
 * - Совместимость с distributed tracing и observability
 * - Zero-runtime-cost, только типы
 */

import type { ApiError as ApiErrorContract } from './api.js';
import type { ISODateString, Json, Platform } from './common.js';

/* ========================================================================== */
/* 🔑 ОСНОВНЫЕ КОНТРАКТЫ ОШИБОК */
/* ========================================================================== */

/** Источник ошибки для frontend. */
export type FrontendErrorSource =
  | 'UI'
  | 'NETWORK'
  | 'VALIDATION'
  | 'AUTH'
  | 'UNKNOWN';

/**
 * Универсальный контракт ошибки приложения.
 * Используется в store, hooks, effect handlers и сервисах.
 */
export type AppError =
  | ClientError
  | ServerError
  | ValidationError
  | NetworkError
  | UnknownError;

/* ========================================================================== */
/* ❗ КЛИЕНТСКИЕ ОШИБКИ */
/* ========================================================================== */

/** Ошибка, вызванная некорректным действием пользователя. */
export type ClientError = {
  readonly type: 'ClientError';
  readonly severity: 'warning';
  readonly source: FrontendErrorSource;
  readonly code: string;
  readonly message: string;
  readonly context?: Json;
  readonly traceId?: string;
  readonly timestamp: ISODateString;
};

/* ========================================================================== */
/* ❌ ОШИБКИ ВАЛИДАЦИИ */
/* ========================================================================== */

/** Ошибка валидации данных (формы, payload, API request). */
export type ValidationError = {
  readonly type: 'ValidationError';
  readonly severity: 'warning';
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly message: string;
  readonly traceId?: string;
  readonly timestamp: ISODateString;
};

/* ========================================================================== */
/* 🔌 NETWORK / SERVICE ERRORS */
/* ========================================================================== */

/** Ошибка сети или отказ backend сервиса. */
export type NetworkError = {
  readonly type: 'NetworkError';
  readonly severity: 'error';
  readonly statusCode?: number;
  readonly message: string;
  readonly endpoint?: string;
  readonly platform?: Platform;
  readonly traceId?: string;
  readonly timestamp: ISODateString;
};

/** Ошибка, возвращаемая backend сервисом через API контракт. */
export type ServerError = {
  readonly type: 'ServerError';
  readonly severity: 'error';
  readonly apiError: ApiErrorContract;
  readonly endpoint?: string;
  readonly platform?: Platform;
  readonly timestamp: ISODateString;
};

/* ========================================================================== */
/* ❓ НЕИЗВЕСТНЫЕ / НЕКАТЕГОРИЗИРОВАННЫЕ ОШИБКИ */
/* ========================================================================== */

/** Ошибка, которая не подпадает под известные категории. */
export type UnknownError = {
  readonly type: 'UnknownError';
  readonly severity: 'error';
  readonly message: string;
  readonly original?: unknown;
  readonly traceId?: string;
  readonly timestamp: ISODateString;
};

/* ========================================================================== */
/* 🔄 UTILITY CONTRACTS */
/* ========================================================================== */

/** Тип функции, которая возвращает ошибку. */
export type ErrorFn<T extends AppError = AppError> = () => T;

/** Тип обработчика ошибок. */
export type ErrorHandler<T extends AppError = AppError> = (error: T) => void;

/** Код ошибки для error-boundary маппинга. */
export type ErrorBoundaryErrorCode =
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

/** Проверка типа ошибки по discriminated union. */
export type IsErrorOfType<T extends AppError['type']> = (
  error: AppError,
) => error is Extract<AppError, { type: T; }>;

/* ========================================================================== */
/* 📦 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ */
/* ========================================================================== */

/** Пример создания ServerError из API ошибки. */
export const createServerError = (
  apiError: ApiErrorContract,
  endpoint?: string,
  platform?: Platform,
): ServerError => ({
  type: 'ServerError' as const,
  severity: 'error' as const,
  apiError,
  // Поля endpoint и platform добавляются conditionally и будут readonly согласно типу ServerError
  ...(endpoint !== undefined && { endpoint }),
  ...(platform !== undefined && { platform }),
  timestamp: new Date().toISOString() as ISODateString,
});

/** Пример функции-обработчика всех ошибок. */
export const handleError: ErrorHandler = (error) => {
  switch (error.type) {
    case 'ClientError':
    case 'ValidationError':
    case 'NetworkError':
    case 'ServerError':
    case 'UnknownError':
      // здесь можно логировать в sentry / posthog / metrics
      // console.error(error);
      break;
    default:
      // Логируем неожиданный тип ошибки для debugging
      // eslint-disable-next-line no-console
      console.error('Unexpected error type:', error);
      // В production можно отправить в error tracking
      throw new Error(`Unexpected error type: ${(error as { type?: string; }).type ?? 'unknown'}`);
  }
};
