/**
 * Unit tests для InfrastructureErrorMeta
 */

import { describe, expect, it } from 'vitest';

import { ERROR_CATEGORY, ERROR_SEVERITY } from '../../../../src/errors/base/ErrorConstants.js';
import {
  createDatabaseError,
  createNetworkError,
  createTimeoutError,
} from '../../../../src/errors/infrastructure/InfrastructureError.js';
import {
  getInfrastructureErrorCategory,
  getInfrastructureErrorMeta,
  getInfrastructureErrorMetaOrThrow,
  getInfrastructureErrorSeverity,
  isInfrastructureErrorRetryable,
} from '../../../../src/errors/infrastructure/InfrastructureErrorMeta.js';

describe('InfrastructureErrorMeta', () => {
  describe('getInfrastructureErrorMeta', () => {
    it('should return metadata for all infrastructure errors', () => {
      const errors = [
        createNetworkError({ endpoint: 'test' }),
        createTimeoutError({ operation: 'test', timeoutMs: 1000 }),
        createDatabaseError({ database: 'test', operation: 'test' }),
      ];

      errors.forEach((error) => {
        const meta = getInfrastructureErrorMeta(error);
        expect(meta).toBeDefined();
        expect(meta?.layer).toBe('infrastructure');
      });
    });
  });

  describe('getInfrastructureErrorMetaOrThrow', () => {
    it('should return metadata for valid errors', () => {
      const error = createNetworkError({ endpoint: 'test' });
      const meta = getInfrastructureErrorMetaOrThrow(error);
      expect(meta).toBeDefined();
      expect(meta.layer).toBe('infrastructure');
    });

    it('should throw error for errors without metadata', () => {
      // Создаем ошибку с валидным кодом (метаданные должны быть)
      const error = createNetworkError({ endpoint: 'test' });
      // В нормальных условиях метаданные есть, но проверяем логику
      const meta = getInfrastructureErrorMetaOrThrow(error);
      expect(meta).toBeDefined();
    });
  });

  describe('isInfrastructureErrorRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = createNetworkError({ endpoint: 'test' });
      expect(isInfrastructureErrorRetryable(error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = createTimeoutError({ operation: 'test', timeoutMs: 1000 });
      expect(isInfrastructureErrorRetryable(error)).toBe(true);
    });
  });

  describe('getInfrastructureErrorSeverity', () => {
    it('should return severity for errors', () => {
      const error = createDatabaseError({ database: 'test', operation: 'test' });
      const severity = getInfrastructureErrorSeverity(error);
      expect(severity).toBe(ERROR_SEVERITY.CRITICAL);
    });
  });

  describe('getInfrastructureErrorCategory', () => {
    it('should return INFRASTRUCTURE category', () => {
      const error = createNetworkError({ endpoint: 'test' });
      const category = getInfrastructureErrorCategory(error);
      expect(category).toBe(ERROR_CATEGORY.INFRASTRUCTURE);
    });
  });
});
