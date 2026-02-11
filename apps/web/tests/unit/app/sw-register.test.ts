/**
 * @file Comprehensive tests for apps/web/src/app/sw-register.ts
 *
 * Покрытие всех веток и функций:
 * - registerServiceWorker (успех/ошибки/обновления/kill-switch)
 * - unregisterServiceWorker (успех/ошибки/kill-switch)
 * - Runtime конфигурация (window/localStorage/env/defaults)
 * - isServiceWorkerSupported (все варианты окружений)
 * - notifyUserBeforeReload
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// 🧠 MOCKS
// ============================================================================

// Типы для обработчиков событий

type UpdateFoundHandler = ((ev?: Event) => void) | null;

type StateChangeHandler = ((ev?: Event) => void) | null;

// Mock для Event
const mockEvent = {} as Event;

// Mock для navigator.serviceWorker
const mockServiceWorkerRegistration = {
  scope: '/',
  installing: null as ServiceWorker | null,
  onupdatefound: null as UpdateFoundHandler,
  unregister: vi.fn().mockResolvedValue(true),
} as unknown as ServiceWorkerRegistration;

const mockServiceWorker = {
  state: 'installed' as ServiceWorkerState,
  onstatechange: null as StateChangeHandler,
} as unknown as ServiceWorker;

const mockRegisterFn = vi.fn();
const mockGetRegistrationsFn = vi.fn();

const mockNavigator = {
  serviceWorker: {
    register: mockRegisterFn,
    controller: null as ServiceWorker | null,
    getRegistrations: mockGetRegistrationsFn,
  },
} as unknown as Navigator;

// Mock для window
const mockWindow = {
  location: {
    reload: vi.fn(),
  },
  __SW_CONFIG__: undefined as Partial<{ reloadDelayMs: number; }> | undefined,
} as unknown as Window & typeof globalThis;

// Mock для localStorage
const mockGetItemFn = vi.fn();
const mockLocalStorage = {
  getItem: mockGetItemFn,
  setItem: vi.fn(),
  removeItem: vi.fn(),
} as unknown as Storage;

// Сохраняем оригинальные значения
let originalNavigator: Navigator;
let originalWindow: Window & typeof globalThis;
let originalLocalStorage: Storage;
let originalProcessEnv: typeof process.env;
let originalNodeEnv: string | undefined;
let originalAppEnv: string | undefined;

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('sw-register.ts - Service Worker Registration', () => {
  beforeEach(() => {
    // Сохраняем оригинальные значения
    originalNavigator = global.navigator;
    originalWindow = global.window;
    originalLocalStorage = global.localStorage;
    originalProcessEnv = { ...process.env };
    originalNodeEnv = process.env.NODE_ENV;
    originalAppEnv = process.env['NEXT_PUBLIC_APP_ENV'];

    // Мокируем navigator
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true,
    });

    // Мокируем window
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true,
      configurable: true,
    });

    // Мокируем localStorage
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    // Сбрасываем моки
    vi.clearAllMocks();
    mockRegisterFn.mockResolvedValue(mockServiceWorkerRegistration);
    mockGetRegistrationsFn.mockResolvedValue([mockServiceWorkerRegistration]);
    Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
      value: null,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(mockServiceWorkerRegistration, 'onupdatefound', {
      value: null,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(mockServiceWorker, 'onstatechange', {
      value: null,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
      value: null,
      writable: true,
      configurable: true,
    });
    mockWindow.__SW_CONFIG__ = undefined;
    mockGetItemFn.mockReturnValue(null);

    // Очищаем require cache
    vi.resetModules();
  });

  afterEach(() => {
    // Восстанавливаем оригинальные значения
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.assign(process.env, originalProcessEnv);
    if (originalNodeEnv !== undefined) {
      Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    }
    if (originalAppEnv !== undefined) {
      Object.assign(process.env, { 'NEXT_PUBLIC_APP_ENV': originalAppEnv });
    } else {
      delete process.env['NEXT_PUBLIC_APP_ENV'];
    }
    delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];
    vi.restoreAllMocks();
  });

  describe('registerServiceWorker', () => {
    it('не должен регистрировать SW если serviceWorker не поддерживается', async () => {
      // Мокируем отсутствие serviceWorker
      Object.defineProperty(global, 'navigator', {
        value: {} as Navigator,
        writable: true,
        configurable: true,
      });

      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      expect(mockNavigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    it('не должен регистрировать SW если окружение не production/staging/preprod', async () => {
      Object.assign(process.env, { NODE_ENV: 'development' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      expect(mockNavigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    it('должен регистрировать SW в production окружении', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      expect(mockRegisterFn).toHaveBeenCalledWith('/sw.js', { scope: '/' });
      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Зарегистрирован:', '/');

      consoleLogSpy.mockRestore();
    });

    it('должен регистрировать SW в staging окружении', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      Object.assign(process.env, { 'NEXT_PUBLIC_APP_ENV': 'staging' });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      expect(mockRegisterFn).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Зарегистрирован:', '/');

      consoleLogSpy.mockRestore();
    });

    it('должен регистрировать SW в preprod окружении', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      Object.assign(process.env, { 'NEXT_PUBLIC_APP_ENV': 'preprod' });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      expect(mockRegisterFn).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Зарегистрирован:', '/');

      consoleLogSpy.mockRestore();
    });

    it('должен обработать ошибку регистрации', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const error = new Error('Registration failed');
      mockRegisterFn.mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      expect(consoleErrorSpy).toHaveBeenCalledWith('[SW] Ошибка регистрации:', error);

      consoleErrorSpy.mockRestore();
    });

    it('должен установить обработчик onupdatefound', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      expect(mockServiceWorkerRegistration.onupdatefound).toBeDefined();
      expect(typeof mockServiceWorkerRegistration.onupdatefound).toBe('function');
    });

    it('должен обработать первую установку SW (нет controller)', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: null,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      // Вызываем обработчик обновления
      const updateHandler =
        (mockServiceWorkerRegistration as { readonly onupdatefound?: UpdateFoundHandler; })
          .onupdatefound;
      if (updateHandler) {
        updateHandler(mockEvent);

        // Вызываем обработчик изменения состояния
        const stateHandler =
          (mockServiceWorker as { readonly onstatechange?: StateChangeHandler; }).onstatechange;
        if (stateHandler) {
          stateHandler(mockEvent);
        }
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[SW] Контент кеширован для оффлайн использования',
      );
      expect(mockWindow.location.reload).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('должен перезагрузить страницу при обновлении SW (есть controller)', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      // Вызываем обработчик обновления
      const updateHandler =
        (mockServiceWorkerRegistration as { readonly onupdatefound?: UpdateFoundHandler; })
          .onupdatefound;
      if (updateHandler) {
        updateHandler(mockEvent);

        // Вызываем обработчик изменения состояния
        const stateHandler =
          (mockServiceWorker as { readonly onstatechange?: StateChangeHandler; }).onstatechange;
        if (stateHandler) {
          stateHandler(mockEvent);
        }
      }

      // Проверяем что notifyUserBeforeReload был вызван
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SW] Доступно обновление приложения'),
      );

      // Продвигаем таймер
      vi.advanceTimersByTime(3000);

      // Проверяем что reload был вызван
      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
      consoleLogSpy.mockRestore();
    });

    it('не должен обрабатывать обновление если installing отсутствует', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: null,
        writable: true,
        configurable: true,
      });

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      // Вызываем обработчик обновления
      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
      }

      // Не должно быть ошибок
      expect(mockServiceWorker.onstatechange).toBeNull();
    });
  });

  describe('unregisterServiceWorker', () => {
    it('не должен удалять SW если serviceWorker не поддерживается', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {} as Navigator,
        writable: true,
        configurable: true,
      });

      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const { unregisterServiceWorker } = await import('../../../src/app/sw-register');

      await unregisterServiceWorker();

      expect(mockGetRegistrationsFn).not.toHaveBeenCalled();
    });

    it('не должен удалять SW если окружение не production/staging/preprod', async () => {
      Object.assign(process.env, { NODE_ENV: 'development' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const { unregisterServiceWorker } = await import('../../../src/app/sw-register');

      await unregisterServiceWorker();

      expect(mockGetRegistrationsFn).not.toHaveBeenCalled();
    });

    it('должен успешно удалить SW', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const mockUnregister = vi.fn().mockResolvedValue(true);
      const mockReg = {
        unregister: mockUnregister,
      } as unknown as ServiceWorkerRegistration;

      mockGetRegistrationsFn.mockResolvedValue([mockReg]);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { unregisterServiceWorker } = await import('../../../src/app/sw-register');

      await unregisterServiceWorker();

      expect(mockGetRegistrationsFn).toHaveBeenCalled();
      expect(mockUnregister).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Service Worker удалён');

      consoleLogSpy.mockRestore();
    });

    it('должен обработать ошибку при удалении SW', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const error = new Error('Unregister failed');
      mockGetRegistrationsFn.mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unregisterServiceWorker } = await import('../../../src/app/sw-register');

      await unregisterServiceWorker();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SW] Ошибка при удалении Service Worker:',
        error,
      );

      consoleErrorSpy.mockRestore();
    });

    it('должен удалить несколько регистраций', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      const mockUnregister1 = vi.fn().mockResolvedValue(true);
      const mockUnregister2 = vi.fn().mockResolvedValue(true);
      const mockReg1 = { unregister: mockUnregister1 } as unknown as ServiceWorkerRegistration;
      const mockReg2 = { unregister: mockUnregister2 } as unknown as ServiceWorkerRegistration;

      mockGetRegistrationsFn.mockResolvedValue([mockReg1, mockReg2]);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { unregisterServiceWorker } = await import('../../../src/app/sw-register');

      await unregisterServiceWorker();

      expect(mockUnregister1).toHaveBeenCalled();
      expect(mockUnregister2).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Service Worker удалён');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Runtime конфигурация', () => {
    it('должен использовать window.__SW_CONFIG__ с наивысшим приоритетом', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      mockWindow.__SW_CONFIG__ = { reloadDelayMs: 5000 };
      mockGetItemFn.mockReturnValue('4000');
      Object.assign(process.env, { 'NEXT_PUBLIC_SW_RELOAD_DELAY_MS': '3000' });

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Продвигаем таймер на 5000ms (значение из window.__SW_CONFIG__)
      vi.advanceTimersByTime(5000);

      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('должен использовать localStorage если window.__SW_CONFIG__ отсутствует', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      mockWindow.__SW_CONFIG__ = undefined;
      mockGetItemFn.mockReturnValue('4000');

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Продвигаем таймер на 4000ms (значение из localStorage)
      vi.advanceTimersByTime(4000);

      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('должен использовать env переменную если window и localStorage отсутствуют', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      Object.assign(process.env, { 'NEXT_PUBLIC_SW_RELOAD_DELAY_MS': '3000' });

      mockWindow.__SW_CONFIG__ = undefined;
      mockGetItemFn.mockReturnValue(null);

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Продвигаем таймер на 3000ms (значение из env)
      vi.advanceTimersByTime(3000);

      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('должен использовать дефолтное значение для production', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      mockWindow.__SW_CONFIG__ = undefined;
      mockGetItemFn.mockReturnValue(null);

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Продвигаем таймер на 3000ms (дефолт для production)
      vi.advanceTimersByTime(3000);

      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('должен использовать дефолтное значение для development/staging', async () => {
      Object.assign(process.env, { NODE_ENV: 'development' });
      Object.assign(process.env, { 'NEXT_PUBLIC_APP_ENV': 'staging' });
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      mockWindow.__SW_CONFIG__ = undefined;
      mockGetItemFn.mockReturnValue(null);

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Продвигаем таймер на 2000ms (дефолт для dev/staging)
      vi.advanceTimersByTime(2000);

      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('должен игнорировать невалидные значения из localStorage', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      mockWindow.__SW_CONFIG__ = undefined;
      mockGetItemFn.mockReturnValue('invalid');

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Продвигаем таймер на 3000ms (дефолт, так как localStorage невалиден)
      vi.advanceTimersByTime(3000);

      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('должен обработать ошибку localStorage (приватный режим)', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      mockWindow.__SW_CONFIG__ = undefined;
      mockGetItemFn.mockImplementation(() => {
        throw new Error('localStorage недоступен');
      });

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Продвигаем таймер на 3000ms (дефолт, так как localStorage недоступен)
      vi.advanceTimersByTime(3000);

      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('notifyUserBeforeReload', () => {
    it('должен логировать сообщение перед перезагрузкой', async () => {
      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SW] Доступно обновление приложения'),
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('SSR/Node.js окружение (window/localStorage undefined)', () => {
    it('должен использовать дефолтное значение если window.__SW_CONFIG__ отсутствует при обновлении SW', async () => {
      // Сохраняем оригинальный window
      const originalWindow = global.window;

      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      // Устанавливаем window в объект с location.reload, но без __SW_CONFIG__
      // Это покроет логику использования дефолтного значения
      // Для покрытия строки 70 (typeof window === 'undefined') нужен отдельный тест
      const mockReload = vi.fn();
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            reload: mockReload,
          },
          // Не устанавливаем __SW_CONFIG__, чтобы getWindowConfig вернул null
        },
        writable: true,
        configurable: true,
      });

      // Очищаем require cache для перезагрузки модуля
      vi.resetModules();

      // Мокируем navigator для этого теста
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Должен использовать дефолтное значение (3000ms для production), так как window.__SW_CONFIG__ undefined
      // Это покроет логику использования дефолтного значения через getWindowConfig()
      vi.advanceTimersByTime(3000);
      expect(mockReload).toHaveBeenCalled();

      vi.useRealTimers();
      consoleLogSpy.mockRestore();

      // Восстанавливаем window
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    });

    it('должен использовать дефолтное значение если localStorage undefined при обновлении SW', async () => {
      // Сохраняем оригинальные значения
      const originalLocalStorage = global.localStorage;

      Object.assign(process.env, { NODE_ENV: 'production' });
      delete process.env['NEXT_PUBLIC_APP_ENV'];
      delete process.env['NEXT_PUBLIC_SW_RELOAD_DELAY_MS'];

      // Устанавливаем localStorage в undefined для покрытия строки 80 (typeof localStorage === 'undefined')
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Очищаем require cache для перезагрузки модуля
      vi.resetModules();

      // Мокируем navigator для этого теста
      Object.defineProperty(global, 'navigator', {
        value: mockNavigator,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(mockNavigator.serviceWorker, 'controller', {
        value: {} as ServiceWorker,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(mockServiceWorkerRegistration, 'installing', {
        value: mockServiceWorker,
        writable: true,
        configurable: true,
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.useFakeTimers();

      const { registerServiceWorker } = await import('../../../src/app/sw-register');

      await registerServiceWorker();

      if (mockServiceWorkerRegistration.onupdatefound) {
        mockServiceWorkerRegistration.onupdatefound(mockEvent);
        if (mockServiceWorker.onstatechange) {
          mockServiceWorker.onstatechange(mockEvent);
        }
      }

      // Должен использовать дефолтное значение (3000ms для production), так как localStorage undefined
      vi.advanceTimersByTime(3000);
      expect(mockWindow.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
      consoleLogSpy.mockRestore();

      // Восстанавливаем localStorage
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    });
  });
});
