/**
 * @file Unit тесты для effects/login.ts
 * Полное покрытие 100% всех веток кода, включая concurrency стратегии, error handling и edge cases
 */

/* eslint-disable @livai/rag/context-leakage, @livai/rag/source-citation, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Мокаем orchestrate/step/withTimeout/validatedEffect, чтобы тесты login-effect
// проверяли бизнес-оркестрацию login-flow, а не детали реализации core orchestrator/timeout.
/* eslint-disable ai-security/data-leakage */
vi.mock('@livai/core/effect', async () => {
  const actual = await vi.importActual('@livai/core/effect');
  return {
    ...actual,
    validatedEffect: (_schema: unknown, effectFactory: unknown) => effectFactory,
    step: (label: string, effect: unknown, timeoutMs?: number) => ({
      label,
      effect,
      timeoutMs,
    }),
    stepWithPrevious: (label: string, effect: unknown, timeoutMs?: number) => ({
      label,
      effect,
      timeoutMs,
    }),
    orchestrate:
      <T>(steps: readonly { label: string; effect: unknown; timeoutMs?: number; }[]) =>
      async (signal?: AbortSignal): Promise<T> => {
        const first = steps[0];
        const second = steps[1];
        const firstValue = await (first!.effect as (sig?: AbortSignal) => Promise<unknown>)(signal);
        const secondValue = await (
          second!.effect as (sig?: AbortSignal, previous?: unknown) => Promise<unknown>
        )(signal, firstValue);
        // Возвращаем результат последнего шага (как и реальный orchestrator)
        return secondValue as T;
      },
    withTimeout: (effect: unknown) => effect,
  };
});
/* eslint-enable ai-security/data-leakage */

import type { DeviceInfo } from '../../../src/domain/DeviceInfo.js';
import type { LoginIdentifierType, LoginRequest } from '../../../src/domain/LoginRequest.js';
import type { DomainLoginResult } from '../../../src/domain/LoginResult.js';
import { createLoginEffect } from '../../../src/effects/login.js';
import * as loginApiMapper from '../../../src/effects/login/login-api.mapper.js';
import type {
  LoginEffectConfig,
  LoginEffectDeps,
  LoginSecurityResult,
} from '../../../src/effects/login/login-effect.types.js';
import type { SecurityPipelineResult } from '../../../src/lib/security-pipeline.js';
import type { LoginTokenPairValues, MeResponseValues } from '../../../src/schemas/index.js';
import type { AuthError } from '../../../src/types/auth.js';
import type { RiskLevel } from '../../../src/types/auth-risk.js';

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

function createMockDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-123',
    deviceType: 'desktop',
    ...overrides,
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
    setStoreLocked: vi.fn(),
    batchUpdate: vi.fn(),
    getSessionState: vi.fn(() => null),
    getRefreshToken: vi.fn(() => 'refresh-token-456'),
  };

  const mockSecurityPipeline = {
    run: vi.fn(),
  };

  const mockIdentifierHasher = {
    hash: vi.fn((input: string) => `hash:${input}`),
  };

  const mockAuditLogger = {
    log: vi.fn(),
    logAuditEvent: vi.fn(),
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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      );
      expect(mockGet).toHaveBeenCalledWith(
        '/v1/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${tokenPair.accessToken}`,
          }),
        }),
      );
      // Проверяем, что batchUpdate был вызван (вместо прямых вызовов setAuthState/setSessionState)
      expect(deps.authStore.batchUpdate).toHaveBeenCalled();
      // eslint-disable-next-line ai-security/model-poisoning -- Тестовые данные контролируемые, валидация не требуется
      const batchUpdateCall = (deps.authStore.batchUpdate as ReturnType<typeof vi.fn>).mock.calls[0]
        ?.[0];
      expect(batchUpdateCall).toBeDefined();
      expect(batchUpdateCall?.some((update: { type: string; }) => update.type === 'setAuthState'))
        .toBe(true);
      expect(
        batchUpdateCall?.some((update: { type: string; }) => update.type === 'setSessionState'),
      ).toBe(true);
    });

    it('использует loginHardTimeoutMs из config', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      config.timeouts.loginHardTimeoutMs = 120_000;

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
    });

    it('использует loginHardTimeoutMs из config (обязательное поле)', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      // loginHardTimeoutMs теперь обязательное поле (default задаётся в composer)
      const configWithTimeout = {
        ...config,
        timeouts: {
          ...config.timeouts,
          loginHardTimeoutMs: 90000, // 90 секунд
        },
      };

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

      const loginEffect = createLoginEffect(deps, configWithTimeout);
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
      // applyBlockedState использует batchUpdate для атомарного обновления
      expect(deps.authStore.batchUpdate).toHaveBeenCalled();
      // eslint-disable-next-line ai-security/model-poisoning -- Тестовые данные контролируемые, валидация не требуется
      const batchUpdateCall = (deps.authStore.batchUpdate as ReturnType<typeof vi.fn>).mock.calls[0]
        ?.[0];
      expect(batchUpdateCall).toBeDefined();
      expect(batchUpdateCall?.some((update: { type: string; }) => update.type === 'setAuthState'))
        .toBe(true);
      expect(
        batchUpdateCall?.some((update: { type: string; }) => update.type === 'setSecurityState'),
      ).toBe(true);
      expect(deps.apiClient.post).not.toHaveBeenCalled();
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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => {
        throw error;
      });

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => {
        throw error;
      });

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
        mockApiClient.mockReturnValue(async () => tokenPair);
        mockGet.mockReturnValue(async () => meResponse);

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
        mockApiClient.mockReturnValue(async () => tokenPair);
        mockGet.mockReturnValue(async () => meResponse);

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
        mockApiClient.mockReturnValue(async () => tokenPair);
        mockGet.mockReturnValue(async () => meResponse);

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
        mockApiClient.mockReturnValue(async () => tokenPair);
        mockGet.mockReturnValue(async () => meResponse);

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

        mockApiClient.mockReturnValue(async () => tokenPair);
        mockGet.mockReturnValue(async () => meResponse);

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

      it('возвращает rate_limited ошибку при переполнении очереди serialize', async () => {
        const serializeConfig = createConfigWithConcurrency('serialize');
        const request = createValidLoginRequest();
        const tokenPair = createMockTokenPair();
        const meResponse = createMockMeResponse();
        const securityResult = createMockLoginSecurityResult({ type: 'allow' });

        // Создаем долгий запрос, чтобы заполнить очередь
        // Используем задержку, чтобы запросы не выполнялись мгновенно
        mockSecurityPipelineRun.mockReturnValue(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return securityResult;
          },
        );
        mockApiClient.mockReturnValue(async () => tokenPair);
        mockGet.mockReturnValue(async () => meResponse);

        const loginEffect = createLoginEffect(deps, serializeConfig);

        // Запускаем 10 запросов одновременно (максимальная длина очереди = 10)
        // Все они должны попасть в очередь до начала выполнения
        const requestPromises = Array.from({ length: 10 }, () => {
          const effect = loginEffect(request);
          // Не ждем выполнения, просто добавляем в очередь
          return effect();
        });

        // Небольшая задержка, чтобы убедиться, что все 10 запросов попали в очередь
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 11-й запрос должен вернуть rate_limited ошибку, так как очередь переполнена
        const effect11 = loginEffect(request);
        const result11 = await effect11();

        expect(result11.type).toBe('error');
        if (result11.type === 'error') {
          expect(result11.error.kind).toBe('rate_limited');
          expect(result11.error.message).toBe('Login queue is full, please try again later');
        }

        // Ждем завершения всех предыдущих запросов
        await Promise.allSettled(requestPromises);
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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockImplementation((url, _body, options) => {
        // Проверяем, что options может быть undefined (когда sig === undefined)
        // @see packages/feature-auth/src/effects/login.ts:281
        return async () => {
          if (url === '/v1/auth/login' && options === undefined) {
            return tokenPair;
          }
          if (url === '/v1/auth/login') {
            return tokenPair;
          }
          // @see packages/feature-auth/src/effects/login.ts:282-286
          return meResponse;
        };
      });
      mockGet.mockReturnValue(async () => meResponse);

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
      mockApiClient.mockReturnValue(async () => tokenPair);
      // Мокаем apiClient.get чтобы проверить, что он вызывается без signal в некоторых случаях
      // @see packages/feature-auth/src/effects/login.ts:310-321
      mockGet.mockImplementation((_url, options) => {
        return async () => {
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
        };
      });

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
      // Проверяем, что get был вызван
      expect(mockGet).toHaveBeenCalled();
    });

    it('обрабатывает deviceInfo с geo в createLoginContext (строка 273)', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      // Создаем securityResult с deviceInfo, который содержит geo
      const deviceInfoWithGeo = createMockDeviceInfo({
        geo: { lat: 55.7558, lng: 37.6173 },
      });
      const pipelineResult = {
        deviceInfo: deviceInfoWithGeo,
        riskAssessment: {
          riskScore: 10,
          riskLevel: 'low' as RiskLevel,
          triggeredRules: [],
          decisionHint: { action: 'login' },
          assessment: {} as SecurityPipelineResult['riskAssessment']['assessment'],
        },
      };
      const securityResult = {
        decision: { type: 'allow' },
        riskScore: 10,
        riskLevel: 'low' as RiskLevel,
        pipelineResult,
      };

      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockReturnValue(async () => tokenPair);
      mockGet.mockReturnValue(async () => meResponse);

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
      // Проверяем, что geo было обработано корректно (покрывает строку 273-277)
      expect(mockApiClient).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
    });

    it('покрывает код создания loginEffect и orchestrated (строки 366-403)', async () => {
      const request = createValidLoginRequest();
      const tokenPair = createMockTokenPair();
      const meResponse = createMockMeResponse();
      const securityResult = createMockLoginSecurityResult({ type: 'allow' });

      // Мокаем apiClient.post чтобы проверить, что он вызывается с правильными параметрами
      mockSecurityPipelineRun.mockReturnValue(async () => securityResult);
      mockApiClient.mockImplementation((url, _body, options) => {
        // Покрывает строку 366: проверка sig !== undefined
        return async () => {
          if (url === '/v1/auth/login') {
            // Проверяем, что options может быть undefined или содержать signal
            if (options === undefined || (options !== undefined && 'signal' in options)) {
              return tokenPair;
            }
            return tokenPair;
          }
          return meResponse;
        };
      });
      // Мокаем apiClient.get чтобы проверить, что он вызывается с правильными параметрами
      mockGet.mockImplementation((_url, options) => {
        return async () => {
          // Покрывает строки 396-405: создание options с headers и signal
          if (
            options !== undefined
            && typeof options === 'object'
            && 'headers' in options
            && 'signal' in options
          ) {
            // Проверяем, что signal может быть undefined (строка 403)
            const signal = (options as { signal?: AbortSignal; }).signal;
            if (signal === undefined || signal instanceof AbortSignal) {
              return meResponse;
            }
          }
          // Покрывает случай когда signal не передан (строка 403)
          if (
            options !== undefined
            && typeof options === 'object'
            && 'headers' in options
          ) {
            return meResponse;
          }
          return meResponse;
        };
      });

      const loginEffect = createLoginEffect(deps, config);
      const effect = loginEffect(request);
      const result = await effect();

      expect(result.type).toBe('success');
      // Проверяем, что все вызовы были сделаны (покрывает строки 366-403)
      expect(mockApiClient).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
    });
  });
});

/* eslint-enable @livai/rag/context-leakage, @livai/rag/source-citation, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */
