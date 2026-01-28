import { afterEach, describe, expect, it } from 'vitest';

function createRequest(url: string): { nextUrl: URL; } {
  return { nextUrl: new URL(url) };
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('apps/web/src/app/robots.txt/route.ts', () => {
  it('exports runtime=edge and revalidate=false', async () => {
    const mod = await import('../../../src/app/robots.txt/route');
    expect(mod.runtime).toBe('edge');
    expect(mod.revalidate).toBe(false);
  });

  it('GET: when NEXT_PUBLIC_APP_ENV is missing, it must behave fail-safe as non-prod (covers ?? null branch)', async () => {
    Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_APP_ENV');

    const { GET } = await import('../../../src/app/robots.txt/route');

    const res = GET(createRequest('https://example.com/robots.txt') as unknown as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('Disallow: /');
  });

  it('GET: non-prod (development) must disallow all and be no-store', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'development';

    const { GET } = await import('../../../src/app/robots.txt/route');

    const res = GET(createRequest('https://example.com/robots.txt') as unknown as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
  });

  it('GET: non-prod (staging) must disallow all and be no-store', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'staging';

    const { GET } = await import('../../../src/app/robots.txt/route');

    const res = GET(createRequest('https://staging.example.com/robots.txt') as unknown as never);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
  });

  it('GET: prod must allow root, disallow private/tech paths, include sitemap, and be cacheable', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'production';

    const { GET } = await import('../../../src/app/robots.txt/route');

    const res = GET(createRequest('https://example.com/robots.txt') as unknown as never);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(res.headers.get('X-Robots-Tag')).toBeNull();

    const body = await res.text();
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /_next/');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /dashboard');
    expect(body).toContain('Disallow: /*/dashboard');
    expect(body).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('GET: unknown app env should behave fail-safe as non-prod', async () => {
    process.env['NEXT_PUBLIC_APP_ENV'] = 'whatever';

    const { GET } = await import('../../../src/app/robots.txt/route');

    const res = GET(createRequest('https://example.com/robots.txt') as unknown as never);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('Disallow: /');
  });
});
