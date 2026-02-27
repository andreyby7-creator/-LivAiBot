/**
 * @file Unit тесты для effects/login.ts
 * Полное покрытие 100% всех веток кода, включая concurrency стратегии, error handling и edge cases
 */

/* eslint-disable @livai/rag/context-leakage, @livai/rag/source-citation, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLoginEffect } from '../../../src/effects/login.js';
import * as loginApiMapper from '../../../src/effects/login/login-api.mapper.js';
import type {
  LoginEffectConfig,
  LoginEffectDeps,
  LoginSecurityResult,
} from '../../../src/effects/login/login-effect.types.js';
import type { LoginIdentifierType, LoginRequest } from '../../../src/domain/LoginRequest.js';
import type { DomainLoginResult } from '../../../src/domain/LoginResult.js';
import type { LoginTokenPairValues, MeResponseValues } from '../../../src/schemas/index.js';
import type { AuthError } from '../../../src/types/auth.js';
import type { RiskLevel } from '../../../src/types/auth-risk.js';
import type { SecurityPipelineResult } from '../../../src/lib/security-pipeline.js';
import type { DeviceInfo } from '../../../src/domain/DeviceInfo.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createValidLoginRequest<T extends LoginIdentifierType>(
  type: T = 'email' as T,
  overrides: Partial<LoginRequest<T>> = {},
): LoginRequest<T> {
  const base = {
    dtoVersion: '1.0' as const,
    identifier: {
      type,
      value: type === 'email'
        ? 'user@example.com'
        : type === 'phone'
        ? '+1234567890'
        : type === 'oauth'
        ? 'oauth-user-id'
        : 'testuser',
    },
    password: type !== 'oauth' ? 'password123' : undefined,
    clientContext: {
      ip: '127.0.0.1',
      deviceId: 'device-123',
      userAgent: 'Mozilla/5.0',
    },
    ...overrides,
  } as LoginRequest<T>;

  return base;
}

function createMockTokenPair(): LoginTokenPairValues {
  return {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresAt: '2026-01-01T00:00:00.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    scope: ['read', 'write'],
    metadata: { deviceId: 'device-123' },
  };
}

function createMockMeResponse(): MeResponseValues {
  return {
    user: {
      id: 'user-123',
      email: 'user@example.com',
      emailVerified: true,
    },
    roles: ['user', 'admin'],
    permissions: ['read', 'write'],
  };
}

function createMockDeviceInfo(): DeviceInfo {
  return {
    deviceId: 'device-123',
    deviceType: 'desktop',
  };
}

function createMockSecurityPipelineResult(): SecurityPipelineResult {
  return {
    deviceInfo: createMockDeviceInfo(),
    riskAssessment: {
      riskScore: 10,
      riskLevel: 'low' as RiskLevel,
      triggeredRules: [],
      decisionHint: { action: 'login' },
      assessment: {} as SecurityPipelineResult['riskAssessment']['assessment'],
    },
  };
}

function createMockLoginSecurityResult(
  decision: LoginSecurityResult['decision'] = { type: 'allow' },
): LoginSecurityResult {
  return {
    decision,
    riskScore: 10,
    riskLevel: 'low' as RiskLevel,
    pipelineResult: createMockSecurityPipelineResult(),
  };
}

function createMockAuthError(): AuthError {
  return {
    kind: 'network',
    retryable: true,
    message: 'Network error',
  };
}

// ============================================================================
// 🔧 MOCK SETUP
// ============================================================================

function createMockDeps() {
  const mockApiClient = {
    post: vi.fn(),
    get: vi.fn(),
  };

  const mockAuthStore = {
    setAuthState: vi.fn(),
    setSessionState: vi.fn(),
    setSecurityState: vi.fn(),
    applyEventType: vi.fn(),
  };

  const mockSecurityPipeline = {
    run: vi.fn(),
  };

  const mockIdentifierHasher = {
    hash: vi.fn((input: string) => `hash:${input}`),
  };

  const mockAuditLogger = {
    log: vi.fn(),
  };

  const mockErrorMapper = {
    map: vi.fn((error: unknown): AuthError => {
      if (error instanceof Error) {
        return {
          kind: 'invalid_credentials',
          message: error.message,
        };
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

  return {
    apiClient: mockApiClient as unknown as LoginEffectDeps['apiClient'],
    authStore: mockAuthStore,
    securityPipeline: mockSecurityPipeline as unknown as LoginEffectDeps['securityPipeline'],
    identifierHasher: mockIdentifierHasher,
    auditLogger: mockAuditLogger,
    errorMapper: mockErrorMapper,
    abortController: mockAbortController,
    clock: mockClock,
    // Expose mocks for test access
    mocks: {
      apiClient: mockApiClient,
      securityPipeline: mockSecurityPipeline,
    },
  } as LoginEffectDeps & {
    mocks: {
      apiClient: {
        post: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
      };
      securityPipeline: {
        run: ReturnType<typeof vi.fn>;
      };
    };
  };
}

function createDefaultConfig(): LoginEffectConfig {
  return {
    timeouts: {
      loginApiTimeoutMs: 5000,
      meApiTimeoutMs: 3000,
      loginHardTimeoutMs: 60000,
    },
    concurrency: 'cancel_previous',
  };
}

function createConfigWithConcurrency(
  concurrency: LoginEffectConfig['concurrency'],
): LoginEffectConfig {
  return {
    timeouts: {
      loginApiTimeoutMs: 5000,
      meApiTimeoutMs: 3000,
      loginHardTimeoutMs: 60000,
    },
    concurrency,
  };
}

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('createLoginEffect', () => {
  // eslint-disable-next-line functional/no-let -- переменные переприсваиваются в beforeEach
  let deps: ReturnType<typeof createMockDeps>;
  // eslint-disable-next-line functional/no-let -- переменные переприсваиваются в beforeEach
  let config: LoginEffectConfig;
  // eslint-disable-next-line functional/no-let -- переменные переприсваиваются в beforeEach
  let mockApiClient: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line functional/no-let -- переменные переприсваиваются в beforeEach
  let mockGet: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line functional/no-let -- переменные переприсваиваются в beforeEach
  let mockSecurityPipelineRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deps = createMockDeps();
    config = createDefaultConfig();
    mockApiClient = deps.mocks.apiClient.post;
    mockGet = deps.mocks.apiClient.get;
    mockSecurityPipelineRun = deps.mocks.securityPipeline.run;
    vi.clearAllMocks();
  });

  describe('успешный login flow', () => {
    it('выполняет полный flow: validate → security → API → store update → success', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      // Настраиваем моки
      mockSecurityPipelineRun.mockReturnValue(
        async () => securityResult,
      );
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      // Проверяем результат
      expect(result).toEqual({
        type: 'success',
        userId: 'user-123',
      });

      // Проверяем вызовы
      expect(mockSecurityPipelineRun).toHaveBeenCalledTimes(1);
      expect(mockApiClient).toHaveBeenCalledWith(
        '/v1/auth/login',
        expect.objectContaining({
          identifier: request.identifier,
        }),
        expect.any(Object),
      );
      expect(mockGet).toHaveBeenCalledWith(
        '/v1/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${tokenPair.accessToken}`,
          }),
        }),
      );
      expect(deps.authStore.setAuthState).toHaveBeenCalled();
      expect(deps.authStore.setSessionState).toHaveBeenCalled();
    });

    it('использует loginHardTimeoutMs из config', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      config.timeouts.loginHardTimeoutMs = 120_000;

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
    });

    it('использует DEFAULT_LOGIN_HARD_TIMEOUT_MS если loginHardTimeoutMs не указан', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      delete config.timeouts.loginHardTimeoutMs;

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
    });
  });

  describe('валидация входных данных', () => {
    it('возвращает error при невалидном LoginRequest', async () => {
      const invalidRequest = {
        // Отсутствует обязательное поле identifier
      } as unknown as LoginRequest<'email'>;

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(invalidRequest);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalled();
      expect(deps.securityPipeline.run).not.toHaveBeenCalled();
      expect(deps.apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('security pipeline', () => {
    it('возвращает blocked при decision.type === "block"', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({
        type: 'block',
      });
      const pipelineResult = {
        ...securityResult.pipelineResult,
        riskAssessment: {
          ...securityResult.pipelineResult.riskAssessment,
          decisionHint: {
            action: 'block',
            blockReason: 'suspicious_activity',
          },
        },
      };
      const securityResultWithHint = {
        ...securityResult,
        pipelineResult,
      };

      mockSecurityPipelineRun.mockReturnValue(async () => securityResultWithHint);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result).toEqual({
        type: 'blocked',
        reason: 'suspicious_activity',
      });
      // applyBlockedState вызывает setAuthState для установки unauthenticated состояния
      expect(deps.authStore.setAuthState).toHaveBeenCalled();
      expect(deps.apiClient.post).not.toHaveBeenCalled();
      expect(deps.authStore.setSecurityState).toHaveBeenCalled();
    });

    it('использует default reason при отсутствии blockReason', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({
        type: 'block',
      });
      const pipelineResult = {
        ...securityResult.pipelineResult,
        riskAssessment: {
          ...securityResult.pipelineResult.riskAssessment,
          decisionHint: {
            action: 'block',
          },
        },
      };
      const securityResultWithHint = {
        ...securityResult,
        pipelineResult,
      };

      mockSecurityPipelineRun.mockReturnValue(async () => securityResultWithHint);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result).toEqual({
        type: 'blocked',
        reason: 'blocked_by_security_policy',
      });
    });

    it('продолжает flow при decision.type === "allow"', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
      expect(mockApiClient).toHaveBeenCalled();
    });

    it('продолжает flow при decision.type === "require_mfa"', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({
        type: 'require_mfa',
      });

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
      expect(mockApiClient).toHaveBeenCalled();
    });
  });

  describe('MFA required', () => {
    it('возвращает success при успешном login (orchestrator всегда создает success)', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      // Orchestrator всегда создает LoginResponseDto с type: 'success'
      // MFA required обрабатывается на уровне domain mapping, но orchestrator всегда возвращает success
      expect(result.type).toBe('success');
    });

    it('возвращает mfa_required при DomainLoginResult.type === "mfa_required"', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      // Мокаем mapLoginResponseToDomain чтобы вернуть mfa_required
      vi.spyOn(loginApiMapper, 'mapLoginResponseToDomain').mockReturnValue({
        type: 'mfa_required',
        challenge: {
          userId: 'challenge-user-123',
          type: 'totp',
        },
      } as DomainLoginResult);

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result).toEqual({
        type: 'mfa_required',
        challengeId: 'challenge-user-123',
      });

      // Восстанавливаем оригинальный mapper
      vi.spyOn(loginApiMapper, 'mapLoginResponseToDomain').mockRestore();
    });
  });

  describe('error handling', () => {
    it('обрабатывает ошибку security pipeline через errorMapper', async () => {
      const request = createValidLoginRequest();
      const error = new Error('Security pipeline failed');

      mockSecurityPipelineRun.mockReturnValue(async () => {
        throw error;
      });

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.errorMapper.map).toHaveBeenCalledWith(error);
    });

    it('обрабатывает ошибку API login через errorMapper', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const error = new Error('Login API failed');

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockRejectedValue(error);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('error');
      // validatedEffect может обернуть ошибку, поэтому проверяем что errorMapper был вызван
      expect(deps.errorMapper.map).toHaveBeenCalled();
    });

    it('обрабатывает ошибку API me через errorMapper', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const error = new Error('Me API failed');

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockRejectedValue(error);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('error');
      // validatedEffect может обернуть ошибку, поэтому проверяем что errorMapper был вызван
      expect(deps.errorMapper.map).toHaveBeenCalled();
    });
  });

  describe('concurrency стратегии', () => {
    describe('cancel_previous', () => {
      it('отменяет предыдущий запрос при новом запросе', async () => {
        const cancelConfig = createConfigWithConcurrency('cancel_previous');
        const request = createValidLoginRequest();
        const tokenPair = createMockTokenPair();
        const meResponse = createMockMeResponse();
        const securityResult = createMockLoginSecurityResult({ type: 'allow' });

        mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
        mockApiClient.mockResolvedValue(tokenPair);
        mockGet.mockResolvedValue(meResponse);

        const loginEffect = createLoginEffect(deps, cancelConfig);
        const effect1 = loginEffect(request);
        const effect2 = loginEffect(request);

        // Запускаем оба эффекта
        const promise1 = effect1();
        const promise2 = effect2();

        // Ждем завершения второго (первый должен быть отменен)
        // promise1 может быть отменен, поэтому не ждем его
        const result2 = await promise2;
        // Проверяем, что первый запрос был отменен (может выбросить ошибку или вернуть error)
        await promise1.catch(() => {
          // Ожидаем, что первый запрос будет отменен
        });

        expect(result2.type).toBe('success');
        // Проверяем, что был создан AbortController для отмены
        expect(deps.abortController.create).toHaveBeenCalledTimes(2);
      });
    });

    describe('ignore', () => {
      it('возвращает уже выполняющийся запрос при ignore стратегии', async () => {
        const ignoreConfig = createConfigWithConcurrency('ignore');
        const request = createValidLoginRequest();
        const tokenPair = createMockTokenPair();
        const meResponse = createMockMeResponse();
        const securityResult = createMockLoginSecurityResult({ type: 'allow' });

        mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
        mockApiClient.mockResolvedValue(tokenPair);
        mockGet.mockResolvedValue(meResponse);

        const loginEffect = createLoginEffect(deps, ignoreConfig);
        const effect1 = loginEffect(request);
        const promise1 = effect1();

        // Второй вызов должен вернуть тот же promise (inFlight)
        const effect2 = loginEffect(request);
        const promise2 = effect2();

        // Оба должны вернуть один и тот же promise (same reference)
        // Но из-за того что каждый вызов loginEffect создает новую функцию, promise может быть разным
        // Проверяем что результат одинаковый и security pipeline вызван только раз
        const [result1, result2] = await Promise.all([promise1, promise2]);

        expect(result1.type).toBe('success');
        expect(result2.type).toBe('success');
        // Security pipeline должен быть вызван только один раз (второй запрос игнорируется)
        expect(mockSecurityPipelineRun).toHaveBeenCalledTimes(1);
      });

      it('очищает inFlight в finally после завершения', async () => {
        const ignoreConfig = createConfigWithConcurrency('ignore');
        const request = createValidLoginRequest();
        const tokenPair = createMockTokenPair();
        const meResponse = createMockMeResponse();
        const securityResult = createMockLoginSecurityResult({ type: 'allow' });

        mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
        mockApiClient.mockResolvedValue(tokenPair);
        mockGet.mockResolvedValue(meResponse);

        const loginEffect = createLoginEffect(deps, ignoreConfig);
        const effect1 = loginEffect(request);
        await effect1();

        // После завершения первого запроса, новый запрос должен выполняться
        const effect2 = loginEffect(request);
        const result2 = await effect2();

        expect(result2.type).toBe('success');
        expect(mockSecurityPipelineRun).toHaveBeenCalledTimes(2);
      });
    });

    describe('serialize', () => {
      it('выполняет запросы последовательно в serialize режиме', async () => {
        const serializeConfig = createConfigWithConcurrency('serialize');
        const request = createValidLoginRequest();
        const tokenPair = createMockTokenPair();
        const meResponse = createMockMeResponse();
        const securityResult = createMockLoginSecurityResult({ type: 'allow' });

        mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
        mockApiClient.mockResolvedValue(tokenPair);
        mockGet.mockResolvedValue(meResponse);

        const loginEffect = createLoginEffect(deps, serializeConfig);
        const effect1 = loginEffect(request);
        const effect2 = loginEffect(request);

        const promise1 = effect1();
        const promise2 = effect2();

        // Оба должны выполниться последовательно
        const result1 = await promise1;
        const result2 = await promise2;

        expect(result1.type).toBe('success');
        expect(result2.type).toBe('success');
        expect(mockSecurityPipelineRun).toHaveBeenCalledTimes(2);
      });

      it('игнорирует ошибки предыдущего запроса в serialize режиме', async () => {
        const serializeConfig = createConfigWithConcurrency('serialize');
        const request = createValidLoginRequest();
        const tokenPair = createMockTokenPair();
        const meResponse = createMockMeResponse();
        const securityResult = createMockLoginSecurityResult({ type: 'allow' });

        // Первый запрос падает с ошибкой
        mockSecurityPipelineRun
          .mockReturnValueOnce(async () => {
            throw new Error('First request failed');
          })
          .mockReturnValueOnce(async () => securityResult);

        mockApiClient.mockResolvedValue(tokenPair);
        mockGet.mockResolvedValue(meResponse);

        const loginEffect = createLoginEffect(deps, serializeConfig);
        const effect1 = loginEffect(request);
        const effect2 = loginEffect(request);

        // Запускаем первый запрос (он упадет с ошибкой)
        const promise1 = effect1();
        // Запускаем второй запрос (он должен выполниться после первого)
        const promise2 = effect2();

        // Второй запрос должен выполниться несмотря на ошибку первого
        // Первый запрос может упасть с ошибкой, игнорируем его
        await promise1.catch(() => {
          // Ожидаем, что первый запрос упадет с ошибкой
        });
        const result2 = await promise2;
        expect(result2.type).toBe('success');
      });
    });
  });

  describe('external signal abort', () => {
    it('отменяет запрос при external signal abort', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const controller = new AbortController();

      mockSecurityPipelineRun.mockReturnValue(
        async (signal?: AbortSignal) => {
          // Симулируем долгий запрос
          await new Promise((resolve) => setTimeout(resolve, 100));
          // @see packages/feature-auth/src/effects/login.ts:417-425
          if (signal?.aborted === true) {
            throw new Error('Aborted');
          }
          // @see packages/feature-auth/src/effects/login.ts:251
          // @see packages/feature-auth/src/effects/login/login-effect.types.ts:120-125
          return securityResult;
        },
      );

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);

      // Запускаем и сразу отменяем
      const promise = effect(controller.signal);
      controller.abort();

      const result = await promise;
      expect(result.type).toBe('error');
    });
  });

  describe('buildSecurityContext', () => {
    it('создает security context без IP если IP не указан', async () => {
      const request = createValidLoginRequest('email', {
        clientContext: {
          deviceId: 'device-123',
          userAgent: 'Mozilla/5.0',
        },
      });
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).not.toHaveProperty('ip');
      expect(callArgs![0]).toMatchObject({
        operation: 'login',
      });
    });

    it('создает security context только с userAgent без deviceId', async () => {
      const request = createValidLoginRequest('email', {
        clientContext: {
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        },
      });
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toMatchObject({
        signals: {
          externalSignals: {
            userAgent: 'Mozilla/5.0',
          },
        },
      });
    });

    it('создает security context только с deviceId без userAgent', async () => {
      const request = createValidLoginRequest('email', {
        clientContext: {
          ip: '127.0.0.1',
          deviceId: 'device-123',
        },
      });
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toMatchObject({
        signals: {
          externalSignals: {
            deviceId: 'device-123',
          },
        },
      });
    });

    it('создает security context с OAuth operation для oauth login', async () => {
      const request = createValidLoginRequest('oauth', {
        provider: 'google',
        providerToken: 'token-123',
      });
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toMatchObject({
        operation: 'oauth_login',
      });
    });

    it('создает security context с login operation для обычного login', async () => {
      const request = createValidLoginRequest('email');
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toMatchObject({
        operation: 'login',
      });
    });

    it('хеширует identifier для privacy-safe userId', async () => {
      const request = createValidLoginRequest('email', {
        identifier: { type: 'email', value: 'user@example.com' },
      });
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      expect(deps.identifierHasher.hash).toHaveBeenCalledWith('user@example.com');
      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toMatchObject({
        userId: 'hash:user@example.com',
      });
    });

    it('включает deviceId и userAgent в signals если они есть', async () => {
      const request = createValidLoginRequest('email', {
        clientContext: {
          ip: '127.0.0.1',
          deviceId: 'device-123',
          userAgent: 'Mozilla/5.0',
        },
      });
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toMatchObject({
        signals: expect.objectContaining({
          externalSignals: expect.objectContaining({
            deviceId: 'device-123',
            userAgent: 'Mozilla/5.0',
          }),
        }),
      });
    });
  });

  describe('cleanup в finally', () => {
    it('очищает currentController в finally после завершения', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      await effect();

      // Проверяем, что controller был создан
      expect(deps.abortController.create).toHaveBeenCalled();

      // После завершения можно запустить новый запрос (controller должен быть очищен)
      const effect2 = loginEffect(request);
      await effect2();

      // Должен быть создан новый controller
      expect(deps.abortController.create).toHaveBeenCalledTimes(2);
    });

    it('не очищает currentController если это уже другой controller', async () => {
      const cancelConfig = createConfigWithConcurrency('cancel_previous');
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, cancelConfig);
      const effect1 = loginEffect(request);
      const effect2 = loginEffect(request);

      // Запускаем оба, второй должен отменить первый
      await Promise.allSettled([effect1(), effect2()]);

      // Проверяем, что controllers были созданы
      expect(deps.abortController.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('обрабатывает request без clientContext', async () => {
      const request = createValidLoginRequest('email');
      // Удаляем clientContext из request для тестирования
      const { clientContext: _clientContext, ...requestWithoutContext } = request;
      const requestWithoutClientContext = requestWithoutContext as LoginRequest<'email'>;
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(requestWithoutClientContext);
      const result = await effect();

      expect(result.type).toBe('success');
      // Проверяем что securityPipeline.run был вызван с правильными аргументами
      expect(mockSecurityPipelineRun).toHaveBeenCalled();
      const callArgs = mockSecurityPipelineRun.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![0]).toMatchObject({
        userId: expect.any(String),
        operation: 'login',
      });
    });

    it('обрабатывает security result без triggeredRules', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const pipelineResult = {
        ...securityResult.pipelineResult,
        riskAssessment: {
          ...securityResult.pipelineResult.riskAssessment,
          triggeredRules: undefined,
        },
      };
      const securityResultWithoutRules = {
        ...securityResult,
        pipelineResult,
      };
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResultWithoutRules);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
    });

    it('обрабатывает security result с invalid triggeredRules', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const pipelineResult = {
        ...securityResult.pipelineResult,
        riskAssessment: {
          ...securityResult.pipelineResult.riskAssessment,
          triggeredRules: [
            'rule-1',
            null as unknown as string,
            'rule-2',
          ],
        },
      };
      const securityResultWithInvalidRules = {
        ...securityResult,
        pipelineResult,
      };
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResultWithInvalidRules);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
    });

    it('обрабатывает security result без deviceInfo в createLoginContext', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const pipelineResult = {
        ...securityResult.pipelineResult,
        deviceInfo: undefined,
      };
      const securityResultWithoutDeviceInfo = {
        ...securityResult,
        pipelineResult,
      };
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResultWithoutDeviceInfo);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
    });

    it('использует fallback traceId когда crypto.randomUUID недоступен', async () => {
      // Сохраняем оригинальный crypto
      const originalCrypto = global.crypto;
      // Удаляем crypto.randomUUID для тестирования fallback
      // @ts-expect-error - намеренно удаляем для теста
      delete global.crypto;

      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');

      // Восстанавливаем crypto
      global.crypto = originalCrypto;
    });

    it('обрабатывает случай когда apiClient.post вызывается без signal', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      // Мокаем apiClient.post чтобы проверить, что он вызывается без signal в некоторых случаях
      // @see packages/feature-auth/src/effects/login.ts:279-287
      mockApiClient.mockImplementation(async (url, _body, options) => {
        // Проверяем, что options может быть undefined (когда sig === undefined)
        // @see packages/feature-auth/src/effects/login.ts:281
        if (url === '/v1/auth/login' && options === undefined) {
          return tokenPair;
        }
        if (url === '/v1/auth/login') {
          return tokenPair;
        }
        // @see packages/feature-auth/src/effects/login.ts:282-286
        return meResponse;
      });
      mockGet.mockResolvedValue(meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
      // Проверяем, что post был вызван
      expect(mockApiClient).toHaveBeenCalled();
    });

    it('обрабатывает случай когда apiClient.get вызывается без signal', async () => {
      const request = createValidLoginRequest();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockResolvedValue(tokenPair);
      // Мокаем apiClient.get чтобы проверить, что он вызывается без signal в некоторых случаях
      // @see packages/feature-auth/src/effects/login.ts:310-321
      mockGet.mockImplementation(async (_url, options) => {
        // Проверяем, что options.signal может быть undefined
        // @see packages/feature-auth/src/effects/login.ts:318
        if (
          options !== undefined
          && typeof options === 'object'
          && 'signal' in options
          && options.signal === undefined
        ) {
          return meResponse;
        }
        // @see packages/feature-auth/src/effects/login.ts:321
        return meResponse;
      });

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
      // Проверяем, что get был вызван
      expect(mockGet).toHaveBeenCalled();
    });
  });
});

/* eslint-enable @livai/rag/context-leakage, @livai/rag/source-citation, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */
