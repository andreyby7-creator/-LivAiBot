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
 * 🧩 API MAPPERS — TRANSPORT DTO → FEATURE/STORE
 * ========================================================================== */

/**
 * Bots API Mappers: чистые мапперы validated transport DTO → feature-level типы для store/effects/UI.
 * Используются для консистентного преобразования ответов `bots-service` без утечки transport деталей.
 * @public
 */
export { mapBotResponseToBotInfo, mapBotsListResponseToBotInfos } from './bots-api.mappers.js';

/* ============================================================================
 * 🧱 MAPPER CONTRACTS — ОБЩИЕ КОНТРАКТЫ ДЛЯ API МАППЕРОВ
 * ========================================================================== */

/**
 * Shared mapper types: единые типы ошибок/issue для boundary мапперов.
 * @public
 */
export { mapperErrorCodeParsingJsonInvalid, type ParseIssue } from './mapper.contracts.js';

/* ============================================================================
 * 🗃️ STORE PORT — ДОСТУП К BOTS STORE ИЗ EFFECTS
 * ========================================================================== */

/**
 * Bots Store Port: контракт доступа к bots-store из эффектов без зависимости от Zustand реализации.
 * @public
 */
export type { BotsStoreBatchUpdate, BotsStorePort } from './bots-store.port.js';
export {
  createBotsStorePortAdapter,
  isBotsStoreBatchUpdateOfType,
  withStoreLock,
} from './bots-store.port.js';

/* ============================================================================
 * 🧾 AUDIT PORT — НАБЛЮДАЕМОСТЬ ДЛЯ EFFECTS
 * ========================================================================== */

/**
 * Audit Port: DI-контракт эмита audit/telemetry событий для bot-эффектов.
 * @public
 */
export type { BotAuditPort } from './audit.port.js';
export { createBotAuditPortAdapter, createNoopBotAuditPort } from './audit.port.js';

/* ============================================================================
 * 🔁 OPERATION LIFECYCLE HELPER — LOADING/RUN/SUCCESS/FAILURE
 * ========================================================================== */

/**
 * Operation Lifecycle Helper: DI-helper для композиции lifecycle шагов
 * (store transitions + error mapping + audit hooks) в orchestrator.
 * @public
 */
export type {
  OperationLifecycleHelper,
  OperationLifecycleHelperConfig,
  OperationLifecycleOperationHandler,
  RunOperationLifecycleInput,
} from './operation-lifecycle.helper.js';
export { createOperationLifecycleHelper } from './operation-lifecycle.helper.js';

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
