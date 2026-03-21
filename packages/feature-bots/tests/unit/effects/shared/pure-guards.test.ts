/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  BotAction,
  BotPermissionDeniedReason,
  BotPolicy,
  BotPolicyAction,
  BotPolicyDeniedReason,
  BotRole,
  BotState,
} from '@livai/core';

import type { ExtendedPolicyReason } from '../../../../src/effects/shared/pure-guards.js';
import {
  assertActorContextForPolicyOrThrow,
  buildActorUserContext,
  buildGuardErrorContext,
  checkPermissionsOrThrow,
  checkPolicyOrThrow,
  createPermissionDeniedErrorResponse,
  createPermissionErrorCodeResolver,
  createPolicyDeniedErrorResponse,
  createPolicyErrorCodeResolver,
  createPureGuards,
  createPureGuardsMappingInvariantBotErrorResponse,
  defaultPermissionErrorCodeResolver,
  defaultPolicyErrorCodeResolver,
  evaluatePolicyDecision,
  isCompleteActorForPolicy,
  throwPolicyDeniedOrReturn,
} from '../../../../src/effects/shared/pure-guards.js';

/* eslint-disable ai-security/token-leakage -- ложные срабатывания на именах экспортов pure-guards в тестовом коде */

function captureThrown(fn: () => void): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}

const mkBotState = (): BotState =>
  Object.freeze({
    botId: 'bot_1',
    mode: 'draft',
    createdAt: 1,
    isSystemBot: false,
  });

describe('pure-guards.ts', () => {
  describe('createPureGuardsMappingInvariantBotErrorResponse', () => {
    it('возвращает BOT_GUARD_INVARIANT_VIOLATION с деталями scope/message', () => {
      const err = createPureGuardsMappingInvariantBotErrorResponse('test_scope', 'test msg');
      expect(err).toMatchObject({
        code: 'BOT_GUARD_INVARIANT_VIOLATION',
        context: {
          details: {
            type: 'pure_guards_invariant',
            layer: 'pure-guards',
            scope: 'test_scope',
            message: 'test msg',
          },
        },
      });
    });
  });

  describe('defaultPermissionErrorCodeResolver', () => {
    it('мапит все BotPermissionDeniedReason из core в BOT_PERMISSION_DENIED', () => {
      const reasons: readonly BotPermissionDeniedReason[] = [
        'not_authenticated',
        'not_a_member',
        'insufficient_role',
        'action_not_allowed',
      ];
      expect(reasons.map((reason) => defaultPermissionErrorCodeResolver(reason))).toEqual(
        reasons.map(() => 'BOT_PERMISSION_DENIED'),
      );
    });

    it('fail-closed: неизвестная причина → BOT_GUARD_INVARIANT_VIOLATION', () => {
      const thrown = captureThrown(() =>
        defaultPermissionErrorCodeResolver('unknown_reason' as BotPermissionDeniedReason)
      );
      expect(thrown).toMatchObject({
        code: 'BOT_GUARD_INVARIANT_VIOLATION',
        context: {
          details: {
            scope: 'permission_reason_mapping',
          },
        },
      });
    });
  });

  describe('defaultPolicyErrorCodeResolver', () => {
    it('мапит все BotPolicyDeniedReason и actor_context_missing', () => {
      const table: readonly { reason: ExtendedPolicyReason; code: string; }[] = [
        { reason: 'bot_archived', code: 'BOT_POLICY_ARCHIVED' },
        { reason: 'bot_not_active', code: 'BOT_POLICY_MODE_INVALID' },
        { reason: 'invalid_bot_mode', code: 'BOT_POLICY_MODE_INVALID' },
        { reason: 'insufficient_role', code: 'BOT_POLICY_ROLE_INSUFFICIENT' },
        { reason: 'action_not_allowed', code: 'BOT_POLICY_ACTION_DENIED' },
        { reason: 'actor_context_missing', code: 'BOT_POLICY_ACTOR_CONTEXT_MISSING' },
      ];
      expect(table.map((row) => defaultPolicyErrorCodeResolver(row.reason))).toEqual(
        table.map((row) => row.code),
      );
    });

    it('fail-closed: неизвестная причина → BOT_GUARD_INVARIANT_VIOLATION', () => {
      const thrown = captureThrown(() =>
        defaultPolicyErrorCodeResolver('unknown_policy' as ExtendedPolicyReason)
      );
      expect(thrown).toMatchObject({
        code: 'BOT_GUARD_INVARIANT_VIOLATION',
        context: {
          details: {
            scope: 'policy_reason_mapping',
          },
        },
      });
    });
  });

  describe('createPermissionErrorCodeResolver / createPolicyErrorCodeResolver', () => {
    it('createPermissionErrorCodeResolver возвращает код из таблицы', () => {
      const resolver = createPermissionErrorCodeResolver({
        not_authenticated: 'BOT_PERMISSION_DENIED',
        not_a_member: 'BOT_PERMISSION_DENIED',
        insufficient_role: 'BOT_PERMISSION_DENIED',
        action_not_allowed: 'BOT_PERMISSION_DENIED',
      });
      expect(resolver('insufficient_role')).toBe('BOT_PERMISSION_DENIED');
    });

    it('createPermissionErrorCodeResolver: отсутствующий ключ в mapping → invariant', () => {
      const badMapping = { insufficient_role: 'BOT_PERMISSION_DENIED' } as Readonly<
        Record<BotPermissionDeniedReason, string>
      >;
      const resolver = createPermissionErrorCodeResolver(badMapping as any);
      const thrown = captureThrown(() => resolver('not_a_member'));
      expect(thrown).toMatchObject({
        code: 'BOT_GUARD_INVARIANT_VIOLATION',
        context: {
          details: {
            scope: 'permission_resolver_factory',
          },
        },
      });
    });

    it('createPolicyErrorCodeResolver возвращает код из таблицы', () => {
      const resolver = createPolicyErrorCodeResolver({
        bot_archived: 'BOT_POLICY_ARCHIVED',
        bot_not_active: 'BOT_POLICY_MODE_INVALID',
        invalid_bot_mode: 'BOT_POLICY_MODE_INVALID',
        insufficient_role: 'BOT_POLICY_ROLE_INSUFFICIENT',
        action_not_allowed: 'BOT_POLICY_ACTION_DENIED',
        actor_context_missing: 'BOT_POLICY_ACTOR_CONTEXT_MISSING',
      });
      expect(resolver('bot_archived')).toBe('BOT_POLICY_ARCHIVED');
    });

    it('createPolicyErrorCodeResolver: отсутствующий ключ → invariant', () => {
      const badMapping = { bot_archived: 'BOT_POLICY_ARCHIVED' } as Readonly<
        Record<ExtendedPolicyReason, string>
      >;
      const resolver = createPolicyErrorCodeResolver(badMapping as any);
      const thrown = captureThrown(() => resolver('not_a_member' as ExtendedPolicyReason));
      expect(thrown).toMatchObject({
        code: 'BOT_GUARD_INVARIANT_VIOLATION',
        context: {
          details: {
            scope: 'policy_resolver_factory',
          },
        },
      });
    });
  });

  describe('buildGuardErrorContext', () => {
    it('возвращает замороженный context с details', () => {
      const ctx = buildGuardErrorContext({
        type: 'permission',
        action: 'create',
        reason: 'insufficient_role',
      });
      expect(ctx.details).toEqual({
        type: 'permission',
        action: 'create',
        reason: 'insufficient_role',
      });
      expect(Object.isFrozen(ctx)).toBe(true);
      expect(Object.isFrozen(ctx.details)).toBe(true);
    });
  });

  describe('createPermissionDeniedErrorResponse / createPolicyDeniedErrorResponse', () => {
    it('createPermissionDeniedErrorResponse без context — только code', () => {
      const res = createPermissionDeniedErrorResponse(
        'not_a_member',
        defaultPermissionErrorCodeResolver,
      );
      expect(res.code).toBe('BOT_PERMISSION_DENIED');
      expect(res.context).toBeUndefined();
    });

    it('createPermissionDeniedErrorResponse с context', () => {
      const res = createPermissionDeniedErrorResponse(
        'not_a_member',
        defaultPermissionErrorCodeResolver,
        buildGuardErrorContext({
          type: 'permission',
          action: 'read',
          reason: 'not_a_member',
        }),
      );
      expect(res.code).toBe('BOT_PERMISSION_DENIED');
      expect(res.context?.details).toBeDefined();
    });

    it('createPolicyDeniedErrorResponse без context — только code', () => {
      const res = createPolicyDeniedErrorResponse('bot_archived', defaultPolicyErrorCodeResolver);
      expect(res.code).toBe('BOT_POLICY_ARCHIVED');
      expect(res.context).toBeUndefined();
    });

    it('createPolicyDeniedErrorResponse с context', () => {
      const res = createPolicyDeniedErrorResponse(
        'bot_archived',
        defaultPolicyErrorCodeResolver,
        buildGuardErrorContext({
          type: 'policy',
          action: 'configure',
          reason: 'bot_archived',
        }),
      );
      expect(res.code).toBe('BOT_POLICY_ARCHIVED');
      expect(res.context?.details).toBeDefined();
    });
  });

  describe('buildActorUserContext / isCompleteActorForPolicy', () => {
    it('buildActorUserContext: userId null, role только если передан', () => {
      expect(buildActorUserContext({ userId: undefined, actorRole: undefined })).toEqual({
        userId: null,
      });
      expect(
        buildActorUserContext({
          userId: 'u1' as unknown as never,
          actorRole: 'editor' as BotRole,
        }),
      ).toEqual({ userId: 'u1', role: 'editor' });
    });

    it('isCompleteActorForPolicy: true только при userId и role', () => {
      expect(isCompleteActorForPolicy({ userId: 'u', role: 'viewer' } as any)).toBe(true);
      expect(isCompleteActorForPolicy({ userId: null })).toBe(false);
      expect(isCompleteActorForPolicy({ userId: 'u', role: undefined } as any)).toBe(false);
    });
  });

  describe('assertActorContextForPolicyOrThrow', () => {
    it('no-op при полном actor', () => {
      expect(() =>
        assertActorContextForPolicyOrThrow(
          { userId: 'u', role: 'admin' },
          'configure',
          defaultPolicyErrorCodeResolver,
        )
      ).not.toThrow();
    });

    it('throw при неполном actor', () => {
      const thrown = captureThrown(() =>
        assertActorContextForPolicyOrThrow(
          { userId: null },
          'configure',
          defaultPolicyErrorCodeResolver,
        )
      );
      expect(thrown).toMatchObject({ code: 'BOT_POLICY_ACTOR_CONTEXT_MISSING' });
    });
  });

  describe('evaluatePolicyDecision / throwPolicyDeniedOrReturn', () => {
    it('evaluatePolicyDecision делегирует botPolicy.canPerform', () => {
      const canPerform = vi.fn(() => ({ allow: true, reason: 'ACTION_ALLOWED' } as const));
      const botPolicy = { canPerform } as unknown as BotPolicy;
      const actorUser = { userId: 'u1', role: 'editor' as BotRole };
      const policyBotState = mkBotState();
      const action: BotPolicyAction = 'configure';
      const r = evaluatePolicyDecision({
        botPolicy,
        policyBotState,
        action,
        actorUser,
      });
      expect(r).toEqual({ allow: true, reason: 'ACTION_ALLOWED' });
      expect(canPerform).toHaveBeenCalledWith(action, policyBotState, {
        userId: 'u1',
        role: 'editor',
      });
    });

    it('throwPolicyDeniedOrReturn: allow — no-op', () => {
      expect(() =>
        throwPolicyDeniedOrReturn(
          { allow: true, reason: 'ACTION_ALLOWED' },
          'configure',
          defaultPolicyErrorCodeResolver,
        )
      ).not.toThrow();
    });

    it('throwPolicyDeniedOrReturn: deny — throw', () => {
      const thrown = captureThrown(() =>
        throwPolicyDeniedOrReturn(
          { allow: false, reason: 'bot_archived' },
          'archive',
          defaultPolicyErrorCodeResolver,
        )
      );
      expect(thrown).toMatchObject({ code: 'BOT_POLICY_ARCHIVED' });
    });
  });

  describe('checkPermissionsOrThrow', () => {
    it('не кидает при allow', () => {
      const botPermissions = {
        canPerform: vi.fn(() => ({ allow: true, reason: 'ACTION_ALLOWED' } as const)),
      } as any;
      expect(() =>
        checkPermissionsOrThrow(
          {
            botPermissions,
            actorUser: { userId: 'u', role: 'editor' },
            action: 'create' as BotAction,
          },
          defaultPermissionErrorCodeResolver,
        )
      ).not.toThrow();
    });

    it('кидает при deny с GuardPermissionErrorDetails', () => {
      const botPermissions = {
        canPerform: vi.fn(() => ({
          allow: false,
          reason: 'insufficient_role' as BotPermissionDeniedReason,
        })),
      } as any;
      const thrown = captureThrown(() =>
        checkPermissionsOrThrow(
          {
            botPermissions,
            actorUser: { userId: 'u', role: 'viewer' },
            action: 'delete' as BotAction,
          },
          defaultPermissionErrorCodeResolver,
        )
      );
      expect(thrown).toMatchObject({
        code: 'BOT_PERMISSION_DENIED',
        context: {
          details: {
            type: 'permission',
            action: 'delete',
            reason: 'insufficient_role',
          },
        },
      });
    });
  });

  describe('checkPolicyOrThrow', () => {
    it('кидает actor_context_missing без полного actor', () => {
      const thrown = captureThrown(() =>
        checkPolicyOrThrow(
          {
            botPolicy: {} as BotPolicy,
            policyBotState: mkBotState(),
            action: 'configure',
            actorUser: { userId: null },
          },
          defaultPolicyErrorCodeResolver,
        )
      );
      expect(thrown).toMatchObject({ code: 'BOT_POLICY_ACTOR_CONTEXT_MISSING' });
    });

    it('не кидает при allow от policy', () => {
      const botPolicy = {
        canPerform: vi.fn(() => ({ allow: true, reason: 'ACTION_ALLOWED' } as const)),
      } as unknown as BotPolicy;
      expect(() =>
        checkPolicyOrThrow(
          {
            botPolicy,
            policyBotState: mkBotState(),
            action: 'configure',
            actorUser: { userId: 'u', role: 'editor' },
          },
          defaultPolicyErrorCodeResolver,
        )
      ).not.toThrow();
    });

    it('кидает при deny от policy', () => {
      const botPolicy = {
        canPerform: vi.fn(() => ({
          allow: false,
          reason: 'insufficient_role' as BotPolicyDeniedReason,
        })),
      } as unknown as BotPolicy;
      const thrown = captureThrown(() =>
        checkPolicyOrThrow(
          {
            botPolicy,
            policyBotState: mkBotState(),
            action: 'publish',
            actorUser: { userId: 'u', role: 'viewer' },
          },
          defaultPolicyErrorCodeResolver,
        )
      );
      expect(thrown).toMatchObject({
        code: 'BOT_POLICY_ROLE_INSUFFICIENT',
        context: {
          details: {
            type: 'policy',
            action: 'publish',
            reason: 'insufficient_role',
          },
        },
      });
    });
  });

  describe('createPureGuards', () => {
    it('возвращает bundle с привязанными резолверами', () => {
      const guards = createPureGuards({
        permissionResolver: defaultPermissionErrorCodeResolver,
        policyResolver: defaultPolicyErrorCodeResolver,
      });

      expect(guards.permissionResolver).toBe(defaultPermissionErrorCodeResolver);
      expect(guards.policyResolver).toBe(defaultPolicyErrorCodeResolver);

      const permErr = guards.createPermissionDeniedErrorResponse('not_authenticated');
      expect(permErr.code).toBe('BOT_PERMISSION_DENIED');

      const polErr = guards.createPolicyDeniedErrorResponse('bot_archived');
      expect(polErr.code).toBe('BOT_POLICY_ARCHIVED');

      const botPermissions = {
        canPerform: vi.fn(() => ({ allow: true, reason: 'ACTION_ALLOWED' } as const)),
      } as any;
      expect(() =>
        guards.checkPermissionsOrThrow({
          botPermissions,
          actorUser: { userId: 'u', role: 'editor' },
          action: 'create',
        })
      ).not.toThrow();

      const botPolicy = {
        canPerform: vi.fn(() => ({ allow: true, reason: 'ACTION_ALLOWED' } as const)),
      } as unknown as BotPolicy;
      expect(() =>
        guards.checkPolicyOrThrow({
          botPolicy,
          policyBotState: mkBotState(),
          action: 'configure',
          actorUser: { userId: 'u', role: 'editor' },
        })
      ).not.toThrow();

      expect(() =>
        guards.assertActorContextForPolicyOrThrow(
          { userId: 'u', role: 'editor' },
          'configure',
        )
      ).not.toThrow();

      expect(() =>
        guards.throwPolicyDeniedOrReturn(
          { allow: true, reason: 'ACTION_ALLOWED' },
          'configure',
        )
      ).not.toThrow();
    });
  });
});

/* eslint-enable ai-security/token-leakage */
