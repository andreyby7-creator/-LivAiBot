/**
 * @file @livai/core-contracts/domain/conversations.ts
 * ============================================================================
 * 💬 CONVERSATIONS — THREAD & MESSAGE MANAGEMENT CONTRACTS
 * ============================================================================
 *
 * Foundation-типы для управления диалогами (threads) и сообщениями.
 * Заметка по архитектуре:
 * - Thread (тред) — контейнер для последовательности сообщений.
 * - Turn (ход) — атомарная операция: сообщение пользователя + ответ ассистента.
 * - Боты опциональны: диалоги могут быть без бота (free-form conversation).
 * - Сообщения immutable после создания (для аудита и консистентности).
 */
import type { ISODateString, UUID } from './common.js';

/* ============================================================================
 * 🧵 THREAD — CONVERSATION CONTAINER
 * ========================================================================== */

/**
 * Ответ с информацией о треде диалога.
 */
export interface ThreadResponse {
  id: UUID;
  workspace_id: UUID;
  bot_id?: UUID;
  status: 'active';
  created_at: ISODateString;
}

/* ============================================================================
 * 💬 MESSAGE — MESSAGE CONTENT & METADATA
 * ========================================================================== */

/**
 * Ответ с информацией о сообщении.
 */
export interface MessageResponse {
  id: UUID;
  thread_id: UUID;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: ISODateString;
}

/* ============================================================================
 * 🎯 TURN — CONVERSATION TURN (USER MESSAGE + ASSISTANT RESPONSE)
 * ========================================================================== */

/**
 * Запрос на выполнение "хода" в диалоге (отправка сообщения пользователя).
 */
export interface TurnRequest {
  content: string;
}

/**
 * Ответ с результатом "хода" (сообщения пользователя + ответа ассистента).
 */
export interface TurnResponse {
  thread_id: UUID;
  user_message: MessageResponse;
  assistant_message: MessageResponse;
}

/* ============================================================================
 * 📦 COLLECTIONS — LIST RESPONSES
 * ========================================================================== */

/**
 * Ответ со списком тредов.
 */
export interface ThreadListResponse {
  items: ThreadResponse[];
}

/**
 * Ответ со списком сообщений треда.
 */
export interface MessageListResponse {
  items: MessageResponse[];
}

/* ============================================================================
 * 🆕 CONVERSATION — HIGH-LEVEL CONVERSATION MODEL
 * ========================================================================== */

/**
 * Запрос на создание разговора.
 */
export interface CreateConversationRequest {
  title?: string;
  bot_id?: UUID;
  type?: string;
  initial_message?: string;
}

/**
 * Информация о разговоре.
 */
export interface Conversation {
  id: UUID;
  workspace_id: UUID;
  bot_id?: UUID;
  title?: string;
  type?: string;
  created_by: UUID;
  status: 'active' | 'archived';
  created_at: ISODateString;
  updated_at: ISODateString;
  metadata?: Record<string, unknown>;
}
