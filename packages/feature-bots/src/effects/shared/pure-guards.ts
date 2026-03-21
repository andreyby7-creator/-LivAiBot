/**
 * @file packages/feature-bots/src/effects/shared/pure-guards.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Shared Pure Guards (Permission / Policy)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Общий pure-слой для всех bot-эффектов: маппинг deny-reason → `BotErrorCode`,
 *   фабрики `BotErrorResponse`, нормализация actor-контекста и fail-closed pre-check’и
 *   поверх `@livai/core` `BotPermissions` / `BotPolicy`.
 * - Доменные билдеры transport/DTO и flow-специфичная логика остаются в per-flow helper-модулях
 *   (например `create-bot.helpers.ts`) рядом с orchestrator.
 *
 * Принципы:
 * - ✅ Pure/Deterministic: без IO, времени, случайности и внешних side-effects.
 * - ✅ Fail-closed: deny-cases конвертируются в `BotErrorResponse` через единый `createBotErrorResponse`.
 * - ✅ Разделение ответственности: assert actor / evaluate policy / map → error — отдельные функции;
 *   `checkPolicyOrThrow` / `checkPermissionsOrThrow` только композируют их (тонкие orchestration guards).
 *
 * @remarks Гранулярность кодов (permission vs policy), DI-resolver’ы и соответствия reason→code — один раз
 *   описаны в блоке «Error model» у секции DEFAULT ERROR CODE TABLES (рядом с константами).
 * - Резолверы `reason → BotErrorCode` **не** подставляются по умолчанию в публичных guard-функциях: их передаёт
 *   composition root (явный аргумент). Экспорт `defaultPermissionErrorCodeResolver` / `defaultPolicyErrorCodeResolver` —
 *   готовые таблицы feature-bots для импорта и передачи снаружи.
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
import type { BotUserId } from '../../domain/Bot.js';
import { createBotErrorResponse } from '../../lib/bot-errors.js';
import type { BotErrorCode, BotErrorContext } from '../../types/bots.js';

/* ============================================================================
 * 🧩 TYPES — GUARD DETAILS & EXTENDED REASONS
 * ============================================================================
 */

/** Причина policy-deny из core **или** внутренний маркер отсутствия actor-контекста. */
export type ExtendedPolicyReason = BotPolicyDeniedReason | 'actor_context_missing';

/** Детали ошибки permission-guard (discriminated union). */
export type GuardPermissionErrorDetails = Readonly<{
  readonly type: 'permission';
  readonly action: BotAction;
  readonly reason: BotPermissionDeniedReason;
}>;

/** Детали ошибки policy-guard (discriminated union). */
export type GuardPolicyErrorDetails = Readonly<{
  readonly type: 'policy';
  readonly action: BotPolicyAction;
  readonly reason: ExtendedPolicyReason;
}>;

/** Union деталей для buildGuardErrorContext → context.details. */
export type GuardErrorDetails = GuardPermissionErrorDetails | GuardPolicyErrorDetails;

/** BotPermissionDeniedReason → BotErrorCode. */
export type PermissionErrorCodeResolver = (reason: BotPermissionDeniedReason) => BotErrorCode;

/** ExtendedPolicyReason → BotErrorCode. */
export type PolicyErrorCodeResolver = (reason: ExtendedPolicyReason) => BotErrorCode;

/* ============================================================================
 * 🔒 DEFAULT ERROR CODE TABLES — PERMISSION / POLICY
 * ============================================================================
 */

/*
 * Error model — единственное место с полным описанием гранулярности в этом модуле:
 * - Permission: coarse — все BotPermissionDeniedReason → один BotErrorCode (см. permissionErrorCodeByReason);
 *   отличия сценариев — в context.details (GuardPermissionErrorDetails, поле reason, buildGuardErrorContext).
 * - Policy: fine — разные BotErrorCode по причине (policyErrorCodeByReason) и ExtendedPolicyReason
 *   (policyErrorCodeByExtendedReason; `actor_context_missing` → `BOT_POLICY_ACTOR_CONTEXT_MISSING`).
 * - Override: PermissionErrorCodeResolver / PolicyErrorCodeResolver — свои таблицы без правки типов в @livai/core.
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

/* eslint-disable @livai/rag/context-leakage -- spread статических таблиц policy reason→code, не user content */
const policyErrorCodeByExtendedReason: Readonly<Record<ExtendedPolicyReason, BotErrorCode>> = Object
  .freeze({
    ...policyErrorCodeByReason,
    actor_context_missing: 'BOT_POLICY_ACTOR_CONTEXT_MISSING',
  });
/* eslint-enable @livai/rag/context-leakage */

/**
 * Фабрика внутренних инвариантов маппинга (таблица reason→code не покрывает core enum).
 * Возвращает канонический `BotErrorResponse`, не `Error`, чтобы не обходить lifecycle/error normalizer.
 */
export function createPureGuardsMappingInvariantBotErrorResponse(
  scope: string,
  message: string,
): BotErrorResponse {
  return createBotErrorResponse({
    code: 'BOT_GUARD_INVARIANT_VIOLATION',
    context: Object.freeze({
      details: Object.freeze({
        type: 'pure_guards_invariant',
        layer: 'pure-guards',
        scope,
        message,
      }),
    }),
  });
}

function throwPureGuardsMappingInvariantBotErrorResponse(scope: string, message: string): never {
  throw createPureGuardsMappingInvariantBotErrorResponse(scope, message);
}

/**
 * Runtime-guard: новый `BotPermissionDeniedReason` из core без строки в таблице → fail-closed.
 *
 * @throws Всегда `BotErrorResponse` (`BOT_GUARD_INVARIANT_VIOLATION`), не `Error`.
 */
function assertPermissionReasonMapped(reason: BotPermissionDeniedReason): void {
  if (!Object.hasOwn(permissionErrorCodeByReason, reason)) {
    throwPureGuardsMappingInvariantBotErrorResponse(
      'permission_reason_mapping',
      `Unhandled BotPermissionDeniedReason — обновите permissionErrorCodeByReason: ${
        String(reason)
      }`,
    );
  }
}

/**
 * Runtime-guard: неизвестный `ExtendedPolicyReason` относительно таблицы → fail-closed.
 *
 * @throws Всегда `BotErrorResponse` (`BOT_GUARD_INVARIANT_VIOLATION`), не `Error`.
 */
function assertPolicyReasonMapped(reason: ExtendedPolicyReason): void {
  if (!Object.hasOwn(policyErrorCodeByExtendedReason, reason)) {
    throwPureGuardsMappingInvariantBotErrorResponse(
      'policy_reason_mapping',
      `Unhandled ExtendedPolicyReason — обновите policyErrorCodeByExtendedReason: ${
        String(reason)
      }`,
    );
  }
}

/** Дефолт: permissionErrorCodeByReason. */
export const defaultPermissionErrorCodeResolver: PermissionErrorCodeResolver = (
  reason: BotPermissionDeniedReason,
): BotErrorCode => {
  assertPermissionReasonMapped(reason);
  // eslint-disable-next-line security/detect-object-injection -- ключ проверен assertPermissionReasonMapped
  return permissionErrorCodeByReason[reason];
};

/** Дефолтный резолвер кодов policy (таблица feature-bots, включая actor_context_missing). */
export const defaultPolicyErrorCodeResolver: PolicyErrorCodeResolver = (
  reason: ExtendedPolicyReason,
): BotErrorCode => {
  assertPolicyReasonMapped(reason);
  // eslint-disable-next-line security/detect-object-injection -- ключ проверен assertPolicyReasonMapped
  return policyErrorCodeByExtendedReason[reason];
};

/** Резолвер из переданной таблицы permission (override per feature). */
export function createPermissionErrorCodeResolver(
  mapping: Readonly<Record<BotPermissionDeniedReason, BotErrorCode>>,
): PermissionErrorCodeResolver {
  return (reason: BotPermissionDeniedReason): BotErrorCode => {
    if (!Object.hasOwn(mapping, reason)) {
      throwPureGuardsMappingInvariantBotErrorResponse(
        'permission_resolver_factory',
        `missing key ${String(reason)}`,
      );
    }
    // eslint-disable-next-line security/detect-object-injection -- ключ проверен выше
    return mapping[reason];
  };
}

/** Резолвер из переданной таблицы policy (включая extended-причины). */
export function createPolicyErrorCodeResolver(
  mapping: Readonly<Record<ExtendedPolicyReason, BotErrorCode>>,
): PolicyErrorCodeResolver {
  return (reason: ExtendedPolicyReason): BotErrorCode => {
    if (!Object.hasOwn(mapping, reason)) {
      throwPureGuardsMappingInvariantBotErrorResponse(
        'policy_resolver_factory',
        `missing key ${String(reason)}`,
      );
    }
    // eslint-disable-next-line security/detect-object-injection -- ключ проверен выше
    return mapping[reason];
  };
}

/** Единый builder BotErrorContext.details для guard-ошибок (без дублирования Object.freeze). */
export function buildGuardErrorContext(details: GuardErrorDetails): Readonly<BotErrorContext> {
  const frozenDetails = Object.freeze(details) as NonNullable<BotErrorContext['details']>;
  return Object.freeze({
    details: frozenDetails,
  });
}

/** Внутренний helper: createBotErrorResponse + опциональный context (без дублирования в публичных фабриках). */
function botErrorResponseWithOptionalContext(
  code: BotErrorCode,
  context?: Readonly<BotErrorContext> | undefined,
): BotErrorResponse {
  return createBotErrorResponse({
    code,
    ...(context !== undefined ? { context } : {}),
  });
}

/** Canonical BotErrorResponse для deny от BotPermissions; `resolveCode` передаётся с composition root. */
export function createPermissionDeniedErrorResponse(
  reason: BotPermissionDeniedReason,
  resolveCode: PermissionErrorCodeResolver,
  context?: Readonly<BotErrorContext> | undefined,
): BotErrorResponse {
  return botErrorResponseWithOptionalContext(resolveCode(reason), context);
}

/** Canonical BotErrorResponse для deny от policy / внутренних policy-guard маркеров; `resolveCode` с composition root. */
export function createPolicyDeniedErrorResponse(
  reason: ExtendedPolicyReason,
  resolveCode: PolicyErrorCodeResolver,
  context?: Readonly<BotErrorContext> | undefined,
): BotErrorResponse {
  return botErrorResponseWithOptionalContext(resolveCode(reason), context);
}

/* ============================================================================
 * 👤 ACTOR USER CONTEXT
 * ============================================================================
 */

/** Нормализованный actor-контекст для permission/policy pre-check. */
export type ActorUserContext = Readonly<{
  readonly userId: string | null;
  readonly role?: BotRole;
}>;

/** Actor с обязательными полями для вызова BotPolicy.canPerform. */
export type PolicyActorUserContext =
  & ActorUserContext
  & Readonly<{
    readonly userId: string;
    readonly role: BotRole;
  }>;

/** Нормализует actor для pre-check: userId без входа → null (fail-closed); role только если передан во входе. */
export function buildActorUserContext(
  input: Readonly<{
    readonly userId: BotUserId | undefined;
    readonly actorRole: BotRole | undefined;
  }>,
): ActorUserContext {
  return Object.freeze({
    userId: input.userId ?? null,
    ...(input.actorRole !== undefined ? { role: input.actorRole } : {}),
  });
}

export function isCompleteActorForPolicy(
  actorCtx: ActorUserContext,
): actorCtx is PolicyActorUserContext {
  return actorCtx.userId !== null && actorCtx.role !== undefined;
}

/** Fail-closed: неполный actor для policy → throw `BotErrorResponse` с reason actor_context_missing. */
export function assertActorContextForPolicyOrThrow(
  actorCtx: ActorUserContext,
  action: BotPolicyAction,
  resolveCode: PolicyErrorCodeResolver,
): asserts actorCtx is PolicyActorUserContext {
  if (isCompleteActorForPolicy(actorCtx)) {
    return;
  }
  throw createPolicyDeniedErrorResponse(
    'actor_context_missing',
    resolveCode,
    buildGuardErrorContext({
      type: 'policy',
      action,
      reason: 'actor_context_missing',
    }),
  );
}

/** Чистая оценка policy (без throw); полный actor обязателен — сначала assertActorContextForPolicyOrThrow. */
export function evaluatePolicyDecision(
  input: Readonly<{
    readonly botPolicy: BotPolicy;
    readonly policyBotState: BotState;
    readonly action: BotPolicyAction;
    readonly actorUser: PolicyActorUserContext;
  }>,
): ReturnType<BotPolicy['canPerform']> {
  return input.botPolicy.canPerform(input.action, input.policyBotState, {
    userId: input.actorUser.userId,
    role: input.actorUser.role,
  });
}

/** При decision.allow — no-op; при deny — throw createPolicyDeniedErrorResponse (после evaluatePolicyDecision). */
export function throwPolicyDeniedOrReturn(
  decision: ReturnType<BotPolicy['canPerform']>,
  action: BotPolicyAction,
  resolveCode: PolicyErrorCodeResolver,
): void {
  if (decision.allow) {
    return;
  }
  throw createPolicyDeniedErrorResponse(
    decision.reason,
    resolveCode,
    buildGuardErrorContext({
      type: 'policy',
      action,
      reason: decision.reason,
    }),
  );
}

/* ============================================================================
 * ✅ PRE-CHECKS — PERMISSION / POLICY (FAIL-CLOSED)
 * ============================================================================
 */

/** Permission для BotAction; при deny — BotErrorResponse с GuardPermissionErrorDetails в context. */
export function checkPermissionsOrThrow(
  input: Readonly<{
    readonly botPermissions: BotPermissions;
    readonly actorUser: ActorUserContext;
    readonly action: BotAction;
  }>,
  resolveCode: PermissionErrorCodeResolver,
): void {
  const { action } = input;
  const permissionDecision = input.botPermissions.canPerform(action, input.actorUser);
  if (!permissionDecision.allow) {
    throw createPermissionDeniedErrorResponse(
      permissionDecision.reason,
      resolveCode,
      buildGuardErrorContext({
        type: 'permission',
        action,
        reason: permissionDecision.reason,
      }),
    );
  }
}

export type CheckPolicyOrThrowInput = Readonly<{
  readonly botPolicy: BotPolicy;
  readonly policyBotState: BotState;
  readonly action: BotPolicyAction;
  readonly actorUser: ActorUserContext;
}>;

/** Policy для BotPolicyAction; actorUser уже нормализован (buildActorUserContext), чтобы не дублировать контекст. Композиция: assertActorContextForPolicyOrThrow → evaluatePolicyDecision → throwPolicyDeniedOrReturn. */
export function checkPolicyOrThrow(
  input: CheckPolicyOrThrowInput,
  resolveCode: PolicyErrorCodeResolver,
): void {
  const { action, actorUser } = input;
  assertActorContextForPolicyOrThrow(actorUser, action, resolveCode);
  const decision = evaluatePolicyDecision({
    botPolicy: input.botPolicy,
    policyBotState: input.policyBotState,
    action,
    actorUser,
  });
  throwPolicyDeniedOrReturn(decision, action, resolveCode);
}

/* ============================================================================
 * 🧱 COMPOSITION ROOT — BOUND RESOLVERS (MULTI-TENANT / MULTI-FEATURE)
 * ============================================================================
 */

/**
 * Резолверы с composition root: tenant/feature подставляет таблицы `reason → BotErrorCode`.
 * Оба поля обязательны (нет silent default внутри фабрики).
 */
export type CreatePureGuardsInput = Readonly<{
  readonly permissionResolver: PermissionErrorCodeResolver;
  readonly policyResolver: PolicyErrorCodeResolver;
}>;

/** API с уже привязанными резолверами (удобно передавать в orchestrator без повторного прокидывания аргумента). */
export type PureGuardsBundle = Readonly<{
  readonly permissionResolver: PermissionErrorCodeResolver;
  readonly policyResolver: PolicyErrorCodeResolver;
  readonly createPermissionDeniedErrorResponse: (
    reason: BotPermissionDeniedReason,
    context?: Readonly<BotErrorContext> | undefined,
  ) => BotErrorResponse;
  readonly createPolicyDeniedErrorResponse: (
    reason: ExtendedPolicyReason,
    context?: Readonly<BotErrorContext> | undefined,
  ) => BotErrorResponse;
  readonly checkPermissionsOrThrow: (input: {
    readonly botPermissions: BotPermissions;
    readonly actorUser: ActorUserContext;
    readonly action: BotAction;
  }) => void;
  readonly checkPolicyOrThrow: (input: CheckPolicyOrThrowInput) => void;
  readonly assertActorContextForPolicyOrThrow: (
    actorCtx: ActorUserContext,
    action: BotPolicyAction,
  ) => asserts actorCtx is PolicyActorUserContext;
  readonly throwPolicyDeniedOrReturn: (
    decision: ReturnType<BotPolicy['canPerform']>,
    action: BotPolicyAction,
  ) => void;
}>;

/**
 * Фабрика guard-API с зафиксированными резолверами (передаются явно, обычно `default*` из этого модуля).
 *
 * @example
 * ```ts
 * const guards = createPureGuards({
 *   permissionResolver: defaultPermissionErrorCodeResolver,
 *   policyResolver: defaultPolicyErrorCodeResolver,
 * });
 * guards.checkPolicyOrThrow({ ... });
 * ```
 */
export function createPureGuards(input: CreatePureGuardsInput): PureGuardsBundle {
  const { permissionResolver, policyResolver } = input;

  function boundAssertActorContextForPolicyOrThrow(
    actorCtx: ActorUserContext,
    action: BotPolicyAction,
  ): asserts actorCtx is PolicyActorUserContext {
    assertActorContextForPolicyOrThrow(actorCtx, action, policyResolver);
  }

  return Object.freeze(
    {
      permissionResolver,
      policyResolver,
      createPermissionDeniedErrorResponse: (
        reason: BotPermissionDeniedReason,
        context?: Readonly<BotErrorContext> | undefined,
      ) => createPermissionDeniedErrorResponse(reason, permissionResolver, context),
      createPolicyDeniedErrorResponse: (
        reason: ExtendedPolicyReason,
        context?: Readonly<BotErrorContext> | undefined,
      ) => createPolicyDeniedErrorResponse(reason, policyResolver, context),
      checkPermissionsOrThrow: (permInput: {
        readonly botPermissions: BotPermissions;
        readonly actorUser: ActorUserContext;
        readonly action: BotAction;
      }): void => {
        checkPermissionsOrThrow(permInput, permissionResolver);
      },
      checkPolicyOrThrow: (policyInput: CheckPolicyOrThrowInput): void => {
        checkPolicyOrThrow(policyInput, policyResolver);
      },
      assertActorContextForPolicyOrThrow: boundAssertActorContextForPolicyOrThrow,
      throwPolicyDeniedOrReturn: (
        decision: ReturnType<BotPolicy['canPerform']>,
        action: BotPolicyAction,
      ): void => {
        throwPolicyDeniedOrReturn(decision, action, policyResolver);
      },
    } satisfies PureGuardsBundle,
  );
}
