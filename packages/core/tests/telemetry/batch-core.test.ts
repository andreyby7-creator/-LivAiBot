/**
 * @file Unit тесты для batch-core.ts
 * Цель: 100% coverage для Stmts, Branch, Funcs, Lines
 */
import { describe, expect, it } from 'vitest';

import type { TelemetryBatchCoreConfig, TelemetryMetadata } from '@livai/core-contracts';
import { BatchCoreConfigVersion } from '@livai/core-contracts';

import type {
  TelemetryBatchCoreConfigExtended,
  TransformEventHook,
} from '../../src/telemetry/batch-core.js';
import {
  addEventToBatchCore,
  createInitialBatchCoreState,
  defaultBatchCoreConfig,
  flushBatchCore,
  shouldFlushBatchCore,
  telemetryBatchCore,
} from '../../src/telemetry/batch-core.js';

// Для тестов допустимо:
// - Мутации объектов для создания тестовых данных (fp/no-mutation)
// - Использование тестовых данных без валидации (ai-security/model-poisoning)
// - Нарушение правил сортировки импортов для удобства чтения (simple-import-sort/imports)
/* eslint-disable fp/no-mutation, ai-security/model-poisoning */

/* ========================================================================== */
/* 🔧 TEST HELPERS */
/* ========================================================================== */

function createTestMetadata(overrides?: Partial<TelemetryMetadata>): TelemetryMetadata {
  return {
    key: 'value',
    ...overrides,
  };
}

/* ========================================================================== */
/* ⚙️ КОНФИГУРАЦИЯ ПО УМОЛЧАНИЮ */
/* ========================================================================== */

describe('defaultBatchCoreConfig', () => {
  it('содержит правильные значения по умолчанию', () => {
    expect(defaultBatchCoreConfig).toEqual({
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
    });
  });

  it('имеет readonly поля', () => {
    // as const делает поля readonly, но не замораживает объект
    expect(defaultBatchCoreConfig.maxBatchSize).toBe(50);
    expect(defaultBatchCoreConfig.configVersion).toBe(BatchCoreConfigVersion);
  });
});

/* ========================================================================== */
/* 🎯 createInitialBatchCoreState */
/* ========================================================================== */

describe('createInitialBatchCoreState', () => {
  it('создает начальное состояние с дефолтной конфигурацией', () => {
    const state = createInitialBatchCoreState();

    expect(state).toEqual({
      batch: [],
      config: defaultBatchCoreConfig,
    });
  });

  it('создает начальное состояние с кастомной конфигурацией', () => {
    const customConfig: TelemetryBatchCoreConfig = {
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
    };

    const state = createInitialBatchCoreState(customConfig);

    expect(state).toEqual({
      batch: [],
      config: customConfig,
    });
  });

  it('сохраняет ссылку на базовый config если он не расширенный', () => {
    const customConfig: TelemetryBatchCoreConfig = {
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
    };

    const state = createInitialBatchCoreState(customConfig);

    expect(state.config).toBe(customConfig);
  });

  it('создает новый объект config для расширенной конфигурации с enablePIIRedaction', () => {
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
      enablePIIRedaction: true,
    };

    const state = createInitialBatchCoreState(extendedConfig);

    expect(state.config).not.toBe(extendedConfig);
    expect(state.config).toEqual({
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
    });
  });

  it('создает новый объект config для расширенной конфигурации с enableDeepPIIScan', () => {
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
      enableDeepPIIScan: true,
    };

    const state = createInitialBatchCoreState(extendedConfig);

    expect(state.config).not.toBe(extendedConfig);
    expect(state.config).toEqual({
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
    });
  });

  it('создает новый объект config для расширенной конфигурации с transformEvent', () => {
    const transformEvent: TransformEventHook = (event) => event;
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
      transformEvent,
    };

    const state = createInitialBatchCoreState(extendedConfig);

    expect(state.config).not.toBe(extendedConfig);
    expect(state.config).toEqual({
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
    });
  });

  it('создает новый объект config для расширенной конфигурации со всеми опциями', () => {
    const transformEvent: TransformEventHook = (event) => event;
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
      enablePIIRedaction: true,
      enableDeepPIIScan: true,
      transformEvent,
    };

    const state = createInitialBatchCoreState(extendedConfig);

    expect(state.config).not.toBe(extendedConfig);
    expect(state.config).toEqual({
      maxBatchSize: 25,
      configVersion: BatchCoreConfigVersion,
    });
  });
});

/* ========================================================================== */
/* 🎯 addEventToBatchCore */
/* ========================================================================== */

describe('addEventToBatchCore', () => {
  it('добавляет событие в пустой batch', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = createTestMetadata();

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
    );

    expect(newState.batch).toHaveLength(1);
    expect(newState.batch[0]).toEqual({
      level: 'INFO',
      message: 'test message',
      timestamp: 1234567890,
      metadata,
    });
    expect(newState.config).toBe(initialState.config);
  });

  it('добавляет событие без metadata', () => {
    const initialState = createInitialBatchCoreState();

    const newState = addEventToBatchCore(
      initialState,
      'WARN',
      'test message',
      undefined,
      1234567890,
    );

    expect(newState.batch).toHaveLength(1);
    expect(newState.batch[0]).toEqual({
      level: 'WARN',
      message: 'test message',
      timestamp: 1234567890,
    });
    expect(newState.batch[0]).not.toHaveProperty('metadata');
  });

  it('добавляет несколько событий в batch', () => {
    const initialState = createInitialBatchCoreState();

    const state1 = addEventToBatchCore(initialState, 'INFO', 'message 1', undefined, 1);
    const state2 = addEventToBatchCore(state1, 'WARN', 'message 2', undefined, 2);
    const state3 = addEventToBatchCore(state2, 'ERROR', 'message 3', undefined, 3);

    expect(state3.batch).toHaveLength(3);
    expect(state3.batch[0]?.message).toBe('message 1');
    expect(state3.batch[1]?.message).toBe('message 2');
    expect(state3.batch[2]?.message).toBe('message 3');
  });

  it('не мутирует исходное состояние', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = createTestMetadata();

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
    );

    expect(initialState.batch).toHaveLength(0);
    expect(newState.batch).toHaveLength(1);
    expect(newState.batch).not.toBe(initialState.batch);
  });

  it('применяет PII redaction middleware если enablePIIRedaction=true (fast path удаляет metadata)', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = { password: 'secret123' } as TelemetryMetadata;
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      enablePIIRedaction: true,
    };

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
      extendedConfig,
    );

    // Fast path (enableDeepPIIScan=false) удаляет metadata полностью при обнаружении PII
    expect(newState.batch[0]?.metadata).toBeUndefined();
  });

  it('не применяет PII redaction middleware если enablePIIRedaction=false', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = { password: 'secret123' } as TelemetryMetadata;
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      enablePIIRedaction: false,
    };

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
      extendedConfig,
    );

    expect(newState.batch[0]?.metadata).toEqual({
      password: 'secret123',
    });
  });

  it('применяет deep PII scan если enableDeepPIIScan=true', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = { nested: { password: 'secret123' } } as unknown as TelemetryMetadata;
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      enablePIIRedaction: true,
      enableDeepPIIScan: true,
    };

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
      extendedConfig,
    );

    expect(newState.batch[0]?.metadata).toEqual({
      nested: { password: '[REDACTED]' },
    });
  });

  it('применяет transformEvent hook если задан', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = createTestMetadata();
    const transformEvent: TransformEventHook = (event) => ({
      ...event,
      message: `transformed: ${event.message}`,
    });
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      transformEvent,
    };

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
      extendedConfig,
    );

    expect(newState.batch[0]?.message).toBe('transformed: test message');
  });

  it('применяет transformEvent после PII redaction', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = { password: 'secret123' } as TelemetryMetadata;
    const transformEvent: TransformEventHook = (event) => ({
      ...event,
      message: `transformed: ${event.message}`,
    });
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      enablePIIRedaction: true,
      transformEvent,
    };

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
      extendedConfig,
    );

    expect(newState.batch[0]?.message).toBe('transformed: test message');
    // Fast path удаляет metadata полностью при обнаружении PII
    expect(newState.batch[0]?.metadata).toBeUndefined();
  });

  it('не применяет transformEvent если он не задан', () => {
    const initialState = createInitialBatchCoreState();
    const metadata = createTestMetadata();

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      metadata,
      1234567890,
    );

    expect(newState.batch[0]?.message).toBe('test message');
  });
});

/* ========================================================================== */
/* 🎯 flushBatchCore */
/* ========================================================================== */

describe('flushBatchCore', () => {
  it('возвращает события и пустое состояние для непустого batch', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'WARN',
      'b',
      { key: 'value' },
      2,
    );

    const [newState, events] = flushBatchCore(stateWithEvents);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      level: 'INFO',
      message: 'a',
      timestamp: 1,
    });
    expect(events[1]).toEqual({
      level: 'WARN',
      message: 'b',
      metadata: { key: 'value' },
      timestamp: 2,
    });

    expect(newState.batch).toHaveLength(0);
    expect(newState.config).toBe(stateWithEvents.config);
  });

  it('возвращает пустой массив событий для пустого batch', () => {
    const emptyState = createInitialBatchCoreState();

    const [newState, events] = flushBatchCore(emptyState);

    expect(events).toHaveLength(0);
    expect(newState.batch).toHaveLength(0);
    expect(newState.config).toBe(emptyState.config);
  });

  it('создает новое состояние с пустым batch (immutable)', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithEvent = addEventToBatchCore(
      initialState,
      'INFO',
      'test',
      undefined,
      1,
    );

    const [newState] = flushBatchCore(stateWithEvent);

    expect(newState).not.toBe(stateWithEvent);
    expect(newState.batch).not.toBe(stateWithEvent.batch);
    expect(stateWithEvent.batch).toHaveLength(1); // Original unchanged
    expect(newState.batch).toHaveLength(0);
  });

  it('применяет transformEvent hook к каждому событию перед flush', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'WARN',
      'b',
      undefined,
      2,
    );
    const transformEvent: TransformEventHook = (event) => ({
      ...event,
      message: `transformed: ${event.message}`,
    });
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      transformEvent,
    };

    const [, events] = flushBatchCore(stateWithEvents, extendedConfig);

    expect(events).toHaveLength(2);
    expect(events[0]?.message).toBe('transformed: a');
    expect(events[1]?.message).toBe('transformed: b');
  });

  it('не применяет transformEvent если он не задан', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'WARN',
      'b',
      undefined,
      2,
    );

    const [, events] = flushBatchCore(stateWithEvents);

    expect(events).toHaveLength(2);
    expect(events[0]?.message).toBe('a');
    expect(events[1]?.message).toBe('b');
  });

  it('обрабатывает случай когда transformEvent undefined в extendedConfig', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'WARN',
      'b',
      undefined,
      2,
    );
    const extendedConfig = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
    } as TelemetryBatchCoreConfigExtended;

    const [, events] = flushBatchCore(stateWithEvents, extendedConfig);

    expect(events).toHaveLength(2);
    expect(events[0]?.message).toBe('a');
    expect(events[1]?.message).toBe('b');
  });

  it('обрабатывает случай когда transformEvent может быть undefined внутри map (защита на строке 183)', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'WARN',
      'b',
      undefined,
      2,
    );
    // Создаем extendedConfig с getter, который возвращает undefined при втором обращении
    // Это покрывает защиту на строке 183: transformEvent ? transformEvent(event) : event
    // eslint-disable-next-line functional/no-let -- callCount должен изменяться для тестирования getter
    let callCount = 0;
    const extendedConfig = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      get transformEvent() {
        callCount += 1;
        // При первом обращении (проверка на строке 180) возвращаем функцию
        // При втором обращении (внутри map на строке 182) возвращаем undefined для покрытия ветки 183
        return callCount === 1
          ? ((event: Parameters<TransformEventHook>[0]) => ({
            ...event,
            message: `transformed: ${event.message}`,
          }))
          : undefined;
      },
    } as TelemetryBatchCoreConfigExtended;

    const [, events] = flushBatchCore(stateWithEvents, extendedConfig);

    // События должны остаться без изменений, так как transformEvent стал undefined внутри map
    expect(events).toHaveLength(2);
    expect(events[0]?.message).toBe('a'); // Не трансформировано из-за защиты на строке 183
    expect(events[1]?.message).toBe('b');
  });
});

/* ========================================================================== */
/* 🎯 shouldFlushBatchCore */
/* ========================================================================== */

describe('shouldFlushBatchCore', () => {
  it('возвращает false для пустого batch', () => {
    const emptyState = createInitialBatchCoreState();

    expect(shouldFlushBatchCore(emptyState)).toBe(false);
  });

  it('возвращает false если размер batch меньше maxBatchSize', () => {
    const initialState = createInitialBatchCoreState({
      maxBatchSize: 5,
      configVersion: BatchCoreConfigVersion,
    });
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'WARN',
      'b',
      undefined,
      2,
    );

    expect(shouldFlushBatchCore(stateWithEvents)).toBe(false);
  });

  it('возвращает true если размер batch равен maxBatchSize', () => {
    const initialState = createInitialBatchCoreState({
      maxBatchSize: 2,
      configVersion: BatchCoreConfigVersion,
    });
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'WARN',
      'b',
      undefined,
      2,
    );

    expect(shouldFlushBatchCore(stateWithEvents)).toBe(true);
  });

  it('возвращает true если размер batch больше maxBatchSize', () => {
    const initialState = createInitialBatchCoreState({
      maxBatchSize: 2,
      configVersion: BatchCoreConfigVersion,
    });
    const stateWithEvents = addEventToBatchCore(
      addEventToBatchCore(
        addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
        'WARN',
        'b',
        undefined,
        2,
      ),
      'ERROR',
      'c',
      undefined,
      3,
    );

    expect(shouldFlushBatchCore(stateWithEvents)).toBe(true);
  });
});

/* ========================================================================== */
/* 🎪 telemetryBatchCore API */
/* ========================================================================== */

describe('telemetryBatchCore', () => {
  describe('createInitialState', () => {
    it('создает начальное состояние без конфигурации', () => {
      const state = telemetryBatchCore.createInitialState();

      expect(state).toEqual({
        batch: [],
        config: defaultBatchCoreConfig,
      });
    });

    it('создает начальное состояние с конфигурацией', () => {
      const config: TelemetryBatchCoreConfig = {
        maxBatchSize: 25,
        configVersion: BatchCoreConfigVersion,
      };
      const state = telemetryBatchCore.createInitialState(config);

      expect(state.config).toEqual(config);
    });
  });

  describe('addEvent', () => {
    it('возвращает функцию для добавления события', () => {
      const initialState = telemetryBatchCore.createInitialState();
      const metadata = createTestMetadata();

      const addEventFn = telemetryBatchCore.addEvent(
        'INFO',
        'test message',
        metadata,
        1234567890,
      );
      const newState = addEventFn(initialState);

      expect(newState.batch).toHaveLength(1);
      expect(newState.batch[0]?.message).toBe('test message');
    });

    it('поддерживает extended config с PII redaction', () => {
      const initialState = telemetryBatchCore.createInitialState();
      const metadata = { password: 'secret123' } as TelemetryMetadata;
      const extendedConfig: TelemetryBatchCoreConfigExtended = {
        maxBatchSize: 50,
        configVersion: BatchCoreConfigVersion,
        enablePIIRedaction: true,
      };

      const addEventFn = telemetryBatchCore.addEvent(
        'INFO',
        'test message',
        metadata,
        1234567890,
        extendedConfig,
      );
      const newState = addEventFn(initialState);

      // Fast path удаляет metadata полностью при обнаружении PII
      expect(newState.batch[0]?.metadata).toBeUndefined();
    });

    it('поддерживает extended config с transformEvent', () => {
      const initialState = telemetryBatchCore.createInitialState();
      const metadata = createTestMetadata();
      const transformEvent: TransformEventHook = (event) => ({
        ...event,
        message: `transformed: ${event.message}`,
      });
      const extendedConfig: TelemetryBatchCoreConfigExtended = {
        maxBatchSize: 50,
        configVersion: BatchCoreConfigVersion,
        transformEvent,
      };

      const addEventFn = telemetryBatchCore.addEvent(
        'INFO',
        'test message',
        metadata,
        1234567890,
        extendedConfig,
      );
      const newState = addEventFn(initialState);

      expect(newState.batch[0]?.message).toBe('transformed: test message');
    });
  });

  describe('getBatch', () => {
    it('возвращает пустой batch для начального состояния', () => {
      const state = telemetryBatchCore.createInitialState();

      expect(telemetryBatchCore.getBatch(state)).toEqual([]);
    });

    it('возвращает batch с событиями', () => {
      const initialState = telemetryBatchCore.createInitialState();
      const addEventFn = telemetryBatchCore.addEvent('INFO', 'test', undefined, 1);
      const stateWithEvent = addEventFn(initialState);

      const batch = telemetryBatchCore.getBatch(stateWithEvent);

      expect(batch).toHaveLength(1);
      expect(batch[0]?.message).toBe('test');
    });

    it('возвращает readonly batch', () => {
      const initialState = telemetryBatchCore.createInitialState();
      const addEventFn = telemetryBatchCore.addEvent('INFO', 'test', undefined, 1);
      const stateWithEvent = addEventFn(initialState);

      const batch = telemetryBatchCore.getBatch(stateWithEvent);

      // Проверяем, что это тот же массив (reference equality)
      expect(batch).toBe(stateWithEvent.batch);
    });
  });

  describe('flush', () => {
    it('выполняет flush batch', () => {
      const initialState = telemetryBatchCore.createInitialState();
      const addEventFn1 = telemetryBatchCore.addEvent('INFO', 'a', undefined, 1);
      const addEventFn2 = telemetryBatchCore.addEvent('WARN', 'b', undefined, 2);
      const stateWithEvents = addEventFn2(addEventFn1(initialState));

      const [newState, events] = telemetryBatchCore.flush(stateWithEvents);

      expect(events).toHaveLength(2);
      expect(newState.batch).toHaveLength(0);
    });

    it('поддерживает extended config с transformEvent', () => {
      const initialState = telemetryBatchCore.createInitialState();
      const addEventFn1 = telemetryBatchCore.addEvent('INFO', 'a', undefined, 1);
      const addEventFn2 = telemetryBatchCore.addEvent('WARN', 'b', undefined, 2);
      const stateWithEvents = addEventFn2(addEventFn1(initialState));
      const transformEvent: TransformEventHook = (event) => ({
        ...event,
        message: `transformed: ${event.message}`,
      });
      const extendedConfig: TelemetryBatchCoreConfigExtended = {
        maxBatchSize: 50,
        configVersion: BatchCoreConfigVersion,
        transformEvent,
      };

      const [, events] = telemetryBatchCore.flush(stateWithEvents, extendedConfig);

      expect(events).toHaveLength(2);
      expect(events[0]?.message).toBe('transformed: a');
      expect(events[1]?.message).toBe('transformed: b');
    });
  });

  describe('shouldFlush', () => {
    it('возвращает false для пустого batch', () => {
      const state = telemetryBatchCore.createInitialState();

      expect(telemetryBatchCore.shouldFlush(state)).toBe(false);
    });

    it('возвращает true когда batch достиг maxBatchSize', () => {
      const state = telemetryBatchCore.createInitialState({
        maxBatchSize: 2,
        configVersion: BatchCoreConfigVersion,
      });
      const addEventFn1 = telemetryBatchCore.addEvent('INFO', 'a', undefined, 1);
      const addEventFn2 = telemetryBatchCore.addEvent('WARN', 'b', undefined, 2);
      const stateWithEvents = addEventFn2(addEventFn1(state));

      expect(telemetryBatchCore.shouldFlush(stateWithEvents)).toBe(true);
    });
  });
});

/* ========================================================================== */
/* 🔄 ИНТЕГРАЦИОННЫЕ ТЕСТЫ */
/* ========================================================================== */

describe('Интеграционные тесты', () => {
  it('полный цикл: создание -> добавление -> flush -> проверка', () => {
    const state1 = telemetryBatchCore.createInitialState({
      maxBatchSize: 3,
      configVersion: BatchCoreConfigVersion,
    });

    const addEventFn1 = telemetryBatchCore.addEvent('INFO', 'message 1', undefined, 1);
    const addEventFn2 = telemetryBatchCore.addEvent('WARN', 'message 2', undefined, 2);
    const addEventFn3 = telemetryBatchCore.addEvent('ERROR', 'message 3', undefined, 3);

    const state2 = addEventFn1(state1);
    const state3 = addEventFn2(state2);
    const state4 = addEventFn3(state3);

    expect(telemetryBatchCore.shouldFlush(state4)).toBe(true);

    const [state5, events] = telemetryBatchCore.flush(state4);

    expect(events).toHaveLength(3);
    expect(state5.batch).toHaveLength(0);
    expect(telemetryBatchCore.shouldFlush(state5)).toBe(false);
  });

  it('работает с PII redaction и transformEvent вместе (deep scan)', () => {
    const initialState = telemetryBatchCore.createInitialState();
    // Используем ключи, которые точно распознаются как PII
    const metadata = { password: 'secret123', api_key: 'key123' } as TelemetryMetadata;
    const transformEvent: TransformEventHook = (event) => ({
      ...event,
      message: `[PREFIX] ${event.message}`,
    });
    const extendedConfig: TelemetryBatchCoreConfigExtended = {
      maxBatchSize: 50,
      configVersion: BatchCoreConfigVersion,
      enablePIIRedaction: true,
      enableDeepPIIScan: true, // Deep scan редиктит, а не удаляет
      transformEvent,
    };

    const addEventFn = telemetryBatchCore.addEvent(
      'INFO',
      'test message',
      metadata,
      1234567890,
      extendedConfig,
    );
    const stateWithEvent = addEventFn(initialState);

    expect(stateWithEvent.batch[0]?.message).toBe('[PREFIX] test message');
    // Deep scan редиктит PII значения, а не удаляет metadata
    expect(stateWithEvent.batch[0]?.metadata).toBeDefined();
    const batchMetadata = stateWithEvent.batch[0]?.metadata as Record<string, unknown>;
    expect(batchMetadata['password']).toBe('[REDACTED]');
    expect(batchMetadata['api_key']).toBe('[REDACTED]');
  });
});
/* eslint-enable fp/no-mutation, ai-security/model-poisoning */
