/**
 * @vitest-environment node
 *
 * Unit тесты для contract-файла `contracts.ts`.
 * Цель: проверить корректность дискриминирующих union-типов и обязательных полей.
 */

import { describe, expect, it } from 'vitest';

import type {
  AuditMeta,
  ExecutionState,
  HooksExecutionMode,
  HooksFailureMode,
  IdempotencyKey,
  IdempotencyPort,
  IdempotencyRecord,
  IdempotencyRecordBase,
  LifecycleAuditMapping,
  LifecycleHooks,
  OperationContext,
  PolicyFlag,
  PolicyMeta,
  PolicySegment,
  PolicySourceSystem,
  RetryConfig,
} from '../../../../../src/effects/shared/lifecycle/contracts.js';
import { lifecycleContractsContractVersion } from '../../../../../src/effects/shared/lifecycle/contracts.js';

type Extends<A, B> = A extends B ? true : false;
type Assert<T extends true> = T;

describe('Lifecycle contracts (contracts.ts)', () => {
  it('экспортирует корректные string-literal union-ы', () => {
    const _M: Assert<Extends<HooksExecutionMode, 'sequential' | 'parallel'>> = true;
    void _M;

    const _F: Assert<Extends<HooksFailureMode, 'ignore' | 'collect'>> = true;
    void _F;
  });

  it('ExecutionState — дискриминирующий union с полями reconciled/aborted', () => {
    type S = ExecutionState;

    const _started: Assert<
      Extends<Extract<S, { status: 'started'; }>, Readonly<{ status: 'started'; }>>
    > = true;
    void _started;

    const _domain_success: Assert<
      Extends<Extract<S, { status: 'domain_success'; }>, Readonly<{ status: 'domain_success'; }>>
    > = true;
    void _domain_success;

    const _persisted: Assert<
      Extends<Extract<S, { status: 'persisted'; }>, Readonly<{ status: 'persisted'; }>>
    > = true;
    void _persisted;

    const _finalized: Assert<
      Extends<Extract<S, { status: 'finalized'; }>, Readonly<{ status: 'finalized'; }>>
    > = true;
    void _finalized;

    const _reconciled: Assert<
      Extends<
        Extract<S, { status: 'reconciled'; }>,
        Readonly<{ status: 'reconciled'; reconciledAt: number; }>
      >
    > = true;
    void _reconciled;

    const _aborted: Assert<
      Extends<
        Extract<S, { status: 'aborted'; }>,
        Readonly<{ status: 'aborted'; abortedAt: number; }>
      >
    > = true;
    void _aborted;
  });

  it('OperationContext — обязательные поля и optional abortSignal', () => {
    type C = OperationContext;

    const _opId: Assert<Extends<C['operationId'], IdempotencyKey>> = true;
    void _opId;

    const _actor: Assert<
      Extends<C['actorId'], import('../../../../../src/domain/Bot.js').BotUserId>
    > = true;
    void _actor;

    const _policy: Assert<Extends<C['policyMeta'], PolicyMeta>> = true;
    void _policy;

    const _audit: Assert<Extends<C['auditMeta'], AuditMeta>> = true;
    void _audit;

    // abortSignal опционален
    const _hasAbortSignal: Assert<Extends<'abortSignal' extends keyof C ? true : false, true>> =
      true;
    void _hasAbortSignal;
  });

  it('IdempotencyRecord — union статусов и required полей', () => {
    type R = IdempotencyRecord<number, string>;
    type B = IdempotencyRecordBase;

    const _key: Assert<Extends<B['key'], IdempotencyKey>> = true;
    void _key;

    const _retries: Assert<Extends<B['retriesCount'], number | undefined>> = true;
    void _retries;

    const _lastAttempt: Assert<Extends<B['lastAttemptAt'], number | undefined>> = true;
    void _lastAttempt;

    const _maxRetries: Assert<Extends<B['maxRetries'], number | undefined>> = true;
    void _maxRetries;

    const _new: Assert<
      Extends<
        Extract<R, { status: 'new'; }>,
        Readonly<{ status: 'new'; }> & IdempotencyRecordBase
      >
    > = true;
    void _new;

    const _in_progress: Assert<
      Extends<
        Extract<R, { status: 'in_progress'; }>,
        Readonly<{ status: 'in_progress'; startedAt: number; }> & IdempotencyRecordBase
      >
    > = true;
    void _in_progress;

    const _completed: Assert<
      Extends<
        Extract<R, { status: 'completed'; }>,
        Readonly<{
          status: 'completed';
          completedAt: number;
          executionState: ExecutionState;
          result: number;
        }> & IdempotencyRecordBase
      >
    > = true;
    void _completed;

    const _failed: Assert<
      Extends<
        Extract<R, { status: 'failed'; }>,
        Readonly<{
          status: 'failed';
          failedAt: number;
          executionState: ExecutionState;
          error: string;
        }> & IdempotencyRecordBase
      >
    > = true;
    void _failed;
  });

  it('LifecycleHooks — поля config/handlers и их optionality', () => {
    type L = LifecycleHooks<number, string>;

    const _mode: Assert<Extends<L['mode'], HooksExecutionMode | undefined>> = true;
    void _mode;

    const _failure: Assert<Extends<L['failureMode'], HooksFailureMode | undefined>> = true;
    void _failure;

    const _onSuccess: Assert<
      Extends<L['onSuccess'], ((result: number) => void | Promise<void>) | undefined>
    > = true;
    void _onSuccess;

    const _onError: Assert<
      Extends<L['onError'], ((error: string) => void | Promise<void>) | undefined>
    > = true;
    void _onError;
  });

  it('LifecycleAuditMapping — optional mapping функций', () => {
    type M = LifecycleAuditMapping<number, { ok: true; }, string>;

    const _s: Assert<
      Extends<M['mapSuccessAuditEvent'], ((result: number) => { ok: true; }) | undefined>
    > = true;
    void _s;

    const _f: Assert<
      Extends<M['mapFailureAuditEvent'], ((error: string) => { ok: true; }) | undefined>
    > = true;
    void _f;
  });

  it('PolicyMeta структура и branded поля', () => {
    type P = PolicyMeta;

    const _v: Assert<Extends<P['version'], number>> = true;
    void _v;

    const _flags: Assert<Extends<P['flags'], readonly PolicyFlag[]>> = true;
    void _flags;

    const _segments: Assert<Extends<P['segments'], readonly PolicySegment[]>> = true;
    void _segments;

    const _ruleId: Assert<Extends<P['ruleId'], string | undefined>> = true;
    void _ruleId;

    const _sourceSystem: Assert<Extends<P['sourceSystem'], PolicySourceSystem | undefined>> = true;
    void _sourceSystem;
  });

  it('RetryConfig — optional maxRetries/retryWindowMs', () => {
    type R = RetryConfig;
    const _max: Assert<Extends<R['maxRetries'], number | undefined>> = true;
    void _max;
    const _win: Assert<Extends<R['retryWindowMs'], number | undefined>> = true;
    void _win;
  });

  it('IdempotencyPort — порт исполнения с reconcile опциональным', () => {
    type P = IdempotencyPort<number, string>;

    const _get: Assert<
      Extends<
        P['get'],
        (
          key: IdempotencyKey,
        ) => import('@livai/core/effect').Effect<IdempotencyRecord<number, string> | null>
      >
    > = true;
    void _get;

    const _reconcile: Assert<
      Extends<
        P['reconcile'],
        ((
          key: IdempotencyKey,
        ) => import('@livai/core/effect').Effect<IdempotencyRecord<number, string>>) | undefined
      >
    > = true;
    void _reconcile;
  });

  it('экспортирует версию контракта для runtime-coverage', () => {
    expect(lifecycleContractsContractVersion).toBe(1);
  });
});
