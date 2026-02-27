/**
 * @file Unit тесты для effects/login/login-store-updater.ts
 * ============================================================================
 * 🔐 LOGIN STORE UPDATER — ЕДИНАЯ ТОЧКА ОБНОВЛЕНИЯ СОСТОЯНИЙ
 * ============================================================================
 *
 * Проверяет, что:
 * - success- и mfa-ветки `DomainLoginResult` корректно проецируются в AuthState/SessionState/SecurityState
 * - используется готовый `SecurityPipelineResult` без пересчёта риска
 * - `requiredActions` заполняется строго из `decisionHint.action`
 * - порядок вызовов store-порта фиксирован и логически атомарен
 * - опциональные login-метаданные прокидываются как есть для последующего audit/telemetry
 */

import { describe, expect, it } from 'vitest';

import {
  applyBlockedState,
  updateLoginState,
} from '../../../../src/effects/login/login-store-updater.js';
import type {
  AuthEvent,
  AuthState,
  RiskLevel,
  SecurityState,
  SessionState,
} from '../../../../src/types/auth.js';
import type { RiskAssessmentResult } from '../../../../src/types/auth-risk.js';
import type { LoginStorePort } from '../../../../src/effects/login/login-effect.types.js';
import type { LoginMetadata } from '../../../../src/effects/login/login-metadata.enricher.js';
import type { DomainLoginResult } from '../../../../src/domain/LoginResult.js';
import type { TokenPair } from '../../../../src/domain/TokenPair.js';
import type { MeResponse } from '../../../../src/domain/MeResponse.js';
import type { MfaChallengeRequest } from '../../../../src/domain/MfaChallengeRequest.js';
import type { SecurityPipelineResult } from '../../../../src/lib/security-pipeline.js';
import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
/* eslint-disable fp/no-mutation -- в тестах намеренно используем мутации для фиксации вызовов и состояний */

// ============================================================================
// 🔧 HELPERS
// ============================================================================

type CapturedStoreState = {
  authState: AuthState | null;
  sessionState: SessionState | null;
  securityState: SecurityState | null;
  events: AuthEvent['type'][];
  calls: string[];
};

function createMockStore(): { store: LoginStorePort; captured: CapturedStoreState; } {
  const captured: CapturedStoreState = {
    authState: null,
    sessionState: null,
    securityState: null,
    events: [],
    calls: [],
  };

  const store: LoginStorePort = {
    setAuthState: (state) => {
      captured.calls.push('setAuthState');
      captured.authState = state;
    },
    setSessionState: (state) => {
      captured.calls.push('setSessionState');
      captured.sessionState = state;
    },
    setSecurityState: (state) => {
      captured.calls.push('setSecurityState');
      captured.securityState = state;
    },
    applyEventType: (type) => {
      captured.calls.push('applyEventType');
      captured.events.push(type);
    },
  };

  return { store, captured };
}

function createMockStoreWithBatch(): { store: LoginStorePort; captured: CapturedStoreState; } {
  const base = createMockStore();
  // eslint-disable-next-line ai-security/model-poisoning -- base.store создаётся локально в тесте через createMockStore, не содержит внешних данных
  const storeWithBatch: LoginStorePort = {
    ...base.store,
    batchUpdate: (updater: (store: LoginStorePort) => void) => {
      base.captured.calls.push('batchUpdate');
      updater(base.store);
    },
  };

  return {
    store: storeWithBatch,
    captured: base.captured,
  };
}

function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-1',
    deviceType: 'desktop',
    ...overrides,
  };
}

function createRiskAssessment(params: {
  readonly level: RiskLevel;
  readonly score: number;
  readonly action: 'login' | 'mfa' | 'block';
}): RiskAssessmentResult {
  // Для целей login-store-updater нам важны только агрегированные поля и decisionHint;
  // assessment используется как opaque-объект, поэтому создаём минимальную структуру.
  return {
    riskScore: params.score,
    riskLevel: params.level,
    triggeredRules: [],
    decisionHint: { action: params.action },
    assessment: { result: {} } as RiskAssessmentResult['assessment'],
  } as RiskAssessmentResult;
}

function createSecurityPipelineResult(params: {
  readonly level: RiskLevel;
  readonly score: number;
  readonly action: 'login' | 'mfa' | 'block';
}): SecurityPipelineResult {
  return {
    deviceInfo: createDeviceInfo(),
    riskAssessment: createRiskAssessment(params),
  };
}

function createSuccessResult(overrides: Partial<MeResponse> = {}): Extract<
  DomainLoginResult,
  { readonly type: 'success'; }
> {
  const tokenPair: TokenPair = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-02T00:00:00.000Z',
    scope: ['read'],
  };

  const me: MeResponse = {
    user: {
      id: 'user-123',
      email: 'user@example.com',
      emailVerified: true,
    },
    roles: ['user'],
    permissions: ['profile.read'],
    session: {
      sessionId: 'session-1',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
    },
    ...overrides,
  };

  return {
    type: 'success',
    tokenPair,
    me,
  };
}

function createMfaRequiredResult(): Extract<
  DomainLoginResult,
  { readonly type: 'mfa_required'; }
> {
  const challenge: MfaChallengeRequest = {
    userId: 'user-123',
    type: 'totp',
    deviceId: 'device-1',
  };

  return {
    type: 'mfa_required',
    challenge,
  };
}

function createMetadata(): readonly LoginMetadata[] {
  return [
    {
      type: 'trace',
      traceId: 'trace-123',
    },
  ];
}

// ============================================================================
// 🧪 TESTS
// ============================================================================

describe('updateLoginState', () => {
  it('корректно применяет success-результат с low risk (secure) и прокидывает metadata', () => {
    const { store, captured } = createMockStore();
    const domainResult = createSuccessResult();
    const securityResult = createSecurityPipelineResult({
      level: 'low',
      score: 10,
      action: 'login',
    });
    // eslint-disable-next-line ai-security/model-poisoning -- metadata создаётся локально в тесте и не содержит training data
    const metadata = createMetadata();

    const returned = updateLoginState(store, securityResult, domainResult, metadata);

    // metadata прокидывается без изменений
    expect(returned).toBe(metadata);

    // AuthState
    expect(captured.authState?.status).toBe('authenticated');
    const authenticatedState = captured.authState as Extract<
      AuthState,
      { readonly status: 'authenticated'; }
    >;
    expect(authenticatedState.user.id).toBe('user-123');
    expect(authenticatedState.session).toBeDefined();
    expect(authenticatedState.roles).toEqual(['user']);
    expect(authenticatedState.permissions).toEqual(new Set(['profile.read']));

    // SessionState
    expect(captured.sessionState).not.toBeNull();
    const activeSession = captured.sessionState as Extract<
      SessionState,
      { readonly status: 'active'; }
    >;
    expect(activeSession.status).toBe('active');
    expect(activeSession.sessionId).toBe('session-1');
    expect(activeSession.device).toEqual(securityResult.deviceInfo);
    expect(activeSession.issuedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(activeSession.expiresAt).toBe('2026-01-02T00:00:00.000Z');

    // SecurityState: secure (low risk)
    const secureState = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'secure'; }
    >;
    expect(secureState.status).toBe('secure');
    expect(secureState.riskScore).toBe(10);

    // Порядок вызовов порта стора
    expect(captured.calls).toEqual([
      'setAuthState',
      'setSessionState',
      'setSecurityState',
      'applyEventType',
    ]);
    expect(captured.events).toEqual(['user_logged_in']);
  });

  it('использует batchUpdate для success-ветки, если он реализован в LoginStorePort', () => {
    const { store, captured } = createMockStoreWithBatch();
    const domainResult = createSuccessResult();
    const securityResult = createSecurityPipelineResult({
      level: 'low',
      score: 5,
      action: 'login',
    });

    updateLoginState(store, securityResult, domainResult);

    // batchUpdate был задействован
    expect(captured.calls).toContain('batchUpdate');

    // Состояния применены так же, как и в обычном success-сценарии
    const authenticatedState = captured.authState as Extract<
      AuthState,
      { readonly status: 'authenticated'; }
    >;
    expect(authenticatedState.user.id).toBe('user-123');

    const activeSession = captured.sessionState as Extract<
      SessionState,
      { readonly status: 'active'; }
    >;
    expect(activeSession.status).toBe('active');

    const secureState = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'secure'; }
    >;
    expect(secureState.status).toBe('secure');
  });

  it('кидает ошибку при неконсистентных датах issuedAt/expiresAt (fail-closed invariant)', () => {
    const { store } = createMockStore();
    const domainResult = createSuccessResult({
      session: {
        sessionId: 'session-1',
        issuedAt: '2026-01-02T00:00:00.000Z',
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const securityResult = createSecurityPipelineResult({
      level: 'low',
      score: 10,
      action: 'login',
    });

    expect(() => updateLoginState(store, securityResult, domainResult)).toThrowError(
      /Invariant violated: issuedAt/,
    );
  });

  it('корректно применяет success-результат с mfa-решением (risk_detected + requiredActions)', () => {
    const { store, captured } = createMockStore();
    const domainResult = createSuccessResult();
    const riskAssessment = createRiskAssessment({
      level: 'high',
      score: 80,
      action: 'mfa',
    });
    const securityResult: SecurityPipelineResult = {
      deviceInfo: createDeviceInfo(),
      riskAssessment,
    };

    updateLoginState(store, securityResult, domainResult);

    const riskDetected = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'risk_detected'; }
    >;
    expect(riskDetected.status).toBe('risk_detected');
    expect(riskDetected.riskLevel).toBe('high');
    expect(riskDetected.riskScore).toBe(80);
    expect(riskDetected.riskAssessment).toEqual(riskAssessment.assessment.result);
    expect(riskDetected.requiredActions).toEqual(['mfa']);
  });

  it('устанавливает пустой requiredActions для action=login в risk_detected состоянии', () => {
    const { store, captured } = createMockStore();
    const domainResult = createSuccessResult();
    const riskAssessment = createRiskAssessment({
      level: 'high',
      score: 70,
      action: 'login',
    });
    const securityResult: SecurityPipelineResult = {
      deviceInfo: createDeviceInfo(),
      riskAssessment,
    };

    updateLoginState(store, securityResult, domainResult);

    const riskDetected = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'risk_detected'; }
    >;
    expect(riskDetected.requiredActions).toEqual([]);
  });

  it('устанавливает requiredActions=["block"] для action=block в risk_detected состоянии', () => {
    const { store, captured } = createMockStore();
    const domainResult = createSuccessResult();
    const riskAssessment = createRiskAssessment({
      level: 'high',
      score: 90,
      action: 'block',
    });
    const securityResult: SecurityPipelineResult = {
      deviceInfo: createDeviceInfo(),
      riskAssessment,
    };

    updateLoginState(store, securityResult, domainResult);

    const riskDetected = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'risk_detected'; }
    >;
    expect(riskDetected.requiredActions).toEqual(['block']);
  });

  it('кидает ошибку при неподдерживаемом decisionHint.action', () => {
    const { store } = createMockStore();
    const domainResult = createSuccessResult();
    const securityResult = createSecurityPipelineResult({
      level: 'medium',
      score: 40,
      action: 'login',
    });
    // Принудительно нарушаем инвариант union-типа для проверки default-ветки deriveRequiredActions
    (securityResult.riskAssessment as any).decisionHint = { action: 'unknown' };

    expect(() => updateLoginState(store, securityResult, domainResult)).toThrowError(
      /Unsupported decisionHint.action/,
    );
  });

  it('корректно применяет mfa_required результат и не создаёт сессию', () => {
    const { store, captured } = createMockStore();
    const domainResult = createMfaRequiredResult();
    const securityResult = createSecurityPipelineResult({
      level: 'medium',
      score: 50,
      action: 'mfa',
    });
    // eslint-disable-next-line ai-security/model-poisoning -- metadata создаётся локально в тесте и не содержит training data
    const metadata = createMetadata();

    const returned = updateLoginState(store, securityResult, domainResult, metadata);

    // metadata прокидывается без изменений
    expect(returned).toBe(metadata);

    // AuthState: pending_secondary_verification
    const pendingState = captured.authState as Extract<
      AuthState,
      { readonly status: 'pending_secondary_verification'; }
    >;
    expect(pendingState.status).toBe('pending_secondary_verification');
    expect(pendingState.userId).toBe('user-123');
    expect(pendingState.verificationType).toBe('mfa');

    // SessionState: null
    expect(captured.sessionState).toBeNull();

    // SecurityState: risk_detected + requiredActions из decisionHint
    const mfaRiskDetected = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'risk_detected'; }
    >;
    expect(mfaRiskDetected.status).toBe('risk_detected');
    expect(mfaRiskDetected.riskLevel).toBe('medium');
    expect(mfaRiskDetected.riskScore).toBe(50);
    expect(mfaRiskDetected.riskAssessment).toEqual(
      securityResult.riskAssessment.assessment.result,
    );
    expect(mfaRiskDetected.requiredActions).toEqual(['mfa']);

    // Порядок вызовов порта стора
    expect(captured.calls).toEqual([
      'setAuthState',
      'setSessionState',
      'setSecurityState',
      'applyEventType',
    ]);
    expect(captured.events).toEqual(['mfa_challenge_sent']);
  });

  it('использует batchUpdate для mfa_required ветки, если он реализован в LoginStorePort', () => {
    const { store, captured } = createMockStoreWithBatch();
    const domainResult = createMfaRequiredResult();
    const securityResult = createSecurityPipelineResult({
      level: 'medium',
      score: 60,
      action: 'mfa',
    });

    updateLoginState(store, securityResult, domainResult);

    expect(captured.calls).toContain('batchUpdate');

    const pendingState = captured.authState as Extract<
      AuthState,
      { readonly status: 'pending_secondary_verification'; }
    >;
    expect(pendingState.status).toBe('pending_secondary_verification');

    const mfaRiskDetected = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'risk_detected'; }
    >;
    expect(mfaRiskDetected.status).toBe('risk_detected');
  });

  it('applyBlockedState использует blockReason из decisionHint', () => {
    const { store, captured } = createMockStore();
    const securityResult = createSecurityPipelineResult({
      level: 'high',
      score: 90,
      action: 'block',
    });
    (securityResult.riskAssessment as any).decisionHint.blockReason = 'too_many_attempts';

    applyBlockedState(store, securityResult);

    expect(captured.authState?.status).toBe('unauthenticated');
    expect(captured.sessionState).toBeNull();
    const blocked = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'blocked'; }
    >;
    expect(blocked.status).toBe('blocked');
    expect(blocked.reason).toBe('too_many_attempts');
    expect(captured.events).toContain('risk_detected');
  });

  it('applyBlockedState подставляет дефолтную причину при отсутствии blockReason', () => {
    const { store, captured } = createMockStore();
    const securityResult = createSecurityPipelineResult({
      level: 'high',
      score: 95,
      action: 'block',
    });

    applyBlockedState(store, securityResult);

    const blocked = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'blocked'; }
    >;
    expect(blocked.reason).toBe('blocked_by_security_policy');
  });

  it('бросает ошибку для неизвестного варианта DomainLoginResult (exhaustiveness guard)', () => {
    const { store } = createMockStore();
    const securityResult = createSecurityPipelineResult({
      level: 'low',
      score: 0,
      action: 'login',
    });

    const invalidResult = { type: 'unknown' } as unknown as DomainLoginResult;

    expect(() => updateLoginState(store, securityResult, invalidResult)).toThrowError(
      /Unsupported DomainLoginResult variant/,
    );
  });
});

/* eslint-enable fp/no-mutation */
