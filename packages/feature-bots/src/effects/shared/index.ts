/**
 * @file packages/feature-bots/src/effects/shared — Shared Effects Utilities
 * Публичный API пакета shared effects.
 * Экспортирует общие утилиты для всех bot-эффектов.
 */

/* ============================================================================
 * 🔧 API CLIENT PORT — ЕДИНЫЙ КОНТРАКТ HTTP-КЛИЕНТА
 * ========================================================================== */

/**
 * BotApiClient Port: Effect-based DI-контракт для HTTP-клиента bots-домена.
 * Обеспечивает единую async-модель в orchestrator.
 * @public
 */
export type { ApiRequestOptions, BotApiClientPort } from './api-client.adapter.js';

/* ============================================================================
 * 🔧 API CLIENT ADAPTER — АДАПТАЦИЯ PROMISE → EFFECT
 * ========================================================================== */

/**
 * ApiClient Adapter: преобразование Promise-based HTTP-клиента в Effect-based BotApiClientPort.
 * Используется во всех bot-эффектах для единой async-модели в orchestrator.
 * @public
 */
export type {
  BotApiClientPortAdapterConfig,
  BotApiCreateBotInput,
  BotApiGetBotInput,
  BotApiListBotsInput,
  BotApiUpdateInstructionInput,
  BotErrorNormalizationRule,
  LegacyApiClient,
} from './api-client.adapter.js';
export { createBotApiClientPortAdapter } from './api-client.adapter.js';
