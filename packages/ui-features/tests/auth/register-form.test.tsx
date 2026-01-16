/**
 * @file Тесты для RegisterForm компонента
 */

import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegisterForm } from '../../src/auth/register-form';

type HasTextContent = { readonly textContent: string | null; };

function hasNonEmptyText(el: HasTextContent): boolean {
  const text = el.textContent;
  return typeof text === 'string' && text.length > 0;
}

// Mock компонентов UI для изоляции тестирования RegisterForm
vi.mock('@livai/ui-core', () => ({
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
  FormField: ({ label, htmlFor, error, errorId, children }: any) =>
    React.createElement(
      'div',
      {},
      React.createElement('label', { htmlFor }, label),
      children,
      Boolean(error)
        ? React.createElement('div', { id: errorId, role: 'alert', 'aria-live': 'polite' }, error)
        : null,
    ),
  Input: (props: any) => React.createElement('input', { type: 'text', ...props }),
}));

// Mock для i18n
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'auth.email.label': 'Электронная почта',
    'auth.password.label': 'Пароль',
    'auth.workspaceName.label': 'Название рабочего пространства',
    'auth.register.submit': 'Зарегистрироваться',
    'common.loading': 'Загрузка...',
    // i18n ключи валидации (см. ui-shared ValidationKeys)
    'validation.required': 'Обязательное поле',
    'validation.string.min': 'Слишком короткое значение',
    'validation.string.max': 'Слишком длинное значение',
  };
  return translations[key] ?? key;
});

describe('RegisterForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    t: mockT,
    isLoading: false,
    autoFocus: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('рендеринг', () => {
    it('должен рендерить все элементы формы', () => {
      render(<RegisterForm {...defaultProps} />);

      expect(screen.getByLabelText('Электронная почта')).toBeInTheDocument();
      expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
      expect(screen.getByLabelText('Название рабочего пространства')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument();
    });

    it('должен рендерить с английскими лейблами без i18n', () => {
      render(<RegisterForm onSubmit={vi.fn()} />);

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Workspace name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    });

    it('должен рендерить с autoFocus на email поле по умолчанию', () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      expect(emailInput).toHaveFocus();
    });

    it('должен отключать autoFocus на email поле при autoFocus={false}', () => {
      render(<RegisterForm {...defaultProps} autoFocus={false} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      expect(emailInput).not.toHaveFocus();
    });

    it('должен иметь noValidate на форме', () => {
      render(<RegisterForm {...defaultProps} />);

      const form = document.querySelector('form');
      expect(form).toBeTruthy();
      expect(form).toHaveProperty('noValidate', true);
    });

    it('должен иметь правильные атрибуты autocomplete', () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');

      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
      expect(workspaceInput).toHaveAttribute('autoComplete', 'organization');
    });
  });

  describe('взаимодействие с формой', () => {
    it('должен позволять вводить email, пароль и workspace name', () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: 'My Workspace' } });

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
      expect(workspaceInput).toHaveValue('My Workspace');
    });

    it('должен вызывать onSubmit при успешной отправке формы', async () => {
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      render(<RegisterForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: 'My Workspace' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          workspace_name: 'My Workspace',
        });
      });
    });

    it('должен обрабатывать async onSubmit с ошибкой', async () => {
      const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Registration failed'));
      render(<RegisterForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: 'My Workspace' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          workspace_name: 'My Workspace',
        });
      });
    });
  });

  describe('валидация ошибок', () => {
    it('должен показывать ошибки валидации для пустых полей', async () => {
      render(<RegisterForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some(hasNonEmptyText)).toBe(true);
      });
    });

    it('должен показывать ошибки валидации для невалидного email', async () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some(hasNonEmptyText)).toBe(true);
      });
    });

    it('должен показывать ошибки валидации для короткого пароля', async () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.change(workspaceInput, { target: { value: 'Workspace' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some(hasNonEmptyText)).toBe(true);
      });
    });

    it('должен показывать ошибки валидации для короткого workspace name', async () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: '' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some(hasNonEmptyText)).toBe(true);
      });
    });

    it('должен очищать ошибки при новом вводе', async () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      // Сначала отправляем пустую форму
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      });

      // Затем вводим валидные данные
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: 'My Workspace' } });

      // Ошибки должны исчезнуть
      await waitFor(() => {
        expect(screen.queryAllByRole('alert')).toHaveLength(0);
      });
    });
  });

  describe('i18n функциональность', () => {
    it('должен использовать переводы для лейблов', () => {
      render(<RegisterForm {...defaultProps} />);

      expect(screen.getByText('Электронная почта')).toBeInTheDocument();
      expect(screen.getByText('Пароль')).toBeInTheDocument();
      expect(screen.getByText('Название рабочего пространства')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument();
    });

    it('должен использовать переводы для ошибок', async () => {
      render(<RegisterForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      });
    });

    it('должен использовать fallback тексты без i18n', () => {
      render(<RegisterForm onSubmit={vi.fn()} />);

      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('Workspace name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    });
  });

  describe('состояние загрузки', () => {
    it('должен показывать loading текст и disabled кнопку', () => {
      render(<RegisterForm {...defaultProps} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: 'Загрузка...' });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
    });

    it('должен предотвращать отправку формы во время загрузки', async () => {
      const mockOnSubmit = vi.fn();
      render(<RegisterForm {...defaultProps} isLoading={true} onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: 'Загрузка...' });
      fireEvent.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('должен использовать i18n для loading текста', () => {
      render(<RegisterForm {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('button', { name: 'Загрузка...' })).toBeInTheDocument();
      expect(mockT).toHaveBeenCalledWith('common.loading');
    });
  });

  describe('accessibility', () => {
    it('должен иметь правильные ARIA атрибуты', () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');

      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
      expect(workspaceInput).toHaveAttribute('aria-invalid', 'false');
    });

    it('должен устанавливать aria-invalid при ошибках', async () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('должен связывать ошибки с полями через aria-describedby', async () => {
      render(<RegisterForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        const emailInput = screen.getByLabelText('Электронная почта');

        expect(alerts.length).toBeGreaterThan(0);
        expect(emailInput).toHaveAttribute('aria-describedby');
        expect(emailInput.getAttribute('aria-describedby')).toBeTruthy();
      });
    });

    it('должен иметь уникальные IDs для ошибок', async () => {
      render(<RegisterForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorDivs = screen.getAllByRole('alert');
        const ids = errorDivs.map((div) => div.id).filter(Boolean);

        // Все ошибки должны иметь уникальные IDs
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  });

  describe('обработка ошибок', () => {
    it('должен обрабатывать исключения в onSubmit gracefully', async () => {
      const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Registration failed'));
      render(<RegisterForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: 'My Workspace' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      // Форма должна оставаться функциональной после ошибки
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
      expect(workspaceInput).toHaveValue('My Workspace');
    });

    it('должен позволять повторную отправку после ошибки', async () => {
      const mockOnSubmit = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      render(<RegisterForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: 'My Workspace' } });

      // Первая отправка (с ошибкой)
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      // Вторая отправка (успешная)
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(2);
        expect(mockOnSubmit).toHaveBeenLastCalledWith({
          email: 'test@example.com',
          password: 'password123',
          workspace_name: 'My Workspace',
        });
      });
    });
  });

  describe('autoFocus поведение', () => {
    it('должен фокусировать email поле по умолчанию', () => {
      render(<RegisterForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      expect(emailInput).toHaveFocus();
    });

    it('должен отключать autoFocus при autoFocus={false}', () => {
      render(<RegisterForm {...defaultProps} autoFocus={false} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      expect(emailInput).not.toHaveFocus();
    });

    it('должен сохранять autoFocus по умолчанию при autoFocus={true}', () => {
      render(<RegisterForm {...defaultProps} autoFocus={true} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      expect(emailInput).toHaveFocus();
    });
  });

  describe('form reset после успешной отправки', () => {
    it('должен позволять повторную отправку после успеха', async () => {
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      render(<RegisterForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const workspaceInput = screen.getByLabelText('Название рабочего пространства');
      const submitButton = screen.getByRole('button', { name: 'Зарегистрироваться' });

      // Первая отправка
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(workspaceInput, { target: { value: 'My Workspace' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      // Вторая отправка с другими данными
      fireEvent.change(emailInput, { target: { value: 'other@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'otherpassword' } });
      fireEvent.change(workspaceInput, { target: { value: 'Other Workspace' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(2);
        expect(mockOnSubmit).toHaveBeenLastCalledWith({
          email: 'other@example.com',
          password: 'otherpassword',
          workspace_name: 'Other Workspace',
        });
      });
    });
  });
});
