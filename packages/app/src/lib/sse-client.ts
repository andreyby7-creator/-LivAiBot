/**
 * @file packages/app/src/lib/sse-client.ts
 * SSE Streaming Runtime (Functional FSM)
 * Production-ready SSE runtime как детерминированный конечный автомат.
 * Принципы: Без классов/this, без мутации состояния, чистый reducer (без I/O/side effects).
 * Архитектура:
 * - Reducer: (state, event) → {state, emittedEvents} - только вычисление состояния
 * - Effect-слой: emittedEvents + EventSource/таймеры/AbortController/telemetry (все side effects)
 * - Runtime: оркестрация reducer/effects, жизненный цикл FSM
 * Гарантии: Детерминированный FSM, изолированные тестируемые side effects, контроль ресурсов.
 * Поддержка: Полный SSE протокол + resumability + heartbeat + reconnect/jitter + подписки + декодер + telemetry.
 * Это streaming runtime, не просто SSE клиент.
 */

import { withLogging } from './effect-utils.js';
import type { EffectAbortController, EffectContext, EffectLogger } from './effect-utils.js';
import { infoFireAndForget, logFireAndForget } from './telemetry-runtime.js';

/* ============================================================================
 * 🧠 ПРОТОКОЛ И БАЗОВЫЕ ТИПЫ
 * ========================================================================== */

export type SSEConnectionState =
  | 'CONNECTING'
  | 'OPEN'
  | 'CLOSED';

/** Полный SSE фрейм от сервера. */
export type SSEFrame = {
  readonly id: string | undefined;
  readonly event: string | undefined;
  readonly data: string;
  readonly retry: number | undefined;
};

/** Сырое событие протокола SSE. */
export type SSEProtocolEvent<TPayload = unknown> = {
  readonly id: string | undefined;
  readonly type: string;
  readonly timestamp: number;
  readonly payload: TPayload;
};

/** Абстракция декодера. */
export type SSEDecoder<T> = (frame: SSEFrame) => SSEProtocolEvent<T> | null;

/** Абстракция стратегии переподключения. Все стратегии включают jitter для предотвращения thundering herd. */
export type ReconnectStrategy =
  | { readonly type: 'fixed'; readonly delayMs: number; }
  | { readonly type: 'linear'; readonly baseDelayMs: number; }
  | { readonly type: 'exponential'; readonly baseDelayMs: number; readonly factor: number; }
  | { readonly type: 'custom'; readonly calculateDelay: (attempt: number) => number; };

/** Телеметрические хуки для наблюдаемости. */
export type SSETelemetry = {
  readonly onConnect?: () => void;
  readonly onDisconnect?: () => void;
  readonly onReconnect?: (attempt: number, delayMs: number) => void;
  readonly onMessage?: (bytes: number) => void;
  readonly onError?: (error: unknown) => void;
};

/* ============================================================================
 * 🧱 STATE
 * ========================================================================== */

export type SSEClientState<TMessage = unknown> = {
  readonly url: string;
  readonly eventSource: EventSource | undefined;
  readonly connectionState: SSEConnectionState;
  readonly cleanup: (() => void) | undefined;
  readonly heartbeatCleanup: (() => void) | undefined;

  readonly autoReconnect: boolean;
  readonly maxRetries: number;
  readonly retries: number;
  readonly reconnectStrategy: ReconnectStrategy;

  readonly lastEventId: string | undefined;

  readonly heartbeatTimeoutMs: number;
  readonly lastHeartbeatAt: number;

  readonly decoder: SSEDecoder<TMessage>;

  readonly listeners: ReadonlyMap<
    string,
    ReadonlySet<(event: SSEProtocolEvent<TMessage>) => void>
  >;

  readonly telemetry: SSETelemetry | undefined;

  readonly abortController: EffectAbortController | undefined;
  readonly context: EffectContext | undefined;
};

/* ============================================================================
 * 🧩 CONFIG
 * ========================================================================== */

export type SSEClientConfig<T> = {
  readonly url: string;
  readonly autoReconnect?: boolean;
  readonly maxRetries?: number;
  readonly reconnectStrategy?: ReconnectStrategy;
  readonly heartbeatTimeoutMs?: number;
  readonly decoder?: SSEDecoder<T>;
  readonly telemetry?: SSETelemetry;
  readonly abortController?: EffectAbortController;
  readonly context?: EffectContext;
};

/* ============================================================================
 * 🧱 DEFAULTS
 * ========================================================================== */

export const defaultDecoder: SSEDecoder<unknown> = (frame) => {
  try {
    const parsed = JSON.parse(frame.data) as {
      id?: string;
      type?: string;
      payload?: unknown;
    };
    return {
      id: frame.id ?? parsed.id,
      type: frame.event ?? parsed.type ?? 'message',
      timestamp: Date.now(),
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
};

const DEFAULT_RECONNECT_STRATEGY: ReconnectStrategy = {
  type: 'exponential',
  baseDelayMs: 1_000,
  factor: 2,
};

const SSE_DEFAULTS = {
  HEARTBEAT_TIMEOUT_MS: 30_000,
  HEARTBEAT_CHECK_DIVISOR: 4,
  RECONNECT_JITTER_FACTOR: 0.2, // 20% jitter для предотвращения thundering herd
} as const;

/* ============================================================================
 * 🧱 INITIAL STATE
 * ========================================================================== */

export function createInitialSSEState<T>(
  config: Readonly<SSEClientConfig<T>>,
): SSEClientState<T> {
  return {
    url: config.url,
    eventSource: undefined,
    connectionState: 'CLOSED',

    autoReconnect: config.autoReconnect ?? true,
    maxRetries: config.maxRetries ?? 10,
    retries: 0,
    reconnectStrategy: config.reconnectStrategy ?? DEFAULT_RECONNECT_STRATEGY,

    lastEventId: undefined,

    heartbeatTimeoutMs: config.heartbeatTimeoutMs ?? SSE_DEFAULTS.HEARTBEAT_TIMEOUT_MS,
    lastHeartbeatAt: Date.now(),

    decoder: config.decoder ?? (defaultDecoder as SSEDecoder<T>),

    listeners: new Map(),

    telemetry: config.telemetry,

    abortController: config.abortController,
    context: config.context,
    cleanup: undefined,
    heartbeatCleanup: undefined,
  };
}

/* ============================================================================
 * 🔧 PURE HELPERS
 * ========================================================================== */

function updateMap<K, V>(
  map: ReadonlyMap<K, V>,
  key: K,
  value: V,
): ReadonlyMap<K, V> {
  return Object.freeze(new Map(map).set(key, value));
}

function updateSet<T>(
  set: ReadonlySet<T>,
  item: T,
): ReadonlySet<T> {
  return Object.freeze(new Set(set).add(item));
}

const deleteFromSet = <T>(s: ReadonlySet<T>, v: T): ReadonlySet<T> =>
  Object.freeze(new Set([...s].filter((x) => x !== v)));

export function calculateReconnectDelay(
  strategy: Readonly<ReconnectStrategy>,
  attempt: number,
): number {
  switch (strategy.type) {
    case 'fixed':
      return strategy.delayMs;
    case 'linear':
      return strategy.baseDelayMs * attempt;
    case 'exponential':
      return strategy.baseDelayMs * Math.pow(strategy.factor, attempt - 1);
    case 'custom':
      return strategy.calculateDelay(attempt);
  }
}

function applyJitter(delay: number): number {
  // Добавляем jitter для предотвращения thundering herd (массового одновременного переподключения)
  // Jitter = случайное значение от 0 до 20% от delay
  const jitter = Math.random() * delay * SSE_DEFAULTS.RECONNECT_JITTER_FACTOR;
  return delay + jitter;
}

/* ============================================================================
 * 🔌 EFFECT LAYER
 * ========================================================================== */

export type SSEDispatch = (event: SSEInternalEvent) => void;

export type SSEInternalEvent =
  | { readonly type: 'OPEN'; }
  | { readonly type: 'CONNECTED'; readonly eventSource: EventSource; }
  | { readonly type: 'SET_CLEANUP'; readonly cleanup: (() => void) | undefined; }
  | { readonly type: 'SET_HEARTBEAT_CLEANUP'; readonly cleanup: (() => void) | undefined; }
  | { readonly type: 'START_HEARTBEAT'; }
  | { readonly type: 'INCREMENT_RETRIES'; }
  | { readonly type: 'ERROR'; readonly error: unknown; }
  | { readonly type: 'MESSAGE'; readonly frame: SSEFrame; }
  | { readonly type: 'HEARTBEAT'; }
  | { readonly type: 'DISCONNECTED'; };

export type SSEEffect = () => {
  readonly resource: EventSource;
  readonly cleanup: () => void;
};

function buildSSEUrl(url: string, lastEventId?: string): string {
  return lastEventId !== undefined
    ? `${url}?lastEventId=${encodeURIComponent(lastEventId)}`
    : url;
}

function handleMessage(
  dispatch: SSEDispatch,
  telemetry?: Readonly<SSETelemetry>,
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    const frame = parseSSEFrame(event);
    telemetry?.onMessage?.(frame.data.length);
    dispatch({ type: 'MESSAGE', frame });
  };
}

function handleError(
  dispatch: SSEDispatch,
  telemetry?: Readonly<SSETelemetry>,
): (error: unknown) => void {
  return (error: unknown) => {
    telemetry?.onError?.(error);
    // Логируем ошибки SSE соединения
    logFireAndForget('WARN', 'SSE connection error', {
      operation: 'connection',
      error: error instanceof Error ? error.message : String(error),
      source: 'SSE',
    });
    dispatch({ type: 'ERROR', error });
  };
}

/** Парсит MessageEvent в SSEFrame. */
function parseSSEFrame(event: MessageEvent): SSEFrame {
  // EventSource автоматически устанавливает lastEventId в DOM
  const lastEventId =
    typeof (event as MessageEvent & { lastEventId?: string; }).lastEventId === 'string'
      ? (event as MessageEvent & { lastEventId?: string; }).lastEventId
      : undefined;

  // Парсим retry из данных события, если оно приходит в формате "retry: <milliseconds>"
  let retry: number | undefined;
  const data = String(event.data);
  const retryMatch = data.match(/^retry:\s*(\d+)$/m);
  const retryValue = retryMatch?.[1];
  if (retryValue !== undefined && retryValue !== '') {
    const retryMs = parseInt(retryValue, 10);
    if (!isNaN(retryMs) && retryMs > 0) {
      retry = retryMs;
    }
  }

  return Object.freeze({
    id: lastEventId ?? undefined,
    event: event.type !== 'message' ? event.type : undefined,
    data,
    retry,
  });
}

/** Создает логгер для SSE эффектов. */
export function createSSELogger(operation: string): EffectLogger {
  return {
    onStart: (context?: EffectContext): void => {
      infoFireAndForget(`SSE ${operation} started`, {
        operation,
        source: context?.source ?? 'SSE',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
    onSuccess: (durationMs: number, context?: EffectContext): void => {
      logFireAndForget('INFO', `SSE ${operation} completed`, {
        operation,
        durationMs,
        source: context?.source ?? 'SSE',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
    onError: (error: unknown, context?: EffectContext): void => {
      logFireAndForget('WARN', `SSE ${operation} failed`, {
        operation,
        error: error instanceof Error ? error.message : String(error),
        source: context?.source ?? 'SSE',
        ...(context?.traceId != null && { traceId: context.traceId }),
      });
    },
  };
}

/** Создает SSE подключение с автоматическим управлением жизненным циклом. */
export function connectSSE<T>(
  getState: () => Readonly<SSEClientState<T>>,
  dispatch: SSEDispatch,
): SSEEffect {
  return createSSEEffect(getState, dispatch);
}

export function createSSEEffect<T>(
  getState: () => Readonly<SSEClientState<T>>,
  dispatch: SSEDispatch,
): SSEEffect {
  return () => {
    const currentState = getState();
    const es = new EventSource(
      buildSSEUrl(currentState.url, currentState.lastEventId),
      { withCredentials: true },
    );

    // Wrapper для dispatch с side effects
    const effectDispatch = (event: SSEInternalEvent): void => {
      // Handle FSM side effects
      if (event.type === 'DISCONNECTED') {
        currentState.telemetry?.onDisconnect?.();
        // Логируем отключение
        logFireAndForget('INFO', 'SSE connection disconnected', {
          operation: 'disconnect',
          source: 'SSE',
          url: currentState.url,
        });
        // Увеличиваем счетчик попыток для reconnect
        dispatch({ type: 'INCREMENT_RETRIES' });
        // heartbeatCleanup теперь вызывается в reducer через state.heartbeatCleanup?.()
      }

      // Forward to FSM
      dispatch(event);
    };

    // Объединяем open handler с heartbeat запуском
    const openHandler = (): void => {
      currentState.telemetry?.onConnect?.();
      effectDispatch({ type: 'OPEN' });

      // Запускаем heartbeat через FSM при открытии соединения
      const heartbeatEffect = createHeartbeatEffect(getState, effectDispatch);
      heartbeatEffect((cleanup: () => void) => {
        effectDispatch({ type: 'SET_HEARTBEAT_CLEANUP', cleanup });
      });
    };

    es.addEventListener('open', openHandler);
    es.addEventListener('message', handleMessage(effectDispatch, currentState.telemetry));
    es.addEventListener('error', handleError(effectDispatch, currentState.telemetry));

    // AbortController listener с proper cleanup
    let abortListener: (() => void) | undefined;

    if (currentState.abortController) {
      const onAbort = (): void => {
        effectDispatch({ type: 'DISCONNECTED' });
      };

      currentState.abortController.signal.addEventListener('abort', onAbort);

      // Cleanup функция для снятия listener
      abortListener = (): void => {
        currentState.abortController?.signal.removeEventListener('abort', onAbort);
      };
    }

    const cleanup = (): void => {
      abortListener?.();
      es.close(); // Закрываем EventSource
      // heartbeatCleanup происходит в reducer при DISCONNECTED
    };

    return {
      resource: es,
      cleanup,
    };
  };
}

/* ============================================================================
 * 🎯 FSM EFFECTS
 * ========================================================================== */

/** Side effect события, которые должны быть выполнены effect-слоем. */
export type SSESidEffectEvent = { readonly type: 'CLEANUP'; readonly cleanup: () => void; };

export type SSEEmittedEvent<TMessage = unknown> = SSEProtocolEvent<TMessage> | SSESidEffectEvent;

/* ============================================================================
 * ⚡ REDUCER (PURE FSM - NO SIDE EFFECTS)
 * ========================================================================== */

export type SSEReduceResult<T> = {
  readonly newState: SSEClientState<T>;
  readonly emittedEvents: readonly SSEEmittedEvent<T>[];
};

export function reduceSSEState<T>(
  state: Readonly<SSEClientState<T>>,
  event: Readonly<SSEInternalEvent>,
): SSEReduceResult<T> {
  switch (event.type) {
    case 'CONNECTED':
      return {
        newState: {
          ...state,
          eventSource: event.eventSource,
        },
        emittedEvents: [],
      };

    case 'SET_CLEANUP':
      return {
        newState: {
          ...state,
          cleanup: event.cleanup,
        },
        emittedEvents: [],
      };

    case 'SET_HEARTBEAT_CLEANUP':
      return {
        newState: {
          ...state,
          heartbeatCleanup: event.cleanup,
        },
        emittedEvents: [],
      };

    case 'START_HEARTBEAT':
      // Heartbeat effect запускается через side effect
      return {
        newState: {
          ...state,
          lastHeartbeatAt: Date.now(),
        },
        emittedEvents: [],
      };

    case 'INCREMENT_RETRIES':
      return {
        newState: {
          ...state,
          retries: state.retries + 1,
        },
        emittedEvents: [],
      };

    case 'OPEN':
      return {
        newState: {
          ...state,
          connectionState: 'OPEN',
          retries: 0,
          lastHeartbeatAt: Date.now(),
        },
        emittedEvents: [],
      };

    case 'MESSAGE': {
      const decoded = state.decoder(event.frame);
      if (!decoded) {
        return {
          newState: state,
          emittedEvents: [],
        };
      }

      return {
        newState: {
          ...state,
          lastEventId: decoded.id ?? state.lastEventId,
          lastHeartbeatAt: Date.now(),
        },
        emittedEvents: [decoded],
      };
    }

    case 'ERROR':
      return {
        newState: {
          ...state,
          connectionState: 'CLOSED',
        },
        emittedEvents: [],
      };

    case 'DISCONNECTED':
      // Emit cleanup events для выполнения effect-слоем
      const cleanupEvents: readonly SSESidEffectEvent[] = [
        ...(state.cleanup ? [{ type: 'CLEANUP' as const, cleanup: state.cleanup }] : []),
        ...(state.heartbeatCleanup
          ? [{ type: 'CLEANUP' as const, cleanup: state.heartbeatCleanup }]
          : []),
      ];

      return {
        newState: {
          ...state,
          eventSource: undefined,
          connectionState: 'CLOSED',
          cleanup: undefined,
          heartbeatCleanup: undefined,
        },
        emittedEvents: cleanupEvents,
      };

    case 'HEARTBEAT':
      return {
        newState: {
          ...state,
          lastHeartbeatAt: Date.now(),
        },
        emittedEvents: [],
      };

    default:
      return {
        newState: state,
        emittedEvents: [],
      };
  }
}

/* ============================================================================
 * 🔄 PURE FSM STEP (REDUCE + EMIT)
 * ========================================================================== */

// stepSSEFSM теперь интегрирован в runtime.dispatch

/* ============================================================================
 * 🎮 SSE FSM Runtime
 * ========================================================================== */

export function createSSERuntime<T>(
  config: Readonly<SSEClientConfig<T>>,
): {
  getState: () => SSEClientState<T>;
  dispatch: (event: SSEInternalEvent) => void;
  startEffect: (effect: SSEEffect) => EventSource;
  stopEffect: () => void;
  subscribe: (channel: string, listener: (event: SSEProtocolEvent<T>) => void) => () => void;
} {
  let currentState = createInitialSSEState(config);

  const dispatch = (event: Readonly<SSEInternalEvent>): void => {
    const result = reduceSSEState(currentState, event);
    currentState = result.newState;

    // Выполняем emitted events - встроенная логика emit
    result.emittedEvents.forEach((emittedEvent) => {
      // Обработка side effect событий
      if (emittedEvent.type === 'CLEANUP') {
        (emittedEvent as SSESidEffectEvent).cleanup();
        return;
      }

      // Обработка protocol событий для listeners
      const listeners = currentState.listeners.get(emittedEvent.type);
      listeners?.forEach((fn: (event: SSEProtocolEvent<T>) => void) => {
        fn(emittedEvent as SSEProtocolEvent<T>);
      });
    });
  };

  const startEffect = (effect: SSEEffect): EventSource => {
    const { resource, cleanup } = effect();
    const logger = createSSELogger('connect');

    const loggedConnectEffect = withLogging(
      async (): Promise<{ resource: EventSource; cleanup: () => void; }> => {
        // FSM получает владение ресурсами через события
        dispatch({ type: 'CONNECTED', eventSource: resource });
        dispatch({ type: 'SET_CLEANUP', cleanup });

        await Promise.resolve();
        return { resource, cleanup };
      },
      logger,
      currentState.context,
    );

    // Для соблюдения контракта функции игнорируем Promise
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loggedConnectEffect();
    return resource; // Возвращаем ресурс напрямую для обратной совместимости
  };

  const stopEffect = (): void => {
    dispatch({ type: 'DISCONNECTED' });
  };

  const subscribe = (
    channel: string,
    listener: (event: SSEProtocolEvent<T>) => void,
  ): () => void => {
    currentState = onSSEMessage(currentState, channel, listener);
    return (): void => {
      currentState = offSSEMessage(currentState, channel, listener);
    };
  };

  return {
    getState: () => currentState,
    dispatch,
    startEffect,
    stopEffect,
    subscribe,
  };
}

/* ============================================================================
 * 💓 HEARTBEAT EFFECT (ZOMBIE CONNECTION KILL)
 * ========================================================================== */

export type HeartbeatEffect = (onCleanup: (cleanup: () => void) => void) => void;

export function createHeartbeatEffect<T>(
  getState: () => Readonly<SSEClientState<T>>,
  dispatch: SSEDispatch,
): HeartbeatEffect {
  return (onCleanup) => {
    const intervalId = setInterval(() => {
      const currentState = getState();
      const timeSinceLastHeartbeat = Date.now() - currentState.lastHeartbeatAt;
      if (timeSinceLastHeartbeat > currentState.heartbeatTimeoutMs) {
        dispatch({
          type: 'ERROR',
          error: new Error(
            `Heartbeat timeout: ${timeSinceLastHeartbeat}ms > ${currentState.heartbeatTimeoutMs}ms`,
          ),
        });
      }
    }, Math.max(1000, getState().heartbeatTimeoutMs / SSE_DEFAULTS.HEARTBEAT_CHECK_DIVISOR)); // Проверяем часто, но не чаще 1 секунды

    // Cleanup функция для остановки heartbeat при закрытии
    onCleanup(() => {
      clearInterval(intervalId);
    });
  };
}

/* ============================================================================
 * 🔁 RECONNECT EFFECT
 * ========================================================================== */

export function createReconnectEffect<T>(
  getState: () => Readonly<SSEClientState<T>>,
  connect: () => void,
): ((signal?: AbortSignal) => Promise<void>) | null {
  const state = getState();
  if (!state.autoReconnect || state.retries >= state.maxRetries) {
    return null;
  }

  const nextAttempt = state.retries + 1;
  const baseDelay = calculateReconnectDelay(state.reconnectStrategy, nextAttempt);
  const delay = applyJitter(baseDelay);

  state.telemetry?.onReconnect?.(nextAttempt, delay);

  return async (signal?: AbortSignal) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);

      const cleanup = (): void => {
        clearTimeout(timer);
        reject(new Error('Reconnect aborted'));
      };

      if (signal?.aborted === true) {
        cleanup();
        return;
      }

      signal?.addEventListener('abort', cleanup, { once: true });
    });

    if (signal?.aborted !== true) {
      connect();
    }
  };
}

/* ============================================================================
 * 📬 SUBSCRIPTIONS
 * ========================================================================== */

export function onSSEMessage<T>(
  state: Readonly<SSEClientState<T>>,
  channel: string,
  listener: (event: SSEProtocolEvent<T>) => void,
): SSEClientState<T> {
  const existing = state.listeners.get(channel)
    ?? Object.freeze(new Set<(event: SSEProtocolEvent<T>) => void>());
  const updated = updateSet(existing, listener);

  return {
    ...state,
    listeners: updateMap(state.listeners, channel, updated),
  };
}

export function offSSEMessage<T>(
  state: Readonly<SSEClientState<T>>,
  channel: string,
  listener: (event: SSEProtocolEvent<T>) => void,
): SSEClientState<T> {
  const existing = state.listeners.get(channel);
  if (!existing) return state;

  const updated = deleteFromSet(existing, listener);

  const map = updated.size === 0
    ? Object.freeze(
      new Map<string, ReadonlySet<(event: SSEProtocolEvent<T>) => void>>(
        [...state.listeners].filter(([key]) => key !== channel),
      ),
    )
    : updateMap(state.listeners, channel, updated);

  return {
    ...state,
    listeners: map,
  };
}
