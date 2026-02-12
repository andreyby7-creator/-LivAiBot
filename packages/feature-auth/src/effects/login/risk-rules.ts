/**
 * @file packages/feature-auth/src/effects/login/risk-rules.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Risk Rules (Data-Driven Rule Engine)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Declarative rule definitions для risk assessment
 * - Data-driven подход для масштабируемости
 * - OCP-compliant: добавление правил не меняет core engine
 *
 * Принципы:
 * - ✅ Declarative rules — правила как данные
 * - ✅ OCP — открыт для расширения, закрыт для модификации
 * - ✅ Single source of truth — каждое правило определено один раз
 * - ✅ Testable — правила легко тестировать изолированно
 */

import type { DeviceInfo } from '../../domain/DeviceInfo.js';
import type { GeoInfo } from '../../domain/LoginRiskAssessment.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Типизированные правила риска */
export type RiskRule =
  | 'UNKNOWN_DEVICE'
  | 'IoT_DEVICE'
  | 'MISSING_OS'
  | 'MISSING_BROWSER'
  | 'TOR_NETWORK'
  | 'VPN_DETECTED'
  | 'PROXY_DETECTED'
  | 'LOW_REPUTATION'
  | 'CRITICAL_REPUTATION'
  | 'HIGH_VELOCITY'
  | 'GEO_MISMATCH'
  | 'HIGH_RISK_COUNTRY'
  | 'HIGH_RISK_SCORE'
  | 'NEW_DEVICE_VPN'
  | 'IoT_TOR';

/** Сигналы риска (строго типизированные) */
export type RuleSignals = {
  readonly isVpn?: boolean;
  readonly isTor?: boolean;
  readonly isProxy?: boolean;
  readonly reputationScore?: number;
  readonly velocityScore?: number;
};

/** Метаданные контекста (строго типизированные) */
export type RuleContextMetadata = {
  readonly isNewDevice?: boolean;
  readonly riskScore?: number;
};

/** Контекст для оценки правил */
export type RuleEvaluationContext = {
  readonly device: DeviceInfo;
  readonly geo?: GeoInfo;
  readonly previousGeo?: GeoInfo;
  readonly signals?: RuleSignals;
  readonly metadata?: RuleContextMetadata;
};

/** Действие правила при срабатывании */
export type RuleAction = 'allow' | 'challenge' | 'block';

/** Конфигурация правила для decision engine */
export type RiskRuleConfig = {
  /** Идентификатор правила */
  readonly name: RiskRule;
  /** Действие при срабатывании правила */
  readonly action: RuleAction;
  /** Приоритет правила (выше = важнее) */
  readonly priority: number;
};

/** Метаданные правила */
export type RuleMetadata = {
  /** Влияние на score (0-100) */
  readonly scoreImpact?: number;

  /** Влияние на decision (если правило сработало) */
  readonly decisionImpact?: 'block' | 'challenge';

  /** Приоритет правила (выше = важнее) */
  readonly priority?: number;

  /** Опциональные теги для будущего расширения */
  readonly tags?: readonly string[];
};

/** Идентификатор правила */
export type RuleIdentifier = {
  /** Уникальный идентификатор правила */
  readonly id: RiskRule;
};

/** Функция оценки правила */
export type RuleEvaluator = {
  /** Функция оценки правила */
  readonly evaluate: (ctx: RuleEvaluationContext) => boolean;
};

/** Определение правила */
export type RuleDefinition = RuleIdentifier & RuleEvaluator;

/** Расширенное определение правила с метаданными */
export type ExtendedRuleDefinition = RuleDefinition & RuleMetadata;

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Пороги для правил */
const RULE_THRESHOLDS = {
  LOW_REPUTATION: 30,
  CRITICAL_REPUTATION: 10,
  HIGH_VELOCITY: 70,
  HIGH_RISK_SCORE: 80,
} as const;

/** Порог приоритета для критических правил (short-circuit evaluation) */
const CRITICAL_RULE_PRIORITY_THRESHOLD = 90;

/** Валидный диапазон для score (0-100) */
const SCORE_RANGE = {
  MIN: 0,
  MAX: 100,
} as const;

/** Список стран с высоким риском (immutable для безопасности) */
const HIGH_RISK_COUNTRIES: ReadonlySet<string> = Object.freeze(
  new Set([
    'KP', // North Korea
    'IR', // Iran
    'SY', // Syria
    // Можно расширить по необходимости
  ]),
);

/* ============================================================================
 * 🔧 VALIDATION UTILITIES
 * ============================================================================
 */

/** Валидирует score (0-100) */
function isValidScore(score: number | undefined | null): score is number {
  return (
    score !== undefined
    && score !== null
    && Number.isFinite(score)
    && score >= SCORE_RANGE.MIN
    && score <= SCORE_RANGE.MAX
  );
}

/** Проверяет, является ли устройство новым (treat as new если статус неизвестен) */
function isNewDevice(ctx: RuleEvaluationContext): boolean {
  if (ctx.metadata === undefined) {
    return true; // Если metadata отсутствует, считаем устройство новым
  }

  return ctx.metadata.isNewDevice === true || ctx.metadata.isNewDevice === undefined;
}

/** Безопасно получает signals из контекста */
function getSignals(ctx: RuleEvaluationContext): RuleSignals | undefined {
  return ctx.signals ?? undefined;
}

/** Валидирует metadata перед использованием (type guard) */
function isValidMetadata(
  metadata: RuleContextMetadata | undefined,
): metadata is RuleContextMetadata {
  return metadata !== undefined && typeof metadata === 'object';
}

/* ============================================================================
 * 🔧 DOMAIN MODULES: DEVICE RULES
 * ============================================================================
 */

/** Правила устройства */
const DEVICE_RULES: readonly ExtendedRuleDefinition[] = [
  {
    id: 'UNKNOWN_DEVICE',
    evaluate: (ctx): boolean => ctx.device.deviceType === 'unknown',
    scoreImpact: 40,
  },
  {
    id: 'IoT_DEVICE',
    evaluate: (ctx): boolean => ctx.device.deviceType === 'iot',
    scoreImpact: 30,
  },
  {
    id: 'MISSING_OS',
    evaluate: (ctx): boolean => ctx.device.os === undefined,
    scoreImpact: 20,
  },
  {
    id: 'MISSING_BROWSER',
    evaluate: (ctx): boolean => ctx.device.browser === undefined,
    scoreImpact: 15,
  },
] as const;

/* ============================================================================
 * 🔧 DOMAIN MODULES: NETWORK RULES
 * ============================================================================
 */

/** Сетевые правила */
const NETWORK_RULES: readonly ExtendedRuleDefinition[] = [
  {
    id: 'TOR_NETWORK',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      return signals?.isTor === true;
    },
    scoreImpact: 70,
    decisionImpact: 'block',
    priority: 100,
  },
  {
    id: 'VPN_DETECTED',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      return signals?.isVpn === true;
    },
    scoreImpact: 50,
  },
  {
    id: 'PROXY_DETECTED',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      return signals?.isProxy === true;
    },
    scoreImpact: 40,
  },
  {
    id: 'CRITICAL_REPUTATION',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      if (signals === undefined) {
        return false;
      }

      const reputationScore = signals.reputationScore;
      if (!isValidScore(reputationScore)) {
        return false;
      }

      return reputationScore < RULE_THRESHOLDS.CRITICAL_REPUTATION;
    },
    scoreImpact: 50,
    decisionImpact: 'block',
    priority: 90,
  },
  {
    id: 'LOW_REPUTATION',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      if (signals === undefined) {
        return false;
      }

      const reputationScore = signals.reputationScore;
      if (!isValidScore(reputationScore)) {
        return false;
      }

      return (
        reputationScore < RULE_THRESHOLDS.LOW_REPUTATION
        && reputationScore >= RULE_THRESHOLDS.CRITICAL_REPUTATION
      );
    },
    scoreImpact: 30,
  },
  {
    id: 'HIGH_VELOCITY',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      if (signals === undefined) {
        return false;
      }

      const velocityScore = signals.velocityScore;
      if (!isValidScore(velocityScore)) {
        return false;
      }

      return velocityScore > RULE_THRESHOLDS.HIGH_VELOCITY;
    },
    scoreImpact: 0, // Учитывается отдельно в velocity scoring
  },
] as const;

/* ============================================================================
 * 🔧 DOMAIN MODULES: GEO RULES
 * ============================================================================
 */

/** Географические правила */
const GEO_RULES: readonly ExtendedRuleDefinition[] = [
  {
    id: 'HIGH_RISK_COUNTRY',
    evaluate: (ctx): boolean => {
      if (ctx.geo?.country === undefined) {
        return false;
      }

      return HIGH_RISK_COUNTRIES.has(ctx.geo.country);
    },
    scoreImpact: 40,
    decisionImpact: 'challenge',
  },
  {
    id: 'GEO_MISMATCH',
    evaluate: (ctx): boolean => {
      const previousCountry = ctx.previousGeo?.country;
      const currentCountry = ctx.geo?.country;

      if (previousCountry === undefined || currentCountry === undefined) {
        return false;
      }

      return previousCountry !== currentCountry;
    },
    scoreImpact: 60,
    decisionImpact: 'challenge',
  },
] as const;

/* ============================================================================
 * 🔧 DOMAIN MODULES: COMPOSITE RULES
 * ============================================================================
 */

/** Композитные правила */
const COMPOSITE_RULES: readonly ExtendedRuleDefinition[] = [
  {
    id: 'IoT_TOR',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      return ctx.device.deviceType === 'iot' && signals?.isTor === true;
    },
    decisionImpact: 'block',
    priority: 95,
  },
  {
    id: 'NEW_DEVICE_VPN',
    evaluate: (ctx): boolean => {
      const signals = getSignals(ctx);
      return isNewDevice(ctx) && signals?.isVpn === true;
    },
    decisionImpact: 'challenge',
  },
  {
    id: 'HIGH_RISK_SCORE',
    evaluate: (ctx): boolean => {
      // Валидация metadata перед использованием для предотвращения poisoning
      // Источник: внутренняя валидация risk score (0-100)
      if (!isValidMetadata(ctx.metadata)) {
        return false;
      }

      const riskScore = ctx.metadata.riskScore;
      if (
        riskScore === undefined || !Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100
      ) {
        return false;
      }

      return riskScore >= RULE_THRESHOLDS.HIGH_RISK_SCORE;
    },
  },
] as const;

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/** Все правила (объединенный список) */
export const allRules: readonly ExtendedRuleDefinition[] = [
  ...DEVICE_RULES,
  ...NETWORK_RULES,
  ...GEO_RULES,
  ...COMPOSITE_RULES,
] as const;

/** @deprecated Используйте allRules */
export const AllRules = allRules;

/**
 * Индекс правил по ID для быстрого поиска O(1)
 * Поддерживает масштабирование на сотни правил через Map lookup
 *
 * @note Для динамических правил (JSON/DB): можно заменить allRules на функцию,
 * загружающую правила из внешнего источника, и пересоздавать rulesIndex при изменении конфигурации
 */
const rulesIndex: ReadonlyMap<RiskRule, ExtendedRuleDefinition> =
  ((): ReadonlyMap<RiskRule, ExtendedRuleDefinition> => {
    const map = new Map<RiskRule, ExtendedRuleDefinition>();

    for (const rule of allRules) {
      map.set(rule.id, rule);
    }

    return Object.freeze(map);
  })();

/**
 * Проверяет, является ли правило критическим
 */
function isCriticalRule(rule: ExtendedRuleDefinition): boolean {
  return rule.priority !== undefined && rule.priority >= CRITICAL_RULE_PRIORITY_THRESHOLD;
}

/**
 * Оценивает критические правила (priority >= 90) с short-circuit
 * Прерывает оценку при первом блокирующем правиле для улучшения latency
 *
 * @param ctx - Контекст оценки правил
 * @returns Сработавшие критические правила или пустой массив
 */
function evaluateCriticalRules(ctx: RuleEvaluationContext): readonly RiskRule[] {
  const triggered: RiskRule[] = [];

  for (const rule of allRules) {
    // Оцениваем только критические правила с блокирующим действием
    if (isCriticalRule(rule) && rule.evaluate(ctx)) {
      triggered.push(rule.id);

      // Short-circuit: если правило блокирующее, прерываем оценку
      if (rule.decisionImpact === 'block') {
        return triggered;
      }
    }
  }

  return triggered;
}

/** Оценивает все правила и возвращает сработавшие */
export function evaluateRules(ctx: RuleEvaluationContext): readonly RiskRule[] {
  const triggered: RiskRule[] = [];

  // Сначала проверяем критические правила с short-circuit
  const criticalRules = evaluateCriticalRules(ctx);
  triggered.push(...criticalRules);

  // Если найдено блокирующее критическое правило, возвращаем результат
  if (criticalRules.length > 0) {
    const hasBlockingRule = criticalRules.some((ruleId) => {
      const rule = rulesIndex.get(ruleId);
      return rule?.decisionImpact === 'block';
    });

    if (hasBlockingRule) {
      return triggered;
    }
  }

  // Оцениваем остальные правила (priority < CRITICAL_RULE_PRIORITY_THRESHOLD или без priority)
  for (const rule of allRules) {
    if (!isCriticalRule(rule) && rule.evaluate(ctx)) {
      triggered.push(rule.id);
    }
  }

  return triggered;
}

/** Получает определение правила по ID (O(1) через Map) */
export function getRuleDefinition(id: RiskRule): ExtendedRuleDefinition | undefined {
  return rulesIndex.get(id);
}

/** Получает правила с decision impact. O(n) где n = triggeredRules.length */
export function getRulesWithDecisionImpact(
  triggeredRules: readonly RiskRule[],
): readonly ExtendedRuleDefinition[] {
  const result: ExtendedRuleDefinition[] = [];

  for (const ruleId of triggeredRules) {
    const rule = rulesIndex.get(ruleId);
    if (rule?.decisionImpact !== undefined) {
      result.push(rule);
    }
  }

  // eslint-disable-next-line @livai/rag/source-citation -- Internal implementation, не требует внешнего источника
  return result;
}

/** Получает максимальный приоритет среди сработавших правил (0 если не заданы). O(n) */
export function getMaxPriority(triggeredRules: readonly RiskRule[]): number {
  let maxPriority = 0;

  for (const ruleId of triggeredRules) {
    const rule = rulesIndex.get(ruleId);
    if (rule?.priority !== undefined) {
      maxPriority = Math.max(maxPriority, rule.priority);
    }
  }

  return maxPriority;
}

/** Сортирует правила по приоритету (descending) для детерминированности. O(n log n) */
export function sortRulesByPriority(
  rules: readonly RiskRule[],
): readonly RiskRule[] {
  return [...rules].sort((a, b) => {
    const ruleA = rulesIndex.get(a);
    const ruleB = rulesIndex.get(b);
    const priorityA = ruleA?.priority ?? 0;
    const priorityB = ruleB?.priority ?? 0;
    return priorityB - priorityA; // descending
  });
}

/**
 * Оценивает действия правил: возвращает наиболее приоритетное (block > challenge)
 *
 * Чистая функция: нет side-effects, не зависит от policy. Детерминированная: порядок правил не важен.
 *
 * Приоритет правил внутри engine (для разработчиков):
 * 1. Правила сортируются по priority (descending) - правила с большим priority обрабатываются первыми
 * 2. action='block' получает базовый приоритет 1000 + rule.priority (всегда выше challenge)
 * 3. action='challenge' получает базовый приоритет 100 + rule.priority
 * 4. Возвращается действие с максимальным приоритетом
 *
 * Примеры приоритетов:
 * - TOR_NETWORK (priority: 100, action: 'block') → 1100
 * - CRITICAL_REPUTATION (priority: 90, action: 'block') → 1090
 * - IoT_TOR (priority: 95, action: 'block') → 1095
 * - NEW_DEVICE_VPN (priority: 0, action: 'challenge') → 100
 *
 * @note Lazy evaluation: для критических правил (priority >= 90) можно добавить short-circuit
 * чтобы прервать оценку при первом блокирующем правиле для повышения производительности
 * при больших rule sets (сотни правил)
 *
 * @param triggeredRules - Список сработавших правил
 * @returns 'block' | 'challenge' | undefined
 * @complexity O(n log n) - можно оптимизировать до O(n) с lazy evaluation для критических правил
 */
export function evaluateRuleActions(
  triggeredRules: readonly RiskRule[],
): RuleAction | undefined {
  // Сортируем правила по приоритету для детерминированности
  const sortedRules = sortRulesByPriority(triggeredRules);

  let highestPriorityAction: RuleAction | undefined;
  let highestPriority = -1;

  for (const ruleId of sortedRules) {
    const rule = rulesIndex.get(ruleId);
    if (rule?.decisionImpact === undefined) {
      continue;
    }

    const priority = rule.priority ?? 0;
    const action: RuleAction = rule.decisionImpact;

    // block имеет наивысший приоритет (1000 + priority), затем challenge (100 + priority)
    const actionPriority = action === 'block' ? 1000 + priority : 100 + priority;

    if (actionPriority > highestPriority) {
      highestPriority = actionPriority;
      highestPriorityAction = action;
    }
  }

  return highestPriorityAction;
}

/* ============================================================================
 * 🔧 EXPORTS FOR DOMAIN MODULES
 * ============================================================================
 */

/** Правила устройства (для тестирования и расширения) */
export const deviceRules = DEVICE_RULES;

/** Сетевые правила (для тестирования и расширения) */
export const networkRules = NETWORK_RULES;

/** Географические правила (для тестирования и расширения) */
export const geoRules = GEO_RULES;

/** Композитные правила (для тестирования и расширения) */
export const compositeRules = COMPOSITE_RULES;
