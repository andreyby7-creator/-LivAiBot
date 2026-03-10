/**
 * @file Unit тесты для access-control/auth-guard.ts
 */
import { describe, expect, it } from 'vitest';

import { GlobalUserRole, SystemRole } from '@livai/core-contracts';

import type {
  Action,
  AuthDecision,
  AuthGuardContextCore,
  Permission,
  Resource,
} from '../../../src/access-control/auth-guard.js';
import {
  checkAccess,
  checkAuthorization,
  combineGuards,
  createAuthError,
  eitherGuard,
  requirePermission,
  requireRole,
} from '../../../src/access-control/auth-guard.js';

const makeResource = (overrides: Partial<Resource> = {}): Resource => ({
  type: 'public',
  ...overrides,
});

const makeContext = (overrides: Partial<AuthGuardContextCore> = {}): AuthGuardContextCore => ({
  isAuthenticated: true,
  ...overrides,
});

describe('createAuthError', () => {
  it('создает корректную ошибку с полями', () => {
    const resource: Resource = makeResource({ type: 'private' });
    const error = createAuthError(
      'AUTH_INSUFFICIENT_PERMISSIONS',
      'field',
      resource,
      GlobalUserRole.ADMIN,
      ['WRITE_PRIVATE'],
      ['READ_PRIVATE'],
    );

    expect(error).toEqual({
      code: 'AUTH_INSUFFICIENT_PERMISSIONS',
      service: 'AUTH',
      field: 'field',
      resource,
      requiredRole: GlobalUserRole.ADMIN,
      requiredPermissions: ['WRITE_PRIVATE'],
      userPermissions: ['READ_PRIVATE'],
    });
  });
});

describe('checkAccess', () => {
  it('возвращает NOT_AUTHENTICATED, если пользователь не аутентифицирован', () => {
    const context = makeContext({ isAuthenticated: false });
    const decision = checkAccess('READ', makeResource(), context);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('NOT_AUTHENTICATED');
    const deny = decision as Extract<AuthDecision, { allow: false; }>;
    expect(deny.error?.code).toBe('AUTH_MISSING_TOKEN');
  });

  it('делегирует в checkAuthorization с пустыми наборами, если роли/permissions не заданы', () => {
    const context = makeContext();
    const decision = checkAccess('READ', makeResource(), context);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('NO_ROLES');
    const deny = decision as Extract<AuthDecision, { allow: false; }>;
    expect(deny.error?.code).toBe('AUTH_INVALID_ROLE');
  });
});

describe('checkAuthorization', () => {
  it('отказывает при отсутствии ролей', () => {
    const roles = new Set<GlobalUserRole | SystemRole>();
    const permissions = new Set<Permission>();
    const context = makeContext();
    const decision = checkAuthorization(roles, permissions, 'READ', makeResource(), context);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('NO_ROLES');
    const deny = decision as Extract<AuthDecision, { allow: false; }>;
    expect(deny.error?.code).toBe('AUTH_INVALID_ROLE');
  });

  it('использует guest shortcut и ограничивает действия', () => {
    const roles = new Set([GlobalUserRole.GUEST]);
    const permissions = new Set<Permission>();
    const context = makeContext();

    const publicRead = checkAuthorization(
      roles,
      permissions,
      'READ',
      makeResource({ type: 'public' }),
      context,
    );
    expect(publicRead.allow).toBe(false); // нет roles кроме guest → NO_ROLES shortcut

    const privateRead = checkAuthorization(
      roles,
      permissions,
      'READ',
      makeResource({ type: 'private' }),
      context,
    );
    expect(privateRead.allow).toBe(false);
    expect(privateRead.reason).toBe('GUEST_RESTRICTED');
  });

  it('даёт полный доступ SYSTEM роли', () => {
    const roles = new Set([SystemRole.SYSTEM]);
    const permissions = new Set<Permission>();
    const context = makeContext();
    const resource = makeResource({ type: 'private' });

    const decision = checkAuthorization(roles, permissions, 'ADMIN', resource, context);
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });

  it('проверяет admin/moderator shortcuts', () => {
    const roles = new Set([GlobalUserRole.ADMIN]);
    const permissions = new Set<Permission>();
    const context = makeContext();
    const resource = makeResource();

    const adminAction = checkAuthorization(roles, permissions, 'ADMIN', resource, context);
    expect(adminAction.allow).toBe(true);

    const moderateAction = checkAuthorization(roles, permissions, 'MODERATE', resource, context);
    expect(moderateAction.allow).toBe(true);
  });

  it('использует moderator shortcut для чистого модератора', () => {
    const roles = new Set([GlobalUserRole.MODERATOR]);
    const permissions = new Set<Permission>();
    const context = makeContext();
    const resource = makeResource({ type: 'public' });

    const decision = checkAuthorization(roles, permissions, 'MODERATE', resource, context);
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });

  it('отказывает при отсутствии необходимых permissions', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(); // нет READ_PUBLIC
    const context = makeContext();
    const resource = makeResource({ type: 'public' });

    const decision = checkAuthorization(roles, permissions, 'READ', resource, context);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('INSUFFICIENT_PERMISSIONS');
    const deny = decision as Extract<AuthDecision, { allow: false; }>;
    expect(deny.error?.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
    expect(deny.error?.requiredPermissions).toEqual(['READ_PUBLIC']);
  });

  it('отказывает, если нет владения приватным ресурсом и нет elevated доступа', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['WRITE_PRIVATE']);
    const resource = makeResource({ type: 'private', ownerId: 'owner-1' as any });
    const context = makeContext({ userId: 'other-user' as any });

    const decision = checkAuthorization(roles, permissions, 'WRITE', resource, context);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('NOT_RESOURCE_OWNER');
  });

  it('использует ранний возврат в isResourceOwner, если userId отсутствует', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['WRITE_PRIVATE']);
    const resource = makeResource({ type: 'private', ownerId: 'owner-1' as any });
    const context = makeContext();

    const decision = checkAuthorization(roles, permissions, 'WRITE', resource, context);

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('NOT_RESOURCE_OWNER');
  });

  it('корректно вычисляет permissions для всех действий и типов ресурсов', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const context = makeContext();

    const makeDecision = (action: Action, resource: Resource) =>
      checkAuthorization(
        roles,
        new Set<Permission>(),
        action,
        resource,
        context,
      );

    // READ
    expect(
      (makeDecision('READ', makeResource({ type: 'public' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['READ_PUBLIC']);
    expect(
      (makeDecision('READ', makeResource({ type: 'private' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['READ_PRIVATE']);

    // WRITE
    expect(
      (makeDecision('WRITE', makeResource({ type: 'public' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['WRITE_PUBLIC']);
    expect(
      (makeDecision('WRITE', makeResource({ type: 'private' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['WRITE_PRIVATE']);

    // DELETE
    expect(
      (makeDecision('DELETE', makeResource({ type: 'public' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['DELETE_PUBLIC']);
    expect(
      (makeDecision('DELETE', makeResource({ type: 'private' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['DELETE_PRIVATE']);

    // MODERATE
    expect(
      (makeDecision('MODERATE', makeResource({ type: 'public' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['MODERATE_CONTENT']);

    // ADMIN
    expect(
      (makeDecision('ADMIN', makeResource({ type: 'public' })) as Extract<
        AuthDecision,
        { allow: false; }
      >)
        .error?.requiredPermissions,
    )
      .toEqual(['SYSTEM_ADMIN']);
  });

  it('разрешает доступ владельцу приватного ресурса при наличии permissions', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['WRITE_PRIVATE']);
    const resource = makeResource({ type: 'private', ownerId: 'user-1' as any });
    const context = makeContext({ userId: 'user-1' as any });

    const decision = checkAuthorization(roles, permissions, 'WRITE', resource, context);
    expect(decision.allow).toBe(true);
  });

  it('разрешает доступ владельцу приватного ресурса с DELETE при наличии permissions (покрывает action === DELETE в isPrivateResourceAction)', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['DELETE_PRIVATE']);
    const resource = makeResource({ type: 'private', ownerId: 'user-1' as any });
    const context = makeContext({ userId: 'user-1' as any });

    const decision = checkAuthorization(roles, permissions, 'DELETE', resource, context);
    expect(decision.allow).toBe(true);
  });

  it('разрешает доступ к приватному ресурсу с READ при наличии permissions (покрывает isPrivateResourceAction false для private+READ)', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['READ_PRIVATE']);
    const resource = makeResource({ type: 'private' });
    const context = makeContext({ userId: 'user-1' as any });

    const decision = checkAuthorization(roles, permissions, 'READ', resource, context);
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });

  it('разрешает доступ к публичному ресурсу с достаточными permissions без shortcut-ролей', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['READ_PUBLIC']);
    const resource = makeResource({ type: 'public' });
    const context = makeContext({ userId: 'user-1' as any });

    const decision = checkAuthorization(roles, permissions, 'READ', resource, context);

    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });

  it('разрешает доступ к публичному ресурсу с WRITE при наличии permissions (покрывает isPrivateResourceAction false для public+WRITE)', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['WRITE_PUBLIC']);
    const resource = makeResource({ type: 'public' });
    const context = makeContext({ userId: 'user-1' as any });

    const decision = checkAuthorization(roles, permissions, 'WRITE', resource, context);

    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });

  it('разрешает доступ к публичному ресурсу с DELETE при наличии permissions (покрывает isPrivateResourceAction false для public+DELETE)', () => {
    const roles = new Set<GlobalUserRole | SystemRole>([GlobalUserRole.USER]);
    const permissions = new Set<Permission>(['DELETE_PUBLIC']);
    const resource = makeResource({ type: 'public' });
    const context = makeContext({ userId: 'user-1' as any });

    const decision = checkAuthorization(roles, permissions, 'DELETE', resource, context);

    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });
});

const makeInsufficientPermissionsDecision = (): AuthDecision => ({
  allow: false,
  reason: 'INSUFFICIENT_PERMISSIONS',
  error: createAuthError('AUTH_INSUFFICIENT_PERMISSIONS'),
});

describe('combineGuards', () => {
  it('возвращает первый deny при AND-комбинации', () => {
    const allowGuard = (): AuthDecision => ({ allow: true, reason: 'SUCCESS' });
    const denyGuard = makeInsufficientPermissionsDecision;

    const combined = combineGuards(allowGuard, denyGuard, allowGuard);
    const decision = combined(makeContext()) as Extract<AuthDecision, { allow: false; }>;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('INSUFFICIENT_PERMISSIONS');
    expect(decision.error?.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
  });

  it("возвращает SUCCESS, если все guard'ы allow", () => {
    const allowGuard = (): AuthDecision => ({ allow: true, reason: 'SUCCESS' });
    const combined = combineGuards(allowGuard, allowGuard);

    const decision = combined(makeContext());
    expect(decision).toEqual({ allow: true, reason: 'SUCCESS' });
  });
});

describe('eitherGuard', () => {
  it('возвращает первый allow при OR-комбинации', () => {
    const denyGuard = makeInsufficientPermissionsDecision;
    const allowGuard = (): AuthDecision => ({ allow: true, reason: 'SUCCESS' });

    const combined = eitherGuard(denyGuard, allowGuard, denyGuard);
    const decision = combined(makeContext());

    expect(decision).toEqual({ allow: true, reason: 'SUCCESS' });
  });

  it('агрегирует ошибки при полном deny', () => {
    const denyGuard1 = (): AuthDecision => ({
      allow: false,
      reason: 'NOT_AUTHENTICATED',
      error: createAuthError('AUTH_MISSING_TOKEN'),
    });
    const denyGuard2 = makeInsufficientPermissionsDecision;

    const combined = eitherGuard(denyGuard1, denyGuard2);
    const decision = combined(makeContext()) as Extract<AuthDecision, { allow: false; }>;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('RESOURCE_ACCESS_DENIED');
    expect(decision.error?.code).toBe('AUTH_MISSING_TOKEN');
  });

  it("использует fallback ошибку, если guard'ы не вернули error", () => {
    const denyGuard1 = (): AuthDecision => ({
      allow: false,
      reason: 'NOT_AUTHENTICATED',
    });
    const denyGuard2 = (): AuthDecision => ({
      allow: false,
      reason: 'INSUFFICIENT_PERMISSIONS',
    });

    const combined = eitherGuard(denyGuard1, denyGuard2);
    const decision = combined(makeContext()) as Extract<AuthDecision, { allow: false; }>;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('RESOURCE_ACCESS_DENIED');
    expect(decision.error?.code).toBe('AUTH_RESOURCE_ACCESS_DENIED');
  });
});

describe('requireRole', () => {
  it('отказывает неаутентифицированному пользователю', () => {
    const guard = requireRole(GlobalUserRole.ADMIN);
    const decision = guard(makeContext({ isAuthenticated: false })) as Extract<
      AuthDecision,
      { allow: false; }
    >;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('NOT_AUTHENTICATED');
    expect(decision.error?.code).toBe('AUTH_MISSING_TOKEN');
  });

  it('отказывает при отсутствии требуемой роли', () => {
    const guard = requireRole(GlobalUserRole.ADMIN);
    const context = makeContext({ roles: new Set([GlobalUserRole.USER]) });

    const decision = guard(context) as Extract<AuthDecision, { allow: false; }>;
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('INVALID_ROLE');
    expect(decision.error?.code).toBe('AUTH_INVALID_ROLE');
    expect(decision.error?.requiredRole).toBe(GlobalUserRole.ADMIN);
  });

  it('использует пустой набор ролей, если roles не заданы', () => {
    const guard = requireRole(GlobalUserRole.ADMIN);
    const context = makeContext(); // roles === undefined → EMPTY_ROLE_SET

    const decision = guard(context) as Extract<AuthDecision, { allow: false; }>;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('INVALID_ROLE');
    expect(decision.error?.code).toBe('AUTH_INVALID_ROLE');
    expect(decision.error?.requiredRole).toBe(GlobalUserRole.ADMIN);
  });

  it('разрешает при наличии требуемой роли', () => {
    const guard = requireRole(GlobalUserRole.ADMIN);
    const context = makeContext({ roles: new Set([GlobalUserRole.ADMIN]) });

    const decision = guard(context);
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });
});

describe('requirePermission', () => {
  it('отказывает неаутентифицированному пользователю', () => {
    const guard = requirePermission('READ_PRIVATE');
    const decision = guard(makeContext({ isAuthenticated: false })) as Extract<
      AuthDecision,
      { allow: false; }
    >;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('NOT_AUTHENTICATED');
    expect(decision.error?.code).toBe('AUTH_MISSING_TOKEN');
  });

  it('отказывает при отсутствии permissions', () => {
    const guard = requirePermission('READ_PRIVATE');
    const context = makeContext({ permissions: new Set<Permission>(['READ_PUBLIC']) });

    const decision = guard(context) as Extract<AuthDecision, { allow: false; }>;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('INSUFFICIENT_PERMISSIONS');
    expect(decision.error?.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
    expect(decision.error?.requiredPermissions).toEqual(['READ_PRIVATE']);
    expect(decision.error?.userPermissions).toEqual(['READ_PUBLIC']);
  });

  it('использует пустой набор permissions, если permissions не заданы', () => {
    const guard = requirePermission('READ_PRIVATE');
    const context = makeContext(); // permissions === undefined → EMPTY_PERMISSION_SET

    const decision = guard(context) as Extract<AuthDecision, { allow: false; }>;

    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('INSUFFICIENT_PERMISSIONS');
    expect(decision.error?.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
    expect(decision.error?.requiredPermissions).toEqual(['READ_PRIVATE']);
    expect(decision.error?.userPermissions).toEqual([]);
  });

  it('разрешает при наличии требуемого permission', () => {
    const guard = requirePermission('READ_PRIVATE');
    const context = makeContext({ permissions: new Set<Permission>(['READ_PRIVATE']) });

    const decision = guard(context);

    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('SUCCESS');
  });
});
