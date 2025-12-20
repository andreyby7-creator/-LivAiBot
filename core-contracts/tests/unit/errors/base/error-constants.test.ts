/**
 * Unit tests для ErrorConstants
 *
 * Тесты для проверки констант ошибок, type guards и валидации.
 */

import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
  isErrorCategory,
  isErrorOrigin,
  isErrorSeverity,
} from '../../../../src/errors/base/ErrorConstants.js';

import type {
  ErrorCategory,
  ErrorOrigin,
  ErrorSeverity,
} from '../../../../src/errors/base/ErrorConstants.js';

describe('ErrorConstants', () => {
  describe('ERROR_SEVERITY', () => {
    it('should have all expected severity levels', () => {
      expect(ERROR_SEVERITY.LOW).toBe('low');
      expect(ERROR_SEVERITY.MEDIUM).toBe('medium');
      expect(ERROR_SEVERITY.HIGH).toBe('high');
      expect(ERROR_SEVERITY.CRITICAL).toBe('critical');
    });

    it('should be immutable (frozen)', () => {
      // Попытка мутации должна быть заблокирована на runtime
      expect(() => {
        (ERROR_SEVERITY as Record<string, string>).NEW_LEVEL = 'new';
      }).toThrow(); // Object.freeze выбрасывает ошибку в strict mode

      // Проверяем, что значение не изменилось
      expect(ERROR_SEVERITY.NEW_LEVEL).toBeUndefined();
    });

    it('should have ErrorSeverity type covering all values', () => {
      const severities: ErrorSeverity[] = [
        ERROR_SEVERITY.LOW,
        ERROR_SEVERITY.MEDIUM,
        ERROR_SEVERITY.HIGH,
        ERROR_SEVERITY.CRITICAL,
      ];

      severities.forEach((severity) => {
        expect(typeof severity).toBe('string');
        expect(isErrorSeverity(severity)).toBe(true);
      });
    });
  });

  describe('isErrorSeverity', () => {
    it('should return true for valid severity values', () => {
      expect(isErrorSeverity(ERROR_SEVERITY.LOW)).toBe(true);
      expect(isErrorSeverity(ERROR_SEVERITY.MEDIUM)).toBe(true);
      expect(isErrorSeverity(ERROR_SEVERITY.HIGH)).toBe(true);
      expect(isErrorSeverity(ERROR_SEVERITY.CRITICAL)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isErrorSeverity('invalid')).toBe(false);
      expect(isErrorSeverity('')).toBe(false);
      expect(isErrorSeverity(null)).toBe(false);
      expect(isErrorSeverity(undefined)).toBe(false);
      expect(isErrorSeverity(123)).toBe(false);
      expect(isErrorSeverity({})).toBe(false);
      expect(isErrorSeverity([])).toBe(false);
      expect(isErrorSeverity(true)).toBe(false);
    });

    it('should provide type narrowing', () => {
      const value: unknown = ERROR_SEVERITY.HIGH;

      if (isErrorSeverity(value)) {
        // TypeScript должен сузить тип до ErrorSeverity
        const severity: ErrorSeverity = value;
        expect(severity).toBe('high');
      } else {
        expect.fail('Type guard should return true for valid severity');
      }
    });
  });

  describe('ERROR_CATEGORY', () => {
    it('should have all expected category values', () => {
      expect(ERROR_CATEGORY.VALIDATION).toBe('validation');
      expect(ERROR_CATEGORY.AUTHORIZATION).toBe('authorization');
      expect(ERROR_CATEGORY.BUSINESS).toBe('business');
      expect(ERROR_CATEGORY.INFRASTRUCTURE).toBe('infrastructure');
      expect(ERROR_CATEGORY.UNKNOWN).toBe('unknown');
    });

    it('should be immutable (frozen)', () => {
      expect(() => {
        (ERROR_CATEGORY as Record<string, string>).NEW_CATEGORY = 'new';
      }).toThrow(); // Object.freeze выбрасывает ошибку в strict mode

      expect(ERROR_CATEGORY.NEW_CATEGORY).toBeUndefined();
    });

    it('should have ErrorCategory type covering all values', () => {
      const categories: ErrorCategory[] = [
        ERROR_CATEGORY.VALIDATION,
        ERROR_CATEGORY.AUTHORIZATION,
        ERROR_CATEGORY.BUSINESS,
        ERROR_CATEGORY.INFRASTRUCTURE,
        ERROR_CATEGORY.UNKNOWN,
      ];

      categories.forEach((category) => {
        expect(typeof category).toBe('string');
        expect(isErrorCategory(category)).toBe(true);
      });
    });
  });

  describe('isErrorCategory', () => {
    it('should return true for valid category values', () => {
      expect(isErrorCategory(ERROR_CATEGORY.VALIDATION)).toBe(true);
      expect(isErrorCategory(ERROR_CATEGORY.AUTHORIZATION)).toBe(true);
      expect(isErrorCategory(ERROR_CATEGORY.BUSINESS)).toBe(true);
      expect(isErrorCategory(ERROR_CATEGORY.INFRASTRUCTURE)).toBe(true);
      expect(isErrorCategory(ERROR_CATEGORY.UNKNOWN)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isErrorCategory('invalid')).toBe(false);
      expect(isErrorCategory('')).toBe(false);
      expect(isErrorCategory(null)).toBe(false);
      expect(isErrorCategory(undefined)).toBe(false);
      expect(isErrorCategory(123)).toBe(false);
      expect(isErrorCategory({})).toBe(false);
      expect(isErrorCategory([])).toBe(false);
      expect(isErrorCategory(true)).toBe(false);
    });

    it('should provide type narrowing', () => {
      const value: unknown = ERROR_CATEGORY.BUSINESS;

      if (isErrorCategory(value)) {
        const category: ErrorCategory = value;
        expect(category).toBe('business');
      } else {
        expect.fail('Type guard should return true for valid category');
      }
    });
  });

  describe('ERROR_ORIGIN', () => {
    it('should have all expected origin values', () => {
      expect(ERROR_ORIGIN.DOMAIN).toBe('domain');
      expect(ERROR_ORIGIN.APPLICATION).toBe('application');
      expect(ERROR_ORIGIN.INFRASTRUCTURE).toBe('infrastructure');
      expect(ERROR_ORIGIN.SECURITY).toBe('security');
    });

    it('should be immutable (frozen)', () => {
      expect(() => {
        (ERROR_ORIGIN as Record<string, string>).NEW_ORIGIN = 'new';
      }).toThrow(); // Object.freeze выбрасывает ошибку в strict mode

      expect(ERROR_ORIGIN.NEW_ORIGIN).toBeUndefined();
    });

    it('should have ErrorOrigin type covering all values', () => {
      const origins: ErrorOrigin[] = [
        ERROR_ORIGIN.DOMAIN,
        ERROR_ORIGIN.APPLICATION,
        ERROR_ORIGIN.INFRASTRUCTURE,
        ERROR_ORIGIN.SECURITY,
      ];

      origins.forEach((origin) => {
        expect(typeof origin).toBe('string');
        expect(isErrorOrigin(origin)).toBe(true);
      });
    });
  });

  describe('isErrorOrigin', () => {
    it('should return true for valid origin values', () => {
      expect(isErrorOrigin(ERROR_ORIGIN.DOMAIN)).toBe(true);
      expect(isErrorOrigin(ERROR_ORIGIN.APPLICATION)).toBe(true);
      expect(isErrorOrigin(ERROR_ORIGIN.INFRASTRUCTURE)).toBe(true);
      expect(isErrorOrigin(ERROR_ORIGIN.SECURITY)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isErrorOrigin('invalid')).toBe(false);
      expect(isErrorOrigin('')).toBe(false);
      expect(isErrorOrigin(null)).toBe(false);
      expect(isErrorOrigin(undefined)).toBe(false);
      expect(isErrorOrigin(123)).toBe(false);
      expect(isErrorOrigin({})).toBe(false);
      expect(isErrorOrigin([])).toBe(false);
      expect(isErrorOrigin(true)).toBe(false);
    });

    it('should provide type narrowing', () => {
      const value: unknown = ERROR_ORIGIN.DOMAIN;

      if (isErrorOrigin(value)) {
        const origin: ErrorOrigin = value;
        expect(origin).toBe('domain');
      } else {
        expect.fail('Type guard should return true for valid origin');
      }
    });
  });

  describe('Type safety and consistency', () => {
    it('should have consistent string values', () => {
      // Все значения должны быть строками
      Object.values(ERROR_SEVERITY).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      Object.values(ERROR_CATEGORY).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      Object.values(ERROR_ORIGIN).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should have consistent string values', () => {
      const severityValues = Object.values(ERROR_SEVERITY);
      const categoryValues = Object.values(ERROR_CATEGORY);
      const originValues = Object.values(ERROR_ORIGIN);

      // Проверяем, что все значения - строки
      severityValues.forEach((sev) => {
        expect(typeof sev).toBe('string');
      });

      categoryValues.forEach((cat) => {
        expect(typeof cat).toBe('string');
      });

      originValues.forEach((orig) => {
        expect(typeof orig).toBe('string');
      });

      // Примечание: значения могут пересекаться (например, 'infrastructure' в category и origin)
      // но это разные типы (ErrorCategory vs ErrorOrigin), что обеспечивает type safety
    });
  });
});
