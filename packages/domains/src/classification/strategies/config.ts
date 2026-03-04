/**
 * @file packages/domains/src/classification/strategies/config.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Rules Configuration (Dynamic Configuration)
 * ============================================================================
 * Динамическая конфигурация для classification rules.
 * Поддерживает обновление конфигурации без перекомпиляции.
 * Архитектурная роль:
 * - Динамическая конфигурация правил (thresholds, high-risk countries)
 * - Поддержка versioned rules для A/B testing и staged rollouts
 * - Feature flags для постепенного включения правил с rollout percentage
 * Принципы:
 * - ✅ Dynamic — конфигурация может обновляться runtime через updateClassificationRulesConfig
 * - ✅ Extensible — RuleThresholds поддерживает динамические пороги через Record<string, number>
 * - ✅ Versioned — типы для версионирования правил готовы (RuleConfigVersion)
 * - ✅ Feature flags — постепенное включение правил с FNV-1a hash для rollout
 * - ✅ Immutable — конфигурация защищена от мутаций через Object.freeze и Readonly
 * - ✅ Type-safe — строгая типизация всех параметров
 * - ✅ SRP — hash и callback management вынесены в отдельные внутренние модули (hashUtils, callbackManager)
 * - ✅ Scalable — Map для O(1) lookup feature flags, lazy init для ускорения старта
 * - ✅ Security — валидация ruleId, FNV-1a hash для rollout, защита от рекурсии в callbacks
 */

/* ============================================================================
 * 🧩 ТИПЫ — CONFIGURATION TYPES
 * ============================================================================
 */

/**
 * Базовые пороги для правил классификации (для обратной совместимости)
 * @public
 */
export type BaseRuleThresholds = Readonly<{
  /** Порог для LOW_REPUTATION (по умолчанию 30) */
  readonly LOW_REPUTATION: number;
  /** Порог для CRITICAL_REPUTATION (по умолчанию 10) */
  readonly CRITICAL_REPUTATION: number;
  /** Порог для HIGH_VELOCITY (по умолчанию 70) */
  readonly HIGH_VELOCITY: number;
  /** Порог для HIGH_RISK_SCORE (по умолчанию 80) */
  readonly HIGH_RISK_SCORE: number;
}>;

/**
 * Пороги для правил классификации
 * Поддерживает как статические базовые пороги, так и динамические через Record
 * @public
 */
export type RuleThresholds = BaseRuleThresholds & Readonly<Record<string, number>>;

/**
 * Версия конфигурации правил
 * Используется для A/B testing и staged rollouts
 * @public
 */
export type RuleConfigVersion = string & { readonly __brand: 'RuleConfigVersion'; };

/**
 * Feature flag для правила
 * @public
 */
export type RuleFeatureFlag = Readonly<{
  /** Идентификатор правила */
  readonly ruleId: string;
  /** Версия правила */
  readonly version?: RuleConfigVersion;
  /** Включено ли правило */
  readonly enabled: boolean;
  /** Процент трафика для постепенного rollout (0-100) */
  readonly rolloutPercentage?: number;
}>;

/**
 * Конфигурация правил классификации
 * @public
 */
export type ClassificationRulesConfig = Readonly<{
  /** Пороги для правил */
  readonly thresholds: RuleThresholds;
  /** Список стран с высоким риском (ISO 3166-1 alpha-2) */
  readonly highRiskCountries: ReadonlySet<string>;
  /** Порог приоритета для критических правил (short-circuit evaluation) */
  readonly criticalRulePriorityThreshold: number;
  /** Feature flags для правил */
  readonly featureFlags?: readonly RuleFeatureFlag[];
  /** Версия конфигурации */
  readonly version?: RuleConfigVersion;
}>;

/**
 * Callback для уведомления об изменении конфигурации
 * Используется для инвалидации кэшей и других side-effects
 * @public
 */
export type ConfigChangeCallback = () => void;

/* ============================================================================
 * 🔧 DEFAULT CONFIGURATION
 * ============================================================================
 */

/**
 * Конфигурация по умолчанию
 * @public
 */
export const DEFAULT_RULE_THRESHOLDS: RuleThresholds = Object.freeze(
  {
    LOW_REPUTATION: 30,
    CRITICAL_REPUTATION: 10,
    HIGH_VELOCITY: 70,
    HIGH_RISK_SCORE: 80,
  } as RuleThresholds,
);

/**
 * Список стран с высоким риском по умолчанию (immutable для безопасности)
 * @public
 */
export const DEFAULT_HIGH_RISK_COUNTRIES: ReadonlySet<string> = Object.freeze(
  new Set([
    'KP', // North Korea
    'IR', // Iran
    'SY', // Syria
    // Можно расширить по необходимости
  ]),
);

/**
 * Порог приоритета для критических правил по умолчанию
 * @public
 */
export const DEFAULT_CRITICAL_RULE_PRIORITY_THRESHOLD = 90;

/**
 * Конфигурация по умолчанию
 * @public
 */
export const DEFAULT_CLASSIFICATION_RULES_CONFIG: ClassificationRulesConfig = Object.freeze(
  {
    thresholds: DEFAULT_RULE_THRESHOLDS,
    highRiskCountries: DEFAULT_HIGH_RISK_COUNTRIES,
    criticalRulePriorityThreshold: DEFAULT_CRITICAL_RULE_PRIORITY_THRESHOLD,
  } as const,
);

/* ============================================================================
 * 🔐 HASH UTILITIES (FNV-1a для детерминированного rollout)
 * ============================================================================
 */

/**
 * Внутренний модуль для hash функций
 * Использует FNV-1a для детерминированного распределения
 * @internal
 */
const hashUtils = ((): Readonly<{ readonly hashUserId: (userId: string) => number; }> => {
  // FNV-1a константы (32-bit)
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;
  const ROLLOUT_MODULO = 100;

  /**
   * FNV-1a hash для детерминированного распределения
   * Гарантирует отсутствие отрицательных чисел и хорошее распределение
   * @internal
   */
  function fnv1aHash(input: string): number {
    // eslint-disable-next-line functional/no-let -- FNV-1a hash требует мутабельную переменную
    let hash = FNV_OFFSET_BASIS;

    // eslint-disable-next-line functional/no-loop-statements, functional/no-let, fp/no-mutation -- FNV-1a требует итерацию с мутацией
    for (let i = 0; i < input.length; i += 1) {
      const charCode = input.charCodeAt(i);
      // eslint-disable-next-line fp/no-mutation -- FNV-1a hash требует мутации
      hash ^= charCode;
      // eslint-disable-next-line fp/no-mutation -- FNV-1a hash требует мутации
      hash = Math.imul(hash, FNV_PRIME);
    }

    // Гарантируем беззнаковый 32-bit результат
    return hash >>> 0;
  }

  /**
   * Хэширует userId для определения rollout percentage
   * Использует FNV-1a для детерминированного распределения
   * @internal
   */
  function hashUserId(userId: string): number {
    const hash = fnv1aHash(userId);
    return hash % ROLLOUT_MODULO;
  }

  return {
    hashUserId,
  } as const;
})();

/* ============================================================================
 * 🔔 CALLBACK MANAGEMENT (Dependency Injection для side-effects)
 * ============================================================================
 */

/**
 * Внутренний модуль для управления callbacks
 * Поддерживает множественные callbacks для расширяемости
 * @internal
 */
const callbackManager = ((): Readonly<{
  readonly registerCallback: (callback: ConfigChangeCallback) => void;
  readonly unregisterCallback: (callback: ConfigChangeCallback) => void;
  readonly notifyCallbacks: () => void;
}> => {
  const callbacks = new Set<ConfigChangeCallback>();

  /**
   * Регистрирует callback для уведомления об изменении конфигурации
   * @internal
   */
  function registerCallback(callback: ConfigChangeCallback): void {
    // eslint-disable-next-line functional/immutable-data -- Регистрация callback требует мутации Set
    callbacks.add(callback);
  }

  /**
   * Удаляет callback из регистрации
   * @internal
   */
  function unregisterCallback(callback: ConfigChangeCallback): void {
    // eslint-disable-next-line functional/immutable-data -- Удаление callback требует мутации Set
    callbacks.delete(callback);
  }

  /**
   * Флаг для защиты от рекурсии при вызове callbacks
   * @internal
   */
  // eslint-disable-next-line functional/no-let -- Защита от рекурсии требует мутабельной переменной
  let isNotifying = false;

  /**
   * Вызывает все зарегистрированные callbacks
   * Использует snapshot для защиты от рекурсии (если callback вызывает update → рекурсия предотвращается)
   * @internal
   */
  function notifyCallbacks(): void {
    // Защита от рекурсии: если уже идет уведомление, пропускаем
    if (isNotifying) {
      return;
    }

    // Создаем snapshot callbacks для безопасной итерации
    // Если callback вызовет register/unregister во время notify, это не повлияет на текущую итерацию
    const callbacksSnapshot = Array.from(callbacks);

    // eslint-disable-next-line fp/no-mutation -- Защита от рекурсии требует мутации
    isNotifying = true;

    try {
      // eslint-disable-next-line functional/no-loop-statements -- Уведомление требует итерации
      for (const callback of callbacksSnapshot) {
        callback();
      }
    } finally {
      // eslint-disable-next-line fp/no-mutation -- Защита от рекурсии требует мутации
      isNotifying = false;
    }
  }

  return {
    registerCallback,
    unregisterCallback,
    notifyCallbacks,
  } as const;
})();

/* ============================================================================
 * 🔧 CONFIGURATION MANAGER (Functional Style)
 * ============================================================================
 */

/**
 * Состояние конфигурации (закрытое через closure)
 * @internal
 */
const configState: { current: ClassificationRulesConfig; } = {
  current: DEFAULT_CLASSIFICATION_RULES_CONFIG,
};

/**
 * Map для O(1) lookup feature flags (обновляется при изменении конфигурации)
 * @internal
 */
// eslint-disable-next-line functional/no-let -- Map для feature flags требует мутации
let featureFlagsMap: ReadonlyMap<string, RuleFeatureFlag> | undefined;

/**
 * Множество известных ruleId для валидации (обновляется при изменении конфигурации)
 * @internal
 */
// eslint-disable-next-line functional/no-let -- Множество известных правил требует мутации
let knownRuleIds: ReadonlySet<string> | undefined;

/**
 * Флаг инициализации индексов (lazy init)
 * @internal
 */
// eslint-disable-next-line functional/no-let -- Lazy init flag требует мутации
let isIndexInitialized = false;

/**
 * Обновляет feature flags map и known ruleIds для O(1) lookup и валидации
 * @internal
 */
function updateFeatureFlagsIndex(featureFlags: readonly RuleFeatureFlag[] | undefined): void {
  if (featureFlags === undefined) {
    // eslint-disable-next-line fp/no-mutation -- Обновление индекса требует мутации
    featureFlagsMap = new Map();
    // eslint-disable-next-line fp/no-mutation -- Обновление индекса требует мутации
    knownRuleIds = new Set();
    // eslint-disable-next-line fp/no-mutation -- Lazy init flag requires mutation
    isIndexInitialized = true;
    return;
  }

  const newMap = new Map<string, RuleFeatureFlag>();
  const newSet = new Set<string>();

  // eslint-disable-next-line functional/no-loop-statements -- Построение индекса требует итерации
  for (const flag of featureFlags) {
    // eslint-disable-next-line functional/immutable-data -- Построение индекса требует мутации Map
    newMap.set(flag.ruleId, flag);
    // eslint-disable-next-line functional/immutable-data -- Построение индекса требует мутации Set
    newSet.add(flag.ruleId);
  }

  // eslint-disable-next-line fp/no-mutation -- Обновление индекса требует мутации
  featureFlagsMap = Object.freeze(newMap) as ReadonlyMap<string, RuleFeatureFlag>;
  // eslint-disable-next-line fp/no-mutation -- Обновление индекса требует мутации
  knownRuleIds = Object.freeze(newSet) as ReadonlySet<string>;
  // eslint-disable-next-line fp/no-mutation -- Lazy init flag requires mutation
  isIndexInitialized = true;
}

/**
 * Инициализирует индексы feature flags при первом использовании (lazy init)
 * @internal
 */
function ensureFeatureFlagsIndexInitialized(): void {
  if (!isIndexInitialized) {
    updateFeatureFlagsIndex(configState.current.featureFlags);
  }
}

/**
 * Получает текущую конфигурацию
 * @public
 */
export function getClassificationRulesConfig(): Readonly<ClassificationRulesConfig> {
  return configState.current;
}

/**
 * Обновляет конфигурацию
 * @param newConfig - Новая конфигурация (частичное обновление)
 * @param onConfigChange - Опциональный callback для уведомления об изменении (dependency injection)
 * @note При изменении feature flags автоматически обновляется индекс для O(1) lookup
 * @public
 */
export function updateClassificationRulesConfig(
  newConfig: Partial<ClassificationRulesConfig>,
  onConfigChange?: ConfigChangeCallback,
): void {
  // eslint-disable-next-line functional/immutable-data, fp/no-mutation -- Управление состоянием конфигурации требует мутации
  configState.current = Object.freeze({
    ...configState.current,
    ...newConfig,
    thresholds: newConfig.thresholds
      ? Object.freeze({ ...configState.current.thresholds, ...newConfig.thresholds })
      : configState.current.thresholds,
    highRiskCountries: newConfig.highRiskCountries
      ? Object.freeze(newConfig.highRiskCountries)
      : configState.current.highRiskCountries,
  }) as ClassificationRulesConfig;

  // Обновляем индекс feature flags для O(1) lookup
  if (newConfig.featureFlags !== undefined) {
    updateFeatureFlagsIndex(newConfig.featureFlags);
  }

  // Уведомляем callbacks об изменении конфигурации
  if (onConfigChange !== undefined) {
    onConfigChange();
  }
  callbackManager.notifyCallbacks();
}

/**
 * Регистрирует callback для уведомления об изменении конфигурации
 * Более generic подход: поддерживает множественные callbacks
 * @param callback - Callback для вызова при изменении конфигурации
 * @public
 */
export function registerConfigChangeCallback(callback: ConfigChangeCallback): void {
  callbackManager.registerCallback(callback);
}

/**
 * Удаляет callback из регистрации
 * @param callback - Callback для удаления
 * @public
 */
export function unregisterConfigChangeCallback(callback: ConfigChangeCallback): void {
  callbackManager.unregisterCallback(callback);
}

/**
 * Регистрирует callback для очистки кэша enabledRulesPerUser
 * @deprecated Используйте registerConfigChangeCallback для более generic подхода
 * @internal
 */
export function registerClearEnabledRulesCacheCallback(callback: () => void): void {
  callbackManager.registerCallback(callback);
}

/**
 * Сбрасывает конфигурацию на значения по умолчанию
 * @public
 */
export function resetClassificationRulesConfig(): void {
  // eslint-disable-next-line functional/immutable-data, fp/no-mutation -- Управление состоянием конфигурации требует мутации
  configState.current = DEFAULT_CLASSIFICATION_RULES_CONFIG;
  updateFeatureFlagsIndex(undefined);
  callbackManager.notifyCallbacks();
}

/**
 * Проверяет, включено ли правило через feature flag
 * Использует O(1) lookup через Map для масштабируемости
 * @param ruleId - Идентификатор правила (валидируется против известных правил)
 * @param userId - ID пользователя для определения rollout percentage (опционально)
 * @param knownRules - Опциональный список известных правил для валидации (dependency injection)
 * @public
 */
export function isClassificationRuleEnabled(
  ruleId: string,
  userId?: string,
  knownRules?: ReadonlySet<string>,
): boolean {
  // Lazy init индексов при первом использовании
  ensureFeatureFlagsIndexInitialized();

  // Валидация ruleId для защиты от случайного включения/отключения неизвестного правила
  const validationSet = knownRules ?? knownRuleIds;
  if (validationSet !== undefined && validationSet.size > 0 && !validationSet.has(ruleId)) {
    // Неизвестное правило - по умолчанию отключено для безопасности
    return false;
  }

  const config = getClassificationRulesConfig();
  if (config.featureFlags === undefined) {
    return true; // По умолчанию все правила включены
  }

  // O(1) lookup через Map вместо O(n) Array.find
  const flag = featureFlagsMap?.get(ruleId);
  if (flag === undefined) {
    return true; // Если флаг не найден, правило включено
  }

  if (!flag.enabled) {
    return false;
  }

  // Проверка rollout percentage с использованием FNV-1a hash
  if (flag.rolloutPercentage !== undefined && userId !== undefined) {
    const hash = hashUtils.hashUserId(userId);
    return hash < flag.rolloutPercentage;
  }

  return flag.enabled;
}

/**
 * Менеджер конфигурации правил (объект для обратной совместимости)
 * @deprecated Используйте функции getClassificationRulesConfig, updateClassificationRulesConfig, etc.
 * @public
 */
export const classificationRulesConfigManager = {
  getConfig: getClassificationRulesConfig,
  updateConfig: updateClassificationRulesConfig,
  resetConfig: resetClassificationRulesConfig,
  isRuleEnabled: isClassificationRuleEnabled,
} as const;

// Lazy init: индексы будут инициализированы при первом вызове isClassificationRuleEnabled
// Это ускоряет старт приложения, если конфигурация большая
