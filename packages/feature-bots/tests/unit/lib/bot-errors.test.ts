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
  createBotErrorFromCode,
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

describe('createBotErrorFromCode', () => {
  it('создаёт BotError без context, если context не передан и options.cause не задан', () => {
    const err = createBotErrorFromCode('BOT_POLICY_ACTION_DENIED');
    expect(err.category).toBe(botErrorMetaByCode.BOT_POLICY_ACTION_DENIED.category);
    expect(err.code).toBe('BOT_POLICY_ACTION_DENIED');
    expect(err.severity).toBe(botErrorMetaByCode.BOT_POLICY_ACTION_DENIED.severity);
    expect(err.retryable).toBe(getBotRetryable('BOT_POLICY_ACTION_DENIED'));
    expect('context' in err).toBe(false);
    expect(Object.isFrozen(err)).toBe(true);
  });

  it('options.cause может быть явно undefined: context не меняется (safeCause undefined)', () => {
    const context: BotErrorContext = { field: 'name', value: 'x' };
    const err = createBotErrorFromCode(
      'BOT_POLICY_ACTION_DENIED',
      context,
      { cause: undefined } as any,
    );
    expect(err.context).toBe(context);
    expect(Object.isFrozen(err.context!)).toBe(false); // входной context не замораживается на уровне createBotErrorFromCode
  });

  it('options.cause: null → в details.cause ставится null', () => {
    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: null } as any,
    );
    expect(Object.isFrozen(err.context)).toBe(true);
    expect(Object.isFrozen(err.context!.details)).toBe(true);
    expect((err.context!.details as any).cause).toBe(null);
  });

  it('cause: Error-like объект (name string) → безопасная строка details.cause', () => {
    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: { name: 'MyErr', message: 'boom' } } as any,
    );
    expect((err.context!.details as any).cause).toBe('[MyErr] boom');
  });

  it('cause: Error (нативный) → безопасная строка details.cause', () => {
    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: new Error('boom') } as any,
    );
    expect((err.context!.details as any).cause).toBe('[Error] boom');
  });

  it('cause: Error-like объект (name undefined) → использует "Error"', () => {
    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: { message: 'boom' } } as any,
    );
    expect((err.context!.details as any).cause).toBe('[Error] boom');
  });

  it('cause: string / number / boolean сохраняются как есть', () => {
    const e1 = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: 's1' } as any,
    );
    const e2 = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: 123 } as any,
    );
    const e3 = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: true } as any,
    );

    expect((e1.context!.details as any).cause).toBe('s1');
    expect((e2.context!.details as any).cause).toBe(123);
    expect((e3.context!.details as any).cause).toBe(true);
  });

  it('cause: object / array / circular reference → превращаются в строку и не бросают', () => {
    const obj = Object.freeze({ a: 1 });
    const arr = Object.freeze([1, 2, 3]);
    const circular: any = (() => {
      const o: any = { a: 1 };
      Object.defineProperty(o, 'self', { value: o, enumerable: true });
      return o;
    })();

    const eObj = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: obj } as any,
    );
    const eArr = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: arr } as any,
    );
    const eCirc = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: circular } as any,
    );

    expect(typeof (eObj.context!.details as any).cause).toBe('string');
    expect((eArr.context!.details as any).cause).toBe('1,2,3');
    expect(typeof (eCirc.context!.details as any).cause).toBe('string');
  });

  it('cause: объект с toString, который кидает, → возвращает "[UnserializableCause]"', () => {
    const bad = {
      toString: () => {
        throw new Error('x');
      },
    };
    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: bad } as any,
    );
    expect((err.context!.details as any).cause).toBe('[UnserializableCause]');
  });

  it('mergedContext: context+cause merge (details перезаписывается cause и сохраняет остальные поля)', () => {
    const context: BotErrorContext = {
      field: 'name',
      value: 'x',
      details: { before: 'y' } as any,
    };

    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      context,
      { cause: 'after' } as any,
    );

    expect(Object.isFrozen(err.context)).toBe(true);
    expect(Object.isFrozen(err.context!.details)).toBe(true);
    expect(err.context!.field).toBe('name');
    expect(err.context!.value).toBe('x');
    expect((err.context!.details as any).before).toBe('y');
    expect((err.context!.details as any).cause).toBe('after');
  });

  it('mergedContext: context+cause merge (когда у context нет details) → details.cause берётся из safeCause', () => {
    const context: BotErrorContext = {
      field: 'name',
      value: 'x',
    };

    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      context,
      { cause: 'after' } as any,
    );

    expect(Object.isFrozen(err.context)).toBe(true);
    expect(Object.isFrozen(err.context!.details)).toBe(true);
    expect((err.context!.details as any).cause).toBe('after');
  });

  it('isErrorLike: выполняет ветку "value не объект" (пример: Symbol)', () => {
    const s = Symbol('x');
    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause: s } as any,
    );
    expect((err.context!.details as any).cause).toBe('Symbol(x)');
  });

  it('safeSerializeCauseForDetails: покрывает v.message ?? "" (message становится nullish на втором чтении)', () => {
    const state = { step: 0 };
    const cause = {
      name: 'MyErr',
      // eslint-disable-next-line fp/no-get-set -- в тесте нужен геттер, чтобы имитировать 2 чтения message
      get message() {
        // eslint-disable-next-line fp/no-mutation
        state.step += 1;
        return state.step === 1 ? 'boom' : undefined;
      },
    };

    const err = createBotErrorFromCode(
      'BOT_CHANNEL_CONNECTION_FAILED',
      undefined,
      { cause } as any,
    );

    // Первое чтение проходит isErrorLike (typeof message === "string"),
    // второе чтение в шаблоне делает message nullish → берётся "".
    expect((err.context!.details as any).cause).toBe('[MyErr] ');
  });
});

describe('createBotErrorResponse: statusCode override mismatch edge-cases', () => {
  it('в production не вызывает hook и использует requested statusCode, если у кода нет canonical statusCode', () => {
    try {
      vi.stubEnv('NODE_ENV', 'production');

      const onMismatch = vi.fn();
      const res = createBotErrorResponse({
        code: 'BOT_CHANNEL_CONNECTION_FAILED',
        statusCode: 503,
        onStatusCodeOverrideMismatch: onMismatch,
      });

      expect(onMismatch).toHaveBeenCalledTimes(0);
      expect(res.statusCode).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
