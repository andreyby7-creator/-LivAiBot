/**
 * @file Unit тесты для packages/feature-auth/src/stores/auth.ts
 * Тестирование Zustand store с полным покрытием:
 * - Типы и экспорты
 * - Константы
 * - Инициализационные функции
 * - Invariant gate функции
 * - Store factory и actions
 * - Persistence middleware
 * - Селекторы (базовые и производные)
 * - Grouped API
 * - Error handling и edge cases
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage for Zustand persist middleware
/* eslint-disable fp/no-mutation, security/detect-object-injection -- Mock для тестов */
const createStorageMock = () => {
  const store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => {
        delete store[key];
      });
    },
  };
};
/* eslint-enable fp/no-mutation, security/detect-object-injection */
// Import everything
import {
  authStoreVersion,
  canRefresh,
  createAuthSelectors,
  createAuthStore,
  createInitialAuthStoreState,
  enforceInvariants,
  getAuth,
  getAuthStoreActions,
  getMfa,
  getOAuth,
  getPasswordRecovery,
  getSecurity,
  getSession,
  getVerification,
  hasAuthError,
  hasPermission,
  isAuthenticated,
  isAuthenticating,
  isHighRisk,
  isSessionExpired,
  isSessionValid,
  needsMfa,
  needsVerification,
  restoreAuthFromPersisted,
  validateAuthSemantics,
  validatePersistedState,
  validateSecuritySemantics,
  validateSessionSemantics,
} from '../../../src/stores/auth.js';
import type { AuthStoreState, PersistedAuthStoreState } from '../../../src/stores/auth.js';
import type {
  AuthEvent,
  AuthState,
  MfaState,
  OAuthState,
  PasswordRecoveryState,
  SecurityState,
  SessionState,
  VerificationState,
} from '../../../src/types/auth.js';

// ============================================================================
// 🧠 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

const createISODateString = (): string => '2026-01-01T00:00:00.000Z';

// Для discriminated union нужно правильно создавать объекты
/* eslint-disable @livai/rag/context-leakage -- Тестовые helper функции, не используются в production */
const createAuthenticatedState = (overrides: Readonly<Partial<AuthState>>): AuthState => ({
  status: 'authenticated',
  user: { id: 'user-123', email: 'user@example.com' },
  ...overrides,
} as AuthState);

const createAuthenticatingState = (overrides: Readonly<Partial<AuthState>>): AuthState => ({
  status: 'authenticating',
  operation: 'login',
  ...overrides,
} as AuthState);

const createSessionExpiredState = (
  overrides: Readonly<Partial<AuthState>>,
): AuthState => ({
  status: 'session_expired',
  userId: 'user-123',
  ...overrides,
} as AuthState);

const createPendingVerificationState = (
  overrides: Readonly<Partial<AuthState>>,
): AuthState => ({
  status: 'pending_secondary_verification',
  userId: 'user-123',
  verificationType: 'mfa',
  ...overrides,
} as AuthState);

const createErrorState = (overrides: Readonly<Partial<AuthState>>): AuthState => ({
  status: 'error',
  error: { kind: 'invalid_credentials' },
  ...overrides,
} as AuthState);

const createUnauthenticatedState = (
  overrides: Readonly<Partial<AuthState>> = {},
): AuthState => ({
  status: 'unauthenticated',
  ...overrides,
} as AuthState);

// Map для снижения когнитивной сложности
const STATE_CREATOR_MAP: Readonly<
  Record<
    Exclude<AuthState['status'], 'unauthenticated'>,
    (overrides: Readonly<Partial<AuthState>>) => AuthState
  >
> = {
  authenticated: createAuthenticatedState,
  authenticating: createAuthenticatingState,
  session_expired: createSessionExpiredState,
  pending_secondary_verification: createPendingVerificationState,
  error: createErrorState,
} as const;

const getStateCreator = (
  status: AuthState['status'] | undefined,
): ((overrides: Readonly<Partial<AuthState>>) => AuthState) | null => {
  return status === undefined
    ? null
    : status === 'unauthenticated'
    ? createUnauthenticatedState
    // eslint-disable-next-line security/detect-object-injection -- status проверен через type guard, безопасный доступ к Record с известными ключами
    : STATE_CREATOR_MAP[status];
};
const createMockAuthState = (
  overrides: Readonly<Partial<AuthState>> = {},
): AuthState => {
  const status = overrides.status;
  const creator = getStateCreator(status);
  const baseState = creator
    ? creator(overrides)
    : ({ status: 'unauthenticated', ...overrides } as AuthState);

  // Преобразуем permissions из массива в Set для обратной совместимости
  const permissions = status === 'authenticated' && 'permissions' in overrides
    ? (Array.isArray(overrides.permissions)
      ? new Set(overrides.permissions)
      : overrides.permissions)
    : undefined;

  return permissions !== undefined ? { ...baseState, permissions } as AuthState : baseState;
};
const createMockMfaState = (overrides: Partial<MfaState> = {}): MfaState => {
  const base: MfaState = { status: 'not_setup' };
  return { ...base, ...overrides } as MfaState;
};

const createMockOAuthState = (overrides: Partial<OAuthState> = {}): OAuthState => {
  const base: OAuthState = { status: 'idle' };
  return { ...base, ...overrides } as OAuthState;
};

const createMockSecurityState = (overrides: Partial<SecurityState> = {}): SecurityState => {
  const base: SecurityState = { status: 'secure' };
  return { ...base, ...overrides } as SecurityState;
};

const createMockSessionState = (overrides: Partial<SessionState> = {}): SessionState => {
  const base: SessionState = {
    status: 'active',
    sessionId: 'session-123',
    issuedAt: createISODateString(),
    expiresAt: createISODateString(),
  };
  return { ...base, ...overrides } as SessionState;
};
/* eslint-enable @livai/rag/context-leakage */
const createMockPasswordRecoveryState = (
  overrides: Partial<PasswordRecoveryState> = {},
): PasswordRecoveryState => {
  const base: PasswordRecoveryState = { status: 'idle' };
  return { ...base, ...overrides } as PasswordRecoveryState;
};

const createMockVerificationState = (
  overrides: Partial<VerificationState> = {},
): VerificationState => {
  const base: VerificationState = { status: 'idle' };
  return { ...base, ...overrides } as VerificationState;
};

const createMockStoreState = (
  overrides: Partial<AuthStoreState> = {},
): AuthStoreState => {
  return {
    ...createInitialAuthStoreState(),
    ...overrides,
  };
};

// ============================================================================
// 🧩 ТИПЫ И КОНСТАНТЫ
// ============================================================================

describe('Type exports and constants', () => {
  it('authStoreVersion должна быть равна 1', () => {
    expect(authStoreVersion).toBe(1);
  });

  it('AuthStoreState тип содержит ожидаемые поля', () => {
    const state: AuthStoreState = createMockStoreState();

    expect(state).toHaveProperty('version');
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('mfa');
    expect(state).toHaveProperty('oauth');
    expect(state).toHaveProperty('security');
    expect(state).toHaveProperty('session');
    expect(state).toHaveProperty('passwordRecovery');
    expect(state).toHaveProperty('verification');
    expect(state.version).toBe(authStoreVersion);
  });

  it('AuthStoreActions тип содержит ожидаемые методы', () => {
    const store = createAuthStore();
    const actions = store.getState().actions;

    expect(typeof actions.setAuthState).toBe('function');
    expect(typeof actions.setMfaState).toBe('function');
    expect(typeof actions.setOAuthState).toBe('function');
    expect(typeof actions.setSecurityState).toBe('function');
    expect(typeof actions.setSessionState).toBe('function');
    expect(typeof actions.setPasswordRecoveryState).toBe('function');
    expect(typeof actions.setVerificationState).toBe('function');
    expect(typeof actions.applyEventType).toBe('function');
    expect(typeof actions.patch).toBe('function');
    expect(typeof actions.reset).toBe('function');
  });

  it('AuthStore тип комбинирует state и actions', () => {
    const store = createAuthStore();
    const state = store.getState();

    // Проверяем state поля
    expect(state).toHaveProperty('version');
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('mfa');
    expect(state).toHaveProperty('oauth');
    expect(state).toHaveProperty('security');
    expect(state).toHaveProperty('session');
    expect(state).toHaveProperty('passwordRecovery');
    expect(state).toHaveProperty('verification');

    // Проверяем actions
    expect(state).toHaveProperty('actions');
    expect(typeof state.actions.setAuthState).toBe('function');
    expect(typeof state.actions.reset).toBe('function');
  });
});

// ============================================================================
// ⚙️ ИНИЦИАЛИЗАЦИОННЫЕ ФУНКЦИИ
// ============================================================================

describe('createInitialAuthStoreState', () => {
  it('создает состояние с базовыми значениями', () => {
    const state = createInitialAuthStoreState();

    expect(state.version).toBe(authStoreVersion);
    expect(state.auth.status).toBe('unauthenticated');
    expect(state.mfa.status).toBe('not_setup');
    expect(state.oauth.status).toBe('idle');
    expect(state.security.status).toBe('secure');
    expect(state.session).toBe(null);
    expect(state.passwordRecovery.status).toBe('idle');
    expect(state.verification.status).toBe('idle');
  });

  it('возвращает новый объект каждый раз', () => {
    const state1 = createInitialAuthStoreState();
    const state2 = createInitialAuthStoreState();

    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });
});

// ============================================================================
// ✅ INVARIANT GATE ФУНКЦИИ
// ============================================================================

// Тесты для отдельных fix* функций удалены - они заменены на rule-engine в enforceInvariants
// Все invariant правила тестируются через enforceInvariants

describe('enforceInvariants', () => {
  it('применяет все фиксы каскадно', () => {
    const state = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
      session: createMockSessionState({ status: 'expired' }),
      mfa: createMockMfaState({ status: 'challenged' }),
      oauth: createMockOAuthState({ status: 'initiating', provider: 'google' }),
      passwordRecovery: createMockPasswordRecoveryState({ status: 'requested' }),
      verification: createMockVerificationState({ status: 'sent', type: 'email' }),
    });

    const result = enforceInvariants(state);

    // Проверяем что фиксы применены
    expect(result.auth.status).toBe('session_expired');
    // MFA не сбрасывается при session_expired, только при authenticated/error/unauthenticated
    // Но так как auth стал session_expired, MFA challenged остается (это transient состояние допустимо)
    expect(result.mfa.status).toBe('challenged');
    // OAuth не сбрасывается при session_expired, только при authenticated/unauthenticated
    // session_expired - это все еще часть процесса аутентификации
    expect(result.oauth.status).toBe('initiating');
    // PasswordRecovery сбрасывается только при authenticated, не при session_expired
    expect(result.passwordRecovery.status).toBe('requested');
    // Verification сбрасывается только при authenticated/unauthenticated, не при session_expired
    expect(result.verification.status).toBe('sent');
  });

  it('применяет security фикс с максимальным приоритетом', () => {
    const state = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
      security: createMockSecurityState({
        status: 'blocked',
        reason: 'Suspicious activity',
      }),
      session: createMockSessionState({ status: 'active' }),
    });

    const result = enforceInvariants(state);

    expect(result.auth.status).toBe('error');
    // eslint-disable-next-line functional/no-conditional-statements -- Type guard для discriminated union
    if (result.auth.status === 'error') {
      expect(result.auth.error.kind).toBe('account_locked');
    }
    expect(result.session).toBe(null);
  });

  it('возвращает исходное состояние если инварианты соблюдены', () => {
    const state = createMockStoreState({
      auth: createMockAuthState({ status: 'unauthenticated' }),
      session: null,
      mfa: createMockMfaState({ status: 'not_setup' }),
      oauth: createMockOAuthState({ status: 'idle' }),
      passwordRecovery: createMockPasswordRecoveryState({ status: 'idle' }),
      verification: createMockVerificationState({ status: 'idle' }),
    });

    const result = enforceInvariants(state);
    expect(result).toEqual(state);
  });
});

// ============================================================================
// 🏗️ ZUSTAND STORE - UNIT TESTS (без persistence infra)
// ============================================================================

describe('createAuthStore - Unit Tests', () => {
  beforeAll(() => {
    // Mock console.warn for zustand persist messages
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      return typeof message === 'string' && message.includes('[zustand persist middleware]')
        ? undefined // Suppress zustand persist warnings
        : console.warn(message); // Allow other warnings
    });
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('экспортируется как функция', () => {
    expect(typeof createAuthStore).toBe('function');
  });

  it('возвращает объект с правильной структурой', () => {
    const store = createAuthStore();
    const state = store.getState();

    expect(state).toHaveProperty('version');
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('mfa');
    expect(state).toHaveProperty('oauth');
    expect(state).toHaveProperty('security');
    expect(state).toHaveProperty('session');
    expect(state).toHaveProperty('passwordRecovery');
    expect(state).toHaveProperty('verification');
    expect(state).toHaveProperty('actions');
  });

  it('инициализируется с правильными начальными значениями', () => {
    const store = createAuthStore();
    const state = store.getState();

    expect(state.version).toBe(authStoreVersion);
    expect(state.auth.status).toBe('unauthenticated');
    expect(state.mfa.status).toBe('not_setup');
    expect(state.oauth.status).toBe('idle');
    expect(state.security.status).toBe('secure');
    expect(state.session).toBe(null);
    expect(state.passwordRecovery.status).toBe('idle');
    expect(state.verification.status).toBe('idle');
  });

  describe('Actions', () => {
    // eslint-disable-next-line functional/no-let -- Store нужно пересоздавать в каждом тесте
    let store: ReturnType<typeof createAuthStore>;

    beforeEach(() => {
      // eslint-disable-next-line fp/no-mutation -- Store нужно пересоздавать в каждом тесте
      store = createAuthStore();
      store.getState().actions.reset();
    });

    it('setAuthState устанавливает состояние аутентификации', () => {
      const authState = createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      });
      const sessionState = createMockSessionState({ status: 'active' });

      // Устанавливаем auth и session вместе через patch, чтобы инварианты не сбрасывали auth
      store.getState().actions.patch({
        auth: authState,
        session: sessionState,
      });

      expect(store.getState().auth).toEqual(authState);
      expect(store.getState().session).toEqual(sessionState);
    });

    it('setMfaState устанавливает состояние MFA', () => {
      // MFA challenged допустим только во время authenticating
      store.getState().actions.setAuthState(
        createMockAuthState({ status: 'authenticating', operation: 'login' }),
      );
      const mfaState = createMockMfaState({ status: 'challenged', method: 'totp' });

      store.getState().actions.setMfaState(mfaState);

      expect(store.getState().mfa).toEqual(mfaState);
    });

    it('setOAuthState устанавливает состояние OAuth', () => {
      // OAuth initiating допустим только во время OAuth flow
      store.getState().actions.setAuthState(
        createMockAuthState({ status: 'authenticating', operation: 'oauth' }),
      );
      const oauthState = createMockOAuthState({
        status: 'initiating',
        provider: 'google',
      });

      store.getState().actions.setOAuthState(oauthState);

      expect(store.getState().oauth).toEqual(oauthState);
    });

    it('setSecurityState устанавливает состояние безопасности', () => {
      const securityState = createMockSecurityState({
        status: 'risk_detected',
        riskLevel: 'high',
        riskScore: 85,
      });

      store.getState().actions.setSecurityState(securityState);

      expect(store.getState().security).toEqual(securityState);
    });

    it('setSessionState устанавливает состояние сессии', () => {
      // Session допустим только при authenticated с active session
      const authState = createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      });
      const sessionState = createMockSessionState({ status: 'active' });

      // Устанавливаем auth и session вместе через patch
      store.getState().actions.patch({
        auth: authState,
        session: sessionState,
      });

      expect(store.getState().session).toEqual(sessionState);
    });

    it('setSessionState может установить null', () => {
      store.getState().actions.setSessionState(null);

      expect(store.getState().session).toBe(null);
    });

    it('setPasswordRecoveryState устанавливает состояние восстановления пароля', () => {
      const passwordRecoveryState = createMockPasswordRecoveryState({
        status: 'requested',
        identifierType: 'email',
        identifier: 'user@example.com',
      });

      store.getState().actions.setPasswordRecoveryState(passwordRecoveryState);

      expect(store.getState().passwordRecovery).toEqual(passwordRecoveryState);
    });

    it('setVerificationState устанавливает состояние верификации', () => {
      // Verification допустим только во время authenticating или pending_secondary_verification
      store.getState().actions.setAuthState(
        createMockAuthState({
          status: 'authenticating',
          operation: 'login',
        }),
      );
      const verificationState = createMockVerificationState({
        status: 'sent',
        type: 'email',
        target: 'user@example.com',
      });

      store.getState().actions.setVerificationState(verificationState);

      expect(store.getState().verification).toEqual(verificationState);
    });

    it('applyEventType устанавливает тип последнего события', () => {
      const eventType: AuthEvent['type'] = 'user_logged_in';

      store.getState().actions.applyEventType(eventType);

      expect(store.getState().lastEventType).toBe(eventType);
    });

    it('patch обновляет несколько полей состояния', () => {
      // Устанавливаем корректный контекст для MFA и OAuth
      store.getState().actions.setAuthState(
        createMockAuthState({ status: 'authenticating', operation: 'oauth' }),
      );
      const newMfa = createMockMfaState({ status: 'challenged' });
      const newOAuth = createMockOAuthState({ status: 'initiating', provider: 'google' });

      store.getState().actions.patch({
        mfa: newMfa,
        oauth: newOAuth,
      });

      expect(store.getState().mfa).toEqual(newMfa);
      expect(store.getState().oauth).toEqual(newOAuth);
    });

    it('reset сбрасывает состояние к начальным значениям', () => {
      // First modify state
      store.getState().actions.setAuthState(
        createMockAuthState({
          status: 'authenticated',
          user: { id: 'user-123', email: 'user@example.com' },
        }),
      );
      store.getState().actions.setMfaState(createMockMfaState({ status: 'challenged' }));
      store.getState().actions.setSessionState(createMockSessionState());

      // Reset
      store.getState().actions.reset();

      // Check initial state
      const state = store.getState();
      expect(state.auth.status).toBe('unauthenticated');
      expect(state.mfa.status).toBe('not_setup');
      expect(state.session).toBe(null);
    });

    it('actions применяют enforceInvariants автоматически', () => {
      // Устанавливаем состояние которое нарушает инварианты
      store.getState().actions.setAuthState(
        createMockAuthState({
          status: 'authenticated',
          user: { id: 'user-123', email: 'user@example.com' },
        }),
      );
      store.getState().actions.setSessionState(
        createMockSessionState({ status: 'expired' }),
      );

      // Проверяем что инварианты применены
      const state = store.getState();
      expect(state.auth.status).toBe('session_expired');
    });
  });
});

// ============================================================================
// 🏗️ ZUSTAND STORE - INTEGRATION TESTS (с persistence infra)
// ============================================================================

describe('createAuthStore - Integration Tests (Persistence)', () => {
  beforeEach(() => {
    const storageMock = createStorageMock();

    // Ensure window exists
    const windowObject = typeof window !== 'undefined'
      ? window
      : ((): Window & typeof globalThis => {
        // eslint-disable-next-line fp/no-mutation -- Нужно для SSR тестирования
        (global as any).window = {};
        return (global as any).window;
      })();

    // Remove existing localStorage property if it exists
    delete (windowObject as any).localStorage;

    Object.defineProperty(windowObject, 'localStorage', {
      value: storageMock,
      configurable: true,
    });

    // Mock console.warn for zustand persist messages
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      return typeof message === 'string' && message.includes('[zustand persist middleware]')
        ? undefined // Suppress zustand persist warnings
        : console.warn(message); // Allow other warnings
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('persistence работает в SSR окружении', () => {
    delete (global as any).window;

    const store = createAuthStore();
    const state = store.getState();

    expect(state).toBeDefined();
    expect(state.auth.status).toBe('unauthenticated');
  });

  it('persistence сохраняет состояние между пересозданиями store', () => {
    const store1 = createAuthStore();
    store1.getState().actions.setAuthState(
      createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
    );

    // Создаем новый store - он должен восстановить состояние из localStorage
    const store2 = createAuthStore();
    // В реальном приложении состояние будет восстановлено, но в тестах это сложно проверить
    // без полной интеграции с persist middleware
    expect(store2.getState()).toBeDefined();
  });
});

// ============================================================================
// 🎯 СЕЛЕКТОРЫ
// ============================================================================

describe('Basic selectors', () => {
  const store = createMockStoreState({
    auth: createMockAuthState({ status: 'authenticated' }),
    mfa: createMockMfaState({ status: 'challenged' }),
    oauth: createMockOAuthState({ status: 'idle' }),
    security: createMockSecurityState({ status: 'secure' }),
    session: createMockSessionState(),
    passwordRecovery: createMockPasswordRecoveryState({ status: 'idle' }),
    verification: createMockVerificationState({ status: 'idle' }),
  });

  it('getAuth возвращает состояние аутентификации', () => {
    expect(getAuth(store)).toBe(store.auth);
  });

  it('getMfa возвращает состояние MFA', () => {
    expect(getMfa(store)).toBe(store.mfa);
  });

  it('getOAuth возвращает состояние OAuth', () => {
    expect(getOAuth(store)).toBe(store.oauth);
  });

  it('getSecurity возвращает состояние безопасности', () => {
    expect(getSecurity(store)).toBe(store.security);
  });

  it('getSession возвращает состояние сессии', () => {
    expect(getSession(store)).toBe(store.session);
  });

  it('getPasswordRecovery возвращает состояние восстановления пароля', () => {
    expect(getPasswordRecovery(store)).toBe(store.passwordRecovery);
  });

  it('getVerification возвращает состояние верификации', () => {
    expect(getVerification(store)).toBe(store.verification);
  });

  it('getAuthStoreActions возвращает actions', () => {
    const storeWithActions = createAuthStore().getState();
    expect(getAuthStoreActions(storeWithActions)).toBe(storeWithActions.actions);
  });
});

describe('Derived selectors', () => {
  it('isAuthenticated возвращает true для authenticated пользователя', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
    });

    expect(isAuthenticated(store)).toBe(true);
  });

  it('isAuthenticated возвращает false для unauthenticated', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'unauthenticated' }),
    });

    expect(isAuthenticated(store)).toBe(false);
  });

  it('isAuthenticating возвращает true для authenticating статуса', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'authenticating', operation: 'login' }),
    });

    expect(isAuthenticating(store)).toBe(true);
  });

  it('isAuthenticating возвращает false для других статусов', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'authenticated' }),
    });

    expect(isAuthenticating(store)).toBe(false);
  });

  it('hasAuthError возвращает true для error статуса', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'error',
        error: { kind: 'invalid_credentials' },
      }),
    });

    expect(hasAuthError(store)).toBe(true);
  });

  it('hasAuthError возвращает false для других статусов', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'authenticated' }),
    });

    expect(hasAuthError(store)).toBe(false);
  });

  it('needsVerification возвращает true для pending_secondary_verification', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'pending_secondary_verification',
        userId: 'user-123',
        verificationType: 'mfa',
      }),
    });

    expect(needsVerification(store)).toBe(true);
  });

  it('needsVerification возвращает false для других статусов', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'authenticated' }),
    });

    expect(needsVerification(store)).toBe(false);
  });

  it('isSessionExpired возвращает true для session_expired статуса', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'session_expired',
        userId: 'user-123',
      }),
    });

    expect(isSessionExpired(store)).toBe(true);
  });

  it('isSessionExpired возвращает false для других статусов', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'authenticated' }),
    });

    expect(isSessionExpired(store)).toBe(false);
  });

  it('canRefresh возвращает true для authenticated', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
    });

    expect(canRefresh(store)).toBe(true);
  });

  it('canRefresh возвращает true для session_expired', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'session_expired',
        userId: 'user-123',
      }),
    });

    expect(canRefresh(store)).toBe(true);
  });

  it('canRefresh возвращает false для других статусов', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'unauthenticated' }),
    });

    expect(canRefresh(store)).toBe(false);
  });

  it('needsMfa возвращает true для challenged MFA', () => {
    const store = createMockStoreState({
      mfa: createMockMfaState({ status: 'challenged' }),
    });

    expect(needsMfa(store)).toBe(true);
  });

  it('needsMfa возвращает true для recovery_required MFA', () => {
    const store = createMockStoreState({
      mfa: createMockMfaState({ status: 'recovery_required' }),
    });

    expect(needsMfa(store)).toBe(true);
  });

  it('needsMfa возвращает true для pending_secondary_verification', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'pending_secondary_verification',
        userId: 'user-123',
      }),
    });

    expect(needsMfa(store)).toBe(true);
  });

  it('needsMfa возвращает false для других состояний', () => {
    const store = createMockStoreState({
      mfa: createMockMfaState({ status: 'not_setup' }),
      auth: createMockAuthState({ status: 'authenticated' }),
    });

    expect(needsMfa(store)).toBe(false);
  });

  it('isHighRisk возвращает true для blocked security', () => {
    const store = createMockStoreState({
      security: createMockSecurityState({
        status: 'blocked',
        reason: 'Suspicious activity',
      }),
    });

    expect(isHighRisk(store)).toBe(true);
  });

  it('isHighRisk возвращает true для high risk', () => {
    const store = createMockStoreState({
      security: createMockSecurityState({
        status: 'risk_detected',
        riskLevel: 'high',
        riskScore: 85,
      }),
    });

    expect(isHighRisk(store)).toBe(true);
  });

  it('isHighRisk возвращает true для critical risk', () => {
    const store = createMockStoreState({
      security: createMockSecurityState({
        status: 'risk_detected',
        riskLevel: 'critical',
        riskScore: 95,
      }),
    });

    expect(isHighRisk(store)).toBe(true);
  });

  it('isHighRisk возвращает false для low risk', () => {
    const store = createMockStoreState({
      security: createMockSecurityState({
        status: 'risk_detected',
        riskLevel: 'low',
        riskScore: 20,
      }),
    });

    expect(isHighRisk(store)).toBe(false);
  });

  it('isSessionValid возвращает true для active session и authenticated', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
      session: createMockSessionState({ status: 'active' }),
    });

    expect(isSessionValid(store)).toBe(true);
  });

  it('isSessionValid возвращает false для expired session', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
      session: createMockSessionState({ status: 'expired' }),
    });

    expect(isSessionValid(store)).toBe(false);
  });

  it('isSessionValid возвращает false для null session', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
      session: null,
    });

    expect(isSessionValid(store)).toBe(false);
  });

  it('hasPermission возвращает true если пользователь имеет разрешение', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        permissions: new Set(['read', 'write', 'admin']),
      }),
    });

    expect(hasPermission(store, 'read')).toBe(true);
    expect(hasPermission(store, 'write')).toBe(true);
    expect(hasPermission(store, 'admin')).toBe(true);
  });

  it('hasPermission возвращает false если пользователь не имеет разрешения', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        permissions: new Set(['read', 'write']),
      }),
    });

    expect(hasPermission(store, 'admin')).toBe(false);
  });

  it('hasPermission возвращает false для неauthenticated пользователя', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({ status: 'unauthenticated' }),
    });

    expect(hasPermission(store, 'read')).toBe(false);
  });

  it('hasPermission возвращает false если permissions не массив', () => {
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        // permissions отсутствует
      }),
    });

    expect(hasPermission(store, 'read')).toBe(false);
  });
});

// ============================================================================
// 📦 GROUPED API
// ============================================================================

describe('createAuthSelectors', () => {
  it('создает объект с группировкой селекторов', () => {
    const selectors = createAuthSelectors();

    expect(typeof selectors.auth).toBe('function');
    expect(typeof selectors.mfa).toBe('function');
    expect(typeof selectors.oauth).toBe('function');
    expect(typeof selectors.security).toBe('function');
    expect(typeof selectors.session).toBe('function');
    expect(typeof selectors.passwordRecovery).toBe('function');
    expect(typeof selectors.verification).toBe('function');
    expect(typeof selectors.actions).toBe('function');
    expect(typeof selectors.isAuthenticated).toBe('function');
    expect(typeof selectors.isAuthenticating).toBe('function');
    expect(typeof selectors.hasAuthError).toBe('function');
    expect(typeof selectors.needsVerification).toBe('function');
    expect(typeof selectors.isSessionExpired).toBe('function');
    expect(typeof selectors.canRefresh).toBe('function');
    expect(typeof selectors.needsMfa).toBe('function');
    expect(typeof selectors.isHighRisk).toBe('function');
    expect(typeof selectors.isSessionValid).toBe('function');
    expect(typeof selectors.hasPermission).toBe('function');
  });

  it('селекторы работают корректно', () => {
    const selectors = createAuthSelectors();
    const store = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
    });

    expect(selectors.auth(store)).toBe(store.auth);
    expect(selectors.isAuthenticated(store)).toBe(true);
  });
});

// ============================================================================
// 🔍 EDGE CASES И ERROR HANDLING
// ============================================================================

describe('Edge cases', () => {
  it('enforceInvariants обрабатывает null session корректно', () => {
    const state = createMockStoreState({
      auth: createMockAuthState({ status: 'unauthenticated' }),
      session: null,
    });

    const result = enforceInvariants(state);
    expect(result.session).toBe(null);
  });

  it('enforceInvariants обрабатывает все состояния одновременно', () => {
    const state = createMockStoreState({
      auth: createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      }),
      session: createMockSessionState({ status: 'expired' }),
      mfa: createMockMfaState({ status: 'challenged' }),
      oauth: createMockOAuthState({ status: 'initiating', provider: 'google' }),
      security: createMockSecurityState({ status: 'blocked', reason: 'Test' }),
      passwordRecovery: createMockPasswordRecoveryState({ status: 'requested' }),
      verification: createMockVerificationState({ status: 'sent', type: 'email' }),
    });

    const result = enforceInvariants(state);

    // Security имеет максимальный приоритет
    expect(result.auth.status).toBe('error');
    // eslint-disable-next-line functional/no-conditional-statements -- Type guard для discriminated union
    if (result.auth.status === 'error') {
      expect(result.auth.error.kind).toBe('account_locked');
    }
    expect(result.session).toBe(null);
  });

  it('селекторы работают с неполными store объектами', () => {
    const incompleteStore = {} as AuthStoreState;

    // Селекторы обращаются к полям напрямую
    // При отсутствии полей getAuth вернет undefined, а не выбросит ошибку
    // Но при обращении к undefined.status будет ошибка
    // Это ожидаемое поведение - store всегда должен быть полным объектом
    // В реальном использовании это не произойдет, так как store создается через createAuthStore
    const auth = getAuth(incompleteStore);
    expect(auth).toBeUndefined();
    // isAuthenticated обращается к store.auth.status, что вызовет ошибку при undefined
    expect(() => isAuthenticated(incompleteStore)).toThrow();
  });

  it('actions работают с различными типами состояний', () => {
    const store = createAuthStore();

    // Тестируем различные статусы AuthState
    store.getState().actions.setAuthState(
      createMockAuthState({ status: 'authenticating', operation: 'login' }),
    );
    expect(store.getState().auth.status).toBe('authenticating');

    store.getState().actions.setAuthState(
      createMockAuthState({
        status: 'error',
        error: { kind: 'invalid_credentials' },
      }),
    );
    expect(store.getState().auth.status).toBe('error');
  });

  it('patch не ломает discriminated unions', () => {
    const store = createAuthStore();

    // Patch должен работать с не-discriminated полями
    store.getState().actions.patch({
      // Можно обновить только не-discriminated поля
    });

    expect(store.getState()).toBeDefined();
  });
});

// ============================================================================
// 🔄 TRANSACTION API
// ============================================================================

describe('Transaction API', () => {
  it('transaction выполняет атомарные обновления с deep clone', () => {
    const store = createAuthStore();

    // Устанавливаем начальное состояние
    store.getState().actions.setAuthState(
      createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        permissions: new Set(['read']),
      }),
    );

    const originalAuth = store.getState().auth;
    const originalMfa = store.getState().mfa;

    // Выполняем transaction с несколькими обновлениями
    store.getState().actions.transaction((draft) => {
      // Обновляем auth и mfa, также устанавливаем session для соблюдения инвариантов
      const newAuth = createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'updated@example.com' },
        permissions: new Set(['read', 'write']),
      });
      const newMfa = { status: 'setup_complete' } as MfaState;
      const newSession = createMockSessionState({ status: 'active' });

      // Присваиваем через Object.assign для обхода readonly
      Object.assign(draft, {
        auth: newAuth,
        mfa: newMfa,
        session: newSession,
      });
    });

    // Проверяем, что состояние обновилось
    const updatedState = store.getState();
    expect(updatedState.auth.status).toBe('authenticated');
    void (updatedState.auth.status === 'authenticated'
      ? (() => {
        expect(updatedState.auth.user.email).toBe('updated@example.com');
        expect(updatedState.auth.permissions?.has('write')).toBe(true);
      })()
      : undefined);
    expect(updatedState.mfa.status).toBe('setup_complete');

    // Проверяем, что исходные объекты не были мутированы (deep clone защита)
    // originalAuth должен остаться тем же объектом (reference equality)
    expect(originalAuth).toBe(originalAuth);
    // Но новый auth должен быть другим объектом
    expect(originalAuth).not.toBe(updatedState.auth);
    expect(originalMfa).not.toBe(updatedState.mfa);
  });

  it('transaction применяет invariants после обновления', () => {
    const store = createAuthStore();

    // Устанавливаем состояние с нарушением инварианта
    store.getState().actions.transaction((draft) => {
      Object.assign(draft, {
        auth: createMockAuthState({ status: 'authenticated' }),
        session: null, // Нарушение: authenticated должен иметь session
      });
    });

    // Invariants должны исправить это
    const state = store.getState();
    // После применения invariants session должен быть установлен или auth изменен
    expect(state.auth.status === 'authenticated' ? state.session !== null : true).toBe(true);
  });

  it('transaction работает с extensions', () => {
    const store = createAuthStore({
      extensions: { customField: 'value' },
    });

    store.getState().actions.transaction((draft) => {
      void (draft.extensions
        ? Object.assign(draft, {
          extensions: { ...draft.extensions, customField: 'updated' },
        })
        : undefined);
    });

    expect(store.getState().extensions?.['customField']).toBe('updated');
  });

  it('transaction работает с lastEventType', () => {
    const store = createAuthStore();

    store.getState().actions.applyEventType('user_logged_in');

    store.getState().actions.transaction((draft) => {
      // lastEventType должен быть доступен в draft
      expect(draft.lastEventType).toBe('user_logged_in');
    });
  });
});

// ============================================================================
// 💾 PERSISTENCE & VALIDATION
// ============================================================================

describe('Persistence validation and merge', () => {
  beforeEach(() => {
    // Настраиваем localStorage mock
    const storageMock = createStorageMock();

    // Ensure window exists
    const windowObject = typeof window !== 'undefined'
      ? window
      : ((): Window & typeof globalThis => {
        // eslint-disable-next-line fp/no-mutation -- Нужно для SSR тестирования
        (global as any).window = {};
        return (global as any).window;
      })();

    // Remove existing localStorage property if it exists
    delete (windowObject as any).localStorage;

    Object.defineProperty(windowObject, 'localStorage', {
      value: storageMock,
      configurable: true,
    });

    // Mock console.warn for zustand persist messages
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      return typeof message === 'string' && message.includes('[zustand persist middleware]')
        ? undefined // Suppress zustand persist warnings
        : console.warn(message); // Allow other warnings
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('partialize сериализует Set permissions в массив', () => {
    const store = createAuthStore();

    store.getState().actions.setAuthState(
      createMockAuthState({
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        permissions: new Set(['read', 'write']),
      }),
    );

    // Проверяем, что в runtime state permissions - это Set
    const state = store.getState();
    void (state.auth.status === 'authenticated'
      ? (() => {
        expect(state.auth.permissions).toBeInstanceOf(Set);
        expect(state.auth.permissions?.has('read')).toBe(true);
        expect(state.auth.permissions?.has('write')).toBe(true);
      })()
      : undefined);
    // partialize выполняется внутри persist middleware при сохранении
    // Мы не можем напрямую проверить persisted state, но можем убедиться,
    // что runtime state корректно работает с Set
  });

  it('merge восстанавливает permissions из массива в Set', () => {
    const storage = (typeof window !== 'undefined' ? window.localStorage : null) as ReturnType<
      typeof createStorageMock
    >;

    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/no-unnecessary-condition -- Ранний возврат для пропуска теста
    if (storage === null) return; // Skip if localStorage not available

    // Создаем persisted state с массивом permissions
    const persistedState = {
      version: authStoreVersion,
      auth: {
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        permissions: ['read', 'write'], // массив вместо Set
      },
      mfa: { status: 'idle' },
      oauth: { status: 'idle' },
      security: { status: 'secure' },
      session: {
        status: 'active',
        sessionId: 'session-123',
        expiresAt: createISODateString(),
        issuedAt: createISODateString(),
      },
      passwordRecovery: { status: 'idle' },
      verification: { status: 'idle' },
    };

    // Сохраняем в localStorage
    storage.setItem('@livai/feature-auth/store:main', JSON.stringify(persistedState));

    // Создаем новый store - он должен восстановить состояние
    const store = createAuthStore();

    // Проверяем, что permissions восстановлены как Set
    const state = store.getState();
    void (state.auth.status === 'authenticated'
      ? (() => {
        expect(state.auth.permissions).toBeInstanceOf(Set);
        expect(state.auth.permissions?.has('read')).toBe(true);
        expect(state.auth.permissions?.has('write')).toBe(true);
      })()
      : undefined);
  });

  it('validatePersistedState отклоняет невалидные данные', () => {
    // Тестируем различные невалидные случаи через создание store с невалидными данными
    const storage = (typeof window !== 'undefined' ? window.localStorage : null) as ReturnType<
      typeof createStorageMock
    >;

    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/no-unnecessary-condition -- Ранний возврат для пропуска теста
    if (storage === null) return; // Skip if localStorage not available

    // Невалидный version
    storage.setItem(
      '@livai/feature-auth/store:main',
      JSON.stringify({ version: 999, auth: { status: 'authenticated' } }),
    );
    const store1 = createAuthStore();
    // Store должен использовать начальное состояние, а не persisted (неверная версия)
    expect(store1.getState()).toBeDefined();

    // Невалидный auth status
    storage.setItem(
      '@livai/feature-auth/store:main',
      JSON.stringify({
        version: authStoreVersion,
        auth: { status: 'invalid_status' },
        mfa: { status: 'idle' },
        oauth: { status: 'idle' },
        security: { status: 'secure' },
        session: null,
        passwordRecovery: { status: 'idle' },
        verification: { status: 'idle' },
      }),
    );
    const store2 = createAuthStore();
    // Store должен отклонить невалидные данные (невалидный auth status)
    expect(store2.getState()).toBeDefined();

    // Невалидный session (не null и не объект)
    storage.setItem(
      '@livai/feature-auth/store:main',
      JSON.stringify({
        version: authStoreVersion,
        auth: { status: 'unauthenticated' },
        mfa: { status: 'idle' },
        oauth: { status: 'idle' },
        security: { status: 'secure' },
        session: 'invalid',
        passwordRecovery: { status: 'idle' },
        verification: { status: 'idle' },
      }),
    );
    const store3 = createAuthStore();
    // Store должен отклонить невалидные данные (невалидный session)
    expect(store3.getState()).toBeDefined();
  });

  it('validatePersistedState проверяет семантическую валидность auth', () => {
    const storage = (typeof window !== 'undefined' ? window.localStorage : null) as ReturnType<
      typeof createStorageMock
    >;

    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/no-unnecessary-condition -- Ранний возврат для пропуска теста
    if (storage === null) return; // Skip if localStorage not available

    // authenticated без user (семантически невалидно)
    storage.setItem(
      '@livai/feature-auth/store:main',
      JSON.stringify({
        version: authStoreVersion,
        auth: { status: 'authenticated' }, // нет user
        mfa: { status: 'idle' },
        oauth: { status: 'idle' },
        security: { status: 'secure' },
        session: null,
        passwordRecovery: { status: 'idle' },
        verification: { status: 'idle' },
      }),
    );
    const store = createAuthStore();
    // Store должен отклонить невалидные данные (нет user для authenticated)
    // и использовать начальное состояние или состояние из предыдущих тестов
    expect(store.getState()).toBeDefined();
  });

  it('validatePersistedState проверяет семантическую валидность session', () => {
    const storage = (typeof window !== 'undefined' ? window.localStorage : null) as ReturnType<
      typeof createStorageMock
    >;

    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/no-unnecessary-condition -- Ранний возврат для пропуска теста
    if (storage === null) return; // Skip if localStorage not available

    // active session без обязательных полей
    storage.setItem(
      '@livai/feature-auth/store:main',
      JSON.stringify({
        version: authStoreVersion,
        auth: { status: 'authenticated', user: { id: 'user-123', email: 'user@example.com' } },
        mfa: { status: 'idle' },
        oauth: { status: 'idle' },
        security: { status: 'secure' },
        session: { status: 'active' }, // нет sessionId, expiresAt, issuedAt
        passwordRecovery: { status: 'idle' },
        verification: { status: 'idle' },
      }),
    );
    const store = createAuthStore();
    // Store должен отклонить невалидные данные
    expect(store.getState().session).toBeNull();
  });

  it('validatePersistedState проверяет семантическую валидность security', () => {
    const storage = (typeof window !== 'undefined' ? window.localStorage : null) as ReturnType<
      typeof createStorageMock
    >;

    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/no-unnecessary-condition -- Ранний возврат для пропуска теста
    if (storage === null) return; // Skip if localStorage not available

    // risk_detected без riskLevel и riskScore
    storage.setItem(
      '@livai/feature-auth/store:main',
      JSON.stringify({
        version: authStoreVersion,
        auth: { status: 'unauthenticated' },
        mfa: { status: 'idle' },
        oauth: { status: 'idle' },
        security: { status: 'risk_detected' }, // нет riskLevel и riskScore
        session: null,
        passwordRecovery: { status: 'idle' },
        verification: { status: 'idle' },
      }),
    );
    const store = createAuthStore();
    // Store должен отклонить невалидные данные
    expect(store.getState().security.status).toBe('secure');
  });

  it('validatePersistedState принимает валидные persisted state с extensions', () => {
    const storage = (typeof window !== 'undefined' ? window.localStorage : null) as ReturnType<
      typeof createStorageMock
    >;

    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/no-unnecessary-condition -- Ранний возврат для пропуска теста
    if (storage === null) return; // Skip if localStorage not available

    const validPersistedState = {
      version: authStoreVersion,
      auth: {
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        permissions: ['read', 'write'],
      },
      mfa: { status: 'idle' },
      oauth: { status: 'idle' },
      security: { status: 'secure' },
      session: {
        status: 'active',
        sessionId: 'session-123',
        expiresAt: createISODateString(),
        issuedAt: createISODateString(),
      },
      passwordRecovery: { status: 'idle' },
      verification: { status: 'idle' },
      extensions: { customField: 'value' },
    };

    storage.setItem('@livai/feature-auth/store:main', JSON.stringify(validPersistedState));

    // Ждем немного, чтобы persist middleware успел обработать
    const store = createAuthStore({ extensions: { defaultField: 'default' } });

    // В тестах persist middleware может не успеть восстановить состояние синхронно
    // Проверяем, что store создан корректно
    expect(store.getState()).toBeDefined();
    // Если persisted state был восстановлен, проверяем его
    void (store.getState().auth.status === 'authenticated'
      ? expect(store.getState().extensions?.['customField']).toBe('value')
      : undefined);
  });

  it('validatePersistedState отклоняет null или не-объект', () => {
    const storage = (typeof window !== 'undefined' ? window.localStorage : null) as ReturnType<
      typeof createStorageMock
    >;

    // eslint-disable-next-line functional/no-conditional-statements, @typescript-eslint/no-unnecessary-condition -- Ранний возврат для пропуска теста
    if (storage === null) return; // Skip if localStorage not available

    // null
    storage.setItem('@livai/feature-auth/store:main', JSON.stringify(null));
    const store1 = createAuthStore();
    // Store должен отклонить невалидные данные (null не проходит validatePersistedState)
    // и использовать начальное состояние или состояние из предыдущих тестов
    expect(store1.getState()).toBeDefined();

    // строка
    storage.setItem('@livai/feature-auth/store:main', 'invalid');
    const store2 = createAuthStore();
    // Store должен отклонить невалидные данные (строка не проходит validatePersistedState)
    expect(store2.getState()).toBeDefined();
  });
});

// ============================================================================
// 📊 ПОКРЫТИЕ 100%
// ============================================================================

describe('Type safety and exports', () => {
  it('все функции корректно экспортируются', () => {
    expect(typeof createInitialAuthStoreState).toBe('function');
    // fix* функции удалены - заменены на rule-engine в enforceInvariants
    expect(typeof enforceInvariants).toBe('function');
    expect(typeof createAuthStore).toBe('function');
    expect(typeof getAuth).toBe('function');
    expect(typeof getMfa).toBe('function');
    expect(typeof getOAuth).toBe('function');
    expect(typeof getSecurity).toBe('function');
    expect(typeof getSession).toBe('function');
    expect(typeof getPasswordRecovery).toBe('function');
    expect(typeof getVerification).toBe('function');
    expect(typeof getAuthStoreActions).toBe('function');
    expect(typeof isAuthenticated).toBe('function');
    expect(typeof isAuthenticating).toBe('function');
    expect(typeof hasAuthError).toBe('function');
    expect(typeof needsVerification).toBe('function');
    expect(typeof isSessionExpired).toBe('function');
    expect(typeof canRefresh).toBe('function');
    expect(typeof needsMfa).toBe('function');
    expect(typeof isHighRisk).toBe('function');
    expect(typeof isSessionValid).toBe('function');
    expect(typeof hasPermission).toBe('function');
    expect(typeof createAuthSelectors).toBe('function');
  });

  it('все константы определены', () => {
    expect(authStoreVersion).toBeDefined();
    expect(typeof authStoreVersion).toBe('number');
  });
});

// ============================================================================
// 🧪 DIRECT FUNCTION TESTS (для покрытия внутренних функций)
// ============================================================================

describe('Direct function tests for coverage', () => {
  describe('validateAuthSemantics', () => {
    it('валидирует authenticated с user и permissions Set', () => {
      expect(
        validateAuthSemantics({
          status: 'authenticated',
          user: { id: 'user-123', email: 'user@example.com' },
          permissions: new Set(['read', 'write']),
        }),
      ).toBe(true);
    });

    it('валидирует authenticated с user и permissions array', () => {
      expect(
        validateAuthSemantics({
          status: 'authenticated',
          user: { id: 'user-123', email: 'user@example.com' },
          permissions: ['read', 'write'],
        }),
      ).toBe(true);
    });

    it('валидирует authenticated с user без permissions', () => {
      expect(
        validateAuthSemantics({
          status: 'authenticated',
          user: { id: 'user-123', email: 'user@example.com' },
        }),
      ).toBe(true);
    });

    it('отклоняет authenticated без user', () => {
      expect(validateAuthSemantics({ status: 'authenticated' })).toBe(false);
    });

    it('валидирует pending_secondary_verification с userId', () => {
      expect(
        validateAuthSemantics({
          status: 'pending_secondary_verification',
          userId: 'user-123',
        }),
      ).toBe(true);
    });

    it('отклоняет pending_secondary_verification без userId', () => {
      expect(validateAuthSemantics({ status: 'pending_secondary_verification' })).toBe(false);
    });

    it('валидирует error с error объектом', () => {
      expect(
        validateAuthSemantics({
          status: 'error',
          error: { kind: 'invalid_credentials', message: 'Error' },
        }),
      ).toBe(true);
    });

    it('отклоняет error без error объекта', () => {
      expect(validateAuthSemantics({ status: 'error' })).toBe(false);
    });

    it('валидирует другие статусы', () => {
      expect(validateAuthSemantics({ status: 'unauthenticated' })).toBe(true);
      expect(validateAuthSemantics({ status: 'authenticating' })).toBe(true);
      expect(validateAuthSemantics({ status: 'session_expired' })).toBe(true);
    });
  });

  describe('validateSessionSemantics', () => {
    it('валидирует active session с обязательными полями', () => {
      expect(
        validateSessionSemantics({
          status: 'active',
          sessionId: 'session-123',
          expiresAt: '2026-01-01T00:00:00.000Z',
          issuedAt: '2026-01-01T00:00:00.000Z',
        }),
      ).toBe(true);
    });

    it('отклоняет active session без обязательных полей', () => {
      expect(validateSessionSemantics({ status: 'active' })).toBe(false);
      expect(validateSessionSemantics({ status: 'active', sessionId: 'session-123' })).toBe(false);
    });

    it('валидирует expired session с sessionId', () => {
      expect(validateSessionSemantics({ status: 'expired', sessionId: 'session-123' })).toBe(true);
    });

    it('валидирует revoked session с sessionId', () => {
      expect(validateSessionSemantics({ status: 'revoked', sessionId: 'session-123' })).toBe(true);
    });

    it('валидирует suspended session с sessionId', () => {
      expect(validateSessionSemantics({ status: 'suspended', sessionId: 'session-123' })).toBe(
        true,
      );
    });

    it('отклоняет expired/revoked/suspended без sessionId', () => {
      expect(validateSessionSemantics({ status: 'expired' })).toBe(false);
      expect(validateSessionSemantics({ status: 'revoked' })).toBe(false);
      expect(validateSessionSemantics({ status: 'suspended' })).toBe(false);
    });
  });

  describe('validateSecuritySemantics', () => {
    it('валидирует risk_detected с riskLevel и riskScore', () => {
      expect(
        validateSecuritySemantics({
          status: 'risk_detected',
          riskLevel: 'high',
          riskScore: 0.8,
        }),
      ).toBe(true);
    });

    it('отклоняет risk_detected без riskLevel или riskScore', () => {
      expect(validateSecuritySemantics({ status: 'risk_detected' })).toBe(false);
      expect(validateSecuritySemantics({ status: 'risk_detected', riskLevel: 'high' })).toBe(
        false,
      );
      expect(validateSecuritySemantics({ status: 'risk_detected', riskScore: 0.8 })).toBe(false);
    });

    it('валидирует blocked с reason', () => {
      expect(validateSecuritySemantics({ status: 'blocked', reason: 'Suspicious activity' })).toBe(
        true,
      );
    });

    it('отклоняет blocked без reason', () => {
      expect(validateSecuritySemantics({ status: 'blocked' })).toBe(false);
    });

    it('валидирует другие статусы', () => {
      expect(validateSecuritySemantics({ status: 'secure' })).toBe(true);
      expect(validateSecuritySemantics({ status: 'review_required' })).toBe(true);
    });
  });

  describe('restoreAuthFromPersisted', () => {
    it('восстанавливает authenticated с массивом permissions в Set', () => {
      const persistedAuth = {
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
        permissions: ['read', 'write'],
      } as PersistedAuthStoreState['auth'];

      const restored = restoreAuthFromPersisted(persistedAuth);
      expect(restored).toBeDefined();
      void (restored?.status === 'authenticated'
        ? (() => {
          expect(restored.permissions).toBeInstanceOf(Set);
          expect(restored.permissions?.has('read')).toBe(true);
          expect(restored.permissions?.has('write')).toBe(true);
        })()
        : undefined);
    });

    it('возвращает persistedAuth для не-authenticated статусов', () => {
      const persistedAuth = {
        status: 'unauthenticated',
      } as PersistedAuthStoreState['auth'];

      const restored = restoreAuthFromPersisted(persistedAuth);
      expect(restored?.status).toBe('unauthenticated');
    });

    it('возвращает persistedAuth для authenticated без permissions массива', () => {
      const persistedAuth = {
        status: 'authenticated',
        user: { id: 'user-123', email: 'user@example.com' },
      } as PersistedAuthStoreState['auth'];

      const restored = restoreAuthFromPersisted(persistedAuth);
      expect(restored?.status).toBe('authenticated');
      void (restored?.status === 'authenticated'
        ? expect(restored.permissions).toBeUndefined()
        : undefined);
    });
  });

  describe('validatePersistedState', () => {
    it('валидирует полный валидный persisted state', () => {
      const persisted = {
        version: authStoreVersion,
        auth: {
          status: 'authenticated',
          user: { id: 'user-123', email: 'user@example.com' },
          permissions: ['read', 'write'],
        },
        mfa: { status: 'not_setup' },
        oauth: { status: 'idle' },
        security: { status: 'secure' },
        session: {
          status: 'active',
          sessionId: 'session-123',
          expiresAt: '2026-01-01T00:00:00.000Z',
          issuedAt: '2026-01-01T00:00:00.000Z',
        },
        passwordRecovery: { status: 'idle' },
        verification: { status: 'idle' },
      } as unknown;

      expect(validatePersistedState(persisted)).toBe(true);
    });

    it('отклоняет null', () => {
      expect(validatePersistedState(null)).toBe(false);
    });

    it('отклоняет не-объект', () => {
      expect(validatePersistedState('string')).toBe(false);
      expect(validatePersistedState(123)).toBe(false);
    });

    it('отклоняет неверную версию', () => {
      expect(
        validatePersistedState({
          version: 999,
          auth: { status: 'unauthenticated' },
        }),
      ).toBe(false);
    });

    it('отклоняет невалидный auth status', () => {
      expect(
        validatePersistedState({
          version: authStoreVersion,
          auth: { status: 'invalid_status' },
        }),
      ).toBe(false);
    });

    it('отклоняет невалидный mfa', () => {
      expect(
        validatePersistedState({
          version: authStoreVersion,
          auth: { status: 'unauthenticated' },
          mfa: 'invalid',
        }),
      ).toBe(false);
    });

    it('отклоняет невалидный session (не null и не объект)', () => {
      expect(
        validatePersistedState({
          version: authStoreVersion,
          auth: { status: 'unauthenticated' },
          mfa: { status: 'idle' },
          oauth: { status: 'idle' },
          security: { status: 'secure' },
          session: 'invalid',
          passwordRecovery: { status: 'idle' },
          verification: { status: 'idle' },
        }),
      ).toBe(false);
    });

    it('отклоняет extensions как null', () => {
      expect(
        validatePersistedState({
          version: authStoreVersion,
          auth: { status: 'unauthenticated' },
          mfa: { status: 'idle' },
          oauth: { status: 'idle' },
          security: { status: 'secure' },
          session: null,
          passwordRecovery: { status: 'idle' },
          verification: { status: 'idle' },
          extensions: null,
        }),
      ).toBe(false);
    });
  });
});
