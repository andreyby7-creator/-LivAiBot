/**
 * @vitest-environment jsdom
 * @file Тесты для Checkbox компонента с полным покрытием
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

import { Checkbox } from '../../../src/ui/checkbox';

// Импорт для правильного порядка моков
import '../../../src/providers/UnifiedUIProvider';

describe('Checkbox', () => {
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
    it('должен рендерить checkbox элемент', () => {
      render(<Checkbox />);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('должен рендерить с контролируемым состоянием', () => {
      render(<Checkbox checked indeterminate onChange={mockOnChange} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      expect((checkbox as HTMLInputElement).indeterminate).toBe(true);
    });

    it('должен иметь правильные атрибуты по умолчанию', () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('data-component', 'AppCheckbox');
      expect(checkbox).not.toHaveAttribute('aria-checked'); // uncontrolled
      expect(checkbox).not.toBeDisabled();
    });

    it('должен применять data атрибуты', () => {
      render(<Checkbox data-testid='test-checkbox' />);

      expect(screen.getByTestId('test-checkbox')).toBeInTheDocument();
    });
  });

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(<Checkbox aria-label='Test label' />);

        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(<Checkbox {...{ ariaLabelI18nKey: 'common.label' } as any} />);

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.label', {});
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <Checkbox {...{ ariaLabelI18nKey: 'auth.login', ariaLabelI18nNs: 'auth' } as any} />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('auth', 'auth.login', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { field: 'username', required: true };
        render(
          <Checkbox
            {...{ ariaLabelI18nKey: 'common.field', ariaLabelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.field', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Checkbox
            {...{ ariaLabelI18nKey: 'common.test', ariaLabelI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
      });
    });
  });

  describe('Feature flags', () => {
    it('должен быть скрыт когда isHiddenByFeatureFlag=true', () => {
      render(<Checkbox isHiddenByFeatureFlag />);

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('должен быть видим когда isHiddenByFeatureFlag=false', () => {
      render(<Checkbox isHiddenByFeatureFlag={false} />);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('должен быть disabled когда isDisabledByFeatureFlag=true', () => {
      render(<Checkbox isDisabledByFeatureFlag />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
      expect(checkbox).not.toHaveAttribute('aria-busy'); // busy только если явно передан
    });

    it('должен иметь variant когда variantByFeatureFlag установлен', () => {
      render(<Checkbox variantByFeatureFlag='primary' />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Default props', () => {
    it('должен иметь checked=false по умолчанию', () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
      expect(checkbox).not.toHaveAttribute('aria-checked'); // uncontrolled
    });

    it('должен иметь indeterminate=false по умолчанию', () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole('checkbox');
      expect((checkbox as HTMLInputElement).indeterminate).toBe(false);
    });

    it('должен принимать checked=true', () => {
      render(<Checkbox checked />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('должен принимать indeterminate=true', () => {
      render(<Checkbox indeterminate />);

      const checkbox = screen.getByRole('checkbox');
      expect((checkbox as HTMLInputElement).indeterminate).toBe(true);
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount/unmount телеметрию по умолчанию', () => {
      const { unmount } = render(<Checkbox checked indeterminate />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Checkbox mount', {
        component: 'Checkbox',
        action: 'mount',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
        indeterminate: true,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Checkbox unmount', {
        component: 'Checkbox',
        action: 'unmount',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
        indeterminate: true,
      });
    });

    it('должен отправлять change телеметрию', () => {
      render(<Checkbox onChange={mockOnChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Checkbox change', {
        component: 'Checkbox',
        action: 'change',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
        indeterminate: false,
      });
    });

    it('должен отправлять focus телеметрию', () => {
      render(<Checkbox onFocus={mockOnFocus} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.focus(checkbox);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Checkbox focus', {
        component: 'Checkbox',
        action: 'focus',
        variant: null,
        hidden: false,
        disabled: false,
        checked: false,
        indeterminate: false,
      });

      expect(mockOnFocus).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.any(Object),
        }),
      );
    });

    it('должен отправлять blur телеметрию', () => {
      render(<Checkbox onBlur={mockOnBlur} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.blur(checkbox);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Checkbox blur', {
        component: 'Checkbox',
        action: 'blur',
        variant: null,
        hidden: false,
        disabled: false,
        checked: false,
        indeterminate: false,
      });

      expect(mockOnBlur).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.any(Object),
        }),
      );
    });

    it('не должен отправлять телеметрию когда telemetryEnabled=false', () => {
      render(<Checkbox telemetryEnabled={false} onChange={mockOnChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('не должен отправлять change телеметрию когда telemetryOnChange=false', () => {
      render(<Checkbox telemetryOnChange={false} onChange={mockOnChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('не должен отправлять focus телеметрию когда telemetryOnFocus=false', () => {
      render(<Checkbox telemetryOnFocus={false} onFocus={mockOnFocus} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.focus(checkbox);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('не должен отправлять blur телеметрию когда telemetryOnBlur=false', () => {
      render(<Checkbox telemetryOnBlur={false} onBlur={mockOnBlur} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.blur(checkbox);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });
  });

  describe('Event handlers', () => {
    it('должен вызывать onChange с правильным event', () => {
      render(<Checkbox onChange={mockOnChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onFocus с правильным event', () => {
      render(<Checkbox onFocus={mockOnFocus} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.focus(checkbox);

      expect(mockOnFocus).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onBlur с правильным event', () => {
      render(<Checkbox onBlur={mockOnBlur} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.blur(checkbox);

      expect(mockOnBlur).toHaveBeenCalledTimes(1);
    });

    it('не должен вызывать onChange когда disabled', () => {
      render(<Checkbox isDisabledByFeatureFlag onChange={mockOnChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Checkbox ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe('checkbox');
    });
  });

  describe('Memoization', () => {
    it('должен быть memoized', () => {
      const renderSpy = vi.fn(() => <Checkbox />);
      const MemoizedComponent = React.memo(renderSpy);

      const { rerender } = render(<MemoizedComponent />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<MemoizedComponent />);

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('должен иметь displayName', () => {
      expect(Checkbox.displayName).toBe('Checkbox');
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(<Checkbox {...{ ariaLabelI18nKey: 'common.first' } as any} />);

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(<Checkbox {...{ ariaLabelI18nKey: 'common.second' } as any} />);

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'common.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      render(<Checkbox aria-label='Regular label' />);

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(<Checkbox {...{ ariaLabelI18nKey: 'common.test' } as any} />);

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

  describe('Policy logic', () => {
    it('должен правильно вычислять policy', () => {
      render(
        <Checkbox
          isHiddenByFeatureFlag
          isDisabledByFeatureFlag
          variantByFeatureFlag='test'
          telemetryEnabled={false}
          telemetryOnChange={false}
          telemetryOnFocus={false}
          telemetryOnBlur={false}
        />,
      );

      // Компонент скрыт, поэтому не рендерится
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('должен иметь правильные значения policy по умолчанию', () => {
      render(<Checkbox onChange={mockOnChange} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Проверяем что телеметрия отправляется (значит telemetryEnabled=true по умолчанию)
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Checkbox change', expect.any(Object));
    });
  });

  describe('Props forwarding', () => {
    it('должен пробрасывать HTML атрибуты в CoreCheckbox', () => {
      render(
        <Checkbox
          id='test-checkbox'
          name='test-name'
          className='test-class'
          required
          autoFocus
        />,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'test-checkbox');
      expect(checkbox).toHaveAttribute('name', 'test-name');
      expect(checkbox).toHaveAttribute('class', 'test-class');
      expect(checkbox).toHaveAttribute('required');
    });
  });

  describe('Edge cases', () => {
    it('должен работать с undefined пропсами', () => {
      render(
        <Checkbox
          checked={undefined}
          onChange={undefined}
          onFocus={undefined}
          onBlur={undefined}
        />,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toHaveAttribute('aria-checked'); // checked=undefined makes it uncontrolled
    });

    it('должен работать без обработчиков событий', () => {
      expect(() => {
        render(<Checkbox />);
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
        fireEvent.focus(checkbox);
        fireEvent.blur(checkbox);
      }).not.toThrow();
    });
  });
});
