/**
 * @file packages/feature-auth/src/lib — Library Utilities
 * Публичный API пакета lib.
 * Экспортирует все публичные утилиты для feature-auth.
 */

/* ============================================================================
 * 🔒 SECURITY PIPELINE — ПАЙПЛАЙН БЕЗОПАСНОСТИ
 * ========================================================================== */

/**
 * Security Pipeline: пайплайн безопасности для операций аутентификации.
 * Включает fingerprint, risk assessment и все связанные типы.
 * @public
 */
export {
  type DeterministicFingerprintMode,
  executeSecurityPipeline,
  getRiskLevel,
  getRiskScore,
  isCriticalRisk,
  type MandatoryAuditLogger,
  type PipelineEnvironment,
  type PipelineLogger,
  type PipelineStep,
  type PluginFailureMode,
  type PluginIsolationConfig,
  type PrioritizedPlugin,
  requiresChallenge,
  type SecurityOperation as SecurityPipelineOperation,
  type SecurityPipelineAuditHook,
  type SecurityPipelineConfig,
  type SecurityPipelineConfigFunctions,
  type SecurityPipelineConfigProperties,
  type SecurityPipelineContext,
  type SecurityPipelineError,
  type SecurityPipelineResult,
  type SecurityPipelineStep,
  SecurityPipelineVersion,
  shouldBlockOperation,
} from './security-pipeline.js';

/* ============================================================================
 * 🔐 ERROR MAPPER — МАППИНГ ОШИБОК АУТЕНТИФИКАЦИИ
 * ========================================================================== */

/**
 * Error Mapper: трансформация API ошибок в UI-friendly `AuthError`.
 * @public
 */
export {
  type AuthErrorInput,
  mapAuthError,
  type MapAuthErrorConfig,
  type MapAuthErrorResult,
  mapAuthErrorToUI,
} from './error-mapper.js';

/* ============================================================================
 * 🧠 CLASSIFICATION MAPPER — МАППИНГ КЛАССИФИКАЦИИ В AUTH-РЕШЕНИЯ
 * ========================================================================== */

/**
 * Classification Mapper: адаптация classification labels из domains
 * в auth-специфичные решения (login / mfa / block).
 * @public
 */
export { type DecisionResult, mapLabelToDecisionHint } from './classification-mapper.js';

/* ============================================================================
 * 📱 DEVICE FINGERPRINT — СБОР ДАННЫХ ОБ УСТРОЙСТВЕ
 * ========================================================================== */

/**
 * Device Fingerprint: pure effect для сбора device info.
 * @public
 */
export { DeviceFingerprint } from './device-fingerprint.js';

/* ============================================================================
 * ⚠️ RISK ASSESSMENT — ОЦЕНКА РИСКОВ ВХОДА
 * ========================================================================== */

/**
 * Risk Assessment: оценка рисков для login-flow.
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
} from './risk-assessment.js';

/**
 * Risk Assessment Adapter: адаптер между classification layer и domain layer.
 * @public
 */
export {
  buildAssessment,
  type BuildAssessmentParams,
  defaultModelVersion,
} from './risk-assessment.adapter.js';

/* ============================================================================
 * 🔐 SESSION MANAGER — УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ СЕССИЙ
 * ========================================================================== */

/**
 * Session Manager: domain-pure сервис для управления жизненным циклом сессий.
 * Изолирует бизнес-логику от orchestration-слоя (effects).
 * Вычисляет deadlines, принимает решения о expire/invalidate/refresh.
 * @public
 */
export {
  type InvalidationReason,
  type NewSessionDenialReason,
  SessionManager,
  type SessionManagerConfig,
} from './session-manager.js';
