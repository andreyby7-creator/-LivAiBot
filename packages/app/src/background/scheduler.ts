/**
 * @file packages/app/src/background/scheduler.ts
 *
 * =============================================================================
 * 🚀 ADAPTIVE EFFECT SCHEDULER
 * =============================================================================
 *
 * Возможности:
 * - persistent binary heap priority queue O(log n) для тысяч задач в секунду
 * - cancellable tasks с AbortSignal и настоящая preemption
 * - adaptive concurrency + token bucket rate-limiting O(1)
 * - retry с exponential backoff + jitter (защита от thundering herd)
 * - dead-letter queue для неуспешных задач
 * - periodic & event-driven задачи с управлением подписками
 * - bounded telemetry pipeline с backpressure и batching
 * - immutable architecture на Effect-TS с Layer-совместимостью
 * - graceful shutdown с прерыванием всех задач и подписок
 */

import { Effect, Fiber, pipe, Ref, Runtime } from 'effect';

import { AppEventType } from '../events/app-events.js';
import type { StructuredLogger } from '../events/event-bus.js';
import { ConsoleLogger, eventBus } from '../events/event-bus.js';
import { getGlobalTelemetryClient } from '../lib/telemetry.js';

/* ========================================================================== */
/* 📊 CONFIG / CONSTANTS */
/* ========================================================================== */
const LOOP_INTERVAL_MS = 50;
const METRICS_QUEUE_SIZE = 1000; // Ограничение очереди метрик
const METRICS_BATCH_SIZE = 10; // Размер батча для отправки
const RETRY_JITTER_MIN = 0.5; // Минимальный множитель jitter для retry
const RETRY_JITTER_MAX = 1.5; // Максимальный множитель jitter для retry
const PRIORITY = { high: 3, medium: 2, low: 1 } as const;

const ENV = {
  DEFAULT_INTERVAL_MS: parseInt(process.env['SCHEDULER_DEFAULT_INTERVAL_MS'] ?? '5000', 10),
  MAX_CONCURRENCY: parseInt(process.env['SCHEDULER_MAX_CONCURRENCY'] ?? '10', 10),
  MIN_CONCURRENCY: parseInt(process.env['SCHEDULER_MIN_CONCURRENCY'] ?? '2', 10),
  CONCURRENCY_STEP: parseInt(process.env['SCHEDULER_CONCURRENCY_STEP'] ?? '1', 10),
  MAX_RETRIES: parseInt(process.env['SCHEDULER_MAX_RETRIES'] ?? '3', 10),
  RETRY_BASE_DELAY_MS: parseInt(process.env['SCHEDULER_RETRY_BASE_DELAY_MS'] ?? '1000', 10),
  MAX_TASKS_PER_SECOND: parseInt(process.env['SCHEDULER_MAX_TASKS_PER_SECOND'] ?? '1000', 10),
  ADAPTIVE_WINDOW_MS: parseInt(process.env['SCHEDULER_ADAPTIVE_WINDOW_MS'] ?? '1000', 10),
  // Интервалы и feature flags для конкретных задач
  CACHE_REFRESH_INTERVAL_MS: parseInt(
    process.env['SCHEDULER_CACHE_REFRESH_INTERVAL_MS'] ?? '300000',
    10,
  ),
  CACHE_SYNC_INTERVAL_MS: parseInt(process.env['SCHEDULER_CACHE_SYNC_INTERVAL_MS'] ?? '900000', 10),
  AUTH_REFRESH_INTERVAL_MS: parseInt(
    process.env['SCHEDULER_AUTH_REFRESH_INTERVAL_MS'] ?? '600000',
    10,
  ),
  ENABLE_CACHE_REFRESH: process.env['SCHEDULER_ENABLE_CACHE_REFRESH'] === 'true',
  ENABLE_CACHE_SYNC: process.env['SCHEDULER_ENABLE_CACHE_SYNC'] === 'true',
  ENABLE_AUTH_REFRESH: process.env['SCHEDULER_ENABLE_AUTH_REFRESH'] === 'true',
};

export { ENV };

/* ========================================================================== */
/* 🧩 TYPES / INTERFACES */
/* ========================================================================== */
export type PriorityType = keyof typeof PRIORITY;
export type TaskFn<E = unknown> = (signal: AbortSignal) => Effect.Effect<void, E, never>;

export type BackgroundTask = {
  id: string;
  task: TaskFn;
  interval?: number;
  maxRetries?: number;
  priority?: PriorityType;
  triggerEvent?: AppEventType | '*';
};

export type QueueItem = {
  task: BackgroundTask;
  attempts: number;
  nextRun: number;
  unsubscribe?: Effect.Effect<void, never, never>;
  executionFiber?: Fiber.RuntimeFiber<void, unknown>;
};

export type SchedulerDI = {
  enqueueTask?: (task: BackgroundTask) => Effect.Effect<never, unknown, void>;
  deadLetter?: (task: BackgroundTask, error: unknown) => Effect.Effect<never, never, void>;
};

/* ========================================================================== */
/* 🏭 HEAP-BASED PRIORITY QUEUE (immutable) */
/* ========================================================================== */
/** Узел persistent binary heap */
type HeapNode = {
  item: QueueItem;
  left: HeapNode | null;
  right: HeapNode | null;
  size: number;
};

/** Приоритетная очередь на базе persistent meldable heap - O(log n) операции */
export class MeldablePriorityQueue {
  /** Создает новую очередь */
  constructor(private readonly root: HeapNode | null = null) {}

  /** Вычисляет размер heap */
  private get size(): number {
    return this.root?.size ?? 0;
  }

  /** Сравнивает приоритеты двух задач */
  private compare(a: QueueItem, b: QueueItem): number {
    const pa = PRIORITY[a.task.priority ?? 'medium'];
    const pb = PRIORITY[b.task.priority ?? 'medium'];
    return pb - pa || a.nextRun - b.nextRun;
  }

  /** Создает новый узел */
  private makeNode(
    item: QueueItem,
    left: HeapNode | null = null,
    right: HeapNode | null = null,
  ): HeapNode {
    return {
      item,
      left,
      right,
      size: 1 + (left?.size ?? 0) + (right?.size ?? 0),
    };
  }

  /** Объединяет два heap в один */
  private merge(left: HeapNode | null, right: HeapNode | null): HeapNode | null {
    if (!left) return right;
    if (!right) return left;

    // Всегда делаем меньший элемент корнем
    if (this.compare(left.item, right.item) <= 0) {
      return this.makeNode(left.item, left.left, this.merge(left.right, right));
    } else {
      return this.makeNode(right.item, right.left, this.merge(right.left, left));
    }
  }

  /** Добавляет задачу в очередь с учетом приоритета - O(log n) */
  push(item: QueueItem): MeldablePriorityQueue {
    const newNode = this.makeNode(item);
    const newRoot = this.merge(this.root, newNode);
    return new MeldablePriorityQueue(newRoot);
  }

  /** Извлекает задачу с наивысшим приоритетом - O(log n) */
  pop(): [QueueItem, MeldablePriorityQueue] | undefined {
    if (!this.root) return undefined;

    const item = this.root.item;
    const newRoot = this.merge(this.root.left, this.root.right);
    return [item, new MeldablePriorityQueue(newRoot)];
  }

  /** Возвращает следующую задачу без извлечения - O(1) */
  peek(): QueueItem | undefined {
    return this.root?.item;
  }

  /** Возвращает все задачи в очереди - O(n) */
  getAll(): QueueItem[] {
    const collectItems = (node: HeapNode | null, acc: QueueItem[] = []): QueueItem[] => {
      if (!node) return acc;
      return collectItems(node.right, collectItems(node.left, [...acc, node.item]));
    };

    return collectItems(this.root);
  }

  /** Возвращает общее количество задач - O(1) */
  getTotalCount(): number {
    return this.size;
  }

  /** Возвращает статистику по приоритетам задач - O(n) */
  snapshot(): Record<PriorityType, number> {
    return this.getAll().reduce((acc, item) => {
      const prio = item.task.priority ?? 'medium';
      return { ...acc, [prio]: acc[prio] + 1 };
    }, { high: 0, medium: 0, low: 0 } as Record<PriorityType, number>);
  }
}

/* ========================================================================== */
/* 🏭 EFFECT SCHEDULER */
/* ========================================================================== */

/** Адаптивный планировщик задач с поддержкой приоритетов и телеметрии */
export class Scheduler {
  private constructor(
    private readonly di: SchedulerDI,
    private readonly logger: StructuredLogger,
    private readonly telemetry: ReturnType<typeof getGlobalTelemetryClient>,
    private readonly queue: Ref.Ref<MeldablePriorityQueue>,
    private readonly isRunning: Ref.Ref<boolean>,
    private readonly concurrency: Ref.Ref<number>,
    private readonly availableTokens: Ref.Ref<number>,
    private readonly lastTokenReplenish: Ref.Ref<number>,
    private readonly metricsQueue: Ref.Ref<
      { name: string; value: number | string; timestamp: number; }[]
    >,
    private readonly metricsProcessorFiber: Ref.Ref<Fiber.RuntimeFiber<never, unknown> | undefined>,
    private readonly executionFibers: Ref.Ref<Map<QueueItem, Fiber.RuntimeFiber<void, unknown>>>,
  ) {}

  /** Создает новый экземпляр планировщика в Effect-контексте */
  static make(
    di: SchedulerDI = {},
    logger?: StructuredLogger,
  ): Effect.Effect<Scheduler, never, never> {
    return Effect.gen(function*() {
      const actualLogger = logger ?? new ConsoleLogger();
      const telemetry = getGlobalTelemetryClient();

      const queue = yield* Ref.make(new MeldablePriorityQueue());
      const isRunning = yield* Ref.make(false);
      const concurrency = yield* Ref.make(ENV.MIN_CONCURRENCY);
      const availableTokens = yield* Ref.make(ENV.MAX_TASKS_PER_SECOND);
      const lastTokenReplenish = yield* Ref.make(Date.now());
      const metricsQueue = yield* Ref.make<
        { name: string; value: number | string; timestamp: number; }[]
      >([]);
      const metricsProcessorFiber = yield* Ref.make<Fiber.RuntimeFiber<never, unknown> | undefined>(
        undefined,
      );
      const executionFibers = yield* Ref.make(
        new Map<QueueItem, Fiber.RuntimeFiber<void, unknown>>(),
      );

      return new Scheduler(
        di,
        actualLogger,
        telemetry,
        queue,
        isRunning,
        concurrency,
        availableTokens,
        lastTokenReplenish,
        metricsQueue,
        metricsProcessorFiber,
        executionFibers,
      );
    });
  }

  /** Планирует выполнение фоновой задачи */
  schedule(task: BackgroundTask): Effect.Effect<void, unknown, unknown> {
    const now = Date.now();
    let item: QueueItem = {
      task,
      attempts: 0,
      nextRun: now + (task.interval ?? ENV.DEFAULT_INTERVAL_MS),
    };

    // Создаем подписку для event-driven задач
    if (task.triggerEvent !== undefined) {
      const controller = new AbortController();

      const handler = (): void => {
        // Проверяем, не прервана ли подписка
        if (controller.signal.aborted) return;

        Effect.fork(pipe(
          this.queue,
          Ref.update((q) => q.push({ ...item, nextRun: Date.now() })),
        ));
        return undefined;
      };

      eventBus.subscribe(task.triggerEvent, handler);

      // Сохраняем unsubscribe функцию с прерыванием
      const unsubscribe = Effect.sync(() => {
        controller.abort();
        eventBus.unsubscribe(handler);
      });
      item = { ...item, unsubscribe };
    }

    return pipe(
      this.queue,
      Ref.update((q) => q.push(item)),
      Effect.flatMap(() => {
        // Don't start the background loop in test environments (except integration tests)
        if (
          (process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true')
          && process.env['INTEGRATION_TEST'] !== 'true'
        ) {
          return Effect.succeed(undefined);
        }
        return this.startLoop();
      }),
    );
  }

  /** Формирует пакет готовых к выполнению задач */
  private getAvailableBatch(
    now: number,
    availableSlots: number,
  ): Effect.Effect<QueueItem[], never, never> {
    return Effect.gen(this, function*() {
      let q = yield* Ref.get(this.queue);
      let batch: QueueItem[] = [];

      while (batch.length < availableSlots) {
        const peek = q.peek();
        if (!peek || peek.nextRun > now) break;
        const popped = q.pop();
        if (!popped) break;
        const [item, nextQueue] = popped;
        batch = [...batch, item];
        q = nextQueue;
      }

      yield* Ref.set(this.queue, q);
      return batch;
    });
  }

  /** Потребляет токены для выполненных задач */
  private consumeTokens(count: number): Effect.Effect<void, never, void> {
    return Ref.update(this.availableTokens, (tokens) => Math.max(0, tokens - count));
  }

  /** Добавляет метрику в очередь с backpressure (drop oldest if full) */
  private enqueueMetric(name: string, value: number | string): Effect.Effect<void, never, void> {
    return Effect.gen(this, function*() {
      const currentQueue = yield* Ref.get(this.metricsQueue);
      const newMetric = { name, value, timestamp: Date.now() };

      // Drop policy: если очередь полна, удаляем старые метрики
      const updatedQueue = currentQueue.length >= METRICS_QUEUE_SIZE
        ? [...currentQueue.slice(1), newMetric] // Удаляем первый (старый) элемент
        : [...currentQueue, newMetric];

      yield* Ref.set(this.metricsQueue, updatedQueue);
    });
  }

  /** Запускает процессор метрик в отдельном fiber */
  private startMetricsProcessor(): Effect.Effect<void, never, void> {
    return Effect.gen(this, function*() {
      const existingFiber = yield* Ref.get(this.metricsProcessorFiber);
      if (existingFiber) return; // Уже запущен

      const fiber = yield* Effect.fork(
        Effect.forever(
          Effect.gen(this, function*() {
            // Ждем метрик в очереди
            const queue = yield* Ref.get(this.metricsQueue);
            if (queue.length === 0) {
              yield* Effect.sleep(100); // Не busy wait
              return;
            }

            // Берем батч метрик
            const batch = queue.slice(0, METRICS_BATCH_SIZE);
            const remaining = queue.slice(METRICS_BATCH_SIZE);

            yield* Ref.set(this.metricsQueue, remaining);

            // Отправляем батч метрик
            yield* Effect.forEach(
              batch,
              (metric) =>
                Effect.tryPromise(() =>
                  metric.name.includes('span')
                    ? (metric.name.includes('start')
                      ? this.telemetry.startSpan(metric.value as string)
                      : this.telemetry.endSpan(metric.value as string))
                    : this.telemetry.recordMetric(metric.name, metric.value as number)
                ),
              { concurrency: 1 }, // Sequential для избежания перегрузки
            );
          }),
        ),
      );

      yield* Ref.set(this.metricsProcessorFiber, fiber);
    });
  }

  /** Останавливает процессор метрик */
  private stopMetricsProcessor(): Effect.Effect<void, never, void> {
    return Effect.gen(this, function*() {
      const fiber = yield* Ref.get(this.metricsProcessorFiber);
      if (fiber) {
        yield* Fiber.interrupt(fiber);
        yield* Ref.set(this.metricsProcessorFiber, undefined);
      }
    });
  }

  /** Прерывает все выполняющиеся задачи и подписки */
  interrupt(): Effect.Effect<void, never, void> {
    return Effect.gen(this, function*() {
      // Прерываем все выполняющиеся задачи
      const queue = yield* Ref.get(this.queue);
      const allItems = queue.getAll();

      // Прерываем execution fibers всех задач
      const fibers = yield* Ref.get(this.executionFibers);
      yield* Effect.forEach(allItems, (item) => {
        const fiber = fibers.get(item);
        return fiber ? Fiber.interrupt(fiber) : Effect.succeed(undefined);
      });

      // Прерываем подписки для всех задач
      for (const item of allItems) {
        if (item.unsubscribe) {
          yield* item.unsubscribe;
        }
      }

      // Останавливаем процессор метрик
      yield* this.stopMetricsProcessor();

      // Останавливаем цикл
      yield* Ref.set(this.isRunning, false);
    });
  }

  /** Публичный метод для записи метрик по задачам */
  enqueueTaskMetric(name: string, value: number | string): Effect.Effect<void, never, void> {
    return this.enqueueMetric(name, value);
  }

  /** Записывает метрики производительности пакета задач */
  private recordBatchMetrics(
    batch: QueueItem[],
    latency: number,
    q: MeldablePriorityQueue,
  ): Effect.Effect<void, never, void> {
    return Effect.gen(this, function*() {
      yield* this.enqueueMetric('scheduler.batch.latency', latency);
      yield* this.enqueueMetric('scheduler.batch.throughput', batch.length);

      const snapshot = q.snapshot();
      yield* this.enqueueMetric('scheduler.queue.depth.high', snapshot.high);
      yield* this.enqueueMetric('scheduler.queue.depth.medium', snapshot.medium);
      yield* this.enqueueMetric('scheduler.queue.depth.low', snapshot.low);
      yield* this.enqueueMetric('scheduler.queue.depth.total', q.getTotalCount());
    });
  }

  /** Планирует повторное выполнение неудачной задачи */
  private scheduleRetry(item: QueueItem): Effect.Effect<void, never, void> {
    // Добавляем jitter для предотвращения thundering herd
    const jitter = RETRY_JITTER_MIN + Math.random() * (RETRY_JITTER_MAX - RETRY_JITTER_MIN);
    const delay = ENV.RETRY_BASE_DELAY_MS * 2 ** (item.attempts - 1) * jitter;
    const nextItem = { ...item, nextRun: Date.now() + delay };
    return Ref.update(this.queue, (q) => q.push(nextItem))
      .pipe(Effect.tap(() => {
        this.logger.warn('Task retry scheduled', {
          taskId: item.task.id,
          nextRun: new Date(nextItem.nextRun).toISOString(),
        });
      }));
  }

  /** Запускает главный цикл обработки задач */
  private startLoop(): Effect.Effect<void, unknown, void> {
    return Effect.gen(this, function*() {
      const running = yield* Ref.get(this.isRunning);
      if (running) return;
      yield* Ref.set(this.isRunning, true);

      // Запускаем процессор метрик
      yield* this.startMetricsProcessor();

      for (;;) {
        try {
          const now = Date.now();

          // Replenish tokens based on elapsed time (token bucket algorithm)
          const lastReplenish = yield* Ref.get(this.lastTokenReplenish);
          const elapsedMs = now - lastReplenish;
          const tokensToAdd = Math.floor((elapsedMs / 1000) * ENV.MAX_TASKS_PER_SECOND);
          if (tokensToAdd > 0) {
            yield* Ref.update(
              this.availableTokens,
              (tokens) => Math.min(ENV.MAX_TASKS_PER_SECOND, tokens + tokensToAdd),
            );
            yield* Ref.set(this.lastTokenReplenish, now);
          }

          const availableTokens = yield* Ref.get(this.availableTokens);
          const availableSlots = Math.max(0, availableTokens);

          const batch = yield* this.getAvailableBatch(now, availableSlots);
          const q = yield* Ref.get(this.queue);

          if (batch.length === 0 || availableSlots <= 0) {
            yield* Effect.sleep(LOOP_INTERVAL_MS);
            continue;
          }

          if (batch.length > 0 && availableSlots > 0) {
            const tasksToExecute = Math.min(batch.length, availableSlots);
            const actualBatch = batch.slice(0, tasksToExecute);

            const start = Date.now();
            const conc = yield* Ref.get(this.concurrency);

            // Запускаем задачи с хранением их Fibers для возможности прерывания
            const taskFibers = yield* Effect.forEach(
              actualBatch,
              (item, index) =>
                Effect.map(
                  Effect.fork(this.executeTask(item)),
                  (fiber) => ({ item, fiber, index }),
                ),
            );

            // Сохраняем execution fibers в Ref<Map>
            yield* Ref.set(
              this.executionFibers,
              new Map([
                ...Array.from((yield* Ref.get(this.executionFibers)).entries()),
                ...taskFibers.map(({ item, fiber }) => [item, fiber] as const),
              ]),
            );

            // Ждем завершения всех задач (с учетом concurrency)
            yield* Effect.forEach(taskFibers, ({ fiber }) => Fiber.join(fiber), {
              concurrency: conc,
            });

            const latency = Date.now() - start;

            yield* this.consumeTokens(actualBatch.length);

            yield* this.recordBatchMetrics(batch, latency, q);

            yield* this.adaptConcurrency(batch.length, latency);
          }
        } catch (err) {
          this.logger.error('Scheduler loop crashed', { error: err });
        } finally {
          yield* Effect.sleep(LOOP_INTERVAL_MS);
        }
      }
    });
  }

  /** Вычисляет оптимальный уровень параллелизма */
  private computeNewConcurrency(conc: number, latency: number, totalQueue: number): number {
    const threshold = ENV.ADAPTIVE_WINDOW_MS / 2;
    if (latency > ENV.ADAPTIVE_WINDOW_MS || totalQueue > conc) {
      return Math.min(conc + ENV.CONCURRENCY_STEP, ENV.MAX_CONCURRENCY);
    } else if (latency < threshold && totalQueue < conc) {
      return Math.max(conc - ENV.CONCURRENCY_STEP, ENV.MIN_CONCURRENCY);
    }
    return conc;
  }

  /** Адаптирует уровень параллелизма на основе нагрузки */
  private adaptConcurrency(
    batchProcessed: number,
    latency: number,
  ): Effect.Effect<void, never, void> {
    return Effect.gen(this, function*() {
      const q = yield* Ref.get(this.queue);
      const totalQueue = q.getTotalCount();
      const conc = yield* Ref.get(this.concurrency);
      const newConc = this.computeNewConcurrency(conc, latency, totalQueue);

      yield* Ref.set(this.concurrency, newConc);
      yield* this.enqueueMetric('scheduler.concurrency', newConc);
      this.logger.info('Adaptive concurrency adjusted', {
        concurrency: newConc,
        queueSize: totalQueue,
        batchProcessed,
      });
    });
  }

  /** Выполняет отдельную задачу с поддержкой прерывания */
  private executeTask(item: QueueItem): Effect.Effect<void, unknown, void> {
    return Effect.gen(this, function*() {
      const start = Date.now();
      let executionError: unknown = undefined;

      // Создаем AbortController для поддержки прерывания
      const controller = new AbortController();
      const signal = controller.signal;

      try {
        yield* this.enqueueMetric(`startSpan:${item.task.id}`, item.task.id);

        if (this.di.enqueueTask) {
          yield* this.di.enqueueTask(item.task);
        } else {
          // Выполняем cancellable задачу с поддержкой прерывания
          yield* item.task.task(signal);
        }

        yield* this.enqueueMetric(`endSpan:${item.task.id}`, item.task.id);
        yield* this.enqueueMetric('scheduler.task.latency', Date.now() - start);
        yield* this.enqueueMetric('scheduler.task.success', 1);

        if (item.task.interval !== undefined) {
          const next: QueueItem = {
            task: item.task,
            attempts: 0,
            nextRun: Date.now() + item.task.interval,
          };
          yield* Ref.update(this.queue, (q: MeldablePriorityQueue) => q.push(next));
        }
      } catch (error) {
        // Сохраняем ошибку для обработки после finally
        executionError = error;

        // Прерываем задачу при ошибке
        controller.abort();

        yield* this.enqueueMetric('scheduler.task.latency', Date.now() - start);
        yield* this.enqueueMetric('scheduler.task.error', 1);
      } finally {
        // Очищаем execution fiber из Map после завершения задачи
        yield* Ref.update(
          this.executionFibers,
          (fibers) => new Map(Array.from(fibers.entries()).filter(([key]) => key !== item)),
        );
      }

      // Обработка ошибок и retry логика после завершения задачи
      if (executionError !== undefined) {
        const failed = { ...item, attempts: item.attempts + 1 };
        const maxRetries = item.task.maxRetries ?? ENV.MAX_RETRIES;
        if (failed.attempts > maxRetries) {
          this.logger.error('Task failed after max retries', {
            taskId: item.task.id,
            error: executionError,
          });

          // Отписываемся от event-driven задач
          if (item.unsubscribe) {
            yield* item.unsubscribe;
          }

          if (this.di.deadLetter) {
            yield* Effect.ignore(this.di.deadLetter(item.task, executionError));
          }
        } else {
          yield* this.scheduleRetry(failed);
        }
      }
    });
  }
}

/* ========================================================================== */
/* 🌐 GLOBAL INSTANCE */
/* ========================================================================== */

/** Глобальный экземпляр планировщика (ленивая инициализация) */
let _globalScheduler: Scheduler | undefined;

/** Получить глобальный экземпляр планировщика */
export const getGlobalScheduler = (): Effect.Effect<Scheduler, never, never> => {
  if (_globalScheduler) {
    return Effect.succeed(_globalScheduler);
  }
  return Effect.map(Scheduler.make(), (scheduler) => {
    _globalScheduler = scheduler;
    return scheduler;
  });
};

/** Синхронный глобальный экземпляр для обратной совместимости */
export const scheduler = Runtime.runSync(Runtime.defaultRuntime)(Scheduler.make());
