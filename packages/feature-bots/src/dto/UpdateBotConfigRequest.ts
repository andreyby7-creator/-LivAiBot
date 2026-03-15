/**
 * @file packages/feature-bots/src/dto/UpdateBotConfigRequest.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — UpdateBotConfigRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO-агрегат UpdateBotConfigRequest: контракт запроса обновления конфигурации бота для API boundary.
 * - Используется bot endpoints для обновления конфигурации бота (instruction, settings и будущие поля).
 * - Поддерживает идемпотентность через operationId для безопасных ретраев без дублей.
 *
 * Принципы:
 * - ✅ SRP: только структура запроса обновления конфигурации (без метаданных бота).
 * - ✅ DTO-pure: без HTTP/DB-деталей, только типы контрактов и инварианты.
 * - ✅ Immutable: все поля readonly для integrity и type-safety.
 * - ✅ Extensible: patch pattern для масштабируемости при добавлении новых полей.
 * - ✅ Idempotent: operationId обеспечивает безопасные ретраи без дублирования версий.
 *
 * Разделение ответственности:
 * - UpdateBotMetadataRequest: обновление только метаданных с optimistic concurrency control (currentVersion).
 * - UpdateBotConfigRequest: обновление только конфигурации с идемпотентностью через operationId.
 */

import type { BotSettings } from '../domain/BotSettings.js';
import type { BotInstruction } from '../domain/BotVersion.js';
import type { OperationId } from '../types/bot-commands.js';
import type { AtLeastOne } from './UpdateBotMetadataRequest.js';

/* ============================================================================
 * 🧩 UPDATE BOT CONFIG REQUEST TYPES
 * ========================================================================== */

/**
 * Patch для конфигурации бота (instruction, settings и будущие поля).
 * Масштабируется при добавлении новых полей через AtLeastOne utility.
 */
export type BotConfigurationPatch = Readonly<{
  /** Инструкция бота (опционально, branded BotInstruction для type-safety). */
  readonly instruction?: BotInstruction;
  /** Настройки бота (опционально). */
  readonly settings?: BotSettings;
}>;

/**
 * DTO запроса обновления конфигурации бота.
 *
 * Инварианты:
 * - Хотя бы одно поле конфигурации должно быть задано (гарантируется типом AtLeastOne<BotConfigurationPatch>).
 * - operationId: уникальный идентификатор операции для идемпотентности (UUID формат, scoped by botId).
 *
 * @remarks
 * Runtime validation выполняется в lib/bot-request-validator.ts.
 *
 * Idempotency semantics:
 * - Если operationId уже использовался для этого бота с тем же payload hash, возвращается существующая версия без создания новой.
 * - ВАЖНО: Backend должен хранить operationId + botId → payload hash + result version для защиты от replay attacks.
 * - Validator должен проверять: UUID формат, length limits, rate limits, botId scoping.
 * - При несоответствии payload hash операция отклоняется (400 Bad Request или 409 Conflict).
 *
 * Extensibility:
 * - Patch pattern позволяет добавлять новые поля конфигурации без изменения структуры DTO.
 * - Новые поля автоматически поддерживаются через AtLeastOne utility type.
 */
export type UpdateBotConfigRequest = Readonly<
  AtLeastOne<BotConfigurationPatch> & {
    /**
     * Идентификатор операции для идемпотентности (обязательно).
     * Используется для безопасных ретраев: если operationId уже использовался для этого бота с тем же payload hash,
     * возвращается существующая версия без создания дубликата.
     *
     * @remarks
     * Backend должен хранить mapping: operationId + botId → payload hash + result version.
     * При несоответствии payload hash операция отклоняется (replay attack protection).
     */
    readonly operationId: OperationId;
  }
>;
