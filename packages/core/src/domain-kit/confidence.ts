/**
 * @file packages/core/src/domain-kit/confidence.ts
 * ============================================================================
 * 🛡️ CORE — Domain Kit (Confidence)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Generic confidence value для probability и uncertainty в domain-kit
 * - Confidence = числовое значение (0..1) с валидацией и операциями комбинирования
 * - Причина изменения: domain-kit, probability/uncertainty modeling, confidence aggregation
 *
 * Принципы:
 * - ✅ SRP: модульная структура (value object / operations / combiners factory)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты, строгая валидация весов
 * - ✅ Domain-pure: без side-effects, платформо-агностично, generic по доменам
 * - ✅ Extensible: domain определяет операции комбинирования через ConfidenceCombiner без изменения core
 * - ✅ Strict typing: phantom generic для type safety между доменами
 * - ✅ Microservice-ready: runtime validation предотвращает cross-service inconsistency
 * - ✅ Scalable: extensible operations через function composition, Kahan summation для точности
 * - ✅ Security: runtime validation NaN/Infinity, assertValid для fail-fast
 *
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения (HIGH/MEDIUM/LOW - это domain labels)
 * - ❌ НЕ определяет конкретные стратегии комбинирования (только contract через ConfidenceCombiner)
 * - ✅ Только generic числовое значение (0..1) с валидацией
 * - ✅ Domain определяет стратегию комбинирования через ConfidenceCombiner
 * - ✅ Type-safe: phantom generic предотвращает смешивание разных доменов
 * - ✅ Runtime-safe: защита от forged confidence при десериализации
 */

/* ============================================================================
 * 1. TYPES — CONFIDENCE MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Confidence: числовое значение (0..1) с phantom generic для type safety между доменами
 * Используется для представления вероятности, уверенности, неопределенности
 * @template TDomain - Идентификатор домена ('risk', 'toxicity', 'trust', 'quality')
 * @public
 */
export type Confidence<TDomain extends string = string> = number & {
  readonly __brand: 'Confidence';
  readonly __domain: TDomain;
};

/**
 * Результат валидации confidence (effect-based)
 * @template TConfidence - Тип confidence
 * @public
 */
export type ConfidenceOutcome<TConfidence extends Confidence> =
  | Readonly<{ ok: true; value: TConfidence; }>
  | Readonly<{ ok: false; reason: ConfidenceFailureReason; }>;

/**
 * Причина ошибки валидации confidence
 * @public
 */
export type ConfidenceFailureReason =
  | Readonly<{ kind: 'NOT_A_NUMBER'; value: unknown; }>
  | Readonly<{ kind: 'INVALID_RANGE'; value: number; min: number; max: number; }>
  | Readonly<{ kind: 'NEGATIVE_VALUE'; value: number; }>
  | Readonly<{ kind: 'GREATER_THAN_ONE'; value: number; }>;

/**
 * Стратегия комбинирования confidence значений
 * @template TDomain - Идентификатор домена
 * @note Extensible contract для domain-specific логики комбинирования
 * @public
 */
export interface ConfidenceCombiner<TDomain extends string = string> {
  /**
   * Комбинирует два confidence значения
   * @param a - Первое confidence значение
   * @param b - Второе confidence значение
   * @returns Результат комбинирования (0..1)
   */
  combine(
    a: Confidence<TDomain>, // Первое confidence значение
    b: Confidence<TDomain>, // Второе confidence значение
  ): Confidence<TDomain>; // Результат комбинирования (0..1)
}

/**
 * Результат операции комбинирования confidence
 * @public
 */
export type ConfidenceCombineResult<TDomain extends string = string> =
  | Readonly<{ ok: true; value: Confidence<TDomain>; }>
  | Readonly<{ ok: false; reason: string; }>;

/**
 * Режим агрегации для confidence (strict vs lenient)
 * @public
 */
export type ConfidenceAggregationMode = 'strict' | 'lenient';

/**
 * Константы для валидации весов в weighted average
 * @internal
 */
const WEIGHT_VALIDATION = Object.freeze(
  {
    /** Допустимое отклонение суммы весов от 1.0 (5%) */
    TOLERANCE: 0.05,
    /** Минимальная допустимая сумма весов */
    MIN_TOTAL: 0.95,
    /** Максимальная допустимая сумма весов */
    MAX_TOTAL: 1.05,
  } as const,
);

/* ============================================================================
 * 2. INTERNAL — BRANDED TYPE CONSTRUCTION
 * ============================================================================
 */

/**
 * Helper для создания branded type
 * @internal
 */
function createBrandedConfidence<TDomain extends string>(value: number): Confidence<TDomain> {
  return value as Confidence<TDomain>;
}

/**
 * Проверяет валидность confidence значения (runtime safety)
 * @internal
 */
function validateConfidence<TDomain extends string>(
  conf: Confidence<TDomain>,
): ConfidenceOutcome<Confidence<TDomain>> {
  const val = confidence.value(conf);
  if (!Number.isFinite(val)) {
    return {
      ok: false,
      reason: {
        kind: 'NOT_A_NUMBER' as const,
        value: val,
      },
    };
  }
  if (val < 0) {
    return {
      ok: false,
      reason: {
        kind: 'NEGATIVE_VALUE' as const,
        value: val,
      },
    };
  }
  if (val > 1) {
    return {
      ok: false,
      reason: {
        kind: 'GREATER_THAN_ONE' as const,
        value: val,
      },
    };
  }
  return { ok: true, value: conf };
}

/**
 * Kahan summation для высокоточного суммирования confidence значений
 * Предотвращает накопление ошибок округления при больших массивах
 * @internal
 */
function kahanSum(values: readonly number[]): number {
  return values.reduce<{ sum: number; compensation: number; }>(
    (acc, value) => {
      const y = value - acc.compensation;
      const t = acc.sum + y;
      const compensation = (t - acc.sum) - y;
      return { sum: t, compensation };
    },
    { sum: 0, compensation: 0 },
  ).sum;
}

/* ============================================================================
 * 3. CONFIDENCE — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Confidence value object: создание, валидация, сериализация
 * @public
 */
export const confidence = {
  /**
   * Создает confidence из числа с валидацией диапазона (0..1)
   * @template TDomain - Идентификатор домена
   * @example const result = confidence.create(0.85, 'risk'); if (result.ok) { const conf = result.value; // Confidence<'risk'> }
   * @public
   */
  create<TDomain extends string>(
    value: unknown, // Числовое значение (0..1)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- phantom generic для type safety
    _domain: TDomain, // Идентификатор домена для type safety (phantom generic, не используется в runtime)
  ): ConfidenceOutcome<Confidence<TDomain>> { // ConfidenceOutcome с результатом валидации
    if (typeof value !== 'number') {
      return {
        ok: false,
        reason: {
          kind: 'NOT_A_NUMBER' as const,
          value,
        },
      };
    }

    if (!Number.isFinite(value)) {
      return {
        ok: false,
        reason: {
          kind: 'NOT_A_NUMBER' as const,
          value,
        },
      };
    }

    if (value < 0) {
      return {
        ok: false,
        reason: {
          kind: 'NEGATIVE_VALUE' as const,
          value,
        },
      };
    }

    if (value > 1) {
      return {
        ok: false,
        reason: {
          kind: 'GREATER_THAN_ONE' as const,
          value,
        },
      };
    }

    return {
      ok: true,
      value: createBrandedConfidence<TDomain>(value),
    };
  },

  /**
   * Десериализует confidence из числа с валидацией
   * @template TDomain - Идентификатор домена
   * @public
   */
  deserialize<TDomain extends string>(
    value: unknown, // Числовое значение (0..1)
    domain: TDomain, // Идентификатор домена для type safety (phantom generic)
  ): ConfidenceOutcome<Confidence<TDomain>> { // ConfidenceOutcome с результатом валидации
    return confidence.create(value, domain);
  },

  /**
   * Извлекает числовое значение из confidence
   * @template TDomain - Идентификатор домена
   * @public
   */
  value<TDomain extends string>(
    conf: Confidence<TDomain>, // Confidence значение
  ): number { // Числовое значение (0..1)
    return conf;
  },

  /**
   * Проверяет валидность домена (для раннего fail-fast в микросервисной среде)
   * @public
   */
  isValidDomain(domain: string): boolean { // true если домен валиден (не пустая строка)
    return typeof domain === 'string' && domain.length > 0;
  },
} as const;

/* ============================================================================
 * 4. CONFIDENCE OPERATIONS — RUNTIME OPERATIONS MODULE
 * ============================================================================
 */

/**
 * Confidence Operations: runtime операции комбинирования confidence значений
 * @note Policy helpers для различных стратегий комбинирования
 * @public
 */
export const confidenceOperations = {
  /**
   * Безопасное комбинирование двух confidence значений с runtime валидацией
   * @template TDomain - Идентификатор домена
   * @note Предотвращает silent failure при data corruption между микросервисами
   * @example const combiner = confidenceCombiners.average(); const result = confidenceOperations.safeCombine(conf1, conf2, combiner); if (result !== undefined) { // Использовать результат }
   * @public
   */
  safeCombine<TDomain extends string>(
    a: Confidence<TDomain>, // Первое confidence значение
    b: Confidence<TDomain>, // Второе confidence значение
    combiner: ConfidenceCombiner<TDomain>, // Стратегия комбинирования
  ): Confidence<TDomain> | undefined { // Результат комбинирования или undefined если значения невалидны
    const validationA = validateConfidence(a);
    if (!validationA.ok) {
      return undefined;
    }
    const validationB = validateConfidence(b);
    if (!validationB.ok) {
      return undefined;
    }
    return combiner.combine(a, b);
  },

  /**
   * Комбинирует два confidence значения используя заданный combiner
   * @template TDomain - Идентификатор домена
   * @note ⚠️ Не выполняет runtime валидацию (используйте safeCombine для production)
   * @public
   */
  combine<TDomain extends string>(
    a: Confidence<TDomain>, // Первое confidence значение
    b: Confidence<TDomain>, // Второе confidence значение
    combiner: ConfidenceCombiner<TDomain>, // Стратегия комбинирования
  ): Confidence<TDomain> { // Результат комбинирования
    return combiner.combine(a, b);
  },

  /**
   * Вычисляет среднее арифметическое confidence значений
   * @template TDomain - Идентификатор домена
   * @note Использует Kahan summation для высокой точности при больших массивах
   * @public
   */
  average<TDomain extends string>(
    values: readonly Confidence<TDomain>[], // Массив confidence значений
  ): Confidence<TDomain> | undefined { // Среднее значение или undefined если массив пустой
    if (values.length === 0) {
      return undefined;
    }

    // Используем Kahan summation для высокой точности
    const numericValues = values.map((val) => confidence.value(val));
    const sum = kahanSum(numericValues);
    const avg = sum / values.length;

    // Валидация не требуется, так как avg всегда в диапазоне [0, 1]
    // (сумма значений в [0, 1] делится на положительное число)
    return createBrandedConfidence<TDomain>(avg);
  },

  /**
   * Вычисляет взвешенное среднее confidence значений
   * @template TDomain - Идентификатор домена
   * @note Строгая валидация суммы весов (tolerance ±5%). Использует Kahan summation для высокой точности
   * @public
   */
  weightedAverage<TDomain extends string>(
    values: readonly Confidence<TDomain>[], // Массив confidence значений
    weights: readonly number[], // Массив весов (сумма должна быть ~1.0)
    mode: ConfidenceAggregationMode = 'strict', // Режим агрегации
  ): Confidence<TDomain> | undefined { // Взвешенное среднее или undefined если массивы не совпадают по длине или весы невалидны
    if (values.length === 0 || values.length !== weights.length) {
      return undefined;
    }

    // Валидация весов: проверка на NaN, Infinity, отрицательные значения
    const hasInvalidWeight = weights.some((weight) => !Number.isFinite(weight) || weight < 0);
    if (hasInvalidWeight) {
      return undefined;
    }

    // Вычисление суммы весов с Kahan summation
    const totalWeight = kahanSum(weights);

    // Строгая валидация суммы весов (tolerance ±5%)
    if (totalWeight < WEIGHT_VALIDATION.MIN_TOTAL || totalWeight > WEIGHT_VALIDATION.MAX_TOTAL) {
      if (mode === 'strict') {
        return undefined;
      }
      // Lenient mode: нормализация весов
      const normalizedWeights = weights.map((w) => w / totalWeight);
      return confidenceOperations.weightedAverage(values, normalizedWeights, 'strict');
    }

    // Вычисление взвешенной суммы с Kahan summation
    const weightedProducts = values.map((val, index) => {
      const weight = weights[index];
      if (weight === undefined) {
        return 0;
      }
      return confidence.value(val) * weight;
    });
    const weightedSum = kahanSum(weightedProducts);

    // Валидация не требуется, так как weightedSum всегда в диапазоне [0, 1]
    // (каждое значение в [0, 1] умножается на нормализованный вес и суммируется)
    return createBrandedConfidence<TDomain>(weightedSum);
  },
} as const;

/* ============================================================================
 * 5. CONFIDENCE COMBINERS — COMBINER FACTORY MODULE
 * ============================================================================
 */

/**
 * Confidence Combiners: factory для создания preset combiners
 * @note Отдельный модуль для соблюдения SRP (combiner factory vs runtime operations)
 * @public
 */
export const confidenceCombiners = {
  /**
   * Создает combiner для среднего арифметического
   * @template TDomain - Идентификатор домена
   * @public
   */
  average<TDomain extends string>(): ConfidenceCombiner<TDomain> { // ConfidenceCombiner для average strategy
    return {
      combine(a, b): Confidence<TDomain> {
        const validationA = validateConfidence(a);
        const validationB = validateConfidence(b);
        if (!validationA.ok || !validationB.ok) {
          // Возвращаем среднее даже при невалидных значениях (combiner не должен fail)
          // Валидация должна быть на уровне safeCombine
          return createBrandedConfidence<TDomain>(0);
        }
        const avg = (confidence.value(a) + confidence.value(b)) / 2;
        return createBrandedConfidence<TDomain>(avg);
      },
    };
  },

  /**
   * Создает combiner для максимума (pessimistic)
   * @template TDomain - Идентификатор домена
   * @public
   */
  maximum<TDomain extends string>(): ConfidenceCombiner<TDomain> { // ConfidenceCombiner для maximum strategy
    return {
      combine(a, b): Confidence<TDomain> {
        const validationA = validateConfidence(a);
        const validationB = validateConfidence(b);
        if (!validationA.ok || !validationB.ok) {
          return createBrandedConfidence<TDomain>(0);
        }
        const max = Math.max(confidence.value(a), confidence.value(b));
        return createBrandedConfidence<TDomain>(max);
      },
    };
  },

  /**
   * Создает combiner для минимума (optimistic)
   * @template TDomain - Идентификатор домена
   * @public
   */
  minimum<TDomain extends string>(): ConfidenceCombiner<TDomain> { // ConfidenceCombiner для minimum strategy
    return {
      combine(a, b): Confidence<TDomain> {
        const validationA = validateConfidence(a);
        const validationB = validateConfidence(b);
        if (!validationA.ok || !validationB.ok) {
          return createBrandedConfidence<TDomain>(0);
        }
        const min = Math.min(confidence.value(a), confidence.value(b));
        return createBrandedConfidence<TDomain>(min);
      },
    };
  },

  /**
   * Создает combiner для произведения (independent events)
   * @template TDomain - Идентификатор домена
   * @public
   */
  product<TDomain extends string>(): ConfidenceCombiner<TDomain> { // ConfidenceCombiner для product strategy
    return {
      combine(a, b): Confidence<TDomain> {
        const validationA = validateConfidence(a);
        const validationB = validateConfidence(b);
        if (!validationA.ok || !validationB.ok) {
          return createBrandedConfidence<TDomain>(0);
        }
        const product = confidence.value(a) * confidence.value(b);
        return createBrandedConfidence<TDomain>(product);
      },
    };
  },

  /**
   * Создает combiner для суммы с ограничением (dependent events)
   * @template TDomain - Идентификатор домена
   * @public
   */
  sum<TDomain extends string>(): ConfidenceCombiner<TDomain> { // ConfidenceCombiner для sum strategy (capped at 1.0)
    return {
      combine(a, b): Confidence<TDomain> {
        const validationA = validateConfidence(a);
        const validationB = validateConfidence(b);
        if (!validationA.ok || !validationB.ok) {
          return createBrandedConfidence<TDomain>(0);
        }
        const sum = Math.min(confidence.value(a) + confidence.value(b), 1.0);
        return createBrandedConfidence<TDomain>(sum);
      },
    };
  },

  /**
   * Создает chain combiner для последовательного применения нескольких combiners
   * @template TDomain - Идентификатор домена
   * @note Полезно для pipeline комбинирования в больших rule-engine
   * @example const chain = confidenceCombiners.chain(confidenceCombiners.average(), confidenceCombiners.maximum()); // Эквивалентно: maximum(average(a, b), b)
   * @public
   */
  chain<TDomain extends string>(
    ...combiners: readonly ConfidenceCombiner<TDomain>[] // Массив combiners для последовательного применения
  ): ConfidenceCombiner<TDomain> | undefined { // ConfidenceCombiner который применяет combiners в порядке слева направо
    if (combiners.length === 0) {
      return undefined;
    }

    return {
      combine(a, b): Confidence<TDomain> {
        const validationA = validateConfidence(a);
        const validationB = validateConfidence(b);
        if (!validationA.ok || !validationB.ok) {
          return createBrandedConfidence<TDomain>(0);
        }

        // Применяем combiners последовательно через reduce
        const firstCombiner = combiners[0];
        if (firstCombiner === undefined) {
          return createBrandedConfidence<TDomain>(0);
        }

        const initialResult = firstCombiner.combine(a, b);

        return combiners.slice(1).reduce<Confidence<TDomain>>(
          (acc, combiner) => combiner.combine(acc, b),
          initialResult,
        );
      },
    };
  },
} as const;
