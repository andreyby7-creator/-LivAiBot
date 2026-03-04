/**
 * @file packages/core/src/aggregation/weight.ts
 * ============================================================================
 * 🛡️ CORE — Aggregation (Weight)
 * ============================================================================
 * Архитектурная роль:
 * - Generic операции для работы с весами: нормализация, валидация, sum, normalize, scale, combine
 * - Причина изменения: generic weight operations, не domain-специфичная логика
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, INTERNAL (validation helpers), WEIGHT, WEIGHT ALGEBRA
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты, без silent normalization, array API = thin wrapper над streaming
 * - ✅ Domain-pure: generic по типам результата и состояния (TResult, TState, TContext), без привязки к domain-специфичным типам
 * - ✅ Extensible: WeightAlgebra (generic по TResult, TState, TContext) для создания custom weight operations без изменения core логики
 * - ✅ Strict typing: generic types без domain-специфичных значений, union types для WeightFailureReason
 * - ✅ Microservice-ready: runtime validation предотвращает cross-service inconsistency, IEEE-754 совместимость
 * - ✅ Scalable: поддержка Iterable для streaming (O(n), zero allocations), extensible через WeightAlgebra
 * - ✅ Security: runtime validation NaN/Infinity, проверка переполнения, IEEE-754 MIN_NORMAL для numeric underflow
 * - ✅ Immutable: все операции возвращают новые значения
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения (SAFE/SUSPICIOUS/DANGEROUS - это domain labels)
 * - ❌ НЕ требует нормализации к 1.0 (поддерживает любые относительные веса)
 * - ❌ НЕ нормализует автоматически (явная операция через weight.normalize)
 * - ✅ Только generic математические операции
 */

/* ============================================================================
 * 1. TYPES — WEIGHT MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Результат операции с весами (effect-based algebraic contract)
 * @template T - Тип результата
 * @public
 */
export type WeightResult<T> =
  | Readonly<{ ok: true; value: T; }>
  | Readonly<{ ok: false; reason: WeightFailureReason; }>;

/**
 * Причина ошибки операции с весами
 * @public
 */
export type WeightFailureReason =
  | Readonly<{ kind: 'EMPTY_ARRAY'; }>
  | Readonly<{ kind: 'INVALID_WEIGHT'; index: number; weight: number; }>
  | Readonly<{ kind: 'ZERO_TOTAL_WEIGHT'; sum: number; }>
  | Readonly<{ kind: 'NUMERIC_UNDERFLOW'; sum: number; }>
  | Readonly<{ kind: 'NAN_RESULT'; }>
  | Readonly<{ kind: 'INFINITY_RESULT'; }>
  | Readonly<{ kind: 'LENGTH_MISMATCH'; firstLength: number; secondLength: number; }>
  | Readonly<{ kind: 'NEGATIVE_WEIGHT'; index: number; weight: number; }>
  | Readonly<{ kind: 'INVALID_TARGET_SUM'; targetSum: number; }>
  | Readonly<{ kind: 'TOO_LARGE'; size: number; maxSize: number; }>;

/**
 * Конфигурация для валидации весов
 * @public
 */
export type WeightValidationConfig = Readonly<{
  /** Минимальное допустимое значение веса */
  readonly minWeight: number;
  /** Разрешать ли отрицательные веса */
  readonly allowNegative: boolean;
}>;

/**
 * Конфигурация для нормализации весов
 * @public
 */
export type NormalizationConfig = Readonly<{
  /** Целевая сумма весов после нормализации */
  readonly targetSum: number;
  /** Максимальный размер массива для материализации (защита от DoS) */
  readonly maxSize?: number;
}>;

/**
 * Константы для валидации весов (по умолчанию)
 * @internal
 */
const DEFAULT_WEIGHT_VALIDATION: WeightValidationConfig = {
  minWeight: 0,
  allowNegative: false,
} as const;

/**
 * Константы для нормализации весов (по умолчанию)
 * @internal
 */
const DEFAULT_NORMALIZATION: NormalizationConfig = {
  targetSum: 1.0,
} as const;

/* ============================================================================
 * 2. CONSTANTS — DEFAULT CONFIGURATION
 * ============================================================================
 */

/* ============================================================================
 * 3. INTERNAL — VALIDATION HELPERS
 * ============================================================================
 */

/**
 * Проверяет валидность веса
 * @internal
 */
function isValidWeight(
  weight: number, // Вес для валидации
  config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
): boolean { // true если вес валиден
  if (!Number.isFinite(weight)) {
    return false;
  }

  if (weight < config.minWeight) {
    return false;
  }

  if (!config.allowNegative && weight < 0) {
    return false;
  }

  return true;
}

/**
 * Проверяет валидность числового результата (NaN/Infinity)
 * @internal
 */
function isValidNumber(
  value: number, // Число для валидации
): boolean { // true если число валидно (finite)
  return Number.isFinite(value);
}

/**
 * Валидирует сумму весов для деления
 * @note Различает ZERO_TOTAL_WEIGHT и NUMERIC_UNDERFLOW
 * @internal
 */
function validateWeightSum(
  sum: number, // Сумма весов для валидации
): WeightResult<void> { // WeightResult<void> при успехе, WeightResult с ошибкой при неудаче
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
 * Валидирует массив весов
 * @internal
 */
function validateWeights(
  weights: readonly number[], // Массив весов для валидации
  config: WeightValidationConfig, // Конфигурация валидации
): WeightResult<void> { // WeightResult<void> при успехе, WeightResult с ошибкой при неудаче
  if (weights.length === 0) {
    return {
      ok: false,
      reason: { kind: 'EMPTY_ARRAY' },
    };
  }

  const invalidWeightIndex = weights.findIndex((weight) => !isValidWeight(weight, config));

  if (invalidWeightIndex !== -1) {
    const weight = weights[invalidWeightIndex];
    const reason: WeightFailureReason = weight !== undefined && weight < 0 && !config.allowNegative
      ? {
        kind: 'NEGATIVE_WEIGHT',
        index: invalidWeightIndex,
        weight,
      }
      : {
        kind: 'INVALID_WEIGHT',
        index: invalidWeightIndex,
        weight: weight ?? NaN,
      };

    return {
      ok: false,
      reason,
    };
  }

  return { ok: true, value: undefined };
}

/**
 * IEEE-754 MIN_NORMAL: порог для subnormal чисел (кросс-языковая воспроизводимость)
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- IEEE-754 стандартное имя константы
const IEEE754_MIN_NORMAL = 2.2250738585072014e-308;

/**
 * Масштабирует веса (internal primitive, без валидации) - building block для normalize/scale
 * @internal
 */
function scaleWeightsUnsafe(
  weights: readonly number[],
  scaleFactor: number,
): readonly number[] {
  return weights.map((weightValue) => weightValue * scaleFactor);
}

/**
 * Суммирует массив весов без валидации (perf-optimized для normalize после validateWeights)
 * Kahan summation для высокой точности, без generator/iterator overhead
 * @internal
 */
function sumFromArrayAssumeValid(weights: readonly number[]): number {
  // Kahan summation для высокой точности через reduce
  return weights.reduce<{ sum: number; compensation: number; }>(
    (acc, weight) => {
      const y = weight - acc.compensation;
      const t = acc.sum + y;
      const compensation = (t - acc.sum) - y;
      return { sum: t, compensation };
    },
    { sum: 0, compensation: 0 },
  ).sum;
}

/* ============================================================================
 * 4. WEIGHT — GENERIC WEIGHT OPERATIONS (Unified Algebraic Contract)
 * ============================================================================
 */

/**
 * Weight: generic функции для работы с весами
 * @note Чистые функции, WeightResult для composability
 * @public
 */
export const weight = {
  /**
   * Суммирует веса (Kahan summation для высокой точности)
   *
   * @example weight.sum([0.2, 0.3, 0.5]) // { ok: true, value: 1.0 }
   */
  sum(
    weights: readonly number[], // Массив весов для суммирования
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
  ): WeightResult<number> { // WeightResult с суммой или ошибкой
    const validation = validateWeights(weights, config);
    if (!validation.ok) {
      return validation;
    }

    // Kahan summation для высокой точности через reduce
    const sum = weights.reduce<{ sum: number; compensation: number; }>(
      (acc, weight) => {
        const y = weight - acc.compensation;
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
   * Суммирует веса из Iterable (streaming: single-pass, zero allocations, O(n))
   *
   * @example weight.sumFromIterable(function*() { yield 0.2; yield 0.3; yield 0.5; }())
   */
  sumFromIterable(
    weights: Iterable<number>, // Iterable весов
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
    assumeValid: boolean = false, // Пропустить валидацию (для оптимизации после validateWeights)
  ): WeightResult<number> { // WeightResult с суммой или ошибкой
    // Streaming: Kahan summation требует мутаций для точности
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation */
    let sum = 0;
    let compensation = 0;
    let index = 0;
    let hasAny = false;

    for (const weightValue of weights) {
      hasAny = true;

      // Валидация веса (пропускается если assumeValid = true для оптимизации O(n) вместо O(2n))
      if (!assumeValid && !isValidWeight(weightValue, config)) {
        const reason: WeightFailureReason = weightValue < 0 && !config.allowNegative
          ? {
            kind: 'NEGATIVE_WEIGHT',
            index,
            weight: weightValue,
          }
          : {
            kind: 'INVALID_WEIGHT',
            index,
            weight: weightValue,
          };

        return {
          ok: false,
          reason,
        };
      }

      // Kahan summation
      const y = weightValue - compensation;
      const t = sum + y;
      compensation = (t - sum) - y;
      sum = t;

      index++;
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

    if (!hasAny) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

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
   * Нормализует веса к целевой сумме (по умолчанию 1.0)
   * @note Orchestration: validate → sum → validateSum → scale → validate
   *
   * @example weight.normalize([2, 3, 5]) // { ok: true, value: [0.2, 0.3, 0.5] }
   *
   * @example weight.normalize([2, 3, 5], { targetSum: 2.0 }) // { ok: true, value: [0.4, 0.6, 1.0] }
   */
  normalize(
    weights: readonly number[], // Массив весов для нормализации
    normalizationConfig: NormalizationConfig = DEFAULT_NORMALIZATION, // Конфигурация нормализации
    validationConfig: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
  ): WeightResult<readonly number[]> { // WeightResult с нормализованными весами или ошибкой
    // Валидация целевой суммы
    if (!isValidNumber(normalizationConfig.targetSum) || normalizationConfig.targetSum <= 0) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_TARGET_SUM',
          targetSum: normalizationConfig.targetSum,
        },
      };
    }

    // 1. Валидация входных весов
    const validation = validateWeights(weights, validationConfig);
    if (!validation.ok) {
      return validation;
    }

    // 2. Вычисляем сумму весов (perf-optimized: без generator/iterator overhead)
    const totalSum = sumFromArrayAssumeValid(weights);

    // Проверка результата на NaN/Infinity
    if (!isValidNumber(totalSum)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    // 3. Валидация суммы весов для деления
    const sumValidation = validateWeightSum(totalSum);
    if (!sumValidation.ok) {
      return sumValidation;
    }

    // 4. Масштабирование через internal primitive
    const scaleFactor = normalizationConfig.targetSum / totalSum;

    // Проверка переполнения scaleFactor
    if (!isValidNumber(scaleFactor)) {
      return {
        ok: false,
        reason: { kind: 'INFINITY_RESULT' },
      };
    }

    const scaledWeights = scaleWeightsUnsafe(weights, scaleFactor);

    // 5. Валидация нормализованных весов
    // ⚠️ НЕ проверяем subnormal для результатов scaling - это legit tiny probabilities (ML/bayesian inference)
    // Subnormal проверяется только для делителя (totalSum) через validateWeightSum выше
    const normalizedValidation = validateWeights(scaledWeights, validationConfig);
    if (!normalizedValidation.ok) {
      return normalizedValidation;
    }

    return {
      ok: true,
      value: scaledWeights,
    };
  },

  /**
   * Нормализует веса из Iterable
   * @note Требует материализации (необходимо знать сумму до нормализации). Защита от DoS: maxSize ограничивает размер массива.
   *
   * @example weight.normalizeFromIterable(function*() { yield 2; yield 3; yield 5; }())
   *
   * @example weight.normalizeFromIterable(weights(), { targetSum: 1.0, maxSize: 1000 })
   */
  normalizeFromIterable(
    weights: Iterable<number>, // Iterable весов
    normalizationConfig: NormalizationConfig = DEFAULT_NORMALIZATION, // Конфигурация нормализации
    validationConfig: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
  ): WeightResult<readonly number[]> { // WeightResult с нормализованными весами или ошибкой
    // Валидация целевой суммы
    if (!isValidNumber(normalizationConfig.targetSum) || normalizationConfig.targetSum <= 0) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_TARGET_SUM',
          targetSum: normalizationConfig.targetSum,
        },
      };
    }

    // Материализация (единственный случай, когда streaming требует материализации)
    // ⚠️ Защита от DoS: maxSize ограничивает размер
    const materialized: number[] = [];
    const maxSize = normalizationConfig.maxSize ?? Number.MAX_SAFE_INTEGER;

    /* eslint-disable functional/no-loop-statements, functional/immutable-data -- материализация с защитой от DoS */
    for (const weight of weights) {
      if (materialized.length >= maxSize) {
        return {
          ok: false,
          reason: {
            kind: 'TOO_LARGE',
            size: materialized.length,
            maxSize,
          },
        };
      }
      materialized.push(weight);
    }
    /* eslint-enable functional/no-loop-statements, functional/immutable-data */

    return weight.normalize(materialized, normalizationConfig, validationConfig);
  },

  /**
   * Масштабирует веса на множитель (каждый вес * scaleFactor)
   *
   * @example weight.scale([0.2, 0.3, 0.5], 2.0) // { ok: true, value: [0.4, 0.6, 1.0] }
   */
  scale(
    weights: readonly number[], // Массив весов для масштабирования
    scaleFactor: number, // Множитель для масштабирования
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
  ): WeightResult<readonly number[]> { // WeightResult с масштабированными весами или ошибкой
    // Валидация множителя
    if (!isValidNumber(scaleFactor)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    // Валидация входных весов
    const validation = validateWeights(weights, config);
    if (!validation.ok) {
      return validation;
    }

    // Масштабирование через internal primitive
    const scaledWeights = scaleWeightsUnsafe(weights, scaleFactor);

    // ⚠️ НЕ проверяем subnormal для результатов scaling - это legit tiny probabilities (ML/bayesian inference)
    // Валидация масштабированных весов
    const scaledValidation = validateWeights(scaledWeights, config);
    if (!scaledValidation.ok) {
      return scaledValidation;
    }

    return {
      ok: true,
      value: scaledWeights,
    };
  },

  /**
   * Комбинирует два массива весов (поэлементное сложение: weights1[i] + weights2[i])
   *
   * @example weight.combine([0.2, 0.3], [0.1, 0.2]) // { ok: true, value: [0.3, 0.5] }
   */
  combine(
    weights1: readonly number[], // Первый массив весов
    weights2: readonly number[], // Второй массив весов
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
  ): WeightResult<readonly number[]> { // WeightResult с комбинированными весами или ошибкой
    // Валидация длины массивов
    if (weights1.length !== weights2.length) {
      return {
        ok: false,
        reason: {
          kind: 'LENGTH_MISMATCH',
          firstLength: weights1.length,
          secondLength: weights2.length,
        },
      };
    }

    if (weights1.length === 0) {
      return {
        ok: false,
        reason: { kind: 'EMPTY_ARRAY' },
      };
    }

    // Валидация входных весов
    const validation1 = validateWeights(weights1, config);
    if (!validation1.ok) {
      return validation1;
    }

    const validation2 = validateWeights(weights2, config);
    if (!validation2.ok) {
      return validation2;
    }

    // Комбинирование: weights1[i] + weights2[i]
    const combinedWeights = weights1.map((weight1, index) => {
      const weight2 = weights2[index];
      if (weight2 === undefined || !isValidNumber(weight1 + weight2)) {
        return NaN; // Будет обнаружено при валидации
      }
      return weight1 + weight2;
    });

    // Валидация комбинированных весов
    const combinedValidation = validateWeights(combinedWeights, config);
    if (!combinedValidation.ok) {
      return combinedValidation;
    }

    return {
      ok: true,
      value: combinedWeights,
    };
  },

  /**
   * Проверяет валидность весов
   *
   * @example weight.validate([0.2, 0.3, 0.5]) // { ok: true, value: undefined }
   *
   * @example weight.validate([-0.1, 0.3, 0.5]) // { ok: false, reason: { kind: 'NEGATIVE_WEIGHT', ... } }
   */
  validate(
    weights: readonly number[], // Массив весов для валидации
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
  ): WeightResult<void> { // WeightResult<void> при успехе, WeightResult с ошибкой при неудаче
    return validateWeights(weights, config);
  },

  /**
   * Проверяет нормализацию весов к целевой сумме (с учетом погрешности epsilon)
   *
   * @example weight.isNormalized([0.2, 0.3, 0.5]) // { ok: true, value: true }
   *
   * @example weight.isNormalized([0.2, 0.3, 0.6]) // { ok: true, value: false }
   */
  isNormalized(
    weights: readonly number[], // Массив весов для проверки
    targetSum: number = 1.0, // Целевая сумма
    epsilon: number = Number.EPSILON * 10, // Погрешность для сравнения
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
  ): WeightResult<boolean> { // WeightResult с результатом проверки или ошибкой
    // Валидация входных весов
    const validation = validateWeights(weights, config);
    if (!validation.ok) {
      return validation;
    }

    // Валидация целевой суммы
    if (!isValidNumber(targetSum) || targetSum <= 0) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_TARGET_SUM',
          targetSum,
        },
      };
    }

    // Валидация epsilon
    if (!isValidNumber(epsilon) || epsilon < 0) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    // Вычисляем сумму весов
    const sumResult = weight.sum(weights, config);
    if (!sumResult.ok) {
      return sumResult;
    }

    const sum = sumResult.value;

    // Проверяем, равна ли сумма целевой сумме (с учетом погрешности)
    const isNormalized = Math.abs(sum - targetSum) <= epsilon;

    return {
      ok: true,
      value: isNormalized,
    };
  },
} as const;

/* ============================================================================
 * 5. WEIGHT ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM WEIGHT OPERATIONS
 * ============================================================================
 */

/**
 * Контракт для extensible weight operations (weighted median, percentile, etc.)
 * @template TResult - Тип результата
 * @template TState - Тип состояния
 * @template TContext - Тип контекста (timestamp, entity, feature flags, environment, etc.)
 * @note Generic по TResult для любых типов результатов (number, WeightDistribution, etc.)
 * @public
 */
export interface WeightOperation<TResult = number, TState = unknown, TContext = void> {
  /**
   * Инициализирует начальное состояние операции
   */
  init(): TState; // Начальное состояние

  /**
   * Обновляет состояние операции (early termination через WeightResult)
   */
  step(
    currentState: TState, // Текущее состояние
    weight: number, // Вес
    index: number, // Индекс в массиве
    context?: TContext, // Контекст операции (timestamp, entity, feature flags, environment, etc.)
  ): WeightResult<TState>; // WeightResult с новым состоянием или ошибкой

  /**
   * Финализирует результат операции из состояния
   * @note WeightResult для composability
   */
  finalize(
    finalState: TState, // Финальное состояние
  ): WeightResult<TResult>; // WeightResult с результатом операции или ошибкой
}

/**
 * Weight Algebra: factory для custom weight operations
 * @note Без изменения core логики
 * @public
 */
export const weightAlgebra = {
  /**
   * Применяет WeightOperation к массиву весов
   * @template TResult - Тип результата
   * @template TState - Тип состояния
   * @template TContext - Тип контекста (timestamp, entity, feature flags, environment, etc.)
   * @note Использует loop вместо reduce для real early termination (CPU boundedness)
   *
   * @example const maxOp: WeightOperation<number, number> = { init: () => 0, step: (acc, w) => ({ ok: true, value: Math.max(acc, w) }), finalize: (s) => ({ ok: true, value: s }) }; weightAlgebra.operate([0.2, 0.3, 0.5], maxOp) // { ok: true, value: 0.5 }
   */
  operate<TResult = number, TState = unknown, TContext = void>(
    weights: readonly number[], // Массив весов
    operation: WeightOperation<TResult, TState, TContext>, // WeightOperation для применения
    config: WeightValidationConfig = DEFAULT_WEIGHT_VALIDATION, // Конфигурация валидации
    context?: TContext, // Контекст операции (timestamp, entity, feature flags, environment, etc.)
  ): WeightResult<TResult> { // WeightResult с результатом операции или ошибкой
    // Валидация входных весов
    const validation = validateWeights(weights, config);
    if (!validation.ok) {
      return validation;
    }

    // Real early termination: loop вместо reduce (reduce НЕ early-terminates в runtime)
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination */
    let state: WeightResult<TState> = { ok: true, value: operation.init() };

    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i];
      if (weight === undefined) {
        return {
          ok: false,
          reason: { kind: 'INVALID_WEIGHT', index: i, weight: NaN },
        };
      }

      const stepResult = operation.step(state.value, weight, i, context);
      if (!stepResult.ok) {
        return stepResult; // Early termination (deterministic failure index, bounded CPU)
      }

      state = stepResult;
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

    // После цикла state.ok всегда true (если бы было false, мы бы уже вернулись)
    return operation.finalize(state.value);
  },
} as const;
