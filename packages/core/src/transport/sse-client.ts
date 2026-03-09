/**
 * @file @livai/core/src/transport/sse-client.ts
 * ============================================================================
 * 🔌 SSE CLIENT — PRODUCTION-READY SSE STREAMING RUNTIME (FUNCTIONAL FSM)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Детерминированный конечный автомат для SSE соединений
 * - Универсальный SSE runtime для всех пакетов, не привязан к app
 * - Поддержка браузера и Node.js через опциональный EventSourceFactory
 * - Полный SSE протокол с resumability, heartbeat, reconnect с jitter
 *
 * Свойства:
 * - Functional FSM: без классов/this, без мутации состояния
 * - Чистый reducer: (state, event) → {state, emittedEvents} - только вычисление состояния
 * - Effect-слой: emittedEvents + EventSource/таймеры/AbortController/telemetry (все side effects)
 * - Runtime: оркестрация reducer/effects, жизненный цикл FSM
 * - Детерминированный FSM для предсказуемости и тестируемости
 * - Изолированные тестируемые side effects
 * - Контроль ресурсов через AbortController
 *
 * Принципы:
 * - SRP: разделение reducer (pure) и effect-слоя (side effects)
 * - Deterministic: детерминированный FSM для одинаковых входов (clock/random через DI)
 * - Platform-agnostic: поддержка браузера и Node.js через адаптеры
 * - Resource-safe: автоматический cleanup через AbortController
 * - Extensible: декодер, стратегии переподключения, телеметрия через DI
 * - No I/O в reducer: все side effects изолированы в effect-слое
 *
 * Использование:
 * - Создание runtime: `createSSERuntime(config)`
 * - Подключение: `runtime.startEffect()` или `runtime.startEffect(createSSEEffect(getState, dispatch))`
 * - Подписка на события: `runtime.subscribe(topic, listener)`
 * - Отключение: `runtime.stopEffect()`
 * - Логирование через DI: передать `logger` в `SSEClientConfig`
 * - Node.js поддержка: передать `eventSourceFactory` в `SSEClientConfig`
 * - Deterministic testing: передать `clock` и `random` в `SSEClientConfig`
 *
 * NOTE: Возможные улучшения / future-work:
 * - Reconnect / масштабирование: вынести reconnect-таймеры в отдельный ReconnectController
 *   с centralized scheduler для тысяч соединений; рассмотреть batch-tick heartbeat в multi-tenant сценариях.
 * - Subscriptions: добавить onSubscriptionRejected hook и telemetry-события для rejected listeners
 *   (метрики, алерты, quota-менеджер).
 * - Security / JSON: рассмотреть лимит глубины JSON и контроль UTF-8 bytes на уровне API-границы;
 *   сохранить текущий defaultDecoder в core, дополнительные guard'ы вынести в user-decoder / API слой.
 */

import type { EffectAbortController, EffectContext, EffectLogger } from '@livai/core/effect';
import { withLogging } from '@livai/core/effect';

/* ============================================================================
 * 🧠 ПРОТОКОЛ И БАЗОВЫЕ ТИПЫ
 * ========================================================================== */

export type SSEConnectionState =
  | 'CONNECTING'
  | 'OPEN'
  | 'CLOSED';

/** Полный SSE фрейм от сервера. */
export interface SSEFrame {
  readonly id: string | undefined;
  readonly event: string | undefined;
  readonly data: string;
  readonly retry: number | undefined;
}

/** Сырое событие протокола SSE. */
export interface SSEProtocolEvent<TPayload = unknown> {
  readonly id: string | undefined;
  readonly type: string;
  readonly timestamp: number;
  readonly payload: TPayload;
}

/** Абстракция декодера. */
export type SSEDecoder<T> = (frame: SSEFrame, clock: () => number) => SSEProtocolEvent<T> | null;

/** Абстракция стратегии переподключения. Все стратегии включают jitter для предотвращения thundering herd. */
export type ReconnectStrategy =
  | { readonly type: 'fixed'; readonly delayMs: number; }
  | { readonly type: 'linear'; readonly baseDelayMs: number; }
  | { readonly type: 'exponential'; readonly baseDelayMs: number; readonly factor: number; }
  | { readonly type: 'custom'; readonly calculateDelay: (attempt: number) => number; };

/** Телеметрические хуки для наблюдаемости. */
export interface SSETelemetry {
  readonly onConnect?: () => void;
  readonly onDisconnect?: () => void;
  readonly onReconnect?: (attempt: number, delayMs: number) => void;
  readonly onMessage?: (bytes: number) => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * Абстракция EventSource для поддержки браузера и Node.js.
 * В браузере используется нативный EventSource, в Node.js требуется полифилл или адаптер.
 */
export interface EventSourceLike {
  readonly readyState: number;
  readonly url: string;
  readonly withCredentials: boolean;
  readonly CONNECTING: number;
  readonly OPEN: number;
  readonly CLOSED: number;
  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  close(): void;
  dispatchEvent(event: Event): boolean;
}

/**
 * Фабрика для создания EventSource-подобного объекта.
 * В браузере возвращает нативный EventSource, в Node.js может использовать полифилл или адаптер.
 * NOTE (Node.js адаптер):
 * - должен фильтровать sensitive headers (auth, cookies и т.п.)
 * - не должен пробрасывать необязательные данные «как есть» без валидации
 * - должен логировать ошибки создания EventSource безопасно (без утечки секретов)
 */
export type EventSourceFactory = (
  url: string,
  options?: {
    readonly withCredentials?: boolean;
    readonly headers?: Readonly<Record<string, string>>;
    readonly signal?: AbortSignal;
  },
) => EventSourceLike;

/** Runtime clock для детерминированного тестирования. */
export type RuntimeClock = () => number;

/** Runtime random для детерминированного тестирования. */
export type RuntimeRandom = () => number;

/* ============================================================================
 * 🧱 STATE (SRP: разделение по доменным ролям)
 * ========================================================================== */

/** Состояние соединения SSE. */
export interface SSEConnection {
  readonly eventSource: EventSourceLike | undefined;
  readonly connectionState: SSEConnectionState;
  readonly retries: number;
  readonly lastEventId: string | undefined;
  readonly cleanup: (() => void) | undefined;
}

/** Состояние heartbeat. */
export interface SSEHeartbeat {
  readonly lastHeartbeatAt: number;
  readonly timeoutMs: number;
  readonly heartbeatCleanup: (() => void) | undefined;
}

/** Состояние подписок. */
export interface SSESubscriptions<TMessage = unknown> {
  readonly listeners: ReadonlyMap<
    string,
    ReadonlySet<(event: SSEProtocolEvent<TMessage>) => void>
  >;
  readonly maxListenersPerChannel?: number;
  readonly maxChannels?: number;
}

/** Полное состояние SSE клиента (композиция доменных состояний). */
export interface SSEClientState<TMessage = unknown> {
  readonly url: string;
  readonly connection: SSEConnection;
  readonly heartbeat: SSEHeartbeat;
  readonly subscriptions: SSESubscriptions<TMessage>;

  readonly autoReconnect: boolean;
  readonly maxRetries: number;
  readonly reconnectStrategy: ReconnectStrategy;

  readonly decoder: SSEDecoder<TMessage>;

  readonly telemetry: SSETelemetry | undefined;
  readonly abortController: EffectAbortController | undefined;
  readonly context: EffectContext | undefined;
  readonly logger: EffectLogger | undefined;

  readonly clock: RuntimeClock;
  readonly random: RuntimeRandom;
}

/* ============================================================================
 * 🧩 CONFIG
 * ========================================================================== */

export interface SSEClientConfig<T> {
  readonly url: string;
  readonly autoReconnect?: boolean;
  readonly maxRetries?: number;
  readonly reconnectStrategy?: ReconnectStrategy;
  readonly heartbeatTimeoutMs?: number;
  readonly decoder?: SSEDecoder<T>;
  readonly telemetry?: SSETelemetry;
  readonly abortController?: EffectAbortController;
  readonly context?: EffectContext;
  readonly logger?: EffectLogger;
  readonly eventSourceFactory?: EventSourceFactory;
  readonly clock?: RuntimeClock;
  readonly random?: RuntimeRandom;
  readonly maxFrameSize?: number;
  readonly maxListenersPerChannel?: number;
  readonly maxChannels?: number;
}

/* ============================================================================
 * 🧱 DEFAULTS
 * ========================================================================== */

export const defaultDecoder: SSEDecoder<unknown> = (frame, clock) => {
  try {
    const parsed = JSON.parse(frame.data) as {
      id?: string;
      type?: string;
      payload?: unknown;
    };
    return {
      id: frame.id ?? parsed.id,
      type: frame.event ?? parsed.type ?? 'message',
      timestamp: clock(),
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
  MAX_FRAME_SIZE: 1_000_000, // 1MB
  MAX_LISTENERS_PER_CHANNEL: 100,
  MAX_CHANNELS: 1000,
} as const;

/**
 * Дефолтная фабрика EventSource для браузера.
 * В Node.js требуется передать кастомную фабрику через конфиг.
 * NOTE: В браузере EventSource не поддерживает headers/signal; расширенный интерфейс
 * предназначен для Node.js-адаптеров, которые сами отвечают за фильтрацию sensitive headers.
 */
function defaultEventSourceFactory(
  url: string,
  options?: {
    readonly withCredentials?: boolean;
    readonly headers?: Readonly<Record<string, string>>;
    readonly signal?: AbortSignal;
  },
): EventSourceLike {
  if (typeof EventSource === 'undefined') {
    // eslint-disable-next-line fp/no-throw -- критическая конфигурационная ошибка среды, без EventSource нельзя работать
    throw new Error(
      'EventSource is not available. In Node.js, provide a custom eventSourceFactory in SSEClientConfig.',
    );
  }
  // EventSource не поддерживает headers и signal в браузере, но интерфейс расширяем для Node.js адаптеров
  return new EventSource(url, {
    withCredentials: options?.withCredentials ?? true,
  }) as EventSourceLike;
}

/* ============================================================================
 * 🧱 INITIAL STATE
 * ========================================================================== */

export function createInitialSSEState<T>(
  config: Readonly<SSEClientConfig<T>>,
): SSEClientState<T> {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inline clock/random фабрики только для дефолтов
  const clock = config.clock ?? (() => Date.now());
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inline clock/random фабрики только для дефолтов
  const random = config.random ?? (() => Math.random());

  return {
    url: config.url,
    connection: {
      eventSource: undefined,
      connectionState: 'CLOSED',
      retries: 0,
      lastEventId: undefined,
      cleanup: undefined,
    },
    heartbeat: {
      lastHeartbeatAt: clock(),
      timeoutMs: config.heartbeatTimeoutMs ?? SSE_DEFAULTS.HEARTBEAT_TIMEOUT_MS,
      heartbeatCleanup: undefined,
    },
    subscriptions: {
      listeners: new Map(),
      maxListenersPerChannel: config.maxListenersPerChannel
        ?? SSE_DEFAULTS.MAX_LISTENERS_PER_CHANNEL,
      maxChannels: config.maxChannels ?? SSE_DEFAULTS.MAX_CHANNELS,
    },
    autoReconnect: config.autoReconnect ?? true,
    maxRetries: config.maxRetries ?? 10,
    reconnectStrategy: config.reconnectStrategy ?? DEFAULT_RECONNECT_STRATEGY,
    decoder: config.decoder ?? (defaultDecoder as SSEDecoder<T>),
    telemetry: config.telemetry,
    abortController: config.abortController,
    context: config.context,
    logger: config.logger,
    clock,
    random,
  };
}

/* ============================================================================
 * 📡 PROTOCOL — ПРОТОКОЛ SSE
 * ========================================================================== */

// Безопасно строит URL с query параметрами используя URL API.
function buildSSEUrl(url: string, lastEventId?: string): string {
  if (lastEventId === undefined) {
    return url;
  }
  try {
    const urlObj = new URL(
      url,
      typeof window !== 'undefined' ? window.location.href : 'http://localhost',
    );
    urlObj.searchParams.set('lastEventId', lastEventId);
    return urlObj.toString();
  } catch {
    // Fallback для относительных URL или некорректных URL
    return `${url}?lastEventId=${encodeURIComponent(lastEventId)}`;
  }
}

/* ============================================================================
 * 🧱 STATE — IMMUTABLE STATE OPERATIONS
 * ========================================================================== */

function updateMap<K, V>(
  map: ReadonlyMap<K, V>,
  key: K,
  value: V,
): ReadonlyMap<K, V> {
  return new Map(map).set(key, value);
}

function updateSet<T>(
  set: ReadonlySet<T>,
  item: T,
): ReadonlySet<T> {
  return new Set(set).add(item);
}

const deleteFromSet = <T>(s: ReadonlySet<T>, v: T): ReadonlySet<T> =>
  new Set([...s].filter((x) => x !== v));

/* ============================================================================
 * 🔁 RECONNECT — СТРАТЕГИИ ПЕРЕПОДКЛЮЧЕНИЯ
 * ========================================================================== */

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

function applyJitter(delay: number, random: RuntimeRandom): number {
  const jitter = random() * delay * SSE_DEFAULTS.RECONNECT_JITTER_FACTOR; // 0–20% jitter для предотвращения thundering herd
  return delay + jitter;
}

// Вычисляет задержку переподключения с учетом стратегии и jitter.
export function calculateReconnectDelayWithJitter(
  strategy: Readonly<ReconnectStrategy>,
  attempt: number,
  random: RuntimeRandom,
): number {
  const baseDelay = calculateReconnectDelay(strategy, attempt);
  return applyJitter(baseDelay, random);
}

// Проверяет, должно ли происходить автоматическое переподключение.
function shouldReconnect<T>(state: Readonly<SSEClientState<T>>): boolean {
  return state.autoReconnect && state.connection.retries < state.maxRetries;
}

/* ============================================================================
 * 📬 SUBSCRIPTIONS — УПРАВЛЕНИЕ ПОДПИСКАМИ
 * ========================================================================== */

// Валидирует лимиты подписок перед добавлением нового listener.
function validateSubscriptionLimits<T>(
  state: Readonly<SSEClientState<T>>,
  topic: string,
): { readonly valid: boolean; readonly error?: Error; } {
  const listeners = state.subscriptions.listeners.get(topic);
  const maxListeners = state.subscriptions.maxListenersPerChannel
    ?? SSE_DEFAULTS.MAX_LISTENERS_PER_CHANNEL;
  const maxChannels = state.subscriptions.maxChannels ?? SSE_DEFAULTS.MAX_CHANNELS;

  if (listeners && listeners.size >= maxListeners) {
    return {
      valid: false,
      error: new Error(
        `Max listeners per channel exceeded: ${topic} (${listeners.size}/${maxListeners})`,
      ),
    };
  }

  if (state.subscriptions.listeners.size >= maxChannels) {
    return {
      valid: false,
      error: new Error(
        `Max channels exceeded (${state.subscriptions.listeners.size}/${maxChannels})`,
      ),
    };
  }

  return { valid: true };
}

/* ============================================================================
 * ⚡ EFFECTS — БЕЗОПАСНОЕ ВЫПОЛНЕНИЕ ЭФФЕКТОВ
 * ========================================================================== */

// Безопасно вызывает listener с обработкой ошибок.
function safeInvokeListener<T>(
  listener: (event: SSEProtocolEvent<T>) => void,
  event: SSEProtocolEvent<T>,
  logger?: EffectLogger,
  context?: EffectContext,
): void {
  try {
    listener(event);
  } catch (error) {
    logger?.onError?.(error, {
      ...context,
      source: 'SSE listener',
    });
  }
}

// No-op logger для случаев, когда logger не передан через DI.
export const NO_OP_LOGGER: EffectLogger = {
  onStart: (): void => {},
  onSuccess: (): void => {},
  onError: (): void => {},
};

/* ============================================================================
 * 🎯 TYPE GUARDS — ТИПОВЫЕ ПРОВЕРКИ ДЛЯ EMITTED EVENTS
 * ========================================================================== */

function isProtocolEvent<T>(event: SSEEmittedEvent<T>): event is SSEProtocolEvent<T> {
  return 'type' in event && 'payload' in event && 'timestamp' in event;
}

/* ============================================================================
 * 🔌 EFFECT LAYER
 * ========================================================================== */

export type SSEDispatch = (event: SSEInternalEvent) => void;

export type SSEInternalEvent =
  | { readonly type: 'OPEN'; readonly timestamp: number; }
  | { readonly type: 'CONNECTING'; }
  | { readonly type: 'CONNECTED'; readonly eventSource: EventSourceLike; }
  | { readonly type: 'SET_CLEANUP'; readonly cleanup: (() => void) | undefined; }
  | { readonly type: 'SET_HEARTBEAT_CLEANUP'; readonly cleanup: (() => void) | undefined; }
  | { readonly type: 'START_HEARTBEAT'; readonly timestamp: number; }
  | { readonly type: 'INCREMENT_RETRIES'; }
  | { readonly type: 'ERROR'; readonly error: unknown; }
  | { readonly type: 'MESSAGE'; readonly frame: SSEFrame; readonly timestamp: number; }
  | { readonly type: 'HEARTBEAT'; readonly timestamp: number; }
  | { readonly type: 'DISCONNECTED'; }
  | { readonly type: 'RECONNECT_REQUEST'; };

export type SSEEffect = () => {
  readonly resource: EventSourceLike;
  readonly cleanup: () => void;
};

function parseRetryFromData(data: string): number | undefined {
  const match = data.match(/^retry:\s*(\d+)$/m);
  const value = match?.[1];
  if (value === undefined || value === '') {
    return undefined;
  }
  const retryMs = Number.parseInt(value, 10);
  return !Number.isNaN(retryMs) && retryMs > 0 ? retryMs : undefined;
}

/* eslint-disable ai-security/model-poisoning */
// SSE payload (event.data) валидируется по типу и размеру; далее используется только
// для парсинга retry и передачи в decoder, который сам отвечает за доменную валидацию.
/** Парсит MessageEvent в SSEFrame с проверкой размера и типа данных. */
function parseSSEFrame(
  event: MessageEvent,
  maxFrameSize: number = SSE_DEFAULTS.MAX_FRAME_SIZE,
): SSEFrame | null {
  const rawData: unknown = event.data;
  if (typeof rawData !== 'string') {
    return null; // ai-security/model-poisoning: отбрасываем нетекстовые payload'ы
  }

  const data = rawData;
  if (data.length > maxFrameSize) {
    return null; // Security: отбрасываем слишком большие фреймы
  }

  const lastEventId =
    typeof (event as MessageEvent & { lastEventId?: string; }).lastEventId === 'string'
      ? (event as MessageEvent & { lastEventId?: string; }).lastEventId
      : undefined;

  const retry = parseRetryFromData(data);

  return Object.freeze({
    id: lastEventId ?? undefined,
    event: event.type !== 'message' ? event.type : undefined,
    data,
    retry,
  });
}
/* eslint-enable ai-security/model-poisoning */

export function createSSEEffect<T>(
  getState: () => Readonly<SSEClientState<T>>,
  dispatch: SSEDispatch,
  eventSourceFactory?: EventSourceFactory,
): SSEEffect {
  const factory = eventSourceFactory ?? defaultEventSourceFactory;
  return () => {
    const currentState = getState();
    const factoryOptions: {
      readonly withCredentials?: boolean;
      readonly headers?: Readonly<Record<string, string>>;
      readonly signal?: AbortSignal;
    } = currentState.abortController
      ? {
        withCredentials: true,
        signal: currentState.abortController.signal,
      }
      : {
        withCredentials: true,
      };
    const es = factory(
      buildSSEUrl(currentState.url, currentState.connection.lastEventId),
      factoryOptions,
    );

    dispatch({ type: 'CONNECTING' }); // Dispatch CONNECTING перед установкой соединения
    const effectDispatch = (event: SSEInternalEvent): void => {
      dispatch(event); // Wrapper без side effects
    };

    const openHandler = (): void => {
      effectDispatch({ type: 'OPEN', timestamp: currentState.clock() });
      // Запускаем heartbeat через FSM при открытии соединения
      createHeartbeatEffect(getState, effectDispatch)((cleanup: () => void) => {
        effectDispatch({ type: 'SET_HEARTBEAT_CLEANUP', cleanup });
      });
    };

    es.addEventListener('open', openHandler);
    es.addEventListener('message', (event: MessageEvent) => {
      const frame = parseSSEFrame(event, currentState.subscriptions.maxListenersPerChannel);
      if (frame) effectDispatch({ type: 'MESSAGE', frame, timestamp: currentState.clock() });
    });
    es.addEventListener('error', (error: unknown) => {
      effectDispatch({ type: 'ERROR', error });
    });

    /* eslint-disable functional/no-let, fp/no-mutation -- imperativный abort listener для управления ресурсами EventSource */
    let abortListener: (() => void) | undefined;
    if (currentState.abortController) {
      const onAbort = (): void => {
        effectDispatch({ type: 'DISCONNECTED' });
      };
      currentState.abortController.signal.addEventListener('abort', onAbort);
      abortListener = (): void => {
        currentState.abortController?.signal.removeEventListener('abort', onAbort);
      };
    }

    const cleanup = (): void => {
      abortListener?.();
      es.close();
    };
    /* eslint-enable functional/no-let, fp/no-mutation */

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
export type SSESideEffectEvent =
  | { readonly type: 'CLEANUP'; readonly cleanup: () => void; }
  | { readonly type: 'TELEMETRY_CONNECT'; }
  | { readonly type: 'TELEMETRY_DISCONNECT'; }
  | { readonly type: 'TELEMETRY_RECONNECT'; readonly attempt: number; readonly delayMs: number; }
  | { readonly type: 'TELEMETRY_MESSAGE'; readonly bytes: number; }
  | { readonly type: 'TELEMETRY_ERROR'; readonly error: unknown; }
  | { readonly type: 'RECONNECT'; readonly delayMs: number; };

export type SSEEmittedEvent<TMessage = unknown> = SSEProtocolEvent<TMessage> | SSESideEffectEvent;

/* ============================================================================
 * ⚡ REDUCER (PURE FSM - NO SIDE EFFECTS, NO Date.now(), NO Math.random())
 * ========================================================================== */

export interface SSEReduceResult<T> {
  readonly newState: SSEClientState<T>;
  readonly emittedEvents: readonly SSEEmittedEvent<T>[];
}

/* eslint-disable sonarjs/cognitive-complexity -- reducer FSM по определению содержит множество веток и переходов */
export function reduceSSEState<T>(
  state: Readonly<SSEClientState<T>>,
  event: Readonly<SSEInternalEvent>,
): SSEReduceResult<T> {
  switch (event.type) {
    case 'CONNECTING':
      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            connectionState: 'CONNECTING',
          },
        },
        emittedEvents: [],
      };

    case 'CONNECTED':
      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            eventSource: event.eventSource,
          },
        },
        emittedEvents: [{ type: 'TELEMETRY_CONNECT' }],
      };

    case 'SET_CLEANUP':
      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            cleanup: event.cleanup,
          },
        },
        emittedEvents: [],
      };

    case 'SET_HEARTBEAT_CLEANUP':
      return {
        newState: {
          ...state,
          heartbeat: {
            ...state.heartbeat,
            heartbeatCleanup: event.cleanup,
          },
        },
        emittedEvents: [],
      };

    case 'START_HEARTBEAT':
      return {
        newState: {
          ...state,
          heartbeat: {
            ...state.heartbeat,
            lastHeartbeatAt: event.timestamp,
          },
        },
        emittedEvents: [],
      };

    case 'INCREMENT_RETRIES':
      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            retries: state.connection.retries + 1,
          },
        },
        emittedEvents: [],
      };

    case 'OPEN':
      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            connectionState: 'OPEN',
            retries: 0,
          },
          heartbeat: {
            ...state.heartbeat,
            lastHeartbeatAt: event.timestamp,
          },
        },
        emittedEvents: [],
      };

    case 'MESSAGE': {
      const decoded = state.decoder(event.frame, state.clock);
      if (!decoded) {
        return {
          newState: state,
          emittedEvents: [],
        };
      }

      const telemetryEvent: SSESideEffectEvent = {
        type: 'TELEMETRY_MESSAGE',
        bytes: event.frame.data.length,
      };

      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            lastEventId: decoded.id ?? state.connection.lastEventId,
          },
          heartbeat: {
            ...state.heartbeat,
            lastHeartbeatAt: event.timestamp,
          },
        },
        emittedEvents: [decoded, telemetryEvent],
      };
    }

    case 'ERROR': {
      const reconnectEvent: SSESideEffectEvent | null = shouldReconnect(state)
        ? {
          type: 'RECONNECT',
          delayMs: calculateReconnectDelayWithJitter(
            state.reconnectStrategy,
            state.connection.retries + 1,
            state.random,
          ),
        }
        : null;

      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            connectionState: 'CLOSED',
          },
        },
        emittedEvents: [
          { type: 'TELEMETRY_ERROR', error: event.error },
          ...(reconnectEvent ? [reconnectEvent] : []),
        ],
      };
    }

    case 'DISCONNECTED': {
      const cleanupEvents: readonly SSESideEffectEvent[] = [
        ...(state.connection.cleanup
          ? [{ type: 'CLEANUP' as const, cleanup: state.connection.cleanup }]
          : []),
        ...(state.heartbeat.heartbeatCleanup
          ? [{ type: 'CLEANUP' as const, cleanup: state.heartbeat.heartbeatCleanup }]
          : []),
      ];

      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            eventSource: undefined,
            connectionState: 'CLOSED',
            cleanup: undefined,
          },
          heartbeat: {
            ...state.heartbeat,
            heartbeatCleanup: undefined,
          },
        },
        emittedEvents: [
          { type: 'TELEMETRY_DISCONNECT' },
          ...cleanupEvents,
        ],
      };
    }

    case 'HEARTBEAT':
      return {
        newState: {
          ...state,
          heartbeat: {
            ...state.heartbeat,
            lastHeartbeatAt: event.timestamp,
          },
        },
        emittedEvents: [],
      };

    case 'RECONNECT_REQUEST': {
      if (!shouldReconnect(state)) {
        return {
          newState: state,
          emittedEvents: [],
        };
      }

      const nextAttempt = state.connection.retries + 1;
      const delay = calculateReconnectDelayWithJitter(
        state.reconnectStrategy,
        nextAttempt,
        state.random,
      );

      return {
        newState: {
          ...state,
          connection: {
            ...state.connection,
            retries: nextAttempt,
          },
        },
        emittedEvents: [
          {
            type: 'TELEMETRY_RECONNECT',
            attempt: nextAttempt,
            delayMs: delay,
          },
          {
            type: 'RECONNECT',
            delayMs: delay,
          },
        ],
      };
    }

    default:
      return {
        newState: state,
        emittedEvents: [],
      };
  }
}
/* eslint-enable sonarjs/cognitive-complexity */

/* ============================================================================
 * 🎮 SSE FSM Runtime
 * ========================================================================== */

/* eslint-disable functional/no-let, fp/no-mutation -- runtime состояние и reconnect-таймеры хранятся в замыкании FSM */
export function createSSERuntime<T>(
  config: Readonly<SSEClientConfig<T>>,
): {
  getState: () => SSEClientState<T>;
  dispatch: (event: SSEInternalEvent) => void;
  startEffect: (effect: SSEEffect) => EventSourceLike;
  stopEffect: () => void;
  subscribe: (topic: string, listener: (event: SSEProtocolEvent<T>) => void) => () => void;
} {
  let currentState = createInitialSSEState(config);
  const eventSourceFactory = config.eventSourceFactory;
  let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  let reconnectAbortController: AbortController | undefined;

  // Helper для cleanup reconnect
  const cleanupReconnect = (): void => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = undefined;
    }
    if (reconnectAbortController) {
      reconnectAbortController.abort();
      reconnectAbortController = undefined;
    }
  };

  const executeEffects = (events: readonly SSEEmittedEvent<T>[]): void => {
    events.forEach((emittedEvent) => {
      if (isProtocolEvent(emittedEvent)) { // protocol события → user listeners (topic = decoded.type)
        const listeners = currentState.subscriptions.listeners.get(emittedEvent.type);
        listeners?.forEach((listener) => {
          safeInvokeListener(listener, emittedEvent, currentState.logger, currentState.context);
        });
        return;
      }

      // Side effect события обрабатываем через switch
      if (!('type' in emittedEvent)) return;
      const sideEvent = emittedEvent;

      switch (sideEvent.type) {
        case 'CLEANUP':
          sideEvent.cleanup();
          break;
        case 'TELEMETRY_CONNECT':
          currentState.telemetry?.onConnect?.();
          break;
        case 'TELEMETRY_DISCONNECT':
          currentState.telemetry?.onDisconnect?.();
          break;
        case 'TELEMETRY_RECONNECT':
          currentState.telemetry?.onReconnect?.(sideEvent.attempt, sideEvent.delayMs);
          break;
        case 'TELEMETRY_MESSAGE':
          currentState.telemetry?.onMessage?.(sideEvent.bytes);
          break;
        case 'TELEMETRY_ERROR':
          currentState.telemetry?.onError?.(sideEvent.error);
          currentState.logger?.onError?.(sideEvent.error, currentState.context);
          break;
        case 'RECONNECT': // планируем переподключение с задержкой
          cleanupReconnect();
          reconnectAbortController = new AbortController();
          const signal = reconnectAbortController.signal;
          reconnectTimeout = setTimeout(() => {
            if (!signal.aborted) {
              startEffect(createSSEEffect(() => currentState, dispatch, eventSourceFactory));
            }
          }, sideEvent.delayMs);
          break;
      }
    });
  };

  const dispatch = (event: Readonly<SSEInternalEvent>): void => {
    const result = reduceSSEState(currentState, event);
    currentState = result.newState;

    // Выполняем emitted events через effect executor
    executeEffects(result.emittedEvents);
  };

  const startEffect = (effect: SSEEffect): EventSourceLike => {
    const { resource, cleanup } = effect();

    const logger: EffectLogger = currentState.logger ?? NO_OP_LOGGER;
    const loggedConnectEffect = withLogging(
      async (): Promise<{ resource: EventSourceLike; cleanup: () => void; }> => {
        dispatch({ type: 'CONNECTED', eventSource: resource }); // FSM получает владение ресурсами
        dispatch({ type: 'SET_CLEANUP', cleanup });
        await Promise.resolve();
        return { resource, cleanup };
      },
      logger,
      currentState.context,
    );
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loggedConnectEffect();
    return resource;
  };

  const stopEffect = (): void => {
    cleanupReconnect();
    dispatch({ type: 'DISCONNECTED' });
  };

  const subscribe = (
    topic: string,
    listener: (event: SSEProtocolEvent<T>) => void,
  ): () => void => {
    const validation = validateSubscriptionLimits(currentState, topic); // Memory safety: проверка лимитов
    if (!validation.valid) {
      currentState.logger?.onError?.(validation.error, currentState.context);
      return () => {}; // No-op unsubscribe
    }
    currentState = onSSEMessage(currentState, topic, listener);
    return (): void => {
      currentState = offSSEMessage(currentState, topic, listener);
    };
  };

  return {
    getState: () => currentState,
    dispatch,
    startEffect: (effect?: SSEEffect): EventSourceLike => {
      const actualEffect = effect
        ?? createSSEEffect(() => currentState, dispatch, eventSourceFactory ?? undefined);
      return startEffect(actualEffect);
    },
    stopEffect,
    subscribe,
  };
}
/* eslint-enable functional/no-let, fp/no-mutation */

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
      const now = currentState.clock();
      const timeSinceLastHeartbeat = now - currentState.heartbeat.lastHeartbeatAt;
      if (timeSinceLastHeartbeat > currentState.heartbeat.timeoutMs) { // heartbeat timeout → генерируем ERROR
        dispatch({
          type: 'ERROR',
          error: new Error(
            `Heartbeat timeout: ${timeSinceLastHeartbeat}ms > ${currentState.heartbeat.timeoutMs}ms`,
          ),
        });
      }
      // NOTE: timeoutMs может меняться динамически во время runtime,
      // поэтому используем актуальное значение на каждом тике.
    }, Math.max(1000, getState().heartbeat.timeoutMs / SSE_DEFAULTS.HEARTBEAT_CHECK_DIVISOR)); // Проверяем часто, но не чаще 1 секунды

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
  if (!shouldReconnect(state)) {
    return null;
  }

  const nextAttempt = state.connection.retries + 1;
  const delay = calculateReconnectDelayWithJitter(
    state.reconnectStrategy,
    nextAttempt,
    state.random,
  );

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
  topic: string,
  listener: (event: SSEProtocolEvent<T>) => void,
): SSEClientState<T> {
  const existing = state.subscriptions.listeners.get(topic)
    ?? new Set<(event: SSEProtocolEvent<T>) => void>();
  const updated = updateSet(existing, listener);

  return {
    ...state,
    subscriptions: {
      ...state.subscriptions,
      listeners: updateMap(state.subscriptions.listeners, topic, updated),
    },
  };
}

export function offSSEMessage<T>(
  state: Readonly<SSEClientState<T>>,
  topic: string,
  listener: (event: SSEProtocolEvent<T>) => void,
): SSEClientState<T> {
  const existing = state.subscriptions.listeners.get(topic);
  if (!existing) return state;

  const updated = deleteFromSet(existing, listener);

  const map = updated.size === 0
    ? new Map<string, ReadonlySet<(event: SSEProtocolEvent<T>) => void>>(
      [...state.subscriptions.listeners].filter(([key]) => key !== topic),
    )
    : updateMap(state.subscriptions.listeners, topic, updated);

  return {
    ...state,
    subscriptions: {
      ...state.subscriptions,
      listeners: map,
    },
  };
}
