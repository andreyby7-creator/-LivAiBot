/**
 * @file packages/feature-bots/src/effects/create/create-bot.helpers.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot Pure Helpers
 * ============================================================================
 *
 * Архитектурная роль:
 * - Вспомогательный pure-слой для create-like orchestrator-ов (`create-bot-from-template`, `create-custom-bot`).
 * - Инкапсулирует deterministic builders: `buildDraftBotId` / `buildFallbackBotId` (технические BotId), `buildCreateBotRequestBody`,
 *   и pre-check policy/permission **через DI** (`PureGuardsBundle` из composition root — см. `createCreateHelpers`).
 * - Удерживает orchestrator тонким: orchestration/IO остаются в effect-файле, а вычисления/правила — здесь.
 *
 * Принципы:
 * - ✅ Pure/Deterministic: без IO, времени, случайности и внешних side-effects.
 * - ✅ Fail-closed: deny-cases и инварианты формата технических BotId (draft/fallback namespace) → `BotErrorResponse` через `createBotErrorResponse`.
 * - ✅ Без захардкоженных default resolver’ов: guard-резолверы только из переданного `PureGuardsBundle`.
 */

import type {
  BotAction,
  BotPermissions,
  BotPolicy,
  BotPolicyAction,
  BotRole,
  BotState,
} from '@livai/core';

import type { BotId, BotUserId } from '../../domain/Bot.js';
import type { BotTemplate } from '../../domain/BotTemplate.js';
import { createBotErrorResponse } from '../../lib/bot-errors.js';
import type { BotCreateRequestTransport } from '../shared/api-client.port.js';
import type { ActorUserContext, PureGuardsBundle } from '../shared/pure-guards.js';
import { buildActorUserContext } from '../shared/pure-guards.js';

/* ============================================================================
 * 🧮 HASH CONSTANTS — DETERMINISTIC TECHNICAL BotId (draft / fallback)
 * ============================================================================
 */

const DRAFT_ID_SALT = 'create-bot-draft-v1' as const;
const FALLBACK_ID_SALT = 'create-bot-fallback-v1' as const;
const HEX_BASE = 16;
// 64-bit hash => 16 hex chars.
// Вероятность коллизии в ожидаемом namespace draft-id (тысячи/десятки тысяч значений) низкая, но не нулевая.
// Для security-sensitive внешних идентификаторов этот формат использовать нельзя.
const HASH_HEX_LENGTH_64 = 16;
const BOT_DRAFT_ID_PREFIX = 'bot_draft_' as const;
const BOT_DRAFT_ID_PATTERN = /^bot_draft_[0-9a-f]{16}$/;
const BOT_FALLBACK_ID_PREFIX = 'bot_fallback_' as const;
const BOT_FALLBACK_ID_PATTERN = /^bot_fallback_[0-9a-f]{16}$/;

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
function nonCryptoFNV1a64Hex(input: string): string {
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
 * Приводит строку к branded `BotId` по фиксированному regex (draft или fallback namespace).
 *
 * @remarks
 * TypeScript-branding проверяется только на уровне типов. Централизует преобразование и
 * минимальную runtime-валидацию формата технических id (не persisted entity id).
 *
 * @throws `BotErrorResponse` (`BOT_DRAFT_ID_INVALID`), не `Error`.
 */
function brandTechnicalBotId(
  value: string,
  pattern: RegExp,
  idKind: 'draft_bot_id' | 'fallback_bot_id',
): BotId {
  if (!pattern.test(value)) {
    throw createBotErrorResponse({
      code: 'BOT_DRAFT_ID_INVALID',
      context: Object.freeze({
        details: Object.freeze({
          type: idKind,
          reason: 'format_mismatch',
        }),
      }),
    });
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
  const hashHex = nonCryptoFNV1a64Hex(source);
  return brandTechnicalBotId(
    `${BOT_DRAFT_ID_PREFIX}${hashHex}`,
    BOT_DRAFT_ID_PATTERN,
    'draft_bot_id',
  );
}

/**
 * Детерминированный fallback `BotId` для audit/error-path, когда persisted `botId` недоступен.
 *
 * @remarks
 * - Тот же FNV-1a 64-bit + 16 hex, что и {@link buildDraftBotId}, иной salt/prefix (namespace).
 * - Не использовать как security-sensitive identity.
 */
export function buildFallbackBotId(
  input: Readonly<{
    readonly workspaceId: string;
    readonly templateId: string;
    readonly name: string;
  }>,
): BotId {
  const source = `${FALLBACK_ID_SALT}:${input.workspaceId}:${input.templateId}:${input.name}`;
  const hashHex = nonCryptoFNV1a64Hex(source);
  return brandTechnicalBotId(
    `${BOT_FALLBACK_ID_PREFIX}${hashHex}`,
    BOT_FALLBACK_ID_PATTERN,
    'fallback_bot_id',
  );
}

/**
 * Формирует transport body для create-запроса из входа orchestrator-а и шаблона.
 *
 * @remarks
 * - `instructionOverride` имеет приоритет над `template.defaultInstruction`.
 * - `settings` копируется в новый frozen объект, чтобы не протекала мутабельность шаблона.
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
    settings: Object.freeze({ ...input.template.defaultSettings }),
    templateId: input.template.id,
  });
}

/* ============================================================================
 * ✅ PRE-CHECKS — CREATE-LIKE (DI через PureGuardsBundle)
 * ============================================================================
 */

/**
 * Узкий API create-flow поверх `PureGuardsBundle`: без захардкоженных resolver’ов.
 * Собирается через {@link createCreateHelpers} на composition root.
 */
export type CreateBotLikeHelpers = Readonly<{
  readonly checkCreatePermissionsOrThrow: (
    input: Readonly<{
      readonly botPermissions: BotPermissions;
      readonly actorUser: ActorUserContext;
      readonly action: BotAction;
    }>,
  ) => void;
  readonly checkCreatePolicyOrThrow: (
    input: Readonly<{
      readonly botPolicy: BotPolicy;
      readonly policyBotState: BotState;
      readonly action: BotPolicyAction;
      readonly actorUser?: ActorUserContext;
      readonly userId?: BotUserId | undefined;
      readonly actorRole?: BotRole | undefined;
    }>,
  ) => void;
}>;

/**
 * Фабрика create-like pre-check’ов с зафиксированными guard-resolver’ами (multi-tenant / multi-feature).
 *
 * @example
 * ```ts
 * const guards = createPureGuards({
 *   permissionResolver: defaultPermissionErrorCodeResolver,
 *   policyResolver: defaultPolicyErrorCodeResolver,
 * });
 * const createHelpers = createCreateHelpers(guards);
 * createHelpers.checkCreatePermissionsOrThrow({ ..., action: 'create' });
 * ```
 */
export function createCreateHelpers(guards: PureGuardsBundle): CreateBotLikeHelpers {
  return Object.freeze({
    checkCreatePermissionsOrThrow: (permInput): void => {
      guards.checkPermissionsOrThrow({
        botPermissions: permInput.botPermissions,
        actorUser: permInput.actorUser,
        action: permInput.action,
      });
    },
    checkCreatePolicyOrThrow: (policyInput): void => {
      const actorUser = policyInput.actorUser
        ?? buildActorUserContext({
          userId: policyInput.userId,
          actorRole: policyInput.actorRole,
        });
      guards.checkPolicyOrThrow({
        botPolicy: policyInput.botPolicy,
        policyBotState: policyInput.policyBotState,
        action: policyInput.action,
        actorUser,
      });
    },
  });
}
