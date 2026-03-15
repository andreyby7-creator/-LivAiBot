/**
 * @file Unit тесты для утилит типизации Zod схем (utils/validate).
 */

import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import type { Infer } from '../../../../src/validation/zod/utils/validate.js';

describe('Infer', () => {
  it('выводит тип из простой схемы string', () => {
    const schema = z.string();
    type Inferred = Infer<typeof schema>;
    expectTypeOf<Inferred>().toEqualTypeOf<string>();
  });

  it('выводит тип из схемы object', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email().optional(),
    });
    type Inferred = Infer<typeof schema>;
    expectTypeOf<Inferred>().toEqualTypeOf<{
      name: string;
      age: number;
      email?: string | undefined;
    }>();
  });

  it('выводит тип из схемы с трансформацией', () => {
    const schema = z.string().transform((val) => val.toUpperCase());
    type Inferred = Infer<typeof schema>;
    expectTypeOf<Inferred>().toEqualTypeOf<string>();
  });

  it('выводит тип из вложенной схемы', () => {
    const schema = z.object({
      user: z.object({
        id: z.string().uuid(),
        profile: z.object({
          name: z.string(),
          age: z.number(),
        }),
      }),
      tags: z.array(z.string()),
    });
    type Inferred = Infer<typeof schema>;
    expectTypeOf<Inferred>().toEqualTypeOf<{
      user: {
        id: string;
        profile: {
          name: string;
          age: number;
        };
      };
      tags: string[];
    }>();
  });

  it('выводит тип из схемы с union', () => {
    const schema = z.union([z.string(), z.number()]);
    type Inferred = Infer<typeof schema>;
    expectTypeOf<Inferred>().toEqualTypeOf<string | number>();
  });

  it('выводит тип из схемы с enum', () => {
    const schema = z.enum(['a', 'b', 'c']);
    type Inferred = Infer<typeof schema>;
    expectTypeOf<Inferred>().toEqualTypeOf<'a' | 'b' | 'c'>();
  });

  it('выводит тип из схемы с default значениями', () => {
    const schema = z.object({
      name: z.string().default('unknown'),
      count: z.number().default(0),
    });
    type Inferred = Infer<typeof schema>;
    // С default значения становятся обязательными
    expectTypeOf<Inferred>().toEqualTypeOf<{
      name: string;
      count: number;
    }>();
  });

  it('совместим с z.infer', () => {
    const schema = z.object({ value: z.string() });
    type InferType = Infer<typeof schema>;
    type ZodInferType = z.infer<typeof schema>;
    expectTypeOf<InferType>().toEqualTypeOf<ZodInferType>();
  });
});
