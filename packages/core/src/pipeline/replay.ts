/**
 * @file packages/core/src/pipeline/replay.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Replay Testing / Event Capture)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Сохранение событий pipeline для офлайн replay и тестирования
 * - Replay dataset для обучения/тестирования правил и моделей
 * - Причина изменения: ML training / rule development / offline testing
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, HELPERS (публичные и приватные), FILTERS, SANITIZERS, API
 * - ✅ Deterministic: pure functions для создания и фильтрации событий (injectable now для тестирования)
 * - ✅ Domain-pure: generic по типам событий, контекста и метаданных, без привязки к domain-специфичным типам
 * - ✅ Extensible: strategy pattern (custom filters, sanitizers, event factories) без изменения core логики
 * - ✅ Strict typing: generic типы для фильтров и санитизаторов, без string literals в domain
 * - ✅ Microservice-ready: stateless, injectable dependencies для тестирования, без скрытого coupling
 * - ✅ Scalable: поддержка множественных фильтров (последовательное применение), rate limiting, event hooks для мониторинга
 * - ✅ Privacy-first: PII sanitization через injectable sanitizers, минимизация чувствительных данных
 */

/* ============================================================================
 * 1. TYPES — REPLAY MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Захваченное событие для replay
 * @template TEventData - Тип данных события (generic, domain-agnostic)
 * @template TContext - Тип контекста pipeline (generic, domain-agnostic)
 * @template TMetadata - Тип метаданных события (generic, domain-agnostic)
 * @public
 */
export type ReplayEvent<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
> = Readonly<{
  /** Уникальный ID события */
  eventId: string;
  /** Timestamp события (ISO 8601) */
  timestamp: string;
  /** Данные события */
  eventData: TEventData;
  /** Контекст pipeline (после санитизации PII, если применимо) */
  context: TContext;
  /** Метаданные для фильтрации/поиска */
  metadata: TMetadata;
}>;

/**
 * Фильтр событий для выборочного сохранения (со стабильным ID)
 * @template TEventData - Тип данных события
 * @template TContext - Тип контекста pipeline
 * @template TMetadata - Тип метаданных события
 * @public
 */
export type ReplayEventFilter<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
> = Readonly<{
  /** Стабильный идентификатор фильтра (для observability) */
  filterId: string;
  /** Функция оценки фильтра */
  evaluate: (
    event: ReplayEvent<TEventData, TContext, TMetadata>, // Событие для проверки
  ) => boolean;
}>;

/**
 * Функция санитизации контекста для удаления PII
 * @template TContext - Тип контекста pipeline
 * @public
 */
export type ContextSanitizer<TContext extends Readonly<Record<string, unknown>>> = (
  context: TContext, // Исходный контекст
) => TContext;

/**
 * Функция сохранения события
 * @template TEventData - Тип данных события
 * @template TContext - Тип контекста pipeline
 * @template TMetadata - Тип метаданных события
 * @public
 */
export type ReplayEventSaver<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
> = (
  event: ReplayEvent<TEventData, TContext, TMetadata>, // Событие для сохранения
) => Promise<void> | void;

/**
 * Функция создания метаданных события
 * @template TMetadata - Тип метаданных события
 * @template TEventData - Тип данных события
 * @template TContext - Тип контекста pipeline
 * @public
 */
export type MetadataFactory<
  TMetadata extends Readonly<Record<string, unknown>>,
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
> = (
  eventData: TEventData, // Данные события
  context: TContext, // Контекст pipeline
) => TMetadata;

/**
 * Функция генерации ID события (для deterministic replay)
 * @public
 */
export type EventIdGenerator = (
  now: number, // Timestamp для deterministic testing
) => string;

/**
 * Конфигурация для replay capture
 * @template TEventData - Тип данных события (generic, domain-agnostic)
 * @template TContext - Тип контекста pipeline (generic, domain-agnostic)
 * @template TMetadata - Тип метаданных события (generic, domain-agnostic)
 * @public
 */
export type ReplayCaptureConfig<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
> = Readonly<{
  /** Включить capture событий */
  enabled: boolean;
  /** Функция для сохранения события (опционально) */
  saveEvent?: ReplayEventSaver<TEventData, TContext, TMetadata>;
  /** Фильтры для выборочного сохранения (опционально, применяются последовательно) */
  filters?: readonly ReplayEventFilter<TEventData, TContext, TMetadata>[];
  /** Функция санитизации контекста для удаления PII (обязательна, если includePII !== true) */
  sanitizeContext?: ContextSanitizer<TContext>;
  /** Максимальное количество событий для сохранения (rate limiting, опционально) */
  maxEventsPerMinute?: number;
  /** Включить PII данные (по умолчанию false для безопасности) */
  includePII?: boolean;
  /** Функция создания метаданных события (опционально) */
  createMetadata?: MetadataFactory<TMetadata, TEventData, TContext>;
  /** Функция генерации ID события (опционально, для deterministic replay) */
  generateEventId?: EventIdGenerator;
}>;

/**
 * Результат capture события
 * @public
 */
export type CaptureResult = Readonly<{
  /** Было ли событие сохранено */
  captured: boolean;
  /** Причина, по которой событие не было сохранено (если не сохранено) */
  reason?: string;
}>;

/**
 * Событие применения фильтра
 * @public
 */
export type FilterEvent = Readonly<{
  /** Идентификатор фильтра */
  filterId: string;
  /** Результат фильтрации */
  passed: boolean;
  /** Timestamp события */
  timestamp: number;
}>;

/**
 * Callback для событий применения фильтров
 * @public
 */
export type FilterEventHandler = (event: FilterEvent) => void;

/* ============================================================================
 * 2. CONSTANTS — DEFAULT CONFIGURATION
 * ============================================================================
 */

/** Дефолтное максимальное количество событий в минуту */
export const DEFAULT_MAX_EVENTS_PER_MINUTE = 1000;

/** Дефолтное значение для includePII (безопасность по умолчанию) */
export const DEFAULT_INCLUDE_PII = false;

/* ============================================================================
 * 3. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Дефолтная функция генерации ID события (с random для уникальности)
 * @public
 */
export function defaultEventIdGenerator(now: number = Date.now()): string {
  const radix36 = 36;
  const startIndex = 2;
  const endIndex = 11;
  const randomPart = Math.random().toString(radix36).substring(startIndex, endIndex);
  return `${now}-${randomPart}`;
}

/**
 * Детерминированная функция генерации ID события (для replay)
 * @public
 */
export function deterministicEventIdGenerator(now: number = Date.now()): string {
  // Используем только timestamp для детерминированности
  // Для уникальности в рамках одного timestamp можно добавить sequence number на уровне orchestration
  return `${now}`;
}

/**
 * Форматирует timestamp в ISO 8601
 * @public
 */
export function formatTimestamp(
  now: number = Date.now(), // Timestamp для deterministic testing (опционально)
): string {
  return new Date(now).toISOString();
}

/**
 * Проверяет, нужно ли сохранять событие (rate limiting)
 * @public
 */
export function shouldCaptureEvent(
  eventsInLastMinute: number, // Количество событий за последнюю минуту
  maxEventsPerMinute?: number, // Максимальное количество событий в минуту (опционально)
): boolean {
  const maxEvents = maxEventsPerMinute ?? DEFAULT_MAX_EVENTS_PER_MINUTE;
  return eventsInLastMinute < maxEvents;
}

/**
 * Применяет фильтры к событию последовательно
 * @template TEventData - Тип данных события
 * @template TContext - Тип контекста pipeline
 * @template TMetadata - Тип метаданных события
 * @public
 */
export function applyFilters<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
>(
  event: ReplayEvent<TEventData, TContext, TMetadata>, // Событие для фильтрации
  filters: readonly ReplayEventFilter<TEventData, TContext, TMetadata>[], // Массив фильтров для применения
  onFilterApplied?: FilterEventHandler, // Callback для событий применения фильтров (опционально)
  now: number = Date.now(), // Timestamp для deterministic testing (опционально)
): boolean {
  return filters.reduce<boolean>(
    (passed, filter) => {
      if (!passed) {
        return false;
      }

      const filterResult = filter.evaluate(event);

      if (onFilterApplied) {
        onFilterApplied({
          filterId: filter.filterId,
          passed: filterResult,
          timestamp: now,
        });
      }

      return filterResult;
    },
    true,
  );
}

/* ============================================================================
 * 4. FILTERS — DEFAULT FILTERS (Extensible Filter Engine)
 * ============================================================================
 */

/**
 * Создает комбинированный фильтр из нескольких фильтров (AND логика)
 * @template TEventData - Тип данных события
 * @template TContext - Тип контекста pipeline
 * @template TMetadata - Тип метаданных события
 * @public
 */
export function createCombinedFilter<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
>(
  filters: readonly ReplayEventFilter<TEventData, TContext, TMetadata>[], // Массив фильтров для комбинирования
  filterId: string = 'combined_filter', // Идентификатор комбинированного фильтра
): ReplayEventFilter<TEventData, TContext, TMetadata> {
  return {
    filterId,
    evaluate: (event: ReplayEvent<TEventData, TContext, TMetadata>): boolean => {
      return filters.every((filter) => filter.evaluate(event));
    },
  };
}

/* ============================================================================
 * 5. SANITIZERS — DEFAULT SANITIZERS (Extensible Sanitizer Engine)
 * ============================================================================
 */

/**
 * Создает санитизатор, который удаляет указанные поля из контекста
 * @template TContext - Тип контекста pipeline
 * @public
 */
export function createFieldRemovalSanitizer<TContext extends Readonly<Record<string, unknown>>>(
  fieldsToRemove: readonly (keyof TContext)[], // Массив имен полей для удаления
): ContextSanitizer<TContext> {
  return (context: TContext): TContext => {
    if (fieldsToRemove.length === 0) {
      return context;
    }

    const keysToRemove = new Set<keyof TContext>(fieldsToRemove);

    const result = Object.fromEntries(
      Object.entries(context).filter(([key]) => !keysToRemove.has(key as keyof TContext)),
    ) as TContext;

    return result;
  };
}

/**
 * Создает санитизатор, который применяет функцию трансформации к контексту
 * @template TContext - Тип контекста pipeline
 * @public
 */
export function createTransformSanitizer<TContext extends Readonly<Record<string, unknown>>>(
  transform: (context: TContext) => TContext, // Функция трансформации контекста
): ContextSanitizer<TContext> {
  return transform;
}

/**
 * Создает комбинированный санитизатор из нескольких санитизаторов (последовательное применение)
 * @template TContext - Тип контекста pipeline
 * @public
 */
export function createCombinedSanitizer<TContext extends Readonly<Record<string, unknown>>>(
  sanitizers: readonly ContextSanitizer<TContext>[], // Массив санитизаторов для комбинирования
): ContextSanitizer<TContext> {
  return (context: TContext): TContext => {
    return sanitizers.reduce<TContext>(
      (acc, sanitizer) => sanitizer(acc),
      context,
    );
  };
}

/* ============================================================================
 * 6. HELPERS — PRIVATE HELPER FUNCTIONS (SRP)
 * ============================================================================
 */

/**
 * Санитизирует контекст, если нужно (удаляет PII)
 * @template TContext - Тип контекста pipeline
 * @note Pure function: детерминированная санитизация
 * @note Бросает ошибку, если includePII !== true и sanitizeContext не задан (guardrail приватности)
 */
function sanitizeContextIfNeeded<TContext extends Readonly<Record<string, unknown>>>(
  context: TContext, // Исходный контекст
  config: Readonly<{
    includePII?: boolean;
    sanitizeContext?: ContextSanitizer<TContext>;
  }>, // Конфигурация replay capture
): TContext {
  // Если PII включен, не санитируем
  if (config.includePII === true) {
    return context;
  }

  // Если PII не включен, sanitizeContext обязателен (guardrail приватности)
  if (!config.sanitizeContext) {
    // eslint-disable-next-line fp/no-throw -- Guardrail приватности: обязательная санитизация PII для compliance
    throw new Error(
      'sanitizeContext is required when includePII !== true. PII data must be sanitized for security compliance.',
    );
  }

  return config.sanitizeContext(context);
}

/**
 * Создает метаданные события
 * @template TMetadata - Тип метаданных события
 * @template TEventData - Тип данных события
 * @template TContext - Тип контекста pipeline
 * @note Pure function: детерминированное создание метаданных
 */
function buildMetadata<
  TMetadata extends Readonly<Record<string, unknown>>,
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
>(
  eventData: TEventData, // Данные события
  context: TContext, // Контекст pipeline
  config: Readonly<{
    createMetadata?: MetadataFactory<TMetadata, TEventData, TContext>;
  }>, // Конфигурация replay capture
  createMetadata?: MetadataFactory<TMetadata, TEventData, TContext>, // Функция создания метаданных (опционально, используется из config если не указана)
): TMetadata {
  // eslint-disable-next-line ai-security/model-poisoning -- Валидация данных выполняется на уровне orchestration, здесь только создание метаданных
  const metadataFactory = createMetadata ?? config.createMetadata;
  if (metadataFactory) {
    return metadataFactory(eventData, context);
  }
  return {} as TMetadata;
}

/* ============================================================================
 * 7. API — PUBLIC FUNCTIONS
 * ============================================================================
 */

/**
 * Создает replay event из данных pipeline
 * @template TEventData - Тип данных события (generic, domain-agnostic)
 * @template TContext - Тип контекста pipeline (generic, domain-agnostic)
 * @template TMetadata - Тип метаданных события (generic, domain-agnostic)
 * @note Pure function: детерминированное создание события
 * @note Бросает ошибку, если includePII !== true и sanitizeContext не задан (guardrail приватности)
 * @public
 */
export function createReplayEvent<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
>(
  eventData: TEventData, // Данные события
  context: TContext, // Контекст pipeline
  config: ReplayCaptureConfig<TEventData, TContext, TMetadata>, // Конфигурация replay capture
  createMetadata?: MetadataFactory<TMetadata, TEventData, TContext>, // Функция создания метаданных (опционально, используется из config если не указана)
  now: number = Date.now(), // Timestamp для deterministic testing (опционально)
): ReplayEvent<TEventData, TContext, TMetadata> {
  // Санитируем контекст, если нужно (удаляем PII)
  const sanitizedContext = sanitizeContextIfNeeded(context, config);

  // Создаем метаданные
  // eslint-disable-next-line ai-security/model-poisoning -- Валидация данных выполняется на уровне orchestration, здесь только создание события
  const metadata = buildMetadata(eventData, sanitizedContext, config, createMetadata);

  // Генерируем ID события (используем injectable generator или дефолтный)
  const idGenerator = config.generateEventId ?? defaultEventIdGenerator;
  const eventId = idGenerator(now);

  return {
    eventId,
    timestamp: formatTimestamp(now),
    eventData,
    context: sanitizedContext,
    metadata,
  };
}

/**
 * Сохраняет replay event (если включено и проходит фильтры)
 * @template TEventData - Тип данных события (generic, domain-agnostic)
 * @template TContext - Тип контекста pipeline (generic, domain-agnostic)
 * @template TMetadata - Тип метаданных события (generic, domain-agnostic)
 * @note Pure function: детерминированная проверка и сохранение (saveEvent может быть async, но это side-effect на уровне orchestration)
 * @note Эта функция не блокирует основной flow - сохранение выполняется асинхронно через saveEvent
 * @public
 */
/** Проверяет, нужно ли сохранять событие (внутренний helper для снижения cognitive complexity) */
function shouldSaveEvent(
  enabled: boolean,
  eventsInLastMinute: number,
  maxEventsPerMinute?: number,
): CaptureResult | null {
  if (!enabled) {
    return {
      captured: false,
      reason: 'capture_disabled',
    };
  }

  if (!shouldCaptureEvent(eventsInLastMinute, maxEventsPerMinute)) {
    return {
      captured: false,
      reason: 'rate_limit_exceeded',
    };
  }

  return null;
}

/** Сохраняет событие через saveEvent (внутренний helper для снижения cognitive complexity) */
async function saveEventSafely<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
>(
  event: ReplayEvent<TEventData, TContext, TMetadata>,
  saveEvent: ReplayEventSaver<TEventData, TContext, TMetadata>,
): Promise<CaptureResult> {
  try {
    await saveEvent(event);
    return {
      captured: true,
    };
  } catch (error: unknown) {
    // Логируем ошибку, но не пробрасываем (fire-and-forget)
    return {
      captured: false,
      reason: error instanceof Error ? error.message : 'save_error',
    };
  }
}

export async function captureReplayEvent<
  TEventData extends Readonly<Record<string, unknown>>,
  TContext extends Readonly<Record<string, unknown>>,
  TMetadata extends Readonly<Record<string, unknown>>,
>(
  event: ReplayEvent<TEventData, TContext, TMetadata>, // Replay event для сохранения
  config: ReplayCaptureConfig<TEventData, TContext, TMetadata>, // Конфигурация replay capture
  eventsInLastMinute: number, // Количество событий за последнюю минуту (для rate limiting)
  onFilterApplied?: FilterEventHandler, // Callback для событий применения фильтров (опционально, для мониторинга)
  now: number = Date.now(), // Timestamp для deterministic testing (опционально)
): Promise<CaptureResult> {
  // Проверяем базовые условия сохранения
  const earlyReturn = shouldSaveEvent(
    config.enabled,
    eventsInLastMinute,
    config.maxEventsPerMinute,
  );
  if (earlyReturn) {
    return earlyReturn;
  }

  // Применяем фильтры (если указаны)
  const filterResult = config.filters && config.filters.length > 0
    ? applyFilters(event, config.filters, onFilterApplied, now)
    : true;

  if (!filterResult) {
    return {
      captured: false,
      reason: 'filter_rejected',
    };
  }

  // Сохраняем событие (fire-and-forget, не блокирует pipeline)
  if (config.saveEvent) {
    return saveEventSafely(event, config.saveEvent);
  }

  // Если saveEvent не указан, считаем что событие "захвачено" (но не сохранено)
  return {
    captured: true,
  };
}
