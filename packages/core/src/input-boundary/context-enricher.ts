/**
 * @file packages/core/src/input-boundary/context-enricher.ts
 * ============================================================================
 * 🛡️ CORE — Input Boundary (Context Enricher)
 * ============================================================================
 * Архитектурная роль:
 * - Generic context enricher для обогащения контекста метаданными на input boundary
 * - Архитектура: dependency-driven execution (signal-based DAG) → conflict detection → collect all errors
 * - Причина изменения: input boundary, context enrichment, signal-based metadata derivation
 * Принципы:
 * - ✅ SRP: только обогащение контекста метаданными (signal derivation), без композиции логики
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты (signal-based dependency graph)
 * - ✅ Domain-pure: без side-effects, платформо-агностично, generic по типам контекста
 * - ✅ Extensible: добавление enrichers через ContextEnricher без изменения core-логики
 * - ✅ Strict typing: union-типы для EnrichmentError, без string и Record в domain
 * - ✅ Microservice-ready: строгие контракты для межсервисного взаимодействия
 * - ✅ Scalable: signal-based metadata (keyed signals), не blob, топологическая сортировка по сигналам
 * - ✅ Security-first: конфликты сигналов = ошибка (не silent overwrite), conflict detection через stable serialization
 * - ✅ DAG-compatible: signal-based dependency graph (совместимо с pipeline)
 * - ✅ Parallel-ready: собирает все ошибки, не fail-fast, precondition enforcement
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает sanitization (это в data-safety/)
 * - ❌ НЕ включает композицию логики (and/or/not) - это в rule-engine
 * - ✅ Только enrichment (context → metadata signals transformation)
 * - ✅ Non-fail-fast: собирает все ошибки для partial evaluation и observability
 * - ✅ Immutable: все результаты frozen
 * - ✅ Signal-based dependency: топологическая сортировка по сигналам, не enricher names
 * - ✅ Conflict detection: конфликты сигналов детектируются через stable serialization
 * - ✅ Precondition enforcement: enricher пропускается, если зависимости не выполнены
 */

import { isJsonSerializable } from './generic-validation.js';

/* ============================================================================
 * 1. TYPES — ENRICHMENT MODEL (Pure Type Definitions)
 * ============================================================================
 */

/** Ошибка обогащения (union type) */
export type EnrichmentError =
  | Readonly<{ kind: 'ENRICHER_ERROR'; enricher: string; reason: string; }>
  | Readonly<{ kind: 'CONFLICTING_SIGNALS'; signal: string; }>
  | Readonly<{ kind: 'MISSING_DEPENDENCY'; enricher: string; dependency: string; }>
  | Readonly<{ kind: 'CIRCULAR_DEPENDENCY'; cycle: readonly string[]; }>
  | Readonly<{ kind: 'SKIPPED_ENRICHER'; enricher: string; reason: string; }>;

/** Результат обогащения контекста (non-fail-fast, собирает все сигналы и ошибки) */
export type EnrichmentResult = Readonly<{
  /** Собранные сигналы (даже при наличии ошибок) */
  signals: ReadonlyMap<string, unknown>;
  /** Массив всех ошибок (не останавливается на первой) */
  errors: readonly EnrichmentError[];
}>;

/**
 * Observer для telemetry и логирования событий обогащения контекста
 * Используется для production monitoring и debugging
 * @public
 */
export type EnrichmentObserver = Readonly<{
  /** Вызывается когда enricher пропущен из-за missing dependencies */
  onSkippedEnricher?: (
    error: Readonly<{ kind: 'SKIPPED_ENRICHER'; enricher: string; reason: string; }>,
  ) => void;
  /** Вызывается когда обнаружен конфликт сигналов */
  onConflictingSignals?: (
    error: Readonly<{ kind: 'CONFLICTING_SIGNALS'; signal: string; }>,
  ) => void;
  /** Вызывается когда обнаружена циклическая зависимость */
  onCircularDependency?: (
    error: Readonly<{ kind: 'CIRCULAR_DEPENDENCY'; cycle: readonly string[]; }>,
  ) => void;
  /** Вызывается когда enricher вернул ошибку */
  onEnricherError?: (
    error: Readonly<{ kind: 'ENRICHER_ERROR'; enricher: string; reason: string; }>,
  ) => void;
  /** Вызывается когда обнаружена missing dependency */
  onMissingDependency?: (
    error: Readonly<{ kind: 'MISSING_DEPENDENCY'; enricher: string; dependency: string; }>,
  ) => void;
}>;

/**
 * Enricher: обогащает контекст метаданными (pure function, extensible без изменения core)
 * @template TContext - Тип входного контекста
 * @requirements Детерминированность, signal-based dependency, безопасность, идемпотентность
 *
 * @example enricher: ContextEnricher<RequestContext> = { name: 'geo', provides: ['geo.country'], dependsOn: [], enrich: (ctx, signals) => ({ signals: new Map([['geo.country', ctx.country]]), errors: [] }) };
 */
export type ContextEnricher<TContext = Record<string, unknown>> = Readonly<{
  /** Имя enricher (для отладки и логирования) */
  readonly name: string;
  /** Сигналы, которые этот enricher предоставляет */
  readonly provides: readonly string[];
  /** Сигналы, от которых зависит этот enricher (signal names, не enricher names!) */
  readonly dependsOn?: readonly string[];
  /** Обогащает контекст метаданными (pure function, не мутирует контекст, возвращает signal map) */
  readonly enrich: (
    context: TContext,
    availableSignals: ReadonlyMap<string, unknown>,
  ) => EnrichmentResult;
}>;

/**
 * Registry enrichers: invariants (обязательные) + policies (расширяемые)
 * Invariants всегда выполняются первыми и не могут быть обойдены
 * @template TContext - Тип входного контекста
 */
export type EnricherRegistry<TContext = Record<string, unknown>> = Readonly<{
  /** Обязательные invariant enrichers (базовые метаданные) */
  readonly invariants: readonly ContextEnricher<TContext>[];
  /** Расширяемые policy enrichers (domain-specific метаданные) */
  readonly policies: readonly ContextEnricher<TContext>[];
}>;

/* ============================================================================
 * 🎯 DEFAULT REGISTRY (Core Enrichers)
 * ============================================================================
 */

/** Дефолтный registry с пустыми enrichers (thread-safe, immutable) */
export const defaultEnricherRegistry: EnricherRegistry<Record<string, unknown>> = Object.freeze({
  invariants: Object.freeze([]),
  policies: Object.freeze([]),
});

/* ============================================================================
 * 🔧 DEPENDENCY RESOLUTION — SIGNAL-BASED TOPOLOGICAL SORT
 * ============================================================================
 */

/**
 * Строит providers map: signal → enrichers providing it
 * @internal
 */
function buildProvidersMap<TContext = Record<string, unknown>>(
  enrichers: readonly ContextEnricher<TContext>[],
): ReadonlyMap<string, readonly ContextEnricher<TContext>[]> {
  const providersAcc = enrichers.reduce<Map<string, ContextEnricher<TContext>[]>>(
    (acc, enricher) => {
      return enricher.provides.reduce<Map<string, ContextEnricher<TContext>[]>>(
        (innerAcc, signal) => {
          const existing = innerAcc.get(signal);
          if (existing === undefined) {
            return new Map([...Array.from(innerAcc.entries()), [signal, [enricher]]]);
          }
          return new Map([
            ...Array.from(innerAcc.entries()).filter(([key]) => key !== signal),
            [signal, [...existing, enricher]],
          ]);
        },
        acc,
      );
    },
    new Map(),
  );

  return Object.freeze(
    new Map(
      Array.from(providersAcc.entries()).map(([signal, enrichersList]) => [
        signal,
        Object.freeze(enrichersList),
      ]),
    ),
  ) as ReadonlyMap<string, readonly ContextEnricher<TContext>[]>;
}

/**
 * Строит edges map: enricherA → enricherB если B.dependsOn содержит signal от A
 * @internal
 */
function buildEdgesMap<TContext = Record<string, unknown>>(
  enrichers: readonly ContextEnricher<TContext>[],
  providers: ReadonlyMap<string, readonly ContextEnricher<TContext>[]>,
): ReadonlyMap<string, readonly string[]> {
  const edgesAcc = enrichers.reduce<Map<string, string[]>>(
    (acc, enricherB) => {
      if (enricherB.dependsOn === undefined) {
        return acc;
      }

      const dependencies = enricherB.dependsOn.reduce<string[]>((deps, requiredSignal) => {
        const signalProviders = providers.get(requiredSignal);
        if (signalProviders === undefined) {
          return deps;
        }

        return signalProviders.reduce<string[]>((innerDeps, provider) => {
          if (!innerDeps.includes(provider.name)) {
            return [...innerDeps, provider.name];
          }
          return innerDeps;
        }, deps);
      }, []);

      if (dependencies.length > 0) {
        return new Map([...Array.from(acc.entries()), [enricherB.name, dependencies]]);
      }

      return acc;
    },
    new Map(),
  );

  return Object.freeze(
    new Map(
      Array.from(edgesAcc.entries()).map(([enricher, deps]) => [enricher, Object.freeze(deps)]),
    ),
  ) as ReadonlyMap<string, readonly string[]>;
}

/**
 * Строит граф зависимостей на основе сигналов (signal → enricher providing it)
 * @internal
 */
function buildSignalDependencyGraph<TContext = Record<string, unknown>>(
  enrichers: readonly ContextEnricher<TContext>[],
): {
  providers: ReadonlyMap<string, readonly ContextEnricher<TContext>[]>;
  edges: ReadonlyMap<string, readonly string[]>;
} {
  const providers = buildProvidersMap(enrichers);
  const edges = buildEdgesMap(enrichers, providers);
  return { providers, edges };
}

/**
 * Проверяет наличие циклических зависимостей в графе enrichers (signal-based)
 * @internal
 */
function detectCycles<TContext = Record<string, unknown>>(
  enrichers: readonly ContextEnricher<TContext>[],
): readonly string[] | null {
  const { edges } = buildSignalDependencyGraph(enrichers);

  function dfs(
    enricherName: string,
    path: readonly string[],
    visited: ReadonlySet<string>,
    recursionStack: ReadonlySet<string>,
  ): readonly string[] | null {
    if (recursionStack.has(enricherName)) {
      const cycleStart = path.indexOf(enricherName);
      return path.slice(cycleStart).concat(enricherName);
    }

    if (visited.has(enricherName)) {
      return null;
    }

    const newVisited = new Set([...visited, enricherName]);
    const newRecursionStack = new Set([...recursionStack, enricherName]);

    const deps = edges.get(enricherName);
    if (deps !== undefined) {
      return deps.reduce<readonly string[] | null>(
        (acc, dep) => acc ?? dfs(dep, path.concat(enricherName), newVisited, newRecursionStack),
        null,
      );
    }

    return null;
  }

  return enrichers.reduce<readonly string[] | null>(
    (acc, enricher) => {
      if (acc !== null) {
        return acc;
      }
      return dfs(enricher.name, [], new Set(), new Set());
    },
    null,
  );
}

/**
 * Инициализирует in-degree map для топологической сортировки
 * @internal
 */
function initializeInDegree<TContext = Record<string, unknown>>(
  enrichers: readonly ContextEnricher<TContext>[],
  edges: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, number> {
  const initial = enrichers.reduce<Map<string, number>>(
    (acc, enricher) => new Map([...Array.from(acc.entries()), [enricher.name, 0]]),
    new Map(),
  );

  return Object.freeze(
    Array.from(edges.entries()).reduce<Map<string, number>>(
      (acc, [enricherName, dependencies]) => {
        const current = acc.get(enricherName) ?? 0;
        return new Map([
          ...Array.from(acc.entries()).filter(([key]) => key !== enricherName),
          [enricherName, current + dependencies.length],
        ]);
      },
      new Map(initial),
    ),
  ) as ReadonlyMap<string, number>;
}

/**
 * Объединяет два отсортированных массива в один отсортированный (functional style, optimized for large arrays)
 * Использует рекурсию с аккумулятором для функционального стиля и производительности
 * @internal
 */
function mergeSortedArrays(a: readonly string[], b: readonly string[]): readonly string[] {
  function mergeRecursive(
    arr1: readonly string[],
    arr2: readonly string[],
    acc: readonly string[],
  ): readonly string[] {
    if (arr1.length === 0) {
      return Object.freeze([...acc, ...arr2]);
    }
    if (arr2.length === 0) {
      return Object.freeze([...acc, ...arr1]);
    }

    const [head1, ...tail1] = arr1;
    const [head2, ...tail2] = arr2;

    if (head1 !== undefined && head2 !== undefined) {
      if (head1 < head2) {
        return mergeRecursive(tail1, arr2, [...acc, head1]);
      }
      return mergeRecursive(arr1, tail2, [...acc, head2]);
    }

    return acc;
  }

  return mergeRecursive(a, b, []);
}

/**
 * Выполняет один шаг Kahn's algorithm (functional style)
 * @internal
 */
function kahnStep<TContext = Record<string, unknown>>(
  queue: readonly string[],
  result: readonly ContextEnricher<TContext>[],
  enricherMap: ReadonlyMap<string, ContextEnricher<TContext>>,
  edges: ReadonlyMap<string, readonly string[]>,
  inDegree: ReadonlyMap<string, number>,
): {
  queue: readonly string[];
  result: readonly ContextEnricher<TContext>[];
  inDegree: ReadonlyMap<string, number>;
} {
  if (queue.length === 0) {
    return { queue, result, inDegree };
  }

  const [currentName, ...restQueue] = queue;
  if (currentName === undefined) {
    return { queue: restQueue, result, inDegree };
  }

  const enricher = enricherMap.get(currentName);
  if (enricher === undefined) {
    return kahnStep(restQueue, result, enricherMap, edges, inDegree);
  }

  const newResult = Object.freeze([...result, enricher]);

  const { newInDegree, newQueueItems } = Array.from(edges.entries()).reduce<{
    newInDegree: Map<string, number>;
    newQueueItems: string[];
  }>(
    (acc, [name, deps]) => {
      if (!deps.includes(currentName)) {
        return acc;
      }

      const current = acc.newInDegree.get(name) ?? inDegree.get(name) ?? 0;
      const newDegree = current - 1;
      const updatedInDegree = new Map([
        ...Array.from(acc.newInDegree.entries()).filter(([key]) => key !== name),
        [name, newDegree],
      ]);

      const updatedQueueItems = newDegree === 0 ? [...acc.newQueueItems, name] : acc.newQueueItems;

      return {
        newInDegree: updatedInDegree,
        newQueueItems: updatedQueueItems,
      };
    },
    { newInDegree: new Map(inDegree), newQueueItems: [] },
  );

  const sortedNewItems = Object.freeze([...newQueueItems].sort());
  const mergedQueue = mergeSortedArrays(restQueue, sortedNewItems);

  return kahnStep(
    mergedQueue,
    newResult,
    enricherMap,
    edges,
    Object.freeze(newInDegree) as ReadonlyMap<string, number>,
  );
}

/**
 * Топологическая сортировка enrichers по сигнальным зависимостям (Kahn's algorithm)
 * Граф строится по сигналам: enricherA → enricherB если B.dependsOn содержит signal от A
 * @internal
 */
function topologicalSort<TContext = Record<string, unknown>>(
  enrichers: readonly ContextEnricher<TContext>[],
): readonly ContextEnricher<TContext>[] {
  const { edges } = buildSignalDependencyGraph(enrichers);
  const enricherMap = Object.freeze(
    new Map(enrichers.map((e) => [e.name, e] as const)),
  ) as ReadonlyMap<string, ContextEnricher<TContext>>;

  const initialInDegree = initializeInDegree(enrichers, edges);

  const initialQueue = Object.freeze(
    Array.from(initialInDegree.entries())
      .filter(([, degree]) => degree === 0)
      .map(([name]) => name)
      .sort(),
  );

  const { result } = kahnStep(initialQueue, Object.freeze([]), enricherMap, edges, initialInDegree);

  return Object.freeze(result);
}

/* ============================================================================
 * 🔧 STABLE SERIALIZATION EQUALITY — JSON STRING COMPARISON
 * ============================================================================
 */

/**
 * Рекурсивно сортирует ключи объекта для stable serialization
 * Использует WeakMap/WeakSet для visited/cached объектов (оптимизация для больших nested структур)
 * @internal
 */
function stableKeySort(
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
  cache: WeakMap<object, unknown> = new WeakMap(),
): unknown {
  // Примитивы не кэшируются (не нужны WeakMap/WeakSet)
  if (value === null || value === undefined) {
    return value;
  }

  // Для объектов и массивов используем WeakMap/WeakSet
  if (typeof value === 'object') {
    // Проверка cache для circular objects (избегаем лишних обходов)
    const cached = cache.get(value);
    if (cached !== undefined) {
      return cached;
    }

    if (visited.has(value)) {
      // Circular reference - возвращаем как есть (уже обработан выше в дереве)
      return value;
    }

    if (Array.isArray(value)) {
      visited.add(value);
      // Сохраняем placeholder в cache до обработки (для circular refs)
      const placeholder: unknown[] = [];
      cache.set(value, placeholder);
      const sorted = value.map((item) => stableKeySort(item, visited, cache));
      const result = sorted;
      // Обновляем cache с реальным результатом
      cache.set(value, result);
      return result;
    }

    // Plain object
    visited.add(value);
    // Сохраняем placeholder в cache до обработки (для circular refs)
    const placeholder: Record<string, unknown> = {};
    cache.set(value, placeholder);
    const sortedEntries = Object.entries(value)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, val]) => [key, stableKeySort(val, visited, cache)] as const);
    const result = Object.fromEntries(sortedEntries);
    // Обновляем cache с реальным результатом
    cache.set(value, result);
    return result;
  }

  return value;
}

/**
 * Сравнивает два значения на равенство через stable JSON serialization
 * Используется для детекции конфликтов сигналов (distributed-safe)
 * Рекурсивно сортирует ключи объектов для гарантированного порядка
 * @internal
 */
function isStableEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if ((a === null || a === undefined) && (b === null || b === undefined)) {
    return true;
  }

  if (!isJsonSerializable(a) || !isJsonSerializable(b)) {
    return false;
  }

  try {
    const canonicalA = stableKeySort(a);
    const canonicalB = stableKeySort(b);
    const serializedA = JSON.stringify(canonicalA);
    const serializedB = JSON.stringify(canonicalB);
    return serializedA === serializedB;
  } catch {
    return false;
  }
}

/* ============================================================================
 * 🔧 ENRICHMENT ENGINE — DEPENDENCY-DRIVEN EXECUTION
 * ============================================================================
 */

/**
 * Применяет один enricher к metadata map с детекцией конфликтов (stable serialization equality)
 * @internal
 */
function applyEnricherSignals(
  metadata: ReadonlyMap<string, unknown>,
  enricherSignals: ReadonlyMap<string, unknown>,
  observer?: EnrichmentObserver,
): { signals: ReadonlyMap<string, unknown>; errors: readonly EnrichmentError[]; } {
  const result = Array.from(enricherSignals.entries()).reduce<{
    signals: Map<string, unknown>;
    errors: EnrichmentError[];
  }>(
    (acc, [signal, value]) => {
      if (acc.signals.has(signal)) {
        const existingValue = acc.signals.get(signal);
        if (!isStableEqual(existingValue, value)) {
          const error = Object.freeze({
            kind: 'CONFLICTING_SIGNALS',
            signal,
          }) as EnrichmentError;
          if (error.kind === 'CONFLICTING_SIGNALS') {
            observer?.onConflictingSignals?.(error);
          }
          return {
            signals: acc.signals,
            errors: [...acc.errors, error],
          };
        }
        return acc;
      }

      return {
        signals: new Map([...Array.from(acc.signals.entries()), [signal, value]]),
        errors: acc.errors,
      };
    },
    { signals: new Map(metadata), errors: [] },
  );

  return {
    signals: Object.freeze(result.signals) as ReadonlyMap<string, unknown>,
    errors: Object.freeze(result.errors),
  };
}

/**
 * Проверяет зависимости enricher и собирает ошибки missing dependencies
 * @internal
 */
function checkDependencies<TContext = Record<string, unknown>>(
  enricher: ContextEnricher<TContext>,
  availableSignals: ReadonlyMap<string, unknown>,
): { hasMissingDeps: boolean; errors: readonly EnrichmentError[]; } {
  if (enricher.dependsOn === undefined) {
    return { hasMissingDeps: false, errors: Object.freeze([]) };
  }

  const missingDeps = enricher.dependsOn.filter((dep) => !availableSignals.has(dep));

  if (missingDeps.length === 0) {
    return { hasMissingDeps: false, errors: Object.freeze([]) };
  }

  const errors = missingDeps.map(
    (dep) =>
      Object.freeze({
        kind: 'MISSING_DEPENDENCY',
        enricher: enricher.name,
        dependency: dep,
      }) as EnrichmentError,
  );

  return {
    hasMissingDeps: true,
    errors: Object.freeze(errors),
  };
}

/**
 * Применяет один enricher с проверкой зависимостей
 * @internal
 */
function applySingleEnricher<TContext = Record<string, unknown>>(
  enricher: ContextEnricher<TContext>,
  context: TContext,
  allSignals: ReadonlyMap<string, unknown>,
  observer?: EnrichmentObserver,
): { signals: ReadonlyMap<string, unknown>; errors: readonly EnrichmentError[]; } {
  const depCheck = checkDependencies(enricher, allSignals);

  // Уведомляем observer о missing dependencies
  depCheck.errors.forEach((error) => {
    if (error.kind === 'MISSING_DEPENDENCY') {
      observer?.onMissingDependency?.(error);
    }
  });

  if (depCheck.hasMissingDeps) {
    const skippedError = Object.freeze({
      kind: 'SKIPPED_ENRICHER',
      enricher: enricher.name,
      reason: 'Missing required dependencies',
    }) as EnrichmentError;
    if (skippedError.kind === 'SKIPPED_ENRICHER') {
      observer?.onSkippedEnricher?.(skippedError);
    }
    return {
      signals: allSignals,
      errors: Object.freeze([...depCheck.errors, skippedError]),
    };
  }

  const result = enricher.enrich(context, allSignals);

  // Уведомляем observer об ошибках enricher
  result.errors.forEach((error) => {
    if (error.kind === 'ENRICHER_ERROR') {
      observer?.onEnricherError?.(error);
    }
  });

  const mergeResult = applyEnricherSignals(allSignals, result.signals, observer);

  return {
    signals: mergeResult.signals,
    errors: Object.freeze([...result.errors, ...mergeResult.errors]),
  };
}

/**
 * Применяет группу enrichers (invariants или policies)
 * @internal
 */
function applyEnricherGroup<TContext = Record<string, unknown>>(
  enrichers: readonly ContextEnricher<TContext>[],
  context: TContext,
  initialSignals: ReadonlyMap<string, unknown>,
  observer?: EnrichmentObserver,
): { signals: ReadonlyMap<string, unknown>; errors: readonly EnrichmentError[]; } {
  const cycle = detectCycles(enrichers);
  if (cycle !== null) {
    const error = Object.freeze({
      kind: 'CIRCULAR_DEPENDENCY',
      cycle,
    }) as EnrichmentError;
    if (error.kind === 'CIRCULAR_DEPENDENCY') {
      observer?.onCircularDependency?.(error);
    }
    return {
      signals: initialSignals,
      errors: Object.freeze([error]),
    };
  }

  const sorted = topologicalSort(enrichers);

  const result = sorted.reduce<{
    signals: ReadonlyMap<string, unknown>;
    errors: EnrichmentError[];
  }>(
    (acc, enricher) => {
      const enricherResult = applySingleEnricher(enricher, context, acc.signals, observer);
      return {
        signals: enricherResult.signals,
        errors: [...acc.errors, ...enricherResult.errors],
      };
    },
    { signals: initialSignals, errors: [] },
  );

  return {
    signals: result.signals,
    errors: Object.freeze(result.errors),
  };
}

/**
 * Применяет enrichers с signal-based dependency-driven execution и собирает все ошибки
 * @template TContext - Тип входного контекста
 * @note Invariants выполняются первыми, затем policies (оба с топологической сортировкой).
 *       Enricher пропускается, если его зависимости не выполнены (precondition enforcement)
 * @internal
 */
function applyEnrichers<TContext = Record<string, unknown>>(
  context: TContext, // Входной контекст для обогащения
  registry: EnricherRegistry<TContext> = defaultEnricherRegistry as EnricherRegistry<TContext>, // Registry enrichers
  observer?: EnrichmentObserver, // Опциональный observer для telemetry и логирования событий
): EnrichmentResult { // Результат обогащения (все сигналы и все ошибки)
  const initialSignals = Object.freeze(new Map<string, unknown>()) as ReadonlyMap<string, unknown>;

  const invariantResult = applyEnricherGroup(
    registry.invariants,
    context,
    initialSignals,
    observer,
  );
  const policyResult = applyEnricherGroup(
    registry.policies,
    context,
    invariantResult.signals,
    observer,
  );

  return Object.freeze({
    signals: policyResult.signals,
    errors: Object.freeze([...invariantResult.errors, ...policyResult.errors]),
  });
}

/**
 * Обогащает контекст метаданными через registry enrichers
 * @template TContext - Тип входного контекста
 *
 * @example const observer = { onSkippedEnricher: (e) => log.warn(e), onConflictingSignals: (e) => log.error(e) }; const result = enrichContext(context, registry, observer);
 * @public
 */
export function enrichContext<TContext = Record<string, unknown>>(
  context: TContext, // Входной контекст для обогащения
  registry: EnricherRegistry<TContext> = defaultEnricherRegistry as EnricherRegistry<TContext>, // Registry enrichers (по умолчанию defaultEnricherRegistry)
  observer?: EnrichmentObserver, // Опциональный observer для telemetry и логирования событий
): EnrichmentResult { // EnrichmentResult с сигналами и ошибками (non-fail-fast)
  return applyEnrichers(context, registry, observer);
}

/* ============================================================================
 * 2. EXTENSIBILITY HELPERS — REGISTRY BUILDERS
 * ============================================================================
 */

/**
 * Создает новый registry с добавленным enricher (immutable)
 * @template TContext - Тип входного контекста
 * @note Helper для динамического расширения registry без мутации.
 *       Проверяет, что каждый сигнал предоставляется только одним enricher (one signal = one provider)
 * @public
 */
export function registerEnricher<TContext = Record<string, unknown>>(
  registry: EnricherRegistry<TContext>, // Registry enrichers
  enricher: ContextEnricher<TContext>, // Enricher для добавления
  asInvariant: boolean = false, // Если true, добавляет в invariants, иначе в policies
): EnricherRegistry<TContext> { // Новый registry с добавленным enricher
  const allEnrichers = [...registry.invariants, ...registry.policies];
  const duplicate = allEnrichers.find((e) => e.name === enricher.name);
  if (duplicate !== undefined) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(`Context enricher "${enricher.name}" already exists in registry`);
  }

  const signalProviders = allEnrichers.reduce<Map<string, string>>(
    (acc, existingEnricher) => {
      return existingEnricher.provides.reduce<Map<string, string>>(
        (innerAcc, signal) => {
          const existingProvider = innerAcc.get(signal);
          if (existingProvider !== undefined) {
            // eslint-disable-next-line fp/no-throw
            throw new Error(
              `Signal "${signal}" is already provided by enricher "${existingProvider}". `
                + `Multi-provider signals are not allowed (one signal = one provider globally).`,
            );
          }
          return new Map([...Array.from(innerAcc.entries()), [signal, existingEnricher.name]]);
        },
        acc,
      );
    },
    new Map(),
  );

  enricher.provides.forEach((signal) => {
    const existingProvider = signalProviders.get(signal);
    if (existingProvider !== undefined) {
      // eslint-disable-next-line fp/no-throw
      throw new Error(
        `Signal "${signal}" is already provided by enricher "${existingProvider}". `
          + `Enricher "${enricher.name}" cannot provide the same signal. `
          + `Multi-provider signals are not allowed (one signal = one provider globally).`,
      );
    }
  });

  if (asInvariant) {
    return Object.freeze({
      invariants: Object.freeze([...registry.invariants, enricher]),
      policies: registry.policies,
    });
  }

  return Object.freeze({
    invariants: registry.invariants,
    policies: Object.freeze([...registry.policies, enricher]),
  });
}
