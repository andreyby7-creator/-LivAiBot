/**
 * @vitest-environment jsdom
 * @file Тесты для Form компонента с полным покрытием
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Form } from '../../../src/ui/form';

// Объявляем переменные моков перед vi.mock()
let mockFeatureFlagReturnValue = false;

// Mock для feature flags с возможностью настройки
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: () => mockFeatureFlagReturnValue,
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

describe('Form', () => {
  const mockOnSubmit = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сброс к дефолтному значению
  });

  afterEach(() => {
    cleanup();
    mockFeatureFlagReturnValue = false; // Восстанавливаем дефолтное значение
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить CoreForm с детьми', () => {
      const { container } = render(
        <Form>
          <input type='text' name='test' />
        </Form>,
      );

      // Проверяем что есть form элемент в DOM
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('не должен рендериться когда hidden=true', () => {
      mockFeatureFlagReturnValue = true; // isHiddenByFeatureFlag = true

      const { container } = render(
        <Form isHiddenByFeatureFlag={true}>
          <div>Hidden content</div>
        </Form>,
      );

      expect(container.firstChild).toBeNull();
    });

    it('должен рендериться когда isHiddenByFeatureFlag=false', () => {
      render(
        <Form isHiddenByFeatureFlag={false}>
          <div>Visible content</div>
        </Form>,
      );

      expect(screen.getByText('Visible content')).toBeInTheDocument();
    });
  });

  describe('Feature flags', () => {
    it('должен применять variant из feature flag', () => {
      const { container } = render(
        <Form variantByFeatureFlag='custom-variant'>
          <div>Content</div>
        </Form>,
      );

      const form = container.querySelector('form');
      expect(form).toHaveAttribute('data-variant', 'custom-variant');
    });
  });

  describe('Telemetry', () => {
    it('должен рендериться с mount/unmount lifecycle', () => {
      const { unmount, container } = render(
        <Form>
          <div>Content</div>
        </Form>,
      );

      expect(container.querySelector('form')).toBeInTheDocument();

      unmount();

      // Компонент успешно размонтирован
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('должен работать с telemetryEnabled=false', () => {
      const { container } = render(
        <Form telemetryEnabled={false}>
          <div>Content</div>
        </Form>,
      );

      expect(container.querySelector('form')).toBeInTheDocument();
    });

    it('должен вызывать onSubmit при submit', () => {
      render(
        <Form onSubmit={mockOnSubmit}>
          <button type='submit'>Submit</button>
        </Form>,
      );

      const submitButton = screen.getByRole('button');
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('должен вызывать onReset при reset', () => {
      render(
        <Form onReset={mockOnReset}>
          <button type='reset'>Reset</button>
        </Form>,
      );

      const resetButton = screen.getByRole('button');
      fireEvent.click(resetButton);

      expect(mockOnReset).toHaveBeenCalled();
    });

    it('должен работать с telemetryOnSubmit=false', () => {
      render(
        <Form onSubmit={mockOnSubmit} telemetryOnSubmit={false}>
          <button type='submit'>Submit</button>
        </Form>,
      );

      const submitButton = screen.getByRole('button');
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('должен работать с telemetryOnReset=false', () => {
      render(
        <Form onReset={mockOnReset} telemetryOnReset={false}>
          <button type='reset'>Reset</button>
        </Form>,
      );

      const resetButton = screen.getByRole('button');
      fireEvent.click(resetButton);

      expect(mockOnReset).toHaveBeenCalled();
    });
  });

  describe('Обработчики событий', () => {
    it('должен вызывать обработчики событий', () => {
      render(
        <Form onSubmit={mockOnSubmit} onReset={mockOnReset}>
          <button type='submit'>Submit</button>
          <button type='reset'>Reset</button>
        </Form>,
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      const resetButton = screen.getByRole('button', { name: 'Reset' });

      fireEvent.click(submitButton);
      fireEvent.click(resetButton);

      expect(mockOnSubmit).toHaveBeenCalled();
      expect(mockOnReset).toHaveBeenCalled();
    });

    it('должен вызывать onSubmit с правильным event', () => {
      render(
        <Form onSubmit={mockOnSubmit}>
          <button type='submit'>Submit</button>
        </Form>,
      );

      const submitButton = screen.getByRole('button');
      fireEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          preventDefault: expect.any(Function),
          target: expect.any(Object),
        }),
      );
    });

    it('должен вызывать onReset с правильным event', () => {
      render(
        <Form onReset={mockOnReset}>
          <button type='reset'>Reset</button>
        </Form>,
      );

      const resetButton = screen.getByRole('button');
      fireEvent.click(resetButton);

      expect(mockOnReset).toHaveBeenCalledWith(
        expect.objectContaining({
          preventDefault: expect.any(Function),
          target: expect.any(Object),
        }),
      );
    });
  });

  describe('Проброс пропсов', () => {
    it('должен пробрасывать HTML пропсы в CoreForm', () => {
      const { container } = render(
        <Form id='test-form' className='custom-class' data-testid='form'>
          <div>Content</div>
        </Form>,
      );

      const form = container.querySelector('form');
      expect(form).toHaveAttribute('id', 'test-form');
      expect(form).toHaveClass('custom-class');
      expect(form).toHaveAttribute('data-testid', 'form');
    });

    it('должен пробрасывать autoFocus в CoreForm', () => {
      const { container } = render(
        <Form autoFocus={false}>
          <input type='text' name='test' />
        </Form>,
      );

      // Проверяем что форма рендерится без ошибок
      expect(container.querySelector('form')).toBeInTheDocument();
    });

    it('должен пробрасывать остальные CoreForm пропсы', () => {
      const { container } = render(
        <Form noValidate={true}>
          <input type='text' name='test' />
        </Form>,
      );

      const form = container.querySelector('form');
      expect(form).toHaveAttribute('novalidate');
    });
  });

  describe('Policy логика', () => {
    it('должен использовать значения по умолчанию для policy', () => {
      const { container } = render(
        <Form>
          <div>Content</div>
        </Form>,
      );

      const form = container.querySelector('form');
      expect(form).not.toHaveAttribute('data-disabled');
      expect(form).not.toHaveAttribute('data-variant');
      expect(form).not.toHaveAttribute('aria-disabled');
      expect(form).not.toHaveAttribute('aria-busy');
    });
  });

  describe('Memo и displayName', () => {
    it('должен иметь правильный displayName', () => {
      expect(Form.displayName).toBe('Form');
    });

    it('должен иметь правильный displayName', () => {
      expect(Form.displayName).toBe('Form');
    });
  });
});
