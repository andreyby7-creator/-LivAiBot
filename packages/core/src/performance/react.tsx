/**
 * @file packages/core/src/performance/react.tsx
 * ============================================================================
 * 🚀 PERFORMANCE — React Parts
 * ============================================================================
 *
 * React-специфичные части performance tracking.
 * Client-only модуль (`'use client'`): hooks для интеграции с React компонентами.
 * Изолированы от core engine: не импортировать в backend/не-React runtime.
 */

'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

import type { PerformanceConfig, PerformanceLogger, PerformanceTracker } from './core.js';
import { createPerformanceTracker } from './core.js';

/* ============================================================================
 * 🔧 UTILITIES — PERFORMANCE API DETECTION & SSR ISOLATION
 * ========================================================================== */

/**
 * Проверяет, что код выполняется в клиентском окружении (не SSR).
 * Используется для SSR-изоляции во всех hooks.
 */
function isClient(): boolean { // true если выполняется в браузере
  return typeof window !== 'undefined';
}

/**
 * Проверяет доступность Performance API.
 * Используется только в React-части (browser-specific).
 * @internal Только для использования внутри React hooks
 */
export function isPerformanceAPISupported(): boolean { // true если Performance API доступен
  return isClient()
    && typeof window.performance !== 'undefined'
    && typeof window.performance.mark === 'function'
    && typeof window.performance.measure === 'function';
}

/* ============================================================================
 * 📋 TYPES — WEB VITALS METRIC
 * ========================================================================== */

/**
 * Тип для метрики из библиотеки web-vitals.
 * Используется для типизации callback'ов.
 */
interface WebVitalsMetric {
  readonly name: string;
  readonly value: number;
  readonly id: string;
  readonly startTime?: number; // Опционально, так как CLSMetric может не иметь startTime
  readonly rating: 'good' | 'needs-improvement' | 'poor';
}

/**
 * Опциональная функция для кастомного маппинга web-vitals метрик.
 * Позволяет переименовать метрики или добавить пользовательские теги без модификации core.
 */
export interface WebVitalsMetricMapper {
  readonly mapMetric?: (
    metric: WebVitalsMetric,
    metricName: string,
  ) => {
    readonly name: string;
    readonly value: number;
    readonly timestamp: number;
    readonly tags?: Readonly<Record<string, string>> | undefined;
  };
}

/* ============================================================================
 * 🎣 WEB VITALS TRACKING
 * ========================================================================== */

/**
 * Мемоизированный промис импорта web-vitals для предотвращения повторных загрузок.
 * @note Важно: все PerformanceTracker экземпляры на странице используют один и тот же
 * мемоизированный модуль web-vitals. Это нормально и желательно, так как:
 * - web-vitals библиотека регистрирует глобальные event listeners
 * - Множественные импорты не нужны и увеличивают bundle size
 * - Все trackers получают одинаковые метрики от web-vitals
 * Если нужна изоляция между разными trackers, используйте разные logger'ы
 * или processors для фильтрации метрик на уровне core pipeline.
 */
/* eslint-disable functional/no-let */
// Модуль-уровневая мемоизация промиса: один промис на весь модуль для всех trackers
let webVitalsModulePromise:
  | Promise<{
    readonly onCLS: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onINP: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onFCP: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onLCP: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onTTFB: (callback: (metric: WebVitalsMetric) => void) => void;
  }>
  | null = null;
/* eslint-enable functional/no-let */

/**
 * Загружает модуль web-vitals с мемоизацией промиса.
 * Предотвращает повторные импорты при re-render и между разными trackers.
 */
function loadWebVitalsModule(): Promise<{
  readonly onCLS: (callback: (metric: WebVitalsMetric) => void) => void;
  readonly onINP: (callback: (metric: WebVitalsMetric) => void) => void;
  readonly onFCP: (callback: (metric: WebVitalsMetric) => void) => void;
  readonly onLCP: (callback: (metric: WebVitalsMetric) => void) => void;
  readonly onTTFB: (callback: (metric: WebVitalsMetric) => void) => void;
}> {
  // Модуль-уровневая мемоизация: один промис для всех trackers на странице
  // eslint-disable-next-line fp/no-mutation -- Модуль-уровневая мемоизация промиса для всех trackers
  webVitalsModulePromise ??= (async (): Promise<{
    readonly onCLS: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onINP: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onFCP: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onLCP: (callback: (metric: WebVitalsMetric) => void) => void;
    readonly onTTFB: (callback: (metric: WebVitalsMetric) => void) => void;
  }> => {
    const module = await import('web-vitals');
    // Приводим типы через unknown, так как реальные типы из web-vitals могут отличаться от нашего интерфейса
    // (например, CLSMetric может не иметь startTime, но мы обрабатываем это в createWebVitalsCallback)
    const { onCLS, onINP, onFCP, onLCP, onTTFB } = (module as unknown) as {
      readonly onCLS: (callback: (metric: WebVitalsMetric) => void) => void;
      readonly onINP: (callback: (metric: WebVitalsMetric) => void) => void;
      readonly onFCP: (callback: (metric: WebVitalsMetric) => void) => void;
      readonly onLCP: (callback: (metric: WebVitalsMetric) => void) => void;
      readonly onTTFB: (callback: (metric: WebVitalsMetric) => void) => void;
    };
    return { onCLS, onINP, onFCP, onLCP, onTTFB };
  })();
  return webVitalsModulePromise;
}

/**
 * Создает callback для web-vitals метрики с поддержкой кастомного маппинга.
 * Устраняет дублирование кода для LCP/CLS/INP/FCP/TTFB.
 */
function createWebVitalsCallback(
  tracker: PerformanceTracker, // PerformanceTracker для записи метрик
  metricName: string, // Имя метрики (LCP, CLS, INP, FCP, TTFB)
  mapper?: WebVitalsMetricMapper, // Опциональный маппер для кастомизации
): (metric: WebVitalsMetric) => void { // Callback для web-vitals
  return (metric: WebVitalsMetric): void => {
    if (mapper?.mapMetric !== undefined) {
      const mapped = mapper.mapMetric(metric, metricName);
      tracker.record({
        name: mapped.name,
        value: mapped.value,
        timestamp: mapped.timestamp,
        ...(mapped.tags !== undefined && { tags: mapped.tags }),
      });
    } else {
      // Дефолтный маппинг: используем имя метрики и стандартные теги
      tracker.record({
        name: metricName,
        value: metric.value,
        // Используем startTime если доступен, иначе используем текущее время
        // CLSMetric может не иметь startTime, поэтому используем fallback
        timestamp: metric.startTime
          ?? (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        tags: {
          id: metric.id,
          rating: metric.rating,
        },
      });
    }
  };
}

/**
 * Hook для отслеживания Core Web Vitals метрик.
 * Автоматически собирает LCP, CLS, INP, FCP, TTFB через библиотеку web-vitals.
 * Метрики:
 * - LCP (Largest Contentful Paint) - загрузка основного контента
 * - CLS (Cumulative Layout Shift) - стабильность визуального контента
 * - INP (Interaction to Next Paint) - отзывчивость интерфейса
 * - FCP (First Contentful Paint) - первая отрисовка контента
 * - TTFB (Time to First Byte) - время до первого байта
 */
export function useWebVitalsTracking(
  tracker: PerformanceTracker, // PerformanceTracker для записи метрик
  mapper?: WebVitalsMetricMapper, // Опциональный маппер для кастомизации метрик
): void {
  useEffect(() => {
    // SSR-изоляция: не выполняем в серверном окружении
    if (!isClient()) {
      return;
    }

    // Динамический импорт web-vitals для уменьшения bundle size
    // web-vitals - опциональная зависимость, типы могут быть недоступны
    const loadWebVitals = async (): Promise<void> => {
      try {
        const { onCLS, onINP, onFCP, onLCP, onTTFB } = await loadWebVitalsModule();

        // Используем helper для создания callback'ов (устраняет дублирование)
        onLCP(createWebVitalsCallback(tracker, 'LCP', mapper));
        onCLS(createWebVitalsCallback(tracker, 'CLS', mapper));
        onINP(createWebVitalsCallback(tracker, 'INP', mapper));
        onFCP(createWebVitalsCallback(tracker, 'FCP', mapper));
        onTTFB(createWebVitalsCallback(tracker, 'TTFB', mapper));
      } catch (error) {
        // Graceful degradation: если web-vitals недоступен, просто игнорируем
        // Не логируем ошибку, чтобы не засорять консоль
        if (process.env['NODE_ENV'] === 'development') {
          // eslint-disable-next-line no-console
          console.warn('web-vitals library not available', error);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadWebVitals();
  }, [tracker, mapper]);
}

/* ============================================================================
 * 🎣 COMPONENT PERFORMANCE TRACKING
 * ========================================================================== */

/**
 * Hook для отслеживания производительности рендеринга компонентов.
 * Автоматически измеряет время рендеринга компонента.
 * Использует useLayoutEffect для более точного измерения времени рендеринга
 * (измеряет до paint, что важно для быстрых компонентов с unmount/mount).
 */
export function usePerformanceProfiling(
  componentName: string, // Имя компонента для идентификации в метриках
  tracker: PerformanceTracker, // PerformanceTracker для записи метрик
): void {
  const renderStartRef = useRef<number | undefined>(undefined);

  // Используем useLayoutEffect для более точного измерения (до paint)
  useLayoutEffect(() => {
    // SSR-изоляция
    if (!isClient()) {
      return;
    }

    // Используем tracker.getCurrentTime() для единого source of truth с core pipeline
    // eslint-disable-next-line functional/immutable-data, fp/no-mutation -- Мутация React ref это стандартный паттерн
    renderStartRef.current = tracker.getCurrentTime();
  });

  useLayoutEffect(() => {
    // SSR-изоляция
    if (!isClient()) {
      return;
    }

    if (renderStartRef.current !== undefined) {
      // Используем tracker.getCurrentTime() для единого source of truth
      const renderTime = tracker.getCurrentTime() - renderStartRef.current;

      tracker.record({
        name: `component.${componentName}`,
        value: renderTime,
        timestamp: tracker.getCurrentTime(), // Единый source of truth с core pipeline
        tags: {
          componentName,
        },
      });
    }
  });
}

/* ============================================================================
 * 🎣 API PERFORMANCE TRACKING
 * ========================================================================== */

/**
 * Hook для отслеживания производительности API вызовов.
 * Возвращает функцию для ручного трекинга API запросов.
 */
export function useApiPerformanceTracking(
  tracker: PerformanceTracker, // PerformanceTracker для записи метрик
): (name: string, duration: number, tags?: Record<string, string>) => void { // Функция для трекинга API вызова
  return (name: string, duration: number, tags?: Record<string, string>) => { // name - Имя API endpoint, duration - Длительность в ms, tags - Опциональные теги
    tracker.record({
      name: `api.${name}`,
      value: duration,
      timestamp: tracker.getCurrentTime(), // Единый source of truth с core pipeline
      ...(tags !== undefined && { tags }),
    });
  };
}

/* ============================================================================
 * 🔄 FLUSH ON PAGE HIDE — ВАЖНО ДЛЯ СОХРАНЕНИЯ МЕТРИК
 * ========================================================================== */

/**
 * Настраивает автоматическую отправку метрик при закрытии страницы.
 * Критически важно для сохранения метрик при закрытии вкладки.
 * Поддерживает несколько событий для максимальной надежности:
 * - pagehide: лучшее для мобильных браузеров
 * - visibilitychange: когда вкладка становится скрытой
 * - beforeunload: fallback для старых браузеров
 */
export function useFlushOnPageHide(tracker: PerformanceTracker): void { // tracker - PerformanceTracker для flush
  useEffect(() => {
    // SSR-изоляция
    if (!isClient()) {
      return;
    }

    const handleFlush = (): void => {
      tracker.flush();
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    };

    // Используем pagehide (лучшее для мобильных браузеров)
    window.addEventListener('pagehide', handleFlush);

    // visibilitychange для случаев когда вкладка становится скрытой
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // beforeunload как fallback для старых браузеров
    window.addEventListener('beforeunload', handleFlush);

    return (): void => {
      window.removeEventListener('pagehide', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleFlush);
    };
  }, [tracker]);
}

/* ============================================================================
 * 🏭 FACTORY HOOK — СОЗДАНИЕ ТРЕКЕРА С НАСТРОЙКАМИ
 * ========================================================================== */

/**
 * Hook для создания и настройки PerformanceTracker.
 * Удобная обертка для создания трекера с автоматическим flush при размонтировании.
 */
export function usePerformanceTracker(
  logger: PerformanceLogger, // PerformanceLogger для отправки метрик
  config?: PerformanceConfig, // Конфигурация трекера (опционально)
): PerformanceTracker { // PerformanceTracker экземпляр
  const trackerRef = useRef<PerformanceTracker | null>(null);

  // Мутация React ref это стандартный паттерн для lazy initialization
  // eslint-disable-next-line functional/immutable-data, fp/no-mutation -- Мутация React ref это стандартный паттерн
  trackerRef.current ??= createPerformanceTracker(logger, config);

  // Автоматический flush при размонтировании
  useEffect(() => {
    return (): void => {
      if (trackerRef.current !== null) {
        trackerRef.current.flush();
      }
    };
  }, []);

  return trackerRef.current;
}
