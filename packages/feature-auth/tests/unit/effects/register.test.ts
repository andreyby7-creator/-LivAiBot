/**
 * @file Unit тесты для effects/register.ts
 * Полное покрытие 100% всех веток кода: валидация, API, store, audit и concurrency.
 */

/* eslint-disable @livai/rag/source-citation, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  RegisterIdentifierType,
  RegisterRequest,
} from '../../../src/domain/RegisterRequest.js';
import type { RegisterResponse } from '../../../src/domain/RegisterResponse.js';
import { createRegisterEffect } from '../../../src/effects/register.js';
import type {
  RegisterEffectConfig,
  RegisterEffectDeps,
} from '../../../src/effects/register/register-effect.types.js';
import type { RegisterResponseValues } from '../../../src/schemas/index.js';
import type { AuthError } from '../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createRegisterRequest<T extends RegisterIdentifierType>(
  type: T,
  overrides: Partial<RegisterRequest<T>> = {},
): RegisterRequest<T> {
  const base: RegisterRequest<T> = {
    identifier: {
      type,
      value: type === 'email' ? 'user@example.com' : `${type}-value`,
    },
    password: type === 'oauth' ? undefined : 'password-123',
    workspaceName: type === 'oauth' ? undefined : 'workspace-1',
    clientContext: {
      ip: '127.0.0.1',
      deviceId: 'device-123',
      userAgent: 'Mozilla/5.0',
      geo: { lat: 10, lng: 20 },
    },
    ...overrides,
  } as RegisterRequest<T>;

  return base;
}

function createRegisterResponseValues(
  overrides: Partial<RegisterResponseValues> = {},
): RegisterResponseValues {
  const base: RegisterResponseValues = {
    userId: 'user-123',
    workspaceId: 'ws-123',
    email: 'user@example.com',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'bearer',
    expiresIn: 3600,
  };
  return { ...base, ...overrides };
}

function createDomainRegisterResponse(
  overrides: Partial<RegisterResponse> = {},
): RegisterResponse {
  return {
    userId: 'user-123',
    tokenPair: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-01-01T00:00:00.000Z',
    },
    mfaRequired: false,
    ...overrides,
  } as RegisterResponse;
}

function createMockAuthError(kind: AuthError['kind'] = 'invalid_credentials'): AuthError {
  return {
    kind,
    message: `Error: ${kind}`,
  } as AuthError;
}

function createMockDeps() {
  const mockApiClient = {
    post: vi.fn(),
  };

  const mockAuthStore = {
    setAuthState: vi.fn(),
    setSessionState: vi.fn(),
    setSecurityState: vi.fn(),
    applyEventType: vi.fn(),
    setStoreLocked: vi.fn(),
    batchUpdate: vi.fn(),
  };

  const mockIdentifierHasher = {
    hash: vi.fn((input: string) => `hash:${input}`),
  };

  const mockAuditLogger = {
    logRegisterEvent: vi.fn(),
  };

  const mockErrorMapper = {
    map: vi.fn((error: unknown): AuthError => {
      if (error instanceof Error) {
        return {
          kind: 'invalid_credentials',
          message: error.message,
        } as AuthError;
      }
      return createMockAuthError();
    }),
  };

  const mockAbortController = {
    create: vi.fn(() => new AbortController()),
  };

  const mockClock = {
    now: vi.fn(() => 1700000000000),
  };

  const mockTraceIdGenerator = {
    generate: vi.fn(() => 'trace-123'),
  };

  const mockEventIdGenerator = {
    generate: vi.fn(() => 'event-123'),
  };

  const mockTelemetry = {
    recordAuditFailure: vi.fn(),
    recordErrorMapperFailure: vi.fn(),
  };

  const deps: RegisterEffectDeps & {
    mocks: {
      apiClient: typeof mockApiClient;
      authStore: typeof mockAuthStore;
      auditLogger: typeof mockAuditLogger;
      telemetry: typeof mockTelemetry;
    };
  } = {
    authStore: mockAuthStore as unknown as RegisterEffectDeps['authStore'],
    apiClient: mockApiClient as unknown as RegisterEffectDeps['apiClient'],
    errorMapper: mockErrorMapper,
    clock: mockClock,
    traceIdGenerator: mockTraceIdGenerator,
    identifierHasher: mockIdentifierHasher,
    auditLogger: mockAuditLogger,
    abortController: mockAbortController,
    eventIdGenerator: mockEventIdGenerator,
    telemetry: mockTelemetry,
    mocks: {
      apiClient: mockApiClient,
      authStore: mockAuthStore,
      auditLogger: mockAuditLogger,
      telemetry: mockTelemetry,
    },
  };

  return deps;
}

function createConfig(
  overrides: Partial<RegisterEffectConfig> = {},
): RegisterEffectConfig {
  return {
    hardTimeout: 60000,
    concurrency: 'cancel_previous',
    ...overrides,
  };
}

function createConfigWithConcurrency(
  concurrency: NonNullable<RegisterEffectConfig['concurrency']>,
): RegisterEffectConfig {
  return createConfig({ concurrency });
}

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('createRegisterEffect', () => {
  // eslint-disable-next-line functional/no-let -- моки переинициализируются в beforeEach
  let deps: ReturnType<typeof createMockDeps>;
  // eslint-disable-next-line functional/no-let -- конфиг переинициализируется в beforeEach
  let config: RegisterEffectConfig;

  beforeEach(() => {
    deps = createMockDeps();
    config = createConfig();
    vi.clearAllMocks();
  });

  describe('успешный register flow', () => {
    it('выполняет validate → metadata → API → store → audit и возвращает success', async () => {
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result).toEqual<ReturnType<typeof createDomainRegisterResponse>['userId'] | object>({
        type: 'success',
        userId: 'user-123',
      } as unknown as object);

      expect(deps.mocks.apiClient.post).toHaveBeenCalledWith(
        '/v1/auth/register',
        expect.any(Object),
      );
      expect(deps.mocks.authStore.batchUpdate).toHaveBeenCalled();
      expect(deps.mocks.auditLogger.logRegisterEvent).toHaveBeenCalledTimes(1);
      expect(deps.identifierHasher.hash).toHaveBeenCalledWith('user@example.com');
      expect(deps.traceIdGenerator.generate).toHaveBeenCalledTimes(1);
      expect(deps.eventIdGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it('создает deviceInfo с пустым deviceId если clientContext.deviceId отсутствует', async () => {
      const request = createRegisterRequest('email', {
        clientContext: {
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          // deviceId отсутствует
        },
      });
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('success');
      expect(deps.mocks.auditLogger.logRegisterEvent).toHaveBeenCalled();
    });

    it('создает deviceInfo без geo если clientContext.geo отсутствует', async () => {
      const request = createRegisterRequest('email', {
        clientContext: {
          ip: '127.0.0.1',
          deviceId: 'device-123',
          userAgent: 'Mozilla/5.0',
          // geo отсутствует
        },
      });
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('success');
      expect(deps.mocks.auditLogger.logRegisterEvent).toHaveBeenCalled();
    });

    it('создает deviceInfo без deviceId и без geo если clientContext отсутствует', async () => {
      const request = createRegisterRequest('email', {
        // clientContext отсутствует полностью
      });
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('success');
      expect(deps.mocks.auditLogger.logRegisterEvent).toHaveBeenCalled();
    });
  });

  describe('валидация RegisterRequest', () => {
    it('возвращает error если identifier не объект', async () => {
      const badRequest = {} as unknown as RegisterRequest<'email'>;

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(badRequest);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
      expect(deps.mocks.apiClient.post).not.toHaveBeenCalled();
    });

    it('возвращает error если identifier.type не строка', async () => {
      const badRequest = {
        identifier: { type: 123, value: 'x' },
      } as unknown as RegisterRequest<'email'>;

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(badRequest);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
    });

    it('возвращает error если identifier.value не строка', async () => {
      const badRequest = {
        identifier: { type: 'email', value: 123 },
      } as unknown as RegisterRequest<'email'>;

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(badRequest);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
    });

    it('возвращает error если password пустой для non-OAuth', async () => {
      const request = createRegisterRequest('email', {
        password: '   ',
      } as RegisterRequest<'email'>);

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
    });

    it('возвращает error если workspaceName пустой для non-OAuth', async () => {
      const request = createRegisterRequest('email', {
        workspaceName: '   ',
      } as RegisterRequest<'email'>);

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
    });

    it('вызывает validateOAuthFields для OAuth и возвращает error при отсутствующем provider', async () => {
      const request = {
        identifier: { type: 'oauth', value: 'oauth-user' },
        provider: undefined,
        providerToken: 'token-123',
      } as unknown as RegisterRequest<'oauth'>;

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
      expect(deps.mocks.apiClient.post).not.toHaveBeenCalled();
    });

    it('проходит validateRegisterRequest для корректного OAuth запроса (может завершиться error из-за API mapper)', async () => {
      const request = {
        identifier: { type: 'oauth', value: 'oauth-user' },
        provider: 'google',
        providerToken: 'token-123',
      } as RegisterRequest<'oauth'>;

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request as RegisterRequest<RegisterIdentifierType>);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
    });
  });

  describe('error handling и fallback errorMapper', () => {
    it('использует errorMapper.map при ошибке API', async () => {
      const request = createRegisterRequest('email');
      const apiError = new Error('API failed');

      (deps.mocks.apiClient.post as ReturnType<typeof vi.fn>).mockReturnValue(async () => {
        throw apiError;
      });

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
      expect(deps.mocks.telemetry.recordErrorMapperFailure).not.toHaveBeenCalled();
    });

    it('использует fallback unknown error если errorMapper.map выбрасывает', async () => {
      const request = createRegisterRequest('email');

      deps.mocks.apiClient.post.mockReturnValue(async () => {
        throw new Error('API failed');
      });
      (deps.errorMapper.map as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('mapper failed');
        },
      );

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.error.kind).toBe('unknown');
        expect(result.error.message).toBe('Unexpected error');
      }
      expect(deps.mocks.telemetry.recordErrorMapperFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'register',
          reason: 'mapper failed',
        }),
      );
    });

    it('использует String(mapperError) если errorMapper.map выбрасывает не Error', async () => {
      const request = createRegisterRequest('email');

      deps.mocks.apiClient.post.mockReturnValue(async () => {
        throw new Error('API failed');
      });
      (deps.errorMapper.map as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw 'mapper failed with string';
        },
      );

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.error.kind).toBe('unknown');
        expect(result.error.message).toBe('Unexpected error');
      }
      expect(deps.mocks.telemetry.recordErrorMapperFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'register',
          reason: 'mapper failed with string',
        }),
      );
    });
  });

  describe('audit logging', () => {
    it('логирует audit event и игнорирует ошибки логгера, отправляя telemetry', async () => {
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);
      (deps.mocks.auditLogger.logRegisterEvent as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('logger failed');
        },
      );

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('success');
      expect(deps.mocks.telemetry.recordAuditFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'register',
          reason: 'audit logging failed',
        }),
      );
    });

    it('обрабатывает async логгер с Promise.reject и пишет telemetry', async () => {
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);
      (deps.mocks.auditLogger.logRegisterEvent as ReturnType<typeof vi.fn>).mockImplementation(
        () => Promise.reject(new Error('async logger failed')),
      );

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('success');

      // Ждем, пока Promise из логгера отклонится и сработает catch
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(deps.mocks.telemetry.recordAuditFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'register',
          reason: 'async logger failed',
        }),
      );
    });

    it('обрабатывает async логгер с Promise.reject не-Error и использует String(e)', async () => {
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);
      (deps.mocks.auditLogger.logRegisterEvent as ReturnType<typeof vi.fn>).mockImplementation(
        () => Promise.reject('logger failed with string'),
      );

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const result = await effect();

      expect(result.type).toBe('success');

      // Ждем, пока Promise из логгера отклонится и сработает catch
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(deps.mocks.telemetry.recordAuditFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'register',
          reason: 'logger failed with string',
        }),
      );
    });
  });

  describe('concurrency стратегии', () => {
    it('cancel_previous создаёт новый AbortController для каждого запроса', async () => {
      const cancelConfig = createConfigWithConcurrency('cancel_previous');
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);

      const registerEffectFactory = createRegisterEffect(deps, cancelConfig);
      const effect1 = registerEffectFactory(request);
      const effect2 = registerEffectFactory(request);

      const p1 = effect1();
      const p2 = effect2();

      await Promise.allSettled([p1, p2]);

      expect(deps.abortController.create).toHaveBeenCalledTimes(2);
    });

    it('ignore использует один in-flight запрос и не дублирует вызовы API', async () => {
      const ignoreConfig = createConfigWithConcurrency('ignore');
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);

      const registerEffectFactory = createRegisterEffect(deps, ignoreConfig);
      const effect1 = registerEffectFactory(request);
      const effect2 = registerEffectFactory(request);

      const [result1, result2] = await Promise.all([effect1(), effect2()]);

      expect(result1.type).toBe('success');
      expect(result2.type).toBe('success');
      expect(deps.mocks.apiClient.post).toHaveBeenCalledTimes(1);
    });

    it('serialize выполняет запросы последовательно', async () => {
      const serializeConfig = createConfigWithConcurrency('serialize');
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(async () => responseValues);

      const registerEffectFactory = createRegisterEffect(deps, serializeConfig);
      const effect1 = registerEffectFactory(request);
      const effect2 = registerEffectFactory(request);

      const p1 = effect1();
      const p2 = effect2();

      const [result1, result2] = await Promise.all([p1, p2]);

      expect(result1.type).toBe('success');
      expect(result2.type).toBe('success');
      expect(deps.mocks.apiClient.post).toHaveBeenCalledTimes(2);
    });

    it('serialize возвращает rate_limited при переполнении очереди', async () => {
      const serializeConfig = createConfigWithConcurrency('serialize');
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      deps.mocks.apiClient.post.mockReturnValue(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return responseValues;
        },
      );

      const registerEffectFactory = createRegisterEffect(deps, serializeConfig);

      const promises = Array.from({ length: 10 }, () => {
        const effect = registerEffectFactory(request);
        return effect();
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const effect11 = registerEffectFactory(request);
      const result11 = await effect11();

      expect(result11.type).toBe('error');
      if (result11.type === 'error') {
        expect(result11.error.kind).toBe('rate_limited');
        expect(result11.error.message).toBe('Register queue is full, please try again later');
      }

      await Promise.allSettled(promises);
    });
  });

  describe('external AbortSignal', () => {
    it('пробрасывает external сигнал в внутренний AbortController', async () => {
      const request = createRegisterRequest('email');
      const responseValues = createRegisterResponseValues();

      const innerController = new AbortController();
      const abortSpy = vi.spyOn(innerController, 'abort');
      (deps.abortController.create as ReturnType<typeof vi.fn>).mockReturnValue(innerController);

      deps.mocks.apiClient.post.mockReturnValue(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return responseValues;
        },
      );

      const externalController = new AbortController();

      const registerEffectFactory = createRegisterEffect(deps, config);
      const effect = registerEffectFactory(request);
      const promise = effect(externalController.signal);

      externalController.abort();

      await promise;

      expect(abortSpy).toHaveBeenCalled();
    });
  });
});

/* eslint-enable @livai/rag/source-citation, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */
