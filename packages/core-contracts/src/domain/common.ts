/**
 * @file Общие типы, используемые во всех доменах
 */

/**
 * UUID как string (пока без branded types).
 * Позже можно добавить брендинг: string & { readonly __brand: 'UUID' }
 */
export type UUID = string;

/**
 * Timestamp в формате ISO 8601 (UTC).
 * Пример: "2026-01-09T21:34:12.123Z"
 */
export type Timestamp = string;

/**
 * Произвольный JSON-объект.
 * Используется для настроек, метаданных, дополнительных полей.
 */
export type JsonObject = Record<string, unknown>;

/**
 * Настройки как JSON-объект.
 */
export type Settings = JsonObject;

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
 */
export type PolicyDecision<AllowType extends string, DenyType> =
  | { readonly allow: true; readonly reason: AllowType; }
  | { readonly allow: false; readonly reason: DenyType; readonly violation?: PolicyViolation; };

/**
 * Тип решения с обязательным violation для deny случаев
 */
export type PolicyDecisionWithViolation<AllowType extends string, DenyType> =
  | { readonly allow: true; readonly reason: AllowType; }
  | { readonly allow: false; readonly reason: DenyType; readonly violation: PolicyViolation; };

/**
 * Фабрика для создания решений политики.
 * Type-safe конструктор решений с автоматической типизацией.
 */
export class Decision {
  /** Создать положительное решение */
  static allow<AllowType extends string>(
    reason: AllowType,
  ): PolicyDecision<AllowType, never> {
    return { allow: true, reason };
  }

  /** Создать отрицательное решение с PolicyViolation */
  static deny<DenyType>(
    reason: DenyType,
    violation: PolicyViolation,
  ): PolicyDecision<never, DenyType> & { readonly violation: PolicyViolation; } {
    return { allow: false, reason, violation };
  }

  /** Создать отрицательное решение без violation (для простых случаев) */
  static denySimple<DenyType>(
    reason: DenyType,
  ): PolicyDecision<never, DenyType> {
    return { allow: false, reason };
  }

  /** Создать отрицательное решение с опциональным violation */
  static denyOptional<DenyType>(
    reason: DenyType,
    violation?: PolicyViolation,
  ): PolicyDecision<never, DenyType> {
    return violation ? { allow: false, reason, violation } : { allow: false, reason };
  }
}

/**
 * Extension methods для работы с решениями политики.
 */
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
