/**
 * @file packages/domains/src/classification/providers — Classification Providers
 * Публичный API пакета providers.
 * Экспортирует типы и stage factory для remote classification provider.
 */

/* ============================================================================
 * 🧩 ТИПЫ — REMOTE PROVIDER CONTRACT TYPES
 * ============================================================================
 */

/**
 * Типы контракта удаленного провайдера classification.
 * Включают policy обработки ошибок, request/response модели,
 * минимальный slot map и runtime-конфигурацию stage.
 * @public
 */
export type {
  AsnMergeStrategy,
  AsyncExecutionPolicy,
  MergeStrategy,
  RemoteClassificationProvider,
  RemoteFailurePolicy,
  RemoteProviderRequest,
  RemoteProviderResponse,
  RemoteProviderSlotMap,
  RemoteProviderStageConfig,
} from './remote.provider.js';

/* ============================================================================
 * 🔧 ФУНКЦИИ — STAGE FACTORY
 * ============================================================================
 */

/**
 * Фабрика pipeline-stage для remote classification provider.
 * Возвращает `StagePlugin<TSlotMap>` с deterministic merge/failure behavior.
 * @public
 */
export { createRemoteProviderStage } from './remote.provider.js';
