/**
 * @file Интеграция Zod-валидации с Effect (side effects / pipeline).
 *
 * Идея: Zod остаётся runtime guard, а побочные эффекты/оркестрация — в Effect.
 * Этот файл даёт минимальные примитивы: завернуть `.parse()` в Effect и получить типизированную ошибку.
 */

import { Data, Effect } from 'effect';
import { ZodError } from 'zod';
import type { z } from 'zod';

const zodParseError = Data.TaggedError('ZodParseError')<{
  /** Оригинальная ошибка (Zod или другая). */
  readonly cause: unknown;
  /** Источник ошибки: валидация Zod или неожиданный runtime. */
  readonly source: 'zod' | 'unknown';
  /** Если ошибка от Zod — доступна для UI/логики. */
  readonly zodError?: ZodError;
}>;

export type ZodParseError = InstanceType<typeof zodParseError>;

export function zodParseEffect<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): Effect.Effect<z.infer<TSchema>, ZodParseError> {
  return Effect.try({
    try: () => schema.parse(input),
    catch: (cause) => {
      if (cause instanceof ZodError) {
        // С `exactOptionalPropertyTypes` важно не проставлять `undefined` в optional поле.
        return new zodParseError({ cause, source: 'zod', zodError: cause });
      }
      return new zodParseError({ cause, source: 'unknown' });
    },
  });
}
