import { describe, expect, it } from 'vitest';

import {
  createModelDeprecatedError,
  createModelGpuConstraintError,
  createModelMaintenanceError,
  createModelMemoryConstraintError,
  createModelNotFoundInfraError,
  createModelRegionRestrictedError,
  createModelTemporarilyUnavailableError,
  createModelUnavailableError,
  getAvailableModelAlternatives,
  getAvailableRegions,
  getModelRecoveryStrategy,
  getModelRetryDelay,
  getRecommendedFallbackModel,
  hasHighPriorityFallback,
  hasRegionalAlternatives,
  isModelRetryable,
} from '../../../../../../src/errors/services/ai-service/infrastructure/index.js';
import type {
  ModelFallbackPriority,
  ModelRecoveryStrategy,
  ModelUnavailableError,
  ModelUnavailableErrorContext,
  ModelUnavailableReason,
} from '../../../../../../src/errors/services/ai-service/infrastructure/index.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../../../../src/errors/base/ErrorConstants.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock ModelUnavailableErrorContext для тестов */
function createMockModelUnavailableContext(
  overrides: Partial<ModelUnavailableErrorContext> = {},
): ModelUnavailableErrorContext {
  return {
    type: 'yandex_ai_model_unavailable',
    vendor: 'yandex_cloud',
    unavailableReason: 'model_not_found',
    recoveryStrategy: 'fallback_model',
    requestedModel: 'gpt-4',
    modelFamily: 'gpt-like',
    availableAlternatives: ['gpt-3.5-turbo', 'claude-3-haiku'],
    fallbackPriority: 'high',
    requestedRegion: 'eu-central1',
    availableRegions: ['us-central1', 'asia-southeast1'],
    requiredGpuType: 'A100',
    availableGpuTypes: ['V100', 'T4'],
    requiredMemoryGb: 16,
    availableMemoryGb: 8,
    estimatedRecoveryTimeMs: 300000,
    endpoint: 'https://llm.api.cloud.yandex.net/v1/completions',
    requestId: 'req-12345',
    ...overrides,
  };
}

/** Создает mock ModelUnavailableError для тестов */
function createMockModelUnavailableError(
  contextOverrides: Partial<ModelUnavailableErrorContext> = {},
  messageOverrides: Partial<{ code: string; message: string; timestamp: string }> = {},
): ModelUnavailableError {
  return createModelUnavailableError(
    (messageOverrides.code ?? 'INFRA_AI_MODEL_NOT_FOUND') as any,
    messageOverrides.message ?? 'Test model unavailable error',
    createMockModelUnavailableContext(contextOverrides),
    messageOverrides.timestamp,
  );
}

// ==================== TESTS ====================

describe('ModelUnavailableError', () => {
  describe('Константы и типы', () => {
    it('должен корректно определять ModelUnavailableReason типы', () => {
      const validReasons: ModelUnavailableReason[] = [
        'model_not_found',
        'temporarily_unavailable',
        'region_restricted',
        'gpu_constraint',
        'memory_constraint',
        'deprecated',
        'maintenance',
      ];

      expect(validReasons).toHaveLength(7);
      validReasons.forEach(reason => {
        expect(typeof reason).toBe('string');
      });
    });

    it('должен корректно определять ModelRecoveryStrategy типы', () => {
      const validStrategies: ModelRecoveryStrategy[] = [
        'fallback_model',
        'region_switch',
        'wait_retry',
        'upgrade_plan',
        'fail_fast',
      ];

      expect(validStrategies).toHaveLength(5);
      validStrategies.forEach(strategy => {
        expect(typeof strategy).toBe('string');
      });
    });

    it('должен корректно определять ModelFallbackPriority типы', () => {
      const validPriorities: ModelFallbackPriority[] = [
        'high',
        'medium',
        'low',
      ];

      expect(validPriorities).toHaveLength(3);
      validPriorities.forEach(priority => {
        expect(typeof priority).toBe('string');
      });
    });

    it('должен корректно определять ModelUnavailableErrorContext интерфейс', () => {
      const context = createMockModelUnavailableContext();

      expect(context.type).toBe('yandex_ai_model_unavailable');
      expect(context.vendor).toBe('yandex_cloud');
      expect(context.unavailableReason).toBe('model_not_found');
      expect(context.recoveryStrategy).toBe('fallback_model');
      expect(context.requestedModel).toBe('gpt-4');
      expect(context.modelFamily).toBe('gpt-like');
      expect(context.availableAlternatives).toEqual(['gpt-3.5-turbo', 'claude-3-haiku']);
      expect(context.fallbackPriority).toBe('high');
      expect(context.requestedRegion).toBe('eu-central1');
      expect(context.availableRegions).toEqual(['us-central1', 'asia-southeast1']);
      expect(context.requiredGpuType).toBe('A100');
      expect(context.availableGpuTypes).toEqual(['V100', 'T4']);
      expect(context.requiredMemoryGb).toBe(16);
      expect(context.availableMemoryGb).toBe(8);
      expect(context.estimatedRecoveryTimeMs).toBe(300000);
      expect(context.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(context.requestId).toBe('req-12345');
    });
  });

  describe('createModelUnavailableError', () => {
    it('должен создавать базовую ошибку с минимальными параметрами', () => {
      const error = createModelUnavailableError(
        'INFRA_AI_MODEL_NOT_FOUND' as any,
        'Model not found',
        {
          unavailableReason: 'model_not_found',
          recoveryStrategy: 'fallback_model',
          requestedModel: 'gpt-4',
        },
      );

      expect(error._tag).toBe('ModelUnavailableError');
      expect(error.category).toBe(ERROR_CATEGORY.BUSINESS);
      expect(error.origin).toBe(ERROR_ORIGIN.INFRASTRUCTURE);
      expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
      expect(error.code).toBe('INFRA_AI_MODEL_NOT_FOUND');
      expect(error.message).toBe('Model not found');
      expect(error.details.type).toBe('yandex_ai_model_unavailable');
      expect(error.details.vendor).toBe('yandex_cloud');
      expect(error.details.unavailableReason).toBe('model_not_found');
      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(typeof error.timestamp).toBe('string');
    });

    it('должен создавать ошибку с полным контекстом', () => {
      const context = createMockModelUnavailableContext();
      const error = createModelUnavailableError(
        'INFRA_AI_MODEL_NOT_FOUND' as any,
        'Full context error',
        context,
      );

      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.availableAlternatives).toEqual(['gpt-3.5-turbo', 'claude-3-haiku']);
      expect(error.details.fallbackPriority).toBe('high');
      expect(error.details.requestedRegion).toBe('eu-central1');
      expect(error.details.availableRegions).toEqual(['us-central1', 'asia-southeast1']);
      expect(error.details.requiredGpuType).toBe('A100');
      expect(error.details.availableGpuTypes).toEqual(['V100', 'T4']);
      expect(error.details.requiredMemoryGb).toBe(16);
      expect(error.details.availableMemoryGb).toBe(8);
      expect(error.details.estimatedRecoveryTimeMs).toBe(300000);
      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(error.details.requestId).toBe('req-12345');
    });

    it('должен использовать переданный timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createModelUnavailableError(
        'TEST_CODE' as any,
        'Test',
        {
          unavailableReason: 'model_not_found',
          recoveryStrategy: 'fallback_model',
          requestedModel: 'gpt-4',
        },
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
    });

    it('должен генерировать timestamp автоматически если не передан', () => {
      const before = new Date();
      const error = createModelUnavailableError(
        'TEST_CODE' as any,
        'Test',
        {
          unavailableReason: 'model_not_found',
          recoveryStrategy: 'fallback_model',
          requestedModel: 'gpt-4',
        },
      );
      const after = new Date();

      const errorTime = new Date(error.timestamp);
      expect(errorTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(errorTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('createModelNotFoundInfraError', () => {
    it('должен создавать ошибку model not found', () => {
      const error = createModelNotFoundInfraError('gpt-4');

      expect(error.code).toBe('INFRA_AI_MODEL_NOT_FOUND');
      expect(error.message).toBe('Модель "gpt-4" не найдена');
      expect(error.details.unavailableReason).toBe('model_not_found');
      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(error.details.fallbackPriority).toBe('high');
    });

    it('должен создавать ошибку с альтернативами и modelFamily', () => {
      const error = createModelNotFoundInfraError(
        'gpt-4',
        ['gpt-3.5-turbo', 'claude-3-haiku'],
        'gpt-like',
        'endpoint',
        'req-123',
      );

      expect(error.details.availableAlternatives).toEqual(['gpt-3.5-turbo', 'claude-3-haiku']);
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.requestId).toBe('req-123');
    });

    it('должен создавать ошибку без опциональных параметров', () => {
      const error = createModelNotFoundInfraError('gpt-4', undefined, undefined, undefined, undefined);

      expect(error.details.availableAlternatives).toBeUndefined();
      expect(error.details.modelFamily).toBeUndefined();
      expect(error.details.endpoint).toBeUndefined();
      expect(error.details.requestId).toBeUndefined();
    });
  });

  describe('createModelTemporarilyUnavailableError', () => {
    it('должен создавать ошибку temporarily unavailable', () => {
      const error = createModelTemporarilyUnavailableError('gpt-4');

      expect(error.code).toBe('INFRA_AI_MODEL_TEMPORARILY_UNAVAILABLE');
      expect(error.message).toBe('Модель "gpt-4" временно недоступна');
      expect(error.details.unavailableReason).toBe('temporarily_unavailable');
      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(error.details.fallbackPriority).toBe('medium');
    });

    it('должен выбирать wait_retry стратегию для короткого времени восстановления', () => {
      const error = createModelTemporarilyUnavailableError('gpt-4', 120000); // 2 минуты

      expect(error.details.recoveryStrategy).toBe('wait_retry');
      expect(error.details.estimatedRecoveryTimeMs).toBe(120000);
    });

    it('должен выбирать fallback_model стратегию для длинного времени восстановления', () => {
      const error = createModelTemporarilyUnavailableError('gpt-4', 4000000); // 66 минут

      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.estimatedRecoveryTimeMs).toBe(4000000);
    });

    it('должен создавать ошибку с полными параметрами', () => {
      const error = createModelTemporarilyUnavailableError(
        'gpt-4',
        300000,
        ['gpt-3.5-turbo'],
        'gpt-like',
        'endpoint',
        'req-123',
        new Error('Service unavailable'),
      );

      expect(error.details.availableAlternatives).toEqual(['gpt-3.5-turbo']);
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.requestId).toBe('req-123');
      expect(error.details.estimatedRecoveryTimeMs).toBe(300000);
      expect(error.details.originalError).toBeInstanceOf(Error);
    });
  });

  describe('createModelRegionRestrictedError', () => {
    it('должен создавать ошибку region restricted', () => {
      const error = createModelRegionRestrictedError('gpt-4', 'us-central1');

      expect(error.code).toBe('INFRA_AI_MODEL_REGION_RESTRICTED');
      expect(error.message).toBe('Модель "gpt-4" недоступна в регионе "us-central1"');
      expect(error.details.unavailableReason).toBe('region_restricted');
      expect(error.details.recoveryStrategy).toBe('region_switch');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(error.details.requestedRegion).toBe('us-central1');
      expect(error.details.fallbackPriority).toBe('medium');
    });

    it('должен создавать ошибку с регионами и альтернативами', () => {
      const error = createModelRegionRestrictedError(
        'gpt-4',
        'us-central1',
        ['eu-central1', 'asia-southeast1'],
        ['gpt-3.5-turbo'],
        'gpt-like',
        'endpoint',
        'req-123',
      );

      expect(error.details.availableRegions).toEqual(['eu-central1', 'asia-southeast1']);
      expect(error.details.availableAlternatives).toEqual(['gpt-3.5-turbo']);
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.requestId).toBe('req-123');
    });
  });

  describe('createModelGpuConstraintError', () => {
    it('должен создавать ошибку GPU constraint', () => {
      const error = createModelGpuConstraintError('gpt-4');

      expect(error.code).toBe('INFRA_AI_MODEL_GPU_CONSTRAINT');
      expect(error.message).toBe('Недостаточно GPU ресурсов для модели "gpt-4"');
      expect(error.details.unavailableReason).toBe('gpu_constraint');
      expect(error.details.recoveryStrategy).toBe('upgrade_plan');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(error.details.fallbackPriority).toBe('low');
    });

    it('должен создавать ошибку с GPU параметрами', () => {
      const error = createModelGpuConstraintError(
        'gpt-4',
        'A100',
        ['V100', 'T4'],
        ['gpt-3.5-turbo'],
        'gpt-like',
        'endpoint',
        'req-123',
      );

      expect(error.details.requiredGpuType).toBe('A100');
      expect(error.details.availableGpuTypes).toEqual(['V100', 'T4']);
      expect(error.details.availableAlternatives).toEqual(['gpt-3.5-turbo']);
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.requestId).toBe('req-123');
    });
  });

  describe('createModelMemoryConstraintError', () => {
    it('должен создавать ошибку memory constraint', () => {
      const error = createModelMemoryConstraintError('gpt-4');

      expect(error.code).toBe('INFRA_AI_MODEL_MEMORY_CONSTRAINT');
      expect(error.message).toBe('Недостаточно памяти для модели "gpt-4" (unknown GB требуется, unknown GB доступно)');
      expect(error.details.unavailableReason).toBe('memory_constraint');
      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(error.details.fallbackPriority).toBe('medium');
    });

    it('должен создавать ошибку с memory параметрами', () => {
      const error = createModelMemoryConstraintError(
        'gpt-4',
        16,
        8,
        ['gpt-3.5-turbo'],
        'gpt-like',
        'endpoint',
        'req-123',
      );

      expect(error.details.requiredMemoryGb).toBe(16);
      expect(error.details.availableMemoryGb).toBe(8);
      expect(error.details.availableAlternatives).toEqual(['gpt-3.5-turbo']);
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.requestId).toBe('req-123');
    });

    it('должен правильно форматировать сообщение с памятью', () => {
      const error = createModelMemoryConstraintError('gpt-4', 32, 16);

      expect(error.message).toBe('Недостаточно памяти для модели "gpt-4" (32 GB требуется, 16 GB доступно)');
    });
  });

  describe('createModelDeprecatedError', () => {
    it('должен создавать ошибку deprecated', () => {
      const error = createModelDeprecatedError('gpt-3');

      expect(error.code).toBe('INFRA_AI_MODEL_DEPRECATED');
      expect(error.message).toBe('Модель "gpt-3" устарела и больше не поддерживается');
      expect(error.details.unavailableReason).toBe('deprecated');
      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.requestedModel).toBe('gpt-3');
      expect(error.details.fallbackPriority).toBe('high');
    });

    it('должен создавать ошибку с альтернативами и modelFamily', () => {
      const error = createModelDeprecatedError(
        'gpt-3',
        ['gpt-4', 'gpt-3.5-turbo'],
        'gpt-like',
        'endpoint',
        'req-123',
      );

      expect(error.details.availableAlternatives).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.requestId).toBe('req-123');
    });
  });

  describe('createModelMaintenanceError', () => {
    it('должен создавать ошибку maintenance', () => {
      const error = createModelMaintenanceError('gpt-4');

      expect(error.code).toBe('INFRA_AI_MODEL_MAINTENANCE');
      expect(error.message).toBe('Модель "gpt-4" находится на техническом обслуживании');
      expect(error.details.unavailableReason).toBe('maintenance');
      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(error.details.fallbackPriority).toBe('medium');
    });

    it('должен выбирать wait_retry стратегию для короткого обслуживания', () => {
      const error = createModelMaintenanceError('gpt-4', 1800000); // 30 минут

      expect(error.details.recoveryStrategy).toBe('wait_retry');
      expect(error.details.estimatedRecoveryTimeMs).toBe(1800000);
    });

    it('должен выбирать fallback_model стратегию для долгого обслуживания', () => {
      const error = createModelMaintenanceError('gpt-4', 7200000); // 2 часа

      expect(error.details.recoveryStrategy).toBe('fallback_model');
      expect(error.details.estimatedRecoveryTimeMs).toBe(7200000);
    });

    it('должен создавать ошибку с полными параметрами', () => {
      const error = createModelMaintenanceError(
        'gpt-4',
        3600000,
        ['gpt-3.5-turbo'],
        'gpt-like',
        'endpoint',
        'req-123',
      );

      expect(error.details.availableAlternatives).toEqual(['gpt-3.5-turbo']);
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('endpoint');
      expect(error.details.requestId).toBe('req-123');
      expect(error.details.estimatedRecoveryTimeMs).toBe(3600000);
    });
  });

  describe('Policy Helpers', () => {
    it('getModelRecoveryStrategy должен возвращать правильную стратегию', () => {
      const fallbackError = createModelNotFoundInfraError('gpt-4');
      const regionError = createModelRegionRestrictedError('gpt-4', 'us-central1');
      const gpuError = createModelGpuConstraintError('gpt-4');

      expect(getModelRecoveryStrategy(fallbackError)).toBe('fallback_model');
      expect(getModelRecoveryStrategy(regionError)).toBe('region_switch');
      expect(getModelRecoveryStrategy(gpuError)).toBe('upgrade_plan');
    });

    it('getAvailableModelAlternatives должен возвращать альтернативы', () => {
      const errorWithAlternatives = createModelNotFoundInfraError('gpt-4', ['gpt-3.5-turbo', 'claude-3']);
      const errorWithoutAlternatives = createModelNotFoundInfraError('gpt-4');

      expect(getAvailableModelAlternatives(errorWithAlternatives)).toEqual(['gpt-3.5-turbo', 'claude-3']);
      expect(getAvailableModelAlternatives(errorWithoutAlternatives)).toEqual([]);
    });

    it('hasHighPriorityFallback должен определять high priority', () => {
      const highPriorityError = createModelNotFoundInfraError('gpt-4', ['gpt-3.5-turbo']);
      const mediumPriorityError = createModelTemporarilyUnavailableError('gpt-4', undefined, ['gpt-3.5-turbo']);
      const noAlternativesError = createModelNotFoundInfraError('gpt-4');

      expect(hasHighPriorityFallback(highPriorityError)).toBe(true);
      expect(hasHighPriorityFallback(mediumPriorityError)).toBe(false);
      expect(hasHighPriorityFallback(noAlternativesError)).toBe(false);
    });

    it('getRecommendedFallbackModel должен возвращать первую альтернативу', () => {
      const errorWithAlternatives = createModelNotFoundInfraError('gpt-4', ['gpt-3.5-turbo', 'claude-3']);
      const errorWithoutAlternatives = createModelNotFoundInfraError('gpt-4');

      expect(getRecommendedFallbackModel(errorWithAlternatives)).toBe('gpt-3.5-turbo');
      expect(getRecommendedFallbackModel(errorWithoutAlternatives)).toBeUndefined();
    });

    it('isModelRetryable должен правильно определять retriable ошибки', () => {
      const temporarilyUnavailableError = createModelTemporarilyUnavailableError('gpt-4', 120000);
      const maintenanceShortError = createModelMaintenanceError('gpt-4', 1800000);
      const maintenanceLongError = createModelMaintenanceError('gpt-4', 7200000);
      const regionError = createModelRegionRestrictedError('gpt-4', 'us-central1');
      const gpuError = createModelGpuConstraintError('gpt-4');

      expect(isModelRetryable(temporarilyUnavailableError)).toBe(true);
      expect(isModelRetryable(maintenanceShortError)).toBe(true);
      expect(isModelRetryable(maintenanceLongError)).toBe(false);
      expect(isModelRetryable(regionError)).toBe(false);
      expect(isModelRetryable(gpuError)).toBe(false);

      // Тест для случая с коротким временем восстановления для других типов ошибок
      const deprecatedWithShortRecovery = createModelUnavailableError(
        'TEST_CODE' as any,
        'Test',
        {
          unavailableReason: 'deprecated',
          recoveryStrategy: 'fallback_model',
          requestedModel: 'gpt-3',
          estimatedRecoveryTimeMs: 120000, // 2 минуты
        },
      );
      expect(isModelRetryable(deprecatedWithShortRecovery)).toBe(true);
    });

    it('getModelRetryDelay должен возвращать правильные задержки', () => {
      const errorWithDelay = createModelTemporarilyUnavailableError('gpt-4', 300000);
      const errorWithoutDelay = createModelNotFoundInfraError('gpt-4');

      expect(getModelRetryDelay(errorWithDelay)).toBe(300000);
      expect(getModelRetryDelay(errorWithoutDelay)).toBe(60000); // default
    });

    it('hasRegionalAlternatives должен определять наличие регионов', () => {
      const errorWithRegions = createModelRegionRestrictedError('gpt-4', 'us-central1', ['eu-central1']);
      const errorWithoutRegions = createModelRegionRestrictedError('gpt-4', 'us-central1');
      const nonRegionError = createModelNotFoundInfraError('gpt-4');

      expect(hasRegionalAlternatives(errorWithRegions)).toBe(true);
      expect(hasRegionalAlternatives(errorWithoutRegions)).toBe(false);
      expect(hasRegionalAlternatives(nonRegionError)).toBe(false);
    });

    it('getAvailableRegions должен возвращать регионы', () => {
      const errorWithRegions = createModelRegionRestrictedError('gpt-4', 'us-central1', ['eu-central1', 'asia-east1']);
      const errorWithoutRegions = createModelRegionRestrictedError('gpt-4', 'us-central1');

      expect(getAvailableRegions(errorWithRegions)).toEqual(['eu-central1', 'asia-east1']);
      expect(getAvailableRegions(errorWithoutRegions)).toEqual([]);
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен работать полный цикл создания и обработки ошибки', () => {
      // Создаем ошибку недоступности модели
      const error = createModelTemporarilyUnavailableError(
        'gpt-4',
        180000,
        ['gpt-3.5-turbo'],
        'gpt-like',
        'https://api.example.com',
        'req-12345',
      );

      // Проверяем структуру ошибки
      expect(error._tag).toBe('ModelUnavailableError');
      expect(error.details.type).toBe('yandex_ai_model_unavailable');
      expect(error.details.vendor).toBe('yandex_cloud');

      // Проверяем policy helpers
      expect(getModelRecoveryStrategy(error)).toBe('wait_retry');
      expect(getAvailableModelAlternatives(error)).toEqual(['gpt-3.5-turbo']);
      expect(hasHighPriorityFallback(error)).toBe(false);
      expect(getRecommendedFallbackModel(error)).toBe('gpt-3.5-turbo');
      expect(isModelRetryable(error)).toBe(true);
      expect(getModelRetryDelay(error)).toBe(180000);
      expect(hasRegionalAlternatives(error)).toBe(false);
      expect(getAvailableRegions(error)).toEqual([]);

      // Проверяем специфические поля
      expect(error.details.unavailableReason).toBe('temporarily_unavailable');
      expect(error.details.requestedModel).toBe('gpt-4');
      expect(error.details.modelFamily).toBe('gpt-like');
      expect(error.details.endpoint).toBe('https://api.example.com');
      expect(error.details.requestId).toBe('req-12345');
      expect(error.details.estimatedRecoveryTimeMs).toBe(180000);
    });

    it('должен корректно обрабатывать все типы unavailableReason', () => {
      // Тестируем createModelNotFoundInfraError
      const notFoundError = createModelNotFoundInfraError('gpt-4');
      expect(notFoundError.details.unavailableReason).toBe('model_not_found');

      // Тестируем createModelTemporarilyUnavailableError
      const tempUnavailableError = createModelTemporarilyUnavailableError('gpt-4');
      expect(tempUnavailableError.details.unavailableReason).toBe('temporarily_unavailable');

      // Тестируем createModelRegionRestrictedError
      const regionError = createModelRegionRestrictedError('gpt-4', 'us-central1');
      expect(regionError.details.unavailableReason).toBe('region_restricted');

      // Тестируем createModelGpuConstraintError
      const gpuError = createModelGpuConstraintError('gpt-4');
      expect(gpuError.details.unavailableReason).toBe('gpu_constraint');

      // Тестируем createModelMemoryConstraintError
      const memoryError = createModelMemoryConstraintError('gpt-4');
      expect(memoryError.details.unavailableReason).toBe('memory_constraint');

      // Тестируем createModelDeprecatedError
      const deprecatedError = createModelDeprecatedError('gpt-3');
      expect(deprecatedError.details.unavailableReason).toBe('deprecated');

      // Тестируем createModelMaintenanceError
      const maintenanceError = createModelMaintenanceError('gpt-4');
      expect(maintenanceError.details.unavailableReason).toBe('maintenance');
    });

    it('должен корректно обрабатывать все стратегии восстановления', () => {
      const strategies: ModelRecoveryStrategy[] = [
        'fallback_model',
        'region_switch',
        'wait_retry',
        'upgrade_plan',
        'fail_fast',
      ];

      strategies.forEach(strategy => {
        const error = createModelUnavailableError(
          'TEST_CODE' as any,
          'Test',
          {
            unavailableReason: 'model_not_found',
            recoveryStrategy: strategy,
            requestedModel: 'gpt-4',
          },
        );

        expect(error.details.recoveryStrategy).toBe(strategy);
      });
    });

    it('должен корректно обрабатывать все приоритеты fallback', () => {
      const priorities: ModelFallbackPriority[] = ['high', 'medium', 'low'];

      priorities.forEach(priority => {
        const error = createModelUnavailableError(
          'TEST_CODE' as any,
          'Test',
          {
            unavailableReason: 'model_not_found',
            recoveryStrategy: 'fallback_model',
            requestedModel: 'gpt-4',
            fallbackPriority: priority,
          },
        );

        expect(error.details.fallbackPriority).toBe(priority);
      });
    });
  });
});
