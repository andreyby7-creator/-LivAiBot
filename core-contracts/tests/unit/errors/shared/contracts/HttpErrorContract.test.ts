import { describe, expect, it } from 'vitest';

import {
  createHttpErrorContract,
  getHttpErrorCode,
  getHttpErrorDetails,
  getHttpErrorMessage,
  isContractValidationError,
  isHttpErrorContract,
} from '../../../../../src/errors/shared/contracts/HttpErrorContract';
import type {
  ContractValidationError,
  ErrorDetails,
  HttpErrorContract,
} from '../../../../../src/errors/shared/contracts/HttpErrorContract';
import type { SharedErrorCodeString } from '../../../../../src/errors/shared/SharedErrorTypes';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock HttpErrorContract для тестов */
function createMockHttpErrorContract(
  statusCode: number = 400,
  code: SharedErrorCodeString = 'SHARED_DOMAIN_USER_NOT_FOUND',
  message: string = 'User not found',
  details?: ErrorDetails,
  headers: Record<string, string> = {},
): HttpErrorContract {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: {
      error: {
        code,
        message: message.trim(),
        ...(details !== undefined ? { details } : {}),
      },
    },
  };
}

/** Создает mock ErrorDetails для тестов */
function createMockErrorDetails(): ErrorDetails {
  return {
    context: { userId: '123', operation: 'findUser' },
    debug: { stackTrace: 'Error at line 42', dbQuery: 'SELECT * FROM users' },
    stack: 'Error: User not found\n    at findUser (/app/src/userService.ts:42:9)',
    operation: 'findUser',
    requestId: 'req-abc-123',
    timestamp: '2024-01-01T12:00:00.000Z',
    customField: 'custom value',
  };
}

/** Создает mock ContractValidationError для тестов */
function createMockContractValidationError(
  message: string = 'Invalid HTTP status code',
  field: string = 'statusCode',
  value?: unknown,
): ContractValidationError {
  return {
    type: 'CONTRACT_VALIDATION_ERROR',
    message,
    field,
    value,
  };
}

// ==================== TESTS ====================

describe('HttpErrorContract', () => {
  describe('createHttpErrorContract', () => {
    describe('успешные кейсы', () => {
      it('создает контракт с минимальными обязательными полями', () => {
        const result = createHttpErrorContract(
          400,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'User not found',
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract).toEqual({
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: {
              code: 'SHARED_DOMAIN_USER_NOT_FOUND',
              message: 'User not found',
            },
          },
        });

        expect(isHttpErrorContract(contract)).toBe(true);
      });

      it('создает контракт с деталями ошибки', () => {
        const details = createMockErrorDetails();
        const result = createHttpErrorContract(
          404,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'User not found',
          details,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract.body.error.details).toEqual(details);
      });

      it('создает контракт с дополнительными заголовками', () => {
        const customHeaders = {
          'X-Correlation-ID': 'corr-123',
          'X-Request-ID': 'req-456',
        };

        const result = createHttpErrorContract(
          500,
          'SHARED_INFRA_DATABASE_ERROR',
          'Database connection failed',
          undefined,
          customHeaders,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract.headers).toEqual({
          'Content-Type': 'application/json',
          'X-Correlation-ID': 'corr-123',
          'X-Request-ID': 'req-456',
        });
      });

      it('триммит пробелы в сообщении', () => {
        const result = createHttpErrorContract(
          400,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          '  User not found  ',
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract.body.error.message).toBe('User not found');
      });

      it('работает с различными HTTP статус кодами в диапазоне 400-599', () => {
        const validStatusCodes = [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504, 599];

        validStatusCodes.forEach((statusCode) => {
          const result = createHttpErrorContract(
            statusCode,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Right');
          expect((result as any).right.statusCode).toBe(statusCode);
        });
      });

      it('работает с различными кодами ошибок SHARED_*', () => {
        const errorCodes: SharedErrorCodeString[] = [
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'SHARED_INFRA_DATABASE_ERROR',
          'SHARED_POLICY_RATE_LIMIT_EXCEEDED',
          'SHARED_ADAPTER_HTTP_TIMEOUT',
          'SHARED_CUSTOM_ERROR_CODE',
        ];

        errorCodes.forEach((code) => {
          const result = createHttpErrorContract(
            400,
            code,
            'Test message',
          );

          expect(result._tag).toBe('Right');
          expect((result as any).right.body.error.code).toBe(code);
        });
      });
    });

    describe('ошибки валидации', () => {
      describe('статус код', () => {
        it('возвращает ошибку для статуса < 400', () => {
          const result = createHttpErrorContract(
            399,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid HTTP status code',
            field: 'statusCode',
            value: 399,
          });
        });

        it('возвращает ошибку для статуса > 599', () => {
          const result = createHttpErrorContract(
            600,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid HTTP status code',
            field: 'statusCode',
            value: 600,
          });
        });

        it('возвращает ошибку для нецелого статуса', () => {
          const result = createHttpErrorContract(
            400.5,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid HTTP status code',
            field: 'statusCode',
            value: 400.5,
          });
        });
      });

      describe('код ошибки', () => {
        it('возвращает ошибку для кода без префикса SHARED_', () => {
          const result = createHttpErrorContract(
            400,
            'DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error code format',
            field: 'code',
            value: 'DOMAIN_USER_NOT_FOUND',
          });
        });

        it('возвращает ошибку для нестрокового кода', () => {
          const result = createHttpErrorContract(
            400,
            123 as any,
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error code format',
            field: 'code',
            value: 123,
          });
        });

        it('возвращает ошибку для пустого кода', () => {
          const result = createHttpErrorContract(
            400,
            '',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error code format',
            field: 'code',
            value: '',
          });
        });
      });

      describe('сообщение', () => {
        it('возвращает ошибку для пустого сообщения', () => {
          const result = createHttpErrorContract(
            400,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            '',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Message cannot be empty',
            field: 'message',
            value: '',
          });
        });

        it('возвращает ошибку для сообщения из одних пробелов', () => {
          const result = createHttpErrorContract(
            400,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            '   ',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Message cannot be empty',
            field: 'message',
            value: '   ',
          });
        });

        it('возвращает ошибку для нестрокового сообщения', () => {
          const result = createHttpErrorContract(
            400,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            null as any,
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Message cannot be empty',
            field: 'message',
            value: null,
          });
        });
      });
    });
  });

  describe('isHttpErrorContract', () => {
    describe('возвращает true для валидных контрактов', () => {
      it('базовый контракт', () => {
        const contract = createMockHttpErrorContract();
        expect(isHttpErrorContract(contract)).toBe(true);
      });

      it('контракт с деталями', () => {
        const contract = createMockHttpErrorContract(
          404,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'User not found',
          createMockErrorDetails(),
        );
        expect(isHttpErrorContract(contract)).toBe(true);
      });

      it('контракт с дополнительными заголовками', () => {
        const contract = createMockHttpErrorContract(
          500,
          'SHARED_INFRA_DATABASE_ERROR',
          'Database error',
          undefined,
          { 'X-Custom': 'value' },
        );
        expect(isHttpErrorContract(contract)).toBe(true);
      });

      it('работает с различными валидными статус кодами', () => {
        const validCodes = [400, 401, 404, 422, 500, 502, 503, 599];

        validCodes.forEach((code) => {
          const contract = createMockHttpErrorContract(code);
          expect(isHttpErrorContract(contract)).toBe(true);
        });
      });
    });

    describe('возвращает false для невалидных объектов', () => {
      it('null', () => {
        expect(isHttpErrorContract(null)).toBe(false);
      });

      it('undefined', () => {
        expect(isHttpErrorContract(undefined)).toBe(false);
      });

      it('строка', () => {
        expect(isHttpErrorContract('not an object')).toBe(false);
      });

      it('число', () => {
        expect(isHttpErrorContract(42)).toBe(false);
      });

      it('пустой объект', () => {
        expect(isHttpErrorContract({})).toBe(false);
      });

      it('объект без statusCode', () => {
        const invalid = { headers: {}, body: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с нечисловым statusCode', () => {
        const invalid = { statusCode: '400', headers: {}, body: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с нецелым statusCode', () => {
        const invalid = { statusCode: 400.5, headers: {}, body: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект со статусом < 400', () => {
        const invalid = createMockHttpErrorContract(399);
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект со статусом > 599', () => {
        const invalid = createMockHttpErrorContract(600);
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект без headers', () => {
        const invalid = { statusCode: 400, body: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с не-объектом headers', () => {
        const invalid = { statusCode: 400, headers: 'invalid', body: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с null headers', () => {
        const invalid = { statusCode: 400, headers: null, body: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с headers содержащими не-строковые значения', () => {
        const invalid = {
          statusCode: 400,
          headers: { 'Content-Type': 123 },
          body: {},
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект без body', () => {
        const invalid = { statusCode: 400, headers: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с не-объектом body', () => {
        const invalid = { statusCode: 400, headers: {}, body: 'invalid' };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с null body', () => {
        const invalid = { statusCode: 400, headers: {}, body: null };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект без error в body', () => {
        const invalid = { statusCode: 400, headers: {}, body: {} };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с не-объектом error', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: 'invalid' },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с null error', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: null },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект без code в error', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: { message: 'test' } },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с нестроковым code', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: { code: 123, message: 'test' } },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с code без SHARED_ префикса', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: { code: 'DOMAIN_ERROR', message: 'test' } },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект без message в error', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: { code: 'SHARED_DOMAIN_USER_NOT_FOUND' } },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с нестроковым message', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: { code: 'SHARED_DOMAIN_USER_NOT_FOUND', message: 123 } },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с пустым message', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: { code: 'SHARED_DOMAIN_USER_NOT_FOUND', message: '' } },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });

      it('объект с message из одних пробелов', () => {
        const invalid = {
          statusCode: 400,
          headers: {},
          body: { error: { code: 'SHARED_DOMAIN_USER_NOT_FOUND', message: '   ' } },
        };
        expect(isHttpErrorContract(invalid)).toBe(false);
      });
    });
  });

  describe('getHttpErrorCode', () => {
    it('извлекает код ошибки из контракта', () => {
      const contract = createMockHttpErrorContract(
        404,
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'User not found',
      );

      const code = getHttpErrorCode(contract);
      expect(code).toBe('SHARED_DOMAIN_USER_NOT_FOUND');
    });

    it('работает с различными кодами ошибок', () => {
      const testCases: SharedErrorCodeString[] = [
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'SHARED_INFRA_DATABASE_ERROR',
        'SHARED_POLICY_RATE_LIMIT_EXCEEDED',
        'SHARED_ADAPTER_HTTP_TIMEOUT',
      ];

      testCases.forEach((expectedCode) => {
        const contract = createMockHttpErrorContract(400, expectedCode, 'Test');
        expect(getHttpErrorCode(contract)).toBe(expectedCode);
      });
    });
  });

  describe('getHttpErrorMessage', () => {
    it('извлекает сообщение ошибки из контракта', () => {
      const contract = createMockHttpErrorContract(
        400,
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'User not found',
      );

      const message = getHttpErrorMessage(contract);
      expect(message).toBe('User not found');
    });

    it('работает с различными сообщениями', () => {
      const testMessages = [
        'User not found',
        'Database connection failed',
        'Rate limit exceeded',
        'HTTP timeout occurred',
      ];

      testMessages.forEach((expectedMessage) => {
        const contract = createMockHttpErrorContract(
          400,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          expectedMessage,
        );
        expect(getHttpErrorMessage(contract)).toBe(expectedMessage);
      });
    });
  });

  describe('getHttpErrorDetails', () => {
    it('возвращает undefined если деталей нет', () => {
      const contract = createMockHttpErrorContract(
        400,
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'User not found',
      );

      const details = getHttpErrorDetails(contract);
      expect(details).toBeUndefined();
    });

    it('извлекает детали ошибки из контракта', () => {
      const expectedDetails = createMockErrorDetails();
      const contract = createMockHttpErrorContract(
        400,
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'User not found',
        expectedDetails,
      );

      const details = getHttpErrorDetails(contract);
      expect(details).toEqual(expectedDetails);
    });

    it('работает с различными типами деталей', () => {
      const testDetails = [
        { simple: 'value' },
        { nested: { key: 'value' } },
        { array: [1, 2, 3] },
        { mixed: { string: 'test', number: 42, boolean: true } },
      ];

      testDetails.forEach((expectedDetails) => {
        const contract = createMockHttpErrorContract(
          400,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'User not found',
          expectedDetails,
        );
        expect(getHttpErrorDetails(contract)).toEqual(expectedDetails);
      });
    });
  });

  describe('isContractValidationError', () => {
    describe('возвращает true для валидных ошибок валидации', () => {
      it('базовая ошибка валидации', () => {
        const error = createMockContractValidationError();
        expect(isContractValidationError(error)).toBe(true);
      });

      it('ошибка валидации с полями field и value', () => {
        const error = createMockContractValidationError(
          'Custom message',
          'customField',
          'customValue',
        );
        expect(isContractValidationError(error)).toBe(true);
      });

      it('ошибка валидации без поля field', () => {
        const error = {
          type: 'CONTRACT_VALIDATION_ERROR',
          message: 'Test message',
        };
        expect(isContractValidationError(error)).toBe(true);
      });

      it('ошибка валидации без поля value', () => {
        const error = {
          type: 'CONTRACT_VALIDATION_ERROR',
          message: 'Test message',
          field: 'testField',
        };
        expect(isContractValidationError(error)).toBe(true);
      });
    });

    describe('возвращает false для невалидных объектов', () => {
      it('null', () => {
        expect(isContractValidationError(null)).toBe(false);
      });

      it('undefined', () => {
        expect(isContractValidationError(undefined)).toBe(false);
      });

      it('строка', () => {
        expect(isContractValidationError('not an object')).toBe(false);
      });

      it('число', () => {
        expect(isContractValidationError(42)).toBe(false);
      });

      it('пустой объект', () => {
        expect(isContractValidationError({})).toBe(false);
      });

      it('объект без type', () => {
        const invalid = { message: 'test' };
        expect(isContractValidationError(invalid)).toBe(false);
      });

      it('объект с неправильным type', () => {
        const invalid = { type: 'OTHER_ERROR', message: 'test' };
        expect(isContractValidationError(invalid)).toBe(false);
      });

      it('объект без message', () => {
        const invalid = { type: 'CONTRACT_VALIDATION_ERROR' };
        expect(isContractValidationError(invalid)).toBe(false);
      });

      it('объект с нестроковым message', () => {
        const invalid = { type: 'CONTRACT_VALIDATION_ERROR', message: 123 };
        expect(isContractValidationError(invalid)).toBe(false);
      });
    });
  });
});
