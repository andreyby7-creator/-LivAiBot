/**
 * @file packages/core/src/effect/validation.ts
 * ============================================================================
 * 🔹 VALIDATION CORE — ФУНКЦИОНАЛЬНАЯ ПОДСИСТЕМА ВАЛИДАЦИИ
 * ============================================================================
 *
 * Назначение:
 * - Единый, типобезопасный слой валидации для всех микросервисов
 * - Детерминированные, композиционные валидаторы
 * - Совместимость с `error-mapping.ts` (ServiceErrorCode/TaggedError)
 * - Поддержка синхронных и асинхронных сценариев
 * - Изоляция UI/DOM: core-функции не зависят от DOM (`validateFormData`), DOM доступен только в адаптере (`validateForm`)
 *
 * Принципы:
 * - Без side-effects (кроме DOM-адаптера `validateForm`)
 * - Без классов
 * - Максимальная композиционность
 */

import type { FileValidationResult } from '@livai/core-contracts';

import type { ServiceErrorCode, ServicePrefix, TaggedError } from './error-mapping.js';

/* ============================================================================
 * 🎭 PUBLIC API
 * ========================================================================== */

/**
 * Схема валидации — абстракция для UI-слоя.
 * UI компоненты работают только с этой абстракцией, не зная деталей реализации.
 */
export type ValidationSchema = unknown;

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
export type ValidationContext = Readonly<{
  readonly requestId?: string;
  readonly traceId?: string;
  readonly locale?: string;
  readonly service?: ServicePrefix;
}>;

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
  return {
    code,
    service: options?.service ?? 'SYSTEM',
    field: options?.field,
    message: options?.message,
    details: options?.details,
  };
}

/* ============================================================================
 * 🧩 RESULT ADT
 * ========================================================================== */

/**
 * Результат валидации.
 * - `success: true` → `value` доступен
 * - `success: false` → `errors` (массив `ValidationError`)
 *
 * Отличие от `Result<T, E>`:
 * - `ValidationResult<T>` предназначен для **валидации** и хранит **массив** ошибок (для аккумулирования ошибок формы/объекта).
 * - `Result<T, E>` предназначен для **выполнения операции** и хранит **одну** ошибку типа `E`.
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

export type ValidationStep<A, B> = (
  value: A,
  ctx: ValidationContext,
) => ValidationResult<B>;

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

// pipeChain — типобезопасная композиция с преобразованиями типов (unknown -> string -> number -> ...)
export function pipeChain<A, B>(
  v1: Validator<A>,
  s2: ValidationStep<A, B>,
): Validator<B>;
export function pipeChain<A, B, C>(
  v1: Validator<A>,
  s2: ValidationStep<A, B>,
  s3: ValidationStep<B, C>,
): Validator<C>;
export function pipeChain<A, B, C, D>(
  v1: Validator<A>,
  s2: ValidationStep<A, B>,
  s3: ValidationStep<B, C>,
  s4: ValidationStep<C, D>,
): Validator<D>;
export function pipeChain<A, B, C, D, E>(
  v1: Validator<A>,
  s2: ValidationStep<A, B>,
  s3: ValidationStep<B, C>,
  s4: ValidationStep<C, D>,
  s5: ValidationStep<D, E>,
): Validator<E>;
export function pipeChain(
  v1: Validator<unknown>,
  ...steps: readonly ValidationStep<unknown, unknown>[]
): Validator<unknown> {
  return (input, ctx) => {
    const r1 = v1(input, ctx);
    if (!r1.success) return r1;
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation */
    // Perf/readability: обычный цикл быстрее reduce и проще читается, мутация локальная (состояние не утекает наружу).
    let current: ValidationResult<unknown> = ok<unknown>(r1.value);
    for (const step of steps) {
      if (!current.success) return current;
      current = step(current.value, ctx);
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */
    return current;
  };
}

// pipeMany — последовательное применение нескольких валидаторов
export function pipeMany<T>(...validators: Validator<T>[]): Validator<T> {
  return (input, ctx) => {
    const aggregated = validators.reduce<ValidationResult<unknown>>((acc, validator) => {
      if (!acc.success) return acc;
      return validator(acc.value, ctx) as ValidationResult<unknown>;
    }, ok<unknown>(input));

    return aggregated.success
      ? ok(aggregated.value as T)
      : (aggregated as ValidationResult<T>);
  };
}

// all — агрегирующая валидация (не останавливается на первой ошибке)
export function all<T>(...validators: Validator<T>[]): Validator<T> {
  return (input, ctx) => {
    const aggregated = validators.reduce<{
      readonly okValue: T | undefined;
      readonly errors: readonly ValidationError[];
    }>((acc, validator) => {
      const r = validator(input, ctx);
      if (!r.success) return { okValue: acc.okValue, errors: [...acc.errors, ...r.errors] };
      return { okValue: r.value, errors: acc.errors };
    }, { okValue: undefined, errors: [] });

    return aggregated.errors.length > 0
      ? fail(aggregated.errors)
      : ok(aggregated.okValue as T);
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
    if (typeof input !== 'number' || !Number.isFinite(input)) {
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
        // Важно: коды ошибок централизованы в `error-mapping.ts` (ServiceErrorCode).
        validationError('SYSTEM_UNKNOWN_ERROR', {
          service: ctx.service,
        }),
      );
    }

    /* eslint-disable functional/no-loop-statements, fp/no-mutation, functional/immutable-data */
    // Perf: локальная мутация accumulators снижает аллокации и GC pressure (vs spread в reduce), безопасно т.к. состояние не утекает наружу.
    const keys = Object.keys(schema) as readonly (keyof T)[];
    const result: Partial<T> = {};
    const errors: ValidationError[] = [];

    for (const key of keys) {
      const validator = schema[key];
      const value = (input as Record<string, unknown>)[String(key)];
      const r = validator(value, ctx);

      if (!r.success) {
        for (const e of r.errors) {
          errors.push({
            ...e,
            field: e.field ?? String(key),
          });
        }
      } else {
        result[key] = r.value;
      }
    }
    /* eslint-enable functional/no-loop-statements, fp/no-mutation, functional/immutable-data */

    return errors.length > 0 ? fail(errors) : ok(result as T);
  };
}

/* ============================================================================
 * 🧪 ASYNC HELPERS
 * ========================================================================== */

// Оборачивает sync-валидатор в async
export function toAsync<T>(validator: Validator<T>): AsyncValidator<T> {
  return async (input, ctx) => Promise.resolve(validator(input, ctx));
}

/* ============================================================================
 * 🏗️ FORM VALIDATION ADAPTER
 * ========================================================================== */

/**
 * Результат валидации формы — абстракция для UI-слоя.
 * Form компонент работает только с этой абстракцией, не зная деталей валидации.
 */
export type FormValidationResult = ValidationResult<Record<string, unknown>>;

/**
 * Core validation для form-like data.
 * Не зависит от DOM API, может использоваться в backend / workers / edge runtimes.
 */
export function validateFormData(
  data: Record<string, unknown>, // Form-like data (не зависит от DOM)
  schema: ValidationSchema, // Схема валидации (абстракция для UI-слоя)
  context?: ValidationContext, // Контекст валидации (опционально)
): FormValidationResult { // Результат валидации формы
  // Если схема не является ObjectSchema, возвращаем успешный результат
  // UI-слой не знает тип схемы, поэтому делегируем проверку
  if (!isObjectSchema(schema)) {
    return ok<Record<string, unknown>>(data);
  }

  // Вызываем валидацию через validateObject
  return validateObject(schema)(data, context ?? {});
}

/**
 * DOM adapter для HTML forms.
 * Thin wrapper around validateFormData.
 */
export function validateForm(
  form: HTMLFormElement, // HTML форма для валидации (DOM adapter)
  schema: ValidationSchema, // Схема валидации (абстракция для UI-слоя)
  context?: ValidationContext, // Контекст валидации (опционально)
): FormValidationResult { // Результат валидации формы
  /* eslint-disable ai-security/model-poisoning -- user input is validated by schema validators below */
  // Преобразуем FormData в объект для валидации
  const formData = new FormData(form);

  // Создаем иммутабельный объект данных
  const data = Array.from(formData.entries()).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      // Обрабатываем множественные значения (checkboxes, multiple selects)
      if (acc[key] !== undefined) {
        if (Array.isArray(acc[key])) {
          return {
            ...acc,
            [key]: [...(acc[key] as unknown[]), value],
          };
        } else {
          return {
            ...acc,
            [key]: [acc[key], value],
          };
        }
      } else {
        return {
          ...acc,
          [key]: value,
        };
      }
    },
    {},
  );
  /* eslint-enable ai-security/model-poisoning */

  return validateFormData(data, schema, context);
}

/**
 * Type guard для проверки что схема является ObjectSchema.
 * Внутренняя функция — UI-слой не должен знать о типах схем.
 */
function isObjectSchema<T extends Record<string, unknown>>(
  schema: unknown,
): schema is ObjectSchema<T> {
  // NB: используем Object.keys вместо Object.values (уменьшает поверхность для prototype pollution)
  return (
    typeof schema === 'object'
    && schema !== null
    && Object.keys(schema).every((key) =>
      typeof (schema as Record<string, unknown>)[key] === 'function'
    )
  );
}

/* ============================================================================
 * 📁 FILE VALIDATION ADAPTER
 * ========================================================================== */

const BYTES_PER_KILOBYTE = 1024; // 2^10 bytes in a kilobyte

/** Форматирует размер файла в человеко-читаемый формат. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < BYTES_PER_KILOBYTE) return `${bytes} Bytes`;
  const FILE_SIZE_UNITS = ['Bytes', 'KB', 'MB', 'GB'] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KILOBYTE));
  return `${Math.round((bytes / Math.pow(BYTES_PER_KILOBYTE, i)) * 100) / 100} ${
    FILE_SIZE_UNITS[i] ?? 'Bytes'
  }`;
}

/**
 * Валидирует один файл по базовым правилам.
 * Централизованная логика для предотвращения дублирования.
 */
export function validateFileBasic(
  file: File,
  maxSize?: number,
  accept?: string,
): FileValidationResult {
  // Проверка размера
  if (maxSize !== undefined && file.size > maxSize) {
    return {
      valid: false,
      error: `Файл "${file.name}" превышает максимальный размер ${formatFileSize(maxSize)}`,
    };
  }

  // Проверка типа (если указан accept)
  if (accept !== undefined && accept !== '' && accept !== '*') {
    const acceptedTypes = accept.split(',').map((type) => type.trim());
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    const MIME_WILDCARD_SUFFIX_LENGTH = 2; // Длина суффикса "/*"
    const isAccepted = acceptedTypes.some((acceptedType) => {
      const trimmed = acceptedType.toLowerCase();
      if (trimmed.endsWith('/*')) {
        return fileType.startsWith(trimmed.slice(0, -MIME_WILDCARD_SUFFIX_LENGTH));
      }
      if (trimmed.startsWith('.')) {
        return fileName.endsWith(trimmed);
      }
      return fileType === trimmed;
    });

    if (!isAccepted) {
      return {
        valid: false,
        error: `Недопустимый тип файла: ${file.name}`,
      };
    }
  }

  return { valid: true };
}
