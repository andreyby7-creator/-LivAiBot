/**
 * @file packages/app/src/background/tasks.ts
 * =============================================================================
 * 🛠️ BACKGROUND TASKS - PRODUCTION READY with Runtime Dashboard
 * =============================================================================
 *
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
import type { UseAuthDeps } from '../hooks/useAuth.js';

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

/**
 * Безопасно логирует ошибку задачи без sensitive данных.
 * Redact токены, пароли и другую sensitive информацию из ошибок.
 */
function safeLogTaskError(
  logger: StructuredLogger,
  taskId: string,
  error: unknown,
): void {
  // Извлекаем безопасную информацию из ошибки
  const safeError: Record<string, unknown> = {
    taskId,
  };

  if (error instanceof TaskError) {
    safeError['message'] = error.message;
    safeError['taskId'] = error.taskId;
    // Не логируем cause напрямую - может содержать sensitive данные
    if (error.cause instanceof Error) {
      safeError['causeType'] = error.cause.constructor.name;
      safeError['causeMessage'] = error.cause.message;
    } else if (error.cause != null) {
      safeError['causeType'] = typeof error.cause;
    }
  } else if (error instanceof Error) {
    safeError['message'] = error.message;
    safeError['errorType'] = error.constructor.name;
  } else {
    safeError['errorType'] = typeof error;
    safeError['errorValue'] = String(error);
  }

  logger.error('Task failed', safeError);
}

/** Временная ошибка для retry логики Scheduler */
export class TransientError extends TaskError {}

/** Постоянная ошибка для Dead-letter queue */
export class PermanentError extends TaskError {}

/** Эффект выполнения фоновой задачи */
export type TaskEffect = Effect.Effect<void, TaskError, never>;

/** DI контейнер зависимостей для фоновых задач */
export type BackgroundTasksDI = {
  offlineCache: {
    refresh: (signal: AbortSignal) => TaskEffect;
    sync: (signal: AbortSignal) => TaskEffect;
  };
  /** Auth dependencies из UseAuthDeps для использования того же store и эффектов, что и useAuth */
  auth: {
    /** Refresh effect из feature-auth (через DI-слой auth-hook-deps) */
    refreshEffect: UseAuthDeps['refreshEffect'];
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
              // Используем refreshEffect из UseAuthDeps (тот же эффект, что и useAuth)
              // Адаптируем Promise → Effect для использования в background task
              const result = yield* Effect.tryPromise({
                try: () => {
                  // Проверяем, не отменена ли задача
                  if (signal.aborted) {
                    return Promise.reject(new TaskError('auth-refresh', new Error('Task aborted')));
                  }
                  return di.auth.refreshEffect();
                },
                catch: (error) => new TaskError('auth-refresh', error),
              }).pipe(
                Effect.match({
                  onFailure: (error) =>
                    Effect.gen(function*() {
                      const latency = Date.now() - startTime;
                      if (di.enqueueMetric) {
                        yield* di.enqueueMetric('task.auth-refresh.latency', latency);
                        yield* di.enqueueMetric('task.auth-refresh.error', 1);
                      }
                      return yield* Effect.fail(error);
                    }),
                  onSuccess: () =>
                    Effect.gen(function*() {
                      const latency = Date.now() - startTime;
                      if (di.enqueueMetric) {
                        yield* di.enqueueMetric('task.auth-refresh.latency', latency);
                        yield* di.enqueueMetric('task.auth-refresh.success', 1);
                      }
                      return Effect.succeed(undefined);
                    }),
                }),
              );
              yield* result;
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
              // Используем безопасное логирование вместо console.error
              safeLogTaskError(logger, 'shutdown', e);
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
 * @param di Опциональный DI контейнер. Если не передан, auth refresh задача не будет создана.
 * @remarks
 * - Для использования auth refresh необходимо передать `refreshEffect` из `UseAuthDeps`
 *   (созданного через `createAuthHookDeps`), чтобы использовать тот же store и эффекты, что и `useAuth`.
 * - Если DI не передан, фоновые задачи будут работать без auth refresh.
 */
export async function startBackgroundTasks(di?: BackgroundTasksDI): Promise<void> {
  const runtime = Runtime.defaultRuntime;
  const effect = Effect.gen(function*() {
    // Получаем scheduler для инициализации (если нужен)
    yield* getGlobalScheduler();

    // Если передан DI, инициализируем задачи
    if (di) {
      yield* initBackgroundTasks(di);
    }

    // Scheduler автоматически запускается при планировании задач
    return undefined;
  }) as Effect.Effect<void, unknown, never>;

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
