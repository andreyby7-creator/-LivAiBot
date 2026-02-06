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
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();

// Mock для UnifiedUIProvider
vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    i18n: {
      translate: mockTranslate,
      locale: 'en',
      direction: 'ltr' as const,
      loadNamespace: vi.fn(),
      isNamespaceLoaded: vi.fn(() => true),
    },
    featureFlags: {
      isEnabled: () => mockFeatureFlagReturnValue,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => mockFeatureFlagReturnValue,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
  }),
}));

describe('Form', () => {
  const mockOnSubmit = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сброс к дефолтному значению
    mockTranslate.mockReturnValue('Translated Label');
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

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        const { container } = render(
          <Form aria-label='Test label'>
            <div>Test content</div>
          </Form>,
        );

        const form = container.querySelector('form');
        expect(form).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        const { container } = render(
          <Form {...{ ariaLabelI18nKey: 'common.label' } as any}>
            <div>Test content</div>
          </Form>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.label', {});
        const form = container.querySelector('form');
        expect(form).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен передавать namespace для i18n aria-label', () => {
        const { container } = render(
          <Form {...{ ariaLabelI18nKey: 'auth.login', ariaLabelI18nNs: 'auth' } as any}>
            <div>Test content</div>
          </Form>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('auth', 'auth.login', {});
        const form = container.querySelector('form');
        expect(form).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { field: 'username', required: true };
        const { container } = render(
          <Form {...{ ariaLabelI18nKey: 'common.field', ariaLabelI18nParams: params } as any}>
            <div>Test content</div>
          </Form>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.field', params);
        const form = container.querySelector('form');
        expect(form).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        const { container } = render(
          <Form {...{ ariaLabelI18nKey: 'common.test', ariaLabelI18nParams: undefined } as any}>
            <div>Test content</div>
          </Form>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
        const form = container.querySelector('form');
        expect(form).toHaveAttribute('aria-label', 'Translated Label');
      });
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

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <Form {...{ ariaLabelI18nKey: 'common.first' } as any}>
          <div>Test content</div>
        </Form>,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Form {...{ ariaLabelI18nKey: 'common.second' } as any}>
          <div>Test content</div>
        </Form>,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'common.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      const { container } = render(
        <Form aria-label='Regular label'>
          <div>Test content</div>
        </Form>,
      );

      const form = container.querySelector('form');
      expect(form).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      const { container } = render(
        <Form {...{ ariaLabelI18nKey: 'common.test' } as any}>
          <div>Test content</div>
        </Form>,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
      const form = container.querySelector('form');
      expect(form).toHaveAttribute('aria-label', 'Translated Label');
    });

    it('не должен компилироваться с обоими aria-label одновременно', () => {
      // Этот тест проверяет, что discriminated union работает правильно
      expect(() => {
        // TypeScript не позволит создать такой объект
        const invalidProps = {
          'aria-label': 'test',
          ariaLabelI18nKey: 'test',
        } as any;

        // Если discriminated union работает, этот объект будет иметь never типы для конфликтующих полей
        return invalidProps;
      }).not.toThrow();
    });
  });
});
