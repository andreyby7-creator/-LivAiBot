/**
 * @file CacheAdapterConfig.ts - Конфигурация Cache адаптера LivAiBot
 *
 * Конфигурация с валидацией, defaults и typed constants.
 * Circuit breaker, retry policies, timeout handling, TTL management для production reliability.
 */

import { cacheAdapterFactories } from './CacheAdapterFactories.js';

import type {
  CacheAdapterContext,
  CacheAdapterOptions,
  CacheCircuitBreakerKey,
  CacheCircuitBreakerThreshold,
  CacheInstanceId,
  CacheMaxRetries,
  CacheNodeId,
  CacheTimeoutMs,
  CacheTtlMs,
} from './CacheAdapterTypes.js';

/** Дефолтные значения конфигурации */
export const CACHE_ADAPTER_DEFAULTS = {
  /** Идентификатор cache instance по умолчанию */
  INSTANCE_ID: 'default-cache',
  /** Максимальное количество повторов */
  MAX_RETRIES: 2,
  /** Задержка между повторами - 500ms */
  RETRY_DELAY_MS: 500,
  /** Порог circuit breaker - 5 ошибок */
  CIRCUIT_BREAKER_THRESHOLD: 5,
  /** Время восстановления circuit breaker - 30 секунд */
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: 30000,
  /** TTL по умолчанию - 1 час */
  DEFAULT_TTL_MS: 3600000,
  /** Максимальный timeout - 30 секунд */
  MAX_TIMEOUT_MS: 30000,
  /** Минимальный timeout - 100ms */
  MIN_TIMEOUT_MS: 100,
  /** Максимальный TTL - 30 дней */
  MAX_TTL_MS: 2592000000,
  /** Минимальный TTL - 1ms */
  MIN_TTL_MS: 1,
} as const;

/** Типы cache операций для retry логики */
export const CACHE_OPERATION_TYPES = {
  /** GET операции */
  GET: 'GET',
  /** SET операции */
  SET: 'SET',
  /** DELETE операции */
  DELETE: 'DELETE',
  /** EXISTS операции */
  EXISTS: 'EXISTS',
  /** TTL операции */
  TTL: 'TTL',
} as const;

/** Cache error codes для retry логики */
export const CACHE_ERROR_CODES = {
  /** Connection errors */
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  /** Timeout errors */
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  /** Serialization errors */
  SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
  /** Cluster errors */
  CLUSTER_ERROR: 'CLUSTER_ERROR',
} as const;

/** Поддерживаемые форматы сериализации */
export const CACHE_SERIALIZATION_FORMATS = [
  'json',
  'msgpack',
  'binary',
] as const;

/** Тип поддерживаемых форматов сериализации */
export type CacheSerializationFormat = typeof CACHE_SERIALIZATION_FORMATS[number];

/** Валидные диапазоны значений */
export const CACHE_ADAPTER_RANGES = {
  TIMEOUT: {
    MIN: CACHE_ADAPTER_DEFAULTS.MIN_TIMEOUT_MS,
    MAX: CACHE_ADAPTER_DEFAULTS.MAX_TIMEOUT_MS,
  },
  RETRIES: {
    MIN: 0,
    MAX: 10,
  },
  RETRY_DELAY: {
    MIN: 50,
    MAX: 10000,
  },
  CIRCUIT_BREAKER_THRESHOLD: {
    MIN: 1,
    MAX: 100,
  },
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT: {
    MIN: 1000,
    MAX: 300000,
  },
  TTL: {
    MIN: CACHE_ADAPTER_DEFAULTS.MIN_TTL_MS,
    MAX: CACHE_ADAPTER_DEFAULTS.MAX_TTL_MS,
  },
  CLUSTER_NODES: {
    MIN: 1,
    MAX: 100,
  },
} as const;

/** Конфигурация Cache адаптера */
export type CacheAdapterConfig = {
  /** Идентификатор cache instance */
  readonly instanceId: CacheInstanceId;
  /** Timeout для cache операций (опционально, undefined = timeout выключен) */
  readonly timeoutMs?: CacheTimeoutMs;
  /** Максимальное количество повторов */
  readonly maxRetries: CacheMaxRetries;
  /** Задержка между повторами */
  readonly retryDelay: CacheTimeoutMs;
  /** Порог circuit breaker (количество ошибок для открытия) */
  readonly circuitBreakerThreshold: CacheCircuitBreakerThreshold;
  /** Время восстановления circuit breaker */
  readonly circuitBreakerRecoveryTimeout: CacheTimeoutMs;
  /** Включен ли circuit breaker */
  readonly circuitBreakerEnabled: boolean;
  /** Включены ли повторы */
  readonly retriesEnabled: boolean;
  /** TTL по умолчанию для SET операций */
  readonly defaultTtl: CacheTtlMs;
  /** Включено ли сжатие данных */
  readonly compressionEnabled: boolean;
  /** Формат сериализации */
  readonly serializationFormat: 'json' | 'msgpack' | 'binary';
  /** Включен ли кластерный режим */
  readonly clusterEnabled: boolean;
  /** Узлы кластера (игнорируется если clusterEnabled=false) */
  readonly clusterNodes: readonly CacheNodeId[];
  /** Включены ли метрики */
  readonly metricsEnabled: boolean;
};

/**
 * Создает дефолтную конфигурацию Cache адаптера
 *
 * Все значения предварительно валидированы через фабрики
 * и содержат безопасные значения по умолчанию для production.
 *
 * @returns Конфигурация с дефолтными валидированными значениями
 */
export function createDefaultConfig(instanceId?: CacheInstanceId): CacheAdapterConfig {
  return {
    instanceId: instanceId
      ?? cacheAdapterFactories.makeCacheInstanceId(CACHE_ADAPTER_DEFAULTS.INSTANCE_ID),
    maxRetries: cacheAdapterFactories.makeMaxRetries(CACHE_ADAPTER_DEFAULTS.MAX_RETRIES),
    retryDelay: cacheAdapterFactories.makeTimeoutMs(CACHE_ADAPTER_DEFAULTS.RETRY_DELAY_MS),
    circuitBreakerThreshold: cacheAdapterFactories.makeCircuitBreakerThreshold(
      CACHE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_THRESHOLD,
    ),
    circuitBreakerRecoveryTimeout: cacheAdapterFactories.makeTimeoutMs(
      CACHE_ADAPTER_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
    ),
    circuitBreakerEnabled: true,
    retriesEnabled: true,
    defaultTtl: cacheAdapterFactories.makeCacheTtlMs(CACHE_ADAPTER_DEFAULTS.DEFAULT_TTL_MS),
    compressionEnabled: false,
    serializationFormat: 'json',
    clusterEnabled: false,
    clusterNodes: [],
    metricsEnabled: true,
  };
}

/**
 * Создает конфигурацию Cache адаптера с кастомными настройками
 *
 * Все значения валидируются и применяются поверх дефолтных.
 * Невалидные значения вызывают исключения.
 *
 * @param overrides - Частичные настройки для переопределения
 * @returns Полная конфигурация с валидированными значениями
 * @throws {CacheAdapterValidationError} при некорректных значениях в overrides
 */
export function createConfig(
  overrides: Partial<CacheAdapterOptions> = {},
): CacheAdapterConfig {
  const defaults = createDefaultConfig(overrides.instanceId);

  // Валидация массива clusterNodes
  if (overrides.clusterNodes !== undefined) {
    if (!Array.isArray(overrides.clusterNodes)) {
      throw new cacheAdapterFactories.ValidationError(
        'clusterNodes must be an array',
        'createConfig',
        overrides.clusterNodes,
      );
    }

    // Проверяем длину clusterNodes только если clusterEnabled = true
    if (overrides.clusterEnabled === true) {
      if (
        overrides.clusterNodes.length < CACHE_ADAPTER_RANGES.CLUSTER_NODES.MIN
        || overrides.clusterNodes.length > CACHE_ADAPTER_RANGES.CLUSTER_NODES.MAX
      ) {
        throw new cacheAdapterFactories.ValidationError(
          `clusterNodes length must be between ${CACHE_ADAPTER_RANGES.CLUSTER_NODES.MIN} and ${CACHE_ADAPTER_RANGES.CLUSTER_NODES.MAX} when clusterEnabled=true`,
          'createConfig',
          overrides.clusterNodes.length,
        );
      }
    }

    // Валидация что все элементы - строки (branded types создаются позже)
    // Проверяем только если clusterEnabled = true
    if (overrides.clusterEnabled === true) {
      for (const node of overrides.clusterNodes) {
        if (typeof node !== 'string' || !node || node.trim() === '') {
          throw new cacheAdapterFactories.ValidationError(
            'clusterNodes must contain non-empty strings when clusterEnabled=true',
            'createConfig',
            overrides.clusterNodes,
          );
        }
      }
    }
  }

  // Валидация serializationFormat
  if (overrides.serializationFormat !== undefined) {
    if (!CACHE_SERIALIZATION_FORMATS.includes(overrides.serializationFormat)) {
      throw new cacheAdapterFactories.ValidationError(
        `serializationFormat must be one of: ${CACHE_SERIALIZATION_FORMATS.join(', ')}`,
        'createConfig',
        overrides.serializationFormat,
      );
    }
  }

  // Проверка clusterEnabled/clusterNodes consistency
  if (
    overrides.clusterEnabled === false
    && overrides.clusterNodes !== undefined
    && overrides.clusterNodes.length > 0
  ) {
    // Выдаем warning в консоль, но продолжаем работу (clusterNodes будут игнорироваться)
    console.warn(
      '[CacheAdapterConfig.createConfig] clusterNodes specified but clusterEnabled=false - nodes will be ignored',
    );
  }

  const baseConfig = {
    instanceId: overrides.instanceId ?? defaults.instanceId,
    maxRetries: overrides.maxRetries !== undefined
      ? cacheAdapterFactories.makeMaxRetries(overrides.maxRetries)
      : defaults.maxRetries,
    retryDelay: overrides.retryDelayMs !== undefined
      ? cacheAdapterFactories.makeTimeoutMs(overrides.retryDelayMs)
      : defaults.retryDelay,
    circuitBreakerThreshold: overrides.circuitBreakerThreshold !== undefined
      ? cacheAdapterFactories.makeCircuitBreakerThreshold(overrides.circuitBreakerThreshold)
      : defaults.circuitBreakerThreshold,
    circuitBreakerRecoveryTimeout: overrides.circuitBreakerRecoveryMs !== undefined
      ? cacheAdapterFactories.makeTimeoutMs(overrides.circuitBreakerRecoveryMs)
      : defaults.circuitBreakerRecoveryTimeout,
    circuitBreakerEnabled: overrides.circuitBreakerEnabled ?? defaults.circuitBreakerEnabled,
    retriesEnabled: overrides.retriesEnabled ?? defaults.retriesEnabled,
    defaultTtl: overrides.defaultTtlMs !== undefined
      ? cacheAdapterFactories.makeCacheTtlMs(overrides.defaultTtlMs)
      : defaults.defaultTtl,
    compressionEnabled: overrides.compressionEnabled ?? defaults.compressionEnabled,
    serializationFormat: overrides.serializationFormat ?? defaults.serializationFormat,
    clusterEnabled: overrides.clusterEnabled ?? defaults.clusterEnabled,
    clusterNodes: overrides.clusterNodes !== undefined
      ? overrides.clusterNodes.map((node) => cacheAdapterFactories.makeCacheNodeId(node))
      : defaults.clusterNodes,
    metricsEnabled: overrides.metricsEnabled ?? defaults.metricsEnabled,
  };

  // Добавляем timeoutMs только если определен для соответствия exactOptionalPropertyTypes
  if (overrides.timeoutMs !== undefined) {
    return {
      ...baseConfig,
      timeoutMs: cacheAdapterFactories.makeTimeoutMs(overrides.timeoutMs),
    } as CacheAdapterConfig;
  }

  return baseConfig as CacheAdapterConfig;
}

/**
 * Создает контекст Cache адаптера для DI
 *
 * @param instanceId - Идентификатор cache instance
 * @param overrides - Дополнительные настройки контекста
 * @returns CacheAdapterContext
 */
export function createCacheAdapterContext(
  instanceId: string,
  overrides: {
    defaultTimeoutMs?: CacheTimeoutMs;
    defaultTtlMs?: CacheTtlMs;
    maxRetries?: CacheMaxRetries;
  } = {},
): CacheAdapterContext {
  return {
    instanceId: cacheAdapterFactories.makeCacheInstanceId(instanceId),
    ...(overrides.defaultTimeoutMs !== undefined
      && { defaultTimeoutMs: overrides.defaultTimeoutMs }),
    ...(overrides.defaultTtlMs !== undefined
      && { defaultTtlMs: overrides.defaultTtlMs }),
    ...(overrides.maxRetries !== undefined && { maxRetries: overrides.maxRetries }),
  };
}

/**
 * Получает ключ для circuit breaker на основе instance ID и операции
 *
 * @param instanceId - Идентификатор cache instance
 * @param operationType - Тип операции (GET, SET, DELETE, EXISTS, TTL)
 * @returns Ключ для circuit breaker
 */
export function getCircuitBreakerKey(
  instanceId: string,
  operationType: string,
): CacheCircuitBreakerKey {
  const validatedId = cacheAdapterFactories.makeCacheInstanceId(instanceId);
  return cacheAdapterFactories.makeCacheCircuitBreakerKey(`${validatedId}:${operationType}`);
}

/**
 * Проверяет, является ли ошибка подходящей для повтора
 *
 * @param error - Ошибка для проверки
 * @returns true если ошибка retryable
 */
export function isRetryableCacheError(error: unknown): boolean {
  // Network and connection errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('connection')
      || message.includes('timeout')
      || message.includes('timed out')
      || message.includes('network')
      || message.includes('econnreset')
      || message.includes('enotfound')
      || message.includes('cluster')
      || message.includes('serialization')
      || message.includes('json')
      || message.includes('temporary')
      || message.includes('unavailable');
  }

  // Cache-specific error codes
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    const errorCode = errorObj['code'] as string | undefined;

    if (typeof errorCode === 'string') {
      const code = errorCode.toUpperCase();
      return code === CACHE_ERROR_CODES.CONNECTION_ERROR
        || code === CACHE_ERROR_CODES.TIMEOUT_ERROR
        || code === CACHE_ERROR_CODES.CLUSTER_ERROR
        || code === CACHE_ERROR_CODES.SERIALIZATION_ERROR
        || code.includes('CONNECTION')
        || code.includes('TIMEOUT')
        || code.includes('CLUSTER')
        || code.includes('SERIALIZATION')
        || code.includes('TEMPORARY')
        || code.includes('UNAVAILABLE');
    }
  }

  return false;
}
