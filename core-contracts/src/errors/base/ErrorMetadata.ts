/**
 * @file ErrorMetadata.ts - Enterprise-grade система метаданных LivAiBot
 *
 * Deterministic генерация, chain-aware merging, typed contexts и tracing support.
 * Полностью тестируемая и production-ready.
 */

// ==================== ИМПОРТЫ ====================

import type { Context } from 'effect';

// ==================== ОСНОВНЫЕ ТИПЫ МЕТАДАННЫХ ====================

/**
 * Correlation ID для tracing distributed операций
 * Уникальный идентификатор для связывания всех операций в цепочке
 */
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

/**
 * Timestamp с гарантией monotonicности для deterministic генерации
 */
export type MetadataTimestamp = number & { readonly __brand: 'MetadataTimestamp' };

/**
 * Базовый контекст метаданных ошибки
 */
export interface ErrorMetadataContext {
  /** Correlation ID для tracing */
  readonly correlationId: CorrelationId;

  /** Timestamp генерации метаданных */
  readonly timestamp: MetadataTimestamp;

  /** Дополнительный контекст домена */
  readonly context?: ErrorMetadataDomainContext;
}

/**
 * Результат валидации метаданных
 */
export interface MetadataValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// ==================== METADATA CLOCK INTERFACE ====================

/**
 * Interface для deterministic генерации correlationId и timestamp
 * Позволяет DI для тестируемой генерации в production и mock в тестах
 */
export interface MetadataClock {
  /**
   * Генерирует новый correlation ID
   * Гарантирует уникальность в рамках системы
   */
  generateCorrelationId(): CorrelationId;

  /**
   * Возвращает текущий timestamp
   * Гарантирует monotonicность для deterministic поведения
   */
  getCurrentTimestamp(): MetadataTimestamp;
}

/**
 * Тип для Context tag MetadataClock DI
 * Реальный tag будет создан в DI контейнере
 */
export type MetadataClockTag = Context.Tag<string, MetadataClock>;

// ==================== CHAIN-AWARE MERGING ====================

/**
 * Стратегии объединения метаданных при chain errors
 */
export type MetadataMergeStrategy =
  | 'first-wins' // Первое значение имеет приоритет
  | 'last-wins' // Последнее значение имеет приоритет
  | 'merge-contexts' // Контексты объединяются
  | 'preserve-original'; // Оригинальные метаданные сохраняются

/**
 * Результат merging метаданных
 */
export interface MetadataMergeResult {
  readonly merged: ErrorMetadataContext;
  readonly strategy: MetadataMergeStrategy;
  readonly conflicts: readonly string[];
}

export function mergeMetadata(
  primary: Readonly<ErrorMetadataContext>,
  secondary: Readonly<ErrorMetadataContext>,
  strategy: MetadataMergeStrategy = 'merge-contexts'
): MetadataMergeResult {
  switch (strategy) {
    case 'first-wins':
      return { merged: primary, strategy, conflicts: [] } as const;
    case 'last-wins':
      return { merged: secondary, strategy, conflicts: [] } as const;
    case 'preserve-original':
      return { merged: primary, strategy, conflicts: [] } as const;
    case 'merge-contexts':
    default: {
      const conflicts =
        primary.correlationId !== secondary.correlationId ? ['correlationId conflict'] : [];
      const latestTimestamp =
        primary.timestamp > secondary.timestamp ? primary.timestamp : secondary.timestamp;
      const mergedContext = mergeDomainContexts(primary.context, secondary.context);

      return {
        merged: {
          correlationId: primary.correlationId,
          timestamp: latestTimestamp,
          ...(mergedContext && { context: mergedContext }),
        },
        strategy,
        conflicts,
      };
    }
  }
}

/**
 * Helper для объединения domain contexts
 */
function mergeDomainContexts(
  primary?: Readonly<ErrorMetadataDomainContext>,
  secondary?: Readonly<ErrorMetadataDomainContext>
): ErrorMetadataDomainContext | undefined {
  if (!primary && !secondary) return undefined;
  if (!primary) return secondary;
  if (!secondary) return primary;

  // Простое объединение - можно расширить для специфической логики
  return {
    ...primary,
    ...secondary,
  };
}

// ==================== TYPED CONTEXTS ====================

/**
 * Union type всех domain contexts
 */
export type ErrorMetadataDomainContext =
  | UserContext
  | BotContext
  | IntegrationContext
  | AIProcessingContext
  | AdminContext;

type DomainContextType = ErrorMetadataDomainContext['type'];

export interface UserContext {
  readonly type: 'user';
  readonly userId: string;
  readonly sessionId?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

export interface BotContext {
  readonly type: 'bot';
  readonly botId: string;
  readonly botType: 'assistant' | 'moderator' | 'analyzer' | 'executor';
  readonly version: string;
  readonly config?: Record<string, unknown>;
}

export interface IntegrationContext {
  readonly type: 'integration';
  readonly integrationId: string;
  readonly integrationType: 'api' | 'webhook' | 'database' | 'queue' | 'external-service';
  readonly externalSystemId?: string;
  readonly requestMetadata?: Record<string, unknown>;
}

export interface AIProcessingContext {
  readonly type: 'aiProcessing';
  readonly modelId: string;
  readonly processingType:
    | 'text-generation'
    | 'image-processing'
    | 'data-analysis'
    | 'classification';
  readonly tokensUsed?: number;
  readonly parameters?: Record<string, unknown>;
}

export interface AdminContext {
  readonly type: 'admin';
  readonly adminId: string;
  readonly role: 'super-admin' | 'admin' | 'moderator' | 'auditor';
  readonly action: string;
  readonly auditMetadata?: Record<string, unknown>;
}

// ==================== TRACING SUPPORT ====================

/**
 * Tracing metadata для distributed debugging
 * Поддерживает complex distributed экосистему LivAiBot
 */
export interface TracingMetadata {
  /** Trace ID для distributed tracing */
  readonly traceId: string;

  /** Span ID для текущей операции */
  readonly spanId: string;

  /** Parent span ID */
  readonly parentSpanId?: string;

  /** Service name */
  readonly serviceName: string;

  /** Operation name */
  readonly operationName: string;

  /** Tags для категоризации */
  readonly tags: Record<string, string>;

  /** Baggage для передачи контекста */
  readonly baggage: Record<string, string>;
}

/**
 * Полные метаданные с tracing support
 */
export interface ErrorMetadataWithTracing extends ErrorMetadataContext {
  readonly tracing?: TracingMetadata;
}

// ==================== VALIDATION HELPERS ====================

/**
 * Валидирует метаданные на корректность
 */
export function validateMetadata(
  metadata: Readonly<ErrorMetadataContext>
): MetadataValidationResult {
  let errors: readonly string[] = [];
  let warnings: readonly string[] = [];

  // Проверяем correlationId
  if (metadata.correlationId.trim() === '') {
    errors = [...errors, 'correlationId is required and cannot be empty'];
  }

  // Проверяем timestamp
  if (metadata.timestamp <= 0) {
    errors = [...errors, 'timestamp must be a positive number'];
  }

  // Проверяем context если он есть
  if (metadata.context) {
    const contextValidation = validateDomainContext(metadata.context);
    errors = [...errors, ...contextValidation.errors];
    warnings = [...warnings, ...contextValidation.warnings];
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Валидирует domain context
 */
function validateDomainContext(
  context: Readonly<ErrorMetadataDomainContext>
): MetadataValidationResult {
  const validators: Record<DomainContextType, (ctx: any) => readonly string[]> = {
    user: (ctx: UserContext) => [!ctx.userId.trim() ? 'userId required' : ''].filter(err => err),

    bot: (ctx: BotContext) =>
      [
        !ctx.botId.trim() ? 'botId required' : '',
        !['assistant', 'moderator', 'analyzer', 'executor'].includes(ctx.botType)
          ? 'invalid botType'
          : '',
      ].filter(err => err),

    integration: (ctx: IntegrationContext) =>
      [
        !ctx.integrationId.trim() ? 'integrationId required' : '',
        !['api', 'webhook', 'database', 'queue', 'external-service'].includes(ctx.integrationType)
          ? 'invalid integrationType'
          : '',
      ].filter(err => err),

    aiProcessing: (ctx: AIProcessingContext) =>
      [
        !ctx.modelId.trim() ? 'modelId required' : '',
        !['text-generation', 'image-processing', 'data-analysis', 'classification'].includes(
          ctx.processingType
        )
          ? 'invalid processingType'
          : '',
      ].filter(err => err),

    admin: (ctx: AdminContext) =>
      [
        !ctx.adminId.trim() ? 'adminId required' : '',
        !['super-admin', 'admin', 'moderator', 'auditor'].includes(ctx.role) ? 'invalid role' : '',
        !ctx.action.trim() ? 'action required' : '',
      ].filter(err => err),
  };

  const validator = validators[context.type];
  const errors = validator(context);

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Helper для добавления tracing к метаданным
 */
export function withTracing(
  metadata: ErrorMetadataContext,
  tracing: TracingMetadata
): ErrorMetadataWithTracing {
  return {
    ...metadata,
    tracing,
  };
}

// ==================== TYPE EXPORTS ====================

export type { ErrorMetadataWithTracing as ErrorMetadataWithTracingType };
