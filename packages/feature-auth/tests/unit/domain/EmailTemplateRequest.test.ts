/**
 * @file Unit тесты для domain/EmailTemplateRequest.ts
 * Полное покрытие email-шаблонов для аутентификации и уведомлений
 */

import { describe, expect, it } from 'vitest';
import type {
  AuthEmailTemplateType,
  EmailTemplateRequest,
} from '../../../src/domain/EmailTemplateRequest.js';
import { emailTemplateRequestSchema } from '../../../src/schemas.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createEmailTemplateRequest(
  overrides: Partial<EmailTemplateRequest> = {},
): EmailTemplateRequest {
  return {
    templateId: 'verify-email',
    to: 'user@example.com',
    variables: {},
    ...overrides,
  };
}

function createMinimalEmailTemplateRequest(
  overrides: Partial<EmailTemplateRequest> = {},
): EmailTemplateRequest {
  return {
    templateId: 'password-reset',
    to: 'test@example.com',
    variables: {},
    ...overrides,
  };
}

function createFullEmailTemplateRequest(
  overrides: Partial<EmailTemplateRequest> = {},
): EmailTemplateRequest {
  return {
    templateId: 'verify-email',
    type: 'verify_email',
    to: 'user@example.com',
    locale: 'en-US',
    variables: {
      verificationLink: 'https://app.example.com/verify?token=abc123',
      userName: 'John Doe',
      expiresIn: 3600,
    },
    clientApp: 'web',
    userId: 'user-123',
    timestamp: '2026-01-15T10:30:00.000Z',
    meta: {
      reason: 'email_verification',
      provider: 'sendgrid',
    },
    ...overrides,
  };
}

// ============================================================================
// 🎯 EMAIL TEMPLATE TYPE ENUM - Типы email-шаблонов
// ============================================================================

describe('AuthEmailTemplateType enum coverage', () => {
  const allTemplateTypes: AuthEmailTemplateType[] = [
    'verify_email',
    'password_reset',
    'mfa_code',
    'login_alert',
    'security_notification',
  ];

  it('поддерживает все типы email-шаблонов', () => {
    allTemplateTypes.forEach((templateType) => {
      const request = createEmailTemplateRequest({ type: templateType });
      expect(request.type).toBe(templateType);
    });
  });

  it('каждый тип шаблона имеет правильную структуру', () => {
    // Verify email template
    const verifyEmail = createEmailTemplateRequest({
      type: 'verify_email',
      templateId: 'verify-email',
      variables: {
        verificationLink: 'https://app.example.com/verify?token=abc',
      },
    });
    expect(verifyEmail.type).toBe('verify_email');
    expect(verifyEmail.variables['verificationLink']).toBe(
      'https://app.example.com/verify?token=abc',
    );

    // Password reset template
    const passwordReset = createEmailTemplateRequest({
      type: 'password_reset',
      templateId: 'password-reset',
      variables: {
        resetLink: 'https://app.example.com/reset?token=xyz',
        expiresIn: 3600,
      },
    });
    expect(passwordReset.type).toBe('password_reset');
    expect(passwordReset.variables['resetLink']).toBe('https://app.example.com/reset?token=xyz');

    // MFA code template
    const mfaCode = createEmailTemplateRequest({
      type: 'mfa_code',
      templateId: 'mfa-code',
      variables: {
        code: '123456',
        expiresIn: 300,
      },
    });
    expect(mfaCode.type).toBe('mfa_code');
    expect(mfaCode.variables['code']).toBe('123456');

    // Login alert template
    const loginAlert = createEmailTemplateRequest({
      type: 'login_alert',
      templateId: 'login-alert',
      variables: {
        location: 'New York, US',
        device: 'Chrome on Windows',
        timestamp: '2026-01-15T10:30:00Z',
      },
    });
    expect(loginAlert.type).toBe('login_alert');
    expect(loginAlert.variables['location']).toBe('New York, US');

    // Security notification template
    const securityNotification = createEmailTemplateRequest({
      type: 'security_notification',
      templateId: 'security-notification',
      variables: {
        event: 'password_changed',
        timestamp: '2026-01-15T10:30:00Z',
      },
    });
    expect(securityNotification.type).toBe('security_notification');
    expect(securityNotification.variables['event']).toBe('password_changed');
  });
});

// ============================================================================
// 📋 EMAIL TEMPLATE REQUEST DTO - Полный DTO
// ============================================================================

describe('EmailTemplateRequest полный DTO', () => {
  it('создает минимальный запрос с обязательными полями', () => {
    const request = createMinimalEmailTemplateRequest();

    expect(request.templateId).toBe('password-reset');
    expect(request.to).toBe('test@example.com');
    expect(request.variables).toEqual({});
    expect(request.type).toBeUndefined();
    expect(request.locale).toBeUndefined();
    expect(request.clientApp).toBeUndefined();
    expect(request.userId).toBeUndefined();
    expect(request.timestamp).toBeUndefined();
    expect(request.meta).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createFullEmailTemplateRequest({
      templateId: 'custom-template',
      type: 'verify_email',
      to: 'custom@example.com',
      locale: 'ru-RU',
      variables: {
        customVar: 'value',
        numberVar: 42,
        boolVar: true,
      },
      clientApp: 'mobile',
      userId: 'user-456',
      timestamp: '2026-01-15T12:00:00.000Z',
      meta: {
        customMeta: 'data',
      },
    });

    expect(request.templateId).toBe('custom-template');
    expect(request.type).toBe('verify_email');
    expect(request.to).toBe('custom@example.com');
    expect(request.locale).toBe('ru-RU');
    expect(request.variables['customVar']).toBe('value');
    expect(request.variables['numberVar']).toBe(42);
    expect(request.variables['boolVar']).toBe(true);
    expect(request.clientApp).toBe('mobile');
    expect(request.userId).toBe('user-456');
    expect(request.timestamp).toBe('2026-01-15T12:00:00.000Z');
    expect(request.meta?.['customMeta']).toBe('data');
  });

  it('templateId обязателен и является строкой', () => {
    const request = createEmailTemplateRequest({ templateId: 'custom-template-id' });

    expect(request.templateId).toBe('custom-template-id');
    expect(typeof request.templateId).toBe('string');
    expect(request.templateId.length).toBeGreaterThan(0);
  });

  it('to обязателен и является валидным email', () => {
    const validEmails = [
      'user@example.com',
      'test.user@example.co.uk',
      'user+tag@example.com',
      'user_name@example-domain.com',
    ];

    validEmails.forEach((email) => {
      const request = createEmailTemplateRequest({ to: email });
      expect(request.to).toBe(email);
    });
  });

  it('работает с различными локалями', () => {
    const locales = ['en-US', 'ru-RU', 'de-DE', 'fr-FR', 'ja-JP', 'zh-CN'];

    locales.forEach((locale) => {
      const request = createEmailTemplateRequest({ locale });
      expect(request.locale).toBe(locale);
    });
  });

  it('работает с различными clientApp значениями', () => {
    const clientApps = ['web', 'mobile', 'api', 'admin', 'desktop'];

    clientApps.forEach((clientApp) => {
      const request = createEmailTemplateRequest({ clientApp });
      expect(request.clientApp).toBe(clientApp);
    });
  });
});

// ============================================================================
// 🔑 REQUIRED FIELDS - Обязательные поля
// ============================================================================

describe('EmailTemplateRequest required fields', () => {
  it('templateId обязателен и является строкой', () => {
    const request = createEmailTemplateRequest({ templateId: 'required-template' });

    expect(request.templateId).toBe('required-template');
    expect(typeof request.templateId).toBe('string');
    expect(request.templateId.length).toBeGreaterThan(0);
  });

  it('to обязателен и является email адресом', () => {
    const request = createEmailTemplateRequest({ to: 'required@example.com' });

    expect(request.to).toBe('required@example.com');
    expect(typeof request.to).toBe('string');
    expect(request.to).toContain('@');
  });

  it('variables обязателен в DTO и схеме (может быть пустым объектом)', () => {
    // В DTO variables обязателен (может быть пустым объектом)
    const requestWithEmptyVariables = createMinimalEmailTemplateRequest();
    expect(requestWithEmptyVariables.variables).toEqual({});

    // В схеме variables также обязателен
    const requestForSchema = {
      to: 'user@example.com',
      templateId: 'template',
      variables: {},
    };

    const result = emailTemplateRequestSchema.safeParse(requestForSchema);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// 🔄 OPTIONAL FIELDS - Опциональные поля
// ============================================================================

describe('EmailTemplateRequest optional fields', () => {
  it('type опционально для типа email-сценария', () => {
    const requestWithType = createEmailTemplateRequest({ type: 'verify_email' });
    const requestWithoutType = createMinimalEmailTemplateRequest();

    expect(requestWithType.type).toBe('verify_email');
    expect(requestWithoutType.type).toBeUndefined();
  });

  it('locale опционально для локализации шаблона', () => {
    const requestWithLocale = createEmailTemplateRequest({ locale: 'en-US' });
    const requestWithoutLocale = createMinimalEmailTemplateRequest();

    expect(requestWithLocale.locale).toBe('en-US');
    expect(requestWithoutLocale.locale).toBeUndefined();
  });

  it('variables обязателен, но может быть пустым объектом', () => {
    const requestWithVariables = createEmailTemplateRequest({
      variables: {
        key: 'value',
        number: 42,
        bool: true,
      },
    });
    const requestWithEmptyVariables = createMinimalEmailTemplateRequest();

    expect(requestWithVariables.variables['key']).toBe('value');
    expect(requestWithVariables.variables['number']).toBe(42);
    expect(requestWithVariables.variables['bool']).toBe(true);
    expect(requestWithEmptyVariables.variables).toEqual({});
  });

  it('clientApp опционально для клиентского приложения', () => {
    const requestWithClientApp = createEmailTemplateRequest({ clientApp: 'web' });
    const requestWithoutClientApp = createMinimalEmailTemplateRequest();

    expect(requestWithClientApp.clientApp).toBe('web');
    expect(requestWithoutClientApp.clientApp).toBeUndefined();
  });

  it('userId опционально для идентификатора пользователя', () => {
    const requestWithUserId = createEmailTemplateRequest({ userId: 'user-123' });
    const requestWithoutUserId = createMinimalEmailTemplateRequest();

    expect(requestWithUserId.userId).toBe('user-123');
    expect(requestWithoutUserId.userId).toBeUndefined();
  });

  it('timestamp опционально для временной метки', () => {
    const requestWithTimestamp = createEmailTemplateRequest({
      timestamp: '2026-01-15T10:30:00.000Z',
    });
    const requestWithoutTimestamp = createMinimalEmailTemplateRequest();

    expect(requestWithTimestamp.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(requestWithoutTimestamp.timestamp).toBeUndefined();
  });

  it('meta опционально для дополнительного контекста', () => {
    const requestWithMeta = createEmailTemplateRequest({
      meta: {
        reason: 'verification',
        provider: 'sendgrid',
      },
    });
    const requestWithoutMeta = createMinimalEmailTemplateRequest();

    expect(requestWithMeta.meta?.['reason']).toBe('verification');
    expect(requestWithMeta.meta?.['provider']).toBe('sendgrid');
    expect(requestWithoutMeta.meta).toBeUndefined();
  });
});

// ============================================================================
// 📝 VARIABLES - Переменные шаблона
// ============================================================================

describe('EmailTemplateRequest variables', () => {
  it('поддерживает переменные различных типов', () => {
    const request = createEmailTemplateRequest({
      variables: {
        stringVar: 'text value',
        numberVar: 42,
        boolVar: true,
        floatVar: 3.14,
      },
    });

    expect(request.variables['stringVar']).toBe('text value');
    expect(request.variables['numberVar']).toBe(42);
    expect(request.variables['boolVar']).toBe(true);
    expect(request.variables['floatVar']).toBe(3.14);
  });

  it('поддерживает пустой объект variables', () => {
    const request = createEmailTemplateRequest({
      variables: {},
    });

    expect(request.variables).toEqual({});
  });

  it('поддерживает сложные переменные для различных шаблонов', () => {
    // Verification email variables
    const verifyRequest = createEmailTemplateRequest({
      type: 'verify_email',
      variables: {
        verificationLink: 'https://app.example.com/verify?token=abc',
        userName: 'John Doe',
        expiresIn: 3600,
      },
    });

    expect(verifyRequest.variables['verificationLink']).toBe(
      'https://app.example.com/verify?token=abc',
    );
    expect(verifyRequest.variables['userName']).toBe('John Doe');
    expect(verifyRequest.variables['expiresIn']).toBe(3600);

    // Password reset variables
    const resetRequest = createEmailTemplateRequest({
      type: 'password_reset',
      variables: {
        resetLink: 'https://app.example.com/reset?token=xyz',
        expiresIn: 1800,
      },
    });

    expect(resetRequest.variables['resetLink']).toBe('https://app.example.com/reset?token=xyz');
    expect(resetRequest.variables['expiresIn']).toBe(1800);
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('EmailTemplateRequest edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const request = createEmailTemplateRequest({
      locale: '',
      clientApp: '',
      userId: '',
      timestamp: '',
    });

    expect(request.locale).toBe('');
    expect(request.clientApp).toBe('');
    expect(request.userId).toBe('');
    expect(request.timestamp).toBe('');
  });

  it('timestamp может быть в ISO 8601 формате', () => {
    const requestWithTimestamp = createEmailTemplateRequest({
      timestamp: '2026-01-15T10:30:00.000Z',
    });

    const requestWithoutTimestamp = createMinimalEmailTemplateRequest();

    expect(requestWithTimestamp.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(requestWithTimestamp.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(requestWithoutTimestamp.timestamp).toBeUndefined();
  });

  it('поддерживает длинные templateId', () => {
    const longTemplateId = 'very-long-template-id-with-many-segments-and-descriptive-name';

    const request = createEmailTemplateRequest({ templateId: longTemplateId });

    expect(request.templateId).toBe(longTemplateId);
    expect(request.templateId.length).toBeGreaterThan(50);
  });

  it('meta может содержать любые данные', () => {
    const request = createEmailTemplateRequest({
      meta: {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        arrayValue: [1, 2, 3],
        nestedObject: {
          key: 'value',
        },
        nullValue: null,
      },
    });

    expect(request.meta?.['stringValue']).toBe('test');
    expect(request.meta?.['numberValue']).toBe(42);
    expect(request.meta?.['booleanValue']).toBe(true);
    expect(Array.isArray(request.meta?.['arrayValue'])).toBe(true);
    expect(request.meta?.['nestedObject']).toEqual({ key: 'value' });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('EmailTemplateRequest immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const request: EmailTemplateRequest = {
      templateId: 'immutable-template',
      to: 'user@example.com',
      type: 'verify_email',
      locale: 'en-US',
      variables: {
        key: 'value',
      },
      clientApp: 'web',
      userId: 'user-123',
      timestamp: '2026-01-15T10:30:00.000Z',
      meta: {
        reason: 'verification',
      },
    };

    // TypeScript предотвращает мутацию
    // request.templateId = 'new-id'; // TypeScript error: Cannot assign to 'templateId' because it is a read-only property
    // request.to = 'new@example.com'; // TypeScript error: Cannot assign to 'to' because it is a read-only property
    // request.type = 'password_reset'; // TypeScript error: Cannot assign to 'type' because it is a read-only property

    expect(request.templateId).toBe('immutable-template');
    expect(request.to).toBe('user@example.com');
    expect(request.type).toBe('verify_email');
  });

  it('variables readonly - предотвращает мутацию вложенных объектов', () => {
    const request: EmailTemplateRequest = {
      templateId: 'template',
      to: 'user@example.com',
      variables: {
        key: 'value',
        number: 42,
      },
    };

    // TypeScript предотвращает мутацию variables
    // request.variables!['key'] = 'new-value'; // TypeScript error: Index signature in type 'readonly Record<string, string | number | boolean>' only permits reading

    expect(request.variables['key']).toBe('value');
    expect(request.variables['number']).toBe(42);
  });

  it('meta readonly - предотвращает мутацию вложенных объектов', () => {
    const request: EmailTemplateRequest = {
      templateId: 'template',
      to: 'user@example.com',
      variables: {},
      meta: {
        reason: 'verification',
        provider: 'sendgrid',
      },
    };

    // TypeScript предотвращает мутацию meta
    // request.meta!['reason'] = 'new-reason'; // TypeScript error: Index signature in type 'readonly Record<string, unknown>' only permits reading

    expect(request.meta?.['reason']).toBe('verification');
    expect(request.meta?.['provider']).toBe('sendgrid');
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('EmailTemplateRequest comprehensive snapshots', () => {
  it('verify_email template - полный snapshot', () => {
    const request = createFullEmailTemplateRequest({
      templateId: 'verify-email',
      type: 'verify_email',
      to: 'user@example.com',
      variables: {
        verificationLink: 'https://app.example.com/verify?token=abc123',
        userName: 'John Doe',
      },
    });

    expect(request).toMatchSnapshot();
  });

  it('password_reset template - полный snapshot', () => {
    const request = createFullEmailTemplateRequest({
      templateId: 'password-reset',
      type: 'password_reset',
      to: 'user@example.com',
      variables: {
        resetLink: 'https://app.example.com/reset?token=xyz789',
        expiresIn: 3600,
      },
      meta: {
        reason: 'password_reset',
        flowId: 'reset-flow-123',
      },
    });

    expect(request).toMatchSnapshot();
  });

  it('mfa_code template - полный snapshot', () => {
    const request = createFullEmailTemplateRequest({
      templateId: 'mfa-code',
      type: 'mfa_code',
      to: 'user@example.com',
      variables: {
        code: '123456',
        expiresIn: 300,
      },
    });

    expect(request).toMatchSnapshot();
  });

  it('login_alert template - полный snapshot', () => {
    const request = createFullEmailTemplateRequest({
      templateId: 'login-alert',
      type: 'login_alert',
      to: 'user@example.com',
      variables: {
        location: 'New York, US',
        device: 'Chrome on Windows',
        timestamp: '2026-01-15T10:30:00Z',
      },
    });

    expect(request).toMatchSnapshot();
  });

  it('minimal template - полный snapshot', () => {
    const request = createMinimalEmailTemplateRequest({
      templateId: 'minimal-template',
      to: 'minimal@example.com',
    });

    expect(request).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные email template requests проходят Zod схему', () => {
    const validRequest = {
      to: 'user@example.com',
      templateId: 'verify-email',
      variables: {
        key: 'value',
        number: 42,
      },
      locale: 'en-US',
      priority: 'normal',
    };

    const result = emailTemplateRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.to).toBe('user@example.com');
      expect(result.data.templateId).toBe('verify-email');
      expect(result.data.locale).toBe('en-US');
    }
  });

  it('невалидные email адреса отклоняются', () => {
    const invalidEmail = {
      to: 'invalid-email', // невалидный email
      templateId: 'template',
      variables: {},
    };

    const result = emailTemplateRequestSchema.safeParse(invalidEmail);
    expect(result.success).toBe(false);
  });

  it('отсутствие обязательных полей отклоняется', () => {
    const missingTo = {
      // to отсутствует
      templateId: 'template',
      variables: {},
    };

    const missingTemplateId = {
      to: 'user@example.com',
      // templateId отсутствует
      variables: {},
    };

    const missingVariables = {
      to: 'user@example.com',
      templateId: 'template',
      // variables отсутствует
    };

    const result1 = emailTemplateRequestSchema.safeParse(missingTo);
    const result2 = emailTemplateRequestSchema.safeParse(missingTemplateId);
    const result3 = emailTemplateRequestSchema.safeParse(missingVariables);

    expect(result1.success).toBe(false);
    expect(result2.success).toBe(false);
    expect(result3.success).toBe(false);
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const requestWithExtra = {
      to: 'user@example.com',
      templateId: 'template',
      variables: {},
      extraField: 'not allowed', // дополнительное поле
    };

    const result = emailTemplateRequestSchema.safeParse(requestWithExtra);
    expect(result.success).toBe(false);
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум обязательных полей (variables обязателен в схеме)
    const minimalRequest = {
      to: 'user@example.com',
      templateId: 'template',
      variables: {},
    };

    const result = emailTemplateRequestSchema.safeParse(minimalRequest);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.to).toBe('user@example.com');
      expect(result.data.templateId).toBe('template');
      expect(result.data.variables).toEqual({});
      expect(result.data.locale).toBeUndefined();
      expect(result.data.priority).toBeUndefined();
    }
  });

  it('variables может содержать любые данные', () => {
    const requestWithVariables = {
      to: 'user@example.com',
      templateId: 'template',
      variables: {
        stringValue: 'test',
        numberValue: 42,
        booleanValue: true,
        arrayValue: [1, 2, 3],
        nestedObject: {
          key: 'value',
        },
      },
    };

    const result = emailTemplateRequestSchema.safeParse(requestWithVariables);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.variables['stringValue']).toBe('test');
      expect(result.data.variables['numberValue']).toBe(42);
      expect(result.data.variables['booleanValue']).toBe(true);
    }
  });

  it('priority опционально и поддерживает все значения', () => {
    const priorities = ['low', 'normal', 'high'];

    priorities.forEach((priority) => {
      const request = {
        to: 'user@example.com',
        templateId: 'template',
        variables: {},
        priority,
      };

      const result = emailTemplateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.priority).toBe(priority);
      }
    });
  });

  it('locale опционально для локализации', () => {
    const requestWithLocale = {
      to: 'user@example.com',
      templateId: 'template',
      variables: {},
      locale: 'en-US',
    };

    const requestWithoutLocale = {
      to: 'user@example.com',
      templateId: 'template',
      variables: {},
    };

    const result1 = emailTemplateRequestSchema.safeParse(requestWithLocale);
    const result2 = emailTemplateRequestSchema.safeParse(requestWithoutLocale);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result1.success) {
      expect(result1.data.locale).toBe('en-US');
    }

    // eslint-disable-next-line functional/no-conditional-statements
    if (result2.success) {
      expect(result2.data.locale).toBeUndefined();
    }
  });

  it('to должен быть валидным email адресом', () => {
    const validEmails = [
      'user@example.com',
      'test.user@example.co.uk',
      'user+tag@example.com',
    ];

    const invalidEmails = [
      'invalid-email',
      'user@',
      '@example.com',
      'user@example',
    ];

    validEmails.forEach((email) => {
      const request = {
        to: email,
        templateId: 'template',
        variables: {},
      };

      const result = emailTemplateRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    invalidEmails.forEach((email) => {
      const request = {
        to: email,
        templateId: 'template',
        variables: {},
      };

      const result = emailTemplateRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  it('to должен соответствовать максимальной длине email', () => {
    // Максимальная длина email (RFC 5321) - 320 символов
    // user (4) + 305 символов + @example.com (12) = 321 символ (превышает лимит)
    const longEmail = `user${'x'.repeat(305)}@example.com`; // Слишком длинный email (321 символ)

    const request = {
      to: longEmail,
      templateId: 'template',
      variables: {},
    };

    const result = emailTemplateRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it('variables обязателен в схеме (даже если пустой)', () => {
    const requestWithEmptyVariables = {
      to: 'user@example.com',
      templateId: 'template',
      variables: {},
    };

    const requestWithoutVariables = {
      to: 'user@example.com',
      templateId: 'template',
      // variables отсутствует
    };

    const result1 = emailTemplateRequestSchema.safeParse(requestWithEmptyVariables);
    const result2 = emailTemplateRequestSchema.safeParse(requestWithoutVariables);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
  });
});
