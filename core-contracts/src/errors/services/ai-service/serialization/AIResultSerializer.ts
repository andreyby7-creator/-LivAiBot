/**
 * @file AIResultSerializer.ts
 * Сериализация результатов обработки AI для HTTP / gRPC.
 *
 * Назначение:
 *  - Формирование итогового результата AI обработки
 *  - Агрегация usage статистики (tokens / latency)
 *  - Добавление model metadata
 *  - Расчёт и нормализация confidence score
 *  - Структурированный и устойчивый output формат
 *
 * Архитектурные принципы:
 *  - Transport-agnostic core
 *  - Pure serialization
 *  - Fail-safe defaults
 *  - Forward-compatible metadata
 */

// ==================== ДОМЕННЫЕ ТИПЫ ====================

/** Статистика использования AI */
export type TokenUsageStats = {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly latencyMs?: number;
};

/** Метаданные модели */
export type ModelMetadata = {
  readonly provider: string;
  readonly model: string;
  readonly version?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
};

/** Confidence score результата */
export type ConfidenceScore = {
  readonly value: number; // 0..1
  readonly source: 'model' | 'heuristic' | 'external';
  readonly explanation?: string;
};

/** Структурированный AI результат */
export type AIResult<T = unknown> = {
  readonly output: T;
  readonly usage?: TokenUsageStats;
  readonly model: ModelMetadata;
  readonly confidence?: ConfidenceScore;
  readonly warnings?: readonly string[];
  readonly metadata?: Record<string, unknown>;
};

// ==================== РЕЗУЛЬТАТЫ СЕРИАЛИЗАЦИИ ====================

/** Итог сериализации результата */
export type AIResultSerializationOutcome =
  | { readonly kind: 'success'; }
  | { readonly kind: 'partial'; readonly reason: 'low-confidence'; }
  | { readonly kind: 'fallback'; readonly reason: 'invalid-output' | 'confidence-missing'; };

/** Унифицированный сериализованный результат */
export type SerializedAIResult<T = unknown> = {
  readonly result: AIResult<T>;
  readonly metadata: {
    readonly serializer: 'ai-result';
    readonly timestamp: string;
    readonly outcome: AIResultSerializationOutcome;
  };
};

// ==================== КОНФИГУРАЦИЯ ====================

/** Конфигурация сериализатора результата */
export type AIResultSerializerConfig<T = unknown> = {
  /** Включает usage статистику */
  readonly includeUsage: boolean;
  /** Включает confidence score */
  readonly includeConfidence: boolean;
  /** Минимальный допустимый confidence */
  readonly minConfidence?: number;
  /** Валидатор output */
  readonly outputValidator?: (output: unknown) => output is T;
  /** Пользовательский расчёт confidence */
  readonly confidenceCalculator?: (output: T) => ConfidenceScore;
};

/** Дефолтная конфигурация */
const DEFAULT_CONFIG = {
  includeUsage: true,
  includeConfidence: true,
} as const satisfies AIResultSerializerConfig;

/** Fallback confidence значение для fail-safe сценариев */
const FALLBACK_CONFIDENCE_VALUE = 0.0;

// ==================== ВАЛИДАЦИЯ ====================

/** Проверяет TokenUsageStats */
function isValidTokenUsage(value: unknown): value is TokenUsageStats {
  if (typeof value !== 'object' || value === null) return true;
  const u = value as Record<string, unknown>;

  const isValidNumber = (v: unknown): v is number => typeof v === 'number' && isFinite(v) && v >= 0;

  return (
    (u['promptTokens'] === undefined || isValidNumber(u['promptTokens']))
    && (u['completionTokens'] === undefined || isValidNumber(u['completionTokens']))
    && (u['totalTokens'] === undefined || isValidNumber(u['totalTokens']))
    && (u['latencyMs'] === undefined || isValidNumber(u['latencyMs']))
  );
}

/** Проверяет confidence score */
function isValidConfidence(value: unknown): value is ConfidenceScore {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;

  return (
    typeof c['value'] === 'number'
    && c['value'] >= 0
    && c['value'] <= 1
    && (c['source'] === 'model' || c['source'] === 'heuristic' || c['source'] === 'external')
  );
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

/** Создаёт timestamp */
const createTimestamp = (): string => new Date().toISOString();

/** Создаёт metadata сериализации */
function createMetadata(
  outcome: AIResultSerializationOutcome,
): SerializedAIResult['metadata'] {
  return {
    serializer: 'ai-result',
    timestamp: createTimestamp(),
    outcome,
  };
}

/** Fail-safe confidence */
function createFallbackConfidence(reason: string): ConfidenceScore {
  return {
    value: FALLBACK_CONFIDENCE_VALUE,
    source: 'heuristic',
    explanation: reason,
  };
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================

/**
 * Создаёт сериализатор результатов AI
 */
export function createAIResultSerializer<T = unknown>(
  config: Partial<AIResultSerializerConfig<T>> = {},
): {
  serialize(
    params: {
      output: unknown;
      usage?: TokenUsageStats;
      model: ModelMetadata;
      confidence?: ConfidenceScore;
      warnings?: readonly string[];
      metadata?: Record<string, unknown>;
    },
  ): SerializedAIResult<T>;
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config } as AIResultSerializerConfig<T>;

  function serialize(params: {
    output: unknown;
    usage?: TokenUsageStats;
    model: ModelMetadata;
    confidence?: ConfidenceScore;
    warnings?: readonly string[];
    metadata?: Record<string, unknown>;
  }): SerializedAIResult<T> {
    // ---------- OUTPUT ----------
    if (finalConfig.outputValidator && !finalConfig.outputValidator(params.output)) {
      return {
        result: {
          output: params.output as T,
          model: params.model,
          confidence: createFallbackConfidence('output-validation-failed'),
          warnings: ['Output validation failed'],
        },
        metadata: createMetadata({ kind: 'fallback', reason: 'invalid-output' }),
      };
    }

    // ---------- USAGE ----------
    const usage = finalConfig.includeUsage && isValidTokenUsage(params.usage)
      ? params.usage
      : undefined;

    // ---------- CONFIDENCE ----------
    let confidence: ConfidenceScore | undefined;
    let confidenceIsFallback = false;

    /** Обработка confidence score с fallback логикой */
    if (finalConfig.includeConfidence) {
      if (finalConfig.confidenceCalculator) {
        // Используем кастомный калькулятор confidence
        confidence = finalConfig.confidenceCalculator(params.output as T);
      } else if (params.confidence !== undefined) {
        if (isValidConfidence(params.confidence)) {
          // Confidence предоставлен и валиден - используем его
          confidence = params.confidence;
        } else {
          // Confidence предоставлен, но невалиден - создаем fallback с outcome
          confidence = createFallbackConfidence('confidence-missing');
          confidenceIsFallback = true;
        }
      }
      // Если confidence не предоставлен - оставляем undefined (нормально)

      if (
        finalConfig.minConfidence !== undefined
        && confidence !== undefined
        && confidence.value < finalConfig.minConfidence
      ) {
        return {
          result: {
            output: params.output as T,
            ...(usage && { usage }),
            model: params.model,
            confidence,
            warnings: [
              ...(params.warnings ?? []),
              'Confidence below minimum threshold',
            ],
            ...(params.metadata && { metadata: params.metadata }),
          },
          metadata: createMetadata({
            kind: 'partial',
            reason: 'low-confidence',
          }),
        };
      }
    }

    // ---------- FALLBACK FOR MISSING CONFIDENCE ----------
    if (confidenceIsFallback) {
      return {
        result: {
          output: params.output as T,
          ...(usage && { usage }),
          model: params.model,
          confidence: confidence as ConfidenceScore,
          ...(params.warnings && { warnings: params.warnings }),
          ...(params.metadata && { metadata: params.metadata }),
        },
        metadata: createMetadata({
          kind: 'fallback',
          reason: 'confidence-missing',
        }),
      };
    }

    // ---------- SUCCESS ----------
    return {
      result: {
        output: params.output as T,
        ...(usage && { usage }),
        model: params.model,
        ...(confidence && { confidence }),
        ...(params.warnings && { warnings: params.warnings }),
        ...(params.metadata && { metadata: params.metadata }),
      },
      metadata: createMetadata({ kind: 'success' }),
    };
  }

  return { serialize };
}

// ==================== ДЕФОЛТНЫЙ ХЕЛПЕР ====================

/** Быстрая сериализация с дефолтной конфигурацией */
export const serializeAIResult = <T = unknown>(
  params: {
    output: unknown;
    usage?: TokenUsageStats;
    model: ModelMetadata;
    confidence?: ConfidenceScore;
    warnings?: readonly string[];
    metadata?: Record<string, unknown>;
  },
  config?: Partial<AIResultSerializerConfig<T>>,
): SerializedAIResult<T> => createAIResultSerializer<T>(config).serialize(params);
