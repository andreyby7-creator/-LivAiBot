/**
 * @file ModelUnavailableError.ts - Ошибки недоступности моделей Yandex AI
 *
 * Описывает ошибки при недоступности моделей Yandex Cloud AI:
 * - model not found
 * - temporarily unavailable
 * - region restrictions
 * - GPU/memory constraints
 * - fallback стратегии и альтернативные модели
 *
 * ❗ Содержит ML-семантику доступности моделей.
 * Используется policies layer → model selection → fallback.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import { AI_VENDOR } from './YandexAIConnectionError.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/** Базовые временные константы */
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1000;

/** Временные интервалы для retry стратегий (в миллисекундах) */
const MILLISECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const MILLISECONDS_PER_HOUR = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;

const RETRY_TIME_SHORT_MINUTES = 5;
const RETRY_TIME_SHORT = RETRY_TIME_SHORT_MINUTES * MILLISECONDS_PER_MINUTE; // 5 минут
const RETRY_TIME_LONG = MILLISECONDS_PER_HOUR; // 1 час
const RETRY_TIME_DEFAULT = MILLISECONDS_PER_MINUTE; // 1 минута

/* ========================== CONSTANTS ========================== */

/** Типы недоступности моделей */
export type ModelUnavailableReason =
  | 'model_not_found'
  | 'temporarily_unavailable'
  | 'region_restricted'
  | 'gpu_constraint'
  | 'memory_constraint'
  | 'deprecated'
  | 'maintenance';

/** Стратегия восстановления для недоступной модели */
export type ModelRecoveryStrategy =
  | 'fallback_model'
  | 'region_switch'
  | 'wait_retry'
  | 'upgrade_plan'
  | 'fail_fast';

/** Приоритет модели для fallback */
export type ModelFallbackPriority = 'high' | 'medium' | 'low';

/* ========================== CONTEXT ========================== */

/** Контекст ошибки недоступности модели Yandex AI */
export type ModelUnavailableErrorContext = {
  /** Тип доменного контекста */
  readonly type: 'yandex_ai_model_unavailable';

  /** Вендор AI-платформы */
  readonly vendor: typeof AI_VENDOR;

  /** Причина недоступности модели */
  readonly unavailableReason: ModelUnavailableReason;

  /** Рекомендуемая стратегия восстановления */
  readonly recoveryStrategy: ModelRecoveryStrategy;

  /** Запрошенная модель */
  readonly requestedModel: string;

  /** Семейство модели (gpt-like / embedding / vision) */
  readonly modelFamily?: string;

  /** Доступные альтернативные модели */
  readonly availableAlternatives?: readonly string[];

  /** Приоритет модели для fallback */
  readonly fallbackPriority?: ModelFallbackPriority;

  /** @policy-signal fallbackPriority - сигнал для policy layer о приоритете выбора альтернативной модели */

  /** Регион, где запрошена модель */
  readonly requestedRegion?: string;

  /** Доступные регионы для модели */
  readonly availableRegions?: readonly string[];

  /** Требования к GPU (если применимо) */
  readonly requiredGpuType?: string;

  /** Доступные GPU типы */
  readonly availableGpuTypes?: readonly string[];

  /** Требования к памяти (GB) */
  readonly requiredMemoryGb?: number;

  /** Доступная память (GB) */
  readonly availableMemoryGb?: number;

  /** Время до восстановления (ms), если temporarily unavailable */
  readonly estimatedRecoveryTimeMs?: number;

  /** Endpoint или операция */
  readonly endpoint?: string;

  /** Request ID / Trace ID провайдера */
  readonly requestId?: string;

  /** Оригинальная ошибка SDK / API */
  readonly originalError?: unknown;
};

/* ========================== ERROR TYPE ========================== */

/** TaggedError для ошибок недоступности моделей Yandex AI */
export type ModelUnavailableError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.BUSINESS;
    readonly origin: typeof ERROR_ORIGIN.INFRASTRUCTURE;
    readonly severity: typeof ERROR_SEVERITY.MEDIUM;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details: ModelUnavailableErrorContext;
    readonly timestamp: string;
  },
  'ModelUnavailableError'
>;

/* ========================== FACTORY ========================== */

/** Базовый конструктор ошибки недоступности модели Yandex AI */
export function createModelUnavailableError(
  code: ErrorCode,
  message: string,
  details: Omit<ModelUnavailableErrorContext, 'type' | 'vendor'>,
  timestamp?: string,
): ModelUnavailableError {
  return {
    _tag: 'ModelUnavailableError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    severity: ERROR_SEVERITY.MEDIUM,
    code,
    message,
    details: {
      type: 'yandex_ai_model_unavailable',
      vendor: AI_VENDOR,
      ...details,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as ModelUnavailableError;
}

/* ========================== SPECIALIZED CREATORS ========================== */

/** Модель не найдена (инфраструктурная ошибка) */
export function createModelNotFoundInfraError(
  requestedModel: string,
  availableAlternatives?: readonly string[],
  modelFamily?: string,
  endpoint?: string,
  requestId?: string,
): ModelUnavailableError {
  const message = `Модель "${requestedModel}" не найдена`;

  return createModelUnavailableError(
    'INFRA_AI_MODEL_NOT_FOUND' as ErrorCode,
    message,
    {
      unavailableReason: 'model_not_found',
      recoveryStrategy: 'fallback_model',
      requestedModel,
      fallbackPriority: 'high',
      ...(availableAlternatives !== undefined && { availableAlternatives }),
      ...(modelFamily !== undefined && { modelFamily }),
      ...(endpoint !== undefined && { endpoint }),
      ...(requestId !== undefined && { requestId }),
    },
  );
}

/** Модель временно недоступна */
export function createModelTemporarilyUnavailableError(
  requestedModel: string,
  estimatedRecoveryTimeMs?: number,
  availableAlternatives?: readonly string[],
  modelFamily?: string,
  endpoint?: string,
  requestId?: string,
  originalError?: unknown,
): ModelUnavailableError {
  const message = `Модель "${requestedModel}" временно недоступна`;

  return createModelUnavailableError(
    'INFRA_AI_MODEL_TEMPORARILY_UNAVAILABLE' as ErrorCode,
    message,
    {
      unavailableReason: 'temporarily_unavailable',
      recoveryStrategy: (estimatedRecoveryTimeMs !== undefined
          && estimatedRecoveryTimeMs > 0
          && estimatedRecoveryTimeMs < RETRY_TIME_SHORT)
        ? 'wait_retry'
        : 'fallback_model',
      requestedModel,
      fallbackPriority: 'medium',
      ...(availableAlternatives !== undefined && { availableAlternatives }),
      ...(estimatedRecoveryTimeMs !== undefined && { estimatedRecoveryTimeMs }),
      ...(modelFamily !== undefined && { modelFamily }),
      ...(endpoint !== undefined && { endpoint }),
      ...(requestId !== undefined && { requestId }),
      ...(originalError !== undefined && { originalError }),
    },
  );
}

/** Модель недоступна в данном регионе */
export function createModelRegionRestrictedError(
  requestedModel: string,
  requestedRegion: string,
  availableRegions?: readonly string[],
  availableAlternatives?: readonly string[],
  modelFamily?: string,
  endpoint?: string,
  requestId?: string,
): ModelUnavailableError {
  const message = `Модель "${requestedModel}" недоступна в регионе "${requestedRegion}"`;

  return createModelUnavailableError(
    'INFRA_AI_MODEL_REGION_RESTRICTED' as ErrorCode,
    message,
    {
      unavailableReason: 'region_restricted',
      recoveryStrategy: 'region_switch',
      requestedModel,
      requestedRegion,
      fallbackPriority: 'medium',
      ...(availableRegions !== undefined && { availableRegions }),
      ...(availableAlternatives !== undefined && { availableAlternatives }),
      ...(modelFamily !== undefined && { modelFamily }),
      ...(endpoint !== undefined && { endpoint }),
      ...(requestId !== undefined && { requestId }),
    },
  );
}

/** Недостаточно GPU ресурсов */
export function createModelGpuConstraintError(
  requestedModel: string,
  requiredGpuType?: string,
  availableGpuTypes?: readonly string[],
  availableAlternatives?: readonly string[],
  modelFamily?: string,
  endpoint?: string,
  requestId?: string,
): ModelUnavailableError {
  const message = `Недостаточно GPU ресурсов для модели "${requestedModel}"`;

  return createModelUnavailableError(
    'INFRA_AI_MODEL_GPU_CONSTRAINT' as ErrorCode,
    message,
    {
      unavailableReason: 'gpu_constraint',
      recoveryStrategy: 'upgrade_plan',
      requestedModel,
      fallbackPriority: 'low',
      ...(requiredGpuType !== undefined && { requiredGpuType }),
      ...(availableGpuTypes !== undefined && { availableGpuTypes }),
      ...(availableAlternatives !== undefined && { availableAlternatives }),
      ...(modelFamily !== undefined && { modelFamily }),
      ...(endpoint !== undefined && { endpoint }),
      ...(requestId !== undefined && { requestId }),
    },
  );
}

/** Недостаточно памяти */
export function createModelMemoryConstraintError(
  requestedModel: string,
  requiredMemoryGb?: number,
  availableMemoryGb?: number,
  availableAlternatives?: readonly string[],
  modelFamily?: string,
  endpoint?: string,
  requestId?: string,
): ModelUnavailableError {
  const message = `Недостаточно памяти для модели "${requestedModel}" (${
    requiredMemoryGb ?? 'unknown'
  } GB требуется, ${availableMemoryGb ?? 'unknown'} GB доступно)`;

  return createModelUnavailableError(
    'INFRA_AI_MODEL_MEMORY_CONSTRAINT' as ErrorCode,
    message,
    {
      unavailableReason: 'memory_constraint',
      recoveryStrategy: 'fallback_model',
      requestedModel,
      fallbackPriority: 'medium',
      ...(requiredMemoryGb !== undefined && { requiredMemoryGb }),
      ...(availableMemoryGb !== undefined && { availableMemoryGb }),
      ...(availableAlternatives !== undefined && { availableAlternatives }),
      ...(modelFamily !== undefined && { modelFamily }),
      ...(endpoint !== undefined && { endpoint }),
      ...(requestId !== undefined && { requestId }),
    },
  );
}

/** Модель устарела/депрекатирована */
export function createModelDeprecatedError(
  requestedModel: string,
  availableAlternatives?: readonly string[],
  modelFamily?: string,
  endpoint?: string,
  requestId?: string,
): ModelUnavailableError {
  const message = `Модель "${requestedModel}" устарела и больше не поддерживается`;

  return createModelUnavailableError(
    'INFRA_AI_MODEL_DEPRECATED' as ErrorCode,
    message,
    {
      unavailableReason: 'deprecated',
      recoveryStrategy: 'fallback_model',
      requestedModel,
      fallbackPriority: 'high',
      ...(availableAlternatives !== undefined && { availableAlternatives }),
      ...(modelFamily !== undefined && { modelFamily }),
      ...(endpoint !== undefined && { endpoint }),
      ...(requestId !== undefined && { requestId }),
    },
  );
}

/** Модель на обслуживании */
export function createModelMaintenanceError(
  requestedModel: string,
  estimatedRecoveryTimeMs?: number,
  availableAlternatives?: readonly string[],
  modelFamily?: string,
  endpoint?: string,
  requestId?: string,
): ModelUnavailableError {
  const message = `Модель "${requestedModel}" находится на техническом обслуживании`;

  return createModelUnavailableError(
    'INFRA_AI_MODEL_MAINTENANCE' as ErrorCode,
    message,
    {
      unavailableReason: 'maintenance',
      recoveryStrategy: (estimatedRecoveryTimeMs !== undefined
          && estimatedRecoveryTimeMs > 0
          && estimatedRecoveryTimeMs < RETRY_TIME_LONG)
        ? 'wait_retry'
        : 'fallback_model',
      requestedModel,
      fallbackPriority: 'medium',
      ...(estimatedRecoveryTimeMs !== undefined && { estimatedRecoveryTimeMs }),
      ...(availableAlternatives !== undefined && { availableAlternatives }),
      ...(modelFamily !== undefined && { modelFamily }),
      ...(endpoint !== undefined && { endpoint }),
      ...(requestId !== undefined && { requestId }),
    },
  );
}

/* ========================== POLICY HELPERS ========================== */

/** Определяет стратегию восстановления для недоступной модели */
export function getModelRecoveryStrategy(
  error: ModelUnavailableError,
): ModelRecoveryStrategy {
  return error.details.recoveryStrategy;
}

/** Получает список доступных альтернативных моделей */
export function getAvailableModelAlternatives(
  error: ModelUnavailableError,
): readonly string[] {
  return error.details.availableAlternatives ?? [];
}

/** Проверяет, имеет ли модель высокоприоритетные альтернативы */
export function hasHighPriorityFallback(
  error: ModelUnavailableError,
): boolean {
  return error.details.fallbackPriority === 'high'
    && getAvailableModelAlternatives(error).length > 0;
}

/** Получает рекомендуемую альтернативную модель (первая из списка) */
export function getRecommendedFallbackModel(
  error: ModelUnavailableError,
): string | undefined {
  const alternatives = getAvailableModelAlternatives(error);
  return alternatives.length > 0 ? alternatives[0] : undefined;
}

/** Проверяет, можно ли повторить запрос позже */
export function isModelRetryable(
  error: ModelUnavailableError,
): boolean {
  const { unavailableReason, estimatedRecoveryTimeMs } = error.details;

  // Для temporarily_unavailable всегда retry
  if (unavailableReason === 'temporarily_unavailable') {
    return true;
  }

  // Для maintenance retry только если время восстановления разумное
  if (unavailableReason === 'maintenance') {
    return estimatedRecoveryTimeMs === undefined || estimatedRecoveryTimeMs < RETRY_TIME_LONG;
  }

  // Для других случаев retry если время восстановления короткое
  return estimatedRecoveryTimeMs !== undefined && estimatedRecoveryTimeMs < RETRY_TIME_SHORT;
}

/** Получает время ожидания перед повторной попыткой */
export function getModelRetryDelay(
  error: ModelUnavailableError,
): number {
  return error.details.estimatedRecoveryTimeMs ?? RETRY_TIME_DEFAULT; // Default 1 minute
}

/** Проверяет, доступна ли модель в альтернативных регионах */
export function hasRegionalAlternatives(
  error: ModelUnavailableError,
): boolean {
  return error.details.unavailableReason === 'region_restricted'
    && (error.details.availableRegions?.length ?? 0) > 0;
}

/** Получает список доступных регионов */
export function getAvailableRegions(
  error: ModelUnavailableError,
): readonly string[] {
  return error.details.availableRegions ?? [];
}
