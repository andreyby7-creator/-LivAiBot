import type { z } from 'zod';

/**
 * @file Утилиты для типизации/валидации Zod схем.
 */
export type Infer<TSchema extends z.ZodTypeAny> = z.infer<TSchema>;
