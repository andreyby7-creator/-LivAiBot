/**
 * @file Unit тесты для effects/refresh/refresh-store-updater.ts
 * Цель: 100% покрытие (statements/branches/functions/lines) для updateRefreshState и applyRefreshInvalidate.
 */

import { describe, expect, it } from 'vitest';

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type { MeResponse } from '../../../../src/domain/MeResponse.js';
import type { TokenPair } from '../../../../src/domain/TokenPair.js';
import type { RefreshInvalidationReason } from '../../../../src/effects/refresh/refresh-effect.types.js';
import {
  applyRefreshInvalidate,
  updateRefreshState,
} from '../../../../src/effects/refresh/refresh-store-updater.js';
import type { AuthStorePort, BatchUpdate } from '../../../../src/effects/shared/auth-store.port.js';
import type {
  AuthEvent,
  AuthState,
  SecurityState,
  SessionState,
} from '../../../../src/types/auth.js';
import {
  createInitialSessionState,
  initialAuthState,
  initialSecurityState,
} from '../../../../src/types/auth-initial.js';

/* eslint-disable fp/no-mutation, functional/no-conditional-statements -- в тестах намеренно используем мутации и if для фиксации вызовов и type guards */

// ============================================================================
// 🔧 HELPERS
// ============================================================================

type CapturedStoreState = {
  authState: AuthState | null;
  sessionState: SessionState | null;
  securityState: SecurityState | null;
  events: AuthEvent['type'][];
  calls: string[];
  batchUpdates: BatchUpdate[][];
};

function createMockStore(): { store: AuthStorePort; captured: CapturedStoreState; } {
  const captured: CapturedStoreState = {
    authState: null,
    sessionState: null,
    securityState: null,
    events: [],
    calls: [],
    batchUpdates: [],
  };

  const store: AuthStorePort = {
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
    setStoreLocked: () => {
      // Mock implementation - в этих тестах не используется
    },
    getSessionState: () => captured.sessionState,
    getRefreshToken: () => 'refresh-token-from-store',
    batchUpdate: (updates: readonly BatchUpdate[]) => {
      captured.calls.push('batchUpdate');
      captured.batchUpdates.push([...updates]);
      updates.reduce<void>((_acc, update) => {
        void (
          update.type === 'setAuthState'
            ? (captured.calls.push('setAuthState'), (captured.authState = update.state))
            : update.type === 'setSessionState'
            ? (captured.calls.push('setSessionState'), (captured.sessionState = update.state))
            : update.type === 'setSecurityState'
            ? (captured.calls.push('setSecurityState'), (captured.securityState = update.state))
            : (captured.calls.push('applyEventType'), captured.events.push(update.event))
        );
        return undefined;
      }, undefined);
    },
  };

  return { store, captured };
}

function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-1',
    deviceType: 'desktop',
    ...overrides,
  };
}

function createTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-02T00:00:00.000Z',
    scope: ['read'],
    ...overrides,
  };
}

function createMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
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
}

// ============================================================================
// 🧪 TESTS — updateRefreshState
// ============================================================================

describe('updateRefreshState', () => {
  it('обновляет AuthState и SessionState с переданным deviceInfo и не изменяет SecurityState', () => {
    const { store, captured } = createMockStore();
    const deviceInfo = createDeviceInfo();
    const tokenPair = createTokenPair();
    const me = createMeResponse({
      features: { newFeature: true },
      context: { orgId: 'org-1' },
    });

    updateRefreshState(
      store,
      tokenPair,
      me,
      deviceInfo,
    );

    // batchUpdate вызван один раз
    expect(captured.calls).toContain('batchUpdate');
    expect(captured.calls.filter((c) => c === 'batchUpdate')).toHaveLength(1);

    // Внутри batchUpdate применены setAuthState, setSessionState и applyEventType(token_refreshed)
    expect(captured.calls).toContain('setAuthState');
    expect(captured.calls).toContain('setSessionState');
    expect(captured.calls).toContain('applyEventType');
    expect(captured.events).toEqual(['token_refreshed']);

    // AuthState: authenticated с user/roles/permissions/features/context
    const authState = captured.authState as Extract<
      AuthState,
      { readonly status: 'authenticated'; }
    >;
    expect(authState.status).toBe('authenticated');
    expect(authState.user).toEqual(me.user);
    expect(authState.session).toEqual(me.session);
    expect(authState.roles).toEqual(me.roles);
    expect(authState.permissions).toEqual(new Set(me.permissions));
    expect(Object.isFrozen(authState.permissions)).toBe(true);
    expect(authState.features).toEqual({ newFeature: true });
    expect(authState.context).toEqual({ orgId: 'org-1' });
    expect(Object.isFrozen(authState)).toBe(true);

    // SessionState построен из переданного deviceInfo (copy-on-write)
    const sessionState = captured.sessionState as Extract<
      SessionState,
      { readonly status: 'active'; }
    >;
    expect(sessionState.status).toBe('active');
    expect(sessionState.sessionId).toBe('session-1');
    expect(sessionState.device).toEqual(deviceInfo);
    expect(sessionState.device).not.toBe(deviceInfo);

    // SecurityState не изменяется refresh-store-updater'ом
    expect(captured.securityState).toBeNull();
  });

  it('использует default DeviceInfo если deviceInfo не передан', () => {
    const { store, captured } = createMockStore();
    const tokenPair = createTokenPair();
    const me = createMeResponse();

    updateRefreshState(
      store,
      tokenPair,
      me,
      // deviceInfo не передаём, должен быть использован default
    );

    const sessionState = captured.sessionState as Extract<
      SessionState,
      { readonly status: 'active'; }
    >;
    expect(sessionState.status).toBe('active');
    expect(sessionState.device).toEqual({
      deviceId: '',
      deviceType: 'unknown',
    });
  });

  it('создаёт AuthState без session и SessionState = null если me.session отсутствует', () => {
    const { store, captured } = createMockStore();
    const tokenPair = createTokenPair();
    // Создаём MeResponse без session поля
    const meWithoutSession: MeResponse = {
      user: {
        id: 'user-123',
        email: 'user@example.com',
        emailVerified: true,
      },
      roles: ['user'],
      permissions: ['profile.read'],
      // session отсутствует
    };

    updateRefreshState(
      store,
      tokenPair,
      meWithoutSession,
    );

    const authState = captured.authState as Extract<
      AuthState,
      { readonly status: 'authenticated'; }
    >;
    expect(authState.status).toBe('authenticated');
    expect(authState.session).toBeUndefined();

    // buildSessionState возвращает null → SessionState в store должен быть null
    expect(captured.sessionState).toBeNull();
  });
});

// ============================================================================
// 🧪 TESTS — applyRefreshInvalidate
// ============================================================================

describe('applyRefreshInvalidate', () => {
  it('атомарно сбрасывает состояния через batchUpdate для причины expired', () => {
    const { store, captured } = createMockStore();

    applyRefreshInvalidate(
      store,
      'expired',
    );

    // batchUpdate был вызван один раз
    expect(captured.calls).toContain('batchUpdate');
    expect(captured.calls.filter((c) => c === 'batchUpdate')).toHaveLength(1);
    expect(captured.batchUpdates).toHaveLength(1);

    // eslint-disable-next-line ai-security/model-poisoning -- тестовые данные создаются локально и не используются для обучения моделек
    const batchUpdate = captured.batchUpdates[0];
    expect(batchUpdate).toBeDefined();
    expect(batchUpdate).toHaveLength(4);

    // Порядок действий: setAuthState, setSessionState, setSecurityState, applyEventType
    expect(batchUpdate?.[0]?.type).toBe('setAuthState');
    expect(batchUpdate?.[1]?.type).toBe('setSessionState');
    expect(batchUpdate?.[2]?.type).toBe('setSecurityState');
    expect(batchUpdate?.[3]?.type).toBe('applyEventType');

    const authUpdate = batchUpdate?.[0];
    const sessionUpdate = batchUpdate?.[1];
    const securityUpdate = batchUpdate?.[2];
    const eventUpdate = batchUpdate?.[3];

    if (authUpdate?.type === 'setAuthState') {
      expect(authUpdate.state).toBe(initialAuthState);
    }
    if (sessionUpdate?.type === 'setSessionState') {
      expect(sessionUpdate.state).toBe(createInitialSessionState());
    }
    if (securityUpdate?.type === 'setSecurityState') {
      expect(securityUpdate.state).toBe(initialSecurityState);
    }
    if (eventUpdate?.type === 'applyEventType') {
      expect(eventUpdate.event).toBe('session_revoked');
    }

    // Итоговое состояние стора соответствует каноническим initial states
    expect(captured.authState).toBe(initialAuthState);
    expect(captured.sessionState).toBeNull();
    expect(captured.securityState).toBe(initialSecurityState);
    expect(captured.events).toEqual(['session_revoked']);
  });

  it('покрывает ветку reason === "unknown" и всё равно применяет reset через batchUpdate', () => {
    const { store, captured } = createMockStore();

    const reason: RefreshInvalidationReason = 'unknown';
    applyRefreshInvalidate(
      store,
      reason,
    );

    // Проверяем, что reset был применён так же, как и для других причин
    expect(captured.calls).toContain('batchUpdate');
    expect(captured.batchUpdates).toHaveLength(1);

    // eslint-disable-next-line ai-security/model-poisoning -- тестовые данные создаются локально и не используются для обучения моделек
    const batchUpdate = captured.batchUpdates[0];
    expect(batchUpdate?.[0]?.type).toBe('setAuthState');
    expect(batchUpdate?.[1]?.type).toBe('setSessionState');
    expect(batchUpdate?.[2]?.type).toBe('setSecurityState');
    expect(batchUpdate?.[3]?.type).toBe('applyEventType');
    expect(captured.events).toEqual(['session_revoked']);
  });
});

/* eslint-enable fp/no-mutation, functional/no-conditional-statements */
