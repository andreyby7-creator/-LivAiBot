/**
 * @file packages/app/src/lib/logger.ts
 * ============================================================================
 * 📝 LOGGER — УДОБНЫЙ API ЛОГИРОВАНИЯ
 * ============================================================================
 * Архитектурная роль:
 * - Единая точка входа для всех операций логирования в приложении
 * - Нормализация и стандартизация форматов логов
 * - Thin wrapper вокруг telemetry.ts для удобного API
 * - Контекстно-зависимое логирование с метаданными
 * - Микросервисная изоляция логирования от бизнес-логики
 * Свойства:
 * - Уровни логирования: info/warn/error с типобезопасностью
 * - Автоматическое форматирование контекста и метаданных
 * - Консистентные сообщения через стандартизированные шаблоны
 * - Поддержка различных типов данных (string, object, error)
 * - Легкая интеграция с существующей telemetry системой
 * Принципы:
 * - Никаких I/O операций напрямую (делегируется telemetry)
 * - Никакой асинхронности в публичном API
 * - Никаких побочных эффектов в логике форматирования
 * - Детерминированная трансформация данных для консистентности
 * - Максимальная простота использования для разработчиков
 * Почему thin wrapper:
 * - Logger ≠ Telemetry (разделение ответственности)
 * - Telemetry отвечает за доставку, Logger — за API и формат
 * - Легкость тестирования и замены реализации
 * - Стабильный контракт для всей кодовой базы
 * Почему без эффектов:
 * - Side-effects уже внутри telemetry (fire-and-forget)
 * - Logger — это просто API трансформация
 * - Effect тут = лишний уровень абстракции
 * - Синхронная обработка для лучшей производительности
 */

import { errorFireAndForget, infoFireAndForget, warnFireAndForget } from './telemetry-runtime.js';
import type { JsonValue, Loggable } from '../types/common.js';
import type { TelemetryMetadata, TelemetryPrimitive } from '../types/telemetry.js';

/* ============================================================================
 * 🏷️ ТИПЫ УРОВНЕЙ ЛОГИРОВАНИЯ
 * ========================================================================== */

/** Уровни логирования для типобезопасности. */
export type LogLevel = 'info' | 'warn' | 'error';

/** Контекст логирования для дополнительной информации. */
export type LogContext = {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly requestId?: string;
  readonly component?: string;
  readonly action?: string;
  readonly feature?: string;
  readonly [key: string]: string | number | boolean | undefined;
};

/** Метаданные лога для дополнительной информации. */
export type LogMetadata = Record<string, JsonValue>;

/* ============================================================================
 * 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ФОРМАТИРОВАНИЯ
 * ========================================================================== */

/** Type guard для проверки, является ли значение Loggable. */
function isLoggable(value: unknown): value is Loggable {
  return value != null
    && typeof value === 'object'
    && 'toLog' in value
    && typeof value.toLog === 'function';
}

/** Форматирует сообщение с контекстом для консистентности. */
/** Форматирует префикс контекста для сообщений. */
function formatContextPrefix(context: LogContext): string {
  const contextParts: readonly string[] = [
    context.component != null ? `[${context.component}]` : null,
    context.action != null ? `[${context.action}]` : null,
    context.userId != null ? `[user:${context.userId}]` : null,
    context.requestId != null ? `[req:${context.requestId}]` : null,
  ].filter((part): part is string => part != null);

  return contextParts.length > 0 ? `${contextParts.join(' ')} ` : '';
}

function formatMessage(message: string, context?: LogContext): string {
  if (!context) return message;
  return `${formatContextPrefix(context)}${message}`;
}

/** Конвертирует значение в JSON-сериализуемый формат. */
function toLoggableValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (value === undefined) return null; // undefined -> null for JSON compatibility
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Для объектов проверяем Loggable интерфейс
  if (isLoggable(value)) {
    try {
      return value.toLog();
    } catch {
      return '[Loggable Error]';
    }
  }

  // Для Error объектов
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? undefined,
    } as JsonValue;
  }

  // Для остальных объектов пытаемся сериализовать
  try {
    // Проверяем, что объект сериализуется без ошибок
    JSON.stringify(value);
    return value as JsonValue;
  } catch {
    // Если объект имеет циклические ссылки или не сериализуется, возвращаем строку-заглушку
    return '[Circular Object]';
  }
}

/** Создает метаданные для лога из контекста и дополнительных данных. */
function createLogMetadata(
  context?: LogContext,
  additionalData?: LogMetadata,
): LogMetadata | undefined {
  // Создаем метаданные из контекста
  const contextMetadata = context
    ? Object.fromEntries(
      Object.entries(context)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, toLoggableValue(value)] as const),
    )
    : {};

  // Объединяем с дополнительными данными, обрабатывая их значения
  const additionalMetadata = additionalData
    ? Object.fromEntries(
      Object.entries(additionalData)
        .map(([key, value]) => [key, toLoggableValue(value)] as const),
    )
    : {};

  const metadata = { ...contextMetadata, ...additionalMetadata };

  // Всегда возвращаем метаданные, даже если они пустые
  return metadata;
}

/**
 * Преобразует LogMetadata в TelemetryMetadata, конвертируя объекты и массивы в строки.
 */
function convertToTelemetryMetadata(
  logMetadata: LogMetadata | undefined,
): TelemetryMetadata | undefined {
  if (!logMetadata) {
    return undefined;
  }

  const result: Record<string, TelemetryPrimitive> = {};

  for (const [key, value] of Object.entries(logMetadata)) {
    if (value === null) {
      result[key] = null;
    } else if (
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ) {
      result[key] = value;
    } else {
      // Преобразуем объекты и массивы в строки
      // typeof null === 'object' в JS, но мы уже обработали null выше
      try {
        result[key] = JSON.stringify(value);
      } catch {
        result[key] = '[Non-serializable]';
      }
    }
  }

  return result;
}

/* ============================================================================
 * 📝 ОСНОВНЫЕ ФУНКЦИИ ЛОГИРОВАНИЯ
 * ========================================================================== */

/**
 * Логирует сообщение с указанным уровнем.
 * @param level - Уровень логирования
 * @param message - Текст сообщения
 * @param context - Контекст выполнения для дополнительной информации
 * @param metadata - Дополнительные метаданные для лога
 */
export function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  const formattedMessage = formatMessage(message, context);
  const logMetadata = createLogMetadata(context, metadata);
  const telemetryMetadata = convertToTelemetryMetadata(logMetadata);

  switch (level) {
    case 'info':
      infoFireAndForget(formattedMessage, telemetryMetadata);
      break;
    case 'warn':
      warnFireAndForget(formattedMessage, telemetryMetadata);
      break;
    case 'error':
      errorFireAndForget(formattedMessage, telemetryMetadata);
      break;
  }
}

/**
 * Логирует информационное сообщение.
 * @param message - Текст сообщения
 * @param context - Контекст выполнения для дополнительной информации
 * @param metadata - Дополнительные метаданные для лога
 */
export function info(
  message: string,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  log('info', message, context, metadata);
}

/**
 * Логирует предупреждение.
 * @param message - Текст сообщения
 * @param context - Контекст выполнения для дополнительной информации
 * @param metadata - Дополнительные метаданные для лога
 */
export function warn(
  message: string,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  log('warn', message, context, metadata);
}

/**
 * Логирует ошибку.
 * @param message - Текст сообщения или объект ошибки
 * @param context - Контекст выполнения для дополнительной информации
 * @param metadata - Дополнительные метаданные для лога
 */
export function error(
  message: string | Error,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  const messageText = message instanceof Error ? message.message : message;

  // Для ошибок всегда добавляем информацию об ошибке в метаданные
  const errorMetadata: Record<string, JsonValue> = message instanceof Error
    ? { error: toLoggableValue(message) }
    : {};

  log('error', messageText, context, { ...errorMetadata, ...metadata });
}

/* ============================================================================
 * 🎯 СПЕЦИАЛИЗИРОВАННЫЕ ФУНКЦИИ ЛОГИРОВАНИЯ
 * ========================================================================== */

/**
 * Логирует начало выполнения операции.
 * @param operation - Название операции
 * @param context - Контекст выполнения
 * @param metadata - Дополнительные метаданные
 */
export function logOperationStart(
  operation: string,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  info(`Starting operation: ${operation}`, context, metadata);
}

/**
 * Логирует успешное завершение операции.
 * @param operation - Название операции
 * @param context - Контекст выполнения
 * @param metadata - Дополнительные метаданные (например, duration, result count)
 */
export function logOperationSuccess(
  operation: string,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  info(`Operation completed successfully: ${operation}`, context, metadata);
}

/**
 * Логирует неудачное завершение операции.
 * @param operation - Название операции
 * @param errorMessage - Ошибка или описание ошибки
 * @param context - Контекст выполнения
 * @param metadata - Дополнительные метаданные
 */
export function logOperationFailure(
  operation: string,
  errorMessage: string | Error,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  error(
    `Operation failed: ${operation} - ${
      errorMessage instanceof Error ? errorMessage.message : errorMessage
    }`,
    context,
    metadata,
  );
}

/**
 * Логирует пользовательское действие.
 * @param action - Действие пользователя
 * @param context - Контекст выполнения (должен содержать userId)
 * @param metadata - Дополнительные метаданные
 */
export function logUserAction(
  action: string,
  context: LogContext & { userId: string; },
  metadata?: LogMetadata,
): void {
  info(`User action: ${action}`, context, metadata);
}

/**
 * Логирует метрики производительности.
 * @param metric - Название метрики
 * @param value - Значение метрики
 * @param unit - Единица измерения
 * @param context - Контекст выполнения
 * @param metadata - Дополнительные метаданные
 */
export function logPerformanceMetric(
  metric: string,
  value: number,
  unit: string,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  info(`Performance metric: ${metric}`, context, {
    metric,
    value,
    unit,
    ...metadata,
  });
}

/**
 * Логирует системное событие.
 * @param event - Название события
 * @param context - Контекст выполнения
 * @param metadata - Дополнительные метаданные
 */
export function logSystemEvent(
  event: string,
  context?: LogContext,
  metadata?: LogMetadata,
): void {
  const systemContext: LogContext = { ...context, component: 'system' };
  info(`System event: ${event}`, systemContext, metadata);
}
