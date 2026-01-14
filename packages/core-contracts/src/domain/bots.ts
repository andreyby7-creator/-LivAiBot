/**
 * @file Типы и DTO для управления ботами
 */
import type { JsonObject, Timestamp, UUID } from './common.js';

/**
 * Ответ с информацией о боте.
 */
export interface BotResponse {
  id: UUID;
  workspace_id: UUID;
  name: string;
  status: 'draft' | 'active';
  created_at: Timestamp;
  current_version: number;
}

/**
 * Запрос на создание нового бота.
 */
export interface CreateBotRequest {
  name: string;
  instruction: string;
  settings?: JsonObject;
}

/**
 * Запрос на обновление инструкции бота.
 *
 * Инвариант:
 * - Каждое обновление создаёт новую версию бота.
 * - Предыдущие версии НЕ изменяются.
 */
export interface UpdateInstructionRequest {
  instruction: string;
  settings?: JsonObject;
}

/**
 * Ответ со списком ботов.
 */
export interface BotListResponse {
  items: BotResponse[];
}
