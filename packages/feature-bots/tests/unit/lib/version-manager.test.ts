/**
 * @file Unit тесты для lib/version-manager.ts
 * Цель: 100% покрытие файла version-manager.ts
 */

/* eslint-disable @livai/rag/context-leakage -- тесты используют доменное поле BotSettingsSnapshot.contextWindow, не runtime/global context */

import { describe, expect, it } from 'vitest';

import type { Bot, BotVersion, Revision, Timestamp } from '../../../src/domain/Bot.js';
import type {
  BotInstruction,
  BotSettingsSnapshot,
  BotVersionAggregate,
  BotVersionId,
} from '../../../src/domain/BotVersion.js';
import {
  applyVersionToBot,
  createNextBotVersion,
  createRollbackBotVersion,
} from '../../../src/lib/version-manager.js';
import type { OperationId } from '../../../src/types/bot-commands.js';

const ts = (n: number): Timestamp => n as unknown as Timestamp;
const rev = (n: number): Revision => n as unknown as Revision;
const bv = (n: number): BotVersion => n as unknown as BotVersion;
const op = (s: string): OperationId => s as unknown as OperationId;
const vid = (s: string): BotVersionId => s as unknown as BotVersionId;
const instr = (s: string): BotInstruction => s as unknown as BotInstruction;

const settings = (overrides: Partial<BotSettingsSnapshot> = {}): BotSettingsSnapshot =>
  ({
    temperature: 0.7 as any,
    contextWindow: 4096 as any,
    piiMasking: true,
    imageRecognition: false,
    unrecognizedMessage: { message: 'fallback', showSupportHint: true },
    interruptionRules: { allowUserInterruption: true, maxConcurrentSessions: 1 },
    ...overrides,
  }) as any;

const bot = (overrides: Partial<Bot> = {}): Bot =>
  ({
    id: 'bot-1' as any,
    workspaceId: 'ws-1' as any,
    name: 'Bot',
    status: { type: 'draft' },
    revision: rev(0),
    currentVersion: bv(1),
    createdAt: ts(1),
    createdBy: 'user-1' as any,
    updatedAt: ts(2),
    updatedBy: 'user-1' as any,
    ...overrides,
  }) as any;

const versionAgg = (overrides: Partial<BotVersionAggregate> = {}): BotVersionAggregate =>
  ({
    id: vid('ver-1'),
    botId: 'bot-1' as any,
    workspaceId: 'ws-1' as any,
    version: bv(1),
    instruction: instr('i1'),
    settings: settings(),
    operationId: op('op-1'),
    createdAt: ts(10),
    createdBy: 'user-1' as any,
    metadata: {},
    ...overrides,
  }) as any;

describe('createNextBotVersion', () => {
  it('создаёт next версию (+1), замораживает aggregate и metadata, переносит audit/ids', () => {
    const b = bot({ currentVersion: bv(5) });
    const prev = versionAgg({ version: bv(7), metadata: { tags: ['x'] } as any });

    const next = createNextBotVersion({
      id: vid('ver-2'),
      bot: b,
      previous: prev,
      instruction: instr('i2'),
      settings: settings({ piiMasking: false }),
      operationId: op('op-2'),
      createdAt: ts(20),
      createdBy: 'user-2' as any,
      metadata: { tags: ['t'] } as any,
    });

    expect(next.version).toBe(8);
    expect(next.botId).toBe(b.id);
    expect(next.workspaceId).toBe(b.workspaceId);
    expect(next.instruction).toBe('i2');
    expect(next.operationId).toBe('op-2');
    expect(next.createdAt).toBe(20);
    expect(next.createdBy).toBe('user-2');
    expect(next.metadata).toEqual({ tags: ['t'] });
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.metadata)).toBe(true);
  });

  it('metadata опционален: без metadata возвращается пустой frozen object', () => {
    const next = createNextBotVersion({
      id: vid('ver-no-meta'),
      bot: bot(),
      previous: versionAgg({ version: bv(1) }),
      instruction: instr('i'),
      settings: settings(),
      operationId: op('op'),
      createdAt: ts(1),
      createdBy: 'user' as any,
    });

    expect(next.metadata).toEqual({});
    expect(Object.isFrozen(next.metadata)).toBe(true);
  });
});

describe('createRollbackBotVersion', () => {
  it('создаёт rollback-версию как next(from.version+1), берёт instruction/settings из to, пишет rollbackFromVersion', () => {
    const b = bot();
    const from = versionAgg({
      version: bv(10),
      instruction: instr('from'),
      settings: settings({ piiMasking: true }),
    });
    const to = versionAgg({
      version: bv(3),
      instruction: instr('to-instr'),
      settings: settings({ piiMasking: false }),
    });

    const rb = createRollbackBotVersion({
      id: vid('ver-rb'),
      bot: b,
      from,
      to,
      operationId: op('op-rb'),
      createdAt: ts(30),
      createdBy: 'user-3' as any,
      metadata: { tags: ['rb'] } as any,
    });

    expect(rb.version).toBe(11);
    expect(rb.instruction).toBe('to-instr');
    expect(rb.settings.piiMasking).toBe(false);
    expect(rb.metadata).toEqual({ tags: ['rb'], rollbackFromVersion: 10 });
    expect(Object.isFrozen(rb)).toBe(true);
    expect(Object.isFrozen(rb.metadata)).toBe(true);
  });

  it('metadata опционален: rollbackFromVersion всё равно добавляется', () => {
    const rb = createRollbackBotVersion({
      id: vid('ver-rb2'),
      bot: bot(),
      from: versionAgg({ version: bv(2) }),
      to: versionAgg({ version: bv(1), instruction: instr('i-to') }),
      operationId: op('op'),
      createdAt: ts(1),
      createdBy: 'user' as any,
    });

    expect(rb.metadata).toEqual({ rollbackFromVersion: 2 });
    expect(Object.isFrozen(rb.metadata)).toBe(true);
  });
});

describe('applyVersionToBot', () => {
  it('синхронизирует currentVersion с aggregate.version и инкрементит revision', () => {
    const b = bot({ revision: rev(5), currentVersion: bv(1) });
    const v = versionAgg({ version: bv(99) });

    const updated = applyVersionToBot({
      bot: b,
      version: v,
      updatedAt: ts(123),
      updatedBy: 'user-9' as any,
    });

    expect(updated).not.toBe(b);
    expect(updated.currentVersion).toBe(99);
    expect(updated.revision).toBe(6);
    expect(updated.updatedAt).toBe(123);
    expect(updated.updatedBy).toBe('user-9');
    expect(Object.isFrozen(updated)).toBe(true);
  });
});

/* eslint-enable @livai/rag/context-leakage */
