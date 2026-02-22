/**
 * @file packages/core/src/pipeline/facade.ts
 * ============================================================================
 * 🧭 CORE — Pipeline Facade
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единая фасадная точка входа для compile / execute / compile+execute
 * - Rule-engine для policy-решений без изменения core-логики
 * - Детерминированный dispatch через таблицу обработчиков (без if/else-монолита)
 *
 * Принципы:
 * - ✅ SRP: команды, policy-правила и обработчики разделены
 * - ✅ Deterministic: одна команда + один набор правил => один результат
 * - ✅ Domain-pure: использует типы домена pipeline, без скрытого состояния
 * - ✅ Microservice-ready: сериализуемые причины отказа и явные контракты
 * - ✅ Extensible: расширение через `rules` и `handlers` без правок ядра фасада
 *
 * ⚠️ ВАЖНО:
 * - ❌ Фасад не меняет бизнес-логику стадий; выполняется только orchestration/dispatch
 * - ⚠️ Audit hook опционален и вызывается только для policy-событий REWRITE/REJECT
 */

import { executePipeline } from './engine.js';
import { createExecutionPlanSafe } from './plan.js';
import type { ExecutionPlan, ExecutionPlanError } from './plan.js';
import type {
  PipelineConfig,
  PipelineFailureReason,
  PipelineResult,
  StagePlugin,
} from './plugin-api.js';

/* ============================================================================
 * 1. TYPES — FACADE COMMANDS, RULES, RESULTS
 * ============================================================================
 */

/** Тип команды фасада. */
export type PipelineFacadeCommandKind =
  | 'COMPILE_PLAN'
  | 'EXECUTE_PLAN'
  | 'COMPILE_AND_EXECUTE';

/** Команда: только компиляция плана. */
export type CompilePlanCommand<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly kind: 'COMPILE_PLAN';
  readonly plugins: readonly StagePlugin<TSlotMap>[];
  readonly config: PipelineConfig<TSlotMap>;
}>;

/** Команда: выполнение уже скомпилированного плана. */
export type ExecutePlanCommand<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly kind: 'EXECUTE_PLAN';
  readonly plan: ExecutionPlan<TSlotMap>;
  readonly config: PipelineConfig<TSlotMap>;
  readonly initialSlots?: Readonly<Partial<TSlotMap>>;
}>;

/** Команда: компиляция и немедленное выполнение. */
export type CompileAndExecuteCommand<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<
  {
    readonly kind: 'COMPILE_AND_EXECUTE';
    readonly plugins: readonly StagePlugin<TSlotMap>[];
    readonly config: PipelineConfig<TSlotMap>;
    readonly initialSlots?: Readonly<Partial<TSlotMap>>;
  }
>;

/** Union команд фасада. */
export type PipelineFacadeCommand<TSlotMap extends Readonly<Record<string, unknown>>> =
  | CompilePlanCommand<TSlotMap>
  | ExecutePlanCommand<TSlotMap>
  | CompileAndExecuteCommand<TSlotMap>;

/** Типизированный код policy-отказа. */
export type FacadePolicyRejectCode =
  | 'COMMAND_NOT_ALLOWED'
  | 'POLICY_DENIED';

/** Причина policy-отказа (сериализуемая). */
export type FacadePolicyRejectReason = Readonly<{
  readonly kind: 'POLICY_REJECTED';
  readonly code: FacadePolicyRejectCode;
  readonly command: PipelineFacadeCommandKind;
}>;

/** Результат policy-решения по команде. */
export type FacadeRuleDecision<TSlotMap extends Readonly<Record<string, unknown>>> =
  | Readonly<{ readonly kind: 'ALLOW'; }>
  | Readonly<{ readonly kind: 'REWRITE'; readonly command: PipelineFacadeCommand<TSlotMap>; }>
  | Readonly<{ readonly kind: 'REJECT'; readonly reason: FacadePolicyRejectReason; }>;

/** Правило фасада: pure функция трансформации/валидации команды. */
export type PipelineFacadeRule<TSlotMap extends Readonly<Record<string, unknown>>> = (
  command: PipelineFacadeCommand<TSlotMap>,
) => FacadeRuleDecision<TSlotMap>;

/** Неуспешный результат фасада. */
export type PipelineFacadeFailure =
  | Readonly<
    {
      readonly ok: false;
      readonly kind: 'POLICY_REJECTED';
      readonly reason: FacadePolicyRejectReason;
    }
  >
  | Readonly<
    {
      readonly ok: false;
      readonly kind: 'PLAN_COMPILE_FAILED';
      readonly error: ExecutionPlanError;
    }
  >
  | Readonly<
    {
      readonly ok: false;
      readonly kind: 'PLAN_EXECUTION_FAILED';
      readonly reason: PipelineFailureReason;
    }
  >;

/** Успешный результат фасада. */
export type PipelineFacadeSuccess<TSlotMap extends Readonly<Record<string, unknown>>> =
  | Readonly<
    { readonly ok: true; readonly kind: 'PLAN_COMPILED'; readonly plan: ExecutionPlan<TSlotMap>; }
  >
  | Readonly<
    {
      readonly ok: true;
      readonly kind: 'PLAN_EXECUTED';
      readonly result: PipelineResult<TSlotMap>;
    }
  >
  | Readonly<{
    readonly ok: true;
    readonly kind: 'PLAN_COMPILED_AND_EXECUTED';
    readonly plan: ExecutionPlan<TSlotMap>;
    readonly result: PipelineResult<TSlotMap>;
  }>;

/** Полный результат фасада. */
export type PipelineFacadeResult<TSlotMap extends Readonly<Record<string, unknown>>> =
  | PipelineFacadeSuccess<TSlotMap>
  | PipelineFacadeFailure;

/** Событие аудита policy-движка фасада. */
export type FacadeAuditEvent = Readonly<
  | {
    readonly kind: 'RULE_REWRITE';
    readonly ruleIndex: number;
    readonly from: PipelineFacadeCommandKind;
    readonly to: PipelineFacadeCommandKind;
  }
  | {
    readonly kind: 'RULE_REJECT';
    readonly ruleIndex: number;
    readonly reason: FacadePolicyRejectReason;
  }
>;

/** Опциональный обработчик событий policy-аудита. */
export type FacadeAuditHook = (event: FacadeAuditEvent) => void;

/* ============================================================================
 * 2. INTERNAL — HANDLER CONTRACTS & POLICY EVALUATION
 * ============================================================================
 */

type FacadeCommandHandler<
  TSlotMap extends Readonly<Record<string, unknown>>,
  TKind extends PipelineFacadeCommandKind,
> = (
  command: Extract<PipelineFacadeCommand<TSlotMap>, Readonly<{ kind: TKind; }>>,
) => Promise<PipelineFacadeResult<TSlotMap>>;

type FacadeHandlerMap<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly COMPILE_PLAN: FacadeCommandHandler<TSlotMap, 'COMPILE_PLAN'>;
  readonly EXECUTE_PLAN: FacadeCommandHandler<TSlotMap, 'EXECUTE_PLAN'>;
  readonly COMPILE_AND_EXECUTE: FacadeCommandHandler<TSlotMap, 'COMPILE_AND_EXECUTE'>;
}>;

/** Опции конструктора фасада. */
export type PipelineFacadeOptions<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly rules?: readonly PipelineFacadeRule<TSlotMap>[];
  readonly handlers?: Partial<FacadeHandlerMap<TSlotMap>>;
  readonly onAuditEvent?: FacadeAuditHook;
}>;

/** Публичный контракт фасада. */
export type PipelineFacade<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly run: (
    command: PipelineFacadeCommand<TSlotMap>,
  ) => Promise<PipelineFacadeResult<TSlotMap>>;
  readonly compile: (
    plugins: readonly StagePlugin<TSlotMap>[],
    config: PipelineConfig<TSlotMap>,
  ) => Promise<PipelineFacadeResult<TSlotMap>>;
  readonly execute: (
    plan: ExecutionPlan<TSlotMap>,
    config: PipelineConfig<TSlotMap>,
    initialSlots?: Readonly<Partial<TSlotMap>>,
  ) => Promise<PipelineFacadeResult<TSlotMap>>;
  readonly compileAndExecute: (
    plugins: readonly StagePlugin<TSlotMap>[],
    config: PipelineConfig<TSlotMap>,
    initialSlots?: Readonly<Partial<TSlotMap>>,
  ) => Promise<PipelineFacadeResult<TSlotMap>>;
}>;

/**
 * Встроенное правило по умолчанию: пропускает команду без изменений.
 * @note Полезно как baseline policy в сценариях без ограничений.
 */
export function createAllowAllRule<
  TSlotMap extends Readonly<Record<string, unknown>>,
>(): PipelineFacadeRule<TSlotMap> {
  return () => ({ kind: 'ALLOW' });
}

/**
 * Правило allow-list для command kind.
 * @note Возвращает policy reject, если команда не входит в allow-list.
 */
export function createAllowedCommandsRule<TSlotMap extends Readonly<Record<string, unknown>>>(
  allowedCommands: readonly PipelineFacadeCommandKind[],
): PipelineFacadeRule<TSlotMap> {
  return (command) => (
    allowedCommands.includes(command.kind)
      ? { kind: 'ALLOW' }
      : {
        kind: 'REJECT',
        reason: {
          kind: 'POLICY_REJECTED',
          code: 'COMMAND_NOT_ALLOWED',
          command: command.kind,
        },
      }
  );
}

function toCompileFailure(error: ExecutionPlanError): PipelineFacadeFailure {
  return { ok: false, kind: 'PLAN_COMPILE_FAILED', error };
}

function toExecutionFailure(reason: PipelineFailureReason): PipelineFacadeFailure {
  return { ok: false, kind: 'PLAN_EXECUTION_FAILED', reason };
}

function assertNever(value: never): never {
  return value;
}

function dispatchHandler<TSlotMap extends Readonly<Record<string, unknown>>>(
  command: PipelineFacadeCommand<TSlotMap>,
  handlers: FacadeHandlerMap<TSlotMap>,
): Promise<PipelineFacadeResult<TSlotMap>> {
  switch (command.kind) {
    case 'COMPILE_PLAN':
      return handlers.COMPILE_PLAN(command);
    case 'EXECUTE_PLAN':
      return handlers.EXECUTE_PLAN(command);
    case 'COMPILE_AND_EXECUTE':
      return handlers.COMPILE_AND_EXECUTE(command);
    default:
      return Promise.resolve(assertNever(command));
  }
}

/**
 * Применяет policy-правила к команде.
 * @note Порядок применения детерминированный и линейный.
 * Для каждого правила сначала вычисляется решение, затем сразу применяется:
 * `ALLOW` -> идем дальше, `REWRITE` -> подменяем команду,
 * `REJECT` -> немедленно завершаем обработку.
 */
function resolveCommandWithRules<TSlotMap extends Readonly<Record<string, unknown>>>(
  command: PipelineFacadeCommand<TSlotMap>,
  rules: readonly PipelineFacadeRule<TSlotMap>[],
  onAuditEvent?: FacadeAuditHook,
):
  | Readonly<{ readonly ok: true; readonly command: PipelineFacadeCommand<TSlotMap>; }>
  | Readonly<{ readonly ok: false; readonly reason: FacadePolicyRejectReason; }>
{
  const resolved = rules.reduce<
    Readonly<
      {
        readonly command: PipelineFacadeCommand<TSlotMap>;
        readonly rejected?: FacadePolicyRejectReason;
      }
    >
  >(
    (state, rule, ruleIndex) => {
      if (state.rejected !== undefined) {
        return state;
      }
      const decision = rule(state.command);
      if (decision.kind === 'ALLOW') {
        return state;
      }
      if (decision.kind === 'REWRITE') {
        onAuditEvent?.({
          kind: 'RULE_REWRITE',
          ruleIndex,
          from: state.command.kind,
          to: decision.command.kind,
        });
        return { command: decision.command };
      }
      onAuditEvent?.({
        kind: 'RULE_REJECT',
        ruleIndex,
        reason: decision.reason,
      });
      return { command: state.command, rejected: decision.reason };
    },
    { command },
  );

  return resolved.rejected === undefined
    ? { ok: true, command: resolved.command }
    : { ok: false, reason: resolved.rejected };
}

function createDefaultHandlers<
  TSlotMap extends Readonly<Record<string, unknown>>,
>(): FacadeHandlerMap<TSlotMap> {
  // Здесь Promise.resolve нужен осознанно:
  // сигнатура всех handlers единообразно async-like без лишнего `async`/`await`.
  const compileHandler: FacadeCommandHandler<TSlotMap, 'COMPILE_PLAN'> = (command) => {
    const planOrError = createExecutionPlanSafe(command.plugins, command.config);
    if ('kind' in planOrError) {
      return Promise.resolve(toCompileFailure(planOrError));
    }
    return Promise.resolve({
      ok: true,
      kind: 'PLAN_COMPILED',
      plan: planOrError,
    });
  };

  const executeHandler: FacadeCommandHandler<TSlotMap, 'EXECUTE_PLAN'> = async (command) => {
    const result = await executePipeline(command.plan, command.config, command.initialSlots);
    if (!result.ok) {
      return toExecutionFailure(result.reason);
    }
    return {
      ok: true,
      kind: 'PLAN_EXECUTED',
      result,
    };
  };

  const compileAndExecuteHandler: FacadeCommandHandler<TSlotMap, 'COMPILE_AND_EXECUTE'> = async (
    command,
  ) => {
    const planOrError = createExecutionPlanSafe(command.plugins, command.config);
    if ('kind' in planOrError) {
      return toCompileFailure(planOrError);
    }
    const result = await executePipeline(planOrError, command.config, command.initialSlots);
    if (!result.ok) {
      return toExecutionFailure(result.reason);
    }
    return {
      ok: true,
      kind: 'PLAN_COMPILED_AND_EXECUTED',
      plan: planOrError,
      result,
    };
  };

  return {
    COMPILE_PLAN: compileHandler,
    EXECUTE_PLAN: executeHandler,
    COMPILE_AND_EXECUTE: compileAndExecuteHandler,
  };
}

/* ============================================================================
 * 3. API — PUBLIC FACADE FACTORY
 * ============================================================================
 */

/**
 * Создает фасад pipeline с policy-движком и таблицей обработчиков.
 * @note Dispatch выполняется через типобезопасный handler map.
 * @note Расширение выполняется через `options.rules` и `options.handlers`.
 */
export function createPipelineFacade<TSlotMap extends Readonly<Record<string, unknown>>>(
  options: PipelineFacadeOptions<TSlotMap> = {},
): PipelineFacade<TSlotMap> {
  const rules = options.rules ?? [createAllowAllRule<TSlotMap>()];
  const handlers: FacadeHandlerMap<TSlotMap> = {
    ...createDefaultHandlers<TSlotMap>(),
    ...options.handlers,
  };

  const run: PipelineFacade<TSlotMap>['run'] = async (command) => {
    const resolved = resolveCommandWithRules(command, rules, options.onAuditEvent);
    if (!resolved.ok) {
      return {
        ok: false,
        kind: 'POLICY_REJECTED',
        reason: resolved.reason,
      };
    }

    return dispatchHandler(resolved.command, handlers);
  };

  return Object.freeze({
    run,
    compile: (plugins, config) => run({ kind: 'COMPILE_PLAN', plugins, config }),
    execute: (plan, config, initialSlots) =>
      run({
        kind: 'EXECUTE_PLAN',
        plan,
        config,
        ...(initialSlots !== undefined && { initialSlots }),
      }),
    compileAndExecute: (plugins, config, initialSlots) =>
      run({
        kind: 'COMPILE_AND_EXECUTE',
        plugins,
        config,
        ...(initialSlots !== undefined && { initialSlots }),
      }),
  });
}
