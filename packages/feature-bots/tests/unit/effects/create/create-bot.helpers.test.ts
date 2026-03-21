import { describe, expect, it, vi } from 'vitest';

import type {
  BotAction,
  BotPermissionDeniedReason,
  BotPolicyAction,
  BotPolicyDeniedReason,
  BotRole,
  BotState,
} from '@livai/core';

import type { BotTemplate } from '../../../../src/domain/BotTemplate.js';
import {
  buildCreateBotRequestBody,
  buildDraftBotId,
  buildFallbackBotId,
  createCreateHelpers,
} from '../../../../src/effects/create/create-bot.helpers.js';
import {
  buildActorUserContext,
  createPureGuards,
  defaultPermissionErrorCodeResolver,
  defaultPolicyErrorCodeResolver,
} from '../../../../src/effects/shared/pure-guards.js';

type PermissionDecision =
  | Readonly<{ readonly allow: true; }>
  | Readonly<{ readonly allow: false; readonly reason: BotPermissionDeniedReason; }>;

type PolicyDecision =
  | Readonly<{ readonly allow: true; }>
  | Readonly<{ readonly allow: false; readonly reason: BotPolicyDeniedReason; }>;

function captureThrown(fn: () => void): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}

function mkTemplate() {
  return Object.freeze({
    id: 'tpl_alpha',
    name: 'Alpha',
    role: 'assistant',
    description: 'Template',
    defaultInstruction: 'be helpful',
    defaultSettings: Object.freeze({
      temperature: 0.2,
      maxTokens: 256,
    }),
    capabilities: Object.freeze(['multi_channel']),
    tags: Object.freeze(['base']),
  }) as unknown as BotTemplate;
}

function mkPolicyState(): BotState {
  return Object.freeze({
    id: 'bot_draft_0000000000000001',
    workspaceId: 'ws_1',
    name: 'Bot',
    status: 'draft',
    visibility: 'private',
    mode: 'manual',
    ownerUserId: 'u_owner',
    currentVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as unknown as BotState;
}

const defaultCreateHelpers = createCreateHelpers(
  createPureGuards({
    permissionResolver: defaultPermissionErrorCodeResolver,
    policyResolver: defaultPolicyErrorCodeResolver,
  }),
);

describe('create-bot.helpers', () => {
  describe('buildDraftBotId', () => {
    it('детерминированный id при одинаковом входе', () => {
      const input = Object.freeze({
        workspaceId: 'ws_1',
        templateId: 'tpl_1',
        name: 'Мой бот',
      });

      const a = buildDraftBotId(input);
      const b = buildDraftBotId(input);

      expect(a).toBe(b);
      expect(String(a)).toMatch(/^bot_draft_[0-9a-f]{16}$/);
    });

    it('salt влияет на итоговый id', () => {
      const base = Object.freeze({
        workspaceId: 'ws_1',
        templateId: 'tpl_1',
        name: 'Same',
      });

      const a = buildDraftBotId(base);
      const b = buildDraftBotId(Object.freeze({ ...base, salt: 'custom-salt' }));

      expect(a).not.toBe(b);
      expect(String(b)).toMatch(/^bot_draft_[0-9a-f]{16}$/);
    });

    it('пробрасывает BotErrorResponse при невалидном формате draft-id', () => {
      const testSpy = vi.spyOn(RegExp.prototype, 'test').mockReturnValueOnce(false);

      const thrown = captureThrown(() =>
        buildDraftBotId({
          workspaceId: 'ws_1',
          templateId: 'tpl_1',
          name: 'bad',
        })
      );

      testSpy.mockRestore();

      expect(thrown).toMatchObject({
        code: 'BOT_DRAFT_ID_INVALID',
        context: {
          details: {
            type: 'draft_bot_id',
            reason: 'format_mismatch',
          },
        },
      });
    });
  });

  describe('buildFallbackBotId', () => {
    it('детерминированный id при одинаковом входе (FNV-64 + bot_fallback_ + 16 hex)', () => {
      const input = Object.freeze({
        workspaceId: 'ws_1',
        templateId: 'tpl_1',
        name: 'Мой бот',
      });

      const a = buildFallbackBotId(input);
      const b = buildFallbackBotId(input);

      expect(a).toBe(b);
      expect(String(a)).toMatch(/^bot_fallback_[0-9a-f]{16}$/);
    });

    it('отличается от draft-id при том же входе (иной salt/prefix)', () => {
      const input = Object.freeze({
        workspaceId: 'ws_1',
        templateId: 'tpl_1',
        name: 'Same',
      });

      expect(buildDraftBotId(input)).not.toBe(buildFallbackBotId(input));
      expect(String(buildDraftBotId(input))).toMatch(/^bot_draft_/);
      expect(String(buildFallbackBotId(input))).toMatch(/^bot_fallback_/);
    });

    it('пробрасывает BotErrorResponse при невалидном формате fallback-id', () => {
      const testSpy = vi.spyOn(RegExp.prototype, 'test').mockReturnValueOnce(false);

      const thrown = captureThrown(() =>
        buildFallbackBotId({
          workspaceId: 'ws_1',
          templateId: 'tpl_1',
          name: 'bad',
        })
      );

      testSpy.mockRestore();

      expect(thrown).toMatchObject({
        code: 'BOT_DRAFT_ID_INVALID',
        context: {
          details: {
            type: 'fallback_bot_id',
            reason: 'format_mismatch',
          },
        },
      });
    });
  });

  describe('buildCreateBotRequestBody', () => {
    it('берет instructionOverride, если передан', () => {
      const template = mkTemplate();
      const body = buildCreateBotRequestBody({
        name: 'Новый бот',
        template,
        instructionOverride: 'override',
      });

      expect(body).toEqual({
        name: 'Новый бот',
        instruction: 'override',
        settings: template.defaultSettings,
        templateId: template.id,
      });
      expect(Object.isFrozen(body)).toBe(true);
      expect(Object.isFrozen(body.settings)).toBe(true);
    });

    it('использует defaultInstruction, если override отсутствует', () => {
      const template = mkTemplate();
      const body = buildCreateBotRequestBody({
        name: 'Новый бот',
        template,
      });

      expect(body.instruction).toBe(template.defaultInstruction);
    });
  });

  describe('buildActorUserContext (shared/pure-guards)', () => {
    it('нормализует undefined userId в null и не добавляет role', () => {
      const actor = buildActorUserContext({
        userId: undefined,
        actorRole: undefined,
      });

      expect(actor).toEqual({ userId: null });
      expect(Object.isFrozen(actor)).toBe(true);
      expect('role' in actor).toBe(false);
    });

    it('возвращает userId и role при наличии', () => {
      const actor = buildActorUserContext({
        userId: 'u_1' as unknown as never,
        actorRole: 'editor' as BotRole,
      });

      expect(actor).toEqual({
        userId: 'u_1',
        role: 'editor',
      });
    });
  });

  describe('createCreateHelpers + default guards', () => {
    it('checkCreatePermissionsOrThrow: не кидает при allow=true (action=create)', () => {
      const canPerform = vi.fn(
        (): PermissionDecision =>
          Object.freeze({
            allow: true,
          }),
      );
      const botPermissions = Object.freeze({ canPerform });

      expect(() =>
        defaultCreateHelpers.checkCreatePermissionsOrThrow({
          botPermissions: botPermissions as never,
          actorUser: Object.freeze({ userId: 'u_1', role: 'editor' }) as never,
          action: 'create',
        })
      ).not.toThrow();
      expect(canPerform).toHaveBeenCalledWith('create', {
        userId: 'u_1',
        role: 'editor',
      });
    });

    it('checkCreatePermissionsOrThrow: кидает canonical error при deny (custom action)', () => {
      const canPerform = vi.fn(
        (): PermissionDecision =>
          Object.freeze({
            allow: false,
            reason: 'insufficient_role',
          }),
      );
      const botPermissions = Object.freeze({ canPerform });
      const action: BotAction = 'read';

      const thrown = captureThrown(() =>
        defaultCreateHelpers.checkCreatePermissionsOrThrow({
          botPermissions: botPermissions as never,
          actorUser: Object.freeze({ userId: 'u_2', role: 'viewer' }) as never,
          action,
        })
      );

      expect(thrown).toBeDefined();
      expect(thrown).toMatchObject({
        code: 'BOT_PERMISSION_DENIED',
        context: {
          details: {
            type: 'permission',
            action: 'read',
            reason: 'insufficient_role',
          },
        },
      });
    });

    it('checkCreatePolicyOrThrow: fail-closed при отсутствии actor context', () => {
      const canPerform = vi.fn(
        (): PolicyDecision =>
          Object.freeze({
            allow: true,
          }),
      );
      const botPolicy = Object.freeze({ canPerform });

      const thrown = captureThrown(() =>
        defaultCreateHelpers.checkCreatePolicyOrThrow({
          botPolicy: botPolicy as never,
          userId: undefined,
          actorRole: undefined,
          policyBotState: mkPolicyState(),
          action: 'configure',
        })
      );

      expect(thrown).toBeDefined();
      expect(thrown).toMatchObject({
        code: 'BOT_POLICY_ACTOR_CONTEXT_MISSING',
        context: {
          details: {
            type: 'policy',
            action: 'configure',
            reason: 'actor_context_missing',
          },
        },
      });
      expect(canPerform).not.toHaveBeenCalled();
    });

    it('checkCreatePolicyOrThrow: вызывает policy.canPerform и не кидает при allow=true', () => {
      const canPerform = vi.fn(
        (): PolicyDecision =>
          Object.freeze({
            allow: true,
          }),
      );
      const botPolicy = Object.freeze({ canPerform });
      const state = mkPolicyState();
      const action: BotPolicyAction = 'configure';

      expect(() =>
        defaultCreateHelpers.checkCreatePolicyOrThrow({
          botPolicy: botPolicy as never,
          userId: 'u_7' as never,
          actorRole: 'admin' as BotRole,
          policyBotState: state,
          action,
        })
      ).not.toThrow();
      expect(canPerform).toHaveBeenCalledWith('configure', state, {
        userId: 'u_7',
        role: 'admin',
      });
    });

    it('checkCreatePolicyOrThrow: кидает canonical error при deny от policy', () => {
      const canPerform = vi.fn(
        (): PolicyDecision =>
          Object.freeze({
            allow: false,
            reason: 'bot_archived',
          }),
      );
      const botPolicy = Object.freeze({ canPerform });

      const thrown = captureThrown(() =>
        defaultCreateHelpers.checkCreatePolicyOrThrow({
          botPolicy: botPolicy as never,
          userId: 'u_8' as never,
          actorRole: 'editor' as BotRole,
          policyBotState: mkPolicyState(),
          action: 'configure',
        })
      );

      expect(thrown).toBeDefined();
      expect(thrown).toMatchObject({
        code: 'BOT_POLICY_ARCHIVED',
        context: {
          details: {
            type: 'policy',
            action: 'configure',
            reason: 'bot_archived',
          },
        },
      });
    });
  });
});
