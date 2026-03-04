/**
 * @file packages/feature-auth/src/effects/refresh — Refresh Effects
 * Публичный API пакета refresh effects.
 * Экспортирует все публичные эффекты для refresh-flow.
 */

/* ============================================================================
 * 🔐 REFRESH EFFECT TYPES — DI-КОНТРАКТ ДЛЯ REFRESH-EFFECT
 * ========================================================================== */

/**
 * Refresh Effect DI Types: публичный DI-контракт для refresh-effect.
 * @note Общие типы (`AbortControllerPort`, `ClockPort`, `ErrorMapperPort`, `ApiRequestOptions`, `AuthApiClientPort`, `EventIdGeneratorPort`)
 *       доступны через `./login/index.js`, `./logout/index.js` или `./shared/index.js` и не дублируются здесь.
 *       Здесь экспортируются только refresh-специфичные типы.
 * @public
 */
export type {
  RefreshAuditLoggerPort,
  RefreshConcurrencyStrategy,
  RefreshEffectConfig,
  RefreshEffectDeps,
  RefreshInvalidationReason,
  RefreshPolicy,
  RefreshResult,
  RefreshTelemetryPort,
  SessionDecision,
  SessionManagerPort,
} from './refresh-effect.types.js';

export { RefreshConfigError, validateRefreshConfig } from './refresh-effect.types.js';

/* ============================================================================
 * 🔄 REFRESH API MAPPER — МАППИНГ API
 * ========================================================================== */

/**
 * Refresh API Mapper: маппинг SessionState/TokenPair ↔ transport payloads.
 * @public
 */
export {
  mapRefreshRequestToApiPayload,
  mapRefreshResponseToDomain,
  RefreshApiMapperError,
} from './refresh-api.mapper.js';

/* ============================================================================
 * 📊 REFRESH STORE UPDATER — ОБНОВЛЕНИЕ СТОРА
 * ========================================================================== */

/**
 * Refresh Store Updater: единая точка обновления auth/session состояния после refresh-flow.
 * @public
 */
export { applyRefreshInvalidate, updateRefreshState } from './refresh-store-updater.js';

/* ============================================================================
 * 📋 REFRESH AUDIT MAPPER — МАППИНГ АУДИТА
 * ========================================================================== */

/**
 * Refresh Audit Mapper: маппинг результата refresh-effect в audit события.
 * @public
 */
export {
  createRefreshAuditContext,
  mapRefreshResultToAuditEvent,
  type RefreshAuditContext,
} from './refresh-audit.mapper.js';
