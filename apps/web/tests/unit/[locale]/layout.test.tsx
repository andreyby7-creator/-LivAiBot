/**
 * @file Тесты для LocaleLayout и generateMetadata
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock для next/navigation
const mockNotFound = vi.fn();
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

      const result = await generateMetadata({ params: { locale: 'en' } });

      expect(result).toEqual({
        title: 'LivAi - AI Chatbot Platform',
        description: 'AI-powered chatbot platform with multi-tenant architecture',
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

      const result = await generateMetadata({ params: { locale: 'ru' } });

      expect(result).toEqual({
        title: 'LivAi - Платформа ИИ-чатботов',
        description: 'Платформа ИИ-чатботов с мульти-тенантной архитектурой',
      });
      expect(mockGetTranslations).toHaveBeenCalledWith({
        locale: 'ru',
        namespace: 'metadata',
      });
    });

    it('должен возвращать fallback метаданные для неподдерживаемой локали', async () => {
      const { generateMetadata } = await import('../../../src/app/[locale]/layout.js');

      const result = await generateMetadata({ params: { locale: 'es' } });

      expect(result).toEqual({
        title: 'LivAi - AI Chatbot Platform',
        description: 'AI-powered chatbot platform with multi-tenant architecture',
      });
      expect(mockGetTranslations).not.toHaveBeenCalled();
    });
  });

  describe('isLocale type guard', () => {
    it('должен существовать в модуле', async () => {
      const module = await import('../../../src/app/[locale]/layout.js');

      // Type guard тестируется косвенно через generateMetadata
      expect(module.generateMetadata).toBeDefined();
      expect(typeof module.default).toBe('function');
    });
  });

  describe('обработка ошибок', () => {
    it('должен корректно обрабатывать ошибки getTranslations', async () => {
      mockGetTranslations.mockRejectedValueOnce(new Error('Failed to load translations'));

      const { generateMetadata } = await import('../../../src/app/[locale]/layout.js');

      await expect(generateMetadata({ params: { locale: 'en' } })).rejects.toThrow(
        'Failed to load translations',
      );
    });
  });
});
