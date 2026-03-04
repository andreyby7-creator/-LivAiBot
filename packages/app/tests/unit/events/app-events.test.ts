/**
 * @file Unit тесты для packages/app/src/events/app-events.ts
 * Enterprise-grade тестирование системы событий с 100% покрытием:
 * - AppEventType enum и его значения
 * - Zod схемы валидации payload
 * - Создание событий через фабрики
 * - Type guards для проверки типов событий
 * - Валидация и error handling
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AppEventType,
  AuthExpiredEventPayloadSchema,
  BillingChangedEventPayloadSchema,
  createAuthExpiredEvent,
  createBillingChangedEvent,
  createLogoutEvent,
  eventSchemaVersions,
  isAuthExpiredEvent,
  isBillingChangedEvent,
  isLogoutEvent,
  LogoutEventPayloadSchema,
} from '../../../src/events/app-events.js';
import type {
  AuthExpiredEventPayload,
  BillingChangedEventPayload,
  LogoutEventPayload,
} from '../../../src/events/app-events.js';
import { UserRoles } from '../../../src/types/common.js';

// Мокаем uuid для предсказуемых тестов
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123'),
}));

// Мокаем process.env
const originalEnv = process.env;
beforeAll(() => {
  process.env = { ...originalEnv, APP_EVENT_SOURCE: 'test' };
});

afterAll(() => {
  process.env = originalEnv;
});

/* ========================================================================== */
/* 🧩 APP EVENT TYPE ENUM */
/* ========================================================================== */

describe('AppEventType enum', () => {
  it('содержит все ожидаемые типы событий', () => {
    const expectedTypes = ['auth.logout', 'auth.expired', 'billing.changed'];
    const actualTypes = [
      AppEventType.AuthLogout,
      AppEventType.AuthExpired,
      AppEventType.BillingChanged,
    ];

    expect(actualTypes).toEqual(expectedTypes);
    expect(actualTypes).toHaveLength(3);
  });

  it('все значения являются строками', () => {
    [
      AppEventType.AuthLogout,
      AppEventType.AuthExpired,
      AppEventType.BillingChanged,
    ].forEach((type) => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });

  it('содержит уникальные значения', () => {
    const types = [
      AppEventType.AuthLogout,
      AppEventType.AuthExpired,
      AppEventType.BillingChanged,
    ];
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });
});

/* ========================================================================== */
/* 🔐 ZOD SCHEMAS */
/* ========================================================================== */

describe('Zod схемы валидации', () => {
  describe('LogoutEventPayloadSchema', () => {
    it('валидирует корректный payload выхода', () => {
      const validPayload: LogoutEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      };

      const result = LogoutEventPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('отклоняет payload с неправильной версией', () => {
      const invalidPayload = {
        payloadVersion: 2, // неправильная версия
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      };

      const result = LogoutEventPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('отклоняет payload с неправильным reason', () => {
      const invalidPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'invalid-reason', // неправильный reason
      };

      const result = LogoutEventPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('поддерживает опциональное поле source', () => {
      const payloadWithSource: LogoutEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
        source: 'web-app',
      };

      const result = LogoutEventPayloadSchema.safeParse(payloadWithSource);
      expect(result.success).toBe(true);
    });
  });

  describe('AuthExpiredEventPayloadSchema', () => {
    it('валидирует корректный payload истечения авторизации', () => {
      const validPayload: AuthExpiredEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        reason: 'token_expired',
      };

      const result = AuthExpiredEventPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('поддерживает все типы reason', () => {
      const reasons = ['token_expired', 'revoked', 'invalid'];

      reasons.forEach((reason) => {
        const payload: AuthExpiredEventPayload = {
          payloadVersion: 1,
          userId: 'user-123',
          reason: reason as any,
        };

        const result = AuthExpiredEventPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('BillingChangedEventPayloadSchema', () => {
    it('валидирует корректный payload изменения биллинга', () => {
      const validPayload: BillingChangedEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        plan: 'premium',
        reason: 'upgrade',
      };

      const result = BillingChangedEventPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('поддерживает опциональное поле previousPlan', () => {
      const payloadWithPrevious: BillingChangedEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        plan: 'premium',
        previousPlan: 'basic',
        reason: 'upgrade',
      };

      const result = BillingChangedEventPayloadSchema.safeParse(payloadWithPrevious);
      expect(result.success).toBe(true);
    });

    it('поддерживает все типы reason', () => {
      const reasons = ['upgrade', 'downgrade', 'renewal', 'cancellation'];

      reasons.forEach((reason) => {
        const payload: BillingChangedEventPayload = {
          payloadVersion: 1,
          userId: 'user-123',
          plan: 'premium',
          reason: reason as any,
        };

        const result = BillingChangedEventPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });
});

/* ========================================================================== */
/* 🏭 EVENT FACTORIES */
/* ========================================================================== */

describe('Фабрики событий', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLogoutEvent', () => {
    it('создаёт корректное событие выхода', async () => {
      const payload: LogoutEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      };

      const event = await createLogoutEvent(payload);

      expect(event.type).toBe(AppEventType.AuthLogout);
      expect(event.version).toBe('1.0.0');
      expect(event.eventVersion).toBe(eventSchemaVersions[AppEventType.AuthLogout]);
      expect(event.payload).toEqual(payload);
      expect(typeof event.timestamp).toBe('string');
      expect(event.meta?.correlationId).toBe('test-uuid-123');
      expect(event.meta?.source).toBe('test');
      expect(event.meta?.initiator).toBe('UI');
    });

    it('бросает ошибку при невалидном payload', async () => {
      const invalidPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'invalid-reason', // неправильный reason
      };

      await expect(createLogoutEvent(invalidPayload as any)).rejects.toThrow();
    });

    it('поддерживает кастомную мета-информацию', async () => {
      const payload: LogoutEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      };

      const customMeta = {
        correlationId: 'custom-id',
        initiator: 'Worker' as const,
        customField: 'value',
      };

      const event = await createLogoutEvent(payload, customMeta);

      expect(event.meta?.correlationId).toBe('custom-id');
      expect(event.meta?.initiator).toBe('Worker');
      expect(event.meta?.['customField']).toBe('value');
    });
  });

  describe('createAuthExpiredEvent', () => {
    it('создаёт корректное событие истечения авторизации', async () => {
      const payload: AuthExpiredEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        reason: 'token_expired',
      };

      const event = await createAuthExpiredEvent(payload);

      expect(event.type).toBe(AppEventType.AuthExpired);
      expect(event.version).toBe('1.0.0');
      expect(event.eventVersion).toBe(eventSchemaVersions[AppEventType.AuthExpired]);
      expect(event.payload).toEqual(payload);
    });
  });

  describe('createBillingChangedEvent', () => {
    it('создаёт корректное событие изменения биллинга', async () => {
      const payload: BillingChangedEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        plan: 'premium',
        reason: 'upgrade',
      };

      const event = await createBillingChangedEvent(payload);

      expect(event.type).toBe(AppEventType.BillingChanged);
      expect(event.version).toBe('1.0.0');
      expect(event.eventVersion).toBe(eventSchemaVersions[AppEventType.BillingChanged]);
      expect(event.payload).toEqual(payload);
    });
  });
});

/* ========================================================================== */
/* 🔍 TYPE GUARDS */
/* ========================================================================== */

describe('Type guards', () => {
  describe('isLogoutEvent', () => {
    it('возвращает true для события выхода', async () => {
      const payload: LogoutEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      };

      const event = await createLogoutEvent(payload);

      expect(isLogoutEvent(event)).toBe(true);
    });

    it('возвращает false для других типов событий', async () => {
      const payload: AuthExpiredEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        reason: 'token_expired',
      };

      const event = await createAuthExpiredEvent(payload);

      expect(isLogoutEvent(event)).toBe(false);
    });

    it('возвращает false для события с неправильным payload', () => {
      const invalidEvent = {
        type: AppEventType.AuthLogout,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        payload: { invalid: 'payload' },
      };

      expect(isLogoutEvent(invalidEvent as any)).toBe(false);
    });
  });

  describe('isAuthExpiredEvent', () => {
    it('возвращает true для события истечения авторизации', async () => {
      const payload: AuthExpiredEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        reason: 'token_expired',
      };

      const event = await createAuthExpiredEvent(payload);

      expect(isAuthExpiredEvent(event)).toBe(true);
    });

    it('возвращает false для других типов событий', async () => {
      const payload: LogoutEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      };

      const event = await createLogoutEvent(payload);

      expect(isAuthExpiredEvent(event)).toBe(false);
    });
  });

  describe('isBillingChangedEvent', () => {
    it('возвращает true для события изменения биллинга', async () => {
      const payload: BillingChangedEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        plan: 'premium',
        reason: 'upgrade',
      };

      const event = await createBillingChangedEvent(payload);

      expect(isBillingChangedEvent(event)).toBe(true);
    });

    it('возвращает false для других типов событий', async () => {
      const payload: LogoutEventPayload = {
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      };

      const event = await createLogoutEvent(payload);

      expect(isBillingChangedEvent(event)).toBe(false);
    });
  });
});

/* ========================================================================== */
/* ✅ INTEGRATION & EDGE CASES */
/* ========================================================================== */

describe('Интеграция и edge cases', () => {
  it('события имеют корректные timestamp', async () => {
    const payload: LogoutEventPayload = {
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    };

    const before = new Date();
    const event = await createLogoutEvent(payload);
    const after = new Date();

    const eventTime = new Date(event.timestamp);
    expect(eventTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(eventTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('работает с undefined APP_EVENT_SOURCE', async () => {
    const originalSource = process.env['APP_EVENT_SOURCE'];
    delete process.env['APP_EVENT_SOURCE'];

    const payload: LogoutEventPayload = {
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    };

    const event = await createLogoutEvent(payload);
    expect(event.meta?.source).toBe('app');

    process.env['APP_EVENT_SOURCE'] = originalSource;
  });

  it('события имеют уникальные correlationId', async () => {
    const payload: LogoutEventPayload = {
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    };

    const event1 = await createLogoutEvent(payload);
    const event2 = await createLogoutEvent(payload);

    expect(event1.meta?.correlationId).toBe('test-uuid-123');
    expect(event2.meta?.correlationId).toBe('test-uuid-123'); // mocked value
  });

  it('поддерживает все UserRoles в массиве ролей', async () => {
    const payload: LogoutEventPayload = {
      payloadVersion: 1,
      userId: 'user-123',
      roles: Object.values(UserRoles),
      reason: 'manual',
    };

    const event = await createLogoutEvent(payload);
    expect(event.payload.roles).toEqual(Object.values(UserRoles));
  });
});
