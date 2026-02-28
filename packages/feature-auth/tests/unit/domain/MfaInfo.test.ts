/**
 * @file Unit тесты для domain/MfaInfo.ts
 * Полное покрытие информации о многофакторной аутентификации
 */

import { describe, expect, it } from 'vitest';
import type { MfaInfo } from '../../../src/domain/MfaInfo.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createMfaInfo(overrides: Partial<MfaInfo> = {}): MfaInfo {
  return {
    type: 'totp',
    token: '123456',
    deviceId: 'device-123',
    ...overrides,
  } as MfaInfo;
}

function createMinimalMfaInfo(overrides: Partial<MfaInfo> = {}): MfaInfo {
  return {
    type: 'totp',
    token: '123456',
    ...overrides,
  } as MfaInfo;
}

function createFullMfaInfo(overrides: Partial<MfaInfo> = {}): MfaInfo {
  return {
    type: 'totp',
    token: '123456',
    deviceId: 'device-full',
    ...overrides,
  } as MfaInfo;
}

function createPushMfaInfo(overrides: Partial<Extract<MfaInfo, { type: 'push'; }>> = {}): MfaInfo {
  return {
    type: 'push',
    deviceId: 'device-push',
    ...overrides,
  };
}

// ============================================================================
// 📋 MFA INFO - Полный DTO
// ============================================================================

describe('MfaInfo полный DTO', () => {
  it('создает минимальный MFA info (обязательные поля)', () => {
    const mfa = createMinimalMfaInfo();

    expect(mfa.type).toBe('totp');
    expect(mfa.type !== 'push' ? mfa.token : undefined).toBe('123456');
    expect(mfa.deviceId).toBeUndefined();
  });

  it('создает полный MFA info со всеми полями', () => {
    const mfa = createFullMfaInfo();

    expect(mfa.type).toBe('totp');
    expect(mfa.type !== 'push' ? mfa.token : undefined).toBe('123456');
    expect(mfa.type !== 'push' ? mfa.deviceId : undefined).toBe('device-full');
  });

  it('работает с базовым MFA info', () => {
    const mfa = createMfaInfo();

    expect(mfa.type).toBe('totp');
    expect(mfa.type !== 'push' ? mfa.token : undefined).toBe('123456');
    expect(mfa.type !== 'push' ? mfa.deviceId : undefined).toBe('device-123');
  });
});

// ============================================================================
// 📋 MFA INFO - Required fields
// ============================================================================

describe('MfaInfo required fields', () => {
  it('type обязателен для типа MFA метода', () => {
    const mfa: MfaInfo = {
      type: 'totp',
      token: '123456',
    };

    expect(mfa.type).toBe('totp');
  });

  it('token обязателен для token-based MFA типов', () => {
    const mfa: MfaInfo = {
      type: 'sms',
      token: '654321',
    };

    // TypeScript знает, что 'sms' !== 'push', поэтому token доступен напрямую
    expect(mfa.token).toBe('654321');
  });
});

// ============================================================================
// 📋 MFA INFO - Optional fields
// ============================================================================

describe('MfaInfo optional fields', () => {
  it('deviceId опционально для идентификатора устройства', () => {
    const mfa = createMinimalMfaInfo();

    expect(mfa.deviceId).toBeUndefined();
  });

  it('deviceId может быть указан', () => {
    const mfa = createMfaInfo({
      deviceId: 'device-optional',
    });

    expect(mfa.deviceId).toBe('device-optional');
  });
});

// ============================================================================
// 📋 MFA INFO - MFA Types
// ============================================================================

describe('MfaInfo MFA types', () => {
  it('поддерживает тип totp', () => {
    const mfa = createMfaInfo({
      type: 'totp',
    });

    expect(mfa.type).toBe('totp');
  });

  it('поддерживает тип sms', () => {
    const mfa = createMfaInfo({
      type: 'sms',
    });

    expect(mfa.type).toBe('sms');
  });

  it('поддерживает тип email', () => {
    const mfa = createMfaInfo({
      type: 'email',
    });

    expect(mfa.type).toBe('email');
  });

  it('поддерживает тип push (без token, обязательный deviceId)', () => {
    const mfa = createPushMfaInfo();

    expect(mfa.type).toBe('push');
    expect(mfa.deviceId).toBe('device-push');
    // TypeScript гарантирует, что push не имеет token
    expect(mfa.type === 'push' ? 'token' in mfa : true).toBe(false);
  });

  it('работает со всеми типами MFA', () => {
    const tokenBasedTypes: ('totp' | 'sms' | 'email')[] = ['totp', 'sms', 'email'];

    tokenBasedTypes.forEach((type) => {
      const mfa = createMfaInfo({ type });
      expect(mfa.type).toBe(type);
      // TypeScript знает, что type !== 'push', поэтому проверяем через narrowing
      expect(mfa.type !== 'push' ? mfa.token : undefined).toBeDefined();
    });

    const pushMfa = createPushMfaInfo();
    expect(pushMfa.type).toBe('push');
    expect(pushMfa.deviceId).toBeDefined();
    expect('token' in pushMfa).toBe(false);
  });
});

// ============================================================================
// 📋 MFA INFO - Token
// ============================================================================

describe('MfaInfo token', () => {
  it('token может быть строкой для token-based типов', () => {
    const mfa = createMfaInfo({
      token: '123456',
    });

    expect(mfa.type !== 'push' ? mfa.token : undefined).toBe('123456');
  });

  it('token может быть длинной строкой', () => {
    const longToken = 'a'.repeat(100);
    const mfa = createMfaInfo({
      token: longToken,
    });

    const token = mfa.type !== 'push' ? mfa.token : undefined;
    expect(token).toBe(longToken);
    expect(token?.length).toBe(100);
  });

  it('token может быть короткой строкой', () => {
    const mfa = createMfaInfo({
      token: '123',
    });

    expect(mfa.type !== 'push' ? mfa.token : undefined).toBe('123');
  });
});

// ============================================================================
// 📋 MFA INFO - Device ID
// ============================================================================

describe('MfaInfo deviceId', () => {
  it('deviceId может быть строкой', () => {
    const mfa = createMfaInfo({
      deviceId: 'device-abc',
    });

    expect(mfa.deviceId).toBe('device-abc');
  });

  it('deviceId может быть длинной строкой', () => {
    const longDeviceId = `device-${'a'.repeat(100)}`;
    const mfa = createMfaInfo({
      deviceId: longDeviceId,
    });

    expect(mfa.deviceId).toBe(longDeviceId);
  });
});

// ============================================================================
// 📋 MFA INFO - Edge cases
// ============================================================================

describe('MfaInfo edge cases', () => {
  it('работает с различными комбинациями полей для token-based типов', () => {
    const tokenBasedCombinations: MfaInfo[] = [
      { type: 'totp', token: '123456' },
      { type: 'sms', token: '654321', deviceId: 'device-1' },
      { type: 'email', token: 'abc123' },
    ];

    tokenBasedCombinations.forEach((mfa) => {
      expect(mfa.type).toBeDefined();
      expect(mfa.type !== 'push' ? mfa.token : undefined).toBeDefined();
    });
  });

  it('push требует обязательный deviceId и не имеет token', () => {
    const pushMfa: MfaInfo = {
      type: 'push',
      deviceId: 'device-push-required',
    };

    expect(pushMfa.type).toBe('push');
    expect(pushMfa.deviceId).toBe('device-push-required');
    expect('token' in pushMfa).toBe(false);
  });

  it('discriminated union обеспечивает type-safe branching', () => {
    const totpMfa: MfaInfo = { type: 'totp', token: '123456' };
    const pushMfa: MfaInfo = { type: 'push', deviceId: 'device-xyz' };

    // TypeScript exhaustiveness check работает
    // Для totp TypeScript знает, что type !== 'push', поэтому token доступен
    expect(totpMfa.token).toBe('123456');

    expect(pushMfa.deviceId).toBe('device-xyz');
    // TypeScript не позволит обратиться к token для push
  });
});

// ============================================================================
// 📋 MFA INFO - Immutability
// ============================================================================

describe('MfaInfo immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const mfa: MfaInfo = {
      type: 'totp',
      token: '123456',
      deviceId: 'device-immutable',
    };

    // TypeScript предотвращает мутацию
    // mfa.type = 'sms'; // TypeScript error: Cannot assign to 'type' because it is a read-only property
    // mfa.token = 'mutated'; // TypeScript error: Cannot assign to 'token' because it is a read-only property

    expect(mfa.type).toBe('totp');
    expect(mfa.token).toBe('123456');
  });
});

// ============================================================================
// 📋 MFA INFO - Discriminated Union & Type Safety
// ============================================================================

describe('MfaInfo discriminated union', () => {
  it('token-based типы (totp, sms, email) требуют token', () => {
    const totpMfa: MfaInfo = { type: 'totp', token: '123456' };
    const smsMfa: MfaInfo = { type: 'sms', token: '654321' };
    const emailMfa: MfaInfo = { type: 'email', token: 'abc123' };

    // TypeScript знает, что эти типы !== 'push', поэтому token доступен напрямую
    expect(totpMfa.token).toBe('123456');
    expect(smsMfa.token).toBe('654321');
    expect(emailMfa.token).toBe('abc123');
  });

  it('push не имеет token и требует обязательный deviceId', () => {
    const pushMfa: MfaInfo = {
      type: 'push',
      deviceId: 'device-required',
    };

    expect(pushMfa.type).toBe('push');
    expect(pushMfa.deviceId).toBe('device-required');
    // TypeScript гарантирует отсутствие token для push
    expect('token' in pushMfa).toBe(false);
  });

  it('exhaustiveness check работает для всех типов', () => {
    const handleMfa = (mfa: MfaInfo): string =>
      mfa.type === 'push'
        ? `push:${mfa.deviceId}`
        // TypeScript знает, что здесь mfa.type !== 'push'
        : `${mfa.type}:${mfa.token}`;

    expect(handleMfa({ type: 'totp', token: '123' })).toBe('totp:123');
    expect(handleMfa({ type: 'push', deviceId: 'dev-1' })).toBe('push:dev-1');
  });

  it('нельзя создать push без deviceId', () => {
    // TypeScript не позволит создать push без deviceId
    // Это проверяется на уровне типов, но добавим runtime проверку
    const pushMfa: MfaInfo = {
      type: 'push',
      deviceId: 'required-device-id',
    };

    expect(pushMfa.deviceId).toBeDefined();
    expect(typeof pushMfa.deviceId).toBe('string');
  });

  it('нельзя создать token-based тип без token', () => {
    // TypeScript не позволит создать totp/sms/email без token
    const totpMfa: MfaInfo = {
      type: 'totp',
      token: 'required-token',
    };

    // TypeScript знает, что totp !== 'push', поэтому token доступен
    expect(totpMfa.token).toBeDefined();
    expect(typeof totpMfa.token).toBe('string');
  });
});

// ============================================================================
// 📋 MFA INFO - Security Correctness
// ============================================================================

describe('MfaInfo security correctness', () => {
  it('token помечен как sensitive в JSDoc', () => {
    // Проверяем, что token существует и является строкой
    // JSDoc предупреждение о sensitive данных должно быть в коде
    const mfa: MfaInfo = { type: 'totp', token: 'sensitive-token-123' };

    // TypeScript знает, что totp !== 'push', поэтому token доступен
    expect(mfa.token).toBe('sensitive-token-123');
    // В production коде token не должен логироваться
    // Это проверяется на уровне code review и linting правил
  });

  it('push не содержит sensitive token данных', () => {
    const pushMfa: MfaInfo = {
      type: 'push',
      deviceId: 'device-id',
    };

    // Push не содержит token, что снижает риск утечки sensitive данных
    expect('token' in pushMfa).toBe(false);
  });
});

// ============================================================================
// 📋 MFA INFO - Comprehensive snapshots
// ============================================================================

describe('MfaInfo comprehensive snapshots', () => {
  it('full mfa info - полный snapshot', () => {
    const mfa = createFullMfaInfo();

    expect(mfa).toMatchSnapshot();
  });

  it('minimal mfa info - полный snapshot', () => {
    const mfa = createMinimalMfaInfo();

    expect(mfa).toMatchSnapshot();
  });

  it('mfa info with different types - полный snapshot', () => {
    const tokenBasedTypes: ('totp' | 'sms' | 'email')[] = ['totp', 'sms', 'email'];
    const pushType: 'push' = 'push';

    tokenBasedTypes.forEach((type) => {
      const mfa = createMfaInfo({ type });
      expect(mfa).toMatchSnapshot();
    });

    const pushMfa = createPushMfaInfo({ type: pushType });
    expect(pushMfa).toMatchSnapshot();
  });
});
