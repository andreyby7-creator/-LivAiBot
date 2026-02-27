/**
 * @file Unit тесты для effects/login/login-audit.mapper.ts
 * Полное покрытие mapper-функций для audit-событий login-flow.
 */

/* eslint-disable @livai/rag/context-leakage, functional/no-conditional-statements */

import { describe, expect, it } from 'vitest';

import { mapLoginResultToAuditEvent } from '../../../../src/effects/login/login-audit.mapper.js';
import type {
  LoginAuditContext,
  LoginResultForAudit,
} from '../../../../src/effects/login/login-audit.mapper.js';
import type { DomainLoginResult } from '../../../../src/domain/LoginResult.js';
import type { MeResponse } from '../../../../src/domain/MeResponse.js';
import type { MfaChallengeRequest } from '../../../../src/domain/MfaChallengeRequest.js';
import type { TokenPair } from '../../../../src/domain/TokenPair.js';
import type { AuthError } from '../../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

const createBaseContext = (
  overrides: Partial<LoginAuditContext> = {},
): LoginAuditContext => ({
  domainResult: undefined,
  timestamp: '2026-01-01T00:00:00.000Z',
  traceId: 'trace-123',
  eventId: 'event-123',
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  deviceId: 'device-123',
  geo: { lat: 55.7558, lng: 37.6173 },
  riskScore: 50,
  blockReason: undefined,
  ...overrides,
});

const createSuccessDomainResult = (): DomainLoginResult => ({
  type: 'success',
  tokenPair: {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: '2026-12-31T23:59:59.000Z',
  } as TokenPair,
  me: {
    user: {
      id: 'user-123',
      email: 'user@example.com',
    },
    roles: ['user'],
    permissions: ['profile.read'],
    session: {
      sessionId: 'session-123',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    },
  } as MeResponse,
});

const createMfaDomainResult = (): DomainLoginResult => ({
  type: 'mfa_required',
  challenge: {
    userId: 'user-456',
    type: 'totp',
    deviceId: 'device-456',
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    timestamp: '2026-01-01T00:00:00.000Z',
  } as MfaChallengeRequest,
});

// ============================================================================
// 📋 TESTS
// ============================================================================

describe('effects/login/login-audit.mapper', () => {
  describe('mapLoginResultToAuditEvent', () => {
    describe('success case', () => {
      it('маппит success результат в login_success audit event', () => {
        const result: LoginResultForAudit = {
          type: 'success',
          userId: 'user-123',
        };

        const context = createBaseContext({
          domainResult: createSuccessDomainResult(),
        });

        const event = mapLoginResultToAuditEvent(result, context);

        expect(event.type).toBe('login_success');
        expect(event.userId).toBe('user-123');
        expect(event.sessionId).toBe('session-123');
        expect(event.eventId).toBe('event-123');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
        expect(event.ip).toBe('127.0.0.1');
        expect(event.userAgent).toBe('Mozilla/5.0');
        expect(event.deviceId).toBe('device-123');
        expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
        expect(event.riskScore).toBe(50);
        expect(event.correlationId).toBe('trace-123');
      });

      it('выбрасывает ошибку если sessionId отсутствует (fail-closed)', () => {
        const result: LoginResultForAudit = {
          type: 'success',
          userId: 'user-123',
        };

        const context = createBaseContext({
          domainResult: {
            type: 'success',
            tokenPair: {
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresAt: '2026-12-31T23:59:59.000Z',
            } as TokenPair,
            me: {
              user: { id: 'user-123' },
              roles: [],
              permissions: [],
              // session отсутствует
            } as MeResponse,
          },
        });

        expect(() => mapLoginResultToAuditEvent(result, context)).toThrow(
          '[login-audit.mapper] login_success audit requires sessionId (orchestrator contract violation)',
        );
      });

      it('выбрасывает ошибку если domainResult отсутствует (fail-closed)', () => {
        const result: LoginResultForAudit = {
          type: 'success',
          userId: 'user-123',
        };

        const context = createBaseContext({
          domainResult: undefined,
        });

        expect(() => mapLoginResultToAuditEvent(result, context)).toThrow(
          '[login-audit.mapper] login_success audit requires sessionId (orchestrator contract violation)',
        );
      });

      it('выбрасывает ошибку если domainResult не success (fail-closed)', () => {
        const result: LoginResultForAudit = {
          type: 'success',
          userId: 'user-123',
        };

        const context = createBaseContext({
          domainResult: createMfaDomainResult(),
        });

        expect(() => mapLoginResultToAuditEvent(result, context)).toThrow(
          '[login-audit.mapper] login_success audit requires sessionId (orchestrator contract violation)',
        );
      });
    });

    describe('mfa_required case', () => {
      it('маппит mfa_required результат в mfa_challenge audit event', () => {
        const result: LoginResultForAudit = {
          type: 'mfa_required',
          challengeId: 'challenge-123',
        };

        const context = createBaseContext({
          domainResult: createMfaDomainResult(),
        });

        const event = mapLoginResultToAuditEvent(result, context);

        expect(event.type).toBe('mfa_challenge');
        expect(event.userId).toBe('user-456');
        expect(event.context).toEqual({
          challengeId: 'challenge-123',
        });
        expect(event.eventId).toBe('event-123');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
        expect(event.ip).toBe('127.0.0.1');
        expect(event.userAgent).toBe('Mozilla/5.0');
        expect(event.deviceId).toBe('device-123');
        expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
        expect(event.riskScore).toBe(50);
        expect(event.correlationId).toBe('trace-123');
      });

      it('выбрасывает ошибку если userId отсутствует (fail-closed)', () => {
        const result: LoginResultForAudit = {
          type: 'mfa_required',
          challengeId: 'challenge-123',
        };

        const context = createBaseContext({
          domainResult: undefined,
        });

        expect(() => mapLoginResultToAuditEvent(result, context)).toThrow(
          '[login-audit.mapper] mfa_challenge audit requires userId (orchestrator contract violation: MFA always comes after backend)',
        );
      });

      it('выбрасывает ошибку если domainResult не mfa_required (fail-closed)', () => {
        const result: LoginResultForAudit = {
          type: 'mfa_required',
          challengeId: 'challenge-123',
        };

        const context = createBaseContext({
          domainResult: createSuccessDomainResult(),
        });

        expect(() => mapLoginResultToAuditEvent(result, context)).toThrow(
          '[login-audit.mapper] mfa_challenge audit requires userId (orchestrator contract violation: MFA always comes after backend)',
        );
      });
    });

    describe('blocked case', () => {
      it('маппит blocked результат в policy_violation audit event с blockReason', () => {
        const result: LoginResultForAudit = {
          type: 'blocked',
          reason: 'High risk score detected',
        };

        const context = createBaseContext({
          blockReason: 'policy-high-risk',
        });

        const event = mapLoginResultToAuditEvent(result, context);

        expect(event.type).toBe('policy_violation');
        expect(event.policyId).toBe('policy-high-risk');
        expect(event.context).toEqual({
          reason: 'High risk score detected',
          blockReason: 'policy-high-risk',
        });
        expect(event.eventId).toBe('event-123');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
        expect(event.ip).toBe('127.0.0.1');
        expect(event.userAgent).toBe('Mozilla/5.0');
        expect(event.deviceId).toBe('device-123');
        expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
        expect(event.riskScore).toBe(50);
        expect(event.correlationId).toBe('trace-123');
      });

      it('маппит blocked результат в policy_violation audit event без blockReason (опционально)', () => {
        const result: LoginResultForAudit = {
          type: 'blocked',
          reason: 'Account locked',
        };

        const context = createBaseContext({
          blockReason: undefined,
        });

        const event = mapLoginResultToAuditEvent(result, context);

        expect(event.type).toBe('policy_violation');
        expect(event.policyId).toBeUndefined();
        expect(event.context).toEqual({
          reason: 'Account locked',
        });
      });
    });

    describe('error case', () => {
      it('маппит error результат в login_failure audit event', () => {
        const result: LoginResultForAudit = {
          type: 'error',
          error: {
            kind: 'invalid_credentials',
            message: 'Invalid email or password',
            retryable: false,
          } as AuthError,
        };

        const context = createBaseContext();

        const event = mapLoginResultToAuditEvent(result, context);

        expect(event.type).toBe('login_failure');
        expect(event.errorCode).toBe('invalid_credentials');
        expect(event.eventId).toBe('event-123');
        expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
        expect(event.ip).toBe('127.0.0.1');
        expect(event.userAgent).toBe('Mozilla/5.0');
        expect(event.deviceId).toBe('device-123');
        expect(event.geo).toEqual({ lat: 55.7558, lng: 37.6173 });
        expect(event.riskScore).toBe(50);
        expect(event.correlationId).toBe('trace-123');
      });

      it('маппит различные типы ошибок корректно', () => {
        const errorKinds: AuthError['kind'][] = [
          'network',
          'invalid_credentials',
          'account_locked',
          'rate_limited',
          'unknown',
        ];

        errorKinds.forEach((kind) => {
          const result: LoginResultForAudit = {
            type: 'error',
            error: (() => {
              if (kind === 'network') {
                return {
                  kind: 'network',
                  retryable: true,
                  message: `Error: ${kind}`,
                } as AuthError;
              }
              if (kind === 'rate_limited') {
                return {
                  kind: 'rate_limited',
                  message: `Error: ${kind}`,
                } as AuthError;
              }
              if (kind === 'unknown') {
                return {
                  kind: 'unknown',
                  message: `Error: ${kind}`,
                  raw: {
                    error: 'unknown_error',
                    message: 'Unknown error',
                  } as AuthError['raw'],
                } as AuthError;
              }
              return {
                kind,
                message: `Error: ${kind}`,
              } as AuthError;
            })(),
          };

          const context = createBaseContext();

          const event = mapLoginResultToAuditEvent(result, context);

          expect(event.type).toBe('login_failure');
          expect(event.errorCode).toBe(kind);
        });
      });
    });

    describe('base event fields', () => {
      it('всегда включает базовые поля во всех типах событий', () => {
        const baseFields = {
          eventId: 'event-base',
          timestamp: '2026-02-01T00:00:00.000Z',
          traceId: 'trace-base',
          ip: '192.168.1.1',
          userAgent: 'Chrome/120.0',
          deviceId: 'device-base',
          geo: { lat: 0, lng: 0 },
          riskScore: 75,
        };

        const context = createBaseContext(baseFields);

        const successResult: LoginResultForAudit = {
          type: 'success',
          userId: 'user-base',
        };
        const successContext = createBaseContext({
          ...baseFields,
          domainResult: createSuccessDomainResult(),
        });
        const successEvent = mapLoginResultToAuditEvent(successResult, successContext);
        expect(successEvent.eventId).toBe('event-base');
        expect(successEvent.timestamp).toBe('2026-02-01T00:00:00.000Z');
        expect(successEvent.correlationId).toBe('trace-base');
        expect(successEvent.ip).toBe('192.168.1.1');
        expect(successEvent.userAgent).toBe('Chrome/120.0');
        expect(successEvent.deviceId).toBe('device-base');
        expect(successEvent.geo).toEqual({ lat: 0, lng: 0 });
        expect(successEvent.riskScore).toBe(75);

        const errorResult: LoginResultForAudit = {
          type: 'error',
          error: {
            kind: 'network',
            message: 'Network error',
            retryable: true,
          } as AuthError,
        };
        const errorEvent = mapLoginResultToAuditEvent(errorResult, context);
        expect(errorEvent.eventId).toBe('event-base');
        expect(errorEvent.timestamp).toBe('2026-02-01T00:00:00.000Z');
        expect(errorEvent.correlationId).toBe('trace-base');
        expect(errorEvent.ip).toBe('192.168.1.1');
        expect(errorEvent.userAgent).toBe('Chrome/120.0');
        expect(errorEvent.deviceId).toBe('device-base');
        expect(errorEvent.geo).toEqual({ lat: 0, lng: 0 });
        expect(errorEvent.riskScore).toBe(75);
      });

      it('обрабатывает опциональные поля корректно', () => {
        const context = createBaseContext({
          ip: undefined,
          userAgent: undefined,
          deviceId: undefined,
          geo: undefined,
          riskScore: undefined,
          traceId: undefined,
        });

        const result: LoginResultForAudit = {
          type: 'error',
          error: {
            kind: 'unknown',
            message: 'Unknown error',
            raw: {
              error: 'unknown_error',
              message: 'Unknown error',
            } as AuthError['raw'],
          } as AuthError,
        };

        const event = mapLoginResultToAuditEvent(result, context);

        expect(event.ip).toBeUndefined();
        expect(event.userAgent).toBeUndefined();
        expect(event.deviceId).toBeUndefined();
        expect(event.geo).toBeUndefined();
        expect(event.riskScore).toBeUndefined();
        expect(event.correlationId).toBeUndefined();
      });
    });

    describe('exhaustiveness check', () => {
      it('выбрасывает ошибку для неподдерживаемого типа результата', () => {
        const invalidResult = {
          type: 'unknown_type',
        } as unknown as LoginResultForAudit;

        const context = createBaseContext();

        expect(() => mapLoginResultToAuditEvent(invalidResult, context)).toThrow(
          /Unsupported LoginResult type/,
        );
      });
    });

    describe('schema validation', () => {
      it('валидирует все события через auditEventSchema', () => {
        const results: LoginResultForAudit[] = [
          {
            type: 'success',
            userId: 'user-123',
          },
          {
            type: 'mfa_required',
            challengeId: 'challenge-123',
          },
          {
            type: 'blocked',
            reason: 'Blocked',
          },
          {
            type: 'error',
            error: {
              kind: 'network',
              message: 'Network error',
              retryable: true,
            } as AuthError,
          },
        ];

        results.forEach((result, index) => {
          const context = createBaseContext({
            domainResult: index === 0
              ? createSuccessDomainResult()
              : index === 1
              ? createMfaDomainResult()
              : undefined,
          });

          // Если событие прошло mapLoginResultToAuditEvent, значит оно валидно
          const event = mapLoginResultToAuditEvent(result, context);
          expect(event).toBeDefined();
          expect(event.type).toBeDefined();
          expect(event.eventId).toBe('event-123');
        });
      });
    });
  });
});
/* eslint-enable @livai/rag/context-leakage, functional/no-conditional-statements */
