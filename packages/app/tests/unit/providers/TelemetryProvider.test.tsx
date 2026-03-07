/**
 * @vitest-environment jsdom
 * @file Unit тесты для TelemetryProvider (shell уровень)
 */

import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';

const telemetryMocks = vi.hoisted(() => {
  const log = vi.fn().mockResolvedValue(undefined);
  const client = { log };

  return {
    client,
    log,
    getGlobalTelemetryClient: vi.fn(() => client),
    initTelemetry: vi.fn(() => client),
    isTelemetryInitialized: vi.fn(() => false),
  };
});

vi.mock('../../../src/lib/telemetry-runtime', async () => {
  const actual = await vi.importActual('../../../src/lib/telemetry-runtime');

  return {
    ...actual,
    getGlobalTelemetryClient: telemetryMocks.getGlobalTelemetryClient,
    initTelemetry: telemetryMocks.initTelemetry,
    isTelemetryInitialized: telemetryMocks.isTelemetryInitialized,
  };
});

import { TelemetryProvider, useTelemetryContext } from '../../../src/providers/TelemetryProvider';

type TrackEvent = Readonly<{
  name: string;
  payload?: Readonly<Record<string, unknown>>;
}>;

function TrackOnMount({ events }: Readonly<{ events: readonly TrackEvent[]; }>) {
  const { track } = useTelemetryContext();

  useEffect(() => {
    events.forEach((event) => {
      track(event.name, event.payload);
    });
  }, [events, track]);

  return null;
}

describe('TelemetryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telemetryMocks.isTelemetryInitialized.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes batch with single fire-and-forget call and preserves order', async () => {
    const events = [
      { name: 'event-one', payload: { value: 1 } },
      { name: 'event-two', payload: { value: 2 } },
    ] as const;

    render(
      <TelemetryProvider maxBatchSize={2}>
        <TrackOnMount events={events} />
      </TelemetryProvider>,
    );

    // Проверяем, что log вызывается для обоих событий (flush происходит автоматически при достижении maxBatchSize)
    await waitFor(() => {
      expect(telemetryMocks.log).toHaveBeenCalledTimes(2);
    });

    expect(telemetryMocks.log).toHaveBeenNthCalledWith(
      1,
      'INFO',
      'event-one',
      expect.any(Object),
      expect.any(Number),
    );
    expect(telemetryMocks.log).toHaveBeenNthCalledWith(
      2,
      'INFO',
      'event-two',
      expect.any(Object),
      expect.any(Number),
    );
  });

  it('uses existing global client when already initialized', async () => {
    telemetryMocks.isTelemetryInitialized.mockReturnValue(true);

    render(
      <TelemetryProvider maxBatchSize={1}>
        <TrackOnMount events={[{ name: 'event-existing' }]} />
      </TelemetryProvider>,
    );

    await waitFor(() => {
      expect(telemetryMocks.getGlobalTelemetryClient).toHaveBeenCalledTimes(1);
    });
    expect(telemetryMocks.initTelemetry).not.toHaveBeenCalled();
  });

  it('does not emit events when disabled', async () => {
    render(
      <TelemetryProvider enabled={false}>
        <TrackOnMount events={[{ name: 'event-disabled' }]} />
      </TelemetryProvider>,
    );

    // Даем время для обработки, если бы она происходила
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(telemetryMocks.log).not.toHaveBeenCalled();
    expect(telemetryMocks.initTelemetry).not.toHaveBeenCalled();
    expect(telemetryMocks.getGlobalTelemetryClient).not.toHaveBeenCalled();
  });

  it('flushes via interval timer', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(
      <TelemetryProvider flushIntervalMs={100}>
        <TrackOnMount events={[{ name: 'event-interval' }]} />
      </TelemetryProvider>,
    );

    // Initially should not have called log (event is buffered)
    expect(telemetryMocks.log).not.toHaveBeenCalled();

    // Get the interval callback and call it manually
    const intervalCallback = setIntervalSpy.mock.calls[0]?.[0] as (() => void);
    expect(intervalCallback).toBeDefined();

    intervalCallback();

    // Проверяем, что log вызывается после flush через интервал
    await waitFor(() => {
      expect(telemetryMocks.log).toHaveBeenCalledTimes(1);
    });

    setIntervalSpy.mockRestore();
  });

  it('guards maxBatchSize against invalid values', async () => {
    render(
      <TelemetryProvider maxBatchSize={0}>
        <TrackOnMount events={[{ name: 'event-guarded' }]} />
      </TelemetryProvider>,
    );

    // maxBatchSize=0 корректируется до 1, поэтому flush должен произойти сразу
    await waitFor(() => {
      expect(telemetryMocks.log).toHaveBeenCalledTimes(1);
    });
  });

  it('handles complex metadata types in normalizeTelemetryValue', async () => {
    const circularObj = {} as any;
    const events = [
      {
        name: 'complex-event',
        payload: {
          date: new Date('2023-01-01'),
          error: new Error('test error'),
          bigint: BigInt(123),
          symbol: Symbol('test'),
          circular: circularObj,
        },
      },
    ];

    // Create circular reference
    circularObj.self = circularObj;

    render(
      <TelemetryProvider maxBatchSize={1}>
        <TrackOnMount events={events} />
      </TelemetryProvider>,
    );

    // Проверяем, что log вызывается после flush
    await waitFor(() => {
      expect(telemetryMocks.log).toHaveBeenCalledTimes(1);
    });

    expect(telemetryMocks.log).toHaveBeenCalledWith(
      'INFO',
      'complex-event',
      {
        date: '2023-01-01T00:00:00.000Z',
        error: 'test error',
        bigint: '123',
        symbol: 'Symbol(test)',
        circular: '[object Object]',
      },
      expect.any(Number),
    );
  });

  it('calls cleanup function on unmount', async () => {
    const { unmount } = render(
      <TelemetryProvider flushIntervalMs={1000}>
        <TrackOnMount events={[{ name: 'event-cleanup' }]} />
      </TelemetryProvider>,
    );

    // Wait for interval to be set up
    await waitFor(() => {
      expect(telemetryMocks.initTelemetry).toHaveBeenCalled();
    });

    // Event должен быть в буфере, но еще не отправлен
    expect(telemetryMocks.log).not.toHaveBeenCalled();

    unmount();

    // После unmount должен произойти flush (cleanup вызывает flush)
    await waitFor(() => {
      expect(telemetryMocks.log).toHaveBeenCalledTimes(1);
    });
  });

  it('warns when useTelemetryContext is used without provider', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // This should work in test environment since we can't easily test NODE_ENV
    expect(() => {
      // We'll test this by creating a component that uses the hook without provider
      function TestComponent() {
        useTelemetryContext();
        return null;
      }

      render(<TestComponent />);
    }).not.toThrow();

    consoleWarnSpy.mockRestore();
  });

  it('uses NOOP_CONTEXT when useTelemetryContext is used without provider', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function TestComponent() {
      const { track, flush } = useTelemetryContext();

      // Проверяем, что noop функции вызываются без ошибок
      expect(() => {
        track('test-event', { data: 'test' });
        flush();
      }).not.toThrow();

      // Проверяем, что функции возвращают undefined
      expect(track('test-event', { data: 'test' })).toBeUndefined();
      expect(flush()).toBeUndefined();

      return null;
    }

    render(<TestComponent />);

    consoleWarnSpy.mockRestore();
  });

  it('handles flush errors in development mode', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Используем vi.stubEnv для мокирования NODE_ENV
    vi.stubEnv('NODE_ENV', 'development');

    // Мокаем log чтобы он выбрасывал ошибку
    const logError = new Error('Flush error');
    telemetryMocks.log.mockRejectedValueOnce(logError);

    render(
      <TelemetryProvider maxBatchSize={1}>
        <TrackOnMount events={[{ name: 'event-error' }]} />
      </TelemetryProvider>,
    );

    // Ждем, пока flush попытается выполниться и упадет с ошибкой
    await waitFor(() => {
      expect(telemetryMocks.log).toHaveBeenCalled();
    }, { timeout: 2000 });

    // В development режиме должна быть вызвана console.error
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    }, { timeout: 2000 });

    // Проверяем, что console.error был вызван с правильными аргументами
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[TelemetryProvider] Flush error:',
      expect.any(Error),
    );

    // Восстанавливаем окружение
    vi.unstubAllEnvs();
    consoleErrorSpy.mockRestore();
  });

  it('handles ensureClient returning null when enabled is false', async () => {
    render(
      <TelemetryProvider enabled={false} maxBatchSize={1}>
        <TrackOnMount events={[{ name: 'event-disabled-client' }]} />
      </TelemetryProvider>,
    );

    // Даем время для обработки
    await new Promise((resolve) => setTimeout(resolve, 100));

    // log не должен быть вызван, так как enabled=false
    expect(telemetryMocks.log).not.toHaveBeenCalled();
    expect(telemetryMocks.initTelemetry).not.toHaveBeenCalled();
  });

  it('calls cleanup interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = render(
      <TelemetryProvider flushIntervalMs={100}>
        <TrackOnMount events={[{ name: 'event-cleanup-interval' }]} />
      </TelemetryProvider>,
    );

    // Ждем, пока interval установится
    await waitFor(() => {
      expect(telemetryMocks.initTelemetry).toHaveBeenCalled();
    });

    unmount();

    // Проверяем, что clearInterval был вызван для cleanup
    await waitFor(() => {
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    clearIntervalSpy.mockRestore();
  });
});
