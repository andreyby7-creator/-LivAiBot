/**
 * @file @livai/core-contracts/validation/zod/utils/effect.ts
 * ============================================================================
 * ⚡ EFFECT — ZOD VALIDATION INTEGRATION WITH EFFECT
 * ============================================================================
 *
 * Foundation-интеграция Zod-валидации с Effect (side effects / pipeline).
 * Заметка по архитектуре:
 * - Zod остаётся runtime guard, а побочные эффекты/оркестрация — в Effect.
 * - Минимальные примитивы: завернуть `.parse()` в Effect и получить типизированную ошибку.
 * - ZodParseError различает Zod-ошибки и runtime-ошибки для корректной обработки.
 */
import { Data, Effect } from 'effect';
import type { z } from 'zod';
import { ZodError } from 'zod';

/* ============================================================================
 * ❌ ZOD PARSE ERROR — TYPED VALIDATION ERROR
 * ========================================================================== */

const zodParseError = Data.TaggedError('ZodParseError')<{
  /** Оригинальная ошибка (Zod или другая). */
  readonly cause: unknown;
  /** Источник ошибки: валидация Zod или неожиданный runtime. */
  readonly source: 'zod' | 'unknown';
  /** Если ошибка от Zod — доступна для UI/логики. */
  readonly zodError?: ZodError;
}>;

export type ZodParseError = InstanceType<typeof zodParseError>;

/* ============================================================================
 * ⚡ ZOD PARSE EFFECT — VALIDATION IN EFFECT CONTEXT
 * ========================================================================== */

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
