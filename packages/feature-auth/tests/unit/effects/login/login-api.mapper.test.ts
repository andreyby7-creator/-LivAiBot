/**
 * @file Unit тесты для effects/login/login-api.mapper.ts
 * Полное покрытие маппинга LoginRequest/LoginResponseDto ↔ domain типов.
 */

import { describe, expect, it } from 'vitest';

import type { LoginIdentifierType, LoginRequest } from '../../../../src/domain/LoginRequest.js';
import type { DomainLoginResult } from '../../../../src/domain/LoginResult.js';
import type { MeResponse } from '../../../../src/domain/MeResponse.js';
import type { TokenPair } from '../../../../src/domain/TokenPair.js';
import {
  mapLoginRequestToApiPayload,
  mapLoginResponseToDomain,
} from '../../../../src/effects/login/login-api.mapper.js';
import type {
  LoginRequestValues,
  LoginTokenPairValues,
  MeResponseValues,
  MfaChallengeRequestValues,
} from '../../../../src/schemas/index.js';
import type { LoginResponseDto } from '../../../../src/types/login.dto.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createEmailLoginRequest(
  overrides: Partial<LoginRequest<'email'>> = {},
): LoginRequest<'email'> {
  const base: LoginRequest<'email'> = {
    identifier: { type: 'email', value: 'user@example.com' },
    password: 'plain-password',
  };
  return { ...base, ...overrides };
}

function createOAuthLoginRequest(
  overrides: Partial<LoginRequest<'oauth'>> = {},
): LoginRequest<'oauth'> {
  const base: LoginRequest<'oauth'> = {
    identifier: { type: 'oauth', value: 'oauth-user-id' },
    provider: 'google',
    providerToken: 'oauth-token',
  };
  return { ...base, ...overrides };
}

function createLoginTokenPairValues(
  overrides: Partial<LoginTokenPairValues> = {},
): LoginTokenPairValues {
  const base: LoginTokenPairValues = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresAt: '2026-01-01T00:00:00.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    scope: ['read', 'write'],
    metadata: {
      deviceId: 'device-123',
      attempts: 1,
      tags: ['login', 'web'],
    },
  };
  return { ...base, ...overrides };
}

function createMeResponseValues(
  overrides: Partial<MeResponseValues> = {},
): MeResponseValues {
  const base: MeResponseValues = {
    user: {
      id: 'user-123',
      email: 'user@example.com',
      emailVerified: true,
      username: 'testuser',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      authProvider: 'password',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-01-01T00:00:00.000Z',
    },
    roles: ['user', 'admin'],
    permissions: ['read', 'write'],
    session: {
      sessionId: 'session-123',
      ip: '192.168.1.1',
      deviceId: 'device-123',
      userAgent: 'Mozilla/5.0',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    },
    features: { feature1: true, feature2: false },
    context: {
      org: 'org-123',
      tenant: 'tenant-123',
      flags: ['beta'],
      score: 1,
    },
  };
  return { ...base, ...overrides };
}

function createMfaChallengeRequestValues(
  overrides: Partial<MfaChallengeRequestValues> = {},
): MfaChallengeRequestValues {
  const base: MfaChallengeRequestValues = {
    userId: 'user-123',
    method: 'totp',
  };
  return { ...base, ...overrides };
}

function createSuccessLoginResponseDto(
  overrides: Partial<Extract<LoginResponseDto, { type: 'success'; }>> = {},
): Extract<LoginResponseDto, { type: 'success'; }> {
  return {
    type: 'success',
    tokenPair: createLoginTokenPairValues(),
    me: createMeResponseValues(),
    ...overrides,
  };
}

function createMfaRequiredLoginResponseDto(
  overrides: Partial<Extract<LoginResponseDto, { type: 'mfa_required'; }>> = {},
): Extract<LoginResponseDto, { type: 'mfa_required'; }> {
  return {
    type: 'mfa_required',
    challenge: createMfaChallengeRequestValues(),
    ...overrides,
  };
}

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('effects/login/login-api.mapper', () => {
  // REQUEST SIDE

  it('mapLoginRequestToApiPayload: non-OAuth без mfa/clientContext нормализуется с dtoVersion по умолчанию', () => {
    const request: LoginRequest<'email'> = createEmailLoginRequest();

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(Object.isFrozen(payload)).toBe(true);
    expect(payload.identifier).toEqual({ type: 'email', value: 'user@example.com' });
    expect(payload.password).toBe('plain-password');
    expect(payload.dtoVersion).toBe('1.0');
    expect(payload.rememberMe).toBeUndefined();
    expect(payload.clientContext).toBeUndefined();
    expect(payload.mfa).toBeUndefined();
  });

  it('mapLoginRequestToApiPayload: non-OAuth с mfa как объект и clientContext нормализуется корректно', () => {
    const request: LoginRequest<'email'> = createEmailLoginRequest({
      dtoVersion: '1.1',
      rememberMe: true,
      mfa: { type: 'totp', token: '123456', deviceId: 'device-1' },
      clientContext: {
        ip: '1.2.3.4',
        deviceId: 'device-1',
        userAgent: 'Mozilla/5.0',
        locale: 'en-US',
        timezone: 'UTC',
        sessionId: 'session-1',
        appVersion: '1.0.0',
        geo: { lat: 1, lng: 2 },
      },
    });

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.dtoVersion).toBe('1.1');
    expect(payload.rememberMe).toBe(true);

    expect(payload.mfa).toEqual({
      type: 'totp',
      token: '123456',
      deviceId: 'device-1',
    });

    expect(payload.clientContext).toEqual({
      ip: '1.2.3.4',
      deviceId: 'device-1',
      userAgent: 'Mozilla/5.0',
      locale: 'en-US',
      timezone: 'UTC',
      sessionId: 'session-1',
      appVersion: '1.0.0',
      geo: {
        lat: 1,
        lng: 2,
      },
    });
    expect(Object.isFrozen(payload.clientContext)).toBe(true);
    expect(
      payload.clientContext && 'geo' in payload.clientContext
        ? Object.isFrozen(payload.clientContext.geo)
        : false,
    ).toBe(true);
  });

  it('mapLoginRequestToApiPayload: non-OAuth с mfa как массив создаёт новый массив', () => {
    const mfaArray = [
      { type: 'totp', token: '111111', deviceId: 'device-1' },
      { type: 'sms', token: '222222', deviceId: 'device-2' },
    ] as const;

    const request: LoginRequest<'email'> = createEmailLoginRequest({
      mfa: mfaArray as unknown as LoginRequest<'email'>['mfa'],
    } as Partial<LoginRequest<'email'>>);

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(Array.isArray(payload.mfa)).toBe(true);
    expect(payload.mfa).toEqual(mfaArray);
    // Должен быть новый массив, а не исходный input
    expect(payload.mfa).not.toBe(mfaArray);
  });

  it('mapLoginRequestToApiPayload: non-OAuth с mfa типа push нормализуется без token', () => {
    const request: LoginRequest<'email'> = createEmailLoginRequest({
      mfa: { type: 'push', deviceId: 'device-push-1' } as LoginRequest<'email'>['mfa'],
    } as Partial<LoginRequest<'email'>>);

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.mfa).toEqual({
      type: 'push',
      deviceId: 'device-push-1',
    });
    expect('token' in (payload.mfa ?? {})).toBe(false);
  });

  it('mapLoginRequestToApiPayload: non-OAuth с mfa массивом включая push нормализуется корректно', () => {
    const mfaArray = [
      { type: 'totp', token: '111111', deviceId: 'device-1' },
      { type: 'push', deviceId: 'device-push-1' },
    ] as const;

    const request: LoginRequest<'email'> = createEmailLoginRequest({
      mfa: mfaArray as unknown as LoginRequest<'email'>['mfa'],
    } as Partial<LoginRequest<'email'>>);

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(Array.isArray(payload.mfa)).toBe(true);
    expect(payload.mfa).toEqual([
      { type: 'totp', token: '111111', deviceId: 'device-1' },
      { type: 'push', deviceId: 'device-push-1' },
    ]);
  });

  it('mapLoginRequestToApiPayload: non-OAuth с mfa без deviceId нормализуется без deviceId поля', () => {
    const request: LoginRequest<'email'> = createEmailLoginRequest({
      mfa: { type: 'totp', token: '123456' } as LoginRequest<'email'>['mfa'],
    } as Partial<LoginRequest<'email'>>);

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.mfa).toEqual({
      type: 'totp',
      token: '123456',
    });
    expect('deviceId' in (payload.mfa ?? {})).toBe(false);
  });

  it('mapLoginRequestToApiPayload: non-OAuth с clientContext без geo нормализуется без geo поля', () => {
    const request: LoginRequest<'email'> = createEmailLoginRequest({
      clientContext: {
        ip: '1.2.3.4',
        deviceId: 'device-1',
        userAgent: 'Mozilla/5.0',
        locale: 'en-US',
        timezone: 'UTC',
        sessionId: 'session-1',
        appVersion: '1.0.0',
      },
    });

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.clientContext).toBeDefined();
    expect(payload.clientContext?.ip).toBe('1.2.3.4');
    expect('geo' in (payload.clientContext ?? {})).toBe(false);
  });

  it('mapLoginRequestToApiPayload: OAuth без clientContext и mfa нормализуется корректно', () => {
    const request: LoginRequest<'oauth'> = createOAuthLoginRequest({
      dtoVersion: '1.1',
      rememberMe: true,
    });

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.identifier).toEqual({ type: 'oauth', value: 'oauth-user-id' });
    expect((payload as LoginRequestValues).provider).toBe('google');
    expect((payload as LoginRequestValues).providerToken).toBe('oauth-token');
    expect(payload.dtoVersion).toBe('1.1');
    expect(payload.rememberMe).toBe(true);
    expect(payload.clientContext).toBeUndefined();
    expect(payload.mfa).toBeUndefined();
  });

  it('mapLoginRequestToApiPayload: OAuth с clientContext но без mfa нормализуется корректно', () => {
    const request: LoginRequest<'oauth'> = createOAuthLoginRequest({
      clientContext: {
        ip: '1.2.3.4',
        deviceId: 'device-1',
        userAgent: 'Mozilla/5.0',
      },
    });

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.clientContext).toBeDefined();
    expect(payload.clientContext?.ip).toBe('1.2.3.4');
    expect(payload.mfa).toBeUndefined();
  });

  it('mapLoginRequestToApiPayload: OAuth с mfa но без clientContext нормализуется корректно', () => {
    const request: LoginRequest<'oauth'> = createOAuthLoginRequest({
      mfa: { type: 'totp', token: '123456' } as LoginRequest<'oauth'>['mfa'],
    } as Partial<LoginRequest<'oauth'>>);

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.mfa).toBeDefined();
    expect(payload.mfa).toEqual({
      type: 'totp',
      token: '123456',
    });
    expect(payload.clientContext).toBeUndefined();
  });

  it('mapLoginRequestToApiPayload: OAuth ветка использует provider/providerToken и не использует password', () => {
    const request: LoginRequest<'oauth'> = createOAuthLoginRequest({
      dtoVersion: '1.1',
      rememberMe: true,
    });

    const payload = mapLoginRequestToApiPayload(
      request as Readonly<LoginRequest<LoginIdentifierType>>,
    );

    expect(payload.identifier).toEqual({ type: 'oauth', value: 'oauth-user-id' });
    expect((payload as LoginRequestValues).provider).toBe('google');
    expect((payload as LoginRequestValues).providerToken).toBe('oauth-token');
    expect((payload as LoginRequestValues).password).toBeUndefined();
    expect(payload.dtoVersion).toBe('1.1');
    expect(payload.rememberMe).toBe(true);
  });

  // RESPONSE SIDE

  it('mapLoginResponseToDomain: success ветка корректно маппит TokenPair и MeResponse и делает freeze', () => {
    const dto = createSuccessLoginResponseDto();

    const result = mapLoginResponseToDomain(dto as Readonly<LoginResponseDto>);

    expect(result.type).toBe('success');
    expect(Object.isFrozen(result)).toBe(true);

    const tokenPair = (result as Extract<DomainLoginResult, { type: 'success'; }>).tokenPair;
    const me = (result as Extract<DomainLoginResult, { type: 'success'; }>).me;

    expect(Object.isFrozen(tokenPair)).toBe(true);
    expect(Object.isFrozen(me)).toBe(true);
    expect(Object.isFrozen(me.user)).toBe(true);
    expect(Object.isFrozen(me.roles)).toBe(true);
    expect(Object.isFrozen(me.permissions)).toBe(true);
    // Эти поля могут быть undefined, поэтому проверяем frozen только когда присутствуют
    expect(
      me.session ? Object.isFrozen(me.session) : true,
    ).toBe(true);
    expect(
      me.features ? Object.isFrozen(me.features) : true,
    ).toBe(true);
    expect(
      me.context ? Object.isFrozen(me.context) : true,
    ).toBe(true);

    // Проверяем, что массивы/объекты не разделяют ссылку с исходными DTO
    const originalTokenPair = dto.tokenPair as TokenPair;
    const originalMe = dto.me as MeResponse;

    expect(tokenPair.scope).not.toBe(originalTokenPair.scope);
    expect(me.roles).not.toBe(originalMe.roles);
    expect(me.permissions).not.toBe(originalMe.permissions);
  });

  it('mapLoginResponseToDomain: mfa_required ветка маппит challenge 1:1', () => {
    const dto = createMfaRequiredLoginResponseDto();

    const result = mapLoginResponseToDomain(dto as Readonly<LoginResponseDto>);

    expect(result.type).toBe('mfa_required');
    const challenge = (result as Extract<DomainLoginResult, { type: 'mfa_required'; }>).challenge;
    expect(challenge.userId).toBe('user-123');
    expect(challenge.type).toBe('totp');
  });

  it('mapLoginResponseToDomain: unsafe tokenPair.metadata (не plain object) выбрасывает ошибку', () => {
    const badDto: LoginResponseDto = {
      type: 'success',
      tokenPair: createLoginTokenPairValues({
        metadata: [] as unknown as Record<string, unknown>,
      }),
      me: createMeResponseValues({
        context: undefined,
      }),
    };

    expect(() => mapLoginResponseToDomain(badDto as Readonly<LoginResponseDto>))
      .toThrow('[auth-api.mappers] Unsafe tokenPair.metadata: expected plain object');
  });

  it('mapLoginResponseToDomain: unsafe me.context (не primitive/primitive[]) выбрасывает ошибку', () => {
    const badContext = {
      org: 'org-123',
      unsafe: { fn: (): void => {} },
    } as unknown as Record<string, unknown>;

    const badDto: LoginResponseDto = {
      type: 'success',
      tokenPair: createLoginTokenPairValues({
        metadata: { deviceId: 'device-123' },
      }),
      me: createMeResponseValues({
        context: badContext,
      }),
    };

    expect(() => mapLoginResponseToDomain(badDto as Readonly<LoginResponseDto>))
      .toThrow(
        '[auth-api.mappers] Unsafe me.context: only primitive values or arrays of primitives are allowed',
      );
  });

  it('mapLoginResponseToDomain: default ветка fail-closed через assertNever', () => {
    const unexpectedDto = {
      type: 'unexpected',
      tokenPair: {},
      me: {},
    } as unknown as LoginResponseDto;

    expect(() => mapLoginResponseToDomain(unexpectedDto)).toThrow(
      'Unexpected LoginResponseDto variant',
    );
  });
});
