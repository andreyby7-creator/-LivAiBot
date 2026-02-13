/**
 * @file Unit тесты для types/auth.ts
 * Полное покрытие агрегирующих типов аутентификации
 */

import { describe, expect, it } from 'vitest';
import type { AuthErrorResponse } from '../../../src/domain/AuthErrorResponse.js';
import type { AuthAuditEvent } from '../../../src/domain/AuthAuditEvent.js';
import type { DeviceInfo } from '../../../src/domain/DeviceInfo.js';
import type { LoginRequest } from '../../../src/domain/LoginRequest.js';
import type { LoginRiskAssessment } from '../../../src/domain/LoginRiskAssessment.js';
import type { LogoutRequest } from '../../../src/domain/LogoutRequest.js';
import type { MeResponse, MeSessionInfo, MeUserInfo } from '../../../src/domain/MeResponse.js';
import type { MfaChallengeRequest } from '../../../src/domain/MfaChallengeRequest.js';
import type { MfaRecoveryRequest } from '../../../src/domain/MfaRecoveryRequest.js';
import type { OAuthErrorResponse } from '../../../src/domain/OAuthErrorResponse.js';
import type { OAuthLoginRequest } from '../../../src/domain/OAuthLoginRequest.js';
import type { OAuthRegisterRequest } from '../../../src/domain/OAuthRegisterRequest.js';
import type { PasswordResetConfirm } from '../../../src/domain/PasswordResetConfirm.js';
import type { PasswordResetRequest } from '../../../src/domain/PasswordResetRequest.js';
import type { RefreshTokenRequest } from '../../../src/domain/RefreshTokenRequest.js';
import type { RegisterRequest } from '../../../src/domain/RegisterRequest.js';
import type { RegisterResponse } from '../../../src/domain/RegisterResponse.js';
import type { SessionPolicy } from '../../../src/domain/SessionPolicy.js';
import type { SessionRevokeRequest } from '../../../src/domain/SessionRevokeRequest.js';
import type { TokenPair } from '../../../src/domain/TokenPair.js';
import type { VerifyEmailRequest } from '../../../src/domain/VerifyEmailRequest.js';
import type { VerifyPhoneRequest } from '../../../src/domain/VerifyPhoneRequest.js';
import type {
  AuthCommand,
  AuthError,
  AuthEvent,
  AuthMeta,
  AuthRequest,
  AuthResponse,
  AuthState,
  AuthStatus,
  ISODateString,
  MfaOperation,
  MfaState,
  MfaStatus,
  OAuthError,
  OAuthOperation,
  OAuthState,
  OAuthStatus,
  PasswordRecoveryState,
  RecoveryOperation,
  RecoveryStatus,
  RiskLevel,
  SecurityOperation,
  SecurityState,
  SecurityStatus,
  SessionState,
  SessionStatus,
  VerificationState,
} from '../../../src/types/auth.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

const createISODateString = (): ISODateString => '2026-01-01T00:00:00.000Z';

const createAuthErrorResponse = (
  overrides: Partial<AuthErrorResponse> = {},
): AuthErrorResponse => ({
  error: 'invalid_credentials',
  message: 'Invalid credentials',
  retryable: true,
  statusCode: 401,
  ...overrides,
});

const createOAuthErrorResponse = (
  overrides: Partial<OAuthErrorResponse> = {},
): OAuthErrorResponse => ({
  error: 'invalid_token',
  provider: 'google',
  message: 'Invalid token',
  retryable: false,
  ...overrides,
});

const createTokenPair = (overrides: Partial<TokenPair> = {}): TokenPair => ({
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
  expiresAt: '2026-12-31T23:59:59.000Z',
  issuedAt: '2026-01-01T00:00:00.000Z',
  scope: ['read', 'write'],
  metadata: { deviceId: 'device-123' },
  ...overrides,
});

const createMeUserInfo = (overrides: Partial<MeUserInfo> = {}): MeUserInfo => ({
  id: 'user-123',
  email: 'user@example.com',
  emailVerified: true,
  phone: '+1234567890',
  phoneVerified: true,
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
  authProvider: 'password',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/* eslint-disable @livai/rag/context-leakage -- Тестовые данные для unit тестов, не используются в production */
const createMeSessionInfo = (overrides: Partial<MeSessionInfo> = {}): MeSessionInfo => ({
  sessionId: 'session-123',
  ip: '192.168.1.1',
  deviceId: 'device-123',
  userAgent: 'Mozilla/5.0',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-12-31T23:59:59.000Z',
  ...overrides,
});

const createDeviceInfo = (overrides: Partial<DeviceInfo> = {}): DeviceInfo => ({
  deviceId: 'device-123',
  deviceType: 'desktop',
  os: 'Windows 11',
  browser: 'Chrome',
  ip: '192.168.1.1',
  geo: { lat: 55.7558, lng: 37.6173 },
  userAgent: 'Mozilla/5.0',
  appVersion: '1.0.0',
  lastUsedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createSessionPolicy = (overrides: Partial<SessionPolicy> = {}): SessionPolicy => ({
  maxConcurrentSessions: 3,
  ipPolicy: { allow: ['192.168.0.0/16'], deny: ['10.0.0.0/8'] },
  geoPolicy: { allowCountries: ['US', 'CA'], denyCountries: ['RU'] },
  requireSameIpForRefresh: true,
  requireSameDeviceForRefresh: true,
  sessionTtlSeconds: 86400,
  idleTimeoutSeconds: 1800,
  revokeOldestOnLimitExceeded: true,
  meta: { test: 'value' },
  ...overrides,
});

const createLoginRiskAssessment = (
  overrides: Partial<LoginRiskAssessment> = {},
): LoginRiskAssessment => ({
  userId: 'user-123',
  ip: '192.168.1.1',
  geo: { country: 'US', region: 'CA', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  device: {
    deviceId: 'device-123',
    fingerprint: 'fp-123',
    platform: 'web',
    os: 'Windows',
    browser: 'Chrome',
    appVersion: '1.0.0',
  },
  userAgent: 'Mozilla/5.0',
  previousSessionId: 'session-prev',
  timestamp: '2026-01-01T00:00:00.000Z',
  signals: { vpn: true, proxy: false },
  ...overrides,
});
/* eslint-enable @livai/rag/context-leakage */

// ============================================================================
// 🕐 TEMPORAL TYPES
// ============================================================================

// Константы для валидации ISO 8601 datetime
const MAX_ISO_8601_DATETIME_LENGTH = 30;
// eslint-disable-next-line security/detect-unsafe-regex -- Безопасен благодаря ограничению длины строки (MAX_ISO_8601_DATETIME_LENGTH)
const ISO_8601_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('ISODateString', () => {
  it('должен быть строкой', () => {
    const date: ISODateString = '2026-01-01T00:00:00.000Z';
    expect(typeof date).toBe('string');
    expect(date.length <= MAX_ISO_8601_DATETIME_LENGTH && ISO_8601_DATETIME_REGEX.test(date)).toBe(
      true,
    );
  });

  it('должен поддерживать различные форматы ISO 8601', () => {
    const date1: ISODateString = '2026-01-01T00:00:00Z';
    const date2: ISODateString = '2026-01-01T00:00:00.000Z';
    expect(typeof date1).toBe('string');
    expect(typeof date2).toBe('string');
  });
});

// ============================================================================
// 📋 METADATA TYPES
// ============================================================================

describe('AuthMeta', () => {
  it('должен поддерживать тип redirect', () => {
    const meta: AuthMeta = { type: 'redirect', returnTo: '/dashboard' };
    expect(meta.type).toBe('redirect');
    expect(meta.returnTo).toBe('/dashboard');
  });

  it('должен поддерживать тип experiment', () => {
    const meta1: AuthMeta = { type: 'experiment', flag: 'new-ui' };
    const meta2: AuthMeta = { type: 'experiment', flag: 'new-ui', value: true };
    const meta3: AuthMeta = { type: 'experiment', flag: 'new-ui', value: 42 };
    const meta4: AuthMeta = { type: 'experiment', flag: 'new-ui', value: 'test' };
    expect(meta1.type).toBe('experiment');
    expect(meta2.value).toBe(true);
    expect(meta3.value).toBe(42);
    expect(meta4.value).toBe('test');
  });

  it('должен поддерживать тип telemetry', () => {
    const meta1: AuthMeta = { type: 'telemetry', traceId: 'trace-123' };
    const meta2: AuthMeta = { type: 'telemetry', traceId: 'trace-123', spanId: 'span-456' };
    expect(meta1.type).toBe('telemetry');
    expect(meta2.spanId).toBe('span-456');
  });

  it('должен поддерживать тип analytics', () => {
    const meta1: AuthMeta = { type: 'analytics', event: 'login_attempt' };

    const meta2: AuthMeta = {
      type: 'analytics',
      event: 'login_attempt',
      // eslint-disable-next-line @livai/rag/source-citation -- Тестовые данные, не требуют цитирования
      properties: { source: 'web' },
    };
    expect(meta1.type).toBe('analytics');
    // eslint-disable-next-line @livai/rag/source-citation -- Тестовые данные, не требуют цитирования
    expect(meta2.properties).toEqual({ source: 'web' });
  });

  it('должен поддерживать тип feature_flag', () => {
    const meta: AuthMeta = { type: 'feature_flag', name: 'new-feature', enabled: true };
    expect(meta.type).toBe('feature_flag');
    expect(meta.name).toBe('new-feature');
    expect(meta.enabled).toBe(true);
  });

  it('должен поддерживать тип custom', () => {
    const meta: AuthMeta = { type: 'custom', key: 'custom-key', value: { nested: 'value' } };
    expect(meta.type).toBe('custom');

    expect(meta.key).toBe('custom-key');
    expect(meta.value).toEqual({ nested: 'value' });
  });
});

// ============================================================================
// ⚠️ AUTH ERROR
// ============================================================================

describe('AuthError', () => {
  it('должен поддерживать kind: network', () => {
    const error: AuthError = {
      kind: 'network',
      retryable: true,
      message: 'Network error',
      raw: createAuthErrorResponse(),
    };
    expect(error.kind).toBe('network');
    expect(error.retryable).toBe(true);
  });

  it('должен поддерживать kind: invalid_credentials', () => {
    const error: AuthError = {
      kind: 'invalid_credentials',
      message: 'Invalid credentials',
    };
    expect(error.kind).toBe('invalid_credentials');
  });

  it('должен поддерживать kind: account_locked', () => {
    const error: AuthError = {
      kind: 'account_locked',
      message: 'Account locked',
      lockedUntil: createISODateString(),
    };
    expect(error.kind).toBe('account_locked');
    expect(error.lockedUntil).toBeDefined();
  });

  it('должен поддерживать kind: account_disabled', () => {
    const error: AuthError = { kind: 'account_disabled', message: 'Account disabled' };
    expect(error.kind).toBe('account_disabled');
  });

  it('должен поддерживать kind: email_not_verified', () => {
    const error: AuthError = { kind: 'email_not_verified', message: 'Email not verified' };
    expect(error.kind).toBe('email_not_verified');
  });

  it('должен поддерживать kind: phone_not_verified', () => {
    const error: AuthError = { kind: 'phone_not_verified', message: 'Phone not verified' };
    expect(error.kind).toBe('phone_not_verified');
  });

  it('должен поддерживать kind: mfa_required', () => {
    const error: AuthError = {
      kind: 'mfa_required',
      message: 'MFA required',
      availableMethods: ['totp', 'sms'],
    };
    expect(error.kind).toBe('mfa_required');
    expect(error.availableMethods).toEqual(['totp', 'sms']);
  });

  it('должен поддерживать kind: mfa_failed', () => {
    const error: AuthError = {
      kind: 'mfa_failed',
      message: 'MFA failed',
      remainingAttempts: 2,
    };
    expect(error.kind).toBe('mfa_failed');
    expect(error.remainingAttempts).toBe(2);
  });

  it('должен поддерживать kind: token_expired', () => {
    const error: AuthError = { kind: 'token_expired', message: 'Token expired' };
    expect(error.kind).toBe('token_expired');
  });

  it('должен поддерживать kind: token_invalid', () => {
    const error: AuthError = { kind: 'token_invalid', message: 'Token invalid' };
    expect(error.kind).toBe('token_invalid');
  });

  it('должен поддерживать kind: session_expired', () => {
    const error: AuthError = { kind: 'session_expired', message: 'Session expired' };
    expect(error.kind).toBe('session_expired');
  });

  it('должен поддерживать kind: session_revoked', () => {
    const error: AuthError = {
      kind: 'session_revoked',
      message: 'Session revoked',
      reason: 'security-issue',
    };
    expect(error.kind).toBe('session_revoked');
    expect(error.reason).toBe('security-issue');
  });

  it('должен поддерживать kind: rate_limited', () => {
    const error: AuthError = {
      kind: 'rate_limited',
      message: 'Rate limited',
      retryAfter: createISODateString(),
    };
    expect(error.kind).toBe('rate_limited');
    expect(error.retryAfter).toBeDefined();
  });

  it('должен поддерживать kind: permission_denied', () => {
    const error: AuthError = {
      kind: 'permission_denied',
      message: 'Permission denied',
      requiredPermissions: ['admin'],
    };
    expect(error.kind).toBe('permission_denied');
    expect(error.requiredPermissions).toEqual(['admin']);
  });

  it('должен поддерживать kind: risk_blocked', () => {
    const error: AuthError = {
      kind: 'risk_blocked',
      message: 'Risk blocked',
      riskScore: 95,
    };
    expect(error.kind).toBe('risk_blocked');
    expect(error.riskScore).toBe(95);
  });

  it('должен поддерживать kind: oauth_error', () => {
    const error: AuthError = {
      kind: 'oauth_error',
      provider: 'google',
      message: 'OAuth error',
      raw: createOAuthErrorResponse(),
    };
    expect(error.kind).toBe('oauth_error');
    expect(error.provider).toBe('google');
  });

  it('должен поддерживать kind: unknown', () => {
    const error: AuthError = {
      kind: 'unknown',
      message: 'Unknown error',
      raw: createAuthErrorResponse(),
    };
    expect(error.kind).toBe('unknown');
    expect(error.raw).toBeDefined();
  });
});

// ============================================================================
// 🔐 AUTH STATE & STATUS
// ============================================================================

describe('AuthStatus', () => {
  it('должен поддерживать все статусы', () => {
    const statuses: AuthStatus[] = [
      'unauthenticated',
      'authenticating',
      'authenticated',
      'pending_secondary_verification',
      'session_expired',
      'error',
    ];
    statuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });
});

describe('AuthState', () => {
  it('должен поддерживать status: unauthenticated', () => {
    const state: AuthState = {
      status: 'unauthenticated',
      error: { kind: 'invalid_credentials' },
      meta: [{ type: 'telemetry', traceId: 'trace-123' }],
    };
    expect(state.status).toBe('unauthenticated');
  });

  it('должен поддерживать status: authenticating', () => {
    const state: AuthState = {
      status: 'authenticating',
      operation: 'login',
      meta: [{ type: 'analytics', event: 'login_attempt' }],
    };
    expect(state.status).toBe('authenticating');
    expect(state.operation).toBe('login');
  });

  it('должен поддерживать status: authenticated', () => {
    const state: AuthState = {
      status: 'authenticated',
      user: createMeUserInfo(),
      session: createMeSessionInfo(),
      roles: ['user', 'admin'],
      permissions: new Set(['read', 'write']),
      features: { newFeature: true },
      context: { org: 'test-org' },
      meta: [{ type: 'feature_flag', name: 'new-ui', enabled: true }],
    };
    expect(state.status).toBe('authenticated');
    expect(state.user).toBeDefined();
    expect(state.session).toBeDefined();
  });

  it('должен поддерживать status: pending_secondary_verification', () => {
    const state: AuthState = {
      status: 'pending_secondary_verification',
      userId: 'user-123',
      verificationType: 'mfa',
      error: { kind: 'mfa_required' },
      meta: [{ type: 'redirect', returnTo: '/verify' }],
    };
    expect(state.status).toBe('pending_secondary_verification');
    expect(state.userId).toBe('user-123');
  });

  it('должен поддерживать status: session_expired', () => {
    const state: AuthState = {
      status: 'session_expired',
      userId: 'user-123',
      error: { kind: 'session_expired' },
    };
    expect(state.status).toBe('session_expired');
    expect(state.userId).toBe('user-123');
  });

  it('должен поддерживать status: error', () => {
    const state: AuthState = {
      status: 'error',
      error: { kind: 'network', retryable: true },
      meta: [{ type: 'custom', key: 'error-details', value: 'details' }],
    };
    expect(state.status).toBe('error');
    expect(state.error).toBeDefined();
  });
});

// ============================================================================
// 🔐 MFA TYPES
// ============================================================================

describe('MfaStatus', () => {
  it('должен поддерживать все статусы MFA', () => {
    const statuses: MfaStatus[] = [
      'not_setup',
      'setup_in_progress',
      'setup_complete',
      'challenged',
      'verified',
      'failed',
      'recovery_required',
      'recovery_in_progress',
    ];
    statuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });
});

describe('MfaState', () => {
  it('должен поддерживать status: not_setup', () => {
    const state: MfaState = {
      status: 'not_setup',
      availableMethods: ['totp', 'sms'],
      meta: [{ type: 'experiment', flag: 'mfa-setup' }],
    };
    expect(state.status).toBe('not_setup');
  });

  it('должен поддерживать status: setup_in_progress', () => {
    const state: MfaState = {
      status: 'setup_in_progress',
      method: 'totp',
      setupId: 'setup-123',
      secret: 'secret-key',
    };
    expect(state.status).toBe('setup_in_progress');
    expect(state.method).toBe('totp');
  });

  it('должен поддерживать status: setup_complete', () => {
    const state: MfaState = {
      status: 'setup_complete',
      enabledMethods: ['totp', 'sms'],
      backupCodesCount: 10,
    };
    expect(state.status).toBe('setup_complete');
    expect(state.enabledMethods).toEqual(['totp', 'sms']);
  });

  it('должен поддерживать status: challenged', () => {
    const state: MfaState = {
      status: 'challenged',
      method: 'totp',
      challengeId: 'challenge-123',
      expiresAt: createISODateString(),
    };
    expect(state.status).toBe('challenged');
    expect(state.challengeId).toBe('challenge-123');
  });

  it('должен поддерживать status: verified', () => {
    const state: MfaState = {
      status: 'verified',
      method: 'totp',
      verifiedAt: createISODateString(),
    };
    expect(state.status).toBe('verified');
  });

  it('должен поддерживать status: failed', () => {
    const state: MfaState = {
      status: 'failed',
      method: 'totp',
      remainingAttempts: 2,
      error: { kind: 'mfa_failed', remainingAttempts: 2 },
    };
    expect(state.status).toBe('failed');
    expect(state.remainingAttempts).toBe(2);
  });

  it('должен поддерживать status: recovery_required', () => {
    const state: MfaState = {
      status: 'recovery_required',
      availableRecoveryMethods: ['backup_code', 'email_verification'],
      error: { kind: 'mfa_failed' },
    };
    expect(state.status).toBe('recovery_required');
  });

  it('должен поддерживать status: recovery_in_progress', () => {
    const state: MfaState = {
      status: 'recovery_in_progress',
      method: 'backup_code',
      recoveryId: 'recovery-123',
    };
    expect(state.status).toBe('recovery_in_progress');
  });
});

describe('MfaOperation', () => {
  it('должен поддерживать MfaChallengeRequest', () => {
    const operation: MfaOperation = {
      userId: 'user-123',
      type: 'totp',
      deviceId: 'device-123',
    };
    expect(operation.userId).toBe('user-123');
    expect(operation.type).toBe('totp');
  });

  it('должен поддерживать MfaSetupRequest', () => {
    const operation: MfaOperation = {
      userId: 'user-123',
      type: 'totp',
      secret: 'secret-key',
    };
    expect(operation.userId).toBe('user-123');
  });

  it('должен поддерживать MfaBackupCodeRequest', () => {
    const operation: MfaOperation = {
      userId: 'user-123',
      backupCode: 'ABCD-EFGH',
    };
    expect(operation.userId).toBe('user-123');
    expect(operation.backupCode).toBe('ABCD-EFGH');
  });

  it('должен поддерживать MfaRecoveryRequest', () => {
    const operation: MfaOperation = {
      userId: 'user-123',
      method: 'backup_code',
      proof: { backupCode: 'ABCD-EFGH' },
    };
    expect(operation.userId).toBe('user-123');
    expect(operation.method).toBe('backup_code');
  });
});

// ============================================================================
// 🌐 OAUTH TYPES
// ============================================================================

describe('OAuthStatus', () => {
  it('должен поддерживать все статусы OAuth', () => {
    const statuses: OAuthStatus[] = [
      'idle',
      'initiating',
      'redirecting',
      'processing',
      'success',
      'error',
    ];
    statuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });
});

describe('OAuthState', () => {
  it('должен поддерживать status: idle', () => {
    const state: OAuthState = { status: 'idle', meta: [] };
    expect(state.status).toBe('idle');
  });

  it('должен поддерживать status: initiating', () => {
    const state: OAuthState = { status: 'initiating', provider: 'google' };
    expect(state.status).toBe('initiating');
    expect(state.provider).toBe('google');
  });

  it('должен поддерживать status: redirecting', () => {
    const state: OAuthState = {
      status: 'redirecting',
      provider: 'google',
      redirectUrl: 'https://oauth.google.com',
      state: 'state-123',
    };
    expect(state.status).toBe('redirecting');
    expect(state.redirectUrl).toBe('https://oauth.google.com');
  });

  it('должен поддерживать status: processing', () => {
    const state: OAuthState = {
      status: 'processing',
      provider: 'google',
      code: 'auth-code-123',
      state: 'state-123',
    };
    expect(state.status).toBe('processing');
    expect(state.code).toBe('auth-code-123');
  });

  it('должен поддерживать status: success', () => {
    const state: OAuthState = {
      status: 'success',
      provider: 'google',
      result: createTokenPair(),
    };
    expect(state.status).toBe('success');
    expect(state.result).toBeDefined();
  });

  it('должен поддерживать status: error', () => {
    const state: OAuthState = {
      status: 'error',
      provider: 'google',
      error: createOAuthErrorResponse(),
    };
    expect(state.status).toBe('error');
    expect(state.error).toBeDefined();
  });
});

describe('OAuthOperation', () => {
  it('должен поддерживать OAuthLoginRequest', () => {
    const operation: OAuthOperation = {
      provider: 'google',
      providerToken: 'token-123',
    };
    expect(operation.provider).toBe('google');
  });

  it('должен поддерживать OAuthRegisterRequest', () => {
    const operation: OAuthOperation = {
      provider: 'google',
      providerToken: 'token-123',
    };
    expect(operation.provider).toBe('google');
  });
});

describe('OAuthError', () => {
  it('должен быть OAuthErrorResponse', () => {
    const error: OAuthError = createOAuthErrorResponse();
    expect(error.error).toBe('invalid_token');
    expect(error.provider).toBe('google');
  });
});

// ============================================================================
// 🛡️ SECURITY TYPES
// ============================================================================

describe('RiskLevel', () => {
  it('должен поддерживать все уровни риска', () => {
    const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    levels.forEach((level) => {
      expect(typeof level).toBe('string');
    });
  });
});

describe('SecurityStatus', () => {
  it('должен поддерживать все статусы безопасности', () => {
    const statuses: SecurityStatus[] = ['secure', 'risk_detected', 'blocked', 'review_required'];
    statuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });
});

describe('SecurityState', () => {
  it('должен поддерживать status: secure', () => {
    const state: SecurityState = {
      status: 'secure',
      riskScore: 10,
      meta: [],
    };
    expect(state.status).toBe('secure');
  });

  it('должен поддерживать status: risk_detected', () => {
    const state: SecurityState = {
      status: 'risk_detected',
      riskLevel: 'high',
      riskScore: 85,
      riskAssessment: createLoginRiskAssessment(),
      requiredActions: ['verify_email', 'verify_phone'],
    };
    expect(state.status).toBe('risk_detected');
    expect(state.riskLevel).toBe('high');
  });

  it('должен поддерживать status: blocked', () => {
    const state: SecurityState = {
      status: 'blocked',
      reason: 'Suspicious activity',
      blockedUntil: createISODateString(),
      error: { kind: 'risk_blocked', riskScore: 95 },
    };
    expect(state.status).toBe('blocked');
  });

  it('должен поддерживать status: review_required', () => {
    const state: SecurityState = {
      status: 'review_required',
      reason: 'Unusual location',
      riskScore: 70,
    };
    expect(state.status).toBe('review_required');
  });
});

describe('SessionStatus', () => {
  it('должен поддерживать все статусы сессии', () => {
    const statuses: SessionStatus[] = ['active', 'expired', 'revoked', 'suspended'];
    statuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });
});

describe('SessionState', () => {
  it('должен поддерживать status: active', () => {
    const state: SessionState = {
      status: 'active',
      sessionId: 'session-123',
      device: createDeviceInfo(),
      policy: createSessionPolicy(),
      issuedAt: createISODateString(),
      expiresAt: createISODateString(),
    };
    expect(state.status).toBe('active');
    expect(state.sessionId).toBe('session-123');
  });

  it('должен поддерживать status: expired', () => {
    const state: SessionState = {
      status: 'expired',
      sessionId: 'session-123',
      expiredAt: createISODateString(),
    };
    expect(state.status).toBe('expired');
  });

  it('должен поддерживать status: revoked', () => {
    const state: SessionState = {
      status: 'revoked',
      sessionId: 'session-123',
      reason: 'security-issue',
      revokedAt: createISODateString(),
    };
    expect(state.status).toBe('revoked');
  });

  it('должен поддерживать status: suspended', () => {
    const state: SessionState = {
      status: 'suspended',
      sessionId: 'session-123',
      reason: 'Policy violation',
      suspendedUntil: createISODateString(),
    };
    expect(state.status).toBe('suspended');
  });
});

describe('SecurityOperation', () => {
  it('должен поддерживать LoginRiskAssessment', () => {
    const operation: SecurityOperation = createLoginRiskAssessment();
    expect(operation.userId).toBe('user-123');
  });

  it('должен поддерживать SessionPolicy', () => {
    const operation: SecurityOperation = createSessionPolicy();
    expect(operation.maxConcurrentSessions).toBe(3);
  });

  it('должен поддерживать SessionRevokeRequest', () => {
    const operation: SecurityOperation = {
      sessionId: 'session-123',
      reason: 'security-issue',
    } as SessionRevokeRequest;
    const revokeRequest = operation as SessionRevokeRequest;
    expect(revokeRequest.sessionId).toBe('session-123');
  });

  it('должен поддерживать AuthAuditEvent', () => {
    const operation: SecurityOperation = {
      eventId: 'event-123',
      type: 'login_attempt',
      timestamp: createISODateString(),
    } as AuthAuditEvent;
    expect(operation).toBeDefined();
  });
});

// ============================================================================
// 🔄 RECOVERY TYPES
// ============================================================================

describe('RecoveryStatus', () => {
  it('должен поддерживать все статусы восстановления', () => {
    const statuses: RecoveryStatus[] = [
      'idle',
      'requested',
      'verifying',
      'confirmed',
      'completed',
      'expired',
      'error',
    ];
    statuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });
});

describe('PasswordRecoveryState', () => {
  it('должен поддерживать status: idle', () => {
    const state: PasswordRecoveryState = { status: 'idle' };
    expect(state.status).toBe('idle');
  });

  it('должен поддерживать status: requested', () => {
    const state: PasswordRecoveryState = {
      status: 'requested',
      identifierType: 'email',
      identifier: 'user@example.com',
      requestedAt: createISODateString(),
    };
    expect(state.status).toBe('requested');
    expect(state.identifierType).toBe('email');
  });

  it('должен поддерживать status: verifying', () => {
    const state: PasswordRecoveryState = {
      status: 'verifying',
      token: 'reset-token-123',
      expiresAt: createISODateString(),
    };
    expect(state.status).toBe('verifying');
  });

  it('должен поддерживать status: confirmed', () => {
    const state: PasswordRecoveryState = {
      status: 'confirmed',
      token: 'reset-token-123',
      confirmedAt: createISODateString(),
    };
    expect(state.status).toBe('confirmed');
  });

  it('должен поддерживать status: completed', () => {
    const state: PasswordRecoveryState = {
      status: 'completed',
      completedAt: createISODateString(),
    };
    expect(state.status).toBe('completed');
  });

  it('должен поддерживать status: expired', () => {
    const state: PasswordRecoveryState = {
      status: 'expired',
      token: 'reset-token-123',
      expiredAt: createISODateString(),
      error: { kind: 'token_expired' },
    };
    expect(state.status).toBe('expired');
  });

  it('должен поддерживать status: error', () => {
    const state: PasswordRecoveryState = {
      status: 'error',
      error: { kind: 'invalid_credentials' },
    };
    expect(state.status).toBe('error');
  });
});

describe('VerificationState', () => {
  it('должен поддерживать status: idle', () => {
    const state: VerificationState = { status: 'idle' };
    expect(state.status).toBe('idle');
  });

  it('должен поддерживать status: sent', () => {
    const state: VerificationState = {
      status: 'sent',
      type: 'email',
      target: 'user@example.com',
      sentAt: createISODateString(),
      expiresAt: createISODateString(),
    };
    expect(state.status).toBe('sent');
    expect(state.type).toBe('email');
  });

  it('должен поддерживать status: verifying', () => {
    const state: VerificationState = {
      status: 'verifying',
      type: 'phone',
      code: '123456',
    };
    expect(state.status).toBe('verifying');
    expect(state.code).toBe('123456');
  });

  it('должен поддерживать status: verified', () => {
    const state: VerificationState = {
      status: 'verified',
      type: 'email',
      verifiedAt: createISODateString(),
    };
    expect(state.status).toBe('verified');
  });

  it('должен поддерживать status: expired', () => {
    const state: VerificationState = {
      status: 'expired',
      type: 'phone',
      expiredAt: createISODateString(),
      error: { kind: 'token_expired' },
    };
    expect(state.status).toBe('expired');
  });

  it('должен поддерживать status: error', () => {
    const state: VerificationState = {
      status: 'error',
      type: 'email',
      error: { kind: 'invalid_credentials' },
    };
    expect(state.status).toBe('error');
  });
});

describe('RecoveryOperation', () => {
  it('должен поддерживать PasswordResetRequest', () => {
    const operation: RecoveryOperation = {
      identifier: { type: 'email', value: 'user@example.com' },
    } as PasswordResetRequest;
    expect(operation).toBeDefined();
  });

  it('должен поддерживать PasswordResetConfirm', () => {
    const operation: RecoveryOperation = {
      token: 'reset-token',
      newPassword: 'new-password',
    } as PasswordResetConfirm;
    expect(operation).toBeDefined();
  });

  it('должен поддерживать VerifyEmailRequest', () => {
    const operation: RecoveryOperation = {
      token: 'verify-token',
    } as VerifyEmailRequest;
    expect(operation).toBeDefined();
  });

  it('должен поддерживать VerifyPhoneRequest', () => {
    const operation: RecoveryOperation = {
      phone: '+1234567890',
      code: '123456',
    } as VerifyPhoneRequest;
    expect(operation).toBeDefined();
  });

  it('должен поддерживать MfaRecoveryRequest', () => {
    const operation: RecoveryOperation = {
      userId: 'user-123',
      method: 'backup_code',
      proof: { backupCode: 'ABCD-EFGH' },
    } as MfaRecoveryRequest;
    expect(operation).toBeDefined();
  });
});

// ============================================================================
// 📊 AGGREGATED REQUEST/RESPONSE TYPES
// ============================================================================

describe('AuthRequest', () => {
  it('должен поддерживать LoginRequest', () => {
    const request: AuthRequest = {
      identifier: { type: 'email', value: 'user@example.com' },
      password: 'password',
    } as LoginRequest;
    expect(request).toBeDefined();
  });

  it('должен поддерживать RegisterRequest', () => {
    const request: AuthRequest = {
      identifier: { type: 'email', value: 'user@example.com' },
      password: 'password',
    } as RegisterRequest;
    expect(request).toBeDefined();
  });

  it('должен поддерживать OAuthLoginRequest', () => {
    const request: AuthRequest = {
      provider: 'google',
      providerToken: 'token-123',
    } as OAuthLoginRequest;
    expect(request).toBeDefined();
  });

  it('должен поддерживать OAuthRegisterRequest', () => {
    const request: AuthRequest = {
      provider: 'google',
      providerToken: 'token-123',
    } as OAuthRegisterRequest;
    expect(request).toBeDefined();
  });

  it('должен поддерживать RefreshTokenRequest', () => {
    const request: AuthRequest = {
      refreshToken: 'refresh-token',
    } as RefreshTokenRequest;
    expect(request).toBeDefined();
  });

  it('должен поддерживать LogoutRequest', () => {
    const request: AuthRequest = {
      refreshToken: 'refresh-token',
    } as LogoutRequest;
    expect(request).toBeDefined();
  });

  it('должен поддерживать MfaOperation', () => {
    const request: AuthRequest = {
      userId: 'user-123',
      type: 'totp',
    } as MfaChallengeRequest;
    expect(request).toBeDefined();
  });

  it('должен поддерживать RecoveryOperation', () => {
    const request: AuthRequest = {
      identifier: { type: 'email', value: 'user@example.com' },
    } as PasswordResetRequest;
    expect(request).toBeDefined();
  });
});

describe('AuthResponse', () => {
  it('должен поддерживать RegisterResponse', () => {
    const response: AuthResponse = {
      userId: 'user-123',
      mfaRequired: false,
    } as RegisterResponse;
    expect(response).toBeDefined();
  });

  it('должен поддерживать MeResponse', () => {
    const response: AuthResponse = {
      user: createMeUserInfo(),
      roles: ['user'],
      permissions: ['read'], // MeResponse использует массив, не Set
    } as MeResponse;
    expect(response).toBeDefined();
  });

  it('должен поддерживать TokenPair', () => {
    const response: AuthResponse = createTokenPair();
    expect(response).toBeDefined();
  });

  it('должен поддерживать AuthErrorResponse', () => {
    const response: AuthResponse = createAuthErrorResponse();
    expect(response).toBeDefined();
  });

  it('должен поддерживать OAuthErrorResponse', () => {
    const response: AuthResponse = createOAuthErrorResponse();
    expect(response).toBeDefined();
  });
});

// ============================================================================
// 🎯 COMMAND & EVENT TYPES
// ============================================================================

describe('AuthCommand', () => {
  it('должен поддерживать type: login', () => {
    const command: AuthCommand = {
      type: 'login',
      payload: {
        identifier: { type: 'email', value: 'user@example.com' },
        password: 'password',
      },
    };
    expect(command.type).toBe('login');
    expect(command.payload).toBeDefined();
  });

  it('должен поддерживать type: register', () => {
    const command: AuthCommand = {
      type: 'register',
      payload: {
        identifier: { type: 'email', value: 'user@example.com' },
        password: 'password',
      },
    };
    expect(command.type).toBe('register');
  });

  it('должен поддерживать type: logout', () => {
    const command: AuthCommand = {
      type: 'logout',
      payload: {
        refreshToken: 'refresh-token',
      },
    };
    expect(command.type).toBe('logout');
  });

  it('должен поддерживать type: refresh', () => {
    const command: AuthCommand = {
      type: 'refresh',
      payload: {
        refreshToken: 'refresh-token',
      },
    };
    expect(command.type).toBe('refresh');
  });

  it('должен поддерживать type: oauth_login', () => {
    const command: AuthCommand = {
      type: 'oauth_login',
      payload: {
        provider: 'google',
        providerToken: 'token-123',
      },
    };
    expect(command.type).toBe('oauth_login');
  });

  it('должен поддерживать type: oauth_register', () => {
    const command: AuthCommand = {
      type: 'oauth_register',
      payload: {
        provider: 'google',
        providerToken: 'token-123',
      },
    };
    expect(command.type).toBe('oauth_register');
  });

  it('должен поддерживать type: mfa_challenge', () => {
    const command: AuthCommand = {
      type: 'mfa_challenge',
      payload: {
        userId: 'user-123',
        type: 'totp',
      },
    };
    expect(command.type).toBe('mfa_challenge');
  });

  it('должен поддерживать type: mfa_setup', () => {
    const command: AuthCommand = {
      type: 'mfa_setup',
      payload: {
        userId: 'user-123',
        type: 'totp',
      },
    };
    expect(command.type).toBe('mfa_setup');
  });

  it('должен поддерживать type: mfa_backup_code', () => {
    const command: AuthCommand = {
      type: 'mfa_backup_code',
      payload: {
        userId: 'user-123',
        backupCode: 'ABCD-EFGH',
      },
    };
    expect(command.type).toBe('mfa_backup_code');
  });

  it('должен поддерживать type: mfa_recovery', () => {
    const command: AuthCommand = {
      type: 'mfa_recovery',
      payload: {
        userId: 'user-123',
        method: 'backup_code',
        proof: { backupCode: 'ABCD-EFGH' },
      },
    };
    expect(command.type).toBe('mfa_recovery');
  });

  it('должен поддерживать type: password_reset_request', () => {
    const command: AuthCommand = {
      type: 'password_reset_request',
      payload: {
        identifier: { type: 'email', value: 'user@example.com' },
      },
    };
    expect(command.type).toBe('password_reset_request');
  });

  it('должен поддерживать type: password_reset_confirm', () => {
    const command: AuthCommand = {
      type: 'password_reset_confirm',
      payload: {
        token: 'reset-token',
        newPassword: 'new-password',
      },
    };
    expect(command.type).toBe('password_reset_confirm');
  });

  it('должен поддерживать type: verify_email', () => {
    const command: AuthCommand = {
      type: 'verify_email',
      payload: {
        token: 'verify-token',
      },
    };
    expect(command.type).toBe('verify_email');
  });

  it('должен поддерживать type: verify_phone', () => {
    const command: AuthCommand = {
      type: 'verify_phone',
      payload: {
        phone: '+1234567890',
        code: '123456',
      },
    };
    expect(command.type).toBe('verify_phone');
  });

  it('должен поддерживать type: session_revoke', () => {
    const command: AuthCommand = {
      type: 'session_revoke',
      payload: {
        sessionId: 'session-123',
        reason: 'security-issue',
      },
    };
    expect(command.type).toBe('session_revoke');
  });
});

describe('AuthEvent', () => {
  it('должен поддерживать type: user_logged_in', () => {
    const event: AuthEvent = {
      type: 'user_logged_in',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        tokenPair: createTokenPair(),
        session: createMeSessionInfo(),
      },
    };
    expect(event.type).toBe('user_logged_in');
    expect(event.timestamp).toBeDefined();
    expect(event.payload.userId).toBe('user-123');
  });

  it('должен поддерживать type: user_logged_out', () => {
    const event: AuthEvent = {
      type: 'user_logged_out',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        sessionId: 'session-123',
      },
    };
    expect(event.type).toBe('user_logged_out');
  });

  it('должен поддерживать type: user_registered', () => {
    const event: AuthEvent = {
      type: 'user_registered',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        tokenPair: createTokenPair(),
        mfaRequired: false,
      },
    };
    expect(event.type).toBe('user_registered');
  });

  it('должен поддерживать type: token_refreshed', () => {
    const event: AuthEvent = {
      type: 'token_refreshed',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        tokenPair: createTokenPair(),
      },
    };
    expect(event.type).toBe('token_refreshed');
  });

  it('должен поддерживать type: mfa_challenge_sent', () => {
    const event: AuthEvent = {
      type: 'mfa_challenge_sent',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        method: 'totp',
        challengeId: 'challenge-123',
      },
    };
    expect(event.type).toBe('mfa_challenge_sent');
  });

  it('должен поддерживать type: mfa_verified', () => {
    const event: AuthEvent = {
      type: 'mfa_verified',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        method: 'totp',
      },
    };
    expect(event.type).toBe('mfa_verified');
  });

  it('должен поддерживать type: mfa_failed', () => {
    const event: AuthEvent = {
      type: 'mfa_failed',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        method: 'totp',
        remainingAttempts: 2,
      },
    };
    expect(event.type).toBe('mfa_failed');
  });

  it('должен поддерживать type: email_verified', () => {
    const event: AuthEvent = {
      type: 'email_verified',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
      },
    };
    expect(event.type).toBe('email_verified');
  });

  it('должен поддерживать type: phone_verified', () => {
    const event: AuthEvent = {
      type: 'phone_verified',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
      },
    };
    expect(event.type).toBe('phone_verified');
  });

  it('должен поддерживать type: password_reset_requested', () => {
    const event: AuthEvent = {
      type: 'password_reset_requested',
      timestamp: createISODateString(),
      payload: {
        identifier: 'user@example.com',
        identifierType: 'email',
      },
    };
    expect(event.type).toBe('password_reset_requested');
  });

  it('должен поддерживать type: password_reset_completed', () => {
    const event: AuthEvent = {
      type: 'password_reset_completed',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
      },
    };
    expect(event.type).toBe('password_reset_completed');
  });

  it('должен поддерживать type: session_revoked', () => {
    const event: AuthEvent = {
      type: 'session_revoked',
      timestamp: createISODateString(),
      payload: {
        sessionId: 'session-123',
        reason: 'security-issue',
      },
    };
    expect(event.type).toBe('session_revoked');
  });

  it('должен поддерживать type: session_expired', () => {
    const event: AuthEvent = {
      type: 'session_expired',
      timestamp: createISODateString(),
      payload: {
        sessionId: 'session-123',
      },
    };
    expect(event.type).toBe('session_expired');
  });

  it('должен поддерживать type: risk_detected', () => {
    const event: AuthEvent = {
      type: 'risk_detected',
      timestamp: createISODateString(),
      payload: {
        userId: 'user-123',
        riskScore: 85,
        riskLevel: 'high',
        assessment: createLoginRiskAssessment(),
      },
    };
    expect(event.type).toBe('risk_detected');
  });

  it('должен поддерживать type: auth_error', () => {
    const event: AuthEvent = {
      type: 'auth_error',
      timestamp: createISODateString(),
      payload: {
        error: { kind: 'invalid_credentials' },
        userId: 'user-123',
      },
    };
    expect(event.type).toBe('auth_error');
  });

  it('должен поддерживать type: oauth_success', () => {
    const event: AuthEvent = {
      type: 'oauth_success',
      timestamp: createISODateString(),
      payload: {
        provider: 'google',
        userId: 'user-123',
        tokenPair: createTokenPair(),
      },
    };
    expect(event.type).toBe('oauth_success');
  });

  it('должен поддерживать type: oauth_error', () => {
    const event: AuthEvent = {
      type: 'oauth_error',
      timestamp: createISODateString(),
      payload: {
        provider: 'google',
        error: createOAuthErrorResponse(),
      },
    };
    expect(event.type).toBe('oauth_error');
  });
});
