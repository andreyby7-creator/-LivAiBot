/**
 * @file HttpAdapterConfig.ts - Конфигурация HTTP адаптера LivAiBot
 *
 * Конфигурация с валидацией, defaults и typed constants.
 * Circuit breaker, retry policies, timeout handling для production reliability.
 */

import { httpAdapterFactories } from './HttpAdapterFactories.js';

import type {
  CircuitBreakerKey,
  CircuitBreakerThreshold,
  HttpAdapterOptions,
  MaxRetries,
  TimeoutMs,
} from './HttpAdapterTypes.js';

/** Дефолтные значения конфигурации */
export const HTTP_ADAPTER_DEFAULTS = {
  /** Timeout по умолчанию - 30 секунд */
  TIMEOUT_MS: 30000,
  /** Максимальное количество повторов */
  MAX_RETRIES: 3,
  /** Задержка между повторами - 1 секунда */
  RETRY_DELAY_MS: 1000,
  /** Порог circuit breaker - 10 ошибок */
  CIRCUIT_BREAKER_THRESHOLD: 10,
  /** Время восстановления circuit breaker - 60 секунд */
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: 60000,
  /** Максимальный timeout - 5 минут */
  MAX_TIMEOUT_MS: 300000,
  /** Минимальный timeout - 100ms */
  MIN_TIMEOUT_MS: 100,
} as const;

/** HTTP статус коды для retry логики */
export const HTTP_STATUS_CODES = {
  /** 5xx Server Errors */
  SERVER_ERROR_MIN: 500,
  /** Request Timeout */
  REQUEST_TIMEOUT: 408,
  /** Too Many Requests */
  TOO_MANY_REQUESTS: 429,
} as const;

/** Валидные диапазоны значений */
export const HTTP_ADAPTER_RANGES = {
  TIMEOUT: {
    MIN: HTTP_ADAPTER_DEFAULTS.MIN_TIMEOUT_MS,
    MAX: HTTP_ADAPTER_DEFAULTS.MAX_TIMEOUT_MS,
  },
  RETRIES: {
    MIN: 0,
    MAX: 10,
  },
  RETRY_DELAY: {
    MIN: 100,
    MAX: 30000,
  },
  CIRCUIT_BREAKER_THRESHOLD: {
    MIN: 1,
    MAX: 100,
  },
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT: {
    MIN: 1000,
    MAX: 300000,
  },
} as const;

/** Конфигурация HTTP адаптера */
export type HttpAdapterConfig = {
  /** Timeout для HTTP запросов */
  readonly timeout: TimeoutMs;
  /** Максимальное количество повторов */
  readonly maxRetries: MaxRetries;
  /** Задержка между повторами */
  readonly retryDelay: TimeoutMs;
  /** Порог circuit breaker (количество ошибок для открытия) */
  readonly circuitBreakerThreshold: CircuitBreakerThreshold;
  /** Время восстановления circuit breaker */
  readonly circuitBreakerRecoveryTimeout: TimeoutMs;
  /** Включен ли circuit breaker */
  readonly circuitBreakerEnabled: boolean;
  /** Включены ли повторы */
  readonly retriesEnabled: boolean;
};

/**
 * Создает дефолтную конфигурацию HTTP адаптера
 *
 * Все значения предварительно валидированы через фабрики
 * и содержат безопасные значения по умолчанию для production.
 *
 * @returns Конфигурация с дефолтными валидированными значениями
 */
export function createDefaultConfig(): HttpAdapterConfig {
  return {
    timeout: httpAdapterFactories.makeTimeoutMs(HTTP_ADAPTER_DEFAULTS.TIMEOUT_MS),
    maxRetries: httpAdapterFactories.makeMaxRetries(HTTP_ADAPTER_DEFAULTS.MAX_RETRIES),
    retryDelay: httpAdapterFactories.makeTimeoutMs(HTTP_ADAPTER_DEFAULTS.RETRY_DELAY_MS),
    circuitBreakerThreshold: httpAdapterFactories.makeCircuitBreakerThreshold(
      HTTP_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_THRESHOLD,
    ),
    circuitBreakerRecoveryTimeout: httpAdapterFactories.makeTimeoutMs(
      HTTP_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
    ),
    circuitBreakerEnabled: true,
    retriesEnabled: true,
  };
}

/**
 * Создает конфигурацию HTTP адаптера с кастомными опциями
 *
 * Все значения проходят валидацию через фабрики для обеспечения type safety
 * и boundary validation на compile-time и runtime уровнях.
 *
 * @param options - Частичные опции конфигурации
 * @returns Полная конфигурация с валидированными branded types
 */
export function createConfig(options: Partial<HttpAdapterOptions> = {}): HttpAdapterConfig {
  const defaults = createDefaultConfig();

  return {
    timeout: options.timeoutMs !== undefined
      ? httpAdapterFactories.makeTimeoutMs(options.timeoutMs)
      : defaults.timeout,
    maxRetries: options.maxRetries !== undefined
      ? httpAdapterFactories.makeMaxRetries(options.maxRetries)
      : defaults.maxRetries,
    retryDelay: options.retryDelayMs !== undefined
      ? httpAdapterFactories.makeTimeoutMs(options.retryDelayMs)
      : defaults.retryDelay,
    circuitBreakerThreshold: options.circuitBreakerThreshold
      ? httpAdapterFactories.makeCircuitBreakerThreshold(options.circuitBreakerThreshold)
      : defaults.circuitBreakerThreshold,
    circuitBreakerRecoveryTimeout: options.circuitBreakerRecoveryMs
      ? httpAdapterFactories.makeTimeoutMs(options.circuitBreakerRecoveryMs)
      : defaults.circuitBreakerRecoveryTimeout,
    circuitBreakerEnabled: options.circuitBreakerEnabled ?? defaults.circuitBreakerEnabled,
    retriesEnabled: options.retriesEnabled ?? defaults.retriesEnabled,
  };
}

/** Получает ключ для circuit breaker */
export function getCircuitBreakerKey(url: string, method: string): CircuitBreakerKey {
  try {
    const parsedUrl = new URL(url);
    return httpAdapterFactories.makeCircuitBreakerKey(`${parsedUrl.hostname}:${method}`);
  } catch {
    // Fallback для malformed URL
    return httpAdapterFactories.makeCircuitBreakerKey(`unknown-host:${method}`);
  }
}

/** Проверяет, является ли ошибка подходящей для повтора */
export function isRetryableError(error: unknown): boolean {
  // Network errors, timeouts, 5xx server errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout')
      || message.includes('network')
      || message.includes('connection')
      || message.includes('econnreset')
      || message.includes('enotfound');
  }

  // HTTP status codes that are retryable
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    const statusCode = (errorObj['statusCode'] ?? errorObj['status']) as number | undefined;
    if (typeof statusCode === 'number') {
      return statusCode >= HTTP_STATUS_CODES.SERVER_ERROR_MIN
        || statusCode === HTTP_STATUS_CODES.REQUEST_TIMEOUT
        || statusCode === HTTP_STATUS_CODES.TOO_MANY_REQUESTS;
    }
  }

  return false;
}
