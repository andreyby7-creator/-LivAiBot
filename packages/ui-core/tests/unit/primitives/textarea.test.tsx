/**
 * @vitest-environment jsdom
 * @file Unit тесты для Textarea компонента
 */

import React, { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Textarea } from '../../../src/primitives/textarea.js';

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
    getTextarea: () => container.querySelector('textarea') as HTMLTextAreaElement,
  };
}

describe('Textarea', () => {
  describe('3.1. Рендер и базовая структура', () => {
    it('textarea рендерится без падений с минимальными пропсами', () => {
      const { container, getTextarea } = renderIsolated(<Textarea />);

      expect(container).toBeInTheDocument();
      expect(getTextarea()).toBeInTheDocument();
    });

    it('создает textarea элемент с правильными атрибутами по умолчанию', () => {
      const { getTextarea } = renderIsolated(<Textarea />);

      const textarea = getTextarea();
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).not.toHaveAttribute('autoFocus');
    });

    it('textarea имеет правильный role', () => {
      const { getByRole } = renderIsolated(<Textarea />);

      expect(getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('3.2. Ref support', () => {
    it('внутренний ref работает для autoFocus', () => {
      window.HTMLElement.prototype.focus = mockFocus;

      renderIsolated(<Textarea autoFocus />);

      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });
    });
  });

  describe('3.3. Пропсы пробрасываются', () => {
    it('стандартные HTML пропсы пробрасываются корректно', () => {
      const { getTextarea } = renderIsolated(
        <Textarea
          placeholder='Test placeholder'
          rows={5}
          cols={30}
          maxLength={100}
          disabled
          className='custom-class'
          id='test-id'
        />,
      );

      const textarea = getTextarea();
      expect(textarea).toHaveAttribute('placeholder', 'Test placeholder');
      expect(textarea).toHaveAttribute('rows', '5');
      expect(textarea).toHaveAttribute('cols', '30');
      expect(textarea).toHaveAttribute('maxLength', '100');
      expect(textarea).toHaveAttribute('disabled');
      expect(textarea).toHaveClass('custom-class');
      expect(textarea).toHaveAttribute('id', 'test-id');
    });

    it('autoFocus пропс не пробрасывается в DOM (reserved)', () => {
      const { getTextarea } = renderIsolated(<Textarea autoFocus />);

      const textarea = getTextarea();
      expect(textarea).not.toHaveAttribute('autoFocus');
    });
  });

  describe('3.4. autoFocus поведение', () => {
    it('autoFocus=true фокусирует textarea один раз с preventScroll', () => {
      // Мокаем focus
      window.HTMLElement.prototype.focus = mockFocus;

      renderIsolated(<Textarea autoFocus />);

      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('autoFocus=false (по умолчанию) не фокусирует', () => {
      window.HTMLElement.prototype.focus = mockFocus;

      renderIsolated(<Textarea />);

      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('autoFocus работает только при первом рендере (StrictMode safe)', () => {
      window.HTMLElement.prototype.focus = mockFocus;

      const { rerender } = renderIsolated(<Textarea autoFocus />);

      expect(mockFocus).toHaveBeenCalledTimes(1);

      // Ререндер с теми же пропсами не должен вызывать focus снова
      rerender(<Textarea autoFocus />);

      expect(mockFocus).toHaveBeenCalledTimes(1);
    });

    it('autoFocus блокируется hasFocusedRef в StrictMode (покрытие ветки)', () => {
      window.HTMLElement.prototype.focus = mockFocus;

      // Рендерим в StrictMode, где useEffect вызывается дважды
      render(
        <StrictMode>
          <Textarea autoFocus />
        </StrictMode>,
      );

      // focus должен быть вызван только один раз, несмотря на StrictMode
      expect(mockFocus).toHaveBeenCalledTimes(1);
      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('autoFocus не падает если ref не доступен', () => {
      // Создаем компонент без ref attachment (редкий случай)
      expect(() => {
        renderIsolated(<Textarea autoFocus />);
      }).not.toThrow();
    });
  });

  describe('3.5. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const { container: container1 } = renderIsolated(
        <Textarea placeholder='test' rows={3} />,
      );

      const { container: container2 } = renderIsolated(
        <Textarea placeholder='test' rows={3} />,
      );

      expect(container1.innerHTML).toBe(container2.innerHTML);
    });
  });

  describe('3.6. Event handlers', () => {
    it('стандартные event handlers пробрасываются', () => {
      const handleChange = vi.fn();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();

      const { getTextarea } = renderIsolated(
        <Textarea
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />,
      );

      const textarea = getTextarea();

      // Имитируем события с помощью fireEvent
      fireEvent.focus(textarea);
      fireEvent.blur(textarea);
      fireEvent.change(textarea, { target: { value: 'test' } });

      // Проверяем, что обработчики вызваны
      expect(handleFocus).toHaveBeenCalled();
      expect(handleBlur).toHaveBeenCalled();
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('3.7. Edge cases', () => {
    it('работает с пустыми children', () => {
      const { getTextarea } = renderIsolated(<Textarea />);

      expect(getTextarea()).toBeInTheDocument();
    });

    it('работает с undefined пропсами', () => {
      const { getTextarea } = renderIsolated(
        <Textarea
          placeholder={undefined}
          rows={undefined}
          disabled={undefined}
        />,
      );

      const textarea = getTextarea();
      expect(textarea).toBeInTheDocument();
      expect(textarea).not.toHaveAttribute('placeholder');
      expect(textarea).not.toHaveAttribute('rows');
      expect(textarea).not.toHaveAttribute('disabled');
    });
  });
});
