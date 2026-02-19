/**
 * @file packages/feature-auth/src/lib/security-pipeline/risk-sources/performance-limits.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Performance Limits Configuration
 * ============================================================================
 *
 * Архитектурная роль:
 * - Конфигурация лимитов производительности для локальной оценки риска
 * - Runtime-конфигурируемые лимиты для масштабирования
 * - Используется для валидации и планирования производительности
 *
 * Принципы:
 * - ✅ Configurable — лимиты можно изменить без изменения кода
 * - ✅ Documented — лимиты документированы для планирования масштабирования
 * - ✅ Testable — лимиты проверяются в unit-тестах
 */

/* ============================================================================
 * 🔧 DEFAULT LIMITS
 * ============================================================================
 */

/**
 * Лимиты производительности для локальной оценки риска
 * @note Эти значения основаны на текущей реализации и могут измениться при добавлении новых правил
 * @note Используются для документации и планирования масштабирования
 */
export const defaultPerformanceLimits = {
  /** Максимальное количество правил, которые могут быть оценены за один вызов */
  MAX_RULES: 50,
  /** Максимальное время выполнения оценки (мс) - целевое SLA */
  MAX_EXECUTION_TIME_MS: 10,
  /** Максимальное количество плагинов для расширения контекста */
  MAX_PLUGINS: 20,
} as const;

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Конфигурация лимитов производительности
 */
export type PerformanceLimitsConfig = {
  /** Максимальное количество правил */
  readonly maxRules: number;
  /** Максимальное время выполнения (мс) */
  readonly maxExecutionTimeMs: number;
  /** Максимальное количество плагинов */
  readonly maxPlugins: number;
};

/* ============================================================================
 * 🔧 RUNTIME CONFIGURATION
 * ============================================================================
 */

/**
 * Runtime-конфигурация лимитов производительности
 * Может быть переопределена через environment variables или runtime config
 *
 * @example
 * ```typescript
 * // В production можно увеличить лимиты через env:
 * // MAX_RULES=100 MAX_PLUGINS=50
 * const limits = getPerformanceLimits();
 * ```
 */
let runtimeLimits: PerformanceLimitsConfig | undefined;

/**
 * Устанавливает runtime-конфигурацию лимитов
 * @param config - Конфигурация лимитов (частичная или полная)
 */
export function setPerformanceLimits(
  config: Partial<PerformanceLimitsConfig>,
): void {
  const defaults = getPerformanceLimits();
  runtimeLimits = {
    maxRules: config.maxRules ?? defaults.maxRules,
    maxExecutionTimeMs: config.maxExecutionTimeMs ?? defaults.maxExecutionTimeMs,
    maxPlugins: config.maxPlugins ?? defaults.maxPlugins,
  };
}

/**
 * Получает текущие лимиты производительности
 * @returns Конфигурация лимитов (runtime или default)
 */
export function getPerformanceLimits(): PerformanceLimitsConfig {
  if (runtimeLimits) {
    return runtimeLimits;
  }

  // Попытка загрузить из environment variables (для production)
  const maxRulesEnv = process.env['MAX_RULES'];
  const maxExecutionTimeMsEnv = process.env['MAX_EXECUTION_TIME_MS'];
  const maxPluginsEnv = process.env['MAX_PLUGINS'];

  const envMaxRules = maxRulesEnv !== undefined && maxRulesEnv !== ''
    ? Number.parseInt(maxRulesEnv, 10)
    : undefined;
  const envMaxExecutionTimeMs = maxExecutionTimeMsEnv !== undefined && maxExecutionTimeMsEnv !== ''
    ? Number.parseInt(maxExecutionTimeMsEnv, 10)
    : undefined;
  const envMaxPlugins = maxPluginsEnv !== undefined && maxPluginsEnv !== ''
    ? Number.parseInt(maxPluginsEnv, 10)
    : undefined;

  if (
    envMaxRules !== undefined || envMaxExecutionTimeMs !== undefined || envMaxPlugins !== undefined
  ) {
    return {
      maxRules: envMaxRules ?? defaultPerformanceLimits['MAX_RULES'],
      maxExecutionTimeMs: envMaxExecutionTimeMs
        ?? defaultPerformanceLimits['MAX_EXECUTION_TIME_MS'],
      maxPlugins: envMaxPlugins ?? defaultPerformanceLimits['MAX_PLUGINS'],
    };
  }

  return {
    maxRules: defaultPerformanceLimits['MAX_RULES'],
    maxExecutionTimeMs: defaultPerformanceLimits['MAX_EXECUTION_TIME_MS'],
    maxPlugins: defaultPerformanceLimits['MAX_PLUGINS'],
  };
}

/**
 * Сбрасывает runtime-конфигурацию к дефолтным значениям
 * Полезно для тестов
 */
export function resetPerformanceLimits(): void {
  runtimeLimits = undefined;
}

/* ============================================================================
 * 🔍 VALIDATION
 * ============================================================================
 */

/**
 * Валидирует лимиты производительности
 * @param limits - Лимиты для валидации
 * @throws {Error} Если лимиты невалидны (отрицательные или нулевые значения)
 */
export function validatePerformanceLimits(limits: PerformanceLimitsConfig): void {
  if (limits.maxRules <= 0) {
    throw new Error('PerformanceLimits.maxRules must be greater than 0');
  }
  if (limits.maxExecutionTimeMs <= 0) {
    throw new Error('PerformanceLimits.maxExecutionTimeMs must be greater than 0');
  }
  if (limits.maxPlugins < 0) {
    throw new Error('PerformanceLimits.maxPlugins must be greater than or equal to 0');
  }
}

/**
 * Экспорт для обратной совместимости
 * @deprecated Используйте getPerformanceLimits() для получения конфигурируемых лимитов
 */
export const PerformanceLimits = {
  MAX_RULES: defaultPerformanceLimits['MAX_RULES'],
  MAX_EXECUTION_TIME_MS: defaultPerformanceLimits['MAX_EXECUTION_TIME_MS'],
  MAX_PLUGINS: defaultPerformanceLimits['MAX_PLUGINS'],
} as const;

/**
 * Экспорт для обратной совместимости (alias)
 * @deprecated Используйте defaultPerformanceLimits
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Backward compatibility
export const DEFAULT_PERFORMANCE_LIMITS = defaultPerformanceLimits;
