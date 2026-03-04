/**
 * @file packages/app/src/hooks/useAuth.ts
 * ============================================================================
 * 🔐 USE AUTH — ORCHESTRATION-СЛОЙ АУТЕНТИФИКАЦИИ
 * ============================================================================
 * Архитектурная роль:
 * - Оркестрация аутентификации между UI и AuthService
 * - Синхронизация состояния с App Store
 * - Управление токенами и автоматический refresh
 * - Обработка ошибок и edge cases
 * Свойства:
 * - React-optimized: стабильные ссылки, правильные зависимости
 * - Store-connected: автоматическая синхронизация состояния
 * - Error-resilient: graceful handling ошибок и сетевых проблем
 * - Token-aware: автоматический refresh при истечении
 */

import { Runtime } from 'effect';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { LoginRequest, TokenPairResponse } from '../lib/auth-service.js';
import { authService } from '../lib/auth-service.js';
import { safeSet, setStoreLocked } from '../state/store-utils.js';
import type { AppStore } from '../state/store.js';
import { getCurrentTime, useAppStore } from '../state/store.js';

/* ============================================================================
 * 🎯 AUTH СЕЛЕКТОРЫ
 * ========================================================================== */

/**
 * Селекторы для работы с auth состоянием.
 * Оптимизированы для использования в компонентах.
 */
export const authSelectors = {
  /** Пользователь аутентифицирован (есть access token). */
  isAuthenticated: (store: AppStore) => Boolean(store.auth.accessToken),

  /** Токен истек. */
  isExpired: (store: AppStore) =>
    store.auth.expiresAt != null && getCurrentTime() > store.auth.expiresAt,

  /** Время до истечения токена в миллисекундах. */
  timeToExpiry: (store: AppStore) =>
    store.auth.expiresAt != null
      ? Math.max(0, store.auth.expiresAt - getCurrentTime())
      : 0,

  /** Токен скоро истечет (менее 5 минут). */
  isExpiringSoon: (store: AppStore) =>
    authSelectors.timeToExpiry(store) < EXPIRING_SOON_THRESHOLD_MS,
} as const;

/* ============================================================================
 * ⚙️ CONFIG CONSTANTS
 * ========================================================================== */

/** Токен считается "скоро истечет" если осталось менее 5 минут */
const EXPIRING_SOON_THRESHOLD_MS = 300000; // 5 minutes in milliseconds

/** Начать refresh за 1 минуту до истечения токена */
const EARLY_REFRESH_MS = 60000; // 1 minute in milliseconds

/* ============================================================================
 * 🔧 TOKEN STATE HELPERS
 * ========================================================================== */

/** Вычисляет состояние токена на основе времени истечения. */
const computeTokenState = (
  expiresAt: number | null,
): { isExpired: boolean; timeToExpiry: number; isExpiringSoon: boolean; } => {
  const now = getCurrentTime();
  const isExpired = expiresAt != null && now > expiresAt;
  const timeToExpiry = expiresAt != null ? Math.max(0, expiresAt - now) : 0;
  const isExpiringSoon = timeToExpiry < EXPIRING_SOON_THRESHOLD_MS;
  return { isExpired, timeToExpiry, isExpiringSoon };
};

/**
 * Безопасно извлекает и валидирует TokenPairResponse из Effect результата.
 * Использует runtime валидацию для обеспечения корректности данных.
 */
const extractTokenPair = (result: unknown): TokenPairResponse => {
  if (result == null || typeof result !== 'object') {
    throw new Error(
      `TokenPair validation failed: expected object, got ${typeof result} (${
        JSON.stringify(result)
      })`,
    );
  }

  const obj = result as Record<string, unknown>;

  const accessToken = obj['accessToken'];
  if (typeof accessToken !== 'string') {
    throw new Error(
      `TokenPair validation failed: accessToken must be string, got ${typeof accessToken} (${
        JSON.stringify(accessToken)
      })`,
    );
  }

  const refreshToken = obj['refreshToken'];
  if (typeof refreshToken !== 'string') {
    throw new Error(
      `TokenPair validation failed: refreshToken must be string, got ${typeof refreshToken} (${
        JSON.stringify(refreshToken)
      })`,
    );
  }

  const expiresAt = obj['expiresAt'];
  if (typeof expiresAt !== 'number' || expiresAt <= 0) {
    throw new Error(
      `TokenPair validation failed: expiresAt must be positive number, got ${typeof expiresAt} (${
        JSON.stringify(expiresAt)
      })`,
    );
  }

  return result as TokenPairResponse;
};

/* ============================================================================
 * 🪝 USE AUTH HOOK
 * ========================================================================== */

/**
 * React hook для управления аутентификацией.
 * Предоставляет состояние и методы для login/logout/refresh.
 */
export function useAuth(options?: {
  onError?: (error: unknown, operation: 'login' | 'logout' | 'refresh') => void;
}): {
  isAuthenticated: boolean;
  isLoading: boolean;
  isExpired: boolean;
  timeToExpiry: number;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshIfNeeded: () => Promise<void>;
} {
  const { onError } = options ?? {};
  const store = useAppStore();

  /** Выполняет refresh токенов. */
  const performRefresh = useCallback(
    async (refreshToken: string, throwError: boolean): Promise<void> => {
      try {
        const initialAuth = useAppStore.getState().auth;
        safeSet(
          {
            auth: {
              ...initialAuth,
              isLoading: true,
            },
          },
          { label: 'auth-refresh-loading' },
        );

        const result = extractTokenPair(
          await Runtime.runPromise(Runtime.defaultRuntime, authService.refresh(refreshToken)),
        );

        // Успешный refresh - обновляем токены через safeSet для atomic updates
        const currentAuthState = useAppStore.getState().auth;
        safeSet(
          {
            auth: {
              ...currentAuthState,
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              expiresAt: result.expiresAt,
              isLoading: false,
            },
          },
          { label: 'auth-refresh-success' },
        );
      } catch (error) {
        // При ошибке refresh - очищаем токены и user для безопасности
        const errorAuthState = useAppStore.getState().auth;
        safeSet(
          {
            auth: {
              ...errorAuthState,
              accessToken: null,
              refreshToken: null,
              expiresAt: null,
              isLoading: false,
            },
            user: null,
            userStatus: 'anonymous',
          },
          { label: 'auth-refresh-error' },
        );
        onError?.(error, 'refresh');
        if (throwError) {
          throw error;
        }
      } finally {
        refreshPromiseRef.current = null;
      }
    },
    [onError],
  );

  // Защита от параллельного refresh и очередь ожидания
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  // Таймер для автоматического refresh
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cross-tab locking для silent refresh
  const refreshChannelRef = useRef<BroadcastChannel | null>(null);
  const isCrossTabLockedRef = useRef(false);

  // Мемоизированные селекторы для производительности
  const isAuthenticated = useMemo(
    () => Boolean(store.auth.accessToken),
    [store.auth.accessToken],
  );

  const isLoading = store.auth.isLoading;
  const isExpired = useMemo(
    () => store.auth.expiresAt != null && getCurrentTime() > store.auth.expiresAt,
    [store.auth.expiresAt],
  );

  // Стабильные производные значения
  const timeToExpiry = useMemo(
    () =>
      store.auth.expiresAt != null
        ? Math.max(0, store.auth.expiresAt - getCurrentTime())
        : 0,
    [store.auth.expiresAt],
  );

  /** Выполняет вход пользователя и обновляет store. */
  const login = useCallback(async (request: LoginRequest): Promise<void> => {
    try {
      const currentAuth = useAppStore.getState().auth;
      safeSet(
        {
          auth: {
            ...currentAuth,
            isLoading: true,
          },
        },
        { label: 'auth-login-loading' },
      );

      const result = extractTokenPair(
        await Runtime.runPromise(Runtime.defaultRuntime, authService.login(request)),
      );

      // Успешный login - сохраняем токены через safeSet для atomic updates
      const currentAuthAfterLogin = useAppStore.getState().auth;
      safeSet(
        {
          auth: {
            ...currentAuthAfterLogin,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: result.expiresAt,
            isLoading: false,
          },
        },
        { label: 'auth-login-success' },
      );
    } catch (error) {
      // Ошибка login - сбрасываем loading состояние
      const currentAuth = useAppStore.getState().auth;
      safeSet(
        {
          auth: {
            ...currentAuth,
            isLoading: false,
          },
        },
        { label: 'auth-login-error' },
      );
      // Обработку ошибок делегируем UI (toast и т.д.)
      onError?.(error, 'login');
      throw error;
    }
  }, [onError]);

  /** Выполняет выход пользователя и очищает store. */
  const logout = useCallback(async (): Promise<void> => {
    // Блокируем store перед началом logout для предотвращения race conditions
    setStoreLocked(true);
    try {
      const currentAuth = useAppStore.getState().auth;
      safeSet(
        {
          auth: {
            ...currentAuth,
            isLoading: true,
          },
        },
        { label: 'auth-logout-loading' },
      );

      await Runtime.runPromise(Runtime.defaultRuntime, authService.logout());

      // Успешный logout - очищаем токены и user через safeSet для atomic updates
      const currentAuthAfterLogout = useAppStore.getState().auth;
      safeSet(
        {
          auth: {
            ...currentAuthAfterLogout,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
          },
          user: null,
          userStatus: 'anonymous',
        },
        { label: 'auth-logout-success' },
      );
    } catch (error) {
      // Даже при ошибке logout - очищаем локальное состояние
      // для безопасности (токены могут быть недействительными)
      const currentAuth = useAppStore.getState().auth;
      safeSet(
        {
          auth: {
            ...currentAuth,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
          },
          user: null,
          userStatus: 'anonymous',
        },
        { label: 'auth-logout-error' },
      );
      onError?.(error, 'logout');
      throw error;
    } finally {
      // Разблокируем store после завершения logout
      setStoreLocked(false);
    }
  }, [onError]);

  /**
   * Тихий автоматический refresh токенов (без ошибок).
   * Все вызовы используют один Promise для предотвращения дублирования API запросов.
   */
  const silentRefresh = useCallback(async (): Promise<void> => {
    const { accessToken, refreshToken, expiresAt } = store.auth;

    if (accessToken === null) {
      return; // Нечего refresh'ить
    }

    if (refreshToken === null || refreshToken.trim() === '') {
      return; // Тихий выход - нет токена для refresh
    }

    const { isExpired, isExpiringSoon } = computeTokenState(expiresAt);

    if (!isExpiringSoon && !isExpired) {
      return; // Токен еще свежий
    }

    // Если refresh уже выполняется - ждем его завершения
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    // Проверяем cross-tab locking
    if (isCrossTabLockedRef.current) {
      // Ждем небольшой таймаут и пробуем снова
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          silentRefresh().then(resolve).catch(() => {
            // Тихий refresh провалился, но разрешаем Promise
            resolve();
          });
        }, 1000);
      });
    }

    // Сообщаем другим вкладкам о начале refresh
    if (refreshChannelRef.current) {
      refreshChannelRef.current.postMessage({
        type: 'refresh-started',
        tabId: window.location.href,
      });
    }

    // Создаем Promise для ожидания компонентами

    refreshPromiseRef.current = performRefresh(refreshToken, false).finally(() => {
      refreshPromiseRef.current = null;
      // Сообщаем другим вкладкам об окончании refresh
      if (refreshChannelRef.current) {
        refreshChannelRef.current.postMessage({
          type: 'refresh-finished',
          tabId: window.location.href,
        });
      }
    });

    return refreshPromiseRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.auth.accessToken, store.auth.refreshToken, store.auth.expiresAt, performRefresh]);

  /**
   * Обновляет токены при необходимости. Thread-safe, бросает ошибки.
   * Все вызовы используют один Promise для предотвращения дублирования API запросов.
   */
  const refreshIfNeeded = useCallback(async (): Promise<void> => {
    const { accessToken, refreshToken, expiresAt } = store.auth;

    if (accessToken === null) {
      return; // Нечего refresh'ить
    }

    if (refreshToken === null || refreshToken.trim() === '') {
      throw new Error('No refresh token available');
    }

    const { isExpired, isExpiringSoon } = computeTokenState(expiresAt);

    if (!isExpiringSoon && !isExpired) {
      return; // Токен еще свежий
    }

    // Если refresh уже выполняется - ждем его завершения
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    // Создаем Promise для ожидания компонентами

    refreshPromiseRef.current = performRefresh(refreshToken, true).finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.auth.accessToken, store.auth.refreshToken, store.auth.expiresAt, performRefresh]);

  // Автоматический refresh при истечении токена
  useEffect(() => {
    if (isAuthenticated && isExpired && !isLoading) {
      // Тихий refresh в фоне (не бросает ошибки)
      silentRefresh().catch(() => {
        // Тихий refresh - игнорируем ошибки
      });
    }
  }, [isAuthenticated, isExpired, isLoading, silentRefresh]);

  // Инициализация cross-tab communication для refresh
  useEffect(() => {
    // Создаем BroadcastChannel для координации refresh между вкладками
    try {
      refreshChannelRef.current = new BroadcastChannel('auth-refresh-channel');

      refreshChannelRef.current.onmessage = (event: MessageEvent): void => {
        const data = event.data as { type: string; tabId: string; };

        if (data.type === 'refresh-started' && data.tabId !== window.location.href) {
          // Другая вкладка начала refresh - ждем

          isCrossTabLockedRef.current = true;
        } else if (data.type === 'refresh-finished' && data.tabId !== window.location.href) {
          // Другая вкладка закончила refresh - можно продолжать

          isCrossTabLockedRef.current = false;
        }
      };
    } catch {
      // BroadcastChannel не поддерживается - работаем без cross-tab locking
      // console.warn('BroadcastChannel not supported, cross-tab refresh locking disabled');
    }

    return (): void => {
      if (refreshChannelRef.current) {
        refreshChannelRef.current.close();

        refreshChannelRef.current = null;
      }
    };
  }, []);

  // Таймер для автоматического refresh когда токен близок к истечению
  useEffect(() => {
    // Очищаем предыдущий таймер
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);

      refreshTimeoutRef.current = null;
    }

    const { accessToken, expiresAt } = store.auth;

    // Запускаем таймер только если пользователь аутентифицирован
    if (accessToken !== null && expiresAt !== null) {
      const now = getCurrentTime();
      const timeToExpiry = Math.max(0, expiresAt - now);

      // Если токен истекает в ближайшие 5 минут, запускаем refresh заранее
      if (timeToExpiry > 0 && timeToExpiry <= EXPIRING_SOON_THRESHOLD_MS) {
        const refreshDelay = Math.max(1000, timeToExpiry - EARLY_REFRESH_MS); // Refresh за 1 мин до истечения, минимум 1 сек

        refreshTimeoutRef.current = setTimeout(() => {
          silentRefresh().catch(() => {
            // Тихий refresh - игнорируем ошибки
          });
        }, refreshDelay);
      }
    }

    // Очистка при unmount или изменении зависимостей
    return (): void => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);

        refreshTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.auth.accessToken, store.auth.expiresAt, silentRefresh]);

  // Стабильные ссылки для компонентов
  return useMemo(() => ({
    // State
    isAuthenticated,
    isLoading,
    isExpired,
    timeToExpiry,

    // Actions
    login,
    logout,
    refreshIfNeeded,
  }), [
    isAuthenticated,
    isLoading,
    isExpired,
    timeToExpiry,
    login,
    logout,
    refreshIfNeeded,
  ]);
}
