/**
 * @file packages/core/src/access-control/route-permissions.ts
 * ============================================================================
 * 🎯 ROUTE PERMISSIONS — ПОЛИТИКА ДОСТУПА К МАРШРУТАМ
 * ============================================================================
 *
 * Декларативная политика доступа к маршрутам приложения.
 * Чистое ядро без бизнес-логики, I/O операций и побочных эффектов.
 *
 * Архитектурная роль:
 * - Декларативная политика доступа (route + context → permission)
 * - Микросервисная изоляция политик по маршрутам
 * - Композиционные правила для enterprise security
 * - Полная совместимость с auth-guard.ts и типовой системой
 * - Platform-neutral: работает в Node, Edge, Workers, CLI, Mobile, SSR
 *
 * Принципы:
 * - Effect-free: нет I/O, async, мутаций, глобального состояния, UI зависимостей
 * - Детерминированные результаты для одного входа
 * - Типобезопасные политики с satisfies и Record типизацией
 * - Deny by default для максимальной безопасности
 * - Минимальный API: только core функции без UI helpers
 * - Легко тестируется и расширяется для новых маршрутов и ролей
 */

import type { AnyRole } from '@livai/core-contracts';
import { GlobalUserRole, SystemRole } from '@livai/core-contracts';

import type { AuthGuardContextCore, Permission } from './auth-guard.js';

// Re-export types for convenience
export type { Permission };

/* ============================================================================
 * 🛤️ ТИПЫ МАРШРУТОВ
 * ========================================================================== */

/** Типы поддерживаемых маршрутов приложения */
export type RouteType =
  | 'public'
  | 'auth'
  | 'dashboard'
  | 'admin'
  | 'api'
  | 'settings'
  | 'profile';

/** Структура маршрута для проверки доступа */
export interface RouteInfo {
  readonly type: RouteType;
  readonly path: string;
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined;
  readonly resourceId?: string | undefined;
}

/* ============================================================================
 * 🔐 ПРАВИЛА ДОСТУПА
 * ========================================================================== */

/** Правило доступа для маршрута */
export interface RoutePermissionRule {
  readonly routeType: RouteType;
  /**
   * Явное разрешение доступа (deny-by-default).
   * @remarks
   * Если все проверки (roles, permissions, customCheck) пройдены успешно,
   * доступ разрешается автоматически. Поле `allow: true` используется для
   * явного указания публичных маршрутов и обратной совместимости.
   * В будущем может быть удалено в пользу implicit allow после всех проверок.
   */
  readonly allow?: boolean;
  readonly requiredRoles?: readonly AnyRole[];
  readonly requiredPermissions?: readonly Permission[];
  readonly allowGuests?: boolean;
  readonly allowAuthenticated?: boolean;
  readonly customCheck?: (context: RoutePermissionContext) => boolean;
}

/** Контекст для проверки разрешений маршрута */
export type RoutePermissionContext = Omit<AuthGuardContextCore, 'roles' | 'permissions'> & {
  readonly isAuthenticated: boolean; // Явно указываем, так как Omit может скрыть обязательное поле
  readonly requestId?: string; // для логирования и отладки
  readonly platform?: string; // web, mobile, etc.
  readonly isAdminMode?: boolean; // флаг для админских режимов
  readonly userRoles?: ReadonlySet<AnyRole>; // унифицированное имя
  readonly userPermissions?: ReadonlySet<Permission>; // унифицированное имя
  // ПРИМЕЧАНИЕ: можно синхронизировать с AuthGuardContext в будущем - поддерживать совместимость
};

/** Причины решений проверки доступа к маршруту */
export type RouteDecisionReason =
  | 'PUBLIC_ROUTE'
  | 'GUEST_ACCESS_ALLOWED'
  | 'AUTHENTICATED_NOT_ALLOWED'
  | 'AUTH_REQUIRED'
  | 'INSUFFICIENT_ROLE_PRIVILEGES'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'CUSTOM_POLICY_FAILED'
  | 'EXPLICIT_ALLOW'
  | 'DENY_BY_DEFAULT';

/** Результат проверки разрешения маршрута */
export type RoutePermissionResult =
  | { readonly allowed: true; readonly reason: RouteDecisionReason; }
  | {
    readonly allowed: false;
    readonly reason: RouteDecisionReason;
    readonly requiredRoles?: readonly AnyRole[];
    readonly requiredPermissions?: readonly Permission[];
  };

/* ============================================================================
 * 📋 ДЕКЛАРАТИВНЫЕ ПРАВИЛА ДОСТУПА
 * ========================================================================== */

/**
 * Роли авторизованных пользователей для стандартных маршрутов.
 * Используется для избежания дублирования в политиках.
 */
const AUTHENTICATED_USER_ROLES = [
  GlobalUserRole.USER,
  GlobalUserRole.PREMIUM,
  GlobalUserRole.MODERATOR,
  GlobalUserRole.ADMIN,
  GlobalUserRole.SUPER_ADMIN,
] as const;

/**
 * Таблица политик доступа к маршрутам.
 * Каждая запись определяет правила для типа маршрута.
 * Использует satisfies для type safety и as const для иммутабельности.
 */
const ROUTE_PERMISSION_POLICIES: Record<RouteType, RoutePermissionRule> = {
  // Публичные маршруты - доступны всем
  public: {
    routeType: 'public',
    allow: true,
  } satisfies RoutePermissionRule,

  // Маршруты аутентификации - только для неавторизованных
  auth: {
    routeType: 'auth',
    allowGuests: true,
    allowAuthenticated: false,
    customCheck: (context: RoutePermissionContext): boolean => !context.isAuthenticated,
  } satisfies RoutePermissionRule,

  // Дашборд - только для авторизованных пользователей
  dashboard: {
    routeType: 'dashboard',
    allow: true,
    allowAuthenticated: true,
    requiredRoles: AUTHENTICATED_USER_ROLES,
  } satisfies RoutePermissionRule,

  // Админ-панель - только для администраторов
  // Примечание: SYSTEM role требует также наличия всех указанных permissions.
  // Это обеспечивает дополнительную безопасность для системных акторов.
  admin: {
    routeType: 'admin',
    allow: true,
    allowAuthenticated: true,
    requiredRoles: [GlobalUserRole.ADMIN, GlobalUserRole.SUPER_ADMIN, SystemRole.SYSTEM] as const,
    requiredPermissions: ['SYSTEM_ADMIN', 'MANAGE_USERS'] as const,
  } satisfies RoutePermissionRule,

  // API endpoints - различные уровни доступа
  api: {
    routeType: 'api',
    allow: true,
    allowAuthenticated: true,
  } satisfies RoutePermissionRule,

  // Настройки - для авторизованных пользователей
  settings: {
    routeType: 'settings',
    allow: true,
    allowAuthenticated: true,
    requiredRoles: AUTHENTICATED_USER_ROLES,
  } satisfies RoutePermissionRule,

  // Профиль - для авторизованных пользователей
  profile: {
    routeType: 'profile',
    allow: true,
    allowAuthenticated: true,
    requiredRoles: AUTHENTICATED_USER_ROLES,
  } satisfies RoutePermissionRule,
} as const satisfies Record<RouteType, RoutePermissionRule>;

/** Доступные типы маршрутов. Вычисляется один раз для оптимизации производительности. */
export const AVAILABLE_ROUTE_TYPES = Object.keys(
  ROUTE_PERMISSION_POLICIES,
) as RouteType[];

/* ============================================================================
 * 🎯 ОСНОВНЫЕ ФУНКЦИИ
 * ========================================================================== */

/** Проверяет разрешение доступа к маршруту на основе контекста. Чистая функция без side effects. */
export function checkRoutePermission(
  route: RouteInfo, // информация о маршруте
  context: RoutePermissionContext, // контекст проверки разрешений
): RoutePermissionResult { // результат проверки доступа
  // Получаем политику для типа маршрута
  const policy = ROUTE_PERMISSION_POLICIES[route.type];

  // 1️⃣ Базовые условия доступа: гости/аутентификация (самые простые проверки)
  const basicCheck = checkBasicAccessConditions(policy, context);
  if (basicCheck) return basicCheck;

  // 2️⃣ Кастомные бизнес-правила (специфическая логика маршрута)
  if (policy.customCheck && !policy.customCheck(context)) {
    return { allowed: false, reason: 'CUSTOM_POLICY_FAILED' };
  }

  // 3️⃣ Проверяем роли и разрешения (авторизация после аутентификации)
  const privilegeCheck = checkPrivileges(policy, context);
  if (privilegeCheck) return privilegeCheck;

  // 4️⃣ Явная проверка разрешения (explicit allow после всех проверок)
  if (policy.allow === true) {
    return { allowed: true, reason: 'EXPLICIT_ALLOW' };
  }

  // 5️⃣ Deny-by-default: если не прошли все проверки выше
  return { allowed: false, reason: 'DENY_BY_DEFAULT' };
}

/** Проверяет базовые условия доступа (гости/аутентификация) */
function checkBasicAccessConditions(
  policy: RoutePermissionRule, // политика доступа
  context: RoutePermissionContext, // контекст проверки
): RoutePermissionResult | null { // результат проверки или null если проверка не применима
  // Проверяем гостевой доступ
  if (policy.allowGuests === true && !context.isAuthenticated) {
    return { allowed: true, reason: 'GUEST_ACCESS_ALLOWED' };
  }

  // Проверяем требование аутентификации
  if (policy.allowAuthenticated === false && context.isAuthenticated) {
    return { allowed: false, reason: 'AUTHENTICATED_NOT_ALLOWED' };
  }

  if (policy.allowAuthenticated === true && !context.isAuthenticated) {
    return { allowed: false, reason: 'AUTH_REQUIRED' };
  }

  return null;
}

/** Проверяет роли и разрешения */
function checkPrivileges(
  policy: RoutePermissionRule, // политика доступа
  context: RoutePermissionContext, // контекст проверки
): RoutePermissionResult | null { // результат проверки или null если проверка не применима
  // Проверяем требуемые роли
  if (policy.requiredRoles && policy.requiredRoles.length > 0) {
    const hasRequiredRole = policy.requiredRoles.some((role) =>
      context.userRoles?.has(role) ?? false
    );

    if (!hasRequiredRole) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_ROLE_PRIVILEGES',
        requiredRoles: policy.requiredRoles,
      };
    }
  }

  // Проверяем требуемые разрешения
  if (policy.requiredPermissions && policy.requiredPermissions.length > 0) {
    const hasRequiredPermissions = policy.requiredPermissions.every((permission) =>
      context.userPermissions?.has(permission) ?? false
    );

    if (!hasRequiredPermissions) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_PERMISSIONS',
        requiredPermissions: policy.requiredPermissions,
      };
    }
  }

  return null;
}

/** Получает политику доступа для типа маршрута. Полезно для анализа и отладки политик. */
export function getRoutePolicy(
  routeType: RouteType, // тип маршрута
): RoutePermissionRule { // политика доступа
  return ROUTE_PERMISSION_POLICIES[routeType];
}

/** Получает все доступные типы маршрутов. Полезно для валидации и автодополнения. */
export function getAvailableRouteTypes(): RouteType[] { // массив всех типов маршрутов
  return AVAILABLE_ROUTE_TYPES;
}

/* ============================================================================
 * 🏗️ ФАБРИКИ МАРШРУТОВ
 * ========================================================================== */

/** Создает информацию о публичном маршруте. */
export function createPublicRoute(
  path: string, // путь маршрута
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined, // HTTP метод (опционально)
): RouteInfo { // информация о маршруте
  return {
    type: 'public',
    path,
    method,
  };
}

/** Создает информацию о защищенном маршруте. */
export function createProtectedRoute(
  type: Exclude<RouteType, 'public'>, // тип маршрута
  path: string, // путь маршрута
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined, // HTTP метод (опционально)
  resourceId?: string | undefined, // ID ресурса (опционально)
): RouteInfo { // информация о маршруте
  return {
    type,
    path,
    method,
    resourceId,
  };
}
