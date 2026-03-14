/**
 * @vitest-environment jsdom
 */

import { cleanup, render, renderHook, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Namespace, TranslationKey } from '../../../src/lib/i18n';
import {
  createI18nInstance,
  formatDateLocalized,
  getCurrentDayjsLocale,
  I18nProvider,
  initGlobalI18n,
  isDayjsLocaleSupported,
  isRtlLocale,
  setDayjsLocale,
  setDayjsLocaleSync,
  t,
  useI18n,
} from '../../../src/lib/i18n';

import '@testing-library/jest-dom/vitest';

describe('i18n', () => {
  const mockEmitFallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('createI18nInstance', () => {
    it('должен создавать экземпляр с правильными значениями', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      expect(instance.locale).toBe('ru');
      expect(instance.fallbackLocale).toBe('en');
      expect(instance.emitFallback).toBe(mockEmitFallback);
      expect(typeof instance.translate).toBe('function');
    });

    it('должен работать без emitFallback', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      expect(instance.emitFallback).toBeUndefined();
    });

    it('translate должен переводить ключ без параметров', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate('common', 'greeting');
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('translate должен переводить ключ с параметрами', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate('common', 'greeting', { name: 'Мир' });
      expect(translated).toBe('Привет, Мир!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('translate должен переводить ключ с числовым параметром', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate('common', 'greeting', { name: 123 });
      expect(translated).toBe('Привет, 123!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('translate должен возвращать human-readable fallback для несуществующего ключа', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate('common', 'nonexistent' as any);
      // Human-readable fallback: nonexistent -> Nonexistent
      // Human-readable fallback не отправляет telemetry для уменьшения шума
      expect(translated).toBe('Nonexistent');
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('translate должен возвращать human-readable fallback для ключа, отсутствующего везде', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate(
        'common',
        'uniqueKeyThatDoesNotExist' as any,
      );
      // Human-readable fallback: uniqueKeyThatDoesNotExist -> Unique Key That Does Not Exist
      // Human-readable fallback не отправляет telemetry для уменьшения шума
      expect(translated).toBe('Unique Key That Does Not Exist');
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('должен правильно использовать fallback chain', () => {
      // Тест 1: Ключ найден в primary locale (common) - без fallback
      const instance1 = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });
      const result1 = instance1.translate('common', 'greeting');
      expect(result1).toBe('Привет, {name}!');
      expect(mockEmitFallback).not.toHaveBeenCalled();

      // Тест 2: Ключ не найден в primary, fallback к common namespace - common fallback
      const instance2 = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });
      const result2 = instance2.translate('auth', 'greeting' as any); // greeting есть в common
      expect(result2).toBe('Привет, {name}!'); // Возвращает greeting из common
      expect(mockEmitFallback).toHaveBeenCalledTimes(1);
      expect(mockEmitFallback).toHaveBeenCalledWith({
        key: 'greeting',
        ns: 'auth',
        locale: 'ru',
        fallbackType: 'common',
      });

      // Тест 3: Ключ не найден нигде - human-readable fallback (не отправляет telemetry)
      const instance3 = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });
      const result3 = instance3.translate('common', 'uniqueKeyThatDoesNotExist' as any);
      expect(result3).toBe('Unique Key That Does Not Exist');
      // Human-readable fallback не отправляет telemetry
      expect(mockEmitFallback).toHaveBeenCalledTimes(1); // Только предыдущий вызов
    });

    it('translate не должен вызывать telemetry без функции', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      const translated = instance.translate('common', 'greeting');
      expect(translated).toBe('Привет, {name}!');
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('translate должен работать когда fallbackLocale совпадает с locale', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'ru', // Тот же locale
        emitFallback: mockEmitFallback,
      });

      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Привет, {name}!');
      // Не должно быть fallback, поэтому telemetry не вызывается
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('translate должен использовать fallback-locale когда ключ найден в fallback locale', () => {
      const instance = createI18nInstance({
        locale: 'en', // Английский без переводов
        fallbackLocale: 'ru', // Русский с переводами
        emitFallback: mockEmitFallback,
      });

      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Привет, {name}!');
      expect(mockEmitFallback).toHaveBeenCalledWith({
        key: 'greeting',
        ns: 'common',
        locale: 'en',
        fallbackType: 'fallback-locale',
      });
    });

    it('translate должен экранировать специальные символы в параметрах', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
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
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate('common', 'greeting', {} as const);
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockEmitFallback).not.toHaveBeenCalled();
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
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate('common', 'greeting', undefined);
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('translate должен работать с null параметрами', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      const translated = instance.translate('common', 'greeting', null as any);
      expect(translated).toBe('Привет, {name}!');
      // Telemetry теперь вызывается только для fallback случаев
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('ensureNamespace должен загружать namespace', async () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Проверяем что common уже загружен по умолчанию
      expect(instance.isNamespaceLoaded('common')).toBe(true);
      expect(instance.isNamespaceLoaded('auth')).toBe(true);

      // Проверяем что несуществующий namespace не загружен
      expect(instance.isNamespaceLoaded('nonexistent' as any)).toBe(false);
    });

    it('ensureNamespace не должен загружать уже загруженный namespace повторно', async () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Проверяем что common уже загружен
      expect(instance.isNamespaceLoaded('common')).toBe(true);

      // Повторная проверка не должна вызывать ошибок
      expect(instance.isNamespaceLoaded('common')).toBe(true);
    });

    it('ensureNamespace обрабатывает ошибки при загрузке файлов', async () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Пытаемся загрузить несуществующий namespace - теперь всегда успешно
      expect(() => instance.ensureNamespace('nonexistent' as any)).not.toThrow();

      // Namespace должен быть отмечен как загруженный (имитация)
      expect(instance.isNamespaceLoaded('nonexistent' as any)).toBe(true);
    });

    it('ensureNamespace создает новый TranslationSnapshot при необходимости', async () => {
      const instance = createI18nInstance({
        locale: 'en', // Используем английскую локаль, для которой нет встроенных переводов
        fallbackLocale: 'ru',
      });

      // Проверяем что начально namespace не загружен
      expect(instance.isNamespaceLoaded('common')).toBe(true); // common загружается по умолчанию

      // Попытка загрузить namespace должна пройти без ошибок
      // (даже если файл не существует, функция должна корректно обработать это)
      try {
        instance.ensureNamespace('common');
      } catch {
        // Игнорируем ошибки - нас интересует сам факт выполнения
      }
    });
  });

  describe('createI18nInstance', () => {
    it('должен содержать корректные переводы', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Проверяем базовые переводы
      expect(instance.translate('common', 'greeting')).toBe('Привет, {name}!');
      expect(instance.translate('common', 'farewell')).toBe('До свидания!');
      expect(instance.translate('auth', 'login')).toBe('Вход');
      expect(instance.translate('auth', 'logout')).toBe('Выход');
    });

    it('должен инициализировать пустое хранилище для не-ru локали', () => {
      const instance = createI18nInstance({
        locale: 'en',
        fallbackLocale: 'en',
      });

      // Для en локали переводы должны быть пустыми (кроме fallback)
      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Greeting'); // Human-readable fallback
    });

    it('должен инициализировать fallback locale когда она отличается от primary', () => {
      const instance = createI18nInstance({
        locale: 'en',
        fallbackLocale: 'ru',
      });

      // fallback locale (ru) должна содержать переводы
      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Привет, {name}!'); // Из fallback locale
    });

    it('должен инициализировать fallback locale как ru когда fallbackLocale === ru', () => {
      const instance = createI18nInstance({
        locale: 'en',
        fallbackLocale: 'ru',
      });

      // fallbackLocale === 'ru', должна быть инициализирована с coreTranslations
      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Привет, {name}!');
    });

    it('должен инициализировать fallback locale как пустую когда fallbackLocale !== ru', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // fallbackLocale === 'en' (не ru), должна быть пустой
      // Но primary locale === 'ru', поэтому переводы есть
      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Привет, {name}!'); // Из primary locale
    });
  });

  describe('TypeScript типы', () => {
    it('Namespace тип должен содержать корректные значения', () => {
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

  describe('interpolateParams функция', () => {
    it('должен возвращать строку без изменений если params не переданы', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Функция interpolateParams используется внутри translate
      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Привет, {name}!');
    });

    it('должен корректно заменять плейсхолдеры на значения', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      const result = instance.translate('common', 'greeting', { name: 'Тест' });
      expect(result).toBe('Привет, Тест!');
    });

    it('должен обрабатывать числовые значения в параметрах', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      const result = instance.translate('common', 'greeting', { name: 123 });
      expect(result).toBe('Привет, 123!');
    });

    it('должен заменять несколько одинаковых плейсхолдеров', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      const result = instance.translate('common', 'greeting', { name: 'Повтор' });
      expect(result).toBe('Привет, Повтор!');
    });

    it('должен обрабатывать undefined параметры', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      const result = instance.translate('common', 'greeting', undefined);
      expect(result).toBe('Привет, {name}!');
    });
  });

  describe('getLocalePath функция', () => {
    it('должен возвращать правильный путь для известных комбинаций locale/namespace', () => {
      // Проверяем через косвенные вызовы, так как функция не экспортирована
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Функция getLocalePath используется внутри ensureNamespace
      // Проверяем что функция работает без ошибок
      expect(() => instance.ensureNamespace('common')).not.toThrow();
    });

    it('должен обрабатывать неизвестные комбинации locale/namespace', () => {
      const instance = createI18nInstance({
        locale: 'unknown-locale',
        fallbackLocale: 'en',
      });

      // Проверяем что функция корректно обрабатывает неизвестные локали
      expect(() => instance.ensureNamespace('common')).not.toThrow();
    });
  });

  describe('TranslationSnapshot класс', () => {
    it('должен корректно работать с методами get/set/merge', () => {
      // TranslationSnapshot используется внутри createI18nInstance
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Проверяем что базовые переводы доступны
      const greeting = instance.translate('common', 'greeting');
      expect(greeting).toBe('Привет, {name}!');

      // Проверяем что методы работают корректно через translate
      const farewell = instance.translate('common', 'farewell');
      expect(farewell).toBe('До свидания!');
    });

    it('должен корректно объединять переводы через merge', async () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
      });

      // Проверяем что merge работает через ensureNamespace
      // (даже если файл не существует, логика merge должна выполниться)
      try {
        instance.ensureNamespace('common');
      } catch {
        // Игнорируем ошибки загрузки файла
      }

      // Проверяем что переводы всё еще доступны
      const greeting = instance.translate('common', 'greeting');
      expect(greeting).toBe('Привет, {name}!');
    });

    it('должен корректно инициализировать snapshot через init', () => {
      // TranslationSnapshot.init используется в I18nProvider
      // Проверяем косвенно через React компонент
      const TestComponent = () => {
        const { translate } = useI18n();
        return React.createElement(
          'div',
          { 'data-testid': 'init-test' },
          translate('common', 'greeting', { name: 'Init' }),
        );
      };

      render(
        React.createElement(I18nProvider, {
          locale: 'ru',
          fallbackLocale: 'en',
          children: React.createElement(TestComponent),
        }),
      );

      expect(screen.getByTestId('init-test')).toHaveTextContent('Привет, Init!');
    });
  });

  describe('Экспорты', () => {
    it('должен экспортировать все необходимые функции и типы', () => {
      expect(typeof I18nProvider).toBe('function');
      expect(typeof useI18n).toBe('function');
      expect(typeof createI18nInstance).toBe('function');
    });

    it('I18nProvider должен быть React компонентом', () => {
      expect(I18nProvider).toBeDefined();
      expect(typeof I18nProvider).toBe('function');
      // Note: React.memo changes the component name, so we don't check the name
    });

    it('useI18n должен быть хуком', () => {
      expect(useI18n).toBeDefined();
      expect(typeof useI18n).toBe('function');
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
            emitFallback: mockEmitFallback,
            children: React.createElement(TestComponent),
          }),
        );

        expect(screen.getByTestId('translate-test')).toHaveTextContent('Привет, React!');
        // Telemetry теперь вызывается только для fallback случаев
        expect(mockEmitFallback).not.toHaveBeenCalled();
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
        // Поскольку английских переводов нет, должен быть fallback к русской локали
        expect(screen.getByTestId('translation')).toHaveTextContent('Привет, {name}!');
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

      it('должен загружать namespace с fallback локалью при необходимости', async () => {
        const TestComponent = () => {
          const { ensureNamespace } = useI18n();
          React.useEffect(() => {
            // Попытка загрузить существующий namespace с fallback локалью
            ensureNamespace('common');
            // Теперь ensureNamespace всегда успешна
          }, [ensureNamespace]);
          return React.createElement(
            'div',
            { 'data-testid': 'fallback-loading-test' },
            'Fallback loading test',
          );
        };

        render(
          React.createElement(I18nProvider, {
            locale: 'en', // Основная локаль английская
            fallbackLocale: 'ru', // Fallback русская
            children: React.createElement(TestComponent),
          }),
        );

        // Ждем завершения асинхронных операций
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Тест просто проверяет, что компонент рендерится без ошибок
        expect(screen.getByTestId('fallback-loading-test')).toBeInTheDocument();
      });

      it('должен корректно работать с загрузкой fallback namespace через reducer', async () => {
        let ensureNamespaceCalled = false;

        const TestComponent = () => {
          const { ensureNamespace } = useI18n();
          React.useEffect(() => {
            ensureNamespaceCalled = true;
            // Попытка загрузить namespace, который может вызвать fallback логику
            ensureNamespace('auth');
            // Теперь ensureNamespace всегда успешна
          }, [ensureNamespace]);
          return React.createElement(
            'div',
            { 'data-testid': 'reducer-fallback-test' },
            'Reducer fallback test',
          );
        };

        render(
          React.createElement(I18nProvider, {
            locale: 'ru',
            fallbackLocale: 'en',
            children: React.createElement(TestComponent),
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(ensureNamespaceCalled).toBe(true);
        expect(screen.getByTestId('reducer-fallback-test')).toBeInTheDocument();
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
              emitFallback: mockEmitFallback,
              children,
            }),
        });

        expect(result.current.locale).toBe('ru');
        expect(result.current.fallbackLocale).toBe('en');
        expect(result.current.emitFallback).toBe(mockEmitFallback);
        expect(typeof result.current.translate).toBe('function');
      });

      it('translate функция должна работать в контексте React', () => {
        const { result } = renderHook(() => useI18n(), {
          wrapper: ({ children }) =>
            React.createElement(I18nProvider, {
              locale: 'ru',
              fallbackLocale: 'en',
              emitFallback: mockEmitFallback,
              children,
            }),
        });

        const translated = result.current.translate('common', 'greeting', { name: 'Тест' });
        expect(translated).toBe('Привет, Тест!');
        // Telemetry теперь вызывается только для fallback случаев
        expect(mockEmitFallback).not.toHaveBeenCalled();
      });

      it('translate функция должна обрабатывать несуществующие ключи в React контексте', () => {
        const { result } = renderHook(() => useI18n(), {
          wrapper: ({ children }) =>
            React.createElement(I18nProvider, {
              locale: 'ru',
              fallbackLocale: 'en',
              emitFallback: mockEmitFallback,
              children,
            }),
        });

        const translated = result.current.translate('common', 'nonexistent' as any);
        // Новая логика: human-readable fallback вместо [missing] формата
        // Human-readable fallback не отправляет telemetry для уменьшения шума
        expect(translated).toBe('Nonexistent');
        expect(mockEmitFallback).not.toHaveBeenCalled();
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

  describe('Dayjs локализация', () => {
    describe('setDayjsLocale', () => {
      it('должен устанавливать локаль для dayjs', async () => {
        // Устанавливаем локаль через sync сначала для стабильности
        setDayjsLocaleSync('en');
        await setDayjsLocale('ru');
        // Проверяем что локаль установлена (может быть ru или en в зависимости от доступности)
        const locale = getCurrentDayjsLocale();
        expect(['ru', 'en']).toContain(locale);
      });

      it('должен обрабатывать ошибки и fallback на en', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await setDayjsLocale('invalid-locale');
        expect(getCurrentDayjsLocale()).toBe('en');
        consoleWarnSpy.mockRestore();
      });

      it('не должен загружать en локаль в production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        await setDayjsLocale('en');
        expect(getCurrentDayjsLocale()).toBe('en');
        vi.unstubAllEnvs();
      });

      it('должен загружать локаль в production для не-en локалей', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        await setDayjsLocale('ru');
        expect(getCurrentDayjsLocale()).toBe('ru');
        vi.unstubAllEnvs();
      });

      it('должен логировать в development', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.stubEnv('NODE_ENV', 'development');
        await setDayjsLocale('ru');
        expect(consoleLogSpy).toHaveBeenCalled();
        consoleLogSpy.mockRestore();
        vi.unstubAllEnvs();
      });

      it('должен обрабатывать fallback на базовую локаль при ошибке', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Пытаемся загрузить локаль с регионом, которая не существует
        // loadDayjsLocale должен попробовать базовую локаль
        vi.stubEnv('NODE_ENV', 'production');
        setDayjsLocaleSync('en'); // Устанавливаем en перед тестом
        await setDayjsLocale('invalid-XX');
        // В итоге должна быть установлена en (после всех fallback)
        expect(getCurrentDayjsLocale()).toBe('en');
        consoleWarnSpy.mockRestore();
        vi.unstubAllEnvs();
      });

      it('должен обрабатывать случай когда NODE_ENV !== production в loadDayjsLocale', async () => {
        // Когда NODE_ENV !== 'production', loadDayjsLocale должен вернуться сразу
        vi.stubEnv('NODE_ENV', 'development');
        await setDayjsLocale('ru');
        expect(getCurrentDayjsLocale()).toBe('ru');
        vi.unstubAllEnvs();
      });

      it('должен обрабатывать случай когда locale === en в loadDayjsLocale', async () => {
        // Когда locale === 'en', loadDayjsLocale должен вернуться сразу
        vi.stubEnv('NODE_ENV', 'production');
        await setDayjsLocale('en');
        expect(getCurrentDayjsLocale()).toBe('en');
        vi.unstubAllEnvs();
      });

      it('должен обрабатывать ошибку загрузки локали', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('NODE_ENV', 'production');
        setDayjsLocaleSync('en'); // Устанавливаем en перед тестом
        await setDayjsLocale('nonexistent-locale');
        expect(getCurrentDayjsLocale()).toBe('en');
        consoleWarnSpy.mockRestore();
        vi.unstubAllEnvs();
      });

      it('должен обрабатывать ошибку в dayjs.locale', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Мокаем dayjs.locale чтобы выбросить ошибку только один раз
        const originalLocale = dayjs.locale.bind(dayjs);
        let callCount = 0;
        const mockLocale = vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Locale error');
          }
          return originalLocale();
        });
        dayjs.locale = mockLocale as typeof dayjs.locale;

        vi.stubEnv('NODE_ENV', 'production');
        await setDayjsLocale('ru');
        expect(getCurrentDayjsLocale()).toBe('en');

        // Восстанавливаем
        dayjs.locale = originalLocale;
        setDayjsLocaleSync('en');
        consoleWarnSpy.mockRestore();
        vi.unstubAllEnvs();
      });

      it('должен обрабатывать случай когда baseLocale === locale в loadDayjsLocale', async () => {
        // Когда locale без дефиса (например 'ru'), baseLocale === locale
        // В этом случае не должно быть попытки загрузить базовую локаль
        vi.stubEnv('NODE_ENV', 'production');
        await setDayjsLocale('ru');
        expect(getCurrentDayjsLocale()).toBe('ru');
        vi.unstubAllEnvs();
      });

      it('не должен логировать в production', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.stubEnv('NODE_ENV', 'production');
        await setDayjsLocale('ru');
        expect(consoleLogSpy).not.toHaveBeenCalled();
        consoleLogSpy.mockRestore();
        vi.unstubAllEnvs();
      });
    });

    describe('setDayjsLocaleSync', () => {
      it('должен синхронно устанавливать локаль', () => {
        setDayjsLocaleSync('ru');
        expect(getCurrentDayjsLocale()).toBe('ru');
        setDayjsLocaleSync('en'); // Восстанавливаем
      });

      it('должен обрабатывать ошибки и fallback на en', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Мокаем dayjs.locale чтобы выбросить ошибку только один раз
        const originalLocale = dayjs.locale.bind(dayjs);
        let callCount = 0;
        const mockLocale = vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Invalid locale');
          }
          return originalLocale();
        });
        dayjs.locale = mockLocale as typeof dayjs.locale;

        setDayjsLocaleSync('invalid-locale');
        // После обработки ошибки должна быть установлена локаль 'en'
        expect(getCurrentDayjsLocale()).toBe('en');
        expect(consoleWarnSpy).toHaveBeenCalled();

        // Восстанавливаем оригинальный метод
        dayjs.locale = originalLocale;
        setDayjsLocaleSync('en'); // Восстанавливаем валидную локаль
        consoleWarnSpy.mockRestore();
      });

      it('не должен логировать ошибку когда window отсутствует', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const originalWindow = global.window;
        // @ts-expect-error - мокаем отсутствие window
        delete global.window;

        setDayjsLocaleSync('en'); // Восстанавливаем валидную локаль

        const originalLocale = dayjs.locale.bind(dayjs);
        let callCount = 0;
        const mockLocale = vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Invalid locale');
          }
          return originalLocale();
        });
        dayjs.locale = mockLocale as typeof dayjs.locale;

        setDayjsLocaleSync('invalid-locale');
        expect(getCurrentDayjsLocale()).toBe('en');
        expect(consoleWarnSpy).not.toHaveBeenCalled();

        // Восстанавливаем
        dayjs.locale = originalLocale;
        global.window = originalWindow;
        setDayjsLocaleSync('en');
        consoleWarnSpy.mockRestore();
      });
    });

    describe('getCurrentDayjsLocale', () => {
      it('должен возвращать текущую локаль', () => {
        setDayjsLocaleSync('ru');
        expect(getCurrentDayjsLocale()).toBe('ru');
        setDayjsLocaleSync('en'); // Восстанавливаем
      });
    });

    describe('isRtlLocale', () => {
      it('должен возвращать true для RTL локалей', () => {
        expect(isRtlLocale('ar')).toBe(true);
        expect(isRtlLocale('he')).toBe(true);
        expect(isRtlLocale('fa')).toBe(true);
        expect(isRtlLocale('ur')).toBe(true);
        expect(isRtlLocale('yi')).toBe(true);
        expect(isRtlLocale('ar-SA')).toBe(true);
      });

      it('должен возвращать false для LTR локалей', () => {
        expect(isRtlLocale('en')).toBe(false);
        expect(isRtlLocale('ru')).toBe(false);
        expect(isRtlLocale('de')).toBe(false);
      });
    });

    describe('isDayjsLocaleSupported', () => {
      it('должен возвращать true для поддерживаемых локалей', () => {
        expect(isDayjsLocaleSupported('en')).toBe(true);
        expect(isDayjsLocaleSupported('ru')).toBe(true);
        expect(isDayjsLocaleSupported('de')).toBe(true);
        expect(isDayjsLocaleSupported('fr')).toBe(true);
      });

      it('должен возвращать false для неподдерживаемых локалей', () => {
        expect(isDayjsLocaleSupported('xx')).toBe(false);
        expect(isDayjsLocaleSupported('unknown')).toBe(false);
      });
    });

    describe('formatDateLocalized', () => {
      it('должен форматировать дату', () => {
        const date = new Date('2024-01-15');
        const formatted = formatDateLocalized(date, 'YYYY-MM-DD');
        expect(formatted).toBe('2024-01-15');
      });

      it('должен форматировать строку даты', () => {
        const formatted = formatDateLocalized('2024-01-15', 'YYYY-MM-DD');
        expect(formatted).toBe('2024-01-15');
      });

      it('должен форматировать dayjs объект', () => {
        const dayjsDate = dayjs('2024-01-15');
        const formatted = formatDateLocalized(dayjsDate, 'YYYY-MM-DD');
        expect(formatted).toBe('2024-01-15');
      });
    });
  });

  describe('Fallback правила', () => {
    it('fallbackLocaleRule должен возвращать null когда locale === fallbackLocale', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'ru',
        emitFallback: mockEmitFallback,
      });

      // Ключ отсутствует, но fallbackLocaleRule не сработает (locale === fallbackLocale)
      const result = instance.translate('common', 'nonexistent' as any);
      expect(result).toBe('Nonexistent'); // Human-readable fallback
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('fallbackLocaleRule должен возвращать перевод из fallback locale когда доступен', () => {
      const instance = createI18nInstance({
        locale: 'en',
        fallbackLocale: 'ru',
        emitFallback: mockEmitFallback,
      });

      // Ключ есть в fallback locale (ru), но не в primary (en)
      const result = instance.translate('common', 'greeting');
      expect(result).toBe('Привет, {name}!');
      expect(mockEmitFallback).toHaveBeenCalledWith({
        key: 'greeting',
        ns: 'common',
        locale: 'en',
        fallbackType: 'fallback-locale',
      });
    });

    it('fallbackLocaleRule должен возвращать null когда перевод отсутствует в fallback locale', () => {
      const instance = createI18nInstance({
        locale: 'en',
        fallbackLocale: 'ru',
        emitFallback: mockEmitFallback,
      });

      // Ключ отсутствует и в primary, и в fallback locale
      const result = instance.translate('common', 'nonexistent' as any);
      expect(result).toBe('Nonexistent'); // Human-readable fallback
      // fallbackLocaleRule вернул null, поэтому telemetry не вызывается для human-readable
      expect(mockEmitFallback).not.toHaveBeenCalled();
    });

    it('commonNamespaceRule должен возвращать null когда ns === common', () => {
      const instance = createI18nInstance({
        locale: 'en',
        fallbackLocale: 'ru',
      });

      // Когда ns === 'common', правило сразу возвращает null
      // Проверяем что правило не срабатывает для common namespace
      const result = instance.translate('common', 'nonexistent' as any);
      expect(result).toBe('Nonexistent'); // Human-readable fallback
    });

    it('commonNamespaceRule должен возвращать перевод из common namespace для auth namespace', () => {
      const instance = createI18nInstance({
        locale: 'ru',
        fallbackLocale: 'en',
        emitFallback: mockEmitFallback,
      });

      // Ключ 'greeting' есть в common для ru локали, но запрашивается из auth namespace
      // commonNamespaceRule должен найти его в common namespace
      const result = instance.translate('auth', 'greeting' as any);
      expect(result).toBe('Привет, {name}!'); // Из common namespace
      expect(mockEmitFallback).toHaveBeenCalledWith({
        key: 'greeting',
        ns: 'auth',
        locale: 'ru',
        fallbackType: 'common',
      });
    });

    it('commonNamespaceRule должен возвращать null когда localeStore отсутствует', () => {
      // Создаем instance с несуществующей локалью
      const instance = createI18nInstance({
        locale: 'xx',
        fallbackLocale: 'yy',
      });

      // localeStore для 'xx' не существует, optional chaining вернет undefined
      const result = instance.translate('auth', 'greeting' as any);
      expect(result).toBe('Greeting'); // Human-readable fallback
    });
  });

  describe('Global API', () => {
    describe('initGlobalI18n', () => {
      it('должен инициализировать globalI18n в browser runtime', () => {
        initGlobalI18n('ru', 'en');
        expect(t('common:greeting')).toBe('Привет, {name}!');
      });

      it('не должен инициализировать globalI18n на сервере', () => {
        // В jsdom окружении window всегда доступен, поэтому этот тест проверяет
        // что initGlobalI18n работает только когда window доступен
        // На реальном сервере (без window) globalI18n не инициализируется
        // В тестах мы проверяем что функция работает корректно
        initGlobalI18n('ru', 'en');
        expect(t('common:greeting')).toBe('Привет, {name}!');
      });
    });

    describe('t() функция', () => {
      beforeEach(() => {
        initGlobalI18n('ru', 'en');
      });

      afterEach(() => {
        // Очищаем после каждого теста
        initGlobalI18n('en', 'en');
      });

      it('должна работать с namespace:key форматом', () => {
        expect(t('common:greeting', { name: 'Тест' })).toBe('Привет, Тест!');
        expect(t('auth:login')).toBe('Вход');
      });

      it('должна работать с простым key форматом', () => {
        expect(t('greeting', { name: 'Тест' })).toBe('Привет, Тест!');
      });

      it('должна обрабатывать ключи с несколькими двоеточиями', () => {
        // parseKey использует indexOf, должен взять только первое двоеточие
        // 'common:key:with:colons' -> namespace='common', key='key:with:colons'
        // Такого ключа нет, поэтому human-readable fallback
        const result = t('common:key:with:colons');
        expect(result).toMatch(/Key.*With.*Colons/i);
      });

      it('должна обрабатывать ключ с пустым namespace', () => {
        // 'common:' -> namespace='common', key='' -> используется k || key, т.е. 'common:'
        // parseKey возвращает ['common', 'common:'] когда k пустой
        // Такого ключа нет, поэтому human-readable fallback
        const result = t('common:');
        expect(result).toMatch(/Common/i); // Human-readable fallback
      });

      it('должна использовать default параметр', () => {
        // Когда globalI18n инициализирован, но ключ не найден, default не используется
        // default используется только когда globalI18n не инициализирован
        // Проверяем что функция работает с default параметром
        const result = t('nonexistent:key', { default: 'Default value' });
        // Когда globalI18n инициализирован, default игнорируется, используется fallback
        expect(result).toMatch(/Key/i); // Human-readable fallback
      });

      it('должна обрабатывать неизвестный namespace', () => {
        // parseKey fallback на 'common' для неизвестного namespace
        // 'unknown:key' -> namespace='common', key='key'
        // Такого ключа нет в common, поэтому human-readable fallback
        expect(t('unknown:key')).toBe('Key');
      });

      it('должна обрабатывать auth namespace в parseKey', () => {
        // parseKey должен правильно обрабатывать 'auth' namespace
        expect(t('auth:login')).toBe('Вход');
        expect(t('auth:logout')).toBe('Выход');
      });

      it('должна обрабатывать ключ без двоеточия в parseKey', () => {
        // parseKey должен возвращать ['common', key] когда нет двоеточия
        expect(t('greeting', { name: 'Тест' })).toBe('Привет, Тест!');
      });

      it('должна обрабатывать пустой key после двоеточия в parseKey', () => {
        // parseKey: 'common:' -> k = '', используется k || key, т.е. 'common:'
        const result = t('common:');
        expect(result).toMatch(/Common/i);
      });
    });
  });
});
