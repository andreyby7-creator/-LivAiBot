import { describe, expect, it } from 'vitest';

import {
  createGrpcErrorContract,
  getGrpcCorrelationId,
  getGrpcErrorCode,
  getGrpcErrorDetails,
  GRPC_STATUS_CODES,
  isContractValidationError,
  isGrpcErrorContract,
} from '../../../../../src/errors/shared/contracts/GrpcErrorContract';
import type {
  ContractValidationError,
  ErrorDetails,
  GrpcErrorContract,
} from '../../../../../src/errors/shared/contracts/GrpcErrorContract';
import type { SharedErrorCodeString } from '../../../../../src/errors/shared/SharedErrorTypes';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock GrpcErrorContract для тестов */
function createMockGrpcErrorContract(
  code: number = GRPC_STATUS_CODES.NOT_FOUND,
  errorCode: SharedErrorCodeString = 'SHARED_DOMAIN_USER_NOT_FOUND',
  message: string = 'User not found',
  details?: ErrorDetails,
  correlationId?: string,
  timestamp: string = '2024-01-01T12:00:00.000Z',
): GrpcErrorContract {
  return {
    code,
    message: message.trim(),
    metadata: {
      errorCode,
      timestamp,
      ...(details !== undefined ? { details } : {}),
      ...(correlationId !== undefined ? { correlationId } : {}),
    },
  };
}

/** Создает mock ErrorDetails для тестов */
function createMockErrorDetails(): ErrorDetails {
  return {
    context: { userId: '123', operation: 'findUser' },
    debug: { stackTrace: 'Error at line 42', grpcCall: 'findUser' },
    stack: 'Error: User not found\n    at findUser (/app/src/userService.ts:42:9)',
    operation: 'findUser',
    requestId: 'req-abc-123',
    timestamp: '2024-01-01T12:00:00.000Z',
    customField: 'custom gRPC value',
  };
}

/** Создает mock ContractValidationError для тестов */
function createMockContractValidationError(
  message: string = 'Invalid gRPC status code',
  field: string = 'grpcCode',
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

describe('GrpcErrorContract', () => {
  describe('GRPC_STATUS_CODES', () => {
    it('содержит все стандартные gRPC статус коды', () => {
      expect(GRPC_STATUS_CODES).toEqual({
        OK: 0,
        CANCELLED: 1,
        UNKNOWN: 2,
        INVALID_ARGUMENT: 3,
        DEADLINE_EXCEEDED: 4,
        NOT_FOUND: 5,
        ALREADY_EXISTS: 6,
        PERMISSION_DENIED: 7,
        RESOURCE_EXHAUSTED: 8,
        FAILED_PRECONDITION: 9,
        ABORTED: 10,
        OUT_OF_RANGE: 11,
        UNIMPLEMENTED: 12,
        INTERNAL: 13,
        UNAVAILABLE: 14,
        DATA_LOSS: 15,
        UNAUTHENTICATED: 16,
      });
    });

    it('все значения являются числами', () => {
      Object.values(GRPC_STATUS_CODES).forEach((code) => {
        expect(typeof code).toBe('number');
        expect(Number.isInteger(code)).toBe(true);
      });
    });

    it('все значения уникальны', () => {
      const codes = Object.values(GRPC_STATUS_CODES);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('createGrpcErrorContract', () => {
    describe('успешные кейсы', () => {
      it('создает контракт с минимальными обязательными полями', () => {
        const result = createGrpcErrorContract(
          GRPC_STATUS_CODES.NOT_FOUND,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'User not found',
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract.code).toBe(GRPC_STATUS_CODES.NOT_FOUND);
        expect(contract.message).toBe('User not found');
        expect(contract.metadata.errorCode).toBe('SHARED_DOMAIN_USER_NOT_FOUND');
        expect(typeof contract.metadata.timestamp).toBe('string');
        expect(contract.metadata.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
      });

      it('создает контракт с деталями ошибки', () => {
        const details = createMockErrorDetails();
        const result = createGrpcErrorContract(
          GRPC_STATUS_CODES.INTERNAL,
          'SHARED_INFRA_DATABASE_ERROR',
          'Database connection failed',
          details,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract.metadata.details).toEqual(details);
      });

      it('создает контракт с correlation ID', () => {
        const correlationId = 'corr-123-456';
        const result = createGrpcErrorContract(
          GRPC_STATUS_CODES.UNAVAILABLE,
          'SHARED_ADAPTER_HTTP_TIMEOUT',
          'Service unavailable',
          undefined,
          correlationId,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract.metadata.correlationId).toBe(correlationId);
      });

      it('триммит пробелы в сообщении', () => {
        const result = createGrpcErrorContract(
          GRPC_STATUS_CODES.INVALID_ARGUMENT,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          '  Invalid argument provided  ',
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const contract = (result as any).right;

        expect(contract.message).toBe('Invalid argument provided');
      });

      it('работает с различными gRPC статус кодами', () => {
        const validCodes = [
          GRPC_STATUS_CODES.OK,
          GRPC_STATUS_CODES.CANCELLED,
          GRPC_STATUS_CODES.UNKNOWN,
          GRPC_STATUS_CODES.INVALID_ARGUMENT,
          GRPC_STATUS_CODES.DEADLINE_EXCEEDED,
          GRPC_STATUS_CODES.NOT_FOUND,
          GRPC_STATUS_CODES.ALREADY_EXISTS,
          GRPC_STATUS_CODES.PERMISSION_DENIED,
          GRPC_STATUS_CODES.RESOURCE_EXHAUSTED,
          GRPC_STATUS_CODES.FAILED_PRECONDITION,
          GRPC_STATUS_CODES.ABORTED,
          GRPC_STATUS_CODES.OUT_OF_RANGE,
          GRPC_STATUS_CODES.UNIMPLEMENTED,
          GRPC_STATUS_CODES.INTERNAL,
          GRPC_STATUS_CODES.UNAVAILABLE,
          GRPC_STATUS_CODES.DATA_LOSS,
          GRPC_STATUS_CODES.UNAUTHENTICATED,
        ];

        validCodes.forEach((grpcCode) => {
          const result = createGrpcErrorContract(
            grpcCode,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Right');
          expect((result as any).right.code).toBe(grpcCode);
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
          const result = createGrpcErrorContract(
            GRPC_STATUS_CODES.NOT_FOUND,
            code,
            'Test message',
          );

          expect(result._tag).toBe('Right');
          expect((result as any).right.metadata.errorCode).toBe(code);
        });
      });
    });

    describe('ошибки валидации', () => {
      describe('gRPC код', () => {
        it('возвращает ошибку для невалидного gRPC кода', () => {
          const result = createGrpcErrorContract(
            999,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid gRPC status code',
            field: 'grpcCode',
            value: 999,
          });
        });

        it('возвращает ошибку для нецелого gRPC кода', () => {
          const result = createGrpcErrorContract(
            5.5,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid gRPC status code',
            field: 'grpcCode',
            value: 5.5,
          });
        });

        it('возвращает ошибку для отрицательного gRPC кода', () => {
          const result = createGrpcErrorContract(
            -1,
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid gRPC status code',
            field: 'grpcCode',
            value: -1,
          });
        });
      });

      describe('код ошибки', () => {
        it('возвращает ошибку для кода без префикса SHARED_', () => {
          const result = createGrpcErrorContract(
            GRPC_STATUS_CODES.NOT_FOUND,
            'DOMAIN_USER_NOT_FOUND',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error code format',
            field: 'errorCode',
            value: 'DOMAIN_USER_NOT_FOUND',
          });
        });

        it('возвращает ошибку для нестрокового кода', () => {
          const result = createGrpcErrorContract(
            GRPC_STATUS_CODES.NOT_FOUND,
            123 as any,
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error code format',
            field: 'errorCode',
            value: 123,
          });
        });

        it('возвращает ошибку для пустого кода', () => {
          const result = createGrpcErrorContract(
            GRPC_STATUS_CODES.NOT_FOUND,
            '',
            'Test message',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error code format',
            field: 'errorCode',
            value: '',
          });
        });
      });

      describe('сообщение', () => {
        it('возвращает ошибку для пустого сообщения', () => {
          const result = createGrpcErrorContract(
            GRPC_STATUS_CODES.NOT_FOUND,
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
          const result = createGrpcErrorContract(
            GRPC_STATUS_CODES.NOT_FOUND,
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
          const result = createGrpcErrorContract(
            GRPC_STATUS_CODES.NOT_FOUND,
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

  describe('isGrpcErrorContract', () => {
    describe('возвращает true для валидных контрактов', () => {
      it('базовый контракт', () => {
        const contract = createMockGrpcErrorContract();
        expect(isGrpcErrorContract(contract)).toBe(true);
      });

      it('контракт с деталями', () => {
        const contract = createMockGrpcErrorContract(
          GRPC_STATUS_CODES.INTERNAL,
          'SHARED_INFRA_DATABASE_ERROR',
          'Database error',
          createMockErrorDetails(),
        );
        expect(isGrpcErrorContract(contract)).toBe(true);
      });

      it('контракт с correlation ID', () => {
        const contract = createMockGrpcErrorContract(
          GRPC_STATUS_CODES.UNAVAILABLE,
          'SHARED_ADAPTER_HTTP_TIMEOUT',
          'Service unavailable',
          undefined,
          'corr-123',
        );
        expect(isGrpcErrorContract(contract)).toBe(true);
      });

      it('работает с различными валидными gRPC кодами', () => {
        const validCodes = [
          GRPC_STATUS_CODES.OK,
          GRPC_STATUS_CODES.NOT_FOUND,
          GRPC_STATUS_CODES.INTERNAL,
          GRPC_STATUS_CODES.UNAVAILABLE,
          GRPC_STATUS_CODES.UNAUTHENTICATED,
        ];

        validCodes.forEach((code) => {
          const contract = createMockGrpcErrorContract(code);
          expect(isGrpcErrorContract(contract)).toBe(true);
        });
      });
    });

    describe('возвращает false для невалидных объектов', () => {
      it('null', () => {
        expect(isGrpcErrorContract(null)).toBe(false);
      });

      it('undefined', () => {
        expect(isGrpcErrorContract(undefined)).toBe(false);
      });

      it('строка', () => {
        expect(isGrpcErrorContract('not an object')).toBe(false);
      });

      it('число', () => {
        expect(isGrpcErrorContract(42)).toBe(false);
      });

      it('пустой объект', () => {
        expect(isGrpcErrorContract({})).toBe(false);
      });

      it('объект без code', () => {
        const invalid = { message: 'test', metadata: {} };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с нечисловым code', () => {
        const invalid = { code: '5', message: 'test', metadata: {} };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с нецелым code', () => {
        const invalid = { code: 5.5, message: 'test', metadata: {} };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с невалидным gRPC code', () => {
        const invalid = { code: 999, message: 'test', metadata: {} };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект без message', () => {
        const invalid = { code: GRPC_STATUS_CODES.NOT_FOUND, metadata: {} };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с нестроковым message', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 123,
          metadata: {},
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с пустым message', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: '',
          metadata: {},
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с message из одних пробелов', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: '   ',
          metadata: {},
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект без metadata', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с не-объектом metadata', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: 'invalid',
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с null metadata', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: null,
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект без errorCode в metadata', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: { timestamp: '2024-01-01T12:00:00.000Z' },
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с нестроковым errorCode', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: { errorCode: 123, timestamp: '2024-01-01T12:00:00.000Z' },
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с errorCode без SHARED_ префикса', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: { errorCode: 'DOMAIN_ERROR', timestamp: '2024-01-01T12:00:00.000Z' },
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект без timestamp в metadata', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: { errorCode: 'SHARED_DOMAIN_USER_NOT_FOUND' },
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с нестроковым timestamp', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: { errorCode: 'SHARED_DOMAIN_USER_NOT_FOUND', timestamp: 123 },
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });

      it('объект с пустым timestamp', () => {
        const invalid = {
          code: GRPC_STATUS_CODES.NOT_FOUND,
          message: 'test',
          metadata: { errorCode: 'SHARED_DOMAIN_USER_NOT_FOUND', timestamp: '' },
        };
        expect(isGrpcErrorContract(invalid)).toBe(false);
      });
    });
  });

  describe('getGrpcErrorCode', () => {
    it('извлекает код ошибки из контракта', () => {
      const contract = createMockGrpcErrorContract(
        GRPC_STATUS_CODES.NOT_FOUND,
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'User not found',
      );

      const code = getGrpcErrorCode(contract);
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
        const contract = createMockGrpcErrorContract(
          GRPC_STATUS_CODES.INTERNAL,
          expectedCode,
          'Test',
        );
        expect(getGrpcErrorCode(contract)).toBe(expectedCode);
      });
    });
  });

  describe('getGrpcCorrelationId', () => {
    it('возвращает undefined если correlation ID отсутствует', () => {
      const contract = createMockGrpcErrorContract(
        GRPC_STATUS_CODES.NOT_FOUND,
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'User not found',
      );

      const correlationId = getGrpcCorrelationId(contract);
      expect(correlationId).toBeUndefined();
    });

    it('извлекает correlation ID из контракта', () => {
      const expectedCorrelationId = 'corr-123-456-789';
      const contract = createMockGrpcErrorContract(
        GRPC_STATUS_CODES.INTERNAL,
        'SHARED_INFRA_DATABASE_ERROR',
        'Database error',
        undefined,
        expectedCorrelationId,
      );

      const correlationId = getGrpcCorrelationId(contract);
      expect(correlationId).toBe(expectedCorrelationId);
    });

    it('работает с различными correlation ID', () => {
      const testIds = [
        'corr-123',
        'correlation-456',
        'req-abc-123',
        'trace-789-xyz',
      ];

      testIds.forEach((expectedId) => {
        const contract = createMockGrpcErrorContract(
          GRPC_STATUS_CODES.UNAVAILABLE,
          'SHARED_ADAPTER_HTTP_TIMEOUT',
          'Timeout',
          undefined,
          expectedId,
        );
        expect(getGrpcCorrelationId(contract)).toBe(expectedId);
      });
    });
  });

  describe('getGrpcErrorDetails', () => {
    it('возвращает undefined если деталей нет', () => {
      const contract = createMockGrpcErrorContract(
        GRPC_STATUS_CODES.NOT_FOUND,
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'User not found',
      );

      const details = getGrpcErrorDetails(contract);
      expect(details).toBeUndefined();
    });

    it('извлекает детали ошибки из контракта', () => {
      const expectedDetails = createMockErrorDetails();
      const contract = createMockGrpcErrorContract(
        GRPC_STATUS_CODES.INTERNAL,
        'SHARED_INFRA_DATABASE_ERROR',
        'Database error',
        expectedDetails,
      );

      const details = getGrpcErrorDetails(contract);
      expect(details).toEqual(expectedDetails);
    });

    it('работает с различными типами деталей', () => {
      const testDetails = [
        { simple: 'grpc_value' },
        { nested: { grpc_key: 'grpc_value' } },
        { array: [4, 5, 6] },
        { mixed: { string: 'grpc_test', number: 99, boolean: false } },
      ];

      testDetails.forEach((expectedDetails) => {
        const contract = createMockGrpcErrorContract(
          GRPC_STATUS_CODES.INVALID_ARGUMENT,
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'Invalid argument',
          expectedDetails,
        );
        expect(getGrpcErrorDetails(contract)).toEqual(expectedDetails);
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
          'Custom gRPC message',
          'grpcField',
          'grpcValue',
        );
        expect(isContractValidationError(error)).toBe(true);
      });

      it('ошибка валидации без поля field', () => {
        const error = {
          type: 'CONTRACT_VALIDATION_ERROR',
          message: 'Test gRPC message',
        };
        expect(isContractValidationError(error)).toBe(true);
      });

      it('ошибка валидации без поля value', () => {
        const error = {
          type: 'CONTRACT_VALIDATION_ERROR',
          message: 'Test gRPC message',
          field: 'testGrpcField',
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
