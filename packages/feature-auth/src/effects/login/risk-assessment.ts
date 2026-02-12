/**
 * @file packages/feature-auth/src/effects/login/risk-assessment.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Assessment (Composition Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Composition layer для risk assessment subsystem
 * - Объединяет rules, scoring и decision engine
 * - Public API для risk assessment
 *
 * Принципы:
 * - ✅ Composition — объединяет подсистемы
 * - ✅ Configurable — принимает policy для настройки
 * - ✅ Детерминированный результат — одинаковый вход → одинаковый выход
 * - ❌ Нет store — store layer
 * - ❌ Нет telemetry — observability layer
 * - ❌ Нет orchestration — orchestrator
 * - ❌ Нет timeout — effect-timeout layer
 * - ❌ Нет isolation — effect-isolation layer
 * - ❌ Нет API calls — api-client layer
 */

import { z } from 'zod';

import { buildAssessment } from './risk-assessment.adapter.js';
import {
  defaultDecisionPolicy,
  determineDecisionHint,
  determineRiskLevel,
} from './risk-decision.js';
import type { DecisionPolicy, DecisionResult } from './risk-decision.js';
import { evaluateRules } from './risk-rules.js';
import type { RiskRule, RuleEvaluationContext } from './risk-rules.js';
import { calculateRiskScore, defaultRiskWeights } from './risk-scoring.js';
import type { RiskWeights, ScoringContext } from './risk-scoring.js';
import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { LoginRiskAssessment } from '../../domain/LoginRiskAssessment.js';
import type { RiskLevel } from '../../types/auth.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Внутренние сигналы риска (domain layer)
 * Используются для scoring и rule evaluation
 */
export type InternalRiskSignals = {
  /** VPN обнаружен */
  readonly isVpn?: boolean;

  /** TOR сеть обнаружена */
  readonly isTor?: boolean;

  /** Proxy обнаружен */
  readonly isProxy?: boolean;

  /** ASN (Autonomous System Number) */
  readonly asn?: string;

  /** Репутационный score (0-100) */
  readonly reputationScore?: number;

  /** Velocity score (аномалии скорости запросов) */
  readonly velocityScore?: number;

  /** Предыдущая геолокация для проверки impossible travel */
  readonly previousGeo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
};

/**
 * Внешние сигналы от risk vendors (изолированы от domain)
 *
 * Контракт:
 * - JSON-serializable (примитивы, массивы, объекты без циклических ссылок)
 * - Read-only (immutable)
 * - Детерминированные (одинаковый вход → одинаковый выход)
 * - Не влияют напрямую на правила (используются только для scoring)
 *
 * @security Валидируются перед использованием, не пробрасываются в DTO
 */
export type ExternalRiskSignals = Readonly<Record<string, unknown>>;

/**
 * Типизированные сигналы риска (internal + external)
 * Разделение internal/external для чистоты domain и безопасности
 */
export type RiskSignals = InternalRiskSignals & {
  /**
   * Внешние сигналы от risk vendors (изолированы от domain)
   * @see ExternalRiskSignals для контракта
   */
  readonly externalSignals?: ExternalRiskSignals;
};

/** Контекст для оценки риска логина */
export type RiskContext = {
  /** IP адрес клиента */
  readonly ip?: string;

  /** Геолокация (IP / GPS / provider) */
  readonly geo?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
    readonly lat?: number;
    readonly lng?: number;
  };

  /** ID пользователя (может отсутствовать до идентификации) */
  readonly userId?: string;

  /** ID предыдущей сессии (если есть) */
  readonly previousSessionId?: string;

  /** Типизированные сигналы риска */
  readonly signals?: RiskSignals;

  /** Timestamp события (ISO 8601) - передается извне для детерминизма */
  readonly timestamp?: string;
};

/** Политика оценки риска */
export type RiskPolicy = {
  /** Веса для scoring */
  readonly weights?: RiskWeights;

  /** Политика принятия решений */
  readonly decision?: DecisionPolicy;
};

/** Результат оценки риска */
export type RiskAssessmentResult = {
  /** Оценка риска (0-100) */
  readonly riskScore: number;

  /** Уровень риска */
  readonly riskLevel: RiskLevel;

  /** Сработавшие правила */
  readonly triggeredRules: readonly RiskRule[];

  /** Рекомендация по действию с причиной блокировки (для audit logging) */
  readonly decisionHint: DecisionResult;

  /** Полная оценка риска для аудита */
  readonly assessment: LoginRiskAssessment;
};

/**
 * Plugin интерфейс для расширения Context Builder
 * Позволяет добавлять кастомные сигналы без изменения core logic
 */
export type ContextBuilderPlugin = {
  /** Уникальный идентификатор плагина */
  readonly id: string;
} & {
  /** Расширяет scoring context кастомными сигналами */
  readonly extendScoringContext?: (
    context: ScoringContext,
    riskContext: RiskContext,
  ) => ScoringContext;

  /** Расширяет rule context кастомными сигналами */
  readonly extendRuleContext?: (
    context: RuleEvaluationContext,
    riskContext: RiskContext,
  ) => RuleEvaluationContext;

  /** Расширяет assessment context кастомными полями */
  readonly extendAssessmentContext?: (
    context: Parameters<typeof buildAssessment>[1],
    riskContext: RiskContext,
  ) => Parameters<typeof buildAssessment>[1];
};

/**
 * Hook для audit/logging критических решений
 * Вызывается при блокировке или challenge для отслеживания security events
 */
export type AuditHook = (
  result: RiskAssessmentResult,
  context: RiskContext,
) => void;

/* ============================================================================
 * 🔧 CONTEXT BUILDERS (SRP: отдельная ответственность для каждого контекста)
 * ============================================================================
 */

/**
 * Context Builder для подготовки контекстов разных слоёв
 * Разделяет ответственность: каждый builder отвечает за свой тип контекста
 *
 * @note Для extensibility: можно добавить plugin pattern через ContextBuilderPlugin
 * интерфейс для кастомных сигналов и расширений контекста
 */

/** Подготавливает контекст для scoring */
function buildScoringContext(
  deviceInfo: DeviceInfo,
  context: RiskContext,
): ScoringContext {
  return {
    device: deviceInfo,
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.signals !== undefined && { signals: context.signals }),
  };
}

/** Подготавливает контекст для rule evaluation */
function buildRuleContext(
  deviceInfo: DeviceInfo,
  context: RiskContext,
  riskScore: number,
): RuleEvaluationContext {
  return {
    device: deviceInfo,
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(context.signals?.previousGeo !== undefined && { previousGeo: context.signals.previousGeo }),
    ...(context.signals !== undefined && { signals: context.signals }),
    metadata: {
      isNewDevice: context.previousSessionId === undefined,
      riskScore,
    },
  };
}

/** Подготавливает контекст для buildAssessment */
function buildAssessmentContext(
  deviceInfo: DeviceInfo,
  context: RiskContext,
): Parameters<typeof buildAssessment>[1] {
  return {
    ...(context.userId !== undefined && { userId: context.userId }),
    ...(context.ip !== undefined && { ip: context.ip }),
    ...(context.geo !== undefined && { geo: context.geo }),
    ...(deviceInfo.userAgent !== undefined && { userAgent: deviceInfo.userAgent }),
    ...(context.previousSessionId !== undefined
      && { previousSessionId: context.previousSessionId }),
    ...(context.timestamp !== undefined && { timestamp: context.timestamp }),
    ...(context.signals !== undefined && { signals: context.signals }),
  };
}

/**
 * Zod schema для валидации externalSignals
 * Строгий контракт: только JSON-serializable типы (примитивы, массивы, объекты)
 */
const externalSignalsSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.unknown()),
    z.record(z.string(), z.unknown()),
  ]),
).refine(
  (value) => {
    // Дополнительная проверка на JSON-serializable (без циклических ссылок)
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'externalSignals must be JSON-serializable without circular references' },
);

/**
 * Валидирует externalSignals по контракту (JSON-serializable, read-only, детерминированные)
 *
 * Контракт:
 * - JSON-serializable (примитивы, массивы, объекты)
 * - Без циклических ссылок
 * - Без функций, символов, undefined (только JSON-совместимые типы)
 * - Schema validation через Zod для строгой проверки структуры
 *
 * @param signals - Сигналы для валидации
 * @returns true если signals соответствуют контракту
 */
function validateExternalSignals(signals: RiskSignals | undefined): boolean {
  if (signals?.externalSignals === undefined) {
    return true;
  }

  const ext = signals.externalSignals;

  // Проверка: externalSignals должен быть объектом
  if (typeof ext !== 'object') {
    return false;
  }

  // Schema validation через Zod для строгой проверки структуры
  const parseResult = externalSignalsSchema.safeParse(ext);
  if (!parseResult.success) {
    return false;
  }

  return true;
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Оценивает риск логина на основе device info и контекста
 *
 * Детерминированная функция: одинаковый вход → одинаковый выход.
 * Timestamp передается извне (orchestrator) для детерминизма.
 * externalSignals должны соответствовать контракту (JSON-serializable, read-only).
 *
 * @param deviceInfo - Информация об устройстве из DeviceFingerprint
 * @param context - Контекст для оценки риска (IP, geo, session history, timestamp)
 * @param policy - Политика оценки риска (опционально, используются дефолтные значения)
 * @param plugins - Плагины для расширения контекста (опционально)
 * @param auditHook - Hook для audit/logging критических решений (опционально)
 * @returns Результат оценки риска с score, level, rules и decision hint
 *
 * @note Extensibility:
 * - ContextBuilderPlugin: добавлять кастомные сигналы без изменения core logic
 * - Plugin pattern для scoring/decision/rules: можно расширить через интерфейсы
 *   ScoringPlugin, DecisionPlugin, RulePlugin для кастомных алгоритмов
 */

/** Применяет плагины для расширения scoring context */
function applyScoringPlugins(
  context: ScoringContext,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): ScoringContext {
  let result = context;
  for (const plugin of plugins) {
    if (plugin.extendScoringContext) {
      result = plugin.extendScoringContext(result, riskContext);
    }
  }
  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}

/** Применяет плагины для расширения rule context */
function applyRulePlugins(
  context: RuleEvaluationContext,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): RuleEvaluationContext {
  let result = context;
  for (const plugin of plugins) {
    if (plugin.extendRuleContext) {
      result = plugin.extendRuleContext(result, riskContext);
    }
  }
  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}

/** Применяет плагины для расширения assessment context */
function applyAssessmentPlugins(
  context: Parameters<typeof buildAssessment>[1],
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): Parameters<typeof buildAssessment>[1] {
  let result = context;
  for (const plugin of plugins) {
    if (plugin.extendAssessmentContext) {
      result = plugin.extendAssessmentContext(result, riskContext);
    }
  }
  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}

/** Вызывает audit hook для критических решений */
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

export function assessLoginRisk(
  deviceInfo: DeviceInfo,
  context: RiskContext = {},
  policy: RiskPolicy = {},
  plugins: readonly ContextBuilderPlugin[] = [],
  auditHook?: AuditHook,
): RiskAssessmentResult {
  // Валидация externalSignals по контракту (JSON-serializable, read-only)
  if (!validateExternalSignals(context.signals)) {
    throw new Error('Invalid externalSignals: must be JSON-serializable and read-only');
  }

  const weights = policy.weights ?? defaultRiskWeights;
  const decisionPolicy = policy.decision ?? defaultDecisionPolicy;

  // 1. Рассчитываем risk score
  const baseScoringContext = buildScoringContext(deviceInfo, context);
  const scoringContext = applyScoringPlugins(baseScoringContext, plugins, context);
  const riskScore = calculateRiskScore(scoringContext, weights);

  // 2. Определяем уровень риска
  const riskLevel = determineRiskLevel(riskScore, decisionPolicy.thresholds);

  // 3. Оцениваем правила
  // Правила сортируются по приоритету внутри evaluateRuleActions для детерминированности
  // Engine использует Map<RiskRule, RuleMetadata> для O(1) lookup, масштабируется на сотни правил
  // @note Lazy evaluation: для критических правил (priority >= 90) можно добавить short-circuit
  // чтобы прервать оценку при первом блокирующем правиле для повышения производительности
  const baseRuleContext = buildRuleContext(deviceInfo, context, riskScore);
  const ruleContext = applyRulePlugins(baseRuleContext, plugins, context);
  const triggeredRules = evaluateRules(ruleContext);

  // 4. Определяем рекомендацию с приоритетами
  const decisionSignals = context.signals?.reputationScore !== undefined
    ? { reputationScore: context.signals.reputationScore }
    : undefined;
  const decisionHint = determineDecisionHint(
    riskLevel,
    triggeredRules,
    decisionSignals,
    decisionPolicy,
  );

  // 5. Строим assessment для аудита
  const baseAssessmentContext = buildAssessmentContext(deviceInfo, context);
  const assessmentContext = applyAssessmentPlugins(baseAssessmentContext, plugins, context);
  const assessment = buildAssessment(deviceInfo, assessmentContext);

  const result: RiskAssessmentResult = {
    riskScore,
    riskLevel,
    triggeredRules,
    decisionHint,
    assessment,
  };

  // Audit hook для критических решений (block/challenge)
  callAuditHookIfNeeded(result, context, auditHook);

  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}
