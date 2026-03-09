/* eslint-disable functional/no-let, fp/no-mutation */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  EventSourceFactory,
  EventSourceLike,
  HeartbeatEffect,
  ReconnectStrategy,
  SSEClientConfig,
  SSEClientState,
  SSEDecoder,
  SSEFrame,
  SSEInternalEvent,
  SSEProtocolEvent,
} from '../../src/transport/sse-client.js';
import {
  calculateReconnectDelay,
  calculateReconnectDelayWithJitter,
  createHeartbeatEffect,
  createInitialSSEState,
  createReconnectEffect,
  createSSEEffect,
  createSSERuntime,
  defaultDecoder,
  NO_OP_LOGGER,
  offSSEMessage,
  onSSEMessage,
  reduceSSEState,
} from '../../src/transport/sse-client.js';

type TestState = SSEClientState<unknown>;

const makeBaseConfig = (
  overrides: Partial<SSEClientConfig<unknown>> = {},
): SSEClientConfig<unknown> => ({
  url: 'http://example.com/sse',
  autoReconnect: true,
  maxRetries: 3,
  reconnectStrategy: { type: 'fixed', delayMs: 1000 },
  telemetry: {},
  logger: NO_OP_LOGGER,
  clock: () => 0,
  random: () => 0,
  ...overrides,
});

const makeState = (overrides: Partial<TestState> = {}): TestState => {
  const base = createInitialSSEState(makeBaseConfig());
  return {
    ...base,
    ...overrides,
    connection: {
      ...base.connection,
      ...(overrides.connection ?? {}),
    },
    heartbeat: {
      ...base.heartbeat,
      ...(overrides.heartbeat ?? {}),
    },
    subscriptions: {
      ...base.subscriptions,
      ...(overrides.subscriptions ?? {}),
    },
  };
};

describe('sse-client.ts — default decoder and initial state', () => {
  it('defaultDecoder декодирует корректный JSON frame и использует поля frame/parsed', () => {
    const clock = () => 123;
    const frame: SSEFrame = {
      id: 'frame-id',
      event: 'event-type',
      data: JSON.stringify({ id: 'payload-id', type: 'payload-type', payload: { x: 1 } }),
      retry: undefined,
    };

    const evt = defaultDecoder(frame, clock);
    expect(evt).not.toBeNull();
    expect(evt?.id).toBe('frame-id');
    expect(evt?.type).toBe('event-type');
    expect(evt?.timestamp).toBe(123);
    expect(evt?.payload).toEqual({ x: 1 });
  });

  it('defaultDecoder возвращает null при невалидном JSON', () => {
    const frame: SSEFrame = {
      id: undefined,
      event: undefined,
      data: 'not-json',
      retry: undefined,
    };
    const evt = defaultDecoder(frame, () => 0);
    expect(evt).toBeNull();
  });

  it('defaultDecoder использует parsed.id когда frame.id отсутствует', () => {
    const clock = () => 123;
    const frame: SSEFrame = {
      id: undefined,
      event: undefined,
      data: JSON.stringify({ id: 'parsed-id', type: 'test', payload: {} }),
      retry: undefined,
    };
    const evt = defaultDecoder(frame, clock);
    expect(evt).not.toBeNull();
    expect(evt?.id).toBe('parsed-id');
  });

  it('defaultDecoder использует frame.event когда parsed.type отсутствует', () => {
    const clock = () => 123;
    const frame: SSEFrame = {
      id: 'test-id',
      event: 'frame-event',
      data: JSON.stringify({ payload: {} }),
      retry: undefined,
    };
    const evt = defaultDecoder(frame, clock);
    expect(evt).not.toBeNull();
    expect(evt?.type).toBe('frame-event');
  });

  it('defaultDecoder использует parsed.type когда frame.event отсутствует', () => {
    const clock = () => 123;
    const frame: SSEFrame = {
      id: 'test-id',
      event: undefined,
      data: JSON.stringify({ type: 'parsed-type', payload: {} }),
      retry: undefined,
    };
    const evt = defaultDecoder(frame, clock);
    expect(evt).not.toBeNull();
    expect(evt?.type).toBe('parsed-type');
  });

  it('defaultDecoder использует "message" как fallback когда и frame.event и parsed.type отсутствуют', () => {
    const clock = () => 123;
    const frame: SSEFrame = {
      id: 'test-id',
      event: undefined,
      data: JSON.stringify({ payload: {} }),
      retry: undefined,
    };
    const evt = defaultDecoder(frame, clock);
    expect(evt).not.toBeNull();
    expect(evt?.type).toBe('message');
  });

  it('createInitialSSEState задаёт корректные дефолты и использует DI clock/random', () => {
    const clock = vi.fn(() => 42);
    const random = vi.fn(() => 0.5);
    const state = createInitialSSEState({
      url: 'http://example.com/stream',
      clock,
      random,
    });

    expect(state.url).toBe('http://example.com/stream');
    expect(state.connection.connectionState).toBe('CLOSED');
    expect(state.heartbeat.timeoutMs).toBeGreaterThan(0);
    expect(state.subscriptions.listeners.size).toBe(0);
    expect(state.clock()).toBe(42);
    expect(state.random()).toBe(0.5);
  });
});

describe('sse-client.ts — reconnect delay helpers', () => {
  const strategyFixed: ReconnectStrategy = { type: 'fixed', delayMs: 1000 };
  const strategyLinear: ReconnectStrategy = { type: 'linear', baseDelayMs: 500 };
  const strategyExponential: ReconnectStrategy = {
    type: 'exponential',
    baseDelayMs: 200,
    factor: 3,
  };
  const strategyCustom: ReconnectStrategy = {
    type: 'custom',
    calculateDelay: (attempt) => attempt * 42,
  };

  it('calculateReconnectDelay поддерживает все стратегии', () => {
    expect(calculateReconnectDelay(strategyFixed, 5)).toBe(1000);
    expect(calculateReconnectDelay(strategyLinear, 3)).toBe(1500);
    expect(calculateReconnectDelay(strategyExponential, 2)).toBe(200 * Math.pow(3, 1));
    expect(calculateReconnectDelay(strategyCustom, 2)).toBe(84);
  });

  // eslint-disable-next-line ai-security/token-leakage -- строка содержит имя функции, а не секрет/токен
  it('calculateReconnectDelayWithJitter добавляет jitter и использует random', () => {
    const random = () => 0.5;
    const delay = calculateReconnectDelayWithJitter(strategyFixed, 1, random);
    // base = 1000, jitterFactor = 0.2 → jitter = 0.5 * 1000 * 0.2 = 100
    expect(delay).toBe(1100);
  });
});

describe('sse-client.ts — subscriptions helpers', () => {
  it('onSSEMessage регистрирует listener и offSSEMessage снимает его', () => {
    const state = makeState();
    const listener = vi.fn();

    const withListener = onSSEMessage(state, 'topic', listener);
    expect(withListener.subscriptions.listeners.get('topic')?.has(listener)).toBe(true);

    const withoutListener = offSSEMessage(withListener, 'topic', listener);
    expect(withoutListener.subscriptions.listeners.get('topic')).toBeUndefined();
  });

  it('offSSEMessage игнорирует отсутствие topic', () => {
    const state = makeState();
    const listener = vi.fn();
    const result = offSSEMessage(state, 'missing', listener);
    expect(result).toBe(state);
  });
});

describe('sse-client.ts — reducer FSM', () => {
  const makeDecoder =
    <T>(fn: (frame: SSEFrame) => SSEProtocolEvent<T> | null): SSEDecoder<T> => (frame, _clock) =>
      fn(frame);

  it('обрабатывает CONNECTING', () => {
    const state = makeState();
    const { newState, emittedEvents } = reduceSSEState(state, { type: 'CONNECTING' });
    expect(newState.connection.connectionState).toBe('CONNECTING');
    expect(emittedEvents).toHaveLength(0);
  });

  it('обрабатывает CONNECTED и эмитит TELEMETRY_CONNECT', () => {
    const state = makeState();
    const es = {} as EventSourceLike;
    const { newState, emittedEvents } = reduceSSEState(state, {
      type: 'CONNECTED',
      eventSource: es,
    });
    expect(newState.connection.eventSource).toBe(es);
    expect(emittedEvents).toEqual([{ type: 'TELEMETRY_CONNECT' }]);
  });

  it('SET_CLEANUP и SET_HEARTBEAT_CLEANUP обновляют cleanup функции', () => {
    const state = makeState();
    const cleanup = vi.fn();
    const hbCleanup = vi.fn();

    const s1 = reduceSSEState(state, { type: 'SET_CLEANUP', cleanup }).newState;
    expect(s1.connection.cleanup).toBe(cleanup);

    const s2 = reduceSSEState(s1, {
      type: 'SET_HEARTBEAT_CLEANUP',
      cleanup: hbCleanup,
    }).newState;
    expect(s2.heartbeat.heartbeatCleanup).toBe(hbCleanup);
  });

  it('START_HEARTBEAT и HEARTBEAT обновляют lastHeartbeatAt', () => {
    const state = makeState({
      heartbeat: { ...makeState().heartbeat, lastHeartbeatAt: 0 },
    });
    const ts1 = 10;
    const ts2 = 20;

    const s1 = reduceSSEState(state, { type: 'START_HEARTBEAT', timestamp: ts1 }).newState;
    expect(s1.heartbeat.lastHeartbeatAt).toBe(ts1);

    const s2 = reduceSSEState(s1, { type: 'HEARTBEAT', timestamp: ts2 }).newState;
    expect(s2.heartbeat.lastHeartbeatAt).toBe(ts2);
  });

  it('INCREMENT_RETRIES увеличивает счётчик ретраев', () => {
    const state = makeState({
      connection: { ...makeState().connection, retries: 1 },
    });
    const { newState } = reduceSSEState(state, { type: 'INCREMENT_RETRIES' });
    expect(newState.connection.retries).toBe(2);
  });

  it('OPEN переводит состояние в OPEN и сбрасывает retries', () => {
    const state = makeState({
      connection: {
        ...makeState().connection,
        connectionState: 'CONNECTING',
        retries: 2,
      },
      heartbeat: { ...makeState().heartbeat, lastHeartbeatAt: 0 },
    });
    const { newState, emittedEvents } = reduceSSEState(state, {
      type: 'OPEN',
      timestamp: 100,
    });
    expect(newState.connection.connectionState).toBe('OPEN');
    expect(newState.connection.retries).toBe(0);
    expect(newState.heartbeat.lastHeartbeatAt).toBe(100);
    expect(emittedEvents).toHaveLength(0);
  });

  it('MESSAGE с decoder, возвращающим null, ничего не делает', () => {
    const state: TestState = {
      ...makeState(),
      decoder: makeDecoder(() => null),
    };
    const frame: SSEFrame = { id: '1', event: 'e', data: 'd', retry: undefined };
    const result = reduceSSEState(state, {
      type: 'MESSAGE',
      frame,
      timestamp: 0,
    });
    expect(result.newState).toBe(state);
    expect(result.emittedEvents).toHaveLength(0);
  });

  it('MESSAGE с валидным decoder обновляет lastEventId и heartbeat и эмитит decoded+telemetry', () => {
    const decoded: SSEProtocolEvent<string> = {
      id: '42',
      type: 'topic',
      timestamp: 999,
      payload: 'payload',
    };
    const decoder = makeDecoder<string>(() => decoded);
    const state: TestState = {
      ...makeState(),
      decoder,
      heartbeat: { ...makeState().heartbeat, lastHeartbeatAt: 1 },
    };
    const frame: SSEFrame = {
      id: '42',
      event: 'message',
      data: 'abc',
      retry: undefined,
    };
    const ts = 1000;
    const { newState, emittedEvents } = reduceSSEState(state, {
      type: 'MESSAGE',
      frame,
      timestamp: ts,
    });
    expect(newState.connection.lastEventId).toBe('42');
    expect(newState.heartbeat.lastHeartbeatAt).toBe(ts);
    expect(emittedEvents[0]).toEqual(decoded);
    expect(emittedEvents[1]).toEqual({
      type: 'TELEMETRY_MESSAGE',
      bytes: frame.data.length,
    });
  });

  it('MESSAGE с decoded.id undefined сохраняет предыдущий lastEventId', () => {
    const decoded: SSEProtocolEvent<string> = {
      id: undefined,
      type: 'topic',
      timestamp: 999,
      payload: 'payload',
    };
    const decoder = makeDecoder<string>(() => decoded);
    const state: TestState = {
      ...makeState(),
      decoder,
      connection: {
        ...makeState().connection,
        lastEventId: 'previous-id',
      },
    };
    const frame: SSEFrame = {
      id: undefined,
      event: 'message',
      data: 'payload',
      retry: undefined,
    };
    const { newState } = reduceSSEState(state, {
      type: 'MESSAGE',
      frame,
      timestamp: 1000,
    });
    expect(newState.connection.lastEventId).toBe('previous-id');
  });

  it('ERROR без возможности reconnect помечает CLOSED и эмитит только TELEMETRY_ERROR', () => {
    const state: TestState = {
      ...makeState({
        autoReconnect: false,
      }),
    };
    const error = new Error('boom');
    const { newState, emittedEvents } = reduceSSEState(state, {
      type: 'ERROR',
      error,
    });
    expect(newState.connection.connectionState).toBe('CLOSED');
    expect(emittedEvents[0]).toEqual({ type: 'TELEMETRY_ERROR', error });
    expect(emittedEvents).toHaveLength(1);
  });

  it('ERROR с возможностью reconnect эмитит TELEMETRY_ERROR и RECONNECT', () => {
    const state: TestState = {
      ...makeState({
        autoReconnect: true,
        maxRetries: 5,
        connection: { ...makeState().connection, retries: 0 },
        random: () => 0,
      }),
    };
    const error = new Error('boom');
    const { newState, emittedEvents } = reduceSSEState(state, {
      type: 'ERROR',
      error,
    });
    expect(newState.connection.connectionState).toBe('CLOSED');
    expect(emittedEvents[0]).toEqual({ type: 'TELEMETRY_ERROR', error });
    const reconnectEvent = emittedEvents[1];
    expect(reconnectEvent).toMatchObject({ type: 'RECONNECT' });
    expect((reconnectEvent as any).delayMs).toBeGreaterThan(0);
  });

  it('DISCONNECTED очищает ресурсы, эмитит TELEMETRY_DISCONNECT и CLEANUP события', () => {
    const cleanup = vi.fn();
    const hbCleanup = vi.fn();
    const state: TestState = {
      ...makeState({
        connection: {
          ...makeState().connection,
          connectionState: 'OPEN',
          cleanup,
          eventSource: {} as EventSourceLike,
        },
        heartbeat: {
          ...makeState().heartbeat,
          heartbeatCleanup: hbCleanup,
        },
      }),
    };
    const { newState, emittedEvents } = reduceSSEState(state, { type: 'DISCONNECTED' });
    expect(newState.connection.connectionState).toBe('CLOSED');
    expect(newState.connection.cleanup).toBeUndefined();
    expect(newState.connection.eventSource).toBeUndefined();
    expect(newState.heartbeat.heartbeatCleanup).toBeUndefined();
    expect(emittedEvents[0]).toEqual({ type: 'TELEMETRY_DISCONNECT' });
    expect(emittedEvents.filter((e) => (e as any).type === 'CLEANUP')).toHaveLength(2);
  });

  it('RECONNECT_REQUEST без возможности reconnect не эмитит события', () => {
    const state: TestState = {
      ...makeState({
        autoReconnect: false,
      }),
    };
    const { newState, emittedEvents } = reduceSSEState(state, { type: 'RECONNECT_REQUEST' });
    expect(newState).toBe(state);
    expect(emittedEvents).toHaveLength(0);
  });

  it('RECONNECT_REQUEST с возможностью reconnect увеличивает retries и эмитит TELEMETRY_RECONNECT+RECONNECT', () => {
    const state: TestState = {
      ...makeState({
        autoReconnect: true,
        maxRetries: 5,
        connection: { ...makeState().connection, retries: 1 },
        random: () => 0,
      }),
    };
    const { newState, emittedEvents } = reduceSSEState(state, { type: 'RECONNECT_REQUEST' });
    expect(newState.connection.retries).toBe(2);
    const telemetryReconnect = emittedEvents[0] as any;
    const reconnect = emittedEvents[1] as any;
    expect(telemetryReconnect.type).toBe('TELEMETRY_RECONNECT');
    expect(telemetryReconnect.attempt).toBe(2);
    expect(telemetryReconnect.delayMs).toBeGreaterThan(0);
    expect(reconnect.type).toBe('RECONNECT');
  });

  it('unknown event type возвращает исходное состояние без emittedEvents', () => {
    const state = makeState();
    // @ts-expect-error — проверяем default ветку switch
    const { newState, emittedEvents } = reduceSSEState(state, { type: 'UNKNOWN' });
    expect(newState).toBe(state);
    expect(emittedEvents).toHaveLength(0);
  });
});

// Общие утилиты для тестирования SSE эффектов
interface CapturedListeners {
  open: ((e: MessageEvent) => void)[];
  message: ((e: MessageEvent) => void)[];
  error: ((e: unknown) => void)[];
}

const createTestEventSourceFactory = (
  listenersRef: { listeners?: CapturedListeners; },
  onClose?: () => void,
): EventSourceFactory =>
(url) => {
  const listeners: CapturedListeners = { open: [], message: [], error: [] };
  listenersRef.listeners = listeners;

  const es: EventSourceLike = {
    readyState: 0,
    url,
    withCredentials: true,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
    addEventListener: (type, listener) => {
      if (type === 'open') listeners.open.push(listener as (e: MessageEvent) => void);
      if (type === 'message') listeners.message.push(listener as (e: MessageEvent) => void);
      if (type === 'error') listeners.error.push(listener as (e: unknown) => void);
    },
    removeEventListener: () => {},
    close: () => {
      onClose?.();
    },
    dispatchEvent: () => true,
  };

  return es;
};

describe('sse-client.ts — SSE effect layer', () => {
  it('createSSEEffect создаёт EventSource и диспатчит CONNECTING/MESSAGE/ERROR', () => {
    const dispatched: SSEInternalEvent[] = [];
    const state = makeState({
      url: 'http://example.com/stream',
      connection: {
        ...makeState().connection,
        lastEventId: 'last-id',
      },
      // maxListenersPerChannel используется как maxFrameSize во внутреннем parseSSEFrame
      subscriptions: {
        ...makeState().subscriptions,
        maxListenersPerChannel: 1000,
      },
    });
    const listenersRef: { listeners?: CapturedListeners; } = {};
    const factory = createTestEventSourceFactory(listenersRef);

    const getState = () => state;
    const dispatch = (e: SSEInternalEvent) => {
      dispatched.push(e);
    };

    const effect = createSSEEffect(getState, dispatch, factory);
    const { cleanup } = effect();

    // CONNECTING диспатчится сразу
    expect(dispatched[0]).toEqual({ type: 'CONNECTING' });

    // Сообщение с валидным data приводит к MESSAGE
    expect(listenersRef.listeners).toBeDefined();
    const messageHandler = listenersRef.listeners?.message[0];
    expect(messageHandler).toBeDefined();
    const msgEvent = {
      data: 'retry: 1000\n{"foo":"bar"}',
      type: 'message',
    } as unknown as MessageEvent;
    messageHandler!(msgEvent);
    expect(dispatched.some((e) => e.type === 'MESSAGE')).toBe(true);

    // Сообщение с нестроковым data игнорируется (parseSSEFrame возвращает null)
    const nonTextEvent = { data: 123, type: 'message' } as unknown as MessageEvent;
    messageHandler!(nonTextEvent);
    expect(dispatched.filter((e) => e.type === 'MESSAGE')).toHaveLength(1);

    // Ошибка транслируется в ERROR
    const errorHandler = listenersRef.listeners?.error[0];
    expect(errorHandler).toBeDefined();
    const error = new Error('sse error');
    errorHandler!(error);
    expect(dispatched.some((e) => e.type === 'ERROR')).toBe(true);

    const onClose = vi.fn();
    const emptyListenersRef: { listeners?: CapturedListeners; } = {};
    const factoryWithClose = createTestEventSourceFactory(emptyListenersRef, onClose);
    const effect2 = createSSEEffect(getState, dispatch, factoryWithClose);
    const { cleanup: cleanup2 } = effect2();
    cleanup2();
    expect(onClose).toHaveBeenCalled();
    cleanup();
  });

  it('createSSEEffect учитывает abortController и DISCONNECTED диспатчится при abort', () => {
    const controller = new AbortController();
    const state = makeState({
      abortController: controller as any,
      subscriptions: {
        ...makeState().subscriptions,
        maxListenersPerChannel: 1000,
      },
    });

    const dispatched: SSEInternalEvent[] = [];
    const getState = () => state;
    const dispatch = (e: SSEInternalEvent) => {
      dispatched.push(e);
    };

    const listenersRef: { listeners?: CapturedListeners; } = {};
    const factory = createTestEventSourceFactory(listenersRef);
    const effect = createSSEEffect(getState, dispatch, factory);
    const { cleanup } = effect();

    controller.abort();
    expect(dispatched.some((e) => e.type === 'DISCONNECTED')).toBe(true);

    cleanup();
  });
});

describe('sse-client.ts — heartbeat effect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('createHeartbeatEffect диспатчит ERROR при heartbeat timeout и позволяет cleanup', async () => {
    const heartbeatTimeoutMs = 1000;
    let now = 0;

    const state = makeState({
      heartbeat: {
        ...makeState().heartbeat,
        lastHeartbeatAt: 0,
        timeoutMs: heartbeatTimeoutMs,
      },
      clock: () => now,
    });

    const getState = () => state;
    const dispatch = vi.fn();

    const effect: HeartbeatEffect = createHeartbeatEffect(getState, dispatch);

    let cleanupFn: (() => void) | undefined;
    effect((cleanup) => {
      cleanupFn = cleanup;
    });

    now = 2000;
    await vi.advanceTimersByTimeAsync(heartbeatTimeoutMs + 10);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ERROR',
      }),
    );

    cleanupFn?.();
  });
});

describe('sse-client.ts — reconnect effect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('createReconnectEffect возвращает null когда reconnect невозможен', () => {
    const state = makeState({
      autoReconnect: false,
    });
    const effect = createReconnectEffect(() => state, () => {});
    expect(effect).toBeNull();
  });

  it('createReconnectEffect планирует connect после задержки', async () => {
    const state = makeState({
      autoReconnect: true,
      maxRetries: 3,
      connection: { ...makeState().connection, retries: 0 },
      random: () => 0,
    });
    const connect = vi.fn();
    const effect = createReconnectEffect(() => state, connect);
    expect(effect).not.toBeNull();

    const controller = new AbortController();
    const promise = effect!(controller.signal);

    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('createReconnectEffect уважает abortSignal и отклоняет промис', async () => {
    const state = makeState({
      autoReconnect: true,
      maxRetries: 3,
      connection: { ...makeState().connection, retries: 0 },
      random: () => 0,
    });
    const connect = vi.fn();
    const effect = createReconnectEffect(() => state, connect);
    expect(effect).not.toBeNull();

    const controller = new AbortController();
    controller.abort();

    await expect(effect!(controller.signal)).rejects.toThrow('Reconnect aborted');
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('sse-client.ts — runtime, subscriptions и telemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runtime.subscribe регистрирует и снимает listener, dispatch MESSAGE вызывает listener', () => {
    const telemetry = {
      onMessage: vi.fn<(bytes: number) => void>(),
    };
    const decoder: SSEDecoder<string> = (frame, clock) => ({
      id: frame.id,
      type: 'topic',
      timestamp: clock(),
      payload: frame.data,
    });
    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      decoder,
      telemetry,
      clock: () => 1,
      random: () => 0,
    });

    const listener = vi.fn<(e: SSEProtocolEvent<string>) => void>();
    const unsubscribe = runtime.subscribe('topic', listener);

    const frame: SSEFrame = {
      id: '1',
      event: 'message',
      data: 'hello',
      retry: undefined,
    };
    runtime.dispatch({ type: 'MESSAGE', frame, timestamp: 10 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        type: 'topic',
        payload: 'hello',
      }),
    );
    expect(telemetry.onMessage).toHaveBeenCalledWith(frame.data.length);

    unsubscribe();

    runtime.dispatch({ type: 'MESSAGE', frame, timestamp: 20 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('runtime учитывает лимиты подписок и логирует ошибку при превышении', () => {
    const logger = {
      ...NO_OP_LOGGER,
      onError: vi.fn(),
    };
    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      decoder: (frame, clock) => ({
        id: frame.id,
        type: 'topic',
        timestamp: clock(),
        payload: frame.data,
      }),
      logger,
      maxListenersPerChannel: 1,
      maxChannels: 1,
    });

    const listener1 = vi.fn();
    const listener2 = vi.fn();

    runtime.subscribe('topic', listener1);
    runtime.subscribe('topic', listener2);
    expect(logger.onError).toHaveBeenCalled();

    const listener3 = vi.fn();
    runtime.subscribe('another-topic', listener3);
    expect(logger.onError).toHaveBeenCalledTimes(2);
  });

  it('runtime.subscribe обрабатывает случай превышения лимита listeners на канал', () => {
    const logger = {
      ...NO_OP_LOGGER,
      onError: vi.fn(),
    };
    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      decoder: (frame, clock) => ({
        id: frame.id,
        type: 'topic',
        timestamp: clock(),
        payload: frame.data,
      }),
      logger,
      maxListenersPerChannel: 2,
    });

    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    runtime.subscribe('topic', listener1);
    runtime.subscribe('topic', listener2);
    runtime.subscribe('topic', listener3); // Превышает лимит

    expect(logger.onError).toHaveBeenCalled();
    const errorCall = logger.onError.mock.calls[logger.onError.mock.calls.length - 1];
    expect(errorCall).toBeDefined();
    expect(errorCall![0]).toBeInstanceOf(Error);
    expect(errorCall![0].message).toContain('Max listeners per channel exceeded');
  });

  it('runtime.dispatch обрабатывает протокольное событие без listeners', () => {
    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      decoder: (frame, clock) => ({
        id: frame.id,
        type: 'unsubscribed-topic',
        timestamp: clock(),
        payload: frame.data,
      }),
      clock: () => 1,
      random: () => 0,
    });

    const frame: SSEFrame = {
      id: '1',
      event: 'message',
      data: 'data',
      retry: undefined,
    };

    // Диспатчим MESSAGE для топика без подписчиков
    expect(() => {
      runtime.dispatch({ type: 'MESSAGE', frame, timestamp: 1 });
    }).not.toThrow();
  });

  it('buildSSEUrl возвращает URL без изменений когда lastEventId отсутствует', () => {
    const state = makeState({
      url: 'http://example.com/stream',
      connection: {
        ...makeState().connection,
        lastEventId: undefined,
      },
    });

    const listenersRef: { listeners?: CapturedListeners; } = {};
    const factory = vi.fn(createTestEventSourceFactory(listenersRef));

    const getState = () => state;
    const dispatch = vi.fn();

    const effect = createSSEEffect(getState, dispatch, factory);
    effect();

    // Factory должен быть вызван с исходным URL без lastEventId
    expect(factory).toHaveBeenCalledWith(
      'http://example.com/stream',
      expect.any(Object),
    );
    // Проверяем, что URL не содержит lastEventId
    const callArgs = factory.mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs![0]).toBe('http://example.com/stream');
    expect(callArgs![0]).not.toContain('lastEventId');
  });

  it('shouldReconnect возвращает false когда autoReconnect отключен', () => {
    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      autoReconnect: false,
      maxRetries: 10,
      clock: () => 1,
      random: () => 0,
    });

    // Диспатчим ERROR - reconnect не должен произойти
    runtime.dispatch({ type: 'ERROR', error: new Error('test') });

    // Проверяем, что состояние CLOSED, но reconnect не запланирован
    const currentState = runtime.getState();
    expect(currentState.connection.connectionState).toBe('CLOSED');
  });

  it('shouldReconnect возвращает false когда достигнут maxRetries', () => {
    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      autoReconnect: true,
      maxRetries: 2,
      clock: () => 1,
      random: () => 0,
    });

    // Симулируем несколько ошибок до достижения maxRetries
    runtime.dispatch({ type: 'ERROR', error: new Error('error1') });
    runtime.dispatch({ type: 'INCREMENT_RETRIES' });
    runtime.dispatch({ type: 'ERROR', error: new Error('error2') });
    runtime.dispatch({ type: 'INCREMENT_RETRIES' });
    runtime.dispatch({ type: 'ERROR', error: new Error('error3') });

    const currentState = runtime.getState();
    expect(currentState.connection.retries).toBeGreaterThanOrEqual(2);
    expect(currentState.connection.connectionState).toBe('CLOSED');
  });

  it('runtime.dispatch обрабатывает TELEMETRY_* и RECONNECT side effects', async () => {
    const telemetry = {
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onReconnect: vi.fn<(attempt: number, delayMs: number) => void>(),
      onMessage: vi.fn<(bytes: number) => void>(),
      onError: vi.fn<(error: unknown) => void>(),
    };
    const logger = {
      ...NO_OP_LOGGER,
      onError: vi.fn(),
    };
    const eventSourceFactory: EventSourceFactory = vi.fn((url: string) => ({
      readyState: 0,
      url,
      withCredentials: true,
      CONNECTING: 0,
      OPEN: 1,
      CLOSED: 2,
      addEventListener: () => {},
      removeEventListener: () => {},
      close: () => {},
      dispatchEvent: () => true,
    })) as EventSourceFactory;

    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      telemetry,
      logger,
      clock: () => 1,
      random: () => 0,
      eventSourceFactory,
      decoder: (frame, clock) => ({
        id: frame.id,
        type: 'topic',
        timestamp: clock(),
        payload: frame.data,
      }),
    });

    const frame: SSEFrame = {
      id: '1',
      event: 'message',
      data: 'data',
      retry: undefined,
    };

    runtime.dispatch({ type: 'CONNECTED', eventSource: {} as EventSourceLike });
    expect(telemetry.onConnect).toHaveBeenCalledTimes(1);

    runtime.dispatch({ type: 'MESSAGE', frame, timestamp: 1 });
    expect(telemetry.onMessage).toHaveBeenCalledWith(frame.data.length);

    const error = new Error('fail');
    runtime.dispatch({ type: 'ERROR', error });
    expect(telemetry.onError).toHaveBeenCalledWith(error);
    expect(logger.onError).toHaveBeenCalledWith(error, runtime.getState().context);

    await vi.advanceTimersByTimeAsync(1100);
    expect(eventSourceFactory).toHaveBeenCalled();

    runtime.dispatch({ type: 'RECONNECT_REQUEST' });
    expect(telemetry.onReconnect).toHaveBeenCalled();

    runtime.stopEffect();
    expect(telemetry.onDisconnect).toHaveBeenCalled();
  });

  it('runtime.startEffect использует переданный effect и регистрирует cleanup', async () => {
    const telemetry = {
      onConnect: vi.fn(),
    };
    const logger = {
      ...NO_OP_LOGGER,
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    };

    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      telemetry,
      logger,
      clock: () => 1,
      random: () => 0,
    });

    const cleanup = vi.fn();
    const effect = () => ({
      resource: {} as EventSourceLike,
      cleanup,
    });

    const resource = runtime.startEffect(effect);
    expect(resource).toBeDefined();

    await vi.runAllTimersAsync();

    expect(telemetry.onConnect).toHaveBeenCalled();

    runtime.stopEffect();
    expect(cleanup).toHaveBeenCalled();
  });

  it('runtime.startEffect без аргументов использует createSSEEffect по умолчанию', () => {
    const eventSourceFactory: EventSourceFactory = vi.fn((url: string) => {
      const es: EventSourceLike = {
        readyState: 0,
        url,
        withCredentials: true,
        CONNECTING: 0,
        OPEN: 1,
        CLOSED: 2,
        addEventListener: () => {},
        removeEventListener: () => {},
        close: () => {},
        dispatchEvent: () => true,
      };
      return es;
    }) as EventSourceFactory;

    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      eventSourceFactory,
      clock: () => 1,
      random: () => 0,
    });

    // @ts-expect-error — проверяем fallback когда effect не передан
    const resource = runtime.startEffect();
    expect(resource).toBeDefined();
    expect(eventSourceFactory).toHaveBeenCalledWith(
      'http://example.com/stream',
      expect.objectContaining({ withCredentials: true }),
    );
  });

  it('createSSEEffect вызывает openHandler при событии open и запускает heartbeat', async () => {
    vi.useFakeTimers();
    const dispatched: SSEInternalEvent[] = [];
    const state = makeState({
      clock: () => 100,
      subscriptions: {
        ...makeState().subscriptions,
        maxListenersPerChannel: 1000,
      },
    });

    const listenersRef: { listeners?: CapturedListeners; } = {};
    const factory = createTestEventSourceFactory(listenersRef);

    const getState = () => state;
    const dispatch = (e: SSEInternalEvent) => {
      dispatched.push(e);
    };

    const effect = createSSEEffect(getState, dispatch, factory);
    const { cleanup } = effect();

    // Вызываем open handler
    expect(listenersRef.listeners).toBeDefined();
    const openHandler = listenersRef.listeners?.open[0];
    expect(openHandler).toBeDefined();
    openHandler!({} as MessageEvent);

    // Проверяем, что диспатчится OPEN
    expect(dispatched.some((e) => e.type === 'OPEN' && e.timestamp === 100)).toBe(true);

    // Проверяем, что диспатчится SET_HEARTBEAT_CLEANUP (heartbeat запущен)
    await vi.advanceTimersByTimeAsync(100);
    expect(dispatched.some((e) => e.type === 'SET_HEARTBEAT_CLEANUP')).toBe(true);

    cleanup();
    vi.useRealTimers();
  });

  it('parseSSEFrame отбрасывает фреймы превышающие maxFrameSize', () => {
    const dispatched: SSEInternalEvent[] = [];
    const state = makeState({
      subscriptions: {
        ...makeState().subscriptions,
        maxListenersPerChannel: 10, // Маленький лимит для теста
      },
    });

    const listenersRef: { listeners?: CapturedListeners; } = {};
    const factory = createTestEventSourceFactory(listenersRef);

    const getState = () => state;
    const dispatch = (e: SSEInternalEvent) => {
      dispatched.push(e);
    };

    const effect = createSSEEffect(getState, dispatch, factory);
    const { cleanup } = effect();

    // Сообщение с размером больше maxFrameSize должно быть отброшено
    expect(listenersRef.listeners).toBeDefined();
    const messageHandler = listenersRef.listeners?.message[0];
    expect(messageHandler).toBeDefined();
    // eslint-disable-next-line ai-security/model-poisoning -- синтетический payload только для теста размерного ограничения фрейма
    const largeData = 'x'.repeat(20); // Больше чем maxListenersPerChannel (10)
    const msgEvent = { data: largeData, type: 'message' } as unknown as MessageEvent;
    messageHandler!(msgEvent);

    // MESSAGE не должен быть диспатчен
    expect(dispatched.filter((e) => e.type === 'MESSAGE')).toHaveLength(0);

    cleanup();
  });

  it('parseSSEFrame обрабатывает event.type !== message и lastEventId', () => {
    const dispatched: SSEInternalEvent[] = [];
    const state = makeState({
      subscriptions: {
        ...makeState().subscriptions,
        maxListenersPerChannel: 1000,
      },
    });

    const listenersRef: { listeners?: CapturedListeners; } = {};
    const factory = createTestEventSourceFactory(listenersRef);

    const getState = () => state;
    const dispatch = (e: SSEInternalEvent) => {
      dispatched.push(e);
    };

    const effect = createSSEEffect(getState, dispatch, factory);
    const { cleanup } = effect();

    expect(listenersRef.listeners).toBeDefined();
    const messageHandler = listenersRef.listeners?.message[0];
    expect(messageHandler).toBeDefined();
    // Сообщение с кастомным типом и lastEventId
    const msgEvent = {
      data: '{"foo":"bar"}',
      type: 'custom-event',
      lastEventId: 'event-id-123',
    } as unknown as MessageEvent;
    messageHandler!(msgEvent);

    // MESSAGE должен быть диспатчен
    const messageEvents = dispatched.filter((e) => e.type === 'MESSAGE');
    expect(messageEvents.length).toBeGreaterThan(0);
    if (messageEvents[0] && 'frame' in messageEvents[0]) {
      expect(messageEvents[0].frame.id).toBe('event-id-123');
      expect(messageEvents[0].frame.event).toBe('custom-event');
    }

    cleanup();
  });

  it('parseRetryFromData обрабатывает различные форматы retry', () => {
    const dispatched: SSEInternalEvent[] = [];
    const state = makeState({
      subscriptions: {
        ...makeState().subscriptions,
        maxListenersPerChannel: 1000,
      },
    });

    const listenersRef: { listeners?: CapturedListeners; } = {};
    const factory = createTestEventSourceFactory(listenersRef);

    const getState = () => state;
    const dispatch = (e: SSEInternalEvent) => {
      dispatched.push(e);
    };

    const effect = createSSEEffect(getState, dispatch, factory);
    const { cleanup } = effect();

    expect(listenersRef.listeners).toBeDefined();
    const messageHandler = listenersRef.listeners?.message[0];
    expect(messageHandler).toBeDefined();

    // Валидный retry
    const msgEvent1 = {
      data: 'retry: 5000\n{"foo":"bar"}',
      type: 'message',
    } as unknown as MessageEvent;
    messageHandler!(msgEvent1);

    // Невалидный retry (NaN)
    const msgEvent2 = {
      data: 'retry: invalid\n{"foo":"bar"}',
      type: 'message',
    } as unknown as MessageEvent;
    messageHandler!(msgEvent2);

    // Retry с нулевым значением
    const msgEvent3 = {
      data: 'retry: 0\n{"foo":"bar"}',
      type: 'message',
    } as unknown as MessageEvent;
    messageHandler!(msgEvent3);

    // Без retry
    const msgEvent4 = {
      data: '{"foo":"bar"}',
      type: 'message',
    } as unknown as MessageEvent;
    messageHandler!(msgEvent4);

    // Все сообщения должны быть обработаны
    expect(dispatched.filter((e) => e.type === 'MESSAGE').length).toBe(4);

    cleanup();
  });

  it('buildSSEUrl обрабатывает некорректный URL через fallback', () => {
    const state = makeState({
      url: 'invalid-url-without-protocol',
      connection: {
        ...makeState().connection,
        lastEventId: 'test-id',
      },
      subscriptions: {
        ...makeState().subscriptions,
        maxListenersPerChannel: 1000,
      },
    });

    const factory: EventSourceFactory = vi.fn((url: string) => {
      // Проверяем, что URL содержит lastEventId даже при некорректном базовом URL
      expect(url).toContain('lastEventId=test-id');
      const es: EventSourceLike = {
        readyState: 0,
        url,
        withCredentials: true,
        CONNECTING: 0,
        OPEN: 1,
        CLOSED: 2,
        addEventListener: () => {},
        removeEventListener: () => {},
        close: () => {},
        dispatchEvent: () => true,
      };
      return es;
    }) as EventSourceFactory;

    const getState = () => state;
    const dispatch = vi.fn();

    const effect = createSSEEffect(getState, dispatch, factory);
    effect();

    // Factory должен быть вызван с URL содержащим lastEventId
    expect(factory).toHaveBeenCalled();
  });

  it('safeInvokeListener вызывает logger.onError когда listener бросает ошибку', () => {
    const logger = {
      ...NO_OP_LOGGER,
      onError: vi.fn(),
    };
    const throwingListener = vi.fn(() => {
      throw new Error('listener error');
    });

    // safeInvokeListener не экспортирован, но вызывается через runtime.subscribe
    const runtime = createSSERuntime<string>({
      url: 'http://example.com/stream',
      logger,
      clock: () => 100,
      random: () => 0,
    });

    runtime.subscribe('test-type', throwingListener);

    // Диспатчим MESSAGE, который вызовет listener через safeInvokeListener
    const frame: SSEFrame = {
      id: 'test-id',
      event: 'test-type',
      data: JSON.stringify({ payload: {} }),
      retry: undefined,
    };
    runtime.dispatch({ type: 'MESSAGE', frame, timestamp: 100 });

    // logger.onError должен быть вызван (строка 459)
    expect(logger.onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'SSE listener' }),
    );
  });
});

describe('sse-client.ts — defaultEventSourceFactory edge cases', () => {
  it('defaultEventSourceFactory бросает ошибку когда EventSource недоступен', () => {
    // Сохраняем оригинальный EventSource
    const originalEventSource = globalThis.EventSource;
    // @ts-expect-error — временно удаляем EventSource для теста
    delete globalThis.EventSource;

    try {
      const runtime = createSSERuntime<string>({
        url: 'http://example.com/stream',
        clock: () => 1,
        random: () => 0,
        // Не передаём eventSourceFactory, чтобы использовался defaultEventSourceFactory
      });

      // @ts-expect-error — проверяем fallback когда effect не передан
      expect(() => runtime.startEffect()).toThrow(
        'EventSource is not available. In Node.js, provide a custom eventSourceFactory in SSEClientConfig.',
      );
    } finally {
      // Восстанавливаем EventSource
      globalThis.EventSource = originalEventSource;
    }
  });
});

describe('sse-client.ts — NO_OP_LOGGER', () => {
  it('NO_OP_LOGGER методы не бросают ошибок', () => {
    expect(() => {
      NO_OP_LOGGER.onStart?.();
      NO_OP_LOGGER.onSuccess?.(0);
      NO_OP_LOGGER.onError?.(new Error('x'));
    }).not.toThrow();
  });
});

/* eslint-enable functional/no-let, fp/no-mutation */
