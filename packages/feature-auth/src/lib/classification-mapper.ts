/**
 * @file packages/feature-auth/src/lib/classification-mapper.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Classification to Auth Action Mapper
 * ============================================================================
 *
 * Архитектурная роль:
 * - Маппинг результатов classification из domains в auth-specific decision
 * - Изолирует auth-специфичную логику от domain logic
 * - Strategy pattern для обработки различных classification labels
 * - Оптимизация производительности для больших rule sets (pre-filtering)
 *
 * Принципы:
 * - ✅ SRP: только маппинг classification → auth action
 * - ✅ Strategy Pattern: расширяемая архитектура через labelStrategy map
 * - ✅ Performance: pre-filtering правил для оптимизации оценки
 * - ✅ Runtime Safety: guards для защиты от непредвиденных значений
 * - ✅ Deterministic: одинаковый вход → одинаковый выход
 *
 * Оптимизации:
 * - Pre-filtering: фильтрация правил по decisionImpact перед оценкой
 * - Масштабируемость: эффективная работа с сотнями/тысячами правил
 *
 * Расширяемость (добавление новой label):
 * 1. Добавить значение в VALID_LABELS (например, 'NEW_LABEL')
 * 2. Создать стратегию: const newLabelStrategy: LabelStrategy = (...) => { ... }
 * 3. Добавить стратегию в labelStrategy map: NEW_LABEL: newLabelStrategy
 * 4. Добавить unit тесты для новой стратегии в classification-mapper.test.ts
 * 5. Обновить документацию в mapLabelToDecisionHint с описанием логики маппинга
 */

import { classificationLabel } from '@livai/domains/labels';
import type { ClassificationLabel } from '@livai/domains/labels';
import { defaultDecisionPolicy } from '@livai/domains/policies';
import type { DecisionPolicy, DecisionSignals, RiskLevel } from '@livai/domains/policies';
import { evaluateRuleActions, getRuleDefinition } from '@livai/domains/strategies';
import type { ClassificationRule, RuleAction } from '@livai/domains/strategies';

/* ============================================================================
 * 🎯 TYPES
 * ============================================================================
 */

/**
 * Результат маппинга classification label в auth-specific decision
 * @note Auth-specific тип, не экспортируется из domains
 */
export type DecisionResult = {
  readonly action: 'login' | 'mfa' | 'block';
  readonly blockReason?: string;
};

/**
 * Тип функции стратегии для обработки label
 * @note Все параметры readonly для гарантии immutability
 * @note Стратегии не должны мутировать входные данные или выполнять side-effects
 */
type LabelStrategy = (
  rules: readonly ClassificationRule[], // Сработавшие правила (readonly для immutability)
  signals: DecisionSignals | undefined, // Сигналы для decision engine (readonly)
  policy: DecisionPolicy, // Политика принятия решений (readonly)
  riskLevel?: RiskLevel, // Уровень риска (опционально)
) => DecisionResult;

/* ============================================================================
 * 🔧 CONSTANTS & TYPE GUARDS
 * ============================================================================
 */

// Whitelist допустимых значений label для предотвращения object injection
const VALID_LABELS = ['DANGEROUS', 'SUSPICIOUS', 'SAFE', 'UNKNOWN'] as const;
type ValidLabel = typeof VALID_LABELS[number];

// Type guard: проверяет, является ли значение допустимым label
function isValidLabel(value: string): value is ValidLabel {
  return VALID_LABELS.includes(value as ValidLabel);
}

/* ============================================================================
 * 🚀 PERFORMANCE OPTIMIZATIONS
 * ============================================================================
 */

/**
 * Pre-filtering: фильтрует правила по decisionImpact для оптимизации производительности
 * Уменьшает количество правил, передаваемых в evaluateRuleActions, особенно при больших rule sets
 * @complexity O(n) где n = rules.length (batch fetch через Map для O(1) lookup каждого правила)
 * @note Оптимизация: batch fetch всех rule definitions в Map для избежания O(n) вызовов getRuleDefinition
 *       Это критично для сотен/тысяч правил, где каждый вызов getRuleDefinition может быть узким местом
 * @note Детерминированность: filter сохраняет порядок элементов, гарантируя одинаковый результат
 *       для одинакового набора правил
 */
function filterRulesWithDecisionImpact(
  rules: readonly ClassificationRule[], // Список правил для фильтрации (readonly для immutability)
): readonly ClassificationRule[] { // Отфильтрованные правила, имеющие decisionImpact (block или challenge)
  // Batch fetch: создаем Map всех rule definitions для O(1) lookup
  // Это оптимизирует производительность для больших rule sets (сотни/тысячи правил)
  const definitionsMap = new Map<ClassificationRule, ReturnType<typeof getRuleDefinition>>();
  for (const ruleId of rules) {
    if (!definitionsMap.has(ruleId)) {
      definitionsMap.set(ruleId, getRuleDefinition(ruleId));
    }
  }

  // Фильтруем правила, используя batch-fetched definitions
  return rules.filter(
    (ruleId) => definitionsMap.get(ruleId)?.decisionImpact !== undefined,
  );
}

/**
 * Оптимизированная версия evaluateRuleActions с pre-filtering и детерминированной сортировкой
 * Оптимизация: фильтрует только правила с decisionImpact перед оценкой
 * @note Кэширование не используется, так как наборы правил обычно уникальны для каждого логина
 *       (разные устройства, IP, геолокация, репутация). Pre-filtering дает основную оптимизацию.
 * @note Детерминированность: сортировка по ruleId гарантирует идентичность результатов и логов
 *       при одинаковых правилах, даже если порядок правил в triggeredRules разный
 * @note evaluateRuleActions из domains дополнительно сортирует по приоритету, но сортировка по ruleId
 *       обеспечивает детерминированный audit trail для logging blockReason
 * @complexity O(n) для pre-filtering + O(m log m) для сортировки + O(m log m) для evaluateRuleActions, где m <= n
 *             В худшем случае m = n, но на практике m обычно значительно меньше n благодаря pre-filtering
 */
function evaluateRuleActionsOptimized(
  rules: readonly ClassificationRule[], // Список сработавших правил (readonly для immutability)
): RuleAction | undefined { // 'block' | 'challenge' | undefined
  // Pre-filtering: фильтруем только правила с decisionImpact
  const filteredRules = filterRulesWithDecisionImpact(rules);

  // Если после фильтрации правил нет, возвращаем undefined
  if (filteredRules.length === 0) {
    return undefined;
  }

  // Детерминированная сортировка по ruleId для гарантии идентичности результатов и audit trail
  // Это критично для logging: одинаковый набор правил всегда дает одинаковый blockReason
  const sortedRules = [...filteredRules].sort((a, b) => a.localeCompare(b));

  // Вычисляем результат
  // Источник: @livai/domains - evaluateRuleActions из classification rules engine
  // @note evaluateRuleActions дополнительно сортирует правила по приоритету для детерминированности
  return evaluateRuleActions(sortedRules);
}

/* ============================================================================
 * 🎯 LABEL STRATEGIES
 * ============================================================================
 */

// Стратегия для DANGEROUS: всегда блокировка
const dangerousStrategy: LabelStrategy = () => ({
  action: 'block',
  blockReason: 'critical_risk',
});

/**
 * Стратегия для SUSPICIOUS: challenge или block в зависимости от правил и репутации
 * @note Использует оптимизированную версию evaluateRuleActions с pre-filtering
 *       для улучшения производительности при больших rule sets (сотни/тысячи правил)
 */
const suspiciousStrategy: LabelStrategy = (
  rules,
  signals,
  policy,
) => {
  // Проверяем действия правил через оптимизированный rule engine
  // Pre-filtering уменьшает количество правил для оценки
  const ruleAction = evaluateRuleActionsOptimized(rules);
  if (ruleAction === 'block') {
    return { action: 'block', blockReason: 'rule_block' };
  }
  // Проверяем критическую репутацию
  const reputationThreshold = policy.dangerousReputationTo;
  if (signals?.reputationScore !== undefined && signals.reputationScore < reputationThreshold) {
    return { action: 'block', blockReason: 'critical_reputation' };
  }
  // По умолчанию challenge (MFA)
  return { action: 'mfa' };
};

// Стратегия для SAFE: всегда разрешение
const safeStrategy: LabelStrategy = () => ({
  action: 'login',
});

// Стратегия для UNKNOWN: определяет decision на основе riskLevel и правил
const unknownStrategy: LabelStrategy = (
  rules,
  signals,
  policy,
  riskLevel,
) => {
  if (riskLevel === undefined) {
    // Если riskLevel не передан, используем безопасный fallback
    return { action: 'mfa' };
  }

  // Проверяем действия правил через оптимизированный rule engine
  const ruleAction = evaluateRuleActionsOptimized(rules);
  if (ruleAction === 'block') {
    return { action: 'block', blockReason: 'rule_block' };
  }
  if (ruleAction === 'challenge') {
    return { action: 'mfa' };
  }

  // Определяем decision на основе riskLevel
  if (riskLevel === 'critical') {
    // Проверяем критическую репутацию
    const reputationThreshold = policy.dangerousReputationTo;
    if (signals?.reputationScore !== undefined && signals.reputationScore < reputationThreshold) {
      return { action: 'block', blockReason: 'critical_reputation' };
    }
    return { action: 'block', blockReason: 'critical_risk' };
  }

  if (riskLevel === 'high') {
    return { action: 'mfa' };
  }

  // Для low и medium разрешаем логин
  return { action: 'login' };
};

/**
 * Map стратегий для каждого label
 * Используется вместо switch для улучшения читаемости и расширяемости
 */
const labelStrategy: Record<ValidLabel, LabelStrategy> = {
  DANGEROUS: dangerousStrategy,
  SUSPICIOUS: suspiciousStrategy,
  SAFE: safeStrategy,
  UNKNOWN: unknownStrategy,
};

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Маппинг ClassificationLabel и связанных данных в auth-specific DecisionResult
 *
 * Логика маппинга:
 * - DANGEROUS → 'block'
 * - SUSPICIOUS → 'challenge' (или 'block' при критических правилах)
 * - SAFE → 'login'
 * - UNKNOWN → использует логику на основе riskLevel и rules
 *
 * @note Pure function: не выполняет side-effects, только маппинг входных данных в decision
 * @note Детерминированность: одинаковый вход (label, rules, signals, policy) → одинаковый результат
 * @note Immutability: все входные параметры readonly, функция не мутирует внешнее состояние
 * @note Security: type guards предотвращают object injection, используется fallback для некорректных labels
 * @see Заголовок файла для инструкций по добавлению новой label
 */
export function mapLabelToDecisionHint(
  label: ClassificationLabel, // Classification label из domains (readonly)
  triggeredRules: readonly ClassificationRule[], // Сработавшие правила из domains (readonly для immutability)
  riskLevel: RiskLevel, // Уровень риска из domains
  signals?: DecisionSignals, // Сигналы для decision engine (опционально, readonly)
  policy?: DecisionPolicy, // Политика принятия решений (опционально, readonly)
): DecisionResult { // Результат с действием и причиной блокировки (для audit logging)
  // Извлекаем значение label
  // Source: @livai/domains - classificationLabel.value из domains
  const labelValue = classificationLabel.value(label);

  // Получаем стратегию для label или используем UNKNOWN по умолчанию
  // Используем type guard для безопасной проверки и предотвращения object injection
  let strategy: LabelStrategy;
  if (isValidLabel(labelValue)) {
    // eslint-disable-next-line security/detect-object-injection -- labelValue проверен через type guard isValidLabel, безопасный доступ
    strategy = labelStrategy[labelValue];
  } else {
    strategy = labelStrategy['UNKNOWN'];
  }

  // Применяем стратегию
  const decisionPolicy = policy ?? defaultDecisionPolicy;
  return strategy(triggeredRules, signals, decisionPolicy, riskLevel);
}
