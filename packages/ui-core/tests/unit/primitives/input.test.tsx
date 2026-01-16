/**
 * @file Unit тесты для Input компонента
 */

import '@testing-library/jest-dom';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../../../src/primitives/input.js';

describe('Input', () => {
  describe('2.1. Рендер', () => {
    it('input рендерится', () => {
      render(<Input />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('2.2. ForwardRef', () => {
    it('ref указывает на HTMLInputElement', () => {
      const inputRef = createRef<HTMLInputElement>();

      render(
        <Input
          ref={inputRef}
        />,
      );

      expect(inputRef.current).toBeInstanceOf(HTMLInputElement);
      expect(inputRef.current).toBe(screen.getByRole('textbox'));
    });
  });

  describe('2.3. className', () => {
    it('className объединяется с базовыми', () => {
      render(<Input className='custom-input' />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-input');
      // Проверяем базовые классы
      expect(input).toHaveClass('w-full', 'rounded-md', 'border', 'px-2.5', 'py-2');
    });
  });

  describe('2.4. Пропсы пробрасываются', () => {
    it('type пробрасывается', () => {
      render(<Input type='email' />);

      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    });

    it('placeholder пробрасывается', () => {
      render(<Input placeholder='Enter text' />);

      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Enter text');
    });

    it('disabled пробрасывается', () => {
      render(<Input disabled />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('id пробрасывается', () => {
      render(<Input id='test-input' />);

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'test-input');
    });
  });
});
