/**
 * @file packages/core/src/input-boundary/api-validation-runtime.ts
 * ============================================================================
 * 🛡️ API VALIDATION RUNTIME — SECURITY + ERRORS + ADAPTERS (ZOD) + TELEMETRY HOOKS
 * ============================================================================
 *
 * Низкоуровневый runtime слой для api-schema-guard:
 * - security checks (payload size)
 * - error construction (error-mapping → ApiValidationError)
 * - Zod adapters (safeParse → ValidationError[])
 * - observability hooks (DI)
 *
 * Важно: этот модуль НЕ содержит orchestration validateApiRequest/Response/Interaction.
 */

import { Effect as EffectLib } from 'effect';

import type {
  TaggedError,
  ValidationContext,
  ValidationError,
  Validator,
} from '@livai/core/effect';
import { mapError } from '@livai/core/effect';
import type { HttpMethod } from '@livai/core-contracts';

import { zodIssuesToValidationErrors } from '../effect/schema-validated-effect.js';
import { stableHash } from '../hash.js';

/* ============================================================================
 * 🔢 CONSTANTS
 * ========================================================================== */

const BYTES_IN_KB = 1024;
const DEFAULT_PAYLOAD_ESTIMATE_SIZE = 8; // Default size estimate for unknown types
const PAYLOAD_SAMPLE_SIZE = BYTES_IN_KB; // Sample first 1KB of large payloads for logging
const MAX_RECURSION_DEPTH = 10; // Maximum recursion depth for nested structures
const PAYLOAD_HASH_LENGTH = 8; // Length of payload hash for observability
const HEX_RADIX = 16;
const MAX_ARRAY_ITEMS = 10_000; // Hard cap для обхода больших массивов
const MAX_COLLECTION_ITEMS = 1_000; // Hard cap для обхода Map/Set

/* ============================================================================
 * 🧠 CONTEXT
 * ========================================================================== */

/** Неблокирующие DI-хуки для логирования предупреждений/ошибок валидации. */
export type ApiValidationTelemetry = Readonly<{
  readonly onWarning?: (info: {
    readonly message: string;
    readonly endpoint: string;
    readonly requestId: string;
    readonly details?: unknown;
    readonly service?: string | undefined;
    readonly traceId?: string | undefined;
    readonly serviceId?: string | undefined;
    readonly instanceId?: string | undefined;
  }) => void;
  readonly onError?: (info: {
    readonly message: string;
    readonly endpoint: string;
    readonly requestId: string;
    readonly details?: unknown;
    readonly service?: string | undefined;
    readonly traceId?: string | undefined;
    readonly serviceId?: string | undefined;
    readonly instanceId?: string | undefined;
  }) => void;
}>;

/** Базовый контекст для всех runtime-проверок API (метод, endpoint, трейс и т.п.). */
export type ApiValidationContextBase = ValidationContext & {
  readonly method: HttpMethod;
  readonly endpoint: string;
  readonly requestId: string;
  readonly serviceId?: string;
  readonly instanceId?: string;
  readonly telemetry?: ApiValidationTelemetry | undefined;
};

/* ============================================================================
 * ❌ ERRORS
 * ========================================================================== */

export type ApiValidationErrorCode =
  | 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID'
  | 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID'
  | 'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE'
  | 'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE'
  | 'SYSTEM_VALIDATION_REQUEST_HEADERS_INVALID'
  | 'SYSTEM_VALIDATION_RESPONSE_HEADERS_INVALID'
  | 'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH'
  | 'SYSTEM_VALIDATION_TIMEOUT_EXCEEDED';

export type ApiValidationError = TaggedError<ApiValidationErrorCode> & {
  readonly field?: string | undefined;
  /** Безопасное значение (для логов/telemetry), без утечки объектов/секретов */
  readonly value?: string | number | boolean;
  readonly schema?: string;
  readonly details?: unknown;
};

/* ============================================================================
 * 🔧 VALIDATOR TYPES
 * ========================================================================== */

/** Валидатор тела входящего запроса. */
export type ApiRequestValidator<T = unknown> = Validator<T>;
/** Валидатор тела исходящего ответа. */
export type ApiResponseValidator<T = unknown> = Validator<T>;

/* ============================================================================
 * 🔭 OBSERVABILITY (DI)
 * ========================================================================== */

export function emitWarning(
  context: ApiValidationContextBase,
  message: string,
  details?: unknown,
): void {
  context.telemetry?.onWarning?.({
    message,
    endpoint: context.endpoint,
    requestId: context.requestId,
    details,
    service: context.service,
    traceId: context.traceId,
    serviceId: context.serviceId,
    instanceId: context.instanceId,
  });
}

export function emitError(
  context: ApiValidationContextBase,
  message: string,
  details?: unknown,
): void {
  context.telemetry?.onError?.({
    message,
    endpoint: context.endpoint,
    requestId: context.requestId,
    details,
    service: context.service,
    traceId: context.traceId,
    serviceId: context.serviceId,
    instanceId: context.instanceId,
  });
}

/* ============================================================================
 * 🔐 SECURITY — PAYLOAD SIZE
 * ========================================================================== */

/** Подсчёт UTF‑8 длины строки; использует TextEncoder, при его отсутствии даёт безопасную ASCII-оценку. */
export function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  // Fallback: приблизительная оценка (ASCII-safe)
  return value.length;
}

/** Строит компактный JSON‑сэмпл payload для логов (с хэшем и исходным размером). */
export function createPayloadSample(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    const fullSize = utf8ByteLength(json);

    if (fullSize <= PAYLOAD_SAMPLE_SIZE) {
      return json;
    }

    const truncated = json.substring(0, PAYLOAD_SAMPLE_SIZE);
    const hash = stableHash(json)
      .toString(HEX_RADIX)
      .padStart(PAYLOAD_HASH_LENGTH, '0')
      .substring(0, PAYLOAD_HASH_LENGTH);

    return `${truncated}...[TRUNCATED, HASH:${hash}, SIZE:${fullSize}]`;
  } catch {
    return '[NON_SERIALIZABLE_PAYLOAD]';
  }
}

/**
 * Грубая оценка размера произвольного payload в байтах с защитой от глубокой/большой рекурсии.
 * Используется только для принятия решений об ограничении размера, не для точного биллинга.
 */
export function estimatePayloadSize(data: unknown, depth: number = 0): number {
  if (data === null || data === undefined) {
    return 0;
  }

  if (typeof data === 'string') {
    return utf8ByteLength(data);
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return DEFAULT_PAYLOAD_ESTIMATE_SIZE;
  }

  if (depth >= MAX_RECURSION_DEPTH) {
    return DEFAULT_PAYLOAD_ESTIMATE_SIZE;
  }

  if (Array.isArray(data)) {
    return estimateArraySize(data, depth);
  }

  if (data instanceof Map) {
    return estimateMapSize(data, depth);
  }

  if (data instanceof Set) {
    return estimateSetSize(data, depth);
  }

  if (typeof data === 'object') {
    return estimateObjectSize(data);
  }

  return DEFAULT_PAYLOAD_ESTIMATE_SIZE;
}

/** Линейная оценка размера массива с жёстким лимитом по количеству элементов. */
function estimateArraySize(data: readonly unknown[], depth: number): number {
  const limit = Math.min(data.length, MAX_ARRAY_ITEMS);
  /* eslint-disable functional/no-loop-statements, functional/no-let, fp/no-mutation */
  // Perf: локальные мутации/циклы здесь оправданы — это чистая, не утекающая наружу
  // числовая агрегация с ограничением по количеству элементов (защита от DoS).
  let size = 0;
  for (let i = 0; i < limit; i += 1) {
    size += estimatePayloadSize(data[i], depth + 1);
  }
  /* eslint-enable functional/no-loop-statements, functional/no-let, fp/no-mutation */
  return size;
}

/** Оценка размера значений в Map; ключи намеренно игнорируются. */
function estimateMapSize(data: ReadonlyMap<unknown, unknown>, depth: number): number {
  /* eslint-disable functional/no-loop-statements, functional/no-let, fp/no-mutation */
  let size = 0;
  let count = 0;
  for (const [, value] of data) {
    if (count >= MAX_COLLECTION_ITEMS) break;
    size += estimatePayloadSize(value, depth + 1);
    count += 1;
  }
  /* eslint-enable functional/no-loop-statements, functional/no-let, fp/no-mutation */
  return size;
}

/** Оценка размера элементов Set с лимитом по количеству элементов. */
function estimateSetSize(data: ReadonlySet<unknown>, depth: number): number {
  /* eslint-disable functional/no-loop-statements, functional/no-let, fp/no-mutation */
  let size = 0;
  let count = 0;
  for (const value of data) {
    if (count >= MAX_COLLECTION_ITEMS) break;
    size += estimatePayloadSize(value, depth + 1);
    count += 1;
  }
  /* eslint-enable functional/no-loop-statements, functional/no-let, fp/no-mutation */
  return size;
}

export function estimateObjectSize(data: object): number {
  try {
    const json = JSON.stringify(data);
    return utf8ByteLength(json);
  } catch {
    try {
      const seen = new WeakSet();
      const json = JSON.stringify(data, (_: string, value: unknown) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[CIRCULAR]';
          seen.add(value);
        }
        return value;
      });
      return utf8ByteLength(json);
    } catch {
      return DEFAULT_PAYLOAD_ESTIMATE_SIZE;
    }
  }
}

/** Диагностическая информация о нарушении лимита размера payload. */
export type PayloadSizeViolation = Readonly<{
  readonly size: number;
  readonly maxSize: number;
  readonly payloadSample: string;
}>;

/** Проверяет размер payload и при превышении лимита возвращает детали и шлёт телеметрию. */
export function checkPayloadSize(
  kind: 'request' | 'response',
  payload: unknown,
  maxSize: number,
  context: ApiValidationContextBase,
): PayloadSizeViolation | null {
  try {
    const size = estimatePayloadSize(payload);
    if (size > maxSize) {
      const details = {
        size,
        maxSize,
        payloadSample: createPayloadSample(payload),
      };

      if (kind === 'request') {
        emitWarning(context, 'API request payload too large', details);
      } else {
        emitError(context, 'API response payload too large', details);
      }

      return details;
    }
  } catch {
    if (kind === 'request') {
      emitWarning(context, 'Failed to estimate request payload size');
    } else {
      emitWarning(context, 'Failed to estimate response payload size');
    }
  }

  return null;
}

/* ============================================================================
 * 🏗️ ERROR FACTORY
 * ========================================================================== */

/**
 * Фабрика маппинга ValidationError[] + контекст → ApiValidationError с учётом локали/времени.
 * toTimestamp инжектируется для стабильных тестов / кастомного источника времени.
 */
export function createApiValidationErrorFactory(
  toTimestamp: () => number = () => Date.now(),
): (
  code: ApiValidationErrorCode,
  validationErrors: ValidationError[],
  context: ApiValidationContextBase,
  field?: string,
  details?: unknown,
) => EffectLib.Effect<never, ApiValidationError, never> {
  return (code, validationErrors, context, field, details) => {
    const mappedError = mapError(
      code,
      {
        endpoint: context.endpoint,
        method: context.method,
        traceId: context.traceId,
        requestId: context.requestId,
        serviceId: context.serviceId,
        instanceId: context.instanceId,
        field,
        details: validationErrors.length > 0 ? validationErrors : details,
      },
      { locale: context.locale ?? 'ru', timestamp: toTimestamp() },
    );

    const apiError: ApiValidationError = {
      code,
      service: mappedError.service,
      field,
      details: validationErrors.length > 0
        ? validationErrors
        : (details as ValidationError[] | undefined),
    };

    emitError(context, `API validation failed: ${code}`, {
      code,
      ...(field !== undefined && { field }),
      validationErrors: validationErrors.length,
    });

    return EffectLib.fail(apiError);
  };
}

/* ============================================================================
 * 🔗 ZOD ADAPTERS
 * ========================================================================== */

/** Минимальный Zod‑подобный интерфейс, достаточный для адаптеров (parse/safeParse). */
interface ZodLikeSchema<T> {
  parse: (data: unknown) => T;
  safeParse: (
    data: unknown,
  ) => {
    success: boolean;
    error?: { issues: { path: (string | number)[]; message: string; }[]; };
    data?: T;
  };
}

/** Общий адаптер Zod‑подобной схемы к core‑валидации с заданным кодом ошибки. */
function createZodValidator<T>(
  errorCode: ApiValidationErrorCode,
  schema: {
    safeParse: ZodLikeSchema<T>['safeParse'];
  },
): (value: unknown, context: ValidationContext) => {
  readonly success: true;
  readonly value: T;
} | {
  readonly success: false;
  readonly errors: readonly ValidationError[];
} {
  return (value: unknown, context: ValidationContext) => {
    const result = schema.safeParse(value);

    if (result.success && result.data !== undefined) {
      return { success: true as const, value: result.data as T };
    }

    const errors = zodIssuesToValidationErrors(
      errorCode,
      !result.success && result.error?.issues
        ? result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
        : [],
      context.service,
    );

    return { success: false as const, errors };
  };
}

/** Адаптер Zod‑схемы для валидации тела запроса. */
export function createZodRequestValidator<T>(
  schema: ZodLikeSchema<T>,
): ApiRequestValidator<T> {
  return createZodValidator<T>('SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID', schema);
}

/** Адаптер Zod‑схемы для валидации тела ответа. */
export function createZodResponseValidator<T>(
  schema: ZodLikeSchema<T>,
): ApiResponseValidator<T> {
  return createZodValidator<T>('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID', schema);
}
