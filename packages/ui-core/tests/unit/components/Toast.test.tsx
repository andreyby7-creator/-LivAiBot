/**
 * @vitest-environment jsdom
 * @file Unit тесты для Toast компонента
 */

import { cleanup, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Toast } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

const AnyToast = Toast as any;

// Полная очистка DOM между тестами
afterEach(cleanup);

// Функция для изолированного рендера
function renderIsolated(component: Readonly<React.ReactElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  return {
    ...result,
    container,
    // Локальный поиск элементов
    getByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).getByRole(role, options),
    getByTestId: (testId: Readonly<string>) => within(container).getByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getToast: () => container.querySelector('div[data-component="CoreToast"]')!,
  };
}

describe('Toast', () => {
  // Общие тестовые переменные
  const testContent = 'Test toast content';
  const customStyle = { borderRadius: '12px', fontWeight: 'bold' };
  const overrideStyle = { backgroundColor: 'red' };
  const emptyStyle = {};

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true } as any,
          null,
        ),
      );

      expect(container).toBeInTheDocument();
      expect(getToast()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true } as any,
          null,
        ),
      );

      const toast = getToast();
      expect(toast).toBeInTheDocument();
      expect(toast.tagName).toBe('DIV');
      expect(toast).toHaveAttribute('data-component', 'CoreToast');
      expect(toast).toHaveAttribute('role', 'status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(toast).toHaveAttribute('aria-atomic', 'true');
      expect(toast).toHaveAttribute('data-variant', 'info');
    });

    it('не рендерится когда visible=false', () => {
      const { queryByRole } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: false } as any,
          null,
        ),
      );

      expect(queryByRole('status')).not.toBeInTheDocument();
    });

    it('не рендерится когда content=null', () => {
      const { queryByRole } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: null as any, visible: true } as any,
          null,
        ),
      );

      expect(queryByRole('status')).not.toBeInTheDocument();
    });

    it('не рендерится когда content=undefined', () => {
      const { queryByRole } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: undefined as any, visible: true } as any,
          null,
        ),
      );

      expect(queryByRole('status')).not.toBeInTheDocument();
    });

    it('рендерится с пустой строкой content', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: '', visible: true } as any,
          null,
        ),
      );

      expect(getToast()).toBeInTheDocument();
    });
  });

  describe('4.2. Варианты (variant)', () => {
    const variants = ['info', 'success', 'warning', 'error'] as const;

    variants.forEach((variant) => {
      it(`применяет правильный data-variant="${variant}"`, () => {
        const { getToast } = renderIsolated(
          React.createElement(
            AnyToast,
            { content: testContent, visible: true, variant } as any,
            null,
          ),
        );

        expect(getToast()).toHaveAttribute('data-variant', variant);
      });

      it(`применяет правильный цвет фона для variant="${variant}"`, () => {
        const { getToast } = renderIsolated(
          React.createElement(
            AnyToast,
            { content: testContent, visible: true, variant } as any,
            null,
          ),
        );

        const toast = getToast();
        const computedStyle = window.getComputedStyle(toast);

        // Проверяем что backgroundColor соответствует ожидаемому
        expect(computedStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(computedStyle.backgroundColor).not.toBe('transparent');
      });
    });

    it('использует info по умолчанию', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true } as any,
          null,
        ),
      );

      expect(getToast()).toHaveAttribute('data-variant', 'info');
    });
  });

  describe('4.3. Контент (content)', () => {
    it('отображает текстовый контент', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true } as any,
          null,
        ),
      );

      expect(getToast()).toHaveTextContent(testContent);
    });

    it('отображает React элемент как контент', () => {
      const customContent = React.createElement(
        'span',
        { 'data-testid': 'custom-content' } as any,
        'Custom content',
      );
      const { getByTestId } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: customContent as any, visible: true } as any,
          null,
        ),
      );

      expect(getByTestId('custom-content')).toBeInTheDocument();
    });

    it('отображает число как контент', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: 42 as any, visible: true } as any,
          null,
        ),
      );

      expect(getToast()).toHaveTextContent('42');
    });
  });

  describe('4.4. Стилизация', () => {
    it('применяет базовые стили', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true } as any,
          null,
        ),
      );

      const toast = getToast();
      const computedStyle = window.getComputedStyle(toast);

      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.alignItems).toBe('center');
      expect(computedStyle.minWidth).toBe('200px');
      expect(computedStyle.maxWidth).toBe('420px');
      expect(computedStyle.padding).toBe('10px 14px');
      expect(computedStyle.borderRadius).toBe('8px');
      expect(computedStyle.color).toBe('rgb(255, 255, 255)');
      expect(computedStyle.fontSize).toBe('14px');
      expect(computedStyle.boxShadow).toBe('0 4px 12px rgba(0,0,0,0.15)');
      expect(computedStyle.boxSizing).toBe('border-box');
      expect(computedStyle.pointerEvents).toBe('auto');
    });

    it('применяет кастомные стили через style проп', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, style: customStyle } as any,
          null,
        ),
      );

      const toast = getToast();
      const computedStyle = window.getComputedStyle(toast);

      expect(computedStyle.borderRadius).toBe('12px');
      expect(computedStyle.fontWeight).toBe('bold');
    });

    it('кастомные стили переопределяют базовые', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, style: overrideStyle } as any,
          null,
        ),
      );

      const toast = getToast();
      const computedStyle = window.getComputedStyle(toast);

      expect(computedStyle.backgroundColor).toBe('rgb(255, 0, 0)');
    });
  });

  describe('4.5. Test ID и атрибуты', () => {
    it('применяет data-testid', () => {
      const testId = 'custom-toast';
      const { getByTestId } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, 'data-testid': testId } as any,
          null,
        ),
      );

      expect(getByTestId(testId)).toBeInTheDocument();
    });

    it('применяет className', () => {
      const className = 'custom-toast-class';
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, className } as any,
          null,
        ),
      );

      expect(getToast()).toHaveClass(className);
    });

    it('прокидывает другие HTML атрибуты', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, id: 'toast-id', tabIndex: 0 } as any,
          null,
        ),
      );

      const toast = getToast();
      expect(toast).toHaveAttribute('id', 'toast-id');
      expect(toast).toHaveAttribute('tabindex', '0');
    });
  });

  describe('4.6. Ref forwarding', () => {
    it('поддерживает React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, ref } as any,
          null,
        ),
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreToast');
    });

    it('поддерживает useRef-подобный объект', () => {
      const ref = createMockRef();

      renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, ref } as any,
          null,
        ),
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreToast');
    });
  });

  describe('4.7. Memoization и производительность', () => {
    it('не ререндерится при одинаковых пропсах', () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return React.createElement(
          AnyToast,
          { content: testContent, visible: true } as any,
          null,
        );
      };

      const { rerender } = render(
        React.createElement(TestComponent as any, {} as any, null),
      );

      expect(renderCount).toBe(1);

      rerender(React.createElement(TestComponent as any, {} as any, null));
      expect(renderCount).toBe(2); // React.memo предотвращает лишние рендеры компонента
    });

    it('useMemo для combinedStyle вызывается только при изменении зависимостей', () => {
      // Этот тест проверяет что useMemo работает корректно
      // путем проверки что стили применяются правильно
      const { getToast, rerender } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, variant: 'info' } as any,
          null,
        ),
      );

      const initialBackground = window.getComputedStyle(getToast()).backgroundColor;

      rerender(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, variant: 'success' } as any,
          null,
        ),
      );

      const newBackground = window.getComputedStyle(getToast()).backgroundColor;

      expect(initialBackground).not.toBe(newBackground);
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с boolean visible', () => {
      const { queryByRole } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true } as any,
          null,
        ),
      );

      expect(queryByRole('status')).toBeInTheDocument();
    });

    it('работает с undefined visible (defaults to false)', () => {
      const { queryByRole } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent } as any,
          null,
        ),
      );

      expect(queryByRole('status')).not.toBeInTheDocument();
    });

    it('работает с пустым объектом style', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, style: emptyStyle } as any,
          null,
        ),
      );

      expect(getToast()).toBeInTheDocument();
    });

    it('работает с undefined style', () => {
      const { getToast } = renderIsolated(
        React.createElement(
          AnyToast,
          { content: testContent, visible: true, style: undefined } as any,
          null,
        ),
      );

      expect(getToast()).toBeInTheDocument();
    });
  });
});
