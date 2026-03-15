/**
 * @file @livai/core-contracts/domain/bots.ts
 * ============================================================================
 * 🤖 BOTS — BOT MANAGEMENT CONTRACTS
 * ============================================================================
 *
 * Foundation-типы для управления ботами и их версиями.
 * Заметка по архитектуре:
 * - Боты имеют версионность: каждое обновление инструкции создаёт новую версию.
 * - Предыдущие версии неизменяемы (immutable) для консистентности диалогов.
 * - Статус 'draft' для черновиков, 'active' для публикации.
 */
import type { ISODateString, JsonObject, UUID } from './common.js';

/* ============================================================================
 * 📋 BOT RESPONSE — BOT INFORMATION
 * ========================================================================== */

/**
 * Ответ с информацией о боте.
 */
export interface BotResponse {
  id: UUID;
  workspace_id: UUID;
  name: string;
  status: 'draft' | 'active';
  created_at: ISODateString;
  current_version: number;
}

/* ============================================================================
 * ✏️ BOT CREATION — NEW BOT SETUP
 * ========================================================================== */

/**
 * Запрос на создание нового бота.
 */
export interface CreateBotRequest {
  name: string;
  instruction: string;
  settings?: JsonObject;
}

/* ============================================================================
 * 🔄 BOT UPDATE — VERSIONED INSTRUCTION UPDATE
 * ========================================================================== */

/**
 * Запрос на обновление инструкции бота.
 * Инвариант:
 * - Каждое обновление создаёт новую версию бота.
 * - Предыдущие версии НЕ изменяются.
 */
export interface UpdateInstructionRequest {
  instruction: string;
  settings?: JsonObject;
}

/* ============================================================================
 * 📦 BOT LIST — COLLECTION RESPONSE
 * ========================================================================== */

/**
 * Ответ со списком ботов.
 */
export interface BotListResponse {
  items: BotResponse[];
}
