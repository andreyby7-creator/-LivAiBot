/**
 * @file packages/app/src/lib/route-access.ts
 * ============================================================================
 * 🛣️ ROUTE ACCESS — ПРОВЕРКА ДОСТУПА К МАРШРУТАМ ДЛЯ UI
 * ============================================================================
 *
 * UI-специфичные утилиты для проверки доступа к маршрутам.
 * Используют core route-permissions для проверки доступа с учетом SSR.
 *
 * Архитектурная роль:
 * - UI-адаптер для core route-permissions в React компонентах
 * - SSR-safe проверка доступа без зависимости от контекста аутентификации
 * - Упрощенная проверка для навигационных компонентов
 *
 * Особенности:
 * - SSR-safe: консервативный результат в серверном окружении
 * - Упрощенный контекст: не учитывает реальные роли пользователя
 * - Path-based: определяет тип маршрута по пути автоматически
 *
 * Ограничения:
 * - Не использует реальный контекст аутентификации (только базовые проверки)
 * - Не учитывает customCheck из политик маршрутов
 * - Предназначен для предварительной фильтрации в UI, не для финальной авторизации
 */

import type {
  RouteInfo,
  RoutePermissionContext,
  RouteType,
} from '@livai/core/access-control/route-permissions';
import { checkRoutePermission } from '@livai/core/access-control/route-permissions';

/* ============================================================================
 * 🔍 INTERNAL ROUTE MATCHER — NOT PART OF PUBLIC API
 * ========================================================================== */

/** Auth-специфичные маршруты, которые не начинаются с /auth */
const AUTH_ROUTES = ['/login', '/register'] as const;

/**
 * Таблица сопоставления префиксов путей с типами маршрутов.
 * Порядок важен: более специфичные префиксы должны идти первыми.
 */
const ROUTE_MATCHERS: readonly [string, RouteType][] = [
  ['/auth', 'auth'],
  ['/dashboard', 'dashboard'],
  ['/admin', 'admin'],
  ['/api', 'api'],
  ['/profile', 'profile'],
  ['/settings', 'settings'],
] as const;

/** Определяет тип маршрута по пути. */
function getRouteTypeFromPath(
  routePath: string | null | undefined, // путь маршрута
): RouteType { // тип маршрута
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

  // Проверяем точные совпадения для auth routes
  if (AUTH_ROUTES.includes(trimmedPath as typeof AUTH_ROUTES[number])) {
    return 'auth';
  }

  // Проверяем префиксы через таблицу сопоставления
  for (const [prefix, routeType] of ROUTE_MATCHERS) {
    if (trimmedPath.startsWith(prefix)) {
      return routeType;
    }
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
 */
export function canAccessRoute(
  routePath: string, // путь маршрута
): boolean { // true если маршрут доступен, false иначе
  // Определяем тип маршрута по пути (один раз)
  const routeType = getRouteTypeFromPath(routePath);

  // SSR-safe: в серверном окружении показываем только публичные маршруты
  // чтобы избежать hydration mismatch из-за неизвестного статуса аутентификации
  if (typeof window === 'undefined') {
    // В SSR считаем доступными только публичные и auth маршруты
    return routeType === 'public' || routeType === 'auth';
  }

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
