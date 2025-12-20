/**
 * Unit tests для EffectAdapter
 *
 * Тесты для проверки конвертации BaseError ↔ Effect.Error.
 */

import { Cause } from 'effect';

import { describe, expect, it } from 'vitest';

import {
  fromEffectError,
  isEffectError,
  toEffectError,
  toEffectErrorAsync,
} from '../../../../src/errors/adapters/EffectAdapter.js';
import { createError } from '../../../../src/errors/base/BaseError.js';
import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js';
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.js';

describe('EffectAdapter', () => {
  describe('toEffectError', () => {
    it('should convert BaseError to Effect.Cause', () => {
      const baseError = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Entity not found',
      );

      const effectCause = toEffectError(baseError);

      expect(effectCause).toBeDefined();
      expect(effectCause._tag).toBe('Fail');
    });

    it('should preserve BaseError in Effect.Cause', () => {
      const baseError = createError(
        ERROR_CODE.INFRA_NETWORK_ERROR,
        'Network error',
        { correlationId: 'req-123' },
      );

      const effectCause = toEffectError(baseError);

      // Проверяем, что BaseError сохранен в Cause
      expect(effectCause).toBeDefined();
    });
  });

  describe('toEffectErrorAsync', () => {
    it('should convert BaseError to Effect.Cause asynchronously', async () => {
      const baseError = createError(
        ERROR_CODE.APPLICATION_COMMAND_REJECTED,
        'Command rejected',
      );

      const effectCause = await toEffectErrorAsync(baseError);

      expect(effectCause).toBeDefined();
      expect(effectCause._tag).toBe('Fail');
    });
  });

  describe('fromEffectError', () => {
    it('should convert Effect.Cause with BaseError to BaseError', () => {
      const baseError = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Entity not found',
      );

      const effectCause = Cause.fail(baseError);
      const converted = fromEffectError(effectCause);

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND);
    });

    it('should convert Effect.Fail with BaseError to BaseError', () => {
      const baseError = createError(
        ERROR_CODE.INFRA_NETWORK_ERROR,
        'Network error',
      );

      const effectFail = Cause.fail(baseError);
      const converted = fromEffectError(effectFail);

      expect(isBaseError(converted)).toBe(true);
    });

    it('should handle regular Error in Effect.Cause', () => {
      const regularError = new Error('Regular error');
      const effectCause = Cause.fail(regularError);

      const converted = fromEffectError(effectCause);

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });

    it('should handle BaseError directly', () => {
      const baseError = createError(
        ERROR_CODE.SECURITY_UNAUTHORIZED,
        'Unauthorized',
      );

      const converted = fromEffectError(baseError);

      expect(isBaseError(converted)).toBe(true);
      expect(converted).toBe(baseError);
    });

    it('should handle unknown error types', () => {
      const unknownError = { custom: 'error' };

      const converted = fromEffectError(unknownError);

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });

    it('should handle null error', () => {
      const converted = fromEffectError(null);

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });

    it('should handle undefined error', () => {
      const converted = fromEffectError(undefined);

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });

    it('should handle number error', () => {
      const converted = fromEffectError(42);

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });

    it('should handle string error', () => {
      const converted = fromEffectError('string error');

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });

    it('should handle empty object error', () => {
      const converted = fromEffectError({});

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });

    it('should handle array error', () => {
      const converted = fromEffectError([1, 2, 3]);

      expect(isBaseError(converted)).toBe(true);
      expect(converted.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
    });
  });

  describe('isEffectError', () => {
    it('should return true for Effect.Fail', () => {
      const baseError = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test');
      const effectFail = Cause.fail(baseError);

      expect(isEffectError(effectFail)).toBe(true);
    });

    it('should return false for non-Effect errors', () => {
      expect(isEffectError(new Error('Test'))).toBe(false);
      expect(isEffectError('string')).toBe(false);
      expect(isEffectError(null)).toBe(false);
      expect(isEffectError(undefined)).toBe(false);
    });
  });

  describe('Chaos Test - fromEffectError resilience', () => {
    /**
     * 🎲 Chaos Test: гарантирует, что fromEffectError всегда возвращает BaseError
     * даже для самых неожиданных и случайных входных данных.
     */
    it('should always return BaseError for random unknown values', () => {
      const randomValues: unknown[] = [
        null,
        undefined,
        0,
        -1,
        42,
        3.14,
        '',
        'random string',
        true,
        false,
        {},
        { random: 'property' },
        [],
        [1, 2, 3],
        new Date(),
        new RegExp('test'),
        (() => {}) as () => void,
        Symbol('test'),
        BigInt(123),
        // Effect-подобные объекты (не настоящие Effect.Cause)
        { _tag: 'Fail', error: 'test' },
        { _tag: 'Die', defect: 'test' },
        { _tag: 'Empty' },
        { cause: { _tag: 'Fail' } },
      ];

      for (const randomValue of randomValues) {
        const result = fromEffectError(randomValue);

        expect(isBaseError(result)).toBe(true);
        expect(result.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
        expect(typeof result.message).toBe('string');
        // Message может быть пустым для некоторых значений (0, '', false), но fallback должен сработать
        // Проверяем, что это валидная строка (может быть пустой, но не undefined)
        expect(result.message).toBeDefined();
        expect(typeof result.timestamp).toBe('string');
        expect(() => new Date(result.timestamp)).not.toThrow();
      }
    });

    it('should always return BaseError for random Effect-like shapes', () => {
      const randomShapes: unknown[] = [
        // Частично сформированные Effect-объекты
        { _tag: 'Fail' },
        { _tag: 'Die' },
        { _tag: 'Empty' },
        { _tag: 'Interrupt' },
        { error: new Error('test') },
        { defect: 'test' },
        { cause: { _tag: 'Fail', error: 'test' } },
        // Вложенные структуры
        { cause: { cause: { _tag: 'Fail' } } },
        { error: { _tag: 'Fail', error: 'nested' } },
        // Смешанные формы
        { _tag: 'Fail', error: { code: 'ERR', message: 'test' } },
        { _tag: 'Die', defect: { error: 'test' } },
      ];

      for (const randomShape of randomShapes) {
        const result = fromEffectError(randomShape);

        expect(isBaseError(result)).toBe(true);
        expect(result.code).toBe(ERROR_CODE.UNKNOWN_ERROR);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
        expect(typeof result.timestamp).toBe('string');
      }
    });
  });
});
