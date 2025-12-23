/**
 * @file index.ts - Экспорт нормализаторов ошибок LivAiBot
 *
 * Предоставляет унифицированный интерфейс для нормализации ошибок из внешних источников.
 * Все нормализаторы - чистые функции без side effects, без DI, без Effect.
 */

import type { CacheNormalizationResult } from './CacheNormalizer.js';
import type { DatabaseNormalizationResult } from './DatabaseNormalizer.js';
import type { HttpNormalizationResult } from './HttpNormalizer.js';

// ==================== HTTP NORMALIZER ====================

/**
 * HTTP нормализатор - преобразует неизвестные HTTP ошибки в TaggedError
 */
export {
  extractHttpStatusCode,
  extractHttpUrl,
  type HttpErrorInput,
  type HttpNormalizationResult,
  type HttpRequestContext,
  isHttpAdapterError,
  isHttpNetworkError,
  normalizeHttpError,
} from './HttpNormalizer.js';

// ==================== DATABASE NORMALIZER ====================

/**
 * Database нормализатор - преобразует неизвестные ошибки БД в TaggedError с mapping SQL ошибок,
 * extraction constraint violations, transaction state analysis
 */
export {
  type DatabaseErrorInput,
  type DatabaseNormalizationResult,
  type DatabaseOperationContext,
  extractDatabaseType,
  isDatabaseErrorResult,
  isDatabaseInfraError,
  normalizeDatabaseError,
} from './DatabaseNormalizer.js';

// ==================== CACHE NORMALIZER ====================

/**
 * Cache нормализатор - преобразует неизвестные cache ошибки в TaggedError с
 * поддержкой Redis, Memcached, кластерных конфигураций и serialization ошибок
 */
export {
  type CacheErrorInput,
  type CacheNormalizationResult,
  type CacheNormalizerLogger,
  type CacheOperationContext,
  isCacheClusterError,
  isCacheConnectionError,
  isCacheGenericError,
  isCacheSerializationError,
  isCacheTimeoutError,
  isCacheUnknownError,
  normalizeCacheError,
} from './CacheNormalizer.js';

// ==================== TYPE EXPORTS ====================

/**
 * Общий тип для всех нормализаторов
 */
export type NormalizerResult =
  | HttpNormalizationResult
  | DatabaseNormalizationResult
  | CacheNormalizationResult;
