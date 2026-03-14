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
 * - ВАЖНО: Runtime validation выполняется в lib/bot-request-validator.ts.
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
 * Используется для создания нового бота с нуля или из шаблона.
 *
 * Инварианты:
 * - name: непустая строка (после trim, проверяется в validator).
 * - instruction: непустая строка (после trim, проверяется в validator).
 * - settings: валидные настройки бота (проверяется в validator через assertBotSettingsInvariant).
 * - templateId: опциональный идентификатор шаблона (если задан, используется для from-template создания).
 *
 * @remarks
 * Runtime validation (проверка name/instruction на пустоту, валидация settings,
 * проверка существования templateId) выполняется в lib/bot-request-validator.ts, не в dto слое.
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
