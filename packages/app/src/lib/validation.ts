/**
 * @file packages/app/src/lib/validation.ts
 * ============================================================================
 * 🔹 VALIDATION CORE — ФУНКЦИОНАЛЬНАЯ ПОДСИСТЕМА ВАЛИДАЦИИ
 * ============================================================================
 * Назначение:
 * - Единый, типобезопасный слой валидации для всех микросервисов
 * - Детерминированные, композиционные валидаторы
 * - Совместимость с error-mapping.ts и telemetry
 * - Поддержка синхронных и асинхронных сценариев
 * - Подготовка к i18n, distributed tracing и Effect-first архитектуре
 * Принципы:
 * - Без side-effects
 * - Без классов
 * - Максимальная композиционность
 */

import type { ServiceErrorCode, ServicePrefix, TaggedError } from './error-mapping.js';
import { errorFireAndForget, warnFireAndForget } from './telemetry-runtime.js';
import type { FileValidationResult } from '../types/api.js';

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
  warnFireAndForget('Validation error created', {
    code,
    ...(options?.field != null && { field: options.field }),
    ...(options?.service != null && { service: options.service }),
  });

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

// pipeMany — последовательное применение нескольких валидаторов
export function pipeMany<T>(...validators: Validator<T>[]): Validator<T> {
  return (input, ctx) => {
    let currentValue: unknown = input;

    for (const validator of validators) {
      const result = validator(currentValue, ctx);
      if (!result.success) return result;
      currentValue = result.value;
    }

    return ok(currentValue as T);
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

/* ============================================================================
 * 🏗️ FORM VALIDATION ADAPTER
 * ========================================================================== */

/**
 * Результат валидации формы — абстракция для UI-слоя.
 * Form компонент работает только с этой абстракцией, не зная деталей валидации.
 */
export type FormValidationResult = ValidationResult<Record<string, unknown>>;

/**
 * Валидирует HTML форму по схеме.
 * Validation ожидает HTMLFormElement — не FormData или кастомный объект.
 * NOTE:
 * Если схема некорректна или не распознана,
 * валидация считается успешной (fail-soft),
 * ошибка логируется через telemetry.
 * @param form - HTML форма для валидации
 * @param schema - схема валидации (абстракция для UI-слоя)
 * @param context - контекст валидации
 * @returns результат валидации
 */
export function validateForm(
  form: HTMLFormElement,
  schema: ValidationSchema,
  context?: ValidationContext,
): FormValidationResult {
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

  // Если схема не является ObjectSchema, возвращаем успешный результат
  // UI-слой не знает тип схемы, поэтому делегируем проверку
  if (!isObjectSchema(schema)) {
    warnFireAndForget('Invalid validation schema provided to validateForm', {
      schemaType: typeof schema,
      ...(context?.service && { service: context.service }),
    });
    return ok(data);
  }

  // Вызываем валидацию через validateObject
  return validateObject(schema)(data, context ?? {});
}

/**
 * Type guard для проверки что схема является ObjectSchema.
 * Внутренняя функция — UI-слой не должен знать о типах схем.
 */
function isObjectSchema<T extends Record<string, unknown>>(
  schema: unknown,
): schema is ObjectSchema<T> {
  return (
    typeof schema === 'object'
    && schema !== null
    && Object.values(schema).every((validator) => typeof validator === 'function')
  );
}

/* ============================================================================
 * 📁 FILE VALIDATION ADAPTER
 * ========================================================================== */

const BYTES_PER_KILOBYTE = 1024; // 2^10 bytes in a kilobyte

/**
 * Форматирует размер файла в человеко-читаемый формат.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
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
