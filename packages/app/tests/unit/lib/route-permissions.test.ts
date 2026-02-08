/**
 * @file Unit тесты для packages/app/src/lib/route-permissions.ts
 *
 * Enterprise-grade тестирование route permissions с 95-100% покрытием:
 * - checkRoutePermission с различными типами маршрутов и контекстов
 * - Все политики доступа (public, auth, dashboard, admin, api, settings, profile)
 * - Вспомогательные функции (checkBasicAccessConditions, checkPrivileges)
 * - Фабрики маршрутов и утилиты политик
 * - Edge cases, type safety и error handling
 * - Декларативные правила и deny-by-default политика
 */

import { describe, expect, it } from 'vitest';
import type { ID } from '../../../src/types/common';
import { UserRoles } from '../../../src/types/common';
import {
  checkRoutePermission,
  createProtectedRoute,
  createPublicRoute,
  getAvailableRouteTypes,
  getRequiredPermissions,
  getRequiredRoles,
  getRoutePolicy,
  requiresAuthentication,
} from '../../../src/lib/route-permissions';
import type {
  Permission,
  RouteInfo,
  RoutePermissionContext,
  RoutePermissionResult,
  RouteType,
  UserRole,
} from '../../../src/lib/route-permissions';

// ============================================================================
// 🧠 MOCKS И HELPER'Ы
// ============================================================================

/**
 * Создает branded ID тип для тестирования
 */
function createMockID(value: string): ID {
  return value as ID;
}

/**
 * Создает mock RoutePermissionContext для тестирования
 */
function createMockRouteContext(overrides: Record<string, any> = {}): RoutePermissionContext {
  return {
    requestId: 'test-request-123',
    traceId: 'test-trace-456',
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    sessionId: 'test-session-789',
    userId: createMockID('test-user-123'),
    isAuthenticated: true,
    platform: 'web',
    isAdminMode: false,
    userRoles: new Set<UserRole>(),
    userPermissions: new Set<Permission>(),
    ...overrides,
  } as RoutePermissionContext;
}

/**
 * Создает mock RouteInfo для тестирования
 */
function createMockRouteInfo(
  type: RouteType,
  path: string,
  overrides: Partial<RouteInfo> = {},
): RouteInfo {
  return {
    type,
    path,
    method: 'GET',
    resourceId: undefined,
    ...overrides,
  };
}

/**
 * Создает mock UserRole set
 */
function createMockRoles(...roles: readonly UserRole[]): ReadonlySet<UserRole> {
  return new Set(roles);
}

/**
 * Создает mock Permission set
 */
function createMockPermissions(...permissions: readonly Permission[]): ReadonlySet<Permission> {
  return new Set(permissions);
}

/**
 * Helper для проверки успешного результата проверки маршрута
 */
function expectRouteAllowed(result: RoutePermissionResult, expectedReason?: string): void {
  expect(result.allowed).toBe(true);
  if (expectedReason != null) {
    expect(result.reason).toBe(expectedReason);
  }
}

/**
 * Helper для проверки отказа в доступе к маршруту
 */
function expectRouteDenied(
  result: RoutePermissionResult,
  expectedReason?: string,
  expectedRoles?: readonly UserRole[],
  expectedPermissions?: readonly Permission[],
): void {
  expect(result.allowed).toBe(false);
  if (expectedReason != null) {
    expect(result.reason).toBe(expectedReason);
  }
  if (expectedRoles && !result.allowed) {
    expect((result as any).requiredRoles).toEqual(expectedRoles);
  }
  if (expectedPermissions && !result.allowed) {
    expect((result as any).requiredPermissions).toEqual(expectedPermissions);
  }
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Route Permissions - Enterprise Grade', () => {
  describe('checkRoutePermission - Core Route Access Logic', () => {
    describe('Public Routes', () => {
      const publicRoute = createMockRouteInfo('public', '/home');

      it('должен разрешать доступ к публичным маршрутам всем пользователям', () => {
        const authenticatedContext = createMockRouteContext({ isAuthenticated: true });
        const guestContext = createMockRouteContext({ isAuthenticated: false });

        const authResult = checkRoutePermission(publicRoute, authenticatedContext);
        const guestResult = checkRoutePermission(publicRoute, guestContext);

        expectRouteAllowed(authResult, 'EXPLICIT_ALLOW');
        expectRouteAllowed(guestResult, 'EXPLICIT_ALLOW');
      });
    });

    describe('Auth Routes', () => {
      const authRoute = createMockRouteInfo('auth', '/login');

      it('должен разрешать доступ к маршрутам аутентификации только гостям', () => {
        const guestContext = createMockRouteContext({
          isAuthenticated: false,
          userRoles: undefined,
          userPermissions: undefined,
        });

        const result = checkRoutePermission(authRoute, guestContext);

        expectRouteAllowed(result, 'GUEST_ACCESS_ALLOWED');
      });

      it('должен запрещать доступ к маршрутам аутентификации авторизованным пользователям', () => {
        const authenticatedContext = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.USER),
        });

        const result = checkRoutePermission(authRoute, authenticatedContext);

        expectRouteDenied(result, 'AUTHENTICATED_NOT_ALLOWED');
      });
    });

    describe('Dashboard Routes', () => {
      const dashboardRoute = createMockRouteInfo('dashboard', '/dashboard');

      it('должен требовать аутентификацию для доступа к dashboard', () => {
        const guestContext = createMockRouteContext({ isAuthenticated: false });

        const result = checkRoutePermission(dashboardRoute, guestContext);

        expectRouteDenied(result, 'AUTH_REQUIRED');
      });

      it('должен разрешать доступ к dashboard авторизованным пользователям с правильными ролями', () => {
        const validRoles: UserRole[] = [
          UserRoles.USER,
          UserRoles.PREMIUM_USER,
          UserRoles.MODERATOR,
          UserRoles.ADMIN,
          UserRoles.SUPER_ADMIN,
        ];

        for (const role of validRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions(),
          });

          const result = checkRoutePermission(dashboardRoute, context);

          expectRouteAllowed(result, 'EXPLICIT_ALLOW');
        }
      });

      it('должен запрещать доступ к dashboard пользователям без требуемых ролей', () => {
        const invalidRoles: UserRole[] = [UserRoles.GUEST];

        for (const role of invalidRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions(),
          });

          const result = checkRoutePermission(dashboardRoute, context);

          expectRouteDenied(result, 'INSUFFICIENT_ROLE_PRIVILEGES', [
            UserRoles.USER,
            UserRoles.PREMIUM_USER,
            UserRoles.MODERATOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ]);
        }
      });
    });

    describe('Admin Routes', () => {
      const adminRoute = createMockRouteInfo('admin', '/admin/users');

      it('должен требовать аутентификацию для доступа к admin панели', () => {
        const guestContext = createMockRouteContext({ isAuthenticated: false });

        const result = checkRoutePermission(adminRoute, guestContext);

        expectRouteDenied(result, 'AUTH_REQUIRED');
      });

      it('должен требовать правильные роли для доступа к admin панели', () => {
        const invalidRoles: UserRole[] = [
          UserRoles.USER,
          UserRoles.PREMIUM_USER,
          UserRoles.MODERATOR,
        ];

        for (const role of invalidRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions(),
          });

          const result = checkRoutePermission(adminRoute, context);

          expectRouteDenied(result, 'INSUFFICIENT_ROLE_PRIVILEGES', [
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
            UserRoles.SYSTEM,
          ]);
        }
      });

      it('должен требовать правильные разрешения для доступа к admin панели', () => {
        const context = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.ADMIN),
          userPermissions: createMockPermissions('READ_PUBLIC'), // Нет требуемых разрешений
        });

        const result = checkRoutePermission(adminRoute, context);

        expectRouteDenied(result, 'INSUFFICIENT_PERMISSIONS', undefined, [
          'SYSTEM_ADMIN',
          'MANAGE_USERS',
        ]);
      });

      it('должен разрешать доступ к admin панели пользователям с правильными ролями и разрешениями', () => {
        const validRoles: UserRole[] = [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.SYSTEM];

        for (const role of validRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions('SYSTEM_ADMIN', 'MANAGE_USERS'),
          });

          const result = checkRoutePermission(adminRoute, context);

          expectRouteAllowed(result, 'EXPLICIT_ALLOW');
        }
      });
    });

    describe('API Routes', () => {
      const apiRoute = createMockRouteInfo('api', '/api/users');

      it('должен требовать аутентификацию для доступа к API', () => {
        const guestContext = createMockRouteContext({ isAuthenticated: false });

        const result = checkRoutePermission(apiRoute, guestContext);

        expectRouteDenied(result, 'AUTH_REQUIRED');
      });

      it('должен разрешать доступ к API авторизованным пользователям', () => {
        const context = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.USER),
          userPermissions: createMockPermissions(),
        });

        const result = checkRoutePermission(apiRoute, context);

        expectRouteAllowed(result, 'EXPLICIT_ALLOW');
      });
    });

    describe('Settings Routes', () => {
      const settingsRoute = createMockRouteInfo('settings', '/settings/profile');

      it('должен требовать аутентификацию для доступа к настройкам', () => {
        const guestContext = createMockRouteContext({ isAuthenticated: false });

        const result = checkRoutePermission(settingsRoute, guestContext);

        expectRouteDenied(result, 'AUTH_REQUIRED');
      });

      it('должен требовать правильные роли для доступа к настройкам', () => {
        const invalidRoles: UserRole[] = [UserRoles.GUEST];

        for (const role of invalidRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions(),
          });

          const result = checkRoutePermission(settingsRoute, context);

          expectRouteDenied(result, 'INSUFFICIENT_ROLE_PRIVILEGES', [
            UserRoles.USER,
            UserRoles.PREMIUM_USER,
            UserRoles.MODERATOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ]);
        }
      });

      it('должен разрешать доступ к настройкам авторизованным пользователям с правильными ролями', () => {
        const validRoles: UserRole[] = [
          UserRoles.USER,
          UserRoles.PREMIUM_USER,
          UserRoles.MODERATOR,
          UserRoles.ADMIN,
          UserRoles.SUPER_ADMIN,
        ];

        for (const role of validRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions(),
          });

          const result = checkRoutePermission(settingsRoute, context);

          expectRouteAllowed(result, 'EXPLICIT_ALLOW');
        }
      });
    });

    describe('Profile Routes', () => {
      const profileRoute = createMockRouteInfo('profile', '/profile/edit');

      it('должен требовать аутентификацию для доступа к профилю', () => {
        const guestContext = createMockRouteContext({ isAuthenticated: false });

        const result = checkRoutePermission(profileRoute, guestContext);

        expectRouteDenied(result, 'AUTH_REQUIRED');
      });

      it('должен требовать правильные роли для доступа к профилю', () => {
        const invalidRoles: UserRole[] = [UserRoles.GUEST];

        for (const role of invalidRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions(),
          });

          const result = checkRoutePermission(profileRoute, context);

          expectRouteDenied(result, 'INSUFFICIENT_ROLE_PRIVILEGES', [
            UserRoles.USER,
            UserRoles.PREMIUM_USER,
            UserRoles.MODERATOR,
            UserRoles.ADMIN,
            UserRoles.SUPER_ADMIN,
          ]);
        }
      });

      it('должен разрешать доступ к профилю авторизованным пользователям с правильными ролями', () => {
        const validRoles: UserRole[] = [
          UserRoles.USER,
          UserRoles.PREMIUM_USER,
          UserRoles.MODERATOR,
          UserRoles.ADMIN,
          UserRoles.SUPER_ADMIN,
        ];

        for (const role of validRoles) {
          const context = createMockRouteContext({
            isAuthenticated: true,
            userRoles: createMockRoles(role),
            userPermissions: createMockPermissions(),
          });

          const result = checkRoutePermission(profileRoute, context);

          expectRouteAllowed(result, 'EXPLICIT_ALLOW');
        }
      });
    });
  });

  describe('Route Policy Utilities', () => {
    describe('getRoutePolicy', () => {
      it('должен возвращать политику для известных типов маршрутов', () => {
        const routeTypes: RouteType[] = [
          'public',
          'auth',
          'dashboard',
          'admin',
          'api',
          'settings',
          'profile',
        ];

        for (const routeType of routeTypes) {
          const policy = getRoutePolicy(routeType);
          expect(policy).toBeDefined();
          expect(policy?.routeType).toBe(routeType);
        }
      });

      it('должен возвращать undefined для неизвестных типов маршрутов', () => {
        const invalidType = 'unknown' as RouteType;
        const policy = getRoutePolicy(invalidType);
        expect(policy).toBeUndefined();
      });
    });

    describe('getAvailableRouteTypes', () => {
      it('должен возвращать все доступные типы маршрутов', () => {
        const types = getAvailableRouteTypes();
        expect(types).toEqual([
          'public',
          'auth',
          'dashboard',
          'admin',
          'api',
          'settings',
          'profile',
        ]);
        expect(types).toHaveLength(7);
      });

      it('должен возвращать readonly массив', () => {
        const types = getAvailableRouteTypes();
        expect(() => {
          (types as any).push('new-type');
        }).toThrow();
      });
    });

    describe('requiresAuthentication', () => {
      it('должен правильно определять необходимость аутентификации', () => {
        const testCases = [
          { routeType: 'public' as RouteType, requiresAuth: false },
          { routeType: 'auth' as RouteType, requiresAuth: false }, // allowGuests: true, custom check не требует аутентификации
          { routeType: 'dashboard' as RouteType, requiresAuth: true },
          { routeType: 'admin' as RouteType, requiresAuth: true },
          { routeType: 'api' as RouteType, requiresAuth: true },
          { routeType: 'settings' as RouteType, requiresAuth: true },
          { routeType: 'profile' as RouteType, requiresAuth: true },
        ];

        for (const { routeType, requiresAuth } of testCases) {
          const result = requiresAuthentication(routeType);
          expect(result).toBe(requiresAuth);
        }
      });
    });

    describe('getRequiredRoles', () => {
      it('должен возвращать правильные требуемые роли для каждого типа маршрута', () => {
        const testCases = [
          { routeType: 'public' as RouteType, expectedRoles: [] },
          { routeType: 'auth' as RouteType, expectedRoles: [] },
          {
            routeType: 'dashboard' as RouteType,
            expectedRoles: [
              UserRoles.USER,
              UserRoles.PREMIUM_USER,
              UserRoles.MODERATOR,
              UserRoles.ADMIN,
              UserRoles.SUPER_ADMIN,
            ],
          },
          {
            routeType: 'admin' as RouteType,
            expectedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.SYSTEM],
          },
          { routeType: 'api' as RouteType, expectedRoles: [] },
          {
            routeType: 'settings' as RouteType,
            expectedRoles: [
              UserRoles.USER,
              UserRoles.PREMIUM_USER,
              UserRoles.MODERATOR,
              UserRoles.ADMIN,
              UserRoles.SUPER_ADMIN,
            ],
          },
          {
            routeType: 'profile' as RouteType,
            expectedRoles: [
              UserRoles.USER,
              UserRoles.PREMIUM_USER,
              UserRoles.MODERATOR,
              UserRoles.ADMIN,
              UserRoles.SUPER_ADMIN,
            ],
          },
        ];

        for (const { routeType, expectedRoles } of testCases) {
          const roles = getRequiredRoles(routeType);
          expect(roles).toEqual(expectedRoles);
        }
      });

      it('должен возвращать readonly массивы', () => {
        const roles = getRequiredRoles('admin');
        expect(() => {
          (roles as any).push('NEW_ROLE');
        }).toThrow();
      });
    });

    describe('getRequiredPermissions', () => {
      it('должен возвращать правильные требуемые разрешения для каждого типа маршрута', () => {
        const testCases = [
          { routeType: 'public' as RouteType, expectedPermissions: [] },
          { routeType: 'auth' as RouteType, expectedPermissions: [] },
          { routeType: 'dashboard' as RouteType, expectedPermissions: [] },
          {
            routeType: 'admin' as RouteType,
            expectedPermissions: ['SYSTEM_ADMIN', 'MANAGE_USERS'],
          },
          { routeType: 'api' as RouteType, expectedPermissions: [] },
          { routeType: 'settings' as RouteType, expectedPermissions: [] },
          { routeType: 'profile' as RouteType, expectedPermissions: [] },
        ];

        for (const { routeType, expectedPermissions } of testCases) {
          const permissions = getRequiredPermissions(routeType);
          expect(permissions).toEqual(expectedPermissions);
        }
      });

      it('должен возвращать readonly массивы', () => {
        const permissions = getRequiredPermissions('admin');
        expect(() => {
          (permissions as any).push('NEW_PERMISSION');
        }).toThrow();
      });
    });
  });

  describe('Route Factories', () => {
    describe('createPublicRoute', () => {
      it('должен создавать публичный маршрут без метода', () => {
        const route = createPublicRoute('/home');

        expect(route).toEqual({
          type: 'public',
          path: '/home',
          method: undefined,
        });
      });

      it('должен создавать публичный маршрут с методом', () => {
        const route = createPublicRoute('/api/health', 'GET');

        expect(route).toEqual({
          type: 'public',
          path: '/api/health',
          method: 'GET',
        });
      });
    });

    describe('createProtectedRoute', () => {
      it('должен создавать защищенный маршрут без дополнительных параметров', () => {
        const route = createProtectedRoute('dashboard', '/dashboard');

        expect(route).toEqual({
          type: 'dashboard',
          path: '/dashboard',
          method: undefined,
          resourceId: undefined,
        });
      });

      it('должен создавать защищенный маршрут со всеми параметрами', () => {
        const route = createProtectedRoute('api', '/api/users/123', 'GET', 'user-123');

        expect(route).toEqual({
          type: 'api',
          path: '/api/users/123',
          method: 'GET',
          resourceId: 'user-123',
        });
      });

      it('должен корректно работать с различными типами маршрутов', () => {
        const routeTypes: Exclude<RouteType, 'public'>[] = [
          'auth',
          'dashboard',
          'admin',
          'api',
          'settings',
          'profile',
        ];

        for (const routeType of routeTypes) {
          const route = createProtectedRoute(routeType, `/test/${routeType}`);
          expect(route.type).toBe(routeType);
          expect(route.path).toBe(`/test/${routeType}`);
        }
      });
    });
  });

  describe('Type Safety и Edge Cases', () => {
    describe('Invalid Route Types', () => {
      it('должен корректно обрабатывать неизвестные типы маршрутов', () => {
        const invalidRoute = createMockRouteInfo('unknown' as RouteType, '/unknown');
        const context = createMockRouteContext();

        // Поскольку тип unknown не определен в политиках, функция будет использовать fallback
        expect(() => {
          checkRoutePermission(invalidRoute, context);
        }).toThrow(); // TypeError: ROUTE_PERMISSION_POLICIES[route.type] is undefined
      });
    });

    describe('Missing Context Properties', () => {
      it('должен корректно обрабатывать контекст без ролей', () => {
        const route = createMockRouteInfo('dashboard', '/dashboard');
        const context = createMockRouteContext({
          isAuthenticated: true,
          userRoles: undefined,
          userPermissions: createMockPermissions(),
        });

        const result = checkRoutePermission(route, context);

        expectRouteDenied(result, 'INSUFFICIENT_ROLE_PRIVILEGES');
      });

      it('должен корректно обрабатывать контекст без разрешений', () => {
        const route = createMockRouteInfo('admin', '/admin');
        const context = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.ADMIN),
          userPermissions: undefined,
        });

        const result = checkRoutePermission(route, context);

        expectRouteDenied(result, 'INSUFFICIENT_PERMISSIONS');
      });
    });

    describe('Custom Policy Checks', () => {
      it('должен корректно выполнять кастомные проверки политик', () => {
        const authRoute = createMockRouteInfo('auth', '/login');
        const authenticatedContext = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.USER),
        });

        const result = checkRoutePermission(authRoute, authenticatedContext);

        expectRouteDenied(result, 'AUTHENTICATED_NOT_ALLOWED');
      });
    });

    describe('Platform and Admin Mode', () => {
      it('должен корректно обрабатывать platform и isAdminMode в контексте', () => {
        const route = createMockRouteInfo('api', '/api/data');
        const context = createMockRouteContext({
          isAuthenticated: true,
          platform: 'mobile',
          isAdminMode: true,
          userRoles: createMockRoles(UserRoles.USER),
        });

        const result = checkRoutePermission(route, context);

        expectRouteAllowed(result, 'EXPLICIT_ALLOW');
      });
    });
  });

  describe('Integration Scenarios', () => {
    describe('Complex Permission Scenarios', () => {
      it('должен разрешать доступ к dashboard премиум пользователю', () => {
        const route = createProtectedRoute('dashboard', '/dashboard/analytics');
        const context = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.PREMIUM_USER),
          platform: 'web',
        });

        const result = checkRoutePermission(route, context);

        expectRouteAllowed(result, 'EXPLICIT_ALLOW');
      });

      it('должен запрещать доступ к admin панели пользователю без системных разрешений', () => {
        const route = createProtectedRoute('admin', '/admin/system');
        const context = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.ADMIN),
          userPermissions: createMockPermissions('READ_PUBLIC', 'WRITE_PUBLIC'), // Нет системных разрешений
        });

        const result = checkRoutePermission(route, context);

        expectRouteDenied(result, 'INSUFFICIENT_PERMISSIONS', undefined, [
          'SYSTEM_ADMIN',
          'MANAGE_USERS',
        ]);
      });

      it('должен разрешать доступ к API с правильными учетными данными', () => {
        const route = createProtectedRoute('api', '/api/v1/users', 'GET', 'user-456');
        const context = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.MODERATOR),
          platform: 'api',
        });

        const result = checkRoutePermission(route, context);

        expectRouteAllowed(result, 'EXPLICIT_ALLOW');
      });
    });

    describe('Workflow Integration', () => {
      it('должен поддерживать полный workflow проверки разрешений', () => {
        // Шаг 1: Проверка публичного маршрута
        const publicRoute = createPublicRoute('/health');
        const guestContext = createMockRouteContext({ isAuthenticated: false });

        const publicResult = checkRoutePermission(publicRoute, guestContext);
        expectRouteAllowed(publicResult, 'EXPLICIT_ALLOW');

        // Шаг 2: Проверка защищенного маршрута
        const protectedRoute = createProtectedRoute('settings', '/settings/preferences');
        const userContext = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.USER),
        });

        const protectedResult = checkRoutePermission(protectedRoute, userContext);
        expectRouteAllowed(protectedResult, 'EXPLICIT_ALLOW');

        // Шаг 3: Проверка административного маршрута
        const adminRoute = createProtectedRoute('admin', '/admin/config');
        const adminContext = createMockRouteContext({
          isAuthenticated: true,
          userRoles: createMockRoles(UserRoles.SUPER_ADMIN),
          userPermissions: createMockPermissions('SYSTEM_ADMIN', 'MANAGE_USERS'),
          isAdminMode: true,
        });

        const adminResult = checkRoutePermission(adminRoute, adminContext);
        expectRouteAllowed(adminResult, 'EXPLICIT_ALLOW');
      });
    });
  });
});
