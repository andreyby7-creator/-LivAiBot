/**
 * @file packages/feature-auth/src/lib — Library Utilities
 *
 * Публичный API пакета lib.
 * Экспортирует все публичные утилиты для feature-auth.
 */

/* ============================================================================
 * 🔒 SECURITY PIPELINE — ПАЙПЛАЙН БЕЗОПАСНОСТИ
 * ========================================================================== */

/**
 * Security Pipeline: пайплайн безопасности для операций аутентификации.
 * Включает fingerprint, risk assessment и все связанные типы.
 *
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
