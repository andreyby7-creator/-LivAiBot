/**
 * @file Next-intl configuration for App Router
 *
 * Этот файл необходим для работы next-intl в App Router режиме.
 * Он должен находиться в корне приложения (рядом с next.config.mjs).
 */

import { defaultLocale, locales } from './i18n/routing.js';

export default {
  locales,
  defaultLocale,

  // Пути к файлам переводов
  messages: {
    en: () => import('./messages/en.json').then((m) => m.default),
    ru: () => import('./messages/ru.json').then((m) => m.default),
  },
} as const;
