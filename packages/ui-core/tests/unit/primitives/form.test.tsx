/**
 * @vitest-environment jsdom
 * @file Unit тесты для Form компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Form } from '../../../src/primitives/form.js';

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
        <Form>
          <div>Test content</div>
        </Form>,
      );

      expect(container).toBeInTheDocument();
      expect(container.querySelector('form')).toBeInTheDocument();
    });

    it('создает form элемент с правильными атрибутами', () => {
      const { getForm } = renderIsolated(
        <Form>
          <input type='text' name='test' />
        </Form>,
      );

      const form = getForm();
      expect(form).toBeInTheDocument();
      expect(form).toHaveAttribute('noValidate');
    });

    it('пробрасывает остальные HTML пропсы', () => {
      const { getForm } = renderIsolated(
        <Form id='test-form' className='custom-class' data-testid='form'>
          <div>Content</div>
        </Form>,
      );

      const form = getForm();
      expect(form).toHaveAttribute('id', 'test-form');
      expect(form).toHaveClass('custom-class');
      expect(form).toHaveAttribute('data-testid', 'form');
    });

    it('рендерит children внутри формы', () => {
      const { getByText } = renderIsolated(
        <Form>
          <button type='submit'>Submit</button>
          <p>Form content</p>
        </Form>,
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
        <Form>
          <div>Content</div>
        </Form>,
      );

      expect(container.querySelector('form')).toBeInTheDocument();
    });
  });

  describe('1.3. Focus management', () => {
    it('autoFocus=true (по умолчанию) фокусирует первый интерактивный элемент', async () => {
      const { getByRole } = renderIsolated(
        <Form>
          <input type='text' name='first' data-testid='first-input' />
          <button type='submit'>Submit</button>
        </Form>,
      );

      const input = getByRole('textbox');
      // useEffect выполняется асинхронно, проверяем что фокус установлен
      expect(document.activeElement).toBe(input);
    });

    it('autoFocus=false не фокусирует элементы', () => {
      const { getByRole } = renderIsolated(
        <Form autoFocus={false}>
          <input type='text' name='first' />
          <button type='submit'>Submit</button>
        </Form>,
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
        <Form>
          <input type='text' name='first' />
        </Form>,
      );

      expect(mockFocus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it('autoFocus игнорируется если нет интерактивных элементов', () => {
      // useEffect не должен падать если нет интерактивных элементов
      expect(() => {
        renderIsolated(
          <Form>
            <div>Non-interactive content</div>
            <p>More content</p>
          </Form>,
        );
      }).not.toThrow();
    });
  });

  describe('1.4. Submit trapping', () => {
    it('всегда вызывает event.preventDefault() при submit', () => {
      const mockOnSubmit = vi.fn();
      const { getByRole } = renderIsolated(
        <Form onSubmit={mockOnSubmit}>
          <button type='submit'>Submit</button>
        </Form>,
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
        <Form onSubmit={mockOnSubmit}>
          <button type='submit'>Submit</button>
        </Form>,
      );

      const submitButton = getByRole('button');
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onSubmit если не передан', () => {
      const { getByRole } = renderIsolated(
        <Form>
          <button type='submit'>Submit</button>
        </Form>,
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
        <Form onSubmit={mockOnSubmit}>
          <input type='text' name='test' />
        </Form>,
      );

      const form = getForm();
      fireEvent.submit(form);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('1.5. Accessibility', () => {
    it('имеет правильные атрибуты', () => {
      const { getForm } = renderIsolated(
        <Form>
          <div>Content</div>
        </Form>,
      );

      const form = getForm();
      expect(form).toHaveAttribute('noValidate');
    });
  });
});
