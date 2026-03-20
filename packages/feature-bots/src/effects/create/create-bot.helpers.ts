/**
 * @file packages/feature-bots/src/effects/create/create-bot.helpers.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot Pure Helpers
 * ============================================================================
 *
 * Архитектурная роль:
 * - Вспомогательный pure-слой для create-like orchestrator-ов (`create-bot-from-template`, `create-custom-bot`).
 * - Инкапсулирует deterministic builders (draft id / request body / actor context) и pre-check policy/permission.
 * - Удерживает orchestrator тонким: orchestration/IO остаются в effect-файле, а вычисления/правила — здесь.
 *
 * Принципы:
 * - ✅ Pure/Deterministic: без IO, времени, случайности и внешних side-effects.
 * - ✅ Fail-closed: deny-cases конвертируются в `BotErrorResponse` через единый `createBotErrorResponse`.
 * - ✅ Reusable: helper-ы переиспользуемы для разных create-like сценариев без дублирования логики.
 */

import type {
  BotAction,
  BotPermissionDeniedReason,
  BotPermissions,
  BotPolicy,
  BotPolicyAction,
  BotPolicyDeniedReason,
  BotRole,
  BotState,
} from '@livai/core';

import type { BotErrorResponse } from '../../contracts/BotErrorResponse.js';
import type { BotId, BotUserId } from '../../domain/Bot.js';
import type { BotTemplate } from '../../domain/BotTemplate.js';
import { createBotErrorResponse } from '../../lib/bot-errors.js';
import type { BotErrorCode, BotErrorContext } from '../../types/bots.js';
import type { BotCreateRequestTransport } from '../shared/api-client.port.js';

/* ============================================================================
 * 🧮 HASH CONSTANTS — DETERMINISTIC DRAFT ID
 * ============================================================================
 */

const DRAFT_ID_SALT = 'create-bot-draft-v1' as const;
const HEX_BASE = 16;
// 64-bit hash => 16 hex chars.
// Вероятность коллизии в ожидаемом namespace draft-id (тысячи/десятки тысяч значений) низкая, но не нулевая.
// Для security-sensitive внешних идентификаторов этот формат использовать нельзя.
const HASH_HEX_LENGTH_64 = 16;
const BOT_DRAFT_ID_PREFIX = 'bot_draft_' as const;
const BOT_DRAFT_ID_PATTERN = /^bot_draft_[0-9a-f]{16}$/;

/* ============================================================================
 * 🔒 ERROR CODE MAPPINGS — PERMISSION / POLICY
 * ============================================================================
 */

const permissionErrorCodeByReason = Object.freeze(
  {
    not_authenticated: 'BOT_PERMISSION_DENIED',
    not_a_member: 'BOT_PERMISSION_DENIED',
    insufficient_role: 'BOT_PERMISSION_DENIED',
    action_not_allowed: 'BOT_PERMISSION_DENIED',
  } as const satisfies Readonly<Record<BotPermissionDeniedReason, BotErrorCode>>,
);

const policyErrorCodeByReason = Object.freeze(
  {
    bot_archived: 'BOT_POLICY_ARCHIVED',
    bot_not_active: 'BOT_POLICY_MODE_INVALID',
    invalid_bot_mode: 'BOT_POLICY_MODE_INVALID',
    insufficient_role: 'BOT_POLICY_ROLE_INSUFFICIENT',
    action_not_allowed: 'BOT_POLICY_ACTION_DENIED',
  } as const satisfies Readonly<Record<BotPolicyDeniedReason, BotErrorCode>>,
);

function createPermissionDeniedErrorResponse(
  reason: BotPermissionDeniedReason,
  context?: Readonly<BotErrorContext> | undefined,
): BotErrorResponse {
  return createBotErrorResponse({
    // eslint-disable-next-line security/detect-object-injection -- reason is exhaustive union key
    code: permissionErrorCodeByReason[reason],
    ...(context !== undefined ? { context } : {}),
  });
}

function createPolicyDeniedErrorResponse(
  reason: BotPolicyDeniedReason,
  context?: Readonly<BotErrorContext> | undefined,
): BotErrorResponse {
  return createBotErrorResponse({
    // eslint-disable-next-line security/detect-object-injection -- reason is exhaustive union key
    code: policyErrorCodeByReason[reason],
    ...(context !== undefined ? { context } : {}),
  });
}

/* ============================================================================
 * 🆔 DETERMINISTIC ID HELPERS
 * ============================================================================
 */

/**
 * Non-cryptographic deterministic 64-bit hash for draft IDs.
 *
 * @remarks
 * - Не использовать как security-sensitive identity/hash.
 * - Коллизии теоретически возможны, но в ожидаемом namespace draft-id практически редки.
 * - Подходит только для internal/draft identity; не использовать как внешние security-critical IDs.
 */
function fnv1a64Hex(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = 0xffffffffffffffffn;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK_64;
  }

  return hash.toString(HEX_BASE).padStart(HASH_HEX_LENGTH_64, '0');
}

/**
 * Приводит строку к branded `BotId`.
 *
 * @remarks
 * TypeScript-branding проверяется только на уровне типов. Эта фабрика централизует
 * преобразование и выполняет минимальную runtime-валидацию формата draft-id.
 */
function createBotId(value: string): BotId {
  if (!BOT_DRAFT_ID_PATTERN.test(value)) {
    throw new Error(`Invalid draft BotId format: ${value}`);
  }
  return value as unknown as BotId;
}

/* ============================================================================
 * 🧱 CREATE-LIKE BUILDERS
 * ============================================================================
 */

/**
 * Строит детерминированный draft-id для pre-check/policy контекста.
 *
 * @remarks
 * - ID не предназначен для security-sensitive identity.
 * - Используется как стабильный технический идентификатор в рамках create-like flow.
 */
export function buildDraftBotId(
  input: Readonly<{
    readonly workspaceId: string;
    readonly templateId: string;
    readonly name: string;
    readonly salt?: string | undefined;
  }>,
): BotId {
  const salt = input.salt ?? DRAFT_ID_SALT;
  const source = `${salt}:${input.workspaceId}:${input.templateId}:${input.name}`;
  const hashHex = fnv1a64Hex(source);
  return createBotId(`${BOT_DRAFT_ID_PREFIX}${hashHex}`);
}

/**
 * Формирует transport body для create-запроса из входа orchestrator-а и шаблона.
 *
 * @remarks
 * - `instructionOverride` имеет приоритет над `template.defaultInstruction`.
 * - Функция pure: не модифицирует template и не выполняет IO.
 */
export function buildCreateBotRequestBody(
  input: Readonly<{
    readonly name: string;
    readonly template: BotTemplate;
    readonly instructionOverride?: string | undefined;
  }>,
): BotCreateRequestTransport {
  const resolvedInstruction = input.instructionOverride ?? input.template.defaultInstruction;
  return Object.freeze({
    name: input.name,
    instruction: resolvedInstruction,
    settings: input.template.defaultSettings,
    templateId: input.template.id,
  });
}

/**
 * Нормализует actor-контекст для permission/policy pre-check.
 *
 * @remarks
 * - `userId` отсутствует → `null` (явный fail-closed маркер для проверок).
 * - `role` добавляется только если передан во входе.
 */
export function buildActorUserContext(
  input: Readonly<{
    readonly userId: BotUserId | undefined;
    readonly actorRole: BotRole | undefined;
  }>,
): Readonly<{ readonly userId: string | null; readonly role?: BotRole; }> {
  return Object.freeze({
    userId: input.userId ?? null,
    ...(input.actorRole !== undefined ? { role: input.actorRole } : {}),
  });
}

/* ============================================================================
 * ✅ PRE-CHECKS — PERMISSION / POLICY (FAIL-CLOSED)
 * ============================================================================
 */

/**
 * Проверяет permission для create-like действия и кидает `BotErrorResponse` при deny.
 *
 * @remarks
 * - fail-closed: любое deny-решение конвертируется в canonical bot error response.
 * - `action` можно переопределить для reuse в update/clone/import сценариях.
 */
export function checkCreatePermissionsOrThrow(
  input: Readonly<{
    readonly botPermissions: BotPermissions;
    readonly actorUser: ReturnType<typeof buildActorUserContext>;
    readonly action?: BotAction;
  }>,
): void {
  const action = input.action ?? 'create';
  const permissionDecision = input.botPermissions.canPerform(action, input.actorUser);
  if (!permissionDecision.allow) {
    throw createPermissionDeniedErrorResponse(
      permissionDecision.reason,
      Object.freeze({
        details: Object.freeze({
          type: 'permission',
          action,
          reason: permissionDecision.reason,
        }),
      }),
    );
  }
}

/**
 * Проверяет policy для create-like действия и кидает `BotErrorResponse` при deny.
 *
 * @remarks
 * - По умолчанию action=`configure` (совместимо с текущим create policy flow).
 * - `actorRole` и `userId` обязательны для policy-check; при их отсутствии функция fail-closed.
 * - При отсутствии actor context функция fail-closed с reason=`actor_context_missing`.
 */
export function checkCreatePolicyOrThrow(
  input: Readonly<{
    readonly botPolicy: BotPolicy;
    readonly userId: BotUserId | undefined;
    readonly actorRole: BotRole | undefined;
    readonly policyBotState: BotState;
    readonly action?: BotPolicyAction;
  }>,
): void {
  const action = input.action ?? 'configure';
  const actorCtx = buildActorUserContext({
    userId: input.userId,
    actorRole: input.actorRole,
  });

  if (actorCtx.userId === null || actorCtx.role === undefined) {
    throw createPolicyDeniedErrorResponse(
      'action_not_allowed',
      Object.freeze({
        details: Object.freeze({
          type: 'policy',
          action,
          reason: 'actor_context_missing',
        }),
      }),
    );
  }

  const policyDecision = input.botPolicy.canPerform(action, input.policyBotState, {
    userId: actorCtx.userId,
    role: actorCtx.role,
  });

  if (!policyDecision.allow) {
    throw createPolicyDeniedErrorResponse(
      policyDecision.reason,
      Object.freeze({
        details: Object.freeze({
          type: 'policy',
          action,
          reason: policyDecision.reason,
        }),
      }),
    );
  }
}
