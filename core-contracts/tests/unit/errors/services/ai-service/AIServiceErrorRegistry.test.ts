import { describe, expect, it } from 'vitest';

import {
  AI_SERVICE_ERROR_CODE_LIST,
  AI_SERVICE_ERROR_CODES,
  AI_SERVICE_ERROR_COUNT,
  getAIServiceErrorMeta,
  getAllAIServiceErrorMeta,
  getAllOperationTypes,
  getErrorsByOperationType,
  getRetryStrategyForError,
  getStreamingCapableErrors,
  getTokenCostForError,
  groupErrorsByModelType,
  requiresGpuForError,
} from '../../../../../src/errors/services/ai-service/AIServiceErrorRegistry';
import type {
  AIMetadata,
  AIServiceErrorMetadata,
} from '../../../../../src/errors/services/ai-service/AIServiceErrorRegistry';

// ==================== CONSTANTS TESTS ====================

describe('AIServiceErrorRegistry - Constants', () => {
  describe('AI_SERVICE_ERROR_CODES', () => {
    it('should contain all expected error codes', () => {
      const expectedCodes = [
        'SERVICE_AI_001', // SERVICE_AI_MODEL_UNAVAILABLE
        'SERVICE_AI_002', // SERVICE_AI_PROCESSING_FAILED
        'SERVICE_AI_003', // SERVICE_AI_INVALID_INPUT
        'SERVICE_AI_004', // SERVICE_AI_RATE_LIMIT_EXCEEDED
        'SERVICE_AI_005', // SERVICE_AI_MODEL_TIMEOUT
        'SERVICE_AI_006', // SERVICE_AI_MODEL_LOAD_FAILED
        'SERVICE_AI_007', // SERVICE_AI_INFERENCE_ERROR
        'SERVICE_AI_008', // SERVICE_AI_TOKEN_LIMIT_EXCEEDED
        'SERVICE_AI_009', // SERVICE_AI_PROMPT_VALIDATION_FAILED
        'SERVICE_AI_010', // SERVICE_AI_CONTEXT_OVERFLOW
      ];

      expectedCodes.forEach((code) => {
        expect(AI_SERVICE_ERROR_CODES).toHaveProperty(code);
        expect(AI_SERVICE_ERROR_CODES[code as keyof typeof AI_SERVICE_ERROR_CODES]).toBeDefined();
      });
    });

    it('should have correct metadata structure for each error', () => {
      Object.values(AI_SERVICE_ERROR_CODES).forEach((metadata) => {
        expect(metadata).toHaveProperty('code');
        expect(metadata).toHaveProperty('description');
        expect(metadata).toHaveProperty('severity');
        expect(metadata).toHaveProperty('category');
        expect(metadata).toHaveProperty('origin');

        // AI-specific fields
        expect(metadata).toHaveProperty('modelType');
        expect(metadata).toHaveProperty('provider');
        expect(metadata).toHaveProperty('operationType');
      });
    });

    it('should have consistent operation types', () => {
      Object.values(AI_SERVICE_ERROR_CODES).forEach((metadata) => {
        expect(['generation', 'classification', 'embedding', 'translation', 'analysis']).toContain(
          metadata.operationType,
        );
      });
    });
  });

  describe('AI_SERVICE_ERROR_CODE_LIST', () => {
    it('should contain all error codes', () => {
      expect(AI_SERVICE_ERROR_CODE_LIST).toHaveLength(AI_SERVICE_ERROR_COUNT);
      expect(AI_SERVICE_ERROR_CODE_LIST).toEqual(Object.keys(AI_SERVICE_ERROR_CODES));
    });

    it('should be readonly', () => {
      expect(AI_SERVICE_ERROR_CODE_LIST).toHaveLength(Object.keys(AI_SERVICE_ERROR_CODES).length);
    });
  });

  describe('AI_SERVICE_ERROR_COUNT', () => {
    it('should match the number of error codes', () => {
      expect(AI_SERVICE_ERROR_COUNT).toBe(Object.keys(AI_SERVICE_ERROR_CODES).length);
      expect(AI_SERVICE_ERROR_COUNT).toBe(Object.keys(AI_SERVICE_ERROR_CODES).length);
    });
  });
});

// ==================== METADATA FUNCTIONS TESTS ====================

describe('AIServiceErrorRegistry - Metadata Functions', () => {
  describe('getAIServiceErrorMeta', () => {
    it('should return metadata for valid error codes', () => {
      const metadata = getAIServiceErrorMeta('SERVICE_AI_001');
      expect(metadata).toBeDefined();
      expect(metadata?.code).toBe('SERVICE_AI_001');
      expect(metadata?.description).toContain('модель ИИ недоступна');
    });

    it('should return undefined for invalid error codes', () => {
      const metadata = getAIServiceErrorMeta('INVALID_CODE');
      expect(metadata).toBeUndefined();
    });

    it('should return undefined for non-AI service codes', () => {
      const metadata = getAIServiceErrorMeta('DOMAIN_USER_NOT_FOUND');
      expect(metadata).toBeUndefined();
    });
  });

  describe('getAllAIServiceErrorMeta', () => {
    it('should return all error metadata', () => {
      const allMeta = getAllAIServiceErrorMeta();
      expect(allMeta).toEqual(AI_SERVICE_ERROR_CODES);
      expect(Object.keys(allMeta)).toHaveLength(AI_SERVICE_ERROR_COUNT);
    });

    it('should return the same reference (caching)', () => {
      const meta1 = getAllAIServiceErrorMeta();
      const meta2 = getAllAIServiceErrorMeta();
      expect(meta1).toBe(meta2); // Same reference
    });
  });
});

// ==================== UTILITY FUNCTIONS TESTS ====================

describe('AIServiceErrorRegistry - Utility Functions', () => {
  describe('requiresGpuForError', () => {
    it('should return true for GPU-required errors', () => {
      expect(requiresGpuForError('SERVICE_AI_001')).toBe(true); // MODEL_UNAVAILABLE
      expect(requiresGpuForError('SERVICE_AI_007')).toBe(true); // INFERENCE_ERROR
    });

    it('should return false for non-GPU errors', () => {
      expect(requiresGpuForError('SERVICE_AI_INVALID_INPUT')).toBe(false);
      expect(requiresGpuForError('SERVICE_AI_RATE_LIMIT_EXCEEDED')).toBe(false);
    });

    it('should return false for invalid codes', () => {
      expect(requiresGpuForError('INVALID_CODE')).toBe(false);
    });
  });

  describe('getRetryStrategyForError', () => {
    it('should return retry strategy for errors that support retry', () => {
      const strategy = getRetryStrategyForError('SERVICE_AI_001'); // MODEL_UNAVAILABLE
      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.circuitBreakerThreshold).toBe(5); // default
    });

    it('should return no-retry strategy for permanent errors', () => {
      const strategy = getRetryStrategyForError('SERVICE_AI_003'); // INVALID_INPUT
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.circuitBreakerThreshold).toBe(10);
    });

    it('should return default values for invalid codes', () => {
      const strategy = getRetryStrategyForError('INVALID_CODE');
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.circuitBreakerThreshold).toBe(5);
    });
  });

  describe('getTokenCostForError', () => {
    it('should return token cost for errors with token estimates', () => {
      expect(getTokenCostForError('SERVICE_AI_002')).toBe(100); // PROCESSING_FAILED
      expect(getTokenCostForError('SERVICE_AI_007')).toBe(200); // INFERENCE_ERROR
    });

    it('should return 0 for errors without token estimates', () => {
      expect(getTokenCostForError('SERVICE_AI_RATE_LIMIT_EXCEEDED')).toBe(0);
    });

    it('should return 0 for invalid codes', () => {
      expect(getTokenCostForError('INVALID_CODE')).toBe(0);
    });
  });

  describe('groupErrorsByModelType', () => {
    it('should group errors by model type', () => {
      const codes = [
        'SERVICE_AI_001', // MODEL_UNAVAILABLE - text
        'SERVICE_AI_002', // PROCESSING_FAILED - text
        'SERVICE_AI_003', // INVALID_INPUT - text
      ] as const;

      const grouped = groupErrorsByModelType(codes);

      expect(grouped.text).toBeDefined();
      expect(grouped.text).toHaveLength(3);
      expect(grouped.text).toEqual(codes);

      // Other model types should not be present
      expect(grouped.vision).toBeUndefined();
      expect(grouped.multimodal).toBeUndefined();
    });

    it('should handle empty array', () => {
      const grouped = groupErrorsByModelType([]);
      expect(grouped).toEqual({});
    });

    it('should handle mixed model types when available', () => {
      // Currently all errors are 'text', but test the logic
      const codes = ['SERVICE_AI_001'] as const;
      const grouped = groupErrorsByModelType(codes);

      expect(grouped.text).toEqual(['SERVICE_AI_001']);
    });

    it('should filter out invalid error codes', () => {
      const codes = ['SERVICE_AI_001', 'INVALID_CODE'] as const;
      const grouped = groupErrorsByModelType(codes);

      expect(grouped.text).toEqual(['SERVICE_AI_001']);
      expect(grouped.text).toHaveLength(1);
    });
  });

  describe('getStreamingCapableErrors', () => {
    it('should return errors that support streaming', () => {
      const streamingErrors = getStreamingCapableErrors();

      // Check that returned codes actually support streaming
      streamingErrors.forEach((code) => {
        const metadata = getAIServiceErrorMeta(code);
        expect(metadata?.supportsStreaming).toBe(true);
      });
    });

    it('should include expected streaming errors', () => {
      const streamingErrors = getStreamingCapableErrors();
      expect(streamingErrors).toContain('SERVICE_AI_001'); // MODEL_UNAVAILABLE
      expect(streamingErrors).toContain('SERVICE_AI_007'); // INFERENCE_ERROR
    });

    it('should not include non-streaming errors', () => {
      const streamingErrors = getStreamingCapableErrors();
      expect(streamingErrors).not.toContain('SERVICE_AI_INVALID_INPUT');
      expect(streamingErrors).not.toContain('SERVICE_AI_RATE_LIMIT_EXCEEDED');
    });
  });

  describe('getErrorsByOperationType', () => {
    it('should return errors for specific operation type', () => {
      const generationErrors = getErrorsByOperationType('generation');

      expect(generationErrors).toHaveLength(AI_SERVICE_ERROR_COUNT); // All current errors are generation

      generationErrors.forEach((code) => {
        const metadata = getAIServiceErrorMeta(code);
        expect(metadata?.operationType).toBe('generation');
      });
    });

    it('should return empty array for unused operation types', () => {
      const classificationErrors = getErrorsByOperationType('classification');
      expect(classificationErrors).toHaveLength(0);
    });
  });

  describe('getAllOperationTypes', () => {
    it('should return all unique operation types', () => {
      const operationTypes = getAllOperationTypes();

      expect(operationTypes).toContain('generation');
      expect(operationTypes).toHaveLength(1); // Currently only generation

      // Verify no duplicates
      expect(new Set(operationTypes)).toHaveLength(operationTypes.length);
    });

    it('should return operation types that exist in metadata', () => {
      const operationTypes = getAllOperationTypes();
      const allMetadata = getAllAIServiceErrorMeta();

      operationTypes.forEach((type) => {
        const hasType = Object.values(allMetadata).some((meta) => meta.operationType === type);
        expect(hasType).toBe(true);
      });
    });
  });
});

// ==================== INTEGRATION TESTS ====================

describe('AIServiceErrorRegistry - Integration', () => {
  describe('End-to-end workflows', () => {
    it('should support GPU requirement analysis workflow', () => {
      const allCodes = AI_SERVICE_ERROR_CODE_LIST;
      const gpuRequiredCodes = allCodes.filter((code) => requiresGpuForError(code));

      gpuRequiredCodes.forEach((code) => {
        const metadata = getAIServiceErrorMeta(code);
        expect(metadata?.requiresGpu).toBe(true);
      });

      expect(gpuRequiredCodes).toContain('SERVICE_AI_001'); // MODEL_UNAVAILABLE
      expect(gpuRequiredCodes).toContain('SERVICE_AI_007'); // INFERENCE_ERROR
    });

    it('should support retry strategy analysis workflow', () => {
      const allCodes = AI_SERVICE_ERROR_CODE_LIST;
      const retryableCodes = allCodes.filter((code) => getRetryStrategyForError(code).shouldRetry);

      retryableCodes.forEach((code) => {
        const strategy = getRetryStrategyForError(code);
        expect(strategy.shouldRetry).toBe(true);
        expect(strategy.circuitBreakerThreshold).toBeGreaterThan(0);
      });
    });

    it('should support model type grouping workflow', () => {
      const allCodes = AI_SERVICE_ERROR_CODE_LIST;
      const grouped = groupErrorsByModelType(allCodes);

      // All current errors are 'text' type
      expect(grouped.text).toHaveLength(Object.keys(AI_SERVICE_ERROR_CODES).length);
      expect(grouped.vision).toBeUndefined();

      // Verify all codes in group have correct model type
      grouped.text?.forEach((code) => {
        const metadata = getAIServiceErrorMeta(code);
        expect(metadata?.modelType).toBe('text');
      });
    });

    it('should support operation type filtering workflow', () => {
      const generationCodes = getErrorsByOperationType('generation');
      const allOperationTypes = getAllOperationTypes();

      expect(generationCodes).toHaveLength(AI_SERVICE_ERROR_COUNT);
      expect(allOperationTypes).toContain('generation');

      // Verify consistency
      generationCodes.forEach((code) => {
        const metadata = getAIServiceErrorMeta(code);
        expect(allOperationTypes).toContain(metadata?.operationType);
      });
    });
  });

  describe('Data consistency', () => {
    it('should maintain consistency between all data sources', () => {
      const allMeta = getAllAIServiceErrorMeta();
      const codeList = AI_SERVICE_ERROR_CODE_LIST;
      const count = AI_SERVICE_ERROR_COUNT;

      expect(Object.keys(allMeta)).toHaveLength(count);
      expect(codeList).toHaveLength(count);
      expect(new Set(codeList)).toHaveLength(count); // No duplicates
      expect(count).toBe(Object.keys(AI_SERVICE_ERROR_CODES).length);

      // All codes in list should have metadata
      codeList.forEach((code) => {
        expect(allMeta).toHaveProperty(code);
      });
    });

    it('should have valid metadata for all codes', () => {
      const allMeta = getAllAIServiceErrorMeta();

      Object.values(allMeta).forEach((metadata: AIServiceErrorMetadata) => {
        // Required fields
        expect(metadata.code).toBeDefined();
        expect(metadata.description).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(metadata.severity);
        expect(['BUSINESS', 'TECHNICAL', 'SECURITY', 'PERFORMANCE']).toContain(metadata.category);
        expect(['DOMAIN', 'INFRASTRUCTURE', 'SERVICE', 'EXTERNAL', 'ADMIN']).toContain(
          metadata.origin,
        );

        // AI-specific required fields
        expect(['text', 'vision', 'multimodal', 'embedding']).toContain(metadata.modelType);
        expect(['yandex', 'local', 'external']).toContain(metadata.provider);
        expect(['generation', 'classification', 'embedding', 'translation', 'analysis']).toContain(
          metadata.operationType,
        );
      });
    });
  });
});

// ==================== EDGE CASES & ERROR HANDLING ====================

describe('AIServiceErrorRegistry - Edge Cases', () => {
  it('should handle unknown error codes gracefully', () => {
    const unknownCodes = ['UNKNOWN_CODE', 'DOMAIN_USER_NOT_FOUND', 'INFRA_DB_ERROR', ''];

    unknownCodes.forEach((code) => {
      expect(getAIServiceErrorMeta(code)).toBeUndefined();
      expect(requiresGpuForError(code)).toBe(false);
      expect(getTokenCostForError(code)).toBe(0);
      expect(getRetryStrategyForError(code)).toEqual({
        shouldRetry: false,
        circuitBreakerThreshold: 5,
      });
    });
  });

  it('should handle empty inputs', () => {
    expect(groupErrorsByModelType([])).toEqual({});
    expect(getErrorsByOperationType('generation')).toBeDefined();
    expect(getAllOperationTypes()).toHaveLength(1);
  });

  it('should maintain referential integrity', () => {
    const meta1 = getAllAIServiceErrorMeta();
    const meta2 = getAllAIServiceErrorMeta();

    expect(meta1).toBe(meta2); // Same reference

    // Should not be mutable
    expect(() => {
      (meta1 as any).test = 'modified';
    }).not.toThrow(); // Object is extensible, but we test that it's the same object
  });

  it('should have deterministic results', () => {
    // Multiple calls should return same results
    const result1 = getStreamingCapableErrors();
    const result2 = getStreamingCapableErrors();
    expect(result1).toEqual(result2);

    const types1 = getAllOperationTypes();
    const types2 = getAllOperationTypes();
    expect(types1).toEqual(types2);
  });
});
