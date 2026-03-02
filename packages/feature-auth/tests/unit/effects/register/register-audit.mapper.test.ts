/**
 * @file Unit тесты для effects/register/register-audit.mapper.ts
 * Полное покрытие mapper-функций для audit-событий register-flow.
 */

import { describe, expect, it } from 'vitest';

import {
  createRegisterAuditContext,
  mapAuditResultToPublicResult,
  mapDomainResultToAuditResult,
  mapRegisterResultToAuditEvent,
  testErrorEventBuilder,
  testMfaEventBuilder,
  testSuccessEventBuilder,
} from '../../../../src/effects/register/register-audit.mapper.js';
import type {
  RegisterAuditContext,
  RegisterResultForAudit,
} from '../../../../src/effects/register/register-audit.mapper.js';
import type { RegisterRequest } from '../../../../src/domain/RegisterRequest.js';
import type { RegisterResponse } from '../../../../src/domain/RegisterResponse.js';
import type { DeviceInfo } from '../../../../src/domain/DeviceInfo.js';
import type { AuthError } from '../../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createEmailRegisterRequest(
  overrides: Partial<RegisterRequest<'email'>> = {},
): RegisterRequest<'email'> {
  const base: RegisterRequest<'email'> = {
    identifier: { type: 'email', value: 'user@example.com' },
    password: 'plain-password-123',
    workspaceName: 'workspace-1',
    clientContext: {
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      deviceId: 'device-123',
      geo: { lat: 55.75, lng: 37.61 },
      sessionId: 'session-123',
      appVersion: '1.0.0',
      locale: 'ru-RU',
      timezone: 'UTC',
    },
  };
  return { ...base, ...overrides };
}

function createOAuthRegisterRequest(
  overrides: Partial<RegisterRequest<'oauth'>> = {},
): RegisterRequest<'oauth'> {
  const base: RegisterRequest<'oauth'> = {
    identifier: { type: 'oauth', value: 'oauth-user' },
    provider: 'google',
    providerToken: 'provider-token',
    clientContext: {
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (X11)',
      deviceId: 'device-oauth',
      geo: { lat: 40.0, lng: -70.0 },
      sessionId: 'session-oauth',
      appVersion: '2.0.0',
      locale: 'en-US',
      timezone: 'America/New_York',
    },
  };
  return { ...base, ...overrides };
}

function createDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceId: 'device-from-security',
    deviceType: 'desktop',
    geo: { lat: 51.5, lng: 0.12 },
    ...overrides,
  };
}

function createSuccessRegisterResponse(
  overrides: Partial<RegisterResponse> = {},
): RegisterResponse {
  return {
    userId: 'user-123',
    tokenPair: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-12-31T23:59:59.000Z',
    },
    mfaRequired: false,
    ...overrides,
  } as RegisterResponse;
}

function createMfaRegisterResponse(
  overrides: Partial<RegisterResponse> = {},
): RegisterResponse {
  return {
    userId: 'user-mfa',
    mfaRequired: true,
    ...overrides,
  } as RegisterResponse;
}

function createBaseContext(
  overrides: Partial<RegisterAuditContext> = {},
): RegisterAuditContext {
  const base: RegisterAuditContext = {
    domainResult: undefined,
    timestamp: '2026-01-01T00:00:00.000Z',
    traceId: 'trace-123',
    eventId: 'event-123',
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    deviceId: 'device-123',
    geo: { lat: 55.75, lng: 37.61 },
    registrationType: 'email',
    oauthProvider: undefined,
  };
  return { ...base, ...overrides };
}

function createAuthError(kind: AuthError['kind'] = 'invalid_credentials'): AuthError {
  return {
    kind,
  } as AuthError;
}

// ============================================================================
// 📋 TESTS — createRegisterAuditContext
// ============================================================================

describe('effects/register/register-audit.mapper', () => {
  describe('createRegisterAuditContext', () => {
    it('flatten-ит поля из RegisterRequest и DeviceInfo, приоритизируя DeviceInfo.deviceId/geo', () => {
      const request = createEmailRegisterRequest();
      const context = {
        request,
        traceId: 'trace-ctx',
        timestamp: '2026-02-01T12:00:00.000Z',
      };
      const domainResult = createSuccessRegisterResponse();
      const deviceInfo = createDeviceInfo({
        deviceId: 'device-from-security',
        geo: { lat: 1, lng: 2 },
      });

      const auditContext = createRegisterAuditContext(
        context,
        request,
        domainResult,
        'event-ctx',
        deviceInfo,
      );

      expect(auditContext.domainResult).toBe(domainResult);
      expect(auditContext.timestamp).toBe('2026-02-01T12:00:00.000Z');
      expect(auditContext.traceId).toBe('trace-ctx');
      expect(auditContext.eventId).toBe('event-ctx');
      expect(auditContext.ip).toBe('127.0.0.1');
      expect(auditContext.userAgent).toBe('Mozilla/5.0');
      expect(auditContext.deviceId).toBe('device-from-security');
      expect(auditContext.geo).toEqual({ lat: 1, lng: 2 });
      expect(auditContext.registrationType).toBe('email');
      expect(auditContext.oauthProvider).toBeUndefined();
    });

    it('использует clientContext.deviceId/geo если DeviceInfo не передан', () => {
      const request = createEmailRegisterRequest();
      const context = {
        request,
        traceId: 'trace-ctx',
        timestamp: '2026-02-01T12:00:00.000Z',
      };

      const auditContext = createRegisterAuditContext(
        context,
        request,
        undefined,
        'event-ctx',
      );

      expect(auditContext.deviceId).toBe('device-123');
      expect(auditContext.geo).toEqual({ lat: 55.75, lng: 37.61 });
    });

    it('устанавливает registrationType и oauthProvider для OAuth регистрации', () => {
      const request = createOAuthRegisterRequest();
      const context = {
        request,
        traceId: 'trace-ctx',
        timestamp: '2026-02-01T12:00:00.000Z',
      };

      const auditContext = createRegisterAuditContext(
        context,
        request,
        undefined,
        'event-ctx',
      );

      expect(auditContext.registrationType).toBe('oauth');
      expect(auditContext.oauthProvider).toBe('google');
    });
  });

  // ============================================================================
  // 📋 TESTS — mapDomainResultToAuditResult & mapAuditResultToPublicResult
  // ============================================================================

  describe('mapDomainResultToAuditResult', () => {
    it('маппит success RegisterResponse в RegisterResultForAudit (success)', () => {
      const domainResult = createSuccessRegisterResponse();

      const auditResult = mapDomainResultToAuditResult(domainResult);

      expect(auditResult).toEqual<RegisterResultForAudit>({
        type: 'success',
        userId: 'user-123',
      });
      expect(mapAuditResultToPublicResult(auditResult)).toBe(auditResult);
    });

    it('маппит mfa RegisterResponse в RegisterResultForAudit (mfa_required)', () => {
      const domainResult = createMfaRegisterResponse();

      const auditResult = mapDomainResultToAuditResult(domainResult);

      expect(auditResult).toEqual<RegisterResultForAudit>({
        type: 'mfa_required',
        userId: 'user-mfa',
      });
    });

    it('бросает ошибку если RegisterResponse не содержит ни tokenPair, ни mfaRequired=true', () => {
      const domainResult: RegisterResponse = {
        userId: 'user-invalid',
        mfaRequired: false,
      } as RegisterResponse;

      expect(() => mapDomainResultToAuditResult(domainResult)).toThrow(
        '[register] Invalid RegisterResponse: must have either tokenPair or mfaRequired=true, got: {"userId":"user-invalid","mfaRequired":false}',
      );
    });
  });

  // ============================================================================
  // 📋 TESTS — mapRegisterResultToAuditEvent (base event + success/mfa/error)
  // ============================================================================

  describe('mapRegisterResultToAuditEvent', () => {
    it('маппит success результат в oauth_register_success audit event с sessionId и context.registrationType', () => {
      const result: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      const domainResult = {
        ...createSuccessRegisterResponse(),
        clientContext: { sessionId: 'session-ctx' },
      } as RegisterResponse;

      const context = createRegisterAuditContext(
        {
          request: createEmailRegisterRequest(),
          traceId: 'trace-123',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        createEmailRegisterRequest(),
        domainResult,
        'event-123',
        createDeviceInfo(),
      );

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.type).toBe('oauth_register_success');
      expect(event.userId).toBe('user-123');
      expect(event.sessionId).toBe('session-ctx');
      expect(event.eventId).toBe('event-123');
      expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
      expect(event.ip).toBe('127.0.0.1');
      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.deviceId).toBe('device-from-security');
      expect(event.geo).toEqual({ lat: 51.5, lng: 0.12 });
      expect(event.correlationId).toBe('trace-123');
      expect(event.context).toEqual({ registrationType: 'email' });
    });

    it('для success без domainResult/sessionId и без context-полей не добавляет sessionId и context', () => {
      const result: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      const baseContext = createBaseContext({
        domainResult: undefined,
        registrationType: undefined,
        oauthProvider: undefined,
      });

      const event = mapRegisterResultToAuditEvent(result, baseContext);

      expect(event.type).toBe('oauth_register_success');
      expect(event.userId).toBe('user-123');
      expect(event.sessionId).toBeUndefined();
      expect('context' in event).toBe(false);
    });

    it('маппит mfa_required результат в mfa_challenge audit event с context.registrationType', () => {
      const result: RegisterResultForAudit = {
        type: 'mfa_required',
        userId: 'user-mfa',
      };

      const context = createBaseContext({
        registrationType: 'email',
      });

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.type).toBe('mfa_challenge');
      expect(event.userId).toBe('user-mfa');
      expect(event.context).toEqual({ registrationType: 'email' });
    });

    it('для mfa_required без registrationType не добавляет context', () => {
      const result: RegisterResultForAudit = {
        type: 'mfa_required',
        userId: 'user-mfa',
      };

      const context = createBaseContext({
        registrationType: undefined,
      });

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.type).toBe('mfa_challenge');
      expect(event.userId).toBe('user-mfa');
      expect('context' in event).toBe(false);
    });

    it('маппит error результат в oauth_register_failure audit event с errorCode и context.error', () => {
      const result: RegisterResultForAudit = {
        type: 'error',
        error: createAuthError('invalid_credentials'),
      };

      const context = createBaseContext({
        registrationType: 'email',
      });

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.type).toBe('oauth_register_failure');
      expect(event.errorCode).toBe('invalid_credentials');
      expect(event.context).toEqual({
        error: 'invalid_credentials',
        registrationType: 'email',
      });
    });

    it('для OAuth error добавляет provider в context', () => {
      const result: RegisterResultForAudit = {
        type: 'error',
        error: createAuthError('oauth_error'),
      };

      const context = createBaseContext({
        registrationType: 'oauth',
        oauthProvider: 'google',
      });

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.type).toBe('oauth_register_failure');
      expect(event.errorCode).toBe('oauth_error');
      expect(event.context).toEqual({
        error: 'oauth_error',
        provider: 'google',
      });
    });

    it('buildBaseEvent фильтрует пустые ip/userAgent/deviceId и некорректные geo', () => {
      const context = createBaseContext({
        ip: '   ',
        userAgent: '',
        deviceId: '   ',
        geo: { lat: 999, lng: 999 },
      });

      const result: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.eventId).toBe('event-123');
      expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
      expect(event.ip).toBeUndefined();
      expect(event.userAgent).toBeUndefined();
      expect(event.deviceId).toBeUndefined();
      expect(event.geo).toBeUndefined();
    });

    it('buildBaseEvent не добавляет correlationId когда traceId отсутствует', () => {
      const context = createBaseContext({
        traceId: undefined,
      });

      const result: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      const event = mapRegisterResultToAuditEvent(result, context);

      expect('correlationId' in event).toBe(false);
    });

    it('validateAndNormalizeGeo возвращает undefined если обе координаты отсутствуют', () => {
      const context = createBaseContext({
        geo: {},
      });

      const result: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.geo).toBeUndefined();
    });

    it('validateAndNormalizeGeo пропускает валидные координаты с одной компонентой', () => {
      const contextLatOnly = createBaseContext({
        geo: { lat: 10 },
      });
      const contextLngOnly = createBaseContext({
        geo: { lng: 20 },
      });

      const result: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      const eventLat = mapRegisterResultToAuditEvent(result, contextLatOnly);
      const eventLng = mapRegisterResultToAuditEvent(result, contextLngOnly);

      expect(eventLat.geo).toEqual({ lat: 10 });
      expect(eventLng.geo).toEqual({ lng: 20 });
    });

    it('validateAndNormalizeGeo возвращает undefined если geo === undefined', () => {
      const context = createBaseContext({
        geo: undefined,
      });

      const result: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      const event = mapRegisterResultToAuditEvent(result, context);

      expect(event.geo).toBeUndefined();
    });
  });

  // ============================================================================
  // 📋 TESTS — eventBuilders type guards
  // ============================================================================

  describe('eventBuilders type guards', () => {
    it('success builder выбрасывает ошибку при неверном типе результата', () => {
      const context = createBaseContext();
      const badResult: RegisterResultForAudit = {
        type: 'mfa_required',
        userId: 'user-123',
      };

      expect(() => testSuccessEventBuilder(context, badResult)).toThrow(
        '[register-audit.mapper] Invalid result type for success builder',
      );
    });

    it('mfa_required builder выбрасывает ошибку при неверном типе результата', () => {
      const context = createBaseContext();
      const badResult: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      expect(() => testMfaEventBuilder(context, badResult)).toThrow(
        '[register-audit.mapper] Invalid result type for mfa_required builder',
      );
    });

    it('error builder выбрасывает ошибку при неверном типе результата', () => {
      const context = createBaseContext();
      const badResult: RegisterResultForAudit = {
        type: 'success',
        userId: 'user-123',
      };

      expect(() => testErrorEventBuilder(context, badResult)).toThrow(
        '[register-audit.mapper] Invalid result type for error builder',
      );
    });

    it('error builder использует buildEventContext и всегда возвращает context с error', () => {
      const context = createBaseContext({
        registrationType: 'oauth',
        oauthProvider: 'google',
      });
      const result: RegisterResultForAudit = {
        type: 'error',
        error: createAuthError('oauth_error'),
      };

      const partial = testErrorEventBuilder(context, result);

      expect(partial.errorCode).toBe('oauth_error');
      expect(partial.context).toEqual({
        error: 'oauth_error',
        provider: 'google',
      });
    });
  });
});
