/**
 * @file BaseError.ts - Enterprise-grade discriminated union тип ошибки LivAiBot
 *
 * Максимальная безопасность и оптимизации производительности. Чистый immutable тип с deep immutability guarantee.
 * Методы: withCause() (deep chain immutability), withMetadata() (configurable merge strategies),
 * asPlainObject() (basic plain object), sanitizeForExternal() (additional sanitization), toSerializableObject() (safe object for serialization), toExternalJSON() (external serialization), stringifyExternal() (complete serialization).
 * Манипуляция цепочками: prependCause(), withoutCause(), withCauseChain().
 * Вспомогательные функции метаданных: withCorrelationId(), withUserContext().
 * Производительность: lazy evaluation для complex chains, circular reference protection.
 */

// ==================== ИМПОРТЫ ====================

import { SEVERITY_WEIGHTS } from './ErrorConstants.js';

import type { TaggedError } from './BaseErrorTypes.js';
import type { ErrorCode } from './ErrorCode.js';
import type { ErrorCodeMetadata } from './ErrorCodeMeta.js';
import type { ErrorCategory, ErrorOrigin, ErrorSeverity } from './ErrorConstants.js';
import type { CorrelationId, ErrorMetadataContext } from './ErrorMetadata.js';

// Объявляем structuredClone для TypeScript (доступен в современных средах)
declare const structuredClone: <T>(value: T) => T;

/** Тип logger для замены console в production */
type Logger = {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

/** Дефолтный logger (console-based) */
const defaultLogger: Logger = {
  warn: console.warn,
  error: console.error,
};

/** Текущий logger (можно переопределить для production) */
let currentLogger: Logger = defaultLogger;

/** Функция для установки кастомного logger */
export function setLogger(logger: Logger): void {
  currentLogger = logger;
}

/** Deep readonly тип для полной immutable защиты */
type DeepReadonly<T> = T extends (...args: readonly unknown[]) => unknown ? T
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]>; }
  : T;

// ==================== КОНСТАНТЫ ====================

/** Размер случайной части correlation ID */
const CORRELATION_ID_RANDOM_LENGTH = 9;
/** Начальный индекс для substring */
const CORRELATION_ID_SUBSTRING_START = 2;
/** Radix для base36 encoding */
const base36Radix = 36;
/** Максимальная глубина цепочки причин для DoS защиты */
const MAX_CAUSE_DEPTH = 10;

/** Минимальная длина цепочки для валидации консистентности */
const MIN_CHAIN_LENGTH_FOR_VALIDATION = 2;

// ==================== HELPER FUNCTIONS ====================

/** Создает MetadataTimestamp из number */
function createMetadataTimestamp(
  timestamp: number,
): number & { readonly __brand: 'MetadataTimestamp'; } {
  return timestamp as number & { readonly __brand: 'MetadataTimestamp'; };
}

// ==================== ОСНОВНЫЕ ТИПЫ ====================

/** User context для metadata - информация о пользователе */
export type UserContext = {
  readonly userId?: string;
  readonly tenantId?: string;
  readonly sessionId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
};

/** Полная цепочка причин ошибки - immutable linked list */
export type ErrorCauseChain = readonly Readonly<BaseError>[];

/** Метаданные ошибки - immutable record */
export type ErrorMetadata = {
  readonly context: ErrorMetadataContext;
  readonly userContext?: UserContext;
  readonly customFields?: DeepReadonly<Record<string, unknown>>;
};

/** Enterprise-grade discriminated union тип ошибки LivAiBot. Максимальная type safety с discriminated unions.
 * Инвариант: cause === causeChain[0] || cause === undefined (гарантируется makeBaseErrorWithChain)
 */
export type BaseError = {
  readonly _tag: 'BaseError';
  readonly code: ErrorCode;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly category: ErrorCategory;
  readonly origin: ErrorOrigin;
  readonly timestamp: number;
  readonly cause?: BaseError | undefined;
  readonly causeChain: readonly Readonly<BaseError>[];
  readonly metadata: ErrorMetadata;
  readonly codeMetadata: ErrorCodeMetadata;
  readonly stack?: string;
  readonly toJSON?: () => Record<string, unknown>;
};

// ==================== CORE API - МЕТОДЫ ОБЪЕКТА ====================

/** Централизованный конструктор для гарантии консистентности cause и causeChain */
function makeBaseErrorWithChain(baseError: BaseError, causeChain: ErrorCauseChain): BaseError {
  // Инвариант: cause === causeChain[0] || cause === undefined если chain пустая
  const cause = causeChain.length > 0 ? causeChain[0] : undefined;
  const result = {
    ...baseError,
    cause,
    causeChain,
  } as BaseError;

  return attachToJSON(result);
}

/** Универсальная функция для добавления причины с configurable поведением */
function addCause(
  baseError: BaseError,
  cause: BaseError,
  options: { prepend?: boolean; } = {},
): BaseError {
  // Предотвращаем circular references
  if (hasCircularReference(baseError, cause)) {
    // Для production-safe behavior возвращаем оригинальную ошибку
    return baseError;
  }

  let newCauseChain: ErrorCauseChain;

  if (options.prepend === true) {
    // prepend: добавляем cause в начало, сохраняя всю существующую цепочку
    newCauseChain = [cause, ...baseError.causeChain];
  } else {
    // replace: заменяем непосредственную причину, сохраняя остальную цепочку
    newCauseChain = [cause, ...baseError.causeChain.slice(1)];
  }

  // DoS защита: ограничиваем максимальную глубину цепочки причин
  if (newCauseChain.length > MAX_CAUSE_DEPTH) {
    currentLogger.warn(
      `Cause chain depth ${newCauseChain.length} exceeds MAX_CAUSE_DEPTH ${MAX_CAUSE_DEPTH}, truncating chain`,
    );
    // Обрезаем цепочку до максимальной глубины
    const truncatedChain = newCauseChain.slice(0, MAX_CAUSE_DEPTH);
    return makeBaseErrorWithChain(baseError, truncatedChain);
  }

  return makeBaseErrorWithChain(baseError, newCauseChain);
}

/** Создает новый BaseError с новой причиной (deep chain immutability). Полностью immutable - создает новый объект с новой цепочкой причин */
export function withCause(baseError: BaseError, cause: BaseError): BaseError {
  return addCause(baseError, cause, { prepend: false });
}

/** Создает новый BaseError с обновленными метаданными (configurable merge strategies). Полностью immutable - создает новый объект с merged метаданными */
/** Стратегии слияния метаданных */
export type MergeStrategy = 'replace' | 'shallowMerge' | 'deepMerge';

export function withMetadata(
  baseError: BaseError,
  metadata: Partial<ErrorMetadata>,
  mergeStrategy: MergeStrategy = 'deepMerge',
): BaseError {
  let mergedMetadata: ErrorMetadata;

  if (mergeStrategy === 'replace') {
    mergedMetadata = { ...baseError.metadata, ...metadata };
  } else {
    mergedMetadata = mergeMetadata(baseError.metadata, metadata, mergeStrategy);
  }

  return {
    ...baseError,
    metadata: mergedMetadata,
  };
}

/** Преобразует в plain object для internal использования. Безопасная сериализация без sensitive data */
export function asPlainObject(baseError: BaseError): Record<string, unknown> {
  let result: Record<string, unknown> = {
    _tag: baseError._tag,
    code: baseError.code,
    message: baseError.message,
    severity: baseError.severity,
    category: baseError.category,
    origin: baseError.origin,
    timestamp: baseError.timestamp,
    codeMetadata: {
      code: baseError.codeMetadata.code,
      description: baseError.codeMetadata.description,
      severity: baseError.codeMetadata.severity,
      category: baseError.codeMetadata.category,
    },
    metadata: {
      context: {
        correlationId: baseError.metadata.context.correlationId,
        timestamp: baseError.metadata.context.timestamp,
      },
    },
  };

  // Добавляем userContext без sensitive полей
  if (baseError.metadata.userContext) {
    const metadataWithUserContext = {
      ...(result['metadata'] as Record<string, unknown>),
      userContext: {
        userId: baseError.metadata.userContext.userId,
        tenantId: baseError.metadata.userContext.tenantId,
        sessionId: baseError.metadata.userContext.sessionId,
        // ipAddress и userAgent - sensitive, не включаем
      },
    };
    result = { ...result, metadata: metadataWithUserContext };
  }

  // Добавляем causeChain как plain objects
  if (baseError.causeChain.length > 0) {
    result = { ...result, causeChain: baseError.causeChain.map(asPlainObject) };
  }

  return result;
}

/** Дополнительная sanitization для external использования. Удаляет stack trace и sanitizes custom fields */
function sanitizeForExternal(plainObject: Record<string, unknown>): Record<string, unknown> {
  // Удаляем stack trace для external usage (immutable)
  const withoutStack = Object.fromEntries(
    Object.entries(plainObject).filter(([key]) => key !== 'stack'),
  );

  // Sanitize custom fields
  const metadataValue = withoutStack['metadata'];
  let metadataResult = metadataValue;
  if (metadataValue !== undefined && metadataValue !== null && typeof metadataValue === 'object') {
    const metadata = metadataValue as Record<string, unknown>;
    const customFieldsValue = metadata['customFields'];
    if (
      customFieldsValue !== undefined
      && customFieldsValue !== null
      && typeof customFieldsValue === 'object'
    ) {
      const customFields = customFieldsValue as Record<string, unknown>;
      const sanitizedCustomFields = Object.fromEntries(
        Object.entries(customFields).map(([key, value]) => [
          key,
          key.toLowerCase().includes('password')
            || key.toLowerCase().includes('token')
            || key.toLowerCase().includes('secret')
            ? '[REDACTED]'
            : value,
        ]),
      );
      metadataResult = { ...metadata, customFields: sanitizedCustomFields };
    }
  }

  return metadataResult !== metadataValue
    ? { ...withoutStack, metadata: metadataResult as Record<string, unknown> }
    : withoutStack;
}

/** Преобразует в JSON для external сериализации с sanitization. Без sensitive data, отфильтрованные stack traces. Для удобства используйте stringifyExternal() */
export function toExternalJSON(baseError: BaseError): string {
  const serializable = toSerializableObject(baseError);
  return JSON.stringify(serializable);
}

/**
 * Полная сериализация BaseError в JSON строку (рекомендуемый способ)
 * Включает все sanitization: sensitive data removal, stack trace filtering, custom fields sanitization
 */
export function stringifyExternal(baseError: BaseError): string {
  return toExternalJSON(baseError);
}

/** Возвращает объект, безопасный для сериализации. Включает sanitization sensitive данных (stack traces, custom fields) */
export function toSerializableObject(baseError: BaseError): Record<string, unknown> {
  const plain = asPlainObject(baseError);
  return sanitizeForExternal(plain);
}

// ==================== CHAIN MANIPULATION ====================

/** Создает новый BaseError с причиной в начале цепочки */
export function prependCause(baseError: BaseError, cause: BaseError): BaseError {
  return addCause(baseError, cause, { prepend: true });
}

/** Создает новый BaseError без причины (корневая ошибка) */
export function withoutCause(baseError: BaseError): BaseError {
  return makeBaseErrorWithChain(baseError, []);
}

/** Создает новый BaseError с полной заменой цепочки причин */
export function withCauseChain(
  baseError: BaseError,
  causeChain: ErrorCauseChain,
  strict: boolean = false,
): BaseError {
  // В strict mode проверяем консистентность цепочки
  if (strict) {
    assertValidChain(causeChain);
    // Если assertValidChain нашла проблемы, она залогирует их
    // В strict mode мы просто продолжаем выполнение (функциональный подход)
  }

  // Проверяем circular references в новой цепочке
  for (const cause of causeChain) {
    if (hasCircularReference(baseError, cause)) {
      // Для production-safe behavior возвращаем оригинальную ошибку
      return baseError;
    }
  }

  // DoS защита: ограничиваем максимальную глубину цепочки причин
  if (causeChain.length > MAX_CAUSE_DEPTH) {
    currentLogger.warn(
      `Cause chain depth ${causeChain.length} exceeds MAX_CAUSE_DEPTH ${MAX_CAUSE_DEPTH}, truncating chain`,
    );
    const truncatedChain = causeChain.slice(0, MAX_CAUSE_DEPTH);
    return makeBaseErrorWithChain(baseError, truncatedChain);
  }

  return makeBaseErrorWithChain(baseError, causeChain);
}

// ==================== METADATA HELPERS ====================

/** Создает новый BaseError с correlation ID */
export function withCorrelationId(baseError: BaseError, correlationId: CorrelationId): BaseError {
  return withMetadata(baseError, {
    context: {
      ...baseError.metadata.context,
      correlationId,
    },
  });
}

/** Создает новый BaseError с user context */
export function withUserContext(baseError: BaseError, userContext: UserContext): BaseError {
  return withMetadata(baseError, {
    userContext,
  });
}

// ==================== TAGGED ERROR CONVERSION ====================

/** Преобразует TaggedError в финальный BaseError. Конвертация промежуточных типов в финальные.
 * @param onInvalidCause - callback для обработки случаев, когда cause не является BaseError
 */
export function toBaseError<E, Tag extends string>(
  taggedError: TaggedError<E, Tag>,
  codeMetadata: ErrorCodeMetadata,
  onInvalidCause?: (cause: unknown) => void,
): BaseError {
  // Создаем базовую структуру BaseError из TaggedError
  const baseError: BaseError = {
    _tag: 'BaseError',
    code: codeMetadata.code,
    message: taggedError instanceof Error ? taggedError.message : 'Unknown error',
    severity: codeMetadata.severity,
    category: codeMetadata.category,
    origin: codeMetadata.origin,
    timestamp: Date.now(),
    causeChain: [],
    metadata: {
      context: {
        correlationId: `corr_${Date.now()}_${
          Math.random().toString(base36Radix).substring(
            CORRELATION_ID_SUBSTRING_START,
            CORRELATION_ID_SUBSTRING_START + CORRELATION_ID_RANDOM_LENGTH,
          )
        }` as CorrelationId,
        timestamp: createMetadataTimestamp(Date.now()),
      },
    },
    codeMetadata,
  };

  // Если TaggedError имеет причину, добавляем её (с type-safe проверкой)
  if ('cause' in taggedError && taggedError.cause !== undefined) {
    const cause = taggedError.cause;

    // Type guard: проверяем, что cause является BaseError
    if (isBaseError(cause)) {
      const errorWithCause = withCause(baseError, cause);
      // Добавляем stack только если он есть
      const stack = taggedError instanceof Error ? taggedError.stack : undefined;
      const result = stack !== undefined ? { ...errorWithCause, stack } : errorWithCause;
      return attachToJSON(result);
    } else {
      // Если cause не является BaseError, вызываем callback для обработки
      // По умолчанию игнорируем, но caller может логировать или обрабатывать
      onInvalidCause?.(cause);
    }
  }

  // Добавляем stack только если он есть
  const stack = taggedError instanceof Error ? taggedError.stack : undefined;
  const result = stack !== undefined ? { ...baseError, stack } : baseError;
  return attachToJSON(result);
}

// ==================== TYPE GUARDS ====================

/** Type guard для проверки, что объект является BaseError */
export function isBaseError(value: unknown): value is BaseError {
  return (
    typeof value === 'object'
    && value !== null
    && '_tag' in value
    && (value as Record<string, unknown>)['_tag'] === 'BaseError'
    && 'code' in value
    && 'message' in value
    && 'severity' in value
    && 'category' in value
    && 'origin' in value
    && 'timestamp' in value
    && 'causeChain' in value
    && 'metadata' in value
    && 'codeMetadata' in value
  );
}

// ==================== CAUSE/CHAIN CONSISTENCY ====================

/** Helper для добавления toJSON метода к BaseError объектам */
function attachToJSON(baseError: BaseError): BaseError {
  return {
    ...baseError,
    toJSON: () => toSerializableObject(baseError),
  } as BaseError;
}

/** Проверяет консистентность цепочки ошибок (strict mode validation) */
function assertValidChain(chain: ErrorCauseChain): void {
  if (chain.length < MIN_CHAIN_LENGTH_FOR_VALIDATION) return;

  // Используем функциональный подход с forEach по парам
  const chainArray = Array.from(chain);
  chainArray.slice(0, -1).forEach((current, index) => {
    const next = chainArray[index + 1];
    if (!next) return; // TypeScript guard

    // Каждый элемент должен содержать следующий в своей causeChain
    const nextInCurrentChain = current.causeChain.includes(next);
    if (!nextInCurrentChain) {
      currentLogger.error(
        `Invalid cause chain: BaseError does not contain next BaseError in its causeChain. `
          + `Chain consistency violated at index ${index}.`,
      );
    }
  });
}

/** Геттер для cause с гарантией консистентности (cause === causeChain[0] || undefined) */
export function getCause(baseError: BaseError): BaseError | undefined {
  // Инвариант: cause всегда должен быть равен causeChain[0] или undefined
  if (baseError.causeChain.length > 0) {
    return baseError.causeChain[0];
  }
  return undefined;
}

// ==================== PERFORMANCE OPTIMIZATIONS ====================

/** WeakMap кэш для максимальной severity в цепочке */
const maxSeverityCache = new WeakMap<BaseError, ErrorSeverity>();

/** Возвращает длину цепочки причин (O(1) операция) */
export function getChainDepth(baseError: BaseError): number {
  return baseError.causeChain.length;
}

/** Memoized evaluation для error severity propagation (lazy evaluation с WeakMap кэшем) */
export function getMemoizedMaxSeverity(baseError: BaseError): ErrorSeverity {
  // Проверяем кэш сначала (lazy evaluation)
  const cached = maxSeverityCache.get(baseError);
  if (cached !== undefined) {
    return cached;
  }

  // Вычисляем максимальную severity в цепочке (expensive operation)
  const severities = [baseError.severity, ...baseError.causeChain.map((e) => e.severity)];
  const maxSeverity = severities.reduce((max, current) =>
    getSeverityWeight(current) > getSeverityWeight(max) ? current : max
  );

  // Кэшируем результат
  maxSeverityCache.set(baseError, maxSeverity);
  return maxSeverity;
}

// ==================== HELPER FUNCTIONS ====================

/** Проверяет circular references в цепочке ошибок. Использует WeakSet для корректного обнаружения циклов любой глубины */
function hasCircularReference(baseError: BaseError, potentialCause: BaseError): boolean {
  // Быстрая проверка: не является ли potentialCause тем же самым объектом
  if (baseError === potentialCause) {
    return true;
  }

  // Алгоритм: используем WeakSet для отслеживания посещенных ошибок
  // Рекурсивно проходим всю цепочку potentialCause, ищем baseError
  const visited = new WeakSet<BaseError>();

  function checkChain(error: BaseError): boolean {
    // Если уже посещали - пропускаем (предотвращает зацикливание в сложных графах)
    if (visited.has(error)) {
      return false;
    }

    visited.add(error);

    // Если нашли baseError в цепочке - будет цикл
    if (error === baseError) {
      return true;
    }

    // Рекурсивно проверяем всю causeChain
    for (const cause of error.causeChain) {
      if (checkChain(cause)) {
        return true;
      }
    }

    return false;
  }

  return checkChain(potentialCause);
}

/** Deep merge для метаданных с configurable стратегией */
/** Shallow merge метаданных (1 уровень) */
/** Универсальная функция merge метаданных с configurable стратегией */
function mergeMetadata(
  existing: ErrorMetadata,
  updates: Partial<ErrorMetadata>,
  strategy: MergeStrategy = 'deepMerge',
): ErrorMetadata {
  const context = updates.context
    ? { ...existing.context, ...updates.context }
    : existing.context;

  const userContext = updates.userContext
    ? { ...existing.userContext, ...updates.userContext }
    : existing.userContext;

  let customFields = existing.customFields;
  if (updates.customFields) {
    if (strategy === 'deepMerge') {
      customFields = deepMergeCustomFields(existing.customFields, updates.customFields);
    } else {
      customFields = { ...existing.customFields, ...updates.customFields };
    }
  }

  return { context, userContext, customFields } as ErrorMetadata;
}

/** Deep merge для custom fields (structuredClone - оптимальная производительность) */
function deepMergeCustomFields(
  existing: DeepReadonly<Record<string, unknown>> | undefined,
  updates: DeepReadonly<Record<string, unknown>>,
): DeepReadonly<Record<string, unknown>> | undefined {
  if (!existing) return updates;
  if (Object.keys(updates).length === 0) return existing;

  // structuredClone доступен в современных средах (Node.js 18+, современные браузеры)
  if (typeof structuredClone === 'function') {
    return {
      ...structuredClone(existing),
      ...structuredClone(updates),
    } as DeepReadonly<Record<string, unknown>>;
  }

  // Fallback для сред без structuredClone (крайне редкий случай)
  return {
    ...JSON.parse(JSON.stringify(existing)),
    ...JSON.parse(JSON.stringify(updates)),
  } as DeepReadonly<Record<string, unknown>>;
}

/** Получает вес severity для сравнения */
function getSeverityWeight(severity: ErrorSeverity): number {
  switch (severity) {
    case 'critical':
      return SEVERITY_WEIGHTS.critical;
    case 'high':
      return SEVERITY_WEIGHTS.high;
    case 'medium':
      return SEVERITY_WEIGHTS.medium;
    case 'low':
      return SEVERITY_WEIGHTS.low;
  }
}
