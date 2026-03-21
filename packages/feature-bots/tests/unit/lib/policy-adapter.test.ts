/**
 * @file Unit тесты для lib/policy-adapter.ts
 * Цель: 100% покрытие файла policy-adapter.ts
 */

import { describe, expect, it, vi } from 'vitest';

import type { ISODateString } from '@livai/core-contracts';

import {
  adaptBotModeToBotStatus,
  adaptBotPolicyActionToBotCommandType,
  AllBotPolicyActions,
  isBotMode,
  isBotPolicyAction,
  parseBotMode,
  parseBotPolicyAction,
} from '../../../src/lib/policy-adapter.js';
import { BotCommandTypes } from '../../../src/types/bot-commands.js';

const asISO = (v: string): ISODateString => v as ISODateString;

describe('adaptBotModeToBotStatus', () => {
  it('маппит draft', () => {
    expect(adaptBotModeToBotStatus({ mode: 'draft' })).toEqual({ type: 'draft' });
  });

  it('маппит active', () => {
    const publishedAt = asISO('2026-01-01T00:00:00.000Z');
    expect(adaptBotModeToBotStatus({ mode: 'active', publishedAt })).toEqual({
      type: 'active',
      publishedAt,
    });
  });

  it('маппит paused', () => {
    const pausedAt = asISO('2026-01-02T00:00:00.000Z');
    const reason = 'manual' as any; // BotPauseReason типизируется в другом модуле, здесь достаточно runtime значения
    expect(adaptBotModeToBotStatus({ mode: 'paused', pausedAt, reason })).toEqual({
      type: 'paused',
      pausedAt,
      reason,
    });
  });

  it('маппит archived', () => {
    const archivedAt = asISO('2026-01-03T00:00:00.000Z');
    expect(adaptBotModeToBotStatus({ mode: 'archived', archivedAt })).toEqual({
      type: 'archived',
      archivedAt,
    });
  });

  it('бросает на неожиданном mode (assertNever)', () => {
    expect(() => adaptBotModeToBotStatus({ mode: '???' } as any)).toThrow(/Unexpected value/);
  });
});

describe('adapt policy action to command type', () => {
  it('использует resolve(), если он вернул BotCommandType', () => {
    const resolve = vi.fn(() => BotCommandTypes.MANAGE_MULTI_AGENT);
    const cmd = adaptBotPolicyActionToBotCommandType('configure', { resolve });
    expect(cmd).toBe(BotCommandTypes.MANAGE_MULTI_AGENT);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({ action: 'configure' });
  });

  it('fallback к canonical маппингу, если resolve() вернул undefined', () => {
    const resolve = vi.fn(() => undefined);
    const cmd = adaptBotPolicyActionToBotCommandType('publish', { resolve, context: {} });
    expect(cmd).toBe(BotCommandTypes.PUBLISH_BOT);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('канонический маппинг всех действий', () => {
    expect(adaptBotPolicyActionToBotCommandType('configure')).toBe(
      BotCommandTypes.UPDATE_INSTRUCTION,
    );
    expect(adaptBotPolicyActionToBotCommandType('create_custom')).toBe(
      BotCommandTypes.CREATE_CUSTOM_BOT,
    );
    expect(adaptBotPolicyActionToBotCommandType('publish')).toBe(BotCommandTypes.PUBLISH_BOT);
    expect(adaptBotPolicyActionToBotCommandType('pause')).toBe(BotCommandTypes.PAUSE_BOT);
    expect(adaptBotPolicyActionToBotCommandType('resume')).toBe(BotCommandTypes.RESUME_BOT);
    expect(adaptBotPolicyActionToBotCommandType('execute')).toBe(
      BotCommandTypes.SIMULATE_BOT_MESSAGE,
    );
    expect(adaptBotPolicyActionToBotCommandType('archive')).toBe(BotCommandTypes.ARCHIVE_BOT);
  });

  it('бросает на неожиданном action (assertNever)', () => {
    expect(() => adaptBotPolicyActionToBotCommandType('???' as any)).toThrow(/Unexpected value/);
  });
});

describe('AllBotPolicyActions / guards / parse', () => {
  it('AllBotPolicyActions содержит все ожидаемые значения', () => {
    expect(AllBotPolicyActions).toEqual([
      'configure',
      'create_custom',
      'publish',
      'pause',
      'resume',
      'execute',
      'archive',
    ]);
  });

  it('isBotMode работает для валидных и невалидных значений', () => {
    expect(isBotMode('draft')).toBe(true);
    expect(isBotMode('active')).toBe(true);
    expect(isBotMode('paused')).toBe(true);
    expect(isBotMode('archived')).toBe(true);
    expect(isBotMode('deleted')).toBe(false);
    expect(isBotMode(1)).toBe(false);
    expect(isBotMode(null)).toBe(false);
  });

  it('isBotPolicyAction работает для валидных и невалидных значений', () => {
    expect(isBotPolicyAction('configure')).toBe(true);
    expect(isBotPolicyAction('archive')).toBe(true);
    expect(isBotPolicyAction('nope')).toBe(false);
    expect(isBotPolicyAction(123)).toBe(false);
  });

  it('parseBotMode возвращает BotMode или бросает', () => {
    expect(parseBotMode('draft')).toBe('draft');
    expect(() => parseBotMode('nope')).toThrow(/Invalid BotMode/);
  });

  it('parseBotPolicyAction возвращает BotPolicyAction или бросает', () => {
    expect(parseBotPolicyAction('publish')).toBe('publish');
    expect(() => parseBotPolicyAction({})).toThrow(/Invalid BotPolicyAction/);
  });
});
