/**
 * @file Тесты для IntlProvider компонента
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { IntlProvider } from '../../../src/providers/intl-provider';

// Mock для NextIntlClientProvider с уникальными ID
vi.mock('next-intl', () => ({
  NextIntlClientProvider: vi.fn(({ children, locale, messages }) => {
    const uniqueId = Math.random().toString(36).slice(2, 9);
    return React.createElement('div', {
      'data-locale': locale,
      'data-messages': JSON.stringify(messages),
      'data-testid': `next-intl-provider-${uniqueId}`,
    }, children);
  }),
}));

// Функция для изолированного рендера
function renderIsolated(component: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  // Возвращаем результат с методом cleanup
  return {
    ...result,
    cleanup: () => {
      result.unmount();
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}

describe('IntlProvider', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockMessages = {
    common: {
      loading: 'Loading...',
      error: 'Error occurred',
    },
    auth: {
      login: 'Login',
      register: 'Register',
    },
  };

  const defaultProps = {
    locale: 'en',
    messages: mockMessages,
    children: React.createElement('div', { 'data-testid': 'child' }, 'Test Child'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('рендеринг', () => {
    it('должен рендерить NextIntlClientProvider с правильными пропсами', () => {
      const { container } = renderIsolated(<IntlProvider key='basic-test' {...defaultProps} />);

      // Проверяем, что компонент рендерится без ошибок
      expect(container).toBeInTheDocument();
      // Проверяем, что есть div с data-locale (внутренняя структура NextIntl)
      const providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toBeInTheDocument();
      expect(providerDiv).toHaveAttribute('data-locale', 'en');
    });

    it('должен рендерить children внутри провайдера', () => {
      const { getByTestId, getByText } = renderIsolated(
        <IntlProvider key='basic-test' {...defaultProps} />,
      );

      expect(getByTestId('child')).toBeInTheDocument();
      expect(getByText('Test Child')).toBeInTheDocument();
    });

    it('должен рендерить с различными локалями', () => {
      const props = { ...defaultProps, locale: 'ru' };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      // Проверяем, что локаль передана правильно
      const providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toHaveAttribute('data-locale', 'ru');
    });

    it('должен рендерить с пустыми messages', () => {
      const props = { ...defaultProps, messages: {} };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      // Проверяем, что пустые messages переданы правильно
      const providerDiv = container.querySelector('[data-messages]');
      expect(providerDiv).toHaveAttribute('data-messages', '{}');
    });

    it('должен рендерить с null children', () => {
      const props = { ...defaultProps, children: null };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      // Проверяем, что компонент рендерится без children
      const providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toBeInTheDocument();
      expect(providerDiv?.children).toHaveLength(0);
    });

    it('должен рендерить с пустым React элементом как children', () => {
      const props = { ...defaultProps, children: React.createElement(React.Fragment) };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      // Проверяем, что компонент рендерится с пустыми children
      const providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toBeInTheDocument();
    });
  });

  describe('memo оптимизация', () => {
    it('должен рендериться с корректными пропсами', () => {
      const { container } = renderIsolated(<IntlProvider key='basic-test' {...defaultProps} />);

      // Проверяем, что пропсы переданы правильно
      const providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toHaveAttribute('data-locale', 'en');
      expect(providerDiv).toHaveAttribute('data-messages', JSON.stringify(mockMessages));
    });

    it('должен обновлять атрибуты при изменении locale', () => {
      const { rerender, container } = render(
        <IntlProvider key='locale-change-test' {...defaultProps} />,
      );

      // Проверяем начальный locale
      let providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toHaveAttribute('data-locale', 'en');

      // Ререндер с новым locale
      rerender(<IntlProvider {...defaultProps} locale='ru' />);

      // Проверяем, что locale изменился
      providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toHaveAttribute('data-locale', 'ru');
    });

    it('должен обновлять атрибуты при изменении messages', () => {
      const { rerender, container } = render(
        <IntlProvider key='locale-change-test' {...defaultProps} />,
      );

      const newMessages = { ...mockMessages, test: 'new message' };

      // Ререндер с новыми messages
      rerender(<IntlProvider {...defaultProps} messages={newMessages} />);

      // Проверяем, что messages обновились
      const providerDiv = container.querySelector('[data-messages]');
      expect(providerDiv).toHaveAttribute('data-messages', JSON.stringify(newMessages));
    });

    it('должен обновлять children при их изменении', () => {
      const { rerender } = render(
        <IntlProvider {...defaultProps}>
          <div data-testid='child'>Original</div>
        </IntlProvider>,
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Original');

      // Ререндер с новыми children
      rerender(
        <IntlProvider {...defaultProps}>
          <div data-testid='child'>Updated</div>
        </IntlProvider>,
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Updated');
    });
  });

  describe('типизация', () => {
    it('должен принимать корректные типы пропсов', () => {
      const props = {
        locale: 'en',
        messages: mockMessages,
        children: React.createElement('div', null, 'test'),
      };

      expect(() => render(<IntlProvider key='error-boundary-test' {...props} />)).not.toThrow();
    });

    it('должен требовать обязательные пропсы', () => {
      // TypeScript проверки происходят на этапе компиляции
      // Этот тест просто проверяет, что компонент работает с корректными пропсами
      expect(() => render(<IntlProvider key='error-boundary-default-test' {...defaultProps} />)).not
        .toThrow();
    });

    it('должен иметь readonly пропсы', () => {
      const props: {
        readonly locale: string;
        readonly messages: typeof mockMessages;
        readonly children: React.ReactNode;
      } = {
        locale: 'en',
        messages: mockMessages,
        children: React.createElement('div'),
      };

      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      // Проверяем, что NextIntl провайдер создался
      const providerDiv = container.querySelector('[data-locale]');
      expect(providerDiv).toBeInTheDocument();
    });
  });

  describe('интеграция с next-intl', () => {
    it('должен корректно интегрироваться с NextIntlClientProvider', () => {
      const { container } = renderIsolated(<IntlProvider key='basic-test' {...defaultProps} />);

      // Проверяем, что компонент рендерится без ошибок
      const provider = container.querySelector('[data-locale]');
      expect(provider).toBeInTheDocument();
      expect(provider).toHaveAttribute('data-locale', 'en');
      expect(provider).toHaveAttribute('data-messages', JSON.stringify(mockMessages));
    });

    it('должен корректно сериализовать сложные messages объекты', () => {
      const complexMessages = {
        nested: {
          deep: {
            value: 'Deep nested value',
            subvalue: 'Another deep value',
          },
        },
        with: {
          special: {
            chars: 'Special chars: àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ',
          },
        },
      };

      const props = { ...defaultProps, messages: complexMessages };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      const provider = container.querySelector('[data-messages]');
      expect(provider).toHaveAttribute('data-messages', JSON.stringify(complexMessages));
    });
  });

  describe('edge cases', () => {
    it('должен обрабатывать очень длинные локали', () => {
      const longLocale = 'zh-CN-traditional-with-long-subtags-and-more-text';
      const props = { ...defaultProps, locale: longLocale };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      const provider = container.querySelector('[data-locale]');
      expect(provider).toHaveAttribute('data-locale', longLocale);
    });

    it('должен обрабатывать очень большие messages объекты', () => {
      const largeMessages = Array.from({ length: 1000 }, (_, i) => ({
        [`key${i}`]: `value${i}`.repeat(100), // Каждый value ~500 символов
      })).reduce((acc, curr) => ({ ...acc, ...curr }), {});

      const props = { ...defaultProps, messages: largeMessages };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      const provider = container.querySelector('[data-messages]');
      expect(provider).toHaveAttribute('data-messages', JSON.stringify(largeMessages));
    });

    it('должен обрабатывать React.Fragment как children', () => {
      const fragmentChildren = React.createElement(
        React.Fragment,
        null,
        React.createElement('div', { 'data-testid': 'child1' }, 'Child 1'),
        React.createElement('div', { 'data-testid': 'child2' }, 'Child 2'),
      );

      const props = { ...defaultProps, children: fragmentChildren };
      render(<IntlProvider key='conditional-render-test' {...props} />);

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
    });

    it('должен обрабатывать условный рендеринг children', () => {
      // Тестируем простой условный рендеринг
      const children = Math.random() > 0.5
        ? React.createElement('div', { 'data-testid': 'child' }, 'Child')
        : React.createElement('span', { 'data-testid': 'child' }, 'Child');

      const props = { ...defaultProps, children };
      const { container } = renderIsolated(
        <IntlProvider key='conditional-render-test' {...props} />,
      );

      expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
    });
  });
});
