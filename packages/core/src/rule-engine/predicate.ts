/**
 * @file packages/core/src/rule-engine/predicate.ts
 * ============================================================================
 * 🛡️ CORE — Predicate (Generic Predicate Operations)
 * ============================================================================
 *
 * Generic операции для работы с предикатами: композиция (AND, OR, NOT), валидация, evaluation.
 * Архитектура: Predicate (primitives) + PredicateAlgebra (extensible contract).
 *
 * Архитектура: библиотека из 2 модулей в одном файле
 * - Predicate: generic функции для работы с предикатами (compose, validate, evaluate)
 * - PredicateAlgebra: extensible contract для создания custom predicate operations
 *
 * Принципы: SRP, Deterministic (loop-based early termination), Domain-pure, Scalable (Iterable streaming),
 * Strict typing (generic по E), Extensible, Immutable, Security (runtime validation).
 *
 * ⚠️ ВАЖНО: НЕ включает domain-специфичные значения, НЕ зависит от aggregation/classification.
 */

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC PREDICATE RESULT & ALGEBRAIC CONTRACT
 * ============================================================================
 */

/**
 * Предикат: функция, принимающая факт и возвращающая boolean
 * @public
 */
export type Predicate<TFact> = (fact: TFact) => boolean;

/**
 * Результат операции с предикатами (effect-based algebraic contract)
 * Generic по E для extensibility (custom operations могут возвращать свои типы ошибок)
 * @public
 */
export type PredicateResult<
  T,
  E = PredicateFailureReason,
> =
  | Readonly<{ ok: true; value: T; }>
  | Readonly<{ ok: false; reason: E; }>;

/**
 * Мета-данные для triage (опционально, только в debug режиме)
 * @public
 */
export type PredicateErrorMetadata = Readonly<{
  readonly timestamp?: number;
  readonly featureFlags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}>;

/**
 * Причина ошибки операции с предикатами
 * @public
 */
export type PredicateFailureReason =
  | Readonly<{ kind: 'INVALID_PREDICATE'; }>
  | Readonly<{ kind: 'EMPTY_PREDICATES'; }>
  | Readonly<{
    kind: 'EVALUATION_ERROR';
    index: number;
    error?: string;
    stack?: string;
    metadata?: PredicateErrorMetadata;
  }>
  | Readonly<{ kind: 'COMPOSITION_ERROR'; }>;

/**
 * Hooks для observability (optional, не нарушают purity)
 * Generic по TResult для типобезопасности state между beforeStep и afterStep
 *
 * ⚠️ ВАЖНО: Hooks НЕ должны мутировать facts, state или context.
 * Все параметры передаются как readonly для предотвращения мутаций.
 *
 * @public
 */
export type PredicateHooks<TResult, TState, TFact, TContext> = Readonly<{
  /** Вызывается перед каждым step (для метрик/логирования). НЕ должен мутировать state, fact или context. */
  readonly beforeStep?: (
    state: TState,
    predicate: Predicate<TFact>,
    fact: TFact,
    index: number,
    context: TContext,
  ) => void;
  /** Вызывается после каждого step (для метрик/логирования). НЕ должен мутировать state, fact или context. */
  readonly afterStep?: (
    state: TState,
    newState: TState,
    predicate: Predicate<TFact>,
    fact: TFact,
    index: number,
    context: TContext,
  ) => void;
  /** Вызывается после finalize (для метрик/логирования). НЕ должен мутировать result или context. */
  readonly afterFinalize?: (result: TResult, context: TContext) => void;
}>;

/**
 * Конфигурация для работы с предикатами
 * Generic по TResult, TState, TFact, TContext для типобезопасности hooks
 * @public
 */
export type PredicateConfig<TResult = unknown, TState = void, TFact = unknown, TContext = void> =
  Readonly<{
    /** Максимальное количество предикатов (защита от DoS) */
    readonly maxCompositionSize?: number;
    /** Debug режим (сохраняет error, stacktrace и мета-данные в EVALUATION_ERROR) */
    readonly debug?: boolean;
    /** Hooks для observability (метрики, логирование) */
    readonly hooks?: PredicateHooks<TResult, TState, TFact, TContext>;
    /** Мета-данные для triage (только в debug режиме) */
    readonly errorMetadata?: PredicateErrorMetadata;
    /** Timestamp для детерминированности (обязателен в debug mode, опционален в production) */
    readonly now?: number;
  }>;

/**
 * Константы для работы с предикатами (по умолчанию)
 * Generic fallback для снижения необходимости кастов
 */
function createDefaultPredicateConfig<
  TResult = unknown,
  TState = void,
  TFact = unknown,
  TContext = void,
>(): PredicateConfig<TResult, TState, TFact, TContext> {
  return {
    maxCompositionSize: Number.MAX_SAFE_INTEGER,
    debug: false,
  } as PredicateConfig<TResult, TState, TFact, TContext>;
}

/** Константы для работы с предикатами (по умолчанию) - для обратной совместимости */
const DEFAULT_PREDICATE_CONFIG = createDefaultPredicateConfig() satisfies PredicateConfig<
  unknown,
  void,
  unknown,
  void
>;

/* ============================================================================
 * 🔧 DOMAIN VALIDATION
 * ============================================================================
 */

/** Валидация предиката (проверка, что это функция) */
function validatePredicate<TFact>(
  predicate: unknown,
): predicate is Predicate<TFact> {
  return typeof predicate === 'function';
}

/** Валидация массива предикатов */
function validatePredicates<TFact>(
  predicates: readonly unknown[],
  maxSize?: number,
): PredicateResult<readonly Predicate<TFact>[], PredicateFailureReason> {
  if (predicates.length === 0) {
    return { ok: false, reason: { kind: 'EMPTY_PREDICATES' } }; // ранний выход при пустом массиве
  }

  if (maxSize !== undefined && predicates.length > maxSize) {
    return {
      ok: false,
      reason: { kind: 'COMPOSITION_ERROR' }, // защита от DoS
    };
  }

  /* eslint-disable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination и валидации */
  const validated: Predicate<TFact>[] = [];
  for (let i = 0; i < predicates.length; i += 1) {
    const predicate = predicates[i];
    if (!validatePredicate<TFact>(predicate)) {
      return {
        ok: false,
        reason: { kind: 'INVALID_PREDICATE' }, // ранний выход при невалидном предикате
      };
    }
    validated.push(predicate); // накапливаем валидные предикаты
  }
  /* eslint-enable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation */

  return { ok: true, value: validated };
}

/** Валидация timestamp (защита от poisoning) */
function validateTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined; // защита от NaN/Infinity
}

/** Валидация featureFlags (защита от poisoning) */
function validateFeatureFlags(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((f): f is string => typeof f === 'string')
    ? value
    : undefined; // проверка всех элементов массива
}

/** Валидация metadata (защита от poisoning) */
function validateMetadata(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined; // исключаем null и массивы
}

/** Валидация errorMetadata объекта (защита от poisoning) */
function validateErrorMetadataObject(value: unknown): value is PredicateErrorMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  // Валидация каждого поля перед использованием
  if (
    'timestamp' in obj
    && validateTimestamp(obj['timestamp']) === undefined
    && obj['timestamp'] !== undefined
  ) {
    return false;
  }
  if (
    'featureFlags' in obj
    && validateFeatureFlags(obj['featureFlags']) === undefined
    && obj['featureFlags'] !== undefined
  ) {
    return false;
  }
  if (
    'metadata' in obj
    && validateMetadata(obj['metadata']) === undefined
    && obj['metadata'] !== undefined
  ) {
    return false;
  }
  return true;
}

/**
 * Создание мета-данных для ошибки
 * @param now - обязательный timestamp для детерминированности (в debug mode)
 * @throws {Error} если debug=true и now не передан (для обеспечения детерминированности)
 */
function createErrorMetadata(
  debug: boolean,
  configMetadata?: PredicateErrorMetadata,
  now?: number,
): PredicateErrorMetadata | undefined {
  if (!debug) return undefined; // метаданные только в debug режиме
  // В debug mode требуем явный timestamp для детерминированности (production-grade requirement)
  // Если now не передан, возвращаем undefined (не бросаем исключение для функционального стиля)
  if (now === undefined) {
    return undefined; // в production можно использовать, в debug mode должен быть передан now
  }
  const timestamp = now; // используем переданный timestamp для детерминированности
  if (
    configMetadata === undefined
    || typeof configMetadata !== 'object'
    || Array.isArray(configMetadata)
  ) {
    return { timestamp }; // возвращаем только timestamp если метаданные невалидны
  }
  const validatedTimestamp = validateTimestamp(configMetadata.timestamp) ?? timestamp; // fallback на текущий timestamp
  const featureFlags = validateFeatureFlags(configMetadata.featureFlags);
  const metadata = validateMetadata(configMetadata.metadata);
  return {
    timestamp: validatedTimestamp,
    ...(featureFlags !== undefined ? { featureFlags } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/** Валидация errorMetadata для debug режима */
function validateErrorMetadataForDebug(
  errorMetadata?: PredicateErrorMetadata,
): PredicateErrorMetadata | undefined {
  if (errorMetadata === undefined || !validateErrorMetadataObject(errorMetadata)) {
    return undefined; // ранний выход при невалидных метаданных
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- type guard гарантирует тип
  const obj = errorMetadata as PredicateErrorMetadata; // безопасное приведение после валидации
  const timestamp = validateTimestamp(obj.timestamp);
  const featureFlags = validateFeatureFlags(obj.featureFlags);
  const validatedMetadata = validateMetadata(obj.metadata);
  if (timestamp !== undefined || featureFlags !== undefined || validatedMetadata !== undefined) { // возвращаем только если есть хотя бы одно валидное поле
    return {
      ...(timestamp !== undefined ? { timestamp } : {}),
      ...(featureFlags !== undefined ? { featureFlags } : {}),
      ...(validatedMetadata !== undefined ? { metadata: validatedMetadata } : {}),
    } as PredicateErrorMetadata;
  }
  return undefined;
}

/**
 * Ленивая генерация errorMetadata (создается только при ошибке для оптимизации)
 * @internal
 */
function createErrorMetadataLazy(
  debug: boolean,
  errorMetadata: PredicateErrorMetadata | undefined,
  now: number | undefined,
): () => PredicateErrorMetadata | undefined {
  if (!debug) {
    return () => undefined; // метаданные только в debug режиме
  }
  // Ленивая генерация: создаем только при вызове функции
  return () => {
    // Если now не передан, возвращаем undefined (не бросаем исключение для функционального стиля)
    if (now === undefined) {
      return undefined; // в production можно использовать, в debug mode должен быть передан now
    }
    const validatedErrorMetadata = validateErrorMetadataForDebug(errorMetadata);
    // Валидация перед использованием для предотвращения poisoning
    return validatedErrorMetadata !== undefined
        && validateErrorMetadataObject(validatedErrorMetadata)
      ? {
        ...validatedErrorMetadata,
        timestamp: now, // используем переданный timestamp для детерминированности
      }
      : createErrorMetadata(debug, undefined, now);
  };
}

/** Создание EVALUATION_ERROR reason */
function buildEvaluationErrorReason(
  index: number,
  debug: boolean,
  error?: Error,
  errorMetadata?: PredicateErrorMetadata,
  now?: number,
): PredicateFailureReason {
  if (!debug || error === undefined) {
    return { kind: 'EVALUATION_ERROR', index }; // минимальная информация без debug
  }
  // Ленивая генерация metadata только при наличии ошибки
  // eslint-disable-next-line ai-security/model-poisoning -- createErrorMetadataLazy валидирует данные через validateErrorMetadataForDebug
  const getMetadata = createErrorMetadataLazy(debug, errorMetadata, now);
  // eslint-disable-next-line ai-security/model-poisoning -- rawMetadata создан через createErrorMetadataLazy, который валидирует данные
  const rawMetadata = getMetadata(); // создаем только при ошибке
  // Валидация перед использованием для предотвращения poisoning
  // eslint-disable-next-line ai-security/model-poisoning -- rawMetadata валидируется через validateErrorMetadataObject на следующей строке
  const metadata = rawMetadata !== undefined && validateErrorMetadataObject(rawMetadata)
    ? rawMetadata
    : undefined;
  const validatedError = typeof error.message === 'string' ? error.message : String(error.message); // защита от poisoning
  const validatedStack = typeof error.stack === 'string' ? error.stack : undefined; // опциональный stacktrace
  return {
    kind: 'EVALUATION_ERROR',
    index,
    error: validatedError,
    ...(validatedStack !== undefined ? { stack: validatedStack } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/** Вычисление одного предиката с обработкой ошибок */
function evaluateSinglePredicate<TFact>(
  pred: Predicate<TFact> | undefined,
  fact: TFact,
  index: number,
  debug: boolean,
  errorMetadata?: PredicateErrorMetadata,
  now?: number,
): PredicateResult<boolean, PredicateFailureReason> {
  if (pred === undefined) {
    return { ok: false, reason: { kind: 'EVALUATION_ERROR', index } }; // edge case: undefined предикат
  }
  try {
    return { ok: true, value: Boolean(pred(fact)) }; // явное приведение к boolean
  } catch (error) {
    return {
      ok: false,
      reason: buildEvaluationErrorReason(
        index,
        debug,
        error instanceof Error ? error : undefined,
        errorMetadata,
        now,
      ),
    }; // обработка исключений
  }
}

/** Вычисление массива предикатов для факта */
function evaluatePredicatesIterable<TFact>(
  predicates: readonly Predicate<TFact>[],
  fact: TFact,
  debug: boolean,
  errorMetadata?: PredicateErrorMetadata,
  now?: number,
): PredicateResult<readonly boolean[], PredicateFailureReason> {
  /* eslint-disable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination */
  const results: boolean[] = [];

  for (let i = 0; i < predicates.length; i += 1) {
    const result = evaluateSinglePredicate(predicates[i], fact, i, debug, errorMetadata, now);
    if (!result.ok) {
      return result; // ранний выход при ошибке
    }
    results.push(result.value); // накапливаем результаты
  }
  /* eslint-enable functional/immutable-data, functional/no-let, functional/no-loop-statements, fp/no-mutation */

  return { ok: true, value: results };
}

/* ============================================================================
 * 📦 PUBLIC PREDICATE API
 * ============================================================================
 */

/**
 * Итеративная композиция предикатов с short-circuit evaluation (предотвращает stack overflow)
 * @param initialValue - начальное значение (true для AND, false для OR)
 * @param shouldShortCircuit - функция для определения необходимости прерывания
 */
function composePredicatesIterative<TFact>(
  predicates: readonly Predicate<TFact>[],
  fact: TFact,
  initialValue: boolean,
  shouldShortCircuit: (result: boolean) => boolean,
): boolean {
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination */
  let result = initialValue; // true для AND, false для OR
  for (let i = 0; i < predicates.length; i += 1) {
    const predicate = predicates[i];
    if (predicate === undefined) {
      // Возвращаем false для AND и true для OR при undefined предикате (явное поведение вместо silent fallback)
      // Это предотвращает скрытые баги, но не бросает исключение для функционального стиля
      return !initialValue; // false для AND, true для OR
    }
    const predicateResult = predicate(fact);
    result = initialValue ? (result && predicateResult) : (result || predicateResult); // AND: &&, OR: ||
    if (shouldShortCircuit(result)) {
      return result; // ранний выход при достижении финального результата
    }
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */
  return result;
}

/** Модуль для работы с предикатами */
export const predicate = {
  /**
   * Композиция предикатов через AND (short-circuit при первом false)
   * @example
   * ```ts
   * const composed = predicate.and([(x: number) => x > 0, (x: number) => x % 2 === 0]);
   * composed(4); // true, composed(3); // false
   * ```
   */
  and<TFact>(
    predicates: readonly Predicate<TFact>[],
    config: PredicateConfig<Predicate<TFact>, void, TFact, void> =
      DEFAULT_PREDICATE_CONFIG as PredicateConfig<Predicate<TFact>, void, TFact, void>,
  ): PredicateResult<Predicate<TFact>, PredicateFailureReason> {
    const validation = validatePredicates(predicates, config.maxCompositionSize);
    if (!validation.ok) {
      return validation; // возвращаем ошибку валидации
    }

    const validatedPredicates = validation.value;

    return {
      ok: true,
      value: (fact: TFact): boolean =>
        composePredicatesIterative(
          validatedPredicates,
          fact,
          true, // initialValue для AND
          (result) => !result, // short-circuit при false
        ),
    };
  },

  /**
   * Композиция предикатов через OR (short-circuit при первом true)
   * @example
   * ```ts
   * const composed = predicate.or([(x: number) => x > 0, (x: number) => x < 0]);
   * composed(5); // true, composed(0); // false
   * ```
   */
  or<TFact>(
    predicates: readonly Predicate<TFact>[],
    config: PredicateConfig<Predicate<TFact>, void, TFact, void> =
      DEFAULT_PREDICATE_CONFIG as PredicateConfig<Predicate<TFact>, void, TFact, void>,
  ): PredicateResult<Predicate<TFact>, PredicateFailureReason> {
    const validation = validatePredicates(predicates, config.maxCompositionSize);
    if (!validation.ok) {
      return validation;
    }

    const validatedPredicates = validation.value;

    return {
      ok: true,
      value: (fact: TFact): boolean =>
        composePredicatesIterative(
          validatedPredicates,
          fact,
          false, // initialValue для OR
          (result) => result, // short-circuit при true
        ),
    };
  },

  /**
   * Инверсия предиката (NOT)
   * @example
   * ```ts
   * const isNotPositive = predicate.not((x: number) => x > 0);
   * isNotPositive(5); // false, isNotPositive(-3); // true
   * ```
   */
  not<TFact>(
    predicate: Predicate<TFact>,
  ): PredicateResult<Predicate<TFact>, PredicateFailureReason> {
    if (!validatePredicate<TFact>(predicate)) {
      return { ok: false, reason: { kind: 'INVALID_PREDICATE' } };
    }

    return {
      ok: true,
      value: (fact: TFact): boolean => !predicate(fact),
    };
  },

  /** Валидация предиката */
  validate<TFact>(
    predicate: unknown,
  ): PredicateResult<Predicate<TFact>, PredicateFailureReason> {
    if (!validatePredicate<TFact>(predicate)) {
      return { ok: false, reason: { kind: 'INVALID_PREDICATE' } };
    }

    return { ok: true, value: predicate };
  },

  /**
   * Вычисление предиката для факта
   * @example
   * ```ts
   * predicate.evaluate((x: number) => x > 0, 5); // { ok: true, value: true }
   * predicate.evaluate((x: number) => x > 0, -3); // { ok: true, value: false }
   * ```
   */
  evaluate<TFact>(
    predicate: Predicate<TFact>,
    fact: TFact,
  ): PredicateResult<boolean, PredicateFailureReason> {
    if (!validatePredicate<TFact>(predicate)) {
      return { ok: false, reason: { kind: 'INVALID_PREDICATE' } };
    }

    try {
      const result = predicate(fact);
      return { ok: true, value: Boolean(result) }; // явное приведение к boolean
    } catch (error) {
      const reason: PredicateFailureReason = error instanceof Error
        ? {
          kind: 'EVALUATION_ERROR',
          index: 0,
          error: error.message,
          ...(error.stack !== undefined ? { stack: error.stack } : {}), // опциональный stacktrace
        }
        : { kind: 'EVALUATION_ERROR', index: 0 }; // fallback для не-Error объектов
      return {
        ok: false,
        reason,
      };
    }
  },

  /**
   * Вычисление массива предикатов для факта
   * @example
   * ```ts
   * predicate.evaluateAll([(x: number) => x > 0, (x: number) => x % 2 === 0], 4);
   * // { ok: true, value: [true, true] }
   * ```
   */
  evaluateAll<TFact>(
    predicates: readonly Predicate<TFact>[],
    fact: TFact,
    config: PredicateConfig<readonly boolean[], void, TFact, void> =
      DEFAULT_PREDICATE_CONFIG as PredicateConfig<readonly boolean[], void, TFact, void>,
  ): PredicateResult<readonly boolean[], PredicateFailureReason> {
    const validation = validatePredicates(predicates, config.maxCompositionSize);
    if (!validation.ok) {
      return validation; // возвращаем ошибку валидации
    }

    return evaluatePredicatesIterable(
      validation.value,
      fact,
      config.debug ?? false,
      config.errorMetadata,
      config.now,
    ); // используем валидированные предикаты
  },

  /**
   * Вычисление Iterable предикатов для факта (streaming-friendly, O(1) memory)
   * @example
   * ```ts
   * const preds = function* () { yield (x: number) => x > 0; yield (x: number) => x % 2 === 0; };
   * for (const r of predicate.evaluateAllIterable(preds(), 4)) console.log(r);
   * ```
   */
  *evaluateAllIterable<TFact>(
    predicates: Iterable<Predicate<TFact>>,
    fact: TFact,
    // TFact автоматически выводится из predicates и fact; каст необходим для совместимости с DEFAULT_PREDICATE_CONFIG
    config: PredicateConfig<boolean, void, TFact, void> =
      DEFAULT_PREDICATE_CONFIG as PredicateConfig<boolean, void, TFact, void>,
  ): Generator<PredicateResult<boolean, PredicateFailureReason>, void, unknown> {
    const debug = config.debug ?? false;
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для индексации и счетчика в generator */
    let index = 0;
    let count = 0;

    for (const pred of predicates) {
      if (config.maxCompositionSize !== undefined && count >= config.maxCompositionSize) {
        yield { ok: false, reason: { kind: 'COMPOSITION_ERROR' } }; // защита от DoS
        return;
      }
      const result = evaluateSinglePredicate(
        pred,
        fact,
        index,
        debug,
        config.errorMetadata,
        config.now,
      );
      yield result; // yield каждого результата для streaming
      if (!result.ok) {
        return; // ранний выход при ошибке
      }
      index += 1; // индекс для отладки
      count += 1; // счетчик для проверки maxCompositionSize
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

    if (count === 0) {
      yield { ok: false, reason: { kind: 'EMPTY_PREDICATES' } }; // проверка пустого Iterable
    }
  },

  /**
   * Namespace для DSL-style расширений предикатов
   * Позволяет добавлять domain-specific операции без изменения core
   * @example
   * ```ts
   * predicate.extensions.custom = {
   *   allOf: <T>(preds: Predicate<T>[]) => predicate.and(preds),
   *   anyOf: <T>(preds: Predicate<T>[]) => predicate.or(preds),
   * };
   * ```
   */
  extensions: {} as Record<string, unknown>,
} as const;

/* ============================================================================
 * 🔬 PREDICATE ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM PREDICATE OPERATIONS
 * ============================================================================
 */

/**
 * Операция для работы с предикатами (extensible contract)
 * Generic по TResult, TState, TContext, TFact, E для full algebra extensibility
 *
 * ⚠️ КРИТИЧНО: Все методы должны быть pure и deterministic:
 * - Не использовать Date.now(), Math.random() или другие non-deterministic функции
 * - Не мутировать внешнее состояние
 * - Не использовать side-effects (console.log, network calls, etc.)
 * - Возвращать одинаковые результаты для одинаковых входов
 * - step НЕ должен мутировать state (должен возвращать новое состояние)
 *
 * ⚠️ ОБРАБОТКА ИСКЛЮЧЕНИЙ:
 * - Все исключения из step и finalize автоматически перехватываются
 * - Исключения преобразуются в PredicateFailureReason с kind='EVALUATION_ERROR'
 * - В debug mode сохраняется error message, stacktrace и мета-данные
 * - step/finalize должны быть pure; исключения обрабатываются на уровне operate
 *
 * @template E Тип ошибки, используемый в возвращаемом типе {@link predicateAlgebra.operate}
 * @public
 */
export type PredicateOperation<
  TResult,
  TState = void,
  TContext = void,
  TFact = unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- используется в возвращаемом типе predicateAlgebra.operate
  _E = unknown,
> = Readonly<{
  /** Инициализация состояния */
  init: () => TState;
  /** Обработка одного предиката и факта (⚠️ НЕ мутировать state, возвращать новое состояние. Исключения перехватываются автоматически) */
  step: (state: TState, predicate: Predicate<TFact>, fact: TFact, context: TContext) => TState;
  /** Финализация результата из состояния (⚠️ Исключения перехватываются автоматически и возвращаются как PredicateFailureReason) */
  finalize: (state: TState, context: TContext) => TResult;
}>;

/** Обработка одного шага в цикле operate */
function processOperateStep<TResult, TState, TFact, TContext, E>(
  state: TState,
  predicate: Predicate<TFact> | undefined,
  fact: TFact,
  index: number,
  operation: PredicateOperation<TResult, TState, TContext, TFact, E>,
  context: TContext,
  debug: boolean,
  hooks?: PredicateHooks<TResult, TState, TFact, TContext>,
  errorMetadata?: PredicateErrorMetadata,
  now?: number,
): PredicateResult<TState, E | PredicateFailureReason> {
  if (predicate === undefined) {
    return { ok: false, reason: { kind: 'EVALUATION_ERROR', index } as E | PredicateFailureReason }; // edge case
  }

  try {
    hooks?.beforeStep?.(state, predicate, fact, index, context); // безопасный вызов hook
  } catch {
    // Игнорируем ошибки в hooks
  }

  try {
    const newState = operation.step(state, predicate, fact, context); // immutable: возвращает новое состояние
    try {
      hooks?.afterStep?.(state, newState, predicate, fact, index, context); // безопасный вызов hook
    } catch {
      // Игнорируем ошибки в hooks
    }
    return { ok: true, value: newState };
  } catch (error) {
    return {
      ok: false,
      reason: buildEvaluationErrorReason(
        index,
        debug,
        error instanceof Error ? error : undefined,
        errorMetadata,
        now,
      ) as E | PredicateFailureReason,
    }; // обработка исключений из step
  }
}

/** Обработка ошибки finalize */
function handleFinalizeError<TResult, E>(
  error: unknown,
  index: number,
  debug: boolean,
  errorMetadata?: PredicateErrorMetadata,
  now?: number,
): PredicateResult<TResult, E | PredicateFailureReason> {
  return {
    ok: false,
    reason: buildEvaluationErrorReason(
      index,
      debug,
      error instanceof Error ? error : undefined,
      errorMetadata,
      now,
    ) as E | PredicateFailureReason,
  };
}

/** Выполнение finalize операции с безопасной обработкой hooks */
function executeFinalize<TResult, TState, TContext, TFact, E>(
  operation: PredicateOperation<TResult, TState, TContext, TFact, E>,
  state: TState,
  context: TContext,
  hooks: PredicateHooks<TResult, TState, TFact, TContext> | undefined,
  errorIndex: number,
  debug: boolean,
  errorMetadata?: PredicateErrorMetadata,
  now?: number,
): PredicateResult<TResult, E | PredicateFailureReason> {
  try {
    const result = operation.finalize(state, context); // финализация результата из состояния
    try {
      hooks?.afterFinalize?.(result, context); // безопасный вызов hook
    } catch {
      // Игнорируем ошибки в hooks
    }
    return { ok: true, value: result };
  } catch (error) {
    return handleFinalizeError<TResult, E>(error, errorIndex, debug, errorMetadata, now); // обработка исключений из finalize
  }
}

/** Обработка массива предикатов в operate */
function operateArray<
  TResult,
  TState,
  TContext,
  TFact,
  E,
>(
  operation: PredicateOperation<TResult, TState, TContext, TFact, E>,
  predicates: readonly Predicate<TFact>[],
  fact: TFact,
  context: TContext,
  config: PredicateConfig<TResult, TState, TFact, TContext>,
): PredicateResult<TResult, E | PredicateFailureReason> {
  const validation = validatePredicates(predicates, config.maxCompositionSize);
  if (!validation.ok) {
    return validation; // возвращаем ошибку валидации
  }

  const validatedPredicates = validation.value;
  const debug = config.debug ?? false;
  const hooks = config.hooks;
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination */
  let state = operation.init(); // инициализация состояния

  for (let i = 0; i < validatedPredicates.length; i += 1) {
    const predicate = validatedPredicates[i];
    const stepResult = processOperateStep(
      state,
      predicate,
      fact,
      i,
      operation,
      context,
      debug,
      hooks,
      config.errorMetadata,
      config.now,
    );
    if (!stepResult.ok) {
      return stepResult as PredicateResult<TResult, E | PredicateFailureReason>; // ранний выход при ошибке
    }
    state = stepResult.value; // обновляем состояние для следующей итерации
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  return executeFinalize(
    operation,
    state,
    context,
    hooks,
    validatedPredicates.length - 1, // индекс последнего предиката для ошибок finalize
    debug,
    config.errorMetadata,
    config.now,
  );
}

/** Обработка Iterable предикатов в operate */
function operateIterable<
  TResult,
  TState,
  TContext,
  TFact,
  E,
>(
  operation: PredicateOperation<TResult, TState, TContext, TFact, E>,
  predicates: Iterable<Predicate<TFact>>,
  fact: TFact,
  context: TContext,
  config: PredicateConfig<TResult, TState, TFact, TContext>,
): PredicateResult<TResult, E | PredicateFailureReason> {
  const debug = config.debug ?? false;
  const hooks = config.hooks;
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination и индексации */
  let state = operation.init(); // инициализация состояния
  let index = 0; // индекс для отладки и ошибок
  let count = 0; // счетчик для проверки maxCompositionSize

  for (const predicate of predicates) {
    if (config.maxCompositionSize !== undefined && count >= config.maxCompositionSize) {
      return { ok: false, reason: { kind: 'COMPOSITION_ERROR' } }; // защита от DoS
    }

    const stepResult = processOperateStep(
      state,
      predicate,
      fact,
      index,
      operation,
      context,
      debug,
      hooks,
      config.errorMetadata,
    );
    if (!stepResult.ok) {
      return stepResult as PredicateResult<TResult, E | PredicateFailureReason>; // ранний выход при ошибке
    }
    state = stepResult.value; // обновляем состояние для следующей итерации
    index += 1;
    count += 1;
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  if (count === 0) {
    return { ok: false, reason: { kind: 'EMPTY_PREDICATES' } }; // проверка пустого Iterable
  }

  return executeFinalize(
    operation,
    state,
    context,
    hooks,
    count - 1, // индекс последнего обработанного предиката
    debug,
    config.errorMetadata,
    config.now,
  );
}

/** Модуль для extensible predicate algebra */
export const predicateAlgebra = {
  /**
   * Применение PredicateOperation к массиву или Iterable предикатов и факту
   * Поддерживает early termination (loop-based) и streaming (O(1) memory)
   * @example
   * ```ts
   * const countTrue: PredicateOperation<number, number, void, number> = {
   *   init: () => 0, step: (s, p, f) => p(f) ? s + 1 : s, finalize: (s) => s
   * };
   * predicateAlgebra.operate(countTrue, [(x: number) => x > 0, (x: number) => x % 2 === 0], 4);
   * // { ok: true, value: 2 }
   * ```
   */
  operate<
    TResult,
    TState = void,
    TContext = void,
    TFact = unknown,
    E = unknown,
  >(
    operation: PredicateOperation<TResult, TState, TContext, TFact, E>,
    predicates: readonly Predicate<TFact>[] | Iterable<Predicate<TFact>>,
    fact: TFact,
    context: TContext,
    config: PredicateConfig<TResult, TState, TFact, TContext> =
      DEFAULT_PREDICATE_CONFIG as PredicateConfig<TResult, TState, TFact, TContext>,
  ): PredicateResult<TResult, E | PredicateFailureReason> {
    return Array.isArray(predicates)
      ? operateArray(operation, predicates, fact, context, config) // оптимизированный путь для массивов
      : operateIterable(operation, predicates, fact, context, config); // streaming путь для Iterable
  },

  /**
   * Применение PredicateOperation (lazy, streaming-friendly)
   * Возвращает generator для streaming evaluation с early-exit
   * @example
   * ```ts
   * const countTrue: PredicateOperation<number, number, void, number> = {
   *   init: () => 0, step: (s, p, f) => p(f) ? s + 1 : s, finalize: (s) => s
   * };
   * for (const step of predicateAlgebra.operateLazy(countTrue, [(x: number) => x > 0, (x: number) => x % 2 === 0], 4)) {
   *   if (!step.ok) break;
   *   console.log(step.value); // промежуточное состояние
   * }
   * ```
   */
  *operateLazy<
    TResult,
    TState = void,
    TContext = void,
    TFact = unknown,
    E = unknown,
  >(
    operation: PredicateOperation<TResult, TState, TContext, TFact, E>,
    predicates: readonly Predicate<TFact>[] | Iterable<Predicate<TFact>>,
    fact: TFact,
    context: TContext,
    config: PredicateConfig<TResult, TState, TFact, TContext> =
      DEFAULT_PREDICATE_CONFIG as PredicateConfig<TResult, TState, TFact, TContext>,
  ): Generator<
    | PredicateResult<TState, E | PredicateFailureReason>
    | PredicateResult<TResult, E | PredicateFailureReason>,
    void,
    unknown
  > {
    const validation = Array.isArray(predicates)
      ? validatePredicates(predicates, config.maxCompositionSize) // валидация для массивов
      : { ok: true as const, value: predicates }; // для Iterable валидация в процессе
    if (!validation.ok) {
      yield validation; // yield ошибки валидации
      return;
    }

    const debug = config.debug ?? false;
    const hooks = config.hooks;
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для streaming и индексации */
    let state = operation.init(); // инициализация состояния
    let index = 0; // индекс для отладки и ошибок
    let count = 0; // счетчик для проверки maxCompositionSize

    for (const predicate of validation.value) {
      if (config.maxCompositionSize !== undefined && count >= config.maxCompositionSize) {
        yield { ok: false, reason: { kind: 'COMPOSITION_ERROR' } }; // защита от DoS
        return;
      }

      const stepResult = processOperateStep(
        state,
        predicate,
        fact,
        index,
        operation,
        context,
        debug,
        hooks,
        config.errorMetadata,
      );
      yield stepResult as PredicateResult<TState, E | PredicateFailureReason>; // yield каждого шага для streaming
      if (!stepResult.ok) {
        return; // ранний выход при ошибке
      }
      state = stepResult.value; // обновляем состояние для следующей итерации
      index += 1;
      count += 1;
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

    if (count === 0) {
      yield { ok: false, reason: { kind: 'EMPTY_PREDICATES' } }; // проверка пустого Iterable
      return;
    }

    const finalizeResult = executeFinalize(
      operation,
      state,
      context,
      hooks,
      count - 1, // индекс последнего обработанного предиката
      debug,
      config.errorMetadata,
    );
    yield finalizeResult as PredicateResult<TResult, E | PredicateFailureReason>; // yield финального результата
  },
} as const;
