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
