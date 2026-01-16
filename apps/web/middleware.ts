/**
 * @file Middleware для i18n роутинга (next-intl).
 *
 * Обрабатывает только страницы приложений, исключая:
 * - API routes (/api/*) - для производительности и избежания багов с headers
 * - Next.js internals (/_next/*)
 * - Статические файлы (*.*)
 */

import type { MiddlewareConfig } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { defaultLocale, locales } from './i18n/routing.js';

export default createMiddleware({
  locales,
  defaultLocale,
});

export const config: MiddlewareConfig = {
  // Исключаем API routes для производительности и избежания проблем с headers
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
