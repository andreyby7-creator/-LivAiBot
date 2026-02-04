/**
 * @file Тесты для серверного компонента DashboardPage (page.tsx)
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('DashboardPage (Server Component)', () => {
  describe('структура кода', () => {
    it('должен импортировать DashboardClient', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import DashboardClient');
      expect(content).toContain("from './DashboardClient'");
    });

    it('должен импортировать тип Locale', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import type { Locale }');
      expect(content).toContain('}: DashboardPageProps');
    });

    it('должен содержать interface DashboardPageProps', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      expect(content).toContain('type DashboardPageProps');
      expect(content).toContain('readonly params:');
      expect(content).toContain('readonly locale: Locale');
    });

    it('должен содержать export const dynamic', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      expect(content).toContain("export const dynamic = 'force-dynamic'");
    });
  });

  describe('архитектура', () => {
    it('должен быть серверным компонентом', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      // Серверный компонент не должен содержать 'use client'
      expect(content).not.toContain("'use client'");
      // Не должен содержать React хуки (проверяем только вызовы, не импорты типов)
      expect(content).not.toContain('useState(');
      expect(content).not.toContain('useEffect(');
      expect(content).not.toContain('useTranslations(');
      // Не должен содержать JSX напрямую (только рендер клиентского компонента)
      expect(content).not.toContain('<main');
      expect(content).not.toContain('<div');
      expect(content).not.toContain('<h1');
      // Но должен содержать рендер клиентского компонента
      expect(content).toContain('<DashboardClient');
    });

    it('должен рендерить клиентский компонент', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      expect(content).toContain('return <DashboardClient locale={params.locale} />;');
    });
  });

  describe('JSDoc комментарии', () => {
    it('должен содержать @file тег', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      expect(content).toContain('@file Страница Dashboard');
    });

    it('должен содержать описание компонента', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      expect(content).toContain('Серверный компонент, который отключает prerendering');
      expect(content).toContain('рендерит клиентский компонент');
    });
  });

  describe('комментарии TODO', () => {
    it('не должен содержать TODO в серверном компоненте', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/page.tsx'),
        'utf8',
      );

      // Серверный компонент не должен содержать TODO - они в клиентском
      expect(content).not.toContain('TODO:');
    });
  });
});
