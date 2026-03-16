/**
 * @vitest-environment jsdom
 * @file Unit тесты для FormField компонента
 */

import { cleanup, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { FormField } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

// Полная очистка DOM между тестами
afterEach(cleanup);

// Для целей тестов ослабляем типизацию пропсов FormField
const AnyFormField = FormField as any;

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
    getByLabelText: (text: Readonly<string | RegExp>) => within(container).getByLabelText(text),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
  };
}

describe('FormField', () => {
  describe('3.1. Label', () => {
    it('label отображается', () => {
      const { getByText } = renderIsolated(
        React.createElement(
          AnyFormField,
          { key: 'label-display-test', label: 'Test Label', htmlFor: 'test' },
          React.createElement('input', { id: 'test' }),
        ),
      );

      expect(getByText('Test Label')).toBeInTheDocument();
    });

    it('htmlFor прокидывается в <label>', () => {
      const { getByText } = renderIsolated(
        React.createElement(
          AnyFormField,
          { key: 'htmlfor-test', label: 'Test Label', htmlFor: 'test-input' },
          React.createElement('input', { id: 'test-input' }),
        ),
      );

      const label = getByText('Test Label');
      expect(label).toHaveAttribute('for', 'test-input');
    });
  });

  describe('3.2. Children', () => {
    it('children рендерятся', () => {
      const { getByTestId } = renderIsolated(
        React.createElement(
          AnyFormField,
          { key: 'children-test', label: 'Test', htmlFor: 'test' },
          React.createElement('input', { 'data-testid': 'custom-input' }),
        ),
      );

      expect(getByTestId('custom-input')).toBeInTheDocument();
    });
  });

  describe('3.3. Без ошибки', () => {
    it('error отсутствует → блок ошибки не рендерится', () => {
      const { queryByRole } = renderIsolated(
        React.createElement(
          AnyFormField,
          { key: 'no-error-test', label: 'Test', htmlFor: 'test' },
          React.createElement('input', null),
        ),
      );

      // Проверяем, что нет элемента с role="alert"
      expect(queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('3.4. С ошибкой', () => {
    it('error передан → текст ошибки отображается', () => {
      const { getByText } = renderIsolated(
        React.createElement(
          AnyFormField,
          {
            key: 'error-text-test',
            label: 'Test',
            htmlFor: 'test',
            error: `This is an error ${Math.random()}`,
          },
          React.createElement('input', null),
        ),
      );

      expect(getByText(/^This is an error/)).toBeInTheDocument();
    });

    it('есть role="alert"', () => {
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyFormField,
          {
            key: 'alert-role-test',
            label: 'Test',
            htmlFor: 'test',
            error: `Error message ${Math.random()}`,
          },
          React.createElement('input', null),
        ),
      );

      expect(getByRole('alert')).toHaveTextContent(/^Error message/);
    });
  });

  describe('3.5. errorId', () => {
    it('если errorId передан → error div получает id', () => {
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyFormField,
          {
            key: 'error-id-test',
            label: 'Test',
            htmlFor: 'test',
            error: `Error message ${Math.random()}`,
            errorId: 'custom-error-id',
          },
          React.createElement('input', null),
        ),
      );

      const errorDiv = getByRole('alert');
      expect(errorDiv).toHaveAttribute('id', 'custom-error-id');
    });

    it('если errorId не передан → error div без id', () => {
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyFormField,
          {
            key: 'no-error-id-test',
            label: 'Test',
            htmlFor: 'test',
            error: `Error message ${Math.random()}`,
          },
          React.createElement('input', null),
        ),
      );

      const errorDiv = getByRole('alert');
      expect(errorDiv).not.toHaveAttribute('id');
    });
  });

  describe('3.6. Data attributes', () => {
    it('error block имеет data-ui="form-field-error"', () => {
      const { getByRole } = renderIsolated(
        React.createElement(
          AnyFormField,
          {
            key: 'data-ui-test',
            label: 'Test',
            htmlFor: 'test',
            error: `Error ${Math.random()}`,
          },
          React.createElement('input', null),
        ),
      );

      expect(getByRole('alert')).toHaveAttribute('data-ui', 'form-field-error');
    });
  });
});
