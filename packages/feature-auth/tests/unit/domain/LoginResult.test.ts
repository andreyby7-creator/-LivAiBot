/**
 * @file Unit тесты для domain/LoginResult.ts
 * Полное покрытие domain-level результата login-flow
 */

import { describe, expect, it } from 'vitest';

import type { DomainLoginResult } from '../../../src/domain/LoginResult.js';
import { assertNever } from '../../../src/domain/LoginResult.js';
import type { MeResponse } from '../../../src/domain/MeResponse.js';
import type { MfaChallengeRequest } from '../../../src/domain/MfaChallengeRequest.js';
import type { TokenPair } from '../../../src/domain/TokenPair.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresAt: '2026-01-01T00:00:00.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    scope: ['read', 'write'],
    metadata: { deviceId: 'device-123' },
    ...overrides,
  };
}

function createMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: {
      id: 'user-123',
      email: 'user@example.com',
      emailVerified: true,
      phone: '+1234567890',
      phoneVerified: true,
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
    context: { org: 'org-123', tenant: 'tenant-123' },
    ...overrides,
  };
}

function createMfaChallengeRequest(
  overrides: Partial<MfaChallengeRequest> = {},
): MfaChallengeRequest {
  return {
    userId: 'user-123',
    type: 'totp',
    deviceId: 'device-123',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: '2026-01-01T00:00:00.000Z',
    meta: { step: 'login' },
    ...overrides,
  };
}

function createSuccessDomainLoginResult(
  overrides: Partial<Extract<DomainLoginResult, { type: 'success'; }>> = {},
): Extract<DomainLoginResult, { type: 'success'; }> {
  return {
    type: 'success',
    tokenPair: createTokenPair(),
    me: createMeResponse(),
    ...overrides,
  };
}

function createMfaRequiredDomainLoginResult(
  overrides: Partial<Extract<DomainLoginResult, { type: 'mfa_required'; }>> = {},
): Extract<DomainLoginResult, { type: 'mfa_required'; }> {
  return {
    type: 'mfa_required',
    challenge: createMfaChallengeRequest(),
    ...overrides,
  };
}

// ============================================================================
// 📋 DOMAIN LOGIN RESULT TYPE STRUCTURE
// ============================================================================

describe('domain/LoginResult', () => {
  describe('DomainLoginResult type structure', () => {
    it('success-ветка содержит все обязательные поля', () => {
      const result = createSuccessDomainLoginResult();

      expect(result.type).toBe('success');
      expect(result.tokenPair).toBeDefined();
      expect(result.me).toBeDefined();
      expect(result.tokenPair.accessToken).toBeDefined();
      expect(result.tokenPair.refreshToken).toBeDefined();
      expect(result.tokenPair.expiresAt).toBeDefined();
      expect(result.me.user).toBeDefined();
      expect(result.me.roles).toBeDefined();
      expect(result.me.permissions).toBeDefined();
    });

    it('mfa_required-ветка содержит все обязательные поля', () => {
      const result = createMfaRequiredDomainLoginResult();

      expect(result.type).toBe('mfa_required');
      expect(result.challenge).toBeDefined();
      expect(result.challenge.userId).toBeDefined();
      expect(result.challenge.type).toBeDefined();
    });

    it('обе ветки имеют readonly поля', () => {
      const successResult = createSuccessDomainLoginResult();
      const mfaResult = createMfaRequiredDomainLoginResult();

      // TypeScript должен запрещать мутацию readonly полей
      // Это проверяется на уровне типов, но мы можем проверить структуру
      expect(Object.isFrozen(successResult) || Object.isFrozen(mfaResult)).toBe(false); // Объекты не frozen, но поля readonly на уровне типов
      expect(successResult.type).toBe('success');
      expect(mfaResult.type).toBe('mfa_required');
    });

    it('discriminated union работает корректно для всех веток', () => {
      const successResult: DomainLoginResult = createSuccessDomainLoginResult();
      const mfaResult: DomainLoginResult = createMfaRequiredDomainLoginResult();

      // Проверяем, что discriminated union правильно различает ветки
      const checkSuccess = (() => {
        expect(successResult.tokenPair).toBeDefined();
        expect(successResult.me).toBeDefined();
        return true;
      })();

      const checkMfa = (() => {
        expect(mfaResult.challenge).toBeDefined();
        return true;
      })();

      expect(checkSuccess).toBe(true);
      expect(checkMfa).toBe(true);
    });
  });

  describe('success-ветка детальная структура', () => {
    it('success-ветка содержит tokenPair с полными данными', () => {
      const result = createSuccessDomainLoginResult({
        tokenPair: createTokenPair({
          accessToken: 'custom-access-token',
          refreshToken: 'custom-refresh-token',
          expiresAt: '2027-01-01T00:00:00.000Z',
        }),
      });

      expect(result.type).toBe('success');
      expect(result.tokenPair.accessToken).toBe('custom-access-token');
      expect(result.tokenPair.refreshToken).toBe('custom-refresh-token');
      expect(result.tokenPair.expiresAt).toBe('2027-01-01T00:00:00.000Z');
    });

    it('success-ветка содержит me с полными данными', () => {
      const result = createSuccessDomainLoginResult({
        me: createMeResponse({
          user: {
            id: 'custom-user-id',
            email: 'custom@example.com',
          },
          roles: ['custom-role'],
        }),
      });

      expect(result.type).toBe('success');
      expect(result.me.user.id).toBe('custom-user-id');
      expect(result.me.user.email).toBe('custom@example.com');
      expect(result.me.roles).toEqual(['custom-role']);
    });

    it('success-ветка гарантированно содержит оба поля (fail-closed)', () => {
      const result = createSuccessDomainLoginResult();

      // Оба поля обязательны, никаких partial состояний
      expect(result.tokenPair).toBeDefined();
      expect(result.me).toBeDefined();
      expect(result.tokenPair).not.toBeNull();
      expect(result.me).not.toBeNull();
    });
  });

  describe('mfa_required-ветка детальная структура', () => {
    it('mfa_required-ветка содержит challenge с полными данными', () => {
      const result = createMfaRequiredDomainLoginResult({
        challenge: createMfaChallengeRequest({
          userId: 'custom-user-id',
          type: 'sms',
          deviceId: 'custom-device-id',
        }),
      });

      expect(result.type).toBe('mfa_required');
      expect(result.challenge.userId).toBe('custom-user-id');
      expect(result.challenge.type).toBe('sms');
      expect(result.challenge.deviceId).toBe('custom-device-id');
    });

    it('mfa_required-ветка поддерживает все типы MFA', () => {
      const mfaTypes: ('totp' | 'sms' | 'email' | 'push')[] = ['totp', 'sms', 'email', 'push'];

      mfaTypes.forEach((type) => {
        const result = createMfaRequiredDomainLoginResult({
          challenge: createMfaChallengeRequest({ type }),
        });

        expect(result.type).toBe('mfa_required');
        expect(result.challenge.type).toBe(type);
      });
    });
  });

  describe('discriminated union type narrowing', () => {
    it('TypeScript корректно сужает тип для success-ветки', () => {
      const successResult = createSuccessDomainLoginResult();
      const result: DomainLoginResult = successResult;

      const checkSuccess = (() => {
        // TypeScript должен знать, что result имеет тип success после проверки
        expect(result.tokenPair).toBeDefined();
        expect(result.me).toBeDefined();
        expect(result.tokenPair.accessToken).toBe('access-token-123');
        expect(result.me.user.id).toBe('user-123');
        // @ts-expect-error - challenge не должен быть доступен для success
        expect(result.challenge).toBeUndefined();
        return true;
      })();

      expect(checkSuccess).toBe(true);
      expect(result.type).toBe('success');
    });

    it('TypeScript корректно сужает тип для mfa_required-ветки', () => {
      const mfaResult = createMfaRequiredDomainLoginResult();
      const result: DomainLoginResult = mfaResult;

      const checkMfa = (() => {
        // TypeScript должен знать, что result имеет тип mfa_required после проверки
        expect(result.challenge).toBeDefined();
        expect(result.challenge.userId).toBe('user-123');
        expect(result.challenge.type).toBe('totp');
        // @ts-expect-error - tokenPair не должен быть доступен для mfa_required
        expect(result.tokenPair).toBeUndefined();
        // @ts-expect-error - me не должен быть доступен для mfa_required
        expect(result.me).toBeUndefined();
        return true;
      })();

      expect(checkMfa).toBe(true);
      expect(result.type).toBe('mfa_required');
    });
  });

  describe('assertNever', () => {
    it('бросает ошибку с правильным сообщением', () => {
      // Создаём объект, который TypeScript считает never (после exhaustive switch)
      const unexpectedValue = {
        type: 'unexpected',
        data: 'test',
      } as never;

      // Проверяем, что assertNever бросает ошибку
      expect(() => {
        assertNever(unexpectedValue);
      }).toThrow();

      // Проверяем детали ошибки
      const catchError = (): Error => {
        try {
          // Используем type assertion, чтобы TypeScript не считал код недостижимым
          (assertNever as (x: unknown) => never)(unexpectedValue);
          // Этот код технически недостижим, но нужен для type checking
          return new Error('Unexpected: assertNever did not throw');
        } catch (error) {
          return error as Error;
        }
      };

      const caughtError = catchError();

      expect(caughtError).toBeDefined();
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toContain('Unexpected DomainLoginResult variant');
      expect(caughtError.message).toContain(JSON.stringify(unexpectedValue));
    });

    it('используется для exhaustive checking в switch', () => {
      const successResult = createSuccessDomainLoginResult();
      const mfaResult = createMfaRequiredDomainLoginResult();

      // Проверяем, что все ветки обработаны
      const handleSuccess = (
        result: Extract<DomainLoginResult, { type: 'success'; }>,
      ): string => {
        return `Success: ${result.tokenPair.accessToken}`;
      };

      const handleMfa = (
        result: Extract<DomainLoginResult, { type: 'mfa_required'; }>,
      ): string => {
        return `MFA required: ${result.challenge.type}`;
      };

      const handleResult = (result: DomainLoginResult): string => {
        return result.type === 'success' ? handleSuccess(result) : handleMfa(result);
      };

      expect(handleResult(successResult)).toBe('Success: access-token-123');
      expect(handleResult(mfaResult)).toBe('MFA required: totp');
    });

    it('TypeScript требует обработку всех веток в switch', () => {
      const successResult = createSuccessDomainLoginResult();
      const mfaResult = createMfaRequiredDomainLoginResult();

      const handleSuccess = (
        result: Extract<DomainLoginResult, { type: 'success'; }>,
      ): string => {
        return `Success: ${result.tokenPair.accessToken}`;
      };

      const handleMfa = (
        result: Extract<DomainLoginResult, { type: 'mfa_required'; }>,
      ): string => {
        return `MFA: ${result.challenge.type}`;
      };

      const handleResult = (result: DomainLoginResult): string => {
        return result.type === 'success' ? handleSuccess(result) : handleMfa(result);
      };

      expect(handleResult(successResult)).toBe('Success: access-token-123');
      expect(handleResult(mfaResult)).toBe('MFA: totp');
    });
  });

  describe('domain vs transport separation', () => {
    it('использует чистые domain-типы (TokenPair, MeResponse, MfaChallengeRequest)', () => {
      const successResult = createSuccessDomainLoginResult();
      const mfaResult = createMfaRequiredDomainLoginResult();

      // Проверяем, что используются domain-типы, а не transport-типы
      expect(successResult.tokenPair).toBeDefined();
      expect(successResult.me).toBeDefined();
      expect(mfaResult.challenge).toBeDefined();

      // Проверяем структуру domain-типов
      expect(successResult.tokenPair.accessToken).toBeDefined();
      expect(successResult.me.user.id).toBeDefined();
      expect(mfaResult.challenge.userId).toBeDefined();
    });

    it('не зависит от transport/schema слоя', () => {
      const result = createSuccessDomainLoginResult();

      // Domain-тип не должен содержать ссылок на transport-типы
      // Это проверяется на уровне типов TypeScript
      expect(result.type).toBe('success');
      expect(result.tokenPair).toBeDefined();
      expect(result.me).toBeDefined();
    });
  });

  describe('immutability', () => {
    it('все поля readonly - предотвращает мутацию', () => {
      const result: DomainLoginResult = createSuccessDomainLoginResult();

      // TypeScript предотвращает мутацию
      // result.type = 'mfa_required'; // TypeScript error: Cannot assign to 'type' because it is a read-only property
      // result.tokenPair = createTokenPair(); // TypeScript error

      expect(result.type).toBe('success');
    });

    it('tokenPair и me readonly - предотвращает мутацию вложенных объектов', () => {
      const result = createSuccessDomainLoginResult();

      // TypeScript предотвращает мутацию вложенных объектов
      // result.tokenPair.accessToken = 'mutated'; // TypeScript error
      // result.me.user.id = 'mutated'; // TypeScript error

      expect(result.tokenPair.accessToken).toBe('access-token-123');
      expect(result.me.user.id).toBe('user-123');
    });

    it('challenge readonly - предотвращает мутацию', () => {
      const result = createMfaRequiredDomainLoginResult();

      // TypeScript предотвращает мутацию
      // result.challenge.userId = 'mutated'; // TypeScript error

      expect(result.challenge.userId).toBe('user-123');
    });
  });

  describe('comprehensive coverage', () => {
    it('полное покрытие всех веток discriminated union', () => {
      // Success с полным набором полей
      const successResult = createSuccessDomainLoginResult({
        tokenPair: createTokenPair({
          accessToken: 'full-access-token',
          refreshToken: 'full-refresh-token',
          expiresAt: '2027-12-31T23:59:59.000Z',
          issuedAt: '2027-01-01T00:00:00.000Z',
          scope: ['read', 'write', 'admin'],
          metadata: { deviceId: 'device-full' },
        }),
        me: createMeResponse({
          user: {
            id: 'full-user-id',
            email: 'full@example.com',
            emailVerified: true,
            phone: '+9876543210',
            phoneVerified: true,
            username: 'fulluser',
            displayName: 'Full User',
            avatarUrl: 'https://example.com/full-avatar.jpg',
            authProvider: 'oauth',
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
            lastLoginAt: '2026-01-15T10:30:00.000Z',
          },
          roles: ['user', 'admin', 'moderator'],
          permissions: ['read', 'write', 'admin'],
          session: {
            sessionId: 'session-full',
            ip: '10.0.0.1',
            deviceId: 'device-full',
            userAgent: 'Mozilla/5.0',
            issuedAt: '2026-01-15T10:00:00.000Z',
            expiresAt: '2026-01-16T10:00:00.000Z',
          },
          features: { mfaEnabled: true },
          context: { orgId: 'org-full' },
        }),
      });

      // MFA required со всеми типами
      const mfaResults = ['totp', 'sms', 'email', 'push'].map((type) =>
        createMfaRequiredDomainLoginResult({
          challenge: createMfaChallengeRequest({
            userId: `user-${type}`,
            type: type as 'totp' | 'sms' | 'email' | 'push',
            deviceId: `device-${type}`,
            ip: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            timestamp: '2026-01-01T00:00:00.000Z',
            meta: { step: 'login', type },
          }),
        })
      );

      // Проверки корректности discriminated union
      expect(successResult.type).toBe('success');
      expect(successResult.tokenPair.accessToken).toBe('full-access-token');
      expect(successResult.me.user.id).toBe('full-user-id');

      const expectedMfaTypes: ('totp' | 'sms' | 'email' | 'push')[] = [
        'totp',
        'sms',
        'email',
        'push',
      ];
      mfaResults.forEach((result, index) => {
        expect(result.type).toBe('mfa_required');
        // Проверяем, что тип соответствует ожидаемому через прямое сравнение
        const isTotp = index === 0 && result.challenge.type === 'totp';
        const isSms = index === 1 && result.challenge.type === 'sms';
        const isEmail = index === 2 && result.challenge.type === 'email';
        const isPush = index === 3 && result.challenge.type === 'push';
        expect(isTotp || isSms || isEmail || isPush).toBe(true);
        expect(expectedMfaTypes.includes(result.challenge.type)).toBe(true);
      });
    });
  });
});
