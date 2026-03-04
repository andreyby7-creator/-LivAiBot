/**
 * @file apps/web/src/app/robots.txt/route.ts
 * ============================================================================
 * 🟢 SEO MICROSERVICE (HTTP ENDPOINT): /robots.txt
 * ============================================================================
 * Контракт:
 * - `GET /robots.txt` → `text/plain; charset=utf-8`
 * - Policy env-aware:
 *   - production: allow + закрыть приватные/технические пути + (опц.) sitemap
 *   - non-prod: Disallow: / (fail-safe от индексации)
 * Архитектура (thin wrapper):
 * - Вся логика (policy, кэширование, X-Robots-Tag, форматирование) живёт в `_lib/robots-service`
 * - Этот route handler только пробрасывает env/request → renderer
 * - Никакой собственной бизнес-логики, валидации или форматирования здесь нет
 * Почему route handler, а не public/robots.txt:
 * - Политика зависит от окружения и i18n маршрутов
 * - Нужна единая точка расширения (sitemap/host/будущие правила)
 * - Стиль проекта: “микросервисы” через edge handlers + _lib renderer
 */

import type { NextRequest } from 'next/server';

import { normalizeBaseUrl, renderRobotsTxtResponse } from './_lib/robots-service';

export const runtime = 'edge';

/**
 * HTTP cache policy controlled by renderRobotsTxtResponse.
 * Не используем Next.js revalidate, чтобы избежать конфликтов с Cache-Control.
 */
export const revalidate = false;

export function GET(request: NextRequest): Response {
  // Fail-safe нормализация baseUrl (на случай тестов или некорректных URL)
  const baseUrl = normalizeBaseUrl(request.nextUrl.origin) ?? null;

  return renderRobotsTxtResponse({
    appEnv: process.env['NEXT_PUBLIC_APP_ENV'] ?? null,
    baseUrl,
  });
}
