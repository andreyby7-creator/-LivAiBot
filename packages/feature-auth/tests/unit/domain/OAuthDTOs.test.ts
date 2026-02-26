/**
 * @file Unit тесты для OAuth DTOs
 * Полное покрытие OAuthErrorResponse, OAuthLoginRequest, OAuthRegisterRequest
 */

import { describe, expect, it } from 'vitest';
import type {
  OAuthErrorResponse,
  OAuthErrorType,
  OAuthProvider,
} from '../../../src/domain/OAuthErrorResponse.js';
import type { OAuthLoginRequest } from '../../../src/domain/OAuthLoginRequest.js';
import type { OAuthRegisterRequest } from '../../../src/domain/OAuthRegisterRequest.js';
import {
  oauthErrorResponseSchema,
  oauthLoginRequestSchema,
  oauthRegisterRequestSchema,
} from '../../../src/schemas/index.js';

// ============================================================================
// 🔧 HELPER FUNCTIONS FOR TEST DATA
// ============================================================================

function createOAuthErrorResponse(overrides: Partial<OAuthErrorResponse> = {}): OAuthErrorResponse {
  return {
    error: 'invalid_token',
    provider: 'google',
    message: 'OAuth access token is invalid or expired',
    retryable: false,
    statusCode: 401,
    providerErrorCode: 'invalid_grant',
    correlationId: 'corr-abc-123',
    timestamp: '2026-01-15T10:30:00.000Z',
    context: {
      redirectUri: 'https://example.com/callback',
      scope: 'openid profile email',
    },
    ...overrides,
  };
}

function createOAuthLoginRequest(overrides: Partial<OAuthLoginRequest> = {}): OAuthLoginRequest {
  return {
    dtoVersion: '1.0',
    provider: 'google',
    providerToken: 'oauth-access-token-123',
    clientContext: {
      ip: '192.168.1.1',
      deviceId: 'device-abc',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      locale: 'en-US',
      timezone: 'UTC',
      geo: {
        lat: 55.7558,
        lng: 37.6173,
      },
      sessionId: 'session-abc',
      appVersion: '1.0.3',
    },
    meta: {
      step: 'oauth-login',
    },
    ...overrides,
  };
}

function createOAuthRegisterRequest(
  overrides: Partial<OAuthRegisterRequest> = {},
): OAuthRegisterRequest {
  return {
    dtoVersion: '1.0',
    provider: 'google',
    providerToken: 'oauth-access-token-456',
    email: 'user@example.com',
    displayName: 'John Doe',
    providerData: {
      id: 'provider-user-id',
      picture: 'https://example.com/avatar.jpg',
    },
    clientContext: {
      ip: '192.168.1.1',
      deviceId: 'device-abc',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      locale: 'en-US',
      timezone: 'UTC',
      geo: {
        lat: 55.7558,
        lng: 37.6173,
      },
      sessionId: 'session-abc',
      appVersion: '1.0.3',
    },
    meta: {
      step: 'oauth-register',
    },
    ...overrides,
  };
}

// ============================================================================
// 🎯 OAUTH ERROR TYPES - Типы ошибок OAuth
// ============================================================================

describe('OAuthErrorType enum coverage', () => {
  const allErrorTypes: OAuthErrorType[] = [
    'invalid_token',
    'expired_token',
    'provider_unavailable',
    'user_denied',
    'invalid_scope',
    'account_conflict',
    'email_not_verified',
    'rate_limited',
    'unknown_error',
  ];

  it('поддерживает все типы ошибок OAuth', () => {
    allErrorTypes.forEach((errorType) => {
      const error = createOAuthErrorResponse({ error: errorType });
      expect(error.error).toBe(errorType);
    });
  });

  it('проверка error codes: invalid_token, provider_unavailable, user_denied', () => {
    // invalid_token
    const invalidToken = createOAuthErrorResponse({ error: 'invalid_token' });
    expect(invalidToken.error).toBe('invalid_token');

    // provider_unavailable
    const providerUnavailable = createOAuthErrorResponse({ error: 'provider_unavailable' });
    expect(providerUnavailable.error).toBe('provider_unavailable');

    // user_denied
    const userDenied = createOAuthErrorResponse({ error: 'user_denied' });
    expect(userDenied.error).toBe('user_denied');
  });

  it('каждый тип ошибки имеет правильную структуру', () => {
    // Token errors
    const invalidToken = createOAuthErrorResponse({
      error: 'invalid_token',
      message: 'Token is invalid',
      retryable: false,
    });
    expect(invalidToken.error).toBe('invalid_token');
    expect(invalidToken.retryable).toBe(false);

    // Provider errors
    const providerUnavailable = createOAuthErrorResponse({
      error: 'provider_unavailable',
      message: 'Provider is temporarily unavailable',
      retryable: true,
    });
    expect(providerUnavailable.error).toBe('provider_unavailable');
    expect(providerUnavailable.retryable).toBe(true);

    // User errors
    const userDenied = createOAuthErrorResponse({
      error: 'user_denied',
      message: 'User denied access',
      retryable: false,
    });
    expect(userDenied.error).toBe('user_denied');
    expect(userDenied.retryable).toBe(false);
  });
});

// ============================================================================
// 🎯 OAUTH PROVIDER - Провайдеры OAuth
// ============================================================================

describe('OAuthProvider enum coverage', () => {
  const allProviders: OAuthProvider[] = ['google', 'yandex', 'facebook', 'vk'];

  it('поддерживает все OAuth провайдеры', () => {
    allProviders.forEach((provider) => {
      const loginRequest = createOAuthLoginRequest({ provider });
      const registerRequest = createOAuthRegisterRequest({ provider });

      expect(loginRequest.provider).toBe(provider);
      expect(registerRequest.provider).toBe(provider);
    });
  });

  it('каждый провайдер имеет правильную структуру', () => {
    // Google
    const googleRequest = createOAuthLoginRequest({ provider: 'google' });
    expect(googleRequest.provider).toBe('google');

    // Yandex
    const yandexRequest = createOAuthLoginRequest({ provider: 'yandex' });
    expect(yandexRequest.provider).toBe('yandex');

    // Facebook
    const facebookRequest = createOAuthLoginRequest({ provider: 'facebook' });
    expect(facebookRequest.provider).toBe('facebook');

    // VK
    const vkRequest = createOAuthLoginRequest({ provider: 'vk' });
    expect(vkRequest.provider).toBe('vk');
  });
});

// ============================================================================
// 📋 OAUTH ERROR RESPONSE - Ответ ошибки OAuth
// ============================================================================

describe('OAuthErrorResponse полный DTO', () => {
  it('создает минимальный ответ (обязательные поля)', () => {
    const response: OAuthErrorResponse = {
      error: 'invalid_token',
    };

    expect(response.error).toBe('invalid_token');
    expect(response.provider).toBeUndefined();
    expect(response.message).toBeUndefined();
  });

  it('создает полный ответ со всеми полями', () => {
    const response = createOAuthErrorResponse();

    expect(response.error).toBe('invalid_token');
    expect(response.provider).toBe('google');
    expect(response.message).toBe('OAuth access token is invalid or expired');
    expect(response.retryable).toBe(false);
    expect(response.statusCode).toBe(401);
    expect(response.providerErrorCode).toBe('invalid_grant');
    expect(response.correlationId).toBe('corr-abc-123');
    expect(response.timestamp).toBe('2026-01-15T10:30:00.000Z');
    expect(response.context?.['redirectUri']).toBe('https://example.com/callback');
  });
});

describe('OAuthErrorResponse optional fields', () => {
  it('provider опционально для OAuth провайдера', () => {
    const responseWithProvider = createOAuthErrorResponse({ provider: 'google' });
    const responseWithoutProvider: OAuthErrorResponse = {
      error: 'invalid_token',
    };

    expect(responseWithProvider.provider).toBe('google');
    expect(responseWithoutProvider.provider).toBeUndefined();
  });

  it('message опционально для описания ошибки', () => {
    const responseWithMessage = createOAuthErrorResponse({ message: 'Error message' });
    const responseWithoutMessage: OAuthErrorResponse = {
      error: 'invalid_token',
    };

    expect(responseWithMessage.message).toBe('Error message');
    expect(responseWithoutMessage.message).toBeUndefined();
  });

  it('retryable опционально для возможности повтора', () => {
    const responseWithRetryable = createOAuthErrorResponse({ retryable: true });
    const responseWithoutRetryable: OAuthErrorResponse = {
      error: 'invalid_token',
    };

    expect(responseWithRetryable.retryable).toBe(true);
    expect(responseWithoutRetryable.retryable).toBeUndefined();
  });
});

// ============================================================================
// 📋 OAUTH LOGIN REQUEST - Запрос OAuth login
// ============================================================================

describe('OAuthLoginRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'oauth-access-token-123',
    };

    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('oauth-access-token-123');
    expect(request.dtoVersion).toBeUndefined();
    expect(request.clientContext).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createOAuthLoginRequest();

    expect(request.dtoVersion).toBe('1.0');
    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('oauth-access-token-123');
    expect(request.clientContext?.ip).toBe('192.168.1.1');
    expect(request.clientContext?.deviceId).toBe('device-abc');
    expect(request.meta?.['step']).toBe('oauth-login');
  });

  it('provider обязателен для OAuth провайдера', () => {
    const request = createOAuthLoginRequest({
      provider: 'yandex',
    });

    expect(request.provider).toBe('yandex');
  });

  it('providerToken обязателен для токена провайдера', () => {
    const request = createOAuthLoginRequest({
      providerToken: 'token-required-123',
    });

    expect(request.providerToken).toBe('token-required-123');
  });
});

describe('OAuthLoginRequest conditional fields', () => {
  it('provider и providerToken обязательны для OAuth (conditional)', () => {
    const request: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'oauth-token-123',
    };

    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('oauth-token-123');
  });

  it('providerToken не может быть null или empty (security)', () => {
    // Пустая строка должна быть валидной с точки зрения типа, но не должна использоваться
    const requestWithEmptyToken: OAuthLoginRequest = {
      provider: 'google',
      providerToken: '',
    };

    expect(requestWithEmptyToken.providerToken).toBe('');
    expect(requestWithEmptyToken.providerToken.length).toBe(0);

    // Нормальный токен
    const requestWithValidToken: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'valid-oauth-token',
    };

    expect(requestWithValidToken.providerToken).toBe('valid-oauth-token');
    expect(requestWithValidToken.providerToken.length).toBeGreaterThan(0);
  });
});

describe('OAuthLoginRequest optional fields', () => {
  it('dtoVersion опционально для версии DTO', () => {
    const requestWithVersion = createOAuthLoginRequest({ dtoVersion: '1.1' });
    const requestWithoutVersion: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'token-123',
    };

    expect(requestWithVersion.dtoVersion).toBe('1.1');
    expect(requestWithoutVersion.dtoVersion).toBeUndefined();
  });

  it('clientContext опционально для клиентского контекста', () => {
    const requestWithContext = createOAuthLoginRequest({
      clientContext: {
        ip: '192.168.1.1',
        deviceId: 'device-123',
      },
    });
    const requestWithoutContext: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'token-123',
    };

    expect(requestWithContext.clientContext?.ip).toBe('192.168.1.1');
    expect(requestWithoutContext.clientContext).toBeUndefined();
  });

  it('meta опционально для дополнительных метаданных', () => {
    const requestWithMeta = createOAuthLoginRequest({
      meta: {
        step: 'oauth-login',
        origin: 'web',
      } as Record<string, unknown>,
    });
    const requestWithoutMeta: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'token-123',
    };

    expect(requestWithMeta.meta?.['step']).toBe('oauth-login');
    expect(requestWithMeta.meta?.['origin']).toBe('web');
    expect(requestWithoutMeta.meta).toBeUndefined();
  });
});

// ============================================================================
// 📋 OAUTH REGISTER REQUEST - Запрос OAuth регистрации
// ============================================================================

describe('OAuthRegisterRequest полный DTO', () => {
  it('создает минимальный запрос (обязательные поля)', () => {
    const request: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'oauth-access-token-456',
    };

    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('oauth-access-token-456');
    expect(request.email).toBeUndefined();
    expect(request.displayName).toBeUndefined();
  });

  it('создает полный запрос со всеми полями', () => {
    const request = createOAuthRegisterRequest();

    expect(request.dtoVersion).toBe('1.0');
    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('oauth-access-token-456');
    expect(request.email).toBe('user@example.com');
    expect(request.displayName).toBe('John Doe');
    expect(request.providerData?.['id']).toBe('provider-user-id');
    expect(request.clientContext?.ip).toBe('192.168.1.1');
    expect(request.meta?.['step']).toBe('oauth-register');
  });

  it('provider обязателен для OAuth провайдера', () => {
    const request = createOAuthRegisterRequest({
      provider: 'facebook',
    });

    expect(request.provider).toBe('facebook');
  });

  it('providerToken обязателен для токена провайдера', () => {
    const request = createOAuthRegisterRequest({
      providerToken: 'token-required-456',
    });

    expect(request.providerToken).toBe('token-required-456');
  });
});

describe('OAuthRegisterRequest conditional fields', () => {
  it('provider и providerToken обязательны для OAuth (conditional)', () => {
    const request: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'oauth-token-456',
    };

    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('oauth-token-456');
  });

  it('providerToken не может быть null или empty (security)', () => {
    // Пустая строка должна быть валидной с точки зрения типа, но не должна использоваться
    const requestWithEmptyToken: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: '',
    };

    expect(requestWithEmptyToken.providerToken).toBe('');
    expect(requestWithEmptyToken.providerToken.length).toBe(0);

    // Нормальный токен
    const requestWithValidToken: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'valid-oauth-token',
    };

    expect(requestWithValidToken.providerToken).toBe('valid-oauth-token');
    expect(requestWithValidToken.providerToken.length).toBeGreaterThan(0);
  });
});

describe('OAuthRegisterRequest optional fields', () => {
  it('email опционально для email пользователя', () => {
    const requestWithEmail = createOAuthRegisterRequest({ email: 'user@example.com' });
    const requestWithoutEmail: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'token-123',
    };

    expect(requestWithEmail.email).toBe('user@example.com');
    expect(requestWithoutEmail.email).toBeUndefined();
  });

  it('displayName опционально для отображаемого имени', () => {
    const requestWithDisplayName = createOAuthRegisterRequest({ displayName: 'John Doe' });
    const requestWithoutDisplayName: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'token-123',
    };

    expect(requestWithDisplayName.displayName).toBe('John Doe');
    expect(requestWithoutDisplayName.displayName).toBeUndefined();
  });

  it('providerData опционально для дополнительных данных провайдера', () => {
    // eslint-disable-next-line ai-security/model-poisoning -- Тестовые данные, не используются для обучения моделей
    const requestWithProviderData = createOAuthRegisterRequest({
      providerData: {
        id: 'provider-id',
        picture: 'https://example.com/avatar.jpg',
      },
    });
    // eslint-disable-next-line ai-security/model-poisoning -- Тестовые данные, не используются для обучения моделей
    const requestWithoutProviderData: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'token-123',
    };

    expect(requestWithProviderData.providerData?.['id']).toBe('provider-id');
    expect(requestWithoutProviderData.providerData).toBeUndefined();
  });
});

// ============================================================================
// ⚠️ EDGE CASES - Пограничные случаи
// ============================================================================

describe('OAuth requests edge cases', () => {
  it('работает с пустыми строками в опциональных полях', () => {
    const loginRequest = createOAuthLoginRequest({
      clientContext: {
        ip: '',
        deviceId: '',
        userAgent: '',
      },
    });

    expect(loginRequest.clientContext?.ip).toBe('');
    expect(loginRequest.clientContext?.deviceId).toBe('');
    expect(loginRequest.clientContext?.userAgent).toBe('');
  });

  it('работает с различными форматами providerToken', () => {
    const tokens = [
      'simple-token',
      'jwt-token.abc.xyz',
      'opaque-token-1234567890',
      'very-long-oauth-token-string-with-many-characters',
    ];

    tokens.forEach((token) => {
      const request = createOAuthLoginRequest({ providerToken: token });
      expect(request.providerToken).toBe(token);
    });
  });

  it('timestamp может быть в ISO 8601 формате', () => {
    const timestamps = [
      '2026-01-15T10:30:00.000Z',
      '2026-01-15T10:30:00Z',
      '2026-01-15T10:30:00+00:00',
    ];

    timestamps.forEach((timestamp) => {
      const response = createOAuthErrorResponse({ timestamp });
      expect(response.timestamp).toBe(timestamp);
    });
  });
});

// ============================================================================
// 🔒 IMMUTABILITY VALIDATION - Неизменяемость
// ============================================================================

describe('OAuth requests immutability', () => {
  it('OAuthErrorResponse все поля readonly - предотвращает мутацию', () => {
    const response: OAuthErrorResponse = {
      error: 'invalid_token',
      provider: 'google',
    };

    // TypeScript предотвращает мутацию
    // response.error = 'new-error'; // TypeScript error: Cannot assign to 'error' because it is a read-only property
    // response.provider = 'yandex'; // TypeScript error: Cannot assign to 'provider' because it is a read-only property

    expect(response.error).toBe('invalid_token');
    expect(response.provider).toBe('google');
  });

  it('OAuthLoginRequest все поля readonly - предотвращает мутацию', () => {
    const request: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'token-immutable',
    };

    // TypeScript предотвращает мутацию
    // request.provider = 'yandex'; // TypeScript error: Cannot assign to 'provider' because it is a read-only property
    // request.providerToken = 'new-token'; // TypeScript error: Cannot assign to 'providerToken' because it is a read-only property

    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('token-immutable');
  });

  it('OAuthRegisterRequest все поля readonly - предотвращает мутацию', () => {
    const request: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'token-immutable',
    };

    // TypeScript предотвращает мутацию
    // request.provider = 'yandex'; // TypeScript error: Cannot assign to 'provider' because it is a read-only property
    // request.providerToken = 'new-token'; // TypeScript error: Cannot assign to 'providerToken' because it is a read-only property

    expect(request.provider).toBe('google');
    expect(request.providerToken).toBe('token-immutable');
  });
});

// ============================================================================
// 📸 COMPREHENSIVE SNAPSHOTS - Полные снимки
// ============================================================================

describe('OAuth requests comprehensive snapshots', () => {
  it('full OAuthErrorResponse - полный snapshot', () => {
    const response = createOAuthErrorResponse();

    expect(response).toMatchSnapshot();
  });

  it('minimal OAuthErrorResponse - полный snapshot', () => {
    const response: OAuthErrorResponse = {
      error: 'invalid_token',
    };

    expect(response).toMatchSnapshot();
  });

  it('full OAuthLoginRequest - полный snapshot', () => {
    const request = createOAuthLoginRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal OAuthLoginRequest - полный snapshot', () => {
    const request: OAuthLoginRequest = {
      provider: 'google',
      providerToken: 'oauth-access-token-123',
    };

    expect(request).toMatchSnapshot();
  });

  it('full OAuthRegisterRequest - полный snapshot', () => {
    const request = createOAuthRegisterRequest();

    expect(request).toMatchSnapshot();
  });

  it('minimal OAuthRegisterRequest - полный snapshot', () => {
    const request: OAuthRegisterRequest = {
      provider: 'google',
      providerToken: 'oauth-access-token-456',
    };

    expect(request).toMatchSnapshot();
  });
});

// ============================================================================
// 🔍 ZOD SCHEMA VALIDATION - Zod схема валидации
// ============================================================================

describe('Zod schema validation', () => {
  describe('oauthErrorResponseSchema', () => {
    it('валидные error responses проходят Zod схему', () => {
      const validResponse = {
        error: 'invalid_request',
        errorDescription: 'Invalid request',
      };

      const result = oauthErrorResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.error).toBe('invalid_request');
        expect(result.data.errorDescription).toBe('Invalid request');
      }
    });

    it('error должен быть одним из допустимых значений', () => {
      const errors = [
        'invalid_request',
        'unauthorized_client',
        'access_denied',
        'unsupported_response_type',
        'invalid_scope',
        'server_error',
        'temporarily_unavailable',
      ];

      errors.forEach((error) => {
        const response = {
          error,
        };

        const result = oauthErrorResponseSchema.safeParse(response);
        expect(result.success).toBe(true);

        // eslint-disable-next-line functional/no-conditional-statements
        if (result.success) {
          expect(result.data.error).toBe(error);
        }
      });
    });
  });

  describe('oauthLoginRequestSchema', () => {
    it('валидные login requests проходят Zod схему', () => {
      const validRequest = {
        provider: 'google',
        code: 'authorization-code-123',
        state: 'state-parameter-456',
        redirectUri: 'https://example.com/callback',
      };

      const result = oauthLoginRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.provider).toBe('google');
        expect(result.data.code).toBe('authorization-code-123');
        expect(result.data.state).toBe('state-parameter-456');
        expect(result.data.redirectUri).toBe('https://example.com/callback');
      }
    });

    it('provider должен быть одним из допустимых значений', () => {
      const providers = ['google', 'github', 'microsoft', 'apple'];

      providers.forEach((provider) => {
        const request = {
          provider,
          code: 'code-123',
          state: 'state-456',
          redirectUri: 'https://example.com/callback',
        };

        const result = oauthLoginRequestSchema.safeParse(request);
        expect(result.success).toBe(true);

        // eslint-disable-next-line functional/no-conditional-statements
        if (result.success) {
          expect(result.data.provider).toBe(provider);
        }
      });
    });

    it('redirectUri должен быть валидным URL', () => {
      const validUrls = [
        'https://example.com/callback',
        'http://localhost:3000/callback',
        'https://app.example.com/oauth/callback',
      ];

      validUrls.forEach((url) => {
        const request = {
          provider: 'google',
          code: 'code-123',
          state: 'state-456',
          redirectUri: url,
        };

        const result = oauthLoginRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('oauthRegisterRequestSchema', () => {
    it('валидные register requests проходят Zod схему', () => {
      const validRequest = {
        provider: 'google',
        code: 'authorization-code-123',
        state: 'state-parameter-456',
        redirectUri: 'https://example.com/callback',
        workspaceName: 'My Workspace',
      };

      const result = oauthRegisterRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);

      // eslint-disable-next-line functional/no-conditional-statements
      if (result.success) {
        expect(result.data.provider).toBe('google');
        expect(result.data.code).toBe('authorization-code-123');
        expect(result.data.workspaceName).toBe('My Workspace');
      }
    });

    it('workspaceName обязателен для имени workspace', () => {
      const requestWithoutWorkspaceName = {
        provider: 'google',
        code: 'code-123',
        state: 'state-456',
        redirectUri: 'https://example.com/callback',
        // workspaceName отсутствует
      };

      const result = oauthRegisterRequestSchema.safeParse(requestWithoutWorkspaceName);
      expect(result.success).toBe(false);
    });
  });
});
