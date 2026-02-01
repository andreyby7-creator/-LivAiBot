/**
 * @file packages/app/tests/unit/lib/telemetry.batch-core.test.ts
 * ============================================================================
 * 🔹 BATCH CORE UNIT TESTS — 100% COVERAGE
 * ============================================================================
 *
 * Тестирует чистое batch ядро без зависимостей:
 * - createInitialBatchCoreState с кастомной конфигурацией
 * - addEventToBatchCore (приватная функция)
 * - flushBatchCore (приватная функция)
 * - shouldFlushBatchCore (приватная функция)
 * - telemetryBatchCore объект с публичным API
 * - defaultBatchCoreConfig
 * - Все граничные случаи и типы метаданных
 * - Иммутабельность и чистоту функций
 *
 * Покрытие: 100% без моков
 */

import { describe, expect, it } from 'vitest';
import {
  addEventToBatchCore,
  createInitialBatchCoreState,
  defaultBatchCoreConfig,
  flushBatchCore,
  shouldFlushBatchCore,
  telemetryBatchCore,
} from '../../../src/lib/telemetry.batch-core';
import type { TelemetryBatchCoreConfig, TelemetryLevel } from '../../../src/types/telemetry';

/* ============================================================================
 * 🎯 defaultBatchCoreConfig
 * ========================================================================== */

describe('defaultBatchCoreConfig', () => {
  it('has correct default values', () => {
    expect(defaultBatchCoreConfig).toEqual({
      maxBatchSize: 50,
      configVersion: 1,
    });
  });

  it('satisfies TelemetryBatchCoreConfig type', () => {
    // TypeScript ensures this is readonly at compile time
    expect(defaultBatchCoreConfig).toBeDefined();
  });
});

/* ============================================================================
 * 🎯 createInitialBatchCoreState
 * ========================================================================== */

describe('createInitialBatchCoreState', () => {
  it('creates initial state with default config', () => {
    const state = createInitialBatchCoreState();

    expect(state).toEqual({
      batch: [],
      config: defaultBatchCoreConfig,
    });
  });

  it('creates initial state with custom config', () => {
    const customConfig: TelemetryBatchCoreConfig = {
      maxBatchSize: 25,
      configVersion: 2,
    };

    const state = createInitialBatchCoreState(customConfig);

    expect(state).toEqual({
      batch: [],
      config: customConfig,
    });
  });

  it('returns state with readonly properties', () => {
    const state = createInitialBatchCoreState();

    // TypeScript ensures these are readonly at compile time
    expect(state.batch).toEqual([]);
    expect(state.config).toBe(defaultBatchCoreConfig);
  });
});

/* ============================================================================
 * 🎯 addEventToBatchCore (private function)
 * ========================================================================== */

describe('addEventToBatchCore', () => {
  it('adds event to empty batch', () => {
    const initialState = createInitialBatchCoreState();
    const timestamp = Date.now();

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test message',
      { key: 'value' },
      timestamp,
    );

    expect(newState.batch).toHaveLength(1);
    expect(newState.batch[0]).toEqual({
      level: 'INFO',
      message: 'test message',
      metadata: { key: 'value' },
      timestamp,
    });
    expect(newState.config).toBe(initialState.config); // Same reference
  });

  it('adds event to existing batch', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithOne = addEventToBatchCore(
      initialState,
      'INFO',
      'first',
      undefined,
      1000,
    );

    const stateWithTwo = addEventToBatchCore(
      stateWithOne,
      'WARN',
      'second',
      { a: 1 },
      2000,
    );

    expect(stateWithTwo.batch).toHaveLength(2);
    expect(stateWithTwo.batch[0]).toEqual({
      level: 'INFO',
      message: 'first',
      timestamp: 1000,
    });
    expect(stateWithTwo.batch[1]).toEqual({
      level: 'WARN',
      message: 'second',
      metadata: { a: 1 },
      timestamp: 2000,
    });
  });

  it('handles undefined metadata correctly', () => {
    const initialState = createInitialBatchCoreState();

    const newState = addEventToBatchCore(
      initialState,
      'ERROR',
      'no metadata',
      undefined,
      123,
    );

    expect(newState.batch[0]).not.toHaveProperty('metadata');
    expect(newState.batch[0]).toEqual({
      level: 'ERROR',
      message: 'no metadata',
      timestamp: 123,
    });
  });

  it('handles complex metadata types', () => {
    const initialState = createInitialBatchCoreState();

    const complexMetadata = {
      string: 'text',
      number: 42,
      boolean: true,
      null: null,
    };

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'complex',
      complexMetadata,
      999,
    );

    expect(newState.batch[0]?.metadata).toEqual(complexMetadata);
  });

  it('preserves config reference', () => {
    const initialState = createInitialBatchCoreState();

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test',
      undefined,
      1,
    );

    expect(newState.config).toBe(initialState.config);
  });

  it('creates new batch array (immutable)', () => {
    const initialState = createInitialBatchCoreState();

    const newState = addEventToBatchCore(
      initialState,
      'INFO',
      'test',
      undefined,
      1,
    );

    expect(newState.batch).not.toBe(initialState.batch);
    expect(initialState.batch).toHaveLength(0);
    expect(newState.batch).toHaveLength(1);
  });
});

/* ============================================================================
 * 🎯 flushBatchCore (private function)
 * ========================================================================== */

describe('flushBatchCore', () => {
  it('returns events and empty state for non-empty batch', () => {
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

  it('returns empty events array for empty batch', () => {
    const emptyState = createInitialBatchCoreState();

    const [newState, events] = flushBatchCore(emptyState);

    expect(events).toHaveLength(0);
    expect(newState.batch).toHaveLength(0);
    expect(newState.config).toBe(emptyState.config);
  });

  it('creates new state with empty batch (immutable)', () => {
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

  it('returns events as readonly array', () => {
    const initialState = createInitialBatchCoreState();
    const stateWithEvent = addEventToBatchCore(
      initialState,
      'INFO',
      'test',
      undefined,
      1,
    );

    const [, events] = flushBatchCore(stateWithEvent);

    // TypeScript ensures this is readonly at compile time
    expect(events).toHaveLength(1);
  });
});

/* ============================================================================
 * 🎯 shouldFlushBatchCore (private function)
 * ========================================================================== */

describe('shouldFlushBatchCore', () => {
  it('returns true when batch size equals maxBatchSize', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 2,
      configVersion: 1,
    };
    const initialState = createInitialBatchCoreState(config);

    // Add exactly maxBatchSize events
    const stateWithMaxEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'INFO',
      'b',
      undefined,
      2,
    );

    expect(shouldFlushBatchCore(stateWithMaxEvents)).toBe(true);
  });

  it('returns true when batch size exceeds maxBatchSize', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 2,
      configVersion: 1,
    };
    const initialState = createInitialBatchCoreState(config);

    // Add more than maxBatchSize events
    const stateWithExcessEvents = addEventToBatchCore(
      addEventToBatchCore(
        addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
        'INFO',
        'b',
        undefined,
        2,
      ),
      'INFO',
      'c',
      undefined,
      3,
    );

    expect(shouldFlushBatchCore(stateWithExcessEvents)).toBe(true);
  });

  it('returns false when batch size is less than maxBatchSize', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 3,
      configVersion: 1,
    };
    const initialState = createInitialBatchCoreState(config);

    // Add fewer than maxBatchSize events
    const stateWithFewEvents = addEventToBatchCore(
      addEventToBatchCore(initialState, 'INFO', 'a', undefined, 1),
      'INFO',
      'b',
      undefined,
      2,
    );

    expect(shouldFlushBatchCore(stateWithFewEvents)).toBe(false);
  });

  it('returns false for empty batch', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 1,
      configVersion: 1,
    };
    const emptyState = createInitialBatchCoreState(config);

    expect(shouldFlushBatchCore(emptyState)).toBe(false);
  });

  it('works with different maxBatchSize values', () => {
    const testCases = [
      { maxBatchSize: 1, eventsToAdd: 1, expected: true },
      { maxBatchSize: 1, eventsToAdd: 0, expected: false },
      { maxBatchSize: 5, eventsToAdd: 4, expected: false },
      { maxBatchSize: 5, eventsToAdd: 5, expected: true },
      { maxBatchSize: 10, eventsToAdd: 15, expected: true },
    ];

    for (const testCase of testCases) {
      const config: TelemetryBatchCoreConfig = {
        maxBatchSize: testCase.maxBatchSize,
        configVersion: 1,
      };
      const initialState = createInitialBatchCoreState(config);

      let state = initialState;
      for (let i = 0; i < testCase.eventsToAdd; i++) {
        state = addEventToBatchCore(state, 'INFO', `event${i}`, undefined, i);
      }

      expect(shouldFlushBatchCore(state)).toBe(testCase.expected);
    }
  });
});

/* ============================================================================
 * 🎪 telemetryBatchCore API object
 * ========================================================================== */

describe('telemetryBatchCore', () => {
  describe('createInitialState', () => {
    it('delegates to createInitialBatchCoreState with default config', () => {
      const state = telemetryBatchCore.createInitialState();

      expect(state).toEqual({
        batch: [],
        config: defaultBatchCoreConfig,
      });
    });

    it('delegates to createInitialBatchCoreState with custom config', () => {
      const customConfig: TelemetryBatchCoreConfig = {
        maxBatchSize: 10,
        configVersion: 3,
      };

      const state = telemetryBatchCore.createInitialState(customConfig);

      expect(state).toEqual({
        batch: [],
        config: customConfig,
      });
    });
  });

  describe('addEvent', () => {
    it('returns function that adds event to state', () => {
      const initialState = telemetryBatchCore.createInitialState<{ code: number; }>();

      const addEventFn = telemetryBatchCore.addEvent<{ code: number; }>(
        'ERROR',
        'test error',
        { code: 500 },
        12345,
      );

      const newState = addEventFn(initialState);

      expect(newState.batch).toHaveLength(1);
      expect(newState.batch[0]).toEqual({
        level: 'ERROR',
        message: 'test error',
        metadata: { code: 500 },
        timestamp: 12345,
      });
    });

    it('handles undefined metadata', () => {
      const initialState = telemetryBatchCore.createInitialState<undefined>();

      const addEventFn = telemetryBatchCore.addEvent<undefined>(
        'INFO',
        'no metadata',
        undefined,
        999,
      );

      const newState = addEventFn(initialState);

      expect(newState.batch[0]).not.toHaveProperty('metadata');
    });

    it('creates new state (immutable)', () => {
      const initialState = telemetryBatchCore.createInitialState<undefined>();

      const addEventFn = telemetryBatchCore.addEvent<undefined>('INFO', 'test', undefined, 1);
      const newState = addEventFn(initialState);

      expect(newState).not.toBe(initialState);
      expect(newState.batch).not.toBe(initialState.batch);
    });
  });

  describe('getBatch', () => {
    it('returns batch as readonly array', () => {
      const initialState = telemetryBatchCore.createInitialState<undefined>();
      const addEvent = telemetryBatchCore.addEvent<undefined>('INFO', 'test', undefined, 1);
      const stateWithEvent = addEvent(initialState);

      const batch = telemetryBatchCore.getBatch(stateWithEvent);

      expect(batch).toHaveLength(1);
      expect(batch[0]).toEqual({
        level: 'INFO',
        message: 'test',
        timestamp: 1,
      });

      // TypeScript ensures this is readonly at compile time
    });

    it('returns same reference as internal batch', () => {
      const initialState = telemetryBatchCore.createInitialState<undefined>();
      const stateWithEvent = telemetryBatchCore.addEvent<undefined>(
        'INFO',
        'test',
        undefined,
        1,
      )(initialState);

      const batch = telemetryBatchCore.getBatch(stateWithEvent);

      expect(batch).toBe(stateWithEvent.batch);
    });
  });

  describe('flush', () => {
    it('delegates to flushBatchCore', () => {
      const initialState = telemetryBatchCore.createInitialState<{ key?: string; }>();
      const stateWithEvents = telemetryBatchCore.addEvent<{ key?: string; }>(
        'INFO',
        'a',
        undefined,
        1,
      )(
        telemetryBatchCore.addEvent<{ key?: string; }>('WARN', 'b', { key: 'value' }, 2)(
          initialState,
        ),
      );

      const [newState, events] = telemetryBatchCore.flush(stateWithEvents);

      expect(events).toHaveLength(2);
      expect(newState.batch).toHaveLength(0);
      expect(newState.config).toBe(stateWithEvents.config);
    });

    it('returns events as readonly array', () => {
      const initialState = telemetryBatchCore.createInitialState<undefined>();
      const addEvent = telemetryBatchCore.addEvent<undefined>('INFO', 'test', undefined, 1);
      const stateWithEvent = addEvent(initialState);

      const [, events] = telemetryBatchCore.flush(stateWithEvent);

      // TypeScript ensures this is readonly at compile time
      expect(events).toHaveLength(1);
    });
  });

  describe('shouldFlush', () => {
    it('delegates to shouldFlushBatchCore', () => {
      const config: TelemetryBatchCoreConfig = {
        maxBatchSize: 2,
        configVersion: 1,
      };
      const initialState = telemetryBatchCore.createInitialState<undefined>(config);

      // Empty batch
      expect(telemetryBatchCore.shouldFlush(initialState)).toBe(false);

      // Add one event
      const addFirstEvent = telemetryBatchCore.addEvent<undefined>(
        'INFO',
        'test',
        undefined,
        1,
      );
      const stateWithOne = addFirstEvent(initialState);
      expect(telemetryBatchCore.shouldFlush(stateWithOne)).toBe(false);

      // Add second event (reaches maxBatchSize)
      const addSecondEvent = telemetryBatchCore.addEvent<undefined>(
        'INFO',
        'test2',
        undefined,
        2,
      );
      const stateWithTwo = addSecondEvent(stateWithOne);
      expect(telemetryBatchCore.shouldFlush(stateWithTwo)).toBe(true);
    });
  });
});

/* ============================================================================
 * 🧪 INTEGRATION TESTS
 * ========================================================================== */

describe('batch core integration', () => {
  it('complete batch lifecycle with custom config', () => {
    const customConfig: TelemetryBatchCoreConfig = {
      maxBatchSize: 3,
      configVersion: 42,
    };

    // Initialize
    let state = telemetryBatchCore.createInitialState<{ id: number; }>(customConfig);
    expect(state.batch).toHaveLength(0);
    expect(state.config).toBe(customConfig);

    // Add events
    state = telemetryBatchCore.addEvent('INFO', 'event1', { id: 1 }, 100)(state);
    expect(telemetryBatchCore.shouldFlush(state)).toBe(false);

    state = telemetryBatchCore.addEvent('WARN', 'event2', { id: 2 }, 200)(state);
    expect(telemetryBatchCore.shouldFlush(state)).toBe(false);

    state = telemetryBatchCore.addEvent('ERROR', 'event3', { id: 3 }, 300)(state);
    expect(telemetryBatchCore.shouldFlush(state)).toBe(true);

    // Flush
    const [newState, events] = telemetryBatchCore.flush(state);
    expect(events).toHaveLength(3);
    expect(newState.batch).toHaveLength(0);
    expect(newState.config).toBe(customConfig);

    // Verify events
    expect(events[0]).toEqual({
      level: 'INFO',
      message: 'event1',
      metadata: { id: 1 },
      timestamp: 100,
    });
    expect(events[1]).toEqual({
      level: 'WARN',
      message: 'event2',
      metadata: { id: 2 },
      timestamp: 200,
    });
    expect(events[2]).toEqual({
      level: 'ERROR',
      message: 'event3',
      metadata: { id: 3 },
      timestamp: 300,
    });
  });

  it('handles multiple flush cycles', () => {
    let state = telemetryBatchCore.createInitialState<undefined>({
      maxBatchSize: 2,
      configVersion: 1,
    });

    // First cycle
    state = telemetryBatchCore.addEvent<undefined>('INFO', 'a', undefined, 1)(state);
    state = telemetryBatchCore.addEvent<undefined>('INFO', 'b', undefined, 2)(state);
    expect(telemetryBatchCore.shouldFlush(state)).toBe(true);

    const [stateAfterFirstFlush, firstBatch] = telemetryBatchCore.flush(state);
    expect(firstBatch).toHaveLength(2);
    expect(stateAfterFirstFlush.batch).toHaveLength(0);

    // Second cycle
    state = telemetryBatchCore.addEvent<undefined>('INFO', 'c', undefined, 3)(
      stateAfterFirstFlush,
    );
    state = telemetryBatchCore.addEvent<undefined>('INFO', 'd', undefined, 4)(state);
    expect(telemetryBatchCore.shouldFlush(state)).toBe(true);

    const [, secondBatch] = telemetryBatchCore.flush(state);
    expect(secondBatch).toHaveLength(2);
    expect(secondBatch[0]?.message).toBe('c');
    expect(secondBatch[1]?.message).toBe('d');
  });

  it('preserves state immutability through complex operations', () => {
    const originalState = telemetryBatchCore.createInitialState<undefined>();

    // Create multiple derived states
    const addFirstEvent = telemetryBatchCore.addEvent<undefined>('INFO', 'test1', undefined, 1);
    const state1 = addFirstEvent(originalState);

    const addSecondEvent = telemetryBatchCore.addEvent<undefined>('WARN', 'test2', undefined, 2);
    const state2 = addSecondEvent(state1);

    // Original state unchanged
    expect(telemetryBatchCore.getBatch(originalState)).toHaveLength(0);

    // state1 has one event
    expect(telemetryBatchCore.getBatch(state1)).toHaveLength(1);
    expect(telemetryBatchCore.getBatch(state1)[0]?.message).toBe('test1');

    // state2 has two events
    expect(telemetryBatchCore.getBatch(state2)).toHaveLength(2);
    expect(telemetryBatchCore.getBatch(state2)[1]?.message).toBe('test2');

    // Flush state2
    const [flushedState] = telemetryBatchCore.flush(state2);
    expect(telemetryBatchCore.getBatch(flushedState)).toHaveLength(0);

    // Original states still unchanged
    expect(telemetryBatchCore.getBatch(state1)).toHaveLength(1);
    expect(telemetryBatchCore.getBatch(state2)).toHaveLength(2);
  });

  it('works with all telemetry levels', () => {
    const levels: TelemetryLevel[] = ['INFO', 'WARN', 'ERROR'];
    let state = telemetryBatchCore.createInitialState<{ level: TelemetryLevel; index: number; }>();

    // Add events of all levels
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i]!;
      const addEvent = telemetryBatchCore.addEvent(
        level,
        `message ${i}`,
        { level, index: i },
        i * 100,
      );
      state = addEvent(state);
    }

    expect(telemetryBatchCore.getBatch(state)).toHaveLength(3);

    const [flushedState, events] = telemetryBatchCore.flush(state);
    expect(events).toHaveLength(3);
    expect(flushedState.batch).toHaveLength(0);

    // Verify each event
    for (let i = 0; i < levels.length; i++) {
      expect(events[i]).toEqual({
        level: levels[i],
        message: `message ${i}`,
        metadata: { level: levels[i], index: i },
        timestamp: i * 100,
      });
    }
  });

  it('handles large batches correctly', () => {
    const batchSize = 100;
    let state = telemetryBatchCore.createInitialState<{ index: number; }>({
      maxBatchSize: batchSize,
      configVersion: 1,
    });

    // Add many events
    for (let i = 0; i < batchSize; i++) {
      const addEvent = telemetryBatchCore.addEvent(
        'INFO',
        `event ${i}`,
        { index: i },
        i,
      );
      state = addEvent(state);
    }

    expect(telemetryBatchCore.shouldFlush(state)).toBe(true);
    expect(telemetryBatchCore.getBatch(state)).toHaveLength(batchSize);

    const [flushedState, events] = telemetryBatchCore.flush(state);
    expect(events).toHaveLength(batchSize);
    expect(flushedState.batch).toHaveLength(0);

    // Verify all events are present
    for (let i = 0; i < batchSize; i++) {
      expect(events[i]).toEqual({
        level: 'INFO',
        message: `event ${i}`,
        metadata: { index: i },
        timestamp: i,
      });
    }
  });
});

/* ============================================================================
 * 🏃 PERFORMANCE & EDGE CASES
 * ========================================================================== */

describe('performance and edge cases', () => {
  it('handles empty strings and special characters', () => {
    const initialState = createInitialBatchCoreState();

    const testCases = [
      { level: 'INFO' as const, message: '', metadata: undefined },
      { level: 'WARN' as const, message: '🚀 special chars', metadata: { emoji: '🔥' } },
      { level: 'ERROR' as const, message: 'multi\nline\nmessage', metadata: { linesCount: 3 } },
    ];

    let state = initialState;
    for (const testCase of testCases) {
      state = addEventToBatchCore(
        state,
        testCase.level,
        testCase.message,
        testCase.metadata,
        Date.now(),
      );
    }

    expect(state.batch).toHaveLength(3);
    expect(state.batch[0]?.message).toBe('');
    expect(state.batch[1]?.message).toBe('🚀 special chars');
    expect(state.batch[2]?.message).toBe('multi\nline\nmessage');
  });

  it('handles extreme batch sizes', () => {
    // Test with very small batch size
    let state = createInitialBatchCoreState({
      maxBatchSize: 1,
      configVersion: 1,
    });

    state = addEventToBatchCore(state, 'INFO', 'test', undefined, 1);
    expect(shouldFlushBatchCore(state)).toBe(true);

    // Test with very large batch size
    state = createInitialBatchCoreState({
      maxBatchSize: 10000,
      configVersion: 1,
    });

    for (let i = 0; i < 100; i++) {
      state = addEventToBatchCore(state, 'INFO', `event${i}`, undefined, i);
    }
    expect(shouldFlushBatchCore(state)).toBe(false);
  });

  it('handles timestamp edge cases', () => {
    const initialState = createInitialBatchCoreState();

    const timestamps = [0, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];

    let state = initialState;
    for (const timestamp of timestamps) {
      state = addEventToBatchCore(state, 'INFO', 'timestamp test', { ts: timestamp }, timestamp);
    }

    expect(state.batch).toHaveLength(4);
    for (let i = 0; i < timestamps.length; i++) {
      expect(state.batch[i]?.timestamp).toBe(timestamps[i]);
    }
  });

  it('maintains reference equality for config', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 10,
      configVersion: 5,
    };

    const initialState = createInitialBatchCoreState(config);

    // Add many events
    let state = initialState;
    for (let i = 0; i < 20; i++) {
      state = addEventToBatchCore(state, 'INFO', `event${i}`, undefined, i);
    }

    // Flush multiple times
    const [state1] = flushBatchCore(state);
    const [state2] = flushBatchCore(state1);

    // Config reference should always be the same
    expect(initialState.config).toBe(config);
    expect(state.config).toBe(config);
    expect(state1.config).toBe(config);
    expect(state2.config).toBe(config);
  });

  it('batch operations are deterministic', () => {
    const config: TelemetryBatchCoreConfig = {
      maxBatchSize: 3,
      configVersion: 1,
    };

    // Create two identical states
    const state1 = createInitialBatchCoreState(config);
    const state2 = createInitialBatchCoreState(config);

    // Apply same operations
    let currentState1 = state1;
    let currentState2 = state2;

    currentState1 = addEventToBatchCore(currentState1, 'INFO', 'a', undefined, 1);
    currentState2 = addEventToBatchCore(currentState2, 'INFO', 'a', undefined, 1);

    currentState1 = addEventToBatchCore(currentState1, 'WARN', 'b', { x: 1 }, 2);
    currentState2 = addEventToBatchCore(currentState2, 'WARN', 'b', { x: 1 }, 2);

    currentState1 = addEventToBatchCore(currentState1, 'ERROR', 'c', undefined, 3);
    currentState2 = addEventToBatchCore(currentState2, 'ERROR', 'c', undefined, 3);

    // States should be structurally equal
    expect(currentState1).toEqual(currentState2);
    expect(currentState1.batch).toEqual(currentState2.batch);
    expect(currentState1.config).toBe(currentState2.config);
  });
});
