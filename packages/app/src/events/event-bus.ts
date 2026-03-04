/**
 * @file packages/app/src/events/event-bus.ts
 * =============================================================================
 * 🚀 EVENT BUS — TYPED EVENT BUS С MICROSERVICE PUSH И PERSISTENT RETRY
 * =============================================================================
 * Typed event bus для безопасного обмена событиями внутри приложения
 * и между микросервисами. Поддерживает publish/subscribe, audit log,
 * типизацию событий, расширяемую мета-информацию и автоматический push в очередь
 * с retry и fail-safe, включая сохранение неотправленных событий в Redis.
 */

import type { Redis as RedisType } from 'ioredis';
import { Redis } from 'ioredis';

import { AppEventType, pushToQueue } from './app-events.js';
import type { AppEvent, BaseAppEvent } from './app-events.js';

/* ========================================================================== */
/* 📊 CONSTANTS */
/* ========================================================================== */

/** Максимальное количество попыток retry для отправки события */
const MAX_EVENT_RETRIES = 5;

/** Настройки batch push для оптимизации нагрузки на Redis/Kafka */
const BATCH_CONFIG = {
  /** Максимальный размер батча для отправки */
  MAX_BATCH_SIZE: 10,
  /** Максимальное время ожидания перед отправкой неполного батча (мс) */
  BATCH_TIMEOUT_MS: 5000,
  /** Максимальное количество параллельных отправок в очередь */
  CONCURRENCY: 5,
} as const;

/* ========================================================================== */
/* 🧩 INTERFACES / TYPES */
/* ========================================================================== */

/** Тип функции-обработчика события */
export type EventHandler<T extends AppEvent> = (event: T) => void | Promise<void>;

/** Подписчик на событие */
type Subscriber = {
  type: AppEventType | '*';
  handler: EventHandler<AppEvent>;
};

/** Элемент очереди для retry */
type RetryItem = {
  event: BaseAppEvent<AppEventType, unknown>;
  attempts: number;
};

/** Batch для отправки событий */
type EventBatch = {
  events: BaseAppEvent<AppEventType, unknown>[];
  // eslint-disable-next-line no-undef
  timeoutId: NodeJS.Timeout | undefined;
};

/** Тип структурированного логгера */
export type StructuredLogger = {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
};

/* eslint-disable no-console */
/** Простой console-based logger для разработки */
export class ConsoleLogger implements StructuredLogger {
  info(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.log(`[INFO] ${message}`, context);
    } else {
      console.log(`[INFO] ${message}`);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.warn(`[WARN] ${message}`, context);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.error(`[ERROR] ${message}`, context);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }
}
/* eslint-enable no-console */

/* ========================================================================== */
/* 🏭 EVENT BUS IMPLEMENTATION */
/* ========================================================================== */

export class EventBus {
  private subscribers: Subscriber[] = [];
  private retryQueue: RetryItem[] = [];
  private isRetryProcessing = false;

  // Batch push для оптимизации нагрузки
  private readonly currentBatch: EventBatch = { events: [], timeoutId: undefined };
  private isBatchProcessing = false;

  private readonly RETRY_BASE_DELAY = 1000; // ms
  private readonly REDIS_KEY = 'eventbus:retry';

  private readonly redis: RedisType;
  private readonly logger: StructuredLogger;

  constructor(redisClient?: RedisType, logger?: StructuredLogger) {
    this.redis = redisClient ?? new Redis();
    this.logger = logger ?? new ConsoleLogger();

    this.loadPersistentQueue().catch((err) => {
      this.logger.warn('Failed to load persistent queue on startup', { error: err });
    });
  }

  /** Подписка на событие @param type - тип события или '*' для всех @param handler - функция-обработчик события */
  subscribe(type: AppEventType | '*', handler: EventHandler<AppEvent>): void {
    this.subscribers.push({ type, handler });
  }

  /** Отписка от события @param handler - функция-обработчик, которую нужно удалить */
  unsubscribe(handler: EventHandler<AppEvent>): void {
    this.subscribers = this.subscribers.filter((sub) => sub.handler !== handler);
  }

  /** Публикация события @param event - событие для публикации */
  async publish(event: AppEvent): Promise<void> {
    // уведомление подписчиков
    const relevantSubscribers = this.subscribers.filter(
      (sub) => sub.type === event.type || sub.type === '*',
    );

    await Promise.all(
      relevantSubscribers.map(async (sub) => {
        try {
          await sub.handler(event);
        } catch (err) {
          this.logger.error('Handler failed for event', {
            eventType: event.type,
            error: err,
            correlationId: event.meta?.correlationId,
          });
        }
      }),
    );

    // пуш с batch и retry для оптимизации нагрузки
    await this.addToBatch(event);
  }

  /** Очистка всех подписчиков */
  clear(): void {
    this.subscribers = [];
  }

  /* ======================================================================== */
  /* 📦 BATCH PUSH LOGIC */
  /* ======================================================================== */

  /** Добавляет событие в batch для оптимизированной отправки */
  private async addToBatch(event: BaseAppEvent<AppEventType, unknown>): Promise<void> {
    // Добавляем событие в текущий batch
    this.currentBatch.events.push(event);

    // Если batch достиг максимального размера, отправляем немедленно
    if (this.currentBatch.events.length >= BATCH_CONFIG.MAX_BATCH_SIZE) {
      await this.processBatch();
      return;
    }

    // Если это первое событие в batch, устанавливаем таймер
    if (this.currentBatch.events.length === 1) {
      this.currentBatch.timeoutId = setTimeout(() => {
        this.processBatch().catch((err) => {
          this.logger.error('Batch processing failed', { error: err });
        });
      }, BATCH_CONFIG.BATCH_TIMEOUT_MS);
    }
  }

  /** Обрабатывает и отправляет batch событий */
  private async processBatch(): Promise<void> {
    if (this.isBatchProcessing || this.currentBatch.events.length === 0) return;

    this.isBatchProcessing = true;

    // Очищаем таймер если он был установлен
    if (this.currentBatch.timeoutId) {
      clearTimeout(this.currentBatch.timeoutId);
      this.currentBatch.timeoutId = undefined;
    }

    const eventsToProcess = [...this.currentBatch.events];
    this.currentBatch.events = [];

    try {
      // Отправляем batch событий
      await this.pushBatchToQueue(eventsToProcess);

      this.logger.info('Batch sent successfully', {
        batchSize: eventsToProcess.length,
        eventTypes: [...new Set(eventsToProcess.map((e) => e.type))],
      });
    } catch (err) {
      this.logger.error('Batch push failed, adding to retry queue', {
        error: err,
        batchSize: eventsToProcess.length,
      });

      // При ошибке batch добавляем все события в retry очередь
      for (const event of eventsToProcess) {
        await this.enqueueRetry(event);
      }
      this.processRetryQueue().catch(() => {});
    }

    this.isBatchProcessing = false;
  }

  /** Отправляет batch событий в очередь с контролем concurrency */
  private async pushBatchToQueue(events: BaseAppEvent<AppEventType, unknown>[]): Promise<void> {
    // Отправляем события батчами с контролем concurrency для предотвращения перегрузки Kafka/RabbitMQ
    for (let i = 0; i < events.length; i += BATCH_CONFIG.CONCURRENCY) {
      await Promise.all(
        events.slice(i, i + BATCH_CONFIG.CONCURRENCY).map((event) => pushToQueue(event)),
      );
    }
  }

  /* ======================================================================== */
  /* 🌀 PERSISTENT RETRY LOGIC */
  /* ======================================================================== */

  /** Загружает очередь retry из Redis при старте */
  private async loadPersistentQueue(): Promise<void> {
    try {
      const rawQueue = await this.redis.lrange(this.REDIS_KEY, 0, -1);
      this.retryQueue = rawQueue.map((item: string) => JSON.parse(item) as RetryItem);
      if (this.retryQueue.length > 0) {
        this.processRetryQueue().catch(() => {});
      }
    } catch (err) {
      this.logger.warn('Failed to load retry queue from Redis', { error: err });
    }
  }

  /** Добавляет событие в retry-очередь и сохраняет в Redis для надежности */
  private async enqueueRetry(event: BaseAppEvent<AppEventType, unknown>): Promise<void> {
    const item: RetryItem = { event, attempts: 0 };
    this.retryQueue.push(item);
    try {
      await this.redis.rpush(this.REDIS_KEY, JSON.stringify(item));
    } catch (err) {
      this.logger.warn('Failed to persist retry event in Redis', {
        error: err,
        eventType: event.type,
      });
    }
  }

  /** Обрабатывает очередь retry с экспоненциальной задержкой */
  private async processRetryQueue(): Promise<void> {
    if (this.isRetryProcessing) return;
    this.isRetryProcessing = true;

    while (this.retryQueue.length > 0) {
      const item = this.retryQueue[0];
      if (!item) break; // Safety check

      try {
        await pushToQueue(item.event);
        this.retryQueue.shift();
        await this.redis.lpop(this.REDIS_KEY);
      } catch (err) {
        item.attempts++;
        if (item.attempts > MAX_EVENT_RETRIES) {
          this.logger.error('Failed to push event after max retries', {
            eventType: item.event.type,
            attempts: MAX_EVENT_RETRIES,
            error: err,
            correlationId: item.event.meta?.correlationId,
          });
          this.retryQueue.shift();
          this.redis.lpop(this.REDIS_KEY).catch(() => {});
        } else {
          const delay = this.RETRY_BASE_DELAY * 2 ** (item.attempts - 1);
          this.logger.warn('Retrying event push', {
            eventType: item.event.type,
            attempt: item.attempts,
            delayMs: delay,
            correlationId: item.event.meta?.correlationId,
          });
          await this.sleep(delay);
        }
      }
    }

    this.isRetryProcessing = false;
  }

  /** Создает промис для асинхронной задержки */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Принудительно отправляет текущий batch (для graceful shutdown) */
  async flushBatch(): Promise<void> {
    if (this.currentBatch.events.length > 0) {
      // Очищаем таймер если он активен, чтобы избежать двойной обработки
      if (this.currentBatch.timeoutId) {
        clearTimeout(this.currentBatch.timeoutId);
        this.currentBatch.timeoutId = undefined;
      }
      await this.processBatch();
    }
  }
}
/* ========================================================================== */
/* 🌐 GLOBAL INSTANCE */
/* ========================================================================== */

/** Глобальный EventBus */
export const eventBus = new EventBus();

/* ========================================================================== */
/* 🔍 UTILITIES */
/* ========================================================================== */

/** Подписка на конкретное событие @param type - тип события @param handler - обработчик */
export function onEvent(type: AppEventType, handler: EventHandler<AppEvent>): void {
  eventBus.subscribe(type, handler);
}

/** Подписка на все события @param handler - обработчик */
export function onAnyEvent(handler: EventHandler<AppEvent>): void {
  eventBus.subscribe('*', handler);
}

/** Публикация события @param event - событие для публикации */
export async function publishEvent(event: AppEvent): Promise<void> {
  await eventBus.publish(event);
}

/** Принудительная отправка оставшихся событий в batch (для graceful shutdown) */
export async function flushEventBatch(): Promise<void> {
  await eventBus.flushBatch();
}
