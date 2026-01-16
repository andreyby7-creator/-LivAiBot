/**
 * @file Unit тесты для Button компонента
 */

import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../../../src/primitives/button.js';

describe('Button', () => {
  describe('1.1. Рендер без падений', () => {
    it('рендерится с текстом', () => {
      render(<Button>Hello World</Button>);

      expect(screen.getByRole('button')).toHaveTextContent('Hello World');
    });

    it('по умолчанию type="button"', () => {
      render(<Button>Click me</Button>);

      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
  });

  describe('1.2. Variant', () => {
    it('primary → есть классы primary', () => {
      render(<Button variant='primary'>Primary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-600', 'text-white');
      expect(button).toHaveClass('hover:bg-blue-700');
    });

    it('secondary → есть классы secondary', () => {
      render(<Button variant='secondary'>Secondary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-gray-300', 'bg-white', 'text-gray-900');
      expect(button).toHaveClass('hover:bg-gray-50');
    });
  });

  describe('1.3. Size', () => {
    it('sm → применён sm-класс', () => {
      render(<Button size='sm'>Small</Button>);

      expect(screen.getByRole('button')).toHaveClass('px-2.5', 'py-1.5', 'text-sm');
    });

    it('md → применён md-класс', () => {
      render(<Button size='md'>Medium</Button>);

      expect(screen.getByRole('button')).toHaveClass('px-3', 'py-2', 'text-sm');
    });

    it('lg → применён lg-класс', () => {
      render(<Button size='lg'>Large</Button>);

      expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2.5', 'text-base');
    });
  });

  describe('1.4. Disabled', () => {
    it('disabled=true → атрибут disabled присутствует и применены disabled-классы', () => {
      render(<Button disabled>Disabled Button</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('disabled primary → дополнительные классы для primary', () => {
      render(<Button variant='primary' disabled>Disabled Primary</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-400');
    });
  });

  describe('1.5. Full width', () => {
    it('fullWidth=true → есть класс w-full', () => {
      render(<Button fullWidth>Full Width</Button>);

      expect(screen.getByRole('button')).toHaveClass('w-full');
    });
  });

  describe('1.6. className пробрасывается', () => {
    it('переданный className добавляется, а не затирает базовые', () => {
      render(<Button className='custom-class'>Custom</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      // Проверяем, что базовые классы тоже есть
      expect(button).toHaveClass('inline-flex', 'items-center');
    });
  });
});
