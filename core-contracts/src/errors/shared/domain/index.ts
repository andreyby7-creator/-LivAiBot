/**
 * @file index.ts - Экспорт всех доменных ошибок shared слоя
 *
 * Предоставляет единый entry point для всех доменных ошибок LivAiBot.
 * Общие ошибки валидации, аутентификации и авторизации.
 */

import type { AuthError } from './AuthError.js';
import type { PermissionError } from './PermissionError.js';
import type { ValidationError } from './ValidationError.js';

// ==================== VALIDATION ERRORS ====================

/**
 * Ошибки валидации данных. Используются для проверки входных данных,
 * бизнес-правил и консистентности данных.
 */
export type { ValidationError, ValidationErrorContext } from './ValidationError.js';

export {
  createValidationError,
  getValidationField,
  getValidationRule,
  isValidationError,
} from './ValidationError.js';

// ==================== AUTH ERRORS ====================

/**
 * Ошибки аутентификации и авторизации. Используются для контроля доступа,
 * проверки токенов, прав пользователей и политик безопасности.
 */
export type { AuthError, AuthErrorContext, AuthErrorReason } from './AuthError.js';

export {
  createAuthError,
  getAuthDeviceInfo,
  getAuthErrorReason,
  getAuthRequiredPermissions,
  getAuthUserId,
  getAuthUserPermissions,
  getGeoLocation,
  getRateLimitInfo,
  isAuthError,
  isInsufficientPermissions,
  isMFARequiredError,
  isRateLimitedError,
  isRateLimitError,
  isTokenRelatedError,
  requiresMFA,
} from './AuthError.js';

// ==================== PERMISSION ERRORS ====================

/**
 * Ошибки прав доступа. Детализированные ошибки для контроля разрешений,
 * ролей, политик доступа и контекстов безопасности.
 */
export type { PermissionError, PermissionErrorContext } from './PermissionError.js';

export {
  createPermissionError,
  getPermissionResource,
  getRequiredPermissions,
  getUserPermissions,
  hasMissingPermissions,
  isPermissionError,
} from './PermissionError.js';

// ==================== COMMON TYPES ====================

/**
 * Объединение всех доменных ошибок для type-safe pattern matching
 */
export type DomainError = ValidationError | AuthError | PermissionError;
