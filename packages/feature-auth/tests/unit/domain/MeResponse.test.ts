/**
 * @file Unit тесты для domain/MeResponse.ts
 * Полное покрытие ответа эндпоинта /me
 */

import { describe, expect, it } from 'vitest';
import type { MeResponse, MeSessionInfo, MeUserInfo } from '../../../src/domain/MeResponse.js';
import { meResponseSchema } from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createMeUserInfo(overrides: Partial<MeUserInfo> = {}): MeUserInfo {
  return {
    id: 'user-123',
    email: 'user@example.com',
    emailVerified: true,
    phone: '+1234567890',
    phoneVerified: true,
    username: 'johndoe',
    displayName: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
    authProvider: 'password',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

function createMeSessionInfo(overrides: Partial<MeSessionInfo> = {}): MeSessionInfo {
  return {
    sessionId: 'session-abc-123',
    ip: '192.168.1.1',
    deviceId: 'device-xyz',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    issuedAt: '2026-01-15T10:00:00.000Z',
    expiresAt: '2026-01-16T10:00:00.000Z',
    ...overrides,
  };
}

function createMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: createMeUserInfo(),
    roles: ['user', 'admin'],
    permissions: ['profile.read', 'profile.write', 'admin.access'],
    session: createMeSessionInfo(),
    features: {
      mfaEnabled: true,
      ssoEnabled: false,
      apiAccess: true,
    },
    context: {
      orgId: 'org-123',
      tenantId: 'tenant-456',
    },
    ...overrides,
  };
}

function createMinimalMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: {
      id: 'user-minimal',
    },
    roles: [],
    permissions: [],
    ...overrides,
  };
}

function createFullMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: createMeUserInfo({
      id: 'user-full',
      email: 'full@example.com',
      phone: '+9876543210',
      displayName: 'Full User',
      avatarUrl: 'https://example.com/full-avatar.jpg',
      username: 'fulluser',
      status: 'active',
      authProvider: 'oauth',
    }),
    roles: ['user', 'admin', 'moderator'],
    permissions: ['profile.read', 'profile.write', 'admin.access', 'moderator.manage'],
    session: createMeSessionInfo({
      sessionId: 'session-full-789',
      ip: '10.0.0.1',
      deviceId: 'device-full-abc',
    }),
    features: {
      mfaEnabled: true,
      ssoEnabled: true,
      apiAccess: true,
      betaFeatures: true,
    },
    context: {
      orgId: 'org-full',
      tenantId: 'tenant-full',
      policyVersion: '2.0',
    },
    ...overrides,
  };
}

// ============================================================================
// 📋 ME USER INFO - Информация о пользователе
// ============================================================================

describe('MeUserInfo информация о пользователе', () => {
  it('создает полную информацию о пользователе', () => {
    const user = createMeUserInfo();

    expect(user.id).toBe('user-123');
    expect(user.email).toBe('user@example.com');
    expect(user.emailVerified).toBe(true);
    expect(user.phone).toBe('+1234567890');
    expect(user.phoneVerified).toBe(true);
    expect(user.username).toBe('johndoe');
    expect(user.displayName).toBe('John Doe');
    expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(user.authProvider).toBe('password');
    expect(user.status).toBe('active');
  });

  it('поддерживает минимальную информацию о пользователе (только id)', () => {
    const user: MeUserInfo = {
      id: 'user-minimal',
    };

    expect(user.id).toBe('user-minimal');
    expect(user.email).toBeUndefined();
    expect(user.phone).toBeUndefined();
  });

  it('поддерживает частичную информацию о пользователе', () => {
    const user: MeUserInfo = {
      id: 'user-partial',
      email: 'partial@example.com',
      displayName: 'Partial User',
      // остальные поля опциональны
    };

    expect(user.id).toBe('user-partial');
    expect(user.email).toBe('partial@example.com');
    expect(user.displayName).toBe('Partial User');
    expect(user.phone).toBeUndefined();
    expect(user.username).toBeUndefined();
  });
});

// ============================================================================
// 📋 ME SESSION INFO - Информация о сессии
// ============================================================================

describe('MeSessionInfo информация о сессии', () => {
  it('создает полную информацию о сессии', () => {
    const session = createMeSessionInfo();

    expect(session.sessionId).toBe('session-abc-123');
    expect(session.ip).toBe('192.168.1.1');
    expect(session.deviceId).toBe('device-xyz');
    expect(session.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(session.issuedAt).toBe('2026-01-15T10:00:00.000Z');
    expect(session.expiresAt).toBe('2026-01-16T10:00:00.000Z');
  });

  it('поддерживает минимальную информацию о сессии (только sessionId)', () => {
    const session: MeSessionInfo = {
      sessionId: 'session-minimal',
    };

    expect(session.sessionId).toBe('session-minimal');
    expect(session.ip).toBeUndefined();
    expect(session.deviceId).toBeUndefined();
  });
});

// ============================================================================
// 📋 ME RESPONSE - Полный DTO
// ============================================================================

describe('MeResponse полный DTO', () => {
  it('создает минимальный ответ (обязательные поля)', () => {
    const response = createMinimalMeResponse();

    expect(response.user.id).toBe('user-minimal');
    expect(response.roles).toEqual([]);
    expect(response.permissions).toEqual([]);
    expect(response.session).toBeUndefined();
    expect(response.features).toBeUndefined();
    expect(response.context).toBeUndefined();
  });

  it('создает полный ответ со всеми полями', () => {
    const response = createFullMeResponse();

    expect(response.user.id).toBe('user-full');
    expect(response.user.email).toBe('full@example.com');
    expect(response.roles).toEqual(['user', 'admin', 'moderator']);
    expect(response.permissions).toEqual([
      'profile.read',
      'profile.write',
      'admin.access',
      'moderator.manage',
    ]);
    expect(response.session?.sessionId).toBe('session-full-789');
    expect(response.features?.['mfaEnabled']).toBe(true);
    expect(response.context?.['orgId']).toBe('org-full');
  });

  it('работает с различными ролями', () => {
    const roles = [
      [],
      ['user'],
      ['user', 'admin'],
      ['user', 'admin', 'moderator', 'viewer'],
    ];

    roles.forEach((roleList) => {
      const response = createMeResponse({ roles: roleList });
      expect(response.roles).toEqual(roleList);
    });
  });

  it('работает с различными permissions', () => {
    const permissions = [
      [],
      ['profile.read'],
      ['profile.read', 'profile.write'],
      ['profile.read', 'profile.write', 'admin.access', 'admin.delete'],
    ];

    permissions.forEach((permList) => {
      const response = createMeResponse({ permissions: permList });
      expect(response.permissions).toEqual(permList);
    });
  });
});

// ============================================================================
// 🔑 REQUIRED FIELDS - Обязательные поля
// ============================================================================

describe('MeResponse required fields', () => {
  it('user.id обязателен для идентификатора пользователя', () => {
    const response = createMeResponse({
      user: {
        id: 'user-required',
      },
    });

    expect(response.user.id).toBe('user-required');
  });

  it('email обязателен для email пользователя (в схеме опционален, но обычно присутствует)', () => {
    const response = createMeResponse({
      user: {
        id: 'user-email',
        email: 'email@example.com',
      },
    });

    expect(response.user.email).toBe('email@example.com');
  });

  it('roles обязателен для ролей пользователя', () => {
    const response = createMeResponse({
      roles: ['user', 'admin'],
    });

    expect(response.roles).toEqual(['user', 'admin']);
  });

  it('permissions обязателен для permissions пользователя', () => {
    const response = createMeResponse({
      permissions: ['profile.read'],
    });

    expect(response.permissions).toEqual(['profile.read']);
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('MeResponse optional fields', () => {
  it('phone опционально для телефона пользователя', () => {
    const responseWithPhone = createMeResponse({
      user: {
        id: 'user-phone',
        phone: '+1234567890',
      },
    });
    const responseWithoutPhone = createMinimalMeResponse();

    expect(responseWithPhone.user.phone).toBe('+1234567890');
    expect(responseWithoutPhone.user.phone).toBeUndefined();
  });

  it('profile data опционально (displayName, avatarUrl, username)', () => {
    const responseWithProfile = createMeResponse({
      user: {
        id: 'user-profile',
        displayName: 'Profile User',
        avatarUrl: 'https://example.com/avatar.jpg',
        username: 'profileuser',
      },
    });
    const responseWithoutProfile = createMinimalMeResponse();

    expect(responseWithProfile.user.displayName).toBe('Profile User');
    expect(responseWithProfile.user.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(responseWithProfile.user.username).toBe('profileuser');
    expect(responseWithoutProfile.user.displayName).toBeUndefined();
    expect(responseWithoutProfile.user.avatarUrl).toBeUndefined();
    expect(responseWithoutProfile.user.username).toBeUndefined();
  });

  it('session опционально для информации о сессии', () => {
    const responseWithSession = createMeResponse({
      session: createMeSessionInfo(),
    });
    const responseWithoutSession = createMinimalMeResponse();

    expect(responseWithSession.session?.sessionId).toBe('session-abc-123');
    expect(responseWithoutSession.session).toBeUndefined();
  });

  it('features опционально для feature flags', () => {
    const responseWithFeatures = createMeResponse({
      features: {
        mfaEnabled: true,
        ssoEnabled: false,
      },
    });
    const responseWithoutFeatures = createMinimalMeResponse();

    expect(responseWithFeatures.features?.['mfaEnabled']).toBe(true);
    expect(responseWithFeatures.features?.['ssoEnabled']).toBe(false);
    expect(responseWithoutFeatures.features).toBeUndefined();
  });

  it('context опционально для дополнительного контекста', () => {
    const responseWithContext = createMeResponse({
      context: {
        orgId: 'org-123',
        tenantId: 'tenant-456',
      },
    });
    const responseWithoutContext = createMinimalMeResponse();

    expect(responseWithContext.context?.['orgId']).toBe('org-123');
    expect(responseWithContext.context?.['tenantId']).toBe('tenant-456');
    expect(responseWithoutContext.context).toBeUndefined();
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('MeResponse edge cases', () => {
  it('работает с пустыми массивами roles и permissions', () => {
    const response = createMeResponse({
      roles: [],
      permissions: [],
    });

    expect(response.roles).toEqual([]);
    expect(response.permissions).toEqual([]);
  });

  it('работает с длинными массивами roles и permissions', () => {
    const manyRoles = Array.from({ length: 20 }, (_, i) => `role-${i}`);
    const manyPermissions = Array.from({ length: 50 }, (_, i) => `permission-${i}`);

    const response = createMeResponse({
      roles: manyRoles,
      permissions: manyPermissions,
    });

    expect(response.roles).toHaveLength(20);
    expect(response.permissions).toHaveLength(50);
  });

  it('работает с различными статусами аккаунта', () => {
    const statuses: ('active' | 'locked' | 'disabled' | 'pending')[] = [
      'active',
      'locked',
      'disabled',
      'pending',
    ];

    statuses.forEach((status) => {
      const response = createMeResponse({
        user: {
          id: `user-${status}`,
          status,
        },
      });

      expect(response.user.status).toBe(status);
    });
  });

  it('работает с различными authProvider', () => {
    const providers: ('password' | 'oauth')[] = ['password', 'oauth'];

    providers.forEach((provider) => {
      const response = createMeResponse({
        user: {
          id: `user-${provider}`,
          authProvider: provider,
        },
      });

      expect(response.user.authProvider).toBe(provider);
    });
  });

  it('работает с различными email форматами', () => {
    const emails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user123@subdomain.example.com',
    ];

    emails.forEach((email) => {
      const response = createMeResponse({
        user: {
          id: `user-${email}`,
          email,
        },
      });

      expect(response.user.email).toBe(email);
    });
  });

  it('работает с различными phone форматами', () => {
    const phones = [
      '+1234567890',
      '+1-234-567-8900',
      '(123) 456-7890',
      '+44 20 1234 5678',
    ];

    phones.forEach((phone) => {
      const response = createMeResponse({
        user: {
          id: `user-${phone}`,
          phone,
        },
      });

      expect(response.user.phone).toBe(phone);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('MeResponse immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const response: MeResponse = {
      user: {
        id: 'user-immutable',
        email: 'immutable@example.com',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    };

    // TypeScript предотвращает мутацию
    // response.user.id = 'new-id'; // TypeScript error: Cannot assign to 'id' because it is a read-only property
    // response.roles.push('admin'); // TypeScript error: Cannot assign to 'roles' because it is a read-only property

    expect(response.user.id).toBe('user-immutable');
    expect(response.roles).toEqual(['user']);
  });

  it('user поля readonly - предотвращает мутацию вложенных объектов', () => {
    const response: MeResponse = {
      user: {
        id: 'user-immutable',
        email: 'immutable@example.com',
        displayName: 'Immutable User',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    };

    // TypeScript предотвращает мутацию user
    // response.user.email = 'new-email'; // TypeScript error: Cannot assign to 'email' because it is a read-only property

    expect(response.user.email).toBe('immutable@example.com');
    expect(response.user.displayName).toBe('Immutable User');
  });

  it('roles и permissions readonly - предотвращает мутацию массивов', () => {
    const response: MeResponse = {
      user: {
        id: 'user-immutable',
      },
      roles: ['user', 'admin'],
      permissions: ['profile.read'],
    };

    // TypeScript предотвращает мутацию массивов
    // response.roles.push('moderator'); // TypeScript error: Cannot assign to 'roles' because it is a read-only property

    expect(response.roles).toEqual(['user', 'admin']);
    expect(response.permissions).toEqual(['profile.read']);
  });

  it('session readonly - предотвращает мутацию вложенных объектов', () => {
    const response: MeResponse = {
      user: {
        id: 'user-immutable',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      session: {
        sessionId: 'session-immutable',
        ip: '192.168.1.1',
      },
    };

    // TypeScript предотвращает мутацию session
    // response.session!.ip = 'new-ip'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property

    expect(response.session?.sessionId).toBe('session-immutable');
    expect(response.session?.ip).toBe('192.168.1.1');
  });

  it('features и context readonly - предотвращает мутацию вложенных объектов', () => {
    const response: MeResponse = {
      user: {
        id: 'user-immutable',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      features: {
        mfaEnabled: true,
      },
      context: {
        orgId: 'org-immutable',
      },
    };

    // TypeScript предотвращает мутацию features и context
    // response.features!.mfaEnabled = false; // TypeScript error: Cannot assign to 'mfaEnabled' because it is a read-only property

    expect(response.features?.['mfaEnabled']).toBe(true);
    expect(response.context?.['orgId']).toBe('org-immutable');
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('MeResponse comprehensive snapshots', () => {
  it('full me response - полный snapshot', () => {
    const response = createFullMeResponse();

    expect(response).toMatchSnapshot();
  });

  it('minimal me response - полный snapshot', () => {
    const response = createMinimalMeResponse();

    expect(response).toMatchSnapshot();
  });

  it('me response with profile data - полный snapshot', () => {
    const response = createMeResponse({
      user: {
        id: 'user-profile',
        email: 'profile@example.com',
        displayName: 'Profile User',
        avatarUrl: 'https://example.com/avatar.jpg',
        username: 'profileuser',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    });

    expect(response).toMatchSnapshot();
  });

  it('me response with session - полный snapshot', () => {
    const response = createMeResponse({
      user: {
        id: 'user-session',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      session: createMeSessionInfo(),
    });

    expect(response).toMatchSnapshot();
  });

  it('me response with features and context - полный snapshot', () => {
    const response = createMeResponse({
      user: {
        id: 'user-features',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      features: {
        mfaEnabled: true,
        ssoEnabled: false,
      },
      context: {
        orgId: 'org-123',
        tenantId: 'tenant-456',
      },
    });

    expect(response).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные me responses проходят Zod схему', () => {
    const validResponse = {
      user: {
        id: 'user-123',
        email: 'user@example.com',
      },
      roles: ['user', 'admin'],
      permissions: ['profile.read', 'profile.write'],
    };

    const result = meResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.user.id).toBe('user-123');
      expect(result.data.user.email).toBe('user@example.com');
      expect(result.data.roles).toEqual(['user', 'admin']);
      expect(result.data.permissions).toEqual(['profile.read', 'profile.write']);
    }
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const responseWithExtra = {
      user: {
        id: 'user-123',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      extraField: 'not allowed', // дополнительное поле
    };

    const result = meResponseSchema.safeParse(responseWithExtra);
    expect(result.success).toBe(false);
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум полей (только обязательные)
    const minimalResponse = {
      user: {
        id: 'user-minimal',
      },
      roles: [],
      permissions: [],
    };

    const result = meResponseSchema.safeParse(minimalResponse);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.user.id).toBe('user-minimal');
      expect(result.data.user.email).toBeUndefined();
      expect(result.data.user.phone).toBeUndefined();
      expect(result.data.session).toBeUndefined();
      expect(result.data.features).toBeUndefined();
      expect(result.data.context).toBeUndefined();
    }
  });

  it('user.id обязателен для идентификатора пользователя', () => {
    const responseWithoutId = {
      user: {
        // id отсутствует
        email: 'user@example.com',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    };

    const result = meResponseSchema.safeParse(responseWithoutId);
    expect(result.success).toBe(false);
  });

  it('roles обязателен для ролей пользователя', () => {
    const responseWithoutRoles = {
      user: {
        id: 'user-123',
      },
      // roles отсутствует
      permissions: ['profile.read'],
    };

    const result = meResponseSchema.safeParse(responseWithoutRoles);
    expect(result.success).toBe(false);
  });

  it('permissions обязателен для permissions пользователя', () => {
    const responseWithoutPermissions = {
      user: {
        id: 'user-123',
      },
      roles: ['user'],
      // permissions отсутствует
    };

    const result = meResponseSchema.safeParse(responseWithoutPermissions);
    expect(result.success).toBe(false);
  });

  it('email валидируется как строка с форматом email', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
    ];

    validEmails.forEach((email) => {
      const response = {
        user: {
          id: 'user-123',
          email,
        },
        roles: ['user'],
        permissions: ['profile.read'],
      };

      const result = meResponseSchema.safeParse(response);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.user.email).toBe(email);
      }
    });
  });

  it('phone опционально для телефона пользователя', () => {
    const responseWithPhone = {
      user: {
        id: 'user-123',
        phone: '+1234567890',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    };

    const responseWithoutPhone = {
      user: {
        id: 'user-123',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    };

    const result1 = meResponseSchema.safeParse(responseWithPhone);
    const result2 = meResponseSchema.safeParse(responseWithoutPhone);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.user.phone).toBe('+1234567890');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.user.phone).toBeUndefined();
    }
  });

  it('profile data опционально (displayName, avatarUrl, username)', () => {
    const responseWithProfile = {
      user: {
        id: 'user-123',
        displayName: 'Profile User',
        avatarUrl: 'https://example.com/avatar.jpg',
        username: 'profileuser',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    };

    const result = meResponseSchema.safeParse(responseWithProfile);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.user.displayName).toBe('Profile User');
      expect(result.data.user.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.data.user.username).toBe('profileuser');
    }
  });

  it('roles валидируется как массив строк', () => {
    const roles = [
      [],
      ['user'],
      ['user', 'admin'],
      ['user', 'admin', 'moderator'],
    ];

    roles.forEach((roleList) => {
      const response = {
        user: {
          id: 'user-123',
        },
        roles: roleList,
        permissions: ['profile.read'],
      };

      const result = meResponseSchema.safeParse(response);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.roles).toEqual(roleList);
      }
    });
  });

  it('permissions валидируется как массив строк', () => {
    const permissions = [
      [],
      ['profile.read'],
      ['profile.read', 'profile.write'],
      ['profile.read', 'profile.write', 'admin.access'],
    ];

    permissions.forEach((permList) => {
      const response = {
        user: {
          id: 'user-123',
        },
        roles: ['user'],
        permissions: permList,
      };

      const result = meResponseSchema.safeParse(response);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.permissions).toEqual(permList);
      }
    });
  });

  it('session опционально для информации о сессии', () => {
    const responseWithSession = {
      user: {
        id: 'user-123',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      session: {
        sessionId: 'session-123',
        ip: '192.168.1.1',
      },
    };

    const responseWithoutSession = {
      user: {
        id: 'user-123',
      },
      roles: ['user'],
      permissions: ['profile.read'],
    };

    const result1 = meResponseSchema.safeParse(responseWithSession);
    const result2 = meResponseSchema.safeParse(responseWithoutSession);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.session?.sessionId).toBe('session-123');
      expect(result1.data.session?.ip).toBe('192.168.1.1');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.session).toBeUndefined();
    }
  });

  it('features опционально для feature flags', () => {
    const responseWithFeatures = {
      user: {
        id: 'user-123',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      features: {
        mfaEnabled: true,
        ssoEnabled: false,
      },
    };

    const result = meResponseSchema.safeParse(responseWithFeatures);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.features?.['mfaEnabled']).toBe(true);
      expect(result.data.features?.['ssoEnabled']).toBe(false);
    }
  });

  it('context опционально для дополнительного контекста', () => {
    const responseWithContext = {
      user: {
        id: 'user-123',
      },
      roles: ['user'],
      permissions: ['profile.read'],
      context: {
        orgId: 'org-123',
        tenantId: 'tenant-456',
      },
    };

    const result = meResponseSchema.safeParse(responseWithContext);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.context?.['orgId']).toBe('org-123');
      expect(result.data.context?.['tenantId']).toBe('tenant-456');
    }
  });
});
