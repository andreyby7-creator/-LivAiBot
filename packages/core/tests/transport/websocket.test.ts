/* eslint-disable fp/no-mutation */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Мокаем sleep из effect-слоя, чтобы:
// - не ждать реальные таймеры в тестах reconnect
// - уметь проверять рассчитанный backoff delay
const sleepMock = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>();

vi.mock('@livai/core/effect', async () => {
  const actual = await vi.importActual<typeof import('@livai/core/effect')>(
    '@livai/core/effect',
  );

  return {
    ...actual,
    // sleep делегирует в наш sleepMock, по умолчанию резолвится сразу
    sleep: (ms: number, signal?: AbortSignal): Promise<void> => sleepMock(ms, signal),
  };
});

import type { EffectContext, EffectLogger } from '../../src/effect/effect-utils.js';
import { createEffectAbortController } from '../../src/effect/effect-utils.js';
import type {
  WebSocketClientConfig,
  WebSocketClientState,
  WebSocketEvent,
  WebSocketLike,
} from '../../src/transport/websocket.js';
import {
  attachWebSocketInstance,
  closeWebSocketEffect,
  connectWebSocket,
  createInitialWebSocketState,
  createWebSocketEffect,
  handleWebSocketClose,
  handleWebSocketOpen,
  offWebSocketMessage,
  onWebSocketMessage,
  sendWebSocketMessageEffect,
} from '../../src/transport/websocket.js';

type TestState<T = unknown> = WebSocketClientState<T>;

interface CapturedWebSocketListeners {
  open: ((e: Event) => void)[];
  message: ((e: MessageEvent) => void)[];
  close: ((e: CloseEvent) => void)[];
  error: ((e: Event) => void)[];
}

function createTestWebSocketFactory(
  listenersRef: { listeners?: CapturedWebSocketListeners; },
  onClose?: () => void,
): (url: string) => WebSocketLike {
  return (url: string): WebSocketLike => {
    const listeners: CapturedWebSocketListeners = {
      open: [],
      message: [],
      close: [],
      error: [],
    };
    listenersRef.listeners = listeners;

    const ws: WebSocketLike = {
      readyState: 0,
      url,
      protocol: '',
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      addEventListener: (type, listener): void => {
        if (type === 'open') {
          listeners.open.push(listener as (e: Event) => void);
        } else if (type === 'message') {
          listeners.message.push(listener as (e: MessageEvent) => void);
        } else if (type === 'close') {
          listeners.close.push(listener as (e: CloseEvent) => void);
        } else {
          // type === 'error'
          listeners.error.push(listener as (e: Event) => void);
        }
      },
      removeEventListener: () => {
        // no-op для тестов
      },
      send: vi.fn(),
      close: vi.fn(() => {
        onClose?.();
        listeners.close.forEach((handler) => handler({} as CloseEvent));
      }),
    };

    return ws;
  };
}

function makeState<T = unknown>(
  overrides: Partial<TestState<T>> = {},
  configOverrides: Partial<WebSocketClientConfig> = {},
): TestState<T> {
  const base = createInitialWebSocketState<T>({
    url: 'ws://example.com/socket',
    ...configOverrides,
  });

  return {
    ...base,
    ...overrides,
    listeners: overrides.listeners ?? base.listeners,
  };
}

function createStubWebSocket(url: string): WebSocketLike {
  return {
    readyState: 0,
    url,
    protocol: '',
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    addEventListener: () => {},
    removeEventListener: () => {},
    send: vi.fn(),
    close: vi.fn(),
  };
}

beforeEach(() => {
  sleepMock.mockImplementation(async () => Promise.resolve());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('websocket.ts — initial state and config', () => {
  it('createInitialWebSocketState задаёт корректные дефолты и использует DI clock/factory', () => {
    const clock = vi.fn(() => 123);
    const factory = vi.fn((url: string) => createStubWebSocket(url));

    const state = createInitialWebSocketState({
      url: 'ws://example.com/ws',
      clock,
      webSocketFactory: factory,
    });

    expect(state.url).toBe('ws://example.com/ws');
    expect(state.connectionState).toBe('CLOSED');
    expect(state.autoReconnect).toBe(true);
    expect(state.maxRetries).toBeGreaterThan(0);
    expect(state.retryDelayMs).toBe(1000);
    expect(state.retryBackoffFactor).toBe(2);
    expect(state.retries).toBe(0);
    expect(state.listeners.size).toBe(0);
    expect(state.clock()).toBe(123);

    const [nextState, effect] = connectWebSocket(state, () => {});
    expect(nextState.connectionState).toBe('CONNECTING');
    const ws = effect();
    expect(ws.url).toBe('ws://example.com/ws');
    expect(factory).toHaveBeenCalledWith('ws://example.com/ws');
  });

  it('createInitialWebSocketState пробрасывает все опциональные поля конфига', () => {
    const abortController = createEffectAbortController();
    const context: EffectContext = { source: 'test-websocket' };
    const logger: EffectLogger = {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    };

    const state = createInitialWebSocketState({
      url: 'ws://example.com/custom',
      autoReconnect: false,
      maxRetries: 10,
      retryDelayMs: 500,
      retryBackoffFactor: 3,
      abortController,
      context,
      logger,
    });

    expect(state.autoReconnect).toBe(false);
    expect(state.maxRetries).toBe(10);
    expect(state.retryDelayMs).toBe(500);
    expect(state.retryBackoffFactor).toBe(3);
    expect(state.abortController).toBe(abortController);
    expect(state.context).toBe(context);
    expect(state.logger).toBe(logger);
  });

  it('createInitialWebSocketState использует fallback clock когда clock не передан (покрывает строку 207)', () => {
    const state = createInitialWebSocketState({
      url: 'ws://example.com/no-clock',
    });

    // Проверяем, что clock функция существует и возвращает число
    const timestamp = state.clock();
    expect(typeof timestamp).toBe('number');
    expect(timestamp).toBeGreaterThan(0);
    // Проверяем, что это Date.now() (примерно текущее время)
    const now = Date.now();
    expect(Math.abs(timestamp - now)).toBeLessThan(1000);
  });
});

describe('websocket.ts — WebSocket adapter (createWebSocketEffect)', () => {
  it('createWebSocketEffect пробрасывает события и context в handlers', async () => {
    const open = vi.fn();
    const message = vi.fn();
    const close = vi.fn<(context?: EffectContext) => void | Promise<void>>();
    const error = vi.fn();
    const handlers = { open, message, close, error };
    const context: EffectContext = { source: 'websocket-adapter' };

    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);

    const effect = createWebSocketEffect(
      'ws://example.com/adapter',
      handlers,
      context,
      factory,
    );
    const ws = effect();
    expect(ws.url).toBe('ws://example.com/adapter');

    const listeners = listenersRef.listeners;
    expect(listeners).toBeDefined();

    listeners?.open[0]!({} as Event);
    expect(open).toHaveBeenCalledWith(context);

    const msgEvent = { data: 'payload' } as unknown as MessageEvent;
    listeners?.message[0]!(msgEvent);
    expect(message).toHaveBeenCalledWith(msgEvent, context);

    listeners?.close[0]!({} as CloseEvent);
    await Promise.resolve();
    expect(close).toHaveBeenCalledWith(context);

    const errorEvent = new Event('error');
    listeners?.error[0]!(errorEvent);
    expect(error).toHaveBeenCalledWith(errorEvent, context);
  });

  it('createWebSocketEffect не вешает error-listener если handler.error отсутствует', () => {
    const handlers = {
      open: vi.fn(),
      message: vi.fn(),
      close: vi.fn(),
    };
    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);

    const effect = createWebSocketEffect(
      'ws://example.com/no-error',
      handlers,
      undefined,
      factory,
    );
    effect();

    expect(listenersRef.listeners).toBeDefined();
    expect(listenersRef.listeners?.error.length).toBe(0);
  });

  it('defaultWebSocketFactory бросает ошибку, если глобальный WebSocket недоступен', () => {
    const originalWebSocket = (globalThis as unknown as { WebSocket?: unknown; }).WebSocket;
    delete (globalThis as unknown as { WebSocket?: unknown; }).WebSocket;

    try {
      const effect = createWebSocketEffect(
        'ws://example.com/default-factory',
        {
          open: () => {},
          message: () => {},
          close: () => {},
        },
        undefined,
      );

      expect(() => effect()).toThrow(
        'WebSocket is not available. In Node.js, provide a custom webSocketFactory in WebSocketClientConfig.',
      );
    } finally {
      (globalThis as unknown as { WebSocket?: unknown; }).WebSocket = originalWebSocket;
    }
  });

  it('defaultWebSocketFactory создает WebSocket когда он доступен (покрывает строку 192)', () => {
    const originalWebSocket = (globalThis as unknown as { WebSocket?: unknown; }).WebSocket;
    // Создаем функцию-конструктор для мокирования WebSocket
    function mockWebSocket(url: string, protocols?: string | string[]): WebSocketLike {
      // Сохраняем аргументы для проверки (не используется, но покрывает строку 192)
      void protocols;
      return {
        readyState: 0,
        url,
        protocol: '',
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      };
    }

    (globalThis as unknown as { WebSocket: typeof mockWebSocket; }).WebSocket = mockWebSocket;

    try {
      const effect = createWebSocketEffect(
        'ws://example.com/test',
        {
          open: () => {},
          message: () => {},
          close: () => {},
        },
        undefined,
      );

      const ws = effect();
      expect(ws).toBeDefined();
      expect(ws.url).toBe('ws://example.com/test');
      // Проверяем, что WebSocket был создан через MockWebSocket
      expect(ws).toHaveProperty('url', 'ws://example.com/test');
    } finally {
      (globalThis as unknown as { WebSocket?: unknown; }).WebSocket = originalWebSocket;
    }
  });

  it('createWebSocketEffect обрабатывает отклоненный Promise из close handler (покрывает строку 329)', async () => {
    const close = vi.fn(async (): Promise<void> => {
      throw new Error('close error');
    });
    const handlers = {
      open: vi.fn(),
      message: vi.fn(),
      close,
    };
    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);

    // Обрабатываем unhandled rejection, чтобы проверить, что ошибка обрабатывается внутри кода
    const unhandledRejections: unknown[] = [];
    const handler = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', handler);

    try {
      const effect = createWebSocketEffect(
        'ws://example.com/close-promise',
        handlers,
        undefined,
        factory,
      );
      effect();

      const listeners = listenersRef.listeners;
      expect(listeners).toBeDefined();

      // Вызываем close handler, который возвращает отклоненный Promise
      listeners?.close[0]!({} as CloseEvent);
      // Ждем обработки Promise через catch в коде
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(close).toHaveBeenCalled();
      // Проверяем, что ошибка была обработана внутри кода (не упала в unhandled rejection)
      expect(unhandledRejections).toHaveLength(0);
    } finally {
      process.removeListener('unhandledRejection', handler);
    }
  });
});

describe('websocket.ts — connectWebSocket и обработка сообщений', () => {
  it('connectWebSocket возвращает состояние CONNECTING и effect + attachAbortController', () => {
    const abortController = createEffectAbortController();

    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);

    const state = makeState({
      abortController,
      webSocketFactory: factory,
    });

    const onMessage = vi.fn();
    const [newState, wsEffect, attachAbort] = connectWebSocket(state, onMessage);

    expect(newState.connectionState).toBe('CONNECTING');

    const ws = wsEffect();
    expect(listenersRef.listeners).toBeDefined();

    attachAbort(ws);
    abortController.abort();
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it('connectWebSocket создаёт no-op attachAbortController если abortController не задан', () => {
    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);
    const state = makeState({
      abortController: undefined,
      webSocketFactory: factory,
    });

    const [, wsEffect, attachAbort] = connectWebSocket(state, () => {});
    const ws = wsEffect();

    expect(() => attachAbort(ws)).not.toThrow();
  });

  it('message handler отбрасывает non-string, oversized, невалидный и некорректно структурированный payload', () => {
    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);
    const state = makeState({
      webSocketFactory: factory,
    });

    const onMessage = vi.fn();
    const [, wsEffect] = connectWebSocket(state, onMessage);
    wsEffect();

    const messageHandler = listenersRef.listeners?.message[0];
    expect(messageHandler).toBeDefined();

    // non-string payload
    messageHandler!({ data: 123 } as unknown as MessageEvent);

    // слишком большой payload (MAX_WS_MESSAGE_SIZE = 1_000_000)
    const large = 'x'.repeat(1_000_001);
    messageHandler!({ data: large } as unknown as MessageEvent);

    // невалидный JSON
    messageHandler!({ data: 'not-json' } as unknown as MessageEvent);

    // корректный JSON, но без поля type
    messageHandler!({
      data: JSON.stringify({ foo: 'bar' }),
    } as unknown as MessageEvent);

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('message handler парсит корректное WebSocketEvent и вызывает onMessage', () => {
    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);
    const state = makeState<WebSocketEvent<string>>({
      webSocketFactory: factory,
    });

    const onMessage = vi.fn();
    const [, wsEffect] = connectWebSocket(state, onMessage);
    wsEffect();

    const messageHandler = listenersRef.listeners?.message[0];
    expect(messageHandler).toBeDefined();

    const event: WebSocketEvent<{ foo: number; }> = {
      type: 'test-event',
      timestamp: 42,
      payload: { foo: 1 },
    };

    const msgEvent = {
      data: JSON.stringify(event),
    } as unknown as MessageEvent;

    messageHandler!(msgEvent);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'test-event',
        timestamp: 42,
        payload: { foo: 1 },
      }),
    );
  });
});

describe('websocket.ts — handleWebSocketClose (reconnect FSM)', () => {
  it('handleWebSocketClose без autoReconnect просто помечает CLOSED и не создаёт effect', () => {
    const state = makeState({
      autoReconnect: false,
      connectionState: 'OPEN',
      retries: 3,
    });

    const [newState, effect] = handleWebSocketClose(state);
    expect(newState.connectionState).toBe('CLOSED');
    expect(newState.retries).toBe(3);
    expect(effect).toBeNull();
  });

  it('handleWebSocketClose при достижении maxRetries не планирует reconnect', () => {
    const state = makeState({
      autoReconnect: true,
      maxRetries: 2,
      retries: 2,
    });

    const [newState, effect] = handleWebSocketClose(state);
    expect(newState.connectionState).toBe('CLOSED');
    expect(newState.retries).toBe(2);
    expect(effect).toBeNull();
  });

  it('handleWebSocketClose планирует reconnect с exponential backoff и доставкой сообщений подписчикам', async () => {
    const listener = vi.fn<(e: WebSocketEvent<string>) => void>();
    const abortController = createEffectAbortController();

    const listenersSet = new Set<(e: WebSocketEvent<string>) => void>([listener]);
    const listenersRef: { listeners?: CapturedWebSocketListeners; } = {};
    const factory = createTestWebSocketFactory(listenersRef);

    const state = makeState<string>(
      {
        autoReconnect: true,
        maxRetries: 5,
        retryDelayMs: 1000,
        retryBackoffFactor: 2,
        retries: 1,
        abortController,
        listeners: listenersSet,
        webSocketFactory: factory,
      },
    );

    const [reconnectState, effect] = handleWebSocketClose(state);
    expect(reconnectState.connectionState).toBe('CONNECTING');
    expect(reconnectState.retries).toBe(2);
    expect(effect).not.toBeNull();

    sleepMock.mockClear();
    await effect!();

    expect(sleepMock).toHaveBeenCalledWith(2000, abortController.signal);

    const messageHandler = listenersRef.listeners?.message[0];
    expect(messageHandler).toBeDefined();

    const event: WebSocketEvent<string> = {
      type: 'reconnect-event',
      timestamp: 1,
      payload: 'payload',
    };

    const msgEvent = {
      data: JSON.stringify(event),
    } as unknown as MessageEvent;

    messageHandler!(msgEvent);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reconnect-event',
        payload: 'payload',
      }),
    );
  });

  it('handleWebSocketClose ограничивает backoff MAX_RETRY_DELAY_MS и логирует ошибки эффекта', async () => {
    const logger: EffectLogger = {
      onError: vi.fn(),
    };

    const state = makeState({
      autoReconnect: true,
      maxRetries: 10,
      retryDelayMs: 10_000,
      retryBackoffFactor: 10,
      retries: 2,
      logger,
    });

    const [, effect] = handleWebSocketClose(state);
    expect(effect).not.toBeNull();

    const sleepError = new Error('sleep failed');
    sleepMock.mockImplementationOnce(() => Promise.reject(sleepError));

    await effect!();

    expect(sleepMock).toHaveBeenCalledWith(30_000, state.abortController?.signal);
    expect(logger.onError).toHaveBeenCalledWith(
      sleepError,
      state.context,
    );
  });
});

describe('websocket.ts — простые переходы состояния', () => {
  it('handleWebSocketOpen переводит состояние в OPEN и сбрасывает retries', () => {
    const state = makeState({
      connectionState: 'CONNECTING',
      retries: 5,
    });

    const newState = handleWebSocketOpen(state);
    expect(newState.connectionState).toBe('OPEN');
    expect(newState.retries).toBe(0);
  });

  it('attachWebSocketInstance привязывает ws и помечает состояние CONNECTING', () => {
    const baseState = makeState({
      connectionState: 'CLOSED',
      ws: undefined,
    });
    const ws = createStubWebSocket('ws://example.com/attach');

    const newState = attachWebSocketInstance(baseState, ws);
    expect(newState.ws).toBe(ws);
    expect(newState.connectionState).toBe('CONNECTING');
  });
});

describe('websocket.ts — эффекты close/send', () => {
  it('closeWebSocketEffect закрывает соединение и очищает ws без logger', () => {
    const ws = createStubWebSocket('ws://example.com/close');
    const state = makeState({
      ws,
    });

    const newState = closeWebSocketEffect(state, 1000, 'bye');
    expect(ws.close).toHaveBeenCalledWith(1000, 'bye');
    expect(newState.ws).toBeUndefined();
    expect(newState.connectionState).toBe('CLOSED');
  });

  it('closeWebSocketEffect использует withLogging когда logger задан', async () => {
    const ws = createStubWebSocket('ws://example.com/close-logged');
    const logger: EffectLogger = {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    };
    const context: EffectContext = { source: 'close-effect' };

    const state = makeState({
      ws,
      logger,
      context,
    });

    const newState = closeWebSocketEffect(state, 4000, 'reason');
    // Ждем завершения асинхронного эффекта с логированием
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(ws.close).toHaveBeenCalledWith(4000, 'reason');
    expect(newState.ws).toBeUndefined();
    expect(logger.onStart).toHaveBeenCalledWith(context);
    expect(logger.onSuccess).toHaveBeenCalledTimes(1);
    expect(logger.onError).not.toHaveBeenCalled();
  });

  it('sendWebSocketMessageEffect бросает EffectError если WebSocket не открыт', () => {
    const ws = createStubWebSocket('ws://example.com/not-open');
    // Помечаем ws как CLOSED
    (ws as { readyState: number; }).readyState = ws.CLOSED;

    const state = makeState({
      ws,
    });

    const event: WebSocketEvent<string> = {
      type: 'type',
      timestamp: 1,
      payload: 'payload',
    };

    expect(() => sendWebSocketMessageEffect(state, event)).toThrowError(
      /WebSocket is not open/,
    );
  });

  it('sendWebSocketMessageEffect отправляет JSON payload когда WebSocket открыт', () => {
    const ws = createStubWebSocket('ws://example.com/send');
    (ws as { readyState: number; }).readyState = ws.OPEN;

    const state = makeState({
      ws,
    });

    const event: WebSocketEvent<{ a: number; }> = {
      type: 'topic',
      timestamp: 10,
      payload: { a: 1 },
    };

    const result = sendWebSocketMessageEffect(state, event);
    expect(result).toBe(state);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(event));
  });

  it('sendWebSocketMessageEffect интегрируется с logger через withLogging и логирует ошибку при сбое send', async () => {
    const ws = createStubWebSocket('ws://example.com/send-logged');
    (ws as { readyState: number; }).readyState = ws.OPEN;
    (ws.send as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('boom');
    });

    const logger: EffectLogger = {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    };

    const state = makeState({
      ws,
      logger,
    });

    const event: WebSocketEvent<string> = {
      type: 'type',
      timestamp: 1,
      payload: 'p',
    };

    // Обрабатываем unhandled rejection, так как эффект бросает ошибку асинхронно
    const unhandledRejections: unknown[] = [];
    const handler = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', handler);

    try {
      sendWebSocketMessageEffect(state, event);
      // Ждем завершения асинхронного эффекта с логированием и обработкой ошибки
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.onStart).toHaveBeenCalled();
      expect(logger.onError).toHaveBeenCalledTimes(1);
      expect(logger.onSuccess).not.toHaveBeenCalled();
      // Проверяем, что ошибка была логирована через logger
      expect(logger.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'Network',
          message: expect.stringContaining('Failed to send WebSocket message'),
        }),
        undefined,
        undefined,
      );
    } finally {
      process.removeListener('unhandledRejection', handler);
    }
  });

  it('sendWebSocketMessageEffect обрабатывает не-Error исключения через String(error) (покрывает строку 543)', async () => {
    const ws = createStubWebSocket('ws://example.com/send-non-error');
    (ws as { readyState: number; }).readyState = ws.OPEN;
    // Бросаем строку вместо Error объекта
    (ws.send as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw 'string error';
    });

    const logger: EffectLogger = {
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    };

    const state = makeState({
      ws,
      logger,
    });

    const event: WebSocketEvent<string> = {
      type: 'type',
      timestamp: 1,
      payload: 'p',
    };

    // Обрабатываем unhandled rejection, так как эффект бросает ошибку асинхронно
    const unhandledRejections: unknown[] = [];
    const handler = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', handler);

    try {
      sendWebSocketMessageEffect(state, event);
      // Ждем завершения асинхронного эффекта с логированием и обработкой ошибки
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(logger.onStart).toHaveBeenCalled();
      expect(logger.onError).toHaveBeenCalledTimes(1);
      expect(logger.onSuccess).not.toHaveBeenCalled();
      // Проверяем, что ошибка была обработана через String(error) - строка 543
      expect(logger.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'Network',
          message: expect.stringContaining('Failed to send WebSocket message: string error'),
        }),
        undefined,
        undefined,
      );
      // withLogging логирует ошибку, но все равно пробрасывает ее дальше (это нормальное поведение)
      // Главное - проверить, что String(error) был вызван для не-Error объекта
    } finally {
      process.removeListener('unhandledRejection', handler);
    }
  });
});

describe('websocket.ts — подписка/отписка на сообщения', () => {
  it('onWebSocketMessage регистрирует listener, offWebSocketMessage снимает его', () => {
    const state = makeState();
    const listener = vi.fn<(e: WebSocketEvent<unknown>) => void>();

    const withListener = onWebSocketMessage(state, listener);
    expect(withListener.listeners.has(listener)).toBe(true);

    const withoutListener = offWebSocketMessage(withListener, listener);
    expect(withoutListener.listeners.has(listener)).toBe(false);
  });
});

/* eslint-enable fp/no-mutation */
