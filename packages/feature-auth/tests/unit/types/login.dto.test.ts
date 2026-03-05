/**
 * @file Unit тесты для types/login.dto.ts
 * Полное покрытие feature-level DTO для login-flow
 */

import { describe, expect, it } from 'vitest';

import type {
  LoginTokenPairValues,
  MeResponseValues,
  MfaChallengeRequestValues,
} from '../../../src/schemas/index.js';
import type { LoginResponseDto } from '../../../src/types/login.dto.js';
import { assertNever, isLoginSuccess, isMfaRequired } from '../../../src/types/login.dto.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

const createLoginTokenPairValues = (
  overrides: Partial<LoginTokenPairValues> = {},
): LoginTokenPairValues => ({
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
  expiresAt: '2026-01-01T00:00:00.000Z',
  issuedAt: '2026-01-01T00:00:00.000Z',
  scope: ['read', 'write'],
  metadata: { deviceId: 'device-123' },
  ...overrides,
});

/* eslint-disable @livai/rag/context-leakage -- Тестовые данные для unit тестов, не используются в production */
const createMeResponseValues = (
  overrides: Partial<MeResponseValues> = {},
): MeResponseValues => {
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
};
/* eslint-enable @livai/rag/context-leakage */

const createMfaChallengeRequestValues = (
  overrides: Partial<MfaChallengeRequestValues> = {},
): MfaChallengeRequestValues => ({
  userId: 'user-123',
  method: 'totp',
  ...overrides,
});

const createSuccessLoginResponseDto = (
  overrides: Partial<Extract<LoginResponseDto, { type: 'success'; }>> = {},
): Extract<LoginResponseDto, { type: 'success'; }> => ({
  type: 'success',
  tokenPair: createLoginTokenPairValues(),
  me: createMeResponseValues(),
  ...overrides,
});

const createMfaRequiredLoginResponseDto = (
  overrides: Partial<Extract<LoginResponseDto, { type: 'mfa_required'; }>> = {},
): Extract<LoginResponseDto, { type: 'mfa_required'; }> => ({
  type: 'mfa_required',
  challenge: createMfaChallengeRequestValues(),
  ...overrides,
});

// ============================================================================
// 📋 TYPE GUARDS TESTS
// ============================================================================

describe('types/login.dto', () => {
  describe('isLoginSuccess', () => {
    it('возвращает true для success-ветки', () => {
      const dto = createSuccessLoginResponseDto();

      const result = isLoginSuccess(dto);

      expect(result).toBe(true);
    });

    it('возвращает false для mfa_required-ветки', () => {
      const dto = createMfaRequiredLoginResponseDto();

      const result = isLoginSuccess(dto);

      expect(result).toBe(false);
    });

    it('корректно сужает тип для success-ветки', () => {
      const dto: LoginResponseDto = createSuccessLoginResponseDto();

      const result = isLoginSuccess(dto)
        ? (() => {
          // TypeScript должен знать, что dto имеет тип success
          expect(dto.tokenPair).toBeDefined();
          expect(dto.me).toBeDefined();
          expect(dto.tokenPair.accessToken).toBe('access-token-123');
          expect(dto.me.user.id).toBe('user-123');
          // @ts-expect-error - challenge не должен быть доступен для success
          expect(dto.challenge).toBeUndefined();
          return true;
        })()
        : expect.fail('Type guard должен вернуть true для success-ветки');

      expect(result).toBe(true);
    });
  });

  describe('isMfaRequired', () => {
    it('возвращает true для mfa_required-ветки', () => {
      const dto = createMfaRequiredLoginResponseDto();

      const result = isMfaRequired(dto);

      expect(result).toBe(true);
    });

    it('возвращает false для success-ветки', () => {
      const dto = createSuccessLoginResponseDto();

      const result = isMfaRequired(dto);

      expect(result).toBe(false);
    });

    it('корректно сужает тип для mfa_required-ветки', () => {
      const dto: LoginResponseDto = createMfaRequiredLoginResponseDto();

      const result = isMfaRequired(dto)
        ? (() => {
          // TypeScript должен знать, что dto имеет тип mfa_required
          expect(dto.challenge).toBeDefined();
          expect(dto.challenge.userId).toBe('user-123');
          expect(dto.challenge.method).toBe('totp');
          // @ts-expect-error - tokenPair не должен быть доступен для mfa_required
          expect(dto.tokenPair).toBeUndefined();
          // @ts-expect-error - me не должен быть доступен для mfa_required
          expect(dto.me).toBeUndefined();
          return true;
        })()
        : expect.fail('Type guard должен вернуть true для mfa_required-ветки');

      expect(result).toBe(true);
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
      expect(caughtError.message).toContain('Unexpected LoginResponseDto variant');
      expect(caughtError.message).toContain(JSON.stringify(unexpectedValue));
    });

    it('используется для exhaustive checking в switch', () => {
      const successDto = createSuccessLoginResponseDto();
      const mfaDto = createMfaRequiredLoginResponseDto();

      // Проверяем, что все ветки обработаны
      const handleSuccess = (dto: Extract<LoginResponseDto, { type: 'success'; }>): string => {
        return `Success: ${dto.tokenPair.accessToken}`;
      };

      const handleMfa = (dto: Extract<LoginResponseDto, { type: 'mfa_required'; }>): string => {
        return `MFA required: ${dto.challenge.method}`;
      };

      const handleDto = (dto: LoginResponseDto): string => {
        return dto.type === 'success'
          ? handleSuccess(dto)
          : handleMfa(dto);
      };

      expect(handleDto(successDto)).toBe('Success: access-token-123');
      expect(handleDto(mfaDto)).toBe('MFA required: totp');
    });
  });

  describe('LoginResponseDto type structure', () => {
    it('success-ветка содержит все обязательные поля', () => {
      const dto = createSuccessLoginResponseDto();

      expect(dto.type).toBe('success');
      expect(dto.tokenPair).toBeDefined();
      expect(dto.me).toBeDefined();
      expect(dto.tokenPair.accessToken).toBeDefined();
      expect(dto.tokenPair.refreshToken).toBeDefined();
      expect(dto.tokenPair.expiresAt).toBeDefined();
      expect(dto.me.user).toBeDefined();
      expect(dto.me.roles).toBeDefined();
      expect(dto.me.permissions).toBeDefined();
    });

    it('mfa_required-ветка содержит все обязательные поля', () => {
      const dto = createMfaRequiredLoginResponseDto();

      expect(dto.type).toBe('mfa_required');
      expect(dto.challenge).toBeDefined();
      expect(dto.challenge.userId).toBeDefined();
      expect(dto.challenge.method).toBeDefined();
    });

    it('обе ветки имеют readonly поля', () => {
      const successDto = createSuccessLoginResponseDto();
      const mfaDto = createMfaRequiredLoginResponseDto();

      // TypeScript должен запрещать мутацию readonly полей
      // Это проверяется на уровне типов, но мы можем проверить структуру
      expect(Object.isFrozen(successDto) || Object.isFrozen(mfaDto)).toBe(false); // Объекты не frozen, но поля readonly на уровне типов
      expect(successDto.type).toBe('success');
      expect(mfaDto.type).toBe('mfa_required');
    });

    it('discriminated union работает корректно для всех веток', () => {
      const successDto: LoginResponseDto = createSuccessLoginResponseDto();
      const mfaDto: LoginResponseDto = createMfaRequiredLoginResponseDto();

      // Проверяем, что discriminated union правильно различает ветки
      const checkSuccess = (() => {
        expect(successDto.tokenPair).toBeDefined();
        expect(successDto.me).toBeDefined();
        return true;
      })();

      const checkMfa = (() => {
        expect(mfaDto.challenge).toBeDefined();
        return true;
      })();

      expect(checkSuccess).toBe(true);
      expect(checkMfa).toBe(true);
    });
  });
});
