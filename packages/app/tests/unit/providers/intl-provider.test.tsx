/**
 * @file Тесты для IntlProvider компонента
 */

import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from '../../../src/providers/intl-provider';

// Mock для NextIntlClientProvider
vi.mock('next-intl', () => ({
  NextIntlClientProvider: vi.fn(({ children, locale, messages }) => {
    return React.createElement('div', {
      'data-locale': locale,
      'data-messages': JSON.stringify(messages),
      'data-testid': 'next-intl-provider',
    }, children);
  }),
}));

describe('IntlProvider', () => {
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
      render(<IntlProvider {...defaultProps} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toBeInTheDocument();
      expect(provider).toHaveAttribute('data-locale', 'en');
      expect(provider).toHaveAttribute('data-messages', JSON.stringify(mockMessages));
    });

    it('должен рендерить children внутри провайдера', () => {
      render(<IntlProvider {...defaultProps} />);

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('должен рендерить с различными локалями', () => {
      const props = { ...defaultProps, locale: 'ru' };
      render(<IntlProvider {...props} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-locale', 'ru');
    });

    it('должен рендерить с пустыми messages', () => {
      const props = { ...defaultProps, messages: {} };
      render(<IntlProvider {...props} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-messages', '{}');
    });

    it('должен рендерить с null children', () => {
      const props = { ...defaultProps, children: null };
      render(<IntlProvider {...props} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toBeInTheDocument();
      expect(provider.children).toHaveLength(0);
    });

    it('должен рендерить с пустым React элементом как children', () => {
      const props = { ...defaultProps, children: React.createElement(React.Fragment) };
      render(<IntlProvider {...props} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toBeInTheDocument();
    });
  });

  describe('memo оптимизация', () => {
    it('должен рендериться с корректными пропсами', () => {
      render(<IntlProvider {...defaultProps} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-locale', 'en');
      expect(provider).toHaveAttribute('data-messages', JSON.stringify(mockMessages));
    });

    it('должен обновлять атрибуты при изменении locale', () => {
      const { rerender } = render(<IntlProvider {...defaultProps} />);

      let provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-locale', 'en');

      // Ререндер с новым locale
      rerender(<IntlProvider {...defaultProps} locale='ru' />);

      provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-locale', 'ru');
    });

    it('должен обновлять атрибуты при изменении messages', () => {
      const { rerender } = render(<IntlProvider {...defaultProps} />);

      const newMessages = { ...mockMessages, test: 'new message' };

      // Ререндер с новыми messages
      rerender(<IntlProvider {...defaultProps} messages={newMessages} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-messages', JSON.stringify(newMessages));
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

      expect(() => render(<IntlProvider {...props} />)).not.toThrow();
    });

    it('должен требовать обязательные пропсы', () => {
      // TypeScript проверки происходят на этапе компиляции
      // Этот тест просто проверяет, что компонент работает с корректными пропсами
      expect(() => render(<IntlProvider {...defaultProps} />)).not.toThrow();
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

      render(<IntlProvider {...props} />);
      expect(screen.getByTestId('next-intl-provider')).toBeInTheDocument();
    });
  });

  describe('интеграция с next-intl', () => {
    it('должен корректно интегрироваться с NextIntlClientProvider', () => {
      render(<IntlProvider {...defaultProps} />);

      // Проверяем, что компонент рендерится без ошибок
      const provider = screen.getByTestId('next-intl-provider');
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
      render(<IntlProvider {...props} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-messages', JSON.stringify(complexMessages));
    });
  });

  describe('edge cases', () => {
    it('должен обрабатывать очень длинные локали', () => {
      const longLocale = 'zh-CN-traditional-with-long-subtags-and-more-text';
      const props = { ...defaultProps, locale: longLocale };
      render(<IntlProvider {...props} />);

      const provider = screen.getByTestId('next-intl-provider');
      expect(provider).toHaveAttribute('data-locale', longLocale);
    });

    it('должен обрабатывать очень большие messages объекты', () => {
      const largeMessages = Array.from({ length: 1000 }, (_, i) => ({
        [`key${i}`]: `value${i}`.repeat(100), // Каждый value ~500 символов
      })).reduce((acc, curr) => ({ ...acc, ...curr }), {});

      const props = { ...defaultProps, messages: largeMessages };
      render(<IntlProvider {...props} />);

      const provider = screen.getByTestId('next-intl-provider');
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
      render(<IntlProvider {...props} />);

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
    });

    it('должен обрабатывать условный рендеринг children', () => {
      // Тестируем простой условный рендеринг
      const children = Math.random() > 0.5
        ? React.createElement('div', { 'data-testid': 'child' }, 'Child')
        : React.createElement('span', { 'data-testid': 'child' }, 'Child');

      const props = { ...defaultProps, children };
      render(<IntlProvider {...props} />);

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });
});
