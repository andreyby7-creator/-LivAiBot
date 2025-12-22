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
  createGrpcSerializer,
  deserializeFromGrpcString,
  GRPC_STATUS_CODES,
  serializeToGrpc,
  serializeToGrpcString,
} from '../../../../../src/errors/shared/serialization/GrpcSerializer';
import type {
  GrpcSerializationResult,
  GrpcSerializerConfig,
} from '../../../../../src/errors/shared/serialization/GrpcSerializer';

// ==================== HELPER FUNCTIONS ====================

/** Создает mock BaseError для тестов */
function createMockBaseError(): BaseError {
  return {
    _tag: 'BaseError',
    code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    message: 'Test gRPC error message',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    timestamp: Date.now(),
    causeChain: [],
    codeMetadata: {
      code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
      description: 'Test gRPC error',
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

describe('GrpcSerializer', () => {
  describe('GRPC_STATUS_CODES', () => {
    it('содержит все стандартные gRPC статус коды', () => {
      expect(GRPC_STATUS_CODES.OK).toBe(0);
      expect(GRPC_STATUS_CODES.CANCELLED).toBe(1);
      expect(GRPC_STATUS_CODES.UNKNOWN).toBe(2);
      expect(GRPC_STATUS_CODES.INVALID_ARGUMENT).toBe(3);
      expect(GRPC_STATUS_CODES.DEADLINE_EXCEEDED).toBe(4);
      expect(GRPC_STATUS_CODES.NOT_FOUND).toBe(5);
      expect(GRPC_STATUS_CODES.ALREADY_EXISTS).toBe(6);
      expect(GRPC_STATUS_CODES.PERMISSION_DENIED).toBe(7);
      expect(GRPC_STATUS_CODES.RESOURCE_EXHAUSTED).toBe(8);
      expect(GRPC_STATUS_CODES.FAILED_PRECONDITION).toBe(9);
      expect(GRPC_STATUS_CODES.ABORTED).toBe(10);
      expect(GRPC_STATUS_CODES.OUT_OF_RANGE).toBe(11);
      expect(GRPC_STATUS_CODES.UNIMPLEMENTED).toBe(12);
      expect(GRPC_STATUS_CODES.INTERNAL).toBe(13);
      expect(GRPC_STATUS_CODES.UNAVAILABLE).toBe(14);
      expect(GRPC_STATUS_CODES.DATA_LOSS).toBe(15);
      expect(GRPC_STATUS_CODES.UNAUTHENTICATED).toBe(16);
    });
  });

  describe('createGrpcSerializer', () => {
    it('создает сериализатор с дефолтной конфигурацией', () => {
      const serializer = createGrpcSerializer();
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.serializer).toBe('grpc');
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('создает сериализатор с кастомной конфигурацией', () => {
      const config: Partial<GrpcSerializerConfig> = {
        includeMetadata: false,
        mapToGrpcCodes: false,
      };

      const serializer = createGrpcSerializer(config);
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.metadata.config.includeMetadata).toBe(false);
      expect(result.metadata.config.mapToGrpcCodes).toBe(false);
      expect(result.code).toBe(GRPC_STATUS_CODES.INTERNAL); // не маппится
    });
  });

  describe('serializeToGrpc', () => {
    it('сериализует BaseError в gRPC формат', () => {
      const error = createMockBaseError();
      const result = serializeToGrpc(error);

      expect(result.code).toBe(GRPC_STATUS_CODES.INTERNAL); // high severity -> INTERNAL
      expect(result.message).toBe('Test gRPC error message');
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('маппит severity на gRPC статус коды', () => {
      const testCases = [
        { severity: ERROR_SEVERITY.LOW, expectedCode: GRPC_STATUS_CODES.INVALID_ARGUMENT },
        { severity: ERROR_SEVERITY.MEDIUM, expectedCode: GRPC_STATUS_CODES.INVALID_ARGUMENT },
        { severity: ERROR_SEVERITY.HIGH, expectedCode: GRPC_STATUS_CODES.INTERNAL },
        { severity: ERROR_SEVERITY.CRITICAL, expectedCode: GRPC_STATUS_CODES.UNAVAILABLE },
      ];

      testCases.forEach(({ severity, expectedCode }) => {
        const error = {
          ...createMockBaseError(),
          severity,
        };

        const result = serializeToGrpc(error);
        expect(result.code).toBe(expectedCode);
      });
    });

    it('маппит неизвестный severity на UNKNOWN', () => {
      const error = {
        ...createMockBaseError(),
        severity: 'unknown_severity' as any,
      };

      const result = serializeToGrpc(error);
      expect(result.code).toBe(GRPC_STATUS_CODES.UNKNOWN);
    });

    it('отключает маппинг gRPC кодов при конфигурации', () => {
      const serializer = createGrpcSerializer({ mapToGrpcCodes: false });
      const error = createMockBaseError();

      const result = serializer(error);

      expect(result.code).toBe(GRPC_STATUS_CODES.INTERNAL); // всегда INTERNAL
    });

    it('включает ErrorInfo детали', () => {
      const error = createMockBaseError();
      const result = serializeToGrpc(error);

      const errorInfo = result.details.find((detail) =>
        detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo'
      );
      expect(errorInfo).toBeDefined();
      expect(errorInfo?.reason).toBe(DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(errorInfo?.domain).toBe('livaibot.errors');
      expect(errorInfo?.metadata).toHaveProperty('category', ERROR_CATEGORY.TECHNICAL);
      expect(errorInfo?.metadata).toHaveProperty('origin', ERROR_ORIGIN.INFRASTRUCTURE);
      expect(errorInfo?.metadata).toHaveProperty('timestamp');
    });

    it('включает DebugInfo при detailLevel full', () => {
      const error = createMockBaseError();
      const serializer = createGrpcSerializer({ detailLevel: 'full' });
      const result = serializer(error);

      const debugInfo = result.details.find((detail) =>
        detail['@type'] === 'type.googleapis.com/google.rpc.DebugInfo'
      );
      expect(debugInfo).toBeDefined();
      expect(typeof debugInfo?.detail).toBe('string');
    });

    it('исключает DebugInfo при отключенных метаданных', () => {
      const serializer = createGrpcSerializer({ includeMetadata: false });
      const error = createMockBaseError();

      const result = serializer(error);

      const debugInfo = result.details.find((detail) =>
        detail['@type'] === 'type.googleapis.com/google.rpc.DebugInfo'
      );
      expect(debugInfo).toBeUndefined();
    });

    it('включает cause chain', () => {
      const error = createMockBaseErrorWithCause();
      const result = serializeToGrpc(error);

      const causeDetails = result.details.filter((detail) =>
        detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo'
        && detail.domain === 'livaibot.errors.chain'
      );

      expect(causeDetails.length).toBe(1);
      expect(causeDetails[0].reason).toBe('cause_0');
      expect(causeDetails[0].metadata).toHaveProperty('code', 'CAUSE_ERROR');
    });

    it('исключает cause chain при конфигурации', () => {
      const serializer = createGrpcSerializer({ includeCauseChain: false });
      const error = createMockBaseErrorWithCause();

      const result = serializer(error);

      const causeDetails = result.details.filter((detail) =>
        detail.domain === 'livaibot.errors.chain'
      );

      expect(causeDetails.length).toBe(0);
    });
  });

  describe('serializeToGrpcString', () => {
    it('сериализует BaseError в gRPC JSON строку', () => {
      const error = createMockBaseError();
      const jsonString = serializeToGrpcString(error);

      expect(typeof jsonString).toBe('string');
      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString) as GrpcSerializationResult;
      expect(parsed.metadata.serializer).toBe('grpc');
      expect(Array.isArray(parsed.details)).toBe(true);
    });

    it('форматирует JSON с отступами при pretty=true', () => {
      const error = createMockBaseError();
      const jsonString = serializeToGrpcString(error, true);

      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  ');
    });
  });

  describe('GrpcSerializer structure', () => {
    it('возвращает корректную структуру результата', () => {
      const error = createMockBaseError();
      const result: GrpcSerializationResult = serializeToGrpc(error);

      expect(result).toHaveProperty('code');
      expect(typeof result.code).toBe('number');

      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');

      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.details)).toBe(true);

      expect(result).toHaveProperty('metadata');
      expect(result.metadata.serializer).toBe('grpc');
      expect(result.metadata.version).toBe('1.0.0');
      expect(typeof result.metadata.timestamp).toBe('string');
    });

    it('все детали имеют корректный protobuf формат', () => {
      const error = createMockBaseError();
      const result = serializeToGrpc(error);

      result.details.forEach((detail) => {
        expect(detail).toHaveProperty('@type');
        expect(typeof detail['@type']).toBe('string');
        expect(detail['@type']).toMatch(/^type\.googleapis\.com\/google\.rpc\./);
      });
    });
  });

  describe('detailLevel configuration', () => {
    it('basic level включает только основную ошибку без cause chain и metadata', () => {
      const error = createMockBaseErrorWithCause();
      const serializer = createGrpcSerializer({ detailLevel: 'basic' });
      const result = serializer(error);

      expect(result.details).toHaveLength(1); // Только основная ошибка
      expect(result.details[0]).toHaveProperty('@type', 'type.googleapis.com/google.rpc.ErrorInfo');
      expect(result.details[0]).toHaveProperty('reason', DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      // Нет DebugInfo с метаданными
      expect(result.details.some((d) => d['@type'] === 'type.googleapis.com/google.rpc.DebugInfo'))
        .toBe(false);
    });

    it('detailed level включает основную ошибку и cause chain', () => {
      const error = createMockBaseErrorWithCause();
      const serializer = createGrpcSerializer({ detailLevel: 'detailed' });
      const result = serializer(error);

      expect(result.details.length).toBeGreaterThan(1); // Основная + cause ошибки
      const causeDetails = result.details.filter((d) =>
        d['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo'
        && typeof d.reason === 'string'
        && d.reason.startsWith('cause_')
      );
      expect(causeDetails.length).toBeGreaterThan(0);
    });

    it('full level включает полные метаданные', () => {
      const error = createMockBaseError();
      const serializer = createGrpcSerializer({ detailLevel: 'full' });
      const result = serializer(error);

      // Должен быть DebugInfo с метаданными
      const debugInfo = result.details.find((d) =>
        d['@type'] === 'type.googleapis.com/google.rpc.DebugInfo'
      );
      expect(debugInfo).toBeDefined();
      expect(debugInfo).toHaveProperty('detail');
      expect(typeof debugInfo?.detail).toBe('string');
    });

    it('full level включает метаданные cause chain', () => {
      const error = createMockBaseErrorWithCause();
      const serializer = createGrpcSerializer({ detailLevel: 'full' });
      const result = serializer(error);

      const causeDetails = result.details.filter((d) =>
        d['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo'
        && typeof d.reason === 'string'
        && d.reason.startsWith('cause_')
      );
      expect(causeDetails.length).toBeGreaterThan(0);

      // Первый cause должен иметь causeMetadata
      const firstCause = causeDetails[0];
      expect(firstCause.metadata).toHaveProperty('causeMetadata');
      const metadata = firstCause.metadata as Record<string, unknown>;
      expect(typeof metadata.causeMetadata).toBe('object');
    });
  });

  describe('validateDetailLevel function', () => {
    it('возвращает валидный detailLevel как есть', () => {
      expect(createGrpcSerializer({ detailLevel: 'basic' })).toBeDefined();
      expect(createGrpcSerializer({ detailLevel: 'detailed' })).toBeDefined();
      expect(createGrpcSerializer({ detailLevel: 'full' })).toBeDefined();
    });

    it('преобразует неизвестный detailLevel в detailed', () => {
      // Создаем сериализатор с неизвестным detailLevel
      const serializer = createGrpcSerializer({ detailLevel: 'unknown' as any });
      const error = createMockBaseErrorWithCause();
      const result = serializer(error);

      // Должен использовать detailed уровень (дефолтный) - включает cause chain
      expect(result.details.length).toBeGreaterThan(1); // Основная ошибка + cause ошибки
    });
  });

  describe('stack traces in DebugInfo', () => {
    it('включает стек трейсы когда error.stack присутствует', () => {
      const errorWithStack = {
        ...createMockBaseError(),
        stack:
          'Error: Test error\n    at function1 (/path/file1.js:10:5)\n    at function2 (/path/file2.js:20:3)',
      };

      const serializer = createGrpcSerializer({ detailLevel: 'full' });
      const result = serializer(errorWithStack);

      const debugInfo = result.details.find((d) =>
        d['@type'] === 'type.googleapis.com/google.rpc.DebugInfo'
      );
      expect(debugInfo).toBeDefined();
      expect(debugInfo?.stack_entries).toEqual([
        '    at function1 (/path/file1.js:10:5)',
        '    at function2 (/path/file2.js:20:3)',
      ]);
    });

    it('не включает стек трейсы когда error.stack отсутствует', () => {
      const errorWithoutStack = {
        ...createMockBaseError(),
        stack: undefined,
      };

      const serializer = createGrpcSerializer({ detailLevel: 'full' });
      const result = serializer(errorWithoutStack);

      const debugInfo = result.details.find((d) =>
        d['@type'] === 'type.googleapis.com/google.rpc.DebugInfo'
      );
      expect(debugInfo).toBeDefined();
      expect(debugInfo?.stack_entries).toEqual([]);
    });
  });

  describe('severityMapping configuration', () => {
    it('использует кастомную функцию маппинга severity', () => {
      const customMapping = (severity: string): number => {
        switch (severity) {
          case 'low':
            return GRPC_STATUS_CODES.CANCELLED;
          case 'medium':
            return GRPC_STATUS_CODES.ABORTED;
          case 'high':
            return GRPC_STATUS_CODES.DATA_LOSS;
          case 'critical':
            return GRPC_STATUS_CODES.UNAUTHENTICATED;
          default:
            return GRPC_STATUS_CODES.UNKNOWN;
        }
      };

      const error = createMockBaseError();
      const serializer = createGrpcSerializer({ severityMapping: customMapping });
      const result = serializer(error);

      expect(result.code).toBe(GRPC_STATUS_CODES.DATA_LOSS); // high -> DATA_LOSS
    });
  });
});

describe('deserializeFromGrpcString type checking', () => {
  it('возвращает null когда code не является числом', () => {
    const invalidJson = JSON.stringify({
      code: 'not_a_number',
      message: 'test',
      details: [],
      metadata: {
        serializer: 'grpc',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: {},
      },
    });

    const result = deserializeFromGrpcString(invalidJson);
    expect(result).toBeNull();
  });

  it('возвращает null когда message не является строкой', () => {
    const invalidJson = JSON.stringify({
      code: 13,
      message: 123,
      details: [],
      metadata: {
        serializer: 'grpc',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: {},
      },
    });

    const result = deserializeFromGrpcString(invalidJson);
    expect(result).toBeNull();
  });

  it('возвращает null когда details не является массивом', () => {
    const invalidJson = JSON.stringify({
      code: 13,
      message: 'test',
      details: 'not_an_array',
      metadata: {
        serializer: 'grpc',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: {},
      },
    });

    const result = deserializeFromGrpcString(invalidJson);
    expect(result).toBeNull();
  });
});

describe('deserializeFromGrpcString', () => {
  it('десериализует валидную gRPC JSON строку', () => {
    const error = createMockBaseError();
    const serialized = serializeToGrpcString(error);
    const deserialized = deserializeFromGrpcString(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized?.code).toBe(GRPC_STATUS_CODES.INTERNAL);
    expect(deserialized?.message).toBe('Test gRPC error message');
    expect(deserialized?.metadata.serializer).toBe('grpc');
  });

  it('возвращает null для невалидного JSON', () => {
    const result = deserializeFromGrpcString('invalid json');
    expect(result).toBeNull();
  });

  it('возвращает null при отсутствии обязательных полей', () => {
    const invalidJson = JSON.stringify({ message: 'test' });
    const result = deserializeFromGrpcString(invalidJson);
    expect(result).toBeNull();
  });

  it('возвращает null при неправильном serializer type', () => {
    const error = createMockBaseError();
    const serialized = serializeToGrpcString(error);
    const parsed = JSON.parse(serialized);
    parsed.metadata.serializer = 'json'; // Изменяем тип
    const invalidJson = JSON.stringify(parsed);

    const result = deserializeFromGrpcString(invalidJson);
    expect(result).toBeNull();
  });

  it('поддерживает round-trip сериализацию', () => {
    const originalError = createMockBaseErrorWithCause();
    const serialized = serializeToGrpcString(originalError);
    const deserialized = deserializeFromGrpcString(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized?.message).toBe('Main error with cause');
    expect(deserialized?.metadata.serializer).toBe('grpc');
    expect(deserialized?.metadata.version).toBe('1.0.0');
  });
});
