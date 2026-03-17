/**
 * @file packages/feature-bots/src/lib/bot-pipeline.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Bot Pipeline (triggers → deterministic orchestration via DI)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Описывает и оркестрирует pipeline-триггеры (command/event) вокруг операций бота.
 * - Предоставляет hook points для расширения без изменения core логики:
 *   - `beforePublish`
 *   - `afterRollback` (future-proof)
 *   - `onCommandExecuted`
 * - Интеграция с audit разделена:
 *   - pipeline **собирает** audit payload'ы и возвращает их как `auditEvents` (orchestration)
 *   - отправка в SIEM/логи выполняется **вне** pipeline через `emitBotPipelineAuditEvents` (execution)
 *
 * Принципы:
 * - ✅ SRP: только оркестрация (порядок вызовов) + формат результатов/ошибок.
 * - ✅ Deterministic: порядок шагов фиксирован, без `Date.now()` и глобального состояния.
 * - ✅ Pure orchestration: DI hooks/rules/audit-mapper должны быть idempotent/deterministic/side-effect isolated (важно для replay/debug/tests).
 * - ✅ Domain-pure boundary: внутри runner нет прямых IO (audit emit вынесен наружу).
 * - ✅ Guarded: budget/timeout guards на DI-шаги, результат содержит полный `steps` + derived `successfulSteps`.
 * - ✅ Extensible: правила/шаги добавляются через `rules` без правок существующего кода.
 */
import type { BotCommand } from '../types/bot-commands.js';
import { BotCommandTypes } from '../types/bot-commands.js';
import type { BotEvent } from '../types/bot-events.js';
import type {
  BotAuditSink,
  EmitBotAuditEventOptions,
  EmitBotAuditEventResult,
} from './bot-audit.js';
import { emitBotAuditEvent } from './bot-audit.js';

const EMPTY_HOOKS: BotPipelineHooks = {};

/* ============================================================================
 * 🧩 TYPES — TRIGGERS
 * ========================================================================== */

export type BotPipelineTrigger =
  | Readonly<{ readonly kind: 'command_executed'; readonly command: BotCommand; }>
  | Readonly<{ readonly kind: 'event_received'; readonly event: BotEvent; }>;

export type BotPipelineStepId =
  | 'onCommandExecuted'
  | 'beforePublish'
  | 'afterRollback'
  | 'rules'
  | 'audit';

export type BotPipelineStepResult = Readonly<{
  /** Порядковый номер шага для трассировки/логов (детерминированный). */
  readonly index: number;
  readonly stepId: BotPipelineStepId;
  readonly ok: true;
  /** Опциональная длительность шага (только если включено измерение). */
  readonly durationMs?: number;
  /** Дополнительная мета (например, ruleId). */
  readonly meta?: Readonly<{
    readonly ruleId?: string;
    readonly matched?: number;
    readonly executed?: number;
    readonly stoppedOnMatch?: boolean;
  }>;
}>;

export type BotPipelineStepFailure = Readonly<{
  /** Порядковый номер шага для трассировки/логов (детерминированный). */
  readonly index: number;
  readonly stepId: BotPipelineStepId;
  readonly ok: false;
  readonly error: BotPipelineError;
  /** Опциональная длительность шага (только если включено измерение). */
  readonly durationMs?: number;
  /** Дополнительная мета (например, ruleId). */
  readonly meta?: Readonly<{
    readonly ruleId?: string;
    readonly matched?: number;
    readonly executed?: number;
    readonly stoppedOnMatch?: boolean;
  }>;
}>;

export type BotPipelineResult =
  | Readonly<{
    readonly ok: true;
    readonly steps: readonly (BotPipelineStepResult | BotPipelineStepFailure)[];
    /** Удобный derived view: только успешные шаги (не влияет на deterministic contract). */
    readonly successfulSteps: readonly BotPipelineStepResult[];
    /** Собранные audit payload'ы (lazy): эмит выполняется снаружи. */
    readonly auditEvents: readonly unknown[];
  }>
  | Readonly<{
    readonly ok: false;
    readonly steps: readonly (BotPipelineStepResult | BotPipelineStepFailure)[];
    /** Удобный derived view: только успешные шаги (не влияет на deterministic contract). */
    readonly successfulSteps: readonly BotPipelineStepResult[];
    readonly error: BotPipelineError;
    /** Собранные audit payload'ы до ошибки (lazy): эмит выполняется снаружи. */
    readonly auditEvents: readonly unknown[];
  }>;

export type BotPipelineErrorCode =
  | 'PIPELINE_HOOK_FAILED'
  | 'PIPELINE_HOOK_TIMEOUT'
  | 'PIPELINE_RULE_ERROR'
  | 'PIPELINE_RULE_TIMEOUT'
  | 'PIPELINE_BUDGET_EXCEEDED'
  | 'PIPELINE_AUDIT_TIMEOUT'
  | 'PIPELINE_AUDIT_MAPPING_FAILED'
  | 'PIPELINE_AUDIT_TOO_MANY_EVENTS'
  | 'PIPELINE_AUDIT_EMIT_FAILED';

export type BotPipelineError = Readonly<
  Error & {
    readonly code: BotPipelineErrorCode;
    readonly stepId: BotPipelineStepId;
    readonly details?: Readonly<Record<string, string | number | boolean | null>>;
  }
>;

/**
 * Создаёт иммутабельную ошибку pipeline с устойчивым discriminator `code`.
 *
 * @remarks
 * Используйте `code` для мониторинга/алёртов вместо парсинга `message`.
 */
const createBotPipelineError = (
  code: BotPipelineErrorCode,
  stepId: BotPipelineStepId,
  message: string,
  cause?: unknown,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): BotPipelineError => {
  const err = Object.assign(
    new Error(message, cause !== undefined ? { cause } : undefined),
    {
      name: 'BotPipelineError',
      code,
      stepId,
      ...(details !== undefined ? { details } : {}),
    } as const,
  );
  return Object.freeze(err);
};

/* ============================================================================
 * 🔌 HOOKS (DI)
 * ========================================================================== */

export type BotPipelineHookContext = Readonly<{
  readonly trigger: BotPipelineTrigger;
  /**
   * Контракт чистой оркестрации для DI функций pipeline.
   *
   * @remarks
   * DI функции (hooks/rules/audit mapper) MUST быть:
   * - idempotent (повторный вызов не меняет внешнее состояние)
   * - side-effect isolated (любой IO/мутации должны происходить вне pipeline runner)
   * - deterministic для одинакового входа (важно для replay/debug/tests)
   */
  readonly orchestrationConstraint: 'pure_orchestration';
}>;

export type BotPipelineHooks = Readonly<{
  /**
   * Вызывается для любого успешно выполненного command-dispatch слоя (command_executed).
   * Подходит для telemetry/notifications.
   */
  readonly onCommandExecuted?: (
    ctx: BotPipelineHookContext & Readonly<{ readonly command: BotCommand; }>,
  ) => void | Promise<void>;
  /**
   * Hook перед publish.
   *
   * @remarks
   * Вызывается только для command trigger с `type === publish_bot`.
   * Реальное выполнение publish находится в effects/service слое; здесь — только pipeline hook.
   */
  readonly beforePublish?: (
    ctx:
      & BotPipelineHookContext
      & Readonly<
        {
          readonly command:
            & BotCommand
            & Readonly<{ readonly type: typeof BotCommandTypes.PUBLISH_BOT; }>;
        }
      >,
  ) => void | Promise<void>;
  /**
   * Hook после rollback (future-proof).
   *
   * @remarks
   * В текущем контракте нет отдельной команды rollback. Hook оставлен как расширяемая точка
   * и может вызываться кастомными rules.
   */
  readonly afterRollback?: (ctx: BotPipelineHookContext) => void | Promise<void>;
}>;

/* ============================================================================
 * 🧠 RULES (EXTENSIBILITY)
 * ========================================================================== */

export type BotPipelineRuleContext = Readonly<{
  readonly trigger: BotPipelineTrigger;
  readonly hooks: BotPipelineHooks;
}>;

export type BotPipelineRuleBase = Readonly<{
  /** Уникальный ID правила (для observability). */
  readonly id: string;
  /**
   * Быстрый pre-filter по kind триггера.
   *
   * @remarks
   * Уменьшает overhead `match()` при большом количестве правил.
   * Если не задано — правило может применяться к любому kind.
   */
  readonly kinds?: readonly BotPipelineTrigger['kind'][];
  /**
   * Опциональный short-circuit: остановить обработку правил после первого match+run.
   * @defaultValue false
   */
  readonly stopOnMatch?: boolean;
}>;

export type BotPipelineRuleFns = Readonly<{
  /** Матчер: true если правило применимо. */
  readonly match: (trigger: BotPipelineTrigger) => boolean;
  /** Выполнение правила. */
  readonly run: (ctx: BotPipelineRuleContext) => void | Promise<void>;
}>;

export type BotPipelineRule = BotPipelineRuleBase & BotPipelineRuleFns;

/* ============================================================================
 * 🧾 AUDIT (OPTIONAL, DI)
 * ========================================================================== */

export type BotPipelineAuditMapperBase = Readonly<{
  /**
   * Лимит количества audit событий на один trigger, чтобы защититься от flood.
   * @defaultValue 20
   */
  readonly maxEvents?: number;
}>;

export type BotPipelineAuditMapperFns = Readonly<{
  /**
   * Маппер pipeline trigger → audit payloads.
   *
   * @remarks
   * Возвращаем `unknown[]`, потому что audit schema валидируется при эмите (вне pipeline).
   * Это anti-corruption layer: pipeline не должен знать transport shape SIEM.
   */
  readonly toAuditEvents: (trigger: BotPipelineTrigger) => readonly unknown[];
}>;

export type BotPipelineAuditMapper = BotPipelineAuditMapperBase & BotPipelineAuditMapperFns;

export type BotPipelineAuditEmitter = Readonly<{
  readonly sink: BotAuditSink;
  readonly options?: Readonly<EmitBotAuditEventOptions>;
}>;

export type RunBotPipelineOptionsBase = Readonly<{
  readonly hooks?: BotPipelineHooks;
  readonly rules?: readonly BotPipelineRule[];
  /**
   * Audit mapping (lazy): pipeline только собирает payload'ы.
   * Эмит выполняйте отдельно через `emitBotPipelineAuditEvents`.
   */
  readonly audit?: BotPipelineAuditMapper;
  /**
   * Таймаут на выполнение каждого DI-шага (hook/rule).
   * @defaultValue 10_000
   */
  readonly timeoutMs?: number;
  /**
   * Максимальное количество шагов/результатов, чтобы защититься от runaway rules.
   * @defaultValue 50
   */
  readonly maxSteps?: number;
}>;

export type RunBotPipelineOptionsFns = Readonly<{
  /**
   * Включить измерение длительностей шагов через DI clock.
   *
   * @remarks
   * Для детерминизма в тестах передавайте мок (например, инкрементируемый счётчик).
   */
  readonly getNowMs?: () => number;
}>;

export type RunBotPipelineOptions = RunBotPipelineOptionsBase & RunBotPipelineOptionsFns;

const DEFAULT_MAX_STEPS = 50;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_AUDIT_EVENTS = 20;

type TimeoutError = BotPipelineError;

/* eslint-disable @livai/multiagent/orchestration-safety -- Это не multi-agent orchestration: pipeline вызывает DI hooks/rules и защищает их локальным timeout-guard (withTimeout/runStep). Правило не распознаёт guard через функцию-обёртку и помечает безопасные await/Promise.race как "без таймаута". */

const getDurationMs = (
  startedAt: number | undefined,
  endedAt: number | undefined,
): number | undefined =>
  startedAt !== undefined && endedAt !== undefined ? endedAt - startedAt : undefined;

/**
 * Timeout-guard для DI шагов.
 *
 * @remarks
 * Это best-effort защита от зависаний внешних обработчиков. Cancellation не входит в контракт.
 */
const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  mkTimeoutError: () => TimeoutError,
): Promise<T> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(mkTimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

/* ============================================================================
 * 🚦 RUNNER
 * ========================================================================== */

const isPublishCommand = (
  command: BotCommand,
): command is BotCommand & Readonly<{ readonly type: typeof BotCommandTypes.PUBLISH_BOT; }> =>
  command.type === BotCommandTypes.PUBLISH_BOT;

/**
 * Запускает pipeline для одного trigger.
 *
 * @remarks
 * Порядок шагов фиксирован:
 * 1) `onCommandExecuted` (только для command trigger)
 * 2) `beforePublish` (только для publish command trigger)
 * 3) `rules` (все кастомные rules в порядке массива)
 * 4) `audit` (если подключён)
 *
 * При ошибке:
 * - Возвращает `{ ok: false }` и сохраняет уже выполненные шаги.
 * - Не делает retry/compensation — это ответственность effects/infra слоя.
 */
export async function runBotPipeline(
  trigger: BotPipelineTrigger,
  options?: RunBotPipelineOptions,
): Promise<BotPipelineResult> {
  const hooks: BotPipelineHooks = options?.hooks ?? EMPTY_HOOKS;
  const rules = options?.rules ?? [];
  const audit = options?.audit;
  const getNowMs = options?.getNowMs;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEPS;
  const steps: (BotPipelineStepResult | BotPipelineStepFailure)[] = [];
  const auditEvents: unknown[] = [];
  let stepIndex = 0;

  const ctxBase: BotPipelineHookContext = Object.freeze({
    trigger,
    orchestrationConstraint: 'pure_orchestration',
  });

  const pushOk = (
    stepId: BotPipelineStepId,
    durationMs?: number,
    meta?: BotPipelineStepResult['meta'],
  ): void => {
    steps.push({
      index: stepIndex,
      stepId,
      ok: true,
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(meta !== undefined ? { meta } : {}),
    });
    stepIndex += 1;
  };

  const pushFail = (
    stepId: BotPipelineStepId,
    error: BotPipelineError,
    durationMs?: number,
    meta?: BotPipelineStepFailure['meta'],
  ): void => {
    steps.push({
      index: stepIndex,
      stepId,
      ok: false,
      error,
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(meta !== undefined ? { meta } : {}),
    });
    stepIndex += 1;
  };

  const buildOkResult = (): BotPipelineResult => {
    const successfulSteps = steps.filter((s): s is BotPipelineStepResult => s.ok);
    return Object.freeze({
      ok: true,
      steps: Object.freeze([...steps]),
      successfulSteps: Object.freeze(successfulSteps),
      auditEvents: Object.freeze([...auditEvents]),
    });
  };

  const buildFailResult = (error: BotPipelineError): BotPipelineResult => {
    const successfulSteps = steps.filter((s): s is BotPipelineStepResult => s.ok);
    return Object.freeze({
      ok: false,
      steps: Object.freeze([...steps]),
      successfulSteps: Object.freeze(successfulSteps),
      error,
      auditEvents: Object.freeze([...auditEvents]),
    });
  };

  const fail = (
    error: BotPipelineError,
    stepId: BotPipelineStepId,
    durationMs?: number,
    meta?: BotPipelineStepFailure['meta'],
  ): BotPipelineResult => {
    pushFail(stepId, error, durationMs, meta);
    return buildFailResult(error);
  };

  /**
   * Единый исполнитель шага: budget + timeout + duration + стандартизированная ошибка.
   *
   * @remarks
   * `work` MUST соблюдать `orchestrationConstraint`: без IO/мутаций вне DI границы.
   */
  const runStep = async (
    stepId: BotPipelineStepId,
    work: () => Promise<void>,
    onTimeout: () => BotPipelineError,
    onError: (cause: unknown) => BotPipelineError,
    meta?: BotPipelineStepResult['meta'],
  ): Promise<BotPipelineResult | null> => {
    if (steps.length >= maxSteps) {
      return fail(
        createBotPipelineError(
          'PIPELINE_BUDGET_EXCEEDED',
          stepId,
          `Bot pipeline exceeded maxSteps (${steps.length} >= ${maxSteps})`,
          undefined,
          { maxSteps, steps: steps.length },
        ),
        stepId,
        undefined,
        meta,
      );
    }

    const startedAt = getNowMs?.();
    try {
      await withTimeout(work(), timeoutMs, onTimeout);
      const endedAt = getNowMs?.();
      const durationMs = getDurationMs(startedAt, endedAt);
      pushOk(stepId, durationMs, meta);
      return null;
    } catch (cause) {
      const endedAt = getNowMs?.();
      const durationMs = getDurationMs(startedAt, endedAt);
      return fail(onError(cause), stepId, durationMs, meta);
    }
  };

  const runCommandHooks = async (): Promise<BotPipelineResult | null> => {
    if (trigger.kind !== 'command_executed') return null;

    const onCommandExecuted = hooks.onCommandExecuted;
    if (onCommandExecuted !== undefined) {
      const r = await runStep(
        'onCommandExecuted',
        async () => {
          const ctx = { ...ctxBase, command: trigger.command } as const;
          await onCommandExecuted(ctx);
        },
        () =>
          createBotPipelineError(
            'PIPELINE_HOOK_TIMEOUT',
            'onCommandExecuted',
            'Bot pipeline onCommandExecuted timed out',
          ),
        (cause) =>
          createBotPipelineError(
            'PIPELINE_HOOK_FAILED',
            'onCommandExecuted',
            'Bot pipeline hook onCommandExecuted failed',
            cause,
          ),
      );
      if (r !== null) return r;
    }

    if (isPublishCommand(trigger.command)) {
      const beforePublish = hooks.beforePublish;
      const publishCommand = trigger.command;
      if (beforePublish !== undefined) {
        const r = await runStep(
          'beforePublish',
          async () => {
            const ctx = { ...ctxBase, command: publishCommand } as const;
            await beforePublish(ctx);
          },
          () =>
            createBotPipelineError(
              'PIPELINE_HOOK_TIMEOUT',
              'beforePublish',
              'Bot pipeline beforePublish timed out',
            ),
          (cause) =>
            createBotPipelineError(
              'PIPELINE_HOOK_FAILED',
              'beforePublish',
              'Bot pipeline hook beforePublish failed',
              cause,
            ),
        );
        if (r !== null) return r;
      }
    }

    return null;
  };

  // eslint-disable-next-line sonarjs/cognitive-complexity -- содержит pre-filter по kind, optional short-circuit (stopOnMatch) и единый error-contract; дробление ухудшит читаемость и увеличит риск расхождений
  const runRules = async (): Promise<BotPipelineResult | null> => {
    const startedAt = getNowMs?.();
    if (rules.length === 0) {
      const endedAt = getNowMs?.();
      pushOk('rules', getDurationMs(startedAt, endedAt), { matched: 0, executed: 0 });
      return null;
    }

    let matched = 0;
    let executed = 0;
    let stoppedOnMatch = false;
    for (const rule of rules) {
      if (rule.kinds !== undefined && !rule.kinds.includes(trigger.kind)) continue;
      if (!rule.match(trigger)) continue;
      matched += 1;

      const r = await runStep(
        'rules',
        async () => {
          await rule.run(Object.freeze({ trigger, hooks }));
        },
        () =>
          createBotPipelineError(
            'PIPELINE_RULE_TIMEOUT',
            'rules',
            `Bot pipeline rule timed out: ${rule.id}`,
            undefined,
            { ruleId: rule.id },
          ),
        (cause) =>
          createBotPipelineError(
            'PIPELINE_RULE_ERROR',
            'rules',
            `Bot pipeline rule failed: ${rule.id}`,
            cause,
            { ruleId: rule.id },
          ),
        Object.freeze({ ruleId: rule.id }),
      );
      if (r !== null) return r;
      executed += 1;
      if (rule.stopOnMatch === true) {
        stoppedOnMatch = true;
        break;
      }
    }
    const endedAt = getNowMs?.();
    pushOk(
      'rules',
      getDurationMs(startedAt, endedAt),
      { matched, executed, ...(stoppedOnMatch ? { stoppedOnMatch: true } : {}) },
    );
    return null;
  };

  const runAudit = (): Promise<BotPipelineResult | null> => {
    if (audit === undefined) return Promise.resolve(null);
    return runStep(
      'audit',
      () =>
        new Promise<void>((resolve, reject) => {
          try {
            const values = audit.toAuditEvents(trigger);
            const maxEvents = audit.maxEvents ?? DEFAULT_MAX_AUDIT_EVENTS;
            if (values.length > maxEvents) {
              throw createBotPipelineError(
                'PIPELINE_AUDIT_TOO_MANY_EVENTS',
                'audit',
                `Bot pipeline audit produced too many events (${values.length} > ${maxEvents})`,
                undefined,
                { count: values.length, max: maxEvents },
              );
            }
            auditEvents.push(...values);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      () =>
        createBotPipelineError(
          'PIPELINE_AUDIT_TIMEOUT',
          'audit',
          'Bot pipeline audit mapping timed out',
        ),
      (cause) => {
        if (
          cause instanceof Error && (cause as Partial<BotPipelineError>).name === 'BotPipelineError'
        ) {
          return cause as BotPipelineError;
        }
        return createBotPipelineError(
          'PIPELINE_AUDIT_MAPPING_FAILED',
          'audit',
          'Bot pipeline audit mapping failed',
          cause,
        );
      },
    );
  };

  const r1 = await runCommandHooks();
  if (r1 !== null) return r1;

  const r2 = await runRules();
  if (r2 !== null) return r2;

  const r3 = await runAudit();
  if (r3 !== null) return r3;

  return buildOkResult();
}

/* eslint-enable @livai/multiagent/orchestration-safety */

/**
 * Эмитит собранные audit payload'ы через DI sink.
 *
 * @remarks
 * Это execution-часть, специально вынесенная из `runBotPipeline`, чтобы runner оставался orchestration-only.
 */
export function emitBotPipelineAuditEvents(
  values: readonly unknown[],
  emitter: BotPipelineAuditEmitter,
): Readonly<
  {
    readonly ok: true;
    readonly results: readonly EmitBotAuditEventResult[];
  } | {
    readonly ok: false;
    readonly results: readonly EmitBotAuditEventResult[];
    readonly error: BotPipelineError;
  }
> {
  const results: EmitBotAuditEventResult[] = [];
  try {
    for (const value of values) {
      const res = emitBotAuditEvent(value, emitter.sink, emitter.options);
      results.push(res);
      if (!res.ok) {
        const err = createBotPipelineError(
          'PIPELINE_AUDIT_EMIT_FAILED',
          'audit',
          'Bot pipeline audit emit failed',
          res.error,
        );
        return Object.freeze({ ok: false, results: Object.freeze([...results]), error: err });
      }
    }
    return Object.freeze({ ok: true, results: Object.freeze([...results]) });
  } catch (cause) {
    const err = createBotPipelineError(
      'PIPELINE_AUDIT_EMIT_FAILED',
      'audit',
      'Bot pipeline audit emit failed',
      cause,
    );
    return Object.freeze({ ok: false, results: Object.freeze([...results]), error: err });
  }
}
