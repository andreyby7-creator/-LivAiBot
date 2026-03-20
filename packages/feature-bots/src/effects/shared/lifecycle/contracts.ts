/**
 * @file packages/feature-bots/src/effects/shared/lifecycle/contracts.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Lifecycle Contracts (Layer 1)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Централизует контрактные типы для lifecycle/pipeline рефакторинга.
 * - Pipeline и error-boundary опираются на единый source of truth типов/инвариантов.
 * - Модули рефакторинга обмениваются данными через интерфейсы портов и неизменяемые контракты.
 *
 * Принципы:
 * - Contract-first: только типы/интерфейсы, без бизнес-логики.
 * - Deterministic by design: контракт не предполагает runtime-зависимостей/IO.
 */

import type { Effect } from '@livai/core/effect';
import type { TraceId } from '@livai/core-contracts';

import type { BotUserId } from '../../../domain/Bot.js';
import type { OperationId } from '../../../types/bot-commands.js';

/* ============================================================================
 * 🧩 CONTRACTS — IDENTITY / CONTEXT
 * ============================================================================
 */

/**
 * Ключ идемпотентности для lifecycle/pipeline.
 * В feature-bots используем branded `OperationId` как единый идентификатор операции.
 */
export type IdempotencyKey = OperationId;

/**
 * Метаданные policy-решений (расширяемая форма для explainability/compat).
 *
 * @remarks
 * - Не используем `Record`/unbounded-JSON в доменной контрактной форме.
 * - Расширение делается добавлением branded-токенов/массивов.
 */
export type PolicyFlag = Readonly<string & { readonly __brand: 'PolicyFlag'; }>;
export type PolicySegment = Readonly<string & { readonly __brand: 'PolicySegment'; }>;
export type PolicySourceSystem = Readonly<string & { readonly __brand: 'PolicySourceSystem'; }>;

export type PolicyMeta = Readonly<{
  readonly version: number;
  readonly flags: readonly PolicyFlag[];
  readonly segments: readonly PolicySegment[];
  readonly ruleId?: string | undefined;
  readonly sourceSystem?: PolicySourceSystem | undefined;
}>;

/**
 * Audit мета для correlate/observability.
 * Timestamp используется как epoch-ms (production adapter решает формат/источник времени).
 */
export type AuditMeta = Readonly<{
  readonly eventId: string;
  readonly timestamp: number;
  readonly actorId?: BotUserId | undefined;
  readonly traceId?: TraceId | undefined;
}>;

/** Операционный контекст, единый для lifecycle/pipeline. */
export type OperationContext = Readonly<{
  readonly operationId: IdempotencyKey;
  readonly actorId: BotUserId;
  readonly traceId?: TraceId | undefined;
  readonly policyMeta: PolicyMeta;
  readonly auditMeta: AuditMeta;
  readonly abortSignal?: AbortSignal | undefined;
}>;

/* ============================================================================
 * 🧮 CONTRACTS — EXECUTION PROGRESSION STATE
 * ============================================================================
 */

/**
 * Прогресс исполнения lifecycle/pipeline.
 *
 * Инварианты (ожидаемые со стороны pipeline):
 * - `started` -> `domain_success` -> `persisted` -> `finalized`
 * - `side-effects` выполняются только после `finalized`.
 *
 * Runtime enforcement (ожидаемое поведение реализации):
 * - pipeline MUST NOT переходить в `persisted`/`finalized`, пока для того же ключа
 *   не достигнут `domain_success` в рамках текущей попытки исполнения.
 */
export type ExecutionState = Readonly<
  | Readonly<{ readonly status: 'started'; }>
  | Readonly<{ readonly status: 'domain_success'; }>
  | Readonly<{ readonly status: 'persisted'; }>
  | Readonly<{ readonly status: 'finalized'; }>
  | Readonly<{ readonly status: 'reconciled'; readonly reconciledAt: number; }>
  | Readonly<{ readonly status: 'aborted'; readonly abortedAt: number; }>
>;

/**
 * Конфигурация retry на уровне pipeline (опционально).
 * Если infra/IdempotencyPort уже хранит retry-параметры в record,
 * pipeline может выбирать их из record или из этого конфига (в зависимости от реализации).
 */
export type RetryConfig = Readonly<{
  readonly maxRetries?: number | undefined;
  readonly retryWindowMs?: number | undefined;
}>;

/* ============================================================================
 * 🧷 CONTRACTS — IDEMPOTENCY RECORD
 * ============================================================================
 */

export type IdempotencyRecordBase = Readonly<{
  readonly key: IdempotencyKey;
  /**
   * Observability: сколько попыток предпринимает pipeline для данного ключа.
   * Реализация инкремента/источника данных определяется infra/IdempotencyPort.
   */
  readonly retriesCount?: number | undefined;
  /**
   * Observability: время последней попытки.
   * Если port не хранит, оставляем undefined.
   */
  readonly lastAttemptAt?: number | undefined;

  /**
   * Опциональная конфигурация bounded-retry (observability-friendly).
   *
   * @remarks
   * Если infra хранит это значение вместе с записью идемпотентности,
   * pipeline может ограничивать retry детерминированно, не требуя дополнительных runtime-имплементаций.
   */
  readonly maxRetries?: number | undefined;
}>;

/**
 * Идемпотентность как минимальный state-machine record.
 *
 * @remarks
 * - Точное хранение result/error/policyMeta может зависеть от IdempotencyPort implementation.
 * - Контракт фиксирует только статусы и поля, необходимые для reasoning/guarantees pipeline.
 */
export type IdempotencyRecord<TResult = unknown, TError = unknown> = Readonly<
  | (Readonly<{ readonly status: 'new'; }> & IdempotencyRecordBase)
  | (
    & Readonly<{
      readonly status: 'in_progress';
      readonly startedAt: number;
    }>
    & IdempotencyRecordBase
  )
  | (
    & Readonly<{
      readonly status: 'completed';
      readonly completedAt: number;
      readonly executionState: ExecutionState;
      readonly result: TResult;
    }>
    & IdempotencyRecordBase
  )
  | (
    & Readonly<{
      readonly status: 'failed';
      readonly failedAt: number;
      readonly executionState: ExecutionState;
      readonly error: TError;
    }>
    & IdempotencyRecordBase
  )
>;

/* ============================================================================
 * 🔧 PORTS — IDEMPOTENCY
 * ============================================================================
 */

/**
 * Порт идемпотентности для lifecycle/pipeline.
 *
 * @remarks
 * Контракт минимален и предназначен для реализации в infra/store layer:
 * - pipeline читает record/принимает решение
 * - pipeline записывает прогресс и финализирует record
 *
 * Идемпотентность может включать takeover/reconcile логику в implementation,
 * но она не должна ломать deterministic contracts pipeline.
 */
type IdempotencyPortConfig = Readonly<{
  /**
   * Опциональная конфигурация bounded-retry.
   *
   * @remarks
   * Реализация infra может поддерживать это значение (например, хранить вместе с record),
   * но pipeline по контракту обязан оставаться deterministic и не требовать runtime-логики.
   */
  readonly maxRetries?: number | undefined;
}>;

type IdempotencyPortMethods<TResult = unknown, TError = unknown> = Readonly<{
  readonly get: (key: IdempotencyKey) => Effect<IdempotencyRecord<TResult, TError> | null>;
  readonly startInProgress: (
    key: IdempotencyKey,
    startedAtMs: number,
  ) => Effect<IdempotencyRecord<TResult, TError>>;

  /**
   * Атомарность/transaction guarantees (ожидаемое контрактное поведение):
   * - переходы `startInProgress -> complete|fail` должны быть идемпотентны по `key`
   * - concurrent retries не должны приводить к "multiple finals"
   */
  readonly complete: (
    key: IdempotencyKey,
    executionState: ExecutionState,
    result: TResult,
  ) => Effect<IdempotencyRecord<TResult, TError>>;

  readonly fail: (
    key: IdempotencyKey,
    executionState: ExecutionState,
    error: TError,
  ) => Effect<IdempotencyRecord<TResult, TError>>;

  /**
   * Опциональный reconcile/takeover hook.
   *
   * @remarks
   * Обязательность:
   * - `reconcile` может быть `undefined`.
   * - Если `reconcile` отсутствует, pipeline MUST по-прежнему обеспечивать deterministic guarantees
   *   через generic idempotency flow: `get(key)` является source-of-truth для completed/failed,
   *   а для `in_progress` pipeline MUST not create multiple finals (и MUST не вызывать `complete/fail`
   *   повторно для одного и того же ключа).
   *
   * Важные semantic invariants:
   * - `reconcile` не должен ломать deterministic guarantees pipeline.
   * - Для одного и того же `key` при повторных вызовах `reconcile` должен возвращать
   *   консистентный финальный `IdempotencyRecord` (или консистентный progress),
   *   чтобы pipeline не мог создать “multiple finals” при retries/takeover.
   * - Pipeline по-прежнему остаётся единственным владельцем порядка:
   *   execute → map → persist → finalized → side-effects.
   */
  readonly reconcile?: (key: IdempotencyKey) => Effect<IdempotencyRecord<TResult, TError>>;
}>;

export type IdempotencyPort<TResult = unknown, TError = unknown> =
  & IdempotencyPortConfig
  & IdempotencyPortMethods<TResult, TError>;

/* ============================================================================
 * 🪝 PORTABLE MODELS — HOOKS / AUDIT EXECUTION SEMANTICS
 * ============================================================================
 */

export type HooksExecutionMode = 'sequential' | 'parallel';
export type HooksFailureMode = 'ignore' | 'collect';

/**
 * Контракт best-effort hooks.
 * Семантика: ошибки хендлеров не должны прерывать основной flow pipeline.
 */
type LifecycleHooksConfig = Readonly<{
  readonly mode?: HooksExecutionMode;
  readonly failureMode?: HooksFailureMode;
}>;

type LifecycleHooksHandlers<TResult = unknown, TError = unknown> = Readonly<{
  readonly onSuccess?: (result: TResult) => void | Promise<void>;
  readonly onError?: (error: TError) => void | Promise<void>;
}>;

export type LifecycleHooks<TResult = unknown, TError = unknown> =
  & LifecycleHooksConfig
  & LifecycleHooksHandlers<TResult, TError>;

/**
 * Контракт audit mapping для pipeline side-effects.
 * Мапперы должны быть pure; эмит выполняется infra через BotAuditPort в эффектной части.
 */
export type LifecycleAuditMapping<TResult = unknown, TAuditEvent = unknown, TError = unknown> =
  Readonly<{
    readonly mapSuccessAuditEvent?: (result: TResult) => TAuditEvent;
    readonly mapFailureAuditEvent?: (error: TError) => TAuditEvent;
  }>;

/**
 * Минимальный runtime-экспорт для unit-тестов с coverage v8.
 *
 * contractVersion нужен, чтобы файл не был "полностью type-only" на уровне
 * исполнения (иначе v8 coverage показывает 0%).
 */
export const lifecycleContractsContractVersion = 1 as const;
