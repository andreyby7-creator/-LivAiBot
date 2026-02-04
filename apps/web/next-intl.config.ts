/**
 * @file Next-intl configuration for App Router
 *
 * Этот файл необходим для работы next-intl в App Router режиме.
 * Он должен находиться в корне приложения (рядом с next.config.mjs).
 */

import { notFound } from 'next/navigation';

import enMessages from './messages/en.json';
import ruMessages from './messages/ru.json';

export const locales = ['en', 'ru'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const messagesMap = {
  en: enMessages,
  ru: ruMessages,
} as const;

export default function getRequestConfig({ locale }: { readonly locale: string; }): {
  locale: string;
  messages: Record<string, unknown>;
} {
  // Валидация locale
  if (!locales.includes(locale as typeof locales[number])) {
    notFound();
  }

  return {
    locale,
    messages: messagesMap[locale as keyof typeof messagesMap],
  };
}
