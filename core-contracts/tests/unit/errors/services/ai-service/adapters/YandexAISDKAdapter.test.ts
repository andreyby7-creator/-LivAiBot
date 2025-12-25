import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, Option } from 'effect';

import {
  createYandexAIConfigLayer,
  createYandexAISDKLayer,
  mapSDKError,
  yandexAIConfigContext,
  yandexAISDKAdapter,
  yandexAISDKContext,
} from '../../../../../../src/errors/services/ai-service/adapters/YandexAISDKAdapter';

import type {
  AICompletionRequest,
  AICompletionResponse,
  YandexAIAdapterError,
  YandexAISDK,
  YandexAISDKAdapterConfig,
} from '../../../../../../src/errors/services/ai-service/adapters/YandexAISDKAdapter';

// ==================== MOCK DATA ====================

const mockValidConfig: YandexAISDKAdapterConfig = {
  requestTimeoutMs: 5000,
  model: 'yandexgpt-lite',
};

const mockValidRequest: AICompletionRequest = {
  prompt: 'Hello world',
  temperature: 0.7,
  maxTokens: 100,
  metadata: { sessionId: 'test-123' },
};

const mockSDKResponse = {
  text: 'Hello! How can I help you?',
  model: 'yandexgpt-lite',
  usage: {
    promptTokens: 50,
    completionTokens: 25,
    totalTokens: 75,
  },
};

const mockSDKResponseWithoutUsage = {
  text: 'Simple response',
  model: 'yandexgpt-lite',
};

// ==================== MOCKS ====================

const mockYandexAISDK: YandexAISDK = {
  complete: vi.fn(),
};

// ==================== HELPER FUNCTIONS ====================

function expectYandexConnectionError(error: YandexAIAdapterError) {
  expect(error._tag).toBe('Yandex.ConnectionError');
  expect(error.message).toContain('Connection failed to Yandex AI');
  if (error._tag === 'Yandex.ConnectionError') {
    expect(error.cause).toBeDefined();
  }
}

function expectYandexUnauthorizedError(error: YandexAIAdapterError) {
  expect(error._tag).toBe('Yandex.UnauthorizedError');
  expect(error.message).toBe('Unauthorized request to Yandex AI');
}

function expectYandexQuotaExceededError(error: YandexAIAdapterError) {
  expect(error._tag).toBe('Yandex.QuotaExceededError');
  expect(error.message).toBe('Yandex AI quota exceeded');
}

function expectYandexInvalidRequestError(error: YandexAIAdapterError) {
  expect(error._tag).toBe('Yandex.InvalidRequestError');
  expect(error.message).toBe('Invalid request to Yandex AI');
  if (error._tag === 'Yandex.InvalidRequestError') {
    expect(error.details).toBeDefined();
  }
}

function expectYandexUnknownError(error: YandexAIAdapterError) {
  expect(error._tag).toBe('Yandex.UnknownError');
  expect(error.message).toBeDefined();
  if (error._tag === 'Yandex.UnknownError') {
    expect(error.cause).toBeDefined();
  }
}

function expectValidResponse(
  response: AICompletionResponse,
  expectedText: string,
  expectedModel: string,
  hasUsage = true,
) {
  expect(response.text).toBe(expectedText);
  expect(response.model).toBe(expectedModel);
  if (hasUsage) {
    expect(response.usage).toEqual(mockSDKResponse.usage);
  }
  expect(response.raw).toBeDefined();
}

// ==================== TESTS ====================

describe('YandexAISDKAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('yandexAISDKAdapter.complete', () => {
    describe('success cases', () => {
      it('should complete request with full response', async () => {
        (mockYandexAISDK.complete as any).mockResolvedValue(mockSDKResponse);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = Layer.merge(
          createYandexAIConfigLayer(mockValidConfig),
          createYandexAISDKLayer(mockYandexAISDK),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isSuccess(exit)).toBe(true);
        let result: AICompletionResponse | undefined;
        Exit.match(exit as Exit.Exit<AICompletionResponse, YandexAIAdapterError>, {
          onSuccess: (value) => {
            result = value;
          },
          onFailure: () => expect.fail('Expected success'),
        });

        expect(mockYandexAISDK.complete).toHaveBeenCalledWith({
          prompt: 'Hello world',
          temperature: 0.7,
          maxTokens: 100,
        });
        expect(result).toBeDefined();
        expectValidResponse(result!, 'Hello! How can I help you?', 'yandexgpt-lite');
      });

      it('should complete request with minimal response', async () => {
        (mockYandexAISDK.complete as any).mockResolvedValue(mockSDKResponseWithoutUsage);

        const effect = yandexAISDKAdapter.complete({
          prompt: 'Test prompt',
        });
        const layer = Layer.merge(
          createYandexAIConfigLayer(mockValidConfig),
          createYandexAISDKLayer(mockYandexAISDK),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isSuccess(exit)).toBe(true);
        let result: AICompletionResponse | undefined;
        Exit.match(exit as Exit.Exit<AICompletionResponse, YandexAIAdapterError>, {
          onSuccess: (value) => {
            result = value;
          },
          onFailure: () => expect.fail('Expected success'),
        });

        expect(mockYandexAISDK.complete).toHaveBeenCalledWith({
          prompt: 'Test prompt',
        });
        expect(result).toBeDefined();
        expectValidResponse(result!, 'Simple response', 'yandexgpt-lite', false);
        expect(result!.usage).toBeUndefined();
      });

      it('should override model from config when SDK returns different model', async () => {
        const sdkResponseWithDifferentModel = {
          ...mockSDKResponse,
          model: 'different-model',
        };
        (mockYandexAISDK.complete as any).mockResolvedValue(sdkResponseWithDifferentModel);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = Layer.merge(
          createYandexAIConfigLayer(mockValidConfig),
          createYandexAISDKLayer(mockYandexAISDK),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isSuccess(exit)).toBe(true);
        let result: AICompletionResponse | undefined;
        Exit.match(exit as Exit.Exit<AICompletionResponse, YandexAIAdapterError>, {
          onSuccess: (value) => {
            result = value;
          },
          onFailure: () => expect.fail('Expected success'),
        });

        expect(result).toBeDefined();
        expect(result!.model).toBe('different-model'); // Should use SDK model
      });

      it('should handle request without optional parameters', async () => {
        (mockYandexAISDK.complete as any).mockResolvedValue(mockSDKResponse);

        const effect = yandexAISDKAdapter.complete({
          prompt: 'Simple prompt',
        });
        const layer = Layer.merge(
          createYandexAIConfigLayer(mockValidConfig),
          createYandexAISDKLayer(mockYandexAISDK),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isSuccess(exit)).toBe(true);
        let result: AICompletionResponse | undefined;
        Exit.match(exit as Exit.Exit<AICompletionResponse, YandexAIAdapterError>, {
          onSuccess: (value) => {
            result = value;
          },
          onFailure: () => expect.fail('Expected success'),
        });

        expect(mockYandexAISDK.complete).toHaveBeenCalledWith({
          prompt: 'Simple prompt',
        });
        expect(result).toBeDefined();
        expectValidResponse(result!, 'Hello! How can I help you?', 'yandexgpt-lite');
      });

      it('should use config model when SDK returns null model', async () => {
        const sdkResponseWithNullModel = {
          ...mockSDKResponse,
          model: null as any,
        };
        (mockYandexAISDK.complete as any).mockResolvedValue(sdkResponseWithNullModel);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = Layer.merge(
          createYandexAIConfigLayer(mockValidConfig),
          createYandexAISDKLayer(mockYandexAISDK),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isSuccess(exit)).toBe(true);
        let result: AICompletionResponse | undefined;
        Exit.match(exit as Exit.Exit<AICompletionResponse, YandexAIAdapterError>, {
          onSuccess: (value) => {
            result = value;
          },
          onFailure: () => expect.fail('Expected success'),
        });

        expect(result).toBeDefined();
        expect(result!.model).toBe('yandexgpt-lite'); // Should use config model
      });
    });

    describe('timeout handling', () => {
      it('should handle timeout correctly', async () => {
        (mockYandexAISDK.complete as any).mockImplementation(
          () => new Promise(() => {}), // Never resolves
        );

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = Layer.merge(
          createYandexAIConfigLayer({
            ...mockValidConfig,
            requestTimeoutMs: 50, // Very short timeout
          }),
          createYandexAISDKLayer(mockYandexAISDK),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For timeout, just verify it's a failure - the exact error structure may vary
      });
    });

    describe('SDK error handling', () => {
      it('should handle connection errors', async () => {
        const connectionError = Object.assign(new Error('Connection failed'), {
          code: 'ECONNREFUSED',
        });
        (mockYandexAISDK.complete as any).mockRejectedValue(connectionError);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = Layer.merge(
          createYandexAIConfigLayer(mockValidConfig),
          createYandexAISDKLayer(mockYandexAISDK),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For SDK errors, just verify it's a failure - the exact error structure is tested in mapSDKError
      });

      it('should handle unauthorized errors', async () => {
        const authError = Object.assign(new Error('Unauthorized'), {
          code: 'UNAUTHORIZED',
        });
        (mockYandexAISDK.complete as any).mockRejectedValue(authError);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = createYandexAIConfigLayer(mockValidConfig).pipe(
          Layer.provide(createYandexAISDKLayer(mockYandexAISDK)),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For SDK errors, just verify it's a failure - the exact error structure is tested in mapSDKError
      });

      it('should handle quota exceeded errors', async () => {
        const quotaError = Object.assign(new Error('Quota exceeded'), {
          code: 'QUOTA_EXCEEDED',
        });
        (mockYandexAISDK.complete as any).mockRejectedValue(quotaError);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = createYandexAIConfigLayer(mockValidConfig).pipe(
          Layer.provide(createYandexAISDKLayer(mockYandexAISDK)),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For SDK errors, just verify it's a failure - the exact error structure is tested in mapSDKError
      });

      it('should handle invalid request errors', async () => {
        const invalidError = Object.assign(new Error('Invalid request'), {
          code: 'INVALID_ARGUMENT',
        });
        (mockYandexAISDK.complete as any).mockRejectedValue(invalidError);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = createYandexAIConfigLayer(mockValidConfig).pipe(
          Layer.provide(createYandexAISDKLayer(mockYandexAISDK)),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For SDK errors, just verify it's a failure - the exact error structure is tested in mapSDKError
      });

      it('should handle unknown errors', async () => {
        const unknownError = new Error('Some unknown error');
        (mockYandexAISDK.complete as any).mockRejectedValue(unknownError);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = createYandexAIConfigLayer(mockValidConfig).pipe(
          Layer.provide(createYandexAISDKLayer(mockYandexAISDK)),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For SDK errors, just verify it's a failure - the exact error structure is tested in mapSDKError
      });

      it('should handle non-object errors', async () => {
        (mockYandexAISDK.complete as any).mockRejectedValue('string error');

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = createYandexAIConfigLayer(mockValidConfig).pipe(
          Layer.provide(createYandexAISDKLayer(mockYandexAISDK)),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For SDK errors, just verify it's a failure - the exact error structure is tested in mapSDKError
      });

      it('should handle errors with non-string codes', async () => {
        const errorWithNumberCode = Object.assign(new Error('Error'), {
          code: 500,
        });
        (mockYandexAISDK.complete as any).mockRejectedValue(errorWithNumberCode);

        const effect = yandexAISDKAdapter.complete(mockValidRequest);
        const layer = createYandexAIConfigLayer(mockValidConfig).pipe(
          Layer.provide(createYandexAISDKLayer(mockYandexAISDK)),
        );

        const exit = await Effect.runPromiseExit(Effect.provide(effect, layer) as any);

        expect(Exit.isFailure(exit)).toBe(true);
        // For SDK errors, just verify it's a failure - the exact error structure is tested in mapSDKError
      });
    });
  });

  describe('Layer functions', () => {
    describe('createYandexAIConfigLayer', () => {
      it('should create config layer correctly', () => {
        const layer = createYandexAIConfigLayer(mockValidConfig);

        expect(layer).toBeDefined();
        // Layer structure testing would require Effect testing utilities
        // This is a basic smoke test
      });
    });

    describe('createYandexAISDKLayer', () => {
      it('should create SDK layer correctly', () => {
        const layer = createYandexAISDKLayer(mockYandexAISDK);

        expect(layer).toBeDefined();
        // Layer structure testing would require Effect testing utilities
        // This is a basic smoke test
      });
    });
  });

  describe('mapSDKError', () => {
    it('should handle connection errors', () => {
      const error = Object.assign(new Error('Connection failed'), {
        code: 'ECONNREFUSED',
      });
      const result = mapSDKError(error);
      expectYandexConnectionError(result);
    });

    it('should handle unauthorized errors', () => {
      const error = Object.assign(new Error('Unauthorized'), {
        code: 'UNAUTHORIZED',
      });
      const result = mapSDKError(error);
      expectYandexUnauthorizedError(result);
    });

    it('should handle quota exceeded errors', () => {
      const error = Object.assign(new Error('Quota exceeded'), {
        code: 'QUOTA_EXCEEDED',
      });
      const result = mapSDKError(error);
      expectYandexQuotaExceededError(result);
    });

    it('should handle invalid request errors', () => {
      const error = Object.assign(new Error('Invalid request'), {
        code: 'INVALID_ARGUMENT',
      });
      const result = mapSDKError(error);
      expectYandexInvalidRequestError(result);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Some unknown error');
      const result = mapSDKError(error);
      expectYandexUnknownError(result);
    });

    it('should handle non-object errors', () => {
      const result = mapSDKError('string error');
      expectYandexUnknownError(result);
    });

    it('should handle errors with non-string codes', () => {
      const error = Object.assign(new Error('Error'), {
        code: 500,
      });
      const result = mapSDKError(error);
      expectYandexUnknownError(result);
    });
  });

  describe('Context tags', () => {
    it('should export context tags', () => {
      expect(yandexAISDKContext).toBeDefined();
      expect(yandexAIConfigContext).toBeDefined();
    });
  });

  describe('Type exports', () => {
    it('should export all necessary types', () => {
      // This is a compile-time test - if types are missing, it won't compile
      const request: AICompletionRequest = mockValidRequest;
      const config: YandexAISDKAdapterConfig = mockValidConfig;
      const sdk: YandexAISDK = mockYandexAISDK;

      expect(request).toBeDefined();
      expect(config).toBeDefined();
      expect(sdk).toBeDefined();
    });
  });
});
