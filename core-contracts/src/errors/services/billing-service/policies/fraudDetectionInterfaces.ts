/**
 * @file fraudDetectionInterfaces.ts – Интерфейсы для fraud detection микросервисов
 *
 * Определяет контракты для dependency injection и замены реализаций.
 * Позволяет загружать правила из внешних источников и интегрировать external APIs.
 *
 * Архитектурные принципы:
 * - Interface segregation: отдельные интерфейсы для разных ответственностей
 * - Dependency injection: все зависимости через интерфейсы
 * - Extensibility: легкая замена реализаций без изменения core logic
 * - Error handling: все методы возвращают Effect с обработкой ошибок
 */

import { Effect } from 'effect';

import type {
  FraudContext,
  FraudDecision,
  FraudPolicyConfig,
  FraudReason,
  FraudRule,
  RulePriority,
} from './fraudDetectionTypes.js';

// ==================== COMMON TYPES ====================

/** Унифицированный тип для результатов провайдеров с consistent error handling. */
export type ProviderResult<T, E = FraudDetectionError> = Effect.Effect<T, E>;

/** Специализированные типы результатов для каждого провайдера с автоматическими типами ошибок. */
export type FraudRuleProviderResult<T> = ProviderResult<T, FraudRuleProviderError>;
export type ExternalDataProviderResult<T> = ProviderResult<T, ExternalDataProviderError>;
export type FraudRuleEngineResult<T> = ProviderResult<T, FraudRuleEngineError>;
export type ExternalDataServiceResult<T> = ProviderResult<T | null>; // Graceful degradation

/** Event callback для A/B testing и rollout экспериментов при обновлении правил. */
export type RulesUpdateCallback = (event: {
  readonly oldRules: readonly FraudRule[];
  readonly newRules: readonly FraudRule[];
  readonly timestamp: number;
  readonly experimentId?: string;
  readonly rolloutPercentage?: number;
  readonly userSegment?: string;
  readonly metadata?: Record<string, unknown>;
}) => void;

/** Базовый тип для всех fraud detection ошибок с унифицированной обработкой. */
export type FraudDetectionError =
  | FraudRuleProviderError
  | ExternalDataProviderError
  | FraudRuleEngineError;

/** Контекст пользователя для tracing, кеширования и обратной совместимости. */
export type UserContext = {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly tenantId?: string;
  /** Feature flags для gradual rollout и A/B testing */
  readonly featureFlags?: Record<string, boolean>;
};

/** Опции таймаута для провайдеров. */
export type TimeoutOptions = {
  readonly timeoutMs?: number;
  readonly retryCount?: number;
  readonly retryDelayMs?: number;
  readonly retryBackoff?: 'linear' | 'exponential';
};

/** Multi-tenant конфигурация для enterprise систем с изоляцией по тенантам. */
export type TenantCallOptions = {
  /** Tenant-specific timeout overrides */
  readonly timeout?: TimeoutOptions;
  /** Tenant-specific circuit breaker settings */
  readonly circuitBreaker?: {
    readonly failureThreshold: number;
    readonly resetTimeoutMs: number;
    readonly name?: string;
  };
  /** Tenant-specific rate limiting */
  readonly rateLimit?: {
    readonly requestsPerSecond: number;
    readonly burstLimit?: number;
    readonly name?: string;
  };
  /** Business priority для QoS (Quality of Service) */
  readonly priority?: 'low' | 'normal' | 'high' | 'critical';
  /** Tenant-specific fallback strategies */
  readonly fallback?: {
    readonly enabled: boolean;
    readonly strategy?: 'cache_only' | 'degraded_mode' | 'external_backup';
    readonly maxAgeMs?: number;
  };
  /** Custom metadata для tenant-specific логирования и мониторинга */
  readonly metadata?: Record<string, unknown>;
};

/** Стандартизированные опции circuit breaker для всех внешних вызовов. */
export type StandardizedCircuitBreakerOptions = {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly name?: string;
  readonly monitoringEnabled?: boolean;
};

/** Стандартизированные опции retry для всех внешних вызовов. */
export type StandardizedRetryOptions = {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly retryableErrors?: readonly string[];
};

/** Опции для long-running external calls со стандартизированными circuit breaker и retry. */
export type ExternalCallOptions = {
  /** Стандартизированные timeout опции */
  readonly timeout?: TimeoutOptions;
  /** Стандартизированные circuit breaker опции */
  readonly circuitBreaker?: StandardizedCircuitBreakerOptions;
  /** Опции retry с exponential backoff */
  readonly retry?: StandardizedRetryOptions;
  readonly supervision?: {
    readonly enabled: boolean;
    readonly scopeName?: string;
  };
  /** Multi-tenant specific конфигурация для enterprise систем */
  readonly tenant?: TenantCallOptions;
  /** Feature flags для управления поведением external calls */
  readonly featureFlags?: Record<string, boolean>;
};

/** Стратегии fallback для провайдеров. */
export type FallbackStrategy =
  | { readonly type: 'none'; }
  | { readonly type: 'cache_only'; readonly maxAgeMs?: number; }
  | { readonly type: 'default_value'; readonly defaultValue: unknown; }
  | { readonly type: 'external_fallback'; readonly fallbackUrl?: string; }
  | {
    readonly type: 'circuit_breaker';
    readonly failureThreshold?: number;
    readonly resetTimeoutMs?: number;
  };

// ==================== FRAUD RULE PROVIDER ====================

/** Интерфейс для загрузки fraud rules из внешних источников (database, config, external services). */
export type FraudRuleProvider = {
  /**
   * Загружает активные правила мошенничества для заданной конфигурации.
   * @param config Конфигурация fraud detection policy
   * @param version Опциональная версия правил для кеширования и совместимости
   * @returns ProviderResult с массивом активных правил
   */
  readonly loadRules: (
    config: FraudPolicyConfig,
    version?: string,
  ) => FraudRuleProviderResult<readonly FraudRule[]>;

  /**
   * Обновляет кеш правил для hot reload.
   * Вызывается при изменении конфигурации правил без перезапуска.
   * @param newRules Новые правила для загрузки
   * @param options Опции обновления с callback для A/B testing и rollout экспериментов
   * @returns ProviderResult с подтверждением обновления
   */
  readonly updateRules?: (
    newRules: readonly FraudRule[],
    options?: {
      /** Callback для A/B testing и rollout экспериментов */
      onRulesUpdated?: RulesUpdateCallback;
      /** Metadata для экспериментов */
      experimentMetadata?: Record<string, unknown>;
    },
  ) => FraudRuleProviderResult<void>;
};

/** Ошибки FraudRuleProvider */
export type FraudRuleProviderError =
  | {
    readonly _tag: 'ConfigurationError';
    readonly message: string;
    readonly config: FraudPolicyConfig;
  }
  | { readonly _tag: 'NetworkError'; readonly message: string; readonly source: string; }
  | {
    readonly _tag: 'ValidationError';
    readonly message: string;
    readonly invalidRules: readonly string[];
  }
  | { readonly _tag: 'TimeoutError'; readonly message: string; readonly timeoutMs: number; };

// ==================== EXTERNAL DATA PROVIDER ====================

/** Интерфейс для external данных (геолокация, device fingerprint) с абстракцией APIs. */
export type ExternalDataProvider = {
  /** Получает геолокацию по IP адресу
   * @param ipAddress IP адрес для геолокации
   * @param correlationId ID для tracing
   * @param context Контекст пользователя для кеширования и логирования
   * @param options Опции timeout, retry и circuit breaker
   * @returns ProviderResult с геолокационными данными */
  readonly getGeolocation: (
    ipAddress: string,
    correlationId: string,
    context?: UserContext,
    options?: ExternalCallOptions,
  ) => ExternalDataProviderResult<GeolocationData>;

  /** Проверяет device fingerprint на подозрительность
   * @param fingerprint Данные device fingerprint
   * @param correlationId ID для tracing
   * @param context Контекст пользователя для кеширования и логирования
   * @param options Опции timeout, retry и circuit breaker
   * @returns ProviderResult с результатом проверки */
  readonly validateDeviceFingerprint: (
    fingerprint: DeviceFingerprintData,
    correlationId: string,
    context?: UserContext,
    options?: ExternalCallOptions,
  ) => ExternalDataProviderResult<DeviceFingerprintResult>;

  /** Инвалидирует кеш для IP или fingerprint
   * Полезно при подозрительной активности или принудительном обновлении
   * @param key IP адрес или fingerprint hash для инвалидации
   * @returns ProviderResult с подтверждением инвалидации */
  readonly invalidateCache?: (key: string) => ExternalDataProviderResult<void>;
};

/** Геолокационные данные от external provider */
export type GeolocationData = {
  readonly country: string;
  readonly city?: string;
  readonly coordinates?: { lat: number; lng: number; };
  readonly timezone?: string;
  readonly confidence: number;
  readonly source: string;
  readonly timestamp: number;
};

/** Данные device fingerprint для проверки */
export type DeviceFingerprintData = {
  readonly userAgent?: string;
  readonly ipAddress: string;
  readonly deviceId?: string;
  readonly fingerprintHash?: string;
  readonly correlationId: string;
};

/** Результат проверки device fingerprint */
export type DeviceFingerprintResult = {
  readonly isSuspicious: boolean;
  readonly confidence: number;
  readonly reasons: readonly string[];
  readonly metadata?: Record<string, unknown>;
};

/** Ошибки ExternalDataProvider */
export type ExternalDataProviderError =
  | { readonly _tag: 'NetworkError'; readonly message: string; readonly service: string; }
  | {
    readonly _tag: 'TimeoutError';
    readonly message: string;
    readonly timeoutMs: number;
    readonly service: string;
  }
  | {
    readonly _tag: 'RateLimitError';
    readonly message: string;
    readonly retryAfterMs: number;
    readonly service: string;
  }
  | { readonly _tag: 'InvalidInputError'; readonly message: string; readonly field: string; }
  | {
    readonly _tag: 'ServiceUnavailableError';
    readonly message: string;
    readonly service: string;
  };

// ==================== FRAUD RULE ENGINE ====================

/** Интерфейс для fraud rule engine - core decision engine с отделением логики оценки. */
export type FraudRuleEngine = {
  /** Оценивает контекст на мошенничество используя загруженные правила
   * @param context Контекст для оценки fraud
   * @param rules Активные правила для оценки
   * @param config Конфигурация оценки
   * @param version Версия правил для логирования и совместимости
   * @returns ProviderResult с решением о fraud */
  readonly evaluateRules: (
    context: FraudContext,
    rules: readonly FraudRule[],
    config: FraudPolicyConfig,
    version?: string,
  ) => FraudRuleEngineResult<FraudDecision>;

  /** Предварительно компилирует или кеширует правила для оптимизации производительности
   * Вызывается при загрузке новых правил
   * @param rules Правила для предварительной обработки
   * @returns ProviderResult с подтверждением готовности */
  readonly prepareRules?: (rules: readonly FraudRule[]) => FraudRuleEngineResult<void>;

  /** Получает версию правил для использования в оценке
   * Использует version manager для получения правильной версии
   * @param requestedVersion Запрашиваемая версия (если не указана - активная)
   * @returns Правила для указанной версии */
  readonly getRulesForVersion?: (
    requestedVersion?: string,
  ) => ProviderResult<{
    readonly rules: readonly FraudRule[];
    readonly version: string;
    readonly info: RuleVersionInfo;
  }, FraudRuleEngineError | RuleVersionManagerError>;

  /** Интегрируется с RuleVersionManager для управления версиями
   * @param versionManager Менеджер версий правил
   * @returns Результат интеграции */
  readonly setVersionManager?: (
    versionManager: RuleVersionManager,
  ) => FraudRuleEngineResult<void>;
};

/** Ошибки FraudRuleEngine */
export type FraudRuleEngineError =
  | {
    readonly _tag: 'RuleEvaluationError';
    readonly message: string;
    readonly ruleId: string;
    readonly context: FraudContext;
  }
  | { readonly _tag: 'ConfigurationError'; readonly message: string; readonly configIssue: string; }
  | {
    readonly _tag: 'PerformanceError';
    readonly message: string;
    readonly latencyMs: number;
    readonly ruleCount: number;
  };

// ==================== RULE VERSION MANAGER ====================

/** Информация о версии правил. */
export type RuleVersionInfo = {
  readonly version: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly ruleCount: number;
  readonly checksum: string;
  readonly metadata: Record<string, unknown>;
};

/** Статус версии правил. */
export type RuleVersionStatus =
  | 'draft'
  | 'testing'
  | 'active'
  | 'deprecated'
  | 'archived';

/** Результат валидации версии правил. */
export type RuleVersionValidation = {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly performance: {
    readonly estimatedLatency: number;
    readonly memoryUsage: number;
  };
};

/** Интерфейс для управления версиями правил fraud detection. */
export type RuleVersionManager = {
  /** Создает новую версию правил
   * @param rules Новые правила
   * @param metadata Метаданные версии
   * @returns Информация о созданной версии */
  readonly createVersion: (
    rules: readonly FraudRule[],
    metadata?: Record<string, unknown>,
  ) => ProviderResult<RuleVersionInfo, RuleVersionManagerError>;

  /** Получает правила по версии
   * @param version Номер версии
   * @returns Правила для указанной версии */
  readonly getVersion: (
    version: string,
  ) => ProviderResult<{
    readonly rules: readonly FraudRule[];
    readonly info: RuleVersionInfo;
    readonly status: RuleVersionStatus;
  }, RuleVersionManagerError>;

  /** Активирует указанную версию правил
   * @param version Номер версии для активации
   * @returns Результат активации */
  readonly activateVersion: (
    version: string,
  ) => ProviderResult<RuleVersionInfo, RuleVersionManagerError>;

  /** Получает текущую активную версию
   * @returns Информация об активной версии */
  readonly getActiveVersion: () => ProviderResult<{
    readonly version: string;
    readonly rules: readonly FraudRule[];
    readonly info: RuleVersionInfo;
  }, RuleVersionManagerError>;

  /** Валидирует правила перед активацией
   * @param rules Правила для валидации
   * @returns Результат валидации */
  readonly validateRules: (
    rules: readonly FraudRule[],
  ) => ProviderResult<RuleVersionValidation, RuleVersionManagerError>;

  /** Получает историю версий
   * @param limit Максимальное количество версий
   * @returns История версий */
  readonly getVersionHistory: (
    limit?: number,
  ) => ProviderResult<readonly RuleVersionInfo[], RuleVersionManagerError>;

  /** Создает резервную копию текущей версии
   * @param reason Причина создания backup
   * @returns Результат создания backup */
  readonly createBackup: (
    reason?: string,
  ) => ProviderResult<RuleVersionInfo, RuleVersionManagerError>;

  /** Восстанавливает версию из backup
   * @param version Номер версии для восстановления
   * @returns Результат восстановления */
  readonly restoreFromBackup: (
    version: string,
  ) => ProviderResult<RuleVersionInfo, RuleVersionManagerError>;
};

/** Ошибки RuleVersionManager */
export type RuleVersionManagerError =
  | { readonly _tag: 'VersionNotFound'; readonly message: string; readonly version: string; }
  | { readonly _tag: 'VersionAlreadyActive'; readonly message: string; readonly version: string; }
  | {
    readonly _tag: 'InvalidVersion';
    readonly message: string;
    readonly version: string;
    readonly reason: string;
  }
  | {
    readonly _tag: 'ValidationFailed';
    readonly message: string;
    readonly errors: readonly string[];
  }
  | { readonly _tag: 'StorageError'; readonly message: string; readonly operation: string; }
  | {
    readonly _tag: 'ConcurrentModification';
    readonly message: string;
    readonly version: string;
  };

// ==================== ENHANCED FRAUD RULE ENGINE ====================

/** Сервис для external данных с кешированием, circuit breakers и fallback стратегиями. */
export type ExternalDataService = {
  /** Получает геолокацию с кешированием и circuit breaker
   * Все ошибки обрабатываются internally с graceful degradation
   * @param ipAddress IP адрес
   * @param correlationId ID для tracing
   * @param context Контекст пользователя
   * @param options Опции для supervision и external call behavior
   * @returns ProviderResult с геолокацией или null (graceful degradation) */
  readonly getGeolocationWithFallback: (
    ipAddress: string,
    correlationId: string,
    context?: UserContext,
    options?: ExternalCallOptions,
  ) => ExternalDataServiceResult<GeolocationData>;

  /** Проверяет device fingerprint с circuit breaker
   * Все ошибки обрабатываются internally с graceful degradation
   * @param fingerprint Данные fingerprint
   * @param correlationId ID для tracing
   * @param context Контекст пользователя
   * @param options Опции для supervision и external call behavior
   * @returns ProviderResult с результатом проверки или null (graceful degradation) */
  readonly validateDeviceFingerprintWithFallback: (
    fingerprint: DeviceFingerprintData,
    correlationId: string,
    context?: UserContext,
    options?: ExternalCallOptions,
  ) => ExternalDataServiceResult<DeviceFingerprintResult>;
};

// ==================== ERROR HANDLING UTILITIES ====================

/** Стандартные значения по умолчанию для external call options. */
export const DEFAULT_EXTERNAL_CALL_OPTIONS: Required<ExternalCallOptions> = {
  timeout: {
    timeoutMs: 5000,
    retryCount: 2,
    retryDelayMs: 1000,
    retryBackoff: 'exponential',
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    name: 'default-external-service',
    monitoringEnabled: true,
  },
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['NetworkError', 'TimeoutError'],
  },
  supervision: {
    enabled: false,
    scopeName: 'external-call',
  },
  tenant: {
    priority: 'normal',
    fallback: {
      enabled: true,
      strategy: 'cache_only',
    },
  },
  featureFlags: {},
};

/** Helper функция для применения стандартизированных circuit breaker настроек. */
export function applyStandardizedCircuitBreaker<T>(
  effect: Effect.Effect<T>,
): Effect.Effect<T> {
  // В production реализации здесь будет логика circuit breaker
  // Пока возвращаем effect без изменений
  return effect;
}

/** Helper функция для применения стандартизированных retry настроек. */
export function applyStandardizedRetry<T>(
  effect: Effect.Effect<T>,
): Effect.Effect<T> {
  // В production реализации здесь будет логика retry с exponential backoff
  // Пока возвращаем effect без изменений
  return effect;
}

/** Helper для применения всех стандартизированных external call опций. */
export function applyStandardizedExternalCallOptions<T>(
  effect: Effect.Effect<T>,
): Effect.Effect<T> {
  // В mock реализации timeout, retry и circuit breaker не применяются
  // В production реализации эти опции будут полноценно реализованы
  return effect;
}

/** Helper для graceful error handling с преобразованием ошибок в null значения. */
export function withGracefulFallback<T>(
  result: ProviderResult<T, FraudDetectionError>,
): ProviderResult<T | null, never> {
  return Effect.catchAll(result, (error) =>
    Effect.gen(function*(_) {
      // Собираем информацию для observability
      const baseErrorInfo = {
        error: error._tag,
        message: error.message,
        timestamp: Date.now(),
      };

      // Добавляем stack trace если доступен (для debugging)
      const MAX_STACK_TRACE_LINES = 5;
      const errorInfo: Record<string, unknown> = error instanceof Error && error.stack != null
        ? {
          ...baseErrorInfo,
          stack: error.stack,
          stackLines: error.stack.split('\n').slice(0, MAX_STACK_TRACE_LINES),
        }
        : baseErrorInfo;

      // Логируем structured данные для observability
      yield* _(Effect.logWarning('Provider error handled gracefully', errorInfo));

      return null;
    })) as ProviderResult<T | null, never>;
}

/** Helper для unified error logging в provider results. */
export function withErrorLogging<T, E extends FraudDetectionError>(
  result: ProviderResult<T, E>,
  context: string,
): ProviderResult<T, E> {
  return Effect.catchAll(result, (error: E) =>
    Effect.gen(function*(_) {
      yield* _(Effect.logError(`${context} failed`, {
        error: error._tag,
        message: error.message,
        context,
      }));
      return yield* _(Effect.fail(error));
    })) as ProviderResult<T, E>;
}

// ==================== TRANSACTION SUCCESS ANALYZER ====================

/** Результат анализа успешности транзакций. */
export type TransactionAnalysisResult = {
  readonly confidence: number;
  readonly riskFactors: readonly string[];
  readonly successPatterns: readonly string[];
  readonly recommendations: readonly string[];
  readonly metadata: Record<string, unknown>;
};

/** Интерфейс для анализа успешности транзакций и паттернов поведения. */
export type TransactionSuccessAnalyzer = {
  /** Анализирует паттерны успешных транзакций пользователя
   * @param userId ID пользователя
   * @param timeRange Период анализа
   * @returns Результат анализа с confidence score и рекомендациями */
  readonly analyzeSuccessPatterns: (
    userId: string,
    timeRange: { start: number; end: number; },
  ) => ProviderResult<TransactionAnalysisResult, TransactionAnalyzerError>;

  /** Определяет baseline успешности для пользователя
   * @param userId ID пользователя
   * @param context Контекст анализа
   * @returns Baseline метрики успешности */
  readonly calculateSuccessBaseline: (
    userId: string,
    context: UserContext,
  ) => ProviderResult<{
    readonly baselineScore: number;
    readonly deviationThreshold: number;
    readonly factors: readonly string[];
  }, TransactionAnalyzerError>;
};

/** Ошибки TransactionSuccessAnalyzer */
export type TransactionAnalyzerError =
  | { readonly _tag: 'AnalysisError'; readonly message: string; readonly userId: string; }
  | {
    readonly _tag: 'InsufficientData';
    readonly message: string;
    readonly userId: string;
    readonly requiredTransactions: number;
  }
  | {
    readonly _tag: 'InvalidTimeRange';
    readonly message: string;
    readonly start: number;
    readonly end: number;
  };

// ==================== REFUND POLICY INTEGRATION ====================

/** Статус refund запроса. */
export type RefundStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'processed'
  | 'failed';

/** Refund политика результат. */
export type RefundPolicyResult = {
  readonly canRefund: boolean;
  readonly reason: string;
  readonly refundAmount?: number;
  readonly processingFee?: number;
  readonly metadata: Record<string, unknown>;
};

/** Интерфейс для интеграции с политикой возвратов. */
export type RefundPolicyIntegration = {
  /** Проверяет возможность refund для транзакции
   * @param transactionId ID транзакции
   * @param context Контекст пользователя
   * @returns Результат проверки refund политики */
  readonly checkRefundEligibility: (
    transactionId: string,
    context: UserContext,
  ) => ProviderResult<RefundPolicyResult, RefundPolicyError>;

  /** Получает историю refund для пользователя
   * @param userId ID пользователя
   * @param limit Максимальное количество записей
   * @returns История refund запросов */
  readonly getRefundHistory: (
    userId: string,
    limit?: number,
  ) => ProviderResult<
    readonly {
      readonly transactionId: string;
      readonly amount: number;
      readonly status: RefundStatus;
      readonly requestedAt: number;
      readonly processedAt?: number;
      readonly reason?: string;
    }[],
    RefundPolicyError
  >;

  /** Рассчитывает refund score для fraud detection
   * @param userId ID пользователя
   * @param transactionId ID транзакции
   * @returns Refund score для оценки риска */
  readonly calculateRefundScore: (
    userId: string,
    transactionId: string,
  ) => ProviderResult<{
    readonly score: number;
    readonly factors: readonly string[];
    readonly riskLevel: 'low' | 'medium' | 'high';
  }, RefundPolicyError>;
};

/** Ошибки RefundPolicyIntegration */
export type RefundPolicyError =
  | {
    readonly _tag: 'RefundNotAllowed';
    readonly message: string;
    readonly transactionId: string;
    readonly reason: string;
  }
  | {
    readonly _tag: 'TransactionNotFound';
    readonly message: string;
    readonly transactionId: string;
  }
  | { readonly _tag: 'RefundInProgress'; readonly message: string; readonly transactionId: string; }
  | { readonly _tag: 'PolicyViolation'; readonly message: string; readonly violation: string; };

// ==================== RULE CONFIGURATION ====================

/** JSON-based rule definition for external configuration */
export type JsonFraudRule = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly condition: string; // JavaScript expression as string
  readonly score: number;
  readonly reason: FraudReason;
  readonly priority: RulePriority;
  readonly enabled: boolean;
  readonly version: string;
  readonly metadata?: Record<string, unknown>;
};

/** Rule loading source types */
export type RuleSource =
  | { readonly _tag: 'json'; readonly rules: readonly JsonFraudRule[]; }
  | { readonly _tag: 'hardcoded'; readonly rules: readonly FraudRule[]; }
  | {
    readonly _tag: 'mixed';
    readonly jsonRules?: readonly JsonFraudRule[];
    readonly hardcodedRules?: readonly FraudRule[];
  };

/** Rule loader interface for external rule sources */
export type RuleLoader = {
  /** Load rules from external source
   * @param config Configuration for loading
   * @returns Rules from external source */
  readonly loadRules: (
    config: { source: RuleSource; context?: UserContext; },
  ) => ProviderResult<readonly FraudRule[], RuleLoadError>;
};

/** Errors for rule loading */
export type RuleLoadError =
  | { readonly _tag: 'InvalidJson'; readonly message: string; readonly json: string; }
  | {
    readonly _tag: 'ParseError';
    readonly message: string;
    readonly ruleId: string;
    readonly expression: string;
  }
  | {
    readonly _tag: 'ValidationError';
    readonly message: string;
    readonly ruleId: string;
    readonly reason: string;
  }
  | { readonly _tag: 'SourceUnavailable'; readonly message: string; readonly source: string; };

// ==================== SERVICE HEALTH CONTRACT ====================

/** Статус здоровья сервиса для monitoring и orchestration. */
export type HealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy';

/** Детальная информация о здоровье сервиса. */
export type HealthDetails = {
  readonly status: HealthStatus;
  readonly timestamp: number;
  readonly uptime: number;
  readonly version: string;
  readonly checks: readonly {
    readonly name: string;
    readonly status: HealthStatus;
    readonly message?: string;
    readonly duration: number;
  }[];
};

/** Контракт для проверки здоровья сервиса (Kubernetes/service mesh ready). */
export type ServiceHealthContract = {
  /** Проверяет общее здоровье сервиса
   * Используется для load balancing, auto-healing, monitoring
   * @returns Детальная информация о здоровье всех компонентов */
  readonly checkHealth: () => ProviderResult<HealthDetails, never>;
};

// ==================== ENHANCED SERVICE REGISTRY ====================

/** Реестр fraud detection сервисов для dependency injection и замены реализаций. */
export type FraudDetectionServiceRegistry = {
  readonly ruleProvider: FraudRuleProvider;
  readonly externalDataProvider: ExternalDataProvider;
  readonly ruleEngine: FraudRuleEngine;
  readonly externalDataService: ExternalDataService;
  readonly ruleVersionManager?: RuleVersionManager;
  readonly transactionAnalyzer?: TransactionSuccessAnalyzer;
  readonly refundPolicy?: RefundPolicyIntegration;

  /** Infrastructure services (production-ready) */
  readonly health?: ServiceHealthContract;
  readonly ruleLoader?: RuleLoader;
};
