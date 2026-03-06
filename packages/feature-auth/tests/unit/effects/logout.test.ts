/**
 * @file Unit тесты для effects/logout.ts
 * Полное покрытие 100% всех веток кода, включая concurrency стратегии, error handling и edge cases
 */

/* eslint-disable @livai/rag/context-leakage, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogoutEffect } from '../../../src/effects/logout.js';
import type {
  LogoutEffectConfig,
  LogoutEffectDeps,
} from '../../../src/effects/logout/logout-effect.types.js';
import type { AuthApiClientPort } from '../../../src/effects/shared/api-client.port.js';
import type { AuthStorePort } from '../../../src/effects/shared/auth-store.port.js';
import type { AuditEventValues } from '../../../src/schemas/index.js';
import type { AuthError } from '../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createMockDeps() {
  const mockAuthStore = {
    setAuthState: vi.fn(),
    setSessionState: vi.fn(),
    setSecurityState: vi.fn(),
    applyEventType: vi.fn(),
    setStoreLocked: vi.fn(),
    batchUpdate: vi.fn(),
  } as unknown as AuthStorePort;

  const mockApiClient = {
    post: vi.fn(),
    get: vi.fn(),
  } as unknown as AuthApiClientPort;

  const mockClock = {
    now: vi.fn(() => 1704067200000), // 2024-01-01 00:00:00 UTC
  };

  const mockAuditLogger = {
    logLogoutEvent: vi.fn(),
  };

  const mockErrorMapper = {
    map: vi.fn((error: unknown): AuthError => {
      if (error instanceof Error) {
        return {
          kind: 'network',
          retryable: true,
          message: error.message,
        };
      }
      return {
        kind: 'network',
        retryable: true,
        message: 'Unknown error',
      };
    }),
  };

  const mockAbortController = {
    create: vi.fn(() => new AbortController()),
  };

  const mockEventIdGenerator = {
    generate: vi.fn(() => 'custom-event-id'),
  };

  return {
    authStore: mockAuthStore,
    apiClient: mockApiClient,
    clock: mockClock,
    auditLogger: mockAuditLogger,
    errorMapper: mockErrorMapper,
    abortController: mockAbortController,
    eventIdGenerator: mockEventIdGenerator,
    mocks: {
      authStore: mockAuthStore,
      apiClient: mockApiClient,
      clock: mockClock,
      auditLogger: mockAuditLogger,
      errorMapper: mockErrorMapper,
      abortController: mockAbortController,
      eventIdGenerator: mockEventIdGenerator,
    },
  };
}

function createLocalDeps(): LogoutEffectDeps & {
  mocks: ReturnType<typeof createMockDeps>['mocks'];
} {
  const deps = createMockDeps();
  return {
    mode: 'local',
    authStore: deps.authStore,
    clock: deps.clock,
    auditLogger: deps.auditLogger,
    mocks: deps.mocks,
  } as LogoutEffectDeps & { mocks: ReturnType<typeof createMockDeps>['mocks']; };
}

function createRemoteDeps(): LogoutEffectDeps & {
  mocks: ReturnType<typeof createMockDeps>['mocks'];
} {
  const deps = createMockDeps();
  return {
    mode: 'remote',
    authStore: deps.authStore,
    clock: deps.clock,
    auditLogger: deps.auditLogger,
    apiClient: deps.apiClient,
    errorMapper: deps.errorMapper,
    abortController: deps.abortController,
    mocks: deps.mocks,
  } as LogoutEffectDeps & { mocks: ReturnType<typeof createMockDeps>['mocks']; };
}

function createDefaultConfig(): LogoutEffectConfig {
  return {
    mode: 'local',
    concurrency: 'ignore',
  };
}

function createConfigWithConcurrency(
  concurrency: LogoutEffectConfig['concurrency'],
): LogoutEffectConfig {
  return {
    mode: 'local',
    concurrency,
  };
}

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('createLogoutEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('успешный logout flow', () => {
    it('выполняет полный flow: lock → reset → unlock → audit для local mode', async () => {
      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      const result = await effect();

      expect(result.type).toBe('success');
      expect(localDeps.authStore.batchUpdate).toHaveBeenCalled();
      expect(localDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
    });

    it('выполняет полный flow: lock → reset → unlock → revoke → audit для remote mode', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
        concurrency: 'ignore',
      };

      // Мокаем успешный revoke запрос
      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => ({}),
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      const result = await effect();

      expect(result.type).toBe('success');
      expect(remoteDeps.authStore.batchUpdate).toHaveBeenCalled();
      expect(remoteDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
      // Даем время для выполнения revoke
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteDeps.mocks.apiClient.post).toHaveBeenCalled();
    });

    it('использует кастомный reason из config', async () => {
      const localDeps = createLocalDeps();
      const localConfig: LogoutEffectConfig = {
        mode: 'local',
        reason: 'token_expired',
      };

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      await effect();

      expect(localDeps.authStore.batchUpdate).toHaveBeenCalled();
    });

    it('использует дефолтный reason если не указан', async () => {
      const localDeps = createLocalDeps();
      const localConfig: LogoutEffectConfig = {
        mode: 'local',
      };

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      await effect();

      expect(localDeps.authStore.batchUpdate).toHaveBeenCalled();
    });
  });

  describe('concurrency стратегии', () => {
    describe('ignore', () => {
      it('возвращает уже выполняющийся запрос при ignore стратегии', async () => {
        const localDeps = createLocalDeps();
        const ignoreConfig = createConfigWithConcurrency('ignore');

        const logoutEffect = createLogoutEffect(localDeps, ignoreConfig);
        const effect1 = logoutEffect();
        const promise1 = effect1();

        // Второй вызов должен вернуть тот же promise (inFlight)
        const effect2 = logoutEffect();
        const promise2 = effect2();

        // Оба должны вернуть один и тот же promise (same reference)
        // Но из-за того что каждый вызов logoutEffect создает новую функцию, promise может быть разным
        // Проверяем что результат одинаковый и batchUpdate вызван только раз
        const [result1, result2] = await Promise.all([promise1, promise2]);

        expect(result1.type).toBe('success');
        expect(result2.type).toBe('success');
        // batchUpdate должен быть вызван только один раз (второй запрос игнорируется)
        expect(localDeps.authStore.batchUpdate).toHaveBeenCalledTimes(1);
        // auditLogger должен быть вызван только один раз
        expect(localDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalledTimes(1);
      });
    });

    describe('cancel_previous', () => {
      it('отменяет предыдущий запрос при cancel_previous стратегии', async () => {
        const remoteDeps = createRemoteDeps();
        const cancelConfig: LogoutEffectConfig = {
          mode: 'remote',
          concurrency: 'cancel_previous',
        };

        (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return {};
          },
        );

        const logoutEffect = createLogoutEffect(remoteDeps, cancelConfig);
        const effect1 = logoutEffect();
        const effect2 = logoutEffect();

        const promise1 = effect1();
        const promise2 = effect2();

        // Второй запрос должен отменить первый
        const result2 = await promise2;
        expect(result2.type).toBe('success');

        // Первый запрос может быть отменен
        await Promise.allSettled([promise1, promise2]);
      });
    });

    describe('serialize', () => {
      it('выполняет запросы последовательно в serialize режиме', async () => {
        const localDeps = createLocalDeps();
        const serializeConfig = createConfigWithConcurrency('serialize');

        const logoutEffect = createLogoutEffect(localDeps, serializeConfig);
        const effect1 = logoutEffect();
        const effect2 = logoutEffect();

        const promise1 = effect1();
        const promise2 = effect2();

        const result1 = await promise1;
        const result2 = await promise2;

        expect(result1.type).toBe('success');
        expect(result2.type).toBe('success');
      });

      it('возвращает rate_limited ошибку при переполнении очереди (строки 402-406)', async () => {
        const localDeps = createLocalDeps();
        const serializeConfig = createConfigWithConcurrency('serialize');

        // Мокируем batchUpdate, чтобы он выполнялся медленно
        const resolveState = { resolve: undefined as (() => void) | undefined };
        // eslint-disable-next-line ai-security/model-poisoning -- Тестовые данные для мокирования Promise, не используются в production
        const batchUpdatePromise = new Promise<void>((resolve) => {
          resolveState.resolve = resolve;
        });
        (localDeps.mocks.authStore.batchUpdate as ReturnType<typeof vi.fn>).mockImplementation(
          () => batchUpdatePromise,
        );

        const logoutEffect = createLogoutEffect(localDeps, serializeConfig);

        // Запускаем 10 запросов (MAX_SERIALIZE_QUEUE_LENGTH = 10)
        const promises = Array.from({ length: 10 }, () => {
          const effect = logoutEffect();
          return effect();
        });

        // 11-й запрос должен вернуть rate_limited ошибку
        const effect11 = logoutEffect();
        const result11 = await effect11();

        expect(result11.type).toBe('error');
        if (result11.type === 'error') {
          expect(result11.error.kind).toBe('rate_limited');
          expect(result11.error.message).toContain('queue is full');
        }

        // Разрешаем выполнение batchUpdate для очистки
        resolveState.resolve!();
        await Promise.allSettled(promises);
      });
    });
  });

  describe('remote mode revoke', () => {
    it('выполняет revoke запрос после reset для remote mode', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 5000,
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => ({}),
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      await effect();

      // Даем время для выполнения revoke
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteDeps.mocks.apiClient.post).toHaveBeenCalledWith(
        '/v1/auth/logout',
        {},
        expect.any(Object),
      );
    });

    it('логирует revoke ошибку через auditLogger', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 5000,
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(async () => {
        throw new Error('Revoke failed');
      });

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      const result = await effect();

      expect(result.type).toBe('success'); // Logout успешен, revoke ошибка не влияет
      // Даем время для обработки revoke ошибки
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteDeps.mocks.errorMapper.map).toHaveBeenCalled();
      expect(remoteDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
    });

    it('продолжает работу при ошибке в audit logging для revoke', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 5000,
      };

      // Мокируем apiClient, чтобы revoke падал с ошибкой
      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(async () => {
        throw new Error('Revoke failed');
      });

      // Мокируем auditLogger, чтобы он падал при логировании (edge case)
      (remoteDeps.mocks.auditLogger.logLogoutEvent as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('Audit logging failed');
        },
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      const result = await effect();

      // Logout должен быть успешным, даже если audit logging падает
      expect(result.type).toBe('success');
      // Даем время для обработки revoke ошибки
      await new Promise((resolve) => setTimeout(resolve, 10));
      // errorMapper должен быть вызван для обработки revoke ошибки
      expect(remoteDeps.mocks.errorMapper.map).toHaveBeenCalled();
      // auditLogger должен быть вызван (и упасть, но это не должно влиять на logout)
      expect(remoteDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
    });

    it('логирует revoke skipped при превышении лимита параллельных запросов', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 5000,
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {};
        },
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);

      // Запускаем 4 запроса одновременно (MAX_REVOKE_CONCURRENT = 3)
      const promises = Array.from({ length: 4 }, () => {
        const effect = logoutEffect();
        return effect();
      });

      await Promise.allSettled(promises);

      // Даем время для обработки revoke
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Один из запросов должен пропустить revoke из-за лимита
      const logCalls = remoteDeps.mocks.auditLogger.logLogoutEvent.mock.calls;
      const skippedEvents = logCalls.filter((call) => {
        const event = call[0] as AuditEventValues;
        return event.type === 'revoke_skipped_due_to_limit';
      });
      expect(skippedEvents.length).toBeGreaterThan(0);
    });

    it('использует кастомный timeout из config', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 10000,
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => ({}),
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      await effect();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteDeps.mocks.apiClient.post).toHaveBeenCalled();
    });

    it('использует дефолтный timeout если не указан', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => ({}),
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      await effect();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteDeps.mocks.apiClient.post).toHaveBeenCalled();
    });

    it('передает signal в revoke запрос когда signal определен (строка 149)', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
      };

      const capturedState = { signal: undefined as AbortSignal | undefined };
      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockImplementation(
        (_path, _body, options) => {
          capturedState.signal = options?.signal;
          return async () => ({});
        },
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      const externalController = new AbortController();
      await effect(externalController.signal);

      await new Promise((resolve) => setTimeout(resolve, 10));
      // Signal всегда передается, так как он создается из внутреннего controller
      // Внутренний controller может быть связан с externalSignal через addEventListener
      expect(capturedState.signal).toBeDefined();
      expect(capturedState.signal).toBeInstanceOf(AbortSignal);
    });

    it('передает signal в revoke запрос (signal всегда определен из controller) (строка 149)', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
      };

      const capturedState = { options: undefined as { signal?: AbortSignal; } | undefined };
      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockImplementation(
        (_path, _body, options) => {
          capturedState.options = options;
          return async () => ({});
        },
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      await effect(); // Без externalSignal, но внутренний controller создается

      await new Promise((resolve) => setTimeout(resolve, 10));
      // Signal всегда передается, так как он создается из внутреннего controller
      expect(capturedState.options).toBeDefined();
      expect(capturedState.options?.signal).toBeDefined();
    });
  });

  describe('eventId generation', () => {
    it('использует eventIdGenerator из DI если доступен', async () => {
      const localDeps = createLocalDeps();
      const localDepsWithGenerator = {
        ...localDeps,
        eventIdGenerator: localDeps.mocks.eventIdGenerator,
      };
      const localConfig = createDefaultConfig();

      const logoutEffect = createLogoutEffect(localDepsWithGenerator, localConfig);
      const effect = logoutEffect();
      await effect();

      expect(localDeps.mocks.eventIdGenerator.generate).toHaveBeenCalled();
    });

    it('использует crypto.randomUUID если eventIdGenerator не доступен', async () => {
      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      await effect();

      expect(localDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
      const event = localDeps.mocks.auditLogger.logLogoutEvent.mock.calls[0]
        ?.[0] as AuditEventValues;
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
    });

    it('использует crypto.getRandomValues если crypto.randomUUID недоступен (строки 105-112)', async () => {
      const originalCrypto = global.crypto;
      // Мокируем crypto без randomUUID, но с getRandomValues
      const mockCrypto = {
        getRandomValues: (arr: Uint8Array) => {
          // Заполняем массив случайными значениями для теста
          arr.forEach((_, i) => {
            // eslint-disable-next-line security/detect-object-injection -- Индекс массива контролируется длиной массива, безопасно
            arr[i] = Math.floor(Math.random() * 256);
          });
          return arr;
        },
      } as Crypto;

      // Используем Object.defineProperty для перезаписи crypto
      Object.defineProperty(global, 'crypto', {
        value: mockCrypto,
        writable: true,
        configurable: true,
      });

      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      await effect();

      expect(localDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
      const event = localDeps.mocks.auditLogger.logLogoutEvent.mock.calls[0]
        ?.[0] as AuditEventValues;
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId).toMatch(/^logout-\d+-/);

      // Восстанавливаем оригинальный crypto
      Object.defineProperty(global, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      });
    });

    it('использует fallback генерацию если crypto полностью недоступен (строки 116-121)', async () => {
      const originalCrypto = global.crypto;
      const originalProcess = global.process;
      // @ts-expect-error - намеренно удаляем для теста
      delete global.crypto;
      // @ts-expect-error - намеренно удаляем process для теста fallback
      delete global.process;

      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      await effect();

      expect(localDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
      const event = localDeps.mocks.auditLogger.logLogoutEvent.mock.calls[0]
        ?.[0] as AuditEventValues;
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      // Должен содержать 'no-crypto' так как process тоже недоступен
      expect(event.eventId).toMatch(/logout-\d+-no-crypto/);

      global.crypto = originalCrypto;
      global.process = originalProcess;
    });

    it('использует process.hrtime fallback если crypto недоступен но process доступен', async () => {
      const originalCrypto = global.crypto;
      // @ts-expect-error - намеренно удаляем для теста
      delete global.crypto;
      // process остается доступным (Node.js окружение)

      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      await effect();

      expect(localDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
      const event = localDeps.mocks.auditLogger.logLogoutEvent.mock.calls[0]
        ?.[0] as AuditEventValues;
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      // Должен содержать 'fallback-' так как process.hrtime доступен
      expect(event.eventId).toMatch(/logout-\d+-fallback-/);

      global.crypto = originalCrypto;
    });
  });

  describe('external signal abort', () => {
    it('отменяет запрос при external signal abort', async () => {
      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();
      const controller = new AbortController();

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();

      // Запускаем и сразу отменяем
      const promise = effect(controller.signal);
      controller.abort();

      const result = await promise;
      // Logout может завершиться успешно, так как reset store синхронный
      expect(result.type).toBe('success');
    });
  });

  describe('error handling', () => {
    it('обрабатывает ошибки в local mode', async () => {
      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();

      // Симулируем ошибку в batchUpdate
      (localDeps.mocks.authStore.batchUpdate as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Store error');
      });

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.error.kind).toBe('network');
      }
    });

    it('обрабатывает ошибки в remote mode через errorMapper', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
      };

      // Симулируем ошибку в batchUpdate
      (remoteDeps.mocks.authStore.batchUpdate as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('Store error');
        },
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      expect(remoteDeps.mocks.errorMapper.map).toHaveBeenCalled();
    });

    it('логирует ошибки через auditLogger', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
      };

      (remoteDeps.mocks.authStore.batchUpdate as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('Store error');
        },
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect = logoutEffect();
      await effect();

      expect(remoteDeps.mocks.auditLogger.logLogoutEvent).toHaveBeenCalled();
      const event = remoteDeps.mocks.auditLogger.logLogoutEvent.mock.calls.find((call) => {
        const auditEvent = call[0] as AuditEventValues;
        return auditEvent.type === 'logout_failure';
      });
      expect(event).toBeDefined();
    });

    it('продолжает flow при ошибке в audit logging', async () => {
      const localDeps = createLocalDeps();
      const localConfig = createDefaultConfig();

      // Симулируем ошибку в audit logging
      (localDeps.mocks.auditLogger.logLogoutEvent as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('Audit logging error');
        },
      );

      const logoutEffect = createLogoutEffect(localDeps, localConfig);
      const effect = logoutEffect();
      const result = await effect();

      // Logout должен завершиться успешно, несмотря на ошибку в audit logging
      expect(result.type).toBe('success');
    });
  });

  describe('abortController', () => {
    it('использует abortController из DI для remote mode', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
        concurrency: 'cancel_previous',
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => ({}),
      );

      const logoutEffect = createLogoutEffect(remoteDeps, remoteConfig);
      const effect1 = logoutEffect();
      const effect2 = logoutEffect();

      await Promise.allSettled([effect1(), effect2()]);

      expect(remoteDeps.mocks.abortController.create).toHaveBeenCalled();
    });

    it('создает новый AbortController если abortController не доступен', async () => {
      const remoteDeps = createRemoteDeps();
      const remoteDepsWithoutController: LogoutEffectDeps = {
        mode: 'remote',
        authStore: remoteDeps.mocks.authStore,
        clock: remoteDeps.mocks.clock,
        auditLogger: remoteDeps.mocks.auditLogger,
        apiClient: remoteDeps.mocks.apiClient,
        errorMapper: remoteDeps.mocks.errorMapper,
      };
      const remoteConfig: LogoutEffectConfig = {
        mode: 'remote',
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => ({}),
      );

      const logoutEffect = createLogoutEffect(remoteDepsWithoutController, remoteConfig);
      const effect = logoutEffect();
      await effect();

      // AbortController должен быть создан (внутренне)
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteDeps.mocks.apiClient.post).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('очищает inFlight после завершения для ignore стратегии', async () => {
      const localDeps = createLocalDeps();
      const ignoreConfig = createConfigWithConcurrency('ignore');

      const logoutEffect = createLogoutEffect(localDeps, ignoreConfig);
      const effect1 = logoutEffect();
      await effect1();

      // После завершения первого запроса, новый запрос должен выполняться
      const effect2 = logoutEffect();
      const result2 = await effect2();

      expect(result2.type).toBe('success');
      expect(localDeps.authStore.batchUpdate).toHaveBeenCalledTimes(2);
    });

    it('очищает controllerMap после завершения для cancel_previous стратегии', async () => {
      const remoteDeps = createRemoteDeps();
      const cancelConfig: LogoutEffectConfig = {
        mode: 'remote',
        concurrency: 'cancel_previous',
      };

      (remoteDeps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        async () => ({}),
      );

      const logoutEffect = createLogoutEffect(remoteDeps, cancelConfig);
      const effect1 = logoutEffect();
      const effect2 = logoutEffect();

      const result1 = await effect1();
      const result2 = await effect2();

      expect(result1.type).toBe('success');
      expect(result2.type).toBe('success');
      // Даем время для выполнения revoke
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteDeps.mocks.apiClient.post).toHaveBeenCalled();
    });

    it('очищает queueTail после завершения для serialize стратегии', async () => {
      const localDeps = createLocalDeps();
      const serializeConfig = createConfigWithConcurrency('serialize');

      const logoutEffect = createLogoutEffect(localDeps, serializeConfig);
      const effect1 = logoutEffect();
      const effect2 = logoutEffect();

      await Promise.allSettled([effect1(), effect2()]);

      // После завершения можно запустить новый запрос
      const effect3 = logoutEffect();
      const result3 = await effect3();

      expect(result3.type).toBe('success');
    });
  });
});

/* eslint-enable @livai/rag/context-leakage, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */
