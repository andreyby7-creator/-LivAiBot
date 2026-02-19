/**
 * @file @livai/core/data-safety — Taint Tracking и Information Flow Control
 *
 * Публичный API пакета data-safety.
 * Экспортирует все публичные компоненты, типы и утилиты для taint tracking и IFC.
 */

/* ============================================================================
 * 🛡️ TAINT — БАЗОВЫЕ ТИПЫ И УТИЛИТЫ
 * ========================================================================== */

/**
 * Базовые типы и утилиты для taint tracking.
 * Включает источники taint, метаданные, операции добавления/удаления taint,
 * проверку trusted состояния и propagation между значениями.
 *
 * @public
 */

export {
  addTaint,
  assertTrusted as assertTrustedByLevel,
  assertTrustedSlot,
  createTaintMetadata,
  createTaintSourceRegistry,
  defaultTaintSourceRegistry,
  getTaintMetadata,
  getTaintSourceName,
  isTainted,
  isTaintSource,
  mergeTaintMetadata,
  propagateTaint,
  propagateTaintSlot,
  type Slot,
  stripTaint,
  stripTaintSlot,
  type Tainted,
  type TaintMetadata,
  type TaintSource,
  type TaintSourceRegistry,
  type TaintSourceRegistryBuilder,
  taintSources,
} from './taint.js';

/* ============================================================================
 * 🔒 TRUST LEVEL — SECURITY LATTICE
 * ========================================================================== */

/**
 * Security lattice для уровней доверия (UNTRUSTED < PARTIAL < TRUSTED).
 * Операции: meet (infimum), dominates (проверка доминирования).
 * Используется для формальной верификации trust levels в IFC.
 *
 * @public
 */

export {
  createTrustLevelRegistry,
  defaultTrustLevelRegistry,
  dominates,
  getTrustLevelName,
  isTrustLevel,
  meetTrust,
  type TrustLevel,
  type TrustLevelRegistry,
  type TrustLevelRegistryBuilder,
  trustLevels,
} from './trust-level.js';

/* ============================================================================
 * 🧹 SANITIZATION MODE — РЕЖИМЫ САНИТИЗАЦИИ
 * ========================================================================== */

/**
 * Режимы санитизации данных (NONE, BASIC, STRICT, PII_REDACTION).
 * Операции сравнения и выбора более строгого режима.
 * Используется в input boundary для валидации и очистки внешних данных.
 *
 * @public
 */

export {
  compareModes,
  createSanitizationModeRegistry,
  defaultSanitizationModeRegistry,
  getSanitizationModeName,
  isSanitizationMode,
  isStricter,
  lenientMode,
  type SanitizationMode,
  type SanitizationModeRegistry,
  type SanitizationModeRegistryBuilder,
  sanitizationModes,
  stricterMode,
} from './sanitization-mode.js';

/* ============================================================================
 * 📥 TAINT SOURCE — INPUT BOUNDARY
 * ========================================================================== */

/**
 * Input boundary: маркировка внешних данных как tainted и promotion trust levels.
 * Операции: markAsExternal, validateAndPromote, sanitizeAndPromote, validateAndSanitize.
 * Используется на границе входа данных в систему (API, файлы, пользовательский ввод).
 *
 * @public
 */

export {
  createExternalInputBoundary,
  type InputBoundary,
  markAsExternal,
  sanitizeAndPromote,
  validateAndPromote,
  validateAndSanitize,
} from './taint-source.js';

/* ============================================================================
 * 📤 TAINT SINK — OUTPUT BOUNDARY
 * ========================================================================== */

/**
 * Output boundary: проверка trusted данных перед отправкой в плагины/БД/LLM/сеть.
 * Rule-engine архитектура с invariants и policies для extensible security checks.
 * Возвращает Trusted<T> wrapper (unforgeable capability) для плагинов.
 *
 * @public
 */

export {
  assertTrusted,
  checkTrusted,
  createPluginOutputBoundary,
  createUntrustedValueError,
  defaultTrustedCheckRuleRegistry,
  executePluginWithBoundary,
  isTrusted,
  isUntrustedValueError,
  markAsPluginOutput,
  type OutputBoundary,
  type SinkType,
  type Trusted,
  TrustedBrand,
  type TrustedCheckContext,
  type TrustedCheckFailureReason,
  type TrustedCheckResult,
  type TrustedCheckRule,
  type TrustedCheckRuleRegistry,
  type TrustedCheckSnapshot,
  type UntrustedValueError,
} from './taint-sink.js';

/* ============================================================================
 * 🔄 TAINT PROPAGATION — PROPAGATION TRACKING
 * ========================================================================== */

/**
 * Propagation tracking: контроль потока taint через промежуточные операции.
 * IFC decision engine (checkPropagation) + data transformation (computeMergedTaint).
 * Effect-based API (PropagationOutcome<T>) для composability в pipelines.
 * Поддерживает policy override для downgrade trust levels.
 *
 * @public
 */
export {
  checkPropagation,
  type Clock,
  computeMergedTaint,
  createPropagationBoundary,
  createPropagationBoundary as createBoundary,
  defaultPropagationRuleRegistry,
  propagateTaintFromSource,
  propagateTaintFromSource as propagateSingleSource,
  propagateTaintFromSources,
  type PropagationBoundary,
  type PropagationContext,
  type PropagationDecision,
  type PropagationFailureReason,
  type PropagationOperation,
  type PropagationOutcome,
  type PropagationRule,
  type PropagationRuleRegistry,
  type PropagationSnapshot,
} from './taint-propagation.js';

/* ============================================================================
 * 🔧 STRUCTURAL CLONE — БЕЗОПАСНОЕ КЛОНИРОВАНИЕ
 * ========================================================================== */

/**
 * Безопасное глубокое клонирование с защитой от prototype pollution и циклических ссылок.
 * Используется для изоляции tainted данных перед обработкой.
 *
 * @public
 */

export { isCloneable, structuralClone } from './structural-clone.js';
