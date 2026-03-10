/**
 * @file packages/app/src/routes/route-meta.ts
 * =============================================================================
 * 🛡️ ROUTE META — МЕТАДАННЫЕ МАРШРУТОВ, ПРАВА И FEATURE FLAGS
 * =============================================================================
 * Управление метаданными маршрутов приложения:
 * - Разрешения по ролям
 * - Фичевые флаги
 * - Требование авторизации
 * Принципы:
 * - 🚫 Нет side-effects, только декларация и утилиты
 * - ✅ Типобезопасно, совместимо с TypeScript
 * - 🧠 Микросервисно: может использоваться в API, UI, Workers
 * - 🧱 Stable contract для всех feature-модулей
 * Style guidelines:
 * - Explicit invariants
 * - Exhaustive unions
 * - Predictable structure
 */
import type {
  RouteInfo,
  RoutePermissionContext,
  RoutePermissionResult,
  RouteType,
} from '@livai/core/access-control/route-permissions';
import {
  checkRoutePermission,
  createProtectedRoute,
} from '@livai/core/access-control/route-permissions';

import type { AppModules } from '../types/common.js';
import { UserRoles } from '../types/common.js';
import type { RouteName } from './routes.js';
import { RouteNames, ROUTES } from './routes.js';

/** Типизированный результат проверки доступа к маршруту */
export type RouteAccessResult =
  | { allowed: true; reason: 'ACCESS_GRANTED'; }
  | {
    allowed: false;
    reason: string;
    details?: RoutePermissionResult | { requiredRoles: readonly UserRoles[]; };
  };

/** Вспомогательная функция для логирования ошибок или выбрасывания исключений */
function logWarningOrThrow(message: string): void {
  if (process.env['NODE_ENV'] !== 'production') {
    throw new Error(message);
  } else {
    // eslint-disable-next-line no-console
    console.warn('RouteMeta validation warning:', message);
  }
}

/** Валидирует корректность feature flags во время выполнения */
function validateFeatureFlags(): void {
  const allFeatureFlags = Object.values(FeatureFlags);
  const usedFlags = new Set<FeatureFlags>();

  // Собираем все используемые feature flags из routeMeta
  Object.values(routeMeta).forEach((meta) => {
    meta.featureFlags?.forEach((flag) => {
      usedFlags.add(flag);
    });
  });

  // Проверяем, что все используемые флаги определены в enum
  usedFlags.forEach((flag) => {
    if (!allFeatureFlags.includes(flag)) {
      logWarningOrThrow(`Feature flag "${flag}" не определён в FeatureFlags enum`);
    }
  });
}

/* ========================================================================== */
/* 🔗 ИНТЕГРАЦИЯ С ROUTE-PERMISSIONS */
/* ========================================================================== */

/**
 * Преобразует конкретное имя маршрута в тип для route-permissions.ts
 * @param routeName - имя маршрута из RouteNames
 * @returns тип маршрута для route-permissions.ts
 */
function getRouteTypeForPermissions(
  routeName: RouteName,
): 'public' | 'auth' | 'dashboard' | 'admin' | 'api' | 'settings' | 'profile' {
  switch (routeName) {
    case RouteNames.LOGIN:
      return 'public'; // LOGIN доступен всем
    case RouteNames.LOGOUT:
      return 'auth';
    case RouteNames.PROFILE:
      return 'profile';
    case RouteNames.BOTS_LIST:
    case RouteNames.BOTS_DETAIL:
    case RouteNames.CHAT_LIST:
    case RouteNames.CHAT_DETAIL:
    case RouteNames.BILLING_DASHBOARD:
    case RouteNames.BILLING_USAGE:
      return 'dashboard';
    case RouteNames.BOTS_CREATE:
    case RouteNames.BOTS_EDIT:
      return 'admin';
    default:
      return 'dashboard'; // fallback
  }
}

/* ========================================================================== */
/* ⚡ FEATURE FLAGS */
/* ========================================================================== */

/** Feature-флаги приложения. Enum предотвращает магические строки и обеспечивает автодополнение. */
export enum FeatureFlags {
  BOTS_ADVANCED = 'BOTS_ADVANCED',
  CHAT_MODERATOR = 'CHAT_MODERATOR',
  BILLING_PREMIUM = 'BILLING_PREMIUM',
}

/* ========================================================================== */
/* 🧩 ROUTE META TYPE */
/* ========================================================================== */

/** Метаданные маршрута для guards, middleware и UI. */
export type RouteMeta = {
  /** Уникальное имя маршрута */
  readonly name: RouteName;

  /** Требуется ли авторизация */
  readonly authRequired: boolean;

  /** Разрешённые роли для доступа. undefined = открытый доступ для всех */
  readonly allowedRoles?: readonly UserRoles[];

  /** Фичевые флаги, необходимые для доступа. undefined = без требований к флагам */
  readonly featureFlags?: readonly FeatureFlags[];

  /** Контекст приложения для условной маршрутизации (платформа, tenant, эксперимент) */
  readonly contextRequired?: Partial<{
    platform: AppModules; // Для упрощения, можно расширить в будущем
    tenantId: string;
    experimentGroup: string;
  }>;

  /** Человеко-понятное описание маршрута */
  readonly description?: string;
};

/* ========================================================================== */
/* 🧱 ROUTE META DEFINITIONS */
/* ========================================================================== */

/** Определения метаданных маршрутов. Типобезопасность и валидация обеспечивают безопасность. */
export const routeMeta: Readonly<Record<RouteName, RouteMeta>> = {
  /* ------------------------------------------------------------------------ */
  /* 🔑 AUTH */
  [RouteNames.LOGIN]: {
    name: RouteNames.LOGIN,
    authRequired: false,
  },
  [RouteNames.LOGOUT]: {
    name: RouteNames.LOGOUT,
    authRequired: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
  },
  [RouteNames.PROFILE]: {
    name: RouteNames.PROFILE,
    authRequired: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
  },

  /* ------------------------------------------------------------------------ */
  /* 🤖 BOTS */
  [RouteNames.BOTS_LIST]: {
    name: RouteNames.BOTS_LIST,
    authRequired: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
    featureFlags: [FeatureFlags.BOTS_ADVANCED],
  },
  [RouteNames.BOTS_CREATE]: {
    name: RouteNames.BOTS_CREATE,
    authRequired: true,
    allowedRoles: [UserRoles.ADMIN, UserRoles.OWNER],
    featureFlags: [FeatureFlags.BOTS_ADVANCED],
  },
  [RouteNames.BOTS_DETAIL]: {
    name: RouteNames.BOTS_DETAIL,
    authRequired: true,
    allowedRoles: [
      UserRoles.USER,
      UserRoles.ADMIN,
      UserRoles.OWNER,
      UserRoles.EDITOR,
      UserRoles.VIEWER,
    ],
    featureFlags: [FeatureFlags.BOTS_ADVANCED],
  },
  [RouteNames.BOTS_EDIT]: {
    name: RouteNames.BOTS_EDIT,
    authRequired: true,
    allowedRoles: [UserRoles.ADMIN, UserRoles.OWNER, UserRoles.EDITOR],
    featureFlags: [FeatureFlags.BOTS_ADVANCED],
  },

  /* ------------------------------------------------------------------------ */
  /* 💬 CHAT */
  [RouteNames.CHAT_LIST]: {
    name: RouteNames.CHAT_LIST,
    authRequired: true,
    allowedRoles: [
      UserRoles.USER,
      UserRoles.ADMIN,
      UserRoles.OWNER,
      UserRoles.MODERATOR,
      UserRoles.PARTICIPANT,
    ],
    featureFlags: [FeatureFlags.CHAT_MODERATOR],
  },
  [RouteNames.CHAT_DETAIL]: {
    name: RouteNames.CHAT_DETAIL,
    authRequired: true,
    allowedRoles: [
      UserRoles.USER,
      UserRoles.ADMIN,
      UserRoles.OWNER,
      UserRoles.MODERATOR,
      UserRoles.PARTICIPANT,
    ],
    featureFlags: [FeatureFlags.CHAT_MODERATOR],
  },

  /* ------------------------------------------------------------------------ */
  /* 💳 BILLING */
  [RouteNames.BILLING_DASHBOARD]: {
    name: RouteNames.BILLING_DASHBOARD,
    authRequired: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
    featureFlags: [FeatureFlags.BILLING_PREMIUM],
  },
  [RouteNames.BILLING_USAGE]: {
    name: RouteNames.BILLING_USAGE,
    authRequired: true,
    allowedRoles: [UserRoles.USER, UserRoles.ADMIN, UserRoles.OWNER],
    featureFlags: [FeatureFlags.BILLING_PREMIUM],
  },
};

/* ========================================================================== */
/* 🔧 ROUTE META UTILS */
/* ========================================================================== */

/**
 * Получение метаданных маршрута по имени.
 * @param name - имя маршрута
 * @returns RouteMeta или undefined
 */
export function getRouteMeta(name: RouteName): RouteMeta | undefined {
  return routeMeta[name];
}

/**
 * Проверяет доступ пользователя к маршруту по ролям и feature-флагам.
 * @param name - имя маршрута
 * @param userRoles - роли пользователя
 * @param enabledFlags - активные feature-флаги для пользователя
 * @returns true если пользователь может попасть на маршрут
 */
export function canAccessRouteByName(
  name: RouteName,
  userRoles: readonly UserRoles[],
  enabledFlags?: readonly FeatureFlags[],
): boolean {
  const meta = getRouteMeta(name);
  if (!meta) return false;
  if (meta.authRequired && userRoles.length === 0) return false;

  const roleCheck = !meta.allowedRoles
    || meta.allowedRoles.some((role) => userRoles.includes(role));

  const flags = enabledFlags ?? [];
  const flagCheck = !meta.featureFlags || meta.featureFlags.every((flag) => flags.includes(flag));

  return roleCheck && flagCheck;
}

/**
 * Комплексная проверка доступа к маршруту с использованием обеих систем авторизации.
 * Комбинирует проверки route-meta.ts и route-permissions.ts для максимальной безопасности.
 * @param name - имя маршрута
 * @param context - контекст проверки разрешений
 * @returns результат комплексной проверки
 */
export function checkComprehensiveRouteAccess(
  name: RouteName,
  context: RoutePermissionContext,
): RouteAccessResult {
  // 1. Проверка через route-meta.ts (роли и feature flags)
  const meta = getRouteMeta(name);
  if (!meta) {
    return { allowed: false, reason: 'ROUTE_NOT_FOUND' };
  }

  // Проверяем требование аутентификации
  if (meta.authRequired && !context.isAuthenticated) {
    return { allowed: false, reason: 'AUTH_REQUIRED' };
  }

  // Проверяем роли через route-meta.ts
  if (meta.allowedRoles && meta.allowedRoles.length > 0) {
    if (!context.userRoles) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_ROLES',
        details: { requiredRoles: meta.allowedRoles },
      };
    }
    // Convert UserRoles enum values to strings for comparison
    const userRolesArray = Array.from(context.userRoles).map(String);
    const hasRequiredRole = meta.allowedRoles.some((role) => userRolesArray.includes(String(role)));
    if (!hasRequiredRole) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_ROLES',
        details: { requiredRoles: meta.allowedRoles },
      };
    }
  }

  // 2. Проверка через route-permissions.ts (универсальные политики)
  const routeType = getRouteTypeForPermissions(name);

  // Определяем HTTP метод по типу маршрута
  const getHttpMethod = (routeType: RouteType): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' => {
    switch (routeType) {
      case 'api':
        return 'POST'; // API endpoints часто используют POST
      case 'admin':
        return 'PUT'; // Admin операции часто обновляют данные
      default:
        return 'GET'; // UI маршруты обычно GET
    }
  };

  const routeInfo: RouteInfo = routeType === 'public'
    ? { type: 'public', path: name }
    : createProtectedRoute(routeType, name, getHttpMethod(routeType));

  const permissionResult = checkRoutePermission(routeInfo, context);

  if (!permissionResult.allowed) {
    return {
      allowed: false,
      reason: `PERMISSION_DENIED: ${permissionResult.reason}`,
      details: permissionResult,
    };
  }

  return { allowed: true, reason: 'ACCESS_GRANTED' };
}

/**
 * Получает все маршруты, доступные пользователю с учётом ролей и feature-флагов.
 * @param options - параметры фильтрации
 * @param options.roles - роли пользователя (опционально)
 * @param options.featureFlags - активные feature-флаги (опционально)
 * @param options.authRequired - фильтр по требованию авторизации (опционально)
 * @returns массив доступных маршрутов
 */
export function filterRoutes(options: {
  roles?: readonly UserRoles[];
  featureFlags?: readonly FeatureFlags[];
  authRequired?: boolean;
}): readonly RouteMeta[] {
  return Object.values(routeMeta).filter((meta) => {
    // Фильтр по authRequired
    if (options.authRequired !== undefined && meta.authRequired !== options.authRequired) {
      return false;
    }

    // Фильтр по ролям (если указаны)
    if (options.roles !== undefined) {
      const roles = options.roles;
      const rolesCheck = !meta.allowedRoles
        || meta.allowedRoles.some((role: UserRoles) => roles.includes(role));
      if (!rolesCheck) return false;
    }

    // Фильтр по флагам (если указаны)
    if (options.featureFlags !== undefined) {
      const featureFlags = options.featureFlags;
      const flagsCheck = !meta.featureFlags
        || meta.featureFlags.every((flag: FeatureFlags) => featureFlags.includes(flag));
      if (!flagsCheck) return false;
    }

    return true;
  });
}

/* ========================================================================== */
/* 🔍 CONSISTENCY VALIDATION */
/* ========================================================================== */

/** Проверяет консистентность между ROUTE_META и ROUTES. Выбрасывает ошибку при несоответствии. */
function validateRouteMetaConsistency(): void {
  const routeMetaNames = Object.values(routeMeta).map((m) => m.name);
  const routeNames = ROUTES.map((r) => r.name as RouteName);

  // Проверяем дубликаты в routeMeta
  const uniqueNames = new Set(routeMetaNames);
  if (uniqueNames.size !== routeMetaNames.length) {
    const duplicates = routeMetaNames.filter((name, index) =>
      routeMetaNames.indexOf(name) !== index
    );
    logWarningOrThrow(`routeMeta содержит дубликаты маршрутов: ${duplicates.join(', ')}`);
  }

  const missingInMeta = routeNames.filter((r) => !routeMetaNames.includes(r));
  if (missingInMeta.length > 0) {
    logWarningOrThrow(`ROUTES не имеют соответствующего META: ${missingInMeta.join(', ')}`);
  }

  const missingInRoutes = routeMetaNames.filter((r) => !routeNames.includes(r));
  if (missingInRoutes.length > 0) {
    logWarningOrThrow(
      `ROUTE_META содержит имена маршрутов отсутствующие в ROUTES: ${missingInRoutes.join(', ')}`,
    );
  }
}

// Выполняем проверки при импорте
validateRouteMetaConsistency();
validateFeatureFlags();
