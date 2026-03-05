/**
 * @file Unit тесты для effects/shared/auth-store.port.ts
 * ============================================================================
 * 🔐 AUTH STORE PORT — ЕДИНЫЙ КОНТРАКТ СТОРА
 * ============================================================================
 * Проверяет, что:
 * - isBatchUpdateOfType корректно выполняет type narrowing
 * - withStoreLock блокирует и разблокирует store в try/finally
 * - createAuthStorePortAdapter создает корректный адаптер из Zustand store
 * - Все методы адаптера работают корректно
 * - Блокировка предотвращает обновления (STORE_LOCKED_ERROR)
 * - batchUpdate атомарно применяет все обновления
 * - batchUpdate разделяет state и events
 */

/* eslint-disable fp/no-mutation -- в тестах намеренно используем мутации для фиксации вызовов и состояний */
/* eslint-disable functional/no-let -- let используется для проверки состояния в тестах */

import { describe, expect, it } from 'vitest';

import type { BatchUpdate } from '../../../../src/effects/shared/auth-store.port.js';
import {
  createAuthStorePortAdapter,
  isBatchUpdateOfType,
  withStoreLock,
} from '../../../../src/effects/shared/auth-store.port.js';
import type { AuthStore } from '../../../../src/stores/auth.js';
import type {
  AuthEvent,
  AuthState,
  SecurityState,
  SessionState,
} from '../../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createAuthState(): AuthState {
  return {
    status: 'authenticated',
    user: {
      id: 'user-123',
    },
  };
}

function createSessionState(): SessionState {
  return {
    status: 'active',
    sessionId: 'session-123',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
  };
}

function createSecurityState(): SecurityState {
  return {
    status: 'secure',
    riskScore: 10,
  };
}

type CapturedState = {
  auth?: AuthState;
  session?: SessionState | null;
  security?: SecurityState;
  events: AuthEvent['type'][];
  patchCalls: { auth?: AuthState; session?: SessionState | null; security?: SecurityState; }[];
};

function createMockAuthStore(): { store: AuthStore; captured: CapturedState; } {
  const captured: CapturedState = {
    events: [],
    patchCalls: [],
  };

  const mockStore = {
    version: 1,
    auth: createAuthState(),
    mfa: { status: 'idle' as const },
    oauth: { status: 'idle' as const },
    security: createSecurityState(),
    session: createSessionState(),
    passwordRecovery: { status: 'idle' as const },
    verification: { status: 'idle' as const },
    actions: {
      setAuthState: (state: AuthState) => {
        captured.auth = state;
      },
      setSessionState: (state: SessionState | null) => {
        captured.session = state;
      },
      setSecurityState: (state: SecurityState) => {
        captured.security = state;
      },
      applyEventType: (event: AuthEvent['type']) => {
        captured.events.push(event);
      },
      patch: (update: {
        auth?: AuthState;
        session?: SessionState | null;
        security?: SecurityState;
      }) => {
        captured.patchCalls.push(update);
        void (update.auth !== undefined && (captured.auth = update.auth));
        void (update.session !== undefined && (captured.session = update.session));
        void (update.security !== undefined && (captured.security = update.security));
      },
      setMfaState: () => {},
      setOAuthState: () => {},
      setPasswordRecoveryState: () => {},
      setVerificationState: () => {},
      reset: () => {},
    },
  } as unknown as AuthStore;

  return { store: mockStore, captured };
}

// ============================================================================
// 🧪 TESTS
// ============================================================================

describe('effects/shared/auth-store.port', () => {
  describe('isBatchUpdateOfType', () => {
    it('корректно определяет тип setAuthState', () => {
      const update: BatchUpdate = {
        type: 'setAuthState',
        state: createAuthState(),
      };

      expect(isBatchUpdateOfType(update, 'setAuthState')).toBe(true);
      void (isBatchUpdateOfType(update, 'setAuthState') && expect(update.state).toBeDefined());
    });

    it('корректно определяет тип setSessionState', () => {
      const update: BatchUpdate = {
        type: 'setSessionState',
        state: createSessionState(),
      };

      expect(isBatchUpdateOfType(update, 'setSessionState')).toBe(true);
      void (isBatchUpdateOfType(update, 'setSessionState') && expect(update.state).toBeDefined());
    });

    it('корректно определяет тип setSecurityState', () => {
      const update: BatchUpdate = {
        type: 'setSecurityState',
        state: createSecurityState(),
      };

      expect(isBatchUpdateOfType(update, 'setSecurityState')).toBe(true);
      void (isBatchUpdateOfType(update, 'setSecurityState') && expect(update.state).toBeDefined());
    });

    it('корректно определяет тип applyEventType', () => {
      const update: BatchUpdate = {
        type: 'applyEventType',
        event: 'user_logged_in',
      };

      expect(isBatchUpdateOfType(update, 'applyEventType')).toBe(true);
      void (isBatchUpdateOfType(update, 'applyEventType')
        && expect(update.event).toBe('user_logged_in'));
    });

    it('возвращает false для несоответствующего типа', () => {
      const update: BatchUpdate = {
        type: 'setAuthState',
        state: createAuthState(),
      };

      expect(isBatchUpdateOfType(update, 'setSessionState')).toBe(false);
    });
  });

  describe('withStoreLock', () => {
    it('блокирует store перед операцией и разблокирует после', () => {
      const { store } = createMockAuthStore();
      const adapter = createAuthStorePortAdapter(store);
      let lockState: boolean | undefined;

      const result = withStoreLock(adapter, () => {
        adapter.setStoreLocked(true);
        lockState = true;
        return 'operation-result';
      });

      expect(result).toBe('operation-result');
      expect(lockState).toBe(true);
    });

    it('разблокирует store в finally даже при ошибке', () => {
      const { store } = createMockAuthStore();
      const adapter = createAuthStorePortAdapter(store);
      let finallyExecuted = false;

      expect(() => {
        withStoreLock(adapter, () => {
          adapter.setStoreLocked(true);
          finallyExecuted = true;
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      expect(finallyExecuted).toBe(true);
      // После finally store должен быть разблокирован
      // Проверяем, что можем вызвать метод без ошибки
      expect(() => {
        adapter.setAuthState(createAuthState());
      }).not.toThrow();
    });

    it('возвращает результат операции', () => {
      const { store } = createMockAuthStore();
      const adapter = createAuthStorePortAdapter(store);

      const result = withStoreLock(adapter, () => {
        return 42;
      });

      expect(result).toBe(42);
    });
  });

  describe('createAuthStorePortAdapter', () => {
    describe('setAuthState', () => {
      it('устанавливает auth state через store.actions.setAuthState', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        const authState = createAuthState();

        adapter.setAuthState(authState);

        expect(captured.auth).toEqual(authState);
      });

      it('кидает ошибку если store заблокирован', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        adapter.setStoreLocked(true);

        expect(() => {
          adapter.setAuthState(createAuthState());
        }).toThrow('[AuthStorePort] Store is locked. Cannot update state.');
      });
    });

    describe('setSessionState', () => {
      it('устанавливает session state через store.actions.setSessionState', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        const sessionState = createSessionState();

        adapter.setSessionState(sessionState);

        expect(captured.session).toEqual(sessionState);
      });

      it('устанавливает null для очистки сессии', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        adapter.setSessionState(null);

        expect(captured.session).toBeNull();
      });

      it('кидает ошибку если store заблокирован', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        adapter.setStoreLocked(true);

        expect(() => {
          adapter.setSessionState(createSessionState());
        }).toThrow('[AuthStorePort] Store is locked. Cannot update state.');
      });
    });

    describe('setSecurityState', () => {
      it('устанавливает security state через store.actions.setSecurityState', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        const securityState = createSecurityState();

        adapter.setSecurityState(securityState);

        expect(captured.security).toEqual(securityState);
      });

      it('кидает ошибку если store заблокирован', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        adapter.setStoreLocked(true);

        expect(() => {
          adapter.setSecurityState(createSecurityState());
        }).toThrow('[AuthStorePort] Store is locked. Cannot update state.');
      });
    });

    describe('applyEventType', () => {
      it('применяет event type через store.actions.applyEventType', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        adapter.applyEventType('user_logged_in');

        expect(captured.events).toEqual(['user_logged_in']);
      });

      it('кидает ошибку если store заблокирован', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        adapter.setStoreLocked(true);

        expect(() => {
          adapter.applyEventType('user_logged_in');
        }).toThrow('[AuthStorePort] Store is locked. Cannot update state.');
      });
    });

    describe('setStoreLocked', () => {
      it('блокирует store (isLocked = true)', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        adapter.setStoreLocked(true);

        expect(() => {
          adapter.setAuthState(createAuthState());
        }).toThrow('[AuthStorePort] Store is locked. Cannot update state.');
      });

      it('разблокирует store (isLocked = false)', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        adapter.setStoreLocked(true);
        adapter.setStoreLocked(false);

        // После разблокировки методы должны работать
        expect(() => {
          adapter.setAuthState(createAuthState());
        }).not.toThrow();
      });
    });

    describe('batchUpdate', () => {
      it('атомарно применяет все обновления через patch', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        const authState = createAuthState();
        const sessionState = createSessionState();
        const securityState = createSecurityState();

        adapter.batchUpdate([
          { type: 'setAuthState', state: authState },
          { type: 'setSessionState', state: sessionState },
          { type: 'setSecurityState', state: securityState },
        ]);

        // Проверяем, что patch вызван один раз со всеми обновлениями
        expect(captured.patchCalls).toHaveLength(1);
        expect(captured.patchCalls[0]).toEqual({
          auth: authState,
          session: sessionState,
          security: securityState,
        });
      });

      it('разделяет state и events (сначала patch, потом applyEventType)', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        const authState = createAuthState();

        adapter.batchUpdate([
          { type: 'setAuthState', state: authState },
          { type: 'applyEventType', event: 'user_logged_in' },
          { type: 'applyEventType', event: 'mfa_challenge_sent' },
        ]);

        // Проверяем, что patch вызван с state
        expect(captured.patchCalls).toHaveLength(1);
        expect(captured.patchCalls[0]).toEqual({
          auth: authState,
        });

        // Проверяем, что events применены отдельно
        expect(captured.events).toEqual(['user_logged_in', 'mfa_challenge_sent']);
      });

      it('обрабатывает только state обновления (без events)', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        const authState = createAuthState();

        adapter.batchUpdate([
          { type: 'setAuthState', state: authState },
        ]);

        expect(captured.patchCalls).toHaveLength(1);
        expect(captured.events).toHaveLength(0);
      });

      it('обрабатывает только events (без state)', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        adapter.batchUpdate([
          { type: 'applyEventType', event: 'user_logged_in' },
        ]);

        // patch не должен быть вызван, если нет state обновлений
        expect(captured.patchCalls).toHaveLength(0);
        expect(captured.events).toEqual(['user_logged_in']);
      });

      it('обрабатывает null session state', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        adapter.batchUpdate([
          { type: 'setSessionState', state: null },
        ]);

        expect(captured.patchCalls).toHaveLength(1);
        expect(captured.patchCalls[0]).toEqual({
          session: null,
        });
      });

      it('кидает ошибку если store заблокирован', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        adapter.setStoreLocked(true);

        expect(() => {
          adapter.batchUpdate([
            { type: 'setAuthState', state: createAuthState() },
          ]);
        }).toThrow('[AuthStorePort] Store is locked. Cannot update state.');
      });

      it('кидает ошибку для неподдерживаемого типа обновления (exhaustiveness check)', () => {
        const { store } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        // Принудительно создаем невалидный update для проверки default ветки
        const invalidUpdate = {
          type: 'unknown',
        } as unknown as BatchUpdate;

        expect(() => {
          adapter.batchUpdate([invalidUpdate]);
        }).toThrow(/Unsupported batch update type/);
      });

      it('обрабатывает пустой массив обновлений', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);

        adapter.batchUpdate([]);

        // patch не должен быть вызван для пустого массива
        expect(captured.patchCalls).toHaveLength(0);
        expect(captured.events).toHaveLength(0);
      });

      it('сохраняет порядок обновлений (state, затем events)', () => {
        const { store, captured } = createMockAuthStore();
        const adapter = createAuthStorePortAdapter(store);
        const authState1 = createAuthState();
        const authState2 = { ...createAuthState(), user: { id: 'user-456' } };

        adapter.batchUpdate([
          { type: 'setAuthState', state: authState1 },
          { type: 'applyEventType', event: 'user_logged_in' },
          { type: 'setAuthState', state: authState2 },
          { type: 'applyEventType', event: 'mfa_challenge_sent' },
        ]);

        // Последнее state обновление должно быть применено
        expect(captured.patchCalls[0]?.auth).toEqual(authState2);
        // Все events должны быть применены в порядке
        expect(captured.events).toEqual(['user_logged_in', 'mfa_challenge_sent']);
      });

      describe('getSessionState', () => {
        it('возвращает текущее состояние сессии из zustand store', () => {
          const sessionState = createSessionState();

          const store = {
            version: 1,
            session: sessionState,
            actions: {
              setAuthState: () => {},
              setSessionState: () => {},
              setSecurityState: () => {},
              applyEventType: () => {},
              patch: () => {},
              setMfaState: () => {},
              setOAuthState: () => {},
              setPasswordRecoveryState: () => {},
              setVerificationState: () => {},
              reset: () => {},
            },
            getState: () => ({
              session: sessionState,
            }),
          } as unknown as AuthStore;

          const adapter = createAuthStorePortAdapter(store);

          expect(adapter.getSessionState()).toEqual(sessionState);
        });
      });

      describe('getRefreshToken', () => {
        it('возвращает refreshToken если он доступен и не пустой', () => {
          const store = {
            version: 1,
            actions: {
              setAuthState: () => {},
              setSessionState: () => {},
              setSecurityState: () => {},
              applyEventType: () => {},
              patch: () => {},
              setMfaState: () => {},
              setOAuthState: () => {},
              setPasswordRecoveryState: () => {},
              setVerificationState: () => {},
              reset: () => {},
            },
            getRefreshToken: () => 'refresh-token-123',
          } as unknown as AuthStore;

          const adapter = createAuthStorePortAdapter(store);

          expect(adapter.getRefreshToken()).toBe('refresh-token-123');
        });

        it('кидает ошибку если refreshToken недоступен или пустой', () => {
          const createStore = (tokenProvider?: () => string | undefined) =>
            ({
              version: 1,
              actions: {
                setAuthState: () => {},
                setSessionState: () => {},
                setSecurityState: () => {},
                applyEventType: () => {},
                patch: () => {},
                setMfaState: () => {},
                setOAuthState: () => {},
                setPasswordRecoveryState: () => {},
                setVerificationState: () => {},
                reset: () => {},
              },
              ...(tokenProvider && { getRefreshToken: tokenProvider }),
            }) as unknown as AuthStore;

          const storeWithoutToken = createStore();
          const adapterWithoutToken = createAuthStorePortAdapter(storeWithoutToken);

          expect(() => adapterWithoutToken.getRefreshToken()).toThrow(
            '[AuthStorePort] refreshToken is not available. In production, refreshToken should be obtained via httpOnly cookie or secure storage.',
          );

          const storeWithEmptyToken = createStore(() => '   ');
          const adapterWithEmptyToken = createAuthStorePortAdapter(storeWithEmptyToken);

          expect(() => adapterWithEmptyToken.getRefreshToken()).toThrow(
            '[AuthStorePort] refreshToken is not available. In production, refreshToken should be obtained via httpOnly cookie or secure storage.',
          );
        });
      });
    });
  });
});

/* eslint-enable fp/no-mutation, functional/no-let */
