/**
 * @file apps/web/src/app/icons/[asset]/route.ts
 * ============================================================================
 * 🟢 PWA ICON MICROSERVICE (HTTP ENDPOINT)
 * ============================================================================
 *
 * Контракт:
 * - `GET /icons/<asset>.png` → `image/png`
 * - Разрешены только ассеты из allow-list (см. `parsePwaIconAsset`)
 * - Поддержка версионирования: `?v=...` (влияет на Cache-Control)
 *
 * Почему так:
 * - Manifest сейчас ссылается на `/icons/*.png`, но в git нет бинарных PNG.
 * - Этот route handler делает проект самодостаточным и CI-friendly.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parsePwaIconAsset, renderPwaIconPng } from '../_lib/pwa-icon-service';

export const runtime = 'edge';

/**
 * HTTP cache policy fully controlled by renderPwaIconPng.
 * Не используем Next.js revalidate, чтобы избежать конфликтов с Cache-Control заголовками.
 */
export const revalidate = false;

export function GET(
  request: NextRequest,
  { params }: { params: { asset: string; }; },
): Response {
  const asset = String(params.asset || '');
  const spec = parsePwaIconAsset(asset);

  if (spec === null) {
    return NextResponse.json(
      { error: 'unknown_icon_asset' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const v = request.nextUrl.searchParams.get('v');
  return renderPwaIconPng(spec, { version: v });
}
