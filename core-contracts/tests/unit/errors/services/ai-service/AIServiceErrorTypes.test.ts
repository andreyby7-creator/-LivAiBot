import { describe, expect, it } from 'vitest';

import {
  getAIServiceErrorKind,
  groupAIServiceErrorsByKind,
  isAIServiceError,
  isAIServiceErrorKind,
  isAIServiceOrSharedError,
  isAPIRateLimitError,
  isContextOverflowError,
  isInferenceError,
  isModelLoadError,
  isPromptValidationError,
  isTokenLimitError,
  makeAIServiceError,
  matchAIServiceError,
  safeMatchAIServiceError,
  validateAIServiceError,
  validateAIServiceErrorCategory,
  validateAIServiceErrorCode,
  validateAIServiceErrorKind,
} from '../../../../../src/errors/services/ai-service/AIServiceErrorTypes';
import type {
  AIServiceError,
  AIServiceErrorKind,
  APIRateLimitError,
  ContextOverflowError,
  InferenceError,
  ModelLoadError,
  PromptValidationError,
  TokenLimitError,
} from '../../../../../src/errors/services/ai-service/AIServiceErrorTypes';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock ModelLoadError для тестов */
function createMockModelLoadError(
  code: AIServiceError['code'] = 'SERVICE_AI_006' as AIServiceError['code'],
  message = 'Model load failed',
  modelId = 'yandex-gpt-lite',
  provider: 'yandex' | 'local' | 'external' = 'yandex',
  loadAttempt = 1,
  details?: ModelLoadError['details'],
): ModelLoadError {
  return {
    _tag: 'ModelLoadError',
    category: 'model',
    code,
    message,
    modelId,
    provider,
    loadAttempt,
    ...(details && { details }),
  };
}

/** Создает mock InferenceError для тестов */
function createMockInferenceError(
  code: AIServiceError['code'] = 'SERVICE_AI_007' as AIServiceError['code'],
  message = 'Inference failed',
  modelId = 'yandex-gpt-lite',
  operation: 'generation' | 'classification' | 'embedding' | 'translation' = 'generation',
  inputTokens = 100,
  details?: InferenceError['details'],
): InferenceError {
  return {
    _tag: 'InferenceError',
    category: 'inference',
    code,
    message,
    modelId,
    operation,
    inputTokens,
    ...(details && { details }),
  };
}

/** Создает mock TokenLimitError для тестов */
function createMockTokenLimitError(
  code: AIServiceError['code'] = 'SERVICE_AI_008' as AIServiceError['code'],
  message = 'Token limit exceeded',
  requestedTokens = 2000,
  maxAllowedTokens = 1000,
  tokenType: 'input' | 'output' | 'total' = 'input',
  modelId = 'yandex-gpt-lite',
  details?: TokenLimitError['details'],
): TokenLimitError {
  return {
    _tag: 'TokenLimitError',
    category: 'token',
    code,
    message,
    requestedTokens,
    maxAllowedTokens,
    tokenType,
    modelId,
    ...(details && { details }),
  };
}

/** Создает mock APIRateLimitError для тестов */
function createMockAPIRateLimitError(
  code: AIServiceError['code'] = 'SERVICE_AI_004' as AIServiceError['code'],
  message = 'API rate limit exceeded',
  limitType:
    | 'requests_per_minute'
    | 'requests_per_hour'
    | 'requests_per_day'
    | 'tokens_per_minute' = 'requests_per_minute',
  currentUsage = 60,
  limitValue = 60,
  resetTime = Date.now() + 60000,
  details?: APIRateLimitError['details'],
): APIRateLimitError {
  return {
    _tag: 'APIRateLimitError',
    category: 'api',
    code,
    message,
    limitType,
    currentUsage,
    limitValue,
    resetTime,
    provider: 'yandex_cloud',
    ...(details && { details }),
  };
}

/** Создает mock PromptValidationError для тестов */
function createMockPromptValidationError(
  code: AIServiceError['code'] = 'SERVICE_AI_009' as AIServiceError['code'],
  message = 'Prompt validation failed',
  validationRule = 'max_length',
  promptLength = 5000,
  details?: PromptValidationError['details'],
): PromptValidationError {
  return {
    _tag: 'PromptValidationError',
    category: 'validation',
    code,
    message,
    validationRule,
    promptLength,
    ...(details && { details }),
  };
}

/** Создает mock ContextOverflowError для тестов */
function createMockContextOverflowError(
  code: AIServiceError['code'] = 'SERVICE_AI_010' as AIServiceError['code'],
  message = 'Context overflow',
  contextSize = 5000,
  maxContextSize = 4000,
  overflowAmount = 1000,
  modelId = 'yandex-gpt-lite',
  details?: ContextOverflowError['details'],
): ContextOverflowError {
  return {
    _tag: 'ContextOverflowError',
    category: 'validation',
    code,
    message,
    contextSize,
    maxContextSize,
    overflowAmount,
    modelId,
    ...(details && { details }),
  };
}

/** Создает массив всех типов ошибок для тестов */
function createMockAIServiceErrors(): AIServiceError[] {
  return [
    createMockModelLoadError(),
    createMockInferenceError(),
    createMockTokenLimitError(),
    createMockAPIRateLimitError(),
    createMockPromptValidationError(),
    createMockContextOverflowError(),
  ];
}

// ==================== TYPE GUARDS TESTS ====================

describe('AIServiceErrorTypes - Type Guards', () => {
  describe('Individual type guards', () => {
    it('isModelLoadError - should identify ModelLoadError', () => {
      const error = createMockModelLoadError();
      const notError = createMockInferenceError();

      expect(isModelLoadError(error)).toBe(true);
      expect(isModelLoadError(notError)).toBe(false);
      expect(isModelLoadError({})).toBe(false);
      expect(isModelLoadError(null)).toBe(false);
      expect(isModelLoadError(undefined)).toBe(false);
    });

    it('isInferenceError - should identify InferenceError', () => {
      const error = createMockInferenceError();
      const notError = createMockModelLoadError();

      expect(isInferenceError(error)).toBe(true);
      expect(isInferenceError(notError)).toBe(false);
      expect(isInferenceError({})).toBe(false);
    });

    it('isTokenLimitError - should identify TokenLimitError', () => {
      const error = createMockTokenLimitError();
      const notError = createMockInferenceError();

      expect(isTokenLimitError(error)).toBe(true);
      expect(isTokenLimitError(notError)).toBe(false);
      expect(isTokenLimitError({})).toBe(false);
    });

    it('isAPIRateLimitError - should identify APIRateLimitError', () => {
      const error = createMockAPIRateLimitError();
      const notError = createMockTokenLimitError();

      expect(isAPIRateLimitError(error)).toBe(true);
      expect(isAPIRateLimitError(notError)).toBe(false);
      expect(isAPIRateLimitError({})).toBe(false);
    });

    it('isPromptValidationError - should identify PromptValidationError', () => {
      const error = createMockPromptValidationError();
      const notError = createMockAPIRateLimitError();

      expect(isPromptValidationError(error)).toBe(true);
      expect(isPromptValidationError(notError)).toBe(false);
      expect(isPromptValidationError({})).toBe(false);
    });

    it('isContextOverflowError - should identify ContextOverflowError', () => {
      const error = createMockContextOverflowError();
      const notError = createMockPromptValidationError();

      expect(isContextOverflowError(error)).toBe(true);
      expect(isContextOverflowError(notError)).toBe(false);
      expect(isContextOverflowError({})).toBe(false);
    });
  });

  describe('Composite type guards', () => {
    it('isAIServiceError - should identify any AIServiceError', () => {
      const aiErrors = createMockAIServiceErrors();
      const invalidError = { _tag: 'InvalidError', code: 'SERVICE_AI_001', message: 'test' };

      aiErrors.forEach((error) => {
        expect(isAIServiceError(error)).toBe(true);
      });

      expect(isAIServiceError(invalidError)).toBe(false);
      expect(isAIServiceError({})).toBe(false);
      expect(isAIServiceError(null)).toBe(false);
      expect(isAIServiceError('string')).toBe(false);
    });

    it('isAIServiceOrSharedError - should identify AI service or shared errors', () => {
      const aiError = createMockModelLoadError();
      const sharedError = {
        _tag: 'SharedDomainError',
        category: 'domain' as const,
        code: 'SHARED_DOMAIN_001',
        message: 'test',
      };
      const invalidError = { _tag: 'InvalidError', code: 'INVALID', message: 'test' };

      expect(isAIServiceOrSharedError(aiError)).toBe(true);
      expect(isAIServiceOrSharedError(sharedError)).toBe(true);
      expect(isAIServiceOrSharedError(invalidError)).toBe(false);
    });
  });
});

// ==================== ERROR CREATION TESTS ====================

describe('AIServiceErrorTypes - Error Creation', () => {
  describe('makeAIServiceError - ModelLoadError', () => {
    it('should create ModelLoadError with required fields', () => {
      const error = makeAIServiceError(
        'ModelLoadError',
        'SERVICE_AI_006',
        'Model load failed',
        'yandex-gpt-lite',
        'yandex',
        3,
      );

      expect(error._tag).toBe('ModelLoadError');
      expect(error.category).toBe('model');
      expect(error.code).toBe('SERVICE_AI_006');
      expect(error.message).toBe('Model load failed');
      expect(error.modelId).toBe('yandex-gpt-lite');
      expect(error.provider).toBe('yandex');
      expect(error.loadAttempt).toBe(3);
      expect(error.details).toBeUndefined();
    });

    it('should create ModelLoadError with details', () => {
      const details = { modelVersion: '1.0', memoryRequired: 2048 };
      const error = makeAIServiceError(
        'ModelLoadError',
        'SERVICE_AI_006',
        'Model load failed',
        'yandex-gpt-lite',
        'yandex',
        1,
        details,
      );

      expect(error.details).toEqual(details);
    });
  });

  describe('makeAIServiceError - InferenceError', () => {
    it('should create InferenceError with required fields', () => {
      const error = makeAIServiceError(
        'InferenceError',
        'SERVICE_AI_007',
        'Inference failed',
        'yandex-gpt-lite',
        'generation',
        150,
      );

      expect(error._tag).toBe('InferenceError');
      expect(error.category).toBe('inference');
      expect(error.modelId).toBe('yandex-gpt-lite');
      expect(error.operation).toBe('generation');
      expect(error.inputTokens).toBe(150);
    });

    it('should create InferenceError with details', () => {
      const details = { temperature: 0.7, processingTime: 250 };
      const error = makeAIServiceError(
        'InferenceError',
        'SERVICE_AI_007',
        'Inference failed',
        'yandex-gpt-lite',
        'generation',
        100,
        details,
      );

      expect(error.details).toEqual(details);
    });
  });

  describe('makeAIServiceError - TokenLimitError', () => {
    it('should create TokenLimitError with required fields', () => {
      const error = makeAIServiceError(
        'TokenLimitError',
        'SERVICE_AI_008',
        'Token limit exceeded',
        2000,
        1000,
        'input',
        'yandex-gpt-lite',
      );

      expect(error._tag).toBe('TokenLimitError');
      expect(error.category).toBe('token');
      expect(error.requestedTokens).toBe(2000);
      expect(error.maxAllowedTokens).toBe(1000);
      expect(error.tokenType).toBe('input');
      expect(error.modelId).toBe('yandex-gpt-lite');
    });
  });

  describe('makeAIServiceError - APIRateLimitError', () => {
    it('should create APIRateLimitError with required fields', () => {
      const resetTime = Date.now() + 60000;
      const error = makeAIServiceError(
        'APIRateLimitError',
        'SERVICE_AI_004',
        'Rate limit exceeded',
        'requests_per_minute',
        60,
        60,
        resetTime,
      );

      expect(error._tag).toBe('APIRateLimitError');
      expect(error.category).toBe('api');
      expect(error.limitType).toBe('requests_per_minute');
      expect(error.currentUsage).toBe(60);
      expect(error.limitValue).toBe(60);
      expect(error.resetTime).toBe(resetTime);
      expect(error.provider).toBe('yandex_cloud');
    });
  });

  describe('makeAIServiceError - PromptValidationError', () => {
    it('should create PromptValidationError with required fields', () => {
      const error = makeAIServiceError(
        'PromptValidationError',
        'SERVICE_AI_009',
        'Prompt validation failed',
        'max_length',
        5000,
      );

      expect(error._tag).toBe('PromptValidationError');
      expect(error.category).toBe('validation');
      expect(error.validationRule).toBe('max_length');
      expect(error.promptLength).toBe(5000);
    });
  });

  describe('makeAIServiceError - ContextOverflowError', () => {
    it('should create ContextOverflowError with required fields', () => {
      const error = makeAIServiceError(
        'ContextOverflowError',
        'SERVICE_AI_010',
        'Context overflow',
        5000,
        4000,
        1000,
        'yandex-gpt-lite',
      );

      expect(error._tag).toBe('ContextOverflowError');
      expect(error.category).toBe('validation');
      expect(error.contextSize).toBe(5000);
      expect(error.maxContextSize).toBe(4000);
      expect(error.overflowAmount).toBe(1000);
      expect(error.modelId).toBe('yandex-gpt-lite');
    });
  });

  describe('makeAIServiceError - error handling', () => {
    it('should throw error for unknown tag', () => {
      expect(() => {
        // @ts-expect-error Testing invalid tag
        makeAIServiceError('UnknownError' as any, 'SERVICE_AI_001' as any, 'test');
      }).toThrow('Unknown AIServiceError tag: UnknownError');
    });
  });
});

// ==================== UTILITY FUNCTIONS TESTS ====================

describe('AIServiceErrorTypes - Utility Functions', () => {
  describe('getAIServiceErrorKind', () => {
    it('should return correct kind for each error type', () => {
      const errors = createMockAIServiceErrors();
      const expectedKinds: AIServiceErrorKind[] = [
        'ModelLoadError',
        'InferenceError',
        'TokenLimitError',
        'APIRateLimitError',
        'PromptValidationError',
        'ContextOverflowError',
      ];

      errors.forEach((error, index) => {
        expect(getAIServiceErrorKind(error)).toBe(expectedKinds[index]);
      });
    });
  });

  describe('isAIServiceErrorKind', () => {
    it('should correctly identify error kinds', () => {
      const error = createMockModelLoadError();

      expect(isAIServiceErrorKind(error, 'ModelLoadError')).toBe(true);
      expect(isAIServiceErrorKind(error, 'InferenceError')).toBe(false);
    });

    it('should work with type narrowing', () => {
      const error = createMockModelLoadError();

      if (isAIServiceErrorKind<ModelLoadError>(error, 'ModelLoadError')) {
        // TypeScript знает, что error является ModelLoadError
        expect(error.loadAttempt).toBeDefined();
        expect(error.provider).toBeDefined();
      }
    });
  });

  describe('groupAIServiceErrorsByKind', () => {
    it('should group errors by their kind', () => {
      const errors = [
        createMockModelLoadError(),
        createMockModelLoadError(),
        createMockInferenceError(),
        createMockTokenLimitError(),
      ];

      const grouped = groupAIServiceErrorsByKind(errors);

      expect(grouped.size).toBe(3);
      expect(grouped.get('ModelLoadError')).toHaveLength(2);
      expect(grouped.get('InferenceError')).toHaveLength(1);
      expect(grouped.get('TokenLimitError')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupAIServiceErrorsByKind([]);
      expect(grouped.size).toBe(0);
    });

    it('should handle single error', () => {
      const error = createMockModelLoadError();
      const grouped = groupAIServiceErrorsByKind([error]);

      expect(grouped.size).toBe(1);
      expect(grouped.get('ModelLoadError')).toEqual([error]);
    });
  });
});

// ==================== PATTERN MATCHING TESTS ====================

describe('AIServiceErrorTypes - Pattern Matching', () => {
  describe('matchAIServiceError', () => {
    it('should match ModelLoadError', () => {
      const error = createMockModelLoadError();
      const result = matchAIServiceError(error, {
        modelLoadError: (e) => `Model ${e.modelId} failed to load`,
        inferenceError: () => 'inference',
        tokenLimitError: () => 'token',
        apiRateLimitError: () => 'api',
        promptValidationError: () => 'prompt',
        contextOverflowError: () => 'context',
        fallback: () => 'fallback',
      });

      expect(result).toBe('Model yandex-gpt-lite failed to load');
    });

    it('should match all error types', () => {
      const errors = createMockAIServiceErrors();
      const expectedResults = [
        'model',
        'inference',
        'token',
        'api',
        'prompt',
        'context',
      ];

      errors.forEach((error, index) => {
        const result = matchAIServiceError(error, {
          modelLoadError: () => 'model',
          inferenceError: () => 'inference',
          tokenLimitError: () => 'token',
          apiRateLimitError: () => 'api',
          promptValidationError: () => 'prompt',
          contextOverflowError: () => 'context',
          fallback: () => 'fallback',
        });

        expect(result).toBe(expectedResults[index]);
      });
    });
  });

  describe('safeMatchAIServiceError', () => {
    it('should return result for valid AIServiceError', () => {
      const error = createMockModelLoadError();
      const result = safeMatchAIServiceError(error, {
        modelLoadError: (e) => `Model ${e.modelId}`,
        inferenceError: () => 'inference',
        tokenLimitError: () => 'token',
        apiRateLimitError: () => 'api',
        promptValidationError: () => 'prompt',
        contextOverflowError: () => 'context',
        fallback: () => 'fallback',
      });

      expect(result).toBe('Model yandex-gpt-lite');
    });

    it('should return undefined for invalid error', () => {
      const invalidError = { _tag: 'InvalidError', message: 'test' };
      const result = safeMatchAIServiceError(invalidError, {
        modelLoadError: () => 'model',
        inferenceError: () => 'inference',
        tokenLimitError: () => 'token',
        apiRateLimitError: () => 'api',
        promptValidationError: () => 'prompt',
        contextOverflowError: () => 'context',
        fallback: () => 'fallback',
      });

      expect(result).toBeUndefined();
    });
  });
});

// ==================== VALIDATION TESTS ====================

describe('AIServiceErrorTypes - Validation', () => {
  describe('validateAIServiceError', () => {
    it('should validate AIServiceError', () => {
      const error = createMockModelLoadError();
      const invalidError = { _tag: 'Invalid', message: 'test' };

      const valid = validateAIServiceError(error);
      const invalid = validateAIServiceError(invalidError);

      expect(valid.isValid).toBe(true);
      expect(valid.value).toBe(error);

      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain('Expected AIServiceError');
    });
  });

  describe('validateAIServiceErrorKind', () => {
    it('should validate correct error kind', () => {
      const error = createMockModelLoadError();

      const valid = validateAIServiceErrorKind(error, 'ModelLoadError');
      const invalid = validateAIServiceErrorKind(error, 'InferenceError');

      expect(valid.isValid).toBe(true);
      expect(valid.value).toBe(error);

      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain('Expected AIServiceError of kind InferenceError');
    });
  });

  describe('validateAIServiceErrorCategory', () => {
    it('should validate correct category', () => {
      const modelError = createMockModelLoadError();
      const inferenceError = createMockInferenceError();

      const validModel = validateAIServiceErrorCategory(modelError, 'model');
      const validInference = validateAIServiceErrorCategory(inferenceError, 'inference');
      const invalid = validateAIServiceErrorCategory(modelError, 'inference');

      expect(validModel.isValid).toBe(true);
      expect(validInference.isValid).toBe(true);
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain('Expected AIServiceError with category inference');
    });
  });

  describe('validateAIServiceErrorCode', () => {
    it('should validate correct SERVICE_AI_ codes', () => {
      const validCodes = ['SERVICE_AI_001', 'SERVICE_AI_010', 'SERVICE_AI_123'];
      const invalidCodes = [
        'INVALID_CODE',
        'SERVICE_AI_1', // too short
        'SERVICE_AI_1234', // too long
        'SERVICE_AI_ABC', // not digits
        'SERVICE_BI_001', // wrong prefix
      ];

      validCodes.forEach((code) => {
        const result = validateAIServiceErrorCode(code);
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(code);
      });

      invalidCodes.forEach((code) => {
        const result = validateAIServiceErrorCode(code);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject codes without SERVICE_AI_ prefix', () => {
      const result = validateAIServiceErrorCode('DOMAIN_USER_001');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('SERVICE_AI_ prefix');
    });

    it('should reject codes with wrong format', () => {
      const result = validateAIServiceErrorCode('SERVICE_AI_1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('SERVICE_AI_XXX');
    });
  });
});

// ==================== EDGE CASES & ERROR HANDLING ====================

describe('AIServiceErrorTypes - Edge Cases', () => {
  it('should handle malformed error objects', () => {
    const malformedErrors = [
      { _tag: 'ModelLoadError' }, // missing required fields
      { code: 'SERVICE_AI_001', message: 'test' }, // missing _tag
      { _tag: 'ModelLoadError', code: 'INVALID', message: 'test' }, // invalid code
      null,
      undefined,
      'string',
      123,
      [],
      {},
    ];

    malformedErrors.forEach((error) => {
      expect(isAIServiceError(error)).toBe(false);
      expect(validateAIServiceError(error).isValid).toBe(false);
    });
  });

  it('should handle errors with extra fields', () => {
    const error = createMockModelLoadError();
    (error as any).extraField = 'extra';

    expect(isAIServiceError(error)).toBe(true);
    expect(isModelLoadError(error)).toBe(true);
  });

  it('should handle all error type combinations in groupAIServiceErrorsByKind', () => {
    const allErrors = createMockAIServiceErrors();
    const doubledErrors = [...allErrors, ...allErrors]; // duplicate each error

    const grouped = groupAIServiceErrorsByKind(doubledErrors);

    expect(grouped.size).toBe(6); // all 6 error types

    grouped.forEach((errors, kind) => {
      expect(errors).toHaveLength(2); // each type appears twice
      errors.forEach((error) => {
        expect(getAIServiceErrorKind(error)).toBe(kind);
      });
    });
  });
});
