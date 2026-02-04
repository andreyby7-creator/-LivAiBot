/**
 * @file Middleware для i18n роутинга (next-intl).
 *
 * Обрабатывает только страницы приложений, исключая:
 * - API routes (/api/*) - для производительности и избежания багов с headers
 * - Next.js internals (/_next/*)
 * - Статические файлы (*.*)
 */

import type { MiddlewareConfig, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { defaultLocale, locales } from './next-intl.config.js';

// Создаем middleware с next-intl
const i18nMiddleware = createMiddleware({
  locales,
  defaultLocale,
});

// Кастомный middleware с redirect для root
export default function middleware(request: NextRequest): NextResponse | Response {
  const { pathname } = request.nextUrl;

  // Redirect / → /en для healthcheck и UX
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
  }

  // Для остальных путей используем next-intl middleware
  return i18nMiddleware(request);
}

export const config: MiddlewareConfig = {
  // Исключаем API routes для производительности и избежания проблем с headers
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
