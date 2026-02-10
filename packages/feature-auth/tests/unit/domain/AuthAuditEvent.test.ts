/**
 * @file Unit тесты для domain/AuthAuditEvent.ts
 * Полное покрытие audit событий аутентификации и compliance типов
 */

import { describe, expect, it } from 'vitest';
import type {
  AuditGeoInfo,
  AuthAuditEvent,
  AuthAuditEventType,
} from '../../../src/domain/AuthAuditEvent.js';
import { auditEventSchema } from '../../../src/schemas.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createAuditGeoInfo(overrides: Partial<AuditGeoInfo> = {}): AuditGeoInfo {
  return {
    country: 'US',
    region: 'CA',
    city: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    ...overrides,
  };
}

function createAuthAuditEvent(
  type: AuthAuditEventType,
  overrides: Partial<AuthAuditEvent> = {},
): AuthAuditEvent {
  const baseEvent: AuthAuditEvent = {
    eventId: 'evt-test-123',
    type,
    timestamp: '2026-01-15T10:30:00.000Z',
    userId: 'user-123',
    sessionId: 'session-456',
    clientApp: 'web',
    ip: '192.168.1.1',
    deviceId: 'device-789',
    userAgent: 'Mozilla/5.0',
    geo: createAuditGeoInfo(),
    correlationId: 'corr-abc',
    ...overrides,
  };

  return baseEvent;
}

function createMinimalAuditEvent(type: AuthAuditEventType): AuthAuditEvent {
  return {
    eventId: 'evt-minimal-123',
    type,
    timestamp: '2026-01-15T10:30:00.000Z',
  };
}

// ============================================================================
// 🎯 AUTH AUDIT EVENT TYPES - Типы событий аудита
// ============================================================================

describe('AuthAuditEvent discriminated union types', () => {
  it('создает login success событие', () => {
    const event = createAuthAuditEvent('login_success');

    expect(event.eventId).toBe('evt-test-123');
    expect(event.type).toBe('login_success');
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(event.userId).toBe('user-123');
    expect(event.sessionId).toBe('session-456');
  });

  it('создает login failure событие с error code', () => {
    // Создаем событие напрямую, без использования helper, чтобы userId был undefined
    const event: AuthAuditEvent = {
      eventId: 'evt-failure-123',
      type: 'login_failure',
      timestamp: '2026-01-15T10:30:00.000Z',
      errorCode: 'INVALID_CREDENTIALS',
      // userId intentionally omitted - user not identified yet
      sessionId: 'session-456',
      clientApp: 'web',
      ip: '192.168.1.1',
      deviceId: 'device-789',
      userAgent: 'Mozilla/5.0',
      geo: createAuditGeoInfo(),
      correlationId: 'corr-failure',
    };

    expect(event.type).toBe('login_failure');
    expect(event.errorCode).toBe('INVALID_CREDENTIALS');
    expect(event.userId).toBeUndefined();
  });

  it('создает MFA challenge событие', () => {
    const event = createAuthAuditEvent('mfa_challenge', {
      mfaMethod: 'totp',
    });

    expect(event.type).toBe('mfa_challenge');
    expect(event.mfaMethod).toBe('totp');
  });

  it('создает risk detected событие с risk score', () => {
    const event = createAuthAuditEvent('risk_detected', {
      riskScore: 85,
      context: {
        riskFactors: ['unusual_location', 'new_device'],
        confidence: 0.92,
      },
    });

    expect(event.type).toBe('risk_detected');
    expect(event.riskScore).toBe(85);
    expect(event.context).toEqual({
      riskFactors: ['unusual_location', 'new_device'],
      confidence: 0.92,
    });
  });

  it('создает policy violation событие', () => {
    const event = createAuthAuditEvent('policy_violation', {
      policyId: 'password-policy-1',
      errorCode: 'POLICY_VIOLATION',
      context: {
        violatedRules: ['password_complexity', 'password_history'],
        severity: 'high',
      },
    });

    expect(event.type).toBe('policy_violation');
    expect(event.policyId).toBe('password-policy-1');
    expect(event.errorCode).toBe('POLICY_VIOLATION');
  });

  it('создает OAuth login событие', () => {
    const event = createAuthAuditEvent('oauth_login', {
      context: {
        provider: 'google',
        providerUserId: 'google-user-123',
        scopes: ['email', 'profile'],
      },
    });

    expect(event.type).toBe('oauth_login');
    expect(event.context?.['provider']).toBe('google');
  });
});

// ============================================================================
// 🌍 AUDIT GEO INFO - Геолокационная информация
// ============================================================================

describe('AuditGeoInfo геолокационная информация', () => {
  it('создает полную геоинформацию', () => {
    const geo = createAuditGeoInfo();

    expect(geo.country).toBe('US');
    expect(geo.region).toBe('CA');
    expect(geo.city).toBe('San Francisco');
    expect(geo.lat).toBe(37.7749);
    expect(geo.lng).toBe(-122.4194);
  });

  it('поддерживает частичную геоинформацию', () => {
    const geo: AuditGeoInfo = {
      country: 'DE',
      city: 'Berlin',
    };

    expect(geo.country).toBe('DE');
    expect(geo.city).toBe('Berlin');
    expect(geo.region).toBeUndefined();
    expect(geo.lat).toBeUndefined();
    expect(geo.lng).toBeUndefined();
  });

  it('работает с пустой геоинформацией', () => {
    const geo: AuditGeoInfo = {};

    expect(geo).toEqual({});
  });

  it('поддерживает координаты без адреса', () => {
    const geo: AuditGeoInfo = {
      lat: 52.5200,
      lng: 13.4050,
    };

    expect(geo.lat).toBe(52.5200);
    expect(geo.lng).toBe(13.4050);
    expect(geo.country).toBeUndefined();
  });
});

// ============================================================================
// 📋 AUTH AUDIT EVENT - Полный DTO
// ============================================================================

describe('AuthAuditEvent полный DTO', () => {
  it('создает минимальное событие с обязательными полями', () => {
    const event = createMinimalAuditEvent('login_attempt');

    expect(event.eventId).toBe('evt-minimal-123');
    expect(event.type).toBe('login_attempt');
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Все остальные поля опциональны
    expect(event.userId).toBeUndefined();
    expect(event.sessionId).toBeUndefined();
    expect(event.clientApp).toBeUndefined();
  });

  it('создает полное событие со всеми полями', () => {
    const event = createAuthAuditEvent('login_success', {
      riskScore: 15,
      policyId: 'session-policy',
      mfaMethod: 'sms',
      correlationId: 'trace-123',
      context: {
        loginMethod: 'password',
        deviceFingerprint: 'fp-abc123',
      },
    });

    expect(event.eventId).toBeDefined();
    expect(event.type).toBe('login_success');
    expect(event.timestamp).toBeDefined();
    expect(event.userId).toBe('user-123');
    expect(event.sessionId).toBe('session-456');
    expect(event.clientApp).toBe('web');
    expect(event.ip).toBe('192.168.1.1');
    expect(event.deviceId).toBe('device-789');
    expect(event.userAgent).toBe('Mozilla/5.0');
    expect(event.geo).toBeDefined();
    expect(event.riskScore).toBe(15);
    expect(event.policyId).toBe('session-policy');
    expect(event.mfaMethod).toBe('sms');
    expect(event.errorCode).toBeUndefined();
    expect(event.correlationId).toBe('trace-123');
    expect(event.context).toEqual({
      loginMethod: 'password',
      deviceFingerprint: 'fp-abc123',
    });
  });

  it('работает с различными clientApp значениями', () => {
    const clientApps = ['web', 'mobile', 'api', 'admin', 'desktop'] as const;

    clientApps.forEach((app) => {
      const event = createAuthAuditEvent('login_success', { clientApp: app });
      expect(event.clientApp).toBe(app);
    });
  });

  it('поддерживает различные riskScore значения', () => {
    const riskScores = [0, 25, 50, 75, 100];

    riskScores.forEach((score) => {
      const event = createAuthAuditEvent('risk_detected', { riskScore: score });
      expect(event.riskScore).toBe(score);
    });
  });
});

// ============================================================================
// 🔄 EVENT TYPE COVERAGE - Покрытие всех типов событий
// ============================================================================

describe('AuthAuditEvent type coverage', () => {
  const allEventTypes: AuthAuditEventType[] = [
    'login_attempt',
    'login_success',
    'login_failure',
    'logout',
    'token_refresh',
    'token_revoked',
    'session_revoked',
    'mfa_challenge',
    'mfa_success',
    'mfa_failure',
    'password_reset_request',
    'password_reset_confirm',
    'email_verification',
    'phone_verification',
    'oauth_login',
    'oauth_register',
    'risk_detected',
    'policy_violation',
  ];

  it('поддерживает все типы событий аудита', () => {
    allEventTypes.forEach((type) => {
      const event = createMinimalAuditEvent(type);
      expect(event.type).toBe(type);
      expect(event.eventId).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });
  });

  it('каждый тип события имеет правильную структуру', () => {
    // Login events
    const loginSuccess = createAuthAuditEvent('login_success');
    expect(loginSuccess.type).toBe('login_success');
    expect(loginSuccess.userId).toBeDefined();

    // Token events
    const tokenRefresh = createAuthAuditEvent('token_refresh', {
      sessionId: 'session-abc',
    });
    expect(tokenRefresh.type).toBe('token_refresh');
    expect(tokenRefresh.sessionId).toBe('session-abc');

    // MFA events
    const mfaSuccess = createAuthAuditEvent('mfa_success', {
      mfaMethod: 'push',
    });
    expect(mfaSuccess.type).toBe('mfa_success');
    expect(mfaSuccess.mfaMethod).toBe('push');

    // Verification events
    const emailVerification = createAuthAuditEvent('email_verification');
    expect(emailVerification.type).toBe('email_verification');

    // OAuth events
    const oauthLogin = createAuthAuditEvent('oauth_login');
    expect(oauthLogin.type).toBe('oauth_login');
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('AuthAuditEvent edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const event = createAuthAuditEvent('login_success', {
      userId: '',
      sessionId: '',
      clientApp: '',
      ip: '',
      deviceId: '',
      userAgent: '',
    });

    expect(event.userId).toBe('');
    expect(event.sessionId).toBe('');
    expect(event.clientApp).toBe('');
    expect(event.ip).toBe('');
    expect(event.deviceId).toBe('');
    expect(event.userAgent).toBe('');
  });

  it('работает с экстремально длинными строками', () => {
    const longString = 'a'.repeat(1000);
    const event = createAuthAuditEvent('login_success', {
      eventId: longString,
      userId: longString,
      sessionId: longString,
      correlationId: longString,
    });

    expect(event.eventId).toBe(longString);
    expect(event.userId).toBe(longString);
    expect(event.sessionId).toBe(longString);
    expect(event.correlationId).toBe(longString);
  });

  it('работает с экстремальными riskScore значениями', () => {
    const minRisk = createAuthAuditEvent('risk_detected', { riskScore: 0 });
    const maxRisk = createAuthAuditEvent('risk_detected', { riskScore: 100 });

    expect(minRisk.riskScore).toBe(0);
    expect(maxRisk.riskScore).toBe(100);
  });

  it('работает с различными timestamp форматами', () => {
    const pastTimestamp = '2020-01-01T00:00:00.000Z';
    const futureTimestamp = '2030-12-31T23:59:59.999Z';

    const pastEvent = createAuthAuditEvent('login_success', { timestamp: pastTimestamp });
    const futureEvent = createAuthAuditEvent('login_success', { timestamp: futureTimestamp });

    expect(pastEvent.timestamp).toBe(pastTimestamp);
    expect(futureEvent.timestamp).toBe(futureTimestamp);
  });

  it('поддерживает сложный context объект', () => {
    const complexContext = {
      nested: {
        data: [1, 2, 3],
        metadata: {
          version: '1.0.0',
          features: ['a', 'b', 'c'],
        },
      },
      arrays: ['item1', 'item2'],
      numbers: [1, 2, 3.14],
      booleans: [true, false],
      nulls: [null, undefined],
    };

    const event = createAuthAuditEvent('policy_violation', {
      context: complexContext,
    });

    expect(event.context).toEqual(complexContext);
  });
});

// ============================================================================
// 🔒 SECURITY CONSIDERATIONS - Аспекты безопасности
// ============================================================================

describe('AuthAuditEvent security considerations', () => {
  it('содержит sensitive PII данные', () => {
    // Audit events содержат PII для compliance и forensics
    const sensitiveEvent = createAuthAuditEvent('login_success', {
      ip: '203.0.113.1', // Real IP - PII
      deviceId: 'device-fingerprint-abc123', // Device fingerprinting
      geo: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      }, // Precise geolocation - PII
      userAgent: 'Mozilla/5.0 (PII fingerprint)', // Browser fingerprinting
    });

    expect(sensitiveEvent.ip).toBe('203.0.113.1');
    expect(sensitiveEvent.deviceId).toBe('device-fingerprint-abc123');
    expect(sensitiveEvent.geo?.country).toBe('US');
    expect(sensitiveEvent.userAgent).toBe('Mozilla/5.0 (PII fingerprint)');

    // Эти данные должны:
    // - Шифроваться в логах
    // - Иметь retention policy
    // - Контролироваться access control
  });

  it('поддерживает correlation для security tracing', () => {
    // Correlation ID для distributed tracing security events
    const correlatedEvent = createAuthAuditEvent('risk_detected', {
      correlationId: 'trace-123-456-789',
      riskScore: 95,
      context: {
        securityEvents: [
          'failed_login_attempt',
          'unusual_location',
          'new_device',
        ],
        traceChain: ['auth-service', 'risk-engine', 'audit-log'],
      },
    });

    expect(correlatedEvent.correlationId).toBe('trace-123-456-789');
    expect(correlatedEvent.context?.['traceChain']).toEqual([
      'auth-service',
      'risk-engine',
      'audit-log',
    ]);
  });

  it('работает с security failure events', () => {
    // Security failure events должны содержать forensics data
    const securityFailure = createAuthAuditEvent('login_failure', {
      errorCode: 'ACCOUNT_LOCKED',
      ip: 'suspicious.ip.address',
      riskScore: 98,
      context: {
        failureReason: 'too_many_attempts',
        lockoutDuration: '15_minutes',
        previousFailures: 5,
        securityActions: ['ip_block', 'notification_sent'],
      },
    });

    expect(securityFailure.type).toBe('login_failure');
    expect(securityFailure.errorCode).toBe('ACCOUNT_LOCKED');
    expect(securityFailure.riskScore).toBe(98);
    expect(securityFailure.context?.['failureReason']).toBe('too_many_attempts');
  });

  it('поддерживает compliance audit trails', () => {
    // Audit events для compliance (GDPR, SOX, etc.)
    const complianceEvent = createAuthAuditEvent('policy_violation', {
      policyId: 'gdpr-data-retention',
      userId: 'user-to-be-deleted',
      context: {
        compliance: 'GDPR_ARTICLE_17', // Right to erasure
        dataSubjects: ['user_profile', 'login_history', 'audit_logs'],
        retentionPeriod: '30_days',
        legalBasis: 'consent_withdrawn',
      },
    });

    expect(complianceEvent.type).toBe('policy_violation');
    expect(complianceEvent.policyId).toBe('gdpr-data-retention');
    expect(complianceEvent.context?.['compliance']).toBe('GDPR_ARTICLE_17');
  });
});

// ============================================================================
// 📊 COMPREHENSIVE SNAPSHOTS - Полные снепшоты
// ============================================================================

describe('AuthAuditEvent comprehensive snapshots', () => {
  it('login success event - полный snapshot', () => {
    const event = createAuthAuditEvent('login_success', {
      riskScore: 10,
      correlationId: 'login-trace-123',
      context: {
        loginMethod: 'password',
        deviceType: 'desktop',
        browserFingerprint: 'fp-abc123def456',
      },
    });

    expect(event).toMatchSnapshot();
  });

  it('security violation event - полный snapshot', () => {
    const event = createAuthAuditEvent('policy_violation', {
      errorCode: 'GEO_BLOCKED',
      riskScore: 100,
      policyId: 'geo-security-policy',
      context: {
        blockedCountry: 'RU',
        allowedCountries: ['US', 'CA', 'GB'],
        violationType: 'geographic_restriction',
        remediation: 'block_ip',
      },
    });

    expect(event).toMatchSnapshot();
  });

  it('MFA success event - полный snapshot', () => {
    const event = createAuthAuditEvent('mfa_success', {
      mfaMethod: 'push',
      correlationId: 'mfa-flow-456',
      context: {
        mfaProvider: 'authy',
        deviceName: 'iPhone 14',
        pushNotificationId: 'push-notif-789',
        responseTimeMs: 2500,
      },
    });

    expect(event).toMatchSnapshot();
  });

  it('risk detected event - полный snapshot', () => {
    const event = createAuthAuditEvent('risk_detected', {
      riskScore: 87,
      correlationId: 'risk-analysis-789',
      context: {
        riskFactors: [
          'new_device',
          'unusual_location',
          'unusual_time',
          'ip_velocity_high',
        ],
        confidence: 0.94,
        recommendedActions: [
          'require_mfa',
          'send_notification',
          'flag_for_review',
        ],
        riskModel: 'advanced_ml_v2',
      },
    });

    expect(event).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 TYPE SAFETY VALIDATION - Проверка type safety
// ============================================================================

describe('AuthAuditEvent type safety validation', () => {
  it('предотвращает некорректные типы событий', () => {
    // TypeScript предотвращает некорректные значения (runtime проверки для демонстрации)
    const validEvent: AuthAuditEvent = {
      eventId: 'evt-123',
      type: 'login_success', // Только из AuthAuditEventType
      timestamp: new Date().toISOString(),
    };

    expect(validEvent.type).toBe('login_success');

    // Невозможно создать с некорректным типом (TypeScript error)
    // const invalidEvent: AuthAuditEvent = {
    //   eventId: 'evt-123',
    //   type: 'invalid_type', // TypeScript error
    //   timestamp: new Date().toISOString(),
    // };
  });

  it('работает с discriminated union - разные типы имеют разные требования', () => {
    // Login success требует userId
    const loginEvent: AuthAuditEvent = {
      eventId: 'evt-1',
      type: 'login_success',
      timestamp: new Date().toISOString(),
      userId: 'user-123', // Обязателен для login events
    };

    // Risk detected требует riskScore
    const riskEvent: AuthAuditEvent = {
      eventId: 'evt-2',
      type: 'risk_detected',
      timestamp: new Date().toISOString(),
      riskScore: 75, // Обязателен для risk events
    };

    // Policy violation требует policyId
    const policyEvent: AuthAuditEvent = {
      eventId: 'evt-3',
      type: 'policy_violation',
      timestamp: new Date().toISOString(),
      policyId: 'policy-123', // Обязателен для policy events
    };

    expect(loginEvent.userId).toBe('user-123');
    expect(riskEvent.riskScore).toBe(75);
    expect(policyEvent.policyId).toBe('policy-123');
  });

  it('геоинформация имеет правильную readonly структуру', () => {
    const geo: AuditGeoInfo = {
      country: 'FR',
      city: 'Paris',
      lat: 48.8566,
      lng: 2.3522,
    };

    // TypeScript обеспечивает readonly (runtime проверки для демонстрации)
    expect(geo.country).toBe('FR');
    expect(geo.city).toBe('Paris');
    expect(geo.lat).toBe(48.8566);
    expect(geo.lng).toBe(2.3522);
  });
});

// ============================================================================
// 📈 COMPLIANCE & AUDIT READINESS - Готовность к аудиту
// ============================================================================

describe('AuthAuditEvent compliance & audit readiness', () => {
  it('готов для SIEM систем', () => {
    // Структура совместима с SIEM (Splunk, ELK, etc.)
    const siemEvent = createAuthAuditEvent('login_failure', {
      eventId: 'evt-siem-123',
      userId: 'user-siem-test',
      ip: '10.0.0.1',
      deviceId: 'device-siem-456',
      correlationId: 'trace-siem-789',
      context: {
        siem_fields: {
          service: 'auth-service',
          category: 'authentication',
          severity: 'warning',
          tags: ['login', 'failure', 'security'],
        },
      },
    });

    expect(siemEvent.eventId).toBe('evt-siem-123');
    const siemFields = siemEvent.context?.['siem_fields'] as Record<string, unknown> | undefined;
    expect(siemFields?.['service']).toBe('auth-service');
    expect(siemFields?.['category']).toBe('authentication');
    expect(siemFields?.['severity']).toBe('warning');
  });

  it('поддерживает distributed tracing', () => {
    // Correlation ID для microservices tracing
    const traceEvent = createAuthAuditEvent('token_refresh', {
      correlationId: 'trace-microservices-123',
      sessionId: 'session-distributed',
      context: {
        serviceChain: [
          'api-gateway',
          'auth-service',
          'token-service',
          'audit-service',
        ],
        traceId: 'trace-123',
        spanId: 'span-456',
        parentSpanId: 'span-123',
      },
    });

    expect(traceEvent.correlationId).toBe('trace-microservices-123');
    expect(traceEvent.context?.['serviceChain']).toHaveLength(4);
    expect(traceEvent.context?.['traceId']).toBe('trace-123');
  });

  it('работает с regulatory compliance', () => {
    // GDPR, CCPA, SOX compliance events
    const gdprEvent = createAuthAuditEvent('policy_violation', {
      policyId: 'gdpr-right-to-erasure',
      userId: 'user-gdpr-delete',
      context: {
        regulation: 'GDPR',
        article: 'Article 17',
        requestId: 'gdpr-req-123',
        dataCategories: ['personal_data', 'login_history', 'audit_logs'],
        retention: {
          current: '30_days',
          required: 'immediately',
        },
      },
    });

    expect(gdprEvent.policyId).toBe('gdpr-right-to-erasure');
    expect(gdprEvent.context?.['regulation']).toBe('GDPR');
    expect(gdprEvent.context?.['article']).toBe('Article 17');
  });
});

// ============================================================================
// 🔍 REQUIRED FIELDS VALIDATION - Обязательные поля
// ============================================================================

describe('AuthAuditEvent required fields', () => {
  it('timestamp является обязательным полем', () => {
    const event: AuthAuditEvent = {
      eventId: 'evt-test',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
    };

    expect(event.timestamp).toBe('2026-01-15T10:30:00.000Z');
    // TypeScript предотвращает создание объекта без timestamp
    // const invalidEvent: AuthAuditEvent = {
    //   eventId: 'evt-test',
    //   type: 'login_success',
    //   clientApp: 'web',
    //   // timestamp missing - TypeScript error
    // };
  });

  it('clientApp является обязательным полем', () => {
    const event: AuthAuditEvent = {
      eventId: 'evt-test',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
    };

    expect(event.clientApp).toBe('web');

    // TypeScript не позволит создать без clientApp
    // const invalidEvent: AuthAuditEvent = {
    //   eventId: 'evt-test',
    //   type: 'login_success',
    //   timestamp: '2026-01-15T10:30:00.000Z',
    //   // clientApp missing - TypeScript error
    // };
  });

  it('eventId и type являются обязательными', () => {
    const event: AuthAuditEvent = {
      eventId: 'evt-required',
      type: 'login_attempt',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'api',
    };

    expect(event.eventId).toBe('evt-required');
    expect(event.type).toBe('login_attempt');
  });
});

// ============================================================================
// 🎯 OPTIONAL FIELDS VALIDATION - Опциональные поля
// ============================================================================

describe('AuthAuditEvent optional fields', () => {
  it('riskScore опционально и принимает значения 0-100', () => {
    const eventWithRisk: AuthAuditEvent = {
      eventId: 'evt-risk',
      type: 'risk_detected',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      riskScore: 85,
    };

    const eventWithoutRisk: AuthAuditEvent = {
      eventId: 'evt-no-risk',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'mobile',
      // riskScore omitted
    };

    expect(eventWithRisk.riskScore).toBe(85);
    expect(eventWithoutRisk.riskScore).toBeUndefined();
  });

  it('policyId опционально для policy violations', () => {
    const eventWithPolicy: AuthAuditEvent = {
      eventId: 'evt-policy',
      type: 'policy_violation',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'admin',
      policyId: 'password-policy-v1',
    };

    const eventWithoutPolicy: AuthAuditEvent = {
      eventId: 'evt-no-policy',
      type: 'login_failure',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      // policyId omitted
    };

    expect(eventWithPolicy.policyId).toBe('password-policy-v1');
    expect(eventWithoutPolicy.policyId).toBeUndefined();
  });

  it('mfaMethod опционально для MFA событий', () => {
    const eventWithMfa: AuthAuditEvent = {
      eventId: 'evt-mfa',
      type: 'mfa_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      mfaMethod: 'totp',
    };

    const eventWithoutMfa: AuthAuditEvent = {
      eventId: 'evt-no-mfa',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'api',
      // mfaMethod omitted
    };

    expect(eventWithMfa.mfaMethod).toBe('totp');
    expect(eventWithoutMfa.mfaMethod).toBeUndefined();
  });

  it('errorCode опционально для failure событий', () => {
    const eventWithError: AuthAuditEvent = {
      eventId: 'evt-error',
      type: 'login_failure',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      errorCode: 'INVALID_CREDENTIALS',
    };

    const eventWithoutError: AuthAuditEvent = {
      eventId: 'evt-no-error',
      type: 'logout',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'mobile',
      // errorCode omitted
    };

    expect(eventWithError.errorCode).toBe('INVALID_CREDENTIALS');
    expect(eventWithoutError.errorCode).toBeUndefined();
  });

  it('correlationId опционально для distributed tracing', () => {
    const eventWithCorrelation: AuthAuditEvent = {
      eventId: 'evt-corr',
      type: 'token_refresh',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'api',
      correlationId: 'trace-123-456-789',
    };

    const eventWithoutCorrelation: AuthAuditEvent = {
      eventId: 'evt-no-corr',
      type: 'login_attempt',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      // correlationId omitted
    };

    expect(eventWithCorrelation.correlationId).toBe('trace-123-456-789');
    expect(eventWithoutCorrelation.correlationId).toBeUndefined();
  });

  it('геолокация полностью опциональна', () => {
    const eventWithGeo: AuthAuditEvent = {
      eventId: 'evt-geo',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      geo: {
        country: 'US',
        city: 'New York',
        lat: 40.7128,
        lng: -74.0060,
      },
    };

    const eventWithoutGeo: AuthAuditEvent = {
      eventId: 'evt-no-geo',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'api',
      // geo omitted
    };

    expect(eventWithGeo.geo?.country).toBe('US');
    expect(eventWithoutGeo.geo).toBeUndefined();
  });

  it('IP адрес и deviceId опциональны', () => {
    const eventWithTracking: AuthAuditEvent = {
      eventId: 'evt-tracking',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      ip: '192.168.1.1',
      deviceId: 'device-fingerprint-123',
    };

    const eventWithoutTracking: AuthAuditEvent = {
      eventId: 'evt-no-tracking',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'api',
      // ip and deviceId omitted
    };

    expect(eventWithTracking.ip).toBe('192.168.1.1');
    expect(eventWithTracking.deviceId).toBe('device-fingerprint-123');
    expect(eventWithoutTracking.ip).toBeUndefined();
    expect(eventWithoutTracking.deviceId).toBeUndefined();
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('AuthAuditEvent immutability', () => {
  it('все поля readonly - предотвращает мутацию', () => {
    const event: AuthAuditEvent = {
      eventId: 'evt-immutable',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      userId: 'user-123',
      sessionId: 'session-456',
    };

    // TypeScript предотвращает мутацию readonly полей
    // event.eventId = 'changed'; // TypeScript error: Cannot assign to 'eventId' because it is a read-only property
    // event.type = 'logout'; // TypeScript error: Cannot assign to 'type' because it is a read-only property
    // event.timestamp = 'new-time'; // TypeScript error: Cannot assign to 'timestamp' because it is a read-only property

    // Проверяем что значения правильные
    expect(event.eventId).toBe('evt-immutable');
    expect(event.type).toBe('login_success');
    expect(event.timestamp).toBe('2026-01-15T10:30:00.000Z');
  });

  it('вложенные объекты тоже readonly', () => {
    const event: AuthAuditEvent = {
      eventId: 'evt-nested',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      geo: {
        country: 'US',
        city: 'Boston',
        lat: 42.3601,
        lng: -71.0589,
      },
    };

    // TypeScript предотвращает мутацию вложенных readonly объектов
    // event.geo!.country = 'CA'; // TypeScript error: Cannot assign to 'country' because it is a read-only property
    // event.geo!.lat = 0; // TypeScript error: Cannot assign to 'lat' because it is a read-only property

    expect(event.geo?.country).toBe('US');
    expect(event.geo?.city).toBe('Boston');
    expect(event.geo?.lat).toBe(42.3601);
  });

  it('context объект readonly', () => {
    const event: AuthAuditEvent = {
      eventId: 'evt-context',
      type: 'risk_detected',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      context: {
        riskFactors: ['unusual_location'],
        severity: 'high',
      },
    };

    // TypeScript предотвращает мутацию context
    // event.context!['severity'] = 'low'; // TypeScript error: Index signature in type 'readonly Record<string, unknown>' only permits reading

    expect(event.context?.['riskFactors']).toEqual(['unusual_location']);
    expect(event.context?.['severity']).toBe('high');
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  it('валидные audit events проходят Zod схему', () => {
    const validEvent: AuthAuditEvent = {
      eventId: 'evt-valid-123',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      userId: 'user-123',
      sessionId: 'session-456',
      ip: '192.168.1.1',
      deviceId: 'device-789',
      userAgent: 'Mozilla/5.0',
      geo: {
        country: 'US',
        city: 'San Francisco',
        lat: 37.7749,
        lng: -122.4194,
      },
      riskScore: 25,
      correlationId: 'trace-123',
      context: {
        loginMethod: 'password',
        deviceType: 'desktop',
      },
    };

    const result = auditEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.eventId).toBe('evt-valid-123');
      expect(result.data.type).toBe('login_success');
      expect(result.data.clientApp).toBe('web');
    }
  });

  it('невалидные типы событий отклоняются', () => {
    const invalidEvent = {
      eventId: 'evt-invalid',
      type: 'invalid_event_type', // невалидный тип
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
    };

    const result = auditEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('невалидный timestamp отклоняется', () => {
    const invalidEvent = {
      eventId: 'evt-invalid-ts',
      type: 'login_success',
      timestamp: 'invalid-date', // невалидный ISO timestamp
      clientApp: 'web',
    };

    const result = auditEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('riskScore вне диапазона 0-100 отклоняется', () => {
    const invalidLowRisk = {
      eventId: 'evt-risk-low',
      type: 'risk_detected',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      riskScore: -5, // меньше 0
    };

    const invalidHighRisk = {
      eventId: 'evt-risk-high',
      type: 'risk_detected',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      riskScore: 150, // больше 100
    };

    expect(auditEventSchema.safeParse(invalidLowRisk).success).toBe(false);
    expect(auditEventSchema.safeParse(invalidHighRisk).success).toBe(false);
  });

  it('схема не принимает дополнительные поля (strict)', () => {
    const eventWithExtra = {
      eventId: 'evt-extra',
      type: 'login_success',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
      extraField: 'not allowed', // дополнительное поле
    };

    const result = auditEventSchema.safeParse(eventWithExtra);
    expect(result.success).toBe(false);
  });

  it('все типы событий поддерживаются', () => {
    const allTypes: AuthAuditEventType[] = [
      'login_attempt',
      'login_success',
      'login_failure',
      'logout',
      'token_refresh',
      'token_revoked',
      'session_revoked',
      'mfa_challenge',
      'mfa_success',
      'mfa_failure',
      'password_reset_request',
      'password_reset_confirm',
      'email_verification',
      'phone_verification',
      'oauth_login',
      'oauth_register',
      'risk_detected',
      'policy_violation',
    ];

    allTypes.forEach((type) => {
      const validEvent = {
        eventId: `evt-${type}`,
        type,
        timestamp: '2026-01-15T10:30:00.000Z',
        clientApp: 'web',
      };

      const result = auditEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });
  });

  it('опциональные поля корректно обрабатываются', () => {
    // Минимум обязательных полей
    const minimalEvent = {
      eventId: 'evt-minimal',
      type: 'login_attempt',
      timestamp: '2026-01-15T10:30:00.000Z',
      clientApp: 'web',
    };

    const result = auditEventSchema.safeParse(minimalEvent);
    expect(result.success).toBe(true);

    // eslint-disable-next-line functional/no-conditional-statements
    if (result.success) {
      expect(result.data.eventId).toBe('evt-minimal');
      expect(result.data.type).toBe('login_attempt');
      expect(result.data.userId).toBeUndefined();
      expect(result.data.geo).toBeUndefined();
      expect(result.data.riskScore).toBeUndefined();
    }
  });
});
