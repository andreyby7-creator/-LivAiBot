/**
 * @file Unit тесты для Button компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Button } from '../../../src/primitives/button.js';

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
  };
}

describe('Button', () => {
  describe('1.1. Рендер без падений', () => {
    it('рендерится с текстом', () => {
      const { getByRole } = renderIsolated(<Button>Hello World</Button>);

      expect(getByRole('button')).toHaveTextContent('Hello World');
    });

    it('по умолчанию type="button"', () => {
      const { getByRole } = renderIsolated(<Button>Click me</Button>);

      expect(getByRole('button')).toHaveAttribute('type', 'button');
    });
  });

  describe('1.2. Variant', () => {
    it('primary → есть классы primary', () => {
      const { getByRole } = renderIsolated(<Button variant='primary'>Primary</Button>);

      const button = getByRole('button');
      expect(button).toHaveClass('bg-blue-600', 'text-white');
      expect(button).toHaveClass('hover:bg-blue-700');
    });

    it('secondary → есть классы secondary', () => {
      const { getByRole } = renderIsolated(<Button variant='secondary'>Secondary</Button>);

      const button = getByRole('button');
      expect(button).toHaveClass('border-gray-300', 'bg-white', 'text-gray-900');
      expect(button).toHaveClass('hover:bg-gray-50');
    });

    it('variant по умолчанию → primary классы', () => {
      const { getByRole } = renderIsolated(<Button>Default</Button>);

      const button = getByRole('button');
      expect(button).toHaveClass('bg-blue-600', 'text-white');
      expect(button).toHaveClass('hover:bg-blue-700');
    });
  });

  describe('1.3. Size', () => {
    it('sm → применён sm-класс', () => {
      const { getByRole } = renderIsolated(<Button size='sm'>Small</Button>);

      expect(getByRole('button')).toHaveClass('px-2.5', 'py-1.5', 'text-sm');
    });

    it('md → применён md-класс', () => {
      const { getByRole } = renderIsolated(<Button size='md'>Medium</Button>);

      expect(getByRole('button')).toHaveClass('px-3', 'py-2', 'text-sm');
    });

    it('lg → применён lg-класс', () => {
      const { getByRole } = renderIsolated(<Button size='lg'>Large</Button>);

      expect(getByRole('button')).toHaveClass('px-4', 'py-2.5', 'text-base');
    });
  });

  describe('1.4. Disabled', () => {
    it('disabled=true → атрибут disabled присутствует и применены disabled-классы', () => {
      const { getByRole } = renderIsolated(<Button disabled>Disabled Button</Button>);

      const button = getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('disabled primary → дополнительные классы для primary', () => {
      const { getByRole } = renderIsolated(
        <Button variant='primary' disabled>Disabled Primary</Button>,
      );

      const button = getByRole('button');
      expect(button).toHaveClass('bg-blue-400');
    });
  });

  describe('1.5. Full width', () => {
    it('fullWidth=true → есть класс w-full', () => {
      const { getByRole } = renderIsolated(<Button fullWidth>Full Width</Button>);

      expect(getByRole('button')).toHaveClass('w-full');
    });

    it('fullWidth=false или не указан → нет класса w-full', () => {
      const { getByRole } = renderIsolated(<Button>Regular Width</Button>);

      expect(getByRole('button')).not.toHaveClass('w-full');
    });
  });

  describe('1.6. className пробрасывается', () => {
    it('переданный className добавляется, а не затирает базовые', () => {
      const { getByRole } = renderIsolated(<Button className='custom-class'>Custom</Button>);

      const button = getByRole('button');
      expect(button).toHaveClass('custom-class');
      // Проверяем, что базовые классы тоже есть
      expect(button).toHaveClass('inline-flex', 'items-center');
    });
  });
});
