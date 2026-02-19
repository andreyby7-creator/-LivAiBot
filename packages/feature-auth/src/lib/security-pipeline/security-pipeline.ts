/**
 * @file packages/feature-auth/src/lib/security-pipeline/security-pipeline.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Public API)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Public API facade для security pipeline
 * - Типы и конфигурация
 * - Причина изменения: внешний контракт
 *
 * Принципы:
 * - ✅ Facade pattern — единая точка входа
 * - ✅ Type definitions — публичные типы
 * - ✅ Stable contract — изменения только при изменении внешнего API
 */

import type { Effect } from '@livai/app/lib/effect-utils.js';

import { executeSecurityPipelineInternal } from './core/security-pipeline.engine.js';
import type {
  SecurityPipelineError,
  SecurityPipelineStep,
} from './core/security-pipeline.errors.js';
import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { AuditHook } from '../../effects/login/risk-assessment.js';
import type { RiskLevel } from '../../types/auth.js';
import type {
  ContextBuilderPlugin,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
} from '../../types/risk.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Union-тип операции security pipeline для строгой типизации */
export type SecurityOperation =
  | 'login'
  | 'oauth_login'
  | 'register'
  | 'oauth_register'
  | 'mfa'
  | 'session_refresh';

/** Версия security pipeline для backwards compatibility */
/** Текущая версия security pipeline (реэкспорт из engine) */
export { SecurityPipelineVersion } from './core/security-pipeline.engine.js';

// Реэкспорт типов из errors модуля
export type {
  SecurityPipelineError,
  SecurityPipelineStep,
} from './core/security-pipeline.errors.js';

/**
 * Backward Compatibility Policy:
 * - Минимальная поддерживаемая версия: 1
 * - При отсутствии версии в registry используется последняя версия (fallback)
 * - Breaking changes требуют новой major версии
 * - Minor версии должны быть backward compatible
 * - Миграции между версиями выполняются автоматически через compatibility adapters
 */

/** Контекст security pipeline, расширяет RiskContext с operation-специфичными полями */
export type SecurityPipelineContext = RiskContext & {
  /** Тип операции для контекстной оценки риска */
  readonly operation: SecurityOperation;
};

/** Плагин с приоритетом для контролируемого порядка выполнения */
export type PrioritizedPlugin = ContextBuilderPlugin & {
  /** Приоритет плагина (меньше = выше приоритет, выполняется раньше) */
  readonly priority?: number;
};

/** Режим детерминированного fingerprint для тестов */
export type DeterministicFingerprintMode = {
  /** Стабильный deviceId для тестов (переопределяет генерацию) */
  readonly deviceId?: string;
  /** Стабильный userAgent для тестов (переопределяет navigator.userAgent) */
  readonly userAgent?: string;
  /** Стабильные screen размеры для тестов */
  readonly screenWidth?: number;
  readonly screenHeight?: number;
};

/** Режим обработки ошибок плагинов */
export type PluginFailureMode = 'fail-open' | 'fail-closed';

/** Конфигурация isolation для плагинов */
export type PluginIsolationConfig = {
  /** Максимальное количество плагинов (по умолчанию 50) */
  readonly maxPlugins?: number;
  /** Режим обработки ошибок плагинов: fail-open (игнорировать ошибки) или fail-closed (бросать ошибку) */
  readonly failureMode?: PluginFailureMode;
};

/** Mandatory audit logger для критических ошибок */
export type MandatoryAuditLogger = (
  error: SecurityPipelineError,
  step: SecurityPipelineStep,
) => void;

/** Optional logger для debug/warning сообщений */
export type PipelineLogger = {
  /** Логирует warning сообщение */
  readonly warn: (message: string, ...args: readonly unknown[]) => void;
};

/** Environment конфигурация для pipeline */
export type PipelineEnvironment = {
  /** Режим окружения (development/production) */
  readonly mode: 'development' | 'production';
};

/** Конфигурация security pipeline: свойства */
// eslint-disable-next-line functional/no-mixed-types -- Config type содержит и свойства, и функции
export type SecurityPipelineConfigProperties = {
  /** Контекст для оценки риска */
  readonly context: SecurityPipelineContext;
  /** Политика оценки риска (опционально, используются дефолтные значения) */
  readonly policy?: RiskPolicy;
  /** Плагины для расширения контекста (опционально, сортируются по priority) */
  readonly plugins?: readonly (ContextBuilderPlugin | PrioritizedPlugin)[];
  /** Hook для audit/logging критических решений (опционально) */
  readonly auditHook?: AuditHook;
  /** Timeout для fingerprint шага в миллисекундах (по умолчанию 5000ms, динамически под нагрузку) */
  readonly fingerprintTimeoutMs?: number;
  /** Timeout для risk assessment шага в миллисекундах (по умолчанию 10000ms, динамически под нагрузку) */
  readonly riskAssessmentTimeoutMs?: number;
  /** Версия pipeline для backwards compatibility (по умолчанию текущая версия) */
  readonly version?: number;
  /** Режим детерминированного fingerprint для тестов (опционально) */
  readonly deterministicFingerprint?: DeterministicFingerprintMode;
  /** Конфигурация isolation для плагинов (опционально) */
  readonly pluginIsolation?: PluginIsolationConfig;
  /** Environment конфигурация (опционально, по умолчанию production) */
  readonly environment?: PipelineEnvironment;
  /** Optional logger для debug/warning сообщений (опционально) */
  readonly logger?: PipelineLogger;
  /** Fail-closed policy: при ошибке возвращать synthetic critical risk вместо throw (по умолчанию false) */
  readonly failClosed?: boolean;
  /** Remote risk provider для v2 pipeline (опционально) */
  readonly remoteRiskProvider?: (
    deviceInfo: DeviceInfo,
    context: SecurityPipelineContext,
  ) => Promise<RiskAssessmentResult>;
  /** Shadow mode: v2 не влияет на решение, только логирование (по умолчанию false) */
  readonly shadowMode?: boolean;
  /** Rollout конфигурация для feature flags (опционально) */
  readonly rolloutConfig?: {
    readonly featureFlagResolver?: (
      context: SecurityPipelineContext,
    ) => 'forced_v1' | 'shadow_v2' | 'active_v2';
    readonly shadowV2TrafficPercentage?: number;
    readonly activeV2TrafficPercentage?: number;
    readonly v2EnabledTenants?: readonly string[];
    readonly v2EnabledBuckets?: readonly string[];
  };
};

/** Конфигурация security pipeline: функции */
export type SecurityPipelineConfigFunctions = {
  /** Mandatory audit logger для критических ошибок (обязателен для production) */
  readonly mandatoryAuditLogger: MandatoryAuditLogger;
};

/** Конфигурация security pipeline с опциональными параметрами и дефолтами */
export type SecurityPipelineConfig =
  & SecurityPipelineConfigProperties
  & SecurityPipelineConfigFunctions;

/** Результат выполнения security pipeline (device info + risk assessment) */
export type SecurityPipelineResult = {
  /** Информация об устройстве */
  readonly deviceInfo: DeviceInfo;
  /** Результат оценки риска */
  readonly riskAssessment: RiskAssessmentResult;
};

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Выполняет security pipeline: fingerprint → risk assessment.
 * Каждый шаг изолирован с timeout. Результат fingerprint передается в risk assessment.
 *
 * @example
 * ```ts
 * const result = await executeSecurityPipeline({
 *   context: { operation: 'login', ip: '192.168.1.1', userId: 'user-123' },
 * });
 * if (result.riskAssessment.riskLevel === 'critical') {
 *   // Блокировать операцию
 * }
 * ```
 */
export function executeSecurityPipeline(
  config: SecurityPipelineConfig, // Конфигурация security pipeline
): Effect<SecurityPipelineResult> { // Effect с результатом security pipeline или ошибкой
  // Production guard: mandatoryAuditLogger обязателен в production
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition -- Runtime check для production mode
  if (process.env['NODE_ENV'] === 'production' && !config.mandatoryAuditLogger) {
    throw new Error(
      '[security-pipeline] mandatoryAuditLogger is required in production. Security without audit is a bug.',
    );
  }

  // Делегируем выполнение в engine (internal API)
  return executeSecurityPipelineInternal(config);
}

/* ============================================================================
 * 🔧 HELPER FUNCTIONS (Utility для работы с результатами)
 * ============================================================================
 */

/** Проверяет критический уровень риска в результате security pipeline */
export function isCriticalRisk(
  result: SecurityPipelineResult, // Результат security pipeline
): boolean { // true если risk level критический или high
  const { riskLevel } = result.riskAssessment;
  return riskLevel === 'critical' || riskLevel === 'high';
}

/** Проверяет необходимость блокировки операции по decision hint */
export function shouldBlockOperation(
  result: SecurityPipelineResult, // Результат security pipeline
): boolean { // true если операция должна быть заблокирована
  const { decisionHint } = result.riskAssessment;
  return decisionHint.action === 'block';
}

/** Проверяет необходимость challenge (MFA, CAPTCHA) по decision hint */
export function requiresChallenge(
  result: SecurityPipelineResult, // Результат security pipeline
): boolean { // true если требуется challenge
  const { decisionHint } = result.riskAssessment;
  return decisionHint.action === 'challenge';
}

/** Извлекает уровень риска из результата security pipeline */
export function getRiskLevel(
  result: SecurityPipelineResult, // Результат security pipeline
): RiskLevel { // Уровень риска
  return result.riskAssessment.riskLevel;
}

/** Извлекает risk score из результата security pipeline */
export function getRiskScore(
  result: SecurityPipelineResult, // Результат security pipeline
): number { // Risk score (0-100)
  return result.riskAssessment.riskScore;
}
