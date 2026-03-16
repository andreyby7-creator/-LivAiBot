/**
 * @vitest-environment jsdom
 * @file Unit тесты для Radio компонента
 */

import { cleanup, fireEvent, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Radio } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

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

// Для целей тестов ослабляем типизацию пропсов Radio
const AnyRadio = Radio as any;

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
    getRadio: () => testContainer.querySelector('input[type="radio"]') as HTMLInputElement,
  };
}

describe('Radio', () => {
  describe('4.1. Рендер и базовая структура', () => {
    it('radio рендерится без падений с минимальными пропсами', () => {
      const { container, getRadio } = renderIsolated(
        React.createElement(AnyRadio, null),
      );

      expect(container).toBeInTheDocument();
      expect(getRadio()).toBeInTheDocument();
    });

    it('создает input элемент с правильными атрибутами по умолчанию', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, null),
      );

      const radio = getRadio();
      expect(radio).toBeInTheDocument();
      expect(radio.tagName).toBe('INPUT');
      expect(radio).toHaveAttribute('type', 'radio');
      expect(radio).toHaveAttribute('data-component', 'CoreRadio');
    });

    it('radio имеет правильный role', () => {
      const { getByRole } = renderIsolated(
        React.createElement(AnyRadio, null),
      );

      expect(getByRole('radio')).toBeInTheDocument();
    });

    it('aria-checked=false по умолчанию для неконтролируемого radio', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, null),
      );

      const radio = getRadio();
      expect(radio).toHaveAttribute('aria-checked', 'false');
    });

    it('aria-checked=true когда checked=true', () => {
      const onChange = vi.fn();
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, { checked: true, onChange }),
      );

      const radio = getRadio();
      expect(radio).toHaveAttribute('aria-checked', 'true');
    });

    it('aria-checked=false когда checked=false', () => {
      const onChange = vi.fn();
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, { checked: false, onChange }),
      );

      const radio = getRadio();
      expect(radio).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('4.2. Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLInputElement>();

      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, { ref }, null),
      );

      const radio = getRadio();
      expect(ref.current).toBe(radio);
    });

    it('useImperativeHandle возвращает правильный элемент', () => {
      const ref = React.createRef<HTMLInputElement>();

      renderIsolated(
        React.createElement(AnyRadio, { ref }, null),
      );

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.tagName).toBe('INPUT');
      expect(ref.current?.type).toBe('radio');
    });

    it('useImperativeHandle возвращает fallback элемент если ref не установлен', () => {
      const ref = React.createRef<HTMLInputElement>();

      // Mock useRef чтобы вернуть null
      const originalUseRef = React.useRef;
      React.useRef = vi.fn(() => ({ current: null }));

      renderIsolated(
        React.createElement(AnyRadio, { ref }, null),
      );

      // Должен вернуть HTMLElement (document.createElement('input'))
      expect(ref.current).toBeInstanceOf(HTMLElement);
      expect(ref.current?.tagName).toBe('INPUT');

      React.useRef = originalUseRef;
    });
  });

  describe('4.3. Пропсы пробрасываются', () => {
    it('стандартные HTML пропсы пробрасываются корректно', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, {
          id: 'test-radio',
          name: 'testName',
          className: 'test-class',
          disabled: true,
          required: true,
          checked: true,
          value: 'test-value',
        }),
      );

      const radio = getRadio();
      expect(radio).toHaveAttribute('id', 'test-radio');
      expect(radio).toHaveAttribute('name', 'testName');
      expect(radio).toHaveAttribute('class', 'test-class');
      expect(radio).toBeDisabled();
      expect(radio).toHaveAttribute('required');
      expect(radio).toBeChecked();
      expect(radio).toHaveAttribute('value', 'test-value');
    });

    it('autoFocus пропс не пробрасывается в DOM (reserved)', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, { autoFocus: true }),
      );

      const radio = getRadio();
      expect(radio).not.toHaveAttribute('autoFocus');
    });

    it('data-component всегда присутствует', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, null),
      );

      expect(getRadio()).toHaveAttribute('data-component', 'CoreRadio');
    });

    it('aria-busy=true когда disabled=true', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, { disabled: true }),
      );

      const radio = getRadio();
      expect(radio).toHaveAttribute('aria-busy', 'true');
    });

    it('aria-busy отсутствует когда disabled=false или undefined', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, null),
      );

      const radio = getRadio();
      expect(radio).not.toHaveAttribute('aria-busy');
    });
  });

  describe('4.4. autoFocus поведение', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      window.HTMLElement.prototype.focus = mockFocus;
    });

    it('autoFocus=true фокусирует radio один раз с preventScroll', () => {
      const { rerender } = renderIsolated(
        React.createElement(AnyRadio, { autoFocus: true }),
      );

      vi.runAllTimers();

      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });

      // Повторный рендер не вызывает focus снова
      rerender(
        React.createElement(AnyRadio, { autoFocus: true }),
      );
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus=false (по умолчанию) не фокусирует', () => {
      renderIsolated(
        React.createElement(AnyRadio, null),
      );
      vi.runAllTimers();

      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('autoFocus блокируется hasFocusedRef в StrictMode (покрытие ветки)', () => {
      const { rerender } = renderIsolated(
        React.createElement(AnyRadio, { autoFocus: true }),
      );

      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);

      // Симуляция StrictMode поведения
      rerender(
        React.createElement(AnyRadio, { autoFocus: true }),
      );
      vi.runAllTimers();
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus не падает если ref не доступен', () => {
      // Mock для случая когда ref еще не установлен
      const originalUseRef = React.useRef;
      const mockUseRef = vi.fn(() => ({ current: null }));
      React.useRef = mockUseRef;

      expect(() => {
        renderIsolated(
          React.createElement(AnyRadio, { autoFocus: true }),
        );
        vi.runAllTimers();
      }).not.toThrow();

      React.useRef = originalUseRef;
    });

    it('autoFocus очищает timeout при unmount', () => {
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

      const { unmount } = renderIsolated(
        React.createElement(AnyRadio, { autoFocus: true }),
      );

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('4.5. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const onChange = vi.fn();
      const { container, rerender } = renderIsolated(
        React.createElement(AnyRadio, { id: 'stable', checked: true, onChange }),
      );

      const firstRender = container.innerHTML;

      rerender(
        React.createElement(AnyRadio, { id: 'stable', checked: true, onChange }),
      );

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      const renderSpy = vi.fn(() => React.createElement(AnyRadio, null));
      const Component = React.memo(renderSpy);

      const { rerender } = render(React.createElement(Component));

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(React.createElement(Component));

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4.6. Event handlers', () => {
    it('стандартные event handlers пробрасываются', () => {
      const onChange = vi.fn();
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, { onChange, onFocus, onBlur }),
      );

      const radio = getRadio();

      fireEvent.click(radio);
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.focus(radio);
      expect(onFocus).toHaveBeenCalledTimes(1);

      fireEvent.blur(radio);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('onChange получает event с правильными данными', () => {
      const onChange = vi.fn();

      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, { onChange }),
      );

      const radio = getRadio();
      fireEvent.click(radio);

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('4.7. Edge cases', () => {
    it('работает с undefined пропсами', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, {
          title: undefined,
          disabled: undefined,
          checked: undefined,
          autoFocus: false,
        }),
      );

      const radio = getRadio();
      expect(radio).toBeInTheDocument();
      expect(radio).not.toHaveAttribute('title');
      expect(radio).not.toBeDisabled();
    });

    it('работает с отсутствующими пропсами', () => {
      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, null),
      );

      const radio = getRadio();
      expect(radio).toBeInTheDocument();
      expect(radio).not.toHaveAttribute('title');
      expect(radio).not.toBeDisabled();
    });

    it('поддерживает все стандартные input атрибуты', () => {
      const onChange = vi.fn();

      const { getRadio } = renderIsolated(
        React.createElement(AnyRadio, {
          onChange,
          defaultChecked: true,
          form: 'test-form',
          tabIndex: 1,
          'aria-label': 'Test radio',
        }),
      );

      const radio = getRadio();
      expect(radio).toHaveAttribute('form', 'test-form');
      expect(radio).toHaveAttribute('tabindex', '1');
      expect(radio).toHaveAttribute('aria-label', 'Test radio');
    });

    it('checked состояние синхронизируется с DOM', () => {
      const onChange = vi.fn();
      const { getRadio, rerender } = renderIsolated(
        React.createElement(AnyRadio, { checked: true, onChange }),
      );

      const radio = getRadio();
      expect(radio).toBeChecked();

      rerender(
        React.createElement(AnyRadio, { checked: false, onChange }),
      );
      expect(radio).not.toBeChecked();

      rerender(
        React.createElement(AnyRadio, { checked: true, onChange }),
      );
      expect(radio).toBeChecked();
    });
  });
});
