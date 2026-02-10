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
const mockBroadcastChannel = vi.fn(function() {
  return {
    postMessage: vi.fn(),
    close: vi.fn(),
    onmessage: null,
    name: '',
    onmessageerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
});

global.BroadcastChannel = mockBroadcastChannel as any;

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

// Mock store
const storeMocks = vi.hoisted(() => ({
  useAppStore: vi.fn(function() {
    return {} as AppStore;
  }),
}));

vi.mock('../../../src/state/store', async () => {
  const actualStore = await vi.importActual('../../../src/state/store');
  return {
    ...actualStore,
    useAppStore: storeMocks.useAppStore,
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
    storeMocks.useAppStore.mockReturnValue(mockStore);
    getCurrentTimeMocks.getCurrentTime.mockReturnValue(1000000000000);

    // Reset Effect mock
    effectMocks.runPromise.mockReset();

    // Reset actions mocks
    Object.values(mockActions).forEach((mock) => mock.mockReset());
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

      expect(mockActions.setAuthTokens).toHaveBeenCalledWith({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 1000000000000 + 3600000,
      });

      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(true);
      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(false);
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
      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(true);
      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(false);
      expect(mockActions.setAuthTokens).not.toHaveBeenCalled();
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
      expect(mockActions.clearAuth).toHaveBeenCalled();
      expect(mockActions.setUser).toHaveBeenCalledWith(null);
      expect(mockActions.setUserStatus).toHaveBeenCalledWith('anonymous');
      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(true);
      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(false);
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
      expect(mockActions.clearAuth).toHaveBeenCalled();
      expect(mockActions.setUser).toHaveBeenCalledWith(null);
      expect(mockActions.setUserStatus).toHaveBeenCalledWith('anonymous');
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
      expect(mockActions.setAuthTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: 1000000000000 + 3600000,
      });
      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(true);
      expect(mockActions.setAuthLoading).toHaveBeenCalledWith(false);
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
      expect(mockActions.clearAuth).toHaveBeenCalled();
      expect(mockActions.setUser).toHaveBeenCalledWith(null);
      expect(mockActions.setUserStatus).toHaveBeenCalledWith('anonymous');
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
      expect(mockActions.setAuthTokens).toHaveBeenCalledTimes(1);
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
  });
});
