/**
 * @file @livai/core/src/effect/schema-validated-effect.ts
 * ============================================================================
 * ✅ SCHEMA VALIDATED EFFECT — ОБЯЗАТЕЛЬНАЯ ZOD ВАЛИДАЦИЯ РЕЗУЛЬТАТОВ EFFECT
 * ============================================================================
 *
 * Минимальный, чистый boundary-модуль для обязательной Zod-валидации результатов Effect.
 *
 * Архитектурная роль:
 * - Runtime-валидация результатов Effect через Zod-подобную schema (`safeParse`)
 * - Защита от невалидных данных (runtime type safety) на границе эффекта
 * - Унифицированная обработка ошибок через error-mapping (`createDomainError`)
 * - Пробрасывание валидных результатов без изменений
 *
 * Принципы:
 * - Zero business logic
 * - Zero side-effect telemetry (telemetry → observability layer; допускается DI-hook без собственного логирования)
 * - Zero isolation (isolation → effect-isolation layer)
 * - Zero orchestration (orchestration → orchestrator)
 * - Только валидация и throw DomainError / SchemaValidationError при fail
 * - Пробрасывает все ошибки от исходного effect дальше (не ловит и не маппит их)
 * ⚠️ Важно: НЕ делает isolation
 * - validatedEffect НЕ оборачивает effect в try/catch
 * - Все ошибки от effect пробрасываются как есть, без скрытого маппинга
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

/** Опции для валидированного эффекта. */
export interface ValidatedEffectOptions {
  /**
   * Опциональный mapper для преобразования ValidationError[] в DomainError.
   * По умолчанию используется `createDomainError` из `error-mapping.ts`.
   */
  readonly errorMapper?: ((errors: readonly ValidationError[]) => MappedError<unknown>) | undefined;

  /**
   * Опциональный код ошибки для валидации.
   * По умолчанию используется `SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID` (продакшн-safe fallback).
   */
  readonly errorCode?: ServiceErrorCode | undefined;

  /**
   * Опциональный сервис для ошибок валидации.
   * По умолчанию используется `SYSTEM` (служебный namespace для технических ошибок валидации).
   */
  readonly service?: ServicePrefix | undefined;

  /**
   * Опциональный hook для observability-слоя (метрики по валидации).
   * На уровне core не делает логирования сам по себе.
   */
  readonly telemetry?: {
    readonly onSuccess?: (info: {
      readonly service?: ServicePrefix | undefined;
      readonly errorCode?: ServiceErrorCode | undefined;
    }) => void;
    readonly onValidationError?: (info: {
      readonly service?: ServicePrefix | undefined;
      readonly errorCode?: ServiceErrorCode | undefined;
      readonly errors: readonly ValidationError[];
    }) => void;
  } | undefined;
}

/**
 * Ошибка валидации схемы.
 * Бросается когда результат effect не проходит Zod валидацию.
 */
/* eslint-disable functional/no-classes, fp/no-mutation, functional/no-this-expressions */
// В этом boundary-классе ошибки допустимы класс/this/мутации для корректного Error API.
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
/* eslint-enable functional/no-classes, fp/no-mutation, functional/no-this-expressions */

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

/** Type guard для проверки, является ли ошибка SchemaValidationError. */
export function isSchemaValidationError(error: unknown): error is SchemaValidationError {
  return error instanceof SchemaValidationError;
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
 * Преобразует Zod-like issues в ValidationError[].
 * Production: единый helper чтобы не дублировать mapping в boundary-модулях.
 */
export function zodIssuesToValidationErrors(
  errorCode: ServiceErrorCode,
  issues: readonly {
    path: readonly PropertyKey[];
    message: string;
  }[],
  service?: ServicePrefix | undefined,
): readonly ValidationError[] {
  return issues.map((issue): ValidationError => {
    // Преобразуем PropertyKey[] в string[] для field (игнорируем symbol)
    const pathStrings = issue.path
      .filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
      .map((key) => String(key));
    const field = pathStrings.length > 0 ? pathStrings.join('.') : undefined;

    return validationError(errorCode, {
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
 * @returns Effect с валидированным результатом.
 * Поддерживает как обычный `Effect<T>`, так и использование внутри `stepWithPrevious`
 * (через типобезопасный generic `P` для previousResult).
 */
export function validatedEffect<T>(
  schema: ValidationSchemaLike<T>,
  effect: Effect<unknown>,
  options?: ValidatedEffectOptions,
): Effect<T>;

export function validatedEffect<T, P>(
  schema: ValidationSchemaLike<T>,
  effect: (
    signal?: AbortSignal,
    previousResult?: P,
  ) => Promise<unknown>,
  options?: ValidatedEffectOptions,
): (
  signal?: AbortSignal,
  previousResult?: P,
) => Promise<T>;

export function validatedEffect<T, P>(
  schema: ValidationSchemaLike<T>,
  effect: (
    signal?: AbortSignal,
    previousResult?: P,
  ) => Promise<unknown>,
  options?: ValidatedEffectOptions,
):
  | Effect<T>
  | ((
    signal?: AbortSignal,
    previousResult?: P,
  ) => Promise<T>)
{
  const { errorMapper, errorCode, service, telemetry } = options ?? {};

  const validateResult = (result: unknown): T => {
    const parseResult = schema.safeParse(result);

    // Если валидация прошла, пробрасываем результат без изменений
    if (parseResult.success) {
      telemetry?.onSuccess?.({ service, errorCode });
      return parseResult.data;
    }

    // Если валидация не прошла, преобразуем Zod ошибки в ValidationError
    const validationErrors = zodIssuesToValidationErrors(
      errorCode ?? 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
      parseResult.error.issues,
      service,
    );
    telemetry?.onValidationError?.({ service, errorCode, errors: validationErrors });

    // Создаем DomainError через error-mapping (или используем кастомный mapper)
    const mappedError = errorMapper != null
      ? errorMapper(validationErrors)
      : createDomainError(
        validationErrors,
        { locale: 'ru', timestamp: Date.now() },
        errorCode,
        service,
      );

    // Бросаем SchemaValidationError как часть публичного API validatedEffect
    // eslint-disable-next-line fp/no-throw
    throw new SchemaValidationError(mappedError, validationErrors);
  };

  const wrapped = async (
    signal?: AbortSignal,
    previousResult?: P,
  ): Promise<T> => {
    // Выполняем effect (пробрасываем все ошибки дальше, не глотаем)
    const result = await effect(signal, previousResult);
    return validateResult(result);
  };

  return wrapped;
}
