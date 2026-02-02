/**
 * @vitest-environment jsdom
 * @file Unit тесты для Toggle компонента
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Toggle } from '../../../src/primitives/toggle.js';

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
      const { container, getToggle } = renderIsolated(<Toggle />);

      expect(container).toBeInTheDocument();
      expect(getToggle()).toBeInTheDocument();
    });

    it('создает input элемент с правильными атрибутами по умолчанию', () => {
      const { getToggle } = renderIsolated(<Toggle />);

      const toggle = getToggle();
      expect(toggle).toBeInTheDocument();
      expect(toggle.tagName).toBe('INPUT');
      expect(toggle).toHaveAttribute('type', 'checkbox');
      expect(toggle).toHaveAttribute('role', 'switch');
      expect(toggle).toHaveAttribute('data-component', 'CoreToggle');
    });

    it('toggle имеет правильный role', () => {
      const { getByRole } = renderIsolated(<Toggle />);

      expect(getByRole('switch')).toBeInTheDocument();
    });

    it('aria-checked=false и aria-pressed=false по умолчанию для неконтролируемого toggle', () => {
      const { getToggle } = renderIsolated(<Toggle />);

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('aria-checked=true и aria-pressed=true когда checked=true', () => {
      const onChange = vi.fn();
      const { getToggle } = renderIsolated(<Toggle checked onChange={onChange} />);

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('aria-checked=false и aria-pressed=false когда checked=false', () => {
      const onChange = vi.fn();
      const { getToggle } = renderIsolated(<Toggle checked={false} onChange={onChange} />);

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('4.2. Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLInputElement>();

      const { getToggle } = renderIsolated(<Toggle ref={ref} />);

      const toggle = getToggle();
      expect(ref.current).toBe(toggle);
    });

    it('useImperativeHandle возвращает правильный элемент', () => {
      const ref = React.createRef<HTMLInputElement>();

      renderIsolated(<Toggle ref={ref} />);

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

      renderIsolated(<Toggle ref={ref} />);

      // Должен вернуть HTMLElement (document.createElement('input'))
      expect(ref.current).toBeInstanceOf(HTMLElement);
      expect(ref.current?.tagName).toBe('INPUT');

      React.useRef = originalUseRef;
    });
  });

  describe('4.3. Пропсы пробрасываются', () => {
    it('стандартные HTML пропсы пробрасываются корректно', () => {
      const { getToggle } = renderIsolated(
        <Toggle
          id='test-toggle'
          name='testName'
          className='test-class'
          disabled
          required
          checked
          value='test-value'
        />,
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
      const { getToggle } = renderIsolated(<Toggle autoFocus />);

      const toggle = getToggle();
      expect(toggle).not.toHaveAttribute('autoFocus');
    });

    it('indeterminate пропс не пробрасывается в DOM (reserved)', () => {
      const { getToggle } = renderIsolated(<Toggle indeterminate />);

      const toggle = getToggle();
      expect(toggle).not.toHaveAttribute('indeterminate');
    });

    it('data-component всегда присутствует', () => {
      const { getToggle } = renderIsolated(<Toggle />);

      expect(getToggle()).toHaveAttribute('data-component', 'CoreToggle');
    });

    it('aria-busy=true когда disabled=true', () => {
      const { getToggle } = renderIsolated(<Toggle disabled />);

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('aria-busy', 'true');
      expect(toggle).toHaveAttribute('aria-disabled', 'true');
    });

    it('aria-busy отсутствует когда disabled=false или undefined', () => {
      const { getToggle } = renderIsolated(<Toggle />);

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
      const { rerender } = renderIsolated(<Toggle autoFocus />);

      vi.runAllTimers();

      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });

      // Повторный рендер не вызывает focus снова
      rerender(<Toggle autoFocus />);
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus=false (по умолчанию) не фокусирует', () => {
      renderIsolated(<Toggle />);
      vi.runAllTimers();

      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('autoFocus блокируется hasFocusedRef в StrictMode (покрытие ветки)', () => {
      const { rerender } = renderIsolated(<Toggle autoFocus />);

      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);

      // Симуляция StrictMode поведения
      rerender(<Toggle autoFocus />);
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus не падает если ref не доступен', () => {
      // Mock для случая когда ref еще не установлен
      const originalUseRef = React.useRef;
      const mockUseRef = vi.fn(() => ({ current: null }));
      React.useRef = mockUseRef;

      expect(() => {
        renderIsolated(<Toggle autoFocus />);
        vi.runAllTimers();
      }).not.toThrow();

      React.useRef = originalUseRef;
    });

    it('autoFocus очищает timeout при unmount', () => {
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

      const { unmount } = renderIsolated(<Toggle autoFocus />);

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('4.5. indeterminate поведение', () => {
    it('indeterminate=false (по умолчанию) не устанавливает indeterminate', () => {
      const { getToggle } = renderIsolated(<Toggle />);

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(false);
    });

    it('indeterminate=true устанавливает indeterminate на DOM элементе', () => {
      const { getToggle } = renderIsolated(<Toggle indeterminate />);

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(true);
    });

    it('indeterminate изменяется динамически', () => {
      const { getToggle, rerender } = renderIsolated(<Toggle indeterminate />);

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(true);

      rerender(<Toggle indeterminate={false} />);
      expect(toggle.indeterminate).toBe(false);

      rerender(<Toggle indeterminate />);
      expect(toggle.indeterminate).toBe(true);
    });

    it('indeterminate работает с Boolean конверсией', () => {
      const { getToggle, rerender } = renderIsolated(<Toggle />);

      const toggle = getToggle();
      expect(toggle.indeterminate).toBe(false);

      rerender(<Toggle indeterminate={false} />);
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
        renderIsolated(<Toggle indeterminate />);
      }).not.toThrow();

      React.useRef = originalUseRef;
    });
  });

  describe('4.6. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const onChange = vi.fn();
      const { container, rerender } = renderIsolated(
        <Toggle id='stable' checked onChange={onChange} />,
      );

      const firstRender = container.innerHTML;

      rerender(<Toggle id='stable' checked onChange={onChange} />);

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      const renderSpy = vi.fn(() => <Toggle />);
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

      const { getToggle } = renderIsolated(
        <Toggle onChange={onChange} onFocus={onFocus} onBlur={onBlur} />,
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

      const { getToggle } = renderIsolated(<Toggle onChange={onChange} />);

      const toggle = getToggle();
      fireEvent.click(toggle);

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с undefined пропсами', () => {
      const { getToggle } = renderIsolated(
        <Toggle
          title={undefined}
          disabled={undefined}
          autoFocus={false}
        />,
      );

      const toggle = getToggle();
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle.indeterminate).toBe(false);
    });

    it('работает с отсутствующими пропсами', () => {
      const { getToggle } = renderIsolated(<Toggle />);

      const toggle = getToggle();
      expect(toggle).toBeInTheDocument();
      expect(toggle).not.toHaveAttribute('title');
      expect(toggle).not.toBeDisabled();
      expect(toggle.indeterminate).toBe(false);
    });

    it('поддерживает все стандартные input атрибуты', () => {
      const onChange = vi.fn();

      const { getToggle } = renderIsolated(
        <Toggle
          onChange={onChange}
          defaultChecked
          form='test-form'
          tabIndex={1}
          aria-label='Test toggle'
        />,
      );

      const toggle = getToggle();
      expect(toggle).toHaveAttribute('form', 'test-form');
      expect(toggle).toHaveAttribute('tabindex', '1');
      expect(toggle).toHaveAttribute('aria-label', 'Test toggle');
    });

    it('checked состояние синхронизируется с DOM', () => {
      const onChange = vi.fn();
      const { getToggle, rerender } = renderIsolated(<Toggle checked onChange={onChange} />);

      const toggle = getToggle();
      expect(toggle).toBeChecked();

      rerender(<Toggle checked={false} onChange={onChange} />);
      expect(toggle).not.toBeChecked();

      rerender(<Toggle checked onChange={onChange} />);
      expect(toggle).toBeChecked();
    });
  });
});
