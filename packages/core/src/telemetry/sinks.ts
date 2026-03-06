/**
 * @file @livai/core/src/telemetry/sinks.ts
 * ============================================================================
 * 🔌 SINKS — ФАБРИКИ SINK'ОВ ДЛЯ ТЕЛЕМЕТРИИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Фабрики для создания sink'ов (console, external SDK)
 * - Retry логика с exponential backoff
 * - Интеграции с внешними SDK (PostHog, Sentry, Datadog и т.д.)
 *
 * Принципы:
 * - Factory pattern: возвращают функции-sink без выполнения I/O при создании
 * - Side-effects инкапсулированы внутри sink'ов
 * - Type-safe: строгая типизация через generic TMetadata
 * - Retry-ready: опциональный retry/backoff для критичных SDK
 */

import type { RetryConfig, TelemetryEvent, TelemetrySink } from '@livai/core-contracts';

/* ============================================================================
 * 🔧 КОНСТАНТЫ
 * ============================================================================
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_DELAY_MS = 10000;
const MAX_ALLOWED_RETRIES = 10; // Защита от огромных retry loops
const MIN_BACKOFF_MULTIPLIER = 1; // Минимальный multiplier для exponential backoff
const MAX_BACKOFF_MULTIPLIER = 10; // Максимальный multiplier для защиты от огромных задержек

/* ============================================================================
 * 🔧 ВНУТРЕННИЕ УТИЛИТЫ
 * ============================================================================
 */

/**
 * Вычисляет задержку для exponential backoff.
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

/* ============================================================================
 * 🔌 ТИПЫ
 * ============================================================================
 */

/**
 * Форматтер для console sink (опционально).
 * Позволяет кастомизировать вывод для более структурированного логирования.
 */
export type ConsoleSinkFormatter = (event: TelemetryEvent) => readonly [string, ...unknown[]];

/**
 * Тип внешнего SDK для типизации.
 * Generic для строгой типизации metadata.
 */
export interface ExternalSdk<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
> {
  /** Метод для отправки события в SDK */
  readonly capture: (event: Readonly<TelemetryEvent<TMetadata>>) => void | Promise<void>;
}

/* ============================================================================
 * 🔧 SHARED RETRY ENGINE
 * ============================================================================
 */

/**
 * Общий движок для retry логики с exponential backoff.
 * Выполняет операцию с повторными попытками при ошибках.
 * ВАЖНО: Использует setTimeout (non-deterministic), но это нормально для I/O слоя.
 * @param execute - Функция для выполнения (может быть async)
 * @param retryConfig - Конфигурация retry
 * @param onFailure - Обработчик финальной ошибки (если null - выбрасывает ошибку)
 * @returns Promise, который резолвится при успехе или реджектится/игнорируется при ошибке
 */
async function executeWithRetry<T>(
  execute: () => Promise<T>,
  retryConfig: Readonly<{
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  }>,
  onFailure: ((error: unknown) => void) | null,
): Promise<T> {
  /* eslint-disable functional/no-let, functional/no-loop-statements, fp/no-mutation, fp/no-throw */
  // Обоснование: Retry логика требует мутаций (счетчик попыток, накопление ошибки) и throw для проброса ошибок.
  // Можно было бы использовать recursion вместо цикла, но это ухудшит читаемость.
  // setTimeout используется для exponential backoff (non-deterministic, но нормально для I/O слоя).

  // Накопление ошибки для финальной обработки (необходимо для retry логики)
  let lastError: unknown;

  // Счетчик попыток и retry loop (необходимо для retry логики)
  for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await execute();
    } catch (error) {
      // Сохраняем ошибку для финальной обработки
      lastError = error;

      // Если это не последняя попытка, ждем перед retry
      if (attempt < retryConfig.maxRetries) {
        const delay = calculateBackoffDelay(
          attempt,
          retryConfig.baseDelayMs,
          retryConfig.maxDelayMs,
          retryConfig.backoffMultiplier,
        );

        // setTimeout для exponential backoff (non-deterministic, но нормально для I/O)
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Все попытки исчерпаны
  if (onFailure) {
    onFailure(lastError);
    // Возвращаем undefined как успешное завершение (safe mode)
    return undefined as unknown as T;
  }
  // Пробрасываем ошибку после всех попыток retry (unsafe mode)
  throw lastError;
  /* eslint-enable functional/no-let, functional/no-loop-statements, fp/no-mutation, fp/no-throw */
}

/* ============================================================================
 * 🔌 SINK FACTORIES
 * ============================================================================
 */

/**
 * Создает console sink для вывода в консоль.
 * Factory функция:
 * - Возвращает функцию-sink без выполнения I/O при создании
 * - Side-effect (console.log/warn/error) инкапсулирован внутри sink
 * - Детерминированное создание sink'а
 * - Использует методы из глобального console (позволяет мокам работать в тестах)
 * - Extensible: поддержка кастомного formatter
 * Использование:
 * - Только в bootstrap коде приложения
 * - Для разработки и отладки
 */
export function createConsoleSink(
  formatter?: ConsoleSinkFormatter, // Опциональный formatter для кастомизации вывода
): TelemetrySink {
  return (event: TelemetryEvent): void => {
    /* eslint-disable no-console */
    // Обоснование: Console sink использует console.* для логирования (это side-effect sink).
    // Используем методы из глобального console вместо сохраненных ссылок - это позволяет мокам работать в тестах.

    // Используем методы из глобального console вместо сохраненных ссылок
    // Это позволяет мокам работать в тестах
    const consoleMethod = event.level === 'ERROR'
      ? console.error
      : event.level === 'WARN'
      ? console.warn
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
    /* eslint-enable no-console */
  };
}

/**
 * Создает sink для внешнего SDK (PostHog, Sentry, Datadog и т.д.).
 * Factory функция с обработкой ошибок:
 * - Возвращает функцию-sink без выполнения I/O при создании
 * - Обработка ошибок SDK инкапсулирована внутри sink
 * - Runtime-aware: использует setTimeout для exponential backoff в retry (non-deterministic, но нормально для I/O)
 * - Type-safe: generic TMetadata для строгой типизации
 * - Retry-ready: опциональный retry/backoff для критичных SDK
 * ВАЖНО: Требует метод `capture()` в SDK (forcing adapter pattern).
 * Разные SDK имеют разные API (Sentry.captureMessage, Posthog.capture, Datadog.log),
 * но мы стандартизируем через адаптер с методом `capture()`.
 * @throws Error если SDK не имеет метода capture
 */
export function createExternalSink<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  sdk: ExternalSdk<TMetadata>, // SDK объект с методом capture
  retryConfig?: RetryConfig, // Опциональная конфигурация retry/backoff
): TelemetrySink<TMetadata> {
  // Валидация SDK при создании sink (лучше упасть сразу, чем в runtime)
  if (typeof sdk.capture !== 'function') {
    // eslint-disable-next-line fp/no-throw
    throw new Error('SDK must have a capture method that is a function');
  }

  const effectiveRetryConfig: Readonly<{
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  }> = Object.freeze({
    maxRetries: Math.min(retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES, MAX_ALLOWED_RETRIES),
    baseDelayMs: retryConfig?.baseDelayMs ?? 1000,
    maxDelayMs: retryConfig?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    backoffMultiplier: Math.min(
      Math.max(retryConfig?.backoffMultiplier ?? 2, MIN_BACKOFF_MULTIPLIER),
      MAX_BACKOFF_MULTIPLIER,
    ),
  });

  return async (event: Readonly<TelemetryEvent<TMetadata>>): Promise<void> => {
    await executeWithRetry(
      () => Promise.resolve(sdk.capture(event)),
      effectiveRetryConfig,
      null, // throw on failure (unsafe mode)
    );
  };
}

/**
 * Создает безопасный sink для внешнего SDK (не выбрасывает ошибки).
 * Production-safe версия createExternalSink:
 * - Не выбрасывает ошибки при сбоях SDK
 * - Ошибки логируются через onError callback (если задан)
 * - Подходит для критичных production окружений
 * - Retry-ready: опциональный retry/backoff
 */
export function createExternalSinkSafe<
  TMetadata = Readonly<Record<string, string | number | boolean | null>>,
>(
  sdk: ExternalSdk<TMetadata>, // SDK объект с методом capture
  onError?: (error: unknown, event: Readonly<TelemetryEvent<TMetadata>>) => void, // Обработчик ошибок SDK (опционально)
  retryConfig?: RetryConfig, // Опциональная конфигурация retry/backoff
): TelemetrySink<TMetadata> {
  // Валидация SDK при создании sink (лучше упасть сразу, чем в runtime)
  if (typeof sdk.capture !== 'function') {
    // eslint-disable-next-line fp/no-throw
    throw new Error('SDK must have a capture method that is a function');
  }

  const effectiveRetryConfig: Readonly<{
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  }> = Object.freeze({
    maxRetries: Math.min(retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES, MAX_ALLOWED_RETRIES),
    baseDelayMs: retryConfig?.baseDelayMs ?? 1000,
    maxDelayMs: retryConfig?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    backoffMultiplier: Math.min(
      Math.max(retryConfig?.backoffMultiplier ?? 2, MIN_BACKOFF_MULTIPLIER),
      MAX_BACKOFF_MULTIPLIER,
    ),
  });

  return async (event: Readonly<TelemetryEvent<TMetadata>>): Promise<void> => {
    await executeWithRetry(
      () => Promise.resolve(sdk.capture(event)),
      effectiveRetryConfig,
      onError
        ? (error: unknown): void => {
          onError(error, event);
        }
        : null, // safe mode: логируем ошибку, не выбрасываем
    );
  };
}

/* ============================================================================
 * 📦 RE-EXPORTS
 * ============================================================================
 */

/**
 * Re-export типа TelemetrySink для удобства.
 * Позволяет импортировать тип из одного места: `@livai/core/telemetry`
 */
export type { TelemetrySink } from '@livai/core-contracts';
