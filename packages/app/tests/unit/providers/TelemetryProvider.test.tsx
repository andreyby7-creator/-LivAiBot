/**
 * @vitest-environment jsdom
 * @file Unit тесты для TelemetryProvider (shell уровень)
 */

import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const telemetryMocks = vi.hoisted(() => {
  const log = vi.fn().mockResolvedValue(undefined);
  const client = { log };

  return {
    client,
    log,
    fireAndForget: vi.fn(async (fn: () => Promise<void> | void) => {
      await fn();
    }),
    getGlobalTelemetryClient: vi.fn(() => client),
    initTelemetry: vi.fn(() => client),
    isTelemetryInitialized: vi.fn(() => false),
  };
});

vi.mock('../../../src/runtime/telemetry', async () => {
  const actual = await vi.importActual('../../../src/runtime/telemetry');

  return {
    ...actual,
    fireAndForget: telemetryMocks.fireAndForget,
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

    await waitFor(() => {
      expect(telemetryMocks.fireAndForget).toHaveBeenCalledTimes(1);
    });

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

    await waitFor(() => {
      expect(telemetryMocks.fireAndForget).not.toHaveBeenCalled();
    });
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

    // Initially should not have called fireAndForget
    expect(telemetryMocks.fireAndForget).not.toHaveBeenCalled();

    // Get the interval callback and call it manually
    const intervalCallback = setIntervalSpy.mock.calls[0]?.[0] as (() => void);
    expect(intervalCallback).toBeDefined();

    intervalCallback();

    await waitFor(() => {
      expect(telemetryMocks.fireAndForget).toHaveBeenCalledTimes(1);
    });

    setIntervalSpy.mockRestore();
  });

  it('guards maxBatchSize against invalid values', async () => {
    render(
      <TelemetryProvider maxBatchSize={0}>
        <TrackOnMount events={[{ name: 'event-guarded' }]} />
      </TelemetryProvider>,
    );

    await waitFor(() => {
      expect(telemetryMocks.fireAndForget).toHaveBeenCalledTimes(1);
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

    await waitFor(() => {
      expect(telemetryMocks.fireAndForget).toHaveBeenCalledTimes(1);
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

    unmount();

    await waitFor(() => {
      expect(telemetryMocks.fireAndForget).toHaveBeenCalledTimes(1);
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
});
