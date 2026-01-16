/**
 * @file Тесты для middleware i18n роутинга
 */

import { describe, expect, it, vi } from 'vitest';

// Mock для next-intl/middleware
const mockCreateMiddleware = vi.fn(() => () => {});
vi.mock('next-intl/middleware', () => ({
  default: mockCreateMiddleware,
}));

// Mock для routing
vi.mock('../../i18n/routing.js', () => ({
  defaultLocale: 'en',
  locales: ['en', 'ru'],
}));

describe('middleware', () => {
  describe('экспорт по умолчанию', () => {
    it('должен экспортировать middleware функцию', async () => {
      // Поскольку middleware зависит от next-intl, просто проверяем что экспорт существует
      const module = await import('../../middleware.js');

      expect(module).toHaveProperty('default');
      expect(module.default).toBeDefined();
    });
  });

  describe('конфигурация middleware', () => {
    it('должен экспортировать config с правильным типом', async () => {
      const { config } = await import('../../middleware.js');

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config).toHaveProperty('matcher');
    });

    it('должен иметь правильный matcher паттерн', async () => {
      const { config } = await import('../../middleware.js');

      expect(config.matcher).toEqual(['/((?!api|_next|.*\\..*).*)']);
    });

    it('matcher должен быть массивом с одним элементом', async () => {
      const { config } = await import('../../middleware.js');

      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher).toHaveLength(1);
    });

    it('matcher паттерн должен исключать API routes', async () => {
      const { config } = await import('../../middleware.js');
      const pattern = config.matcher?.[0];

      if (typeof pattern === 'string') {
        // Паттерн должен содержать отрицание для 'api'
        expect(pattern).toContain('api');
        expect(pattern).toContain('!');
      }
    });

    it('matcher паттерн должен исключать _next', async () => {
      const { config } = await import('../../middleware.js');
      const pattern = config.matcher?.[0];

      if (typeof pattern === 'string') {
        expect(pattern).toContain('_next');
        expect(pattern).toContain('!');
      }
    });

    it('matcher паттерн должен исключать статические файлы', async () => {
      const { config } = await import('../../middleware.js');
      const pattern = config.matcher?.[0];

      if (typeof pattern === 'string') {
        expect(pattern).toContain('.*\\..*');
        expect(pattern).toContain('!');
      }
    });
  });

  describe('интеграция с next-intl', () => {
    it('должен быть совместим с next-intl middleware API', async () => {
      const module = await import('../../middleware.js');

      // Middleware экспорт должен существовать
      expect(module.default).toBeDefined();
    });
  });

  describe('структура файла', () => {
    it('должен иметь два экспорта: default и config', async () => {
      const module = await import('../../middleware.js');

      expect(module).toHaveProperty('default');
      expect(module).toHaveProperty('config');
      expect(Object.keys(module)).toHaveLength(2);
    });

    it('default экспорт должен существовать', async () => {
      const { default: middleware } = await import('../../middleware.js');

      expect(middleware).toBeDefined();
    });

    it('config экспорт должен быть объектом', async () => {
      const { config } = await import('../../middleware.js');

      expect(typeof config).toBe('object');
      expect(config).not.toBeNull();
    });
  });

  describe('поведение middleware (интеграционное)', () => {
    it('должен быть готов к использованию в Next.js приложении', async () => {
      const { default: middleware } = await import('../../middleware.js');

      // Middleware должен существовать для использования Next.js
      expect(middleware).toBeDefined();
    });

    it('конфигурация должна соответствовать Next.js MiddlewareConfig', async () => {
      const { config } = await import('../../middleware.js');

      // Проверяем, что config имеет структуру, ожидаемую Next.js
      expect(config).toHaveProperty('matcher');
      expect(Array.isArray(config.matcher)).toBe(true);
      if (Array.isArray(config.matcher)) {
        expect(config.matcher.every((item: any) => typeof item === 'string')).toBe(true);
      }
    });
  });

  describe('исключения в matcher', () => {
    it('паттерн должен содержать исключения для API routes', async () => {
      const { config } = await import('../../middleware.js');
      const pattern = config.matcher?.[0];

      if (typeof pattern === 'string') {
        expect(pattern).toContain('api');
        expect(pattern).toContain('!');
      }
    });

    it('паттерн должен содержать исключения для Next.js internals', async () => {
      const { config } = await import('../../middleware.js');
      const pattern = config.matcher?.[0];

      if (typeof pattern === 'string') {
        expect(pattern).toContain('_next');
        expect(pattern).toContain('!');
      }
    });

    it('паттерн должен содержать исключения для статических файлов', async () => {
      const { config } = await import('../../middleware.js');
      const pattern = config.matcher?.[0];

      if (typeof pattern === 'string') {
        expect(pattern).toContain('.*\\..*');
        expect(pattern).toContain('!');
      }
    });
  });
});
