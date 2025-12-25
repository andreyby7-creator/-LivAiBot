import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIProvider } from '../../../../../../src/errors/services/ai-service/AIServiceInstrumentation.js';

import {
  createAIResultSerializer,
  serializeAIResult,
} from '../../../../../../src/errors/services/ai-service/serialization/AIResultSerializer';

import type {
  AIResult,
  AIResultSerializationOutcome,
  ConfidenceScore,
  ModelMetadata,
  TokenUsageStats,
} from '../../../../../../src/errors/services/ai-service/serialization/AIResultSerializer';

// ==================== MOCK DATA ====================

const mockValidModelMetadata: ModelMetadata = {
  provider: AIProvider.YANDEX,
  model: 'yandexgpt-lite',
  version: 'v1',
  temperature: 0.7,
  maxTokens: 1000,
};

const mockValidTokenUsage: TokenUsageStats = {
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  latencyMs: 250,
};

const mockValidConfidence: ConfidenceScore = {
  value: 0.85,
  source: 'model',
  explanation: 'High confidence based on model output',
};

const mockLowConfidence: ConfidenceScore = {
  value: 0.3,
  source: 'heuristic',
};

const mockFallbackConfidence: ConfidenceScore = {
  value: 0.0,
  source: 'heuristic',
  explanation: 'confidence-missing',
};

// ==================== TEST HELPERS ====================

function expectSuccessOutcome(outcome: AIResultSerializationOutcome) {
  expect(outcome).toEqual({ kind: 'success' });
}

function expectPartialOutcome(outcome: AIResultSerializationOutcome) {
  expect(outcome).toEqual({ kind: 'partial', reason: 'low-confidence' });
}

function expectFallbackOutcome(
  outcome: AIResultSerializationOutcome,
  reason: 'invalid-output' | 'confidence-missing',
) {
  expect(outcome).toEqual({ kind: 'fallback', reason });
}

function expectValidAIResult(
  result: AIResult<unknown>,
  expectedOutput: unknown,
  expectedModel: ModelMetadata,
  options: {
    usage?: TokenUsageStats;
    confidence?: ConfidenceScore;
    warnings?: readonly string[];
    metadata?: Record<string, unknown>;
  } = {},
) {
  expect(result.output).toEqual(expectedOutput);
  expect(result.model).toEqual(expectedModel);

  if (options.usage) {
    expect(result.usage).toEqual(options.usage);
  } else if (result.usage !== undefined) {
    expect(result.usage).toBeDefined();
  }

  if (options.confidence) {
    expect(result.confidence).toEqual(options.confidence);
  } else if (result.confidence !== undefined) {
    expect(result.confidence).toBeDefined();
  }

  if (options.warnings) {
    expect(result.warnings).toEqual(options.warnings);
  }

  if (options.metadata) {
    expect(result.metadata).toEqual(options.metadata);
  }
}

// ==================== TESTS ====================

describe('AIResultSerializer', () => {
  describe('createAIResultSerializer', () => {
    describe('success serialization', () => {
      it('should serialize valid result with all fields', () => {
        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: 'Hello world',
          usage: mockValidTokenUsage,
          model: mockValidModelMetadata,
          confidence: mockValidConfidence,
          warnings: ['Minor warning'],
          metadata: { customField: 'value' },
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'Hello world', mockValidModelMetadata, {
          usage: mockValidTokenUsage,
          confidence: mockValidConfidence,
          warnings: ['Minor warning'],
          metadata: { customField: 'value' },
        });
      });

      it('should serialize result without optional fields', () => {
        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: { data: 'test' },
          model: mockValidModelMetadata,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, { data: 'test' }, mockValidModelMetadata);
        expect(result.result.usage).toBeUndefined();
        expect(result.result.confidence).toBeUndefined();
        expect(result.result.warnings).toBeUndefined();
        expect(result.result.metadata).toBeUndefined();
      });

      it('should serialize with custom config', () => {
        const serializer = createAIResultSerializer({
          includeUsage: false,
          includeConfidence: false,
        });

        const result = serializer.serialize({
          output: 'test',
          usage: mockValidTokenUsage,
          model: mockValidModelMetadata,
          confidence: mockValidConfidence,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata);
        expect(result.result.usage).toBeUndefined();
        expect(result.result.confidence).toBeUndefined();
      });
    });

    describe('partial serialization (low confidence)', () => {
      it('should return partial when confidence below min threshold', () => {
        const serializer = createAIResultSerializer({
          minConfidence: 0.5,
        });

        const result = serializer.serialize({
          output: 'test',
          model: mockValidModelMetadata,
          confidence: mockLowConfidence, // value: 0.3
        });

        expectPartialOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
          confidence: mockLowConfidence,
          warnings: ['Confidence below minimum threshold'],
        });
      });

      it('should include usage in partial result', () => {
        const serializer = createAIResultSerializer({
          minConfidence: 0.8,
        });

        const result = serializer.serialize({
          output: 'test',
          usage: mockValidTokenUsage,
          model: mockValidModelMetadata,
          confidence: { value: 0.7, source: 'model' }, // value: 0.7, below min 0.8
        });

        expectPartialOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
          usage: mockValidTokenUsage,
          confidence: { value: 0.7, source: 'model' },
          warnings: ['Confidence below minimum threshold'],
        });
      });

      it('should include metadata in partial result', () => {
        const serializer = createAIResultSerializer({
          minConfidence: 0.8,
        });

        const result = serializer.serialize({
          output: 'test',
          model: mockValidModelMetadata,
          confidence: { value: 0.7, source: 'model' },
          metadata: { customField: 'partial-value' },
        });

        expectPartialOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
          confidence: { value: 0.7, source: 'model' },
          warnings: ['Confidence below minimum threshold'],
          metadata: { customField: 'partial-value' },
        });
      });
    });

    describe('fallback serialization', () => {
      describe('invalid output', () => {
        it('should return fallback when output validation fails', () => {
          const serializer = createAIResultSerializer({
            outputValidator: (output) => typeof output === 'string',
          });

          const result = serializer.serialize({
            output: 123, // Invalid output
            model: mockValidModelMetadata,
          });

          expectFallbackOutcome(result.metadata.outcome, 'invalid-output');
          expectValidAIResult(result.result, 123, mockValidModelMetadata, {
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'output-validation-failed',
            },
            warnings: ['Output validation failed'],
          });
        });

        it('should return fallback with custom confidence calculator', () => {
          const customConfidence: ConfidenceScore = {
            value: 0.75,
            source: 'external',
            explanation: 'Custom calculation',
          };

          const serializer = createAIResultSerializer({
            outputValidator: (output) => typeof output === 'string',
            confidenceCalculator: () => customConfidence,
          });

          const result = serializer.serialize({
            output: 123, // Invalid output
            model: mockValidModelMetadata,
          });

          expectFallbackOutcome(result.metadata.outcome, 'invalid-output');
          expectValidAIResult(result.result, 123, mockValidModelMetadata, {
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'output-validation-failed',
            },
            warnings: ['Output validation failed'],
          });
        });
      });

      describe('confidence missing', () => {
        it('should return success when confidence is not provided', () => {
          const serializer = createAIResultSerializer();

          const result = serializer.serialize({
            output: 'test',
            model: mockValidModelMetadata,
            // No confidence provided - this is OK
          });

          expectSuccessOutcome(result.metadata.outcome);
          expectValidAIResult(result.result, 'test', mockValidModelMetadata);
        });

        it('should return fallback when confidence is invalid', () => {
          const serializer = createAIResultSerializer();

          const result = serializer.serialize({
            output: 'test',
            model: mockValidModelMetadata,
            confidence: { value: 1.5, source: 'invalid' } as any, // Invalid confidence
          });

          expectFallbackOutcome(result.metadata.outcome, 'confidence-missing');
          expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'confidence-missing',
            },
          });
        });

        it('should include warnings and metadata in confidence-missing fallback', () => {
          const serializer = createAIResultSerializer();

          const result = serializer.serialize({
            output: 'test',
            usage: mockValidTokenUsage,
            model: mockValidModelMetadata,
            confidence: { value: 1.5, source: 'invalid' } as any, // Invalid confidence
            warnings: ['Original warning'],
            metadata: { fallbackData: 'test-value' },
          });

          expectFallbackOutcome(result.metadata.outcome, 'confidence-missing');
          expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
            usage: mockValidTokenUsage,
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'confidence-missing',
            },
            warnings: ['Original warning'],
            metadata: { fallbackData: 'test-value' },
          });
        });

        it('should handle null confidence as invalid', () => {
          const serializer = createAIResultSerializer();

          const result = serializer.serialize({
            output: 'test',
            model: mockValidModelMetadata,
            confidence: null as any, // Null confidence
          });

          expectFallbackOutcome(result.metadata.outcome, 'confidence-missing');
          expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'confidence-missing',
            },
          });
        });

        it('should handle negative confidence value as invalid', () => {
          const serializer = createAIResultSerializer();

          const result = serializer.serialize({
            output: 'test',
            model: mockValidModelMetadata,
            confidence: { value: -0.5, source: 'model' } as any, // Negative confidence
          });

          expectFallbackOutcome(result.metadata.outcome, 'confidence-missing');
          expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'confidence-missing',
            },
          });
        });

        it('should handle confidence value greater than 1 as invalid', () => {
          const serializer = createAIResultSerializer();

          const result = serializer.serialize({
            output: 'test',
            model: mockValidModelMetadata,
            confidence: { value: 1.5, source: 'model' } as any, // Value > 1
          });

          expectFallbackOutcome(result.metadata.outcome, 'confidence-missing');
          expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'confidence-missing',
            },
          });
        });

        it('should handle non-numeric confidence value as invalid', () => {
          const serializer = createAIResultSerializer();

          const result = serializer.serialize({
            output: 'test',
            model: mockValidModelMetadata,
            confidence: { value: '0.5', source: 'model' } as any, // Non-numeric value
          });

          expectFallbackOutcome(result.metadata.outcome, 'confidence-missing');
          expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
            confidence: {
              value: 0.0,
              source: 'heuristic',
              explanation: 'confidence-missing',
            },
          });
        });

        it('should not include confidence when includeConfidence is false', () => {
          const serializer = createAIResultSerializer({
            includeConfidence: false,
          });

          const result = serializer.serialize({
            output: 'test',
            model: mockValidModelMetadata,
            // No confidence needed when disabled
          });

          expectSuccessOutcome(result.metadata.outcome);
          expectValidAIResult(result.result, 'test', mockValidModelMetadata);
          expect(result.result.confidence).toBeUndefined();
        });
      });
    });

    describe('usage handling', () => {
      it('should include valid usage stats', () => {
        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: 'test',
          usage: mockValidTokenUsage,
          model: mockValidModelMetadata,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
          usage: mockValidTokenUsage,
        });
      });

      it('should exclude invalid usage stats', () => {
        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: 'test',
          usage: { promptTokens: -1 } as any, // Invalid usage
          model: mockValidModelMetadata,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata);
        expect(result.result.usage).toBeUndefined();
      });

      it('should exclude usage when includeUsage is false', () => {
        const serializer = createAIResultSerializer({
          includeUsage: false,
        });

        const result = serializer.serialize({
          output: 'test',
          usage: mockValidTokenUsage,
          model: mockValidModelMetadata,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata);
        expect(result.result.usage).toBeUndefined();
      });
    });

    describe('confidence handling', () => {
      it('should use custom confidence calculator', () => {
        const customConfidence: ConfidenceScore = {
          value: 0.9,
          source: 'external',
          explanation: 'Custom logic',
        };

        const serializer = createAIResultSerializer({
          confidenceCalculator: () => customConfidence,
        });

        const result = serializer.serialize({
          output: 'test',
          model: mockValidModelMetadata,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
          confidence: customConfidence,
        });
      });

      it('should use provided confidence when no calculator', () => {
        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: 'test',
          model: mockValidModelMetadata,
          confidence: mockValidConfidence,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
          confidence: mockValidConfidence,
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty warnings array', () => {
        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: 'test',
          model: mockValidModelMetadata,
          warnings: [],
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata, {
          warnings: [],
        });
      });

      it('should handle null/undefined metadata', () => {
        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: 'test',
          model: mockValidModelMetadata,
          metadata: undefined,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, 'test', mockValidModelMetadata);
        expect(result.result.metadata).toBeUndefined();
      });

      it('should handle complex output types', () => {
        const complexOutput = {
          text: 'Hello',
          score: 0.95,
          nested: { data: [1, 2, 3] },
        };

        const serializer = createAIResultSerializer();

        const result = serializer.serialize({
          output: complexOutput,
          model: mockValidModelMetadata,
        });

        expectSuccessOutcome(result.metadata.outcome);
        expectValidAIResult(result.result, complexOutput, mockValidModelMetadata);
      });
    });
  });

  describe('serializeAIResult (helper)', () => {
    it('should use default config', () => {
      const result = serializeAIResult({
        output: 'test',
        model: mockValidModelMetadata,
      });

      expectSuccessOutcome(result.metadata.outcome);
      expectValidAIResult(result.result, 'test', mockValidModelMetadata);
    });

    it('should accept custom config', () => {
      const result = serializeAIResult(
        {
          output: 'test',
          usage: mockValidTokenUsage,
          model: mockValidModelMetadata,
        },
        {
          includeUsage: false,
        },
      );

      expectSuccessOutcome(result.metadata.outcome);
      expectValidAIResult(result.result, 'test', mockValidModelMetadata);
      expect(result.result.usage).toBeUndefined();
    });
  });

  describe('timestamp generation', () => {
    it('should generate valid ISO timestamp', () => {
      const serializer = createAIResultSerializer();

      const result = serializer.serialize({
        output: 'test',
        model: mockValidModelMetadata,
      });

      const timestamp = result.metadata.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify it's a valid date
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });
  });

  describe('serializer metadata', () => {
    it('should set correct serializer type', () => {
      const serializer = createAIResultSerializer();

      const result = serializer.serialize({
        output: 'test',
        model: mockValidModelMetadata,
      });

      expect(result.metadata.serializer).toBe('ai-result');
    });
  });
});
