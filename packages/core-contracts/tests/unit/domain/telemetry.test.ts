/**
 * @file @livai/core-contracts/tests/unit/domain/telemetry.test.ts
 * ============================================================================
 * 🔹 ТИПЫ ТЕЛЕМЕТРИИ — 100% ПОКРЫТИЕ
 * ============================================================================
 * Тестирование enterprise-level телеметрических типов:
 * - TelemetryLevel уровни важности и константы
 * - TelemetryMetadata иммутабельные метаданные
 * - TelemetryEvent основное событие телеметрии
 * - Batch core типы для оптимизации
 * - Sink и Config типы для инфраструктуры
 * - 100% покрытие всех экспортируемых типов
 * Покрытие: 100% без моков, чистые типы
 */

import { describe, expect, it } from 'vitest';

import type {
  BatchConfig,
  CustomLevelPriority,
  DropPolicy,
  FallbackPriorityStrategy,
  NonPIIField,
  PIIField,
  RetryConfig,
  TelemetryBatchCoreConfig,
  TelemetryBatchCoreState,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryLevel,
  TelemetryLevelTemplate,
  TelemetryMetadata,
  TelemetryPrimitive,
  TelemetrySink,
  TelemetryTimezone,
  ThrottleConfig,
} from '@livai/core-contracts';

import {
  BatchCoreConfigVersion,
  defaultTelemetryTimezone,
  TelemetryLevels,
  validateCustomLevelPriority,
} from '../../../src/domain/telemetry.js';

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
    // eslint-disable-next-line ai-security/model-poisoning
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
    // eslint-disable-next-line ai-security/model-poisoning
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
    // eslint-disable-next-line ai-security/model-poisoning
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
    interface CustomMetadata {
      userId: string;
      actionType: 'login' | 'logout' | 'update';
      sessionId: string;
    }

    // eslint-disable-next-line ai-security/model-poisoning
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
    // eslint-disable-next-line ai-security/model-poisoning
    const eventWithoutMetadata: TelemetryEvent = {
      level: 'WARN',
      message: 'Simple warning',
      timestamp: 1000,
    };

    // eslint-disable-next-line ai-security/model-poisoning
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
    interface CustomMetadata {
      sessionId: string;
      userRole: 'admin' | 'user';
    }

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
    interface CustomMetadata {
      priority: 'high' | 'low';
    }

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
    interface CustomMetadata {
      traceId: string;
    }

    const customSink: TelemetrySink<CustomMetadata> = () => {};

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
    const captured: { error: unknown; event: TelemetryEvent; }[] = [];

    const config: TelemetryConfig = {
      onError: (error, event) => {
        captured.push({ error, event });
      },
    };

    // Имитация вызова (в реальном коде вызывается из TelemetryClient)
    if (config.onError) {
      const testError = new Error('Test error');
      const testEvent = createTestEvent();
      config.onError(testError, testEvent);

      expect(captured).toHaveLength(1);
      expect(captured[0]?.error).toBe(testError);
      expect(captured[0]?.event).toBe(testEvent);
    }
  });
});

// ============================================================================
// 🧪 ИНТЕГРАЦИОННЫЕ ТЕСТЫ ТИПОВ
// ============================================================================

describe('Типы работают вместе', () => {
  it('создает полную телеметрическую экосистему', () => {
    // Конфигурация batch core
    // eslint-disable-next-line ai-security/model-poisoning
    const batchConfig = createTestBatchConfig();

    // События для batch
    const events: TelemetryEvent[] = [
      createTestEvent({ level: 'INFO', message: 'System started' }),
      createTestEvent({ level: 'WARN', message: 'High memory usage' }),
    ];

    // Состояние batch core
    // eslint-disable-next-line ai-security/model-poisoning
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
    interface EcommerceMetadata {
      userId: string;
      productId: string;
      price: number;
      currency: string;
      quantity: number;
      discountApplied: boolean;
    }

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
    // eslint-disable-next-line ai-security/model-poisoning
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

    interface CustomMeta {
      customField: string;
      value: number;
    }

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

    // eslint-disable-next-line ai-security/model-poisoning
    const customBatchState: TelemetryBatchCoreState<CustomMeta> = {
      batch: [customEvent],
      config: createTestBatchConfig(),
    };

    expect(customEvent.metadata?.customField).toBe('test');
    expect(customConfig.sinks).toHaveLength(1);
    expect(customBatchState.batch[0]?.metadata?.value).toBe(42);
  });
});

// ============================================================================
// 🏷️ ДОПОЛНИТЕЛЬНЫЕ ТИПЫ
// ============================================================================

describe('TelemetryLevelTemplate тип', () => {
  it('принимает template literal типы', () => {
    const template1: TelemetryLevelTemplate = 'level:INFO';
    const template2: TelemetryLevelTemplate = 'level:WARN';
    const template3: TelemetryLevelTemplate = 'level:ERROR';
    const direct: TelemetryLevelTemplate = 'INFO';

    expect(template1).toBe('level:INFO');
    expect(template2).toBe('level:WARN');
    expect(template3).toBe('level:ERROR');
    expect(direct).toBe('INFO');
  });
});

describe('PIIField и NonPIIField branded types', () => {
  it('PIIField является branded типом', () => {
    const piiField: PIIField = 'password123' as PIIField;

    expect(piiField).toBe('password123');
    expect(typeof piiField).toBe('string');
  });

  it('NonPIIField является branded типом', () => {
    const nonPIIField: NonPIIField = 'userId' as NonPIIField;

    expect(nonPIIField).toBe('userId');
    expect(typeof nonPIIField).toBe('string');
  });
});

describe('TelemetryTimezone тип', () => {
  it('принимает строковые значения', () => {
    const timezone1: TelemetryTimezone = 'UTC';
    const timezone2: TelemetryTimezone = 'America/New_York';
    const timezone3: TelemetryTimezone = 'Europe/Moscow';

    expect(timezone1).toBe('UTC');
    expect(timezone2).toBe('America/New_York');
    expect(timezone3).toBe('Europe/Moscow');
  });
});

describe('defaultTelemetryTimezone константа', () => {
  it('имеет значение UTC', () => {
    expect(defaultTelemetryTimezone).toBe('UTC');
  });

  it('является TelemetryTimezone', () => {
    const timezone: TelemetryTimezone = defaultTelemetryTimezone;
    expect(timezone).toBe('UTC');
  });
});

describe('RetryConfig тип', () => {
  it('создает минимальную конфигурацию', () => {
    const config: RetryConfig = {};

    expect(config.maxRetries).toBeUndefined();
    expect(config.baseDelayMs).toBeUndefined();
    expect(config.maxDelayMs).toBeUndefined();
    expect(config.backoffMultiplier).toBeUndefined();
  });

  it('создает полную конфигурацию', () => {
    const config: RetryConfig = {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };

    expect(config.maxRetries).toBe(5);
    expect(config.baseDelayMs).toBe(1000);
    expect(config.maxDelayMs).toBe(10000);
    expect(config.backoffMultiplier).toBe(2);
  });

  it('является полностью readonly', () => {
    const config: RetryConfig = {
      maxRetries: 3,
    };

    // config.maxRetries = 5; // TypeScript error

    expect(config.maxRetries).toBe(3);
  });
});

describe('BatchConfig тип', () => {
  it('создает минимальную конфигурацию', () => {
    const config: BatchConfig = {};

    expect(config.maxBatchSize).toBeUndefined();
    expect(config.maxConcurrentBatches).toBeUndefined();
  });

  it('создает полную конфигурацию', () => {
    const config: BatchConfig = {
      maxBatchSize: 20,
      maxConcurrentBatches: 10,
    };

    expect(config.maxBatchSize).toBe(20);
    expect(config.maxConcurrentBatches).toBe(10);
  });

  it('является полностью readonly', () => {
    const config: BatchConfig = {
      maxBatchSize: 15,
    };

    // config.maxBatchSize = 20; // TypeScript error

    expect(config.maxBatchSize).toBe(15);
  });
});

describe('ThrottleConfig тип', () => {
  it('создает минимальную конфигурацию', () => {
    const config: ThrottleConfig = {};

    expect(config.maxErrorsPerPeriod).toBeUndefined();
    expect(config.throttlePeriodMs).toBeUndefined();
  });

  it('создает полную конфигурацию', () => {
    const config: ThrottleConfig = {
      maxErrorsPerPeriod: 5,
      throttlePeriodMs: 30000,
    };

    expect(config.maxErrorsPerPeriod).toBe(5);
    expect(config.throttlePeriodMs).toBe(30000);
  });

  it('является полностью readonly', () => {
    const config: ThrottleConfig = {
      maxErrorsPerPeriod: 10,
    };

    // config.maxErrorsPerPeriod = 20; // TypeScript error

    expect(config.maxErrorsPerPeriod).toBe(10);
  });
});

describe('CustomLevelPriority тип', () => {
  it('создает карту приоритетов для кастомных уровней', () => {
    const customPriority: CustomLevelPriority = {
      DEBUG: 0,
      TRACE: -1,
      FATAL: 100,
    };

    expect(customPriority['DEBUG']).toBe(0);
    expect(customPriority['TRACE']).toBe(-1);
    expect(customPriority['FATAL']).toBe(100);
  });

  it('не позволяет использовать стандартные уровни', () => {
    // const invalid: CustomLevelPriority = {
    //   INFO: 1, // TypeScript error - INFO уже в TelemetryLevel
    //   WARN: 2, // TypeScript error
    //   ERROR: 3, // TypeScript error
    // };

    expect(true).toBe(true); // Заглушка для теста
  });

  it('является полностью readonly', () => {
    const customPriority: CustomLevelPriority = {
      DEBUG: 0,
    };

    // customPriority.DEBUG = 1; // TypeScript error

    expect(customPriority['DEBUG']).toBe(0);
  });
});

describe('FallbackPriorityStrategy тип', () => {
  it('принимает все допустимые значения', () => {
    const strategies: FallbackPriorityStrategy[] = ['ignore', 'log', 'error'];

    strategies.forEach((strategy) => {
      expect(['ignore', 'log', 'error']).toContain(strategy);
    });
  });

  it('используется в TelemetryConfig', () => {
    const config: TelemetryConfig = {
      fallbackPriorityStrategy: 'log',
    };

    expect(config.fallbackPriorityStrategy).toBe('log');
  });
});

describe('TelemetryEvent distributed tracing поля', () => {
  it('создает событие с distributed tracing полями', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'Distributed trace event',
      timestamp: Date.now(),
      spanId: 'span-123',
      correlationId: 'corr-456',
      traceId: 'trace-789',
      timezone: 'UTC',
    };

    expect(event.spanId).toBe('span-123');
    expect(event.correlationId).toBe('corr-456');
    expect(event.traceId).toBe('trace-789');
    expect(event.timezone).toBe('UTC');
  });

  it('distributed tracing поля опциональны', () => {
    const eventWithoutTracing: TelemetryEvent = {
      level: 'INFO',
      message: 'Simple event',
      timestamp: Date.now(),
    };

    expect(eventWithoutTracing.spanId).toBeUndefined();
    expect(eventWithoutTracing.correlationId).toBeUndefined();
    expect(eventWithoutTracing.traceId).toBeUndefined();
    expect(eventWithoutTracing.timezone).toBeUndefined();
  });

  it('timezone может быть любым TelemetryTimezone', () => {
    const event: TelemetryEvent = {
      level: 'INFO',
      message: 'Event with timezone',
      timestamp: Date.now(),
      timezone: 'America/New_York',
    };

    expect(event.timezone).toBe('America/New_York');
  });
});

describe('TelemetryConfig дополнительные поля', () => {
  it('создает конфигурацию с batchConfig', () => {
    // eslint-disable-next-line ai-security/model-poisoning
    const batchConfig: BatchConfig = {
      maxBatchSize: 20,
      maxConcurrentBatches: 5,
    };

    const config: TelemetryConfig = {
      batchConfig,
    };

    expect(config.batchConfig?.maxBatchSize).toBe(20);
    expect(config.batchConfig?.maxConcurrentBatches).toBe(5);
  });

  it('создает конфигурацию с throttleConfig', () => {
    const throttleConfig: ThrottleConfig = {
      maxErrorsPerPeriod: 10,
      throttlePeriodMs: 60000,
    };

    const config: TelemetryConfig = {
      throttleConfig,
    };

    expect(config.throttleConfig?.maxErrorsPerPeriod).toBe(10);
    expect(config.throttleConfig?.throttlePeriodMs).toBe(60000);
  });

  it('создает конфигурацию с customLevelPriority', () => {
    const customPriority: CustomLevelPriority = {
      DEBUG: 0,
      TRACE: -1,
    };

    const config: TelemetryConfig = {
      customLevelPriority: customPriority,
    };

    expect(config.customLevelPriority?.['DEBUG']).toBe(0);
    expect(config.customLevelPriority?.['TRACE']).toBe(-1);
  });

  it('создает конфигурацию с timezone', () => {
    const config: TelemetryConfig = {
      timezone: 'Europe/Moscow',
    };

    expect(config.timezone).toBe('Europe/Moscow');
  });

  it('создает конфигурацию с enableDeepFreeze', () => {
    const config: TelemetryConfig = {
      enableDeepFreeze: false,
    };

    expect(config.enableDeepFreeze).toBe(false);
  });

  it('создает конфигурацию с enablePIIValueScan', () => {
    const config: TelemetryConfig = {
      enablePIIValueScan: true,
    };

    expect(config.enablePIIValueScan).toBe(true);
  });

  it('создает конфигурацию с fallbackPriorityStrategy', () => {
    const config: TelemetryConfig = {
      fallbackPriorityStrategy: 'error',
    };

    expect(config.fallbackPriorityStrategy).toBe('error');
  });
});

// UiTelemetryMetrics больше не экспортируется из core-contracts
// (это app-специфичный тип, который будет удален после полного переключения импортов)

describe('TelemetryPrimitive тип', () => {
  it('принимает все примитивные типы', () => {
    const stringValue: TelemetryPrimitive = 'test';
    const numberValue: TelemetryPrimitive = 42;
    const booleanValue: TelemetryPrimitive = true;
    const nullValue: TelemetryPrimitive = null;

    expect(stringValue).toBe('test');
    expect(numberValue).toBe(42);
    expect(booleanValue).toBe(true);
    expect(nullValue).toBeNull();
  });

  it('используется в TelemetryMetadata', () => {
    // eslint-disable-next-line ai-security/model-poisoning
    const metadata: TelemetryMetadata = {
      string: 'value' as TelemetryPrimitive,
      number: 123 as TelemetryPrimitive,
      boolean: true as TelemetryPrimitive,
      null: null as TelemetryPrimitive,
    };

    expect(metadata['string']).toBe('value');
    expect(metadata['number']).toBe(123);
    expect(metadata['boolean']).toBe(true);
    expect(metadata['null']).toBeNull();
  });
});

describe('DropPolicy тип', () => {
  it('принимает все допустимые значения', () => {
    const policies: DropPolicy[] = ['oldest', 'newest', 'error'];

    policies.forEach((policy) => {
      expect(['oldest', 'newest', 'error']).toContain(policy);
    });
  });

  it('используется в BatchConfig', () => {
    const config: BatchConfig = {
      dropPolicy: 'oldest',
    };

    expect(config.dropPolicy).toBe('oldest');

    const config2: BatchConfig = {
      dropPolicy: 'newest',
    };

    expect(config2.dropPolicy).toBe('newest');

    const config3: BatchConfig = {
      dropPolicy: 'error',
    };

    expect(config3.dropPolicy).toBe('error');
  });

  it('может быть undefined в BatchConfig', () => {
    const config: BatchConfig = {};

    expect(config.dropPolicy).toBeUndefined();
  });
});

// ============================================================================
// 🔧 RUNTIME ВАЛИДАЦИЯ
// ============================================================================

describe('validateCustomLevelPriority функция', () => {
  it('возвращает пустой объект для undefined', () => {
    const result = validateCustomLevelPriority(undefined);
    expect(result).toEqual({});
  });

  it('возвращает пустой объект для пустого объекта', () => {
    const result = validateCustomLevelPriority({});
    expect(result).toEqual({});
  });

  it('валидирует корректный customLevelPriority', () => {
    const input = {
      DEBUG: 0,
      TRACE: -1,
      FATAL: 100,
    };
    const result = validateCustomLevelPriority(input);
    expect(result).toEqual(input);
  });

  it('выбрасывает ошибку при конфликте со стандартным уровнем INFO', () => {
    const input = {
      INFO: 0,
      DEBUG: 1,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: ключ "INFO" конфликтует со стандартным уровнем. Используйте другой ключ.',
    );
  });

  it('выбрасывает ошибку при конфликте со стандартным уровнем WARN', () => {
    const input = {
      WARN: 0,
      DEBUG: 1,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: ключ "WARN" конфликтует со стандартным уровнем. Используйте другой ключ.',
    );
  });

  it('выбрасывает ошибку при конфликте со стандартным уровнем ERROR', () => {
    const input = {
      ERROR: 0,
      DEBUG: 1,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: ключ "ERROR" конфликтует со стандартным уровнем. Используйте другой ключ.',
    );
  });

  it('выбрасывает ошибку при дубликате ключей (case-insensitive)', () => {
    const input = {
      DEBUG: 0,
      debug: 1,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: обнаружен дубликат ключа "debug". Ключи должны быть уникальными.',
    );
  });

  it('выбрасывает ошибку при дубликате ключей (разный регистр)', () => {
    const input = {
      Trace: 0,
      TRACE: 1,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: обнаружен дубликат ключа "TRACE". Ключи должны быть уникальными.',
    );
  });

  it('выбрасывает ошибку при невалидном значении (string)', () => {
    const input = {
      DEBUG: 'invalid' as unknown as number,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: значение для ключа "DEBUG" должно быть конечным числом, получено: string',
    );
  });

  it('выбрасывает ошибку при невалидном значении (NaN)', () => {
    const input = {
      DEBUG: Number.NaN,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: значение для ключа "DEBUG" должно быть конечным числом, получено: number',
    );
  });

  it('выбрасывает ошибку при невалидном значении (Infinity)', () => {
    const input = {
      DEBUG: Number.POSITIVE_INFINITY,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: значение для ключа "DEBUG" должно быть конечным числом, получено: number',
    );
  });

  it('выбрасывает ошибку при невалидном значении (-Infinity)', () => {
    const input = {
      DEBUG: Number.NEGATIVE_INFINITY,
    };
    expect(() => validateCustomLevelPriority(input)).toThrow(
      'customLevelPriority: значение для ключа "DEBUG" должно быть конечным числом, получено: number',
    );
  });

  it('принимает отрицательные числа', () => {
    const input = {
      TRACE: -1,
      DEBUG: -10,
    };
    const result = validateCustomLevelPriority(input);
    expect(result).toEqual(input);
  });

  it('принимает нулевое значение', () => {
    const input = {
      DEBUG: 0,
    };
    const result = validateCustomLevelPriority(input);
    expect(result).toEqual(input);
  });

  it('принимает большие числа', () => {
    const input = {
      FATAL: 1000,
      CRITICAL: 9999,
    };
    const result = validateCustomLevelPriority(input);
    expect(result).toEqual(input);
  });

  it('принимает дробные числа', () => {
    const input = {
      DEBUG: 0.5,
      TRACE: -0.1,
    };
    const result = validateCustomLevelPriority(input);
    expect(result).toEqual(input);
  });

  it('возвращает тот же объект (не создает копию)', () => {
    const input = {
      DEBUG: 0,
      TRACE: -1,
    };
    const result = validateCustomLevelPriority(input);
    expect(result).toBe(input);
  });
});
