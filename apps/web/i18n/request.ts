/**
 * @file next-intl request config для App Router.
 *
 * Загружает переводы асинхронно из JSON файлов в messages/.
 * Next.js автоматически кэширует импортированные модули.
 */

import type { AbstractIntlMessages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, locales } from './routing.js';
import type { Locale } from './routing.js';

/**
 * Type guard для проверки поддерживаемой локали
 */
const isSupportedLocale = (l: string): l is Locale => locales.includes(l as Locale);

export default getRequestConfig(async ({ locale }) => {
  // Нормализуем локаль: используем переданную если она поддерживается, иначе fallback
  const normalized: Locale = locale !== undefined && isSupportedLocale(locale)
    ? locale
    : defaultLocale;

  // Загружаем сообщения для данной локали
  const messages = (await import(`../messages/${normalized}.json`)).default as AbstractIntlMessages;

  return {
    locale: normalized,
    messages,
  };
});
