/**
 * @file Unit тесты для domain/Bot.ts
 * Покрывают Bot aggregate типы и runtime-инварианты (assertBotInvariant, createBotInvariantError).
 */

import { describe, expect, it } from 'vitest';

import type {
  ActiveBot,
  Bot,
  BotId,
  BotUserId,
  BotVersion,
  BotWorkspaceId,
  DeletedBot,
  Revision,
  Timestamp,
} from '../../../src/domain/Bot.js';
import { assertBotInvariant, createBotInvariantError } from '../../../src/domain/Bot.js';

const createTimestamp = (value = 1): Timestamp => value as Timestamp;
const createRevision = (value = 0): Revision => value as Revision;
const createBotVersion = (value = 0): BotVersion => value as BotVersion;
const createBotId = (): BotId => 'bot-1' as BotId;
const createWorkspaceId = (): BotWorkspaceId => 'workspace-1' as BotWorkspaceId;
const createUserId = (): BotUserId => 'user-1' as BotUserId;

const createActiveBot = (overrides: Partial<ActiveBot> = {}): ActiveBot => ({
  id: createBotId(),
  workspaceId: createWorkspaceId(),
  name: 'Test Bot',
  revision: createRevision(0),
  currentVersion: createBotVersion(0),
  metadata: {},
  createdAt: createTimestamp(1),
  createdBy: createUserId(),
  status: { type: 'draft' },
  ...overrides,
});

const createDeletedBot = (overrides: Partial<DeletedBot> = {}): DeletedBot => ({
  id: createBotId(),
  workspaceId: createWorkspaceId(),
  name: 'Deleted Bot',
  revision: createRevision(0),
  currentVersion: createBotVersion(0),
  metadata: {},
  createdAt: createTimestamp(1),
  createdBy: createUserId(),
  status: { type: 'deleted' },
  deletedAt: createTimestamp(2),
  ...overrides,
});

describe('createBotInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error = createBotInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BotInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace', () => {
    const error = createBotInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
  });
});

describe('assertBotInvariant — успешные сценарии', () => {
  it('не выбрасывает ошибку для валидного активного бота', () => {
    const bot: Bot = createActiveBot();

    expect(() => assertBotInvariant(bot)).not.toThrow();
  });

  it('не выбрасывает ошибку для валидного удалённого бота', () => {
    const bot: Bot = createDeletedBot();

    expect(() => assertBotInvariant(bot)).not.toThrow();
  });
});

describe('assertBotInvariant — нарушение инвариантов deletedAt', () => {
  it('бросает ошибку, если deleted бот без deletedAt', () => {
    const bot: Bot = {
      ...(createDeletedBot() as unknown as Record<string, unknown>),
      deletedAt: undefined,
    } as unknown as Bot;

    expect(() => assertBotInvariant(bot)).toThrowError(
      'Bot invariant violation: deleted bot MUST have deletedAt',
    );
  });

  it('бросает ошибку, если не-deleted бот с deletedAt', () => {
    const bot: Bot = {
      ...(createActiveBot() as unknown as Record<string, unknown>),
      deletedAt: createTimestamp(2),
    } as unknown as Bot;

    expect(() => assertBotInvariant(bot)).toThrowError(
      'Bot invariant violation: non-deleted bot MUST NOT have deletedAt',
    );
  });
});

describe('assertBotInvariant — нарушение инвариантов revision и currentVersion', () => {
  it('бросает ошибку, если revision отрицательный или нецелый', () => {
    const bot: Bot = createActiveBot({
      revision: createRevision(-1 as unknown as number as Revision),
    });

    expect(() => assertBotInvariant(bot)).toThrowError(
      'Bot invariant violation: revision MUST be a non-negative integer',
    );
  });

  it('бросает ошибку, если currentVersion отрицательный или нецелый', () => {
    const bot: Bot = createActiveBot({
      currentVersion: createBotVersion(-1 as unknown as number as BotVersion),
    });

    expect(() => assertBotInvariant(bot)).toThrowError(
      'Bot invariant violation: currentVersion MUST be a non-negative integer',
    );
  });
});
