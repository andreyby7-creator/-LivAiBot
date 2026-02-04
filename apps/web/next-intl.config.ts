/**
 * @file Next-intl configuration for App Router
 *
 * Этот файл необходим для работы next-intl в App Router режиме.
 * Он должен находиться в корне приложения (рядом с next.config.mjs).
 */

import { notFound } from 'next/navigation';

export const locales = ['en', 'ru'] as const;
export const defaultLocale = 'en';

export default function getRequestConfig({ locale }: { readonly locale: string; }): {
  locale: string;
  messages: () => Promise<Record<string, unknown>>;
} {
  // Валидация locale
  if (!locales.includes(locale as typeof locales[number])) {
    notFound();
  }

  return {
    locale,
    messages: async (): Promise<Record<string, unknown>> => {
      try {
        const messages = await import(`./messages/${locale}.json`);
        return messages.default ?? messages;
      } catch {
        // Возвращаем пустой объект как fallback
        return {};
      }
    },
  };
}
