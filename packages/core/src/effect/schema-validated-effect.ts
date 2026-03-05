/**
 * @file @livai/core/src/effect/schema-validated-effect.ts
 * ============================================================================
 * ✅ SCHEMA VALIDATED EFFECT — ОБЯЗАТЕЛЬНАЯ ZOD ВАЛИДАЦИЯ РЕЗУЛЬТАТОВ EFFECT
 * ============================================================================
 * Минимальный, чистый boundary-модуль для обязательной Zod валидации результатов Effect.
 * Архитектурная роль:
 * - Runtime валидация результатов Effect через Zod schema
 * - Защита от невалидных данных (runtime type safety)
 * - Унифицированная обработка ошибок через error-mapping
 * - Пробрасывание валидных результатов без изменений
 * Принципы:
 * - Zero business logic
 * - Zero telemetry (telemetry → observability layer)
 * - Zero isolation (isolation → effect-isolation layer)
 * - Zero orchestration (orchestration → orchestrator)
 * - Только валидация и throw DomainError при fail
 * - Пробрасывает все ошибки от effect дальше
 * ⚠️ Важно: НЕ делает isolation
 * - validatedEffect НЕ оборачивает в try/catch
 * - Только валидация и throw DomainError при fail
 * - Все ошибки от effect пробрасываются дальше
 * - Isolation только на уровне orchestrator (runIsolated)
 */

import type { Effect } from './effect-utils.js';
import type { MappedError, ServiceErrorCode, ServicePrefix } from './error-mapping.js';
import { createDomainError } from './error-mapping.js';
import type { ValidationError } from './validation.js';
import { validationError } from './validation.js';

/* ============================================================================
 * 🧩 ТИПЫ
 * ========================================================================== */

/**
 * Опции для валидированного эффекта.
 */
export interface ValidatedEffectOptions {
  /** Опциональный mapper для преобразования ValidationError в DomainError */
  readonly errorMapper?: ((errors: readonly ValidationError[]) => MappedError<unknown>) | undefined;

  /** Опциональный код ошибки для валидации (по умолчанию SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID) */
  readonly errorCode?: ServiceErrorCode | undefined;

  /** Опциональный сервис для ошибок валидации */
  readonly service?: ServicePrefix | undefined;
}

/**
 * Ошибка валидации схемы.
 * Бросается когда результат effect не проходит Zod валидацию.
 */
export class SchemaValidationError extends Error {
  /** Mapped error для унифицированной обработки */
  readonly mappedError: MappedError<unknown>;

  /** Исходные ошибки валидации Zod */
  readonly validationErrors: readonly ValidationError[];

  constructor(mappedError: MappedError<unknown>, validationErrors: readonly ValidationError[]) {
    super(mappedError.message);
    this.name = 'SchemaValidationError';
    this.mappedError = mappedError;
    this.validationErrors = validationErrors;
  }
}

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

/**
 * Type guard для проверки, является ли ошибка SchemaValidationError.
 */
export function isSchemaValidationError(error: unknown): error is SchemaValidationError {
  return error instanceof SchemaValidationError;
}

/**
 * Создает DomainError из ValidationError через error-mapping.
 * Используется для унифицированной обработки ошибок валидации.
 * @deprecated Используйте `createDomainError` из `error-mapping.ts` напрямую.
 * Эта функция оставлена для обратной совместимости.
 */
export function createValidationError(
  errors: readonly ValidationError[],
  errorCode?: ServiceErrorCode | undefined,
  service?: ServicePrefix | undefined,
): MappedError<unknown> {
  return createDomainError(errors, { locale: 'ru', timestamp: Date.now() }, errorCode, service);
}

/**
 * Минимальный контракт схемы валидации, совместимый с Zod-like API.
 * Нам не нужны типы из 'zod', достаточно structural-совместимости.
 */
interface ValidationSchemaLike<T> {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T; } | {
    success: false;
    error: {
      issues: readonly {
        path: readonly PropertyKey[];
        message: string;
        // остальные поля нам не нужны для error-mapping
      }[];
    };
  };
}

/**
 * Преобразует ошибки схемы в ValidationError массив.
 */
function zodErrorsToValidationErrors(
  zodError: {
    issues: readonly {
      path: readonly PropertyKey[];
      message: string;
    }[];
  },
  service?: ServicePrefix | undefined,
): readonly ValidationError[] {
  return zodError.issues.map((issue): ValidationError => {
    // Преобразуем PropertyKey[] в string[] для field (игнорируем symbol)
    const pathStrings = issue.path
      .filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
      .map((key) => String(key));
    const field = pathStrings.length > 0 ? pathStrings.join('.') : undefined;

    return validationError('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID', {
      field,
      message: issue.message,
      details: issue,
      service: service ?? 'SYSTEM',
    });
  });
}

/* ============================================================================
 * 🎯 ОСНОВНОЙ API
 * ========================================================================== */

/**
 * Обёртка для Effect, которая валидирует результат через Zod schema.
 * Поведение:
 * - ✅ Если schema прошла → результат effect пробрасывается без изменений
 * - ❌ Если schema не прошла → бросает SchemaValidationError (DomainError через error-mapping)
 * - ✅ Не глотает ошибки → все ошибки от effect пробрасываются дальше
 * - ❌ НЕ делает isolation → isolation только на уровне orchestrator
 * @param schema - Zod schema для валидации результата
 * @param effect - Effect для выполнения и валидации
 * @param options - Опции валидации (опционально)
 * @returns Effect с валидированным результатом
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { validatedEffect } from './lib/schema-validated-effect';
 * const UserSchema = z.object({
 *   id: z.string(),
 *   email: z.string().email(),
 * });
 * const fetchUser = async () => {
 *   const response = await fetch('/api/user');
 *   return await response.json();
 * };
 * // Валидирует результат fetchUser через UserSchema
 * const validatedFetchUser = validatedEffect(UserSchema, fetchUser);
 * // Использование в orchestrator с isolation
 * const result = await runIsolated(validatedFetchUser, { tag: 'fetch-user' });
 * if (isOk(result)) {
 *   console.log('Valid user:', result.value); // Тип: { id: string; email: string; }
 * }
 * ```
 */
export function validatedEffect<T>(
  schema: ValidationSchemaLike<T>,
  effect: Effect<unknown>,
  options?: ValidatedEffectOptions,
): Effect<T> {
  const { errorMapper, errorCode, service } = options ?? {};

  return async (signal?: AbortSignal): Promise<T> => {
    // Выполняем effect (пробрасываем все ошибки дальше, не глотаем)
    const result = await effect(signal);

    // Валидируем результат через Zod schema
    const parseResult = schema.safeParse(result);

    // Если валидация прошла, пробрасываем результат без изменений
    if (parseResult.success) {
      return parseResult.data;
    }

    // Если валидация не прошла, преобразуем Zod ошибки в ValidationError
    const validationErrors = zodErrorsToValidationErrors(parseResult.error, service);

    // Создаем DomainError через error-mapping (или используем кастомный mapper)
    const mappedError = errorMapper != null
      ? errorMapper(validationErrors)
      : createDomainError(
        validationErrors,
        { locale: 'ru', timestamp: Date.now() },
        errorCode,
        service,
      );

    // Бросаем SchemaValidationError для унифицированной обработки
    throw new SchemaValidationError(mappedError, validationErrors);
  };
}
