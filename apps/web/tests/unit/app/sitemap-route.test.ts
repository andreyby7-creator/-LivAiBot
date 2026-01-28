/**
 * @file Unit tests for sitemap.xml route handler.
 *
 * Покрытие:
 * - GET: production → заполненный sitemap с локалями
 * - GET: non-prod → пустой sitemap (fail-safe)
 * - Заголовки: Content-Type, Cache-Control, X-Robots-Tag
 * - Симметрия с robots.txt: приватные страницы не включены
 */

import { afterEach, describe, expect, it } from 'vitest';

import { locales } from '../../../i18n/routing';

function createRequest(url: string): { nextUrl: URL; } {
  return { nextUrl: new URL(url) };
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('apps/web/src/app/sitemap.xml/route.ts', () => {
  it('exports runtime=edge and revalidate=false', async () => {
    const mod = await import('../../../src/app/sitemap.xml/route');
    expect(mod.runtime).toBe('edge');
    expect(mod.revalidate).toBe(false);
  });

  it('GET: when NEXT_PUBLIC_APP_ENV is missing, it must behave fail-safe as non-prod (covers ?? null branch)', async () => {
    Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_APP_ENV');

    const { GET } = await import('../../../src/app/sitemap.xml/route');

    const res = GET(createRequest('https://example.com/sitemap.xml') as unknown as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  });

  it('GET: non-prod (development) must return empty sitemap and be no-store', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'development';

    const { GET } = await import('../../../src/app/sitemap.xml/route');

    const res = GET(createRequest('https://example.com/sitemap.xml') as unknown as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    // Пустой sitemap не должен содержать <url> блоки
    expect(body).not.toContain('<url>');
  });

  it('GET: non-prod (staging) must return empty sitemap and be no-store', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'staging';

    const { GET } = await import('../../../src/app/sitemap.xml/route');

    const res = GET(createRequest('https://staging.example.com/sitemap.xml') as unknown as never);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    expect(body).not.toContain('<url>');
  });

  it('GET: prod must include all locales and be cacheable', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'production';

    const { GET } = await import('../../../src/app/sitemap.xml/route');

    const res = GET(createRequest('https://example.com/sitemap.xml') as unknown as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(res.headers.get('X-Robots-Tag')).toBeNull();

    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Проверяем, что все локали включены
    for (const locale of locales) {
      expect(body).toContain(`<loc>https://example.com/${locale}/</loc>`);
    }

    // Симметрия с robots.txt: приватные страницы не должны быть включены
    expect(body).not.toContain('/dashboard');
    expect(body).not.toContain('/auth/');
    expect(body).not.toContain('/login');
    expect(body).not.toContain('/register');
    expect(body).not.toContain('/api/');
    expect(body).not.toContain('/_next/');
  });

  it('GET: unknown app env should behave fail-safe as non-prod', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'whatever';

    const { GET } = await import('../../../src/app/sitemap.xml/route');

    const res = GET(createRequest('https://example.com/sitemap.xml') as unknown as never);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    expect(body).not.toContain('<url>');
  });
});
