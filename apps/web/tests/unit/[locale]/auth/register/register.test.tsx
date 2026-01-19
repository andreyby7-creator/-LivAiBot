/**
 * @file Тесты для RegisterPage
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock для next/link
vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock для next-intl
const mockUseTranslations = vi.fn();
vi.mock('next-intl', () => ({
  useTranslations: () => mockUseTranslations(),
}));

// Mock для ui-features
vi.mock('@livai/ui-features', () => ({
  RegisterForm: ({ t, onSubmit }: any) => (
    <div data-testid='register-form-component'>
      <button
        onClick={() =>
          onSubmit({ email: 'test@example.com', password: 'password', workspaceName: 'test' })}
      >
        {t('auth.register.submit')}
      </button>
    </div>
  ),
}));

// Mock для i18n routing
vi.mock('../../../../../../i18n/routing.js', () => ({
  type: {},
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('RegisterPage', () => {
  const mockTranslations = {
    'register.title': 'Sign Up',
    'register.link': 'Sign In',
    'register.submit': 'Sign Up',
    'auth.register.submit': 'Sign Up',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTranslations.mockImplementation((key: string) =>
      mockTranslations[key as keyof typeof mockTranslations]
    );
  });

  describe('структура кода', () => {
    it('должен импортировать useTranslations из next-intl', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import { useTranslations }');
      expect(content).toContain("from 'next-intl'");
    });

    it('должен импортировать тип Locale', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import type { Locale }');
      expect(content).toContain('}: RegisterPageProps');
    });

    it('должен содержать type RegisterPageProps', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('type RegisterPageProps');
      expect(content).toContain('}: RegisterPageProps');
    });
  });

  describe('i18n интеграция', () => {
    it("должен использовать useTranslations с типом 'auth'", () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain("useTranslations<'auth'>");
    });

    it('должен содержать все необходимые ключи переводов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain("t('register.title')");
      expect(content).toContain("t('register.link')");
    });
  });

  describe('структура JSX', () => {
    it('должен содержать правильную структуру HTML элементов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('<main');
      expect(content).toContain('<div className=');
      expect(content).toContain('<h1');
      expect(content).not.toContain('<form');
      expect(content).toContain("role='main'");
      expect(content).toContain('aria-label=');
    });

    it('должен использовать Tailwind классы вместо inline стилей', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      // Проверяем, что нет inline стилей (style={...})
      expect(content).not.toContain('style={{');
      expect(content).not.toContain('style={');

      // Проверяем наличие Tailwind классов
      expect(content).toContain('className=');
      expect(content).toContain('min-h-screen');
      expect(content).toContain('grid place-items-center');
      expect(content).toContain('max-w-sm');
      expect(content).toContain('sm:max-w-sm');
      expect(content).toContain('bg-white');
      expect(content).toContain('text-blue-600');
    });
  });

  describe('accessibility', () => {
    it('должен содержать role="main"', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain("role='main'");
    });

    it('должен содержать aria-label для main и h1', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain("aria-label={t('register.title')}");
    });
  });

  describe('layout и стилизация', () => {
    it('должен иметь responsive layout с max-width', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('max-w-sm');
      expect(content).toContain('sm:max-w-sm');
      expect(content).toContain('w-full');
    });

    it('должен иметь консистентный background и spacing', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('bg-white');
      expect(content).toContain('p-6');
      expect(content).toContain('shadow');
      expect(content).toContain('rounded-lg');
    });
  });

  describe('интеграция с компонентами', () => {
    it('должен использовать RegisterForm из ui-features', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import { RegisterForm }');
      expect(content).toContain("from '@livai/ui-features'");
      expect(content).toContain('<RegisterForm');
      expect(content).toContain('autoFocus');
    });

    it('должен содержать onSubmit обработчик', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('onSubmit=');
      expect(content).toContain("throw new Error('Registration flow not implemented yet'");
    });
  });

  describe('навигация', () => {
    it('должен содержать ссылку на login страницу', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('href={`/${locale}/auth/login`}');
      expect(content).toContain("t('register.link')");
    });
  });

  describe('комментарии TODO', () => {
    it('должен содержать TODO для registration flow', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/register/page.tsx'),
        'utf8',
      );

      expect(content).toContain('TODO: Реализовать реальный registration flow');
      expect(content).toContain('TODO: Добавить валидацию и обработку ошибок');
      expect(content).toContain('TODO: Интегрировать с Zustand store');
      expect(content).toContain('TODO (Фаза 2): подключить реальный registration flow');
    });
  });
});
