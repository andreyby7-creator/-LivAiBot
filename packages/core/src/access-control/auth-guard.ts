/**
 * @file @livai/core/access-control/auth-guard
 * ============================================================================
 * 🛡️ AUTH GUARD CORE — ЧИСТОЕ ЯДРО АВТОРИЗАЦИИ
 * ============================================================================
 *
 * Архитектурная роль:
 * - Чистое RBAC/ABAC ядро авторизации без React, transport и UI-специфики
 * - Опирается на типизированные роли (GlobalUserRole / ResourceRole / SystemRole) и permissions
 * - Выступает фундаментом для policy engine, route-permissions и UI-guard'ов
 *
 * Свойства и принципы:
 * - Effect-free архитектура (нет I/O, нет async, нет глобального состояния)
 * - Иммутабельные контракты, functional-подход и детерминированные pure-функции
 * - Полная изоляция от runtime-зависимостей (SSR-safe, multi-runtime)
 * - Разделение ответственности: core access-control ≠ React bindings ≠ transport
 * - Легко тестируется и переиспользуется в разных runtime (web, mobile, server)
 */

import type { TaggedError } from '@livai/core/effect';
import type { AnyRole, ID, ResourceRole } from '@livai/core-contracts';
import { GlobalUserRole, SystemRole } from '@livai/core-contracts';

/* ============================================================================
 * 🔑 РОЛИ, РЕСУРСЫ И ДЕЙСТВИЯ
 * ========================================================================== */

/**
 * Разрешения для детального контроля доступа.
 * Не привязаны к конкретному домену, используются как building blocks.
 */
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

/** Типы ресурсов для проверки доступа. */
export type ResourceType = 'public' | 'private';

/**
 * Описание ресурса, к которому проверяется доступ.
 * Используется как минимальный контракт между policy-слоем и доменами.
 */
export interface Resource {
  readonly type: ResourceType;
  readonly id?: ID;
  readonly ownerId?: ID;
}

/** Действие над ресурсом. */
export type Action = 'READ' | 'WRITE' | 'DELETE' | 'MODERATE' | 'ADMIN';

/* ============================================================================
 * ❌ ОШИБКИ АВТОРИЗАЦИИ
 * ========================================================================== */

/** Коды ошибок авторизации, маппятся в error-mapping.ts и транспорт. */
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
 * Ошибка авторизации с типизированным payload'ом.
 * Расширяет TaggedError домен-специфичными полями.
 */
export interface AuthError extends TaggedError<AuthErrorCode> {
  readonly field?: string | undefined;
  readonly resource?: Resource | undefined;
  readonly requiredRole?: AnyRole | undefined;
  readonly requiredPermissions?: readonly Permission[] | undefined;
  readonly userRoles?: readonly AnyRole[] | undefined;
  readonly userPermissions?: readonly Permission[] | undefined;
}

/* ============================================================================
 * ✅ РЕШЕНИЯ АВТОРИЗАЦИИ
 * ========================================================================== */

/** Причины решений авторизации для observability и policy-debugging. */
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
 * Дискриминированный union allow/deny для безопасного pattern matching.
 */
export type AuthDecision =
  | { readonly allow: true; readonly reason: AuthDecisionReason; }
  | { readonly allow: false; readonly reason: AuthDecisionReason; readonly error?: AuthError; };

export type AllowDecision = Extract<AuthDecision, { allow: true; }>;
export type DenyDecision = Extract<AuthDecision, { allow: false; }>;

/** Успешное решение с типизированной причиной. */
const allow = (reason: AuthDecisionReason): AllowDecision => ({
  allow: true,
  reason,
});

/** Отказ с типизированной причиной и опциональной AuthError. */
const deny = (reason: AuthDecisionReason, error?: AuthError): DenyDecision => ({
  allow: false,
  reason,
  ...(error && { error }),
});

/* ============================================================================
 * 🧠 КОНТЕКСТ АВТОРИЗАЦИИ (ЯДРО)
 * ========================================================================== */

/**
 * Минимальный контекст для ядра авторизации.
 * Не содержит React-зависимостей и UI-специфичных полей (accessToken и т.п.).
 * Может быть собран как на backend, так и во frontend.
 */
export interface AuthGuardContextCore {
  /** Аутентифицирован ли актор. */
  readonly isAuthenticated: boolean;

  /** Идентификатор пользователя (если применимо). */
  readonly userId?: ID;

  /**
   * Набор ролей актора (глобальные и системные).
   * Используются для проверки admin/system доступа.
   */
  readonly roles?: ReadonlySet<AnyRole>;

  /**
   * Набор ролей внутри ресурса (workspace/chat/bot и т.п.).
   * Используются для resource-level политик (OWNER/ADMIN/EDITOR/...) на доменном уровне.
   * Ядро пока не применяет их напрямую (membership‑roles обрабатываются в доменах/route‑policies).
   */
  readonly resourceRoles?: ReadonlySet<ResourceRole>;

  /** Набор разрешений актора (RBAC/ABAC). */
  readonly permissions?: ReadonlySet<Permission>;
}

const EMPTY_ROLE_SET: ReadonlySet<AnyRole> = new Set<AnyRole>();
const EMPTY_PERMISSION_SET: ReadonlySet<Permission> = new Set<Permission>();

type ShortcutDecision = AuthDecision | undefined;

/**
 * Обрабатывает "быстрые" ветки по ролям (guest, system, admin, moderator).
 * Возвращает решение, если его можно принять только на основе ролей,
 * или undefined, если нужно продолжать детальную проверку permissions/ownership.
 */
function evaluateRoleShortcuts(
  roles: ReadonlySet<AnyRole>,
  action: Action,
  resource: Resource,
): ShortcutDecision {
  if (roles.size === 0) {
    return deny('NO_ROLES', createAuthError('AUTH_INVALID_ROLE', undefined, resource));
  }

  if (roles.has(GlobalUserRole.GUEST) && !isGuestActionAllowed(action, resource)) {
    return deny(
      'GUEST_RESTRICTED',
      createAuthError('AUTH_RESOURCE_ACCESS_DENIED', undefined, resource),
    );
  }

  if (hasSystemAccess(roles)) {
    return allow('SUCCESS');
  }

  if (hasAdminAccess(roles) && isAdminAction(action)) {
    return allow('SUCCESS');
  }

  if (hasModeratorAccess(roles) && isModeratorAction(action)) {
    return allow('SUCCESS');
  }

  return undefined;
}

/* ============================================================================
 * 🛡️ ОСНОВНЫЕ ФУНКЦИИ ЗАЩИТЫ
 * ========================================================================== */

/**
 * Низкоуровневая проверка авторизации на основе уже подготовленных
 * множеств ролей и permissions + контекста.
 * Рекомендуется вызывать через более высокоуровневую обёртку checkAccess.
 */
export function checkAuthorization(
  roles: ReadonlySet<AnyRole>,
  permissions: ReadonlySet<Permission>,
  action: Action,
  resource: Resource,
  context: AuthGuardContextCore,
): AuthDecision {
  const shortcutDecision = evaluateRoleShortcuts(roles, action, resource);
  if (shortcutDecision !== undefined) {
    return shortcutDecision;
  }

  const requiredPermissions = getRequiredPermissions(action, resource);
  const hasRequiredPermissions = requiredPermissions.every((permission) =>
    permissions.has(permission)
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
        Array.from(permissions),
      ),
    );
  }

  if (isPrivateResourceAction(action, resource)) {
    const isOwner = isResourceOwner(context, resource);

    if (!isOwner && !hasElevatedAccess(roles)) {
      return deny(
        'NOT_RESOURCE_OWNER',
        createAuthError('AUTH_RESOURCE_ACCESS_DENIED', undefined, resource),
      );
    }
  }

  return allow('SUCCESS');
}

/**
 * Высокоуровневая проверка доступа: берёт роли/permissions из контекста
 * и делегирует логику в checkAuthorization.
 */
export function checkAccess(
  action: Action,
  resource: Resource,
  context: AuthGuardContextCore,
): AuthDecision {
  if (!context.isAuthenticated) {
    return deny('NOT_AUTHENTICATED', createAuthError('AUTH_MISSING_TOKEN'));
  }

  const roles = context.roles ?? EMPTY_ROLE_SET;
  const permissions = context.permissions ?? EMPTY_PERMISSION_SET;

  return checkAuthorization(roles, permissions, action, resource, context);
}

/* ============================================================================
 * 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 * ========================================================================== */

function isGuestActionAllowed(action: Action, resource: Resource): boolean {
  return action === 'READ' && resource.type === 'public';
}

/** Есть ли у актора системный доступ (SystemRole.SYSTEM). */
function hasSystemAccess(roles: ReadonlySet<AnyRole>): boolean {
  return roles.has(SystemRole.SYSTEM);
}

/** Есть ли у актора административный доступ (Admin/PlatformOwner/SuperAdmin). */
function hasAdminAccess(roles: ReadonlySet<AnyRole>): boolean {
  return (
    roles.has(GlobalUserRole.ADMIN)
    || roles.has(GlobalUserRole.PLATFORM_OWNER)
    || roles.has(GlobalUserRole.SUPER_ADMIN)
    || hasSystemAccess(roles)
  );
}

/** Есть ли у актора модераторский доступ. */
function hasModeratorAccess(roles: ReadonlySet<AnyRole>): boolean {
  return roles.has(GlobalUserRole.MODERATOR) || hasAdminAccess(roles);
}

/** Есть ли у актора повышенный доступ (moderator/admin/system). */
function hasElevatedAccess(roles: ReadonlySet<AnyRole>): boolean {
  return hasModeratorAccess(roles);
}

/** Является ли действие административным. */
function isAdminAction(action: Action): boolean {
  return action === 'ADMIN' || action === 'MODERATE';
}

/** Является ли действие модераторским. */
function isModeratorAction(action: Action): boolean {
  return action === 'MODERATE';
}

const PERMISSIONS_PUBLIC_READ: readonly Permission[] = ['READ_PUBLIC'];
const PERMISSIONS_PRIVATE_READ: readonly Permission[] = ['READ_PRIVATE'];
const PERMISSIONS_PUBLIC_WRITE: readonly Permission[] = ['WRITE_PUBLIC'];
const PERMISSIONS_PRIVATE_WRITE: readonly Permission[] = ['WRITE_PRIVATE'];
const PERMISSIONS_PUBLIC_DELETE: readonly Permission[] = ['DELETE_PUBLIC'];
const PERMISSIONS_PRIVATE_DELETE: readonly Permission[] = ['DELETE_PRIVATE'];
const PERMISSIONS_MODERATE: readonly Permission[] = ['MODERATE_CONTENT'];
const PERMISSIONS_ADMIN: readonly Permission[] = ['SYSTEM_ADMIN'];

/** Возвращает permissions, требуемые для действия над ресурсом. */
function getRequiredPermissions(action: Action, resource: Resource): readonly Permission[] {
  switch (action) {
    case 'READ':
      return resource.type === 'private'
        ? PERMISSIONS_PRIVATE_READ
        : PERMISSIONS_PUBLIC_READ;
    case 'WRITE':
      return resource.type === 'private'
        ? PERMISSIONS_PRIVATE_WRITE
        : PERMISSIONS_PUBLIC_WRITE;
    case 'DELETE':
      return resource.type === 'private'
        ? PERMISSIONS_PRIVATE_DELETE
        : PERMISSIONS_PUBLIC_DELETE;
    case 'MODERATE':
      return PERMISSIONS_MODERATE;
    case 'ADMIN':
      return PERMISSIONS_ADMIN;
  }
}

/** Проверяет, является ли операция записью/удалением приватного ресурса. */
function isPrivateResourceAction(action: Action, resource: Resource): boolean {
  return resource.type === 'private' && (action === 'WRITE' || action === 'DELETE');
}

/**
 * Является ли текущий актор владельцем ресурса.
 * Владелец определяется строгим совпадением userId и ownerId.
 */
function isResourceOwner(context: AuthGuardContextCore, resource: Resource): boolean {
  if (context.userId === undefined || resource.ownerId === undefined) {
    return false;
  }

  return context.userId === resource.ownerId;
}

/* ============================================================================
 * 🏗️ ФАБРИКА ОШИБОК
 * ========================================================================== */

export function createAuthError(
  code: AuthErrorCode,
  field?: string,
  resource?: Resource,
  requiredRole?: AnyRole,
  requiredPermissions?: readonly Permission[],
  userPermissions?: readonly Permission[],
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

export type AuthGuardFn = (context: AuthGuardContextCore) => AuthDecision;

/**
 * Комбинирует несколько guard'ов по AND-логике:
 * все guard'ы должны вернуть allow, иначе возвращается первый deny.
 */
export function combineGuards(...guards: AuthGuardFn[]): AuthGuardFn {
  return (context: AuthGuardContextCore): AuthDecision => {
    const decisions = guards.map((guard) => guard(context));
    const firstDeny = decisions.find((decision) => !decision.allow);

    if (firstDeny !== undefined) {
      return firstDeny;
    }

    return {
      allow: true,
      reason: 'SUCCESS',
    };
  };
}

/**
 * Комбинирует несколько guard'ов по OR-логике:
 * если хотя бы один guard возвращает allow — доступ разрешён.
 * Если все deny — возвращаем первый deny-сценарий с ошибкой (если есть).
 */
export function eitherGuard(...guards: AuthGuardFn[]): AuthGuardFn {
  return (context: AuthGuardContextCore): AuthDecision => {
    const decisions = guards.map((guard) => guard(context));
    const firstAllow = decisions.find((decision) => decision.allow);

    if (firstAllow !== undefined) {
      return firstAllow;
    }

    const errors: readonly AuthError[] = decisions
      .filter((decision): decision is DenyDecision => !decision.allow)
      .map((decision) => decision.error)
      .filter((error): error is AuthError => error !== undefined);

    return deny(
      'RESOURCE_ACCESS_DENIED',
      errors[0] ?? createAuthError('AUTH_RESOURCE_ACCESS_DENIED'),
    );
  };
}

type RoleForRequire = GlobalUserRole | SystemRole;

export function requireRole(requiredRole: RoleForRequire): AuthGuardFn {
  return (context: AuthGuardContextCore): AuthDecision => {
    if (!context.isAuthenticated) {
      return deny('NOT_AUTHENTICATED', createAuthError('AUTH_MISSING_TOKEN'));
    }

    const roles = context.roles ?? EMPTY_ROLE_SET;

    if (!roles.has(requiredRole)) {
      return deny(
        'INVALID_ROLE',
        createAuthError('AUTH_INVALID_ROLE', undefined, undefined, requiredRole),
      );
    }

    return allow('SUCCESS');
  };
}

/** Guard, требующий наличия конкретного permission у актора. */
export function requirePermission(requiredPermission: Permission): AuthGuardFn {
  return (context: AuthGuardContextCore): AuthDecision => {
    if (!context.isAuthenticated) {
      return deny('NOT_AUTHENTICATED', createAuthError('AUTH_MISSING_TOKEN'));
    }

    const permissions = context.permissions ?? EMPTY_PERMISSION_SET;

    if (!permissions.has(requiredPermission)) {
      return deny(
        'INSUFFICIENT_PERMISSIONS',
        createAuthError(
          'AUTH_INSUFFICIENT_PERMISSIONS',
          undefined,
          undefined,
          undefined,
          [requiredPermission],
          Array.from(permissions),
        ),
      );
    }

    return allow('SUCCESS');
  };
}
