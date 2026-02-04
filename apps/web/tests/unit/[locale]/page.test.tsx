/**
 * @file Тесты для HomePage
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock для next/link
vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => ({ type: 'a', props: { ...props, children } }),
}));

// Mock для next-intl
const mockUseTranslations = vi.fn();
vi.mock('next-intl', () => ({
  useTranslations: () => mockUseTranslations(),
}));

// Mock для i18n routing
vi.mock('../../../../i18n/routing.js', () => ({
  type: {},
}));

describe('HomePage', () => {
  const mockTranslations = {
    'home.title': 'LivAi',
    'home.description': 'AI-powered chatbot platform with multi-tenant architecture',
    'home.dashboard': 'Dashboard',
    'home.e2eStatus': 'E2E Test Status: ✅ Working',
    'auth.login.submit': 'Sign In',
    'auth.register.submit': 'Sign Up',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTranslations.mockImplementation((key: string) =>
      mockTranslations[key as keyof typeof mockTranslations]
    );
  });

  describe('структура кода', () => {
    it('должен импортировать Link из next/link', () => {
      // Проверяем, что Link используется в компоненте
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      expect(content).toContain("import Link from 'next/link'");
      expect(content).toContain('<Link');
    });

    it('должен импортировать тип Locale', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import type { Locale }');
      expect(content).toContain('params: Promise<{ locale: Locale; }>');
    });
  });

  describe('i18n интеграция', () => {
    it("должен использовать useTranslations с типом 'home' | 'auth'", () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      expect(content).toContain('getTranslations');
    });

    it('должен содержать все необходимые ключи переводов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      expect(content).toContain("tHome('title')");
      expect(content).toContain("tHome('description')");
      expect(content).toContain("tHome('dashboard')");
      expect(content).toContain("tAuth('login.submit')");
      expect(content).toContain("tAuth('register.submit')");
      expect(content).toContain("tHome('e2eStatus')");
    });
  });

  describe('структура JSX', () => {
    it('должен содержать правильную структуру HTML элементов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      // Проверяем наличие основных HTML элементов
      expect(content).toContain('<div className=');
      expect(content).toContain('<h1');
      expect(content).toContain('<p');
      expect(content).toContain('<Link');
      expect(content).toContain('data-testid=');
    });

    it('должен использовать Tailwind классы вместо inline стилей', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      // Проверяем, что нет inline стилей (style={...})
      expect(content).not.toContain('style={{');
      expect(content).not.toContain('style={');

      // Проверяем наличие Tailwind классов
      expect(content).toContain('className=');
      expect(content).toContain('bg-gray-50');
      expect(content).toContain('bg-blue-600');
      expect(content).toContain('bg-white');
      expect(content).toContain('bg-green-600');
    });
  });

  describe('accessibility', () => {
    it('должен содержать focus стили для интерактивных элементов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      // Проверяем наличие focus стилей
      expect(content).toContain('focus:outline-none');
      expect(content).toContain('focus:ring-2');
      expect(content).toContain('focus:ring-offset-2');
    });

    it('должен содержать data-testid атрибуты для тестирования', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      expect(content).toContain("data-testid='login-button'");
      expect(content).toContain("data-testid='register-button'");
      expect(content).toContain("data-testid='dashboard-button'");
    });
  });

  describe('type safety', () => {
    it('должен иметь правильную типизацию пропсов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../src/app/[locale]/page.tsx'),
        'utf8',
      );

      expect(content).toContain('params: Promise<{ locale: Locale; }>');
      expect(content).toContain('Promise<JSX.Element>');
    });
  });
});
