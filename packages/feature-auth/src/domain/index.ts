/**
 * @file packages/feature-auth/src/domain — Domain Types
 * Публичный API пакета domain.
 * Экспортирует все публичные доменные типы для feature-auth.
 */

/* ============================================================================
 * 🔐 AUTH DOMAIN — ДОМЕННЫЕ ТИПЫ АУТЕНТИФИКАЦИИ
 * ========================================================================== */

/**
 * Device Info: информация об устройстве.
 * @public
 */
export { type DeviceInfo, type DeviceType } from './DeviceInfo.js';

/* ============================================================================
 * 🔒 MFA — МНОГОФАКТОРНАЯ АУТЕНТИФИКАЦИЯ
 * ========================================================================== */

/**
 * MFA Info: информация о многофакторной аутентификации.
 * @public
 */
export { type MfaInfo, type MfaType } from './MfaInfo.js';

/**
 * Client Context: информация о клиентском окружении.
 * @public
 */
export {
  type ClientContext,
  type ClientContextSafe,
  type ClientContextV1,
  createEmptyClientContext,
  getAppVersion,
  getDeviceId,
  getGeo,
  getIp,
  getLocale,
  getSessionId,
  getTimezone,
  getUserAgent,
  sanitizeClientContext,
} from './ClientContext.js';

/* ============================================================================
 * 🔍 RISK ASSESSMENT — ОЦЕНКА РИСКОВ
 * ========================================================================== */

/**
 * Login Risk Assessment: оценка рисков при входе.
 * @public
 */
export {
  createEmptyLoginRiskResult,
  createLoginRiskEvaluation,
  createLoginRiskResult,
  createRiskModelVersion,
  createRiskScore,
  deriveLoginDecision,
  type DeviceRiskInfo,
  DomainValidationError,
  emptyReasons,
  type GeoInfo,
  type LoginDecision,
  type LoginRiskContext,
  type LoginRiskEvaluation,
  type LoginRiskResult,
  type RiskModelVersion,
  type RiskReason,
  RiskReasonCode,
  RiskReasonType,
  type RiskScore,
} from './LoginRiskAssessment.js';

/* ============================================================================
 * 📋 AUDIT & ERRORS — АУДИТ И ОШИБКИ
 * ========================================================================== */

/**
 * Auth Audit Event: событие аудита аутентификации.
 * @public
 */
export {
  type AuditGeoInfo,
  type AuthAuditEvent,
  type AuthAuditEventType,
} from './AuthAuditEvent.js';

/**
 * Auth/OAuth Retry Policy: централизованные retry-политики для auth-ошибок.
 * @public
 */
export {
  type AuthRetryKey,
  AuthRetryPolicy,
  getAuthRetryable,
  getOAuthRetryable,
  mergeAuthRetryPolicies,
  mergeOAuthRetryPolicies,
  type OAuthRetryKey,
  OAuthRetryPolicy,
} from './AuthRetry.js';

/* ============================================================================
 * 🔐 SESSION POLICY — ПОЛИТИКА СЕССИЙ
 * ========================================================================== */

/**
 * Session Policy: политика управления сессиями.
 * @public
 */
export { type GeoPolicy, type IpPolicy, type SessionPolicy } from './SessionPolicy.js';
