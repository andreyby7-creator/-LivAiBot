/**
 * @file Unit тесты для domain/VerifyPhoneRequest.ts
 * Полное покрытие запроса подтверждения телефона
 */

import { describe, expect, it } from 'vitest';
import type { ClientContext, VerifyPhoneRequest } from '../../../src/domain/VerifyPhoneRequest.js';
import { verifyPhoneRequestSchema } from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createClientContext(overrides: Partial<ClientContext> = {}): ClientContext {
  return {
    ip: '192.168.1.1',
    deviceId: 'device-123',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    locale: 'en-US',
    timezone: 'UTC',
    geo: {
      lat: 55.7558,
      lng: 37.6173,
    },
    sessionId: 'session-abc',
    appVersion: '1.0.3',
    ...overrides,
  };
}

function createVerifyPhoneRequest(overrides: Partial<VerifyPhoneRequest> = {}): VerifyPhoneRequest {
  return {
    dtoVersion: '1.0',
    phone: '+79991234567',
    code: '123456',
    clientContext: createClientContext(),
    redirectUrl: 'https://app.example.com/verified',
    ...overrides,
  };
}

function createMinimalVerifyPhoneRequest(
  overrides: Partial<VerifyPhoneRequest> = {},
): VerifyPhoneRequest {
  return {
    phone: '+1234567890',
    code: '123456',
    ...overrides,
  };
}

function createFullVerifyPhoneRequest(
  overrides: Partial<VerifyPhoneRequest> = {},
): VerifyPhoneRequest {
  return {
    dtoVersion: '1.1',
    phone: '+491234567890',
    code: '654321',
    clientContext: createClientContext({
      ip: '10.0.0.1',
      deviceId: 'device-full',
      userAgent: 'Mozilla/5.0 (Linux; Android 10)',
      locale: 'ru-RU',
      timezone: 'Europe/Moscow',
      geo: {
        lat: 59.9343,
        lng: 30.3351,
      },
      sessionId: 'session-full',
      appVersion: '2.0.0',
    }),
    redirectUrl: 'https://app.example.com/verified?source=phone',
    ...overrides,
  };
}

// ============================================================================
// 📋 VERIFY PHONE REQUEST - Полный DTO
// ============================================================================

describe('VerifyPhoneRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля phone и code)', () => {
    const request = createMinimalVerifyPhoneRequest();

    expect(request.phone).toBe('+1234567890');
    expect(request.code).toBe('123456');
    expect(request.dtoVersion).toBeUndefined();
    expect(request.clientContext).toBeUndefined();
    expect(request.redirectUrl).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullVerifyPhoneRequest();

    expect(request.dtoVersion).toBe('1.1');
    expect(request.phone).toBe('+491234567890');
    expect(request.code).toBe('654321');
    expect(request.clientContext).toBeDefined();
    expect(request.redirectUrl).toBe('https://app.example.com/verified?source=phone');
  });

  it('работает с базовым запросом', () => {
    const request = createVerifyPhoneRequest();

    expect(request.phone).toBe('+79991234567');
    expect(request.code).toBe('123456');
    expect(request.clientContext).toBeDefined();
  });
});

// ============================================================================
// 📋 VERIFY PHONE REQUEST - Required fields
// ============================================================================

describe('VerifyPhoneRequest required fields', () => {
  it('phone обязателен для номера телефона', () => {
    const request: VerifyPhoneRequest = {
      phone: '+1234567890',
      code: '123456',
    };

    expect(request.phone).toBe('+1234567890');
  });

  it('code обязателен для кода подтверждения', () => {
    const request: VerifyPhoneRequest = {
      phone: '+1234567890',
      code: '123456',
    };

    expect(request.code).toBe('123456');
  });

  it('phone может быть различными форматами', () => {
    const formats = [
      '+1234567890',
      '+79991234567',
      '+491234567890',
      '+7-999-123-45-67',
      '+1 (234) 567-8900',
    ];

    formats.forEach((phone) => {
      const request = createVerifyPhoneRequest({
        phone,
      });

      expect(request.phone).toBe(phone);
    });
  });

  it('code может быть различной длины', () => {
    const codes = ['1234', '12345', '123456', '1234567', '12345678'];

    codes.forEach((code) => {
      const request = createVerifyPhoneRequest({
        code,
      });

      expect(request.code).toBe(code);
    });
  });
});

// ============================================================================
// 📋 VERIFY PHONE REQUEST - Code (numeric code)
// ============================================================================

describe('VerifyPhoneRequest code (numeric code)', () => {
  it('code должен быть numeric (только цифры)', () => {
    const numericCodes = ['123456', '000000', '999999', '012345'];

    numericCodes.forEach((code) => {
      const request = createVerifyPhoneRequest({
        code,
      });

      expect(request.code).toBe(code);
      expect(/^\d+$/.test(code)).toBe(true);
    });
  });

  it('code может быть 4-значным', () => {
    const request = createVerifyPhoneRequest({
      code: '1234',
    });

    expect(request.code).toBe('1234');
    expect(request.code.length).toBe(4);
  });

  it('code может быть 6-значным', () => {
    const request = createVerifyPhoneRequest({
      code: '123456',
    });

    expect(request.code).toBe('123456');
    expect(request.code.length).toBe(6);
  });

  it('code может быть 8-значным', () => {
    const request = createVerifyPhoneRequest({
      code: '12345678',
    });

    expect(request.code).toBe('12345678');
    expect(request.code.length).toBe(8);
  });

  it('code может быть различной длины (4-8 цифр)', () => {
    const lengths = [4, 5, 6, 7, 8];

    lengths.forEach((length) => {
      const code = '1'.repeat(length);
      const request = createVerifyPhoneRequest({
        code,
      });

      expect(request.code).toBe(code);
      expect(request.code.length).toBe(length);
    });
  });

  it('code может начинаться с нуля', () => {
    const request = createVerifyPhoneRequest({
      code: '012345',
    });

    expect(request.code).toBe('012345');
    expect(request.code.startsWith('0')).toBe(true);
  });

  it('code может состоять только из нулей', () => {
    const request = createVerifyPhoneRequest({
      code: '000000',
    });

    expect(request.code).toBe('000000');
  });
});

// ============================================================================
// 📋 VERIFY PHONE REQUEST - Optional fields
// ============================================================================

describe('VerifyPhoneRequest optional fields', () => {
  it('dtoVersion опционально для версии DTO', () => {
    const request = createMinimalVerifyPhoneRequest();

    expect(request.dtoVersion).toBeUndefined();
  });

  it('clientContext опционально для клиентского контекста', () => {
    const request = createMinimalVerifyPhoneRequest();

    expect(request.clientContext).toBeUndefined();
  });

  it('redirectUrl опционально для redirect URL', () => {
    const request = createMinimalVerifyPhoneRequest();

    expect(request.redirectUrl).toBeUndefined();
  });
});

// ============================================================================
// 📋 VERIFY PHONE REQUEST - ClientContext
// ============================================================================

describe('VerifyPhoneRequest clientContext', () => {
  it('clientContext может содержать IP адрес для аудита', () => {
    const request = createVerifyPhoneRequest({
      clientContext: createClientContext({
        ip: '192.168.1.1',
      }),
    });

    expect(request.clientContext?.ip).toBe('192.168.1.1');
  });

  it('clientContext может содержать deviceId для аудита', () => {
    const request = createVerifyPhoneRequest({
      clientContext: createClientContext({
        deviceId: 'device-xyz',
      }),
    });

    expect(request.clientContext?.deviceId).toBe('device-xyz');
  });

  it('clientContext может содержать userAgent для аудита', () => {
    const request = createVerifyPhoneRequest({
      clientContext: createClientContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }),
    });

    expect(request.clientContext?.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  });

  it('clientContext может содержать geo координаты для аудита', () => {
    const request = createVerifyPhoneRequest({
      clientContext: createClientContext({
        geo: {
          lat: 55.7558,
          lng: 37.6173,
        },
      }),
    });

    expect(request.clientContext?.geo?.lat).toBe(55.7558);
    expect(request.clientContext?.geo?.lng).toBe(37.6173);
  });

  it('clientContext может содержать все поля для аудита', () => {
    const request = createFullVerifyPhoneRequest();

    expect(request.clientContext?.ip).toBe('10.0.0.1');
    expect(request.clientContext?.deviceId).toBe('device-full');
    expect(request.clientContext?.userAgent).toBe('Mozilla/5.0 (Linux; Android 10)');
    expect(request.clientContext?.locale).toBe('ru-RU');
    expect(request.clientContext?.timezone).toBe('Europe/Moscow');
    expect(request.clientContext?.geo).toBeDefined();
    expect(request.clientContext?.sessionId).toBe('session-full');
    expect(request.clientContext?.appVersion).toBe('2.0.0');
  });
});

// ============================================================================
// 📋 VERIFY PHONE REQUEST - Edge cases
// ============================================================================

describe('VerifyPhoneRequest edge cases', () => {
  it('работает с различными версиями DTO', () => {
    const versions: ('1.0' | '1.1')[] = ['1.0', '1.1'];

    versions.forEach((version) => {
      const request = createVerifyPhoneRequest({
        dtoVersion: version,
      });

      expect(request.dtoVersion).toBe(version);
    });
  });

  it('работает с различными форматами номеров телефонов', () => {
    const phoneFormats = [
      '+1234567890',
      '+79991234567',
      '+491234567890',
      '+7-999-123-45-67',
      '+1 (234) 567-8900',
    ];

    phoneFormats.forEach((phone) => {
      const request = createVerifyPhoneRequest({
        phone,
      });

      expect(request.phone).toBe(phone);
    });
  });

  it('работает с различными форматами redirectUrl', () => {
    const urls = [
      'https://app.example.com/verified',
      'https://app.example.com/verified?source=phone',
      'https://app.example.com/verified#success',
      'http://localhost:3000/verified',
    ];

    urls.forEach((redirectUrl) => {
      const request = createVerifyPhoneRequest({
        redirectUrl,
      });

      expect(request.redirectUrl).toBe(redirectUrl);
    });
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
      const request = createVerifyPhoneRequest({
        clientContext: createClientContext({
          ip,
        }),
      });

      expect(request.clientContext?.ip).toBe(ip);
    });
  });
});

// ============================================================================
// 📋 VERIFY PHONE REQUEST - Immutability
// ============================================================================

describe('VerifyPhoneRequest immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: VerifyPhoneRequest = {
      phone: '+1234567890',
      code: '123456',
    };

    // TypeScript предотвращает мутацию
    // request.phone = '+9999999999'; // TypeScript error: Cannot assign to 'phone' because it is a read-only property
    // request.code = '999999'; // TypeScript error: Cannot assign to 'code' because it is a read-only property

    expect(request.phone).toBe('+1234567890');
    expect(request.code).toBe('123456');
  });

  it('clientContext readonly - предотвращает мутацию вложенных объектов', () => {
    const request: VerifyPhoneRequest = {
      phone: '+1234567890',
      code: '123456',
      clientContext: createClientContext({
        ip: '192.168.1.1',
        deviceId: 'device-immutable',
      }),
    };

    // TypeScript предотвращает мутацию clientContext
    // request.clientContext!.ip = 'mutated'; // TypeScript error: Cannot assign to 'ip' because it is a read-only property

    expect(request.clientContext?.ip).toBe('192.168.1.1');
  });

  it('clientContext geo readonly - предотвращает мутацию координат', () => {
    const request: VerifyPhoneRequest = {
      phone: '+1234567890',
      code: '123456',
      clientContext: createClientContext({
        geo: {
          lat: 55.7558,
          lng: 37.6173,
        },
      }),
    };

    // TypeScript предотвращает мутацию geo
    // request.clientContext!.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(request.clientContext?.geo?.lat).toBe(55.7558);
    expect(request.clientContext?.geo?.lng).toBe(37.6173);
  });
});

// ============================================================================
// 📋 VERIFY PHONE REQUEST - Comprehensive snapshots
// ============================================================================

describe('VerifyPhoneRequest comprehensive snapshots', () => {
  it('full verify phone request - полный snapshot', () => {
    const request = createFullVerifyPhoneRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal verify phone request - полный snapshot', () => {
    const request = createMinimalVerifyPhoneRequest();

    expect(request).toMatchSnapshot();
  });

  it('verify phone request with clientContext - полный snapshot', () => {
    const request = createVerifyPhoneRequest({
      clientContext: createClientContext(),
    });

    expect(request).toMatchSnapshot();
  });

  it('verify phone request with redirectUrl - полный snapshot', () => {
    const request = createVerifyPhoneRequest({
      redirectUrl: 'https://app.example.com/verified',
    });

    expect(request).toMatchSnapshot();
  });

  it('verify phone request with different code lengths - полный snapshot', () => {
    const codeLengths = [4, 5, 6, 7, 8];

    codeLengths.forEach((length) => {
      const code = '1'.repeat(length);
      const request = createVerifyPhoneRequest({
        code,
      });

      expect(request).toMatchSnapshot();
    });
  });
});

// ============================================================================
// 📋 ZOD SCHEMA VALIDATION
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные verify phone requests проходят Zod схему', () => {
    const validRequest = {
      phone: '+1234567890',
      code: '123456',
    };

    const result = verifyPhoneRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    void (result.success && expect(result.data.phone).toBe('+1234567890'));
    void (result.success && expect(result.data.code).toBe('123456'));
  });

  it('phone обязателен для номера телефона', () => {
    const invalidRequest = {
      code: '123456',
    };

    const result = verifyPhoneRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
    void (!result.success
      && expect(result.error.issues.some((issue) => issue.path.includes('phone'))).toBe(true));
  });

  it('code обязателен для кода подтверждения', () => {
    const invalidRequest = {
      phone: '+1234567890',
    };

    const result = verifyPhoneRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
    void (!result.success
      && expect(result.error.issues.some((issue) => issue.path.includes('code'))).toBe(true));
  });

  it('code валидируется как строка', () => {
    const validRequest = {
      phone: '+1234567890',
      code: '123456',
    };

    const result = verifyPhoneRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    void (result.success && expect(typeof result.data.code).toBe('string'));
  });

  it('code должен быть numeric (только цифры)', () => {
    const validCodes = ['123456', '000000', '999999', '012345'];

    validCodes.forEach((code) => {
      const request = {
        phone: '+1234567890',
        code,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      void (result.success && expect(result.data.code).toBe(code));
    });
  });

  it('code должен быть numeric (недопустимы буквы)', () => {
    const invalidCodes = ['12345a', 'abc123', '12-345', '12.345'];

    invalidCodes.forEach((code) => {
      const request = {
        phone: '+1234567890',
        code,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
      void (!result.success
        && expect(result.error.issues.some((issue) => issue.path.includes('code'))).toBe(true));
    });
  });

  it('code может быть различной длины (4-8 цифр)', () => {
    const validLengths = [4, 5, 6, 7, 8];

    validLengths.forEach((length) => {
      const code = '1'.repeat(length);
      const request = {
        phone: '+1234567890',
        code,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      void (result.success && expect(result.data.code.length).toBe(length));
    });
  });

  it('code не может быть короче 4 цифр', () => {
    const invalidCodes = ['1', '12', '123'];

    invalidCodes.forEach((code) => {
      const request = {
        phone: '+1234567890',
        code,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
      void (!result.success
        && expect(result.error.issues.some((issue) => issue.path.includes('code'))).toBe(true));
    });
  });

  it('code не может быть длиннее 8 цифр', () => {
    const invalidCodes = ['123456789', '1234567890'];

    invalidCodes.forEach((code) => {
      const request = {
        phone: '+1234567890',
        code,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
      void (!result.success
        && expect(result.error.issues.some((issue) => issue.path.includes('code'))).toBe(true));
    });
  });

  it('dtoVersion опционально для версии DTO', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    void (result.success && expect(result.data.dtoVersion).toBeUndefined());
  });

  it('dtoVersion валидируется как enum', () => {
    const validVersions: ('1.0' | '1.1')[] = ['1.0', '1.1'];

    validVersions.forEach((dtoVersion) => {
      const request = {
        phone: '+1234567890',
        code: '123456',
        dtoVersion,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      void (result.success && expect(result.data.dtoVersion).toBe(dtoVersion));
    });
  });

  it('clientContext опционально для клиентского контекста', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    void (result.success && expect(result.data.clientContext).toBeUndefined());
  });

  it('clientContext может содержать IP для аудита', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
      clientContext: {
        ip: '192.168.1.1',
      },
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    void (result.success && expect(result.data.clientContext?.ip).toBe('192.168.1.1'));
  });

  it('clientContext может содержать deviceId для аудита', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
      clientContext: {
        deviceId: 'device-audit',
      },
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    void (result.success && expect(result.data.clientContext?.deviceId).toBe('device-audit'));
  });

  it('clientContext может содержать userAgent для аудита', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
      clientContext: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    void (result.success
      && expect(result.data.clientContext?.userAgent).toBe(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ));
  });

  it('clientContext может содержать geo координаты для аудита', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
      clientContext: {
        geo: {
          lat: 55.7558,
          lng: 37.6173,
        },
      },
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    void (result.success && expect(result.data.clientContext?.geo?.lat).toBe(55.7558));
    void (result.success && expect(result.data.clientContext?.geo?.lng).toBe(37.6173));
  });

  it('redirectUrl опционально для redirect URL', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    void (result.success && expect(result.data.redirectUrl).toBeUndefined());
  });

  it('redirectUrl валидируется как валидный URL', () => {
    const validUrls = [
      'https://app.example.com/verified',
      'https://app.example.com/verified?source=phone',
      'http://localhost:3000/verified',
    ];

    validUrls.forEach((redirectUrl) => {
      const request = {
        phone: '+1234567890',
        code: '123456',
        redirectUrl,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      void (result.success && expect(result.data.redirectUrl).toBe(redirectUrl));
    });
  });

  it('redirectUrl отклоняет невалидные URL', () => {
    const invalidUrls = ['not-a-url', '//invalid-url'];

    invalidUrls.forEach((redirectUrl) => {
      const request = {
        phone: '+1234567890',
        code: '123456',
        redirectUrl,
      };

      const result = verifyPhoneRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
      void (!result.success
        && expect(result.error.issues.some((issue) => issue.path.includes('redirectUrl'))).toBe(
          true,
        ));
    });
  });

  it('схема строгая - отклоняет лишние поля', () => {
    const request = {
      phone: '+1234567890',
      code: '123456',
      extraField: 'should-be-rejected',
    };

    const result = verifyPhoneRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
    void (!result.success
      && expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(
        true,
      ));
  });
});
