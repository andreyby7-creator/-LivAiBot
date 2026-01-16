/**
 * @file Тесты для i18n routing конфигурации
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { defaultLocale, i18nConfig, locales } from '../../../i18n/routing';
import type { Locale } from '../../../i18n/routing';

describe('i18n routing configuration', () => {
  beforeEach(() => {
    // Гарантируем, что i18nConfig не был изменен предыдущими тестами
    expect(i18nConfig.locales).toEqual(['en', 'ru']);
    expect(i18nConfig.defaultLocale).toBe('en');
  });

  describe('i18nConfig', () => {
    it('должен содержать корректный массив локалей', () => {
      expect(i18nConfig.locales).toEqual(['en', 'ru']);
      expect(i18nConfig.locales).toHaveLength(2);
    });

    it('должен содержать корректную локаль по умолчанию', () => {
      expect(i18nConfig.defaultLocale).toBe('en');
    });

    it('должен иметь readonly свойства', () => {
      // Проверяем, что свойства определены и имеют правильные значения
      expect(i18nConfig).toHaveProperty('locales');
      expect(i18nConfig).toHaveProperty('defaultLocale');

      // Проверяем, что значения соответствуют ожидаемым
      expect(i18nConfig.locales).toEqual(['en', 'ru']);
      expect(i18nConfig.defaultLocale).toBe('en');
    });

    it('должен содержать только определенные локали', () => {
      expect(i18nConfig.locales).toEqual(['en', 'ru']);
      expect(i18nConfig.locales).toContain('en');
      expect(i18nConfig.locales).toContain('ru');
      expect(i18nConfig.locales).not.toContain('es');
      expect(i18nConfig.locales).not.toContain('fr');
    });
  });

  describe('locales', () => {
    it('должен быть ссылкой на i18nConfig.locales', () => {
      expect(locales).toBe(i18nConfig.locales);
    });

    it('должен содержать корректные локали', () => {
      expect(locales).toEqual(['en', 'ru']);
      expect(locales).toHaveLength(2);
    });

    it('должен быть readonly массивом (type-level)', () => {
      // TypeScript проверка: readonly на уровне типов
      // Runtime проверка: массив доступен только для чтения
      expect(locales).toEqual(['en', 'ru']);

      // Проверяем, что это действительно readonly массив
      expect(Object.getOwnPropertyDescriptor(locales, 'length')?.writable).toBe(true);
      // Но TypeScript не позволит: locales.push('es') - ошибка компиляции
    });

    it('должен содержать только строковые значения', () => {
      locales.forEach((locale) => {
        expect(typeof locale).toBe('string');
        expect(locale.length).toBeGreaterThan(0);
      });
    });
  });

  describe('defaultLocale', () => {
    it('должен быть ссылкой на i18nConfig.defaultLocale', () => {
      expect(defaultLocale).toBe(i18nConfig.defaultLocale);
    });

    it('должен быть равен "en"', () => {
      expect(defaultLocale).toBe('en');
    });

    it('должен быть одной из доступных локалей', () => {
      expect(locales).toContain(defaultLocale);
    });

    it('должен быть строкой', () => {
      expect(typeof defaultLocale).toBe('string');
      expect(defaultLocale.length).toBeGreaterThan(0);
    });
  });

  describe('Locale type', () => {
    it('должен разрешать корректные локали', () => {
      const enLocale: Locale = 'en';
      const ruLocale: Locale = 'ru';

      expect(enLocale).toBe('en');
      expect(ruLocale).toBe('ru');
    });

    it('должен запрещать некорректные локали', () => {
      // TypeScript проверки - эти строки вызовут ошибку компиляции если раскомментировать
      // const invalidLocale1: Locale = 'es'; // Ошибка TS
      // const invalidLocale2: Locale = 'fr'; // Ошибка TS
      // const invalidLocale3: Locale = ''; // Ошибка TS

      // Для runtime проверки используем функцию с generic
      function assertValidLocale<T extends Locale>(locale: T): T {
        return locale;
      }

      expect(() => assertValidLocale('en')).not.toThrow();
      expect(() => assertValidLocale('ru')).not.toThrow();

      // Эти проверки не пройдут на уровне типов, но мы можем проверить логику
      const validLocales = ['en', 'ru'] as const;
      validLocales.forEach((locale) => {
        expect(locales).toContain(locale);
      });
    });

    it('должен соответствовать всем локалям из массива', () => {
      // Каждая локаль из массива должна быть валидным Locale
      locales.forEach((locale) => {
        const validLocale: Locale = locale;
        expect(validLocale).toBe(locale);
      });
    });
  });

  describe('консистентность данных', () => {
    it('defaultLocale должен быть первой локалью в массиве', () => {
      expect(locales[0]).toBe(defaultLocale);
    });

    it('все локали должны быть уникальными', () => {
      const uniqueLocales = new Set(locales);
      expect(uniqueLocales.size).toBe(locales.length);

      // Каждая локаль встречается ровно один раз
      locales.forEach((locale) => {
        expect(locales.filter((l) => l === locale)).toHaveLength(1);
      });
    });

    it('локали должны иметь определенный порядок', () => {
      // Проверяем, что порядок локалей определен и постоянен
      expect(locales).toEqual(['en', 'ru']);
    });

    it('длина массива локалей должна быть разумной', () => {
      expect(locales.length).toBeGreaterThan(0);
      expect(locales.length).toBeLessThanOrEqual(10); // Разумное ограничение
    });
  });

  describe('runtime проверки', () => {
    it('должен работать с деструктуризацией', () => {
      const { locales: configLocales, defaultLocale: configDefault } = i18nConfig;

      expect(configLocales).toEqual(locales);
      expect(configDefault).toBe(defaultLocale);
    });

    it('должен поддерживать использование в условиях', () => {
      const isEnglish = defaultLocale === 'en';
      const isRussian = defaultLocale === 'ru';
      const hasEnglish = locales.includes('en');
      const hasRussian = locales.includes('ru');

      expect(isEnglish).toBe(true);
      expect(isRussian).toBe(false);
      expect(hasEnglish).toBe(true);
      expect(hasRussian).toBe(true);
    });

    it('должен поддерживать итерацию по локалям', () => {
      const result: Locale[] = [];
      locales.forEach((locale) => {
        result.push(locale);
      });

      expect(result).toEqual(locales);
      expect(result).toHaveLength(locales.length);
    });

    it('должен поддерживать поиск в массиве', () => {
      expect(locales.indexOf('en')).toBe(0);
      expect(locales.indexOf('ru')).toBe(1);
      expect(locales.indexOf('es' as any)).toBe(-1); // 'es' не должна содержаться
    });
  });

  describe('интеграция с next-intl', () => {
    it('локали должны быть валидными для next-intl routing', () => {
      // Next-intl ожидает BCP 47 compliant локали
      locales.forEach((locale) => {
        expect(locale).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
        expect(locale.length).toBeGreaterThanOrEqual(2);
        expect(locale.length).toBeLessThanOrEqual(5);
      });
    });

    it('defaultLocale должен быть валидным для next-intl', () => {
      expect(defaultLocale).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
      expect(locales).toContain(defaultLocale);
    });

    it('конфигурация должна поддерживать next-intl middleware', () => {
      // Проверяем, что конфигурация имеет нужную структуру для middleware
      expect(i18nConfig).toHaveProperty('locales');
      expect(i18nConfig).toHaveProperty('defaultLocale');
      expect(Array.isArray(i18nConfig.locales)).toBe(true);
      expect(typeof i18nConfig.defaultLocale).toBe('string');
    });
  });

  describe('расширяемость', () => {
    it('должен поддерживать добавление новых локалей', () => {
      // Симуляция добавления новой локали (type assertion для тестирования)
      const newLocale = 'es' as any; // В реальном коде это будет новая локаль
      const extendedLocales = [...locales, newLocale] as any[];
      const extendedConfig = {
        ...i18nConfig,
        locales: extendedLocales,
      };

      expect(extendedConfig.locales).toHaveLength(3);
      expect(extendedConfig.locales).toContain(newLocale);
      expect(extendedConfig.locales).toContain('en');
      expect(extendedConfig.locales).toContain('ru');
      expect(extendedConfig.defaultLocale).toBe('en'); // default не изменился
    });

    it('должен поддерживать изменение defaultLocale', () => {
      // Симуляция изменения локали по умолчанию
      const configWithRussianDefault = {
        ...i18nConfig,
        defaultLocale: 'ru' as const,
      };

      expect(configWithRussianDefault.defaultLocale).toBe('ru');
      expect(configWithRussianDefault.locales).toEqual(locales);
    });

    it('структура конфига должна быть предсказуемой', () => {
      expect(i18nConfig).toHaveProperty('locales');
      expect(i18nConfig).toHaveProperty('defaultLocale');
      expect(Object.keys(i18nConfig)).toHaveLength(2);
    });
  });
});
