/**
 * @file packages/app/src/lib/websocket.ts
 * ============================================================================
 * 🌐 WEBSOCKET CLIENT — ЧИСТАЯ FUNCTIONAL STATE MACHINE
 * ============================================================================
 * Полностью функциональная, immutable и детерминированная реализация
 * WebSocket-клиента для всех платформ (web / pwa / mobile / admin).
 * ❗ Никаких классов
 * ❗ Никаких мутаций
 * ❗ Никакого внутреннего this-state
 * Только:
 * - Pure state
 * - Pure transitions
 * - Referential transparency
 * Совместимо с:
 * - functional/immutable-data
 * - effect-utils
 * - retry / reconnect / tracing
 */

import { sleep, withLogging } from './effect-utils.js';
import type {
  EffectAbortController,
  EffectContext,
  EffectError,
  EffectLogger,
} from './effect-utils.js';
import { infoFireAndForget, logFireAndForget } from './telemetry-runtime.js';
// ApiError используется только для HTTP API, WebSocket использует EffectError

/* ============================================================================
* 🧠 БАЗОВЫЕ ТИПЫ
* ========================================================================== */

/** Состояние соединения WebSocket. */
export type WebSocketConnectionState =
  | 'CONNECTING'
  | 'OPEN'
  | 'CLOSED';

/** Типизированное событие WebSocket. */
export type WebSocketEvent<TPayload = unknown> = {
  readonly type: string;
  readonly timestamp: number;
  readonly payload: TPayload;
};

/** Immutable состояние клиента. */
export type WebSocketClientState<TMessage = unknown> = {
  readonly url: string;
  readonly ws: WebSocket | undefined;
  readonly connectionState: WebSocketConnectionState;

  readonly autoReconnect: boolean;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly retryBackoffFactor: number;
  readonly retries: number;

  readonly listeners: ReadonlySet<
    (event: WebSocketEvent<TMessage>) => void
  >;

  readonly abortController: EffectAbortController | undefined;
  readonly context: EffectContext | undefined;
};

/** Конфигурация клиента. */
export type WebSocketClientConfig = {
  readonly url: string;
  readonly autoReconnect?: boolean;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly retryBackoffFactor?: number;
  readonly abortController?: EffectAbortController;
  readonly context?: EffectContext;
};

/** Константы конфигурации. */
const DEFAULT_MAX_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 30000; // Максимальный delay 30 секунд

/* ============================================================================
* 🧱 INITIAL STATE
* ========================================================================== */

/** Создает начальное immutable состояние клиента. */
export function createInitialWebSocketState<TMessage>(
  config: WebSocketClientConfig,
): WebSocketClientState<TMessage> {
  return {
    url: config.url,
    ws: undefined,
    connectionState: 'CLOSED',

    autoReconnect: config.autoReconnect ?? true,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryDelayMs: config.retryDelayMs ?? 1000,
    retryBackoffFactor: config.retryBackoffFactor ?? 2,
    retries: 0,

    listeners: Object.freeze(new Set()) as ReadonlySet<(event: WebSocketEvent<TMessage>) => void>,
    abortController: config.abortController,
    context: config.context,
  };
}

/** Создает логгер для WebSocket эффектов. */
export function createWebSocketLogger(operation: string): EffectLogger {
  return {
    onStart: (context?: EffectContext): void => {
      infoFireAndForget(`WebSocket ${operation} started`, {
        operation,
        source: context?.source ?? 'WebSocket',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
    onSuccess: (durationMs: number, context?: EffectContext): void => {
      logFireAndForget('INFO', `WebSocket ${operation} completed`, {
        operation,
        durationMs,
        source: context?.source ?? 'WebSocket',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
    onError: (error: unknown, context?: EffectContext): void => {
      logFireAndForget('WARN', `WebSocket ${operation} failed`, {
        operation,
        error: error instanceof Error ? error.message : String(error),
        source: context?.source ?? 'WebSocket',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
  };
}

/* ============================================================================
* 🔧 PURE STATE TRANSITIONS
* ========================================================================== */

function setConnectionState<T>(
  state: WebSocketClientState<T>,
  connectionState: WebSocketConnectionState,
): WebSocketClientState<T> {
  return {
    ...state,
    connectionState,
  };
}

function incrementRetries<T>(
  state: WebSocketClientState<T>,
): WebSocketClientState<T> {
  return {
    ...state,
    retries: state.retries + 1,
  };
}

function resetRetries<T>(
  state: WebSocketClientState<T>,
): WebSocketClientState<T> {
  return {
    ...state,
    retries: 0,
  };
}

function setWebSocket<T>(
  state: WebSocketClientState<T>,
  ws?: WebSocket,
): WebSocketClientState<T> {
  return {
    ...state,
    ws,
    connectionState: ws ? 'CONNECTING' : 'CLOSED',
  };
}

function addListener<T>(
  state: WebSocketClientState<T>,
  listener: (e: WebSocketEvent<T>) => void,
): WebSocketClientState<T> {
  return {
    ...state,
    listeners: new Set([...state.listeners, listener]),
  };
}

function removeListener<T>(
  state: WebSocketClientState<T>,
  listener: (e: WebSocketEvent<T>) => void,
): WebSocketClientState<T> {
  return {
    ...state,
    listeners: new Set(
      [...state.listeners].filter((l) => l !== listener),
    ),
  };
}

/* ============================================================================
* 🔌 WEBSOCKET ADAPTER (SIDE EFFECTS)
* ========================================================================== */

/** Handlers для WebSocket событий. Readonly для функциональной чистоты. */
export type WebSocketHandlers = Readonly<{
  open: () => void;
  message: (event: MessageEvent) => void;
  close: () => Promise<void> | void;
  error?: (event: Event) => void;
}>;

/** Расширенные handlers с поддержкой tracing/observability. */
export type WebSocketHandlersWithTracing = Readonly<{
  open: (context?: EffectContext) => void;
  message: (event: MessageEvent, context?: EffectContext) => void;
  close: (context?: EffectContext) => Promise<void> | void;
  error?: (event: Event, context?: EffectContext) => void;
}>;

/** Effect который создает и инициализирует WebSocket. Возвращает функцию, которая при вызове выполняет side effect. */
export type WebSocketEffect = () => WebSocket;

/** Создает Effect для WebSocket соединения. Side effect изолирован в возвращаемой функции. */
export function createWebSocketEffect(
  url: string,
  handlers: WebSocketHandlers,
): WebSocketEffect {
  return () => {
    const ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      handlers.open();
    });
    ws.addEventListener('message', (event) => {
      handlers.message(event);
    });
    ws.addEventListener('close', () => {
      const result = handlers.close();
      if (result instanceof Promise) {
        result.catch(() => {
          /* заглушка - отстрелил и забыл */
        });
      }
    });
    if (handlers.error) {
      ws.addEventListener('error', (event) => {
        handlers.error?.(event);
      });
    }

    return ws;
  };
}

/** Создает Effect для WebSocket соединения с tracing. Side effect изолирован в возвращаемой функции. */
export function createWebSocketEffectWithTracing(
  url: string,
  handlers: WebSocketHandlersWithTracing,
  context?: EffectContext,
): WebSocketEffect {
  return () => {
    const ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      handlers.open(context);
    });
    ws.addEventListener('message', (event) => {
      handlers.message(event, context);
    });
    ws.addEventListener('close', () => {
      const result = handlers.close(context);
      if (result instanceof Promise) {
        result.catch(() => {
          /* заглушка - отстрелил и забыл */
        });
      }
    });
    if (handlers.error) {
      ws.addEventListener('error', (event) => {
        handlers.error?.(event, context);
      });
    }

    return ws;
  };
}

/* ============================================================================
* ⚡ STATE TRANSITIONS (ЧИСТЫЕ ФУНКЦИИ)
* ========================================================================== */

/** Создает команду для открытия соединения. Возвращает новое состояние и effect для выполнения. */
export function connectWebSocket<T>(
  state: WebSocketClientState<T>,
): [WebSocketClientState<T>, WebSocketEffect] {
  // Создаем handlers для обработки событий
  const handlers: WebSocketHandlers = {
    open: () => {
      // Соединение открыто - логика состояния обрабатывается на уровне машины
      // Здесь только уведомление, без прямых мутаций состояния
    },

    message: (msg: MessageEvent) => {
      try {
        const rawData = msg.data as unknown;
        // Safe JSON parsing
        if (typeof rawData !== 'string') {
          return; // Игнорировать некорректные данные
        }
        const event = JSON.parse(rawData) as WebSocketEvent<T>;
        // Использовать копию для immutable semantics
        [...state.listeners].forEach((fn): void => {
          fn(event);
        });
      } catch {
        /* игнорировать некорректные сообщения */
      }
    },

    close: () => {
      // Закрытие соединения - логика состояния обрабатывается на уровне машины
      // Reconnect логика должна быть в отдельном effect или transition
    },

    error: () => {
      // Обработка ошибок - делегировать инфраструктурному слою
      // Логирование здесь не нужно - держать WebSocket слой чистым
    },
  };

  // Создаем Effect для WebSocket
  const wsEffect = createWebSocketEffect(state.url, handlers);

  // Создаем функцию для настройки abort controller
  const attachAbortController = (ws: WebSocket): void => {
    state.abortController?.signal.addEventListener('abort', (): void => {
      ws.close();
    });
  };

  // Возвращаем новое состояние и composed effect
  const newState = setConnectionState(state, 'CONNECTING');
  const composedEffect: () => WebSocket = (): WebSocket => {
    const ws = wsEffect();
    attachAbortController(ws);
    return ws;
  };

  return [newState, composedEffect];
}

/** Transition: обрабатывает закрытие соединения с возможным reconnect. Чистая функция, возвращает новое состояние и effect для reconnect с delay если нужно. */
export function handleWebSocketClose<T>(
  state: WebSocketClientState<T>,
): [WebSocketClientState<T>, (() => Promise<void>) | null] {
  const closedState = setConnectionState(state, 'CLOSED');

  if (
    closedState.autoReconnect
    && closedState.retries < closedState.maxRetries
  ) {
    const nextState = incrementRetries(closedState);
    const [reconnectState, reconnectEffect] = connectWebSocket(nextState);

    // Создаем effect с exponential backoff delay (ограничен MAX_RETRY_DELAY_MS)
    const delayMs = Math.min(
      nextState.retryDelayMs * Math.pow(nextState.retryBackoffFactor, nextState.retries - 1),
      MAX_RETRY_DELAY_MS,
    );
    const delayedReconnectEffect = async (): Promise<void> => {
      await sleep(delayMs, nextState.abortController?.signal);
      reconnectEffect();
    };

    // Обертка для соблюдения no-floating-promises правила
    const safeDelayedReconnectEffect: () => Promise<void> = async (): Promise<void> => {
      try {
        await delayedReconnectEffect();
      } catch (error) {
        // Логируем ошибки reconnect для observability
        logFireAndForget('WARN', 'WebSocket reconnect failed', {
          operation: 'reconnect',
          error: error instanceof Error ? error.message : String(error),
          source: 'WebSocket',
          url: nextState.url,
          retryAttempt: nextState.retries,
        });
      }
    };

    return [reconnectState, safeDelayedReconnectEffect];
  }

  return [closedState, null];
}

/** Transition: обрабатывает открытие соединения. Чистая функция, возвращает новое состояние. */
export function handleWebSocketOpen<T>(
  state: WebSocketClientState<T>,
): WebSocketClientState<T> {
  return resetRetries(setConnectionState(state, 'OPEN'));
}

/** Эффект: закрывает соединение. Side-effect функция, возвращает новое состояние. */
export function closeWebSocketEffect<T>(
  state: WebSocketClientState<T>,
  code?: number,
  reason?: string,
): WebSocketClientState<T> {
  // Side-effect: закрыть WebSocket соединение с логированием
  const logger = createWebSocketLogger('close');
  const closeEffect = async (): Promise<void> => {
    state.ws?.close(code, reason);
    await Promise.resolve();
  };
  const loggedCloseEffect = withLogging(closeEffect, logger, state.context);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  loggedCloseEffect(); // Promise игнорируется для соблюдения контракта функции
  return setWebSocket(state, undefined);
}

/** Эффект: отправляет сообщение. Side-effect функция, возвращает состояние без изменений. */
export function sendWebSocketMessageEffect<T>(
  state: WebSocketClientState<T>,
  event: WebSocketEvent<T>,
): WebSocketClientState<T> {
  if (state.ws?.readyState !== WebSocket.OPEN) {
    const error: EffectError = {
      kind: 'Network',
      message: 'WebSocket is not open',
      ...(state.ws?.readyState !== undefined && { status: state.ws.readyState }),
    };
    throw error;
  }

  // Side-effect: отправить сообщение через WebSocket с error handling и логированием
  const logger = createWebSocketLogger('sendMessage');
  const sendEffect = async (): Promise<void> => {
    try {
      // После проверки readyState мы знаем, что ws определен
      (state.ws as WebSocket).send(JSON.stringify(event));
      await Promise.resolve();
    } catch (error) {
      // Safety: если WebSocket закрыт между проверкой и отправкой
      const errorMessage = error instanceof Error ? error.message : String(error);
      const wsError: EffectError = {
        kind: 'Network',
        message: `Failed to send WebSocket message: ${errorMessage}`,
        status: (state.ws as WebSocket).readyState,
        payload: error,
      };
      throw wsError;
    }
  };

  const loggedSendEffect = withLogging(sendEffect, logger, state.context);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  loggedSendEffect(); // Promise игнорируется для соблюдения контракта функции

  return state;
}

/** Подписка на сообщения. */
export function onWebSocketMessage<T>(
  state: WebSocketClientState<T>,
  listener: (e: WebSocketEvent<T>) => void,
): WebSocketClientState<T> {
  return addListener(state, listener);
}

/** Отписка от сообщений. */
export function offWebSocketMessage<T>(
  state: WebSocketClientState<T>,
  listener: (e: WebSocketEvent<T>) => void,
): WebSocketClientState<T> {
  return removeListener(state, listener);
}
