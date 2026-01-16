import { z } from 'zod';

/**
 * @file Ручные схемы для форм (frontend).
 *
 * Важно:
 * - не редактируйте `generated/**` вручную
 * - расширяйте автогенерированные схемы через `.extend()` / `.refine()`
 */

export const acceptTermsSchema = z
  .boolean()
  .refine((val) => val, { message: 'form.acceptTerms.required' });
