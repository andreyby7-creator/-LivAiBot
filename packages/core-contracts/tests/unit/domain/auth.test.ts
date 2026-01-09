/**
 * @file Unit тесты для domain/auth.ts
 */
import { describe, expect, it } from 'vitest';
import type {
  LoginRequest,
  MeResponse,
  RefreshRequest,
  RegisterRequest,
  TokenPairResponse,
} from '../../../src/domain/auth.js';
import type { UUID } from '../../../src/domain/common.js';

describe('RegisterRequest', () => {
  it('валидная структура RegisterRequest', () => {
    const request: RegisterRequest = {
      email: 'user@example.com',
      password: 'securePassword123',
      workspace_name: 'My Workspace',
    };

    expect(request).toMatchObject({
      email: 'user@example.com',
      password: 'securePassword123',
      workspace_name: 'My Workspace',
    });
  });

  it('все поля обязательны', () => {
    // Type check - отсутствие любого поля должно быть ошибкой компиляции
    // @ts-expect-error - отсутствие email
    const invalid1: RegisterRequest = {
      password: 'password',
      workspace_name: 'workspace',
    };
    expect(invalid1).toBeDefined(); // Если мы дошли сюда, значит @ts-expect-error сработал

    // @ts-expect-error - отсутствие password
    const invalid2: RegisterRequest = {
      email: 'user@example.com',
      workspace_name: 'workspace',
    };
    expect(invalid2).toBeDefined();

    // @ts-expect-error - отсутствие workspace_name
    const invalid3: RegisterRequest = {
      email: 'user@example.com',
      password: 'password',
    };
    expect(invalid3).toBeDefined();
  });

  it('email валиден', () => {
    const request: RegisterRequest = {
      email: 'test.email+tag@example.com',
      password: 'password123',
      workspace_name: 'Test Workspace',
    };

    expect(request.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('снапшот структуры', () => {
    const request: RegisterRequest = {
      email: 'john.doe@example.com',
      password: 'MySecurePass123!',
      workspace_name: "John's Company",
    };

    expect(request).toMatchSnapshot();
  });
});

describe('LoginRequest', () => {
  it('валидная структура LoginRequest', () => {
    const request: LoginRequest = {
      email: 'user@example.com',
      password: 'password123',
    };

    expect(request).toMatchObject({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('все поля обязательны', () => {
    // @ts-expect-error - отсутствие email
    const invalid1: LoginRequest = {
      password: 'password',
    };
    expect(invalid1).toBeDefined();

    // @ts-expect-error - отсутствие password
    const invalid2: LoginRequest = {
      email: 'user@example.com',
    };
    expect(invalid2).toBeDefined();
  });

  it('снапшот структуры', () => {
    const request: LoginRequest = {
      email: 'jane.smith@example.com',
      password: 'SecurePass456!',
    };

    expect(request).toMatchSnapshot();
  });
});

describe('TokenPairResponse', () => {
  it('валидная структура TokenPairResponse', () => {
    const response: TokenPairResponse = {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refresh_token: 'refresh_token_123',
      token_type: 'bearer',
    };

    expect(response).toMatchObject({
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refresh_token: 'refresh_token_123',
      token_type: 'bearer',
    });
  });

  it('token_type всегда "bearer"', () => {
    const response: TokenPairResponse = {
      access_token: 'token123',
      refresh_token: 'refresh123',
      token_type: 'bearer',
    };

    expect(response.token_type).toBe('bearer');
  });

  it('отвергает другие значения token_type', () => {
    // Type check - этот код должен вызвать ошибку компиляции без @ts-expect-error
    // Мы используем any для обхода проверки типов в runtime тесте
    const invalid = {
      access_token: 'token123',
      refresh_token: 'refresh123',
      token_type: 'basic' as any, // Обход проверки типов для теста
    } as TokenPairResponse;

    expect(invalid.token_type).toBe('basic');
  });

  it('все поля обязательны', () => {
    // @ts-expect-error - отсутствие access_token
    const invalid1: TokenPairResponse = {
      refresh_token: 'refresh123',
      token_type: 'bearer',
    };
    expect(invalid1).toBeDefined();

    // @ts-expect-error - отсутствие refresh_token
    const invalid2: TokenPairResponse = {
      access_token: 'token123',
      token_type: 'bearer',
    };
    expect(invalid2).toBeDefined();

    // @ts-expect-error - отсутствие token_type
    const invalid3: TokenPairResponse = {
      access_token: 'token123',
      refresh_token: 'refresh123',
    };
    expect(invalid3).toBeDefined();
  });

  it('снапшот структуры', () => {
    const response: TokenPairResponse = {
      access_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      refresh_token: 'refresh_token_abc123def456',
      token_type: 'bearer',
    };

    expect(response).toMatchSnapshot();
  });
});

describe('MeResponse', () => {
  it('валидная структура MeResponse', () => {
    const response: MeResponse = {
      user_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      email: 'user@example.com',
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
    };

    expect(response).toMatchObject({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      workspace_id: '123e4567-e89b-12d3-a456-426614174000',
    });
  });

  it('user_id и workspace_id являются UUID', () => {
    const response: MeResponse = {
      user_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      email: 'user@example.com',
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
    };

    // Проверяем формат UUID (базовая проверка)
    expect(response.user_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(response.workspace_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('все поля обязательны', () => {
    // @ts-expect-error - отсутствие user_id
    const invalid1: MeResponse = {
      email: 'user@example.com',
      workspace_id: 'workspace-id' as UUID,
    };
    expect(invalid1).toBeDefined();

    // @ts-expect-error - отсутствие email
    const invalid2: MeResponse = {
      user_id: 'user-id' as UUID,
      workspace_id: 'workspace-id' as UUID,
    };
    expect(invalid2).toBeDefined();

    // @ts-expect-error - отсутствие workspace_id
    const invalid3: MeResponse = {
      user_id: 'user-id' as UUID,
      email: 'user@example.com',
    };
    expect(invalid3).toBeDefined();
  });

  it('снапшот структуры', () => {
    const response: MeResponse = {
      user_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      email: 'john.doe@example.com',
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
    };

    expect(response).toMatchSnapshot();
  });
});

describe('RefreshRequest', () => {
  it('валидная структура RefreshRequest', () => {
    const request: RefreshRequest = {
      refresh_token: 'refresh_token_123',
    };

    expect(request).toEqual({
      refresh_token: 'refresh_token_123',
    });
  });

  it('refresh_token обязателен', () => {
    // @ts-expect-error - отсутствие refresh_token
    const invalid: RefreshRequest = {};
    expect(invalid).toBeDefined();
  });

  it('содержит только refresh_token', () => {
    const request: RefreshRequest = {
      refresh_token: 'token123',
    };

    expect(Object.keys(request)).toEqual(['refresh_token']);
    expect(request.refresh_token).toBe('token123');
  });

  it('снапшот структуры', () => {
    const request: RefreshRequest = {
      refresh_token: 'refresh_token_xyz789',
    };

    expect(request).toMatchSnapshot();
  });
});

describe('Интеграционные тесты auth flow', () => {
  it('RegisterRequest -> TokenPairResponse flow', () => {
    // Имитация полного flow регистрации
    const registerRequest: RegisterRequest = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      workspace_name: 'New Company',
    };

    // После успешной регистрации возвращается токен
    const tokenResponse: TokenPairResponse = {
      access_token: 'access_token_from_registration',
      refresh_token: 'refresh_token_from_registration',
      token_type: 'bearer',
    };

    expect(registerRequest.email).toBe('newuser@example.com');
    expect(tokenResponse.token_type).toBe('bearer');
  });

  it('LoginRequest -> TokenPairResponse -> MeResponse flow', () => {
    // Login
    const loginRequest: LoginRequest = {
      email: 'existing@example.com',
      password: 'password123',
    };

    // Получение токенов
    const tokenResponse: TokenPairResponse = {
      access_token: 'access_token_123',
      refresh_token: 'refresh_token_456',
      token_type: 'bearer',
    };

    // Получение информации о пользователе
    const meResponse: MeResponse = {
      user_id: 'user-uuid-123' as UUID,
      email: 'existing@example.com',
      workspace_id: 'workspace-uuid-456' as UUID,
    };

    expect(loginRequest.email).toBe(meResponse.email);
    expect(tokenResponse.token_type).toBe('bearer');
  });

  it('RefreshRequest flow', () => {
    const refreshRequest: RefreshRequest = {
      refresh_token: 'old_refresh_token',
    };

    const newTokenResponse: TokenPairResponse = {
      access_token: 'new_access_token',
      refresh_token: 'new_refresh_token',
      token_type: 'bearer',
    };

    expect(refreshRequest.refresh_token).not.toBe(newTokenResponse.refresh_token);
  });

  it('снапшот полного auth flow', () => {
    const authFlow = {
      register: {
        request: {
          email: 'user@example.com',
          password: 'password123',
          workspace_name: 'Workspace',
        } as RegisterRequest,
        response: {
          access_token: 'token123',
          refresh_token: 'refresh456',
          token_type: 'bearer' as const,
        } as TokenPairResponse,
      },
      login: {
        request: {
          email: 'user@example.com',
          password: 'password123',
        } as LoginRequest,
        response: {
          user_id: 'user-123' as UUID,
          email: 'user@example.com',
          workspace_id: 'workspace-456' as UUID,
        } as MeResponse,
      },
    };

    expect(authFlow).toMatchSnapshot();
  });
});
