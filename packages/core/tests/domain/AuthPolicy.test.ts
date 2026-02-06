/**
 * @file Unit тесты для AuthPolicy
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';
import { AuthPolicy } from '../../src/domain/AuthPolicy.js';
import type {
  AuthPolicyConfig,
  AuthSessionState,
  AuthTokenState,
} from '../../src/domain/AuthPolicy.js';

// Mock данные для тестирования
const MOCK_CONFIG: AuthPolicyConfig = {
  accessTokenTtlMs: 15 * 60 * 1000, // 15 минут
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 дней
  sessionMaxLifetimeMs: 30 * 24 * 60 * 60 * 1000, // 30 дней
  sessionIdleTimeoutMs: 60 * 60 * 1000, // 1 час
  requireRefreshRotation: true,
  maxRefreshRotations: 10,
};

const MOCK_CONFIG_NO_ROTATION: AuthPolicyConfig = {
  ...MOCK_CONFIG,
  requireRefreshRotation: false,
};

const PAST_TIME = 1000000000000; // Прошлое время
const FUTURE_TIME = 2000000000000; // Будущее время
const CURRENT_TIME = 1500000000000; // Текущее время

describe('AuthPolicy', () => {
  const policy = new AuthPolicy(MOCK_CONFIG);
  const policyNoRotation = new AuthPolicy(MOCK_CONFIG_NO_ROTATION);

  describe('Конструктор', () => {
    it('создает экземпляр с правильной конфигурацией', () => {
      expect(policy).toBeInstanceOf(AuthPolicy);
    });

    it('принимает конфиг с rotation', () => {
      expect(() => new AuthPolicy(MOCK_CONFIG)).not.toThrow();
    });

    it('принимает конфиг без rotation', () => {
      expect(() => new AuthPolicy(MOCK_CONFIG_NO_ROTATION)).not.toThrow();
    });
  });

  describe('evaluateToken', () => {
    it('возвращает TOKEN_INVALID для revoked токена', () => {
      const revokedToken: AuthTokenState = {
        type: 'access',
        issuedAt: PAST_TIME,
        expiresAt: FUTURE_TIME,
        isRevoked: true,
      };

      const result = policy.evaluateToken(revokedToken, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('revoked');
    });

    it('возвращает TOKEN_INVALID для expired токена', () => {
      const expiredToken: AuthTokenState = {
        type: 'access',
        issuedAt: PAST_TIME,
        expiresAt: PAST_TIME, // Уже истек
        isRevoked: false,
      };

      const result = policy.evaluateToken(expiredToken, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('expired');
    });

    it('отдает приоритет revoked перед expired', () => {
      const revokedExpiredToken: AuthTokenState = {
        type: 'access',
        issuedAt: PAST_TIME,
        expiresAt: PAST_TIME, // Истек
        isRevoked: true, // И revoked
      };

      const result = policy.evaluateToken(revokedExpiredToken, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('revoked');
    });

    it('возвращает TOKEN_VALID для валидного токена', () => {
      const validToken: AuthTokenState = {
        type: 'access',
        issuedAt: PAST_TIME,
        expiresAt: FUTURE_TIME,
        isRevoked: false,
      };

      const result = policy.evaluateToken(validToken, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('TOKEN_VALID');
    });

    it('работает с refresh токенами', () => {
      const validRefreshToken: AuthTokenState = {
        type: 'refresh',
        issuedAt: PAST_TIME,
        expiresAt: FUTURE_TIME,
        isRevoked: false,
      };

      const result = policy.evaluateToken(validRefreshToken, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('TOKEN_VALID');
    });

    it('учитывает rotationCounter в токене', () => {
      const tokenWithRotation: AuthTokenState = {
        type: 'refresh',
        issuedAt: PAST_TIME,
        expiresAt: FUTURE_TIME,
        isRevoked: false,
        rotationCounter: 5,
      };

      const result = policy.evaluateToken(tokenWithRotation, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('TOKEN_VALID');
    });
  });

  describe('evaluateSession', () => {
    it('возвращает SESSION_INVALID для terminated сессии', () => {
      const terminatedSession: AuthSessionState = {
        sessionId: 'session-1',
        userId: 'user-1',
        createdAt: PAST_TIME,
        lastActivityAt: CURRENT_TIME,
        isTerminated: true,
      };

      const result = policy.evaluateSession(terminatedSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('terminated');
    });

    it('возвращает SESSION_INVALID для expired сессии (max lifetime)', () => {
      const expiredSession: AuthSessionState = {
        sessionId: 'session-1',
        userId: 'user-1',
        createdAt: PAST_TIME - MOCK_CONFIG.sessionMaxLifetimeMs - 1000, // Старше max lifetime
        lastActivityAt: CURRENT_TIME,
        isTerminated: false,
      };

      const result = policy.evaluateSession(expiredSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('expired');
    });

    it('возвращает SESSION_INVALID для idle сессии', () => {
      const idleSession: AuthSessionState = {
        sessionId: 'session-1',
        userId: 'user-1',
        createdAt: CURRENT_TIME - 1000, // Создана недавно, но неактивна
        lastActivityAt: CURRENT_TIME - MOCK_CONFIG.sessionIdleTimeoutMs - 1000, // Неактивна дольше timeout
        isTerminated: false,
      };

      const result = policy.evaluateSession(idleSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('idle_timeout');
    });

    it('отдает приоритет terminated перед expired', () => {
      const terminatedExpiredSession: AuthSessionState = {
        sessionId: 'session-1',
        userId: 'user-1',
        createdAt: PAST_TIME - MOCK_CONFIG.sessionMaxLifetimeMs - 1000, // Expired
        lastActivityAt: CURRENT_TIME,
        isTerminated: true, // И terminated
      };

      const result = policy.evaluateSession(terminatedExpiredSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('terminated');
    });

    it('отдает приоритет expired перед idle_timeout', () => {
      const expiredIdleSession: AuthSessionState = {
        sessionId: 'session-1',
        userId: 'user-1',
        createdAt: PAST_TIME - MOCK_CONFIG.sessionMaxLifetimeMs - 1000, // Expired
        lastActivityAt: CURRENT_TIME - MOCK_CONFIG.sessionIdleTimeoutMs - 1000, // И idle
        isTerminated: false,
      };

      const result = policy.evaluateSession(expiredIdleSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('expired');
    });

    it('возвращает SESSION_VALID для активной сессии', () => {
      const activeSession: AuthSessionState = {
        sessionId: 'session-1',
        userId: 'user-1',
        createdAt: CURRENT_TIME - 1000, // Недавно создана
        lastActivityAt: CURRENT_TIME - 1000, // Недавняя активность
        isTerminated: false,
      };

      const result = policy.evaluateSession(activeSession, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('SESSION_VALID');
    });
  });

  describe('canRefresh', () => {
    const validToken: AuthTokenState = {
      type: 'refresh',
      issuedAt: PAST_TIME,
      expiresAt: FUTURE_TIME,
      isRevoked: false,
    };

    const validSession: AuthSessionState = {
      sessionId: 'session-1',
      userId: 'user-1',
      createdAt: CURRENT_TIME - 1000,
      lastActivityAt: CURRENT_TIME - 1000,
      isTerminated: false,
    };

    it('возвращает REFRESH_ALLOWED для валидных token и session', () => {
      const result = policy.canRefresh(validToken, validSession, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('REFRESH_ALLOWED');
    });

    it('возвращает REFRESH_DENIED если токен невалиден (revoked)', () => {
      const revokedToken = { ...validToken, isRevoked: true };

      const result = policy.canRefresh(revokedToken, validSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.violation).toEqual({
          code: 'REFRESH_TOKEN_INVALID',
          reason: 'revoked',
        });
      }
    });

    it('возвращает REFRESH_DENIED если токен невалиден (expired)', () => {
      const expiredToken = { ...validToken, expiresAt: PAST_TIME };

      const result = policy.canRefresh(expiredToken, validSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.violation).toEqual({
          code: 'REFRESH_TOKEN_INVALID',
          reason: 'expired',
        });
      }
    });

    it('возвращает REFRESH_DENIED если сессия невалидна (terminated)', () => {
      const terminatedSession = { ...validSession, isTerminated: true };

      const result = policy.canRefresh(validToken, terminatedSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.violation).toEqual({
          code: 'SESSION_INVALID',
          reason: 'terminated',
        });
      }
    });

    it('возвращает REFRESH_DENIED если сессия невалидна (expired)', () => {
      const expiredSession = {
        ...validSession,
        createdAt: PAST_TIME - MOCK_CONFIG.sessionMaxLifetimeMs - 1000,
      };

      const result = policy.canRefresh(validToken, expiredSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.violation).toEqual({
          code: 'SESSION_INVALID',
          reason: 'expired',
        });
      }
    });

    it('возвращает REFRESH_DENIED если сессия невалидна (idle)', () => {
      const idleSession = {
        ...validSession,
        lastActivityAt: CURRENT_TIME - MOCK_CONFIG.sessionIdleTimeoutMs - 1000,
      };

      const result = policy.canRefresh(validToken, idleSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.violation).toEqual({
          code: 'SESSION_INVALID',
          reason: 'idle_timeout',
        });
      }
    });

    it('применяет rotation limit когда requireRefreshRotation = true', () => {
      const tokenWithMaxRotations: AuthTokenState = {
        ...validToken,
        rotationCounter: MOCK_CONFIG.maxRefreshRotations!,
      };

      const result = policy.canRefresh(tokenWithMaxRotations, validSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.violation).toEqual({
          code: 'REFRESH_ROTATION_LIMIT',
        });
      }
    });

    it('не применяет rotation limit когда requireRefreshRotation = false', () => {
      const tokenWithMaxRotations: AuthTokenState = {
        ...validToken,
        rotationCounter: MOCK_CONFIG.maxRefreshRotations!,
      };

      const result = policyNoRotation.canRefresh(tokenWithMaxRotations, validSession, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('REFRESH_ALLOWED');
    });

    it('работает когда rotationCounter отсутствует', () => {
      const tokenWithoutRotation: AuthTokenState = {
        type: 'refresh',
        issuedAt: PAST_TIME,
        expiresAt: FUTURE_TIME,
        isRevoked: false,
        // rotationCounter не указан
      };

      const result = policy.canRefresh(tokenWithoutRotation, validSession, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('REFRESH_ALLOWED');
    });

    it('работает когда maxRefreshRotations не указан', () => {
      const configWithoutMax: AuthPolicyConfig = {
        accessTokenTtlMs: MOCK_CONFIG.accessTokenTtlMs,
        refreshTokenTtlMs: MOCK_CONFIG.refreshTokenTtlMs,
        sessionMaxLifetimeMs: MOCK_CONFIG.sessionMaxLifetimeMs,
        sessionIdleTimeoutMs: MOCK_CONFIG.sessionIdleTimeoutMs,
        requireRefreshRotation: MOCK_CONFIG.requireRefreshRotation,
        // maxRefreshRotations не указан
      };
      const policyWithoutMax = new AuthPolicy(configWithoutMax);

      const tokenWithRotation: AuthTokenState = {
        ...validToken,
        rotationCounter: 100, // Большое число
      };

      const result = policyWithoutMax.canRefresh(tokenWithRotation, validSession, CURRENT_TIME);

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('REFRESH_ALLOWED');
    });

    it('отдает приоритет токену перед сессией', () => {
      const revokedToken = { ...validToken, isRevoked: true };
      const terminatedSession = { ...validSession, isTerminated: true };

      const result = policy.canRefresh(revokedToken, terminatedSession, CURRENT_TIME);

      expect(result.allow).toBe(false);
      if (!result.allow) {
        expect(result.violation!.code).toBe('REFRESH_TOKEN_INVALID');
        expect(result.violation!.reason).toBe('revoked');
      }
    });
  });

  describe('Интеграционные тесты', () => {
    it('полный цикл: создание политики и использование всех методов', () => {
      const customConfig: AuthPolicyConfig = {
        accessTokenTtlMs: 1000,
        refreshTokenTtlMs: 2000,
        sessionMaxLifetimeMs: 3000,
        sessionIdleTimeoutMs: 500,
        requireRefreshRotation: true,
        maxRefreshRotations: 5,
      };

      const customPolicy = new AuthPolicy(customConfig);

      // Создаем тестовые данные
      const token: AuthTokenState = {
        type: 'access',
        issuedAt: CURRENT_TIME - 500,
        expiresAt: CURRENT_TIME + 500,
        isRevoked: false,
      };

      const session: AuthSessionState = {
        sessionId: 'test-session',
        userId: 'test-user',
        createdAt: CURRENT_TIME - 100,
        lastActivityAt: CURRENT_TIME - 100,
        isTerminated: false,
      };

      // Тестируем все методы
      const tokenResult = customPolicy.evaluateToken(token, CURRENT_TIME);
      const sessionResult = customPolicy.evaluateSession(session, CURRENT_TIME);
      const refreshResult = customPolicy.canRefresh(token, session, CURRENT_TIME);

      expect(tokenResult.allow).toBe(true);
      expect(sessionResult.allow).toBe(true);
      expect(refreshResult.allow).toBe(true);
    });

    it('работает с граничными значениями времени', () => {
      const boundaryTime = 1000000;

      const tokenAtBoundary: AuthTokenState = {
        type: 'access',
        issuedAt: boundaryTime - 100,
        expiresAt: boundaryTime, // Истекает точно в boundaryTime
        isRevoked: false,
      };

      const sessionAtBoundary: AuthSessionState = {
        sessionId: 'boundary-session',
        userId: 'boundary-user',
        createdAt: boundaryTime - MOCK_CONFIG.sessionIdleTimeoutMs, // Граница idle timeout
        lastActivityAt: boundaryTime - MOCK_CONFIG.sessionIdleTimeoutMs,
        isTerminated: false,
      };

      // Токен должен быть валиден (now < expiresAt)
      const tokenResult = policy.evaluateToken(tokenAtBoundary, boundaryTime - 1);
      expect(tokenResult.allow).toBe(true);

      // Токен должен истечь (now >= expiresAt)
      const expiredTokenResult = policy.evaluateToken(tokenAtBoundary, boundaryTime);
      expect(expiredTokenResult.allow).toBe(false);

      // Сессия должна быть валидна (активность точно на границе)
      const sessionResult = policy.evaluateSession(sessionAtBoundary, boundaryTime - 1);
      expect(sessionResult.allow).toBe(true);
    });
  });
});
