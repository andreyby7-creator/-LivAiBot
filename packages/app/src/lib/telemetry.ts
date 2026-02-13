/**
 * @file packages/app/src/lib/telemetry.ts
 * ============================================================================
 * 🔹 TELEMETRY CORE — ЧИСТОЕ МИКРОСЕРВИСНОЕ ЯДРО ТЕЛЕМЕТРИИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Runtime-зависимый клиент телеметрии с side-effects
 * - Immutable конфигурация, но mutable внутреннее состояние (eventQueue, throttleMap)
 * - Async queue и background processing для high-throughput
 * - Microservice-ready: переиспользуемый в любом runtime
 * - Extensible: расширяемость без изменения core-логики
 * - High-throughput: batching с event queue для масштабируемости
 * - Secure: throttle для защиты от DoS
 *
 * Принципы:
 * - SRP: разделение ответственности между domain и runtime слоями
 * - Deterministic: детерминированное поведение для одинаковых входов (где возможно)
 * - Runtime-aware: содержит mutable state и async операции
 * - Microservice-ready: готовность к микросервисной архитектуре
 * - Strict typing: union types, branded types, без Record в domain
 * - Side-effects: async queue, background processing, setTimeout в retry
 * - Extensible: расширяемость через композицию без изменения core
 *
 * Использование:
 * - Создание клиента: `new TelemetryClient(config)`
 * - Создание sinks: `createConsoleSink()`, `createExternalSink()`
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
  RetryConfig,
  TelemetryConfig,
  TelemetryEvent,
  TelemetryLevel,
  TelemetrySink,
  TelemetryTimezone,
} from '../types/telemetry.js';

/* ============================================================================
 * 🧱 КОНСТАНТЫ И ТИПЫ
 * ============================================================================
 */

const DEFAULT_MAX_CONCURRENT_BATCHES = 5;
const DEFAULT_THROTTLE_PERIOD_MS = 60000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_DELAY_MS = 10000;
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_DROP_POLICY: DropPolicy = 'oldest';
const MIN_BASE64_TOKEN_LENGTH = 20;

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
 * Deep freeze для полной иммутабельности объектов.
 * Рекурсивно замораживает все вложенные объекты и массивы.
 *
 * Производительность:
 * - Для небольших объектов (< 100 ключей) - нет проблем
 * - Для больших объектов (тысячи ключей/вложенных объектов) - может быть медленно
 * - Используйте enableDeepFreeze: false для high-throughput систем с большими metadata
 *
 * Защита от циклических ссылок:
 * - Использует WeakSet для отслеживания уже обработанных объектов
 * - Предотвращает бесконечную рекурсию при циклических ссылках
 *
 * @param obj - Объект для заморозки
 * @param visited - WeakSet для отслеживания уже обработанных объектов (внутренний параметр)
 * @returns Замороженный объект (readonly на всех уровнях)
 */
function deepFreeze<T>(obj: T, visited = new WeakSet<object>()): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj as Readonly<T>;
  }

  // Защита от циклических ссылок
  if (visited.has(obj as object)) {
    return obj as Readonly<T>;
  }

  visited.add(obj as object);
  Object.freeze(obj);

  if (Array.isArray(obj)) {
    obj.forEach((item) => deepFreeze(item, visited));
  } else {
    Object.values(obj).forEach((value) => {
      if (value !== null && typeof value === 'object') {
        deepFreeze(value, visited);
      }
    });
  }

  return obj as Readonly<T>;
}

/**
 * ВАЖНО: Regex-based PII detection имеет false negatives и не рекомендуется для production.
 * Для enterprise-среды используйте:
 * - allow-list schema через typed metadata contracts
 * - Явную валидацию через sanitizeMetadata в config
 *
 * Regex-подход оставлен только для обратной совместимости и должен быть отключен
 * через enableRegexPIIDetection: false в production.
 */
const PII_PATTERNS = Object.freeze(
  [
    /^(password|pwd|passwd)$/i,
    /^(access[_-]?token|auth[_-]?token|bearer[_-]?token|refresh[_-]?token)$/i,
    /^(secret|secret[_-]?key|private[_-]?key)$/i,
    /^(api[_-]?key|apikey)$/i,
    /^(authorization|auth[_-]?header)$/i,
    /^(credit[_-]?card|card[_-]?number|cc[_-]?number)$/i,
    /^(ssn|social[_-]?security[_-]?number)$/i,
    /^(session[_-]?id|sessionid)$/i,
  ] as const,
);

/**
 * Проверяет, является ли строка base64-закодированным токеном.
 * ВАЖНО: Это эвристика с false negatives. Используйте typed metadata contracts для production.
 */
function isBase64Token(value: string): boolean {
  if (value.length < MIN_BASE64_TOKEN_LENGTH) return false;
  // Base64 может содержать A-Z, a-z, 0-9, +, /, = (padding)
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  return base64Pattern.test(value) && value.length > MIN_BASE64_TOKEN_LENGTH;
}

/**
 * Deep validation и PII redaction для metadata.
 * Рекурсивно проверяет и скрывает чувствительные данные.
 *
 * ВАЖНО: Regex-based PII detection имеет false negatives!
 * Для enterprise-среды рекомендуется:
 * - Использовать allow-list schema через typed metadata contracts
 * - Передавать кастомный sanitizeMetadata в config
 * - Отключить enableRegexPIIDetection в production
 *
 * @param metadata - Метаданные для валидации
 * @param redactValue - Значение для замены PII (по умолчанию '[REDACTED]')
 * @param enableValueScan - Включить сканирование значений на PII (по умолчанию false)
 * @param enableRegexDetection - Включить regex-based detection (по умолчанию true, но не рекомендуется для production)
 * @returns Валидированные и очищенные метаданные
 */
function isPIIKey(key: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(key));
}

function isPIIValue(value: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(value));
}

function truncateLongString(value: string, maxLength = 1000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...[TRUNCATED]` : value;
}

function processMetadataEntry(
  key: string,
  value: unknown,
  redactValue: string,
  enableValueScan: boolean,
  enableRegexDetection: boolean,
  visited: WeakSet<object>,
): unknown {
  // Regex-based PII detection (не рекомендуется для production из-за false negatives)
  if (enableRegexDetection) {
    // Проверка ключа на PII patterns
    if (isPIIKey(key)) {
      return redactValue;
    }

    if (enableValueScan && typeof value === 'string') {
      // Сканирование значений на PII (опционально, для повышенной безопасности)
      if (isPIIValue(value) || isBase64Token(value)) {
        return redactValue;
      }
      return truncateLongString(value);
    }
  }

  if (typeof value === 'string') {
    return truncateLongString(value);
  }

  if (value !== null && typeof value === 'object') {
    // Защита от циклических ссылок
    if (visited.has(value)) {
      return '[Circular Reference]';
    }
    // Рекурсивная обработка вложенных объектов
    return deepValidateAndRedactPII(
      value,
      redactValue,
      enableValueScan,
      enableRegexDetection,
      visited,
    );
  }

  return value;
}

function deepValidateAndRedactPII<T>(
  metadata: T,
  redactValue = '[REDACTED]',
  enableValueScan = false,
  enableRegexDetection = true,
  visited = new WeakSet<object>(),
): Readonly<T> {
  if (metadata === null || metadata === undefined) {
    return metadata as Readonly<T>;
  }

  if (
    typeof metadata === 'string' || typeof metadata === 'number' || typeof metadata === 'boolean'
  ) {
    return metadata as Readonly<T>;
  }

  // Защита от циклических ссылок
  if (typeof metadata === 'object') {
    if (visited.has(metadata)) {
      return '[Circular Reference]' as unknown as Readonly<T>;
    }
    visited.add(metadata);
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) =>
      deepValidateAndRedactPII(item, redactValue, enableValueScan, enableRegexDetection, visited)
    ) as unknown as Readonly<T>;
  }

  if (typeof metadata === 'object') {
    const sanitized = { ...metadata } as Record<string, unknown>;

    for (const [key, value] of Object.entries(sanitized)) {
      sanitized[key] = processMetadataEntry(
        key,
        value,
        redactValue,
        enableValueScan,
        enableRegexDetection,
        visited,
      );
    }

    // НЕ вызываем deepFreeze здесь - это будет сделано в applySanitization
    return sanitized as unknown as Readonly<T>;
  }

  return metadata as Readonly<T>;
}

/**
 * Вычисляет задержку для exponential backoff.
 *
 * @param attempt - Номер попытки (начиная с 1)
 * @param baseDelayMs - Базовая задержка в миллисекундах
 * @param maxDelayMs - Максимальная задержка в миллисекундах
 * @param multiplier - Множитель для exponential backoff
 * @returns Задержка в миллисекундах
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  multiplier: number,
): number {
  const delay = baseDelayMs * multiplier ** (attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Создает ключ для throttle на основе сообщения и уровня.
 *
 * @param level - Уровень события
 * @param message - Сообщение события
 * @returns Ключ для throttle map
 */
function createThrottleKey(level: TelemetryLevel, message: string): string {
  return `${level}:${message}`;
}

/* ============================================================================
 * 🔍 TYPE GUARDS (RUNTIME VALIDATION)
 * ============================================================================
 */

/**
 * Type guard для проверки валидности sink.
 *
 * Runtime validation для user-friendly ошибок при неправильной конфигурации.
 * Выбрасывает ошибку сразу при создании sink, а не во время выполнения.
 *
 * @throws Error если sink невалиден
 */
export function isValidTelemetrySink<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  sink: unknown, // Объект для проверки
): sink is TelemetrySink<TMetadata> {
  if (typeof sink !== 'function') {
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
 *
 * См. описание в заголовке файла для общей архитектуры и принципов.
 *
 * Специфичные детали реализации:
 * - Immutable config: все поля конфигурации readonly после создания
 * - Mutable state: eventQueue (очередь событий), throttleMap (состояние throttle)
 * - Testable: injection timestamp через getTimestamp для unit-тестов
 * - Secure: deep validation + PII redaction для защиты от PII
 * - DoS-resistant: throttle для защиты от повторяющихся ошибок
 */
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

  // Event queue для batching событий (не sinks)
  private readonly eventQueue: TelemetryEvent<TMetadata>[] = [];
  private processingQueue = false;

  /**
   * Создает новый экземпляр клиента телеметрии.
   */
  constructor(
    config: TelemetryConfig<TMetadata> = {}, // Конфигурация клиента
  ) {
    this.levelThreshold = config.levelThreshold ?? 'INFO';
    this.sinks = config.sinks ?? [];
    this.onError = config.onError;
    this.getTimestamp = config.getTimestamp ?? ((): number => Date.now());
    this.sanitizeMetadata = config.sanitizeMetadata;
    this.customLevelPriority = config.customLevelPriority ?? {};
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
   */
  async log(
    level: TelemetryLevel, // Уровень события (union type)
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    timestamp?: number, // Временная метка в UTC (опционально, по умолчанию текущее время)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    if (!this.shouldEmit(level)) return;

    // Throttle для защиты от DoS через логирование
    if (this.isThrottled(level, message)) {
      return;
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

    // Возвращаем resolved promise для обратной совместимости API
    // Обработка событий происходит асинхронно в фоне через очередь
    return Promise.resolve();
  }

  /**
   * Добавляет событие в очередь и запускает обработку если нужно.
   * Поддерживает backpressure через maxQueueSize и drop-policy.
   *
   * @param event - Событие для добавления в очередь
   */
  private sendToSinksBatched(event: TelemetryEvent<TMetadata>): void {
    const { maxQueueSize, dropPolicy } = this.batchConfig;

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
    const sinkResults = await Promise.allSettled(
      this.sinks.map((sink) =>
        Promise.allSettled(
          batch.map((event) => Promise.resolve(sink(event))),
        )
      ),
    );

    // Обрабатываем ошибки
    sinkResults.forEach((sinkResult) => {
      if (sinkResult.status === 'fulfilled') {
        sinkResult.value.forEach((eventResult, eventIndex) => {
          if (eventResult.status === 'rejected' && this.onError) {
            const event = batch[eventIndex];
            if (event) {
              this.onError(eventResult.reason, event);
            }
          }
        });
      } else if (this.onError && batch[0]) {
        this.onError(sinkResult.reason, batch[0]);
      }
    });
  }

  /**
   * Извлекает батч событий из очереди.
   */
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
   *
   * @param level - Уровень события
   * @param message - Сообщение события
   * @returns true если событие должно быть проигнорировано (throttled)
   */
  private isThrottled(level: TelemetryLevel, message: string): boolean {
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
   * Логирует информационное событие.
   */
  info(
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log('INFO', message, metadata, undefined, spanId, correlationId, traceId);
  }

  /**
   * Логирует предупреждение.
   */
  warn(
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log('WARN', message, metadata, undefined, spanId, correlationId, traceId);
  }

  /**
   * Логирует ошибку.
   */
  error(
    message: string, // Сообщение события
    metadata?: TMetadata, // Метаданные события (опционально)
    spanId?: string, // ID span для distributed tracing (опционально)
    correlationId?: string, // Correlation ID для связывания событий (опционально)
    traceId?: string, // Trace ID для distributed tracing (опционально)
  ): Promise<void> {
    return this.log('ERROR', message, metadata, undefined, spanId, correlationId, traceId);
  }

  /**
   * Записывает метрику производительности.
   */
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
   *
   * Для enterprise-grade tracing рекомендуется передавать spanId для связывания
   * startSpan и endSpan в distributed системах.
   *
   * Timezone:
   * - Timestamp в UTC для корректной работы distributed tracing
   * - Timezone из config используется для агрегации/отображения
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
   *
   * Для enterprise-grade tracing рекомендуется передавать тот же spanId,
   * что был использован в startSpan, для связывания событий.
   *
   * Timezone:
   * - Timestamp в UTC для корректной работы distributed tracing
   * - Timezone из config используется для агрегации/отображения
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
   *
   * @param level - Уровень события для проверки
   * @returns true если событие должно быть отправлено
   */
  private shouldEmit(
    level: TelemetryLevel, // Уровень события для проверки
  ): boolean {
    // Проверяем кастомные приоритеты сначала (extensible)
    const customPriority = this.customLevelPriority[level];
    if (customPriority !== undefined) {
      const thresholdPriority = this.customLevelPriority[this.levelThreshold]
        ?? levelPriority[this.levelThreshold];
      return customPriority >= thresholdPriority;
    }

    // Fallback на стандартные приоритеты
    return levelPriority[level] >= levelPriority[this.levelThreshold];
  }
}

/* ============================================================================
 * 🔌 SINK FACTORIES
 * ============================================================================
 */

/**
 * Форматтер для console sink (опционально).
 * Позволяет кастомизировать вывод для более структурированного логирования.
 */
export type ConsoleSinkFormatter = (event: TelemetryEvent) => readonly [string, ...unknown[]];

/**
 * Создает console sink для вывода в консоль.
 *
 * Factory функция:
 * - Возвращает функцию-sink без выполнения I/O при создании
 * - Side-effect (console.log/warn/error) инкапсулирован внутри sink
 * - Детерминированное создание sink'а
 * - Использует методы из глобального console (позволяет мокам работать в тестах)
 * - Extensible: поддержка кастомного formatter
 *
 * Использование:
 * - Только в bootstrap коде приложения
 * - Для разработки и отладки
 */
export const createConsoleSink = (
  formatter?: ConsoleSinkFormatter, // Опциональный formatter для кастомизации вывода
): TelemetrySink => {
  return (event: TelemetryEvent): void => {
    // Используем методы из глобального console вместо сохраненных ссылок
    // Это позволяет мокам работать в тестах
    const consoleMethod = event.level === 'ERROR'
      // eslint-disable-next-line no-console
      ? console.error
      : event.level === 'WARN'
      // eslint-disable-next-line no-console
      ? console.warn
      // eslint-disable-next-line no-console
      : console.log;

    if (formatter) {
      const formatted = formatter(event);
      consoleMethod(...formatted);
    } else {
      const prefix = `[${event.level}] ${new Date(event.timestamp).toISOString()}`;
      if (event.metadata !== undefined) {
        consoleMethod(prefix, event.message, event.metadata);
      } else {
        consoleMethod(prefix, event.message);
      }
    }
  };
};

/**
 * Тип внешнего SDK для типизации.
 * Generic для строгой типизации metadata.
 */
export type ExternalSdk<TMetadata = Readonly<Record<string, string | number | boolean | null>>> = {
  /** Метод для отправки события в SDK */
  readonly capture: (event: Readonly<TelemetryEvent<TMetadata>>) => void | Promise<void>;
};

/**
 * Создает sink для внешнего SDK (PostHog, Sentry, Datadog и т.д.).
 *
 * Factory функция с обработкой ошибок:
 * - Возвращает функцию-sink без выполнения I/O при создании
 * - Обработка ошибок SDK инкапсулирована внутри sink
 * - Runtime-aware: использует setTimeout для exponential backoff в retry
 * - Type-safe: generic TMetadata для строгой типизации
 * - Retry-ready: опциональный retry/backoff для критичных SDK
 *
 * @throws Error если SDK не имеет метода capture
 */
export const createExternalSink = <
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  sdk: ExternalSdk<TMetadata>, // SDK объект с методом capture
  retryConfig?: RetryConfig, // Опциональная конфигурация retry/backoff
): TelemetrySink<TMetadata> => {
  if (typeof sdk.capture !== 'function') {
    throw new Error('SDK must have a capture method that is a function');
  }

  const effectiveRetryConfig: Readonly<{
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  }> = Object.freeze({
    maxRetries: retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES,
    baseDelayMs: retryConfig?.baseDelayMs ?? 1000,
    maxDelayMs: retryConfig?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    backoffMultiplier: retryConfig?.backoffMultiplier ?? 2,
  });

  return async (event: Readonly<TelemetryEvent<TMetadata>>): Promise<void> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= effectiveRetryConfig.maxRetries; attempt++) {
      try {
        await sdk.capture(event);
        return; // Успешная отправка
      } catch (error) {
        lastError = error;

        // Если это не последняя попытка, ждем перед retry
        if (attempt < effectiveRetryConfig.maxRetries) {
          const delay = calculateBackoffDelay(
            attempt,
            effectiveRetryConfig.baseDelayMs,
            effectiveRetryConfig.maxDelayMs,
            effectiveRetryConfig.backoffMultiplier,
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Все попытки исчерпаны, выбрасываем последнюю ошибку
    throw lastError;
  };
};

/**
 * Создает безопасный sink для внешнего SDK (не выбрасывает ошибки).
 *
 * Production-safe версия createExternalSink:
 * - Не выбрасывает ошибки при сбоях SDK
 * - Ошибки логируются через onError callback (если задан)
 * - Подходит для критичных production окружений
 * - Retry-ready: опциональный retry/backoff
 */
export const createExternalSinkSafe = <
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  sdk: ExternalSdk<TMetadata>, // SDK объект с методом capture
  onError?: (error: unknown, event: Readonly<TelemetryEvent<TMetadata>>) => void, // Обработчик ошибок SDK (опционально)
  retryConfig?: RetryConfig, // Опциональная конфигурация retry/backoff
): TelemetrySink<TMetadata> => {
  if (typeof sdk.capture !== 'function') {
    throw new Error('SDK must have a capture method that is a function');
  }

  const effectiveRetryConfig: Readonly<{
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  }> = Object.freeze({
    maxRetries: retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES,
    baseDelayMs: retryConfig?.baseDelayMs ?? 1000,
    maxDelayMs: retryConfig?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    backoffMultiplier: retryConfig?.backoffMultiplier ?? 2,
  });

  return async (event: Readonly<TelemetryEvent<TMetadata>>): Promise<void> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= effectiveRetryConfig.maxRetries; attempt++) {
      try {
        await sdk.capture(event);
        return; // Успешная отправка
      } catch (error) {
        lastError = error;

        // Если это не последняя попытка, ждем перед retry
        if (attempt < effectiveRetryConfig.maxRetries) {
          const delay = calculateBackoffDelay(
            attempt,
            effectiveRetryConfig.baseDelayMs,
            effectiveRetryConfig.maxDelayMs,
            effectiveRetryConfig.backoffMultiplier,
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Все попытки исчерпаны, логируем ошибку но не выбрасываем
    if (onError) {
      onError(lastError, event);
    }
    // Молча игнорируем ошибки для production stability
  };
};

/* ============================================================================
 * 🐛 УТИЛИТЫ ОТЛАДКИ (ТОЛЬКО ДЛЯ DEV)
 * ============================================================================
 *
 * ВАЖНО: Эти утилиты предназначены ТОЛЬКО для разработки и тестирования.
 * Они не должны использоваться в production коде.
 * Для production используйте lib/telemetry-runtime.ts с singleton логикой.
 */

/**
 * Ключ для хранения клиента в globalThis (только для dev).
 * @internal
 */
const GLOBAL_CLIENT_KEY = '__telemetryClient';

/**
 * Получает клиент телеметрии из globalThis для отладки.
 *
 * ВАЖНО: Только для dev режима!
 * Не использовать в production коде.
 *
 * Использование:
 * - Только в dev режиме
 * - Для отладки и тестирования
 * - Не для production кода
 *
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
