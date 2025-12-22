import { describe, expect, it } from 'vitest';

import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../src/errors/base/ErrorCode';
import type { BaseError } from '../../../../../src/errors/base/BaseError';
import type {
  CorrelationId,
  MetadataTimestamp,
} from '../../../../../src/errors/base/ErrorMetadata';
import {
  createGraphqlSerializer,
  deserializeFromGraphqlString,
  serializeToGraphql,
  serializeToGraphqlString,
} from '../../../../../src/errors/shared/serialization/GraphqlSerializer';
import type {
  GraphqlError,
  GraphqlSerializationResult,
  GraphqlSerializerConfig,
} from '../../../../../src/errors/shared/serialization/GraphqlSerializer';

// ==================== HELPER FUNCTIONS ====================

/** Создает mock BaseError для тестов */
function createMockBaseError(): BaseError {
  return {
    _tag: 'BaseError',
    code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Test GraphQL error message',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [],
    codeMetadata: {
      code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'Test GraphQL error',
      severity: ERROR_SEVERITY.HIGH,
      category: ERROR_CATEGORY.TECHNICAL,
      origin: ERROR_ORIGIN.INFRASTRUCTURE,
    },
    metadata: {
      context: {
        correlationId: 'test-correlation-id' as CorrelationId,
        timestamp: Date.now() as MetadataTimestamp,
      },
    },
  };
}

/** Создает mock BaseError с cause chain */
function createMockBaseErrorWithCause(): BaseError {
  const cause: BaseError = {
    _tag: 'BaseError',
    code: 'CAUSE_ERROR',
    message: 'Cause error message',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [],
    codeMetadata: {
      code: 'CAUSE_ERROR',
      description: 'Cause error',
      severity: ERROR_SEVERITY.MEDIUM,
      category: ERROR_CATEGORY.TECHNICAL,
      origin: ERROR_ORIGIN.INFRASTRUCTURE,
    },
    metadata: {
      context: {
        correlationId: 'test-cause-id' as CorrelationId,
        timestamp: Date.now() as MetadataTimestamp,
      },
    },
  };

  return {
    _tag: 'BaseError',
    code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Main error with cause',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [cause],
    codeMetadata: {
      code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'Main error with cause',
      severity: ERROR_SEVERITY.HIGH,
      category: ERROR_CATEGORY.TECHNICAL,
      origin: ERROR_ORIGIN.INFRASTRUCTURE,
    },
    metadata: {
      context: {
        correlationId: 'test-main-id' as CorrelationId,
        timestamp: Date.now() as MetadataTimestamp,
      },
    },
  };
}

// ==================== TESTS ====================

describe('GraphqlSerializer', () => {
  describe('createGraphqlSerializer', () => {
    it('создает сериализатор с дефолтной конфигурацией', () => {
      const serializer = createGraphqlSerializer();
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.serializer).toBe('graphql');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.config.includeExtensions).toBe(true);
      expect(result.metadata.config.detailLevel).toBe('detailed');
    });

    it('создает сериализатор с кастомной конфигурацией', () => {
      const config: Partial<GraphqlSerializerConfig> = {
        includeMetadata: false,
        includeExtensions: false,
        severityMapping: { high: 'SERVICE_UNAVAILABLE' },
      };

      const serializer = createGraphqlSerializer(config);
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.metadata.config.includeMetadata).toBe(false);
      expect(result.metadata.config.includeExtensions).toBe(false);
      expect(result.metadata.config.severityMapping).toEqual({ high: 'SERVICE_UNAVAILABLE' });
      expect(result.errors[0].extensions).toBeUndefined();
    });

    it('генерирует locations и path при наличии генераторов', () => {
      const config: Partial<GraphqlSerializerConfig> = {
        locationGenerator: () => [{ line: 1, column: 2 }],
        pathGenerator: () => ['user', 'name'],
      };

      const serializer = createGraphqlSerializer(config);
      const error = createMockBaseError();

      const result = serializer(error);
      const mainError = result.errors[0];

      expect(mainError.locations).toEqual([{ line: 1, column: 2 }]);
      expect(mainError.path).toEqual(['user', 'name']);
    });
  });

  describe('detailLevel configuration', () => {
    it('basic level включает только основную ошибку без cause chain', () => {
      const error = createMockBaseErrorWithCause();
      const serializer = createGraphqlSerializer({ detailLevel: 'basic' });
      const result = serializer(error);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Main error with cause');
      expect(result.errors[0].extensions).not.toHaveProperty('isCause'); // Нет cause ошибок
    });

    it('detailed level включает основную ошибку и cause chain', () => {
      const error = createMockBaseErrorWithCause();
      const serializer = createGraphqlSerializer({ detailLevel: 'detailed' });
      const result = serializer(error);

      expect(result.errors).toHaveLength(2); // Основная + одна cause ошибка
      expect(result.errors[0].message).toBe('Main error with cause');
      expect(result.errors[1].message).toBe('Caused by: Cause error message');
      expect(result.errors[1].extensions).toHaveProperty('isCause', true);
    });

    it('full level включает полные метаданные для основной ошибки', () => {
      const error = createMockBaseError();
      const serializer = createGraphqlSerializer({ detailLevel: 'full' });
      const result = serializer(error);

      expect(result.errors).toHaveLength(1);
      const mainError = result.errors[0];
      expect(mainError.extensions).toHaveProperty('metadata');
      const metadata = mainError.extensions?.metadata as Record<string, unknown>;
      expect(metadata).toHaveProperty('context');
      const context = metadata.context as Record<string, unknown>;
      expect(context).toHaveProperty('correlationId');
    });

    it('full level включает полные метаданные для cause chain', () => {
      const error = createMockBaseErrorWithCause();
      const serializer = createGraphqlSerializer({ detailLevel: 'full' });
      const result = serializer(error);

      expect(result.errors).toHaveLength(2);
      const causeError = result.errors[1];
      expect(causeError.extensions).toHaveProperty('causeMetadata');
      const causeMetadata = causeError.extensions?.causeMetadata as Record<string, unknown>;
      expect(causeMetadata).toHaveProperty('context');
    });
  });

  describe('serializeToGraphql', () => {
    it('сериализует BaseError в GraphQL формат', () => {
      const error = createMockBaseError();
      const result = serializeToGraphql(error);

      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBe(1);

      const mainError = result.errors[0];
      expect(mainError).toHaveProperty('message', 'Test GraphQL error message');
      expect(mainError).toHaveProperty('extensions');
    });

    it('маппит severity на GraphQL error codes по умолчанию', () => {
      const testCases = [
        { severity: ERROR_SEVERITY.LOW, expectedCode: 'BAD_USER_INPUT' },
        { severity: ERROR_SEVERITY.MEDIUM, expectedCode: 'FORBIDDEN' },
        { severity: ERROR_SEVERITY.HIGH, expectedCode: 'INTERNAL_ERROR' },
        { severity: ERROR_SEVERITY.CRITICAL, expectedCode: 'SERVICE_UNAVAILABLE' },
      ];

      testCases.forEach(({ severity, expectedCode }) => {
        const error: BaseError = {
          _tag: 'BaseError',
          code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
          message: 'Test error',
          severity,
          category: ERROR_CATEGORY.TECHNICAL,
          origin: ERROR_ORIGIN.INFRASTRUCTURE,
          timestamp: Date.now(),
          causeChain: [],
          codeMetadata: {
            code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
            description: 'Test error',
            severity,
            category: ERROR_CATEGORY.TECHNICAL,
            origin: ERROR_ORIGIN.INFRASTRUCTURE,
          },
          metadata: {
            context: {
              correlationId: 'test-correlation-id' as any,
              timestamp: Date.now() as any,
            },
          },
        };

        const result = serializeToGraphql(error);
        expect(result.errors[0].extensions?.code).toBe(expectedCode);
      });
    });

    it('использует кастомный severity mapping', () => {
      const customMapping = {
        high: 'SERVICE_UNAVAILABLE',
        critical: 'INTERNAL_ERROR',
      };

      const serializer = createGraphqlSerializer({ severityMapping: customMapping });
      const error = createMockBaseError(); // severity = HIGH

      const result = serializer(error);
      expect(result.errors[0].extensions?.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('включает extensions по умолчанию', () => {
      const error = createMockBaseError();
      const result = serializeToGraphql(error);

      const extensions = result.errors[0].extensions;
      expect(extensions).toBeDefined();
      expect(extensions?.code).toBe('INTERNAL_ERROR');
      expect(extensions?.errorCode).toBe(DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(extensions?.category).toBe(ERROR_CATEGORY.TECHNICAL);
      expect(extensions?.origin).toBe(ERROR_ORIGIN.INFRASTRUCTURE);
      expect(extensions?.timestamp).toBeDefined();
    });

    it('исключает extensions при конфигурации', () => {
      const serializer = createGraphqlSerializer({ includeExtensions: false });
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.errors[0].extensions).toBeUndefined();
    });

    it('включает метаданные в extensions в full режиме', () => {
      const error = createMockBaseError();
      const serializer = createGraphqlSerializer({ detailLevel: 'full' });
      const result = serializer(error);

      const extensions = result.errors[0].extensions;
      expect(extensions).toHaveProperty('metadata');
      expect(extensions?.metadata).toHaveProperty('context');
    });

    it('исключает метаданные при конфигурации', () => {
      const serializer = createGraphqlSerializer({ includeMetadata: false });
      const error = createMockBaseError();

      const result = serializer(error);

      const extensions = result.errors[0].extensions;
      expect(extensions).not.toHaveProperty('metadata');
    });

    it('включает cause chain', () => {
      const error = createMockBaseErrorWithCause();
      const result = serializeToGraphql(error);

      expect(result.errors.length).toBe(2);
      expect(result.errors[0].message).toBe('Main error with cause');
      expect(result.errors[1].message).toBe('Caused by: Cause error message');

      const causeExtensions = result.errors[1].extensions;
      expect(causeExtensions).toHaveProperty('isCause', true);
      expect(causeExtensions?.errorCode).toBe('CAUSE_ERROR');
    });

    it('исключает cause chain при конфигурации', () => {
      const serializer = createGraphqlSerializer({ includeCauseChain: false });
      const error = createMockBaseErrorWithCause();

      const result = serializer(error);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toBe('Main error with cause');
    });
  });

  describe('serializeToGraphqlString', () => {
    it('сериализует BaseError в GraphQL JSON строку', () => {
      const error = createMockBaseError();
      const jsonString = serializeToGraphqlString(error);

      expect(typeof jsonString).toBe('string');
      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString) as GraphqlSerializationResult;
      expect(parsed.metadata.serializer).toBe('graphql');
      expect(Array.isArray(parsed.errors)).toBe(true);
    });

    it('форматирует JSON с отступами при pretty=true', () => {
      const error = createMockBaseError();
      const jsonString = serializeToGraphqlString(error, true);

      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  ');
    });
  });

  describe('GraphQL string parsing', () => {
    it('десериализует GraphQL JSON строку обратно в объект', () => {
      const error = createMockBaseError();
      const jsonString = serializeToGraphqlString(error);
      const result = deserializeFromGraphqlString(jsonString);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('metadata');
      expect(result!.metadata.serializer).toBe('graphql');
      expect(Array.isArray(result!.errors)).toBe(true);
    });

    it('возвращает null при невалидном JSON', () => {
      const result = deserializeFromGraphqlString('invalid json');
      expect(result).toBeNull();
    });

    it('возвращает null при отсутствии обязательных полей', () => {
      const invalidJson = JSON.stringify({ someField: 'value' });
      const result = deserializeFromGraphqlString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null при неправильном serializer type', () => {
      const invalidJson = JSON.stringify({
        errors: [],
        metadata: { serializer: 'json', version: '1.0.0' },
      });
      const result = deserializeFromGraphqlString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null если errors не является массивом', () => {
      const invalidJson = JSON.stringify({
        errors: 'not an array',
        metadata: { serializer: 'graphql', version: '1.0.0' },
      });
      const result = deserializeFromGraphqlString(invalidJson);
      expect(result).toBeNull();
    });

    it('возвращает null если metadata не является объектом', () => {
      const invalidJson = JSON.stringify({
        errors: [],
        metadata: 'not an object',
      });
      const result = deserializeFromGraphqlString(invalidJson);
      expect(result).toBeNull();
    });

    it('корректно десериализует валидный GraphQL JSON', () => {
      const error = createMockBaseError();
      const originalResult = serializeToGraphql(error);
      const jsonString = JSON.stringify(originalResult);
      const deserializedResult = deserializeFromGraphqlString(jsonString);

      expect(deserializedResult).not.toBeNull();
      expect(deserializedResult!.errors).toHaveLength(originalResult.errors.length);
      expect(deserializedResult!.metadata.serializer).toBe('graphql');
      expect(deserializedResult!.metadata.version).toBe('1.0.0');
    });
  });

  describe('GraphqlSerializer structure', () => {
    it('возвращает корректную структуру результата', () => {
      const error = createMockBaseError();
      const result: GraphqlSerializationResult = serializeToGraphql(error);

      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);

      expect(result).toHaveProperty('metadata');
      expect(result.metadata.serializer).toBe('graphql');
      expect(result.metadata.version).toBe('1.0.0');
      expect(typeof result.metadata.timestamp).toBe('string');
    });

    it('все ошибки имеют корректный GraphQL формат', () => {
      const error = createMockBaseError();
      const result = serializeToGraphql(error);

      result.errors.forEach((error: GraphqlError) => {
        expect(error).toHaveProperty('message');
        expect(typeof error.message).toBe('string');

        if (error.extensions) {
          expect(error.extensions).toHaveProperty('code');
          expect(error.extensions).toHaveProperty('errorCode');
          expect(error.extensions).toHaveProperty('category');
          expect(error.extensions).toHaveProperty('origin');
          expect(error.extensions).toHaveProperty('timestamp');
        }
      });
    });

    it('ошибки cause chain помечаются соответствующим образом', () => {
      const error = createMockBaseErrorWithCause();
      const result = serializeToGraphql(error);

      const causeErrors = result.errors.filter((error: GraphqlError) =>
        error.extensions?.isCause === true
      );

      expect(causeErrors.length).toBe(1);
      expect(causeErrors[0].message).toMatch(/^Caused by:/);
    });
  });
});
