/**
 * @file packages/core/src/aggregation/reducer.ts
 * ============================================================================
 * 🛡️ CORE — Reducer (Generic Aggregation Semantics)
 * ============================================================================
 *
 * Generic reducer для агрегации значений с весами в domain-kit.
 * Reducer = чистые функции для редукции массивов значений (sum, average, weighted average, min, max).
 *
 * Архитектура: библиотека из 3 модулей в одном файле
 * - WeightedValue: тип для значений с весами
 * - Reducer: generic функции редукции с единым algebraic contract (ReduceResult)
 * - ReducerAlgebra: extensible contract для создания custom aggregators
 *
 * Принципы:
 * - ✅ SRP: единый algebraic contract (ReduceResult) для всех функций, validation отдельно
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты, без silent normalization, array API = thin wrapper над streaming
 * - ✅ Domain-pure: без side-effects, платформо-агностично, только generic math
 * - ✅ Microservice-ready: runtime validation предотвращает cross-service inconsistency, IEEE-754 совместимость
 * - ✅ Scalable: extensible через ReducerAlgebra (generic по TResult), поддержка Iterable для streaming (O(n), zero allocations)
 * - ✅ Strict typing: generic types без domain-специфичных значений, ReducerAlgebra не валидирует значения (responsibility aggregator)
 * - ✅ Extensible: domain определяет стратегию агрегации через ReducerAlgebra без изменения core
 * - ✅ Immutable: все операции возвращают новые значения
 * - ✅ Security: runtime validation NaN/Infinity, проверка переполнения произведения (value * weight), IEEE-754 MIN_NORMAL для numeric underflow
 *
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения (SAFE/SUSPICIOUS/DANGEROUS - это domain labels)
 * - ❌ НЕ нормализует веса автоматически (normalization - ответственность caller)
 * - ❌ НЕ требует нормализации весов к 1.0 (поддерживает любые относительные веса)
 */

/* ============================================================================
 * 🧩 ТИПЫ — GENERIC WEIGHTED VALUE & ALGEBRAIC RESULT
 * ============================================================================
 */

/**
 * WeightedValue: значение с весом для weighted aggregation
 * @template T - Тип значения (number, Confidence, EvaluationLevel, etc.)
 * @public
 */
export type WeightedValue<T> = Readonly<{
  /** Значение для агрегации */
  readonly value: T;
  /** Вес значения (должен быть >= 0, обычно нормализуется к сумме 1.0 caller'ом) */
  readonly weight: number;
}>;

/**
 * Результат редукции (effect-based, единый algebraic contract)
 * Все reducer функции возвращают ReduceResult для composability
 * @template T - Тип результата
 * @public
 */
export type ReduceResult<T> =
  | Readonly<{ ok: true; value: T; }>
  | Readonly<{ ok: false; reason: ReduceFailureReason; }>;

/**
 * Причина ошибки редукции
 * @public
 */
export type ReduceFailureReason =
  | Readonly<{ kind: 'EMPTY_ARRAY'; }>
  | Readonly<{ kind: 'INVALID_WEIGHT'; index: number; weight: number; }>
  | Readonly<{ kind: 'ZERO_TOTAL_WEIGHT'; sum: number; }>
  | Readonly<{ kind: 'NUMERIC_UNDERFLOW'; sum: number; }>
  | Readonly<{ kind: 'NAN_RESULT'; }>
  | Readonly<{ kind: 'INFINITY_RESULT'; }>
  | Readonly<{ kind: 'LENGTH_MISMATCH'; valuesLength: number; weightsLength: number; }>
  | Readonly<{ kind: 'INVALID_VALUE'; index: number; value: number; }>;

/**
 * Конфигурация для валидации весов
 * @public
 */
export type WeightValidationConfig = Readonly<{
  /** Минимальное допустимое значение веса */
  readonly minWeight: number;
}>;

/**
 * Константы для валидации весов (по умолчанию)
 * @internal
 */
const DEFAULT_WEIGHT_VALIDATION: WeightValidationConfig = {
  /** Минимальное допустимое значение веса */
  minWeight: 0,
} as const;

/* ============================================================================
 * 🔒 INTERNAL — VALIDATION HELPERS
 * ============================================================================
 */

/**
 * Проверяет валидность веса
 * @internal
 */
function isValidWeight(
  weight: number,
  config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION,
): boolean {
  return Number.isFinite(weight) && weight >= config.minWeight;
}

/**
 * Проверяет валидность числового результата (NaN/Infinity)
 * @internal
 */
function isValidNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Проверяет валидность суммы весов для деления
 * Различает два случая: все веса равны нулю (ZERO_TOTAL_WEIGHT) и numeric underflow (NUMERIC_UNDERFLOW)
 * @internal
 */
function validateWeightSum(sum: number): ReduceResult<void> {
  if (!isValidNumber(sum)) {
    return {
      ok: false,
      reason: { kind: 'NAN_RESULT' },
    };
  }

  if (sum === 0) {
    return {
      ok: false,
      reason: {
        kind: 'ZERO_TOTAL_WEIGHT',
        sum: 0,
      },
    };
  }

  // Проверка на numeric underflow (делитель слишком мал для безопасного деления)
  /**
   * IEEE-754 double precision minimum positive NORMAL value.
   * Ниже этого порога числа становятся subnormal и теряют детерминированное округление.
   * Требуется для кросс-языковой воспроизводимости (JS / JVM / Rust / C++).
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention -- IEEE-754 стандартное имя константы
  const IEEE754_MIN_NORMAL = 2.2250738585072014e-308;
  if (Math.abs(sum) <= IEEE754_MIN_NORMAL) {
    return {
      ok: false,
      reason: {
        kind: 'NUMERIC_UNDERFLOW',
        sum,
      },
    };
  }

  return { ok: true, value: undefined };
}

/**
 * Валидирует weight и value для streaming weighted average
 * @internal
 */
function validateWeightedValue(
  weight: number,
  value: number,
  index: number,
  config: WeightValidationConfig,
): ReduceResult<void> {
  if (!isValidWeight(weight, config)) {
    return {
      ok: false,
      reason: {
        kind: 'INVALID_WEIGHT',
        index,
        weight,
      },
    };
  }

  if (!isValidNumber(value)) {
    return {
      ok: false,
      reason: {
        kind: 'INVALID_VALUE',
        index,
        value,
      },
    };
  }

  // Проверка переполнения произведения (переполнение возникает от value * weight, не от weight)
  const product = value * weight;
  if (!Number.isFinite(product)) {
    return {
      ok: false,
      reason: { kind: 'INFINITY_RESULT' },
    };
  }

  return { ok: true, value: undefined };
}

/* ============================================================================
 * 🔢 REDUCER — GENERIC REDUCTION FUNCTIONS (UNIFIED ALGEBRAIC CONTRACT)
 * ============================================================================
 */

/**
 * Reducer: generic функции для редукции массивов значений
 * Чистые функции без side-effects, только generic math
 * Все функции возвращают ReduceResult для composability
 * @public
 */
export const reducer = {
  /**
   * Суммирует массив чисел
   * @param values - Массив чисел для суммирования
   * @returns ReduceResult с суммой или ошибкой
   * @example
   * ```ts
   * reducer.sum([1, 2, 3, 4, 5]); // 15
   * ```
   */
  sum(values: readonly number[]): ReduceResult<number> {
    if (values.length === 0) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    // Валидация всех значений перед суммированием
    const invalidValueIndex = values.findIndex((value) => !isValidNumber(value));

    if (invalidValueIndex !== -1) {
      const value = values[invalidValueIndex];
      return {
        ok: false,
        reason: {
          kind: 'INVALID_VALUE',
          index: invalidValueIndex,
          value: value ?? NaN,
        },
      };
    }

    // Kahan summation для высокой точности через reduce
    const sum = values.reduce<{ sum: number; compensation: number; }>(
      (acc, value) => {
        const y = value - acc.compensation;
        const t = acc.sum + y;
        const compensation = (t - acc.sum) - y;
        return { sum: t, compensation };
      },
      { sum: 0, compensation: 0 },
    ).sum;

    if (!isValidNumber(sum)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    return {
      ok: true,
      value: sum,
    };
  },

  /**
   * Вычисляет среднее арифметическое массива чисел
   * @param values - Массив чисел для усреднения
   * @returns ReduceResult со средним значением или ошибкой
   * @example
   * ```ts
   * reducer.average([1, 2, 3, 4, 5]); // 3
   * ```
   */
  average(values: readonly number[]): ReduceResult<number> {
    const sumResult = reducer.sum(values);
    if (!sumResult.ok) {
      return sumResult;
    }

    return {
      ok: true,
      value: sumResult.value / values.length,
    };
  },

  /**
   * Вычисляет взвешенное среднее: (∑wᵢxᵢ) / (∑wᵢ)
   * Поддерживает любые относительные веса (не требует нормализации к 1.0)
   * @param values - Массив чисел для усреднения
   * @param weights - Массив весов (должен совпадать по длине с values)
   * @param config - Конфигурация валидации весов (опционально)
   * @returns ReduceResult со взвешенным средним или ошибкой
   * @example
   * ```ts
   * reducer.weightedAverage([10, 20, 30], [0.2, 0.3, 0.5]); // 23
   * reducer.weightedAverage([10, 20, 30], [2, 3, 5]); // 23 (относительные веса)
   * ```
   */
  weightedAverage(
    values: readonly number[],
    weights: readonly number[],
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION,
  ): ReduceResult<number> {
    // Валидация длины массивов
    if (values.length === 0) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    if (values.length !== weights.length) {
      return {
        ok: false,
        reason: {
          kind: 'LENGTH_MISMATCH',
          valuesLength: values.length,
          weightsLength: weights.length,
        },
      };
    }

    // Array API - thin wrapper над streaming API (canonical algorithm)
    // Streaming является source of truth для rule-engine primitive
    // Обеспечивает одинаковый алгоритм, числовую ошибку и error semantics для batch и streaming
    function* toWeighted(): Iterable<WeightedValue<number>> {
      // Generator требует loop для streaming - это единственный способ без материализации массива
      // eslint-disable-next-line functional/no-loop-statements -- generator требует for...of для streaming
      for (const [i, value] of values.entries()) {
        const weight = weights[i];
        if (weight !== undefined) {
          yield { value, weight };
        }
      }
    }

    return reducer.weightedAverageFromIterable(toWeighted(), config);
  },

  /**
   * Находит минимальное значение в массиве
   * ⚠️ FAIL при любом invalid элементе (NaN/Infinity)
   * @param values - Массив чисел
   * @returns ReduceResult с минимальным значением или ошибкой
   * @example
   * ```ts
   * reducer.min([5, 2, 8, 1, 9]); // 1
   * ```
   */
  min(values: readonly number[]): ReduceResult<number> {
    if (values.length === 0) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    const first = values[0];
    if (first === undefined || !isValidNumber(first)) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_VALUE',
          index: 0,
          value: first ?? NaN,
        },
      };
    }

    // Валидация всех значений перед поиском минимума
    const invalidValueIndex = values.findIndex((value, index) => {
      if (index === 0) {
        return false; // first уже проверен
      }
      return !isValidNumber(value);
    });

    if (invalidValueIndex !== -1) {
      const value = values[invalidValueIndex];
      return {
        ok: false,
        reason: {
          kind: 'INVALID_VALUE',
          index: invalidValueIndex,
          value: value ?? NaN,
        },
      };
    }

    const minResult = values.reduce<number>((acc, value) => {
      return value < acc ? value : acc;
    }, first);

    return {
      ok: true,
      value: minResult,
    };
  },

  /**
   * Находит максимальное значение в массиве
   * ⚠️ FAIL при любом invalid элементе (NaN/Infinity)
   * @param values - Массив чисел
   * @returns ReduceResult с максимальным значением или ошибкой
   * @example
   * ```ts
   * reducer.max([5, 2, 8, 1, 9]); // 9
   * ```
   */
  max(values: readonly number[]): ReduceResult<number> {
    if (values.length === 0) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    const first = values[0];
    if (first === undefined || !isValidNumber(first)) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_VALUE',
          index: 0,
          value: first ?? NaN,
        },
      };
    }

    // Валидация всех значений перед поиском максимума
    const invalidValueIndex = values.findIndex((value, index) => {
      if (index === 0) {
        return false; // first уже проверен
      }
      return !isValidNumber(value);
    });

    if (invalidValueIndex !== -1) {
      const value = values[invalidValueIndex];
      return {
        ok: false,
        reason: {
          kind: 'INVALID_VALUE',
          index: invalidValueIndex,
          value: value ?? NaN,
        },
      };
    }

    const maxResult = values.reduce<number>((acc, value) => {
      return value > acc ? value : acc;
    }, first);

    return {
      ok: true,
      value: maxResult,
    };
  },

  /**
   * Вычисляет взвешенное среднее для массива WeightedValue
   * ⚠️ НЕ нормализует веса автоматически
   * @param weightedValues - Массив значений с весами
   * @param config - Конфигурация валидации весов (опционально)
   * @returns ReduceResult со взвешенным средним или ошибкой
   * @example
   * ```ts
   * reducer.weightedAverageFromWeightedValues([
   *   { value: 10, weight: 0.2 },
   *   { value: 20, weight: 0.3 },
   *   { value: 30, weight: 0.5 },
   * ]); // 23
   * ```
   */
  weightedAverageFromWeightedValues(
    weightedValues: readonly WeightedValue<number>[],
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION,
  ): ReduceResult<number> {
    if (weightedValues.length === 0) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    // Извлекаем values и weights из WeightedValue через map (immutable)
    const values = weightedValues.map((weightedValue) => weightedValue.value);
    const weights = weightedValues.map((weightedValue) => weightedValue.weight);

    return reducer.weightedAverage(values, weights, config);
  },

  /**
   * Вычисляет взвешенное среднее для Iterable WeightedValue (streaming-friendly)
   * Single-pass, zero allocations, O(n) - поддерживает lazy evaluation для rule engines
   * @param weightedValues - Iterable значений с весами
   * @param config - Конфигурация валидации весов (опционально)
   * @returns ReduceResult со взвешенным средним или ошибкой
   * @example
   * ```ts
   * const values = function* () {
   *   yield { value: 10, weight: 0.2 };
   *   yield { value: 20, weight: 0.3 };
   *   yield { value: 30, weight: 0.5 };
   * };
   * reducer.weightedAverageFromIterable(values());
   * ```
   */
  weightedAverageFromIterable(
    weightedValues: Iterable<WeightedValue<number>>,
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION,
  ): ReduceResult<number> {
    // Streaming weighted average: single pass, zero allocations, O(n)
    // Kahan summation требует мутаций для точности, streaming API требует single-pass loop
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation */
    let weightedSum = 0;
    let weightSum = 0;
    let compensationWeighted = 0;
    let compensationWeights = 0;
    let index = 0;
    let hasAny = false;

    for (const { value, weight } of weightedValues) {
      hasAny = true;

      // Валидация weight и value
      const validation = validateWeightedValue(weight, value, index, config);
      if (!validation.ok) {
        return validation;
      }

      // Kahan summation для суммы весов
      const yw = weight - compensationWeights;
      const tw = weightSum + yw;
      compensationWeights = (tw - weightSum) - yw;
      weightSum = tw;

      // Kahan summation для взвешенной суммы
      // product уже проверен в validateWeightedValue (на Infinity)
      const product = value * weight;
      const yp = product - compensationWeighted;
      const tp = weightedSum + yp;
      compensationWeighted = (tp - weightedSum) - yp;
      weightedSum = tp;

      index++;
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

    if (!hasAny) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    // Валидация суммы весов (различает ZERO_TOTAL_WEIGHT и NUMERIC_UNDERFLOW)
    const weightSumValidation = validateWeightSum(weightSum);
    if (!weightSumValidation.ok) {
      return weightSumValidation;
    }

    // Weighted average = weightedSum / weightSum
    // Kahan summation уже сделал максимум возможного для точности
    // Остальное - ответственность IEEE754
    const weightedAverage = weightedSum / weightSum;

    if (!isValidNumber(weightedAverage)) {
      return {
        ok: false,
        reason: { kind: 'INFINITY_RESULT' },
      };
    }

    return {
      ok: true,
      value: weightedAverage,
    };
  },
} as const;

/* ============================================================================
 * 🧮 REDUCER ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM AGGREGATORS
 * ============================================================================
 */

/**
 * Состояние агрегатора для incremental aggregation
 * @template TState - Тип состояния агрегатора
 * @public
 */
export type AggregatorState<TState> = Readonly<{
  /** Текущее состояние агрегатора */
  readonly state: TState;
  /** Количество обработанных элементов */
  readonly count: number;
}>;

/**
 * Контракт для extensible aggregator (reducer algebra)
 * Позволяет создавать custom aggregators (median, percentile, histogram, etc.) без копирования логики валидации
 * Generic по TResult для поддержки любых типов результатов (number, Confidence, Histogram, Distribution, etc.)
 * @template TValue - Тип значения для агрегации
 * @template TResult - Тип результата агрегации
 * @template TState - Тип состояния агрегатора
 * @public
 */
export interface NumericAggregator<TValue = number, TResult = number, TState = unknown> {
  /**
   * Инициализирует начальное состояние агрегатора
   * @returns Начальное состояние
   */
  init(): AggregatorState<TState>;

  /**
   * Обновляет состояние агрегатора на основе нового значения
   * Возвращает ReduceResult для поддержки early termination и deterministic failure index
   * @param currentState - Текущее состояние агрегатора
   * @param value - Новое значение для агрегации
   * @param index - Индекс значения в массиве
   * @returns ReduceResult с новым состоянием агрегатора или ошибкой (для early termination)
   */
  step(
    currentState: AggregatorState<TState>,
    value: TValue,
    index: number,
  ): ReduceResult<AggregatorState<TState>>;

  /**
   * Финализирует результат агрегации из состояния
   * Возвращает ReduceResult для composability (не undefined)
   * @param finalState - Финальное состояние агрегатора
   * @returns ReduceResult с результатом агрегации или ошибкой
   */
  finalize(finalState: AggregatorState<TState>): ReduceResult<TResult>;
}

/**
 * Reducer Algebra: factory для создания custom aggregators
 * Позволяет создавать median, percentile, geometric mean, confidence aggregation
 * без изменения core логики
 * @public
 */
export const reducerAlgebra = {
  /**
   * Применяет NumericAggregator к массиву значений
   * Generic по TResult для поддержки любых типов результатов (histogram, distribution, etc.)
   * @param values - Массив значений для агрегации
   * @param aggregator - NumericAggregator для применения
   * @returns ReduceResult с результатом агрегации или ошибкой
   * @example
   * ```ts
   * const medianAggregator: NumericAggregator<number, number> = {
   *   init: () => ({ state: [] }),
   *   step: (acc, value) => ({ state: [...acc.state, value] }),
   *   finalize: (state) => {
   *     const sorted = [...state.state].sort((a, b) => a - b);
   *     const mid = Math.floor(sorted.length / 2);
   *     return { ok: true, value: sorted.length % 2 === 0
   *       ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]! };
   *   },
   * };
   * reducerAlgebra.aggregate([1, 2, 3, 4, 5], medianAggregator); // 3
   * ```
   */
  aggregate<TValue = number, TResult = number, TState = unknown>(
    values: readonly TValue[],
    aggregator: NumericAggregator<TValue, TResult, TState>,
  ): ReduceResult<TResult> {
    if (values.length === 0) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    // ReducerAlgebra не валидирует значения - это ответственность конкретного aggregator
    // Позволяет использовать generic aggregators для histogram<string>, distribution<enum>, label aggregation, etc.
    // Применяем aggregator с поддержкой early termination и deterministic failure index
    const initialState = aggregator.init();

    // Используем reduce с аккумулятором, который может содержать ошибку для early termination
    // Если step возвращает ошибку, она распространяется через reduce (early termination)
    const reduceResult = values.reduce<ReduceResult<AggregatorState<TState>>>(
      (acc, value, index) => {
        // Если уже есть ошибка, возвращаем её (early termination)
        if (!acc.ok) {
          return acc;
        }

        const stepResult = aggregator.step(acc.value, value, index);
        if (!stepResult.ok) {
          // Early termination при ошибке - обеспечивает deterministic failure index и bounded CPU
          return stepResult;
        }

        return { ok: true, value: stepResult.value };
      },
      { ok: true, value: initialState },
    );

    if (!reduceResult.ok) {
      return reduceResult;
    }

    // finalize возвращает ReduceResult<TResult> для composability
    return aggregator.finalize(reduceResult.value);
  },
} as const;
