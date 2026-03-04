/**
 * @file packages/app/src/state/store.ts
 * ============================================================================
 * 🧠 APP STORE — ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ (ZUSTAND)
 * ============================================================================
 * Архитектурная роль:
 * - Единственный источник правды для UI-состояния приложения
 * - Микросервисно-нейтральный слой (без доменной логики)
 * - Только синхронные, детерминированные изменения
 * - SSR-safe, устойчивый к масштабированию и расширению
 * Гарантии:
 * - ❌ Нет async / side-effects
 * - ❌ Нет бизнес-логики
 * - ✅ Чёткие контракты типов
 * - ✅ Инфраструктура вынесена за пределы store
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

import type { ID, Nullable } from '../types/common.js';

/* ========================================================================== */
/* 🕐 TIME UTILITIES - MOCKABLE FOR TESTING */
/* ========================================================================== */

/** Функция получения текущего времени. Экспортируется для возможности mock'а в тестах. */
export function getCurrentTime(): number {
  return Date.now();
}

/* ========================================================================== */
/* 🧩 БАЗОВЫЕ ТИПЫ */
/* ========================================================================== */

/** Поддерживаемые темы интерфейса. */
export type ThemeMode = 'light' | 'dark';

/** UX-статус пользователя (не равен auth-домену). */
export type UserStatus = 'anonymous' | 'loading' | 'authenticated';

/**
 * Минимальный, доменно-нейтральный контракт пользователя.
 * Используется исключительно для UI.
 */
export type AppUser = Readonly<{
  readonly id: ID<'User'>;
  readonly name?: string;
  readonly email?: string;
  readonly avatarUrl?: string;
  readonly role?: string;
}>;

/* ========================================================================== */
/* 🧠 СОСТОЯНИЕ */
/* ========================================================================== */

/**
 * Чистое состояние store (без методов).
 * Именно оно участвует в persistence и сериализации.
 */
export type AppStoreState = Readonly<{
  /** Текущий пользователь (null — не аутентифицирован). */
  readonly user: Nullable<AppUser>;

  /** UX-статус пользователя. */
  readonly userStatus: UserStatus;

  /** Активная тема интерфейса. */
  readonly theme: ThemeMode;

  /** Доступность сети (обновляется инфраструктурой). */
  readonly isOnline: boolean;
}>;

/* ========================================================================== */
/* 🎛️ ACTIONS */
/* ========================================================================== */

/** Синхронные действия над состоянием. Не содержат side-effects. */
export type AppStoreActions = Readonly<{
  /**
   * Устанавливает текущего пользователя.
   * @invariant user === null => userStatus !== 'authenticated'
   * Проверяется на уровне auth orchestration, не в store.
   */
  readonly setUser: (user: Nullable<AppUser>) => void;

  /** Устанавливает UX-статус пользователя. */
  readonly setUserStatus: (status: UserStatus) => void;
  readonly setTheme: (theme: ThemeMode) => void;
  readonly setOnline: (isOnline: boolean) => void;

  /**
   * Атомарно устанавливает пользователя и статус `authenticated`.
   * Рекомендуется для auth-потоков.
   */
  readonly setAuthenticatedUser: (user: AppUser) => void;

  /** Сбрасывает состояние к безопасному baseline. */
  readonly reset: () => void;

  /** Минимальный сброс только runtime состояния (пользователь, статусы загрузки). */
  readonly resetSoft: () => void;
}>;

/* ========================================================================== */
/* 🧱 ПОЛНЫЙ КОНТРАКТ STORE */
/* ========================================================================== */

export type AppStore =
  & AppStoreState
  & Readonly<{
    readonly actions: AppStoreActions;
  }>;

/* ========================================================================== */
/* ⚙️ ИНИЦИАЛИЗАЦИЯ */
/* ========================================================================== */

/** Определяет стартовый статус сети (SSR-safe). */
export function getInitialOnlineStatus(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/** Базовое, безопасное состояние приложения. Заморожено для предотвращения мутаций. */
const BASE_STATE: AppStoreState = Object.freeze({
  user: null,
  userStatus: 'anonymous',
  theme: 'light',
  isOnline: true,
});

/** Создаёт начальное состояние store. */
export function createInitialState(): AppStoreState {
  return {
    ...BASE_STATE,
    isOnline: getInitialOnlineStatus(),
  };
}

/* ========================================================================== */
/* 🏗️ STORE */
/* ========================================================================== */

const STORE_NAME = 'app-store';
const STORE_VERSION = 1;

/**
 * Глобальный Zustand store.
 * Persist сохраняет theme и user.id (без network данных).
 * ВАЖНО:
 * - set(...) используется только в merge-режиме.
 * - Полная замена состояния допускается только через reset().
 * - UX: user.id сохраняется для восстановления сессии при reload.
 * - Sensitive данные пользователя (name, email, etc.) не сохраняются.
 * - Auth токены теперь хранятся в feature-auth store, не здесь.
 */
export const useAppStore = create<AppStore>()(
  persist(
    subscribeWithSelector((set) => ({
      ...createInitialState(),

      actions: {
        setUser: (user: Nullable<AppUser>): void => {
          set({ user });
        },

        setUserStatus: (status: UserStatus): void => {
          set({ userStatus: status });
        },

        setTheme: (theme: ThemeMode): void => {
          set({ theme });
        },

        setOnline: (isOnline: boolean): void => {
          set({ isOnline });
        },

        setAuthenticatedUser: (user: AppUser): void => {
          set({ user, userStatus: 'authenticated' });
        },

        reset: (): void => {
          set(createInitialState());
        },

        resetSoft: (): void => {
          set((state) => ({
            ...state,
            user: null,
            userStatus: 'anonymous',
          }));
        },
      },
    })),
    {
      name: STORE_NAME,
      version: STORE_VERSION,

      /** Persist только минимально необходимого состояния. */
      partialize: storePartialize,

      /** Безопасный merge без перетирания actions. */
      merge: storeMerge,
    },
  ),
);

/* ========================================================================== */
/* 🎯 СЕЛЕКТОРЫ */
/* ========================================================================== */

/** Базовые селекторы состояния. Типобезопасный доступ к полям state. */
export const appStoreSelectors = {
  user: (store: AppStore) => store.user,
  userStatus: (store: AppStore) => store.userStatus,
  theme: (store: AppStore) => store.theme,
  isOnline: (store: AppStore) => store.isOnline,
  actions: (store: AppStore) => store.actions,
} as const;

/** Производные селекторы (derived state). Вычисляемые значения на основе базового состояния. */
export const appStoreDerivedSelectors = {
  /** Пользователь аутентифицирован. */
  isAuthenticated: (store: AppStore): boolean =>
    store.userStatus === 'authenticated' && store.user != null,
} as const;

/* ========================================================================== */
/* 🌐 СЕТЕВАЯ ИНФРАСТРУКТУРА */
/* ========================================================================== */

/**
 * Подписывается на online/offline события браузера
 * и синхронизирует их с store.
 * Вызывать из bootstrap-слоя (не из React и не из store).
 * Возвращает cleanup-функцию.
 */
export function registerNetworkStatusListener(): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => undefined;
  }

  const { setOnline } = useAppStore.getState().actions;

  const handleOnline = (): void => {
    setOnline(true);
  };
  const handleOffline = (): void => {
    setOnline(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Синхронизация при инициализации
  setOnline(getInitialOnlineStatus());

  return (): void => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/* ============================================================================
 * 🏛️ ARCHITECTURAL CONTRACT — НЕОБХОДИМЫЕ ИНВАРИАНТЫ
 * ============================================================================

 * @contract
 *
 * ЧТО МОЖНО КЛАСТЬ В STORE:
 * - UI-состояние (theme, модальные окна, sidebar, etc.)
 * - UX-метаданные пользователя (статус, но не бизнес-данные)
 * - Auth состояние (токены, но не sensitive данные напрямую)
 * - Кешированные данные API (только для UI, без бизнес-логики)
 * - Сетевое состояние (online/offline)
 *
 * ЧТО НЕЛЬЗЯ КЛАСТЬ В STORE:
 * - Бизнес-логика и правила валидации
 * - API-ключи и sensitive данные
 * - Async операции и side-effects
 * - Компьютед свойства (кроме селекторов)
 * - Доменные модели (User, Order, etc.)
 */

/* ========================================================================== */
/* 🧪 TEST EXPORTS (только для тестирования) */
/* ========================================================================== */

/** Функция partialize для persist middleware. Экспортируется только для тестирования. */
export function storePartialize(state: AppStoreState): Pick<AppStoreState, 'theme'> & {
  userId: AppUser['id'] | null;
} {
  return {
    theme: state.theme,
    userId: state.user?.id ?? null, // UX: сохраняем user.id для восстановления сессии
  };
}

/** Функция merge для persist middleware. Экспортируется только для тестирования. */
export function storeMerge(persisted: unknown, current: AppStore): AppStore {
  if (persisted === null || persisted === undefined || typeof persisted !== 'object') {
    return current;
  }

  const persistedState = persisted as ReturnType<typeof storePartialize>;

  // UX: восстанавливаем user.id для сохранения сессии между reload'ами
  const restoredUser = persistedState.userId && !current.user
    ? { id: persistedState.userId } // Минимальный user объект для UX
    : current.user;

  return {
    ...current,
    ...persistedState,
    user: restoredUser,
    actions: current.actions,
  };
}
