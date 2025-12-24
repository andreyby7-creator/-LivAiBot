import { describe, expect, it } from 'vitest';

import {
  createModelNotFoundError,
  createModelSelectionError,
  createModelTaskMismatchError,
  createModelUnavailableInRegionError,
  createTechnicalConstraintError,
  createUserTierLimitError,
  isModelNotFoundError,
  isRegionUnavailableError,
  isTaskIncompatibleError,
  isTechnicalConstraintError,
  isTierLimitError,
  isValidModelSelectionErrorContext,
} from '../../../../../../src/errors/services/ai-service/domain/index.js';
import type {
  ModelSelectionError,
  ModelSelectionErrorContext,
} from '../../../../../../src/errors/services/ai-service/domain/index.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock ModelSelectionErrorContext для тестов */
function createMockModelSelectionContext(
  overrides: Partial<ModelSelectionErrorContext> = {},
): ModelSelectionErrorContext {
  return {
    type: 'model_selection',
    selectionRule: 'test_rule',
    requestedModel: 'test-model-v1',
    availableModels: ['model-a', 'model-b', 'model-c'],
    taskType: 'text-generation',
    userTier: 'premium',
    region: 'eu-central-1',
    rejectionReason: 'Test rejection',
    fallbackSuggestions: ['fallback-model-1', 'fallback-model-2'],
    technicalConstraints: { gpu: 'required', memory: '8GB' },
    selectionTimeMs: 150,
    ...overrides,
  };
}

/** Создает mock ModelSelectionError для тестов */
function createMockModelSelectionError(
  contextOverrides: Partial<ModelSelectionErrorContext> = {},
): ModelSelectionError {
  return createModelSelectionError(
    'SERVICE_AI_MODEL_UNAVAILABLE' as any,
    'Test selection error',
    'test_rule',
    'test-model-v1',
    createMockModelSelectionContext(contextOverrides),
  );
}

// ==================== TESTS ====================

describe('ModelSelectionError Domain', () => {
  describe('createModelSelectionError', () => {
    it('should create ModelSelectionError with all fields', () => {
      const error = createModelSelectionError(
        'SERVICE_AI_MODEL_UNAVAILABLE' as any,
        'Model selection failed',
        'custom_rule',
        'requested-model-v2',
        {
          availableModels: ['alt-model-1', 'alt-model-2'],
          taskType: 'classification',
          userTier: 'enterprise',
          region: 'us-east-1',
          rejectionReason: 'Custom rejection reason',
          fallbackSuggestions: ['fallback-1', 'fallback-2', 'fallback-3'],
          technicalConstraints: { gpu: 'A100', memory: '16GB' },
          selectionTimeMs: 200,
        },
      );

      expect(error._tag).toBe('ModelSelectionError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('DOMAIN');
      expect(error.severity).toBe('medium');
      expect(error.code).toBe('SERVICE_AI_MODEL_UNAVAILABLE');
      expect(error.message).toBe('Model selection failed');
      expect(error.details).toEqual({
        type: 'model_selection',
        selectionRule: 'custom_rule',
        requestedModel: 'requested-model-v2',
        availableModels: ['alt-model-1', 'alt-model-2'],
        taskType: 'classification',
        userTier: 'enterprise',
        region: 'us-east-1',
        rejectionReason: 'Custom rejection reason',
        fallbackSuggestions: ['fallback-1', 'fallback-2', 'fallback-3'],
        technicalConstraints: { gpu: 'A100', memory: '16GB' },
        selectionTimeMs: 200,
      });
    });

    it('should create error with minimal context', () => {
      const error = createModelSelectionError(
        'SERVICE_AI_MODEL_UNAVAILABLE' as any,
        'Minimal error',
        'min_rule',
        'minimal-model',
      );

      expect(error.details).toEqual({
        type: 'model_selection',
        selectionRule: 'min_rule',
        requestedModel: 'minimal-model',
      });
    });

    it('should use current timestamp', () => {
      const before = new Date().toISOString();
      const error = createModelSelectionError(
        'SERVICE_AI_MODEL_UNAVAILABLE' as any,
        'Timestamp test',
        'time_rule',
        'time-model',
      );
      const after = new Date().toISOString();

      expect(error.timestamp).toBeDefined();
      expect(error.timestamp >= before).toBe(true);
      expect(error.timestamp <= after).toBe(true);
    });

    it('should accept custom timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createModelSelectionError(
        'SERVICE_AI_MODEL_UNAVAILABLE' as any,
        'Custom timestamp',
        'custom_time_rule',
        'custom-time-model',
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
    });
  });

  describe('createModelNotFoundError', () => {
    it('should create error for non-existent model', () => {
      const error = createModelNotFoundError(
        'non-existent-model',
        ['existing-model-1', 'existing-model-2'],
        'text-generation',
      );

      expect(error._tag).toBe('ModelSelectionError');
      expect(error.message).toBe("Модель 'non-existent-model' не найдена или недоступна");
      expect(error.details.selectionRule).toBe('model_not_found');
      expect(error.details.requestedModel).toBe('non-existent-model');
      expect(error.details.availableModels).toEqual(['existing-model-1', 'existing-model-2']);
      expect(error.details.taskType).toBe('text-generation');
      expect(error.details.fallbackSuggestions).toEqual(['existing-model-1', 'existing-model-2']);
    });

    it('should handle empty availableModels', () => {
      const error = createModelNotFoundError('unknown-model', []);

      expect(error.details.availableModels).toEqual([]);
      expect(error.details.fallbackSuggestions).toEqual([]);
    });

    it('should handle undefined taskType', () => {
      const error = createModelNotFoundError('model-without-task', ['fallback-1']);

      expect(error.details.taskType).toBeUndefined();
      expect(error.details.fallbackSuggestions).toEqual(['fallback-1']);
    });
  });

  describe('createModelUnavailableInRegionError', () => {
    it('should create error for region restrictions', () => {
      const error = createModelUnavailableInRegionError(
        'regional-model',
        'restricted-region',
        ['global-model-1', 'global-model-2'],
      );

      expect(error._tag).toBe('ModelSelectionError');
      expect(error.message).toBe(
        "Модель 'regional-model' недоступна в регионе 'restricted-region'",
      );
      expect(error.details.selectionRule).toBe('region_unavailable');
      expect(error.details.requestedModel).toBe('regional-model');
      expect(error.details.region).toBe('restricted-region');
      expect(error.details.availableModels).toEqual(['global-model-1', 'global-model-2']);
      expect(error.details.technicalConstraints).toEqual({ region: 'restricted-region' });
    });

    it('should filter regional models from suggestions', () => {
      const availableModels = ['global-model', 'regional-model-eu', 'another-global'];
      const error = createModelUnavailableInRegionError(
        'blocked-model',
        'us-west',
        availableModels,
      );

      expect(error.details.fallbackSuggestions).toEqual(['global-model', 'another-global']);
    });
  });

  describe('createModelTaskMismatchError', () => {
    it('should create error for task incompatibility', () => {
      const error = createModelTaskMismatchError(
        'text-only-model',
        'image-processing',
        ['multimodal-model', 'vision-model'],
      );

      expect(error._tag).toBe('ModelSelectionError');
      expect(error.message).toBe(
        "Модель 'text-only-model' не подходит для задачи 'image-processing'",
      );
      expect(error.details.selectionRule).toBe('task_incompatible');
      expect(error.details.requestedModel).toBe('text-only-model');
      expect(error.details.taskType).toBe('image-processing');
      expect(error.details.availableModels).toEqual(['multimodal-model', 'vision-model']);
      expect(error.details.fallbackSuggestions).toEqual(['multimodal-model', 'vision-model']);
    });
  });

  describe('createUserTierLimitError', () => {
    it('should create error for tier limitations', () => {
      const error = createUserTierLimitError(
        'enterprise-only-model',
        'free',
        ['free-model-1', 'free-model-2', 'lite-model'],
      );

      expect(error._tag).toBe('ModelSelectionError');
      expect(error.message).toBe("Модель 'enterprise-only-model' недоступна для уровня 'free'");
      expect(error.details.selectionRule).toBe('tier_limit_exceeded');
      expect(error.details.requestedModel).toBe('enterprise-only-model');
      expect(error.details.userTier).toBe('free');
      expect(error.details.availableModels).toEqual(['free-model-1', 'free-model-2', 'lite-model']);
      expect(error.details.fallbackSuggestions).toEqual(['lite-model']);
    });

    it('should suggest lite/basic models as fallback', () => {
      const availableModels = ['premium-model', 'lite-model', 'basic-model', 'enterprise-model'];
      const error = createUserTierLimitError('premium-required', 'free', availableModels);

      expect(error.details.fallbackSuggestions).toEqual(['lite-model', 'basic-model']);
    });
  });

  describe('createTechnicalConstraintError', () => {
    it('should create error for technical limitations', () => {
      const constraints = { gpu: 'H100', memory: '32GB', cuda: '12.0' };
      const error = createTechnicalConstraintError(
        'high-end-model',
        constraints,
        ['compatible-model-1', 'compatible-model-2'],
      );

      expect(error._tag).toBe('ModelSelectionError');
      expect(error.message).toBe(
        "Модель 'high-end-model' не соответствует техническим требованиям",
      );
      expect(error.details.selectionRule).toBe('technical_constraints');
      expect(error.details.requestedModel).toBe('high-end-model');
      expect(error.details.technicalConstraints).toEqual(constraints);
      expect(error.details.availableModels).toEqual(['compatible-model-1', 'compatible-model-2']);
      expect(error.details.fallbackSuggestions).toEqual([
        'compatible-model-1',
        'compatible-model-2',
      ]);
    });
  });

  describe('isValidModelSelectionErrorContext', () => {
    it('should validate correct context', () => {
      const context = createMockModelSelectionContext();
      expect(isValidModelSelectionErrorContext(context)).toBe(true);
    });

    it('should reject null/undefined', () => {
      expect(isValidModelSelectionErrorContext(null)).toBe(false);
      expect(isValidModelSelectionErrorContext(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isValidModelSelectionErrorContext('string')).toBe(false);
      expect(isValidModelSelectionErrorContext(123)).toBe(false);
      expect(isValidModelSelectionErrorContext([])).toBe(false);
    });

    it('should reject wrong type', () => {
      const context = { ...createMockModelSelectionContext(), type: 'wrong_type' };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject missing required fields', () => {
      const context = { type: 'model_selection' };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid selectionRule', () => {
      const context = {
        ...createMockModelSelectionContext(),
        selectionRule: null as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid availableModels type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        availableModels: 'not-array' as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid taskType type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        taskType: 123 as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid userTier type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        userTier: {} as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid region type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        region: true as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid requestedModel', () => {
      const context = {
        ...createMockModelSelectionContext(),
        requestedModel: 123 as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid rejectionReason type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        rejectionReason: [] as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid fallbackSuggestions type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        fallbackSuggestions: 'not-array' as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid technicalConstraints type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        technicalConstraints: 'not-object' as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should reject invalid selectionTimeMs type', () => {
      const context = {
        ...createMockModelSelectionContext(),
        selectionTimeMs: 'not-number' as any,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(false);
    });

    it('should accept context with only required fields', () => {
      const context: ModelSelectionErrorContext = {
        type: 'model_selection',
        selectionRule: 'test',
        requestedModel: 'test-model',
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(true);
    });

    it('should validate optional fields', () => {
      const context = {
        type: 'model_selection' as const,
        selectionRule: 'test',
        requestedModel: 'test-model',
        availableModels: ['model1'],
        taskType: 'generation',
        userTier: 'premium',
        region: 'eu',
        rejectionReason: 'test reason',
        fallbackSuggestions: ['fallback1'],
        technicalConstraints: { gpu: 'required' },
        selectionTimeMs: 100,
      };
      expect(isValidModelSelectionErrorContext(context)).toBe(true);
    });
  });

  describe('Error type checkers', () => {
    describe('isModelNotFoundError', () => {
      it('should identify model not found errors', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'model_not_found',
        });
        expect(isModelNotFoundError(error)).toBe(true);
      });

      it('should reject non-model-not-found errors', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'region_unavailable',
        });
        expect(isModelNotFoundError(error)).toBe(false);
      });

      it('should validate requestedModel type', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'model_not_found',
          requestedModel: 123 as any,
        });
        expect(isModelNotFoundError(error)).toBe(false);
      });
    });

    describe('isRegionUnavailableError', () => {
      it('should identify region unavailable errors', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'region_unavailable',
          region: 'blocked-region',
        });
        expect(isRegionUnavailableError(error)).toBe(true);
      });

      it('should reject errors without region', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'region_unavailable',
          region: undefined,
        });
        expect(isRegionUnavailableError(error)).toBe(false);
      });

      it('should validate region type', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'region_unavailable',
          region: 123 as any,
        });
        expect(isRegionUnavailableError(error)).toBe(false);
      });
    });

    describe('isTaskIncompatibleError', () => {
      it('should identify task incompatible errors', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'task_incompatible',
          taskType: 'image-processing',
        });
        expect(isTaskIncompatibleError(error)).toBe(true);
      });

      it('should reject errors without taskType', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'task_incompatible',
          taskType: undefined,
        });
        expect(isTaskIncompatibleError(error)).toBe(false);
      });
    });

    describe('isTierLimitError', () => {
      it('should identify tier limit errors', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'tier_limit_exceeded',
          userTier: 'free',
        });
        expect(isTierLimitError(error)).toBe(true);
      });

      it('should reject errors without userTier', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'tier_limit_exceeded',
          userTier: undefined,
        });
        expect(isTierLimitError(error)).toBe(false);
      });
    });

    describe('isTechnicalConstraintError', () => {
      it('should identify technical constraint errors', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'technical_constraints',
          technicalConstraints: { gpu: 'required' },
        });
        expect(isTechnicalConstraintError(error)).toBe(true);
      });

      it('should reject errors without technicalConstraints', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'technical_constraints',
          technicalConstraints: undefined,
        });
        expect(isTechnicalConstraintError(error)).toBe(false);
      });

      it('should reject null technicalConstraints', () => {
        const error = createMockModelSelectionError({
          selectionRule: 'technical_constraints',
          technicalConstraints: null as any,
        });
        expect(isTechnicalConstraintError(error)).toBe(false);
      });
    });
  });

  describe('Integration tests', () => {
    it('should create and validate complete error flow', () => {
      // Create error
      const error = createModelNotFoundError(
        'missing-model',
        ['available-model-1', 'available-model-2'],
        'text-generation',
      );

      // Check structure
      expect(error._tag).toBe('ModelSelectionError');
      expect(error.category).toBe('BUSINESS');
      expect(error.origin).toBe('DOMAIN');

      // Check context validation
      expect(error.details).toBeDefined();
      expect(isValidModelSelectionErrorContext(error.details)).toBe(true);

      // Check type-specific validations
      expect(isModelNotFoundError(error)).toBe(true);
      expect(isRegionUnavailableError(error)).toBe(false);
      expect(isTaskIncompatibleError(error)).toBe(false);
      expect(isTierLimitError(error)).toBe(false);
      expect(isTechnicalConstraintError(error)).toBe(false);
    });

    it('should handle edge cases in error creation', () => {
      // Empty arrays
      const error1 = createModelNotFoundError('test', []);
      expect(error1.details.availableModels).toEqual([]);
      expect(error1.details.fallbackSuggestions).toEqual([]);

      // Very long model names
      const longModelName = 'a'.repeat(100);
      const error2 = createModelNotFoundError(longModelName, ['short-model']);
      expect(error2.details.requestedModel).toBe(longModelName);

      // Complex constraints
      const complexConstraints = {
        gpu: 'A100',
        memory: '80GB',
        cuda: '12.2',
        network: '10Gbps',
      };
      const error3 = createTechnicalConstraintError('complex-model', complexConstraints);
      expect(error3.details.technicalConstraints).toEqual(complexConstraints);
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety across all operations', () => {
      const error: ModelSelectionError = createModelSelectionError(
        'SERVICE_AI_MODEL_UNAVAILABLE' as any,
        'Type test',
        'type_rule',
        'type-model',
        {
          availableModels: ['safe-model'],
          taskType: 'safe-task',
        },
      );

      // TypeScript should enforce these types
      const details: ModelSelectionErrorContext = error.details;

      expect(typeof details.type).toBe('string');
      expect(typeof details.selectionRule).toBe('string');
      expect(typeof details.requestedModel).toBe('string');
    });
  });
});
