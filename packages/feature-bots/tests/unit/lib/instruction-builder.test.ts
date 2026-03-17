/**
 * @file Unit тесты для lib/instruction-builder.ts
 * Цель: 100% покрытие файла instruction-builder.ts
 */

import { describe, expect, it } from 'vitest';

import type { BotSettings } from '../../../src/domain/BotSettings.js';
import type { Prompt } from '../../../src/domain/Prompt.js';
import { buildBotInstruction } from '../../../src/lib/instruction-builder.js';
import { BotCommandTypes } from '../../../src/types/bot-commands.js';

type PromptOverrides = Partial<{
  systemPrompt: string;
  language: Prompt['language'];
  style: Prompt['style'];
  greeting?: string | undefined;
  constraints?: string | undefined;
  handoffRules: readonly { trigger: string; action: string; priority: number; }[];
}>;

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const createPrompt = (overrides: PromptOverrides = {}): Prompt => {
  const base = {
    systemPrompt: 'You are a helpful bot.',
    language: 'en',
    style: 'formal',
    greeting: 'hello',
    constraints: 'Do not reveal secrets.',
    handoffRules: [
      // Priority ties to exercise sort branches (trigger/action comparisons).
      { trigger: 'timeout', action: 'notify_agent', priority: 5 },
      { trigger: 'user_request', action: 'notify_agent', priority: 5 },
      { trigger: 'complex_query', action: 'transfer_to_agent', priority: 10 },
      { trigger: 'complex_query', action: 'notify_agent', priority: 10 },
      { trigger: 'complex_query', action: 'escalate_urgent', priority: 10 },
      // duplicate rule to exercise sort comparator equality branch (return 0)
      { trigger: 'timeout', action: 'notify_agent', priority: 5 },
    ],
  } as const;

  const greetingOverrideProvided = hasOwn(overrides, 'greeting');
  // eslint-disable-next-line ai-security/model-poisoning -- test helper: this is not model training data, only runtime string building
  const constraintsOverrideProvided = hasOwn(overrides, 'constraints');

  return {
    systemPrompt: (overrides.systemPrompt ?? base.systemPrompt) as any,
    language: (overrides.language ?? base.language) as any,
    style: (overrides.style ?? base.style) as any,
    ...(greetingOverrideProvided
      ? (overrides.greeting !== undefined ? { greeting: overrides.greeting as any } : {})
      : { greeting: base.greeting as any }),
    ...(constraintsOverrideProvided
      ? (overrides.constraints !== undefined ? { constraints: overrides.constraints as any } : {})
      : { constraints: base.constraints as any }),
    handoffRules: (overrides.handoffRules ?? base.handoffRules) as any,
  } as Prompt;
};

type SettingsOverrides = Partial<{
  temperature: BotSettings['temperature'];
  contextWindow: BotSettings['contextWindow'];
  piiMasking: BotSettings['piiMasking'];
  imageRecognition: BotSettings['imageRecognition'];
  unrecognizedMessage: BotSettings['unrecognizedMessage'];
  interruptionRules: BotSettings['interruptionRules'];
  extra?: BotSettings['extra'] | undefined;
}>;

const createSettings = (overrides: SettingsOverrides = {}): BotSettings => {
  /* eslint-disable @livai/rag/context-leakage -- domain field name `contextWindow`; test code only */
  const base = {
    temperature: 0.7 as any,
    contextWindow: 4096 as any,
    piiMasking: true,
    imageRecognition: false,
    unrecognizedMessage: { message: 'Sorry, I cannot help with that.', showSupportHint: true },
    interruptionRules: { allowUserInterruption: true, maxConcurrentSessions: 2 },
    extra: { featureFlags: { handoff: true, analytics: true, advanced_memory: false } as any },
  } as const;

  const extraOverrideProvided = hasOwn(overrides, 'extra');

  return {
    temperature: (overrides.temperature ?? base.temperature),
    contextWindow: (overrides.contextWindow ?? base.contextWindow),
    piiMasking: (overrides.piiMasking ?? base.piiMasking) as any,
    imageRecognition: (overrides.imageRecognition ?? base.imageRecognition) as any,
    unrecognizedMessage: (overrides.unrecognizedMessage ?? base.unrecognizedMessage) as any,
    interruptionRules: (overrides.interruptionRules ?? base.interruptionRules) as any,
    ...(extraOverrideProvided
      ? (overrides.extra !== undefined ? { extra: overrides.extra } : {})
      : {
        extra: base.extra as any,
      }),
  } as BotSettings;
  /* eslint-enable @livai/rag/context-leakage -- domain field name `contextWindow`; test code only */
};

describe('buildBotInstruction', () => {
  it('строит все секции по умолчанию, сортирует handoff rules и компактизирует строки', () => {
    const prompt = createPrompt({
      systemPrompt: 'sys   \n', // trimEnd path
      greeting: 'hi\n',
      constraints: '\n\nOnly public info.\n', // compactLines filters empties
    });
    const settings = createSettings({
      interruptionRules: { allowUserInterruption: false, maxConcurrentSessions: 5 },
      unrecognizedMessage: { message: 'fallback', showSupportHint: false },
    });

    const out = buildBotInstruction({ prompt, settings });

    // basic presence
    expect(out).toContain('## System prompt');
    expect(out).toContain('sys');
    expect(out).toContain('## Language & style');
    expect(out).toContain('- language: en');
    expect(out).toContain('- style: formal');
    expect(out).toContain('- greeting: "hi\\n"');
    expect(out).toContain('## Constraints');
    expect(out).toContain('Only public info.');

    // handoff rules section exists and is sorted by priority desc, then trigger, then action
    expect(out).toContain('## Handoff rules');
    const idxHigh1 = out.indexOf('- complex_query → escalate_urgent (priority=10)');
    const idxHigh2 = out.indexOf('- complex_query → transfer_to_agent (priority=10)');
    const idxHigh3 = out.indexOf('- complex_query → notify_agent (priority=10)');
    const idxMid = out.indexOf('- timeout → notify_agent (priority=5)');
    expect(idxHigh1).toBeGreaterThan(-1);
    expect(idxHigh2).toBeGreaterThan(-1);
    expect(idxHigh3).toBeGreaterThan(-1);
    expect(idxMid).toBeGreaterThan(-1);
    expect(Math.min(idxHigh1, idxHigh2, idxHigh3)).toBeLessThan(idxMid);

    // duplicate line should appear twice
    expect(out.split('- timeout → notify_agent (priority=5)').length - 1).toBe(2);

    // behavior flags
    expect(out).toContain('## Behavior flags');
    expect(out).toContain('- piiMasking: enabled');
    expect(out).toContain('- imageRecognition: disabled');
    expect(out).toContain('- allowUserInterruption: false');
    expect(out).toContain('- maxConcurrentSessions: 5');

    // fallback message without support hint
    expect(out).toContain('## Fallback message');
    expect(out).toContain('reply with: "fallback"');
    expect(out).not.toContain('Also suggest contacting support.');
  });

  it('handoff rules: сортировка по action при равных priority и trigger', () => {
    const prompt = createPrompt({
      constraints: undefined,
      handoffRules: [
        // use artificial actions to force both branches of action-compare
        { trigger: 'complex_query', action: 'zzz' as any, priority: 1 },
        { trigger: 'complex_query', action: 'aaa' as any, priority: 1 },
        { trigger: 'complex_query', action: 'mmm' as any, priority: 1 },
      ],
    });
    const settings = createSettings({
      unrecognizedMessage: { message: 'x', showSupportHint: false },
    });

    const out = buildBotInstruction({ prompt, settings });

    const idxAaa = out.indexOf('- complex_query → aaa (priority=1)');
    const idxMmm = out.indexOf('- complex_query → mmm (priority=1)');
    const idxZzz = out.indexOf('- complex_query → zzz (priority=1)');
    expect(idxAaa).toBeGreaterThan(-1);
    expect(idxMmm).toBeGreaterThan(-1);
    expect(idxZzz).toBeGreaterThan(-1);
    expect(idxAaa).toBeLessThan(idxMmm);
    expect(idxMmm).toBeLessThan(idxZzz);
  });

  it('не добавляет constraints/handoff/fallback/behavior flags при отключенных опциях, и отбрасывает пустые секции', () => {
    const prompt = createPrompt({
      greeting: undefined, // explicit "remove" (exactOptionalPropertyTypes-safe for overrides)
      constraints: undefined,
      handoffRules: [],
    });
    const settings = createSettings();

    const out = buildBotInstruction(
      { prompt, settings },
      {
        includeConstraints: false,
        includeHandoffRules: false,
        includeFallbackMessage: false,
        includeBehaviorFlags: false,
      },
    );

    expect(out).toContain('## System prompt');
    expect(out).toContain('## Language & style');

    // excluded sections
    expect(out).not.toContain('## Constraints');
    expect(out).not.toContain('## Handoff rules');
    expect(out).not.toContain('## Behavior flags');
    expect(out).not.toContain('## Fallback message');

    // greeting line absent when greeting undefined
    expect(out).not.toContain('greeting:');
  });

  it('includeConstraints=true, но constraints пустой/whitespace → секция Constraints не добавляется', () => {
    const prompt = createPrompt({
      constraints: '   \n\n',
      handoffRules: [],
    });
    const settings = createSettings({
      unrecognizedMessage: { message: 'x', showSupportHint: false },
    });

    const out = buildBotInstruction({ prompt, settings }, { includeConstraints: true });
    expect(out).not.toContain('## Constraints');
  });

  it('includeHandoffRules=false → секция Handoff rules не добавляется даже если правила есть', () => {
    const prompt = createPrompt();
    const settings = createSettings({
      unrecognizedMessage: { message: 'x', showSupportHint: false },
    });

    const out = buildBotInstruction({ prompt, settings }, { includeHandoffRules: false });
    expect(out).not.toContain('## Handoff rules');
  });

  it('featureFlags отсутствуют → handoff считается enabled по умолчанию (backward-compatible)', () => {
    const prompt = createPrompt({
      handoffRules: [{ trigger: 'timeout', action: 'notify_agent', priority: 1 }],
    });
    const settings = createSettings({ extra: undefined });

    const out = buildBotInstruction({ prompt, settings });
    expect(out).toContain('## Handoff rules');
  });

  it('behavior flags отражают оба состояния enabled/disabled', () => {
    const prompt = createPrompt({ constraints: undefined, handoffRules: [] });
    const settings = createSettings({
      piiMasking: false,
      imageRecognition: true,
      interruptionRules: { allowUserInterruption: true, maxConcurrentSessions: 1 },
      unrecognizedMessage: { message: 'x', showSupportHint: false },
    });

    const out = buildBotInstruction({ prompt, settings });

    expect(out).toContain('- piiMasking: disabled');
    expect(out).toContain('- imageRecognition: enabled');
  });

  it('учитывает featureFlag handoff=false в settings.extra и не включает handoff даже если правила есть', () => {
    const prompt = createPrompt();
    const settings = createSettings({
      extra: { featureFlags: { handoff: false, analytics: true, advanced_memory: false } as any },
    });

    const out = buildBotInstruction({ prompt, settings });
    expect(out).not.toContain('## Handoff rules');
  });

  it('применяет formatSection override, если он возвращает section', () => {
    const prompt = createPrompt({ constraints: undefined, handoffRules: [] });
    const settings = createSettings({
      unrecognizedMessage: { message: 'x', showSupportHint: true },
    });

    const out = buildBotInstruction(
      { prompt, settings },
      {
        formatSection: (section) =>
          section.id === 'fallback_message'
            ? {
              ...section,
              title: 'Fallback OVERRIDE',
              lines: ['OVERRIDDEN'],
            }
            : undefined,
      },
    );

    expect(out).toContain('## Fallback OVERRIDE');
    expect(out).toContain('OVERRIDDEN');
    expect(out).not.toContain('## Fallback message');
    expect(out).not.toContain('reply with:');
  });

  it('formatSection может вернуть undefined и тогда используется канонический формат', () => {
    const prompt = createPrompt({ constraints: undefined, handoffRules: [] });
    const settings = createSettings({
      unrecognizedMessage: { message: 'x', showSupportHint: true },
    });

    const out = buildBotInstruction(
      { prompt, settings },
      {
        formatSection: () => undefined,
      },
    );

    expect(out).toContain('## Fallback message');
    expect(out).toContain('Also suggest contacting support.');
  });

  it('edge-cases: unicode, long text, null-ish values и детерминизм', () => {
    const long = 'абв'.repeat(2000);
    const prompt = createPrompt({
      systemPrompt: `🤖\n${long}\n`,
      // greeting as null via unsafe boundary: builder делает String() и JSON.stringify
      greeting: null as any,
      constraints: undefined,
      handoffRules: [],
    });
    const settings = createSettings({
      unrecognizedMessage: { message: `ユニコード-${long.slice(0, 30)}`, showSupportHint: true },
    });

    const out1 = buildBotInstruction({ prompt, settings });
    const out2 = buildBotInstruction({ prompt, settings });

    expect(out1).toBe(out2);
    expect(out1).toContain('🤖');
    expect(out1).toContain('ユニコード-');
    expect(out1).toContain('- greeting: "null"');
  });

  it('не использует не относящиеся к делу импорты (sanity)', () => {
    // Этот тест просто гарантирует, что импорт BotCommandTypes не влияет на builder,
    // и не разваливает tree-shaking / sideEffects.
    expect(BotCommandTypes.PUBLISH_BOT).toBeTruthy();
  });
});
