/**
 * @file Unit тесты для effects/register/register-api.mapper.ts
 * Цель: 100% покрытие (statements/branches/functions/lines).
 */

import { describe, expect, it } from 'vitest';

import type { OAuthRegisterRequest } from '../../../../src/domain/OAuthRegisterRequest.js';
import type {
  RegisterIdentifierType,
  RegisterRequest,
} from '../../../../src/domain/RegisterRequest.js';
import type { RegisterResponse } from '../../../../src/domain/RegisterResponse.js';
import type {
  OAuthRegisterRequestValues,
  RegisterRequestValues,
  RegisterResponseValues,
} from '../../../../src/schemas/index.js';
import {
  mapOAuthRegisterRequestToApiPayload as mapOAuthRegisterRequestToPayload,
  mapRegisterRequestToApiPayload as mapRegisterRequestToPayload,
  mapRegisterResponseToDomain,
} from '../../../../src/effects/register/register-api.mapper.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createEmailRegisterRequest(
  overrides: Partial<RegisterRequest<'email'>> = {},
): RegisterRequest<'email'> {
  const base: RegisterRequest<'email'> = {
    identifier: { type: 'email', value: 'user@example.com' },
    password: 'plain-password-123',
    workspaceName: 'acme',
  };
  return { ...base, ...overrides };
}

function createOAuthRegisterRequest(
  overrides: Partial<OAuthRegisterRequest> = {},
): OAuthRegisterRequest {
  const base: OAuthRegisterRequest = {
    provider: 'google',
    // значение фиктивное: важно не содержимое, а наличие поля
    providerToken: 'oauth-credential',
    clientContext: {
      ip: '1.2.3.4',
      deviceId: 'device-1',
      userAgent: 'Mozilla/5.0',
      locale: 'ru-RU',
      timezone: 'UTC',
      geo: { lat: 1, lng: 2 },
      sessionId: 'session-1',
      appVersion: '1.0.0',
    },
  };
  return { ...base, ...overrides };
}

function createRegisterResponseValues(
  overrides: Partial<RegisterResponseValues> = {},
): RegisterResponseValues {
  const base: RegisterResponseValues = {
    userId: 'user-123',
    workspaceId: 'ws-123',
    email: 'user@example.com',
    accessToken: 'a1',
    refreshToken: 'r1',
    tokenType: 'bearer',
    expiresIn: 60,
  };
  return { ...base, ...overrides };
}

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('effects/register/register-api.mapper', () => {
  describe('mapRegisterRequestToPayload (email)', () => {
    it('маппит email регистрацию и нормализует clientContext по whitelist + freeze', () => {
      const request: RegisterRequest<'email'> = createEmailRegisterRequest({
        clientContext: {
          ip: '1.2.3.4',
          deviceId: 'device-1',
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
          timezone: 'UTC',
          geo: { lat: 1, lng: 2 },
          sessionId: 'session-1',
          appVersion: '1.0.0',
        },
      });

      const payload = mapRegisterRequestToPayload(
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
      );

      expect(Object.isFrozen(payload)).toBe(true);

      expect(payload).toEqual<RegisterRequestValues>({
        email: 'user@example.com',
        password: 'plain-password-123',
        workspaceName: 'acme',
        clientContext: {
          ip: '1.2.3.4',
          deviceId: 'device-1',
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
          timezone: 'UTC',
        },
      });
      expect(payload.clientContext).toBeDefined();
      expect(payload.clientContext && Object.isFrozen(payload.clientContext)).toBe(true);
      // убеждаемся, что geo/sessionId/appVersion не протекли в transport payload
      expect(payload.clientContext && 'geo' in payload.clientContext).toBe(false);
      expect(payload.clientContext && 'sessionId' in payload.clientContext).toBe(false);
      expect(payload.clientContext && 'appVersion' in payload.clientContext).toBe(false);
    });

    it('не добавляет clientContext если все whitelist поля undefined (даже если есть non-whitelist)', () => {
      const request: RegisterRequest<'email'> = createEmailRegisterRequest({
        clientContext: {
          geo: { lat: 1, lng: 2 },
          sessionId: 'session-1',
          appVersion: '1.0.0',
        },
      });

      const payload = mapRegisterRequestToPayload(
        request as Readonly<RegisterRequest<RegisterIdentifierType>>,
      );

      expect(payload.clientContext).toBeUndefined();
      expect(Object.isFrozen(payload)).toBe(true);
    });

    it('выбрасывает ошибку если password не задан для email регистрации', () => {
      const { password: _password, ...request } = createEmailRegisterRequest();

      expect(() =>
        mapRegisterRequestToPayload(
          request as unknown as Readonly<RegisterRequest<RegisterIdentifierType>>,
        )
      ).toThrow('[register-api.mapper] password is required for email registration');
    });

    it('выбрасывает ошибку если workspaceName не задан для email регистрации', () => {
      const { workspaceName: _workspaceName, ...request } = createEmailRegisterRequest();

      expect(() =>
        mapRegisterRequestToPayload(
          request as unknown as Readonly<RegisterRequest<RegisterIdentifierType>>,
        )
      ).toThrow('[register-api.mapper] workspaceName is required for email registration');
    });

    it('fail-closed: username/phone/oauth identifier types не поддержаны для /v1/auth/register', () => {
      const usernameReq: RegisterRequest<'username'> = {
        identifier: { type: 'username', value: 'user1' },
        password: 'plain-password-123',
        workspaceName: 'acme',
      };
      const phoneReq: RegisterRequest<'phone'> = {
        identifier: { type: 'phone', value: '+1234567890' },
        password: 'plain-password-123',
        workspaceName: 'acme',
      };
      const oauthReq: RegisterRequest<'oauth'> = {
        identifier: { type: 'oauth', value: 'oauth-user-id' },
        provider: 'google',
        providerToken: 'oauth-token',
      };

      expect(() =>
        mapRegisterRequestToPayload(
          usernameReq as Readonly<RegisterRequest<RegisterIdentifierType>>,
        )
      ).toThrow('identifier.type "username" is not supported for /v1/auth/register');

      expect(() =>
        mapRegisterRequestToPayload(
          phoneReq as Readonly<RegisterRequest<RegisterIdentifierType>>,
        )
      ).toThrow('identifier.type "phone" is not supported for /v1/auth/register');

      expect(() =>
        mapRegisterRequestToPayload(
          oauthReq as Readonly<RegisterRequest<RegisterIdentifierType>>,
        )
      ).toThrow('identifier.type "oauth" is not supported for /v1/auth/register');
    });

    it('assertNever: выбрасывает ошибку на неизвестном identifier.type (runtime guard)', () => {
      const bad = {
        identifier: { type: 'new_type', value: 'x' },
        password: 'plain-password-123',
        workspaceName: 'acme',
      } as unknown as RegisterRequest<RegisterIdentifierType>;

      expect(() => mapRegisterRequestToPayload(bad)).toThrow(
        '[register-api.mapper] Unhandled identifier type: new_type',
      );
    });
  });

  describe('OAuth register request → transport payload', () => {
    it('маппит OAuth payload: trim обязательных полей + provider mapping + clientContext whitelist + freeze', () => {
      const domain = createOAuthRegisterRequest({
        clientContext: {
          ip: '1.2.3.4',
          deviceId: 'device-1',
          userAgent: 'Mozilla/5.0',
          locale: 'ru-RU', // должен быть отброшен (OAuth transport не поддерживает)
          timezone: 'UTC', // должен быть отброшен
        },
      });

      const payload = mapOAuthRegisterRequestToPayload({
        domain,
        code: '  code-123  ',
        state: '  state-456 ',
        redirectUri: '  https://example.com/callback  ',
        workspaceName: '  acme  ',
      });

      expect(Object.isFrozen(payload)).toBe(true);
      expect(payload).toEqual<OAuthRegisterRequestValues>({
        provider: 'google',
        code: 'code-123',
        state: 'state-456',
        redirectUri: 'https://example.com/callback',
        workspaceName: 'acme',
        clientContext: {
          ip: '1.2.3.4',
          deviceId: 'device-1',
          userAgent: 'Mozilla/5.0',
        },
      });
      expect(payload.clientContext && Object.isFrozen(payload.clientContext)).toBe(true);
      expect(payload.clientContext && 'locale' in payload.clientContext).toBe(false);
      expect(payload.clientContext && 'timezone' in payload.clientContext).toBe(false);
    });

    it('fail-fast: code/state/redirectUri/workspaceName не должны быть пустыми (после trim)', () => {
      const domain = createOAuthRegisterRequest();

      expect(() =>
        mapOAuthRegisterRequestToPayload({
          domain,
          code: '   ',
          state: 'ok',
          redirectUri: 'https://example.com/callback',
          workspaceName: 'acme',
        })
      ).toThrow('[register-api.mapper] code must not be empty for OAuth registration');

      expect(() =>
        mapOAuthRegisterRequestToPayload({
          domain,
          code: 'ok',
          state: '   ',
          redirectUri: 'https://example.com/callback',
          workspaceName: 'acme',
        })
      ).toThrow('[register-api.mapper] state must not be empty for OAuth registration');

      expect(() =>
        mapOAuthRegisterRequestToPayload({
          domain,
          code: 'ok',
          state: 'ok',
          redirectUri: '   ',
          workspaceName: 'acme',
        })
      ).toThrow('[register-api.mapper] redirectUri must not be empty for OAuth registration');

      expect(() =>
        mapOAuthRegisterRequestToPayload({
          domain,
          code: 'ok',
          state: 'ok',
          redirectUri: 'https://example.com/callback',
          workspaceName: '   ',
        })
      ).toThrow('[register-api.mapper] workspaceName must not be empty for OAuth registration');
    });

    it('fail-closed: неподдерживаемые domain providers выбрасывают ошибку (yandex/facebook/vk)', () => {
      const yandex = createOAuthRegisterRequest({ provider: 'yandex' });
      const facebook = createOAuthRegisterRequest({ provider: 'facebook' });
      const vk = createOAuthRegisterRequest({ provider: 'vk' });

      ([yandex, facebook, vk] as const).forEach((domain) => {
        expect(() =>
          mapOAuthRegisterRequestToPayload({
            domain,
            code: 'code',
            state: 'state',
            redirectUri: 'https://example.com/callback',
            workspaceName: 'acme',
          })
        ).toThrow('OAuth provider');
      });
    });

    it('assertNever: неизвестный provider (runtime guard)', () => {
      const domain = createOAuthRegisterRequest({
        provider: 'google',
      }) as unknown as OAuthRegisterRequest;
      const badDomain = { ...domain, provider: 'github' } as unknown as OAuthRegisterRequest;

      expect(() =>
        mapOAuthRegisterRequestToPayload({
          domain: badDomain,
          code: 'code',
          state: 'state',
          redirectUri: 'https://example.com/callback',
          workspaceName: 'acme',
        })
      ).toThrow('[register-api.mapper] Unhandled identifier type: github');
    });

    it('не добавляет clientContext если все whitelist поля undefined', () => {
      const domain = createOAuthRegisterRequest({
        clientContext: {
          locale: 'ru-RU',
          timezone: 'UTC',
          geo: { lat: 1, lng: 2 },
          sessionId: 'session-1',
          appVersion: '1.0.0',
        },
      });

      const payload = mapOAuthRegisterRequestToPayload({
        domain,
        code: 'code',
        state: 'state',
        redirectUri: 'https://example.com/callback',
        workspaceName: 'acme',
      });

      expect(payload.clientContext).toBeUndefined();
    });

    it('не добавляет clientContext если clientContext === undefined (early return branch)', () => {
      const { clientContext: _clientContext, ...domain } = createOAuthRegisterRequest();

      const payload = mapOAuthRegisterRequestToPayload({
        domain: domain as unknown as OAuthRegisterRequest,
        code: 'code',
        state: 'state',
        redirectUri: 'https://example.com/callback',
        workspaceName: 'acme',
      });

      expect(payload.clientContext).toBeUndefined();
    });
  });

  describe('mapRegisterResponseToDomain', () => {
    it('fail-fast: accessToken/refreshToken must not be empty', () => {
      const dto1 = createRegisterResponseValues({ accessToken: '' });
      expect(() => mapRegisterResponseToDomain(dto1)).toThrow(
        '[register-api.mapper] accessToken must not be empty',
      );

      const dto2 = createRegisterResponseValues({ refreshToken: '' });
      expect(() => mapRegisterResponseToDomain(dto2)).toThrow(
        '[register-api.mapper] refreshToken must not be empty',
      );
    });

    it('fail-closed: expiresIn must be > 0 when provided', () => {
      const dto = createRegisterResponseValues({ expiresIn: 0 });
      expect(() => mapRegisterResponseToDomain(dto)).toThrow(
        '[register-api.mapper] expiresIn must be > 0',
      );
    });

    it('маппит response с expiresIn и детерминированным now()', () => {
      const dto = createRegisterResponseValues({
        expiresIn: 2,
        accessToken: 'a',
        refreshToken: 'r',
        userId: 'u1',
      });

      const now = (): number => 1_000;
      const result = mapRegisterResponseToDomain(dto, now);

      expect(Object.isFrozen(result)).toBe(true);
      expect(result).toEqual<RegisterResponse>({
        userId: 'u1',
        tokenPair: {
          accessToken: 'a',
          refreshToken: 'r',
          expiresAt: new Date(1_000 + 2 * 1000).toISOString(),
        },
        mfaRequired: false,
        dtoVersion: '1.0',
      } as RegisterResponse);
      expect(Object.isFrozen(result.tokenPair)).toBe(true);
    });

    it('использует default expiresIn (3600s) когда expiresIn отсутствует', () => {
      const dto = createRegisterResponseValues({
        expiresIn: undefined,
        accessToken: 'a',
        refreshToken: 'r',
        userId: 'u2',
      });

      const now = (): number => 0;
      const result = mapRegisterResponseToDomain(dto, now);

      expect(result.userId).toBe('u2');
      expect(result.tokenPair?.expiresAt).toBe(new Date(3_600 * 1000).toISOString());
    });
  });
});
