/**
 * @file Unit тесты для domain/common.ts
 */
import { describe, expect, it } from 'vitest';
import type {
  DurationMs,
  JsonObject,
  PolicyDecision,
  PolicyViolation,
  Settings,
  Timestamp,
  UnixTimestampMs,
  UUID,
} from '../../../src/domain/common.js';
import { Decision, DecisionUtils } from '../../../src/domain/common.js';
import { TEST_USER_ID } from '../../constants';

describe('UUID type', () => {
  it('принимает строковые значения', () => {
    // Type check - это должно компилироваться без ошибок
    const validUUID: UUID = TEST_USER_ID;
    expect(typeof validUUID).toBe('string');
    expect(validUUID).toBe(TEST_USER_ID);
  });

  it('является алиасом string', () => {
    const uuid: UUID = 'test-uuid';
    const str: string = uuid; // Должно компилироваться
    expect(str).toBe('test-uuid');
  });
});

describe('Timestamp type', () => {
  it('принимает ISO 8601 строки', () => {
    // Type check - это должно компилироваться без ошибок
    const validTimestamp: Timestamp = '2026-01-09T21:34:12.123Z';
    expect(typeof validTimestamp).toBe('string');
    expect(validTimestamp).toBe('2026-01-09T21:34:12.123Z');
  });

  it('является алиасом string', () => {
    const timestamp: Timestamp = '2024-01-01T00:00:00.000Z';
    const str: string = timestamp; // Должно компилироваться
    expect(str).toBe('2024-01-01T00:00:00.000Z');
  });

  it('принимает различные форматы ISO строк', () => {
    const timestamps: Timestamp[] = [
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:00:00.123Z',
    ];

    timestamps.forEach((ts) => {
      expect(typeof ts).toBe('string');
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });
  });
});

describe('JsonObject type', () => {
  it('принимает пустой объект', () => {
    const obj: JsonObject = {};
    expect(obj).toEqual({});
    expect(typeof obj).toBe('object');
  });

  it('принимает объект с различными типами значений', () => {
    const obj: JsonObject = {
      string: 'value',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      nested: { key: 'value' },
    };

    expect(obj).toMatchObject({
      string: 'value',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      nested: { key: 'value' },
    });
  });

  it('совместим с Record<string, unknown>', () => {
    const obj: JsonObject = { key: 'value' };
    const record: Record<string, unknown> = obj; // Должно компилироваться
    expect(record).toEqual({ key: 'value' });
  });

  it('не принимает не-объекты', () => {
    // Type check - эти присваивания должны вызывать ошибки компиляции
    // const invalid1: JsonObject = "string"; // Ожидаемая ошибка TS
    // const invalid2: JsonObject = 42; // Ожидаемая ошибка TS
    // const invalid3: JsonObject = null; // Ожидаемая ошибка TS

    expect(() => {
      // @ts-expect-error - string не является JsonObject
      const invalid: JsonObject = 'string';
      return invalid;
    }).not.toThrow(); // Runtime проверка

    expect(() => {
      // @ts-expect-error - number не является JsonObject
      const invalid: JsonObject = 42;
      return invalid;
    }).not.toThrow(); // Runtime проверка
  });
});

describe('Settings type', () => {
  it('является алиасом JsonObject', () => {
    const settings: Settings = {
      theme: 'dark',
      notifications: true,
      preferences: {
        language: 'en',
        timezone: 'UTC',
      },
    };

    expect(settings).toMatchObject({
      theme: 'dark',
      notifications: true,
      preferences: {
        language: 'en',
        timezone: 'UTC',
      },
    });
  });

  it('принимает пустые настройки', () => {
    const settings: Settings = {};
    expect(settings).toEqual({});
  });

  it('совместим с JsonObject', () => {
    const jsonObj: JsonObject = { key: 'value' };
    const settings: Settings = jsonObj; // Должно компилироваться
    expect(settings).toEqual({ key: 'value' });
  });
});

describe('Интеграционные тесты типов', () => {
  it('все типы являются строками или объектами на runtime', () => {
    const uuid: UUID = 'test-uuid';
    const timestamp: Timestamp = '2024-01-01T00:00:00Z';
    const jsonObject: JsonObject = { key: 'value' };
    const settings: Settings = { setting: true };

    // Все типы на runtime являются обычными JavaScript типами
    expect(typeof uuid).toBe('string');
    expect(typeof timestamp).toBe('string');
    expect(typeof jsonObject).toBe('object');
    expect(typeof settings).toBe('object');
  });

  it('снапшот примеров использования', () => {
    const exampleFixture = {
      uuid: TEST_USER_ID as UUID,
      timestamp: '2026-01-09T21:34:12.123Z' as Timestamp,
      jsonObject: {
        user: 'john',
        age: 30,
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      } as JsonObject,
      settings: {
        theme: 'light',
        language: 'en',
        features: ['feature1', 'feature2'],
      } as Settings,
    };

    expect(exampleFixture).toMatchSnapshot();
  });
});

describe('DurationMs type', () => {
  it('принимает числовые значения', () => {
    const duration: DurationMs = 5000; // 5 seconds
    expect(typeof duration).toBe('number');
    expect(duration).toBe(5000);
  });

  it('может использоваться в арифметических операциях', () => {
    const duration1: DurationMs = 1000;
    const duration2: DurationMs = 2000;
    const total: DurationMs = duration1 + duration2;

    expect(total).toBe(3000);
  });
});

describe('UnixTimestampMs type', () => {
  it('принимает числовые значения timestamp', () => {
    const timestamp: UnixTimestampMs = Date.now();
    expect(typeof timestamp).toBe('number');
    expect(timestamp).toBeGreaterThan(0);
  });

  it('совместим с Date.now()', () => {
    const now: UnixTimestampMs = Date.now();
    expect(now).toBeGreaterThan(1609459200000); // 2021-01-01 timestamp
  });
});

describe('PolicyViolation type', () => {
  it('принимает объект с code и reason', () => {
    const violation: PolicyViolation = {
      code: 'TEST_VIOLATION',
      reason: 'Test violation reason',
    };

    expect(violation.code).toBe('TEST_VIOLATION');
    expect(violation.reason).toBe('Test violation reason');
  });

  it('reason является опциональным', () => {
    const violation: PolicyViolation = {
      code: 'MINIMAL_VIOLATION',
    };

    expect(violation.code).toBe('MINIMAL_VIOLATION');
    expect(violation.reason).toBeUndefined();
  });
});

describe('Decision class', () => {
  describe('allow method', () => {
    it('создает положительное решение', () => {
      const decision = Decision.allow('SUCCESS');

      expect(decision).toEqual({
        allow: true,
        reason: 'SUCCESS',
      });
    });

    it('работает с любыми строковыми типами', () => {
      const decision = Decision.allow('CUSTOM_SUCCESS' as const);

      expect(decision).toEqual({
        allow: true,
        reason: 'CUSTOM_SUCCESS',
      });
    });
  });

  describe('deny method', () => {
    it('создает отрицательное решение с violation', () => {
      const violation: PolicyViolation = { code: 'TEST_DENY' };
      const decision = Decision.deny('DENIED', violation);

      expect(decision).toEqual({
        allow: false,
        reason: 'DENIED',
        violation: { code: 'TEST_DENY' },
      });
    });
  });

  describe('denySimple method', () => {
    it('создает отрицательное решение без violation', () => {
      const decision = Decision.denySimple('SIMPLE_DENY');

      expect(decision).toEqual({
        allow: false,
        reason: 'SIMPLE_DENY',
      });
    });
  });

  describe('denyOptional method', () => {
    it('создает отрицательное решение с violation', () => {
      const violation: PolicyViolation = { code: 'OPTIONAL_DENY' };
      const decision = Decision.denyOptional('OPTIONAL_DENIED', violation);

      expect(decision).toEqual({
        allow: false,
        reason: 'OPTIONAL_DENIED',
        violation: { code: 'OPTIONAL_DENY' },
      });
    });

    it('создает отрицательное решение без violation', () => {
      const decision = Decision.denyOptional('OPTIONAL_DENIED_SIMPLE');

      expect(decision).toEqual({
        allow: false,
        reason: 'OPTIONAL_DENIED_SIMPLE',
      });
    });
  });
});

describe('DecisionUtils class', () => {
  describe('isDenied method', () => {
    it('возвращает true для deny решений', () => {
      const decision = Decision.denySimple('DENIED');
      expect(DecisionUtils.isDenied(decision)).toBe(true);
    });

    it('возвращает false для allow решений', () => {
      const decision = Decision.allow('ALLOWED');
      expect(DecisionUtils.isDenied(decision)).toBe(false);
    });
  });

  describe('isAllowed method', () => {
    it('возвращает true для allow решений', () => {
      const decision = Decision.allow('ALLOWED');
      expect(DecisionUtils.isAllowed(decision)).toBe(true);
    });

    it('возвращает false для deny решений', () => {
      const decision = Decision.denySimple('DENIED');
      expect(DecisionUtils.isAllowed(decision)).toBe(false);
    });
  });
});

describe('PolicyDecision type', () => {
  it('принимает allow решения', () => {
    const decision: PolicyDecision<string, string> = Decision.allow('SUCCESS');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });

  it('принимает deny решения с violation', () => {
    const violation: PolicyViolation = { code: 'TEST' };
    const decision: PolicyDecision<string, string> = Decision.deny('DENIED', violation);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('DENIED');
    expect('violation' in decision && decision.violation).toEqual(violation);
  });

  it('принимает deny решения без violation', () => {
    const decision: PolicyDecision<string, string> = Decision.denySimple('DENIED');

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('DENIED');
    expect('violation' in decision).toBe(false);
  });
});
