/**
 * @file Unit тесты для Input компонента
 */

import React, { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Input } from '../../../src/primitives/input.js';

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
    getByRole: (role: string, options?: any) => within(container).getByRole(role, options),
    getByTestId: (testId: string) => within(container).getByTestId(testId),
    queryByRole: (role: string, options?: any) => within(container).queryByRole(role, options),
  };
}

describe('Input', () => {
  describe('2.1. Рендер', () => {
    it('input рендерится', () => {
      const { getByRole } = renderIsolated(<Input key='render-test' />);

      expect(getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('2.2. ForwardRef', () => {
    it('ref указывает на HTMLInputElement', () => {
      const inputRef = createRef<HTMLInputElement>();

      const { getByRole } = renderIsolated(
        <Input
          key='forward-ref-test'
          ref={inputRef}
        />,
      );

      expect(inputRef.current).toBeInstanceOf(HTMLInputElement);
      expect(inputRef.current).toBe(getByRole('textbox'));
    });
  });

  describe('2.3. className', () => {
    it('className объединяется с базовыми', () => {
      const { getByRole } = renderIsolated(<Input key='className-test' className='custom-input' />);

      const input = getByRole('textbox');
      expect(input).toHaveClass('custom-input');
      // Проверяем все базовые классы
      expect(input).toHaveClass(
        'w-full',
        'rounded-md',
        'border',
        'border-gray-300',
        'px-2.5',
        'py-2',
        'outline-none',
        'transition-colors',
        'focus:ring-2',
        'focus:ring-blue-500',
        'focus:border-blue-500',
      );
    });
  });

  describe('2.4. Пропсы пробрасываются', () => {
    it('type пробрасывается', () => {
      const { getByRole } = renderIsolated(<Input key='type-test' type='email' />);

      expect(getByRole('textbox')).toHaveAttribute('type', 'email');
    });

    it('placeholder пробрасывается', () => {
      const { getByRole } = renderIsolated(
        <Input key='placeholder-test' placeholder='Enter text' />,
      );

      expect(getByRole('textbox')).toHaveAttribute('placeholder', 'Enter text');
    });

    it('disabled пробрасывается', () => {
      const { getByRole } = renderIsolated(<Input key='disabled-test' disabled />);

      expect(getByRole('textbox')).toBeDisabled();
    });

    it('id пробрасывается', () => {
      const { getByRole } = renderIsolated(<Input key='id-test' id='test-input' />);

      expect(getByRole('textbox')).toHaveAttribute('id', 'test-input');
    });
  });
});
