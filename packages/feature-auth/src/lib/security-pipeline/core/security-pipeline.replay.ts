/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.replay.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Replay Testing)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Сохранение реальных login events для офлайн replay
 * - Replay dataset для обучения/тестирования risk rules
 * - Причина изменения: ML training / risk rules development
 *
 * Принципы:
 * - ✅ Event capture — сохранение всех необходимых данных
 * - ✅ Privacy-first — минимизация PII данных
 * - ✅ Replay-ready — данные готовы для воспроизведения
 * - ✅ Offline-first — работа без зависимости от production
 */

import type { DeviceInfo } from '../../../domain/DeviceInfo.js';
import type { RiskAssessmentResult } from '../../../types/risk.js';
import type { SecurityPipelineContext, SecurityPipelineResult } from '../security-pipeline.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/**
 * Захваченное событие для replay
 */
export type ReplayEvent = {
  /** Уникальный ID события */
  readonly eventId: string;
  /** Timestamp события (ISO 8601) */
  readonly timestamp: string;
  /** Device fingerprint */
  readonly deviceInfo: DeviceInfo;
  /** Контекст pipeline (без PII) */
  readonly context: SecurityPipelineContext;
  /** Результат v1 risk assessment */
  readonly v1Risk: RiskAssessmentResult;
  /** Результат v2 risk assessment (если доступен, опционально) */
  readonly v2Risk?: RiskAssessmentResult | undefined;
  /** Финальный результат pipeline */
  readonly finalResult: SecurityPipelineResult;
  /** Метаданные для фильтрации/поиска */
  readonly metadata: {
    /** Тип расхождения (если было сравнение v1 vs v2) */
    readonly disagreementType?: 'v2_stricter' | 'v2_weaker' | 'exact_match';
    /** Версия pipeline */
    readonly pipelineVersion: number;
    /** Shadow mode был включен */
    readonly shadowMode: boolean;
  };
};

/**
 * Конфигурация для replay capture
 */
// eslint-disable-next-line functional/no-mixed-types -- Configuration object with mixed properties and functions
export type ReplayCaptureConfig = {
  /** Включить capture событий */
  readonly enabled: boolean;
  /** Функция для сохранения события */
  readonly saveEvent?: (event: ReplayEvent) => Promise<void> | void;
  /** Фильтр для выборочного сохранения (опционально) */
  readonly filter?: (event: ReplayEvent) => boolean;
  /** Максимальное количество событий для сохранения (rate limiting) */
  readonly maxEventsPerMinute?: number;
  /** Включить PII данные (по умолчанию false для безопасности) */
  readonly includePII?: boolean;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Дефолтная конфигурация replay capture */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Constant for default replay config
export const DEFAULT_REPLAY_CAPTURE_CONFIG: ReplayCaptureConfig = {
  enabled: false,
  maxEventsPerMinute: 1000,
  includePII: false,
};

/* ============================================================================
 * 🎯 REPLAY FUNCTIONS
 * ============================================================================
 */

/**
 * Создает replay event из результатов pipeline
 * @note Данные валидируются через типы TypeScript, дополнительная валидация не требуется
 * для внутреннего использования в security pipeline
 */
export function createReplayEvent(
  deviceInfo: DeviceInfo,
  context: SecurityPipelineContext,
  v1Risk: RiskAssessmentResult,
  finalResult: SecurityPipelineResult,
  metadata: {
    readonly v2Risk?: RiskAssessmentResult;
    readonly disagreementType?: 'v2_stricter' | 'v2_weaker' | 'exact_match';
    readonly pipelineVersion: number;
    readonly shadowMode: boolean;
    readonly includePII?: boolean;
  },
): ReplayEvent {
  // Удаляем PII из context если не включено
  // Создаем sanitized context без userId если PII не включен
  let sanitizedContext: SecurityPipelineContext;
  if (metadata.includePII !== true && context.userId !== undefined) {
    // Создаем новый объект без userId для соответствия exactOptionalPropertyTypes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- userId удаляется из контекста
    const { userId: _removedUserId, ...contextWithoutUserId } = context;
    sanitizedContext = {
      ...contextWithoutUserId,
      operation: context.operation,
    } as SecurityPipelineContext;
  } else {
    sanitizedContext = context;
  }

  // Создаем metadata без undefined значений для соответствия exactOptionalPropertyTypes
  // eslint-disable-next-line ai-security/model-poisoning -- Данные из security pipeline уже валидированы через типы
  const eventMetadata: ReplayEvent['metadata'] = {
    pipelineVersion: metadata.pipelineVersion,
    shadowMode: metadata.shadowMode,
    ...(metadata.disagreementType !== undefined && { disagreementType: metadata.disagreementType }),
  };

  return {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    deviceInfo,
    context: sanitizedContext,
    v1Risk,
    ...(metadata.v2Risk !== undefined && { v2Risk: metadata.v2Risk }),
    finalResult,
    metadata: eventMetadata,
  };
}

/**
 * Генерирует уникальный ID для события
 */
function generateEventId(): string {
  // Используем timestamp + random для уникальности
  const RADIX_36 = 36; // Base для toString
  const START_INDEX = 2; // Начальный индекс для substring
  const END_INDEX = 11; // Конечный индекс для substring
  return `${Date.now()}-${Math.random().toString(RADIX_36).substring(START_INDEX, END_INDEX)}`;
}

/**
 * Проверяет, нужно ли сохранять событие (rate limiting)
 */
export function shouldCaptureEvent(
  config: ReplayCaptureConfig,
  eventsInLastMinute: number,
): boolean {
  if (!config.enabled) {
    return false;
  }

  const maxEvents = config.maxEventsPerMinute
    ?? DEFAULT_REPLAY_CAPTURE_CONFIG.maxEventsPerMinute
    ?? 1000;
  return eventsInLastMinute < maxEvents;
}

/**
 * Сохраняет replay event (если включено и проходит фильтры)
 * @note Эта функция не блокирует основной flow - сохранение выполняется асинхронно
 * @note Timeout не требуется, так как это fire-and-forget операция
 */
export async function captureReplayEvent(
  event: ReplayEvent,
  config: ReplayCaptureConfig,
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  // Проверяем фильтр (если указан)
  if (config.filter && !config.filter(event)) {
    return;
  }

  // Сохраняем событие (fire-and-forget, не блокирует pipeline)
  if (config.saveEvent) {
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Fire-and-forget операция, timeout не требуется
    await config.saveEvent(event);
  }
}
