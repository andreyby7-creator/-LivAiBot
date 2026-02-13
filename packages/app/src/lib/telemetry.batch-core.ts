/**
 * @file packages/app/src/lib/telemetry.batch-core.ts
 * ============================================================================
 * 🎯 BATCH CORE — ЧИСТОЕ МИКРОСЕРВИСНОЕ ЯДРО ТЕЛЕМЕТРИИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Чистая изоляция batch логики без внешних зависимостей
 * - Иммутабельные структуры данных и функциональная парадигма
 * - Enterprise-ready batch обработка для высокой производительности
 * - Полная совместимость с hexagonal architecture паттернами
 * - Нулевая связанность с React, DOM или внешними SDK
 *
 * Свойства:
 * - Effect-free архитектура для предсказуемости и тестируемости
 * - Иммутабельные структуры данных и функциональная парадигма
 * - Batch оптимизация для снижения сетевых запросов
 * - Типобезопасность с branded types и readonly контрактами
 * - Расширяемость для enterprise сценариев (A/B тестирование, аналитика)
 * - Минимальная поверхность API для максимальной гибкости
 *
 * Принципы:
 * - Никаких I/O операций (файлы, сеть, консоль, DOM)
 * - Никакой асинхронности и таймаутов
 * - Никаких побочных эффектов и мутаций глобального состояния
 * - Детерминированные результаты для одного входа
 * - Предсказуемая аллокация через чистую иммутабельную модель
 * - Полная изоляция от runtime зависимостей (SSR-safe)
 *
 * Почему чистый модуль:
 * - Разделение ответственности: core ≠ transport ≠ React bindings
 * - Легкость тестирования без моков и стабов
 * - Возможность переиспользования в разных runtime (web, mobile, server)
 * - Независимое развитие и deployment микросервисной архитектуры
 */

import type {
  TelemetryBatchCoreConfig,
  TelemetryBatchCoreState,
  TelemetryEvent,
  TelemetryLevel,
  TelemetryMetadata,
} from '../types/telemetry.js';
import { BatchCoreConfigVersion } from '../types/telemetry.js';

/* ============================================================================
 * 🔧 ТИПЫ И ИНТЕРФЕЙСЫ
 * ============================================================================
 */

/**
 * PII redaction patterns для проверки на уровне core.
 * Используется для гарантии, что ни одно событие не попадет с PII до transport.
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
 * Middleware для PII redaction на уровне core.
 * Гарантирует, что ни одно событие не попадет с чувствительными данными до transport.
 *
 * @param metadata - Метаданные для проверки
 * @param deep - Включить глубокую рекурсивную проверку (по умолчанию false для производительности)
 * @returns true если обнаружен PII
 */
function containsPII(
  metadata: TelemetryMetadata | undefined,
  deep = false,
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

    // Рекурсивная проверка вложенных объектов (опционально)
    if (deep && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (containsPII(value as TelemetryMetadata, true)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Redact PII из metadata.
 * Заменяет PII-поля на '[REDACTED]'.
 *
 * @param metadata - Метаданные для очистки
 * @param deep - Включить глубокую рекурсивную очистку
 * @returns Очищенные метаданные
 */
function redactPII(
  metadata: TelemetryMetadata,
  deep = false,
): TelemetryMetadata {
  const sanitized = { ...metadata } as Record<string, unknown>;

  for (const [key, value] of Object.entries(sanitized)) {
    // Проверка ключа на PII patterns
    if (PII_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && PII_PATTERNS.some((pattern) => pattern.test(value))) {
      // Проверка значения на PII patterns
      sanitized[key] = '[REDACTED]';
    } else if (deep && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Рекурсивная очистка вложенных объектов
      sanitized[key] = redactPII(value as TelemetryMetadata, true);
    }
  }

  return sanitized as TelemetryMetadata;
}

/**
 * Middleware для PII redaction на уровне core.
 * Гарантирует, что ни одно событие не попадет с чувствительными данными до transport.
 *
 * @param event - Событие для проверки
 * @param enableDeepScan - Включить глубокую рекурсивную проверку (по умолчанию false)
 * @returns Событие с очищенными метаданными (или без metadata если содержит PII)
 */
function applyPIIRedactionMiddleware<TMetadata extends TelemetryMetadata>(
  event: TelemetryEvent<TMetadata>,
  enableDeepScan = false,
): TelemetryEvent<TMetadata> {
  if (!event.metadata) {
    return event;
  }

  // Проверяем на PII
  if (containsPII(event.metadata, enableDeepScan)) {
    // Если обнаружен PII, удаляем metadata полностью для безопасности
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { metadata: _removedMetadata, ...eventWithoutMetadata } = event;
    return eventWithoutMetadata as TelemetryEvent<TMetadata>;
  }

  // Если PII не обнаружен, но включена очистка, применяем redaction
  if (enableDeepScan) {
    const sanitizedMetadata = redactPII(event.metadata, true);
    return {
      ...event,
      metadata: sanitizedMetadata as TMetadata,
    };
  }

  return event;
}

/**
 * Hook для transformEvent перед flush.
 * Позволяет внешним слоям адаптировать события без изменения core.
 *
 * @param event - Исходное событие
 * @returns Трансформированное событие
 */
export type TransformEventHook<TMetadata extends TelemetryMetadata = TelemetryMetadata> = (
  event: TelemetryEvent<TMetadata>,
) => TelemetryEvent<TMetadata>;

/**
 * Конфигурация batch core с опциональными middleware и hooks.
 */
export type TelemetryBatchCoreConfigExtended<
  TMetadata extends TelemetryMetadata = TelemetryMetadata,
> =
  & TelemetryBatchCoreConfig
  & Readonly<{
    /** Включить PII redaction middleware на уровне core (по умолчанию false) */
    enablePIIRedaction?: boolean;
    /** Включить глубокую рекурсивную проверку PII (по умолчанию false, медленно для больших объектов) */
    enableDeepPIIScan?: boolean;
    /** Hook для transformEvent перед flush (позволяет внешним слоям адаптировать события) */
    transformEvent?: TransformEventHook<TMetadata>;
  }>;

/* ============================================================================
 * ⚙️ КОНФИГУРАЦИЯ ПО УМОЛЧАНИЮ
 * ========================================================================== */

/**
 * Конфигурация по умолчанию для batch core.
 * Оптимизирована для enterprise сценариев.
 */
export const defaultBatchCoreConfig = {
  maxBatchSize: 50,
  configVersion: BatchCoreConfigVersion,
} as const satisfies TelemetryBatchCoreConfig;

/* ============================================================================
 * 🎯 ЧИСТЫЕ ФУНКЦИИ BATCH CORE
 * ========================================================================== */

/**
 * Создает начальное состояние batch core.
 * Гарантирует чистоту и предсказуемость инициализации.
 *
 * @param config - Конфигурация batch core (может включать middleware и hooks)
 */
export function createInitialBatchCoreState<
  TMetadata extends TelemetryMetadata = TelemetryMetadata,
>(
  config: TelemetryBatchCoreConfig | TelemetryBatchCoreConfigExtended<TMetadata> =
    defaultBatchCoreConfig,
): TelemetryBatchCoreState<TMetadata> {
  // Если config является базовым TelemetryBatchCoreConfig (без расширенных полей),
  // сохраняем ссылку для reference equality. Иначе создаем новый объект.
  const baseConfig: TelemetryBatchCoreConfig =
    'enablePIIRedaction' in config || 'enableDeepPIIScan' in config || 'transformEvent' in config
      ? {
        maxBatchSize: config.maxBatchSize,
        configVersion: config.configVersion,
      }
      : config as TelemetryBatchCoreConfig;
  return {
    batch: [],
    config: baseConfig,
  };
}

/**
 * Добавляет событие в batch без мутаций.
 * Чистая функция, возвращает новое состояние.
 * Применяет PII redaction middleware если включен в config.
 *
 * @internal Используйте telemetryBatchCore.addEvent вместо этого
 */
export function addEventToBatchCore<
  TMetadata extends TelemetryMetadata = TelemetryMetadata,
>(
  state: TelemetryBatchCoreState<TMetadata>,
  level: TelemetryLevel,
  message: string,
  metadata: TMetadata | undefined,
  timestamp: number,
  extendedConfig?: TelemetryBatchCoreConfigExtended<TMetadata>,
): TelemetryBatchCoreState<TMetadata> {
  let event: TelemetryEvent<TMetadata> = {
    level,
    message,
    timestamp,
    ...(metadata !== undefined && { metadata }),
  };

  // Применяем PII redaction middleware если включен
  if (extendedConfig?.enablePIIRedaction === true) {
    event = applyPIIRedactionMiddleware(event, extendedConfig.enableDeepPIIScan === true);
  }

  // Применяем transformEvent hook если есть
  if (extendedConfig?.transformEvent) {
    event = extendedConfig.transformEvent(event);
  }

  const newBatch = [...state.batch, event];

  return {
    batch: newBatch,
    config: state.config,
  };
}

/**
 * Выполняет flush batch и возвращает события для отправки.
 * Чистая функция для извлечения накопленных событий.
 * Применяет transformEvent hook к каждому событию перед flush если включен.
 *
 * @internal Используйте telemetryBatchCore.flush вместо этого
 */
export function flushBatchCore<
  TMetadata extends TelemetryMetadata = TelemetryMetadata,
>(
  state: TelemetryBatchCoreState<TMetadata>,
  extendedConfig?: TelemetryBatchCoreConfigExtended<TMetadata>,
): [TelemetryBatchCoreState<TMetadata>, readonly TelemetryEvent<TMetadata>[]] {
  let eventsToFlush = [...state.batch];

  // Применяем transformEvent hook к каждому событию перед flush
  if (extendedConfig?.transformEvent) {
    const transformEvent = extendedConfig.transformEvent;
    eventsToFlush = eventsToFlush.map((event) => transformEvent(event));
  }

  const newState = {
    batch: [],
    config: state.config, // Сохраняем ссылку на config для reference equality
  };

  return [newState, eventsToFlush];
}

/**
 * Проверяет необходимость flush batch.
 * Чистая функция для принятия решения о сбросе.
 *
 * @internal Используйте telemetryBatchCore.shouldFlush вместо этого
 */
export function shouldFlushBatchCore<
  TMetadata extends TelemetryMetadata = TelemetryMetadata,
>(
  state: TelemetryBatchCoreState<TMetadata>,
): boolean {
  return state.batch.length >= state.config.maxBatchSize;
}

/* ============================================================================
 * 🎪 BATCH CORE API ОБЪЕКТ
 * ========================================================================== */

/**
 * Иммутабельный batch core объект.
 * Предоставляет чистое API для работы с batch без зависимостей.
 * Поддерживает опциональные middleware для PII redaction и hooks для transformEvent.
 */
export const telemetryBatchCore = {
  /** Создает начальное состояние batch. */
  createInitialState<
    TMetadata extends TelemetryMetadata = TelemetryMetadata,
  >(
    config?: TelemetryBatchCoreConfig | TelemetryBatchCoreConfigExtended<TMetadata>,
  ): TelemetryBatchCoreState<TMetadata> {
    return createInitialBatchCoreState(config);
  },

  /** Добавляет событие в batch. Возвращает функцию для применения к состоянию. */
  addEvent<
    TMetadata extends TelemetryMetadata = TelemetryMetadata,
  >(
    level: TelemetryLevel,
    message: string,
    metadata: TMetadata | undefined,
    timestamp: number,
    extendedConfig?: TelemetryBatchCoreConfigExtended<TMetadata>,
  ): (state: TelemetryBatchCoreState<TMetadata>) => TelemetryBatchCoreState<TMetadata> {
    return (state: TelemetryBatchCoreState<TMetadata>) =>
      addEventToBatchCore(state, level, message, metadata, timestamp, extendedConfig);
  },

  /** Возвращает внутренний batch. Не для мутаций (readonly contract). */
  getBatch<
    TMetadata extends TelemetryMetadata = TelemetryMetadata,
  >(
    state: TelemetryBatchCoreState<TMetadata>,
  ): readonly TelemetryEvent<TMetadata>[] {
    return state.batch;
  },

  /** Выполняет flush batch. */
  flush<
    TMetadata extends TelemetryMetadata = TelemetryMetadata,
  >(
    state: TelemetryBatchCoreState<TMetadata>,
    extendedConfig?: TelemetryBatchCoreConfigExtended<TMetadata>,
  ): [TelemetryBatchCoreState<TMetadata>, readonly TelemetryEvent<TMetadata>[]] {
    return flushBatchCore(state, extendedConfig);
  },

  /** Проверяет необходимость flush. */
  shouldFlush<
    TMetadata extends TelemetryMetadata = TelemetryMetadata,
  >(
    state: TelemetryBatchCoreState<TMetadata>,
  ): boolean {
    return shouldFlushBatchCore(state);
  },
} as const;

/* ============================================================================
 * 📚 ДОКУМЕНТАЦИЯ И ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
 * ========================================================================== */

/**
 * @example Базовое использование
 * ```typescript
 * let state = telemetryBatchCore.createInitialState();
 * state = telemetryBatchCore.addEvent('INFO', 'User action', { id: '123' }, Date.now())(state);
 * if (telemetryBatchCore.shouldFlush(state)) {
 *   const [newState, events] = telemetryBatchCore.flush(state);
 *   externalService.sendBatch(events);
 * }
 * ```
 *
 * @example С PII redaction middleware
 * ```typescript
 * const config = { maxBatchSize: 50, enablePIIRedaction: true, enableDeepPIIScan: false };
 * let state = telemetryBatchCore.createInitialState(config);
 * state = telemetryBatchCore.addEvent('INFO', 'Action', { password: 'secret' }, Date.now(), config)(state);
 * // password автоматически удаляется из metadata
 * ```
 *
 * @example С transformEvent hook
 * ```typescript
 * const config = { transformEvent: (e) => ({ ...e, environment: process.env.NODE_ENV }) };
 * const [newState, events] = telemetryBatchCore.flush(state, config);
 * // events содержат трансформированные события
 * ```
 */
