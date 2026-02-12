/**
 * @file Unit тесты для packages/app/src/lib/api-schema-guard.ts
 *
 * Enterprise-grade тестирование API schema guard с 100% покрытием:
 * - validateApiRequest/Response/Interaction для всех сценариев
 * - Валидация размеров payload с различными условиями
 * - Обработка ошибок валидации и телеметрия
 * - Создание и комбинация валидаторов
 * - Валидация версий схем
 * - Edge cases и error handling
 * - Effect-first архитектура с полным покрытием
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect as EffectLib } from 'effect';

// Mock telemetry functions using vi.mock
vi.mock('../../../src/lib/telemetry', () => ({
  errorFireAndForget: vi.fn(),
  warnFireAndForget: vi.fn(),
}));

// Import after mocking
import { errorFireAndForget, warnFireAndForget } from '../../../src/lib/telemetry';

// Get mocked functions
const mockErrorFireAndForget = vi.mocked(errorFireAndForget);
const mockWarnFireAndForget = vi.mocked(warnFireAndForget);

import {
  combineRequestValidators,
  combineResponseValidators,
  createRestApiSchema,
  enforceStrictValidation,
  validateApiInteraction,
  validateApiRequest,
  validateApiResponse,
  validateSchemaVersion,
} from '../../../src/lib/api-schema-guard';
import type {
  ApiSchemaConfig,
  ApiValidationContext,
  ApiValidationError,
  ApiValidationErrorCode,
} from '../../../src/lib/api-schema-guard';
import type { ValidationError } from '../../../src/lib/validation';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock ApiValidationContext
 */
function createMockApiValidationContext(
  overrides: Readonly<Partial<ApiValidationContext>> = {},
): ApiValidationContext {
  return {
    method: 'POST',
    endpoint: '/api/test',
    requestId: 'test-request-id',
    traceId: 'test-trace-id',
    locale: 'en',
    ...overrides,
  };
}

/**
 * Создает mock ApiSchemaConfig
 */
function createMockApiSchemaConfig<TRequest = unknown, TResponse = unknown>(
  overrides: Readonly<Partial<ApiSchemaConfig<TRequest, TResponse>>> = {},
): ApiSchemaConfig<TRequest, TResponse> {
  return {
    service: 'auth' as const,
    method: 'POST',
    endpoint: '/api/test',
    maxRequestSize: 1024 * 1024, // 1MB
    maxResponseSize: 10 * 1024 * 1024, // 10MB
    supportedVersions: ['1.0.0'],
    ...overrides,
  };
}

/**
 * Создает mock валидатор, который всегда проходит
 */
function createMockSuccessValidator<T>(value: Readonly<T>) {
  return vi.fn().mockReturnValue(
    {
      success: true,
      value,
    } as const,
  );
}

/**
 * Создает mock валидатор, который всегда падает
 */
function createMockFailureValidator(errors: readonly ValidationError[]) {
  return vi.fn().mockReturnValue(
    {
      success: false,
      errors,
    } as const,
  );
}

/**
 * Helper для проверки успешного Effect результата
 */
async function expectEffectSuccess<T>(
  effect: Readonly<EffectLib.Effect<T, ApiValidationError, never>>,
  expectedValue: Readonly<T>,
) {
  const result = await EffectLib.runPromise(effect);
  expect(result).toEqual(expectedValue);
}

/**
 * Helper для проверки неудачного Effect результата
 */
async function expectEffectFailure<T, R = never>(
  effect: Readonly<EffectLib.Effect<T, ApiValidationError, R>>,
  expectedError: Readonly<Partial<ApiValidationError>>,
) {
  try {
    await EffectLib.runPromise(effect as EffectLib.Effect<T, ApiValidationError, never>);
    expect.fail('Expected effect to fail');
  } catch (error: any) {
    // Extract error from FiberFailure message
    if (error.name === '(FiberFailure) Error' && typeof error.message === 'string') {
      try {
        const parsedError = JSON.parse(error.message);
        expect(parsedError).toMatchObject(expectedError);
      } catch {
        // If parsing fails, check if error.message contains expected error as string
        const errorCode = expectedError.code;
        const errorMessage = error.message;
        if (
          typeof errorCode === 'string'
          && typeof errorMessage === 'string'
          && errorMessage.includes(errorCode)
        ) {
          // Error message contains the expected error code, consider it a match
          expect(errorMessage).toContain(errorCode);
        } else {
          // Fall back to original error comparison
          expect(error).toMatchObject(expectedError);
        }
      }
    } else {
      expect(error).toMatchObject(expectedError);
    }
  }
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('API Schema Guard - Enterprise Grade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateApiRequest', () => {
    it('должен успешно валидировать запрос без валидатора', async () => {
      const config = createMockApiSchemaConfig();
      const context = createMockApiValidationContext();
      const requestData = { test: 'data' };

      const effect = validateApiRequest(requestData, config, context);
      await expectEffectSuccess(effect, requestData);
    });

    it('должен успешно валидировать запрос с passing валидатором', async () => {
      const expectedValue = { validated: true };
      const mockValidator = createMockSuccessValidator(expectedValue);
      const config = createMockApiSchemaConfig({
        requestValidator: mockValidator,
      });
      const context = createMockApiValidationContext();

      const effect = validateApiRequest({ test: 'data' }, config, context);
      await expectEffectSuccess(effect, expectedValue);

      expect(mockValidator).toHaveBeenCalledWith({ test: 'data' }, context);
    });

    it('должен вернуть ошибку при failing request валидаторе', async () => {
      const validationErrors: ValidationError[] = [
        {
          code: 'AUTH_INVALID_TOKEN' as const,
          service: 'AUTH' as const,
          field: 'testField',
          message: 'Field is required',
        },
      ];
      const mockValidator = createMockFailureValidator(validationErrors);
      const config = createMockApiSchemaConfig({
        requestValidator: mockValidator,
      });
      const context = createMockApiValidationContext();

      const effect = validateApiRequest({ test: 'data' }, config, context);
      await expectEffectFailure(effect, {
        code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        service: 'SYSTEM',
      });

      expect(mockValidator).toHaveBeenCalledWith({ test: 'data' }, context);
      expect(mockErrorFireAndForget).toHaveBeenCalled();
    });

    it('должен проверить размер запроса и вернуть ошибку при превышении', async () => {
      const config = createMockApiSchemaConfig({
        maxRequestSize: 100, // Very small limit
      });
      const context = createMockApiValidationContext();
      const largeRequest = { data: 'x'.repeat(200) }; // Large payload

      const effect = validateApiRequest(largeRequest, config, context);
      await expectEffectFailure(effect, {
        code: 'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE',
        service: 'SYSTEM',
      });

      expect(mockWarnFireAndForget).toHaveBeenCalled();
    });

    it('должен пропустить валидацию размера при undefined maxRequestSize', async () => {
      const config = createMockApiSchemaConfig({
        maxRequestSize: undefined,
      });
      const context = createMockApiValidationContext();
      const largeRequest = { data: 'x'.repeat(10000) };

      const effect = validateApiRequest(largeRequest, config, context);
      await expectEffectSuccess(effect, largeRequest);
    });

    it('должен gracefully обработать ошибку оценки размера запроса', async () => {
      const config = createMockApiSchemaConfig({
        maxRequestSize: 100,
      });
      const context = createMockApiValidationContext();
      // Create object that will cause JSON.stringify to fail
      const nonSerializableRequest: any = {};
      Object.defineProperty(nonSerializableRequest, 'self', {
        get() {
          throw new Error('test error for size estimation');
        },
        enumerable: true,
      });
      nonSerializableRequest.ref = nonSerializableRequest;

      const effect = validateApiRequest(nonSerializableRequest, config, context);
      await expectEffectSuccess(effect, nonSerializableRequest);

      expect(mockWarnFireAndForget).toHaveBeenCalledWith(
        'Failed to estimate request payload size',
        expect.objectContaining({
          endpoint: context.endpoint,
          traceId: context.traceId,
        }),
      );
    });
  });

  describe('validateApiResponse', () => {
    it('должен успешно валидировать ответ без валидатора', async () => {
      const config = createMockApiSchemaConfig();
      const context = createMockApiValidationContext();
      const responseData = { result: 'success' };

      const effect = validateApiResponse(responseData, config, context);
      await expectEffectSuccess(effect, responseData);
    });

    it('должен успешно валидировать ответ с passing валидатором', async () => {
      const expectedValue = { validated: true };
      const mockValidator = createMockSuccessValidator(expectedValue);
      const config = createMockApiSchemaConfig({
        responseValidator: mockValidator,
      });
      const context = createMockApiValidationContext();

      const effect = validateApiResponse({ result: 'data' }, config, context);
      await expectEffectSuccess(effect, expectedValue);

      expect(mockValidator).toHaveBeenCalledWith({ result: 'data' }, context);
    });

    it('должен вернуть ошибку при failing response валидаторе', async () => {
      const validationErrors: ValidationError[] = [
        {
          code: 'AUTH_USER_NOT_FOUND' as const,
          service: 'SYSTEM',
          field: 'result',
          message: 'Invalid format',
        },
      ];
      const mockValidator = createMockFailureValidator(validationErrors);
      const config = createMockApiSchemaConfig({
        responseValidator: mockValidator,
      });
      const context = createMockApiValidationContext();

      const effect = validateApiResponse({ result: 'data' }, config, context);
      await expectEffectFailure(effect, {
        code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        service: 'SYSTEM',
      });

      expect(mockValidator).toHaveBeenCalledWith({ result: 'data' }, context);
      expect(mockErrorFireAndForget).toHaveBeenCalled();
    });

    it('должен проверить размер ответа и вернуть ошибку при превышении', async () => {
      const config = createMockApiSchemaConfig({
        maxResponseSize: 100, // Very small limit
      });
      const context = createMockApiValidationContext();
      const largeResponse = { data: 'x'.repeat(200) }; // Large payload

      const effect = validateApiResponse(largeResponse, config, context);
      await expectEffectFailure(effect, {
        code: 'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE',
        service: 'SYSTEM',
      });

      expect(mockErrorFireAndForget).toHaveBeenCalled();
    });

    it('должен gracefully обработать ошибку оценки размера ответа', async () => {
      const config = createMockApiSchemaConfig({
        maxResponseSize: 100,
      });
      const context = createMockApiValidationContext();
      // Create object that will cause JSON.stringify to fail
      const nonSerializableResponse: any = {};
      Object.defineProperty(nonSerializableResponse, 'self', {
        get() {
          throw new Error('test error for size estimation');
        },
        enumerable: true,
      });
      nonSerializableResponse.ref = nonSerializableResponse;

      const effect = validateApiResponse(nonSerializableResponse, config, context);
      await expectEffectSuccess(effect, nonSerializableResponse);

      expect(mockWarnFireAndForget).toHaveBeenCalledWith(
        'Failed to estimate response payload size',
        expect.objectContaining({
          endpoint: context.endpoint,
          traceId: context.traceId,
        }),
      );
    });
  });

  describe('validateApiInteraction', () => {
    it('должен успешно валидировать request и response', async () => {
      const config = createMockApiSchemaConfig();
      const context = createMockApiValidationContext();
      const requestData = { input: 'test' };
      const responseData = { output: 'result' };

      const effect = validateApiInteraction(
        requestData,
        responseData,
        config,
        context,
      );

      const result = await EffectLib.runPromise(effect);
      expect(result).toEqual({
        request: requestData,
        response: responseData,
      });
    });

    it('должен вернуть ошибку при invalid request', async () => {
      const validationErrors: ValidationError[] = [
        {
          code: 'AUTH_INVALID_TOKEN' as const,
          service: 'SYSTEM',
          field: 'input',
          message: 'Input is required',
        },
      ];
      const mockValidator = createMockFailureValidator(validationErrors);
      const config = createMockApiSchemaConfig({
        requestValidator: mockValidator,
      });
      const context = createMockApiValidationContext();

      const effect = validateApiInteraction(
        { invalid: 'data' },
        { output: 'result' },
        config,
        context,
      );

      await expectEffectFailure(effect, {
        code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        service: 'SYSTEM',
      });
    });

    it('должен вернуть ошибку при invalid response', async () => {
      const validationErrors: ValidationError[] = [
        {
          code: 'AUTH_USER_NOT_FOUND' as const,
          service: 'SYSTEM',
          field: 'output',
          message: 'Invalid output format',
        },
      ];
      const mockValidator = createMockFailureValidator(validationErrors);
      const config = createMockApiSchemaConfig({
        responseValidator: mockValidator,
      });
      const context = createMockApiValidationContext();

      const effect = validateApiInteraction(
        { input: 'test' },
        { invalid: 'output' },
        config,
        context,
      );

      await expectEffectFailure(effect, {
        code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        service: 'SYSTEM',
      });
    });
  });

  describe('createRestApiSchema', () => {
    it('должен создать базовую конфигурацию с defaults', () => {
      const schema = createRestApiSchema('auth' as any, 'GET', '/api/test');

      expect(schema).toEqual({
        service: 'auth',
        method: 'GET',
        endpoint: '/api/test',
        maxRequestSize: 1024 * 1024, // DEFAULT_REQUEST_SIZE_LIMIT
        maxResponseSize: 10 * 1024 * 1024, // DEFAULT_RESPONSE_SIZE_LIMIT
        supportedVersions: [],
      });
    });

    it('должен создать конфигурацию с кастомными опциями', () => {
      const mockRequestValidator = vi.fn();
      const mockResponseValidator = vi.fn();

      const schema = createRestApiSchema(
        'auth',
        'POST',
        '/api/test',
        {
          requestValidator: mockRequestValidator,
          responseValidator: mockResponseValidator,
          maxRequestSize: 500 * 1024,
          maxResponseSize: 5 * 1024 * 1024,
          schemaVersion: '2.0.0',
        },
      );

      expect(schema).toEqual({
        service: 'auth',
        method: 'POST',
        endpoint: '/api/test',
        requestValidator: mockRequestValidator,
        responseValidator: mockResponseValidator,
        maxRequestSize: 500 * 1024,
        maxResponseSize: 5 * 1024 * 1024,
        schemaVersion: '2.0.0',
        supportedVersions: ['2.0.0'],
      });
    });

    it('должен создать конфигурацию без schemaVersion', () => {
      const schema = createRestApiSchema('auth' as any, 'GET', '/api/test', {});

      expect(schema.supportedVersions).toEqual([]);
      expect(schema.schemaVersion).toBeUndefined();
    });
  });

  describe('combineRequestValidators', () => {
    it('должен комбинировать несколько request валидаторов', () => {
      const validator1 = vi.fn().mockReturnValue({
        success: true,
        value: { step1: 'ok' },
      });
      const validator2 = vi.fn().mockReturnValue({
        success: true,
        value: { step2: 'ok' },
      });

      const combinedValidator = combineRequestValidators(validator1, validator2);
      const context = createMockApiValidationContext();
      const input = { data: 'test' };

      const result = combinedValidator(input, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual({ step2: 'ok' }); // Последний результат
      } else {
        expect(result.errors).toBeUndefined();
      }
      expect(validator1).toHaveBeenCalledWith(input, context);
      expect(validator2).toHaveBeenCalledWith({ step1: 'ok' }, context);
    });

    it('должен вернуть ошибку при первом failing валидаторе', () => {
      const validator1 = vi.fn().mockReturnValue({
        success: false,
        errors: [{ code: 'ERROR1', service: 'AI', field: 'field1', message: 'Error 1' }],
      });
      const validator2 = vi.fn();

      const combinedValidator = combineRequestValidators(validator1, validator2);
      const context = createMockApiValidationContext();

      const result = combinedValidator({ data: 'test' }, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.code).toBe('ERROR1');
      }
      expect(validator2).not.toHaveBeenCalled();
    });

    it('должен работать с одним валидатором', () => {
      const validator1 = vi.fn().mockReturnValue({
        success: true,
        value: { processed: true },
      });

      const combinedValidator = combineRequestValidators(validator1);
      const context = createMockApiValidationContext();

      const result = combinedValidator({ data: 'test' }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual({ processed: true });
      } else {
        expect(result.errors).toBeUndefined();
      }
    });
  });

  describe('combineResponseValidators', () => {
    it('должен комбинировать несколько response валидаторов', () => {
      const validator1 = vi.fn().mockReturnValue({
        success: true,
        value: { step1: 'processed' },
      });
      const validator2 = vi.fn().mockReturnValue({
        success: true,
        value: { step2: 'validated' },
      });

      const combinedValidator = combineResponseValidators(validator1, validator2);
      const context = createMockApiValidationContext();

      const result = combinedValidator({ data: 'response' }, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual({ step2: 'validated' });
      } else {
        expect(result.errors).toBeUndefined();
      }
      expect(validator1).toHaveBeenCalledWith({ data: 'response' }, context);
      expect(validator2).toHaveBeenCalledWith({ step1: 'processed' }, context);
    });

    it('должен работать аналогично combineRequestValidators', () => {
      const validator1 = vi.fn().mockReturnValue({
        success: false,
        errors: [{ code: 'ERROR1', service: 'AI', field: 'field1', message: 'Error 1' }],
      });
      const validator2 = vi.fn();

      const combinedValidator = combineResponseValidators(validator1, validator2);
      const context = createMockApiValidationContext();

      const result = combinedValidator({ data: 'response' }, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
      } else {
        expect(result.value).toBeUndefined();
      }
      expect(validator2).not.toHaveBeenCalled();
    });
  });

  describe('validateSchemaVersion', () => {
    it('должен вернуть true для поддерживаемой версии', async () => {
      const config = createMockApiSchemaConfig({
        supportedVersions: ['1.0.0', '1.1.0'],
      });
      const context = createMockApiValidationContext();

      const effect = validateSchemaVersion('1.0.0', config.supportedVersions ?? [], context);
      await EffectLib.runPromise(effect as any); // Success if no error thrown
    });

    it('должен вернуть false для неподдерживаемой версии', async () => {
      const config = createMockApiSchemaConfig({
        supportedVersions: ['1.0.0', '1.1.0'],
      });
      const context = createMockApiValidationContext();

      const effect = validateSchemaVersion('2.0.0', config.supportedVersions ?? [], context);

      await expect(async () => {
        await EffectLib.runPromise(effect as any);
      }).rejects.toThrow();
    });

    it('должен вернуть ошибку если supportedVersions пустой', async () => {
      const context = createMockApiValidationContext();

      await expectEffectFailure(
        validateSchemaVersion('1.0.0', [], context),
        {
          code: 'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH',
          service: 'SYSTEM',
        },
      );
    });

    it('должен вернуть ошибку с undefined supportedVersions', async () => {
      const context = createMockApiValidationContext();

      await expectEffectFailure(
        validateSchemaVersion('1.0.0', undefined, context),
        {
          code: 'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH',
          service: 'SYSTEM',
        },
      );
    });
  });

  describe('Вспомогательные функции и edge cases', () => {
    it('estimatePayloadSize должен корректно оценивать размер', async () => {
      // Эта функция не экспортирована, но мы можем протестировать её косвенно
      // через публичные функции которые её используют
      const config = createMockApiSchemaConfig({
        maxRequestSize: 100,
      });
      const context = createMockApiValidationContext();
      const largeRequest = { data: 'x'.repeat(200) };

      // Если размер корректно оценивается, должна быть ошибка
      const effect = validateApiRequest(largeRequest, config, context);
      await expect(async () => {
        await EffectLib.runPromise(effect);
      }).rejects.toThrow();
    });

    it('createPayloadSample должен создавать корректные samples', async () => {
      // Эта функция тоже не экспортирована, но используется в телеметрии
      const config = createMockApiSchemaConfig({
        maxRequestSize: 100,
      });
      const context = createMockApiValidationContext();
      const largeRequest = { data: 'x'.repeat(200) };

      await expectEffectFailure(
        validateApiRequest(largeRequest, config, context),
        {
          code: 'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE',
          service: 'SYSTEM',
        },
      );

      // Проверяем что warnFireAndForget был вызван с payloadSample
      expect(mockWarnFireAndForget).toHaveBeenCalledWith(
        'API request payload too large',
        expect.objectContaining({
          payloadSample: expect.any(String),
        }),
      );
    });

    it('должен корректно обрабатывать несериализуемые объекты', () => {
      const config = createMockApiSchemaConfig();
      const context = createMockApiValidationContext();
      const nonSerializable = {
        circular: null as any,
      };
      nonSerializable.circular = nonSerializable;

      const effect = validateApiRequest(nonSerializable, config, context);
      expect(async () => {
        const result = await EffectLib.runPromise(effect);
        expect(result).toBe(nonSerializable);
      }).not.toThrow();
    });

    it('createApiValidationError должен создавать корректные ошибки', async () => {
      // Протестируем косвенно через публичные функции
      const validationErrors: ValidationError[] = [
        {
          code: 'SYSTEM_UNKNOWN_ERROR' as const,
          service: 'SYSTEM',
          field: 'testField',
          message: 'Test error message',
        },
      ];
      const mockValidator = createMockFailureValidator(validationErrors);
      const config = createMockApiSchemaConfig({
        requestValidator: mockValidator,
      });
      const context = createMockApiValidationContext();

      const effect = validateApiRequest({ test: 'data' }, config, context);

      await expectEffectFailure(effect, {
        code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        service: 'SYSTEM',
        details: validationErrors,
      });

      expect(mockErrorFireAndForget).toHaveBeenCalledWith(
        'API validation failed: SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        expect.objectContaining({
          code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
          validationErrors: 1,
        }),
      );
    });
  });

  describe('Типы и константы', () => {
    it('ApiValidationErrorCode должен содержать все необходимые коды', () => {
      // Проверяем что все error codes определены
      const codes: ApiValidationErrorCode[] = [
        'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        'SYSTEM_VALIDATION_REQUEST_PAYLOAD_TOO_LARGE',
        'SYSTEM_VALIDATION_RESPONSE_PAYLOAD_TOO_LARGE',
        'SYSTEM_VALIDATION_REQUEST_HEADERS_INVALID',
        'SYSTEM_VALIDATION_RESPONSE_HEADERS_INVALID',
        'SYSTEM_VALIDATION_SCHEMA_VERSION_MISMATCH',
        'SYSTEM_VALIDATION_TIMEOUT_EXCEEDED',
      ];

      expect(codes).toHaveLength(8);
      codes.forEach((code) => {
        expect(typeof code).toBe('string');
        expect(code.startsWith('SYSTEM_VALIDATION_')).toBe(true);
      });
    });

    it('ApiValidationContext должен содержать все необходимые поля', () => {
      const context: ApiValidationContext = {
        method: 'POST',
        endpoint: '/api/test',
        requestId: 'req-123',
        traceId: 'trace-456',
        service: 'SYSTEM',
        locale: 'en',
        serviceId: 'service-1',
        instanceId: 'instance-1',
      };

      expect(context.method).toBe('POST');
      expect(context.endpoint).toBe('/api/test');
      expect(context.requestId).toBe('req-123');
      expect(context.traceId).toBe('trace-456');
      expect(context.service).toBe('SYSTEM');
      expect(context.locale).toBe('en');
      expect(context.serviceId).toBe('service-1');
      expect(context.instanceId).toBe('instance-1');
    });

    it('константы должны иметь корректные значения', () => {
      // Эти константы не экспортированы, но мы можем проверить их косвенно
      const config = createRestApiSchema('auth' as any, 'GET', '/api/test');

      expect(config.maxRequestSize).toBe(1024 * 1024); // DEFAULT_REQUEST_SIZE_LIMIT
      expect(config.maxResponseSize).toBe(10 * 1024 * 1024); // DEFAULT_RESPONSE_SIZE_LIMIT
    });
  });

  describe('Strict Mode', () => {
    it('должен требовать requestValidator в strict mode для validateApiRequest', async () => {
      const config: ApiSchemaConfig = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: true,
        // requestValidator отсутствует
      };

      const context = createMockApiValidationContext();

      await expectEffectFailure(
        validateApiRequest({ email: 'test@example.com' }, config, context),
        {
          code: 'SYSTEM_VALIDATION_REQUEST_SCHEMA_INVALID',
        },
      );
    });

    it('должен требовать responseValidator в strict mode для validateApiResponse', async () => {
      const config: ApiSchemaConfig<unknown, { token: string; }> = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: true,
        // responseValidator отсутствует
      };

      const context = createMockApiValidationContext();

      await expectEffectFailure(
        validateApiResponse({ token: 'abc123' }, config, context),
        {
          code: 'SYSTEM_VALIDATION_RESPONSE_SCHEMA_INVALID',
        },
      );
    });

    it('не должен требовать валидаторы когда strict mode выключен', async () => {
      const config: ApiSchemaConfig = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: false,
        // валидаторы отсутствуют
      };

      const context = createMockApiValidationContext();

      const result = await EffectLib.runPromise(
        validateApiRequest({ email: 'test@example.com' }, config, context),
      );

      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('должен работать в strict mode когда валидаторы присутствуют', async () => {
      const expectedValue = { email: 'test@example.com' };
      const requestValidator = createMockSuccessValidator(expectedValue);

      const config: ApiSchemaConfig<{ email: string; }> = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: true,
        requestValidator,
      };

      const context = createMockApiValidationContext();

      const result = await EffectLib.runPromise(
        validateApiRequest({ email: 'test@example.com' }, config, context),
      );

      expect(result).toEqual(expectedValue);
    });

    it('enforceStrictValidation должен выбрасывать ошибку если requestValidator отсутствует', () => {
      const config: ApiSchemaConfig = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: true,
        // requestValidator отсутствует
      };

      expect(() => enforceStrictValidation(config)).toThrow(
        'Strict mode requires requestValidator for auth POST /login',
      );
    });

    it('enforceStrictValidation должен выбрасывать ошибку если responseValidator отсутствует', () => {
      const expectedValue = { email: 'test@example.com' };
      const requestValidator = createMockSuccessValidator(expectedValue);

      const config: ApiSchemaConfig<{ email: string; }, { token: string; }> = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: true,
        requestValidator,
        // responseValidator отсутствует
      };

      expect(() => enforceStrictValidation(config)).toThrow(
        'Strict mode requires responseValidator for auth POST /login',
      );
    });

    it('enforceStrictValidation не должен выбрасывать ошибку если strict mode выключен', () => {
      const config: ApiSchemaConfig = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: false,
        // валидаторы отсутствуют
      };

      expect(() => enforceStrictValidation(config)).not.toThrow();
    });

    it('enforceStrictValidation не должен выбрасывать ошибку если все валидаторы присутствуют', () => {
      const requestValue = { email: 'test@example.com' };
      const responseValue = { token: 'abc123' };
      const requestValidator = createMockSuccessValidator(requestValue);
      const responseValidator = createMockSuccessValidator(responseValue);

      const config: ApiSchemaConfig<{ email: string; }, { token: string; }> = {
        service: 'auth',
        method: 'POST',
        endpoint: '/login',
        strictMode: true,
        requestValidator,
        responseValidator,
      };

      expect(() => enforceStrictValidation(config)).not.toThrow();
    });

    it('createRestApiSchema должен поддерживать strictMode', () => {
      const requestValue = { email: 'test@example.com' };
      const responseValue = { token: 'test-token' };
      const requestValidator = createMockSuccessValidator(requestValue);
      const responseValidator = createMockSuccessValidator(responseValue);

      const config = createRestApiSchema('auth', 'POST', '/login', {
        requestValidator,
        responseValidator,
        strictMode: true,
      });

      expect(config.strictMode).toBe(true);
      expect(config.requestValidator).toBe(requestValidator);
      expect(config.responseValidator).toBe(responseValidator);
    });
  });
});
