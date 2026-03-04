/**
 * @file apps/web/src/app/icon-512.png/route.ts
 * ============================================================================
 * 🟢 PWA ICON ALIAS (512x512)
 * ============================================================================
 * Контракт:
 * - Это thin-alias (тонкая обёртка над renderer)
 * - Никакой логики, кроме проброса `version`
 * - Никакой валидации / парсинга / allow-list здесь
 * - Все cache/validation/security правила живут в `icons/_lib/pwa-icon-service`
 * Зачем:
 * - В `docs/phase2-UI.md` пункт 160 ожидает `icon-512.png`.
 * - Алиас использует общий renderer и сохраняет единый бренд-стиль.
 */

import type { NextRequest } from 'next/server';

import { renderPwaIconPng } from '../icons/_lib/pwa-icon-service';

export const runtime = 'edge';

export function GET(request: NextRequest): Response {
  const v = request.nextUrl.searchParams.get('v');
  return renderPwaIconPng({ size: 512, purpose: 'any', kind: 'app-icon' }, { version: v });
}
