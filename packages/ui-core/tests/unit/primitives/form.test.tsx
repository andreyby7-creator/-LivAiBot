/**
 * @vitest-environment jsdom
 * @file Unit тесты для Form компонента
 */

import { cleanup, fireEvent, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Form } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

// Полная очистка DOM между тестами
afterEach(cleanup);

// Для целей тестов ослабляем типизацию пропсов Form
const AnyForm = Form as any;

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
    getByText: (text: Readonly<string | RegExp>) => within(container).getByText(text),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getForm: () => container.querySelector('form') as HTMLFormElement,
  };
}

describe('Form', () => {
  describe('1.1. Рендер и базовая структура', () => {
    it('рендерится без падений с минимальными пропсами', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(container).toBeInTheDocument();
      expect(container.querySelector('form')).toBeInTheDocument();
    });

    it('создает form элемент с правильными атрибутами', () => {
      const { getForm } = renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('input', { type: 'text', name: 'test' }),
        ),
      );

      const form = getForm();
      expect(form).toBeInTheDocument();
      expect(form).toHaveAttribute('noValidate');
    });

    it('пробрасывает остальные HTML пропсы', () => {
      const { getForm } = renderIsolated(
        React.createElement(
          AnyForm,
          { id: 'test-form', className: 'custom-class', 'data-testid': 'form' },
          React.createElement('div', null, 'Content'),
        ),
      );

      const form = getForm();
      expect(form).toHaveAttribute('id', 'test-form');
      expect(form).toHaveClass('custom-class');
      expect(form).toHaveAttribute('data-testid', 'form');
    });

    it('рендерит children внутри формы', () => {
      const { getByText } = renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('button', { type: 'submit' }, 'Submit'),
          React.createElement('p', null, 'Form content'),
        ),
      );

      expect(getByText('Submit')).toBeInTheDocument();
      expect(getByText('Form content')).toBeInTheDocument();
    });
  });

  describe('1.2. SSR safety', () => {
    it('рендерится в браузере (window доступен)', () => {
      // Убеждаемся что window доступен
      expect(typeof window).not.toBe('undefined');

      const { container } = renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('div', null, 'Content'),
        ),
      );

      expect(container.querySelector('form')).toBeInTheDocument();
    });
  });

  describe('1.3. Focus management', () => {
    it('autoFocus=true (по умолчанию) фокусирует первый интерактивный элемент', async () => {
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('input', {
            type: 'text',
            name: 'first',
            'data-testid': 'first-input',
          }),
          React.createElement('button', { type: 'submit' }, 'Submit'),
        ),
      );

      const input = getByRole('textbox');
      // useEffect выполняется асинхронно, проверяем что фокус установлен
      expect(document.activeElement).toBe(input);
    });

    it('autoFocus=false не фокусирует элементы', () => {
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyForm,
          { autoFocus: false },
          React.createElement('input', { type: 'text', name: 'first' }),
          React.createElement('button', { type: 'submit' }, 'Submit'),
        ),
      );

      const input = getByRole('textbox');
      // Фокус не должен быть на input
      expect(document.activeElement).not.toBe(input);
    });

    it('autoFocus с preventScroll=true предотвращает скролл', () => {
      // Мокаем focus с preventScroll
      const mockFocus = vi.fn();
      HTMLElement.prototype.focus = mockFocus;

      renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('input', { type: 'text', name: 'first' }),
        ),
      );

      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('autoFocus игнорируется если нет интерактивных элементов', () => {
      // useEffect не должен падать если нет интерактивных элементов
      expect(() => {
        renderIsolated(
          React.createElement(
            AnyForm,
            null,
            React.createElement('div', null, 'Non-interactive content'),
            React.createElement('p', null, 'More content'),
          ),
        );
      }).not.toThrow();
    });
  });

  describe('1.4. Submit trapping', () => {
    it('всегда вызывает event.preventDefault() при submit', () => {
      const mockOnSubmit = vi.fn();
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyForm,
          { onSubmit: mockOnSubmit },
          React.createElement('button', { type: 'submit' }, 'Submit'),
        ),
      );

      const submitButton = getByRole('button');

      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          preventDefault: expect.any(Function),
        }),
      );
    });

    it('вызывает onSubmit если передан', () => {
      const mockOnSubmit = vi.fn();
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyForm,
          { onSubmit: mockOnSubmit },
          React.createElement('button', { type: 'submit' }, 'Submit'),
        ),
      );

      const submitButton = getByRole('button');
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onSubmit если не передан', () => {
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('button', { type: 'submit' }, 'Submit'),
        ),
      );

      const submitButton = getByRole('button');

      // Не должно быть ошибок
      expect(() => {
        fireEvent.click(submitButton);
      }).not.toThrow();
    });

    it('работает с form.submit() через fireEvent', () => {
      const mockOnSubmit = vi.fn();
      const { getForm } = renderIsolated(
        React.createElement(
          AnyForm,
          { onSubmit: mockOnSubmit },
          React.createElement('input', { type: 'text', name: 'test' }),
        ),
      );

      const form = getForm();
      fireEvent.submit(form);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('1.5. Accessibility', () => {
    it('имеет правильные атрибуты', () => {
      const { getForm } = renderIsolated(
        React.createElement(
          AnyForm,
          null,
          React.createElement('div', null, 'Content'),
        ),
      );

      const form = getForm();
      expect(form).toHaveAttribute('noValidate');
    });
  });
});
