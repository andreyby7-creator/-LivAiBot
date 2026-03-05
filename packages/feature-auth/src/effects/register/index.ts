/**
 * @file packages/feature-auth/src/effects/register — Register Effects
 * Публичный API пакета register effects.
 * Экспортирует все публичные эффекты для register-flow.
 */

/* ============================================================================
 * 🔐 REGISTER EFFECT TYPES — DI-КОНТРАКТ ДЛЯ REGISTER-EFFECT
 * ========================================================================== */

/**
 * Register Effect DI Types: публичный DI-контракт для register-effect.
 * @note Общие типы (`AbortControllerPort`, `ClockPort`, `ErrorMapperPort`, `ApiRequestOptions`, `AuthApiClientPort`, `EventIdGeneratorPort`)
 *       доступны через `./login/index.js`, `./logout/index.js` или `./shared/index.js` и не дублируются здесь.
 * @public
 */
export type {
  ConcurrencyStrategy,
  RegisterAuditLoggerPort,
  RegisterEffectConfig,
  RegisterEffectDeps,
  RegisterEffectResult,
  RegisterFeatureFlags,
  RegisterTelemetryPort,
  TraceIdGeneratorPort,
} from './register-effect.types.js';
export { RegisterConfigError, validateRegisterConfig } from './register-effect.types.js';

/* ============================================================================
 * 🧩 REGISTER METADATA ENRICHER — REGISTER-NATIVE METADATA
 * ========================================================================== */

export {
  buildRegisterMetadata,
  type RegisterIdentifierHasher,
  type RegisterMetadata,
  type RegisterMetadataConfig,
  type RegisterMetadataContext,
  type RegisterMetadataVersion,
} from './register-metadata.enricher.js';

/* ============================================================================
 * 🔄 REGISTER API MAPPER — МАППИНГ API
 * ========================================================================== */

/**
 * Register API Mapper: маппинг RegisterRequest/RegisterResponseDto ↔ domain типов.
 * @public
 */
export {
  mapOAuthRegisterRequestToApiPayload,
  mapRegisterRequestToApiPayload,
  mapRegisterResponseToDomain,
  type OAuthRegisterTransportInput,
} from './register-api.mapper.js';

/* ============================================================================
 * 📊 REGISTER STORE UPDATER — ОБНОВЛЕНИЕ СТОРА
 * ========================================================================== */

/**
 * Register Store Updater: единая точка обновления auth/session/security состояния после register-flow.
 * @public
 */
export {
  type RegisterMfaParams,
  type RegisterSuccessParams,
  updateRegisterState,
} from './register-store-updater.js';

/* ============================================================================
 * 📋 REGISTER AUDIT MAPPER — МАППИНГ АУДИТА
 * ========================================================================== */

/**
 * Register Audit Mapper: маппинг результата register-effect в audit события.
 * @public
 */
export {
  createRegisterAuditContext,
  mapAuditResultToPublicResult,
  mapDomainResultToAuditResult,
  mapRegisterResultToAuditEvent,
  type RegisterAuditContext,
  type RegisterResultForAudit,
} from './register-audit.mapper.js';
