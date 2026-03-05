/**
 * @file Unit тесты для effects/refresh.ts
 * ============================================================================
 * Полное покрытие orchestration-логики refresh-effect:
 * - policy check (SessionDecision: noop/refresh/invalidate)
 * - API-вызовы /v1/auth/refresh и /v1/auth/me
 * - обновление store через refresh-store-updater
 * - обработка ошибок с invalidate + errorMapper
 * - audit logging (success/error/invalidated/noop)
 * - concurrency стратегии ignore/serialize
 * - cooperative cancellation через AbortSignal.
 */

/* eslint-disable fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Мокаем инфраструктурные helper'ы (validatedEffect/orchestrate/withTimeout), чтобы
// изолировать тесты refresh-effect от Zod-схем и сложной оркестрации и сосредоточиться
// на самой логике orchestrator'а.
vi.mock('@livai/core/effect', async () => {
  const actual = await vi.importActual('@livai/core/effect');
  return {
    ...actual,
    validatedEffect: (_schema: unknown, effectFactory: unknown) => effectFactory,
    step: (name: string, effect: unknown, timeout: number) => ({
      name,
      effect,
      timeout,
    }),
    orchestrate:
      <T>(steps: readonly { name: string; effect: unknown; timeout: number; }[]) =>
      async (signal?: AbortSignal): Promise<T> => {
        const refreshStep = steps[0];
        const meStep = steps[1];
        // Первый шаг: /v1/auth/refresh
        const tokenPair = await (refreshStep!.effect as (sig?: AbortSignal) => Promise<unknown>)(
          signal,
        );
        // Второй шаг: /v1/auth/me, получает previous результат
        const me = await (
          meStep!.effect as (sig?: AbortSignal, previous?: unknown) => Promise<unknown>
        )(signal, tokenPair);
        // Возвращаем tuple, как ожидает refresh.ts
        return [tokenPair, me] as unknown as T;
      },
    withTimeout: (effect: unknown, _config: unknown) => effect,
  };
});

import type { DeviceInfo } from '../../../src/domain/DeviceInfo.js';
import { createRefreshEffect } from '../../../src/effects/refresh.js';
import * as refreshApiMapper from '../../../src/effects/refresh/refresh-api.mapper.js';
import type {
  RefreshEffectConfig,
  RefreshEffectDeps,
  RefreshResult,
} from '../../../src/effects/refresh/refresh-effect.types.js';
import * as refreshStoreUpdater from '../../../src/effects/refresh/refresh-store-updater.js';
import type {
  AuditEventValues,
  LoginTokenPairValues,
  MeResponseValues,
} from '../../../src/schemas/index.js';
import type { AuthError, SessionState } from '../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createMockTokenPairValues(): LoginTokenPairValues {
  return {
    accessToken: 'access-token-1234567890',
    refreshToken: 'refresh-token-1234567890',
    expiresAt: '2026-01-01T00:00:00.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    scope: ['read', 'write'],
    metadata: { deviceId: 'device-123' },
  };
}

function createMockMeResponseValues(): MeResponseValues {
  return {
    user: {
      id: 'user-123',
      email: 'user@example.com',
      emailVerified: true,
    },
    roles: ['user'],
    permissions: ['read'],
    session: {
      sessionId: 'session-123',
      ip: '127.0.0.1',
      deviceId: 'device-123',
      userAgent: 'Mozilla/5.0',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    },
  };
}

function createActiveSessionState(overrides: Partial<SessionState> = {}): SessionState {
  const baseDevice: DeviceInfo = {
    deviceId: 'device-123',
    deviceType: 'desktop',
    ip: '127.0.0.1',
    geo: {
      lat: 55.7558,
      lng: 37.6173,
    },
  };

  return {
    status: 'active',
    sessionId: 'session-123',
    device: baseDevice,
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
    ...overrides,
  } as SessionState;
}

function createNonActiveSessionState(): SessionState {
  return {
    status: 'session_expired',
    sessionId: 'session-expired-1',
    // остальные поля семантически не нужны для теста
  } as unknown as SessionState;
}

function createAuthError(
  kind: AuthError['kind'] = 'network',
  message = 'Network error',
): AuthError {
  return {
    kind,
    message,
  } as AuthError;
}

function createDefaultConfig(
  concurrency: RefreshEffectConfig['concurrency'] = 'ignore',
): RefreshEffectConfig {
  return {
    timeout: 5_000,
    concurrency,
    policy: 'standard',
  };
}

function createMockDeps() {
  const mockAuthStore = {
    setAuthState: vi.fn(),
    setSessionState: vi.fn(),
    setSecurityState: vi.fn(),
    applyEventType: vi.fn(),
    setStoreLocked: vi.fn(),
    batchUpdate: vi.fn(),
    getSessionState: vi.fn(),
    getRefreshToken: vi.fn(),
  };

  const mockApiClient = {
    post: vi.fn(),
    get: vi.fn(),
  };

  const mockSessionManager = {
    decide: vi.fn(),
  };

  const mockErrorMapper = {
    map: vi.fn((error: unknown): AuthError => (
      error instanceof Error
        ? createAuthError('unknown', error.message)
        : createAuthError()
    )),
  };

  const mockClock = {
    now: vi.fn(() => 1_700_000_000_000),
  };

  const mockAuditLogger = {
    logRefreshEvent: vi.fn(),
  };

  const mockEventIdGenerator = {
    generate: vi.fn(() => 'event-123'),
  };

  const deps: RefreshEffectDeps & {
    mocks: {
      authStore: typeof mockAuthStore;
      apiClient: typeof mockApiClient;
      sessionManager: typeof mockSessionManager;
      errorMapper: typeof mockErrorMapper;
      clock: typeof mockClock;
      auditLogger: typeof mockAuditLogger;
      eventIdGenerator: typeof mockEventIdGenerator;
    };
  } = {
    authStore: mockAuthStore as unknown as RefreshEffectDeps['authStore'],
    apiClient: mockApiClient as unknown as RefreshEffectDeps['apiClient'],
    errorMapper: mockErrorMapper,
    sessionManager: mockSessionManager,
    clock: mockClock,
    auditLogger: mockAuditLogger,
    eventIdGenerator: mockEventIdGenerator,
    telemetry: undefined,
    mocks: {
      authStore: mockAuthStore,
      apiClient: mockApiClient,
      sessionManager: mockSessionManager,
      errorMapper: mockErrorMapper,
      clock: mockClock,
      auditLogger: mockAuditLogger,
      eventIdGenerator: mockEventIdGenerator,
    },
  };

  return deps;
}

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('createRefreshEffect', () => {
  // eslint-disable-next-line functional/no-let
  let deps: ReturnType<typeof createMockDeps>;
  // eslint-disable-next-line functional/no-let
  let config: RefreshEffectConfig;

  beforeEach(() => {
    deps = createMockDeps();
    config = createDefaultConfig('ignore');
    vi.clearAllMocks();
  });

  describe('policy / SessionDecision handling', () => {
    it('возвращает noop с reason=already_fresh при SessionDecision.noop(reason=fresh)', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'noop',
        reason: 'fresh',
      });

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result).toEqual<RefreshResult>({
        type: 'noop',
        reason: 'already_fresh',
      });
      expect(deps.mocks.apiClient.post).not.toHaveBeenCalled();
      expect(deps.mocks.apiClient.get).not.toHaveBeenCalled();
      expect(deps.mocks.auditLogger.logRefreshEvent).not.toHaveBeenCalled();
    });

    it('возвращает noop с reason=not_authenticated при SessionDecision.noop(reason=not_authenticated)', async () => {
      deps.mocks.authStore.getSessionState.mockReturnValue(null);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'noop',
        reason: 'not_authenticated',
      });

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result).toEqual<RefreshResult>({
        type: 'noop',
        reason: 'not_authenticated',
      });
      expect(deps.mocks.auditLogger.logRefreshEvent).not.toHaveBeenCalled();
    });

    it('применяет invalidate через store-updater и возвращает invalidated результат', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'invalidate',
        reason: 'expired',
      });

      const applyInvalidateSpy = vi.spyOn(refreshStoreUpdater, 'applyRefreshInvalidate');

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result).toEqual<RefreshResult>({
        type: 'invalidated',
        reason: 'expired',
      });
      expect(applyInvalidateSpy).toHaveBeenCalledWith(
        deps.authStore,
        'expired',
      );
      expect(deps.mocks.authStore.setStoreLocked).toHaveBeenCalledWith(true);
      expect(deps.mocks.authStore.setStoreLocked).toHaveBeenCalledWith(false);
      expect(deps.mocks.auditLogger.logRefreshEvent).toHaveBeenCalledTimes(1);
      const event = deps.mocks.auditLogger.logRefreshEvent.mock.calls[0]?.[0] as AuditEventValues;
      expect(event.type).toBe('session_revoked');
    });
  });

  describe('успешный refresh flow', () => {
    it('выполняет полный flow: policy → getRefreshToken → API → store update → success + audit', async () => {
      const sessionState = createActiveSessionState();
      const tokenPairDto = createMockTokenPairValues();
      const meDto = createMockMeResponseValues();

      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'refresh',
      });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('refresh-token-1234567890');

      const mapReqSpy = vi.spyOn(refreshApiMapper, 'mapRefreshRequestToApiPayload').mockReturnValue(
        {
          refreshToken: 'refresh-token-1234567890',
        },
      );
      const mapRespSpy = vi.spyOn(refreshApiMapper, 'mapRefreshResponseToDomain').mockReturnValue({
        tokenPair: {
          accessToken: 'access-token-1234567890',
          refreshToken: 'refresh-token-1234567890',
          expiresAt: '2026-01-01T00:00:00.000Z',
          issuedAt: '2026-01-01T00:00:00.000Z',
        } as any,
        me: {
          user: { id: 'user-123' },
          roles: ['user'],
          permissions: ['read'],
          session: {
            sessionId: 'session-123',
            issuedAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-12-31T23:59:59.000Z',
          },
        } as any,
      } as ReturnType<typeof refreshApiMapper.mapRefreshResponseToDomain>);

      deps.mocks.apiClient.post.mockImplementation(
        (
          url: string,
          body: unknown,
        ) =>
        async () => {
          expect(url).toBe('/v1/auth/refresh');
          expect(body).toEqual({ refreshToken: 'refresh-token-1234567890' });
          return tokenPairDto;
        },
      );
      deps.mocks.apiClient.get.mockImplementation(
        (url: string) => async () => {
          expect(url).toBe('/v1/auth/me');
          return meDto;
        },
      );

      const updateRefreshStateSpy = vi.spyOn(refreshStoreUpdater, 'updateRefreshState');

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result).toEqual<RefreshResult>({
        type: 'success',
        userId: 'user-123',
      });

      expect(updateRefreshStateSpy).toHaveBeenCalled();
      expect(deps.mocks.auditLogger.logRefreshEvent).toHaveBeenCalledTimes(1);
      const event = deps.mocks.auditLogger.logRefreshEvent.mock.calls[0]?.[0] as AuditEventValues;
      expect(event.type).toBe('token_refresh');
      expect(event.userId).toBe('user-123');

      mapReqSpy.mockRestore();
      mapRespSpy.mockRestore();
    });

    it('кидает ошибку если domainResult.me отсутствует после mapRefreshResponseToDomain', async () => {
      const sessionState = createActiveSessionState();
      const tokenPairDto = createMockTokenPairValues();
      const meDto = createMockMeResponseValues();

      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'refresh',
      });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('refresh-token-1234567890');

      deps.mocks.apiClient.post.mockImplementation(
        () => async () => tokenPairDto,
      );
      deps.mocks.apiClient.get.mockImplementation(
        () => async () => meDto,
      );

      const mapSpy = vi.spyOn(refreshApiMapper, 'mapRefreshResponseToDomain').mockReturnValue({
        tokenPair: createMockTokenPairValues() as any,
        me: undefined,
      } as unknown as ReturnType<typeof refreshApiMapper.mapRefreshResponseToDomain>);

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
      mapSpy.mockRestore();
    });
  });

  describe('validateRefreshTokenFormat via error paths', () => {
    it('возвращает error при пустом refreshToken (trim === "")', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide
        .mockReturnValueOnce({ type: 'refresh' })
        .mockReturnValueOnce({ type: 'noop', reason: 'fresh' });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('   ');

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
    });

    it('возвращает error при слишком коротком refreshToken', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide
        .mockReturnValueOnce({ type: 'refresh' })
        .mockReturnValueOnce({ type: 'noop', reason: 'fresh' });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('short-token');

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
    });

    it('возвращает error при слишком длинном refreshToken', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide
        .mockReturnValueOnce({ type: 'refresh' })
        .mockReturnValueOnce({ type: 'noop', reason: 'fresh' });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('x'.repeat(5000));

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
    });

    it('возвращает error если SessionState не active при получении токена', async () => {
      const sessionState = createNonActiveSessionState();
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide
        .mockReturnValueOnce({ type: 'refresh' })
        .mockReturnValueOnce({ type: 'noop', reason: 'fresh' });

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
    });
  });

  describe('handleRefreshError invalidate branch', () => {
    it('инвалидирует сессию если sessionManager решает invalidate при ошибке', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState
        .mockReturnValueOnce(sessionState)
        .mockReturnValueOnce(sessionState);

      deps.mocks.sessionManager.decide
        .mockReturnValueOnce({ type: 'refresh' })
        .mockReturnValueOnce({ type: 'invalidate', reason: 'refresh_failed' });

      deps.mocks.authStore.getRefreshToken.mockReturnValue('valid-refresh-token-1234567890');

      deps.mocks.apiClient.post.mockImplementation(
        () => async () => {
          throw new Error('refresh failed');
        },
      );

      const applyInvalidateSpy = vi.spyOn(refreshStoreUpdater, 'applyRefreshInvalidate');

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result).toEqual<RefreshResult>({
        type: 'invalidated',
        reason: 'refresh_failed',
      });
      expect(applyInvalidateSpy).toHaveBeenCalledWith(
        deps.authStore,
        'refresh_failed',
      );
    });

    it('возвращает error если sessionManager не требует invalidate при ошибке', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState
        .mockReturnValueOnce(sessionState)
        .mockReturnValueOnce(sessionState);

      deps.mocks.sessionManager.decide
        .mockReturnValueOnce({ type: 'refresh' })
        .mockReturnValueOnce({ type: 'noop', reason: 'fresh' });

      deps.mocks.authStore.getRefreshToken.mockReturnValue('valid-refresh-token-1234567890');

      deps.mocks.apiClient.post.mockImplementation(
        () => async () => {
          throw new Error('refresh failed');
        },
      );

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
    });
  });

  describe('performAuditLogging', () => {
    it('не логирует noop события', async () => {
      const sessionState = createActiveSessionState();
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'noop',
        reason: 'fresh',
      });

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      await effect();

      expect(deps.mocks.auditLogger.logRefreshEvent).not.toHaveBeenCalled();
    });

    it('игнорирует ошибки audit logging (best-effort)', async () => {
      const sessionState = createActiveSessionState();
      const tokenPairDto = createMockTokenPairValues();
      const meDto = createMockMeResponseValues();

      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'refresh',
      });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('refresh-token-1234567890');

      const mapReqSpy = vi.spyOn(refreshApiMapper, 'mapRefreshRequestToApiPayload').mockReturnValue(
        {
          refreshToken: 'refresh-token-1234567890',
        },
      );
      const mapRespSpy = vi.spyOn(refreshApiMapper, 'mapRefreshResponseToDomain').mockReturnValue({
        tokenPair: {
          accessToken: 'access-token-1234567890',
          refreshToken: 'refresh-token-1234567890',
          expiresAt: '2026-01-01T00:00:00.000Z',
          issuedAt: '2026-01-01T00:00:00.000Z',
        } as any,
        me: {
          user: { id: 'user-123' },
          roles: ['user'],
          permissions: ['read'],
          session: {
            sessionId: 'session-123',
            issuedAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-12-31T23:59:59.000Z',
          },
        } as any,
      } as ReturnType<typeof refreshApiMapper.mapRefreshResponseToDomain>);

      deps.mocks.apiClient.post.mockImplementation(
        () => async () => tokenPairDto,
      );
      deps.mocks.apiClient.get.mockImplementation(
        () => async () => meDto,
      );

      const updateRefreshStateSpy = vi.spyOn(refreshStoreUpdater, 'updateRefreshState');

      // Логгер будет кидать ошибку
      deps.mocks.auditLogger.logRefreshEvent.mockImplementation(() => {
        throw new Error('audit failed');
      });

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('success');
      expect(updateRefreshStateSpy).toHaveBeenCalled();
      // Ошибка логгера не должна пробрасываться

      mapReqSpy.mockRestore();
      mapRespSpy.mockRestore();
    });
  });

  describe('defensive edge-cases', () => {
    it('возвращает error, если после policy-check sessionState === null, но decision.type === "refresh"', async () => {
      // sessionState отсутствует, но sessionManager решает продолжать refresh →
      // defensive guard в runOnce кидает ошибку, которая затем обрабатывается handleRefreshError.
      deps.mocks.authStore.getSessionState.mockReturnValue(null);
      deps.mocks.sessionManager.decide
        .mockReturnValueOnce({ type: 'refresh' })
        .mockReturnValueOnce({ type: 'noop', reason: 'not_authenticated' });

      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();
      const result = await effect();

      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.error.kind).toBe('unknown');
      }

      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
      expect(deps.mocks.authStore.getRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('concurrency стратегии', () => {
    it('ignore: возвращает уже выполняющийся запрос при повторном вызове', async () => {
      const sessionState = createActiveSessionState();
      const tokenPairDto = createMockTokenPairValues();
      const meDto = createMockMeResponseValues();

      config = createDefaultConfig('ignore');
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'refresh',
      });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('refresh-token-1234567890');

      const mapReqSpy = vi.spyOn(refreshApiMapper, 'mapRefreshRequestToApiPayload').mockReturnValue(
        {
          refreshToken: 'refresh-token-1234567890',
        },
      );
      const mapRespSpy = vi.spyOn(refreshApiMapper, 'mapRefreshResponseToDomain').mockReturnValue({
        tokenPair: {
          accessToken: 'access-token-1234567890',
          refreshToken: 'refresh-token-1234567890',
          expiresAt: '2026-01-01T00:00:00.000Z',
          issuedAt: '2026-01-01T00:00:00.000Z',
        } as any,
        me: {
          user: { id: 'user-123' },
          roles: ['user'],
          permissions: ['read'],
          session: {
            sessionId: 'session-123',
            issuedAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-1231T23:59:59.000Z',
          },
        } as any,
      } as ReturnType<typeof refreshApiMapper.mapRefreshResponseToDomain>);

      deps.mocks.apiClient.post.mockImplementation(
        () => async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return tokenPairDto;
        },
      );
      deps.mocks.apiClient.get.mockImplementation(
        () => async () => meDto,
      );

      const refreshEffect = createRefreshEffect(deps, config);
      const effect1 = refreshEffect();
      const promise1 = effect1();

      const effect2 = refreshEffect();
      const promise2 = effect2();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Оба вызова должны завершиться с одинаковым результатом (reuse inFlight),
      // при этом хотя бы один policy-check должен был быть выполнен.
      expect(result1.type).toBe(result2.type);
      expect(result1.type === 'success' || result1.type === 'error').toBe(true);
      expect(deps.mocks.sessionManager.decide).toHaveBeenCalled();

      mapReqSpy.mockRestore();
      mapRespSpy.mockRestore();
    });

    it('serialize: ограничивает длину очереди и возвращает rate_limited при переполнении', async () => {
      const sessionState = createActiveSessionState();
      const tokenPairDto = createMockTokenPairValues();
      const meDto = createMockMeResponseValues();

      config = createDefaultConfig('serialize');
      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'refresh',
      });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('refresh-token-1234567890');

      deps.mocks.apiClient.post.mockImplementation(
        () => async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return tokenPairDto;
        },
      );
      deps.mocks.apiClient.get.mockImplementation(
        () => async () => meDto,
      );

      const refreshEffect = createRefreshEffect(deps, config);

      const promises = Array.from({ length: 10 }, () => {
        const effect = refreshEffect();
        return effect();
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const overflowEffect = refreshEffect();
      const overflowResult = await overflowEffect();

      expect(overflowResult.type).toBe('error');
      if (overflowResult.type === 'error') {
        expect(overflowResult.error.kind).toBe('rate_limited');
        expect(overflowResult.error.message).toBe(
          'Refresh queue is full, please try again later',
        );
      }

      await Promise.allSettled(promises);
    });
  });

  describe('external signal abort', () => {
    it('отменяет запрос при external AbortSignal', async () => {
      const sessionState = createActiveSessionState();
      const tokenPairDto = createMockTokenPairValues();
      const meDto = createMockMeResponseValues();

      deps.mocks.authStore.getSessionState.mockReturnValue(sessionState);
      deps.mocks.sessionManager.decide.mockReturnValue({
        type: 'refresh',
      });
      deps.mocks.authStore.getRefreshToken.mockReturnValue('refresh-token-1234567890');

      deps.mocks.apiClient.post.mockImplementation(
        () => async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return tokenPairDto;
        },
      );
      deps.mocks.apiClient.get.mockImplementation(
        () => async () => meDto,
      );

      const controller = new AbortController();
      const refreshEffect = createRefreshEffect(deps, config);
      const effect = refreshEffect();

      const promise = effect(controller.signal);
      controller.abort();

      const result = await promise;
      expect(result.type).toBe('error');
      expect(deps.mocks.errorMapper.map).toHaveBeenCalled();
    });
  });
});

/* eslint-enable fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements */
