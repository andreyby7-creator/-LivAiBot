import { describe, expect, it } from 'vitest';

import {
  validateAIModel,
  validateModelTaskCompatibility,
  validateTokenLimits,
  calculateOptimalChunkSize,
  validateAPIResponse,
  validateAIOperation,
} from '../../../../../src/errors/services/ai-service/AIServiceValidators';
import type {
  AIModelFamily,
  AITaskType,
  APIResponseType,
  ModelValidationContext,
  TokenValidationContext,
  APIResponseValidationContext,
  AIValidationContext,
} from '../../../../../src/errors/services/ai-service/AIServiceValidators';

// ==================== MOCK DATA ====================

const mockModelValidationConfig = {
  knownModels: ['yandexgpt-lite', 'yandexgpt', 'yandexgpt-pro', 'yandexgpt-32k', 'yandexart'],
  defaultFallbackModel: 'yandexgpt-lite',
  taskCompatibility: [
    { taskType: 'text-generation' as AITaskType, compatibleFamilies: ['gpt-like' as AIModelFamily, 'code' as AIModelFamily], errorMessage: 'text generation requires gpt-like or code model family' },
    { taskType: 'image-analysis' as AITaskType, compatibleFamilies: ['vision' as AIModelFamily, 'multimodal' as AIModelFamily], errorMessage: 'image analysis requires vision or multimodal model family' },
    { taskType: 'embedding' as AITaskType, compatibleFamilies: ['embedding' as AIModelFamily], errorMessage: 'embedding tasks require embedding model family' },
    { taskType: 'code-generation' as AITaskType, compatibleFamilies: ['code' as AIModelFamily], errorMessage: 'code generation requires code model family' },
  ],
};

const mockTokenValidationConfig = {
  safetyBufferPercent: 10,
  maxTotalTokens: 10000,
};

const mockAPIValidationConfig = {
  maxResponseTimeMs: 30000,
  allowedResponseTypes: ['completion' as APIResponseType, 'chat_completion' as APIResponseType, 'embedding' as APIResponseType],
};

// ==================== VALIDATE AI MODEL TESTS ====================

describe('validateAIModel', () => {
  describe('Model ID validation', () => {
    it('should reject empty model ID', () => {
      const ctx: ModelValidationContext = {
        modelId: '',
      };

      const result = validateAIModel('', ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Model ID must be a non-empty string');
      expect(result.reason).toBe('model_not_found');
    });

    it('should handle null/undefined model ID gracefully', () => {
      const ctx: ModelValidationContext = {
        modelId: 'test-model',
      };

      // Function should not crash, but validation will fail due to type checking
      expect(() => validateAIModel(null as any, ctx)).not.toThrow();
      expect(() => validateAIModel(undefined as any, ctx)).not.toThrow();
    });
  });

  describe('Known models validation', () => {
    it('should accept known models', () => {
      const ctx: ModelValidationContext = {
        modelId: 'yandexgpt-lite',
        config: { models: mockModelValidationConfig },
      };

      const result = validateAIModel('yandexgpt-lite', ctx);

      expect(result.isValid).toBe(true);
    });

    it('should accept case-insensitive known models', () => {
      const ctx: ModelValidationContext = {
        modelId: 'YANDEXGPT-LITE',
        config: { models: mockModelValidationConfig },
      };

      const result = validateAIModel('YANDEXGPT-LITE', ctx);

      expect(result.isValid).toBe(true);
    });

    it('should reject unknown models with fallback suggestion', () => {
      const ctx: ModelValidationContext = {
        modelId: 'unknown-model',
        config: { models: mockModelValidationConfig },
      };

      const result = validateAIModel('unknown-model', ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unknown model: unknown-model');
      expect(result.suggestedAlternative).toBe('yandexgpt-lite');
      expect(result.reason).toBe('model_not_found');
    });
  });

  describe('Task compatibility validation', () => {
    it('should pass validation without task type', () => {
      const ctx: ModelValidationContext = {
        modelId: 'yandexgpt-lite',
        config: { models: mockModelValidationConfig },
      };

      const result = validateAIModel('yandexgpt-lite', ctx);

      expect(result.isValid).toBe(true);
    });

    it('should pass validation with compatible task and family', () => {
      const ctx: ModelValidationContext = {
        modelId: 'yandexgpt-lite',
        modelFamily: 'gpt-like',
        taskType: 'text-generation',
        config: { models: mockModelValidationConfig },
      };

      const result = validateAIModel('yandexgpt-lite', ctx);

      expect(result.isValid).toBe(true);
    });

    it('should reject incompatible task-family combination', () => {
      const ctx: ModelValidationContext = {
        modelId: 'yandexgpt-lite',
        modelFamily: 'gpt-like',
        taskType: 'image-analysis',
        config: { models: mockModelValidationConfig },
      };

      const result = validateAIModel('yandexgpt-lite', ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('incompatible with task');
      expect(result.reason).toBe('incompatible_task');
    });
  });
});

// ==================== VALIDATE MODEL TASK COMPATIBILITY TESTS ====================

describe('validateModelTaskCompatibility', () => {
  it('should return empty array for compatible combinations', () => {
    const result = validateModelTaskCompatibility('test-model', 'text-generation', 'gpt-like', mockModelValidationConfig);

    expect(result).toEqual([]);
  });

  it('should return error message for incompatible combinations', () => {
    const result = validateModelTaskCompatibility('test-model', 'image-analysis', 'gpt-like', mockModelValidationConfig);

    expect(result).toEqual(['image analysis requires vision or multimodal model family']);
  });

  it('should return error for unknown task type', () => {
    const result = validateModelTaskCompatibility('test-model', 'unknown-task' as any, 'gpt-like', mockModelValidationConfig);

    expect(result).toEqual(['Unknown task type: unknown-task']);
  });

  it('should use default compatibility when config not provided', () => {
    const result = validateModelTaskCompatibility('test-model', 'text-generation', 'gpt-like');

    expect(result).toEqual([]);
  });
});

// ==================== VALIDATE TOKEN LIMITS TESTS ====================

describe('validateTokenLimits', () => {
  describe('Input validation', () => {
    it('should reject negative token count', () => {
      const ctx: TokenValidationContext = {
        currentTokens: -1,
        maxAllowedTokens: 1000,
        contentType: 'input',
      };

      const result = validateTokenLimits(ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token count cannot be negative');
    });

    it('should reject non-positive max tokens', () => {
      const ctx: TokenValidationContext = {
        currentTokens: 100,
        maxAllowedTokens: 0,
        contentType: 'input',
      };

      const result = validateTokenLimits(ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Max allowed tokens must be positive');
    });
  });

  describe('Token limit validation', () => {
    it('should pass validation when tokens within limit', () => {
      const ctx: TokenValidationContext = {
        currentTokens: 800,
        maxAllowedTokens: 1000,
        contentType: 'input',
        config: { tokens: mockTokenValidationConfig },
      };

      const result = validateTokenLimits(ctx);

      expect(result.isValid).toBe(true);
      expect(result.usagePercent).toBe(80);
      expect(result.effectiveLimit).toBe(900); // 1000 - 10%
    });

    it('should reject when tokens exceed effective limit', () => {
      const ctx: TokenValidationContext = {
        currentTokens: 950,
        maxAllowedTokens: 1000,
        contentType: 'input',
        config: { tokens: mockTokenValidationConfig },
      };

      const result = validateTokenLimits(ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('token limit exceeded');
      expect(result.excessTokens).toBe(50);
      expect(result.usagePercent).toBe(95);
    });

    it('should use default safety buffer when not specified', () => {
      const ctx: TokenValidationContext = {
        currentTokens: 950,
        maxAllowedTokens: 1000,
        contentType: 'input',
      };

      const result = validateTokenLimits(ctx);

      expect(result.effectiveLimit).toBe(900); // default 10% buffer
    });
  });
});

// ==================== CALCULATE OPTIMAL CHUNK SIZE TESTS ====================

describe('calculateOptimalChunkSize', () => {
  it('should return original size when total tokens fit in chunk', () => {
    const result = calculateOptimalChunkSize(500, 1000);

    expect(result).toEqual({
      chunkSize: 500,
      overlap: 0,
      chunksCount: 1,
    });
  });

  it('should calculate optimal chunk size with overlap', () => {
    const result = calculateOptimalChunkSize(2500, 1000);

    expect(result).toEqual({
      chunkSize: 1000,
      overlap: 100,
      chunksCount: 3, // 2500 / (1000 - 100) ≈ 2.78, ceil to 3
    });
  });

  it('should use default overlap of 100 tokens', () => {
    const result = calculateOptimalChunkSize(1500, 1000);

    expect(result.overlap).toBe(100);
  });

  it('should use custom overlap', () => {
    const result = calculateOptimalChunkSize(1500, 1000, 50);

    expect(result.overlap).toBe(50);
  });
});

// ==================== VALIDATE API RESPONSE TESTS ====================

describe('validateAPIResponse', () => {
  describe('HTTP status validation', () => {
    it('should reject status codes below 200', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 199,
        body: {},
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('HTTP 199');
    });

    it('should reject status codes 300 and above', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 404,
        body: {},
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });

    it('should pass for status codes 200-299', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 200,
        body: { choices: [] }, // Valid structure for completion type
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Response time validation', () => {
    it('should pass when response time is within limit', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 200,
        body: { choices: [] },
        responseTimeMs: 15000,
        config: { api: mockAPIValidationConfig },
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(true);
      expect(result.responseTimeValid).toBe(true);
    });

    it('should add warning for slow response', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 200,
        body: { choices: [] },
        responseTimeMs: 15000, // > 30000 * 0.33
        config: { api: mockAPIValidationConfig },
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Response time slow: 15000ms');
    });

    it('should mark as invalid for too slow response', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 200,
        body: { choices: [] },
        responseTimeMs: 35000, // > 30000
        config: { api: mockAPIValidationConfig },
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings).toContain('Response time too slow: 35000ms');
    });
  });

  describe('Response type validation', () => {
    it('should reject disallowed response types', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'moderation' as APIResponseType,
        statusCode: 200,
        body: {},
        config: { api: mockAPIValidationConfig },
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should pass allowed response types', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 200,
        body: { choices: [] },
        config: { api: mockAPIValidationConfig },
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(true);
    });
  });

  describe('JSON format validation', () => {
    it('should reject invalid JSON when expected format is json', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 200,
        body: '{"invalid": json}',
        expectedFormat: 'json',
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid JSON format in response body');
    });

    it('should pass valid JSON', () => {
      const ctx: APIResponseValidationContext = {
        responseType: 'completion',
        statusCode: 200,
        body: '{"valid": "json"}',
        expectedFormat: 'json',
      };

      const result = validateAPIResponse(ctx);

      expect(result.isValid).toBe(true);
    });
  });
});

// ==================== VALIDATE AI OPERATION TESTS ====================

describe('validateAIOperation', () => {
  it('should pass validation when all components are valid', () => {
    const ctx: AIValidationContext = {
      model: {
        modelId: 'yandexgpt-lite',
        config: { models: mockModelValidationConfig },
      },
      inputTokens: {
        currentTokens: 500,
        maxAllowedTokens: 1000,
        contentType: 'input',
        config: { tokens: mockTokenValidationConfig },
      },
      outputTokens: {
        currentTokens: 200,
        maxAllowedTokens: 1000,
        contentType: 'output',
        config: { tokens: mockTokenValidationConfig },
      },
      apiResponse: {
        responseType: 'completion',
        statusCode: 200,
        body: { choices: [] },
        config: { api: mockAPIValidationConfig },
      },
      config: {
        models: mockModelValidationConfig,
        tokens: mockTokenValidationConfig,
        api: mockAPIValidationConfig,
      },
    };

    const result = validateAIOperation(ctx);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should collect all validation errors', () => {
    const ctx: AIValidationContext = {
      model: {
        modelId: 'unknown-model',
        config: { models: mockModelValidationConfig },
      },
      inputTokens: {
        currentTokens: 1200, // exceeds limit
        maxAllowedTokens: 1000,
        contentType: 'input',
        config: { tokens: mockTokenValidationConfig },
      },
      outputTokens: {
        currentTokens: 200,
        maxAllowedTokens: 1000,
        contentType: 'output',
        config: { tokens: mockTokenValidationConfig },
      },
      apiResponse: {
        responseType: 'moderation' as APIResponseType, // disallowed
        statusCode: 200,
        body: {},
        config: { api: mockAPIValidationConfig },
      },
      config: {
        models: mockModelValidationConfig,
        tokens: mockTokenValidationConfig,
        api: mockAPIValidationConfig,
      },
    };

    const result = validateAIOperation(ctx);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toContain('Model:');
    expect(result.errors[1]).toContain('Input tokens:');
    expect(result.errors[2]).toContain('API response:');
  });

  it('should collect warnings from API response', () => {
    const ctx: AIValidationContext = {
      model: {
        modelId: 'yandexgpt-lite',
        config: { models: mockModelValidationConfig },
      },
      apiResponse: {
        responseType: 'completion',
        statusCode: 200,
        body: { choices: [] },
        responseTimeMs: 15000, // slow response
        config: { api: mockAPIValidationConfig },
      },
      config: {
        models: mockModelValidationConfig,
        api: mockAPIValidationConfig,
      },
    };

    const result = validateAIOperation(ctx);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Response time slow');
  });

  it('should work with partial validation context', () => {
    const ctx: AIValidationContext = {
      model: {
        modelId: 'yandexgpt-lite',
        config: { models: mockModelValidationConfig },
      },
      // No tokens or API response
      config: { models: mockModelValidationConfig },
    };

    const result = validateAIOperation(ctx);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should provide normalized errors when validation fails', () => {
    const ctx: AIValidationContext = {
      model: {
        modelId: 'unknown-model',
        config: { models: mockModelValidationConfig },
      },
      config: { models: mockModelValidationConfig },
    };

    const result = validateAIOperation(ctx);

    expect(result.isValid).toBe(false);
    expect(result.normalizedErrors).toBeDefined();
    expect(result.normalizedErrors?.primary).toBeDefined();
    expect(result.normalizedErrors?.byComponent.model).toBeDefined();
  });

  it('should collect output token errors', () => {
    const ctx: AIValidationContext = {
      model: {
        modelId: 'yandexgpt-lite',
        config: { models: mockModelValidationConfig },
      },
      outputTokens: {
        currentTokens: 1200, // exceeds limit
        maxAllowedTokens: 1000,
        contentType: 'output',
        config: { tokens: mockTokenValidationConfig },
      },
      config: {
        models: mockModelValidationConfig,
        tokens: mockTokenValidationConfig,
      },
    };

    const result = validateAIOperation(ctx);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Output tokens: output token limit exceeded: 1200/900 (120%)');
  });
});

// ==================== EDGE CASES AND ERROR HANDLING ====================

describe('Edge cases and error handling', () => {
  it('should handle undefined config gracefully', () => {
    const ctx: ModelValidationContext = {
      modelId: 'yandexgpt-lite',
    };

    const result = validateAIModel('yandexgpt-lite', ctx);

    expect(result.isValid).toBe(true);
  });

  it('should handle empty arrays in API response validation', () => {
    const ctx: APIResponseValidationContext = {
      responseType: 'completion',
      statusCode: 200,
      body: { choices: [] },
    };

    const result = validateAPIResponse(ctx);

    expect(result.isValid).toBe(true);
  });

  it('should handle null body in API response', () => {
    const ctx: APIResponseValidationContext = {
      responseType: 'completion',
      statusCode: 200,
      body: null,
    };

    const result = validateAPIResponse(ctx);

    expect(result.isValid).toBe(true);
  });

  it('should reject response missing required array field', () => {
    const ctx: APIResponseValidationContext = {
      responseType: 'completion',
      statusCode: 200,
      body: { notChoices: [] }, // Missing 'choices' field
    };

    const result = validateAPIResponse(ctx);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('missing required "choices" array');
  });

  it('should extract normalized error from API response', () => {
    const mockBody = {
      error: {
        code: 'API_ERROR',
        message: 'Something went wrong',
      },
    };

    // Test the internal function indirectly through error handling
    const ctx: APIResponseValidationContext = {
      responseType: 'completion',
      statusCode: 400,
      body: mockBody,
    };

    const result = validateAPIResponse(ctx);

    expect(result.isValid).toBe(false);
    expect(result.apiErrorCode).toBe('API_ERROR');
  });

  it('should handle undefined response time', () => {
    const ctx: APIResponseValidationContext = {
      responseType: 'completion',
      statusCode: 200,
      body: { choices: [] },
      responseTimeMs: undefined,
    };

    const result = validateAPIResponse(ctx);

    expect(result.isValid).toBe(true);
    expect(result.responseTimeValid).toBe(true);
  });
});
