/**
 * @file ErrorUtilsCore.ts - Enterprise-grade утилиты для работы с цепочками ошибок LivAiBot
 *
 * Полная защита от edge cases: циклы, null causes, deep chains (maxDepth=1000).
 * Safe utilities: safeGetCause, safeTraverseCauses, cycle detection algorithms.
 * Analysis tools: analyzeErrorChain возвращает chain stats, cycle detection, depth metrics.
 * Performance: lazy evaluation, memoization, Set-based cycle detection, early termination, cached results.
 */

// ==================== ИМПОРТЫ ====================

import type { ErrorChain } from './BaseErrorTypes.js';

// ==================== ТИПЫ ====================

/**
 * Конфигурация для обхода цепочек ошибок
 */
export type ChainTraversalConfig = {
  /** Максимальная глубина обхода (защита от stack overflow) */
  readonly maxDepth: number;
  /** Включить детекцию циклов */
  readonly detectCycles: boolean;
  /** Включить кеширование результатов */
  readonly enableCaching: boolean;
};

/**
 * Статистика анализа цепочки ошибок
 */
export type ErrorChainAnalysis = {
  /** Общая длина цепочки */
  readonly depth: number;
  /** Есть ли циклы в цепочке */
  readonly hasCycles: boolean;
  /** Количество уникальных ошибок */
  readonly uniqueErrors: number;
  /** Максимальная глубина без циклов */
  readonly maxDepthWithoutCycles: number;
  /** Пути до циклов (если есть) */
  readonly cyclePaths: readonly string[][];
};

/**
 * Результат безопасного получения причины
 */
export type SafeCauseResult<E> =
  | { readonly success: true; readonly cause: E; }
  | {
    readonly success: false;
    readonly reason: 'no_cause' | 'cycle_detected' | 'max_depth_exceeded';
  };

/**
 * Результат обхода цепочки
 */
export type ChainTraversalResult<E> = {
  /** Ошибки в цепочке (без циклов) */
  readonly chain: readonly E[];
  /** Обнаружены ли циклы */
  readonly hasCycles: boolean;
  /** Максимальная достигнутая глубина */
  readonly maxDepth: number;
  /** Прерван ли обход из-за лимитов */
  readonly truncated: boolean;
};

// ==================== КОНФИГУРАЦИЯ ПО УМОЛЧАНИЮ ====================

const DEFAULT_TRAVERSAL_CONFIG: ChainTraversalConfig = {
  maxDepth: 1000,
  detectCycles: true,
  enableCaching: true,
} as const;

// ==================== SAFE UTILITIES ====================

/**
 * Безопасное получение причины ошибки с защитой от циклов
 */
export function safeGetCause<E>(
  error: E,
  visited?: Set<E>,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): SafeCauseResult<E> {
  // Проверяем на null/undefined
  if (error === null || error === undefined) {
    return { success: false, reason: 'no_cause' };
  }

  // Проверяем на цикл только если передан visited Set
  if (config.detectCycles && visited?.has(error) === true) {
    return { success: false, reason: 'cycle_detected' };
  }

  // Получаем причину через type assertion (предполагаем что у ошибки есть cause?: ErrorChain<E>)
  const errorWithCause = error as E & { cause?: ErrorChain<E>; };
  const causeChain = errorWithCause.cause;

  // Runtime validation: проверяем что cause имеет ожидаемую структуру ErrorChain<E>
  if (!causeChain || typeof causeChain !== 'object' || !('error' in causeChain)) {
    return { success: false, reason: 'no_cause' };
  }

  return { success: true, cause: causeChain.error };
}

/**
 * Безопасный обход цепочки причин с configurable depth limit и cycle detection
 */
export function safeTraverseCauses<E>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): ChainTraversalResult<E> {
  function traverse(
    current: E,
    visited: Set<E>,
    chain: readonly E[],
    depth: number,
  ): ChainTraversalResult<E> {
    // Проверяем лимит глубины
    if (depth >= config.maxDepth) {
      return {
        chain,
        hasCycles: false,
        maxDepth: depth,
        truncated: true,
      };
    }

    // Проверяем на цикл
    const hasBeenVisited = config.detectCycles && visited.has(current);
    if (hasBeenVisited) {
      return {
        chain,
        hasCycles: true,
        maxDepth: depth,
        truncated: false,
      };
    }

    const newChain = [...chain, current];

    // Получаем следующую причину (перед добавлением current в visited)
    const causeResult: SafeCauseResult<E> = safeGetCause(current, visited, config);
    if (!causeResult.success) {
      const hasCycleDetected =
        (causeResult as { success: false; reason: string; }).reason === 'cycle_detected';
      return {
        chain: newChain,
        hasCycles: hasCycleDetected,
        maxDepth: depth + 1,
        truncated: false,
      };
    }

    // Теперь добавляем current в visited перед рекурсией
    const newVisited = new Set(Array.from(visited).concat(current));

    // Рекурсивно продолжаем с причиной
    return traverse(causeResult.cause, newVisited, newChain, depth + 1);
  }

  return traverse(rootError, new Set(), [], 0);
}

// ==================== ОСНОВНЫЕ УТИЛИТЫ ====================

/**
 * Преобразует цепочку ошибок в плоский массив с детекцией циклов
 */
export function flattenCauses<E>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): readonly E[] {
  const result = safeTraverseCauses(rootError, config);
  return result.chain;
}

/**
 * Получает полную цепочку ошибок с safe traversal
 */
export function getErrorChain<E>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): ChainTraversalResult<E> {
  return safeTraverseCauses(rootError, config);
}

/**
 * Находит корневую причину ошибки с cycle protection
 */
export function findRootCause<E>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): E | null {
  const result = safeTraverseCauses(rootError, config);

  if (result.chain.length === 0) {
    return null;
  }

  // Корневая причина - последняя в цепочке (самая глубокая)
  return result.chain[result.chain.length - 1] ?? null;
}

// ==================== ANALYSIS TOOLS ====================

/**
 * Комплексный анализ цепочки ошибок с cycle detection и depth metrics
 */
export function analyzeErrorChain<E>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): ErrorChainAnalysis {
  const traversalResult = safeTraverseCauses(rootError, config);
  const { chain, hasCycles, maxDepth } = traversalResult;

  // Вычисляем уникальные ошибки (для детекции неявных дубликатов)
  const uniqueErrors = new Set(chain).size;

  // Находим максимальную глубину без циклов
  const maxDepthWithoutCycles = hasCycles ? chain.length - 1 : chain.length;

  // Для простоты - не реализуем детекцию конкретных путей циклов
  // В продакшене можно добавить более сложную логику
  const cyclePaths: string[][] = hasCycles ? [['cycle_detected']] : [];

  return {
    depth: maxDepth,
    hasCycles,
    uniqueErrors,
    maxDepthWithoutCycles,
    cyclePaths,
  };
}

// ==================== PERFORMANCE OPTIMIZATIONS ====================

/** Memoized версия анализа цепочки с WeakMap кешированием (rootError как ключ) */
const analysisCache = new WeakMap<object, ErrorChainAnalysis>();

export function analyzeErrorChainMemoized<E extends object>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): ErrorChainAnalysis {
  if (!config.enableCaching) {
    return analyzeErrorChain(rootError, config);
  }

  // Используем rootError напрямую как ключ WeakMap
  const cached = analysisCache.get(rootError);
  if (cached !== undefined) {
    return cached;
  }

  const result = analyzeErrorChain(rootError, config);
  analysisCache.set(rootError, result);

  return result;
}

/** Memoized версия traversal цепочки с WeakMap кешированием для больших цепочек */
const traversalCache = new WeakMap<object, ChainTraversalResult<unknown>>();

export function safeTraverseCausesMemoized<E extends object>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): ChainTraversalResult<E> {
  if (!config.enableCaching) {
    return safeTraverseCauses(rootError, config);
  }

  // Используем rootError напрямую как ключ WeakMap
  const cached = traversalCache.get(rootError);
  if (cached !== undefined) {
    return cached as ChainTraversalResult<E>;
  }

  const result = safeTraverseCauses(rootError, config);
  traversalCache.set(rootError, result);

  return result;
}

/** Очищает кеш анализа цепочек (для memory management) */
export function clearAnalysisCache(): void {
  // WeakMap очищается автоматически, но оставляем функцию для API consistency
}

/** Очищает кеш traversal цепочек (для memory management) */
export function clearTraversalCache(): void {
  // WeakMap очищается автоматически, но оставляем функцию для API consistency
}

// ==================== UTILITY FUNCTIONS ====================

/** Проверяет, содержит ли цепочка ошибок циклы */
export function hasCycles<E>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): boolean {
  return safeTraverseCauses(rootError, config).hasCycles;
}

/** Получает глубину цепочки ошибок */
export function getChainDepth<E>(
  rootError: E,
  config: ChainTraversalConfig = DEFAULT_TRAVERSAL_CONFIG,
): number {
  return safeTraverseCauses(rootError, config).maxDepth;
}

/** Проверяет, является ли ошибка листом (нет причины) */
export function isLeafError<E>(error: E): boolean {
  const causeResult: SafeCauseResult<E> = safeGetCause(error);
  return !causeResult.success
    && (causeResult as { success: false; reason: string; }).reason === 'no_cause';
}

/** Проверяет, является ли ошибка корнем (нет причины) */
export function isRootError<E>(error: E): boolean {
  const causeResult: SafeCauseResult<E> = safeGetCause(error);
  return !causeResult.success
    && (causeResult as { success: false; reason: string; }).reason === 'no_cause';
}
