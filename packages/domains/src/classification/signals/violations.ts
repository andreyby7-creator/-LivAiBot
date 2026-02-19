/**
 * @file packages/domains/src/classification/signals/violations.ts
 * ============================================================================
 * 🎯 DOMAINS — Classification Signals Violations (Domain-Specific Violations)
 * ============================================================================
 *
 * Domain-specific violations для classification signals.
 * Семантическая валидация signals для policy-engine и explainability.
 *
 * Архитектура: библиотека из 2 модулей в одном файле
 * - SemanticViolation: типы нарушений (union types для strict typing)
 * - semanticViolationValidator: валидация signals (composable validators)
 *
 * Принципы:
 * - ✅ SRP: модульная структура (типы / валидаторы, разделение concerns)
 * - ✅ Deterministic: одинаковые входы → одинаковые результаты, без side-effects
 * - ✅ Domain-pure: без side-effects, domain объявляет violations (НЕ core)
 * - ✅ Scalable: declarative структура, расширяется через union types без if/else-монолита
 * - ✅ Strict typing: union types для всех значений, без string/Record в domain
 * - ✅ Extensible: легко расширяется новыми violation codes через union types
 * - ✅ Security: runtime validation для защиты от forged violations
 */

import { GEO_VALIDATION, SCORE_VALIDATION } from '../constants.js';
import type { ClassificationGeo, InternalClassificationSignals } from './signals.js';

/* ============================================================================
 * 🧩 ТИПЫ — SEMANTIC VIOLATION TYPES
 * ============================================================================
 */

/**
 * Строгость нарушения (для policy-engine)
 * - ignore: игнорировать, не влияет на решение
 * - degrade: снизить confidence, но не блокировать (только для missing signals)
 * - block: удалить сигнал из оценки (для corrupted/tampered data)
 * @public
 */
export type SemanticViolationSeverity = 'ignore' | 'degrade' | 'block';

/**
 * Область влияния нарушения
 * - confidence: влияет на уверенность в оценке
 * - signals: влияет на доступность сигналов для scoring
 * - decision: влияет на принятие решения
 * @public
 */
export type SemanticViolationAffects = 'confidence' | 'signals' | 'decision';

/**
 * Влияние нарушения (для explainability)
 * - increases_risk: увеличивает риск (недостоверный сигнал)
 * - removes_signal: удаляет сигнал из оценки
 * - blocks_evaluation: блокирует оценку полностью
 * @public
 */
export type SemanticViolationImpact = 'increases_risk' | 'removes_signal' | 'blocks_evaluation';

/**
 * Причина нарушения для score violations
 * @public
 */
export type ScoreViolationReason = 'not_a_number' | 'not_finite' | 'out_of_range';

/**
 * Причина нарушения для coordinate violations
 * @public
 */
export type CoordinateViolationReason =
  | 'lat_not_finite'
  | 'lat_out_of_range'
  | 'lng_not_finite'
  | 'lng_out_of_range';

/**
 * Причина нарушения для incomplete coordinates
 * @public
 */
export type IncompleteCoordinatesReason = 'incomplete_coordinates_spoofing_risk';

/**
 * Метаданные для INVALID_REPUTATION_SCORE и INVALID_VELOCITY_SCORE
 * @public
 */
export type ScoreViolationMeta = Readonly<{
  /** Некорректное значение score */
  readonly value: number;
  /** Причина нарушения */
  readonly reason: ScoreViolationReason;
}>;

/**
 * Метаданные для INVALID_COORDINATES
 * @public
 */
export type CoordinatesViolationMeta = Readonly<{
  /** Широта */
  readonly lat: number;
  /** Долгота */
  readonly lng: number;
  /** Причина нарушения */
  readonly reason: CoordinateViolationReason;
}>;

/**
 * Метаданные для INCOMPLETE_COORDINATES
 * @public
 */
export type IncompleteCoordinatesViolationMeta = Readonly<{
  /** Широта (если присутствует) */
  readonly lat?: number;
  /** Долгота (если присутствует) */
  readonly lng?: number;
  /** Причина нарушения */
  readonly reason: IncompleteCoordinatesReason;
}>;

/**
 * Нарушение семантики classification signals
 * Production-grade модель для policy-engine и explainability
 * Discriminated union по code для type safety и exhaustive checking
 * Single source of truth: все коды нарушений определяются здесь
 * SemanticViolationCode выводится из SemanticViolation['code'] для предотвращения drift
 * @public
 */
export type SemanticViolation =
  | Readonly<{
    readonly code: 'INVALID_REPUTATION_SCORE' | 'INVALID_VELOCITY_SCORE';
    readonly severity: SemanticViolationSeverity;
    readonly affects: SemanticViolationAffects;
    readonly impact: SemanticViolationImpact;
    readonly meta: ScoreViolationMeta;
  }>
  | Readonly<{
    readonly code: 'INVALID_COORDINATES';
    readonly severity: SemanticViolationSeverity;
    readonly affects: SemanticViolationAffects;
    readonly impact: SemanticViolationImpact;
    readonly meta: CoordinatesViolationMeta;
  }>
  | Readonly<{
    readonly code: 'INCOMPLETE_COORDINATES';
    readonly severity: SemanticViolationSeverity;
    readonly affects: SemanticViolationAffects;
    readonly impact: SemanticViolationImpact;
    readonly meta: IncompleteCoordinatesViolationMeta;
  }>;

/**
 * Код нарушения (machine-actionable для policy-engine)
 * Выводится из SemanticViolation['code'] для single source of truth
 * TypeScript автоматически предупредит, если добавить новый код в union, но забыть обработать его
 * @public
 */
export type SemanticViolationCode = SemanticViolation['code'];

/* ============================================================================
 * 🔧 INTERNAL HELPERS
 * ============================================================================
 */

/**
 * Helper: условное значение (функциональный стиль для composable validators)
 * @internal
 */
function when<T>(cond: boolean, value: T): T | undefined {
  return cond ? value : undefined;
}

/**
 * Helper: проверка валидности координаты lat
 * @internal
 */
function isValidLatitude(lat: unknown): lat is number {
  return typeof lat === 'number'
    && Number.isFinite(lat)
    && lat >= GEO_VALIDATION.MIN_LAT
    && lat <= GEO_VALIDATION.MAX_LAT;
}

/**
 * Helper: проверка валидности координаты lng
 * @internal
 */
function isValidLongitude(lng: unknown): lng is number {
  return typeof lng === 'number'
    && Number.isFinite(lng)
    && lng >= GEO_VALIDATION.MIN_LNG
    && lng <= GEO_VALIDATION.MAX_LNG;
}

/**
 * Helper: создание violation для score
 * @internal
 */
function createScoreViolation(
  code: 'INVALID_REPUTATION_SCORE' | 'INVALID_VELOCITY_SCORE',
  value: unknown,
): SemanticViolation | undefined {
  return (
    when(value !== undefined && typeof value !== 'number', {
      code,
      severity: 'block' as const,
      affects: 'signals' as const,
      impact: 'removes_signal' as const,
      meta: {
        value: Number.NaN,
        reason: 'not_a_number' as const,
      },
    })
      ?? when(typeof value === 'number' && !Number.isFinite(value), {
        code,
        severity: 'block' as const,
        affects: 'signals' as const,
        impact: 'removes_signal' as const,
        meta: {
          value: value as number,
          reason: 'not_finite' as const,
        },
      })
      ?? when(
        typeof value === 'number'
          && (value < SCORE_VALIDATION.MIN_SCORE || value > SCORE_VALIDATION.MAX_SCORE),
        {
          code,
          severity: 'block' as const,
          affects: 'signals' as const,
          impact: 'removes_signal' as const,
          meta: {
            value: value as number,
            reason: 'out_of_range' as const,
          },
        },
      )
  );
}

/**
 * Helper: создание violation для координат
 * @internal
 */
function createCoordinatesViolation(
  lat: unknown,
  lng: unknown,
): SemanticViolation | undefined {
  const latNum = typeof lat === 'number' ? lat : Number.NaN;
  const lngNum = typeof lng === 'number' ? lng : Number.NaN;

  return (
    when(!isValidLatitude(lat), {
      code: 'INVALID_COORDINATES' as const,
      severity: 'block' as const,
      affects: 'signals' as const,
      impact: 'removes_signal' as const,
      meta: {
        lat: latNum,
        lng: lngNum,
        reason: (typeof lat !== 'number' || !Number.isFinite(lat)
          ? 'lat_not_finite'
          : 'lat_out_of_range') as CoordinateViolationReason,
      },
    })
      ?? when(!isValidLongitude(lng), {
        code: 'INVALID_COORDINATES' as const,
        severity: 'block' as const,
        affects: 'signals' as const,
        impact: 'removes_signal' as const,
        meta: {
          lat: latNum,
          lng: lngNum,
          reason: (typeof lng !== 'number' || !Number.isFinite(lng)
            ? 'lng_not_finite'
            : 'lng_out_of_range') as CoordinateViolationReason,
        },
      })
  );
}

/**
 * Helper: создание violation для неполных координат
 * @internal
 */
function createIncompleteCoordinatesViolation(
  lat: unknown,
  lng: unknown,
): SemanticViolation | undefined {
  const hasLat = lat !== undefined;
  const hasLng = lng !== undefined;

  return when(hasLat !== hasLng, {
    code: 'INCOMPLETE_COORDINATES' as const,
    severity: 'block' as const,
    affects: 'signals' as const,
    impact: 'removes_signal' as const,
    meta: {
      ...(hasLat && typeof lat === 'number' && { lat }),
      ...(hasLng && typeof lng === 'number' && { lng }),
      reason: 'incomplete_coordinates_spoofing_risk' as const,
    },
  });
}

/* ============================================================================
 * 🔧 COMPOSABLE VALIDATORS
 * ============================================================================
 */

/**
 * Валидирует reputationScore (0-100, finite number)
 * @internal
 */
function validateReputationScore(
  value: unknown,
): SemanticViolation | undefined {
  return createScoreViolation('INVALID_REPUTATION_SCORE', value);
}

/**
 * Валидирует velocityScore (0-100, finite number)
 * @internal
 */
function validateVelocityScore(
  value: unknown,
): SemanticViolation | undefined {
  return createScoreViolation('INVALID_VELOCITY_SCORE', value);
}

/**
 * Валидирует координаты geo (WGS84, finite numbers)
 * Invariant: координаты либо полные (lat + lng), либо отсутствуют (защита от spoofing)
 * @internal
 */
function validateCoordinates(
  geo: ClassificationGeo | undefined,
): SemanticViolation | undefined {
  if (geo === undefined) {
    return undefined; // Missing coordinates - не violation, влияет на confidence через scoring
  }

  const { lat, lng } = geo;

  // Проверка invariant: координаты либо полные, либо отсутствуют
  const incompleteViolation = createIncompleteCoordinatesViolation(lat, lng);
  if (incompleteViolation !== undefined) {
    return incompleteViolation;
  }

  // Если координаты полные, проверяем валидность
  if (lat !== undefined && lng !== undefined) {
    return createCoordinatesViolation(lat, lng);
  }

  return undefined;
}

/* ============================================================================
 * 🏗️ SEMANTIC VIOLATION VALIDATOR — VALUE OBJECT MODULE
 * ============================================================================
 */

/**
 * Semantic Violation Validator: валидация classification signals
 * Composable validators для каждого типа проверки
 * @public
 */
export const semanticViolationValidator = {
  /**
   * Валидирует семантику classification signals (domain logic)
   *
   * Проверяет: диапазоны значений (0-100), finite numbers, валидность координат (WGS84),
   * invariant координат (полные или отсутствуют — защита от spoofing).
   *
   * НЕ проверяет: безопасность, JSON-serializable, формат передачи данных (adapter layer).
   *
   * @param signals - Сигналы для валидации
   * @returns Массив нарушений (пустой если всё валидно)
   *
   * @example
   * ```ts
   * const violations = semanticViolationValidator.validate(signals);
   * if (violations.length > 0) {
   *   // Обработка violations для policy-engine
   * }
   * ```
   */
  validate(
    signals: InternalClassificationSignals | undefined,
  ): readonly SemanticViolation[] {
    if (signals === undefined) {
      return [];
    }

    return ([
      validateReputationScore(signals.reputationScore),
      validateVelocityScore(signals.velocityScore),
      validateCoordinates(signals.previousGeo),
    ] as readonly (SemanticViolation | undefined)[]).filter(
      (v): v is SemanticViolation => v !== undefined,
    );
  },
} as const;
