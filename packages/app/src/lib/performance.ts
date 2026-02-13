/**
 * @file packages/app/src/lib/performance.ts
 * ============================================================================
 * 🚀 ПЕРФОРМАНС МОНИТОРИНГ — МИКРОСЕРВИСНАЯ ПОДСИСТЕМА ПРОИЗВОДИТЕЛЬНОСТИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единая система мониторинга производительности приложения
 * - Web Vitals метрики для Core Web Vitals
 * - Инструментирование компонентов и API вызовов
 * - Режим реального времени с батчингом для оптимизации
 * - Интеграция с телеметрией для distributed tracing
 * - Микросервисная архитектура с изоляцией по сервисам
 *
 * Свойства:
 * - Effect-first архитектура для надежной обработки ошибок
 * - Композиционные метрики для комплексного мониторинга
 * - Детерминированные трансформации данных
 * - Поддержка distributed tracing и request context
 * - Graceful degradation при недоступности Performance API
 * - Батчинг метрик для оптимизации сетевых запросов
 *
 * Принципы:
 * - Zero runtime overhead для отключенного мониторинга
 * - Максимальная безопасность и предсказуемость
 * - Микросервисная декомпозиция метрик
 * - Полная совместимость с telemetry.ts
 * - Файл содержит core engine + React hooks для простоты использования
 */

import { randomUUID } from 'crypto';
import { Effect as EffectLib } from 'effect';
import React from 'react';

import { errorFireAndForget, infoFireAndForget, warnFireAndForget } from './telemetry-runtime.js';
import type { JsonObject } from '../types/common.js';

/* ============================================================================
 * 🔢 КОНСТАНТЫ КОНФИГУРАЦИИ
 * ========================================================================== */

const PERFORMANCE_BUFFER_SIZE = 100;
const PERFORMANCE_BATCH_INTERVAL = 5000; // 5 секунд
const COMPONENT_RENDER_THRESHOLD = 16; // 16ms для 60fps
const API_RESPONSE_TIME_THRESHOLD = 1000; // 1 секунда
const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;
const MEMORY_WARNING_MULTIPLIER = 50;
const PAYLOAD_SIZE_WARNING_THRESHOLD = MEGABYTE; // 1MB
const MEMORY_USAGE_WARNING_THRESHOLD = MEMORY_WARNING_MULTIPLIER * MEGABYTE; // 50MB
const RESOURCE_LOAD_HIGH_THRESHOLD = 10000; // 10 секунд
const RESOURCE_LOAD_MEDIUM_THRESHOLD = 5000; // 5 секунд
const API_RESPONSE_CRITICAL_MULTIPLIER = 3;
const API_RESPONSE_HIGH_MULTIPLIER = 2;
const COMPONENT_RENDER_CRITICAL_MULTIPLIER = 2;
const WEB_VITALS_MEMORY_INTERVAL = 30000; // 30 секунд
const LEGACY_ID_RADIX = 36;
const LEGACY_ID_LENGTH = 15;

const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: true,
  thresholds: {
    componentRenderTime: COMPONENT_RENDER_THRESHOLD,
    apiResponseTime: API_RESPONSE_TIME_THRESHOLD,
    payloadSize: PAYLOAD_SIZE_WARNING_THRESHOLD,
    memoryUsage: MEMORY_USAGE_WARNING_THRESHOLD,
  },
  batchInterval: PERFORMANCE_BATCH_INTERVAL,
  bufferSize: PERFORMANCE_BUFFER_SIZE,
  enableWebVitals: true,
  enableComponentProfiling: true,
  enableApiTracking: true,
  enableResourceTracking: true,
};

/* ============================================================================
 * 🌍 ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРОИЗВОДИТЕЛЬНОСТИ (SINGLETON)
 * ========================================================================== */

/**
 * Текущая конфигурация производительности.
 * Этот модуль является singleton performance subsystem для всего приложения.
 * Изменяется через initPerformanceMonitoring().
 */
let currentConfig: PerformanceConfig = DEFAULT_CONFIG;

/* ============================================================================
 * 🎯 ТИПЫ ДЛЯ ВНЕШНИХ ЗАВИСИМОСТЕЙ
 * ========================================================================== */

/** Безопасный тип для web-vitals модуля */
type WebVitalsModule = {
  readonly getCLS: (callback: (metric: WebVitalsValue) => void) => void;
  readonly getINP: (callback: (metric: WebVitalsValue) => void) => void;
  readonly getFCP: (callback: (metric: WebVitalsValue) => void) => void;
  readonly getLCP: (callback: (metric: WebVitalsValue) => void) => void;
  readonly getTTFB: (callback: (metric: WebVitalsValue) => void) => void;
};

/** Тип для Memory API браузера */
type MemoryInfo = {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
};

/** Расширенный тип Performance с Memory API */
type PerformanceWithMemory = Performance & {
  readonly memory: MemoryInfo;
};

/* ============================================================================
 * 🎯 EFFECT TYPE ALIASES ДЛЯ ЧИСТОТЫ
 * ========================================================================== */

/** Effect<R, E, A> где R=Requirements, E=Error, A=Success. Приведение типов для consistency когда Effect.gen выводит несовместимые типы */
function castPerformanceEffect<A>(
  effect: EffectLib.Effect<unknown, unknown, unknown>,
): EffectLib.Effect<A, PerformanceError, never> {
  return effect as unknown as EffectLib.Effect<A, PerformanceError, never>;
}

/**
 * Приведение Effect типов для внутренних функций performance
 * Возвращает Effect<never, PerformanceError, A>
 */
function castInternalPerformanceEffect<A = void>(
  effect: EffectLib.Effect<unknown, unknown, unknown>,
): EffectLib.Effect<never, PerformanceError, A> {
  return effect as unknown as EffectLib.Effect<never, PerformanceError, A>;
}

/* ============================================================================
 * 🧱 ОСНОВНЫЕ ТИПЫ ПРОИЗВОДИТЕЛЬНОСТИ
 * ========================================================================== */

/** Категории метрик производительности */
export const PerformanceMetricType = {
  WEB_VITALS: 'WEB_VITALS',
  COMPONENT_RENDER: 'COMPONENT_RENDER',
  API_RESPONSE: 'API_RESPONSE',
  RESOURCE_LOAD: 'RESOURCE_LOAD',
  NAVIGATION: 'NAVIGATION',
  MEMORY_USAGE: 'MEMORY_USAGE',
  CUSTOM: 'CUSTOM',
} as const;

export type PerformanceMetricType = keyof typeof PerformanceMetricType;

/** Уровни критичности метрики производительности */
export const PerformanceSeverity = {
  LOW: 'LOW', // Информационная метрика
  MEDIUM: 'MEDIUM', // Требует внимания
  HIGH: 'HIGH', // Критическая проблема
  CRITICAL: 'CRITICAL', // Требует немедленного вмешательства
} as const;

export type PerformanceSeverity = keyof typeof PerformanceSeverity;

/** Метрика производительности - неизменяемый объект */
export type PerformanceMetric = Readonly<{
  /** Уникальный идентификатор метрики */
  id: string;

  /** Тип метрики */
  type: PerformanceMetricType;

  /** Название метрики */
  name: string;

  /** Значение метрики */
  value: number;

  /** Единица измерения */
  unit: string;

  /** Уровень критичности */
  severity: PerformanceSeverity;

  /** Временная метка */
  timestamp: number;

  /** Контекст выполнения */
  context?:
    | Readonly<{
      componentName?: string | undefined;
      route?: string | undefined;
      userId?: string | undefined;
      sessionId?: string | undefined;
      requestId?: string | undefined;
      serviceName?: string | undefined;
    }>
    | undefined;

  /** Дополнительные метаданные */
  metadata?: Readonly<JsonObject> | undefined;

  /** Признак синтетической метрики (сгенерированной системой) */
  isSynthetic?: boolean | undefined;
}>;

/** Конфигурация мониторинга производительности */
export type PerformanceConfig = Readonly<{
  /** Включен ли мониторинг */
  enabled: boolean;

  /** Порог для предупреждений о производительности */
  thresholds?:
    | Readonly<{
      componentRenderTime?: number | undefined;
      apiResponseTime?: number | undefined;
      payloadSize?: number | undefined;
      memoryUsage?: number | undefined;
    }>
    | undefined;

  /** Интервал отправки батча метрик */
  batchInterval?: number | undefined;

  /** Максимальный размер буфера метрик */
  bufferSize?: number | undefined;

  /** Включить Web Vitals мониторинг */
  enableWebVitals?: boolean | undefined;

  /** Включить мониторинг компонентов */
  enableComponentProfiling?: boolean | undefined;

  /** Включить мониторинг API */
  enableApiTracking?: boolean | undefined;

  /** Включить мониторинг ресурсов */
  enableResourceTracking?: boolean | undefined;
}>;

/* ============================================================================
 * ❌ ОШИБКИ ПРОИЗВОДИТЕЛЬНОСТИ
 * ========================================================================== */

/** Ошибки подсистемы производительности */
export type PerformanceError = Readonly<{
  code: PerformanceErrorCode;
  message: string;
  severity: PerformanceSeverity;
  context?: Readonly<JsonObject> | undefined;
  cause?: unknown;
}>;

/** Коды ошибок производительности */
export const PerformanceErrorCodes = {
  PERFORMANCE_API_UNAVAILABLE: 'PERFORMANCE_API_UNAVAILABLE',
  METRIC_COLLECTION_FAILED: 'METRIC_COLLECTION_FAILED',
  BUFFER_OVERFLOW: 'BUFFER_OVERFLOW',
  TELEMETRY_SEND_FAILED: 'TELEMETRY_SEND_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID',
} as const;

export type PerformanceErrorCode = keyof typeof PerformanceErrorCodes;

/** Создает ошибку производительности */
function createPerformanceError(
  code: PerformanceErrorCode,
  message: string,
  severity: PerformanceSeverity = 'MEDIUM',
  context?: Readonly<JsonObject>,
  cause?: unknown,
): PerformanceError {
  return {
    code,
    message,
    severity,
    context,
    cause,
  };
}

/* ============================================================================
 * 📊 WEB VITALS МЕТРИКИ
 * ========================================================================== */

/** Core Web Vitals метрики */
export const WebVitalsMetric = {
  CLS: 'CLS', // Cumulative Layout Shift
  INP: 'INP', // Interaction to Next Paint
  FCP: 'FCP', // First Contentful Paint
  LCP: 'LCP', // Largest Contentful Paint
  TTFB: 'TTFB', // Time to First Byte
} as const;

export type WebVitalsMetric = keyof typeof WebVitalsMetric;

/** Web Vitals значение с типизацией */
export type WebVitalsValue = Readonly<{
  name: WebVitalsMetric;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}>;

/** Конвертирует рейтинг Web Vitals в уровень критичности */
function webVitalsRatingToSeverity(rating: WebVitalsValue['rating']): PerformanceSeverity {
  switch (rating) {
    case 'good':
      return 'LOW';
    case 'needs-improvement':
      return 'MEDIUM';
    case 'poor':
      return 'HIGH';
    default:
      return 'MEDIUM';
  }
}

/* ============================================================================
 * 🔧 ВНУТРЕННИЕ УТИЛИТЫ
 * ========================================================================== */

/** Проверяет доступность Performance API */
function isPerformanceAPISupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.performance !== 'undefined'
    && typeof window.performance.mark === 'function'
    && typeof window.performance.measure === 'function';
}

/** Получает текущую конфигурацию производительности */
function getPerformanceConfig(): PerformanceConfig {
  return currentConfig;
}

/**
 * Создает уникальный ID для метрики с использованием crypto.randomUUID
 * С fallback для окружений без crypto API
 */
function createMetricId(type: PerformanceMetricType, name: string): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? randomUUID()
    : legacyRandomId();

  return `${type}_${name}_${Date.now()}_${id}`;
}

/** Fallback функция генерации ID для окружений без crypto API */
function legacyRandomId(): string {
  return Math.random().toString(LEGACY_ID_RADIX).substring(2, LEGACY_ID_LENGTH)
    + Math.random().toString(LEGACY_ID_RADIX).substring(2, LEGACY_ID_LENGTH);
}

/** Определяет уровень критичности на основе значения и порогов */
function calculateComponentRenderSeverity(
  value: number,
  thresholds: PerformanceConfig['thresholds'],
): PerformanceSeverity {
  const threshold = thresholds?.componentRenderTime ?? COMPONENT_RENDER_THRESHOLD;

  if (value > threshold * COMPONENT_RENDER_CRITICAL_MULTIPLIER) return 'HIGH';
  if (value > threshold) return 'MEDIUM';
  return 'LOW';
}

function calculateApiResponseSeverity(
  value: number,
  thresholds: PerformanceConfig['thresholds'],
): PerformanceSeverity {
  const threshold = thresholds?.apiResponseTime ?? API_RESPONSE_TIME_THRESHOLD;

  if (value > threshold * API_RESPONSE_CRITICAL_MULTIPLIER) return 'CRITICAL';
  if (value > threshold * API_RESPONSE_HIGH_MULTIPLIER) return 'HIGH';
  if (value > threshold) return 'MEDIUM';
  return 'LOW';
}

function calculateResourceLoadSeverity(value: number): PerformanceSeverity {
  if (value > RESOURCE_LOAD_HIGH_THRESHOLD) return 'HIGH';
  if (value > RESOURCE_LOAD_MEDIUM_THRESHOLD) return 'MEDIUM';
  return 'LOW';
}

function calculateMemoryUsageSeverity(
  value: number,
  thresholds: PerformanceConfig['thresholds'],
): PerformanceSeverity {
  const threshold = thresholds?.memoryUsage ?? MEMORY_USAGE_WARNING_THRESHOLD;
  if (value > threshold) return 'HIGH';
  return 'LOW';
}

function calculateSeverity(
  value: number,
  thresholds: PerformanceConfig['thresholds'],
  type: PerformanceMetricType,
): PerformanceSeverity {
  const effectiveThresholds = thresholds ?? DEFAULT_CONFIG.thresholds;

  switch (type) {
    case 'COMPONENT_RENDER':
      return calculateComponentRenderSeverity(value, effectiveThresholds);

    case 'API_RESPONSE':
      return calculateApiResponseSeverity(value, effectiveThresholds);

    case 'RESOURCE_LOAD':
      return calculateResourceLoadSeverity(value);

    case 'MEMORY_USAGE':
      return calculateMemoryUsageSeverity(value, effectiveThresholds);

    default:
      return 'LOW';
  }
}

/* ============================================================================
 * 🎣 ОСНОВНЫЕ ФУНКЦИИ СБОРА МЕТРИК
 * ========================================================================== */

/** Создает метрику производительности */
export function createPerformanceMetric(
  type: PerformanceMetricType,
  name: string,
  value: number,
  unit: string,
  context?: PerformanceMetric['context'],
  metadata?: PerformanceMetric['metadata'],
): PerformanceMetric {
  const config = getPerformanceConfig();

  return {
    id: createMetricId(type, name),
    type,
    name,
    value,
    unit,
    severity: calculateSeverity(value, config.thresholds, type),
    timestamp: Date.now(),
    context,
    metadata,
  };
}

/** Собирает Web Vitals метрику */
export function collectWebVitalsMetric(
  vitals: WebVitalsValue,
): EffectLib.Effect<PerformanceMetric, PerformanceError, never> {
  return castPerformanceEffect<PerformanceMetric>(
    EffectLib.gen(function*() {
      if (!isPerformanceAPISupported()) {
        return yield* EffectLib.fail(createPerformanceError(
          'PERFORMANCE_API_UNAVAILABLE',
          'Performance API недоступен для сбора Web Vitals',
          'LOW',
        ));
      }

      const metric = createPerformanceMetric(
        'WEB_VITALS',
        vitals.name,
        vitals.value,
        vitals.name === 'CLS' ? 'score' : 'ms',
        undefined,
        {
          rating: vitals.rating,
          id: vitals.id,
          delta: vitals.delta,
        },
      );

      // Web Vitals используют rating как source of truth для severity.
      // Это особое правило: игнорируем calculateSeverity() и используем
      // нативный rating браузера (good/needs-improvement/poor).
      const correctedMetric: PerformanceMetric = {
        ...metric,
        severity: webVitalsRatingToSeverity(vitals.rating),
      };

      return correctedMetric;
    }),
  );
}

/** Собирает метрику рендеринга компонента */
export function collectComponentRenderMetric(
  componentName: string,
  renderTime: number,
  context?: PerformanceMetric['context'],
): EffectLib.Effect<PerformanceMetric, PerformanceError, never> {
  const metric = createPerformanceMetric(
    'COMPONENT_RENDER',
    `component_render_${componentName}`,
    renderTime,
    'ms',
    {
      ...context,
      componentName,
    },
  );

  // Логируем медленные рендеры
  if (renderTime > COMPONENT_RENDER_THRESHOLD * 2) {
    warnFireAndForget('Медленный рендер компонента', {
      componentName,
      renderTime,
      threshold: COMPONENT_RENDER_THRESHOLD,
    });
  }

  return castPerformanceEffect<PerformanceMetric>(EffectLib.succeed(metric));
}

/** Собирает метрику API ответа */
export function collectApiResponseMetric(
  endpoint: string,
  method: string,
  responseTime: number,
  statusCode: number,
  responseSize?: number,
  context?: PerformanceMetric['context'],
): EffectLib.Effect<PerformanceMetric, PerformanceError, never> {
  const metric = createPerformanceMetric(
    'API_RESPONSE',
    `api_response_${method}_${endpoint}`,
    responseTime,
    'ms',
    {
      ...context,
      route: `${method} ${endpoint}`,
    },
    {
      statusCode,
      ...(responseSize !== undefined && { responseSize }),
    },
  );

  // Логируем медленные API вызовы
  if (responseTime > API_RESPONSE_TIME_THRESHOLD * 2) {
    warnFireAndForget('Медленный API ответ', {
      endpoint,
      method,
      responseTime,
      statusCode,
    });
  }

  return castPerformanceEffect<PerformanceMetric>(EffectLib.succeed(metric));
}

/** Собирает метрику использования памяти */
export function collectMemoryUsageMetric(): EffectLib.Effect<
  PerformanceMetric,
  PerformanceError,
  never
> {
  return castPerformanceEffect<PerformanceMetric>(
    EffectLib.gen(function*() {
      if (!isPerformanceAPISupported() || !isMemoryAPISupported()) {
        return yield* EffectLib.fail(createPerformanceError(
          'PERFORMANCE_API_UNAVAILABLE',
          'Memory API недоступен для сбора метрик памяти',
          'LOW',
        ));
      }

      const memory = (window.performance as PerformanceWithMemory).memory;
      const usedMemory = memory.usedJSHeapSize;
      const totalMemory = memory.totalJSHeapSize;
      const limitMemory = memory.jsHeapSizeLimit;

      const metric = createPerformanceMetric(
        'MEMORY_USAGE',
        'memory_usage',
        usedMemory,
        'bytes',
        undefined,
        {
          totalMemory,
          limitMemory,
          usagePercentage: (usedMemory / limitMemory) * 100,
        },
      );

      return metric;
    }),
  );
}

/* ============================================================================
 * 🔄 БАТЧИНГ И ОТПРАВКА МЕТРИК
 * ========================================================================== */

/** Глобальный буфер метрик для батчинга. Singleton модуль для простоты использования, централизованного управления и автоматического батчинга. Для тестирования: resetPerformanceStateForTests(). */
let metricsBuffer: PerformanceMetric[] = [];
let batchTimeoutId: number | null = null;

/** Добавляет метрику в буфер для батчинга */
export function addMetricToBuffer(
  metric: PerformanceMetric,
): EffectLib.Effect<never, PerformanceError, never> {
  return castInternalPerformanceEffect<never>(
    EffectLib.gen(function*() {
      // SSR-изоляция: не выполняем таймеры в серверном окружении
      if (typeof window === 'undefined') {
        return;
      }

      const config = getPerformanceConfig();

      if (!config.enabled) {
        return;
      }

      metricsBuffer.push(metric);

      // Проверяем переполнение буфера
      if (metricsBuffer.length >= (config.bufferSize ?? PERFORMANCE_BUFFER_SIZE)) {
        yield* flushMetricsBuffer();
        return;
      }

      // Запускаем таймер батчинга если не запущен
      batchTimeoutId ??= window.setTimeout(() => {
        EffectLib.runPromise(flushMetricsBuffer()).catch((error: unknown): void => {
          errorFireAndForget('Ошибка при автоматической отправке батча метрик', {
            error: String(error),
          });
        });
      }, config.batchInterval ?? PERFORMANCE_BATCH_INTERVAL);
    }),
  );
}

/** Отправляет буфер метрик через телеметрию */
export function flushMetricsBuffer(): EffectLib.Effect<never, PerformanceError, never> {
  // SSR-изоляция: не отправляем метрики в серверном окружении
  if (typeof window === 'undefined') {
    return castInternalPerformanceEffect<never>(EffectLib.succeed(undefined));
  }

  if (metricsBuffer.length <= 0) {
    return castInternalPerformanceEffect<never>(EffectLib.succeed(undefined));
  }

  const metricsToSend = [...metricsBuffer];

  metricsBuffer.length = 0;

  // Очищаем таймер
  if (batchTimeoutId !== null) {
    window.clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }

  // Отправляем каждую метрику через телеметрию
  for (const metric of metricsToSend) {
    try {
      infoFireAndForget('Performance metric collected', {
        type: metric.type,
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        severity: metric.severity,
        ...(metric.context !== undefined && {
          context: typeof metric.context === 'object'
            ? JSON.stringify(metric.context)
            : String(metric.context),
        }),
        ...(metric.metadata !== undefined && {
          metadata: typeof metric.metadata === 'object'
            ? JSON.stringify(metric.metadata)
            : String(metric.metadata),
        }),
      });
    } catch (error) {
      // Логируем ошибку телеметрии, но продолжаем отправку других метрик
      errorFireAndForget('Не удалось отправить метрику производительности', {
        metricId: metric.id,
        metricType: metric.type,
        error: String(error),
      });
    }
  }
  return castInternalPerformanceEffect<never>(EffectLib.succeed(undefined));
}

/* ============================================================================
 * 🎣 REACT HOOKS — ИНТЕГРАЦИЯ С КОМПОНЕНТАМИ
 * ========================================================================== */

/** React хук для мониторинга производительности компонентов */
export function usePerformanceProfiling(componentName: string): void {
  const renderStartRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    renderStartRef.current = performance.now();
  });

  React.useEffect(() => {
    if (renderStartRef.current != null) {
      const renderTime = performance.now() - renderStartRef.current;

      // Отправляем метрику асинхронно
      EffectLib.runPromise(
        collectComponentRenderMetric(componentName, renderTime).pipe(
          EffectLib.andThen(addMetricToBuffer),
        ),
      ).catch((error: unknown): void => {
        warnFireAndForget('Ошибка при сборе метрики рендеринга компонента', {
          componentName,
          error: String(error),
        });
      });
    }
  });
}

/** React хук для мониторинга Web Vitals */
export function useWebVitalsTracking(): void {
  React.useEffect(() => {
    const config = getPerformanceConfig();

    if (config.enableWebVitals !== true || !isPerformanceAPISupported()) {
      return;
    }

    // Импортируем web-vitals динамически (если доступен)
    try {
      // Для SSR совместимости проверяем наличие window
      if (typeof window === 'undefined') return;

      // Проверяем наличие web-vitals в глобальном скоупе или пытаемся импортировать
      const loadWebVitals = async (): Promise<void> => {
        try {
          const webVitalsModule = await import('web-vitals') as unknown as WebVitalsModule;

          const { getCLS, getINP, getFCP, getLCP, getTTFB } = webVitalsModule;

          // Настраиваем сбор метрик Web Vitals
          getCLS((metric: WebVitalsValue) => {
            EffectLib.runPromise(
              collectWebVitalsMetric(metric).pipe(EffectLib.flatMap(addMetricToBuffer)),
            ).catch((error: unknown): void => {
              warnFireAndForget('Ошибка при сборе Web Vitals CLS метрики', {
                error: String(error),
              });
            });
          });

          getINP((metric: WebVitalsValue) => {
            EffectLib.runPromise(
              collectWebVitalsMetric(metric).pipe(EffectLib.flatMap(addMetricToBuffer)),
            ).catch((error: unknown): void => {
              warnFireAndForget('Ошибка при сборе Web Vitals INP метрики', {
                error: String(error),
              });
            });
          });

          getFCP((metric: WebVitalsValue) => {
            EffectLib.runPromise(
              collectWebVitalsMetric(metric).pipe(EffectLib.flatMap(addMetricToBuffer)),
            ).catch((error: unknown): void => {
              warnFireAndForget('Ошибка при сборе Web Vitals FCP метрики', {
                error: String(error),
              });
            });
          });

          getLCP((metric: WebVitalsValue) => {
            EffectLib.runPromise(
              collectWebVitalsMetric(metric).pipe(EffectLib.flatMap(addMetricToBuffer)),
            ).catch((error: unknown): void => {
              warnFireAndForget('Ошибка при сборе Web Vitals LCP метрики', {
                error: String(error),
              });
            });
          });

          getTTFB((metric: WebVitalsValue) => {
            EffectLib.runPromise(
              collectWebVitalsMetric(metric).pipe(EffectLib.flatMap(addMetricToBuffer)),
            ).catch((error: unknown): void => {
              warnFireAndForget('Ошибка при сборе Web Vitals TTFB метрики', {
                error: String(error),
              });
            });
          });
        } catch (error) {
          warnFireAndForget('Не удалось загрузить web-vitals библиотеку', {
            error: String(error),
          });
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      loadWebVitals();
    } catch (error) {
      warnFireAndForget('Ошибка при инициализации Web Vitals', {
        error: String(error),
      });
    }
  }, []);
}

/** React хук для мониторинга API вызовов */
export function useApiPerformanceTracking(): {
  trackApiCall: (
    endpoint: string,
    method: string,
    startTime: number,
    statusCode: number,
    responseSize?: number,
    context?: PerformanceMetric['context'],
  ) => void;
} {
  const trackApiCall = React.useCallback((
    endpoint: string,
    method: string,
    startTime: number,
    statusCode: number,
    responseSize?: number,
    context?: PerformanceMetric['context'],
  ) => {
    const responseTime = Date.now() - startTime;

    EffectLib.runPromise(
      collectApiResponseMetric(endpoint, method, responseTime, statusCode, responseSize, context)
        .pipe(
          EffectLib.flatMap(addMetricToBuffer),
        ),
    ).catch((error: unknown) => {
      warnFireAndForget('Ошибка при сборе метрики API ответа', {
        endpoint,
        method,
        error: String(error),
      });
    });
  }, []);

  return { trackApiCall };
}

/* ============================================================================
 * 🏗️ ОСНОВНЫЕ ФУНКЦИИ ИНИЦИАЛИЗАЦИИ
 * ========================================================================== */

/** Инициализирует систему мониторинга производительности */
export function initPerformanceMonitoring(
  config?: Partial<PerformanceConfig>,
): EffectLib.Effect<never, PerformanceError, never> {
  // Обновляем глобальную конфигурацию
  currentConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...config?.thresholds,
    },
  };

  if (!isPerformanceAPISupported()) {
    warnFireAndForget('Performance API недоступен, мониторинг производительности отключен');
    return castInternalPerformanceEffect<never>(EffectLib.succeed(undefined));
  }

  const finalConfig = currentConfig;

  if (!finalConfig.enabled) {
    infoFireAndForget('Мониторинг производительности отключен через конфигурацию');
    return castInternalPerformanceEffect<never>(EffectLib.succeed(undefined));
  }

  infoFireAndForget('Инициализация системы мониторинга производительности', {
    config: JSON.stringify(finalConfig),
  });

  // Настраиваем автоматическую отправку метрик памяти
  if (finalConfig.enableResourceTracking === true) {
    const memoryInterval = setInterval(() => {
      EffectLib.runPromise(
        collectMemoryUsageMetric().pipe(EffectLib.flatMap(addMetricToBuffer)),
      ).catch((error: unknown): void => {
        warnFireAndForget('Ошибка при сборе метрики памяти', {
          error: String(error),
        });
      });
    }, WEB_VITALS_MEMORY_INTERVAL);

    // Очищаем интервал при размонтировании (глобальный контекст)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        clearInterval(memoryInterval);
        EffectLib.runPromise(flushMetricsBuffer()).catch((error: unknown) => {
          warnFireAndForget('Ошибка при отправке метрик перед выгрузкой страницы', {
            error: String(error),
          });
        });
      });
    }
  }

  return castInternalPerformanceEffect<never>(EffectLib.succeed(undefined));
}

/** Останавливает мониторинг производительности и отправляет оставшиеся метрики */
export function stopPerformanceMonitoring(): EffectLib.Effect<never, PerformanceError, never> {
  return castInternalPerformanceEffect<never>(
    EffectLib.gen(function*() {
      infoFireAndForget('Остановка мониторинга производительности');

      // Отправляем оставшиеся метрики
      yield* flushMetricsBuffer();

      // Очищаем буфер
      metricsBuffer = [];

      // Очищаем таймер (только в браузерном окружении)
      if (typeof window !== 'undefined' && batchTimeoutId !== null) {
        window.clearTimeout(batchTimeoutId);
        batchTimeoutId = null;
      }
    }),
  );
}

/* ============================================================================
 * 📤 ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
 * ========================================================================== */

/** Проверяет доступность Memory API (расширение браузеров) */
function isMemoryAPISupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.performance !== 'undefined'
    && 'memory' in window.performance;
}

/* ============================================================================
 * 🧪 INTERNAL FUNCTIONS EXPORTED FOR TESTING
 * ========================================================================== */

/**
 * Сбрасывает состояние производительности для тестирования.
 * Используется только в тестах для обеспечения изолированного состояния.
 *
 * @internal Только для тестирования
 */
export function resetPerformanceStateForTests(): void {
  currentConfig = DEFAULT_CONFIG;
  metricsBuffer = [];
  batchTimeoutId = null;
}

export {
  calculateApiResponseSeverity,
  calculateComponentRenderSeverity,
  calculateMemoryUsageSeverity,
  calculateResourceLoadSeverity,
  calculateSeverity,
  createMetricId,
  createPerformanceError,
  getPerformanceConfig,
  isMemoryAPISupported,
  isPerformanceAPISupported,
  legacyRandomId,
  webVitalsRatingToSeverity,
};
