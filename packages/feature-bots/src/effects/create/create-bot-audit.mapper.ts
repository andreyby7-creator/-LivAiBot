/**
 * @file packages/feature-bots/src/effects/create/create-bot-audit.mapper.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot Audit Event Mapper
 * ============================================================================
 *
 * Назначение:
 * - Pure mapper: превращает success/failure create-flow данные в `BotAuditEventValues`.
 * - Не делает IO: только сборка + fail-closed валидация через `botAuditEventSchema`.
 *
 * Архитектурные принципы:
 * - Консистентность событий через канонические шаблоны `createBotAuditEventTemplate`.
 * - Anti-drift: в audit.context кладутся только scalar-значения (string/number/boolean),
 *   чтобы не нарушать схему audit-context.
 * - Security wrapper: перед формированием audit payload идентификаторы (botId/workspaceId/userId)
 *   редактируются, чтобы исключить утечку “сырых” значений upstream'а.
 */

import type { BotId, BotUserId, BotWorkspaceId } from '../../domain/Bot.js';
import type { BotAuditEventValues } from '../../schemas/index.js';
import { botAuditEventSchema } from '../../schemas/index.js';
import type { BotError, BotInfo } from '../../types/bots.js';
import { createBotAuditEventTemplate } from '../../types/bots-initial.js';

/* ============================================================================
 * 🧭 CONTEXT TYPES
 * ============================================================================
 */

export type CreateBotSuccessAuditContext = Readonly<{
  /** Уникальный идентификатор audit-события (gen в orchestrator). */
  readonly eventId: string;
  /** Unix-ms или другой позитивный int timestamp (согласовать на уровне orchestrator). */
  readonly timestamp: number;
  /**
   * Correlation/trace ID (опционально).
   *
   * Contract note: mapper использует `traceId` только как scalar-поле в `audit.context`.
   * Схема audit-context допускает отсутствие поля, поэтому optionality безопасна.
   * `traceId` НЕ редактируется в этом mapper'е.
   */
  readonly traceId?: string;
  /**
   * Инициатор (опционально).
   *
   * Contract note: `createBotAuditEventTemplate(..., userId?: BotUserId, ...)` допускает
   * отсутствие userId, а доменная модель `BotAuditEvent.userId?` тоже optional.
   */
  readonly userId?: BotUserId;
}>;

export type CreateBotFailureAuditContext = Readonly<{
  readonly eventId: string;
  readonly timestamp: number;
  readonly botId: BotId;
  readonly workspaceId: BotWorkspaceId;
  /** Correlation/trace ID (опционально, scalar-поле в `audit.context`). */
  readonly traceId?: string;
  /**
   * Инициатор (опционально).
   *
   * Contract note: `createBotAuditEventTemplate(..., userId?: BotUserId, ...)` допускает
   * отсутствие userId, а доменная модель `BotAuditEvent.userId?` тоже optional.
   */
  readonly userId?: BotUserId;
}>;

type ScalarAuditCtx = Readonly<Record<string, string | number | boolean>>;

/* ============================================================================
 * 🔒 SECURITY REDACTION WRAPPER (не domain-операция)
 * ============================================================================
 *
 * В production audit пайплайне нельзя полагаться на то, что upstream значения
 * (например, bot.id / userId) не являются чувствительными.
 *
 * Здесь мы делаем conservative redaction как security wrapper (без изменения
 * domain-семантики на уровне store/effects). Это не “domain operation” — это
 * защитный слой только для формирования audit payload.
 *
 * Redaction scope (только ключевые id):
 * - botId
 * - workspaceId
 * - userId (опционально)
 *
 * Любые другие поля из `BotInfo` / `BotError` в этом mapper'е не редактируются.
 *
 * Другие поля `BotInfo` / `BotError` не редактируются этим mapper'ом: их
 * безопасность должна обеспечиваться upstream policy/sanitize layer'ом.
 *
 * Примечание: `traceId` не редактируется в этом mapper'е. Он используется как correlation/trace ID
 * и должен быть безопасным по policy на стороне upstream'а.
 *
 * Реализация: deterministic hash (FNV-1a 32bit) + префикс.
 * На уровне runtime это строка, которая проходит schema validation
 * (trim/length/структура).
 */

const fnv1a32 = (input: string): number => {
  let hash = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Deterministic: один и тот же вход всегда даёт один и тот же “заменитель” строки.
  return hash >>> 0;
};

const REDACTION_HASH_BASE = 16;
const redactId = (id: string): string => `redacted_${fnv1a32(id).toString(REDACTION_HASH_BASE)}`;

const redactBotId = (id: BotId): BotId => redactId(id) as BotId;
const redactWorkspaceId = (id: BotWorkspaceId): BotWorkspaceId => redactId(id) as BotWorkspaceId;
const redactOptionalUserId = (id: BotUserId | undefined): BotUserId | undefined =>
  id === undefined ? undefined : redactId(id) as BotUserId;

function parseAuditEvent(
  base: Readonly<Record<string, unknown>>,
  meta: Readonly<{ eventId: string; timestamp: number; }>,
): BotAuditEventValues {
  return botAuditEventSchema.parse({
    ...base,
    eventId: meta.eventId,
    timestamp: meta.timestamp,
  });
}

type CreateAuditError = Readonly<{
  readonly code: BotError['code'];
  readonly category: BotError['category'];
  readonly severity: BotError['severity'];
  readonly retryable: BotError['retryable'];
}>;

// eslint-disable-next-line @livai/rag/context-leakage -- чистые builder'ы (не хранят user/session данные)
const buildCreateSuccessAuditCtx = (
  args: Readonly<{
    readonly traceId?: string | undefined;
  }>,
): ScalarAuditCtx => {
  const ctx: Record<string, string | number | boolean> = {
    stage: 'create',
    result: 'success',
    ...(args.traceId !== undefined ? { traceId: args.traceId } : {}),
  };
  return Object.freeze(ctx);
};

// eslint-disable-next-line @livai/rag/context-leakage -- чистые builder'ы (не хранят user/session данные)
const buildCreateFailureAuditCtx = (
  args: Readonly<{
    readonly traceId?: string | undefined;
    readonly error: CreateAuditError;
  }>,
): ScalarAuditCtx => {
  const ctx: Record<string, string | number | boolean> = {
    stage: 'create',
    result: 'failed',
    ...(args.traceId !== undefined ? { traceId: args.traceId } : {}),
    errorCode: args.error.code,
    errorCategory: args.error.category,
    errorSeverity: args.error.severity,
    errorRetryable: args.error.retryable,
  };
  return Object.freeze(ctx);
};

const CREATE_AUDIT_BUILDERS = Object.freeze(
  {
    success: (
      args: Readonly<{
        readonly traceId?: string | undefined;
      }>,
    ): ScalarAuditCtx => buildCreateSuccessAuditCtx(args),
    failed: (
      args: Readonly<{
        readonly traceId?: string | undefined;
        readonly error: CreateAuditError;
      }>,
    ): ScalarAuditCtx => buildCreateFailureAuditCtx(args),
  } satisfies CreateAuditBuilders,
);

type CreateAuditResult = 'success' | 'failed';

type CreateAuditBuilderArgs<K extends CreateAuditResult> = K extends 'success'
  ? Readonly<{ readonly traceId?: string | undefined; }>
  : Readonly<{ readonly traceId?: string | undefined; readonly error: CreateAuditError; }>;

type CreateAuditBuilderFn<K extends CreateAuditResult> = (
  args: CreateAuditBuilderArgs<K>,
) => ScalarAuditCtx;

type CreateAuditBuilders = Readonly<{
  readonly success: CreateAuditBuilderFn<'success'>;
  readonly failed: CreateAuditBuilderFn<'failed'>;
}>;

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

/**
 * Маппит BotInfo (success create-flow) в `BotAuditEventValues`.
 *
 * @remarks
 * Event type для create success: `bot_created`.
 * Fail-closed: schema mismatch → throw (architectural bug / upstream contract breach).
 */
export function mapCreateBotResultToAuditEvent(
  bot: BotInfo,
  context: CreateBotSuccessAuditContext,
): BotAuditEventValues {
  const auditContext = CREATE_AUDIT_BUILDERS.success({
    traceId: context.traceId,
  });

  // Security wrapper: редактируем идентификаторы перед формированием audit payload.
  const base = createBotAuditEventTemplate(
    'bot_created',
    redactBotId(bot.id),
    redactWorkspaceId(bot.workspaceId),
    redactOptionalUserId(context.userId),
    auditContext,
  );

  return parseAuditEvent(base, { eventId: context.eventId, timestamp: context.timestamp });
}

/**
 * Маппит BotError (failure create-flow) в `BotAuditEventValues`.
 *
 * @remarks
 * Для create failure audit schema требует `botId` и `workspaceId`,
 * поэтому они передаются в `CreateBotFailureAuditContext`.
 *
 * Event type использует `bot_created`, а в context дополнительно кладётся
 * `result=failed` и scalar-описание ошибки.
 */
export function mapCreateBotErrorToAuditEvent(
  error: BotError,
  context: CreateBotFailureAuditContext,
): BotAuditEventValues {
  const auditContext = CREATE_AUDIT_BUILDERS.failed({
    traceId: context.traceId,
    error: {
      code: error.code,
      category: error.category,
      severity: error.severity,
      retryable: error.retryable,
    },
  });

  // Security wrapper: редактируем идентификаторы перед формированием audit payload.
  const base = createBotAuditEventTemplate(
    'bot_created',
    redactBotId(context.botId),
    redactWorkspaceId(context.workspaceId),
    redactOptionalUserId(context.userId),
    auditContext,
  );

  return parseAuditEvent(base, { eventId: context.eventId, timestamp: context.timestamp });
}
