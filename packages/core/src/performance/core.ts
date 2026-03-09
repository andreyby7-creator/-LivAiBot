/**
 * @file packages/core/src/performance/core.ts
 * ============================================================================
 * 🚀 PERFORMANCE CORE — МЕТРИКИ ПРОИЗВОДИТЕЛЬНОСТИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Система мониторинга производительности приложения
 * - Трекинг метрик (Web Vitals, компоненты, API) с батчингом и детерминированным sampling
 * - Threshold фильтрация через rule table для масштабируемости
 * - Расширяемый pipeline: processors → sanitize → rules → sampler → batcher → logger
 * - DI для logger и processors: изоляция от runtime зависимостей
 * - Оптимизирован для high-throughput (1000+ метрик/сек): минимизация копирования объектов
 *
 * Принципы:
 * - ✅ SRP: разделение на TYPES, CONSTANTS, RULES, SAMPLER, PROCESSORS, BATCHER, TRACKER, FACTORY
 * - ✅ Deterministic: детерминированный sampling через stableHash (без timestamp, стабильный fallback)
 * - ✅ Platform-neutral: без React/DOM/runtime зависимостей, платформо-агностично
 * - ✅ Extensible: rule table для thresholds, pipeline processors для расширения
 * - ✅ Testable: DI для logger и processors, функции для clock/sampler
 * - ✅ Production-ready: tag/metadata sanitization, maxBufferSize, flushing flag protection
 * - ✅ Performance: оптимизированный pipeline с условным sanitize и минимизацией spread операций
 */

import type { JsonObject } from '@livai/core-contracts';

import { stableHash } from '../hash.js';

/* ============================================================================
 * 📋 TYPES — PERFORMANCE METRIC MODEL
 * ========================================================================== */

/**
 * Метрика производительности.
 * Использует monotonic timestamp для точности измерений.
 */
export interface PerformanceMetric {
  /** Название метрики (LCP, CLS, INP, api.*, component.*) */
  readonly name: string;

  /** Значение метрики */
  readonly value: number;

  /** Временная метка (monotonic clock, DOMHighResTimeStamp) */
  readonly timestamp: number;

  /** Теги для дополнительной информации (sanitized) */
  readonly tags?: Readonly<Record<string, string>>;

  /** Дополнительные метаданные */
  readonly metadata?: Readonly<JsonObject>;
}

/**
 * Logger для отправки метрик.
 * Используется через DI для изоляции от telemetry-runtime.
 */
export interface PerformanceLogger {
  /** Отправка одной метрики */
  metric(metric: PerformanceMetric): void;

  /** Отправка батча метрик (опционально, для оптимизации) */
  metrics?(metrics: readonly PerformanceMetric[]): void;
}

// Правило для threshold фильтрации метрик
export interface MetricRule {
  /** Имя метрики (может быть wildcard pattern, например "api.*") */
  readonly name: string | RegExp;

  /** Пороговое значение (метрика записывается если value > threshold) */
  readonly threshold: number;
}

/**
 * Processor для обработки метрик в pipeline.
 * Позволяет обогащать, трансформировать или фильтровать метрики.
 */
export interface MetricProcessor {
  /** Обрабатывает метрику, возвращает новую метрику или null для фильтрации */
  readonly process: (metric: PerformanceMetric) => PerformanceMetric | null;
}

// Конфигурация трекера производительности
export interface PerformanceConfig {
  /** Sample rate (0.0 - 1.0). По умолчанию 1.0 (100%) */
  readonly sampleRate?: number;

  /** Key для детерминированного sampling (userId, sessionId, traceId) */
  readonly samplingKey?: string;

  /** Интервал отправки батча в миллисекундах. По умолчанию 5000ms */
  readonly flushInterval?: number;

  /** Размер батча перед автоматической отправкой. По умолчанию 20 */
  readonly batchSize?: number;

  /** Максимальный размер буфера. По умолчанию 1000 */
  readonly maxBufferSize?: number;

  /** Стратегия при переполнении буфера: 'drop-oldest' или 'drop-newest'. По умолчанию 'drop-oldest' */
  readonly bufferOverflowStrategy?: 'drop-oldest' | 'drop-newest';

  /** Включен ли трекинг. По умолчанию true */
  readonly enabled?: boolean;

  /** Правила для threshold фильтрации. По умолчанию используются Core Web Vitals thresholds */
  readonly rules?: readonly MetricRule[];

  /** Processors для обработки метрик в pipeline */
  readonly processors?: readonly MetricProcessor[];

  /** Функция для получения времени (DI для тестов). По умолчанию используется monotonic clock */
  readonly now?: () => number;

  /** Функция для детерминированного sampling (DI для тестов). По умолчанию используется stableHash-based */
  readonly shouldSample?: (metric: PerformanceMetric, seed?: string) => boolean;

  /** Максимальная длина тега. По умолчанию 200 */
  readonly maxTagLength?: number;

  /** Максимальное количество тегов. По умолчанию 50 */
  readonly maxTagCount?: number;

  /** Максимальный размер metadata в байтах (JSON stringified). По умолчанию 10240 (10KB) */
  readonly maxMetadataSize?: number;
}

/* ============================================================================
 * ⚙️ INTERNAL CONSTANTS
 * ========================================================================== */

const DEFAULT_SAMPLE_RATE = 1.0;
const DEFAULT_FLUSH_INTERVAL = 5000; // 5 секунд
// eslint-disable-next-line ai-security/model-poisoning -- Внутренняя константа размера батча, не пользовательские данные
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_BUFFER_SIZE = 1000;
const DEFAULT_MAX_TAG_LENGTH = 200;
const DEFAULT_MAX_TAG_COUNT = 50;
// eslint-disable-next-line no-magic-numbers, ai-security/model-poisoning -- 10KB в байтах (стандартный размер для metadata), внутренняя константа
const DEFAULT_MAX_METADATA_SIZE = 10 * 1024; // 10KB

/**
 * Правила по умолчанию для Core Web Vitals.
 * Соответствуют стандартам Google.
 */
const DEFAULT_METRIC_RULES: readonly MetricRule[] = Object.freeze(
  [
    { name: 'LCP', threshold: 2500 }, // Largest Contentful Paint > 2.5s (poor)
    { name: 'CLS', threshold: 0.1 }, // Cumulative Layout Shift > 0.1 (poor)
    { name: 'INP', threshold: 200 }, // Interaction to Next Paint > 200ms (poor)
    { name: 'FCP', threshold: 1800 }, // First Contentful Paint > 1.8s (poor)
    { name: 'TTFB', threshold: 800 }, // Time to First Byte > 800ms (poor)
  ] as const,
);

/* ============================================================================
 * ⏰ CLOCK — MONOTONIC TIME PROVIDER
 * ========================================================================== */

/**
 * Получает текущее время (monotonic clock).
 * Использует performance.now() если доступен, иначе Date.now().
 */
function getMonotonicTime(): number { // Текущее время (monotonic clock)
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/* ============================================================================
 * 🎲 SAMPLER — ДЕТЕРМИНИРОВАННЫЙ SAMPLING
 * ========================================================================== */

/**
 * Создает функцию детерминированного sampling на основе stableHash.
 * Использует key (userId, sessionId, traceId) для консистентности.
 * ⚠️ Важно: не использует timestamp для детерминизма (только key + metric name).
 */
function createSamplerFunction(
  sampleRate: number, // Sample rate (0.0 - 1.0)
  key?: string, // Key для детерминированного sampling (userId, sessionId, traceId)
): (metric: PerformanceMetric, metricKey?: string) => boolean { // Функция для проверки sampling
  return (metric: PerformanceMetric, metricKey?: string): boolean => { // true если метрика должна быть записана
    if (sampleRate >= 1.0) {
      return true;
    }

    if (sampleRate <= 0.0) {
      return false;
    }

    // Используем key из метрики или конфигурации, или пустую строку как fallback
    // ⚠️ НЕ используем timestamp - он ломает детерминизм!
    // ⚠️ НЕ используем metric.name как fallback - это делает sampling нестабильным между разными метриками
    const effectiveKey = metricKey ?? key ?? '';
    const hashInput = `${effectiveKey}:${metric.name}`;
    const hash = stableHash(hashInput);

    // Детерминированное распределение: hash % 100 < sampleRate * 100
    return (hash % 100) < (sampleRate * 100);
  };
}

/* ============================================================================
 * 📏 RULES ENGINE — THRESHOLD ФИЛЬТРАЦИЯ
 * ========================================================================== */

/**
 * Проверяет наличие собственных ключей в объекте без создания массива.
 * Оптимизация для проверки пустых tags/metadata (80-90% потока).
 */
/* eslint-disable functional/no-loop-statements */
// Perf: for...in с быстрым выходом быстрее Object.keys для проверки наличия ключей
function hasOwnKeys(obj?: Record<string, unknown>): boolean {
  if (!obj) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Итератор не используется, только для проверки наличия
  for (const _ in obj) {
    // Быстрый выход при первом ключе
    return true;
  }
  return false;
}
/* eslint-enable functional/no-loop-statements */

/**
 * Precompiled rules matcher для оптимизации threshold проверки.
 * Разделяет правила на exact (Map) и prefix/regex (Array) для O(1) lookup точных совпадений.
 */
interface CompiledRules {
  readonly exactRules: ReadonlyMap<string, MetricRule>;
  readonly prefixRules: readonly (MetricRule & { name: string; })[];
  readonly regexRules: readonly (MetricRule & { name: RegExp; })[];
}

/**
 * Компилирует правила в оптимизированную структуру для быстрого поиска.
 */
/* eslint-disable functional/no-loop-statements, functional/immutable-data */
// Инфраструктурный код: компиляция правил требует мутабельных структур для построения Map/Array
function compileRules(rules: readonly MetricRule[]): CompiledRules {
  const exactRules = new Map<string, MetricRule>();
  const prefixRules: (MetricRule & { name: string; })[] = [];
  const regexRules: (MetricRule & { name: RegExp; })[] = [];

  for (const rule of rules) {
    if (typeof rule.name === 'string') {
      if (rule.name.endsWith('*')) {
        prefixRules.push(rule as MetricRule & { name: string; });
      } else {
        exactRules.set(rule.name, rule);
      }
    } else {
      // rule.name instanceof RegExp
      regexRules.push(rule as MetricRule & { name: RegExp; });
    }
  }

  return {
    exactRules: Object.freeze(exactRules),
    prefixRules: Object.freeze(prefixRules),
    regexRules: Object.freeze(regexRules),
  };
}
/* eslint-enable functional/no-loop-statements, functional/immutable-data */

/**
 * Проверяет, превышает ли метрика пороговое значение по правилам.
 * Использует precompiled matcher для O(1) exact lookup и O(P) для prefix.
 */
function isAboveThreshold(
  metric: PerformanceMetric, // Метрика для проверки
  compiledRules: CompiledRules, // Скомпилированные правила
): boolean { // true если метрика превышает порог
  // O(1) для точных совпадений (большинство метрик)
  const exactRule = compiledRules.exactRules.get(metric.name);
  if (exactRule !== undefined) {
    return metric.value > exactRule.threshold;
  }

  /* eslint-disable functional/no-loop-statements */
  // O(P) для prefix rules
  for (const rule of compiledRules.prefixRules) {
    const prefix = (rule.name as string).slice(0, -1);
    if (metric.name.startsWith(prefix)) {
      return metric.value > rule.threshold;
    }
  }

  // O(R) для regex rules
  for (const rule of compiledRules.regexRules) {
    if (rule.name.test(metric.name)) {
      return metric.value > rule.threshold;
    }
  }
  /* eslint-enable functional/no-loop-statements */

  // Если правило не найдено, записываем метрику (default: allow)
  return true;
}

/* ============================================================================
 * 🧹 TAG SANITIZATION — PII PROTECTION
 * ========================================================================== */

/**
 * Санитизирует теги метрики для защиты от PII.
 * Ограничивает длину и количество тегов.
 * @note Пустой объект tags: {} имеет семантическое значение (отличается от undefined),
 * поэтому возвращаем пустой frozen объект вместо undefined.
 */
function sanitizeTags(
  tags: Readonly<Record<string, string>> | undefined, // Теги для санитизации
  maxTagLength: number, // Максимальная длина значения тега
  maxTagCount: number, // Максимальное количество тегов
): Readonly<Record<string, string>> | undefined { // Санитизированные теги или undefined
  if (tags === undefined) {
    return undefined;
  }

  const entries = Object.entries(tags);
  if (entries.length === 0) {
    // Пустой объект имеет семантическое значение, возвращаем frozen пустой объект
    return Object.freeze({});
  }

  // Ограничиваем количество тегов
  const limitedEntries = entries.slice(0, maxTagCount);

  // Ограничиваем длину значений тегов
  const sanitizedEntries = limitedEntries.map(([key, value]) => [
    key,
    value.length > maxTagLength ? `${value.substring(0, maxTagLength)}...` : value,
  ]);

  return Object.freeze(Object.fromEntries(sanitizedEntries) as Record<string, string>);
}

/**
 * Санитизирует metadata метрики для защиты от PII.
 * Ограничивает размер metadata (JSON stringified).
 */
function sanitizeMetadata(
  metadata: Readonly<JsonObject> | undefined, // Metadata для санитизации
  maxSize: number, // Максимальный размер metadata в байтах (JSON stringified)
): Readonly<JsonObject> | undefined { // Санитизированный metadata или undefined
  if (metadata === undefined) {
    return undefined;
  }

  try {
    const jsonString = JSON.stringify(metadata);
    if (jsonString.length <= maxSize) {
      return metadata;
    }

    // Если metadata слишком большой, используем безопасную стратегию обрезки
    // Возвращаем объект с флагом truncated вместо некорректного JSON
    return Object.freeze({
      _truncated: true,
      _originalSize: jsonString.length,
      _maxSize: maxSize,
    } as JsonObject);
  } catch {
    // Если не удалось сериализовать, возвращаем пустой объект
    return Object.freeze({});
  }
}

/* ============================================================================
 * ❄️ METRIC FREEZE — IMMUTABILITY GUARANTEE
 * ========================================================================== */

// Замораживает метрику для гарантии immutability (dev mode)
function freezeMetric(metric: PerformanceMetric): PerformanceMetric { // Замороженная метрика
  // В production можно пропустить freeze для производительности
  if (process.env['NODE_ENV'] === 'production') {
    return metric;
  }

  // В dev mode замораживаем для защиты от мутаций
  const frozenTags = metric.tags !== undefined ? Object.freeze(metric.tags) : undefined;
  // eslint-disable-next-line ai-security/model-poisoning -- Внутренняя функция freeze, метрика уже валидирована
  const frozenMetadata = metric.metadata !== undefined ? Object.freeze(metric.metadata) : undefined;

  return Object.freeze({
    ...metric,
    ...(frozenTags !== undefined && { tags: frozenTags }),
    ...(frozenMetadata !== undefined && { metadata: frozenMetadata }),
  });
}

/* ============================================================================
 * 📦 BATCHER — НАКОПЛЕНИЕ И ОТПРАВКА МЕТРИК
 * ========================================================================== */

/**
 * Батчер метрик для оптимизации сетевых запросов.
 * Накапливает метрики в буфере и отправляет батчами.
 * Защищен от double flush через flushing flag.
 */
/* eslint-disable functional/no-classes, functional/no-this-expressions, functional/immutable-data, fp/no-mutation */
// Инфраструктурный код: stateful batcher требует класс для управления буфером, таймерами и состоянием flush
class MetricsBatcher {
  private buffer: PerformanceMetric[] = [];
  private flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false; // Защита от double flush

  constructor(
    private readonly logger: PerformanceLogger,
    private readonly batchSize: number,
    private readonly flushInterval: number,
    private readonly maxBufferSize: number,
    private readonly bufferOverflowStrategy: 'drop-oldest' | 'drop-newest',
    private readonly scheduler: {
      setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> | null;
      clearTimeout: (id: ReturnType<typeof setTimeout> | null) => void;
    },
  ) {}

  /**
   * Добавляет метрику в буфер.
   * Автоматически отправляет батч при достижении batchSize.
   * Защищен от переполнения через maxBufferSize.
   */
  add(metric: PerformanceMetric): void { // metric - Метрика для добавления в буфер
    // Проверяем переполнение буфера
    if (this.buffer.length >= this.maxBufferSize) {
      if (this.bufferOverflowStrategy === 'drop-oldest') {
        this.buffer.shift(); // Удаляем самое старое
      } else {
        // drop-newest: игнорируем новую метрику
        return;
      }
    }

    this.buffer.push(metric);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
      return;
    }

    // Запускаем таймер для автоматической отправки через flushInterval
    // Если setTimeout недоступен (edge runtime), flushInterval должен быть 0
    if (this.flushInterval > 0 && this.flushTimeoutId === null && !this.isFlushing) {
      const timeoutId = this.scheduler.setTimeout(() => {
        this.flush();
      }, this.flushInterval);

      if (timeoutId !== null) {
        this.flushTimeoutId = timeoutId;
      }
    }
  }

  /**
   * Отправляет накопленные метрики через logger.
   * Поддерживает как single metric, так и batch API.
   * Защищен от double flush через isFlushing flag.
   */
  flush(): void {
    // Защита от double flush
    if (this.isFlushing) {
      return;
    }

    if (this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Очищаем таймер
    if (this.flushTimeoutId !== null) {
      this.scheduler.clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }

    const metricsToSend = Object.freeze([...this.buffer]);
    this.buffer = [];

    // Используем batch API если доступен, иначе отправляем по одной
    if (this.logger.metrics) {
      this.logger.metrics(metricsToSend);
    } else {
      // eslint-disable-next-line functional/no-loop-statements -- Fallback для logger без batch API
      for (const metric of metricsToSend) {
        this.logger.metric(metric);
      }
    }

    this.isFlushing = false;
  }

  // Очищает буфер без отправки (полезно для тестирования)
  clear(): void {
    if (this.flushTimeoutId !== null) {
      this.scheduler.clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }
    this.buffer = [];
    this.isFlushing = false;
  }

  // Возвращает текущий размер буфера (полезно для debugging и мониторинга)
  getBufferSize(): number { // Текущий размер буфера
    return this.buffer.length;
  }
}
/* eslint-enable functional/no-classes, functional/no-this-expressions, functional/immutable-data, fp/no-mutation */

/* ============================================================================
 * 🚀 PERFORMANCE TRACKER — PIPELINE ORCHESTRATOR
 * ========================================================================== */

/**
 * Трекер производительности.
 * Pipeline orchestrator: metric → processors → sanitize → rules → sampler → batcher → logger
 */
/* eslint-disable functional/no-classes, functional/no-this-expressions, fp/no-mutation, functional/no-let, functional/no-loop-statements */
// Инфраструктурный код: stateful tracker требует класс для управления batcher, конфигурацией и pipeline
export class PerformanceTracker {
  private readonly batcher: MetricsBatcher;
  private readonly shouldSampleFn: (metric: PerformanceMetric, seed?: string) => boolean;
  private readonly nowFn: () => number;
  private readonly compiledRules: CompiledRules;
  private readonly processors: readonly MetricProcessor[];
  private readonly enabled: boolean;
  private readonly maxTagLength: number;
  private readonly maxTagCount: number;
  private readonly maxMetadataSize: number;
  private readonly isDevMode: boolean;

  constructor(
    private readonly logger: PerformanceLogger,
    config: PerformanceConfig = {},
  ) {
    this.enabled = config.enabled ?? true;
    this.nowFn = config.now ?? getMonotonicTime;
    const rules = config.rules ?? DEFAULT_METRIC_RULES;
    this.compiledRules = compileRules(rules);
    this.processors = config.processors ?? [];
    this.maxTagLength = config.maxTagLength ?? DEFAULT_MAX_TAG_LENGTH;
    this.maxTagCount = config.maxTagCount ?? DEFAULT_MAX_TAG_COUNT;
    this.maxMetadataSize = config.maxMetadataSize ?? DEFAULT_MAX_METADATA_SIZE;
    this.isDevMode = process.env['NODE_ENV'] !== 'production';

    const sampleRate = config.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.shouldSampleFn = config.shouldSample
      ?? createSamplerFunction(sampleRate, config.samplingKey);

    // Scheduler abstraction для совместимости с edge runtime
    // Если setTimeout недоступен, flushInterval должен быть 0 (immediate flush)
    // ⚠️ Важно: flush должен быть быстрым (только отправка через logger), иначе может блокировать pipeline
    const hasSetTimeout = typeof setTimeout !== 'undefined';
    const scheduler = {
      setTimeout: hasSetTimeout
        ? setTimeout
        : (): null => null, // Edge runtime fallback: возвращаем null
      clearTimeout: (id: ReturnType<typeof setTimeout> | null): void => {
        if (id !== null && typeof clearTimeout !== 'undefined') {
          clearTimeout(id);
        }
      },
    };

    // Если setTimeout недоступен, используем immediate flush (flushInterval = 0)
    // Flush не блокирует pipeline, т.к. только отправляет через logger (logger должен быть асинхронным)
    const effectiveFlushInterval = hasSetTimeout
      ? (config.flushInterval ?? DEFAULT_FLUSH_INTERVAL)
      : 0;

    this.batcher = new MetricsBatcher(
      this.logger,
      config.batchSize ?? DEFAULT_BATCH_SIZE,
      effectiveFlushInterval,
      config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE,
      config.bufferOverflowStrategy ?? 'drop-oldest',
      scheduler,
    );
  }

  // Получает текущее время (monotonic clock) - полезно для получения timestamp в метриках
  getCurrentTime(): number { // Текущее время (monotonic clock)
    return this.nowFn();
  }

  // Возвращает текущий размер буфера (полезно для debugging и мониторинга)
  getBufferSize(): number { // Текущий размер буфера
    return this.batcher.getBufferSize();
  }

  // Санитизирует tags только если нужно (оптимизация: пропускаем для undefined/пустых без Object.keys)
  private sanitizeTagsIfNeeded(
    tags: Readonly<Record<string, string>> | undefined,
  ): Readonly<Record<string, string>> | undefined {
    if (!hasOwnKeys(tags)) {
      return tags;
    }
    const sanitized = sanitizeTags(tags, this.maxTagLength, this.maxTagCount);
    // sanitizeTags может вернуть undefined или пустой объект {} (семантика)
    return sanitized !== undefined && sanitized !== tags ? sanitized : tags;
  }

  // Санитизирует metadata только если нужно (оптимизация: пропускаем для undefined)
  private sanitizeMetadataIfNeeded(
    metadata: Readonly<JsonObject> | undefined,
  ): Readonly<JsonObject> | undefined {
    if (metadata === undefined) {
      return undefined;
    }
    const sanitized = sanitizeMetadata(metadata, this.maxMetadataSize);
    return sanitized !== undefined && sanitized !== metadata ? sanitized : metadata;
  }

  // Создает финальный объект метрики только если tags или metadata изменились (оптимизация: минимизация spread)
  private createFinalMetric(
    m: PerformanceMetric,
    tags: Readonly<Record<string, string>> | undefined,
    metadata: Readonly<JsonObject> | undefined,
  ): PerformanceMetric {
    if (tags === m.tags && metadata === m.metadata) {
      return m;
    }
    // В production можно мутировать напрямую, но для immutability создаем новый объект
    const newTags = tags !== m.tags ? tags : m.tags;
    // eslint-disable-next-line ai-security/model-poisoning -- Метрика уже валидирована через processors, создаем новый объект только с измененными полями
    const newMetadata = metadata !== m.metadata ? metadata : m.metadata;
    return {
      ...m,
      ...(newTags !== undefined && { tags: newTags }),
      ...(newMetadata !== undefined && { metadata: newMetadata }),
    };
  }

  /**
   * Записывает метрику через pipeline.
   * Pipeline: metric → processors → sanitize → rules → sampler → batcher → logger
   * @note Оптимизация для high-throughput (1000+ метрик/сек):
   * - Минимизация копирования объектов (spread только если нужно)
   * - Sanitize вызывается только если есть что санитизировать
   * - Объект создается один раз в конце pipeline
   */
  record(metric: PerformanceMetric): void { // metric - Метрика для записи
    if (!this.enabled) {
      return;
    }

    // 1. Processors: обогащение, трансформация, фильтрация
    // Perf: let + цикл быстрее reduce для pipeline с ранним выходом при фильтрации
    let m: PerformanceMetric | null = metric;
    for (const processor of this.processors) {
      if (m === null) {
        return; // Фильтровано процессором
      }
      m = processor.process(m);
    }

    if (m === null) {
      return; // Фильтровано процессором
    }

    // 2. Sanitize tags только если есть теги (оптимизация: пропускаем Object.entries для undefined)
    const tags = this.sanitizeTagsIfNeeded(m.tags);

    // 3. Sanitize metadata только если есть metadata (оптимизация: пропускаем JSON.stringify для undefined)
    const metadata = this.sanitizeMetadataIfNeeded(m.metadata);

    // 4. Создаем объект только если tags или metadata изменились (оптимизация: минимизация spread)
    const finalMetric = this.createFinalMetric(m, tags, metadata);

    // 5. Rules: threshold фильтрация (перед sampling для фильтрации bad metrics)
    if (!isAboveThreshold(finalMetric, this.compiledRules)) {
      return;
    }

    // 6. Sampler: детерминированный sampling (после rules)
    if (!this.shouldSampleFn(finalMetric)) {
      return;
    }

    // 7. Freeze metric только в dev mode (оптимизация: пропускаем в production)
    const frozenMetric = this.isDevMode ? freezeMetric(finalMetric) : finalMetric;

    // 8. Batcher: накопление и отправка
    this.batcher.add(frozenMetric);
  }

  // Принудительно отправляет накопленные метрики
  flush(): void {
    this.batcher.flush();
  }

  // Очищает буфер без отправки (полезно для тестирования)
  clear(): void {
    this.batcher.clear();
  }
}
/* eslint-enable functional/no-classes, functional/no-this-expressions, fp/no-mutation, functional/no-let, functional/no-loop-statements */

/* ============================================================================
 * 🏭 FACTORY — СОЗДАНИЕ ТРЕКЕРА
 * ========================================================================== */

/**
 * Создает новый трекер производительности.
 * Никогда не экспортировать singleton - каждый consumer создает свой экземпляр.
 */
export function createPerformanceTracker(
  logger: PerformanceLogger, // Logger для отправки метрик (DI)
  config?: PerformanceConfig, // Конфигурация трекера (опционально)
): PerformanceTracker { // Новый экземпляр PerformanceTracker
  return new PerformanceTracker(logger, config);
}
