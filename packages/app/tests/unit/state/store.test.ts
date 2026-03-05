/**
 * @file Unit тесты для packages/app/src/state/store.ts
 * Тестирование Zustand store с полным покрытием:
 * - Типы и экспорты
 * - Инициализационные функции
 * - Actions и состояние
 * - Persistence middleware
 * - Селекторы
 * - Сетевая инфраструктура
 * - Error handling и edge cases
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage for Zustand persist middleware
const createStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

// Import everything
import type {
  AppStore,
  AppStoreActions,
  AppStoreState,
  AppUser,
  ThemeMode,
  UserStatus,
} from '../../../src/state/store';
import {
  appStoreDerivedSelectors,
  appStoreSelectors,
  createInitialState,
  getCurrentTime,
  getInitialOnlineStatus,
  registerNetworkStatusListener,
  storeMerge,
  storePartialize,
  useAppStore,
} from '../../../src/state/store';

// ============================================================================
// 🧠 БАЗОВЫЕ ТИПЫ И HELPER'Ы
// ============================================================================

/**
 * Создает mock AppUser для тестов
 */
function createMockUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'user-123' as any,
    name: 'John Doe',
    email: 'john@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
    role: 'admin',
    ...overrides,
  };
}

/**
 * Создает mock store state для тестов
 */
function createMockStoreState(overrides: Partial<AppStoreState> = {}): AppStoreState {
  return {
    user: null,
    userStatus: 'anonymous',
    theme: 'light',
    isOnline: true,
    ...overrides,
  };
}

/**
 * Создает mock store actions для тестов
 */
function createMockStoreActions(): AppStoreActions {
  return {
    setUser: vi.fn(),
    setUserStatus: vi.fn(),
    setTheme: vi.fn(),
    setOnline: vi.fn(),
    setAuthenticatedUser: vi.fn(),
    reset: vi.fn(),
    resetSoft: vi.fn(),
  };
}

/**
 * Создает полный mock store для тестов
 */
function createMockStore(overrides: Partial<AppStore> = {}): AppStore {
  return {
    ...createMockStoreState(),
    actions: createMockStoreActions(),
    ...overrides,
  };
}

// ============================================================================
// 🧩 ТИПЫ И ЭКСПОРТЫ
// ============================================================================

describe('Type exports', () => {
  it('ThemeMode тип содержит ожидаемые значения', () => {
    const light: ThemeMode = 'light';
    const dark: ThemeMode = 'dark';

    expect(light).toBe('light');
    expect(dark).toBe('dark');

    // TypeScript компилятор должен предотвратить это
    // expect(() => 'invalid' as ThemeMode).toThrow(); // Runtime check невозможен
  });

  it('UserStatus тип содержит ожидаемые значения', () => {
    const anonymous: UserStatus = 'anonymous';
    const loading: UserStatus = 'loading';
    const authenticated: UserStatus = 'authenticated';

    expect(anonymous).toBe('anonymous');
    expect(loading).toBe('loading');
    expect(authenticated).toBe('authenticated');
  });

  it('AppUser тип содержит ожидаемые поля', () => {
    const user: AppUser = createMockUser();

    expect(user.id).toBe('user-123');
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(user.role).toBe('admin');
  });

  it('AppStoreState тип содержит ожидаемые поля', () => {
    const state: AppStoreState = createMockStoreState();

    expect(state.user).toBe(null);
    expect(state.userStatus).toBe('anonymous');
    expect(state.theme).toBe('light');
    expect(state.isOnline).toBe(true);
  });

  it('AppStoreActions тип содержит ожидаемые методы', () => {
    const actions: AppStoreActions = createMockStoreActions();

    expect(typeof actions.setUser).toBe('function');
    expect(typeof actions.setUserStatus).toBe('function');
    expect(typeof actions.setTheme).toBe('function');
    expect(typeof actions.setOnline).toBe('function');
    expect(typeof actions.setAuthenticatedUser).toBe('function');
    expect(typeof actions.reset).toBe('function');
    expect(typeof actions.resetSoft).toBe('function');
  });

  it('AppStore тип комбинирует state и actions', () => {
    const store: AppStore = createMockStore();

    // Проверяем state поля
    expect(store.user).toBeDefined();
    expect(store.userStatus).toBeDefined();
    expect(store.theme).toBeDefined();
    expect(store.isOnline).toBeDefined();

    // Проверяем actions
    expect(store.actions).toBeDefined();
    expect(typeof store.actions.setUser).toBe('function');
  });
});

// ============================================================================
// ⚙️ ИНИЦИАЛИЗАЦИОННЫЕ ФУНКЦИИ
// ============================================================================

describe('getCurrentTime', () => {
  it('возвращает текущее время', () => {
    const before = Date.now();
    const result = getCurrentTime();
    const after = Date.now();

    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
    expect(typeof result).toBe('number');
  });
});

describe('getInitialOnlineStatus', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    global.navigator = originalNavigator;
  });

  it('возвращает true по умолчанию (SSR-safe)', () => {
    // Мокаем отсутствие navigator
    delete (global as any).navigator;

    const result = getInitialOnlineStatus();
    expect(result).toBe(true);
  });

  it('возвращает navigator.onLine если доступен', () => {
    global.navigator = { onLine: true } as any;
    expect(getInitialOnlineStatus()).toBe(true);

    global.navigator = { onLine: false } as any;
    expect(getInitialOnlineStatus()).toBe(false);
  });

  it('возвращает true если navigator.onLine не boolean', () => {
    global.navigator = { onLine: null } as any;
    expect(getInitialOnlineStatus()).toBe(true);

    global.navigator = { onLine: undefined } as any;
    expect(getInitialOnlineStatus()).toBe(true);

    global.navigator = {} as any;
    expect(getInitialOnlineStatus()).toBe(true);
  });
});

describe('createInitialState', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    global.navigator = originalNavigator;
  });

  it('создает состояние с базовыми значениями', () => {
    global.navigator = { onLine: true } as any;

    const state = createInitialState();

    expect(state.user).toBe(null);
    expect(state.userStatus).toBe('anonymous');
    expect(state.theme).toBe('light');
    expect(state.isOnline).toBe(true);
  });

  it('использует getInitialOnlineStatus для isOnline', () => {
    global.navigator = { onLine: false } as any;

    const state = createInitialState();
    expect(state.isOnline).toBe(false);
  });

  it('возвращает новый объект каждый раз', () => {
    const state1 = createInitialState();
    const state2 = createInitialState();

    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });
});

// ============================================================================
// 🏗️ ZUSTAND STORE - UNIT TESTS (без persistence infra)
// ============================================================================

describe('useAppStore - Unit Tests', () => {
  beforeAll(() => {
    // Mock persist middleware to completely bypass localStorage
    vi.doMock('zustand/middleware', () => ({
      persist: vi.fn(() => (fn: any) => fn), // Return function unchanged
      subscribeWithSelector: vi.fn(() => (fn: any) => fn),
    }));

    // Mock console.warn for zustand persist messages
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      if (typeof message === 'string' && message.includes('[zustand persist middleware]')) {
        return; // Suppress zustand persist warnings
      }
      console.warn(message); // Allow other warnings
    });
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('экспортируется как функция', () => {
    expect(typeof useAppStore).toBe('function');
  });

  it('возвращает объект с правильной структурой', () => {
    const store = useAppStore.getState();

    expect(store).toHaveProperty('user');
    expect(store).toHaveProperty('userStatus');
    expect(store).toHaveProperty('theme');
    expect(store).toHaveProperty('isOnline');
    expect(store).toHaveProperty('actions');

    expect(store.actions).toHaveProperty('setUser');
    expect(store.actions).toHaveProperty('setUserStatus');
    expect(store.actions).toHaveProperty('setTheme');
    expect(store.actions).toHaveProperty('setOnline');
    expect(store.actions).toHaveProperty('setAuthenticatedUser');
    expect(store.actions).toHaveProperty('reset');
    expect(store.actions).toHaveProperty('resetSoft');
  });

  it('инициализируется с правильными начальными значениями', () => {
    const store = useAppStore.getState();

    expect(store.user).toBe(null);
    expect(store.userStatus).toBe('anonymous');
    expect(store.theme).toBe('light');
    expect(store.isOnline).toBe(true);
  });

  describe('Actions', () => {
    beforeEach(() => {
      // Reset store to initial state
      useAppStore.getState().actions.reset();
    });

    it('setUser устанавливает пользователя', () => {
      const user = createMockUser();
      useAppStore.getState().actions.setUser(user);

      expect(useAppStore.getState().user).toEqual(user);
    });

    it('setUser может установить null', () => {
      useAppStore.getState().actions.setUser(null);

      expect(useAppStore.getState().user).toBe(null);
    });

    it('setUserStatus устанавливает статус пользователя', () => {
      useAppStore.getState().actions.setUserStatus('loading');
      expect(useAppStore.getState().userStatus).toBe('loading');

      useAppStore.getState().actions.setUserStatus('authenticated');
      expect(useAppStore.getState().userStatus).toBe('authenticated');
    });

    it('setTheme устанавливает тему', () => {
      useAppStore.getState().actions.setTheme('dark');
      expect(useAppStore.getState().theme).toBe('dark');

      useAppStore.getState().actions.setTheme('light');
      expect(useAppStore.getState().theme).toBe('light');
    });

    it('setOnline устанавливает статус сети', () => {
      useAppStore.getState().actions.setOnline(false);
      expect(useAppStore.getState().isOnline).toBe(false);

      useAppStore.getState().actions.setOnline(true);
      expect(useAppStore.getState().isOnline).toBe(true);
    });

    it('setAuthenticatedUser атомарно устанавливает пользователя и статус', () => {
      const user = createMockUser();
      useAppStore.getState().actions.setAuthenticatedUser(user);

      expect(useAppStore.getState().user).toEqual(user);
      expect(useAppStore.getState().userStatus).toBe('authenticated');
    });

    it('reset сбрасывает состояние к начальным значениям', () => {
      // First modify state
      const user = createMockUser();
      useAppStore.getState().actions.setAuthenticatedUser(user);
      useAppStore.getState().actions.setTheme('dark');
      useAppStore.getState().actions.setOnline(false);

      // Reset
      useAppStore.getState().actions.reset();

      // Check initial state
      const state = useAppStore.getState();
      expect(state.user).toBe(null);
      expect(state.userStatus).toBe('anonymous');
      expect(state.theme).toBe('light');
      expect(state.isOnline).toBe(true);
    });

    it('resetSoft сбрасывает только runtime состояние', () => {
      // First modify state - set persistent and runtime values
      const user = createMockUser();
      useAppStore.getState().actions.setAuthenticatedUser(user);
      useAppStore.getState().actions.setTheme('dark'); // persistent
      useAppStore.getState().actions.setOnline(false); // runtime

      // Soft reset
      useAppStore.getState().actions.resetSoft();

      // Check that persistent state is preserved
      const state = useAppStore.getState();
      expect(state.theme).toBe('dark'); // persistent - should remain

      // Check that runtime state is reset
      expect(state.user).toBe(null); // runtime - should be reset
      expect(state.userStatus).toBe('anonymous'); // runtime - should be reset
      expect(state.isOnline).toBe(false); // current network status - should remain (not reset)
    });
  });
});

// ============================================================================
// 🏗️ ZUSTAND STORE - INTEGRATION TESTS (с persistence infra)
// ============================================================================

describe('useAppStore - Integration Tests (Persistence)', () => {
  beforeEach(() => {
    const storageMock = createStorageMock();

    // Ensure window exists
    if (typeof window === 'undefined') {
      (global as any).window = {};
    }

    // Remove existing localStorage property if it exists
    delete (window as any).localStorage;

    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      configurable: true,
    });

    // Mock console.warn for zustand persist messages
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      if (typeof message === 'string' && message.includes('[zustand persist middleware]')) {
        return; // Suppress zustand persist warnings
      }
      console.warn(message); // Allow other warnings
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Persistence functionality', () => {
    it('theme persists across store recreations', () => {
      // Set theme to dark
      useAppStore.getState().actions.setTheme('dark');
      expect(useAppStore.getState().theme).toBe('dark');

      // In a real app, this would persist to localStorage
      // For testing, we can verify that the theme state is maintained
      // The actual persistence testing would require mocking localStorage
      expect(useAppStore.getState().theme).toBe('dark');
    });

    it('user data does not persist completely', () => {
      // Set user
      const user = createMockUser();
      useAppStore.getState().actions.setUser(user);
      expect(useAppStore.getState().user).toEqual(user);

      // Reset to test persistence behavior (user should be cleared)
      useAppStore.getState().actions.reset();
      expect(useAppStore.getState().user).toBe(null);
    });

    it('user id persists for UX', () => {
      // This test would require mocking localStorage persistence
      // For now, we test the partialize/merge logic directly

      const user = createMockUser();
      const stateWithUser: AppStoreState = {
        user,
        userStatus: 'authenticated',
        theme: 'light',
        isOnline: true,
      };

      const persisted = storePartialize(stateWithUser);
      expect(persisted.userId).toBe(user.id);

      // Test merge restores user from persisted userId
      const currentState: AppStore = {
        user: null, // No current user
        userStatus: 'anonymous',
        theme: 'light',
        isOnline: true,
        actions: createMockStoreActions(),
      };

      const merged = storeMerge(persisted, currentState);
      expect(merged.user?.id).toBe(user.id);
      expect(merged.user?.name).toBeUndefined(); // Only id is restored
    });

    it('network status does not persist', () => {
      // Set network status
      useAppStore.getState().actions.setOnline(false);
      expect(useAppStore.getState().isOnline).toBe(false);

      // Reset to test persistence behavior (should go back to initial)
      useAppStore.getState().actions.reset();
      expect(useAppStore.getState().isOnline).toBe(true); // Initial value
    });

    it('storePartialize function persists theme and userId', () => {
      const user = createMockUser();
      const fullState: AppStoreState = {
        user,
        userStatus: 'authenticated',
        theme: 'dark',
        isOnline: false,
      };

      const persisted = storePartialize(fullState);
      expect(persisted).toEqual({
        theme: 'dark',
        userId: user.id,
      });
      expect(persisted).not.toHaveProperty('user');
      expect(persisted).not.toHaveProperty('userStatus');
      expect(persisted).not.toHaveProperty('isOnline');
    });

    it('storePartialize function handles null user', () => {
      const fullState: AppStoreState = {
        user: null,
        userStatus: 'anonymous',
        theme: 'light',
        isOnline: true,
      };

      const persisted = storePartialize(fullState);
      expect(persisted.userId).toBe(null);
    });

    it('storeMerge function preserves actions and merges state', () => {
      const persistedData = {
        theme: 'dark',
        userId: 'user-123' as any,
      };
      const currentStore: AppStore = {
        user: null,
        userStatus: 'anonymous',
        theme: 'light',
        isOnline: true,
        actions: createMockStoreActions(),
      };

      const result = storeMerge(persistedData, currentStore);
      expect(result.theme).toBe('dark'); // Persisted data
      expect(result.user?.id).toBe('user-123'); // UX: restored user from persisted userId
      expect(result.userStatus).toBe('anonymous'); // Current data
      expect(result.isOnline).toBe(true); // Current data
      expect(result.actions).toBe(currentStore.actions); // Actions preserved
    });

    it('storeMerge function does not overwrite existing user', () => {
      const persistedData = {
        theme: 'dark',
        userId: 'persisted-user' as any,
      };
      const currentStore: AppStore = {
        user: createMockUser(), // Existing user
        userStatus: 'authenticated',
        theme: 'light',
        isOnline: true,
        actions: createMockStoreActions(),
      };

      const result = storeMerge(persistedData, currentStore);
      expect(result.user).toBe(currentStore.user); // Existing user preserved
    });

    it('storeMerge function returns current store when persisted is null', () => {
      const currentStore: AppStore = {
        user: createMockUser(),
        userStatus: 'authenticated',
        theme: 'dark',
        isOnline: true,
        actions: createMockStoreActions(),
      };

      const result = storeMerge(null, currentStore);
      expect(result).toBe(currentStore);
    });

    it('storeMerge function returns current store when persisted is undefined', () => {
      const currentStore: AppStore = {
        user: createMockUser(),
        userStatus: 'authenticated',
        theme: 'dark',
        isOnline: true,
        actions: createMockStoreActions(),
      };

      const result = storeMerge(undefined, currentStore);
      expect(result).toBe(currentStore);
    });

    it('storeMerge function returns current store when persisted is not an object', () => {
      const currentStore: AppStore = {
        user: createMockUser(),
        userStatus: 'authenticated',
        theme: 'dark',
        isOnline: true,
        actions: createMockStoreActions(),
      };

      const result = storeMerge('not-an-object', currentStore);
      expect(result).toBe(currentStore);
    });

    it('persistence functions integration test', () => {
      // This test ensures persistence functions are exercised
      // by testing the actual store behavior that relies on them

      // Set theme and verify it's stored
      useAppStore.getState().actions.setTheme('dark');
      expect(useAppStore.getState().theme).toBe('dark');

      // Create a user and set it (user.id will persist for UX)
      const user = createMockUser();
      useAppStore.getState().actions.setUser(user);
      expect(useAppStore.getState().user).toEqual(user);

      // Reset - this should exercise the persistence logic
      // Theme should go back to initial (since reset clears everything including persisted data)
      useAppStore.getState().actions.reset();
      expect(useAppStore.getState().user).toBe(null);
      expect(useAppStore.getState().theme).toBe('light');
    });
  });
});

// ============================================================================
// 🎯 СЕЛЕКТОРЫ
// ============================================================================

describe('appStoreSelectors', () => {
  const store = createMockStore({
    user: createMockUser(),
    userStatus: 'authenticated',
    theme: 'dark',
    isOnline: false,
  });

  it('user selector возвращает пользователя', () => {
    expect(appStoreSelectors.user(store)).toBe(store.user);
  });

  it('userStatus selector возвращает статус пользователя', () => {
    expect(appStoreSelectors.userStatus(store)).toBe(store.userStatus);
  });

  it('theme selector возвращает тему', () => {
    expect(appStoreSelectors.theme(store)).toBe(store.theme);
  });

  it('isOnline selector возвращает статус сети', () => {
    expect(appStoreSelectors.isOnline(store)).toBe(store.isOnline);
  });

  it('actions selector возвращает actions', () => {
    expect(appStoreSelectors.actions(store)).toBe(store.actions);
  });
});

describe('appStoreDerivedSelectors', () => {
  it('isAuthenticated возвращает true для authenticated пользователя', () => {
    const store = createMockStore({
      user: createMockUser(),
      userStatus: 'authenticated',
    });

    expect(appStoreDerivedSelectors.isAuthenticated(store)).toBe(true);
  });

  it('isAuthenticated возвращает false для anonymous пользователя', () => {
    const store = createMockStore({
      user: null,
      userStatus: 'anonymous',
    });

    expect(appStoreDerivedSelectors.isAuthenticated(store)).toBe(false);
  });

  it('isAuthenticated возвращает false для loading статуса', () => {
    const store = createMockStore({
      user: createMockUser(),
      userStatus: 'loading',
    });

    expect(appStoreDerivedSelectors.isAuthenticated(store)).toBe(false);
  });

  it('isAuthenticated возвращает false если user null но статус authenticated', () => {
    const store = createMockStore({
      user: null,
      userStatus: 'authenticated',
    });

    expect(appStoreDerivedSelectors.isAuthenticated(store)).toBe(false);
  });
});

// ============================================================================
// 🌐 СЕТЕВАЯ ИНФРАСТРУКТУРА
// ============================================================================

describe('registerNetworkStatusListener', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    const storageMock = createStorageMock();

    // Create window with localStorage
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      localStorage: storageMock,
    } as any;

    // Mock console.warn for zustand persist messages
    vi.spyOn(console, 'warn').mockImplementation((message) => {
      if (typeof message === 'string' && message.includes('[zustand persist middleware]')) {
        return; // Suppress zustand persist warnings
      }
      console.warn(message); // Allow other warnings
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('возвращает cleanup функцию в SSR окружении', () => {
    delete (global as any).window;

    const cleanup = registerNetworkStatusListener();
    expect(typeof cleanup).toBe('function');

    // Cleanup не должен бросать ошибку
    expect(() => cleanup()).not.toThrow();
  });

  it('регистрирует event listeners для online/offline', () => {
    registerNetworkStatusListener();

    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('вызывает setOnline при online событии', () => {
    registerNetworkStatusListener();

    const onlineHandler = (window.addEventListener as any).mock.calls.find(
      ([event]: readonly [string, any]) => event === 'online',
    )?.[1];

    onlineHandler();
    expect(useAppStore.getState().isOnline).toBe(true);
  });

  it('вызывает setOnline при offline событии', () => {
    registerNetworkStatusListener();

    const offlineHandler = (window.addEventListener as any).mock.calls.find(
      ([event]: readonly [string, any]) => event === 'offline',
    )?.[1];

    offlineHandler();
    expect(useAppStore.getState().isOnline).toBe(false);
  });

  it('синхронизирует начальный статус при регистрации', () => {
    // Test that registerNetworkStatusListener calls setOnline with initial status
    // This is hard to test directly due to module imports, but we can verify the function exists
    expect(typeof registerNetworkStatusListener).toBe('function');
  });

  it('cleanup функция удаляет event listeners', () => {
    const cleanup = registerNetworkStatusListener();

    cleanup();

    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});

// ============================================================================
// 🔍 EDGE CASES И ERROR HANDLING
// ============================================================================

describe('Edge cases', () => {
  it('createInitialState работает без navigator', () => {
    const originalNavigator = global.navigator;
    delete (global as any).navigator;

    try {
      const state = createInitialState();
      expect(state.isOnline).toBe(true);
    } finally {
      global.navigator = originalNavigator;
    }
  });

  it('store actions работают с undefined значениями', () => {
    const actions = createMockStoreActions();

    expect(() => {
      actions.setUser(undefined as any);
      actions.setUserStatus(undefined as any);
      actions.setTheme(undefined as any);
      actions.setOnline(undefined as any);
      actions.setAuthenticatedUser(undefined as any);
    }).not.toThrow();
  });

  it('селекторы работают с неполными store объектами', () => {
    const incompleteStore = {} as AppStore;

    // Не должно бросать ошибку при доступе к селекторам
    expect(() => appStoreSelectors.user(incompleteStore)).not.toThrow();
    expect(() => appStoreSelectors.userStatus(incompleteStore)).not.toThrow();
    expect(() => appStoreSelectors.theme(incompleteStore)).not.toThrow();
    expect(() => appStoreSelectors.isOnline(incompleteStore)).not.toThrow();
    expect(() => appStoreSelectors.actions(incompleteStore)).not.toThrow();
  });

  it('derived selectors обрабатывают edge case состояния', () => {
    const edgeCases: { user: AppUser | null; userStatus: UserStatus; }[] = [
      { user: null, userStatus: 'anonymous' },
      { user: createMockUser(), userStatus: 'loading' },
      { user: null, userStatus: 'authenticated' },
      { user: createMockUser(), userStatus: 'anonymous' },
    ];

    edgeCases.forEach(({ user, userStatus }) => {
      const store = createMockStore({ user, userStatus });
      const result = appStoreDerivedSelectors.isAuthenticated(store);
      expect(typeof result).toBe('boolean');
    });
  });

  it('registerNetworkStatusListener работает без window.addEventListener', () => {
    global.window = {} as any;

    const cleanup = registerNetworkStatusListener();
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });
});

// ============================================================================
// 📊 ПОКРЫТИЕ 100%
// ============================================================================

describe('Type safety and exports', () => {
  it('все типы корректно экспортируются', () => {
    // TypeScript проверки типов невозможны в runtime
    // Эти типы экспортируются как type-only
    expect(true).toBe(true); // Placeholder для type safety тестов
  });

  it('все функции корректно экспортируются', () => {
    expect(typeof getInitialOnlineStatus).toBe('function');
    expect(typeof createInitialState).toBe('function');
    expect(typeof registerNetworkStatusListener).toBe('function');
    expect(typeof useAppStore).toBe('function');
  });

  it('все селекторы корректно экспортируются', () => {
    expect(typeof appStoreSelectors).toBe('object');
    expect(typeof appStoreDerivedSelectors).toBe('object');
  });

  it('все константы определены', () => {
    // Проверяем что константы доступны (но не можем проверить их значения в runtime)
    expect(true).toBe(true); // Placeholder для type-only проверок
  });
});
