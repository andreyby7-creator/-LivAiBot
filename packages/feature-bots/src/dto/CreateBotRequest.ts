/**
 * @file packages/feature-bots/src/dto/CreateBotRequest.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — CreateBotRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO-агрегат CreateBotRequest: контракт запроса создания бота для API boundary.
 * - Используется всеми bot endpoints для создания нового бота.
 * - Поддерживает создание бота с нуля или из шаблона (templateId).
 * - Безопасен для API boundary (не раскрывает внутренние детали).
 *
 * Принципы:
 * - ✅ SRP: только структура запроса (без бизнес-логики и transport-деталей).
 * - ✅ Deterministic: явные поля для type-safe обработки.
 * - ✅ DTO-pure: без HTTP/DB-деталей, только типы контрактов и инварианты.
 * - ✅ Immutable: все поля readonly для integrity и type-safety.
 * - ✅ Extensible: settings позволяет эволюцию без ломки core-схемы.
 * - ✅ API-friendly: структурированный запрос, удобный для UI и SDK.
 */

import type { BotSettings } from '../domain/BotSettings.js';
import type { BotTemplateId } from '../domain/BotTemplate.js';
import type { BotInstruction } from '../domain/BotVersion.js';

/* ============================================================================
 * 🧩 CREATE BOT REQUEST TYPES
 * ========================================================================== */

/**
 * DTO запроса создания бота.
 *
 * Инварианты:
 * - name: непустая строка (после trim).
 * - instruction: непустая строка (после trim).
 * - settings: валидные настройки бота (через assertBotSettingsInvariant).
 * - templateId: опциональный идентификатор шаблона (если задан, используется для from-template создания).
 *
 * @remarks
 * Runtime validation выполняется в lib/bot-request-validator.ts.
 */
export type CreateBotRequest = Readonly<{
  /** Имя бота (обязательно). */
  readonly name: string;
  /** Инструкция бота (обязательно, branded BotInstruction для type-safety). */
  readonly instruction: BotInstruction;
  /** Настройки бота (обязательно). */
  readonly settings: BotSettings;
  /**
   * Идентификатор шаблона бота (опционально).
   * Если задан, бот создаётся на основе шаблона (from-template).
   * При использовании templateId поля name/instruction/settings могут быть переопределены или дополнены.
   */
  readonly templateId?: BotTemplateId;
}>;
