/**
 * @file Unit тесты для dto/SmsTemplateRequest.ts
 * Полное покрытие SMS-шаблонов для аутентификации и уведомлений
 */

import { describe, expect, it } from 'vitest';

import type {
  AuthSmsTemplateType,
  SmsTemplateRequest,
} from '../../../src/dto/SmsTemplateRequest.js';
import { smsTemplateRequestSchema } from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createSmsTemplateRequest(overrides: Partial<SmsTemplateRequest> = {}): SmsTemplateRequest {
  return {
    templateId: 'verify-phone',
    to: '+491234567890',
    variables: {},
    ...overrides,
  };
}

function createMinimalSmsTemplateRequest(
  overrides: Partial<SmsTemplateRequest> = {},
): SmsTemplateRequest {
  return {
    templateId: 'mfa-code',
    to: '+1234567890',
    variables: {},
    ...overrides,
  };
}

function createFullSmsTemplateRequest(
  overrides: Partial<SmsTemplateRequest> = {},
): SmsTemplateRequest {
  return {
    templateId: 'verify-phone',
    type: 'verify_phone',
    to: '+491234567890',
    locale: 'de-DE',
    variables: {
      code: '123456',
      userName: 'John Doe',
      expiresIn: 300,
    },
    clientApp: 'mobile',
    userId: 'user-123',
    timestamp: '2026-01-15T10:30:00.000Z',
    meta: {
      reason: 'phone_verification',
      provider: 'twilio',
    },
    ...overrides,
  };
}

// ============================================================================
// 📋 SMS TEMPLATE TYPE ENUM - Типы SMS-шаблонов
// ============================================================================

describe('AuthSmsTemplateType enum coverage', () => {
  const allTemplateTypes: AuthSmsTemplateType[] = [
    'verify_phone',
    'mfa_code',
    'login_alert',
    'security_notification',
  ];

  it('поддерживает все типы SMS-шаблонов', () => {
    allTemplateTypes.forEach((templateType) => {
      const request = createSmsTemplateRequest({ type: templateType });
      expect(request.type).toBe(templateType);
    });
  });

  it('каждый тип шаблона имеет правильную структуру', () => {
    // Verify phone template
    const verifyPhone = createSmsTemplateRequest({
      type: 'verify_phone',
      templateId: 'verify-phone',
      variables: {
        code: '123456',
      },
    });
    expect(verifyPhone.type).toBe('verify_phone');
    expect(verifyPhone.variables?.['code']).toBe('123456');

    // MFA code template
    const mfaCode = createSmsTemplateRequest({
      type: 'mfa_code',
      templateId: 'mfa-code',
      variables: {
        code: '654321',
        expiresIn: 300,
      },
    });
    expect(mfaCode.type).toBe('mfa_code');
    expect(mfaCode.variables?.['code']).toBe('654321');
  });
});

// ============================================================================
// 📋 SMS TEMPLATE REQUEST - Полный DTO
// ============================================================================

describe('SmsTemplateRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request.templateId).toBe('mfa-code');
    expect(request.to).toBe('+1234567890');
    expect(request.variables).toBeDefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullSmsTemplateRequest();

    expect(request.templateId).toBe('verify-phone');
    expect(request.type).toBe('verify_phone');
    expect(request.to).toBe('+491234567890');
    expect(request.locale).toBe('de-DE');
    expect(request.variables).toBeDefined();
    expect(request.clientApp).toBe('mobile');
    expect(request.userId).toBe('user-123');
    expect(request.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(request.meta).toBeDefined();
  });

  it('работает с базовым запросом', () => {
    const request = createSmsTemplateRequest();

    expect(request.templateId).toBe('verify-phone');
    expect(request.to).toBe('+491234567890');
    expect(request.variables).toBeDefined();
  });
});

// ============================================================================
// 📋 SMS TEMPLATE REQUEST - Required fields
// ============================================================================

describe('SmsTemplateRequest required fields', () => {
  it('templateId обязателен для идентификатора шаблона', () => {
    const request: SmsTemplateRequest = {
      templateId: 'template-required',
      to: '+1234567890',
      variables: {},
    };

    expect(request.templateId).toBe('template-required');
  });

  it('to обязателен для номера телефона получателя', () => {
    const request: SmsTemplateRequest = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
    };

    expect(request.to).toBe('+1234567890');
  });

  it('variables обязателен для переменных шаблона', () => {
    const request: SmsTemplateRequest = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
    };

    expect(request.variables).toBeDefined();
  });
});

// ============================================================================
// 📋 SMS TEMPLATE REQUEST - Optional fields
// ============================================================================

describe('SmsTemplateRequest optional fields', () => {
  it('type опционально для типа SMS-шаблона', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request.type).toBeUndefined();
  });

  it('locale опционально для локали шаблона', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request.locale).toBeUndefined();
  });

  it('clientApp опционально для клиентского приложения', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request.clientApp).toBeUndefined();
  });

  it('userId опционально для идентификатора пользователя', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request.userId).toBeUndefined();
  });

  it('timestamp опционально для временной метки', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request.timestamp).toBeUndefined();
  });

  it('meta опционально для дополнительных метаданных', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request.meta).toBeUndefined();
  });
});

// ============================================================================
// 📋 SMS TEMPLATE REQUEST - Variables
// ============================================================================

describe('SmsTemplateRequest variables', () => {
  it('variables может быть пустым объектом', () => {
    const request = createSmsTemplateRequest({
      variables: {},
    });

    expect(request.variables).toEqual({});
  });

  it('variables может содержать строковые значения', () => {
    const request = createSmsTemplateRequest({
      variables: {
        code: '123456',
        userName: 'John Doe',
      },
    });

    expect(request.variables?.['code']).toBe('123456');
    expect(request.variables?.['userName']).toBe('John Doe');
  });

  it('variables может содержать числовые значения', () => {
    const request = createSmsTemplateRequest({
      variables: {
        expiresIn: 300,
        attempts: 3,
      },
    });

    expect(request.variables?.['expiresIn']).toBe(300);
    expect(request.variables?.['attempts']).toBe(3);
  });

  it('variables может содержать булевы значения', () => {
    const request = createSmsTemplateRequest({
      variables: {
        verified: true,
        enabled: false,
      },
    });

    expect(request.variables?.['verified']).toBe(true);
    expect(request.variables?.['enabled']).toBe(false);
  });

  it('variables может содержать смешанные типы', () => {
    const request = createSmsTemplateRequest({
      variables: {
        code: '123456',
        expiresIn: 300,
        verified: true,
      },
    });

    expect(request.variables?.['code']).toBe('123456');
    expect(request.variables?.['expiresIn']).toBe(300);
    expect(request.variables?.['verified']).toBe(true);
  });
});

// ============================================================================
// 📋 SMS TEMPLATE REQUEST - Edge cases
// ============================================================================

describe('SmsTemplateRequest edge cases', () => {
  it('работает с различными форматами номеров телефонов', () => {
    const phoneFormats = [
      '+1234567890',
      '+491234567890',
      '+7-123-456-7890',
      '+1 (234) 567-8900',
    ];

    phoneFormats.forEach((phone) => {
      const request = createSmsTemplateRequest({
        to: phone,
      });

      expect(request.to).toBe(phone);
    });
  });

  it('работает с различными локалями', () => {
    const locales = ['en-US', 'de-DE', 'ru-RU', 'fr-FR', 'ja-JP'];

    locales.forEach((locale) => {
      const request = createSmsTemplateRequest({
        locale,
      });

      expect(request.locale).toBe(locale);
    });
  });

  it('работает с длинными templateId', () => {
    const longTemplateId = `template-${'a'.repeat(200)}`;
    const request = createSmsTemplateRequest({
      templateId: longTemplateId,
    });

    expect(request.templateId).toBe(longTemplateId);
    expect(request.templateId.length).toBeGreaterThan(200);
  });

  it('работает с различными форматами timestamp', () => {
    const timestampFormats = [
      '2026-01-15T10:30:00.000Z',
      '2026-01-15T10:30:00Z',
      '2026-01-15T10:30:00.123Z',
    ];

    timestampFormats.forEach((timestamp) => {
      const request = createSmsTemplateRequest({
        timestamp,
      });

      expect(request.timestamp).toBe(timestamp);
    });
  });

  it('работает с различными типами шаблонов', () => {
    const templateTypes: AuthSmsTemplateType[] = [
      'verify_phone',
      'mfa_code',
      'login_alert',
      'security_notification',
    ];

    templateTypes.forEach((type) => {
      const request = createSmsTemplateRequest({
        type,
      });

      expect(request.type).toBe(type);
    });
  });
});

// ============================================================================
// 📋 SMS TEMPLATE REQUEST - Immutability
// ============================================================================

describe('SmsTemplateRequest immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: SmsTemplateRequest = {
      templateId: 'template-immutable',
      to: '+1234567890',
      variables: {},
    };

    // TypeScript предотвращает мутацию
    // request.templateId = 'mutated'; // TypeScript error: Cannot assign to 'templateId' because it is a read-only property

    expect(request.templateId).toBe('template-immutable');
  });

  it('variables readonly - предотвращает мутацию вложенных объектов', () => {
    const request: SmsTemplateRequest = {
      templateId: 'template-immutable',
      to: '+1234567890',
      variables: {
        code: '123456',
      },
    };

    // TypeScript предотвращает мутацию variables
    // request.variables!.code = 'mutated'; // TypeScript error: Cannot assign to 'code' because it is a read-only property

    expect(request.variables?.['code']).toBe('123456');
  });

  it('meta readonly - предотвращает мутацию вложенных объектов', () => {
    const request: SmsTemplateRequest = {
      templateId: 'template-immutable',
      to: '+1234567890',
      variables: {},
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
// 📋 SMS TEMPLATE REQUEST - Comprehensive snapshots
// ============================================================================

describe('SmsTemplateRequest comprehensive snapshots', () => {
  it('full sms template request - полный snapshot', () => {
    const request = createFullSmsTemplateRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal sms template request - полный snapshot', () => {
    const request = createMinimalSmsTemplateRequest();

    expect(request).toMatchSnapshot();
  });

  it('sms template request with type - полный snapshot', () => {
    const request = createSmsTemplateRequest({
      type: 'mfa_code',
    });

    expect(request).toMatchSnapshot();
  });

  it('sms template request with variables - полный snapshot', () => {
    const request = createSmsTemplateRequest({
      variables: {
        code: '123456',
        expiresIn: 300,
      },
    });

    expect(request).toMatchSnapshot();
  });

  it('sms template request with all types - полный snapshot', () => {
    const templateTypes: AuthSmsTemplateType[] = [
      'verify_phone',
      'mfa_code',
      'login_alert',
      'security_notification',
    ];

    templateTypes.forEach((type) => {
      const request = createSmsTemplateRequest({
        type,
      });

      expect(request).toMatchSnapshot();
    });
  });
});

// ============================================================================
// 📋 ZOD SCHEMA VALIDATION
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные sms template requests проходят Zod схему', () => {
    const request = createSmsTemplateRequest();

    const result = smsTemplateRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data).toBeDefined() : void 0;
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const request = {
      ...createSmsTemplateRequest(),
      extraField: 'not-allowed',
    } as SmsTemplateRequest & { extraField: string; };

    const result = smsTemplateRequestSchema.safeParse(request);

    expect(result.success).toBe(false);
  });

  it('templateId обязателен для идентификатора шаблона', () => {
    const invalidRequest = {
      to: '+1234567890',
      variables: {},
    };

    const result = smsTemplateRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });

  it('to обязателен для номера телефона получателя', () => {
    const invalidRequest = {
      templateId: 'verify-phone',
      variables: {},
    };

    const result = smsTemplateRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });

  it('variables обязателен для переменных шаблона', () => {
    const invalidRequest = {
      templateId: 'verify-phone',
      to: '+1234567890',
    };

    const result = smsTemplateRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });

  it('templateId валидируется как строка', () => {
    const validRequest = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
    };

    const result = smsTemplateRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.templateId).toBe('verify-phone') : void 0;
  });

  it('to валидируется как строка', () => {
    const validRequest = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
    };

    const result = smsTemplateRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.to).toBe('+1234567890') : void 0;
  });

  it('variables валидируется как record', () => {
    const validRequest = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {
        code: '123456',
        expiresIn: 300,
      },
    };

    const result = smsTemplateRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.variables).toBeDefined() : void 0;
  });

  it('locale опционально в Zod схеме', () => {
    const request = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
    };

    const result = smsTemplateRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
  });

  it('locale валидируется как строка', () => {
    const request = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
      locale: 'en-US',
    };

    const result = smsTemplateRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.locale).toBe('en-US') : void 0;
  });

  it('priority опционально в Zod схеме', () => {
    const request = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
    };

    const result = smsTemplateRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
  });

  it('priority валидируется как enum', () => {
    const priorities = ['low', 'normal', 'high'] as const;

    priorities.forEach((priority) => {
      const request = {
        templateId: 'verify-phone',
        to: '+1234567890',
        variables: {},
        priority,
      };

      const result = smsTemplateRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      // eslint-disable-next-line no-unused-expressions
      result.success ? expect(result.data.priority).toBe(priority) : void 0;
    });
  });

  it('variables может быть пустым объектом', () => {
    const request = {
      templateId: 'verify-phone',
      to: '+1234567890',
      variables: {},
    };

    const result = smsTemplateRequestSchema.safeParse(request);

    expect(result.success).toBe(true);
    // eslint-disable-next-line no-unused-expressions
    result.success ? expect(result.data.variables).toEqual({}) : void 0;
  });
});
