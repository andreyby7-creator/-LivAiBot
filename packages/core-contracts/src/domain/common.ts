/**
 * @file @livai/core-contracts/src/domain/common.ts
 *
 * ============================================================================
 * 🧩 COMMON DOMAIN TYPES — ФУНДАМЕНТАЛЬНЫЕ ТИПЫ ДЛЯ ВСЕХ ДОМЕНОВ
 * ============================================================================
 *
 * Фундаментальные типы, используемые во всех доменах и слоях приложения.
 * Без доменной логики и runtime-зависимостей.
 *
 * Используется для:
 * - Branded типы (ID<T>, ISODateString) для type-safety
 * - JSON типы (JsonObject, JsonValue, JsonArray) для метаданных и payload'ов
 * - Policy Decision типы для декларативных политик доступа
 * - Time типы (DurationMs, UnixTimestampMs) для работы со временем
 * - Утилитарные типы (Settings, UUID)
 *
 * Принципы:
 * - Zero business logic
 * - Zero runtime dependencies
 * - Детерминированность
 * - Полная типобезопасность через branded types
 * - Immutability по умолчанию (readonly)
 * - Future-proof расширяемость через metadata
 *
 * Границы слоёв:
 * - @livai/core-contracts (common) — чистый типовой слой, foundation для всех доменов.
 * - @livai/core — использует эти типы для реализации доменной логики.
 * - @livai/app — использует эти типы для UI и runtime-специфичных модулей.
 */

/* ========================================================================== */
/* 🔑 BRANDED TYPES - Type-safe идентификаторы и даты */
/* ========================================================================== */

declare const IDBrand: unique symbol;

/**
 * Уникальный идентификатор сущности с брендингом типов.
 * Предотвращает перепутывание ID разных сущностей.
 *
 * @example
 * export type UserID = ID<"UserID">;
 */
export type ID<T extends string = string> = string & {
  readonly [IDBrand]: T;
};

declare const ISODateBrand: unique symbol;

/**
 * ISO-8601 строка даты с брендингом.
 * Пример: "2026-01-16T12:34:56.000Z"
 */
export type ISODateString = string & { readonly [ISODateBrand]: 'ISODateString'; };

/**
 * Timestamp в формате ISO 8601 (UTC).
 * Пример: "2026-01-09T21:34:12.123Z"
 * @deprecated Используйте ISODateString для type-safety
 */
export type Timestamp = string;

declare const UUIDBrand: unique symbol;

/**
 * UUID как branded type для полной type-safety.
 * Используется для уникальных идентификаторов в формате UUID v4.
 * Предотвращает случайное использование обычных строк вместо UUID.
 */
export type UUID = string & {
  readonly [UUIDBrand]: 'UUID';
};

/* ========================================================================== */
/* 📦 JSON TYPES - Унифицированные JSON типы */
/* ========================================================================== */

/** Универсальный JSON-совместимый примитив */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Универсальный JSON-совместимый тип.
 * Применяется для метаданных, payload'ов и логирования.
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/** JSON-массив (рекурсивный, readonly) */
export type JsonArray = readonly JsonValue[];

/**
 * JSON-объект (immutable, domain-pure типизация).
 * Используется для настроек, метаданных, дополнительных полей.
 */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * Readonly alias для JsonObject.
 * Удобен для явного указания immutable JSON-объектов.
 */
export type ReadonlyJsonObject = Readonly<JsonObject>;

/**
 * Типизированный JSON-объект с optional generic для stricter typing.
 * Позволяет указать конкретную структуру для domain configs и settings.
 * @template T - Опциональная структура объекта для stricter typing
 */
export type TypedJsonObject<T extends Record<string, JsonValue> = Record<string, JsonValue>> =
  Readonly<T>;

/** Универсальный JSON-совместимый тип (алиас JsonValue) */
export type Json = JsonValue;

/** Настройки как JSON-объект */
export interface Settings extends JsonObject {}

/* ========================================================================== */
/* 🚦 DECISION TYPES - Типизированные решения политик */
/* ========================================================================== */

/**
 * Результат нарушения политики.
 * Используется для детального объяснения причин отказа.
 */
export interface PolicyViolation {
  /** Код нарушения */
  readonly code: string;
  /** Человекочитаемое описание */
  readonly reason?: string;
}

/**
 * Базовый тип решения политики.
 * Exhaustive union для type-safe обработки.
 * @template AllowType - Тип причины разрешения (discriminated union)
 * @template DenyType - Тип причины отказа (discriminated union)
 * @property metadata - Опциональные метаданные для future-proof расширения данных о политике
 *                      без изменения existing union types. Позволяет добавлять дополнительную
 *                      информацию (traceId, audit logs, context) без breaking changes.
 */
export type PolicyDecision<AllowType extends string, DenyType> =
  | { readonly allow: true; readonly reason: AllowType; readonly metadata?: JsonObject; }
  | {
    readonly allow: false;
    readonly reason: DenyType;
    readonly violation?: PolicyViolation;
    readonly metadata?: JsonObject;
  };

/**
 * Тип решения с обязательным violation для deny случаев.
 * @template AllowType - Тип причины разрешения (discriminated union)
 * @template DenyType - Тип причины отказа (discriminated union)
 * @property metadata - Опциональные метаданные для future-proof расширения данных о политике.
 */
export type PolicyDecisionWithViolation<AllowType extends string, DenyType> =
  | { readonly allow: true; readonly reason: AllowType; readonly metadata?: JsonObject; }
  | {
    readonly allow: false;
    readonly reason: DenyType;
    readonly violation: PolicyViolation;
    readonly metadata?: JsonObject;
  };

/**
 * Фабрика для создания решений политики.
 * Type-safe конструктор решений с автоматической типизацией.
 */
export class Decision {
  /**
   * Создать положительное решение.
   * @param reason - Причина разрешения
   * @param metadata - Опциональные метаданные для расширения данных о политике
   */
  static allow<AllowType extends string>(
    reason: AllowType,
    metadata?: JsonObject,
  ): PolicyDecision<AllowType, never> {
    return metadata ? { allow: true, reason, metadata } : { allow: true, reason };
  }

  /**
   * Создать отрицательное решение с PolicyViolation.
   * @param reason - Причина отказа
   * @param violation - Детали нарушения политики
   * @param metadata - Опциональные метаданные для расширения данных о политике
   */
  static deny<DenyType>(
    reason: DenyType,
    violation: PolicyViolation,
    metadata?: JsonObject,
  ): PolicyDecision<never, DenyType> & { readonly violation: PolicyViolation; } {
    return metadata
      ? { allow: false, reason, violation, metadata }
      : { allow: false, reason, violation };
  }

  /**
   * Создать отрицательное решение без violation (для простых случаев).
   * @param reason - Причина отказа
   * @param metadata - Опциональные метаданные для расширения данных о политике
   */
  static denySimple<DenyType>(
    reason: DenyType,
    metadata?: JsonObject,
  ): PolicyDecision<never, DenyType> {
    return metadata ? { allow: false, reason, metadata } : { allow: false, reason };
  }

  /**
   * Создать отрицательное решение с опциональным violation.
   * @param reason - Причина отказа
   * @param violation - Опциональные детали нарушения политики
   * @param metadata - Опциональные метаданные для расширения данных о политике
   */
  static denyOptional<DenyType>(
    reason: DenyType,
    violation?: PolicyViolation,
    metadata?: JsonObject,
  ): PolicyDecision<never, DenyType> {
    if (violation && metadata) {
      return { allow: false, reason, violation, metadata };
    }
    if (violation) {
      return { allow: false, reason, violation };
    }
    if (metadata) {
      return { allow: false, reason, metadata };
    }
    return { allow: false, reason };
  }
}

/** Extension methods для работы с решениями политики */
export class DecisionUtils {
  /** Проверить, является ли решение отрицательным */
  static isDenied(
    decision: PolicyDecision<string, unknown>,
  ): decision is {
    readonly allow: false;
    readonly reason: unknown;
    readonly violation?: PolicyViolation;
  } {
    return !decision.allow;
  }

  /** Проверить, является ли решение положительным */
  static isAllowed(
    decision: PolicyDecision<string, unknown>,
  ): decision is { readonly allow: true; readonly reason: string; } {
    return decision.allow;
  }
}

/* ========================================================================== */
/* ⏱️ TIME TYPES - Типы для работы со временем */
/* ========================================================================== */

/**
 * Длительность в миллисекундах.
 * Используется для таймаутов, TTL, интервалов.
 */
export type DurationMs = number;

/**
 * Unix timestamp в миллисекундах (число).
 * Используется для точных временных меток.
 */
export type UnixTimestampMs = number;
