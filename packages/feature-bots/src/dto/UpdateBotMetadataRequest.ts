/**
 * @file packages/feature-bots/src/dto/UpdateBotMetadataRequest.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — UpdateBotMetadataRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO-агрегат UpdateBotMetadataRequest: контракт запроса обновления метаданных бота для API boundary.
 * - Используется bot endpoints для обновления метаданных бота (name и будущие поля).
 * - Version-aware: включает currentVersion для optimistic concurrency control.
 *
 * Принципы:
 * - ✅ SRP: только структура запроса обновления метаданных (без конфигурации бота).
 * - ✅ DTO-pure: без HTTP/DB-деталей, только типы контрактов и инварианты.
 * - ✅ Immutable: все поля readonly для integrity и type-safety.
 * - ✅ Extensible: patch pattern для масштабируемости при добавлении новых полей.
 *
 * Разделение ответственности:
 * - UpdateBotMetadataRequest: обновление только метаданных с optimistic concurrency control (currentVersion).
 * - UpdateBotConfigRequest: обновление только конфигурации с идемпотентностью (operationId).
 */

import type { BotVersion } from '../domain/Bot.js';

/* ============================================================================
 * 🧩 UPDATE BOT METADATA REQUEST TYPES
 * ========================================================================== */

/** Utility type: требует наличие хотя бы одного поля объекта. */
export type AtLeastOne<T> = { [K in keyof T]-?: Pick<T, K> & Partial<Omit<T, K>>; }[keyof T];

/**
 * Patch для метаданных бота (name, description, avatar и т.д.).
 * Масштабируется при добавлении новых полей через AtLeastOne utility.
 */
export type BotMetadataPatch = Readonly<{
  /** Имя бота (опционально). */
  readonly name?: string;
}>;

/**
 * DTO запроса обновления метаданных бота.
 *
 * Инварианты:
 * - name: если задан, непустая строка (после trim).
 * - currentVersion: обязательная версия конфигурации (должна совпадать с текущей версией бота).
 * - Хотя бы одно поле метаданных должно быть задано (гарантируется типом AtLeastOne<BotMetadataPatch>).
 *
 * @remarks
 * Runtime validation выполняется в lib/bot-request-validator.ts.
 * Если currentVersion не совпадает с текущей версией бота, обновление отклоняется (409 Conflict).
 */
export type UpdateBotMetadataRequest = Readonly<
  AtLeastOne<BotMetadataPatch> & {
    /**
     * Текущая версия конфигурации бота (обязательно).
     * Используется для optimistic concurrency control.
     */
    readonly currentVersion: BotVersion;
  }
>;
