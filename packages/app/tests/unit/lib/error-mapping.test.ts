/**
 * @file Unit тесты для packages/app/src/lib/error-mapping.ts
 * Enterprise-grade тестирование error mapping с 95-100% покрытием:
 * - mapError для TaggedError, EffectError, неизвестных ошибок
 * - Chainable мапперы с несколькими мапперами и разными локалями
 * - Автоопределение service из TaggedError и EffectError.kind
 * - Детерминированность: все параметры передаются явно через config
 * - Type-safe error handling для микросервисной архитектуры
 */

import { describe, expect, it, vi } from 'vitest';
import type { EffectError, EffectErrorKind } from '../../../src/lib/effect-utils';
import {
  chainMappers,
  createDomainError,
  errorMessages,
  kindToErrorCode,
  mapError,
  mapErrorBoundaryError,
} from '../../../src/lib/error-mapping';
import type { ISODateString } from '../../../src/types/common';
import type {
  MapErrorConfig,
  MappedError,
  ServiceErrorCode,
  ServicePrefix,
  TaggedError,
  ValidationErrorLike,
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

/**
 * Создает детерминированный config для mapError
 */
function createConfig(locale = 'ru', timestamp = 1234567890): MapErrorConfig {
  return { locale, timestamp };
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Error Mapping - Enterprise Grade', () => {
  describe('mapError - TaggedError', () => {
    it('должен корректно маппить TaggedError с кодом', () => {
      const taggedError = createMockTaggedError('AUTH_INVALID_TOKEN');
      const config = createConfig();

      const result = mapError(taggedError, undefined, config);

      expect(result).toEqual({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Токен недействителен',
        details: undefined,
        originError: undefined,
        timestamp: 1234567890,
        service: undefined,
      });
    });

    it('должен использовать локаль из config с автоматическим service', () => {
      const taggedError = createMockTaggedError('AUTH_INVALID_TOKEN', 'AUTH');
      const config = createConfig('en');

      const result = mapError(taggedError, { userId: '123' }, config);

      expect(result).toEqual({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid token',
        details: { userId: '123' },
        originError: undefined,
        timestamp: 1234567890,
        service: 'AUTH',
      });
    });

    it('должен переопределять service из TaggedError ручным параметром', () => {
      const taggedError = createMockTaggedError('AUTH_INVALID_TOKEN', 'AUTH');
      const config = createConfig();

      const result = mapError(taggedError, undefined, config, 'BILLING');

      expect(result.service).toBe('BILLING');
    });
  });

  describe('mapError - EffectError', () => {
    it('должен маппить EffectError с известным kind', () => {
      const effectError = createMockEffectError('auth/invalid-token');
      const config = createConfig();

      const result = mapError(effectError, undefined, config);

      expect(result).toEqual({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Токен недействителен',
        details: undefined,
        originError: undefined,
        timestamp: 1234567890,
        service: 'AUTH', // автоопределено из kind
      });
    });

    it('должен маппить EffectError с неизвестным kind', () => {
      const effectError = createMockEffectError('unknown/error');
      const config = createConfig();

      const result = mapError(effectError, undefined, config);

      expect(result).toEqual({
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Неизвестная ошибка',
        details: undefined,
        originError: undefined,
        timestamp: 1234567890,
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
        const config = createConfig();
        const result = mapError(effectError, undefined, config);
        expect(result.service).toBe(expectedService);
      });
    });
  });

  describe('mapError - Unknown Errors', () => {
    it('должен маппить обычную Error с безопасным originError', () => {
      const error = createMockError('Network timeout');
      const config = createConfig();

      const result = mapError(error, undefined, config);

      expect(result).toEqual({
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Неизвестная ошибка',
        details: undefined,
        originError: { name: 'Error', message: 'Network timeout' },
        timestamp: 1234567890,
        service: undefined,
      });
    });

    it('должен маппить произвольные значения', () => {
      const config = createConfig();
      const result = mapError('string error', undefined, config);
      expect(result.code).toBe('SYSTEM_UNKNOWN_ERROR');

      const result2 = mapError(null, undefined, config);
      expect(result2.code).toBe('SYSTEM_UNKNOWN_ERROR');

      const result3 = mapError(undefined, undefined, config);
      expect(result3.code).toBe('SYSTEM_UNKNOWN_ERROR');
    });

    it('должен использовать locale из config или дефолт ru', () => {
      // Случай 1: переданная локаль
      const configEn = createConfig('en');
      const result1 = mapError('error', undefined, configEn);
      expect(result1.message).toBe('Unknown error');

      // Случай 2: дефолт ru (locale не передан)
      const configRu = createConfig();
      const result2 = mapError('error', undefined, configRu);
      expect(result2.message).toBe('Неизвестная ошибка');
    });
  });

  describe('mapError - Locale', () => {
    it('должен использовать переданную локаль из config', () => {
      const config = createConfig('ru');
      const error = mapError(createMockError(), undefined, config);
      expect(error.message).toBe('Неизвестная ошибка'); // русское сообщение
    });

    it('должен использовать дефолт ru если locale не передан', () => {
      const config = createConfig(undefined);
      const error = mapError(createMockError(), undefined, config);
      expect(error.message).toBe('Неизвестная ошибка'); // дефолт ru
    });
  });

  describe('Chainable Mappers', () => {
    const authMapper: MappedError = {
      code: 'AUTH_INVALID_TOKEN',
      message: 'Auth mapper result',
      timestamp: 1234567890,
      details: undefined,
      originError: undefined,
      service: 'AUTH',
    };

    const billingMapper: MappedError = {
      code: 'BILLING_INSUFFICIENT_FUNDS',
      message: 'Billing mapper result',
      timestamp: 1234567890,
      details: undefined,
      originError: undefined,
      service: 'BILLING',
    };

    it('должен возвращать результат первого успешного маппера', () => {
      const mockMapper1 = vi.fn().mockReturnValue(authMapper);
      const mockMapper2 = vi.fn().mockReturnValue(billingMapper);
      const config = createConfig('en');

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      const result = chainedMapper(createMockError(), undefined, config, 'AUTH');

      expect(result).toBe(authMapper);
      expect(mockMapper1).toHaveBeenCalledWith(createMockError(), undefined, config, 'AUTH');
      expect(mockMapper2).not.toHaveBeenCalled();
    });

    it('должен переходить к следующему мапперу если первый вернул UNKNOWN_ERROR', () => {
      const unknownResult: MappedError = {
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown',
        timestamp: 1234567890,
        details: undefined,
        originError: undefined,
        service: undefined,
      };

      const mockMapper1 = vi.fn().mockReturnValue(unknownResult);
      const mockMapper2 = vi.fn().mockReturnValue(billingMapper);
      const config = createConfig('ru');

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      const result = chainedMapper(createMockError(), { amount: 100 }, config, 'BILLING');

      expect(result).toBe(billingMapper);
      expect(mockMapper1).toHaveBeenCalledWith(
        createMockError(),
        { amount: 100 },
        config,
        'BILLING',
      );
      expect(mockMapper2).toHaveBeenCalledWith(
        createMockError(),
        { amount: 100 },
        config,
        'BILLING',
      );
    });

    it('должен возвращать UNKNOWN_ERROR если все мапперы вернули UNKNOWN_ERROR', () => {
      const unknownResult: MappedError = {
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown',
        timestamp: 1234567890,
        details: undefined,
        originError: undefined,
        service: undefined,
      };

      const mockMapper1 = vi.fn().mockReturnValue(unknownResult);
      const mockMapper2 = vi.fn().mockReturnValue(unknownResult);
      const config = createConfig('en');

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      const result = chainedMapper(createMockError(), undefined, config);

      expect(result).toEqual({
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown error',
        originError: { name: 'Error', message: 'Test error' },
        details: undefined,
        timestamp: 1234567890,
        service: undefined,
      });
    });

    it('должен поддерживать разные локали в цепочке', () => {
      const ruResult: MappedError = {
        code: 'AUTH_INVALID_TOKEN',
        message: 'Токен недействителен',
        timestamp: 1234567890,
        details: undefined,
        originError: undefined,
        service: 'AUTH',
      };

      const enResult: MappedError = {
        code: 'BILLING_INSUFFICIENT_FUNDS',
        message: 'Insufficient funds',
        timestamp: 1234567890,
        details: undefined,
        originError: undefined,
        service: 'BILLING',
      };

      const mockMapper1 = vi.fn().mockReturnValue(ruResult);
      const mockMapper2 = vi.fn().mockReturnValue(enResult);

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      // Первый маппер срабатывает
      const configRu = createConfig('ru');
      const result1 = chainedMapper(createMockError(), undefined, configRu);
      expect(result1.message).toBe('Токен недействителен');

      // Второй маппер срабатывает с другой локалью
      const unknownResult: MappedError = { ...ruResult, code: 'SYSTEM_UNKNOWN_ERROR' as const };
      mockMapper1.mockReturnValue(unknownResult);

      const configEn = createConfig('en');
      const result2 = chainedMapper(createMockError(), undefined, configEn);
      expect(result2.message).toBe('Insufficient funds');
    });

    it('должен возвращать UNKNOWN_ERROR с правильной локалью из цепочки', () => {
      const unknownResult: MappedError = {
        code: 'SYSTEM_UNKNOWN_ERROR',
        message: 'Unknown',
        timestamp: 1234567890,
        details: undefined,
        originError: undefined,
        service: undefined,
      };

      const mockMapper1 = vi.fn().mockReturnValue(unknownResult);
      const mockMapper2 = vi.fn().mockReturnValue(unknownResult);

      const chainedMapper = chainMappers(mockMapper1, mockMapper2);

      // Проверяем английскую локаль (переданная локаль)
      const configEn = createConfig('en');
      const resultEn = chainedMapper(createMockError(), undefined, configEn);
      expect(resultEn.message).toBe('Unknown error'); // английское сообщение

      // Проверяем русскую локаль (переданная локаль)
      const configRu = createConfig('ru');
      const resultRu = chainedMapper(createMockError(), undefined, configRu);
      expect(resultRu.message).toBe('Неизвестная ошибка'); // русское сообщение

      // Проверяем дефолт ru (locale не передан)
      const configDefault = createConfig(undefined);
      const resultDefault = chainedMapper(createMockError(), undefined, configDefault);
      expect(resultDefault.message).toBe('Неизвестная ошибка'); // дефолт ru

      // Проверяем, что service правильно передается
      const resultWithService = chainedMapper(createMockError(), undefined, configEn, 'AUTH');
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
      const config = createConfig();

      // TypeScript должен знать точный тип
      const result1 = mapError(authError, undefined, config);
      expect(result1.code).toBe('AUTH_INVALID_TOKEN');

      const result2 = mapError(billingError, undefined, config);
      expect(result2.code).toBe('BILLING_INSUFFICIENT_FUNDS');
    });

    it('должен обеспечивать type safety для generic details', () => {
      type PaymentDetails = {
        amount: number;
        currency: string;
      };

      const details: PaymentDetails = { amount: 100, currency: 'USD' };
      const config = createConfig();
      const result = mapError(createMockError(), details, config);

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
        const config = createConfig('en');
        const result = mapError(error, undefined, config);

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

        const configEn = createConfig('en');
        const resultEn = mapError(error, undefined, configEn);
        expect(resultEn.message).toBe(enMessage);

        const configRu = createConfig('ru');
        const resultRu = mapError(error, undefined, configRu);
        expect(resultRu.message).toBe(ruMessage);
      });
    });
  });

  describe('mapErrorBoundaryError', () => {
    it('должен маппить Network ошибки', () => {
      const error = new Error('Network request failed');
      const timestamp = new Date().toISOString() as ISODateString;
      const { appError, telemetryData } = mapErrorBoundaryError(error, { timestamp });

      expect(appError.type).toBe('UnknownError');
      if (appError.type === 'UnknownError') {
        expect(appError.severity).toBe('error');
        expect(appError.message).toBe('Network request failed');
        expect(appError.original).toBe(error);
        expect(appError.timestamp).toBe(timestamp);
      }
      expect(telemetryData.mappedErrorCode).toBe('NETWORK_ERROR');
      expect(telemetryData.originalErrorType).toBe('Error');
      expect(telemetryData.errorMessage).toBe('Network request failed');
    });

    it('должен маппить Validation ошибки', () => {
      const error = new Error('Validation failed');
      const timestamp = new Date().toISOString() as ISODateString;
      const { appError, telemetryData } = mapErrorBoundaryError(error, { timestamp });

      expect(appError.type).toBe('UnknownError');
      if (appError.type === 'UnknownError') {
        expect(appError.message).toBe('Validation failed');
      }
      expect(telemetryData.mappedErrorCode).toBe('VALIDATION_ERROR');
    });

    it('должен маппить fetch ошибки как Network', () => {
      const error = new Error('fetch error occurred');
      const timestamp = new Date().toISOString() as ISODateString;
      const { appError, telemetryData } = mapErrorBoundaryError(error, { timestamp });

      expect(appError.type).toBe('UnknownError');
      if (appError.type === 'UnknownError') {
        expect(appError.message).toBe('fetch error occurred');
      }
      expect(telemetryData.mappedErrorCode).toBe('NETWORK_ERROR');
    });

    it('должен маппить validation ошибки (case insensitive)', () => {
      const error = new Error('VALIDATION error');
      const timestamp = new Date().toISOString() as ISODateString;
      const { appError, telemetryData } = mapErrorBoundaryError(error, { timestamp });

      expect(appError.type).toBe('UnknownError');
      if (appError.type === 'UnknownError') {
        expect(appError.message).toBe('VALIDATION error');
      }
      expect(telemetryData.mappedErrorCode).toBe('VALIDATION_ERROR');
    });

    it('должен маппить неизвестные ошибки как UNKNOWN_ERROR', () => {
      const error = new Error('Some other error');
      const timestamp = new Date().toISOString() as ISODateString;
      const { appError, telemetryData } = mapErrorBoundaryError(error, { timestamp });

      expect(appError.type).toBe('UnknownError');
      if (appError.type === 'UnknownError') {
        expect(appError.message).toBe('Some other error');
      }
      expect(telemetryData.mappedErrorCode).toBe('UNKNOWN_ERROR');
    });

    it('должен возвращать данные для telemetry', () => {
      const error = new Error('Test error');
      const timestamp = new Date().toISOString() as ISODateString;

      const { appError, telemetryData } = mapErrorBoundaryError(error, { timestamp });

      expect(appError).toBeTruthy();
      expect(telemetryData).toEqual({
        originalErrorType: 'Error',
        mappedErrorCode: 'UNKNOWN_ERROR',
        errorMessage: 'Test error',
      });
    });
  });

  describe('createDomainError', () => {
    it('должен создавать DomainError из массива ValidationErrorLike', () => {
      const validationErrors: ValidationErrorLike[] = [
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
          service: 'SYSTEM',
          field: 'email',
          message: 'Invalid email format',
        },
      ];
      const config = createConfig('ru', 1234567890);

      const result = createDomainError(validationErrors, config);

      expect(result.code).toBe('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID');
      expect(result.service).toBe('SYSTEM');
      expect(result.details).toEqual({ validationErrors });
      expect(result.timestamp).toBe(1234567890);
    });

    it('должен использовать код ошибки из первой ошибки если не передан явно', () => {
      const validationErrors: ValidationErrorLike[] = [
        {
          code: 'AUTH_INVALID_TOKEN',
          service: 'AUTH',
        },
      ];
      const config = createConfig('en', 1234567890);

      const result = createDomainError(validationErrors, config);

      expect(result.code).toBe('AUTH_INVALID_TOKEN');
      expect(result.service).toBe('AUTH');
    });

    it('должен использовать переданный код ошибки вместо кода из первой ошибки', () => {
      const validationErrors: ValidationErrorLike[] = [
        {
          code: 'AUTH_INVALID_TOKEN',
          service: 'AUTH',
        },
      ];
      const config = createConfig('ru', 1234567890);

      const result = createDomainError(
        validationErrors,
        config,
        'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
      );

      expect(result.code).toBe('SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID');
      expect(result.service).toBe('AUTH'); // service берется из первой ошибки
    });

    it('должен использовать переданный service вместо service из первой ошибки', () => {
      const validationErrors: ValidationErrorLike[] = [
        {
          code: 'AUTH_INVALID_TOKEN',
          service: 'AUTH',
        },
      ];
      const config = createConfig('ru', 1234567890);

      const result = createDomainError(validationErrors, config, undefined, 'BILLING');

      expect(result.code).toBe('AUTH_INVALID_TOKEN'); // код берется из первой ошибки
      expect(result.service).toBe('BILLING');
    });

    it('должен использовать fallback код и service для пустого массива', () => {
      const validationErrors: ValidationErrorLike[] = [];
      const config = createConfig('ru', 1234567890);

      const result = createDomainError(validationErrors, config);

      expect(result.code).toBe('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID');
      expect(result.service).toBe('SYSTEM');
      expect(result.details).toEqual({ validationErrors: [] });
    });

    it('должен использовать fallback service если первая ошибка не имеет service', () => {
      const validationErrors: ValidationErrorLike[] = [
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        },
      ];
      const config = createConfig('en', 1234567890);

      const result = createDomainError(validationErrors, config);

      expect(result.code).toBe('SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID');
      expect(result.service).toBe('SYSTEM');
    });
  });
});
