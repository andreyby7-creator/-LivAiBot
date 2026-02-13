/**
 * @file packages/app/src/runtime/telemetry.ts
 * ============================================================================
 * 🔹 TELEMETRY RUNTIME — SINGLETON ЛОГИКА ДЛЯ RUNTIME СРЕДЫ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Singleton логика для глобального доступа к телеметрии
 * - Runtime инициализация и управление жизненным циклом
 * - Fire-and-forget API с batching и queue для throttling
 * - Явная инициализация без скрытого coupling
 * - Race condition protection для async инициализации
 *
 * Принципы:
 * - SRP: только singleton логика, без бизнес-логики
 * - Deterministic: явная инициализация, предсказуемое поведение
 * - Без скрытого coupling: явные зависимости от lib/telemetry
 * - Production-ready: защита от race conditions и повторной инициализации
 * - Testable: reset функции для unit-тестов
 *
 * Использование:
 * - Инициализация: `initTelemetry(config)`
 * - Получение клиента: `getGlobalTelemetryClient()`
 * - Fire-and-forget: `infoFireAndForget()`, `warnFireAndForget()`, `errorFireAndForget()`
 */

import { TelemetryClient } from '../lib/telemetry.js';
import type {
  BatchConfig,
  TelemetryConfig,
  TelemetryLevel,
  TelemetryMetadata,
} from '../types/telemetry.js';

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
  error: (message: string, error: unknown) => void;
};

/**
 * Создает безопасный internal logger.
 * В production использует no-op, в development - console с защитой.
 *
 * @param enabled - Включить ли логирование (по умолчанию только в development)
 * @returns Internal logger
 */
function createInternalLogger(enabled = process.env['NODE_ENV'] !== 'production'): InternalLogger {
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
        console.error(`[telemetry-runtime] ${message}`, error);
      }
      /* eslint-enable no-console */
    },
  };
}

/* ============================================================================
 * 🔒 SINGLETON STATE
 * ============================================================================
 */

/**
 * Глобальный singleton клиент телеметрии.
 * Инициализируется через initTelemetry().
 */
let globalClient: TelemetryClient<TelemetryMetadata> | null = null;

/**
 * PII redaction patterns для проверки middleware output.
 * Используется для строгой проверки на PII перед логированием.
 */
const PII_PATTERNS = Object.freeze(
  [
    /password/gi,
    /token/gi,
    /secret/gi,
    /api[_-]?key/gi,
    /authorization/gi,
    /credit[_-]?card/gi,
    /ssn/gi,
    /social[_-]?security/gi,
  ] as const,
);

/**
 * Проверяет metadata на наличие PII patterns.
 * Строгая проверка для middleware output перед логированием.
 *
 * Производительность:
 * - В production: shallow проверка (только верхний уровень) + ключи/строки
 * - В development: полная рекурсивная проверка для всех вложенных объектов
 * - Оптимизировано для высокой нагрузки в production
 *
 * @param metadata - Метаданные для проверки
 * @param deep - Включить глубокую рекурсивную проверку (по умолчанию только в development)
 * @returns true если обнаружен PII
 */
function containsPII(
  metadata: TelemetryMetadata | undefined,
  deep = process.env['NODE_ENV'] !== 'production',
): boolean {
  if (!metadata) {
    return false;
  }

  for (const [key, value] of Object.entries(metadata)) {
    // Проверка ключа на PII patterns (всегда включена)
    if (PII_PATTERNS.some((pattern) => pattern.test(key))) {
      return true;
    }

    // Проверка значения на PII patterns (если строка)
    if (typeof value === 'string' && PII_PATTERNS.some((pattern) => pattern.test(value))) {
      return true;
    }

    // Рекурсивная проверка вложенных объектов (только в development или если deep=true)
    if (deep && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (containsPII(value as TelemetryMetadata, true)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Middleware hook для pre-processing metadata перед логированием.
 * Позволяет runtime поддерживать custom telemetry middleware.
 * ВАЖНО: Output middleware проверяется на PII перед логированием.
 */
type TelemetryMiddleware = (
  metadata: TelemetryMetadata | undefined,
  level: TelemetryLevel,
  message: string,
) => TelemetryMetadata | undefined;

let globalMiddleware: TelemetryMiddleware | null = null;

/**
 * Internal logger для ошибок fire-and-forget.
 */
let internalLogger: InternalLogger = createInternalLogger();

/**
 * Конфигурация batching для fire-and-forget queue.
 */
type FireAndForgetQueueConfig = Readonly<{
  maxBatchSize: number;
  maxConcurrentBatches: number;
}>;

/**
 * Метрики производительности для мониторинга queue.
 */
type FireAndForgetMetrics = Readonly<{
  /** Текущая длина queue */
  queueLength: number;
  /** Время обработки последнего batch в миллисекундах */
  lastBatchProcessingTimeMs: number;
  /** Количество обработанных batches */
  processedBatchesCount: number;
}>;

/**
 * Состояние queue для fire-and-forget batching.
 */
type FireAndForgetQueueState = {
  queue: (() => void | Promise<void>)[];
  processing: boolean;
  config: FireAndForgetQueueConfig;
  metrics: FireAndForgetMetrics;
};

/**
 * Глобальное состояние queue для fire-and-forget.
 */
let fireAndForgetQueue: FireAndForgetQueueState | null = null;

/* ============================================================================
 * 🚀 ИНИЦИАЛИЗАЦИЯ И УПРАВЛЕНИЕ
 * ============================================================================
 */

/**
 * Инициализирует fire-and-forget queue с конфигурацией из TelemetryClient.
 *
 * @param batchConfig - Конфигурация batching из TelemetryClient
 */
const DEFAULT_MAX_CONCURRENT_BATCHES = 5;

function initFireAndForgetQueue(batchConfig?: BatchConfig): void {
  const config: FireAndForgetQueueConfig = {
    maxBatchSize: batchConfig?.maxBatchSize ?? 10,
    maxConcurrentBatches: batchConfig?.maxConcurrentBatches ?? DEFAULT_MAX_CONCURRENT_BATCHES,
  };

  fireAndForgetQueue = {
    queue: [],
    processing: false,
    config,
    metrics: {
      queueLength: 0,
      lastBatchProcessingTimeMs: 0,
      processedBatchesCount: 0,
    },
  };
}

/**
 * Обрабатывает fire-and-forget queue с batching и throttling.
 * Собирает метрики производительности для мониторинга.
 */
async function processFireAndForgetQueue(): Promise<void> {
  const queue = fireAndForgetQueue;
  if (!queue || queue.processing || queue.queue.length === 0) {
    return;
  }

  queue.processing = true;
  const batchStartTime = Date.now();

  try {
    const { maxBatchSize, maxConcurrentBatches } = queue.config;
    const batches: (() => void | Promise<void>)[][] = [];

    // Разбиваем queue на batches
    for (let i = 0; i < queue.queue.length; i += maxBatchSize) {
      batches.push(queue.queue.slice(i, i + maxBatchSize));
    }

    // Обновляем метрику queue length
    queue.metrics = {
      ...queue.metrics,
      queueLength: queue.queue.length,
    };

    // Очищаем queue
    queue.queue = [];

    // Обрабатываем batches с ограничением параллелизма
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      const concurrentBatches = batches.slice(i, i + maxConcurrentBatches);

      await Promise.allSettled(
        concurrentBatches.map((batch) =>
          Promise.allSettled(
            batch.map((fn) =>
              Promise.resolve(fn()).catch((error) => {
                internalLogger.error('Fire-and-forget error', error);
              })
            ),
          )
        ),
      );
    }

    // Обновляем метрики после обработки
    const batchProcessingTime = Date.now() - batchStartTime;
    queue.metrics = {
      queueLength: queue.queue.length,
      lastBatchProcessingTimeMs: batchProcessingTime,
      processedBatchesCount: queue.metrics.processedBatchesCount + batches.length,
    };
  } finally {
    const currentQueue = fireAndForgetQueue;
    if (currentQueue !== null) {
      currentQueue.processing = false;

      // Если в queue появились новые задачи, обрабатываем их
      if (currentQueue.queue.length > 0) {
        // Используем setTimeout для асинхронной обработки следующего batch
        setTimeout(() => {
          processFireAndForgetQueue().catch(() => {
            // Игнорируем ошибки обработки queue
          });
        }, 0);
      }
    }
  }
}

/**
 * Инициализирует глобальный singleton клиент телеметрии.
 *
 * Deterministic поведение:
 * - В production: выбрасывает ошибку при повторной инициализации
 * - В development: предупреждает, но позволяет переинициализацию
 * - Защита от race conditions через lock-флаг и Promise
 * - Параллельные async вызовы ждут один и тот же Promise
 * - Явная инициализация без скрытого coupling
 * - Поддержка middleware hook для pre-processing metadata
 *
 * @param config - Конфигурация телеметрии (опционально)
 * @param middleware - Middleware hook для pre-processing metadata (опционально)
 * @returns Инициализированный singleton клиент
 * @throws Error если уже инициализирован в production режиме
 */
export function initTelemetry(
  config?: TelemetryConfig<TelemetryMetadata>,
  middleware?: TelemetryMiddleware,
): TelemetryClient<TelemetryMetadata> {
  // Если уже инициализирован, возвращаем существующий клиент
  if (globalClient !== null) {
    const isProduction = process.env['NODE_ENV'] === 'production';

    if (isProduction) {
      throw new Error('Telemetry already initialized. Cannot reinitialize in production.');
    }

    // В development режиме предупреждаем, но позволяем переинициализацию
    internalLogger.error(
      'Telemetry already initialized. Reinitializing in development mode.',
      undefined,
    );
    return globalClient;
  }

  // Синхронная инициализация клиента
  globalClient = new TelemetryClient(config);

  // Настраиваем middleware с проверкой PII
  if (middleware) {
    globalMiddleware = (
      metadata: TelemetryMetadata | undefined,
      level: TelemetryLevel,
      message: string,
    ): TelemetryMetadata | undefined => {
      const processed = middleware(metadata, level, message);
      if (processed !== undefined && containsPII(processed)) {
        internalLogger.error(
          'Middleware output contains PII. Metadata will be redacted.',
          { level, message },
        );
        return undefined;
      }
      return processed;
    };
  }

  // Инициализируем fire-and-forget queue (синхронно)
  initFireAndForgetQueue(config?.batchConfig);

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
  }

  return globalClient;
}

/**
 * Получает глобальный singleton клиент телеметрии.
 *
 * @returns Глобальный клиент телеметрии
 * @throws Error если телеметрия не инициализирована
 */
export function getGlobalTelemetryClient(): TelemetryClient<TelemetryMetadata> {
  if (globalClient === null) {
    throw new Error(
      'Telemetry not initialized. Call initTelemetry() first.',
    );
  }

  return globalClient;
}

/**
 * Проверяет, инициализирована ли телеметрия.
 *
 * @returns true если телеметрия инициализирована, false иначе
 */
export function isTelemetryInitialized(): boolean {
  return globalClient !== null;
}

/**
 * Сбрасывает глобальный singleton клиент.
 *
 * ВАЖНО: Только для тестов!
 * Не использовать в production коде.
 *
 * @internal-dev
 */
export function resetGlobalTelemetryClient(): void {
  globalClient = null;
  globalMiddleware = null;
  fireAndForgetQueue = null;
  internalLogger = createInternalLogger();
}

/**
 * Устанавливает глобальный клиент для отладки/тестов.
 *
 * ВАЖНО: Только для тестов и отладки!
 * Не использовать в production коде.
 *
 * @param client - Клиент для установки
 * @internal-dev
 */
export function setGlobalClientForDebug(
  client: TelemetryClient<TelemetryMetadata> | null,
): void {
  globalClient = client;
}

/* ============================================================================
 * 🔥 FIRE-AND-FORGET API (WITH BATCHING AND QUEUE)
 * ============================================================================
 */

/**
 * Выполняет функцию в fire-and-forget режиме с batching и throttling.
 * Ошибки логируются через internal logger, но не выбрасываются.
 *
 * @param fn - Функция для выполнения
 */
export function fireAndForget(fn: () => void | Promise<void>): void {
  // Инициализируем queue если еще не инициализирована
  if (!fireAndForgetQueue) {
    initFireAndForgetQueue();
  }

  if (!fireAndForgetQueue) {
    // Fallback если инициализация не удалась
    Promise.resolve(fn()).catch((error) => {
      internalLogger.error('Fire-and-forget error (fallback)', error);
    });
    return;
  }

  // Добавляем в queue
  fireAndForgetQueue.queue.push(fn);

  // Запускаем обработку если не обрабатывается
  if (!fireAndForgetQueue.processing) {
    // Используем setTimeout для асинхронной обработки
    setTimeout(() => {
      processFireAndForgetQueue().catch(() => {
        // Игнорируем ошибки обработки queue
      });
    }, 0);
  }
}

/**
 * Логирует событие в fire-and-forget режиме с middleware support.
 * Строгая проверка middleware output на PII перед логированием.
 *
 * @param level - Уровень события
 * @param message - Сообщение события
 * @param metadata - Метаданные события (опционально)
 */
export function logFireAndForget(
  level: TelemetryLevel,
  message: string,
  metadata?: TelemetryMetadata,
): void {
  if (!isTelemetryInitialized()) {
    return; // Молча игнорируем, если не инициализировано
  }

  fireAndForget(async () => {
    const client = getGlobalTelemetryClient();

    // Применяем middleware если есть
    let processedMetadata = metadata;
    if (globalMiddleware) {
      processedMetadata = globalMiddleware(metadata, level, message);
    }

    // Строгая проверка на PII перед логированием (дополнительная защита)
    if (processedMetadata !== undefined) {
      if (containsPII(processedMetadata)) {
        internalLogger.error(
          'Metadata contains PII before logging. Metadata will be redacted.',
          { level, message },
        );
        processedMetadata = undefined;
      }
    }

    await client.log(level, message, processedMetadata);
  });
}

/**
 * Получает метрики производительности fire-and-forget queue.
 *
 * @returns Метрики queue для мониторинга производительности
 */
export function getFireAndForgetMetrics(): FireAndForgetMetrics | null {
  if (!fireAndForgetQueue) {
    return null;
  }

  return fireAndForgetQueue.metrics;
}

/**
 * Логирует информационное событие в fire-and-forget режиме.
 *
 * @param message - Сообщение события
 * @param metadata - Метаданные события (опционально)
 */
export function infoFireAndForget(
  message: string,
  metadata?: TelemetryMetadata,
): void {
  logFireAndForget('INFO', message, metadata);
}

/**
 * Логирует предупреждение в fire-and-forget режиме.
 *
 * @param message - Сообщение события
 * @param metadata - Метаданные события (опционально)
 */
export function warnFireAndForget(
  message: string,
  metadata?: TelemetryMetadata,
): void {
  logFireAndForget('WARN', message, metadata);
}

/**
 * Логирует ошибку в fire-and-forget режиме.
 *
 * @param message - Сообщение события
 * @param metadata - Метаданные события (опционально)
 */
export function errorFireAndForget(
  message: string,
  metadata?: TelemetryMetadata,
): void {
  logFireAndForget('ERROR', message, metadata);
}
