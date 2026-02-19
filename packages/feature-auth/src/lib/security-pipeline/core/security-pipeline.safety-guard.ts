/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.safety-guard.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Safety Guard / Auto-Rollback)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Автоматический откат v2 при превышении порога "v2 weaker than v1"
 * - Safety guard для защиты от деградации безопасности
 * - Причина изменения: rollout safety / security policy changes
 *
 * Принципы:
 * - ✅ Fail-safe — автоматический откат при проблемах
 * - ✅ Threshold-based — настраиваемый порог для отката
 * - ✅ Time-window — оценка за временное окно
 * - ✅ Immediate action — мгновенный откат при критических проблемах
 */

import type { DisagreementDashboardMetrics } from './security-pipeline.metrics.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Конфигурация safety guard
 */
// eslint-disable-next-line functional/no-mixed-types -- Configuration object with mixed properties and functions
export type SafetyGuardConfig = {
  /** Порог для автоматического отката (процент случаев v2 weaker than v1) */
  readonly v2WeakerThreshold: number; // 0-100
  /** Временное окно для оценки метрик (в миллисекундах) */
  readonly evaluationWindowMs: number;
  /** Минимальное количество сравнений для принятия решения */
  readonly minComparisons: number;
  /** Включить автоматический откат */
  readonly enableAutoRollback: boolean;
  /** Callback для уведомления об откате */
  readonly onRollback?: (reason: string, metrics: DisagreementDashboardMetrics) => void;
};

/**
 * Результат проверки safety guard
 */
export type SafetyGuardResult = {
  /** Нужен ли откат */
  readonly shouldRollback: boolean;
  /** Причина отката (если нужен) */
  readonly rollbackReason?: string;
  /** Текущие метрики */
  readonly metrics: DisagreementDashboardMetrics;
};

/**
 * Конфигурация rollout (для safety guard)
 */
export type RolloutConfigForSafetyGuard = {
  readonly shadowV2TrafficPercentage?: number;
  readonly activeV2TrafficPercentage?: number;
  readonly v2EnabledTenants?: readonly string[];
  readonly v2EnabledBuckets?: readonly string[];
};

/**
 * Состояние safety guard
 */
export type SafetyGuardState = {
  /** Текущая конфигурация rollout */
  readonly rolloutConfig: RolloutConfigForSafetyGuard;
  /** Метрики за текущее окно */
  readonly metrics: DisagreementDashboardMetrics;
  /** Timestamp последнего обновления */
  readonly lastUpdated: number;
  /** Флаг отката (если был выполнен откат) */
  readonly isRolledBack: boolean;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтная конфигурация safety guard */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Constant for default safety guard config
export const DEFAULT_SAFETY_GUARD_CONFIG: SafetyGuardConfig = {
  v2WeakerThreshold: 5.0, // 5% случаев v2 weaker → откат
  evaluationWindowMs: 60_000, // 1 минута
  minComparisons: 100, // Минимум 100 сравнений для решения
  enableAutoRollback: true,
};

/* ============================================================================
 * 🎯 SAFETY GUARD FUNCTIONS
 * ============================================================================
 */

/**
 * Проверяет, нужен ли откат на основе метрик
 */
export function evaluateSafetyGuard(
  metrics: DisagreementDashboardMetrics,
  config: SafetyGuardConfig,
): SafetyGuardResult {
  // Если auto-rollback отключен, не выполняем откат
  if (!config.enableAutoRollback) {
    return {
      shouldRollback: false,
      metrics,
    };
  }

  // Если недостаточно данных для принятия решения
  if (metrics.totalComparisons < config.minComparisons) {
    return {
      shouldRollback: false,
      metrics,
    };
  }

  // Проверяем порог v2 weaker than v1
  const v2WeakerPercentage = metrics.v2WeakerPercentage;
  if (v2WeakerPercentage > config.v2WeakerThreshold) {
    return {
      shouldRollback: true,
      rollbackReason: `v2 weaker than v1: ${
        v2WeakerPercentage.toFixed(2)
      }% > ${config.v2WeakerThreshold}% threshold`,
      metrics,
    };
  }

  return {
    shouldRollback: false,
    metrics,
  };
}

/**
 * Создает обновленную конфигурацию rollout с откатом на v1
 */
export function createRollbackConfig(
  currentConfig: RolloutConfigForSafetyGuard,
): RolloutConfigForSafetyGuard {
  // Откатываемся на forced_v1: устанавливаем все проценты в 0
  return {
    ...currentConfig,
    shadowV2TrafficPercentage: 0,
    activeV2TrafficPercentage: 0,
    // Очищаем списки включенных tenants/buckets для безопасности
    v2EnabledTenants: [],
    v2EnabledBuckets: [],
  };
}

/**
 * Обновляет состояние safety guard с новыми метриками
 * @note Эта функция должна вызываться периодически (например, каждую минуту)
 * для оценки метрик и принятия решения об откате
 */
export function updateSafetyGuardState(
  currentState: SafetyGuardState | null,
  newMetrics: DisagreementDashboardMetrics,
  config: SafetyGuardConfig,
  currentRolloutConfig?: RolloutConfigForSafetyGuard,
): SafetyGuardState {
  // Если состояние не существует, создаем новое
  const initialRolloutConfig: RolloutConfigForSafetyGuard = currentRolloutConfig ?? {
    shadowV2TrafficPercentage: 0,
    activeV2TrafficPercentage: 0,
  };

  if (!currentState) {
    return {
      rolloutConfig: initialRolloutConfig,
      metrics: newMetrics,
      lastUpdated: Date.now(),
      isRolledBack: false,
    };
  }

  // Проверяем, нужно ли обновить метрики (в пределах временного окна)
  const now = Date.now();
  const timeSinceLastUpdate = now - currentState.lastUpdated;

  // Если прошло больше времени, чем evaluation window, сбрасываем метрики
  let metrics = newMetrics;
  if (timeSinceLastUpdate > config.evaluationWindowMs) {
    // Начинаем новое окно оценки
    metrics = newMetrics;
  } else {
    // Агрегируем метрики (упрощенная версия - в реальности нужна более сложная агрегация)
    metrics = {
      ...newMetrics,
      // Используем новые метрики как основу (в production нужна правильная агрегация)
    };
  }

  // Проверяем safety guard
  const safetyResult = evaluateSafetyGuard(metrics, config);

  // Если нужен откат и еще не был выполнен
  if (safetyResult.shouldRollback && !currentState.isRolledBack) {
    // Уведомляем об откате
    if (
      config.onRollback
      && safetyResult.rollbackReason !== undefined
      && safetyResult.rollbackReason !== ''
    ) {
      config.onRollback(safetyResult.rollbackReason, metrics);
    }

    // Создаем конфигурацию с откатом
    const rollbackConfig = createRollbackConfig(currentState.rolloutConfig);

    return {
      rolloutConfig: rollbackConfig,
      metrics,
      lastUpdated: now,
      isRolledBack: true,
    };
  }

  // Обновляем состояние без отката
  // Используем текущую конфигурацию rollout (если передана) или сохраняем существующую
  const updatedRolloutConfig = currentRolloutConfig ?? currentState.rolloutConfig;

  return {
    rolloutConfig: updatedRolloutConfig,
    metrics,
    lastUpdated: now,
    // Сохраняем флаг отката (если был откат, он остается)
    isRolledBack: currentState.isRolledBack,
  };
}
