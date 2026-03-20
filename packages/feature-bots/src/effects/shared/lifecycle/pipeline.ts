/**
 * @file packages/feature-bots/src/effects/shared/lifecycle/pipeline.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Lifecycle Execution Pipeline (Layer 3)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Полноценная execution-логика lifetime/pipeline:
 *   execute → map → persist → finalized → side-effects
 * - Реализует idempotency guard и строгую последовательность (no partial persist
 *   when mappingResult is `ok=false`).
 *
 * Важно:
 * - try/catch и нормализация unknown→BotError выполняются в `error.ts`.
 * - Этот модуль делает deterministic-решения на основе idempotency record и чистого mapping.
 */

import type { Effect } from '@livai/core/effect';

import type { BotError } from '../../../types/bots.js';
import type { BotAuditPort } from '../audit.port.js';
import type { BotsStorePort } from '../bots-store.port.js';
import type {
  ExecutionState,
  IdempotencyKey,
  IdempotencyPort,
  LifecycleAuditMapping,
  LifecycleHooks,
  OperationContext,
  RetryConfig,
} from './contracts.js';

/* eslint-disable @livai/multiagent/orchestration-safety -- Это orchestrator-layer pipeline:
 * последовательность async Effect/port вызовов контролируется AbortSignal из внешнего контракта.
 * Таймауты задаются уровнем выше (operation-lifecycle/orchestrator), здесь фиксируем deterministic порядок. */

export type MappingResult<TResult = unknown> = Readonly<
  | Readonly<{ readonly ok: true; readonly value: TResult; }>
  | Readonly<{ readonly ok: false; readonly error: BotError; }>
>;

export type ExecuteEffect<TRaw> = Effect<TRaw>;

export type MapEffect<TRaw, TResult> = (raw: TRaw) => MappingResult<TResult>;

export type PersistEffect<TResult> = (storePort: BotsStorePort, value: TResult) => Effect<void>;

export type ExecutePipelineDeps<TResult, TAuditEvent = unknown> = Readonly<{
  readonly botsStorePort: BotsStorePort;
  readonly idempotencyPort: IdempotencyPort<TResult, BotError>;
  readonly auditPort?: BotAuditPort<TAuditEvent> | undefined;
  readonly auditMapping?: LifecycleAuditMapping<TResult, TAuditEvent, BotError> | undefined;
  readonly hooks?: LifecycleHooks<TResult, BotError> | undefined;
  readonly retryConfig?: RetryConfig | undefined;
}>;

export type ExecutePipelineInput<TRaw, TResult> = Readonly<{
  readonly execute: ExecuteEffect<TRaw>;
  readonly mapResult: MapEffect<TRaw, TResult>;
  readonly persist: PersistEffect<TResult>;
}>;

function executionStateFinalized(): ExecutionState {
  return Object.freeze({ status: 'finalized' });
}

function getMaxRetries(config: RetryConfig | undefined): number {
  const max = config?.maxRetries;
  return typeof max === 'number' && Number.isFinite(max) && max >= 0 ? max : 0;
}

function executionStateAborted(ctx: OperationContext): ExecutionState {
  return Object.freeze({
    status: 'aborted',
    abortedAt: ctx.auditMeta.timestamp,
  });
}

async function withBoundedRetry(
  attempt: number,
  maxAttempts: number,
  thunk: () => Promise<void>,
): Promise<void> {
  // no-op bounded retry: deterministic because there is no backoff/jitter.
  try {
    await thunk();
  } catch (err) {
    if (attempt >= maxAttempts) throw err;
    await withBoundedRetry(attempt + 1, maxAttempts, thunk);
  }
}

function swallowHookRejection(promise: Promise<void>): void {
  promise.catch(() => undefined);
}

function bestEffortRunHooks<TResult>(
  hooks: LifecycleHooks<TResult, BotError> | undefined,
  input: {
    readonly ok: true;
    readonly value: TResult;
  } | {
    readonly ok: false;
    readonly error: BotError;
  },
): void {
  if (hooks === undefined) return;

  // Hooks mode пока не материализован отдельно: v1 всегда best-effort и без влияния на core flow.

  try {
    if (input.ok) {
      if (hooks.onSuccess !== undefined) {
        const promise = Promise.resolve(hooks.onSuccess(input.value));
        swallowHookRejection(promise);
      }
    } else if (hooks.onError !== undefined) {
      const promise = Promise.resolve(hooks.onError(input.error));
      swallowHookRejection(promise);
    }
  } catch {
    // Hooks failure must not break main flow.
  }
}

function maybeEmitAudit<TResult, TAuditEvent>(
  auditPort: BotAuditPort<TAuditEvent> | undefined,
  mapping: LifecycleAuditMapping<TResult, TAuditEvent, BotError> | undefined,
  input: MappingResult<TResult>,
): void {
  if (auditPort === undefined || mapping === undefined) return;

  if (input.ok) {
    const mapper = mapping.mapSuccessAuditEvent;
    if (mapper === undefined) return;
    auditPort.emit(mapper(input.value));
    return;
  }

  const mapper = mapping.mapFailureAuditEvent;
  if (mapper === undefined) return;
  auditPort.emit(mapper(input.error));
}

type ExistingResolution<TResult> = Readonly<
  | Readonly<{ readonly kind: 'continue'; }>
  | Readonly<{ readonly kind: 'return'; readonly value: TResult; }>
  | Readonly<{ readonly kind: 'throw'; readonly error: BotError; }>
>;

async function resolveExisting<TResult>(
  key: IdempotencyKey,
  port: IdempotencyPort<TResult, BotError>,
  signal?: AbortSignal,
): Promise<ExistingResolution<TResult>> {
  const existing = await port.get(key)(signal);
  if (existing !== null && existing.status === 'completed') {
    return Object.freeze({ kind: 'return', value: existing.result });
  }
  if (existing !== null && existing.status === 'failed') {
    return Object.freeze({ kind: 'throw', error: existing.error });
  }
  if (existing !== null && existing.status === 'in_progress' && port.reconcile !== undefined) {
    const reconciled = await port.reconcile(key)(signal);
    if (reconciled.status === 'completed') {
      return Object.freeze({ kind: 'return', value: reconciled.result });
    }
    if (reconciled.status === 'failed') {
      return Object.freeze({ kind: 'throw', error: reconciled.error });
    }
  }

  return Object.freeze({ kind: 'continue' });
}

/** execute → map → persist → finalize → side-effects */
export function executeLifecyclePipeline<TRaw, TResult, TAuditEvent = unknown>(
  ctx: OperationContext,
  input: ExecutePipelineInput<TRaw, TResult>,
  deps: ExecutePipelineDeps<TResult, TAuditEvent>,
): Effect<TResult> {
  return async (signal?: AbortSignal): Promise<TResult> => {
    const key: IdempotencyKey = ctx.operationId;
    const effectiveSignal = signal ?? ctx.abortSignal;

    const existingResolution = await resolveExisting(key, deps.idempotencyPort, effectiveSignal);
    if (existingResolution.kind === 'return') {
      return existingResolution.value;
    }
    if (existingResolution.kind === 'throw') {
      throw existingResolution.error;
    }

    const startedAtMs = ctx.auditMeta.timestamp;

    // startInProgress: deterministic safe point for concurrent attempts
    await deps.idempotencyPort.startInProgress(key, startedAtMs)(effectiveSignal);

    const raw = await input.execute(effectiveSignal);

    const mapping = input.mapResult(raw);
    if (!mapping.ok) {
      await deps.idempotencyPort.fail(key, executionStateAborted(ctx), mapping.error)(
        effectiveSignal,
      );

      bestEffortRunHooks(deps.hooks, mapping);
      maybeEmitAudit(deps.auditPort, deps.auditMapping, mapping);

      throw mapping.error;
    }

    // mapping ok => safe persist ordering

    const maxRetries = getMaxRetries(deps.retryConfig);
    // API clarity: `maxRetries=0` => `maxAttempts=1` (one try)
    const maxAttempts = 1 + maxRetries;

    const persistThunk = (): Promise<void> =>
      input.persist(deps.botsStorePort, mapping.value)(effectiveSignal);

    await withBoundedRetry(1, maxAttempts, persistThunk);

    await deps.idempotencyPort.complete(key, executionStateFinalized(), mapping.value)(
      effectiveSignal,
    );

    bestEffortRunHooks(deps.hooks, mapping);
    maybeEmitAudit(deps.auditPort, deps.auditMapping, mapping);

    return mapping.value;
  };
}

/* eslint-enable @livai/multiagent/orchestration-safety */
