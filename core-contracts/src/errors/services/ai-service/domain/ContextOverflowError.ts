/**
 * @file ContextOverflowError.ts - Доменные ошибки переполнения контекста AI
 *
 * Специализированные ошибки для обработки превышения лимитов контекста.
 * Включает стратегии усечения, восстановления и оптимизации контекста.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

/** Максимальное количество сохраненных частей контекста */
const MAX_RECOVERABLE_PARTS = 5;

/** Типы правил лимитов контекста */
export type ContextLimitRule =
  | 'token_limit_exceeded'
  | 'conversation_history_overflow'
  | 'system_prompt_overflow'
  | 'document_size_overflow'
  | 'streaming_context_overflow';

/** Контекст ошибки переполнения контекста с AI-специфичными полями */
export interface ContextOverflowErrorContext {
  /** Тип контекста домена */
  readonly type: 'context_overflow';
  /** Правило лимита, которое было нарушено */
  readonly limitRule: ContextLimitRule;
  /** Текущая длина контекста (в токенах/символах) */
  readonly contextLength: number;
  /** Максимально допустимая длина */
  readonly maxAllowedLength: number;
  /** Размер превышения лимита */
  readonly overflowAmount: number;
  /** Тип контекста (conversation, document, system_prompt, etc.) */
  readonly contextType?: string;
  /** Стратегия усечения контекста */
  readonly truncationStrategy?: 'head' | 'tail' | 'middle' | 'sliding_window';
  /** Восстанавливаемые части контекста */
  readonly recoverableParts?: readonly {
    readonly content: string;
    readonly priority: number;
    readonly metadata?: Record<string, unknown>;
  }[];
  /** Невосстанавливаемые части контекста */
  readonly lostParts?: readonly {
    readonly content: string;
    readonly reason: string;
    readonly metadata?: Record<string, unknown>;
  }[];
  /** Предложения по оптимизации */
  readonly optimizationSuggestions?: readonly string[];
  /** Время обработки контекста (ms) */
  readonly processingTimeMs?: number;
  /** Модель, для которой рассчитывался контекст */
  readonly targetModel?: string;
}

/** TaggedError тип для ошибок переполнения контекста */
export type ContextOverflowError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.BUSINESS;
    readonly origin: typeof ERROR_ORIGIN.DOMAIN;
    readonly severity: typeof ERROR_SEVERITY.MEDIUM;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details: ContextOverflowErrorContext;
    readonly timestamp: string;
  },
  'ContextOverflowError'
>;

/** Создает ContextOverflowError с доменными правилами обработки контекста */
export function createContextOverflowError(
  code: ErrorCode,
  message: string,
  limitRule: ContextLimitRule,
  contextLength: number,
  maxAllowedLength: number,
  context?: Omit<
    ContextOverflowErrorContext,
    'type' | 'limitRule' | 'contextLength' | 'maxAllowedLength' | 'overflowAmount'
  >,
  timestamp?: string,
): ContextOverflowError {
  const overflowAmount = contextLength - maxAllowedLength;

  return {
    _tag: 'ContextOverflowError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: ERROR_SEVERITY.MEDIUM,
    code,
    message,
    details: {
      type: 'context_overflow',
      limitRule,
      contextLength,
      maxAllowedLength,
      overflowAmount,
      ...context,
    },
    timestamp: timestamp ?? new Date().toISOString(),
  } as ContextOverflowError;
}

/** Проверяет ContextOverflowErrorContext */
export function isValidContextOverflowErrorContext(
  context: unknown,
): context is ContextOverflowErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем обязательные поля
  if (ctx['type'] !== 'context_overflow') return false;
  const validLimitRules: readonly ContextLimitRule[] = [
    'token_limit_exceeded',
    'conversation_history_overflow',
    'system_prompt_overflow',
    'document_size_overflow',
    'streaming_context_overflow',
  ];
  if (
    typeof ctx['limitRule'] !== 'string'
    || !validLimitRules.includes(ctx['limitRule'] as ContextLimitRule)
  ) {
    return false;
  }
  if (typeof ctx['contextLength'] !== 'number') return false;
  if (typeof ctx['maxAllowedLength'] !== 'number') return false;
  if (typeof ctx['overflowAmount'] !== 'number') return false;

  // Проверяем опциональные поля
  if (ctx['contextType'] !== undefined && typeof ctx['contextType'] !== 'string') {
    return false;
  }
  if (
    ctx['truncationStrategy'] !== undefined
    && !['head', 'tail', 'middle', 'sliding_window'].includes(ctx['truncationStrategy'] as string)
  ) {
    return false;
  }
  if (ctx['recoverableParts'] !== undefined && !Array.isArray(ctx['recoverableParts'])) {
    return false;
  }
  if (ctx['lostParts'] !== undefined && !Array.isArray(ctx['lostParts'])) {
    return false;
  }
  if (
    ctx['optimizationSuggestions'] !== undefined && !Array.isArray(ctx['optimizationSuggestions'])
  ) {
    return false;
  }
  if (ctx['processingTimeMs'] !== undefined && typeof ctx['processingTimeMs'] !== 'number') {
    return false;
  }
  if (ctx['targetModel'] !== undefined && typeof ctx['targetModel'] !== 'string') {
    return false;
  }

  return true;
}

/** Создает ContextOverflowError для превышения токенов */
export function createTokenLimitExceededError(
  contextLength: number,
  maxAllowedLength: number,
  targetModel?: string,
  recoverableParts?: readonly {
    readonly content: string;
    readonly priority: number;
    readonly metadata?: Record<string, unknown>;
  }[],
): ContextOverflowError {
  const baseContext = {
    contextType: 'conversation' as const,
    truncationStrategy: 'sliding_window' as const,
    optimizationSuggestions: [
      'Укоротите сообщения в истории чата',
      'Удалите нерелевантный контекст',
      'Используйте более короткие ответы',
      'Разбейте задачу на подзадачи',
    ] as const,
  };

  const contextWithModel = Boolean(targetModel?.trim())
    ? { ...baseContext, targetModel: targetModel!.trim() }
    : baseContext;

  return createContextOverflowError(
    'SERVICE_AI_TOKEN_LIMIT_EXCEEDED' as ErrorCode,
    `Контекст превышает лимит токенов модели: ${contextLength}/${maxAllowedLength} (${
      contextLength - maxAllowedLength
    } токенов превышения)`,
    'token_limit_exceeded',
    contextLength,
    maxAllowedLength,
    recoverableParts
      ? { ...contextWithModel, recoverableParts: recoverableParts.slice(0, MAX_RECOVERABLE_PARTS) }
      : contextWithModel,
  );
}

/** Создает ContextOverflowError для превышения размера истории */
export function createConversationHistoryOverflowError(
  messageCount: number,
  maxMessages: number,
  contextLength: number,
  maxAllowedLength: number,
): ContextOverflowError {
  const overflowMessages = messageCount - maxMessages;

  return createContextOverflowError(
    'SERVICE_AI_TOKEN_LIMIT_EXCEEDED' as ErrorCode,
    `История чата слишком длинная: ${messageCount}/${maxMessages} сообщений (${contextLength}/${maxAllowedLength} токенов)`,
    'conversation_history_overflow',
    contextLength,
    maxAllowedLength,
    {
      contextType: 'conversation',
      truncationStrategy: 'head',
      lostParts: [{
        content: `${overflowMessages} старых сообщений`,
        reason: 'history_truncation',
        metadata: { messageCount: overflowMessages },
      }],
      optimizationSuggestions: [
        'Начните новый чат для новой темы',
        'Архивируйте старую историю',
        'Используйте summary предыдущих сообщений',
      ],
    },
  );
}

/** Создает ContextOverflowError для превышения системного промпта */
export function createSystemPromptOverflowError(
  promptLength: number,
  maxAllowedLength: number,
  targetModel: string,
): ContextOverflowError {
  const overflowChars = promptLength - maxAllowedLength;

  return createContextOverflowError(
    'SERVICE_AI_TOKEN_LIMIT_EXCEEDED' as ErrorCode,
    `Системный промпт слишком длинный для модели ${targetModel}: ${promptLength}/${maxAllowedLength} символов (${overflowChars} превышение)`,
    'system_prompt_overflow',
    promptLength,
    maxAllowedLength,
    {
      contextType: 'system_prompt',
      truncationStrategy: 'tail',
      targetModel,
      optimizationSuggestions: [
        'Укоротите системный промпт',
        'Выделите ключевые инструкции',
        'Используйте более компактную формулировку',
        'Разделите инструкции на части',
      ],
    },
  );
}

/** Создает ContextOverflowError для превышения размера документа */
export function createDocumentOverflowError(
  documentSize: number,
  maxAllowedSize: number,
  documentType: string,
  recoverableContent?: string,
): ContextOverflowError {
  return createContextOverflowError(
    'SERVICE_AI_TOKEN_LIMIT_EXCEEDED' as ErrorCode,
    `Документ ${documentType} слишком большой: ${documentSize}/${maxAllowedSize} байт (${
      documentSize - maxAllowedSize
    } байт превышения)`,
    'document_size_overflow',
    documentSize,
    maxAllowedSize,
    Boolean(recoverableContent?.trim())
      ? {
        contextType: 'document',
        truncationStrategy: 'middle',
        recoverableParts: [{
          content: recoverableContent!.trim(),
          priority: 1,
          metadata: { documentType },
        }],
        optimizationSuggestions: [
          'Сожмите документ',
          'Разделите на части',
          'Удалите неважные разделы',
          'Используйте summary документа',
        ],
      }
      : {
        contextType: 'document',
        truncationStrategy: 'middle',
        optimizationSuggestions: [
          'Сожмите документ',
          'Разделите на части',
          'Удалите неважные разделы',
          'Используйте summary документа',
        ],
      },
  );
}

/** Создает ContextOverflowError для превышения лимита контекста в стриминге */
export function createStreamingContextOverflowError(
  currentTokens: number,
  maxTokens: number,
  streamingDuration: number,
): ContextOverflowError {
  return createContextOverflowError(
    'SERVICE_AI_TOKEN_LIMIT_EXCEEDED' as ErrorCode,
    `Стриминг прерван из-за превышения контекста: ${currentTokens}/${maxTokens} токенов (длительность: ${streamingDuration}ms)`,
    'streaming_context_overflow',
    currentTokens,
    maxTokens,
    {
      contextType: 'streaming',
      truncationStrategy: 'tail',
      processingTimeMs: streamingDuration,
      optimizationSuggestions: [
        'Уменьшите длину запроса',
        'Используйте более короткие инструкции',
        'Завершите текущий стрим и начните новый',
      ],
    },
  );
}

/** Проверяет ошибку на превышение токенов */
export function isTokenLimitError(error: ContextOverflowError): boolean {
  return error.details.limitRule === 'token_limit_exceeded';
}

/** Проверяет ошибку на переполнение истории чата */
export function isConversationHistoryError(error: ContextOverflowError): boolean {
  return error.details.limitRule === 'conversation_history_overflow';
}

/** Проверяет ошибку на переполнение системного промпта */
export function isSystemPromptError(error: ContextOverflowError): boolean {
  return error.details.limitRule === 'system_prompt_overflow';
}

/** Проверяет ошибку на переполнение документа */
export function isDocumentOverflowError(error: ContextOverflowError): boolean {
  return error.details.limitRule === 'document_size_overflow';
}

/** Проверяет ошибку на переполнение стриминга */
export function isStreamingOverflowError(error: ContextOverflowError): boolean {
  return error.details.limitRule === 'streaming_context_overflow';
}

/** Вычисляет процент превышения лимита */
export function getOverflowPercentage(error: ContextOverflowError): number {
  const { contextLength, maxAllowedLength } = error.details;
  return Math.round(((contextLength - maxAllowedLength) / maxAllowedLength) * 100);
}

/** Проверяет, является ли ошибка критичной (превышение > 50%) */
export function isCriticalOverflow(error: ContextOverflowError): boolean {
  return getOverflowPercentage(error) > 50;
}

/** Получает рекомендуемую стратегию усечения */
export function getRecommendedTruncationStrategy(
  error: ContextOverflowError,
): 'head' | 'tail' | 'middle' | 'sliding_window' {
  return error.details.truncationStrategy ?? 'sliding_window';
}
