/**
 * @file apps/web/src/app/sitemap.xml/route.ts
 * ============================================================================
 * 🟢 SEO MICROSERVICE (HTTP ENDPOINT): /sitemap.xml
 * ============================================================================
 *
 * Контракт:
 * - `GET /sitemap.xml` → `application/xml; charset=utf-8`
 * - Policy env-aware:
 *   - production: генерирует sitemap с публичными страницами (главная для каждой локали)
 *   - non-prod: возвращает пустой sitemap (fail-safe от индексации)
 *
 * Архитектура (thin wrapper):
 * - Вся логика (policy, кэширование, XML форматирование, валидация URL) живёт в `_lib/sitemap-service`
 * - Этот route handler только пробрасывает env/request → renderer
 * - Никакой собственной бизнес-логики, валидации или форматирования здесь нет
 *
 * Почему route handler, а не public/sitemap.xml:
 * - Sitemap зависит от окружения (production vs non-prod)
 * - Нужна поддержка i18n маршрутов (динамическая генерация для каждой локали)
 * - Единая точка расширения (будущие страницы, динамические маршруты)
 * - Стиль проекта: "микросервисы" через edge handlers + _lib renderer
 */

import type { NextRequest } from 'next/server';

import { renderSitemapXmlResponse } from './_lib/sitemap-service';

export const runtime = 'edge';

/**
 * HTTP cache policy controlled by renderSitemapXmlResponse.
 * Не используем Next.js revalidate, чтобы избежать конфликтов с Cache-Control.
 *
 * Cache policy (через сервис):
 * - production → public, max-age=3600 (sitemap меняется редко)
 * - non-prod → no-store (fail-safe от кэширования пустого sitemap)
 */
export const revalidate = false;

export function GET(request: NextRequest): Response {
  // Пробрасываем origin напрямую: renderSitemapXmlResponse делает fail-safe нормализацию внутри.
  return renderSitemapXmlResponse({
    appEnv: process.env['NEXT_PUBLIC_APP_ENV'] ?? null,
    baseUrl: request.nextUrl.origin,
  });
}
