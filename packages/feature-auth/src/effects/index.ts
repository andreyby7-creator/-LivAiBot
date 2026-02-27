/**
 * @file packages/feature-auth/src/effects — Effects
 *
 * Публичный API пакета effects.
 * Экспортирует все публичные эффекты для feature-auth.
 */

/* ============================================================================
 * 🔐 LOGIN EFFECTS — ЭФФЕКТЫ ДЛЯ ВХОДА
 * ========================================================================== */

/**
 * Login Metadata Enricher: обогащение метаданных для входа.
 *
 * @public
 */
export {
  buildLoginMetadata,
  createLoginMetadataEnricher,
  type IdentifierHasher,
  type LoginContext,
  type LoginMetadata,
  type MetadataBuilder,
  type MetadataConfig,
  type RiskMetadata,
} from './login/login-metadata.enricher.js';

/**
 * Login Risk Assessment Adapter: адаптер для оценки рисков входа.
 *
 * @public
 */
export {
  buildAssessment,
  type BuildAssessmentParams,
  defaultModelVersion,
} from './login/login-risk-assessment.adapter.js';

/**
 * Публичный алиас для RiskSignals adapter-уровня.
 * Использует единый источник истины из types/auth-risk.ts (ClassificationSignals).
 *
 * @public
 */
export type { RiskSignals as AdapterRiskSignals } from '../types/auth-risk.js';

/**
 * Risk Assessment: оценка рисков.
 *
 * @public
 */
export {
  assessLoginRisk,
  type AuditHook,
  type ContextBuilderPlugin,
  type ExternalRiskSignals,
  type InternalRiskSignals,
  type RiskAssessmentResult,
  type RiskContext,
  type RiskPolicy,
  type RiskSignals,
} from './login/risk-assessment.js';

/**
 * Classification Mapper: маппинг классификации.
 *
 * @public
 */
export { type DecisionResult, mapLabelToDecisionHint } from './login/classification-mapper.js';

/**
 * Error Mapper: маппинг ошибок аутентификации.
 *
 * @public
 */
export {
  type AuthErrorInput,
  mapAuthError,
  type MapAuthErrorConfig,
  type MapAuthErrorResult,
  mapAuthErrorToUI,
} from './login/error-mapper.js';

/**
 * Validation: валидация запросов входа.
 *
 * @public
 */
export { isValidLoginRequest } from './login/validation.js';

/**
 * Device Fingerprint: получение отпечатка устройства.
 *
 * @public
 */
export { DeviceFingerprint } from './login/device-fingerprint.js';

/**
 * Login API Mapper: маппинг LoginRequest/LoginResponseDto ↔ domain типов.
 *
 * @public
 */
export { mapLoginRequestToApiPayload, mapLoginResponseToDomain } from './login/login-api.mapper.js';

/**
 * Login Effect DI Types: публичный DI-контракт для login-effect.
 *
 * @public
 */
export type {
  ApiClient as LoginApiClient,
  IdentifierHasher as LoginIdentifierHasher,
  LoginEffectConfig,
  LoginEffectDeps,
  LoginStorePort,
} from './login/login-effect.types.js';

/**
 * Login Store Updater: единая точка обновления auth/session/security состояния после login-flow.
 *
 * @public
 */
export { applyBlockedState, updateLoginState } from './login/login-store-updater.js';

/* ============================================================================
 * 🎯 LOGIN EFFECT ORCHESTRATOR — ОСНОВНОЙ ORCHESTRATOR LOGIN-FLOW
 * ========================================================================== */

/**
 * Login Effect: тонкий orchestrator для login-flow.
 *
 * Реализует полную последовательность шагов:
 * - validate-input (strict Zod validation)
 * - security-pipeline (через SecurityPipelinePort)
 * - enrich-metadata
 * - двухфазный API-call (/v1/auth/login + /v1/auth/me)
 * - domain mapping
 * - update-store (через login-store-updater)
 * - audit logging
 *
 * Инварианты:
 * - Нет бизнес-логики внутри orchestrator
 * - Все side-effects через DI-порты
 * - Все ошибки через injected errorMapper.map
 * - Fail-closed: без успешного /me → login не считается успешным
 *
 * @public
 */
export { createLoginEffect, type LoginResult } from './login.js';
