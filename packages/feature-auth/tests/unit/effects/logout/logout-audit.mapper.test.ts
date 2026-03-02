/**
 * @file Unit тесты для effects/logout/logout-audit.mapper.ts
 * Полное покрытие mapper-функций для audit-событий logout-flow.
 */

/* eslint-disable @livai/rag/context-leakage, functional/no-conditional-statements */

import { describe, expect, it } from 'vitest';

import {
  mapLogoutResultToAuditEvent,
  mapRevokeErrorToAuditEvent,
  mapRevokeSkippedToAuditEvent,
} from '../../../../src/effects/logout/logout-audit.mapper.js';
import type {
  LogoutAuditContext,
  LogoutResultForAudit,
} from '../../../../src/effects/logout/logout-audit.mapper.js';
import type { AuthError } from '../../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

const createBaseContext = (
  overrides: Partial<LogoutAuditContext> = {},
): LogoutAuditContext => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  eventId: 'event-123',
  traceId: 'trace-123',
  userId: 'user-123',
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  deviceId: 'device-123',
  geo: { lat: 55.7558, lng: 37.6173 },
  riskScore: 50,
  ...overrides,
});

const createAuthError = (kind: AuthError['kind']): AuthError => {
  switch (kind) {
    case 'network':
      return { kind: 'network', retryable: true, message: 'Network error' };
    case 'invalid_credentials':
      return { kind: 'invalid_credentials', message: 'Invalid credentials' };
    case 'account_locked':
      return { kind: 'account_locked', message: 'Account locked' };
    case 'account_disabled':
      return { kind: 'account_disabled', message: 'Account disabled' };
    case 'email_not_verified':
      return { kind: 'email_not_verified', message: 'Email not verified' };
    case 'phone_not_verified':
      return { kind: 'phone_not_verified', message: 'Phone not verified' };
    case 'mfa_required':
      return { kind: 'mfa_required', message: 'MFA required' };
    case 'mfa_failed':
      return { kind: 'mfa_failed', message: 'MFA failed' };
    case 'token_expired':
      return { kind: 'token_expired', message: 'Token expired' };
    case 'token_invalid':
      return { kind: 'token_invalid', message: 'Token invalid' };
    case 'session_expired':
      return { kind: 'session_expired', message: 'Session expired' };
    case 'session_revoked':
      return { kind: 'session_revoked', message: 'Session revoked' };
    case 'rate_limited':
      return { kind: 'rate_limited', message: 'Rate limited' };
    case 'permission_denied':
      return { kind: 'permission_denied', message: 'Permission denied' };
    case 'risk_blocked':
      return { kind: 'risk_blocked', message: 'Risk blocked' };
    case 'oauth_error':
      return { kind: 'oauth_error', message: 'OAuth error' };
    case 'unknown':
      // unknown требует обязательное поле raw
      return {
        kind: 'unknown',
        message: 'Unknown error',
        raw: { code: 'UNKNOWN', message: 'Unknown error' } as any,
      };
    default:
      // TypeScript exhaustive check
      const _exhaustive: never = kind;
      throw new Error(`Unsupported error kind: ${_exhaustive}`);
  }
};

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('effects/logout/logout-audit.mapper', () => {
  describe('mapLogoutResultToAuditEvent', () => {
    describe('success case', () => {
      it('маппит success результат в logout_success audit event с userId', () => {
        const result: LogoutResultForAudit = {
          type: 'success',
        };

        const context = createBaseContext({
          userId: 'user-123',
        });

        const event = mapLogoutResultToAuditEvent(result, context);

        expect(event.type).toBe('logout_success');
        expect(event.userId).toBe('user-123');
        expect(event.eventId).toBe('event-123');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
        expect(event.ip).toBe('127.0.0.1');
        expect(event.userAgent).toBe('Mozilla/5.0');
        expect(event.deviceId).toBe('device-123');
        expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
        expect(event.riskScore).toBe(50);
        expect(event.correlationId).toBe('trace-123');
      });

      it('маппит success результат без userId (pre-auth logout scenario)', () => {
        const result: LogoutResultForAudit = {
          type: 'success',
        };

        const context = createBaseContext({
          userId: undefined,
        });

        const event = mapLogoutResultToAuditEvent(result, context);

        expect(event.type).toBe('logout_success');
        expect(event.userId).toBeUndefined();
        expect(event.eventId).toBe('event-123');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
      });

      it('маппит success результат с минимальным контекстом', () => {
        const result: LogoutResultForAudit = {
          type: 'success',
        };

        const context: LogoutAuditContext = {
          timestamp: '2026-01-01T00:00:00.000Z',
          eventId: 'event-minimal',
          traceId: undefined,
          userId: undefined,
          ip: undefined,
          userAgent: undefined,
          deviceId: undefined,
          geo: undefined,
          riskScore: undefined,
        };

        const event = mapLogoutResultToAuditEvent(result, context);

        expect(event.type).toBe('logout_success');
        expect(event.userId).toBeUndefined();
        expect(event.eventId).toBe('event-minimal');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
        expect(event.ip).toBeUndefined();
        expect(event.userAgent).toBeUndefined();
        expect(event.deviceId).toBeUndefined();
        expect(event.geo).toBeUndefined();
        expect(event.riskScore).toBeUndefined();
        expect(event.correlationId).toBeUndefined();
      });
    });

    describe('error case', () => {
      it('маппит error результат в logout_failure audit event с userId', () => {
        const result: LogoutResultForAudit = {
          type: 'error',
          error: createAuthError('network'),
        };

        const context = createBaseContext({
          userId: 'user-123',
        });

        const event = mapLogoutResultToAuditEvent(result, context);

        expect(event.type).toBe('logout_failure');
        expect(event.errorCode).toBe('network');
        expect(event.userId).toBe('user-123');
        expect(event.eventId).toBe('event-123');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
        expect(event.ip).toBe('127.0.0.1');
        expect(event.userAgent).toBe('Mozilla/5.0');
        expect(event.deviceId).toBe('device-123');
        expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
        expect(event.riskScore).toBe(50);
        expect(event.correlationId).toBe('trace-123');
      });

      it('маппит error результат без userId (pre-auth logout scenario)', () => {
        const result: LogoutResultForAudit = {
          type: 'error',
          error: createAuthError('invalid_credentials'),
        };

        const context = createBaseContext({
          userId: undefined,
        });

        const event = mapLogoutResultToAuditEvent(result, context);

        expect(event.type).toBe('logout_failure');
        expect(event.errorCode).toBe('invalid_credentials');
        expect(event.userId).toBeUndefined();
        expect(event.eventId).toBe('event-123');
      });

      it('маппит error результат с разными типами ошибок', () => {
        const errorTypes: AuthError['kind'][] = [
          'network',
          'invalid_credentials',
          'account_locked',
          'token_expired',
          'rate_limited',
        ];

        errorTypes.forEach((errorKind) => {
          const result: LogoutResultForAudit = {
            type: 'error',
            error: createAuthError(errorKind),
          };

          const context = createBaseContext();

          const event = mapLogoutResultToAuditEvent(result, context);

          expect(event.type).toBe('logout_failure');
          expect(event.errorCode).toBe(errorKind);
        });
      });

      it('маппит error результат с минимальным контекстом', () => {
        const result: LogoutResultForAudit = {
          type: 'error',
          error: createAuthError('network'),
        };

        const context: LogoutAuditContext = {
          timestamp: '2026-01-01T00:00:00.000Z',
          eventId: 'event-error',
          traceId: undefined,
          userId: undefined,
          ip: undefined,
          userAgent: undefined,
          deviceId: undefined,
          geo: undefined,
          riskScore: undefined,
        };

        const event = mapLogoutResultToAuditEvent(result, context);

        expect(event.type).toBe('logout_failure');
        expect(event.errorCode).toBe('network');
        expect(event.userId).toBeUndefined();
        expect(event.eventId).toBe('event-error');
      });
    });

    describe('exhaustive check', () => {
      it('выбрасывает ошибку при неподдерживаемом типе результата', () => {
        const context = createBaseContext();

        // Используем type casting для тестирования exhaustive check
        const invalidResult = { type: 'invalid_type' } as any as LogoutResultForAudit;

        expect(() => {
          mapLogoutResultToAuditEvent(invalidResult, context);
        }).toThrow('[logout-audit.mapper] Unsupported LogoutResult type:');
      });
    });

    describe('context fields mapping', () => {
      it('правильно маппит все поля контекста в audit event', () => {
        const result: LogoutResultForAudit = {
          type: 'success',
        };

        const context: LogoutAuditContext = {
          timestamp: '2026-12-31T23:59:59.999Z',
          eventId: 'event-full',
          traceId: 'trace-full',
          userId: 'user-full',
          ip: '192.168.1.1',
          userAgent: 'Custom Agent',
          deviceId: 'device-full',
          geo: { lat: 90, lng: 180 },
          riskScore: 99,
        };

        const event = mapLogoutResultToAuditEvent(result, context);

        expect(event.eventId).toBe('event-full');
        expect(event.timestamp).toBe('2026-12-31T23:59:59.999Z');
        expect(event.correlationId).toBe('trace-full');
        expect(event.userId).toBe('user-full');
        expect(event.ip).toBe('192.168.1.1');
        expect(event.userAgent).toBe('Custom Agent');
        expect(event.deviceId).toBe('device-full');
        expect(event.geo).toEqual({ lat: 90, lng: 180 });
        expect(event.riskScore).toBe(99);
      });

      it('правильно маппит geo с частичными координатами', () => {
        const result: LogoutResultForAudit = {
          type: 'success',
        };

        const contextWithLatOnly: LogoutAuditContext = {
          ...createBaseContext(),
          geo: { lat: 55.7558 },
        };

        const event1 = mapLogoutResultToAuditEvent(result, contextWithLatOnly);
        expect(event1.geo).toEqual({ lat: 55.7558 });

        const contextWithLngOnly: LogoutAuditContext = {
          ...createBaseContext(),
          geo: { lng: 37.6173 },
        };

        const event2 = mapLogoutResultToAuditEvent(result, contextWithLngOnly);
        expect(event2.geo).toEqual({ lng: 37.6173 });
      });
    });
  });

  describe('mapRevokeErrorToAuditEvent', () => {
    it('маппит revoke error в revoke_error audit event с userId', () => {
      const error = createAuthError('network');
      const context = createBaseContext({
        userId: 'user-123',
      });

      const event = mapRevokeErrorToAuditEvent(error, context);

      expect(event.type).toBe('revoke_error');
      expect(event.errorCode).toBe('network');
      expect(event.userId).toBe('user-123');
      expect(event.eventId).toBe('event-123');
      expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
      expect(event.ip).toBe('127.0.0.1');
      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.deviceId).toBe('device-123');
      expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
      expect(event.riskScore).toBe(50);
      expect(event.correlationId).toBe('trace-123');
    });

    it('маппит revoke error без userId (выполняется после reset)', () => {
      const error = createAuthError('token_expired');
      const context = createBaseContext({
        userId: undefined,
      });

      const event = mapRevokeErrorToAuditEvent(error, context);

      expect(event.type).toBe('revoke_error');
      expect(event.errorCode).toBe('token_expired');
      expect(event.userId).toBeUndefined();
      expect(event.eventId).toBe('event-123');
    });

    it('маппит revoke error с разными типами ошибок', () => {
      const errorTypes: AuthError['kind'][] = [
        'network',
        'invalid_credentials',
        'account_locked',
        'token_expired',
        'rate_limited',
        'token_invalid',
        'session_expired',
      ];

      errorTypes.forEach((errorKind) => {
        const error = createAuthError(errorKind);
        const context = createBaseContext();

        const event = mapRevokeErrorToAuditEvent(error, context);

        expect(event.type).toBe('revoke_error');
        expect(event.errorCode).toBe(errorKind);
      });
    });

    it('маппит revoke error с минимальным контекстом', () => {
      const error = createAuthError('network');
      const context: LogoutAuditContext = {
        timestamp: '2026-01-01T00:00:00.000Z',
        eventId: 'event-revoke',
        traceId: undefined,
        userId: undefined,
        ip: undefined,
        userAgent: undefined,
        deviceId: undefined,
        geo: undefined,
        riskScore: undefined,
      };

      const event = mapRevokeErrorToAuditEvent(error, context);

      expect(event.type).toBe('revoke_error');
      expect(event.errorCode).toBe('network');
      expect(event.userId).toBeUndefined();
      expect(event.eventId).toBe('event-revoke');
      expect(event.ip).toBeUndefined();
      expect(event.userAgent).toBeUndefined();
      expect(event.deviceId).toBeUndefined();
      expect(event.geo).toBeUndefined();
      expect(event.riskScore).toBeUndefined();
      expect(event.correlationId).toBeUndefined();
    });

    it('правильно маппит все поля контекста в revoke_error audit event', () => {
      const error = createAuthError('rate_limited');
      const context: LogoutAuditContext = {
        timestamp: '2026-12-31T23:59:59.999Z',
        eventId: 'event-revoke-full',
        traceId: 'trace-revoke',
        userId: 'user-revoke',
        ip: '10.0.0.1',
        userAgent: 'Revoke Agent',
        deviceId: 'device-revoke',
        geo: { lat: -90, lng: -180 },
        riskScore: 1,
      };

      const event = mapRevokeErrorToAuditEvent(error, context);

      expect(event.type).toBe('revoke_error');
      expect(event.errorCode).toBe('rate_limited');
      expect(event.eventId).toBe('event-revoke-full');
      expect(event.timestamp).toBe('2026-12-31T23:59:59.999Z');
      expect(event.correlationId).toBe('trace-revoke');
      expect(event.userId).toBe('user-revoke');
      expect(event.ip).toBe('10.0.0.1');
      expect(event.userAgent).toBe('Revoke Agent');
      expect(event.deviceId).toBe('device-revoke');
      expect(event.geo).toEqual({ lat: -90, lng: -180 });
      expect(event.riskScore).toBe(1);
    });
  });

  describe('schema validation', () => {
    it('валидирует успешный audit event через auditEventSchema', () => {
      const result: LogoutResultForAudit = {
        type: 'success',
      };

      const context = createBaseContext();

      const event = mapLogoutResultToAuditEvent(result, context);

      // Проверяем, что событие соответствует схеме (не выбрасывается исключение)
      expect(event).toBeDefined();
      expect(event.type).toBe('logout_success');
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBeGreaterThan(0);
      expect(typeof event.timestamp).toBe('string');
    });

    it('валидирует error audit event через auditEventSchema', () => {
      const result: LogoutResultForAudit = {
        type: 'error',
        error: createAuthError('network'),
      };

      const context = createBaseContext();

      const event = mapLogoutResultToAuditEvent(result, context);

      // Проверяем, что событие соответствует схеме
      expect(event).toBeDefined();
      expect(event.type).toBe('logout_failure');
      expect(event.errorCode).toBe('network');
    });

    it('валидирует revoke_error audit event через auditEventSchema', () => {
      const error = createAuthError('token_expired');
      const context = createBaseContext();

      const event = mapRevokeErrorToAuditEvent(error, context);

      // Проверяем, что событие соответствует схеме
      expect(event).toBeDefined();
      expect(event.type).toBe('revoke_error');
      expect(event.errorCode).toBe('token_expired');
    });
  });

  describe('mapRevokeSkippedToAuditEvent', () => {
    it('маппит revoke skipped в revoke_skipped_due_to_limit audit event с userId', () => {
      const context = createBaseContext({
        userId: 'user-123',
      });

      const event = mapRevokeSkippedToAuditEvent(context);

      expect(event.type).toBe('revoke_skipped_due_to_limit');
      expect(event.userId).toBe('user-123');
      expect(event.eventId).toBe('event-123');
      expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
      expect(event.ip).toBe('127.0.0.1');
      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.deviceId).toBe('device-123');
      expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
      expect(event.riskScore).toBe(50);
      expect(event.correlationId).toBe('trace-123');
    });

    it('маппит revoke skipped без userId (выполняется после reset)', () => {
      const context = createBaseContext({
        userId: undefined,
      });

      const event = mapRevokeSkippedToAuditEvent(context);

      expect(event.type).toBe('revoke_skipped_due_to_limit');
      expect(event.userId).toBeUndefined();
      expect(event.eventId).toBe('event-123');
    });

    it('маппит revoke skipped с минимальным контекстом', () => {
      const context: LogoutAuditContext = {
        timestamp: '2026-01-01T00:00:00.000Z',
        eventId: 'event-skipped',
        traceId: undefined,
        userId: undefined,
        ip: undefined,
        userAgent: undefined,
        deviceId: undefined,
        geo: undefined,
        riskScore: undefined,
      };

      const event = mapRevokeSkippedToAuditEvent(context);

      expect(event.type).toBe('revoke_skipped_due_to_limit');
      expect(event.userId).toBeUndefined();
      expect(event.eventId).toBe('event-skipped');
      expect(event.ip).toBeUndefined();
      expect(event.userAgent).toBeUndefined();
      expect(event.deviceId).toBeUndefined();
      expect(event.geo).toBeUndefined();
      expect(event.riskScore).toBeUndefined();
      expect(event.correlationId).toBeUndefined();
    });

    it('правильно маппит все поля контекста в revoke_skipped_due_to_limit audit event', () => {
      const context: LogoutAuditContext = {
        timestamp: '2026-12-31T23:59:59.999Z',
        eventId: 'event-skipped-full',
        traceId: 'trace-skipped',
        userId: 'user-skipped',
        ip: '10.0.0.1',
        userAgent: 'Skipped Agent',
        deviceId: 'device-skipped',
        geo: { lat: -90, lng: -180 },
        riskScore: 1,
      };

      const event = mapRevokeSkippedToAuditEvent(context);

      expect(event.type).toBe('revoke_skipped_due_to_limit');
      expect(event.eventId).toBe('event-skipped-full');
      expect(event.timestamp).toBe('2026-12-31T23:59:59.999Z');
      expect(event.correlationId).toBe('trace-skipped');
      expect(event.userId).toBe('user-skipped');
      expect(event.ip).toBe('10.0.0.1');
      expect(event.userAgent).toBe('Skipped Agent');
      expect(event.deviceId).toBe('device-skipped');
      expect(event.geo).toEqual({ lat: -90, lng: -180 });
      expect(event.riskScore).toBe(1);
    });

    it('валидирует revoke_skipped_due_to_limit audit event через auditEventSchema', () => {
      const context = createBaseContext();

      const event = mapRevokeSkippedToAuditEvent(context);

      // Проверяем, что событие соответствует схеме
      expect(event).toBeDefined();
      expect(event.type).toBe('revoke_skipped_due_to_limit');
    });
  });
});

/* eslint-enable @livai/rag/context-leakage, functional/no-conditional-statements */
