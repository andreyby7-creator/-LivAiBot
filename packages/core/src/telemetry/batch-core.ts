/**
 * @file @livai/core/src/telemetry/batch-core.ts
 * ============================================================================
 * 🎯 BATCH CORE — ЧИСТОЕ МИКРОСЕРВИСНОЕ ЯДРО ТЕЛЕМЕТРИИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Чистая изоляция batch логики без внешних зависимостей
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
} from '@livai/core-contracts';
import { BatchCoreConfigVersion } from '@livai/core-contracts';

import { applyPIIRedactionMiddleware } from './sanitization.js';

/* ============================================================================
 * 🔧 ТИПЫ И ИНТЕРФЕЙСЫ
 * ============================================================================
 */

/**
 * Hook для transformEvent перед flush.
 * Позволяет внешним слоям адаптировать события без изменения core.
 * @param event - Исходное событие
 * @returns Трансформированное событие
 */
export type TransformEventHook<TMetadata extends TelemetryMetadata = TelemetryMetadata> = (
  event: TelemetryEvent<TMetadata>,
) => TelemetryEvent<TMetadata>;

/** Конфигурация batch core с опциональными middleware и hooks. */
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
// eslint-disable-next-line ai-security/model-poisoning -- Константа конфигурации (не пользовательские данные)
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

  // NOTE: При будущих изменениях configVersion добавить валидацию версии для backward-compatibility
  // Например: if (baseConfig.configVersion > BatchCoreConfigVersion) { throw new Error('Unsupported config version') }
  return {
    batch: [],
    config: baseConfig,
  };
}

/**
 * Добавляет событие в batch без мутаций.
 * Чистая функция, возвращает новое состояние.
 * Применяет PII redaction middleware если включен в config.
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
  // eslint-disable ai-security/model-poisoning -- event создается из валидированных параметров, не из пользовательских данных
  const initialEvent: TelemetryEvent<TMetadata> = {
    level,
    message,
    timestamp,
    ...(metadata !== undefined && { metadata }),
  };

  // Применяем PII redaction middleware если включен
  const eventAfterPII = extendedConfig?.enablePIIRedaction === true
    ? applyPIIRedactionMiddleware(initialEvent, extendedConfig.enableDeepPIIScan === true)
    : initialEvent;

  // Применяем transformEvent hook если есть
  const finalEvent = extendedConfig?.transformEvent
    ? extendedConfig.transformEvent(eventAfterPII)
    : eventAfterPII;
  // eslint-enable ai-security/model-poisoning

  // eslint-disable-next-line ai-security/model-poisoning -- finalEvent создан из валидированных параметров
  const newBatch = [...state.batch, finalEvent];

  return {
    batch: newBatch,
    config: state.config,
  };
}

/**
 * Выполняет flush batch и возвращает события для отправки.
 * Чистая функция для извлечения накопленных событий.
 * Применяет transformEvent hook к каждому событию перед flush если включен.
 * @internal Используйте telemetryBatchCore.flush вместо этого
 */
export function flushBatchCore<
  TMetadata extends TelemetryMetadata = TelemetryMetadata,
>(
  state: TelemetryBatchCoreState<TMetadata>,
  extendedConfig?: TelemetryBatchCoreConfigExtended<TMetadata>,
): [TelemetryBatchCoreState<TMetadata>, readonly TelemetryEvent<TMetadata>[]] {
  // Применяем transformEvent hook к каждому событию перед flush
  const eventsToFlush = extendedConfig?.transformEvent
    ? state.batch.map((event) => {
      const transformEvent = extendedConfig.transformEvent;
      return transformEvent ? transformEvent(event) : event;
    })
    : state.batch;

  const newState = {
    batch: [],
    config: state.config, // Сохраняем ссылку на config для reference equality
  };

  return [newState, eventsToFlush];
}

/**
 * Проверяет необходимость flush batch.
 * Чистая функция для принятия решения о сбросе.
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
// eslint-disable-next-line ai-security/model-poisoning -- Константа API объекта (не пользовательские данные)
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
