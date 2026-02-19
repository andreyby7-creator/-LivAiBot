/**
 * @file packages/feature-auth/src/lib/security-pipeline/risk-sources/local-rules.source.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Sources (Local Rules)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Thin wrapper для local rules engine
 * - Runtime validation и audit hook integration
 * - Используется в v1 и v2 pipeline
 *
 * Принципы:
 * - ✅ Thin wrapper — минимальная логика, основная работа в domain engine
 * - ✅ Runtime validation — валидация входных данных перед вызовом engine
 * - ✅ Side-effects isolation — audit hook вызывается только здесь, не в engine
 * - ✅ Performance limits — проверка лимитов производительности
 *
 * @note Domain purity: core logic находится в /src/domain/localRulesEngine.ts
 *       Этот файл содержит только wrapper логику (валидация, audit hook).
 */

import { getPerformanceLimits, validatePerformanceLimits } from './performance-limits.js';
import type { DeviceInfo } from '../../../domain/DeviceInfo.js';
import { evaluateLocalRules } from '../../../domain/LocalRulesEngine.js';
import type {
  ContextBuilderPlugin,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from '../../../types/risk.js';
import { sanitizeExternalSignals } from '../../sanitizer.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Пустой массив плагинов для локальной оценки (без расширений контекста) */
const NO_PLUGINS: readonly ContextBuilderPlugin[] = [];

/**
 * Лимиты производительности для локальной оценки риска
 * @deprecated Используйте getPerformanceLimits() для получения конфигурируемых лимитов
 * @see performance-limits.ts для runtime-конфигурации
 */
export const PerformanceLimits = getPerformanceLimits();

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Результат оценки риска из локального источника
 */
export type LocalRiskResult = RiskAssessmentResult;

/**
 * Hook для audit/logging критических решений
 * Вызывается при блокировке или challenge для отслеживания security events
 */
export type AuditHook = (
  result: RiskAssessmentResult,
  context: RiskContext,
) => void;

/**
 * Конфигурация локального источника риска
 */
export type LocalRulesSourceConfig = {
  /** Контекст для оценки риска */
  readonly context: RiskContext;
  /**
   * Политика принятия решений (опционально)
   * @note Если policy не указана, используются дефолтные значения из defaultDecisionPolicy
   *       и defaultRiskWeights из risk-decision.ts и risk-scoring.ts соответственно.
   */
  readonly policy?: RiskPolicy | undefined;
  /** Device info для оценки (должен быть валидным, не undefined/empty) */
  readonly deviceInfo: DeviceInfo;
  /**
   * Плагины для расширения контекста оценки (опционально)
   * @note Позволяет добавлять кастомные сигналы без изменения core logic.
   *       Плагины применяются детерминированно: одинаковый вход → одинаковый выход.
   * @default NO_PLUGINS (пустой массив)
   */
  readonly plugins?: readonly ContextBuilderPlugin[] | undefined;
  /**
   * Hook для audit/logging критических решений (опционально)
   * @note Вызывается только при блокировке или challenge для отслеживания security events.
   *       Не влияет на детерминированность результата оценки.
   * @default undefined (не используется)
   */
  readonly auditHook?: AuditHook | undefined;
};

/* ============================================================================
 * 🔍 VALIDATION
 * ============================================================================
 */

/**
 * Валидирует deviceInfo для runtime safety
 * @throws {Error} Если deviceInfo невалиден (пустой deviceId)
 */
function validateDeviceInfo(deviceInfo: DeviceInfo): void {
  // TypeScript гарантирует, что deviceInfo не undefined (тип DeviceInfo, не DeviceInfo | undefined)
  // Проверяем только валидность обязательных полей
  if (!deviceInfo.deviceId || deviceInfo.deviceId.trim() === '') {
    throw new Error('DeviceInfo.deviceId is required and cannot be empty');
  }
}

/**
 * Валидирует лимиты производительности
 * @param plugins - Плагины для проверки
 * @throws {Error} Если количество плагинов превышает лимит
 */
function validatePerformanceLimitsForPlugins(
  plugins: readonly ContextBuilderPlugin[],
): void {
  const limits = getPerformanceLimits();
  validatePerformanceLimits(limits);

  if (plugins.length > limits.maxPlugins) {
    throw new Error(
      `Too many plugins: ${plugins.length} exceeds limit of ${limits.maxPlugins}`,
    );
  }
}

/**
 * Вызывает audit hook для критических решений
 * @param result - Результат оценки риска
 * @param context - Контекст для оценки
 * @param auditHook - Hook для audit/logging (опционально)
 */
function callAuditHookIfNeeded(
  result: RiskAssessmentResult,
  context: RiskContext,
  auditHook?: AuditHook,
): void {
  if (
    auditHook
    && (result.decisionHint.action === 'block' || result.decisionHint.action === 'challenge')
  ) {
    auditHook(result, context);
  }
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Оценивает риск через локальные правила
 *
 * Thin wrapper для pure domain engine (evaluateLocalRules).
 * Выполняет runtime validation и вызывает audit hook при необходимости.
 *
 * Детерминированная функция: одинаковый вход → одинаковый выход.
 * Side-effects изолированы в auditHook (опционален), вызывается только здесь.
 *
 * @param config - Конфигурация локального источника риска
 * @returns Результат оценки риска с score, level, rules и decision hint
 *
 * @throws {Error} Если deviceInfo невалиден (undefined, пустой deviceId)
 * @throws {Error} Если количество плагинов превышает лимит
 *
 * @note Deterministic: одинаковый deviceInfo + context + policy → одинаковый результат
 * @note Fast: локальная оценка без внешних зависимостей
 * @note Extensibility: поддержка плагинов через ContextBuilderPlugin для кастомных сигналов
 * @note Security: deviceInfo не должен содержать PII в логах или при serializing
 * @note Performance: лимиты настраиваются через getPerformanceLimits() (runtime config)
 * @note Domain purity: core logic в /src/domain/localRulesEngine.ts (pure, testable)
 *
 * @example
 * ```typescript
 * const result = assessLocalRisk({
 *   deviceInfo: { deviceId: 'device-123', deviceType: 'desktop' },
 *   context: { ip: '1.2.3.4', timestamp: '2024-01-15T10:30:00.000Z' },
 *   policy: { decision: { thresholds: { low: 30, medium: 60 } } },
 *   plugins: [customPlugin], // опционально
 *   auditHook: (result) => logSecurityEvent(result), // опционально
 * });
 * ```
 */
export function assessLocalRisk(
  config: LocalRulesSourceConfig,
): LocalRiskResult {
  const { context, policy, deviceInfo, plugins = NO_PLUGINS, auditHook } = config;

  // Runtime validation: валидация deviceInfo для безопасности
  validateDeviceInfo(deviceInfo);

  // Runtime validation: проверка лимитов производительности
  validatePerformanceLimitsForPlugins(plugins);

  // Security sanitization: очистка externalSignals от опасных структур (security boundary)
  // Должно быть выполнено ДО попадания в domain layer
  const sanitizedContext: RiskContext = context.signals?.externalSignals !== undefined
    ? {
      ...context,
      signals: {
        ...context.signals,
        externalSignals: sanitizeExternalSignals(context.signals.externalSignals),
      } as RiskSignals,
    }
    : context;

  // Вызов pure domain engine (без side-effects)
  // evaluateLocalRules - детерминированная функция, возвращает RiskAssessmentResult
  // Не содержит side-effects: все side-effects изолированы в auditHook (вызывается ниже)
  const riskAssessment = evaluateLocalRules(
    deviceInfo,
    sanitizedContext,
    policy,
    plugins, // Плагины для расширения контекста (опционально)
  );

  // Side-effects: вызов audit hook для критических решений (block/challenge)
  // Изолирован здесь, не в domain engine для соблюдения domain purity
  callAuditHookIfNeeded(riskAssessment, context, auditHook);

  return riskAssessment;
}
