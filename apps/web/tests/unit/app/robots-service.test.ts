import { describe, expect, it } from 'vitest';

import {
  buildRobotsTxt,
  createRobotsSpec,
  normalizeAppEnv,
  renderRobotsTxtResponse,
} from '../../../src/app/robots.txt/_lib/robots-service';

describe('apps/web/src/app/robots.txt/_lib/robots-service.ts', () => {
  describe('normalizeAppEnv', () => {
    it('normalizes case/whitespace and defaults to development for unknown values', () => {
      expect(normalizeAppEnv('  PRODUCTION  ')).toBe('production');
      expect(normalizeAppEnv('  staging ')).toBe('staging');
      expect(normalizeAppEnv('')).toBe('development');
      expect(normalizeAppEnv(undefined)).toBe('development');
      expect(normalizeAppEnv(null)).toBe('development');
      expect(normalizeAppEnv('weird')).toBe('development');
    });
  });

  describe('createRobotsSpec: baseUrl normalization is secure-by-default', () => {
    it('drops sitemap when baseUrl is missing/undefined (covers early return)', () => {
      const spec = createRobotsSpec({ appEnv: 'production' });
      expect(spec.sitemap).toBeUndefined();
    });

    it('drops sitemap when baseUrl is blank after trim (covers empty-string early return)', () => {
      const spec = createRobotsSpec({ appEnv: 'production', baseUrl: '   ' });
      expect(spec.sitemap).toBeUndefined();
    });

    it('drops sitemap when baseUrl protocol is not http/https (javascript:)', () => {
      const spec = createRobotsSpec({
        appEnv: 'production',
        baseUrl: 'javascript:alert(1)',
      });

      expect(spec.sitemap).toBeUndefined();
    });

    it('drops sitemap when baseUrl protocol is not http/https (ftp:)', () => {
      const spec = createRobotsSpec({
        appEnv: 'production',
        baseUrl: 'ftp://example.com',
      });

      expect(spec.sitemap).toBeUndefined();
    });

    it('drops sitemap when baseUrl is not a valid URL (hits try/catch)', () => {
      const spec = createRobotsSpec({
        appEnv: 'production',
        baseUrl: 'not a url',
      });

      expect(spec.sitemap).toBeUndefined();
    });
  });

  describe('buildRobotsTxt: canonical output', () => {
    it('always ends with exactly one newline', () => {
      const text = buildRobotsTxt({
        rules: [{ userAgent: '*', disallow: ['/'] }],
      });

      expect(text.endsWith('\n')).toBe(true);
      expect(text.endsWith('\n\n')).toBe(false);
    });

    it('does not include Sitemap line when sitemap is an empty string', () => {
      const text = buildRobotsTxt({
        rules: [{ userAgent: '*', allow: ['/'] }],
        sitemap: '',
      });

      expect(text).not.toContain('Sitemap:');
    });

    it('supports minimal directive without allow/disallow', () => {
      const text = buildRobotsTxt({
        rules: [{ userAgent: 'Googlebot' }],
      });

      expect(text).toContain('User-agent: Googlebot');
    });
  });

  describe('renderRobotsTxtResponse: headers policy', () => {
    it('sets X-Robots-Tag: noindex for non-prod', async () => {
      const res = renderRobotsTxtResponse({ appEnv: 'staging', baseUrl: 'https://example.com' });
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
      await expect(res.text()).resolves.toContain('Disallow: /');
    });
  });
});
