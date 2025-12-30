import { describe, expect, it, vi } from 'vitest';

import {
  createPaymentResultSerializer,
  PAYMENT_RESULT_GRPC_STATUS,
  PAYMENT_RESULT_HTTP_STATUS,
  serializeGrpcResultToJsonString,
  serializeGrpcResultWithMetadataToJsonString,
  serializeHttpResultToJsonString,
  serializeHttpResultWithMetadataToJsonString,
  serializePaymentResultGrpc,
  serializePaymentResultHttp,
} from '../../../../../../src/errors/services/billing-service/serialization/PaymentResultSerializer.js';

// ==================== MOCKS ====================

/** Mock PaymentSuccess для тестирования */
const createMockPaymentSuccess = <T = unknown>(result?: T, overrides: Partial<{
  type: 'success';
  operation: string;
  result: T;
  transactionId: string;
  amount?: number;
  currency?: string;
  provider?: string;
}> = {}): {
  type: 'success';
  operation: string;
  result: T;
  transactionId: string;
  amount?: number;
  currency?: string;
  provider?: string;
} => ({
  type: 'success',
  operation: 'test-payment',
  result: result ?? ('test-result' as T),
  transactionId: 'test-transaction-id',
  amount: 1000,
  currency: 'USD',
  provider: 'test-provider',
  ...overrides,
});

/** Mock PaymentError для тестирования */
const createMockPaymentError = (overrides: Partial<{
  type: 'error';
  error: {
    code: string;
    message: string;
    details?: {
      type?: string;
      code?: string;
      retryable?: boolean;
      provider?: string;
      operation?: string;
      transactionId?: string;
    };
  };
  operation?: string;
}> = {}): {
  type: 'error';
  error: {
    code: string;
    message: string;
    details?: {
      type?: string;
      code?: string;
      retryable?: boolean;
      provider?: string;
      operation?: string;
      transactionId?: string;
    };
  };
  operation?: string;
} => ({
  type: 'error',
  error: {
    code: 'PAYMENT_FAILED',
    message: 'Payment processing failed',
    details: {
      retryable: false,
      provider: 'test-provider',
      operation: 'test-payment',
      transactionId: 'test-transaction-id',
    },
  },
  operation: 'test-payment',
  ...overrides,
});

// ==================== TESTS ====================

describe('PaymentResultSerializer', () => {
  describe('Constants', () => {
    it('should export HTTP status constants', () => {
      expect(PAYMENT_RESULT_HTTP_STATUS).toBeDefined();
      expect(PAYMENT_RESULT_HTTP_STATUS.OK).toBe(200);
      expect(PAYMENT_RESULT_HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(PAYMENT_RESULT_HTTP_STATUS.FAILED_PRECONDITION).toBe(412);
      expect(PAYMENT_RESULT_HTTP_STATUS.INTERNAL_ERROR).toBe(500);
    });

    it('should export gRPC status constants', () => {
      expect(PAYMENT_RESULT_GRPC_STATUS).toBeDefined();
      expect(PAYMENT_RESULT_GRPC_STATUS.OK).toBe(0);
      expect(PAYMENT_RESULT_GRPC_STATUS.INVALID_ARGUMENT).toBe(3);
      expect(PAYMENT_RESULT_GRPC_STATUS.FAILED_PRECONDITION).toBe(9);
      expect(PAYMENT_RESULT_GRPC_STATUS.INTERNAL).toBe(13);
    });
  });

  describe('serializePaymentResultHttp', () => {
    it('should serialize successful payment result', () => {
      const successResult = createMockPaymentSuccess();
      const result = serializePaymentResultHttp(successResult);

      expect(result.status).toBe(200);
      expect(result.body.timestamp).toBeDefined();
      expect(result.body.result).toBe(successResult.result);
      expect(result.metadata.serializer).toBe('payment-result-http');
      expect(result.metadata.outcome.kind).toBe('success');
    });

    it('should serialize successful payment result with transactionId filtering', () => {
      const successResult = createMockPaymentSuccess();
      const result = serializePaymentResultHttp(successResult, {
        includeTransactionId: false,
      });

      expect(result.status).toBe(200);
      expect(result.body.timestamp).toBeDefined();
      expect(result.body.result).toBeDefined();
      expect(result.metadata.config.includeTransactionId).toBe(false);
    });

    it('should serialize payment error result', () => {
      const errorResult = createMockPaymentError();
      const result = serializePaymentResultHttp(errorResult);

      expect(result.status).toBe(400);
      expect(result.body.timestamp).toBeDefined();
      expect(result.body.error).toEqual(errorResult.error);
      expect(result.metadata.outcome.kind).toBe('payment-error');
      expect((result.metadata.outcome as any).code).toBe('PAYMENT_FAILED');
    });

    it('should handle invalid payment result', () => {
      const invalidResult = { invalid: 'structure' };
      const result = serializePaymentResultHttp(invalidResult);

      expect(result.status).toBe(500);
      expect((result.body.error as any).code).toBe('INVALID_PAYMENT_RESULT');
      expect(result.metadata.outcome.kind).toBe('invalid-result');
    });

    it('should handle invalid payment result with custom config', () => {
      const invalidResult = null;
      const result = serializePaymentResultHttp(invalidResult, {
        includeTransactionId: true,
      });

      expect(result.status).toBe(500);
      expect(result.metadata.config.includeTransactionId).toBe(true);
    });
  });

  describe('serializePaymentResultGrpc', () => {
    it('should serialize successful payment result', () => {
      const successResult = createMockPaymentSuccess();
      const result = serializePaymentResultGrpc(successResult);

      expect(result.code).toBe(0);
      expect(result.message).toBe('OK');
      expect(result.details).toEqual([{ result: successResult }]);
      expect(result.metadata.serializer).toBe('payment-result-grpc');
      expect(result.metadata.outcome.kind).toBe('success');
    });

    it('should serialize payment error result', () => {
      const errorResult = createMockPaymentError();
      const result = serializePaymentResultGrpc(errorResult);

      expect(result.code).toBe(3); // INVALID_ARGUMENT
      expect(result.message).toBe('Payment processing failed');
      expect(result.details).toEqual([{ error: errorResult.error }]);
      expect(result.metadata.outcome.kind).toBe('payment-error');
    });

    it('should handle invalid payment result', () => {
      const invalidResult = undefined;
      const result = serializePaymentResultGrpc(invalidResult);

      expect(result.code).toBe(13); // INTERNAL
      expect(result.message).toBe('Невалидная структура результата платежа');
      expect(result.details).toEqual([]);
      expect(result.metadata.outcome.kind).toBe('invalid-result');
    });
  });

  describe('createPaymentResultSerializer', () => {
    it('should create serializer with default config', () => {
      const serializer = createPaymentResultSerializer();

      expect(serializer.serializeHttp).toBeDefined();
      expect(serializer.serializeGrpc).toBeDefined();
    });

    it('should create serializer with custom config', () => {
      const config = {
        includeTransactionId: false,
        observability: {
          enableLogging: true,
        },
      };
      const serializer = createPaymentResultSerializer(config);

      const result = serializer.serializeHttp(createMockPaymentSuccess());
      expect(result.metadata.config.includeTransactionId).toBe(false);
    });

    it('should handle result validator', () => {
      const resultValidator = vi.fn().mockImplementation((result: unknown): result is string =>
        typeof result === 'string'
      );
      const serializer = createPaymentResultSerializer<string>({
        resultValidator: resultValidator as any,
      });

      const validResult = createMockPaymentSuccess('test-string');
      const result = serializer.serializeHttp(validResult);

      expect(result.status).toBe(200);
      expect(resultValidator).toHaveBeenCalledWith('test-string');
    });

    it('should handle invalid result from validator', () => {
      const resultValidator = vi.fn().mockImplementation((result: unknown): result is string =>
        false
      );
      const serializer = createPaymentResultSerializer<string>({
        resultValidator: resultValidator as any,
      });

      const invalidResult = createMockPaymentSuccess(123);
      const result = serializer.serializeHttp(invalidResult);

      expect(result.status).toBe(500);
      expect(result.metadata.outcome.kind).toBe('invalid-result');
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize HTTP result to JSON string', () => {
      const httpResult = serializePaymentResultHttp(createMockPaymentSuccess());
      const jsonString = serializeHttpResultToJsonString(httpResult);

      expect(typeof jsonString).toBe('string');
      const parsed = JSON.parse(jsonString);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.result).toBeDefined();
    });

    it('should serialize gRPC result to JSON string', () => {
      const grpcResult = serializePaymentResultGrpc(createMockPaymentSuccess());
      const jsonString = serializeGrpcResultToJsonString(grpcResult);

      expect(typeof jsonString).toBe('string');
      const parsed = JSON.parse(jsonString);
      expect(parsed.code).toBe(0);
      expect(parsed.message).toBe('OK');
      expect(Array.isArray(parsed.details)).toBe(true);
    });

    it('should serialize HTTP result with metadata to JSON string', () => {
      const httpResult = serializePaymentResultHttp(createMockPaymentSuccess());
      const jsonString = serializeHttpResultWithMetadataToJsonString(httpResult);

      expect(typeof jsonString).toBe('string');
      const parsed = JSON.parse(jsonString);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.serializer).toBe('payment-result-http');
    });

    it('should serialize gRPC result with metadata to JSON string', () => {
      const grpcResult = serializePaymentResultGrpc(createMockPaymentSuccess());
      const jsonString = serializeGrpcResultWithMetadataToJsonString(grpcResult);

      expect(typeof jsonString).toBe('string');
      const parsed = JSON.parse(jsonString);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.serializer).toBe('payment-result-grpc');
    });

    it('should handle circular references in JSON serialization', () => {
      const circular: any = { self: null };
      circular.self = circular;

      const httpResult = serializePaymentResultHttp(createMockPaymentSuccess(circular));
      const jsonString = serializeHttpResultToJsonString(httpResult);

      expect(typeof jsonString).toBe('string');
      // Should not throw on circular references
    });

    it('should limit depth in JSON serialization', () => {
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

      const httpResult = serializePaymentResultHttp(createMockPaymentSuccess(deepObject));
      const jsonString = serializeHttpResultToJsonString(httpResult);

      expect(typeof jsonString).toBe('string');
      const parsed = JSON.parse(jsonString);
      // The deep object should be limited by depth - level9 should be replaced
      expect(parsed.result.level1.level2.level3.level4.level5.level6.level7.level8.level9)
        .toBe('[Object too deep, max depth: 10]');
      expect(parsed.result.level1.level2.level3.level4.level5.level6.level7.level8.level10)
        .toBeUndefined();
    });

    it('should limit collection size in JSON serialization', () => {
      const largeArray = Array.from({ length: 150 }, (_, i) => `item-${i}`);
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 150; i++) {
        largeObject[`key${i}`] = `value-${i}`; // Use valid identifier names
      }

      const resultWithLargeData = createMockPaymentSuccess({
        largeArray,
        largeObject,
      });

      const httpResult = serializePaymentResultHttp(resultWithLargeData);
      const jsonString = serializeHttpResultToJsonString(httpResult);

      expect(typeof jsonString).toBe('string');
      const parsed = JSON.parse(jsonString);
      // Arrays and objects should be limited to MAX_COLLECTION_SIZE
      expect(parsed.result.largeArray).toHaveLength(100);
      expect(Object.keys(parsed.result.largeObject)).toHaveLength(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors gracefully', () => {
      const serializer = createPaymentResultSerializer();
      const result = serializer.serializeHttp(createMockPaymentSuccess());

      expect(result.status).toBe(200);
      expect(result.metadata.outcome.kind).toBe('success');
    });

    it('should handle malformed payment results', () => {
      const malformedResults = [
        null,
        undefined,
        {},
        { type: 'invalid' },
        { type: 'success' }, // missing required fields
        { type: 'error' }, // missing error object
        { type: 'error', error: {} }, // missing code and message
      ];

      malformedResults.forEach((malformed) => {
        const result = serializePaymentResultHttp(malformed);
        expect(result.status).toBe(500);
        expect(result.metadata.outcome.kind).toBe('invalid-result');
      });
    });

    it('should handle observability hooks', () => {
      const onInvalidResult = vi.fn();
      const onPaymentError = vi.fn();

      const serializer = createPaymentResultSerializer({
        observability: {
          enableLogging: true,
          onInvalidResult,
          onPaymentError,
        },
      });

      // Test invalid result hook
      serializer.serializeHttp(null);
      expect(onInvalidResult).toHaveBeenCalledWith(null, 'invalid-payment-result');

      // Test payment error hook
      const errorResult = createMockPaymentError();
      serializer.serializeHttp(errorResult);
      expect(onPaymentError).toHaveBeenCalledWith(errorResult);
    });
  });

  describe('Type Safety and Edge Cases', () => {
    it('should handle empty objects', () => {
      const result = serializePaymentResultHttp({});
      expect(result.status).toBe(500);
      expect(result.metadata.outcome.kind).toBe('invalid-result');
    });

    it('should handle primitive values', () => {
      const primitives = [42, 'string', true, Symbol('test')];

      primitives.forEach((primitive) => {
        const result = serializePaymentResultHttp(primitive);
        expect(result.status).toBe(500);
        expect(result.metadata.outcome.kind).toBe('invalid-result');
      });
    });

    it('should handle arrays', () => {
      const result = serializePaymentResultHttp([1, 2, 3]);
      expect(result.status).toBe(500);
      expect(result.metadata.outcome.kind).toBe('invalid-result');
    });

    it('should validate payment success structure', () => {
      const invalidSuccess = {
        type: 'success',
        operation: 'test',
        // missing result and transactionId
      };

      const result = serializePaymentResultHttp(invalidSuccess);
      expect(result.status).toBe(500);
    });

    it('should validate payment error structure', () => {
      const invalidError = {
        type: 'error',
        error: {
          code: 'TEST',
          // missing message
        },
      };

      const result = serializePaymentResultHttp(invalidError);
      expect(result.status).toBe(500);
    });
  });
});
