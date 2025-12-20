/**
 * @file ErrorBuilders.ts - Enterprise-grade фабрики ошибок LivAiBot с полным coverage всех доменов
 *
 * Возвращает промежуточные TaggedError<T, Tag> типы для каждого домена:
 * Domain (Auth, User, Subscription, Bot, Token, Integration),
 * Infra (Database, Cache, Network, External),
 * Service (AI, Billing, Mobile, Tenant, Feature),
 * Admin (User, Finance, Audit, Integration).
 *
 * Fluent API, Effect-native builders для async операций, automatic metadata generation, validation.
 * Полностью устраняет циклические зависимости.
 */

// ==================== ИМПОРТЫ ====================

import { Effect } from 'effect';

import { assertValidErrorCode, createValidationContext } from './ErrorValidators.js';

import type { TaggedError } from './BaseErrorTypes.js';
import type { LivAiErrorCode } from './ErrorCode.js';
import type { ErrorClassification } from './ErrorConstants.js';
import type {
  AdminContext,
  AIProcessingContext,
  BotContext,
  ErrorMetadataContext,
  ErrorMetadataDomainContext,
  IntegrationContext,
  MetadataClock,
  UserContext,
} from './ErrorMetadata.js';
import type { ValidationResult } from './ErrorValidators.js';

// Расширенный тип контекста для инфраструктурных ошибок
type InfraContext = {
  type: 'infrastructure';
  component: 'database' | 'cache' | 'network';
  tableName?: string;
  operation?: string;
  cacheKey?: string;
  url?: string;
  method?: string;
};

// ==================== ОСНОВНЫЕ ТИПЫ ====================

/** Конфигурация для создания ошибки */
export type ErrorConfig = {
  /** Код ошибки LivAi */
  code: LivAiErrorCode;
  /** Сообщение ошибки */
  message: string;
  /** Метаданные ошибки (опционально) */
  metadata?: ErrorMetadataContext;
  /** Классификация ошибки (опционально) */
  classification?: ErrorClassification;
  /** Причина ошибки (опционально) */
  cause?: unknown;
};

/** Результат построения ошибки с валидацией */
export type ErrorBuildResult<T = unknown, Tag extends string = string> = {
  /** Построенная ошибка */
  readonly error: TaggedError<T, Tag>;
  /** Результат валидации */
  readonly validation: ValidationResult;
};

/** Создает базовые метаданные ошибки с correlationId и timestamp, optional domain context */
export function createBaseMetadata(
  clock: MetadataClock,
  domainContext?: ErrorMetadataDomainContext,
): ErrorMetadataContext {
  const base = {
    correlationId: clock.generateCorrelationId(),
    timestamp: clock.getCurrentTimestamp(),
  };

  return domainContext ? { ...base, context: domainContext } : base;
}

// ==================== FLUENT API BUILDER ====================

/** Базовый fluent builder для TaggedError с automatic metadata generation и validation */
export class ErrorBuilder<T = unknown, Tag extends string = string> {
  private readonly config: Partial<ErrorConfig>;
  private readonly clock: MetadataClock | undefined;
  private readonly domainContext: ErrorMetadataDomainContext | undefined;

  constructor(
    config: Partial<ErrorConfig> = {},
    clock: MetadataClock | undefined = undefined,
    domainContext: ErrorMetadataDomainContext | undefined = undefined,
  ) {
    this.config = config;
    this.clock = clock;
    this.domainContext = domainContext;
  }

  /** Настраивает builder с clock для deterministic генерации correlationId и timestamp */
  withClock(clock: MetadataClock): ErrorBuilder<T, Tag> {
    return new ErrorBuilder<T, Tag>(this.config, clock, this.domainContext);
  }

  /** Устанавливает domain context (user, bot, integration, etc.) для автоматической генерации метаданных */
  withDomainContext(context: ErrorMetadataDomainContext): ErrorBuilder<T, Tag> {
    return new ErrorBuilder<T, Tag>(this.config, this.clock, context);
  }

  /** Устанавливает код ошибки LivAi с префиксом (DOMAIN_AUTH_001, INFRA_DB_002, etc.) */
  code(code: LivAiErrorCode): ErrorBuilder<T, Tag> {
    const newConfig = { ...this.config, code };
    return new ErrorBuilder<T, Tag>(newConfig, this.clock, this.domainContext);
  }

  /** Устанавливает человеко-читаемое сообщение ошибки для пользователей и логирования */
  message(message: string): ErrorBuilder<T, Tag> {
    const newConfig = { ...this.config, message };
    return new ErrorBuilder<T, Tag>(newConfig, this.clock, this.domainContext);
  }

  /** Устанавливает полные метаданные ошибки (correlationId, timestamp, context) при отключенной automatic generation */
  metadata(metadata: ErrorMetadataContext): ErrorBuilder<T, Tag> {
    const newConfig = { ...this.config, metadata };
    return new ErrorBuilder<T, Tag>(newConfig, this.clock, this.domainContext);
  }

  /** Устанавливает классификацию ошибки (severity, category) для alerting и observability */
  classification(classification: ErrorClassification): ErrorBuilder<T, Tag> {
    const newConfig = { ...this.config, classification };
    return new ErrorBuilder<T, Tag>(newConfig, this.clock, this.domainContext);
  }

  /** Устанавливает причину ошибки для error chaining */
  cause(cause: unknown): ErrorBuilder<T, Tag> {
    const newConfig = { ...this.config, cause };
    return new ErrorBuilder<T, Tag>(newConfig, this.clock, this.domainContext);
  }

  /** Создает TaggedError с тегом, выполняет валидацию и возвращает результат с ошибкой и валидацией */
  buildWithTag(tag: Tag): ErrorBuildResult<T, Tag> {
    if (this.config.code === undefined || this.config.message === undefined) {
      // Return error result instead of throwing
      const error = {
        _tag: tag,
        code: 'DOMAIN_VALIDATION_001' as LivAiErrorCode,
        message: 'Error code and message are required',
      } as unknown as TaggedError<T, Tag>;
      return {
        error,
        validation: {
          isValid: false,
          errors: [{
            code: 'MISSING_CODE_OR_MESSAGE',
            message: 'Code and message are required',
            path: '',
          }],
          warnings: [],
          executionTimeMs: 0,
          strictnessLevel: 'dev',
        },
      };
    }

    // Auto-generate metadata if clock is provided and metadata not set
    if (!this.config.metadata && this.clock) {
      const newConfig = {
        ...this.config,
        metadata: createBaseMetadata(this.clock, this.domainContext),
      };
      return new ErrorBuilder<T, Tag>(newConfig, this.clock, this.domainContext).buildWithTag(tag);
    }

    const error = {
      _tag: tag,
      code: this.config.code,
      message: this.config.message,
      metadata: this.config.metadata,
      classification: this.config.classification,
      cause: this.config.cause,
    } as unknown as TaggedError<T, Tag>;

    // Validate error code
    const validation = assertValidErrorCode(this.config.code, createValidationContext('dev'));

    return { error, validation };
  }
}

// ==================== DOMAIN BUILDERS ====================

/** Builders для доменных ошибок (Domain слой) - бизнес-логика LivAiBot с автоматической настройкой UserContext/BotContext/IntegrationContext */
export class DomainErrorBuilders {
  constructor(private readonly clock?: MetadataClock) {}

  /** Создает builder для ошибок аутентификации с UserContext */
  auth(userId: string, sessionId?: string): ErrorBuilder {
    const context: UserContext = sessionId !== undefined
      ? { type: 'user', userId, sessionId }
      : { type: 'user', userId };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок пользователей с UserContext */
  user(userId: string, sessionId?: string): ErrorBuilder {
    const context: UserContext = sessionId !== undefined
      ? { type: 'user', userId, sessionId }
      : { type: 'user', userId };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок подписок с UserContext */
  subscription(userId: string): ErrorBuilder {
    const context: UserContext = { type: 'user', userId };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок ботов с BotContext (assistant/moderator/analyzer/executor) */
  bot(botId: string, botType: BotContext['botType'], version: string): ErrorBuilder {
    const context: BotContext = {
      type: 'bot',
      botId,
      botType,
      version,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок токенов с UserContext */
  token(userId: string): ErrorBuilder {
    const context: UserContext = { type: 'user', userId };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок интеграций с IntegrationContext (api/webhook/database/queue/external-service) */
  integration(
    integrationId: string,
    integrationType: IntegrationContext['integrationType'],
  ): ErrorBuilder {
    const context: IntegrationContext = {
      type: 'integration',
      integrationId,
      integrationType,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }
}

// ==================== INFRA BUILDERS ====================

/** Builders для инфраструктурных ошибок (Infra слой) - база данных, кеш, сеть с контекстом инфраструктурных компонентов */
export class InfraErrorBuilders {
  constructor(private readonly clock?: MetadataClock) {}

  /** Создает builder для ошибок базы данных */
  database(tableName?: string, operation?: string): ErrorBuilder {
    const context: InfraContext = {
      type: 'infrastructure',
      component: 'database',
      ...(tableName !== undefined && { tableName }),
      ...(operation !== undefined && { operation }),
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(
      context as unknown as ErrorMetadataDomainContext,
    );
  }

  /** Создает builder для ошибок кеша (Redis/Memcached) */
  cache(cacheKey?: string, operation?: string): ErrorBuilder {
    const context: InfraContext = {
      type: 'infrastructure',
      component: 'cache',
      ...(cacheKey !== undefined && { cacheKey }),
      ...(operation !== undefined && { operation }),
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(
      context as unknown as ErrorMetadataDomainContext,
    );
  }

  /** Создает builder для сетевых ошибок (HTTP/API calls) */
  network(url?: string, method?: string): ErrorBuilder {
    const context: InfraContext = {
      type: 'infrastructure',
      component: 'network',
      ...(url !== undefined && { url }),
      ...(method !== undefined && { method }),
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(
      context as unknown as ErrorMetadataDomainContext,
    );
  }

  /** Создает builder для ошибок внешних сервисов */
  external(serviceName?: string, externalId?: string): ErrorBuilder {
    const context = {
      type: 'integration' as const,
      integrationId: serviceName ?? 'external',
      integrationType: 'external-service' as const,
      ...(externalId !== undefined && { externalSystemId: externalId }),
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }
}

// ==================== SERVICE BUILDERS ====================

/** Builders для сервисных ошибок (Service слой) - AI, биллинг, мобильные, тенанты с соответствующим service context */
export class ServiceErrorBuilders {
  constructor(private readonly clock?: MetadataClock) {}

  /** Создает builder для ошибок AI обработки с AIProcessingContext */
  ai(modelId: string, processingType: AIProcessingContext['processingType']): ErrorBuilder {
    const context: AIProcessingContext = {
      type: 'aiProcessing',
      modelId,
      processingType,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок биллинга с UserContext */
  billing(userId: string, operation?: string): ErrorBuilder {
    const context = {
      type: 'user' as const,
      userId,
      billingOperation: operation,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(
      context as ErrorMetadataDomainContext,
    );
  }

  /** Создает builder для мобильных ошибок с UserContext */
  mobile(userId: string, deviceId?: string): ErrorBuilder {
    const context = {
      type: 'user' as const,
      userId,
      deviceId,
      platform: 'mobile' as const,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(
      context as ErrorMetadataDomainContext,
    );
  }

  /** Создает builder для ошибок мульти-тенантности */
  tenant(tenantId: string, operation?: string): ErrorBuilder {
    const context = {
      type: 'integration' as const,
      integrationId: tenantId,
      integrationType: 'database' as const,
      ...(operation !== undefined && { operation }),
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок фич-флагов и A/B тестирования */
  feature(featureName: string, userId?: string): ErrorBuilder {
    const context = {
      type: 'integration' as const,
      integrationId: featureName,
      integrationType: 'api' as const,
      ...(userId !== undefined && { userId }),
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }
}

// ==================== ADMIN BUILDERS ====================

/** Builders для административных ошибок (Admin слой) - админ-панель и privileged операции с AdminContext для аудита и безопасности */
export class AdminErrorBuilders {
  constructor(private readonly clock?: MetadataClock) {}

  /** Создает builder для ошибок управления пользователями в админке */
  user(adminId: string, _targetUserId: string, action: string): ErrorBuilder {
    const context: AdminContext = {
      type: 'admin',
      adminId,
      role: 'admin',
      action,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для финансовых операций в админке */
  finance(adminId: string, operation: string, amount?: number): ErrorBuilder {
    const context: AdminContext = {
      type: 'admin',
      adminId,
      role: 'admin',
      action: operation,
      ...(amount !== undefined && { amount }),
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок системы аудита */
  audit(adminId: string, auditAction: string): ErrorBuilder {
    const context: AdminContext = {
      type: 'admin',
      adminId,
      role: 'auditor',
      action: auditAction,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(context);
  }

  /** Создает builder для ошибок управления интеграциями в админке */
  integration(adminId: string, integrationId: string, adminAction: string): ErrorBuilder {
    const context = {
      type: 'admin' as const,
      adminId,
      role: 'admin' as const,
      action: adminAction,
      integrationId,
    };
    return new ErrorBuilder({}, this.clock).withDomainContext(
      context as ErrorMetadataDomainContext,
    );
  }
}

// ==================== MAIN ERROR BUILDER ====================

/** Главный error builder для LivAiBot с полным coverage всех доменов (19 builders) - единый интерфейс для TaggedError */
export class LivAiErrorBuilder {
  /** Builders для доменных ошибок (6 типов: auth/user/subscription/bot/token/integration) */
  readonly domain: DomainErrorBuilders;

  /** Builders для инфраструктурных ошибок (4 типа: database/cache/network/external) */
  readonly infra: InfraErrorBuilders;

  /** Builders для сервисных ошибок (5 типов: ai/billing/mobile/tenant/feature) */
  readonly service: ServiceErrorBuilders;

  /** Builders для административных ошибок (4 типа: user/finance/audit/integration) */
  readonly admin: AdminErrorBuilders;

  constructor(clock?: MetadataClock) {
    this.domain = new DomainErrorBuilders(clock);
    this.infra = new InfraErrorBuilders(clock);
    this.service = new ServiceErrorBuilders(clock);
    this.admin = new AdminErrorBuilders(clock);
  }
}

// ==================== EFFECT INTEGRATION ====================

/** Создает ошибку в Effect контексте с поддержкой automatic metadata generation */
/** NOTE: Создает новый ErrorBuilder каждый раз. Для оптимизации используйте singleton builder напрямую. */
export function createAsyncError<T = unknown, Tag extends string = string>(
  tag: Tag,
  config: ErrorConfig,
  clock?: MetadataClock,
): Effect.Effect<ErrorBuildResult<T, Tag>, never, never> {
  return Effect.sync(() => {
    let builder = new ErrorBuilder<T, Tag>();

    if (clock) {
      builder = builder.withClock(clock);
    }

    let result = builder
      .code(config.code)
      .message(config.message);

    if (config.metadata) {
      result = result.metadata(config.metadata);
    }
    if (config.classification) {
      result = result.classification(config.classification);
    }

    return result
      .cause(config.cause)
      .buildWithTag(tag);
  });
}

/** Создает ошибку в Effect контексте используя предоставленный builder с уже настроеннымс clock */
export function createAsyncErrorWithBuilder<T = unknown, Tag extends string = string>(
  builder: ErrorBuilder<T, Tag>,
  tag: Tag,
  config: ErrorConfig,
): Effect.Effect<ErrorBuildResult<T, Tag>, never, never> {
  return Effect.sync(() => {
    let result = builder
      .code(config.code)
      .message(config.message);

    if (config.metadata) {
      result = result.metadata(config.metadata);
    }
    if (config.classification) {
      result = result.classification(config.classification);
    }

    return result
      .cause(config.cause)
      .buildWithTag(tag);
  });
}

// ==================== EXPORTS ====================

/** Главный экземпляр error builder для LivAiBot - готов к использованию для создания любых типов ошибок платформы */
export const errorBuilder = new LivAiErrorBuilder();
