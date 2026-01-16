/**
 * @file Unit тесты для FormField компонента
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FormField } from '../../../src/primitives/form-field.js';

// Полная очистка DOM между тестами
afterEach(cleanup);

// Функция для изолированного рендера
function renderIsolated(component: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  return {
    ...result,
    container,
    // Локальный поиск элементов
    getByRole: (role: string, options?: any) => within(container).getByRole(role, options),
    getByText: (text: string | RegExp) => within(container).getByText(text),
    getByLabelText: (text: string | RegExp) => within(container).getByLabelText(text),
    queryByRole: (role: string, options?: any) => within(container).queryByRole(role, options),
  };
}

describe('FormField', () => {
  describe('3.1. Label', () => {
    it('label отображается', () => {
      const { getByText } = renderIsolated(
        <FormField key='label-display-test' label='Test Label' htmlFor='test'>
          <input id='test' />
        </FormField>,
      );

      expect(getByText('Test Label')).toBeInTheDocument();
    });

    it('htmlFor прокидывается в <label>', () => {
      const { getByText } = renderIsolated(
        <FormField key='htmlfor-test' label='Test Label' htmlFor='test-input'>
          <input id='test-input' />
        </FormField>,
      );

      const label = getByText('Test Label');
      expect(label).toHaveAttribute('for', 'test-input');
    });
  });

  describe('3.2. Children', () => {
    it('children рендерятся', () => {
      const { getByTestId } = renderIsolated(
        <FormField key='children-test' label='Test' htmlFor='test'>
          <input data-testid='custom-input' />
        </FormField>,
      );

      expect(getByTestId('custom-input')).toBeInTheDocument();
    });
  });

  describe('3.3. Без ошибки', () => {
    it('error отсутствует → блок ошибки не рендерится', () => {
      const { queryByRole } = renderIsolated(
        <FormField key='no-error-test' label='Test' htmlFor='test'>
          <input />
        </FormField>,
      );

      // Проверяем, что нет элемента с role="alert"
      expect(queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('3.4. С ошибкой', () => {
    it('error передан → текст ошибки отображается', () => {
      const { getByText } = renderIsolated(
        <FormField
          key='error-text-test'
          label='Test'
          htmlFor='test'
          error={`This is an error ${Math.random()}`}
        >
          <input />
        </FormField>,
      );

      expect(getByText(/^This is an error/)).toBeInTheDocument();
    });

    it('есть role="alert"', () => {
      const { getByRole } = renderIsolated(
        <FormField
          key='alert-role-test'
          label='Test'
          htmlFor='test'
          error={`Error message ${Math.random()}`}
        >
          <input />
        </FormField>,
      );

      expect(getByRole('alert')).toHaveTextContent(/^Error message/);
    });
  });

  describe('3.5. errorId', () => {
    it('если errorId передан → error div получает id', () => {
      const { getByRole } = renderIsolated(
        <FormField
          key='error-id-test'
          label='Test'
          htmlFor='test'
          error={`Error message ${Math.random()}`}
          errorId='custom-error-id'
        >
          <input />
        </FormField>,
      );

      const errorDiv = getByRole('alert');
      expect(errorDiv).toHaveAttribute('id', 'custom-error-id');
    });

    it('если errorId не передан → error div без id', () => {
      const { getByRole } = renderIsolated(
        <FormField
          key='no-error-id-test'
          label='Test'
          htmlFor='test'
          error={`Error message ${Math.random()}`}
        >
          <input />
        </FormField>,
      );

      const errorDiv = getByRole('alert');
      expect(errorDiv).not.toHaveAttribute('id');
    });
  });

  describe('3.6. Data attributes', () => {
    it('error block имеет data-ui="form-field-error"', () => {
      const { getByRole } = renderIsolated(
        <FormField key='data-ui-test' label='Test' htmlFor='test' error={`Error ${Math.random()}`}>
          <input />
        </FormField>,
      );

      expect(getByRole('alert')).toHaveAttribute('data-ui', 'form-field-error');
    });
  });
});
