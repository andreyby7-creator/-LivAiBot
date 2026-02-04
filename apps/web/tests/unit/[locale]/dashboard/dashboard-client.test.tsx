/**
 * @file Тесты для DashboardClient (клиентский компонент)
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('DashboardClient (Client Component)', () => {
  describe('структура кода', () => {
    it('должен содержать use client директиву', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      expect(content).toContain("'use client';");
    });

    it('должен импортировать тип Locale', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      expect(content).toContain('import type { Locale }');
    });

    it('должен содержать props interface', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      expect(content).toContain('type Props');
      expect(content).toContain('locale: Locale');
    });

    it('должен экспортировать компонент по умолчанию', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      expect(content).toContain('export default function DashboardClient');
    });
  });

  describe('JSDoc комментарии', () => {
    it('должен содержать @file тег', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      expect(content).toContain('@file Клиентский компонент Dashboard');
    });

    it('должен содержать описание компонента', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      expect(content).toContain('Содержит всю логику dashboard с использованием React хуков');
      expect(content).toContain('Рендерится только на клиенте');
    });
  });

  describe('базовый рендер', () => {
    it('должен содержать базовую структуру JSX', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      expect(content).toContain('<div>');
      expect(content).toContain('<h1>Dashboard</h1>');
      expect(content).toContain('<p>Locale: {locale}</p>');
    });
  });

  describe('комментарии TODO', () => {
    it('может содержать TODO для будущей функциональности', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../src/app/[locale]/dashboard/DashboardClient.tsx'),
        'utf8',
      );

      // Пока что TODO могут быть, но не обязательно - проверяем что content прочитан
      expect(content).toBeDefined();
    });
  });
});
