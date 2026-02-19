/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.engine.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Core Engine)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Core execution engine для security pipeline
 * - Orchestration, plugins, versioning
 * - Причина изменения: execution model (flow security pipeline)
 *
 * Принципы:
 * - ✅ Execution model — как pipeline выполняется
 * - ✅ Orchestration — композиция шагов
 * - ✅ Plugin system — расширяемость через плагины
 * - ✅ Versioning — backward compatibility
 */

import { withTimeout } from '@livai/app/lib/effect-timeout.js';
import type { Effect } from '@livai/app/lib/effect-utils.js';
import { orchestrate, step } from '@livai/app/lib/orchestrator.js';
import type { Step } from '@livai/app/lib/orchestrator.js';

import { adaptEffectLibraryToUtils } from './security-pipeline.adapter.js';
import {
  createSecurityPipelineStepError,
  normalizeSecurityPipelineError,
} from './security-pipeline.errors.js';
import { createDisagreementMetric, createTelemetryMetric } from './security-pipeline.metrics.js';
import {
  applyRuntimeOverrides,
  logRuntimeOverrides,
  readRuntimeOverrides,
} from './security-pipeline.runtime-overrides.js';
import type { DeviceInfo } from '../../../domain/DeviceInfo.js';
import { DeviceFingerprint } from '../../../effects/login/device-fingerprint.js';
import { assessLoginRisk } from '../../../effects/login/risk-assessment.js';
import type {
  ContextBuilderPlugin,
  RiskAssessmentResult,
  RiskContext,
} from '../../../types/risk.js';
import { applyAggregationPolicy } from '../policies/risk-aggregation.policy.js';
import {
  DEFAULT_ENVIRONMENT,
  freezeRiskAssessmentResult,
  handlePipelineError,
} from '../policies/security-pipeline.policy.js';
import type { RiskSource } from '../risk-sources/aggregate-risk.js';
import type { RemoteProviderSourceConfig } from '../risk-sources/remote-provider.source.js';
import { assessRemoteRisk } from '../risk-sources/remote-provider.source.js';
import type {
  DeterministicFingerprintMode,
  PipelineEnvironment,
  PipelineLogger,
  PluginFailureMode,
  PluginIsolationConfig,
  PrioritizedPlugin,
  SecurityPipelineConfig,
  SecurityPipelineResult,
  SecurityPipelineStep,
} from '../security-pipeline.js';
/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Текущая версия security pipeline */
export const SecurityPipelineVersion = 2 as const;

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтный timeout для fingerprint шага (5 секунд) */
const DEFAULT_FINGERPRINT_TIMEOUT_MS = 5000;

/** Дефолтный timeout для risk assessment шага (10 секунд) */
const DEFAULT_RISK_ASSESSMENT_TIMEOUT_MS = 10000;

/** Веса источников риска для агрегации */
const LOCAL_RISK_WEIGHT = 0.6;
const REMOTE_RISK_WEIGHT = 0.4;

/** Дефолтное максимальное количество плагинов */
const DEFAULT_MAX_PLUGINS = 50;

/**
 * Default plugin failure mode для security pipeline
 * @note Production security: fail-closed по умолчанию для гарантии deterministic risk outcome.
 * fail-open может привести к разным результатам в dev/prod при падении плагина.
 */
const DEFAULT_PLUGIN_FAILURE_MODE: PluginFailureMode = 'fail-closed';

/** Константы для детерминированного fingerprint режима */
const DETERMINISTIC_DEFAULTS = {
  DEVICE_ID: 'device-test-deterministic',
  USER_AGENT: 'Mozilla/5.0 (Test)',
  SCREEN_WIDTH: 1920,
  SCREEN_HEIGHT: 1080,
  MOBILE_MAX_WIDTH: 768,
  MOBILE_MAX_HEIGHT: 1024,
  TABLET_MIN_WIDTH: 600,
  TABLET_MIN_HEIGHT: 800,
} as const;

/** Timeout для agent operation (предотвращение зависания оркестрации) */
const AGENT_OPERATION_TIMEOUT_MS = 30000; // 30 секунд

/* ============================================================================
 * 🔧 DETERMINISTIC MODE
 * ============================================================================
 */

/**
 * Создает детерминированный DeviceInfo для тестов
 * @note DeterministicFingerprintMode: переопределяет сбор данных об устройстве
 * для обеспечения детерминированности в тестах и RAG-сценариях.
 */
function createDeterministicDeviceInfo(
  mode: DeterministicFingerprintMode,
): DeviceInfo {
  // Используем предоставленные значения или дефолты
  const deviceId = mode.deviceId ?? DETERMINISTIC_DEFAULTS.DEVICE_ID;
  const userAgent = mode.userAgent ?? DETERMINISTIC_DEFAULTS.USER_AGENT;
  const screenWidth = mode.screenWidth ?? DETERMINISTIC_DEFAULTS.SCREEN_WIDTH;
  const screenHeight = mode.screenHeight ?? DETERMINISTIC_DEFAULTS.SCREEN_HEIGHT;

  // Определяем deviceType на основе screen размеров
  const deviceType: DeviceInfo['deviceType'] =
    screenWidth <= DETERMINISTIC_DEFAULTS.MOBILE_MAX_WIDTH
      && screenHeight <= DETERMINISTIC_DEFAULTS.MOBILE_MAX_HEIGHT
      ? 'mobile'
      : screenWidth >= DETERMINISTIC_DEFAULTS.TABLET_MIN_WIDTH
          && screenHeight >= DETERMINISTIC_DEFAULTS.TABLET_MIN_HEIGHT
      ? 'tablet'
      : 'desktop';

  return {
    deviceId,
    deviceType,
    userAgent,
  };
}

/* ============================================================================
 * 🔧 PLUGIN SYSTEM
 * ============================================================================
 */

/** Сортирует плагины по приоритету (меньше = выше приоритет) */
function sortPluginsByPriority(
  plugins: readonly (ContextBuilderPlugin | PrioritizedPlugin)[],
): readonly ContextBuilderPlugin[] {
  return [...plugins].sort((a, b) => {
    const priorityA = 'priority' in a ? a.priority ?? 100 : 100;
    const priorityB = 'priority' in b ? b.priority ?? 100 : 100;
    return priorityA - priorityB;
  }) as readonly ContextBuilderPlugin[];
}

/** Валидирует количество плагинов */
function validatePluginCount(
  plugins: readonly (ContextBuilderPlugin | PrioritizedPlugin)[],
  maxPlugins: number,
): void {
  if (plugins.length > maxPlugins) {
    throw new Error(
      `[security-pipeline] Too many plugins: ${plugins.length} exceeds maximum ${maxPlugins}`,
    );
  }
}

/**
 * Оборачивает плагин с isolation для предотвращения cascading failures
 * @note Plugin isolation: каждый плагин выполняется в try/catch для предотвращения
 * влияния ошибок одного плагина на другие. Режим fail-open/fail-closed контролирует поведение при ошибке.
 */
function wrapPluginWithIsolation(
  plugin: ContextBuilderPlugin,
  failureMode: PluginFailureMode,
  logger?: PipelineLogger,
  environment?: PipelineEnvironment,
): ContextBuilderPlugin {
  const wrapExtendFunction = <TContext>(
    originalExtend?: (context: TContext, riskContext: RiskContext) => TContext,
  ): ((context: TContext, riskContext: RiskContext) => TContext) | undefined => {
    if (originalExtend === undefined) {
      return undefined;
    }

    return (context: TContext, riskContext: RiskContext): TContext => {
      try {
        return originalExtend(context, riskContext);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const pluginError = new Error(
          `[security-pipeline] Plugin "${plugin.id}" failed: ${errorMessage}`,
        );

        if (failureMode === 'fail-closed') {
          throw pluginError;
        }

        // fail-open: логируем ошибку и возвращаем исходный context без изменений
        // @warning Non-deterministic behavior: в dev логируем, в prod тихо игнорируем.
        // Это ломает deterministic risk outcome: одинаковый вход → разный выход при падении плагина.
        // Для production security pipeline рекомендуется использовать fail-closed mode.
        if (logger !== undefined && environment?.mode === 'development') {
          logger.warn(
            `[security-pipeline] Plugin "${plugin.id}" failed (fail-open mode):`,
            error,
          );
        }

        return context;
      }
    };
  };

  const wrappedExtendScoringContext = wrapExtendFunction(plugin.extendScoringContext);
  const wrappedExtendRuleContext = wrapExtendFunction(plugin.extendRuleContext);
  const wrappedExtendAssessmentContext = wrapExtendFunction(plugin.extendAssessmentContext);

  return {
    ...plugin,
    ...(wrappedExtendScoringContext !== undefined
      && { extendScoringContext: wrappedExtendScoringContext }),
    ...(wrappedExtendRuleContext !== undefined && { extendRuleContext: wrappedExtendRuleContext }),
    ...(wrappedExtendAssessmentContext !== undefined
      && { extendAssessmentContext: wrappedExtendAssessmentContext }),
  };
}

/**
 * Применяет isolation к плагинам с валидацией количества
 * @note Plugin isolation: каждый плагин изолирован через try/catch для предотвращения
 * cascading failures. Максимальное количество плагинов ограничено для производительности.
 */
function applyPluginIsolation(
  plugins: readonly (ContextBuilderPlugin | PrioritizedPlugin)[],
  config: PluginIsolationConfig,
  logger?: PipelineLogger,
  environment?: PipelineEnvironment,
): readonly ContextBuilderPlugin[] {
  const maxPlugins: number = config.maxPlugins ?? DEFAULT_MAX_PLUGINS;
  const failureMode: PluginFailureMode = config.failureMode ?? DEFAULT_PLUGIN_FAILURE_MODE;

  // Валидация количества плагинов
  validatePluginCount(plugins, maxPlugins);

  // Сортировка по приоритету
  const sortedPlugins = sortPluginsByPriority(plugins);

  // Применение isolation wrapper к каждому плагину
  return sortedPlugins.map((plugin) =>
    wrapPluginWithIsolation(plugin, failureMode, logger, environment)
  );
}

/* ============================================================================
 * 🔧 STEP BUILDERS
 * ============================================================================
 */

/** Создаёт Effect для fingerprint шага (сбор данных об устройстве) */
function createFingerprintStep(
  config?: SecurityPipelineConfig,
): Effect<DeviceInfo> { // Effect с DeviceInfo
  // Если включен детерминированный режим, используем его
  if (config?.deterministicFingerprint !== undefined) {
    // Детерминированный режим: синхронная функция без side-effects, isolation не требуется
    const deterministicMode = config.deterministicFingerprint;
    return (): Promise<DeviceInfo> => {
      return Promise.resolve(createDeterministicDeviceInfo(deterministicMode));
    };
  }

  // Иначе используем стандартный DeviceFingerprint с isolation через orchestrator
  const effectLib = DeviceFingerprint();
  return adaptEffectLibraryToUtils(effectLib);
}

/** Создаёт Effect для risk assessment шага на основе fingerprint результата */
function createRiskAssessmentStep(
  deviceInfo: DeviceInfo, // Результат fingerprint шага
  config: SecurityPipelineConfig, // Конфигурация security pipeline
): Effect<RiskAssessmentResult> { // Effect с RiskAssessmentResult
  return (): Promise<RiskAssessmentResult> => {
    // Извлекаем RiskContext из SecurityPipelineContext (исключаем operation)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- operation исключается для передачи только RiskContext
    const { operation: _unusedOperation, ...riskContext } = config.context;

    // Клонируем context перед передачей в плагины для гарантии replay determinism
    // @note Immutable context cloning: предотвращает мутации входного context плагинами
    // до применения deepFreeze. Без клонирования плагины могут мутировать исходный context,
    // что приводит к non-deterministic результатам при повторных вызовах.
    const clonedRiskContext = structuredClone(riskContext) as RiskContext;

    // Применяем isolation к плагинам (валидация количества, сортировка, isolation wrapper)
    // @note Plugin isolation: каждый плагин изолирован через try/catch для предотвращения
    // cascading failures. Максимальное количество плагинов ограничено для производительности.
    const isolatedPlugins = config.plugins !== undefined && config.plugins.length > 0
      ? applyPluginIsolation(
        config.plugins,
        config.pluginIsolation ?? {},
      )
      : [];

    // Выполняем risk assessment (синхронная функция, не Effect)
    // Детерминированная функция: одинаковый вход → одинаковый выход
    // @note Детерминированность: DeviceFingerprint может включать нестабильные данные
    // (например, timestamps). Для unit-тестов и RAG рекомендуется стабилизировать
    // поля DeviceInfo или использовать fingerprintSalt/deterministicHash.
    try {
      const result = assessLoginRisk(
        deviceInfo,
        clonedRiskContext,
        config.policy,
        isolatedPlugins,
        config.auditHook,
      );

      // Делаем результат полностью immutable для domain purity
      return Promise.resolve(freezeRiskAssessmentResult(result));
    } catch (error: unknown) {
      // Ошибки плагинов или других компонентов risk assessment
      // Пробрасываем для обработки через handlePipelineError
      // Используем Promise.reject для правильной обработки в async контексте
      return Promise.reject(error);
    }
  };
}

/** Оборачивает effect с явным step metadata для надежной обработки ошибок */
function wrapStepEffectWithStepMetadata<T>(
  effect: Effect<T> | ((signal?: AbortSignal, previousResult?: unknown) => Promise<T>),
  stepName: SecurityPipelineStep,
): Effect<T> | ((signal?: AbortSignal, previousResult?: unknown) => Promise<T>) {
  // Применяем timeout через withTimeout для детерминированного поведения
  const effectWithTimeout = withTimeout(effect as Effect<T>, {
    timeoutMs: AGENT_OPERATION_TIMEOUT_MS,
    tag: `security-pipeline:${stepName}`,
  });

  // Если исходный effect принимает previousResult (2 параметра), сохраняем эту сигнатуру
  if (effect.length >= 2) {
    return async (signal?: AbortSignal, previousResult?: unknown): Promise<T> => {
      try {
        // Вызываем исходный effect с previousResult
        const originalEffect = effect as (
          signal?: AbortSignal,
          previousResult?: unknown,
        ) => Promise<T>;
        // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout установлен через withTimeout выше
        return await originalEffect(signal, previousResult);
      } catch (error: unknown) {
        // Оборачиваем ошибку с явным step metadata
        throw createSecurityPipelineStepError(
          error instanceof Error ? error.message : String(error),
          stepName,
          error,
        );
      }
    };
  }

  // Иначе стандартный Effect с одним параметром
  return async (signal?: AbortSignal): Promise<T> => {
    try {
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout установлен через withTimeout выше
      return await effectWithTimeout(signal);
    } catch (error: unknown) {
      // Оборачиваем ошибку с явным step metadata
      throw createSecurityPipelineStepError(
        error instanceof Error ? error.message : String(error),
        stepName,
        error,
      );
    }
  };
}

/* ============================================================================
 * 🔧 VERSION REGISTRY
 * ============================================================================
 */

/**
 * Builder для создания security pipeline Effect
 * @note Pipeline builders изолированы по версиям для поддержки backward compatibility
 */
type PipelineBuilder = (config: SecurityPipelineConfig) => Effect<SecurityPipelineResult>;

/** Тип для шагов security pipeline */
type SecurityPipelineSteps = readonly [
  Step<DeviceInfo>,
  Step<SecurityPipelineResult>,
];

/** Создает шаги security pipeline (чистый builder, без side-effects) */
function buildSecurityPipelineSteps(
  config: SecurityPipelineConfig,
): SecurityPipelineSteps {
  // Извлекаем timeout значения с дефолтами
  // @note Timeout можно сделать динамическими под нагрузку через config
  const fingerprintTimeoutMs = config.fingerprintTimeoutMs
    ?? DEFAULT_FINGERPRINT_TIMEOUT_MS;
  const riskAssessmentTimeoutMs = config.riskAssessmentTimeoutMs
    ?? DEFAULT_RISK_ASSESSMENT_TIMEOUT_MS;

  // Step 1: Fingerprint (сбор данных об устройстве)
  const fingerprintStepLabel = 'security-pipeline:fingerprint';
  const fingerprintStepEffect = wrapStepEffectWithStepMetadata(
    createFingerprintStep(config),
    'fingerprint',
  );
  const fingerprintStep = step<DeviceInfo>(
    fingerprintStepLabel,
    fingerprintStepEffect,
    fingerprintTimeoutMs,
  );

  // Step 2: Risk Assessment (оценка риска на основе fingerprint)
  // Используем функцию, которая принимает previousResult (DeviceInfo)
  // Возвращаем SecurityPipelineResult, содержащий и deviceInfo, и riskAssessment
  const riskAssessmentStepLabel = 'security-pipeline:risk-assessment';
  const riskAssessmentStepEffect: Effect<SecurityPipelineResult> = async (
    _signal?: AbortSignal,
    previousResult?: unknown,
  ): Promise<SecurityPipelineResult> => {
    // Валидация previousResult (TypeScript не гарантирует тип в runtime)
    if (previousResult === undefined || typeof previousResult !== 'object') {
      throw createSecurityPipelineStepError(
        '[security-pipeline] Invalid previousResult: expected DeviceInfo',
        'risk_assessment',
      );
    }

    const deviceInfo = previousResult as DeviceInfo;
    // Сохраняем deviceInfo для fail-closed policy (если нужен synthetic risk)

    // Валидация структуры DeviceInfo
    if (
      typeof deviceInfo.deviceId !== 'string'
      || typeof deviceInfo.deviceType !== 'string'
    ) {
      throw createSecurityPipelineStepError(
        '[security-pipeline] Invalid DeviceInfo structure',
        'risk_assessment',
      );
    }

    // Создаём Effect для risk assessment шага
    const riskAssessmentEffect = createRiskAssessmentStep(deviceInfo, config);
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout установлен через step()
    const riskAssessment = await riskAssessmentEffect();

    // Возвращаем SecurityPipelineResult с deviceInfo и riskAssessment
    return {
      deviceInfo,
      riskAssessment,
    };
  };

  const wrappedRiskAssessmentEffect = wrapStepEffectWithStepMetadata(
    riskAssessmentStepEffect,
    'risk_assessment',
  );

  const riskAssessmentStep = step<SecurityPipelineResult>(
    riskAssessmentStepLabel,
    wrappedRiskAssessmentEffect,
    riskAssessmentTimeoutMs,
  );

  return [fingerprintStep, riskAssessmentStep] as const;
}

/**
 * Создает шаги для v2 pipeline с параллельными источниками риска
 * @note v2 pipeline: local rules + remote provider → aggregate → decision
 */
function buildV2PipelineSteps(
  config: SecurityPipelineConfig,
): SecurityPipelineSteps {
  const fingerprintTimeoutMs = config.fingerprintTimeoutMs
    ?? DEFAULT_FINGERPRINT_TIMEOUT_MS;
  const riskAssessmentTimeoutMs = config.riskAssessmentTimeoutMs
    ?? DEFAULT_RISK_ASSESSMENT_TIMEOUT_MS;

  // Step 1: Fingerprint (сбор данных об устройстве) - идентичен v1
  const fingerprintStepLabel = 'security-pipeline:fingerprint';
  const fingerprintStepEffect = wrapStepEffectWithStepMetadata(
    createFingerprintStep(config),
    'fingerprint',
  );
  const fingerprintStep = step<DeviceInfo>(
    fingerprintStepLabel,
    fingerprintStepEffect,
    fingerprintTimeoutMs,
  );

  // Step 2: Risk Assessment (параллельные источники риска)
  const riskAssessmentStepLabel = 'security-pipeline:risk-assessment-v2';

  /** Создает critical risk source для fail-closed режима */
  function createCriticalRiskSource(
    deviceInfo: DeviceInfo,
    weight: number,
  ): RiskSource {
    return {
      result: {
        riskScore: 100,
        riskLevel: 'critical',
        triggeredRules: [],
        decisionHint: {
          action: 'block',
          blockReason: 'critical_risk',
        },
        assessment: {
          device: {
            deviceId: deviceInfo.deviceId,
            platform: deviceInfo.deviceType === 'desktop' ? 'desktop' : 'web',
          },
        },
      },
      weight,
      isFailClosed: true,
    };
  }

  /** Собирает local risk source с обработкой ошибок плагинов */
  function collectLocalRiskSource(
    deviceInfo: DeviceInfo,
    config: SecurityPipelineConfig,
    isolatedPlugins: readonly ContextBuilderPlugin[],
    riskContext: RiskContext,
  ): RiskSource | undefined {
    try {
      const localRisk = assessLoginRisk(
        deviceInfo,
        riskContext,
        config.policy,
        isolatedPlugins,
        config.auditHook,
      );
      return {
        result: localRisk,
        weight: LOCAL_RISK_WEIGHT,
        isFailClosed: false,
      };
    } catch (error: unknown) {
      if (config.failClosed === true) {
        return createCriticalRiskSource(deviceInfo, LOCAL_RISK_WEIGHT);
      }
      throw error;
    }
  }

  /** Собирает remote risk source с обработкой ошибок */
  async function collectRemoteRiskSource(
    deviceInfo: DeviceInfo,
    config: SecurityPipelineConfig,
    riskAssessmentTimeoutMs: number,
  ): Promise<RiskSource | undefined> {
    if (!config.remoteRiskProvider) {
      return undefined;
    }

    const remoteRiskConfigWithContext: RemoteProviderSourceConfig = {
      context: config.context,
      deviceInfo,
      timeoutMs: riskAssessmentTimeoutMs,
    };
    const remoteRiskEffect = assessRemoteRisk(
      remoteRiskConfigWithContext,
      config.remoteRiskProvider,
    );

    try {
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Timeout установлен через assessRemoteRisk
      const remoteRisk = await remoteRiskEffect();
      const isInvalidScore = !Number.isFinite(remoteRisk.riskScore);
      const isFailClosed = remoteRisk.confidence === 0.0 || isInvalidScore;

      if (isInvalidScore && config.failClosed === true) {
        return {
          result: {
            ...remoteRisk,
            riskScore: 100,
            riskLevel: 'critical',
            decisionHint: {
              action: 'block',
              blockReason: 'critical_risk',
            },
          },
          weight: REMOTE_RISK_WEIGHT,
          isFailClosed: true,
        };
      }

      return {
        result: remoteRisk,
        weight: REMOTE_RISK_WEIGHT,
        isFailClosed,
      };
    } catch (error: unknown) {
      if (config.failClosed === true) {
        return createCriticalRiskSource(deviceInfo, REMOTE_RISK_WEIGHT);
      }

      const normalizedError = normalizeSecurityPipelineError(error, 'risk_assessment');
      config.mandatoryAuditLogger(normalizedError, 'risk_assessment');
      createTelemetryMetric('provider_error', {
        context: config.context,
        error,
      });
      return undefined;
    }
  }

  const riskAssessmentStepEffect: Effect<SecurityPipelineResult> = async (
    _signal?: AbortSignal,
    previousResult?: unknown,
  ): Promise<SecurityPipelineResult> => {
    // Валидация previousResult
    if (previousResult === undefined || typeof previousResult !== 'object') {
      throw createSecurityPipelineStepError(
        '[security-pipeline] Invalid previousResult: expected DeviceInfo',
        'risk_assessment',
      );
    }

    const deviceInfo = previousResult as DeviceInfo;
    if (
      typeof deviceInfo.deviceId !== 'string'
      || typeof deviceInfo.deviceType !== 'string'
    ) {
      throw createSecurityPipelineStepError(
        '[security-pipeline] Invalid DeviceInfo structure',
        'risk_assessment',
      );
    }

    // Собираем риски из параллельных источников
    const riskSources: RiskSource[] = [];

    // 1. Local rules source (всегда доступен)
    const isolatedPlugins = config.plugins !== undefined && config.plugins.length > 0
      ? applyPluginIsolation(
        config.plugins,
        config.pluginIsolation ?? {},
        config.logger,
        config.environment,
      )
      : [];

    // Извлекаем RiskContext из SecurityPipelineContext (исключаем operation)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- operation исключается для передачи только RiskContext
    const { operation: _unusedOperation, ...riskContext } = config.context;
    const clonedRiskContext = structuredClone(riskContext) as RiskContext;

    // collectLocalRiskSource - синхронная функция, не требует таймаута
    const localRiskSource = collectLocalRiskSource(
      deviceInfo,
      config,
      isolatedPlugins,
      clonedRiskContext,
    );
    if (localRiskSource !== undefined) {
      riskSources.push(localRiskSource);
    }

    // 2. Remote provider source (если доступен)
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Timeout установлен внутри collectRemoteRiskSource через assessRemoteRisk
    const remoteRiskSource = await collectRemoteRiskSource(
      deviceInfo,
      config,
      riskAssessmentTimeoutMs,
    );
    if (remoteRiskSource !== undefined) {
      riskSources.push(remoteRiskSource);
    }

    // Агрегируем риски
    const aggregatedRisk = applyAggregationPolicy(riskSources);

    // Shadow mode: сравниваем v2 с v1, но используем v1 для решения
    if (config.shadowMode === true) {
      // Выполняем v1 для сравнения
      const v1RiskEffect = createRiskAssessmentStep(deviceInfo, config);
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Timeout установлен через step() выше
      const v1Risk = await v1RiskEffect();

      // Создаем метрику расхождения для disagreement dashboard
      const disagreementMetric = createDisagreementMetric(v1Risk, aggregatedRisk, config.context);
      const hasDisagreement = disagreementMetric.type !== 'exact_match';

      if (hasDisagreement) {
        // Расхождение: логируем событие и отправляем метрику
        // mandatoryAuditLogger обязателен (проверяется в facade)
        const disagreementError = normalizeSecurityPipelineError(
          new Error(
            `[security-pipeline] v2 disagreement: v1=${v1Risk.riskLevel}/${v1Risk.riskScore}, v2=${aggregatedRisk.riskLevel}/${aggregatedRisk.riskScore}, type=${disagreementMetric.type}`,
          ),
          'risk_assessment',
        );
        config.mandatoryAuditLogger(disagreementError, 'risk_assessment');

        // Отправляем метрику для telemetry (если доступна функция emitMetric)
        // TODO: интегрировать с config.metricsConfig?.emitMetric
      }

      // В shadow mode используем v1 результат
      return {
        deviceInfo,
        riskAssessment: freezeRiskAssessmentResult(v1Risk),
      };
    }

    // Обычный режим: используем v2 результат
    return {
      deviceInfo,
      riskAssessment: freezeRiskAssessmentResult(aggregatedRisk),
    };
  };

  const wrappedRiskAssessmentEffect = wrapStepEffectWithStepMetadata(
    riskAssessmentStepEffect,
    'risk_assessment',
  );

  const riskAssessmentStep = step<SecurityPipelineResult>(
    riskAssessmentStepLabel,
    wrappedRiskAssessmentEffect,
    riskAssessmentTimeoutMs,
  );

  return [fingerprintStep, riskAssessmentStep] as const;
}

/**
 * Registry pipeline builders по версиям
 * @note Version-based builder selection: позволяет поддерживать несколько версий pipeline
 * без раздувания файла. При добавлении новой версии достаточно добавить entry в registry.
 * @note Используем явное число 1 вместо SecurityPipelineVersion в computed property
 * для корректной работы во время выполнения (const as const может не работать в computed property)
 */
const pipelineRegistry: Record<number, PipelineBuilder> = {
  1: (config: SecurityPipelineConfig): Effect<SecurityPipelineResult> => {
    // Сборка шагов (SRP: отдельная ответственность)
    const steps = buildSecurityPipelineSteps(config);

    // Оркестрация (SRP: отдельная ответственность)
    const orchestrated = orchestrate<[DeviceInfo, SecurityPipelineResult]>(steps);

    // Возвращаем Effect с SecurityPipelineResult
    return async (signal?: AbortSignal): Promise<SecurityPipelineResult> => {
      let deviceInfo: DeviceInfo | undefined;
      try {
        // Выполняем orchestrated effect
        // Результат уже содержит SecurityPipelineResult (deviceInfo + riskAssessment)
        // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout установлен через step()
        const result = await orchestrated(signal) as SecurityPipelineResult;
        // Сохраняем deviceInfo для возможной обработки ошибок
        deviceInfo = result.deviceInfo;
        // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
        return result;
      } catch (error: unknown) {
        // Обработка ошибок с нормализацией и audit logging (SRP: отдельная ответственность)
        // @note Fail-closed: при failClosed=true возвращаем synthetic critical risk вместо throw
        // handlePipelineError возвращает SecurityPipelineResult | never
        return handlePipelineError(error, config, deviceInfo);
      }
    };
  },
  2: (config: SecurityPipelineConfig): Effect<SecurityPipelineResult> => {
    // Сборка шагов для v2 (параллельные источники риска)
    const steps = buildV2PipelineSteps(config);

    // Оркестрация (SRP: отдельная ответственность)
    const orchestrated = orchestrate<[DeviceInfo, SecurityPipelineResult]>(steps);

    // Возвращаем Effect с SecurityPipelineResult
    return async (signal?: AbortSignal): Promise<SecurityPipelineResult> => {
      let deviceInfo: DeviceInfo | undefined;
      try {
        // Выполняем orchestrated effect
        // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout установлен через step()
        const result = await orchestrated(signal) as SecurityPipelineResult;
        // Сохраняем deviceInfo для возможной обработки ошибок
        deviceInfo = result.deviceInfo;
        // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
        return result;
      } catch (error: unknown) {
        // Обработка ошибок с нормализацией и audit logging
        return handlePipelineError(error, config, deviceInfo);
      }
    };
  },
};

/**
 * Выполняет security pipeline через version-based builder selection
 * @note Internal API - используется только через security-pipeline.ts facade
 */
export function executeSecurityPipelineInternal(
  config: SecurityPipelineConfig,
): Effect<SecurityPipelineResult> {
  const environment: PipelineEnvironment = config.environment ?? DEFAULT_ENVIRONMENT;

  // Читаем runtime overrides (on-call safety switches)
  const runtimeOverrides = readRuntimeOverrides();

  // Определяем версию pipeline на основе feature flags (если rolloutConfig указан)
  let effectiveVersion = config.version;
  let effectiveShadowMode = config.shadowMode;
  let effectiveRemoteProvider = config.remoteRiskProvider;
  let effectiveFailClosed = config.failClosed;

  if (config.rolloutConfig) {
    // Импортируем функции feature flags динамически для избежания циклических зависимостей
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- Dynamic require для feature flags, типизация через as
    const featureFlagsModule = require('./security-pipeline.feature-flags.js') as {
      resolvePipelineVersion: (
        context: SecurityPipelineConfig['context'],
        config: NonNullable<SecurityPipelineConfig['rolloutConfig']>,
      ) => number;
      shouldUseShadowMode: (
        context: SecurityPipelineConfig['context'],
        config: NonNullable<SecurityPipelineConfig['rolloutConfig']>,
      ) => boolean;
    };
    effectiveVersion = featureFlagsModule.resolvePipelineVersion(
      config.context,
      config.rolloutConfig,
    );
    effectiveShadowMode = featureFlagsModule.shouldUseShadowMode(
      config.context,
      config.rolloutConfig,
    );
  }

  // Применяем runtime overrides (приоритет над feature flags)
  const overrideResult = applyRuntimeOverrides(
    {
      version: effectiveVersion,
      shadowMode: effectiveShadowMode,
      remoteRiskProvider: effectiveRemoteProvider,
      failClosed: effectiveFailClosed,
    },
    runtimeOverrides,
  );

  // Логируем применение overrides (для audit trail)
  if (config.logger && overrideResult.applied) {
    logRuntimeOverrides(runtimeOverrides, overrideResult, (message, data) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- logger.warn может быть undefined
      config.logger?.warn?.(message, data);
    });
  }

  // Обновляем значения из override result
  effectiveVersion = overrideResult.version;
  effectiveShadowMode = overrideResult.shadowMode;
  effectiveRemoteProvider = overrideResult.remoteRiskProvider;
  effectiveFailClosed = overrideResult.failClosed;

  // Создаем конфигурацию с примененными feature flags и overrides
  // Используем условное добавление свойств для соответствия exactOptionalPropertyTypes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- remoteRiskProvider удаляется для применения override
  const { remoteRiskProvider: _removed, ...configWithoutRemoteProvider } = config;
  const configWithFeatureFlags: SecurityPipelineConfig = {
    ...configWithoutRemoteProvider,
    version: effectiveVersion,
    shadowMode: effectiveShadowMode,
    ...(effectiveRemoteProvider !== undefined && { remoteRiskProvider: effectiveRemoteProvider }),
    failClosed: effectiveFailClosed,
  };

  // effectiveVersion всегда определен после applyRuntimeOverrides
  const builder = selectPipelineBuilder(effectiveVersion, config.logger, environment);
  return builder(configWithFeatureFlags);
}

/**
 * Выбирает pipeline builder по версии с fallback на последнюю версию
 * @note Backward compatibility: если версия не найдена, используется последняя версия
 * @note Internal API - используется только внутри engine
 */
function selectPipelineBuilder(
  version: number | undefined,
  logger?: PipelineLogger,
  environment?: PipelineEnvironment,
): PipelineBuilder {
  const effectiveVersion = version ?? SecurityPipelineVersion;
  // eslint-disable-next-line security/detect-object-injection -- Version controlled, safe access
  const builder = pipelineRegistry[effectiveVersion];

  // Fallback на последнюю версию если версия не найдена
  if (builder === undefined) {
    const latestVersion = SecurityPipelineVersion;
    if (logger?.warn && environment?.mode === 'development') {
      logger.warn(
        `[security-pipeline] Version ${effectiveVersion} not found, falling back to version ${latestVersion}`,
      );
    }
    // eslint-disable-next-line security/detect-object-injection -- Version constant, safe access
    const fallbackBuilder = pipelineRegistry[latestVersion];
    if (fallbackBuilder === undefined) {
      throw new Error(
        `[security-pipeline] No pipeline builder found for version ${latestVersion}`,
      );
    }
    return fallbackBuilder;
  }

  // Логируем использование не-последней версии в development
  if (
    effectiveVersion !== SecurityPipelineVersion
    && logger?.warn
    && environment?.mode === 'development'
  ) {
    logger.warn(
      `[security-pipeline] Using version ${effectiveVersion} (latest: ${SecurityPipelineVersion})`,
    );
  }

  return builder;
}
