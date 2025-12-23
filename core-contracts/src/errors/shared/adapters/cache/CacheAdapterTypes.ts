/**
 * @file CacheAdapterTypes.ts
 * Типы транспортного уровня для Cache-адаптера.
 *
 * ❗ Не содержит бизнес-логики
 * ❗ Не содержит side-effects
 * ❗ Не зависит от Effect / FP
 *
 * Предназначен для строгого, безопасного и расширяемого cache boundary
 * (Redis / Memcached / In-memory — не важно).
 */

import type { LivAiErrorCode } from '../../../base/ErrorCode.js';

/**
 * @future
 * Возможные расширения (НЕ требуется сейчас):
 *
 * 1) CacheError._tag: 'CacheSerializationError'
 *    — для поддержки optimistic locking / serialization failures
 *
 * 2) CacheValue → branded types для разных типов значений
 *    type CacheString = string & { readonly __brand: 'CacheString' }
 *    — если потребуется строгая типизация значений
 */

// ==================== БАЗОВЫЕ ДОМЕННЫЕ ПРИМИТИВЫ ====================

/**
 * Ключ кеша (cache key)
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCacheKey} в CacheAdapterFactories.ts
 * @throws Error при пустой строке или не-string значении
 */
export type CacheKey = string & { readonly __brand: 'CacheKey'; };

/**
 * Значение кеша (cache value)
 *
 * ❗ Serializable only — может содержать только сериализуемые типы
 * ❗ Может содержать string, number, boolean, object, array (null = cache miss)
 *
 * @future В будущем можно добавить branded types:
 *   type CacheString = string & { readonly __brand: 'CacheString' }
 *   type CacheNumber = number & { readonly __brand: 'CacheNumber' }
 *   — для строгой типизации значений
 *
 * @throws Не выбрасывает — тип не валидируется фабрикой
 */
export type CacheValue =
  | string
  | number
  | boolean
  | readonly unknown[]
  | Readonly<Record<string, unknown>>
  | Uint8Array;

/**
 * TTL (Time To Live) в миллисекундах
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCacheTtlMs} в CacheAdapterFactories.ts
 * @throws Error при отрицательных значениях или нечисловом типе
 * @responsible Компонент, вызывающий фабрику, отвечает за TTL > 0
 */
export type CacheTtlMs = number & { readonly __brand: 'CacheTtlMs'; };

/**
 * Таймаут операции кеша в миллисекундах
 *
 * @boundary-validation Гарантируется фабрикой {@link makeTimeoutMs} в CacheAdapterFactories.ts
 * @throws Error при отрицательных значениях или нечисловом типе
 */
export type CacheTimeoutMs = number & { readonly CacheTimeoutMs: unique symbol; };

/**
 * Длительность выполнения cache операции
 *
 * @boundary-validation Гарантируется фабрикой {@link makeDurationMs} в CacheAdapterFactories.ts
 * @throws Error при отрицательных значениях или нечисловом типе
 */
export type CacheDurationMs = number & { readonly __brand: 'CacheDurationMs'; };

/**
 * Максимальное количество retry для cache операций
 *
 * @boundary-validation Гарантируется фабрикой {@link makeMaxRetries} в CacheAdapterFactories.ts
 * @throws Error при значениях вне диапазона 0–10 или нецелых числах
 */
export type CacheMaxRetries = number & { readonly __brand: 'CacheMaxRetries'; };

/**
 * Идентификатор cache instance (для distributed coordination)
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCacheInstanceId} в CacheAdapterFactories.ts
 * @throws Error при пустой строке или не-string значении
 */
export type CacheInstanceId = string & { readonly __brand: 'CacheInstanceId'; };

/**
 * Идентификатор узла кластера cache (для distributed coordination)
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCacheNodeId} в CacheAdapterFactories.ts
 * @throws Error при пустой строке или не-string значении
 */
export type CacheNodeId = string & { readonly __brand: 'CacheNodeId'; };

// ==================== CACHE REQUEST / RESPONSE ====================

/** Cache GET запрос (transport-level) */
export type CacheGetRequest = Readonly<{
  key: CacheKey;
  timeoutMs?: CacheTimeoutMs;
}>;

/** Cache SET запрос (transport-level) */
export type CacheSetRequest = Readonly<{
  key: CacheKey;
  value: CacheValue;
  ttlMs?: CacheTtlMs;
  timeoutMs?: CacheTimeoutMs;
}>;

/** Cache DELETE запрос (transport-level) */
export type CacheDeleteRequest = Readonly<{
  key: CacheKey;
  timeoutMs?: CacheTimeoutMs;
}>;

/** Cache EXISTS запрос (transport-level) */
export type CacheExistsRequest = Readonly<{
  key: CacheKey;
  timeoutMs?: CacheTimeoutMs;
}>;

/** Cache TTL запрос (transport-level) */
export type CacheTtlRequest = Readonly<{
  key: CacheKey;
  timeoutMs?: CacheTimeoutMs;
}>;

/** Унифицированный Cache запрос */
export type CacheRequest =
  | Readonly<{ type: 'get'; request: CacheGetRequest; }>
  | Readonly<{ type: 'set'; request: CacheSetRequest; }>
  | Readonly<{ type: 'delete'; request: CacheDeleteRequest; }>
  | Readonly<{ type: 'exists'; request: CacheExistsRequest; }>
  | Readonly<{ type: 'ttl'; request: CacheTtlRequest; }>;

/** Cache GET ответ */
export type CacheGetResponse = Readonly<{
  key: CacheKey;
  value: CacheValue | null; // null = cache miss
  durationMs: CacheDurationMs;
}>;

/** Cache SET ответ */
export type CacheSetResponse = Readonly<{
  key: CacheKey;
  success: boolean;
  durationMs: CacheDurationMs;
}>;

/** Cache DELETE ответ */
export type CacheDeleteResponse = Readonly<{
  key: CacheKey;
  deleted: boolean;
  durationMs: CacheDurationMs;
}>;

/** Cache EXISTS ответ */
export type CacheExistsResponse = Readonly<{
  key: CacheKey;
  exists: boolean;
  durationMs: CacheDurationMs;
}>;

/** Cache TTL ответ */
export type CacheTtlResponse = Readonly<{
  key: CacheKey;
  ttlMs: number; // -2 = key not exists, -1 = no TTL, >0 = TTL in ms
  durationMs: CacheDurationMs;
}>;

/** Унифицированный Cache ответ */
export type CacheResponse =
  | Readonly<{ type: 'get'; response: CacheGetResponse; }>
  | Readonly<{ type: 'set'; response: CacheSetResponse; }>
  | Readonly<{ type: 'delete'; response: CacheDeleteResponse; }>
  | Readonly<{ type: 'exists'; response: CacheExistsResponse; }>
  | Readonly<{ type: 'ttl'; response: CacheTtlResponse; }>;

// ==================== CIRCUIT BREAKER ====================

/**
 * Ключ circuit breaker для Cache
 *
 * Обычно: cacheInstanceId + operation type
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCacheCircuitBreakerKey} в CacheAdapterFactories.ts
 * @throws Error при пустом значении
 */
export type CacheCircuitBreakerKey = string & { readonly __brand: 'CacheCircuitBreakerKey'; };

/**
 * Порог circuit breaker для Cache
 *
 * @boundary-validation Гарантируется фабрикой {@link makeCircuitBreakerThreshold} в CacheAdapterFactories.ts
 * @throws Error при значениях вне допустимого диапазона
 */
export type CacheCircuitBreakerThreshold = number & {
  readonly __brand: 'CacheCircuitBreakerThreshold';
};

// ==================== ОШИБКИ КЕША ====================

/**
 * Типизированная ошибка Cache-адаптера (transport-level)
 *
 * ❗ Не бизнес-ошибка
 * ❗ Используется для нормализации и ErrorStrategies
 */
export type CacheError =
  | Readonly<{
    _tag: 'CacheConnectionError';
    message: string;
    code?: string;
  }>
  | Readonly<{
    _tag: 'CacheTimeoutError';
    timeoutMs: CacheTimeoutMs;
  }>
  | Readonly<{
    _tag: 'CacheSerializationError';
    message: string;
  }>
  | Readonly<{
    _tag: 'CacheKeyNotFound';
    key: CacheKey;
  }>
  | Readonly<{
    _tag: 'CacheClusterError';
    message: string;
    nodeId?: CacheNodeId;
  }>
  | Readonly<{
    _tag: 'CacheUnknownError';
    original: unknown;
  }>;

// ==================== РЕЗУЛЬТАТ ПРИМЕНЕНИЯ СТРАТЕГИИ ОБРАБОТКИ ОШИБОК ====================

/**
 * Решение стратегии обработки Cache ошибки
 *
 * success — операция успешна
 * retry   — можно повторить запрос
 * fail    — фатальная ошибка
 * degrade — перейти на деградацию (fallback на DB, etc.)
 */
export type CacheStrategyDecision =
  | Readonly<{ type: 'success'; }>
  | Readonly<{
    type: 'retry';
    retryAfterMs?: CacheTimeoutMs;
  }>
  | Readonly<{
    type: 'fail';
    errorCode: LivAiErrorCode;
    openCircuit?: boolean;
  }>
  | Readonly<{
    type: 'degrade';
    fallback: 'database' | 'memory' | 'noop';
    maxRetries?: CacheMaxRetries;
  }>;

// ==================== КОНФИГУРАЦИЯ CACHE АДАПТЕРА ====================

/** Опции Cache адаптера */
export type CacheAdapterOptions = Readonly<{
  instanceId?: CacheInstanceId;
  timeoutMs?: CacheTimeoutMs;
  maxRetries?: CacheMaxRetries;
  retryDelayMs?: CacheTimeoutMs;
  circuitBreakerThreshold?: CacheCircuitBreakerThreshold;
  circuitBreakerRecoveryMs?: CacheTimeoutMs;
  circuitBreakerEnabled?: boolean;
  retriesEnabled?: boolean;
  defaultTtlMs?: CacheTtlMs;
  compressionEnabled?: boolean;
  serializationFormat?: 'json' | 'msgpack' | 'binary';
  clusterEnabled?: boolean;
  clusterNodes?: readonly CacheNodeId[]; // ignored when clusterEnabled=false
  metricsEnabled?: boolean;
}>;

// ==================== КОНТЕКСТ CACHE АДАПТЕРА ====================

/** Контекст Cache-адаптера (transport-level). Используется для дефолтов и DI */
export type CacheAdapterContext = Readonly<{
  instanceId: CacheInstanceId;
  defaultTimeoutMs?: CacheTimeoutMs;
  defaultTtlMs?: CacheTtlMs;
  maxRetries?: CacheMaxRetries;
}>;
