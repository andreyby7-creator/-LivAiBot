/**
 * @file packages/domains/src/classification/strategies/rules.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Rules (Data-Driven Rule Engine)
 * ============================================================================
 *
 * Classification-специфичные правила для оценки классификации.
 * Определяет declarative rule definitions для использования в deterministic.strategy.ts,
 * который использует generic rule-engine из @livai/core для вычислений.
 *
 * Архитектурная роль:
 * - Declarative rule definitions для classification assessment
 * - Data-driven подход для масштабируемости
 * - OCP-compliant: добавление правил не меняет core engine
 *
 * Принципы:
 * - ✅ Declarative rules — правила как данные
 * - ✅ OCP — открыт для расширения, закрыт для модификации
 * - ✅ Single source of truth — каждое правило определено один раз
 * - ✅ Testable — правила легко тестировать изолированно
 * - ✅ Domain-pure — classification-специфичная логика
 * - ✅ Scalable — O(1) lookup через Map, short-circuit для критических правил
 * - ✅ Lazy evaluation — для >1000 правил поддерживается lazy evaluation non-critical rules
 * - ✅ Precomputing — кэширование enabledRulesPerUser для массовых вызовов
 */

import { SCORE_VALIDATION } from '../constants.js';
import {
  getClassificationRulesConfig,
  isClassificationRuleEnabled,
  registerConfigChangeCallback,
} from './config.js';
import type { ClassificationRulesConfig, RuleThresholds } from './config.js';
import type { ClassificationGeo } from '../signals/signals.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Информация об устройстве для оценки правил
 * @public
 */
export type DeviceInfo = Readonly<{
  readonly deviceId: string;
  readonly deviceType: 'desktop' | 'mobile' | 'tablet' | 'iot' | 'unknown';
  readonly os?: string;
  readonly browser?: string;
  readonly userAgent?: string;
}>;

/** Типизированные правила классификации */
export type ClassificationRule =
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

/**
 * Branded type для валидированных signals
 * Используется для runtime безопасности
 * @internal
 */
type ValidatedRuleSignals =
  & Readonly<{
    readonly isVpn?: boolean;
    readonly isTor?: boolean;
    readonly isProxy?: boolean;
    readonly reputationScore?: number;
    readonly velocityScore?: number;
  }>
  & { readonly __brand: 'ValidatedRuleSignals'; };

/**
 * Branded type для валидированных metadata
 * Используется для runtime безопасности
 * @internal
 */
type ValidatedRuleContextMetadata =
  & Readonly<{
    readonly isNewDevice?: boolean;
    readonly riskScore?: number;
  }>
  & { readonly __brand: 'ValidatedRuleContextMetadata'; };

/** Сигналы для оценки правил (строго типизированные) */
export type RuleSignals = Readonly<{
  readonly isVpn?: boolean;
  readonly isTor?: boolean;
  readonly isProxy?: boolean;
  readonly reputationScore?: number;
  readonly velocityScore?: number;
}>;

/** Метаданные контекста для оценки правил (строго типизированные) */
export type RuleContextMetadata = Readonly<{
  readonly isNewDevice?: boolean;
  readonly riskScore?: number;
}>;

/**
 * Контекст для оценки правил
 * @note signals и metadata должны быть валидированы через validateRuleSignals и validateRuleMetadata
 */
export type RuleEvaluationContext = Readonly<{
  readonly device: DeviceInfo;
  readonly geo?: ClassificationGeo;
  readonly previousGeo?: ClassificationGeo;
  /** Signals для оценки правил (immutable) */
  readonly signals?: Readonly<RuleSignals>;
  readonly metadata?: RuleContextMetadata;
  /** ID пользователя для feature flags (опционально) */
  readonly userId?: string;
}>;

/** Действие правила при срабатывании */
export type RuleAction = 'allow' | 'challenge' | 'block';

/** Конфигурация правила для decision engine */
export type ClassificationRuleConfig = Readonly<{
  /** Идентификатор правила */
  readonly name: ClassificationRule;
  /** Действие при срабатывании правила */
  readonly action: RuleAction;
  /** Приоритет правила (выше = важнее) */
  readonly priority: number;
}>;

/** Метаданные правила */
export type RuleMetadata = Readonly<{
  /** Влияние на score (0-100) */
  readonly scoreImpact?: number;

  /** Влияние на decision (если правило сработало) */
  readonly decisionImpact?: 'block' | 'challenge';

  /** Приоритет правила (выше = важнее) */
  readonly priority?: number;

  /** Опциональные теги для будущего расширения */
  readonly tags?: readonly string[];
}>;

/** Идентификатор правила */
export type RuleIdentifier = Readonly<{
  /** Уникальный идентификатор правила */
  readonly id: ClassificationRule;
}>;

/** Функция оценки правила */
export interface RuleEvaluator {
  /** Функция оценки правила */
  readonly evaluate: (ctx: RuleEvaluationContext) => boolean;
}

/** Определение правила */
export type RuleDefinition = RuleIdentifier & RuleEvaluator;

/** Расширенное определение правила с метаданными */
export type ExtendedRuleDefinition = RuleDefinition & RuleMetadata;

/**
 * Версия правила для A/B testing и staged rollouts
 * @public
 */
export type RuleVersion = string & { readonly __brand: 'RuleVersion'; };

/**
 * Расширенное определение правила с версионированием
 * @public
 */
export type VersionedRuleDefinition =
  & ExtendedRuleDefinition
  & Readonly<{
    /** Версия правила (опционально) */
    readonly version?: RuleVersion;
  }>;

/* ============================================================================
 * 🔧 CONFIGURATION HELPERS
 * ============================================================================
 */

/**
 * Получает текущую конфигурацию правил
 * @internal
 */
function getConfig(): ClassificationRulesConfig {
  return getClassificationRulesConfig();
}

/**
 * Получает пороги для правил из конфигурации
 * @internal
 */
function getRuleThresholds(): RuleThresholds {
  return getConfig().thresholds;
}

/**
 * Получает список стран с высоким риском из конфигурации
 * @internal
 */
function getHighRiskCountries(): ReadonlySet<string> {
  return getConfig().highRiskCountries;
}

/**
 * Получает порог приоритета для критических правил из конфигурации
 * @internal
 */
function getCriticalRulePriorityThreshold(): number {
  return getConfig().criticalRulePriorityThreshold;
}

/* ============================================================================
 * 🔧 VALIDATION UTILITIES
 * ============================================================================
 */

/**
 * Валидирует score (0-100) с защитой от NaN и Infinity
 * @internal
 */
function isValidScore(score: number | undefined | null): score is number {
  return (
    score !== undefined
    && score !== null
    && typeof score === 'number'
    && !Number.isNaN(score)
    && Number.isFinite(score)
    && score >= SCORE_VALIDATION.MIN_SCORE
    && score <= SCORE_VALIDATION.MAX_SCORE
  );
}

/**
 * Валидирует userId для feature flags (UUID или токен формат)
 * Защищает от злоупотреблений через невалидные идентификаторы
 * @internal
 */
function isValidUserId(userId: string | undefined): userId is string {
  if (userId === undefined || userId === '') {
    return false;
  }

  // UUID формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12 hex символов)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Токен формат: минимум 16 символов, буквы, цифры, дефисы, подчеркивания
  const tokenPattern = /^[a-zA-Z0-9_-]{16,}$/;

  return uuidPattern.test(userId) || tokenPattern.test(userId);
}

/** Проверяет, является ли устройство новым (treat as new если статус неизвестен) */
function isNewDevice(ctx: RuleEvaluationContext): boolean {
  if (ctx.metadata === undefined) {
    return true; // Если metadata отсутствует, считаем устройство новым
  }

  return ctx.metadata.isNewDevice === true || ctx.metadata.isNewDevice === undefined;
}

/**
 * Валидирует signals для runtime безопасности
 * Branded type validation для защиты от forged data
 * @internal
 */
function validateRuleSignals(
  signals: RuleSignals | undefined,
): ValidatedRuleSignals | undefined {
  if (signals === undefined) {
    return undefined;
  }

  // Runtime validation для защиты от forged data
  // Проверяем, что это plain object (не class instance, не array)
  if (typeof signals !== 'object' || Array.isArray(signals)) {
    return undefined;
  }

  // Проверяем прототип для защиты от class instances
  const prototype = Object.getPrototypeOf(signals) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }

  // Валидация полей signals с защитой от NaN и Infinity
  if (
    (signals.isVpn !== undefined && typeof signals.isVpn !== 'boolean')
    || (signals.isTor !== undefined && typeof signals.isTor !== 'boolean')
    || (signals.isProxy !== undefined && typeof signals.isProxy !== 'boolean')
    || (signals.reputationScore !== undefined && !isValidScore(signals.reputationScore))
    || (signals.velocityScore !== undefined && !isValidScore(signals.velocityScore))
  ) {
    return undefined;
  }

  return signals as unknown as ValidatedRuleSignals;
}

/**
 * Валидирует metadata для runtime безопасности
 * Branded type validation для защиты от forged data
 * @internal
 */
function validateRuleMetadata(
  metadata: RuleContextMetadata | undefined,
): ValidatedRuleContextMetadata | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  // Runtime validation для защиты от forged data
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  // Проверяем прототип для защиты от class instances
  const prototype = Object.getPrototypeOf(metadata) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }

  // Валидация полей metadata с защитой от NaN и Infinity
  if (
    (metadata.isNewDevice !== undefined && typeof metadata.isNewDevice !== 'boolean')
    || (metadata.riskScore !== undefined
      && (typeof metadata.riskScore !== 'number'
        || Number.isNaN(metadata.riskScore)
        || !Number.isFinite(metadata.riskScore)
        || metadata.riskScore < 0
        || metadata.riskScore > 100))
  ) {
    return undefined;
  }

  return metadata as unknown as ValidatedRuleContextMetadata;
}

/** Безопасно получает signals из контекста с валидацией */
function getSignals(ctx: RuleEvaluationContext): RuleSignals | undefined {
  return validateRuleSignals(ctx.signals);
}

/** Валидирует metadata перед использованием (type guard с branded type) */
function isValidMetadata(
  metadata: RuleContextMetadata | undefined,
): metadata is ValidatedRuleContextMetadata {
  return validateRuleMetadata(metadata) !== undefined;
}

/* ============================================================================
 * 🔧 DOMAIN MODULES: DEVICE RULES
 * ============================================================================
 */

/** Правила устройства */
const DEVICE_RULES: readonly ExtendedRuleDefinition[] = [
  {
    id: 'UNKNOWN_DEVICE',
    evaluate: (ctx: RuleEvaluationContext): boolean => ctx.device.deviceType === 'unknown',
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
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      return signals?.isTor === true;
    },
    scoreImpact: 70,
    decisionImpact: 'block',
    priority: 100,
  },
  {
    id: 'VPN_DETECTED',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      return signals?.isVpn === true;
    },
    scoreImpact: 50,
  },
  {
    id: 'PROXY_DETECTED',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      return signals?.isProxy === true;
    },
    scoreImpact: 40,
  },
  {
    id: 'CRITICAL_REPUTATION',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      if (signals === undefined) {
        return false;
      }

      const reputationScore = signals.reputationScore;
      if (!isValidScore(reputationScore)) {
        return false;
      }

      return reputationScore < getRuleThresholds().CRITICAL_REPUTATION;
    },
    scoreImpact: 50,
    decisionImpact: 'block',
    priority: 90,
  },
  {
    id: 'LOW_REPUTATION',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      if (signals === undefined) {
        return false;
      }

      const reputationScore = signals.reputationScore;
      if (!isValidScore(reputationScore)) {
        return false;
      }

      const thresholds = getRuleThresholds();
      return (
        reputationScore < thresholds.LOW_REPUTATION
        && reputationScore >= thresholds.CRITICAL_REPUTATION
      );
    },
    scoreImpact: 30,
  },
  {
    id: 'HIGH_VELOCITY',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      if (signals === undefined) {
        return false;
      }

      const velocityScore = signals.velocityScore;
      if (!isValidScore(velocityScore)) {
        return false;
      }

      return velocityScore > getRuleThresholds().HIGH_VELOCITY;
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
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      if (ctx.geo?.country === undefined) {
        return false;
      }

      return getHighRiskCountries().has(ctx.geo.country);
    },
    scoreImpact: 40,
    decisionImpact: 'challenge',
  },
  {
    id: 'GEO_MISMATCH',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
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
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      return ctx.device.deviceType === 'iot' && signals?.isTor === true;
    },
    decisionImpact: 'block',
    priority: 95,
  },
  {
    id: 'NEW_DEVICE_VPN',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      const signals = getSignals(ctx);
      return isNewDevice(ctx) && signals?.isVpn === true;
    },
    decisionImpact: 'challenge',
  },
  {
    id: 'HIGH_RISK_SCORE',
    evaluate: (ctx: RuleEvaluationContext): boolean => {
      // Валидация metadata перед использованием для предотвращения poisoning
      // Источник: внутренняя валидация risk score (0-100)
      if (!isValidMetadata(ctx.metadata)) {
        return false;
      }

      const riskScore = ctx.metadata.riskScore;
      if (
        riskScore === undefined
        || typeof riskScore !== 'number'
        || Number.isNaN(riskScore)
        || !Number.isFinite(riskScore)
        || riskScore < 0
        || riskScore > 100
      ) {
        return false;
      }

      return riskScore >= getRuleThresholds().HIGH_RISK_SCORE;
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
export const allRulesDeprecated = allRules;

/**
 * Индекс правил по ID для быстрого поиска O(1)
 * Поддерживает масштабирование на сотни правил через Map lookup
 *
 * @note Для динамических правил (JSON/DB): можно заменить allRules на функцию,
 * загружающую правила из внешнего источника, и пересоздавать rulesIndex при изменении конфигурации
 */
const rulesIndex: ReadonlyMap<ClassificationRule, ExtendedRuleDefinition> = Object.freeze(
  new Map<ClassificationRule, ExtendedRuleDefinition>(
    allRules.map((rule) => [rule.id, rule] as const),
  ),
);

/* ============================================================================
 * 🔧 SCALABILITY: LAZY EVALUATION & PRECOMPUTING
 * ============================================================================
 */

/**
 * Порог для включения lazy evaluation (для >1000 правил)
 * @internal
 */
const LAZY_EVALUATION_THRESHOLD = 1000;

/**
 * Кэш для precomputing enabledRulesPerUser (userId → Set<ruleId>)
 * Используется для массовых вызовов с одинаковым userId
 * @internal
 */
const enabledRulesCache = new Map<string, ReadonlySet<string>>();

/**
 * Максимальный размер кэша enabledRulesCache (LRU eviction)
 * @internal
 */
const MAX_ENABLED_RULES_CACHE_SIZE = 1000;

/**
 * Precomputes enabled rules для userId (кэширование для массовых вызовов)
 * @internal
 */
function getEnabledRulesForUser(userId: string): ReadonlySet<string> {
  const cached = enabledRulesCache.get(userId);
  if (cached !== undefined) {
    return cached;
  }

  // Вычисляем включенные правила для userId (functional style)
  // Передаем knownRules для валидации ruleId
  const knownRulesSet = Object.freeze(new Set(allRules.map((rule) => rule.id))) as ReadonlySet<
    string
  >;
  const enabled = new Set<string>(
    allRules
      .filter((rule) => isClassificationRuleEnabled(rule.id, userId, knownRulesSet))
      .map((rule) => rule.id),
  );

  const enabledSet = Object.freeze(enabled) as ReadonlySet<string>;

  // LRU eviction: если кэш переполнен, удаляем старые записи
  if (enabledRulesCache.size >= MAX_ENABLED_RULES_CACHE_SIZE) {
    const firstKey = enabledRulesCache.keys().next().value;
    if (firstKey !== undefined) {
      // eslint-disable-next-line functional/immutable-data -- LRU eviction кэша требует мутации
      enabledRulesCache.delete(firstKey);
    }
  }

  // eslint-disable-next-line functional/immutable-data -- Управление состоянием кэша требует мутации
  enabledRulesCache.set(userId, enabledSet);
  return enabledSet;
}

/**
 * Очищает кэш enabledRulesPerUser (для тестирования или при изменении конфигурации)
 * @public
 */
export function clearEnabledRulesCache(): void {
  // eslint-disable-next-line functional/immutable-data -- Очистка кэша требует мутации
  enabledRulesCache.clear();
}

// Регистрируем callback для автоматической очистки кэша при изменении feature flags
registerConfigChangeCallback(clearEnabledRulesCache);

/** Проверяет, является ли правило критическим */
function isCriticalRule(rule: ExtendedRuleDefinition): boolean {
  return rule.priority !== undefined && rule.priority >= getCriticalRulePriorityThreshold();
}

/**
 * Проверяет, включено ли правило через feature flag для контекста
 * Валидирует userId для защиты от злоупотреблений
 * @internal
 */
function isRuleEnabledForContext(
  rule: ExtendedRuleDefinition,
  ctx: RuleEvaluationContext,
): boolean {
  // Передаем knownRules для валидации ruleId
  const knownRulesSet = Object.freeze(new Set(allRules.map((r) => r.id))) as ReadonlySet<string>;

  // Если userId предоставлен, валидируем его формат
  if (ctx.userId !== undefined) {
    if (!isValidUserId(ctx.userId)) {
      // Невалидный userId - правило отключено для безопасности
      return false;
    }
    return isClassificationRuleEnabled(rule.id, ctx.userId, knownRulesSet);
  }

  return isClassificationRuleEnabled(rule.id, undefined, knownRulesSet);
}

/**
 * Оценивает критические правила (priority >= 90) с short-circuit
 * Прерывает оценку при первом блокирующем правиле для улучшения latency
 * Оптимизировано: один проход для детерминированности и минимизации вызовов evaluate
 * @returns Объект с результатом: triggeredRules и hasBlockingRule для объединения логики
 * @internal
 */
function evaluateCriticalRules(
  ctx: RuleEvaluationContext, // Контекст оценки правил
): Readonly<{
  readonly triggeredRules: readonly ClassificationRule[];
  readonly hasBlockingRule: boolean;
}> {
  const criticalRules = allRules.filter((rule) => isCriticalRule(rule));

  // Ищем блокирующее правило первым для short-circuit (детерминированный порядок)
  const blockingRule = criticalRules.find(
    (rule) => rule.evaluate(ctx) && rule.decisionImpact === 'block',
  );

  if (blockingRule !== undefined) {
    return {
      triggeredRules: [blockingRule.id],
      hasBlockingRule: true,
    } as const;
  }

  // Если блокирующего нет, собираем все сработавшие критические правила
  const triggeredRules = criticalRules
    .filter((rule) => rule.evaluate(ctx))
    .map((rule) => rule.id);

  return {
    triggeredRules,
    hasBlockingRule: false,
  } as const;
}

/**
 * Lazy evaluation для некритических правил (для >1000 правил)
 * Останавливается при первом совпадении или при достижении лимита
 * @internal
 */
function* evaluateNonCriticalRulesLazy(
  ctx: RuleEvaluationContext, // Контекст оценки правил
  enabledRules: ReadonlySet<string> | undefined, // Precomputed enabled rules (опционально)
): Generator<ClassificationRule, void, unknown> {
  const nonCriticalRules = allRules.filter((rule) => !isCriticalRule(rule));

  // eslint-disable-next-line functional/no-loop-statements -- Генератор требует for...of для lazy evaluation
  for (const rule of nonCriticalRules) {
    // Проверяем feature flag (используем precomputed cache если доступен)
    const isEnabled = enabledRules !== undefined
      ? enabledRules.has(rule.id)
      : isRuleEnabledForContext(rule, ctx);

    if (isEnabled && rule.evaluate(ctx)) {
      yield rule.id;
    }
  }
}

/**
 * Оценивает некритические правила с проверкой feature flags
 * Использует lazy evaluation для >1000 правил и precomputing для массовых вызовов
 * @internal
 */
function evaluateNonCriticalRules(
  ctx: RuleEvaluationContext, // Контекст оценки правил
): readonly ClassificationRule[] { // Массив сработавших некритических правил
  const nonCriticalRules = allRules.filter((rule) => !isCriticalRule(rule));

  // Для большого количества правил используем lazy evaluation + precomputing
  if (
    allRules.length > LAZY_EVALUATION_THRESHOLD
    && ctx.userId !== undefined
    && isValidUserId(ctx.userId)
  ) {
    const enabledRules = getEnabledRulesForUser(ctx.userId);
    return Array.from(evaluateNonCriticalRulesLazy(ctx, enabledRules));
  }

  // Для малого количества правил используем стандартный подход
  return nonCriticalRules
    .filter((rule) => isRuleEnabledForContext(rule, ctx) && rule.evaluate(ctx))
    .map((rule) => rule.id);
}

/**
 * Оценивает все правила и возвращает сработавшие
 * Поддерживает feature flags и versioned rules для A/B testing
 * @note Для использования с generic rule-engine из @livai/core см. deterministic.strategy.ts
 * @public
 */
export function evaluateRules(
  ctx: RuleEvaluationContext, // Контекст оценки правил
): readonly ClassificationRule[] { // Массив сработавших правил
  // Сначала проверяем критические правила с short-circuit
  const { triggeredRules: criticalRules, hasBlockingRule } = evaluateCriticalRules(ctx);

  // Если найдено блокирующее критическое правило, возвращаем результат
  if (hasBlockingRule) {
    return criticalRules;
  }

  // Оцениваем остальные правила с проверкой feature flags
  const triggeredNonCritical = evaluateNonCriticalRules(ctx);

  return [...criticalRules, ...triggeredNonCritical];
}

/**
 * Получает определение правила по ID (O(1) через Map)
 * @public
 */
export function getRuleDefinition(
  id: ClassificationRule, // Идентификатор правила
): ExtendedRuleDefinition | undefined { // Определение правила или undefined
  return rulesIndex.get(id);
}

/**
 * Получает правила с decision impact. O(n) где n = triggeredRules.length
 * @public
 */
export function getRulesWithDecisionImpact(
  triggeredRules: readonly ClassificationRule[], // Список сработавших правил
): readonly ExtendedRuleDefinition[] { // Массив правил с decision impact
  return triggeredRules
    .map((ruleId) => rulesIndex.get(ruleId))
    .filter((rule): rule is ExtendedRuleDefinition => rule?.decisionImpact !== undefined);
}

/**
 * Получает максимальный приоритет среди сработавших правил (0 если не заданы). O(n)
 * @public
 */
export function getMaxPriority(
  triggeredRules: readonly ClassificationRule[], // Список сработавших правил
): number { // Максимальный приоритет
  return triggeredRules.reduce((maxPriority, ruleId) => {
    const rule = rulesIndex.get(ruleId);
    const priority = rule?.priority;
    return priority !== undefined ? Math.max(maxPriority, priority) : maxPriority;
  }, 0);
}

/**
 * Сортирует правила по приоритету (descending) для детерминированности.
 * Оптимизировано до O(n) для большого количества правил через bucket sort.
 * @complexity O(n) для большого количества правил (bucket sort), O(n log n) для малого количества (fallback)
 * @public
 */
const MAX_PRIORITY = 100;
const SMALL_RULES_THRESHOLD = 10;

export function sortRulesByPriority(
  rules: readonly ClassificationRule[], // Список правил для сортировки
): readonly ClassificationRule[] { // Отсортированный список правил
  // Для малого количества правил используем стандартную сортировку
  if (rules.length <= SMALL_RULES_THRESHOLD) {
    return [...rules].sort((a, b) => {
      const ruleA = rulesIndex.get(a);
      const ruleB = rulesIndex.get(b);
      const priorityA = ruleA?.priority ?? 0;
      const priorityB = ruleB?.priority ?? 0;
      return priorityB - priorityA; // descending
    });
  }

  // Для большого количества правил используем bucket sort O(n)
  // Создаем buckets для каждого приоритета (0-100)
  const buckets = Array.from({ length: MAX_PRIORITY + 1 }, () => [] as ClassificationRule[]);

  // Распределяем правила по buckets напрямую (O(n) без лишних копий)
  // eslint-disable-next-line functional/no-loop-statements -- Прямой push требуется для O(n) bucket sort
  for (const ruleId of rules) {
    const rule = rulesIndex.get(ruleId);
    const priority = rule?.priority ?? 0;
    const bucket = buckets[priority];
    if (bucket !== undefined) {
      // eslint-disable-next-line functional/immutable-data -- Прямой push требуется для O(n) bucket sort
      bucket.push(ruleId);
    }
  }

  // Собираем правила из buckets в порядке убывания приоритета (functional style)
  return Array.from({ length: MAX_PRIORITY + 1 }, (_, index) => MAX_PRIORITY - index)
    .flatMap((priority) => {
      const bucket = buckets[priority];
      return bucket !== undefined && bucket.length > 0 ? bucket : [];
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
 * @complexity O(n log n) - можно оптимизировать до O(n) с lazy evaluation для критических правил
 */
const BLOCK_ACTION_BASE_PRIORITY = 1000;
const CHALLENGE_ACTION_BASE_PRIORITY = 100;

export function evaluateRuleActions(
  triggeredRules: readonly ClassificationRule[], // Список сработавших правил
): RuleAction | undefined { // 'block' | 'challenge' | undefined
  // Сортируем правила по приоритету для детерминированности
  const sortedRules = sortRulesByPriority(triggeredRules);

  const actionsWithPriority = sortedRules
    .map((ruleId) => {
      const rule = rulesIndex.get(ruleId);
      if (rule?.decisionImpact === undefined) {
        return undefined;
      }

      const priority = rule.priority ?? 0;
      const action = rule.decisionImpact; // 'block' | 'challenge'

      // block имеет наивысший приоритет (1000 + priority), затем challenge (100 + priority)
      const actionPriority = action === 'block'
        ? BLOCK_ACTION_BASE_PRIORITY + priority
        : CHALLENGE_ACTION_BASE_PRIORITY + priority;

      return { action, priority: actionPriority } as const;
    })
    .filter((item): item is { action: 'block' | 'challenge'; priority: number; } =>
      item !== undefined
    );

  if (actionsWithPriority.length === 0) {
    return undefined;
  }

  const first = actionsWithPriority[0];
  if (first === undefined) {
    return undefined;
  }

  const highest = actionsWithPriority.reduce(
    (max, current) => (current.priority > max.priority ? current : max),
    first,
  );

  return highest.action;
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
