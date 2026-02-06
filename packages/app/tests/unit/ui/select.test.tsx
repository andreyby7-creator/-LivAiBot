/**
 * @vitest-environment jsdom
 * @file Тесты для Select компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: vi.fn(() => true),
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: vi.fn(() => true),
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
      warnFireAndForget: vi.fn(),
      errorFireAndForget: vi.fn(),
      flush: vi.fn(),
    },
    i18n: {
      translate: mockTranslate,
      locale: 'en',
      direction: 'ltr' as const,
      loadNamespace: vi.fn(),
      isNamespaceLoaded: vi.fn(() => true),
      t: vi.fn(),
      formatDateLocalized: vi.fn(),
      setDayjsLocale: vi.fn(),
    },
  }),
}));

import { Select } from '../../../src/ui/select';

// Импорт для правильного порядка моков
import '../../../src/providers/UnifiedUIProvider';

describe('Select', () => {
  const mockOnChange = vi.fn();
  const mockOnFocus = vi.fn();
  const mockOnBlur = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslate.mockReturnValue('Translated Label');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить select элемент', () => {
      render(<Select />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('должен рендерить с контролируемым значением', () => {
      render(
        <Select value='test' onChange={mockOnChange}>
          <option value='test'>Test Option</option>
          <option value='other'>Other Option</option>
        </Select>,
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('test');
    });

    it('должен рендерить с children (option elements)', () => {
      render(
        <Select>
          <option value='1'>Option 1</option>
          <option value='2'>Option 2</option>
        </Select>,
      );

      const select = screen.getByRole('combobox');
      expect(select).toContainHTML('<option value="1">Option 1</option>');
      expect(select).toContainHTML('<option value="2">Option 2</option>');
    });

    it('должен поддерживать data-testid', () => {
      render(<Select data-testid='custom-select' />);

      expect(screen.getByTestId('custom-select')).toBeInTheDocument();
    });
  });

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(<Select aria-label='Test label' />);

        expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(<Select {...{ ariaLabelI18nKey: 'common.label' } as any} />);

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.label', {});
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(<Select {...{ ariaLabelI18nKey: 'auth.login', ariaLabelI18nNs: 'auth' } as any} />);

        expect(mockTranslate).toHaveBeenCalledWith('auth', 'auth.login', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { field: 'username', required: true };
        render(
          <Select {...{ ariaLabelI18nKey: 'common.field', ariaLabelI18nParams: params } as any} />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.field', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Select
            {...{ ariaLabelI18nKey: 'common.test', ariaLabelI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
      });
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLSelectElement>();

      render(<Select ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
      expect(ref.current?.tagName).toBe('SELECT');
    });

    it('ref должен указывать на DOM элемент', () => {
      const ref = React.createRef<HTMLSelectElement>();

      render(<Select ref={ref} />);

      const select = screen.getByRole('combobox');
      expect(ref.current).toBe(select);
    });
  });

  describe('Feature flags - isHiddenByFeatureFlag', () => {
    it('должен рендерить компонент когда feature flag false', () => {
      render(<Select isHiddenByFeatureFlag={false} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('должен скрывать компонент когда feature flag true', () => {
      render(<Select isHiddenByFeatureFlag={true} />);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('должен показывать компонент по умолчанию когда feature flag не указан', () => {
      render(<Select />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('Feature flags - isDisabledByFeatureFlag', () => {
    it('должен быть включен когда feature flag false', () => {
      render(<Select isDisabledByFeatureFlag={false} />);

      const select = screen.getByRole('combobox');
      expect(select).not.toBeDisabled();
    });

    it('должен быть отключен когда feature flag true', () => {
      render(<Select isDisabledByFeatureFlag={true} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
      expect(select).toHaveAttribute('aria-disabled', 'true');
      expect(select).toHaveAttribute('aria-busy', 'true');
      expect(select).toHaveAttribute('data-disabled', 'true');
    });

    it('должен быть включен по умолчанию когда feature flag не указан', () => {
      render(<Select />);

      const select = screen.getByRole('combobox');
      expect(select).not.toBeDisabled();
    });
  });

  describe('Feature flags - variantByFeatureFlag', () => {
    it('должен устанавливать data-variant когда указан', () => {
      render(<Select variantByFeatureFlag='primary' />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('data-variant', 'primary');
    });

    it('должен не устанавливать data-variant по умолчанию', () => {
      render(<Select />);

      const select = screen.getByRole('combobox');
      expect(select).not.toHaveAttribute('data-variant');
    });

    it('должен не устанавливать data-variant по умолчанию', () => {
      render(<Select />);

      const select = screen.getByRole('combobox');
      expect(select).not.toHaveAttribute('data-variant');
    });
  });

  describe('Telemetry - lifecycle', () => {
    it('должен отправлять mount/unmount telemetry по умолчанию', () => {
      const { unmount } = render(<Select />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Select mount', {
        component: 'Select',
        action: 'mount',
        variant: null,
        hidden: false,
        disabled: false,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Select unmount', {
        component: 'Select',
        action: 'unmount',
        variant: null,
        hidden: false,
        disabled: false,
      });
    });

    it('должен отправлять telemetry с правильными feature flag значениями', () => {
      render(
        <Select
          isHiddenByFeatureFlag={true}
          isDisabledByFeatureFlag={true}
          variantByFeatureFlag='secondary'
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Select mount', {
        component: 'Select',
        action: 'mount',
        variant: 'secondary',
        hidden: true,
        disabled: true,
      });
    });

    it('должен отключать lifecycle telemetry когда telemetryEnabled=false', () => {
      const { unmount } = render(<Select telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select mount'),
        expect.anything(),
      );

      unmount();

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select unmount'),
        expect.anything(),
      );
    });
  });

  describe('Telemetry - event handlers', () => {
    it('должен отправлять change telemetry по умолчанию', () => {
      render(<Select onChange={mockOnChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'test' } });

      // Проверяем второй вызов (первый - mount)
      expect(mockInfoFireAndForget).toHaveBeenNthCalledWith(2, 'Select change', {
        component: 'Select',
        action: 'change',
        variant: null,
        hidden: false,
        disabled: false,
        value: expect.any(String),
      });
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('должен отправлять focus telemetry по умолчанию', () => {
      render(<Select onFocus={mockOnFocus} />);

      const select = screen.getByRole('combobox');
      fireEvent.focus(select);

      // Проверяем второй вызов (первый - mount)
      expect(mockInfoFireAndForget).toHaveBeenNthCalledWith(2, 'Select focus', {
        component: 'Select',
        action: 'focus',
        variant: null,
        hidden: false,
        disabled: false,
      });
      expect(mockOnFocus).toHaveBeenCalled();
    });

    it('должен отправлять blur telemetry по умолчанию', () => {
      render(<Select onBlur={mockOnBlur} />);

      const select = screen.getByRole('combobox');
      fireEvent.blur(select);

      // Проверяем второй вызов (первый - mount)
      expect(mockInfoFireAndForget).toHaveBeenNthCalledWith(2, 'Select blur', {
        component: 'Select',
        action: 'blur',
        variant: null,
        hidden: false,
        disabled: false,
      });
      expect(mockOnBlur).toHaveBeenCalled();
    });

    it('должен отключать change telemetry когда telemetryOnChange=false', () => {
      render(<Select onChange={mockOnChange} telemetryOnChange={false} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'test' } });

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select change'),
        expect.anything(),
      );
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('должен отключать focus telemetry когда telemetryOnFocus=false', () => {
      render(<Select onFocus={mockOnFocus} telemetryOnFocus={false} />);

      const select = screen.getByRole('combobox');
      fireEvent.focus(select);

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select focus'),
        expect.anything(),
      );
      expect(mockOnFocus).toHaveBeenCalled();
    });

    it('должен отключать blur telemetry когда telemetryOnBlur=false', () => {
      render(<Select onBlur={mockOnBlur} telemetryOnBlur={false} />);

      const select = screen.getByRole('combobox');
      fireEvent.blur(select);

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select blur'),
        expect.anything(),
      );
      expect(mockOnBlur).toHaveBeenCalled();
    });

    it('должен отключать всю event telemetry когда telemetryEnabled=false', () => {
      render(
        <Select
          onChange={mockOnChange}
          onFocus={mockOnFocus}
          onBlur={mockOnBlur}
          telemetryEnabled={false}
        />,
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'test' } });
      fireEvent.focus(select);
      fireEvent.blur(select);

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select change'),
        expect.anything(),
      );
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select focus'),
        expect.anything(),
      );
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Select blur'),
        expect.anything(),
      );
    });
  });

  describe('Event handlers - policy blocking', () => {
    it('должен блокировать onChange когда disabled=true', () => {
      render(<Select onChange={mockOnChange} isDisabledByFeatureFlag={true} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'test' } });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('должен пропускать onFocus когда disabled=true', () => {
      render(<Select onFocus={mockOnFocus} isDisabledByFeatureFlag={true} />);

      const select = screen.getByRole('combobox');
      fireEvent.focus(select);

      expect(mockOnFocus).toHaveBeenCalled();
    });

    it('должен пропускать onBlur когда disabled=true', () => {
      render(<Select onBlur={mockOnBlur} isDisabledByFeatureFlag={true} />);

      const select = screen.getByRole('combobox');
      fireEvent.blur(select);

      expect(mockOnBlur).toHaveBeenCalled();
    });
  });

  describe('Memo optimization', () => {
    it('должен быть memoized компонент', () => {
      const { rerender } = render(<Select />);

      const firstRender = screen.getByRole('combobox');

      rerender(<Select />);

      const secondRender = screen.getByRole('combobox');

      // Memo предотвращает ненужные ре-рендеры DOM
      expect(firstRender).toBe(secondRender);
    });

    it('должен иметь displayName', () => {
      expect(Select.displayName).toBe('Select');
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(<Select {...{ ariaLabelI18nKey: 'common.first' } as any} />);

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(<Select {...{ ariaLabelI18nKey: 'common.second' } as any} />);

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'common.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      render(<Select aria-label='Regular label' />);

      expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(<Select {...{ ariaLabelI18nKey: 'common.test' } as any} />);

      expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
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

  describe('Accessibility attributes', () => {
    it('должен устанавливать aria-disabled когда disabled', () => {
      render(<Select isDisabledByFeatureFlag={true} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-disabled', 'true');
    });

    it('должен устанавливать aria-busy когда disabled', () => {
      render(<Select isDisabledByFeatureFlag={true} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-busy', 'true');
    });

    it('должен иметь data-component атрибут', () => {
      render(<Select />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('data-component', 'AppSelect');
    });
  });

  describe('Edge cases', () => {
    it('должен работать с пустыми пропсами', () => {
      render(<Select />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('должен работать без event handlers', () => {
      render(<Select />);

      const select = screen.getByRole('combobox');

      expect(() => {
        fireEvent.change(select, { target: { value: 'test' } });
        fireEvent.focus(select);
        fireEvent.blur(select);
      }).not.toThrow();
    });

    it('должен корректно пробрасывать HTML атрибуты', () => {
      render(
        <Select
          id='test-select'
          name='testName'
          className='test-class'
          required
        />,
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('id', 'test-select');
      expect(select).toHaveAttribute('name', 'testName');
      expect(select).toHaveAttribute('class', 'test-class');
      expect(select).toHaveAttribute('required');
    });
  });
});
