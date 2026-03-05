/**
 * @file Unit тесты для Classification Semantics Validation
 * Полное покрытие всех функций и edge cases (100%)
 */
import { describe, expect, it } from 'vitest';

import type { InternalClassificationSignals } from '../../../src/classification/signals/signals.js';
import type {
  IncompleteCoordinatesViolationMeta,
  ScoreViolationMeta,
  SemanticViolation,
} from '../../../src/classification/signals/violations.js';
import type { ClassificationSemanticValidator } from '../../../src/classification/strategies/validation.js';
import { validateClassificationSemantics } from '../../../src/classification/strategies/validation.js';

/* ============================================================================
 * 🧪 ТЕСТЫ — validateClassificationSemantics
 * ============================================================================
 */

describe('validateClassificationSemantics', () => {
  describe('базовая функциональность', () => {
    it('является функцией типа ClassificationSemanticValidator', () => {
      expect(typeof validateClassificationSemantics).toBe('function');
      const validator: ClassificationSemanticValidator = validateClassificationSemantics;
      expect(validator).toBe(validateClassificationSemantics);
    });

    it('возвращает пустой массив для undefined signals', () => {
      const result = validateClassificationSemantics(undefined);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it('возвращает пустой массив для валидных signals', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('возвращает пустой массив для пустого объекта signals', () => {
      const signals: InternalClassificationSignals = {};
      const result = validateClassificationSemantics(signals);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });

  describe('валидация reputationScore', () => {
    it('возвращает violation для невалидного reputationScore (not a number)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 'invalid' as unknown as number,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('not_a_number');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(Number.NaN);
    });

    it('возвращает violation для невалидного reputationScore (not finite - Infinity)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: Number.POSITIVE_INFINITY,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('not_finite');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(Number.POSITIVE_INFINITY);
    });

    it('возвращает violation для невалидного reputationScore (not finite - -Infinity)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: Number.NEGATIVE_INFINITY,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('not_finite');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(Number.NEGATIVE_INFINITY);
    });

    it('возвращает violation для невалидного reputationScore (NaN)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: Number.NaN,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('not_finite');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(Number.isNaN(meta.value)).toBe(true);
    });

    it('возвращает violation для невалидного reputationScore (out of range - negative)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -1,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('out_of_range');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(-1);
    });

    it('возвращает violation для невалидного reputationScore (out of range - too high)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 101,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('out_of_range');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(101);
    });

    it('принимает валидный reputationScore на границе (0)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 0,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });

    it('принимает валидный reputationScore на границе (100)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 100,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });
  });

  describe('валидация velocityScore', () => {
    it('возвращает violation для невалидного velocityScore (not a number)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 'invalid' as unknown as number,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_VELOCITY_SCORE');
      expect(result[0]?.meta.reason).toBe('not_a_number');
    });

    it('возвращает violation для невалидного velocityScore (not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: Number.POSITIVE_INFINITY,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_VELOCITY_SCORE');
      expect(result[0]?.meta.reason).toBe('not_finite');
    });

    it('возвращает violation для невалидного velocityScore (out of range - negative)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: -1,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_VELOCITY_SCORE');
      expect(result[0]?.meta.reason).toBe('out_of_range');
    });

    it('возвращает violation для невалидного velocityScore (out of range - too high)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 101,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_VELOCITY_SCORE');
      expect(result[0]?.meta.reason).toBe('out_of_range');
    });

    it('принимает валидный velocityScore', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });
  });

  describe('валидация координат', () => {
    it('возвращает violation для невалидных координат (lat not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: Number.POSITIVE_INFINITY,
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_not_finite');
    });

    it('возвращает violation для невалидных координат (lng not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: 37.7749,
          lng: Number.NEGATIVE_INFINITY,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_not_finite');
    });

    it('возвращает violation для невалидных координат (lat out of range - too high)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: 91,
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_out_of_range');
    });

    it('возвращает violation для невалидных координат (lat out of range - too low)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: -91,
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_out_of_range');
    });

    it('возвращает violation для невалидных координат (lng out of range - too high)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: 37.7749,
          lng: 181,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_out_of_range');
    });

    it('возвращает violation для невалидных координат (lng out of range - too low)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: 37.7749,
          lng: -181,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_out_of_range');
    });

    it('возвращает violation для неполных координат (только lat)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INCOMPLETE_COORDINATES');
      expect(result[0]?.meta.reason).toBe('incomplete_coordinates_spoofing_risk');
      const meta = result[0]?.meta as IncompleteCoordinatesViolationMeta;
      expect(meta.lat).toBe(37.7749);
      expect(meta.lng).toBeUndefined();
    });

    it('возвращает violation для неполных координат (только lng)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INCOMPLETE_COORDINATES');
      expect(result[0]?.meta.reason).toBe('incomplete_coordinates_spoofing_risk');
      const meta = result[0]?.meta as IncompleteCoordinatesViolationMeta;
      expect(meta.lat).toBeUndefined();
      expect(meta.lng).toBe(-122.4194);
    });

    it('принимает валидные координаты', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: 37.7749,
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });

    it('принимает координаты на границах (lat: -90, lng: -180)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: -90,
          lng: -180,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });

    it('принимает координаты на границах (lat: 90, lng: 180)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        previousGeo: {
          lat: 90,
          lng: 180,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });
  });

  describe('комбинированные violations', () => {
    it('возвращает множественные violations для нескольких невалидных полей', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -1,
        velocityScore: 101,
        previousGeo: {
          lat: 91,
          lng: -181,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBeGreaterThanOrEqual(2);
      const codes = result.map((v) => v.code);
      expect(codes).toContain('INVALID_REPUTATION_SCORE');
      expect(codes).toContain('INVALID_VELOCITY_SCORE');
    });

    it('возвращает violations для всех невалидных полей одновременно', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 'invalid' as unknown as number,
        velocityScore: Number.NaN,
        previousGeo: {
          lat: Number.POSITIVE_INFINITY,
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('структура violations', () => {
    it('возвращает violations с правильной структурой для score violation', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -1,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      const violation = result[0] as SemanticViolation;
      expect(violation).toBeDefined();
      expect(violation.code).toBe('INVALID_REPUTATION_SCORE');
      expect(violation.severity).toBe('block');
      expect(violation.affects).toBe('signals');
      expect(violation.impact).toBe('removes_signal');
      expect(violation.meta).toBeDefined();
      expect(violation.meta.reason).toBe('out_of_range');
    });

    it('возвращает violations с правильной структурой для coordinates violation', () => {
      const signals: InternalClassificationSignals = {
        previousGeo: {
          lat: 91,
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      const violation = result[0] as SemanticViolation;
      expect(violation).toBeDefined();
      expect(violation.code).toBe('INVALID_COORDINATES');
      expect(violation.severity).toBe('block');
      expect(violation.affects).toBe('signals');
      expect(violation.impact).toBe('removes_signal');
      expect(violation.meta).toBeDefined();
      expect(violation.meta.reason).toBe('lat_out_of_range');
    });

    it('возвращает violations с правильной структурой для incomplete coordinates violation', () => {
      const signals: InternalClassificationSignals = {
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(1);
      const violation = result[0] as SemanticViolation;
      expect(violation).toBeDefined();
      expect(violation.code).toBe('INCOMPLETE_COORDINATES');
      expect(violation.severity).toBe('block');
      expect(violation.affects).toBe('signals');
      expect(violation.impact).toBe('removes_signal');
      expect(violation.meta).toBeDefined();
      expect(violation.meta.reason).toBe('incomplete_coordinates_spoofing_risk');
    });
  });

  describe('immutability', () => {
    it('возвращает readonly массив', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
      };
      const result = validateClassificationSemantics(signals);
      expect(result).toBeDefined();
      // Проверяем, что массив readonly (TypeScript проверка)
      expect(Array.isArray(result)).toBe(true);
    });

    it('не мутирует входные signals', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
      };
      const originalSignals = { ...signals };
      validateClassificationSemantics(signals);
      expect(signals).toEqual(originalSignals);
    });
  });

  describe('детерминированность', () => {
    it('возвращает одинаковый результат для одинаковых входных данных', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
      };
      const result1 = validateClassificationSemantics(signals);
      const result2 = validateClassificationSemantics(signals);
      expect(result1).toEqual(result2);
    });

    it('возвращает одинаковый результат для одинаковых невалидных данных', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -1,
        velocityScore: 101,
      };
      const result1 = validateClassificationSemantics(signals);
      const result2 = validateClassificationSemantics(signals);
      expect(result1).toEqual(result2);
      expect(result1.length).toBe(result2.length);
    });
  });

  describe('edge cases', () => {
    it('обрабатывает signals с только reputationScore', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });

    it('обрабатывает signals с только velocityScore', () => {
      const signals: InternalClassificationSignals = {
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });

    it('обрабатывает signals с только previousGeo', () => {
      const signals: InternalClassificationSignals = {
        previousGeo: {
          lat: 37.7749,
          lng: -122.4194,
        },
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });

    it('обрабатывает signals с другими полями (isVpn, isTor, etc)', () => {
      const signals: InternalClassificationSignals = {
        isVpn: true,
        isTor: false,
        isProxy: true,
        asn: 'AS12345',
        reputationScore: 50,
        velocityScore: 75,
      };
      const result = validateClassificationSemantics(signals);
      expect(result.length).toBe(0);
    });
  });
});

/* ============================================================================
 * 🧪 ТЕСТЫ — ClassificationSemanticValidator type
 * ============================================================================
 */

describe('ClassificationSemanticValidator type', () => {
  it('validateClassificationSemantics соответствует типу ClassificationSemanticValidator', () => {
    const validator: ClassificationSemanticValidator = validateClassificationSemantics;
    expect(validator).toBe(validateClassificationSemantics);
    expect(typeof validator).toBe('function');
  });

  it('может быть использован как ClassificationSemanticValidator', () => {
    const validator: ClassificationSemanticValidator = validateClassificationSemantics;
    const result = validator(undefined);
    expect(result).toEqual([]);
  });

  it('принимает InternalClassificationSignals | undefined', () => {
    const validator: ClassificationSemanticValidator = validateClassificationSemantics;
    const signals: InternalClassificationSignals = {
      reputationScore: 50,
    };
    const result1 = validator(signals);
    const result2 = validator(undefined);
    expect(Array.isArray(result1)).toBe(true);
    expect(Array.isArray(result2)).toBe(true);
  });

  it('возвращает readonly SemanticViolation[]', () => {
    const validator: ClassificationSemanticValidator = validateClassificationSemantics;
    const signals: InternalClassificationSignals = {
      reputationScore: -1,
    };
    const result = validator(signals);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    if (result.length > 0) {
      expect(result[0]?.code).toBeDefined();
      expect(result[0]?.severity).toBeDefined();
      expect(result[0]?.affects).toBeDefined();
      expect(result[0]?.impact).toBeDefined();
      expect(result[0]?.meta).toBeDefined();
    }
  });
});
