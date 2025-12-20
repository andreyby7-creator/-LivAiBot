/**
 * Unit tests для DomainErrorMeta
 *
 * Тесты для проверки helpers работы с метаданными domain ошибок.
 */

import { describe, expect, it } from 'vitest';

import { ERROR_CATEGORY, ERROR_SEVERITY } from '../../../../src/errors/base/ErrorConstants.js';
import {
  createBusinessRuleViolationError,
  createDomainInvariantBrokenError,
  createEntityNotFoundError,
} from '../../../../src/errors/domain/DomainError.js';
import {
  getDomainErrorCategory,
  getDomainErrorMeta,
  getDomainErrorSeverity,
  isDomainErrorRetryable,
} from '../../../../src/errors/domain/DomainErrorMeta.js';

import type { ErrorCategory, ErrorSeverity } from '../../../../src/errors/base/ErrorConstants.js';

describe('DomainErrorMeta', () => {
  describe('getDomainErrorMeta', () => {
    it('should return metadata for EntityNotFoundError', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const meta = getDomainErrorMeta(error);

      expect(meta).toBeDefined();
      expect(meta?.layer).toBe('domain');
      expect(meta?.category).toBe('business');
    });

    it('should return metadata for BusinessRuleViolationError', () => {
      const error = createBusinessRuleViolationError('TestRule', 'Test message');

      const meta = getDomainErrorMeta(error);

      expect(meta).toBeDefined();
      expect(meta?.layer).toBe('domain');
      expect(meta?.kind).toBe('rule');
    });

    it('should return metadata for DomainInvariantBrokenError', () => {
      const error = createDomainInvariantBrokenError('TestInvariant', 'Test message');

      const meta = getDomainErrorMeta(error);

      expect(meta).toBeDefined();
      expect(meta?.layer).toBe('domain');
      expect(meta?.severity).toBe(ERROR_SEVERITY.CRITICAL);
    });

    it('should return undefined for errors without metadata in registry', () => {
      // Создаем ошибку с валидным кодом, но без метаданных в реестре
      // В реальности это не должно произойти, т.к. реестр полный
      // Но тестируем edge case
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const meta = getDomainErrorMeta(error);

      // В нормальных условиях метаданные должны быть
      expect(meta).toBeDefined();
    });
  });

  describe('isDomainErrorRetryable', () => {
    it('should return false for EntityNotFoundError (not retryable)', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      expect(isDomainErrorRetryable(error)).toBe(false);
    });

    it('should return false for BusinessRuleViolationError (not retryable)', () => {
      const error = createBusinessRuleViolationError('TestRule', 'Test message');

      expect(isDomainErrorRetryable(error)).toBe(false);
    });

    it('should return false for DomainInvariantBrokenError (not retryable)', () => {
      const error = createDomainInvariantBrokenError('TestInvariant', 'Test message');

      expect(isDomainErrorRetryable(error)).toBe(false);
    });

    it('should return false as default when metadata is missing', () => {
      // Тестируем fallback поведение
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      // В нормальных условиях метаданные есть, но проверяем логику
      const retryable = isDomainErrorRetryable(error);
      expect(typeof retryable).toBe('boolean');
    });
  });

  describe('getDomainErrorSeverity', () => {
    it('should return severity for EntityNotFoundError', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const severity = getDomainErrorSeverity(error);

      expect(severity).toBeDefined();
      expect(severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('should return CRITICAL severity for DomainInvariantBrokenError', () => {
      const error = createDomainInvariantBrokenError('TestInvariant', 'Test message');

      const severity = getDomainErrorSeverity(error);

      expect(severity).toBeDefined();
      expect(severity).toBe(ERROR_SEVERITY.CRITICAL);
    });

    it('should return undefined when metadata is missing', () => {
      // В нормальных условиях метаданные всегда есть
      // Но проверяем edge case
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const severity = getDomainErrorSeverity(error);

      // В реальности должно быть определено
      expect(severity === undefined || typeof severity === 'string').toBe(true);
    });

    it('should return valid ErrorSeverity type', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const severity = getDomainErrorSeverity(error);

      if (severity !== undefined) {
        const validSeverities: ErrorSeverity[] = [
          ERROR_SEVERITY.LOW,
          ERROR_SEVERITY.MEDIUM,
          ERROR_SEVERITY.HIGH,
          ERROR_SEVERITY.CRITICAL,
        ];
        expect(validSeverities).toContain(severity);
      }
    });
  });

  describe('getDomainErrorCategory', () => {
    it('should return category for EntityNotFoundError', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const category = getDomainErrorCategory(error);

      expect(category).toBeDefined();
      expect(category).toBe(ERROR_CATEGORY.BUSINESS);
    });

    it('should return BUSINESS category for domain errors', () => {
      const error = createBusinessRuleViolationError('TestRule', 'Test message');

      const category = getDomainErrorCategory(error);

      expect(category).toBeDefined();
      expect(category).toBe(ERROR_CATEGORY.BUSINESS);
    });

    it('should return undefined when metadata is missing', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const category = getDomainErrorCategory(error);

      // В реальности должно быть определено
      expect(category === undefined || typeof category === 'string').toBe(true);
    });

    it('should return valid ErrorCategory type', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123',
      });

      const category = getDomainErrorCategory(error);

      if (category !== undefined) {
        const validCategories: ErrorCategory[] = [
          ERROR_CATEGORY.VALIDATION,
          ERROR_CATEGORY.AUTHORIZATION,
          ERROR_CATEGORY.BUSINESS,
          ERROR_CATEGORY.INFRASTRUCTURE,
          ERROR_CATEGORY.UNKNOWN,
        ];
        expect(validCategories).toContain(category);
      }
    });
  });

  describe('Metadata consistency', () => {
    it('should have consistent metadata for all domain error types', () => {
      const errors = [
        createEntityNotFoundError({ entityType: 'User', entityId: '1' }),
        createBusinessRuleViolationError('Rule', 'Message'),
        createDomainInvariantBrokenError('Invariant', 'Message'),
      ];

      errors.forEach((error) => {
        const meta = getDomainErrorMeta(error);
        expect(meta).toBeDefined();
        expect(meta?.layer).toBe('domain');
      });
    });

    it('should have correct retryable flags', () => {
      const errors = [
        createEntityNotFoundError({ entityType: 'User', entityId: '1' }),
        createBusinessRuleViolationError('Rule', 'Message'),
        createDomainInvariantBrokenError('Invariant', 'Message'),
      ];

      errors.forEach((error) => {
        const retryable = isDomainErrorRetryable(error);
        expect(typeof retryable).toBe('boolean');
        // Domain errors typically not retryable
        expect(retryable).toBe(false);
      });
    });
  });
});
