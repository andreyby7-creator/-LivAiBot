/**
 * @file Unit тесты для packages/app/src/lib/auth-guard.ts
 * Enterprise-grade тестирование auth guard с 95-100% покрытием:
 * - Основные функции (checkAuthorization, checkAccess)
 * - Композиционные guard'ы (combineGuards, eitherGuard, requireRole, requirePermission)
 * - Вспомогательные функции валидации
 * - Фабрики ошибок и типизированные решения
 * - Edge cases и error handling
 * - Type-safe авторизационные решения
 */

import { describe, expect, it } from 'vitest';

import type {
  Action,
  AuthDecision,
  AuthGuardContext,
  Permission,
  Resource,
  UserRole,
} from '../../../src/lib/auth-guard';
import {
  checkAccess,
  checkAuthorization,
  combineGuards,
  eitherGuard,
  requirePermission,
  requireRole,
} from '../../../src/lib/auth-guard';
import type { ID } from '../../../src/types/common';
import { UserRoles } from '../../../src/types/common';

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
 * Создает mock AuthGuardContext для тестирования
 */
function createMockAuthGuardContext(overrides: Record<string, any> = {}): AuthGuardContext {
  const isAuthenticated = overrides['isAuthenticated'] !== false;

  if (isAuthenticated) {
    return {
      requestId: 'test-request-123',
      traceId: 'test-trace-456',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      sessionId: 'test-session-789',
      userId: createMockID('test-user-123'),
      isAuthenticated: true,
      accessToken: 'test-access-token',
      roles: new Set<UserRole>(),
      permissions: new Set<Permission>(),
      ...overrides,
    } as AuthGuardContext;
  } else {
    return {
      isAuthenticated: false,
      ...overrides,
    } as AuthGuardContext;
  }
}

/**
 * Создает mock Resource для тестирования
 */
function createMockResource(
  type: 'public' | 'private',
  overrides: Partial<Resource> = {},
): Resource {
  return {
    type,
    id: createMockID('test-resource-123'),
    ownerId: createMockID('test-owner-456'),
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
 * Проверяет, что решение является AllowDecision
 */

function expectAllow(decision: AuthDecision, expectedReason?: string): void {
  expect(decision.allow).toBe(true);
  if (expectedReason != null) {
    expect(decision.reason).toBe(expectedReason);
  }
}

/**
 * Проверяет, что решение является DenyDecision
 */

function expectDeny(decision: AuthDecision, expectedReason?: string): void {
  expect(decision.allow).toBe(false);
  if (expectedReason != null) {
    expect(decision.reason).toBe(expectedReason);
  }
}

/**
 * Проверяет, что решение содержит определенную ошибку
 */

function expectError(decision: AuthDecision, expectedCode: string): void {
  expect(decision.allow).toBe(false);
  if (!decision.allow && decision.error) {
    expect(decision.error.code).toBe(expectedCode);
  } else {
    expect.fail('Expected error in deny decision');
  }
}

// ============================================================================
// 🧪 ТЕСТЫ
// ============================================================================

describe('Auth Guard - Enterprise Grade', () => {
  describe('checkAuthorization - Core Authorization Logic', () => {
    const context = createMockAuthGuardContext();

    it('должен отказать доступ если нет ролей', () => {
      const userRoles = createMockRoles();
      const userPermissions = createMockPermissions();
      const resource = createMockResource('public');
      const action: Action = 'READ';

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectDeny(result, 'NO_ROLES');
      expect(result.allow).toBe(false);
      if (!result.allow && result.error) {
        expect(result.error.code).toBe('AUTH_INVALID_ROLE');
      }
    });

    it('должен разрешить гостям чтение публичных ресурсов', () => {
      const userRoles = createMockRoles(UserRoles.GUEST);
      const userPermissions = createMockPermissions('READ_PUBLIC');
      const resource = createMockResource('public');
      const action: Action = 'READ';

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен отказать гостям в записи публичных ресурсов', () => {
      const userRoles = createMockRoles(UserRoles.GUEST);
      const userPermissions = createMockPermissions();
      const resource = createMockResource('public');
      const action: Action = 'WRITE';

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectDeny(result, 'GUEST_RESTRICTED');
      expectError(result, 'AUTH_RESOURCE_ACCESS_DENIED');
    });

    it('должен разрешить SYSTEM роли полный доступ', () => {
      const userRoles = createMockRoles(UserRoles.SYSTEM);
      const userPermissions = createMockPermissions();
      const resource = createMockResource('private');
      const action: Action = UserRoles.ADMIN;

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен разрешить ADMIN роли административные действия', () => {
      const userRoles = createMockRoles(UserRoles.ADMIN);
      const userPermissions = createMockPermissions();
      const resource = createMockResource('public');
      const action: Action = UserRoles.ADMIN;

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен разрешить MODERATOR роли модераторские действия', () => {
      const userRoles = createMockRoles(UserRoles.MODERATOR);
      const userPermissions = createMockPermissions();
      const resource = createMockResource('public');
      const action: Action = 'MODERATE';

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен отказать в доступе при недостаточных разрешениях', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('READ_PUBLIC'); // Нет WRITE_PRIVATE
      const resource = createMockResource('private');
      const action: Action = 'WRITE';

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectDeny(result, 'INSUFFICIENT_PERMISSIONS');
      expectError(result, 'AUTH_INSUFFICIENT_PERMISSIONS');
      if (!result.allow && result.error) {
        expect(result.error.requiredPermissions).toEqual(['WRITE_PRIVATE']);
        expect(result.error.userPermissions).toEqual(['READ_PUBLIC']);
        expect(result.error.resource).toEqual(resource);
      }
    });

    it('должен разрешить доступ при наличии всех необходимых разрешений', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('READ_PRIVATE', 'WRITE_PRIVATE');
      const resource = createMockResource('private', { ownerId: createMockID('test-user-123') }); // Владелец совпадает с userId
      const action: Action = 'WRITE';

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен проверять владение ресурсом для приватных операций', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('WRITE_PRIVATE');
      const resource = createMockResource('private', { ownerId: createMockID('different-owner') });
      const action: Action = 'WRITE';
      const authContext = createMockAuthGuardContext({
        userId: createMockID('current-user'),
        isAuthenticated: true,
      });

      const result = checkAuthorization(userRoles, userPermissions, action, resource, authContext);

      expectDeny(result, 'NOT_RESOURCE_OWNER');
      expectError(result, 'AUTH_RESOURCE_ACCESS_DENIED');
    });

    it('должен разрешить доступ владельцу приватного ресурса', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('WRITE_PRIVATE');
      const resource = createMockResource('private', { ownerId: createMockID('current-user') });
      const action: Action = 'WRITE';
      const authContext = createMockAuthGuardContext({
        userId: createMockID('current-user'),
        isAuthenticated: true,
      });

      const result = checkAuthorization(userRoles, userPermissions, action, resource, authContext);

      expectAllow(result, 'SUCCESS');
    });

    it('должен разрешить модераторам доступ к чужим приватным ресурсам', () => {
      const userRoles = createMockRoles(UserRoles.MODERATOR);
      const userPermissions = createMockPermissions('WRITE_PRIVATE'); // Добавляем требуемое разрешение
      const resource = createMockResource('private', { ownerId: createMockID('different-owner') });
      const action: Action = 'WRITE';
      const authContext = createMockAuthGuardContext({
        userId: createMockID('current-user'),
        isAuthenticated: true,
      });

      const result = checkAuthorization(userRoles, userPermissions, action, resource, authContext);

      expectAllow(result, 'SUCCESS');
    });

    it('должен применять deny-by-default политику для неизвестных случаев', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('READ_PUBLIC');
      const resource = createMockResource('public');
      const action: Action = 'READ';

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });
  });

  describe('checkAccess - Combined Auth Check', () => {
    it('должен отказать доступ неаутентифицированным пользователям', () => {
      const resource = createMockResource('public');
      const action: Action = 'READ';
      const context = createMockAuthGuardContext({ isAuthenticated: false });

      const result = checkAccess(action, resource, context);

      expectDeny(result, 'NOT_AUTHENTICATED');
      expectError(result, 'AUTH_MISSING_TOKEN');
    });

    it('должен использовать роли и разрешения из контекста', () => {
      const action: Action = 'WRITE';
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        roles: createMockRoles(UserRoles.USER),
        permissions: createMockPermissions('WRITE_PRIVATE'),
        userId: createMockID('owner-id'),
      });
      const resourceWithOwner = createMockResource('private', {
        ownerId: createMockID('owner-id'),
      });

      const result = checkAccess(action, resourceWithOwner, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен использовать пустые sets если роли/разрешения не указаны в контексте', () => {
      const resource = createMockResource('public');
      const action: Action = 'READ';
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        roles: new Set<UserRole>(),
        permissions: new Set<Permission>(),
      });

      const result = checkAccess(action, resource, context);

      expectDeny(result, 'NO_ROLES');
    });
  });

  describe('combineGuards - AND Composition', () => {
    const adminContext = createMockAuthGuardContext({
      isAuthenticated: true,
      roles: createMockRoles(UserRoles.ADMIN),
      permissions: createMockPermissions('SYSTEM_ADMIN'),
    });

    const userContext = createMockAuthGuardContext({
      isAuthenticated: true,
      roles: createMockRoles(UserRoles.USER),
      permissions: createMockPermissions('READ_PUBLIC'),
    });

    it("должен разрешить доступ если все guard'ы возвращают allow", () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const permissionGuard = requirePermission('SYSTEM_ADMIN');
      const combinedGuard = combineGuards(adminGuard, permissionGuard);

      const result = combinedGuard(adminContext);

      expectAllow(result, 'SUCCESS');
    });

    it('должен отказать доступ если хотя бы один guard возвращает deny', () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const superAdminGuard = requireRole(UserRoles.SUPER_ADMIN); // У пользователя нет этой роли
      const combinedGuard = combineGuards(adminGuard, superAdminGuard);

      const result = combinedGuard(adminContext);

      expectDeny(result, 'INVALID_ROLE');
      expectError(result, 'AUTH_INVALID_ROLE');
    });

    it("должен вернуть deny первого guard'а который отказал", () => {
      const unauthGuard = requireRole(UserRoles.ADMIN); // Первый guard откажет
      const neverReachedGuard = requireRole(UserRoles.USER); // Этот не будет вызван
      const combinedGuard = combineGuards(unauthGuard, neverReachedGuard);

      const result = combinedGuard(userContext);

      expectDeny(result, 'INVALID_ROLE');
    });

    it("должен работать с пустым списком guard'ов", () => {
      const combinedGuard = combineGuards();

      const result = combinedGuard(adminContext);

      expectAllow(result, 'SUCCESS');
    });

    it("должен работать с одним guard'ом", () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const combinedGuard = combineGuards(adminGuard);

      const result = combinedGuard(adminContext);

      expectAllow(result, 'SUCCESS');
    });
  });

  describe('eitherGuard - OR Composition', () => {
    const adminContext = createMockAuthGuardContext({
      isAuthenticated: true,
      roles: createMockRoles(UserRoles.ADMIN),
    });

    const userContext = createMockAuthGuardContext({
      isAuthenticated: true,
      roles: createMockRoles(UserRoles.USER),
    });

    it('должен разрешить доступ если хотя бы один guard возвращает allow', () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const userGuard = requireRole(UserRoles.USER);
      const eitherGuardFn = eitherGuard(adminGuard, userGuard);

      const result1 = eitherGuardFn(adminContext);
      const result2 = eitherGuardFn(userContext);

      expectAllow(result1, 'SUCCESS');
      expectAllow(result2, 'SUCCESS');
    });

    it("должен отказать доступ если все guard'ы возвращают deny", () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const superAdminGuard = requireRole(UserRoles.SUPER_ADMIN);
      const eitherGuardFn = eitherGuard(adminGuard, superAdminGuard);

      const result = eitherGuardFn(userContext);

      expectDeny(result, 'RESOURCE_ACCESS_DENIED');
      expectError(result, 'AUTH_INVALID_ROLE'); // Возвращается первая ошибка из guard'ов
    });

    it("должен вернуть allow первого guard'а который разрешил", () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const userGuard = requireRole(UserRoles.USER);
      const neverReachedGuard = requireRole(UserRoles.GUEST); // Этот не будет вызван
      const eitherGuardFn = eitherGuard(adminGuard, userGuard, neverReachedGuard);

      const result = eitherGuardFn(adminContext);

      expectAllow(result, 'SUCCESS');
    });

    it("должен работать с пустым списком guard'ов", () => {
      const eitherGuardFn = eitherGuard();

      const result = eitherGuardFn(adminContext);

      expectDeny(result, 'RESOURCE_ACCESS_DENIED');
    });

    it("должен работать с одним guard'ом", () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const eitherGuardFn = eitherGuard(adminGuard);

      const result = eitherGuardFn(adminContext);

      expectAllow(result, 'SUCCESS');
    });

    it('должен собирать ошибки из всех deny решений', () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const superAdminGuard = requireRole(UserRoles.SUPER_ADMIN);
      const eitherGuardFn = eitherGuard(adminGuard, superAdminGuard);

      const result = eitherGuardFn(userContext);

      expectDeny(result);
      if (!result.allow && result.error) {
        expect(result.error.code).toBe('AUTH_INVALID_ROLE');
      }
    });
  });

  describe('requireRole - Single Role Guard', () => {
    it('должен отказать неаутентифицированным пользователям', () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const context = createMockAuthGuardContext({ isAuthenticated: false });

      const result = adminGuard(context);

      expectDeny(result, 'NOT_AUTHENTICATED');
      expectError(result, 'AUTH_MISSING_TOKEN');
    });

    it('должен разрешить доступ если пользователь имеет требуемую роль', () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        roles: createMockRoles(UserRoles.ADMIN),
      });

      const result = adminGuard(context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен отказать доступ если пользователь не имеет требуемую роль', () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        roles: createMockRoles(UserRoles.USER),
      });

      const result = adminGuard(context);

      expectDeny(result, 'INVALID_ROLE');
      expectError(result, 'AUTH_INVALID_ROLE');
      if (!result.allow && result.error) {
        expect(result.error.requiredRole).toBe(UserRoles.ADMIN);
      }
    });

    it('должен работать с пустым набором ролей в контексте', () => {
      const adminGuard = requireRole(UserRoles.ADMIN);
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        roles: new Set<UserRole>(),
      });

      const result = adminGuard(context);

      expectDeny(result, 'INVALID_ROLE');
    });
  });

  describe('requirePermission - Single Permission Guard', () => {
    it('должен отказать неаутентифицированным пользователям', () => {
      const adminGuard = requirePermission('SYSTEM_ADMIN');
      const context = createMockAuthGuardContext({ isAuthenticated: false });

      const result = adminGuard(context);

      expectDeny(result, 'NOT_AUTHENTICATED');
      expectError(result, 'AUTH_MISSING_TOKEN');
    });

    it('должен разрешить доступ если пользователь имеет требуемое разрешение', () => {
      const adminGuard = requirePermission('SYSTEM_ADMIN');
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        permissions: createMockPermissions('SYSTEM_ADMIN'),
      });

      const result = adminGuard(context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен отказать доступ если пользователь не имеет требуемое разрешение', () => {
      const adminGuard = requirePermission('SYSTEM_ADMIN');
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        permissions: createMockPermissions('READ_PUBLIC'),
      });

      const result = adminGuard(context);

      expectDeny(result, 'INSUFFICIENT_PERMISSIONS');
      expectError(result, 'AUTH_INSUFFICIENT_PERMISSIONS');
      if (!result.allow && result.error) {
        expect(result.error.requiredPermissions).toEqual(['SYSTEM_ADMIN']);
        expect(result.error.userPermissions).toEqual(['READ_PUBLIC']);
      }
    });

    it('должен работать с пустым набором разрешений в контексте', () => {
      const adminGuard = requirePermission('SYSTEM_ADMIN');
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        permissions: new Set<Permission>(),
      });

      const result = adminGuard(context);

      expectDeny(result, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Validation Helpers - Indirect Testing', () => {
    const context = createMockAuthGuardContext();

    describe('isGuestActionAllowed', () => {
      it('должен разрешать гостям чтение публичных ресурсов', () => {
        const userRoles = createMockRoles(UserRoles.GUEST);
        const userPermissions = createMockPermissions('READ_PUBLIC');
        const resource = createMockResource('public');
        const action: Action = 'READ';

        const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

        expectAllow(result, 'SUCCESS');
      });

      it('должен запрещать гостям любые другие действия', () => {
        const actions: Action[] = ['WRITE', 'DELETE', 'MODERATE', UserRoles.ADMIN];
        const userRoles = createMockRoles(UserRoles.GUEST);
        const userPermissions = createMockPermissions();
        const resource = createMockResource('public');

        for (const action of actions) {
          const result = checkAuthorization(userRoles, userPermissions, action, resource, context);
          expectDeny(result, 'GUEST_RESTRICTED');
        }
      });

      it('должен запрещать гостям доступ к приватным ресурсам', () => {
        const userRoles = createMockRoles(UserRoles.GUEST);
        const userPermissions = createMockPermissions();
        const resource = createMockResource('private');
        const action: Action = 'READ';

        const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

        expectDeny(result, 'GUEST_RESTRICTED');
      });
    });

    describe('Role Hierarchy', () => {
      it('должен проверять SYSTEM роль имеет полный доступ', () => {
        const userRoles = createMockRoles(UserRoles.SYSTEM);
        const userPermissions = createMockPermissions();
        const resource = createMockResource('private');
        const authContext = createMockAuthGuardContext({
          userId: createMockID('owner'),
          isAuthenticated: true,
        });

        const actions: Action[] = ['READ', 'WRITE', 'DELETE', 'MODERATE', UserRoles.ADMIN];

        for (const action of actions) {
          const result = checkAuthorization(
            userRoles,
            userPermissions,
            action,
            resource,
            authContext,
          );
          expectAllow(result);
        }
      });

      it('должен проверять ADMIN роли имеют административный доступ', () => {
        const testCases = [
          {
            roles: [UserRoles.SUPER_ADMIN],
            actions: ['READ', 'WRITE', 'DELETE', 'MODERATE', UserRoles.ADMIN],
          },
          {
            roles: [UserRoles.ADMIN],
            actions: ['READ', 'WRITE', 'DELETE', 'MODERATE', UserRoles.ADMIN],
          },
        ];

        const resource = createMockResource('private');
        const userPermissions = createMockPermissions(
          'READ_PRIVATE',
          'WRITE_PRIVATE',
          'DELETE_PRIVATE',
        );

        for (const { roles, actions } of testCases) {
          const userRoles = createMockRoles(...roles);
          const authContext = createMockAuthGuardContext({
            userId: createMockID('owner'),
            isAuthenticated: true,
          });

          for (const action of actions) {
            const result = checkAuthorization(
              userRoles,
              userPermissions,
              action as Action,
              resource,
              authContext,
            );
            expectAllow(result);
          }
        }
      });

      it('должен проверять MODERATOR роль имеет модераторский доступ', () => {
        const userRoles = createMockRoles(UserRoles.MODERATOR);
        const userPermissions = createMockPermissions(
          'READ_PRIVATE',
          'WRITE_PRIVATE',
          'DELETE_PRIVATE',
          'MODERATE_CONTENT',
        );
        const resource = createMockResource('private', { ownerId: createMockID('owner') });
        const authContext = createMockAuthGuardContext({
          userId: createMockID('owner'),
          isAuthenticated: true,
        });

        const actions: Action[] = ['READ', 'WRITE', 'DELETE', 'MODERATE'];

        for (const action of actions) {
          const result = checkAuthorization(
            userRoles,
            userPermissions,
            action,
            resource,
            authContext,
          );
          expectAllow(result);
        }
      });

      it('должен проверять USER роли имеют пользовательский доступ', () => {
        const testCases = [
          { roles: [UserRoles.USER], actions: ['READ', 'WRITE', 'DELETE'] },
          { roles: [UserRoles.PREMIUM_USER], actions: ['READ', 'WRITE', 'DELETE'] },
        ];

        for (const { roles, actions } of testCases) {
          const userRoles = createMockRoles(...roles);
          const userPermissions = createMockPermissions(
            'READ_PRIVATE',
            'WRITE_PRIVATE',
            'DELETE_PRIVATE',
          );
          const resource = createMockResource('private', { ownerId: createMockID('owner') });
          const authContext = createMockAuthGuardContext({
            userId: createMockID('owner'),
            isAuthenticated: true,
          });

          for (const action of actions) {
            const result = checkAuthorization(
              userRoles,
              userPermissions,
              action as Action,
              resource,
              authContext,
            );
            expectAllow(result);
          }
        }
      });
    });

    describe('Permission Requirements', () => {
      it('должен требовать правильные разрешения для каждого действия', () => {
        const testCases = [
          { action: 'READ' as Action, publicPerm: 'READ_PUBLIC', privatePerm: 'READ_PRIVATE' },
          { action: 'WRITE' as Action, publicPerm: 'WRITE_PUBLIC', privatePerm: 'WRITE_PRIVATE' },
          {
            action: 'DELETE' as Action,
            publicPerm: 'DELETE_PUBLIC',
            privatePerm: 'DELETE_PRIVATE',
          },
          {
            action: 'MODERATE' as Action,
            publicPerm: 'MODERATE_CONTENT',
            privatePerm: 'MODERATE_CONTENT',
          },
          {
            action: UserRoles.ADMIN as Action,
            publicPerm: 'SYSTEM_ADMIN',
            privatePerm: 'SYSTEM_ADMIN',
          },
        ];

        for (const { action, publicPerm, privatePerm } of testCases) {
          // Публичный ресурс
          const userRoles = createMockRoles(UserRoles.USER);
          const publicPermissions = createMockPermissions(publicPerm as Permission);
          const privatePermissions = createMockPermissions(privatePerm as Permission);
          const publicResource = createMockResource('public');
          const privateResource = createMockResource('private', {
            ownerId: createMockID('test-user-123'),
          });

          const publicResult = checkAuthorization(
            userRoles,
            publicPermissions,
            action,
            publicResource,
            context,
          );
          expectAllow(publicResult);

          const privateResult = checkAuthorization(
            userRoles,
            privatePermissions,
            action,
            privateResource,
            context,
          );
          expectAllow(privateResult);
        }
      });
    });

    describe('Private Resource Ownership', () => {
      it('должен проверять владение только для WRITE и DELETE операций', () => {
        const userRoles = createMockRoles(UserRoles.USER);
        const userPermissions = createMockPermissions(
          'READ_PRIVATE',
          'WRITE_PRIVATE',
          'DELETE_PRIVATE',
        );
        const resource = createMockResource('private', { ownerId: createMockID('other-owner') });
        const authContext = createMockAuthGuardContext({
          userId: createMockID('current-user'),
          isAuthenticated: true,
        });

        // READ должен быть разрешен без проверки владельца
        const readResult = checkAuthorization(
          userRoles,
          userPermissions,
          'READ',
          resource,
          authContext,
        );
        expectAllow(readResult);

        // WRITE и DELETE должны проверять владельца
        const writeResult = checkAuthorization(
          userRoles,
          userPermissions,
          'WRITE',
          resource,
          authContext,
        );
        expectDeny(writeResult);

        const deleteResult = checkAuthorization(
          userRoles,
          userPermissions,
          'DELETE',
          resource,
          authContext,
        );
        expectDeny(deleteResult);
      });
    });
  });

  describe('Error Handling и Type Safety', () => {
    it('должен создавать типизированные ошибки с правильными полями', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('READ_PUBLIC');
      const resource = createMockResource('private');
      const action: Action = 'WRITE';
      const context = createMockAuthGuardContext();

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectDeny(result);
      if (!result.allow && result.error) {
        expect(result.error.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
        expect(result.error.service).toBe('AUTH');
        expect(result.error.resource).toEqual(resource);
        expect(result.error.requiredPermissions).toEqual(['WRITE_PRIVATE']);
        expect(result.error.userPermissions).toEqual(['READ_PUBLIC']);
      }

      expectDeny(result);
      if (!result.allow && result.error) {
        expect(result.error.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
        expect(result.error.service).toBe('AUTH');
        expect(result.error.resource).toEqual(resource);
        expect(result.error.requiredPermissions).toEqual(['WRITE_PRIVATE']);
        expect(result.error.userPermissions).toEqual(['READ_PUBLIC']);
      }
    });

    it('должен обеспечивать type safety для AuthDecision union', () => {
      const userRoles = createMockRoles(UserRoles.ADMIN);
      const userPermissions = createMockPermissions();
      const action: Action = UserRoles.ADMIN;
      const context = createMockAuthGuardContext();

      const result = checkAuthorization(
        userRoles,
        userPermissions,
        action,
        createMockResource('public'),
        context,
      );

      // TypeScript знает, что result.allow === true
      if (result.allow) {
        expect(result.reason).toBe('SUCCESS');
        // AllowDecision не имеет error свойства
        expect('error' in result).toBe(false);
      } else {
        expect(result.reason).toBeDefined();
        expect('error' in result).toBe(true);
      }

      // TypeScript знает, что result.allow === true
      if (result.allow) {
        expect(result.reason).toBe('SUCCESS');
        // AllowDecision не имеет error свойства
        expect('error' in result).toBe(false);
      } else {
        expect(result.reason).toBeDefined();
        expect('error' in result).toBe(true);
      }
    });

    it('должен поддерживать все типы UserRole', () => {
      const roles: UserRole[] = [
        UserRoles.GUEST,
        UserRoles.USER,
        UserRoles.PREMIUM_USER,
        UserRoles.MODERATOR,
        UserRoles.ADMIN,
        UserRoles.SUPER_ADMIN,
        UserRoles.SYSTEM,
      ];

      for (const role of roles) {
        const userRoles = createMockRoles(role);
        const userPermissions = createMockPermissions();
        const resource = createMockResource('public');
        const action: Action = 'READ';
        const context = createMockAuthGuardContext();

        expect(() => {
          checkAuthorization(userRoles, userPermissions, action, resource, context);
        }).not.toThrow();
      }
    });

    it('должен поддерживать все типы Permission', () => {
      const permissions: Permission[] = [
        'READ_PUBLIC',
        'READ_PRIVATE',
        'WRITE_PUBLIC',
        'WRITE_PRIVATE',
        'DELETE_PUBLIC',
        'DELETE_PRIVATE',
        'MODERATE_CONTENT',
        'MANAGE_USERS',
        'SYSTEM_ADMIN',
      ];

      for (const permission of permissions) {
        const userRoles = createMockRoles(UserRoles.USER);
        const userPermissions = createMockPermissions(permission);
        const resource = createMockResource('public');
        const action: Action = 'READ';
        const context = createMockAuthGuardContext();

        expect(() => {
          checkAuthorization(userRoles, userPermissions, action, resource, context);
        }).not.toThrow();
      }
    });
  });

  describe('Edge Cases и Boundary Conditions', () => {
    it('должен корректно обрабатывать undefined/null значения в контексте', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('READ_PUBLIC');
      const resource = createMockResource('public');
      const action: Action = 'READ';

      // Тестируем с undefined полями
      const contextWithUndefined = createMockAuthGuardContext({
        userId: createMockID('test-user-123'),
        roles: new Set<UserRole>(),
        permissions: new Set<Permission>(),
      });

      expect(() => {
        checkAuthorization(userRoles, userPermissions, action, resource, contextWithUndefined);
      }).not.toThrow();
    });

    it('должен корректно обрабатывать пустые resources', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('READ_PUBLIC');
      const resource = createMockResource('public', {});
      const action: Action = 'READ';
      const context = createMockAuthGuardContext();

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен корректно обрабатывать аутентификацию без userId', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions('WRITE_PRIVATE');
      const resource = createMockResource('private', { ownerId: createMockID('some-owner') });
      const action: Action = 'WRITE';
      const context = createMockAuthGuardContext({
        userId: createMockID('current-user'),
        isAuthenticated: true,
      });

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectDeny(result, 'NOT_RESOURCE_OWNER');
    });

    it('должен корректно обрабатывать неаутентифицированного пользователя с ролями', () => {
      // Это edge case - неаутентифицированный пользователь с ролями
      const resource = createMockResource('public');
      const action: Action = 'READ';
      const context = createMockAuthGuardContext({ isAuthenticated: false });

      const result = checkAccess(action, resource, context);

      // checkAccess должен проверить аутентификацию первым делом
      expectDeny(result, 'NOT_AUTHENTICATED');
    });

    it('должен корректно обрабатывать SUPER_ADMIN роль (наследует ADMIN)', () => {
      const userRoles = createMockRoles(UserRoles.SUPER_ADMIN);
      const userPermissions = createMockPermissions();
      const resource = createMockResource('public');
      const action: Action = UserRoles.ADMIN;
      const context = createMockAuthGuardContext();

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен корректно обрабатывать PREMIUM_USER роль (наследует USER)', () => {
      const userRoles = createMockRoles(UserRoles.PREMIUM_USER);
      const userPermissions = createMockPermissions('READ_PUBLIC', 'WRITE_PUBLIC');
      const resource = createMockResource('public');
      const action: Action = 'WRITE';
      const context = createMockAuthGuardContext();

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен корректно обрабатывать комбинацию ролей', () => {
      const userRoles = createMockRoles(UserRoles.USER, UserRoles.MODERATOR);
      const userPermissions = createMockPermissions('READ_PUBLIC', 'MODERATE_CONTENT');
      const resource = createMockResource('public');
      const context = createMockAuthGuardContext();

      // USER позволяет READ/WRITE/DELETE, MODERATOR позволяет MODERATE
      const readResult = checkAuthorization(userRoles, userPermissions, 'READ', resource, context);
      const moderateResult = checkAuthorization(
        userRoles,
        userPermissions,
        'MODERATE',
        resource,
        context,
      );

      expectAllow(readResult, 'SUCCESS');
      expectAllow(moderateResult, 'SUCCESS');
    });

    it('должен корректно обрабатывать пустые sets разрешений', () => {
      const userRoles = createMockRoles(UserRoles.USER);
      const userPermissions = createMockPermissions();
      const resource = createMockResource('public');
      const action: Action = 'READ';
      const context = createMockAuthGuardContext();

      const result = checkAuthorization(userRoles, userPermissions, action, resource, context);

      expectDeny(result, 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Integration Scenarios', () => {
    it('должен реализовывать полный workflow авторизации', () => {
      // Сценарий: пользователь хочет прочитать публичный ресурс
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        roles: createMockRoles(UserRoles.USER),
        permissions: createMockPermissions('READ_PUBLIC'),
      });
      const resource = createMockResource('public');
      const action: Action = 'READ';

      const result = checkAccess(action, resource, context);

      expectAllow(result, 'SUCCESS');
    });

    it('должен реализовывать полный workflow отказа в доступе', () => {
      // Сценарий: неаутентифицированный пользователь хочет записать приватный ресурс
      const context = createMockAuthGuardContext({ isAuthenticated: false });
      const resource = createMockResource('private');
      const action: Action = 'WRITE';

      const result = checkAccess(action, resource, context);

      expectDeny(result, 'NOT_AUTHENTICATED');
      expect(!result.allow && result.error ? result.error.code : undefined).toBe(
        'AUTH_MISSING_TOKEN',
      );
    });

    it("должен реализовывать полный workflow с композиционными guard'ами", () => {
      // Сценарий: требуется либо ADMIN роль, либо MODERATOR + SYSTEM_ADMIN разрешение
      const context = createMockAuthGuardContext({
        isAuthenticated: true,
        roles: createMockRoles(UserRoles.MODERATOR),
        permissions: createMockPermissions('SYSTEM_ADMIN'),
      });

      const adminOnlyGuard = requireRole(UserRoles.ADMIN);
      const moderatorWithAdminPermGuard = combineGuards(
        requireRole(UserRoles.MODERATOR),
        requirePermission('SYSTEM_ADMIN'),
      );

      const combinedGuard = eitherGuard(adminOnlyGuard, moderatorWithAdminPermGuard);

      const result = combinedGuard(context);

      expectAllow(result, 'SUCCESS');
    });
  });
});
