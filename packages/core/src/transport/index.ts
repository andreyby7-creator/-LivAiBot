/**
 * @file @livai/core/transport — Transport Layer (SSE, WebSocket)
 * Публичный API пакета transport.
 * Экспортирует все публичные компоненты, типы и утилиты для транспортных протоколов.
 */

/* ============================================================================
 * 🔌 SSE CLIENT — SSE STREAMING RUNTIME
 * ========================================================================== */

/**
 * SSE Client: production-ready SSE runtime как детерминированный конечный автомат.
 * Включает FSM-based архитектуру, resumability, heartbeat, reconnect с jitter,
 * подписки, декодер и телеметрию.
 * Поддерживает браузер и Node.js через опциональный EventSourceFactory.
 * @public
 */

export type {
  EventSourceFactory,
  EventSourceLike,
  HeartbeatEffect,
  ReconnectStrategy,
  RuntimeClock,
  RuntimeRandom,
  SSEClientConfig,
  SSEClientState,
  SSEConnection,
  SSEConnectionState,
  SSEDecoder,
  SSEDispatch,
  SSEEffect,
  SSEEmittedEvent,
  SSEFrame,
  SSEHeartbeat,
  SSEInternalEvent,
  SSEProtocolEvent,
  SSEReduceResult,
  SSESideEffectEvent,
  SSESubscriptions,
  SSETelemetry,
} from './sse-client.js';

export {
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
} from './sse-client.js';
