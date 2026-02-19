/**
 * @file packages/feature-auth/src/lib/security-pipeline/security-pipeline.facade.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Public API Facade)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Public API facade для security pipeline
 * - Только реэкспорты и публичный контракт
 * - Причина изменения: внешний контракт
 *
 * Принципы:
 * - ✅ Facade pattern — единая точка входа
 * - ✅ No logic — только реэкспорты
 * - ✅ Stable contract — изменения только при изменении внешнего API
 */

// Реэкспорт всех публичных типов
export type {
  DeterministicFingerprintMode,
  MandatoryAuditLogger,
  PipelineEnvironment,
  PipelineLogger,
  PluginFailureMode,
  PluginIsolationConfig,
  PrioritizedPlugin,
  SecurityOperation,
  SecurityPipelineConfig,
  SecurityPipelineConfigFunctions,
  SecurityPipelineConfigProperties,
  SecurityPipelineContext,
  SecurityPipelineError,
  SecurityPipelineResult,
  SecurityPipelineStep,
} from './security-pipeline.js';

// Реэкспорт константы версии
export { SecurityPipelineVersion } from './security-pipeline.js';

// Реэкспорт главной функции
export { executeSecurityPipeline } from './security-pipeline.js';

// Реэкспорт helper функций
export {
  getRiskLevel,
  getRiskScore,
  isCriticalRisk,
  requiresChallenge,
  shouldBlockOperation,
} from './security-pipeline.js';
