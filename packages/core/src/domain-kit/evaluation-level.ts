/**
 * @file packages/core/src/domain-kit/evaluation-level.ts
 * ============================================================================
 * 🛡️ CORE — Evaluation Level (Decision Algebra)
 * ============================================================================
 *
 * Generic evaluation level для decision algebra в domain-kit.
 * EvaluationLevel = числовая шкала (0..N) с parametric algebra contract.
 *
 * Архитектура: библиотека из 4 модулей в одном файле
 * - EvaluationLevel: value object (создание, валидация, сериализация)
 * - EvaluationScale: scale factory (предотвращает semantic split-brain)
 * - EvaluationAlgebra: algebra contract и presets (ordering, lattice)
 * - EvaluationAggregation: aggregation policies (worstCase, bestCase, streaming)
 *
 * Принципы:
 * - ✅ SRP: модульная структура (value object / algebra / policies)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты (scale-enforced)
 * - ✅ Domain-pure: без side-effects, платформо-агностично
 * - ✅ Microservice-ready: scale fingerprint предотвращает cross-service inconsistency
 * - ✅ Scalable: parametric algebra для partial/non-linear/multi-axis ordering
 * - ✅ Strict typing: phantom generic + opaque scale для type safety между доменами
 * - ✅ Extensible: domain определяет ordering и scale без изменения core
 * - ✅ Immutable: все операции возвращают новые значения
 *
 * ⚠️ ВАЖНО:
 * - ❌ НЕ включает domain-специфичные значения (SAFE/SUSPICIOUS/DANGEROUS - это domain labels)
 * - ❌ НЕ определяет ordering implementation (только contract через EvaluationOrder)
 * - ✅ Только generic числовая шкала (0..N) с parametric algebra
 * - ✅ Domain определяет scale, ordering и aggregation strategy
 * - ✅ Type-safe: phantom generic + scale fingerprint предотвращает смешивание разных доменов
 * - ✅ Algebra-first: contract для корректной multi-rule aggregation
 * - ✅ Runtime-safe: защита от forged levels и scale при десериализации
 * - ✅ Partial order ready: join/meet могут возвращать undefined для incomparable
 */

/* ============================================================================
 * 🧩 ТИПЫ — STRICT BRANDED TYPES WITH PHANTOM GENERIC
 * ============================================================================
 */

/**
 * Raw Evaluation Level: числовая шкала (0..N) с phantom generic для type safety между доменами
 * Используется в algebra операциях (compare, join, meet)
 * @template TDomain - Идентификатор домена ('risk', 'toxicity', 'trust')
 * @public
 */
export type EvaluationLevel<TDomain extends string = string> = number & {
  readonly __brand: 'EvaluationLevel';
  readonly __raw: true;
  readonly __domain: TDomain;
};

/**
 * Normalized Evaluation Level: проецированный в scale (algebra-breaking)
 * ⚠️ Нельзя использовать в algebra операциях (compare, join, meet)
 * Отдельный бренд предотвращает использование в algebra
 * @template TDomain - Идентификатор домена
 * @public
 */
export type NormalizedEvaluationLevel<TDomain extends string = string> = number & {
  readonly __brand: 'NormalizedEvaluationLevel';
  readonly __normalized: true;
  readonly __domain: TDomain;
};

/**
 * Opaque brand для EvaluationScale (предотвращает semantic split-brain)
 * @internal
 */
const EvaluationScaleBrand = Symbol('EvaluationScaleBrand');

/**
 * Evaluation Scale: диапазон значений с runtime fingerprint (scaleId) и semantic version
 * Предотвращает forged scale и semantic split-brain между версиями сервиса
 * @template TDomain - Идентификатор домена
 * @public
 */
export type EvaluationScale<TDomain extends string = string> = Readonly<{
  /** Минимальное значение (включительно) */
  readonly min: number;
  /** Максимальное значение (включительно) */
  readonly max: number;
  /** Идентификатор домена для type safety */
  readonly domain: TDomain;
  /** Semantic version для предотвращения split-brain (domain определяет версию семантики) */
  readonly semanticVersion: string;
  /** Runtime fingerprint для защиты от forged scale и semantic divergence (hash: domain:min:max:version) */
  readonly scaleId: string;
  /** Opaque brand для предотвращения структурного создания */
  readonly [EvaluationScaleBrand]: symbol;
}>;

/**
 * Результат валидации evaluation level (effect-based)
 * @template TLevel - Тип evaluation level
 * @public
 */
export type EvaluationLevelOutcome<TLevel extends EvaluationLevel> =
  | Readonly<{ ok: true; value: TLevel; }>
  | Readonly<{ ok: false; reason: EvaluationLevelFailureReason; }>;

/**
 * Причина ошибки валидации evaluation level
 * @public
 */
export type EvaluationLevelFailureReason =
  | Readonly<{ kind: 'INVALID_RANGE'; value: number; min: number; max: number; }>
  | Readonly<{ kind: 'NOT_A_NUMBER'; value: unknown; }>
  | Readonly<{ kind: 'NEGATIVE_VALUE'; value: number; }>
  | Readonly<{ kind: 'NON_INTEGER'; value: number; }>
  | Readonly<{ kind: 'SCALE_MISMATCH'; expectedScaleId: string; actualScaleId: string; }>;

/**
 * Результат сравнения evaluation levels (поддерживает partial order через 'incomparable')
 * @public
 */
export type Ordering = -1 | 0 | 1 | 'incomparable';

/**
 * Результат создания evaluation scale (effect-based)
 * @public
 */
export type EvaluationScaleOutcome<TDomain extends string = string> =
  | Readonly<{ ok: true; value: EvaluationScale<TDomain>; }>
  | Readonly<{ ok: false; reason: string; }>;

/**
 * Результат проверки algebra laws (effect-based)
 * @public
 */
export type LatticeVerificationResult =
  | Readonly<{ ok: true; }>
  | Readonly<{ ok: false; reason: string; }>;

/**
 * Режим агрегации для partial order (strict vs lenient)
 * @public
 */
export type AggregationMode = 'strict' | 'lenient';

/**
 * Контракт для ordering evaluation levels (parametric algebra)
 * Domain реализует свой ordering, core только contract
 * Для partial order join/meet могут возвращать undefined
 * @template TDomain - Идентификатор домена
 * @public
 */
export interface EvaluationOrder<TDomain extends string = string> {
  /** Сравнивает два evaluation level (поддерживает partial order через 'incomparable') */
  compare(a: EvaluationLevel<TDomain>, b: EvaluationLevel<TDomain>): Ordering;
  /** Join операция (supremum в lattice) - может быть undefined для partial order */
  join(
    a: EvaluationLevel<TDomain>,
    b: EvaluationLevel<TDomain>,
  ): EvaluationLevel<TDomain> | undefined;
  /** Meet операция (infimum в lattice) - может быть undefined для partial order */
  meet(
    a: EvaluationLevel<TDomain>,
    b: EvaluationLevel<TDomain>,
  ): EvaluationLevel<TDomain> | undefined;
}

/**
 * Контракт для lattice ordering (требует algebra laws: associativity, commutativity, idempotency)
 * Для total order join/meet всегда определены, для partial order могут быть undefined
 * @template TDomain - Идентификатор домена
 * @public
 */
export interface LatticeOrder<TDomain extends string = string> extends EvaluationOrder<TDomain> {
  /** Top (⊤): максимальный элемент в lattice */
  top(scale: EvaluationScale<TDomain>): EvaluationLevel<TDomain>;
  /** Bottom (⊥): минимальный элемент в lattice */
  bottom(scale: EvaluationScale<TDomain>): EvaluationLevel<TDomain>;
}

/* ============================================================================
 * 🔒 INTERNAL — BRANDED TYPE CONSTRUCTION
 * ============================================================================
 */

/**
 * Set для хранения normalized levels (runtime type guard)
 * @internal
 */
const normalizedLevels = new Set<number>();

/**
 * Helper для создания branded type
 * @internal
 */
function createBrandedLevel<TDomain extends string>(value: number): EvaluationLevel<TDomain> {
  return value as EvaluationLevel<TDomain>;
}

/**
 * Helper для создания normalized branded type
 * @internal
 */
function createNormalizedLevel<TDomain extends string>(
  value: number,
): NormalizedEvaluationLevel<TDomain> {
  // Добавляем значение в Set для runtime проверки
  // eslint-disable-next-line functional/immutable-data -- необходимо для runtime type guard
  normalizedLevels.add(value);
  return value as NormalizedEvaluationLevel<TDomain>;
}

/**
 * Создает stable hash для scale fingerprint (непредсказуемый, но стабильный)
 * Защищает от forged scale и semantic mismatch между сервисами
 * Использует FNV-1a hash algorithm
 * @internal
 */
function createScaleId(min: number, max: number, domain: string, semanticVersion: string): string {
  const raw = `${domain}|${min}|${max}|${semanticVersion}`;
  const fnvOffsetBasis = 2166136261;
  const fnvPrime = 16777619;
  const base36 = 36;
  const hash = Array.from(raw).reduce<number>((h, char) => {
    const charCode = char.charCodeAt(0);
    return ((h ^ charCode) * fnvPrime) >>> 0;
  }, fnvOffsetBasis);
  return `s${hash.toString(base36)}`;
}

/* ============================================================================
 * 🏗️ EVALUATION LEVEL — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Evaluation Level value object: создание, валидация, сериализация
 * @public
 */
export const evaluationLevel = {
  /**
   * Создает evaluation level из числа с валидацией по scale
   * @returns EvaluationLevelOutcome с результатом валидации
   * @example
   * ```ts
   * const scale = evaluationScale.create(0, 10, 'risk');
   * const result = evaluationLevel.create(5, scale.value);
   * if (result.ok) {
   *   const level = result.value; // EvaluationLevel<'risk'>
   * }
   * ```
   */
  create<TDomain extends string>(
    value: unknown, // Числовое значение (0..N)
    scale: EvaluationScale<TDomain>, // Evaluation scale для валидации диапазона
  ): EvaluationLevelOutcome<EvaluationLevel<TDomain>> {
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

    if (!Number.isInteger(value)) {
      return {
        ok: false,
        reason: {
          kind: 'NON_INTEGER' as const,
          value,
        },
      };
    }

    if (value < scale.min || value > scale.max) {
      return {
        ok: false,
        reason: {
          kind: 'INVALID_RANGE' as const,
          value,
          min: scale.min,
          max: scale.max,
        },
      };
    }

    return {
      ok: true,
      value: createBrandedLevel<TDomain>(value),
    };
  },

  /**
   * Десериализует evaluation level из числа с валидацией (защита от forged levels и scale)
   * Проверяет scale fingerprint для защиты от forged scale
   * @returns EvaluationLevelOutcome с результатом валидации
   */
  deserialize<TDomain extends string>(
    value: unknown, // Числовое значение (0..N)
    scale: EvaluationScale<TDomain>, // Evaluation scale для валидации диапазона (проверяется fingerprint)
    expectedScaleId?: string, // Ожидаемый scale fingerprint (для защиты от forged scale)
  ): EvaluationLevelOutcome<EvaluationLevel<TDomain>> {
    // Проверка scale fingerprint для защиты от forged scale
    if (expectedScaleId !== undefined && scale.scaleId !== expectedScaleId) {
      return {
        ok: false,
        reason: {
          kind: 'SCALE_MISMATCH' as const,
          expectedScaleId,
          actualScaleId: scale.scaleId,
        },
      };
    }

    return evaluationLevel.create(value, scale);
  },

  /** Извлекает числовое значение из evaluation level */
  value<TDomain extends string>(
    level: EvaluationLevel<TDomain>, // Evaluation level
  ): number {
    return level;
  },

  /**
   * Проверяет, является ли уровень нормализованным (проецированным в scale)
   * Type guard для NormalizedEvaluationLevel
   * ⚠️ В runtime branded types неразличимы (оба - числа), проверка основана на типе
   * Используйте для type narrowing в TypeScript
   * @returns true если уровень нормализован
   */
  isNormalized<TDomain extends string>(
    level: EvaluationLevel<TDomain> | NormalizedEvaluationLevel<TDomain>, // Evaluation level для проверки
  ): level is NormalizedEvaluationLevel<TDomain> {
    // Используем WeakMap для runtime проверки normalized levels
    return typeof level === 'number' && normalizedLevels.has(level);
  },
} as const;

/* ============================================================================
 * 📏 EVALUATION SCALE — SCALE FACTORY MODULE
 * ============================================================================
 */

/**
 * Evaluation Scale factory: создание scale с opaque brand и runtime fingerprint
 * @public
 */
export const evaluationScale = {
  /**
   * Создает evaluation scale (factory для предотвращения semantic split-brain)
   * Генерирует runtime fingerprint (scaleId) с semantic version
   * @returns EvaluationScaleOutcome с результатом создания
   * @example
   * ```ts
   * const scale = evaluationScale.create(0, 10, 'risk', 'v2');
   * if (scale.ok) {
   *   const scaleId = scale.value.scaleId; // hash fingerprint
   * }
   * ```
   */
  create<TDomain extends string>(
    min: number, // Минимальное значение (включительно)
    max: number, // Максимальное значение (включительно)
    domain: TDomain, // Идентификатор домена
    semanticVersion: string = 'v1', // Semantic version для предотвращения split-brain (например, 'v1', 'v2', 'moderation-v1')
  ): EvaluationScaleOutcome<TDomain> {
    if (min < 0 || max < min || !Number.isInteger(min) || !Number.isInteger(max)) {
      return {
        ok: false,
        reason: `Invalid evaluation scale: min=${min}, max=${max}`,
      };
    }

    if (semanticVersion.length === 0) {
      return {
        ok: false,
        reason: 'Semantic version cannot be empty',
      };
    }

    const scaleId = createScaleId(min, max, domain, semanticVersion);

    return {
      ok: true,
      value: {
        min,
        max,
        domain,
        semanticVersion,
        scaleId,
        [EvaluationScaleBrand]: EvaluationScaleBrand,
      } as EvaluationScale<TDomain>,
    };
  },
} as const;

/* ============================================================================
 * 🔢 EVALUATION ALGEBRA — ALGEBRA CONTRACT MODULE
 * ============================================================================
 */

/**
 * Создает стандартный ordering (total order)
 * @param ascending - true: ascending (0=best, N=worst), false: descending (0=worst, N=best)
 * @internal
 */
function createStandardOrder<TDomain extends string>(
  ascending: boolean = true,
): EvaluationOrder<TDomain> {
  return {
    compare(a, b): Ordering {
      if (ascending) {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      }
      // descending
      if (a > b) {
        return -1;
      }
      if (a < b) {
        return 1;
      }
      return 0;
    },
    join(a, b): EvaluationLevel<TDomain> {
      return createBrandedLevel<TDomain>(ascending ? (a > b ? a : b) : (a < b ? a : b));
    },
    meet(a, b): EvaluationLevel<TDomain> {
      return createBrandedLevel<TDomain>(ascending ? (a < b ? a : b) : (a > b ? a : b));
    },
  };
}

/**
 * Создает стандартный lattice ordering (расширяет standardOrder с top/bottom)
 * @param ascending - true: ascending (0=best, N=worst), false: descending (0=worst, N=best)
 * @internal
 */
function createStandardLatticeOrder<TDomain extends string>(
  ascending: boolean = true,
): LatticeOrder<TDomain> {
  const base = createStandardOrder<TDomain>(ascending);
  return {
    ...base,
    top(scale): EvaluationLevel<TDomain> {
      return createBrandedLevel<TDomain>(ascending ? scale.max : scale.min);
    },
    bottom(scale): EvaluationLevel<TDomain> {
      return createBrandedLevel<TDomain>(ascending ? scale.min : scale.max);
    },
  };
}

/**
 * Evaluation Algebra: контракты и presets для ordering
 * @public
 */
export const evaluationAlgebra = {
  /**
   * Создает стандартный ordering (total order)
   * @param ascending - true: ascending (0=best, N=worst), false: descending (0=worst, N=best)
   * Preset для convenience, domain может определить свой ordering
   */
  standardOrder: <TDomain extends string>(ascending: boolean = true) =>
    createStandardOrder<TDomain>(ascending),

  /**
   * Создает стандартный lattice ordering (расширяет standardOrder с top/bottom)
   * @param ascending - true: ascending (0=best, N=worst), false: descending (0=worst, N=best)
   */
  standardLatticeOrder: <TDomain extends string>(ascending: boolean = true) =>
    createStandardLatticeOrder<TDomain>(ascending),
} as const;

/* ============================================================================
 * 🧪 EVALUATION ALGEBRA DEV — DEV-ONLY TOOLS (TREE-SHAKEABLE)
 * ============================================================================
 */

/** Проверяет idempotency law: join(a, a) === a, meet(a, a) === a @internal */
function checkIdempotency<TDomain extends string>(
  order: LatticeOrder<TDomain>,
  a: EvaluationLevel<TDomain>,
): LatticeVerificationResult {
  const joinIdem = order.join(a, a);
  const meetIdem = order.meet(a, a);
  if (joinIdem === undefined || meetIdem === undefined || joinIdem !== a || meetIdem !== a) {
    return {
      ok: false,
      reason: 'Lattice order violates idempotency law',
    };
  }
  return { ok: true };
}

/** Проверяет commutativity law: join(a, b) === join(b, a), meet(a, b) === meet(b, a) @internal */
function checkCommutativity<TDomain extends string>(
  order: LatticeOrder<TDomain>,
  a: EvaluationLevel<TDomain>,
  b: EvaluationLevel<TDomain>,
): LatticeVerificationResult {
  const joinAb = order.join(a, b);
  const joinBa = order.join(b, a);
  const meetAb = order.meet(a, b);
  const meetBa = order.meet(b, a);
  if (joinAb !== joinBa || meetAb !== meetBa) {
    return {
      ok: false,
      reason: 'Lattice order violates commutativity law',
    };
  }
  return { ok: true };
}

/** Проверяет associativity law для join: join(join(a, b), c) === join(a, join(b, c)) @internal */
function checkAssociativityJoin<TDomain extends string>(
  order: LatticeOrder<TDomain>,
  a: EvaluationLevel<TDomain>,
  b: EvaluationLevel<TDomain>,
  c: EvaluationLevel<TDomain>,
): LatticeVerificationResult {
  const joinAb = order.join(a, b);
  const joinBC = order.join(b, c);
  const joinAbC = joinAb !== undefined ? order.join(joinAb, c) : undefined;
  const joinABC = joinBC !== undefined ? order.join(a, joinBC) : undefined;

  // Сначала проверяем semilattice consistency (existence consistency)
  if (
    (joinAbC !== undefined && joinABC === undefined)
    || (joinAbC === undefined && joinABC !== undefined)
  ) {
    return {
      ok: false,
      reason:
        'Lattice order violates semilattice consistency: associativity sides have inconsistent existence',
    };
  }

  // Затем проверяем равенство значений (если обе стороны определены)
  if (joinAbC !== undefined && joinABC !== undefined && joinAbC !== joinABC) {
    return {
      ok: false,
      reason: 'Lattice order violates associativity law (join): both sides exist but differ',
    };
  }

  return { ok: true };
}

/** Проверяет associativity law для meet: meet(meet(a, b), c) === meet(a, meet(b, c)) @internal */
function checkAssociativityMeet<TDomain extends string>(
  order: LatticeOrder<TDomain>,
  a: EvaluationLevel<TDomain>,
  b: EvaluationLevel<TDomain>,
  c: EvaluationLevel<TDomain>,
): LatticeVerificationResult {
  const meetAb = order.meet(a, b);
  const meetBC = order.meet(b, c);
  const meetAbC = meetAb !== undefined ? order.meet(meetAb, c) : undefined;
  const meetABC = meetBC !== undefined ? order.meet(a, meetBC) : undefined;

  // Сначала проверяем semilattice consistency (existence consistency)
  if (
    (meetAbC !== undefined && meetABC === undefined)
    || (meetAbC === undefined && meetABC !== undefined)
  ) {
    return {
      ok: false,
      reason:
        'Lattice order violates semilattice consistency: associativity sides have inconsistent existence',
    };
  }

  // Затем проверяем равенство значений (если обе стороны определены)
  if (meetAbC !== undefined && meetABC !== undefined && meetAbC !== meetABC) {
    return {
      ok: false,
      reason: 'Lattice order violates associativity law (meet): both sides exist but differ',
    };
  }

  return { ok: true };
}

/** Проверяет absorption law: join(a, meet(a, b)) === a, meet(a, join(a, b)) === a @internal */
function checkAbsorption<TDomain extends string>(
  order: LatticeOrder<TDomain>,
  a: EvaluationLevel<TDomain>,
  b: EvaluationLevel<TDomain>,
): LatticeVerificationResult {
  const meetAb = order.meet(a, b);
  if (meetAb !== undefined) {
    const joinAbs = order.join(a, meetAb);
    if (joinAbs !== a) {
      return {
        ok: false,
        reason: 'Lattice order violates absorption law (join)',
      };
    }
  }
  const joinAb = order.join(a, b);
  if (joinAb !== undefined) {
    const meetAbs = order.meet(a, joinAb);
    if (meetAbs !== a) {
      return {
        ok: false,
        reason: 'Lattice order violates absorption law (meet)',
      };
    }
  }
  return { ok: true };
}

/** Проверяет согласованность compare с join/meet для случая a < b @internal */
function checkCompareLessThan<TDomain extends string>(
  joinAb: EvaluationLevel<TDomain> | undefined,
  b: EvaluationLevel<TDomain>,
): LatticeVerificationResult | null {
  if (joinAb !== undefined && joinAb !== b) {
    return {
      ok: false,
      reason: 'Lattice order: compare(a,b)=-1 but join(a,b)≠b (inconsistency)',
    };
  }
  return null;
}

/** Проверяет согласованность compare с join/meet для случая a > b @internal */
function checkCompareGreaterThan<TDomain extends string>(
  meetAb: EvaluationLevel<TDomain> | undefined,
  b: EvaluationLevel<TDomain>,
): LatticeVerificationResult | null {
  if (meetAb !== undefined && meetAb !== b) {
    return {
      ok: false,
      reason: 'Lattice order: compare(a,b)=1 but meet(a,b)≠b (inconsistency)',
    };
  }
  return null;
}

/** Проверяет согласованность compare с join/meet для случая a === b @internal */
function checkCompareEqual<TDomain extends string>(
  joinAb: EvaluationLevel<TDomain> | undefined,
  meetAb: EvaluationLevel<TDomain> | undefined,
  a: EvaluationLevel<TDomain>,
): LatticeVerificationResult | null {
  if (joinAb !== undefined && joinAb !== a) {
    return {
      ok: false,
      reason: 'Lattice order: compare(a,b)=0 but join(a,b)≠a (inconsistency)',
    };
  }
  if (meetAb !== undefined && meetAb !== a) {
    return {
      ok: false,
      reason: 'Lattice order: compare(a,b)=0 but meet(a,b)≠a (inconsistency)',
    };
  }
  return null;
}

/**
 * Проверяет согласованность compare с join/meet: a ≤ b ⇔ join(a,b)=b, a ≥ b ⇔ meet(a,b)=b
 * @internal
 */
function checkCompareConsistency<TDomain extends string>(
  order: LatticeOrder<TDomain>,
  a: EvaluationLevel<TDomain>,
  b: EvaluationLevel<TDomain>,
): LatticeVerificationResult {
  const compareAB = order.compare(a, b);
  const joinAb = order.join(a, b);
  const meetAb = order.meet(a, b);

  if (compareAB === -1) {
    const result = checkCompareLessThan(joinAb, b);
    if (result !== null) {
      return result;
    }
  } else if (compareAB === 1) {
    const result = checkCompareGreaterThan(meetAb, b);
    if (result !== null) {
      return result;
    }
  } else if (compareAB === 0) {
    const result = checkCompareEqual(joinAb, meetAb, a);
    if (result !== null) {
      return result;
    }
  }

  return { ok: true };
}

/** Проверяет top/bottom consistency @internal */
function checkTopBottom<TDomain extends string>(
  order: LatticeOrder<TDomain>,
  scale: EvaluationScale<TDomain>,
): LatticeVerificationResult {
  const top = order.top(scale);
  const bottom = order.bottom(scale);
  if (order.compare(top, bottom) !== 1) {
    return {
      ok: false,
      reason: 'Lattice order: top must be greater than bottom',
    };
  }
  return { ok: true };
}

/**
 * Dev tools для проверки algebra laws (tree-shakeable)
 * @public
 */
export const evaluationAlgebraDev = {
  /**
   * Проверяет algebra laws для EvaluationOrder (dev-only)
   * Проверяет associativity, commutativity, idempotency, absorption, согласованность compare с join/meet
   * @returns LatticeVerificationResult с результатом проверки
   * @example
   * ```ts
   * const result = evaluationAlgebraDev.verify(customOrder, [level1, level2, level3], scale);
   * if (!result.ok) {
   *   console.error(result.reason);
   * }
   * ```
   */
  verify<TDomain extends string>(
    order: LatticeOrder<TDomain>, // Evaluation order для проверки
    sampleValues: readonly EvaluationLevel<TDomain>[], // Массив sample values для проверки
    scale: EvaluationScale<TDomain>, // Evaluation scale для проверки
  ): LatticeVerificationResult {
    if (sampleValues.length < 2) {
      return { ok: true };
    }

    const [a, b, c] = sampleValues;

    if (a === undefined || b === undefined || c === undefined) {
      return { ok: true };
    }

    const idempotencyResult = checkIdempotency(order, a);
    if (!idempotencyResult.ok) {
      return idempotencyResult;
    }

    const commutativityResult = checkCommutativity(order, a, b);
    if (!commutativityResult.ok) {
      return commutativityResult;
    }

    const associativityJoinResult = checkAssociativityJoin(order, a, b, c);
    if (!associativityJoinResult.ok) {
      return associativityJoinResult;
    }

    const associativityMeetResult = checkAssociativityMeet(order, a, b, c);
    if (!associativityMeetResult.ok) {
      return associativityMeetResult;
    }

    const absorptionResult = checkAbsorption(order, a, b);
    if (!absorptionResult.ok) {
      return absorptionResult;
    }

    const compareConsistencyResult = checkCompareConsistency(order, a, b);
    if (!compareConsistencyResult.ok) {
      return compareConsistencyResult;
    }

    const topBottomResult = checkTopBottom(order, scale);
    if (!topBottomResult.ok) {
      return topBottomResult;
    }

    return { ok: true };
  },
} as const;

/* ============================================================================
 * 🎯 EVALUATION AGGREGATION — AGGREGATION POLICIES MODULE
 * ============================================================================
 */

/**
 * Evaluation Aggregation: опциональные aggregation strategies для rule engines
 * Policy helpers, требуют LatticeOrder для корректной работы
 * Поддерживает partial order через strict/lenient режимы
 * @public
 */
export const evaluationAggregation = {
  /**
   * Streaming aggregation step для rule engines
   * Для partial order может вернуть undefined если элементы incomparable
   * @example
   * ```ts
   * const result = levels.reduce((acc, level) =>
   *   evaluationAggregation.step(acc, level, order), initialLevel);
   * ```
   */
  step<TDomain extends string>(
    prev: EvaluationLevel<TDomain>, // Предыдущий накопленный результат
    next: EvaluationLevel<TDomain>, // Следующий evaluation level
    order: LatticeOrder<TDomain>, // Lattice ordering для aggregation
  ): EvaluationLevel<TDomain> | undefined {
    return order.join(prev, next);
  },

  /** Проверяет, находится ли evaluation level в заданном диапазоне [min, max] */
  isInRange<TDomain extends string>(
    level: EvaluationLevel<TDomain>, // Evaluation level для проверки
    min: number, // Минимальное значение (включительно)
    max: number, // Максимальное значение (включительно)
  ): boolean {
    return level >= min && level <= max;
  },

  /**
   * Проецирует evaluation level в заданный диапазон (projection operator)
   * ⚠️ Algebra-breaking: нарушает монотонность lattice, нельзя использовать в algebra
   * Используйте только для финальной нормализации, не в процессе aggregation
   * @returns NormalizedEvaluationLevel (нельзя использовать в compare/join/meet)
   */
  projectToScale<TDomain extends string>(
    level: EvaluationLevel<TDomain>, // Evaluation level для проецирования
    scale: EvaluationScale<TDomain>, // Evaluation scale для проецирования
  ): NormalizedEvaluationLevel<TDomain> {
    const projected: number = level < scale.min
      ? scale.min
      : level > scale.max
      ? scale.max
      : level;
    return createNormalizedLevel<TDomain>(projected);
  },

  /**
   * Worst case aggregation (supremum) - для risk model
   * Поддерживает partial order через strict/lenient режимы
   * Lenient mode: при равных incomparable выбирает первый найденный (детерминированно)
   * @returns Максимальный evaluation level или undefined если массив пустой или incomparable (strict mode)
   */
  worstCase<TDomain extends string>(
    order: LatticeOrder<TDomain>, // Lattice ordering для aggregation
    levels: readonly EvaluationLevel<TDomain>[], // Массив evaluation levels
    mode: AggregationMode = 'strict', // Режим агрегации: 'strict' (fail при incomparable) или 'lenient' (стабильный выбор)
  ): EvaluationLevel<TDomain> | undefined {
    if (levels.length === 0) {
      return undefined;
    }

    const first = levels[0];
    if (first === undefined) {
      return undefined;
    }

    if (mode === 'strict') {
      return levels.reduce<EvaluationLevel<TDomain> | undefined>((max, current) => {
        // max не может быть undefined здесь, так как инициализируется first (проверен выше)
        if (max === undefined) {
          return current;
        }
        const joinResult = order.join(max, current);
        if (joinResult === undefined) {
          return undefined; // Fail fast при incomparable
        }

        return joinResult;
      }, first);
    }

    // Lenient mode: выбираем глобальный representative (детерминированно, не зависит от порядка)
    // Ищем элемент, который не хуже остальных (не меньше любого другого)
    // При равных incomparable выбирается первый найденный
    return levels.find((candidate) => {
      return levels.every((other) => {
        const cmp = order.compare(candidate, other);
        // candidate не хуже other если: candidate >= other или они incomparable
        return cmp === 0 || cmp === 1 || cmp === 'incomparable';
      });
    });
  },

  /**
   * Best case aggregation (infimum) - для trust model
   * Поддерживает partial order через strict/lenient режимы
   * Lenient mode: при равных incomparable выбирает первый найденный (детерминированно)
   * @returns Минимальный evaluation level или undefined если массив пустой или incomparable (strict mode)
   */
  bestCase<TDomain extends string>(
    order: LatticeOrder<TDomain>, // Lattice ordering для aggregation
    levels: readonly EvaluationLevel<TDomain>[], // Массив evaluation levels
    mode: AggregationMode = 'strict', // Режим агрегации: 'strict' (fail при incomparable) или 'lenient' (стабильный выбор)
  ): EvaluationLevel<TDomain> | undefined {
    if (levels.length === 0) {
      return undefined;
    }

    const first = levels[0];
    if (first === undefined) {
      return undefined;
    }

    if (mode === 'strict') {
      return levels.reduce<EvaluationLevel<TDomain> | undefined>((min, current) => {
        // min не может быть undefined здесь, так как инициализируется first (проверен выше)
        if (min === undefined) {
          return current;
        }
        const meetResult = order.meet(min, current);
        if (meetResult === undefined) {
          return undefined; // Fail fast при incomparable
        }

        return meetResult;
      }, first);
    }

    // Lenient mode: выбираем глобальный representative (детерминированно, не зависит от порядка)
    // Ищем элемент, который не лучше остальных (не больше любого другого)
    // При равных incomparable выбирается первый найденный
    return levels.find((candidate) => {
      return levels.every((other) => {
        const cmp = order.compare(candidate, other);
        // candidate не лучше other если: candidate <= other или они incomparable
        return cmp === 0 || cmp === -1 || cmp === 'incomparable';
      });
    });
  },
} as const;
