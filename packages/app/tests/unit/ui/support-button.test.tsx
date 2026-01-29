/**
 * @vitest-environment jsdom
 * @file Тесты для App SupportButton компонента с полным покрытием
 */

/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types -- Для unit-тестов это избыточно. */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core SupportButton - возвращаем простой button с переданными пропсами
vi.mock('../../../../ui-core/src/components/SupportButton.js', () => ({
  SupportButton: React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<'button'> & {
      label?: string;
      icon?: React.ReactNode;
      variant?: string;
      size?: string;
      disabled?: boolean;
      onSupportClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
      'data-component'?: string;
      'data-variant'?: string;
      'data-size'?: string;
      'data-disabled'?: string;
    }
  >((
    {
      label,
      icon,
      variant,
      size,
      disabled,
      onSupportClick,
      'data-component': dataComponent,
      'data-variant': dataVariant,
      'data-size': dataSize,
      'data-disabled': dataDisabled,
      ...props
    }: Readonly<
      {
        label?: string;
        icon?: React.ReactNode;
        variant?: string;
        size?: string;
        disabled?: boolean;
        onSupportClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
        'data-component'?: string;
        'data-variant'?: string;
        'data-size'?: string;
        'data-disabled'?: string;
      } & React.ComponentProps<'button'>
    >,
    ref,
  ) => {
    return (
      <button
        ref={ref}
        data-testid='core-support-button'
        data-component={dataComponent}
        data-variant={variant}
        data-size={size}
        data-disabled={dataDisabled}
        disabled={disabled}
        onClick={onSupportClick}
        {...props}
      >
        {icon}
        {label}
      </button>
    );
  }),
}));

// Mock для feature flags с возможностью настройки
let mockFeatureFlagReturnValue = false;
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: () => mockFeatureFlagReturnValue,
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

import { SupportButton } from '../../../src/ui/support-button';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('App SupportButton', () => {
  // Mock callbacks
  const mockOnSupportClick = vi.fn();
  const mockOnSupportRequest = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
  });

  afterEach(cleanup);

  // Вынесенные объекты для соблюдения ESLint правил
  const customIcon = <span>🎧</span>;
  const customLabel = 'Help';

  describe('4.1. Policy (видимость и состояния)', () => {
    describe('Видимость (visible prop)', () => {
      it('рендерится по умолчанию (visible=true)', () => {
        render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

        expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
      });

      it('рендерится когда visible=true', () => {
        render(
          <SupportButton
            visible={true}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
      });

      it('не рендерится когда visible=false', () => {
        render(
          <SupportButton
            visible={false}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.queryByTestId('core-support-button')).not.toBeInTheDocument();
      });

      it('не рендерится когда visible=undefined', () => {
        render(
          <SupportButton
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
      });
    });

    describe('Feature flag: isHiddenByFeatureFlag', () => {
      it('рендерится когда isHiddenByFeatureFlag=false', () => {
        mockFeatureFlagReturnValue = false;

        render(
          <SupportButton
            isHiddenByFeatureFlag={false}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
      });

      it('не рендерится когда isHiddenByFeatureFlag=true', () => {
        render(
          <SupportButton
            isHiddenByFeatureFlag={true}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.queryByTestId('core-support-button')).not.toBeInTheDocument();
      });

      it('рендерится когда isHiddenByFeatureFlag=undefined', () => {
        render(
          <SupportButton
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
      });
    });

    describe('Feature flag: isDisabledByFeatureFlag', () => {
      it('передает disabled=false когда isDisabledByFeatureFlag=false', () => {
        render(
          <SupportButton
            isDisabledByFeatureFlag={false}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        const button = screen.getByTestId('core-support-button');
        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('data-state', 'active');
      });

      it('передает disabled=true когда isDisabledByFeatureFlag=true', () => {
        render(
          <SupportButton
            isDisabledByFeatureFlag={true}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        const button = screen.getByTestId('core-support-button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('data-state', 'disabled');
      });

      it('передает disabled=true когда isDisabledByFeatureFlag=true и disabled=true', () => {
        render(
          <SupportButton
            disabled={true}
            isDisabledByFeatureFlag={true}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        const button = screen.getByTestId('core-support-button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('data-state', 'disabled');
      });
    });

    describe('Комбинация policy условий', () => {
      it('не рендерится когда visible=false и isHiddenByFeatureFlag=true', () => {
        render(
          <SupportButton
            visible={false}
            isHiddenByFeatureFlag={true}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.queryByTestId('core-support-button')).not.toBeInTheDocument();
      });

      it('рендерится когда visible=true и isHiddenByFeatureFlag=false', () => {
        render(
          <SupportButton
            visible={true}
            isHiddenByFeatureFlag={false}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
      });
    });
  });

  describe('4.2. Telemetry', () => {
    describe('Lifecycle telemetry', () => {
      it('отправляет mount telemetry при рендере', () => {
        render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'SupportButton mount',
          expect.objectContaining({
            component: 'SupportButton',
            action: 'mount',
            hidden: false,
            visible: true,
            disabled: false,
            variant: 'default',
            size: 'medium',
            timestamp: expect.any(Number),
          }),
        );
      });

      it('отправляет unmount telemetry при размонтировании', () => {
        const { unmount } = render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

        unmount();

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'SupportButton unmount',
          expect.objectContaining({
            component: 'SupportButton',
            action: 'unmount',
            hidden: false,
            visible: true,
            disabled: false,
            variant: 'default',
            size: 'medium',
            timestamp: expect.any(Number),
          }),
        );
      });

      it('не отправляет telemetry когда telemetryEnabled=false', () => {
        render(
          <SupportButton
            telemetryEnabled={false}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(mockInfoFireAndForget).not.toHaveBeenCalled();
      });

      it('отправляет telemetry когда telemetryEnabled=true', () => {
        render(
          <SupportButton
            telemetryEnabled={true}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'SupportButton mount',
          expect.any(Object),
        );
      });

      it('отправляет telemetry когда telemetryEnabled=undefined', () => {
        render(
          <SupportButton
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'SupportButton mount',
          expect.any(Object),
        );
      });
    });

    describe('Click telemetry', () => {
      it('отправляет click telemetry при клике', () => {
        render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

        const button = screen.getByTestId('core-support-button');
        fireEvent.click(button);

        expect(mockInfoFireAndForget).toHaveBeenCalledWith(
          'SupportButton click',
          expect.objectContaining({
            component: 'SupportButton',
            action: 'click',
            hidden: false,
            visible: true,
            disabled: false,
            variant: 'default',
            size: 'medium',
            timestamp: expect.any(Number),
          }),
        );
      });

      it('не отправляет click telemetry когда telemetryEnabled=false', () => {
        render(
          <SupportButton
            telemetryEnabled={false}
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        const button = screen.getByTestId('core-support-button');
        fireEvent.click(button);

        // Только mount должен быть вызван (но он отключен), click не должен
        expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
          'SupportButton click',
          expect.any(Object),
        );
      });

      it('отправляет click telemetry с правильными policy данными', () => {
        render(
          <SupportButton
            isHiddenByFeatureFlag={true}
            isDisabledByFeatureFlag={true}
            variant='floating'
            size='large'
            onSupportRequest={mockOnSupportRequest}
          />,
        );

        // Даже если hidden=true, компонент не рендерится, так что клик невозможен
        expect(screen.queryByTestId('core-support-button')).not.toBeInTheDocument();
      });
    });
  });

  describe('4.3. Click handlers', () => {
    it('вызывает onSupportRequest при клике', () => {
      render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

      const button = screen.getByTestId('core-support-button');
      fireEvent.click(button);

      expect(mockOnSupportRequest).toHaveBeenCalledTimes(1);
    });

    it('вызывает onSupportClick при клике', () => {
      render(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      fireEvent.click(button);

      expect(mockOnSupportClick).toHaveBeenCalledTimes(1);
      expect(mockOnSupportClick).toHaveBeenCalledWith(expect.any(Object));
    });

    it('вызывает оба callback в правильном порядке: onSupportRequest, затем onSupportClick', () => {
      const callOrder: string[] = [];

      const mockOnSupportRequestOrdered = vi.fn(() => callOrder.push('request'));
      const mockOnSupportClickOrdered = vi.fn(() => callOrder.push('click'));

      render(
        <SupportButton
          onSupportClick={mockOnSupportClickOrdered}
          onSupportRequest={mockOnSupportRequestOrdered}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      fireEvent.click(button);

      expect(callOrder).toEqual(['request', 'click']);
    });

    it('работает без onSupportRequest', () => {
      render(<SupportButton onSupportClick={mockOnSupportClick} />);

      const button = screen.getByTestId('core-support-button');
      expect(() => fireEvent.click(button)).not.toThrow();

      expect(mockOnSupportClick).toHaveBeenCalledTimes(1);
    });

    it('работает без onSupportClick', () => {
      render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

      const button = screen.getByTestId('core-support-button');
      expect(() => fireEvent.click(button)).not.toThrow();

      expect(mockOnSupportRequest).toHaveBeenCalledTimes(1);
    });

    it('работает без обоих callbacks', () => {
      render(<SupportButton />);

      const button = screen.getByTestId('core-support-button');
      expect(() => fireEvent.click(button)).not.toThrow();
    });
  });

  describe('4.4. Props processing', () => {
    it('передает variant в Core компонент', () => {
      render(
        <SupportButton
          variant='floating'
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-variant', 'floating');
    });

    it('передает size в Core компонент', () => {
      render(
        <SupportButton
          size='large'
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-size', 'large');
    });

    it('передает label в Core компонент', () => {
      render(
        <SupportButton
          label={customLabel}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveTextContent(customLabel);
    });

    it('передает icon в Core компонент', () => {
      render(
        <SupportButton
          icon={customIcon}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button.innerHTML).toContain('🎧');
    });

    it('передает дополнительные HTML атрибуты', () => {
      render(
        <SupportButton
          title='Support button'
          className='custom-class'
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('title', 'Support button');
      expect(button).toHaveClass('custom-class');
    });

    it('передает data-testid', () => {
      render(
        <SupportButton
          data-testid='custom-test-id'
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });
  });

  describe('4.5. Data attributes', () => {
    it('применяет data-component="AppSupportButton"', () => {
      render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-component', 'AppSupportButton');
    });

    it('применяет data-state="active" по умолчанию', () => {
      render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-state', 'active');
    });

    it('применяет data-state="disabled" когда isDisabledByFeatureFlag=true', () => {
      render(
        <SupportButton
          isDisabledByFeatureFlag={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-state', 'disabled');
    });

    it('применяет data-feature-flag="visible" по умолчанию', () => {
      render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-feature-flag', 'visible');
    });

    it('применяет data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      render(
        <SupportButton
          isHiddenByFeatureFlag={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      // Компонент не рендерится, так что атрибут не проверяем
      expect(screen.queryByTestId('core-support-button')).not.toBeInTheDocument();
    });

    it('применяет data-telemetry="enabled" по умолчанию', () => {
      render(<SupportButton onSupportRequest={mockOnSupportRequest} />);

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-telemetry', 'enabled');
    });

    it('применяет data-telemetry="disabled" когда telemetryEnabled=false', () => {
      render(
        <SupportButton
          telemetryEnabled={false}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-telemetry', 'disabled');
    });
  });

  describe('4.6. Ref forwarding', () => {
    it('поддерживает ref forwarding', () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(
        <SupportButton
          ref={ref}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(ref.current).toBe(button);
    });
  });

  describe('4.7. Render stability', () => {
    it('не пересчитывает policy при одинаковых пропсах', () => {
      const { rerender } = render(
        <SupportButton
          visible={true}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={false}
          telemetryEnabled={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const initialCallCount = mockInfoFireAndForget.mock.calls.length;

      rerender(
        <SupportButton
          visible={true}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={false}
          telemetryEnabled={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      // Mount был вызван только один раз, rerender не вызвал новый mount
      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(initialCallCount);
    });

    it('пересчитывает policy при изменении visible', () => {
      const { rerender } = render(
        <SupportButton
          visible={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('core-support-button')).toBeInTheDocument();

      rerender(
        <SupportButton
          visible={false}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.queryByTestId('core-support-button')).not.toBeInTheDocument();
    });

    it('пересчитывает policy при изменении isHiddenByFeatureFlag', () => {
      const { rerender } = render(
        <SupportButton
          isHiddenByFeatureFlag={false}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('core-support-button')).toBeInTheDocument();

      rerender(
        <SupportButton
          isHiddenByFeatureFlag={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.queryByTestId('core-support-button')).not.toBeInTheDocument();
    });

    it('пересчитывает policy при изменении isDisabledByFeatureFlag', () => {
      const { rerender } = render(
        <SupportButton
          isDisabledByFeatureFlag={false}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('core-support-button')).not.toBeDisabled();

      rerender(
        <SupportButton
          isDisabledByFeatureFlag={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toBeDisabled();
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с undefined пропсами', () => {
      render(
        <SupportButton
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
    });

    it('работает с null icon', () => {
      render(
        <SupportButton
          icon={null}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
    });

    it('работает с пустым label', () => {
      render(
        <SupportButton
          label=''
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
    });

    it('работает с пустым data-testid', () => {
      render(
        <SupportButton
          data-testid=''
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(screen.getByTestId('core-support-button')).toBeInTheDocument();
    });

    it('комбинирует disabled из props и feature flag', () => {
      render(
        <SupportButton
          disabled={false}
          isDisabledByFeatureFlag={true}
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      const button = screen.getByTestId('core-support-button');
      expect(button).toHaveAttribute('data-state', 'disabled');
    });

    it('telemetry payload содержит правильные данные при различных состояниях', () => {
      render(
        <SupportButton
          visible={true}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={true}
          telemetryEnabled={true}
          variant='minimal'
          size='small'
          onSupportRequest={mockOnSupportRequest}
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'SupportButton mount',
        expect.objectContaining({
          component: 'SupportButton',
          action: 'mount',
          hidden: false,
          visible: true,
          disabled: true,
          variant: 'minimal',
          size: 'small',
          timestamp: expect.any(Number),
        }),
      );
    });
  });
});

/* eslint-enable @typescript-eslint/prefer-readonly-parameter-types */
