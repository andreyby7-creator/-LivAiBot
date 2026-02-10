/**
 * @file Unit тесты для packages/app/src/lib/app-lifecycle.ts
 *
 * Тестирование lifecycle orchestrator с 100% покрытием:
 * - Bootstrap/teardown стадий
 * - Подписка на lifecycle события
 * - Обработка ошибок хэндлеров
 * - Идемпотентность операций
 * - Reset internal state
 * - Event emission
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appLifecycle } from '../../../src/lib/app-lifecycle';
import { AppLifecycleEvent, appLifecycleEvents } from '../../../src/events/app-lifecycle-events';

// Mock dependencies
vi.mock('../../../src/events/app-lifecycle-events', () => ({
  appLifecycleEvents: {
    emit: vi.fn(),
  },
  AppLifecycleEvent: {
    APP_BOOTSTRAP: 'app:bootstrap',
    APP_TEARDOWN: 'app:teardown',
    APP_RESET: 'app:reset',
    APP_LIFECYCLE_HANDLER_ERROR: 'app:lifecycle-handler-error',
  },
}));

vi.mock('../../../src/background/tasks', () => ({
  startBackgroundTasks: vi.fn().mockResolvedValue(undefined),
  stopBackgroundTasks: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import { startBackgroundTasks, stopBackgroundTasks } from '../../../src/background/tasks';

/* ============================================================================
 * 🧠 HELPER FUNCTIONS
 * ============================================================================ */

function createMockHandler(): () => void {
  return vi.fn().mockImplementation(() => undefined);
}

function createThrowingHandler(error: Readonly<Error>): () => void {
  return vi.fn().mockImplementation(() => {
    throw error;
  });
}

/* ============================================================================
 * 🧪 TESTS
 * ============================================================================ */

describe('App Lifecycle', () => {
  beforeEach(() => {
    // Reset internal state before each test
    appLifecycle.resetInternalState();

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('bootstrap()', () => {
    it('должен выполнять bootstrap до features по умолчанию', async () => {
      await appLifecycle.bootstrap();

      expect(startBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_BOOTSTRAP);
    });

    it('должен быть идемпотентным', async () => {
      await appLifecycle.bootstrap();
      await appLifecycle.bootstrap();

      // Вызывается только один раз
      expect(startBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledTimes(1);
    });

    it('должен выполнять только infra стадию', async () => {
      await appLifecycle.bootstrap('infra');

      expect(startBackgroundTasks).not.toHaveBeenCalled();
      expect(appLifecycleEvents.emit).not.toHaveBeenCalled();
    });

    it('должен выполнять infra и tasks стадии', async () => {
      await appLifecycle.bootstrap('tasks');

      expect(startBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).not.toHaveBeenCalled();
    });

    it('должен принимать массив стадий и выполнять их по порядку', async () => {
      await appLifecycle.bootstrap(['infra', 'tasks']);

      expect(startBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).not.toHaveBeenCalled();
    });

    it('должен выполнять stages из массива с features', async () => {
      await appLifecycle.bootstrap(['tasks', 'features']);

      expect(startBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_BOOTSTRAP);
    });

    it('должен игнорировать повторные вызовы после завершения', async () => {
      await appLifecycle.bootstrap();

      // Попытка выполнить частичную загрузку после полной
      await appLifecycle.bootstrap('infra');

      expect(startBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('teardown()', () => {
    it('должен выполнять полный teardown по умолчанию', async () => {
      await appLifecycle.teardown();

      expect(stopBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_TEARDOWN);
    });

    it('должен быть идемпотентным', async () => {
      await appLifecycle.teardown();
      await appLifecycle.teardown();

      expect(stopBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledTimes(1);
    });

    it('должен выполнять полный teardown по умолчанию (features)', async () => {
      await appLifecycle.teardown();

      expect(stopBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_TEARDOWN);
    });

    it('должен выполнять только указанные стадии из массива', async () => {
      await appLifecycle.teardown(['features']);

      expect(stopBackgroundTasks).not.toHaveBeenCalled();
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_TEARDOWN);
    });

    it('должен выполнять tasks и features стадии', async () => {
      await appLifecycle.teardown('tasks');

      expect(stopBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_TEARDOWN);
    });

    it('должен принимать массив стадий и выполнять их по порядку', async () => {
      await appLifecycle.teardown(['features', 'tasks']);

      expect(stopBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_TEARDOWN);
    });

    it('должен игнорировать повторные вызовы после завершения', async () => {
      await appLifecycle.teardown();

      await appLifecycle.teardown('tasks');

      expect(stopBackgroundTasks).toHaveBeenCalledTimes(1);
      expect(appLifecycleEvents.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('onLifecycle()', () => {
    it('должен позволять подписаться на событие', () => {
      const handler = createMockHandler();

      const unsubscribe = appLifecycle.onLifecycle('BOOTSTRAP', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('должен вызывать handler при emit', async () => {
      const handler = createMockHandler();

      appLifecycle.onLifecycle('BOOTSTRAP', handler);
      await appLifecycle.bootstrap();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('должен позволять несколько подписок на одно событие', async () => {
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      appLifecycle.onLifecycle('BOOTSTRAP', handler1);
      appLifecycle.onLifecycle('BOOTSTRAP', handler2);
      await appLifecycle.bootstrap();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('должен позволять отписку', async () => {
      const handler = createMockHandler();

      const unsubscribe = appLifecycle.onLifecycle('BOOTSTRAP', handler);
      unsubscribe();
      await appLifecycle.bootstrap();

      expect(handler).not.toHaveBeenCalled();
    });

    it('должен логировать повторную подписку в dev режиме', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.stubEnv('NODE_ENV', 'development');

      try {
        const handler = createMockHandler();

        // Первая подписка
        appLifecycle.onLifecycle('BOOTSTRAP', handler);
        // Повторная подписка того же handler'а
        appLifecycle.onLifecycle('BOOTSTRAP', handler);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Handler уже подписан на событие BOOTSTRAP'),
        );
      } finally {
        vi.unstubAllEnvs();
        consoleWarnSpy.mockRestore();
      }
    });

    it('не должен логировать повторную подписку в production', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.stubEnv('NODE_ENV', 'production');

      try {
        const handler = createMockHandler();

        appLifecycle.onLifecycle('BOOTSTRAP', handler);
        appLifecycle.onLifecycle('BOOTSTRAP', handler);

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
        consoleWarnSpy.mockRestore();
      }
    });
  });

  describe('resetInternalState()', () => {
    it('должен сбрасывать bootstrap состояние', async () => {
      await appLifecycle.bootstrap();

      appLifecycle.resetInternalState();

      // После reset можно снова выполнить bootstrap
      await appLifecycle.bootstrap();

      expect(startBackgroundTasks).toHaveBeenCalledTimes(2);
      expect(appLifecycleEvents.emit).toHaveBeenCalledTimes(2);
    });

    it('должен сбрасывать teardown состояние', async () => {
      await appLifecycle.teardown();

      appLifecycle.resetInternalState();

      // После reset можно снова выполнить teardown
      await appLifecycle.teardown();

      expect(stopBackgroundTasks).toHaveBeenCalledTimes(2);
      expect(appLifecycleEvents.emit).toHaveBeenCalledTimes(2);
    });

    it('должен очищать все подписки', async () => {
      const handler = createMockHandler();

      appLifecycle.onLifecycle('BOOTSTRAP', handler);
      appLifecycle.resetInternalState();

      await appLifecycle.bootstrap();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('должен изолировать ошибки в lifecycle handlers', async () => {
      const error = new Error('Handler error');
      const throwingHandler = createThrowingHandler(error);

      appLifecycle.onLifecycle('BOOTSTRAP', throwingHandler);
      await appLifecycle.bootstrap();

      // Handler был вызван и выбросил ошибку
      expect(throwingHandler).toHaveBeenCalledTimes(1);

      // Но система продолжила работать и отправила событие
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_BOOTSTRAP);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(
        AppLifecycleEvent.APP_LIFECYCLE_HANDLER_ERROR,
      );
    });

    it('должен отправлять специальное событие при ошибке handler', async () => {
      const error = new Error('Handler error');
      const throwingHandler = createThrowingHandler(error);

      appLifecycle.onLifecycle('BOOTSTRAP', throwingHandler);
      await appLifecycle.bootstrap();

      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(
        AppLifecycleEvent.APP_LIFECYCLE_HANDLER_ERROR,
      );
    });

    it('должен продолжать выполнение других handlers при ошибке одного', async () => {
      const error = new Error('Handler error');
      const throwingHandler = createThrowingHandler(error);
      const normalHandler = createMockHandler();

      appLifecycle.onLifecycle('BOOTSTRAP', throwingHandler);
      appLifecycle.onLifecycle('BOOTSTRAP', normalHandler);
      await appLifecycle.bootstrap();

      expect(throwingHandler).toHaveBeenCalledTimes(1);
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration scenarios', () => {
    it('bootstrap → onLifecycle → teardown должен работать корректно', async () => {
      const bootstrapHandler = createMockHandler();
      const teardownHandler = createMockHandler();

      appLifecycle.onLifecycle('BOOTSTRAP', bootstrapHandler);
      appLifecycle.onLifecycle('TEARDOWN', teardownHandler);

      await appLifecycle.bootstrap();
      await appLifecycle.teardown();

      expect(bootstrapHandler).toHaveBeenCalledTimes(1);
      expect(teardownHandler).toHaveBeenCalledTimes(1);

      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_BOOTSTRAP);
      expect(appLifecycleEvents.emit).toHaveBeenCalledWith(AppLifecycleEvent.APP_TEARDOWN);
    });

    it('должен поддерживать reset и повторное использование', async () => {
      const handler = createMockHandler();

      appLifecycle.onLifecycle('BOOTSTRAP', handler);
      await appLifecycle.bootstrap();

      expect(handler).toHaveBeenCalledTimes(1);

      // Reset и повторное использование
      appLifecycle.resetInternalState();
      await appLifecycle.bootstrap();

      expect(handler).toHaveBeenCalledTimes(1); // Handler был очищен reset'ом
      expect(appLifecycleEvents.emit).toHaveBeenCalledTimes(2);
    });
  });
});
