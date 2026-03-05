/**
 * @file packages/app/src/lib/route-permissions.ts
 * ============================================================================
 * 🎯 ROUTE PERMISSIONS — ПОЛИТИКА ДОСТУПА К МАРШРУТАМ
 * ============================================================================
 * Архитектурная роль:
 * - Декларативная политика доступа к маршрутам приложения
 * - Чистая таблица правил без бизнес-логики и side effects
 * - Микросервисная изоляция политик доступа по маршрутам
 * - Композиционные правила для enterprise security
 * - Полная совместимость с auth-guard.ts и типовой системой
 * Свойства:
 * - Effect-free архитектура для предсказуемости
 * - Декларативные правила доступа (route + context → permission)
 * - Типобезопасные политики с satisfies и as const
 * - Расширяемость для новых маршрутов и ролей
 * - Легкость тестирования и аудита политик
 * Принципы:
 * - Никаких I/O операций (файлы, сеть, БД)
 * - Никакой асинхронности и таймаутов
 * - Никаких побочных эффектов и мутаций
 * - Детерминированные результаты для одного входа
 * - Максимальная безопасность и консервативность (deny by default)
 * Почему декларативно:
 * - Политика как код — легко читать и поддерживать
 * - Централизованные правила — один источник истины
 * - Type-safe конфигурация — компилятор ловит ошибки
 * - Тестируемость — каждая политика отдельно проверяема
 */

import { UserRoles } from '../types/common.js';
import type { AuthGuardContext, Permission, UserRole } from './auth-guard.js';

// Re-export types for convenience
export type { Permission, UserRole };

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
export type RouteInfo = {
  readonly type: RouteType;
  readonly path: string;
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined;
  readonly resourceId?: string | undefined;
};

/* ============================================================================
 * 🔐 ПРАВИЛА ДОСТУПА
 * ========================================================================== */

/** Правило доступа для маршрута */
export type RoutePermissionRule = {
  readonly routeType: RouteType;
  readonly allow?: boolean; // Явное разрешение доступа (deny-by-default)
  readonly requiredRoles?: readonly UserRole[];
  readonly requiredPermissions?: readonly Permission[];
  readonly allowGuests?: boolean;
  readonly allowAuthenticated?: boolean;
  readonly customCheck?: (context: RoutePermissionContext) => boolean;
};

/** Контекст для проверки разрешений маршрута */
export type RoutePermissionContext = Omit<AuthGuardContext, 'roles' | 'permissions'> & {
  readonly platform?: string; // web, mobile, etc.
  readonly isAdminMode?: boolean; // флаг для админских режимов
  readonly userRoles?: ReadonlySet<UserRole>; // унифицированное имя
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
    readonly requiredRoles?: readonly UserRole[];
    readonly requiredPermissions?: readonly Permission[];
  };

/* ============================================================================
 * 📋 ДЕКЛАРАТИВНЫЕ ПРАВИЛА ДОСТУПА
 * ========================================================================== */

/**
 * Таблица политик доступа к маршрутам.
 * Каждая запись определяет правила для типа маршрута.
 * Использует satisfies для type safety и as const для иммутабельности.
 */
const ROUTE_PERMISSION_POLICIES = {
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
    requiredRoles: [
      UserRoles.USER,
      UserRoles.PREMIUM_USER,
      UserRoles.MODERATOR,
      UserRoles.ADMIN,
      UserRoles.SUPER_ADMIN,
    ] as const,
  } satisfies RoutePermissionRule,

  // Админ-панель - только для администраторов
  admin: {
    routeType: 'admin',
    allow: true,
    allowAuthenticated: true,
    requiredRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.SYSTEM] as const,
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
    requiredRoles: [
      UserRoles.USER,
      UserRoles.PREMIUM_USER,
      UserRoles.MODERATOR,
      UserRoles.ADMIN,
      UserRoles.SUPER_ADMIN,
    ] as const,
  } satisfies RoutePermissionRule,

  // Профиль - для авторизованных пользователей
  profile: {
    routeType: 'profile',
    allow: true,
    allowAuthenticated: true,
    requiredRoles: [
      UserRoles.USER,
      UserRoles.PREMIUM_USER,
      UserRoles.MODERATOR,
      UserRoles.ADMIN,
      UserRoles.SUPER_ADMIN,
    ] as const,
  } satisfies RoutePermissionRule,
} as const;

/* ============================================================================
 * 🎯 ОСНОВНЫЕ ФУНКЦИИ
 * ========================================================================== */

/**
 * Проверяет разрешение доступа к маршруту на основе контекста.
 * Чистая функция без side effects.
 * @param route - информация о маршруте
 * @param context - контекст проверки разрешений
 * @returns результат проверки доступа
 */
export function checkRoutePermission(
  route: RouteInfo,
  context: RoutePermissionContext,
): RoutePermissionResult {
  // Получаем политику для типа маршрута
  const policy = ROUTE_PERMISSION_POLICIES[route.type] as RoutePermissionRule;

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
  policy: RoutePermissionRule,
  context: RoutePermissionContext,
): RoutePermissionResult | null {
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
  policy: RoutePermissionRule,
  context: RoutePermissionContext,
): RoutePermissionResult | null {
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

/**
 * Получает политику доступа для типа маршрута.
 * Полезно для анализа и отладки политик.
 * @param routeType - тип маршрута
 * @returns политика доступа или undefined если тип неизвестен
 */
export function getRoutePolicy(routeType: RouteType): RoutePermissionRule | undefined {
  return ROUTE_PERMISSION_POLICIES[routeType] as RoutePermissionRule;
}

/**
 * Получает все доступные типы маршрутов.
 * Полезно для валидации и автодополнения.
 * @returns массив всех типов маршрутов
 */
export function getAvailableRouteTypes(): readonly RouteType[] {
  return Object.freeze((Object.keys(ROUTE_PERMISSION_POLICIES) as RouteType[]).slice());
}

/* ============================================================================
 * 🏗️ ФАБРИКИ МАРШРУТОВ
 * ========================================================================== */

/**
 * Создает информацию о публичном маршруте.
 * @param path - путь маршрута
 * @param method - HTTP метод (опционально)
 * @returns информация о маршруте
 */
export function createPublicRoute(
  path: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined,
): RouteInfo {
  return {
    type: 'public',
    path,
    method,
  };
}

/**
 * Создает информацию о защищенном маршруте.
 * @param type - тип маршрута
 * @param path - путь маршрута
 * @param method - HTTP метод (опционально)
 * @param resourceId - ID ресурса (опционально)
 * @returns информация о маршруте
 */
export function createProtectedRoute(
  type: Exclude<RouteType, 'public'>,
  path: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined,
  resourceId?: string | undefined,
): RouteInfo {
  return {
    type,
    path,
    method,
    resourceId,
  };
}

/* ============================================================================
 * 🔍 УТИЛИТЫ ДЛЯ ПОЛИТИК
 * ========================================================================== */

/**
 * Проверяет, требует ли маршрут аутентификации.
 * @param routeType - тип маршрута
 * @returns true если требуется аутентификация
 */
export function requiresAuthentication(routeType: RouteType): boolean {
  const policy = ROUTE_PERMISSION_POLICIES[routeType] as RoutePermissionRule;
  // Требуется аутентификация если:
  // 1. Явно указано allowAuthenticated: true, ИЛИ
  // 2. Не указано allowGuests: true И не указано allow: true (deny-by-default)
  return policy.allowAuthenticated === true
    || (policy.allowGuests !== true && policy.allow !== true);
}

/**
 * Получает минимальные роли для доступа к маршруту.
 * @param routeType - тип маршрута
 * @returns массив требуемых ролей или пустой массив
 */
export function getRequiredRoles(routeType: RouteType): readonly UserRole[] {
  const roles = (ROUTE_PERMISSION_POLICIES[routeType] as RoutePermissionRule).requiredRoles;
  return roles ? Object.freeze([...roles]) : Object.freeze([]);
}

/**
 * Получает требуемые разрешения для маршрута.
 * @param routeType - тип маршрута
 * @returns массив требуемых разрешений или пустой массив
 */
export function getRequiredPermissions(routeType: RouteType): readonly Permission[] {
  const permissions =
    (ROUTE_PERMISSION_POLICIES[routeType] as RoutePermissionRule).requiredPermissions;
  return permissions ? Object.freeze([...permissions]) : Object.freeze([]);
}

/**
 * Определяет тип маршрута по пути.
 * Вспомогательная функция для упрощения логики сопоставления.
 * @param routePath - путь маршрута
 * @returns тип маршрута
 */
function getRouteTypeFromPath(routePath: string | null | undefined): RouteType {
  // Early return для невалидных значений
  if (routePath === null || routePath === undefined) {
    return 'public';
  }

  if (typeof routePath !== 'string') {
    return 'public';
  }

  const trimmedPath = routePath.trim();
  if (trimmedPath.length === 0) {
    return 'public';
  }

  // Теперь trimmedPath гарантированно непустая строка

  if (trimmedPath.startsWith('/auth') || trimmedPath === '/login' || trimmedPath === '/register') {
    return 'auth';
  }
  if (trimmedPath.startsWith('/dashboard')) {
    return 'dashboard';
  }
  if (trimmedPath.startsWith('/admin')) {
    return 'admin';
  }
  if (trimmedPath.startsWith('/api')) {
    return 'api';
  }
  if (trimmedPath.startsWith('/profile')) {
    return 'profile';
  }
  if (trimmedPath.startsWith('/settings')) {
    return 'settings';
  }
  // По умолчанию - публичный маршрут
  return 'public';
}

/**
 * Проверяет доступ к маршруту по пути.
 * ⚠️ Упрощённая проверка для UI компонентов:
 * - Использует "пустой" контекст (неавторизованный пользователь)
 * - Не учитывает customCheck и реальные роли пользователя
 * - SSR-safe: возвращает консервативный результат в серверном окружении
 * @param routePath - путь маршрута
 * @returns true если маршрут доступен, false иначе
 */
export function canAccessRoute(routePath: string): boolean {
  // SSR-safe: в серверном окружении показываем только публичные маршруты
  // чтобы избежать hydration mismatch из-за неизвестного статуса аутентификации
  if (typeof window === 'undefined') {
    // В SSR считаем доступными только публичные и auth маршруты
    return getRouteTypeFromPath(routePath) === 'public'
      || getRouteTypeFromPath(routePath) === 'auth';
  }

  // Определяем тип маршрута по пути
  const routeType = getRouteTypeFromPath(routePath);

  // Создаем минимальный маршрут
  const route: RouteInfo = {
    type: routeType,
    path: routePath,
  };

  // Создаем пустой контекст (предполагаем неавторизованного пользователя)
  const context: RoutePermissionContext = {
    requestId: 'ui-check',
    isAuthenticated: false,
    isAdminMode: false,
  };

  // Проверяем доступ
  const result = checkRoutePermission(route, context);
  return result.allowed;
}
