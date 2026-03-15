/**
 * @file @livai/core-contracts/validation/zod/custom/i18n.ts
 * ============================================================================
 * 🌐 I18N — INTERNATIONALIZATION FOR ZOD ERRORS
 * ============================================================================
 *
 * Foundation-хелперы для i18n-форматирования ошибок валидации Zod.
 * Заметка по архитектуре:
 * - Намеренно минимально: UI слой маппит коды/пути на локализованные сообщения.
 * - Поддерживает два режима ключей: 'message' и 'path+message' для nested форм.
 * - Форматирование работает как с ZodError, так и напрямую с issues.
 */
import type { z, ZodError } from 'zod';

/* ============================================================================
 * 🌐 I18N TYPES — TRANSLATION FUNCTION & OPTIONS
 * ========================================================================== */

export type ZodI18nT = (key: string) => string | undefined;

export interface FormattedIssue {
  /** Путь до поля (для nested форм и маппинга ошибок на UI). */
  readonly path: readonly (string | number)[];
  /** Уже локализованное сообщение (или ключ, если `t` не передали). */
  readonly message: string;
}

export type ZodIssueKeyMode = 'message' | 'path+message';

export interface FormatZodIssuesOptions {
  /**
   * Как формировать ключ для i18n:
   * - `message` (по умолчанию): используем только `issue.message`
   * - `path+message`: используем `${path}.${issue.message}` для более точного маппинга nested форм
   */
  readonly keyMode?: ZodIssueKeyMode;
}

/* ============================================================================
 * 🔧 INTERNAL HELPERS — PATH NORMALIZATION & KEY GENERATION
 * ========================================================================== */

function normalizeZodPath(path: readonly PropertyKey[]): readonly (string | number)[] {
  // В рантайме Zod обычно отдаёт string|number, но типы допускают symbol.
  // Для UI/форм удобнее иметь только string|number.
  return path.map((p) => (typeof p === 'number' ? p : String(p)));
}

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
// ZodError и z.core.$ZodIssueBase - классы из библиотеки zod
// ESLint не распознает utility types (Readonly<T>, DeepReadonly<T>) для классов из библиотек
// Все интерфейсы (FormatZodIssuesOptions, FormattedIssue) уже имеют readonly свойства

function issueToKey(issue: z.core.$ZodIssueBase, keyMode: ZodIssueKeyMode): string {
  if (keyMode !== 'path+message') return issue.message;

  const pathStr = normalizeZodPath(issue.path).map(String).join('.');
  return pathStr ? `${pathStr}.${issue.message}` : issue.message;
}

/* ============================================================================
 * 📋 FORMAT ISSUES — DIRECT ISSUES FORMATTING
 * ========================================================================== */

export function formatZodIssues(
  issues: readonly z.core.$ZodIssueBase[],
  t?: ZodI18nT,
  options?: FormatZodIssuesOptions,
): string[] {
  const keyMode: ZodIssueKeyMode = options?.keyMode ?? 'message';
  return issues.map((i) => {
    const key = issueToKey(i, keyMode);
    return t ? (t(key) ?? key) : key;
  });
}

/* ============================================================================
 * ❌ FORMAT ERROR — ZODERROR WRAPPER
 * ========================================================================== */

export function formatZodError(
  err: ZodError,
  t?: ZodI18nT,
  options?: FormatZodIssuesOptions,
): string[] {
  return formatZodIssues(err.issues, t, options);
}

/* ============================================================================
 * 📋 FORMAT ISSUES DETAILED — ISSUES WITH PATHS
 * ========================================================================== */

export function formatZodIssuesDetailed(
  issues: readonly z.core.$ZodIssueBase[],
  t?: ZodI18nT,
  options?: FormatZodIssuesOptions,
): FormattedIssue[] {
  const keyMode: ZodIssueKeyMode = options?.keyMode ?? 'message';
  return issues.map((i) => {
    const key = issueToKey(i, keyMode);
    return { path: normalizeZodPath(i.path), message: t ? (t(key) ?? key) : key };
  });
}

/* ============================================================================
 * ❌ FORMAT ERROR DETAILED — ZODERROR WITH PATHS
 * ========================================================================== */

export function formatZodErrorDetailed(
  err: ZodError,
  t?: ZodI18nT,
  options?: FormatZodIssuesOptions,
): FormattedIssue[] {
  return formatZodIssuesDetailed(err.issues, t, options);
}
/* eslint-enable @typescript-eslint/prefer-readonly-parameter-types */
