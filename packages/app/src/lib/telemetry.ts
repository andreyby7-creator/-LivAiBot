/**
 * @file packages/app/src/lib/telemetry.ts
 * ============================================================================
 * 🔹 TELEMETRY SHELL — BOOTSTRAP / REACT / INFRASTRUCTURE
 * ============================================================================
 *
 * Архитектурная роль:
 * - Application shell для телеметрии (НЕ чистое ядро)
 * - React интеграция и глобальное состояние
 * - Bootstrap логика и инициализация
 * - Infrastructure: timers, console, SDK адаптеры
 * - Thin wrapper над чистым batch-core ядром
 *
 * Свойства:
 * - контролируемая иммутабельность в shell слое
 * - поддержка асинхронных sink'ов и SDK
 * - enterprise-ready архитектура с hexagonal подходом
 * - React hooks и Context API
 * - легко тестируемое с разделением на core/shell
 */

import * as React from 'react';

import { telemetryBatchCore } from './telemetry.batch-core.js';
import { BatchCoreConfigVersion } from '../types/telemetry.js';
import type {
  TelemetryBatchCoreState,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryLevel,
  TelemetrySink,
} from '../types/telemetry.js';

/* ============================================================================
 * 🔧 УТИЛИТЫ КОНСОЛИ (только для bootstrap)
 * ========================================================================== */

const consoleLog = (...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log(...args);
};

const consoleWarn = (...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.warn(...args);
};

const consoleError = (...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.error(...args);
};

/* ============================================================================
 * 🐛 УТИЛИТЫ ОТЛАДКИ
 * ========================================================================== */

const GLOBAL_CLIENT_KEY = '__telemetryClient';

/**
 * Устанавливает глобальный клиент для отладки (только в dev режиме).
 */
const setGlobalClientForDebug = (client: TelemetryClient): void => {
  if (typeof globalThis !== 'undefined') {
    // eslint-disable-next-line functional/immutable-data
    (globalThis as typeof globalThis & Record<string, unknown>)[GLOBAL_CLIENT_KEY] = client;
  }
};

/**
 * Получает глобальный клиент для отладки.
 */
export const getGlobalClientForDebug = (): TelemetryClient | undefined => {
  if (typeof globalThis !== 'undefined') {
    return (globalThis as typeof globalThis & Record<string, unknown>)[GLOBAL_CLIENT_KEY] as
      | TelemetryClient
      | undefined;
  }
  return undefined;
};

// Для обратной совместимости - re-export уровней
export const telemetryLevels = ['INFO', 'WARN', 'ERROR'] as const;

/* ============================================================================
 * ⚖️ ПРИОРИТЕТЫ УРОВНЕЙ (O(1) ДОСТУП)
 * ========================================================================== */

// Карта приоритетов для быстрого сравнения уровней
export const levelPriority = Object.freeze(
  {
    INFO: 1, // Информационные сообщения
    WARN: 2, // Предупреждения
    ERROR: 3, // Ошибки (максимальный приоритет)
  } satisfies Record<TelemetryLevel, number>,
);

/* ============================================================================
 * 🧠 КЛИЕНТ ТЕЛЕМЕТРИИ (ПОЛНОСТЬЮ IMMUTABLE)
 * ========================================================================== */

/**
 * Enterprise-ready клиент телеметрии.
 * Принимает sinks в конструкторе, никаких мутаций после создания.
 */
export class TelemetryClient<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
> {
  private readonly sinks: readonly TelemetrySink<TMetadata>[];
  private readonly levelThreshold: TelemetryLevel;
  private readonly onError:
    | ((error: unknown, event: TelemetryEvent<TMetadata>) => void)
    | undefined;

  constructor(config: TelemetryConfig<TMetadata> = {}) {
    this.levelThreshold = config.levelThreshold ?? 'INFO';
    this.sinks = config.sinks ?? [];
    this.onError = config.onError;
  }

  // Основной метод логирования события
  async log(
    level: TelemetryLevel,
    message: string,
    metadata?: TMetadata,
    timestamp: number = Date.now(),
  ): Promise<void> {
    if (!this.shouldEmit(level)) return;

    const event: TelemetryEvent<TMetadata> = {
      level,
      message,
      timestamp,
      ...(metadata !== undefined && { metadata }),
    };

    const results = await Promise.allSettled(
      this.sinks.map((sink) => Promise.resolve(sink(event))),
    );

    // Обработка ошибок sinks
    results.forEach((result) => {
      if (result.status === 'rejected' && this.onError) {
        this.onError(result.reason, event);
      }
    });
  }

  // Сокращение для INFO уровня
  info(
    message: string,
    metadata?: TMetadata,
  ): Promise<void> {
    return this.log('INFO', message, metadata);
  }

  // Сокращение для WARN уровня
  warn(
    message: string,
    metadata?: TMetadata,
  ): Promise<void> {
    return this.log('WARN', message, metadata);
  }

  // Сокращение для ERROR уровня
  error(
    message: string,
    metadata?: TMetadata,
  ): Promise<void> {
    return this.log('ERROR', message, metadata);
  }

  // Проверка, нужно ли отправлять событие данного уровня
  private shouldEmit(level: TelemetryLevel): boolean {
    return levelPriority[level] >= levelPriority[this.levelThreshold];
  }
}

/* ============================================================================
 * 🔌 SINK'И (УРОВЕНЬ ИНФРАСТРУКТУРЫ - ТОЛЬКО BOOTSTRAP)
 * ========================================================================== */

/**
 * ПРИМЕЧАНИЕ:
 * console используется исключительно внутри createConsoleSink как
 * boundary side-effect для инфраструктуры.
 * Это единственная допустимая точка прямого I/O в данном модуле.
 */

/**
 * Создает console sink для вывода в консоль браузера/terminal'а.
 * Должен использоваться ТОЛЬКО в bootstrap коде приложения.
 */
export const createConsoleSink = (): TelemetrySink => {
  return (event: TelemetryEvent): void => {
    const prefix = `[${event.level}] ${new Date(event.timestamp).toISOString()}`;

    if (event.level === 'ERROR') {
      consoleError(prefix, event.message, event.metadata);
    } else if (event.level === 'WARN') {
      consoleWarn(prefix, event.message, event.metadata);
    } else {
      consoleLog(prefix, event.message, event.metadata);
    }
  };
};

/* ============================================================================
 * 🎣 REACT HOOK
 * ========================================================================== */

/**
 * React хук для получения клиента телеметрии.
 * Возвращает инициализированный глобальный клиент телеметрии.
 */
export function useTelemetry(): TelemetryClient {
  return getGlobalTelemetryClient();
}

/* ============================================================================
 * 🔄 FIRE-AND-FORGET HELPERS
 * ========================================================================== */

/**
 * Вспомогательная функция для fire-and-forget логирования.
 * Используется для случаев, когда результат логирования не важен.
 * В dev режиме логирует ошибки sink'ов для отладки.
 * В production молча игнорирует ошибки.
 */
export function fireAndForget(fn: () => Promise<void>): void {
  fn().catch((error) => {
    // В dev режиме логируем ошибки sink'ов для отладки
    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.warn('⚠️  Telemetry sink error (fire-and-forget):', error);
    }
    // В production молча игнорируем - ошибки логирования не должны ломать бизнес-логику
  });
}

// Проверяет, инициализирована ли telemetry
export function isTelemetryInitialized(): boolean {
  return globalClient !== null;
}

// Fire-and-forget версия log метода.
export function logFireAndForget<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  level: TelemetryLevel,
  message: string,
  metadata?: TMetadata,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() =>
    (getGlobalTelemetryClient() as TelemetryClient<TMetadata>).log(level, message, metadata)
  );
}

// Fire-and-forget версия info метода.
export function infoFireAndForget<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  message: string,
  metadata?: TMetadata,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() =>
    (getGlobalTelemetryClient() as TelemetryClient<TMetadata>).info(message, metadata)
  );
}

// Fire-and-forget версия warn метода.
export function warnFireAndForget<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  message: string,
  metadata?: TMetadata,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() =>
    (getGlobalTelemetryClient() as TelemetryClient<TMetadata>).warn(message, metadata)
  );
}

// Fire-and-forget версия error метода.
export function errorFireAndForget<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  message: string,
  metadata?: TMetadata,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() =>
    (getGlobalTelemetryClient() as TelemetryClient<TMetadata>).error(message, metadata)
  );
}

/**
 * Создает sink для внешнего SDK (PostHog, Sentry, Datadog и т.д.).
 * Должен использоваться ТОЛЬКО в bootstrap коде приложения.
 * В dev режиме логирует ошибки SDK для отладки.
 * В production молча игнорирует ошибки.
 */
export const createExternalSink = (
  sdk: { capture: (event: TelemetryEvent) => void | Promise<void>; },
): TelemetrySink => {
  if (typeof sdk.capture !== 'function') {
    throw new Error('SDK must have a capture method that is a function');
  }

  return async (event: TelemetryEvent): Promise<void> => {
    try {
      await sdk.capture(event);
    } catch (error) {
      // В dev режиме логируем ошибки SDK для отладки
      if (process.env['NODE_ENV'] === 'development') {
        // eslint-disable-next-line no-console
        console.warn('⚠️  External telemetry SDK error:', error);
      }
      // В production молча игнорируем - ошибки SDK не должны ломать приложение
    }
  };
};

/* ============================================================================
 * 🌍 ГЛОБАЛЬНЫЙ КЛИЕНТ (IMMUTABLE INSTANCE)
 * ========================================================================== */

/**
 * Singleton instance телеметрии.
 * Гарантирует единственность клиента на весь lifecycle приложения.
 * В dev режиме (HMR) повторная инициализация безопасна.
 */
let globalClient: TelemetryClient | null = null;

/**
 * Инициализирует глобальный клиент телеметрии.
 * Должна вызываться один раз при старте приложения.
 * В dev режиме (HMR) повторная инициализация безопасна и возвращает существующий клиент.
 * В production выбрасывает ошибку при повторной инициализации.
 * Автоматически добавляет console sink для разработки.
 */
export function initTelemetry(config: TelemetryConfig = {}): TelemetryClient {
  if (globalClient) {
    if (process.env['NODE_ENV'] === 'development') {
      // В dev режиме (HMR) выводим предупреждение и возвращаем существующий клиент
      // eslint-disable-next-line no-console
      console.warn(
        '⚠️  Telemetry already initialized. Skipping re-initialization (this is normal during HMR).',
      );
      return globalClient;
    } else {
      // В production выбрасываем ошибку для предотвращения случайной переинициализации
      throw new Error(
        'Telemetry already initialized. Call initTelemetry() only once per application lifecycle.',
      );
    }
  }

  // Создаем console sink - side effect живет только в bootstrap
  const consoleSink = createConsoleSink();

  const telemetryConfig: TelemetryConfig = {
    ...config,
    sinks: [consoleSink, ...(config.sinks ?? [])],
  };

  globalClient = new TelemetryClient(telemetryConfig);

  // Global access для отладки и тестирования
  setGlobalClientForDebug(globalClient);

  return globalClient;
}

/**
 * Возвращает глобальный клиент телеметрии.
 * Бросает ошибку если телеметрия не инициализирована.
 */
export function getGlobalTelemetryClient(): TelemetryClient {
  if (!globalClient) {
    throw new Error('Telemetry not initialized. Call initTelemetry() first.');
  }
  return globalClient;
}

/**
 * Сбрасывает глобальный клиент телеметрии (только для тестирования).
 * @internal
 */
export function resetGlobalTelemetryClient(): void {
  globalClient = null;
}

/* ============================================================================
 * 📦 BATCH TELEMETRY CONTEXT (для массовых форм)
 * ========================================================================== */

/**
 * Конфигурация batch телеметрии для оптимизации массовых форм
 */
// Константы для batch конфигурации
export const defaultBatchSize = 10;
export const defaultFlushInterval = 2000;

export type TelemetryBatchConfig = Readonly<{
  batchSize?: number; // Максимальный размер батча (по умолчанию 10)
  flushInterval?: number; // Интервал сброса в ms (по умолчанию 2000)
  enabled?: boolean; // Включено ли batching (по умолчанию true)
}>;

/**
 * Элемент batch телеметрии - неизменяемый
 */
export type TelemetryBatchItem = Readonly<{
  level: TelemetryLevel;
  message: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  timestamp: number;
}>;

/**
 * Context для batch телеметрии
 */
export type TelemetryBatchContextType = Readonly<{
  addToBatch: (
    level: TelemetryLevel,
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ) => void;
}>;

/**
 * React Context для batch телеметрии (null = batch не активен)
 */
export const TelemetryBatchContext = React.createContext<TelemetryBatchContextType | null>(null);

/**
 * Provider для batch телеметрии.
 * Обеспечивает контекст для компонентов внутри массовых форм.
 */
const TelemetryBatchProviderComponent: React.FC<{
  children: React.ReactNode;
  config?: TelemetryBatchConfig;
}> = ({ children, config }) => {
  const effectiveConfig = config ?? {};
  const {
    batchSize = defaultBatchSize,
    flushInterval = defaultFlushInterval,
    enabled = true,
  } = effectiveConfig;

  // Batch состояние в useRef (не вызывает ререндеры)
  const batchStateRef = React.useRef<TelemetryBatchCoreState>(
    telemetryBatchCore.createInitialState({
      maxBatchSize: batchSize,
      configVersion: BatchCoreConfigVersion,
    }),
  );
  const timeoutIdRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  // Сброс batch в телеметрию
  const flushBatch = React.useCallback((): void => {
    if (!enabled) return;

    const currentState = batchStateRef.current;
    if (currentState.batch.length === 0) return;

    const [newState, eventsToFlush] = telemetryBatchCore.flush(currentState);
    // eslint-disable-next-line functional/immutable-data
    batchStateRef.current = newState;

    // Отправка всех событий в batch
    eventsToFlush.forEach((event) => {
      logFireAndForget(event.level, event.message, event.metadata);
    });
  }, [enabled]);

  // Добавление события в batch
  const addToBatch = React.useCallback((
    level: TelemetryLevel,
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ) => {
    if (!enabled) {
      // Резервный вариант - немедленная отправка
      logFireAndForget(level, message, metadata);
      return;
    }

    // Используем чистое ядро для обновления состояния
    // eslint-disable-next-line functional/immutable-data
    batchStateRef.current = telemetryBatchCore.addEvent(
      level,
      message,
      metadata,
      Date.now(), // timestamp извне для чистоты core
    )(batchStateRef.current);

    // Проверка необходимости flush
    if (telemetryBatchCore.shouldFlush(batchStateRef.current)) {
      flushBatch();
    }

    // Запуск таймера сброса если еще не запущен
    if (timeoutIdRef.current === null) {
      const newTimeoutId = globalThis.setTimeout(() => {
        flushBatch();
        // eslint-disable-next-line functional/immutable-data
        timeoutIdRef.current = null;
      }, flushInterval);
      // eslint-disable-next-line functional/immutable-data
      timeoutIdRef.current = newTimeoutId;
    }
  }, [flushInterval, flushBatch, enabled]);

  // Очистка при размонтировании
  React.useEffect(() => {
    return (): void => {
      if (timeoutIdRef.current !== null) {
        globalThis.clearTimeout(timeoutIdRef.current);
        // eslint-disable-next-line functional/immutable-data
        timeoutIdRef.current = null;
        flushBatch();
      }
    };
  }, [flushBatch]);

  const contextValue: TelemetryBatchContextType = React.useMemo(
    () => ({ addToBatch }),
    [addToBatch],
  );

  return React.createElement(
    TelemetryBatchContext.Provider,
    { value: contextValue },
    children,
  );
};

export const TelemetryBatchProvider = TelemetryBatchProviderComponent;

/**
 * Hook для использования batch телеметрии.
 * Автоматически использует batch если доступен, иначе fallback на обычную телеметрию.
 */
export function useBatchTelemetry(): TelemetryBatchContextType['addToBatch'] {
  const batchContext = React.useContext(TelemetryBatchContext);

  // Возвращаем batch функцию если доступна, иначе fallback
  return React.useCallback((
    level: TelemetryLevel,
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ) => {
    if (batchContext) {
      batchContext.addToBatch(level, message, metadata);
    } else {
      logFireAndForget(level, message, metadata);
    }
  }, [batchContext]);
}

/**
 * Создает batch-aware sink для внешних SDK.
 * Автоматически обрабатывает batch события.
 * В dev режиме логирует ошибки SDK для отладки.
 * В production молча игнорирует ошибки.
 */
export const createBatchAwareSink = (
  sdk: {
    capture: (event: TelemetryEvent) => void | Promise<void>;
    captureBatch?: (events: TelemetryEvent[]) => void | Promise<void>;
  },
  batchConfig: TelemetryBatchConfig = {},
): TelemetrySink => {
  const { batchSize = defaultBatchSize, flushInterval = defaultFlushInterval } = batchConfig;

  // NOTE: local mutable state is intentional (imperative sink shell)
  // Batch sink - это imperative обертка над functional core для работы с внешними SDK
  let batchState = telemetryBatchCore.createInitialState({
    maxBatchSize: batchSize,
    configVersion: BatchCoreConfigVersion,
  });
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const flushBatch = async (): Promise<void> => {
    if (batchState.batch.length === 0) return;

    const [newState, eventsToFlush] = telemetryBatchCore.flush(batchState);
    batchState = newState;

    // Отправка batch как единый запрос если SDK поддерживает
    try {
      if (sdk.captureBatch && typeof sdk.captureBatch === 'function') {
        await sdk.captureBatch([...eventsToFlush]);
      } else {
        // Fallback на индивидуальную отправку
        await Promise.all(
          eventsToFlush.map((event) => Promise.resolve(sdk.capture(event))),
        );
      }
    } catch (error) {
      // В dev режиме логируем ошибки batch flush для отладки
      if (process.env['NODE_ENV'] === 'development') {
        // eslint-disable-next-line no-console
        console.warn('⚠️  Batch telemetry flush error:', error);
      }
      // В production молча игнорируем - ошибки SDK не должны ломать приложение
    }
  };

  // Сброс batch при выгрузке страницы для предотвращения потери данных
  // NOTE: listener не удаляется намеренно - createBatchAwareSink одноразовый
  // В dev режиме при HMR могут быть дубликаты, но это приемлемо для sink'а
  if (typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
    const handleBeforeUnload = (): void => {
      if (batchState.batch.length > 0) {
        // Синхронный сброс для beforeunload (нет времени на асинхронные операции)
        const [, eventsToFlush] = telemetryBatchCore.flush(batchState);
        if (sdk.captureBatch && typeof sdk.captureBatch === 'function') {
          try {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            sdk.captureBatch([...eventsToFlush]);
          } catch {
            // Игнорируем ошибки во время выгрузки
          }
        } else {
          eventsToFlush.forEach((event) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              sdk.capture(event);
            } catch {
              // Игнорируем ошибки во время выгрузки
            }
          });
        }
      }
    };

    globalThis.addEventListener('beforeunload', handleBeforeUnload);
  }

  return (event: TelemetryEvent): void | Promise<void> => {
    // Добавляем событие через чистое ядро
    batchState = telemetryBatchCore.addEvent(
      event.level,
      event.message,
      event.metadata,
      event.timestamp,
    )(batchState);

    if (telemetryBatchCore.shouldFlush(batchState)) {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      return flushBatch();
    } else {
      // Запуск таймера сброса если еще не запущен
      timeoutId ??= globalThis.setTimeout(() => {
        flushBatch().catch((error) => {
          // В dev режиме логируем ошибки batch flush для отладки
          if (process.env['NODE_ENV'] === 'development') {
            // eslint-disable-next-line no-console
            console.warn('⚠️  Batch telemetry flush error:', error);
          }
          // В production молча игнорируем
        });
        timeoutId = null;
      }, flushInterval);
    }
  };
};
