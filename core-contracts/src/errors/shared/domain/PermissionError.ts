/**
 * @file PermissionError.ts - Ошибки прав доступа LivAiBot
 *
 * TaggedError типы для ошибок прав доступа и разрешений.
 * Использует BaseError + ErrorBuilders для type-safe создания ошибок.
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';
import type { ErrorMetadataDomainContext } from '../../base/ErrorMetadata.js';

/**
 * Контекст ошибки прав доступа с дополнительными полями
 */
export type PermissionErrorContext = ErrorMetadataDomainContext & {
  /** ID пользователя */
  readonly userId?: string;
  /** Роль пользователя */
  readonly userRole?: string;
  /** Требуемые права доступа */
  readonly requiredPermissions?: readonly string[];
  /** Имеющиеся права доступа */
  readonly userPermissions?: readonly string[];
  /** Ресурс, к которому был запрошен доступ */
  readonly resource?: string;
  /** Тип ресурса (user, bot, subscription, etc.) */
  readonly resourceType?: string;
  /** ID ресурса */
  readonly resourceId?: string;
  /** Действие, которое пытались выполнить */
  readonly action?: string;
  /** Контекст доступа (owner, admin, member, etc.) */
  readonly accessContext?: string;
  /** Политика доступа, которая была нарушена */
  readonly policy?: string;
  /** Дополнительные условия доступа */
  readonly conditions?: Record<string, unknown>;
};

/**
 * TaggedError тип для ошибок прав доступа
 */
export type PermissionError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.SECURITY;
    readonly origin: typeof ERROR_ORIGIN.DOMAIN;
    readonly severity: typeof ERROR_SEVERITY.HIGH;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: PermissionErrorContext;
    readonly timestamp: string;
  },
  'PermissionError'
>;

/**
 * Создает PermissionError с автоматической генерацией метаданных
 * @param code - код ошибки из LivAi error codes
 * @param message - человекочитаемое сообщение
 * @param context - контекст ошибки прав доступа
 * @param timestamp - опциональный timestamp для тестов
 * @returns PermissionError
 */
export function createPermissionError(
  code: ErrorCode,
  message: string,
  context?: PermissionErrorContext,
  timestamp?: string,
): PermissionError {
  return {
    _tag: 'PermissionError',
    category: ERROR_CATEGORY.SECURITY,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: ERROR_SEVERITY.HIGH,
    code,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as PermissionError;
}

/**
 * Проверяет, является ли объект допустимым PermissionErrorContext
 * @param context - объект для проверки
 * @returns true если соответствует PermissionErrorContext
 */
export function isValidPermissionErrorContext(
  context: unknown,
): context is PermissionErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем базовые поля ErrorMetadataDomainContext
  if (typeof ctx['type'] !== 'string') return false;

  // Проверяем опциональные поля PermissionErrorContext
  if (ctx['userId'] !== undefined && typeof ctx['userId'] !== 'string') {
    return false;
  }
  if (ctx['userRole'] !== undefined && typeof ctx['userRole'] !== 'string') {
    return false;
  }
  if (
    ctx['requiredPermissions'] !== undefined
    && (!Array.isArray(ctx['requiredPermissions'])
      || !ctx['requiredPermissions'].every((p) => typeof p === 'string'))
  ) {
    return false;
  }
  if (
    ctx['userPermissions'] !== undefined
    && (!Array.isArray(ctx['userPermissions'])
      || !ctx['userPermissions'].every((p) => typeof p === 'string'))
  ) {
    return false;
  }
  if (ctx['resource'] !== undefined && typeof ctx['resource'] !== 'string') {
    return false;
  }
  if (
    ctx['resourceType'] !== undefined
    && typeof ctx['resourceType'] !== 'string'
  ) {
    return false;
  }
  if (ctx['resourceId'] !== undefined && typeof ctx['resourceId'] !== 'string') {
    return false;
  }
  if (ctx['action'] !== undefined && typeof ctx['action'] !== 'string') {
    return false;
  }
  if (
    ctx['accessContext'] !== undefined
    && typeof ctx['accessContext'] !== 'string'
  ) {
    return false;
  }
  if (ctx['policy'] !== undefined && typeof ctx['policy'] !== 'string') {
    return false;
  }
  if (
    ctx['conditions'] !== undefined
    && (typeof ctx['conditions'] !== 'object' || ctx['conditions'] === null)
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard для проверки, является ли ошибка PermissionError
 * @param error - ошибка для проверки
 * @returns true если это PermissionError
 */
export function isPermissionError(error: unknown): error is PermissionError {
  const candidate = error as Record<string, unknown>;

  return (
    typeof error === 'object'
    && error !== null
    && candidate['_tag'] === 'PermissionError'
    && candidate['category'] === ERROR_CATEGORY.SECURITY
    && candidate['origin'] === ERROR_ORIGIN.DOMAIN
    && candidate['severity'] === ERROR_SEVERITY.HIGH
    && typeof candidate['code'] === 'string'
    && typeof candidate['message'] === 'string'
    && typeof candidate['timestamp'] === 'string'
    && (candidate['details'] === undefined
      || isValidPermissionErrorContext(candidate['details']))
  );
}

/**
 * Извлекает требуемые права доступа из PermissionError
 * @param error - PermissionError
 * @returns массив требуемых прав или undefined
 */
export function getRequiredPermissions(
  error: PermissionError,
): readonly string[] | undefined {
  return error.details?.requiredPermissions;
}

/**
 * Извлекает права пользователя из PermissionError
 * @param error - PermissionError
 * @returns массив прав пользователя или undefined
 */
export function getUserPermissions(
  error: PermissionError,
): readonly string[] | undefined {
  return error.details?.userPermissions;
}

/**
 * Проверяет, отсутствуют ли требуемые права у пользователя
 * @param error - PermissionError
 * @returns true если пользователь не имеет требуемых прав
 */
export function hasMissingPermissions(error: PermissionError): boolean {
  const required = error.details?.requiredPermissions;
  const user = error.details?.userPermissions;

  if (!required || !user) return false;

  return required.some((permission) => !user.includes(permission));
}

/**
 * Извлекает ресурс из PermissionError
 * @param error - PermissionError
 * @returns информация о ресурсе или undefined
 */
export function getPermissionResource(error: PermissionError):
  | {
    type?: string | undefined;
    id?: string | undefined;
    action?: string | undefined;
  }
  | undefined
{
  const details = error.details;
  if (!details) return undefined;

  return {
    type: details.resourceType,
    id: details.resourceId,
    action: details.action,
  };
}

/**
 * Проверяет, является ли ошибка отказом в доступе из-за отсутствия прав
 * @param error - PermissionError
 * @returns true если это ошибка отсутствия прав доступа
 */
export function isPermissionDeniedError(error: PermissionError): boolean {
  return hasMissingPermissions(error);
}

/**
 * Проверяет, является ли ошибка нарушением политики доступа
 * @param error - PermissionError
 * @returns true если это нарушение политики
 */
export function isPolicyViolationError(error: PermissionError): boolean {
  return error.details?.policy !== undefined;
}

/**
 * Проверяет, является ли ошибка проблемой доступа к ресурсу
 * @param error - PermissionError
 * @returns true если это проблема доступа к ресурсу
 */
export function isResourceAccessError(error: PermissionError): boolean {
  const details = error.details;
  return (
    details?.resource !== undefined
    || details?.resourceType !== undefined
    || details?.resourceId !== undefined
    || details?.action !== undefined
  );
}
