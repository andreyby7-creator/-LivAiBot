/**
 * @file Cache нормализатор ошибок для LivAiBot
 *
 * Чистая функция нормализации cache ошибок. Преобразует неизвестные ошибки
 * в стандартизированные TaggedError типы с извлечением метаданных.
 *
 * Поддерживает Redis, Memcached, In-memory cache и другие cache системы.
 *
 * @pattern Добавление нового типа кеша:
 * 1. Добавить тип в CacheOperationContext.cacheType: 'redis' | 'memcached' | ... | 'newcache'
 * 2. Создать константу с кодами ошибок: NEWCACHE_ERROR_CODES = { CODE: 'CODE' } as const
 * 3. Добавить extract функцию: extractFromNewCacheCode(code: string, details)
 * 4. Обновить extractFromCacheCode() для обработки нового типа
 * 5. Добавить соответствующие коды ошибок в константу
 * 6. Протестировать новую функциональность
 *
 * Пример для добавления DynamoDB cache:
 * 1. Добавить тип: cacheType?: 'redis' | 'memcached' | 'dynamodb' | 'other'
 * 2. Создать константу: const DYNAMODB_ERROR_CODES = { THROTTLING_EXCEPTION: 'THROTTLING_EXCEPTION' } as const
 * 3. Добавить extract функцию с проверкой на наличие кода в списке ошибок
 * 4. Обновить extractFromCacheCode() аналогичной проверкой для нового типа кеша
 */

import { LIVAI_ERROR_CODES } from '../../base/ErrorCode.js';
import { createCacheError } from '../infrastructure/CacheError.js';

import type { CacheInstanceId, CacheKey, CacheTtlMs } from '../adapters/cache/CacheAdapterTypes.js';
import type { CacheError, CacheErrorContext } from '../infrastructure/CacheError.js';
import type { SharedAdapterError } from '../SharedErrorTypes.js';

/** Коды ошибок Redis - расширяемые, автоматически обрабатываются нормализатором */
const REDIS_ERROR_CODES = {
  BUSY: 'BUSY',
  CLUSTERDOWN: 'CLUSTERDOWN',
  LOADING: 'LOADING',
  MASTERDOWN: 'MASTERDOWN',
  MISCONF: 'MISCONF',
  NOAUTH: 'NOAUTH',
  NOSCRIPT: 'NOSCRIPT',
  NOTBUSY: 'NOTBUSY',
  READONLY: 'READONLY',
  WRONGPASS: 'WRONGPASS',
  WRONGTYPE: 'WRONGTYPE',
} as const;

/** Коды ошибок Memcached - расширяемые, автоматически обрабатываются нормализатором */
const MEMCACHED_ERROR_CODES = {
  CONNECTION_FAILURE: 'CONNECTION_FAILURE',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  KEY_EXISTS: 'KEY_EXISTS',
  VALUE_TOO_LARGE: 'VALUE_TOO_LARGE',
} as const;

/** Ключевые слова для определения типов ошибок */
const CONNECTION_KEYWORDS = [
  'connection',
  'connect',
  'econnrefused',
  'enotfound',
  'econnreset',
  'disconnected',
  'socket hang up',
];
const TIMEOUT_KEYWORDS = ['timeout', 'timed out', 'etimedout'];
const SERIALIZATION_KEYWORDS = ['serialization', 'json', 'encoding'];
const CLUSTER_KEYWORDS = ['cluster', 'node'];

/** Единый fallback для неизвестных типов ошибок */
const UNKNOWN_ERROR_FALLBACK = {
  message: 'Unknown cache error',
  isConnectionError: false,
  isTimeoutError: false,
  isSerializationError: false,
  isClusterError: false,
  details: {} as Record<string, unknown>,
};

/** Входные данные ошибки cache */
export type CacheErrorInput = unknown;

/** Результат нормализации ошибки cache */
export type CacheNormalizationResult =
  | CacheError
  | SharedAdapterError<Record<string, unknown>>;

/** Диагностический логгер для нормализатора */
export type CacheNormalizerLogger = {
  warn(message: string, context?: Record<string, unknown>): void;
};

/** Контекст операции cache - expandable types (см. паттерн в начале файла) */
export type CacheOperationContext = {
  readonly cacheType?: 'redis' | 'memcached' | 'memory' | 'other';
  readonly operation?: 'get' | 'set' | 'delete' | 'exists' | 'ttl';
  readonly key?: CacheKey;
  readonly instanceId?: CacheInstanceId;
  readonly clusterNode?: string;
  readonly serializationFormat?: 'json' | 'msgpack' | 'binary';
  readonly ttlMs?: CacheTtlMs;
  readonly connectionString?: string;
  readonly command?: string;
  readonly args?: readonly unknown[];
  readonly errorCode?: string | number;
  readonly errorMessage?: string;
};

/** Создает контекст ошибки с фильтрацией undefined/null значений */
function createErrorContext(baseContext: Record<string, unknown>): CacheErrorContext | undefined {
  // Допустимые поля для CacheErrorContext
  const ALLOWED_KEYS: (keyof CacheErrorContext)[] = [
    'cacheType',
    'key',
    'operation',
    'connectionId',
    'instanceId',
    'host',
    'namespace',
    'ttlMs',
    'port',
  ];

  const filtered = Object.fromEntries(
    Object.entries(baseContext)
      .filter(([k]) => ALLOWED_KEYS.includes(k as keyof CacheErrorContext))
      .filter(([, v]) => v != null && (typeof v !== 'number' || Number.isInteger(v))),
  );

  return Object.keys(filtered).length > 0 ? filtered as CacheErrorContext : undefined;
}

/** Общая функция для проверки типа ошибки по коду */
function isCacheErrorOfCode(result: CacheNormalizationResult, code: string): boolean {
  return '_tag' in result && result._tag === 'CacheError' && result.code === code;
}

/** Type guard для проверки connection ошибок */
export const isCacheConnectionError = (result: CacheNormalizationResult): boolean =>
  isCacheErrorOfCode(result, LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);

/** Type guard для проверки serialization ошибок */
export const isCacheSerializationError = (result: CacheNormalizationResult): boolean =>
  isCacheErrorOfCode(result, LIVAI_ERROR_CODES.INFRA_CACHE_SET_FAILED);

/** Type guard для проверки cluster ошибок (синоним connection) */
export const isCacheClusterError = isCacheConnectionError;

/** Type guard для проверки timeout ошибок (синоним connection) */
export const isCacheTimeoutError = isCacheConnectionError;

/** Type guard для проверки generic cache ошибок */
export const isCacheGenericError = (result: CacheNormalizationResult): boolean =>
  isCacheErrorOfCode(result, LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED);

/** Type guard для проверки unknown/fallback ошибок (синоним generic) */
export const isCacheUnknownError = isCacheGenericError;

/**
 * Нормализует неизвестную ошибку cache в TaggedError
 * @param input Неизвестная ошибка cache
 * @param context Контекст операции для диагностики
 * @param logger Опциональный логгер для диагностики (по умолчанию отключен)
 * @returns Нормализованная ошибка
 * @diagnostic Логирует warning при неожиданных типах, передает в details контекст и метаданные
 * @safe Не кидает исключения, сохраняет все данные в details
 */
export function normalizeCacheError(
  input: CacheErrorInput,
  context: CacheOperationContext = {},
  logger?: CacheNormalizerLogger,
): CacheNormalizationResult {
  try {
    // Если это уже нормализованная ошибка, возвращаем как есть
    if (isNormalizedCacheError(input)) {
      return input;
    }

    // Логируем warning для неожиданных типов ошибок
    if (typeof input === 'string') {
      logger?.warn(
        '[CacheNormalizer] Received string error, this may indicate incomplete error information:',
        { input },
      );
    } else if (
      typeof input === 'object' && input !== null && !('code' in input) && !(input instanceof Error)
    ) {
      logger?.warn(
        '[CacheNormalizer] Received object error without code field, this may indicate incomplete error information:',
        { input },
      );
    }

    // Анализируем ошибку по типам
    const errorInfo = extractCacheErrorInfo(input);

    // Объединяет details ошибки с контекстом операции для создания CacheErrorContext
    const mergeErrorContext = (
      details: Record<string, unknown>,
      ctx: CacheOperationContext,
    ): CacheErrorContext | undefined => {
      return createErrorContext({
        ...details,
        cacheType: ctx.cacheType,
        key: ctx.key,
        operation: ctx.operation,
        instanceId: ctx.instanceId,
        clusterNode: ctx.clusterNode,
        ttlMs: ctx.ttlMs,
        serializationFormat: ctx.serializationFormat,
        connectionString: ctx.connectionString,
        command: ctx.command,
        args: ctx.args,
        errorCode: ctx.errorCode,
        errorMessage: ctx.errorMessage,
      });
    };

    // Определяем тип ошибки на основе анализа
    if (errorInfo.isConnectionError) {
      return createCacheError(
        LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED,
        errorInfo.message,
        mergeErrorContext(errorInfo.details, context),
      );
    }

    if (errorInfo.isTimeoutError) {
      return createCacheError(
        LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED,
        errorInfo.message,
        mergeErrorContext(errorInfo.details, context),
      );
    }

    if (errorInfo.isSerializationError) {
      return createCacheError(
        LIVAI_ERROR_CODES.INFRA_CACHE_SET_FAILED,
        errorInfo.message,
        mergeErrorContext(errorInfo.details, context),
      );
    }

    if (errorInfo.isClusterError) {
      return createCacheError(
        LIVAI_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED,
        errorInfo.message,
        mergeErrorContext(errorInfo.details, context),
      );
    }

    // Для всех остальных ошибок - общая cache ошибка
    return createCacheError(
      LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED,
      errorInfo.message,
      mergeErrorContext(errorInfo.details, context),
    );
  } catch (normalizationError) {
    // Безопасное поведение: никогда не кидаем исключения в нормализаторе
    logger?.warn(
      '[CacheNormalizer] Unexpected error during normalization, returning safe fallback:',
      {
        normalizationError: normalizationError instanceof Error
          ? normalizationError.message
          : String(normalizationError),
        input,
        context,
      },
    );

    // Возвращаем безопасный fallback с сохранением всех входных данных
    const safeDetails: Record<string, unknown> = {
      originalInput: input,
      normalizationError: normalizationError instanceof Error
        ? normalizationError.message
        : String(normalizationError),
      // Сохраняем весь контекст для полной диагностики
      operationContext: context,
    };

    // Добавляем stack trace нормализационной ошибки
    const finalDetails = {
      ...safeDetails,
      ...(normalizationError instanceof Error && normalizationError.stack != null && {
        normalizationStack: normalizationError.stack,
      }),
    };

    return createCacheError(
      LIVAI_ERROR_CODES.INFRA_CACHE_GET_FAILED,
      'Cache operation failed with normalization error',
      createErrorContext({
        ...finalDetails,
        cacheType: context.cacheType,
        key: context.key,
        operation: context.operation,
        instanceId: context.instanceId,
        clusterNode: context.clusterNode,
        ttlMs: context.ttlMs,
        serializationFormat: context.serializationFormat,
        connectionString: context.connectionString,
        command: context.command,
        args: context.args,
        errorCode: context.errorCode,
        errorMessage: context.errorMessage,
      }),
    );
  }
}

/** Извлекает информацию об ошибке из null/undefined входа */
function extractFromNull(): {
  message: string;
  isConnectionError: boolean;
  isTimeoutError: boolean;
  isSerializationError: boolean;
  isClusterError: boolean;
  details: Record<string, unknown>;
} {
  return {
    message: 'Cache operation failed with null/undefined error',
    isConnectionError: false,
    isTimeoutError: false,
    isSerializationError: false,
    isClusterError: false,
    details: {},
  };
}

/** Извлекает информацию об ошибке из Error объекта */
function extractFromError(input: Error): {
  message: string;
  isConnectionError: boolean;
  isTimeoutError: boolean;
  isSerializationError: boolean;
  isClusterError: boolean;
  details: Record<string, unknown>;
} {
  const message = input.message.toLowerCase();
  const details: Record<string, unknown> = {
    originalMessage: input.message,
    stack: input.stack,
  };

  // Определение типа ошибки по ключевым словам
  const isConnectionError = CONNECTION_KEYWORDS.some((keyword) => message.includes(keyword));
  const isTimeoutError = TIMEOUT_KEYWORDS.some((keyword) => message.includes(keyword));

  // Сериализация ошибок: JSON parse/stringify + ключевые слова
  const isJsonParseError = message.includes('json') && message.includes('parse');
  const isJsonStringifyError = message.includes('json') && message.includes('stringify');
  const isSerializationError = SERIALIZATION_KEYWORDS.some((keyword) => message.includes(keyword))
    || isJsonParseError
    || isJsonStringifyError;

  // Кластерные ошибки: node/master/slave down
  const isNodeDownError = message.includes('node') && message.includes('down');
  const isMasterDownError = message.includes('master') && message.includes('down');
  const isSlaveDownError = message.includes('slave') && message.includes('down');
  const isClusterError = CLUSTER_KEYWORDS.some((keyword) => message.includes(keyword))
    || isNodeDownError
    || isMasterDownError
    || isSlaveDownError;

  return {
    message: input.message || 'Cache operation failed',
    isConnectionError,
    isTimeoutError,
    isSerializationError,
    isClusterError,
    details,
  };
}

/**
 * Извлекает информацию об ошибке из кода ошибки кеша (Redis/Memcached)
 * @pattern Для нового типа кеша: создать константу кодов и добавить проверку в функцию
 */
function extractFromCacheCode(code: string, details: Record<string, unknown>): {
  message: string;
  isConnectionError: boolean;
  isTimeoutError: boolean;
  isSerializationError: boolean;
  isClusterError: boolean;
  details: Record<string, unknown>;
} {
  const upperCode = code.toUpperCase();

  // Сначала проверяем Redis коды
  const isKnownRedisCode = Object.values(REDIS_ERROR_CODES).includes(
    upperCode as keyof typeof REDIS_ERROR_CODES,
  );

  if (isKnownRedisCode) {
    // Redis specific error classification
    const isConnectionError = upperCode === REDIS_ERROR_CODES.CLUSTERDOWN
      || upperCode === REDIS_ERROR_CODES.MASTERDOWN
      || upperCode === REDIS_ERROR_CODES.WRONGPASS
      || upperCode === REDIS_ERROR_CODES.NOAUTH
      || upperCode === REDIS_ERROR_CODES.LOADING
      || upperCode.includes('CONNECTION')
      || upperCode.includes('CONNECT');

    const isClusterError = upperCode === REDIS_ERROR_CODES.CLUSTERDOWN
      || upperCode === REDIS_ERROR_CODES.MASTERDOWN
      || upperCode.includes('CLUSTER');

    const isTimeoutError = false; // Redis doesn't have specific timeout codes in this list

    const isSerializationError = upperCode === REDIS_ERROR_CODES.WRONGTYPE
      || upperCode.includes('SERIALIZ');

    return {
      message: 'Redis operation failed',
      isConnectionError,
      isTimeoutError,
      isSerializationError,
      isClusterError,
      details,
    };
  }

  // Затем проверяем Memcached коды
  const isKnownMemcachedCode = Object.values(MEMCACHED_ERROR_CODES).includes(
    upperCode as keyof typeof MEMCACHED_ERROR_CODES,
  );

  if (isKnownMemcachedCode) {
    // Memcached specific error classification
    const isConnectionError = upperCode === MEMCACHED_ERROR_CODES.CONNECTION_FAILURE
      || upperCode.includes('CONNECTION');

    const isSerializationError = upperCode === MEMCACHED_ERROR_CODES.VALUE_TOO_LARGE
      || upperCode.includes('SERIALIZ');

    const isTimeoutError = false; // Memcached doesn't have specific timeout codes in this list

    const isClusterError = false; // Memcached typically doesn't have cluster-specific errors in this list

    return {
      message: 'Memcached operation failed',
      isConnectionError,
      isTimeoutError,
      isSerializationError,
      isClusterError,
      details,
    };
  }

  // Неизвестный код ошибки - проверяем ключевые слова в самом коде
  const lowerCode = code.toLowerCase();

  const isConnectionError = CONNECTION_KEYWORDS.some((keyword) => lowerCode.includes(keyword));
  const isTimeoutError = TIMEOUT_KEYWORDS.some((keyword) => lowerCode.includes(keyword));
  const isSerializationError = SERIALIZATION_KEYWORDS.some((keyword) =>
    lowerCode.includes(keyword)
  );
  const isClusterError = CLUSTER_KEYWORDS.some((keyword) => lowerCode.includes(keyword));

  return {
    message: `Cache operation failed with code: ${code}`,
    isConnectionError,
    isTimeoutError,
    isSerializationError,
    isClusterError,
    details,
  };
}

/** Извлекает информацию об ошибке из строкового входа */
function extractFromString(input: string): {
  message: string;
  isConnectionError: boolean;
  isTimeoutError: boolean;
  isSerializationError: boolean;
  isClusterError: boolean;
  details: Record<string, unknown>;
} {
  const lowerMessage = input.toLowerCase();

  const isConnectionError = CONNECTION_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
  const isTimeoutError = TIMEOUT_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
  const isSerializationError = SERIALIZATION_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );
  const isClusterError = CLUSTER_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));

  return {
    message: input,
    isConnectionError,
    isTimeoutError,
    isSerializationError,
    isClusterError,
    details: {},
  };
}

/**
 * Извлекает информацию об ошибке из неизвестного входа
 * @safe Не кидает исключения, сохраняет все данные в details
 */
function extractCacheErrorInfo(
  input: CacheErrorInput,
): {
  message: string;
  isConnectionError: boolean;
  isTimeoutError: boolean;
  isSerializationError: boolean;
  isClusterError: boolean;
  details: Record<string, unknown>;
} {
  // Обработка null/undefined
  if (input == null) {
    return extractFromNull();
  }

  // Обработка Error объектов
  if (input instanceof Error) {
    return extractFromError(input);
  }

  // Обработка объектов с кодом ошибки
  if (typeof input === 'object') {
    const errorObj = input as Record<string, unknown>;
    const code = errorObj['code'] as string | number | undefined;
    const details: Record<string, unknown> = { ...errorObj };

    // Обработка кодов ошибок кеша (Redis или Memcached)
    if (typeof code === 'string') {
      return extractFromCacheCode(code, details);
    }

    // Объект без распознаваемого кода - проверяем ключевые слова в message
    const message = (errorObj['message'] as string) || '';
    const lowerMessage = message.toLowerCase();

    const isConnectionError = CONNECTION_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
    const isTimeoutError = TIMEOUT_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));

    // Сериализация ошибок: JSON parse/stringify + ключевые слова
    const isJsonParseError = lowerMessage.includes('json') && lowerMessage.includes('parse');
    const isJsonStringifyError = lowerMessage.includes('json')
      && lowerMessage.includes('stringify');
    const isSerializationError = SERIALIZATION_KEYWORDS.some((keyword) =>
      lowerMessage.includes(keyword)
    ) || isJsonParseError || isJsonStringifyError;

    // Кластерные ошибки: node/master/slave down
    const isNodeDownError = lowerMessage.includes('node') && lowerMessage.includes('down');
    const isMasterDownError = lowerMessage.includes('master') && lowerMessage.includes('down');
    const isSlaveDownError = lowerMessage.includes('slave') && lowerMessage.includes('down');
    const isClusterError = CLUSTER_KEYWORDS.some((keyword) =>
      lowerMessage.includes(keyword)
    )
      || isNodeDownError
      || isMasterDownError
      || isSlaveDownError;

    return {
      message: message || 'Cache operation failed with unknown object error',
      isConnectionError,
      isTimeoutError,
      isSerializationError,
      isClusterError,
      details,
    };
  }

  // Обработка строковых ошибок
  if (typeof input === 'string') {
    return extractFromString(input);
  }

  // Fallback для неизвестных типов
  return {
    ...UNKNOWN_ERROR_FALLBACK,
    message: `Cache operation failed with unknown error type: ${typeof input}`,
    details: { originalError: input },
  };
}

/** Type guard для проверки нормализованной cache ошибки */
function isNormalizedCacheError(
  input: CacheErrorInput,
): input is CacheNormalizationResult {
  if (input == null || typeof input !== 'object') {
    return false;
  }

  const obj = input as Record<string, unknown>;
  return (
    typeof obj['_tag'] === 'string'
    && (obj['_tag'] === 'CacheError'
      || obj['_tag'] === 'SharedAdapterError'
      || obj['_tag'] === 'NetworkError')
  );
}
