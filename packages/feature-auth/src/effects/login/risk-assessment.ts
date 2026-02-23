/**
 * @file packages/feature-auth/src/effects/login/risk-assessment.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Assessment (Composition Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Composition layer: адаптирует feature-auth типы к domains API
 * - Вызывает assessClassification из @livai/domains/classification/strategies/assessment для полной orchestration
 * - Маппит результаты в auth-specific decision и DTO
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

import type {
  ClassificationContext,
  ClassificationPolicy,
  ContextBuilderPlugin as DomainContextBuilderPlugin,
  DeviceInfo as DomainDeviceInfo,
  RuleEvaluationContext as DomainRuleEvaluationContext,
  ScoringContext as DomainScoringContext,
} from '@livai/domains';
import { assessClassification, defaultDecisionPolicy } from '@livai/domains';

import { mapLabelToDecisionHint } from './classification-mapper.js';
import { buildAssessment } from './login-risk-assessment.adapter.js';
import type { DeviceInfo as AuthDeviceInfo } from '../../domain/DeviceInfo.js';
import type {
  AuthRuleEvaluationContext,
  AuthScoringContext,
  ContextBuilderPlugin,
  RiskAssessmentResult,
  RiskContext,
  RiskPolicy,
} from '../../types/auth-risk.js';

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
} from '../../types/auth-risk.js';

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
function mapAuthDeviceToDomain(
  device: AuthScoringContext['device'] | AuthRuleEvaluationContext['device'] | undefined,
): DomainDeviceInfo {
  if (device === undefined) {
    return Object.freeze({
      deviceId: 'unknown',
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

  return Object.freeze({
    deviceId: device.deviceId ?? 'unknown',
    deviceType,
    ...(device.os !== undefined && { os: device.os }),
    ...(device.browser !== undefined && { browser: device.browser }),
  });
}

/**
 * Маппинг signals между RiskContext и ClassificationContext
 * Структура полей идентична, используется для обоих направлений
 */
function mapSignalsFields<
  T extends {
    isVpn?: boolean;
    isTor?: boolean;
    isProxy?: boolean;
    asn?: string;
    reputationScore?: number;
    velocityScore?: number;
    previousGeo?: unknown;
    externalSignals?: unknown;
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
  } as T;
}

/** Маппинг signals из RiskContext в ClassificationContext */
function mapRiskSignalsToClassificationSignals(
  signals: RiskContext['signals'],
): ClassificationContext['signals'] | undefined {
  if (signals === undefined) {
    return undefined;
  }

  // Маппим только базовые поля, без evaluationLevel и confidence (они добавляются в domains)
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
  };
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
  const device = mapAuthDeviceToDomain(scoringContext.device);

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
    return mapAuthScoringContextToDomain(extendedAuthContext);
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
): DomainRuleEvaluationContext {
  const mappedSignals = mapRuleSignalsFields(ruleContext.signals);

  // device обязателен в DomainRuleEvaluationContext, но опционален в AuthRuleEvaluationContext
  const device = mapAuthDeviceToDomain(ruleContext.device);

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
    return mapAuthRuleContextToDomain(extendedAuthContext, ruleContext.userId);
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
  auditHook?: AuditHook, // Hook для audit/logging критических решений (block/challenge)
): RiskAssessmentResult { // Результат оценки риска с decision hint и assessment DTO
  // Валидация выполняется внутри assessClassification
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

  // Assessment DTO
  const assessment = buildAssessment(deviceInfo, {
    ...(context.userId !== undefined && { userId: context.userId }),
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(deviceInfo.userAgent !== undefined && { userAgent: deviceInfo.userAgent }),
    ...(context.previousSessionId !== undefined && {
      previousSessionId: context.previousSessionId,
    }),
    ...(context.timestamp !== undefined && { timestamp: context.timestamp }),
    ...(context.signals !== undefined && { signals: context.signals }),
  });

  /** Формирование результата: classification + decision + assessment DTO */
  const result: RiskAssessmentResult = {
    riskScore: classification.riskScore,
    riskLevel: classification.riskLevel,
    triggeredRules: classification.triggeredRules,
    decisionHint,
    assessment,
  };

  /** Audit hook для критических решений (block/challenge) перед возвратом результата */
  callAuditHookIfNeeded(result, context, auditHook);

  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result; // Результат оценки риска с decision hint и assessment DTO
}
