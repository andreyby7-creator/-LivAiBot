/**
 * @file packages/feature-auth/src/lib/security-pipeline/policies/security-pipeline.policy.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Security Policy Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Security policy enforcement (fail-closed)
 * - Synthetic risk creation
 * - Причина изменения: security policy, но не pipeline execution
 *
 * Принципы:
 * - ✅ Policy layer — отдельная ответственность для security decisions
 * - ✅ Fail-closed — безопасное поведение по умолчанию
 * - ✅ Synthetic risk — гарантия блокировки при ошибках
 */

import type { DeviceInfo } from '../../../domain/DeviceInfo.js';
import type { DeviceRiskInfo } from '../../../domain/LoginRiskAssessment.js';
import type { RiskAssessmentResult } from '../../../types/risk.js';
import {
  determineErrorTypeFromMessage,
  isSecurityPipelineStepError,
  normalizeSecurityPipelineError,
} from '../core/security-pipeline.errors.js';
import type {
  PipelineEnvironment,
  SecurityPipelineConfig,
  SecurityPipelineResult,
  SecurityPipelineStep,
} from '../security-pipeline.js';

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтная environment конфигурация */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Constant for default environment configuration
export const DEFAULT_ENVIRONMENT: PipelineEnvironment = {
  mode: 'production',
};

/* ============================================================================
 * 🔧 DEEP FREEZE (IMMUTABILITY)
 * ============================================================================
 */

/**
 * Deep freeze для обеспечения полной immutability
 * @note Real deep immutability: обрабатывает объекты, массивы, но не замораживает
 * примитивные обертки (String, Number, Boolean) и специальные объекты (Date, RegExp, Map, Set).
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  // Обрабатываем null и undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Пропускаем примитивные типы
  if (typeof obj !== 'object') {
    return obj;
  }

  // Пропускаем специальные объекты, которые нельзя заморозить
  // Date, RegExp, Map, Set, WeakMap, WeakSet имеют внутреннее состояние
  if (
    obj instanceof Date
    || obj instanceof RegExp
    || obj instanceof Map
    || obj instanceof Set
    || obj instanceof WeakMap
    || obj instanceof WeakSet
  ) {
    return obj;
  }

  // Получаем имена всех свойств объекта (включая не-enumerable)
  const propNames = Object.getOwnPropertyNames(obj);

  // Замораживаем свойства перед замораживанием самого объекта
  for (const name of propNames) {
    // eslint-disable-next-line security/detect-object-injection -- name из Object.getOwnPropertyNames, безопасно
    const value = (obj as Record<string, unknown>)[name];
    if (value !== null && typeof value === 'object') {
      // Рекурсивно замораживаем вложенные объекты и массивы
      deepFreeze(value);
    }
  }

  // Замораживаем сам объект
  return Object.freeze(obj);
}

/**
 * Делает RiskAssessmentResult полностью immutable через deep freeze
 * @note Deep immutability: рекурсивно замораживает все вложенные объекты
 * для предотвращения мутаций на любом уровне вложенности.
 */
export function freezeRiskAssessmentResult(
  result: RiskAssessmentResult,
): RiskAssessmentResult {
  return deepFreeze(result) as RiskAssessmentResult;
}

/* ============================================================================
 * 🔧 FAIL-CLOSED POLICY
 * ============================================================================
 */

/**
 * Создает synthetic critical risk assessment для fail-closed policy
 * @note Fail-closed: возвращает критический риск вместо throw для предотвращения
 * игнорирования ошибок caller'ом. Гарантирует, что ошибка pipeline всегда блокирует операцию.
 */
export function createSyntheticCriticalRisk(
  deviceInfo: DeviceInfo | undefined,
): SecurityPipelineResult {
  // Создаем минимальный DeviceInfo если его нет
  const syntheticDeviceInfo: DeviceInfo = deviceInfo ?? {
    deviceId: 'unknown',
    deviceType: 'unknown',
  };

  // Определяем platform из deviceType для DeviceRiskInfo
  const platform: DeviceRiskInfo['platform'] = syntheticDeviceInfo.deviceType === 'desktop'
    ? 'desktop'
    : 'web'; // Mobile/tablet/unknown/iot мапим как web для DeviceRiskInfo

  // Создаем synthetic critical risk assessment
  const syntheticRiskAssessment: RiskAssessmentResult = {
    riskScore: 100, // Максимальный риск
    riskLevel: 'critical',
    triggeredRules: [],
    decisionHint: {
      action: 'block',
      blockReason: 'critical_risk', // Используем существующий BlockReason
    },
    assessment: {
      device: {
        deviceId: syntheticDeviceInfo.deviceId,
        platform,
        ...(syntheticDeviceInfo.os !== undefined && { os: syntheticDeviceInfo.os }),
        ...(syntheticDeviceInfo.browser !== undefined && { browser: syntheticDeviceInfo.browser }),
      },
    },
  };

  return {
    deviceInfo: syntheticDeviceInfo,
    riskAssessment: freezeRiskAssessmentResult(syntheticRiskAssessment),
  };
}

/** Обрабатывает ошибки pipeline с нормализацией и audit logging */
export function handlePipelineError(
  error: unknown,
  config: SecurityPipelineConfig,
  deviceInfo?: DeviceInfo,
): SecurityPipelineResult | never {
  // Определяем step из SecurityPipelineStepError (безопасный способ, не парсим строки)
  let step: SecurityPipelineStep = 'fingerprint';
  if (isSecurityPipelineStepError(error)) {
    step = error.step;
  } else if (
    error instanceof Error
    && determineErrorTypeFromMessage(error.message) === 'risk_assessment'
  ) {
    step = 'risk_assessment';
  }

  // Нормализуем ошибку через отдельный helper (SRP)
  const normalizedError = normalizeSecurityPipelineError(error, step);

  // Mandatory audit logging для критических ошибок (обязателен для production)
  // @note Runtime validation: проверяем наличие logger в production mode
  const environment = config.environment ?? DEFAULT_ENVIRONMENT;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety check для production mode
  if (environment.mode === 'production' && config.mandatoryAuditLogger === undefined) {
    throw new Error(
      '[security-pipeline] mandatoryAuditLogger is required in production mode',
    );
  }
  // mandatoryAuditLogger обязателен в типе, вызываем напрямую
  config.mandatoryAuditLogger(normalizedError, normalizedError.step);

  // Fail-closed policy: возвращаем synthetic critical risk вместо throw
  if (config.failClosed === true) {
    return createSyntheticCriticalRisk(deviceInfo);
  }

  // Fail-open policy: бросаем ошибку (caller может проигнорировать)
  throw normalizedError;
}
