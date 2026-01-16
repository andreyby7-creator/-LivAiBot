/**
 * @file Unit тесты для интеграции Zod с Effect (utils/effect).
 */

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { zodParseEffect } from '../../../../src/validation/zod/utils/effect.js';

describe('zodParseEffect', () => {
  it('возвращает результат при валидном input', () => {
    const schema = z.object({ name: z.string().min(1) });
    const out = Effect.runSync(zodParseEffect(schema, { name: 'ok' }));
    expect(out).toEqual({ name: 'ok' });
  });

  it('при невалидном input возвращает ошибку ZodParseError', () => {
    const schema = z.object({ name: z.string().min(1, 'name.required') });
    const res = Effect.runSync(
      Effect.match(zodParseEffect(schema, { name: '' }), {
        onFailure: (e) => ({ _tag: 'err' as const, e }),
        onSuccess: (v) => ({ _tag: 'ok' as const, v }),
      }),
    );

    expect(res._tag).toBe('err');
    if (res._tag === 'err') {
      expect(res.e._tag).toBe('ZodParseError');
      expect(res.e.zodError).toBeDefined();
      expect(res.e.zodError?.issues[0]?.message).toBe('name.required');
    }
  });
});
