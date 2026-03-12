/**
 * @file Unit тесты для domain/BotTemplate.ts
 * Покрывают BotTemplate aggregate и runtime-инварианты (assertBotTemplateInvariant, createBotTemplateInvariantError).
 */

import { describe, expect, it } from 'vitest';

import type { BotSettings, ContextWindow, Temperature } from '../../../src/domain/BotSettings.js';
import type {
  BotTemplate,
  BotTemplateCapabilities,
  BotTemplateId,
  BotTemplateInvariantError,
  BotTemplateRole,
  BotTemplateTags,
} from '../../../src/domain/BotTemplate.js';
import {
  assertBotTemplateInvariant,
  createBotTemplateInvariantError,
} from '../../../src/domain/BotTemplate.js';

const createTemperature = (value: number): Temperature => value as Temperature;
// eslint-disable-next-line @livai/rag/context-leakage -- локальное числовое значение для unit-теста, не используется в RAG/training
const createContextWindow = (value: number): ContextWindow => value as ContextWindow;

const createBotSettings = (overrides: Partial<BotSettings> = {}): BotSettings => ({
  temperature: createTemperature(0),
  // eslint-disable-next-line @livai/rag/context-leakage -- константное тестовое значение, не используемое в RAG/training
  contextWindow: createContextWindow(0),
  piiMasking: false,
  imageRecognition: false,
  unrecognizedMessage: {
    message: 'fallback',
    showSupportHint: false,
  },
  interruptionRules: {
    allowUserInterruption: true,
    // eslint-disable-next-line @livai/rag/context-leakage -- константное тестовое значение, не используемое в RAG/training
    maxConcurrentSessions: 1,
  },
  extra: {
    settingsSchemaVersion: 1,
    featureFlags: {
      handoff: false,
      analytics: false,
      advanced_memory: false,
    },
    integrationConfig: {},
  },
  ...overrides,
});

const createTemplateId = (): BotTemplateId => 'template-1' as BotTemplateId;

const createRole = (role: BotTemplateRole = 'assistant'): BotTemplateRole => role;

const createCapabilities = (
  values: BotTemplateCapabilities = ['handoff'],
): BotTemplateCapabilities => values;

const createTags = (values: BotTemplateTags = ['sales']): BotTemplateTags => values;

const createBotTemplate = (overrides: Partial<BotTemplate> = {}): BotTemplate => ({
  id: createTemplateId(),
  name: 'Test Template',
  role: createRole('assistant'),
  description: 'Test template description',
  defaultInstruction: 'You are a helpful assistant.',
  defaultSettings: createBotSettings(),
  capabilities: createCapabilities(['handoff', 'advanced_memory']),
  tags: createTags(['sales', 'support']),
  ...overrides,
});

describe('createBotTemplateInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error: BotTemplateInvariantError = createBotTemplateInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BotTemplateInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace', () => {
    const error = createBotTemplateInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
  });
});

describe('assertBotTemplateInvariant — успешный сценарий', () => {
  it('не выбрасывает ошибку для валидного шаблона бота', () => {
    const template: BotTemplate = createBotTemplate();

    expect(() => assertBotTemplateInvariant(template)).not.toThrow();
  });
});

describe('assertBotTemplateInvariant — нарушение name', () => {
  it('бросает ошибку, если name пустой', () => {
    const template: BotTemplate = createBotTemplate({ name: '   ' });

    expect(() => assertBotTemplateInvariant(template)).toThrowError(
      'BotTemplate invariant violation: name MUST be a non-empty string',
    );
  });
});

describe('assertBotTemplateInvariant — нарушение defaultInstruction', () => {
  it('бросает ошибку, если defaultInstruction пустой', () => {
    const template: BotTemplate = createBotTemplate({ defaultInstruction: '   ' });

    expect(() => assertBotTemplateInvariant(template)).toThrowError(
      'BotTemplate invariant violation: defaultInstruction MUST be a non-empty string',
    );
  });
});

describe('assertBotTemplateInvariant — нарушение capabilities', () => {
  it('бросает ошибку, если capabilities содержит дубликаты', () => {
    const template: BotTemplate = createBotTemplate({
      capabilities: createCapabilities(['handoff', 'handoff']),
    });

    expect(() => assertBotTemplateInvariant(template)).toThrowError(
      'BotTemplate invariant violation: capabilities MUST NOT contain duplicates',
    );
  });
});

describe('assertBotTemplateInvariant — нарушение tags', () => {
  it('бросает ошибку, если tags содержит дубликаты', () => {
    const template: BotTemplate = createBotTemplate({
      tags: createTags(['sales', 'sales']),
    });

    expect(() => assertBotTemplateInvariant(template)).toThrowError(
      'BotTemplate invariant violation: tags MUST NOT contain duplicates',
    );
  });
});

describe('assertBotTemplateInvariant — нарушение defaultSettings', () => {
  it('бросает ошибку, если defaultSettings содержит невалидные настройки', () => {
    const template: BotTemplate = createBotTemplate({
      defaultSettings: createBotSettings({
        // invalid: отрицательное contextWindow
        contextWindow: createContextWindow(-1),
      }),
    });

    expect(() => assertBotTemplateInvariant(template)).toThrowError(
      'BotSettings invariant violation: contextWindow MUST be a non-negative integer',
    );
  });
});
