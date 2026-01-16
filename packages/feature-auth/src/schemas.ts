/**
 * @file Zod-схемы и типы для auth фичи (UI формы).
 *
 * Важно:
 * - источник истины: `@livai/core-contracts/validation/zod` (generated схемы из OpenAPI)
 * - для UI делаем stricter-режим (не принимаем лишние поля)
 */
import { generatedAuth } from '@livai/core-contracts/validation/zod';
import type { z } from 'zod';

// eslint-disable-next-line functional/prefer-immutable-types -- Zod schema — runtime объект, типовая иммутабельность здесь неприменима.
export const loginSchema = generatedAuth.LoginRequestSchema.strict();
export type LoginValues = z.infer<typeof loginSchema>;

// eslint-disable-next-line functional/prefer-immutable-types -- Zod schema — runtime объект, типовая иммутабельность здесь неприменима.
export const registerSchema = generatedAuth.RegisterRequestSchema.strict();
export type RegisterValues = z.infer<typeof registerSchema>;
