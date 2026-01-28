import { describe, expect, it, vi } from 'vitest';

import type { SitemapSpec } from '../../../src/app/sitemap.xml/_lib/sitemap-service';
import {
  buildSitemapUrl,
  buildSitemapXml,
  buildUrlXmlLines,
  createNonProdSpec,
  createProdSpec,
  createSitemapSpec,
  escapeXml,
  normalizeAppEnv,
  normalizeBaseUrl,
  renderSitemapXmlResponse,
} from '../../../src/app/sitemap.xml/_lib/sitemap-service';
import { locales } from '../../../i18n/routing';

describe('sitemap-service: normalizeBaseUrl', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(normalizeBaseUrl(null)).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('   ')).toBeNull();
  });

  it('returns origin for valid http/https URLs and trims path/trailing slash', () => {
    expect(normalizeBaseUrl('http://example.com/')).toBe('http://example.com');
    expect(normalizeBaseUrl('https://example.com/path')).toBe('https://example.com');
  });

  it('rejects non-http/https protocols', () => {
    expect(normalizeBaseUrl('ftp://example.com')).toBeNull();
    expect(normalizeBaseUrl('javascript:alert(1)')).toBeNull();
  });

  it('preserves valid non-default ports and rejects invalid ones', () => {
    expect(normalizeBaseUrl('http://example.com:3000/')).toBe('http://example.com:3000');
    expect(normalizeBaseUrl('http://example.com:65535/')).toBe('http://example.com:65535');

    expect(normalizeBaseUrl('http://example.com:70000/')).toBeNull();
    expect(normalizeBaseUrl('http://example.com:0/')).toBeNull();
    expect(normalizeBaseUrl('http://example.com:-1/')).toBeNull();
    expect(normalizeBaseUrl('http://example.com:123.5/')).toBeNull();
  });

  it('returns null for invalid URL strings', () => {
    expect(normalizeBaseUrl('not a url')).toBeNull();
  });
});

describe('sitemap-service: normalizeAppEnv', () => {
  it('normalizes known env values with whitespace and case', () => {
    expect(normalizeAppEnv('production')).toBe('production');
    expect(normalizeAppEnv('  PRODUCTION  ')).toBe('production');
    expect(normalizeAppEnv('staging')).toBe('staging');
    expect(normalizeAppEnv(' STAGING ')).toBe('staging');
  });

  it('defaults to development for unknown/empty/null/undefined', () => {
    expect(normalizeAppEnv('development')).toBe('development');
    expect(normalizeAppEnv('')).toBe('development');
    expect(normalizeAppEnv('   ')).toBe('development');
    expect(normalizeAppEnv(null)).toBe('development');
    expect(normalizeAppEnv(undefined)).toBe('development');
    expect(normalizeAppEnv('weird')).toBe('development');
  });
});

describe('sitemap-service: escapeXml', () => {
  it('escapes &, <, >, ", and \' characters', () => {
    expect(escapeXml('&<>"\'')) //
      .toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('trims and returns empty string for whitespace-only input', () => {
    expect(escapeXml('   ')).toBe('');
    expect(escapeXml('')).toBe('');
  });
});

describe('sitemap-service: buildSitemapUrl', () => {
  const base = 'https://example.com';

  it('builds absolute URL with leading slash', () => {
    expect(buildSitemapUrl(base, '/en/')).toBe('https://example.com/en/');
  });

  it('adds leading slash when missing', () => {
    expect(buildSitemapUrl(base, 'en/')).toBe('https://example.com/en/');
  });

  it('returns null for invalid baseUrl', () => {
    expect(buildSitemapUrl('not a url', '/en/')).toBeNull();
  });
});

describe('sitemap-service: createNonProdSpec', () => {
  it('returns empty urls array', () => {
    const spec = createNonProdSpec();
    expect(spec.urls).toEqual([]);
  });
});

describe('sitemap-service: createProdSpec', () => {
  const baseUrl = 'https://example.com';

  it('includes one URL per locale with correct paths', () => {
    const spec = createProdSpec(baseUrl);

    expect(spec.urls).toHaveLength(locales.length);
    for (const locale of locales) {
      const match = spec.urls.find((u) => u.loc === `${baseUrl}/${locale}/`);
      expect(match).toBeDefined();
    }
  });

  it('sets lastmod in YYYY-MM-DD format and clamps priority within [0.0, 1.0]', () => {
    const spec = createProdSpec(baseUrl);
    const today = new Date().toISOString().slice(0, 10);

    for (const url of spec.urls) {
      expect(url.lastmod).toBe(today);
      expect(url.priority).toBe(1.0);
      expect(url.changefreq).toBe('daily');
    }
  });

  it('filters out null URLs when buildSitemapUrl returns null for invalid baseUrl', () => {
    // Прямой вызов createProdSpec с невалидным baseUrl (нарушает контракт, но покрывает ветку)
    // В реальности это не произойдет, так как normalizeBaseUrl фильтрует невалидные URL
    const invalidBaseUrl = 'not-a-valid-url';
    const spec = createProdSpec(invalidBaseUrl);
    // Все URL должны быть отфильтрованы, так как buildSitemapUrl вернет null
    expect(spec.urls).toEqual([]);
  });
});

describe('sitemap-service: createSitemapSpec', () => {
  it('returns empty sitemap for non-prod envs', () => {
    const input = { appEnv: 'development', baseUrl: 'https://example.com' } as const;
    const spec = createSitemapSpec(input);
    expect(spec.urls).toEqual([]);

    const stagingSpec = createSitemapSpec({ appEnv: 'staging', baseUrl: 'https://example.com' });
    expect(stagingSpec.urls).toEqual([]);
  });

  it('returns filled sitemap for production with valid baseUrl', () => {
    const spec = createSitemapSpec({ appEnv: 'production', baseUrl: 'https://example.com' });
    expect(spec.urls).toHaveLength(locales.length);
  });

  it('returns empty sitemap for production with invalid baseUrl and logs in dev', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true,
      enumerable: true,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spec = createSitemapSpec({ appEnv: 'production', baseUrl: 'not a url' });

    expect(spec.urls).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[SITEMAP] baseUrl is null in production mode; returning empty sitemap (fail-safe).',
    );

    warnSpy.mockRestore();
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });
});

describe('sitemap-service: buildSitemapXml', () => {
  it('renders canonical empty sitemap', () => {
    const spec: SitemapSpec = { urls: [] };
    const xml = buildSitemapXml(spec);

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>',
    );
  });

  it('renders full sitemap with escaped values', () => {
    const spec: SitemapSpec = {
      urls: [
        {
          loc: 'https://example.com/en/?q=<test>&x="1"',
          lastmod: '2026-01-28',
          priority: 0.8,
          changefreq: 'daily',
        },
      ],
    };

    const xml = buildSitemapXml(spec);

    expect(xml).toContain('<loc>https://example.com/en/?q=&lt;test&gt;&amp;x=&quot;1&quot;</loc>');
    expect(xml).toContain('<lastmod>2026-01-28</lastmod>');
    expect(xml).toContain('<priority>0.8</priority>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
  });

  it('logs warning in development when priority is out of range [0.0, 1.0]', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true,
      enumerable: true,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const spec: SitemapSpec = {
      urls: [
        {
          loc: 'https://example.com/test',
          priority: 1.5, // Out of range, should be clamped to 1.0
        },
      ],
    };

    const xml = buildSitemapXml(spec);

    expect(xml).toContain('<priority>1.0</priority>');
    expect(warnSpy).toHaveBeenCalledWith(
      '[SITEMAP] priority out of range; clamped to [0.0..1.0].',
    );

    warnSpy.mockRestore();
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });

  it('skips URL with empty loc after trim', () => {
    // Тестируем напрямую buildUrlXmlLines для покрытия строки 215
    const lines = buildUrlXmlLines({ loc: '   ' });
    expect(lines).toEqual([]);

    // Также через buildSitemapXml
    const spec: SitemapSpec = {
      urls: [
        {
          loc: '   ', // Empty after trim
        },
      ],
    };

    const xml = buildSitemapXml(spec);
    // Empty loc should not generate <url> block
    expect(xml).not.toContain('<url>');
    expect(xml).not.toContain('<loc>');
  });

  it('renders URL without priority when priority is undefined', () => {
    // Тестируем напрямую buildUrlXmlLines для покрытия строки 226 (priority undefined)
    const lines = buildUrlXmlLines({ loc: 'https://example.com/test' });
    expect(lines).toContain('    <loc>https://example.com/test</loc>');
    expect(lines).not.toContain('    <priority>');

    // Также через buildSitemapXml
    const spec: SitemapSpec = {
      urls: [
        {
          loc: 'https://example.com/test',
          // priority is undefined
        },
      ],
    };

    const xml = buildSitemapXml(spec);
    expect(xml).toContain('<loc>https://example.com/test</loc>');
    expect(xml).not.toContain('<priority>');
  });

  it('skips changefreq when empty or invalid', () => {
    // Тестируем напрямую buildUrlXmlLines для покрытия строки 244
    const lines1 = buildUrlXmlLines({ loc: 'https://example.com/test1', changefreq: '' });
    expect(lines1).not.toContain('    <changefreq>');

    const lines2 = buildUrlXmlLines({ loc: 'https://example.com/test2', changefreq: 'invalid' });
    expect(lines2).not.toContain('    <changefreq>');

    const lines3 = buildUrlXmlLines({ loc: 'https://example.com/test3', changefreq: '   ' });
    expect(lines3).not.toContain('    <changefreq>');

    // Также через buildSitemapXml
    const spec: SitemapSpec = {
      urls: [
        {
          loc: 'https://example.com/test1',
          changefreq: '', // Empty
        },
        {
          loc: 'https://example.com/test2',
          changefreq: 'invalid', // Not in valid list
        },
        {
          loc: 'https://example.com/test3',
          changefreq: '   ', // Empty after trim
        },
      ],
    };

    const xml = buildSitemapXml(spec);
    expect(xml).toContain('<loc>https://example.com/test1</loc>');
    expect(xml).toContain('<loc>https://example.com/test2</loc>');
    expect(xml).toContain('<loc>https://example.com/test3</loc>');
    expect(xml).not.toContain('<changefreq>');
  });
});

describe('sitemap-service: renderSitemapXmlResponse', () => {
  it('returns 200 with correct headers and empty sitemap for non-prod', async () => {
    const res = renderSitemapXmlResponse({
      appEnv: 'staging',
      baseUrl: 'https://example.com',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  });

  it('returns 200 with correct headers and populated sitemap for production', async () => {
    const res = renderSitemapXmlResponse({
      appEnv: 'production',
      baseUrl: 'https://example.com',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(res.headers.get('X-Robots-Tag')).toBeNull();

    const body = await res.text();
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    for (const locale of locales) {
      expect(body).toContain(`<loc>https://example.com/${locale}/</loc>`);
    }
  });
});
