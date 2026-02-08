/**
 * @file Unit тесты для packages/app/src/events/event-bus.ts
 *
 * Enterprise-grade тестирование EventBus с 100% покрытием:
 * - Конструктор и инициализация
 * - Subscribe/unsubscribe методы
 * - Publish с batch обработкой
 * - Retry логика и persistent queue
 * - Batch push с concurrency контролем
 * - Error handling и edge cases
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EventBus,
  eventBus,
  flushEventBatch,
  onAnyEvent,
  onEvent,
  publishEvent,
} from '../../../src/events/event-bus.js';
import { AppEventType, createLogoutEvent } from '../../../src/events/app-events.js';
import { UserRoles } from '../../../src/types/common.js';
import { Redis } from 'ioredis';

// Мокаем ioredis
vi.mock('ioredis', () => ({
  Redis: class MockRedis {
    lrange = vi.fn().mockResolvedValue([]);
    rpush = vi.fn().mockResolvedValue(1);
    lpop = vi.fn().mockResolvedValue('item');

    constructor() {
      // Bind methods to preserve 'this' context
      this.lrange = this.lrange.bind(this);
      this.rpush = this.rpush.bind(this);
      this.lpop = this.lpop.bind(this);
    }
  },
}));

// Мокаем pushToQueue
vi.mock('../../../src/events/app-events.js', async () => {
  const actual = await vi.importActual('../../../src/events/app-events.js');
  return {
    ...actual,
    pushToQueue: vi.fn().mockResolvedValue(undefined), // Всегда успешный push
  };
});

// Используем fake timers для всех тестов
beforeAll(() => {
  vi.useFakeTimers();
});

// Подавляем логи error и warn в тестах для чистоты вывода
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

afterAll(() => {
  vi.useRealTimers();
});

// Мокаем process.env
const originalEnv = process.env;
beforeAll(() => {
  process.env = { ...originalEnv, NODE_ENV: 'test' };
});

afterAll(() => {
  process.env = originalEnv;
  vi.unstubAllGlobals();
});

/* ========================================================================== */
/* 📊 CONSTANTS & CONFIG */
/* ========================================================================== */

/* ========================================================================== */
/* 🏭 EVENT BUS CONSTRUCTOR */
/* ========================================================================== */

describe('EventBus конструктор', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('создаёт экземпляр без параметров', () => {
    const bus = new EventBus();
    expect(bus).toBeInstanceOf(EventBus);
  });

  it('принимает Redis клиент', () => {
    const mockRedis = new Redis();
    const bus = new EventBus(mockRedis);
    expect(bus).toBeInstanceOf(EventBus);
  });

  it('принимает кастомный логгер', () => {
    const mockRedis = new Redis();
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const bus = new EventBus(mockRedis, mockLogger);
    expect(bus).toBeInstanceOf(EventBus);
  });

  it('инициализирует пустые массивы подписчиков и retry очереди', () => {
    const mockRedis = new Redis();
    const bus = new EventBus(mockRedis);
    expect((bus as any).subscribers).toEqual([]);
    expect((bus as any).retryQueue).toEqual([]);
    expect((bus as any).currentBatch).toEqual({ events: [], timeoutId: undefined });
  });

  it('загружает persistent queue при инициализации', async () => {
    const mockRedis = new Redis();
    const lrangeSpy = vi.spyOn(mockRedis, 'lrange');
    new EventBus(mockRedis);

    // Ждём выполнения асинхронной инициализации
    await vi.runOnlyPendingTimersAsync();

    expect(lrangeSpy).toHaveBeenCalledWith('eventbus:retry', 0, -1);
  });

  it('обрабатывает ошибки при загрузке persistent queue', async () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const mockRedis = new Redis();
    vi.spyOn(mockRedis, 'lrange').mockRejectedValue(new Error('Redis error'));

    new EventBus(mockRedis, mockLogger);

    // Ждём выполнения асинхронной инициализации
    await vi.runOnlyPendingTimersAsync();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to load retry queue from Redis',
      expect.any(Object),
    );
  });
});

/* ========================================================================== */
/* 📡 SUBSCRIBE/UNSUBSCRIBE */
/* ========================================================================== */

describe('Subscribe/Unsubscribe методы', () => {
  let bus: EventBus;
  let mockRedis: Redis;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = new Redis();
    bus = new EventBus(mockRedis);
  });

  describe('subscribe', () => {
    it('добавляет подписчика на конкретный тип события', () => {
      const handler = vi.fn();
      bus.subscribe(AppEventType.AuthLogout, handler);

      expect((bus as any).subscribers).toHaveLength(1);
      expect((bus as any).subscribers[0]).toEqual({
        type: AppEventType.AuthLogout,
        handler,
      });
    });

    it('добавляет подписчика на все события', () => {
      const handler = vi.fn();
      bus.subscribe('*', handler);

      expect((bus as any).subscribers).toHaveLength(1);
      expect((bus as any).subscribers[0]).toEqual({
        type: '*',
        handler,
      });
    });

    it('позволяет добавить несколько подписчиков', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.subscribe(AppEventType.AuthLogout, handler1);
      bus.subscribe(AppEventType.AuthExpired, handler2);

      expect((bus as any).subscribers).toHaveLength(2);
    });
  });

  describe('unsubscribe', () => {
    it('удаляет конкретного подписчика', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.subscribe(AppEventType.AuthLogout, handler1);
      bus.subscribe(AppEventType.AuthLogout, handler2);

      expect((bus as any).subscribers).toHaveLength(2);

      bus.unsubscribe(handler1);
      expect((bus as any).subscribers).toHaveLength(1);
      expect((bus as any).subscribers[0].handler).toBe(handler2);
    });

    it('не делает ничего если подписчик не найден', () => {
      const handler = vi.fn();
      bus.subscribe(AppEventType.AuthLogout, handler);

      bus.unsubscribe(vi.fn()); // несуществующий handler

      expect((bus as any).subscribers).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('очищает всех подписчиков', () => {
      bus.subscribe(AppEventType.AuthLogout, vi.fn());
      bus.subscribe(AppEventType.AuthExpired, vi.fn());

      expect((bus as any).subscribers).toHaveLength(2);

      bus.clear();
      expect((bus as any).subscribers).toEqual([]);
    });
  });
});

/* ========================================================================== */
/* 📢 PUBLISH METHOD */
/* ========================================================================== */

describe('Publish метод', () => {
  let bus: EventBus;
  let mockRedis: Redis;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis = new Redis();
    bus = new EventBus(mockRedis);
  });

  it('уведомляет релевантных подписчиков', async () => {
    const logoutHandler = vi.fn();
    const anyHandler = vi.fn();

    bus.subscribe(AppEventType.AuthLogout, logoutHandler);
    bus.subscribe('*', anyHandler);

    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    expect(logoutHandler).toHaveBeenCalledWith(event);
    expect(anyHandler).toHaveBeenCalledWith(event);
  });

  it('не уведомляет нерелевантных подписчиков', async () => {
    const expiredHandler = vi.fn();

    bus.subscribe(AppEventType.AuthExpired, expiredHandler);

    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    expect(expiredHandler).not.toHaveBeenCalled();
  });

  it('обрабатывает ошибки в обработчиках событий', async () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    bus = new EventBus(mockRedis, mockLogger);

    const failingHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
    bus.subscribe('*', failingHandler);

    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Handler failed for event',
      expect.objectContaining({
        eventType: event.type,
        error: expect.any(Error),
      }),
    );
  });

  it('добавляет событие в batch для отправки', async () => {
    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    expect((bus as any).currentBatch.events).toHaveLength(1);
    expect((bus as any).currentBatch.events[0]).toBe(event);
  });

  it('запускает batch обработку', async () => {
    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    // Проверяем что событие добавлено в batch
    expect((bus as any).currentBatch.events).toHaveLength(1);
  });
});

/* ========================================================================== */
/* 📦 BATCH LOGIC */
/* ========================================================================== */

describe('Batch логика', () => {
  let bus: EventBus;
  let mockRedis: Redis;
  let mockPushToQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis = new Redis();

    const appEvents = await import('../../../src/events/app-events.js');
    mockPushToQueue = appEvents.pushToQueue;

    bus = new EventBus(mockRedis);
  });

  describe('addToBatch', () => {
    it('добавляет событие в текущий batch', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      await (bus as any).addToBatch(event);

      expect((bus as any).currentBatch.events).toEqual([event]);
    });

    it('отправляет batch при достижении MAX_BATCH_SIZE', async () => {
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push(
          await createLogoutEvent({
            payloadVersion: 1,
            userId: `user-${i}`,
            roles: [UserRoles.USER],
            reason: 'manual',
          }),
        );
      }

      // Добавляем 9 событий
      for (let i = 0; i < 9; i++) {
        await (bus as any).addToBatch(events[i]);
      }

      expect((bus as any).currentBatch.events).toHaveLength(9);

      // Добавляем 10-е событие - должно вызвать отправку
      await (bus as any).addToBatch(events[9]);

      expect(mockPushToQueue).toHaveBeenCalledTimes(10); // Все события отправлены
      expect((bus as any).currentBatch.events).toEqual([]);
    });

    it('устанавливает таймер для первого события', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      await (bus as any).addToBatch(event);

      // Проверяем что таймер установлен (timeoutId не undefined)
      expect((bus as any).currentBatch.timeoutId).toBeDefined();
    });

    it('не устанавливает таймер для последующих событий', async () => {
      const event1 = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-1',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      const event2 = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-2',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      await (bus as any).addToBatch(event1);
      const firstTimeoutId = (bus as any).currentBatch.timeoutId;

      await (bus as any).addToBatch(event2);

      // Таймер должен остаться тем же (не переустановлен)
      expect((bus as any).currentBatch.timeoutId).toBe(firstTimeoutId);
    });
  });

  describe('processBatch', () => {
    it('отправляет все события из batch', async () => {
      const events = [];
      for (let i = 0; i < 3; i++) {
        events.push(
          await createLogoutEvent({
            payloadVersion: 1,
            userId: `user-${i}`,
            roles: [UserRoles.USER],
            reason: 'manual',
          }),
        );
      }

      (bus as any).currentBatch.events = events;

      await (bus as any).processBatch();

      expect(mockPushToQueue).toHaveBeenCalledTimes(3);
      expect((bus as any).currentBatch.events).toEqual([]);
    });

    it('отправляет события с concurrency контролем', async () => {
      const events = [];
      for (let i = 0; i < 12; i++) { // Больше чем CONCURRENCY (5)
        events.push(
          await createLogoutEvent({
            payloadVersion: 1,
            userId: `user-${i}`,
            roles: [UserRoles.USER],
            reason: 'manual',
          }),
        );
      }

      (bus as any).currentBatch.events = events;

      await (bus as any).processBatch();

      // Должно быть 3 вызова Promise.all (12/5 = 2.4, округляем вверх)
      expect(mockPushToQueue).toHaveBeenCalledTimes(12);
    });

    it('очищает таймер перед обработкой', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (bus as any).currentBatch.events = [event];
      (bus as any).currentBatch.timeoutId = 'mock-timeout-id' as any;

      await (bus as any).processBatch();

      expect((bus as any).currentBatch.timeoutId).toBeUndefined();
    });

    it('добавляет события в retry при ошибке отправки', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      bus = new EventBus(mockRedis, mockLogger);

      mockPushToQueue.mockRejectedValue(new Error('Push failed'));

      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (bus as any).currentBatch.events = [event];

      await (bus as any).processBatch();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Batch push failed, adding to retry queue',
        expect.objectContaining({
          error: expect.any(Error),
          batchSize: 1,
        }),
      );

      expect((bus as any).retryQueue).toHaveLength(1);
      expect((bus as any).retryQueue[0].event).toBe(event);
    });

    it('не делает ничего если batch пустой', async () => {
      await (bus as any).processBatch();

      expect(mockPushToQueue).not.toHaveBeenCalled();
    });

    it('предотвращает параллельную обработку batch', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (bus as any).currentBatch.events = [event];
      (bus as any).isBatchProcessing = true;

      await (bus as any).processBatch();

      expect(mockPushToQueue).not.toHaveBeenCalled();
    });
  });

  describe('flushBatch', () => {
    it('принудительно отправляет текущий batch', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (bus as any).currentBatch.events = [event];
      (bus as any).currentBatch.timeoutId = 'mock-timeout-id' as any;

      await bus.flushBatch();

      expect(mockPushToQueue).toHaveBeenCalledWith(event);
      expect((bus as any).currentBatch.events).toEqual([]);
    });

    it('не делает ничего если batch пустой', async () => {
      await bus.flushBatch();

      expect(mockPushToQueue).not.toHaveBeenCalled();
    });
  });
});

/* ========================================================================== */
/* 🔄 RETRY LOGIC */
/* ========================================================================== */

describe('Retry логика', () => {
  let bus: EventBus;
  let mockRedis: Redis;
  let mockPushToQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis = new Redis();

    const appEvents = await import('../../../src/events/app-events.js');
    mockPushToQueue = appEvents.pushToQueue;

    bus = new EventBus(mockRedis);
  });

  describe('enqueueRetry', () => {
    it('добавляет событие в retry очередь', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      await (bus as any).enqueueRetry(event);

      expect((bus as any).retryQueue).toHaveLength(1);
      expect((bus as any).retryQueue[0]).toEqual({
        event,
        attempts: 0,
      });
    });

    it('сохраняет событие в Redis', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      const rpushSpy = vi.spyOn(mockRedis, 'rpush');
      await (bus as any).enqueueRetry(event);

      expect(rpushSpy).toHaveBeenCalledWith(
        'eventbus:retry',
        expect.stringContaining(JSON.stringify({
          event,
          attempts: 0,
        })),
      );
    });

    it('обрабатывает ошибки Redis', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      bus = new EventBus(mockRedis, mockLogger);

      vi.spyOn(mockRedis, 'rpush').mockRejectedValue(new Error('Redis error'));

      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      await (bus as any).enqueueRetry(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to persist retry event in Redis',
        expect.objectContaining({
          error: expect.any(Error),
          eventType: event.type,
        }),
      );
    });
  });

  describe('processRetryQueue', () => {
    it('отправляет событие из retry очереди', async () => {
      // Mock pushToQueue для успешной отправки в этом тесте
      mockPushToQueue.mockResolvedValueOnce(undefined);

      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (bus as any).retryQueue = [{ event, attempts: 0 }];
      const lpopSpy = vi.spyOn(mockRedis, 'lpop');

      await (bus as any).processRetryQueue();

      expect(mockPushToQueue).toHaveBeenCalledWith(event);
      expect((bus as any).retryQueue).toEqual([]);
      expect(lpopSpy).toHaveBeenCalledWith('eventbus:retry');
    });

    it('увеличивает attempts при ошибке и применяет exponential backoff', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const mockBus = new EventBus(mockRedis, mockLogger);
      const sleepSpy = vi.spyOn(mockBus as any, 'sleep').mockResolvedValue(undefined);

      // Отключаем успешный push для этого теста
      mockPushToQueue.mockRejectedValue(new Error('Push failed'));

      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (mockBus as any).retryQueue = [{ event, attempts: 0 }];

      // Запускаем обработку retry - она должна fail и запланировать retry
      await (mockBus as any).processRetryQueue();

      // Проверяем что logger.warn был вызван для retry
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Retrying event push',
        expect.objectContaining({
          eventType: event.type,
          attempt: 1,
          delayMs: 1000,
        }),
      );

      // Проверяем что sleep был вызван для задержки
      expect(sleepSpy).toHaveBeenCalledWith(1000);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Retrying event push',
        expect.objectContaining({
          eventType: event.type,
          attempt: 1,
          delayMs: 1000,
        }),
      );
      expect(sleepSpy).toHaveBeenCalledWith(1000);
    });

    it('удаляет событие после MAX_RETRIES неудачных попыток', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      bus = new EventBus(mockRedis, mockLogger);

      // Mock sleep to avoid real delays
      const sleepSpy = vi.spyOn(bus as any, 'sleep').mockResolvedValue(undefined);

      // Всегда возвращаем ошибку для этого теста
      mockPushToQueue.mockRejectedValue(new Error('Push failed'));

      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (bus as any).retryQueue = [{ event, attempts: 5 }]; // MAX_RETRIES достигнуто
      const lpopSpy = vi.spyOn(mockRedis, 'lpop');

      await (bus as any).processRetryQueue();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to push event after max retries',
        expect.objectContaining({
          eventType: event.type,
          attempts: 5,
        }),
      );

      expect((bus as any).retryQueue).toEqual([]);
      expect(lpopSpy).toHaveBeenCalledWith('eventbus:retry');
      expect(sleepSpy).not.toHaveBeenCalled(); // Не должен ждать после MAX_RETRIES
    });

    it('предотвращает параллельную обработку retry очереди', async () => {
      (bus as any).isRetryProcessing = true;

      await (bus as any).processRetryQueue();

      expect(mockPushToQueue).not.toHaveBeenCalled();
    });

    it('не делает ничего если очередь пустая', async () => {
      await (bus as any).processRetryQueue();

      expect(mockPushToQueue).not.toHaveBeenCalled();
    });
  });

  describe('loadPersistentQueue', () => {
    it('загружает события из Redis и добавляет в retry очередь', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      const retryItem = { event, attempts: 5 };
      const lrangeSpy = vi.spyOn(mockRedis, 'lrange').mockResolvedValue([
        JSON.stringify(retryItem),
      ]);
      // Mock processRetryQueue to prevent automatic processing
      const processRetrySpy = vi.spyOn(bus as any, 'processRetryQueue').mockResolvedValue(
        undefined,
      );

      await (bus as any).loadPersistentQueue();

      expect(lrangeSpy).toHaveBeenCalledWith('eventbus:retry', 0, -1);
      expect((bus as any).retryQueue).toEqual([retryItem]);
      expect(processRetrySpy).toHaveBeenCalled();
    });

    it('запускает обработку retry очереди если есть события', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      vi.spyOn(mockRedis, 'lrange').mockResolvedValue([JSON.stringify({ event, attempts: 0 })]);

      await (bus as any).loadPersistentQueue();

      expect(mockPushToQueue).toHaveBeenCalledWith(event);
    });

    it('обрабатывает ошибки Redis', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      bus = new EventBus(mockRedis, mockLogger);

      vi.spyOn(mockRedis, 'lrange').mockRejectedValue(new Error('Redis error'));

      await (bus as any).loadPersistentQueue();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to load retry queue from Redis',
        { error: expect.any(Error) },
      );
    });
  });
});

/* ========================================================================== */
/* 🔧 UTILITY FUNCTIONS */
/* ========================================================================== */

describe('Utility функции', () => {
  let bus: EventBus;
  let mockRedis: Redis;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = new Redis();
    bus = new EventBus(mockRedis);
  });

  describe('sleep', () => {
    it('создаёт промис для задержки', async () => {
      const start = Date.now();
      const sleepPromise = (bus as any).sleep(100);

      // С fake timers время не проходит автоматически, нужно продвинуть время
      vi.advanceTimersByTime(100);
      await sleepPromise;

      const end = Date.now();

      expect(end - start).toBe(100); // С fake timers время должно быть точным
    });
  });
});

/* ========================================================================== */
/* 🌐 GLOBAL INSTANCE & EXPORTS */
/* ========================================================================== */

describe('Глобальный экземпляр и экспорты', () => {
  it('eventBus является экземпляром EventBus', () => {
    expect(eventBus).toBeInstanceOf(EventBus);
  });

  describe('onEvent', () => {
    it('подписывает обработчик на конкретный тип события', () => {
      const handler = vi.fn();
      onEvent(AppEventType.AuthLogout, handler);

      expect((eventBus as any).subscribers).toContainEqual({
        type: AppEventType.AuthLogout,
        handler,
      });
    });
  });

  describe('onAnyEvent', () => {
    it('подписывает обработчик на все события', () => {
      const handler = vi.fn();
      onAnyEvent(handler);

      expect((eventBus as any).subscribers).toContainEqual({
        type: '*',
        handler,
      });
    });
  });

  describe('publishEvent', () => {
    it('публикует событие через глобальный eventBus', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      await publishEvent(event);

      // Проверяем что событие добавлено в batch
      expect((eventBus as any).currentBatch.events).toContain(event);
    });
  });

  describe('flushEventBatch', () => {
    it('принудительно отправляет batch через глобальный eventBus', async () => {
      const event = await createLogoutEvent({
        payloadVersion: 1,
        userId: 'user-123',
        roles: [UserRoles.USER],
        reason: 'manual',
      });

      (eventBus as any).currentBatch.events = [event];

      await flushEventBatch();

      expect((eventBus as any).currentBatch.events).toEqual([]);
    });
  });
});

/* ========================================================================== */
/* 🧪 INTEGRATION & EDGE CASES */
/* ========================================================================== */

describe('Интеграция и edge cases', () => {
  it('работает с большим количеством подписчиков', async () => {
    const bus = new EventBus();
    const handlers = [];

    // Создаём 100 подписчиков
    for (let i = 0; i < 100; i++) {
      const handler = vi.fn();
      handlers.push(handler);
      bus.subscribe('*', handler);
    }

    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    handlers.forEach((handler) => {
      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  it('правильно обрабатывает несколько типов подписчиков', async () => {
    const bus = new EventBus();
    const specificHandler = vi.fn();
    const anyHandler = vi.fn();

    bus.subscribe(AppEventType.AuthLogout, specificHandler);
    bus.subscribe('*', anyHandler);

    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    expect(specificHandler).toHaveBeenCalledWith(event);
    expect(anyHandler).toHaveBeenCalledWith(event);
  });

  it('batch timeout корректно очищается при flushBatch', async () => {
    const mockRedis = new Redis();
    const bus = new EventBus(mockRedis);
    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    // Добавляем событие в batch (устанавливается таймер)
    await (bus as any).addToBatch(event);
    expect((bus as any).currentBatch.timeoutId).toBeDefined();

    // Flush очищает таймер
    await bus.flushBatch();
    expect((bus as any).currentBatch.timeoutId).toBeUndefined();
  });

  it('обработка ошибок не прерывает выполнение других обработчиков', async () => {
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const bus = new EventBus(undefined, mockLogger);

    const failingHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
    const successHandler = vi.fn();

    bus.subscribe('*', failingHandler);
    bus.subscribe('*', successHandler);

    const event = await createLogoutEvent({
      payloadVersion: 1,
      userId: 'user-123',
      roles: [UserRoles.USER],
      reason: 'manual',
    });

    await bus.publish(event);

    expect(failingHandler).toHaveBeenCalledWith(event);
    expect(successHandler).toHaveBeenCalledWith(event); // Должен выполниться несмотря на ошибку в первом
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
