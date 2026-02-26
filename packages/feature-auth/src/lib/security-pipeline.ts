/**
 * @file packages/feature-auth/src/lib/security-pipeline.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Public API)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Auth-специфичная обертка над device fingerprint и risk assessment
 * - Использует orchestrator из @livai/app для композиции шагов с timeout и isolation
 * - Runtime injection для testability и feature flags
 * - Fail-closed policy с synthetic critical risk для безопасного degradation
 * - Полная immutability через ReadonlyDeep для audit hooks
 *
 * Принципы:
 * - ✅ Facade pattern — единая точка входа для security pipeline
 * - ✅ Dependency injection — Runtime, audit hooks, плагины через config
 * - ✅ Fail-safe design — fail-closed policy возвращает synthetic critical risk
 * - ✅ Immutability — ReadonlyDeep для полной защиты от мутаций
 * - ✅ Deterministic behavior — поддержка детерминированного fingerprint для тестов
 * - ✅ Validation on init — валидация плагинов перед выполнением
 * - ✅ Full error context — stack trace, cause, error name для audit
 * - ✅ Type safety — строгая типизация всех компонентов
 */

import { withTimeout } from '@livai/app/lib/effect-timeout.js';
import type { Effect } from '@livai/app/lib/effect-utils.js';
import { orchestrate, step } from '@livai/app/lib/orchestrator.js';
import { Runtime } from 'effect';

import type { DeviceInfo } from '../domain/DeviceInfo.js';
import {
  createLoginRiskEvaluation,
  createLoginRiskResult,
  emptyReasons,
} from '../domain/LoginRiskAssessment.js';
import { DeviceFingerprint } from '../effects/login/device-fingerprint.js';
import type { AuditHook } from '../effects/login/risk-assessment.js';
import { assessLoginRisk } from '../effects/login/risk-assessment.js';
import type {
  ContextBuilderPlugin,
  ReadonlyDeep,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
} from '../types/auth-risk.js';
import type { RiskLevel } from '../types/auth.js';

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

/** Шаги security pipeline для логирования и отладки */
export type SecurityPipelineStep = 'fingerprint' | 'risk_assessment';

/** Интерфейс для будущих pipeline steps (compile-time safety) */
// eslint-disable-next-line functional/no-mixed-types -- validateInput это опциональная функция валидации, не свойство
export type PipelineStep<TInput = unknown, TOutput = unknown> = {
  readonly label: string;
  readonly effect: Effect<TOutput>;
  readonly timeoutMs?: number;
  /** Опциональная функция для валидации входных данных */
  readonly validateInput?: (input: TInput) => boolean;
};

/** Ошибки security pipeline с полным контекстом для audit */
export type SecurityPipelineError = Readonly<{
  readonly kind: 'FINGERPRINT_ERROR' | 'RISK_ASSESSMENT_ERROR' | 'TIMEOUT_ERROR';
  readonly step: SecurityPipelineStep;
  readonly message: string;
  /** Оригинальная ошибка для диагностики */
  readonly cause?: unknown;
  /** Stack trace для отладки */
  readonly stack?: string;
  /** Оригинальный error name */
  readonly errorName?: string;
}>;

/** Контекст security pipeline, расширяет RiskContext с operation-специфичными полями */
export type SecurityPipelineContext = RiskContext & {
  /** Тип операции для контекстной оценки риска */
  readonly operation: SecurityOperation;
};

/** Audit hook для security pipeline с полной гарантией immutability через ReadonlyDeep */
export type SecurityPipelineAuditHook = (
  result: ReadonlyDeep<RiskAssessmentResult>,
  context: ReadonlyDeep<SecurityPipelineContext>,
) => void;

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

/** Mandatory audit logger для критических ошибок с readonly args для domain purity */
export type MandatoryAuditLogger = (
  error: Readonly<SecurityPipelineError>,
  step: Readonly<SecurityPipelineStep>,
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
export type SecurityPipelineConfigProperties = {
  /** Контекст для оценки риска */
  readonly context: SecurityPipelineContext;
  /** Политика оценки риска (опционально, используются дефолтные значения) */
  readonly policy?: RiskPolicy;
  /** Плагины для расширения контекста (опционально, сортируются по priority) */
  readonly plugins?: readonly (ContextBuilderPlugin | PrioritizedPlugin)[];
  /** Hook для audit/logging критических решений (опционально) */
  readonly auditHook?: SecurityPipelineAuditHook;
  /** Timeout для fingerprint шага в миллисекундах (по умолчанию 5000ms) */
  readonly fingerprintTimeoutMs?: number;
  /** Timeout для risk assessment шага в миллисекундах (по умолчанию 10000ms) */
  readonly riskAssessmentTimeoutMs?: number;
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
  /** Runtime для выполнения Effect (опционально, по умолчанию Runtime.defaultRuntime) */
  readonly runtime?: Runtime.Runtime<never>;
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
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Текущая версия security pipeline */
export const SecurityPipelineVersion = 2 as const;

/** Дефолтный timeout для fingerprint шага (5 секунд) */
const DEFAULT_FINGERPRINT_TIMEOUT_MS = 5000;

/** Дефолтный timeout для risk assessment шага (10 секунд) */
const DEFAULT_RISK_ASSESSMENT_TIMEOUT_MS = 10000;

/** Дефолтное максимальное количество плагинов */
const DEFAULT_MAX_PLUGINS = 50;

/** Дефолтная ширина экрана для детерминированного fingerprint (desktop) */
const DEFAULT_SCREEN_WIDTH = 1920;

/** Дефолтная высота экрана для детерминированного fingerprint (desktop) */
const DEFAULT_SCREEN_HEIGHT = 1080;

/** Максимальная ширина экрана для mobile устройства */
const MOBILE_MAX_WIDTH = 768;

/** Максимальная высота экрана для mobile устройства */
const MOBILE_MAX_HEIGHT = 1024;

/** Минимальная ширина экрана для tablet устройства */
const TABLET_MIN_WIDTH = 600;

/** Минимальная высота экрана для tablet устройства */
const TABLET_MIN_HEIGHT = 800;

/* ============================================================================
 * 🔧 HELPER FUNCTIONS (Internal utilities)
 * ============================================================================
 */

/**
 * Создает детерминированный DeviceInfo для тестов
 * @note Используется когда deterministicFingerprint передан в config
 */
function createDeterministicDeviceInfo(
  mode: DeterministicFingerprintMode, // Режим детерминированного fingerprint
): DeviceInfo {
  const deviceId = mode.deviceId ?? 'device-deterministic-test';
  const userAgent = mode.userAgent ?? 'Mozilla/5.0 (Test)';
  const screenWidth = mode.screenWidth ?? DEFAULT_SCREEN_WIDTH;
  const screenHeight = mode.screenHeight ?? DEFAULT_SCREEN_HEIGHT;

  // Определяем deviceType на основе размеров экрана
  const deviceType: DeviceInfo['deviceType'] =
    screenWidth <= MOBILE_MAX_WIDTH && screenHeight <= MOBILE_MAX_HEIGHT
      ? 'mobile'
      : screenWidth >= TABLET_MIN_WIDTH && screenHeight >= TABLET_MIN_HEIGHT
      ? 'tablet'
      : 'desktop';

  return Object.freeze({
    deviceId,
    deviceType,
    userAgent,
  });
}

/**
 * Создает synthetic critical risk для fail-closed policy
 * @note Используется когда failClosed=true и произошла ошибка
 */
function createSyntheticCriticalRisk(
  deviceInfo: DeviceInfo, // DeviceInfo для assessment
  error: SecurityPipelineError, // Оригинальная ошибка
): RiskAssessmentResult {
  // Создаём LoginRiskResult с critical уровнем
  const result = createLoginRiskResult({
    score: 100,
    level: 'critical',
    reasons: emptyReasons,
    modelVersion: '1.0.0',
  });

  // Создаём LoginRiskContext
  const context = {
    device: {
      deviceId: deviceInfo.deviceId,
      ...(deviceInfo.os !== undefined && { os: deviceInfo.os }),
      ...(deviceInfo.browser !== undefined && { browser: deviceInfo.browser }),
    },
    ...(deviceInfo.userAgent !== undefined && { userAgent: deviceInfo.userAgent }),
    timestamp: Date.now(),
  };

  // Создаём LoginRiskEvaluation
  const assessment = createLoginRiskEvaluation(result, context);

  return Object.freeze({
    riskScore: 100,
    riskLevel: 'critical' as const,
    triggeredRules: Object.freeze([]),
    decisionHint: Object.freeze({
      action: 'block' as const,
      blockReason: `Security pipeline error: ${error.message}`,
    }),
    assessment,
  });
}

/** Создает SecurityPipelineError с полным контекстом (stack trace, cause) */
function createSecurityPipelineError(
  kind: SecurityPipelineError['kind'],
  step: SecurityPipelineStep,
  message: string,
  cause?: unknown,
): SecurityPipelineError {
  const error = cause instanceof Error ? cause : new Error(String(cause ?? message));
  return Object.freeze({
    kind,
    step,
    message,
    ...(cause !== undefined && { cause }),
    ...(error.stack !== undefined && { stack: error.stack }),
    errorName: error.name,
  });
}

/**
 * Валидирует плагины на init (тип, priority)
 * @note Предотвращает runtime crashes от некорректных плагинов
 */
function validatePlugins(
  plugins: readonly (ContextBuilderPlugin | PrioritizedPlugin)[],
  maxPlugins: number,
  logger?: PipelineLogger,
): void {
  if (plugins.length > maxPlugins) {
    const message =
      `[security-pipeline] Too many plugins: ${plugins.length} > ${maxPlugins}. This may cause performance issues.`;
    logger?.warn(message);
    throw new Error(message);
  }

  for (const plugin of plugins) {
    if (!plugin.id || typeof plugin.id !== 'string') {
      throw new Error(
        `[security-pipeline] Invalid plugin: missing or invalid id. Plugin must have a string id.`,
      );
    }
    if (
      plugin.priority !== undefined
      && (typeof plugin.priority !== 'number' || plugin.priority < 0 || plugin.priority > 100)
    ) {
      throw new Error(
        `[security-pipeline] Invalid plugin priority for ${plugin.id}: must be a number between 0 and 100.`,
      );
    }
  }
}

/** Создает audit hook с ReadonlyDeep для полной гарантии immutability */
function createAuditHookWithReadonlyDeep(
  auditHook?: SecurityPipelineAuditHook,
): AuditHook | undefined {
  if (!auditHook) {
    return undefined;
  }
  // Адаптер: конвертируем SecurityPipelineAuditHook в AuditHook для assessLoginRisk
  // assessLoginRisk принимает RiskContext, но мы передаем SecurityPipelineContext
  return (result: Readonly<RiskAssessmentResult>, context: Readonly<RiskContext>): void => {
    // SecurityPipelineContext расширяет RiskContext, поэтому можно безопасно привести
    auditHook(
      result as ReadonlyDeep<RiskAssessmentResult>,
      context as ReadonlyDeep<SecurityPipelineContext>,
    );
  };
}

/** Валидирует previousResult и возвращает DeviceInfo или создает ошибку */
function validateAndGetDeviceInfo(
  previousResult: unknown,
  config: SecurityPipelineConfig,
): { deviceInfo: DeviceInfo; error?: SecurityPipelineError; } | { error: SecurityPipelineError; } {
  if (
    previousResult === null || previousResult === undefined || typeof previousResult !== 'object'
  ) {
    const error = createSecurityPipelineError(
      'RISK_ASSESSMENT_ERROR',
      'risk_assessment',
      'Invalid deviceInfo from fingerprint step',
      previousResult,
    );
    config.mandatoryAuditLogger(error, 'risk_assessment');
    return { error };
  }
  const deviceInfo = previousResult as DeviceInfo;
  if (deviceInfo.deviceId === '') {
    const error = createSecurityPipelineError(
      'RISK_ASSESSMENT_ERROR',
      'risk_assessment',
      'Invalid DeviceInfo structure: missing required fields',
      deviceInfo,
    );
    config.mandatoryAuditLogger(error, 'risk_assessment');
    return { error };
  }
  return { deviceInfo };
}

/** Обрабатывает ошибку pipeline и возвращает результат или бросает ошибку */
function handlePipelineError(
  error: unknown,
  failClosed: boolean,
  config: SecurityPipelineConfig,
): SecurityPipelineResult {
  const step: SecurityPipelineStep = error instanceof Error && error.message.includes('fingerprint')
    ? 'fingerprint'
    : 'risk_assessment';
  const pipelineError = createSecurityPipelineError(
    step === 'fingerprint' ? 'FINGERPRINT_ERROR' : 'RISK_ASSESSMENT_ERROR',
    step,
    error instanceof Error ? error.message : String(error),
    error,
  );
  config.mandatoryAuditLogger(pipelineError, step);

  if (!failClosed) {
    throw pipelineError;
  }

  const syntheticDeviceInfo: DeviceInfo = { deviceId: 'unknown', deviceType: 'unknown' };
  return {
    deviceInfo: syntheticDeviceInfo,
    riskAssessment: createSyntheticCriticalRisk(syntheticDeviceInfo, pipelineError),
  };
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
  return decisionHint.action === 'mfa';
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
 *   context: { operation: 'login', ip: '192.168.1.1' },
 *   mandatoryAuditLogger: (error) => console.error(error),
 * });
 * // если critical - блокировать операцию
 * if (result.riskAssessment.riskLevel === 'critical') return;
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

  // Валидация плагинов на init (предотвращает runtime crashes)
  const plugins = config.plugins ?? [];
  const maxPlugins = config.pluginIsolation?.maxPlugins ?? DEFAULT_MAX_PLUGINS;
  validatePlugins(plugins, maxPlugins, config.logger);

  const fingerprintTimeout = config.fingerprintTimeoutMs ?? DEFAULT_FINGERPRINT_TIMEOUT_MS;
  const riskAssessmentTimeout = config.riskAssessmentTimeoutMs
    ?? DEFAULT_RISK_ASSESSMENT_TIMEOUT_MS;
  const failClosed = config.failClosed ?? false;

  // Создаем audit hook с ReadonlyDeep для полной гарантии immutability
  const auditHook = createAuditHookWithReadonlyDeep(config.auditHook);

  // Адаптер для DeviceFingerprint: конвертирует Effect.Effect в Effect из app/lib/effect-utils
  // Поддержка deterministicFingerprint для тестов
  // Runtime injection для testability и feature flags
  const runtime = config.runtime ?? Runtime.defaultRuntime;
  const fingerprintEffect: Effect<DeviceInfo> = () => {
    if (config.deterministicFingerprint) {
      return Promise.resolve(createDeterministicDeviceInfo(config.deterministicFingerprint));
    }
    const effect = DeviceFingerprint();
    return Runtime.runPromise(runtime, effect);
  };

  // orchestrate возвращает Effect<T[number]>, где T[number] - union всех типов шагов
  // Нужно явно привести к SecurityPipelineResult, так как последний шаг возвращает этот тип
  const orchestrated = orchestrate<[DeviceInfo, SecurityPipelineResult]>([
    step(
      'fingerprint',
      withTimeout(fingerprintEffect, { timeoutMs: fingerprintTimeout, tag: 'fingerprint' }),
      fingerprintTimeout,
    ),
    step(
      'risk_assessment',
      (_signal?: AbortSignal, previousResult?: unknown): Promise<SecurityPipelineResult> => {
        // Валидация previousResult
        const validation = validateAndGetDeviceInfo(previousResult, config);
        if ('error' in validation) {
          const syntheticDeviceInfo: DeviceInfo = { deviceId: 'unknown', deviceType: 'unknown' };
          return failClosed
            ? Promise.resolve({
              deviceInfo: syntheticDeviceInfo,
              riskAssessment: createSyntheticCriticalRisk(syntheticDeviceInfo, validation.error),
            })
            : Promise.reject(validation.error);
        }

        // Выполняем risk assessment
        const { deviceInfo } = validation;
        try {
          const riskResult = assessLoginRisk(
            deviceInfo,
            config.context,
            config.policy,
            plugins,
            auditHook,
          );
          return Promise.resolve({
            deviceInfo,
            riskAssessment: riskResult,
          });
        } catch (error) {
          const pipelineError = createSecurityPipelineError(
            'RISK_ASSESSMENT_ERROR',
            'risk_assessment',
            error instanceof Error ? error.message : String(error),
            error,
          );
          config.mandatoryAuditLogger(pipelineError, 'risk_assessment');
          return failClosed
            ? Promise.resolve({
              deviceInfo,
              riskAssessment: createSyntheticCriticalRisk(deviceInfo, pipelineError),
            })
            : Promise.reject(pipelineError);
        }
      },
      riskAssessmentTimeout,
    ),
  ]);

  // Wrapper для обработки ошибок с fail-closed policy и audit logging
  return async (signal?: AbortSignal): Promise<SecurityPipelineResult> => {
    try {
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout применяется через withTimeout в step
      const result = await orchestrated(signal);
      // Type guard: проверяем, что результат - SecurityPipelineResult (последний шаг)
      if (typeof result === 'object' && 'deviceInfo' in result && 'riskAssessment' in result) {
        // eslint-disable-next-line @livai/rag/source-citation -- это не RAG response, а возврат результата type guard
        return result;
      }
      // Если результат - DeviceInfo (первый шаг), это не должно произойти, но обрабатываем для безопасности
      throw new Error(
        '[security-pipeline] Unexpected result type: expected SecurityPipelineResult but got DeviceInfo',
      );
    } catch (error) {
      return handlePipelineError(error, failClosed, config);
    }
  };
}
