// packages/app/tests/unit/background/tasks.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect, Runtime } from 'effect';

// Mock telemetry before any other imports
vi.mock('../../../src/runtime/telemetry.js', () => ({
  getGlobalTelemetryClient: vi.fn(() => ({
    startSpan: vi.fn(),
    endSpan: vi.fn(),
    recordMetric: vi.fn(),
  })),
}));

// Mock eventBus
vi.mock('../../../src/events/event-bus.js', () => ({
  ConsoleLogger: vi.fn(),
  eventBus: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(),
  },
}));

// Mock getGlobalScheduler
vi.mock('../../../src/background/scheduler.js', () => ({
  ENV: {},
  getGlobalScheduler: vi.fn(),
}));

import {
  backgroundTasks,
  PermanentError,
  startBackgroundTasks,
  stopBackgroundTasks,
  TaskError,
  TransientError,
} from '../../../src/background/tasks.js';
import { ENV, getGlobalScheduler } from '../../../src/background/scheduler.js';
import { AppEventType } from '../../../src/events/app-events.js';

/* ========================================================================== */
/* 🔧 Моки Scheduler / Metrics */
/* ========================================================================== */
let mockScheduler: any;

beforeEach(() => {
  mockScheduler = {
    schedule: vi.fn().mockImplementation((task) => Effect.sync(() => task)),
    enqueueTaskMetric: vi.fn().mockImplementation(() => Effect.sync(() => undefined)),
    interrupt: vi.fn().mockImplementation(() => Effect.sync(() => undefined)),
  };

  // Настраиваем mock getGlobalScheduler
  vi.mocked(getGlobalScheduler).mockReturnValue(Effect.succeed(mockScheduler));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ========================================================================== */
/* 📦 DI MOCKS */
/* ========================================================================== */
const createDI = () => ({
  offlineCache: {
    refresh: vi.fn().mockImplementation(() => Effect.sync(() => undefined)),
    sync: vi.fn().mockImplementation(() => Effect.sync(() => undefined)),
  },
  authService: {
    refreshToken: vi.fn().mockImplementation(() => Effect.sync(() => undefined)),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

/* ========================================================================== */
/* 🧪 TESTS */
/* ========================================================================== */
describe('Background Tasks', () => {
  describe('createTasks()', () => {
    it('создает cache-refresh задачу если ENABLE_CACHE_REFRESH=true', () => {
      ENV.ENABLE_CACHE_REFRESH = true;
      const di = createDI();
      const tasks = backgroundTasks.createTasks(di);
      const task = tasks.find((t) => t.id === 'cache-refresh');
      expect(task).toBeDefined();
      expect(task?.priority).toBe('medium');
    });

    it('не создает cache-refresh задачу если ENABLE_CACHE_REFRESH=false', () => {
      ENV.ENABLE_CACHE_REFRESH = false;
      const di = createDI();
      const tasks = backgroundTasks.createTasks(di);
      const task = tasks.find((t) => t.id === 'cache-refresh');
      expect(task).toBeUndefined();
    });

    it('создает cache-sync и cache-sync-login задачи если ENABLE_CACHE_SYNC=true', () => {
      ENV.ENABLE_CACHE_SYNC = true;
      const di = createDI();
      const tasks = backgroundTasks.createTasks(di);
      expect(tasks.find((t) => t.id === 'cache-sync')).toBeDefined();
      expect(tasks.find((t) => t.id === 'cache-sync-login')).toBeDefined();
    });

    it('создает auth-refresh задачу если ENABLE_AUTH_REFRESH=true', () => {
      ENV.ENABLE_AUTH_REFRESH = true;
      const di = createDI();
      const tasks = backgroundTasks.createTasks(di);
      expect(tasks.find((t) => t.id === 'auth-refresh')).toBeDefined();
    });

    it('все задачи используют enqueueMetric при выполнении', async () => {
      ENV.ENABLE_CACHE_REFRESH = true;
      const metrics: Record<string, number> = {};
      const di = createDI();
      (di as any).enqueueMetric = vi.fn().mockImplementation((name, value) =>
        Effect.sync(() => {
          metrics[name] = Number(value);
        })
      );

      const tasks = backgroundTasks.createTasks(di);
      const cacheTask = tasks.find((t) => t.id === 'cache-refresh');
      expect(cacheTask).toBeDefined();

      await Runtime.runPromise(
        Runtime.defaultRuntime,
        cacheTask!.task(new AbortController().signal),
      );
      expect((di as any).enqueueMetric).toHaveBeenCalled();
      expect(metrics['task.cache-refresh.success']).toBe(1);
    });

    it('бросает ошибку и записывает error метрику', async () => {
      ENV.ENABLE_CACHE_REFRESH = true;
      const di = createDI();
      di.offlineCache.refresh = vi.fn().mockImplementation(() => {
        throw new TaskError('cache-refresh');
      });
      (di as any).enqueueMetric = vi.fn().mockImplementation((
        _name: string,
        _value: number | string,
      ) =>
        Effect.sync(() => {
          // Track that enqueueMetric was called
        })
      );

      const tasks = backgroundTasks.createTasks(di);
      const cacheTask = tasks.find((t) => t.id === 'cache-refresh');

      try {
        await Runtime.runPromise(
          Runtime.defaultRuntime,
          cacheTask!.task(new AbortController().signal),
        );
        expect.fail('Expected task to throw');
      } catch (error: any) {
        // Effect wraps the original error in FiberFailure, check the message
        expect(error.message).toContain('Task cache-refresh failed');
      }
      expect((di as any).enqueueMetric).toHaveBeenCalledWith('task.cache-refresh.error', 1);
    });

    it('cache-sync задача использует enqueueMetric при выполнении', async () => {
      ENV.ENABLE_CACHE_SYNC = true;
      const metrics: Record<string, number> = {};
      const di = createDI();
      (di as any).enqueueMetric = vi.fn().mockImplementation((
        name: string,
        value: number | string,
      ) =>
        Effect.sync(() => {
          metrics[name] = Number(value);
        })
      );

      const tasks = backgroundTasks.createTasks(di);
      const syncTask = tasks.find((t) => t.id === 'cache-sync');
      expect(syncTask).toBeDefined();
      expect(syncTask?.priority).toBe('low');

      await Runtime.runPromise(
        Runtime.defaultRuntime,
        syncTask!.task(new AbortController().signal),
      );
      expect((di as any).enqueueMetric).toHaveBeenCalled();
      expect(metrics['task.cache-sync.success']).toBe(1);
    });

    it('cache-sync задача записывает error метрику при ошибке', async () => {
      ENV.ENABLE_CACHE_SYNC = true;
      const di = createDI();
      di.offlineCache.sync = vi.fn().mockImplementation(() => {
        throw new TaskError('cache-sync');
      });
      (di as any).enqueueMetric = vi.fn().mockImplementation(() => Effect.sync(() => undefined));

      const tasks = backgroundTasks.createTasks(di);
      const syncTask = tasks.find((t) => t.id === 'cache-sync');

      try {
        await Runtime.runPromise(
          Runtime.defaultRuntime,
          syncTask!.task(new AbortController().signal),
        );
        expect.fail('Expected task to throw');
      } catch (error: any) {
        expect(error.message).toContain('Task cache-sync failed');
      }
      expect((di as any).enqueueMetric).toHaveBeenCalledWith('task.cache-sync.error', 1);
    });

    it('cache-sync-login задача использует enqueueMetric при выполнении', async () => {
      ENV.ENABLE_CACHE_SYNC = true;
      const metrics: Record<string, number> = {};
      const di = createDI();
      (di as any).enqueueMetric = vi.fn().mockImplementation((
        name: string,
        value: number | string,
      ) =>
        Effect.sync(() => {
          metrics[name] = Number(value);
        })
      );

      const tasks = backgroundTasks.createTasks(di);
      const syncLoginTask = tasks.find((t) => t.id === 'cache-sync-login');
      expect(syncLoginTask).toBeDefined();
      expect(syncLoginTask?.priority).toBe('high');
      expect(syncLoginTask?.triggerEvent).toBe(AppEventType.AuthLogin);

      await Runtime.runPromise(
        Runtime.defaultRuntime,
        syncLoginTask!.task(new AbortController().signal),
      );
      expect((di as any).enqueueMetric).toHaveBeenCalled();
      expect(metrics['task.cache-sync-login.success']).toBe(1);
    });

    it('auth-refresh задача использует enqueueMetric при выполнении', async () => {
      ENV.ENABLE_AUTH_REFRESH = true;
      const metrics: Record<string, number> = {};
      const di = createDI();
      (di as any).enqueueMetric = vi.fn().mockImplementation((
        name: string,
        value: number | string,
      ) =>
        Effect.sync(() => {
          metrics[name] = Number(value);
        })
      );

      const tasks = backgroundTasks.createTasks(di);
      const authTask = tasks.find((t) => t.id === 'auth-refresh');
      expect(authTask).toBeDefined();
      expect(authTask?.priority).toBe('high');

      await Runtime.runPromise(
        Runtime.defaultRuntime,
        authTask!.task(new AbortController().signal),
      );
      expect((di as any).enqueueMetric).toHaveBeenCalled();
      expect(metrics['task.auth-refresh.success']).toBe(1);
    });

    it('cache-sync-login задача записывает error метрику при ошибке', async () => {
      ENV.ENABLE_CACHE_SYNC = true;
      const di = createDI();
      di.offlineCache.sync = vi.fn().mockImplementation(() => {
        throw new TaskError('cache-sync-login');
      });
      (di as any).enqueueMetric = vi.fn().mockImplementation(() => Effect.sync(() => undefined));

      const tasks = backgroundTasks.createTasks(di);
      const syncLoginTask = tasks.find((t) => t.id === 'cache-sync-login');

      try {
        await Runtime.runPromise(
          Runtime.defaultRuntime,
          syncLoginTask!.task(new AbortController().signal),
        );
        expect.fail('Expected task to throw');
      } catch (error: any) {
        expect(error.message).toContain('Task cache-sync-login failed');
      }
      expect((di as any).enqueueMetric).toHaveBeenCalledWith('task.cache-sync-login.error', 1);
    });

    it('auth-refresh задача записывает error метрику при ошибке', async () => {
      ENV.ENABLE_AUTH_REFRESH = true;
      const di = createDI();
      di.authService.refreshToken = vi.fn().mockImplementation(() => {
        throw new TaskError('auth-refresh');
      });
      (di as any).enqueueMetric = vi.fn().mockImplementation(() => Effect.sync(() => undefined));

      const tasks = backgroundTasks.createTasks(di);
      const authTask = tasks.find((t) => t.id === 'auth-refresh');

      try {
        await Runtime.runPromise(
          Runtime.defaultRuntime,
          authTask!.task(new AbortController().signal),
        );
        expect.fail('Expected task to throw');
      } catch (error: any) {
        expect(error.message).toContain('Task auth-refresh failed');
      }
      expect((di as any).enqueueMetric).toHaveBeenCalledWith('task.auth-refresh.error', 1);
    });
  });

  describe('Error Classes', () => {
    it('TaskError работает корректно', () => {
      const err = new TaskError('id123', 'cause');
      expect(err.taskId).toBe('id123');
      expect(err.cause).toBe('cause');
      expect(err.message).toContain('id123');
    });

    it('TransientError наследует TaskError', () => {
      const err = new TransientError('t', 'cause');
      expect(err).toBeInstanceOf(TaskError);
    });

    it('PermanentError наследует TaskError', () => {
      const err = new PermanentError('t', 'cause');
      expect(err).toBeInstanceOf(TaskError);
    });
  });

  describe('initBackgroundTasks()', () => {
    it('вызывает schedule и записывает метрики', async () => {
      ENV.ENABLE_CACHE_REFRESH = true;
      const di = createDI();
      const s = mockScheduler;
      vi.mocked(getGlobalScheduler).mockReturnValue(Effect.sync(() => s));

      await Runtime.runPromise(Runtime.defaultRuntime)(
        backgroundTasks.initBackgroundTasks(di) as any,
      );

      expect(s.schedule).toHaveBeenCalled();
      expect(s.enqueueTaskMetric).toHaveBeenCalledWith('task.registered:cache-refresh', 1);
    });

    it('обогащает DI и задачи используют scheduler для метрик', async () => {
      ENV.ENABLE_CACHE_REFRESH = true;
      const di = createDI();
      const scheduledTasks: any[] = [];

      const s = {
        ...mockScheduler,
        // Переопределяем schedule чтобы сохранить задачу для ручного выполнения
        schedule: vi.fn().mockImplementation((task) => {
          scheduledTasks.push(task);
          return Effect.sync(() => undefined);
        }),
      };
      vi.mocked(getGlobalScheduler).mockReturnValue(Effect.sync(() => s));

      // Убираем enqueueMetric из DI чтобы обогащение вступило в силу
      delete (di as any).enqueueMetric;

      await Runtime.runPromise(Runtime.defaultRuntime)(
        backgroundTasks.initBackgroundTasks(di) as any,
      );

      expect(s.schedule).toHaveBeenCalled();
      expect(scheduledTasks.length).toBeGreaterThan(0);

      // Выполняем запланированную задачу вручную
      const cacheTask = scheduledTasks.find((t) => t.id === 'cache-refresh');
      expect(cacheTask).toBeDefined();

      await Runtime.runPromise(
        Runtime.defaultRuntime,
        cacheTask!.task(new AbortController().signal),
      );

      // Проверяем что scheduler получил метрики выполнения задачи через обогащенный DI
      expect(s.enqueueTaskMetric).toHaveBeenCalledWith('task.cache-refresh.success', 1);
    });

    it('обрабатывает ошибки в shutdown handler', async () => {
      const di = createDI();
      const s = mockScheduler;
      // Делаем interrupt бросающим ошибку
      s.interrupt = vi.fn().mockImplementation(() => Effect.fail(new Error('shutdown error')));
      vi.mocked(getGlobalScheduler).mockReturnValue(Effect.sync(() => s));

      // Мокаем console.error чтобы проверить вызов
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await Runtime.runPromise(Runtime.defaultRuntime)(
        backgroundTasks.initBackgroundTasks(di) as any,
      );

      // Имитируем shutdown
      process.emit('SIGINT');

      // Даем время для асинхронной обработки
      await new Promise((resolve) => setImmediate(resolve));

      // Проверяем что console.error был вызван с ошибкой shutdown
      expect(consoleErrorSpy).toHaveBeenCalledWith('Unhandled shutdown error', {
        e: expect.any(Error),
      });

      consoleErrorSpy.mockRestore();
    });

    it('обрабатывает graceful shutdown через SIGINT/SIGTERM', async () => {
      const di = createDI();
      const s = mockScheduler;
      vi.mocked(getGlobalScheduler).mockReturnValue(Effect.sync(() => s));

      // Мокаем console.error чтобы не было шума в выводе
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // имитируем регистрацию handler
      await Runtime.runPromise(Runtime.defaultRuntime)(
        backgroundTasks.initBackgroundTasks(di) as any,
      );

      process.emit('SIGINT');
      expect(s.interrupt).toHaveBeenCalled();

      process.emit('SIGTERM');
      expect(s.interrupt).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  /* ========================================================================== */
  /* 🚀 Start/Stop Background Tasks API */
  /* ========================================================================== */

  describe('startBackgroundTasks() and stopBackgroundTasks()', () => {
    beforeEach(() => {
      // Сбрасываем счетчики вызовов для изоляции тестов
      vi.mocked(getGlobalScheduler).mockClear();
      mockScheduler.interrupt.mockClear();
    });

    it('startBackgroundTasks() должен получить глобальный scheduler', async () => {
      await startBackgroundTasks();

      expect(getGlobalScheduler).toHaveBeenCalledTimes(1);
    });

    it('startBackgroundTasks() должен быть идемпотентным', async () => {
      // Вызываем несколько раз
      await startBackgroundTasks();
      await startBackgroundTasks();
      await startBackgroundTasks();

      // getGlobalScheduler должен быть вызван каждый раз
      expect(getGlobalScheduler).toHaveBeenCalledTimes(3);
    });

    it('stopBackgroundTasks() должен вызвать interrupt на scheduler', async () => {
      await stopBackgroundTasks();

      expect(getGlobalScheduler).toHaveBeenCalledTimes(1);
      expect(mockScheduler.interrupt).toHaveBeenCalledTimes(1);
    });

    it('stopBackgroundTasks() должен быть идемпотентным', async () => {
      // Вызываем несколько раз
      await stopBackgroundTasks();
      await stopBackgroundTasks();
      await stopBackgroundTasks();

      // interrupt должен быть вызван каждый раз
      expect(mockScheduler.interrupt).toHaveBeenCalledTimes(3);
    });

    it('startBackgroundTasks() и stopBackgroundTasks() должны работать независимо', async () => {
      await startBackgroundTasks();
      await stopBackgroundTasks();

      expect(getGlobalScheduler).toHaveBeenCalledTimes(2);
      expect(mockScheduler.interrupt).toHaveBeenCalledTimes(1);
    });

    it('функции должны обрабатывать ошибки Effect системы', async () => {
      // Настраиваем mock для возврата ошибки
      const errorEffect = Effect.fail(new Error('Test error')) as any;
      vi.mocked(getGlobalScheduler).mockReturnValueOnce(errorEffect);

      // startBackgroundTasks должен отклонить Promise с ошибкой
      await expect(startBackgroundTasks()).rejects.toThrow('Test error');

      // getGlobalScheduler все равно должен быть вызван
      expect(getGlobalScheduler).toHaveBeenCalledTimes(1);
    });
  });
});
