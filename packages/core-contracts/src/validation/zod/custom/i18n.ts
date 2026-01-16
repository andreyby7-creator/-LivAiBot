import type { z, ZodError } from 'zod';

/**
 * @file Хелперы для i18n-форматирования ошибок Zod.
 *
 * Намеренно минимально: UI слой может маппить коды/пути на локализованные сообщения.
 */
export type ZodI18nT = (key: string) => string | undefined;

export interface FormattedIssue {
  /** Путь до поля (для nested форм и маппинга ошибок на UI). */
  path: readonly (string | number)[];
  /** Уже локализованное сообщение (или ключ, если `t` не передали). */
  message: string;
}

export type ZodIssueKeyMode = 'message' | 'path+message';

export interface FormatZodIssuesOptions {
  /**
   * Как формировать ключ для i18n:
   * - `message` (по умолчанию): используем только `issue.message`
   * - `path+message`: используем `${path}.${issue.message}` для более точного маппинга nested форм
   */
  keyMode?: ZodIssueKeyMode;
}

function normalizeZodPath(path: readonly PropertyKey[]): readonly (string | number)[] {
  // В рантайме Zod обычно отдаёт string|number, но типы допускают symbol.
  // Для UI/форм удобнее иметь только string|number.
  return path.map((p) => (typeof p === 'number' ? p : String(p)));
}

function issueToKey(issue: z.core.$ZodIssueBase, keyMode: ZodIssueKeyMode): string {
  if (keyMode !== 'path+message') return issue.message;

  const pathStr = normalizeZodPath(issue.path).map(String).join('.');
  return pathStr ? `${pathStr}.${issue.message}` : issue.message;
}

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

export function formatZodError(
  err: ZodError,
  t?: ZodI18nT,
  options?: FormatZodIssuesOptions,
): string[] {
  return formatZodIssues(err.issues, t, options);
}

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

export function formatZodErrorDetailed(
  err: ZodError,
  t?: ZodI18nT,
  options?: FormatZodIssuesOptions,
): FormattedIssue[] {
  return formatZodIssuesDetailed(err.issues, t, options);
}
