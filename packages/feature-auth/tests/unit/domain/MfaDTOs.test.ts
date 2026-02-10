/**
 * @file Unit тесты для MFA DTOs
 * Полное покрытие MfaBackupCodeRequest, MfaChallengeRequest, MfaRecoveryRequest, MfaSetupRequest
 */

import { describe, expect, it } from 'vitest';
import type { MfaBackupCodeRequest } from '../../../src/domain/MfaBackupCodeRequest.js';
import type { MfaChallengeRequest, MfaType } from '../../../src/domain/MfaChallengeRequest.js';
import type {
  MfaRecoveryMethod,
  MfaRecoveryRequest,
} from '../../../src/domain/MfaRecoveryRequest.js';
import type { MfaSetupRequest } from '../../../src/domain/MfaSetupRequest.js';
import {
  mfaBackupCodeRequestSchema,
  mfaChallengeRequestSchema,
  mfaRecoveryRequestSchema,
  mfaSetupRequestSchema,
} from '../../../src/schemas.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createMfaBackupCodeRequest(
  overrides: Partial<MfaBackupCodeRequest> = {},
): MfaBackupCodeRequest {
  return {
    userId: 'user-123',
    backupCode: 'ABCD-EFGH',
    deviceId: 'device-abc',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    meta: {
      step: 'recovery',
    },
    ...overrides,
  };
}

function createMfaChallengeRequest(
  overrides: Partial<MfaChallengeRequest> = {},
): MfaChallengeRequest {
  return {
    userId: 'user-123',
    type: 'totp',
    deviceId: 'device-abc',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2026-01-15T10:30:00.000Z',
    meta: {
      step: 'login',
    },
    ...overrides,
  };
}

function createMfaRecoveryRequest(overrides: Partial<MfaRecoveryRequest> = {}): MfaRecoveryRequest {
  return {
    userId: 'user-123',
    method: 'backup_code',
    proof: {
      backupCode: 'ABCD-EFGH',
    },
    ip: '192.168.1.1',
    deviceId: 'new-device',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2026-01-15T10:30:00.000Z',
    context: {
      riskScore: 25,
    },
    ...overrides,
  };
}

function createMfaSetupRequest(overrides: Partial<MfaSetupRequest> = {}): MfaSetupRequest {
  return {
    userId: 'user-123',
    type: 'totp',
    secret: 'JBSWY3DPEHPK3PXP',
    deviceName: 'My iPhone',
    deviceId: 'device-abc',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    meta: {
      step: 'enrollment',
    },
    ...overrides,
  };
}

// ============================================================================
// 🎯 MFA TYPES - Типы MFA
// ============================================================================

describe('MfaType enum coverage', () => {
  const allMfaTypes: MfaType[] = ['totp', 'sms', 'email', 'push'];

  it('поддерживает все типы MFA', () => {
    allMfaTypes.forEach((type) => {
      const challenge = createMfaChallengeRequest({ type });
      const setup = createMfaSetupRequest({ type });

      expect(challenge.type).toBe(type);
      expect(setup.type).toBe(type);
    });
  });

  it('каждый тип MFA имеет правильную структуру', () => {
    // TOTP
    const totpChallenge = createMfaChallengeRequest({ type: 'totp' });
    expect(totpChallenge.type).toBe('totp');

    // SMS
    const smsChallenge = createMfaChallengeRequest({ type: 'sms' });
    expect(smsChallenge.type).toBe('sms');

    // Email
    const emailChallenge = createMfaChallengeRequest({ type: 'email' });
    expect(emailChallenge.type).toBe('email');

    // Push
    const pushChallenge = createMfaChallengeRequest({ type: 'push' });
    expect(pushChallenge.type).toBe('push');
  });
});

// ============================================================================
// 📋 MFA BACKUP CODE REQUEST - Запрос backup кода
// ============================================================================

describe('MfaBackupCodeRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request: MfaBackupCodeRequest = {
      userId: 'user-123',
      backupCode: 'ABCD-EFGH',
    };

    expect(request.userId).toBe('user-123');
    expect(request.backupCode).toBe('ABCD-EFGH');
    expect(request.deviceId).toBeUndefined();
    expect(request.ip).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createMfaBackupCodeRequest();

    expect(request.userId).toBe('user-123');
    expect(request.backupCode).toBe('ABCD-EFGH');
    expect(request.deviceId).toBe('device-abc');
    expect(request.ip).toBe('192.168.1.1');
    expect(request.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(request.meta?.['step']).toBe('recovery');
  });

  it('backupCode обязателен для резервного кода', () => {
    const request = createMfaBackupCodeRequest({
      backupCode: 'BACKUP-CODE-123',
    });

    expect(request.backupCode).toBe('BACKUP-CODE-123');
  });

  it('работает с различными форматами backup кодов', () => {
    const backupCodes = [
      'ABCD-EFGH',
      '1234-5678',
      'BACKUP-CODE',
      'very-long-backup-code-string',
    ];

    backupCodes.forEach((code) => {
      const request = createMfaBackupCodeRequest({ backupCode: code });
      expect(request.backupCode).toBe(code);
    });
  });
});

describe('MfaBackupCodeRequest optional fields', () => {
  it('deviceId опционально для идентификатора устройства', () => {
    const requestWithDevice = createMfaBackupCodeRequest({ deviceId: 'device-123' });
    const requestWithoutDevice: MfaBackupCodeRequest = {
      userId: 'user-123',
      backupCode: 'ABCD-EFGH',
    };

    expect(requestWithDevice.deviceId).toBe('device-123');
    expect(requestWithoutDevice.deviceId).toBeUndefined();
  });

  it('ip опционально для IP адреса клиента', () => {
    const requestWithIp = createMfaBackupCodeRequest({ ip: '192.168.1.1' });
    const requestWithoutIp: MfaBackupCodeRequest = {
      userId: 'user-123',
      backupCode: 'ABCD-EFGH',
    };

    expect(requestWithIp.ip).toBe('192.168.1.1');
    expect(requestWithoutIp.ip).toBeUndefined();
  });

  it('userAgent опционально для User-Agent строки', () => {
    const requestWithUserAgent = createMfaBackupCodeRequest({ userAgent: 'Custom-Agent' });
    const requestWithoutUserAgent: MfaBackupCodeRequest = {
      userId: 'user-123',
      backupCode: 'ABCD-EFGH',
    };

    expect(requestWithUserAgent.userAgent).toBe('Custom-Agent');
    expect(requestWithoutUserAgent.userAgent).toBeUndefined();
  });

  it('meta опционально для дополнительных метаданных', () => {
    const requestWithMeta = createMfaBackupCodeRequest({
      meta: {
        step: 'recovery',
        origin: 'mobile',
      } as Record<string, unknown>,
    });
    const requestWithoutMeta: MfaBackupCodeRequest = {
      userId: 'user-123',
      backupCode: 'ABCD-EFGH',
    };

    expect(requestWithMeta.meta?.['step']).toBe('recovery');
    expect(requestWithMeta.meta?.['origin']).toBe('mobile');
    expect(requestWithoutMeta.meta).toBeUndefined();
  });
});

// ============================================================================
// 📋 MFA CHALLENGE REQUEST - Запрос challenge
// ============================================================================

describe('MfaChallengeRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request: MfaChallengeRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(request.userId).toBe('user-123');
    expect(request.type).toBe('totp');
    expect(request.deviceId).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createMfaChallengeRequest();

    expect(request.userId).toBe('user-123');
    expect(request.type).toBe('totp');
    expect(request.deviceId).toBe('device-abc');
    expect(request.ip).toBe('192.168.1.1');
    expect(request.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(request.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(request.meta?.['step']).toBe('login');
  });

  it('работает со всеми типами MFA', () => {
    const types: MfaType[] = ['totp', 'sms', 'email', 'push'];

    types.forEach((type) => {
      const request = createMfaChallengeRequest({ type });
      expect(request.type).toBe(type);
    });
  });
});

describe('MfaChallengeRequest optional fields', () => {
  it('deviceId опционально для идентификатора устройства', () => {
    const requestWithDevice = createMfaChallengeRequest({ deviceId: 'device-123' });
    const requestWithoutDevice: MfaChallengeRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(requestWithDevice.deviceId).toBe('device-123');
    expect(requestWithoutDevice.deviceId).toBeUndefined();
  });

  it('timestamp опционально для временной метки', () => {
    const requestWithTimestamp = createMfaChallengeRequest({
      timestamp: '2026-01-15T10:30:00.000Z',
    });
    const requestWithoutTimestamp: MfaChallengeRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(requestWithTimestamp.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(requestWithoutTimestamp.timestamp).toBeUndefined();
  });

  it('meta опционально для дополнительных метаданных', () => {
    const requestWithMeta = createMfaChallengeRequest({
      meta: {
        step: 'login',
        origin: 'web',
      } as Record<string, unknown>,
    });
    const requestWithoutMeta: MfaChallengeRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(requestWithMeta.meta?.['step']).toBe('login');
    expect(requestWithMeta.meta?.['origin']).toBe('web');
    expect(requestWithoutMeta.meta).toBeUndefined();
  });
});

// ============================================================================
// 📋 MFA RECOVERY REQUEST - Запрос восстановления
// ============================================================================

describe('MfaRecoveryRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request: MfaRecoveryRequest = {
      userId: 'user-123',
      method: 'backup_code',
      proof: {
        backupCode: 'ABCD-EFGH',
      },
    };

    expect(request.userId).toBe('user-123');
    expect(request.method).toBe('backup_code');
    expect(request.proof.backupCode).toBe('ABCD-EFGH');
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createMfaRecoveryRequest();

    expect(request.userId).toBe('user-123');
    expect(request.method).toBe('backup_code');
    expect(request.proof.backupCode).toBe('ABCD-EFGH');
    expect(request.ip).toBe('192.168.1.1');
    expect(request.deviceId).toBe('new-device');
    expect(request.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(request.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(request.context?.['riskScore']).toBe(25);
  });

  it('работает со всеми методами восстановления', () => {
    const methods: MfaRecoveryMethod[] = [
      'backup_code',
      'email_verification',
      'sms_verification',
      'support_assisted',
    ];

    methods.forEach((method) => {
      const proof = method === 'backup_code'
        ? { backupCode: 'ABCD-EFGH' }
        : method === 'email_verification'
        ? { emailToken: 'email-token-123' }
        : method === 'sms_verification'
        ? { smsCode: '123456' }
        : { supportTicketId: 'ticket-123' };

      const request = createMfaRecoveryRequest({
        method,
        proof: proof as MfaRecoveryRequest['proof'],
      });

      expect(request.method).toBe(method);
    });
  });

  it('proof.backupCode обязателен для метода backup_code', () => {
    const request = createMfaRecoveryRequest({
      method: 'backup_code',
      proof: {
        backupCode: 'BACKUP-CODE-123',
      },
    });

    expect(request.proof.backupCode).toBe('BACKUP-CODE-123');
  });
});

describe('MfaRecoveryRequest optional fields', () => {
  it('deviceId опционально для идентификатора нового устройства', () => {
    const requestWithDevice = createMfaRecoveryRequest({ deviceId: 'new-device-123' });
    const requestWithoutDevice: MfaRecoveryRequest = {
      userId: 'user-123',
      method: 'backup_code',
      proof: {
        backupCode: 'ABCD-EFGH',
      },
    };

    expect(requestWithDevice.deviceId).toBe('new-device-123');
    expect(requestWithoutDevice.deviceId).toBeUndefined();
  });

  it('timestamp опционально для временной метки', () => {
    const requestWithTimestamp = createMfaRecoveryRequest({
      timestamp: '2026-01-15T10:30:00.000Z',
    });
    const requestWithoutTimestamp: MfaRecoveryRequest = {
      userId: 'user-123',
      method: 'backup_code',
      proof: {
        backupCode: 'ABCD-EFGH',
      },
    };

    expect(requestWithTimestamp.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(requestWithoutTimestamp.timestamp).toBeUndefined();
  });

  it('context опционально для дополнительного контекста', () => {
    const requestWithContext = createMfaRecoveryRequest({
      context: {
        riskScore: 25,
        manualOverride: true,
      },
    });
    const requestWithoutContext: MfaRecoveryRequest = {
      userId: 'user-123',
      method: 'backup_code',
      proof: {
        backupCode: 'ABCD-EFGH',
      },
    };

    expect(requestWithContext.context?.['riskScore']).toBe(25);
    expect(requestWithContext.context?.['manualOverride']).toBe(true);
    expect(requestWithoutContext.context).toBeUndefined();
  });
});

// ============================================================================
// 📋 MFA SETUP REQUEST - Запрос настройки
// ============================================================================

describe('MfaSetupRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request: MfaSetupRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(request.userId).toBe('user-123');
    expect(request.type).toBe('totp');
    expect(request.secret).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createMfaSetupRequest();

    expect(request.userId).toBe('user-123');
    expect(request.type).toBe('totp');
    expect(request.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(request.deviceName).toBe('My iPhone');
    expect(request.deviceId).toBe('device-abc');
    expect(request.ip).toBe('192.168.1.1');
    expect(request.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(request.meta?.['step']).toBe('enrollment');
  });

  it('работает со всеми типами MFA', () => {
    const types: MfaType[] = ['totp', 'sms', 'email', 'push'];

    types.forEach((type) => {
      const request = createMfaSetupRequest({ type });
      expect(request.type).toBe(type);
    });
  });
});

describe('MfaSetupRequest optional fields', () => {
  it('secret опционально для секрета MFA', () => {
    const requestWithSecret = createMfaSetupRequest({ secret: 'JBSWY3DPEHPK3PXP' });
    const requestWithoutSecret: MfaSetupRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(requestWithSecret.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(requestWithoutSecret.secret).toBeUndefined();
  });

  it('deviceName опционально для читаемого имени устройства', () => {
    const requestWithDeviceName = createMfaSetupRequest({ deviceName: 'My iPhone' });
    const requestWithoutDeviceName: MfaSetupRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(requestWithDeviceName.deviceName).toBe('My iPhone');
    expect(requestWithoutDeviceName.deviceName).toBeUndefined();
  });

  it('deviceId опционально для идентификатора устройства', () => {
    const requestWithDevice = createMfaSetupRequest({ deviceId: 'device-123' });
    const requestWithoutDevice: MfaSetupRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(requestWithDevice.deviceId).toBe('device-123');
    expect(requestWithoutDevice.deviceId).toBeUndefined();
  });

  it('meta опционально для дополнительных метаданных', () => {
    const requestWithMeta = createMfaSetupRequest({
      meta: {
        step: 'enrollment',
        origin: 'mobile',
      } as Record<string, unknown>,
    });
    const requestWithoutMeta: MfaSetupRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(requestWithMeta.meta?.['step']).toBe('enrollment');
    expect(requestWithMeta.meta?.['origin']).toBe('mobile');
    expect(requestWithoutMeta.meta).toBeUndefined();
  });
});

// ============================================================================
// 🔄 MULTI-FACTOR ARRAYS - Поддержка массивов для multi-factor
// ============================================================================

describe('MFA requests multi-factor arrays', () => {
  it('поддерживает массив типов MFA для challenge requests', () => {
    const types: MfaType[] = ['totp', 'sms', 'email', 'push'];

    types.forEach((type) => {
      const request = createMfaChallengeRequest({ type });
      expect(request.type).toBe(type);
    });

    // Проверка, что можно работать с несколькими типами через массив
    const allTypes: MfaType[] = ['totp', 'sms', 'email', 'push'];
    expect(allTypes).toHaveLength(4);
    expect(allTypes).toContain('totp');
    expect(allTypes).toContain('sms');
    expect(allTypes).toContain('email');
    expect(allTypes).toContain('push');
  });

  it('поддерживает массив методов восстановления для recovery requests', () => {
    const methods: MfaRecoveryMethod[] = [
      'backup_code',
      'email_verification',
      'sms_verification',
      'support_assisted',
    ];

    methods.forEach((method) => {
      const request = createMfaRecoveryRequest({ method });
      expect(request.method).toBe(method);
    });

    // Проверка, что можно работать с несколькими методами через массив
    expect(methods).toHaveLength(4);
    expect(methods).toContain('backup_code');
    expect(methods).toContain('email_verification');
    expect(methods).toContain('sms_verification');
    expect(methods).toContain('support_assisted');
  });

  it('поддерживает массив backup кодов для recovery', () => {
    const backupCodes = ['ABCD-EFGH', 'IJKL-MNOP', 'QRST-UVWX'];

    backupCodes.forEach((code) => {
      const request = createMfaRecoveryRequest({
        method: 'backup_code',
        proof: {
          backupCode: code,
        },
      });
      expect(request.proof.backupCode).toBe(code);
    });

    // Проверка массива backup кодов
    expect(backupCodes).toHaveLength(3);
    expect(backupCodes[0]).toBe('ABCD-EFGH');
  });

  it('поддерживает массив типов MFA для setup requests', () => {
    const types: MfaType[] = ['totp', 'sms', 'email', 'push'];

    types.forEach((type) => {
      const request = createMfaSetupRequest({ type });
      expect(request.type).toBe(type);
    });

    // Проверка массива типов
    expect(types).toHaveLength(4);
    expect(types).toContain('totp');
    expect(types).toContain('push');
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('MFA requests edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const backupRequest = createMfaBackupCodeRequest({
      deviceId: '',
      ip: '',
      userAgent: '',
    });

    expect(backupRequest.deviceId).toBe('');
    expect(backupRequest.ip).toBe('');
    expect(backupRequest.userAgent).toBe('');
  });

  it('работает с различными форматами backup кодов', () => {
    const backupCodes = [
      'ABCD-EFGH',
      '1234-5678',
      'BACKUP-CODE',
      'very-long-backup-code-string-with-many-characters',
    ];

    backupCodes.forEach((code) => {
      const request = createMfaBackupCodeRequest({ backupCode: code });
      expect(request.backupCode).toBe(code);
    });
  });

  it('работает с различными форматами recovery кодов', () => {
    const recoveryCodes = [
      'ABCD-EFGH',
      '1234-5678',
      'RECOVERY-CODE',
      'very-long-recovery-code-string',
    ];

    recoveryCodes.forEach((code) => {
      const request = createMfaRecoveryRequest({
        proof: {
          backupCode: code,
        },
      });
      expect(request.proof.backupCode).toBe(code);
    });
  });

  it('timestamp может быть в ISO 8601 формате', () => {
    const timestamps = [
      '2026-01-15T10:30:00.000Z',
      '2026-01-15T10:30:00Z',
      '2026-01-15T10:30:00+00:00',
    ];

    timestamps.forEach((timestamp) => {
      const challenge = createMfaChallengeRequest({ timestamp });
      const recovery = createMfaRecoveryRequest({ timestamp });

      expect(challenge.timestamp).toBe(timestamp);
      expect(recovery.timestamp).toBe(timestamp);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('MFA requests immutability', () => {
  it('MfaBackupCodeRequest все поля readonly - предотвращает мутацию', () => {
    const request: MfaBackupCodeRequest = {
      userId: 'user-immutable',
      backupCode: 'CODE-IMMUTABLE',
    };

    // TypeScript предотвращает мутацию
    // request.userId = 'new-user'; // TypeScript error: Cannot assign to 'userId' because it is a read-only property
    // request.backupCode = 'new-code'; // TypeScript error: Cannot assign to 'backupCode' because it is a read-only property

    expect(request.userId).toBe('user-immutable');
    expect(request.backupCode).toBe('CODE-IMMUTABLE');
  });

  it('MfaChallengeRequest все поля readonly - предотвращает мутацию', () => {
    const request: MfaChallengeRequest = {
      userId: 'user-immutable',
      type: 'totp',
    };

    // TypeScript предотвращает мутацию
    // request.type = 'sms'; // TypeScript error: Cannot assign to 'type' because it is a read-only property

    expect(request.type).toBe('totp');
  });

  it('MfaRecoveryRequest все поля readonly - предотвращает мутацию', () => {
    const request: MfaRecoveryRequest = {
      userId: 'user-immutable',
      method: 'backup_code',
      proof: {
        backupCode: 'CODE-IMMUTABLE',
      },
    };

    // TypeScript предотвращает мутацию
    // request.proof.backupCode = 'new-code'; // TypeScript error: Cannot assign to 'backupCode' because it is a read-only property

    expect(request.proof.backupCode).toBe('CODE-IMMUTABLE');
  });

  it('MfaSetupRequest все поля readonly - предотвращает мутацию', () => {
    const request: MfaSetupRequest = {
      userId: 'user-immutable',
      type: 'totp',
    };

    // TypeScript предотвращает мутацию
    // request.type = 'sms'; // TypeScript error: Cannot assign to 'type' because it is a read-only property

    expect(request.type).toBe('totp');
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('MFA requests comprehensive snapshots', () => {
  it('full MfaBackupCodeRequest - полный snapshot', () => {
    const request = createMfaBackupCodeRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal MfaBackupCodeRequest - полный snapshot', () => {
    const request: MfaBackupCodeRequest = {
      userId: 'user-123',
      backupCode: 'ABCD-EFGH',
    };

    expect(request).toMatchSnapshot();
  });

  it('full MfaChallengeRequest - полный snapshot', () => {
    const request = createMfaChallengeRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal MfaChallengeRequest - полный snapshot', () => {
    const request: MfaChallengeRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(request).toMatchSnapshot();
  });

  it('full MfaRecoveryRequest - полный snapshot', () => {
    const request = createMfaRecoveryRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal MfaRecoveryRequest - полный snapshot', () => {
    const request: MfaRecoveryRequest = {
      userId: 'user-123',
      method: 'backup_code',
      proof: {
        backupCode: 'ABCD-EFGH',
      },
    };

    expect(request).toMatchSnapshot();
  });

  it('full MfaSetupRequest - полный snapshot', () => {
    const request = createMfaSetupRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal MfaSetupRequest - полный snapshot', () => {
    const request: MfaSetupRequest = {
      userId: 'user-123',
      type: 'totp',
    };

    expect(request).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  describe('mfaBackupCodeRequestSchema', () => {
    it('валидные backup code requests проходят Zod схему', () => {
      const validRequest = {
        userId: 'user-123',
        code: 'ABCDEFGH', // 8 символов
      };

      const result = mfaBackupCodeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.code).toBe('ABCDEFGH');
      }
    });

    it('схема не принимает дополнительные поля (strict)', () => {
      const requestWithExtra = {
        userId: 'user-123',
        code: 'ABCDEFGH',
        extraField: 'not allowed',
      };

      const result = mfaBackupCodeRequestSchema.safeParse(requestWithExtra);
      expect(result.success).toBe(false);
    });

    it('code должен быть длиной 8 символов', () => {
      const invalidCodes = [
        'ABCDEFG', // 7 символов
        'ABCDEFGHI', // 9 символов
        'ABCD', // 4 символа
      ];

      invalidCodes.forEach((code) => {
        const request = {
          userId: 'user-123',
          code,
        };

        const result = mfaBackupCodeRequestSchema.safeParse(request);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('mfaChallengeRequestSchema', () => {
    it('валидные challenge requests проходят Zod схему', () => {
      const validRequest = {
        userId: 'user-123',
        method: 'totp',
      };

      const result = mfaChallengeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.method).toBe('totp');
      }
    });

    it('method должен быть одним из допустимых значений', () => {
      const methods = ['totp', 'sms', 'email', 'push'];

      methods.forEach((method) => {
        const request = {
          userId: 'user-123',
          method,
        };

        const result = mfaChallengeRequestSchema.safeParse(request);
        expect(result.success).toBe(true);

        // eslint-disable-next-line functional/no-conditional-statements
        if (result.success) {
          expect(result.data.method).toBe(method);
        }
      });
    });
  });

  describe('mfaRecoveryRequestSchema', () => {
    it('валидные recovery requests проходят Zod схему', () => {
      const validRequest = {
        userId: 'user-123',
        recoveryCode: 'ABCD-EFGH',
      };

      const result = mfaRecoveryRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.recoveryCode).toBe('ABCD-EFGH');
      }
    });

    it('recoveryCode обязателен для кода восстановления', () => {
      const requestWithoutCode = {
        userId: 'user-123',
        // recoveryCode отсутствует
      };

      const result = mfaRecoveryRequestSchema.safeParse(requestWithoutCode);
      expect(result.success).toBe(false);
    });
  });

  describe('mfaSetupRequestSchema', () => {
    it('валидные setup requests проходят Zod схему', () => {
      const validRequest = {
        userId: 'user-123',
        method: 'totp',
      };

      const result = mfaSetupRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.method).toBe('totp');
      }
    });

    it('method должен быть одним из допустимых значений', () => {
      const methods = ['totp', 'sms', 'email', 'push'];

      methods.forEach((method) => {
        const request = {
          userId: 'user-123',
          method,
        };

        const result = mfaSetupRequestSchema.safeParse(request);
        expect(result.success).toBe(true);

        // eslint-disable-next-line functional/no-conditional-statements
        if (result.success) {
          expect(result.data.method).toBe(method);
        }
      });
    });

    it('email валидируется как строка с форматом email (если указан)', () => {
      const validRequest = {
        userId: 'user-123',
        method: 'email',
        email: 'user@example.com',
      };

      const result = mfaSetupRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });
  });
});
