/**
 * @file packages/app/src/routes/routes.ts
 *
 * =============================================================================
 * 🛣️ ROUTES — ДЕКЛАРАТИВНЫЙ СПИСОК ВСЕХ ROUTES ПРИЛОЖЕНИЯ
 * =============================================================================
 *
 * Декларативная конфигурация всех маршрутов приложения.
 *
 * Назначение:
 * - Определяет список route-эндпоинтов и их метаданные
 * - Используется в router, guards, middleware
 * - Позволяет централизованно управлять маршрутами и правами доступа
 *
 * Принципы:
 * - 🚫 Нет side-effects, только декларация
 * - ✅ Типобезопасно, совместимо с TypeScript
 * - 🧠 Микросервисно: может использоваться в API, UI, Workers
 * - 🧱 Stable contract для всех feature-модулей
 *
 * Style guidelines:
 * - Explicit invariants
 * - Exhaustive unions
 * - Predictable structure
 */

import type { RouteConfig } from '../types/common.js';
import { AppModules, UserRoles } from '../types/common.js';

/* ========================================================================== */
/* 📋 КОНСТАНТЫ ИМЕНИ МАРШРУТОВ */
/* ========================================================================== */

/**
 * Константы для имён маршрутов приложения.
 * Используются для исключения "магических строк" и предотвращения опечаток.
 */
export const RouteNames = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  PROFILE: 'profile',
  BOTS_LIST: 'bots_list',
  BOTS_CREATE: 'bots_create',
  BOTS_DETAIL: 'bots_detail',
  BOTS_EDIT: 'bots_edit',
  CHAT_LIST: 'chat_list',
  CHAT_DETAIL: 'chat_detail',
  BILLING_DASHBOARD: 'billing_dashboard',
  BILLING_USAGE: 'billing_usage',
} as const;

/**
 * Тип для ключей RouteNames (гарантирует синхронизацию).
 */
export type RouteNameKey = keyof typeof RouteNames;

/**
 * Тип для значений RouteNames.
 */
export type RouteName = typeof RouteNames[RouteNameKey];

/**
 * Проверяет консистентность RouteNames и ROUTES.
 * Гарантирует, что все имена маршрутов синхронизированы.
 */
function validateRouteConsistency(): void {
  const routeNames = Object.values(RouteNames);
  const routeNamesSet = new Set<string>(routeNames);
  const routesNamesSet = new Set<string>(ROUTES.map((route) => route.name));

  // Проверяем, что все RouteNames имеют соответствующие маршруты
  const missingInRoutes = routeNames.filter((name) => !routesNamesSet.has(name));
  if (missingInRoutes.length > 0) {
    throw new Error(
      `RouteNames содержит имена, отсутствующие в ROUTES: ${missingInRoutes.join(', ')}`,
    );
  }

  // Проверяем, что все маршруты имеют соответствующие имена в RouteNames
  const missingInRouteNames = ROUTES
    .map((route) => route.name)
    .filter((name) => !routeNamesSet.has(name));
  if (missingInRouteNames.length > 0) {
    throw new Error(
      `ROUTES содержит маршруты с именами, отсутствующими в RouteNames: ${
        missingInRouteNames.join(', ')
      }`,
    );
  }

  // Проверяем дубликаты в ROUTES
  const routeNameCounts = ROUTES.reduce((acc, route) => {
    const currentCount = acc[route.name] ?? 0;
    return { ...acc, [route.name]: currentCount + 1 };
  }, {} as Record<string, number>);

  const duplicates = Object.entries(routeNameCounts)
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  if (duplicates.length > 0) {
    throw new Error(`ROUTES содержит дублированные имена маршрутов: ${duplicates.join(', ')}`);
  }
}

/* ========================================================================== */
/* 🧩 СПИСОК ROUTES */
/* ========================================================================== */

/**
 * Полный список маршрутов приложения.
 * --------------------------------------------------------------------------
 * Каждый маршрут описан как объект RouteConfig:
 * - path — путь маршрута
 * - name — уникальный идентификатор маршрута
 * - module — feature-модуль (например, 'auth', 'bots', 'chat', 'billing')
 * - protected — требует ли аутентификацию
 * - allowedRoles — список ролей, которым разрешён доступ (если protected)
 */
export const ROUTES: readonly RouteConfig[] = [
  /* ------------------------------------------------------------------------ */
  /* 🔑 AUTH */
  /* ------------------------------------------------------------------------ */
  {
    path: '/login',
    name: 'login',
    module: AppModules.AUTH,
    protected: false,
  },
  {
    path: '/logout',
    name: 'logout',
    module: AppModules.AUTH,
    protected: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
  },
  {
    path: '/profile',
    name: 'profile',
    module: AppModules.AUTH,
    protected: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
  },

  /* ------------------------------------------------------------------------ */
  /* 🤖 BOTS */
  /* ------------------------------------------------------------------------ */
  {
    path: '/bots',
    name: 'bots_list',
    module: AppModules.BOTS,
    protected: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
  },
  {
    path: '/bots/create',
    name: 'bots_create',
    module: AppModules.BOTS,
    protected: true,
    allowedRoles: [UserRoles.ADMIN, UserRoles.OWNER],
  },
  {
    path: '/bots/:botId',
    name: 'bots_detail',
    module: AppModules.BOTS,
    protected: true,
    allowedRoles: [
      UserRoles.USER,
      UserRoles.ADMIN,
      UserRoles.OWNER,
      UserRoles.EDITOR,
      UserRoles.VIEWER,
    ],
  },
  {
    path: '/bots/:botId/edit',
    name: 'bots_edit',
    module: AppModules.BOTS,
    protected: true,
    allowedRoles: [UserRoles.ADMIN, UserRoles.OWNER, UserRoles.EDITOR],
  },

  /* ------------------------------------------------------------------------ */
  /* 💬 CHAT */
  /* ------------------------------------------------------------------------ */
  {
    path: '/chat',
    name: 'chat_list',
    module: AppModules.CHAT,
    protected: true,
    allowedRoles: [
      UserRoles.USER,
      UserRoles.ADMIN,
      UserRoles.OWNER,
      UserRoles.MODERATOR,
      UserRoles.PARTICIPANT,
    ],
  },
  {
    path: '/chat/:chatId',
    name: 'chat_detail',
    module: AppModules.CHAT,
    protected: true,
    allowedRoles: [
      UserRoles.USER,
      UserRoles.ADMIN,
      UserRoles.OWNER,
      UserRoles.MODERATOR,
      UserRoles.PARTICIPANT,
    ],
  },

  /* ------------------------------------------------------------------------ */
  /* 💳 BILLING */
  /* ------------------------------------------------------------------------ */
  {
    path: '/billing',
    name: 'billing_dashboard',
    module: AppModules.BILLING,
    protected: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
  },
  {
    path: '/billing/usage',
    name: 'billing_usage',
    module: AppModules.BILLING,
    protected: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
  },
];

/* ========================================================================== */
/* 🔧 УТИЛИТЫ ДЛЯ ROUTES */
/* ========================================================================== */

/**
 * Проверяет, имеет ли пользователь с данной ролью доступ к маршруту.
 * @param route - конфигурация маршрута
 * @param role - роль пользователя
 * @returns true если доступ разрешён
 */
function canAccessRoute(route: RouteConfig, role: UserRoles): boolean {
  if (!route.protected) {
    return true;
  }
  return route.allowedRoles?.includes(role) ?? false;
}

/**
 * Возвращает маршрут по уникальному имени.
 * @param name - уникальный идентификатор маршрута
 * @returns RouteConfig или undefined
 */
export function getRouteByName(name: RouteName): RouteConfig | undefined {
  return ROUTES.find((route) => route.name === name);
}

/**
 * Возвращает все маршруты, доступные для пользователя с данной ролью.
 * @param role - роль пользователя
 * @returns массив доступных маршрутов
 */
export function getRoutesForRole(role: UserRoles): readonly RouteConfig[] {
  return ROUTES.filter((route) => canAccessRoute(route, role));
}

// Выполняем валидацию консистентности при импорте модуля
validateRouteConsistency();
