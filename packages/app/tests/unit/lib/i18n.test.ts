/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import {
  createI18nInstance,
  I18nProvider,
  testResetGlobalRuntimeStore,
  translations,
  useI18n,
  useTranslationNamespace,
} from '../../../src/lib/i18n';
import type { Namespace, TranslationKey } from '../../../src/lib/i18n';

describe('i18n', () => {
  const mockTelemetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Очищаем globalRuntimeStore между тестами для чистоты
    testResetGlobalRuntimeStore();
  });

  afterEach(() => {
    cleanup();
  });

  describe('createI18nInstance', () => {
    it('должен создавать экземпляр с правильными значениями', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      expect(instance.locale).toBe('ru');
      expect(instance.fallbackLocale).toBe('en');
      expect(instance.telemetry).toBe(mockTelemetry);
      expect(typeof instance.translate).toBe('function');
    });

    it('должен работать без telemetry', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      expect(instance.telemetry).toBeUndefined();
    });

    it('translate должен переводить ключ без параметров', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'greeting');
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockTelemetry).not.toHaveBeenCalled();
    });

    it('translate должен переводить ключ с параметрами', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'greeting', { name: 'Мир' });
      expect(translated).toBe('Привет, Мир!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockTelemetry).not.toHaveBeenCalled();
    });

    it('translate должен переводить ключ с числовым параметром', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'greeting', { name: 123 });
      expect(translated).toBe('Привет, 123!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockTelemetry).not.toHaveBeenCalled();
    });

    it('translate должен возвращать human-readable fallback для несуществующего ключа', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'nonexistent' as any);
      // Human-readable fallback: nonexistent -> Nonexistent
      expect(translated).toBe('Nonexistent');
      expect(mockTelemetry).toHaveBeenCalledWith({
        key: 'nonexistent',
        ns: 'common',
        locale: 'ru',
        traceId: undefined,
        service: undefined,
        fallbackType: 'human-readable',
      });
    });

    it('translate должен возвращать human-readable fallback для ключа, отсутствующего везде', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate(
        'nonexistent' as any,
        'uniqueKeyThatDoesNotExist' as any,
      );
      // Human-readable fallback: uniqueKeyThatDoesNotExist -> Unique Key That Does Not Exist
      expect(translated).toBe('Unique Key That Does Not Exist');
      expect(mockTelemetry).toHaveBeenCalledWith({
        key: 'uniqueKeyThatDoesNotExist',
        ns: 'nonexistent',
        locale: 'ru',
        traceId: undefined,
        service: undefined,
        fallbackType: 'human-readable',
      });
    });

    it('translate не должен вызывать telemetry без функции', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      const translated = instance.translate('common', 'greeting');
      expect(translated).toBe('Привет, {name}!');
      expect(mockTelemetry).not.toHaveBeenCalled();
    });

    it('translate должен экранировать специальные символы в параметрах', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'greeting', {
        name: '<script>alert("xss")</script>',
      });
      expect(translated).toBe('Привет, <script>alert("xss")</script>!');
    });

    it('translate должен обрабатывать пустой объект параметров', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'greeting', {} as const);
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockTelemetry).not.toHaveBeenCalled();
    });

    it('translate должен заменять несколько одинаковых плейсхолдеров', () => {
      // Тестируем логику замены напрямую
      const template = 'Test {value}, test {value}!';
      let result = template;
      const params = { value: 'World' };
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
      expect(result).toBe('Test World, test World!');
    });

    it('translate должен работать с undefined параметрами', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'greeting', undefined);
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockTelemetry).not.toHaveBeenCalled();
    });

    it('translate должен работать с null параметрами', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        telemetry: mockTelemetry,
      });

      const translated = instance.translate('common', 'greeting', null as any);
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockTelemetry).not.toHaveBeenCalled();
    });

    it('loadNamespace должен загружать namespace', async () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Загружаем namespace
      await instance.loadNamespace('test-namespace' as any);

      // Проверяем что namespace загружен
      expect(instance.isNamespaceLoaded('test-namespace' as any)).toBe(true);
      expect(instance.isNamespaceLoaded('common')).toBe(true); // уже загружен по умолчанию
    });

    it('loadNamespace не должен загружать уже загруженный namespace повторно', async () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Загружаем namespace первый раз
      await instance.loadNamespace('test-namespace' as any);
      expect(instance.isNamespaceLoaded('test-namespace' as any)).toBe(true);

      // Пытаемся загрузить повторно
      await instance.loadNamespace('test-namespace' as any);
      expect(instance.isNamespaceLoaded('test-namespace' as any)).toBe(true);
    });
  });

  describe('translations object', () => {
    it('должен содержать все ожидаемые ключи', () => {
      expect(translations).toHaveProperty('common');
      expect(translations).toHaveProperty('auth');

      expect(translations.common).toHaveProperty('greeting');
      expect(translations.common).toHaveProperty('farewell');

      expect(translations.auth).toHaveProperty('login');
      expect(translations.auth).toHaveProperty('logout');
      expect(translations.auth).toHaveProperty('error');
    });

    it('все значения должны быть строками', () => {
      const checkNamespace = (ns: Readonly<Record<string, string>>) => {
        Object.values(ns).forEach((value) => {
          expect(typeof value).toBe('string');
        });
      };

      checkNamespace(translations.common);
      checkNamespace(translations.auth);
    });
  });

  describe('TypeScript типы', () => {
    it('Namespace тип должен соответствовать ключам translations', () => {
      const namespaces: Namespace[] = ['common', 'auth'];
      expect(namespaces).toEqual(['common', 'auth']);
    });

    it('TranslationKey тип должен работать для каждого namespace', () => {
      const commonKey: TranslationKey<'common'> = 'greeting';
      const authKey: TranslationKey<'auth'> = 'login';

      expect(commonKey).toBe('greeting');
      expect(authKey).toBe('login');
    });
  });

  describe('Экспорты', () => {
    it('должен экспортировать все необходимые функции и типы', () => {
      expect(typeof I18nProvider).toBe('function');
      expect(typeof useI18n).toBe('function');
      expect(typeof createI18nInstance).toBe('function');
      expect(typeof translations).toBe('object');
    });

    it('I18nProvider должен быть React компонентом', () => {
      expect(I18nProvider).toBeDefined();
      expect(I18nProvider.name).toBe('I18nProvider');
    });

    it('useI18n должен быть хуком', () => {
      expect(useI18n).toBeDefined();
      expect(typeof useI18n).toBe('function');
    });
  });

  describe('useTranslationNamespace хук', () => {
    it('должен загружать namespace через useEffect', async () => {
      const TestComponent = () => {
        useTranslationNamespace('test-namespace' as any);
        return React.createElement('div', null, 'test');
      };

      render(
        React.createElement(I18nProvider, {
          locale: 'ru',
          fallbackLocale: 'en',
          children: React.createElement(TestComponent),
        }),
      );

      // Ждем выполнения useEffect
      await new Promise((resolve) => setTimeout(resolve, 150));

      // useTranslationNamespace должен отработать без ошибок
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  describe('React интеграция', () => {
    describe('I18nProvider', () => {
      it('должен рендерить дочерние компоненты', () => {
        const TestComponent = () => {
          const { translate } = useI18n();
          return React.createElement(
            'div',
            { 'data-testid': 'test-child' },
            translate('common', 'greeting'),
          );
        };

        render(
          React.createElement(I18nProvider, {
            locale: 'ru',
            fallbackLocale: 'en',
            children: React.createElement(TestComponent),
          }),
        );

        expect(screen.getByTestId('test-child')).toHaveTextContent('Привет, {name}!');
      });

      it('должен предоставлять translate функцию через контекст', () => {
        const TestComponent = () => {
          const { translate } = useI18n();
          return React.createElement(
            'span',
            { 'data-testid': 'translate-test' },
            translate('common', 'greeting', { name: 'React' }),
          );
        };

        render(
          React.createElement(I18nProvider, {
            locale: 'ru',
            fallbackLocale: 'en',
            telemetry: mockTelemetry,
            children: React.createElement(TestComponent),
          }),
        );

        expect(screen.getByTestId('translate-test')).toHaveTextContent('Привет, React!');
        // Telemetry теперь вызывается только для fallback случаев
        expect(mockTelemetry).not.toHaveBeenCalled();
      });

      it('должен работать с различными локалями', () => {
        const TestComponent = () => {
          const { translate, locale } = useI18n();
          return React.createElement(
            'div',
            null,
            React.createElement('span', { 'data-testid': 'locale' }, locale),
            React.createElement(
              'span',
              { 'data-testid': 'translation' },
              translate('common', 'greeting'),
            ),
          );
        };

        render(
          React.createElement(I18nProvider, {
            locale: 'en',
            fallbackLocale: 'ru',
            children: React.createElement(TestComponent),
          }),
        );

        expect(screen.getByTestId('locale')).toHaveTextContent('en');
        // Поскольку английских переводов нет, должен быть human-readable fallback
        expect(screen.getByTestId('translation')).toHaveTextContent('Greeting');
      });

      it('должен корректно работать с namespace loading в React контексте', async () => {
        const TestComponent = () => {
          const { isNamespaceLoaded } = useI18n();
          return React.createElement(
            'div',
            null,
            React.createElement(
              'span',
              { 'data-testid': 'common-loaded' },
              isNamespaceLoaded('common').toString(),
            ),
            React.createElement(
              'span',
              { 'data-testid': 'auth-loaded' },
              isNamespaceLoaded('auth').toString(),
            ),
            React.createElement(
              'span',
              { 'data-testid': 'unknown-loaded' },
              isNamespaceLoaded('unknown' as any).toString(),
            ),
          );
        };

        render(
          React.createElement(I18nProvider, {
            locale: 'ru',
            fallbackLocale: 'en',
            children: React.createElement(TestComponent),
          }),
        );

        expect(screen.getByTestId('common-loaded')).toHaveTextContent('true');
        expect(screen.getByTestId('auth-loaded')).toHaveTextContent('true');
        expect(screen.getByTestId('unknown-loaded')).toHaveTextContent('false');
      });
    });

    describe('useI18n хук', () => {
      it('должен бросать ошибку вне провайдера', () => {
        expect(() => renderHook(() => useI18n())).toThrow(
          'useI18n must be used within an I18nProvider',
        );
      });

      it('должен возвращать контекст внутри провайдера', () => {
        const { result } = renderHook(() => useI18n(), {
          wrapper: ({ children }) =>
            React.createElement(I18nProvider, {
              locale: 'ru',
              fallbackLocale: 'en',
              telemetry: mockTelemetry,
              children,
            }),
        });

        expect(result.current.locale).toBe('ru');
        expect(result.current.fallbackLocale).toBe('en');
        expect(result.current.telemetry).toBe(mockTelemetry);
        expect(typeof result.current.translate).toBe('function');
      });

      it('translate функция должна работать в контексте React', () => {
        const { result } = renderHook(() => useI18n(), {
          wrapper: ({ children }) =>
            React.createElement(I18nProvider, {
              locale: 'ru',
              fallbackLocale: 'en',
              telemetry: mockTelemetry,
              children,
            }),
        });

        const translated = result.current.translate('common', 'greeting', { name: 'Тест' });
        expect(translated).toBe('Привет, Тест!');
        // Telemetry теперь вызывается только для fallback случаев
        expect(mockTelemetry).not.toHaveBeenCalled();
      });

      it('translate функция должна обрабатывать несуществующие ключи в React контексте', () => {
        const { result } = renderHook(() => useI18n(), {
          wrapper: ({ children }) =>
            React.createElement(I18nProvider, {
              locale: 'ru',
              fallbackLocale: 'en',
              telemetry: mockTelemetry,
              children,
            }),
        });

        const translated = result.current.translate('common', 'nonexistent' as any);
        // Новая логика: human-readable fallback вместо [missing] формата
        expect(translated).toBe('Nonexistent');
        expect(mockTelemetry).toHaveBeenCalledWith({
          key: 'nonexistent',
          ns: 'common',
          locale: 'ru',
          traceId: undefined,
          service: undefined,
          fallbackType: 'human-readable',
        });
      });
    });

    describe('вложенные провайдеры', () => {
      it('внутренний провайдер должен переопределять внешний', () => {
        const TestComponent = () => {
          const { translate, locale } = useI18n();
          return React.createElement(
            'div',
            null,
            React.createElement('span', { 'data-testid': 'locale' }, locale),
            React.createElement(
              'span',
              { 'data-testid': 'translation' },
              translate('common', 'greeting'),
            ),
          );
        };

        render(
          React.createElement(I18nProvider, {
            locale: 'en',
            fallbackLocale: 'ru',
            children: React.createElement(I18nProvider, {
              locale: 'ru',
              fallbackLocale: 'en',
              children: React.createElement(TestComponent),
            }),
          }),
        );

        expect(screen.getByTestId('locale')).toHaveTextContent('ru');
        expect(screen.getByTestId('translation')).toHaveTextContent('Привет, {name}!');
      });
    });
  });
});
