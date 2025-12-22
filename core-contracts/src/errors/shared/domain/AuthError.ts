/**
 * @file AuthError.ts - Ошибки аутентификации и авторизации LivAiBot
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../base/ErrorConstants.js';

import type { TaggedError } from '../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../base/ErrorCode.js';
import type { ErrorMetadataDomainContext } from '../../base/ErrorMetadata.js';

/** Строгие причины ошибок аутентификации */
export type AuthErrorReason =
  | 'invalid_credentials'
  | 'token_expired'
  | 'token_invalid'
  | 'token_missing'
  | 'insufficient_permissions'
  | 'account_locked'
  | 'account_disabled'
  | 'account_not_verified'
  | 'rate_limit_exceeded'
  | 'invalid_session'
  | 'concurrent_login'
  | 'geographic_restriction';

/** Контекст ошибки аутентификации с расширенными полями */
export type AuthErrorContext = ErrorMetadataDomainContext & {
  /** ID пользователя */
  readonly userId?: string;
  /** Тип аутентификации */
  readonly authType?:
    | 'password'
    | 'token'
    | 'oauth'
    | 'sso'
    | 'api_key'
    | 'certificate';
  /** Причина ошибки */
  readonly reason?: AuthErrorReason;
  /** MFA статус */
  readonly mfaRequired?: boolean;
  readonly mfaVerified?: boolean;
  /** Геолокация */
  readonly geoLocation?: {
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
  };
  /** Информация об устройстве */
  readonly deviceInfo?: {
    readonly fingerprint?: string;
    readonly platform?: string;
    readonly browser?: string;
  };
  /** Rate limiting информация */
  readonly rateLimitInfo?: {
    readonly attempts: number;
    readonly limit: number;
    readonly resetTime: number;
  };
  /** Требуемые права */
  readonly requiredPermissions?: readonly string[];
  /** Права пользователя */
  readonly userPermissions?: readonly string[];
  /** Ресурс */
  readonly resource?: string;
  /** Действие */
  readonly action?: string;
  /** IP адрес */
  readonly ipAddress?: string;
  /** User agent */
  readonly userAgent?: string;
};

/**
 * TaggedError тип для ошибок аутентификации и авторизации
 */
export type AuthError = TaggedError<
  {
    readonly category: typeof ERROR_CATEGORY.SECURITY;
    readonly origin: typeof ERROR_ORIGIN.DOMAIN;
    readonly severity: typeof ERROR_SEVERITY.HIGH;
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: AuthErrorContext;
    readonly timestamp: string;
  },
  'AuthError'
>;

/**
 * Создает AuthError с автоматической генерацией метаданных
 * @param code - код ошибки из LivAi error codes
 * @param message - человекочитаемое сообщение
 * @param context - контекст ошибки аутентификации
 * @param timestamp - опциональный timestamp для тестов
 * @returns AuthError
 */
export function createAuthError(
  code: ErrorCode,
  message: string,
  context?: AuthErrorContext,
  timestamp?: string,
): AuthError {
  return {
    _tag: 'AuthError',
    category: ERROR_CATEGORY.SECURITY,
    origin: ERROR_ORIGIN.DOMAIN,
    severity: ERROR_SEVERITY.HIGH,
    code,
    message,
    details: context,
    timestamp: timestamp ?? new Date().toISOString(),
  } as AuthError;
}

/**
 * Проверяет, является ли объект допустимым AuthErrorContext
 * @param context - объект для проверки
 * @returns true если соответствует AuthErrorContext
 */
function isValidAuthErrorContext(
  context: unknown,
): context is AuthErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Проверяем базовые поля ErrorMetadataDomainContext
  if (typeof ctx['type'] !== 'string') return false;

  // Проверяем опциональные поля AuthErrorContext
  if (ctx['userId'] !== undefined && typeof ctx['userId'] !== 'string') {
    return false;
  }

  // Строгая проверка authType на допустимые значения
  if (ctx['authType'] !== undefined) {
    const validAuthTypes = [
      'password',
      'token',
      'oauth',
      'sso',
      'api_key',
      'certificate',
    ];
    if (
      typeof ctx['authType'] !== 'string'
      || !validAuthTypes.includes(ctx['authType'])
    ) {
      return false;
    }
  }

  if (ctx['reason'] !== undefined && typeof ctx['reason'] !== 'string') {
    return false;
  }
  if (
    ctx['mfaRequired'] !== undefined
    && typeof ctx['mfaRequired'] !== 'boolean'
  ) {
    return false;
  }
  if (
    ctx['mfaVerified'] !== undefined
    && typeof ctx['mfaVerified'] !== 'boolean'
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard для проверки, является ли ошибка AuthError
 * @param error - ошибка для проверки
 * @returns true если это AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  const candidate = error as Record<string, unknown>;

  return (
    typeof error === 'object'
    && error !== null
    && candidate['_tag'] === 'AuthError'
    && candidate['category'] === ERROR_CATEGORY.SECURITY
    && candidate['origin'] === ERROR_ORIGIN.DOMAIN
    && candidate['severity'] === ERROR_SEVERITY.HIGH
    && typeof candidate['code'] === 'string'
    && typeof candidate['message'] === 'string'
    && typeof candidate['timestamp'] === 'string'
    && (candidate['details'] === undefined
      || isValidAuthErrorContext(candidate['details']))
  );
}

/**
 * Проверяет, связана ли ошибка с токенами
 * @param error - AuthError
 * @returns true если ошибка токена
 */
export function isTokenRelatedError(error: AuthError): boolean {
  return (
    error.details?.reason === 'token_expired'
    || error.details?.reason === 'token_invalid'
    || error.details?.reason === 'token_missing'
  );
}

/**
 * Проверяет, связана ли ошибка с rate limiting
 * @param error - AuthError
 * @returns true если rate limit ошибка
 */
export function isRateLimitError(error: AuthError): boolean {
  return error.details?.reason === 'rate_limit_exceeded';
}

/**
 * Получает геолокацию из ошибки
 * @param error - AuthError
 * @returns геолокация или undefined
 */
export function getGeoLocation(
  error: AuthError,
): AuthErrorContext['geoLocation'] {
  return error.details?.geoLocation;
}

/**
 * Проверяет, требуется ли MFA
 * @param error - AuthError
 * @returns true если MFA требуется
 */
export function requiresMFA(error: AuthError): boolean {
  return error.details?.mfaRequired === true;
}

/**
 * Проверяет, связана ли ошибка с требованием MFA
 * @param error - AuthError
 * @returns true если ошибка требует MFA
 */
export function isMFARequiredError(error: AuthError): boolean {
  return error.details?.mfaRequired === true;
}

/**
 * Проверяет, связана ли ошибка с rate limiting
 * @param error - AuthError
 * @returns true если ошибка rate limiting
 */
export function isRateLimitedError(error: AuthError): boolean {
  return error.details?.reason === 'rate_limit_exceeded';
}

/**
 * Извлекает требуемые права доступа из AuthError
 * @param error - AuthError
 * @returns массив требуемых прав или undefined
 */
export function getAuthRequiredPermissions(
  error: AuthError,
): readonly string[] | undefined {
  return error.details?.requiredPermissions;
}

/**
 * Извлекает права пользователя из AuthError
 * @param error - AuthError
 * @returns массив прав пользователя или undefined
 */
export function getAuthUserPermissions(
  error: AuthError,
): readonly string[] | undefined {
  return error.details?.userPermissions;
}

/**
 * Извлекает информацию об устройстве из AuthError
 * @param error - AuthError
 * @returns информация об устройстве или undefined
 */
export function getAuthDeviceInfo(
  error: AuthError,
): AuthErrorContext['deviceInfo'] {
  return error.details?.deviceInfo;
}

/**
 * Извлекает информацию о rate limiting из AuthError
 * @param error - AuthError
 * @returns информация о rate limiting или undefined
 */
export function getRateLimitInfo(
  error: AuthError,
): AuthErrorContext['rateLimitInfo'] {
  return error.details?.rateLimitInfo;
}

/**
 * Извлекает причину ошибки аутентификации из AuthError
 * @param error - AuthError
 * @returns причина ошибки или undefined
 */
export function getAuthErrorReason(error: AuthError): string | undefined {
  return error.details?.reason;
}

/**
 * Извлекает ID пользователя из AuthError
 * @param error - AuthError
 * @returns ID пользователя или undefined
 */
export function getAuthUserId(error: AuthError): string | undefined {
  return error.details?.userId;
}

/**
 * Проверяет, имеет ли пользователь достаточные права доступа
 * @param error - AuthError
 * @returns true если проблема в правах доступа
 */
export function isInsufficientPermissions(error: AuthError): boolean {
  return error.details?.reason === 'insufficient_permissions';
}
