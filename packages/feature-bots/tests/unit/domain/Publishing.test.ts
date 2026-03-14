/**
 * @file Unit тесты для domain/Publishing.ts
 * Покрывают Publishing типы и createPublishingInvariantError.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type { BotId, BotVersion, Timestamp } from '../../../src/domain/Bot.js';
import type {
  ActivePublishing,
  DraftPublishing,
  PausedPublishing,
  Publishing,
  PublishingInvariantError,
  PublishingStatus,
} from '../../../src/domain/Publishing.js';
import { createPublishingInvariantError } from '../../../src/domain/Publishing.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createBotId = (value = 'bot-1'): BotId => value as BotId;
const createBotVersion = (value = 0): BotVersion => value as BotVersion;
const createTimestamp = (value = 1): Timestamp => value as Timestamp;

// ============================================================================
// Тесты для createPublishingInvariantError
// ============================================================================

describe('createPublishingInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error = createPublishingInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PublishingInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace', () => {
    const error = createPublishingInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
    expect(error.stack).toBeTruthy();
  });

  it('создаёт frozen error объект', () => {
    const error = createPublishingInvariantError('frozen-test');

    expect(Object.isFrozen(error)).toBe(true);
  });

  it('работает с пустой строкой', () => {
    const error = createPublishingInvariantError('');

    expect(error.message).toBe('');
    expect(error.name).toBe('PublishingInvariantError');
  });

  it('работает с длинным сообщением', () => {
    const longMessage = 'a'.repeat(1000);
    const error = createPublishingInvariantError(longMessage);

    expect(error.message).toBe(longMessage);
  });

  it('создаёт ошибку, совместимую с PublishingInvariantError типом', () => {
    const error: PublishingInvariantError = createPublishingInvariantError('type-test');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PublishingInvariantError');
  });
});

// ============================================================================
// Тесты для DraftPublishing
// ============================================================================

describe('DraftPublishing', () => {
  it('создаёт DraftPublishing с минимальными полями', () => {
    const publishing: DraftPublishing = {
      botId: createBotId('bot-1'),
      status: 'draft',
    };

    expect(publishing.botId).toBe('bot-1');
    expect(publishing.status).toBe('draft');
  });

  it('создаёт DraftPublishing без дополнительных полей', () => {
    const publishing: DraftPublishing = {
      botId: createBotId('bot-draft'),
      status: 'draft',
    };

    expect(publishing).not.toHaveProperty('publishedAt');
    expect(publishing).not.toHaveProperty('publishedVersion');
    expect(publishing).not.toHaveProperty('rollbackVersion');
  });
});

// ============================================================================
// Тесты для ActivePublishing
// ============================================================================

describe('ActivePublishing', () => {
  it('создаёт ActivePublishing без rollbackVersion', () => {
    const publishing: ActivePublishing = {
      botId: createBotId('bot-1'),
      status: 'active',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(5),
    };

    expect(publishing.botId).toBe('bot-1');
    expect(publishing.status).toBe('active');
    expect(publishing.publishedAt).toBe(1000);
    expect(publishing.publishedVersion).toBe(5);
    expect(publishing.rollbackVersion).toBeUndefined();
  });

  it('создаёт ActivePublishing с rollbackVersion', () => {
    const publishing: ActivePublishing = {
      botId: createBotId('bot-2'),
      status: 'active',
      publishedAt: createTimestamp(2000),
      publishedVersion: createBotVersion(5),
      rollbackVersion: createBotVersion(3),
    };

    expect(publishing.botId).toBe('bot-2');
    expect(publishing.status).toBe('active');
    expect(publishing.publishedAt).toBe(2000);
    expect(publishing.publishedVersion).toBe(5);
    expect(publishing.rollbackVersion).toBe(3);
  });

  it('создаёт ActivePublishing с различными версиями', () => {
    const publishing: ActivePublishing = {
      botId: createBotId('bot-3'),
      status: 'active',
      publishedAt: createTimestamp(3000),
      publishedVersion: createBotVersion(10),
      rollbackVersion: createBotVersion(7),
    };

    expect(publishing.publishedVersion).toBe(10);
    expect(publishing.rollbackVersion).toBe(7);
  });
});

// ============================================================================
// Тесты для PausedPublishing
// ============================================================================

describe('PausedPublishing', () => {
  it('создаёт PausedPublishing без rollbackVersion', () => {
    const publishing: PausedPublishing = {
      botId: createBotId('bot-1'),
      status: 'paused',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(5),
    };

    expect(publishing.botId).toBe('bot-1');
    expect(publishing.status).toBe('paused');
    expect(publishing.publishedAt).toBe(1000);
    expect(publishing.publishedVersion).toBe(5);
    expect(publishing.rollbackVersion).toBeUndefined();
  });

  it('создаёт PausedPublishing с rollbackVersion', () => {
    const publishing: PausedPublishing = {
      botId: createBotId('bot-2'),
      status: 'paused',
      publishedAt: createTimestamp(2000),
      publishedVersion: createBotVersion(5),
      rollbackVersion: createBotVersion(3),
    };

    expect(publishing.botId).toBe('bot-2');
    expect(publishing.status).toBe('paused');
    expect(publishing.publishedAt).toBe(2000);
    expect(publishing.publishedVersion).toBe(5);
    expect(publishing.rollbackVersion).toBe(3);
  });

  it('создаёт PausedPublishing с различными версиями', () => {
    const publishing: PausedPublishing = {
      botId: createBotId('bot-3'),
      status: 'paused',
      publishedAt: createTimestamp(3000),
      publishedVersion: createBotVersion(10),
      rollbackVersion: createBotVersion(7),
    };

    expect(publishing.publishedVersion).toBe(10);
    expect(publishing.rollbackVersion).toBe(7);
  });
});

// ============================================================================
// Тесты для Publishing (discriminated union)
// ============================================================================

describe('Publishing', () => {
  it('создаёт Publishing как DraftPublishing', () => {
    const publishing: Publishing = {
      botId: createBotId('bot-1'),
      status: 'draft',
    };

    expect(publishing.status).toBe('draft');
    expect(publishing.botId).toBe('bot-1');
  });

  it('создаёт Publishing как ActivePublishing без rollbackVersion', () => {
    const publishing: Publishing = {
      botId: createBotId('bot-2'),
      status: 'active',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(5),
    };

    expect(publishing.status).toBe('active');
    expect(publishing.publishedAt).toBe(1000);
    expect(publishing.publishedVersion).toBe(5);
    expect(publishing.rollbackVersion).toBeUndefined();
  });

  it('создаёт Publishing как ActivePublishing с rollbackVersion', () => {
    const publishing: Publishing = {
      botId: createBotId('bot-3'),
      status: 'active',
      publishedAt: createTimestamp(2000),
      publishedVersion: createBotVersion(5),
      rollbackVersion: createBotVersion(3),
    };

    expect(publishing.status).toBe('active');
    expect(publishing.rollbackVersion).toBe(3);
  });

  it('создаёт Publishing как PausedPublishing без rollbackVersion', () => {
    const publishing: Publishing = {
      botId: createBotId('bot-4'),
      status: 'paused',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(5),
    };

    expect(publishing.status).toBe('paused');
    expect(publishing.publishedAt).toBe(1000);
    expect(publishing.publishedVersion).toBe(5);
    expect(publishing.rollbackVersion).toBeUndefined();
  });

  it('создаёт Publishing как PausedPublishing с rollbackVersion', () => {
    const publishing: Publishing = {
      botId: createBotId('bot-5'),
      status: 'paused',
      publishedAt: createTimestamp(2000),
      publishedVersion: createBotVersion(5),
      rollbackVersion: createBotVersion(3),
    };

    expect(publishing.status).toBe('paused');
    expect(publishing.rollbackVersion).toBe(3);
  });

  it('поддерживает все варианты discriminated union', () => {
    const draft: Publishing = {
      botId: createBotId('bot-draft'),
      status: 'draft',
    };

    const active: Publishing = {
      botId: createBotId('bot-active'),
      status: 'active',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(1),
    };

    const paused: Publishing = {
      botId: createBotId('bot-paused'),
      status: 'paused',
      publishedAt: createTimestamp(2000),
      publishedVersion: createBotVersion(2),
    };

    expect(draft.status).toBe('draft');
    expect(active.status).toBe('active');
    expect(paused.status).toBe('paused');
  });
});

// ============================================================================
// Тесты для PublishingStatus
// ============================================================================

describe('PublishingStatus', () => {
  it('поддерживает все значения union типа', () => {
    const statuses: PublishingStatus[] = ['draft', 'active', 'paused'];

    expect(statuses).toHaveLength(3);
    expect(statuses).toContain('draft');
    expect(statuses).toContain('active');
    expect(statuses).toContain('paused');
  });

  it('извлекает статус из DraftPublishing', () => {
    const publishing: DraftPublishing = {
      botId: createBotId('bot-1'),
      status: 'draft',
    };

    const status: PublishingStatus = publishing.status;
    expect(status).toBe('draft');
  });

  it('извлекает статус из ActivePublishing', () => {
    const publishing: ActivePublishing = {
      botId: createBotId('bot-1'),
      status: 'active',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(1),
    };

    const status: PublishingStatus = publishing.status;
    expect(status).toBe('active');
  });

  it('извлекает статус из PausedPublishing', () => {
    const publishing: PausedPublishing = {
      botId: createBotId('bot-1'),
      status: 'paused',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(1),
    };

    const status: PublishingStatus = publishing.status;
    expect(status).toBe('paused');
  });

  it('использует PublishingStatus в type guard', () => {
    const publishing: Publishing = {
      botId: createBotId('bot-1'),
      status: 'draft',
    };

    const checkStatus = (p: Publishing): PublishingStatus => p.status;

    expect(checkStatus(publishing)).toBe('draft');
  });
});

// ============================================================================
// Тесты для проверки инвариантов структуры
// ============================================================================

describe('Publishing structure invariants', () => {
  it('DraftPublishing не содержит publishedAt', () => {
    const publishing: DraftPublishing = {
      botId: createBotId('bot-1'),
      status: 'draft',
    };

    expect(publishing).not.toHaveProperty('publishedAt');
    expect(publishing).not.toHaveProperty('publishedVersion');
  });

  it('ActivePublishing всегда содержит publishedAt и publishedVersion', () => {
    const publishing: ActivePublishing = {
      botId: createBotId('bot-1'),
      status: 'active',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(1),
    };

    expect(publishing).toHaveProperty('publishedAt');
    expect(publishing).toHaveProperty('publishedVersion');
    expect(publishing.publishedAt).toBe(1000);
    expect(publishing.publishedVersion).toBe(1);
  });

  it('PausedPublishing всегда содержит publishedAt и publishedVersion', () => {
    const publishing: PausedPublishing = {
      botId: createBotId('bot-1'),
      status: 'paused',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(1),
    };

    expect(publishing).toHaveProperty('publishedAt');
    expect(publishing).toHaveProperty('publishedVersion');
    expect(publishing.publishedAt).toBe(1000);
    expect(publishing.publishedVersion).toBe(1);
  });

  it('botId immutable для всех состояний', () => {
    const botId = createBotId('immutable-bot');

    const draft: Publishing = {
      botId,
      status: 'draft',
    };

    const active: Publishing = {
      botId,
      status: 'active',
      publishedAt: createTimestamp(1000),
      publishedVersion: createBotVersion(1),
    };

    const paused: Publishing = {
      botId,
      status: 'paused',
      publishedAt: createTimestamp(2000),
      publishedVersion: createBotVersion(2),
    };

    expect(draft.botId).toBe(botId);
    expect(active.botId).toBe(botId);
    expect(paused.botId).toBe(botId);
  });
});
