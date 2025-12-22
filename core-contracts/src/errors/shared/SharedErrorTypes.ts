/**
 * @file SharedErrorTypes.ts - Общие типы ошибок для shared слоя LivAiBot
 *
 * Содержит shared-specific типы ошибок и discriminated unions для общих доменов.
 * Предоставляет type guards и pattern matching helpers для работы с общими ошибками.
 */

import type { TaggedError } from '../base/BaseErrorTypes.js';

// ==================== SHARED ERROR NAMESPACE ====================

/** Тип для кодов shared ошибок с обязательным namespace. Защищает shared layer от попадания service-специфичных кодов. */
export type SharedErrorCodeString = `SHARED_${string}`;

/** Категории shared ошибок - единая точка истины. Используется для type-safe категоризации ошибок в policies/strategies. */
export type SharedErrorCategory =
  | 'domain'
  | 'infrastructure'
  | 'policy'
  | 'adapter';

/** Виды shared ошибок - type-level routing для observability/metrics/contracts/tracing. Используется для категоризации ошибок в системах мониторинга и контрактах. */
export type SharedErrorKind =
  | 'SharedDomainError'
  | 'SharedInfraError'
  | 'SharedPolicyError'
  | 'SharedAdapterError';

// ==================== SHARED ERROR TYPES ====================

/** Базовый тип для ошибок shared домена. Используется для бизнес-логики, общей для всех сервисов. */
export type SharedDomainError<T = unknown> = TaggedError<{
  readonly category: SharedErrorCategory;
  readonly code: SharedErrorCodeString;
  readonly message: string;
  readonly details?: T;
}, 'SharedDomainError'>;

/** Базовый тип для ошибок shared инфраструктуры. Используется для общих инфраструктурных проблем. */
export type SharedInfraError<T = unknown> = TaggedError<{
  readonly category: SharedErrorCategory;
  readonly code: SharedErrorCodeString;
  readonly message: string;
  readonly details?: T;
}, 'SharedInfraError'>;

/** Базовый тип для ошибок shared политик. Используется для retry, circuit breaker, fallback стратегий. */
export type SharedPolicyError<T = unknown> = TaggedError<{
  readonly category: SharedErrorCategory;
  readonly code: SharedErrorCodeString;
  readonly message: string;
  readonly details?: T;
}, 'SharedPolicyError'>;

/** Базовый тип для ошибок shared адаптеров. Используется для HTTP, DB, cache адаптеров. */
export type SharedAdapterError<T = unknown> = TaggedError<{
  readonly category: SharedErrorCategory;
  readonly code: SharedErrorCodeString;
  readonly message: string;
  readonly details?: T;
}, 'SharedAdapterError'>;

// ==================== DISCRIMINATED UNIONS ====================

/** Объединение всех типов shared ошибок. Используется для type-safe pattern matching. */
export type SharedError<T = unknown> =
  | SharedDomainError<T>
  | SharedInfraError<T>
  | SharedPolicyError<T>
  | SharedAdapterError<T>;

// ==================== TYPE GUARDS ====================

/**
 * Проверяет, является ли ошибка SharedDomainError
 * @param error - ошибка для проверки
 * @returns true если это shared domain ошибка
 */
export function isSharedDomainError<T = unknown>(
  error: unknown,
): error is SharedDomainError<T> {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as Record<string, unknown>)['_tag'] === 'SharedDomainError'
    && 'code' in error
    && typeof (error as Record<string, unknown>)['code'] === 'string'
    && ((error as Record<string, unknown>)['code'] as string).startsWith('SHARED_')
  );
}

/**
 * Проверяет, является ли ошибка SharedInfraError
 * @param error - ошибка для проверки
 * @returns true если это shared infrastructure ошибка
 */
export function isSharedInfraError<T = unknown>(
  error: unknown,
): error is SharedInfraError<T> {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as Record<string, unknown>)['_tag'] === 'SharedInfraError'
    && 'code' in error
    && typeof (error as Record<string, unknown>)['code'] === 'string'
    && ((error as Record<string, unknown>)['code'] as string).startsWith('SHARED_')
  );
}

/**
 * Проверяет, является ли ошибка SharedPolicyError
 * @param error - ошибка для проверки
 * @returns true если это shared policy ошибка
 */
export function isSharedPolicyError<T = unknown>(
  error: unknown,
): error is SharedPolicyError<T> {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as Record<string, unknown>)['_tag'] === 'SharedPolicyError'
    && 'code' in error
    && typeof (error as Record<string, unknown>)['code'] === 'string'
    && ((error as Record<string, unknown>)['code'] as string).startsWith('SHARED_')
  );
}

/**
 * Проверяет, является ли ошибка SharedAdapterError
 * @param error - ошибка для проверки
 * @returns true если это shared adapter ошибка
 */
export function isSharedAdapterError<T = unknown>(
  error: unknown,
): error is SharedAdapterError<T> {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as Record<string, unknown>)['_tag'] === 'SharedAdapterError'
    && 'code' in error
    && typeof (error as Record<string, unknown>)['code'] === 'string'
    && ((error as Record<string, unknown>)['code'] as string).startsWith('SHARED_')
  );
}

/**
 * Проверяет, является ли ошибка любой shared ошибкой
 * @param error - ошибка для проверки
 * @returns true если это любая shared ошибка
 */
export function isSharedError<T = unknown>(
  error: unknown,
): error is SharedError<T> {
  return (
    isSharedDomainError(error)
    || isSharedInfraError(error)
    || isSharedPolicyError(error)
    || isSharedAdapterError(error)
  );
}

// ==================== PATTERN MATCHING HELPERS ====================

/** Функция-матчер для SharedError. Принимает ошибку и возвращает результат обработки. */
export type SharedErrorMatcher<R> = {
  readonly sharedDomainError: (error: SharedDomainError) => R;
  readonly sharedInfraError: (error: SharedInfraError) => R;
  readonly sharedPolicyError: (error: SharedPolicyError) => R;
  readonly sharedAdapterError: (error: SharedAdapterError) => R;
  readonly fallback: (error: SharedError) => R;
};

/**
 * Pattern matching для SharedError с exhaustiveness checking
 * @param error - shared ошибка для обработки
 * @param matcher - объект с обработчиками для каждого типа
 * @returns результат обработки
 */
export function matchSharedError<R>(
  error: SharedError,
  matcher: SharedErrorMatcher<R>,
): R {
  switch (error._tag) {
    case 'SharedDomainError':
      return matcher.sharedDomainError(error);
    case 'SharedInfraError':
      return matcher.sharedInfraError(error);
    case 'SharedPolicyError':
      return matcher.sharedPolicyError(error);
    case 'SharedAdapterError':
      return matcher.sharedAdapterError(error);
    default:
      return matcher.fallback(error);
  }
}

/**
 * Безопасный pattern matching для SharedError без exhaustiveness checking
 * @param error - ошибка для проверки (может быть не SharedError)
 * @param matcher - объект с обработчиками
 * @returns результат обработки или undefined если не SharedError
 */
export function safeMatchSharedError<R>(
  error: unknown,
  matcher: SharedErrorMatcher<R>,
): R | undefined {
  if (!isSharedError(error)) {
    return undefined;
  }

  return matchSharedError(error, matcher);
}

// ==================== UTILITY TYPES ====================

/** Извлекает детали из SharedError типа. */
export type SharedErrorDetails<E extends SharedError> = E extends SharedError<infer T> ? T
  : never;

/** Создает union тип кодов для конкретной категории shared ошибок. */
export type SharedErrorCode<
  C extends SharedError['category'],
> = Extract<SharedError, { category: C; }>['code'];

/** Тип для создания новых shared ошибок. */
export type SharedErrorInput<T = unknown> = {
  readonly code: SharedErrorCodeString;
  readonly message: string;
  readonly details?: T;
};

// ==================== ERROR KIND UTILITIES ====================

/**
 * Извлекает SharedErrorKind из shared ошибки
 * Полезно для observability, metrics, contracts, tracing
 */
export function getSharedErrorKind(error: SharedError): SharedErrorKind {
  return error._tag as SharedErrorKind;
}

/** Проверяет, соответствует ли ошибка определенному виду. Type-safe проверка для routing и категоризации. */
export function isSharedErrorKind<E extends SharedError>(
  error: SharedError,
  kind: SharedErrorKind,
): error is E {
  return error._tag === kind;
}

/** Группирует ошибки по их виду для observability. Возвращает Map<SharedErrorKind, SharedError[]>. */
export function groupSharedErrorsByKind(
  errors: readonly SharedError[],
): Map<SharedErrorKind, SharedError[]> {
  return errors.reduce((groups, error) => {
    const kind = getSharedErrorKind(error);
    const existingGroup = groups.get(kind) ?? [];
    return new Map(groups).set(kind, [...existingGroup, error]);
  }, new Map<SharedErrorKind, SharedError[]>());
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validation helper: проверяет что значение является SharedError.
 * Возвращает результат валидации вместо исключения. Используется в adapters, effect boundaries
 */
export function validateSharedError(error: unknown): {
  isValid: boolean;
  error?: string;
  value?: SharedError;
} {
  if (isSharedError(error)) {
    return { isValid: true, value: error };
  }
  return { isValid: false, error: `Expected SharedError: ${JSON.stringify(error)}` };
}

/**
 * Validation helper: проверяет что ошибка имеет определенный вид.
 * Возвращает результат валидации для type-safe проверки конкретных видов ошибок
 */
export function validateSharedErrorKind<E extends SharedError>(
  error: SharedError,
  kind: SharedErrorKind,
): {
  isValid: boolean;
  error?: string;
  value?: E;
} {
  if (isSharedErrorKind<E>(error, kind)) {
    return { isValid: true, value: error };
  }
  return { isValid: false, error: `Expected SharedError of kind ${kind}: got ${error._tag}` };
}

/**
 * Validation helper: проверяет что ошибка имеет определенную категорию.
 * Полезно для категоризации в policies/strategies
 */
export function validateSharedErrorCategory(
  error: SharedError,
  category: SharedErrorCategory,
): {
  isValid: boolean;
  error?: string;
} {
  if (error.category === category) {
    return { isValid: true };
  }
  return {
    isValid: false,
    error: `Expected SharedError with category ${category}: got ${error.category}`,
  };
}

/**
 * Validation helper: проверяет что код ошибки имеет правильный namespace.
 * Дополнительная защита от попадания неправильных кодов
 */
export function validateSharedErrorCode(code: string): {
  isValid: boolean;
  error?: string;
  value?: SharedErrorCodeString;
} {
  if (code.startsWith('SHARED_')) {
    return { isValid: true, value: code as SharedErrorCodeString };
  }
  return { isValid: false, error: `Expected SharedError code with SHARED_ prefix: got ${code}` };
}
