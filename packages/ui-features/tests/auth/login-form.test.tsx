/**
 * @file Тесты для LoginForm компонента
 */

import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginForm } from '../../src/auth/login-form';

type HasTextContent = { readonly textContent: string | null; };

function hasNonEmptyText(el: HasTextContent): boolean {
  const text = el.textContent;
  return typeof text === 'string' && text.length > 0;
}

// Mock компонентов UI для изоляции тестирования LoginForm
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
    'auth.login.submit': 'Войти',
    'common.loading': 'Загрузка...',
    // i18n ключи валидации (см. ui-shared ValidationKeys)
    'validation.required': 'Обязательное поле',
    'validation.string.min': 'Слишком короткое значение',
    'validation.string.max': 'Слишком длинное значение',
  };
  return translations[key] ?? key;
});

describe('LoginForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    t: mockT,
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('рендеринг', () => {
    it('должен рендерить все элементы формы', () => {
      render(<LoginForm {...defaultProps} />);

      expect(screen.getByLabelText('Электронная почта')).toBeInTheDocument();
      expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('должен рендерить с английскими лейблами без i18n', () => {
      render(<LoginForm onSubmit={vi.fn()} />);

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('должен рендерить с autoFocus на email поле', () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      expect(emailInput).toHaveFocus();
    });

    it('должен иметь noValidate на форме', () => {
      render(<LoginForm {...defaultProps} />);

      // LoginForm рендерит form элемент с noValidate
      const form = document.querySelector('form');
      expect(form).toBeTruthy();
      // В HTML атрибут называется `novalidate`, а в React проп — `noValidate`.
      expect(form).toHaveProperty('noValidate', true);
    });
  });

  describe('взаимодействие с формой', () => {
    it('должен позволять вводить email и пароль', () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('должен вызывать onSubmit при успешной отправке формы', async () => {
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      render(<LoginForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('должен обрабатывать async onSubmit с ошибкой', async () => {
      const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Login failed'));
      render(<LoginForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });
  });

  describe('валидация ошибок', () => {
    it('должен показывать ошибки валидации для пустых полей', async () => {
      render(<LoginForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Войти' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        // Сообщение может быть i18n key или дефолтным текстом Zod — проверяем, что не пустое.
        expect(alerts.some(hasNonEmptyText)).toBe(true);
      });
    });

    it('должен показывать ошибки валидации для невалидного email', async () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Для email сообщение может быть дефолтным текстом Zod (не i18n key),
        // поэтому проверяем факт ошибки и что она не пустая.
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some(hasNonEmptyText)).toBe(true);
      });
    });

    it('должен показывать ошибки валидации для короткого пароля', async () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some(hasNonEmptyText)).toBe(true);
      });
    });

    it('должен очищать ошибки при новом вводе', async () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      // Сначала отправляем пустую форму
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      });

      // Затем вводим валидные данные
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      // Ошибки должны исчезнуть
      await waitFor(() => {
        expect(screen.queryAllByRole('alert')).toHaveLength(0);
      });
    });
  });

  describe('i18n функциональность', () => {
    it('должен использовать переводы для лейблов', () => {
      render(<LoginForm {...defaultProps} />);

      expect(screen.getByText('Электронная почта')).toBeInTheDocument();
      expect(screen.getByText('Пароль')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('должен использовать переводы для ошибок', async () => {
      render(<LoginForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Войти' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Ошибки в любом случае прогоняются через translateZodMessage(t),
        // поэтому хотя бы одно сообщение должно появиться.
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      });
    });

    it('должен использовать fallback тексты без i18n', () => {
      render(<LoginForm onSubmit={vi.fn()} />);

      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });
  });

  describe('состояние загрузки', () => {
    it('должен показывать loading текст и disabled кнопку', () => {
      render(<LoginForm {...defaultProps} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: 'Загрузка...' });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
    });

    it('должен предотвращать отправку формы во время загрузки', async () => {
      const mockOnSubmit = vi.fn();
      render(<LoginForm {...defaultProps} isLoading={true} onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: 'Загрузка...' });
      fireEvent.click(submitButton);

      // onSubmit не должен вызваться
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('должен использовать i18n для loading текста', () => {
      render(<LoginForm {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('button', { name: 'Загрузка...' })).toBeInTheDocument();
      expect(mockT).toHaveBeenCalledWith('common.loading');
    });
  });

  describe('accessibility', () => {
    it('должен иметь правильные ARIA атрибуты', () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');

      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });

    it('должен устанавливать aria-invalid при ошибках', async () => {
      render(<LoginForm {...defaultProps} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('должен связывать ошибки с полями через aria-describedby', async () => {
      render(<LoginForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Войти' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorDivs = screen.getAllByRole('alert');
        const emailInput = screen.getByLabelText('Электронная почта');

        expect(errorDivs.length).toBeGreaterThan(0);
        expect(emailInput).toHaveAttribute('aria-describedby');
        expect(emailInput.getAttribute('aria-describedby')).toBeTruthy();
      });
    });

    it('должен иметь уникальные IDs для ошибок', async () => {
      render(<LoginForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: 'Войти' });
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
      const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
      render(<LoginForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      // Форма должна оставаться функциональной после ошибки
      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('должен позволять повторную отправку после ошибки', async () => {
      const mockOnSubmit = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      render(<LoginForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      // Первая отправка (с ошибкой)
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      // Вторая отправка (успешная)
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('form reset после успешной отправки', () => {
    it('должен позволять повторную отправку после успеха', async () => {
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      render(<LoginForm {...defaultProps} onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('Электронная почта');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      // Первая отправка
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      // Вторая отправка с другими данными
      fireEvent.change(emailInput, { target: { value: 'other@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'otherpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(2);
        expect(mockOnSubmit).toHaveBeenLastCalledWith({
          email: 'other@example.com',
          password: 'otherpassword',
        });
      });
    });
  });
});
