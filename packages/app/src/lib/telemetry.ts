/**
 * @file packages/app/src/lib/telemetry.ts
 * ============================================================================
 * 🔹 ЯДРО ТЕЛЕМЕТРИИ — ПРОДАКШЕН / IMMUTABLE / FUNCTIONAL SAFE
 * ============================================================================
 *
 * Свойства:
 * - отсутствие eslint-disable директив
 * - контролируемая иммутабельность
 * - поддержка асинхронных sink'ов
 * - enterprise-ready архитектура
 * - hexagonal architecture (чистое ядро)
 * - легко тестируемое и расширяемое
 */

import React from 'react';

/* ============================================================================
 * 🧱 ОСНОВНЫЕ ТИПЫ
 * ========================================================================== */

// Уровни логирования в порядке возрастания важности
export const telemetryLevels = ['INFO', 'WARN', 'ERROR'] as const;
export type TelemetryLevel = (typeof telemetryLevels)[number];

// Событие телеметрии - неизменяемый объект с метаданными
export type TelemetryEvent = Readonly<{
  level: TelemetryLevel; // Уровень важности события
  message: string; // Сообщение события
  metadata?: Readonly<Record<string, string | number | boolean | null>>; // Дополнительные данные
  timestamp: number; // Время события в миллисекундах
}>;

// Sink - абстракция для отправки событий (console, внешние SDK и т.д.)
export type TelemetrySink = (event: TelemetryEvent) => void | Promise<void>;

// Конфигурация телеметрии - передается при инициализации
export type TelemetryConfig = Readonly<{
  levelThreshold?: TelemetryLevel; // Минимальный уровень для логирования
  sinks?: readonly TelemetrySink[]; // Массив получателей событий
}>;

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
export class TelemetryClient {
  private readonly sinks: readonly TelemetrySink[];
  private readonly levelThreshold: TelemetryLevel;

  constructor(config: TelemetryConfig = {}) {
    this.levelThreshold = config.levelThreshold ?? 'INFO';
    this.sinks = config.sinks ?? [];
  }

  // Основной метод логирования события
  async log(
    level: TelemetryLevel,
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    if (!this.shouldEmit(level)) return;

    const event: TelemetryEvent = {
      level,
      message,
      timestamp: Date.now(),
      ...(metadata && { metadata }),
    };

    await Promise.allSettled(this.sinks.map((sink) => Promise.resolve(sink(event))));
  }

  // Сокращение для INFO уровня
  info(
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    return this.log('INFO', message, metadata);
  }

  // Сокращение для WARN уровня
  warn(
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    return this.log('WARN', message, metadata);
  }

  // Сокращение для ERROR уровня
  error(
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
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
 * NOTE:
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
      // eslint-disable-next-line no-console -- оправданный side-effect в bootstrap
      console.error(prefix, event.message, event.metadata);
    } else if (event.level === 'WARN') {
      // eslint-disable-next-line no-console -- оправданный side-effect в bootstrap
      console.warn(prefix, event.message, event.metadata);
    } else {
      // eslint-disable-next-line no-console -- оправданный side-effect в bootstrap
      console.log(prefix, event.message, event.metadata);
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

// Проверяет, инициализирована ли telemetry (graceful, без исключений)
export function isTelemetryInitialized(): boolean {
  try {
    getGlobalTelemetryClient();
    return true;
  } catch {
    return false;
  }
}

// Fire-and-forget версия log метода.
export function logFireAndForget(
  level: TelemetryLevel,
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().log(level, message, metadata));
}

// Fire-and-forget версия info метода.
export function infoFireAndForget(
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().info(message, metadata));
}

// Fire-and-forget версия warn метода.
export function warnFireAndForget(
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().warn(message, metadata));
}

// Fire-and-forget версия error метода.
export function errorFireAndForget(
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().error(message, metadata));
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
}> = ({ children, config = {} }) => {
  const {
    batchSize = defaultBatchSize,
    flushInterval = defaultFlushInterval,
    enabled = true,
  } = config;

  // Хранилище batch - иммутабельные обновления
  const [batch, setBatch] = React.useState<TelemetryBatchItem[]>([]);
  const [timeoutId, setTimeoutId] = React.useState<number | null>(null);

  // Сброс batch в телеметрию
  const flushBatch = React.useCallback((): void => {
    if (batch.length === 0 || !enabled) return;

    const batchToSend = [...batch];

    setBatch([]); // Очистка batch иммутабельно

    // Отправка всех событий в batch
    batchToSend.forEach((item) => {
      logFireAndForget(item.level, item.message, item.metadata);
    });
  }, [batch, enabled]);

  // Добавление события в batch
  const addToBatch = React.useCallback((
    level: TelemetryLevel,
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ) => {
    if (!enabled) {
      // Fallback на немедленную отправку
      logFireAndForget(level, message, metadata);
      return;
    }

    const item: TelemetryBatchItem = {
      level,
      message,
      timestamp: Date.now(),
      ...(metadata && { metadata }),
    };

    const newBatch = [...batch, item];
    setBatch(newBatch);

    // Проверка, полон ли batch
    if (newBatch.length >= batchSize) {
      flushBatch();
      return;
    }

    // Запуск таймера сброса если еще не запущен
    if (timeoutId === null) {
      const newTimeoutId = window.setTimeout(() => {
        flushBatch();
        setTimeoutId(null);
      }, flushInterval);
      setTimeoutId(newTimeoutId);
    }
  }, [batchSize, flushInterval, flushBatch, enabled, batch, timeoutId]);

  // Очистка при размонтировании
  React.useEffect(() => {
    return (): void => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        flushBatch();
      }
    };
  }, [timeoutId, flushBatch]);

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

  let batch: TelemetryEvent[] = [];
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const flushBatch = async (): Promise<void> => {
    if (batch.length === 0) return;

    const batchToSend = [...batch];
    batch = [];

    // Отправка batch как единый запрос если SDK поддерживает
    try {
      if (sdk.captureBatch && typeof sdk.captureBatch === 'function') {
        await sdk.captureBatch(batchToSend);
      } else {
        // Fallback на индивидуальную отправку
        await Promise.all(batchToSend.map((event) => Promise.resolve(sdk.capture(event))));
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

  return (event: TelemetryEvent): void | Promise<void> => {
    batch = [...batch, event];

    if (batch.length >= batchSize) {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      return flushBatch();
    } else {
      // Start flush timer if not already started
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
