/**
 * @file Unit тесты для packages/app/src/lib/auth-hook-deps.ts
 * Тестирование DI-фабрики auth-хука с 100% покрытием:
 * - Создание auth-store порта
 * - Подписка на изменения auth-среза
 * - Создание эффектов (login/logout/register/refresh)
 * - Адаптация Effect → Promise
 * - Кэширование deps
 * - Конфигурация с/без store config
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';
import type {
  LoginIdentifierType,
  LoginRequest,
} from '@livai/feature-auth/src/domain/LoginRequest.js';
import type {
  RegisterIdentifierType,
  RegisterRequest,
} from '@livai/feature-auth/src/domain/RegisterRequest.js';
import type { LoginResult } from '@livai/feature-auth/src/effects/login.js';
import type { LogoutResult } from '@livai/feature-auth/src/effects/logout.js';
import type { RefreshEffectResult } from '@livai/feature-auth/src/effects/refresh.js';
import type { RegisterResult } from '@livai/feature-auth/src/effects/register.js';
import type { AuthStoreState } from '@livai/feature-auth/src/stores/index.js';
import type { AuthHookDepsConfig } from '../../../src/lib/auth-hook-deps.js';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает mock Zustand store с контролируемым поведением
 */
function createMockZustandStore() {
  let state: AuthStoreState = {
    version: 1,
    auth: {
      status: 'unauthenticated',
    },
    mfa: {
      status: 'not_setup',
    },
    oauth: {
      status: 'idle',
    },
    security: {
      status: 'secure',
    },
    session: null,
    passwordRecovery: {
      status: 'idle',
    },
    verification: {
      status: 'idle',
    },
  };

  const listeners = new Set<(state: AuthStoreState) => void>();

  return {
    getState: () => state,
    setState: (next: Partial<AuthStoreState> | ((prev: AuthStoreState) => AuthStoreState)) => {
      if (typeof next === 'function') {
        state = next(state);
      } else {
        state = { ...state, ...next };
      }
      listeners.forEach((listener) => listener(state));
    },
    subscribe: (listener: (state: AuthStoreState) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Создает mock Effect для login
 */
function createMockLoginEffect(): Effect.Effect<LoginResult, never> {
  return Effect.succeed({ kind: 'login', success: true } as unknown as LoginResult);
}

/**
 * Создает mock Effect для logout
 */
function createMockLogoutEffect(): Effect.Effect<LogoutResult, never> {
  return Effect.succeed({ kind: 'logout', success: true } as unknown as LogoutResult);
}

/**
 * Создает mock Effect для register
 */
function createMockRegisterEffect(): Effect.Effect<RegisterResult, never> {
  return Effect.succeed({ kind: 'register', success: true } as unknown as RegisterResult);
}

/**
 * Создает mock Effect для refresh
 */
function createMockRefreshEffect(): Effect.Effect<RefreshEffectResult, never> {
  return Effect.succeed({ kind: 'refresh', success: true } as unknown as RefreshEffectResult);
}

/**
 * Создает базовую конфигурацию для тестов
 */
function createMockConfig(
  overrides: Partial<AuthHookDepsConfig> = {},
): AuthHookDepsConfig {
  return {
    login: {
      config: {} as any,
      deps: {} as any,
    },
    logout: {
      config: {} as any,
      deps: {} as any,
    },
    register: {
      config: {} as any,
      deps: {} as any,
    },
    refresh: {
      config: {} as any,
      deps: {} as any,
    },
    ...overrides,
  };
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

// Мокаем feature-auth модули (hoisted)
// createLoginEffect возвращает функцию (request) => Effect
const mockCreateLoginEffectFn = vi.fn((_deps?: any, _config?: any) => (_request: any) =>
  createMockLoginEffect()
);
const mockCreateLogoutEffectFn = vi.fn((_deps?: any, _config?: any) => () =>
  createMockLogoutEffect()
);
const mockCreateRegisterEffectFn = vi.fn((_deps?: any, _config?: any) => (_request: any) =>
  createMockRegisterEffect()
);
const mockCreateRefreshEffectFn = vi.fn((_deps?: any, _config?: any) => () =>
  createMockRefreshEffect()
);
const mockCreateAuthStoreFn = vi.fn((_config?: any) => createMockZustandStore());

vi.mock('@livai/feature-auth/src/effects/login.js', () => ({
  createLoginEffect: (deps: any, config: any) => mockCreateLoginEffectFn(deps, config),
}));

vi.mock('@livai/feature-auth/src/effects/logout.js', () => ({
  createLogoutEffect: (deps: any, config: any) => mockCreateLogoutEffectFn(deps, config),
}));

vi.mock('@livai/feature-auth/src/effects/register.js', () => ({
  createRegisterEffect: (deps: any, config: any) => mockCreateRegisterEffectFn(deps, config),
}));

vi.mock('@livai/feature-auth/src/effects/refresh.js', () => ({
  createRefreshEffect: (deps: any, config: any) => mockCreateRefreshEffectFn(deps, config),
}));

vi.mock('@livai/feature-auth/src/stores/index.js', () => ({
  createAuthStore: (config?: any) => mockCreateAuthStoreFn(config),
}));

describe('auth-hook-deps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Сбрасываем модуль для очистки кэша перед каждым тестом
    vi.resetModules();
    // Переимпортируем моки после resetModules
    mockCreateLoginEffectFn.mockImplementation(() => (_request: any) => createMockLoginEffect());
    mockCreateLogoutEffectFn.mockImplementation(() => () => createMockLogoutEffect());
    mockCreateRegisterEffectFn.mockImplementation(() => (_request: any) =>
      createMockRegisterEffect()
    );
    mockCreateRefreshEffectFn.mockImplementation(() => () => createMockRefreshEffect());
    mockCreateAuthStoreFn.mockImplementation(() => createMockZustandStore());
  });

  describe('createAuthHookDeps', () => {
    it('кэширует deps после первого создания', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      // Первый вызов создает и кэширует
      const deps1 = createAuthHookDeps(config);
      expect(deps1).toBeDefined();

      // Второй вызов должен выбросить ошибку
      expect(() => createAuthHookDeps(config)).toThrow('AuthHookDeps already initialized');
    });

    it('создает UseAuthDeps с корректной структурой', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      expect(deps).toHaveProperty('authStore');
      expect(deps).toHaveProperty('loginEffect');
      expect(deps).toHaveProperty('logoutEffect');
      expect(deps).toHaveProperty('registerEffect');
      expect(deps).toHaveProperty('refreshEffect');

      expect(typeof deps.authStore.getAuthState).toBe('function');
      expect(typeof deps.authStore.subscribe).toBe('function');
      expect(typeof deps.loginEffect).toBe('function');
      expect(typeof deps.logoutEffect).toBe('function');
      expect(typeof deps.registerEffect).toBe('function');
      expect(typeof deps.refreshEffect).toBe('function');
    });

    it('создает auth-store с переданной конфигурацией', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const storeConfig = { version: 1 } as any;
      const config = createMockConfig({
        store: { config: storeConfig },
      });

      createAuthHookDeps(config);

      expect(mockCreateAuthStoreFn).toHaveBeenCalledWith(storeConfig);
    });

    it('создает auth-store без конфигурации (undefined)', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();

      createAuthHookDeps(config);

      expect(mockCreateAuthStoreFn).toHaveBeenCalledWith(undefined);
    });

    it('создает эффекты с переданными deps и config', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const loginDeps = { api: 'mock' } as any;
      const loginConfig = { timeout: 5000 } as any;
      const logoutDeps = { api: 'mock' } as any;
      const logoutConfig = { timeout: 3000 } as any;
      const registerDeps = { api: 'mock' } as any;
      const registerConfig = { timeout: 6000 } as any;
      const refreshDeps = { api: 'mock' } as any;
      const refreshConfig = { timeout: 4000 } as any;

      const config = createMockConfig({
        login: { deps: loginDeps, config: loginConfig },
        logout: { deps: logoutDeps, config: logoutConfig },
        register: { deps: registerDeps, config: registerConfig },
        refresh: { deps: refreshDeps, config: refreshConfig },
      });

      createAuthHookDeps(config);

      expect(mockCreateLoginEffectFn).toHaveBeenCalledWith(loginDeps, loginConfig);
      expect(mockCreateLogoutEffectFn).toHaveBeenCalledWith(logoutDeps, logoutConfig);
      expect(mockCreateRegisterEffectFn).toHaveBeenCalledWith(registerDeps, registerConfig);
      expect(mockCreateRefreshEffectFn).toHaveBeenCalledWith(refreshDeps, refreshConfig);
    });

    it('адаптирует login Effect в Promise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const loginRequest: LoginRequest<LoginIdentifierType> = {
        identifier: 'test@example.com',
      } as any;

      const result = await deps.loginEffect(loginRequest);

      expect(result).toEqual({ kind: 'login', success: true });
    });

    it('адаптирует logout Effect в Promise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const result = await deps.logoutEffect();

      expect(result).toEqual({ kind: 'logout', success: true });
    });

    it('адаптирует register Effect в Promise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const registerRequest: RegisterRequest<RegisterIdentifierType> = {
        identifier: 'new@example.com',
      } as any;

      const result = await deps.registerEffect(registerRequest);

      expect(result).toEqual({ kind: 'register', success: true });
    });

    it('адаптирует refresh Effect в Promise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const result = await deps.refreshEffect();

      expect(result).toEqual({ kind: 'refresh', success: true });
    });

    it('кэширует deps после первого создания', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      // Первый вызов создает и кэширует
      const deps1 = createAuthHookDeps(config);
      expect(deps1).toBeDefined();

      // Второй вызов должен выбросить ошибку
      expect(() => createAuthHookDeps(config)).toThrow('AuthHookDeps already initialized');
    });

    it('пробрасывает ошибки из Effect в Promise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const errorEffect = Effect.fail(new Error('Login failed'));
      mockCreateLoginEffectFn.mockReturnValueOnce(() => errorEffect as any);

      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const loginRequest: LoginRequest<LoginIdentifierType> = {
        identifier: 'test@example.com',
      } as any;

      await expect(deps.loginEffect(loginRequest)).rejects.toThrow();
    });
  });

  describe('createAuthStorePort (через createAuthHookDeps)', () => {
    it('getAuthState возвращает текущее auth-состояние', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const authState = deps.authStore.getAuthState();

      expect(authState).toEqual({
        status: 'unauthenticated',
      });
    });

    it('subscribe вызывает listener при изменении auth-среза', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);
      const listener = vi.fn();

      const unsubscribe = deps.authStore.subscribe(listener);

      // Изменяем auth-срез через mock store
      const store = mockCreateAuthStoreFn.mock.results[0]?.value;
      if (store === undefined || store === null) throw new Error('Store not created');
      store.setState({
        auth: {
          status: 'authenticated',
          user: { id: 'user-123' } as any,
        },
      });

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('subscribe не вызывает listener при изменении других срезов', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);
      const listener = vi.fn();

      const unsubscribe = deps.authStore.subscribe(listener);

      // Изменяем другой срез (не auth)
      const store = mockCreateAuthStoreFn.mock.results[0]?.value;
      if (store === undefined || store === null) throw new Error('Store not created');
      const currentState = store.getState();
      store.setState({
        ...currentState,
        mfa: {
          status: 'setup_complete',
          enabledMethods: [],
        },
      });

      // Listener не должен быть вызван, так как auth-срез не изменился
      expect(listener).not.toHaveBeenCalled();

      unsubscribe();
    });

    it('subscribe вызывает listener только при изменении ссылки на auth-объект', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);
      const listener = vi.fn();

      const unsubscribe = deps.authStore.subscribe(listener);

      // Изменяем auth-срез с новой ссылкой
      const store = mockCreateAuthStoreFn.mock.results[0]?.value;
      if (store === undefined || store === null) throw new Error('Store not created');
      const currentState = store.getState();
      // Создаем новый объект с той же структурой, но новой ссылкой
      store.setState({
        ...currentState,
        auth: {
          status: 'authenticated',
          user: { id: 'user-123' } as any,
        },
      });

      // Listener должен быть вызван, так как auth-объект имеет новую ссылку
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('unsubscribe останавливает подписку', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);
      const listener = vi.fn();

      const unsubscribe = deps.authStore.subscribe(listener);
      unsubscribe();

      // Изменяем auth-срез после отписки
      const store = mockCreateAuthStoreFn.mock.results[0]?.value;
      if (store === undefined || store === null) throw new Error('Store not created');
      store.setState({
        auth: {
          status: 'authenticated',
          user: { id: 'user-123' } as any,
        },
      });

      // Listener не должен быть вызван после отписки
      expect(listener).not.toHaveBeenCalled();
    });

    it('subscribe обрабатывает множественные изменения', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);
      const listener = vi.fn();

      const unsubscribe = deps.authStore.subscribe(listener);

      const store = mockCreateAuthStoreFn.mock.results[0]?.value;
      if (store === undefined || store === null) throw new Error('Store not created');

      // Первое изменение
      store.setState({
        auth: {
          status: 'authenticated',
          user: { id: 'user-123' } as any,
        },
      });

      // Второе изменение
      store.setState({
        auth: {
          status: 'unauthenticated',
        },
      });

      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it('subscribe сохраняет предыдущее значение auth для сравнения', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();
      const deps = createAuthHookDeps(config);
      const listener = vi.fn();

      const unsubscribe = deps.authStore.subscribe(listener);

      const store = mockCreateAuthStoreFn.mock.results[0]?.value;
      if (store === undefined || store === null) throw new Error('Store not created');

      // Первое изменение
      store.setState({
        auth: {
          status: 'authenticated',
          user: { id: 'user-123' } as any,
        },
      });

      // Второе изменение с тем же значением (но новой ссылкой)
      store.setState({
        auth: {
          status: 'authenticated',
          user: { id: 'user-123' } as any,
        },
      });

      // Оба изменения должны вызвать listener, так как ссылки разные
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
    });
  });

  describe('Effect → Promise адаптация', () => {
    it('loginEffect использует Runtime.runPromise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const mockEffect = Effect.succeed({ kind: 'login', success: true } as unknown as LoginResult);
      mockCreateLoginEffectFn.mockReturnValueOnce(() => mockEffect);

      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const loginRequest: LoginRequest<LoginIdentifierType> = {
        identifier: 'test@example.com',
      } as any;

      const result = await deps.loginEffect(loginRequest);

      expect(result).toEqual({ kind: 'login', success: true });
    });

    it('logoutEffect использует Runtime.runPromise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const mockEffect = Effect.succeed(
        { kind: 'logout', success: true } as unknown as LogoutResult,
      );
      mockCreateLogoutEffectFn.mockReturnValueOnce(() => mockEffect);

      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const result = await deps.logoutEffect();

      expect(result).toEqual({ kind: 'logout', success: true });
    });

    it('registerEffect использует Runtime.runPromise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const mockEffect = Effect.succeed(
        { kind: 'register', success: true } as unknown as RegisterResult,
      );
      mockCreateRegisterEffectFn.mockReturnValueOnce(() => mockEffect);

      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const registerRequest: RegisterRequest<RegisterIdentifierType> = {
        identifier: 'new@example.com',
      } as any;

      const result = await deps.registerEffect(registerRequest);

      expect(result).toEqual({ kind: 'register', success: true });
    });

    it('refreshEffect использует Runtime.runPromise', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const mockEffect = Effect.succeed({
        kind: 'refresh',
        success: true,
      } as unknown as RefreshEffectResult);
      mockCreateRefreshEffectFn.mockReturnValueOnce(() => mockEffect);

      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const result = await deps.refreshEffect();

      expect(result).toEqual({ kind: 'refresh', success: true });
    });

    it('обрабатывает ошибки из Effect', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const errorEffect = Effect.fail(new Error('Network error')) as any;
      mockCreateLoginEffectFn.mockReturnValueOnce(() => errorEffect);

      const config = createMockConfig();
      const deps = createAuthHookDeps(config);

      const loginRequest: LoginRequest<LoginIdentifierType> = {
        identifier: 'test@example.com',
      } as any;

      await expect(deps.loginEffect(loginRequest)).rejects.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('работает без конфигурации store', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config = createMockConfig();

      const deps = createAuthHookDeps(config);

      expect(deps).toBeDefined();
      expect(deps.authStore).toBeDefined();
    });

    it('работает с минимальной конфигурацией', async () => {
      const { createAuthHookDeps } = await import('../../../src/lib/auth-hook-deps.js');
      const config: AuthHookDepsConfig = {
        login: {
          config: {} as any,
          deps: {} as any,
        },
        logout: {
          config: {} as any,
          deps: {} as any,
        },
        register: {
          config: {} as any,
          deps: {} as any,
        },
        refresh: {
          config: {} as any,
          deps: {} as any,
        },
      };

      const deps = createAuthHookDeps(config);

      expect(deps).toBeDefined();
    });
  });
});
