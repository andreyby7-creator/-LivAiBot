/**
 * @file Типы и DTO для управления диалогами и сообщениями
 */
import type { Timestamp, UUID } from './common.js';

/**
 * Ответ с информацией о треде диалога.
 */
export type ThreadResponse = {
  id: UUID;
  workspace_id: UUID;
  bot_id?: UUID;
  status: 'active';
  created_at: Timestamp;
};

/**
 * Ответ с информацией о сообщении.
 */
export type MessageResponse = {
  id: UUID;
  thread_id: UUID;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: Timestamp;
};

/**
 * Запрос на выполнение "хода" в диалоге (отправка сообщения пользователя).
 */
export type TurnRequest = {
  content: string;
};

/**
 * Ответ с результатом "хода" (сообщения пользователя + ответа ассистента).
 */
export type TurnResponse = {
  thread_id: UUID;
  user_message: MessageResponse;
  assistant_message: MessageResponse;
};

/**
 * Ответ со списком тредов.
 */
export type ThreadListResponse = {
  items: ThreadResponse[];
};

/**
 * Ответ со списком сообщений треда.
 */
export type MessageListResponse = {
  items: MessageResponse[];
};

/**
 * Запрос на создание разговора.
 */
export type CreateConversationRequest = {
  title?: string;
  bot_id?: UUID;
  type?: string;
  initial_message?: string;
};

/**
 * Информация о разговоре.
 */
export type Conversation = {
  id: UUID;
  workspace_id: UUID;
  bot_id?: UUID;
  title?: string;
  type?: string;
  created_by: UUID;
  status: 'active' | 'archived';
  created_at: Timestamp;
  updated_at: Timestamp;
  metadata?: Record<string, unknown>;
};
