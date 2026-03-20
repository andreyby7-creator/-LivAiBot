/**
 * @file packages/feature-bots/src/effects/shared/operation-lifecycle.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Operation Lifecycle (Shared Glue)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Public glue-слой жизненного цикла operation.
 * - Внутри использует lifecycle error boundary + execution pipeline:
 *   `return withErrorBoundary(ctx, () => executeLifecyclePipeline(ctx, input, deps))`
 * - Слой намеренно ожидает Result/Effect вызовов и портов, чтобы сохранить
 *   детерминированный порядок lifecycle-шагов.
 * - Политика timeout/abort задаётся внешним orchestrator-ом через `AbortSignal`
 *   в контракте, а не в этом модуле.
 *
 * Примечание совместимости:
 * - Для текущего набора orchestrator-ов мы сохраняем внешний API
 *   `createOperationLifecycleHelper(...).runOperation(...)`, чтобы миграция
 *   происходила постепенно (без одновременного переписывания всех эффектов).
 */

import type { Effect } from '@livai/core/effect';

import type { BotUserId } from '../../domain/Bot.js';
import type { MapBotErrorConfig } from '../../lib/error-mapper.js';
import type { BotError, OperationKey } from '../../types/bots.js';
import type { BotAuditPort } from './audit.port.js';
import type { BotsStorePort } from './bots-store.port.js';
import { withStoreLock } from './bots-store.port.js';
import type {
  ExecutionState,
  IdempotencyKey,
  IdempotencyPort,
  IdempotencyRecord,
  OperationContext,
  PolicyMeta,
} from './lifecycle/contracts.js';
import { withErrorBoundary } from './lifecycle/error.js';
import type { MappingResult } from './lifecycle/pipeline.js';
import { executeLifecyclePipeline } from './lifecycle/pipeline.js';

/* ============================================================================
 * 🧭 TYPES (compat with operation-lifecycle.helper.ts)
 * ============================================================================
 */

export type OperationLifecycleOperationHandler = Readonly<{
  readonly setLoading: (storePort: BotsStorePort) => void;
  readonly setError: (storePort: BotsStorePort, error: BotError) => void;
}>;

type RunOperationLifecycleInputContext = Readonly<{
  readonly operation: OperationKey;
  readonly useStoreLock?: boolean;
  /**
   * Идемпотентный ключ попытки.
   *
   * Лучший вариант: stable key от orchestrator-а, тогда idempotency работает для retry.
   * Если не задан — используется fallback, чтобы не схлопывать разные операции.
   */
  readonly idempotencyKey?: IdempotencyKey | undefined;
}>;

type RunOperationLifecycleInputRunner<TResult> = Readonly<{
  readonly run: Effect<TResult>;
}>;

type RunOperationLifecycleInputHooks<TResult> = Readonly<{
  readonly setSuccessState?: (storePort: BotsStorePort, result: TResult) => void;
  readonly onSuccess?: (result: TResult) => void;
  readonly onFailure?: (error: BotError) => void;
}>;

type SuccessMapper<TResult, TAuditEvent> = (result: TResult) => TAuditEvent;
type FailureMapper<TAuditEvent> = (error: BotError) => TAuditEvent;

type RunOperationLifecycleInputAudit<TResult, TAuditEvent> = Readonly<{
  readonly mapSuccessAuditEvent?: SuccessMapper<TResult, TAuditEvent>;
  readonly mapFailureAuditEvent?: FailureMapper<TAuditEvent>;
}>;

export type RunOperationLifecycleInput<TResult, TAuditEvent = unknown> = Readonly<
  & RunOperationLifecycleInputContext
  & RunOperationLifecycleInputRunner<TResult>
  & RunOperationLifecycleInputHooks<TResult>
  & RunOperationLifecycleInputAudit<TResult, TAuditEvent>
>;

type OperationLifecycleHelperConfigBase<TAuditEvent> = Readonly<{
  readonly storePort: BotsStorePort;
  readonly mapErrorConfig: MapBotErrorConfig;
  readonly auditPort?: BotAuditPort<TAuditEvent>;

  /**
   * Внешний идемпотентный порт (лучший вариант для реального infra/store).
   * Если не задан — используется in-memory fallback, общий на экземпляр helper'а.
   */
  readonly idempotencyPort?: IdempotencyPort<unknown, BotError> | undefined;

  /**
   * Generic factory для идемпотентного порта (позволяет избежать cast в runOperation).
   * Если не задано, helper использует injected `idempotencyPort` или in-memory fallback.
   */
  readonly idempotencyPortFactory?: (<TResult>() => IdempotencyPort<TResult, BotError>) | undefined;

  /**
   * Источник времени (timestamp) для deterministic-полей.
   * Идеально — прокинуть clock из orchestrator/DI.
   */
  readonly now?: (() => number) | undefined;
}>;

type OperationLifecycleHelperConfigOverrides = Readonly<{
  readonly operationHandlers?: Partial<Record<OperationKey, OperationLifecycleOperationHandler>>;
}>;

export type OperationLifecycleHelperConfig<TAuditEvent = unknown> =
  & OperationLifecycleHelperConfigBase<TAuditEvent>
  & OperationLifecycleHelperConfigOverrides;

export type OperationLifecycleHelper<TAuditEvent = unknown> = Readonly<{
  readonly runOperation: <TResult>(
    input: RunOperationLifecycleInput<TResult, TAuditEvent>,
  ) => Effect<TResult>;
}>;

/* ============================================================================
 * 🧰 INTERNAL HELPERS
 * ============================================================================
 */

const DEFAULT_OPERATION_HANDLERS: Readonly<
  Record<OperationKey, OperationLifecycleOperationHandler>
> = Object.freeze(
  {
    create: Object.freeze({
      setLoading: (storePort: BotsStorePort) => {
        storePort.setCreateState({ status: 'loading', operation: 'create' });
      },
      setError: (storePort: BotsStorePort, error: BotError) => {
        storePort.setCreateState({ status: 'error', error });
      },
    }),
    update: Object.freeze({
      setLoading: (storePort: BotsStorePort) => {
        storePort.setUpdateState({ status: 'loading', operation: 'update' });
      },
      setError: (storePort: BotsStorePort, error: BotError) => {
        storePort.setUpdateState({ status: 'error', error });
      },
    }),
    delete: Object.freeze({
      setLoading: (storePort: BotsStorePort) => {
        storePort.setDeleteState({ status: 'loading', operation: 'delete' });
      },
      setError: (storePort: BotsStorePort, error: BotError) => {
        storePort.setDeleteState({ status: 'error', error });
      },
    }),
  },
);

function resolveOperationHandler(
  operationHandlers: Readonly<Partial<Record<OperationKey, OperationLifecycleOperationHandler>>>,
  operation: OperationKey,
): OperationLifecycleOperationHandler {
  // Fail-fast, чтобы misconfiguration ловилась при первом вызове операции.
  switch (operation) {
    case 'create': {
      const handler = operationHandlers.create ?? DEFAULT_OPERATION_HANDLERS.create;
      return handler;
    }
    case 'update': {
      const handler = operationHandlers.update ?? DEFAULT_OPERATION_HANDLERS.update;
      return handler;
    }
    case 'delete': {
      const handler = operationHandlers.delete ?? DEFAULT_OPERATION_HANDLERS.delete;
      return handler;
    }
    default: {
      throw new Error(`Unsupported operation: ${String(operation)}`);
    }
  }
}

function buildPolicyMeta(): PolicyMeta {
  // Пока orchestrator-слой не отдаёт policy explainability в ctx, используем safe defaults.
  return Object.freeze({
    version: 1,
    flags: Object.freeze([]),
    segments: Object.freeze([]),
  }) as PolicyMeta;
}

function buildDefaultActorId(): BotUserId {
  // В текущем compat-режиме actorId/traceId не доступны из старого runOperation input.
  // Для инвариантов lifecycle достаточно стабильного branded значения.
  return 'system' as unknown as BotUserId;
}

function createInMemoryIdempotencyPort<TResult>(
  now: () => number,
): IdempotencyPort<TResult, BotError> {
  const records = new Map<IdempotencyKey, IdempotencyRecord<TResult, BotError>>();

  const getRecord = (key: IdempotencyKey): IdempotencyRecord<TResult, BotError> | null => {
    const existing = records.get(key) ?? null;
    return existing;
  };

  const port: IdempotencyPort<TResult, BotError> = Object.freeze({
    get: (key: IdempotencyKey) => (): Promise<IdempotencyRecord<TResult, BotError> | null> =>
      Promise.resolve(getRecord(key)),
    startInProgress: (
      key: IdempotencyKey,
      startedAtMs: number,
    ) =>
    (): Promise<IdempotencyRecord<TResult, BotError>> => {
      const existing = getRecord(key);
      if (existing !== null && (existing.status === 'completed' || existing.status === 'failed')) {
        return Promise.resolve(existing);
      }

      const next: IdempotencyRecord<TResult, BotError> = Object.freeze({
        status: 'in_progress',
        key,
        startedAt: startedAtMs,
      });

      records.set(key, next);
      return Promise.resolve(next);
    },
    complete: (
      key: IdempotencyKey,
      executionState: ExecutionState,
      result: TResult,
    ) =>
    (): Promise<IdempotencyRecord<TResult, BotError>> => {
      const existing = getRecord(key);
      if (existing !== null && existing.status === 'completed') {
        return Promise.resolve(existing);
      }
      if (existing !== null && existing.status === 'failed') {
        return Promise.resolve(existing);
      }

      const record: IdempotencyRecord<TResult, BotError> = Object.freeze({
        status: 'completed',
        key,
        completedAt: now(),
        executionState,
        result,
      });

      records.set(key, record);
      return Promise.resolve(record);
    },
    fail: (
      key: IdempotencyKey,
      executionState: ExecutionState,
      error: BotError,
    ) =>
    (): Promise<IdempotencyRecord<TResult, BotError>> => {
      const existing = getRecord(key);
      if (existing !== null && existing.status === 'completed') {
        return Promise.resolve(existing);
      }
      if (existing !== null && existing.status === 'failed') {
        return Promise.resolve(existing);
      }

      const record: IdempotencyRecord<TResult, BotError> = Object.freeze({
        status: 'failed',
        key,
        failedAt: now(),
        executionState,
        error,
      });

      records.set(key, record);
      return Promise.resolve(record);
    },
  });

  return port;
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

export function createOperationLifecycleHelper<TAuditEvent = unknown>(
  config: OperationLifecycleHelperConfig<TAuditEvent>,
): OperationLifecycleHelper<TAuditEvent> {
  const {
    storePort,
    mapErrorConfig,
    auditPort,
    idempotencyPort: injectedIdempotencyPort,
    idempotencyPortFactory,
    now: nowFn,
  } = config;

  if (injectedIdempotencyPort !== undefined && idempotencyPortFactory !== undefined) {
    throw new Error('Provide either idempotencyPort OR idempotencyPortFactory, not both');
  }

  const now = nowFn ?? ((): number => Date.now());
  let seq = 0;

  const operationHandlers: Readonly<
    Partial<Record<OperationKey, OperationLifecycleOperationHandler>>
  > = Object.freeze({
    ...DEFAULT_OPERATION_HANDLERS,
    ...(config.operationHandlers ?? {}),
  });

  // Idempotency MUST be shared across multiple runOperation() calls for the same helper instance.
  const sharedIdempotencyPortUnknown: IdempotencyPort<unknown, BotError> = injectedIdempotencyPort
    ?? createInMemoryIdempotencyPort<unknown>(now);
  const defaultIdempotencyPortFactory = <TResult>(): IdempotencyPort<TResult, BotError> =>
    sharedIdempotencyPortUnknown as IdempotencyPort<TResult, BotError>;

  const runOperation = <TResult>(
    input: RunOperationLifecycleInput<TResult, TAuditEvent>,
  ): Effect<TResult> => {
    const operationHandler = resolveOperationHandler(operationHandlers, input.operation);
    const idempotencyPort: IdempotencyPort<TResult, BotError> = idempotencyPortFactory<TResult>?.()
      ?? defaultIdempotencyPortFactory<TResult>();

    return async (signal?: AbortSignal): Promise<TResult> => {
      const timestamp = now();
      seq += 1;
      const operationId = input.idempotencyKey
        ?? (`${input.operation}:${timestamp}:${seq}` as unknown as IdempotencyKey);

      const auditMeta = Object.freeze({
        eventId: `lifecycle:${input.operation}:${seq}`,
        timestamp,
      });

      const ctx: OperationContext = Object.freeze({
        operationId,
        actorId: buildDefaultActorId(),
        traceId: undefined,
        policyMeta: buildPolicyMeta(),
        auditMeta,
        abortSignal: signal,
      });

      let mappingConfig:
        | Readonly<{
          readonly mapSuccessAuditEvent?: SuccessMapper<TResult, TAuditEvent>;
          readonly mapFailureAuditEvent?: FailureMapper<TAuditEvent>;
        }>
        | undefined;
      if (input.mapSuccessAuditEvent !== undefined || input.mapFailureAuditEvent !== undefined) {
        mappingConfig = Object.freeze({
          ...(input.mapSuccessAuditEvent !== undefined
            ? { mapSuccessAuditEvent: input.mapSuccessAuditEvent }
            : {}),
          ...(input.mapFailureAuditEvent !== undefined
            ? { mapFailureAuditEvent: input.mapFailureAuditEvent }
            : {}),
        });
      }

      // 1) ready-to-execute core thunk (wrap: loading only)
      const execute = async (execSignal?: AbortSignal): Promise<TResult> => {
        const setLoading = (): void => {
          operationHandler.setLoading(storePort);
        };

        if (input.useStoreLock === true) {
          withStoreLock(storePort, setLoading);
        } else {
          setLoading();
        }

        // core effect errors должны пробрасываться в layer2 (withErrorBoundary),
        // а не нормализоваться тут.
        // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout/abort контролируется внешним orchestrator через AbortSignal-контракт
        const result = await input.run(execSignal);
        // eslint-disable-next-line @livai/rag/source-citation -- это pass-through результата из входного Effect; источник данных задаётся вызывающим orchestrator-слоем
        return result;
      };

      // 2) strict mapping: здесь нет ветки err, ошибки проходят через throw -> layer2 boundary.
      const mapResult = (raw: TResult): MappingResult<TResult> =>
        Object.freeze({ ok: true, value: raw });

      const persist =
        (_storePort: BotsStorePort, value: TResult): Effect<void> => (): Promise<void> => {
          if (input.setSuccessState === undefined) return Promise.resolve();
          const apply = (): void => {
            input.setSuccessState?.(_storePort, value);
          };

          if (input.useStoreLock === true) {
            withStoreLock(_storePort, apply);
          } else {
            apply();
          }
          return Promise.resolve();
        };

      const deps = Object.freeze({
        botsStorePort: storePort,
        idempotencyPort,
        auditPort,
        auditMapping: mappingConfig,
        hooks: Object.freeze({
          onSuccess: (result: TResult): void => {
            input.onSuccess?.(result);
          },
          onError: (error: BotError): void => {
            const setError = (): void => {
              operationHandler.setError(storePort, error);
            };

            if (input.useStoreLock === true) {
              withStoreLock(storePort, setError);
            } else {
              setError();
            }

            input.onFailure?.(error);
          },
        }),
      });

      const boundaryCtx = Object.freeze({
        ...ctx,
        idempotencyPort,
        mapErrorConfig,
        hooks: deps.hooks,
        auditPort,
        auditMapping: mappingConfig,
      });

      // glue-слой: единая точка try/catch + deterministic order via pipeline.
      return withErrorBoundary<TResult, TAuditEvent>(
        boundaryCtx,
        () =>
          executeLifecyclePipeline<TResult, TResult, TAuditEvent>(
            ctx,
            { execute, mapResult, persist },
            deps,
          ),
      )(signal);
    };
  };

  return Object.freeze({
    runOperation,
  });
}
