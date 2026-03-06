/**
 * @file Unit тесты для sinks.ts
 * Цель: 100% coverage для Stmts, Branch, Funcs, Lines
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelemetryEvent, TelemetryMetadata } from '@livai/core-contracts';

import {
  createConsoleSink,
  createExternalSink,
  createExternalSinkSafe,
} from '../../src/telemetry/sinks.js';

// Для тестов допустимо:
// - Мутации объектов для создания тестовых данных (fp/no-mutation)
// - Нарушение правил сортировки импортов для удобства чтения (simple-import-sort/imports)
/* eslint-disable fp/no-mutation */

/* ========================================================================== */
/* 🔧 TEST HELPERS */
/* ========================================================================== */

function createTestEvent(overrides?: Partial<TelemetryEvent>): TelemetryEvent {
  return {
    level: 'INFO',
    message: 'test message',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockSdk<TMetadata = TelemetryMetadata>() {
  const capture = vi.fn<(event: Readonly<TelemetryEvent<TMetadata>>) => Promise<void>>();
  return {
    capture: capture as unknown as (
      event: Readonly<TelemetryEvent<TMetadata>>,
    ) => Promise<void> | void,
  } as { capture: (event: Readonly<TelemetryEvent<TMetadata>>) => Promise<void> | void; };
}

/* ========================================================================== */
/* 🔌 CONSOLE SINK */
/* ========================================================================== */

describe('createConsoleSink', () => {
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  // eslint-disable-next-line functional/no-let -- Переменные переприсваиваются в beforeEach
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line functional/no-let -- Переменные переприсваиваются в beforeEach
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line functional/no-let -- Переменные переприсваиваются в beforeEach
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  it('создает sink без formatter для INFO уровня', () => {
    const sink = createConsoleSink();
    const event = createTestEvent({ level: 'INFO' });

    sink(event);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const call = consoleLogSpy.mock.calls[0];
    expect(call[0]).toContain('[INFO]');
    expect(call[1]).toBe('test message');
  });

  it('создает sink без formatter для WARN уровня', () => {
    const sink = createConsoleSink();
    const event = createTestEvent({ level: 'WARN' });

    sink(event);

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const call = consoleWarnSpy.mock.calls[0];
    expect(call[0]).toContain('[WARN]');
    expect(call[1]).toBe('test message');
  });

  it('создает sink без formatter для ERROR уровня', () => {
    const sink = createConsoleSink();
    const event = createTestEvent({ level: 'ERROR' });

    sink(event);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const call = consoleErrorSpy.mock.calls[0];
    expect(call[0]).toContain('[ERROR]');
    expect(call[1]).toBe('test message');
  });

  it('выводит metadata если оно присутствует', () => {
    const sink = createConsoleSink();
    const event = createTestEvent({
      level: 'INFO',
      metadata: { key: 'value' },
    });

    sink(event);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const call = consoleLogSpy.mock.calls[0];
    expect(call[0]).toContain('[INFO]');
    expect(call[1]).toBe('test message');
    expect(call[2]).toEqual({ key: 'value' });
  });

  it('не выводит metadata если оно отсутствует', () => {
    const sink = createConsoleSink();
    const event = createTestEvent({
      level: 'INFO',
    });
    delete (event as { metadata?: unknown; }).metadata;

    sink(event);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const call = consoleLogSpy.mock.calls[0];
    expect(call.length).toBe(2);
    expect(call[0]).toContain('[INFO]');
    expect(call[1]).toBe('test message');
  });

  it('использует formatter если он предоставлен', () => {
    const formatter = vi.fn((event: TelemetryEvent) =>
      [
        'formatted',
        event.level,
        event.message,
      ] as const
    );
    const sink = createConsoleSink(formatter);
    const event = createTestEvent({ level: 'INFO' });

    sink(event);

    expect(formatter).toHaveBeenCalledWith(event);
    expect(consoleLogSpy).toHaveBeenCalledWith('formatted', 'INFO', 'test message');
  });

  it('использует formatter для ERROR уровня', () => {
    const formatter = vi.fn((event: TelemetryEvent) =>
      [
        'error formatted',
        event.message,
      ] as const
    );
    const sink = createConsoleSink(formatter);
    const event = createTestEvent({ level: 'ERROR' });

    sink(event);

    expect(formatter).toHaveBeenCalledWith(event);
    expect(consoleErrorSpy).toHaveBeenCalledWith('error formatted', 'test message');
  });

  it('использует formatter для WARN уровня', () => {
    const formatter = vi.fn((event: TelemetryEvent) =>
      [
        'warn formatted',
        event.message,
      ] as const
    );
    const sink = createConsoleSink(formatter);
    const event = createTestEvent({ level: 'WARN' });

    sink(event);

    expect(formatter).toHaveBeenCalledWith(event);
    expect(consoleWarnSpy).toHaveBeenCalledWith('warn formatted', 'test message');
  });
});

/* ========================================================================== */
/* 🔌 EXTERNAL SINK */
/* ========================================================================== */

describe('createExternalSink', () => {
  it('создает sink для валидного SDK', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(event);
  });

  it('выбрасывает ошибку если SDK не имеет метода capture', () => {
    const invalidSdk = {} as unknown as { capture?: unknown; };

    expect(() => {
      createExternalSink(invalidSdk as any);
    }).toThrow('SDK must have a capture method that is a function');
  });

  it('выбрасывает ошибку если SDK.capture не является функцией', () => {
    const invalidSdk = {
      capture: 'not a function',
    } as unknown as { capture: unknown; };

    expect(() => {
      createExternalSink(invalidSdk as any);
    }).toThrow('SDK must have a capture method that is a function');
  });

  it('использует дефолтные значения retry config', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    // Явно указываем маленькие задержки для быстрых тестов
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        baseDelayMs: 1,
        maxDelayMs: 100,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('использует кастомный retry config', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 1.5,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('ограничивает maxRetries до MAX_ALLOWED_RETRIES', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 20, // Больше MAX_ALLOWED_RETRIES (10)
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('ограничивает backoffMultiplier до MIN_BACKOFF_MULTIPLIER', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 0.5, // Меньше MIN_BACKOFF_MULTIPLIER (1)
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('ограничивает backoffMultiplier до MAX_BACKOFF_MULTIPLIER', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 20, // Больше MAX_BACKOFF_MULTIPLIER (10)
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('выполняет retry при ошибке', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(undefined);
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('выбрасывает ошибку после исчерпания всех попыток', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const error = new Error('Persistent error');
    mockCapture.mockRejectedValue(error);
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await expect(sink(event)).rejects.toThrow('Persistent error');
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('использует exponential backoff для retry', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture
      .mockRejectedValueOnce(new Error('First error'))
      .mockRejectedValueOnce(new Error('Second error'))
      .mockResolvedValueOnce(undefined);
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 3,
        baseDelayMs: 1, // Минимальная задержка для быстрых тестов
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(3);
  });

  it('ограничивает задержку до maxDelayMs', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(undefined);
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 50, // Максимальная задержка меньше базовой * multiplier
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('обрабатывает async capture метод', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    const sink = createExternalSink(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});

/* ========================================================================== */
/* 🔌 EXTERNAL SINK SAFE */
/* ========================================================================== */

describe('createExternalSinkSafe', () => {
  it('создает sink для валидного SDK', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(event);
  });

  it('выбрасывает ошибку если SDK не имеет метода capture', () => {
    const invalidSdk = {} as unknown as { capture?: unknown; };

    expect(() => {
      createExternalSinkSafe(invalidSdk as any);
    }).toThrow('SDK must have a capture method that is a function');
  });

  it('выбрасывает ошибку если SDK.capture не является функцией', () => {
    const invalidSdk = {
      capture: 'not a function',
    } as unknown as { capture: unknown; };

    expect(() => {
      createExternalSinkSafe(invalidSdk as any);
    }).toThrow('SDK must have a capture method that is a function');
  });

  it('выбрасывает ошибку при сбое SDK (без onError)', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture.mockRejectedValue(new Error('SDK error'));
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      undefined,
      {
        maxRetries: 3,
        baseDelayMs: 1, // Минимальная задержка для быстрых тестов
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    // В safe mode без onError передается null в executeWithRetry,
    // что означает unsafe mode (ошибка выбрасывается)
    await expect(sink(event)).rejects.toThrow('SDK error');
    expect(mockCapture).toHaveBeenCalledTimes(3);
  });

  it('вызывает onError callback при сбое SDK', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const error = new Error('SDK error');
    mockCapture.mockRejectedValue(error);
    const onError = vi.fn();
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      onError,
      {
        maxRetries: 3,
        baseDelayMs: 1, // Минимальная задержка для быстрых тестов
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, event);
    expect(mockCapture).toHaveBeenCalledTimes(3);
  });

  it('вызывает onError после всех попыток retry', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const error = new Error('Persistent error');
    mockCapture.mockRejectedValue(error);
    const onError = vi.fn();
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      onError,
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, event);
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('использует дефолтные значения retry config', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    // Явно указываем маленькие задержки для быстрых тестов
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      undefined,
      {
        baseDelayMs: 1,
        maxDelayMs: 100,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('использует кастомный retry config', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      undefined,
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 1.5,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('ограничивает maxRetries до MAX_ALLOWED_RETRIES', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      undefined,
      {
        maxRetries: 20, // Больше MAX_ALLOWED_RETRIES (10)
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('ограничивает backoffMultiplier до MIN_BACKOFF_MULTIPLIER', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      undefined,
      {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 0.5, // Меньше MIN_BACKOFF_MULTIPLIER (1)
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('ограничивает backoffMultiplier до MAX_BACKOFF_MULTIPLIER', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      undefined,
      {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 20, // Больше MAX_BACKOFF_MULTIPLIER (10)
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('выполняет retry при ошибке', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      onError,
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled(); // Успешная вторая попытка
  });

  it('вызывает onError после исчерпания всех попыток', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const error = new Error('Persistent error');
    mockCapture.mockRejectedValue(error);
    const onError = vi.fn();
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      onError,
      {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, event);
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('использует exponential backoff для retry', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture
      .mockRejectedValueOnce(new Error('First error'))
      .mockRejectedValueOnce(new Error('Second error'))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      onError,
      {
        maxRetries: 3,
        baseDelayMs: 1, // Минимальная задержка для быстрых тестов
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled(); // Успешная третья попытка
  });

  it('ограничивает задержку до maxDelayMs', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      onError,
      {
        maxRetries: 2,
        baseDelayMs: 3,
        maxDelayMs: 2, // Максимальная задержка меньше базовой * multiplier
        backoffMultiplier: 2,
      },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled(); // Успешная вторая попытка
  });

  it('обрабатывает async capture метод', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    mockCapture.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
    );
    const event = createTestEvent();

    await sink(event);

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('передает event в onError callback', async () => {
    const sdk = createMockSdk();
    const mockCapture = sdk.capture as ReturnType<typeof vi.fn>;
    const error = new Error('SDK error');
    mockCapture.mockRejectedValue(error);
    const onError = vi.fn();
    // Явно указываем маленькие задержки для быстрых тестов
    const sink = createExternalSinkSafe(
      sdk as unknown as { capture: (event: Readonly<TelemetryEvent>) => Promise<void> | void; },
      onError,
      {
        baseDelayMs: 1,
        maxDelayMs: 100,
      },
    );
    const event = createTestEvent({ message: 'custom message' });

    await sink(event);

    expect(onError).toHaveBeenCalledWith(error, event);
  });
});

/* eslint-enable */
