/**
 * @file GenericAPIError.test.ts - Тесты для универсальной ошибки API
 */

import { describe, expect, it } from 'vitest';

import {
  createGenericAPIError,
  createGenericAPIErrorFromResponse,
  getGenericAPIErrorCorrelationId,
  getGenericAPIErrorHttpStatus,
  getGenericAPIErrorMessage,
  getGenericAPIErrorProvider,
  getGenericAPIErrorRawResponse,
  isGenericAPIError,
  isValidGenericAPIErrorContext,
} from '../../../../../../src/errors/services/billing-service/infrastructure/GenericAPIError.js';

import type {
  GenericAPIError,
  GenericAPIErrorContext,
} from '../../../../../../src/errors/services/billing-service/infrastructure/GenericAPIError.js';

import type { PaymentProviderId } from '../../../../../../src/errors/shared/PaymentProviderId.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock GenericAPIErrorContext для тестов */
function createMockGenericAPIErrorContext(
  overrides: Partial<GenericAPIErrorContext> = {},
): GenericAPIErrorContext {
  return {
    provider: 'webpay' as const as PaymentProviderId,
    httpStatus: 500,
    rawResponse: { error: 'Internal Server Error' },
    errorMessage: 'API request failed',
    correlationId: 'test-correlation-id',
    ...overrides,
  };
}

/** Создает mock GenericAPIError для тестов */
function createMockGenericAPIError(
  overrides: Partial<GenericAPIError> = {},
): GenericAPIError {
  const context = createMockGenericAPIErrorContext();
  const error = createGenericAPIError('Test error', context);

  return {
    ...error,
    ...overrides,
  };
}

// ==================== TESTS ====================

describe('GenericAPIError', () => {
  describe('createGenericAPIError', () => {
    it('создает валидную GenericAPIError с полным контекстом', () => {
      const context = createMockGenericAPIErrorContext();
      const error = createGenericAPIError('API request failed', context);

      expect(error._tag).toBe('GenericAPIError');
      expect(error.category).toBe('SYSTEM');
      expect(error.origin).toBe('INFRASTRUCTURE');
      expect(error.severity).toBe('high');
      expect(error.code).toBe('SERVICE_BILLING_109');
      expect(error.message).toBe('API request failed');
      expect(error.details).toEqual(context);
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
    });

    it('создает ошибку с минимальным контекстом', () => {
      const minimalContext: GenericAPIErrorContext = {
        provider: 'bepaid' as const as PaymentProviderId,
      };

      const error = createGenericAPIError('Minimal error', minimalContext);

      expect(error._tag).toBe('GenericAPIError');
      expect(error.message).toBe('Minimal error');
      expect(error.details?.provider).toBe('bepaid');
      expect(error.details?.httpStatus).toBeUndefined();
      expect(error.details?.rawResponse).toBeUndefined();
      expect(error.details?.errorMessage).toBeUndefined();
      expect(error.details?.correlationId).toBeUndefined();
    });

    it('генерирует timestamp если не предоставлен', () => {
      const context = createMockGenericAPIErrorContext();
      const error = createGenericAPIError('Test', context);

      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');

      // Проверяем что timestamp выглядит как ISO строка
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('использует предоставленный timestamp', () => {
      const context = createMockGenericAPIErrorContext();
      const customTimestamp = '2024-01-01T12:00:00.000Z';

      const error = createGenericAPIError('Test', context, customTimestamp);

      expect(error.timestamp).toBe(customTimestamp);
    });
  });

  describe('isValidGenericAPIErrorContext', () => {
    it('возвращает true для валидного контекста с полными полями', () => {
      const context = createMockGenericAPIErrorContext();
      expect(isValidGenericAPIErrorContext(context)).toBe(true);
    });

    it('возвращает true для валидного контекста с минимальными полями', () => {
      const minimalContext: GenericAPIErrorContext = {
        provider: 'webpay' as const as PaymentProviderId,
      };
      expect(isValidGenericAPIErrorContext(minimalContext)).toBe(true);
    });

    it('возвращает false для null/undefined', () => {
      expect(isValidGenericAPIErrorContext(null)).toBe(false);
      expect(isValidGenericAPIErrorContext(undefined)).toBe(false);
    });

    it('возвращает false для не-объектов', () => {
      expect(isValidGenericAPIErrorContext('string')).toBe(false);
      expect(isValidGenericAPIErrorContext(123)).toBe(false);
      expect(isValidGenericAPIErrorContext([])).toBe(false);
    });

    it('валидирует provider - обязательное поле', () => {
      const context = createMockGenericAPIErrorContext();
      delete (context as any).provider;

      expect(isValidGenericAPIErrorContext(context)).toBe(false);
    });

    it('валидирует provider - должен быть валидным PaymentProviderId', () => {
      const context = createMockGenericAPIErrorContext();
      (context as any).provider =
        'invalid-provider-name-that-is-way-too-long-and-exceeds-maximum-allowed-length';

      expect(isValidGenericAPIErrorContext(context)).toBe(false);
    });

    it('валидирует httpStatus - должен быть числом в диапазоне 100-599', () => {
      // Валидные статусы
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 200 }),
      ).toBe(true);
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 404 }),
      ).toBe(true);
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 500 }),
      ).toBe(true);
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 100 }),
      ).toBe(true);
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 599 }),
      ).toBe(true);

      // Невалидные статусы
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 99 }),
      ).toBe(false);
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 600 }),
      ).toBe(false);
      expect(
        isValidGenericAPIErrorContext({ ...createMockGenericAPIErrorContext(), httpStatus: 200.5 }),
      ).toBe(false);
      expect(
        isValidGenericAPIErrorContext({
          ...createMockGenericAPIErrorContext(),
          httpStatus: '404' as any,
        }),
      ).toBe(false);
    });

    it('валидирует опциональные строковые поля', () => {
      // errorMessage
      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        errorMessage: 'Valid message',
      })).toBe(true);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        errorMessage: 123 as any,
      })).toBe(false);

      // correlationId
      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        correlationId: 'valid-id-123',
      })).toBe(true);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        correlationId: 456 as any,
      })).toBe(false);
    });

    it('принимает любой тип для rawResponse', () => {
      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        rawResponse: { any: 'object' },
      })).toBe(true);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        rawResponse: 'string response',
      })).toBe(true);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        rawResponse: null,
      })).toBe(true);
    });

    it('проверяет что httpStatus должен быть целым числом', () => {
      // Невалидные - не целые числа
      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: 200.5,
      })).toBe(false);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: 404.9,
      })).toBe(false);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: NaN,
      })).toBe(false);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: Infinity,
      })).toBe(false);
    });
  });

  describe('isGenericAPIError', () => {
    it('возвращает true для валидной GenericAPIError', () => {
      const error = createMockGenericAPIError();
      expect(isGenericAPIError(error)).toBe(true);
    });

    it('возвращает false для других типов ошибок', () => {
      expect(isGenericAPIError(null)).toBe(false);
      expect(isGenericAPIError(undefined)).toBe(false);
      expect(isGenericAPIError('string')).toBe(false);
      expect(isGenericAPIError(123)).toBe(false);
      expect(isGenericAPIError({})).toBe(false);
    });

    it('проверяет _tag', () => {
      const error = createMockGenericAPIError();
      (error as any)._tag = 'WrongTag';

      expect(isGenericAPIError(error)).toBe(false);
    });

    it('проверяет code', () => {
      const error = createMockGenericAPIError();
      (error as any).code = 'WRONG_CODE';

      expect(isGenericAPIError(error)).toBe(false);
    });

    it('проверяет наличие details (опционально)', () => {
      // Без details - все равно валидно
      const errorWithoutDetails = createGenericAPIError('Test', {
        provider: 'webpay' as const as PaymentProviderId,
      });
      expect(isGenericAPIError(errorWithoutDetails)).toBe(true);

      // С details - проверяет валидность
      const errorWithDetails = createMockGenericAPIError();
      expect(isGenericAPIError(errorWithDetails)).toBe(true);
    });

    it('проверяет валидность details если они присутствуют', () => {
      const error = createMockGenericAPIError();
      (error.details as any).provider =
        'invalid-provider-name-that-is-way-too-long-and-exceeds-maximum-allowed-length';

      expect(isGenericAPIError(error)).toBe(false);
    });

    it('работает с type narrowing', () => {
      const errors: unknown[] = [
        createMockGenericAPIError(),
        'not an error',
        null,
      ];

      const validErrors = errors.filter(isGenericAPIError);

      expect(validErrors).toHaveLength(1);
      expect(validErrors[0]).toHaveProperty('_tag', 'GenericAPIError');
    });
  });

  describe('Getter functions', () => {
    describe('getGenericAPIErrorProvider', () => {
      it('возвращает provider из ошибки', () => {
        const error = createMockGenericAPIError();
        expect(getGenericAPIErrorProvider(error)).toBe('webpay');
      });

      it('возвращает undefined если details отсутствуют', () => {
        const error = createGenericAPIError('Test', {
          provider: 'webpay' as const as PaymentProviderId,
        });
        delete (error as any).details;

        expect(getGenericAPIErrorProvider(error)).toBeUndefined();
      });
    });

    describe('getGenericAPIErrorHttpStatus', () => {
      it('возвращает httpStatus из ошибки', () => {
        const error = createMockGenericAPIError();
        expect(getGenericAPIErrorHttpStatus(error)).toBe(500);
      });

      it('возвращает undefined если httpStatus не указан', () => {
        const error = createGenericAPIError('Test', {
          provider: 'webpay' as const as PaymentProviderId,
        });
        expect(getGenericAPIErrorHttpStatus(error)).toBeUndefined();
      });

      it('возвращает undefined если details отсутствуют', () => {
        const error = createGenericAPIError('Test', {
          provider: 'webpay' as const as PaymentProviderId,
        });
        delete (error as any).details;

        expect(getGenericAPIErrorHttpStatus(error)).toBeUndefined();
      });
    });

    describe('getGenericAPIErrorRawResponse', () => {
      it('возвращает rawResponse из ошибки', () => {
        const error = createMockGenericAPIError();
        expect(getGenericAPIErrorRawResponse(error)).toEqual({ error: 'Internal Server Error' });
      });

      it('возвращает undefined если rawResponse не указан', () => {
        const error = createGenericAPIError('Test', {
          provider: 'webpay' as const as PaymentProviderId,
        });
        expect(getGenericAPIErrorRawResponse(error)).toBeUndefined();
      });
    });

    describe('getGenericAPIErrorMessage', () => {
      it('возвращает errorMessage из ошибки', () => {
        const error = createMockGenericAPIError();
        expect(getGenericAPIErrorMessage(error)).toBe('API request failed');
      });

      it('возвращает undefined если errorMessage не указан', () => {
        const error = createGenericAPIError('Test', {
          provider: 'webpay' as const as PaymentProviderId,
        });
        expect(getGenericAPIErrorMessage(error)).toBeUndefined();
      });
    });

    describe('getGenericAPIErrorCorrelationId', () => {
      it('возвращает correlationId из ошибки', () => {
        const error = createMockGenericAPIError();
        expect(getGenericAPIErrorCorrelationId(error)).toBe('test-correlation-id');
      });

      it('возвращает undefined если correlationId не указан', () => {
        const error = createGenericAPIError('Test', {
          provider: 'webpay' as const as PaymentProviderId,
        });
        expect(getGenericAPIErrorCorrelationId(error)).toBeUndefined();
      });
    });
  });

  describe('Integration tests', () => {
    it('полный цикл: создание -> валидация -> type guard -> getters', () => {
      // Создание
      const context = createMockGenericAPIErrorContext();
      const error = createGenericAPIError('Integration test', context);

      // Валидация контекста
      expect(isValidGenericAPIErrorContext(context)).toBe(true);

      // Type guard
      expect(isGenericAPIError(error)).toBe(true);

      // Getters
      expect(getGenericAPIErrorProvider(error)).toBe('webpay');
      expect(getGenericAPIErrorHttpStatus(error)).toBe(500);
      expect(getGenericAPIErrorRawResponse(error)).toEqual({ error: 'Internal Server Error' });
      expect(getGenericAPIErrorMessage(error)).toBe('API request failed');
      expect(getGenericAPIErrorCorrelationId(error)).toBe('test-correlation-id');
    });

    it('работает с реальными API response данными', () => {
      // Симуляция типичного API ответа с ошибкой
      const apiResponse = {
        status: 429,
        body: {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          correlationId: 'req-12345',
        },
      };

      const context: GenericAPIErrorContext = {
        provider: 'webpay' as const as PaymentProviderId,
        httpStatus: apiResponse.status,
        rawResponse: apiResponse,
        errorMessage: apiResponse.body.message,
        correlationId: apiResponse.body.correlationId,
      };

      const error = createGenericAPIError('Rate limit exceeded', context);

      expect(isValidGenericAPIErrorContext(context)).toBe(true);
      expect(isGenericAPIError(error)).toBe(true);
      expect(getGenericAPIErrorHttpStatus(error)).toBe(429);
      expect(getGenericAPIErrorMessage(error)).toBe('Rate limit exceeded');
    });
  });

  describe('createGenericAPIErrorFromResponse', () => {
    it('создает ошибку из простого объекта response со status', () => {
      const response = { status: 500, message: 'Server Error' };
      const error = createGenericAPIErrorFromResponse(
        'webpay' as const as PaymentProviderId,
        response,
      );

      expect(error._tag).toBe('GenericAPIError');
      expect(error.details?.httpStatus).toBe(500);
      expect(error.details?.errorMessage).toBe('Server Error');
      expect(error.details?.rawResponse).toBe(response);
      expect(error.details?.provider).toBe('webpay');
    });

    it('создает ошибку из response с error полем вместо message', () => {
      const response = { status: 404, error: 'Not Found' };
      const error = createGenericAPIErrorFromResponse(
        'bepaid' as const as PaymentProviderId,
        response,
      );

      expect(error.details?.httpStatus).toBe(404);
      expect(error.details?.errorMessage).toBe('Not Found');
    });

    it('создает ошибку из response без status и message', () => {
      const response = { someField: 'someValue' };
      const error = createGenericAPIErrorFromResponse(
        'webpay' as const as PaymentProviderId,
        response,
      );

      expect(error.details?.httpStatus).toBeUndefined();
      expect(error.details?.errorMessage).toBeUndefined();
      expect(error.details?.rawResponse).toBe(response);
    });

    it('создает ошибку из не-объектного response', () => {
      const response = 'plain text error';
      const error = createGenericAPIErrorFromResponse(
        'webpay' as const as PaymentProviderId,
        response,
      );

      expect(error.details?.httpStatus).toBeUndefined();
      expect(error.details?.errorMessage).toBeUndefined();
      expect(error.details?.rawResponse).toBe(response);
    });

    it('создает ошибку из null response', () => {
      const response = null;
      const error = createGenericAPIErrorFromResponse(
        'webpay' as const as PaymentProviderId,
        response,
      );

      expect(error.details?.httpStatus).toBeUndefined();
      expect(error.details?.errorMessage).toBeUndefined();
      expect(error.details?.rawResponse).toBe(response);
    });

    it('использует предоставленный correlationId', () => {
      const response = { status: 429 };
      const correlationId = 'req-12345';
      const error = createGenericAPIErrorFromResponse(
        'webpay' as const as PaymentProviderId,
        response,
        correlationId,
      );

      expect(error.details?.correlationId).toBe(correlationId);
    });

    it('генерирует правильное сообщение об ошибке', () => {
      const response = {};
      const error = createGenericAPIErrorFromResponse(
        'test-provider' as const as PaymentProviderId,
        response,
      );

      expect(error.message).toBe('Unable to parse API response from test-provider');
    });
  });

  describe('Edge cases', () => {
    it('обрабатывает пустые строки в опциональных полях', () => {
      const context: GenericAPIErrorContext = {
        provider: 'webpay' as const as PaymentProviderId,
        errorMessage: '',
        correlationId: '',
      };

      expect(isValidGenericAPIErrorContext(context)).toBe(true);
    });

    it('обрабатывает null в rawResponse', () => {
      const context: GenericAPIErrorContext = {
        provider: 'webpay' as const as PaymentProviderId,
        rawResponse: null,
      };

      expect(isValidGenericAPIErrorContext(context)).toBe(true);
      const error = createGenericAPIError('Test', context);
      expect(getGenericAPIErrorRawResponse(error)).toBeNull();
    });

    it('type guard корректно обрабатывает ошибки без details', () => {
      // Создаем ошибку и удаляем details
      const error = createGenericAPIError('Test', {
        provider: 'webpay' as const as PaymentProviderId,
      });
      delete (error as any).details;

      // Должна все равно проходить type guard
      expect(isGenericAPIError(error)).toBe(true);
      expect(getGenericAPIErrorProvider(error)).toBeUndefined();
      expect(getGenericAPIErrorHttpStatus(error)).toBeUndefined();
    });

    it('валидация проходит для всех граничных значений HTTP статусов', () => {
      // Минимум и максимум
      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: 100,
      })).toBe(true);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: 599,
      })).toBe(true);

      // За границами
      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: 99,
      })).toBe(false);

      expect(isValidGenericAPIErrorContext({
        ...createMockGenericAPIErrorContext(),
        httpStatus: 600,
      })).toBe(false);
    });
  });
});
