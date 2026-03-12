/**
 * @file Unit тесты для domain/BotSettings.ts
 * Покрывают BotSettings aggregate и runtime-инварианты (assertBotSettingsInvariant, createBotSettingsInvariantError).
 */

import { describe, expect, it } from 'vitest';

import type {
  BotFeatureFlags,
  BotSettings,
  BotSettingsExtra,
  BotSettingsInvariantError,
  ContextWindow,
  Temperature,
} from '../../../src/domain/BotSettings.js';
import {
  assertBotSettingsInvariant,
  createBotSettingsInvariantError,
} from '../../../src/domain/BotSettings.js';

const createTemperature = (value: number): Temperature => value as Temperature;
// eslint-disable-next-line @livai/rag/context-leakage -- локальное числовое значение для unit-теста, не используется в RAG/training
const createContextWindow = (value: number): ContextWindow => value as ContextWindow;

const createFeatureFlags = (overrides: Partial<BotFeatureFlags> = {}): BotFeatureFlags => ({
  handoff: false,
  analytics: false,
  advanced_memory: false,
  ...overrides,
});

const createExtra = (overrides: Partial<BotSettingsExtra> = {}): BotSettingsExtra => ({
  settingsSchemaVersion: 1,
  featureFlags: createFeatureFlags(),
  integrationConfig: {},
  ...overrides,
});

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
  extra: createExtra(),
  ...overrides,
});

describe('createBotSettingsInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error: BotSettingsInvariantError = createBotSettingsInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BotSettingsInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace', () => {
    const error = createBotSettingsInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
  });
});

describe('assertBotSettingsInvariant — успешный сценарий', () => {
  it('не выбрасывает ошибку для валидных настроек бота', () => {
    const settings: BotSettings = createBotSettings();

    expect(() => assertBotSettingsInvariant(settings)).not.toThrow();
  });
});

describe('assertBotSettingsInvariant — нарушение fallbackMessage', () => {
  it('бросает ошибку, если unrecognizedMessage.message пустой', () => {
    const settings: BotSettings = createBotSettings({
      unrecognizedMessage: {
        message: '   ',
        showSupportHint: false,
      },
    });

    expect(() => assertBotSettingsInvariant(settings)).toThrowError(
      'BotSettings invariant violation: unrecognizedMessage.message MUST be a non-empty string',
    );
  });
});

describe('assertBotSettingsInvariant — нарушение maxSessions', () => {
  it('бросает ошибку, если maxConcurrentSessions <= 0 или нецелое', () => {
    const settings: BotSettings = createBotSettings({
      interruptionRules: {
        allowUserInterruption: true,
        maxConcurrentSessions: 0,
      },
    });

    expect(() => assertBotSettingsInvariant(settings)).toThrowError(
      'BotSettings invariant violation: interruptionRules.maxConcurrentSessions MUST be a positive integer',
    );
  });
});

describe('assertBotSettingsInvariant — нарушение contextWindow', () => {
  it('бросает ошибку, если contextWindow отрицательное или нецелое', () => {
    const settings: BotSettings = createBotSettings({
      contextWindow: createContextWindow(-1),
    });

    expect(() => assertBotSettingsInvariant(settings)).toThrowError(
      'BotSettings invariant violation: contextWindow MUST be a non-negative integer',
    );
  });
});

describe('assertBotSettingsInvariant — нарушение temperature', () => {
  it('бросает ошибку, если temperature не является конечным числом', () => {
    const settings: BotSettings = createBotSettings({
      temperature: createTemperature(Number.POSITIVE_INFINITY),
    });

    expect(() => assertBotSettingsInvariant(settings)).toThrowError(
      'BotSettings invariant violation: temperature MUST be a finite number',
    );
  });
});
