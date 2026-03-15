/**
 * @file @livai/core-contracts/validation/zod/custom/conditional.ts
 * ============================================================================
 * 🔀 CONDITIONAL — FEATURE FLAG & CONDITIONAL VALIDATION HELPERS
 * ============================================================================
 *
 * Foundation-хелперы для условной валидации Zod схем (feature flags, A/B тесты).
 * Заметка по архитектуре:
 * - Примитивы для композиции сгенерированных схем без изменения generated/**.
 * - zWhen позволяет делать схемы optional или never в зависимости от флага.
 * - Используется для постепенного rollout фич и условных полей форм.
 */
import { z } from 'zod';

/* ============================================================================
 * 🔀 CONDITIONAL SCHEMA — FEATURE FLAG WRAPPER
 * ========================================================================== */

export function zWhen<T extends z.ZodTypeAny>(
  enabled: boolean,
  schema: T,
): z.ZodOptional<T> | z.ZodNever {
  return enabled ? schema.optional() : z.never();
}
