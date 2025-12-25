/**
 * @file modelFallbackPolicy.ts - Стратегия fallback для недоступных моделей AI
 *
 * Реализует умную логику выбора альтернативных моделей при недоступности основной модели.
 * Учитывает региональные ограничения, GPU-требования, приоритеты и доступность альтернатив.
 *
 * ❗ ML-семантика выбора модели с учетом hardware constraints.
 * Используется infrastructure layer → model selection → user policies.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';
import type {
  ModelFallbackPriority,
  ModelRecoveryStrategy,
  ModelUnavailableReason,
} from '../infrastructure/ModelUnavailableError.js';

/* ========================== CONSTANTS ========================== */

/** Максимальное количество альтернатив для перебора */
const MAX_FALLBACK_ATTEMPTS = 3;

/** Минимальный порог различия в совместимости для сравнения */
const COMPATIBILITY_DIFF_THRESHOLD = 0.1;

/** Минимальный порог совместимости модели с задачей для предупреждений */
const MIN_TASK_COMPATIBILITY_WARNING_THRESHOLD = 0.8;

/** Базовое значение для процентов (100%) */
const PERCENT_BASE = 100;

/** Приоритеты моделей по умолчанию */
const DEFAULT_MODEL_PRIORITIES: Record<string, ModelFallbackPriority> = {
  'yandexgpt-pro': 'high',
  'yandexgpt': 'high',
  'yandexgpt-lite': 'medium',
  'yandexart': 'low',
};

/* ========================== TYPES ========================== */

/** Контекст fallback стратегии модели */
export type ModelFallbackPolicyContext = {
  /** Тип контекста домена */
  readonly type: 'model_fallback_policy';
  /** Оригинальная запрашиваемая модель */
  readonly requestedModel: string;
  /** Причина недоступности оригинальной модели */
  readonly unavailableReason: ModelUnavailableReason;
  /** Предлагаемая стратегия восстановления */
  readonly recoveryStrategy: ModelRecoveryStrategy;
  /** Доступные альтернативные модели с приоритетами */
  readonly availableAlternatives: readonly ModelAlternative[];
  /** Текущая попытка fallback (начиная с 0) */
  readonly attemptNumber: number;
  /** Максимальное количество попыток */
  readonly maxAttempts: number;
  /** Ограничения на выбор модели */
  readonly constraints?: ModelSelectionConstraints;
  /** Контекст пользователя (tier, region, etc.) */
  readonly userContext?: UserContext;
};

/** Альтернативная модель с метаданными */
export type ModelAlternative = {
  /** Идентификатор модели */
  readonly modelId: string;
  /** Приоритет модели для fallback */
  readonly priority: ModelFallbackPriority;
  /** Причина, по которой эта модель является альтернативой */
  readonly reason: 'similar_capabilities' | 'downgrade' | 'upgrade' | 'regional';
  /** Совместимость с задачей (0-1) */
  readonly taskCompatibility: number;
  /** Требования к GPU */
  readonly requiresGpu?: boolean;
  /** Доступные регионы */
  readonly availableRegions?: readonly string[];
  /** Ограничения по плану пользователя */
  readonly planRestrictions?: readonly string[];
};

/** Ограничения на выбор модели */
export type ModelSelectionConstraints = {
  /** Максимальная стоимость токена */
  readonly maxTokenCost?: number;
  /** Требуемый уровень качества */
  readonly minQualityLevel?: 'basic' | 'standard' | 'premium';
  /** Запрещенные модели */
  readonly excludedModels?: readonly string[];
  /** Обязательные возможности */
  readonly requiredCapabilities?: readonly string[];
  /** Ограничения по региону */
  readonly regionConstraints?: readonly string[];
};

/** Контекст пользователя */
export type UserContext = {
  /** Текущий план пользователя */
  readonly planTier?: string;
  /** Регион пользователя */
  readonly region?: string;
  /** Доступные модели по плану */
  readonly availableModels?: readonly string[];
  /** GPU доступен */
  readonly gpuAvailable?: boolean;
};

/** Результат применения fallback политики */
export type ModelFallbackPolicyResult = {
  /** Выбранная модель (может быть оригинальной) */
  readonly selectedModel: string;
  /** Причина выбора этой модели */
  readonly selectionReason: 'original_available' | 'fallback_success' | 'no_alternatives';
  /** Информация о примененной стратегии */
  readonly appliedStrategy?: {
    readonly type: ModelRecoveryStrategy;
    readonly attemptNumber: number;
    readonly alternativesTried: readonly string[];
  };
  /** Предупреждения о деградации */
  readonly degradationWarnings?: readonly string[];
  /** Рекомендации для пользователя */
  readonly recommendations?: readonly string[];
};

/* ========================== ERROR ========================== */

/** Ошибка невозможности применения fallback стратегии */
export type ModelFallbackPolicyError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.SERVICE;
  readonly severity: typeof ERROR_SEVERITY.MEDIUM;
  readonly type: 'model_fallback_policy_error';
  readonly code: ErrorCode;
  readonly context: ModelFallbackPolicyContext;
  readonly result: ModelFallbackPolicyResult;
  readonly message: string;
  readonly timestamp: string;
  readonly stack: string | undefined;
}, 'ModelFallbackPolicyError'>;

/* ========================== FUNCTIONS ========================== */

/** Выбирает оптимальную fallback модель согласно политике */
export function selectFallbackModel(
  context: ModelFallbackPolicyContext,
): ModelFallbackPolicyResult {
  const { requestedModel, availableAlternatives, constraints, userContext } = context;

  // Если оригинальная модель доступна и нет ограничений, используем её
  if (context.unavailableReason === 'model_not_found' && availableAlternatives.length === 0) {
    return {
      selectedModel: requestedModel,
      selectionReason: 'original_available',
    };
  }

  // Фильтруем альтернативы по ограничениям
  const viableAlternatives = availableAlternatives
    .filter((alt) => isViableAlternative(alt, constraints, userContext))
    .sort((a, b) => compareAlternatives(a, b, context.unavailableReason));

  if (viableAlternatives.length === 0) {
    return {
      selectedModel: requestedModel, // Возвращаем оригинальную как fallback
      selectionReason: 'no_alternatives',
      appliedStrategy: {
        type: 'fail_fast',
        attemptNumber: context.attemptNumber,
        alternativesTried: availableAlternatives.map((a) => a.modelId),
      },
      recommendations: generateRecommendations(context),
    };
  }

  // Выбираем лучшую альтернативу (гарантированно существует, т.к. viableAlternatives.length > 0)
  const selectedAlternative = viableAlternatives[0];
  if (!selectedAlternative) {
    // Этот случай не должен произойти, но для type safety
    throw new Error('No viable alternative found despite length check');
  }
  const degradationWarnings = generateDegradationWarnings(requestedModel, selectedAlternative);

  return {
    selectedModel: selectedAlternative.modelId,
    selectionReason: 'fallback_success',
    appliedStrategy: {
      type: context.recoveryStrategy,
      attemptNumber: context.attemptNumber,
      alternativesTried: [selectedAlternative.modelId],
    },
    degradationWarnings,
    recommendations: selectedAlternative.priority === 'low'
      ? ['Consider upgrading your plan for better models']
      : [],
  };
}

/** Проверяет, является ли альтернатива жизнеспособной согласно ограничениям */
function isViableAlternative(
  alternative: ModelAlternative,
  constraints?: ModelSelectionConstraints,
  userContext?: UserContext,
): boolean {
  // Проверяем исключенные модели
  if (constraints?.excludedModels?.includes(alternative.modelId) === true) {
    return false;
  }

  // Проверяем доступность модели по плану пользователя
  if (userContext?.availableModels && !userContext.availableModels.includes(alternative.modelId)) {
    return false;
  }

  // Проверяем региональные ограничения
  if (constraints?.regionConstraints && alternative.availableRegions) {
    const userRegion = userContext?.region;
    if (userRegion !== undefined && !alternative.availableRegions.includes(userRegion)) {
      return false;
    }
  }

  // Проверяем GPU требования
  if (alternative.requiresGpu === true && userContext?.gpuAvailable === false) {
    return false;
  }

  // Проверяем ограничения плана
  if (alternative.planRestrictions && userContext?.planTier !== undefined) {
    if (alternative.planRestrictions.includes(userContext.planTier)) {
      return false;
    }
  }

  return true;
}

/** Сравнивает альтернативы для сортировки по приоритету */
function compareAlternatives(
  a: ModelAlternative,
  b: ModelAlternative,
  unavailableReason: ModelUnavailableReason,
): number {
  // Сначала по приоритету (high > medium > low)
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
  if (priorityDiff !== 0) return priorityDiff;

  // Затем по совместимости с задачей
  const compatibilityDiff = b.taskCompatibility - a.taskCompatibility;
  if (Math.abs(compatibilityDiff) > COMPATIBILITY_DIFF_THRESHOLD) return compatibilityDiff;

  // Наконец, по типу причины недоступности
  const reasonPriority = getReasonPriority(unavailableReason);
  const aReasonScore = reasonPriority[a.reason] ?? 0;
  const bReasonScore = reasonPriority[b.reason] ?? 0;

  return bReasonScore - aReasonScore;
}

/** Возвращает приоритеты причин выбора альтернатив */
function getReasonPriority(unavailableReason: ModelUnavailableReason): Record<string, number> {
  switch (unavailableReason) {
    case 'gpu_constraint':
      return { downgrade: 3, similar_capabilities: 2, regional: 1 };
    case 'region_restricted':
      return { regional: 3, similar_capabilities: 2, upgrade: 1 };
    case 'temporarily_unavailable':
      return { similar_capabilities: 3, upgrade: 2, downgrade: 1 };
    default:
      return { similar_capabilities: 3, upgrade: 2, downgrade: 1 };
  }
}

/** Генерирует предупреждения о деградации качества */
function generateDegradationWarnings(
  originalModel: string,
  selectedAlternative: ModelAlternative,
): string[] {
  let warnings: string[] = [];

  const originalPriority =
    (Reflect.get(DEFAULT_MODEL_PRIORITIES, originalModel) as ModelFallbackPriority | undefined)
      ?? 'medium';
  const priorityOrder = { high: 3, medium: 2, low: 1 };

  if (
    Reflect.get(priorityOrder, selectedAlternative.priority)
      < Reflect.get(priorityOrder, originalPriority)
  ) {
    warnings = [
      ...warnings,
      `Model quality degraded from ${originalPriority} to ${selectedAlternative.priority} priority`,
    ];
  }

  if (selectedAlternative.taskCompatibility < MIN_TASK_COMPATIBILITY_WARNING_THRESHOLD) {
    warnings = [
      ...warnings,
      `Selected model has ${
        Math.round(selectedAlternative.taskCompatibility * PERCENT_BASE)
      }% compatibility with your task`,
    ];
  }

  if (selectedAlternative.requiresGpu === true) {
    warnings = [...warnings, 'Selected model requires GPU acceleration'];
  }

  return warnings;
}

/** Генерирует рекомендации для пользователя */
function generateRecommendations(context: ModelFallbackPolicyContext): string[] {
  let recommendations: string[] = [];

  switch (context.unavailableReason) {
    case 'gpu_constraint':
      recommendations = [
        ...recommendations,
        'Consider upgrading to a plan with GPU support',
        'Try using lighter models for your task',
      ];
      break;
    case 'region_restricted':
      recommendations = [
        ...recommendations,
        'Model may be available in other regions',
        'Contact support for regional access',
      ];
      break;
    case 'deprecated':
      recommendations = [
        ...recommendations,
        'The requested model is deprecated, consider migrating to newer models',
      ];
      break;
    default:
      recommendations = [
        ...recommendations,
        'Try again later or contact support if the issue persists',
      ];
  }

  if (context.attemptNumber >= MAX_FALLBACK_ATTEMPTS) {
    recommendations = [...recommendations, 'Maximum fallback attempts reached, operation failed'];
  }

  return recommendations;
}

/** Создает ошибку fallback политики */
export function createModelFallbackPolicyError(
  code: ErrorCode,
  context: ModelFallbackPolicyContext,
  result: ModelFallbackPolicyResult,
  message: string,
): ModelFallbackPolicyError {
  return {
    _tag: 'ModelFallbackPolicyError',
    type: 'model_fallback_policy_error',
    category: ERROR_CATEGORY.BUSINESS,
    severity: ERROR_SEVERITY.MEDIUM,
    origin: ERROR_ORIGIN.SERVICE,
    code,
    message,
    context,
    result,
    timestamp: new Date().toISOString(),
    stack: new Error().stack ?? undefined,
  };
}

/** Проверяет, является ли ошибка ошибкой fallback политики */
export function isModelFallbackPolicyError(error: unknown): error is ModelFallbackPolicyError {
  return (
    typeof error === 'object'
    && error !== null
    && Object.prototype.hasOwnProperty.call(error, '_tag')
    && (error as { _tag: unknown; })._tag === 'ModelFallbackPolicyError'
    && Object.prototype.hasOwnProperty.call(error, 'type')
    && (error as { type: unknown; }).type === 'model_fallback_policy_error'
  );
}

/** Получает приоритет модели по умолчанию */
export function getModelFallbackPriority(modelId: string): ModelFallbackPriority {
  return (Reflect.get(DEFAULT_MODEL_PRIORITIES, modelId) as ModelFallbackPriority | undefined)
    ?? 'medium';
}

/** Проверяет, можно ли использовать модель как fallback */
export function canUseAsFallback(
  alternative: ModelAlternative,
  constraints?: ModelSelectionConstraints,
  userContext?: UserContext,
): boolean {
  return isViableAlternative(alternative, constraints, userContext);
}
