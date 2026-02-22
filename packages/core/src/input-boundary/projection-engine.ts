/**
 * @file packages/core/src/input-boundary/projection-engine.ts
 * ============================================================================
 * 🛡️ CORE — Input Boundary (Projection Engine)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Generic projection engine для трансформации domain объектов в boundary contracts (DTO, events, persistence, audit)
 * - Архитектура: selection → enrichment slots (contributions) → merge (conflict detection) → safe-keys validation → freeze
 * - Причина изменения: input boundary, domain-to-DTO transformation, projection layer
 *
 * Принципы:
 * - ✅ SRP: разделение selection / enrichment / merge / validation
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты (order-independent)
 * - ✅ Domain-pure: без side-effects, платформо-агностично, generic по типам domain и DTO
 * - ✅ Extensible: composable projection slots через ProjectionSlot без изменения core-логики
 * - ✅ Strict typing: union-типы для TransformationFailureReason, DtoSchema для versioned boundaries
 * - ✅ Microservice-ready: строгие контракты для межсервисного взаимодействия
 * - ✅ Scalable: patch-based slots (order-independent, composable)
 * - ✅ Security-first: защита от object injection, prototype pollution, JSON-serializable
 * - ✅ Slot-architecture ready: deterministic projection layer
 *
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает sanitization (это в data-safety/)
 * - ✅ Только projection и enrichment (selection → contributions → merge → freeze)
 * - ✅ Fail-fast: первая ошибка останавливает трансформацию
 * - ✅ Immutable: все результаты frozen
 * - ✅ Order-independent: slots возвращают contributions, не мутируют DTO
 * - ✅ Conflict detection: merge детектирует конфликты, не решает их (projection responsibility)
 */

import type { JsonValue } from './generic-validation.js';
import { isJsonSerializable } from './generic-validation.js';

/* ============================================================================
 * 1. TYPES — PROJECTION MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Результат трансформации (effect-based, для composability) @template TDto - Тип результирующего DTO */
export type TransformationOutcome<TDto> =
  | Readonly<{ ok: true; value: TDto; }>
  | Readonly<{ ok: false; reason: TransformationFailureReason; }>;

/** Причина ошибки трансформации (union type) */
export type TransformationFailureReason =
  | Readonly<{ kind: 'INVALID_FIELD_NAME'; field: string; }>
  | Readonly<{ kind: 'FORBIDDEN_FIELD'; field: string; }>
  | Readonly<{ kind: 'NOT_JSON_SERIALIZABLE'; field: string; reason: string; }>
  | Readonly<{ kind: 'TRANSFORMER_ERROR'; transformer: string; reason: string; }>
  | Readonly<{ kind: 'CONFLICTING_PATCHES'; field: string; }>;

/**
 * Field mapper: маппит fieldName → domain accessor (decouples boundary от domain shape, позволяет переименовывать поля без breaking API)
 * @template TDomain - Тип domain объекта
 * @example mapper: DtoFieldMapper<RiskSignals> = (d, f) => f === 'isVpn' ? d.isVpn : f === 'isTor' ? d.isTor : undefined;
 */
export type DtoFieldMapper<TDomain> = (
  domain: TDomain,
  fieldName: string,
) => unknown;

/**
 * DTO Schema: versioned boundary contract (fields + mapper, объединяет whitelist и mapper для type-safe versioned DTO)
 * @template TDomain - Тип domain объекта
 * @example schema: DtoSchema<RiskSignals> = { fields: ['isVpn', 'isTor'], mapper: (d, f) => d[f] };
 */
export type DtoSchema<TDomain> = Readonly<{
  /** Whitelist разрешенных полей для DTO (string[], не keyof TDomain) */
  readonly fields: readonly string[];
  /** Field mapper для доступа к полям domain (decouples boundary от domain shape) */
  readonly mapper: DtoFieldMapper<TDomain>;
}>;

/**
 * Projection slot: order-independent enrichment (возвращает contribution, не мутирует DTO, structural signals, не DTO-shape)
 * @template TDomain - Тип domain объекта
 * @requirements Детерминированность, order-independence, structural signals, безопасность, идемпотентность, composable
 * @example slot: ProjectionSlot<RiskSignals> = { name: 'geo', transform: (d) => ({ ok: true, value: d.previousGeo ? { previousGeo: d.previousGeo } : {} }) };
 */
export type ProjectionSlot<TDomain> = Readonly<{
  /** Имя slot (для отладки и error reporting) */
  readonly name: string;
  /** Трансформация: возвращает contribution (structural signals), не мутирует входящий DTO */
  readonly transform: (
    domain: TDomain,
    context: TransformationContext,
  ) => TransformationOutcome<Readonly<Record<string, JsonValue>>>;
}>;

/** Контекст трансформации (статический, без runtime state) @template TMetadata - Тип метаданных для type-safe расширения */
export type TransformationContext<TMetadata = unknown> = Readonly<{
  /** Опциональные метаданные для slots (type-safe через generic) */
  readonly metadata?: TMetadata;
}>;

/* ============================================================================
 * 2. SECURITY — PROTOTYPE POLLUTION PROTECTION
 * ============================================================================
 */

/** Запрещенные ключи для защиты от prototype pollution (блокируются на всех этапах) */
const FORBIDDEN_KEYS = new Set<string>([
  '__proto__',
  'constructor',
  'prototype',
]);

/** Проверяет, является ли ключ запрещенным (prototype pollution protection) @internal */
function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

/** Проверяет, является ли ключ валидным для DTO (не запрещенный) @internal */
function isValidFieldName(fieldName: string): boolean {
  return typeof fieldName === 'string' && fieldName.length > 0 && !isForbiddenKey(fieldName);
}

/** Проверяет объект на запрещенные ключи (post-merge guard, защита от prototype pollution через mapper/slot) @internal */
function assertSafeObject(obj: Readonly<Record<string, JsonValue>>): boolean {
  return !Object.keys(obj).some((key) => isForbiddenKey(key));
}

/* ============================================================================
 * 🔍 JSON-SERIALIZABLE VALIDATION — RUNTIME CHECKS
 * ============================================================================
 */

/** Runtime-check: гарантирует JSON-serializable (проверяет функции, символы, циклические ссылки) @internal */
function assertJsonSerializable(
  value: unknown,
  fieldName: string,
): TransformationOutcome<JsonValue> {
  if (value === undefined || value === null) {
    // undefined и null считаются валидными (будут отфильтрованы позже)
    return Object.freeze({ ok: true, value: value as JsonValue });
  }

  // Проверка на функции
  if (typeof value === 'function') {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'NOT_JSON_SERIALIZABLE',
        field: fieldName,
        reason: 'Field contains a function, which is not JSON-serializable',
      }),
    });
  }

  // Проверка на символы
  if (typeof value === 'symbol') {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'NOT_JSON_SERIALIZABLE',
        field: fieldName,
        reason: 'Field contains a symbol, which is not JSON-serializable',
      }),
    });
  }

  // Проверка на JSON-serializable через isJsonSerializable
  if (!isJsonSerializable(value)) {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'NOT_JSON_SERIALIZABLE',
        field: fieldName,
        reason: 'Field is not JSON-serializable (contains circular references or invalid types)',
      }),
    });
  }

  return Object.freeze({ ok: true, value });
}

/* ============================================================================
 * 🔄 CORE TRANSFORMATION PIPELINE — SELECTION → CONTRIBUTIONS → MERGE → FREEZE
 * ============================================================================
 */

/** Stage 1: Field Selection (projection через mapper, decoupled от domain shape) @internal */
function selectFields<TDomain extends object>(
  domain: TDomain,
  schema: DtoSchema<TDomain>,
): TransformationOutcome<Record<string, JsonValue>> {
  // Итерируемся только по whitelist (защита от object injection)
  const result = schema.fields.reduce<
    TransformationOutcome<Record<string, JsonValue>>
  >(
    (acc, fieldName) => {
      if (!acc.ok) {
        return acc;
      }

      // Проверка на запрещенные ключи (prototype pollution protection)
      if (!isValidFieldName(fieldName)) {
        return Object.freeze({
          ok: false,
          reason: Object.freeze({
            kind: 'FORBIDDEN_FIELD',
            field: fieldName,
          }),
        });
      }

      // Получаем значение через mapper (decoupled от domain shape)
      const value = schema.mapper(domain, fieldName);

      // Пропускаем undefined значения
      if (value === undefined) {
        return acc;
      }

      // Runtime-check: гарантируем JSON-serializable
      const serializableCheck = assertJsonSerializable(value, fieldName);
      if (!serializableCheck.ok) {
        return serializableCheck;
      }

      // Создаем новый объект (immutable)
      return Object.freeze({
        ok: true,
        value: Object.freeze({
          ...acc.value,
          [fieldName]: serializableCheck.value,
        }),
      });
    },
    Object.freeze({ ok: true, value: {} as Record<string, JsonValue> }),
  );

  return result;
}

/** Stage 2: Enrichment Slots (order-independent contributions) @internal */
function collectContributions<TDomain extends object>(
  domain: TDomain,
  slots: readonly ProjectionSlot<TDomain>[],
  context: TransformationContext,
): TransformationOutcome<readonly Readonly<Record<string, JsonValue>>[]> {
  const result = slots.reduce<
    TransformationOutcome<readonly Readonly<Record<string, JsonValue>>[]>
  >(
    (acc, slot) => {
      if (!acc.ok) {
        return acc;
      }

      const slotResult = slot.transform(domain, context);
      if (!slotResult.ok) {
        return Object.freeze({
          ok: false,
          reason: Object.freeze({
            kind: 'TRANSFORMER_ERROR',
            transformer: slot.name,
            reason: slotResult.reason.kind === 'NOT_JSON_SERIALIZABLE'
              ? slotResult.reason.reason
              : `Slot "${slot.name}" failed`,
          }),
        });
      }

      // Проверка contribution на JSON-serializable
      if (!isJsonSerializable(slotResult.value)) {
        return Object.freeze({
          ok: false,
          reason: Object.freeze({
            kind: 'TRANSFORMER_ERROR',
            transformer: slot.name,
            reason: 'Slot returned non-JSON-serializable contribution',
          }),
        });
      }

      // Создаем новый массив (immutable)
      return Object.freeze({
        ok: true,
        value: Object.freeze([...acc.value, slotResult.value]),
      });
    },
    Object.freeze({ ok: true, value: Object.freeze([]) }),
  );

  return result;
}

/** Применяет один contribution к DTO с детекцией конфликтов @internal */
function applyContribution(
  dto: Readonly<Record<string, JsonValue>>,
  contribution: Readonly<Record<string, JsonValue>>,
): TransformationOutcome<Record<string, JsonValue>> {
  return Object.keys(contribution).reduce<TransformationOutcome<Record<string, JsonValue>>>(
    (acc, key) => {
      if (!acc.ok) {
        return acc;
      }

      // Проверка на запрещенные ключи в contribution (prototype pollution protection)
      if (!isValidFieldName(key)) {
        return Object.freeze({
          ok: false,
          reason: Object.freeze({
            kind: 'FORBIDDEN_FIELD',
            field: key,
          }),
        });
      }

      const value = contribution[key];
      if (value === undefined) {
        return acc;
      }

      // Runtime-check: гарантируем JSON-serializable
      const serializableCheck = assertJsonSerializable(value, key);
      if (!serializableCheck.ok) {
        return serializableCheck;
      }

      // Детекция конфликтов: если ключ уже есть и значение отличается - конфликт
      if (key in acc.value) {
        const existingValue = acc.value[key];
        // Строгое сравнение для детекции конфликтов (не overwrite!)
        if (existingValue !== serializableCheck.value) {
          return Object.freeze({
            ok: false,
            reason: Object.freeze({
              kind: 'CONFLICTING_PATCHES',
              field: key,
            }),
          });
        }
      }

      // Создаем новый объект (immutable)
      return Object.freeze({
        ok: true,
        value: Object.freeze({
          ...acc.value,
          [key]: serializableCheck.value,
        }),
      });
    },
    Object.freeze({ ok: true, value: { ...dto } }),
  );
}

/** Stage 3: Merge contributions (structural composition validator, не reducer! Projection layer не решает конфликты) @internal */
function mergeContributions(
  baseDto: Readonly<Record<string, JsonValue>>,
  contributions: readonly Readonly<Record<string, JsonValue>>[],
): TransformationOutcome<Record<string, JsonValue>> {
  const result = contributions.reduce<TransformationOutcome<Record<string, JsonValue>>>(
    (acc, contribution) => {
      if (!acc.ok) {
        return acc;
      }
      return applyContribution(acc.value, contribution);
    },
    Object.freeze({ ok: true, value: { ...baseDto } }),
  );

  if (!result.ok) {
    return result;
  }

  // Post-merge guard: проверка на запрещенные ключи в результате
  if (!assertSafeObject(result.value)) {
    return Object.freeze({
      ok: false,
      reason: Object.freeze({
        kind: 'FORBIDDEN_FIELD',
        field: 'root',
      }),
    });
  }

  return result;
}

/**
 * Преобразует domain объект в DTO через pipeline: selection → contributions → merge → freeze
 * Projection engine не решает валидность результата (empty result = domain decision)
 * @template TDomain - Тип domain объекта
 * @template TDto - Тип результирующего DTO
 * @public
 */
export function transformDomainToDto<TDomain extends object, TDto extends JsonValue>(
  domain: TDomain | undefined,
  schema: DtoSchema<TDomain>,
  slots: readonly ProjectionSlot<TDomain>[] = [],
  context: TransformationContext = {},
): TransformationOutcome<TDto> {
  if (domain === undefined) {
    // Projection всегда ok если структура валидна (empty = domain decision)
    return Object.freeze({
      ok: true,
      value: Object.freeze({}) as TDto,
    });
  }

  // Stage 1: Field Selection (projection)
  const selectionResult = selectFields(domain, schema);
  if (!selectionResult.ok) {
    return selectionResult;
  }

  // Stage 2: Enrichment Slots (projection slots)
  const contributionsResult = collectContributions(domain, slots, context);
  if (!contributionsResult.ok) {
    return contributionsResult;
  }

  // Stage 3: Merge contributions into base DTO (structural composition validator)
  const mergeResult = mergeContributions(selectionResult.value, contributionsResult.value);
  if (!mergeResult.ok) {
    return mergeResult;
  }

  // Stage 4: Freeze (immutability)
  const frozenDto = Object.freeze(mergeResult.value);

  // Projection всегда ok если структура валидна (empty result = domain decision, не projection responsibility)
  return Object.freeze({
    ok: true,
    value: frozenDto as TDto,
  });
}

/* ============================================================================
 * 🔧 COMPOSITION HELPERS — МНОЖЕСТВЕННАЯ ТРАНСФОРМАЦИЯ
 * ============================================================================
 */

/**
 * Преобразует массив domain объектов в массив DTO (fail-fast: первая ошибка останавливает трансформацию)
 * @template TDomain - Тип domain объекта
 * @template TDto - Тип результирующего DTO
 * @public
 */
export function transformDomainsToDtos<TDomain extends object, TDto extends JsonValue>(
  domains: readonly (TDomain | undefined)[],
  schema: DtoSchema<TDomain>,
  slots: readonly ProjectionSlot<TDomain>[] = [],
  context: TransformationContext = {},
): TransformationOutcome<readonly TDto[]> {
  const result = domains.reduce<TransformationOutcome<readonly TDto[]>>(
    (acc, domain) => {
      if (!acc.ok) {
        return acc;
      }

      const domainResult = transformDomainToDto<TDomain, TDto>(domain, schema, slots, context);
      if (!domainResult.ok) {
        return domainResult;
      }

      // Создаем новый массив (immutable)
      return Object.freeze({
        ok: true,
        value: Object.freeze([...acc.value, domainResult.value]),
      });
    },
    Object.freeze({ ok: true, value: Object.freeze([]) }),
  );

  return result;
}

/**
 * Преобразует domain объект в частичный DTO (опциональные поля, undefined только при ошибке, не при empty result)
 * @template TDomain - Тип domain объекта
 * @template TDto - Тип результирующего DTO
 * @public
 */
export function transformDomainToPartialDto<TDomain extends object, TDto extends JsonValue>(
  domain: TDomain | undefined,
  schema: DtoSchema<TDomain>,
  slots: readonly ProjectionSlot<TDomain>[] = [],
  context: TransformationContext = {},
): TDto | undefined {
  const result = transformDomainToDto<TDomain, TDto>(domain, schema, slots, context);
  if (!result.ok) {
    return undefined;
  }
  return result.value;
}
