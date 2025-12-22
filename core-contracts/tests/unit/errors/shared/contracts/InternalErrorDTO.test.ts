import { describe, expect, it } from 'vitest';

import {
  createInternalErrorDTO,
  getInternalCorrelationId,
  getInternalErrorCategory,
  getInternalErrorChain,
  getInternalErrorCode,
  getInternalErrorComponent,
  hasInternalErrorCause,
  isContractValidationError,
  isInternalErrorDTO,
} from '../../../../../src/errors/shared/contracts/InternalErrorDTO';
import type {
  ContractValidationError,
  ErrorDetails,
  ExecutionContext,
  InternalErrorDTO,
} from '../../../../../src/errors/shared/contracts/InternalErrorDTO';
import type {
  SharedErrorCategory,
  SharedErrorCodeString,
} from '../../../../../src/errors/shared/SharedErrorTypes';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock InternalErrorDTO для тестов */
function createMockInternalErrorDTO(
  id: string = 'test-id-123',
  code: SharedErrorCodeString = 'SHARED_DOMAIN_USER_NOT_FOUND',
  category: SharedErrorCategory = 'domain',
  message: string = 'User not found',
  details?: ErrorDetails,
  correlationId?: string,
  componentId: string = 'user-service',
  componentVersion: string = '1.0.0',
  environment: ExecutionContext = 'development',
  timestamp: string = '2024-01-01T12:00:00.000Z',
  cause?: InternalErrorDTO,
): InternalErrorDTO {
  return {
    id,
    code,
    category,
    message: message.trim(),
    ...(details !== undefined ? { details } : {}),
    metadata: {
      timestamp,
      ...(correlationId !== undefined ? { correlationId } : {}),
      componentId: componentId.trim(),
      componentVersion: componentVersion.trim(),
      environment,
    },
    ...(cause !== undefined ? { cause } : {}),
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
    customField: 'custom internal value',
  };
}

/** Создает mock ContractValidationError для тестов */
function createMockContractValidationError(
  message: string = 'Invalid error code format',
  field: string = 'code',
  value?: unknown,
): ContractValidationError {
  return {
    type: 'CONTRACT_VALIDATION_ERROR',
    message,
    field,
    value,
  };
}

/** Создает цепочку InternalErrorDTO для тестирования */
function createMockErrorChain(depth: number = 3): InternalErrorDTO[] {
  if (depth === 0) return [];

  const errors: InternalErrorDTO[] = [];
  let cause: InternalErrorDTO | undefined;

  // Создаем цепочку от самой глубокой к корневой
  for (let i = 1; i <= depth; i++) {
    const error = createMockInternalErrorDTO(
      `error-${i}`,
      'SHARED_INFRA_DATABASE_ERROR',
      'infrastructure',
      `Error at level ${i}`,
      undefined,
      `corr-${i}`,
      `component-${i}`,
      `1.${i}.0`,
      'production',
      `2024-01-01T12:0${i}:00.000Z`,
      cause,
    );
    errors.push(error);
    cause = error;
  }

  return errors;
}

// ==================== TESTS ====================

describe('InternalErrorDTO', () => {
  describe('createInternalErrorDTO', () => {
    describe('успешные кейсы', () => {
      it('создает DTO с минимальными обязательными полями', () => {
        const result = createInternalErrorDTO(
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'domain',
          'User not found',
          'user-service',
          '1.0.0',
          'development',
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const dto = (result as any).right;

        expect(dto.code).toBe('SHARED_DOMAIN_USER_NOT_FOUND');
        expect(dto.category).toBe('domain');
        expect(dto.message).toBe('User not found');
        expect(dto.metadata.componentId).toBe('user-service');
        expect(dto.metadata.componentVersion).toBe('1.0.0');
        expect(dto.metadata.environment).toBe('development');
        expect(typeof dto.id).toBe('string');
        expect(dto.id.length).toBeGreaterThan(0);
        expect(typeof dto.metadata.timestamp).toBe('string');
        expect(dto.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('создает DTO с деталями ошибки', () => {
        const details = createMockErrorDetails();
        const result = createInternalErrorDTO(
          'SHARED_INFRA_DATABASE_ERROR',
          'infrastructure',
          'Database connection failed',
          'db-service',
          '2.1.0',
          'production',
          details,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const dto = (result as any).right;

        expect(dto.details).toEqual(details);
      });

      it('создает DTO с correlation ID', () => {
        const correlationId = 'corr-123-456-789';
        const result = createInternalErrorDTO(
          'SHARED_POLICY_RATE_LIMIT_EXCEEDED',
          'policy',
          'Rate limit exceeded',
          'api-gateway',
          '3.0.1',
          'staging',
          undefined,
          correlationId,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const dto = (result as any).right;

        expect(dto.metadata.correlationId).toBe(correlationId);
      });

      it('создает DTO с cause (цепочка ошибок)', () => {
        const cause = createMockInternalErrorDTO();
        const result = createInternalErrorDTO(
          'SHARED_INFRA_DATABASE_ERROR',
          'infrastructure',
          'Database wrapper failed',
          'db-wrapper',
          '1.2.0',
          'development',
          undefined,
          undefined,
          cause,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const dto = (result as any).right;

        expect(dto.cause).toEqual(cause);
      });

      it('создает DTO с кастомным ID', () => {
        const customId = 'custom-error-id-123';
        const result = createInternalErrorDTO(
          'SHARED_ADAPTER_HTTP_TIMEOUT',
          'adapter',
          'HTTP timeout',
          'http-adapter',
          '1.5.0',
          'testing',
          undefined,
          undefined,
          undefined,
          customId,
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const dto = (result as any).right;

        expect(dto.id).toBe(customId);
      });

      it('триммит пробелы в строковых полях', () => {
        const result = createInternalErrorDTO(
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'domain',
          '  User not found  ',
          '  user-service  ',
          '  1.0.0  ',
          'development',
        );

        expect(result._tag).toBe('Right');
        expect(result).toHaveProperty('right');
        const dto = (result as any).right;

        expect(dto.message).toBe('User not found');
        expect(dto.metadata.componentId).toBe('user-service');
        expect(dto.metadata.componentVersion).toBe('1.0.0');
      });

      it('работает с различными категориями ошибок', () => {
        const categories: SharedErrorCategory[] = ['domain', 'infrastructure', 'policy', 'adapter'];

        categories.forEach((category) => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            category,
            'Test message',
            'test-component',
            '1.0.0',
            'development',
          );

          expect(result._tag).toBe('Right');
          expect((result as any).right.category).toBe(category);
        });
      });

      it('работает с различными ExecutionContext', () => {
        const contexts: ExecutionContext[] = ['development', 'staging', 'production', 'testing'];

        contexts.forEach((context) => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            'test-component',
            '1.0.0',
            context,
          );

          expect(result._tag).toBe('Right');
          expect((result as any).right.metadata.environment).toBe(context);
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
          const result = createInternalErrorDTO(
            code,
            'domain',
            'Test message',
            'test-component',
            '1.0.0',
            'development',
          );

          expect(result._tag).toBe('Right');
          expect((result as any).right.code).toBe(code);
        });
      });
    });

    describe('ошибки валидации', () => {
      describe('код ошибки', () => {
        it('возвращает ошибку для кода без префикса SHARED_', () => {
          const result = createInternalErrorDTO(
            'DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            'test-component',
            '1.0.0',
            'development',
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
          const result = createInternalErrorDTO(
            123 as any,
            'domain',
            'Test message',
            'test-component',
            '1.0.0',
            'development',
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
          const result = createInternalErrorDTO(
            '',
            'domain',
            'Test message',
            'test-component',
            '1.0.0',
            'development',
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

      describe('категория ошибки', () => {
        it('возвращает ошибку для невалидной категории', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'invalid_category' as any,
            'Test message',
            'test-component',
            '1.0.0',
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error category',
            field: 'category',
            value: 'invalid_category',
          });
        });

        it('возвращает ошибку для нестроковой категории', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            123 as any,
            'Test message',
            'test-component',
            '1.0.0',
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Invalid error category',
            field: 'category',
            value: 123,
          });
        });
      });

      describe('сообщение', () => {
        it('возвращает ошибку для пустого сообщения', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            '',
            'test-component',
            '1.0.0',
            'development',
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
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            '   ',
            'test-component',
            '1.0.0',
            'development',
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
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            null as any,
            'test-component',
            '1.0.0',
            'development',
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

      describe('component ID', () => {
        it('возвращает ошибку для пустого component ID', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            '',
            '1.0.0',
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Component ID cannot be empty',
            field: 'componentId',
            value: '',
          });
        });

        it('возвращает ошибку для component ID из одних пробелов', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            '   ',
            '1.0.0',
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Component ID cannot be empty',
            field: 'componentId',
            value: '   ',
          });
        });

        it('возвращает ошибку для нестрокового component ID', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            123 as any,
            '1.0.0',
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Component ID cannot be empty',
            field: 'componentId',
            value: 123,
          });
        });
      });

      describe('component version', () => {
        it('возвращает ошибку для пустой component version', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            'test-component',
            '',
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Component version cannot be empty',
            field: 'componentVersion',
            value: '',
          });
        });

        it('возвращает ошибку для component version из одних пробелов', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            'test-component',
            '   ',
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Component version cannot be empty',
            field: 'componentVersion',
            value: '   ',
          });
        });

        it('возвращает ошибку для нестроковой component version', () => {
          const result = createInternalErrorDTO(
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            'test-component',
            123 as any,
            'development',
          );

          expect(result._tag).toBe('Left');
          expect(result).toHaveProperty('left');
          const error = (result as any).left;

          expect(error).toEqual({
            type: 'CONTRACT_VALIDATION_ERROR',
            message: 'Component version cannot be empty',
            field: 'componentVersion',
            value: 123,
          });
        });
      });
    });
  });

  describe('isInternalErrorDTO', () => {
    describe('возвращает true для валидных DTO', () => {
      it('базовый DTO', () => {
        const dto = createMockInternalErrorDTO();
        expect(isInternalErrorDTO(dto)).toBe(true);
      });

      it('DTO с деталями', () => {
        const dto = createMockInternalErrorDTO(
          'test-id-456',
          'SHARED_INFRA_DATABASE_ERROR',
          'infrastructure',
          'Database error',
          createMockErrorDetails(),
        );
        expect(isInternalErrorDTO(dto)).toBe(true);
      });

      it('DTO с correlation ID', () => {
        const dto = createMockInternalErrorDTO(
          'test-id-789',
          'SHARED_POLICY_RATE_LIMIT_EXCEEDED',
          'policy',
          'Rate limit exceeded',
          undefined,
          'corr-123',
        );
        expect(isInternalErrorDTO(dto)).toBe(true);
      });

      it('DTO с cause', () => {
        const cause = createMockInternalErrorDTO('cause-id');
        const dto = createMockInternalErrorDTO(
          'main-id',
          'SHARED_ADAPTER_HTTP_TIMEOUT',
          'adapter',
          'HTTP timeout',
          undefined,
          undefined,
          'http-adapter',
          '1.0.0',
          'production',
          '2024-01-01T12:00:00.000Z',
          cause,
        );
        expect(isInternalErrorDTO(dto)).toBe(true);
      });

      it('работает с различными категориями', () => {
        const categories: SharedErrorCategory[] = ['domain', 'infrastructure', 'policy', 'adapter'];

        categories.forEach((category) => {
          const dto = createMockInternalErrorDTO(
            'test-id',
            'SHARED_DOMAIN_USER_NOT_FOUND',
            category,
            'Test message',
          );
          expect(isInternalErrorDTO(dto)).toBe(true);
        });
      });

      it('работает с различными ExecutionContext', () => {
        const contexts: ExecutionContext[] = ['development', 'staging', 'production', 'testing'];

        contexts.forEach((context) => {
          const dto = createMockInternalErrorDTO(
            'test-id',
            'SHARED_DOMAIN_USER_NOT_FOUND',
            'domain',
            'Test message',
            undefined,
            undefined,
            'test-component',
            '1.0.0',
            context,
          );
          expect(isInternalErrorDTO(dto)).toBe(true);
        });
      });

      it('работает с цепочками ошибок', () => {
        const chain = createMockErrorChain(3);
        expect(isInternalErrorDTO(chain[2])).toBe(true); // Самая глубокая ошибка с cause
      });
    });

    describe('возвращает false для невалидных объектов', () => {
      it('null', () => {
        expect(isInternalErrorDTO(null)).toBe(false);
      });

      it('undefined', () => {
        expect(isInternalErrorDTO(undefined)).toBe(false);
      });

      it('строка', () => {
        expect(isInternalErrorDTO('not an object')).toBe(false);
      });

      it('число', () => {
        expect(isInternalErrorDTO(42)).toBe(false);
      });

      it('пустой объект', () => {
        expect(isInternalErrorDTO({})).toBe(false);
      });

      it('объект без id', () => {
        const invalid = {
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковым id', () => {
        const invalid = {
          id: 123,
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с пустым id', () => {
        const invalid = {
          id: '',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с id из одних пробелов', () => {
        const invalid = {
          id: '   ',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без code', () => {
        const invalid = {
          id: 'test-id',
          category: 'domain',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковым code', () => {
        const invalid = {
          id: 'test-id',
          code: 123,
          category: 'domain',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с code без SHARED_ префикса', () => {
        const invalid = {
          id: 'test-id',
          code: 'DOMAIN_ERROR',
          category: 'domain',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без category', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковой category', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 123,
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с невалидной category', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'invalid',
          message: 'test',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без message', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковым message', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 123,
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с пустым message', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: '',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с message из одних пробелов', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: '   ',
          metadata: {},
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без metadata', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с не-объектом metadata', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: 'invalid',
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с null metadata', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: null,
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без timestamp в metadata', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: { componentId: 'test', componentVersion: '1.0.0', environment: 'development' },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковым timestamp', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: 123,
            componentId: 'test',
            componentVersion: '1.0.0',
            environment: 'development',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с пустым timestamp', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '',
            componentId: 'test',
            componentVersion: '1.0.0',
            environment: 'development',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без componentId в metadata', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentVersion: '1.0.0',
            environment: 'development',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковым componentId', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: 123,
            componentVersion: '1.0.0',
            environment: 'development',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с пустым componentId', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: '',
            componentVersion: '1.0.0',
            environment: 'development',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без componentVersion в metadata', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: 'test',
            environment: 'development',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковой componentVersion', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: 'test',
            componentVersion: 123,
            environment: 'development',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект без environment в metadata', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: 'test',
            componentVersion: '1.0.0',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с нестроковым environment', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: 'test',
            componentVersion: '1.0.0',
            environment: 123,
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с невалидным environment', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: 'test',
            componentVersion: '1.0.0',
            environment: 'invalid',
          },
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });

      it('объект с невалидным cause', () => {
        const invalid = {
          id: 'test-id',
          code: 'SHARED_DOMAIN_USER_NOT_FOUND',
          category: 'domain',
          message: 'test',
          metadata: {
            timestamp: '2024-01-01T12:00:00.000Z',
            componentId: 'test',
            componentVersion: '1.0.0',
            environment: 'development',
          },
          cause: 'invalid cause',
        };
        expect(isInternalErrorDTO(invalid)).toBe(false);
      });
    });
  });

  describe('getInternalErrorCode', () => {
    it('извлекает код ошибки из DTO', () => {
      const dto = createMockInternalErrorDTO(
        'test-id',
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'domain',
        'User not found',
      );

      const code = getInternalErrorCode(dto);
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
        const dto = createMockInternalErrorDTO('test-id', expectedCode, 'domain', 'Test');
        expect(getInternalErrorCode(dto)).toBe(expectedCode);
      });
    });
  });

  describe('getInternalErrorCategory', () => {
    it('извлекает категорию ошибки из DTO', () => {
      const dto = createMockInternalErrorDTO(
        'test-id',
        'SHARED_INFRA_DATABASE_ERROR',
        'infrastructure',
        'Database error',
      );

      const category = getInternalErrorCategory(dto);
      expect(category).toBe('infrastructure');
    });

    it('работает с различными категориями', () => {
      const categories: SharedErrorCategory[] = ['domain', 'infrastructure', 'policy', 'adapter'];

      categories.forEach((expectedCategory) => {
        const dto = createMockInternalErrorDTO(
          'test-id',
          'SHARED_DOMAIN_USER_NOT_FOUND',
          expectedCategory,
          'Test',
        );
        expect(getInternalErrorCategory(dto)).toBe(expectedCategory);
      });
    });
  });

  describe('getInternalCorrelationId', () => {
    it('возвращает undefined если correlation ID отсутствует', () => {
      const dto = createMockInternalErrorDTO(
        'test-id',
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'domain',
        'User not found',
      );

      const correlationId = getInternalCorrelationId(dto);
      expect(correlationId).toBeUndefined();
    });

    it('извлекает correlation ID из DTO', () => {
      const expectedCorrelationId = 'corr-123-456-789';
      const dto = createMockInternalErrorDTO(
        'test-id',
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'domain',
        'User not found',
        undefined,
        expectedCorrelationId,
      );

      const correlationId = getInternalCorrelationId(dto);
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
        const dto = createMockInternalErrorDTO(
          'test-id',
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'domain',
          'Test',
          undefined,
          expectedId,
        );
        expect(getInternalCorrelationId(dto)).toBe(expectedId);
      });
    });
  });

  describe('getInternalErrorComponent', () => {
    it('извлекает component ID из DTO', () => {
      const dto = createMockInternalErrorDTO(
        'test-id',
        'SHARED_DOMAIN_USER_NOT_FOUND',
        'domain',
        'User not found',
        undefined,
        undefined,
        'user-service',
      );

      const componentId = getInternalErrorComponent(dto);
      expect(componentId).toBe('user-service');
    });

    it('работает с различными component ID', () => {
      const testComponents = [
        'user-service',
        'db-adapter',
        'api-gateway',
        'auth-provider',
      ];

      testComponents.forEach((expectedComponent) => {
        const dto = createMockInternalErrorDTO(
          'test-id',
          'SHARED_DOMAIN_USER_NOT_FOUND',
          'domain',
          'Test',
          undefined,
          undefined,
          expectedComponent,
        );
        expect(getInternalErrorComponent(dto)).toBe(expectedComponent);
      });
    });
  });

  describe('hasInternalErrorCause', () => {
    it('возвращает false если cause отсутствует', () => {
      const dto = createMockInternalErrorDTO();

      const hasCause = hasInternalErrorCause(dto);
      expect(hasCause).toBe(false);
    });

    it('возвращает true если cause присутствует', () => {
      const cause = createMockInternalErrorDTO('cause-id');
      const dto = createMockInternalErrorDTO(
        'main-id',
        'SHARED_INFRA_DATABASE_ERROR',
        'infrastructure',
        'Main error',
        undefined,
        undefined,
        'main-component',
        '1.0.0',
        'development',
        '2024-01-01T12:00:00.000Z',
        cause,
      );

      const hasCause = hasInternalErrorCause(dto);
      expect(hasCause).toBe(true);
    });
  });

  describe('getInternalErrorChain', () => {
    it('возвращает массив с одной ошибкой если cause отсутствует', () => {
      const dto = createMockInternalErrorDTO('single-id');

      const chain = getInternalErrorChain(dto);
      expect(chain).toEqual([dto]);
      expect(chain).toHaveLength(1);
    });

    it('возвращает цепочку ошибок в правильном порядке', () => {
      const chain = createMockErrorChain(3);
      const rootError = chain[2]; // Ошибка с cause

      const resultChain = getInternalErrorChain(rootError);

      expect(resultChain).toHaveLength(3);
      expect(resultChain[0]).toEqual(chain[0]); // Самая глубокая ошибка
      expect(resultChain[1]).toEqual(chain[1]); // Средняя ошибка
      expect(resultChain[2]).toEqual(chain[2]); // Корневая ошибка
    });

    it('работает с цепочками разной длины', () => {
      [1, 2, 3, 5].forEach((length) => {
        const chain = createMockErrorChain(length);
        const rootError = chain[length - 1];

        const resultChain = getInternalErrorChain(rootError);
        expect(resultChain).toHaveLength(length);

        // Проверяем что порядок правильный (от самой глубокой к корневой)
        expect(resultChain).toEqual(chain);
      });
    });

    it('правильно обрабатывает глубоко вложенные цепочки', () => {
      const deepChain = createMockErrorChain(10);
      const rootError = deepChain[9];

      const resultChain = getInternalErrorChain(rootError);
      expect(resultChain).toHaveLength(10);

      // Проверяем что все ошибки присутствуют в правильном порядке
      expect(resultChain).toEqual(deepChain);
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
          'Custom internal message',
          'internalField',
          'internalValue',
        );
        expect(isContractValidationError(error)).toBe(true);
      });

      it('ошибка валидации без поля field', () => {
        const error = {
          type: 'CONTRACT_VALIDATION_ERROR',
          message: 'Test internal message',
        };
        expect(isContractValidationError(error)).toBe(true);
      });

      it('ошибка валидации без поля value', () => {
        const error = {
          type: 'CONTRACT_VALIDATION_ERROR',
          message: 'Test internal message',
          field: 'testInternalField',
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
