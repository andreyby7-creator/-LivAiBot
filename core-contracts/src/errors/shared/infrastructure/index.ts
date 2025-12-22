/**
 * @file index.ts - Экспорт всех инфраструктурных ошибок
 *
 * Предоставляет единый entry point для всех инфраструктурных ошибок LivAiBot.
 * Общие ошибки инфраструктуры: базы данных, кеша, сети, внешних API.
 */

import type { CacheError } from './CacheError.js';
import type { DatabaseError } from './DatabaseError.js';
import type { ExternalAPIError } from './ExternalAPIError.js';
import type { NetworkError } from './NetworkError.js';

// ==================== INFRASTRUCTURE ERRORS ====================

/**
 * Union тип всех инфраструктурных ошибок
 */
export type InfrastructureError = DatabaseError | CacheError | NetworkError | ExternalAPIError;

// ==================== RE-EXPORTS ====================

export type { DatabaseError, DatabaseErrorContext } from './DatabaseError.js';

export type { CacheError, CacheErrorContext } from './CacheError.js';

export type { NetworkError, NetworkErrorContext } from './NetworkError.js';

export type { ExternalAPIError, ExternalAPIErrorContext } from './ExternalAPIError.js';

// Builders
export {
  createDatabaseError,
  getDatabaseConnection,
  getDatabaseOperation,
  getDatabaseType,
  getTableName,
  isDatabaseConnectionError,
  isDatabaseError,
  isValidDatabaseErrorContext,
} from './DatabaseError.js';

export {
  createCacheError,
  getCacheConnection,
  getCacheKey,
  getCacheOperation,
  isCacheConnectionError,
  isCacheError,
  isValidCacheErrorContext,
} from './CacheError.js';

export {
  createNetworkError,
  getHttpRequestInfo,
  getNetworkConnection,
  getNetworkUrl,
  isHttpError,
  isNetworkError,
  isTimeoutError,
  isValidNetworkErrorContext,
} from './NetworkError.js';

export {
  createExternalAPIError,
  getAPIConnection,
  getAPIRateLimit,
  getAPIRetryInfo,
  getAPIServiceInfo,
  isExternalAPIError,
  isRateLimitError,
  isRetryableError,
  isValidExternalAPIErrorContext,
} from './ExternalAPIError.js';
