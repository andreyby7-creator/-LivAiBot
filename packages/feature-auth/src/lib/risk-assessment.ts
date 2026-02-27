/**
 * @file packages/feature-auth/src/lib/risk-assessment.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Assessment (Composition Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Composition layer: адаптирует feature-auth типы к domains API
 * - Вызывает assessClassification из @livai/domains/classification/strategies/assessment для полной orchestration
 * - Маппит результаты в auth-specific decision и domain объекты (LoginRiskEvaluation)
 *
 * Принципы:
 * - ✅ Composition — делегирует orchestration в domains
 * - ✅ Adapter — адаптирует типы между feature-auth и domains
 * - ✅ Детерминированный результат — одинаковый вход → одинаковый выход
 * - ✅ Domain purity — вся логика (scoring, rules, risk level) в domains
 * - ❌ Нет store, telemetry, orchestration, timeout, isolation, API calls
 *
 * @note Импорты из @livai/domains:
 *       - Типы из @livai/domains/classification (ClassificationContext, ClassificationPolicy, etc.)
 *       - assessClassification из @livai/domains/classification/strategies/assessment
 *       - defaultDecisionPolicy из @livai/domains/classification/policies
 */

import type { ScoringContext as DomainScoringContext } from '@livai/domains/aggregation';
import { defaultDecisionPolicy } from '@livai/domains/policies';
import type { ClassificationContext } from '@livai/domains/signals';
import { assessClassification } from '@livai/domains/strategies';
import type {
  ClassificationPolicy,
  ContextBuilderPlugin as DomainContextBuilderPlugin,
  DeviceInfo as DomainDeviceInfo,
  RuleEvaluationContext as DomainRuleEvaluationContext,
} from '@livai/domains/strategies';

import { mapLabelToDecisionHint } from './classification-mapper.js';
import { buildAssessment } from './risk-assessment.adapter.js';
import type { DeviceInfo as AuthDeviceInfo } from '../domain/DeviceInfo.js';
import { DomainValidationError } from '../domain/LoginRiskAssessment.js';
import type {
  AuthRuleEvaluationContext,
  AuthScoringContext,
  ContextBuilderPlugin,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
} from '../types/auth-risk.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

// Реэкспорт типов из types/auth-risk.ts (единый источник истины)
export type {
  ContextBuilderPlugin,
  ExternalRiskSignals,
  InternalRiskSignals,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
  RiskSignals,
} from '../types/auth-risk.js';

/** Hook для audit/logging критических решений (block/challenge) */
export type AuditHook = (
  result: RiskAssessmentResult,
  context: RiskContext,
) => void;

/* ============================================================================
 * 🔧 MAPPING HELPERS
 * ============================================================================
 */

/** Маппинг DeviceInfo из feature-auth в domains формат */
function mapDeviceInfoToDomain(
  deviceInfo: AuthDeviceInfo,
): DomainDeviceInfo {
  return Object.freeze({
    deviceId: deviceInfo.deviceId,
    deviceType: deviceInfo.deviceType,
    ...(deviceInfo.os !== undefined && { os: deviceInfo.os }),
    ...(deviceInfo.browser !== undefined && { browser: deviceInfo.browser }),
    ...(deviceInfo.userAgent !== undefined && { userAgent: deviceInfo.userAgent }),
  });
}

/**
 * Маппинг device из AuthScoringContext/AuthRuleEvaluationContext в DomainDeviceInfo
 * @note device в auth-контекстах опционален и имеет другую структуру (platform, fingerprint)
 */
/** Константы для генерации уникального fallback deviceId */
const TIMESTAMP_HASH_LENGTH = 8; // Длина хеша из timestamp (достаточно для уникальности)
const RANDOM_ID_BASE = 36; // Основание системы счисления для случайного ID (base36: 0-9, a-z)
const RANDOM_ID_START = 2; // Начальная позиция в строке (пропускаем "0.")
const RANDOM_ID_LENGTH = 10; // Длина случайного ID

/**
 * Генерирует уникальный fallback deviceId для предотвращения clustering эффекта
 * @note Используется когда deviceId отсутствует, чтобы избежать слияния всех unknown устройств в одну корзину
 * @note Приоритет: userId > previousSessionId > temporaryId (на основе timestamp)
 */
function generateUniqueDeviceIdFallback(options: {
  readonly userId?: string;
  readonly previousSessionId?: string;
  readonly timestamp?: string;
}): string {
  // Приоритет 1: userId (если доступен)
  if (options.userId !== undefined && options.userId !== '') {
    return `user:${options.userId}`;
  }

  // Приоритет 2: previousSessionId (если доступен)
  if (options.previousSessionId !== undefined && options.previousSessionId !== '') {
    return `session:${options.previousSessionId}`;
  }

  // Приоритет 3: temporaryId на основе timestamp (если доступен)
  if (options.timestamp !== undefined && options.timestamp !== '') {
    // Используем первые N символов timestamp для уникальности (достаточно для предотвращения clustering)
    const timestampHash = options.timestamp.slice(0, TIMESTAMP_HASH_LENGTH).replace(
      /[^a-zA-Z0-9]/g,
      '',
    );
    return `temp:${timestampHash}`;
  }

  // Fallback: генерируем случайный идентификатор (крайне редкий случай)
  // Используем короткий префикс для отличия от реальных deviceId
  return `temp:${
    Math.random().toString(RANDOM_ID_BASE).substring(
      RANDOM_ID_START,
      RANDOM_ID_START + RANDOM_ID_LENGTH,
    )
  }`;
}

/**
 * Маппинг device из auth-контекстов в DomainDeviceInfo
 * @note Если deviceId отсутствует → генерируется уникальный fallback на основе userId/sessionId/timestamp
 *       Это предотвращает clustering эффект: все unknown устройства не сливаются в одну корзину
 *       при использовании deviceId для группировки в risk engine
 */
function mapAuthDeviceToDomain(
  device: AuthScoringContext['device'] | AuthRuleEvaluationContext['device'] | undefined,
  fallbackOptions?: {
    readonly userId?: string;
    readonly previousSessionId?: string;
    readonly timestamp?: string;
  },
): DomainDeviceInfo {
  if (device === undefined) {
    const fallbackId = fallbackOptions
      ? generateUniqueDeviceIdFallback(fallbackOptions)
      : 'unknown'; // Крайний fallback, если нет контекста

    return Object.freeze({
      deviceId: fallbackId,
      deviceType: 'unknown',
    });
  }

  // Маппим platform в deviceType
  let deviceType: DomainDeviceInfo['deviceType'] = 'unknown';
  if (device.platform === 'ios' || device.platform === 'android') {
    deviceType = 'mobile';
  } else if (device.platform === 'desktop') {
    deviceType = 'desktop';
  }

  // Если deviceId отсутствует, используем fallback
  const deviceId = device.deviceId ?? (fallbackOptions
    ? generateUniqueDeviceIdFallback(fallbackOptions)
    : 'unknown');

  return Object.freeze({
    deviceId,
    deviceType,
    ...(device.os !== undefined && { os: device.os }),
    ...(device.browser !== undefined && { browser: device.browser }),
  });
}

/**
 * Базовые поля signals (общие для RiskSignals и ClassificationSignals)
 * @note evaluationLevel и confidence исключены - они добавляются в domains
 */
type BaseSignalsFields = {
  readonly isVpn?: boolean;
  readonly isTor?: boolean;
  readonly isProxy?: boolean;
  readonly asn?: string;
  readonly reputationScore?: number;
  readonly velocityScore?: number;
  readonly previousGeo?: unknown;
  readonly externalSignals?: unknown;
};

/**
 * Унифицированная функция для маппинга базовых полей signals
 * @note Маппит только базовые поля, исключая evaluationLevel и confidence
 *       Используется для обоих направлений: RiskContext ↔ ClassificationContext
 */
function mapBaseSignalsFields<T extends BaseSignalsFields>(
  signals: T | undefined,
): Pick<T, keyof BaseSignalsFields> | undefined {
  if (signals === undefined) {
    return undefined;
  }

  return {
    ...(signals.isVpn !== undefined && { isVpn: signals.isVpn }),
    ...(signals.isTor !== undefined && { isTor: signals.isTor }),
    ...(signals.isProxy !== undefined && { isProxy: signals.isProxy }),
    ...(signals.asn !== undefined && { asn: signals.asn }),
    ...(signals.reputationScore !== undefined && {
      reputationScore: signals.reputationScore,
    }),
    ...(signals.velocityScore !== undefined && {
      velocityScore: signals.velocityScore,
    }),
    ...(signals.previousGeo !== undefined && {
      previousGeo: signals.previousGeo,
    }),
    ...(signals.externalSignals !== undefined && {
      externalSignals: signals.externalSignals,
    }),
  } as Pick<T, keyof BaseSignalsFields>;
}

/**
 * Маппинг signals из RiskContext в ClassificationContext
 * @note Маппит только базовые поля, без evaluationLevel и confidence (они добавляются в domains)
 */
function mapRiskSignalsToClassificationSignals(
  signals: RiskContext['signals'],
): ClassificationContext['signals'] | undefined {
  return mapBaseSignalsFields(signals) as ClassificationContext['signals'] | undefined;
}

/**
 * Маппинг signals из ClassificationContext в RiskContext
 * @note Маппит все поля, включая evaluationLevel и confidence (если они есть)
 *       Используется для адаптации плагинов domains → feature-auth
 */
function mapSignalsFields<
  T extends BaseSignalsFields & {
    readonly evaluationLevel?: unknown;
    readonly confidence?: unknown;
  },
>(
  signals: T | undefined,
): T | undefined {
  if (signals === undefined) {
    return undefined;
  }

  // Маппим базовые поля + evaluationLevel и confidence (если есть)
  const baseFields = mapBaseSignalsFields(signals);
  if (baseFields === undefined) {
    return undefined;
  }

  return {
    ...baseFields,
    ...(signals.evaluationLevel !== undefined && {
      evaluationLevel: signals.evaluationLevel,
    }),
    ...(signals.confidence !== undefined && {
      confidence: signals.confidence,
    }),
  } as T;
}

/** Маппинг RiskContext в ClassificationContext для assessClassification */
function mapRiskContextToClassificationContext(
  context: RiskContext,
): ClassificationContext {
  const mappedSignals = context.signals !== undefined
    ? mapRiskSignalsToClassificationSignals(context.signals)
    : undefined;

  return {
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(context.userId !== undefined && { userId: context.userId }),
    ...(context.previousSessionId !== undefined
      && { previousSessionId: context.previousSessionId }),
    ...(context.timestamp !== undefined && { timestamp: context.timestamp }),
    ...(mappedSignals !== undefined && { signals: mappedSignals }),
  };
}

/**
 * Маппинг RiskPolicy в ClassificationPolicy
 * @note DecisionPolicy из feature-auth несовместим с domains, используется дефолтная
 */
function mapRiskPolicyToClassificationPolicy(
  policy: RiskPolicy,
): ClassificationPolicy {
  return {
    ...(policy.weights !== undefined && { weights: policy.weights }),
  };
}

/** Маппинг signals из ClassificationContext в RiskContext (для адаптации плагинов) */
function mapClassificationSignalsToRiskSignals(
  signals: ClassificationContext['signals'],
): RiskContext['signals'] | undefined {
  return mapSignalsFields(signals);
}

/**
 * Маппинг ClassificationContext в RiskContext для адаптации плагинов
 * @note Плагины feature-auth работают с RiskContext, плагины domains - с ClassificationContext
 */
function mapClassificationContextToRiskContext(
  classificationContext: ClassificationContext,
): RiskContext {
  const mappedSignals = classificationContext.signals !== undefined
    ? mapClassificationSignalsToRiskSignals(classificationContext.signals)
    : undefined;

  return {
    ...(classificationContext.ip !== undefined && { ip: classificationContext.ip }),
    ...(classificationContext.geo !== undefined && { geo: classificationContext.geo }),
    ...(classificationContext.userId !== undefined && { userId: classificationContext.userId }),
    ...(classificationContext.previousSessionId !== undefined && {
      previousSessionId: classificationContext.previousSessionId,
    }),
    ...(classificationContext.timestamp !== undefined
      && { timestamp: classificationContext.timestamp }),
    ...(mappedSignals !== undefined && { signals: mappedSignals }),
  };
}

/** Маппинг ScoringContext из domains в feature-auth формат (для плагинов) */
function mapDomainScoringContextToAuth(
  scoringContext: DomainScoringContext,
): AuthScoringContext {
  return {
    device: scoringContext.device,
    ...(scoringContext.geo !== undefined && { geo: scoringContext.geo }),
    ...(scoringContext.ip !== undefined && { ip: scoringContext.ip }),
    ...(scoringContext.signals !== undefined && {
      signals: {
        ...(scoringContext.signals.isVpn !== undefined && { isVpn: scoringContext.signals.isVpn }),
        ...(scoringContext.signals.isTor !== undefined && { isTor: scoringContext.signals.isTor }),
        ...(scoringContext.signals.isProxy !== undefined
          && { isProxy: scoringContext.signals.isProxy }),
        ...(scoringContext.signals.reputationScore !== undefined && {
          reputationScore: scoringContext.signals.reputationScore,
        }),
        ...(scoringContext.signals.velocityScore !== undefined && {
          velocityScore: scoringContext.signals.velocityScore,
        }),
        ...(scoringContext.signals.previousGeo !== undefined && {
          previousGeo: scoringContext.signals.previousGeo,
        }),
      },
    }),
  };
}

/** Маппинг ScoringContext из feature-auth обратно в domains формат */
function mapAuthScoringContextToDomain(
  scoringContext: AuthScoringContext,
  fallbackOptions?: {
    readonly userId?: string;
    readonly previousSessionId?: string;
    readonly timestamp?: string;
  },
): DomainScoringContext {
  const mappedSignals = scoringContext.signals !== undefined
    ? {
      ...(scoringContext.signals.isVpn !== undefined && { isVpn: scoringContext.signals.isVpn }),
      ...(scoringContext.signals.isTor !== undefined && { isTor: scoringContext.signals.isTor }),
      ...(scoringContext.signals.isProxy !== undefined
        && { isProxy: scoringContext.signals.isProxy }),
      ...(scoringContext.signals.reputationScore !== undefined && {
        reputationScore: scoringContext.signals.reputationScore,
      }),
      ...(scoringContext.signals.velocityScore !== undefined && {
        velocityScore: scoringContext.signals.velocityScore,
      }),
      ...(scoringContext.signals.previousGeo !== undefined && {
        previousGeo: scoringContext.signals.previousGeo,
      }),
    }
    : undefined;

  // device обязателен в DomainScoringContext, но опционален в AuthScoringContext
  // Используем fallbackOptions для генерации уникального deviceId при отсутствии deviceId
  const device = mapAuthDeviceToDomain(scoringContext.device, fallbackOptions);

  return {
    device,
    ...(scoringContext.geo !== undefined && { geo: scoringContext.geo }),
    ...(scoringContext.ip !== undefined && { ip: scoringContext.ip }),
    ...(mappedSignals !== undefined && { signals: mappedSignals }),
  };
}

/**
 * Создает адаптер для extendScoringContext плагина
 * Адаптирует сигнатуры: domains → feature-auth → плагин → domains
 */
function createScoringContextAdapter(
  extendScoringContext: NonNullable<ContextBuilderPlugin['extendScoringContext']>,
): NonNullable<DomainContextBuilderPlugin['extendScoringContext']> {
  return (
    scoringContext: DomainScoringContext,
    classificationContext: ClassificationContext,
  ): Readonly<DomainScoringContext> => {
    const authScoringContext = mapDomainScoringContextToAuth(scoringContext);
    const riskContext = mapClassificationContextToRiskContext(classificationContext);
    const extendedAuthContext = extendScoringContext(authScoringContext, riskContext);
    // Передаем fallbackOptions из classificationContext для генерации уникального deviceId
    const fallbackOptions: {
      readonly userId?: string;
      readonly previousSessionId?: string;
      readonly timestamp?: string;
    } = {
      ...(classificationContext.userId !== undefined && { userId: classificationContext.userId }),
      ...(classificationContext.previousSessionId !== undefined && {
        previousSessionId: classificationContext.previousSessionId,
      }),
      ...(classificationContext.timestamp !== undefined && {
        timestamp: classificationContext.timestamp,
      }),
    };
    return mapAuthScoringContextToDomain(extendedAuthContext, fallbackOptions);
  };
}

/**
 * Маппинг rule signals (без previousGeo и externalSignals)
 * Используется для RuleEvaluationContext между domains и feature-auth
 */
function mapRuleSignalsFields<
  T extends {
    isVpn?: boolean;
    isTor?: boolean;
    isProxy?: boolean;
    reputationScore?: number;
    velocityScore?: number;
  },
>(
  signals: T | undefined,
): T | undefined {
  if (signals === undefined) {
    return undefined;
  }

  return {
    ...(signals.isVpn !== undefined && { isVpn: signals.isVpn }),
    ...(signals.isTor !== undefined && { isTor: signals.isTor }),
    ...(signals.isProxy !== undefined && { isProxy: signals.isProxy }),
    ...(signals.reputationScore !== undefined && {
      reputationScore: signals.reputationScore,
    }),
    ...(signals.velocityScore !== undefined && {
      velocityScore: signals.velocityScore,
    }),
  } as T;
}

/** Маппинг RuleEvaluationContext из domains в feature-auth формат (для плагинов) */
function mapDomainRuleContextToAuth(
  ruleContext: DomainRuleEvaluationContext,
): AuthRuleEvaluationContext {
  const mappedSignals = mapRuleSignalsFields(ruleContext.signals);

  return {
    device: ruleContext.device,
    ...(ruleContext.geo !== undefined && { geo: ruleContext.geo }),
    ...(ruleContext.previousGeo !== undefined && { previousGeo: ruleContext.previousGeo }),
    ...(mappedSignals !== undefined && { signals: mappedSignals }),
    ...(ruleContext.metadata !== undefined && { metadata: ruleContext.metadata }),
  };
}

/**
 * Маппинг RuleEvaluationContext из feature-auth обратно в domains формат
 * @note Сохраняет userId из исходного контекста (feature-auth не поддерживает userId)
 */
function mapAuthRuleContextToDomain(
  ruleContext: AuthRuleEvaluationContext,
  originalUserId?: string,
  fallbackOptions?: {
    readonly previousSessionId?: string;
    readonly timestamp?: string;
  },
): DomainRuleEvaluationContext {
  const mappedSignals = mapRuleSignalsFields(ruleContext.signals);

  // device обязателен в DomainRuleEvaluationContext, но опционален в AuthRuleEvaluationContext
  // Используем originalUserId и fallbackOptions для генерации уникального deviceId при отсутствии deviceId
  const deviceFallbackOptions: {
    readonly userId?: string;
    readonly previousSessionId?: string;
    readonly timestamp?: string;
  } = {
    ...(originalUserId !== undefined && { userId: originalUserId }),
    ...fallbackOptions,
  };
  const device = mapAuthDeviceToDomain(ruleContext.device, deviceFallbackOptions);

  return {
    device,
    ...(ruleContext.geo !== undefined && { geo: ruleContext.geo }),
    ...(ruleContext.previousGeo !== undefined && { previousGeo: ruleContext.previousGeo }),
    ...(mappedSignals !== undefined && { signals: mappedSignals }),
    ...(ruleContext.metadata !== undefined && { metadata: ruleContext.metadata }),
    ...(originalUserId !== undefined && { userId: originalUserId }),
  };
}

/**
 * Создает адаптер для extendRuleContext плагина
 * Адаптирует сигнатуры: domains → feature-auth → плагин → domains
 */
function createRuleContextAdapter(
  extendRuleContext: NonNullable<ContextBuilderPlugin['extendRuleContext']>,
): NonNullable<DomainContextBuilderPlugin['extendRuleContext']> {
  return (
    ruleContext: DomainRuleEvaluationContext,
    classificationContext: ClassificationContext,
  ): Readonly<DomainRuleEvaluationContext> => {
    const authRuleContext = mapDomainRuleContextToAuth(ruleContext);
    const riskContext = mapClassificationContextToRiskContext(classificationContext);
    const extendedAuthContext = extendRuleContext(authRuleContext, riskContext);
    // Передаем fallbackOptions из classificationContext для генерации уникального deviceId
    const fallbackOptions: {
      readonly previousSessionId?: string;
      readonly timestamp?: string;
    } = {
      ...(classificationContext.previousSessionId !== undefined && {
        previousSessionId: classificationContext.previousSessionId,
      }),
      ...(classificationContext.timestamp !== undefined && {
        timestamp: classificationContext.timestamp,
      }),
    };
    return mapAuthRuleContextToDomain(extendedAuthContext, ruleContext.userId, fallbackOptions);
  };
}

/**
 * Маппинг ContextBuilderPlugin из feature-auth в domains формат
 * Адаптирует сигнатуры плагинов через адаптеры
 * @note extendAssessmentContext пропускается (несовместимые структуры)
 * @note id и priority игнорируются (domains использует version)
 */
function mapContextBuilderPlugins(
  plugins: readonly ContextBuilderPlugin[],
): readonly DomainContextBuilderPlugin[] {
  return plugins.map((plugin) => {
    const domainPlugin: DomainContextBuilderPlugin = {
      version: 1,
      ...(plugin.extendScoringContext && {
        extendScoringContext: createScoringContextAdapter(plugin.extendScoringContext),
      }),
      ...(plugin.extendRuleContext && {
        extendRuleContext: createRuleContextAdapter(plugin.extendRuleContext),
      }),
    };
    return domainPlugin;
  });
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/** Вызывает audit hook для критических решений (block/challenge) */
function callAuditHookIfNeeded(
  result: RiskAssessmentResult,
  context: RiskContext,
  auditHook?: AuditHook,
): void {
  if (auditHook && result.decisionHint.action === 'block') {
    auditHook(result, context);
  }
}

/**
 * Оценивает риск логина на основе device info и контекста
 * Детерминированная функция: одинаковый вход → одинаковый выход.
 * Использует assessClassification из domains для полной orchestration
 * (scoring, rule evaluation, risk level determination).
 * feature-auth адаптирует типы и маппит результаты в auth-specific decision.
 * @note Вся orchestration выполняется в domains, плагины добавляют кастомные сигналы
 */
export function assessLoginRisk(
  deviceInfo: AuthDeviceInfo, // Информация об устройстве
  context: RiskContext = {}, // Контекст оценки риска (IP, geo, session history, timestamp)
  policy: RiskPolicy = {}, // Политика оценки риска (опционально, используются дефолтные значения)
  plugins: readonly ContextBuilderPlugin[] = [], // Плагины для расширения контекста (адаптируются для domains)
  auditHook?: AuditHook, // Hook для audit/logging критических решений (block)
): RiskAssessmentResult { // Результат оценки риска с decision hint и LoginRiskEvaluation (domain object)
  // Fail-fast: валидация timestamp ДО вызова assessClassification
  // Это предотвращает выполнение дорогих операций (scoring, plugins) при невалидном входе
  if (context.timestamp === undefined) {
    throw new DomainValidationError(
      'Timestamp is required for deterministic risk assessment. RiskContext must include timestamp field (ISO 8601 string).',
      'timestamp',
      context.timestamp,
      'TIMESTAMP_REQUIRED',
    );
  }

  // Classification (получаем всё из domains)
  const domainDeviceInfo = mapDeviceInfoToDomain(deviceInfo);
  const classificationContext = mapRiskContextToClassificationContext(context);
  const classificationPolicy = mapRiskPolicyToClassificationPolicy(policy);
  const domainPlugins = mapContextBuilderPlugins(plugins);

  const classification = assessClassification(
    domainDeviceInfo,
    classificationContext,
    classificationPolicy,
    domainPlugins,
  );

  // Маппинг label → auth action
  const decisionSignals = context.signals?.reputationScore !== undefined
    ? { reputationScore: context.signals.reputationScore }
    : undefined;
  const decisionHint = mapLabelToDecisionHint(
    classification.label,
    classification.triggeredRules,
    classification.riskLevel,
    decisionSignals,
    defaultDecisionPolicy,
  );

  // Строгая нормализация timestamp на boundary
  // RiskContext.timestamp (ISO 8601 string) → buildAssessment ожидает string | number
  // buildAssessment выполнит строгую валидацию и нормализацию в epoch ms
  // Никакого Date.now(), никакого new Date() без проверки

  // Создание LoginRiskEvaluation через adapter (domain object)
  const assessment = buildAssessment({
    deviceInfo,
    context: {
      ...(context.userId !== undefined && { userId: context.userId }),
      ...(context.ip !== undefined && { ip: context.ip }),
      ...(context.geo !== undefined && { geo: context.geo }),
      ...(deviceInfo.userAgent !== undefined && { userAgent: deviceInfo.userAgent }),
      ...(context.previousSessionId !== undefined && {
        previousSessionId: context.previousSessionId,
      }),
      timestamp: context.timestamp, // ISO 8601 string - buildAssessment выполнит строгую нормализацию
    },
    classificationResult: {
      riskScore: classification.riskScore,
      riskLevel: classification.riskLevel,
      triggeredRules: classification.triggeredRules,
    },
  });

  /** Формирование результата: classification + decision + LoginRiskEvaluation (domain object) */
  const result: RiskAssessmentResult = {
    riskScore: classification.riskScore,
    riskLevel: classification.riskLevel,
    triggeredRules: classification.triggeredRules,
    decisionHint,
    assessment,
  };

  /** Audit hook для критических решений (block) перед возвратом результата */
  callAuditHookIfNeeded(result, context, auditHook);

  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result; // Результат оценки риска с decision hint и LoginRiskEvaluation (domain object)
}
