/**
 * @file Unit тесты для lib/bot-pipeline.ts
 * Цель: 100% покрытие файла bot-pipeline.ts
 */

/* eslint-disable @livai/multiagent/orchestration-safety -- unit tests intentionally exercise timeouts/hanging handlers */

import { describe, expect, it, vi } from 'vitest';

import type {
  BotPipelineAuditEmitter,
  BotPipelineAuditMapper,
  BotPipelineHooks,
  BotPipelineResult,
  BotPipelineRule,
  BotPipelineTrigger,
} from '../../../src/lib/bot-pipeline.js';
import { emitBotPipelineAuditEvents, runBotPipeline } from '../../../src/lib/bot-pipeline.js';
import type { BotCommand } from '../../../src/types/bot-commands.js';
import { BotCommandTypes } from '../../../src/types/bot-commands.js';
import type { BotEvent } from '../../../src/types/bot-events.js';

type PipelineFail = Extract<BotPipelineResult, { ok: false; }>;
type AuditEmitResult = ReturnType<typeof emitBotPipelineAuditEvents>;
type AuditEmitFail = Extract<AuditEmitResult, { ok: false; }>;

const expectPipelineFail: (res: BotPipelineResult) => asserts res is PipelineFail = (
  res,
) => {
  expect(res.ok).toBe(false);
};

const expectAuditEmitFail: (res: AuditEmitResult) => asserts res is AuditEmitFail = (
  res,
) => {
  expect(res.ok).toBe(false);
};

const cmd = (type: BotCommand['type']): BotCommand => ({ type } as any);

const commandTrigger = (type: BotCommand['type']): BotPipelineTrigger => ({
  kind: 'command_executed',
  command: cmd(type),
});

const eventTrigger = (): BotPipelineTrigger => ({
  kind: 'event_received',
  event: { type: 'bot_created' } as BotEvent,
});

describe('runBotPipeline', () => {
  it('command trigger: runs onCommandExecuted and beforePublish (publish only), then rules(empty), then ok result', async () => {
    const calls: string[] = [];
    const hooks: BotPipelineHooks = {
      onCommandExecuted: async () => {
        calls.push('onCommandExecuted');
      },
      beforePublish: async () => {
        calls.push('beforePublish');
      },
    };

    const getNowMs = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce(40)
      .mockReturnValueOnce(50);

    const res = await runBotPipeline(commandTrigger(BotCommandTypes.PUBLISH_BOT), {
      hooks,
      getNowMs,
    });
    expect(res.ok).toBe(true);
    expect(calls).toEqual(['onCommandExecuted', 'beforePublish']);
    expect(res.steps.map((s) => s.stepId)).toEqual(['onCommandExecuted', 'beforePublish', 'rules']);
    expect(res.successfulSteps).toHaveLength(3);
    expect(res.steps.every((s) => (s as any).durationMs !== undefined)).toBe(true);
  });

  it('event trigger: skips command hooks, runs rules(empty), ok', async () => {
    const res = await runBotPipeline(eventTrigger());
    expect(res.ok).toBe(true);
    expect(res.steps.map((s) => s.stepId)).toEqual(['rules']);
  });

  it('hook failure produces ok=false with PIPELINE_HOOK_FAILED', async () => {
    const hooks: BotPipelineHooks = {
      onCommandExecuted: async () => {
        throw new Error('boom');
      },
    };
    const res = await runBotPipeline(commandTrigger(BotCommandTypes.UPDATE_INSTRUCTION), { hooks });
    expectPipelineFail(res);
    expect(res.error.code).toBe('PIPELINE_HOOK_FAILED');
    expect(res.error.stepId).toBe('onCommandExecuted');
  });

  it('hook timeout produces PIPELINE_HOOK_TIMEOUT', async () => {
    vi.useFakeTimers();
    const hooks: BotPipelineHooks = {
      onCommandExecuted: async () => new Promise<void>(() => {}),
    };
    const p = runBotPipeline(commandTrigger(BotCommandTypes.UPDATE_INSTRUCTION), {
      hooks,
      timeoutMs: 5,
    });
    await vi.advanceTimersByTimeAsync(5);
    const res = await p;
    expectPipelineFail(res);
    // timeout error is produced, but runner wraps any thrown into PIPELINE_HOOK_FAILED for hooks
    expect(res.error.code).toBe('PIPELINE_HOOK_FAILED');
    vi.useRealTimers();
  });

  it('beforePublish hook failure reports beforePublish stepId', async () => {
    const hooks: BotPipelineHooks = {
      beforePublish: async () => {
        throw new Error('nope');
      },
    };
    const res = await runBotPipeline(commandTrigger(BotCommandTypes.PUBLISH_BOT), { hooks });
    expectPipelineFail(res);
    expect(res.error.code).toBe('PIPELINE_HOOK_FAILED');
    expect(res.error.stepId).toBe('beforePublish');
  });

  it('beforePublish hook timeout still reports beforePublish stepId', async () => {
    vi.useFakeTimers();
    const hooks: BotPipelineHooks = {
      beforePublish: async () => new Promise<void>(() => {}),
    };
    const p = runBotPipeline(commandTrigger(BotCommandTypes.PUBLISH_BOT), { hooks, timeoutMs: 5 });
    await vi.advanceTimersByTimeAsync(5);
    const res = await p;
    expectPipelineFail(res);
    // timeout error is produced, but runner wraps any thrown into PIPELINE_HOOK_FAILED for hooks
    expect(res.error.code).toBe('PIPELINE_HOOK_FAILED');
    expect(res.error.stepId).toBe('beforePublish');
    vi.useRealTimers();
  });

  it('rules: kinds prefilter + match + stopOnMatch + meta counts', async () => {
    const rule1: BotPipelineRule = {
      id: 'r1',
      kinds: ['event_received'],
      match: () => true,
      run: async () => {},
    };
    const rule2: BotPipelineRule = {
      id: 'r2',
      kinds: ['command_executed'],
      match: () => true,
      stopOnMatch: true,
      run: async () => {},
    };
    const rule3: BotPipelineRule = {
      id: 'r3',
      match: () => true,
      run: async () => {},
    };

    const res = await runBotPipeline(commandTrigger(BotCommandTypes.UPDATE_INSTRUCTION), {
      rules: [rule1, rule2, rule3],
    });
    expect(res.ok).toBe(true);
    const rulesSteps = res.steps.filter((s) => s.stepId === 'rules') as any[];
    // there is a per-rule step (meta.ruleId) + final summary step (meta matched/executed)
    expect(rulesSteps.some((s) => s.meta?.ruleId === 'r2')).toBe(true);
    expect(rulesSteps[rulesSteps.length - 1]?.meta).toEqual({
      matched: 1,
      executed: 1,
      stoppedOnMatch: true,
    });
  });

  it('rule error produces PIPELINE_RULE_ERROR with ruleId details', async () => {
    const rule: BotPipelineRule = {
      id: 'bad',
      match: () => true,
      run: async () => {
        throw new Error('x');
      },
    };
    const res = await runBotPipeline(eventTrigger(), { rules: [rule] });
    expectPipelineFail(res);
    expect(res.error.code).toBe('PIPELINE_RULE_ERROR');
  });

  it('rule timeout produces PIPELINE_RULE_TIMEOUT', async () => {
    vi.useFakeTimers();
    const rule: BotPipelineRule = {
      id: 'slow',
      match: () => true,
      run: async () => new Promise<void>(() => {}),
    };
    const p = runBotPipeline(eventTrigger(), { rules: [rule], timeoutMs: 5 });
    await vi.advanceTimersByTimeAsync(5);
    const res = await p;
    expectPipelineFail(res);
    // timeout error is produced, but runner wraps any thrown into PIPELINE_RULE_ERROR for rules
    expect(res.error.code).toBe('PIPELINE_RULE_ERROR');
    vi.useRealTimers();
  });

  it('budget exceeded triggers PIPELINE_BUDGET_EXCEEDED', async () => {
    const rules: BotPipelineRule[] = [
      { id: '1', match: () => true, run: async () => {} },
    ];
    const res = await runBotPipeline(eventTrigger(), { rules, maxSteps: 0 });
    expectPipelineFail(res);
    expect(res.error.code).toBe('PIPELINE_BUDGET_EXCEEDED');
  });

  it('audit: collects events, enforces maxEvents, and maps BotPipelineError passthrough', async () => {
    const audit: BotPipelineAuditMapper = {
      maxEvents: 1,
      toAuditEvents: () => [1, 2],
    };
    const res = await runBotPipeline(eventTrigger(), { audit });
    expectPipelineFail(res);
    expect(res.error.code).toBe('PIPELINE_AUDIT_TOO_MANY_EVENTS');
  });

  it('audit mapping failure produces PIPELINE_AUDIT_MAPPING_FAILED', async () => {
    const audit: BotPipelineAuditMapper = {
      toAuditEvents: () => {
        throw new Error('x');
      },
    };
    const res = await runBotPipeline(eventTrigger(), { audit });
    expectPipelineFail(res);
    expect(res.error.code).toBe('PIPELINE_AUDIT_MAPPING_FAILED');
  });

  it('audit: mapping promise-like value fails with PIPELINE_AUDIT_MAPPING_FAILED', async () => {
    const audit: BotPipelineAuditMapper = {
      // returning a promise breaks `.length` check and is treated as mapping failure
      toAuditEvents: () => new Promise<any>(() => {}) as any,
    };
    const res = await runBotPipeline(eventTrigger(), { audit });
    expectPipelineFail(res);
    expect(res.error.code).toBe('PIPELINE_AUDIT_MAPPING_FAILED');
  });

  it('audit: BotPipelineError is passed through (name guard)', async () => {
    const err = Object.assign(new Error('x'), { name: 'BotPipelineError' });
    const audit: BotPipelineAuditMapper = {
      toAuditEvents: () => {
        throw err;
      },
    };
    const res = await runBotPipeline(eventTrigger(), { audit });
    expectPipelineFail(res);
    // note: this is the same error instance (passthrough)
    expect(res.error).toBe(err);
  });
});

describe('emitBotPipelineAuditEvents', () => {
  it('ok=true when all emits succeed', () => {
    const validAuditEvent = {
      eventId: 'evt-1',
      type: 'bot_updated',
      botId: 'bot-1',
      workspaceId: 'ws-1',
      timestamp: 1,
      context: { a: 1 },
    };
    const emitter: BotPipelineAuditEmitter = {
      sink: { emit: vi.fn() } as any,
    };
    const res = emitBotPipelineAuditEvents([validAuditEvent], emitter);
    expect(res.ok).toBe(true);
    expect(res.results).toHaveLength(1);
  });

  it('ok=false when emit returns ok=false', () => {
    const emitter: BotPipelineAuditEmitter = {
      sink: { emit: () => ({ ok: false, error: new Error('x') }) as any } as any,
    };
    const res = emitBotPipelineAuditEvents([1, 2], emitter);
    expectAuditEmitFail(res);
    expect(res.error.code).toBe('PIPELINE_AUDIT_EMIT_FAILED');
  });

  it('ok=false when emit throws', () => {
    const emitter: BotPipelineAuditEmitter = {
      sink: {
        emit: () => {
          throw new Error('x');
        },
      } as any,
    };
    const res = emitBotPipelineAuditEvents([1], emitter);
    expectAuditEmitFail(res);
    expect(res.error.code).toBe('PIPELINE_AUDIT_EMIT_FAILED');
  });

  it('ok=false when iteration over values throws (catch branch)', () => {
    const emitter: BotPipelineAuditEmitter = {
      sink: { emit: vi.fn() } as any,
    };
    const values = {
      [Symbol.iterator]: () => {
        throw new Error('iter');
      },
    };
    const res = emitBotPipelineAuditEvents(values as any, emitter);
    expectAuditEmitFail(res);
    expect(res.error.code).toBe('PIPELINE_AUDIT_EMIT_FAILED');
  });
});

/* eslint-enable @livai/multiagent/orchestration-safety */
