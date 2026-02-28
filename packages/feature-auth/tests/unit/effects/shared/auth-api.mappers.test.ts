/**
 * @file Unit тесты для effects/shared/auth-api.mappers.ts
 * Полное покрытие мэпперов transport → domain для TokenPair и MeResponse.
 */

/* eslint-disable functional/no-conditional-statements -- в тестах используем if для type narrowing */

import { describe, expect, it } from 'vitest';

import {
  mapMeResponseValuesToDomain,
  mapTokenPairValuesToDomain,
} from '../../../../src/effects/shared/auth-api.mappers.js';
import type { LoginTokenPairValues, MeResponseValues } from '../../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPERS
// ============================================================================

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
    context: {
      org: 'org-123',
      tenant: 'tenant-123',
      flags: ['beta'],
      score: 1,
    },
  };
  return { ...base, ...overrides };
}

// ============================================================================
// 📋 TESTS — mapTokenPairValuesToDomain
// ============================================================================

describe('effects/shared/auth-api.mappers', () => {
  describe('mapTokenPairValuesToDomain', () => {
    it('маппит полный TokenPair со всеми полями', () => {
      const tokenPairValues = createLoginTokenPairValues();

      const result = mapTokenPairValuesToDomain(tokenPairValues);

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.expiresAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.issuedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.scope).toEqual(['read', 'write']);
      expect(result.metadata).toEqual({
        deviceId: 'device-123',
        attempts: 1,
        tags: ['login', 'web'],
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.scope)).toBe(true);
      expect(Object.isFrozen(result.metadata)).toBe(true);
    });

    it('маппит TokenPair без опциональных полей', () => {
      const tokenPairValues = createLoginTokenPairValues({
        scope: undefined,
        metadata: undefined,
        issuedAt: undefined,
      });

      const result = mapTokenPairValuesToDomain(tokenPairValues);

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.expiresAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.issuedAt).toBeUndefined();
      expect(result.scope).toBeUndefined();
      expect(result.metadata).toBeUndefined();
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('валидирует и замораживает scope как массив строк', () => {
      const tokenPairValues = createLoginTokenPairValues({
        scope: ['read', 'write', 'admin'],
      });

      const result = mapTokenPairValuesToDomain(tokenPairValues);

      expect(result.scope).toEqual(['read', 'write', 'admin']);
      expect(Object.isFrozen(result.scope)).toBe(true);
      // Проверяем, что это новый массив, а не исходный
      expect(result.scope).not.toBe(tokenPairValues.scope);
    });

    it('валидирует и замораживает metadata как Record', () => {
      const tokenPairValues = createLoginTokenPairValues({
        metadata: {
          deviceId: 'device-456',
          attempts: 2,
        },
      });

      const result = mapTokenPairValuesToDomain(tokenPairValues);

      expect(result.metadata).toEqual({
        deviceId: 'device-456',
        attempts: 2,
      });
      expect(Object.isFrozen(result.metadata)).toBe(true);
      // Проверяем, что это новый объект, а не исходный
      expect(result.metadata).not.toBe(tokenPairValues.metadata);
    });

    it('выбрасывает ошибку если scope содержит не-строки', () => {
      const tokenPairValues = createLoginTokenPairValues({
        scope: ['read', 123, 'write'] as unknown as string[],
      });

      expect(() => {
        mapTokenPairValuesToDomain(tokenPairValues);
      }).toThrow(
        '[auth-api.mappers] Unsafe tokenPair.scope: only string values are allowed in array',
      );
    });

    it('выбрасывает ошибку если scope не массив', () => {
      const tokenPairValues = createLoginTokenPairValues({
        scope: 'not-an-array' as unknown as string[],
      });

      expect(() => {
        mapTokenPairValuesToDomain(tokenPairValues);
      }).toThrow('[auth-api.mappers] Invalid tokenPair.scope: expected array');
    });

    it('выбрасывает ошибку если metadata не plain object (массив)', () => {
      const tokenPairValues = createLoginTokenPairValues({
        metadata: [] as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapTokenPairValuesToDomain(tokenPairValues);
      }).toThrow('[auth-api.mappers] Unsafe tokenPair.metadata: expected plain object');
    });

    it('выбрасывает ошибку если metadata не plain object (null)', () => {
      const tokenPairValues = createLoginTokenPairValues({
        metadata: null as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapTokenPairValuesToDomain(tokenPairValues);
      }).toThrow('[auth-api.mappers] Unsafe tokenPair.metadata: expected plain object');
    });

    it('выбрасывает ошибку если metadata не plain object (примитив)', () => {
      const tokenPairValues = createLoginTokenPairValues({
        metadata: 'not-an-object' as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapTokenPairValuesToDomain(tokenPairValues);
      }).toThrow('[auth-api.mappers] Unsafe tokenPair.metadata: expected plain object');
    });

    it('выбрасывает ошибку если metadata содержит вложенные объекты', () => {
      const tokenPairValues = createLoginTokenPairValues({
        metadata: {
          deviceId: 'device-123',
          nested: { x: 1 },
        } as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapTokenPairValuesToDomain(tokenPairValues);
      }).toThrow(
        '[auth-api.mappers] Unsafe tokenPair.metadata: only primitive values or arrays of primitives are allowed',
      );
    });

    it('выбрасывает ошибку если metadata содержит функции', () => {
      const tokenPairValues = createLoginTokenPairValues({
        metadata: {
          deviceId: 'device-123',
          fn: (): void => {},
        } as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapTokenPairValuesToDomain(tokenPairValues);
      }).toThrow(
        '[auth-api.mappers] Unsafe tokenPair.metadata: only primitive values or arrays of primitives are allowed',
      );
    });
  });

  // ============================================================================
  // 📋 TESTS — mapMeResponseValuesToDomain
  // ============================================================================

  describe('mapMeResponseValuesToDomain', () => {
    it('маппит полный MeResponse со всеми полями', () => {
      const meValues = createMeResponseValues();

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('user@example.com');
      expect(result.roles).toEqual(['user', 'admin']);
      expect(result.permissions).toEqual(['read', 'write']);
      expect(result.session?.sessionId).toBe('session-123');
      expect(result.features).toEqual({ feature1: true, feature2: false });
      expect(result.context).toEqual({
        org: 'org-123',
        tenant: 'tenant-123',
        flags: ['beta'],
        score: 1,
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.roles)).toBe(true);
      expect(Object.isFrozen(result.permissions)).toBe(true);
      if (result.session) {
        expect(Object.isFrozen(result.session)).toBe(true);
      }
      if (result.features) {
        expect(Object.isFrozen(result.features)).toBe(true);
      }
      if (result.context) {
        expect(Object.isFrozen(result.context)).toBe(true);
      }
    });

    it('маппит MeResponse без опциональных полей', () => {
      const meValues = createMeResponseValues({
        session: undefined,
        features: undefined,
        context: undefined,
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.user.id).toBe('user-123');
      expect(result.roles).toEqual(['user', 'admin']);
      expect(result.permissions).toEqual(['read', 'write']);
      expect(result.session).toBeUndefined();
      expect(result.features).toBeUndefined();
      expect(result.context).toBeUndefined();
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('валидирует и замораживает roles как массив строк', () => {
      const meValues = createMeResponseValues({
        roles: ['admin', 'user', 'moderator'],
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.roles).toEqual(['admin', 'user', 'moderator']);
      expect(Object.isFrozen(result.roles)).toBe(true);
      // Проверяем, что это новый массив, а не исходный
      expect(result.roles).not.toBe(meValues.roles);
    });

    it('валидирует и замораживает permissions как массив строк', () => {
      const meValues = createMeResponseValues({
        permissions: ['read', 'write', 'delete'],
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.permissions).toEqual(['read', 'write', 'delete']);
      expect(Object.isFrozen(result.permissions)).toBe(true);
      // Проверяем, что это новый массив, а не исходный
      expect(result.permissions).not.toBe(meValues.permissions);
    });

    it('выбрасывает ошибку если roles содержит не-строки', () => {
      const meValues = createMeResponseValues({
        roles: ['admin', 123, 'user'] as unknown as string[],
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow('[auth-api.mappers] Unsafe me.roles: only string values are allowed in array');
    });

    it('выбрасывает ошибку если permissions содержит не-строки', () => {
      const meValues = createMeResponseValues({
        permissions: ['read', true, 'write'] as unknown as string[],
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow(
        '[auth-api.mappers] Unsafe me.permissions: only string values are allowed in array',
      );
    });

    it('маппит session со всеми полями', () => {
      const meValues = createMeResponseValues({
        session: {
          sessionId: 'session-456',
          ip: '10.0.0.1',
          deviceId: 'device-456',
          userAgent: 'Chrome/1.0',
          issuedAt: '2026-01-01T00:00:00.000Z',
          expiresAt: '2026-12-31T23:59:59.000Z',
        },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.session?.sessionId).toBe('session-456');
      expect(result.session?.ip).toBe('10.0.0.1');
      expect(result.session?.deviceId).toBe('device-456');
      expect(result.session?.userAgent).toBe('Chrome/1.0');
      expect(result.session?.issuedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.session?.expiresAt).toBe('2026-12-31T23:59:59.000Z');
      if (result.session) {
        expect(Object.isFrozen(result.session)).toBe(true);
      }
    });

    it('маппит session с минимальными полями', () => {
      const meValues = createMeResponseValues({
        session: {
          sessionId: 'session-min',
        },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.session?.sessionId).toBe('session-min');
      expect(result.session?.ip).toBeUndefined();
      expect(result.session?.deviceId).toBeUndefined();
      expect(result.session?.userAgent).toBeUndefined();
      expect(result.session?.issuedAt).toBeUndefined();
      expect(result.session?.expiresAt).toBeUndefined();
    });

    it('маппит user со всеми полями', () => {
      const meValues = createMeResponseValues({
        user: {
          id: 'user-456',
          email: 'test@example.com',
          emailVerified: false,
          phone: '+9876543210',
          phoneVerified: false,
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar2.jpg',
          authProvider: 'oauth',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastLoginAt: '2026-01-15T10:30:00.000Z',
        },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.user.id).toBe('user-456');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.emailVerified).toBe(false);
      expect(result.user.phone).toBe('+9876543210');
      expect(result.user.phoneVerified).toBe(false);
      expect(result.user.username).toBe('testuser');
      expect(result.user.displayName).toBe('Test User');
      expect(result.user.avatarUrl).toBe('https://example.com/avatar2.jpg');
      expect(result.user.authProvider).toBe('oauth');
      expect(result.user.status).toBe('active');
      expect(result.user.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.user.lastLoginAt).toBe('2026-01-15T10:30:00.000Z');
      expect(Object.isFrozen(result.user)).toBe(true);
    });

    it('маппит user с минимальными полями', () => {
      const meValues = createMeResponseValues({
        user: {
          id: 'user-min',
        },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.user.id).toBe('user-min');
      expect(result.user.email).toBeUndefined();
      expect(result.user.emailVerified).toBeUndefined();
      expect(result.user.phone).toBeUndefined();
      expect(result.user.phoneVerified).toBeUndefined();
      expect(result.user.username).toBeUndefined();
      expect(result.user.displayName).toBeUndefined();
      expect(result.user.avatarUrl).toBeUndefined();
      expect(result.user.authProvider).toBeUndefined();
      expect(result.user.status).toBeUndefined();
      expect(result.user.createdAt).toBeUndefined();
      expect(result.user.lastLoginAt).toBeUndefined();
    });

    it('валидирует и замораживает features как Record<string, boolean>', () => {
      const meValues = createMeResponseValues({
        features: { feature1: true, feature2: false, feature3: true },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.features).toEqual({ feature1: true, feature2: false, feature3: true });
      if (result.features) {
        expect(Object.isFrozen(result.features)).toBe(true);
        // Проверяем, что это новый объект, а не исходный
        expect(result.features).not.toBe(meValues.features);
      }
    });

    it('выбрасывает ошибку если features не plain object', () => {
      const meValues = createMeResponseValues({
        features: [] as unknown as Record<string, boolean>,
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow('[auth-api.mappers] Unsafe me.features: expected plain object');
    });

    it('выбрасывает ошибку если features содержит не-boolean значения', () => {
      const meValues = createMeResponseValues({
        features: {
          feature1: true,
          feature2: 'not-boolean',
        } as unknown as Record<string, boolean>,
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow('[auth-api.mappers] Unsafe me.features: all values must be boolean');
    });

    it('валидирует и замораживает context как Record', () => {
      const meValues = createMeResponseValues({
        context: {
          org: 'org-456',
          tenant: 'tenant-456',
          score: 100,
        },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.context).toEqual({
        org: 'org-456',
        tenant: 'tenant-456',
        score: 100,
      });
      if (result.context) {
        expect(Object.isFrozen(result.context)).toBe(true);
        // Проверяем, что это новый объект, а не исходный
        expect(result.context).not.toBe(meValues.context);
      }
    });

    it('выбрасывает ошибку если context не plain object (массив)', () => {
      const meValues = createMeResponseValues({
        context: [] as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow('[auth-api.mappers] Unsafe me.context: expected plain object');
    });

    it('выбрасывает ошибку если context не plain object (null)', () => {
      const meValues = createMeResponseValues({
        context: null as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow('[auth-api.mappers] Unsafe me.context: expected plain object');
    });

    it('выбрасывает ошибку если context не plain object (примитив)', () => {
      const meValues = createMeResponseValues({
        context: 'not-an-object' as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow('[auth-api.mappers] Unsafe me.context: expected plain object');
    });

    it('выбрасывает ошибку если context содержит вложенные объекты', () => {
      const meValues = createMeResponseValues({
        context: {
          org: 'org-123',
          nested: { x: 1 },
        } as unknown as Record<string, unknown>,
      });

      expect(() => {
        mapMeResponseValuesToDomain(meValues);
      }).toThrow(
        '[auth-api.mappers] Unsafe me.context: only primitive values or arrays of primitives are allowed',
      );
    });

    it('разрешает context с массивами примитивов', () => {
      const meValues = createMeResponseValues({
        context: {
          org: 'org-123',
          tags: ['tag1', 'tag2'],
          scores: [1, 2, 3],
          flags: [true, false],
        },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.context).toEqual({
        org: 'org-123',
        tags: ['tag1', 'tag2'],
        scores: [1, 2, 3],
        flags: [true, false],
      });
    });

    it('разрешает context с null значениями', () => {
      const meValues = createMeResponseValues({
        context: {
          org: 'org-123',
          nullable: null,
        },
      });

      const result = mapMeResponseValuesToDomain(meValues);

      expect(result.context).toEqual({
        org: 'org-123',
        nullable: null,
      });
    });
  });
});

/* eslint-enable functional/no-conditional-statements */
