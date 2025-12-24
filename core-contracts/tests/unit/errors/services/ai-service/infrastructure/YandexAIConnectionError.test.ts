import { describe, expect, it } from 'vitest';

import {
  AI_VENDOR,
  createYandexAIConnectionError,
  createYandexAINetworkError,
  createYandexAIServiceUnavailableError,
  createYandexAITimeoutError,
  createYandexAIUnknownInfrastructureError,
  getYandexAIRecoveryStrategy,
  isYandexAIRetriableError,
  shouldTriggerCircuitBreaker,
} from '../../../../../../src/errors/services/ai-service/infrastructure/index.js';
import type {
  InfrastructureFailureKind,
  InfrastructurePolicyHint,
  YandexAIConnectionError,
  YandexAIConnectionErrorContext,
} from '../../../../../../src/errors/services/ai-service/infrastructure/index.js';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../../src/errors/base/ErrorConstants.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock YandexAIConnectionErrorContext для тестов */
function createMockYandexAIConnectionContext(
  overrides: Partial<YandexAIConnectionErrorContext> = {},
): YandexAIConnectionErrorContext {
  return {
    type: 'yandex_ai_connection',
    vendor: AI_VENDOR,
    failureKind: 'timeout',
    policyHint: 'retry',
    transport: 'http',
    endpoint: 'https://llm.api.cloud.yandex.net/v1/completions',
    region: 'ru-central1',
    requestId: 'req-123456',
    httpStatus: 504,
    retriable: true,
    originalError: new Error('Connection timeout'),
    timeoutMs: 30000,
    ...overrides,
  };
}

/** Создает mock YandexAIConnectionError для тестов */
function createMockYandexAIConnectionError(
  contextOverrides: Partial<YandexAIConnectionErrorContext> = {},
  messageOverrides: Partial<{ code: string; message: string; timestamp: string; }> = {},
): YandexAIConnectionError {
  return createYandexAIConnectionError(
    (messageOverrides.code ?? 'INFRA_AI_CONNECTION_TIMEOUT') as any,
    messageOverrides.message ?? 'Test Yandex AI connection error',
    {
      failureKind: 'timeout',
      policyHint: 'retry',
      transport: 'http',
      endpoint: 'https://llm.api.cloud.yandex.net/v1/completions',
      retriable: true,
      timeoutMs: 30000,
      ...contextOverrides,
    },
    messageOverrides.timestamp,
  );
}

// ==================== TESTS ====================

describe('YandexAIConnectionError', () => {
  describe('Константы и типы', () => {
    it('должен корректно определять AI_VENDOR константу', () => {
      expect(AI_VENDOR).toBe('yandex_cloud');
    });

    it('должен корректно определять InfrastructurePolicyHint типы', () => {
      const validHints: InfrastructurePolicyHint[] = [
        'retry',
        'circuit_break',
        'fail_fast',
      ];

      expect(validHints).toHaveLength(3);
      validHints.forEach((hint) => {
        expect(typeof hint).toBe('string');
      });
    });

    it('должен корректно определять InfrastructureFailureKind типы', () => {
      const validKinds: InfrastructureFailureKind[] = [
        'timeout',
        'network',
        'tls',
        'service_unavailable',
        'unknown',
      ];

      expect(validKinds).toHaveLength(5);
      validKinds.forEach((kind) => {
        expect(typeof kind).toBe('string');
      });
    });

    it('должен корректно определять YandexAIConnectionErrorContext интерфейс', () => {
      const context: YandexAIConnectionErrorContext = createMockYandexAIConnectionContext();

      expect(context.type).toBe('yandex_ai_connection');
      expect(context.vendor).toBe(AI_VENDOR);
      expect(context.failureKind).toBe('timeout');
      expect(context.policyHint).toBe('retry');
      expect(context.transport).toBe('http');
      expect(context.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(context.region).toBe('ru-central1');
      expect(context.requestId).toBe('req-123456');
      expect(context.httpStatus).toBe(504);
      expect(context.retriable).toBe(true);
      expect(context.originalError).toBeInstanceOf(Error);
      expect(context.timeoutMs).toBe(30000);
    });
  });

  describe('createYandexAIConnectionError', () => {
    it('должен создавать базовую ошибку с минимальными параметрами', () => {
      const error = createYandexAIConnectionError(
        'INFRA_AI_CONNECTION_TIMEOUT' as any,
        'Connection timeout',
        {
          failureKind: 'timeout',
          policyHint: 'retry',
          transport: 'http',
          retriable: true,
        },
      );

      expect(error._tag).toBe('YandexAIConnectionError');
      expect(error.category).toBe(ERROR_CATEGORY.TECHNICAL);
      expect(error.origin).toBe(ERROR_ORIGIN.INFRASTRUCTURE);
      expect(error.severity).toBe(ERROR_SEVERITY.HIGH);
      expect(error.code).toBe('INFRA_AI_CONNECTION_TIMEOUT');
      expect(error.message).toBe('Connection timeout');
      expect(error.details.type).toBe('yandex_ai_connection');
      expect(error.details.vendor).toBe(AI_VENDOR);
      expect(error.details.failureKind).toBe('timeout');
      expect(error.details.policyHint).toBe('retry');
      expect(error.details.transport).toBe('http');
      expect(error.details.retriable).toBe(true);
      expect(typeof error.timestamp).toBe('string');
    });

    it('должен создавать ошибку с полным контекстом', () => {
      const context = createMockYandexAIConnectionContext();
      const error = createYandexAIConnectionError(
        'INFRA_AI_CONNECTION_TIMEOUT' as any,
        'Full context error',
        context,
      );

      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(error.details.region).toBe('ru-central1');
      expect(error.details.requestId).toBe('req-123456');
      expect(error.details.httpStatus).toBe(504);
      expect(error.details.originalError).toBeInstanceOf(Error);
      expect(error.details.timeoutMs).toBe(30000);
    });

    it('должен использовать переданный timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createYandexAIConnectionError(
        'TEST_CODE' as any,
        'Test',
        {
          failureKind: 'timeout',
          policyHint: 'retry',
          transport: 'http',
          retriable: true,
        },
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
    });

    it('должен генерировать timestamp автоматически если не передан', () => {
      const before = new Date();
      const error = createYandexAIConnectionError(
        'TEST_CODE' as any,
        'Test',
        {
          failureKind: 'timeout',
          policyHint: 'retry',
          transport: 'http',
          retriable: true,
        },
      );
      const after = new Date();

      const errorTime = new Date(error.timestamp);
      expect(errorTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(errorTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('createYandexAITimeoutError', () => {
    it('должен создавать ошибку таймаута с базовыми параметрами', () => {
      const error = createYandexAITimeoutError(
        'https://llm.api.cloud.yandex.net/v1/completions',
        30000,
      );

      expect(error.code).toBe('INFRA_AI_CONNECTION_TIMEOUT');
      expect(error.message).toContain('Таймаут подключения к Yandex AI');
      expect(error.message).toContain('30000ms');
      expect(error.details.failureKind).toBe('timeout');
      expect(error.details.policyHint).toBe('retry');
      expect(error.details.transport).toBe('http');
      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(error.details.timeoutMs).toBe(30000);
      expect(error.details.retriable).toBe(true);
    });

    it('должен создавать ошибку таймаута с originalError', () => {
      const originalError = new Error('Timeout occurred');
      const error = createYandexAITimeoutError(
        'https://llm.api.cloud.yandex.net/v1/completions',
        30000,
        originalError,
      );

      expect(error.details.originalError).toBe(originalError);
    });
  });

  describe('createYandexAIServiceUnavailableError', () => {
    it('должен создавать ошибку недоступности сервиса без опциональных параметров', () => {
      const error = createYandexAIServiceUnavailableError();

      expect(error.code).toBe('INFRA_AI_SERVICE_UNAVAILABLE');
      expect(error.message).toBe('Сервис Yandex AI временно недоступен');
      expect(error.details.failureKind).toBe('service_unavailable');
      expect(error.details.policyHint).toBe('circuit_break');
      expect(error.details.transport).toBe('http');
      expect(error.details.retriable).toBe(true);
      expect(error.details.endpoint).toBeUndefined();
      expect(error.details.httpStatus).toBeUndefined();
      expect(error.details.originalError).toBeUndefined();
    });

    it('должен создавать ошибку недоступности сервиса с endpoint', () => {
      const error = createYandexAIServiceUnavailableError(
        'https://llm.api.cloud.yandex.net/v1/completions',
      );

      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
    });

    it('должен создавать ошибку недоступности сервиса с httpStatus', () => {
      const error = createYandexAIServiceUnavailableError(undefined, 503);

      expect(error.details.httpStatus).toBe(503);
    });

    it('должен создавать ошибку недоступности сервиса с originalError', () => {
      const originalError = new Error('Service unavailable');
      const error = createYandexAIServiceUnavailableError(undefined, undefined, originalError);

      expect(error.details.originalError).toBe(originalError);
    });

    it('должен создавать ошибку недоступности сервиса со всеми параметрами', () => {
      const originalError = new Error('Service down');
      const error = createYandexAIServiceUnavailableError(
        'https://llm.api.cloud.yandex.net/v1/completions',
        503,
        originalError,
      );

      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(error.details.httpStatus).toBe(503);
      expect(error.details.originalError).toBe(originalError);
    });
  });

  describe('createYandexAINetworkError', () => {
    it('должен создавать сетевую ошибку с типом network по умолчанию', () => {
      const error = createYandexAINetworkError('https://llm.api.cloud.yandex.net/v1/completions');

      expect(error.code).toBe('INFRA_AI_NETWORK_ERROR');
      expect(error.message).toBe('Сетевая ошибка при обращении к Yandex AI');
      expect(error.details.failureKind).toBe('network');
      expect(error.details.policyHint).toBe('retry');
      expect(error.details.transport).toBe('http');
      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(error.details.retriable).toBe(true);
    });

    it('должен создавать сетевую ошибку с типом tls', () => {
      const error = createYandexAINetworkError(
        'https://llm.api.cloud.yandex.net/v1/completions',
        'tls',
      );

      expect(error.details.failureKind).toBe('tls');
    });

    it('должен создавать сетевую ошибку с originalError', () => {
      const originalError = new Error('Network error');
      const error = createYandexAINetworkError(
        'https://llm.api.cloud.yandex.net/v1/completions',
        'network',
        originalError,
      );

      expect(error.details.originalError).toBe(originalError);
    });
  });

  describe('createYandexAIUnknownInfrastructureError', () => {
    it('должен создавать неизвестную инфраструктурную ошибку', () => {
      const error = createYandexAIUnknownInfrastructureError('Unknown infrastructure error');

      expect(error.code).toBe('INFRA_AI_UNKNOWN_ERROR');
      expect(error.message).toBe('Unknown infrastructure error');
      expect(error.details.failureKind).toBe('unknown');
      expect(error.details.policyHint).toBe('fail_fast');
      expect(error.details.transport).toBe('sdk');
      expect(error.details.retriable).toBe(false);
    });

    it('должен создавать неизвестную ошибку с originalError', () => {
      const originalError = new Error('Unknown error');
      const error = createYandexAIUnknownInfrastructureError('Test message', originalError);

      expect(error.details.originalError).toBe(originalError);
    });
  });

  describe('Policy Helpers', () => {
    it('getYandexAIRecoveryStrategy должен возвращать правильную стратегию', () => {
      const retryError = createYandexAITimeoutError('endpoint', 30000);
      const circuitBreakError = createYandexAIServiceUnavailableError();
      const failFastError = createYandexAIUnknownInfrastructureError('Test');

      expect(getYandexAIRecoveryStrategy(retryError)).toBe('retry');
      expect(getYandexAIRecoveryStrategy(circuitBreakError)).toBe('circuit_break');
      expect(getYandexAIRecoveryStrategy(failFastError)).toBe('fail_fast');
    });

    it('isYandexAIRetriableError должен правильно определять retriable ошибки', () => {
      const retriableError = createYandexAITimeoutError('endpoint', 30000);
      const nonRetriableError = createYandexAIUnknownInfrastructureError('Test');

      expect(isYandexAIRetriableError(retriableError)).toBe(true);
      expect(isYandexAIRetriableError(nonRetriableError)).toBe(false);
    });

    it('shouldTriggerCircuitBreaker должен правильно определять circuit breaker', () => {
      const circuitBreakError = createYandexAIServiceUnavailableError();
      const retryError = createYandexAITimeoutError('endpoint', 30000);
      const failFastError = createYandexAIUnknownInfrastructureError('Test');

      expect(shouldTriggerCircuitBreaker(circuitBreakError)).toBe(true);
      expect(shouldTriggerCircuitBreaker(retryError)).toBe(false);
      expect(shouldTriggerCircuitBreaker(failFastError)).toBe(false);
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен работать полный цикл создания и обработки ошибки', () => {
      // Создаем ошибку таймаута
      const error = createYandexAITimeoutError(
        'https://llm.api.cloud.yandex.net/v1/completions',
        30000,
        new Error('Connection timeout'),
      );

      // Проверяем структуру ошибки
      expect(error._tag).toBe('YandexAIConnectionError');
      expect(error.details.type).toBe('yandex_ai_connection');
      expect(error.details.vendor).toBe(AI_VENDOR);

      // Проверяем policy helpers
      expect(getYandexAIRecoveryStrategy(error)).toBe('retry');
      expect(isYandexAIRetriableError(error)).toBe(true);
      expect(shouldTriggerCircuitBreaker(error)).toBe(false);

      // Проверяем специфические поля
      expect(error.details.failureKind).toBe('timeout');
      expect(error.details.endpoint).toBe('https://llm.api.cloud.yandex.net/v1/completions');
      expect(error.details.timeoutMs).toBe(30000);
      expect(error.details.originalError).toBeInstanceOf(Error);
    });

    it('должен корректно обрабатывать все типы failureKind', () => {
      // Тестируем createYandexAITimeoutError
      const timeoutError = createYandexAITimeoutError('endpoint', 30000);
      expect(timeoutError.details.failureKind).toBe('timeout');
      expect(timeoutError.details.policyHint).toBe('retry');
      expect(timeoutError.details.retriable).toBe(true);

      // Тестируем createYandexAIServiceUnavailableError
      const unavailableError = createYandexAIServiceUnavailableError();
      expect(unavailableError.details.failureKind).toBe('service_unavailable');
      expect(unavailableError.details.policyHint).toBe('circuit_break');
      expect(unavailableError.details.retriable).toBe(true);

      // Тестируем createYandexAINetworkError с network
      const networkError = createYandexAINetworkError('endpoint', 'network');
      expect(networkError.details.failureKind).toBe('network');
      expect(networkError.details.policyHint).toBe('retry');
      expect(networkError.details.retriable).toBe(true);

      // Тестируем createYandexAINetworkError с tls
      const tlsError = createYandexAINetworkError('endpoint', 'tls');
      expect(tlsError.details.failureKind).toBe('tls');
      expect(tlsError.details.policyHint).toBe('retry');
      expect(tlsError.details.retriable).toBe(true);

      // Тестируем createYandexAIUnknownInfrastructureError
      const unknownError = createYandexAIUnknownInfrastructureError('Test message');
      expect(unknownError.details.failureKind).toBe('unknown');
      expect(unknownError.details.policyHint).toBe('fail_fast');
      expect(unknownError.details.retriable).toBe(false);
    });

    it('должен корректно обрабатывать все типы транспорта', () => {
      const transports: Array<'http' | 'grpc' | 'sdk'> = ['http', 'grpc', 'sdk'];

      transports.forEach((transport) => {
        const error = createYandexAIConnectionError(
          'TEST_CODE' as any,
          'Test',
          {
            failureKind: 'unknown',
            policyHint: 'fail_fast',
            transport,
            retriable: false,
          },
        );

        expect(error.details.transport).toBe(transport);
      });
    });
  });
});
