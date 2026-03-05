/**
 * @file Unit тесты для effects/logout/logout-store-updater.ts
 * ============================================================================
 * 🔐 LOGOUT STORE UPDATER — ЕДИНАЯ ТОЧКА СБРОСА СОСТОЯНИЙ
 * ============================================================================
 * Проверяет, что:
 * - applyLogoutReset атомарно сбрасывает все состояния через batchUpdate
 * - Используются канонические initial states из auth-initial.ts
 * - Применяется правильный event type 'user_logged_out'
 * - Опциональный context параметр обрабатывается корректно
 * - Порядок действий в batchUpdate фиксирован и логически атомарен
 */

import { describe, expect, it } from 'vitest';

import { applyLogoutReset } from '../../../../src/effects/logout/logout-store-updater.js';
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

/* eslint-disable fp/no-mutation, functional/no-conditional-statements -- в тестах намеренно используем мутации для фиксации вызовов и состояний, type guards требуют if */

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
      // Mock implementation - не используется в текущих тестах
    },
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
    getSessionState: () => captured.sessionState,
    getRefreshToken: () => 'test-refresh-token',
  };

  return { store, captured };
}

// ============================================================================
// 🧪 TESTS
// ============================================================================

describe('applyLogoutReset', () => {
  it('атомарно сбрасывает все состояния через batchUpdate', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store);

    // batchUpdate был вызван один раз
    expect(captured.calls).toContain('batchUpdate');
    expect(captured.calls.filter((c) => c === 'batchUpdate')).toHaveLength(1);
    expect(captured.batchUpdates).toHaveLength(1);

    // Проверяем, что все действия были применены
    expect(captured.calls).toContain('setAuthState');
    expect(captured.calls).toContain('setSessionState');
    expect(captured.calls).toContain('setSecurityState');
    expect(captured.calls).toContain('applyEventType');
  });

  it('использует канонические initial states из auth-initial.ts', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store);

    // AuthState: unauthenticated (initialAuthState)
    expect(captured.authState).toEqual(initialAuthState);
    expect(captured.authState?.status).toBe('unauthenticated');

    // SessionState: null (createInitialSessionState())
    expect(captured.sessionState).toBeNull();
    expect(captured.sessionState).toBe(createInitialSessionState());

    // SecurityState: secure (initialSecurityState)
    expect(captured.securityState).toEqual(initialSecurityState);
    const secureState = captured.securityState as Extract<
      SecurityState,
      { readonly status: 'secure'; }
    >;
    expect(secureState.status).toBe('secure');
  });

  it('применяет правильный event type user_logged_out', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store);

    // Проверяем, что событие 'user_logged_out' было применено
    expect(captured.events).toContain('user_logged_out');
    expect(captured.events).toEqual(['user_logged_out']);
  });

  it('применяет все действия в правильном порядке через batchUpdate', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store);

    // Проверяем порядок действий в batchUpdate
    // eslint-disable-next-line ai-security/model-poisoning -- тестовые данные создаются локально
    const batchUpdate = captured.batchUpdates[0];
    expect(batchUpdate).toBeDefined();
    expect(batchUpdate).toHaveLength(4);

    // Порядок: setAuthState, setSessionState, setSecurityState, applyEventType
    expect(batchUpdate?.[0]?.type).toBe('setAuthState');
    expect(batchUpdate?.[1]?.type).toBe('setSessionState');
    expect(batchUpdate?.[2]?.type).toBe('setSecurityState');
    expect(batchUpdate?.[3]?.type).toBe('applyEventType');

    // Проверяем значения с type guards
    const authUpdate = batchUpdate?.[0];
    const sessionUpdate = batchUpdate?.[1];
    const securityUpdate = batchUpdate?.[2];
    const eventUpdate = batchUpdate?.[3];

    if (authUpdate?.type === 'setAuthState') {
      expect(authUpdate.state).toEqual(initialAuthState);
    }
    if (sessionUpdate?.type === 'setSessionState') {
      expect(sessionUpdate.state).toBeNull();
    }
    if (securityUpdate?.type === 'setSecurityState') {
      expect(securityUpdate.state).toEqual(initialSecurityState);
    }
    if (eventUpdate?.type === 'applyEventType') {
      expect(eventUpdate.event).toBe('user_logged_out');
    }
  });

  it('принимает опциональный context параметр без ошибок', () => {
    const { store, captured } = createMockStore();

    // Вызываем с context
    applyLogoutReset(store, {
      reason: 'user_initiated',
      // eslint-disable-next-line @livai/rag/source-citation -- тестовые данные, не требуют citation
      data: { source: 'profile_menu' },
    });

    // Функция должна выполниться без ошибок
    expect(captured.calls).toContain('batchUpdate');
    expect(captured.authState).toEqual(initialAuthState);
    expect(captured.sessionState).toBeNull();
    expect(captured.securityState).toEqual(initialSecurityState);
    expect(captured.events).toEqual(['user_logged_out']);
  });

  it('принимает context с только reason', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store, {
      reason: 'session_expired',
    });

    expect(captured.calls).toContain('batchUpdate');
    expect(captured.authState).toEqual(initialAuthState);
    expect(captured.events).toEqual(['user_logged_out']);
  });

  it('принимает context с только data', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store, {
      data: { timestamp: 1234567890 },
    });

    expect(captured.calls).toContain('batchUpdate');
    expect(captured.authState).toEqual(initialAuthState);
    expect(captured.events).toEqual(['user_logged_out']);
  });

  it('принимает пустой context объект', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store, {});

    expect(captured.calls).toContain('batchUpdate');
    expect(captured.authState).toEqual(initialAuthState);
    expect(captured.events).toEqual(['user_logged_out']);
  });

  it('не вызывает отдельные методы store напрямую, только через batchUpdate', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store);

    // Проверяем, что batchUpdate был вызван
    expect(captured.calls).toContain('batchUpdate');

    // Проверяем, что отдельные методы были вызваны только внутри batchUpdate
    // (они вызываются в mock реализации batchUpdate)
    // eslint-disable-next-line ai-security/model-poisoning -- тестовые данные создаются локально
    const batchUpdateIndex = captured.calls.indexOf('batchUpdate');
    const setAuthStateIndex = captured.calls.indexOf('setAuthState', batchUpdateIndex);
    const setSessionStateIndex = captured.calls.indexOf('setSessionState', batchUpdateIndex);
    const setSecurityStateIndex = captured.calls.indexOf('setSecurityState', batchUpdateIndex);
    const applyEventTypeIndex = captured.calls.indexOf('applyEventType', batchUpdateIndex);

    // Все методы должны быть вызваны после batchUpdate
    expect(setAuthStateIndex).toBeGreaterThan(batchUpdateIndex);
    expect(setSessionStateIndex).toBeGreaterThan(batchUpdateIndex);
    expect(setSecurityStateIndex).toBeGreaterThan(batchUpdateIndex);
    expect(applyEventTypeIndex).toBeGreaterThan(batchUpdateIndex);
  });

  it('гарантирует атомарность обновлений через batchUpdate', () => {
    const { store, captured } = createMockStore();

    // Устанавливаем начальные состояния
    store.setAuthState({
      status: 'authenticated',
      user: { id: 'user-123' },
    });
    store.setSessionState({
      status: 'active',
      sessionId: 'session-123',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });
    store.setSecurityState({
      status: 'risk_detected',
      riskLevel: 'high',
      riskScore: 80,
    });

    // Вызываем logout reset
    applyLogoutReset(store);

    // Проверяем, что все состояния были сброшены атомарно
    expect(captured.authState).toEqual(initialAuthState);
    expect(captured.sessionState).toBeNull();
    expect(captured.securityState).toEqual(initialSecurityState);
    expect(captured.events).toContain('user_logged_out');

    // batchUpdate должен быть вызван один раз для всех обновлений
    expect(captured.batchUpdates).toHaveLength(1);
    expect(captured.batchUpdates[0]).toHaveLength(4);
  });

  it('использует те же initial states, что и экспортируются из auth-initial.ts', () => {
    const { store, captured } = createMockStore();

    applyLogoutReset(store);

    // Проверяем, что используются именно канонические константы
    // eslint-disable-next-line ai-security/model-poisoning -- тестовые данные создаются локально
    const batchUpdate = captured.batchUpdates[0];
    const authUpdate = batchUpdate?.[0];
    const sessionUpdate = batchUpdate?.[1];
    const securityUpdate = batchUpdate?.[2];

    if (authUpdate?.type === 'setAuthState') {
      expect(authUpdate.state).toBe(initialAuthState);
    }
    if (sessionUpdate?.type === 'setSessionState') {
      expect(sessionUpdate.state).toBe(createInitialSessionState());
    }
    if (securityUpdate?.type === 'setSecurityState') {
      expect(securityUpdate.state).toBe(initialSecurityState);
    }

    // Проверяем, что это те же объекты (reference equality для frozen объектов)
    expect(captured.authState).toBe(initialAuthState);
    expect(captured.securityState).toBe(initialSecurityState);
  });
});

/* eslint-enable fp/no-mutation, functional/no-conditional-statements */
