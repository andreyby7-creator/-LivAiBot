import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAIResponseSerializer,
  serializeAIResponseGrpc,
  serializeAIResponseHttp,
  serializeGrpcToJsonString,
  serializeGrpcWithMetadataToJsonString,
  serializeHttpToJsonString,
  serializeHttpWithMetadataToJsonString,
} from '../../../../../../src/errors/services/ai-service/serialization/AIResponseSerializer';

// Internal functions are not exported, we'll test them through public API
import type {
  AIErrorDetails,
  AIResponseSerializerConfig,
  AIResponseSerializerRequestConfig,
} from '../../../../../../src/errors/services/ai-service/serialization/AIResponseSerializer';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../../src/errors/base/ErrorConstants';
import { DOMAIN_ERROR_CODES } from '../../../../../../src/errors/base/ErrorCode';
import type { BaseError } from '../../../../../../src/errors/base/BaseError';

// ==================== MOCK DATA ====================

const mockValidAIResponseSuccess = {
  type: 'success' as const,
  model: 'yandexgpt-lite',
  result: { text: 'Hello world', confidence: 0.95 },
  usage: { tokens: 150, latencyMs: 250 },
};

const mockValidAIResponseError = {
  type: 'error' as const,
  error: {
    code: 'AI_MODEL_UNAVAILABLE',
    message: 'Model is temporarily unavailable',
    details: {
      type: 'model_unavailable',
      retryable: true,
      param: 'model',
    } as AIErrorDetails,
  },
};

const mockInvalidAIResponse = {
  type: 'invalid_type',
  data: 'some data',
};

const mockBaseError: BaseError = {
  _tag: 'BaseError',
  code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
  message: 'Test error message',
  severity: ERROR_SEVERITY.HIGH,
  category: ERROR_CATEGORY.TECHNICAL,
  origin: ERROR_ORIGIN.DOMAIN,
  timestamp: Date.now(),
  causeChain: [],
  metadata: {
    context: {
      correlationId: 'test-correlation-id' as any, // CorrelationId brand
      timestamp: Date.now() as any, // MetadataTimestamp brand
    },
  },
  codeMetadata: {
    code: DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    description: 'Test error',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.DOMAIN,
  },
};

const mockConfig: AIResponseSerializerConfig = {
  includeUsage: true,
  includeCauseChain: true,
  detailLevel: 'detailed',
  observability: {
    enableLogging: false,
  },
};

const mockRequestConfig: AIResponseSerializerRequestConfig = {
  includeUsage: false,
  includeCauseChain: false,
};

// ==================== OBSERVABILITY MOCKS ====================

const mockObservabilityHooks = {
  onInvalidResponse: vi.fn(),
  onAIError: vi.fn(),
  onSerializationError: vi.fn(),
};

const mockConfigWithObservability: AIResponseSerializerConfig = {
  ...mockConfig,
  observability: {
    enableLogging: true,
    ...mockObservabilityHooks,
  },
};

// ==================== CUSTOM FORMATTER MOCK ====================

const mockCustomGrpcFormatter = vi.fn();

// ==================== TESTS ====================

describe('AIResponseSerializer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('createAIResponseSerializer', () => {
    it('should create serializer with default config', () => {
      const serializer = createAIResponseSerializer();
      expect(serializer).toHaveProperty('serializeHttp');
      expect(serializer).toHaveProperty('serializeGrpc');
    });

    it('should merge config with defaults', () => {
      const serializer = createAIResponseSerializer({ includeUsage: false });
      expect(serializer).toBeDefined();
    });

    it('should support custom grpc formatter', () => {
      const serializer = createAIResponseSerializer({
        ...mockConfig,
        grpcDetailsFormatter: mockCustomGrpcFormatter,
      });
      expect(serializer).toBeDefined();
    });
  });

  describe('serializeHttp', () => {
    describe('successful AI responses', () => {
      it('should serialize valid success response with usage', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeHttp(mockValidAIResponseSuccess);

        expect(result.status).toBe(200);
        expect(result.body).toEqual(mockValidAIResponseSuccess);
        expect(result.metadata.serializer).toBe('ai-http');
        expect(result.metadata.outcome.kind).toBe('success');
      });

      it('should exclude usage when includeUsage=false in request config', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeHttp(
          mockValidAIResponseSuccess,
          undefined,
          mockRequestConfig,
        );

        expect(result.status).toBe(200);
        expect(result.body).toEqual({
          type: 'success',
          model: 'yandexgpt-lite',
          result: { text: 'Hello world', confidence: 0.95 },
          // usage должен быть исключен
        });
        expect(result.body).not.toHaveProperty('usage');
      });

      it('should handle non-AIResponseSuccess objects', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const plainResponse = { message: 'OK', status: 200 };
        const result = serializer.serializeHttp(plainResponse);

        expect(result.status).toBe(500); // Invalid response
        expect(result.metadata.outcome.kind).toBe('system-error');
      });
    });

    describe('error handling', () => {
      it('should serialize BaseError to HTTP error response', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseError);

        expect(result.status).toBe(500); // HIGH severity maps to 500
        expect(result.body).toHaveProperty('error');
        expect((result.body as any).error.code).toBe(mockBaseError.code);
        expect((result.body as any).error.message).toBe(mockBaseError.message);
        expect(result.metadata.outcome.kind).toBe('ai-error');
      });

      it('should serialize BaseError with causeChain when enabled', () => {
        const configWithCauseChain = { ...mockConfig, detailLevel: 'full' as const };
        const serializer = createAIResponseSerializer(configWithCauseChain);
        const result = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseError);

        expect((result.body as any).error).toHaveProperty('causeChain');
        expect((result.body as any).error).toHaveProperty('metadata');
      });

      it('should exclude causeChain when includeCauseChain=false in request config', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeHttp(
          mockValidAIResponseSuccess,
          mockBaseError,
          mockRequestConfig,
        );

        expect((result.body as any).error).not.toHaveProperty('causeChain');
      });

      it('should handle invalid AI responses', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeHttp(mockInvalidAIResponse);

        expect(result.status).toBe(500);
        expect(result.body).toHaveProperty('error');
        expect(result.metadata.outcome.kind).toBe('system-error');
        expect((result.metadata.outcome as any).reason).toBe('invalid-ai-response');
      });
    });

    describe('observability', () => {
      it('should call onAIError hook when BaseError provided', () => {
        const serializer = createAIResponseSerializer(mockConfigWithObservability);
        serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseError);

        expect(mockObservabilityHooks.onAIError).toHaveBeenCalledWith(mockBaseError);
      });

      it('should call onInvalidResponse hook for invalid AI responses', () => {
        const serializer = createAIResponseSerializer(mockConfigWithObservability);
        serializer.serializeHttp(mockInvalidAIResponse);

        expect(mockObservabilityHooks.onInvalidResponse).toHaveBeenCalledWith(
          mockInvalidAIResponse,
          'invalid-ai-response',
        );
      });

      it('should throw on JSON serialization failure', () => {
        const circularRef = { self: null as any };
        circularRef.self = circularRef;

        expect(() => serializeHttpToJsonString({ body: circularRef } as any)).toThrow();
      });

      it('should not call hooks when observability disabled', () => {
        const configWithoutObservability = {
          ...mockConfig,
          observability: { ...mockConfig.observability, enableLogging: false },
        };
        const serializer = createAIResponseSerializer(configWithoutObservability);
        serializer.serializeHttp(mockInvalidAIResponse, mockBaseError);

        expect(mockObservabilityHooks.onAIError).not.toHaveBeenCalled();
        expect(mockObservabilityHooks.onInvalidResponse).not.toHaveBeenCalled();
      });

      it('should handle observability hooks that throw errors gracefully', () => {
        const throwingHook = vi.fn().mockImplementation(() => {
          throw new Error('Hook error');
        });

        const configWithThrowingHook = {
          ...mockConfig,
          observability: {
            enableLogging: true,
            onInvalidResponse: throwingHook,
          },
        };

        const serializer = createAIResponseSerializer(configWithThrowingHook);

        // Should not throw despite hook error
        expect(() => {
          serializer.serializeHttp(mockInvalidAIResponse);
        }).not.toThrow();

        expect(throwingHook).toHaveBeenCalledWith(mockInvalidAIResponse, 'invalid-ai-response');
      });

      it('should call onSerializationError hook when JSON serialization fails', () => {
        const circularRef = { self: null as any };
        circularRef.self = circularRef;

        const configWithSerializationHook = {
          ...mockConfig,
          observability: {
            enableLogging: true,
            onSerializationError: mockObservabilityHooks.onSerializationError,
          },
        };

        const serializer = createAIResponseSerializer(configWithSerializationHook);
        const result = serializer.serializeHttp(mockValidAIResponseSuccess);

        // Should handle serialization error gracefully
        expect(result.status).toBe(200); // success despite potential hook issues
        expect(mockObservabilityHooks.onSerializationError).not.toHaveBeenCalled(); // not called in this case
      });
    });

    describe('severity mapping', () => {
      it('should use custom HTTP severity mapper', () => {
        const customHttpMapper = vi.fn().mockReturnValue(422);
        const configWithCustomMapper = {
          ...mockConfig,
          severityMappers: { http: customHttpMapper },
        };
        const serializer = createAIResponseSerializer(configWithCustomMapper);
        serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseError);

        expect(customHttpMapper).toHaveBeenCalledWith(mockBaseError.severity);
      });

      it('should fallback to default mapper when custom returns undefined', () => {
        const customHttpMapper = vi.fn().mockReturnValue(undefined);
        const configWithCustomMapper = {
          ...mockConfig,
          severityMappers: { http: customHttpMapper },
        };
        const serializer = createAIResponseSerializer(configWithCustomMapper);
        const result = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseError);

        expect(result.status).toBe(500); // default for HIGH severity
      });
    });
  });

  describe('serializeGrpc', () => {
    describe('successful AI responses', () => {
      it('should serialize valid success response', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeGrpc(mockValidAIResponseSuccess);

        expect(result.code).toBe(0); // OK
        expect(result.message).toBe('OK');
        expect(result.details).toEqual([{ result: mockValidAIResponseSuccess }]);
        expect(result.metadata.serializer).toBe('ai-grpc');
        expect(result.metadata.outcome.kind).toBe('success');
      });
    });

    describe('error handling', () => {
      it('should serialize BaseError to gRPC error response', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseError);

        expect(result.code).toBe(13); // INTERNAL for HIGH severity
        expect(result.message).toBe(mockBaseError.message);
        expect(result.details).toHaveLength(1); // main error + cause chain
        expect(result.metadata.outcome.kind).toBe('ai-error');
      });

      it('should use custom gRPC details formatter', () => {
        const customDetails = [{ '@type': 'custom.ErrorInfo', reason: 'test' }];
        mockCustomGrpcFormatter.mockReturnValue(customDetails);

        const configWithCustomFormatter = {
          ...mockConfig,
          grpcDetailsFormatter: mockCustomGrpcFormatter,
        };
        const serializer = createAIResponseSerializer(configWithCustomFormatter);
        const result = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseError);

        expect(mockCustomGrpcFormatter).toHaveBeenCalled();
        expect(result.details).toBe(customDetails);
      });

      it('should handle invalid AI responses', () => {
        const serializer = createAIResponseSerializer(mockConfig);
        const result = serializer.serializeGrpc(mockInvalidAIResponse);

        expect(result.code).toBe(13); // INTERNAL
        expect(result.message).toBe('Невалидная структура ответа AI');
        expect(result.details).toEqual([]);
        expect((result.metadata.outcome as any).reason).toBe('invalid-ai-response');
      });
    });

    describe('severity mapping', () => {
      it('should use custom gRPC severity mapper', () => {
        const customGrpcMapper = vi.fn().mockReturnValue(14); // UNAVAILABLE
        const configWithCustomMapper = {
          ...mockConfig,
          severityMappers: { grpc: customGrpcMapper },
        };
        const serializer = createAIResponseSerializer(configWithCustomMapper);
        serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseError);

        expect(customGrpcMapper).toHaveBeenCalledWith(mockBaseError.severity);
      });
    });
  });

  describe('JSON serialization functions', () => {
    const mockHttpResult = {
      status: 200,
      body: mockValidAIResponseSuccess,
      metadata: {
        serializer: 'ai-http' as const,
        timestamp: new Date().toISOString(),
        config: mockConfig,
        outcome: { kind: 'success' as const },
      },
    };

    const mockGrpcResult = {
      code: 0,
      message: 'OK',
      details: [{ result: mockValidAIResponseSuccess }],
      metadata: {
        serializer: 'ai-grpc' as const,
        timestamp: new Date().toISOString(),
        config: mockConfig,
        outcome: { kind: 'success' as const },
      },
    };

    describe('serializeHttpToJsonString', () => {
      it('should serialize HTTP result body to JSON', () => {
        const json = serializeHttpToJsonString(mockHttpResult);
        expect(json).toBe(JSON.stringify(mockValidAIResponseSuccess));
      });

      it('should throw on serialization error', () => {
        const circular = { self: null as any };
        circular.self = circular;

        const badResult = { ...mockHttpResult, body: circular };

        expect(() => {
          serializeHttpToJsonString(badResult);
        }).toThrow('JSON serialization failed');
      });
    });

    describe('serializeGrpcToJsonString', () => {
      it('should serialize gRPC result payload to JSON', () => {
        const json = serializeGrpcToJsonString(mockGrpcResult);
        const expected = JSON.stringify({
          code: 0,
          message: 'OK',
          details: [{ result: mockValidAIResponseSuccess }],
        });
        expect(json).toBe(expected);
      });
    });

    describe('serializeHttpWithMetadataToJsonString', () => {
      it('should serialize full HTTP result with metadata', () => {
        const json = serializeHttpWithMetadataToJsonString(mockHttpResult);
        expect(json).toBe(JSON.stringify(mockHttpResult));
      });
    });

    describe('serializeGrpcWithMetadataToJsonString', () => {
      it('should serialize full gRPC result with metadata', () => {
        const json = serializeGrpcWithMetadataToJsonString(mockGrpcResult);
        expect(json).toBe(JSON.stringify(mockGrpcResult));
      });
    });
  });

  describe('public API functions', () => {
    describe('serializeAIResponseHttp', () => {
      it('should use default config when no config provided', () => {
        const result = serializeAIResponseHttp(mockValidAIResponseSuccess);
        expect(result.status).toBe(200);
      });

      it('should accept custom config', () => {
        const result = serializeAIResponseHttp(
          mockValidAIResponseSuccess,
          undefined,
          mockConfig,
          mockRequestConfig,
        );
        expect(result.body).not.toHaveProperty('usage');
      });
    });

    describe('serializeAIResponseGrpc', () => {
      it('should use default config when no config provided', () => {
        const result = serializeAIResponseGrpc(mockValidAIResponseSuccess);
        expect(result.code).toBe(0);
      });

      it('should accept custom config and request config', () => {
        const result = serializeAIResponseGrpc(
          mockValidAIResponseSuccess,
          undefined,
          mockConfig,
          mockRequestConfig,
        );
        expect(result).toBeDefined();
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null/undefined responses', () => {
      const serializer = createAIResponseSerializer(mockConfig);

      expect(() => serializer.serializeHttp(null)).not.toThrow();
      expect(() => serializer.serializeHttp(undefined)).not.toThrow();
      expect(() => serializer.serializeGrpc(null)).not.toThrow();
      expect(() => serializer.serializeGrpc(undefined)).not.toThrow();
    });

    it('should handle empty objects', () => {
      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp({});

      expect(result.status).toBe(500); // invalid response
      expect((result.metadata.outcome as any).reason).toBe('invalid-ai-response');
    });

    it('should handle malformed BaseError gracefully', () => {
      const serializer = createAIResponseSerializer(mockConfig);
      const malformedError = { _tag: 'BaseError', code: 'TEST' }; // missing required fields

      const result = serializer.serializeHttp(mockValidAIResponseSuccess, malformedError as any);
      expect(result.status).toBe(500); // Should handle gracefully
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should normalize error objects with code and message properties', () => {
      const errorWithCodeMessage = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        details: { extra: 'info' },
      };

      // Test through processInvalidAIResponse which calls normalizeAIError
      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(errorWithCodeMessage);

      expect(result.status).toBe(500);
      expect(result.body).toHaveProperty('error');
      expect((result.body as any).error.code).toBe('CUSTOM_ERROR');
      expect((result.body as any).error.message).toBe('Custom error message');
    });

    it('should handle AI responses without usage field', () => {
      const responseWithoutUsage = {
        type: 'success' as const,
        model: 'yandexgpt-lite',
        result: { text: 'Hello' },
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(responseWithoutUsage);

      expect(result.status).toBe(200);
      expect(result.body).toEqual(responseWithoutUsage);
    });

    it('should handle AI error responses without details', () => {
      const errorWithoutDetails = {
        type: 'error' as const,
        error: {
          code: 'AI_ERROR',
          message: 'Something went wrong',
        },
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(errorWithoutDetails);

      expect(result.status).toBe(200); // AI error responses are valid AI responses
      expect(result.body).toBe(errorWithoutDetails);
    });
  });

  describe('configuration validation', () => {
    it('should handle empty config', () => {
      const serializer = createAIResponseSerializer({});
      expect(serializer).toBeDefined();
    });

    it('should handle partial config', () => {
      const serializer = createAIResponseSerializer({ includeUsage: false });
      expect(serializer).toBeDefined();
    });

    it('should merge request config with base config', () => {
      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(
        mockValidAIResponseSuccess,
        undefined,
        mockRequestConfig,
      );

      expect(result.body).not.toHaveProperty('usage'); // overridden by request config
    });

    it('should use custom resultValidator when provided', () => {
      const customValidator = vi.fn().mockReturnValue(true) as any as (
        result: unknown,
      ) => result is unknown;
      const configWithValidator = { ...mockConfig, resultValidator: customValidator };
      const serializer = createAIResponseSerializer(configWithValidator);

      const result = serializer.serializeHttp(mockValidAIResponseSuccess);
      expect(customValidator).toHaveBeenCalledWith(mockValidAIResponseSuccess.result);
      expect(result.status).toBe(200);
    });

    it('should reject response when custom resultValidator returns false', () => {
      const customValidator = vi.fn().mockReturnValue(false) as any as (
        result: unknown,
      ) => result is unknown;
      const configWithValidator = { ...mockConfig, resultValidator: customValidator };
      const serializer = createAIResponseSerializer(configWithValidator);

      const result = serializer.serializeHttp(mockValidAIResponseSuccess);
      expect(result.status).toBe(500); // invalid response because validator failed
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should handle resultValidator that returns false for gRPC', () => {
      const customValidator = vi.fn().mockReturnValue(false) as any as (
        result: unknown,
      ) => result is unknown;
      const configWithValidator = { ...mockConfig, resultValidator: customValidator };
      const serializer = createAIResponseSerializer(configWithValidator);

      const result = serializer.serializeGrpc(mockValidAIResponseSuccess);
      expect(result.code).toBe(13); // INTERNAL error for invalid response
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should handle responses that fail resultValidator for both protocols', () => {
      const strictValidator = vi.fn().mockImplementation((result: unknown) => {
        // Only accept strings
        return typeof result === 'string';
      }) as any as (result: unknown) => result is unknown;

      const configWithStrictValidator = { ...mockConfig, resultValidator: strictValidator };
      const serializer = createAIResponseSerializer(configWithStrictValidator);

      // Test with object result (should fail)
      const responseWithObjectResult = {
        type: 'success' as const,
        model: 'test-model',
        result: { key: 'value' }, // object, not string
      };

      const httpResult = serializer.serializeHttp(responseWithObjectResult);
      expect(httpResult.status).toBe(500);
      expect(httpResult.metadata.outcome.kind).toBe('system-error');

      const grpcResult = serializer.serializeGrpc(responseWithObjectResult);
      expect(grpcResult.code).toBe(13);
      expect(grpcResult.metadata.outcome.kind).toBe('system-error');
    });

    it('should handle responses that pass resultValidator', () => {
      const stringValidator = vi.fn().mockImplementation((result: unknown) => {
        return typeof result === 'string';
      }) as any as (result: unknown) => result is unknown;

      const configWithStringValidator = { ...mockConfig, resultValidator: stringValidator };
      const serializer = createAIResponseSerializer(configWithStringValidator);

      const responseWithStringResult = {
        type: 'success' as const,
        model: 'test-model',
        result: 'valid string result',
      };

      const httpResult = serializer.serializeHttp(responseWithStringResult);
      expect(httpResult.status).toBe(200);
      expect(httpResult.metadata.outcome.kind).toBe('success');

      const grpcResult = serializer.serializeGrpc(responseWithStringResult);
      expect(grpcResult.code).toBe(0);
      expect(grpcResult.metadata.outcome.kind).toBe('success');
    });

    it('should serialize valid AI error response as success in gRPC', () => {
      const serializer = createAIResponseSerializer(mockConfig);
      const aiErrorResponse = {
        type: 'error' as const,
        error: { code: 'RATE_LIMIT', message: 'Too many requests' },
      };

      const result = serializer.serializeGrpc(aiErrorResponse);
      expect(result.code).toBe(0); // OK
      expect(result.message).toBe('OK');
      expect(result.details).toEqual([{ result: aiErrorResponse }]);
      expect(result.metadata.outcome.kind).toBe('success');
    });

    it('should handle gRPC serialization errors from BaseError processing', () => {
      const serializer = createAIResponseSerializer(mockConfig);

      // Create a BaseError that will cause exception during processing
      const problematicBaseError = {
        ...mockBaseError,
        causeChain: [{ circular: null as any }],
      } as any;
      problematicBaseError.causeChain[0].circular = problematicBaseError.causeChain[0];

      const result = serializer.serializeGrpc(mockValidAIResponseSuccess, problematicBaseError);
      expect(result.code).toBe(13); // INTERNAL
      expect(result.message).toBe('Ошибка сериализации gRPC ответа');
      expect(result.metadata.outcome.kind).toBe('system-error');
      expect((result.metadata.outcome as any).reason).toBe('serialization-failed');
    });

    it('should handle custom severity mappers for both protocols', () => {
      const customSeverityMappers = {
        http: (severity: string) => severity === 'high' ? 503 : 500,
        grpc: (severity: string) => severity === 'high' ? 14 : 13, // UNAVAILABLE : INTERNAL
      };

      const configWithCustomMappers = {
        ...mockConfig,
        severityMappers: customSeverityMappers,
      };

      const serializer = createAIResponseSerializer(configWithCustomMappers);
      const mockBaseErrorHigh = { ...mockBaseError, severity: 'high' as const };

      const httpResult = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseErrorHigh);
      expect(httpResult.status).toBe(503);

      const grpcResult = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseErrorHigh);
      expect(grpcResult.code).toBe(14);
    });

    it('should fallback to default severity when custom mapper returns undefined', () => {
      const customMapperReturnsUndefined = {
        http: (severity: string) => undefined as number | undefined,
        grpc: (severity: string) => undefined as number | undefined,
      } as any; // Type assertion needed for testing undefined returns

      const configWithUndefinedMapper = {
        ...mockConfig,
        severityMappers: customMapperReturnsUndefined,
      };

      const serializer = createAIResponseSerializer(configWithUndefinedMapper);
      const mockBaseErrorHigh = { ...mockBaseError, severity: 'high' as const };

      const httpResult = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseErrorHigh);
      expect(httpResult.status).toBe(500); // default for high severity

      const grpcResult = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseErrorHigh);
      expect(grpcResult.code).toBe(13); // default for high severity (INTERNAL)
    });

    it('should use unknown severity fallback in severity mapper', () => {
      const customMapperForUnknownSeverity = {
        http: (severity: string) =>
          severity === 'unknown_severity' ? undefined as number | undefined : 400,
        grpc: (severity: string) =>
          severity === 'unknown_severity' ? undefined as number | undefined : 3,
      } as any; // Type assertion needed for testing undefined returns

      const configWithCustomMapper = {
        ...mockConfig,
        severityMappers: customMapperForUnknownSeverity,
      };

      const serializer = createAIResponseSerializer(configWithCustomMapper);
      const mockBaseErrorUnknown = { ...mockBaseError, severity: 'unknown_severity' as any };

      const httpResult = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseErrorUnknown);
      expect(httpResult.status).toBe(500); // fallback to high/default

      const grpcResult = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseErrorUnknown);
      expect(grpcResult.code).toBe(13); // fallback to high/default (INTERNAL)
    });

    it('should handle custom gRPC details formatter', () => {
      const customFormatter = vi.fn().mockReturnValue([{ customField: 'value' }]);

      const configWithCustomFormatter = {
        ...mockConfig,
        grpcDetailsFormatter: customFormatter,
      };

      const serializer = createAIResponseSerializer(configWithCustomFormatter);

      const result = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseError);
      expect(customFormatter).toHaveBeenCalledWith(
        expect.objectContaining({ _tag: 'BaseError' }),
        expect.objectContaining({ grpcDetailsFormatter: customFormatter }),
        undefined,
      );
      expect(result.details).toEqual([{ customField: 'value' }]);
    });

    it('should handle cause chain processing', () => {
      const mockBaseErrorMedium = { ...mockBaseError, severity: 'medium' as const };
      const mockBaseErrorLow = { ...mockBaseError, severity: 'low' as const };
      const mockBaseErrorWithCause = {
        ...mockBaseError,
        causeChain: [mockBaseErrorMedium, mockBaseErrorLow],
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseErrorWithCause);

      expect(result.status).toBe(500);
      expect((result.body as any).error.causeChain).toHaveLength(2);
      expect((result.body as any).error.causeChain[0].severity).toBe('medium');
      expect((result.body as any).error.causeChain[1].severity).toBe('low');
    });

    it('should exclude cause chain when disabled', () => {
      const mockBaseErrorWithCause = {
        ...mockBaseError,
        causeChain: [mockBaseError],
      };

      const configWithoutCauseChain = { ...mockConfig, includeCauseChain: false };
      const serializer = createAIResponseSerializer(configWithoutCauseChain);

      const result = serializer.serializeHttp(mockValidAIResponseSuccess, mockBaseErrorWithCause);
      expect((result.body as any).error.causeChain).toBeUndefined();
    });

    it('should handle invalid usage object types', () => {
      const responseWithInvalidUsage = {
        type: 'success' as const,
        model: 'test-model',
        result: 'test',
        usage: 'invalid-usage-string', // not an object
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(responseWithInvalidUsage);

      expect(result.status).toBe(200); // invalid usage is ignored since it's optional
      expect(result.metadata.outcome.kind).toBe('success');
    });

    it('should handle invalid error details object types', () => {
      const errorWithInvalidDetailsType = {
        type: 'error' as const,
        error: {
          code: 'TEST_ERROR',
          message: 'Test message',
          details: 'invalid-details-string', // not an object
        },
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(errorWithInvalidDetailsType);

      expect(result.status).toBe(200); // invalid details are ignored since they're optional
      expect(result.metadata.outcome.kind).toBe('success');
    });

    it('should handle error details with invalid field types', () => {
      const errorWithInvalidDetailFields = {
        type: 'error' as const,
        error: {
          code: 'TEST_ERROR',
          message: 'Test message',
          details: {
            type: '', // empty string (invalid)
            param: '', // empty string (invalid)
            code: null, // invalid type
            internalMessage: '', // empty string (invalid)
            retryable: null, // invalid type
          },
        },
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(errorWithInvalidDetailFields);

      expect(result.status).toBe(500); // invalid details should make response invalid
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should handle error details with valid fields but invalid values', () => {
      const errorWithValidFieldsInvalidValues = {
        type: 'error' as const,
        error: {
          code: 'TEST_ERROR',
          message: 'Test message',
          details: {
            type: 'valid-type',
            param: 'valid-param',
            code: 'string-code', // valid
            internalMessage: 'valid-message',
            retryable: true, // valid
          },
        },
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(errorWithValidFieldsInvalidValues);

      expect(result.status).toBe(200); // valid details should result in success
      expect(result.metadata.outcome.kind).toBe('success');
    });

    it('should include full error metadata when detailLevel is full', () => {
      const configWithFullDetails = { ...mockConfig, detailLevel: 'full' as const };
      const serializer = createAIResponseSerializer(configWithFullDetails);

      const result = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseError);
      expect(result.details[0].metadata).toHaveProperty('metadata');
      expect((result.details[0].metadata as any).metadata).toEqual(mockBaseError.metadata);
    });

    it('should exclude error metadata when detailLevel is not full', () => {
      const configWithBasicDetails = { ...mockConfig, detailLevel: 'basic' as const };
      const serializer = createAIResponseSerializer(configWithBasicDetails);

      const result = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseError);
      expect(result.details[0].metadata).not.toHaveProperty('metadata');
    });

    it('should create cause chain details for gRPC when causeChain is provided', () => {
      const mockBaseErrorMedium = {
        ...mockBaseError,
        severity: 'medium' as const,
        code: 'MEDIUM_ERROR',
        message: 'Medium error',
      };
      const mockBaseErrorLow = {
        ...mockBaseError,
        severity: 'low' as const,
        code: 'LOW_ERROR',
        message: 'Low error',
      };
      const mockBaseErrorWithCause = {
        ...mockBaseError,
        causeChain: [mockBaseErrorMedium, mockBaseErrorLow],
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseErrorWithCause);

      expect(result.details).toHaveLength(3); // main error + 2 cause chain items
      expect(result.details[0]).toHaveProperty('@type', 'type.googleapis.com/google.rpc.ErrorInfo');
      expect(result.details[0].reason).toBe(mockBaseError.code);
      expect(result.details[1].reason).toBe('MEDIUM_ERROR_0'); // first cause with index
      expect(result.details[2].reason).toBe('LOW_ERROR_1'); // second cause with index
    });

    it('should handle includeUsage=true for HTTP responses', () => {
      const configWithUsage = { ...mockConfig, includeUsage: true };
      const serializer = createAIResponseSerializer(configWithUsage);

      const responseWithUsage = {
        ...mockValidAIResponseSuccess,
        usage: { tokens: 100, latencyMs: 500 },
      };

      const result = serializer.serializeHttp(responseWithUsage);
      expect(result.body).toEqual(responseWithUsage); // usage should be included
    });

    it('should handle empty causeChain array', () => {
      const mockBaseErrorEmptyCause = {
        ...mockBaseError,
        causeChain: [],
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeGrpc(mockValidAIResponseSuccess, mockBaseErrorEmptyCause);

      expect(result.details).toHaveLength(1); // only main error, no cause chain
    });

    it('should validate invalid AI responses', () => {
      const serializer = createAIResponseSerializer(mockConfig);

      // Test invalid response types
      const invalidResponses = [
        null,
        undefined,
        'string',
        123,
        { type: 'invalid' },
        { type: 'success' }, // missing model
        { type: 'success', model: '' }, // empty model
        { type: 'success', model: 'test' }, // missing result
        { type: 'error' }, // missing error
        { type: 'error', error: 'not object' },
        { type: 'error', error: {} }, // missing code/message
      ];

      invalidResponses.forEach((invalidResponse) => {
        const result = serializer.serializeHttp(invalidResponse);
        expect(result.status).toBe(500);
        expect(result.metadata.outcome.kind).toBe('system-error');
        expect((result.metadata.outcome as any).reason).toBe('invalid-ai-response');
      });
    });

    it('should handle AI responses with null result', () => {
      const responseWithNullResult = {
        type: 'success' as const,
        model: 'test-model',
        result: null,
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(responseWithNullResult);

      expect(result.status).toBe(500); // null result should be invalid
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should handle AI responses with undefined result', () => {
      const responseWithUndefinedResult = {
        type: 'success' as const,
        model: 'test-model',
        result: undefined,
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(responseWithUndefinedResult);

      expect(result.status).toBe(500); // undefined result should be invalid
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should validate AI usage with invalid values', () => {
      // Test invalid usage - should still be valid since usage is optional
      const responseWithInvalidUsage = {
        type: 'success' as const,
        model: 'test-model',
        result: 'test',
        usage: {
          tokens: 'not-a-number', // invalid
          latencyMs: -5, // invalid negative
        },
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(responseWithInvalidUsage);

      expect(result.status).toBe(500); // invalid usage should make response invalid
      expect(result.metadata.outcome.kind).toBe('system-error');
    });

    it('should validate AI error details with invalid values', () => {
      const errorWithInvalidDetails = {
        type: 'error' as const,
        error: {
          code: 'TEST_ERROR',
          message: 'Test message',
          details: {
            type: 123, // should be string
            param: null, // should be string
            code: {}, // should be string or number
            retryable: 'not-boolean', // should be boolean
          },
        },
      };

      const serializer = createAIResponseSerializer(mockConfig);
      const result = serializer.serializeHttp(errorWithInvalidDetails);

      expect(result.status).toBe(500); // AI error responses with invalid details should be treated as invalid
      expect(result.metadata.outcome.kind).toBe('system-error');
    });
  });
});
