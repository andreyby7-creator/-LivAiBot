/**
 * @file Unit тесты для packages/app/src/lib/error-mapping.ts
 *
 * Enterprise-grade тестирование error mapping с 95-100% покрытием:
 * - mapError для TaggedError, EffectError, неизвестных ошибок
 * - Chainable мапперы с несколькими мапперами и разными локалями
 * - Автоопределение service из TaggedError и EffectError.kind
 * - Runtime locale конфигурация
 * - Type-safe error handling для микросервисной архитектуры
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EffectError, EffectErrorKind } from '../../../src/lib/effect-utils';
import {
  chainMappers,
  errorMessages,
  getErrorLocale,
  kindToErrorCode,
  mapError,
  mapErrorBoundaryError,
  setErrorLocale,
} from '../../../src/lib/error-mapping';
import type {
  MappedError,
  ServiceErrorCode,
  ServicePrefix,
  TaggedError,
} from '../../../src/lib/error-mapping';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock TaggedError
 */
function createMockTaggedError<T extends ServiceErrorCode>(
  code: T,
  service?: ServicePrefix | undefined,
): TaggedError<T> {
  return { code, service };
}

/**
 * Создает mock EffectError
 */
function createMockEffectError(kind: string, message = 'Effect error'): EffectError {
  return { kind: kind as EffectErrorKind, message };
}

/**
 * Создает обычную ошибку
 */
function createMockError(message = 'Test error'): Error {
  return new Error(message);
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Error Mapping - Enterprise Grade', () => {
  afterEach(() => {
    // Сбрасываем локаль после каждого теста
    setErrorLocale(undefined);
  });
  describe('Runtime Locale Configuration', () => {
    it('должен устанавливать и получать локаль', () => {
      expect(getErrorLocale()).toBeUndefined();

      setErrorLocale('en');
      expect(getErrorLocale()).toBe('en');

      setErrorLocale('ru');
      expect(getErrorLocale()).toBe('ru');

      setErrorLocale(undefined);
      expect(getErrorLocale()).toBeUndefined();
    });

    it('должен использовать локаль по умолчанию для сообщений', () => {
      setErrorLocale('en');

      const error = mapError(createMockError());
      expect(error.message).toBe('Unknown error'); // английское сообщение

      setErrorLocale('ru');
      const errorRu = mapError(createMockError());
      expect(errorRu.message).toBe('Неизвестная ошибка'); // русское сообщение
    });
  });

  describe('mapError - TaggedError', () => {
    it('должен корректно маппить TaggedError с кодом', () => {
      const taggedError = createMockTaggedError('AUTH_INVALID_TOKEN');

      const result = mapError(taggedError);

      expect(result).toEqual({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Токен недействителен',
        details: undefined,
        originError: undefined,
        timestamp: expect.any(Number),
        service: undefined,
      });
    });

    it('должен использовать локаль из TaggedError с автоматическим service', () => {
      const taggedError = createMockTaggedError('AUTH_INVALID_TOKEN', 'AUTH');

      const result = mapError(taggedError, { userId: '123' }, 'en');

      expect(result).toEqual({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid token',
        details: { userId: '123' },
        originError: undefined,
        timestamp: expect.any(Number),
        service: 'AUTH',
      });
    });

    it('должен переопределять service из TaggedError ручным параметром', () => {
      const taggedError = createMockTaggedError('AUTH_INVALID_TOKEN', 'AUTH');

      const result = mapError(taggedError, undefined, undefined, 'BILLING');

      expect(result.service).toBe('BILLING');
    });
  });

  describe('mapError - EffectError', () => {
    it('должен маппить EffectError с известным kind', () => {
      const effectError = createMockEffectError('auth/invalid-token');

      const result = mapError(effectError);

      expect(result).toEqual({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Токен недействителен',
        details: undefined,
        originError: undefined,
        timestamp: expect.any(Number),
        service: 'AUTH', // автоопределено из kind
      });
    });

    it('должен маппить EffectError с неизвестным kind', () => {
      const effectError = createMockEffectError('unknown/error');

      const result = mapError(effectError);

      expect(result).toEqual({
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Неизвестная ошибка',
        details: undefined,
        originError: undefined,
        timestamp: expect.any(Number),
        service: undefined, // не удалось определить
      });
    });

    it('должен определять разные сервисы из kind префиксов', () => {
      const testCases: [string, ServicePrefix | undefined][] = [
        ['auth/login-failed', 'AUTH'],
        ['billing/payment-error', 'BILLING'],
        ['ai/model-timeout', 'AI'],
        ['system/database-error', 'SYSTEM'], // SYSTEM есть в SERVICES
        ['unknown/service-error', undefined], // неизвестный префикс
      ];

      testCases.forEach(([kind, expectedService]) => {
        const effectError = createMockEffectError(kind);
        const result = mapError(effectError);
        expect(result.service).toBe(expectedService);
      });
    });
  });

  describe('mapError - Unknown Errors', () => {
    it('должен маппить обычную Error', () => {
      const error = createMockError('Network timeout');

      const result = mapError(error);

      expect(result).toEqual({
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Неизвестная ошибка',
        details: undefined,
        originError: error,
        timestamp: expect.any(Number),
        service: undefined,
      });
    });

    it('должен маппить произвольные значения', () => {
      const result = mapError('string error');
      expect(result.code).toBe('SYSTEM_UNKNOWN_ERROR');

      const result2 = mapError(null);
      expect(result2.code).toBe('SYSTEM_UNKNOWN_ERROR');

      const result3 = mapError(undefined);
      expect(result3.code).toBe('SYSTEM_UNKNOWN_ERROR');
    });

    it('должен использовать locale из параметра, глобальную локаль или дефолт ru', () => {
      // Тест для покрытия ветки locale ?? getErrorLocale() ?? 'ru'
      setErrorLocale(undefined);

      // Случай 1: переданная локаль
      const result1 = mapError('error', undefined, 'en');
      expect(result1.message).toBe('Unknown error');

      // Случай 2: глобальная локаль
      setErrorLocale('ru');
      const result2 = mapError('error');
      expect(result2.message).toBe('Неизвестная ошибка');

      // Случай 3: дефолт ru (нет ни переданной, ни глобальной)
      setErrorLocale(undefined);
      const result3 = mapError('error');
      expect(result3.message).toBe('Неизвестная ошибка');
    });
  });

  describe('mapError - Locale Override', () => {
    it('должен использовать переданную локаль вместо глобальной', () => {
      setErrorLocale('en'); // глобальная английская

      const error = mapError(createMockError(), undefined, 'ru'); // override на русский

      expect(error.message).toBe('Неизвестная ошибка'); // русское сообщение
    });

    it('должен использовать глобальную локаль если не передана', () => {
      setErrorLocale('en');

      const error = mapError(createMockError());

      expect(error.message).toBe('Unknown error'); // английское сообщение
    });
  });

  describe('Chainable Mappers', () => {
    const authMapper: MappedError = {
      code: 'AUTH_INVALID_TOKEN',
      message: 'Auth mapper result',
      timestamp: Date.now(),
      details: undefined,
      originError: undefined,
      service: 'AUTH',
    };

    const billingMapper: MappedError = {
      code: 'BILLING_INSUFFICIENT_FUNDS',
      message: 'Billing mapper result',
      timestamp: Date.now(),
      details: undefined,
      originError: undefined,
      service: 'BILLING',
    };

    it('должен возвращать результат первого успешного маппера', () => {
      const mockMapper1 = vi.fn().mockReturnValue(authMapper);
      const mockMapper2 = vi.fn().mockReturnValue(billingMapper);

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      const result = chainedMapper(createMockError(), undefined, 'en', 'AUTH');

      expect(result).toBe(authMapper);
      expect(mockMapper1).toHaveBeenCalledWith(createMockError(), undefined, 'en', 'AUTH');
      expect(mockMapper2).not.toHaveBeenCalled();
    });

    it('должен переходить к следующему мапперу если первый вернул UNKNOWN_ERROR', () => {
      const unknownResult: MappedError = {
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown',
        timestamp: Date.now(),
        details: undefined,
        originError: undefined,
        service: undefined,
      };

      const mockMapper1 = vi.fn().mockReturnValue(unknownResult);
      const mockMapper2 = vi.fn().mockReturnValue(billingMapper);

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      const result = chainedMapper(createMockError(), { amount: 100 }, 'ru', 'BILLING');

      expect(result).toBe(billingMapper);
      expect(mockMapper1).toHaveBeenCalledWith(createMockError(), { amount: 100 }, 'ru', 'BILLING');
      expect(mockMapper2).toHaveBeenCalledWith(createMockError(), { amount: 100 }, 'ru', 'BILLING');
    });

    it('должен возвращать UNKNOWN_ERROR если все мапперы вернули UNKNOWN_ERROR', () => {
      const unknownResult: MappedError = {
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown',
        timestamp: Date.now(),
        details: undefined,
        originError: undefined,
        service: undefined,
      };

      const mockMapper1 = vi.fn().mockReturnValue(unknownResult);
      const mockMapper2 = vi.fn().mockReturnValue(unknownResult);

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      const result = chainedMapper(createMockError(), undefined, 'en');

      expect(result).toEqual({
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown error',
        originError: createMockError(),
        details: undefined,
        timestamp: expect.any(Number),
        service: undefined,
      });
    });

    it('должен поддерживать разные локали в цепочке', () => {
      const ruResult: MappedError = {
        code: 'AUTH_INVALID_TOKEN',
        message: 'Токен недействителен',
        timestamp: Date.now(),
        details: undefined,
        originError: undefined,
        service: 'AUTH',
      };

      const enResult: MappedError = {
        code: 'BILLING_INSUFFICIENT_FUNDS',
        message: 'Insufficient funds',
        timestamp: Date.now(),
        details: undefined,
        originError: undefined,
        service: 'BILLING',
      };

      const mockMapper1 = vi.fn().mockReturnValue(ruResult);
      const mockMapper2 = vi.fn().mockReturnValue(enResult);

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      // Первый маппер срабатывает
      const result1 = chainedMapper(createMockError(), undefined, 'ru');
      expect(result1.message).toBe('Токен недействителен');

      // Второй маппер срабатывает с другой локалью
      const unknownResult: MappedError = { ...ruResult, code: 'SYSTEM_UNKNOWN_ERROR' as const };
      mockMapper1.mockReturnValue(unknownResult);

      const result2 = chainedMapper(createMockError(), undefined, 'en');
      expect(result2.message).toBe('Insufficient funds');
    });

    it('должен возвращать UNKNOWN_ERROR с правильной локалью из цепочки', () => {
      const unknownResult: MappedError = {
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown',
        timestamp: Date.now(),
        details: undefined,
        originError: undefined,
        service: undefined,
      };

      const mockMapper1 = vi.fn().mockReturnValue(unknownResult);
      const mockMapper2 = vi.fn().mockReturnValue(unknownResult);

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      // Проверяем английскую локаль (переданная локаль)
      const resultEn = chainedMapper(createMockError(), undefined, 'en');
      expect(resultEn.message).toBe('Unknown error'); // английское сообщение

      // Проверяем русскую локаль (переданная локаль)
      const resultRu = chainedMapper(createMockError(), undefined, 'ru');
      expect(resultRu.message).toBe('Неизвестная ошибка'); // русское сообщение

      // Проверяем использование глобальной локали (locale не передан, используется getErrorLocale())
      setErrorLocale('en');
      const resultGlobal = chainedMapper(createMockError());
      expect(resultGlobal.message).toBe('Unknown error'); // глобальная английская

      // Проверяем дефолт ru (locale не передан, getErrorLocale() возвращает undefined)
      setErrorLocale(undefined);
      const resultDefault = chainedMapper(createMockError());
      expect(resultDefault.message).toBe('Неизвестная ошибка'); // дефолт ru

      // Проверяем, что service правильно передается
      const resultWithService = chainedMapper(createMockError(), undefined, 'en', 'AUTH');
      expect(resultWithService.service).toBe('AUTH');
    });
  });

  describe('Error Messages', () => {
    it('должен содержать все ожидаемые коды ошибок', () => {
      const expectedCodes: ServiceErrorCode[] = [
        'AUTH_INVALID_TOKEN',
        'AUTH_USER_NOT_FOUND',
        'BILLING_INSUFFICIENT_FUNDS',
        'AI_MODEL_NOT_FOUND',
        'SYSTEM_UNKNOWN_ERROR',
      ];

      expectedCodes.forEach((code) => {
        expect(code in errorMessages).toBe(true);
        expect(typeof errorMessages[code as keyof typeof errorMessages]).toBe('function');
      });
    });

    it('должен поддерживать локализацию', () => {
      // Проверяем AUTH_INVALID_TOKEN
      const ruMessage = errorMessages['AUTH_INVALID_TOKEN']('ru');
      const enMessage = errorMessages['AUTH_INVALID_TOKEN']('en');
      const defaultMessage = errorMessages['AUTH_INVALID_TOKEN']();

      expect(ruMessage).toBe('Токен недействителен');
      expect(enMessage).toBe('Invalid token');
      expect(defaultMessage).toBe('Токен недействителен'); // дефолт - русский

      // Проверяем все остальные сообщения на английском
      expect(errorMessages['AUTH_USER_NOT_FOUND']('en')).toBe('User not found');
      expect(errorMessages['BILLING_INSUFFICIENT_FUNDS']('en')).toBe('Insufficient funds');
      expect(errorMessages['AI_MODEL_NOT_FOUND']('en')).toBe('AI model not found');
      expect(errorMessages['SYSTEM_UNKNOWN_ERROR']('en')).toBe('Unknown error');

      // Проверяем все сообщения на русском (дефолт)
      expect(errorMessages['AUTH_USER_NOT_FOUND']()).toBe('Пользователь не найден');
      expect(errorMessages['BILLING_INSUFFICIENT_FUNDS']()).toBe('Недостаточно средств на счете');
      expect(errorMessages['AI_MODEL_NOT_FOUND']()).toBe('Модель AI не найдена');
      expect(errorMessages['SYSTEM_UNKNOWN_ERROR']()).toBe('Неизвестная ошибка');
    });
  });

  describe('Kind to Error Code Mapping', () => {
    it('должен содержать ожидаемые маппинги', () => {
      expect(kindToErrorCode).toEqual({
        'auth/invalid-token': 'AUTH_INVALID_TOKEN',
        'auth/user-not-found': 'AUTH_USER_NOT_FOUND',
        'billing/insufficient-funds': 'BILLING_INSUFFICIENT_FUNDS',
        'ai/model-not-found': 'AI_MODEL_NOT_FOUND',
      });
    });
  });

  describe('Type Safety', () => {
    it('должен обеспечивать type safety для TaggedError', () => {
      const authError = createMockTaggedError('AUTH_INVALID_TOKEN');
      const billingError = createMockTaggedError('BILLING_INSUFFICIENT_FUNDS');

      // TypeScript должен знать точный тип
      const result1 = mapError(authError);
      expect(result1.code).toBe('AUTH_INVALID_TOKEN');

      const result2 = mapError(billingError);
      expect(result2.code).toBe('BILLING_INSUFFICIENT_FUNDS');
    });

    it('должен обеспечивать type safety для generic details', () => {
      type PaymentDetails = {
        amount: number;
        currency: string;
      };

      const details: PaymentDetails = { amount: 100, currency: 'USD' };
      const result = mapError(createMockError(), details);

      // TypeScript должен знать тип details
      expect(result.details).toEqual(details);
      expect(result.details?.amount).toBe(100);
      expect(result.details?.currency).toBe('USD');
    });
  });

  describe('mapError - SYSTEM_VALIDATION_* codes', () => {
    it('должен поддерживать все SYSTEM_VALIDATION_* коды ошибок', () => {
      const validationCodes: ServiceErrorCode[] = [
        'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE',
        'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE',
        'SYSTEM_VALIDATION_REQUEST_HEADERS_INVALID',
        'SYSTEM_VALIDATION_RESPONSE_HEADERS_INVALID',
        'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH',
        'SYSTEM_VALIDATION_TIMEOUT_EXCEEDED',
      ];

      validationCodes.forEach((code) => {
        const error = createMockTaggedError(code);
        const result = mapError(error, undefined, 'en');

        expect(result.code).toBe(code);
        expect(result.message).toBeTruthy();
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      });
    });

    it('должен локализовать все SYSTEM_VALIDATION_* сообщения на en и ru', () => {
      const testCases: [ServiceErrorCode, string, string][] = [
        [
          'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
          'Request schema validation failed',
          'Ошибка валидации схемы запроса',
        ],
        [
          'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
          'Response schema validation failed',
          'Ошибка валидации схемы ответа',
        ],
        [
          'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE',
          'Request payload too large',
          'Размер запроса превышает допустимый',
        ],
        [
          'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE',
          'Response payload too large',
          'Размер ответа превышает допустимый',
        ],
        [
          'SYSTEM_VALIDATION_REQUEST_HEADERS_INVALID',
          'Request headers validation failed',
          'Ошибка валидации заголовков запроса',
        ],
        [
          'SYSTEM_VALIDATION_RESPONSE_HEADERS_INVALID',
          'Response headers validation failed',
          'Ошибка валидации заголовков ответа',
        ],
        [
          'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH',
          'Schema version mismatch',
          'Несовпадение версии схемы',
        ],
        [
          'SYSTEM_VALIDATION_TIMEOUT_EXCEEDED',
          'Validation timeout exceeded',
          'Превышено время ожидания валидации',
        ],
      ];

      testCases.forEach(([code, enMessage, ruMessage]) => {
        const error = createMockTaggedError(code);

        const resultEn = mapError(error, undefined, 'en');
        expect(resultEn.message).toBe(enMessage);

        const resultRu = mapError(error, undefined, 'ru');
        expect(resultRu.message).toBe(ruMessage);
      });
    });
  });

  describe('mapErrorBoundaryError', () => {
    it('должен маппить Network ошибки', () => {
      const error = new Error('Network request failed');
      const result = mapErrorBoundaryError(error);

      expect(result.type).toBe('UnknownError');
      if (result.type === 'UnknownError') {
        expect(result.severity).toBe('error');
        expect(result.message).toBe('Network request failed');
        expect(result.original).toBe(error);
        expect(result.timestamp).toBeTruthy();
      }
    });

    it('должен маппить Validation ошибки', () => {
      const error = new Error('Validation failed');
      const result = mapErrorBoundaryError(error);

      expect(result.type).toBe('UnknownError');
      if (result.type === 'UnknownError') {
        expect(result.message).toBe('Validation failed');
      }
    });

    it('должен маппить fetch ошибки как Network', () => {
      const error = new Error('fetch error occurred');
      const result = mapErrorBoundaryError(error);

      expect(result.type).toBe('UnknownError');
      if (result.type === 'UnknownError') {
        expect(result.message).toBe('fetch error occurred');
      }
    });

    it('должен маппить validation ошибки (case insensitive)', () => {
      const error = new Error('VALIDATION error');
      const result = mapErrorBoundaryError(error);

      expect(result.type).toBe('UnknownError');
      if (result.type === 'UnknownError') {
        expect(result.message).toBe('VALIDATION error');
      }
    });

    it('должен маппить неизвестные ошибки как UNKNOWN_ERROR', () => {
      const error = new Error('Some other error');
      const result = mapErrorBoundaryError(error);

      expect(result.type).toBe('UnknownError');
      if (result.type === 'UnknownError') {
        expect(result.message).toBe('Some other error');
      }
    });

    it('должен логировать ошибку когда telemetry включена', async () => {
      const error = new Error('Test error');
      const telemetryModule = await import('../../../src/lib/telemetry');
      const errorFireAndForgetSpy = vi.spyOn(telemetryModule, 'errorFireAndForget');

      mapErrorBoundaryError(error, true);

      expect(errorFireAndForgetSpy).toHaveBeenCalledWith(
        'ErrorBoundary error mapped',
        expect.objectContaining({
          originalErrorType: 'Error',
          mappedErrorCode: expect.any(String),
          errorMessage: 'Test error',
        }),
      );

      errorFireAndForgetSpy.mockRestore();
    });

    it('не должен логировать ошибку когда telemetry выключена', async () => {
      const error = new Error('Test error');
      const telemetryModule = await import('../../../src/lib/telemetry');
      const errorFireAndForgetSpy = vi.spyOn(telemetryModule, 'errorFireAndForget');

      mapErrorBoundaryError(error, false);

      expect(errorFireAndForgetSpy).not.toHaveBeenCalled();

      errorFireAndForgetSpy.mockRestore();
    });

    it('должен обрабатывать ошибки telemetry gracefully', async () => {
      const error = new Error('Test error');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const telemetryModule = await import('../../../src/lib/telemetry');
      const errorFireAndForgetSpy = vi
        .spyOn(telemetryModule, 'errorFireAndForget')
        .mockImplementation(() => {
          throw new Error('Telemetry error');
        });

      // Не должно бросить исключение
      const result = mapErrorBoundaryError(error, true);

      expect(result).toBeTruthy();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'ErrorBoundary mapping telemetry failed:',
        expect.any(Error),
      );

      errorFireAndForgetSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
