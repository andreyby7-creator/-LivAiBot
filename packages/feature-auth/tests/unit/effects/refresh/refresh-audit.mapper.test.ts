/**
 * @file Unit тесты для effects/refresh/refresh-audit.mapper.ts
 * Цель: 100% покрытие runtime-части (createRefreshAuditContext + mapRefreshResultToAuditEvent, все ветви).
 */

import { describe, expect, it } from 'vitest';

import {
  createRefreshAuditContext,
  mapRefreshResultToAuditEvent,
} from '../../../../src/effects/refresh/refresh-audit.mapper.js';
import type {
  ClockPort,
  EventIdGeneratorPort,
  RefreshResult,
} from '../../../../src/effects/refresh/refresh-effect.types.js';
import type { AuditEventValues } from '../../../../src/schemas/index.js';
import type { AuthError, SessionState } from '../../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

function createClock(nowMs: number): ClockPort {
  return {
    now: () => nowMs,
  };
}

function createEventIdGenerator(eventId: string): EventIdGeneratorPort {
  return {
    generate: () => eventId,
  };
}

function createActiveSessionState(
  overrides: Partial<Extract<SessionState, { status: 'active'; }>> = {},
): SessionState {
  return {
    status: 'active',
    sessionId: 'session-123',
    device: {
      deviceId: 'device-123',
      deviceType: 'desktop',
      ip: '127.0.0.1',
      geo: {
        lat: 55.7558,
        lng: 37.6173,
      },
    },
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
    ...overrides,
  };
}

function createNonActiveSessionState(): SessionState {
  return {
    status: 'revoked',
    sessionId: 'session-expired-1',
    reason: 'expired',
    revokedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createBaseContext(): {
  eventId: string;
  timestamp: string;
  sessionId: string;
  deviceId: string;
  ip: string;
  geo: AuditEventValues['geo'];
} {
  return {
    eventId: 'event-123',
    timestamp: '2026-01-01T00:00:00.000Z',
    sessionId: 'session-123',
    deviceId: 'device-123',
    ip: '127.0.0.1',
    geo: { lat: 55.7558, lng: 37.6173 },
  };
}

// ============================================================================
// 🧪 TESTS — createRefreshAuditContext
// ============================================================================

describe('effects/refresh/refresh-audit.mapper', () => {
  describe('createRefreshAuditContext', () => {
    it('строит контекст для активной сессии с device info', () => {
      const sessionState = createActiveSessionState();
      const clock = createClock(1_736_568_000_000); // 2025-10-01T00:00:00.000Z
      const eventIdGenerator = createEventIdGenerator('event-123');

      const context = createRefreshAuditContext(
        sessionState,
        clock,
        eventIdGenerator,
      );

      expect(context.eventId).toBe('event-123');
      expect(context.timestamp).toBe(new Date(1_736_568_000_000).toISOString());
      expect(context.sessionId).toBe('session-123');
      expect(context.deviceId).toBe('device-123');
      expect(context.ip).toBe('127.0.0.1');
      expect(context.geo).toEqual({
        lat: 55.7558,
        lng: 37.6173,
      });
    });

    it('не добавляет device поля для неактивной сессии (status !== active)', () => {
      const sessionState = createNonActiveSessionState();
      const clock = createClock(1_736_568_000_000);
      const eventIdGenerator = createEventIdGenerator('event-456');

      const context = createRefreshAuditContext(
        sessionState,
        clock,
        eventIdGenerator,
      );

      expect(context.eventId).toBe('event-456');
      expect(context.sessionId).toBe('session-expired-1');
      expect(context.deviceId).toBeUndefined();
      expect(context.ip).toBeUndefined();
      expect(context.geo).toBeUndefined();
    });

    it('не добавляет geo если device.geo отсутствует', () => {
      const sessionState = createActiveSessionState({
        device: {
          deviceId: 'device-no-geo',
          ip: '10.0.0.1',
        },
      } as Extract<SessionState, { status: 'active'; }>);
      const clock = createClock(1_736_568_000_000);
      const eventIdGenerator = createEventIdGenerator('event-no-geo');

      const context = createRefreshAuditContext(
        sessionState,
        clock,
        eventIdGenerator,
      );

      expect(context.deviceId).toBe('device-no-geo');
      expect(context.ip).toBe('10.0.0.1');
      expect(context.geo).toBeUndefined();
    });
  });

  // ============================================================================
  // 🧪 TESTS — mapRefreshResultToAuditEvent
  // ============================================================================

  describe('mapRefreshResultToAuditEvent', () => {
    const baseContext = createBaseContext();

    it('возвращает null для noop результата (audit не пишется)', () => {
      const result: RefreshResult = {
        type: 'noop',
        reason: 'already_fresh',
      };

      const event = mapRefreshResultToAuditEvent(
        result,
        baseContext,
      );

      expect(event).toBeNull();
    });

    it('маппит success результат в token_refresh audit event с userId', () => {
      const result: RefreshResult = {
        type: 'success',
        userId: 'user-123',
      };

      const event = mapRefreshResultToAuditEvent(
        result,
        baseContext,
      );

      expect(event).not.toBeNull();
      const nonNullEvent = event as AuditEventValues;

      expect(nonNullEvent.type).toBe('token_refresh');
      expect(nonNullEvent.userId).toBe('user-123');
      expect(nonNullEvent.eventId).toBe(baseContext.eventId);
      expect(nonNullEvent.timestamp).toBe(baseContext.timestamp);
      expect(nonNullEvent.sessionId).toBe(baseContext.sessionId);
      expect(nonNullEvent.deviceId).toBe(baseContext.deviceId);
      expect(nonNullEvent.ip).toBe(baseContext.ip);
      expect(nonNullEvent.geo).toEqual(baseContext.geo);
      expect(Object.isFrozen(nonNullEvent)).toBe(true);
    });

    it('маппит error результат в token_refresh audit event с errorCode и context.errorCode', () => {
      const error: AuthError = {
        kind: 'network',
        message: 'Network error',
        retryable: true,
      };
      const result: RefreshResult = {
        type: 'error',
        error,
      };

      const event = mapRefreshResultToAuditEvent(
        result,
        baseContext,
      );

      expect(event).not.toBeNull();
      const nonNullEvent = event as AuditEventValues;

      expect(nonNullEvent.type).toBe('token_refresh');
      expect(nonNullEvent.errorCode).toBe('network');
      expect(nonNullEvent.context).toEqual({
        errorCode: 'network',
      });
    });

    it('маппит invalidated результат в session_revoked audit event с context.reason', () => {
      const result: RefreshResult = {
        type: 'invalidated',
        reason: 'expired',
      };

      const event = mapRefreshResultToAuditEvent(
        result,
        baseContext,
      );

      expect(event).not.toBeNull();
      const nonNullEvent = event as AuditEventValues;

      expect(nonNullEvent.type).toBe('session_revoked');
      expect(nonNullEvent.context).toEqual({
        reason: 'expired',
      });
      // errorCode и userId в этом варианте не задаются
      expect(nonNullEvent.errorCode).toBeUndefined();
      expect(nonNullEvent.userId).toBeUndefined();
    });

    it('использует userId из контекста если он задан (для non-success результата)', () => {
      const contextWithUser = {
        ...createBaseContext(),
        userId: 'user-from-context',
      };

      const result: RefreshResult = {
        type: 'invalidated',
        reason: 'security_policy',
      };

      const event = mapRefreshResultToAuditEvent(
        result,
        contextWithUser,
      );

      expect(event).not.toBeNull();
      const nonNullEvent = event as AuditEventValues;

      expect(nonNullEvent.type).toBe('session_revoked');
      expect(nonNullEvent.userId).toBe('user-from-context');
      expect(nonNullEvent.context).toEqual({
        reason: 'security_policy',
      });
    });

    it('не добавляет sessionId/deviceId/ip/geo если они отсутствуют в контексте', () => {
      const minimalContext = {
        eventId: 'event-minimal',
        timestamp: '2026-01-01T00:00:00.000Z',
      } as const;

      const result: RefreshResult = {
        type: 'error',
        error: {
          kind: 'token_expired',
          message: 'Token expired',
        } as AuthError,
      };

      const event = mapRefreshResultToAuditEvent(
        result,
        minimalContext,
      );

      expect(event).not.toBeNull();
      const nonNullEvent = event as AuditEventValues;

      expect(nonNullEvent.eventId).toBe('event-minimal');
      expect(nonNullEvent.timestamp).toBe('2026-01-01T00:00:00.000Z');
      expect(nonNullEvent.sessionId).toBeUndefined();
      expect(nonNullEvent.deviceId).toBeUndefined();
      expect(nonNullEvent.ip).toBeUndefined();
      expect(nonNullEvent.geo).toBeUndefined();
      expect(nonNullEvent.type).toBe('token_refresh');
      expect(nonNullEvent.errorCode).toBe('token_expired');
    });
  });
});
