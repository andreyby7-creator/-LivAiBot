/**
 * @file Unit тесты для effects/login/login-effect.types.ts
 * Полное покрытие DI-типов login-effect и security projection.
 */

/* eslint-disable @livai/rag/context-leakage, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements, @livai/rag/source-citation */

import { describe, expect, it } from 'vitest';

import type {
  AbortControllerPort,
  ApiRequestOptions,
  AuditLoggerPort,
  AuthApiClientPort,
  ClockPort,
  ErrorMapperPort,
  IdentifierHasher,
  IdentifierHasherPort,
  LoginEffectConfig,
  LoginEffectDeps,
  LoginFeatureFlags,
  LoginSecurityDecision,
  LoginSecurityResult,
  SecurityPipelinePort,
} from '../../../../src/effects/login/login-effect.types.js';
import type {
  AuthError,
  AuthEvent,
  AuthState,
  SecurityState,
  SessionState,
} from '../../../../src/types/auth.js';
import type {
  RiskAssessmentResult,
  RiskLevel,
  RiskPolicy,
} from '../../../../src/types/auth-risk.js';
import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type {
  MandatoryAuditLogger,
  SecurityPipelineContext,
  SecurityPipelineError,
  SecurityPipelineResult,
  SecurityPipelineStep,
} from '../../../../src/lib/security-pipeline.js';
import type { AuthStorePort, BatchUpdate } from '../../../../src/effects/shared/auth-store.port.js';
import type { AuditEventValues } from '../../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

const createAuthState = (): AuthState => ({
  status: 'authenticated',
  user: {
    id: 'user-123',
  },
});

const createSessionState = (): SessionState => ({
  status: 'active',
  sessionId: 'session-123',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-12-31T23:59:59.000Z',
});

const createSecurityState = (): SecurityState => ({
  status: 'risk_detected',
  riskLevel: 'low' as RiskLevel,
  riskScore: 10,
});

const createSecurityContext = (
  overrides: Partial<SecurityPipelineContext> = {},
): SecurityPipelineContext => ({
  operation: 'login',
  ip: '127.0.0.1',
  userId: 'user-123',
  ...overrides,
});

// ============================================================================
// 📋 TYPE STRUCTURE TESTS
// ============================================================================

describe('effects/login/login-effect.types', () => {
  it('AuthStorePort поддерживает все обязательные методы', () => {
    const calls: {
      auth?: AuthState;
      session?: SessionState | null;
      security?: SecurityState;
      eventType?: string;
      locked?: boolean;
    } = {};

    const store: AuthStorePort = {
      setAuthState: (state: AuthState) => {
        calls.auth = state;
      },
      setSessionState: (state: SessionState | null) => {
        calls.session = state;
      },
      setSecurityState: (state: SecurityState) => {
        calls.security = state;
      },
      applyEventType: (type: AuthEvent['type']) => {
        calls.eventType = type;
      },
      setStoreLocked: (locked: boolean) => {
        calls.locked = locked;
      },
      batchUpdate: (updates: readonly BatchUpdate[]) => {
        updates.reduce<void>((_acc, update) => {
          void (
            update.type === 'setAuthState'
              ? (calls.auth = update.state)
              : update.type === 'setSessionState'
              ? (calls.session = update.state)
              : update.type === 'setSecurityState'
              ? (calls.security = update.state)
              : (calls.eventType = update.event)
          );
          return undefined;
        }, undefined);
      },
    };

    const authState = createAuthState();
    const sessionState = createSessionState();
    const securityState = createSecurityState();

    store.setAuthState(authState);
    store.setSessionState(sessionState);
    store.setSecurityState(securityState);
    store.applyEventType('user_logged_in');

    expect(calls.auth).toEqual(authState);
    expect(calls.session).toEqual(sessionState);
    expect(calls.security).toEqual(securityState);
    expect(calls.eventType).toBe('user_logged_in');
  });

  it('AuthStorePort поддерживает обязательный batchUpdate', () => {
    const calls: {
      auth?: AuthState;
      session?: SessionState | null;
      security?: SecurityState;
      eventType?: string;
      batchCount?: number;
    } = {};

    const store: AuthStorePort = {
      setAuthState: (state: AuthState) => {
        calls.auth = state;
      },
      setSessionState: (state: SessionState | null) => {
        calls.session = state;
      },
      setSecurityState: (state: SecurityState) => {
        calls.security = state;
      },
      applyEventType: (type: AuthEvent['type']) => {
        calls.eventType = type;
      },
      setStoreLocked: () => {
        // Mock implementation
      },
      batchUpdate: (updates: readonly BatchUpdate[]) => {
        calls.batchCount = (calls.batchCount ?? 0) + 1;
        updates.reduce<void>((_acc, update) => {
          void (
            update.type === 'setAuthState'
              ? (calls.auth = update.state)
              : update.type === 'setSessionState'
              ? (calls.session = update.state)
              : update.type === 'setSecurityState'
              ? (calls.security = update.state)
              : (calls.eventType = update.event)
          );
          return undefined;
        }, undefined);
      },
    };

    const authState = createAuthState();
    const sessionState = createSessionState();
    const securityState = createSecurityState();

    store.batchUpdate([
      { type: 'setAuthState', state: authState },
      { type: 'setSessionState', state: sessionState },
      { type: 'setSecurityState', state: securityState },
      { type: 'applyEventType', event: 'user_logged_in' },
    ]);

    expect(calls.auth).toEqual(authState);
    expect(calls.session).toEqual(sessionState);
    expect(calls.security).toEqual(securityState);
    expect(calls.eventType).toBe('user_logged_in');
    expect(calls.batchCount).toBe(1);
  });

  it('AuthApiClientPort поддерживает post/get с ApiRequestOptions (Effect-based)', async () => {
    const captured: {
      url?: string;
      body?: unknown;
      headers?: Readonly<Record<string, string>> | undefined;
      signalUsed?: boolean;
    } = {};

    const apiClient: AuthApiClientPort = {
      post<T>(url: string, body: unknown, options?: ApiRequestOptions) {
        return async (signal?: AbortSignal) => {
          captured.url = url;
          captured.body = body;
          captured.headers = options?.headers;
          captured.signalUsed = signal instanceof AbortSignal;
          return { ok: true } as unknown as T;
        };
      },
      get<T>(url: string, options?: ApiRequestOptions) {
        return async (signal?: AbortSignal) => {
          captured.url = url;
          captured.headers = options?.headers;
          captured.signalUsed = signal instanceof AbortSignal;
          return { ok: true } as unknown as T;
        };
      },
    };

    const controller = new AbortController();
    await apiClient.post('/v1/auth/login', { email: 'user@example.com' }, {
      headers: {
        Authorization: 'Bearer test-token',
      },
    })(controller.signal);

    expect(captured.url).toBe('/v1/auth/login');
    expect(captured.body).toEqual({ email: 'user@example.com' });
    expect(captured.headers).toEqual({ Authorization: 'Bearer test-token' });
    expect(captured.signalUsed).toBe(true);

    await apiClient.get('/v1/auth/me', { headers: { Authorization: 'Bearer test-token' } })(
      controller.signal,
    );
    expect(captured.url).toBe('/v1/auth/me');
    expect(captured.headers).toEqual({ Authorization: 'Bearer test-token' });
    expect(captured.signalUsed).toBe(true);
  });

  it('LoginSecurityDecision поддерживает все варианты discriminated union', () => {
    const decisions: LoginSecurityDecision[] = [
      { type: 'allow' },
      { type: 'require_mfa' },
      { type: 'block' },
      { type: 'custom', code: 'require_step_up' },
    ];

    const labels = decisions.map((decision) => {
      switch (decision.type) {
        case 'allow':
          return 'allow';
        case 'require_mfa':
          return 'mfa';
        case 'block':
          return 'block';
        case 'custom':
          return decision.code;
        default: {
          // Exhaustiveness guard на уровне типов
          const _exhaustiveCheck: never = decision;
          throw new Error(`Unexpected decision: ${JSON.stringify(_exhaustiveCheck)}`);
        }
      }
    });

    expect(labels).toEqual([
      'allow',
      'mfa',
      'block',
      'require_step_up',
    ]);
  });

  it('SecurityPipelinePort.run возвращает LoginSecurityResult требуемой формы', async () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-1',
      deviceType: 'desktop',
    };
    const riskAssessment: RiskAssessmentResult = {
      riskScore: 42,
      riskLevel: 'low',
      triggeredRules: [],
      decisionHint: { action: 'login' },
      assessment: {} as RiskAssessmentResult['assessment'],
    };
    const pipelineResult: SecurityPipelineResult = {
      deviceInfo,
      riskAssessment,
    };

    const port: SecurityPipelinePort = {
      run: (
        _context: SecurityPipelineContext,
        _policy?: RiskPolicy,
      ) =>
      async (_signal?: AbortSignal): Promise<LoginSecurityResult> => ({
        decision: { type: 'allow' },
        riskScore: 42,
        riskLevel: 'low' as RiskLevel,
        pipelineResult,
      }),
    };

    const context = createSecurityContext();
    const effect = port.run(context);
    const result = await effect();

    expect(result.decision.type).toBe('allow');
    expect(result.riskScore).toBe(42);
    expect(result.riskLevel).toBe('low');
  });

  it('SecurityPipelinePort.run поддерживает опциональный policy параметр', async () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-2',
      deviceType: 'mobile',
    };
    const riskAssessment: RiskAssessmentResult = {
      riskScore: 75,
      riskLevel: 'high',
      triggeredRules: [],
      decisionHint: { action: 'mfa' },
      assessment: {} as RiskAssessmentResult['assessment'],
    };
    const pipelineResult: SecurityPipelineResult = {
      deviceInfo,
      riskAssessment,
    };

    const policy: RiskPolicy = {
      weights: {
        device: 0.3,
        geo: 0.2,
        network: 0.3,
        velocity: 0.2,
      },
    };

    const capturedPolicy: { policy?: RiskPolicy | undefined; } = {};
    const port: SecurityPipelinePort = {
      run: (
        _context: SecurityPipelineContext,
        passedPolicy?: RiskPolicy,
      ) => {
        if (passedPolicy !== undefined) {
          capturedPolicy.policy = passedPolicy;
        }
        return async (_signal?: AbortSignal): Promise<LoginSecurityResult> => ({
          decision: { type: 'require_mfa' },
          riskScore: 75,
          riskLevel: 'high' as RiskLevel,
          pipelineResult,
        });
      },
    };

    const context = createSecurityContext();
    const effect = port.run(context, policy);
    const result = await effect();

    expect(capturedPolicy.policy).toEqual(policy);
    expect(result.decision.type).toBe('require_mfa');
    expect(result.riskScore).toBe(75);
    expect(result.riskLevel).toBe('high');
  });

  it('порты IdentifierHasherPort, ErrorMapperPort, AbortControllerPort и ClockPort работают как ожидается', () => {
    const hasher: IdentifierHasher = (input) => `hash:${input}`;
    const identifierHasherPort: IdentifierHasherPort = {
      hash: hasher,
    };

    const errorMapperPort: ErrorMapperPort = {
      map: (unknownError: unknown): AuthError => ({
        kind: 'network',
        message: String(unknownError),
        retryable: true,
      }),
    };

    const abortControllerPort: AbortControllerPort = {
      create: () => new AbortController(),
    };

    const clockPort: ClockPort = {
      now: () => 1700000000000,
    };

    const hashed = identifierHasherPort.hash('user-123');
    const mappedError = errorMapperPort.map(new Error('Network error'));
    const controller = abortControllerPort.create();
    const now = clockPort.now();

    expect(hashed).toBe('hash:user-123');
    expect(mappedError.kind).toBe('network');
    expect(mappedError.message).toContain('Network error');
    expect(controller).toBeInstanceOf(AbortController);
    expect(now).toBe(1700000000000);
  });

  it('AuditLoggerPort поддерживает log и logAuditEvent', () => {
    const loggedErrors: { error: SecurityPipelineError; step: SecurityPipelineStep; }[] = [];
    const loggedEvents: AuditEventValues[] = [];

    const mandatoryLogger: MandatoryAuditLogger = (
      error: Readonly<SecurityPipelineError>,
      step: Readonly<SecurityPipelineStep>,
    ) => {
      loggedErrors.push({ error, step });
    };

    const auditLogger: AuditLoggerPort = {
      log: mandatoryLogger,
      logAuditEvent: (event: AuditEventValues) => {
        loggedEvents.push(event);
      },
    };

    const testError: SecurityPipelineError = {
      kind: 'FINGERPRINT_ERROR',
      step: 'fingerprint',
      message: 'Test error',
    } as SecurityPipelineError;

    const testStep: SecurityPipelineStep = 'fingerprint';

    const testEvent: AuditEventValues = {
      type: 'login_success',
      eventId: 'event-123',
      timestamp: '2026-01-01T00:00:00.000Z',
      userId: 'user-123',
      sessionId: 'session-123',
    } as AuditEventValues;

    auditLogger.log(testError, testStep);
    auditLogger.logAuditEvent(testEvent);

    expect(loggedErrors).toHaveLength(1);
    expect(loggedErrors[0]?.error).toEqual(testError);
    expect(loggedErrors[0]?.step).toEqual(testStep);
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0]).toEqual(testEvent);
  });

  it('LoginEffectDeps описывает полный DI-контракт login-effect', async () => {
    const apiClient: AuthApiClientPort = {
      post<T>(_url: string, _body: unknown) {
        return async (): Promise<T> => ({ ok: true } as unknown as T);
      },
      get<T>(_url: string) {
        return async (): Promise<T> => ({ ok: true } as unknown as T);
      },
    };

    const storeCalls: {
      auth?: AuthState;
      session?: SessionState | null;
      security?: SecurityState;
    } = {};
    const authStore: AuthStorePort = {
      setAuthState: (state: AuthState) => {
        storeCalls.auth = state;
      },
      setSessionState: (state: SessionState | null) => {
        storeCalls.session = state;
      },
      setSecurityState: (state: SecurityState) => {
        storeCalls.security = state;
      },
      applyEventType: (_type: 'user_logged_in' | 'mfa_challenge_sent' | 'risk_detected') => {},
      setStoreLocked: (_locked: boolean) => {},
      batchUpdate: (updates: readonly BatchUpdate[]) => {
        updates.reduce<void>((_acc, update) => {
          void (
            update.type === 'setAuthState'
              ? (storeCalls.auth = update.state)
              : update.type === 'setSessionState'
              ? (storeCalls.session = update.state)
              : update.type === 'setSecurityState'
              ? (storeCalls.security = update.state)
              : undefined // applyEventType игнорируем
          );
          return undefined;
        }, undefined);
      },
    };

    const securityPipeline: SecurityPipelinePort = {
      run: () => async (_signal?: AbortSignal): Promise<LoginSecurityResult> => ({
        decision: { type: 'allow' },
        riskScore: 5,
        riskLevel: 'low' as RiskLevel,
        pipelineResult: {
          deviceInfo: {
            deviceId: 'device-1',
            deviceType: 'desktop',
          },
          riskAssessment: {
            riskScore: 5,
            riskLevel: 'low' as RiskLevel,
            triggeredRules: [],
            decisionHint: { action: 'login' },
            assessment: {} as RiskAssessmentResult['assessment'],
          },
        },
      }),
    };

    const identifierHasherPort: IdentifierHasherPort = {
      hash: (input) => `hash:${input}`,
    };

    const auditLoggerPort: AuditLoggerPort = {
      log: () => {
        // no-op для теста
      },
      logAuditEvent: () => {
        // no-op для теста
      },
    };

    const errorMapperPort: ErrorMapperPort = {
      map: (error: unknown): AuthError => ({
        kind: 'invalid_credentials',
        message: String(error),
      }),
    };

    const abortControllerPort: AbortControllerPort = {
      create: () => new AbortController(),
    };

    const clockPort: ClockPort = {
      now: () => 1700000000000,
    };

    const deps: LoginEffectDeps = {
      apiClient,
      authStore,
      securityPipeline,
      identifierHasher: identifierHasherPort,
      auditLogger: auditLoggerPort,
      errorMapper: errorMapperPort,
      abortController: abortControllerPort,
      clock: clockPort,
    };

    // Используем deps, чтобы TypeScript и runtime прошли по всем полям
    const hashedUserId = deps.identifierHasher.hash('user-456');
    const abortController = deps.abortController.create();
    const now = deps.clock.now();
    const securityEffect = deps.securityPipeline.run(createSecurityContext());
    const securityResult = await securityEffect();

    deps.authStore.setAuthState(createAuthState());
    deps.authStore.setSessionState(createSessionState());
    deps.authStore.setSecurityState(createSecurityState());

    expect(hashedUserId).toBe('hash:user-456');
    expect(abortController).toBeInstanceOf(AbortController);
    expect(now).toBe(1700000000000);
    expect(securityResult.decision.type).toBe('allow');
    expect(storeCalls.auth).toBeDefined();
    expect(storeCalls.session).toBeDefined();
    expect(storeCalls.security).toBeDefined();
  });

  it('LoginEffectConfig и LoginFeatureFlags описывают конфигурацию эффекта', () => {
    const featureFlags: LoginFeatureFlags = {
      // Пока без конкретных флагов, но тип резервирует закрытый набор полей
    };

    const config: LoginEffectConfig = {
      timeouts: {
        loginApiTimeoutMs: 5_000,
        meApiTimeoutMs: 3_000,
        loginHardTimeoutMs: 60_000,
      },
      featureFlags,
      concurrency: 'cancel_previous',
    };

    expect(config.timeouts.loginApiTimeoutMs).toBe(5_000);
    expect(config.timeouts.meApiTimeoutMs).toBe(3_000);
    expect(config.featureFlags).toBeDefined();
    expect(config.concurrency).toBe('cancel_previous');
  });

  it('LoginEffectConfig поддерживает loginHardTimeoutMs', () => {
    const config: LoginEffectConfig = {
      timeouts: {
        loginApiTimeoutMs: 5_000,
        meApiTimeoutMs: 3_000,
        loginHardTimeoutMs: 60_000,
      },
      concurrency: 'ignore',
    };

    expect(config.timeouts.loginHardTimeoutMs).toBe(60_000);
  });

  it('LoginEffectConfig поддерживает все варианты concurrency стратегий', () => {
    const strategies: LoginEffectConfig['concurrency'][] = [
      'cancel_previous',
      'ignore',
      'serialize',
    ];

    strategies.forEach((strategy) => {
      const config: LoginEffectConfig = {
        timeouts: {
          loginApiTimeoutMs: 5_000,
          meApiTimeoutMs: 3_000,
          loginHardTimeoutMs: 60_000,
        },
        concurrency: strategy,
      };

      expect(config.concurrency).toBe(strategy);
    });
  });

  it('LoginSecurityResult поддерживает все варианты LoginSecurityDecision', async () => {
    const deviceInfo: DeviceInfo = {
      deviceId: 'device-1',
      deviceType: 'desktop',
    };
    const riskAssessment: RiskAssessmentResult = {
      riskScore: 50,
      riskLevel: 'medium',
      triggeredRules: [],
      decisionHint: { action: 'login' },
      assessment: {} as RiskAssessmentResult['assessment'],
    };
    const pipelineResult: SecurityPipelineResult = {
      deviceInfo,
      riskAssessment,
    };

    const decisions: LoginSecurityDecision[] = [
      { type: 'allow' },
      { type: 'require_mfa' },
      { type: 'block' },
      { type: 'custom', code: 'require_step_up' },
    ];

    const results = decisions.map((decision) => {
      const result: LoginSecurityResult = {
        decision,
        riskScore: 50,
        riskLevel: 'medium' as RiskLevel,
        pipelineResult,
      };

      expect(result.decision.type).toBe(decision.type);
      // Проверяем custom decision через type guard
      if (result.decision.type === 'custom') {
        // TypeScript narrows result.decision to { type: 'custom'; code: string } here
        expect(result.decision.code).toBe(
          decision.type === 'custom' ? decision.code : '',
        );
      }
      expect(result.riskScore).toBe(50);
      expect(result.riskLevel).toBe('medium');
      expect(result.pipelineResult).toEqual(pipelineResult);
      return result;
    });

    expect(results).toHaveLength(4);
    expect(results[0]?.decision.type).toBe('allow');
    expect(results[1]?.decision.type).toBe('require_mfa');
    expect(results[2]?.decision.type).toBe('block');
    const customResult = results[3];
    expect(customResult?.decision.type).toBe('custom');
    // TypeScript narrows customResult.decision to { type: 'custom'; code: string } here
    // @see packages/feature-auth/src/effects/login/login-effect.types.ts:103-107
    if (customResult?.decision.type === 'custom') {
      expect(customResult.decision.code).toBe('require_step_up');
    }
  });
});
/* eslint-enable @livai/rag/context-leakage, fp/no-mutation, @livai/multiagent/orchestration-safety, functional/no-conditional-statements, @livai/rag/source-citation */
