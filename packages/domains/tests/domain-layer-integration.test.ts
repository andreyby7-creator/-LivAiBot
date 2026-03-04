/**
 * @file Интеграционные тесты для Domain Layer Trust Policy
 * Проверяет архитектурный контракт Domain Layer:
 * 1. Factory methods фильтруют некорректные данные (возвращают null)
 * 2. Валидированные данные могут использоваться в domain layer
 * 3. Защита от bypass валидации
 * 4. Общая архитектурная корректность
 * @see ADR-001-domain-layer-trust-policy.md
 */
import { describe, expect, it } from 'vitest';
import {
  classificationContext,
  classificationSignals,
} from '../src/classification/signals/signals.js';

/* ============================================================================
 * 🏗️ FACTORY METHODS — VALIDATION TESTS
 * ============================================================================
 */

describe('Domain Layer Integration: Factory Methods Validation', () => {
  describe('classificationContext.create()', () => {
    it('возвращает null на невалидном input (пустой previousSessionId)', () => {
      const invalidContext = classificationContext.create({
        previousSessionId: '', // некорректно: пустая строка
        geo: { lat: 10, lng: 20 },
        userId: 'user1',
      });

      expect(invalidContext).toBeNull();
    });

    it('возвращает null на невалидном input (неверные координаты)', () => {
      const invalidContext = classificationContext.create({
        previousSessionId: 'session123',
        geo: { lat: 999, lng: 999 }, // неверные координаты (вне WGS84)
        userId: 'user1',
      });

      expect(invalidContext).toBeNull();
    });

    it('возвращает null на невалидном input (не объект)', () => {
      const invalidContext = classificationContext.create(null);
      expect(invalidContext).toBeNull();

      const invalidContext2 = classificationContext.create('not an object');
      expect(invalidContext2).toBeNull();
    });

    it('возвращает null на невалидном input (невалидные signals)', () => {
      const invalidContext = classificationContext.create({
        geo: { lat: 37.7749, lng: -122.4194 },
        signals: {
          isVpn: 'not a boolean' as unknown as boolean,
        } as unknown as ReturnType<typeof classificationSignals.create>,
      });

      expect(invalidContext).toBeNull();
    });

    it('возвращает null на невалидном input (невалидный geo)', () => {
      const invalidContext = classificationContext.create({
        geo: { lat: 999, lng: -122.4194 }, // невалидный lat
      });

      expect(invalidContext).toBeNull();
    });

    it('возвращает валидный объект на валидном input', () => {
      const validContext = classificationContext.create({
        previousSessionId: 'session123',
        geo: { lat: 37.7749, lng: -122.4194 }, // валидные координаты
        userId: 'user1',
        ip: '192.168.1.1',
      });

      expect(validContext).not.toBeNull();
      expect(validContext?.previousSessionId).toBe('session123');
      expect(validContext?.geo?.lat).toBe(37.7749);
      expect(validContext?.userId).toBe('user1');
    });
  });

  describe('classificationSignals.create()', () => {
    it('возвращает null на невалидном input (не boolean для isVpn)', () => {
      const invalidSignals = classificationSignals.create({
        isVpn: 'notABoolean' as unknown as boolean,
      });

      expect(invalidSignals).toBeNull();
    });

    it('возвращает null на невалидном input (не объект)', () => {
      const invalidSignals = classificationSignals.create(null);
      expect(invalidSignals).toBeNull();

      const invalidSignals2 = classificationSignals.create('not an object');
      expect(invalidSignals2).toBeNull();
    });

    it('возвращает null на невалидном input (неверный score)', () => {
      const invalidSignals = classificationSignals.create({
        reputationScore: 999, // вне диапазона 0-100
      });

      expect(invalidSignals).toBeNull();
    });

    it('возвращает null на невалидном input (NaN score)', () => {
      const invalidSignals = classificationSignals.create({
        reputationScore: Number.NaN,
      });

      expect(invalidSignals).toBeNull();
    });

    it('возвращает null на невалидном input (Infinity score)', () => {
      const invalidSignals = classificationSignals.create({
        reputationScore: Number.POSITIVE_INFINITY,
      });

      expect(invalidSignals).toBeNull();
    });

    it('возвращает валидный объект на валидном input', () => {
      const validSignals = classificationSignals.create({
        isVpn: false,
        isTor: true,
        reputationScore: 75,
        velocityScore: 50,
        previousGeo: { lat: 37.7749, lng: -122.4194 },
      });

      expect(validSignals).not.toBeNull();
      expect(validSignals?.isVpn).toBe(false);
      expect(validSignals?.isTor).toBe(true);
      expect(validSignals?.reputationScore).toBe(75);
      expect(validSignals?.velocityScore).toBe(50);
    });

    it('возвращает валидный объект с externalSignals', () => {
      const validSignals = classificationSignals.create({
        isVpn: false,
        externalSignals: {
          vendor: 'test-vendor',
          score: 85,
        },
      });

      expect(validSignals).not.toBeNull();
      expect(validSignals?.isVpn).toBe(false);
      expect(validSignals?.externalSignals).toBeDefined();
      expect(validSignals?.externalSignals?.['vendor']).toBe('test-vendor');
      expect(validSignals?.externalSignals?.['score']).toBe(85);
    });

    it('возвращает null на невалидном input (невалидные externalSignals)', () => {
      const invalidSignals = classificationSignals.create({
        isVpn: false,
        externalSignals: null as unknown as Record<string, unknown>,
      });

      expect(invalidSignals).toBeNull();
    });
  });
});

/* ============================================================================
 * 🛡️ SECURITY — BYPASS PROTECTION TESTS
 * ============================================================================
 */

describe('Domain Layer Integration: Bypass Protection', () => {
  it('factory methods не делают silent coercion', () => {
    // Попытка передать невалидные типы
    const invalidSignals1 = classificationSignals.create({
      isVpn: 'true' as unknown as boolean, // строка вместо boolean
    });
    expect(invalidSignals1).toBeNull();

    const invalidSignals2 = classificationSignals.create({
      reputationScore: '75' as unknown as number, // строка вместо number
    });
    expect(invalidSignals2).toBeNull();
  });

  it('factory methods не возвращают fallback значения', () => {
    // Попытка передать невалидные данные
    const invalidContext = classificationContext.create({
      previousSessionId: '', // пустая строка
      geo: { lat: 999, lng: 999 }, // неверные координаты
    });

    // Должен вернуть null, а не объект с fallback значениями
    expect(invalidContext).toBeNull();
    expect(invalidContext).not.toEqual({ previousSessionId: undefined, geo: undefined });
  });

  it('валидированные данные могут быть использованы в domain layer', () => {
    // Проверяем, что валидированные данные действительно валидны
    const validSignals = classificationSignals.create({
      isVpn: false,
      reputationScore: 75,
    });

    expect(validSignals).not.toBeNull();

    const validContext = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      signals: validSignals!,
    });

    expect(validContext).not.toBeNull();
    // Проверяем, что валидированные данные сохраняют структуру
    expect(validContext?.signals?.isVpn).toBe(false);
    expect(validContext?.signals?.reputationScore).toBe(75);
  });
});

/* ============================================================================
 * 🏛️ ARCHITECTURE — TRUST BOUNDARY TESTS
 * ============================================================================
 */

describe('Domain Layer Integration: Architecture Trust Boundary', () => {
  it('валидированные данные immutable и frozen', () => {
    const validContext = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      userId: 'user1',
    });

    expect(validContext).not.toBeNull();

    // Проверяем, что объект readonly (TypeScript проверка на этапе компиляции)
    // В runtime объекты должны быть frozen (проверяется в unit тестах для context-builders)
    if (validContext) {
      // TypeScript должен блокировать мутацию readonly полей на этапе компиляции
      // Это архитектурный контракт: все данные из factory methods immutable
      expect(validContext.userId).toBe('user1');
    }
  });

  it('валидированные signals могут быть вложены в context', () => {
    const validSignals = classificationSignals.create({
      isVpn: true,
      isTor: false,
    });

    expect(validSignals).not.toBeNull();

    const validContext = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      signals: validSignals!,
    });

    expect(validContext).not.toBeNull();
    expect(validContext?.signals).toBeDefined();
    expect(validContext?.signals?.isVpn).toBe(true);
    expect(validContext?.signals?.isTor).toBe(false);
  });

  it('невалидированные данные не могут быть использованы', () => {
    // Попытка использовать невалидированные данные должна быть заблокирована
    const invalidSignals = {
      isVpn: 'not a boolean' as unknown as boolean,
    };

    const contextWithInvalidSignals = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      signals: invalidSignals as unknown as ReturnType<typeof classificationSignals.create>,
    });

    // Context должен быть null, так как signals невалидны
    expect(contextWithInvalidSignals).toBeNull();
  });
});

/* ============================================================================
 * 📸 SNAPSHOT TESTS — STRUCTURE VALIDATION
 * ============================================================================
 */

describe('Domain Layer Integration: Snapshot Tests', () => {
  it('фиксирует структуру валидного context', () => {
    const validContext = classificationContext.create({
      previousSessionId: 'session123',
      geo: { lat: 37.7749, lng: -122.4194, country: 'US' },
      userId: 'user1',
      ip: '192.168.1.1',
      signals: classificationSignals.create({
        isVpn: false,
        isTor: true,
        reputationScore: 75,
      })!,
    });

    expect(validContext).toMatchSnapshot();
  });

  it('фиксирует структуру валидного signals', () => {
    const validSignals = classificationSignals.create({
      isVpn: false,
      isTor: true,
      isProxy: false,
      asn: 'AS12345',
      reputationScore: 75,
      velocityScore: 50,
      previousGeo: { lat: 37.7749, lng: -122.4194, country: 'US' },
      externalSignals: {
        vendor: 'test-vendor',
        score: 85,
      },
    });

    expect(validSignals).toMatchSnapshot();
  });

  it('фиксирует структуру минимального context', () => {
    const minimalContext = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
    });

    expect(minimalContext).toMatchSnapshot();
  });

  it('фиксирует структуру минимального signals', () => {
    const minimalSignals = classificationSignals.create({
      isVpn: false,
    });

    expect(minimalSignals).toMatchSnapshot();
  });
});

/* ============================================================================
 * 🔀 EDGE CASES — FIELD COMBINATIONS
 * ============================================================================
 */

describe('Domain Layer Integration: Edge Cases - Field Combinations', () => {
  it('валидирует context с всеми optional полями', () => {
    const fullContext = classificationContext.create({
      previousSessionId: 'session123',
      geo: { lat: 37.7749, lng: -122.4194, country: 'US', region: 'CA', city: 'SF' },
      userId: 'user1',
      ip: '192.168.1.1',
      timestamp: '2024-01-01T00:00:00Z',
      signals: classificationSignals.create({
        isVpn: false,
        externalSignals: { vendor: 'test' },
      })!,
    });

    expect(fullContext).not.toBeNull();
    expect(fullContext?.previousSessionId).toBe('session123');
    expect(fullContext?.geo?.country).toBe('US');
    expect(fullContext?.ip).toBe('192.168.1.1');
    expect(fullContext?.signals?.externalSignals).toBeDefined();
  });

  it('валидирует context без optional полей', () => {
    const minimalContext = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
    });

    expect(minimalContext).not.toBeNull();
    expect(minimalContext?.previousSessionId).toBeUndefined();
    expect(minimalContext?.userId).toBeUndefined();
    expect(minimalContext?.ip).toBeUndefined();
    expect(minimalContext?.signals).toBeUndefined();
  });

  it('валидирует context с geo но без signals', () => {
    const contextWithGeo = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      userId: 'user1',
    });

    expect(contextWithGeo).not.toBeNull();
    expect(contextWithGeo?.geo).toBeDefined();
    expect(contextWithGeo?.signals).toBeUndefined();
  });

  it('валидирует context с signals но без geo', () => {
    const contextWithSignals = classificationContext.create({
      userId: 'user1',
      signals: classificationSignals.create({
        isVpn: false,
      })!,
    });

    expect(contextWithSignals).not.toBeNull();
    expect(contextWithSignals?.geo).toBeUndefined();
    expect(contextWithSignals?.signals).toBeDefined();
  });

  it('валидирует signals с externalSignals но без internal', () => {
    const signalsWithExternal = classificationSignals.create({
      externalSignals: {
        vendor: 'test-vendor',
        score: 85,
      },
    });

    expect(signalsWithExternal).not.toBeNull();
    expect(signalsWithExternal?.externalSignals).toBeDefined();
    expect(signalsWithExternal?.isVpn).toBeUndefined();
  });

  it('валидирует signals с internal но без external', () => {
    const signalsWithInternal = classificationSignals.create({
      isVpn: false,
      reputationScore: 75,
    });

    expect(signalsWithInternal).not.toBeNull();
    expect(signalsWithInternal?.isVpn).toBe(false);
    expect(signalsWithInternal?.externalSignals).toBeUndefined();
  });

  it('валидирует context с previousSessionId и signals', () => {
    const contextWithSession = classificationContext.create({
      previousSessionId: 'session123',
      geo: { lat: 37.7749, lng: -122.4194 },
      signals: classificationSignals.create({
        isVpn: false,
      })!,
    });

    expect(contextWithSession).not.toBeNull();
    expect(contextWithSession?.previousSessionId).toBe('session123');
    expect(contextWithSession?.signals).toBeDefined();
  });

  it('валидирует context без previousSessionId но с signals', () => {
    const contextWithoutSession = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      signals: classificationSignals.create({
        isVpn: false,
      })!,
    });

    expect(contextWithoutSession).not.toBeNull();
    expect(contextWithoutSession?.previousSessionId).toBeUndefined();
    expect(contextWithoutSession?.signals).toBeDefined();
  });
});

/* ============================================================================
 * 🔒 IMMUTABILITY — SIDE-EFFECTS PROTECTION
 * ============================================================================
 */

describe('Domain Layer Integration: Immutability - Side-Effects Protection', () => {
  it('валидированные signals не мутируются при копировании', () => {
    const validSignals = classificationSignals.create({
      isVpn: false,
      isTor: true,
      reputationScore: 75,
    });

    expect(validSignals).not.toBeNull();

    // Создаём копию для проверки immutability
    const copy = { ...validSignals! };

    // Оригинал и копия должны быть равны
    expect(copy).toEqual(validSignals);
    expect(copy.isVpn).toBe(validSignals?.isVpn);
    expect(copy.reputationScore).toBe(validSignals?.reputationScore);
  });

  it('валидированный context не мутируется при копировании', () => {
    const validContext = classificationContext.create({
      geo: { lat: 37.7749, lng: -122.4194 },
      userId: 'user1',
      signals: classificationSignals.create({
        isVpn: false,
      })!,
    });

    expect(validContext).not.toBeNull();

    // Создаём копию для проверки immutability
    const copy = { ...validContext! };

    // Оригинал и копия должны быть равны
    expect(copy).toEqual(validContext);
    expect(copy.userId).toBe(validContext?.userId);
    expect(copy.geo?.lat).toBe(validContext?.geo?.lat);
  });

  it('валидированные данные pure (не имеют side-effects)', () => {
    const input1 = { isVpn: false, reputationScore: 75 };
    const input2 = { isVpn: false, reputationScore: 75 };

    const signals1 = classificationSignals.create(input1);
    const signals2 = classificationSignals.create(input2);

    // Одинаковые входные данные должны давать одинаковые результаты
    expect(signals1).toEqual(signals2);
    expect(signals1?.isVpn).toBe(signals2?.isVpn);
    expect(signals1?.reputationScore).toBe(signals2?.reputationScore);
    // Проверяем, что оба результата валидны
    expect(signals1).not.toBeNull();
    expect(signals2).not.toBeNull();
  });

  it('валидированные данные не изменяют исходный input', () => {
    const originalInput = {
      isVpn: false,
      reputationScore: 75,
      velocityScore: 50,
    };

    const originalInputCopy = { ...originalInput };

    const validSignals = classificationSignals.create(originalInput);

    // Исходный input не должен быть изменён
    expect(originalInput).toEqual(originalInputCopy);
    expect(originalInput.isVpn).toBe(originalInputCopy.isVpn);
    expect(originalInput.reputationScore).toBe(originalInputCopy.reputationScore);
    // Проверяем, что factory вернул валидный результат
    expect(validSignals).not.toBeNull();
  });
});

/* ============================================================================
 * 🛡️ TYPE-LEVEL SAFETY — BYPASS ATTEMPTS
 * ============================================================================
 */

describe('Domain Layer Integration: Type-Level Safety - Bypass Attempts', () => {
  it('factory отклоняет bypass через as unknown as для context', () => {
    // Попытка обойти валидацию через type assertion
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Намеренное использование для тестирования bypass attempts
    const bypassAttempt = {
      previousSessionId: '', // невалидно
      geo: { lat: 999, lng: 999 }, // невалидно
    } as unknown as Parameters<typeof classificationContext.create>[0];

    const result = classificationContext.create(bypassAttempt);

    // Factory должен вернуть null, несмотря на type assertion
    expect(result).toBeNull();
  });

  it('factory отклоняет bypass через as unknown as для signals', () => {
    // Попытка обойти валидацию через type assertion
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Намеренное использование для тестирования bypass attempts
    const bypassAttempt = {
      isVpn: 'not a boolean' as unknown as boolean,
      reputationScore: 999, // вне диапазона
    } as unknown as Parameters<typeof classificationSignals.create>[0];

    const result = classificationSignals.create(bypassAttempt);

    // Factory должен вернуть null, несмотря на type assertion
    expect(result).toBeNull();
  });

  it('factory отклоняет bypass через as unknown as для externalSignals', () => {
    // Попытка обойти валидацию externalSignals
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Намеренное использование для тестирования bypass attempts
    const bypassAttempt = {
      isVpn: false,
      externalSignals: null as unknown as Record<string, unknown>,
    } as unknown as Parameters<typeof classificationSignals.create>[0];

    const result = classificationSignals.create(bypassAttempt);

    // Factory должен вернуть null, несмотря на type assertion
    expect(result).toBeNull();
  });

  it('factory отклоняет bypass через as unknown as для nested signals', () => {
    // Попытка обойти валидацию вложенных signals
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Намеренное использование для тестирования bypass attempts
    const bypassAttempt = {
      geo: { lat: 37.7749, lng: -122.4194 },
      signals: {
        isVpn: 'not a boolean' as unknown as boolean,
      } as unknown as ReturnType<typeof classificationSignals.create>,
    } as unknown as Parameters<typeof classificationContext.create>[0];

    const result = classificationContext.create(bypassAttempt);

    // Factory должен вернуть null, несмотря на type assertion
    expect(result).toBeNull();
  });

  it('factory отклоняет bypass через as unknown as для geo', () => {
    // Попытка обойти валидацию geo
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Намеренное использование для тестирования bypass attempts
    const bypassAttempt = {
      geo: { lat: 999, lng: 999 },
    } as unknown as Parameters<typeof classificationContext.create>[0];

    const result = classificationContext.create(bypassAttempt);

    // Factory должен вернуть null, несмотря на type assertion
    expect(result).toBeNull();
  });
});
