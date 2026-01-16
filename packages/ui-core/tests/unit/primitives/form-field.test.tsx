/**
 * @file Unit тесты для FormField компонента
 */

import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../../../src/primitives/form-field.js';

describe('FormField', () => {
  describe('3.1. Label', () => {
    it('label отображается', () => {
      render(
        <FormField label='Test Label' htmlFor='test'>
          <input id='test' />
        </FormField>,
      );

      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('htmlFor прокидывается в <label>', () => {
      render(
        <FormField label='Test Label' htmlFor='test-input'>
          <input id='test-input' />
        </FormField>,
      );

      const label = screen.getByText('Test Label');
      expect(label).toHaveAttribute('for', 'test-input');
    });
  });

  describe('3.2. Children', () => {
    it('children рендерятся', () => {
      render(
        <FormField label='Test' htmlFor='test'>
          <input data-testid='custom-input' />
        </FormField>,
      );

      expect(screen.getByTestId('custom-input')).toBeInTheDocument();
    });
  });

  describe('3.3. Без ошибки', () => {
    it('error отсутствует → блок ошибки не рендерится', () => {
      render(
        <FormField label='Test' htmlFor='test'>
          <input />
        </FormField>,
      );

      // Проверяем, что нет элемента с role="alert"
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('3.4. С ошибкой', () => {
    it('error передан → текст ошибки отображается', () => {
      render(
        <FormField label='Test' htmlFor='test' error='This is an error'>
          <input />
        </FormField>,
      );

      expect(screen.getByText('This is an error')).toBeInTheDocument();
    });

    it('есть role="alert"', () => {
      render(
        <FormField label='Test' htmlFor='test' error='Error message'>
          <input />
        </FormField>,
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Error message');
    });
  });

  describe('3.5. errorId', () => {
    it('если errorId передан → error div получает id', () => {
      render(
        <FormField
          label='Test'
          htmlFor='test'
          error='Error message'
          errorId='custom-error-id'
        >
          <input />
        </FormField>,
      );

      const errorDiv = screen.getByRole('alert');
      expect(errorDiv).toHaveAttribute('id', 'custom-error-id');
    });

    it('если errorId не передан → error div без id', () => {
      render(
        <FormField label='Test' htmlFor='test' error='Error message'>
          <input />
        </FormField>,
      );

      const errorDiv = screen.getByRole('alert');
      expect(errorDiv).not.toHaveAttribute('id');
    });
  });

  describe('3.6. Data attributes', () => {
    it('error block имеет data-ui="form-field-error"', () => {
      render(
        <FormField label='Test' htmlFor='test' error='Error'>
          <input />
        </FormField>,
      );

      expect(screen.getByRole('alert')).toHaveAttribute('data-ui', 'form-field-error');
    });
  });
});
