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
  SecurityPipelineVersion,
  executeSecurityPipeline,
  isCriticalRisk,
  shouldBlockOperation,
  requiresChallenge,
  getRiskLevel,
  getRiskScore,
  type SecurityOperation as SecurityPipelineOperation,
  type SecurityPipelineStep,
  type PipelineStep,
  type SecurityPipelineError,
  type SecurityPipelineContext,
  type SecurityPipelineAuditHook,
  type PrioritizedPlugin,
  type DeterministicFingerprintMode,
  type PluginFailureMode,
  type PluginIsolationConfig,
  type MandatoryAuditLogger,
  type PipelineLogger,
  type PipelineEnvironment,
  type SecurityPipelineConfigProperties,
  type SecurityPipelineConfigFunctions,
  type SecurityPipelineConfig,
  type SecurityPipelineResult,
} from './security-pipeline.js';
