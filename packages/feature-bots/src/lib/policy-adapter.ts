/**
 * @file packages/feature-bots/src/lib/policy-adapter.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Policy Adapter (core ↔ feature-bots)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Адаптер между `@livai/core` (policy domain types) и feature-bots типами (store/effects/UI).
 * - Преобразует:
 *   - `@livai/core` `BotMode` → `feature-bots` `BotStatus`
 *   - `@livai/core` `BotPolicyAction` → `feature-bots` `BotCommandType`
 *
 * Принципы:
 * - ✅ SRP: только маппинг/адаптация, без бизнес-логики и side-effects.
 * - ✅ Deterministic: вход → один результат, все дополнительные данные передаются явно.
 * - ✅ Strict typing: exhaustive unions, без строковых “магических” сравнений.
 * - ✅ Microservice-ready: не зависит от HTTP/DB и не хранит глобального состояния.
 */

import type { BotMode, BotPolicyAction } from '@livai/core';
import type { ISODateString } from '@livai/core-contracts';

import type { BotCommandType } from '../types/bot-commands.js';
import { BotCommandTypes } from '../types/bot-commands.js';
import type { BotPauseReason } from '../types/bot-lifecycle.js';
import type { BotStatus } from '../types/bots.js';

/* ============================================================================
 * 🧩 INTERNAL HELPERS
 * ========================================================================== */

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

/* ============================================================================
 * 🤝 BotMode → BotStatus
 * ========================================================================== */

export type AdaptBotModeToStatusInput = Readonly<
  | {
    readonly mode: 'draft';
  }
  | {
    readonly mode: 'active';
    /** Дата публикации (явно, без скрытого now()). */
    readonly publishedAt: ISODateString;
  }
  | {
    readonly mode: 'paused';
    /** Дата постановки на паузу (явно, без скрытого now()). */
    readonly pausedAt: ISODateString;
    /** Причина паузы (feature-level semantics). */
    readonly reason: BotPauseReason;
  }
  | {
    readonly mode: 'archived';
    /** Дата архивации (явно, без скрытого now()). */
    readonly archivedAt: ISODateString;
  }
>;

/**
 * Преобразует `BotMode` из core policy в `BotStatus` feature-bots.
 *
 * @remarks
 * `BotMode` не содержит timestamps/reasons, поэтому они передаются явно.
 * Это сохраняет детерминизм и устраняет скрытый coupling к “текущему времени”.
 */
export function adaptBotModeToBotStatus(input: AdaptBotModeToStatusInput): BotStatus {
  switch (input.mode) {
    case 'draft': {
      return { type: 'draft' } as const;
    }
    case 'active': {
      return { type: 'active', publishedAt: input.publishedAt } as const;
    }
    case 'paused': {
      return { type: 'paused', pausedAt: input.pausedAt, reason: input.reason } as const;
    }
    case 'archived': {
      return { type: 'archived', archivedAt: input.archivedAt } as const;
    }
    default: {
      const _exhaustive: never = input;
      return assertNever(_exhaustive);
    }
  }
}

/* ============================================================================
 * 🧭 BotPolicyAction → BotCommandType
 * ========================================================================== */

/**
 * Single source-of-truth: список допустимых policy actions.
 *
 * @remarks
 * Используется для guard и как база для будущих генераций/тестов, чтобы избежать “drift”.
 */
export const AllBotPolicyActions = [
  'configure',
  'publish',
  'pause',
  'resume',
  'execute',
  'archive',
] as const satisfies readonly BotPolicyAction[];

export type BotPolicyActionResolverContext = Readonly<{
  /**
   * Контекст операции на границе rule-engine.
   *
   * @remarks
   * Используется для условного маппинга (например, configure → manage_multi_agent),
   * без усложнения canonical маппинга core policy.
   */
  readonly action: BotPolicyAction;
  /** Опциональная “подсказка” конкретной команды от boundary (UI/effects). */
  readonly commandHint?: BotCommandType | undefined;
}>;

type AdaptBotPolicyActionToCommandOptionsBase = {
  /** Контекст вызова для резолвера (если требуется). */
  readonly context?: Omit<BotPolicyActionResolverContext, 'action'> | undefined;
};

type AdaptBotPolicyActionToCommandOptionsResolver = {
  /**
   * Опциональный резолвер для расширяемости (DI).
   * Если вернёт `BotCommandType` — он будет использован вместо canonical маппинга.
   */
  readonly resolve?: (
    context: BotPolicyActionResolverContext,
  ) => BotCommandType | undefined;
};

export type AdaptBotPolicyActionToCommandOptions = Readonly<
  AdaptBotPolicyActionToCommandOptionsBase & AdaptBotPolicyActionToCommandOptionsResolver
>;

/**
 * Маппит policy action в команду feature-bots.
 *
 * @remarks
 * `configure` — coarse-grained действие политики. На уровне команд feature-bots оно
 * соответствует изменению конфигурации; минимальный канонический маппинг — `update_instruction`.
 * Более специфичные операции (например, multi-agent) должны маппиться отдельными правилами
 * в UI/effects на основе контекста операции, а не через core policy.
 */
export function adaptBotPolicyActionToBotCommandType(
  action: BotPolicyAction,
  options?: Readonly<AdaptBotPolicyActionToCommandOptions>,
): BotCommandType {
  const resolved = options?.resolve?.({
    action,
    ...(options.context ?? {}),
  });
  if (resolved !== undefined) return resolved;

  switch (action) {
    case 'configure':
      return BotCommandTypes.UPDATE_INSTRUCTION;
    case 'publish':
      return BotCommandTypes.PUBLISH_BOT;
    case 'pause':
      return BotCommandTypes.PAUSE_BOT;
    case 'resume':
      return BotCommandTypes.RESUME_BOT;
    case 'execute':
      return BotCommandTypes.SIMULATE_BOT_MESSAGE;
    case 'archive':
      return BotCommandTypes.ARCHIVE_BOT;
    default:
      return assertNever(action);
  }
}

/**
 * Узкий guard: проверяет совместимость `BotMode` runtime-значения с ожидаемыми вариантами.
 *
 * @remarks
 * Используйте на boundary/parsing (API/adapters), чтобы сделать safe parsing и вернуть явную ошибку,
 * вместо silent fallback.
 */
export function isBotMode(value: unknown): value is BotMode {
  return value === 'draft' || value === 'active' || value === 'paused' || value === 'archived';
}

/**
 * Узкий guard: проверяет совместимость `BotPolicyAction` runtime-значения с ожидаемыми вариантами.
 *
 * @remarks
 * Используйте на boundary/parsing (API/adapters), чтобы сделать safe parsing и вернуть явную ошибку,
 * вместо silent fallback.
 */
export function isBotPolicyAction(value: unknown): value is BotPolicyAction {
  return typeof value === 'string'
    && AllBotPolicyActions.includes(value as (typeof AllBotPolicyActions)[number]);
}

/**
 * Парсит runtime значение в `BotMode` или бросает ошибку.
 *
 * @remarks
 * Предназначено для boundary слоя (API/adapters): явная ошибка лучше, чем silent failure.
 */
export function parseBotMode(value: unknown): BotMode {
  if (isBotMode(value)) return value;
  throw new Error(`Invalid BotMode: ${String(value)}`);
}

/**
 * Парсит runtime значение в `BotPolicyAction` или бросает ошибку.
 *
 * @remarks
 * Предназначено для boundary слоя (API/adapters): явная ошибка лучше, чем silent failure.
 */
export function parseBotPolicyAction(value: unknown): BotPolicyAction {
  if (isBotPolicyAction(value)) return value;
  throw new Error(`Invalid BotPolicyAction: ${String(value)}`);
}
