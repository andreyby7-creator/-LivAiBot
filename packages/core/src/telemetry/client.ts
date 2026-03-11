/**
 * @file @livai/core/src/telemetry/client.ts
 * ============================================================================
 * 🔹 TELEMETRY CLIENT — RUNTIME-ЗАВИСИМЫЙ КЛИЕНТ ТЕЛЕМЕТРИИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Runtime-зависимый клиент телеметрии с side-effects
 * - Immutable конфигурация, но mutable внутреннее состояние (eventQueue, throttleMap)
 * - Async queue и background processing для high-throughput
 * - Microservice-ready: переиспользуемый в любом runtime
 * - Extensible: расширяемость без изменения core-логики
 * - High-throughput: batching с event queue для масштабируемости
 * - Secure: throttle для защиты от DoS, PII sanitization через sanitization.ts
 *
 * Модульная структура:
 * - client.ts: runtime orchestration, queue, batching, throttle
 * - sanitization.ts: PII detection и metadata sanitization (pure utilities)
 * - sinks.ts: sink factories и retry логика с exponential backoff
 * - batch-core.ts: pure FP batch engine
 *
 * Принципы:
 * - SRP: разделение ответственности между domain и runtime слоями
 * - Deterministic: детерминированное поведение для одинаковых входов (где возможно)
 * - Runtime-aware: содержит mutable state и async операции
 * - Microservice-ready: готовность к микросервисной архитектуре
 * - Strict typing: union types, branded types, без Record в domain
 * - Side-effects: async queue, background processing (retry логика в sinks.ts)
 * - Extensible: расширяемость через композицию без изменения core
 *
 * Использование:
 * - Создание клиента: `new TelemetryClient(config)`
 * - Создание sinks: импортировать из './sinks.js' (createConsoleSink, createExternalSink)
 * - Операции имеют side-effects: async queue, background processing, mutable state
 *
 * Timezone Behavior:
 * - Все timestamp в UTC (milliseconds since epoch)
 * - Используется Date.now() для получения UTC времени
 * - Для distributed tracing рекомендуется использовать единую временную зону (UTC)
 * - Опциональный timezone в config для enterprise-grade trace aggregation
 * - Timestamp всегда в UTC, timezone используется только для форматирования/агрегации
 * - Для корректной работы distributed tracing все микросервисы должны использовать UTC
 */

import type {
  DropPolicy,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryLevel,
  TelemetryMetadata,
  TelemetrySink,
  TelemetryTimezone,
} from '@livai/core-contracts';
import { validateCustomLevelPriority } from '@livai/core-contracts';

import { deepFreeze, deepValidateAndRedactPII } from './sanitization.js';

/* ============================================================================
 * 🧱 КОНСТАНТЫ И ТИПЫ
 * ============================================================================
 */

// eslint-disable-next-line ai-security/model-poisoning -- Константы конфигурации TelemetryClient (batch/throttle/size), не пользовательские данные
const DEFAULT_MAX_CONCURRENT_BATCHES = 5;
const DEFAULT_THROTTLE_PERIOD_MS = 60000;
const DEFAULT_MAX_QUEUE_SIZE = 1000;
// Максимальный размер события телеметрии в байтах (приблизительно через JSON.stringify().length).
// Используется для защиты от DoS атак через огромные payload-объекты.
const MAX_EVENT_SIZE_BYTES = 1_000_000;
const DEFAULT_DROP_POLICY: DropPolicy = 'oldest';

/* ============================================================================
 */

/**
 * Уровни логирования телеметрии.
 * Union type для строгой типизации вместо string.
 */
export const telemetryLevels = ['INFO', 'WARN', 'ERROR'] as const;

/**
 * Приоритеты уровней для O(1) сравнения.
 * Immutable map для детерминированного сравнения уровней.
 * Extensible: пользовательские уровни могут быть добавлены через customLevelPriority в config.
 */
export const levelPriority = Object.freeze(
  {
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  } satisfies Record<TelemetryLevel, number>,
);

/* ============================================================================
 * 🔧 УТИЛИТЫ (PURE, DETERMINISTIC)
 * ============================================================================
 */

/**
 * Создает ключ для throttle на основе сообщения и уровня.
 * @param level - Уровень события
 * @param message - Сообщение события
 * @returns Ключ для throttle map
 */
function createThrottleKey(level: TelemetryLevel, message: string): string {
  return `${level}:${message}`;
}

/**
 * Проверяет, что событие телеметрии не превышает безопасный размер.
 * Использует JSON.stringify для оценки размера в байтах (приближенно).
 * ВАЖНО: эта проверка выполняется до добавления события в очередь,
 * чтобы предотвратить DoS через переполнение очереди огромными объектами.
 */
type BaseTelemetryEventForSizeCheck = TelemetryEvent<TelemetryMetadata>;

function isEventSizeWithinLimit(event: BaseTelemetryEventForSizeCheck): boolean {
  try {
    const serialized = JSON.stringify(event);
    return serialized.length <= MAX_EVENT_SIZE_BYTES;
  } catch {
    // Если сериализация падает (например, из-за циклов), считаем событие небезопасным.
    return false;
  }
}

/* ============================================================================
 * 🔍 TYPE GUARDS (RUNTIME VALIDATION)
 * ============================================================================
 */

/**
 * Type guard для проверки валидности sink.
 * Runtime validation для user-friendly ошибок при неправильной конфигурации.
 * Выбрасывает ошибку сразу при создании sink, а не во время выполнения.
 * @throws Error если sink невалиден
 */
export function isValidTelemetrySink<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  sink: unknown, // Объект для проверки
): sink is TelemetrySink<TMetadata> {
  if (typeof sink !== 'function') {
    // eslint-disable-next-line fp/no-throw -- Валидация при создании sink (лучше упасть сразу, чем в runtime)
    throw new Error('TelemetrySink must be a function');
  }
  return true;
}

/* ============================================================================
 * 🧠 КЛИЕНТ ТЕЛЕМЕТРИИ
 * ============================================================================
 */

/**
 * Enterprise-ready клиент телеметрии.
 * См. описание в заголовке файла для общей архитектуры и принципов.
 * Специфичные детали реализации:
 * - Immutable config: все поля конфигурации readonly после создания
 * - Mutable state: eventQueue (очередь событий), throttleMap (состояние throttle)
 * - Testable: injection timestamp через getTimestamp для unit-тестов
 * - Secure: deep validation + PII redaction для защиты от PII
 * - DoS-resistant: throttle для защиты от повторяющихся ошибок
 */
/* eslint-disable functional/no-classes, fp/no-mutation, functional/no-this-expressions, functional/immutable-data, functional/no-loop-statements, functional/no-let, fp/no-throw, ai-security/model-poisoning */
// Обоснование: TelemetryClient - runtime-зависимый клиент с mutable state (eventQueue, throttleMap).
// Использование класса, мутаций, циклов и throw необходимо для runtime orchestration с side-effects.
// Это не pure FP модуль, а runtime orchestration с async queue, batching и throttle.
export class TelemetryClient<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
> {
  private readonly sinks: readonly TelemetrySink<TMetadata>[];
  private readonly levelThreshold: TelemetryLevel;
  private readonly onError:
    | ((error: unknown, event: TelemetryEvent<TMetadata>) => void)
    | undefined;
  private readonly getTimestamp: () => number;
  private readonly sanitizeMetadata: ((metadata: TMetadata) => Readonly<TMetadata>) | undefined;
  private readonly customLevelPriority: Readonly<Record<string, number>>;
  private readonly batchConfig: Readonly<{
    maxBatchSize: number;
    maxConcurrentBatches: number;
    maxQueueSize: number;
    dropPolicy: DropPolicy;
  }>;
  private readonly throttleConfig: Readonly<{
    maxErrorsPerPeriod: number;
    throttlePeriodMs: number;
  }>;
  // Timezone для enterprise-grade trace aggregation (добавляется в событие если не UTC)
  private readonly timezone: TelemetryTimezone;
  private readonly enableDeepFreeze: boolean;
  private readonly enablePIIValueScan: boolean;
  private readonly enableRegexPIIDetection: boolean;

  // Throttle state для log suppression
  private readonly throttleMap = new Map<string, { count: number; resetAt: number; }>();
  private throttleCheckCount = 0; // Счетчик для периодической очистки throttleMap

  // Event queue для batching событий (не sinks)
  private readonly eventQueue: TelemetryEvent<TMetadata>[] = [];
  private processingQueue = false;

  /** Создает новый экземпляр клиента телеметрии. */
  constructor(
    config: TelemetryConfig<TMetadata> = {}, // Конфигурация клиента
  ) {
    this.levelThreshold = config.levelThreshold ?? 'INFO';
    this.sinks = config.sinks ?? [];
    this.onError = config.onError;
    this.getTimestamp = config.getTimestamp ?? ((): number => Date.now());
    this.sanitizeMetadata = config.sanitizeMetadata;
    // Валидация customLevelPriority гарантирует:
    // - Нет конфликтов со стандартными уровнями (INFO, WARN, ERROR)
    // - Нет дубликатов ключей (case-insensitive)
    // - Все значения - конечные числа (не NaN, не Infinity)
    // - Возвращает валидированный объект (O(1) доступ сохранен)
    this.customLevelPriority = Object.freeze(
      validateCustomLevelPriority(config.customLevelPriority),
    );
    this.batchConfig = Object.freeze({
      maxBatchSize: config.batchConfig?.maxBatchSize ?? 10,
      maxConcurrentBatches: config.batchConfig?.maxConcurrentBatches
        ?? DEFAULT_MAX_CONCURRENT_BATCHES,
      maxQueueSize: config.batchConfig?.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
      dropPolicy: config.batchConfig?.dropPolicy ?? DEFAULT_DROP_POLICY,
    });
    this.throttleConfig = Object.freeze({
      maxErrorsPerPeriod: config.throttleConfig?.maxErrorsPerPeriod ?? 10,
      throttlePeriodMs: config.throttleConfig?.throttlePeriodMs ?? DEFAULT_THROTTLE_PERIOD_MS,
    });
    this.timezone = config.timezone ?? 'UTC';
    this.enableDeepFreeze = config.enableDeepFreeze ?? true;
    this.enablePIIValueScan = config.enablePIIValueScan ?? false;
    this.enableRegexPIIDetection = config.enableRegexPIIDetection ?? true;

    // Runtime validation sinks для user-friendly ошибок
    this.sinks.forEach((sink, index) => {
      try {
        isValidTelemetrySink(sink);
      } catch (error) {
        throw new Error(
          `Invalid sink at index ${index}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
  }

  /**
   * Применяет sanitization к metadata.
   * Использует кастомный sanitizeMetadata если задан, иначе deepValidateAndRedactPII.
   */
  private applySanitization(metadata: TMetadata): Readonly<TMetadata> {
    if (this.sanitizeMetadata) {
      return this.enableDeepFreeze
        ? deepFreeze(this.sanitizeMetadata(metadata))
        : this.sanitizeMetadata(metadata);
    }

    const sanitized = deepValidateAndRedactPII(
      metadata,
      '[REDACTED]',
      this.enablePIIValueScan,
      this.enableRegexPIIDetection,
    );
    return this.enableDeepFreeze ? deepFreeze(sanitized) : sanitized;
  }

  private createEvent(
    level: TelemetryLevel,
    message: string,
    sanitizedMetadata: Readonly<TMetadata> | undefined,
    timestamp: number,
    spanId?: string,
    correlationId?: string,
    traceId?: string,
  ): TelemetryEvent<TMetadata> {
    const eventData = {
      level,
      message,
      timestamp,
      ...(sanitizedMetadata !== undefined && { metadata: sanitizedMetadata }),
      ...(spanId !== undefined && { spanId }),
      ...(correlationId !== undefined && { correlationId }),
      ...(traceId !== undefined && { traceId }),
      ...(this.timezone !== 'UTC' && { timezone: this.timezone }),
    };
    return this.enableDeepFreeze ? deepFreeze(eventData) : Object.freeze(eventData);
  }

  /**
   * Логирует событие телеметрии.
   * Добавляет событие в очередь для асинхронной обработки.
   * Метод синхронный, обработка происходит асинхронно в фоне через очередь.
   * Возвращает Promise для совместимости с async/await API.
   */

  log(
    level: TelemetryLevel, // Уровень события (union type)
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    timestamp?: number, // Временная метка в UTC (опционально, по умолчанию текущее время)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    if (!this.shouldEmit(level)) return Promise.resolve();

    // Throttle для защиты от DoS
    if (this.isThrottled(level, message)) {
      return Promise.resolve();
    }

    // Deep validation + PII redaction (если не задан кастомный sanitizeMetadata)
    const sanitizedMetadata = metadata !== undefined ? this.applySanitization(metadata) : undefined;

    // Immutable событие с readonly полями (deep frozen опционально)
    const event = this.createEvent(
      level,
      message,
      sanitizedMetadata,
      timestamp ?? this.getTimestamp(),
      spanId,
      correlationId,
      traceId,
    );

    // Batching для high-throughput систем
    this.sendToSinksBatched(event);

    // Обработка событий происходит асинхронно в фоне через очередь
    return Promise.resolve();
  }

  /**
   * Добавляет событие в очередь и запускает обработку если нужно.
   * Поддерживает backpressure через maxQueueSize и drop-policy.
   * @param event - Событие для добавления в очередь
   */
  private sendToSinksBatched(event: TelemetryEvent<TMetadata>): void {
    const { maxQueueSize, dropPolicy } = this.batchConfig;

    // Структурная защита от DoS: не добавлять в очередь события, которые
    // превышают безопасный размер или не сериализуются.
    if (!isEventSizeWithinLimit(event as unknown as BaseTelemetryEventForSizeCheck)) {
      // Для безопасности просто игнорируем событие. В случае необходимости
      // можно добавить дополнительное логирование через onError.
      return;
    }

    // Backpressure: проверяем размер очереди
    if (maxQueueSize > 0 && this.eventQueue.length >= maxQueueSize) {
      // Применяем drop-policy
      if (dropPolicy === 'oldest') {
        // Удаляем самое старое событие
        this.eventQueue.shift();
      } else if (dropPolicy === 'newest') {
        // Игнорируем новое событие
        return;
      } else {
        // dropPolicy === 'error' - выбрасываем ошибку
        throw new Error(`Event queue overflow: maxQueueSize=${maxQueueSize} reached`);
      }
    }

    // Добавляем событие в очередь
    this.eventQueue.push(event);

    // Запускаем обработку очереди асинхронно (не блокируем)
    this.processEventQueue().catch((error) => {
      if (this.onError) {
        // Используем последнее событие для контекста ошибки
        this.onError(error, this.eventQueue[this.eventQueue.length - 1] ?? event);
      }
    });
  }

  /**
   * Обрабатывает один батч событий и отправляет во все sinks.
   * Вынесено в отдельную функцию для снижения cognitive complexity.
   */
  private async processBatch(batch: readonly TelemetryEvent<TMetadata>[]): Promise<void> {
    // Отправляем батч событий во все sinks параллельно
    // Используем flatMap для упрощения вложенной структуры
    const allPromises = this.sinks.flatMap((sink) =>
      batch.map((event) => ({
        promise: Promise.resolve(sink(event)),
        event,
      }))
    );

    const results = await Promise.allSettled(allPromises.map((item) => item.promise));

    // Обрабатываем ошибки
    if (this.onError) {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const item = allPromises[index];
          if (item && this.onError) {
            this.onError(result.reason, item.event);
          }
        }
      });
    }
  }

  /** Извлекает батч событий из очереди. */
  private extractBatch(maxBatchSize: number): TelemetryEvent<TMetadata>[] {
    const batch: TelemetryEvent<TMetadata>[] = [];
    const batchSize = Math.min(maxBatchSize, this.eventQueue.length);

    for (let i = 0; i < batchSize; i++) {
      const event = this.eventQueue.shift();
      if (event) {
        batch.push(event);
      }
    }

    return batch;
  }

  /**
   * Обрабатывает очередь событий батчами.
   * Батчит события (не sinks) для лучшей производительности.
   */
  private async processEventQueue(): Promise<void> {
    // Предотвращаем параллельную обработку
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      const { maxBatchSize, maxConcurrentBatches } = this.batchConfig;

      while (this.eventQueue.length > 0) {
        // Реализация maxConcurrentBatches: обрабатываем несколько батчей параллельно
        const concurrentPromises: Promise<void>[] = [];

        // Создаем до maxConcurrentBatches батчей для параллельной обработки
        for (
          let batchIndex = 0;
          batchIndex < maxConcurrentBatches && this.eventQueue.length > 0;
          batchIndex++
        ) {
          const batch = this.extractBatch(maxBatchSize);

          if (batch.length === 0) {
            continue;
          }

          concurrentPromises.push(this.processBatch(batch));
        }

        // Ждем завершения всех параллельных батчей перед следующим циклом
        if (concurrentPromises.length > 0) {
          await Promise.allSettled(concurrentPromises);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Проверяет, нужно ли throttle событие.
   * Защита от DoS через логирование повторяющихся ошибок.
   * @param level - Уровень события
   * @param message - Сообщение события
   * @returns true если событие должно быть проигнорировано (throttled)
   */
  private isThrottled(level: TelemetryLevel, message: string): boolean {
    // Периодическая очистка истекших записей (lazy cleanup при каждом 100-м вызове)
    this.throttleCheckCount += 1;
    if (this.throttleCheckCount >= 100) {
      this.throttleCheckCount = 0;
      this.cleanupThrottleMap();
    }

    const { maxErrorsPerPeriod, throttlePeriodMs } = this.throttleConfig;
    const now = this.getTimestamp();
    const key = createThrottleKey(level, message);

    const throttleEntry = this.throttleMap.get(key);

    if (!throttleEntry) {
      this.throttleMap.set(key, { count: 1, resetAt: now + throttlePeriodMs });
      return false;
    }

    // Сброс счетчика если период истек
    if (now >= throttleEntry.resetAt) {
      this.throttleMap.set(key, { count: 1, resetAt: now + throttlePeriodMs });
      return false;
    }

    // Увеличиваем счетчик
    throttleEntry.count += 1;

    // Throttle если превышен лимит
    if (throttleEntry.count > maxErrorsPerPeriod) {
      return true;
    }

    return false;
  }

  /**
   * Очищает истекшие записи из throttleMap для предотвращения утечек памяти.
   * Вызывается периодически при проверке throttle (lazy cleanup).
   */
  private cleanupThrottleMap(): void {
    const now = this.getTimestamp();
    for (const [key, entry] of this.throttleMap.entries()) {
      // Удаляем записи, у которых период истек более чем на 2 периода назад
      // (оставляем небольшой буфер для активных записей)
      if (now >= entry.resetAt + this.throttleConfig.throttlePeriodMs * 2) {
        this.throttleMap.delete(key);
      }
    }
  }

  /** Логирует информационное событие. */
  info(
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log('INFO', message, metadata, undefined, spanId, correlationId, traceId);
  }

  /** Логирует предупреждение. */
  warn(
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log('WARN', message, metadata, undefined, spanId, correlationId, traceId);
  }

  /** Логирует ошибку. */
  error(
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log('ERROR', message, metadata, undefined, spanId, correlationId, traceId);
  }

  /** Логирует метрику производительности. */
  recordMetric(
    name: string, // Название метрики
    value: number, // Значение метрики
    metadata?: TMetadata, // Дополнительные метаданные (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    const metricMetadata = { value, ...metadata } as TMetadata;
    return this.log(
      'INFO',
      `metric:${name}`,
      metricMetadata,
      undefined,
      spanId,
      correlationId,
      traceId,
    );
  }

  /**
   * Начинает отслеживание операции (span start).
   * Для enterprise-grade tracing рекомендуется передавать spanId для связывания
   * startSpan и endSpan в distributed системах.
   */
  startSpan(
    name: string, // Название операции
    metadata?: TMetadata, // Метаданные операции (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log(
      'INFO',
      `span:start:${name}`,
      metadata,
      undefined,
      spanId,
      correlationId,
      traceId,
    );
  }

  /**
   * Завершает отслеживание операции (span end).
   * Для enterprise-grade tracing рекомендуется передавать тот же spanId,
   * что был использован в startSpan, для связывания событий.
   */
  endSpan(
    name: string, // Название операции
    metadata?: TMetadata, // Метаданные операции (опционально)
    spanId?: string, // ID span для distributed tracing (опционально, должен совпадать с startSpan)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log(
      'INFO',
      `span:end:${name}`,
      metadata,
      undefined,
      spanId,
      correlationId,
      traceId,
    );
  }

  /**
   * Проверяет необходимость отправки события на основе уровня.
   * Использует immutable map приоритетов для O(1) сравнения.
   * Логика приоритетов:
   * 1. Если level есть в customLevelPriority → используем кастомный приоритет
   * 2. Если levelThreshold есть в customLevelPriority → используем кастомный threshold
   * 3. Иначе → используем стандартные приоритеты из levelPriority
   * Гарантии O(1):
   * - validateCustomLevelPriority гарантирует валидность структуры (нет конфликтов, дубликатов, невалидных значений)
   * - Object.freeze гарантирует immutability после валидации
   * - Доступ к объекту через [key] - O(1) операция
   * - validateCustomLevelPriority блокирует конфликты со стандартными уровнями, поэтому
   *   если level - стандартный (INFO/WARN/ERROR), он гарантированно не будет в customLevelPriority
   * @param level - Уровень события для проверки
   * @returns true если событие должно быть отправлено
   */
  private shouldEmit(
    level: TelemetryLevel, // Уровень события для проверки
  ): boolean {
    // Проверяем кастомные приоритеты сначала (extensible)
    // validateCustomLevelPriority гарантирует, что level не может быть в customLevelPriority
    // если level - стандартный (INFO/WARN/ERROR), так как валидация блокирует конфликты
    const customPriority = this.customLevelPriority[level];
    if (customPriority !== undefined) {
      // level - кастомный уровень, используем кастомный приоритет
      // validateCustomLevelPriority гарантирует, что customPriority - конечное число
      const thresholdPriority = this.customLevelPriority[this.levelThreshold]
        ?? levelPriority[this.levelThreshold];
      return customPriority >= thresholdPriority;
    }

    // Fallback на стандартные приоритеты
    // level - стандартный уровень (INFO/WARN/ERROR), гарантированно есть в levelPriority
    return levelPriority[level] >= levelPriority[this.levelThreshold];
  }
}
/* eslint-enable functional/no-classes, fp/no-mutation, functional/no-this-expressions, functional/immutable-data, functional/no-loop-statements, functional/no-let, fp/no-throw, ai-security/model-poisoning */

/* ============================================================================
 * 🐛 УТИЛИТЫ ОТЛАДКИ (ТОЛЬКО ДЛЯ DEV)
 * ============================================================================
 *
 * ВАЖНО: Эти утилиты предназначены ТОЛЬКО для разработки и тестирования.
 * Они не должны использоваться в production коде.
 * Для production используйте lib/telemetry-runtime.ts с singleton логикой.
 */

/**
 * Ключ для хранения клиента в globalThis.
 * @internal
 */
const GLOBAL_CLIENT_KEY = '__telemetryClient';

/**
 * Получает клиент телеметрии из globalThis для отладки.
 * @internal-dev
 */
export const getGlobalClientForDebug = (): TelemetryClient | undefined => {
  if (typeof globalThis !== 'undefined') {
    return (globalThis as typeof globalThis & Record<string, unknown>)[GLOBAL_CLIENT_KEY] as
      | TelemetryClient
      | undefined;
  }
  return undefined;
};
