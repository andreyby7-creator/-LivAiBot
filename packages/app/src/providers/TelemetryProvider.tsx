/**
 * @file packages/app/src/providers/TelemetryProvider.tsx
 * ============================================================================
 * 📡 TELEMETRY PROVIDER — SHELL УРОВЕНЬ ТЕЛЕМЕТРИИ
 * ============================================================================
 *
 * Назначение:
 * - Инициализация глобального telemetry клиента
 * - Контекстный тонкий API: track + flush
 * - Batch буфер (useRef) без ререндеров
 * - SSR-safe: no-op на сервере
 *
 * Принципы:
 * - Без side effects в рендере (только в эффектах)
 * - Максимальная устойчивость и отказоустойчивость
 * - Микросервисный подход: легко заменить sinks/SDK
 */

'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, PropsWithChildren } from 'react';

import {
  fireAndForget,
  getGlobalTelemetryClient,
  initTelemetry,
  isTelemetryInitialized,
} from '../lib/telemetry.js';
import type { TelemetryClient } from '../lib/telemetry.js';
import type { TelemetryConfig, TelemetryMetadata } from '../types/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Тонкий контракт TelemetryProvider для приложений. */
export type TelemetryContextType = Readonly<{
  /**
   * Логирует событие (без возврата результата).
   * @param event - Имя события
   * @param data - Метаданные (должны быть сериализуемыми)
   */
  readonly track: (event: string, data?: Readonly<Record<string, unknown>>) => void;
  /**
   * Сбрасывает batch буфер в telemetry.
   */
  readonly flush: () => void;
}>;

/** Props TelemetryProvider. */
export type TelemetryProviderProps = Readonly<
  PropsWithChildren<{
    /** Конфигурация telemetry клиента */
    readonly config?: TelemetryConfig;
    /** Включить/выключить телеметрию */
    readonly enabled?: boolean;
    /** Интервал flush (в ms) */
    readonly flushIntervalMs?: number;
    /** Максимальный размер batch до принудительного flush */
    readonly maxBatchSize?: number;
  }>
>;

/** Интервал flush по умолчанию (30 секунд). */
const DEFAULT_FLUSH_INTERVAL_MS = 30_000;
/** Размер batch по умолчанию. */
const DEFAULT_MAX_BATCH_SIZE = 25;

/** Внутренний формат события в буфере. */
type BufferedTelemetryEvent = Readonly<{
  readonly event: string;
  readonly metadata: TelemetryMetadata;
  readonly timestamp: number;
}>;

/** SSR-safe noop контекст. */
const NOOP_CONTEXT: TelemetryContextType = Object.freeze({
  track: () => undefined,
  flush: () => undefined,
});
const EMPTY_METADATA = Object.freeze({}) as TelemetryMetadata;

/* ============================================================================
 * 🧩 CONTEXT
 * ========================================================================== */

export const TelemetryContext = React.createContext<TelemetryContextType>(NOOP_CONTEXT);

/* ============================================================================
 * 🧰 UTILS
 * ========================================================================== */

type TelemetryPrimitive = string | number | boolean | null;

function isTelemetryPrimitive(value: unknown): value is TelemetryPrimitive {
  return (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
  );
}

/** Нормализует значение метаданных до допустимого примитива. */
function normalizeTelemetryValue(value: unknown): TelemetryPrimitive {
  if (isTelemetryPrimitive(value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return value.message;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.toString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Приводит метаданные к безопасному формату TelemetryMetadata. */
function normalizeMetadata(
  data?: Readonly<Record<string, unknown>>,
): TelemetryMetadata {
  if (!data) return EMPTY_METADATA;
  const normalized = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, normalizeTelemetryValue(value)]),
  ) as TelemetryMetadata;
  return Object.freeze(normalized);
}

/* ============================================================================
 * 🎯 PROVIDER
 * ========================================================================== */

function TelemetryProviderComponent({
  children,
  config,
  enabled = true,
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
}: TelemetryProviderProps): JSX.Element {
  const bufferRef = useRef<BufferedTelemetryEvent[]>([]);
  const intervalIdRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const clientRef = useRef<TelemetryClient | null>(null);
  const isClientRef = useRef(typeof window !== 'undefined');
  const effectiveMaxBatchSize = Math.max(1, maxBatchSize);

  const ensureClient = useCallback((): TelemetryClient | null => {
    if (!enabled || !isClientRef.current) return null;
    if (clientRef.current) return clientRef.current;
    if (isTelemetryInitialized()) {
      // eslint-disable-next-line functional/immutable-data
      clientRef.current = getGlobalTelemetryClient();
      return clientRef.current;
    }
    // eslint-disable-next-line functional/immutable-data
    clientRef.current = initTelemetry(config);
    return clientRef.current;
  }, [config, enabled]);

  const flush = useCallback((): void => {
    if (!enabled || !isClientRef.current) return;
    if (bufferRef.current.length === 0) return;

    const client = ensureClient();
    if (!client) return;

    const eventsToFlush = [...bufferRef.current];
    // eslint-disable-next-line functional/immutable-data
    bufferRef.current = [];

    // Порядок событий сохраняется внутри одного flush batch.
    // Между batch порядок best-effort.
    fireAndForget(async () => {
      for (const entry of eventsToFlush) {
        await client.log('INFO', entry.event, entry.metadata, entry.timestamp);
      }
    });
  }, [enabled, ensureClient]);

  const track = useCallback<TelemetryContextType['track']>((event, data) => {
    if (!enabled || !isClientRef.current) return;
    const metadata = normalizeMetadata(data);
    const entry: BufferedTelemetryEvent = Object.freeze({
      event,
      metadata,
      timestamp: Date.now(),
    });
    // eslint-disable-next-line functional/immutable-data
    bufferRef.current.push(entry);

    if (bufferRef.current.length >= effectiveMaxBatchSize) {
      flush();
    }
  }, [effectiveMaxBatchSize, enabled, flush]);

  useEffect(() => {
    if (!enabled || !isClientRef.current) return undefined;
    ensureClient();

    // eslint-disable-next-line functional/immutable-data
    intervalIdRef.current = globalThis.setInterval(() => {
      flush();
    }, flushIntervalMs);

    return (): void => {
      if (intervalIdRef.current !== null) {
        globalThis.clearInterval(intervalIdRef.current);
        // eslint-disable-next-line functional/immutable-data
        intervalIdRef.current = null;
      }
      flush();
    };
  }, [enabled, ensureClient, flush, flushIntervalMs]);

  const contextValue = useMemo<TelemetryContextType>(
    () => ({ track, flush }),
    [flush, track],
  );

  return (
    <TelemetryContext.Provider value={contextValue}>
      {children}
    </TelemetryContext.Provider>
  );
}

export const TelemetryProvider = memo(TelemetryProviderComponent);

/**
 * Хук для доступа к TelemetryContext.
 * Возвращает thin API: track + flush.
 */
export function useTelemetryContext(): TelemetryContextType {
  const context = React.useContext(TelemetryContext);
  if (process.env['NODE_ENV'] !== 'production' && context === NOOP_CONTEXT) {
    // eslint-disable-next-line no-console
    console.warn('TelemetryProvider is missing. TelemetryContext is using a noop fallback.');
  }
  return context;
}
