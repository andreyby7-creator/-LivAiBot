/**
 * @file packages/app/src/lib/validation.ts
 * ============================================================================
 * 🔹 VALIDATION CORE — ФУНКЦИОНАЛЬНАЯ ПОДСИСТЕМА ВАЛИДАЦИИ
 * ============================================================================
 *
 * Назначение:
 * - Единый, типобезопасный слой валидации для всех микросервисов
 * - Детерминированные, композиционные валидаторы
 * - Совместимость с error-mapping.ts и telemetry
 * - Поддержка синхронных и асинхронных сценариев
 * - Подготовка к i18n, distributed tracing и Effect-first архитектуре
 *
 * Принципы:
 * - Без side-effects
 * - Без классов
 * - Максимальная композиционность
 */

import type { ServiceErrorCode, ServicePrefix, TaggedError } from './error-mapping.js';
import { errorFireAndForget, warnFireAndForget } from './telemetry.js';

/* ============================================================================
 * 🧠 КОНТЕКСТ ВАЛИДАЦИИ
 * ========================================================================== */

/**
 * Контекст валидации — прокидывается через все валидаторы.
 * Может использоваться для:
 * - telemetry (requestId, traceId)
 * - авторизации
 * - feature flags
 * - локали
 */
export type ValidationContext = {
  readonly requestId?: string;
  readonly traceId?: string;
  readonly locale?: string;
  readonly service?: ServicePrefix;
};

/* ============================================================================
 * ❌ ОШИБКИ ВАЛИДАЦИИ
 * ========================================================================== */

// Ошибка валидации — строго совместима с error-mapping.ts
export type ValidationError = TaggedError & {
  readonly field?: string | undefined;
  readonly message?: string | undefined;
  readonly details?: unknown;
};

// Helper для создания ошибки валидации
export function validationError(
  code: ServiceErrorCode,
  options?: {
    field?: string | undefined;
    message?: string | undefined;
    details?: unknown;
    service?: ServicePrefix | undefined;
  },
): ValidationError {
  warnFireAndForget('Validation error created', {
    code,
    ...(options?.field != null && { field: options.field }),
    ...(options?.service != null && { service: options.service }),
  });

  return {
    code,
    service: options?.service,
    field: options?.field,
    message: options?.message,
    details: options?.details,
  };
}

/* ============================================================================
 * 🧩 RESULT ADT
 * ========================================================================== */

/**
 * Результат валидации:
 * - success: true  → значение валидно
 * - success: false → массив ошибок
 */
export type ValidationResult<T> =
  | { readonly success: true; readonly value: T; }
  | { readonly success: false; readonly errors: readonly ValidationError[]; };

// Успешный результат
export function ok<T>(value: T): ValidationResult<T> {
  return { success: true, value };
}

// Ошибка валидации
export function fail(
  errors: readonly ValidationError[] | ValidationError,
): ValidationResult<never> {
  const errorArray = Array.isArray(errors) ? errors : [errors];

  warnFireAndForget('Validation failed', {
    errorCount: errorArray.length,
    ...(errorArray[0]?.code != null && { firstError: String(errorArray[0].code) }),
  });

  return {
    success: false,
    errors: errorArray,
  };
}

/* ============================================================================
 * 🔧 КОНТРАКТЫ ВАЛИДАТОРОВ
 * ========================================================================== */

// Синхронный валидатор
export type Validator<T> = (
  input: unknown,
  ctx: ValidationContext,
) => ValidationResult<T>;

// Асинхронный валидатор (для БД, API, feature flags и т.д.)
export type AsyncValidator<T> = (
  input: unknown,
  ctx: ValidationContext,
) => Promise<ValidationResult<T>>;

/* ============================================================================
 * 🔗 КОМПОЗИЦИЯ
 * ========================================================================== */

// pipe — последовательное применение валидаторов
export function pipe<A, B>(
  v1: Validator<A>,
  v2: (value: A, ctx: ValidationContext) => ValidationResult<B>,
): Validator<B> {
  return (input, ctx) => {
    const r1 = v1(input, ctx);
    if (!r1.success) return r1;
    return v2(r1.value, ctx);
  };
}

// asyncPipe — асинхронная версия
export function asyncPipe<A, B>(
  v1: AsyncValidator<A>,
  v2: (value: A, ctx: ValidationContext) => Promise<ValidationResult<B>>,
): AsyncValidator<B> {
  return async (input, ctx) => {
    const r1 = await v1(input, ctx);
    if (!r1.success) return r1;
    return v2(r1.value, ctx);
  };
}

/* ============================================================================
 * 🧱 БАЗОВЫЕ ВАЛИДАТОРЫ
 * ========================================================================== */

// Проверяет, что значение определено
export function required<T>(
  code: ServiceErrorCode,
  field?: string,
): Validator<T> {
  return (input, ctx) => {
    if (input === null || input === undefined) {
      return fail(
        validationError(code, {
          field,
          service: ctx.service,
        }),
      );
    }
    return ok(input as T);
  };
}

// Проверяет тип string
export function isString(
  code: ServiceErrorCode,
  field?: string,
): Validator<string> {
  return (input, ctx) => {
    if (typeof input !== 'string') {
      return fail(
        validationError(code, {
          field,
          service: ctx.service,
        }),
      );
    }
    return ok(input);
  };
}

// Проверяет тип number
export function isNumber(
  code: ServiceErrorCode,
  field?: string,
): Validator<number> {
  return (input, ctx) => {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      return fail(
        validationError(code, {
          field,
          service: ctx.service,
        }),
      );
    }
    return ok(input);
  };
}

// Проверка по произвольному предикату
export function refine<T>(
  validator: Validator<T>,
  predicate: (value: T, ctx: ValidationContext) => boolean,
  code: ServiceErrorCode,
  field?: string,
): Validator<T> {
  return (input, ctx) => {
    const base = validator(input, ctx);
    if (!base.success) return base;

    if (!predicate(base.value, ctx)) {
      return fail(
        validationError(code, {
          field,
          service: ctx.service,
        }),
      );
    }

    return base;
  };
}

/* ============================================================================
 * 🧱 OPTIONAL / NULLABLE
 * ========================================================================== */

// Делает валидатор optional
export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return (input, ctx) => {
    if (input === undefined) return ok(undefined);
    return validator(input, ctx);
  };
}

// Делает валидатор nullable
export function nullable<T>(validator: Validator<T>): Validator<T | null> {
  return (input, ctx) => {
    if (input === null) return ok(null);
    return validator(input, ctx);
  };
}

/* ============================================================================
 * 🧩 ВАЛИДАЦИЯ ОБЪЕКТОВ
 * ========================================================================== */

// Схема валидации объекта
export type ObjectSchema<T extends Record<string, unknown>> = {
  readonly [K in keyof T]: Validator<T[K]>;
};

// Валидирует объект по схеме и аккумулирует ВСЕ ошибки
export function validateObject<T extends Record<string, unknown>>(
  schema: ObjectSchema<T>,
): Validator<T> {
  return (input, ctx) => {
    if (typeof input !== 'object' || input === null) {
      return fail(
        validationError('SYSTEM_UNKNOWN_ERROR', {
          service: ctx.service,
        }),
      );
    }

    let result: Partial<T> = {};
    let errors: ValidationError[] = [];

    for (const key in schema) {
      const validator = schema[key];
      const value = (input as Record<string, unknown>)[key];
      const r = validator(value, ctx);

      if (!r.success) {
        errors = [
          ...errors,
          ...r.errors.map((e) => ({
            ...e,
            field: e.field ?? String(key),
          })),
        ];
      } else {
        result = {
          ...result,
          [key]: r.value,
        };
      }
    }

    if (errors.length > 0) {
      errorFireAndForget('Object validation failed', {
        errorCount: errors.length,
        ...(ctx.service && { service: ctx.service }),
      });
      return fail(errors);
    }

    return ok(result as T);
  };
}

/* ============================================================================
 * 🧪 ASYNC HELPERS
 * ========================================================================== */

// Оборачивает sync-валидатор в async
export function toAsync<T>(validator: Validator<T>): AsyncValidator<T> {
  return async (input, ctx) => Promise.resolve(validator(input, ctx));
}
