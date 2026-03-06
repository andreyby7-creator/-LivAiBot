/**
 * @file @livai/core-contracts/src/domain/telemetry.ts
 * ============================================================================
 * 🧱 ОБЩИЕ ТИПЫ ТЕЛЕМЕТРИИ
 * ============================================================================
 *
 * Содержит фундаментальные типы телеметрии, используемые как core,
 * так и публичным API. Разделены для избежания циклических зависимостей.
 *
 * Архитектурная роль:
 * - Foundation-слой типов для телеметрии
 * - Без зависимостей от app-специфичных типов (UiMetrics и т.д.)
 * - Переиспользуемы в core и других пакетах
 */

/* ============================================================================
 * 🏷️ ОСНОВНЫЕ ТИПЫ УРОВНЕЙ
 * ========================================================================== */

/** Уровни важности телеметрических событий */
export const TelemetryLevels = ['INFO', 'WARN', 'ERROR'] as const;

/** Тип уровня телеметрического события */
export type TelemetryLevel = (typeof TelemetryLevels)[number];

/**
 * Template literal type для future-proofing уровней.
 * Автоматически типизирует новые уровни при добавлении в TelemetryLevels.
 */
export type TelemetryLevelTemplate = `level:${TelemetryLevel}` | TelemetryLevel;

/* ============================================================================
 * 📊 ТИПЫ СОБЫТИЙ
 * ========================================================================== */

/** Примитивные типы для метаданных телеметрии */
export type TelemetryPrimitive = string | number | boolean | null;

/**
 * Branded type для PII-полей.
 * Предотвращает accidental leaks чувствительных данных.
 * Используется для type-level защиты от передачи PII в metadata.
 */
export type PIIField = string & { readonly __brand: 'PII'; };

/**
 * Branded type для non-PII полей.
 * Явно маркирует безопасные для логирования данные.
 */
export type NonPIIField = string & { readonly __brand: 'NonPII'; };

/**
 * Типизированные метаданные телеметрии.
 * ВАЖНО: Типы не гарантируют отсутствие PII в runtime.
 * Runtime проверка через sanitizeMetadata обязательна для enterprise систем.
 * Branded types (PIIField, NonPIIField) помогают предотвратить accidental leaks на уровне типов.
 */
export type TelemetryMetadata = Readonly<Record<string, TelemetryPrimitive>>;

/**
 * Timezone для телеметрии.
 * Рекомендуется использовать 'UTC' для enterprise систем.
 */
export type TelemetryTimezone = string;

/**
 * Телеметрическое событие - иммутабельная структура данных.
 * Содержит всю необходимую информацию для аналитики и мониторинга.
 * Архитектурные свойства:
 * - Полностью readonly для защиты от мутаций
 * - Поддержка distributed tracing через spanId/correlationId
 * - UTC timestamp для микросервисной архитектуры
 * - Extensible: добавление новых полей не требует изменения core
 * Timezone:
 * - По умолчанию UTC
 * - Для enterprise-grade trace aggregation можно указать другой timezone
 */
export type TelemetryEvent<
  TMetadata = TelemetryMetadata,
> = Readonly<{
  /** Уровень важности события */
  readonly level: TelemetryLevel;
  /** Сообщение события */
  readonly message: string;
  /** Дополнительные метаданные (readonly для защиты от мутаций) */
  readonly metadata?: Readonly<TMetadata>;
  /** Временная метка события в UTC (milliseconds since epoch) */
  readonly timestamp: number;
  /** ID span для distributed tracing (опционально) */
  readonly spanId?: string;
  /** Correlation ID для связывания событий (опционально) */
  readonly correlationId?: string;
  /** Trace ID для distributed tracing (опционально) */
  readonly traceId?: string;
  /** Timezone для enterprise-grade trace aggregation (опционально) */
  readonly timezone?: TelemetryTimezone;
}>;

/* ============================================================================
 * 🔧 ТИПЫ BATCH CORE
 * ========================================================================== */

/**
 * Конфигурация иммутабельного batch ядра.
 * Определяет поведение чистой batch обработки.
 */
export type TelemetryBatchCoreConfig = Readonly<{
  /** Максимальный размер batch перед автоматическим flush */
  readonly maxBatchSize: number;
  /** Временная метка создания конфигурации */
  readonly configVersion: number;
}>;

/**
 * Состояние иммутабельного batch ядра.
 * Полностью иммутабельная структура для функционального программирования.
 */
export interface TelemetryBatchCoreState<
  TMetadata = TelemetryMetadata,
> {
  /** Иммутабельный массив событий в batch (только чтение) */
  readonly batch: readonly TelemetryEvent<TMetadata>[];
  /** Конфигурация ядра */
  readonly config: TelemetryBatchCoreConfig;
}

/* ============================================================================
 * ⚙️ КОНСТАНТЫ
 * ========================================================================== */

/** Версия конфигурации batch core для миграций */
// eslint-disable-next-line ai-security/model-poisoning
export const BatchCoreConfigVersion = 1;

/**
 * Default timezone для телеметрии.
 * Используется по умолчанию для всех событий телеметрии.
 */
export const defaultTelemetryTimezone: TelemetryTimezone = 'UTC';

/* ============================================================================
 * 🔌 ТИПЫ SINK
 * ========================================================================== */

/** Sink - абстракция для отправки событий (console, внешние SDK и т.д.)*/
export type TelemetrySink<TMetadata = TelemetryMetadata> = (
  event: TelemetryEvent<TMetadata>,
) => void | Promise<void>;

/**
 * Конфигурация retry для внешних SDK.
 * Exponential backoff для надежной доставки событий.
 */
export type RetryConfig = Readonly<{
  /** Максимальное количество попыток (по умолчанию 3) */
  maxRetries?: number;
  /** Базовая задержка перед retry в миллисекундах (по умолчанию 1000) */
  baseDelayMs?: number;
  /** Максимальная задержка перед retry в миллисекундах (по умолчанию 10000) */
  maxDelayMs?: number;
  /** Множитель для exponential backoff (по умолчанию 2) */
  backoffMultiplier?: number;
}>;

/**
 * Политика отбрасывания событий при переполнении очереди.
 * Используется в TelemetryClient при превышении maxQueueSize.
 * @remarks
 * - `'oldest'`: удаляет самые старые события из очереди (FIFO)
 * - `'newest'`: игнорирует новые события, сохраняя старые в очереди
 * - `'error'`: выбрасывает ошибку при переполнении очереди, прерывая обработку
 *   (рекомендуется для критичных систем, где потеря событий недопустима)
 */
export type DropPolicy = 'oldest' | 'newest' | 'error';

/**
 * Конфигурация batching для high-throughput систем.
 * Поддерживает event queue, backpressure и drop-policy для production-ready систем.
 * @remarks
 * Используется в TelemetryClient для управления batch-обработкой событий.
 * Взаимосвязь с TelemetryClient:
 * - maxBatchSize определяет размер batch перед отправкой в sinks
 * - maxConcurrentBatches ограничивает параллельную обработку для контроля нагрузки
 * - maxQueueSize + dropPolicy управляют backpressure при высокой нагрузке
 * - При превышении maxQueueSize применяется dropPolicy для управления переполнением
 * Рекомендации:
 * - Для high-throughput: увеличьте maxBatchSize и maxConcurrentBatches
 * - Для критичных систем: используйте dropPolicy: 'error' для предотвращения потери событий
 * - Для production: настройте maxQueueSize в зависимости от ожидаемой нагрузки
 */
export type BatchConfig = Readonly<{
  /** Максимальный размер batch для параллельной обработки событий (по умолчанию 10) */
  maxBatchSize?: number;
  /** Максимальное количество параллельных batches (по умолчанию 5) */
  maxConcurrentBatches?: number;
  /** Максимальный размер очереди событий (0 = без ограничений, по умолчанию 1000) */
  maxQueueSize?: number;
  /** Политика отбрасывания событий при переполнении очереди (по умолчанию 'oldest') */
  dropPolicy?: DropPolicy;
}>;

/**
 * Конфигурация throttle для log suppression.
 * Защита от DoS через логирование повторяющихся ошибок.
 * @remarks
 * Используется в TelemetryClient для подавления повторяющихся событий.
 * Взаимосвязь с TelemetryClient:
 * - TelemetryClient отслеживает одинаковые события (по level + message) в течение throttlePeriodMs
 * - При превышении maxErrorsPerPeriod события подавляются (не отправляются в sinks)
 * - Throttle работает независимо от BatchConfig, но влияет на размер очереди
 * - Рекомендуется использовать вместе с BatchConfig для оптимальной производительности
 * Рекомендации:
 * - Для production: настройте maxErrorsPerPeriod в зависимости от ожидаемого объема логов
 * - Для debug: уменьшите throttlePeriodMs для более частого логирования
 * - Для enterprise: комбинируйте с BatchConfig для баланса между производительностью и детализацией
 */
export type ThrottleConfig = Readonly<{
  /** Максимальное количество одинаковых ошибок за период (по умолчанию 10) */
  maxErrorsPerPeriod?: number;
  /** Период throttle в миллисекундах (по умолчанию 60000 = 1 минута) */
  throttlePeriodMs?: number;
}>;

/**
 * Type-level validation для customLevelPriority.
 * Гарантирует, что ключи не конфликтуют со стандартными уровнями.
 */
export type CustomLevelPriority = Readonly<
  Record<Exclude<string, TelemetryLevel>, number>
>;

/**
 * Runtime валидация customLevelPriority на уникальность ключей и отсутствие конфликтов.
 * Проверяет, что ключи не конфликтуют со стандартными уровнями (INFO, WARN, ERROR).
 * @param customLevelPriority - карта приоритетов для кастомных уровней
 * @returns валидированная карта приоритетов
 * @throws {Error} если обнаружены дубликаты ключей или конфликты со стандартными уровнями
 *
 * @example
 * ```typescript
 * const validated = validateCustomLevelPriority({
 *   DEBUG: 0,
 *   TRACE: -1,
 * });
 * ```
 */
export function validateCustomLevelPriority(
  customLevelPriority: Readonly<Record<string, number>> | undefined,
): Readonly<Record<string, number>> {
  if (!customLevelPriority || Object.keys(customLevelPriority).length === 0) {
    return {};
  }

  const standardLevels: readonly string[] = ['INFO', 'WARN', 'ERROR'];
  const keys = Object.keys(customLevelPriority);

  // Проверка на конфликты со стандартными уровнями
  const conflictingKey = keys.find((key) => standardLevels.includes(key));
  if (conflictingKey !== undefined) {
    throw new Error(
      `customLevelPriority: ключ "${conflictingKey}" конфликтует со стандартным уровнем. Используйте другой ключ.`,
    );
  }

  // Проверка на дубликаты (case-insensitive для безопасности)
  const lowerKeys = keys.map((key) => key.toLowerCase());
  const uniqueLowerKeys = new Set(lowerKeys);
  if (lowerKeys.length !== uniqueLowerKeys.size) {
    const duplicateIndex = lowerKeys.findIndex(
      (lowerKey, index) => lowerKeys.indexOf(lowerKey) !== index,
    );
    const duplicateKey = keys[duplicateIndex];
    throw new Error(
      `customLevelPriority: обнаружен дубликат ключа "${duplicateKey}". Ключи должны быть уникальными.`,
    );
  }

  // Проверка на валидность значений (должны быть числа)
  const invalidEntry = Object.entries(customLevelPriority).find(
    ([, value]) => typeof value !== 'number' || !Number.isFinite(value),
  );
  if (invalidEntry) {
    const [key, value] = invalidEntry;
    throw new Error(
      `customLevelPriority: значение для ключа "${key}" должно быть конечным числом, получено: ${typeof value}`,
    );
  }

  return customLevelPriority;
}

/**
 * Fallback priority для enterprise систем.
 * Используется, если уровень не определен ни в levelPriority, ни в customLevelPriority.
 * Для больших enterprise-систем рекомендуется документировать fallback стратегию.
 */
export type FallbackPriorityStrategy = 'ignore' | 'log' | 'error';

/**
 * Конфигурация телеметрии - передается при инициализации.
 * Архитектурные свойства:
 * - Extensible: добавление новых опций не требует изменения core
 * - Testable: injection timestamp для unit-тестов (runtime зависимость)
 * - Safe: sanitization metadata для защиты от PII (runtime проверка обязательна)
 * - High-throughput: batching для масштабируемости
 * - Secure: throttle для защиты от DoS
 * - Enterprise-ready: timezone для distributed tracing
 * Runtime зависимости:
 * - getTimestamp: runtime функция, может быть мокирована для тестов
 * - sanitizeMetadata: runtime функция, обязательна для enterprise систем
 * - customLevelPriority: используйте validateCustomLevelPriority() для runtime валидации
 * PII Protection:
 * - Типы не гарантируют отсутствие PII в metadata
 * - Runtime проверка через sanitizeMetadata обязательна
 * - Branded types (PIIField, NonPIIField) помогают предотвратить accidental leaks на уровне типов
 */
export type TelemetryConfig<
  TMetadata = TelemetryMetadata,
> = Readonly<{
  /** Минимальный уровень для логирования */
  levelThreshold?: TelemetryLevel;
  /** Массив получателей событий (readonly для защиты от мутаций) */
  sinks?: readonly TelemetrySink<TMetadata>[];
  /** Callback для ошибок sinks */
  onError?: (error: unknown, event: TelemetryEvent<TMetadata>) => void;
  /** Функция получения timestamp (для тестируемости, по умолчанию Date.now) - runtime зависимость */
  getTimestamp?: () => number;
  /**
   * Функция sanitization metadata (для защиты от PII, deep freeze применяется автоматически).
   * Рекомендуется для enterprise-среды вместо regex-based detection.
   * Для реализации allow-list schema используйте typed metadata contracts с валидацией через Zod или аналогичные библиотеки.
   */
  sanitizeMetadata?: (metadata: TMetadata) => Readonly<TMetadata>;
  /**
   * Кастомная карта приоритетов для пользовательских уровней (extensible rule-engine).
   * Type-level validation: ключи не должны конфликтовать со стандартными уровнями (TelemetryLevel).
   * Для runtime валидации используйте validateCustomLevelPriority().
   * Fallback: для enterprise систем рекомендуется документировать стратегию обработки неопределенных уровней.
   */
  customLevelPriority?: CustomLevelPriority;
  /** Конфигурация batching для high-throughput систем */
  batchConfig?: BatchConfig;
  /** Конфигурация throttle для log suppression */
  throttleConfig?: ThrottleConfig;
  /** Timezone для distributed tracing (по умолчанию 'UTC') */
  timezone?: TelemetryTimezone;
  /** Включить deep freeze для metadata (по умолчанию true, отключить для больших объектов для производительности) */
  enableDeepFreeze?: boolean;
  /** Включить сканирование значений на PII (по умолчанию false, только ключи проверяются) */
  enablePIIValueScan?: boolean;
  /**
   * Включить regex-based PII detection (по умолчанию true, но НЕ рекомендуется для production).
   * Regex-подход имеет false negatives и не гарантирует защиту от PII.
   * Для enterprise-среды рекомендуется:
   * - Отключить enableRegexPIIDetection (установить false)
   * - Использовать allow-list schema через typed metadata contracts
   * - Передавать кастомный sanitizeMetadata в config
   */
  enableRegexPIIDetection?: boolean;
  /**
   * Стратегия fallback для неопределенных уровней (enterprise).
   * Используется, если уровень не найден ни в levelPriority, ни в customLevelPriority.
   * По умолчанию: 'ignore' (событие игнорируется)
   */
  fallbackPriorityStrategy?: FallbackPriorityStrategy;
}>;
