/**
 * @file Тесты для серверного компонента LoginPage (page.tsx)
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('LoginPage (Server Component)', () => {
  describe('структура кода', () => {
    it('должен импортировать LoginClient', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import { LoginClient }');
      expect(content).toContain("from './LoginClient'");
    });

    it('должен импортировать тип Locale', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import type { Locale }');
      expect(content).toContain('}: LoginPageProps');
    });

    it('должен содержать interface LoginPageProps', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('type LoginPageProps');
      expect(content).toContain('readonly params:');
      expect(content).toContain('readonly locale: Locale');
    });

    it('должен содержать export const dynamic', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain("export const dynamic = 'force-dynamic'");
    });
  });

  describe('архитектура', () => {
    it('должен быть серверным компонентом', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      // Серверный компонент не должен содержать 'use client'
      expect(content).not.toContain("'use client'");
      // Не должен содержать React хуки
      expect(content).not.toContain('useState');
      expect(content).not.toContain('useEffect');
      expect(content).not.toContain('useTranslations');
      // Не должен содержать JSX напрямую
      expect(content).not.toContain('<main');
      expect(content).not.toContain('<div');
    });

    it('должен рендерить клиентский компонент', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('return <LoginClient locale={locale} />;');
    });
  });

  describe('JSDoc комментарии', () => {
    it('должен содержать @file тег', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('@file Страница входа (Login)');
    });

    it('должен содержать описание компонента', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('Серверный компонент, который отключает prerendering');
      expect(content).toContain('рендерит клиентский компонент');
    });
  });

  describe('комментарии TODO', () => {
    it('не должен содержать TODO в серверном компоненте', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      // Серверный компонент не должен содержать TODO - они в клиентском
      expect(content).not.toContain('TODO:');
    });
  });
});
