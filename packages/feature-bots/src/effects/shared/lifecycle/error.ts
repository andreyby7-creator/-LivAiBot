/**
 * @file packages/feature-bots/src/effects/shared/lifecycle/error.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Lifecycle Error Boundary (Layer 2)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единственная точка try/catch для нормализации `unknown -> BotError`
 *   и безопасного finalization-управления идемпотентностью при ошибках.
 * - Pipeline/persist/finalize остаются в следующих слоях.
 *
 * Принципы:
 * - deterministic by contract: timestamp берётся из `ctx.auditMeta`
 * - safe finalization: вторичные ошибки IdempotencyPort.fail не ломают основной flow
 */

import type { Effect } from '@livai/core/effect';

import type { BotErrorInput, MapBotErrorConfig } from '../../../lib/error-mapper.js';
import { mapBotErrorToUI } from '../../../lib/error-mapper.js';
import type { BotError } from '../../../types/bots.js';
import type { BotAuditPort } from '../audit.port.js';
import type {
  ExecutionState,
  IdempotencyKey,
  IdempotencyPort,
  LifecycleAuditMapping,
  LifecycleHooks,
  OperationContext,
} from './contracts.js';

/* eslint-disable @livai/multiagent/orchestration-safety -- boundary намеренно выполняет async-вызовы effect/port
 * по контракту AbortSignal от внешнего orchestrator; вторичные ошибки поглощаются по design. */

type ErrorBoundaryContext<TResult = unknown, TAuditEvent = unknown> =
  & OperationContext
  & Readonly<{
    readonly idempotencyPort: IdempotencyPort<TResult, BotError>;
    readonly mapErrorConfig: MapBotErrorConfig;

    readonly hooks?: LifecycleHooks<TResult, BotError> | undefined;
    readonly auditPort?: BotAuditPort<TAuditEvent> | undefined;
    readonly auditMapping?: LifecycleAuditMapping<TResult, TAuditEvent, BotError> | undefined;
  }>;

function buildAbortedExecutionState(ctx: OperationContext): ExecutionState {
  return Object.freeze({
    status: 'aborted',
    abortedAt: ctx.auditMeta.timestamp,
  });
}

function normalizeUnknownToBotError(
  input: unknown,
  config: MapBotErrorConfig,
): BotError {
  // mapBotErrorToUI гарантирует canonical metadata через rule-engine:
  // BotError → normalizeBotError; BotErrorResponse/Error/string → rules/fallback.
  return mapBotErrorToUI(input as BotErrorInput, config);
}

function safeFailIdempotency<TResult>(
  port: IdempotencyPort<TResult, BotError>,
  key: IdempotencyKey,
  ctx: OperationContext,
  error: BotError,
): Effect<void> {
  return async (signal?: AbortSignal): Promise<void> => {
    // Для boundary-нормализации фиксируем edge-state `aborted` для идемпотентного record,
    // чтобы pipeline четко понимала: execution не дошёл до domain_success/persist/finalize.
    const executionState = buildAbortedExecutionState(ctx);

    try {
      const existing = await port.get(key)(signal);
      // Не создаём multiple finals: если уже completed/failed — fail no-op.
      if (existing !== null && (existing.status === 'completed' || existing.status === 'failed')) {
        return;
      }

      await port.fail(key, executionState, error)(signal);
    } catch {
      // safe finalization: secondary errors не должны ломать основной error propagation.
    }
  };
}

function bestEffortRunOnErrorHooks<TResult>(
  hooks: LifecycleHooks<TResult, BotError> | undefined,
  error: BotError,
): void {
  if (hooks?.onError === undefined) return;
  try {
    const pending = Promise.resolve(hooks.onError(error));
    pending.catch(() => undefined);
  } catch {
    // Hooks failure must not break main flow.
  }
}

function maybeEmitFailureAuditEvent<TResult, TAuditEvent>(
  auditPort: BotAuditPort<TAuditEvent> | undefined,
  mapping: LifecycleAuditMapping<TResult, TAuditEvent, BotError> | undefined,
  error: BotError,
): void {
  if (auditPort === undefined || mapping === undefined) return;
  const mapper = mapping.mapFailureAuditEvent;
  if (mapper === undefined) return;
  try {
    auditPort.emit(mapper(error));
  } catch {
    // Audit emit best-effort.
  }
}

/**
 * withErrorBoundary: try/catch point для lifecycle/pipeline.
 *
 * @remarks
 * - Нормализует ошибку наружу в `BotError`.
 * - Делает safe `IdempotencyPort.fail` (best-effort) до проброса ошибки вверх.
 */
export function withErrorBoundary<TResult, TAuditEvent = unknown>(
  ctx: ErrorBoundaryContext<TResult, TAuditEvent>,
  fn: () => Effect<TResult>,
): Effect<TResult> {
  return async (signal?: AbortSignal): Promise<TResult> => {
    try {
      return await fn()(signal);
    } catch (error: unknown) {
      const botError = normalizeUnknownToBotError(error, ctx.mapErrorConfig);

      // Error-path side-effects: best-effort hooks + audit.
      bestEffortRunOnErrorHooks<TResult>(ctx.hooks, botError);
      maybeEmitFailureAuditEvent<TResult, TAuditEvent>(ctx.auditPort, ctx.auditMapping, botError);

      // Best-effort finalization: даже если fail не удалось — прокидываем botError.
      await safeFailIdempotency<TResult>(
        ctx.idempotencyPort,
        ctx.operationId,
        ctx,
        botError,
      )(signal);

      throw botError;
    }
  };
}

/* eslint-enable @livai/multiagent/orchestration-safety */
