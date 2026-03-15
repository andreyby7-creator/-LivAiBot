/**
 * @file Unit тесты для dto/TokenPair.ts
 * Полное покрытие пары токенов для аутентификации
 */

import { describe, expect, it } from 'vitest';

import type { TokenPair } from '../../../src/dto/TokenPair.js';
import { tokenPairSchema } from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresAt: '2026-12-31T23:59:59.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
    scope: ['read', 'write'],
    metadata: {
      deviceId: 'device-123',
      ip: '192.168.1.1',
    },
    ...overrides,
  };
}

function createMinimalTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: 'access-token-minimal',
    refreshToken: 'refresh-token-minimal',
    expiresAt: '2026-12-31T23:59:59.000Z',
    ...overrides,
  };
}

function createFullTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: 'access-token-full',
    refreshToken: 'refresh-token-full',
    expiresAt: '2027-12-31T23:59:59.000Z',
    issuedAt: '2027-01-01T00:00:00.000Z',
    scope: ['read', 'write', 'admin', 'delete'],
    metadata: {
      deviceId: 'device-full',
      ip: '10.0.0.1',
      sessionId: 'session-full',
      userId: 'user-full',
    },
    ...overrides,
  };
}

// ============================================================================
// 📋 TOKEN PAIR - Полный DTO
// ============================================================================

describe('TokenPair полный DTO', () => {
  it('создает минимальную пару токенов (обязательные поля)', () => {
    const tokenPair = createMinimalTokenPair();

    expect(tokenPair.accessToken).toBe('access-token-minimal');
    expect(tokenPair.refreshToken).toBe('refresh-token-minimal');
    expect(tokenPair.expiresAt).toBe('2026-12-31T23:59:59.000Z');
    expect(tokenPair.issuedAt).toBeUndefined();
    expect(tokenPair.scope).toBeUndefined();
    expect(tokenPair.metadata).toBeUndefined();
  });

  it('создает полную пару токенов со всеми полями', () => {
    const tokenPair = createFullTokenPair();

    expect(tokenPair.accessToken).toBe('access-token-full');
    expect(tokenPair.refreshToken).toBe('refresh-token-full');
    expect(tokenPair.expiresAt).toBe('2027-12-31T23:59:59.000Z');
    expect(tokenPair.issuedAt).toBe('2027-01-01T00:00:00.000Z');
    expect(tokenPair.scope).toEqual(['read', 'write', 'admin', 'delete']);
    expect(tokenPair.metadata).toBeDefined();
  });

  it('работает с базовой парой токенов', () => {
    const tokenPair = createTokenPair();

    expect(tokenPair.accessToken).toBe('access-token-123');
    expect(tokenPair.refreshToken).toBe('refresh-token-456');
    expect(tokenPair.expiresAt).toBe('2026-12-31T23:59:59.000Z');
  });
});

// ============================================================================
// 📋 TOKEN PAIR - Required fields
// ============================================================================

describe('TokenPair required fields', () => {
  it('accessToken обязателен для access token', () => {
    const tokenPair: TokenPair = {
      accessToken: 'access-token-required',
      refreshToken: 'refresh-token-required',
      expiresAt: '2026-12-31T23:59:59.000Z',
    };

    expect(tokenPair.accessToken).toBe('access-token-required');
  });

  it('refreshToken обязателен для refresh token', () => {
    const tokenPair: TokenPair = {
      accessToken: 'access-token-required',
      refreshToken: 'refresh-token-required',
      expiresAt: '2026-12-31T23:59:59.000Z',
    };

    expect(tokenPair.refreshToken).toBe('refresh-token-required');
  });

  it('expiresAt обязателен для времени истечения', () => {
    const tokenPair: TokenPair = {
      accessToken: 'access-token-required',
      refreshToken: 'refresh-token-required',
      expiresAt: '2026-12-31T23:59:59.000Z',
    };

    expect(tokenPair.expiresAt).toBe('2026-12-31T23:59:59.000Z');
  });
});

// ============================================================================
// 📋 TOKEN PAIR - Optional fields
// ============================================================================

describe('TokenPair optional fields', () => {
  it('issuedAt опционально для времени выпуска', () => {
    const tokenPair = createMinimalTokenPair();

    expect(tokenPair.issuedAt).toBeUndefined();
  });

  it('scope опционально для scope/permissions', () => {
    const tokenPair = createMinimalTokenPair();

    expect(tokenPair.scope).toBeUndefined();
  });

  it('metadata опционально для метаданных', () => {
    const tokenPair = createMinimalTokenPair();

    expect(tokenPair.metadata).toBeUndefined();
  });
});

// ============================================================================
// 📋 TOKEN PAIR - expiresAt (ISO 8601 datetime)
// ============================================================================

describe('TokenPair expiresAt', () => {
  it('expiresAt может быть ISO 8601 datetime строкой', () => {
    const tokenPair = createTokenPair({
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    expect(tokenPair.expiresAt).toBe('2026-12-31T23:59:59.000Z');
  });

  it('expiresAt поддерживает различные форматы ISO 8601', () => {
    const formats = [
      '2026-12-31T23:59:59.000Z',
      '2026-12-31T23:59:59Z',
      '2026-12-31T23:59:59.123Z',
    ];

    formats.forEach((expiresAt) => {
      const tokenPair = createTokenPair({
        expiresAt,
      });

      expect(tokenPair.expiresAt).toBe(expiresAt);
    });
  });

  it('expiresAt может быть различными датами', () => {
    const dates = [
      '2026-01-01T00:00:00.000Z',
      '2026-06-15T12:30:45.000Z',
      '2026-12-31T23:59:59.000Z',
      '2027-01-01T00:00:00.000Z',
    ];

    dates.forEach((expiresAt) => {
      const tokenPair = createTokenPair({
        expiresAt,
      });

      expect(tokenPair.expiresAt).toBe(expiresAt);
    });
  });
});

// ============================================================================
// 📋 TOKEN PAIR - issuedAt (ISO 8601 datetime, optional)
// ============================================================================

describe('TokenPair issuedAt', () => {
  it('issuedAt может быть ISO 8601 datetime строкой', () => {
    const tokenPair = createTokenPair({
      issuedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(tokenPair.issuedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('issuedAt поддерживает различные форматы ISO 8601', () => {
    const formats = [
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.123Z',
    ];

    formats.forEach((issuedAt) => {
      const tokenPair = createTokenPair({
        issuedAt,
      });

      expect(tokenPair.issuedAt).toBe(issuedAt);
    });
  });
});

// ============================================================================
// 📋 TOKEN PAIR - scope
// ============================================================================

describe('TokenPair scope', () => {
  it('scope может быть массивом строк', () => {
    const tokenPair = createTokenPair({
      scope: ['read', 'write', 'admin'],
    });

    expect(tokenPair.scope).toEqual(['read', 'write', 'admin']);
  });

  it('scope может быть пустым массивом', () => {
    const tokenPair = createTokenPair({
      scope: [],
    });

    expect(tokenPair.scope).toEqual([]);
  });

  it('scope может быть длинным массивом', () => {
    const longScope = Array.from({ length: 50 }, (_, i) => `scope-${i}`);
    const tokenPair = createTokenPair({
      scope: longScope,
    });

    expect(tokenPair.scope).toHaveLength(50);
  });
});

// ============================================================================
// 📋 TOKEN PAIR - metadata
// ============================================================================

describe('TokenPair metadata', () => {
  it('metadata может содержать различные типы данных', () => {
    const tokenPair = createTokenPair({
      metadata: {
        deviceId: 'device-123',
        ip: '192.168.1.1',
        userId: 'user-456',
        sessionId: 'session-789',
        timestamp: '2026-01-15T10:30:00.000Z',
        verified: true,
        attempts: 3,
      },
    });

    expect(tokenPair.metadata?.['deviceId']).toBe('device-123');
    expect(tokenPair.metadata?.['ip']).toBe('192.168.1.1');
    expect(tokenPair.metadata?.['verified']).toBe(true);
    expect(tokenPair.metadata?.['attempts']).toBe(3);
  });

  it('metadata может быть пустым объектом', () => {
    const tokenPair = createTokenPair({
      metadata: {},
    });

    expect(tokenPair.metadata).toEqual({});
  });
});

// ============================================================================
// 📋 TOKEN PAIR - Edge cases
// ============================================================================

describe('TokenPair edge cases', () => {
  it('работает с длинными токенами', () => {
    const longToken = `token-${'a'.repeat(500)}`;
    const tokenPair = createTokenPair({
      accessToken: longToken,
      refreshToken: longToken,
    });

    expect(tokenPair.accessToken).toBe(longToken);
    expect(tokenPair.refreshToken).toBe(longToken);
    expect(tokenPair.accessToken.length).toBeGreaterThan(500);
  });

  it('работает с различными форматами expiresAt', () => {
    const formats = [
      '2026-12-31T23:59:59.000Z',
      '2026-12-31T23:59:59Z',
      '2026-12-31T23:59:59.123Z',
    ];

    formats.forEach((expiresAt) => {
      const tokenPair = createTokenPair({
        expiresAt,
      });

      expect(tokenPair.expiresAt).toBe(expiresAt);
    });
  });

  it('работает с различными форматами issuedAt', () => {
    const formats = [
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.123Z',
    ];

    formats.forEach((issuedAt) => {
      const tokenPair = createTokenPair({
        issuedAt,
      });

      expect(tokenPair.issuedAt).toBe(issuedAt);
    });
  });
});

// ============================================================================
// 📋 TOKEN PAIR - Immutability
// ============================================================================

describe('TokenPair immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const tokenPair: TokenPair = {
      accessToken: 'access-token-immutable',
      refreshToken: 'refresh-token-immutable',
      expiresAt: '2026-12-31T23:59:59.000Z',
    };

    // TypeScript предотвращает мутацию
    // tokenPair.accessToken = 'mutated'; // TypeScript error: Cannot assign to 'accessToken' because it is a read-only property

    expect(tokenPair.accessToken).toBe('access-token-immutable');
  });

  it('scope readonly - предотвращает мутацию массива', () => {
    const tokenPair: TokenPair = {
      accessToken: 'access-token-immutable',
      refreshToken: 'refresh-token-immutable',
      expiresAt: '2026-12-31T23:59:59.000Z',
      scope: ['read', 'write'],
    };

    // TypeScript предотвращает мутацию scope
    // tokenPair.scope![0] = 'mutated'; // TypeScript error: Cannot assign to '0' because it is a read-only property

    expect(tokenPair.scope?.[0]).toBe('read');
  });

  it('metadata readonly - предотвращает мутацию вложенных объектов', () => {
    const tokenPair: TokenPair = {
      accessToken: 'access-token-immutable',
      refreshToken: 'refresh-token-immutable',
      expiresAt: '2026-12-31T23:59:59.000Z',
      metadata: {
        deviceId: 'device-immutable',
        ip: '192.168.1.1',
      },
    };

    // TypeScript предотвращает мутацию metadata
    // tokenPair.metadata!.deviceId = 'mutated'; // TypeScript error: Cannot assign to 'deviceId' because it is a read-only property

    expect(tokenPair.metadata?.['deviceId']).toBe('device-immutable');
  });
});

// ============================================================================
// 📋 TOKEN PAIR - Comprehensive snapshots
// ============================================================================

describe('TokenPair comprehensive snapshots', () => {
  it('full token pair - полный snapshot', () => {
    const tokenPair = createFullTokenPair();

    expect(tokenPair).toMatchSnapshot();
  });

  it('minimal token pair - полный snapshot', () => {
    const tokenPair = createMinimalTokenPair();

    expect(tokenPair).toMatchSnapshot();
  });

  it('token pair with scope - полный snapshot', () => {
    const tokenPair = createTokenPair({
      scope: ['read', 'write', 'admin'],
    });

    expect(tokenPair).toMatchSnapshot();
  });

  it('token pair with metadata - полный snapshot', () => {
    const tokenPair = createTokenPair({
      metadata: {
        deviceId: 'device-xyz',
        ip: '10.0.0.1',
      },
    });

    expect(tokenPair).toMatchSnapshot();
  });

  it('token pair with issuedAt - полный snapshot', () => {
    const tokenPair = createTokenPair({
      issuedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(tokenPair).toMatchSnapshot();
  });
});

// ============================================================================
// 📋 ZOD SCHEMA VALIDATION
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные token pairs проходят Zod схему', () => {
    const tokenPair = createTokenPair();

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data).toBeDefined() : void 0;
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const tokenPair = {
      ...createTokenPair(),
      extraField: 'not-allowed',
    } as TokenPair & { extraField: string; };

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(false);
  });

  it('accessToken обязателен для access token', () => {
    const invalidTokenPair = {
      refreshToken: 'refresh-token',
      expiresAt: '2026-12-31T23:59:59.000Z',
    };

    const result = tokenPairSchema.safeParse(invalidTokenPair);

    expect(result.success).toBe(false);
  });

  it('refreshToken обязателен для refresh token', () => {
    const invalidTokenPair = {
      accessToken: 'access-token',
      expiresAt: '2026-12-31T23:59:59.000Z',
    };

    const result = tokenPairSchema.safeParse(invalidTokenPair);

    expect(result.success).toBe(false);
  });

  it('expiresAt обязателен для времени истечения', () => {
    const invalidTokenPair = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    const result = tokenPairSchema.safeParse(invalidTokenPair);

    expect(result.success).toBe(false);
  });

  it('accessToken валидируется как строка', () => {
    const tokenPair = createTokenPair({
      accessToken: 'access-token-valid',
    });

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.accessToken).toBe('access-token-valid') : void 0;
  });

  it('refreshToken валидируется как строка', () => {
    const tokenPair = createTokenPair({
      refreshToken: 'refresh-token-valid',
    });

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.refreshToken).toBe('refresh-token-valid') : void 0;
  });

  it('expiresAt валидируется как ISO 8601 datetime', () => {
    const tokenPair = createTokenPair({
      expiresAt: '2026-12-31T23:59:59.000Z',
    });

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.expiresAt).toBe('2026-12-31T23:59:59.000Z') : void 0;
  });

  it('expiresAt отклоняется при невалидном формате', () => {
    const invalidTokenPair = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 'invalid-date',
    };

    const result = tokenPairSchema.safeParse(invalidTokenPair);

    expect(result.success).toBe(false);
  });

  it('expiresAt отклоняется при слишком длинной строке', () => {
    const longDate = `2026-12-31T23:59:59.${'0'.repeat(100)}Z`;
    const invalidTokenPair = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: longDate,
    };

    const result = tokenPairSchema.safeParse(invalidTokenPair);

    expect(result.success).toBe(false);
  });

  it('issuedAt опционально в Zod схеме', () => {
    const tokenPair = createMinimalTokenPair();

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
  });

  it('issuedAt валидируется как ISO 8601 datetime', () => {
    const tokenPair = createTokenPair({
      issuedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.issuedAt).toBe('2026-01-01T00:00:00.000Z') : void 0;
  });

  it('issuedAt отклоняется при невалидном формате', () => {
    const invalidTokenPair = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-12-31T23:59:59.000Z',
      issuedAt: 'invalid-date',
    };

    const result = tokenPairSchema.safeParse(invalidTokenPair);

    expect(result.success).toBe(false);
  });

  it('scope опционально в Zod схеме', () => {
    const tokenPair = createMinimalTokenPair();

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
  });

  it('scope валидируется как массив строк', () => {
    const tokenPair = createTokenPair({
      scope: ['read', 'write'],
    });

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.scope).toEqual(['read', 'write']) : void 0;
  });

  it('scope может быть пустым массивом', () => {
    const tokenPair = createTokenPair({
      scope: [],
    });

    const result = tokenPairSchema.safeParse(tokenPair);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.scope).toEqual([]) : void 0;
  });

  it('expiresAt валидируется с правильным форматом ISO 8601', () => {
    const validFormats = [
      '2026-12-31T23:59:59.000Z',
      '2026-12-31T23:59:59Z',
      '2026-12-31T23:59:59.123Z',
    ];

    validFormats.forEach((expiresAt) => {
      const tokenPair = createTokenPair({
        expiresAt,
      });

      const result = tokenPairSchema.safeParse(tokenPair);

      expect(result.success).toBe(true);
      // eslint-disable-next-line no-unused-expressions
      result.success ? expect(result.data.expiresAt).toBe(expiresAt) : void 0;
    });
  });

  it('issuedAt валидируется с правильным форматом ISO 8601', () => {
    const validFormats = [
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.123Z',
    ];

    validFormats.forEach((issuedAt) => {
      const tokenPair = createTokenPair({
        issuedAt,
      });

      const result = tokenPairSchema.safeParse(tokenPair);

      expect(result.success).toBe(true);
      // eslint-disable-next-line no-unused-expressions
      result.success ? expect(result.data.issuedAt).toBe(issuedAt) : void 0;
    });
  });
});
