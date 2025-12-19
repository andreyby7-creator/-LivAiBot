/**
 * @file ErrorConstants.ts - Полная система констант ошибок LivAiBot с расширенной классификацией
 *
 * Immutable, чисто declarative константы для классификации ошибок:
 * - Severity: уровни критичности ошибок
 * - Category: категории ошибок по типу
 * - Origin: источник возникновения ошибки
 * - Impact: влияние на систему/пользователя
 * - Scope: область действия ошибки
 * - Layer: слой архитектуры где произошла ошибка
 * - Priority: приоритет обработки ошибки
 * - RetryPolicy: политика повторных попыток
 */

// ==================== SEVERITY CONSTANTS ====================

/**
 * Уровни критичности ошибок
 * Определяет влияние ошибки на работу системы
 */
export const ERROR_SEVERITY = {
  CRITICAL: "CRITICAL" as const,
  FATAL: "FATAL" as const,
  ERROR: "ERROR" as const,
  WARNING: "WARNING" as const,
  INFO: "INFO" as const,
} as const;

export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];

// ==================== CATEGORY CONSTANTS ====================

/**
 * Категории ошибок по типу проблемы
 * Классифицирует ошибки по их природе
 */
export const ERROR_CATEGORY = {
  BUSINESS: "BUSINESS" as const,
  TECHNICAL: "TECHNICAL" as const,
  SECURITY: "SECURITY" as const,
  PERFORMANCE: "PERFORMANCE" as const,
} as const;

export type ErrorCategory = typeof ERROR_CATEGORY[keyof typeof ERROR_CATEGORY];

// ==================== ORIGIN CONSTANTS ====================

/**
 * Источник возникновения ошибки
 * Определяет компонент системы где произошла ошибка
 */
export const ERROR_ORIGIN = {
  DOMAIN: "DOMAIN" as const,
  INFRASTRUCTURE: "INFRASTRUCTURE" as const,
  SERVICE: "SERVICE" as const,
  EXTERNAL: "EXTERNAL" as const,
  ADMIN: "ADMIN" as const,
} as const;

export type ErrorOrigin = typeof ERROR_ORIGIN[keyof typeof ERROR_ORIGIN];

// ==================== IMPACT CONSTANTS ====================

/**
 * Влияние ошибки на систему и пользователей
 * Определяет масштаб последствий ошибки
 */
export const ERROR_IMPACT = {
  USER: "USER" as const,
  SYSTEM: "SYSTEM" as const,
  DATA: "DATA" as const,
} as const;

export type ErrorImpact = typeof ERROR_IMPACT[keyof typeof ERROR_IMPACT];

// ==================== SCOPE CONSTANTS ====================

/**
 * Область действия ошибки
 * Определяет охват проблемы
 */
export const ERROR_SCOPE = {
  REQUEST: "REQUEST" as const,
  SESSION: "SESSION" as const,
  GLOBAL: "GLOBAL" as const,
} as const;

export type ErrorScope = typeof ERROR_SCOPE[keyof typeof ERROR_SCOPE];

// ==================== LAYER CONSTANTS ====================

/**
 * Слой архитектуры где произошла ошибка
 * Clean Architecture / Hexagonal Architecture слои
 */
export const ERROR_LAYER = {
  PRESENTATION: "PRESENTATION" as const,
  APPLICATION: "APPLICATION" as const,
  DOMAIN: "DOMAIN" as const,
  INFRASTRUCTURE: "INFRASTRUCTURE" as const,
} as const;

export type ErrorLayer = typeof ERROR_LAYER[keyof typeof ERROR_LAYER];

// ==================== PRIORITY CONSTANTS ====================

/**
 * Приоритет обработки ошибки
 * Определяет срочность реакции на ошибку
 */
export const ERROR_PRIORITY = {
  LOW: "LOW" as const,
  MEDIUM: "MEDIUM" as const,
  HIGH: "HIGH" as const,
  CRITICAL: "CRITICAL" as const,
} as const;

export type ErrorPriority = typeof ERROR_PRIORITY[keyof typeof ERROR_PRIORITY];

// ==================== RETRY POLICY CONSTANTS ====================

/**
 * Политика повторных попыток
 * Определяет стратегию повторения неудачных операций
 */
export const ERROR_RETRY_POLICY = {
  NONE: "NONE" as const,
  IMMEDIATE: "IMMEDIATE" as const,
  EXPONENTIAL_BACKOFF: "EXPONENTIAL_BACKOFF" as const,
  SCHEDULED: "SCHEDULED" as const,
} as const;

export type ErrorRetryPolicy = typeof ERROR_RETRY_POLICY[keyof typeof ERROR_RETRY_POLICY];

// ==================== COMBINED ERROR CLASSIFICATION ====================

/**
 * Полная классификация ошибки
 * Комбинирует все аспекты для комплексного описания ошибки
 */
export type ErrorClassification = {
  readonly severity: ErrorSeverity;
  readonly category: ErrorCategory;
  readonly origin: ErrorOrigin;
  readonly impact: ErrorImpact;
  readonly scope: ErrorScope;
  readonly layer: ErrorLayer;
  readonly priority: ErrorPriority;
  readonly retryPolicy: ErrorRetryPolicy;
};

// ==================== PREDEFINED CLASSIFICATIONS ====================

/**
 * Предопределенные классификации для распространенных типов ошибок
 * Immutable константы для быстрого использования
 */
export const ERROR_CLASSIFICATIONS = {
  SYSTEM_CRASH: {
    severity: ERROR_SEVERITY.CRITICAL,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    impact: ERROR_IMPACT.SYSTEM,
    scope: ERROR_SCOPE.GLOBAL,
    layer: ERROR_LAYER.INFRASTRUCTURE,
    priority: ERROR_PRIORITY.CRITICAL,
    retryPolicy: ERROR_RETRY_POLICY.NONE,
  } as const,

  DATABASE_CONNECTION_LOST: {
    severity: ERROR_SEVERITY.ERROR,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    impact: ERROR_IMPACT.SYSTEM,
    scope: ERROR_SCOPE.GLOBAL,
    layer: ERROR_LAYER.INFRASTRUCTURE,
    priority: ERROR_PRIORITY.HIGH,
    retryPolicy: ERROR_RETRY_POLICY.EXPONENTIAL_BACKOFF,
  } as const,

  AUTH_INVALID_CREDENTIALS: {
    severity: ERROR_SEVERITY.WARNING,
    category: ERROR_CATEGORY.SECURITY,
    origin: ERROR_ORIGIN.DOMAIN,
    impact: ERROR_IMPACT.USER,
    scope: ERROR_SCOPE.REQUEST,
    layer: ERROR_LAYER.DOMAIN,
    priority: ERROR_PRIORITY.MEDIUM,
    retryPolicy: ERROR_RETRY_POLICY.NONE,
  } as const,

  EXTERNAL_API_TIMEOUT: {
    severity: ERROR_SEVERITY.ERROR,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.EXTERNAL,
    impact: ERROR_IMPACT.USER,
    scope: ERROR_SCOPE.REQUEST,
    layer: ERROR_LAYER.INFRASTRUCTURE,
    priority: ERROR_PRIORITY.MEDIUM,
    retryPolicy: ERROR_RETRY_POLICY.EXPONENTIAL_BACKOFF,
  } as const,

  // Ошибки бизнес-логики
  BUSINESS_RULE_VIOLATION: {
    severity: ERROR_SEVERITY.WARNING,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    impact: ERROR_IMPACT.USER,
    scope: ERROR_SCOPE.REQUEST,
    layer: ERROR_LAYER.DOMAIN,
    priority: ERROR_PRIORITY.LOW,
    retryPolicy: ERROR_RETRY_POLICY.NONE,
  } as const,

  PERFORMANCE_DEGRADATION: {
    severity: ERROR_SEVERITY.WARNING,
    category: ERROR_CATEGORY.PERFORMANCE,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    impact: ERROR_IMPACT.SYSTEM,
    scope: ERROR_SCOPE.GLOBAL,
    layer: ERROR_LAYER.INFRASTRUCTURE,
    priority: ERROR_PRIORITY.MEDIUM,
    retryPolicy: ERROR_RETRY_POLICY.SCHEDULED,
  } as const,
} as const;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Создание пользовательской классификации ошибки
 * @param classification - параметры классификации
 * @returns полная классификация ошибки
 */
export function createErrorClassification(
  classification: Partial<ErrorClassification>,
): ErrorClassification {
  // Значения по умолчанию для обязательных полей
  const defaults: ErrorClassification = {
    severity: ERROR_SEVERITY.ERROR,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
    impact: ERROR_IMPACT.USER,
    scope: ERROR_SCOPE.REQUEST,
    layer: ERROR_LAYER.APPLICATION,
    priority: ERROR_PRIORITY.MEDIUM,
    retryPolicy: ERROR_RETRY_POLICY.NONE,
  };

  return { ...defaults, ...classification };
}

/**
 * Проверка совместимости классификаций
 * @param classification1 - первая классификация
 * @param classification2 - вторая классификация
 * @returns true если классификации совместимы
 */
export function areClassificationsCompatible(
  classification1: ErrorClassification,
  classification2: ErrorClassification,
): boolean {
  // Критические ошибки не совместимы с низким приоритетом
  if (
    classification1.severity === ERROR_SEVERITY.CRITICAL
    && classification2.priority === ERROR_PRIORITY.LOW
  ) {
    return false;
  }

  // Глобальные ошибки требуют высокого приоритета
  if (
    classification1.scope === ERROR_SCOPE.GLOBAL
    && classification2.priority === ERROR_PRIORITY.LOW
  ) {
    return false;
  }

  return true;
}

// ==================== CONSTANTS VALIDATION ====================

// Валидация что все константы определены
Object.freeze(ERROR_SEVERITY);
Object.freeze(ERROR_CATEGORY);
Object.freeze(ERROR_ORIGIN);
Object.freeze(ERROR_IMPACT);
Object.freeze(ERROR_SCOPE);
Object.freeze(ERROR_LAYER);
Object.freeze(ERROR_PRIORITY);
Object.freeze(ERROR_RETRY_POLICY);
Object.freeze(ERROR_CLASSIFICATIONS);
