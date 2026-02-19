/**
 * @file Unit тесты для domain/RiskValidation.ts
 * Полное покрытие валидации risk semantics с 100% покрытием
 */

import { describe, expect, it } from 'vitest';
import type { RiskSignals } from '../../../src/types/risk.js';
import { validateRiskSemantics } from '../../../src/domain/RiskValidation.js';
import type {
  ViolationAffects,
  ViolationCode,
  ViolationImpact,
  ViolationSeverity,
} from '../../../src/domain/RiskValidation.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createRiskSignals(overrides: Partial<RiskSignals> = {}): RiskSignals {
  return {
    ...overrides,
  };
}

// ============================================================================
// 🎯 TESTS - validateRiskSemantics (Main API)
// ============================================================================

describe('validateRiskSemantics', () => {
  it('возвращает пустой массив для undefined signals', () => {
    const violations = validateRiskSemantics(undefined);

    expect(violations).toEqual([]);
    expect(violations.length).toBe(0);
  });

  it('возвращает пустой массив для валидных signals', () => {
    const signals = createRiskSignals({
      reputationScore: 50,
      velocityScore: 30,
      previousGeo: {
        lat: 37.7749,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations).toEqual([]);
    expect(violations.length).toBe(0);
  });

  it('возвращает пустой массив для signals без полей', () => {
    const signals = createRiskSignals({});

    const violations = validateRiskSemantics(signals);

    expect(violations).toEqual([]);
    expect(violations.length).toBe(0);
  });

  it('возвращает violation для невалидного reputationScore (не число)', () => {
    const signals = createRiskSignals({
      reputationScore: 'not-a-number' as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
    expect(violations[0]?.severity).toBe('block');
    expect(violations[0]?.affects).toBe('signals');
    expect(violations[0]?.impact).toBe('removes_signal');
    void (violations[0]?.code === 'INVALID_REPUTATION_SCORE'
      ? (expect(violations[0].meta.reason).toBe('not_a_number'),
        expect(Number.isNaN(violations[0].meta.value)).toBe(true))
      : expect.fail('Expected INVALID_REPUTATION_SCORE'));
  });

  it('возвращает violation для невалидного reputationScore (Infinity)', () => {
    const signals = createRiskSignals({
      reputationScore: Number.POSITIVE_INFINITY,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
    void (violations[0]?.code === 'INVALID_REPUTATION_SCORE'
      ? (expect(violations[0].meta.reason).toBe('not_finite'),
        expect(violations[0].meta.value).toBe(Number.POSITIVE_INFINITY))
      : expect.fail('Expected INVALID_REPUTATION_SCORE'));
  });

  it('возвращает violation для невалидного reputationScore (NaN)', () => {
    const signals = createRiskSignals({
      reputationScore: Number.NaN,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
    void (violations[0]?.code === 'INVALID_REPUTATION_SCORE'
      ? (expect(violations[0].meta.reason).toBe('not_finite'),
        expect(Number.isNaN(violations[0].meta.value)).toBe(true))
      : expect.fail('Expected INVALID_REPUTATION_SCORE'));
  });

  it('возвращает violation для невалидного reputationScore (ниже 0)', () => {
    const signals = createRiskSignals({
      reputationScore: -10,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
    void (violations[0]?.code === 'INVALID_REPUTATION_SCORE'
      ? (expect(violations[0].meta.reason).toBe('out_of_range'),
        expect(violations[0].meta.value).toBe(-10))
      : expect.fail('Expected INVALID_REPUTATION_SCORE'));
  });

  it('возвращает violation для невалидного reputationScore (выше 100)', () => {
    const signals = createRiskSignals({
      reputationScore: 150,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
    void (violations[0]?.code === 'INVALID_REPUTATION_SCORE'
      ? (expect(violations[0].meta.reason).toBe('out_of_range'),
        expect(violations[0].meta.value).toBe(150))
      : expect.fail('Expected INVALID_REPUTATION_SCORE'));
  });

  it('принимает валидный reputationScore (0)', () => {
    const signals = createRiskSignals({
      reputationScore: 0,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('принимает валидный reputationScore (100)', () => {
    const signals = createRiskSignals({
      reputationScore: 100,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('принимает валидный reputationScore (в диапазоне)', () => {
    const signals = createRiskSignals({
      reputationScore: 50,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('возвращает violation для невалидного velocityScore (не число)', () => {
    const signals = createRiskSignals({
      velocityScore: 'not-a-number' as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
    expect(violations[0]?.severity).toBe('block');
    expect(violations[0]?.affects).toBe('signals');
    expect(violations[0]?.impact).toBe('removes_signal');
    void (violations[0]?.code === 'INVALID_VELOCITY_SCORE'
      ? (expect(violations[0].meta.reason).toBe('not_a_number'),
        expect(Number.isNaN(violations[0].meta.value)).toBe(true))
      : expect.fail('Expected INVALID_VELOCITY_SCORE'));
  });

  it('возвращает violation для невалидного velocityScore (Infinity)', () => {
    const signals = createRiskSignals({
      velocityScore: Number.NEGATIVE_INFINITY,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
    void (violations[0]?.code === 'INVALID_VELOCITY_SCORE'
      ? (expect(violations[0].meta.reason).toBe('not_finite'),
        expect(violations[0].meta.value).toBe(Number.NEGATIVE_INFINITY))
      : expect.fail('Expected INVALID_VELOCITY_SCORE'));
  });

  it('возвращает violation для невалидного velocityScore (NaN)', () => {
    const signals = createRiskSignals({
      velocityScore: Number.NaN,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
    void (violations[0]?.code === 'INVALID_VELOCITY_SCORE'
      ? (expect(violations[0].meta.reason).toBe('not_finite'),
        expect(Number.isNaN(violations[0].meta.value)).toBe(true))
      : expect.fail('Expected INVALID_VELOCITY_SCORE'));
  });

  it('возвращает violation для невалидного velocityScore (ниже 0)', () => {
    const signals = createRiskSignals({
      velocityScore: -5,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
    void (violations[0]?.code === 'INVALID_VELOCITY_SCORE'
      ? (expect(violations[0].meta.reason).toBe('out_of_range'),
        expect(violations[0].meta.value).toBe(-5))
      : expect.fail('Expected INVALID_VELOCITY_SCORE'));
  });

  it('возвращает violation для невалидного velocityScore (выше 100)', () => {
    const signals = createRiskSignals({
      velocityScore: 200,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
    void (violations[0]?.code === 'INVALID_VELOCITY_SCORE'
      ? (expect(violations[0].meta.reason).toBe('out_of_range'),
        expect(violations[0].meta.value).toBe(200))
      : expect.fail('Expected INVALID_VELOCITY_SCORE'));
  });

  it('принимает валидный velocityScore (0)', () => {
    const signals = createRiskSignals({
      velocityScore: 0,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('принимает валидный velocityScore (100)', () => {
    const signals = createRiskSignals({
      velocityScore: 100,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('принимает валидный velocityScore (в диапазоне)', () => {
    const signals = createRiskSignals({
      velocityScore: 75,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('возвращает пустой массив для undefined previousGeo', () => {
    const signals = createRiskSignals({});

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('возвращает violation для неполных координат (только lat)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        // lng отсутствует
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INCOMPLETE_COORDINATES');
    expect(violations[0]?.severity).toBe('block');
    expect(violations[0]?.affects).toBe('signals');
    expect(violations[0]?.impact).toBe('removes_signal');
    void (violations[0]?.code === 'INCOMPLETE_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('incomplete_coordinates_spoofing_risk'),
        expect(violations[0].meta.lat).toBe(37.7749),
        expect(violations[0].meta.lng).toBeUndefined())
      : expect.fail('Expected INCOMPLETE_COORDINATES'));
  });

  it('возвращает violation для неполных координат (только lng)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        // lat отсутствует
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INCOMPLETE_COORDINATES');
    void (violations[0]?.code === 'INCOMPLETE_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('incomplete_coordinates_spoofing_risk'),
        expect(violations[0].meta.lat).toBeUndefined(),
        expect(violations[0].meta.lng).toBe(-122.4194))
      : expect.fail('Expected INCOMPLETE_COORDINATES'));
  });

  it('принимает валидные полные координаты', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('возвращает violation для невалидного lat (не число)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 'not-a-number' as unknown as number,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lat_not_finite'),
        expect(Number.isNaN(violations[0].meta.lat)).toBe(true),
        expect(violations[0].meta.lng).toBe(-122.4194))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lat (Infinity)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: Number.POSITIVE_INFINITY,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lat_not_finite'),
        expect(violations[0].meta.lat).toBe(Number.POSITIVE_INFINITY))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lat (NaN)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: Number.NaN,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lat_not_finite'),
        expect(Number.isNaN(violations[0].meta.lat)).toBe(true))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lat (ниже -90)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: -100,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lat_out_of_range'),
        expect(violations[0].meta.lat).toBe(-100),
        expect(violations[0].meta.lng).toBe(-122.4194))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lat (выше 90)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 100,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lat_out_of_range'),
        expect(violations[0].meta.lat).toBe(100))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('принимает валидный lat (-90)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: -90,
        lng: 0,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('принимает валидный lat (90)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 90,
        lng: 0,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('возвращает violation для невалидного lng (не число)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: 'not-a-number' as unknown as number,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lng_not_finite'),
        expect(violations[0].meta.lat).toBe(37.7749),
        expect(Number.isNaN(violations[0].meta.lng)).toBe(true))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lng (Infinity)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: Number.NEGATIVE_INFINITY,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lng_not_finite'),
        expect(violations[0].meta.lng).toBe(Number.NEGATIVE_INFINITY))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lng (NaN)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: Number.NaN,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lng_not_finite'),
        expect(Number.isNaN(violations[0].meta.lng)).toBe(true))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lng (ниже -180)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: -200,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lng_out_of_range'),
        expect(violations[0].meta.lat).toBe(37.7749),
        expect(violations[0].meta.lng).toBe(-200))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для невалидного lng (выше 180)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: 200,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? (expect(violations[0].meta.reason).toBe('lng_out_of_range'),
        expect(violations[0].meta.lng).toBe(200))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('принимает валидный lng (-180)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 0,
        lng: -180,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('принимает валидный lng (180)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 0,
        lng: 180,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('возвращает несколько violations одновременно', () => {
    const signals = createRiskSignals({
      reputationScore: 150, // Вне диапазона
      velocityScore: -10, // Вне диапазона
      previousGeo: {
        lat: 100, // Вне диапазона
        lng: 200, // Вне диапазона
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBeGreaterThan(1);
    const codes = violations.map((v) => v.code);
    expect(codes).toContain('INVALID_REPUTATION_SCORE');
    expect(codes).toContain('INVALID_VELOCITY_SCORE');
    expect(codes).toContain('INVALID_COORDINATES');
  });

  it('возвращает violation для lat когда lat валиден но lng невалиден', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749, // Валидный
        lng: 200, // Невалидный
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? expect(violations[0].meta.reason).toBe('lng_out_of_range')
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('возвращает violation для lng когда lng валиден но lat невалиден', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 100, // Невалидный
        lng: -122.4194, // Валидный
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? expect(violations[0].meta.reason).toBe('lat_out_of_range')
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('принимает координаты на границах диапазонов', () => {
    const testCases = [
      { lat: -90, lng: -180 }, // Минимальные значения
      { lat: 90, lng: 180 }, // Максимальные значения
      { lat: 0, lng: 0 }, // Нулевые значения
      { lat: 37.7749, lng: -122.4194 }, // San Francisco
      { lat: 52.5200, lng: 13.4050 }, // Berlin
      { lat: -33.8688, lng: 151.2093 }, // Sydney
    ];

    testCases.forEach(({ lat, lng }) => {
      const signals = createRiskSignals({
        previousGeo: {
          lat,
          lng,
        },
      });

      const violations = validateRiskSemantics(signals);

      expect(violations.length).toBe(0);
    });
  });

  it('принимает пустой объект previousGeo (все поля undefined)', () => {
    const signals = createRiskSignals({
      previousGeo: {},
    });

    const violations = validateRiskSemantics(signals);

    // Пустой объект должен вызвать INCOMPLETE_COORDINATES, но только если есть lat или lng
    // Если оба undefined, то это не violation (missing coordinates)
    expect(violations.length).toBe(0);
  });

  it('возвращает violation для неполных координат когда lat = 0', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 0,
        // lng отсутствует
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INCOMPLETE_COORDINATES');
    void (violations[0]?.code === 'INCOMPLETE_COORDINATES'
      ? (expect(violations[0].meta.lat).toBe(0), expect(violations[0].meta.lng).toBeUndefined())
      : expect.fail('Expected INCOMPLETE_COORDINATES'));
  });

  it('возвращает violation для неполных координат когда lng = 0', () => {
    const signals = createRiskSignals({
      previousGeo: {
        // lat отсутствует
        lng: 0,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INCOMPLETE_COORDINATES');
    void (violations[0]?.code === 'INCOMPLETE_COORDINATES'
      ? (expect(violations[0].meta.lat).toBeUndefined(), expect(violations[0].meta.lng).toBe(0))
      : expect.fail('Expected INCOMPLETE_COORDINATES'));
  });
});

// ============================================================================
// 🧭 TYPE TESTS - Проверка типов
// ============================================================================

describe('Validation types', () => {
  it('ViolationSeverity поддерживает все значения', () => {
    const severities: ViolationSeverity[] = ['ignore', 'degrade', 'block'];

    severities.forEach((severity) => {
      expect(typeof severity).toBe('string');
      expect(['ignore', 'degrade', 'block']).toContain(severity);
    });
  });

  it('ViolationAffects поддерживает все значения', () => {
    const affects: ViolationAffects[] = ['confidence', 'signals', 'decision'];

    affects.forEach((affect) => {
      expect(typeof affect).toBe('string');
      expect(['confidence', 'signals', 'decision']).toContain(affect);
    });
  });

  it('ViolationImpact поддерживает все значения', () => {
    const impacts: ViolationImpact[] = [
      'increases_risk',
      'removes_signal',
      'blocks_evaluation',
    ];

    impacts.forEach((impact) => {
      expect(typeof impact).toBe('string');
      expect(['increases_risk', 'removes_signal', 'blocks_evaluation']).toContain(impact);
    });
  });

  it('ViolationCode поддерживает все значения', () => {
    const codes: ViolationCode[] = [
      'INVALID_REPUTATION_SCORE',
      'INVALID_VELOCITY_SCORE',
      'INVALID_COORDINATES',
      'INCOMPLETE_COORDINATES',
    ];

    codes.forEach((code) => {
      expect(typeof code).toBe('string');
      expect([
        'INVALID_REPUTATION_SCORE',
        'INVALID_VELOCITY_SCORE',
        'INVALID_COORDINATES',
        'INCOMPLETE_COORDINATES',
      ]).toContain(code);
    });
  });

  it('RiskSemanticViolation имеет правильную структуру для INVALID_REPUTATION_SCORE', () => {
    const signals = createRiskSignals({
      reputationScore: 150,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    const violation = violations[0];
    expect(violation).toBeDefined();

    void (violation?.code === 'INVALID_REPUTATION_SCORE'
      ? (expect(violation.severity).toBe('block'),
        expect(violation.affects).toBe('signals'),
        expect(violation.impact).toBe('removes_signal'),
        expect(violation.meta).toBeDefined(),
        expect(violation.meta.value).toBe(150),
        expect(violation.meta.reason).toBe('out_of_range'))
      : expect.fail('Expected INVALID_REPUTATION_SCORE'));
  });

  it('RiskSemanticViolation имеет правильную структуру для INVALID_COORDINATES', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 100,
        lng: 0,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    const violation = violations[0];
    expect(violation).toBeDefined();

    void (violation?.code === 'INVALID_COORDINATES'
      ? (expect(violation.severity).toBe('block'),
        expect(violation.affects).toBe('signals'),
        expect(violation.impact).toBe('removes_signal'),
        expect(violation.meta).toBeDefined(),
        expect(violation.meta.lat).toBe(100),
        expect(violation.meta.lng).toBe(0),
        expect(violation.meta.reason).toBe('lat_out_of_range'))
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('RiskSemanticViolation имеет правильную структуру для INCOMPLETE_COORDINATES', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        // lng отсутствует
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    const violation = violations[0];
    expect(violation).toBeDefined();

    void (violation?.code === 'INCOMPLETE_COORDINATES'
      ? (expect(violation.severity).toBe('block'),
        expect(violation.affects).toBe('signals'),
        expect(violation.impact).toBe('removes_signal'),
        expect(violation.meta).toBeDefined(),
        expect(violation.meta.lat).toBe(37.7749),
        expect(violation.meta.lng).toBeUndefined(),
        expect(violation.meta.reason).toBe('incomplete_coordinates_spoofing_risk'))
      : expect.fail('Expected INCOMPLETE_COORDINATES'));
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('Validation edge cases', () => {
  it('обрабатывает reputationScore = undefined (не violation)', () => {
    const signals = createRiskSignals({});

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('обрабатывает velocityScore = undefined (не violation)', () => {
    const signals = createRiskSignals({});

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(0);
  });

  it('обрабатывает reputationScore = null (violation)', () => {
    const signals = createRiskSignals({
      reputationScore: null as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
    void (violations[0]?.code === 'INVALID_REPUTATION_SCORE'
      ? expect(violations[0].meta.reason).toBe('not_a_number')
      : expect.fail('Expected INVALID_REPUTATION_SCORE'));
  });

  it('обрабатывает velocityScore = null (violation)', () => {
    const signals = createRiskSignals({
      velocityScore: null as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
    void (violations[0]?.code === 'INVALID_VELOCITY_SCORE'
      ? expect(violations[0].meta.reason).toBe('not_a_number')
      : expect.fail('Expected INVALID_VELOCITY_SCORE'));
  });

  it('обрабатывает reputationScore как boolean (violation)', () => {
    const signals = createRiskSignals({
      reputationScore: true as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
  });

  it('обрабатывает velocityScore как boolean (violation)', () => {
    const signals = createRiskSignals({
      velocityScore: false as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
  });

  it('обрабатывает reputationScore как объект (violation)', () => {
    const signals = createRiskSignals({
      reputationScore: { value: 50 } as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_REPUTATION_SCORE');
  });

  it('обрабатывает velocityScore как массив (violation)', () => {
    const signals = createRiskSignals({
      velocityScore: [50] as unknown as number,
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_VELOCITY_SCORE');
  });

  it('обрабатывает lat как строку (violation)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: '37.7749' as unknown as number,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? expect(violations[0].meta.reason).toBe('lat_not_finite')
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('обрабатывает lng как строку (violation)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: '-122.4194' as unknown as number,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? expect(violations[0].meta.reason).toBe('lng_not_finite')
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('обрабатывает lat как null (violation)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: null as unknown as number,
        lng: -122.4194,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? expect(violations[0].meta.reason).toBe('lat_not_finite')
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('обрабатывает lng как null (violation)', () => {
    const signals = createRiskSignals({
      previousGeo: {
        lat: 37.7749,
        lng: null as unknown as number,
      },
    });

    const violations = validateRiskSemantics(signals);

    expect(violations.length).toBe(1);
    expect(violations[0]?.code).toBe('INVALID_COORDINATES');
    void (violations[0]?.code === 'INVALID_COORDINATES'
      ? expect(violations[0].meta.reason).toBe('lng_not_finite')
      : expect.fail('Expected INVALID_COORDINATES'));
  });

  it('обрабатывает все возможные комбинации violations', () => {
    const signals = createRiskSignals({
      reputationScore: 150, // out_of_range
      velocityScore: -10, // out_of_range
      previousGeo: {
        lat: 100, // out_of_range
        lng: 200, // out_of_range
      },
    });

    const violations = validateRiskSemantics(signals);

    // Должно быть минимум 3 violations (reputation, velocity, coordinates)
    // coordinates может вернуть только одно violation (lat или lng)
    expect(violations.length).toBeGreaterThanOrEqual(3);
    const codes = violations.map((v) => v.code);
    expect(codes).toContain('INVALID_REPUTATION_SCORE');
    expect(codes).toContain('INVALID_VELOCITY_SCORE');
    expect(codes).toContain('INVALID_COORDINATES');
  });
});
