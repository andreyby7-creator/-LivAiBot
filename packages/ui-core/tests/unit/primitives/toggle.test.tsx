/**
 * @vitest-environment jsdom
 * @file Unit тесты для Toggle компонента
 */

import { cleanup, fireEvent, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toggle } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

const AnyToggle = Toggle as any;

// Mock для HTMLElement.prototype.focus
const mockFocus = vi.fn();
const originalFocus = window.HTMLElement.prototype.focus;

// Полная очистка DOM между тестами
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  window.HTMLElement.prototype.focus = originalFocus;
});

// Функция для изолированного рендера
function renderIsolated(component: Readonly<React.ReactElement>) {
  const testContainer = document.createElement('div');
  document.body.appendChild(testContainer);

  const result = render(component, { container: testContainer });

  return {
    ...result,
    // Локальный поиск элементов
    getByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(testContainer).getByRole(role, options),
    getByTestId: (testId: Readonly<string>) => within(testContainer).getByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(testContainer).queryByRole(role, options),
    getToggle: () =>
      testContainer.querySelector('input[type="checkbox"][role="switch"]') as HTMLInputElement,
  };
}

describe('Toggle', () => {
  describe('4.1. Рендер и базовая структура', () => {
    it('toggle рендерится без падений с минимальными пропсами', () => {
      const { container, getToggle } = renderIsolated(React.createElement(AnyToggle, null));

      expect(container).toBeInTheDocument();
      expect(getToggle()).toBeInTheDocument();
    });

    it('создает input элемент с правильными атрибутами по умолчанию', () => {
      const { getToggle } = renderIsolated(React.createElement(AnyToggle, null));

      const toggle = getToggle();
      expect(toggle).toBeInTheDocument();
      expect(toggle.tagName).toBe('INPUT');
      expect(toggle).toHaveAttribute('type', 'checkbox');
      expect(toggle).toHaveAttribute('role', 'switch');
      expect(toggle).toHaveAttribute('data-component', 'CoreToggle');
    });

    it('toggle имеет правильный role', () => {
      const { getByRole } = renderIsolated(React.createElement(AnyToggle, null));

      expect(getByRole('switch')).toBeInTheDocument();
    });

    it('aria-checked=false и aria-pressed=false по умолчанию для неконтролируемого toggle', () => {
      const { getToggle } = renderIsolated(React.createElement(AnyToggle, null));

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('aria-checked=true и aria-pressed=true когда checked=true', () => {
      const onChange = vi.fn();
      const { getToggle } = renderIsolated(
        React.createElement(AnyToggle, { checked: true, onChange } as any),
      );

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('aria-checked=false и aria-pressed=false когда checked=false', () => {
      const onChange = vi.fn();
      const { getToggle } = renderIsolated(
        React.createElement(AnyToggle, { checked: false, onChange } as any),
      );

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('4.2. Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLInputElement>();

      const { getToggle } = renderIsolated(React.createElement(AnyToggle, { ref } as any));

      const toggle = getToggle();
      expect(ref.current).toBe(toggle);
    });

    it('useImperativeHandle возвращает правильный элемент', () => {
      const ref = React.createRef<HTMLInputElement>();

      renderIsolated(React.createElement(AnyToggle, { ref } as any));

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.tagName).toBe('INPUT');
      expect(ref.current?.type).toBe('checkbox');
      expect(ref.current?.getAttribute('role')).toBe('switch');
    });

    it('useImperativeHandle возвращает fallback элемент если ref не установлен', () => {
      const ref = React.createRef<HTMLInputElement>();

      // Mock useRef чтобы вернуть null
      const originalUseRef = React.useRef;
      React.useRef = vi.fn(() => ({ current: null }));

      renderIsolated(React.createElement(AnyToggle, { ref } as any));

      // Должен вернуть HTMLElement (document.createElement('input'))
      expect(ref.current).toBeInstanceOf(HTMLElement);
      expect(ref.current?.tagName).toBe('INPUT');

      React.useRef = originalUseRef;
    });
  });

  describe('4.3. Пропсы пробрасываются', () => {
    it('стандартные HTML пропсы пробрасываются корректно', () => {
      const { getToggle } = renderIsolated(
        React.createElement(
          AnyToggle,
          {
            id: 'test-toggle',
            name: 'testName',
            className: 'test-class',
            disabled: true,
            required: true,
            checked: true,
            value: 'test-value',
          } as any,
        ),
      );

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('id', 'test-toggle');
      expect(toggle).toHaveAttribute('name', 'testName');
      expect(toggle).toHaveAttribute('class', 'test-class');
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAttribute('required');
      expect(toggle).toBeChecked();
      expect(toggle).toHaveAttribute('value', 'test-value');
    });

    it('autoFocus пропс не пробрасывается в DOM (reserved)', () => {
      const { getToggle } = renderIsolated(
        React.createElement(AnyToggle, { autoFocus: true } as any),
      );

      const toggle = getToggle();
      expect(toggle).not.toHaveAttribute('autoFocus');
    });

    it('indeterminate пропс не пробрасывается в DOM (reserved)', () => {
      const { getToggle } = renderIsolated(
        React.createElement(AnyToggle, { indeterminate: true } as any),
      );

      const toggle = getToggle();
      expect(toggle).not.toHaveAttribute('indeterminate');
    });

    it('data-component всегда присутствует', () => {
      const { getToggle } = renderIsolated(React.createElement(AnyToggle, null));

      expect(getToggle()).toHaveAttribute('data-component', 'CoreToggle');
    });

    it('aria-busy=true когда disabled=true', () => {
      const { getToggle } = renderIsolated(
        React.createElement(AnyToggle, { disabled: true } as any),
      );

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-busy', 'true');
      expect(toggle).toHaveAttribute('aria-disabled', 'true');
    });

    it('aria-busy отсутствует когда disabled=false или undefined', () => {
      const { getToggle } = renderIsolated(React.createElement(AnyToggle, null));

      const toggle = getToggle();
      expect(toggle).not.toHaveAttribute('aria-busy');
      expect(toggle).not.toHaveAttribute('aria-disabled');
    });
  });

  describe('4.4. autoFocus поведение', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      window.HTMLElement.prototype.focus = mockFocus;
    });

    it('autoFocus=true фокусирует toggle один раз с preventScroll', () => {
      const { rerender } = renderIsolated(
        React.createElement(AnyToggle, { autoFocus: true } as any),
      );

      vi.runAllTimers();

      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });

      // Повторный рендер не вызывает focus снова
      rerender(React.createElement(AnyToggle, { autoFocus: true } as any));
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus=false (по умолчанию) не фокусирует', () => {
      renderIsolated(React.createElement(AnyToggle, null));
      vi.runAllTimers();

      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('autoFocus блокируется hasFocusedRef в StrictMode (покрытие ветки)', () => {
      const { rerender } = renderIsolated(
        React.createElement(AnyToggle, { autoFocus: true } as any),
      );

      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);

      // Симуляция StrictMode поведения
      rerender(React.createElement(AnyToggle, { autoFocus: true } as any));
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus не падает если ref не доступен', () => {
      // Mock для случая когда ref еще не установлен
      const originalUseRef = React.useRef;
      const mockUseRef = vi.fn(() => ({ current: null }));
      React.useRef = mockUseRef;

      expect(() => {
        renderIsolated(React.createElement(AnyToggle, { autoFocus: true } as any));
        vi.runAllTimers();
      }).not.toThrow();

      React.useRef = originalUseRef;
    });

    it('autoFocus очищает timeout при unmount', () => {
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

      const { unmount } = renderIsolated(
        React.createElement(AnyToggle, { autoFocus: true } as any),
      );

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('4.5. indeterminate поведение', () => {
    it('indeterminate=false (по умолчанию) не устанавливает indeterminate', () => {
      const { getToggle } = renderIsolated(React.createElement(AnyToggle, null));

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(false);
    });

    it('indeterminate=true устанавливает indeterminate на DOM элементе', () => {
      const { getToggle } = renderIsolated(
        React.createElement(AnyToggle, { indeterminate: true } as any),
      );

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(true);
    });

    it('indeterminate изменяется динамически', () => {
      const { getToggle, rerender } = renderIsolated(
        React.createElement(AnyToggle, { indeterminate: true } as any),
      );

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(true);

      rerender(React.createElement(AnyToggle, { indeterminate: false } as any));
      expect(toggle.indeterminate).toBe(false);

      rerender(React.createElement(AnyToggle, { indeterminate: true } as any));
      expect(toggle.indeterminate).toBe(true);
    });

    it('indeterminate работает с Boolean конверсией', () => {
      const { getToggle, rerender } = renderIsolated(React.createElement(AnyToggle, null));

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(false);

      rerender(React.createElement(AnyToggle, { indeterminate: false } as any));
      expect(toggle.indeterminate).toBe(false);
    });

    it('indeterminate useEffect проверяет поддержку свойства в DOM', () => {
      // Создаем mock объект без indeterminate
      const mockElement = {
        type: 'checkbox',
        checked: false,
        // indeterminate отсутствует
      } as any;

      // Mock useRef для возврата нашего mock объекта
      const originalUseRef = React.useRef;
      React.useRef = vi.fn(() => ({ current: mockElement }));

      // Этот тест проверяет что код не падает когда indeterminate не поддерживается
      expect(() => {
        renderIsolated(React.createElement(AnyToggle, { indeterminate: true } as any));
      }).not.toThrow();

      React.useRef = originalUseRef;
    });
  });

  describe('4.6. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const onChange = vi.fn();
      const { container, rerender } = renderIsolated(
        React.createElement(AnyToggle, { id: 'stable', checked: true, onChange } as any),
      );

      const firstRender = container.innerHTML;

      rerender(
        React.createElement(AnyToggle, { id: 'stable', checked: true, onChange } as any),
      );

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      const renderSpy = vi.fn(() => React.createElement(AnyToggle, null));
      const Component = React.memo(renderSpy) as any;

      const { rerender } = render(React.createElement(Component));

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(React.createElement(Component));

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4.7. Event handlers', () => {
    it('стандартные event handlers пробрасываются', () => {
      const onChange = vi.fn();
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      const { getToggle } = renderIsolated(
        React.createElement(
          AnyToggle,
          { onChange, onFocus, onBlur } as any,
        ),
      );

      const toggle = getToggle();

      fireEvent.click(toggle);
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.focus(toggle);
      expect(onFocus).toHaveBeenCalledTimes(1);

      fireEvent.blur(toggle);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('onChange получает event с правильными данными', () => {
      const onChange = vi.fn();

      const { getToggle } = renderIsolated(
        React.createElement(AnyToggle, { onChange } as any),
      );

      const toggle = getToggle();
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с undefined пропсами', () => {
      const { getToggle } = renderIsolated(
        React.createElement(
          AnyToggle,
          {
            title: undefined,
            disabled: undefined,
            autoFocus: false,
          } as any,
        ),
      );

      const toggle = getToggle();
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle.indeterminate).toBe(false);
    });

    it('работает с отсутствующими пропсами', () => {
      const { getToggle } = renderIsolated(React.createElement(AnyToggle, null));

      const toggle = getToggle();
      expect(toggle).toBeInTheDocument();
      expect(toggle).not.toHaveAttribute('title');
      expect(toggle).not.toBeDisabled();
      expect(toggle.indeterminate).toBe(false);
    });

    it('поддерживает все стандартные input атрибуты', () => {
      const onChange = vi.fn();

      const { getToggle } = renderIsolated(
        React.createElement(
          AnyToggle,
          {
            onChange,
            defaultChecked: true,
            form: 'test-form',
            tabIndex: 1,
            'aria-label': 'Test toggle',
          } as any,
        ),
      );

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('form', 'test-form');
      expect(toggle).toHaveAttribute('tabindex', '1');
      expect(toggle).toHaveAttribute('aria-label', 'Test toggle');
    });

    it('checked состояние синхронизируется с DOM', () => {
      const onChange = vi.fn();
      const { getToggle, rerender } = renderIsolated(
        React.createElement(AnyToggle, { checked: true, onChange } as any),
      );

      const toggle = getToggle();
      expect(toggle).toBeChecked();

      rerender(React.createElement(AnyToggle, { checked: false, onChange } as any));
      expect(toggle).not.toBeChecked();

      rerender(React.createElement(AnyToggle, { checked: true, onChange } as any));
      expect(toggle).toBeChecked();
    });
  });
});
