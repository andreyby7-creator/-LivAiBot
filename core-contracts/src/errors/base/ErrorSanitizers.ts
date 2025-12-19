/**
 * @file ErrorSanitizers.ts - Security sanitization для предотвращения information disclosure
 *
 * Security sanitization для предотвращения information disclosure.
 * sanitizeError(), sanitizeStackTrace(), sanitizeContext().
 * Configurable sanitization levels (strict/production/dev).
 */

// ==================== ИМПОРТЫ ====================

import type { ErrorCode } from './ErrorCode.js';
import type { ErrorMetadataContext, ErrorMetadataDomainContext } from './ErrorMetadata.js';

// ==================== УРОВНИ SANITIZATION ====================

/**
 * Уровни sanitization для конфигурирования поведения
 */
export type SanitizationLevel =
  | 'strict' // Максимальная sanitization для production
  | 'production' // Балансированная sanitization
  | 'dev'; // Минимальная sanitization для разработки

/**
 * Конфигурация sanitization
 */
export type SanitizationConfig = {
  readonly level: SanitizationLevel;
  readonly removeStackTraces: boolean;
  readonly removeInternalPaths: boolean;
  readonly removeSensitiveContext: boolean;
  readonly abstractErrorCodes: boolean;
  readonly customSensitiveFields: readonly string[];
};

/**
 * Результат sanitization
 */
export type SanitizationResult<T> = {
  readonly sanitized: T;
  readonly removedFields: readonly string[];
  readonly sanitizationLevel: SanitizationLevel;
};

// ==================== SENSITIVE DATA PATTERNS ====================

/**
 * Паттерны для обнаружения sensitive данных
 */
const SENSITIVE_PATTERNS = [
  /\b(?:api[_-]?key|token|secret|password|pwd|credential|auth[_-]?key)\b/i,
  /\b(?:connection[_-]?string|conn[_-]?str|database[_-]?url)\b/i,
  /\b(?:email|phone|ssn|social[_-]?security|credit[_-]?card)\b/i,
  /\b(?:internal[_-]?id|private[_-]?key|session[_-]?id)\b/i,
] as const;

/**
 * Проверяет, является ли поле sensitive
 */
function isSensitiveField(fieldName: string, customSensitiveFields?: readonly string[]): boolean {
  const safeCustomFields = customSensitiveFields ?? [];
  const allPatterns = [...SENSITIVE_PATTERNS, ...safeCustomFields];
  return allPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return fieldName.includes(pattern);
    }
    try {
      return pattern.test(fieldName);
    } catch {
      return false;
    }
  });
}

// ==================== ERROR CODE ABSTRACTION ====================

/**
 * Маппинг internal error codes на generic public codes
 * Для предотвращения information disclosure через error codes
 */
const ERROR_CODE_ABSTRACTION_MAP = {
  DB_CONNECTION_FAILED: 'INTERNAL_ERROR' as const,
  DB_QUERY_TIMEOUT: 'TIMEOUT_ERROR' as const,
  DB_CONSTRAINT_VIOLATION: 'VALIDATION_ERROR' as const,
  INVALID_JWT_TOKEN: 'AUTHENTICATION_ERROR' as const,
  EXPIRED_JWT_TOKEN: 'AUTHENTICATION_ERROR' as const,
  INVALID_API_KEY: 'AUTHENTICATION_ERROR' as const,
  INSUFFICIENT_PERMISSIONS: 'AUTHORIZATION_ERROR' as const,
  ROLE_ACCESS_DENIED: 'AUTHORIZATION_ERROR' as const,
  EXTERNAL_API_ERROR: 'EXTERNAL_SERVICE_ERROR' as const,
  THIRD_PARTY_TIMEOUT: 'EXTERNAL_SERVICE_ERROR' as const,
  UNKNOWN_ERROR: 'INTERNAL_ERROR' as const,
} as const;

/**
 * Абстрагирует error code для security
 */
function abstractErrorCode(internalCode: string): ErrorCode {
  if (internalCode in ERROR_CODE_ABSTRACTION_MAP) {
    return ERROR_CODE_ABSTRACTION_MAP[internalCode as keyof typeof ERROR_CODE_ABSTRACTION_MAP];
  }
  return 'INTERNAL_ERROR';
}

// ==================== DEFAULT CONFIGURATIONS ====================

/**
 * Default конфигурации для разных уровней sanitization
 */
export const DEFAULT_SANITIZATION_CONFIGS = {
  strict: {
    level: 'strict',
    removeStackTraces: true,
    removeInternalPaths: true,
    removeSensitiveContext: true,
    abstractErrorCodes: true,
    customSensitiveFields: [],
  },

  production: {
    level: 'production',
    removeStackTraces: true,
    removeInternalPaths: true,
    removeSensitiveContext: true,
    abstractErrorCodes: false,
    customSensitiveFields: [],
  },

  dev: {
    level: 'dev',
    removeStackTraces: false,
    removeInternalPaths: false,
    removeSensitiveContext: false,
    abstractErrorCodes: false,
    customSensitiveFields: [],
  },
} as const;

// ==================== SANITIZE ERROR ====================

/**
 * Sanitize error object для предотвращения information disclosure
 * Удаляет sensitive data, stack traces, internal paths в зависимости от конфигурации
 */
export function sanitizeError(
  error: unknown,
  config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIGS.production
): SanitizationResult<unknown> {
  if (error === null || error === undefined || typeof error !== 'object') {
    return { sanitized: error, removedFields: [], sanitizationLevel: config.level };
  }

  // Здесь error гарантированно object и не null
  const errorObj = error as Record<string, unknown>;

  let sanitized = { ...errorObj };
  let removedFields: readonly string[] = [];

  // Sanitize stack trace
  if (config.removeStackTraces && 'stack' in sanitized) {
    const { stack, ...rest } = sanitized;
    void stack; // Explicitly ignore the stack value
    sanitized = rest;
    removedFields = [...removedFields, 'stack'];
  }

  // Sanitize error message if needed
  if (config.level === 'strict' && 'message' in sanitized) {
    sanitized = { ...sanitized, message: 'An error occurred' };
    removedFields = [...removedFields, 'message'];
  }

  // Abstract error code
  if (config.abstractErrorCodes && 'code' in sanitized) {
    const codeValue = sanitized['code'];
    if (typeof codeValue === 'string' && codeValue.length > 0) {
      const originalCode = codeValue;
      const newCode = abstractErrorCode(originalCode);
      if (originalCode !== newCode) {
        sanitized = { ...sanitized, code: newCode };
        removedFields = [...removedFields, `code (was: ${originalCode})`];
      }
    }
  }

  return { sanitized, removedFields, sanitizationLevel: config.level };
}

// ==================== SANITIZE STACK TRACE ====================

/**
 * Sanitize stack trace для фильтрации internal paths
 * Удаляет или маскирует internal file paths, line numbers в production
 */
export function sanitizeStackTrace(
  stackTrace: string | undefined,
  config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIGS.production
): string | undefined {
  if (stackTrace == null || stackTrace === '' || !config.removeInternalPaths) {
    return stackTrace;
  }

  // Здесь stackTrace гарантированно непустая строка
  const safeStackTrace = stackTrace;

  // Удаляем internal paths
  let sanitized = safeStackTrace.replace(/\(?file:\/\/[^)]+\)?/g, '(internal)');

  // Удаляем absolute paths
  const withPathsRemoved = sanitized.replace(/\(?\/[^)]+\)?/g, '(internal)');
  sanitized = withPathsRemoved.length > 0 ? withPathsRemoved : sanitized;

  // Для strict режима - полностью удаляем stack trace
  if (config.level === 'strict') {
    return undefined;
  }

  return sanitized;
}

// ==================== SANITIZE CONTEXT ====================

/**
 * Sanitize context для очистки sensitive context fields
 * Удаляет или маскирует sensitive данные в контексте ошибки
 */
export function sanitizeContext(
  context: ErrorMetadataContext | undefined,
  config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIGS.production
): ErrorMetadataContext | undefined {
  if (!context || !config.removeSensitiveContext) {
    return context;
  }

  // Sanitize domain context if exists
  const sanitizedDomainContext = context.context
    ? sanitizeDomainContext(context.context, config)
    : undefined;

  return sanitizedDomainContext ? { ...context, context: sanitizedDomainContext } : context;
}

/**
 * Sanitize domain context
 */
function sanitizeDomainContext(
  domainContext: ErrorMetadataDomainContext,
  config: SanitizationConfig
): ErrorMetadataDomainContext {
  // Для всех типов контекста применяем generic sanitization
  const sanitized = { ...domainContext } as Record<string, unknown>;

  // Рекурсивно очищаем вложенные объекты
  const finalSanitized = Object.entries(sanitized).reduce(
    (acc, [key, value]) => {
      if (isSensitiveField(key, config.customSensitiveFields)) {
        return config.level === 'strict'
          ? acc // Пропускаем sensitive поля в strict режиме
          : { ...acc, [key]: '[REDACTED]' }; // Заменяем на [REDACTED]
      }

      if (
        value !== null &&
        value !== undefined &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        // Рекурсивная очистка вложенных объектов
        return { ...acc, [key]: sanitizeNestedObject(value as Record<string, unknown>, config) };
      }

      // Копируем обычные поля
      return { ...acc, [key]: value };
    },
    {} as Record<string, unknown>
  );

  return finalSanitized as unknown as ErrorMetadataDomainContext;
}

/**
 * Рекурсивная очистка вложенных объектов
 */
function sanitizeNestedObject(
  obj: Record<string, unknown>,
  config: SanitizationConfig
): Record<string, unknown> {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      if (isSensitiveField(key, config.customSensitiveFields)) {
        return config.level === 'strict'
          ? acc // Пропускаем sensitive поля
          : { ...acc, [key]: '[REDACTED]' }; // Заменяем на [REDACTED]
      }

      // Копируем обычные поля
      return { ...acc, [key]: value };
    },
    {} as Record<string, unknown>
  );
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Sanitize error с использованием preset уровня и optional overrides
 */
export function sanitizeErrorWithLevel(
  error: unknown,
  level: SanitizationLevel,
  overrides?: Partial<Omit<SanitizationConfig, 'level'>>
): SanitizationResult<unknown> {
  let baseConfig: SanitizationConfig;
  switch (level) {
    case 'strict':
      baseConfig = DEFAULT_SANITIZATION_CONFIGS.strict;
      break;
    case 'production':
      baseConfig = DEFAULT_SANITIZATION_CONFIGS.production;
      break;
    case 'dev':
      baseConfig = DEFAULT_SANITIZATION_CONFIGS.dev;
      break;
    default:
      baseConfig = DEFAULT_SANITIZATION_CONFIGS.production;
  }
  const config = { ...baseConfig, ...overrides };
  return sanitizeError(error, config);
}

// ==================== TYPE EXPORTS ====================

export type { SanitizationConfig as SanitizationConfigType };
