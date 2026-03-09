/**
 * @file @livai/core/src/transport/websocket.ts
 * ============================================================================
 * 🌐 WEBSOCKET CLIENT — PRODUCTION-READY WEBSOCKET RUNTIME (FUNCTIONAL FSM)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Детерминированный конечный автомат для WebSocket соединений
 * - Универсальный WebSocket runtime для всех пакетов, не привязан к app
 * - Поддержка браузера и Node.js через опциональный WebSocketFactory
 * - Полный WebSocket протокол с reconnect, exponential backoff
 *
 * Свойства:
 * - Functional FSM: без классов/this, без мутации состояния
 * - Чистые transitions: (state, onMessage) → {state, effect, attachAbortController} - только вычисление состояния
 * - Stateless handlers: handlers не знают про state, обновления через callback
 * - Effect-слой: WebSocket/таймеры/AbortController/telemetry (все side effects изолированы)
 * - Детерминированный FSM для предсказуемости и тестируемости
 * - Изолированные тестируемые side effects
 *
 * Принципы:
 * - SRP: разделение transitions (pure) и effect-слоя (side effects)
 * - Deterministic: детерминированный FSM для одинаковых входов (clock через DI)
 * - Platform-agnostic: поддержка браузера и Node.js через адаптеры
 * - Resource-safe: автоматический cleanup через AbortController с {once: true}
 * - Extensible: стратегии переподключения (computeBackoffDelay), телеметрия через DI
 * - No I/O в transitions: все side effects изолированы в effect-слое
 *
 * Использование:
 * - Создание состояния: `createInitialWebSocketState(config)`
 * - Подключение: `connectWebSocket(state, onMessage)` → возвращает [newState, wsEffect, attachAbortController]
 * - Подписка: `onWebSocketMessage(state, listener)`
 * - Отключение: `offWebSocketMessage(state, listener)`
 * - Закрытие: `closeWebSocketEffect(state, code, reason)`
 * - Отправка: `sendWebSocketMessageEffect(state, event)`
 * - Логирование через DI: передать `logger` в `WebSocketClientConfig`
 * - Node.js поддержка: передать `webSocketFactory` в `WebSocketClientConfig`
 * - Deterministic testing: передать `clock` в `WebSocketClientConfig`
 */

import type {
  EffectAbortController,
  EffectContext,
  EffectError,
  EffectLogger,
} from '@livai/core/effect';
import { sleep, withLogging } from '@livai/core/effect';

/* ============================================================================
 * 🧠 ПРОТОКОЛ И БАЗОВЫЕ ТИПЫ
 * ========================================================================== */

export type WebSocketConnectionState =
  | 'CONNECTING'
  | 'OPEN'
  | 'CLOSED';

/** Типизированное событие WebSocket. */
export interface WebSocketEvent<TPayload = unknown> {
  readonly type: string;
  readonly timestamp: number;
  readonly payload: TPayload;
}

/**
 * Абстракция WebSocket для поддержки браузера и Node.js.
 * В браузере используется нативный WebSocket, в Node.js требуется полифилл или адаптер.
 */
export interface WebSocketLike {
  readonly readyState: number;
  readonly url: string;
  readonly protocol: string;
  readonly CONNECTING: number;
  readonly OPEN: number;
  readonly CLOSING: number;
  readonly CLOSED: number;
  addEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: Event | MessageEvent | CloseEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: Event | MessageEvent | CloseEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
}

/**
 * Фабрика для создания WebSocket-подобного объекта.
 * В браузере возвращает нативный WebSocket, в Node.js может использовать полифилл или адаптер.
 * NOTE (Node.js адаптер):
 * - должен фильтровать sensitive headers (auth, cookies и т.п.)
 * - не должен пробрасывать необязательные данные «как есть» без валидации
 * - должен логировать ошибки создания WebSocket безопасно (без утечки секретов)
 */
export type WebSocketFactory = (
  url: string,
  options?: {
    readonly protocols?: string | string[];
    readonly headers?: Readonly<Record<string, string>>;
    readonly signal?: AbortSignal;
  },
) => WebSocketLike;

/** Runtime clock для детерминированного тестирования. */
export type RuntimeClock = () => number;

/* ============================================================================
 * 🧱 STATE
 * ========================================================================== */

/** Immutable состояние клиента. */
export interface WebSocketClientState<TMessage = unknown> {
  readonly url: string;
  readonly ws: WebSocketLike | undefined;
  readonly connectionState: WebSocketConnectionState;

  readonly autoReconnect: boolean;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly retryBackoffFactor: number;
  readonly retries: number;

  readonly listeners: Set<(event: WebSocketEvent<TMessage>) => void>;

  readonly abortController: EffectAbortController | undefined;
  readonly context: EffectContext | undefined;
  readonly logger: EffectLogger | undefined;
  readonly clock: RuntimeClock;
  readonly webSocketFactory: WebSocketFactory;
}

/* ============================================================================
 * 🧩 CONFIG
 * ========================================================================== */

/** Конфигурация клиента. */
export interface WebSocketClientConfig {
  readonly url: string;
  readonly autoReconnect?: boolean;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly retryBackoffFactor?: number;
  readonly abortController?: EffectAbortController;
  readonly context?: EffectContext;
  readonly logger?: EffectLogger;
  readonly webSocketFactory?: WebSocketFactory;
  readonly clock?: RuntimeClock;
}

/* ============================================================================
 * 🧱 DEFAULTS
 * ========================================================================== */

const DEFAULT_MAX_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 30_000; // Максимальный delay 30 секунд
const MAX_WS_MESSAGE_SIZE = 1_000_000; // 1MB — ограничение размера входящих сообщений

/** Вычисляет delay для reconnect с exponential backoff (ограничен MAX_RETRY_DELAY_MS). */
function computeBackoffDelay<T>(state: WebSocketClientState<T>): number {
  return Math.min(
    state.retryDelayMs * Math.pow(state.retryBackoffFactor, state.retries - 1),
    MAX_RETRY_DELAY_MS,
  );
}

/**
 * Дефолтная фабрика WebSocket для браузера.
 * В Node.js требуется передать кастомную фабрику через конфиг.
 * NOTE: В браузере WebSocket не поддерживает headers/signal; расширенный интерфейс
 * предназначен для Node.js-адаптеров, которые сами отвечают за фильтрацию sensitive headers.
 * Abort signal обрабатывается отдельным effect, factory не должен знать про abort.
 */
function defaultWebSocketFactory(
  url: string,
  options?: {
    readonly protocols?: string | string[];
    readonly headers?: Readonly<Record<string, string>>;
    readonly signal?: AbortSignal;
  },
): WebSocketLike {
  if (typeof WebSocket === 'undefined') {
    // eslint-disable-next-line fp/no-throw -- критическая конфигурационная ошибка среды, без WebSocket нельзя работать
    throw new Error(
      'WebSocket is not available. In Node.js, provide a custom webSocketFactory in WebSocketClientConfig.',
    );
  }
  // WebSocket не поддерживает headers и signal в браузере, но интерфейс расширяем для Node.js адаптеров
  return new WebSocket(
    url,
    options?.protocols,
  ) as WebSocketLike;
}

/* ============================================================================
 * 🧱 INITIAL STATE
 * ========================================================================== */

/** Создает начальное immutable состояние клиента. */
export function createInitialWebSocketState<TMessage>(
  config: Readonly<WebSocketClientConfig>,
): WebSocketClientState<TMessage> {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inline clock фабрика только для дефолта
  const clock = config.clock ?? (() => Date.now());
  const webSocketFactory = config.webSocketFactory ?? defaultWebSocketFactory;
  return {
    url: config.url,
    ws: undefined,
    connectionState: 'CLOSED',

    autoReconnect: config.autoReconnect ?? true,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryDelayMs: config.retryDelayMs ?? 1_000,
    retryBackoffFactor: config.retryBackoffFactor ?? 2,
    retries: 0,

    listeners: new Set<(event: WebSocketEvent<TMessage>) => void>(),
    abortController: config.abortController,
    context: config.context,
    logger: config.logger,
    clock,
    webSocketFactory,
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
  ws?: WebSocketLike,
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
export interface WebSocketHandlers {
  readonly open: (context?: EffectContext) => void;
  readonly message: (event: MessageEvent, context?: EffectContext) => void;
  readonly close: (context?: EffectContext) => Promise<void> | void;
  readonly error?: (event: Event, context?: EffectContext) => void;
}

/** Effect который создает и инициализирует WebSocket. Возвращает функцию, которая при вызове выполняет side effect. */
export type WebSocketEffect = () => WebSocketLike;

/** Создает Effect для WebSocket соединения. Side effect изолирован в возвращаемой функции. */
export function createWebSocketEffect(
  url: string,
  handlers: WebSocketHandlers,
  context?: EffectContext,
  factory?: WebSocketFactory,
): WebSocketEffect {
  const webSocketFactory = factory ?? defaultWebSocketFactory;
  return () => {
    const ws = webSocketFactory(url);

    ws.addEventListener('open', () => {
      handlers.open(context);
    });
    ws.addEventListener('message', (event) => {
      handlers.message(event as MessageEvent, context);
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

function createAttachAbortControllerEffect(
  abortController: EffectAbortController | undefined,
): (ws: WebSocketLike) => void {
  if (!abortController) {
    return () => {};
  }
  return (ws: WebSocketLike): void => {
    abortController.signal.addEventListener('abort', (): void => {
      ws.close();
    }, { once: true });
  };
}

/* ============================================================================
 * ⚡ STATE TRANSITIONS (ЧИСТЫЕ ФУНКЦИИ)
 * ========================================================================== */

/** Создает команду для открытия соединения. Возвращает новое состояние, effect для выполнения и effect для привязки AbortController. */
export function connectWebSocket<T>(
  state: WebSocketClientState<T>,
  onMessage: (event: WebSocketEvent<T>) => void,
): [WebSocketClientState<T>, WebSocketEffect, (ws: WebSocketLike) => void] {
  // Создаем handlers для обработки событий (stateless, через callback)
  const handlers: WebSocketHandlers = {
    open: () => {
      // Соединение открыто - логика состояния обрабатывается на уровне машины
      // Здесь только уведомление, без прямых мутаций состояния
    },

    message: (msg: MessageEvent) => {
      try {
        /* eslint-disable ai-security/model-poisoning */
        // WebSocket payload (msg.data) валидируется по типу и размеру; далее используется только
        // для парсинга JSON, который сам отвечает за валидацию структуры.
        const rawDataUnknown: unknown = msg.data;
        if (typeof rawDataUnknown !== 'string') {
          return; // ai-security/model-poisoning: отбрасываем нетекстовые payload'ы
        }
        const rawData = rawDataUnknown;
        // Ограничение размера для предотвращения memory pressure (аналогично SSE maxFrameSize)
        if (rawData.length > MAX_WS_MESSAGE_SIZE) {
          return; // Security: отбрасываем слишком большие сообщения
        }
        const parsed = JSON.parse(rawData) as unknown;
        // Cheap guard для структуры event
        if (
          typeof parsed !== 'object'
          || parsed === null
          || typeof (parsed as { type?: unknown; }).type !== 'string'
        ) {
          return; // Игнорировать некорректную структуру
        }
        const event = parsed as WebSocketEvent<T>;
        /* eslint-enable ai-security/model-poisoning */
        onMessage(event);
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
  const wsEffect = createWebSocketEffect(
    state.url,
    handlers,
    state.context,
    state.webSocketFactory,
  );

  const attachAbortController = createAttachAbortControllerEffect(
    state.abortController,
  );

  // Возвращаем новое состояние, effect подключения и effect для привязки AbortController
  const newState = setConnectionState(state, 'CONNECTING');
  return [newState, wsEffect, attachAbortController];
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
    // Callback для доставки сообщений подписчикам при reconnect
    const deliverToListeners = (event: WebSocketEvent<T>): void => {
      [...nextState.listeners].forEach((fn): void => {
        fn(event);
      });
    };
    const [
      reconnectState,
      reconnectEffect,
      attachAbortController,
    ] = connectWebSocket(nextState, deliverToListeners);

    // Создаем effect с exponential backoff delay
    const delayMs = computeBackoffDelay(nextState);
    const delayedReconnectEffect = async (): Promise<void> => {
      await sleep(delayMs, nextState.abortController?.signal);
      const ws = reconnectEffect();
      attachAbortController(ws);
    };

    // Обертка для соблюдения no-floating-promises правила
    const safeDelayedReconnectEffect: () => Promise<void> = async (): Promise<void> => {
      try {
        await delayedReconnectEffect();
      } catch (error) {
        // Логируем ошибки reconnect через DI logger если доступен
        nextState.logger?.onError?.(
          error,
          nextState.context,
        );
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

/** Transition: привязывает WebSocket instance к состоянию. Чистая функция, возвращает новое состояние. */
export function attachWebSocketInstance<T>(
  state: WebSocketClientState<T>,
  ws: WebSocketLike,
): WebSocketClientState<T> {
  return setWebSocket(state, ws);
}

/** Эффект: закрывает соединение. Side-effect функция, возвращает новое состояние. */
export function closeWebSocketEffect<T>(
  state: WebSocketClientState<T>,
  code?: number,
  reason?: string,
): WebSocketClientState<T> {
  // Side-effect: закрыть WebSocket соединение с логированием
  const closeEffect = async (): Promise<void> => {
    state.ws?.close(code, reason);
    await Promise.resolve();
  };
  if (state.logger) {
    const loggedCloseEffect = withLogging(closeEffect, state.logger, state.context);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Promise игнорируется для соблюдения контракта функции
    loggedCloseEffect();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Promise игнорируется для соблюдения контракта функции
    closeEffect();
  }
  return setWebSocket(state, undefined);
}

/** Эффект: отправляет сообщение. Side-effect функция, возвращает состояние без изменений. */
export function sendWebSocketMessageEffect<T>(
  state: WebSocketClientState<T>,
  event: WebSocketEvent<T>,
): WebSocketClientState<T> {
  const ws = state.ws;
  if (!ws || ws.readyState !== ws.OPEN) {
    const error: EffectError = {
      kind: 'Network',
      message: 'WebSocket is not open',
      ...(ws?.readyState !== undefined && { status: ws.readyState }),
    };
    // eslint-disable-next-line fp/no-throw -- критическая ошибка состояния, должна быть обработана вызывающим кодом
    throw error;
  }

  // Side-effect: отправить сообщение через WebSocket с error handling и логированием
  const sendEffect = async (): Promise<void> => {
    try {
      // После проверки readyState мы знаем, что ws определен
      ws.send(JSON.stringify(event));
      await Promise.resolve();
    } catch (error) {
      // Safety: если WebSocket закрыт между проверкой и отправкой
      const errorMessage = error instanceof Error ? error.message : String(error);
      const wsError: EffectError = {
        kind: 'Network',
        message: `Failed to send WebSocket message: ${errorMessage}`,
        status: ws.readyState,
        payload: error,
      };
      // eslint-disable-next-line fp/no-throw -- критическая ошибка отправки, должна быть обработана вызывающим кодом
      throw wsError;
    }
  };

  if (state.logger) {
    const loggedSendEffect = withLogging(sendEffect, state.logger, state.context);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Promise игнорируется для соблюдения контракта функции
    loggedSendEffect();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- Promise игнорируется для соблюдения контракта функции
    sendEffect();
  }

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
