import { describe, expect, it } from 'vitest';

import {
  createPromptForbiddenContentError,
  createPromptFormatError,
  createPromptTooLongError,
  createPromptValidationError,
  isPromptForbiddenContentError,
  isPromptFormatError,
  isPromptLengthError,
  isValidPromptValidationErrorContext,
} from '../../../../../../src/errors/services/ai-service/domain/index.js';
import type {
  PromptValidationError,
  PromptValidationErrorContext,
} from '../../../../../../src/errors/services/ai-service/domain/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock PromptValidationErrorContext для тестов */
function createMockPromptValidationContext(
  overrides: Partial<PromptValidationErrorContext> = {},
): PromptValidationErrorContext {
  return {
    type: 'prompt_validation',
    validationRule: 'test_rule',
    promptLength: 100,
    maxAllowedLength: 500,
    invalidParts: ['bad word'],
    suggestions: ['remove bad content'],
    promptPreview: 'This is a bad...',
    contentType: 'text',
    confidence: 0.9,
    validationModel: 'safety-model-v1',
    ...overrides,
  };
}

/** Создает mock PromptValidationError для тестов */
function createMockPromptValidationError(
  contextOverrides: Partial<PromptValidationErrorContext> = {},
): PromptValidationError {
  return createPromptValidationError(
    'SERVICE_AI_009' as any,
    'Test validation error',
    'test_rule',
    100,
    createMockPromptValidationContext(contextOverrides),
  );
}

// ==================== TESTS ====================

describe('PromptValidationError Domain', () => {
  describe('createPromptValidationError', () => {
    it('should create PromptValidationError with all fields', () => {
      const error = createPromptValidationError(
        'SERVICE_AI_009' as any,
        'Validation failed',
        'custom_rule',
        150,
        {
          type: 'prompt_validation',
          maxAllowedLength: 200,
          invalidParts: ['part1', 'part2'],
          suggestions: ['fix1', 'fix2'],
          promptPreview: 'preview text',
          contentType: 'json',
          confidence: 0.8,
          validationModel: 'model-v1',
        },
      );

      expect(error._tag).toBe('PromptValidationError');
      expect(error.category).toBe('SECURITY');
      expect(error.origin).toBe('DOMAIN');
      expect(error.severity).toBe('high');
      expect(error.code).toBe('SERVICE_AI_009');
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual({
        type: 'prompt_validation',
        validationRule: 'custom_rule',
        promptLength: 150,
        maxAllowedLength: 200,
        invalidParts: ['part1', 'part2'],
        suggestions: ['fix1', 'fix2'],
        promptPreview: 'preview text',
        contentType: 'json',
        confidence: 0.8,
        validationModel: 'model-v1',
      });
    });

    it('should create error with minimal context', () => {
      const error = createPromptValidationError(
        'SERVICE_AI_009' as any,
        'Minimal error',
        'min_rule',
        50,
      );

      expect(error.details).toEqual({
        type: 'prompt_validation',
        validationRule: 'min_rule',
        promptLength: 50,
      });
    });

    it('should use current timestamp', () => {
      const before = new Date().toISOString();
      const error = createPromptValidationError(
        'SERVICE_AI_009' as any,
        'Timestamp test',
        'time_rule',
        25,
      );
      const after = new Date().toISOString();

      expect(error.timestamp).toBeDefined();
      expect(error.timestamp >= before).toBe(true);
      expect(error.timestamp <= after).toBe(true);
    });

    it('should accept custom timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createPromptValidationError(
        'SERVICE_AI_009' as any,
        'Custom timestamp',
        'custom_time_rule',
        75,
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
    });
  });

  describe('createPromptTooLongError', () => {
    it('should create error for too long prompt', () => {
      const error = createPromptTooLongError(1000, 500, ['Shorten text', 'Remove details']);

      expect(error._tag).toBe('PromptValidationError');
      expect(error.message).toBe('Промпт слишком длинный: 1000 символов (макс. 500)');
      expect(error.details?.validationRule).toBe('max_length_exceeded');
      expect(error.details?.promptLength).toBe(1000);
      expect(error.details?.maxAllowedLength).toBe(500);
      expect(error.details?.suggestions).toEqual(['Shorten text', 'Remove details']);
      expect(error.details?.promptPreview).toBe('Длина: 1000/500');
      expect(error.details?.type).toBe('prompt_validation');
    });

    it('should create error with default suggestions', () => {
      const error = createPromptTooLongError(600, 500);

      expect(error.details?.suggestions).toEqual([]);
    });
  });

  describe('createPromptForbiddenContentError', () => {
    it('should create error for forbidden content', () => {
      const invalidParts = ['badword1', 'badword2'];
      const error = createPromptForbiddenContentError(
        invalidParts,
        'content_filter_violation',
        0.95,
      );

      expect(error._tag).toBe('PromptValidationError');
      expect(error.message).toBe(
        'Промпт содержит запрещенный контент по правилу: content_filter_violation',
      );
      expect(error.details?.validationRule).toBe('content_filter_violation');
      expect(error.details?.promptLength).toBe(16); // length of joined invalidParts
      expect(error.details?.invalidParts).toEqual(invalidParts);
      expect(error.details?.confidence).toBe(0.95);
      expect(error.details?.promptPreview).toBe('badword1...badword2'); // first 3 parts joined with ...
    });

    it('should use default confidence', () => {
      const error = createPromptForbiddenContentError(['spam'], 'spam_rule');

      expect(error.details?.confidence).toBe(0.8);
    });

    it('should handle empty invalidParts', () => {
      const error = createPromptForbiddenContentError([], 'empty_rule');

      expect(error.details?.promptLength).toBe(0);
      expect(error.details?.invalidParts).toEqual([]);
      expect(error.details?.promptPreview).toBe('');
    });
  });

  describe('createPromptFormatError', () => {
    it('should create error for format issues', () => {
      const error = createPromptFormatError(
        'json',
        '{"invalid": json}',
        ['Use valid JSON format', 'Check syntax'],
      );

      expect(error._tag).toBe('PromptValidationError');
      expect(error.message).toBe('Некорректный формат промпта для типа контента: json');
      expect(error.details?.validationRule).toBe('invalid_format');
      expect(error.details?.promptLength).toBe(17); // length of '{"invalid": json}'
      expect(error.details?.contentType).toBe('json');
      expect(error.details?.promptPreview).toBe('{"invalid": json}');
      expect(error.details?.suggestions).toEqual(['Use valid JSON format', 'Check syntax']);
    });

    it('should use default suggestions', () => {
      const error = createPromptFormatError('xml', '<invalid>');

      expect(error.details?.suggestions).toEqual([
        'Используйте правильный формат для xml',
        'Проверьте синтаксис',
        'Следуйте документации по формату',
      ]);
    });
  });

  describe('isValidPromptValidationErrorContext', () => {
    it('should validate correct context', () => {
      const context = createMockPromptValidationContext();
      expect(isValidPromptValidationErrorContext(context)).toBe(true);
    });

    it('should reject null/undefined', () => {
      expect(isValidPromptValidationErrorContext(null)).toBe(false);
      expect(isValidPromptValidationErrorContext(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isValidPromptValidationErrorContext('string')).toBe(false);
      expect(isValidPromptValidationErrorContext(123)).toBe(false);
      expect(isValidPromptValidationErrorContext([])).toBe(false);
    });

    it('should reject wrong type', () => {
      const context = { ...createMockPromptValidationContext(), type: 'wrong_type' };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject missing required fields', () => {
      const context = { type: 'prompt_validation' as const };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid validationRule', () => {
      const context = {
        ...createMockPromptValidationContext(),
        validationRule: null as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid promptLength', () => {
      const context = {
        ...createMockPromptValidationContext(),
        promptLength: 'not-a-number' as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should accept context with only required fields', () => {
      const context: PromptValidationErrorContext = {
        type: 'prompt_validation',
        validationRule: 'test',
        promptLength: 42,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(true);
    });

    it('should validate optional fields', () => {
      const context = {
        type: 'prompt_validation' as const,
        validationRule: 'test',
        promptLength: 100,
        maxAllowedLength: 200,
        invalidParts: ['part1'],
        suggestions: ['suggestion1'],
        promptPreview: 'preview',
        contentType: 'text',
        confidence: 0.9,
        validationModel: 'model-v1',
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(true);
    });

    it('should reject invalid promptPreview type', () => {
      const context = {
        ...createMockPromptValidationContext(),
        promptPreview: 123 as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid contentType type', () => {
      const context = {
        ...createMockPromptValidationContext(),
        contentType: {} as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid confidence type', () => {
      const context = {
        ...createMockPromptValidationContext(),
        confidence: '0.9' as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid validationModel type', () => {
      const context = {
        ...createMockPromptValidationContext(),
        validationModel: [] as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid maxAllowedLength type', () => {
      const context = {
        ...createMockPromptValidationContext(),
        maxAllowedLength: '200' as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid invalidParts type', () => {
      const context = {
        ...createMockPromptValidationContext(),
        invalidParts: 'not-array' as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });

    it('should reject invalid suggestions type', () => {
      const context = {
        ...createMockPromptValidationContext(),
        suggestions: {} as any,
      };
      expect(isValidPromptValidationErrorContext(context)).toBe(false);
    });
  });

  describe('Error type checkers', () => {
    describe('isPromptLengthError', () => {
      it('should identify length errors', () => {
        const error = createMockPromptValidationError({
          validationRule: 'max_length_exceeded',
        });
        expect(isPromptLengthError(error)).toBe(true);
      });

      it('should reject non-length errors', () => {
        const error = createMockPromptValidationError({
          validationRule: 'content_filter',
        });
        expect(isPromptLengthError(error)).toBe(false);
      });

      it('should handle undefined details', () => {
        const error = createPromptValidationError(
          'SERVICE_AI_009' as any,
          'Test',
          'test',
          100,
        );
        // Manually remove details to test edge case
        (error as any).details = undefined;
        expect(isPromptLengthError(error)).toBe(false);
      });
    });

    describe('isPromptForbiddenContentError', () => {
      it('should identify forbidden content errors', () => {
        const testCases = [
          'forbidden_words',
          'unsafe_content',
          'prohibited_terms',
          'contains_forbidden',
        ];

        testCases.forEach((rule) => {
          const error = createMockPromptValidationError({ validationRule: rule });
          expect(isPromptForbiddenContentError(error)).toBe(true);
        });
      });

      it('should reject non-forbidden content errors', () => {
        const error = createMockPromptValidationError({
          validationRule: 'format_error',
        });
        expect(isPromptForbiddenContentError(error)).toBe(false);
      });

      it('should handle empty rule', () => {
        const error = createMockPromptValidationError({
          validationRule: '',
        });
        expect(isPromptForbiddenContentError(error)).toBe(false);
      });
    });

    describe('isPromptFormatError', () => {
      it('should identify format errors', () => {
        const testCases = [
          'invalid_format',
          'format_error',
          'json_format_issue',
          'xml_format_problem',
        ];

        testCases.forEach((rule) => {
          const error = createMockPromptValidationError({ validationRule: rule });
          expect(isPromptFormatError(error)).toBe(true);
        });
      });

      it('should reject non-format errors', () => {
        const error = createMockPromptValidationError({
          validationRule: 'content_filter',
        });
        expect(isPromptFormatError(error)).toBe(false);
      });

      it('should handle exact matches', () => {
        const error = createMockPromptValidationError({
          validationRule: 'invalid_format',
        });
        expect(isPromptFormatError(error)).toBe(true);
      });
    });
  });

  describe('Integration tests', () => {
    it('should create and validate complete error flow', () => {
      // Create error
      const error = createPromptForbiddenContentError(
        ['inappropriate', 'content'],
        'forbidden_content',
        0.95,
      );

      // Check structure
      expect(error._tag).toBe('PromptValidationError');
      expect(error.category).toBe('SECURITY');
      expect(error.origin).toBe('DOMAIN');

      // Check context validation
      expect(error.details).toBeDefined();
      expect(isValidPromptValidationErrorContext(error.details!)).toBe(true);

      // Check type-specific validations
      expect(isPromptForbiddenContentError(error)).toBe(true);
      expect(isPromptLengthError(error)).toBe(false);
      expect(isPromptFormatError(error)).toBe(false);
    });

    it('should handle edge cases in error creation', () => {
      // Empty suggestions
      const error1 = createPromptTooLongError(100, 50, []);
      expect(error1.details?.suggestions).toEqual([]);

      // Very long preview
      const longPreview = 'a'.repeat(1000);
      const error2 = createPromptFormatError('text', longPreview);
      expect(error2.details?.promptLength).toBe(1000);

      // Zero confidence
      const error3 = createPromptForbiddenContentError(['test'], 'rule', 0);
      expect(error3.details?.confidence).toBe(0);

      // Maximum confidence
      const error4 = createPromptForbiddenContentError(['test'], 'rule', 1);
      expect(error4.details?.confidence).toBe(1);
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety across all operations', () => {
      const error: PromptValidationError = createPromptValidationError(
        'SERVICE_AI_009' as any,
        'Type test',
        'type_rule',
        42,
        {
          type: 'prompt_validation',
          maxAllowedLength: 100,
        },
      );

      // TypeScript should enforce these types
      const details: PromptValidationErrorContext | undefined = error.details;

      if (details) {
        expect(typeof details.type).toBe('string');
        expect(typeof details.validationRule).toBe('string');
        expect(typeof details.promptLength).toBe('number');
      }
    });
  });
});
