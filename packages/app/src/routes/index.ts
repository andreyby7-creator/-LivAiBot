/**
 * @file packages/app/src/routes — Routes & Navigation
 *
 * Публичный API пакета routes.
 * Экспортирует все публичные типы, константы и утилиты для маршрутизации и навигации.
 */

/* ============================================================================
 * 🛣️ ROUTES — МАРШРУТЫ
 * ========================================================================== */

/**
 * Routes: конфигурация маршрутов приложения с типами и утилитами.
 *
 * @public
 */
export {
  getRouteByName,
  getRoutesForRole,
  type RouteName,
  type RouteNameKey,
  RouteNames,
  ROUTES,
} from './routes.js';

/* ============================================================================
 * 📋 ROUTE META — МЕТАДАННЫЕ МАРШРУТОВ
 * ========================================================================== */

/**
 * Route Meta: метаданные маршрутов с проверкой доступа и feature flags.
 *
 * @public
 */
export {
  canAccessRouteByName,
  checkComprehensiveRouteAccess,
  FeatureFlags as RouteFeatureFlags,
  filterRoutes,
  getRouteMeta,
  type RouteAccessResult,
  type RouteMeta,
  routeMeta,
} from './route-meta.js';

/* ============================================================================
 * 🧭 NAVIGATION — НАВИГАЦИЯ
 * ========================================================================== */

/**
 * Navigation: конфигурация навигации с типами элементов и контекстом.
 *
 * @public
 */
export {
  getNavigationForContext,
  NAVIGATION,
  type NavigationBadge,
  type NavigationBadgeSource,
  type NavigationContext,
  type NavigationDivider,
  type NavigationGroup,
  type NavigationItem,
  type NavigationItemType,
  type NavigationLink,
  type NavigationPlacement,
} from './navigation.js';
