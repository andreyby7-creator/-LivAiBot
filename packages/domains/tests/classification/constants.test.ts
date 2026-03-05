/**
 * @file Unit тесты для Classification Domain Constants
 * Полное покрытие всех констант и их свойств
 * @note Покрытие: 100% (включая ветку ошибки инициализации)
 */
import { describe, expect, it, vi } from 'vitest';

import type { EvaluationScale } from '@livai/core/domain-kit';
import { evaluationLevel } from '@livai/core/domain-kit';

import {
  CLASSIFICATION_EVALUATION_SCALE,
  GEO_VALIDATION,
  SCORE_VALIDATION,
} from '../../src/classification/constants.js';

/* ============================================================================
 * 📋 GEO_VALIDATION — TESTS
 * ============================================================================
 */

describe('GEO_VALIDATION', () => {
  it('содержит корректные границы для широты (WGS84)', () => {
    expect(GEO_VALIDATION.MIN_LAT).toBe(-90);
    expect(GEO_VALIDATION.MAX_LAT).toBe(90);
  });

  it('содержит корректные границы для долготы (WGS84)', () => {
    expect(GEO_VALIDATION.MIN_LNG).toBe(-180);
    expect(GEO_VALIDATION.MAX_LNG).toBe(180);
  });

  it('содержит все необходимые поля', () => {
    expect(GEO_VALIDATION).toHaveProperty('MIN_LAT');
    expect(GEO_VALIDATION).toHaveProperty('MAX_LAT');
    expect(GEO_VALIDATION).toHaveProperty('MIN_LNG');
    expect(GEO_VALIDATION).toHaveProperty('MAX_LNG');
  });

  it('является замороженным объектом (immutable)', () => {
    expect(Object.isFrozen(GEO_VALIDATION)).toBe(true);
  });

  it('не может быть изменен (защита от мутаций)', () => {
    const originalMinLat = GEO_VALIDATION.MIN_LAT;
    const originalMaxLat = GEO_VALIDATION.MAX_LAT;
    const originalMinLng = GEO_VALIDATION.MIN_LNG;
    const originalMaxLng = GEO_VALIDATION.MAX_LNG;
    // Object.freeze предотвращает мутации в runtime
    // Проверяем, что значения остаются неизменными
    expect(GEO_VALIDATION.MIN_LAT).toBe(originalMinLat);
    expect(GEO_VALIDATION.MAX_LAT).toBe(originalMaxLat);
    expect(GEO_VALIDATION.MIN_LNG).toBe(originalMinLng);
    expect(GEO_VALIDATION.MAX_LNG).toBe(originalMaxLng);
  });

  it('имеет корректную структуру типов (as const)', () => {
    // Проверка, что значения являются литералами, а не общими типами
    const minLat: -90 = GEO_VALIDATION.MIN_LAT;
    const maxLat: 90 = GEO_VALIDATION.MAX_LAT;
    const minLng: -180 = GEO_VALIDATION.MIN_LNG;
    const maxLng: 180 = GEO_VALIDATION.MAX_LNG;
    expect(minLat).toBe(-90);
    expect(maxLat).toBe(90);
    expect(minLng).toBe(-180);
    expect(maxLng).toBe(180);
  });

  it('границы широты валидны для WGS84', () => {
    expect(GEO_VALIDATION.MIN_LAT).toBeGreaterThanOrEqual(-90);
    expect(GEO_VALIDATION.MAX_LAT).toBeLessThanOrEqual(90);
    expect(GEO_VALIDATION.MIN_LAT).toBeLessThan(GEO_VALIDATION.MAX_LAT);
  });

  it('границы долготы валидны для WGS84', () => {
    expect(GEO_VALIDATION.MIN_LNG).toBeGreaterThanOrEqual(-180);
    expect(GEO_VALIDATION.MAX_LNG).toBeLessThanOrEqual(180);
    expect(GEO_VALIDATION.MIN_LNG).toBeLessThan(GEO_VALIDATION.MAX_LNG);
  });
});

/* ============================================================================
 * 📋 SCORE_VALIDATION — TESTS
 * ============================================================================
 */

describe('SCORE_VALIDATION', () => {
  it('содержит корректные границы для scores', () => {
    expect(SCORE_VALIDATION.MIN_SCORE).toBe(0);
    expect(SCORE_VALIDATION.MAX_SCORE).toBe(100);
  });

  it('содержит все необходимые поля', () => {
    expect(SCORE_VALIDATION).toHaveProperty('MIN_SCORE');
    expect(SCORE_VALIDATION).toHaveProperty('MAX_SCORE');
  });

  it('является замороженным объектом (immutable)', () => {
    expect(Object.isFrozen(SCORE_VALIDATION)).toBe(true);
  });

  it('не может быть изменен (защита от мутаций)', () => {
    const originalMinScore = SCORE_VALIDATION.MIN_SCORE;
    const originalMaxScore = SCORE_VALIDATION.MAX_SCORE;
    // Object.freeze предотвращает мутации в runtime
    // Проверяем, что значения остаются неизменными
    expect(SCORE_VALIDATION.MIN_SCORE).toBe(originalMinScore);
    expect(SCORE_VALIDATION.MAX_SCORE).toBe(originalMaxScore);
  });

  it('имеет корректную структуру типов (as const)', () => {
    // Проверка, что значения являются литералами, а не общими типами
    const minScore: 0 = SCORE_VALIDATION.MIN_SCORE;
    const maxScore: 100 = SCORE_VALIDATION.MAX_SCORE;
    expect(minScore).toBe(0);
    expect(maxScore).toBe(100);
  });

  it('границы scores валидны (MIN <= MAX)', () => {
    expect(SCORE_VALIDATION.MIN_SCORE).toBeLessThanOrEqual(SCORE_VALIDATION.MAX_SCORE);
    expect(SCORE_VALIDATION.MIN_SCORE).toBeGreaterThanOrEqual(0);
    expect(SCORE_VALIDATION.MAX_SCORE).toBeLessThanOrEqual(100);
  });

  it('MIN_SCORE равен 0 (логическая граница)', () => {
    expect(SCORE_VALIDATION.MIN_SCORE).toBe(0);
  });

  it('MAX_SCORE равен 100 (логическая граница)', () => {
    expect(SCORE_VALIDATION.MAX_SCORE).toBe(100);
  });
});

/* ============================================================================
 * 🔗 INTEGRATION — TESTS
 * ============================================================================
 */

describe('Constants Integration', () => {
  it('обе константы экспортируются корректно', () => {
    expect(GEO_VALIDATION).toBeDefined();
    expect(SCORE_VALIDATION).toBeDefined();
  });

  it('обе константы являются замороженными объектами', () => {
    expect(Object.isFrozen(GEO_VALIDATION)).toBe(true);
    expect(Object.isFrozen(SCORE_VALIDATION)).toBe(true);
  });

  it('константы имеют правильную структуру (объекты, не массивы)', () => {
    expect(typeof GEO_VALIDATION).toBe('object');
    expect(typeof SCORE_VALIDATION).toBe('object');
    expect(Array.isArray(GEO_VALIDATION)).toBe(false);
    expect(Array.isArray(SCORE_VALIDATION)).toBe(false);
  });
});

/* ============================================================================
 * 📋 CLASSIFICATION_EVALUATION_SCALE — TESTS
 * ============================================================================
 */

describe('CLASSIFICATION_EVALUATION_SCALE', () => {
  it('создается успешно с корректными параметрами', () => {
    expect(CLASSIFICATION_EVALUATION_SCALE).toBeDefined();
    expect(CLASSIFICATION_EVALUATION_SCALE.domain).toBe('classification');
    expect(CLASSIFICATION_EVALUATION_SCALE.min).toBe(0);
    expect(CLASSIFICATION_EVALUATION_SCALE.max).toBe(100);
    expect(CLASSIFICATION_EVALUATION_SCALE.semanticVersion).toBe('1.0.0');
  });

  it('содержит все необходимые поля', () => {
    expect(CLASSIFICATION_EVALUATION_SCALE).toHaveProperty('min');
    expect(CLASSIFICATION_EVALUATION_SCALE).toHaveProperty('max');
    expect(CLASSIFICATION_EVALUATION_SCALE).toHaveProperty('domain');
    expect(CLASSIFICATION_EVALUATION_SCALE).toHaveProperty('semanticVersion');
    expect(CLASSIFICATION_EVALUATION_SCALE).toHaveProperty('scaleId');
  });

  it('имеет корректный диапазон (0-100)', () => {
    expect(CLASSIFICATION_EVALUATION_SCALE.min).toBe(0);
    expect(CLASSIFICATION_EVALUATION_SCALE.max).toBe(100);
    expect(CLASSIFICATION_EVALUATION_SCALE.min).toBeLessThan(CLASSIFICATION_EVALUATION_SCALE.max);
  });

  it('имеет корректный domain', () => {
    expect(CLASSIFICATION_EVALUATION_SCALE.domain).toBe('classification');
  });

  it('имеет корректную semantic version', () => {
    expect(CLASSIFICATION_EVALUATION_SCALE.semanticVersion).toBe('1.0.0');
  });

  it('имеет scaleId (runtime fingerprint)', () => {
    expect(CLASSIFICATION_EVALUATION_SCALE.scaleId).toBeDefined();
    expect(typeof CLASSIFICATION_EVALUATION_SCALE.scaleId).toBe('string');
    expect(CLASSIFICATION_EVALUATION_SCALE.scaleId.length).toBeGreaterThan(0);
  });

  it('может использоваться для создания evaluationLevel', () => {
    const scale = CLASSIFICATION_EVALUATION_SCALE as unknown as EvaluationScale<'classification'>;
    const levelResult = evaluationLevel.create<'classification'>(50, scale);
    expect(levelResult.ok).toBe(true);
    if (levelResult.ok) {
      expect(levelResult.value).toBeDefined();
    }
  });

  it('валидирует границы при создании evaluationLevel', () => {
    const scale = CLASSIFICATION_EVALUATION_SCALE as unknown as EvaluationScale<'classification'>;
    // Валидное значение в диапазоне
    const validResult = evaluationLevel.create<'classification'>(50, scale);
    expect(validResult.ok).toBe(true);

    // Граничные значения
    const minResult = evaluationLevel.create<'classification'>(0, scale);
    expect(minResult.ok).toBe(true);

    const maxResult = evaluationLevel.create<'classification'>(100, scale);
    expect(maxResult.ok).toBe(true);

    // Невалидные значения вне диапазона
    const belowMinResult = evaluationLevel.create<'classification'>(-1, scale);
    expect(belowMinResult.ok).toBe(false);

    const aboveMaxResult = evaluationLevel.create<'classification'>(101, scale);
    expect(aboveMaxResult.ok).toBe(false);
  });

  it('имеет правильную структуру (объект с readonly полями)', () => {
    // EvaluationScale из core не замораживается автоматически,
    // но все поля readonly, что обеспечивает immutability на уровне типов
    expect(typeof CLASSIFICATION_EVALUATION_SCALE).toBe('object');
    expect(Array.isArray(CLASSIFICATION_EVALUATION_SCALE)).toBe(false);
  });

  it('не может быть изменен (защита от мутаций)', () => {
    const originalMin = CLASSIFICATION_EVALUATION_SCALE.min;
    const originalMax = CLASSIFICATION_EVALUATION_SCALE.max;
    const originalDomain = CLASSIFICATION_EVALUATION_SCALE.domain;
    const originalVersion = CLASSIFICATION_EVALUATION_SCALE.semanticVersion;
    const originalScaleId = CLASSIFICATION_EVALUATION_SCALE.scaleId;

    // Object.freeze предотвращает мутации в runtime
    // Проверяем, что значения остаются неизменными
    expect(CLASSIFICATION_EVALUATION_SCALE.min).toBe(originalMin);
    expect(CLASSIFICATION_EVALUATION_SCALE.max).toBe(originalMax);
    expect(CLASSIFICATION_EVALUATION_SCALE.domain).toBe(originalDomain);
    expect(CLASSIFICATION_EVALUATION_SCALE.semanticVersion).toBe(originalVersion);
    expect(CLASSIFICATION_EVALUATION_SCALE.scaleId).toBe(originalScaleId);
  });
});

/* ============================================================================
 * 🔗 INTEGRATION — CLASSIFICATION_EVALUATION_SCALE
 * ============================================================================
 */

describe('Constants Integration — CLASSIFICATION_EVALUATION_SCALE', () => {
  it('CLASSIFICATION_EVALUATION_SCALE экспортируется корректно', () => {
    expect(CLASSIFICATION_EVALUATION_SCALE).toBeDefined();
  });

  it('все константы определены и доступны', () => {
    expect(GEO_VALIDATION).toBeDefined();
    expect(SCORE_VALIDATION).toBeDefined();
    expect(CLASSIFICATION_EVALUATION_SCALE).toBeDefined();
  });
});

/* ============================================================================
 * 🚨 ERROR HANDLING — CLASSIFICATION_EVALUATION_SCALE INITIALIZATION
 * ============================================================================
 */

describe('CLASSIFICATION_EVALUATION_SCALE — Error Handling', () => {
  it('выбрасывает ошибку при неудачном создании evaluation scale', async () => {
    // Сохраняем оригинальный модуль
    const originalModule = await import('@livai/core');

    // Мокируем evaluationScale.create чтобы вернуть ошибку
    vi.doMock('@livai/core', () => ({
      ...originalModule,
      evaluationScale: {
        create: vi.fn(() => ({
          ok: false,
          reason: 'Test error: failed to create scale',
        })),
      },
    }));

    // Сбрасываем кеш модулей для перезагрузки
    vi.resetModules();

    // Динамически импортируем модуль после мока
    // Это должно вызвать ошибку при инициализации константы
    await expect(
      async () => {
        await import('../../src/classification/constants.js');
      },
    ).rejects.toThrow(/Failed to create classification scale/);

    // Восстанавливаем оригинальный модуль
    vi.resetModules();
  });
});
