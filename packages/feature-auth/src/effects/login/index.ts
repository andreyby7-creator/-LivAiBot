/**
 * @file packages/feature-auth/src/effects/login — Login Effects
 *
 * Публичный API пакета login effects.
 * Экспортирует все публичные эффекты для login-flow.
 */

/* ============================================================================
 * 🔐 LOGIN EFFECT TYPES — DI-КОНТРАКТ ДЛЯ LOGIN-EFFECT
 * ========================================================================== */

/**
 * Login Effect DI Types: публичный DI-контракт для login-effect.
 *
 * @public
 */
export type {
  AbortControllerPort,
  ApiRequestOptions,
  AuditLoggerPort,
  AuthApiClientPort,
  ClockPort,
  ErrorMapperPort,
  IdentifierHasher,
  IdentifierHasherPort,
  LoginEffectConfig,
  LoginEffectDeps,
  LoginFeatureFlags,
  LoginSecurityDecision,
  LoginSecurityResult,
  SecurityPipelinePort,
} from './login-effect.types.js';

/* ============================================================================
 * 📝 LOGIN METADATA ENRICHER — ОБОГАЩЕНИЕ МЕТАДАННЫХ
 * ========================================================================== */

/**
 * Login Metadata Enricher: обогащение метаданных для входа.
 *
 * @public
 */
export {
  buildLoginMetadata,
  createLoginMetadataEnricher,
  type IdentifierHasher as LoginMetadataIdentifierHasher,
  type LoginContext,
  type LoginMetadata,
  type MetadataBuilder,
  type MetadataConfig,
  type RiskMetadata,
} from './login-metadata.enricher.js';

/* ============================================================================
 * ✅ LOGIN VALIDATION — ВАЛИДАЦИЯ ЗАПРОСОВ
 * ========================================================================== */

/**
 * Validation: валидация запросов входа.
 *
 * @public
 */
export { isValidLoginRequest } from './validation.js';

/* ============================================================================
 * 🔄 LOGIN API MAPPER — МАППИНГ API
 * ========================================================================== */

/**
 * Login API Mapper: маппинг LoginRequest/LoginResponseDto ↔ domain типов.
 *
 * @public
 */
export { mapLoginRequestToApiPayload, mapLoginResponseToDomain } from './login-api.mapper.js';

/* ============================================================================
 * 📊 LOGIN STORE UPDATER — ОБНОВЛЕНИЕ СТОРА
 * ========================================================================== */

/**
 * Login Store Updater: единая точка обновления auth/session/security состояния после login-flow.
 *
 * @public
 */
export { applyBlockedState, updateLoginState } from './login-store-updater.js';

/* ============================================================================
 * 📋 LOGIN AUDIT MAPPER — МАППИНГ АУДИТА
 * ========================================================================== */

/**
 * Login Audit Mapper: маппинг результата login-effect в audit события.
 *
 * @public
 */
export {
  type LoginAuditContext,
  type LoginResultForAudit,
  mapLoginResultToAuditEvent,
} from './login-audit.mapper.js';
