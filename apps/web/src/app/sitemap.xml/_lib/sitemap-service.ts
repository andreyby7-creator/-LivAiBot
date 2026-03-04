/**
 * @file apps/web/src/app/sitemap.xml/_lib/sitemap-service.ts
 * ============================================================================
 * 🟢 SEO MICROSERVICE: SITEMAP.XML (POLICY + RENDERER)
 * ============================================================================
 * Цели:
 * - Единый источник истины для sitemap policy
 * - Безопасное поведение по умолчанию (fail-safe): в non-prod возвращаем пустой sitemap
 * - Минимум зависимостей (edge-friendly): только deterministic XML rendering
 * Архитектурные принципы (FAANG-style):
 * - Small composable units: нормализация → policy → renderer → Response
 * - Security-by-default: non-prod = пустой sitemap (или можно вернуть 404)
 * - Никакой бизнес-логики: только SEO policy и XML форматирование
 * - XML escaping для защиты от XSS/инъекций
 */

import { locales } from '../../../../i18n/routing';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type AppEnv = 'development' | 'staging' | 'production';

export type SitemapUrl = Readonly<{
  /** Абсолютный URL страницы */
  loc: string;
  /** Дата последнего изменения (ISO 8601, опционально) */
  lastmod?: string;
  /** Приоритет (0.0-1.0, опционально) */
  priority?: number;
  /** Частота обновления (always/hourly/daily/weekly/monthly/yearly/never, опционально) */
  changefreq?: string;
}>;

export type SitemapSpec = Readonly<{
  /** Набор URL для включения в sitemap */
  urls: readonly SitemapUrl[];
}>;

export type SitemapServiceInput = Readonly<{
  /**
   * Окружение деплоя (ожидается NEXT_PUBLIC_APP_ENV).
   * Если не задано/невалидно — считаем non-prod по умолчанию (fail-safe).
   */
  appEnv?: string | null;
  /**
   * Базовый URL (origin) текущего запроса, например "https://example.com".
   * Нужен для формирования абсолютных URL страниц.
   */
  baseUrl?: string | null;
}>;

/* ============================================================================
 * 🧼 NORMALIZATION
 * ========================================================================== */

/** Максимальный валидный TCP/UDP порт (RFC 793) */
const MAX_PORT = 65535;

/**
 * Нормализует базовый URL для использования в sitemap.
 * Security-hardened: принимает только http/https протоколы, возвращает только origin.
 * @param input Произвольная строка (может быть null/undefined/пустая/невалидная)
 * @returns Нормализованный origin (например, "https://example.com") или null
 */
export function normalizeBaseUrl(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;

  const trimmed = input.trim();
  if (trimmed === '') return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // Строгая проверка порта (валидность диапазона). Не запрещаем нестандартные порты,
    // но гарантируем корректность и детерминированность origin.
    if (url.port !== '') {
      const port = Number(url.port);
      if (!Number.isInteger(port) || port <= 0 || port > MAX_PORT) return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Приводит произвольное значение env к нашему allow-list.
 * Fail-safe: всё неизвестное → non-prod (development).
 */
export function normalizeAppEnv(input: string | null | undefined): AppEnv {
  const v = (input ?? '').trim().toLowerCase();
  if (v === 'production') return 'production';
  if (v === 'staging') return 'staging';
  return 'development';
}

/**
 * Экранирует XML-специальные символы для безопасного включения в XML.
 * Защита от XSS/инъекций через URL или другие поля.
 * @param text Текст для экранирования
 * @returns Экранированный текст
 */
export function escapeXml(text: string): string {
  const trimmed = text.trim();
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Валидирует и нормализует URL для sitemap.
 * Гарантирует, что URL абсолютный и безопасный.
 * @param baseUrl Базовый origin (например, "https://example.com")
 * @param path Путь (например, "/en/" или "/ru/dashboard")
 * @returns Абсолютный URL или null (если невалидный)
 */
export function buildSitemapUrl(baseUrl: string, path: string): string | null {
  try {
    // Убеждаемся, что path начинается с /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // baseUrl уже нормализован через normalizeBaseUrl → origin.
    // Используем конструктор URL(base, relative) чтобы избежать ручной конкатенации.
    return new URL(normalizedPath, baseUrl).href;
  } catch {
    return null;
  }
}

/* ============================================================================
 * 🧱 POLICY
 * ========================================================================== */

/**
 * Создаёт пустой sitemap для non-prod окружений (fail-safe).
 */
export function createNonProdSpec(): SitemapSpec {
  return { urls: [] };
}

/**
 * Создаёт sitemap для production окружения.
 * Включает только публичные страницы (соответствует robots.txt policy).
 * @param baseUrl Базовый URL (origin)
 */
export function createProdSpec(baseUrl: string): SitemapSpec {
  // Главная страница для каждой локали
  // Примечание: auth и dashboard страницы не включаем (они в robots.txt disallow)
  const urls = locales
    .map((locale) => {
      const url = buildSitemapUrl(baseUrl, `/${locale}/`);
      if (url === null) return null;

      return {
        loc: url,
        // YYYY-MM-DD формат. `.slice(0, 10)` гарантирует string (без `undefined`),
        // что критично при `exactOptionalPropertyTypes`.
        lastmod: new Date().toISOString().slice(0, 10),
        priority: 1.0, // Главная страница — максимальный приоритет
        changefreq: 'daily',
      } as SitemapUrl;
    })
    .filter((url): url is SitemapUrl => url !== null);

  return { urls };
}

/**
 * Создаёт SitemapSpec по входным параметрам окружения/запроса.
 * Контракт:
 * - production → генерируем sitemap с публичными страницами
 * - development/staging → возвращаем пустой sitemap (fail-safe)
 */
export function createSitemapSpec(input: SitemapServiceInput): SitemapSpec {
  const env = normalizeAppEnv(input.appEnv);
  const baseUrl = normalizeBaseUrl(input.baseUrl);

  if (env === 'production' && baseUrl !== null) {
    return createProdSpec(baseUrl);
  }

  // Dev-only предупреждение: production без baseUrl приводит к fail-safe пустому sitemap.
  if (env === 'production' && baseUrl === null && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(
      '[SITEMAP] baseUrl is null in production mode; returning empty sitemap (fail-safe).',
    );
  }

  return createNonProdSpec();
}

/* ============================================================================
 * 🧾 RENDERING
 * ========================================================================== */

/**
 * Формирует XML-строки для одного URL в sitemap.
 * Разделение логики для снижения cognitive complexity.
 * @internal Экспортировано для тестирования покрытия всех веток.
 */
export function buildUrlXmlLines(url: SitemapUrl): readonly string[] {
  const locRaw = url.loc.trim();
  if (locRaw === '') return []; // fail-safe: не генерируем <loc></loc>

  const loc = escapeXml(locRaw);
  const baseLines: readonly string[] = ['  <url>', `    <loc>${loc}</loc>`];

  const lastmodLine = url.lastmod !== undefined && url.lastmod.trim() !== ''
    ? [`    <lastmod>${escapeXml(url.lastmod.trim())}</lastmod>`]
    : [];

  const priorityLine = url.priority !== undefined
    ? ((): readonly string[] => {
      // Ограничиваем priority диапазоном 0.0-1.0
      const normalizedPriority = Math.max(0.0, Math.min(1.0, url.priority));
      if (process.env.NODE_ENV === 'development' && normalizedPriority !== url.priority) {
        // eslint-disable-next-line no-console
        console.warn('[SITEMAP] priority out of range; clamped to [0.0..1.0].');
      }
      return [`    <priority>${normalizedPriority.toFixed(1)}</priority>`];
    })()
    : [];

  const changefreqRaw = url.changefreq;
  const changefreqLine = typeof changefreqRaw === 'string'
    ? ((): readonly string[] => {
      const validFreqs = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
      const changefreq = changefreqRaw.trim().toLowerCase();
      return changefreq !== '' && validFreqs.includes(changefreq)
        ? [`    <changefreq>${escapeXml(changefreq)}</changefreq>`]
        : [];
    })()
    : [];

  const closingLine: readonly string[] = ['  </url>'];

  return [...baseLines, ...lastmodLine, ...priorityLine, ...changefreqLine, ...closingLine];
}

/**
 * Формирует XML sitemap по стандарту sitemap.org.
 * Гарантируем валидный XML с правильным экранированием.
 */
export function buildSitemapXml(spec: SitemapSpec): string {
  const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const urlsetClose = '</urlset>';

  // Канонический пустой sitemap: самозакрывающийся urlset.
  if (spec.urls.length === 0) {
    return `${xmlDeclaration}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>`;
  }

  const urlLines = spec.urls.flatMap((url) => buildUrlXmlLines(url));
  const xmlLines = [xmlDeclaration, urlsetOpen, ...urlLines, urlsetClose];

  return xmlLines.join('\n');
}

/**
 * Генерирует HTTP Response для `/sitemap.xml`.
 * Cache policy:
 * - production: можно кэшировать (sitemap меняется редко, только при добавлении страниц)
 * - non-prod: no-store, чтобы случайно не закэшировать пустой sitemap
 */
export function renderSitemapXmlResponse(input: SitemapServiceInput): Response {
  const env = normalizeAppEnv(input.appEnv);
  const spec = createSitemapSpec(input);
  const body = buildSitemapXml(spec);

  const headers = new Headers({
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': env === 'production' ? 'public, max-age=3600' : 'no-store',
    ...(env !== 'production' ? { 'X-Robots-Tag': 'noindex' } : {}),
  });

  return new Response(body, { status: 200, headers });
}
