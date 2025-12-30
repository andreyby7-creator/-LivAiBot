import { describe, expect, it, vi } from 'vitest';

import {
  createPaymentErrorSerializer,
  PAYMENT_GRPC_STATUS,
  PAYMENT_HTTP_STATUS,
  serializeGrpcToJsonString,
  serializeGrpcWithMetadataToJsonString,
  serializeHttpToJsonString,
  serializeHttpWithMetadataToJsonString,
  serializePaymentErrorGrpc,
  serializePaymentErrorHttp,
} from '../../../../../../src/errors/services/billing-service/serialization/PaymentErrorSerializer.js';
import { SERVICE_ERROR_CODES } from '../../../../../../src/errors/base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN } from '../../../../../../src/errors/base/ErrorConstants.js';
import type { BaseError } from '../../../../../../src/errors/base/BaseError.js';
import type {
  CorrelationId,
  MetadataTimestamp,
} from '../../../../../../src/errors/base/ErrorMetadata.js';

// ==================== MOCKS ====================

/** Mock BaseError для тестирования */
const createMockBaseError = (overrides: Partial<BaseError> = {}): BaseError => ({
  _tag: 'BaseError',
  code: SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
  message: 'Payment failed',
  severity: 'high' as const,
  category: ERROR_CATEGORY.BUSINESS,
  origin: ERROR_ORIGIN.SERVICE,
  timestamp: Date.now(),
  codeMetadata: {
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_FAILED,
    description: 'Payment failed',
    severity: 'high' as const,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.SERVICE,
  },
  metadata: {
    context: {
      correlationId: 'test-correlation-id' as CorrelationId,
      timestamp: Date.now() as MetadataTimestamp,
    },
    customFields: {},
    userContext: {
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
      sessionId: 'test-session-id',
    },
  },
  causeChain: [],
  ...overrides,
});

// ==================== CONSTANTS TESTS ====================

describe('PaymentErrorSerializer Constants', () => {
  describe('PAYMENT_HTTP_STATUS', () => {
    it('should have all required HTTP status codes', () => {
      expect(PAYMENT_HTTP_STATUS.OK).toBe(200);
      expect(PAYMENT_HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(PAYMENT_HTTP_STATUS.PAYMENT_REQUIRED).toBe(402);
      expect(PAYMENT_HTTP_STATUS.INTERNAL_ERROR).toBe(500);
      expect(PAYMENT_HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
    });

    it('should be readonly', () => {
      expect(Object.isFrozen(PAYMENT_HTTP_STATUS)).toBe(true);
    });
  });

  describe('PAYMENT_GRPC_STATUS', () => {
    it('should have all required gRPC status codes', () => {
      expect(PAYMENT_GRPC_STATUS.OK).toBe(0);
      expect(PAYMENT_GRPC_STATUS.INVALID_ARGUMENT).toBe(3);
      expect(PAYMENT_GRPC_STATUS.FAILED_PRECONDITION).toBe(9);
      expect(PAYMENT_GRPC_STATUS.INTERNAL).toBe(13);
      expect(PAYMENT_GRPC_STATUS.UNAVAILABLE).toBe(14);
    });

    it('should be readonly', () => {
      expect(Object.isFrozen(PAYMENT_GRPC_STATUS)).toBe(true);
    });
  });
});

// ==================== SERIALIZER CREATION TESTS ====================

describe('createPaymentErrorSerializer', () => {
  it('should create serializer with default config', () => {
    const serializer = createPaymentErrorSerializer();
    expect(serializer).toHaveProperty('serializeHttp');
    expect(serializer).toHaveProperty('serializeGrpc');
    expect(typeof serializer.serializeHttp).toBe('function');
    expect(typeof serializer.serializeGrpc).toBe('function');
  });

  it('should create serializer with custom config', () => {
    const config = {
      includeCauseChain: false,
      includeTransactionId: false,
      detailLevel: 'basic' as const,
    };
    const serializer = createPaymentErrorSerializer(config);
    expect(serializer).toHaveProperty('serializeHttp');
    expect(serializer).toHaveProperty('serializeGrpc');
  });

  it('should merge custom config with defaults', () => {
    const config = { includeCauseChain: false };
    const serializer = createPaymentErrorSerializer(config);
    // This will be tested through actual serialization behavior
    expect(serializer).toBeDefined();
  });

  it('should create serializer with all config options', () => {
    const config = {
      includeCauseChain: true,
      includeTransactionId: true,
      detailLevel: 'full' as const,
      severityMappers: {
        http: () => PAYMENT_HTTP_STATUS.BAD_REQUEST,
        grpc: () => PAYMENT_GRPC_STATUS.INVALID_ARGUMENT,
      },
      observability: {
        enableLogging: true,
        onPaymentError: vi.fn(),
        onSerializationError: vi.fn(),
      },
      resultValidator: (result: unknown): result is unknown => true,
    };

    const serializer = createPaymentErrorSerializer(config);
    expect(serializer).toBeDefined();

    // Test that config is applied
    const error = createMockBaseError();
    const result = serializer.serializeHttp({}, error);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.BAD_REQUEST);
  });

  it('should create serializer with minimal config', () => {
    const config = {};
    const serializer = createPaymentErrorSerializer(config);
    expect(serializer).toBeDefined();
  });

  it('should handle undefined config', () => {
    const serializer = createPaymentErrorSerializer(undefined);
    expect(serializer).toBeDefined();
  });
});

// ==================== HTTP SERIALIZATION TESTS ====================

describe('HTTP Serialization', () => {
  describe('serializePaymentErrorHttp', () => {
    it('should serialize BaseError to HTTP format', () => {
      const error = createMockBaseError();
      const result = serializePaymentErrorHttp({}, error);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('metadata');
      expect(result.status).toBe(PAYMENT_HTTP_STATUS.PAYMENT_REQUIRED);
      expect(result.metadata.serializer).toBe('payment-http');
    });

    it('should serialize successful payment result', () => {
      const successResult = {
        type: 'success' as const,
        operation: 'payment',
        result: { transactionId: 'test-tx-id' },
        transactionId: 'test-tx-id',
      };
      const result = serializePaymentErrorHttp(successResult);

      expect(result.status).toBe(PAYMENT_HTTP_STATUS.OK);
      expect(result.body.timestamp).toBeDefined();
      expect(typeof result.body.timestamp).toBe('string');
    });

    it('should serialize error payment result as HTTP error', () => {
      const errorResult = {
        type: 'error' as const,
        error: {
          code: 'PAYMENT_DECLINED',
          message: 'Payment was declined',
          details: { provider: 'test-provider' },
        },
      };
      const result = serializePaymentErrorHttp(errorResult);

      expect(result.status).toBe(PAYMENT_HTTP_STATUS.BAD_REQUEST);
      expect(result.body.timestamp).toBeDefined();
    });

    it('should handle invalid payment result', () => {
      const invalidResult = { invalid: 'data' };
      const result = serializePaymentErrorHttp(invalidResult);

      expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should include transactionId when configured', () => {
      const error = createMockBaseError();
      const result = serializePaymentErrorHttp({}, error, {
        includeTransactionId: true,
      });

      const body = result.body as { error?: { transactionId?: string; }; };
      expect(body.error?.transactionId).toBe('test-correlation-id');
    });

    it('should respect detailLevel config', () => {
      const error = createMockBaseError();
      const result = serializePaymentErrorHttp({}, error, {
        detailLevel: 'full',
      });

      const body = result.body as { error?: { metadata?: unknown; }; };
      expect(body.error?.metadata).toBeDefined();
    });
  });
});

// ==================== GRPC SERIALIZATION TESTS ====================

describe('gRPC Serialization', () => {
  describe('serializePaymentErrorGrpc', () => {
    it('should serialize BaseError to gRPC format', () => {
      const error = createMockBaseError();
      const result = serializePaymentErrorGrpc({}, error);

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('metadata');
      expect(result.code).toBe(PAYMENT_GRPC_STATUS.FAILED_PRECONDITION);
      expect(result.metadata.serializer).toBe('payment-grpc');
    });

    it('should serialize successful payment result', () => {
      const successResult = {
        type: 'success' as const,
        operation: 'payment',
        result: { transactionId: 'test-tx-id' },
        transactionId: 'test-tx-id',
      };
      const result = serializePaymentErrorGrpc(successResult);

      expect(result.code).toBe(PAYMENT_GRPC_STATUS.OK);
      expect(result.details).toEqual([{ result: successResult }]);
    });

    it('should serialize error payment result as gRPC error', () => {
      const errorResult = {
        type: 'error' as const,
        error: {
          code: 'PAYMENT_DECLINED',
          message: 'Payment was declined',
          details: { provider: 'test-provider' },
        },
      };
      const result = serializePaymentErrorGrpc(errorResult);

      expect(result.code).toBe(PAYMENT_GRPC_STATUS.INVALID_ARGUMENT);
      expect(result.message).toBe('Payment result contains error');
    });

    it('should handle invalid payment result', () => {
      const invalidResult = { invalid: 'data' };
      const result = serializePaymentErrorGrpc(invalidResult);

      expect(result.code).toBe(PAYMENT_GRPC_STATUS.INTERNAL);
      expect(result.metadata.outcome.kind).toBe('system-error');
    });
  });
});

// ==================== JSON SERIALIZATION TESTS ====================

describe('JSON Serialization', () => {
  describe('serializeHttpToJsonString', () => {
    it('should serialize HTTP result to JSON string', () => {
      const httpResult = {
        status: 200,
        body: { timestamp: '2024-01-01T00:00:00.000Z', data: 'test' },
        metadata: {
          serializer: 'payment-http' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          config: {} as any,
          outcome: { kind: 'success' as const },
        },
      };

      const json = serializeHttpToJsonString(httpResult);
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ timestamp: '2024-01-01T00:00:00.000Z', data: 'test' });
    });

    it('should handle circular references in JSON', () => {
      const circular: any = { prop: 'value' };
      circular.self = circular;

      const httpResult = {
        status: 200,
        body: { timestamp: '2024-01-01T00:00:00.000Z', circular },
        metadata: {
          serializer: 'payment-http' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          config: {} as any,
          outcome: { kind: 'success' as const },
        },
      };

      const json = serializeHttpToJsonString(httpResult);
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should limit object depth', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {
                            level11: 'too deep',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const httpResult = {
        status: 200,
        body: { timestamp: '2024-01-01T00:00:00.000Z', data: deepObject },
        metadata: {
          serializer: 'payment-http' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          config: {} as any,
          outcome: { kind: 'success' as const },
        },
      };

      const json = serializeHttpToJsonString(httpResult);
      expect(json).toContain('[Object too deep, max depth: 10]');
    });

    it('should handle JSON serialization errors', () => {
      // Create an object that will cause JSON.stringify to fail
      const problematicObject = {
        toJSON() {
          throw new Error('Serialization failed');
        },
      };

      const httpResult = {
        status: 200,
        body: { timestamp: '2024-01-01T00:00:00.000Z', data: problematicObject },
        metadata: {
          serializer: 'payment-http' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          config: {} as any,
          outcome: { kind: 'success' as const },
        },
      };

      expect(() => serializeHttpToJsonString(httpResult)).toThrow('JSON serialization failed');
    });
  });

  describe('serializeGrpcToJsonString', () => {
    it('should serialize gRPC result to JSON string', () => {
      const grpcResult = {
        code: 0,
        message: 'OK',
        details: [{ result: 'test' }],
        metadata: {
          serializer: 'payment-grpc' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          config: {} as any,
          outcome: { kind: 'success' as const },
        },
      };

      const json = serializeGrpcToJsonString(grpcResult);
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed).toEqual({
        code: 0,
        message: 'OK',
        details: [{ result: 'test' }],
      });
    });
  });

  describe('serializeHttpWithMetadataToJsonString', () => {
    it('should serialize HTTP result with metadata to JSON string', () => {
      const httpResult = {
        status: 200,
        body: { timestamp: '2024-01-01T00:00:00.000Z', data: 'test' },
        metadata: {
          serializer: 'payment-http' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          config: {} as any,
          outcome: { kind: 'success' as const },
        },
      };

      const json = serializeHttpWithMetadataToJsonString(httpResult);
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('status', 200);
      expect(parsed).toHaveProperty('body');
      expect(parsed).toHaveProperty('metadata');
    });
  });

  describe('serializeGrpcWithMetadataToJsonString', () => {
    it('should serialize gRPC result with metadata to JSON string', () => {
      const grpcResult = {
        code: 0,
        message: 'OK',
        details: [{ result: 'test' }],
        metadata: {
          serializer: 'payment-grpc' as const,
          timestamp: '2024-01-01T00:00:00.000Z',
          config: {} as any,
          outcome: { kind: 'success' as const },
        },
      };

      const json = serializeGrpcWithMetadataToJsonString(grpcResult);
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('code', 0);
      expect(parsed).toHaveProperty('message', 'OK');
      expect(parsed).toHaveProperty('details');
      expect(parsed).toHaveProperty('metadata');
    });
  });
});

// ==================== ERROR HANDLING TESTS ====================

describe('Error Handling', () => {
  it('should handle serialization errors gracefully', () => {
    const serializer = createPaymentErrorSerializer();
    const circularError = createMockBaseError();
    (circularError as any).circularRef = circularError;

    expect(() => {
      serializer.serializeHttp({}, circularError);
    }).not.toThrow();
  });

  it('should handle invalid error objects', () => {
    const invalidError = { invalid: 'error' } as any;
    const result = serializePaymentErrorHttp({}, invalidError);

    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
    expect(result.metadata.outcome.kind).toBe('system-error');
  });

  it('should handle null/undefined inputs', () => {
    const result = serializePaymentErrorHttp(null as any);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
  });
});

// ==================== CONFIGURATION TESTS ====================

describe('Configuration', () => {
  it('should respect severity mappers', () => {
    const config = {
      severityMappers: {
        http: () => PAYMENT_HTTP_STATUS.BAD_REQUEST,
        grpc: () => PAYMENT_GRPC_STATUS.INVALID_ARGUMENT,
      },
    };
    const serializer = createPaymentErrorSerializer(config);
    const error = createMockBaseError();

    const httpResult = serializer.serializeHttp({}, error);
    expect(httpResult.status).toBe(PAYMENT_HTTP_STATUS.BAD_REQUEST);

    const grpcResult = serializer.serializeGrpc({}, error);
    expect(grpcResult.code).toBe(PAYMENT_GRPC_STATUS.INVALID_ARGUMENT);
  });

  it('should handle observability hooks', () => {
    const onErrorMock = vi.fn();
    const config = {
      observability: {
        enableLogging: true,
        onPaymentError: onErrorMock,
      },
    };
    const serializer = createPaymentErrorSerializer(config);
    const error = createMockBaseError();

    serializer.serializeHttp({}, error);
    expect(onErrorMock).toHaveBeenCalledWith(error);
  });

  it('should handle custom result validators', () => {
    let validatorCalled = false;
    let validatorResult: unknown;

    const resultValidator = (result: unknown): result is unknown => {
      validatorCalled = true;
      validatorResult = result;
      return true;
    };

    const config = { resultValidator };
    const serializer = createPaymentErrorSerializer(config);

    const successResult = {
      type: 'success' as const,
      operation: 'payment',
      result: { validated: true },
      transactionId: 'test-tx-id',
    };

    serializer.serializeHttp(successResult);

    expect(validatorCalled).toBe(true);
    expect(validatorResult).toEqual({ validated: true });
  });

  it('should call all observability hooks', () => {
    const onPaymentError = vi.fn();
    const onSerializationError = vi.fn();

    const config = {
      observability: {
        enableLogging: true,
        onPaymentError,
        onSerializationError,
      },
    };

    const serializer = createPaymentErrorSerializer(config);
    const error = createMockBaseError();

    // Test onPaymentError hook
    serializer.serializeHttp({}, error);
    expect(onPaymentError).toHaveBeenCalledWith(error);

    // Test onSerializationError hook - create a scenario that causes serialization error
    const circularError = createMockBaseError();
    (circularError as any).circularRef = circularError;

    // This should trigger serialization error handling
    expect(() => serializer.serializeHttp({}, circularError)).not.toThrow();
  });
});

// ==================== PCI SAFETY TESTS ====================

describe('PCI Safety', () => {
  it('should not include sensitive payment data', () => {
    const errorWithSensitiveData = createMockBaseError({
      metadata: {
        context: {
          correlationId: 'test-correlation-id' as CorrelationId,
          timestamp: Date.now() as MetadataTimestamp,
        },
        customFields: {
          // Эти поля не должны попасть в сериализацию
          pan: '4111111111111111',
          cvv: '123',
          expiry: '12/25',
          cardholderName: 'John Doe',
        },
      },
    });

    const result = serializePaymentErrorHttp({}, errorWithSensitiveData, {
      detailLevel: 'full',
    });

    const errorBody = result.body.error as any;
    expect(errorBody.metadata?.customFields?.pan).toBeUndefined();
    expect(errorBody.metadata?.customFields?.cvv).toBeUndefined();
    expect(errorBody.metadata?.customFields?.expiry).toBeUndefined();
    expect(errorBody.metadata?.customFields?.cardholderName).toBeUndefined();
  });

  it('should only include PCI-safe fields', () => {
    const safeError = createMockBaseError();
    const result = serializePaymentErrorHttp({}, safeError);

    const errorBody = result.body.error as any;
    expect(errorBody).toHaveProperty('code');
    expect(errorBody).toHaveProperty('message');
    expect(errorBody).toHaveProperty('category');
    expect(errorBody.transactionId).toBe('test-correlation-id');
  });
});

// ==================== EDGE CASES TESTS ====================

describe('Edge Cases', () => {
  it('should handle empty objects', () => {
    const result = serializePaymentErrorHttp({});
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
  });

  it('should handle arrays', () => {
    const result = serializePaymentErrorHttp([]);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
  });

  it('should handle primitive values', () => {
    const result = serializePaymentErrorHttp('string');
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
  });

  it('should handle deeply nested valid results', () => {
    const nestedResult = {
      type: 'success' as const,
      operation: 'payment',
      result: { deeply: { nested: { data: 'value' } } },
      transactionId: 'test-tx-id',
    };

    const result = serializePaymentErrorHttp(nestedResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.OK);
  });

  it('should handle null values', () => {
    const result = serializePaymentErrorHttp(null as any);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
  });

  it('should handle undefined values', () => {
    const result = serializePaymentErrorHttp(undefined as any);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR);
  });

  it('should handle very large arrays', () => {
    const largeArray = Array.from({ length: 200 }, (_, i) => ({ id: i, data: `item-${i}` }));

    const httpResult = {
      status: 200,
      body: { timestamp: '2024-01-01T00:00:00.000Z', data: largeArray },
      metadata: {
        serializer: 'payment-http' as const,
        timestamp: '2024-01-01T00:00:00.000Z',
        config: {} as any,
        outcome: { kind: 'success' as const },
      },
    };

    const json = serializeHttpToJsonString(httpResult);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.data)).toBe(true);
  });

  it('should filter out private properties in JSON serialization', () => {
    const dataWithPrivateProps = {
      normalProp: 'value',
      _privateProp: 'should be filtered',
      $systemProp: 'should be filtered',
      publicProp: 'should remain',
    };

    const httpResult = {
      status: 200,
      body: { timestamp: '2024-01-01T00:00:00.000Z', data: dataWithPrivateProps },
      metadata: {
        serializer: 'payment-http' as const,
        timestamp: '2024-01-01T00:00:00.000Z',
        config: {} as any,
        outcome: { kind: 'success' as const },
      },
    };

    const json = serializeHttpToJsonString(httpResult);
    const parsed = JSON.parse(json);

    expect(parsed.data.normalProp).toBe('value');
    expect(parsed.data.publicProp).toBe('should remain');
    expect(parsed.data).not.toHaveProperty('_privateProp');
    expect(parsed.data).not.toHaveProperty('$systemProp');
  });
});

// ==================== SEVERITY MAPPING TESTS ====================

describe('Severity Mapping', () => {
  it('should map different severity levels to correct HTTP codes', () => {
    const testCases = [
      { severity: 'low' as const, expectedHttp: PAYMENT_HTTP_STATUS.BAD_REQUEST },
      { severity: 'medium' as const, expectedHttp: PAYMENT_HTTP_STATUS.TOO_MANY_REQUESTS },
      { severity: 'high' as const, expectedHttp: PAYMENT_HTTP_STATUS.PAYMENT_REQUIRED },
      { severity: 'critical' as const, expectedHttp: PAYMENT_HTTP_STATUS.SERVICE_UNAVAILABLE },
    ];

    for (const { severity, expectedHttp } of testCases) {
      const error = createMockBaseError({ severity });
      const result = serializePaymentErrorHttp({}, error);
      expect(result.status).toBe(expectedHttp);
    }
  });

  it('should map different severity levels to correct gRPC codes', () => {
    const testCases = [
      { severity: 'low' as const, expectedGrpc: PAYMENT_GRPC_STATUS.INVALID_ARGUMENT },
      { severity: 'medium' as const, expectedGrpc: PAYMENT_GRPC_STATUS.RESOURCE_EXHAUSTED },
      { severity: 'high' as const, expectedGrpc: PAYMENT_GRPC_STATUS.FAILED_PRECONDITION },
      { severity: 'critical' as const, expectedGrpc: PAYMENT_GRPC_STATUS.UNAVAILABLE },
    ];

    for (const { severity, expectedGrpc } of testCases) {
      const error = createMockBaseError({ severity });
      const result = serializePaymentErrorGrpc({}, error);
      expect(result.code).toBe(expectedGrpc);
    }
  });

  it('should use custom severity mappers when provided', () => {
    const customHttpMapper = vi.fn(() => PAYMENT_HTTP_STATUS.UNAUTHORIZED);
    const customGrpcMapper = vi.fn(() => PAYMENT_GRPC_STATUS.PERMISSION_DENIED);

    const config = {
      severityMappers: {
        http: customHttpMapper,
        grpc: customGrpcMapper,
      },
    };

    const error = createMockBaseError();
    const httpResult = serializePaymentErrorHttp({}, error, config);
    const grpcResult = serializePaymentErrorGrpc({}, error, config);

    expect(httpResult.status).toBe(PAYMENT_HTTP_STATUS.UNAUTHORIZED);
    expect(grpcResult.code).toBe(PAYMENT_GRPC_STATUS.PERMISSION_DENIED);
    expect(customHttpMapper).toHaveBeenCalledWith(error.severity);
    expect(customGrpcMapper).toHaveBeenCalledWith(error.severity);
  });
});

// ==================== CONFIGURATION EDGE CASES ====================

describe('Configuration Edge Cases', () => {
  it('should handle missing severity mappers gracefully', () => {
    const config = { severityMappers: {} };
    const error = createMockBaseError();
    const result = serializePaymentErrorHttp({}, error, config);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.PAYMENT_REQUIRED); // high severity default
  });

  it('should handle null custom fields', () => {
    const error = createMockBaseError({
      metadata: {
        context: {
          correlationId: 'test-correlation-id' as CorrelationId,
          timestamp: Date.now() as MetadataTimestamp,
        },
        customFields: null as any,
      },
    });

    const result = serializePaymentErrorHttp({}, error, { detailLevel: 'full' });
    const errorBody = result.body.error as any;
    expect(errorBody.metadata).toBeDefined();
    expect(errorBody.metadata.customFields).toBeUndefined();
  });

  it('should handle undefined custom fields', () => {
    const error = createMockBaseError({
      metadata: {
        context: {
          correlationId: 'test-correlation-id' as CorrelationId,
          timestamp: Date.now() as MetadataTimestamp,
        },
        customFields: undefined,
      },
    });

    const result = serializePaymentErrorHttp({}, error, { detailLevel: 'full' });
    const errorBody = result.body.error as any;
    expect(errorBody.metadata).toBeDefined();
    expect(errorBody.metadata.customFields).toBeUndefined();
  });

  it('should filter sensitive keys from custom fields', () => {
    const error = createMockBaseError({
      metadata: {
        context: {
          correlationId: 'test-correlation-id' as CorrelationId,
          timestamp: Date.now() as MetadataTimestamp,
        },
        customFields: {
          safeField: 'keep this',
          pan: 'remove this',
          cvv: 'remove this',
          expiry: 'remove this',
          cardholdername: 'remove this',
          pin: 'remove this',
          anotherSafeField: 'keep this too',
        },
      },
    });

    const result = serializePaymentErrorHttp({}, error, { detailLevel: 'full' });
    const errorBody = result.body.error as any;

    expect(errorBody.metadata.customFields.safeField).toBe('keep this');
    expect(errorBody.metadata.customFields.anotherSafeField).toBe('keep this too');
    expect(errorBody.metadata.customFields).not.toHaveProperty('pan');
    expect(errorBody.metadata.customFields).not.toHaveProperty('cvv');
    expect(errorBody.metadata.customFields).not.toHaveProperty('expiry');
    expect(errorBody.metadata.customFields).not.toHaveProperty('cardholdername');
    expect(errorBody.metadata.customFields).not.toHaveProperty('pin');
  });
});

// ==================== PAYMENT RESULT VARIATIONS ====================

describe('Payment Result Variations', () => {
  it('should handle payment result with all fields', () => {
    const fullResult = {
      type: 'success' as const,
      operation: 'charge',
      result: {
        transactionId: 'tx-123',
        amount: 1000,
        currency: 'USD',
        provider: 'stripe',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
      transactionId: 'tx-123',
      metadata: { processingTime: 150 },
    };

    const result = serializePaymentErrorHttp(fullResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.OK);
    expect((result.body.result as any).transactionId).toBe('tx-123');
  });

  it('should handle payment result with minimal fields', () => {
    const minimalResult = {
      type: 'success' as const,
      operation: 'refund',
      result: {},
      transactionId: 'tx-456',
    };

    const result = serializePaymentErrorHttp(minimalResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.OK);
    expect(result.body.transactionId).toBe('tx-456');
  });

  it('should handle error result with detailed error', () => {
    const errorResult = {
      type: 'error' as const,
      error: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds for transaction',
        details: {
          available: 50,
          required: 100,
          currency: 'USD',
        },
      },
      operation: 'withdrawal',
    };

    const result = serializePaymentErrorHttp(errorResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.BAD_REQUEST);
    expect((result.body.error as any).code).toBe('INSUFFICIENT_FUNDS');
  });

  it('should handle payment result with empty result object', () => {
    const emptyResult = {
      type: 'success' as const,
      operation: 'status_check',
      result: {},
      transactionId: 'tx-789',
    };

    const result = serializePaymentErrorHttp(emptyResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.OK);
    expect(result.body.transactionId).toBe('tx-789');
  });

  it('should handle payment result with complex nested data', () => {
    const complexResult = {
      type: 'success' as const,
      operation: 'detailed_charge',
      result: {
        transactionId: 'tx-complex',
        paymentDetails: {
          method: 'card',
          lastFour: '4242',
          network: 'visa',
          metadata: {
            riskScore: 0.1,
            fraudChecks: ['passed', 'passed', 'warning'],
          },
        },
        amounts: {
          authorized: 10000,
          captured: 9500,
          refunded: 500,
          currency: 'USD',
        },
      },
      transactionId: 'tx-complex',
    };

    const result = serializePaymentErrorHttp(complexResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.OK);
    expect((result.body.result as any).transactionId).toBe('tx-complex');
  });
});

// ==================== ADDITIONAL EDGE CASES ====================

describe('Additional Edge Cases', () => {
  it('should handle createPaymentErrorSerializer with null config', () => {
    const serializer = createPaymentErrorSerializer(null as any);
    expect(serializer).toBeDefined();
    const error = createMockBaseError();
    const result = serializer.serializeHttp({}, error);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.PAYMENT_REQUIRED);
  });

  it('should handle config with only partial severity mappers', () => {
    const config = {
      severityMappers: {
        http: (severity: string) =>
          severity === 'low'
            ? PAYMENT_HTTP_STATUS.UNAUTHORIZED
            : PAYMENT_HTTP_STATUS.INTERNAL_ERROR,
      },
    };

    const error = createMockBaseError({ severity: 'low' });
    const result = serializePaymentErrorHttp({}, error, config);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.UNAUTHORIZED);
  });

  it('should handle gRPC config with partial severity mappers', () => {
    const config = {
      severityMappers: {
        grpc: (severity: string) =>
          severity === 'high'
            ? PAYMENT_GRPC_STATUS.PERMISSION_DENIED
            : PAYMENT_GRPC_STATUS.INTERNAL,
      },
    };

    const error = createMockBaseError({ severity: 'high' });
    const result = serializePaymentErrorGrpc({}, error, config);
    expect(result.code).toBe(PAYMENT_GRPC_STATUS.PERMISSION_DENIED);
  });

  it('should handle metadata with missing context', () => {
    const error = createMockBaseError({
      metadata: {} as any, // Missing context
    });

    const result = serializePaymentErrorHttp({}, error, { detailLevel: 'full' });
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR); // Expect error when metadata is malformed
  });

  it('should handle metadata context with missing correlationId', () => {
    const error = createMockBaseError({
      metadata: {
        context: {} as any, // Missing correlationId
      },
    });

    const result = serializePaymentErrorHttp({}, error, { detailLevel: 'full' });
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.PAYMENT_REQUIRED);
  });

  it('should handle payment result with invalid type', () => {
    const invalidTypeResult = {
      type: 'invalid' as any, // Invalid type, not 'success' or 'error'
      operation: 'test',
      result: {},
      transactionId: 'tx-invalid',
    };

    const result = serializePaymentErrorHttp(invalidTypeResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR); // Should call processInvalidPaymentResult
  });

  it('should handle gRPC serialization errors gracefully', () => {
    // Create a serializer that will throw in serializeGrpc
    const errorThrowingConfig = {
      observability: {
        enableLogging: true,
        onSerializationError: vi.fn(() => {
          throw new Error('Observability error');
        }),
      },
    };

    const serializer = createPaymentErrorSerializer(errorThrowingConfig);
    const error = createMockBaseError();

    // This should trigger the catch block in serializeGrpc
    const result = serializer.serializeGrpc({}, error);
    expect(result.code).toBe(PAYMENT_GRPC_STATUS.FAILED_PRECONDITION); // Error occurs before serialization
  });

  it('should handle payment result validation failures', () => {
    let validatorCalled = false;
    let validatorResult: unknown;

    const failingValidator = (result: unknown): result is unknown => {
      validatorCalled = true;
      validatorResult = result;
      return false;
    };

    const config = { resultValidator: failingValidator };

    const successResult = {
      type: 'success' as const,
      operation: 'test',
      result: { data: 'test' },
      transactionId: 'tx-test',
    };

    const result = serializePaymentErrorHttp(successResult, undefined, config);
    expect(validatorCalled).toBe(true);
    expect(validatorResult).toEqual({ data: 'test' });
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR); // Should fail validation
  });

  it('should handle malformed payment results', () => {
    // Payment result missing required fields
    const malformedResult = {
      type: 'success' as const,
      // missing operation, result, transactionId
    };

    const result = serializePaymentErrorHttp(malformedResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR); // Should be invalid
  });

  it('should handle payment error results with missing error details', () => {
    const errorResult = {
      type: 'error' as const,
      error: {
        // missing code and message
        details: { some: 'data' },
      },
    };

    const result = serializePaymentErrorHttp(errorResult);
    expect(result.status).toBe(PAYMENT_HTTP_STATUS.INTERNAL_ERROR); // Malformed error results are invalid
  });
});
