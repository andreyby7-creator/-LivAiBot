/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.runtime-overrides.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Runtime Overrides / On-Call Safety Switches)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Runtime overrides для экстренного управления pipeline
 * - On-call safety switches для быстрого реагирования на инциденты
 * - Причина изменения: operational readiness / incident response
 *
 * Принципы:
 * - ✅ Environment-based — управление через переменные окружения
 * - ✅ Fail-safe — безопасные значения по умолчанию
 * - ✅ Immediate effect — мгновенное применение без перезапуска кода
 * - ✅ Audit trail — логирование всех изменений
 */

import type { DeviceInfo } from '../../../domain/DeviceInfo.js';
import type { RiskAssessmentResult } from '../../../types/risk.js';
import type { SecurityPipelineContext } from '../security-pipeline.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Runtime overrides для security pipeline
 */
export type RuntimeOverrides = {
  /** Принудительно использовать v1 для всех запросов */
  readonly forceRiskV1: boolean;
  /** Отключить remote risk provider */
  readonly disableRemoteProvider: boolean;
  /** Включить fail-open режим (только для emergency) */
  readonly failOpenMode: boolean;
};

/**
 * Результат применения overrides
 */
export type OverrideResult = {
  /** Применены ли overrides */
  readonly applied: boolean;
  /** Какие overrides применены */
  readonly activeOverrides: readonly string[];
  /** Timestamp применения */
  readonly appliedAt: number;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Имена environment variables для overrides */
const ENV_FORCE_RISK_V1 = 'FORCE_RISK_V1';
const ENV_DISABLE_REMOTE_PROVIDER = 'DISABLE_REMOTE_PROVIDER';
const ENV_FAIL_OPEN_MODE = 'FAIL_OPEN_MODE';

/* ============================================================================
 * 🎯 RUNTIME OVERRIDES FUNCTIONS
 * ============================================================================
 */

/**
 * Читает runtime overrides из environment variables
 * @note Эта функция вызывается при каждом запросе для проверки overrides
 */
export function readRuntimeOverrides(): RuntimeOverrides {
  // Читаем environment variables (только в Node.js окружении)
  if (typeof process === 'undefined' || typeof process.env === 'undefined') {
    return {
      forceRiskV1: false,
      disableRemoteProvider: false,
      failOpenMode: false,
    };
  }

  // eslint-disable-next-line security/detect-object-injection -- ENV_FORCE_RISK_V1 is a constant, safe access
  const forceRiskV1 = process.env[ENV_FORCE_RISK_V1] === '1';
  // eslint-disable-next-line security/detect-object-injection -- ENV_DISABLE_REMOTE_PROVIDER is a constant, safe access
  const disableRemoteProvider = process.env[ENV_DISABLE_REMOTE_PROVIDER] === '1';
  // eslint-disable-next-line security/detect-object-injection -- ENV_FAIL_OPEN_MODE is a constant, safe access
  const failOpenMode = process.env[ENV_FAIL_OPEN_MODE] === '1';

  return {
    forceRiskV1,
    disableRemoteProvider,
    failOpenMode,
  };
}

/**
 * Применяет runtime overrides к конфигурации pipeline
 */
export function applyRuntimeOverrides<
  T extends (
    deviceInfo: DeviceInfo,
    context: SecurityPipelineContext,
  ) => Promise<RiskAssessmentResult>,
>(
  config: {
    readonly version?: number | undefined;
    readonly shadowMode?: boolean | undefined;
    readonly remoteRiskProvider?: T | undefined;
    readonly failClosed?: boolean | undefined;
  },
  overrides: RuntimeOverrides,
): {
  readonly version: number;
  readonly shadowMode: boolean;
  readonly remoteRiskProvider: T | undefined;
  readonly failClosed: boolean;
} & OverrideResult {
  const activeOverrides: string[] = [];
  let effectiveVersion = config.version ?? 2;
  let effectiveShadowMode = config.shadowMode ?? false;
  let effectiveRemoteProvider = config.remoteRiskProvider;
  let effectiveFailClosed = config.failClosed ?? true;

  // Применяем FORCE_RISK_V1
  if (overrides.forceRiskV1) {
    effectiveVersion = 1;
    effectiveShadowMode = false;
    activeOverrides.push('FORCE_RISK_V1');
  }

  // Применяем DISABLE_REMOTE_PROVIDER
  if (overrides.disableRemoteProvider) {
    effectiveRemoteProvider = undefined;
    activeOverrides.push('DISABLE_REMOTE_PROVIDER');
  }

  // Применяем FAIL_OPEN_MODE (только для emergency)
  if (overrides.failOpenMode) {
    effectiveFailClosed = false; // fail-open вместо fail-closed
    activeOverrides.push('FAIL_OPEN_MODE');
  }

  return {
    version: effectiveVersion,
    shadowMode: effectiveShadowMode,
    remoteRiskProvider: effectiveRemoteProvider,
    failClosed: effectiveFailClosed,
    applied: activeOverrides.length > 0,
    activeOverrides,
    appliedAt: Date.now(),
  };
}

/**
 * Логирует применение overrides (для audit trail)
 */
export function logRuntimeOverrides(
  overrides: RuntimeOverrides,
  result: OverrideResult,
  logger?: (message: string, data?: unknown) => void,
): void {
  if (!result.applied || !logger) {
    return;
  }

  logger('[security-pipeline] Runtime overrides applied', {
    activeOverrides: result.activeOverrides,
    appliedAt: new Date(result.appliedAt).toISOString(),
    overrides,
  });
}

/**
 * Проверяет, активны ли какие-либо overrides
 */
export function hasActiveOverrides(overrides: RuntimeOverrides): boolean {
  return overrides.forceRiskV1 || overrides.disableRemoteProvider || overrides.failOpenMode;
}
