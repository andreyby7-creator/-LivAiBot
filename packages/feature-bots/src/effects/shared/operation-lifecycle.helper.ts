/**
 * @file packages/feature-bots/src/effects/shared/operation-lifecycle.helper.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Operation Lifecycle Helper (Shared)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Generic helper для оркестраторов bot-эффектов: loading → run → success/failure.
 * - Централизует lifecycle-обвязку (store transitions + error normalization + audit hooks)
 *   без бизнес-логики и утечки transport деталей.
 * - Работает через DI-порты (`BotsStorePort`, `BotAuditPort`) и lib-мэппер ошибок.
 *
 * Принципы:
 * - ✅ SRP: только lifecycle plumbing, без domain-правил конкретного use-case.
 * - ✅ Deterministic: один и тот же input/DI → одинаковые transitions/events.
 * - ✅ Effect-first: исполняет `Effect<T>` и прозрачно прокидывает AbortSignal.
 * - ✅ Extensible: success/failure audit events задаются через мапперы.
 *
 * @remarks
 * - `auditPort.emit(...)` вызывается синхронно. Для high-throughput сценариев audit sink должен
 *   быть async-safe и неблокирующим (очередь/buffer/backpressure/batch) на infra-уровне.
 * - helper не санитизирует payload audit-событий: PII/секреты должны быть очищены upstream.
 * - `withStoreLock` — re-entrancy guard adapter'а, а не межоперационный mutex.
 */

import type { Effect } from '@livai/core/effect';

import type { BotErrorInput, MapBotErrorConfig } from '../../lib/error-mapper.js';
import { mapBotErrorToUI } from '../../lib/error-mapper.js';
import type { BotError, OperationKey } from '../../types/bots.js';
import type { BotAuditPort } from './audit.port.js';
import type { BotsStorePort } from './bots-store.port.js';
import { withStoreLock } from './bots-store.port.js';

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

type SuccessMapper<TResult, TAuditEvent> = (result: TResult) => TAuditEvent;
type FailureMapper<TAuditEvent> = (error: BotError) => TAuditEvent;
type OperationAction = () => void;

/**
 * Handler переходов состояния для конкретной операции.
 * Позволяет расширять lifecycle без правок core-helper.
 */
export type OperationLifecycleOperationHandler = Readonly<{
  readonly setLoading: (storePort: BotsStorePort) => void;
  readonly setError: (storePort: BotsStorePort, error: BotError) => void;
}>;

/**
 * Контракт запуска одной operation-попытки.
 * `setSuccessState` опционален: некоторые сценарии не пишут success в store.
 */
type RunOperationLifecycleInputContext = Readonly<{
  readonly operation: OperationKey;
  readonly useStoreLock?: boolean;
}>;

type RunOperationLifecycleInputRunner<TResult> = Readonly<{
  readonly run: Effect<TResult>;
}>;

type RunOperationLifecycleInputHooks<TResult> = Readonly<{
  readonly setSuccessState?: (storePort: BotsStorePort, result: TResult) => void;
  readonly onSuccess?: (result: TResult) => void;
  readonly onFailure?: (error: BotError) => void;
}>;

type RunOperationLifecycleInputAudit<TResult, TAuditEvent> = Readonly<{
  readonly mapSuccessAuditEvent?: SuccessMapper<TResult, TAuditEvent>;
  readonly mapFailureAuditEvent?: FailureMapper<TAuditEvent>;
}>;

export type RunOperationLifecycleInput<TResult, TAuditEvent = unknown> =
  & RunOperationLifecycleInputContext
  & RunOperationLifecycleInputRunner<TResult>
  & RunOperationLifecycleInputHooks<TResult>
  & RunOperationLifecycleInputAudit<TResult, TAuditEvent>;

type OperationLifecycleHelperConfigBase<TAuditEvent> = Readonly<{
  readonly storePort: BotsStorePort;
  readonly mapErrorConfig: MapBotErrorConfig;
  readonly auditPort?: BotAuditPort<TAuditEvent>;
}>;

type OperationLifecycleHelperConfigOverrides = Readonly<{
  /** Частичное переопределение default handlers для loading/error transitions. */
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
> = Object.freeze({
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
});

function resolveOperationHandler(
  operationHandlers: Readonly<Partial<Record<OperationKey, OperationLifecycleOperationHandler>>>,
  operation: OperationKey,
): OperationLifecycleOperationHandler {
  // Fail-fast, чтобы misconfiguration ловилась при первом вызове операции.
  // eslint-disable-next-line security/detect-object-injection -- `operation` ограничен union `OperationKey` (allow-list ключей)
  const handler = operationHandlers[operation];
  if (handler === undefined) {
    throw new Error(`No handler defined for operation "${operation}"`);
  }
  return handler;
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

export function createOperationLifecycleHelper<TAuditEvent = unknown>(
  config: OperationLifecycleHelperConfig<TAuditEvent>,
): OperationLifecycleHelper<TAuditEvent> {
  const { storePort, mapErrorConfig, auditPort } = config;
  const operationHandlers: Readonly<
    Partial<Record<OperationKey, OperationLifecycleOperationHandler>>
  > = Object.freeze({
    ...DEFAULT_OPERATION_HANDLERS,
    ...(config.operationHandlers ?? {}),
  });

  const runOperation = <TResult>(
    input: RunOperationLifecycleInput<TResult, TAuditEvent>,
  ): Effect<TResult> =>
  async (signal?: AbortSignal): Promise<TResult> => {
    // Единая точка применения lock-политики для loading/success/failure веток.
    const runWithOptionalLock = (action: OperationAction): void => {
      if (input.useStoreLock === true) {
        withStoreLock(storePort, action);
      } else {
        action();
      }
    };

    const operationHandler = resolveOperationHandler(operationHandlers, input.operation);

    runWithOptionalLock(() => {
      operationHandler.setLoading(storePort);
    });

    try {
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- timeout/retry политика применяется на уровне orchestrator, helper исполняет переданный Effect как есть.
      const result = await input.run(signal);

      const onSuccess = (): void => {
        input.setSuccessState?.(storePort, result);
        input.onSuccess?.(result);

        if (auditPort !== undefined && input.mapSuccessAuditEvent !== undefined) {
          auditPort.emit(input.mapSuccessAuditEvent(result));
        }
      };

      runWithOptionalLock(onSuccess);

      // eslint-disable-next-line @livai/rag/source-citation -- результат возвращается из уже выполненного Effect, источник данных задаётся вызывающим orchestrator.
      return result;
    } catch (error: unknown) {
      const mappedError = mapBotErrorToUI(error as BotErrorInput, mapErrorConfig);

      const onFailure = (): void => {
        operationHandler.setError(storePort, mappedError);
        input.onFailure?.(mappedError);

        if (auditPort !== undefined && input.mapFailureAuditEvent !== undefined) {
          auditPort.emit(input.mapFailureAuditEvent(mappedError));
        }
      };

      runWithOptionalLock(onFailure);

      throw mappedError;
    }
  };

  return Object.freeze({
    runOperation,
  });
}
