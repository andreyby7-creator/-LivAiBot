/**
 * @file packages/feature-auth/src/domain/RiskValidation.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Semantics Validation (Domain Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Семантическая валидация risk signals (domain logic)
 * - Проверка бизнес-правил и диапазонов значений
 * - Возвращает violations для observability, explainability и policy-engine
 * - НЕ проверяет безопасность (это responsibility adapter layer)
 *
 * Принципы:
 * - ✅ Pure — детерминированная функция без side-effects
 * - ✅ Domain-focused — только бизнес-логика, не security
 * - ✅ Composable — отдельные функции для каждого типа проверки
 * - ✅ Policy-ready — violations пригодны для policy-engine без парсинга
 * - ✅ Explainable — возвращает violations с impact для explainability
 *
 * @note Domain validator — decision tree, не pipeline.
 * Отключение правила обосновано: readonly массивы неизменяемы на runtime.
 * Требование Immutable конфликтует с выводом типов flatMap.
 */

/* eslint-disable functional/prefer-immutable-types */
/* readonly массивы неизменяемы на runtime, Immutable конфликтует с flatMap */

import type { RiskSignals } from '../types/risk.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Строгость нарушения (для policy-engine)
 * - ignore: игнорировать, не влияет на решение
 * - degrade: снизить confidence, но не блокировать (только для missing signals)
 * - block: удалить сигнал из оценки (для corrupted/tampered data)
 * @note Fraud-система правило: type/range invalid → block (remove signal), missing → degrade confidence
 */
export type ViolationSeverity = 'ignore' | 'degrade' | 'block';

/**
 * Область влияния нарушения
 * - confidence: влияет на уверенность в оценке
 * - signals: влияет на доступность сигналов для scoring
 * - decision: влияет на принятие решения (block/challenge)
 */
export type ViolationAffects = 'confidence' | 'signals' | 'decision';

/**
 * Влияние нарушения (для explainability)
 * - increases_risk: увеличивает риск (недостоверный сигнал)
 * - removes_signal: удаляет сигнал из оценки
 * - blocks_evaluation: блокирует оценку полностью
 */
export type ViolationImpact = 'increases_risk' | 'removes_signal' | 'blocks_evaluation';

/** Код нарушения (machine-actionable для policy-engine) */
export type ViolationCode =
  | 'INVALID_REPUTATION_SCORE'
  | 'INVALID_VELOCITY_SCORE'
  | 'INVALID_COORDINATES'
  | 'INCOMPLETE_COORDINATES';

/** Метаданные для INVALID_REPUTATION_SCORE и INVALID_VELOCITY_SCORE */
type ScoreViolationMeta = {
  readonly value: number;
  readonly reason: 'not_a_number' | 'not_finite' | 'out_of_range';
};

/** Метаданные для INVALID_COORDINATES */
type CoordinatesViolationMeta = {
  readonly lat: number;
  readonly lng: number;
  readonly reason: 'lat_not_finite' | 'lat_out_of_range' | 'lng_not_finite' | 'lng_out_of_range';
};

/** Метаданные для INCOMPLETE_COORDINATES */
type IncompleteCoordinatesViolationMeta = {
  readonly lat?: number;
  readonly lng?: number;
  readonly reason: 'incomplete_coordinates_spoofing_risk';
};

/**
 * Нарушение семантики risk signals
 * Production-grade модель для policy-engine и explainability
 * @note Pipeline использует severity для политики, impact — для explainability
 * @note Meta shape зависит от code — это invariant для policy-engine
 */
export type RiskSemanticViolation =
  | {
    readonly code: 'INVALID_REPUTATION_SCORE' | 'INVALID_VELOCITY_SCORE';
    readonly severity: ViolationSeverity;
    readonly affects: ViolationAffects;
    readonly impact: ViolationImpact;
    readonly meta: ScoreViolationMeta;
  }
  | {
    readonly code: 'INVALID_COORDINATES';
    readonly severity: ViolationSeverity;
    readonly affects: ViolationAffects;
    readonly impact: ViolationImpact;
    readonly meta: CoordinatesViolationMeta;
  }
  | {
    readonly code: 'INCOMPLETE_COORDINATES';
    readonly severity: ViolationSeverity;
    readonly affects: ViolationAffects;
    readonly impact: ViolationImpact;
    readonly meta: IncompleteCoordinatesViolationMeta;
  };

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

const MIN_LAT = -90; // Минимальная широта (WGS84)
const MAX_LAT = 90; // Максимальная широта (WGS84)
const MIN_LNG = -180; // Минимальная долгота (WGS84)
const MAX_LNG = 180; // Максимальная долгота (WGS84)
const MIN_SCORE = 0; // Минимальный reputation/velocity score
const MAX_SCORE = 100; // Максимальный reputation/velocity score

/* ============================================================================
 * 🔧 HELPERS
 * ============================================================================
 */

/**
 * Выражение-условие для функциональных таблиц решений
 * @param cond - Условие для проверки
 * @param value - Значение для возврата, если условие истинно
 * @returns Значение, если условие истинно, иначе undefined
 */
const when = <T>(cond: boolean, value: T): T | undefined => (cond ? value : undefined);

/* ============================================================================
 * 🔧 COMPOSABLE VALIDATORS
 * ============================================================================
 */

/**
 * Валидирует reputationScore (0-100, finite number)
 * @param value - Значение для проверки
 * @returns Violation или undefined если валидно
 */
function validateReputationScore(value: unknown): RiskSemanticViolation | undefined {
  return (
    when(value !== undefined && typeof value !== 'number', {
      code: 'INVALID_REPUTATION_SCORE',
      severity: 'block',
      affects: 'signals',
      impact: 'removes_signal',
      meta: { value: NaN, reason: 'not_a_number' },
    })
      ?? when(typeof value === 'number' && !Number.isFinite(value), {
        code: 'INVALID_REPUTATION_SCORE',
        severity: 'block',
        affects: 'signals',
        impact: 'removes_signal',
        meta: { value: value as number, reason: 'not_finite' },
      })
      ?? when(typeof value === 'number' && (value < MIN_SCORE || value > MAX_SCORE), {
        code: 'INVALID_REPUTATION_SCORE',
        severity: 'block',
        affects: 'signals',
        impact: 'removes_signal',
        meta: { value: value as number, reason: 'out_of_range' },
      })
  );
}

/**
 * Валидирует velocityScore (0-100, finite number)
 * @param value - Значение для проверки
 * @returns Violation или undefined если валидно
 */
function validateVelocityScore(value: unknown): RiskSemanticViolation | undefined {
  return (
    when(value !== undefined && typeof value !== 'number', {
      code: 'INVALID_VELOCITY_SCORE',
      severity: 'block',
      affects: 'signals',
      impact: 'removes_signal',
      meta: { value: NaN, reason: 'not_a_number' },
    })
      ?? when(typeof value === 'number' && !Number.isFinite(value), {
        code: 'INVALID_VELOCITY_SCORE',
        severity: 'block',
        affects: 'signals',
        impact: 'removes_signal',
        meta: { value: value as number, reason: 'not_finite' },
      })
      ?? when(typeof value === 'number' && (value < MIN_SCORE || value > MAX_SCORE), {
        code: 'INVALID_VELOCITY_SCORE',
        severity: 'block',
        affects: 'signals',
        impact: 'removes_signal',
        meta: { value: value as number, reason: 'out_of_range' },
      })
  );
}

/** Проверяет валидность широты (lat) */
function validateLatitude(lat: number, lng: number): RiskSemanticViolation | undefined {
  return (
    when(typeof lat !== 'number' || !Number.isFinite(lat), {
      code: 'INVALID_COORDINATES',
      severity: 'block',
      affects: 'signals',
      impact: 'removes_signal',
      meta: {
        lat: typeof lat === 'number' ? lat : NaN,
        lng,
        reason: 'lat_not_finite',
      },
    })
      ?? when(lat < MIN_LAT || lat > MAX_LAT, {
        code: 'INVALID_COORDINATES',
        severity: 'block',
        affects: 'signals',
        impact: 'removes_signal',
        meta: { lat, lng, reason: 'lat_out_of_range' },
      })
  );
}

/** Проверяет валидность долготы (lng) */
function validateLongitude(lat: number, lng: number): RiskSemanticViolation | undefined {
  return (
    when(typeof lng !== 'number' || !Number.isFinite(lng), {
      code: 'INVALID_COORDINATES',
      severity: 'block',
      affects: 'signals',
      impact: 'removes_signal',
      meta: {
        lat,
        lng: typeof lng === 'number' ? lng : NaN,
        reason: 'lng_not_finite',
      },
    })
      ?? when(lng < MIN_LNG || lng > MAX_LNG, {
        code: 'INVALID_COORDINATES',
        severity: 'block',
        affects: 'signals',
        impact: 'removes_signal',
        meta: { lat, lng, reason: 'lng_out_of_range' },
      })
  );
}

/**
 * Валидирует координаты geo (WGS84, finite numbers)
 * Invariant: координаты либо полные (lat + lng), либо отсутствуют (защита от spoofing)
 * @param geo - Объект с координатами
 * @returns Violation или undefined если валидно
 */
// eslint-disable-next-line @livai/multiagent/agent-isolation -- Чистая доменная валидация, без операций агентов
function validateCoordinates(
  geo: { readonly lat?: number; readonly lng?: number; } | undefined,
): RiskSemanticViolation | undefined {
  return geo === undefined
    ? undefined // Missing coordinates - не violation, влияет на confidence через scoring
    : ((): RiskSemanticViolation | undefined => {
      const { lat, lng } = geo;
      // Type narrowing через expression: проверяем invariant и сужаем типы
      return (
        when(
          lat === undefined || lng === undefined,
          ((): RiskSemanticViolation | undefined => {
            // Invariant: координаты либо полные (lat + lng), либо отсутствуют
            // Защита от spoofing через неполные координаты (невозможная геопозиция)
            const hasLat = lat !== undefined;
            const hasLng = lng !== undefined;
            return when(hasLat !== hasLng, {
              code: 'INCOMPLETE_COORDINATES',
              severity: 'block',
              affects: 'signals',
              impact: 'removes_signal',
              meta: {
                ...(hasLat && { lat }),
                ...(hasLng && { lng }),
                reason: 'incomplete_coordinates_spoofing_risk',
              },
            });
          })(),
        )
          // После type narrowing lat и lng гарантированно number
          ?? (lat !== undefined && lng !== undefined
            ? validateLatitude(lat, lng) ?? validateLongitude(lat, lng)
            : undefined)
      );
    })();
}

/* ============================================================================
 * 🎯 MAIN API
 * ============================================================================
 */

/**
 * Валидирует семантику risk signals (domain logic)
 *
 * Проверяет: диапазоны значений (0-100), finite numbers, валидность координат (WGS84),
 * invariant координат (полные или отсутствуют — защита от spoofing).
 *
 * НЕ проверяет: безопасность, JSON-serializable, формат передачи данных (adapter layer).
 *
 * @param signals - Сигналы для валидации
 * @returns Массив нарушений (пустой если всё валидно)
 *
 * @note Security sanitization должна быть выполнена ДО вызова через sanitizeExternalSignals().
 * @note Missing signals не являются violations — влияют на confidence через scoring.
 * @note Fraud-система: type/range invalid → block, missing → degrade confidence.
 * @note Performance: flatMap для фиксированного массива (3 элемента) — O(1) аллокаций.
 */
export function validateRiskSemantics(
  signals: Readonly<RiskSignals> | undefined,
): readonly RiskSemanticViolation[] {
  return signals
    ? ([
      validateReputationScore(signals.reputationScore),
      validateVelocityScore(signals.velocityScore),
      validateCoordinates(signals.previousGeo),
    ] as readonly (RiskSemanticViolation | undefined)[]).flatMap((
      v,
    ): readonly RiskSemanticViolation[] => (v ? [v] : []))
    : [];
}

/* eslint-enable functional/prefer-immutable-types */
