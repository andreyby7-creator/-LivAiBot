/**
 * @file Unit тесты для domain/Prompt.ts
 * Покрывают Prompt aggregate, factory-функцию createPrompt и runtime-инварианты (assertPromptInvariant, createPromptInvariantError).
 */

import { describe, expect, it } from 'vitest';

import type {
  Constraints,
  Greeting,
  HandoffAction,
  HandoffCondition,
  HandoffRule,
  HandoffRules,
  HandoffTrigger,
  Prompt,
  PromptInvariantError,
  PromptLanguage,
  PromptRaw,
  PromptStyle,
  SystemPrompt,
} from '../../../src/domain/Prompt.js';
import {
  assertPromptInvariant,
  createPrompt,
  createPromptInvariantError,
} from '../../../src/domain/Prompt.js';

/* ============================================================================
 * 🔧 ТЕСТОВЫЕ ХЕЛПЕРЫ
 * ========================================================================== */

const createSystemPrompt = (value: string): SystemPrompt => value as SystemPrompt;
const createGreeting = (value: string): Greeting => value as Greeting;
// eslint-disable-next-line ai-security/model-poisoning -- константные строковые значения для unit-тестов, не используются в обучении моделей
const createConstraints = (value: string): Constraints => value as Constraints;

const createLanguage = (value: PromptLanguage = 'ru'): PromptLanguage => value;
const createStyle = (value: PromptStyle = 'friendly'): PromptStyle => value;

const createHandoffTrigger = (value: HandoffTrigger = 'user_request'): HandoffTrigger => value;
const createHandoffAction = (value: HandoffAction = 'transfer_to_agent'): HandoffAction => value;

const createHandoffCondition = (type: HandoffCondition['type']): HandoffCondition =>
  type === 'sentiment_threshold'
    ? { type: 'sentiment_threshold', value: 0.5 }
    : type === 'keyword_match'
    ? { type: 'keyword_match', keywords: ['operator'] }
    : { type: 'timeout_seconds', seconds: 60 };

const createHandoffRule = (
  overrides: Partial<HandoffRule> = {},
): HandoffRule => ({
  trigger: createHandoffTrigger(),
  action: createHandoffAction(),
  priority: 10,
  conditions: createHandoffCondition('sentiment_threshold'),
  ...overrides,
});

const createHandoffRules = (rules: readonly HandoffRule[] = [createHandoffRule()]): HandoffRules =>
  rules as HandoffRules;

const createPromptRaw = (overrides: Partial<PromptRaw> = {}): PromptRaw => ({
  systemPrompt: 'You are a helpful assistant.',
  greeting: 'Hello!',
  language: createLanguage('ru'),
  style: createStyle('friendly'),
  constraints: 'Be safe and follow the rules.',
  handoffRules: createHandoffRules(),
  ...overrides,
});

const createPromptDomain = (overrides: Partial<Prompt> = {}): Prompt => ({
  systemPrompt: createSystemPrompt('You are a helpful assistant.'),
  greeting: createGreeting('Hello!'),
  language: createLanguage('ru'),
  style: createStyle('friendly'),
  // eslint-disable-next-line ai-security/model-poisoning -- статическое тестовое значение constraints, не используется в inference/training
  constraints: createConstraints('Be safe and follow the rules.'),
  handoffRules: createHandoffRules(),
  ...overrides,
});

/* ============================================================================
 * 🧪 createPromptInvariantError
 * ========================================================================== */

describe('createPromptInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error: PromptInvariantError = createPromptInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PromptInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace и возвращает frozen Error', () => {
    const error = createPromptInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
    expect(Object.isFrozen(error)).toBe(true);
  });
});

/* ============================================================================
 * 🧪 createPrompt (factory)
 * ========================================================================== */

describe('createPrompt — успешный сценарий', () => {
  it('создаёт валидный Prompt и нормализует строки через trim', () => {
    const raw: PromptRaw = createPromptRaw({
      systemPrompt: '  You are a helpful assistant.  ',
      greeting: '  Hello!  ',
      constraints: '  Be safe.  ',
    });

    const prompt = createPrompt(raw);

    expect(prompt.systemPrompt).toBe('You are a helpful assistant.');
    expect(prompt.greeting).toBe('Hello!');
    expect(prompt.constraints).toBe('Be safe.');
    expect(prompt.language).toBe('ru');
    expect(prompt.style).toBe('friendly');
    expect(prompt.handoffRules).toHaveLength(1);
  });

  it('удаляет пустые greeting и constraints после trim', () => {
    const raw: PromptRaw = createPromptRaw({
      greeting: '   ',
      constraints: '   ',
    });

    const prompt = createPrompt(raw);

    expect(prompt.greeting).toBeUndefined();
    expect(prompt.constraints).toBeUndefined();
  });

  it('корректно обрабатывает отсутствие greeting и constraints в raw данных', () => {
    const base = createPromptRaw();
    const raw: PromptRaw = {
      systemPrompt: base.systemPrompt,
      language: base.language,
      style: base.style,
      handoffRules: base.handoffRules,
      // greeting и constraints намеренно опущены
    };

    const prompt = createPrompt(raw);

    expect(prompt.greeting).toBeUndefined();
    expect(prompt.constraints).toBeUndefined();
  });
});

describe('createPrompt — нарушение инвариантов', () => {
  it('бросает PromptInvariantError, если systemPrompt пустой после trim', () => {
    const raw: PromptRaw = createPromptRaw({
      systemPrompt: '   ',
    });

    expect(() => createPrompt(raw)).toThrowError(
      'Prompt invariant violation: systemPrompt MUST be a non-empty string',
    );
  });

  it('бросает PromptInvariantError, если greeting пустой после trim', () => {
    const raw: PromptRaw = createPromptRaw({
      greeting: '   ',
    });

    // greeting будет удалён из prompt, поэтому инвариант не нарушается
    const prompt = createPrompt(raw);

    expect(prompt.greeting).toBeUndefined();
  });

  it('бросает PromptInvariantError, если constraints пустой после trim, но присутствует в Prompt', () => {
    const prompt: Prompt = createPromptDomain({
      // eslint-disable-next-line ai-security/model-poisoning -- локальное тестовое значение для проверки invariant-ветки, не используется в моделях
      constraints: createConstraints('   '),
    });

    expect(() => assertPromptInvariant(prompt)).toThrowError(
      'Prompt invariant violation: constraints MUST be a non-empty string if provided',
    );
  });
});

/* ============================================================================
 * 🧪 assertPromptInvariant — успешный сценарий
 * ========================================================================== */

describe('assertPromptInvariant — успешный сценарий', () => {
  it('не выбрасывает ошибку для валидного Prompt', () => {
    const prompt: Prompt = createPromptDomain();

    expect(() => assertPromptInvariant(prompt)).not.toThrow();
  });

  it('не выбрасывает ошибку, если greeting и constraints не заданы', () => {
    const prompt: Prompt = createPromptDomain({
      greeting: undefined as unknown as Greeting,
      constraints: undefined as unknown as Constraints,
    });

    expect(() => assertPromptInvariant(prompt)).not.toThrow();
  });
});

/* ============================================================================
 * 🧪 assertPromptInvariant — нарушения отдельных инвариантов
 * ========================================================================== */

describe('assertPromptInvariant — systemPrompt', () => {
  it('бросает ошибку, если systemPrompt пустой', () => {
    const prompt: Prompt = createPromptDomain({
      systemPrompt: createSystemPrompt('   '),
    });

    expect(() => assertPromptInvariant(prompt)).toThrowError(
      'Prompt invariant violation: systemPrompt MUST be a non-empty string',
    );
  });
});

describe('assertPromptInvariant — greeting', () => {
  it('бросает ошибку, если greeting пустой', () => {
    const prompt: Prompt = createPromptDomain({
      greeting: createGreeting('   '),
    });

    expect(() => assertPromptInvariant(prompt)).toThrowError(
      'Prompt invariant violation: greeting MUST be a non-empty string if provided',
    );
  });
});

describe('assertPromptInvariant — constraints', () => {
  it('бросает ошибку, если constraints пустой', () => {
    const prompt: Prompt = createPromptDomain({
      // eslint-disable-next-line ai-security/model-poisoning -- локальное тестовое значение для проверки invariant-ветки, не используется в моделях
      constraints: createConstraints('   '),
    });

    expect(() => assertPromptInvariant(prompt)).toThrowError(
      'Prompt invariant violation: constraints MUST be a non-empty string if provided',
    );
  });
});

describe('assertPromptInvariant — handoffRules дубликаты', () => {
  it('бросает ошибку, если handoffRules содержит дубликаты по trigger+priority', () => {
    const rule: HandoffRule = createHandoffRule({
      trigger: createHandoffTrigger('user_request'),
      priority: 5,
    });
    const duplicateRule: HandoffRule = createHandoffRule({
      trigger: createHandoffTrigger('user_request'),
      priority: 5,
    });

    const prompt: Prompt = createPromptDomain({
      handoffRules: createHandoffRules([rule, duplicateRule]),
    });

    expect(() => assertPromptInvariant(prompt)).toThrowError(
      'Prompt invariant violation: handoffRules MUST NOT contain duplicate rules with same trigger and priority',
    );
  });
});

describe('assertPromptInvariant — handoffRules.priority', () => {
  it('бросает ошибку, если priority отрицательный', () => {
    const rule: HandoffRule = createHandoffRule({
      priority: -1,
    });

    const prompt: Prompt = createPromptDomain({
      handoffRules: createHandoffRules([rule]),
    });

    expect(() => assertPromptInvariant(prompt)).toThrowError(
      'Prompt invariant violation: handoffRules priority MUST be a non-negative finite number',
    );
  });

  it('бросает ошибку, если priority не является конечным числом', () => {
    const rule: HandoffRule = createHandoffRule({
      priority: NaN,
    });

    const prompt: Prompt = createPromptDomain({
      handoffRules: createHandoffRules([rule]),
    });

    expect(() => assertPromptInvariant(prompt)).toThrowError(
      'Prompt invariant violation: handoffRules priority MUST be a non-negative finite number',
    );
  });
});
