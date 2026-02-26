/**
 * @file Unit тесты для domain/SessionPolicy.ts
 * Полное покрытие политики управления сессиями
 */

import { describe, expect, it } from 'vitest';
import type { GeoPolicy, IpPolicy, SessionPolicy } from '../../../src/domain/SessionPolicy.js';
import { sessionPolicySchema } from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createIpPolicy(overrides: Partial<IpPolicy> = {}): IpPolicy {
  return {
    allow: ['192.168.1.0/24', '10.0.0.0/8'],
    deny: ['172.16.0.0/12'],
    ...overrides,
  };
}

function createGeoPolicy(overrides: Partial<GeoPolicy> = {}): GeoPolicy {
  return {
    allowCountries: ['US', 'CA', 'GB'],
    denyCountries: ['RU', 'CN'],
    ...overrides,
  };
}

function createSessionPolicy(overrides: Partial<SessionPolicy> = {}): SessionPolicy {
  return {
    maxConcurrentSessions: 5,
    ipPolicy: createIpPolicy(),
    geoPolicy: createGeoPolicy(),
    requireSameIpForRefresh: true,
    requireSameDeviceForRefresh: false,
    sessionTtlSeconds: 86400,
    idleTimeoutSeconds: 1800,
    revokeOldestOnLimitExceeded: true,
    meta: {
      version: '1.0',
      origin: 'admin-panel',
    },
    ...overrides,
  };
}

function createMinimalSessionPolicy(overrides: Partial<SessionPolicy> = {}): SessionPolicy {
  return {
    ...overrides,
  };
}

function createFullSessionPolicy(overrides: Partial<SessionPolicy> = {}): SessionPolicy {
  return {
    maxConcurrentSessions: 10,
    ipPolicy: createIpPolicy({
      allow: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
      deny: ['0.0.0.0/0'],
    }),
    geoPolicy: createGeoPolicy({
      allowCountries: ['US', 'CA', 'GB', 'AU', 'NZ'],
      denyCountries: ['RU', 'CN', 'KP'],
    }),
    requireSameIpForRefresh: true,
    requireSameDeviceForRefresh: true,
    sessionTtlSeconds: 604800,
    idleTimeoutSeconds: 3600,
    revokeOldestOnLimitExceeded: true,
    meta: {
      version: '2.0',
      origin: 'api',
      priority: 'high',
      tags: ['enterprise', 'security'],
    },
    ...overrides,
  };
}

// ============================================================================
// 📋 SESSION POLICY - Полный DTO
// ============================================================================

describe('SessionPolicy полный DTO', () => {
  it('создает минимальную политику (все поля опциональны)', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.maxConcurrentSessions).toBeUndefined();
    expect(policy.ipPolicy).toBeUndefined();
    expect(policy.geoPolicy).toBeUndefined();
  });

  it('создает полную политику со всеми полями', () => {
    const policy = createFullSessionPolicy();

    expect(policy.maxConcurrentSessions).toBe(10);
    expect(policy.ipPolicy).toBeDefined();
    expect(policy.geoPolicy).toBeDefined();
    expect(policy.requireSameIpForRefresh).toBe(true);
    expect(policy.requireSameDeviceForRefresh).toBe(true);
    expect(policy.sessionTtlSeconds).toBe(604800);
    expect(policy.idleTimeoutSeconds).toBe(3600);
    expect(policy.revokeOldestOnLimitExceeded).toBe(true);
    expect(policy.meta).toBeDefined();
  });

  it('работает с базовой политикой', () => {
    const policy = createSessionPolicy();

    expect(policy.maxConcurrentSessions).toBe(5);
    expect(policy.ipPolicy).toBeDefined();
    expect(policy.geoPolicy).toBeDefined();
  });
});

// ============================================================================
// 📋 MAX CONCURRENT SESSIONS - Максимальное количество одновременных сессий
// ============================================================================

describe('SessionPolicy maxConcurrentSessions', () => {
  it('maxConcurrentSessions может быть ≥ 1', () => {
    const policy = createSessionPolicy({
      maxConcurrentSessions: 1,
    });

    expect(policy.maxConcurrentSessions).toBe(1);
  });

  it('maxConcurrentSessions может быть большим числом', () => {
    const policy = createSessionPolicy({
      maxConcurrentSessions: 100,
    });

    expect(policy.maxConcurrentSessions).toBe(100);
  });

  it('maxConcurrentSessions опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.maxConcurrentSessions).toBeUndefined();
  });

  it('maxConcurrentSessions поддерживает различные значения', () => {
    const values = [1, 5, 10, 50, 100, 1000];

    values.forEach((value) => {
      const policy = createSessionPolicy({
        maxConcurrentSessions: value,
      });

      expect(policy.maxConcurrentSessions).toBe(value);
    });
  });
});

// ============================================================================
// 📋 IP POLICY - Политика IP-адресов
// ============================================================================

describe('SessionPolicy ipPolicy', () => {
  it('ipPolicy опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.ipPolicy).toBeUndefined();
  });

  it('ipPolicy.allow может быть массивом IP/CIDR', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        allow: ['192.168.1.1', '10.0.0.1', '172.16.0.1'],
      }),
    });

    expect(policy.ipPolicy?.allow).toEqual(['192.168.1.1', '10.0.0.1', '172.16.0.1']);
  });

  it('ipPolicy.allow может быть пустым массивом', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        allow: [],
      }),
    });

    expect(policy.ipPolicy?.allow).toEqual([]);
  });

  it('ipPolicy.allow может быть undefined', () => {
    const policy = createSessionPolicy({
      ipPolicy: {
        deny: ['172.16.0.0/12'],
      },
    });

    expect(policy.ipPolicy?.allow).toBeUndefined();
  });

  it('ipPolicy.deny может быть массивом IP/CIDR', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        deny: ['0.0.0.0/0', '127.0.0.1'],
      }),
    });

    expect(policy.ipPolicy?.deny).toEqual(['0.0.0.0/0', '127.0.0.1']);
  });

  it('ipPolicy.deny может быть пустым массивом', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        deny: [],
      }),
    });

    expect(policy.ipPolicy?.deny).toEqual([]);
  });

  it('ipPolicy.deny может быть undefined', () => {
    const policy = createSessionPolicy({
      ipPolicy: {
        allow: ['192.168.1.0/24'],
      },
    });

    expect(policy.ipPolicy?.deny).toBeUndefined();
  });

  it('ipPolicy поддерживает CIDR нотацию', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        allow: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
      }),
    });

    expect(policy.ipPolicy?.allow).toHaveLength(3);
    expect(policy.ipPolicy?.allow?.[0]).toBe('192.168.0.0/16');
  });
});

// ============================================================================
// 📋 GEO POLICY - Географические ограничения
// ============================================================================

describe('SessionPolicy geoPolicy', () => {
  it('geoPolicy опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.geoPolicy).toBeUndefined();
  });

  it('geoPolicy.allowCountries может быть массивом ISO-2 кодов', () => {
    const policy = createSessionPolicy({
      geoPolicy: createGeoPolicy({
        allowCountries: ['US', 'CA', 'GB'],
      }),
    });

    expect(policy.geoPolicy?.allowCountries).toEqual(['US', 'CA', 'GB']);
  });

  it('geoPolicy.allowCountries может быть пустым массивом', () => {
    const policy = createSessionPolicy({
      geoPolicy: createGeoPolicy({
        allowCountries: [],
      }),
    });

    expect(policy.geoPolicy?.allowCountries).toEqual([]);
  });

  it('geoPolicy.denyCountries может быть массивом ISO-2 кодов', () => {
    const policy = createSessionPolicy({
      geoPolicy: createGeoPolicy({
        denyCountries: ['RU', 'CN'],
      }),
    });

    expect(policy.geoPolicy?.denyCountries).toEqual(['RU', 'CN']);
  });
});

// ============================================================================
// 📋 SESSION POLICY - Optional fields
// ============================================================================

describe('SessionPolicy optional fields', () => {
  it('requireSameIpForRefresh опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.requireSameIpForRefresh).toBeUndefined();
  });

  it('requireSameDeviceForRefresh опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.requireSameDeviceForRefresh).toBeUndefined();
  });

  it('sessionTtlSeconds опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.sessionTtlSeconds).toBeUndefined();
  });

  it('idleTimeoutSeconds опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.idleTimeoutSeconds).toBeUndefined();
  });

  it('revokeOldestOnLimitExceeded опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.revokeOldestOnLimitExceeded).toBeUndefined();
  });

  it('meta опционально', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy.meta).toBeUndefined();
  });
});

// ============================================================================
// 📋 SESSION POLICY - Edge cases
// ============================================================================

describe('SessionPolicy edge cases', () => {
  it('работает с минимальным значением maxConcurrentSessions (1)', () => {
    const policy = createSessionPolicy({
      maxConcurrentSessions: 1,
    });

    expect(policy.maxConcurrentSessions).toBe(1);
  });

  it('работает с большими значениями maxConcurrentSessions', () => {
    const policy = createSessionPolicy({
      maxConcurrentSessions: 10000,
    });

    expect(policy.maxConcurrentSessions).toBe(10000);
  });

  it('работает с длинными массивами IP', () => {
    const longIpList = Array.from({ length: 100 }, (_, i) => `192.168.${i}.0/24`);
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        allow: longIpList,
      }),
    });

    expect(policy.ipPolicy?.allow).toHaveLength(100);
  });

  it('работает с длинными массивами стран', () => {
    const longCountryList = Array.from(
      { length: 50 },
      (_, i) => `C${i.toString().padStart(2, '0')}`,
    );
    const policy = createSessionPolicy({
      geoPolicy: createGeoPolicy({
        allowCountries: longCountryList,
      }),
    });

    expect(policy.geoPolicy?.allowCountries).toHaveLength(50);
  });

  it('работает с различными значениями sessionTtlSeconds', () => {
    const values = [60, 3600, 86400, 604800, 2592000];

    values.forEach((value) => {
      const policy = createSessionPolicy({
        sessionTtlSeconds: value,
      });

      expect(policy.sessionTtlSeconds).toBe(value);
    });
  });

  it('работает с различными значениями idleTimeoutSeconds', () => {
    const values = [60, 300, 1800, 3600, 7200];

    values.forEach((value) => {
      const policy = createSessionPolicy({
        idleTimeoutSeconds: value,
      });

      expect(policy.idleTimeoutSeconds).toBe(value);
    });
  });
});

// ============================================================================
// 📋 SESSION POLICY - Immutability
// ============================================================================

describe('SessionPolicy immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const policy: SessionPolicy = {
      maxConcurrentSessions: 5,
    };

    // TypeScript предотвращает мутацию
    // policy.maxConcurrentSessions = 10; // TypeScript error: Cannot assign to 'maxConcurrentSessions' because it is a read-only property

    expect(policy.maxConcurrentSessions).toBe(5);
  });

  it('ipPolicy readonly - предотвращает мутацию вложенных объектов', () => {
    const policy: SessionPolicy = {
      ipPolicy: createIpPolicy({
        allow: ['192.168.1.1'],
      }),
    };

    // TypeScript предотвращает мутацию ipPolicy
    // policy.ipPolicy!.allow = ['10.0.0.1']; // TypeScript error: Cannot assign to 'allow' because it is a read-only property

    expect(policy.ipPolicy?.allow).toEqual(['192.168.1.1']);
  });

  it('ipPolicy.allow readonly - предотвращает мутацию массива', () => {
    const policy: SessionPolicy = {
      ipPolicy: createIpPolicy({
        allow: ['192.168.1.1', '10.0.0.1'],
      }),
    };

    // TypeScript предотвращает мутацию массива
    // policy.ipPolicy!.allow![0] = '172.16.0.1'; // TypeScript error: Cannot assign to '0' because it is a read-only property

    expect(policy.ipPolicy?.allow?.[0]).toBe('192.168.1.1');
  });

  it('geoPolicy readonly - предотвращает мутацию вложенных объектов', () => {
    const policy: SessionPolicy = {
      geoPolicy: createGeoPolicy({
        allowCountries: ['US', 'CA'],
      }),
    };

    // TypeScript предотвращает мутацию geoPolicy
    // policy.geoPolicy!.allowCountries = ['GB']; // TypeScript error: Cannot assign to 'allowCountries' because it is a read-only property

    expect(policy.geoPolicy?.allowCountries).toEqual(['US', 'CA']);
  });

  it('meta readonly - предотвращает мутацию вложенных объектов', () => {
    const policy: SessionPolicy = {
      meta: {
        version: '1.0',
      },
    };

    // TypeScript предотвращает мутацию meta
    // policy.meta!.version = '2.0'; // TypeScript error: Cannot assign to 'version' because it is a read-only property

    expect(policy.meta?.['version']).toBe('1.0');
  });
});

// ============================================================================
// 📋 SESSION POLICY - Comprehensive snapshots
// ============================================================================

describe('SessionPolicy comprehensive snapshots', () => {
  it('full session policy - полный snapshot', () => {
    const policy = createFullSessionPolicy();

    expect(policy).toMatchSnapshot();
  });

  it('minimal session policy - полный snapshot', () => {
    const policy = createMinimalSessionPolicy();

    expect(policy).toMatchSnapshot();
  });

  it('session policy with ipPolicy - полный snapshot', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy(),
    });

    expect(policy).toMatchSnapshot();
  });

  it('session policy with geoPolicy - полный snapshot', () => {
    const policy = createSessionPolicy({
      geoPolicy: createGeoPolicy(),
    });

    expect(policy).toMatchSnapshot();
  });

  it('session policy with maxConcurrentSessions - полный snapshot', () => {
    const policy = createSessionPolicy({
      maxConcurrentSessions: 3,
    });

    expect(policy).toMatchSnapshot();
  });
});

// ============================================================================
// 📋 ZOD SCHEMA VALIDATION
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные session policies проходят Zod схему', () => {
    const policy = createSessionPolicy();

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data).toBeDefined() : void 0;
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const policy = {
      ...createSessionPolicy(),
      extraField: 'not-allowed',
    } as SessionPolicy & { extraField: string; };

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(false);
  });

  it('maxConcurrentSessions валидируется как число ≥ 1', () => {
    const validPolicy = createSessionPolicy({
      maxConcurrentSessions: 1,
    });

    const result = sessionPolicySchema.safeParse(validPolicy);

    expect(result.success).toBe(true);
  });

  it('maxConcurrentSessions отклоняется при значении < 1', () => {
    const invalidPolicy = {
      maxConcurrentSessions: 0,
    };

    const result = sessionPolicySchema.safeParse(invalidPolicy);

    expect(result.success).toBe(false);
  });

  it('maxConcurrentSessions отклоняется при отрицательном значении', () => {
    const invalidPolicy = {
      maxConcurrentSessions: -1,
    };

    const result = sessionPolicySchema.safeParse(invalidPolicy);

    expect(result.success).toBe(false);
  });

  it('ipPolicy.allow валидируется как массив строк', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        allow: ['192.168.1.1', '10.0.0.1'],
      }),
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success
      ? expect(result.data.ipPolicy?.allow).toEqual(['192.168.1.1', '10.0.0.1'])
      : void 0;
  });

  it('ipPolicy.allow может быть пустым массивом', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        allow: [],
      }),
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
  });

  it('ipPolicy.deny валидируется как массив строк', () => {
    const policy = createSessionPolicy({
      ipPolicy: createIpPolicy({
        deny: ['0.0.0.0/0'],
      }),
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.ipPolicy?.deny).toEqual(['0.0.0.0/0']) : void 0;
  });

  it('geoPolicy.allowCountries валидируется как массив строк', () => {
    const policy = createSessionPolicy({
      geoPolicy: createGeoPolicy({
        allowCountries: ['US', 'CA'],
      }),
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.geoPolicy?.allowCountries).toEqual(['US', 'CA']) : void 0;
  });

  it('geoPolicy.denyCountries валидируется как массив строк', () => {
    const policy = createSessionPolicy({
      geoPolicy: createGeoPolicy({
        denyCountries: ['RU', 'CN'],
      }),
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.geoPolicy?.denyCountries).toEqual(['RU', 'CN']) : void 0;
  });

  it('sessionTtlSeconds валидируется как число ≥ 1', () => {
    const policy = createSessionPolicy({
      sessionTtlSeconds: 1,
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
  });

  it('sessionTtlSeconds отклоняется при значении < 1', () => {
    const invalidPolicy = {
      sessionTtlSeconds: 0,
    };

    const result = sessionPolicySchema.safeParse(invalidPolicy);

    expect(result.success).toBe(false);
  });

  it('idleTimeoutSeconds валидируется как число ≥ 1', () => {
    const policy = createSessionPolicy({
      idleTimeoutSeconds: 1,
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
  });

  it('idleTimeoutSeconds отклоняется при значении < 1', () => {
    const invalidPolicy = {
      idleTimeoutSeconds: 0,
    };

    const result = sessionPolicySchema.safeParse(invalidPolicy);

    expect(result.success).toBe(false);
  });

  it('все опциональные поля поддерживаются', () => {
    const policy = createMinimalSessionPolicy();

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
  });

  it('meta валидируется как record', () => {
    const policy = createSessionPolicy({
      meta: {
        version: '1.0',
        origin: 'api',
        priority: 'high',
      },
    });

    const result = sessionPolicySchema.safeParse(policy);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.meta).toBeDefined() : void 0;
  });
});
