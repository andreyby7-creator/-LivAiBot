/**
 * @file YandexAIConnectionError.ts - Инфраструктурные ошибки подключения к Yandex Cloud AI
 *
 * Описывает транспортные и платформенные сбои при взаимодействии с Yandex Cloud AI:
 * - сетевые ошибки (DNS, TLS, connection reset)
 * - таймауты
 * - недоступность сервиса
 *
 * ❗ Не содержит бизнес- или ML-семантики.
 * Используется adapter layer → policies → observability.
 *
 * NOTE: Будущие улучшения типовой строгости:
 * - ErrorCode: рассмотреть branded types для compile-time валидации
 * - transport: расширить union type до 'http' | 'grpc' | 'sdk' | 'websocket' при необходимости WebSocket
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/* ========================== CONSTANTS ========================== */

/** Вендор AI-платформы */
export const AI_VENDOR = 'yandex_cloud' as const;

/** Подсказка policy layer о рекомендуемом поведении */
export type InfrastructurePolicyHint =
  | 'retry'
  | 'circuit_break'
  | 'fail_fast';

/** Классификация инфраструктурного сбоя */
export type InfrastructureFailureKind =
  | 'timeout'
  | 'network'
  | 'tls'
  | 'service_unavailable'
  | 'unknown';

/* ========================== CONTEXT ========================== */

/** Контекст инфраструктурной ошибки подключения к Yandex AI */
export type YandexAIConnectionErrorContext = {
  /** Тип доменного контекста */
  readonly type: 'yandex_ai_connection';

  /** Вендор AI-платформы */
  readonly vendor: typeof AI_VENDOR;

  /** Тип инфраструктурного сбоя */
  readonly failureKind: InfrastructureFailureKind;

  /** Рекомендация для policy layer */
  readonly policyHint: InfrastructurePolicyHint;

  /** Используемый транспорт */
  readonly transport: 'http' | 'grpc' | 'sdk';

  /** Endpoint или API метод */
  readonly endpoint?: string;

  /** Регион Yandex Cloud */
  readonly region?: string;

  /** Request ID / Trace ID провайдера */
  readonly requestId?: string;

  /** HTTP статус, если применимо */
  readonly httpStatus?: number;

  /** Является ли ошибка потенциально повторяемой */
  readonly retriable: boolean;

  /** Оригинальная ошибка SDK / fetch / grpc */
  readonly originalError?: unknown;

  /** Время ожидания (ms), если применимо */
  readonly timeoutMs?: number;
};

/* ========================== ERROR TYPE ========================== */

/** TaggedError для инфраструктурных ошибок Yandex AI */
export type YandexAIConnectionError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.TECHNICAL;
    readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
    readonly severity: typeof ERROR_SEVERITY.HIGH;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details: YandexAIConnectionErrorContext;
    readonly timestamp: string;
  },
  'YandexAIConnectionError'
>;

/* ========================== FACTORY ========================== */

/** Базовый конструктор инфраструктурной ошибки Yandex AI */
export function createYandexAIConnectionError(
  code: ErrorCode,
  message: string,
  details: Omit<YandexAIConnectionErrorContext, 'type' | 'vendor'>,
  timestamp?: string,
): YandexAIConnectionError {
  return {
    _tag: 'YandexAIConnectionError',
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.HIGH,
    code,
    message,
    details: {
      type: 'yandex_ai_connection',
      vendor: AI_VENDOR,
      ...details,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as YandexAIConnectionError;
}

/* ========================== SPECIALIZED CREATORS ========================== */

/** Таймаут при обращении к Yandex AI */
export function createYandexAITimeoutError(
  endpoint: string,
  timeoutMs: number,
  originalError?: unknown,
): YandexAIConnectionError {
  return createYandexAIConnectionError(
    'INFRA_AI_CONNECTION_TIMEOUT' as ErrorCode,
    `Таймаут подключения к Yandex AI (${timeoutMs}ms)`,
    {
      failureKind: 'timeout',
      policyHint: 'retry',
      transport: 'http',
      endpoint,
      timeoutMs,
      retriable: true,
      originalError,
    },
  );
}

/** Недоступность сервиса Yandex AI */
export function createYandexAIServiceUnavailableError(
  endpoint?: string,
  httpStatus?: number,
  originalError?: unknown,
): YandexAIConnectionError {
  return createYandexAIConnectionError(
    'INFRA_AI_SERVICE_UNAVAILABLE' as ErrorCode,
    'Сервис Yandex AI временно недоступен',
    {
      failureKind: 'service_unavailable',
      policyHint: 'circuit_break',
      transport: 'http',
      retriable: true,
      ...(endpoint !== undefined && { endpoint }),
      ...(httpStatus !== undefined && { httpStatus }),
      ...(originalError !== undefined && { originalError }),
    } as Omit<YandexAIConnectionErrorContext, 'type' | 'vendor'>,
  );
}

/** Сетевая ошибка при обращении к Yandex AI */
export function createYandexAINetworkError(
  endpoint: string,
  failureKind: 'network' | 'tls' = 'network',
  originalError?: unknown,
): YandexAIConnectionError {
  return createYandexAIConnectionError(
    'INFRA_AI_NETWORK_ERROR' as ErrorCode,
    'Сетевая ошибка при обращении к Yandex AI',
    {
      failureKind,
      policyHint: 'retry',
      transport: 'http',
      endpoint,
      retriable: true,
      originalError,
    },
  );
}

/** Неизвестная инфраструктурная ошибка */
export function createYandexAIUnknownInfrastructureError(
  message: string,
  originalError?: unknown,
): YandexAIConnectionError {
  return createYandexAIConnectionError(
    'INFRA_AI_UNKNOWN_ERROR' as ErrorCode,
    message,
    {
      failureKind: 'unknown',
      policyHint: 'fail_fast',
      transport: 'sdk',
      retriable: false,
      originalError,
    },
  );
}

/* ========================== POLICY HELPERS ========================== */

/** Определяет стратегию восстановления для policy layer */
export function getYandexAIRecoveryStrategy(
  error: YandexAIConnectionError,
): InfrastructurePolicyHint {
  return error.details.policyHint;
}

/** Проверяет, допустим ли retry для ошибки */
export function isYandexAIRetriableError(
  error: YandexAIConnectionError,
): boolean {
  return error.details.retriable;
}

/** Проверяет, требуется ли circuit breaker */
export function shouldTriggerCircuitBreaker(
  error: YandexAIConnectionError,
): boolean {
  return error.details.policyHint === 'circuit_break';
}
