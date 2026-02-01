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
 */
export function createInitialBatchCoreState<
  TMetadata = TelemetryMetadata,
>(
  config: TelemetryBatchCoreConfig = defaultBatchCoreConfig,
): TelemetryBatchCoreState<TMetadata> {
  return {
    batch: [],
    config,
  };
}

/**
 * Добавляет событие в batch без мутаций.
 * Чистая функция, возвращает новое состояние.
 *
 * @internal Используйте telemetryBatchCore.addEvent вместо этого
 */
export function addEventToBatchCore<
  TMetadata = TelemetryMetadata,
>(
  state: TelemetryBatchCoreState<TMetadata>,
  level: TelemetryLevel,
  message: string,
  metadata: TMetadata | undefined,
  timestamp: number,
): TelemetryBatchCoreState<TMetadata> {
  const event: TelemetryEvent<TMetadata> = {
    level,
    message,
    timestamp,
    ...(metadata !== undefined && { metadata }),
  };

  const newBatch = [...state.batch, event];

  return {
    batch: newBatch,
    config: state.config,
  };
}

/**
 * Выполняет flush batch и возвращает события для отправки.
 * Чистая функция для извлечения накопленных событий.
 *
 * @internal Используйте telemetryBatchCore.flush вместо этого
 */
export function flushBatchCore<
  TMetadata = TelemetryMetadata,
>(
  state: TelemetryBatchCoreState<TMetadata>,
): [TelemetryBatchCoreState<TMetadata>, readonly TelemetryEvent<TMetadata>[]] {
  const eventsToFlush = [...state.batch];

  const newState = {
    batch: [],
    config: state.config,
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
  TMetadata = TelemetryMetadata,
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
 */
export const telemetryBatchCore = {
  /** Создает начальное состояние batch. */
  createInitialState<
    TMetadata = TelemetryMetadata,
  >(
    config?: TelemetryBatchCoreConfig,
  ): TelemetryBatchCoreState<TMetadata> {
    return createInitialBatchCoreState(config);
  },

  /** Добавляет событие в batch. Возвращает функцию для применения к состоянию. */
  addEvent<
    TMetadata = TelemetryMetadata,
  >(
    level: TelemetryLevel,
    message: string,
    metadata: TMetadata | undefined,
    timestamp: number,
  ): (state: TelemetryBatchCoreState<TMetadata>) => TelemetryBatchCoreState<TMetadata> {
    return (state: TelemetryBatchCoreState<TMetadata>) =>
      addEventToBatchCore(state, level, message, metadata, timestamp);
  },

  /** Возвращает внутренний batch. Не для мутаций (readonly contract). */
  getBatch<
    TMetadata = TelemetryMetadata,
  >(
    state: TelemetryBatchCoreState<TMetadata>,
  ): readonly TelemetryEvent<TMetadata>[] {
    return state.batch;
  },

  /** Выполняет flush batch. */
  flush<
    TMetadata = TelemetryMetadata,
  >(
    state: TelemetryBatchCoreState<TMetadata>,
  ): [TelemetryBatchCoreState<TMetadata>, readonly TelemetryEvent<TMetadata>[]] {
    return flushBatchCore(state);
  },

  /** Проверяет необходимость flush. */
  shouldFlush<
    TMetadata = TelemetryMetadata,
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
 * @example Базовое использование batch core
 * ```typescript
 * import { telemetryBatchCore } from './lib/telemetry.batch-core';
 *
 * // Инициализация состояния
 * let state = telemetryBatchCore.createInitialState();
 *
 * // Добавление события
 * const addUserAction = telemetryBatchCore.addEvent(
 *   'INFO',
 *   'Пользователь нажал кнопку',
 *   { buttonId: 'submit', page: 'checkout' },
 *   Date.now() // timestamp извне для чистоты
 * );
 * state = addUserAction(state);
 *
 * // Проверка необходимости flush
 * if (telemetryBatchCore.shouldFlush(state)) {
 *   const [newState, events] = telemetryBatchCore.flush(state);
 *   state = newState;
 *
 *   // Отправка событий во внешние системы
 *   externalService.sendBatch(events);
 * }
 * ```
 */
