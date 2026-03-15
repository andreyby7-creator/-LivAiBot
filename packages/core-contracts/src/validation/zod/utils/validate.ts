/**
 * @file @livai/core-contracts/validation/zod/utils/validate.ts
 * ============================================================================
 * 🔍 VALIDATE — TYPE INFERENCE UTILITIES FOR ZOD SCHEMAS
 * ============================================================================
 *
 * Foundation-утилиты для типизации Zod схем.
 * Заметка по архитектуре:
 * - Infer — alias для z.infer для единообразия API.
 * - Используется для вывода типов из Zod схем в type-safe контексте.
 */
import type { z } from 'zod';

/* ============================================================================
 * 🔍 TYPE INFERENCE — SCHEMA TYPE EXTRACTION
 * ========================================================================== */

export type Infer<TSchema extends z.ZodTypeAny> = z.infer<TSchema>;
