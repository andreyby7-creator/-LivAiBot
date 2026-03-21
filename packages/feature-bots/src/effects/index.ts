/**
 * @file packages/feature-bots/src/effects — Effects
 * Публичный API пакета effects.
 * Экспортирует все публичные эффекты для feature-bots.
 */

/* ============================================================================
 * 🤖 SHARED EFFECTS — ОБЩИЕ УТИЛИТЫ ДЛЯ ВСЕХ ЭФФЕКТОВ
 * ========================================================================== */

/**
 * Shared Effects: общие утилиты для всех bot-эффектов.
 * @public
 */
export * from './shared/index.js';

/* ============================================================================
 * ➕ CREATE EFFECTS — КОНТРАКТЫ СОЗДАНИЯ БОТА
 * ========================================================================== */

/**
 * Create Effects: DI-контракты и типы для create-bot оркестраторов.
 * @public
 */
export * from './create/index.js';

/* ============================================================================
 * ➕ ORCHESTRATORS — CREATE BOT FLOWS
 * ============================================================================
 */

/**
 * Оркестратор create-flow: создание бота из шаблона.
 * @public
 */
export type {
  ClockPort,
  CreateBotFromTemplateDeps,
  CreateBotFromTemplateRequest,
  EventIdGeneratorPort,
} from './create-bot-from-template.js';
export { createBotFromTemplateEffect } from './create-bot-from-template.js';

/**
 * Оркестратор create-flow: кастомный бот (без шаблона).
 * @public
 */
export type { CreateCustomBotDeps, CreateCustomBotRequest } from './create-custom-bot.js';
export { createCustomBotEffect } from './create-custom-bot.js';
