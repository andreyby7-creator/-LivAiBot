/**
 * @file packages/core/src/aggregation/scoring.ts
 * ============================================================================
 * 🛡️ CORE — Aggregation (Scoring)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Generic операции для scoring: weighted scoring, score normalization, score aggregation
 * - Причина изменения: generic scoring semantics, не domain-специфичная логика
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, INTERNAL (layered architecture: IEEE Contract / Numeric Guards / Domain Validation / Public API), SCORING, SCORE ALGEBRA
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты, без silent normalization, real early termination (loop вместо reduce)
 * - ✅ Domain-pure: generic по типам результата, состояния, контекста и ошибки (TResult, TState, TContext, E), без привязки к domain-специфичным типам
 * - ✅ Extensible: ScoreAlgebra (generic по TResult, TState, TContext, E) для создания custom scoring operations без изменения core логики
 * - ✅ Strict typing: generic types без domain-специфичных значений, union types для ScoreFailureReason, generic по типу ошибки E для full algebra extensibility
 * - ✅ Microservice-ready: runtime validation предотвращает cross-service inconsistency, IEEE-754 совместимость, adaptive summation (Neumaier для mixed-sign, Kahan для single-sign)
 * - ✅ Scalable: поддержка Iterable для streaming (O(n), zero allocations, single-pass validation+accumulation), extensible через ScoreAlgebra
 * - ✅ Security: runtime validation NaN/Infinity, проверка переполнения, IEEE-754 MIN_NORMAL для numeric underflow, post-step/post-finalize numeric guards в ScoreAlgebra
 * - ✅ Immutable: все операции возвращают новые значения
 *
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения (SAFE/SUSPICIOUS/DANGEROUS - это domain labels)
 * - ❌ НЕ зависит от domain-kit/label.ts (только generic math)
 * - ✅ Использует reducer и weight из aggregation для композиции
 * - ✅ Только generic математические операции
 */

/* ============================================================================
 * 1. TYPES — SCORING MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Результат операции scoring (effect-based algebraic contract)
 * @template T - Тип результата
 * @template E - Тип ошибки (по умолчанию ScoreFailureReason)
 * @note Generic по E для full algebra extensibility (custom operations могут возвращать свои типы ошибок)
 * @public
 */
export type ScoreResult<
  T, // Тип результата
  E = ScoreFailureReason, // Тип ошибки (по умолчанию ScoreFailureReason)
> =
  | Readonly<{ ok: true; value: T; }>
  | Readonly<{ ok: false; reason: E; }>;

/**
 * Причина ошибки операции scoring
 * @public
 */
export type ScoreFailureReason =
  | Readonly<{ kind: 'EMPTY_ARRAY'; }>
  | Readonly<{ kind: 'INVALID_SCORE'; index: number; score: number; }>
  | Readonly<{ kind: 'INVALID_WEIGHT'; index: number; weight: number; }>
  | Readonly<{ kind: 'ZERO_TOTAL_WEIGHT'; sum: number; }>
  | Readonly<{ kind: 'NUMERIC_UNDERFLOW'; sum: number; }>
  | Readonly<{ kind: 'NAN_RESULT'; }>
  | Readonly<{ kind: 'INFINITY_RESULT'; }>
  | Readonly<{ kind: 'LENGTH_MISMATCH'; scoresLength: number; weightsLength: number; }>
  | Readonly<{ kind: 'INVALID_SCORE_RANGE'; min: number; max: number; }>
  | Readonly<
    {
      kind: 'INVALID_NORMALIZATION_RANGE';
      fromMin: number;
      fromMax: number;
      toMin: number;
      toMax: number;
    }
  >;

/**
 * Конфигурация для scoring
 * @public
 */
export type ScoringConfig = Readonly<{
  /** Диапазон допустимых значений score (для валидации и нормализации) */
  readonly scoreRange: Readonly<{ min: number; max: number; }>;
  /** Конфигурация валидации весов */
  readonly weightValidation: Readonly<{
    /** Минимальное допустимое значение веса */
    readonly minWeight: number;
    /** Разрешать ли отрицательные веса */
    readonly allowNegative: boolean;
  }>;
  /** Строгая проверка диапазона при нормализации (запрещает extrapolation) */
  readonly strictRange?: boolean;
}>;

/**
 * Константы для scoring (по умолчанию)
 * @internal
 */
const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  scoreRange: { min: 0, max: 100 },
  weightValidation: {
    minWeight: 0,
    allowNegative: false,
  },
} as const;

/* ============================================================================
 * 2. CONSTANTS — DEFAULT CONFIGURATION
 * ============================================================================
 */

/* ============================================================================
 * 3. INTERNAL — LAYERED ARCHITECTURE (SRP BY RESPONSIBILITY)
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 * IEEE 754 NUMERIC CONTRACT — IEEE-754 double precision minimum positive NORMAL value.
 * Ниже этого порога числа становятся subnormal и теряют детерминированное округление.
 * Требуется для кросс-языковой воспроизводимости (JS/JVM/Rust/C++).
 * ---------------------------------------------------------------------------- */
// eslint-disable-next-line @typescript-eslint/naming-convention -- IEEE-754 стандартное имя константы
const IEEE754_MIN_NORMAL = 2.2250738585072014e-308;

/* ----------------------------------------------------------------------------
 * NUMERIC GUARDS — проверка валидности числовых результатов (NaN/Infinity)
 * ---------------------------------------------------------------------------- */
function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Проверяет, является ли число subnormal (ниже IEEE754_MIN_NORMAL)
 * Subnormal: 0 < |x| < MIN_NORMAL (строгая граница для IEEE correctness)
 * @internal
 */
function isSubnormal(value: number): boolean {
  return Math.abs(value) > 0 && Math.abs(value) < IEEE754_MIN_NORMAL;
}

/* ----------------------------------------------------------------------------
 * KAHAN SUMMATION PRIMITIVE — добавление значения к Kahan аккумулятору (in-place)
 * ⚠️ Не защищает от catastrophic cancellation при mixed-sign inputs
 * ---------------------------------------------------------------------------- */
/* eslint-disable functional/immutable-data, fp/no-mutation -- Kahan summation требует мутаций аккумулятора */
function kahanAdd(acc: { sum: number; compensation: number; }, value: number): void {
  const y = value - acc.compensation;
  const t = acc.sum + y;
  acc.compensation = (t - acc.sum) - y;
  acc.sum = t;
}
/* eslint-enable functional/immutable-data, fp/no-mutation */

/**
 * Добавляет значение к Neumaier аккумулятору (защита от catastrophic cancellation при mixed-sign inputs)
 * @internal
 */
/* eslint-disable functional/immutable-data, fp/no-mutation -- Neumaier summation требует мутаций аккумулятора */
function neumaierAdd(acc: { sum: number; compensation: number; }, value: number): void {
  const t = acc.sum + value;
  if (Math.abs(acc.sum) >= Math.abs(value)) {
    acc.compensation += (acc.sum - t) + value;
  } else {
    acc.compensation += (value - t) + acc.sum;
  }
  acc.sum = t;
}
/* eslint-enable functional/immutable-data, fp/no-mutation */

/**
 * Выбирает алгоритм суммирования: Neumaier для mixed-sign, Kahan для single-sign
 * @internal
 */
function chooseSummationAlgorithm(
  allowNegative: boolean,
): (acc: { sum: number; compensation: number; }, value: number) => void {
  return allowNegative ? neumaierAdd : kahanAdd;
}

/* ----------------------------------------------------------------------------
 * WEIGHTED ACCUMULATION PRIMITIVE — объединяет validation, overflow guard и adaptive summation
 * ---------------------------------------------------------------------------- */

/**
 * Результат accumulation pipeline
 * @internal
 */
type AccumulationResult = Readonly<{
  weightedSum: number;
  weightSum: number;
  count: number;
}>;

/**
 * Weighted accumulation из массивов (zero-allocation): validation + overflow guard + adaptive summation
 * @internal
 */
function accumulateWeightedFromArrays(
  scores: readonly number[],
  weights: readonly number[],
  config: ScoringConfig,
): ScoreResult<AccumulationResult> {
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- summation требует мутаций */
  const sumAcc: { sum: number; compensation: number; } = { sum: 0, compensation: 0 };
  const weightAcc: { sum: number; compensation: number; } = { sum: 0, compensation: 0 };
  let count = 0;

  // Выбираем алгоритм суммирования: Neumaier для mixed-sign, Kahan для single-sign
  const addToSum = chooseSummationAlgorithm(config.weightValidation.allowNegative);
  const addToWeight = chooseSummationAlgorithm(config.weightValidation.allowNegative);

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    const weight = weights[i];

    if (score === undefined || weight === undefined) {
      continue; // Пропускаем undefined (должно быть отловлено валидацией выше)
    }

    count++;

    // Validation score
    if (!isValidScore(score, config.scoreRange)) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_SCORE',
          index: i,
          score,
        },
      };
    }

    // Validation weight
    if (!isValidWeight(weight, config.weightValidation)) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_WEIGHT',
          index: i,
          weight,
        },
      };
    }

    // Product overflow guard (security: audit-grade error reporting)
    const product = score * weight;
    if (!isFiniteNumber(product)) {
      return {
        ok: false,
        reason: { kind: 'INFINITY_RESULT' },
      };
    }

    // Adaptive summation для score * weight (Neumaier для mixed-sign, Kahan для single-sign)
    addToSum(sumAcc, product);

    // Adaptive summation для totalWeight
    addToWeight(weightAcc, weight);
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  if (count === 0) {
    return {
      ok: false,
      reason: { kind: 'EMPTY_ARRAY' },
    };
  }

  // Neumaier/Kahan: финальная сумма = sum + compensation (compensation хранит накопленную корректировку)
  // Для Kahan compensation всегда есть, для Neumaier тоже (обе структуры имеют compensation)
  const finalWeightedSum = sumAcc.sum + sumAcc.compensation;
  const finalWeightSum = weightAcc.sum + weightAcc.compensation;

  return {
    ok: true,
    value: {
      weightedSum: finalWeightedSum,
      weightSum: finalWeightSum,
      count,
    },
  };
}

/**
 * Weighted accumulation из Iterable (streaming): validation + overflow guard + adaptive summation
 * @internal
 */
function accumulateWeighted(
  iterator: Iterable<Readonly<{ value: number; weight: number; }>>,
  config: ScoringConfig,
): ScoreResult<AccumulationResult> {
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- summation требует мутаций */
  const sumAcc: { sum: number; compensation: number; } = { sum: 0, compensation: 0 };
  const weightAcc: { sum: number; compensation: number; } = { sum: 0, compensation: 0 };
  let count = 0;

  // Выбираем алгоритм суммирования: Neumaier для mixed-sign, Kahan для single-sign
  const addToSum = chooseSummationAlgorithm(config.weightValidation.allowNegative);
  const addToWeight = chooseSummationAlgorithm(config.weightValidation.allowNegative);

  for (const weightedScore of iterator) {
    count++;

    // Validation score
    if (!isValidScore(weightedScore.value, config.scoreRange)) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_SCORE',
          index: count - 1,
          score: weightedScore.value,
        },
      };
    }

    // Validation weight
    if (!isValidWeight(weightedScore.weight, config.weightValidation)) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_WEIGHT',
          index: count - 1,
          weight: weightedScore.weight,
        },
      };
    }

    // Product overflow guard (security: audit-grade error reporting)
    const product = weightedScore.value * weightedScore.weight;
    if (!isFiniteNumber(product)) {
      return {
        ok: false,
        reason: { kind: 'INFINITY_RESULT' },
      };
    }

    // Adaptive summation для score * weight (Neumaier для mixed-sign, Kahan для single-sign)
    addToSum(sumAcc, product);

    // Adaptive summation для totalWeight
    addToWeight(weightAcc, weightedScore.weight);
  }
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

  if (count === 0) {
    return {
      ok: false,
      reason: { kind: 'EMPTY_ARRAY' },
    };
  }

  // Neumaier/Kahan: финальная сумма = sum + compensation (compensation хранит накопленную корректировку)
  // Для Kahan compensation всегда есть, для Neumaier тоже (обе структуры имеют compensation)
  const finalWeightedSum = sumAcc.sum + sumAcc.compensation;
  const finalWeightSum = weightAcc.sum + weightAcc.compensation;

  return {
    ok: true,
    value: {
      weightedSum: finalWeightedSum,
      weightSum: finalWeightSum,
      count,
    },
  };
}

/* ----------------------------------------------------------------------------
 * SCORING HELPERS — вычислительная логика для weightedScore
 * ---------------------------------------------------------------------------- */

/**
 * Вычисляет weighted score из accumulation result
 * Инкапсулирует повторяющийся паттерн: validateWeightSum → деление → numeric guards
 * @internal
 */
function computeWeightedScore(
  accumulation: AccumulationResult,
): ScoreResult<number> {
  const sumValidation = validateWeightSum(accumulation.weightSum);
  if (!sumValidation.ok) {
    return sumValidation;
  }

  const weightedScore = accumulation.weightedSum / accumulation.weightSum;
  if (Number.isNaN(weightedScore)) {
    return {
      ok: false,
      reason: { kind: 'NAN_RESULT' },
    };
  }
  if (!Number.isFinite(weightedScore)) {
    return {
      ok: false,
      reason: { kind: 'INFINITY_RESULT' },
    };
  }

  return {
    ok: true,
    value: weightedScore,
  };
}

/**
 * Валидирует диапазоны для нормализации (domain-agnostic validation)
 * Проверяет finite numbers и корректность min < max для обоих диапазонов
 * @internal
 */
function validateRange(
  fromRange: Readonly<{ min: number; max: number; }>,
  toRange: Readonly<{ min: number; max: number; }>,
): ScoreResult<void> {
  if (
    !isFiniteNumber(fromRange.min)
    || !isFiniteNumber(fromRange.max)
    || !isFiniteNumber(toRange.min)
    || !isFiniteNumber(toRange.max)
  ) {
    return {
      ok: false,
      reason: { kind: 'NAN_RESULT' },
    };
  }

  if (fromRange.min >= fromRange.max) {
    return {
      ok: false,
      reason: {
        kind: 'INVALID_NORMALIZATION_RANGE',
        fromMin: fromRange.min,
        fromMax: fromRange.max,
        toMin: toRange.min,
        toMax: toRange.max,
      },
    };
  }

  if (toRange.min >= toRange.max) {
    return {
      ok: false,
      reason: {
        kind: 'INVALID_NORMALIZATION_RANGE',
        fromMin: fromRange.min,
        fromMax: fromRange.max,
        toMin: toRange.min,
        toMax: toRange.max,
      },
    };
  }

  return { ok: true, value: undefined };
}

/* ----------------------------------------------------------------------------
 * DOMAIN VALIDATION — правила валидации весов и scores
 * ---------------------------------------------------------------------------- */

/**
 * Проверяет валидность score в диапазоне
 * @internal
 */
function isValidScore(
  score: number,
  range: Readonly<{ min: number; max: number; }>,
): boolean {
  if (!isFiniteNumber(score)) {
    return false;
  }

  return score >= range.min && score <= range.max;
}

/**
 * Проверяет валидность веса
 * @internal
 */
function isValidWeight(
  weight: number,
  config: Readonly<{ minWeight: number; allowNegative: boolean; }>,
): boolean {
  if (!isFiniteNumber(weight)) {
    return false;
  }

  // Сначала проверяем allowNegative (чтобы отрицательные веса не отфильтровывались minWeight)
  if (!config.allowNegative && weight < 0) {
    return false;
  }

  // Затем проверяем minWeight (применяется после allowNegative check)
  // При allowNegative = true проверяем абсолютное значение, иначе обычное сравнение
  const effectiveWeight = config.allowNegative ? Math.abs(weight) : weight;
  if (effectiveWeight < config.minWeight) {
    return false;
  }

  return true;
}

/**
 * Валидирует сумму весов для деления (различает ZERO_TOTAL_WEIGHT, NUMERIC_UNDERFLOW, NaN, Infinity)
 * @internal
 */
function validateWeightSum(sum: number): ScoreResult<void> {
  if (!Number.isFinite(sum)) {
    // Различаем NaN и Infinity для правильной диагностики overflow
    if (Number.isNaN(sum)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }
    // Infinity = overflow
    return {
      ok: false,
      reason: { kind: 'INFINITY_RESULT' },
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
  if (isSubnormal(sum)) {
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
 * Валидирует массив scores
 * @internal
 */
function validateScores(
  scores: readonly number[],
  range: Readonly<{ min: number; max: number; }>,
): ScoreResult<void> {
  if (scores.length === 0) {
    return {
      ok: false,
      reason: { kind: 'EMPTY_ARRAY' },
    };
  }

  const invalidScoreIndex = scores.findIndex((score) => !isValidScore(score, range));

  if (invalidScoreIndex !== -1) {
    const score = scores[invalidScoreIndex];
    return {
      ok: false,
      reason: {
        kind: 'INVALID_SCORE',
        index: invalidScoreIndex,
        score: score ?? NaN,
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
  weights: readonly number[],
  config: Readonly<{ minWeight: number; allowNegative: boolean; }>,
): ScoreResult<void> {
  if (weights.length === 0) {
    return {
      ok: false,
      reason: { kind: 'EMPTY_ARRAY' },
    };
  }

  const invalidWeightIndex = weights.findIndex((weight) => !isValidWeight(weight, config));

  if (invalidWeightIndex !== -1) {
    const weight = weights[invalidWeightIndex];
    return {
      ok: false,
      reason: {
        kind: 'INVALID_WEIGHT',
        index: invalidWeightIndex,
        weight: weight ?? NaN,
      },
    };
  }

  return { ok: true, value: undefined };
}

/**
 * Нормализует значение из одного диапазона в другой (linear transformation)
 * ⚠️ Zero-span range → NaN (не silently возвращает midpoint)
 * @internal
 */
function normalizeValue(
  value: number,
  fromRange: Readonly<{ min: number; max: number; }>,
  toRange: Readonly<{ min: number; max: number; }>,
): number {
  const fromSpan = fromRange.max - fromRange.min;
  // Zero-span range = invalid configuration (должно быть отловлено валидацией в normalizeScore)
  // Возвращаем NaN для предотвращения silent midpoint (на случай прямого вызова функции)
  if (fromSpan === 0) {
    return NaN;
  }

  const normalized = ((value - fromRange.min) / fromSpan) * (toRange.max - toRange.min)
    + toRange.min;
  return normalized;
}

/* ============================================================================
 * 4. SCORING — GENERIC SCORING OPERATIONS (Unified Algebraic Contract)
 * ============================================================================
 */

/**
 * Scoring: generic функции для scoring
 * @note Чистые функции, ScoreResult для composability
 * @public
 */
export const scoring = {
  /**
   * Рассчитывает weighted score из массивов scores и weights
   * @note Формула: (∑scoreᵢ * weightᵢ) / (∑weightᵢ)
   * @example scoring.weightedScore([80, 90, 70], [0.3, 0.4, 0.3])
   */
  weightedScore(
    scores: readonly number[], // Массив scores
    weights: readonly number[], // Массив weights
    config: ScoringConfig = DEFAULT_SCORING_CONFIG, // Конфигурация scoring
  ): ScoreResult<number> { // ScoreResult с weighted score или ошибкой
    // Валидация длины массивов
    if (scores.length !== weights.length) {
      return {
        ok: false,
        reason: {
          kind: 'LENGTH_MISMATCH',
          scoresLength: scores.length,
          weightsLength: weights.length,
        },
      };
    }

    const accumulation = accumulateWeightedFromArrays(scores, weights, config);
    if (!accumulation.ok) {
      return accumulation;
    }

    return computeWeightedScore(accumulation.value);
  },

  /**
   * Рассчитывает weighted score из WeightedValue<number>
   * @example scoring.weightedScoreFromWeightedValues([{ value: 80, weight: 0.3 }, { value: 90, weight: 0.4 }])
   */
  weightedScoreFromWeightedValues(
    weightedScores: readonly Readonly<{ value: number; weight: number; }>[], // Массив weighted scores
    config: ScoringConfig = DEFAULT_SCORING_CONFIG, // Конфигурация scoring
  ): ScoreResult<number> { // ScoreResult с weighted score или ошибкой
    const accumulation = accumulateWeighted(weightedScores, config);
    if (!accumulation.ok) {
      return accumulation;
    }

    return computeWeightedScore(accumulation.value);
  },

  /**
   * Рассчитывает weighted score из Iterable (streaming: single-pass, O(n))
   * @example scoring.weightedScoreFromIterable([{ value: 80, weight: 0.3 }, { value: 90, weight: 0.4 }])
   */
  weightedScoreFromIterable(
    weightedScores: Iterable<Readonly<{ value: number; weight: number; }>>, // Iterable weighted scores
    config: ScoringConfig = DEFAULT_SCORING_CONFIG, // Конфигурация scoring
  ): ScoreResult<number> { // ScoreResult с weighted score или ошибкой
    const accumulation = accumulateWeighted(weightedScores, config);
    if (!accumulation.ok) {
      return accumulation;
    }

    return computeWeightedScore(accumulation.value);
  },

  /**
   * Нормализует score из одного диапазона в другой (linear transformation)
   * @note По умолчанию разрешает extrapolation. Используйте strictRange: true для запрета.
   * @example scoring.normalizeScore(50, { min: 0, max: 100 }, { min: 0, max: 1 })
   * @example scoring.normalizeScore(150, { min: 0, max: 100 }, { min: 0, max: 1 }, { strictRange: true })
   */
  normalizeScore(
    score: number, // Score для нормализации
    fromRange: Readonly<{ min: number; max: number; }>, // Исходный диапазон
    toRange: Readonly<{ min: number; max: number; }>, // Целевой диапазон
    config?: Readonly<{ strictRange?: boolean; }>, // Конфигурация (strictRange для запрета extrapolation)
  ): ScoreResult<number> { // ScoreResult с нормализованным score или ошибкой
    if (!isFiniteNumber(score)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    const rangeValidation = validateRange(fromRange, toRange);
    if (!rangeValidation.ok) {
      return rangeValidation;
    }

    if (config?.strictRange === true && (score < fromRange.min || score > fromRange.max)) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_SCORE',
          index: -1,
          score,
        },
      };
    }

    const normalized = normalizeValue(score, fromRange, toRange);
    if (!isFiniteNumber(normalized)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    return {
      ok: true,
      value: normalized,
    };
  },

  /**
   * Ограничивает score к диапазону (clamp)
   * @example scoring.clampScore(150, { min: 0, max: 100 })
   */
  clampScore(
    score: number, // Score для ограничения
    range: Readonly<{ min: number; max: number; }>, // Диапазон для ограничения
  ): ScoreResult<number> { // ScoreResult с ограниченным score или ошибкой
    if (!isFiniteNumber(score)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    if (!isFiniteNumber(range.min) || !isFiniteNumber(range.max)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    if (range.min >= range.max) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_SCORE_RANGE',
          min: range.min,
          max: range.max,
        },
      };
    }

    const clamped = Math.min(Math.max(score, range.min), range.max);

    return {
      ok: true,
      value: clamped,
    };
  },
} as const;

/* ============================================================================
 * 5. SCORE ALGEBRA — EXTENSIBLE CONTRACT FOR CUSTOM SCORING OPERATIONS
 * ============================================================================
 */

/**
 * Валидирует входные данные для scoreAlgebra.operate
 * @internal
 */
function validateOperateInputs(
  scores: readonly number[],
  weights: readonly number[],
  config: ScoringConfig,
): ScoreResult<void> {
  if (scores.length !== weights.length) {
    return {
      ok: false,
      reason: {
        kind: 'LENGTH_MISMATCH',
        scoresLength: scores.length,
        weightsLength: weights.length,
      },
    };
  }

  const scoresValidation = validateScores(scores, config.scoreRange);
  if (!scoresValidation.ok) {
    return scoresValidation;
  }

  const weightsValidation = validateWeights(weights, config.weightValidation);
  if (!weightsValidation.ok) {
    return weightsValidation;
  }

  return { ok: true, value: undefined };
}

/**
 * Проверяет валидность product score * weight (overflow guard)
 * @internal
 */
function guardNumericProduct(score: number, weight: number): ScoreResult<void> {
  const product = score * weight;
  if (!isFiniteNumber(product)) {
    return {
      ok: false,
      reason: { kind: 'INFINITY_RESULT' },
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Проверяет валидность state (numeric guard для primitive number states)
 * ⚠️ Только primitive numbers, не nested структуры (например, { sum: number })
 * @internal
 */
function guardState(value: unknown): ScoreResult<void> {
  // Core только проверяет primitive number states (не nested структуры)
  if (typeof value === 'number' && !isFiniteNumber(value)) {
    return {
      ok: false,
      reason: { kind: 'NAN_RESULT' },
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Обрабатывает один элемент в цикле scoreAlgebra.operate
 * @internal
 */
function processOperateStep<TState, TContext, E>(
  state: TState,
  score: number | undefined,
  weight: number | undefined,
  index: number,
  operation: ScoreOperation<unknown, TState, TContext, E>,
  context: TContext | undefined,
): ScoreResult<TState, E> {
  // Undefined guard
  if (score === undefined || weight === undefined) {
    return {
      ok: false,
      reason: {
        kind: 'INVALID_SCORE',
        index,
        score: score ?? NaN,
      },
    } as ScoreResult<TState, E>;
  }

  // Overflow guard
  const productGuard = guardNumericProduct(score, weight);
  if (!productGuard.ok) {
    return productGuard as ScoreResult<TState, E>;
  }

  // Вызов step
  const stepResult = operation.step(state, score, weight, index, context);
  if (!stepResult.ok) {
    return stepResult;
  }

  // Numeric guard для state (только primitive numbers)
  const stateGuard = guardState(stepResult.value);
  if (!stateGuard.ok) {
    return stateGuard as ScoreResult<TState, E>;
  }

  return { ok: true, value: stepResult.value };
}

/**
 * Контракт для extensible scoring operations (custom scoring strategies, score transformations, etc.)
 * @template TResult - Тип результата
 * @template TState - Тип состояния
 * @template TContext - Тип контекста (timestamp, entity, feature flags, environment, etc.)
 * @template E - Тип ошибки (core не знает shape domain errors, возвращает E | ScoreFailureReason)
 * @note Generic по TResult, TState, TContext, E для full algebra extensibility.
 *       FORMAL CONTRACT: все методы должны быть pure, deterministic, immutable.
 *       Pure: без side-effects, Date.now(), Math.random(), global state.
 *       Deterministic: одинаковые входы → одинаковые результаты.
 *       Immutable: step() возвращает новое состояние, не мутирует currentState.
 *       Numeric invariants: step() возвращает валидные числа (если TState содержит числа).
 *       Violations → undefined behavior.
 *       Core обеспечивает детерминизм pipeline, но не защищает от нарушений контракта в user-defined операциях.
 * @public
 */
export interface ScoreOperation<
  TResult = number, // Тип результата
  TState = unknown, // Тип состояния
  TContext = void, // Тип контекста (timestamp, entity, feature flags, environment, etc.)
  E = unknown, // Тип ошибки (core не знает shape domain errors, возвращает E | ScoreFailureReason)
> {
  /**
   * Инициализирует начальное состояние операции
   */
  init(): TState; // Начальное состояние

  /**
   * Обновляет состояние операции (early termination через ScoreResult)
   * @note Возвращает новое состояние (immutable) или ошибка для early termination
   */
  step(
    currentState: TState, // Текущее состояние (не должен мутироваться)
    score: number, // Значение score
    weight: number, // Вес score
    index: number, // Индекс в массиве
    context?: TContext, // Контекст операции (timestamp, entity, feature flags, environment, etc.)
  ): ScoreResult<TState, E>; // ScoreResult с новым состоянием или ошибкой

  /**
   * Финализирует результат операции из состояния
   */
  finalize(
    finalState: TState, // Финальное состояние
  ): ScoreResult<TResult, E>; // ScoreResult с результатом операции или ошибкой
}

/**
 * Score Algebra: factory для custom scoring operations
 * @note Без изменения core логики
 * @public
 */
export const scoreAlgebra = {
  /**
   * Применяет ScoreOperation к массивам scores и weights
   * @template TResult - Тип результата
   * @template TState - Тип состояния
   * @template TContext - Тип контекста (timestamp, entity, feature flags, environment, etc.)
   * @template E - Тип ошибки (core не знает shape domain errors, возвращает E | ScoreFailureReason)
   * @note Использует loop вместо reduce для real early termination (CPU boundedness).
   *       Результат операции generic по E для full algebra extensibility.
   * @example const maxOp: ScoreOperation<number, number> = { init: () => 0, step: (acc, score) => ({ ok: true, value: Math.max(acc, score) }), finalize: (s) => ({ ok: true, value: s }) }; scoreAlgebra.operate([80, 90, 70], [0.3, 0.4, 0.3], maxOp)
   */
  operate<
    TResult = number, // Тип результата
    TState = unknown, // Тип состояния
    TContext = void, // Тип контекста (timestamp, entity, feature flags, environment, etc.)
    E = unknown, // Тип ошибки (core не знает shape domain errors, возвращает E | ScoreFailureReason)
  >(
    scores: readonly number[], // Массив scores
    weights: readonly number[], // Массив weights
    operation: ScoreOperation<TResult, TState, TContext, E>, // ScoreOperation (см. ScoreOperation contract)
    config: ScoringConfig = DEFAULT_SCORING_CONFIG, // Конфигурация scoring
    context?: TContext, // Контекст операции (timestamp, entity, feature flags, environment, etc.)
  ): ScoreResult<TResult, E | ScoreFailureReason> { // ScoreResult с результатом операции или ошибкой
    const validation = validateOperateInputs(scores, weights, config);
    if (!validation.ok) {
      return validation;
    }

    // Real early termination: loop вместо reduce (reduce НЕ early-terminates в runtime)
    /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation -- необходимо для real early termination */
    let state = operation.init();

    for (let i = 0; i < scores.length; i++) {
      const stepResult = processOperateStep(
        state,
        scores[i],
        weights[i],
        i,
        operation,
        context,
      );
      if (!stepResult.ok) {
        return stepResult; // Early termination (deterministic failure index, bounded CPU)
      }
      state = stepResult.value;
    }
    /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation */

    const finalizeResult = operation.finalize(state);
    if (!finalizeResult.ok) {
      return finalizeResult;
    }

    // Post-finalize numeric guard для защиты от NaN/Infinity в результате
    if (typeof finalizeResult.value === 'number' && !isFiniteNumber(finalizeResult.value)) {
      return {
        ok: false,
        reason: { kind: 'NAN_RESULT' },
      };
    }

    return finalizeResult;
  },
} as const;
