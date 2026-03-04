/**
 * @file packages/app/src/background/tasks.ts
 * =============================================================================
 * 🛠️ BACKGROUND TASKS - PRODUCTION READY with Runtime Dashboard
 * =============================================================================
 * Особенности:
 * - Унифицированные фоновые задачи через глобальный Scheduler
 * - Periodic задачи (cache refresh/sync, auth refresh) + event-driven (login sync)
 * - Интегрированная телеметрия в самих задачах (latency/success/fail)
 * - Retry/DLQ логика делегирована Scheduler (exponential backoff + jitter)
 * - Cancellable через AbortSignal + Fiber-based graceful shutdown
 * - Dependency injection с обогащением метрик через DI
 * - Конфигурация унифицирована в scheduler.ENV
 * - Graceful shutdown через scheduler.interrupt() с OS сигналами
 */

import { Effect, Runtime } from 'effect';

import { ENV, getGlobalScheduler } from './scheduler.js';
import type { BackgroundTask, PriorityType } from './scheduler.js';
import { AppEventType } from '../events/app-events.js';
import { ConsoleLogger } from '../events/event-bus.js';
import type { StructuredLogger } from '../events/event-bus.js';

/* ========================================================================== */
/* 📊 CONFIG / ENV / FEATURE FLAGS */
/* ========================================================================== */

// Все настройки теперь унифицированы в scheduler.ts ENV для консистентности
// ENV используется через import { ENV } from './scheduler.js'

/* ========================================================================== */
/* 🧩 TYPES / ERRORS */
/* ========================================================================== */

/** Базовый класс ошибок фоновых задач */
export class TaskError extends Error {
  constructor(
    public readonly taskId: string,
    override readonly cause?: unknown,
  ) {
    super(`Task ${taskId} failed`);
  }
}

/** Временная ошибка для retry логики Scheduler */
export class TransientError extends TaskError {}

/** Постоянная ошибка для Dead-letter queue */
export class PermanentError extends TaskError {}

/** Эффект выполнения фоновой задачи */
export type TaskEffect<E = unknown> = Effect.Effect<void, E, never>;

/** DI контейнер зависимостей для фоновых задач */
export type BackgroundTasksDI = {
  offlineCache: {
    refresh: (signal: AbortSignal) => TaskEffect<TaskError>;
    sync: (signal: AbortSignal) => TaskEffect<TaskError>;
  };
  authService: {
    refreshToken: (signal: AbortSignal) => TaskEffect<TaskError>;
  };
  logger?: StructuredLogger;
  enqueueMetric?: (name: string, value: number | string) => Effect.Effect<void, never, void>;
};

/* ========================================================================== */
/* 🔄 TASK DEFINITIONS */
/* ========================================================================== */

/** Создает массив фоновых задач на основе ENV конфигурации */
export function createTasks(di: BackgroundTasksDI): BackgroundTask[] {
  return [
    ...(ENV.ENABLE_CACHE_REFRESH
      ? [
        {
          id: 'cache-refresh',
          interval: ENV.CACHE_REFRESH_INTERVAL_MS,
          priority: 'medium' as PriorityType,
          // maxRetries: undefined by default - Scheduler will use ENV.MAX_RETRIES
          task: (signal: AbortSignal) =>
            Effect.gen(function*() {
              const startTime = Date.now();
              try {
                yield* di.offlineCache.refresh(signal);
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.cache-refresh.latency', latency);
                  yield* di.enqueueMetric('task.cache-refresh.success', 1);
                }
              } catch (error) {
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.cache-refresh.latency', latency);
                  yield* di.enqueueMetric('task.cache-refresh.error', 1);
                }
                throw error;
              }
            }) as TaskEffect,
        },
      ]
      : []),
    ...(ENV.ENABLE_CACHE_SYNC
      ? [
        {
          id: 'cache-sync',
          interval: ENV.CACHE_SYNC_INTERVAL_MS,
          priority: 'low' as PriorityType,
          // maxRetries: undefined by default - Scheduler will use ENV.MAX_RETRIES
          task: (signal: AbortSignal) =>
            Effect.gen(function*() {
              const startTime = Date.now();
              try {
                yield* di.offlineCache.sync(signal);
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.cache-sync.latency', latency);
                  yield* di.enqueueMetric('task.cache-sync.success', 1);
                }
              } catch (error) {
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.cache-sync.latency', latency);
                  yield* di.enqueueMetric('task.cache-sync.error', 1);
                }
                throw error;
              }
            }) as TaskEffect,
        },
      ]
      : []),
    ...(ENV.ENABLE_CACHE_SYNC
      ? [
        {
          id: 'cache-sync-login',
          priority: 'high' as PriorityType,
          triggerEvent: AppEventType.AuthLogin,
          // maxRetries: undefined by default - Scheduler will use ENV.MAX_RETRIES
          task: (signal: AbortSignal) =>
            Effect.gen(function*() {
              const startTime = Date.now();
              try {
                yield* di.offlineCache.sync(signal);
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.cache-sync-login.latency', latency);
                  yield* di.enqueueMetric('task.cache-sync-login.success', 1);
                }
              } catch (error) {
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.cache-sync-login.latency', latency);
                  yield* di.enqueueMetric('task.cache-sync-login.error', 1);
                }
                throw error;
              }
            }) as TaskEffect,
        },
      ]
      : []),
    ...(ENV.ENABLE_AUTH_REFRESH
      ? [
        {
          id: 'auth-refresh',
          interval: ENV.AUTH_REFRESH_INTERVAL_MS,
          priority: 'high' as PriorityType,
          // maxRetries: undefined by default - Scheduler will use ENV.MAX_RETRIES
          task: (signal: AbortSignal) =>
            Effect.gen(function*() {
              const startTime = Date.now();
              try {
                yield* di.authService.refreshToken(signal);
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.auth-refresh.latency', latency);
                  yield* di.enqueueMetric('task.auth-refresh.success', 1);
                }
              } catch (error) {
                const latency = Date.now() - startTime;
                if (di.enqueueMetric) {
                  yield* di.enqueueMetric('task.auth-refresh.latency', latency);
                  yield* di.enqueueMetric('task.auth-refresh.error', 1);
                }
                throw error;
              }
            }) as TaskEffect,
        },
      ]
      : []),
  ];
}

/* ========================================================================== */
/* ⚡ INIT BACKGROUND TASKS + Graceful Shutdown */
/* ========================================================================== */

/** Инициализирует фоновые задачи через глобальный Scheduler с graceful shutdown */
export function initBackgroundTasks(di: BackgroundTasksDI): Effect.Effect<void, unknown, void> {
  return Effect.gen(function*() {
    const s = yield* getGlobalScheduler();
    const logger = di.logger ?? new ConsoleLogger();

    // Обогащаем DI enqueueMetric для метрик по задачам
    const enrichedDI: BackgroundTasksDI = {
      ...di,
      enqueueMetric: (name, value) => s.enqueueTaskMetric(name, value),
    };

    const tasks = createTasks(enrichedDI);

    // Schedule all tasks
    for (const task of tasks) {
      yield* s.schedule(task);

      // Телеметрия: метрики по зарегистрированным задачам
      yield* s.enqueueTaskMetric(`task.registered:${task.id}`, 1);
      yield* s.enqueueTaskMetric(`task.interval:${task.id}`, task.interval ?? 0);
      if (task.triggerEvent !== undefined) {
        yield* s.enqueueTaskMetric(`task.trigger_event:${task.id}`, task.triggerEvent);
      }

      logger.info('Scheduled task', {
        taskId: task.id,
        interval: task.interval,
        priority: task.priority,
        maxRetries: task.maxRetries,
        triggerEvent: task.triggerEvent,
      });
    }

    // Graceful shutdown
    const shutdownHandler = (): void => {
      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.gen(function*() {
          yield* s.interrupt();
        }).pipe(
          Effect.catchAll((e) =>
            Effect.sync(() => {
              // eslint-disable-next-line no-console
              console.error('Unhandled shutdown error', { e });
            })
          ),
        ) as Effect.Effect<never, never, never>,
      );
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
  });
}

/* ========================================================================== */
/* 🌐 EXPORTS */
/* ========================================================================== */

/**
 * Запуск фоновых задач для жизненного цикла приложения.
 * - Идемпотентен
 * - Безопасен для повторных вызовов
 * - Работает с глобальным scheduler'ом
 */
export async function startBackgroundTasks(): Promise<void> {
  // Получаем глобальный scheduler и запускаем его основной цикл
  const runtime = Runtime.defaultRuntime;
  const effect = Effect.gen(function*() {
    const scheduler = yield* getGlobalScheduler();
    // Scheduler автоматически запускается при планировании задач,
    // но мы можем убедиться что он активен
    return scheduler;
  });

  await Runtime.runPromise(runtime)(effect);
}

/**
 * Остановка фоновых задач для жизненного цикла приложения.
 * - Идемпотентен
 * - Гарантирует очистку ресурсов
 * - Graceful shutdown через interrupt
 */
export async function stopBackgroundTasks(): Promise<void> {
  // Останавливаем глобальный scheduler
  const runtime = Runtime.defaultRuntime;
  const effect = Effect.gen(function*() {
    const scheduler = yield* getGlobalScheduler();
    yield* scheduler.interrupt();
    return undefined;
  }) as Effect.Effect<void, never, never>;

  await Runtime.runPromise(runtime)(effect);
}

export const backgroundTasks = {
  createTasks,
  initBackgroundTasks,
  startBackgroundTasks,
  stopBackgroundTasks,
  TaskError,
  TransientError,
  PermanentError,
};
