/**
 * @file Тесты для LoginPage
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';

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
  LoginForm: ({ t, onSubmit }: any) => (
    <div data-testid='login-form-component'>
      <button onClick={() => onSubmit({ email: 'test@example.com', password: 'password' })}>
        {t('auth.login.submit')}
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

describe('LoginPage', () => {
  const mockTranslations = {
    'login.title': 'Sign In',
    'login.submit': 'Sign In',
    'register.link': 'Sign Up',
    'auth.login.submit': 'Sign In',
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
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import { useTranslations }');
      expect(content).toContain("from 'next-intl'");
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
      expect(content).toContain('}: LoginPageProps');
    });
  });

  describe('i18n интеграция', () => {
    it("должен использовать useTranslations с типом 'auth'", () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain("useTranslations<'auth'>");
    });

    it('должен содержать все необходимые ключи переводов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain("t('login.title')");
      expect(content).toContain("t('register.link')");
    });

    it('должен передавать t напрямую в LoginForm', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('<LoginForm');
      expect(content).toContain('t={t}');
      expect(content).not.toContain('t={(key: string) => t(key)}');
    });
  });

  describe('структура JSX', () => {
    it('должен содержать правильную структуру HTML элементов', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
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
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
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
      expect(content).toContain('bg-white');
      expect(content).toContain('text-blue-600');
    });
  });

  describe('accessibility', () => {
    it('должен содержать role="main"', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain("role='main'");
    });

    it('должен содержать aria-label для заголовка', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain("aria-label={t('login.title')}");
    });
  });

  describe('layout и стилизация', () => {
    it('должен иметь responsive layout с max-width', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('max-w-sm');
      expect(content).toContain('sm:max-w-sm');
      expect(content).toContain('w-full');
    });

    it('должен иметь консистентный background и spacing', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('bg-white');
      expect(content).toContain('p-6');
      expect(content).toContain('shadow');
      expect(content).toContain('rounded-lg');
    });
  });

  describe('интеграция с компонентами', () => {
    it('должен использовать LoginForm из ui-features', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('import { LoginForm }');
      expect(content).toContain("from '@livai/ui-features'");
      expect(content).toContain('<LoginForm');
    });

    it('должен содержать onSubmit обработчик', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('onSubmit=');
      expect(content).toContain("throw new Error('Auth flow not implemented yet'");
    });
  });

  describe('навигация', () => {
    it('должен содержать ссылку на register страницу', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('href={`/${locale}/auth/register`}');
      expect(content).toContain("t('register.link')");
    });
  });

  describe('комментарии TODO', () => {
    it('должен содержать TODO для auth flow', () => {
      const content = readFileSync(
        resolve(__dirname, '../../../../../src/app/[locale]/auth/login/page.tsx'),
        'utf8',
      );

      expect(content).toContain('TODO: Реализовать реальный auth flow');
      expect(content).toContain('TODO: Добавить валидацию и обработку ошибок');
      expect(content).toContain('TODO: Интегрировать с Zustand store');
      expect(content).toContain('TODO (Фаза 2): подключить реальный auth flow');
    });
  });
});
