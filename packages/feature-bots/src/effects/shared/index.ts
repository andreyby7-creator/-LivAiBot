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
export type {
  BotApiClientPort,
  BotApiCreateBotInput,
  BotApiGetBotInput,
  BotApiListBotsInput,
  BotApiUpdateInstructionInput,
  BotCreateRequestTransport,
  BotResponseTransport,
  BotsListResponseTransport,
  RequestContext,
  UpdateInstructionRequestTransport,
} from './api-client.port.js';

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
  BotErrorNormalizationRule,
  LegacyApiClient,
} from './api-client.adapter.js';
export { createBotApiClientPortAdapter } from './api-client.adapter.js';
