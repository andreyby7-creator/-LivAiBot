/**
 * @file Unit-тесты для актуальной архитектуры `types/bots.ts`.
 *
 * Здесь почти нет runtime-кода (в основном type-only), поэтому тесты — это проверки
 * формы данных через создание объектов, удовлетворяющих типам.
 */

import { describe, expect, it } from 'vitest';

import type { OperationState } from '@livai/core';
import type { ID, ISODateString } from '@livai/core-contracts';

import type {
  BotError,
  BotErrorCategory,
  BotErrorContext,
  BotErrorMappingConfig,
  BotErrorSeverity,
  BotInfo,
  BotsOperations,
  BotsState,
  BotStatus,
  OperationKey,
} from '../../../src/types/bots.js';

const iso = (): ISODateString => '2026-01-01T00:00:00.000Z' as ISODateString;
const botId = (): ID<'Bot'> => 'bot-1' as ID<'Bot'>;
const wsId = (): ID<'Workspace'> => 'ws-1' as ID<'Workspace'>;

const botInfo = (overrides: Partial<BotInfo> = {}): BotInfo => ({
  id: botId(),
  name: 'Bot',
  status: { type: 'draft' },
  workspaceId: wsId(),
  currentVersion: 1,
  createdAt: iso(),
  ...overrides,
});

describe('BotStatus', () => {
  it('поддерживает draft', () => {
    const s: BotStatus = { type: 'draft' };
    expect(s.type).toBe('draft');
  });

  it('поддерживает active', () => {
    const s: BotStatus = { type: 'active', publishedAt: iso() };
    expect(s.type).toBe('active');
    expect(s.publishedAt).toBeDefined();
  });

  it('поддерживает paused', () => {
    const s: BotStatus = { type: 'paused', pausedAt: iso(), reason: 'manual' };
    expect(s.type).toBe('paused');
    expect(s.reason).toBe('manual');
  });

  it('поддерживает suspended', () => {
    const s: BotStatus = { type: 'suspended', suspendedAt: iso(), reason: 'security_risk' };
    expect(s.type).toBe('suspended');
    expect(s.reason).toBe('security_risk');
  });

  it('поддерживает deprecated (с replacementBotId и без)', () => {
    const s1: BotStatus = { type: 'deprecated', deprecatedAt: iso() };
    const s2: BotStatus = { type: 'deprecated', deprecatedAt: iso(), replacementBotId: botId() };
    expect(s1.type).toBe('deprecated');
    expect(s1.replacementBotId).toBeUndefined();
    expect(s2.replacementBotId).toBeDefined();
  });
});

describe('BotError', () => {
  it('поддерживает category/severity/context/retryable', () => {
    const ctx: BotErrorContext = { field: 'name', value: 'x' };
    const err: BotError = {
      category: 'validation',
      code: 'BOT_NAME_INVALID',
      severity: 'medium',
      context: ctx,
      retryable: false,
    };
    expect(err.category).toBe('validation');
    expect(err.severity).toBe('medium');
    expect(err.context?.field).toBe('name');
  });

  it('BotErrorCategory и BotErrorSeverity имеют ожидаемые варианты (smoke)', () => {
    const categories: readonly BotErrorCategory[] = [
      'validation',
      'policy',
      'permission',
      'channel',
      'webhook',
      'parsing',
      'integration',
    ];
    const severities: readonly BotErrorSeverity[] = ['low', 'medium', 'high', 'critical'];
    expect(categories).toHaveLength(7);
    expect(severities).toHaveLength(4);
  });
});

describe('BotErrorMappingConfig', () => {
  it('поддерживает base + опциональный extractContext', () => {
    const cfg: BotErrorMappingConfig = {
      code: 'BOT_NAME_INVALID',
      category: 'validation',
      severity: 'medium',
      retryable: false,
      extractContext: (_e: unknown) => ({ field: 'name', value: 'x' }),
    };
    expect(cfg.code).toBe('BOT_NAME_INVALID');
    expect(cfg.extractContext?.({})).toEqual({ field: 'name', value: 'x' });
  });
});

describe('BotsState', () => {
  it('содержит entities + operations', () => {
    const idleOp = <T, K extends string>(
      operation: K,
    ): OperationState<T, K, BotError> => ({ status: 'loading', operation } as any);

    const operations: BotsOperations = {
      create: idleOp<BotInfo, 'create'>('create'),
      update: idleOp<BotInfo, 'update'>('update'),
      delete: idleOp<void, 'delete'>('delete'),
    };

    const state: BotsState = {
      entities: { [botId()]: botInfo() },
      operations,
    };

    const keys: readonly OperationKey[] = ['create', 'update', 'delete'];
    expect(keys).toHaveLength(3);
    expect(Object.keys(state.entities)).toHaveLength(1);
    expect(state.operations.create.status).toBe('loading');
    expect(state.operations.delete.status).toBe('loading');
  });
});
