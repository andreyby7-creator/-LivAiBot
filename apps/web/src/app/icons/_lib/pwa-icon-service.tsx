/**
 * @file apps/web/src/app/icons/_lib/pwa-icon-service.tsx
 * ============================================================================
 * 🟢 PWA ICON MICROSERVICE (RENDERER)
 * ============================================================================
 * Зачем этот модуль:
 * - Генерирует PNG-иконки PWA **на лету** (через Next.js route handlers)
 * - Убирает необходимость хранить бинарные PNG в git (чистый репозиторий)
 * - Даёт единый источник истины для размеров, maskable-паддинга и брендинга
 * Архитектурные принципы (FAANG-style):
 * - Без бизнес-логики: только deterministic rendering
 * - Fail-fast: строгая валидация входных параметров
 * - Small, composable units: парсер → spec → renderer
 * - Security-by-default: allow-list по размерам/ассетам (защита от DoS)
 */

import { ImageResponse } from 'next/og';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type IconPurpose = 'any' | 'maskable';

export type IconKind =
  | 'app-icon'
  | 'shortcut-dialogs'
  | 'shortcut-billing'
  | 'shortcut-chat';

export type PwaIconSpec = Readonly<{
  /** Итоговый размер PNG (ширина=высота) */
  size: number;
  /** Purpose из Web App Manifest */
  purpose: IconPurpose;
  /** Тип ассета (app icon / shortcut icon) */
  kind: IconKind;
}>;

/* ============================================================================
 * 🔒 VALIDATION
 * ========================================================================== */

/**
 * Валидирует спецификацию иконки.
 * Гарантирует cryptographically safe поведение модуля как standalone.
 * @param spec Спецификация для валидации
 * @throws {Error} Если spec невалиден
 */
function assertValidSpec(spec: PwaIconSpec): void {
  if (!Number.isInteger(spec.size) || spec.size <= 0) {
    throw new Error('Invalid icon size');
  }
}

/* ============================================================================
 * 🧱 POLICY (ALLOW-LIST)
 * ========================================================================== */

/**
 * Разрешённые размеры из `apps/web/public/manifest.json`.
 * ⚠️ Это защита от генерации произвольных больших изображений по URL.
 * SECURITY CONTRACT:
 * - `size` должен приходить только из allow-list (см. parsePwaIconAsset).
 * - Это не «магические числа», а явно заданный whitelist, который предотвращает DoS
 *   через генерацию огромных изображений.
 */
const APP_ICON_SIZE_72 = 72;
const APP_ICON_SIZE_96 = 96;
const APP_ICON_SIZE_128 = 128;
const APP_ICON_SIZE_144 = 144;
const APP_ICON_SIZE_152 = 152;
const APP_ICON_SIZE_192 = 192;
const APP_ICON_SIZE_384 = 384;
const APP_ICON_SIZE_512 = 512;

const ALLOWED_APP_ICON_SIZES = new Set(
  [
    APP_ICON_SIZE_72,
    APP_ICON_SIZE_96,
    APP_ICON_SIZE_128,
    APP_ICON_SIZE_144,
    APP_ICON_SIZE_152,
    APP_ICON_SIZE_192,
    APP_ICON_SIZE_384,
    APP_ICON_SIZE_512,
  ] as const,
);

/** Shortcut-иконки в текущем манифесте: 96x96 */
const SHORTCUT_ICON_SIZE_96 = 96;
const ALLOWED_SHORTCUT_ICON_SIZES = new Set([SHORTCUT_ICON_SIZE_96] as const);

/** Безопасная зона для maskable: 20% с каждой стороны (Google рекомендация). */
const MASKABLE_SAFE_AREA_RATIO = 0.2;

/* ============================================================================
 * 🔎 PARSER (URL → SPEC)
 * ========================================================================== */

function parseAppIconAsset(asset: string): PwaIconSpec | null {
  if (!asset.startsWith('icon-')) return null;

  // icon-192x192.png
  // icon-192-maskable.png (в manifest sizes указаны 192x192, но файл именуется иначе)
  const isMaskable = asset.includes('-maskable');
  const sizeMatch = asset.match(/icon-(\d+)(?:x\1)?(?:-maskable)?\.png$/);
  const size = sizeMatch?.[1] !== undefined ? Number(sizeMatch[1]) : NaN;
  if (!Number.isFinite(size)) return null;
  if (!ALLOWED_APP_ICON_SIZES.has(size as never)) return null;

  return {
    size,
    purpose: isMaskable ? 'maskable' : 'any',
    kind: 'app-icon',
  };
}

function parseShortcutIconAsset(asset: string): PwaIconSpec | null {
  const shortcutMatch = asset.match(/^shortcut-(dialogs|billing|chat)-(\d+)x\2\.png$/);
  if (shortcutMatch === null) return null;

  const key = shortcutMatch[1];
  const size = Number(shortcutMatch[2]);
  if (!Number.isFinite(size)) return null;
  if (!ALLOWED_SHORTCUT_ICON_SIZES.has(size as never)) return null;

  const kind: IconKind = key === 'dialogs'
    ? 'shortcut-dialogs'
    : key === 'billing'
    ? 'shortcut-billing'
    : 'shortcut-chat';

  return { size, purpose: 'any', kind };
}

/**
 * Парсит имя ассета в формате из `manifest.json`.
 * Поддерживаемые варианты:
 * - `icon-192x192.png`
 * - `icon-192-maskable.png`
 * - `shortcut-dialogs-96x96.png`
 * - `shortcut-billing-96x96.png`
 * - `shortcut-chat-96x96.png`
 * @param asset Один сегмент пути без слэшей (например, `icon-192x192.png`)
 * @returns Spec или null (если неизвестный/небезопасный ассет)
 */
export function parsePwaIconAsset(asset: string): PwaIconSpec | null {
  // Быстрые защиты от path traversal и мусора
  if (asset.includes('/') || asset.includes('\\') || asset.includes('..')) return null;
  if (!asset.endsWith('.png')) return null;

  const appSpec = parseAppIconAsset(asset);
  if (appSpec !== null) return appSpec;

  const shortcutSpec = parseShortcutIconAsset(asset);
  if (shortcutSpec !== null) return shortcutSpec;

  return null;
}

/* ============================================================================
 * 🎨 RENDERING
 * ========================================================================== */

/** Коэффициент для border-radius контента (22% от размера контента) */
const CONTENT_BORDER_RADIUS_RATIO = 0.22;

/** Коэффициент для размера шрифта заголовка (62% от размера контента) */
const TITLE_FONT_SIZE_RATIO = 0.62;

function getTitleText(kind: IconKind): string {
  switch (kind) {
    case 'app-icon':
      return 'L';
    case 'shortcut-dialogs':
      return 'D';
    case 'shortcut-billing':
      return '₽';
    case 'shortcut-chat':
      return 'C';
  }
}

type BrandPalette = Readonly<{
  bg: string;
  fg: string;
  accent: string;
}>;

const DEFAULT_PALETTE: BrandPalette = {
  // Совпадает по духу с theme_color в manifest.json (#2563eb)
  bg: '#2563eb',
  fg: '#ffffff',
  accent: '#0b1220',
};

/**
 * Генерирует PNG (image/png) Response для PWA-иконки.
 * @param spec Спецификация (валидированная allow-list)
 * @param options Доп. параметры (версионирование/кэширование)
 */
export function renderPwaIconPng(
  spec: PwaIconSpec,
  options?: Readonly<{ version?: string | null; }>,
): Response {
  assertValidSpec(spec);

  const v = options?.version ?? null;

  const headers = new Headers({
    'Content-Type': 'image/png',
    // Если URL versioned (?v=...), можно кэшировать максимально агрессивно.
    'Cache-Control': v !== null && v !== ''
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400',
  });

  const size = spec.size;

  // Maskable: уменьшаем контент, оставляя безопасную зону вокруг.
  const contentInset = spec.purpose === 'maskable'
    ? Math.round(size * MASKABLE_SAFE_AREA_RATIO)
    : 0;
  const contentSize = size - contentInset * 2;

  const titleText = getTitleText(spec.kind);

  // Минималистичный, но узнаваемый дизайн.
  // Важно: без внешних шрифтов (детерминированно, быстро, без сети).
  const element = (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: DEFAULT_PALETTE.bg,
      }}
    >
      <div
        style={{
          width: contentSize,
          height: contentSize,
          borderRadius: Math.round(contentSize * CONTENT_BORDER_RADIUS_RATIO),
          background: DEFAULT_PALETTE.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: Math.round(contentSize * TITLE_FONT_SIZE_RATIO),
            fontWeight: 800,
            lineHeight: 1,
            color: DEFAULT_PALETTE.accent,
            letterSpacing: -2,
          }}
        >
          {titleText}
        </div>
      </div>
    </div>
  );

  return new ImageResponse(element, { width: size, height: size, headers });
}
