/**
 * @file Тесты для next-intl request config
 */

import { describe, expect, it, vi } from 'vitest';

// Mock для next-intl/server
vi.mock('next-intl/server', () => ({
  getRequestConfig: vi.fn((configFn) => configFn),
}));

// Mock для routing
vi.mock('../../../i18n/routing.js', () => ({
  defaultLocale: 'en',
  locales: ['en', 'ru'],
}));

// Mock для messages файлов (минимальный набор для тестирования)
const mockEnMessages = {
  common: { loading: 'Loading…' },
  auth: {
    email: { label: 'Email' },
    password: { label: 'Password' },
    workspaceName: { label: 'Workspace name' },
    login: { title: 'Sign In', submit: 'Sign In' },
    register: { title: 'Sign Up', link: 'Sign In', submit: 'Sign Up' },
  },
  home: {
    title: 'LivAi',
    description: 'AI-powered chatbot platform with multi-tenant architecture',
    dashboard: 'Dashboard',
    e2eStatus: 'E2E Test Status: ✅ Working',
  },
  dashboard: {
    title: 'Dashboard',
    description: 'UI skeleton. Screen will evolve according to roadmap.',
  },
  validation: {
    required: 'Required',
    string: { min: 'Too short', max: 'Too long' },
  },
  metadata: {
    title: 'LivAi - AI Chatbot Platform',
    description: 'AI-powered chatbot platform with multi-tenant architecture',
  },
};
const mockRuMessages = { hello: 'Привет', goodbye: 'До свидания' };

vi.mock('../../../messages/en.json', () => ({
  default: mockEnMessages,
}));

vi.mock('../../../messages/ru.json', () => ({
  default: mockRuMessages,
}));

describe('next-intl request config', () => {
  describe('экспорт по умолчанию', () => {
    it('должен экспортировать функцию getRequestConfig', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      expect(typeof requestConfig).toBe('function');
      expect(requestConfig).toBeDefined();
    });
  });

  describe('обработка локалей', () => {
    it('должен возвращать корректную конфигурацию для английской локали', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      const result = await requestConfig({ locale: 'en' } as any);

      expect(result.locale).toBe('en');
      expect(result.messages).toEqual(mockEnMessages);
    });

    it('должен возвращать корректную конфигурацию для русской локали', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      const result = await requestConfig({ locale: 'ru' } as any);

      expect(result.locale).toBe('ru');
      expect(result.messages).toEqual(mockRuMessages);
    });

    it('должен использовать fallback для неподдерживаемой локали', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      const result = await requestConfig({ locale: 'es' } as any);

      expect(result.locale).toBe('en'); // defaultLocale
      expect(result.messages).toEqual(mockEnMessages);
    });

    it('должен использовать fallback для undefined локали', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      const result = await requestConfig({ locale: undefined } as any);

      expect(result.locale).toBe('en'); // defaultLocale
      expect(result.messages).toEqual(mockEnMessages);
    });
  });

  describe('структура возвращаемого объекта', () => {
    it('должен возвращать объект с правильной структурой', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      const result = await requestConfig({ locale: 'en' } as any);

      expect(result).toHaveProperty('locale');
      expect(result).toHaveProperty('messages');
      expect(typeof result.locale).toBe('string');
      expect(typeof result.messages).toBe('object');
    });
  });

  describe('асинхронность', () => {
    it('должен возвращать Promise', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      const result = requestConfig({ locale: 'en' } as any);
      expect(result).toBeInstanceOf(Promise);
    });

    it('должен разрешаться в правильный объект', async () => {
      const { default: requestConfig } = await import('../../../i18n/request.js');

      const result = await requestConfig({ locale: 'en' } as any);

      expect(result.locale).toBe('en');
      expect(result.messages).toMatchObject(mockEnMessages);
      // Проверяем, что есть дополнительные ключи (полный messages bundle)
      expect(result.messages).toHaveProperty('auth');
      expect(result.messages).toHaveProperty('common');
      expect(result.messages).toHaveProperty('dashboard');
    });
  });
});
