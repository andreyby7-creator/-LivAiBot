import { describe, expect, it } from 'vitest';

import {
  selectFallbackModel,
  createModelFallbackPolicyError,
  isModelFallbackPolicyError,
  getModelFallbackPriority,
  canUseAsFallback,
} from '../../../../../../src/errors/services/ai-service/policies/index';
import type {
  ModelFallbackPolicyContext,
  ModelAlternative,
  ModelSelectionConstraints,
  UserContext,
  ModelFallbackPolicyResult,
} from '../../../../../../src/errors/services/ai-service/policies/index';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../../../../src/errors/base/ErrorConstants';

// ==================== MOCK DATA ====================

const mockModelAlternatives: ModelAlternative[] = [
  {
    modelId: 'yandexgpt-pro',
    priority: 'high',
    reason: 'similar_capabilities',
    taskCompatibility: 0.95,
    availableRegions: ['eu-central1', 'us-central1'],
  },
  {
    modelId: 'yandexgpt-lite',
    priority: 'medium',
    reason: 'downgrade',
    taskCompatibility: 0.85,
    availableRegions: ['eu-central1', 'us-central1', 'asia-southeast1'],
  },
  {
    modelId: 'yandexart',
    priority: 'low',
    reason: 'upgrade',
    taskCompatibility: 0.7,
    requiresGpu: true,
  },
];

const mockConstraints: ModelSelectionConstraints = {
  excludedModels: ['banned-model'],
  regionConstraints: ['eu-central1'],
  minQualityLevel: 'standard',
};

const mockUserContext: UserContext = {
  planTier: 'premium',
  region: 'eu-central1',
  availableModels: ['yandexgpt-pro', 'yandexgpt-lite', 'yandexart'],
  gpuAvailable: true,
};

// ==================== SELECT FALLBACK MODEL TESTS ====================

describe('selectFallbackModel', () => {
  describe('Original model available cases', () => {
    it('should return original model when available and no alternatives needed', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'model_not_found',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [],
        attemptNumber: 0,
        maxAttempts: 3,
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).toBe('yandexgpt-pro');
      expect(result.selectionReason).toBe('original_available');
      expect(result.appliedStrategy).toBeUndefined();
    });
  });

  describe('No alternatives available', () => {
    it('should return no_alternatives when no viable alternatives found', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'gpu_constraint',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [
          {
            modelId: 'yandexart',
            priority: 'low',
            reason: 'similar_capabilities',
            taskCompatibility: 0.8,
            requiresGpu: true,
          },
        ],
        attemptNumber: 0,
        maxAttempts: 3,
        constraints: { ...mockConstraints, regionConstraints: ['non-existent-region'] },
        userContext: { ...mockUserContext, gpuAvailable: false },
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).toBe('yandexgpt-pro'); // Returns original as fallback
      expect(result.selectionReason).toBe('no_alternatives');
      expect(result.appliedStrategy?.type).toBe('fail_fast');
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Successful fallback selection', () => {
    it('should select best alternative based on priority and compatibility', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'gpu_constraint',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: mockModelAlternatives,
        attemptNumber: 0,
        maxAttempts: 3,
        constraints: mockConstraints,
        userContext: mockUserContext,
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).toBe('yandexgpt-pro'); // Highest priority
      expect(result.selectionReason).toBe('fallback_success');
      expect(result.appliedStrategy?.alternativesTried).toEqual(['yandexgpt-pro']);
      expect(result.degradationWarnings).toBeDefined();
    });

    it('should generate degradation warnings for lower priority models', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'deprecated',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [
          {
            modelId: 'yandexgpt-lite',
            priority: 'medium', // Lower than high
            reason: 'downgrade',
            taskCompatibility: 0.8,
          },
        ],
        attemptNumber: 0,
        maxAttempts: 3,
        userContext: mockUserContext,
      };

      const result = selectFallbackModel(context);

      expect(result.degradationWarnings).toContain('Model quality degraded from high to medium priority');
    });

    it('should not generate degradation warnings for same or higher priority', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-lite',
        unavailableReason: 'deprecated',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [
          {
            modelId: 'yandexgpt-pro',
            priority: 'high', // Higher than medium
            reason: 'upgrade',
            taskCompatibility: 0.9,
          },
        ],
        attemptNumber: 0,
        maxAttempts: 3,
        userContext: mockUserContext,
      };

      const result = selectFallbackModel(context);

      expect(result.degradationWarnings).not.toContain('Model quality degraded');
    });

    it('should add upgrade recommendations for low priority models', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'deprecated',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [
          {
            modelId: 'yandexart',
            priority: 'low',
            reason: 'similar_capabilities',
            taskCompatibility: 0.6,
          },
        ],
        attemptNumber: 0,
        maxAttempts: 3,
        userContext: mockUserContext,
      };

      const result = selectFallbackModel(context);

      expect(result.recommendations).toContain('Consider upgrading your plan for better models');
    });

    it('should warn about GPU requirements', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'cpu-model',
        unavailableReason: 'model_not_found',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [
          {
            modelId: 'gpu-required-model',
            priority: 'high',
            reason: 'similar_capabilities',
            taskCompatibility: 0.9,
            requiresGpu: true,
          },
        ],
        attemptNumber: 0,
        maxAttempts: 3,
        userContext: { ...mockUserContext, gpuAvailable: true, availableModels: ['gpu-required-model'] }, // User has GPU and access to GPU model
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).toBe('gpu-required-model');
      expect(result.degradationWarnings).toContain('Selected model requires GPU acceleration');
    });

    it('should warn about low task compatibility', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'specialized-model',
        unavailableReason: 'model_not_found',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [
          {
            modelId: 'general-model',
            priority: 'high',
            reason: 'similar_capabilities',
            taskCompatibility: 0.3, // Low compatibility
          },
        ],
        attemptNumber: 0,
        maxAttempts: 3,
        userContext: { ...mockUserContext, availableModels: ['general-model'] },
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).toBe('general-model');
      expect(result.degradationWarnings).toContain('Selected model has 30% compatibility with your task');
    });
  });

  describe('Constraint filtering', () => {
    it('should exclude models based on excludedModels constraint', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'gpu_constraint',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: [
          ...mockModelAlternatives,
          {
            modelId: 'banned-model',
            priority: 'high',
            reason: 'similar_capabilities',
            taskCompatibility: 0.9,
          },
        ],
        attemptNumber: 0,
        maxAttempts: 3,
        constraints: mockConstraints,
        userContext: mockUserContext,
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).not.toBe('banned-model');
    });

    it('should filter by user plan availability', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'gpu_constraint',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: mockModelAlternatives,
        attemptNumber: 0,
        maxAttempts: 3,
        userContext: { ...mockUserContext, availableModels: ['yandexgpt-lite'] },
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).toBe('yandexgpt-lite');
    });

    it('should filter by GPU requirements', () => {
      const context: ModelFallbackPolicyContext = {
        type: 'model_fallback_policy',
        requestedModel: 'yandexgpt-pro',
        unavailableReason: 'gpu_constraint',
        recoveryStrategy: 'fallback_model',
        availableAlternatives: mockModelAlternatives,
        attemptNumber: 0,
        maxAttempts: 3,
        userContext: { ...mockUserContext, gpuAvailable: false },
      };

      const result = selectFallbackModel(context);

      expect(result.selectedModel).toBe('yandexgpt-pro'); // Highest priority non-GPU model
      expect(result.degradationWarnings).toBeDefined();
    });
  });
});

// ==================== CREATE MODEL FALLBACK POLICY ERROR TESTS ====================

describe('createModelFallbackPolicyError', () => {
  it('should create valid ModelFallbackPolicyError', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'yandexgpt-pro',
      unavailableReason: 'gpu_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result: ModelFallbackPolicyResult = {
      selectedModel: 'yandexgpt-lite',
      selectionReason: 'fallback_success',
    };

    const error = createModelFallbackPolicyError(
      'POLICY_FALLBACK_FAILED' as any,
      context,
      result,
      'Fallback policy execution failed',
    );

    expect(error._tag).toBe('ModelFallbackPolicyError');
    expect(error.type).toBe('model_fallback_policy_error');
    expect(error.category).toBe(ERROR_CATEGORY.BUSINESS);
    expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
    expect(error.origin).toBe(ERROR_ORIGIN.SERVICE);
    expect(error.message).toBe('Fallback policy execution failed');
    expect(error.context).toBe(context);
    expect(error.result).toBe(result);
    expect(error.timestamp).toBeDefined();
  });
});

// ==================== IS MODEL FALLBACK POLICY ERROR TESTS ====================

describe('isModelFallbackPolicyError', () => {
  it('should return true for valid ModelFallbackPolicyError', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'yandexgpt-pro',
      unavailableReason: 'gpu_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result: ModelFallbackPolicyResult = {
      selectedModel: 'yandexgpt-lite',
      selectionReason: 'fallback_success',
    };

    const error = createModelFallbackPolicyError(
      'POLICY_FALLBACK_FAILED' as any,
      context,
      result,
      'Test error',
    );

    expect(isModelFallbackPolicyError(error)).toBe(true);
  });

  it('should return false for non-matching objects', () => {
    expect(isModelFallbackPolicyError(null)).toBe(false);
    expect(isModelFallbackPolicyError({})).toBe(false);
    expect(isModelFallbackPolicyError({ _tag: 'OtherError' })).toBe(false);
    expect(isModelFallbackPolicyError({ _tag: 'ModelFallbackPolicyError', type: 'other' })).toBe(false);
  });
});

// ==================== GET MODEL FALLBACK PRIORITY TESTS ====================

describe('getModelFallbackPriority', () => {
  it('should return correct priority for known models', () => {
    expect(getModelFallbackPriority('yandexgpt-pro')).toBe('high');
    expect(getModelFallbackPriority('yandexgpt-lite')).toBe('medium');
    expect(getModelFallbackPriority('yandexart')).toBe('low');
  });

  it('should return medium priority for unknown models', () => {
    expect(getModelFallbackPriority('unknown-model')).toBe('medium');
    expect(getModelFallbackPriority('')).toBe('medium');
  });
});

// ==================== CAN USE AS FALLBACK TESTS ====================

describe('canUseAsFallback', () => {
  const alternative: ModelAlternative = {
    modelId: 'yandexgpt-lite',
    priority: 'medium',
    reason: 'downgrade',
    taskCompatibility: 0.8,
    availableRegions: ['eu-central1', 'us-central1'],
  };

  it('should return true for viable alternative', () => {
    const result = canUseAsFallback(alternative, mockConstraints, mockUserContext);
    expect(result).toBe(true);
  });

  it('should return false for excluded model', () => {
    const constraints: ModelSelectionConstraints = {
      excludedModels: ['yandexgpt-lite'],
    };
    const result = canUseAsFallback(alternative, constraints, mockUserContext);
    expect(result).toBe(false);
  });

  it('should return false for unavailable user model', () => {
    const userContext: UserContext = {
      availableModels: ['other-model'],
    };
    const result = canUseAsFallback(alternative, mockConstraints, userContext);
    expect(result).toBe(false);
  });

  it('should return false for region restricted model', () => {
    const constraints: ModelSelectionConstraints = {
      regionConstraints: ['asia-pacific'],
    };
    const userContext: UserContext = {
      region: 'asia-pacific',
    };
    const result = canUseAsFallback(alternative, constraints, userContext);
    expect(result).toBe(false);
  });

  it('should return false for GPU required model without GPU', () => {
    const gpuAlternative: ModelAlternative = {
      ...alternative,
      requiresGpu: true,
    };
    const userContext: UserContext = {
      gpuAvailable: false,
    };
    const result = canUseAsFallback(gpuAlternative, mockConstraints, userContext);
    expect(result).toBe(false);
  });
});

// ==================== INTEGRATION TESTS ====================

describe('Integration scenarios', () => {
  it('should handle complex fallback scenario with multiple constraints', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'premium-model',
      unavailableReason: 'gpu_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [
        {
          modelId: 'gpu-model',
          priority: 'high',
          reason: 'similar_capabilities',
          taskCompatibility: 0.95,
          requiresGpu: true,
        },
        {
          modelId: 'cpu-model',
          priority: 'medium',
          reason: 'downgrade',
          taskCompatibility: 0.85,
        },
        {
          modelId: 'regional-model',
          priority: 'low',
          reason: 'regional',
          taskCompatibility: 0.75,
          availableRegions: ['asia-pacific'],
        },
      ],
      attemptNumber: 1,
      maxAttempts: 3,
      constraints: {
        regionConstraints: ['eu-central1'],
        minQualityLevel: 'standard',
      },
      userContext: {
        planTier: 'premium',
        region: 'eu-central1',
        gpuAvailable: false,
      },
    };

    const result = selectFallbackModel(context);

    expect(result.selectedModel).toBe('cpu-model'); // Best non-GPU option
    expect(result.selectionReason).toBe('fallback_success');
    expect(result.degradationWarnings).toBeDefined();
  });

  it('should provide appropriate recommendations based on failure reason', () => {
    const gpuConstraintContext: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'gpu-required-model',
      unavailableReason: 'gpu_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(gpuConstraintContext);

    expect(result.recommendations).toContain('Consider upgrading to a plan with GPU support');
    expect(result.recommendations).toContain('Try using lighter models for your task');
  });

  it('should provide region restriction recommendations', () => {
    const regionContext: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'regional-model',
      unavailableReason: 'region_restricted',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(regionContext);

    expect(result.recommendations).toContain('Model may be available in other regions');
    expect(result.recommendations).toContain('Contact support for regional access');
  });

  it('should provide memory constraint recommendations', () => {
    const memoryContext: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'memory-heavy-model',
      unavailableReason: 'memory_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(memoryContext);

    expect(result.recommendations).toContain('Try again later or contact support if the issue persists');
  });

  it('should provide model not found recommendations', () => {
    const notFoundContext: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'non-existent-model',
      unavailableReason: 'model_not_found',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(notFoundContext);

    expect(result.selectionReason).toBe('original_available');
    expect(result.recommendations).toBeUndefined(); // No recommendations for original_available
  });

  it('should provide deprecated model recommendations', () => {
    const deprecatedContext: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'old-model',
      unavailableReason: 'deprecated',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(deprecatedContext);

    expect(result.recommendations).toContain('The requested model is deprecated, consider migrating to newer models');
  });

  it('should provide maintenance mode recommendations', () => {
    const maintenanceContext: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'maintenance-model',
      unavailableReason: 'maintenance',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(maintenanceContext);

    expect(result.recommendations).toContain('Try again later or contact support if the issue persists');
  });

  it('should provide max attempts exceeded recommendations', () => {
    const maxAttemptsContext: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'failing-model',
      unavailableReason: 'temporarily_unavailable',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 3,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(maxAttemptsContext);

    expect(result.recommendations).toContain('Maximum fallback attempts reached, operation failed');
    expect(result.recommendations).toContain('Try again later or contact support if the issue persists');
  });

  it('should provide default recommendations for unknown failure reasons', () => {
    // Test the default case in generateRecommendations
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'unknown-failure-model',
      unavailableReason: 'memory_constraint', // This should hit default case
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(context);

    expect(result.recommendations).toContain('Try again later or contact support if the issue persists');
  });

  it('should add max attempts warning when attempt limit exceeded', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'max-attempts-model',
      unavailableReason: 'gpu_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [],
      attemptNumber: 3, // Equal to MAX_FALLBACK_ATTEMPTS
      maxAttempts: 3,
    };

    const result = selectFallbackModel(context);

    expect(result.recommendations).toContain('Maximum fallback attempts reached, operation failed');
    expect(result.recommendations).toContain('Consider upgrading to a plan with GPU support');
  });

  it('should filter by region restrictions in isViableAlternative', () => {
    const alternative: ModelAlternative = {
      modelId: 'regional-model',
      priority: 'high',
      reason: 'similar_capabilities',
      taskCompatibility: 0.9,
      availableRegions: ['us-central1', 'asia-southeast1'], // Does not include eu-central1
    };

    const constraints: ModelSelectionConstraints = {
      regionConstraints: ['eu-central1'],
    };

    const userContext: UserContext = {
      region: 'eu-central1',
    };

    const result = canUseAsFallback(alternative, constraints, userContext);

    expect(result).toBe(false);
  });

  it('should filter by plan restrictions in isViableAlternative', () => {
    const alternative: ModelAlternative = {
      modelId: 'premium-model',
      priority: 'high',
      reason: 'similar_capabilities',
      taskCompatibility: 0.9,
      planRestrictions: ['free', 'basic'], // Restricted for free and basic
    };

    const userContext: UserContext = {
      planTier: 'free',
    };

    const result = canUseAsFallback(alternative, undefined, userContext);

    expect(result).toBe(false);
  });

  it('should allow models without restrictions', () => {
    const alternative: ModelAlternative = {
      modelId: 'unrestricted-model',
      priority: 'medium',
      reason: 'similar_capabilities',
      taskCompatibility: 0.8,
      // No restrictions
    };

    const userContext: UserContext = {
      planTier: 'free',
      region: 'eu-central1',
      gpuAvailable: false,
    };

    const result = canUseAsFallback(alternative, undefined, userContext);

    expect(result).toBe(true);
  });
});

// ==================== EDGE CASES ====================

describe('Edge cases', () => {
  it('should handle empty alternatives array', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'any-model',
      unavailableReason: 'model_not_found',
      recoveryStrategy: 'wait_retry',
      availableAlternatives: [],
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(context);

    expect(result.selectedModel).toBe('any-model');
    expect(result.selectionReason).toBe('original_available');
  });

  it('should handle undefined constraints and user context', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'test-model',
      unavailableReason: 'model_not_found',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.selectedModel).toBeDefined();
  });

  it('should prioritize models by task compatibility when priorities are equal', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'low-compat-model',
      unavailableReason: 'model_not_found',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [
        {
          modelId: 'low-compat-model-alt',
          priority: 'medium',
          reason: 'similar_capabilities',
          taskCompatibility: 0.4, // Much lower compatibility
        },
        {
          modelId: 'high-compat-model',
          priority: 'medium', // Same priority
          reason: 'similar_capabilities',
          taskCompatibility: 0.8, // Much higher compatibility, diff > 0.1
        },
      ],
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: { availableModels: ['low-compat-model-alt', 'high-compat-model'] },
    };

    const result = selectFallbackModel(context);

    expect(result.selectedModel).toBe('high-compat-model'); // Should select higher compatibility
  });

  it('should handle region constraint fallback strategy', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'regional-model',
      unavailableReason: 'region_restricted',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: mockUserContext,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.appliedStrategy?.type).toBe('fallback_model');
  });

  it('should handle temporarily unavailable fallback strategy', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'temp-unavailable-model',
      unavailableReason: 'temporarily_unavailable',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: mockUserContext,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.appliedStrategy?.type).toBe('fallback_model');
  });

  it('should handle memory constraint fallback strategy', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'memory-heavy-model',
      unavailableReason: 'memory_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: mockUserContext,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.appliedStrategy?.type).toBe('fallback_model');
  });

  it('should handle maintenance mode fallback strategy', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'maintenance-model',
      unavailableReason: 'maintenance',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: mockUserContext,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.appliedStrategy?.type).toBe('fallback_model');
  });

  it('should handle model not found fallback strategy', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'not-found-model',
      unavailableReason: 'model_not_found',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: mockUserContext,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.appliedStrategy?.type).toBe('fallback_model');
  });

  it('should handle deprecated model fallback strategy', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'deprecated-model',
      unavailableReason: 'deprecated',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: mockUserContext,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.appliedStrategy?.type).toBe('fallback_model');
  });

  it('should prioritize by reason scores in GPU constraint scenarios', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'gpu-model',
      unavailableReason: 'gpu_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [
        {
          modelId: 'regional-fallback',
          priority: 'medium',
          reason: 'regional', // Lower priority reason (1)
          taskCompatibility: 0.8,
        },
        {
          modelId: 'downgrade-fallback',
          priority: 'medium',
          reason: 'downgrade', // Higher priority reason (3)
          taskCompatibility: 0.8,
        },
      ],
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: { availableModels: ['regional-fallback', 'downgrade-fallback'] },
    };

    const result = selectFallbackModel(context);

    expect(result.selectedModel).toBe('downgrade-fallback'); // Should select higher reason priority
  });

  it('should prioritize by reason scores in region restriction scenarios', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'regional-model',
      unavailableReason: 'region_restricted',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [
        {
          modelId: 'upgrade-fallback',
          priority: 'medium',
          reason: 'upgrade', // Lower priority reason (1)
          taskCompatibility: 0.8,
        },
        {
          modelId: 'regional-fallback',
          priority: 'medium',
          reason: 'regional', // Higher priority reason (3)
          taskCompatibility: 0.8,
        },
      ],
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: { availableModels: ['upgrade-fallback', 'regional-fallback'] },
    };

    const result = selectFallbackModel(context);

    expect(result.selectedModel).toBe('regional-fallback'); // Should select higher reason priority
  });

  it('should use default reason priority for memory constraint', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'memory-model',
      unavailableReason: 'memory_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [
        {
          modelId: 'similar-fallback',
          priority: 'medium',
          reason: 'similar_capabilities', // Should get priority 3 from default case
          taskCompatibility: 0.8,
        },
        {
          modelId: 'upgrade-fallback',
          priority: 'medium',
          reason: 'upgrade', // Should get priority 2 from default case
          taskCompatibility: 0.8,
        },
      ],
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: { availableModels: ['similar-fallback', 'upgrade-fallback'] },
    };

    const result = selectFallbackModel(context);

    expect(result.selectedModel).toBe('similar-fallback'); // Should select higher reason priority from default case
  });

  it('should filter by plan restrictions', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'plan-restricted-model',
      unavailableReason: 'model_not_found',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: [
        {
          modelId: 'premium-only-model',
          priority: 'high',
          reason: 'similar_capabilities',
          taskCompatibility: 0.9,
          planRestrictions: ['free', 'basic'], // Restricted for free and basic plans
        },
        {
          modelId: 'available-model',
          priority: 'medium',
          reason: 'similar_capabilities',
          taskCompatibility: 0.8,
        },
      ],
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: {
        planTier: 'free', // User is on free plan
        availableModels: ['premium-only-model', 'available-model']
      },
    };

    const result = selectFallbackModel(context);

    expect(result.selectedModel).toBe('available-model'); // Should filter out premium-only-model
  });

  it('should handle memory constraint fallback strategy', () => {
    const context: ModelFallbackPolicyContext = {
      type: 'model_fallback_policy',
      requestedModel: 'memory-heavy-model',
      unavailableReason: 'memory_constraint',
      recoveryStrategy: 'fallback_model',
      availableAlternatives: mockModelAlternatives,
      attemptNumber: 0,
      maxAttempts: 3,
      userContext: mockUserContext,
    };

    const result = selectFallbackModel(context);

    expect(result.selectionReason).toBe('fallback_success');
    expect(result.appliedStrategy?.type).toBe('fallback_model');
  });
});
