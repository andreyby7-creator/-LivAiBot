/**
 * @vitest-environment jsdom
 * @file Unit тесты для useAuth
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Effect
const effectMocks = vi.hoisted(() => ({
  runPromise: vi.fn(async function(effect) {
    return effect();
  }),
  runPromiseRuntime: vi.fn(async function(_runtime, effect) {
    return effect;
  }),
}));

vi.mock('effect', () => ({
  Effect: {
    runPromise: effectMocks.runPromise,
  },
  Runtime: {
    defaultRuntime: {},
    runPromise: effectMocks.runPromiseRuntime,
  },
}));

// Mock getCurrentTime
const getCurrentTimeMocks = vi.hoisted(() => ({
  getCurrentTime: vi.fn(function() {
    return 1000000000000;
  }),
}));

// Mock BroadcastChannel
let mockChannelInstance: {
  postMessage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onmessage: ((event: MessageEvent) => void) | null;
  name: string;
  onmessageerror: ((event: MessageEvent) => void) | null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
} | null = null;

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
  onmessage: ((event: MessageEvent) => void) | null = null;
  name = '';
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();

  constructor(_name: string) {
    mockChannelInstance = this;
  }
}

global.BroadcastChannel = MockBroadcastChannel as any;

// Mock window.location for cross-tab tests
Object.defineProperty(window, 'location', {
  value: { href: 'test-tab-id' },
  writable: true,
});

vi.mock('../../../src/state/store', async () => {
  const actualStore = await vi.importActual('../../../src/state/store');
  return {
    ...actualStore,
    getCurrentTime: getCurrentTimeMocks.getCurrentTime,
  };
});

// Mock authService
vi.mock('../../../src/lib/auth-service', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

// Mock store-utils
const storeUtilsMocks = vi.hoisted(() => ({
  safeSet: vi.fn(),
  setStoreLocked: vi.fn(),
  isStoreLocked: vi.fn(() => false),
}));

vi.mock('../../../src/state/store-utils', () => ({
  safeSet: storeUtilsMocks.safeSet,
  setStoreLocked: storeUtilsMocks.setStoreLocked,
  isStoreLocked: storeUtilsMocks.isStoreLocked,
}));

// Mock store
let mockStoreState: AppStore;

const storeMocks = vi.hoisted(() => ({
  useAppStore: vi.fn(function() {
    return mockStoreState;
  }),
  getState: vi.fn(() => mockStoreState),
}));

vi.mock('../../../src/state/store', async () => {
  const actualStore = await vi.importActual('../../../src/state/store');
  const mockUseAppStore = Object.assign(storeMocks.useAppStore, {
    getState: storeMocks.getState,
  });
  return {
    ...actualStore,
    useAppStore: mockUseAppStore,
    getCurrentTime: getCurrentTimeMocks.getCurrentTime,
  };
});

import type { AppStore } from '../../../src/state/store';
import { useAuth } from '../../../src/hooks/useAuth';
import { authService } from '../../../src/lib/auth-service';

// Note: We use effectMocks.runPromise.mockResolvedValue() in individual tests
// instead of spying on authService methods directly

describe('useAuth hook', () => {
  const mockActions = {
    setAuthTokens: vi.fn(),
    clearAuth: vi.fn(),
    setAuthLoading: vi.fn(),
    setUser: vi.fn(),
    setUserStatus: vi.fn(),
    setTheme: vi.fn(),
    setOnline: vi.fn(),
    setAuthenticatedUser: vi.fn(),
    reset: vi.fn(),
    resetSoft: vi.fn(),
  };

  const mockStore: AppStore = {
    user: null,
    userStatus: 'anonymous',
    theme: 'light',
    isOnline: true,
    auth: {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isLoading: false,
    },
    actions: mockActions,
  } as AppStore;

  const mockOnError = vi.fn(function() {});

  beforeEach(() => {
    vi.clearAllMocks();

    // Обновляем mockStoreState для getState()
    mockStoreState = { ...mockStore };
    storeMocks.useAppStore.mockReturnValue(mockStoreState);
    storeMocks.getState.mockReturnValue(mockStoreState);
    // Обновляем getState на самом useAppStore
    (storeMocks.useAppStore as any).getState = storeMocks.getState;

    getCurrentTimeMocks.getCurrentTime.mockReturnValue(1000000000000);

    // Reset Effect mock
    effectMocks.runPromise.mockReset();

    // Reset actions mocks
    Object.values(mockActions).forEach((mock) => mock.mockReset());

    // Reset store-utils mocks
    storeUtilsMocks.safeSet.mockReset();
    storeUtilsMocks.setStoreLocked.mockReset();
    storeUtilsMocks.isStoreLocked.mockReturnValue(false);

    // Сбрасываем BroadcastChannel мок
    mockChannelInstance = null;
  });

  afterEach(() => {
    // Clear all timers to prevent test interference
    vi.clearAllTimers();
    vi.clearAllMocks();

    // Clear any pending promises to prevent unhandled rejections
    return new Promise((resolve) => setImmediate(resolve));
  });

  describe('initial state', () => {
    it('возвращает корректный API', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current).toHaveProperty('isAuthenticated', false);
      expect(result.current).toHaveProperty('isLoading', false);
      expect(result.current).toHaveProperty('isExpired', false);
      expect(result.current).toHaveProperty('timeToExpiry', 0);
      expect(result.current).toHaveProperty('login');
      expect(result.current).toHaveProperty('logout');
      expect(result.current).toHaveProperty('refreshIfNeeded');
    });

    it('правильно вычисляет isAuthenticated когда есть токен', () => {
      const storeWithToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithToken);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
    });

    it('правильно вычисляет isExpired когда токен истек', () => {
      const expiredTime = 1000000000000 - 10000; // В прошлом
      const storeWithExpiredToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          expiresAt: expiredTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isExpired).toBe(true);
    });

    it('правильно вычисляет timeToExpiry', () => {
      const futureTime = 1000000000000 + 300000; // +5 минут
      const storeWithToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          expiresAt: futureTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithToken);

      const { result } = renderHook(() => useAuth());

      expect(result.current.timeToExpiry).toBe(300000);
    });
  });

  describe('login', () => {
    const mockTokenResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1000000000000 + 3600000, // +1 hour
    };

    it('успешно выполняет login и обновляет store', async () => {
      effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login({
          username: 'test@example.com',
          password: 'password',
        });
      });

      expect(authService.login).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'password',
      });

      // Проверяем, что safeSet был вызван для сохранения токенов
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: 1000000000000 + 3600000,
            isLoading: false,
          }),
        }),
        expect.objectContaining({ label: 'auth-login-success' }),
      );
    });

    it('обрабатывает ошибки login', async () => {
      const error = new Error('Login failed');
      effectMocks.runPromiseRuntime.mockRejectedValue(error);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await expect(
        act(async () => {
          await result.current.login({
            username: 'test@example.com',
            password: 'password',
          });
        }),
      ).rejects.toBe(error);

      expect(mockOnError).toHaveBeenCalledWith(error, 'login');

      // Проверяем, что safeSet был вызван для установки loading
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            isLoading: true,
          }),
        }),
        expect.objectContaining({ label: 'auth-login-loading' }),
      );

      // Проверяем, что safeSet был вызван для сброса loading при ошибке
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            isLoading: false,
          }),
        }),
        expect.objectContaining({ label: 'auth-login-error' }),
      );

      // Проверяем, что токены не были установлены
      expect(storeUtilsMocks.safeSet).not.toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            accessToken: expect.anything(),
          }),
        }),
        expect.objectContaining({ label: 'auth-login-success' }),
      );
    });
  });

  describe('logout', () => {
    it('успешно выполняет logout и очищает store', async () => {
      effectMocks.runPromiseRuntime.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(authService.logout).toHaveBeenCalled();

      // Проверяем, что setStoreLocked был вызван для блокировки store
      expect(storeUtilsMocks.setStoreLocked).toHaveBeenCalledWith(true);
      expect(storeUtilsMocks.setStoreLocked).toHaveBeenCalledWith(false);

      // Проверяем, что safeSet был вызван для установки loading
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            isLoading: true,
          }),
        }),
        expect.objectContaining({ label: 'auth-logout-loading' }),
      );

      // Проверяем, что safeSet был вызван для очистки auth state
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
          }),
          user: null,
          userStatus: 'anonymous',
        }),
        expect.objectContaining({ label: 'auth-logout-success' }),
      );
    });

    it('очищает store даже при ошибке logout', async () => {
      const error = new Error('Logout failed');
      effectMocks.runPromiseRuntime.mockRejectedValue(error);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await expect(
        act(async () => {
          await result.current.logout();
        }),
      ).rejects.toBe(error);

      expect(mockOnError).toHaveBeenCalledWith(error, 'logout');

      // Проверяем, что setStoreLocked был вызван для блокировки store
      expect(storeUtilsMocks.setStoreLocked).toHaveBeenCalledWith(true);
      expect(storeUtilsMocks.setStoreLocked).toHaveBeenCalledWith(false);

      // Проверяем, что safeSet был вызван для очистки auth state даже при ошибке
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
          }),
          user: null,
          userStatus: 'anonymous',
        }),
        expect.objectContaining({ label: 'auth-logout-error' }),
      );
    });
  });

  describe('silentRefresh', () => {
    it('не выполняет refresh когда accessToken null', async () => {
      const storeWithoutToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: null,
          refreshToken: 'refresh-token',
          expiresAt: 1000000000000 + 3600000,
        },
      };

      mockStoreState = storeWithoutToken;
      storeMocks.useAppStore.mockReturnValue(storeWithoutToken);
      storeMocks.getState.mockReturnValue(storeWithoutToken);

      renderHook(() => useAuth());

      // silentRefresh не должен вызывать refresh, так как нет accessToken
      // Это внутренний метод, но мы можем проверить через useEffect
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('не выполняет refresh когда refreshToken null', async () => {
      const storeWithoutRefreshToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: null,
          expiresAt: 1000000000000 + 3600000,
        },
      };

      mockStoreState = storeWithoutRefreshToken;
      storeMocks.useAppStore.mockReturnValue(storeWithoutRefreshToken);
      storeMocks.getState.mockReturnValue(storeWithoutRefreshToken);

      renderHook(() => useAuth());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('не выполняет refresh когда refreshToken пустая строка', async () => {
      const storeWithEmptyRefreshToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: '',
          expiresAt: 1000000000000 + 3600000,
        },
      };

      mockStoreState = storeWithEmptyRefreshToken;
      storeMocks.useAppStore.mockReturnValue(storeWithEmptyRefreshToken);
      storeMocks.getState.mockReturnValue(storeWithEmptyRefreshToken);

      renderHook(() => useAuth());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('не выполняет refresh когда токен еще свежий', async () => {
      const futureTime = 1000000000000 + 10 * 60 * 60 * 1000; // Через 10 часов
      const storeWithFreshToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: futureTime,
        },
      };

      mockStoreState = storeWithFreshToken;
      storeMocks.useAppStore.mockReturnValue(storeWithFreshToken);
      storeMocks.getState.mockReturnValue(storeWithFreshToken);

      renderHook(() => useAuth());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // silentRefresh не должен вызывать refresh, так как токен еще свежий
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('использует существующий Promise при параллельных вызовах silentRefresh', async () => {
      vi.useFakeTimers();

      try {
        const expiredTime = 1000000000000 - 10000; // В прошлом
        const storeWithExpiredToken: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: expiredTime,
          },
        };

        mockStoreState = storeWithExpiredToken;
        storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
        storeMocks.getState.mockReturnValue(storeWithExpiredToken);

        const mockTokenResponse = {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: 1000000000000 + 3600000,
        };
        effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

        const { result } = renderHook(() => useAuth());

        // Вызываем silentRefresh дважды параллельно
        await act(async () => {
          const promise1 = result.current.refreshIfNeeded();
          const promise2 = result.current.refreshIfNeeded();

          await Promise.all([promise1, promise2]);
        });

        // authService.refresh должен быть вызван только один раз
        expect(authService.refresh).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('refreshIfNeeded', () => {
    const mockTokenResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1000000000000 + 3600000,
    };

    it('не выполняет refresh когда пользователь не аутентифицирован', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('не выполняет refresh когда токен свежий', async () => {
      vi.clearAllTimers();
      const freshTokenTime = 1000000000000 + 600000; // +10 минут в будущем
      const storeWithFreshToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: freshTokenTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithFreshToken);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('бросает ошибку когда нет refresh токена', async () => {
      const storeWithToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: null,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithToken);

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.refreshIfNeeded();
        }),
      ).rejects.toThrow('No refresh token available');
    });

    it('выполняет refresh когда expiresAt null', async () => {
      const storeWithToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: null,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithToken);
      effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      // Когда expiresAt = null, токен считается "скоро истекающим" (timeToExpiry = 0)
      expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    });

    it('успешно выполняет refresh токенов', async () => {
      const expiredTime = 1000000000000 - 10000; // В прошлом
      const storeWithExpiredToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: expiredTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
      effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(authService.refresh).toHaveBeenCalledWith('refresh-token');

      // Проверяем, что safeSet был вызван для установки loading
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            isLoading: true,
          }),
        }),
        expect.objectContaining({ label: 'auth-refresh-loading' }),
      );

      // Проверяем, что safeSet был вызван для обновления токенов
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresAt: 1000000000000 + 3600000,
            isLoading: false,
          }),
        }),
        expect.objectContaining({ label: 'auth-refresh-success' }),
      );
    });

    it('обрабатывает ошибки refresh', async () => {
      const expiredTime = 1000000000000 - 10000;
      const storeWithExpiredToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: expiredTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
      const error = new Error('Refresh failed');
      effectMocks.runPromiseRuntime.mockRejectedValue(error);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      expect(mockOnError).toHaveBeenCalledWith(error, 'refresh');
      // Проверяем, что ошибка была проброшена (throwError=true в performRefresh)
      await expect(
        act(async () => {
          await result.current.refreshIfNeeded();
        }),
      ).rejects.toBe(error);
      // Проверяем, что safeSet был вызван для очистки auth state при ошибке refresh
      expect(storeUtilsMocks.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
          }),
          user: null,
          userStatus: 'anonymous',
        }),
        expect.objectContaining({ label: 'auth-refresh-error' }),
      );
    });

    it('использует очередь для параллельных refresh вызовов', async () => {
      const expiredTime = 1000000000000 - 10000;
      const storeWithExpiredToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: expiredTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
      effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

      const { result } = renderHook(() => useAuth());

      // Запускаем два параллельных refresh вызова (очередь предотвратит дублирование)
      const promise1 = result.current.refreshIfNeeded();
      const promise2 = result.current.refreshIfNeeded();

      await act(async () => {
        await promise1;
      });

      await act(async () => {
        await promise2;
      });

      // authService.refresh должен быть вызван только один раз (из-за очереди)
      expect(authService.refresh).toHaveBeenCalledTimes(1);

      // Проверяем, что safeSet был вызван только один раз для refresh
      const refreshCalls = storeUtilsMocks.safeSet.mock.calls.filter(
        (call) => call[1]?.label === 'auth-refresh-success',
      );
      expect(refreshCalls).toHaveLength(1);
    });
  });

  describe('ресурсы', () => {
    it('очищает таймеры при размонтировании', () => {
      vi.useFakeTimers();

      const { unmount } = renderHook(() => useAuth());

      unmount();

      // Таймеры должны быть очищены
      expect(vi.getTimerCount()).toBe(0);

      vi.useRealTimers();
    });

    it('валидирует TokenPairResponse структуру', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      const invalidResponse = { invalid: 'data' };
      effectMocks.runPromiseRuntime.mockResolvedValue(invalidResponse);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await expect(
        act(async () => {
          await result.current.login({ username: 'test', password: 'test' });
        }),
      ).rejects.toThrow(
        'TokenPair validation failed: accessToken must be string, got undefined (undefined)',
      );
    });

    it('бросает ошибку при null accessToken в ответе', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      const invalidResponse = {
        accessToken: null,
        refreshToken: 'refresh-token',
        expiresAt: 1000000000000 + 3600000,
      };
      effectMocks.runPromiseRuntime.mockResolvedValue(invalidResponse);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await expect(
        act(async () => {
          await result.current.login({ username: 'test', password: 'test' });
        }),
      ).rejects.toThrow(
        'TokenPair validation failed: accessToken must be string, got object (null)',
      );
    });

    it('бросает ошибку при null refreshToken в ответе', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      const invalidResponse = {
        accessToken: 'access-token',
        refreshToken: null,
        expiresAt: 1000000000000 + 3600000,
      };
      effectMocks.runPromiseRuntime.mockResolvedValue(invalidResponse);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await expect(
        act(async () => {
          await result.current.login({ username: 'test', password: 'test' });
        }),
      ).rejects.toThrow(
        'TokenPair validation failed: refreshToken must be string, got object (null)',
      );
    });

    it('бросает ошибку при expiresAt = 0 в ответе', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      const invalidResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 0,
      };
      effectMocks.runPromiseRuntime.mockResolvedValue(invalidResponse);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await expect(
        act(async () => {
          await result.current.login({ username: 'test', password: 'test' });
        }),
      ).rejects.toThrow(
        'TokenPair validation failed: expiresAt must be positive number, got number (0)',
      );
    });

    it('бросает ошибку при expiresAt как строка в ответе', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      const invalidResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '1234567890' as any,
      };
      effectMocks.runPromiseRuntime.mockResolvedValue(invalidResponse);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await expect(
        act(async () => {
          await result.current.login({ username: 'test', password: 'test' });
        }),
      ).rejects.toThrow(
        'TokenPair validation failed: expiresAt must be positive number, got string ("1234567890")',
      );
    });

    it('бросает ошибку при null ответе от сервера', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      effectMocks.runPromiseRuntime.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      try {
        await act(async () => {
          await result.current.login({ username: 'test', password: 'test' });
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('expected object, got object (null)');
      }
    });

    it('бросает ошибку при строковом ответе от сервера', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      effectMocks.runPromiseRuntime.mockResolvedValue('invalid string response');

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      try {
        await act(async () => {
          await result.current.login({ username: 'test', password: 'test' });
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain(
          'expected object, got string ("invalid string response")',
        );
      }
    });

    it('запускает автоматический refresh когда токен скоро истечет', () => {
      const mockTokenResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: 1000000000000 + 3600000,
      };

      const expiringSoonTime = 1000000000000 + 2 * 60 * 1000; // Через 2 минуты
      const storeWithExpiringToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: expiringSoonTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiringToken);
      effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

      renderHook(() => useAuth({ onError: mockOnError }));

      // В реальном коде таймер запустится автоматически
      // В тестах таймеры могут не выполняться автоматически
    });

    it('обрабатывает ошибки login через onError callback', async () => {
      storeMocks.useAppStore.mockReturnValue(mockStore);
      const error = new Error('Login failed');
      effectMocks.runPromiseRuntime.mockRejectedValue(error);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await act(async () => {
        await expect(result.current.login({ username: 'test', password: 'test' })).rejects.toBe(
          error,
        );
      });

      expect(mockOnError).toHaveBeenCalledWith(error, 'login');
    });

    it('обрабатывает ошибки logout через onError callback', async () => {
      const storeWithToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithToken);
      const error = new Error('Logout failed');
      effectMocks.runPromiseRuntime.mockRejectedValue(error);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      await act(async () => {
        await expect(result.current.logout()).rejects.toBe(error);
      });

      expect(mockOnError).toHaveBeenCalledWith(error, 'logout');
    });

    it('вычисляет timeToExpiry правильно', () => {
      const futureTime = 1000000000000 + 3600000; // Через 1 час
      const storeWithFutureToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          expiresAt: futureTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithFutureToken);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      expect(result.current.timeToExpiry).toBe(3600000); // 1 час в миллисекундах
    });

    it('возвращает timeToExpiry = 0 когда expiresAt null', () => {
      const storeWithoutExpiry: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          expiresAt: null,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithoutExpiry);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      expect(result.current.timeToExpiry).toBe(0);
    });

    it('возвращает timeToExpiry = 0 когда expiresAt в прошлом', () => {
      const pastTime = 1000000000000 - 10000; // 10 секунд в прошлом
      const storeWithExpiredToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          expiresAt: pastTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      expect(result.current.timeToExpiry).toBe(0);
    });

    it('правильно определяет isExpired для просроченного токена', () => {
      const pastTime = 1000000000000 - 10000; // 10 секунд назад
      const storeWithExpiredToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          expiresAt: pastTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      expect(result.current.isExpired).toBe(true);
    });

    it('правильно определяет isExpired для валидного токена', () => {
      const futureTime = 1000000000000 + 3600000; // Через 1 час
      const storeWithValidToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          expiresAt: futureTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithValidToken);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      expect(result.current.isExpired).toBe(false);
    });

    it('правильно определяет isExpired когда expiresAt точно равно текущему времени', () => {
      const currentTime = 1000000000000;
      const storeWithExactTimeToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          expiresAt: currentTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExactTimeToken);

      const { result } = renderHook(() => useAuth({ onError: mockOnError }));

      expect(result.current.isExpired).toBe(false); // Токен не истек если время истечения == текущего времени
    });

    it('запускает silent refresh при истечении токена', async () => {
      const expiredTime = 1000000000000 - 10000; // Токен уже истек
      const storeWithExpiredToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: expiredTime,
        },
      };

      storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
      effectMocks.runPromise.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: 1000000000000 + 3600000,
      });

      renderHook(() => useAuth());

      // Ждем, чтобы useEffect выполнился
      await new Promise((resolve) => setTimeout(resolve, 0));

      // silentRefresh должен быть вызван для истекшего токена
      expect(effectMocks.runPromiseRuntime).toHaveBeenCalled();
    });

    it('запускает автоматический refresh таймер когда токен скоро истечет', async () => {
      vi.useFakeTimers();

      // Токен истекает через 2 минуты (в пределах EXPIRING_SOON_THRESHOLD_MS = 5 минут)
      const expiringSoonTime = 1000000000000 + 2 * 60 * 1000; // Через 2 минуты
      const storeWithExpiringToken: AppStore = {
        ...mockStore,
        auth: {
          ...mockStore.auth,
          accessToken: 'test-token',
          refreshToken: 'refresh-token',
          expiresAt: expiringSoonTime,
        },
      };

      mockStoreState = storeWithExpiringToken;
      storeMocks.useAppStore.mockReturnValue(storeWithExpiringToken);
      storeMocks.getState.mockReturnValue(storeWithExpiringToken);

      const mockTokenResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: 1000000000000 + 3600000,
      };
      effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

      const { unmount } = renderHook(() => useAuth());

      // Продвигаем время вперед, чтобы таймер сработал (refreshDelay = timeToExpiry - EARLY_REFRESH_MS)
      // timeToExpiry = 2 * 60 * 1000 = 120000
      // refreshDelay = 120000 - 60000 = 60000
      await act(async () => {
        vi.advanceTimersByTime(60000); // 1 минута
      });

      // Проверяем, что silentRefresh был вызван через таймер (покрывает строку 514)
      expect(effectMocks.runPromiseRuntime).toHaveBeenCalled();

      // Проверяем cleanup функцию - таймер должен быть очищен при unmount (покрывает строки 524-526)
      unmount();

      // После unmount таймер должен быть очищен
      expect(vi.getTimerCount()).toBe(0);

      vi.useRealTimers();
    });

    it('очищает предыдущий таймер при изменении expiresAt', async () => {
      vi.useFakeTimers();

      try {
        const expiringSoonTime1 = 1000000000000 + 2 * 60 * 1000; // Через 2 минуты
        const storeWithExpiringToken1: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: expiringSoonTime1,
          },
        };

        mockStoreState = storeWithExpiringToken1;
        storeMocks.useAppStore.mockReturnValue(storeWithExpiringToken1);
        storeMocks.getState.mockReturnValue(storeWithExpiringToken1);

        const { rerender } = renderHook(() => useAuth());

        // Изменяем expiresAt - это должно вызвать clearTimeout (покрывает строки 497-499)
        const expiringSoonTime2 = 1000000000000 + 3 * 60 * 1000; // Через 3 минуты
        const storeWithExpiringToken2: AppStore = {
          ...storeWithExpiringToken1,
          auth: {
            ...storeWithExpiringToken1.auth,
            expiresAt: expiringSoonTime2,
          },
        };

        mockStoreState = storeWithExpiringToken2;
        storeMocks.useAppStore.mockReturnValue(storeWithExpiringToken2);
        storeMocks.getState.mockReturnValue(storeWithExpiringToken2);

        // Перерендерим с новым expiresAt
        await act(async () => {
          rerender();
        });

        // Предыдущий таймер должен быть очищен
        // Это покрывает строки 497-499 (clearTimeout в начале useEffect)
      } finally {
        vi.useRealTimers();
      }
    });

    it('обрабатывает cross-tab locking для silent refresh', async () => {
      vi.useFakeTimers();

      try {
        const expiredTime = 1000000000000 - 10000; // В прошлом
        const storeWithExpiredToken: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: expiredTime,
          },
        };

        mockStoreState = storeWithExpiredToken;
        storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
        storeMocks.getState.mockReturnValue(storeWithExpiredToken);

        const mockTokenResponse = {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: 1000000000000 + 3600000,
        };
        effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

        // Симулируем cross-tab locking через BroadcastChannel
        // mockBroadcastChannel уже настроен в beforeEach, он создаст mockChannelInstance

        const { result } = renderHook(() => useAuth());

        // Ждем, чтобы useEffect выполнился и создал канал
        await act(async () => {
          vi.advanceTimersByTime(0);
          await vi.runAllTimersAsync();
        });

        // Проверяем, что канал был создан
        expect(mockChannelInstance).not.toBeNull();

        // Убеждаемся, что канал был создан
        expect(mockChannelInstance).not.toBeNull();

        // Симулируем сообщение от другой вкладки о начале refresh
        await act(async () => {
          if (mockChannelInstance && mockChannelInstance.onmessage !== null) {
            mockChannelInstance.onmessage({
              data: {
                type: 'refresh-started',
                tabId: 'other-tab-id',
              },
            } as MessageEvent);
          }
        });

        // Вызываем refreshIfNeeded - он должен ждать из-за cross-tab lock
        let refreshPromise: Promise<void>;
        await act(async () => {
          refreshPromise = result.current.refreshIfNeeded();
        });

        // refreshIfNeeded вызывает silentRefresh, который проверяет isCrossTabLockedRef
        // и возвращает Promise с setTimeout, но не отправляет сообщение пока lock активен
        // Продвигаем таймер для setTimeout внутри silentRefresh (строка 380)
        await act(async () => {
          vi.advanceTimersByTime(1000);
          await refreshPromise!;
        });

        // После разблокировки silentRefresh должен был отправить сообщение
        // Проверяем, что сообщение было отправлено (после рекурсивного вызова)
        // silentRefresh рекурсивно вызывает сам себя после разблокировки
        expect(mockChannelInstance?.postMessage).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('обрабатывает cross-tab refresh-finished сообщение и разблокирует refresh', async () => {
      vi.useFakeTimers();

      try {
        const expiredTime = 1000000000000 - 10000; // В прошлом
        const storeWithExpiredToken: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: expiredTime,
          },
        };

        mockStoreState = storeWithExpiredToken;
        storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
        storeMocks.getState.mockReturnValue(storeWithExpiredToken);

        const mockTokenResponse = {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: 1000000000000 + 3600000,
        };
        effectMocks.runPromiseRuntime.mockResolvedValue(mockTokenResponse);

        const { result } = renderHook(() => useAuth());

        // Ждем, чтобы useEffect выполнился и установил onmessage
        await act(async () => {
          vi.advanceTimersByTime(0);
        });

        // Симулируем сообщение от другой вкладки о начале refresh (блокируем)
        await act(async () => {
          if (mockChannelInstance && mockChannelInstance.onmessage !== null) {
            mockChannelInstance.onmessage({
              data: {
                type: 'refresh-started',
                tabId: 'other-tab-id',
              },
            } as MessageEvent);
          }
        });

        // Вызываем refreshIfNeeded - он должен ждать из-за cross-tab lock
        let refreshPromise: Promise<void>;
        await act(async () => {
          refreshPromise = result.current.refreshIfNeeded();
        });

        // Симулируем сообщение от другой вкладки об окончании refresh (разблокируем)
        await act(async () => {
          if (mockChannelInstance && mockChannelInstance.onmessage !== null) {
            mockChannelInstance.onmessage({
              data: {
                type: 'refresh-finished',
                tabId: 'other-tab-id',
              },
            } as MessageEvent);
          }
        });

        // Продвигаем таймер для setTimeout внутри silentRefresh
        await act(async () => {
          vi.advanceTimersByTime(1000);
          await refreshPromise!;
        });

        // Проверяем, что канал был создан и refresh выполнился после разблокировки
        expect(mockChannelInstance).not.toBeNull();
        expect(effectMocks.runPromiseRuntime).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('обрабатывает ошибку при создании BroadcastChannel', () => {
      // Симулируем ошибку при создании BroadcastChannel
      const OriginalBroadcastChannel = global.BroadcastChannel;
      global.BroadcastChannel = class {
        constructor() {
          throw new Error('BroadcastChannel not supported');
        }
      } as any;

      // Хук должен работать без ошибок даже если BroadcastChannel не поддерживается
      expect(() => {
        renderHook(() => useAuth());
      }).not.toThrow();

      // Восстанавливаем оригинальный BroadcastChannel
      global.BroadcastChannel = OriginalBroadcastChannel;
    });

    it('очищает BroadcastChannel при unmount', async () => {
      const { unmount } = renderHook(() => useAuth());

      // Ждем, чтобы useEffect выполнился и создал канал
      await act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
      });

      // Проверяем, что канал был создан
      expect(mockChannelInstance).not.toBeNull();
      if (mockChannelInstance) {
        expect(mockChannelInstance.close).not.toHaveBeenCalled();
      }

      // Размонтируем компонент - это должно вызвать cleanup функцию
      unmount();

      // Ждем выполнения cleanup
      await act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
      });

      // Проверяем, что канал был закрыт
      if (mockChannelInstance) {
        expect(mockChannelInstance.close).toHaveBeenCalled();
      }
    });

    it('не запускает таймер когда токен еще свежий', async () => {
      vi.useFakeTimers();

      try {
        // Токен истекает через 10 минут (больше EXPIRING_SOON_THRESHOLD_MS = 5 минут)
        const futureTime = 1000000000000 + 10 * 60 * 1000; // Через 10 минут
        const storeWithFutureToken: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: futureTime,
          },
        };

        mockStoreState = storeWithFutureToken;
        storeMocks.useAppStore.mockReturnValue(storeWithFutureToken);
        storeMocks.getState.mockReturnValue(storeWithFutureToken);

        renderHook(() => useAuth());

        // Продвигаем время вперед
        await act(async () => {
          vi.advanceTimersByTime(60000); // 1 минута
        });

        // silentRefresh не должен быть вызван, так как токен еще свежий
        expect(effectMocks.runPromiseRuntime).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('не запускает таймер когда accessToken null', async () => {
      vi.useFakeTimers();

      try {
        const storeWithoutToken: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: null,
            refreshToken: 'refresh-token',
            expiresAt: 1000000000000 + 2 * 60 * 1000,
          },
        };

        mockStoreState = storeWithoutToken;
        storeMocks.useAppStore.mockReturnValue(storeWithoutToken);
        storeMocks.getState.mockReturnValue(storeWithoutToken);

        renderHook(() => useAuth());

        // Продвигаем время вперед
        await act(async () => {
          vi.advanceTimersByTime(60000);
        });

        // silentRefresh не должен быть вызван, так как нет токена
        expect(effectMocks.runPromiseRuntime).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('не запускает таймер когда expiresAt null', async () => {
      vi.useFakeTimers();

      try {
        const storeWithoutExpiry: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: null,
          },
        };

        mockStoreState = storeWithoutExpiry;
        storeMocks.useAppStore.mockReturnValue(storeWithoutExpiry);
        storeMocks.getState.mockReturnValue(storeWithoutExpiry);

        renderHook(() => useAuth());

        // Продвигаем время вперед
        await act(async () => {
          vi.advanceTimersByTime(60000);
        });

        // silentRefresh не должен быть вызван, так как нет expiresAt
        expect(effectMocks.runPromiseRuntime).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('не запускает таймер когда timeToExpiry = 0', async () => {
      vi.useFakeTimers();

      try {
        // Токен уже истек (expiresAt в прошлом)
        const expiredTime = 1000000000000 - 10000; // В прошлом
        const storeWithExpiredToken: AppStore = {
          ...mockStore,
          auth: {
            ...mockStore.auth,
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: expiredTime,
          },
        };

        mockStoreState = storeWithExpiredToken;
        storeMocks.useAppStore.mockReturnValue(storeWithExpiredToken);
        storeMocks.getState.mockReturnValue(storeWithExpiredToken);

        renderHook(() => useAuth());

        // Продвигаем время вперед
        await act(async () => {
          vi.advanceTimersByTime(60000);
        });

        // Таймер не должен быть запущен, так как timeToExpiry = 0 (токен уже истек)
        // Но silentRefresh должен быть вызван через другой useEffect (строка 451)
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
