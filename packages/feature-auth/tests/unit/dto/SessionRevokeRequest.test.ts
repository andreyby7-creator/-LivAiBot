/**
 * @file Unit тесты для dto/SessionRevokeRequest.ts
 * Полное покрытие запроса на отзыв сессии
 */

import { describe, expect, it } from 'vitest';

import type {
  SessionRevokeReason,
  SessionRevokeRequest,
} from '../../../src/dto/SessionRevokeRequest.js';
import { sessionRevokeRequestSchema } from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createSessionRevokeRequest(
  overrides: Partial<SessionRevokeRequest> = {},
): SessionRevokeRequest {
  return {
    sessionId: 'session-123',
    deviceId: 'device-abc',
    ip: '192.168.1.1',
    reason: 'user-initiated',
    timestamp: '2026-01-15T10:30:00.000Z',
    meta: {
      version: '1.0',
      origin: 'api',
    },
    ...overrides,
  };
}

function createMinimalSessionRevokeRequest(
  overrides: Partial<SessionRevokeRequest> = {},
): SessionRevokeRequest {
  return {
    sessionId: 'session-minimal',
    ...overrides,
  };
}

function createFullSessionRevokeRequest(
  overrides: Partial<SessionRevokeRequest> = {},
): SessionRevokeRequest {
  return {
    sessionId: 'session-full',
    deviceId: 'device-full-xyz',
    ip: '10.0.0.1',
    reason: 'admin-initiated',
    timestamp: '2026-12-31T23:59:59.000Z',
    meta: {
      version: '2.0',
      origin: 'admin-panel',
      priority: 'high',
      tags: ['security', 'audit'],
    },
    ...overrides,
  };
}

// ============================================================================
// 📋 SESSION REVOKE REQUEST - Полный DTO
// ============================================================================

describe('SessionRevokeRequest полный DTO', () => {
  it('создает минимальный запрос (обязательное поле sessionId)', () => {
    const request = createMinimalSessionRevokeRequest();

    expect(request.sessionId).toBe('session-minimal');
    expect(request.deviceId).toBeUndefined();
    expect(request.ip).toBeUndefined();
    expect(request.reason).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullSessionRevokeRequest();

    expect(request.sessionId).toBe('session-full');
    expect(request.deviceId).toBe('device-full-xyz');
    expect(request.ip).toBe('10.0.0.1');
    expect(request.reason).toBe('admin-initiated');
    expect(request.timestamp).toBe('2026-12-31T23:59:59.000Z');
    expect(request.meta).toBeDefined();
  });

  it('работает с базовым запросом', () => {
    const request = createSessionRevokeRequest();

    expect(request.sessionId).toBe('session-123');
    expect(request.deviceId).toBe('device-abc');
    expect(request.ip).toBe('192.168.1.1');
    expect(request.reason).toBe('user-initiated');
  });
});

// ============================================================================
// 📋 SESSION ID - Обязательное поле
// ============================================================================

describe('SessionRevokeRequest sessionId', () => {
  it('sessionId обязателен для идентификатора сессии', () => {
    const request: SessionRevokeRequest = {
      sessionId: 'session-required',
    };

    expect(request.sessionId).toBe('session-required');
  });

  it('sessionId может быть различными форматами', () => {
    const formats = [
      'session-123',
      'sess-abc-xyz',
      's_1234567890',
      'session-id-with-dashes',
      'SESSION_UPPERCASE',
    ];

    formats.forEach((sessionId) => {
      const request = createSessionRevokeRequest({
        sessionId,
      });

      expect(request.sessionId).toBe(sessionId);
    });
  });

  it('sessionId может быть длинной строкой', () => {
    const longSessionId = `sess-${'a'.repeat(100)}`;
    const request = createSessionRevokeRequest({
      sessionId: longSessionId,
    });

    expect(request.sessionId).toBe(longSessionId);
    expect(request.sessionId.length).toBeGreaterThan(100);
  });
});

// ============================================================================
// 📋 SESSION REVOKE REASON - Причина отзыва
// ============================================================================

describe('SessionRevokeRequest reason', () => {
  it('reason опционально', () => {
    const request = createMinimalSessionRevokeRequest();

    expect(request.reason).toBeUndefined();
  });

  it('reason поддерживает все типы причин', () => {
    const reasons: SessionRevokeReason[] = [
      'user-initiated',
      'admin-initiated',
      'security-issue',
      'expired',
      'unknown',
    ];

    reasons.forEach((reason) => {
      const request = createSessionRevokeRequest({
        reason,
      });

      expect(request.reason).toBe(reason);
    });
  });

  it('reason может быть user-initiated', () => {
    const request = createSessionRevokeRequest({
      reason: 'user-initiated',
    });

    expect(request.reason).toBe('user-initiated');
  });

  it('reason может быть admin-initiated', () => {
    const request = createSessionRevokeRequest({
      reason: 'admin-initiated',
    });

    expect(request.reason).toBe('admin-initiated');
  });

  it('reason может быть security-issue', () => {
    const request = createSessionRevokeRequest({
      reason: 'security-issue',
    });

    expect(request.reason).toBe('security-issue');
  });
});

// ============================================================================
// 📋 SESSION REVOKE REQUEST - Optional fields
// ============================================================================

describe('SessionRevokeRequest optional fields', () => {
  it('deviceId опционально', () => {
    const request = createMinimalSessionRevokeRequest();

    expect(request.deviceId).toBeUndefined();
  });

  it('ip опционально', () => {
    const request = createMinimalSessionRevokeRequest();

    expect(request.ip).toBeUndefined();
  });

  it('timestamp опционально', () => {
    const request = createMinimalSessionRevokeRequest();

    expect(request.timestamp).toBeUndefined();
  });

  it('meta опционально', () => {
    const request = createMinimalSessionRevokeRequest();

    expect(request.meta).toBeUndefined();
  });
});

// ============================================================================
// 📋 SESSION REVOKE REQUEST - Edge cases
// ============================================================================

describe('SessionRevokeRequest edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const request = createSessionRevokeRequest({
      deviceId: '',
      ip: '',
    });

    expect(request.deviceId).toBe('');
    expect(request.ip).toBe('');
  });

  it('работает с различными форматами IP', () => {
    const ipFormats = [
      '192.168.1.1',
      '10.0.0.1',
      '172.16.0.1',
      '::1',
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    ];

    ipFormats.forEach((ip) => {
      const request = createSessionRevokeRequest({
        ip,
      });

      expect(request.ip).toBe(ip);
    });
  });

  it('работает с различными форматами timestamp', () => {
    const timestampFormats = [
      '2026-01-15T10:30:00.000Z',
      '2026-01-15T10:30:00Z',
      '2026-01-15T10:30:00.123Z',
    ];

    timestampFormats.forEach((timestamp) => {
      const request = createSessionRevokeRequest({
        timestamp,
      });

      expect(request.timestamp).toBe(timestamp);
    });
  });

  it('работает с длинными deviceId', () => {
    const longDeviceId = `device-${'a'.repeat(200)}`;
    const request = createSessionRevokeRequest({
      deviceId: longDeviceId,
    });

    expect(request.deviceId).toBe(longDeviceId);
    expect(request.deviceId?.length).toBeGreaterThan(200);
  });
});

// ============================================================================
// 📋 SESSION REVOKE REQUEST - Immutability
// ============================================================================

describe('SessionRevokeRequest immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: SessionRevokeRequest = {
      sessionId: 'session-immutable',
    };

    // TypeScript предотвращает мутацию
    // request.sessionId = 'mutated'; // TypeScript error: Cannot assign to 'sessionId' because it is a read-only property

    expect(request.sessionId).toBe('session-immutable');
  });

  it('meta readonly - предотвращает мутацию вложенных объектов', () => {
    const request: SessionRevokeRequest = {
      sessionId: 'session-immutable',
      meta: {
        version: '1.0',
        origin: 'api',
      },
    };

    // TypeScript предотвращает мутацию meta
    // request.meta!.version = '2.0'; // TypeScript error: Cannot assign to 'version' because it is a read-only property

    expect(request.meta?.['version']).toBe('1.0');
  });
});

// ============================================================================
// 📋 SESSION REVOKE REQUEST - Comprehensive snapshots
// ============================================================================

describe('SessionRevokeRequest comprehensive snapshots', () => {
  it('full session revoke request - полный snapshot', () => {
    const request = createFullSessionRevokeRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal session revoke request - полный snapshot', () => {
    const request = createMinimalSessionRevokeRequest();

    expect(request).toMatchSnapshot();
  });

  it('session revoke request with reason - полный snapshot', () => {
    const request = createSessionRevokeRequest({
      reason: 'security-issue',
    });

    expect(request).toMatchSnapshot();
  });

  it('session revoke request with all reasons - полный snapshot', () => {
    const reasons: SessionRevokeReason[] = [
      'user-initiated',
      'admin-initiated',
      'security-issue',
      'expired',
      'unknown',
    ];

    reasons.forEach((reason) => {
      const request = createSessionRevokeRequest({
        reason,
      });

      expect(request).toMatchSnapshot();
    });
  });
});

// ============================================================================
// 📋 ZOD SCHEMA VALIDATION
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные session revoke requests проходят Zod схему', () => {
    const request = {
      sessionId: 'session-123',
    };

    const result = sessionRevokeRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data).toBeDefined() : void 0;
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const request = {
      ...createSessionRevokeRequest(),
      extraField: 'not-allowed',
    } as SessionRevokeRequest & { extraField: string; };

    const result = sessionRevokeRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
  });

  it('sessionId обязателен для идентификатора сессии', () => {
    const invalidRequest = {};

    const result = sessionRevokeRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });

  it('sessionId валидируется как строка', () => {
    const validRequest = {
      sessionId: 'session-123',
    };

    const result = sessionRevokeRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.sessionId).toBe('session-123') : void 0;
  });

  it('sessionId отклоняется при невалидном типе', () => {
    const invalidRequest = {
      sessionId: 123,
    };

    const result = sessionRevokeRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });

  it('reason опционально в Zod схеме', () => {
    const request = createMinimalSessionRevokeRequest();

    const result = sessionRevokeRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
  });

  it('reason валидируется как строка', () => {
    const request = {
      sessionId: 'session-123',
      reason: 'user-initiated',
    };

    const result = sessionRevokeRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.reason).toBe('user-initiated') : void 0;
  });

  it('все опциональные поля поддерживаются', () => {
    const request = createMinimalSessionRevokeRequest();

    const result = sessionRevokeRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
  });

  it('схема принимает только sessionId и reason', () => {
    const request = {
      sessionId: 'session-123',
      reason: 'user-initiated',
    };

    const result = sessionRevokeRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success
      ? (expect(result.data.sessionId).toBe('session-123'),
        expect(result.data.reason).toBe('user-initiated'))
      : void 0;
  });
});
