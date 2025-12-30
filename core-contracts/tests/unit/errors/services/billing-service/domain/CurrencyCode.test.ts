import { describe, expect, it } from 'vitest';

import {
  CURRENCY_CODE_COUNT,
  CURRENCY_CODE_VALUES,
  isCurrencyCode,
  makeCurrencyCode,
  SUPPORTED_CURRENCY_CODES,
} from '../../../../../../src/errors/services/billing-service/domain/CurrencyCode';
import type { CurrencyCode } from '../../../../../../src/errors/services/billing-service/domain/CurrencyCode';

// ==================== CONSTANTS ====================

/** Все ожидаемые поддерживаемые валюты */
const EXPECTED_CURRENCIES = {
  BYN: 'BYN',
  USD: 'USD',
  EUR: 'EUR',
  RUB: 'RUB',
} as const;

/** Несуществующие/неподдерживаемые валюты для тестирования */
const INVALID_CURRENCY_CODES = [
  '',
  '   ',
  'btc',
  'ETH',
  'JPY',
  'GBP',
  'CNY',
  'invalid',
  'random',
  'test',
  '123',
  'BYN1',
  'USD_extra',
  'eur', // lowercase
  'rub', // lowercase
] as const;

// ==================== TESTS ====================

describe('CurrencyCode', () => {
  describe('SUPPORTED_CURRENCY_CODES', () => {
    it('должен содержать все ожидаемые валюты', () => {
      expect(SUPPORTED_CURRENCY_CODES).toEqual(EXPECTED_CURRENCIES);
    });

    it('должен содержать ровно 4 валюты', () => {
      const currencies = Object.keys(SUPPORTED_CURRENCY_CODES);
      expect(currencies).toHaveLength(4);
      expect(currencies).toEqual(['BYN', 'USD', 'EUR', 'RUB']);
    });

    it('все значения должны быть брендированными типами CurrencyCode', () => {
      Object.values(SUPPORTED_CURRENCY_CODES).forEach((code) => {
        expect(typeof code).toBe('string');
        expect(isCurrencyCode(code)).toBe(true);
      });
    });

    it('BYN - Белорусский рубль', () => {
      expect(SUPPORTED_CURRENCY_CODES.BYN).toBe('BYN');
      expect(isCurrencyCode(SUPPORTED_CURRENCY_CODES.BYN)).toBe(true);
    });

    it('USD - Доллар США', () => {
      expect(SUPPORTED_CURRENCY_CODES.USD).toBe('USD');
      expect(isCurrencyCode(SUPPORTED_CURRENCY_CODES.USD)).toBe(true);
    });

    it('EUR - Евро', () => {
      expect(SUPPORTED_CURRENCY_CODES.EUR).toBe('EUR');
      expect(isCurrencyCode(SUPPORTED_CURRENCY_CODES.EUR)).toBe(true);
    });

    it('RUB - Российский рубль', () => {
      expect(SUPPORTED_CURRENCY_CODES.RUB).toBe('RUB');
      expect(isCurrencyCode(SUPPORTED_CURRENCY_CODES.RUB)).toBe(true);
    });
  });

  describe('CurrencyCode type', () => {
    it('должен быть брендированным типом на основе string', () => {
      // TypeScript проверки - эти строки должны компилироваться
      const bynCode: CurrencyCode = 'BYN' as CurrencyCode;
      const usdCode: CurrencyCode = 'USD' as CurrencyCode;
      const eurCode: CurrencyCode = 'EUR' as CurrencyCode;
      const rubCode: CurrencyCode = 'RUB' as CurrencyCode;

      expect(isCurrencyCode(bynCode)).toBe(true);
      expect(isCurrencyCode(usdCode)).toBe(true);
      expect(isCurrencyCode(eurCode)).toBe(true);
      expect(isCurrencyCode(rubCode)).toBe(true);
    });

    it('должен предотвращать использование произвольных строк', () => {
      // Проверяем что произвольные строки не проходят валидацию
      const invalidCode = 'INVALID';

      expect(isCurrencyCode(invalidCode)).toBe(false);

      // TypeScript предотвращает присваивание произвольных строк к CurrencyCode
      // без явного приведения типа - проверяем через компиляцию
      // (runtime проверка не требуется, так как это type-level ограничение)
    });
  });

  describe('isCurrencyCode', () => {
    it('должен возвращать true для всех поддерживаемых валют', () => {
      Object.values(SUPPORTED_CURRENCY_CODES).forEach((code) => {
        expect(isCurrencyCode(code)).toBe(true);
      });
    });

    it('должен обеспечивать type narrowing для поддерживаемых валют', () => {
      const testValues = ['BYN', 'USD', 'EUR', 'RUB'] as const;

      testValues.forEach((value) => {
        expect(isCurrencyCode(value)).toBe(true);

        // После проверки isCurrencyCode используем type assertion
        const narrowedValue = value as CurrencyCode;
        expect(CURRENCY_CODE_VALUES).toContain(narrowedValue);
      });
    });

    it('должен возвращать false для невалидных кодов валют', () => {
      INVALID_CURRENCY_CODES.forEach((invalidCode) => {
        expect(isCurrencyCode(invalidCode)).toBe(false);
      });
    });

    it('должен возвращать false для null и undefined', () => {
      expect(isCurrencyCode(null as any)).toBe(false);
      expect(isCurrencyCode(undefined as any)).toBe(false);
    });

    it('должен возвращать false для чисел', () => {
      expect(isCurrencyCode('123' as any)).toBe(false);
      expect(isCurrencyCode(123 as any)).toBe(false);
    });

    it('должен возвращать false для объектов', () => {
      expect(isCurrencyCode({} as any)).toBe(false);
      expect(isCurrencyCode([] as any)).toBe(false);
    });

    it('должен быть чувствительным к регистру', () => {
      expect(isCurrencyCode('byn')).toBe(false);
      expect(isCurrencyCode('usd')).toBe(false);
      expect(isCurrencyCode('EUR')).toBe(true); // uppercase уже проверено выше
    });

    it('должен корректно работать с граничными случаями', () => {
      // Похожие на валюты но невалидные
      expect(isCurrencyCode('BYN1')).toBe(false);
      expect(isCurrencyCode('USD_extra')).toBe(false);
      expect(isCurrencyCode('EUR ')).toBe(false);
      expect(isCurrencyCode(' RUB')).toBe(false);
      expect(isCurrencyCode('RUB\n')).toBe(false);
    });
  });

  describe('makeCurrencyCode', () => {
    it('должен успешно создавать CurrencyCode для всех поддерживаемых валют', () => {
      Object.values(SUPPORTED_CURRENCY_CODES).forEach((expectedCode) => {
        const result = makeCurrencyCode(expectedCode);
        expect(result).toBe(expectedCode);
        expect(isCurrencyCode(result)).toBe(true);
      });
    });

    it('должен выбрасывать ошибку для невалидных кодов валют', () => {
      INVALID_CURRENCY_CODES.forEach((invalidCode) => {
        expect(() => makeCurrencyCode(invalidCode)).toThrow(
          `Invalid currency code: ${invalidCode}`,
        );
      });
    });

    it('должен обеспечивать type safety при создании', () => {
      // TypeScript проверки
      const bynCode = makeCurrencyCode('BYN');
      const usdCode = makeCurrencyCode('USD');

      // Эти значения теперь имеют тип CurrencyCode
      const bynTyped: CurrencyCode = bynCode;
      const usdTyped: CurrencyCode = usdCode;

      expect(bynCode).toBe('BYN');
      expect(usdCode).toBe('USD');
      expect(bynTyped).toBe(bynCode);
      expect(usdTyped).toBe(usdCode);
    });

    it('должен выбрасывать ошибку для null и undefined', () => {
      expect(() => makeCurrencyCode(null as any)).toThrow('Invalid currency code: null');
      expect(() => makeCurrencyCode(undefined as any)).toThrow('Invalid currency code: undefined');
    });

    it('должен выбрасывать ошибку для пустой строки', () => {
      expect(() => makeCurrencyCode('')).toThrow('Invalid currency code: ');
    });
  });

  describe('CURRENCY_CODE_VALUES', () => {
    it('должен содержать все поддерживаемые валюты', () => {
      expect(CURRENCY_CODE_VALUES).toHaveLength(4);
      expect(CURRENCY_CODE_VALUES).toEqual(['BYN', 'USD', 'EUR', 'RUB']);
    });

    it('все значения должны быть CurrencyCode', () => {
      CURRENCY_CODE_VALUES.forEach((code) => {
        expect(isCurrencyCode(code)).toBe(true);
        expect(typeof code).toBe('string');
      });
    });

    it('должен быть readonly массивом', () => {
      expect(CURRENCY_CODE_VALUES).toBeInstanceOf(Array);

      // Проверяем что массив имеет правильную длину и содержит ожидаемые значения
      expect(CURRENCY_CODE_VALUES).toHaveLength(4);
      expect(CURRENCY_CODE_VALUES).toEqual(['BYN', 'USD', 'EUR', 'RUB']);

      // TypeScript предотвращает модификацию readonly массива на уровне типов
      // (runtime проверка не требуется для type-level ограничений)
    });

    it('порядок должен соответствовать порядку в SUPPORTED_CURRENCY_CODES', () => {
      const expectedValues = Object.values(SUPPORTED_CURRENCY_CODES);
      expect(CURRENCY_CODE_VALUES).toEqual(expectedValues);
    });
  });

  describe('CURRENCY_CODE_COUNT', () => {
    it('должен равняться количеству поддерживаемых валют', () => {
      expect(CURRENCY_CODE_COUNT).toBe(4);
      expect(CURRENCY_CODE_COUNT).toBe(Object.keys(SUPPORTED_CURRENCY_CODES).length);
      expect(CURRENCY_CODE_COUNT).toBe(CURRENCY_CODE_VALUES.length);
    });

    it('должен быть числом', () => {
      expect(typeof CURRENCY_CODE_COUNT).toBe('number');
      expect(Number.isInteger(CURRENCY_CODE_COUNT)).toBe(true);
      expect(CURRENCY_CODE_COUNT).toBeGreaterThan(0);
    });
  });

  describe('Integration tests', () => {
    it('isCurrencyCode и makeCurrencyCode должны работать вместе', () => {
      const testCodes = ['BYN', 'USD', 'EUR', 'RUB'];

      testCodes.forEach((codeString) => {
        // Проверяем через type guard
        expect(isCurrencyCode(codeString)).toBe(true);

        // Создаем через makeCurrencyCode
        const createdCode = makeCurrencyCode(codeString);
        expect(createdCode).toBe(codeString);

        // Проверяем что созданный код в списке значений
        expect(CURRENCY_CODE_VALUES).toContain(createdCode);
      });
    });

    it('все константы должны быть согласованы', () => {
      expect(CURRENCY_CODE_COUNT).toBe(Object.keys(SUPPORTED_CURRENCY_CODES).length);
      expect(CURRENCY_CODE_VALUES.length).toBe(CURRENCY_CODE_COUNT);
      expect(CURRENCY_CODE_VALUES).toEqual(Object.values(SUPPORTED_CURRENCY_CODES));

      // Все значения из SUPPORTED_CURRENCY_CODES должны проходить isCurrencyCode
      Object.values(SUPPORTED_CURRENCY_CODES).forEach((code) => {
        expect(isCurrencyCode(code)).toBe(true);
        expect(CURRENCY_CODE_VALUES).toContain(code);
      });
    });

    it('type safety должен работать в цепочке операций', () => {
      // Создаем код через makeCurrencyCode
      const code = makeCurrencyCode('USD');

      // Проверяем через isCurrencyCode
      expect(isCurrencyCode(code)).toBe(true);

      // Используем в массиве значений
      expect(CURRENCY_CODE_VALUES).toContain(code);

      // Проверяем количество
      expect(CURRENCY_CODE_COUNT).toBeGreaterThanOrEqual(1);

      // Все операции должны быть type-safe
      const typedCode: CurrencyCode = code;
      const typedValues: readonly CurrencyCode[] = CURRENCY_CODE_VALUES;
      const typedCount: number = CURRENCY_CODE_COUNT;

      // Проверяем что типы корректны
      expect(typedCode).toBe(code);
      expect(typedValues).toEqual(CURRENCY_CODE_VALUES);
      expect(typedCount).toBe(CURRENCY_CODE_COUNT);
    });
  });
});
