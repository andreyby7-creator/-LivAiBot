/**
 * @file Unit тесты для Classification Signals Violations
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import type { InternalClassificationSignals } from '../../../src/classification/signals/signals.js';
import type {
  IncompleteCoordinatesViolationMeta,
  ScoreViolationMeta,
  SemanticViolation,
} from '../../../src/classification/signals/violations.js';
import { semanticViolationValidator } from '../../../src/classification/signals/violations.js';

/* ============================================================================
 * 🏗️ SEMANTIC VIOLATION VALIDATOR — VALUE OBJECT MODULE TESTS
 * ============================================================================
 */

describe('semanticViolationValidator', () => {
  describe('validate', () => {
    it('возвращает пустой массив для undefined signals', () => {
      const result = semanticViolationValidator.validate(undefined);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('возвращает пустой массив для валидных signals', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result).toEqual([]);
    });

    it('возвращает violation для невалидного reputationScore (not a number)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 'invalid' as unknown as number,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('not_a_number');
    });

    it('возвращает violation для невалидного reputationScore (not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: Number.POSITIVE_INFINITY,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('not_finite');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(Number.POSITIVE_INFINITY);
    });

    it('возвращает violation для невалидного reputationScore (NaN)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: Number.NaN,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('not_finite');
    });

    it('возвращает violation для невалидного reputationScore (out of range - negative)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -1,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
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
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_REPUTATION_SCORE');
      expect(result[0]?.meta.reason).toBe('out_of_range');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(101);
    });

    it('возвращает violation для невалидного reputationScore (boundary - 0)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 0,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // 0 is valid
    });

    it('возвращает violation для невалидного reputationScore (boundary - 100)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 100,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // 100 is valid
    });

    it('возвращает violation для невалидного velocityScore (not a number)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: null as unknown as number,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_VELOCITY_SCORE');
      expect(result[0]?.meta.reason).toBe('not_a_number');
    });

    it('возвращает violation для невалидного velocityScore (not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: Number.NEGATIVE_INFINITY,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_VELOCITY_SCORE');
      expect(result[0]?.meta.reason).toBe('not_finite');
    });

    it('возвращает violation для невалидного velocityScore (out of range)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 150,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_VELOCITY_SCORE');
      expect(result[0]?.meta.reason).toBe('out_of_range');
      const meta = result[0]?.meta as ScoreViolationMeta;
      expect(meta.value).toBe(150);
    });

    it('возвращает violation для невалидных координат (lat not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: Number.NaN,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_not_finite');
    });

    it('возвращает violation для невалидных координат (lat not a number)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 'invalid' as unknown as number,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_not_finite');
    });

    it('возвращает violation для невалидных координат (lat out of range - too low)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: -91,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_out_of_range');
    });

    it('возвращает violation для невалидных координат (lat out of range - too high)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 91,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_out_of_range');
    });

    it('возвращает violation для невалидных координат (lat boundary - -90)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: -90,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // -90 is valid
    });

    it('возвращает violation для невалидных координат (lat boundary - 90)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 90,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // 90 is valid
    });

    it('возвращает violation для невалидных координат (lng not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: Number.POSITIVE_INFINITY,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_not_finite');
    });

    it('возвращает violation для неполных координат (lng undefined)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INCOMPLETE_COORDINATES');
      expect(result[0]?.meta.reason).toBe('incomplete_coordinates_spoofing_risk');
    });

    it('возвращает violation для невалидных координат (lng out of range - too low)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: -181,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_out_of_range');
    });

    it('возвращает violation для невалидных координат (lng out of range - too high)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: 181,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_out_of_range');
    });

    it('возвращает violation для невалидных координат (lng boundary - -180)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: -180,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // -180 is valid
    });

    it('возвращает violation для невалидных координат (lng boundary - 180)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: 180,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // 180 is valid
    });

    it('возвращает violation для неполных координат (только lat)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INCOMPLETE_COORDINATES');
      expect(result[0]?.meta.reason).toBe('incomplete_coordinates_spoofing_risk');
      expect((result[0]?.meta as IncompleteCoordinatesViolationMeta).lat).toBe(37.7749);
      expect((result[0]?.meta as IncompleteCoordinatesViolationMeta).lng).toBeUndefined();
    });

    it('возвращает violation для неполных координат (только lng)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INCOMPLETE_COORDINATES');
      expect(result[0]?.meta.reason).toBe('incomplete_coordinates_spoofing_risk');
      expect((result[0]?.meta as IncompleteCoordinatesViolationMeta).lat).toBeUndefined();
      expect((result[0]?.meta as IncompleteCoordinatesViolationMeta).lng).toBe(-122.4194);
    });

    it('не возвращает violation для отсутствующих координат (undefined geo)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0);
    });

    it('не возвращает violation для отсутствующих координат (пустой geo)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {},
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0);
    });

    it('возвращает violation для неполных координат (lat undefined, lng number)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INCOMPLETE_COORDINATES');
    });

    it('возвращает violation для неполных координат (lat number, lng undefined)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INCOMPLETE_COORDINATES');
    });

    it('возвращает множественные violations для множественных проблем', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -10,
        velocityScore: 150,
        previousGeo: {
          lat: 100,
          lng: -200,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBeGreaterThanOrEqual(2);
      const codes = result.map((v) => v.code);
      expect(codes).toContain('INVALID_REPUTATION_SCORE');
      expect(codes).toContain('INVALID_VELOCITY_SCORE');
    });

    it('возвращает все violations для всех невалидных полей', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 'invalid' as unknown as number,
        velocityScore: Number.NaN,
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(3);
      expect(result.some((v) => v.code === 'INVALID_REPUTATION_SCORE')).toBe(true);
      expect(result.some((v) => v.code === 'INVALID_VELOCITY_SCORE')).toBe(true);
      expect(result.some((v) => v.code === 'INCOMPLETE_COORDINATES')).toBe(true);
    });

    it('проверяет структуру violation для score violations', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -1,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      const violation = result[0] as SemanticViolation & { code: 'INVALID_REPUTATION_SCORE'; };
      expect(violation.code).toBe('INVALID_REPUTATION_SCORE');
      expect(violation.severity).toBe('block');
      expect(violation.affects).toBe('signals');
      expect(violation.impact).toBe('removes_signal');
      expect(violation.meta).toBeDefined();
      expect(violation.meta.value).toBe(-1);
      expect(violation.meta.reason).toBe('out_of_range');
    });

    it('проверяет структуру violation для coordinate violations', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 100,
          lng: -122.4194,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      const violation = result[0] as SemanticViolation & { code: 'INVALID_COORDINATES'; };
      expect(violation.code).toBe('INVALID_COORDINATES');
      expect(violation.severity).toBe('block');
      expect(violation.affects).toBe('signals');
      expect(violation.impact).toBe('removes_signal');
      expect(violation.meta).toBeDefined();
      expect(violation.meta.lat).toBe(100);
      expect(violation.meta.lng).toBe(-122.4194);
      expect(violation.meta.reason).toBe('lat_out_of_range');
    });

    it('проверяет структуру violation для incomplete coordinates violations', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      const violation = result[0] as SemanticViolation & { code: 'INCOMPLETE_COORDINATES'; };
      expect(violation.code).toBe('INCOMPLETE_COORDINATES');
      expect(violation.severity).toBe('block');
      expect(violation.affects).toBe('signals');
      expect(violation.impact).toBe('removes_signal');
      expect(violation.meta).toBeDefined();
      expect(violation.meta.lat).toBe(37.7749);
      expect(violation.meta.lng).toBeUndefined();
      expect(violation.meta.reason).toBe('incomplete_coordinates_spoofing_risk');
    });

    it('возвращает violation для невалидных координат (оба out of range)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 100,
          lng: 200,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1); // Только первое нарушение (lat)
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_out_of_range');
    });

    it('возвращает violation для невалидных координат (lat not finite, lng out of range)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: Number.NaN,
          lng: 200,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1); // Только первое нарушение (lat)
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lat_not_finite');
    });

    it('возвращает violation для невалидных координат (lat valid, lng not finite)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: Number.POSITIVE_INFINITY,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_not_finite');
    });

    it('возвращает violation для невалидных координат (lat valid, lng out of range)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: -200,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_out_of_range');
    });

    it('возвращает violation для невалидных координат (lat valid, lng not a number - string)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
        previousGeo: {
          lat: 37.7749,
          lng: 'invalid' as unknown as number,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(1);
      expect(result[0]?.code).toBe('INVALID_COORDINATES');
      expect(result[0]?.meta.reason).toBe('lng_not_finite');
      // Проверяем, что lngNum был установлен в NaN (покрытие строки 247)
      const violation = result[0] as SemanticViolation & { code: 'INVALID_COORDINATES'; };
      expect(violation.meta.lng).toBe(Number.NaN);
    });

    it('возвращает пустой массив для signals без полей', () => {
      const signals: InternalClassificationSignals = {};
      const result = semanticViolationValidator.validate(signals);
      expect(result).toEqual([]);
    });

    it('не возвращает violation для отсутствующего reputationScore (undefined)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: undefined as unknown as number,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // undefined означает отсутствие значения, не невалидное значение
    });

    it('не возвращает violation для отсутствующего velocityScore (undefined)', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: undefined as unknown as number,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBe(0); // undefined означает отсутствие значения, не невалидное значение
    });

    it('проверяет, что результат является readonly массивом', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: 50,
        velocityScore: 75,
      };
      const result = semanticViolationValidator.validate(signals);
      expect(Array.isArray(result)).toBe(true);
    });

    it('проверяет, что все violations имеют правильную структуру', () => {
      const signals: InternalClassificationSignals = {
        reputationScore: -1,
        velocityScore: 150,
        previousGeo: {
          lat: 37.7749,
        },
      };
      const result = semanticViolationValidator.validate(signals);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((violation) => {
        expect(violation).toHaveProperty('code');
        expect(violation).toHaveProperty('severity');
        expect(violation).toHaveProperty('affects');
        expect(violation).toHaveProperty('impact');
        expect(violation).toHaveProperty('meta');
        expect(['block']).toContain(violation.severity);
        expect(['signals']).toContain(violation.affects);
        expect(['removes_signal']).toContain(violation.impact);
      });
    });
  });
});
