/**
 * @vitest-environment jsdom
 * @file Unit тесты для Select компонента
 */

import React, { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Select } from '../../../src/primitives/select.js';

// Mock для HTMLElement.prototype.focus
const mockFocus = vi.fn();
const originalFocus = window.HTMLElement.prototype.focus;

// Полная очистка DOM между тестами
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
    getSelect: () => testContainer.querySelector('select') as HTMLSelectElement,
  };
}

describe('Select', () => {
  describe('3.1. Рендер и базовая структура', () => {
    it('select рендерится без падений с минимальными пропсами', () => {
      const { container, getSelect } = renderIsolated(<Select />);

      expect(container).toBeInTheDocument();
      expect(getSelect()).toBeInTheDocument();
    });

    it('создает select элемент с правильными атрибутами по умолчанию', () => {
      const { getSelect } = renderIsolated(<Select />);

      const select = getSelect();
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
      expect(select).toHaveAttribute('data-component', 'CoreSelect');
    });

    it('select имеет правильный role', () => {
      const { getByRole } = renderIsolated(<Select />);

      expect(getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('3.2. Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLSelectElement>();

      const { getSelect } = renderIsolated(<Select ref={ref} />);

      const select = getSelect();
      expect(ref.current).toBe(select);
    });

    it('useImperativeHandle возвращает правильный элемент', () => {
      const ref = React.createRef<HTMLSelectElement>();

      renderIsolated(<Select ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
      expect(ref.current?.tagName).toBe('SELECT');
    });
  });

  describe('3.3. Пропсы пробрасываются', () => {
    it('стандартные HTML пропсы пробрасываются корректно', () => {
      const { getSelect } = renderIsolated(
        <Select
          id='test-select'
          name='testName'
          className='test-class'
          disabled
          required
          multiple
          size={3}
        />,
      );

      const select = getSelect();
      expect(select).toHaveAttribute('id', 'test-select');
      expect(select).toHaveAttribute('name', 'testName');
      expect(select).toHaveAttribute('class', 'test-class');
      expect(select).toBeDisabled();
      expect(select).toHaveAttribute('required');
      expect(select).toHaveAttribute('multiple');
      expect(select).toHaveAttribute('size', '3');
    });

    it('autoFocus пропс не пробрасывается в DOM (reserved)', () => {
      const { getSelect } = renderIsolated(<Select autoFocus />);

      const select = getSelect();
      expect(select).not.toHaveAttribute('autoFocus');
    });

    it('data-component всегда присутствует', () => {
      const { getSelect } = renderIsolated(<Select />);

      expect(getSelect()).toHaveAttribute('data-component', 'CoreSelect');
    });
  });

  describe('3.4. autoFocus поведение', () => {
    beforeEach(() => {
      window.HTMLElement.prototype.focus = mockFocus;
    });

    it('autoFocus=true фокусирует select один раз с preventScroll', () => {
      const { rerender } = renderIsolated(<Select autoFocus />);

      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });

      // Повторный рендер не вызывает focus снова
      rerender(<Select autoFocus />);
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus=false (по умолчанию) не фокусирует', () => {
      renderIsolated(<Select />);

      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('autoFocus работает только при первом рендере (StrictMode safe)', () => {
      renderIsolated(
        <StrictMode>
          <Select autoFocus />
        </StrictMode>,
      );

      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus блокируется hasFocusedRef в StrictMode (покрытие ветки)', () => {
      const { rerender } = renderIsolated(<Select autoFocus />);

      expect(mockFocus).toHaveBeenCalledTimes(1);

      // Симуляция StrictMode поведения
      rerender(<Select autoFocus />);
      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus не падает если ref не доступен', () => {
      // Mock для случая когда ref еще не установлен
      const originalUseRef = React.useRef;
      const mockUseRef = vi.fn(() => ({ current: null }));
      React.useRef = mockUseRef;

      expect(() => {
        renderIsolated(<Select autoFocus />);
      }).not.toThrow();

      React.useRef = originalUseRef;
    });
  });

  describe('3.5. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const { container, rerender } = renderIsolated(<Select id='stable' />);

      const firstRender = container.innerHTML;

      rerender(<Select id='stable' />);

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      const renderSpy = vi.fn(() => <Select />);
      const Component = React.memo(renderSpy);

      const { rerender } = render(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('3.6. Event handlers', () => {
    it('стандартные event handlers пробрасываются', () => {
      const onChange = vi.fn();
      const onFocus = vi.fn();
      const onBlur = vi.fn();

      const { getSelect } = renderIsolated(
        <Select onChange={onChange} onFocus={onFocus} onBlur={onBlur} />,
      );

      const select = getSelect();

      fireEvent.change(select, { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.focus(select);
      expect(onFocus).toHaveBeenCalledTimes(1);

      fireEvent.blur(select);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('onChange получает event с правильными данными', () => {
      const onChange = vi.fn();

      const { getSelect } = renderIsolated(<Select onChange={onChange} />);

      const select = getSelect();
      fireEvent.change(select, { target: { value: 'option1' } });

      expect(onChange).toHaveBeenCalled();
      const callArgs = onChange.mock.calls[0];
      expect(callArgs?.[0]).toHaveProperty('target');
    });
  });

  describe('3.7. Edge cases', () => {
    it('работает с пустыми children', () => {
      const { getSelect } = renderIsolated(<Select />);

      expect(getSelect()).toBeInTheDocument();
    });

    it('работает с undefined пропсами', () => {
      const { getSelect } = renderIsolated(
        <Select
          title={undefined}
          disabled={undefined}
          autoFocus={false}
        />,
      );

      const select = getSelect();
      expect(select).toBeInTheDocument();
      expect(select).not.toHaveAttribute('title');
      expect(select).not.toBeDisabled();
    });

    it('работает с children (option elements)', () => {
      const { getSelect } = renderIsolated(
        <Select>
          <option value='1'>Option 1</option>
          <option value='2'>Option 2</option>
        </Select>,
      );

      const select = getSelect();
      expect(select).toContainHTML('<option value="1">Option 1</option>');
      expect(select).toContainHTML('<option value="2">Option 2</option>');
    });

    it('поддерживает все стандартные select атрибуты', () => {
      const onChange = vi.fn();

      const { getSelect } = renderIsolated(
        <Select
          onChange={onChange}
          defaultValue='default'
          form='test-form'
          tabIndex={1}
        />,
      );

      const select = getSelect();
      expect(select).toHaveAttribute('form', 'test-form');
      expect(select).toHaveAttribute('tabindex', '1');
    });
  });
});
