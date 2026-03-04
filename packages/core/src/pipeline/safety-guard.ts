/**
 * @file packages/core/src/pipeline/safety-guard.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Safety Guard / Auto-Rollback)
 * ============================================================================
 * Архитектурная роль:
 * - Автоматический откат при превышении порогов безопасности/качества
 * - Safety guard для защиты от деградации метрик
 * - Причина изменения: rollout safety / quality policy changes
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, HELPERS, RULES, API
 * - ✅ Deterministic: pure functions для оценки правил (injectable now для тестирования, short-circuiting с early-exit)
 * - ✅ Domain-pure: generic по метрикам и конфигурации, без привязки к domain-специфичным типам (layering: rollbackFactory в updateSafetyGuardState)
 * - ✅ Extensible: rule engine с strategy pattern (custom rules, rule priorities из config) без изменения core логики
 * - ✅ Strict typing: union-типы для rule types и приоритетов, без string literals в domain
 * - ✅ Microservice-ready: stateless, injectable now для тестирования, без скрытого coupling
 * - ✅ Scalable: rule engine поддерживает множественные правила с приоритетами, gating rules (блокируют другие правила без rollback), event hooks для мониторинга
 */

/* ============================================================================
 * 1. TYPES — SAFETY GUARD MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Результат проверки правила safety guard
 * @public
 * @note ruleId должен быть уникальным в наборе правил для корректной работы приоритетов
 */
export type SafetyRuleResult = Readonly<{
  /** Нужен ли откат */
  shouldRollback: boolean;
  /** Причина отката (если нужен) */
  rollbackReason?: string;
  /** Приоритет правила (для сортировки) */
  priority: RulePriority;
  /** Идентификатор правила (должен быть уникальным в наборе правил) */
  ruleId: string;
  /** Блокирует ли правило выполнение других правил (gating rule) */
  blocksOtherRules?: boolean;
}>;

/**
 * Приоритет правила для применения
 * @public
 */
export type RulePriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Функция правила для проверки метрик
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TConfig - Тип конфигурации safety guard (generic, domain-agnostic)
 * @public
 */
export type SafetyRule<
  TMetrics extends Readonly<Record<string, unknown>>,
  TConfig extends Readonly<Record<string, unknown>>,
> = (
  metrics: TMetrics, // Метрики для проверки
  config: TConfig, // Конфигурация safety guard
  now: number, // Timestamp для deterministic testing
) => SafetyRuleResult;

/**
 * Конфигурация safety guard
 * @template TMetrics - Тип метрик (generic, domain-agnostic, используется для type inference в SafetyRule)
 * @template TRolloutConfig - Тип конфигурации rollout (generic, domain-agnostic, используется для type inference в RollbackEvent)
 * @public
 */
export type SafetyGuardConfig<
  TMetrics extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
  TRolloutConfig extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> =
  & Readonly<{
    /** Временное окно для оценки метрик (в миллисекундах) */
    evaluationWindowMs: number;
    /** Минимальное количество измерений для принятия решения */
    minMeasurements: number;
    /** Включить автоматический откат */
    enableAutoRollback: boolean;
    /** Приоритеты правил (опционально, для кастомной сортировки) */
    rulePriorities?: Readonly<Partial<Record<string, RulePriority>>>;
  }>
  & {
    // Phantom fields для использования generic параметров (для type inference)
    readonly __metricsType?: TMetrics;
    readonly __rolloutConfigType?: TRolloutConfig;
  };

/**
 * Событие отката для обработки на уровне orchestration
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TRolloutConfig - Тип конфигурации rollout (generic, domain-agnostic)
 * @public
 */
export type RollbackEvent<
  TMetrics extends Readonly<Record<string, unknown>>,
  TRolloutConfig extends Readonly<Record<string, unknown>>,
> = Readonly<{
  /** Причина отката */
  reason: string;
  /** Текущие метрики */
  metrics: TMetrics;
  /** Конфигурация после отката */
  rollbackConfig: TRolloutConfig;
  /** Правило, которое вызвало откат */
  triggeredRule: SafetyRuleResult;
  /** Timestamp события */
  timestamp: number;
}>;

/**
 * Результат проверки safety guard
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @public
 */
export type SafetyGuardResult<TMetrics extends Readonly<Record<string, unknown>>> = Readonly<{
  /** Нужен ли откат */
  shouldRollback: boolean;
  /** Причина отката (если нужен) */
  rollbackReason?: string;
  /** Текущие метрики */
  metrics: TMetrics;
  /** Результаты всех правил */
  ruleResults: readonly SafetyRuleResult[];
  /** Правило, которое вызвало откат (если нужен) */
  triggeredRule?: SafetyRuleResult;
}>;

/**
 * Состояние safety guard
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TRolloutConfig - Тип конфигурации rollout (generic, domain-agnostic)
 * @public
 */
export type SafetyGuardState<
  TMetrics extends Readonly<Record<string, unknown>>,
  TRolloutConfig extends Readonly<Record<string, unknown>>,
> = Readonly<{
  /** Текущая конфигурация rollout */
  rolloutConfig: TRolloutConfig;
  /** Метрики за текущее окно */
  metrics: TMetrics;
  /** Timestamp последнего обновления */
  lastUpdated: number;
  /** Флаг отката (если был выполнен откат) */
  isRolledBack: boolean;
  /** Причина последнего отката (если был) */
  lastRollbackReason?: string;
}>;

/**
 * Функция для создания конфигурации отката
 * @template TRolloutConfig - Тип конфигурации rollout (generic, domain-agnostic)
 * @public
 */
export type RollbackConfigFactory<TRolloutConfig extends Readonly<Record<string, unknown>>> = (
  currentConfig: TRolloutConfig, // Текущая конфигурация rollout
) => TRolloutConfig;

/**
 * Функция для агрегации метрик за временное окно
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @public
 */
export type MetricsAggregator<TMetrics extends Readonly<Record<string, unknown>>> = (
  currentMetrics: TMetrics, // Текущие метрики
  previousMetrics: TMetrics | null, // Предыдущие метрики (если есть)
  timeSinceLastUpdate: number, // Время с последнего обновления
  evaluationWindowMs: number, // Временное окно для оценки
) => TMetrics;

/**
 * Событие применения правила
 * @public
 */
export type RuleEvent = Readonly<{
  /** Идентификатор правила */
  ruleId: string;
  /** Приоритет правила */
  priority: RulePriority;
  /** Результат проверки */
  result: SafetyRuleResult;
  /** Timestamp события */
  timestamp: number;
}>;

/**
 * Callback для событий применения правил
 * @public
 */
export type RuleEventHandler = (event: RuleEvent) => void;

/* ============================================================================
 * 2. CONSTANTS — DEFAULT CONFIGURATION
 * ============================================================================
 */

/** Дефолтный приоритет правила (если не указан) */
export const DEFAULT_RULE_PRIORITY: RulePriority = 'medium';

/** Порядок приоритетов для сортировки правил (от высшего к низшему) */
export const RULE_PRIORITY_ORDER: readonly RulePriority[] = [
  'critical',
  'high',
  'medium',
  'low',
] as const;

/* ============================================================================
 * 3. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Сравнивает приоритеты правил для сортировки
 * @public
 */
export function compareRulePriorities(
  a: RulePriority, // Первый приоритет
  b: RulePriority, // Второй приоритет
): number {
  const indexA = RULE_PRIORITY_ORDER.indexOf(a);
  const indexB = RULE_PRIORITY_ORDER.indexOf(b);
  return indexA - indexB;
}

/**
 * Получает приоритет правила из конфигурации или возвращает дефолтный
 * @public
 */
export function getRulePriority(
  ruleId: string, // Идентификатор правила
  rulePriorities?: Readonly<Partial<Record<string, RulePriority>>>, // Маппинг приоритетов правил (опционально)
): RulePriority {
  return rulePriorities?.[ruleId] ?? DEFAULT_RULE_PRIORITY;
}

/**
 * Сортирует результаты правил по приоритету (от высшего к низшему)
 * @public
 */
export function sortRuleResultsByPriority(
  results: readonly SafetyRuleResult[], // Результаты правил
): readonly SafetyRuleResult[] {
  return [...results].sort((a, b) => compareRulePriorities(a.priority, b.priority));
}

/**
 * Проверяет, нужно ли обновить метрики (в пределах временного окна)
 * @public
 */
export function shouldResetMetricsWindow(
  timeSinceLastUpdate: number, // Время с последнего обновления (в миллисекундах)
  evaluationWindowMs: number, // Временное окно для оценки (в миллисекундах)
): boolean {
  return timeSinceLastUpdate > evaluationWindowMs;
}

/* ============================================================================
 * 4. RULES — DEFAULT SAFETY RULES (Extensible Rule Engine)
 * ============================================================================
 */

/**
 * Создает gating rule для проверки минимального количества измерений
 * Блокирует выполнение других правил, если недостаточно данных
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TConfig - Тип конфигурации safety guard
 * @public
 */
export function createMinMeasurementsRule<
  TMetrics extends Readonly<Record<string, unknown>>,
  TConfig extends SafetyGuardConfig<TMetrics, Readonly<Record<string, unknown>>>,
>(
  getMeasurementCount: (metrics: TMetrics) => number, // Функция для получения количества измерений из метрик
): SafetyRule<TMetrics, TConfig> {
  return (metrics: TMetrics, config: TConfig): SafetyRuleResult => {
    const count = getMeasurementCount(metrics);
    const minMeasurements = config.minMeasurements;

    // Gating rule: блокируем другие правила, если недостаточно данных
    if (count < minMeasurements) {
      return {
        shouldRollback: false,
        priority: 'critical',
        ruleId: 'min_measurements',
        blocksOtherRules: true,
        rollbackReason:
          `Insufficient measurements: ${count} < ${minMeasurements} (gating rule blocks other rules)`,
      };
    }

    return {
      shouldRollback: false,
      priority: 'low',
      ruleId: 'min_measurements',
      blocksOtherRules: false,
    };
  };
}

/**
 * Функция сравнения для проверки порога
 * @public
 */
export type ThresholdComparator = (
  value: number, // Значение метрики
  threshold: number, // Пороговое значение
) => boolean;

/**
 * Создает правило для проверки порога деградации метрики
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TConfig - Тип конфигурации safety guard
 * @public
 */
export function createThresholdRule<
  TMetrics extends Readonly<Record<string, unknown>>,
  TConfig extends Readonly<Record<string, unknown>>,
>(
  getMetricValue: (metrics: TMetrics) => number, // Функция для получения значения метрики из метрик
  getThreshold: (config: TConfig) => number, // Функция для получения порога из конфигурации
  ruleId: string, // Идентификатор правила
  priority: RulePriority = 'high', // Приоритет правила
  comparator: ThresholdComparator = (value, threshold) => value > threshold, // Функция сравнения (по умолчанию: больше = хуже)
  formatReason?: (value: number, threshold: number) => string, // Функция для форматирования причины отката (опционально)
): SafetyRule<TMetrics, TConfig> {
  return (metrics: TMetrics, config: TConfig): SafetyRuleResult => {
    const value = getMetricValue(metrics);
    const threshold = getThreshold(config);

    if (comparator(value, threshold)) {
      const reason = formatReason
        ? formatReason(value, threshold)
        : `${ruleId}: ${value.toFixed(2)} violates threshold ${threshold}`;

      return {
        shouldRollback: true,
        rollbackReason: reason,
        priority,
        ruleId,
        blocksOtherRules: false,
      };
    }

    return {
      shouldRollback: false,
      priority,
      ruleId,
      blocksOtherRules: false,
    };
  };
}

/**
 * Создает комбинированное правило из нескольких правил (применяет все правила и возвращает первый с shouldRollback=true)
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TConfig - Тип конфигурации safety guard
 * @public
 */
export function createCombinedRule<
  TMetrics extends Readonly<Record<string, unknown>>,
  TConfig extends Readonly<Record<string, unknown>>,
>(
  rules: readonly SafetyRule<TMetrics, TConfig>[], // Массив правил для комбинирования
  ruleId: string, // Идентификатор комбинированного правила
  priority: RulePriority = 'medium', // Приоритет комбинированного правила
): SafetyRule<TMetrics, TConfig> {
  return (metrics: TMetrics, config: TConfig, now: number): SafetyRuleResult => {
    const results = rules.map((rule) => rule(metrics, config, now));
    const sortedResults = sortRuleResultsByPriority(results);
    const firstRollback = sortedResults.find((result) => result.shouldRollback);

    if (firstRollback) {
      return {
        ...firstRollback,
        ruleId,
        priority,
      };
    }

    return {
      shouldRollback: false,
      priority,
      ruleId,
    };
  };
}

/* ============================================================================
 * 5. API — PUBLIC FUNCTIONS
 * ============================================================================
 */

/**
 * Оценивает safety guard на основе метрик и конфигурации через rule engine с short-circuiting
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TConfig - Тип конфигурации safety guard
 * @note Pure function: детерминированная оценка через rule engine с early-exit для производительности
 * @note rules всегда explicit input (без дублирования источников)
 * @public
 */
export function evaluateSafetyGuard<
  TMetrics extends Readonly<Record<string, unknown>>,
  TConfig extends SafetyGuardConfig<TMetrics, Readonly<Record<string, unknown>>>,
>(
  metrics: TMetrics, // Метрики для проверки
  config: TConfig, // Конфигурация safety guard
  rules: readonly SafetyRule<TMetrics, TConfig>[], // Правила для проверки (всегда explicit input)
  now: number = Date.now(), // Timestamp для deterministic testing (опционально)
  onRuleEvaluated?: RuleEventHandler, // Callback для событий применения правил (опционально, для мониторинга)
): SafetyGuardResult<TMetrics> {
  // Если auto-rollback отключен, не выполняем откат
  if (!config.enableAutoRollback) {
    return {
      shouldRollback: false,
      metrics,
      ruleResults: [],
    };
  }

  // Если нет правил, не выполняем откат
  if (rules.length === 0) {
    return {
      shouldRollback: false,
      metrics,
      ruleResults: [],
    };
  }

  // Применяем правила с early-exit через reduce
  const evaluationState = rules.reduce<{
    ruleResults: SafetyRuleResult[];
    triggeredRule: SafetyRuleResult | undefined;
    shouldStop: boolean;
  }>(
    (acc, rule) => {
      if (acc.shouldStop) {
        return acc;
      }

      const result = rule(metrics, config, now);
      const priority = getRulePriority(result.ruleId, config.rulePriorities);
      const finalResult: SafetyRuleResult = {
        ...result,
        priority,
      };

      const newRuleResults = [...acc.ruleResults, finalResult];

      // Вызываем callback для события
      if (onRuleEvaluated) {
        onRuleEvaluated({
          ruleId: finalResult.ruleId,
          priority: finalResult.priority,
          result: finalResult,
          timestamp: now,
        });
      }

      // Если правило блокирует другие правила (gating rule), останавливаем выполнение
      // НО не устанавливаем triggeredRule, если shouldRollback === false
      if (finalResult.blocksOtherRules === true) {
        return {
          ruleResults: newRuleResults,
          triggeredRule: acc.triggeredRule,
          shouldStop: true,
        };
      }

      // Если правило требует откат, останавливаем выполнение (early-exit)
      if (finalResult.shouldRollback) {
        return {
          ruleResults: newRuleResults,
          triggeredRule: finalResult,
          shouldStop: true,
        };
      }

      return {
        ruleResults: newRuleResults,
        triggeredRule: acc.triggeredRule,
        shouldStop: false,
      };
    },
    { ruleResults: [], triggeredRule: undefined, shouldStop: false },
  );

  // Сортируем результаты по приоритету для полного отчета
  const sortedResults = sortRuleResultsByPriority(evaluationState.ruleResults);
  const triggeredRule = evaluationState.triggeredRule;

  const rollbackReason = triggeredRule?.rollbackReason;
  const shouldRollback = triggeredRule?.shouldRollback === true;

  return {
    shouldRollback,
    ...(rollbackReason !== undefined ? { rollbackReason } : {}),
    metrics,
    ruleResults: sortedResults,
    ...(triggeredRule !== undefined ? { triggeredRule } : {}),
  };
}

/**
 * Создает обновленную конфигурацию rollout с откатом
 * @template TRolloutConfig - Тип конфигурации rollout (generic, domain-agnostic)
 * @note Pure function: детерминированное создание конфигурации отката
 * @public
 */
export function createRollbackConfig<TRolloutConfig extends Readonly<Record<string, unknown>>>(
  currentConfig: TRolloutConfig, // Текущая конфигурация rollout
  rollbackFactory: RollbackConfigFactory<TRolloutConfig>, // Функция для создания конфигурации отката
): TRolloutConfig {
  return rollbackFactory(currentConfig);
}

/**
 * Обновляет состояние safety guard с новыми метриками
 * @template TMetrics - Тип метрик (generic, domain-agnostic)
 * @template TRolloutConfig - Тип конфигурации rollout (generic, domain-agnostic)
 * @note Pure function: детерминированное обновление состояния (side-effect вынесен наружу через rollbackEvent)
 * @note Эта функция должна вызываться периодически (например, каждую минуту) для оценки метрик и принятия решения об откате
 * @note Side-effect (onRollback) должен обрабатываться на уровне orchestration через rollbackEvent
 * @public
 */
export function updateSafetyGuardState<
  TMetrics extends Readonly<Record<string, unknown>>,
  TRolloutConfig extends Readonly<Record<string, unknown>>,
>(
  currentState: SafetyGuardState<TMetrics, TRolloutConfig> | null, // Текущее состояние safety guard (null, если не существует)
  newMetrics: TMetrics, // Новые метрики для оценки
  config: SafetyGuardConfig<TMetrics, TRolloutConfig>, // Конфигурация safety guard
  currentRolloutConfig: TRolloutConfig, // Текущая конфигурация rollout
  rollbackFactory: RollbackConfigFactory<TRolloutConfig>, // Функция для создания конфигурации отката
  rules: readonly SafetyRule<TMetrics, SafetyGuardConfig<TMetrics, TRolloutConfig>>[], // Правила для проверки (всегда explicit input)
  metricsAggregator?: MetricsAggregator<TMetrics>, // Функция для агрегации метрик за временное окно (опционально)
  now: number = Date.now(), // Timestamp для deterministic testing (опционально)
  onRuleEvaluated?: RuleEventHandler, // Callback для событий применения правил (опционально, для мониторинга)
): Readonly<{
  state: SafetyGuardState<TMetrics, TRolloutConfig>;
  rollbackEvent?: RollbackEvent<TMetrics, TRolloutConfig>;
}> {
  // Если состояние не существует, создаем новое
  if (!currentState) {
    return {
      state: {
        rolloutConfig: currentRolloutConfig,
        metrics: newMetrics,
        lastUpdated: now,
        isRolledBack: false,
      },
    };
  }

  // Проверяем, нужно ли обновить метрики (в пределах временного окна)
  const timeSinceLastUpdate = now - currentState.lastUpdated;
  const shouldReset = shouldResetMetricsWindow(timeSinceLastUpdate, config.evaluationWindowMs);

  // Агрегируем метрики (используем aggregator, если передан, иначе просто используем новые метрики)
  const metrics = shouldReset || !metricsAggregator
    ? newMetrics
    : metricsAggregator(
      newMetrics,
      currentState.metrics,
      timeSinceLastUpdate,
      config.evaluationWindowMs,
    );

  // Проверяем safety guard через rule engine
  const safetyResult = evaluateSafetyGuard(metrics, config, rules, now, onRuleEvaluated);

  // Если нужен откат и еще не был выполнен
  if (
    safetyResult.shouldRollback
    && !currentState.isRolledBack
    && safetyResult.triggeredRule !== undefined
    && safetyResult.rollbackReason !== undefined
    && safetyResult.rollbackReason.length > 0
  ) {
    // Создаем конфигурацию отката
    const rollbackConfig = rollbackFactory(currentState.rolloutConfig);

    // Создаем rollbackEvent для обработки на уровне orchestration
    const rollbackEvent: RollbackEvent<TMetrics, TRolloutConfig> = {
      reason: safetyResult.rollbackReason,
      metrics,
      rollbackConfig,
      triggeredRule: safetyResult.triggeredRule,
      timestamp: now,
    };

    // Возвращаем состояние с откатом и rollbackEvent для обработки на уровне orchestration
    return {
      state: {
        rolloutConfig: rollbackConfig,
        metrics,
        lastUpdated: now,
        isRolledBack: true,
        lastRollbackReason: safetyResult.rollbackReason,
      },
      rollbackEvent,
    };
  }

  // Обновляем состояние без отката
  const lastRollbackReason = currentState.lastRollbackReason;
  return {
    state: {
      rolloutConfig: currentRolloutConfig,
      metrics,
      lastUpdated: now,
      // Сохраняем флаг отката (если был откат, он остается)
      isRolledBack: currentState.isRolledBack,
      // Сохраняем причину последнего отката (если был)
      ...(lastRollbackReason !== undefined ? { lastRollbackReason } : {}),
    },
  };
}
