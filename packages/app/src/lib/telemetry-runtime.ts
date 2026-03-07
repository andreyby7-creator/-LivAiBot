/**
 * @file packages/app/src/lib/telemetry-runtime.ts
 * ============================================================================
 * 🔹 TELEMETRY RUNTIME — SINGLETON ЛОГИКА ДЛЯ RUNTIME СРЕДЫ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Singleton логика для глобального доступа к телеметрии
 * - Runtime инициализация и управление жизненным циклом
 * - Fire-and-forget API с batching и queue для throttling
 * - Middleware pipeline для pre-processing metadata
 * - Явная инициализация без скрытого coupling
 *
 * Принципы:
 * - SRP: модульная архитектура с изолированными компонентами (TelemetrySingleton, FireAndForgetQueue)
 * - Deterministic: явная инициализация, предсказуемое поведение
 * - Без скрытого coupling: явные зависимости от @livai/core/telemetry
 * - Production-ready: защита от race conditions, memory leaks, mutations, unbounded queue
 * - Testable: reset функции для unit-тестов
 *
 * Использование:
 * - Инициализация: `initTelemetry(config, middlewares?)`
 * - Получение клиента: `getGlobalTelemetryClient()`
 * - Fire-and-forget: `infoFireAndForget()`, `warnFireAndForget()`, `errorFireAndForget()`
 * - Метрики: `getFireAndForgetMetrics()`
 */

import { containsPII, TelemetryClient } from '@livai/core/telemetry';
import type {
  BatchConfig,
  TelemetryConfig,
  TelemetryLevel,
  TelemetryMetadata,
} from '@livai/core-contracts';

/* ============================================================================
 * 🔧 КОНСТАНТЫ
 * ============================================================================
 */

/**
 * Детерминированная константа для production режима.
 * Исключает runtime drift и улучшает производительность.
 */
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

/** Префикс для internal logger сообщений. */
const INTERNAL_PREFIX = '[telemetry-runtime]';

/** Максимальный размер queue для предотвращения memory leaks. */
const MAX_QUEUE_SIZE = 10_000;

/** Дефолтное значение для maxConcurrentBatches. */
const DEFAULT_MAX_CONCURRENT_BATCHES = 5;

/* ============================================================================
 * 🔧 INTERNAL LOGGER (SAFE, NO CONSOLE LEAKS)
 * ============================================================================
 */

/**
 * Internal logger для безопасного логирования ошибок fire-and-forget.
 * Абстракция над console для предотвращения leaks в CI/CD.
 */
type InternalLogger = {
  /** Логирует ошибку */
  error: (message: string, error: unknown) => void; // message: Сообщение об ошибке, error: Ошибка
};

/**
 * Создает безопасный internal logger.
 * В production использует no-op, в development - console с защитой.
 * @returns Internal logger
 */
function createInternalLogger(enabled = !IS_PRODUCTION // Включить ли логирование (по умолчанию только в development)
): InternalLogger {
  if (!enabled) {
    return {
      error: (): void => {
        // No-op в production для предотвращения console leaks
      },
    };
  }

  return {
    error: (message: string, error: unknown): void => {
      // Только в development, с защитой от отсутствия console
      /* eslint-disable no-console -- Internal logger для development */
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(`${INTERNAL_PREFIX} ${message}`, error);
      }
      /* eslint-enable no-console */
    },
  };
}

/* ============================================================================
 * 🔒 MIDDLEWARE ORCHESTRATION
 * ============================================================================
 */

/**
 * Middleware hook для pre-processing metadata перед логированием.
 * Позволяет runtime поддерживать custom telemetry middleware pipeline.
 * ВАЖНО: Output middleware проверяется на PII перед логированием.
 */
type TelemetryMiddleware = (
  metadata: TelemetryMetadata | undefined, // Метаданные события
  level: TelemetryLevel, // Уровень события
  message: string, // Сообщение события
) => TelemetryMetadata | undefined;

/**
 * Применяет pipeline middleware к metadata.
 * Защищает от mutation через structuredClone.
 * Проверяет output на PII.
 * @returns Обработанные метаданные или undefined если содержит PII
 */
function applyMiddleware(
  metadata: TelemetryMetadata | undefined, // Исходные метаданные
  level: TelemetryLevel, // Уровень события
  message: string, // Сообщение события
  middlewares: readonly TelemetryMiddleware[], // Массив middleware для применения
): TelemetryMetadata | undefined {
  if (middlewares.length === 0) {
    return metadata;
  }

  // Защита от mutation: клонируем metadata перед middleware
  let processed: TelemetryMetadata | undefined;
  if (metadata) {
    if (typeof structuredClone !== 'undefined') {
      // structuredClone возвращает глубокую копию с тем же типом
      processed = structuredClone(metadata);
    } else {
      // JSON.parse возвращает unknown, приводим к TelemetryMetadata после сериализации
      const serialized = JSON.stringify(metadata);
      const parsed: unknown = JSON.parse(serialized);
      processed = parsed as TelemetryMetadata;
    }
  } else {
    processed = undefined;
  }

  // Применяем pipeline middleware
  for (const middleware of middlewares) {
    processed = middleware(processed, level, message);
  }

  // Проверка на PII: в production - shallow, в development - deep
  const deep = !IS_PRODUCTION;
  if (processed !== undefined && containsPII(processed, deep)) {
    return undefined;
  }

  return processed;
}

/* ============================================================================
 * 🔒 TELEMETRY SINGLETON MODULE
 * ============================================================================
 */

/**
 * Изолированный модуль для управления singleton lifecycle.
 * Инкапсулирует состояние и логику инициализации.
 */
const TelemetrySingleton = ((): {
  init: (
    config?: TelemetryConfig<TelemetryMetadata>,
    middlewareArray?: readonly TelemetryMiddleware[],
  ) => TelemetryClient<TelemetryMetadata>;
  get: () => TelemetryClient<TelemetryMetadata>;
  isInitialized: () => boolean;
  getMiddlewares: () => readonly TelemetryMiddleware[];
  getInternalLogger: () => InternalLogger;
  reset: () => void;
  setForDebug: (newClient: TelemetryClient<TelemetryMetadata> | null) => void;
} => {
  let client: TelemetryClient<TelemetryMetadata> | null = null;
  let middlewares: readonly TelemetryMiddleware[] = [];
  let internalLogger: InternalLogger = createInternalLogger();

  function init(
    config?: TelemetryConfig<TelemetryMetadata>, // Конфигурация телеметрии
    middlewareArray?: readonly TelemetryMiddleware[], // Массив middleware hooks
  ): TelemetryClient<TelemetryMetadata> {
    // Если уже инициализирован, возвращаем существующий клиент
    if (client !== null) {
      if (IS_PRODUCTION) {
        throw new Error('Telemetry already initialized. Cannot reinitialize in production.');
      }

      // В development режиме предупреждаем, но позволяем переинициализацию
      internalLogger.error(
        'Telemetry already initialized. Reinitializing in development mode.',
        undefined,
      );
      return client;
    }

    // Синхронная инициализация клиента
    client = new TelemetryClient(config);

    // Настраиваем middleware pipeline
    if (middlewareArray && middlewareArray.length > 0) {
      middlewares = middlewareArray;
    }

    // Настраиваем internal logger с onError callback если предоставлен
    const onErrorCallback = config?.onError;
    if (onErrorCallback !== undefined) {
      internalLogger = {
        error: (message: string, error: unknown): void => {
          const errorEvent = {
            level: 'ERROR' as TelemetryLevel,
            message: `[fire-and-forget] ${message}`,
            timestamp: Date.now(),
          };
          onErrorCallback(error, errorEvent);
        },
      };
    } else {
      internalLogger = createInternalLogger();
    }

    return client;
  }

  function get(): TelemetryClient<TelemetryMetadata> {
    if (client === null) {
      throw new Error(
        'Telemetry not initialized. Call initTelemetry() first.',
      );
    }

    return client;
  }

  function isInitialized(): boolean {
    return client !== null;
  }

  function getMiddlewares(): readonly TelemetryMiddleware[] {
    return middlewares;
  }

  function getInternalLogger(): InternalLogger {
    return internalLogger;
  }

  function reset(): void {
    client = null;
    middlewares = [];
    internalLogger = createInternalLogger();
  }

  function setForDebug(newClient: TelemetryClient<TelemetryMetadata> | null // Клиент для установки (только для отладки)
  ): void {
    client = newClient;
  }

  return {
    init,
    get,
    isInitialized,
    getMiddlewares,
    getInternalLogger,
    reset,
    setForDebug,
  };
})();

/* ============================================================================
 * 🔥 FIRE-AND-FORGET QUEUE MODULE
 * ============================================================================
 */

/**
 * Структурированная задача для queue вместо closures.
 * Предотвращает memory leaks от больших объектов в closures.
 */
type LogTask = Readonly<{
  level: TelemetryLevel;
  message: string;
  metadata: TelemetryMetadata | undefined;
}>;

/** Конфигурация batching для fire-and-forget queue. */
type FireAndForgetQueueConfig = Readonly<{
  maxBatchSize: number;
  maxConcurrentBatches: number;
  maxQueueSize: number;
}>;

/** Метрики производительности для мониторинга queue. */
type FireAndForgetMetrics = Readonly<{
  /** Начальная длина queue перед обработкой batch */
  initialQueueLength: number;
  /** Оставшаяся длина queue после обработки */
  remainingQueueLength: number;
  /** Время обработки последнего batch в миллисекундах */
  lastBatchProcessingTimeMs: number;
  /** Количество обработанных batches */
  processedBatchesCount: number;
}>;

/** Состояние queue для fire-and-forget batching. */
type FireAndForgetQueueState = {
  queue: LogTask[];
  processing: boolean;
  config: FireAndForgetQueueConfig;
  metrics: FireAndForgetMetrics;
};

/**
 * Изолированный модуль для управления fire-and-forget queue.
 * Инкапсулирует queue engine, batching и метрики.
 */
const FireAndForgetQueue = ((): {
  init: (batchConfig?: BatchConfig) => void;
  enqueue: (task: LogTask) => void;
  getMetrics: () => FireAndForgetMetrics | null;
  reset: () => void;
} => {
  let state: FireAndForgetQueueState | null = null;

  function init(batchConfig?: BatchConfig // Конфигурация batching
  ): void {
    const config: FireAndForgetQueueConfig = {
      maxBatchSize: batchConfig?.maxBatchSize ?? 10,
      maxConcurrentBatches: batchConfig?.maxConcurrentBatches ?? DEFAULT_MAX_CONCURRENT_BATCHES,
      maxQueueSize: batchConfig?.maxQueueSize ?? MAX_QUEUE_SIZE,
    };

    state = {
      queue: [],
      processing: false,
      config,
      metrics: {
        initialQueueLength: 0,
        remainingQueueLength: 0,
        lastBatchProcessingTimeMs: 0,
        processedBatchesCount: 0,
      },
    };
  }

  function enqueue(task: LogTask // Задача для добавления в queue
  ): void {
    // Инициализируем queue если еще не инициализирована
    if (!state) {
      init();
    }

    if (!state) {
      // Fallback если инициализация не удалась
      return;
    }

    // Защита от unbounded queue: применяем drop policy
    if (state.queue.length >= state.config.maxQueueSize) {
      // Drop oldest (FIFO)
      state.queue.shift();
    }

    // Добавляем задачу в queue
    state.queue.push(task);

    // Запускаем обработку если не обрабатывается
    if (!state.processing) {
      // Используем queueMicrotask для меньшей latency
      queueMicrotask(() => {
        process().catch(() => {
          // Игнорируем ошибки обработки queue
        });
      });
    }
  }

  async function process(): Promise<void> {
    if (!state || state.processing || state.queue.length === 0) {
      return;
    }

    state.processing = true;
    const batchStartTime = Date.now();
    const initialQueueLength = state.queue.length;

    try {
      // Защита от resetGlobalTelemetryClient() между enqueue и processing
      let client: TelemetryClient<TelemetryMetadata> | null = null;
      try {
        client = TelemetrySingleton.get();
      } catch {
        // Telemetry был сброшен, прекращаем обработку
        return;
      }

      // Получаем зависимости один раз до batch loop для оптимизации
      const middlewares = TelemetrySingleton.getMiddlewares();
      const internalLogger = TelemetrySingleton.getInternalLogger();

      const { maxBatchSize, maxConcurrentBatches } = state.config;
      const batches: LogTask[][] = [];

      // Разбиваем queue на batches
      for (let i = 0; i < state.queue.length; i += maxBatchSize) {
        batches.push(state.queue.slice(i, i + maxBatchSize));
      }

      // Очищаем queue
      state.queue = [];

      // Обрабатываем batches с ограничением параллелизма
      for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
        const concurrentBatches = batches.slice(i, i + maxConcurrentBatches);

        await Promise.allSettled(
          concurrentBatches.map((batch) =>
            Promise.allSettled(
              batch.map(async (task) => {
                try {
                  // Применяем middleware pipeline (PII проверка уже включена в applyMiddleware)
                  const processedMetadata = applyMiddleware(
                    task.metadata,
                    task.level,
                    task.message,
                    middlewares,
                  );

                  await client.log(task.level, task.message, processedMetadata);
                } catch (error) {
                  internalLogger.error('Fire-and-forget error', error);
                }
              }),
            )
          ),
        );
      }

      // Обновляем метрики после обработки
      const batchProcessingTime = Date.now() - batchStartTime;
      const remainingQueueLength = state.queue.length;
      state.metrics = {
        initialQueueLength,
        remainingQueueLength,
        lastBatchProcessingTimeMs: batchProcessingTime,
        processedBatchesCount: state.metrics.processedBatchesCount + batches.length,
      };
    } finally {
      // state гарантированно не null здесь, так как проверен в начале функции
      state.processing = false;

      // Если в queue появились новые задачи, обрабатываем их
      if (state.queue.length > 0) {
        // Используем queueMicrotask для меньшей latency
        queueMicrotask(() => {
          process().catch(() => {
            // Игнорируем ошибки обработки queue
          });
        });
      }
    }
  }

  function getMetrics(): FireAndForgetMetrics | null {
    if (!state) {
      return null;
    }

    return state.metrics;
  }

  function reset(): void {
    state = null;
  }

  return {
    init,
    enqueue,
    getMetrics,
    reset,
  };
})();

/* ============================================================================
 * 🚀 RUNTIME API (ORCHESTRATION)
 * ============================================================================
 */

/**
 * Инициализирует глобальный singleton клиент телеметрии.
 * Deterministic поведение:
 * - В production: выбрасывает ошибку при повторной инициализации
 * - В development: предупреждает, но позволяет переинициализацию
 * - Синхронная инициализация (без async/Promise)
 * - Явная инициализация без скрытого coupling
 * - Поддержка middleware pipeline для pre-processing metadata
 * @returns Инициализированный singleton клиент
 * @throws Error если уже инициализирован в production режиме
 */
export function initTelemetry(
  config?: TelemetryConfig<TelemetryMetadata>, // Конфигурация телеметрии (опционально)
  middlewares?: readonly TelemetryMiddleware[], // Массив middleware hooks для pre-processing metadata (опционально)
): TelemetryClient<TelemetryMetadata> {
  const client = TelemetrySingleton.init(config, middlewares);

  // Инициализируем fire-and-forget queue (синхронно)
  FireAndForgetQueue.init(config?.batchConfig);

  return client;
}

/**
 * Получает глобальный singleton клиент телеметрии.
 * @returns Глобальный клиент телеметрии
 * @throws Error если телеметрия не инициализирована
 */
export function getGlobalTelemetryClient(): TelemetryClient<TelemetryMetadata> {
  return TelemetrySingleton.get();
}

/**
 * Проверяет, инициализирована ли телеметрия.
 * @returns true если телеметрия инициализирована, false иначе
 */
export function isTelemetryInitialized(): boolean {
  return TelemetrySingleton.isInitialized();
}

/**
 * Сбрасывает глобальный singleton клиент.
 * ВАЖНО: Только для тестов! Не использовать в production коде.
 * @internal-dev
 */
export function resetGlobalTelemetryClient(): void {
  TelemetrySingleton.reset();
  FireAndForgetQueue.reset();
}

/**
 * Устанавливает глобальный клиент для отладки/тестов.
 * ВАЖНО: Только для тестов и отладки! Не использовать в production коде.
 * @internal-dev
 */
export function setGlobalClientForDebug(
  client: TelemetryClient<TelemetryMetadata> | null, // Клиент для установки
): void {
  TelemetrySingleton.setForDebug(client);
}

/**
 * Логирует событие в fire-and-forget режиме с middleware pipeline support.
 * PII проверка выполняется внутри applyMiddleware.
 */
export function logFireAndForget(
  level: TelemetryLevel, // Уровень события
  message: string, // Сообщение события
  metadata?: TelemetryMetadata, // Метаданные события (опционально)
): void {
  if (!TelemetrySingleton.isInitialized()) {
    return; // Молча игнорируем, если не инициализировано
  }

  // Создаем структурированную задачу вместо closure
  const task: LogTask = {
    level,
    message,
    metadata,
  };

  FireAndForgetQueue.enqueue(task);
}

/**
 * Получает метрики производительности fire-and-forget queue.
 * @returns Метрики queue для мониторинга производительности
 */
export function getFireAndForgetMetrics(): FireAndForgetMetrics | null {
  return FireAndForgetQueue.getMetrics();
}

/** Логирует информационное событие в fire-and-forget режиме. */
export function infoFireAndForget(
  message: string, // Сообщение события
  metadata?: TelemetryMetadata, // Метаданные события (опционально)
): void {
  logFireAndForget('INFO', message, metadata);
}

/** Логирует предупреждение в fire-and-forget режиме. */
export function warnFireAndForget(
  message: string, // Сообщение события
  metadata?: TelemetryMetadata, // Метаданные события (опционально)
): void {
  logFireAndForget('WARN', message, metadata);
}

/** Логирует ошибку в fire-and-forget режиме. */
export function errorFireAndForget(
  message: string, // Сообщение события
  metadata?: TelemetryMetadata, // Метаданные события (опционально)
): void {
  logFireAndForget('ERROR', message, metadata);
}
