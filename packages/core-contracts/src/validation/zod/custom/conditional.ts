import { z } from 'zod';

/**
 * @file Хелперы для условной валидации (feature flags и т.п.).
 *
 * Держим здесь только примитивы для композиции сгенерированных схем.
 */

export function zWhen<T extends z.ZodTypeAny>(
  enabled: boolean,
  schema: T,
): z.ZodOptional<T> | z.ZodNever {
  return enabled ? schema.optional() : z.never();
}
