/**
 * @file Unit тесты для lib/bot-errors.ts
 * Цель: 100% покрытие файла bot-errors.ts
 */

import { describe, expect, it, vi } from 'vitest';

import type { ISODateString, TraceId } from '@livai/core-contracts';

import type { BotErrorResponse } from '../../../src/contracts/BotErrorResponse.js';
import { getBotRetryable } from '../../../src/domain/BotRetry.js';
import {
  botErrorMetaByCode,
  createBotErrorResponse,
  normalizeBotErrorResponse,
} from '../../../src/lib/bot-errors.js';
import type { BotErrorCode, BotErrorContext } from '../../../src/types/bots.js';

const asTraceId = (v: string): TraceId => v as TraceId;
const asISO = (v: string): ISODateString => v as ISODateString;

describe('botErrorMetaByCode', () => {
  it('содержит метаданные для кода и является детерминированным', () => {
    const meta = botErrorMetaByCode.BOT_POLICY_ACTION_DENIED;
    expect(meta.category).toBe('policy');
    expect(meta.severity).toBe('high');
    expect(meta.error).toBe('policy_action_denied');
    expect(meta.statusCode).toBe(403);
  });
});

describe('createBotErrorResponse', () => {
  it('создаёт response с canonical meta (error/category/severity/statusCode) и retryable из BotRetryPolicy', () => {
    const code: BotErrorCode = 'BOT_POLICY_ACTION_DENIED';
    const res = createBotErrorResponse({ code });

    const meta = botErrorMetaByCode.BOT_POLICY_ACTION_DENIED;
    expect(res.error).toBe(meta.error);
    expect(res.category).toBe(meta.category);
    expect(res.severity).toBe(meta.severity);
    expect(res.statusCode).toBe(meta.statusCode);
    expect(res.retryable).toBe(getBotRetryable(code));
    expect(Object.isFrozen(res)).toBe(true);
  });

  it('добавляет message и context, если они переданы', () => {
    const context: BotErrorContext = { field: 'name', value: 'x' };
    const res = createBotErrorResponse({
      code: 'BOT_NAME_INVALID',
      message: 'msg',
      context,
    });

    expect(res.message).toBe('msg');
    expect(res.context).toEqual(context);
  });

  it('в non-production бросает, если statusCode override конфликтует с canonical meta status', () => {
    // В vitest NODE_ENV обычно "test" (non-production), поэтому проверяем dev-guard.
    expect(() =>
      createBotErrorResponse({
        code: 'BOT_POLICY_ACTION_DENIED',
        statusCode: 200,
      })
    ).toThrow(/Invalid statusCode override/);
  });

  it('в production не бросает, вызывает onStatusCodeOverrideMismatch и возвращает canonical statusCode', () => {
    try {
      vi.stubEnv('NODE_ENV', 'production');

      const onMismatch = vi.fn();
      const res = createBotErrorResponse({
        code: 'BOT_POLICY_ACTION_DENIED',
        statusCode: 200,
        onStatusCodeOverrideMismatch: onMismatch,
      });

      expect(onMismatch).toHaveBeenCalledTimes(1);
      expect(onMismatch).toHaveBeenCalledWith({
        requested: 200,
        canonical: 403,
        code: 'BOT_POLICY_ACTION_DENIED',
      });

      // canonical всегда приоритетнее requested, если задан в meta
      expect(res.statusCode).toBe(403);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('если у кода нет canonical statusCode, использует requested statusCode', () => {
    const code: BotErrorCode = 'BOT_CHANNEL_CONNECTION_FAILED'; // meta.statusCode отсутствует
    const res = createBotErrorResponse({ code, statusCode: 503 });
    expect(res.statusCode).toBe(503);
  });

  it('если statusCode не задан ни в meta, ни в requested — поля statusCode нет', () => {
    const code: BotErrorCode = 'BOT_CHANNEL_CONNECTION_FAILED'; // meta.statusCode отсутствует
    const res = createBotErrorResponse({ code });
    expect('statusCode' in res).toBe(false);
  });
});

describe('normalizeBotErrorResponse', () => {
  it('нормализует error/category/severity/retryable по code и whitelist-ит поля', () => {
    const response = {
      error: 'unknown_error',
      code: 'BOT_POLICY_ACTION_DENIED',
      category: 'validation',
      severity: 'low',
      retryable: true,
      message: 'm',
      statusCode: 200,
      context: { field: 'name', value: 'x' },
      traceId: asTraceId('t-1'),
      timestamp: asISO('2026-01-01T00:00:00.000Z'),
      extra: 'leak',
    } as unknown as BotErrorResponse;

    const normalized = normalizeBotErrorResponse(response);
    const meta = botErrorMetaByCode.BOT_POLICY_ACTION_DENIED;

    expect(normalized.error).toBe(meta.error);
    expect(normalized.category).toBe(meta.category);
    expect(normalized.severity).toBe(meta.severity);
    expect(normalized.retryable).toBe(getBotRetryable('BOT_POLICY_ACTION_DENIED'));

    // whitelist keeps known optional fields
    expect(normalized.message).toBe('m');
    expect(normalized.statusCode).toBe(200);
    expect(normalized.traceId).toBe('t-1');
    expect(normalized.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(normalized.context).toEqual({ field: 'name', value: 'x' });

    // unknown fields must not pass through
    expect('extra' in (normalized as unknown as Record<string, unknown>)).toBe(false);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it('если response.statusCode не передан, но meta.statusCode есть — использует meta.statusCode', () => {
    const response: BotErrorResponse = {
      error: 'unknown_error',
      code: 'BOT_POLICY_ACTION_DENIED',
      category: 'validation',
      severity: 'low',
      retryable: true,
    };

    const normalized = normalizeBotErrorResponse(response);
    expect(normalized.statusCode).toBe(403);
  });

  it('если нет statusCode ни в response, ни в meta — поля statusCode нет', () => {
    const response: BotErrorResponse = {
      error: 'unknown_error',
      code: 'BOT_CHANNEL_CONNECTION_FAILED',
      category: 'validation',
      severity: 'low',
      retryable: true,
    };

    const normalized = normalizeBotErrorResponse(response);
    expect('statusCode' in normalized).toBe(false);
  });
});
