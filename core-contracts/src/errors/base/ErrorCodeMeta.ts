/**
 * @file ErrorCodeMeta.ts - Типы метаданных для кодов ошибок LivAiBot
 *
 * Содержит метаданные для error codes: description, severity, category.
 * Добавлены defaultSeverity и defaultOrigin для упрощения фабрик.
 * Без runtime зависимостей - только типы.
 */

// ==================== ИМПОРТЫ ====================

import type { ErrorCode } from "./ErrorCode.js";
import type { ErrorCategory, ErrorOrigin, ErrorSeverity } from "./ErrorConstants.js";

// ==================== ОСНОВНЫЕ ТИПЫ МЕТАДАННЫХ ====================

/**
 * Базовые метаданные для error code
 * Содержит основную информацию об ошибке
 */
export type ErrorCodeMetadata = {
  /** Код ошибки */
  readonly code: ErrorCode;

  /** Человеко-читаемое описание ошибки */
  readonly description: string;

  /** Уровень критичности ошибки */
  readonly severity: ErrorSeverity;

  /** Категория ошибки */
  readonly category: ErrorCategory;

  /** Источник возникновения ошибки */
  readonly origin: ErrorOrigin;
};

/**
 * Расширенные метаданные для error code
 * Включает дополнительную информацию для мониторинга и отладки
 */
export type ExtendedErrorCodeMetadata = ErrorCodeMetadata & {
  /** HTTP статус код (если применимо) */
  readonly httpStatus?: number;

  /** Внутренний код для логирования */
  readonly internalCode?: string;

  /** Признак того, что ошибка логируется */
  readonly loggable: boolean;

  /** Признак того, что ошибка отправляется пользователю */
  readonly userVisible: boolean;

  /** Рекомендации по исправлению */
  readonly remediation?: string;

  /** Ссылки на документацию */
  readonly docsUrl?: string;
};

/**
 * Метаданные для группировки error codes
 * Используется для категоризации и фильтрации ошибок
 */
export type ErrorCodeGroupMetadata = {
  /** Название группы */
  readonly name: string;

  /** Описание группы */
  readonly description: string;

  /** Префикс кодов в группе */
  readonly prefix: string;

  /** Минимальный код в группе */
  readonly minCode: number;

  /** Максимальный код в группе */
  readonly maxCode: number;

  /** Категория группы */
  readonly category: ErrorCategory;

  /** Уровень критичности по умолчанию */
  readonly defaultSeverity: ErrorSeverity;

  /** Источник по умолчанию */
  readonly defaultOrigin: ErrorOrigin;
};

// ==================== DEFAULT ЗНАЧЕНИЯ ====================

/**
 * Default severity для разных категорий ошибок
 * Упрощает создание фабрик и обеспечивает консистентность
 */
export const DEFAULT_SEVERITY_BY_CATEGORY: Record<ErrorCategory, ErrorSeverity> = {
  BUSINESS: "WARNING" as const,
  TECHNICAL: "ERROR" as const,
  SECURITY: "CRITICAL" as const,
  PERFORMANCE: "WARNING" as const,
} as const;

/**
 * Default origin для разных категорий ошибок
 * Определяет наиболее вероятный источник ошибки по категории
 */
export const DEFAULT_ORIGIN_BY_CATEGORY: Record<ErrorCategory, ErrorOrigin> = {
  BUSINESS: "DOMAIN" as const,
  TECHNICAL: "INFRASTRUCTURE" as const,
  SECURITY: "DOMAIN" as const,
  PERFORMANCE: "INFRASTRUCTURE" as const,
} as const;

/**
 * Default metadata для быстрого создания error code metadata
 * Содержит наиболее распространенные значения
 */
export const DEFAULT_ERROR_CODE_METADATA: Omit<ExtendedErrorCodeMetadata, "code" | "description"> = {
  severity: "ERROR" as const,
  category: "TECHNICAL" as const,
  origin: "INFRASTRUCTURE" as const,
  loggable: true,
  userVisible: false,
} as const;

// ==================== UTILITY ТИПЫ ====================

/**
 * Тип для маппинга error codes на их метаданные
 */
export type ErrorCodeMetadataMap = Record<ErrorCode, ErrorCodeMetadata>;

/**
 * Тип для маппинга error codes на расширенные метаданные
 */
export type ExtendedErrorCodeMetadataMap = Record<ErrorCode, ExtendedErrorCodeMetadata>;

/**
 * Тип для коллекции метаданных групп
 */
export type ErrorCodeGroupMetadataCollection = Record<string, ErrorCodeGroupMetadata>;

// ==================== HELPER ТИПЫ ====================

/**
 * Создает тип метаданных с обязательными полями
 */
export type RequiredErrorCodeMetadata = Required<ErrorCodeMetadata>;

/**
 * Создает тип метаданных с опциональными дополнительными полями
 */
export type PartialExtendedErrorCodeMetadata = Partial<ExtendedErrorCodeMetadata>;

/**
 * Утилитный тип для создания фабрик метаданных
 */
export type ErrorCodeMetadataFactory<T extends ErrorCodeMetadata = ErrorCodeMetadata> = (
  code: ErrorCode,
  overrides?: Partial<T>,
) => T;

// ==================== VALIDATION ТИПЫ ====================

/**
 * Результат валидации метаданных error code
 */
export type ErrorCodeMetadataValidationResult = {
  /** Код ошибки */
  readonly code: ErrorCode;

  /** Признак валидности */
  readonly isValid: boolean;

  /** Список ошибок валидации */
  readonly errors: readonly string[];

  /** Предупреждения валидации */
  readonly warnings: readonly string[];
};

/**
 * Тип для функций валидации метаданных
 */
export type ErrorCodeMetadataValidator = (
  metadata: ErrorCodeMetadata,
) => ErrorCodeMetadataValidationResult;

// ==================== CONSTANTS ====================

/**
 * Максимальная длина описания ошибки
 */
export const MAX_ERROR_DESCRIPTION_LENGTH = 500;

/**
 * Максимальная длина remediation текста
 */
export const MAX_REMEDIATION_LENGTH = 1000;

/**
 * Поддерживаемые HTTP статус коды для ошибок
 */
export const SUPPORTED_HTTP_STATUSES = [
  400,
  401,
  402,
  403,
  404,
  405,
  406,
  407,
  408,
  409,
  410,
  411,
  412,
  413,
  414,
  415,
  416,
  417,
  418,
  422,
  423,
  424,
  425,
  426,
  428,
  429,
  431,
  451,
  500,
  501,
  502,
  503,
  504,
  505,
  506,
  507,
  508,
  510,
  511,
] as const;

/**
 * Тип для поддерживаемых HTTP статусов
 */
export type SupportedHttpStatus = typeof SUPPORTED_HTTP_STATUSES[number];
