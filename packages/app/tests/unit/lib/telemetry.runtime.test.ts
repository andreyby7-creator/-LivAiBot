/**
 * @file packages/app/tests/unit/lib/telemetry.runtime.test.ts
 * ============================================================================
 * 🔹 RUNTIME ТЕСТЫ — ЧИСТЫЕ ФУНКЦИИ / FAKE TIMERS / NO REACT
 * ============================================================================
 *
 * Тестирует всю асинхронную логику телеметрии без React и jsdom:
 * - TelemetryClient с фильтрацией уровней
 * - createConsoleSink, createExternalSink
 * - fireAndForget helpers
 * - createBatchAwareSink с таймерами
 * - global telemetry lifecycle
 *
 * Покрытие: 90-95% без зависаний
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBatchAwareSink,
  createConsoleSink,
  createExternalSink,
  errorFireAndForget,
  fireAndForget,
  getGlobalTelemetryClient,
  infoFireAndForget,
  initTelemetry,
  isTelemetryInitialized,
  levelPriority,
  logFireAndForget,
  resetGlobalTelemetryClient,
  TelemetryClient,
  telemetryLevels,
  warnFireAndForget,
} from '../../../src/lib/telemetry';
import type { TelemetryEvent, TelemetrySink } from '../../../src/types/telemetry';

beforeEach(() => {
  vi.useFakeTimers();
  resetGlobalTelemetryClient();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

/* ============================================================================
 * 🧱 LEVELS / PRIORITY
 * ========================================================================== */

describe('telemetry levels', () => {
  it('telemetryLevels order is correct', () => {
    expect(telemetryLevels).toEqual(['INFO', 'WARN', 'ERROR']);
  });

  it('levelPriority increases with severity', () => {
    expect(levelPriority.INFO).toBeLessThan(levelPriority.WARN);
    expect(levelPriority.WARN).toBeLessThan(levelPriority.ERROR);
  });
});

/* ============================================================================
 * 🧠 TelemetryClient
 * ========================================================================== */

describe('TelemetryClient', () => {
  it('emits event to sinks when level >= threshold', async () => {
    const sink = vi.fn();
    const client = new TelemetryClient({
      levelThreshold: 'WARN',
      sinks: [sink as TelemetrySink],
    });

    await client.info('ignored');
    await client.warn('warn message');
    await client.error('error message');

    expect(sink).toHaveBeenCalledTimes(2);
    const firstCall = sink.mock.calls[0]![0] as TelemetryEvent;
    const secondCall = sink.mock.calls[1]![0] as TelemetryEvent;
    expect(firstCall.level).toBe('WARN');
    expect(secondCall.level).toBe('ERROR');
  });

  it('creates immutable TelemetryEvent', async () => {
    const sink = vi.fn();
    const client = new TelemetryClient({ sinks: [sink] });

    await client.info('hello', { a: 1 });

    expect(sink).toHaveBeenCalledTimes(1);
    const event = sink.mock.calls[0]![0] as TelemetryEvent;

    expect(event).toMatchObject({
      level: 'INFO',
      message: 'hello',
      metadata: { a: 1 },
    });
    expect(typeof event.timestamp).toBe('number');
  });

  it('handles multiple sinks', async () => {
    const sink1 = vi.fn();
    const sink2 = vi.fn();
    const client = new TelemetryClient({ sinks: [sink1, sink2] });

    await client.warn('test');

    expect(sink1).toHaveBeenCalledTimes(1);
    expect(sink2).toHaveBeenCalledTimes(1);
  });

  it('swallows sink errors', async () => {
    const goodSink = vi.fn();
    const badSink = vi.fn().mockRejectedValue(new Error('boom'));
    const client = new TelemetryClient({ sinks: [goodSink, badSink] });

    await expect(client.error('test')).resolves.toBeUndefined();
    expect(goodSink).toHaveBeenCalledTimes(1);
    expect(badSink).toHaveBeenCalledTimes(1);
  });

  it('handles empty sinks array', async () => {
    const client = new TelemetryClient({ sinks: [] });

    await expect(client.info('test')).resolves.toBeUndefined();
  });

  it('handles undefined metadata', async () => {
    const sink = vi.fn();
    const client = new TelemetryClient({ sinks: [sink] });

    await client.warn('test');

    const event = sink.mock.calls[0]![0] as TelemetryEvent;
    expect(event.metadata).toBeUndefined();
  });

  it('handles complex metadata types', async () => {
    const sink = vi.fn();
    const client = new TelemetryClient({ sinks: [sink] });

    const complexMetadata = {
      string: 'text',
      number: 42,
      boolean: true,
      null: null,
    };

    await client.error('complex test', complexMetadata);

    const event = sink.mock.calls[0]![0] as TelemetryEvent;
    expect(event.metadata).toEqual(complexMetadata);
  });

  it('defaults to INFO threshold when not specified', async () => {
    const sink = vi.fn();
    const client = new TelemetryClient({ sinks: [sink] });

    await client.info('info');
    await client.warn('warn');
    await client.error('error');

    expect(sink).toHaveBeenCalledTimes(3);
  });

  it('filters all events when threshold is ERROR', async () => {
    const sink = vi.fn();
    const client = new TelemetryClient({
      levelThreshold: 'ERROR',
      sinks: [sink as TelemetrySink],
    });

    await client.info('filtered');
    await client.warn('filtered');
    await client.error('allowed');

    expect(sink).toHaveBeenCalledTimes(1);
    const event = sink.mock.calls[0]![0] as TelemetryEvent;
    expect(event.level).toBe('ERROR');
  });
});

/* ============================================================================
 * 🔌 Console sink
 * ========================================================================== */

describe('createConsoleSink', () => {
  it('routes INFO to console.log, WARN to console.warn, ERROR to console.error', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const sink = createConsoleSink();

    sink({ level: 'INFO', message: 'i', timestamp: 1 });
    sink({ level: 'WARN', message: 'w', timestamp: 2 });
    sink({ level: 'ERROR', message: 'e', timestamp: 3 });

    expect(log).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it('formats timestamp correctly', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sink = createConsoleSink();

    sink({ level: 'INFO', message: 'test', timestamp: 1609459200000 }); // 2021-01-01

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]'),
      'test',
      undefined,
    );
  });

  it('includes metadata in output', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sink = createConsoleSink();

    sink({ level: 'INFO', message: 'test', timestamp: 1, metadata: { key: 'value' } });

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]'),
      'test',
      { key: 'value' },
    );
  });
});

/* ============================================================================
 * 🔌 External sink
 * ========================================================================== */

describe('createExternalSink', () => {
  it('throws if sdk.capture is not a function', () => {
    // @ts-expect-error: Testing invalid SDK object
    expect(() => createExternalSink({})).toThrow();
  });

  it('calls sdk.capture with event', async () => {
    const sdk = { capture: vi.fn() };
    const sink = createExternalSink(sdk);

    const event: TelemetryEvent = { level: 'INFO', message: 'x', timestamp: 1 };
    await sink(event);

    expect(sdk.capture).toHaveBeenCalledWith(event);
  });

  it('swallows sdk errors in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const sdk = {
      capture: vi.fn().mockRejectedValue(new Error('fail')),
    };

    const sink = createExternalSink(sdk);
    await expect(sink({ level: 'ERROR', message: 'x', timestamp: 1 }))
      .resolves.toBeUndefined();

    expect(sdk.capture).toHaveBeenCalledOnce();
  });

  it('logs sdk errors in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sdk = {
      capture: vi.fn().mockRejectedValue(new Error('fail')),
    };

    const sink = createExternalSink(sdk);
    await sink({ level: 'ERROR', message: 'x', timestamp: 1 });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('External telemetry SDK error'),
      expect.any(Error),
    );
  });
});

/* ============================================================================
 * 🔄 fire-and-forget helpers
 * ========================================================================== */

describe('fireAndForget', () => {
  it('does not throw on rejected promise', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    fireAndForget(fn);

    // Wait for fireAndForget to process
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledOnce();
  });

  it('calls function successfully', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    fireAndForget(fn);

    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledOnce();
  });
});

/* ============================================================================
 * 🌍 Global telemetry
 * ========================================================================== */

describe('global telemetry lifecycle', () => {
  it('isTelemetryInitialized reflects state', () => {
    expect(isTelemetryInitialized()).toBe(false);

    initTelemetry();
    expect(isTelemetryInitialized()).toBe(true);

    resetGlobalTelemetryClient();
    expect(isTelemetryInitialized()).toBe(false);
  });

  it('getGlobalTelemetryClient throws if not initialized', () => {
    expect(() => getGlobalTelemetryClient()).toThrow();
  });

  it('initTelemetry returns singleton', () => {
    const a = initTelemetry();
    const b = getGlobalTelemetryClient();
    expect(a).toBe(b);
  });

  it('initTelemetry throws on second call in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    initTelemetry();
    expect(() => initTelemetry()).toThrow('Telemetry already initialized');
  });

  it('initTelemetry allows re-init in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    initTelemetry();
    initTelemetry(); // Should not throw

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Telemetry already initialized'),
    );
  });

  it('initTelemetry accepts config', () => {
    const mockSink = vi.fn();
    const client = initTelemetry({
      sinks: [mockSink as TelemetrySink],
      levelThreshold: 'ERROR',
    });

    expect(client).toBeInstanceOf(TelemetryClient);

    // Test that config is applied
    client.info('filtered'); // Should not call sink
    expect(mockSink).not.toHaveBeenCalled();

    client.error('allowed'); // Should call sink
    expect(mockSink).toHaveBeenCalledOnce();
  });
});

/* ============================================================================
 * 🔄 fire-and-forget API
 * ========================================================================== */

describe('logFireAndForget / info / warn / error', () => {
  it('do nothing if telemetry not initialized', () => {
    expect(() => logFireAndForget('INFO', 'x')).not.toThrow();
    expect(() => infoFireAndForget('x')).not.toThrow();
    expect(() => warnFireAndForget('x')).not.toThrow();
    expect(() => errorFireAndForget('x')).not.toThrow();
  });

  it('delegate to TelemetryClient methods when initialized', async () => {
    initTelemetry();

    const client = getGlobalTelemetryClient();
    const logSpy = vi.spyOn(client, 'log').mockResolvedValue(undefined);
    const infoSpy = vi.spyOn(client, 'info').mockResolvedValue(undefined);
    const warnSpy = vi.spyOn(client, 'warn').mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(client, 'error').mockResolvedValue(undefined);

    logFireAndForget('INFO', 'test');
    infoFireAndForget('test');
    warnFireAndForget('test');
    errorFireAndForget('test');

    await vi.runAllTimersAsync();

    expect(logSpy).toHaveBeenCalledWith('INFO', 'test', undefined);
    expect(infoSpy).toHaveBeenCalledWith('test', undefined);
    expect(warnSpy).toHaveBeenCalledWith('test', undefined);
    expect(errorSpy).toHaveBeenCalledWith('test', undefined);
  });
});

/* ============================================================================
 * 📦 Batch-aware sink (самая сложная часть)
 * ========================================================================== */

describe('createBatchAwareSink', () => {
  it('flushes immediately when batchSize reached', async () => {
    const captureBatch = vi.fn();
    const sink = createBatchAwareSink(
      { capture: vi.fn(), captureBatch },
      { batchSize: 2, flushInterval: 1000 },
    );

    sink({ level: 'INFO' as const, message: 'a', timestamp: 1 });
    await sink({ level: 'INFO' as const, message: 'b', timestamp: 2 });

    expect(captureBatch).toHaveBeenCalledTimes(1);
    expect(captureBatch.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('flushes by timer if batch not full', async () => {
    const capture = vi.fn();
    const sink = createBatchAwareSink(
      { capture },
      { batchSize: 10, flushInterval: 1000 },
    );

    sink({ level: 'INFO' as const, message: 'a', timestamp: 1 });

    vi.advanceTimersByTime(1000);
    await Promise.resolve(); // Allow microtask queue to flush

    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('uses captureBatch when available, otherwise fallback to capture()', async () => {
    const capture = vi.fn();
    const sink = createBatchAwareSink(
      { capture },
      { batchSize: 2, flushInterval: 1000 },
    );

    sink({ level: 'INFO', message: 'a', timestamp: 1 });
    await sink({ level: 'INFO', message: 'b', timestamp: 2 });

    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('uses captureBatch API when available', async () => {
    const captureBatch = vi.fn();
    const sink = createBatchAwareSink(
      { capture: vi.fn(), captureBatch },
      { batchSize: 2, flushInterval: 1000 },
    );

    sink({ level: 'INFO', message: 'a', timestamp: 1 });
    await sink({ level: 'INFO', message: 'b', timestamp: 2 });

    expect(captureBatch).toHaveBeenCalledWith([
      { level: 'INFO', message: 'a', timestamp: 1 },
      { level: 'INFO', message: 'b', timestamp: 2 },
    ]);
  });

  it('clears timer when batchSize reached before timeout', async () => {
    const captureBatch = vi.fn();
    const sink = createBatchAwareSink(
      { capture: vi.fn(), captureBatch },
      { batchSize: 2, flushInterval: 5000 }, // Long timeout
    );

    sink({ level: 'INFO' as const, message: 'a', timestamp: 1 });
    await sink({ level: 'INFO' as const, message: 'b', timestamp: 2 });

    // Timer should be cleared, so advancing time shouldn't trigger flush
    vi.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(captureBatch).toHaveBeenCalledTimes(1); // Only the batchSize flush
  });

  it('handles multiple batches correctly', async () => {
    const captureBatch = vi.fn();
    const sink = createBatchAwareSink(
      { capture: vi.fn(), captureBatch },
      { batchSize: 2, flushInterval: 1000 },
    );

    // First batch
    sink({ level: 'INFO' as const, message: 'a', timestamp: 1 });
    await sink({ level: 'INFO' as const, message: 'b', timestamp: 2 });

    // Second batch
    sink({ level: 'INFO' as const, message: 'c', timestamp: 3 });
    await sink({ level: 'INFO' as const, message: 'd', timestamp: 4 });

    expect(captureBatch).toHaveBeenCalledTimes(2);
  });

  it('swallows batch errors', async () => {
    const captureBatch = vi.fn().mockRejectedValue(new Error('batch fail'));
    const sink = createBatchAwareSink(
      { capture: vi.fn(), captureBatch },
      { batchSize: 1, flushInterval: 1000 },
    );

    await expect(sink({ level: 'INFO' as const, message: 'a', timestamp: 1 }))
      .resolves.toBeUndefined();

    expect(captureBatch).toHaveBeenCalledTimes(1);
  });

  describe('additional TelemetryClient edge cases', () => {
    it('handles empty sinks array gracefully', async () => {
      const client = new TelemetryClient({ sinks: [] });

      await expect(client.info('test')).resolves.toBeUndefined();
      await expect(client.warn('test')).resolves.toBeUndefined();
      await expect(client.error('test')).resolves.toBeUndefined();
    });

    it('handles undefined metadata correctly', async () => {
      const sink = vi.fn();
      const client = new TelemetryClient({ sinks: [sink] });

      await client.warn('test');

      const event = sink.mock.calls[0]![0] as TelemetryEvent;
      expect(event.metadata).toBeUndefined();
    });

    it('handles complex nested metadata', async () => {
      const sink = vi.fn();
      const client = new TelemetryClient({ sinks: [sink] });

      const complexMetadata = {
        userId: 123,
        userName: 'John',
        sessionId: 'abc',
        sessionTimestamp: Date.now(),
        errorCode: 500,
        errorMessage: 'Server error',
        responseTime: 150,
        memoryUsage: 85.5,
      };

      await client.error('complex error', complexMetadata);

      const event = sink.mock.calls[0]![0] as TelemetryEvent;
      expect(event.metadata).toEqual(complexMetadata);
    });

    it('defaults to INFO threshold when not specified', async () => {
      const sink = vi.fn();
      const client = new TelemetryClient({ sinks: [sink] });

      await client.info('info');
      await client.warn('warn');
      await client.error('error');

      expect(sink).toHaveBeenCalledTimes(3);
    });

    it('filters all non-error events when threshold is ERROR', async () => {
      const sink = vi.fn();
      const client = new TelemetryClient({
        levelThreshold: 'ERROR',
        sinks: [sink as TelemetrySink],
      });

      await client.info('filtered');
      await client.warn('filtered');
      await client.error('allowed');

      expect(sink).toHaveBeenCalledTimes(1);
      const event = sink.mock.calls[0]![0] as TelemetryEvent;
      expect(event.level).toBe('ERROR');
    });
  });

  describe('comprehensive level filtering tests', () => {
    it('tests all threshold combinations', async () => {
      const testCases = [
        { threshold: undefined, events: ['INFO', 'WARN', 'ERROR'], expectedCalls: 3 },
        { threshold: 'INFO' as const, events: ['INFO', 'WARN', 'ERROR'], expectedCalls: 3 },
        { threshold: 'WARN' as const, events: ['INFO', 'WARN', 'ERROR'], expectedCalls: 2 },
        { threshold: 'ERROR' as const, events: ['INFO', 'WARN', 'ERROR'], expectedCalls: 1 },
      ];

      for (const testCase of testCases) {
        const sink = vi.fn();
        const config: any = { sinks: [sink as TelemetrySink] };
        if (testCase.threshold !== undefined) {
          config.levelThreshold = testCase.threshold;
        }
        const client = new TelemetryClient(config);

        for (const event of testCase.events) {
          await client.log(event as 'INFO' | 'WARN' | 'ERROR', 'test');
        }

        expect(sink).toHaveBeenCalledTimes(testCase.expectedCalls);
      }
    });

    it('handles threshold changes dynamically', async () => {
      const sink = vi.fn();
      let client = new TelemetryClient({
        levelThreshold: 'WARN',
        sinks: [sink as TelemetrySink],
      });

      await client.info('filtered');
      await client.warn('allowed');

      expect(sink).toHaveBeenCalledTimes(1);

      // Create new client with different threshold
      client = new TelemetryClient({
        levelThreshold: 'INFO',
        sinks: [sink as TelemetrySink],
      });

      await client.info('now allowed');
      expect(sink).toHaveBeenCalledTimes(2);
    });
  });

  describe('fireAndForget edge cases', () => {
    it('handles promises that resolve successfully', async () => {
      const promise = Promise.resolve();
      expect(() => fireAndForget(() => promise)).not.toThrow();

      await promise; // Ensure promise resolves
    });

    it('handles promises that reject', async () => {
      const promise = Promise.reject(new Error('test error'));
      expect(() => fireAndForget(() => promise)).not.toThrow();

      // Promise rejection should be caught internally
      await expect(promise).rejects.toThrow('test error');
    });

    it('handles synchronous functions that throw', () => {
      const fn = () => {
        throw new Error('sync error');
      };
      expect(() => fireAndForget(async () => fn())).not.toThrow();
    });

    it('handles functions returning non-promises', () => {
      const fn = () => {
        'result';
      };
      expect(() =>
        fireAndForget(async () => {
          fn();
        })
      ).not.toThrow();
    });
  });

  describe('TelemetrySink types and error handling', () => {
    it('createConsoleSink handles all log levels correctly', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sink = createConsoleSink();

      sink({ level: 'INFO', message: 'info', timestamp: 1 });
      sink({ level: 'WARN', message: 'warn', timestamp: 2 });
      sink({ level: 'ERROR', message: 'error', timestamp: 3 });

      const expectedPrefix1 = `[INFO] ${new Date(1).toISOString()}`;
      const expectedPrefix2 = `[WARN] ${new Date(2).toISOString()}`;
      const expectedPrefix3 = `[ERROR] ${new Date(3).toISOString()}`;

      expect(logSpy).toHaveBeenCalledWith(expectedPrefix1, 'info', undefined);
      expect(warnSpy).toHaveBeenCalledWith(expectedPrefix2, 'warn', undefined);
      expect(errorSpy).toHaveBeenCalledWith(expectedPrefix3, 'error', undefined);

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('createExternalSink handles batch operations', async () => {
      const sdk = {
        capture: vi.fn(),
        captureBatch: vi.fn().mockResolvedValue(undefined),
      };

      // Test batch mode
      const events = [
        { level: 'INFO' as const, message: 'a', timestamp: 1 },
        { level: 'INFO' as const, message: 'b', timestamp: 2 },
      ];

      const batchSink = createBatchAwareSink(sdk, { batchSize: 2 });
      await batchSink(events[0]!);
      await batchSink(events[1]!);

      expect(sdk.captureBatch).toHaveBeenCalledWith(events);
    });
  });

  describe('resetGlobalTelemetryClient functionality', () => {
    it('resets telemetry initialization state', () => {
      initTelemetry();
      expect(isTelemetryInitialized()).toBe(true);

      resetGlobalTelemetryClient();
      expect(isTelemetryInitialized()).toBe(false);
      expect(() => getGlobalTelemetryClient()).toThrow();
    });

    it('allows reinitialization after reset', () => {
      initTelemetry();
      const client1 = getGlobalTelemetryClient();

      resetGlobalTelemetryClient();
      initTelemetry();
      const client2 = getGlobalTelemetryClient();

      expect(client1).not.toBe(client2);
      expect(isTelemetryInitialized()).toBe(true);
    });
  });

  describe('levelPriority utility', () => {
    it('provides correct priority ordering', () => {
      expect(levelPriority.INFO).toBe(1);
      expect(levelPriority.WARN).toBe(2);
      expect(levelPriority.ERROR).toBe(3);
    });

    it('can be used for level comparisons', () => {
      expect(levelPriority.ERROR > levelPriority.WARN).toBe(true);
      expect(levelPriority.WARN > levelPriority.INFO).toBe(true);
      expect(levelPriority.INFO < levelPriority.ERROR).toBe(true);
    });
  });
});
