/**
 * @file apps/web/src/app/robots.txt/_lib/robots-service.ts
 * ============================================================================
 * 🟢 SEO MICROSERVICE: ROBOTS.TXT (POLICY + RENDERER)
 * ============================================================================
 *
 * Цели:
 * - Единый источник истины для robots policy
 * - Безопасное поведение по умолчанию (fail-safe): в non-prod запрещаем индексацию
 * - Минимум зависимостей (edge-friendly): только deterministic string rendering
 *
 * Архитектурные принципы (FAANG-style):
 * - Small composable units: нормализация → policy → renderer → Response
 * - Security-by-default: non-prod = Disallow: /
 * - Никакой бизнес-логики: только SEO policy и форматирование
 */

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type AppEnv = 'development' | 'staging' | 'production';

export type RobotsDirective = Readonly<{
  /** Например: "*" */
  userAgent: string;
  /** Allow paths (robots pattern) */
  allow?: readonly string[];
  /** Disallow paths (robots pattern) */
  disallow?: readonly string[];
}>;

export type RobotsSpec = Readonly<{
  /** Набор правил (секций) robots.txt */
  rules: readonly RobotsDirective[];
  /** Абсолютный URL sitemap (опционально) */
  sitemap?: string;
}>;

export type RobotsServiceInput = Readonly<{
  /**
   * Окружение деплоя (ожидается NEXT_PUBLIC_APP_ENV).
   * Если не задано/невалидно — считаем non-prod по умолчанию (fail-safe).
   */
  appEnv?: string | null;
  /**
   * Базовый URL (origin) текущего запроса, например "https://example.com".
   * Нужен для формирования абсолютного URL sitemap.
   */
  baseUrl?: string | null;
}>;

/* ============================================================================
 * 🧼 NORMALIZATION
 * ========================================================================== */

/**
 * Нормализует базовый URL для использования в robots.txt (sitemap).
 * Security-hardened: принимает только http/https протоколы, возвращает только origin.
 *
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

/* ============================================================================
 * 🧱 POLICY
 * ========================================================================== */

function createNonProdSpec(): RobotsSpec {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: ['/'],
      },
    ],
  };
}

function createProdSpec(baseUrl: string | null): RobotsSpec {
  const sitemap = baseUrl !== null ? `${baseUrl}/sitemap.xml` : null;

  const PRIVATE_PATHS = [
    // Технические/внутренние пути
    '/api/',
    '/_next/',
    // Приватные разделы приложения
    '/dashboard',
    '/dashboard/',
    '/settings',
    '/settings/',
    // i18n-версии приватных разделов
    '/*/dashboard',
    '/*/dashboard/',
    '/*/settings',
    '/*/settings/',
    // Auth страницы не должны попадать в индекс (качество выдачи + безопасность)
    '/auth/',
    '/*/auth/',
    '/login',
    '/register',
  ] as const;

  /**
   * Примечание по паттернам:
   * - `*` и `$` поддерживаются основными поисковиками (Google/Bing/Yandex),
   *   и нам нужны для i18n-роутов вида `/ru/dashboard`.
   */
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: PRIVATE_PATHS,
      },
    ],
    ...(sitemap !== null ? { sitemap } : {}),
  };
}

/**
 * Создает RobotsSpec по входным параметрам окружения/запроса.
 *
 * Контракт:
 * - production → разрешаем индексирование, но закрываем технические/приватные пути
 * - development/staging → запрещаем индексацию целиком (fail-safe)
 */
export function createRobotsSpec(input: RobotsServiceInput): RobotsSpec {
  const env = normalizeAppEnv(input.appEnv);
  const baseUrl = normalizeBaseUrl(input.baseUrl);

  return env === 'production' ? createProdSpec(baseUrl) : createNonProdSpec();
}

/* ============================================================================
 * 🧾 RENDERING
 * ========================================================================== */

/**
 * Формирует robots.txt по RFC-like правилам форматирования.
 * Гарантируем завершающий перевод строки, чтобы избежать edge-case у ботов.
 */
export function buildRobotsTxt(spec: RobotsSpec): string {
  const lines = spec.rules.flatMap((rule) => {
    const header = [`User-agent: ${rule.userAgent}`];
    const allow = (rule.allow ?? []).map((p) => `Allow: ${p}`);
    const disallow = (rule.disallow ?? []).map((p) => `Disallow: ${p}`);
    return [...header, ...allow, ...disallow, ''];
  });

  const withSitemap = spec.sitemap !== undefined && spec.sitemap !== ''
    ? [...lines, `Sitemap: ${spec.sitemap}`, '']
    : lines;

  // Канонический вывод: ровно один '\n' в конце, без "плавающих" пустых строк.
  const normalized = `${withSitemap.join('\n')}`.trimEnd();
  return `${normalized}\n`;
}

/**
 * Генерирует HTTP Response для `/robots.txt`.
 *
 * Cache policy:
 * - production: можно кэшировать (policy меняется редко)
 * - non-prod: no-store, чтобы случайно не закэшировать запрет/разрешение при переключениях окружения
 */
export function renderRobotsTxtResponse(input: RobotsServiceInput): Response {
  const env = normalizeAppEnv(input.appEnv);
  const spec = createRobotsSpec(input);
  const body = buildRobotsTxt(spec);

  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': env === 'production' ? 'public, max-age=3600' : 'no-store',
    ...(env !== 'production' ? { 'X-Robots-Tag': 'noindex' } : {}),
  });

  return new Response(body, { status: 200, headers });
}
