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
  RouteNames,
  ROUTES,
  getRouteByName,
  getRoutesForRole,
  type RouteNameKey,
  type RouteName,
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
  routeMeta,
  FeatureFlags as RouteFeatureFlags,
  getRouteMeta,
  canAccessRouteByName,
  checkComprehensiveRouteAccess,
  filterRoutes,
  type RouteAccessResult,
  type RouteMeta,
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
  NAVIGATION,
  getNavigationForContext,
  type NavigationPlacement,
  type NavigationItemType,
  type NavigationBadgeSource,
  type NavigationBadge,
  type NavigationLink,
  type NavigationGroup,
  type NavigationDivider,
  type NavigationItem,
  type NavigationContext,
} from './navigation.js';
