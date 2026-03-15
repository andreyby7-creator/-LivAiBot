/**
 * @file @livai/core-contracts/validation/zod/custom/forms.ts
 * ============================================================================
 * 📝 FORMS — FRONTEND FORM SCHEMAS
 * ============================================================================
 *
 * Foundation-схемы для валидации форм на frontend.
 * Заметка по архитектуре:
 * - Не редактируйте `generated/**` вручную — они автогенерируются из OpenAPI.
 * - Расширяйте автогенерированные схемы через `.extend()` / `.refine()`.
 * - Используйте i18n-ключи в сообщениях ошибок для локализации.
 */
import { z } from 'zod';

/* ============================================================================
 * ✅ ACCEPT TERMS — TERMS OF SERVICE VALIDATION
 * ========================================================================== */

export const acceptTermsSchema = z
  .boolean()
  .refine((val) => val, { message: 'form.acceptTerms.required' });
