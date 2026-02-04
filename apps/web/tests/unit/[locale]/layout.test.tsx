/**
 * @file Тесты для LocaleLayout и generateMetadata
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock для next/navigation
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));

// Mock для next-intl/server
const mockSetRequestLocale = vi.fn();
const mockGetMessages = vi.fn();
const mockGetTranslations = vi.fn();
vi.mock('next-intl/server', () => ({
  setRequestLocale: mockSetRequestLocale,
  getMessages: mockGetMessages,
  getTranslations: mockGetTranslations,
}));

// Mock для i18n routing
vi.mock('../../../../i18n/routing.js', () => ({
  locales: ['en', 'ru'],
}));

// Mock для IntlProvider
vi.mock('@livai/app', () => ({
  IntlProvider: vi.fn(({ children, ...props }) => ({
    type: 'IntlProvider',
    props: { ...props, children },
  })),
}));

// Mock для Providers
const mockProviders = vi.fn(({ children }) => ({
  type: 'Memo(ProvidersComponent)',
  props: { children },
}));
vi.mock('../../../src/app/providers.js', () => ({
  Providers: mockProviders,
}));

describe('LocaleLayout', () => {
  const mockMessages = { hello: 'Hello', goodbye: 'Goodbye' };
  const mockTranslations = {
    title: 'LivAi - AI Chatbot Platform',
    description: 'AI-powered chatbot platform with multi-tenant architecture',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMessages.mockResolvedValue(mockMessages);
    mockGetTranslations.mockResolvedValue((key: string) =>
      mockTranslations[key as keyof typeof mockTranslations]
    );
  });

  describe('generateMetadata', () => {
    it('должен возвращать локализованные метаданные для en', async () => {
      const { generateMetadata } = await import('../../../src/app/[locale]/layout.js');

      const result = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

      expect(result).toEqual({
        title: 'LivAi - AI Chatbot Platform',
        description: 'AI-powered chatbot platform with multi-tenant architecture',
        manifest: '/manifest.json',
        appleWebApp: {
          capable: true,
          statusBarStyle: 'default',
          title: 'LivAi',
        },
      });
      expect(mockGetTranslations).toHaveBeenCalledWith({
        locale: 'en',
        namespace: 'metadata',
      });
    });

    it('должен возвращать локализованные метаданные для ru', async () => {
      const ruTranslations = {
        title: 'LivAi - Платформа ИИ-чатботов',
        description: 'Платформа ИИ-чатботов с мульти-тенантной архитектурой',
      };
      mockGetTranslations.mockResolvedValue((key: string) =>
        ruTranslations[key as keyof typeof ruTranslations]
      );

      const { generateMetadata } = await import('../../../src/app/[locale]/layout.js');

      const result = await generateMetadata({ params: Promise.resolve({ locale: 'ru' }) });

      expect(result).toEqual({
        title: 'LivAi - Платформа ИИ-чатботов',
        description: 'Платформа ИИ-чатботов с мульти-тенантной архитектурой',
        manifest: '/manifest.json',
        appleWebApp: {
          capable: true,
          statusBarStyle: 'default',
          title: 'LivAi',
        },
      });
      expect(mockGetTranslations).toHaveBeenCalledWith({
        locale: 'ru',
        namespace: 'metadata',
      });
    });

    it('должен возвращать fallback метаданные для неподдерживаемой локали', async () => {
      const { generateMetadata } = await import('../../../src/app/[locale]/layout.js');

      const result = await generateMetadata({ params: Promise.resolve({ locale: 'es' }) });

      expect(result).toEqual({
        title: 'LivAi - AI Chatbot Platform',
        description: 'AI-powered chatbot platform with multi-tenant architecture',
      });
      expect(mockGetTranslations).not.toHaveBeenCalled();
    });
  });

  describe('isLocale type guard', () => {
    it('должен валидировать локали косвенно через generateMetadata', async () => {
      const { generateMetadata } = await import('../../../src/app/[locale]/layout.js');

      // Для поддерживаемой локали - должен вызывать getTranslations
      await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
      expect(mockGetTranslations).toHaveBeenCalledWith({
        locale: 'en',
        namespace: 'metadata',
      });

      vi.clearAllMocks();

      // Для неподдерживаемой локали - НЕ должен вызывать getTranslations
      await generateMetadata({ params: Promise.resolve({ locale: 'es' }) });
      expect(mockGetTranslations).not.toHaveBeenCalled();
    });

    it('должен существовать в модуле', async () => {
      const module = await import('../../../src/app/[locale]/layout.js');

      // Type guard тестируется косвенно через generateMetadata и LocaleLayout
      expect(module.generateMetadata).toBeDefined();
      expect(typeof module.default).toBe('function');
    });
  });

  describe('LocaleLayout component', () => {
    it('должен рендерить layout с поддерживаемой локалью', async () => {
      const { default: LocaleLayout } = await import('../../../src/app/[locale]/layout.js');

      // Mock React для тестирования JSX
      const mockChildren = { type: 'div', props: { children: 'Test content' } };

      const result = await LocaleLayout({
        children: mockChildren as any,
        params: Promise.resolve({ locale: 'en' }),
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('html');
      expect(result.props.lang).toBe('en');
      expect(result.props.suppressHydrationWarning).toBe(true);

      expect(mockSetRequestLocale).toHaveBeenCalledWith('en');
    });

    it('должен вызывать notFound для неподдерживаемой локали', async () => {
      const { default: LocaleLayout } = await import('../../../src/app/[locale]/layout.js');

      const mockChildren = { type: 'div', props: { children: 'Test content' } };

      // notFound выбрасывает ошибку, поэтому ожидаем reject
      await expect(
        LocaleLayout({
          children: mockChildren as any,
          params: Promise.resolve({ locale: 'es' }),
        }),
      ).rejects.toThrow();

      expect(mockNotFound).toHaveBeenCalled();
      expect(mockSetRequestLocale).not.toHaveBeenCalled();
      expect(mockGetMessages).not.toHaveBeenCalled();
    });

    it('должен корректно структурировать JSX для валидной локали', async () => {
      const { default: LocaleLayout } = await import('../../../src/app/[locale]/layout.js');

      const mockChildren = { type: 'div', props: { children: 'Test content' } };

      const result = await LocaleLayout({
        children: mockChildren as any,
        params: Promise.resolve({ locale: 'ru' }),
      });

      expect(result.props.children).toBeDefined();
      expect(result.props.children.type).toBe('body');
      expect(result.props.children.props.className).toBe('antialiased');

      // В новой архитектуре children идут напрямую без IntlProvider
      expect(result.props.children.props.children).toEqual(mockChildren);
    });
  });

  describe('обработка ошибок', () => {
    it('должен корректно обрабатывать ошибки getTranslations', async () => {
      mockGetTranslations.mockRejectedValueOnce(new Error('Failed to load translations'));

      const { generateMetadata } = await import('../../../src/app/[locale]/layout.js');

      await expect(generateMetadata({ params: Promise.resolve({ locale: 'en' }) })).rejects.toThrow(
        'Failed to load translations',
      );
    });
  });
});
