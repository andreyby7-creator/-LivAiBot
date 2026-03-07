/**
 * @file @livai/core/telemetry — Telemetry Layer
 * Публичный API пакета telemetry.
 * Экспортирует все публичные компоненты, типы и утилиты для телеметрии.
 */

/* ============================================================================
 * 🎯 BATCH CORE — ЧИСТОЕ МИКРОСЕРВИСНОЕ ЯДРО ТЕЛЕМЕТРИИ
 * ========================================================================== */

/**
 * Чистое batch ядро телеметрии.
 * Включает TelemetryBatchCoreState, TelemetryBatchCoreConfig, telemetryBatchCore.
 * @public
 */

export * from './batch-core.js';

/* ============================================================================
 * 🔹 TELEMETRY CLIENT — RUNTIME-ЗАВИСИМЫЙ КЛИЕНТ
 * ========================================================================== */

/**
 * Runtime-зависимый клиент телеметрии.
 * Включает TelemetryClient и утилиты.
 * @public
 */

export {
  getGlobalClientForDebug,
  isValidTelemetrySink,
  levelPriority,
  TelemetryClient,
  telemetryLevels,
} from './client.js';

/* ============================================================================
 * 🚰 SINKS — ФАБРИКИ SINK И RETRY ЛОГИКА
 * ========================================================================== */

/**
 * Sink factories и retry логика.
 * Включает createConsoleSink, createExternalSink, createExternalSinkSafe.
 * @public
 */

export { createConsoleSink, createExternalSink, createExternalSinkSafe } from './sinks.js';

export type { ConsoleSinkFormatter, ExternalSdk, TelemetrySink } from './sinks.js';

/* ============================================================================
 * 🔒 SANITIZATION — ДЕТЕКТ PII И ОЧИСТКА METADATA
 * ========================================================================== */

/**
 * Sanitization утилиты для детекта PII и очистки metadata.
 * Включает containsPII, PII_PATTERNS, deepFreeze, deepValidateAndRedactPII, applyPIIRedactionMiddleware.
 * @public
 */

export {
  applyPIIRedactionMiddleware,
  containsPII,
  deepFreeze,
  deepValidateAndRedactPII,
  PII_PATTERNS,
} from './sanitization.js';
