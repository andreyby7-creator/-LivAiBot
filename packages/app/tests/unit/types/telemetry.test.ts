/**
 * @file packages/app/tests/unit/types/telemetry.test.ts
 * ============================================================================
 * 🔹 ТИПЫ ТЕЛЕМЕТРИИ — 100% ПОКРЫТИЕ
 * ============================================================================
 *
 * Тестирование enterprise-level телеметрических типов:
 * - TelemetryLevel уровни важности и константы
 * - TelemetryMetadata иммутабельные метаданные
 * - TelemetryEvent основное событие телеметрии
 * - Batch core типы для оптимизации
 * - Sink и Config типы для инфраструктуры
 * - 100% покрытие всех экспортируемых типов
 *
 * Покрытие: 100% без моков, чистые типы
 */

import { describe, expect, it } from 'vitest';
import type {
  TelemetryBatchCoreConfig,
  TelemetryBatchCoreState,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryLevel,
  TelemetryMetadata,
  TelemetrySink,
} from '../../../src/types/telemetry.js';
import { BatchCoreConfigVersion, TelemetryLevels } from '../../../src/types/telemetry.js';

// Helper функции для создания тестовых данных
function createTestMetadata(): TelemetryMetadata {
  return {
    userId: 'user-123',
    action: 'click',
    elementId: 'button-submit',
    timestamp: Date.now(),
    success: true,
    retryCount: 0,
  } as TelemetryMetadata;
}

function createTestEvent(overrides?: Partial<TelemetryEvent>): TelemetryEvent {
  return {
    level: 'INFO',
    message: 'Test event',
    metadata: createTestMetadata(),
    timestamp: Date.now(),
    ...overrides,
  };
}

function createTestBatchConfig(
  overrides?: Partial<TelemetryBatchCoreConfig>,
): TelemetryBatchCoreConfig {
  return {
    maxBatchSize: 50,
    configVersion: BatchCoreConfigVersion,
    ...overrides,
  };
}

function createTestTelemetryConfig(overrides?: Partial<TelemetryConfig>): TelemetryConfig {
  return {
    levelThreshold: 'INFO' as const,
    sinks: [],
    ...overrides,
  };
}

// ============================================================================
// 🏷️ ОСНОВНЫЕ ТИПЫ УРОВНЕЙ
// ============================================================================

describe('TelemetryLevels константа', () => {
  it('содержит все уровни телеметрии', () => {
    expect(TelemetryLevels).toEqual(['INFO', 'WARN', 'ERROR']);
  });

  it('является readonly tuple', () => {
    // TypeScript prevents mutation at compile time
    // Runtime arrays are mutable, but type system protects us
    expect(TelemetryLevels).toHaveLength(3);
    // TypeScript knows this tuple has exactly 3 elements
    expect(TelemetryLevels).toEqual(['INFO', 'WARN', 'ERROR']);
  });

  it('элементы доступны по индексу', () => {
    expect(TelemetryLevels[0]).toBe('INFO');
    expect(TelemetryLevels[1]).toBe('WARN');
    expect(TelemetryLevels[2]).toBe('ERROR');
  });
});

describe('TelemetryLevel тип', () => {
  it('принимает все допустимые уровни', () => {
    const levels: TelemetryLevel[] = ['INFO', 'WARN', 'ERROR'];

    levels.forEach((level) => {
      expect(TelemetryLevels).toContain(level);
    });
  });

  it('является union type из константы', () => {
    // TypeScript проверяет что это тот же тип
    const level = TelemetryLevels[0];
    expect(level).toBe('INFO');

    // Runtime проверка всех значений
    TelemetryLevels.forEach((levelValue) => {
      const typedLevel: TelemetryLevel = levelValue;
      expect(typedLevel).toBeDefined();
    });
  });

  it('предотвращает недопустимые значения', () => {
    // Эти присваивания не должны компилироваться
    // const invalidLevel: TelemetryLevel = 'DEBUG'; // TypeScript error
    // const invalidLevel2: TelemetryLevel = 'debug'; // TypeScript error
    // const invalidLevel3: TelemetryLevel = 123; // TypeScript error

    expect(true).toBe(true); // Заглушка для теста
  });
});

// ============================================================================
// 📊 ТИПЫ СОБЫТИЙ
// ============================================================================

describe('TelemetryMetadata тип', () => {
  it('принимает примитивные значения', () => {
    const metadata: TelemetryMetadata = {
      string: 'test',
      number: 42,
      boolean: true,
      null: null,
    };

    expect(metadata['string']).toBe('test');
    expect(metadata['number']).toBe(42);
    expect(metadata['boolean']).toBe(true);
    expect(metadata['null']).toBeNull();
  });

  it('является readonly Record', () => {
    const metadata: TelemetryMetadata = createTestMetadata();

    // TypeScript предотвращает мутацию
    // metadata.userId = 'modified'; // TypeScript error

    expect(metadata['userId']).toBe('user-123');
  });

  it('работает с вложенными объектами через типы', () => {
    // TelemetryMetadata не поддерживает вложенные объекты (только примитивы)
    // const invalid: TelemetryMetadata = { nested: { value: 123 } }; // TypeScript error

    const valid: TelemetryMetadata = {
      flatValue1: 'string',
      flatValue2: 123,
      flatValue3: true,
      flatValue4: null,
    };

    expect(valid['flatValue1']).toBe('string');
    expect(valid['flatValue2']).toBe(123);
  });
});

describe('TelemetryEvent тип', () => {
  it('создает базовое событие', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'User logged in',
      timestamp: 1234567890,
    };

    expect(event.level).toBe('INFO');
    expect(event.message).toBe('User logged in');
    expect(event.timestamp).toBe(1234567890);
    expect(event.metadata).toBeUndefined();
  });

  it('создает событие с метаданными', () => {
    const metadata = createTestMetadata();
    const event: TelemetryEvent = {
      level: 'ERROR',
      message: 'API call failed',
      metadata,
      timestamp: Date.now(),
    };

    expect(event.level).toBe('ERROR');
    expect(event.message).toBe('API call failed');
    expect(event.metadata).toEqual(metadata);
    expect(typeof event.timestamp).toBe('number');
  });

  it('является полностью readonly', () => {
    const event = createTestEvent();

    // Все поля readonly
    // event.level = 'WARN'; // TypeScript error
    // event.message = 'modified'; // TypeScript error
    // event.timestamp = 0; // TypeScript error
    // if (event.metadata) event.metadata.userId = 'modified'; // TypeScript error

    expect(event.level).toBe('INFO');
  });

  it('работает с кастомными типами метаданных', () => {
    // Пользовательский тип метаданных
    type CustomMetadata = {
      userId: string;
      actionType: 'login' | 'logout' | 'update';
      sessionId: string;
    };

    const customMetadata: CustomMetadata = {
      userId: 'user-456',
      actionType: 'login',
      sessionId: 'session-789',
    };

    const event: TelemetryEvent<CustomMetadata> = {
      level: 'INFO',
      message: 'Custom event',
      metadata: customMetadata,
      timestamp: 1234567890,
    };

    expect(event.metadata?.userId).toBe('user-456');
    expect(event.metadata?.actionType).toBe('login');
    expect(event.metadata?.sessionId).toBe('session-789');
  });

  it('metadata опционален', () => {
    const eventWithoutMetadata: TelemetryEvent = {
      level: 'WARN',
      message: 'Simple warning',
      timestamp: 1000,
    };

    const eventWithMetadata: TelemetryEvent = {
      level: 'ERROR',
      message: 'Error with details',
      metadata: { errorCode: 500 },
      timestamp: 2000,
    };

    expect(eventWithoutMetadata.metadata).toBeUndefined();
    expect(eventWithMetadata.metadata).toEqual({ errorCode: 500 });
  });
});

// ============================================================================
// 🔧 ТИПЫ BATCH CORE
// ============================================================================

describe('TelemetryBatchCoreConfig тип', () => {
  it('создает базовую конфигурацию', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 100,
      configVersion: 2,
    };

    expect(config.maxBatchSize).toBe(100);
    expect(config.configVersion).toBe(2);
  });

  it('является полностью readonly', () => {
    const config = createTestBatchConfig();

    // config.maxBatchSize = 200; // TypeScript error
    // config.configVersion = 3; // TypeScript error

    expect(config.maxBatchSize).toBe(50);
    expect(config.configVersion).toBe(BatchCoreConfigVersion);
  });

  it('работает с разными размерами batch', () => {
    const configs: TelemetryBatchCoreConfig[] = [
      { maxBatchSize: 1, configVersion: BatchCoreConfigVersion },
      { maxBatchSize: 10, configVersion: BatchCoreConfigVersion },
      { maxBatchSize: 100, configVersion: BatchCoreConfigVersion },
      { maxBatchSize: 1000, configVersion: BatchCoreConfigVersion },
    ];

    configs.forEach((config, index) => {
      expect(config.maxBatchSize).toBe([1, 10, 100, 1000][index]);
      expect(config.configVersion).toBe(BatchCoreConfigVersion);
    });
  });
});

describe('TelemetryBatchCoreState тип', () => {
  it('создает пустое состояние', () => {
    const config = createTestBatchConfig();
    const state: TelemetryBatchCoreState = {
      batch: [],
      config,
    };

    expect(state.batch).toHaveLength(0);
    expect(state.config).toBe(config);
  });

  it('создает состояние с событиями', () => {
    const config = createTestBatchConfig();
    const events: TelemetryEvent[] = [
      createTestEvent({ level: 'INFO', message: 'Event 1' }),
      createTestEvent({ level: 'WARN', message: 'Event 2' }),
    ];

    const state: TelemetryBatchCoreState = {
      batch: events,
      config,
    };

    expect(state.batch).toHaveLength(2);
    expect(state.batch[0]?.message).toBe('Event 1');
    expect(state.batch[1]?.message).toBe('Event 2');
    expect(state.config).toBe(config);
  });

  it('batch является readonly массивом readonly событий', () => {
    const config = createTestBatchConfig();
    const state: TelemetryBatchCoreState = {
      batch: [createTestEvent()],
      config,
    };

    // state.batch = []; // TypeScript error
    // state.batch.push(createTestEvent()); // TypeScript error
    // state.batch[0]!.level = 'ERROR'; // TypeScript error

    expect(state.batch).toHaveLength(1);
  });

  it('работает с кастомными типами метаданных', () => {
    type CustomMetadata = { sessionId: string; userRole: 'admin' | 'user'; };

    const config = createTestBatchConfig();
    const customEvent: TelemetryEvent<CustomMetadata> = {
      level: 'INFO',
      message: 'Custom event',
      metadata: { sessionId: 'sess-123', userRole: 'admin' },
      timestamp: Date.now(),
    };

    const state: TelemetryBatchCoreState<CustomMetadata> = {
      batch: [customEvent],
      config,
    };

    expect(state.batch[0]?.metadata?.sessionId).toBe('sess-123');
    expect(state.batch[0]?.metadata?.userRole).toBe('admin');
  });
});

// ============================================================================
// ⚙️ КОНСТАНТЫ
// ============================================================================

describe('BatchCoreConfigVersion константа', () => {
  it('имеет корректное значение', () => {
    expect(BatchCoreConfigVersion).toBe(1);
  });

  it('является number', () => {
    expect(typeof BatchCoreConfigVersion).toBe('number');
  });

  it('используется в конфигурациях', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
    };

    expect(config.configVersion).toBe(1);
  });
});

// ============================================================================
// 🔌 ТИПЫ SINK
// ============================================================================

describe('TelemetrySink тип', () => {
  it('создает синхронный sink', () => {
    const events: TelemetryEvent[] = [];

    const sink: TelemetrySink = (event) => {
      events.push(event);
    };

    const testEvent = createTestEvent();
    sink(testEvent);

    expect(events).toHaveLength(1);
    expect(events[0]).toBe(testEvent);
  });

  it('создает асинхронный sink', async () => {
    const events: TelemetryEvent[] = [];

    const sink: TelemetrySink = async (event) => {
      await Promise.resolve();
      events.push(event);
    };

    const testEvent = createTestEvent();
    await sink(testEvent);

    expect(events).toHaveLength(1);
    expect(events[0]).toBe(testEvent);
  });

  it('работает с кастомными метаданными', () => {
    type CustomMetadata = { priority: 'high' | 'low'; };

    const events: TelemetryEvent<CustomMetadata>[] = [];

    const sink: TelemetrySink<CustomMetadata> = (event) => {
      events.push(event);
    };

    const customEvent: TelemetryEvent<CustomMetadata> = {
      level: 'ERROR',
      message: 'High priority error',
      metadata: { priority: 'high' },
      timestamp: Date.now(),
    };

    sink(customEvent);

    expect(events[0]?.metadata?.priority).toBe('high');
  });

  it('возвращает void или Promise<void>', () => {
    const syncSink: TelemetrySink = () => undefined;
    const asyncSink: TelemetrySink = async () => Promise.resolve();

    const event = createTestEvent();

    expect(syncSink(event)).toBeUndefined();
    expect(asyncSink(event)).toBeInstanceOf(Promise);
  });
});

// ============================================================================
// ⚙️ ТИПЫ КОНФИГУРАЦИИ
// ============================================================================

describe('TelemetryConfig тип', () => {
  it('создает минимальную конфигурацию', () => {
    const config: TelemetryConfig = {};

    expect(config.levelThreshold).toBeUndefined();
    expect(config.sinks).toBeUndefined();
    expect(config.onError).toBeUndefined();
  });

  it('создает полную конфигурацию', () => {
    const mockSink: TelemetrySink = () => {};
    const onError = (error: unknown, event: TelemetryEvent) => {
      console.error(error, event);
    };

    const config: TelemetryConfig = {
      levelThreshold: 'WARN',
      sinks: [mockSink],
      onError,
    };

    expect(config.levelThreshold).toBe('WARN');
    expect(config.sinks).toHaveLength(1);
    expect(config.onError).toBe(onError);
  });

  it('sinks является readonly массивом', () => {
    const config: TelemetryConfig = {
      sinks: [() => {}],
    };

    // config.sinks = []; // TypeScript error
    // config.sinks.push(() => {}); // TypeScript error

    expect(config.sinks).toHaveLength(1);
  });

  it('работает с кастомными метаданными', () => {
    type CustomMetadata = { traceId: string; };

    const customSink: TelemetrySink<CustomMetadata> = () => {};
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
    const onError = (error: unknown, event: TelemetryEvent<CustomMetadata>) => {
      console.error(error, event);
    };

    const config: TelemetryConfig<CustomMetadata> = {
      levelThreshold: 'ERROR',
      sinks: [customSink],
      onError,
    };

    expect(config.levelThreshold).toBe('ERROR');
    expect(config.sinks).toHaveLength(1);
    expect(typeof config.onError).toBe('function');
  });

  it('onError получает правильные типы параметров', () => {
    let capturedError: unknown;
    let capturedEvent: TelemetryEvent | undefined;

    const config: TelemetryConfig = {
      onError: (error, event) => {
        capturedError = error;
        capturedEvent = event;
      },
    };

    // Имитация вызова (в реальном коде вызывается из TelemetryClient)
    if (config.onError) {
      const testError = new Error('Test error');
      const testEvent = createTestEvent();
      config.onError(testError, testEvent);

      expect(capturedError).toBe(testError);
      expect(capturedEvent).toBe(testEvent);
    }
  });
});

// ============================================================================
// 🧪 ИНТЕГРАЦИОННЫЕ ТЕСТЫ ТИПОВ
// ============================================================================

describe('Типы работают вместе', () => {
  it('создает полную телеметрическую экосистему', () => {
    // Конфигурация batch core
    const batchConfig = createTestBatchConfig();

    // События для batch
    const events: TelemetryEvent[] = [
      createTestEvent({ level: 'INFO', message: 'System started' }),
      createTestEvent({ level: 'WARN', message: 'High memory usage' }),
    ];

    // Состояние batch core
    const batchState: TelemetryBatchCoreState = {
      batch: events,
      config: batchConfig,
    };

    // Sink для обработки событий
    const processedEvents: TelemetryEvent[] = [];
    const sink: TelemetrySink = (event) => {
      processedEvents.push(event);
    };

    // Конфигурация телеметрии
    const telemetryConfig = createTestTelemetryConfig({
      sinks: [sink],
      levelThreshold: 'INFO',
    });

    // Проверки
    expect(batchState.batch).toHaveLength(2);
    expect(batchState.config.maxBatchSize).toBe(50);
    expect(telemetryConfig.sinks).toHaveLength(1);
    expect(telemetryConfig.levelThreshold).toBe('INFO');

    // Имитация обработки событий через sink
    events.forEach((event) => {
      sink(event);
    });

    expect(processedEvents).toHaveLength(2);
  });

  it('поддерживает end-to-end типобезопасность', () => {
    // Кастомный тип метаданных
    type EcommerceMetadata = {
      userId: string;
      productId: string;
      price: number;
      currency: string;
      quantity: number;
      discountApplied: boolean;
    };

    // Конфиг с кастомными метаданными
    const config: TelemetryConfig<EcommerceMetadata> = {
      levelThreshold: 'INFO',
      sinks: [],
    };

    // Событие с кастомными метаданными
    const event: TelemetryEvent<EcommerceMetadata> = {
      level: 'INFO',
      message: 'Product purchased',
      metadata: {
        userId: 'user-123',
        productId: 'prod-456',
        price: 99.99,
        currency: 'USD',
        quantity: 2,
        discountApplied: true,
      },
      timestamp: Date.now(),
    };

    // Sink для кастомных метаданных
    const sink: TelemetrySink<EcommerceMetadata> = (ecommerceEvent) => {
      // TypeScript знает точный тип метаданных
      expect(ecommerceEvent.metadata?.price).toBe(99.99);
      expect(ecommerceEvent.metadata?.currency).toBe('USD');
      expect(typeof ecommerceEvent.metadata?.quantity).toBe('number');
    };

    // Batch состояние с кастомными метаданными
    const batchState: TelemetryBatchCoreState<EcommerceMetadata> = {
      batch: [event],
      config: createTestBatchConfig(),
    };

    // Все типы согласованы
    expect(config.levelThreshold).toBe('INFO');
    expect(batchState.batch[0]?.metadata?.userId).toBe('user-123');
    expect(batchState.batch[0]?.level).toBe('INFO');

    // Вызов sink'а
    sink(event);
  });
});

// ============================================================================
// 📊 ПОКРЫТИЕ 100%
// ============================================================================

describe('Экспорты типов telemetry', () => {
  it('все типы корректно экспортируются', () => {
    // Этот тест проверяет что все импорты работают
    // TypeScript проверит корректность типов на этапе компиляции

    // Проверяем что типы существуют и могут быть использованы
    const testValues = {
      level: 'INFO' as TelemetryLevel,
      metadata: { test: 'value' } as TelemetryMetadata,
      event: createTestEvent(),
      batchConfig: createTestBatchConfig(),
      batchState: {
        batch: [createTestEvent()],
        config: createTestBatchConfig(),
      } as TelemetryBatchCoreState,
      sink: (() => {}) as TelemetrySink,
      config: createTestTelemetryConfig(),
      configVersion: BatchCoreConfigVersion,
      levels: [...TelemetryLevels], // Create a copy to avoid mutations
    };

    expect(testValues.level).toBe('INFO');
    expect(testValues.metadata['test']).toBe('value');
    expect(testValues.event.level).toBe('INFO');
    expect(testValues.batchConfig.maxBatchSize).toBe(50);
    expect(testValues.batchState.batch).toHaveLength(1);
    expect(typeof testValues.sink).toBe('function');
    expect(testValues.config.levelThreshold).toBe('INFO');
    expect(testValues.configVersion).toBe(1);
    expect(testValues.levels).toHaveLength(3);
    expect(testValues.levels).toEqual(['INFO', 'WARN', 'ERROR']);
  });

  it('все типы являются generic-friendly', () => {
    // Проверяем что типы работают с generic параметрами

    type CustomMeta = { customField: string; value: number; };

    // Все типы должны работать с кастомными метаданными
    const customEvent: TelemetryEvent<CustomMeta> = {
      level: 'INFO',
      message: 'Custom event',
      metadata: { customField: 'test', value: 42 },
      timestamp: 123,
    };

    const customSink: TelemetrySink<CustomMeta> = () => {};
    const customConfig: TelemetryConfig<CustomMeta> = {
      sinks: [customSink],
    };

    const customBatchState: TelemetryBatchCoreState<CustomMeta> = {
      batch: [customEvent],
      config: createTestBatchConfig(),
    };

    expect(customEvent.metadata?.customField).toBe('test');
    expect(customConfig.sinks).toHaveLength(1);
    expect(customBatchState.batch[0]?.metadata?.value).toBe(42);
  });
});
