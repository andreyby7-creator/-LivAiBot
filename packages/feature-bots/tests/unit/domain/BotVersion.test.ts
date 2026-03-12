/**
 * @file Unit тесты для domain/BotVersion.ts
 * Покрывают BotVersion aggregate и runtime-инварианты (assertBotVersionInvariant, createBotVersionInvariantError).
 */

import { describe, expect, it } from 'vitest';

import type {
  BotId,
  BotUserId,
  BotVersion,
  BotWorkspaceId,
  Timestamp,
} from '../../../src/domain/Bot.js';
import type { BotSettings, ContextWindow, Temperature } from '../../../src/domain/BotSettings.js';
import type {
  BotVersionAggregate,
  BotVersionId,
  BotVersionInvariantError,
  BotVersionMetadata,
} from '../../../src/domain/BotVersion.js';
import {
  assertBotVersionInvariant,
  createBotVersionInvariantError,
} from '../../../src/domain/BotVersion.js';
import type { OperationId } from '../../../src/types/bot-commands.js';

const createTimestamp = (value = 1): Timestamp => value as Timestamp;
const createBotVersion = (value = 0): BotVersion => value as BotVersion;
const createBotVersionId = (): BotVersionId => 'bot-version-1' as BotVersionId;
const createBotId = (): BotId => 'bot-1' as BotId;
const createWorkspaceId = (): BotWorkspaceId => 'workspace-1' as BotWorkspaceId;
const createUserId = (): BotUserId => 'user-1' as BotUserId;
const createOperationId = (): OperationId => 'op-1' as OperationId;

// Константные тестовые данные для unit-тестов доменной модели версий бота.
// Данные не попадают в training-пайплайны и не используются для обучения моделей.
// eslint-disable-next-line ai-security/model-poisoning -- безопасные, локальные тестовые фикстуры
const createMetadata = (overrides: Partial<BotVersionMetadata> = {}): BotVersionMetadata => ({
  tags: ['stable'],
  extra: {},
  ...overrides,
});

const createInstruction = (value = 'Test instruction'): string & {
  readonly __brand: 'BotInstruction';
} => value as string & { readonly __brand: 'BotInstruction'; };

// Константные тестовые настройки BotSettings для unit-тестов (локальные фикстуры).
const createBotSettings = (overrides: Partial<BotSettings> = {}): BotSettings => ({
  temperature: 0 as Temperature,
  // eslint-disable-next-line @livai/rag/context-leakage -- константное тестовое значение, не используемое в RAG/training
  contextWindow: 0 as ContextWindow,
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
  extra: {},
  ...overrides,
});

const createValidBotVersion = (
  overrides: Partial<BotVersionAggregate> = {},
): BotVersionAggregate => ({
  id: createBotVersionId(),
  botId: createBotId(),
  workspaceId: createWorkspaceId(),
  version: createBotVersion(1),
  instruction: createInstruction(),
  settings: createBotSettings(),
  operationId: createOperationId(),
  createdAt: createTimestamp(1),
  createdBy: createUserId(),
  metadata: createMetadata(),
  ...overrides,
});

describe('createBotVersionInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error: BotVersionInvariantError = createBotVersionInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BotVersionInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace', () => {
    const error = createBotVersionInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
  });
});

describe('assertBotVersionInvariant — успешный сценарий', () => {
  it('не выбрасывает ошибку для валидной версии бота', () => {
    const version: BotVersionAggregate = createValidBotVersion();

    expect(() => assertBotVersionInvariant(version)).not.toThrow();
  });
});

describe('assertBotVersionInvariant — нарушение instruction', () => {
  it('бросает ошибку, если instruction пустая строка', () => {
    const version: BotVersionAggregate = createValidBotVersion({
      instruction: createInstruction('   '),
    });

    expect(() => assertBotVersionInvariant(version)).toThrowError(
      'BotVersion invariant violation: instruction MUST be a non-empty string',
    );
  });
});

describe('assertBotVersionInvariant — нарушение settings', () => {
  it('бросает ошибку, если settings не объект', () => {
    const version: BotVersionAggregate = {
      ...(createValidBotVersion() as unknown as Record<string, unknown>),
      settings: 42,
    } as unknown as BotVersionAggregate;

    expect(() => assertBotVersionInvariant(version)).toThrowError(
      'BotVersion invariant violation: settings MUST be a non-null object',
    );
  });
});

describe('assertBotVersionInvariant — нарушение version', () => {
  it('бросает ошибку, если version отрицательная или нецелая', () => {
    const version: BotVersionAggregate = createValidBotVersion({
      version: createBotVersion(-1 as unknown as number as BotVersion),
    });

    expect(() => assertBotVersionInvariant(version)).toThrowError(
      'BotVersion invariant violation: version MUST be a non-negative integer',
    );
  });
});

describe('assertBotVersionInvariant — нарушение rollbackFromVersion', () => {
  it('бросает ошибку, если rollbackFromVersion >= version', () => {
    const version: BotVersionAggregate = createValidBotVersion({
      version: createBotVersion(1),
      metadata: createMetadata({
        rollbackFromVersion: createBotVersion(1),
      }),
    });

    expect(() => assertBotVersionInvariant(version)).toThrowError(
      'BotVersion invariant violation: rollbackFromVersion MUST be less than current version',
    );
  });
});
