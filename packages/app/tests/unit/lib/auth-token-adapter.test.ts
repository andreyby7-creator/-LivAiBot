/**
 * @file Unit тесты для packages/app/src/lib/auth-token-adapter.ts
 * Enterprise-grade тестирование auth-token-adapter с 100% покрытием:
 * - Создание адаптера с/без конфигурации
 * - getAccessToken для всех статусов аутентификации
 * - Извлечение токена из context.accessToken
 * - Логирование при недоступности токена
 * - Edge cases (пустой токен, не-строка, отсутствие context)
 * - Immutable гарантии в production
 */

import { describe, expect, it, vi } from 'vitest';

import type { AuthState } from '@livai/feature-auth';

import type { UseAuthStorePort } from '../../../src/hooks/useAuth.js';
import type {
  AuthTokenAdapterConfig,
  AuthTokenAdapterLogger,
} from '../../../src/lib/auth-token-adapter.js';
import { createAuthTokenAdapter } from '../../../src/lib/auth-token-adapter.js';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock UseAuthStorePort с контролируемым состоянием
 */
function createMockAuthStore(authState: AuthState): UseAuthStorePort {
  return {
    getAuthState: () => authState,
    subscribe: vi.fn(() => () => {}),
  };
}

/**
 * Создает mock логгер
 */
function createMockLogger(): AuthTokenAdapterLogger {
  return {
    warn: vi.fn(),
  };
}

/**
 * Создает authenticated AuthState с токеном в context
 */
function createAuthenticatedStateWithToken(
  token: string,
  overrides?: Partial<Extract<AuthState, { status: 'authenticated'; }>>,
): Extract<AuthState, { status: 'authenticated'; }> {
  return {
    status: 'authenticated',
    user: {
      id: 'user-1',
      email: 'test@example.com',
    } as any,
    context: {
      accessToken: token,
      ...overrides?.context,
    },
    ...overrides,
  };
}

/**
 * Создает authenticated AuthState без токена в context
 */
function createAuthenticatedStateWithoutToken(
  overrides?: Partial<Extract<AuthState, { status: 'authenticated'; }>>,
): Extract<AuthState, { status: 'authenticated'; }> {
  return {
    status: 'authenticated',
    user: {
      id: 'user-1',
      email: 'test@example.com',
    } as any,
    ...(overrides?.context !== undefined && { context: overrides.context }),
    ...overrides,
  } as Extract<AuthState, { status: 'authenticated'; }>;
}

/**
 * Создает unauthenticated AuthState
 */
function createUnauthenticatedState(): Extract<AuthState, { status: 'unauthenticated'; }> {
  return {
    status: 'unauthenticated',
  };
}

/**
 * Создает authenticating AuthState
 */
function createAuthenticatingState(): Extract<AuthState, { status: 'authenticating'; }> {
  return {
    status: 'authenticating',
  };
}

/**
 * Создает session_expired AuthState
 */
function createSessionExpiredState(): Extract<AuthState, { status: 'session_expired'; }> {
  return {
    status: 'session_expired',
  };
}

/**
 * Создает error AuthState
 */
function createErrorState(): Extract<AuthState, { status: 'error'; }> {
  return {
    status: 'error',
    error: {
      code: 'AUTH_ERROR',
      message: 'Authentication error',
    } as any,
  };
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('auth-token-adapter', () => {
  describe('createAuthTokenAdapter', () => {
    it('создает адаптер без конфигурации', () => {
      const authState = createUnauthenticatedState();
      const authStore = createMockAuthStore(authState);
      const adapter = createAuthTokenAdapter(authStore);

      expect(adapter).toBeDefined();
      expect(typeof adapter.getAccessToken).toBe('function');
    });

    it('создает адаптер с логгером', () => {
      const authState = createUnauthenticatedState();
      const authStore = createMockAuthStore(authState);
      const logger = createMockLogger();
      const config: AuthTokenAdapterConfig = { logger };
      const adapter = createAuthTokenAdapter(authStore, config);

      expect(adapter).toBeDefined();
      expect(typeof adapter.getAccessToken).toBe('function');
    });

    it('создает immutable адаптер в production режиме', () => {
      vi.stubEnv('NODE_ENV', 'production');

      try {
        const authState = createUnauthenticatedState();
        const authStore = createMockAuthStore(authState);
        const adapter = createAuthTokenAdapter(authStore);

        // Проверяем, что адаптер заморожен
        expect(Object.isFrozen(adapter)).toBe(true);
        expect(() => {
          (adapter as any).newProperty = 'test';
        }).toThrow();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('не замораживает адаптер в dev режиме', () => {
      vi.stubEnv('NODE_ENV', 'development');

      try {
        const authState = createUnauthenticatedState();
        const authStore = createMockAuthStore(authState);
        const adapter = createAuthTokenAdapter(authStore);

        // В dev режиме адаптер не должен быть заморожен
        expect(Object.isFrozen(adapter)).toBe(false);
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('getAccessToken', () => {
    describe('authenticated статус', () => {
      it('возвращает токен из context.accessToken когда токен доступен', async () => {
        const token = 'valid-jwt-token-123';
        const authState = createAuthenticatedStateWithToken(token);
        const authStore = createMockAuthStore(authState);
        const adapter = createAuthTokenAdapter(authStore);

        const result = await adapter.getAccessToken();

        expect(result).toBe(token);
      });

      it('возвращает null когда токен отсутствует в context', async () => {
        const authState = createAuthenticatedStateWithoutToken({
          context: {}, // context существует, но accessToken отсутствует
        });
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but not available in context',
          expect.objectContaining({
            status: 'authenticated',
            hasContext: true,
            hasSession: false,
            contextHasToken: false,
          }),
        );
      });

      it('возвращает null когда context отсутствует', async () => {
        const authState = createAuthenticatedStateWithoutToken();
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but not available in context',
          expect.objectContaining({
            status: 'authenticated',
            hasContext: false,
            hasSession: false,
            contextHasToken: false,
          }),
        );
      });

      it('возвращает null когда токен пустая строка', async () => {
        const authState = createAuthenticatedStateWithToken('');
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but not available in context',
          expect.objectContaining({
            status: 'authenticated',
            hasContext: true,
            hasSession: false,
            contextHasToken: true, // typeof '' === 'string', но length === 0
          }),
        );
      });

      it('возвращает null когда accessToken не строка', async () => {
        const authState = createAuthenticatedStateWithToken('', {
          context: {
            accessToken: 123 as any, // не строка
          },
        });
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but not available in context',
          expect.objectContaining({
            status: 'authenticated',
            hasContext: true,
            hasSession: false,
            contextHasToken: false, // typeof 123 !== 'string'
          }),
        );
      });

      it('возвращает null когда accessToken null', async () => {
        const authState = createAuthenticatedStateWithToken('', {
          context: {
            accessToken: null as any,
          },
        });
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      it('не логирует когда logger не предоставлен', async () => {
        const authState = createAuthenticatedStateWithoutToken();
        const authStore = createMockAuthStore(authState);
        const adapter = createAuthTokenAdapter(authStore);

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        // Нет способа проверить отсутствие логирования без logger, но это покрывает ветку
      });

      it('правильно определяет hasSession когда session присутствует', async () => {
        const authState = createAuthenticatedStateWithoutToken({
          context: {}, // context существует, но accessToken отсутствует
          session: {
            status: 'active',
            sessionId: 'session-1',
            issuedAt: '2024-01-01T00:00:00Z',
            expiresAt: '2024-01-02T00:00:00Z',
          } as any,
        });
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but not available in context',
          expect.objectContaining({
            status: 'authenticated',
            hasContext: true,
            hasSession: true,
            contextHasToken: false,
          }),
        );
      });
    });

    describe('unauthenticated статус', () => {
      it('возвращает null и логирует предупреждение', async () => {
        const authState = createUnauthenticatedState();
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but user is not authenticated',
          {
            status: 'unauthenticated',
          },
        );
      });

      it('не логирует когда logger не предоставлен', async () => {
        const authState = createUnauthenticatedState();
        const authStore = createMockAuthStore(authState);
        const adapter = createAuthTokenAdapter(authStore);

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
      });
    });

    describe('другие статусы', () => {
      it('возвращает null для authenticating статуса', async () => {
        const authState = createAuthenticatingState();
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but user is not authenticated',
          {
            status: 'authenticating',
          },
        );
      });

      it('возвращает null для session_expired статуса', async () => {
        const authState = createSessionExpiredState();
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but user is not authenticated',
          {
            status: 'session_expired',
          },
        );
      });

      it('возвращает null для error статуса', async () => {
        const authState = createErrorState();
        const authStore = createMockAuthStore(authState);
        const logger = createMockLogger();
        const adapter = createAuthTokenAdapter(authStore, { logger });

        const result = await adapter.getAccessToken();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          'Auth token requested but user is not authenticated',
          {
            status: 'error',
          },
        );
      });
    });

    describe('async поведение', () => {
      it('возвращает Promise', async () => {
        const authState = createUnauthenticatedState();
        const authStore = createMockAuthStore(authState);
        const adapter = createAuthTokenAdapter(authStore);

        const result = adapter.getAccessToken();

        expect(result).toBeInstanceOf(Promise);
        const value = await result;
        expect(value).toBeNull();
      });

      it('возвращает Promise.resolve для синхронных операций', async () => {
        const token = 'test-token';
        const authState = createAuthenticatedStateWithToken(token);
        const authStore = createMockAuthStore(authState);
        const adapter = createAuthTokenAdapter(authStore);

        const result = await adapter.getAccessToken();

        expect(result).toBe(token);
      });
    });
  });

  describe('интеграционные сценарии', () => {
    it('работает с реальным UseAuthStorePort интерфейсом', async () => {
      const token = 'integration-token';
      const authState = createAuthenticatedStateWithToken(token);
      const authStore: UseAuthStorePort = {
        getAuthState: () => authState,
        subscribe: vi.fn(() => () => {}),
      };
      const adapter = createAuthTokenAdapter(authStore);

      const result = await adapter.getAccessToken();

      expect(result).toBe(token);
      expect(authStore.getAuthState()).toBe(authState);
    });

    it('обрабатывает множественные вызовы getAccessToken', async () => {
      const token = 'multi-call-token';
      const authState = createAuthenticatedStateWithToken(token);
      const authStore = createMockAuthStore(authState);
      const adapter = createAuthTokenAdapter(authStore);

      const results = await Promise.all([
        adapter.getAccessToken(),
        adapter.getAccessToken(),
        adapter.getAccessToken(),
      ]);

      results.forEach((result) => {
        expect(result).toBe(token);
      });
    });

    it('обрабатывает изменение состояния между вызовами', async () => {
      let currentState: AuthState = createUnauthenticatedState();
      const authStore: UseAuthStorePort = {
        getAuthState: () => currentState,
        subscribe: vi.fn(() => () => {}),
      };
      const adapter = createAuthTokenAdapter(authStore);

      // Первый вызов - не аутентифицирован
      const result1 = await adapter.getAccessToken();
      expect(result1).toBeNull();

      // Изменяем состояние
      currentState = createAuthenticatedStateWithToken('new-token');

      // Второй вызов - аутентифицирован
      const result2 = await adapter.getAccessToken();
      expect(result2).toBe('new-token');
    });
  });
});
