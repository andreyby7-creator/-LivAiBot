/**
 * @file packages/app/src/lib/auth-guard.ts
 * ============================================================================
 * 🛡️ AUTH GUARD — ЗАЩИТА ДОСТУПА К РЕСУРСАМ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Чистая проверка аутентификации и авторизации без side effects
 * - Синхронные, детерминированные решения о доступе
 * - Микросервисная изоляция авторизационной логики
 * - Композиционные guard'ы для сложных политик безопасности
 * - Полная совместимость с error-mapping.ts и типовой системой
 *
 * Свойства:
 * - Effect-free архитектура для предсказуемости и тестируемости
 * - Композиционные проверки ролей, разрешений и контекста
 * - Типобезопасные решения (allow/deny/error) с причинами
 * - Расширяемость для enterprise политик безопасности
 * - Полная трассировка через context для observability
 *
 * Принципы:
 * - Никаких I/O операций (файлы, сеть, БД)
 * - Никакой асинхронности и таймаутов
 * - Никаких побочных эффектов и мутаций
 * - Детерминированные результаты для одного входа
 * - Максимальная безопасность и консервативность (deny by default)
 *
 * Почему без эффектов:
 * - Guard ≠ логгер ≠ телеметрия (разделение ответственности)
 * - Синхронная проверка для низкой латентности
 * - Детерминизм для предсказуемого поведения
 * - Легкость тестирования без моков и стабов
 */

import React, { createContext, useContext } from 'react';

import type { TaggedError } from './error-mapping.js';
import type { AuthContext, ID } from '../types/common.js';
import { UserRoles } from '../types/common.js';

/* ============================================================================
 * 🧠 КОНТЕКСТ АВТОРИЗАЦИИ
 * ========================================================================== */

/**
 * Контекст авторизационного решения.
 * Расширяет базовый AuthContext дополнительными полями для принятия решений.
 * Включает requestId/traceId для полного distributed tracing.
 */
// Re-export ID type for convenience
export type { ID };

export type AuthGuardContext = AuthContext & {
  readonly requestId: string;
  readonly traceId?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly sessionId?: string;
  readonly userId?: ID;
  readonly roles?: ReadonlySet<UserRole>;
  readonly permissions?: ReadonlySet<Permission>;
};

/* ============================================================================
 * 🔑 РОЛИ И РАЗРЕШЕНИЯ
 * ========================================================================== */

/** Система ролей с иерархией для enterprise приложений */
export type UserRole = UserRoles;

/** Разрешения для детального контроля доступа */
export type Permission =
  | 'READ_PUBLIC'
  | 'READ_PRIVATE'
  | 'WRITE_PUBLIC'
  | 'WRITE_PRIVATE'
  | 'DELETE_PUBLIC'
  | 'DELETE_PRIVATE'
  | 'MODERATE_CONTENT'
  | 'MANAGE_USERS'
  | 'SYSTEM_ADMIN';

/** Типы ресурсов для проверки доступа */
export type ResourceType = 'public' | 'private';

/** Ресурс для проверки доступа */
export type Resource = {
  readonly type: ResourceType;
  readonly id?: ID;
  readonly ownerId?: ID;
};

/** Действие над ресурсом */
export type Action = 'READ' | 'WRITE' | 'DELETE' | 'MODERATE' | 'ADMIN';

/* ============================================================================
 * ❌ ОШИБКИ АВТОРИЗАЦИИ
 * ========================================================================== */

/**
 * Специфические коды ошибок авторизации.
 * Совместимы с error-mapping.ts для унифицированной обработки.
 */
export type AuthErrorCode =
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_EXPIRED_TOKEN'
  | 'AUTH_MISSING_TOKEN'
  | 'AUTH_INVALID_ROLE'
  | 'AUTH_INSUFFICIENT_PERMISSIONS'
  | 'AUTH_RESOURCE_ACCESS_DENIED'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_TOKEN_MALFORMED'
  | 'AUTH_USER_BLOCKED';

/**
 * Ошибка авторизации с типизированными метаданными.
 * Строго типизирована и совместима с error-mapping.ts.
 */
export type AuthError = TaggedError<AuthErrorCode> & {
  readonly field?: string | undefined;
  readonly resource?: Resource | undefined;
  readonly requiredRole?: UserRole | undefined;
  readonly requiredPermissions?: readonly Permission[] | undefined;
  readonly userRoles?: readonly UserRole[] | undefined;
  readonly userPermissions?: readonly Permission[] | undefined;
};

/* ============================================================================
 * ✅ РЕШЕНИЯ АВТОРИЗАЦИИ
 * ========================================================================== */

/** Helper для создания положительного решения */
const allow = (reason: AuthDecisionReason): AllowDecision => ({
  allow: true,
  reason,
});

/** Helper для создания отрицательного решения */
const deny = (
  reason: AuthDecisionReason,
  error?: AuthError | undefined,
): DenyDecision => ({
  allow: false,
  reason,
  ...(error && { error }),
});

/** Причины решений авторизации для observability */
export type AuthDecisionReason =
  | 'NOT_AUTHENTICATED'
  | 'NO_ROLES'
  | 'INVALID_ROLE'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'GUEST_RESTRICTED'
  | 'NOT_RESOURCE_OWNER'
  | 'RESOURCE_ACCESS_DENIED'
  | 'SUCCESS';

/**
 * Результат проверки авторизации.
 * Дискриминированный union для type-safe обработки решений.
 */
export type AuthDecision =
  | { readonly allow: true; readonly reason: AuthDecisionReason; }
  | { readonly allow: false; readonly reason: AuthDecisionReason; readonly error?: AuthError; };

/**
 * Позитивное решение о доступе.
 * Включает причину для аудита и отладки.
 */
export type AllowDecision = Extract<AuthDecision, { allow: true; }>;

/**
 * Негативное решение о доступе.
 * Включает причину и опциональную типизированную ошибку.
 */
export type DenyDecision = Extract<AuthDecision, { allow: false; }>;

/* ============================================================================
 * 🛡️ ОСНОВНЫЕ ФУНКЦИИ ЗАЩИТЫ
 * ========================================================================== */

/**
 * Проверяет авторизацию для конкретного действия над ресурсом.
 * Синхронная проверка ролей и разрешений без I/O.
 *
 * @param userRoles - роли пользователя
 * @param userPermissions - разрешения пользователя
 * @param action - действие над ресурсом
 * @param resource - целевой ресурс
 * @param context - контекст авторизации
 * @returns решение об авторизации
 */
export function checkAuthorization(
  userRoles: ReadonlySet<UserRole>,
  userPermissions: ReadonlySet<Permission>,
  action: Action,
  resource: Resource,
  context: AuthGuardContext,
): AuthDecision {
  // 1. Проверяем наличие хотя бы одной роли
  if (userRoles.size === 0) {
    return deny('NO_ROLES', createAuthError('AUTH_INVALID_ROLE'));
  }

  // 2. Проверяем блокировку пользователя
  if (userRoles.has(UserRoles.GUEST) && !isGuestActionAllowed(action, resource)) {
    return deny(
      'GUEST_RESTRICTED',
      createAuthError('AUTH_RESOURCE_ACCESS_DENIED', undefined, resource),
    );
  }

  // 3. Проверяем системные роли (максимальные привилегии)
  if (hasSystemAccess(userRoles)) {
    return allow('SUCCESS');
  }

  // 4. Проверяем административные права
  if (hasAdminAccess(userRoles) && isAdminAction(action)) {
    return allow('SUCCESS');
  }

  // 5. Проверяем модераторские права
  if (hasModeratorAccess(userRoles) && isModeratorAction(action)) {
    return allow('SUCCESS');
  }

  // 6. Проверяем пользовательские разрешения
  const requiredPermissions = getRequiredPermissions(action, resource);
  const hasRequiredPermissions = requiredPermissions.every((permission) =>
    userPermissions.has(permission)
  );

  if (!hasRequiredPermissions) {
    return deny(
      'INSUFFICIENT_PERMISSIONS',
      createAuthError(
        'AUTH_INSUFFICIENT_PERMISSIONS',
        undefined,
        resource,
        undefined,
        requiredPermissions,
        Array.from(userPermissions),
      ),
    );
  }

  // 7. Проверяем владение ресурсом для приватных операций
  if (isPrivateResourceAction(action, resource)) {
    const isOwner = resource.ownerId
      && context.isAuthenticated
      && context.userId
      && context.userId === resource.ownerId;

    if (isOwner === false && !hasElevatedAccess(userRoles)) {
      return deny(
        'NOT_RESOURCE_OWNER',
        createAuthError('AUTH_RESOURCE_ACCESS_DENIED', undefined, resource),
      );
    }
  }

  // IMPORTANT: политика deny-by-default — доступ разрешается только по явным allow-веткам выше
  return allow('SUCCESS');
}

/**
 * Комплексная проверка аутентификации и авторизации.
 * Комбинирует проверки ролей и разрешений из контекста.
 *
 * @param action - действие
 * @param resource - ресурс
 * @param context - контекст с аутентификацией и авторизацией
 * @returns финальное решение о доступе
 */
export function checkAccess(
  action: Action,
  resource: Resource,
  context: AuthGuardContext,
): AuthDecision {
  // 1. Проверяем аутентификацию через context
  if (!context.isAuthenticated) {
    return deny('NOT_AUTHENTICATED', createAuthError('AUTH_MISSING_TOKEN'));
  }

  // 2. Получаем роли и разрешения из context
  const userRoles = context.roles ?? new Set<UserRole>();
  const userPermissions = context.permissions ?? new Set<Permission>();

  // 3. Проверяем авторизацию
  return checkAuthorization(userRoles, userPermissions, action, resource, context);
}

/* ============================================================================
 * 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ВАЛИДАЦИИ
 * ========================================================================== */

/** Проверяет, разрешено ли действие для гостевого пользователя. */
function isGuestActionAllowed(action: Action, resource: Resource): boolean {
  // Гости могут только читать публичные ресурсы
  return action === 'READ' && resource.type === 'public';
}

/** Проверяет наличие системного доступа. */
function hasSystemAccess(roles: ReadonlySet<UserRole>): boolean {
  return roles.has(UserRoles.SYSTEM);
}

/** Проверяет наличие административного доступа. */
function hasAdminAccess(roles: ReadonlySet<UserRole>): boolean {
  return roles.has(UserRoles.ADMIN) || roles.has(UserRoles.SUPER_ADMIN) || hasSystemAccess(roles);
}

/** Проверяет наличие модераторского доступа. */
function hasModeratorAccess(roles: ReadonlySet<UserRole>): boolean {
  return roles.has(UserRoles.MODERATOR) || hasAdminAccess(roles);
}

/** Проверяет наличие повышенного доступа. */
function hasElevatedAccess(roles: ReadonlySet<UserRole>): boolean {
  return hasModeratorAccess(roles);
}

/** Определяет, является ли действие административным. */
function isAdminAction(action: Action): boolean {
  return action === 'ADMIN' || action === 'MODERATE';
}

/** Определяет, является ли действие модераторским. */
function isModeratorAction(action: Action): boolean {
  return action === 'MODERATE';
}

/** Возвращает требуемые разрешения для действия. */
function getRequiredPermissions(action: Action, resource: Resource): readonly Permission[] {
  const basePermissions: Record<Action, Permission[]> = {
    READ: resource.type === 'private' ? ['READ_PRIVATE'] : ['READ_PUBLIC'],
    WRITE: resource.type === 'private' ? ['WRITE_PRIVATE'] : ['WRITE_PUBLIC'],
    DELETE: resource.type === 'private' ? ['DELETE_PRIVATE'] : ['DELETE_PUBLIC'],
    MODERATE: ['MODERATE_CONTENT'],
    ADMIN: ['SYSTEM_ADMIN'],
  };

  return basePermissions[action];
}

/** Определяет, является ли действие приватным над ресурсом. */
function isPrivateResourceAction(action: Action, resource: Resource): boolean {
  return resource.type === 'private' && ['WRITE', 'DELETE'].includes(action);
}

/* ============================================================================
 * 🏗️ ФАБРИКИ ОШИБОК
 * ========================================================================== */

/**
 * Создает типизированную ошибку авторизации.
 * Совместима с error-mapping.ts для унифицированной обработки.
 */
function createAuthError(
  code: AuthErrorCode,
  field?: string | undefined,
  resource?: Resource | undefined,
  requiredRole?: UserRole | undefined,
  requiredPermissions?: readonly Permission[] | undefined,
  userPermissions?: readonly Permission[] | undefined,
): AuthError {
  const error: AuthError = {
    code,
    service: 'AUTH',
    field,
    resource,
    requiredRole,
    requiredPermissions,
    userPermissions,
  };

  return error;
}

/* ============================================================================
 * 🔄 КОМПОЗИЦИОННЫЕ GUARD'Ы
 * ========================================================================== */

/**
 * Комбинирует несколько guard'ов через AND логику.
 * Все guard'ы должны вернуть allow для успешного результата.
 */
export function combineGuards(
  ...guards: ((context: AuthGuardContext) => AuthDecision)[]
): (context: AuthGuardContext) => AuthDecision {
  return (context: AuthGuardContext): AuthDecision => {
    for (const guard of guards) {
      const decision = guard(context);
      if (!decision.allow) {
        return decision;
      }
    }

    return {
      allow: true,
      reason: 'SUCCESS',
    };
  };
}

/**
 * Комбинирует несколько guard'ов через OR логику.
 * Хотя бы один guard должен вернуть allow для успешного результата.
 */
export function eitherGuard(
  ...guards: ((context: AuthGuardContext) => AuthDecision)[]
): (context: AuthGuardContext) => AuthDecision {
  return (context: AuthGuardContext): AuthDecision => {
    let errors: AuthError[] = [];

    for (const guard of guards) {
      const decision = guard(context);
      if (decision.allow) {
        return decision;
      }

      // Проверяем, есть ли ошибка в deny решении
      if ('error' in decision) {
        errors = [...errors, decision.error];
      }
    }

    // Возвращаем первую причину отказа из массива ошибок
    return deny(
      'RESOURCE_ACCESS_DENIED',
      errors[0] ?? createAuthError('AUTH_RESOURCE_ACCESS_DENIED'),
    );
  };
}

/** Создает guard для проверки конкретной роли. */
export function requireRole(requiredRole: UserRole): (context: AuthGuardContext) => AuthDecision {
  return (context: AuthGuardContext): AuthDecision => {
    if (!context.isAuthenticated) {
      return deny('NOT_AUTHENTICATED', createAuthError('AUTH_MISSING_TOKEN'));
    }

    const userRoles = context.roles ?? new Set<UserRole>();

    if (!userRoles.has(requiredRole)) {
      return deny(
        'INVALID_ROLE',
        createAuthError('AUTH_INVALID_ROLE', undefined, undefined, requiredRole),
      );
    }

    return allow('SUCCESS');
  };
}

/** Создает guard для проверки конкретного разрешения. */
export function requirePermission(
  requiredPermission: Permission,
): (context: AuthGuardContext) => AuthDecision {
  return (context: AuthGuardContext): AuthDecision => {
    if (!context.isAuthenticated) {
      return deny('NOT_AUTHENTICATED', createAuthError('AUTH_MISSING_TOKEN'));
    }

    const userPermissions = context.permissions ?? new Set<Permission>();

    if (!userPermissions.has(requiredPermission)) {
      return deny(
        'INSUFFICIENT_PERMISSIONS',
        createAuthError(
          'AUTH_INSUFFICIENT_PERMISSIONS',
          undefined,
          undefined,
          undefined,
          [requiredPermission],
          Array.from(userPermissions),
        ),
      );
    }

    return allow('SUCCESS');
  };
}

/* ============================================================================
 * 🎣 REACT HOOKS ДЛЯ ИСПОЛЬЗОВАНИЯ В UI
 * ========================================================================== */

/**
 * React Context для AuthGuardContext.
 * Используется для предоставления контекста авторизации компонентам.
 */
export const AuthGuardReactContext = createContext<AuthGuardContext | null>(null);

/**
 * React Hook для получения контекста авторизации.
 * Возвращает AuthGuardContext или выбрасывает ошибку если контекст не найден.
 *
 * @returns контекст авторизации
 * @throws Error если AuthGuardReactContext не предоставлен
 */
/**
 * React Provider для AuthGuardContext.
 * Предоставляет контекст авторизации дочерним компонентам.
 */
export const AuthGuardProvider: React.FC<{
  children: React.ReactNode;
  value: AuthGuardContext;
}> = ({ children, value }) => {
  return React.createElement(AuthGuardReactContext.Provider, { value }, children);
};

export function useAuthGuardContext(): AuthGuardContext {
  const context = useContext(AuthGuardReactContext);
  if (context === null) {
    throw new Error('useAuthGuardContext must be used within an AuthGuardProvider');
  }
  return context;
}
