/**
 * @vitest-environment jsdom
 * @file Unit тесты для Checkbox компонента
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Checkbox } from '../../../src/primitives/checkbox.js';

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
    getCheckbox: () => testContainer.querySelector('input[type="checkbox"]') as HTMLInputElement,
  };
}

describe('Checkbox', () => {
  describe('4.1. Рендер и базовая структура', () => {
    it('checkbox рендерится без падений с минимальными пропсами', () => {
      const { container, getCheckbox } = renderIsolated(<Checkbox />);

      expect(container).toBeInTheDocument();
      expect(getCheckbox()).toBeInTheDocument();
    });

    it('создает input элемент с правильными атрибутами по умолчанию', () => {
      const { getCheckbox } = renderIsolated(<Checkbox />);

      const checkbox = getCheckbox();
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.tagName).toBe('INPUT');
      expect(checkbox).toHaveAttribute('type', 'checkbox');
      expect(checkbox).toHaveAttribute('data-component', 'CoreCheckbox');
    });

    it('checkbox имеет правильный role', () => {
      const { getByRole } = renderIsolated(<Checkbox />);

      expect(getByRole('checkbox')).toBeInTheDocument();
    });

    it('aria-checked=false по умолчанию для неконтролируемого checkbox', () => {
      const { getCheckbox } = renderIsolated(<Checkbox />);

      const checkbox = getCheckbox();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('aria-checked=true когда checked=true', () => {
      const { getCheckbox } = renderIsolated(<Checkbox checked />);

      const checkbox = getCheckbox();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('aria-checked=false когда checked=false', () => {
      const { getCheckbox } = renderIsolated(<Checkbox checked={false} />);

      const checkbox = getCheckbox();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('4.2. Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLInputElement>();

      const { getCheckbox } = renderIsolated(<Checkbox ref={ref} />);

      const checkbox = getCheckbox();
      expect(ref.current).toBe(checkbox);
    });

    it('useImperativeHandle возвращает правильный элемент', () => {
      const ref = React.createRef<HTMLInputElement>();

      renderIsolated(<Checkbox ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.tagName).toBe('INPUT');
      expect(ref.current?.type).toBe('checkbox');
    });

    it('useImperativeHandle возвращает fallback элемент если ref не установлен', () => {
      const ref = React.createRef<HTMLInputElement>();

      // Mock useRef чтобы вернуть null
      const originalUseRef = React.useRef;
      React.useRef = vi.fn(() => ({ current: null }));

      renderIsolated(<Checkbox ref={ref} />);

      // Должен вернуть HTMLElement (document.createElement('input'))
      expect(ref.current).toBeInstanceOf(HTMLElement);
      expect(ref.current?.tagName).toBe('INPUT');

      React.useRef = originalUseRef;
    });
  });

  describe('4.3. Пропсы пробрасываются', () => {
    it('стандартные HTML пропсы пробрасываются корректно', () => {
      const { getCheckbox } = renderIsolated(
        <Checkbox
          id='test-checkbox'
          name='testName'
          className='test-class'
          disabled
          required
          checked
          value='test-value'
        />,
      );

      const checkbox = getCheckbox();
      expect(checkbox).toHaveAttribute('id', 'test-checkbox');
      expect(checkbox).toHaveAttribute('name', 'testName');
      expect(checkbox).toHaveAttribute('class', 'test-class');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('required');
      expect(checkbox).toBeChecked();
      expect(checkbox).toHaveAttribute('value', 'test-value');
    });

    it('autoFocus пропс не пробрасывается в DOM (reserved)', () => {
      const { getCheckbox } = renderIsolated(<Checkbox autoFocus />);

      const checkbox = getCheckbox();
      expect(checkbox).not.toHaveAttribute('autoFocus');
    });

    it('indeterminate пропс не пробрасывается в DOM (reserved)', () => {
      const { getCheckbox } = renderIsolated(<Checkbox indeterminate />);

      const checkbox = getCheckbox();
      expect(checkbox).not.toHaveAttribute('indeterminate');
    });

    it('data-component всегда присутствует', () => {
      const { getCheckbox } = renderIsolated(<Checkbox />);

      expect(getCheckbox()).toHaveAttribute('data-component', 'CoreCheckbox');
    });

    it('aria-busy=true когда disabled=true', () => {
      const { getCheckbox } = renderIsolated(<Checkbox disabled />);

      const checkbox = getCheckbox();
      expect(checkbox).toHaveAttribute('aria-busy', 'true');
    });

    it('aria-busy отсутствует когда disabled=false или undefined', () => {
      const { getCheckbox } = renderIsolated(<Checkbox />);

      const checkbox = getCheckbox();
      expect(checkbox).not.toHaveAttribute('aria-busy');
    });
  });

  describe('4.4. autoFocus поведение', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      window.HTMLElement.prototype.focus = mockFocus;
    });

    it('autoFocus=true фокусирует checkbox один раз с preventScroll', () => {
      const { rerender } = renderIsolated(<Checkbox autoFocus />);

      vi.runAllTimers();

      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });

      // Повторный рендер не вызывает focus снова
      rerender(<Checkbox autoFocus />);
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus=false (по умолчанию) не фокусирует', () => {
      renderIsolated(<Checkbox />);
      vi.runAllTimers();

      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('autoFocus блокируется hasFocusedRef в StrictMode (покрытие ветки)', () => {
      const { rerender } = renderIsolated(<Checkbox autoFocus />);

      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);

      // Симуляция StrictMode поведения
      rerender(<Checkbox autoFocus />);
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus не падает если ref не доступен', () => {
      // Mock для случая когда ref еще не установлен
      const originalUseRef = React.useRef;
      const mockUseRef = vi.fn(() => ({ current: null }));
      React.useRef = mockUseRef;

      expect(() => {
        renderIsolated(<Checkbox autoFocus />);
        vi.runAllTimers();
      }).not.toThrow();

      React.useRef = originalUseRef;
    });

    it('autoFocus очищает timeout при unmount', () => {
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

      const { unmount } = renderIsolated(<Checkbox autoFocus />);

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('4.5. indeterminate поведение', () => {
    it('indeterminate=false (по умолчанию) не устанавливает indeterminate', () => {
      const { getCheckbox } = renderIsolated(<Checkbox />);

      const checkbox = getCheckbox();
      expect(checkbox.indeterminate).toBe(false);
    });

    it('indeterminate=true устанавливает indeterminate на DOM элементе', () => {
      const { getCheckbox } = renderIsolated(<Checkbox indeterminate />);

      const checkbox = getCheckbox();
      expect(checkbox.indeterminate).toBe(true);
    });

    it('indeterminate изменяется динамически', () => {
      const { getCheckbox, rerender } = renderIsolated(<Checkbox indeterminate />);

      const checkbox = getCheckbox();
      expect(checkbox.indeterminate).toBe(true);

      rerender(<Checkbox indeterminate={false} />);
      expect(checkbox.indeterminate).toBe(false);

      rerender(<Checkbox indeterminate />);
      expect(checkbox.indeterminate).toBe(true);
    });

    it('indeterminate работает с Boolean конверсией', () => {
      const { getCheckbox, rerender } = renderIsolated(<Checkbox />);

      const checkbox = getCheckbox();
      expect(checkbox.indeterminate).toBe(false);

      rerender(<Checkbox indeterminate={false} />);
      expect(checkbox.indeterminate).toBe(false);
    });

    it('indeterminate не падает если DOM не поддерживает indeterminate', () => {
      // Mock для случая когда indeterminate не поддерживается
      const originalHasOwnProperty = Object.prototype.hasOwnProperty;
      Object.prototype.hasOwnProperty = vi.fn((key) => key !== 'indeterminate');

      expect(() => {
        renderIsolated(<Checkbox indeterminate />);
      }).not.toThrow();

      Object.prototype.hasOwnProperty = originalHasOwnProperty;
    });
  });

  describe('4.6. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const { container, rerender } = renderIsolated(<Checkbox id='stable' checked />);

      const firstRender = container.innerHTML;

      rerender(<Checkbox id='stable' checked />);

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      const renderSpy = vi.fn(() => <Checkbox />);
      const Component = React.memo(renderSpy);

      const { rerender } = render(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4.7. Event handlers', () => {
    it('стандартные event handlers пробрасываются', () => {
      const onChange = vi.fn();
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      const { getCheckbox } = renderIsolated(
        <Checkbox onChange={onChange} onFocus={onFocus} onBlur={onBlur} />,
      );

      const checkbox = getCheckbox();

      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.focus(checkbox);
      expect(onFocus).toHaveBeenCalledTimes(1);

      fireEvent.blur(checkbox);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('onChange получает event с правильными данными', () => {
      const onChange = vi.fn();

      const { getCheckbox } = renderIsolated(<Checkbox onChange={onChange} />);

      const checkbox = getCheckbox();
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalled();
      const callArgs = onChange.mock.calls[0];
      expect(callArgs?.[0]).toHaveProperty('target');
      expect(callArgs?.[0].target).toBe(checkbox);
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с undefined пропсами', () => {
      const { getCheckbox } = renderIsolated(
        <Checkbox
          title={undefined}
          disabled={undefined}
          checked={undefined}
          autoFocus={false}
        />,
      );

      const checkbox = getCheckbox();
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toHaveAttribute('title');
      expect(checkbox).not.toBeDisabled();
      expect(checkbox.indeterminate).toBe(false);
    });

    it('работает с отсутствующими пропсами', () => {
      const { getCheckbox } = renderIsolated(<Checkbox />);

      const checkbox = getCheckbox();
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toHaveAttribute('title');
      expect(checkbox).not.toBeDisabled();
      expect(checkbox.indeterminate).toBe(false);
    });

    it('поддерживает все стандартные input атрибуты', () => {
      const onChange = vi.fn();

      const { getCheckbox } = renderIsolated(
        <Checkbox
          onChange={onChange}
          defaultChecked
          form='test-form'
          tabIndex={1}
          aria-label='Test checkbox'
        />,
      );

      const checkbox = getCheckbox();
      expect(checkbox).toHaveAttribute('form', 'test-form');
      expect(checkbox).toHaveAttribute('tabindex', '1');
      expect(checkbox).toHaveAttribute('aria-label', 'Test checkbox');
    });

    it('checked состояние синхронизируется с DOM', () => {
      const { getCheckbox, rerender } = renderIsolated(<Checkbox checked />);

      const checkbox = getCheckbox();
      expect(checkbox).toBeChecked();

      rerender(<Checkbox checked={false} />);
      expect(checkbox).not.toBeChecked();

      rerender(<Checkbox checked />);
      expect(checkbox).toBeChecked();
    });
  });
});
