/**
 * @file Unit тесты для effects/register/register-store-updater.ts
 * ============================================================================
 * 🔐 REGISTER STORE UPDATER — ЕДИНАЯ ТОЧКА ОБНОВЛЕНИЯ СОСТОЯНИЙ
 * ============================================================================
 * Проверяет, что:
 * - success- и mfa-ветки RegisterResponse корректно проецируются в AuthState/SessionState/SecurityState
 * - используется initialSecurityState без пересчёта риска
 * - DeviceInfo строится детерминированно из RegisterRequest.clientContext
 * - fallback-ветки (без /me и без clientContext) ведут себя предсказуемо
 * - невалидные RegisterResponse/MeResponse приводят к fail-closed ошибкам с детерминированными сообщениями
 */

/* eslint-disable fp/no-mutation -- в тестах намеренно используем мутации для фиксации вызовов и состояний */

import { describe, expect, it } from 'vitest';

import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type { MeResponse } from '../../../../src/domain/MeResponse.js';
import type {
  RegisterIdentifierType,
  RegisterRequest,
} from '../../../../src/domain/RegisterRequest.js';
import type { RegisterResponse } from '../../../../src/domain/RegisterResponse.js';
import type { TokenPair } from '../../../../src/domain/TokenPair.js';
import {
  // Вспомогательный экспорт только для unit-тестов (см. файл реализаци)
  testInvalidRegisterResponseMessage,
  updateRegisterState,
} from '../../../../src/effects/register/register-store-updater.js';
import type { AuthStorePort, BatchUpdate } from '../../../../src/effects/shared/auth-store.port.js';
import type {
  AuthEvent,
  AuthState,
  SecurityState,
  SessionState,
} from '../../../../src/types/auth.js';
import { initialSecurityState } from '../../../../src/types/auth-initial.js';

// ============================================================================
// 🔧 HELPERS — MOCK STORE
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
      // Не используется в register-store-updater
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
// 🔧 HELPERS — DOMAIN FIXTURES
// ============================================================================

function createRegisterRequestEmail(
  overrides: Partial<RegisterRequest<'email'>> = {},
): RegisterRequest<'email'> {
  const base: RegisterRequest<'email'> = {
    identifier: { type: 'email', value: 'user@example.com' },
    password: 'plain-password-123',
    workspaceName: 'example-workspace',
    clientContext: {
      deviceId: 'device-1',
      geo: { lat: 1, lng: 2 },
    },
  };
  return { ...base, ...overrides };
}

function createTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  const base: TokenPair = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: '2026-01-02T00:00:00.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    scope: ['read'],
  };
  return { ...base, ...overrides };
}

function createMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  const base: MeResponse = {
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
    features: { featureA: true },
    context: { tenant: 'tenant-1' },
  };
  return { ...base, ...overrides };
}

function createRegisterResponseSuccess(
  overrides: Partial<RegisterResponse & { readonly tokenPair: TokenPair; }> = {},
): RegisterResponse & { readonly tokenPair: TokenPair; } {
  const tokenPair = createTokenPair();
  const base: RegisterResponse = {
    userId: 'user-123',
    mfaRequired: false,
  } as RegisterResponse;

  return {
    ...base,
    tokenPair,
    ...overrides,
  } as RegisterResponse & { readonly tokenPair: TokenPair; };
}

function createRegisterResponseMfa(
  overrides: Partial<RegisterResponse & { readonly mfaRequired: true; }> = {},
): RegisterResponse & { readonly mfaRequired: true; } {
  const base: RegisterResponse = {
    userId: 'user-123',
    mfaRequired: true,
  } as RegisterResponse;

  return {
    ...base,
    ...overrides,
  } as RegisterResponse & { readonly mfaRequired: true; };
}

// ============================================================================
// 🧪 TESTS
// ============================================================================

describe('effects/register/register-store-updater', () => {
  describe('updateRegisterState — success branch', () => {
    it('применяет success-результат с MeResponse: строит AuthState/SessionState и использует initialSecurityState', () => {
      const { store, captured } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();
      const me = createMeResponse();

      updateRegisterState(
        store,
        registerResponse as RegisterResponse,
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
        me,
      );

      // batchUpdate был вызван один раз
      expect(captured.calls).toContain('batchUpdate');
      expect(captured.calls.filter((c) => c === 'batchUpdate')).toHaveLength(1);

      // AuthState: authenticated с user/roles/permissions/features/context из MeResponse
      expect(captured.authState?.status).toBe('authenticated');
      const authenticatedState = captured.authState as Extract<
        AuthState,
        { readonly status: 'authenticated'; }
      >;
      expect(authenticatedState.user).toEqual(me.user);
      expect(authenticatedState.session).toEqual(me.session);
      expect(authenticatedState.roles).toEqual(me.roles);
      expect(authenticatedState.permissions).toEqual(new Set(me.permissions));
      expect(Object.isFrozen(authenticatedState.permissions)).toBe(true);
      expect(authenticatedState.features).toEqual(me.features);
      expect(authenticatedState.context).toEqual(me.context);

      // SessionState: active, device строится из RegisterRequest.clientContext (deviceId + geo, deviceType='unknown')
      expect(captured.sessionState).not.toBeNull();
      const activeSession = captured.sessionState as Extract<
        SessionState,
        { readonly status: 'active'; }
      >;
      expect(activeSession.status).toBe('active');
      expect(activeSession.sessionId).toBe('session-1');
      expect(activeSession.device).toBeDefined();
      const device: DeviceInfo = activeSession.device as DeviceInfo;
      expect(device.deviceId).toBe('device-1');
      expect(device.deviceType).toBe('unknown');
      expect(device.geo).toEqual({ lat: 1, lng: 2 });

      // SecurityState: initialSecurityState (register не использует security-pipeline)
      expect(captured.securityState).toBe(initialSecurityState);

      // Событие user_registered применено
      expect(captured.events).toEqual(['user_registered']);
    });

    it('строит DeviceInfo с fallback deviceId="" и без geo, если clientContext отсутствует', () => {
      const { store, captured } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const { clientContext: _clientContext, ...request } = createRegisterRequestEmail();
      const me = createMeResponse();

      updateRegisterState(
        store,
        registerResponse as RegisterResponse,
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
        me,
      );

      const activeSession = captured.sessionState as Extract<
        SessionState,
        { readonly status: 'active'; }
      >;
      expect(activeSession.device).toBeDefined();
      const device: DeviceInfo = activeSession.device as DeviceInfo;
      expect(device.deviceId).toBe('');
      expect(device.deviceType).toBe('unknown');
      expect('geo' in device).toBe(false);
    });

    it('использует fallback AuthState по userId если MeResponse отсутствует и не строит SessionState (null)', () => {
      const { store, captured } = createMockStore();
      const registerResponse = createRegisterResponseSuccess({ userId: 'user-fallback' });
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      updateRegisterState(
        store,
        registerResponse as RegisterResponse,
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
        undefined,
      );

      expect(captured.authState?.status).toBe('authenticated');
      const authenticatedState = captured.authState as Extract<
        AuthState,
        { readonly status: 'authenticated'; }
      >;
      expect(authenticatedState.user.id).toBe('user-fallback');
      expect(authenticatedState.roles).toEqual([]);
      expect(authenticatedState.permissions).toEqual(new Set());

      // При отсутствии MeResponse.buildSessionState возвращает null
      expect(captured.sessionState).toBeNull();
    });

    it('корректно обрабатывает MeResponse без session (SessionState = null, но AuthState из /me)', () => {
      const { store, captured } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const baseMe = createMeResponse();
      const { session: _session, ...me } = baseMe;
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      updateRegisterState(
        store,
        registerResponse as RegisterResponse,
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
        me,
      );

      const authenticatedState = captured.authState as Extract<
        AuthState,
        { readonly status: 'authenticated'; }
      >;
      expect(authenticatedState.user).toEqual(me.user);
      expect(authenticatedState.session).toBeUndefined();
      expect(captured.sessionState).toBeNull();
    });
  });

  describe('updateRegisterState — mfa branch', () => {
    it('переводит пользователя в pending_secondary_verification и сбрасывает SessionState, SecurityState = initialSecurityState', () => {
      const { store, captured } = createMockStore();
      const registerResponse = createRegisterResponseMfa();
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      updateRegisterState(
        store,
        registerResponse as RegisterResponse,
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
        undefined,
      );

      const pendingState = captured.authState as Extract<
        AuthState,
        { readonly status: 'pending_secondary_verification'; }
      >;
      expect(pendingState.status).toBe('pending_secondary_verification');
      expect(pendingState.userId).toBe('user-123');
      expect(pendingState.verificationType).toBe('mfa');

      expect(captured.sessionState).toBeNull();
      expect(captured.securityState).toBe(initialSecurityState);
      expect(captured.events).toEqual(['mfa_challenge_sent']);
    });
  });

  describe('updateRegisterState — validation & fail-closed', () => {
    it('бросает детерминированную ошибку если RegisterResponse не содержит ни tokenPair, ни mfaRequired=true', () => {
      const { store } = createMockStore();
      const invalidResponse: RegisterResponse = {
        userId: 'user-123',
        // tokenPair отсутствует
        mfaRequired: false,
      } as RegisterResponse;
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      expect(() =>
        updateRegisterState(
          store,
          invalidResponse,
          request as Readonly<RegisterRequest<RegisterIdentifierType>>,
          undefined,
        )
      ).toThrow(
        '[register-store-updater] Invalid RegisterResponse: must have either '
          + 'tokenPair or mfaRequired=true, got: '
          + 'userId=user-123, tokenPair=absent, mfaRequired=false',
      );
    });

    it('валидирует MeResponse.user.id и бросает ошибку для пустого id (source=me)', () => {
      const { store } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const baseMe = createMeResponse();
      const me: MeResponse = {
        ...baseMe,
        user: { ...baseMe.user, id: '' },
      };
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      expect(() =>
        updateRegisterState(
          store,
          registerResponse as RegisterResponse,
          request as Readonly<RegisterRequest<RegisterIdentifierType>>,
          me,
        )
      ).toThrow(
        '[register-store-updater] Invalid user.id from me: ""',
      );
    });

    it('валидирует MeResponse.session.sessionId и бросает ошибку для пустого значения', () => {
      const { store } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const baseMe = createMeResponse();
      const me: MeResponse = {
        ...baseMe,
        session: {
          ...baseMe.session!,
          sessionId: '',
        },
      };
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      expect(() =>
        updateRegisterState(
          store,
          registerResponse as RegisterResponse,
          request as Readonly<RegisterRequest<RegisterIdentifierType>>,
          me,
        )
      ).toThrow(
        '[register-store-updater] Invalid session.sessionId: ""',
      );
    });

    it('валидирует MeResponse.roles как массив и бросает ошибку если приходит не-массив', () => {
      const { store } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const baseMe = createMeResponse();
      const me: MeResponse = {
        ...baseMe,
        roles: 'not-an-array' as unknown as readonly string[],
      };
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      expect(() =>
        updateRegisterState(
          store,
          registerResponse as RegisterResponse,
          request as Readonly<RegisterRequest<RegisterIdentifierType>>,
          me,
        )
      ).toThrow(
        '[register-store-updater] Invalid roles: expected array, got string',
      );
    });

    it('валидирует MeResponse.permissions как массив и бросает ошибку если приходит не-массив', () => {
      const { store } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const baseMe = createMeResponse();
      const me: MeResponse = {
        ...baseMe,
        permissions: 'not-an-array' as unknown as readonly string[],
      };
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      expect(() =>
        updateRegisterState(
          store,
          registerResponse as RegisterResponse,
          request as Readonly<RegisterRequest<RegisterIdentifierType>>,
          me,
        )
      ).toThrow(
        '[register-store-updater] Invalid permissions: expected array, got string',
      );
    });

    it('валидирует fallback userId из RegisterResponse (source=register_fallback)', () => {
      const { store } = createMockStore();
      const registerResponse = createRegisterResponseSuccess({ userId: '' });
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      expect(() =>
        updateRegisterState(
          store,
          registerResponse as RegisterResponse,
          request as Readonly<RegisterRequest<RegisterIdentifierType>>,
          undefined,
        )
      ).toThrow(
        '[register-store-updater] Invalid user.id from register_fallback: ""',
      );
    });

    it('валидирует userId для mfa-ветки (source=register_mfa)', () => {
      const { store } = createMockStore();
      const registerResponse = createRegisterResponseMfa({ userId: '' });
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      expect(() =>
        updateRegisterState(
          store,
          registerResponse as RegisterResponse,
          request as Readonly<RegisterRequest<RegisterIdentifierType>>,
          undefined,
        )
      ).toThrow(
        '[register-store-updater] Invalid user.id from register_mfa: ""',
      );
    });

    it('не добавляет features/context в AuthState если они отсутствуют в MeResponse', () => {
      const { store, captured } = createMockStore();
      const registerResponse = createRegisterResponseSuccess();
      const baseMe = createMeResponse();
      const {
        features: _features,
        context: _context,
        ...me
      } = baseMe;
      const request: RegisterRequest<'email'> = createRegisterRequestEmail();

      updateRegisterState(
        store,
        registerResponse as RegisterResponse,
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
        me,
      );

      const authenticatedState = captured.authState as Extract<
        AuthState,
        { readonly status: 'authenticated'; }
      >;
      expect('features' in authenticatedState).toBe(false);
      expect('context' in authenticatedState).toBe(false);
    });

    it('invalid RegisterResponse error message формирует tokenPair=present для состояний с tokenPair', () => {
      const registerResponseWithToken = createRegisterResponseSuccess() as RegisterResponse;

      const message = testInvalidRegisterResponseMessage(registerResponseWithToken);

      expect(message).toContain('tokenPair=present');
      expect(message).toContain('userId=user-123');
    });
  });
});

/* eslint-enable fp/no-mutation */
