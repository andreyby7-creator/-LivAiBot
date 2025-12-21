/**
 * @file ErrorSanitizers.ts - Система безопасности для санитизации ошибок и предотвращения утечки информации
 *
 * Полная система санитизации ошибок с конфигурируемыми уровнями безопасности (strict/production/dev).
 * Включает уровни санитизации, конфигурацию, результаты обработки, паттерны чувствительных данных,
 * проверку полей, маппинг кодов ошибок, абстракцию кодов, стандартные конфигурации,
 * рекурсивную обработку объектов ошибок, санитизацию стек-трейсов, контекстов, доменных контекстов,
 * вложенных объектов и удобные функции с предустановленными уровнями.
 */

// ==================== ИМПОРТЫ ====================

import type { ErrorCode } from './ErrorCode.js';
import type { ErrorMetadataContext, ErrorMetadataDomainContext } from './ErrorMetadata.js';

// ==================== УРОВНИ SANITIZATION ====================

/** Уровни санитизации для конфигурирования поведения */
export type SanitizationLevel =
  | 'strict' // Максимальная санитизация для production
  | 'production' // Балансированная санитизация
  | 'dev'; // Минимальная санитизация для разработки

/** Конфигурация санитизации */
export type SanitizationConfig = {
  readonly level: SanitizationLevel;
  readonly removeStackTraces: boolean;
  readonly removeInternalPaths: boolean;
  readonly removeSensitiveContext: boolean;
  readonly abstractErrorCodes: boolean;
  readonly customSensitiveFields: readonly string[];
};

/** Результат санитизации */
export type SanitizationResult<T> = {
  readonly sanitized: T;
  readonly removedFields: readonly string[];
  readonly sanitizationLevel: SanitizationLevel;
};

// ==================== SENSITIVE DATA PATTERNS ====================

/** Паттерны для обнаружения чувствительных данных */
const SENSITIVE_PATTERNS = [
  /\b(?:api[_-]?key|token|secret|password|pwd|credential|auth[_-]?key|authorization)\b/i,
  /\b(?:connection[_-]?string|conn[_-]?str|database[_-]?url)\b/i,
  /\b(?:email|phone|ssn|social[_-]?security|credit[_-]?card)\b/i,
  /\b(?:internal[_-]?id|private[_-]?key|session[_-]?id)\b/i,
  /\b(?:user[_-]?agent|ip[_-]?address)\b/i,
] as const;

/** Проверяет, является ли поле чувствительным */
function isSensitiveField(fieldName: string, customSensitiveFields?: readonly string[]): boolean {
  const safeCustomFields = customSensitiveFields ?? [];
  const allPatterns = [...SENSITIVE_PATTERNS, ...safeCustomFields];
  return allPatterns.some((pattern) => {
    try {
      if (typeof pattern === 'string') {
        // Для строковых паттернов используем безопасное сравнение includes вместо RegExp
        return fieldName.toLowerCase().includes(pattern.toLowerCase());
      }
      return pattern.test(fieldName);
    } catch {
      // Если регулярное выражение не удалось, используем поиск подстроки
      return typeof pattern === 'string' && fieldName.includes(pattern);
    }
  });
}

// ==================== ERROR CODE ABSTRACTION ====================

/** Маппинг внутренних кодов ошибок на общие публичные коды для предотвращения утечки информации через коды ошибок */
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

/** Абстрагирует код ошибки для безопасности */
function abstractErrorCode(internalCode: string): ErrorCode {
  if (internalCode in ERROR_CODE_ABSTRACTION_MAP) {
    return ERROR_CODE_ABSTRACTION_MAP[internalCode as keyof typeof ERROR_CODE_ABSTRACTION_MAP];
  }
  return 'INTERNAL_ERROR';
}

// ==================== DEFAULT CONFIGURATIONS ====================

/** Стандартные конфигурации для разных уровней санитизации */
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

/** Рекурсивно санитизирует объект ошибки для чувствительных данных */
function sanitizeErrorObject(
  obj: Record<string, unknown>,
  config: SanitizationConfig,
  path: string,
): { sanitized: Record<string, unknown>; removedFields: string[]; } {
  const result = Object.entries(obj).reduce(
    (acc, [key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;

      if (isSensitiveField(key, config.customSensitiveFields)) {
        if (config.level === 'strict') {
          // Skip sensitive field in strict mode
          return {
            sanitized: acc.sanitized,
            removedFields: [...acc.removedFields, currentPath],
          };
        } else {
          // Mask sensitive field
          return {
            sanitized: { ...acc.sanitized, [key]: '[REDACTED]' as const },
            removedFields: [...acc.removedFields, currentPath],
          };
        }
      }

      if (
        value !== null
        && value !== undefined
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        // Рекурсивно санитизируем вложенные объекты
        const nestedResult = sanitizeErrorObject(
          value as Record<string, unknown>,
          config,
          currentPath,
        );
        return {
          sanitized: { ...acc.sanitized, [key]: nestedResult.sanitized },
          removedFields: [...acc.removedFields, ...nestedResult.removedFields],
        };
      } else if (Array.isArray(value)) {
        // Обрабатываем массивы
        const arrayResult = value.reduce(
          (
            arrayAcc: { sanitizedArray: unknown[]; removedFields: string[]; },
            item: unknown,
            index: number,
          ) => {
            if (
              item !== null
              && item !== undefined
              && typeof item === 'object'
              && !Array.isArray(item)
            ) {
              const itemResult = sanitizeErrorObject(
                item as Record<string, unknown>,
                config,
                `${currentPath}[${index}]`,
              );
              return {
                sanitizedArray: [...arrayAcc.sanitizedArray, itemResult.sanitized],
                removedFields: [...arrayAcc.removedFields, ...itemResult.removedFields],
              };
            } else {
              return {
                sanitizedArray: [...arrayAcc.sanitizedArray, item],
                removedFields: arrayAcc.removedFields,
              };
            }
          },
          { sanitizedArray: [] as unknown[], removedFields: [] as string[] },
        );

        return {
          sanitized: { ...acc.sanitized, [key]: arrayResult.sanitizedArray },
          removedFields: [...acc.removedFields, ...arrayResult.removedFields],
        };
      } else {
        // Копируем обычные значения
        return {
          sanitized: { ...acc.sanitized, [key]: value },
          removedFields: acc.removedFields,
        };
      }
    },
    {
      sanitized: {} as Record<string, unknown>,
      removedFields: [] as string[],
    },
  );

  return result;
}

/** Санитизирует объект ошибки для предотвращения утечки информации, удаляет чувствительные данные, стек-трейсы, внутренние пути в зависимости от конфигурации */
export function sanitizeError(
  error: unknown,
  config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIGS.production,
): SanitizationResult<unknown> {
  if (error === null || error === undefined || typeof error !== 'object') {
    return { sanitized: error, removedFields: [], sanitizationLevel: config.level };
  }

  // Здесь ошибка гарантированно является объектом и не null
  const errorObj = error as Record<string, unknown>;

  let sanitized = { ...errorObj };
  let removedFields: readonly string[] = [];

  // Санитизируем стек-трейс
  if (config.removeStackTraces && 'stack' in sanitized) {
    const { stack, ...rest } = sanitized;
    void stack; // Явно игнорируем значение stack
    sanitized = { ...rest };
    removedFields = [...removedFields, 'stack'];
  }

  // Санитизируем сообщение ошибки при необходимости
  if (config.level === 'strict' && 'message' in sanitized) {
    sanitized = { ...sanitized, message: 'An error occurred' as const };
    removedFields = [...removedFields, 'message'];
  }

  // Абстрагируем код ошибки
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

  // Рекурсивно санитизируем чувствительные данные во вложенных объектах
  if (config.removeSensitiveContext) {
    const nestedResult = sanitizeErrorObject(sanitized, config, '');
    sanitized = nestedResult.sanitized;
    removedFields = [...removedFields, ...nestedResult.removedFields];
  }

  return { sanitized, removedFields, sanitizationLevel: config.level };
}

// ==================== SANITIZE STACK TRACE ====================

/** Санитизирует стек-трейс для фильтрации внутренних путей, удаляет или маскирует внутренние пути к файлам и номера строк в production */
export function sanitizeStackTrace(
  stackTrace: string | undefined,
  config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIGS.production,
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

  // Для strict режима полностью удаляем стек-трейс
  if (config.level === 'strict') {
    return undefined;
  }

  return sanitized;
}

// ==================== SANITIZE CONTEXT ====================

/** Санитизирует контекст для очистки чувствительных полей контекста, удаляет или маскирует чувствительные данные в контексте ошибки */
export function sanitizeContext(
  context: ErrorMetadataContext | undefined,
  config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIGS.production,
): ErrorMetadataContext | undefined {
  if (!context || !config.removeSensitiveContext) {
    return context;
  }

  // Санитизируем доменный контекст, если он существует
  const sanitizedDomainContext = context.context
    ? sanitizeDomainContext(context.context, config)
    : undefined;

  return sanitizedDomainContext
    ? { ...context, context: sanitizedDomainContext as unknown as ErrorMetadataDomainContext }
    : context;
}

/** Санитизирует доменный контекст */
function sanitizeDomainContext(
  domainContext: ErrorMetadataDomainContext,
  config: SanitizationConfig,
): Record<string, unknown> {
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
        value !== null
        && value !== undefined
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        // Рекурсивная очистка вложенных объектов
        return { ...acc, [key]: sanitizeNestedObject(value as Record<string, unknown>, config) };
      }

      // Копируем обычные поля
      return { ...acc, [key]: value };
    },
    {} as Record<string, unknown>,
  );

  return finalSanitized;
}

/** Рекурсивная очистка вложенных объектов */
function sanitizeNestedObject(
  obj: Record<string, unknown>,
  config: SanitizationConfig,
): Record<string, unknown> {
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      if (isSensitiveField(key, config.customSensitiveFields)) {
        return config.level === 'strict'
          ? acc // Пропускаем sensitive поля
          : { ...acc, [key]: '[REDACTED]' }; // Заменяем на [REDACTED]
      }

      if (
        value !== null
        && value !== undefined
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        // Рекурсивная очистка вложенных объектов
        return { ...acc, [key]: sanitizeNestedObject(value as Record<string, unknown>, config) };
      }

      if (Array.isArray(value)) {
        // Рекурсивная обработка массивов
        return {
          ...acc,
          [key]: value.map((item) => {
            if (
              item !== null
              && item !== undefined
              && typeof item === 'object'
              && !Array.isArray(item)
            ) {
              return sanitizeNestedObject(item as Record<string, unknown>, config);
            }
            return item as unknown;
          }),
        };
      }

      // Копируем обычные поля
      return { ...acc, [key]: value };
    },
    {} as Record<string, unknown>,
  );
}

// ==================== CONVENIENCE FUNCTIONS ====================

/** Санитизирует ошибку с использованием предустановленного уровня и опциональных переопределений */
export function sanitizeErrorWithLevel(
  error: unknown,
  level: SanitizationLevel,
  overrides?: Partial<Omit<SanitizationConfig, 'level'>>,
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
