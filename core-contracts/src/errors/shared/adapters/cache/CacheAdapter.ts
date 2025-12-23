/**
 * @file CacheAdapter.ts - Cache адаптер LivAiBot
 *
 * Boundary + side-effects компонент. НЕ нормализует ошибки, НЕ решает стратегии, НЕ содержит бизнес-логику.
 * ДЕЛАЕТ Cache I/O, retry/timeout/circuit breaker, unknown → BaseError, применение стратегий.
 * Только Effect. Никаких throw.
 */

import type { Effect } from 'effect';

import { createConfig } from './CacheAdapterConfig.js';
import { cacheDelete, cacheGet, cacheSet } from './CacheAdapterEffect.js';
import { cacheAdapterFactories } from './CacheAdapterFactories.js';

import type { CacheAdapterConfig } from './CacheAdapterConfig.js';
import type { CacheClient, CircuitBreaker, Clock, Logger, Metrics } from './CacheAdapterEffect.js';
import type { CacheDurationMs, CacheKey, CacheTtlMs } from './CacheAdapterTypes.js';

// Clock, Logger, Metrics, CircuitBreaker типы определены в CacheAdapterEffect.ts

// NOTE:
// Bulk-операции (mget/mset) добавляются на уровне CacheAdapterEffect
// при наличии поддержки со стороны CacheClient.
// Adapter API расширяется только при стабилизации семантики partial-success.

/** Cache Adapter интерфейс */
export type CacheAdapter = {
  /**
   * Получает значение из cache
   * @param key Ключ cache
   * @param cacheClient Cache клиент
   * @param clock Clock сервис
   * @param logger Logger сервис
   * @param metrics Metrics сервис
   * @param circuitBreaker CircuitBreaker сервис
   * @returns Effect с результатом или ошибкой (null = cache miss)
   *
   * @note Timeout контролируется через конфигурацию адаптера
   * @note Bulk-операции (mget/mset) добавляются на уровне CacheAdapterEffect при поддержке CacheClient
   */
  get<T = unknown>(
    key: CacheKey,
    cacheClient: CacheClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<T | null, unknown, unknown>;

  /**
   * Записывает значение в cache
   * @param key Ключ cache
   * @param value Значение для записи
   * @param ttlMs Время жизни в миллисекундах
   * @param cacheClient Cache клиент
   * @param clock Clock сервис
   * @param logger Logger сервис
   * @param metrics Metrics сервис
   * @param circuitBreaker CircuitBreaker сервис
   * @returns Effect с результатом или ошибкой
   *
   * @note Timeout контролируется через конфигурацию адаптера
   * @note Bulk-операции (mget/mset) добавляются на уровне CacheAdapterEffect при поддержке CacheClient
   */
  set<T = unknown>(
    key: CacheKey,
    value: T,
    ttlMs: CacheTtlMs | undefined,
    cacheClient: CacheClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<void, unknown, unknown>;

  /**
   * Удаляет значение из cache
   * @param key Ключ cache
   * @param cacheClient Cache клиент
   * @param clock Clock сервис
   * @param logger Logger сервис
   * @param metrics Metrics сервис
   * @param circuitBreaker CircuitBreaker сервис
   * @returns Effect с результатом или ошибкой
   *
   * @note Timeout контролируется через конфигурацию адаптера
   * @note Bulk-операции (mget/mset) добавляются на уровне CacheAdapterEffect при поддержке CacheClient
   */
  delete(
    key: CacheKey,
    cacheClient: CacheClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<void, unknown, unknown>;
};

/** Реализация Cache Adapter */
export class CacheAdapterImpl implements CacheAdapter {
  private readonly config: CacheAdapterConfig;

  constructor(config: Partial<CacheAdapterConfig> = {}) {
    this.config = createConfig(config);
  }

  get<T = unknown>(
    key: CacheKey,
    cacheClient: CacheClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<T | null, unknown, unknown> {
    return cacheGet(
      key,
      cacheClient,
      clock,
      logger,
      metrics,
      circuitBreaker,
      this.config.maxRetries,
      this.config.retryDelay,
      this.config.timeoutMs,
    );
  }

  set<T = unknown>(
    key: CacheKey,
    value: T,
    ttlMs: CacheTtlMs | undefined,
    cacheClient: CacheClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<void, unknown, unknown> {
    return cacheSet(
      key,
      value,
      ttlMs,
      cacheClient,
      clock,
      logger,
      metrics,
      circuitBreaker,
      this.config.maxRetries,
      this.config.retryDelay,
      this.config.timeoutMs,
    );
  }

  delete(
    key: CacheKey,
    cacheClient: CacheClient,
    clock: Clock,
    logger: Logger,
    metrics: Metrics,
    circuitBreaker: CircuitBreaker,
  ): Effect.Effect<void, unknown, unknown> {
    return cacheDelete(
      key,
      cacheClient,
      clock,
      logger,
      metrics,
      circuitBreaker,
      this.config.maxRetries,
      this.config.retryDelay,
      this.config.timeoutMs,
    );
  }
}

/** Создает Cache Adapter с дефолтной конфигурацией */
export function createCacheAdapter(): CacheAdapter {
  return new CacheAdapterImpl();
}

/** Создает Cache Adapter с кастомной конфигурацией */
export function createCacheAdapterWithConfig(
  config: Partial<CacheAdapterConfig>,
): CacheAdapter {
  return new CacheAdapterImpl(config);
}

/**
 * Утилита для создания cache ключа
 *
 * @param key - Строка ключа
 * @returns Объект cache ключа
 */
export function createCacheKey(key: string): CacheKey {
  return cacheAdapterFactories.makeCacheKey(key);
}

/**
 * Утилита для создания TTL
 *
 * @param ttlMs - Время жизни в миллисекундах
 * @returns Объект TTL
 */
export function createCacheTtl(ttlMs: number): CacheTtlMs {
  return cacheAdapterFactories.makeCacheTtlMs(ttlMs);
}

/**
 * Утилита для создания duration (унификация с Effect метриками)
 *
 * @param durationMs - Длительность в миллисекундах
 * @returns Объект duration
 *
 * @note Используется в Effect пайплайнах для metrics/logging
 */
export function createCacheDuration(durationMs: number): CacheDurationMs {
  return cacheAdapterFactories.makeDurationMs(durationMs);
}
