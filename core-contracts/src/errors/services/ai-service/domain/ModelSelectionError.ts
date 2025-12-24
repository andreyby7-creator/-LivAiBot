/**
 * @file ModelSelectionError.ts - Доменные ошибки выбора модели AI
 *
 * Специализированные ошибки для логики выбора и маршрутизации моделей.
 * Включает проверки доступности, совместимости и fallback стратегии.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/** Максимальное количество fallback моделей в предложениях */
const MAX_FALLBACK_MODELS = 3;

/** Контекст ошибки выбора модели с AI-специфичными полями */
export interface ModelSelectionErrorContext {
  /** Тип контекста домена */
  readonly type: 'model_selection';
  /** Правило выбора, которое было нарушено */
  readonly selectionRule: string;
  /** Запрашиваемая модель */
  readonly requestedModel: string;
  /** Доступные модели для пользователя/региона */
  readonly availableModels?: readonly string[];
  /** Тип задачи (generation, classification, etc.) */
  readonly taskType?: string;
  /** Уровень пользователя (free, premium, enterprise) */
  readonly userTier?: string;
  /** Регион пользователя */
  readonly region?: string;
  /** Причина отказа в выборе модели */
  readonly rejectionReason?: string;
  /** Предложения альтернативных моделей */
  readonly fallbackSuggestions?: readonly string[];
  /** Технические ограничения */
  readonly technicalConstraints?: Record<string, unknown>;
  /** Время выполнения выбора (ms) */
  readonly selectionTimeMs?: number;
}

/** TaggedError тип для ошибок выбора модели */
export type ModelSelectionError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.BUSINESS;
    readonly origin: typeof ERROR_ORIGIN.DOMAIN;
    readonly severity: typeof ERROR_SEVERITY.MEDIUM;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details: ModelSelectionErrorContext;
    readonly timestamp: string;
  },
  'ModelSelectionError'
>;

/** Создает ModelSelectionError с доменными правилами выбора модели */
export function createModelSelectionError(
  code: ErrorCode,
  message: string,
  selectionRule: string,
  requestedModel: string,
  context?: {
    availableModels?: readonly string[];
    taskType?: string;
    userTier?: string;
    region?: string;
    rejectionReason?: string;
    fallbackSuggestions?: readonly string[];
    technicalConstraints?: Record<string, unknown>;
    selectionTimeMs?: number;
  },
  timestamp?: string,
): ModelSelectionError {
  return {
    _tag: 'ModelSelectionError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: ERROR_SEVERITY.MEDIUM,
    code,
    message,
    details: {
      type: 'model_selection',
      selectionRule,
      requestedModel,
      ...context,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as ModelSelectionError;
}

/** Проверяет ModelSelectionErrorContext */
export function isValidModelSelectionErrorContext(
  context: unknown,
): context is ModelSelectionErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем обязательные поля
  if (ctx['type'] !== 'model_selection') return false;
  if (typeof ctx['selectionRule'] !== 'string') return false;
  if (typeof ctx['requestedModel'] !== 'string') return false;

  // Проверяем опциональные поля
  if (ctx['availableModels'] !== undefined && !Array.isArray(ctx['availableModels'])) {
    return false;
  }
  if (ctx['taskType'] !== undefined && typeof ctx['taskType'] !== 'string') {
    return false;
  }
  if (ctx['userTier'] !== undefined && typeof ctx['userTier'] !== 'string') {
    return false;
  }
  if (ctx['region'] !== undefined && typeof ctx['region'] !== 'string') {
    return false;
  }
  if (ctx['rejectionReason'] !== undefined && typeof ctx['rejectionReason'] !== 'string') {
    return false;
  }
  if (ctx['fallbackSuggestions'] !== undefined && !Array.isArray(ctx['fallbackSuggestions'])) {
    return false;
  }
  if (
    ctx['technicalConstraints'] !== undefined && typeof ctx['technicalConstraints'] !== 'object'
  ) {
    return false;
  }
  if (ctx['selectionTimeMs'] !== undefined && typeof ctx['selectionTimeMs'] !== 'number') {
    return false;
  }

  return true;
}

/** Создает ModelSelectionError для несуществующей модели */
export function createModelNotFoundError(
  requestedModel: string,
  availableModels: readonly string[] = [],
  taskType?: string,
): ModelSelectionError {
  return createModelSelectionError(
    'SERVICE_AI_MODEL_UNAVAILABLE' as ErrorCode,
    `Модель '${requestedModel}' не найдена или недоступна`,
    'model_not_found',
    requestedModel,
    taskType !== undefined
      ? {
        availableModels,
        taskType,
        rejectionReason: 'Model does not exist in catalog',
        fallbackSuggestions: availableModels.slice(0, MAX_FALLBACK_MODELS),
      }
      : {
        availableModels,
        rejectionReason: 'Model does not exist in catalog',
        fallbackSuggestions: availableModels.slice(0, MAX_FALLBACK_MODELS),
      },
  );
}

/** Создает ModelSelectionError для недоступной модели в регионе */
export function createModelUnavailableInRegionError(
  requestedModel: string,
  region: string,
  availableModels: readonly string[] = [],
): ModelSelectionError {
  return createModelSelectionError(
    'SERVICE_AI_MODEL_UNAVAILABLE' as ErrorCode,
    `Модель '${requestedModel}' недоступна в регионе '${region}'`,
    'region_unavailable',
    requestedModel,
    {
      region,
      availableModels,
      rejectionReason: `Model not available in region: ${region}`,
      fallbackSuggestions: availableModels.filter((model) => !model.includes('regional')),
      technicalConstraints: { region },
    },
  );
}

/** Создает ModelSelectionError для несовместимости с задачей */
export function createModelTaskMismatchError(
  requestedModel: string,
  taskType: string,
  availableModels: readonly string[] = [],
): ModelSelectionError {
  return createModelSelectionError(
    'SERVICE_AI_MODEL_UNAVAILABLE' as ErrorCode,
    `Модель '${requestedModel}' не подходит для задачи '${taskType}'`,
    'task_incompatible',
    requestedModel,
    {
      taskType,
      availableModels,
      rejectionReason: `Model incompatible with task type: ${taskType}`,
      fallbackSuggestions: availableModels.slice(0, 2),
      technicalConstraints: { taskType },
    },
  );
}

/** Создает ModelSelectionError для превышения лимитов пользователя */
export function createUserTierLimitError(
  requestedModel: string,
  userTier: string,
  availableModels: readonly string[] = [],
): ModelSelectionError {
  return createModelSelectionError(
    'SERVICE_AI_RATE_LIMIT_EXCEEDED' as ErrorCode,
    `Модель '${requestedModel}' недоступна для уровня '${userTier}'`,
    'tier_limit_exceeded',
    requestedModel,
    {
      userTier,
      availableModels,
      rejectionReason: `Model requires higher tier than: ${userTier}`,
      fallbackSuggestions: availableModels.filter((model) =>
        model.includes('lite') || model.includes('basic')
      ),
      technicalConstraints: { userTier },
    },
  );
}

/** Создает ModelSelectionError для технических ограничений */
export function createTechnicalConstraintError(
  requestedModel: string,
  constraints: Record<string, unknown>,
  availableModels: readonly string[] = [],
): ModelSelectionError {
  return createModelSelectionError(
    'SERVICE_AI_MODEL_UNAVAILABLE' as ErrorCode,
    `Модель '${requestedModel}' не соответствует техническим требованиям`,
    'technical_constraints',
    requestedModel,
    {
      availableModels,
      rejectionReason: 'Model does not meet technical requirements',
      fallbackSuggestions: availableModels.slice(0, 2),
      technicalConstraints: constraints,
    },
  );
}

/** Проверяет ошибку на отсутствие модели */
export function isModelNotFoundError(error: ModelSelectionError): boolean {
  return error.details.selectionRule === 'model_not_found'
    && typeof error.details.requestedModel === 'string';
}

/** Проверяет ошибку на региональные ограничения */
export function isRegionUnavailableError(error: ModelSelectionError): boolean {
  return error.details.selectionRule === 'region_unavailable'
    && typeof error.details.requestedModel === 'string'
    && typeof error.details.region === 'string';
}

/** Проверяет ошибку на несовместимость с задачей */
export function isTaskIncompatibleError(error: ModelSelectionError): boolean {
  return error.details.selectionRule === 'task_incompatible'
    && typeof error.details.requestedModel === 'string'
    && typeof error.details.taskType === 'string';
}

/** Проверяет ошибку на превышение лимитов пользователя */
export function isTierLimitError(error: ModelSelectionError): boolean {
  return error.details.selectionRule === 'tier_limit_exceeded'
    && typeof error.details.requestedModel === 'string'
    && typeof error.details.userTier === 'string';
}

/** Проверяет ошибку на технические ограничения */
export function isTechnicalConstraintError(error: ModelSelectionError): boolean {
  return error.details.selectionRule === 'technical_constraints'
    && typeof error.details.requestedModel === 'string'
    && error.details.technicalConstraints != null;
}
