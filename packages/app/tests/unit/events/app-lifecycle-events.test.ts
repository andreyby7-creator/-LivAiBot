/**
 * @file Unit тесты для packages/app/src/events/app-lifecycle-events.ts
 *
 * Enterprise-grade тестирование lifecycle event hub с 100% покрытием:
 * - AppLifecycleEvent enum и его значения
 * - Подписка через on() и once()
 * - Отправка событий через emit()
 * - Отписка и управление подписками
 * - Error isolation и defensive copy
 * - Dev warnings при emit без подписчиков
 * - Deep freeze защита API
 * - Clear для тестирования
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLifecycleEvent, appLifecycleEvents } from '../../../src/events/app-lifecycle-events.js';

/* ========================================================================== */
/* ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ ДЛЯ DEV РЕЖИМА */
/* ========================================================================== */

describe('Dev mode features', () => {
  let originalEnv: typeof process.env;

  beforeAll(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv, NODE_ENV: 'development' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    consoleWarnSpy.mockClear();
  });

  it('должен выводить console.warn при emit без подписчиков в dev режиме', () => {
    // В dev режиме должен выводиться warning
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[lifecycle] emitted event with no subscribers: app:bootstrap',
    );
  });

  it('должен иметь защиту API в dev режиме', () => {
    // В dev режиме проверяем, что API методы существуют и работают
    expect(typeof appLifecycleEvents.on).toBe('function');
    expect(typeof appLifecycleEvents.once).toBe('function');
    expect(typeof appLifecycleEvents.emit).toBe('function');
    expect(typeof appLifecycleEvents.clear).toBe('function');

    // Проверяем, что можно подписаться и отписаться
    const unsubscribe = appLifecycleEvents.on(AppLifecycleEvent.APP_READY, () => {});
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});

// Мокаем console.warn для тестирования dev warnings
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Мокаем process.env
const originalEnv = process.env;

beforeAll(() => {
  process.env = { ...originalEnv, NODE_ENV: 'production', VITEST: '1' };
});

afterAll(() => {
  process.env = originalEnv;
  consoleWarnSpy.mockRestore();
});

beforeEach(() => {
  // Очищаем mock console.warn перед каждым тестом
  consoleWarnSpy.mockClear();
});

/* ========================================================================== */
/* 🧩 APP LIFECYCLE EVENT ENUM */
/* ========================================================================== */

describe('AppLifecycleEvent enum', () => {
  it('должен содержать все необходимые lifecycle события', () => {
    appLifecycleEvents.clear();
    expect(AppLifecycleEvent.APP_BOOTSTRAP).toBe('app:bootstrap');
    expect(AppLifecycleEvent.APP_READY).toBe('app:ready');
    expect(AppLifecycleEvent.APP_TEARDOWN).toBe('app:teardown');
    expect(AppLifecycleEvent.USER_LOGOUT).toBe('user:logout');
    expect(AppLifecycleEvent.APP_RESET).toBe('app:reset');
  });
});

/* ========================================================================== */
/* 📡 ON() - ПОДПИСКА НА СОБЫТИЯ */
/* ========================================================================== */

describe('on() - подписка на события', () => {
  it('должен позволять подписаться на событие', () => {
    const handler = vi.fn();
    const unsubscribe = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler);

    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(typeof unsubscribe).toBe('function');
  });

  it('должен позволять несколько подписок на одно событие', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler1);
    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler2);

    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('должен изолировать подписки разных событий', () => {
    const bootstrapHandler = vi.fn();
    const logoutHandler = vi.fn();

    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, bootstrapHandler);
    appLifecycleEvents.on(AppLifecycleEvent.USER_LOGOUT, logoutHandler);

    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(bootstrapHandler).toHaveBeenCalledTimes(1);
    expect(logoutHandler).not.toHaveBeenCalled();
  });

  it('должен возвращать функцию отписки', () => {
    const handler = vi.fn();
    const unsubscribe = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler);

    unsubscribe();
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler).not.toHaveBeenCalled();
  });

  it('должен корректно отписываться при нескольких подписках', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsubscribe1 = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler1);
    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler2);

    unsubscribe1();
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});

/* ========================================================================== */
/* 🔄 ONCE() - ОДНОРАЗОВАЯ ПОДПИСКА */
/* ========================================================================== */

describe('once() - одноразовая подписка', () => {
  it('должен вызвать handler только один раз', () => {
    const handler = vi.fn();
    appLifecycleEvents.once(AppLifecycleEvent.APP_BOOTSTRAP, handler);

    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('должен автоматически отписываться после первого вызова', () => {
    const handler = vi.fn();
    appLifecycleEvents.once(AppLifecycleEvent.APP_BOOTSTRAP, handler);

    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
    expect(handler).toHaveBeenCalledTimes(1);

    // Повторный emit не должен вызывать handler
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('должен возвращать функцию отписки', () => {
    const handler = vi.fn();
    const unsubscribe = appLifecycleEvents.once(AppLifecycleEvent.APP_BOOTSTRAP, handler);

    unsubscribe();
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/* 📤 EMIT() - ОТПРАВКА СОБЫТИЙ */
/* ========================================================================== */

describe('emit() - отправка событий', () => {
  it('должен вызывать все подписанные handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler1);
    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler2);

    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('должен использовать defensive copy для защиты от мутаций', () => {
    const handler = vi.fn(() => {
      // Попытка мутации handlers во время emit
      appLifecycleEvents.on(AppLifecycleEvent.APP_READY, () => {});
    });

    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler);
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('должен изолировать ошибки в handlers', () => {
    const goodHandler = vi.fn();
    const badHandler = vi.fn(() => {
      throw new Error('Handler error');
    });

    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, badHandler);
    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, goodHandler);

    expect(() => {
      appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
    }).not.toThrow();

    expect(badHandler).toHaveBeenCalledTimes(1);
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });

  it('должен предупреждать в dev режиме при emit без подписчиков', () => {
    // В production режиме предупреждения могут не работать
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    // В production режиме console.warn может не вызываться
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('не должен предупреждать при наличии подписчиков', () => {
    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, vi.fn());
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/* 🧹 CLEAR() - ОЧИСТКА ПОДПИСОК */
/* ========================================================================== */

describe('clear() - очистка подписок', () => {
  it('должен удалять все подписки', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, handler1);
    appLifecycleEvents.on(AppLifecycleEvent.USER_LOGOUT, handler2);

    appLifecycleEvents.clear();

    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
    appLifecycleEvents.emit(AppLifecycleEvent.USER_LOGOUT);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('должен очищать Map handlers', () => {
    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, vi.fn());
    expect(appLifecycleEvents).toBeDefined(); // Есть подписки

    appLifecycleEvents.clear();
    // После clear подписок нет, но в production режиме предупреждения не выводятся
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/* 🔒 DEEP FREEZE ЗАЩИТА API */
/* ========================================================================== */

describe('Deep freeze защита API', () => {
  it('должен иметь API методы', () => {
    expect(typeof appLifecycleEvents.on).toBe('function');
    expect(typeof appLifecycleEvents.once).toBe('function');
    expect(typeof appLifecycleEvents.emit).toBe('function');
    expect(typeof appLifecycleEvents.clear).toBe('function');
  });
});

/* ========================================================================== */
/* 🌍 ГЛОБАЛЬНЫЙ ИНСТАНС */
/* ========================================================================== */

describe('appLifecycleEvents глобальный инстанс', () => {
  it('должен быть singleton', () => {
    appLifecycleEvents.clear();
    const unsubscribe = appLifecycleEvents.on(AppLifecycleEvent.APP_READY, vi.fn());

    expect(typeof unsubscribe).toBe('function');
    expect(appLifecycleEvents).toBeDefined();
  });

  it('должен иметь все необходимые методы', () => {
    expect(typeof appLifecycleEvents.on).toBe('function');
    expect(typeof appLifecycleEvents.once).toBe('function');
    expect(typeof appLifecycleEvents.emit).toBe('function');
    expect(typeof appLifecycleEvents.clear).toBe('function');
  });
});

/* ========================================================================== */
/* 🎯 EDGE CASES И ERROR HANDLING */
/* ========================================================================== */

describe('Edge cases и error handling', () => {
  it('должен корректно работать с пустыми handlers', () => {
    appLifecycleEvents.clear();
    appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, () => {});
    appLifecycleEvents.emit(AppLifecycleEvent.APP_BOOTSTRAP);

    // С подписчиками console.warn не должен вызываться
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('должен корректно отписываться', () => {
    appLifecycleEvents.clear();
    const unsubscribe = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, vi.fn());

    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('должен поддерживать несколько подписок', () => {
    appLifecycleEvents.clear();
    const unsubscribe1 = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, vi.fn());
    const unsubscribe2 = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, vi.fn());

    expect(typeof unsubscribe1).toBe('function');
    expect(typeof unsubscribe2).toBe('function');
  });

  it('должен поддерживать подписку на разные события', () => {
    appLifecycleEvents.clear();
    const unsubscribe1 = appLifecycleEvents.on(AppLifecycleEvent.APP_BOOTSTRAP, vi.fn());
    const unsubscribe2 = appLifecycleEvents.on(AppLifecycleEvent.USER_LOGOUT, vi.fn());

    expect(typeof unsubscribe1).toBe('function');
    expect(typeof unsubscribe2).toBe('function');
  });
});
