/**
 * @file Unit тесты для lib/session-manager.ts
 * Полное покрытие SessionManager с тестированием всех функций и edge cases
 */

import { describe, expect, it } from 'vitest';

import type { AuthPolicyConfig } from '@livai/core';
import type { UnixTimestampMs } from '@livai/core-contracts';

import type { SessionPolicy } from '../../../src/domain/SessionPolicy.js';
import { SessionManager } from '../../../src/lib/session-manager.js';
import type { SessionState } from '../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

/** Создает AuthPolicyConfig для тестов */
function createAuthPolicy(overrides: Partial<AuthPolicyConfig> = {}): AuthPolicyConfig {
  return {
    accessTokenTtlMs: 900_000, // 15 minutes
    refreshTokenTtlMs: 7_200_000, // 2 hours
    sessionMaxLifetimeMs: 86_400_000, // 24 hours
    sessionIdleTimeoutMs: 3_600_000, // 1 hour
    requireRefreshRotation: true,
    maxRefreshRotations: 10,
    ...overrides,
  };
}

/** Создает SessionPolicy для тестов */
function createSessionPolicy(overrides: Partial<SessionPolicy> = {}): SessionPolicy {
  return {
    maxConcurrentSessions: 3,
    sessionTtlSeconds: 3600, // 1 hour
    idleTimeoutSeconds: 1800, // 30 minutes
    ...overrides,
  };
}

/** Создает активную сессию для тестов */
function createActiveSession(overrides: Partial<SessionState> = {}): SessionState {
  const now = Date.now();
  return {
    status: 'active',
    sessionId: 'session-123',
    issuedAt: new Date(now - 1000).toISOString(), // 1 second ago
    expiresAt: new Date(now + 3600_000).toISOString(), // 1 hour from now
    ...overrides,
  } as SessionState;
}

/** Создает истекшую сессию для тестов */
function createExpiredSession(overrides: Partial<SessionState> = {}): SessionState {
  const past = Date.now() - 3600_000; // 1 hour ago
  return {
    status: 'expired',
    sessionId: 'session-expired',
    issuedAt: new Date(past - 3600_000).toISOString(),
    expiresAt: new Date(past - 1000).toISOString(), // expired sessions still have expiresAt
    expiredAt: new Date(past).toISOString(),
    ...overrides,
  } as SessionState;
}

/** Создает отозванную сессию для тестов */
function createRevokedSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    status: 'revoked',
    sessionId: 'session-revoked',
    reason: 'user_logout' as const,
    revokedAt: new Date(Date.now() - 1000).toISOString(),
    ...overrides,
  } as SessionState;
}

/** Создает приостановленную сессию для тестов */
function createSuspendedSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    status: 'suspended',
    sessionId: 'session-suspended',
    reason: 'security_violation',
    suspendedUntil: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  } as SessionState;
}

// ============================================================================
// 🎯 TESTS - SessionManager (Main API)
// ============================================================================

describe('SessionManager', () => {
  describe('constructor', () => {
    it('создаёт экземпляр с валидной конфигурацией', () => {
      const authPolicy = createAuthPolicy();
      const sessionPolicy = createSessionPolicy();
      const config = {
        authPolicy,
        sessionPolicy,
        refreshProactiveWindowMs: 30_000,
      };

      expect(() => new SessionManager(config)).not.toThrow();
    });

    it('создаёт экземпляр без sessionPolicy', () => {
      const authPolicy = createAuthPolicy();
      const config = {
        authPolicy,
        refreshProactiveWindowMs: 30_000,
      };

      expect(() => new SessionManager(config)).not.toThrow();
    });

    it('создаёт экземпляр без refreshProactiveWindowMs (использует дефолт)', () => {
      const authPolicy = createAuthPolicy();
      const config = {
        authPolicy,
      };

      expect(() => new SessionManager(config)).not.toThrow();
    });

    it('бросает ошибку если refreshProactiveWindowMs < 0', () => {
      const authPolicy = createAuthPolicy();
      const config = {
        authPolicy,
        refreshProactiveWindowMs: -1,
      };

      expect(() => new SessionManager(config)).toThrow(
        '[SessionManager] refreshProactiveWindowMs must be >= 0, got -1',
      );
    });

    it('бросает ошибку если authPolicy.sessionMaxLifetimeMs <= 0', () => {
      const authPolicy = createAuthPolicy({ sessionMaxLifetimeMs: 0 });
      const config = {
        authPolicy,
      };

      expect(() => new SessionManager(config)).toThrow(
        '[SessionManager] authPolicy.sessionMaxLifetimeMs must be > 0, got 0',
      );
    });

    it('бросает ошибку если authPolicy.sessionMaxLifetimeMs < 0', () => {
      const authPolicy = createAuthPolicy({ sessionMaxLifetimeMs: -1000 });
      const config = {
        authPolicy,
      };

      expect(() => new SessionManager(config)).toThrow(
        '[SessionManager] authPolicy.sessionMaxLifetimeMs must be > 0, got -1000',
      );
    });
  });

  describe('isExpired', () => {
    const authPolicy = createAuthPolicy();
    const manager = new SessionManager({ authPolicy });

    it('возвращает true для null сессии', () => {
      const now: UnixTimestampMs = Date.now();
      expect(manager.isExpired(null, now)).toBe(true);
    });

    it('возвращает true для active сессии с истекшим expiresAt', () => {
      const past = Date.now() - 1000;
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(past - 3600_000).toISOString(),
        expiresAt: new Date(past).toISOString(), // истекла 1 секунду назад
      };

      expect(manager.isExpired(session, Date.now())).toBe(true);
    });

    it('возвращает false для active сессии с валидным expiresAt', () => {
      const now = Date.now();
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 1000).toISOString(),
        expiresAt: new Date(now + 3600_000).toISOString(), // истечёт через 1 час
      };

      expect(manager.isExpired(session, now)).toBe(false);
    });

    it('возвращает true для active сессии с невалидным expiresAt', () => {
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: 'invalid-date-string',
      };

      expect(manager.isExpired(session, Date.now())).toBe(true);
    });

    it('возвращает true для expired сессии', () => {
      const session = createExpiredSession();
      expect(manager.isExpired(session, Date.now())).toBe(true);
    });

    it('возвращает true для revoked сессии', () => {
      const session = createRevokedSession();
      expect(manager.isExpired(session, Date.now())).toBe(true);
    });

    it('возвращает true для suspended сессии', () => {
      const session = createSuspendedSession();
      expect(manager.isExpired(session, Date.now())).toBe(true);
    });
  });

  describe('shouldRefresh', () => {
    const authPolicy = createAuthPolicy();
    const manager = new SessionManager({ authPolicy, refreshProactiveWindowMs: 30_000 });

    it('возвращает false для null сессии', () => {
      const now: UnixTimestampMs = Date.now();
      expect(manager.shouldRefresh(null, now)).toBe(false);
    });

    it('возвращает false для не-active сессии', () => {
      const now = Date.now();
      const expiredSession = createExpiredSession();
      const revokedSession = createRevokedSession();
      const suspendedSession = createSuspendedSession();

      expect(manager.shouldRefresh(expiredSession, now)).toBe(false);
      expect(manager.shouldRefresh(revokedSession, now)).toBe(false);
      expect(manager.shouldRefresh(suspendedSession, now)).toBe(false);
    });

    it('возвращает true когда deadline достигнут', () => {
      // expiresAt = now + 10 сек, deadline = expiresAt - 30 сек = now - 20 сек
      // now >= deadline всегда true
      const now = Date.now();
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 3600_000).toISOString(),
        expiresAt: new Date(now + 10_000).toISOString(), // истечёт через 10 сек
      };

      expect(manager.shouldRefresh(session, now)).toBe(true);
    });

    it('возвращает false когда deadline не достигнут', () => {
      // expiresAt = now + 60 сек, deadline = expiresAt - 30 сек = now + 30 сек
      // now < deadline
      const now = Date.now();
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 3600_000).toISOString(),
        expiresAt: new Date(now + 60_000).toISOString(), // истечёт через 60 сек
      };

      expect(manager.shouldRefresh(session, now)).toBe(false);
    });

    it('возвращает false для сессии с невалидным expiresAt', () => {
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: 'invalid-date-string',
      };

      expect(manager.shouldRefresh(session, Date.now())).toBe(false);
    });
  });

  describe('getRefreshDeadline', () => {
    const authPolicy = createAuthPolicy();
    const manager = new SessionManager({ authPolicy, refreshProactiveWindowMs: 30_000 });

    it('возвращает 0 для null сессии', () => {
      expect(manager.getRefreshDeadline(null)).toBe(0);
    });

    it('возвращает 0 для не-active сессии', () => {
      const expiredSession = createExpiredSession();
      const revokedSession = createRevokedSession();
      const suspendedSession = createSuspendedSession();

      expect(manager.getRefreshDeadline(expiredSession)).toBe(0);
      expect(manager.getRefreshDeadline(revokedSession)).toBe(0);
      expect(manager.getRefreshDeadline(suspendedSession)).toBe(0);
    });

    it('вычисляет правильный deadline для active сессии', () => {
      const now = Date.now();
      const expiresAt = now + 60_000; // истечёт через 60 сек
      const expectedDeadline = expiresAt - 30_000; // deadline = expiresAt - proactiveWindow

      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 3600_000).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
      };

      expect(manager.getRefreshDeadline(session)).toBe(expectedDeadline);
    });

    it('защищает от отрицательных timestamp значений deadline', () => {
      // Если expiresAt очень близко к началу эпохи, deadline может быть отрицательным
      // Math.max(0, deadline) защищает от возврата отрицательных timestamp'ов
      const authPolicy = createAuthPolicy();
      const managerShort = new SessionManager({ authPolicy, refreshProactiveWindowMs: 1000 }); // 1 сек

      // expiresAt = 500 мс (очень рано), deadline = 500 - 1000 = -500
      // Math.max(0, -500) = 0
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(1000).toISOString(), // 1 сек после начала эпохи
        expiresAt: new Date(500).toISOString(), // 500 мс после начала эпохи
      };

      expect(managerShort.getRefreshDeadline(session)).toBe(0);
    });

    it('возвращает 0 для сессии с невалидным expiresAt', () => {
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: 'invalid-date-string',
      };

      expect(manager.getRefreshDeadline(session)).toBe(0);
    });
  });

  describe('shouldInvalidate', () => {
    const authPolicy = createAuthPolicy();
    const manager = new SessionManager({ authPolicy });

    it('возвращает true для null сессии', () => {
      const now: UnixTimestampMs = Date.now();
      expect(manager.shouldInvalidate(null, now)).toBe(true);
    });

    it('возвращает false для не-active сессии', () => {
      const now = Date.now();
      const expiredSession = createExpiredSession();
      const revokedSession = createRevokedSession();
      const suspendedSession = createSuspendedSession();

      expect(manager.shouldInvalidate(expiredSession, now)).toBe(false);
      expect(manager.shouldInvalidate(revokedSession, now)).toBe(false);
      expect(manager.shouldInvalidate(suspendedSession, now)).toBe(false);
    });

    it('возвращает true если сессия истекла по expiresAt', () => {
      const past = Date.now() - 1000;
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(past - 3600_000).toISOString(),
        expiresAt: new Date(past).toISOString(), // истекла
      };

      expect(manager.shouldInvalidate(session, Date.now())).toBe(true);
    });

    it('возвращает true если превышен sessionMaxLifetimeMs', () => {
      const authPolicyShort = createAuthPolicy({ sessionMaxLifetimeMs: 1000 }); // 1 сек
      const managerShort = new SessionManager({ authPolicy: authPolicyShort });

      const now = Date.now();
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 2000).toISOString(), // выдана 2 сек назад
        expiresAt: new Date(now + 3600_000).toISOString(), // не истекла
      };

      expect(managerShort.shouldInvalidate(session, now)).toBe(true);
    });

    it('возвращает true при clock skew (issuedAt в будущем)', () => {
      const now = Date.now();
      const future = now + 1000;
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(future).toISOString(), // issuedAt в будущем
        expiresAt: new Date(now + 3600_000).toISOString(),
      };

      expect(manager.shouldInvalidate(session, now)).toBe(true);
    });

    it('возвращает true при невалидном issuedAt', () => {
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: 'invalid-date-string',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };

      expect(manager.shouldInvalidate(session, Date.now())).toBe(true);
    });

    it('возвращает true при невалидном expiresAt', () => {
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: 'invalid-date-string',
      };

      expect(manager.shouldInvalidate(session, Date.now())).toBe(true);
    });

    it('учитывает SessionPolicy.sessionTtlSeconds', () => {
      const authPolicy = createAuthPolicy();
      const sessionPolicy = createSessionPolicy({ sessionTtlSeconds: 30 }); // 30 сек
      const managerWithPolicy = new SessionManager({ authPolicy, sessionPolicy });

      const now = Date.now();
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 60_000).toISOString(), // выдана 60 сек назад > 30 сек TTL
        expiresAt: new Date(now + 3600_000).toISOString(),
      };

      expect(managerWithPolicy.shouldInvalidate(session, now)).toBe(true);
    });

    it('учитывает SessionPolicy.sessionTtlSeconds - сессия валидна по TTL', () => {
      const authPolicy = createAuthPolicy();
      const sessionPolicy = createSessionPolicy({ sessionTtlSeconds: 120 }); // 2 мин
      const managerWithPolicy = new SessionManager({ authPolicy, sessionPolicy });

      const now = Date.now();
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 60_000).toISOString(), // выдана 60 сек назад < 120 сек TTL
        expiresAt: new Date(now + 3600_000).toISOString(),
      };

      // Сессия не должна инвалидироваться по TTL (sessionAgeMs <= maxLifetimeMs)
      // Другие проверки должны также пройти
      expect(managerWithPolicy.shouldInvalidate(session, now)).toBe(false);
    });

    it('возвращает false для валидной active сессии', () => {
      const now = Date.now();
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: new Date(now - 1000).toISOString(), // выдана 1 сек назад
        expiresAt: new Date(now + 3600_000).toISOString(), // истечёт через 1 час
      };

      expect(manager.shouldInvalidate(session, now)).toBe(false);
    });
  });

  describe('canOpenNewSession', () => {
    const authPolicy = createAuthPolicy();

    it('возвращает true без sessionPolicy', () => {
      const manager = new SessionManager({ authPolicy });
      const sessions: readonly SessionState[] = [];

      expect(manager.canOpenNewSession(sessions, Date.now())).toBe(true);
    });

    it('возвращает true если maxConcurrentSessions не задан', () => {
      const sessionPolicy = createSessionPolicy();
      // Remove maxConcurrentSessions from the policy
      const { maxConcurrentSessions: _, ...policyWithoutLimit } = sessionPolicy;
      const manager = new SessionManager({ authPolicy, sessionPolicy: policyWithoutLimit });
      const sessions: readonly SessionState[] = [];

      expect(manager.canOpenNewSession(sessions, Date.now())).toBe(true);
    });

    it('возвращает true если количество active сессий меньше лимита', () => {
      const sessionPolicy = createSessionPolicy({ maxConcurrentSessions: 3 });
      const manager = new SessionManager({ authPolicy, sessionPolicy });

      const sessions: readonly SessionState[] = [
        createActiveSession({ sessionId: 'session-1' }),
        createActiveSession({ sessionId: 'session-2' }),
      ];

      expect(manager.canOpenNewSession(sessions, Date.now())).toBe(true);
    });

    it('возвращает false если количество active сессий равно лимиту', () => {
      const sessionPolicy = createSessionPolicy({ maxConcurrentSessions: 2 });
      const manager = new SessionManager({ authPolicy, sessionPolicy });

      const sessions: readonly SessionState[] = [
        createActiveSession({ sessionId: 'session-1' }),
        createActiveSession({ sessionId: 'session-2' }),
      ];

      expect(manager.canOpenNewSession(sessions, Date.now())).toBe(false);
    });

    it('возвращает false если количество active сессий превышает лимит', () => {
      const sessionPolicy = createSessionPolicy({ maxConcurrentSessions: 1 });
      const manager = new SessionManager({ authPolicy, sessionPolicy });

      const sessions: readonly SessionState[] = [
        createActiveSession({ sessionId: 'session-1' }),
        createActiveSession({ sessionId: 'session-2' }),
      ];

      expect(manager.canOpenNewSession(sessions, Date.now())).toBe(false);
    });

    it('не считает истекшие active сессии', () => {
      const sessionPolicy = createSessionPolicy({ maxConcurrentSessions: 1 });
      const manager = new SessionManager({ authPolicy, sessionPolicy });

      const now = Date.now();
      const sessions: readonly SessionState[] = [
        {
          status: 'active',
          sessionId: 'session-1',
          issuedAt: new Date(now - 3600_000).toISOString(),
          expiresAt: new Date(now - 1000).toISOString(), // истекла
        },
      ];

      expect(manager.canOpenNewSession(sessions, now)).toBe(true);
    });

    it('не считает не-active сессии', () => {
      const sessionPolicy = createSessionPolicy({ maxConcurrentSessions: 1 });
      const manager = new SessionManager({ authPolicy, sessionPolicy });

      const sessions: readonly SessionState[] = [
        createExpiredSession(),
        createRevokedSession(),
        createSuspendedSession(),
      ];

      expect(manager.canOpenNewSession(sessions, Date.now())).toBe(true);
    });
  });

  // Тестирование приватных методов через косвенные вызовы
  describe('parseTimestamp (private method via public methods)', () => {
    const authPolicy = createAuthPolicy();
    const manager = new SessionManager({ authPolicy });

    it('корректно парсит валидные ISO строки', () => {
      const now = Date.now();
      const issuedAt = now - 1000; // 1 second ago
      const isoString = new Date(issuedAt).toISOString();

      // Тестируем через shouldInvalidate - если парсинг работает, метод не должен возвращать true
      // из-за невалидного issuedAt
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: isoString, // issuedAt в прошлом (валидное время)
        expiresAt: new Date(now + 3600_000).toISOString(),
      };

      // Если парсинг работает, метод должен проверить остальные условия
      // (в данном случае сессия должна быть валидной)
      expect(manager.shouldInvalidate(session, now)).toBe(false); // не должна инвалидироваться
    });

    it('возвращает null для невалидных строк', () => {
      const session: SessionState = {
        status: 'active',
        sessionId: 'session-123',
        issuedAt: 'invalid-date-string',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };

      // Если парсинг возвращает null, shouldInvalidate должен вернуть true
      expect(manager.shouldInvalidate(session, Date.now())).toBe(true);
    });
  });

  describe('assertNever (private method)', () => {
    const authPolicy = createAuthPolicy();
    const manager = new SessionManager({ authPolicy });

    it('бросает ошибку для неизвестного session status', () => {
      // Создаём сессию с неизвестным статусом через type assertion
      const invalidSession = {
        status: 'unknown_status' as any,
        sessionId: 'session-123',
      } as SessionState;

      expect(() => manager.isExpired(invalidSession, Date.now())).toThrow(
        '[SessionManager] Unhandled session status:',
      );
    });
  });
});
