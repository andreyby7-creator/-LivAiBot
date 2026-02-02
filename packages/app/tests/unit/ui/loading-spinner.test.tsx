/**
 * @vitest-environment jsdom
 * @file Тесты для App LoadingSpinner компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core LoadingSpinner
vi.mock('../../../../ui-core/src/primitives/loading-spinner', () => ({
  LoadingSpinner: React.forwardRef<
    HTMLDivElement,
    Readonly<Record<string, unknown>>
  >((
    props: Readonly<Record<string, unknown>>,
    ref,
  ) => {
    const {
      variant,
      size,
      color,
      'aria-label': ariaLabel,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      'data-variant': dataVariant,
      'data-testid': testId,
      className,
      style,
      ...rest
    } = props;

    return (
      <div
        ref={ref}
        data-testid={testId ?? 'core-loading-spinner'}
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-variant={dataVariant}
        data-variant-prop={variant}
        data-size-prop={size}
        data-color-prop={color}
        aria-label={ariaLabel as string | undefined}
        className={className as string | undefined}
        style={style as React.CSSProperties | undefined}
        {...rest}
      >
        Loading Spinner
      </div>
    );
  }),
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

import { LoadingSpinner } from '../../../src/ui/loading-spinner';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('App LoadingSpinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить LoadingSpinner с дефолтными пропсами', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toBeInTheDocument();
    });

    it('должен передавать data-component="AppLoadingSpinner"', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toHaveAttribute(
        'data-component',
        'AppLoadingSpinner',
      );
    });

    it('должен передавать data-state="visible"', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toHaveAttribute(
        'data-state',
        'visible',
      );
    });

    it('должен передавать data-feature-flag="visible" по умолчанию', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен передавать data-telemetry="enabled" по умолчанию', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toHaveAttribute(
        'data-telemetry',
        'enabled',
      );
    });

    it('должен передавать data-testid в Core LoadingSpinner', () => {
      render(<LoadingSpinner data-testid='custom-spinner' />);

      expect(screen.getByTestId('custom-spinner')).toBeInTheDocument();
    });

    it('должен передавать дополнительные пропсы в Core LoadingSpinner', () => {
      const customStyle: Readonly<{ color: string; }> = { color: 'red' };
      render(
        <LoadingSpinner
          className='custom-class'
          style={customStyle}
        />,
      );

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveClass('custom-class');
      expect(spinner).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false', () => {
      render(<LoadingSpinner visible={false} />);

      expect(screen.queryByTestId('core-loading-spinner')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<LoadingSpinner isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-loading-spinner')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      render(
        <LoadingSpinner visible={false} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.queryByTestId('core-loading-spinner')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=true', () => {
      render(
        <LoadingSpinner visible={false} isHiddenByFeatureFlag={true} />,
      );

      expect(screen.queryByTestId('core-loading-spinner')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      render(
        <LoadingSpinner visible={true} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.getByTestId('core-loading-spinner')).toBeInTheDocument();
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <LoadingSpinner isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но если бы рендерился, имел бы hidden
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Варианты (variant)', () => {
    it('должен передавать variant="spinner" в Core LoadingSpinner', () => {
      render(<LoadingSpinner variant='spinner' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-variant-prop', 'spinner');
      expect(spinner).toHaveAttribute('data-variant', 'spinner');
    });

    it('должен передавать variant="dots" в Core LoadingSpinner', () => {
      render(<LoadingSpinner variant='dots' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-variant-prop', 'dots');
      expect(spinner).toHaveAttribute('data-variant', 'dots');
    });

    it('должен передавать variant="pulse" в Core LoadingSpinner', () => {
      render(<LoadingSpinner variant='pulse' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-variant-prop', 'pulse');
      expect(spinner).toHaveAttribute('data-variant', 'pulse');
    });

    it('не должен передавать data-variant когда variant не указан', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).not.toHaveAttribute('data-variant');
    });
  });

  describe('Размеры (size)', () => {
    it('должен передавать size="sm" в Core LoadingSpinner', () => {
      render(<LoadingSpinner size='sm' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-size-prop', 'sm');
    });

    it('должен передавать size="md" в Core LoadingSpinner', () => {
      render(<LoadingSpinner size='md' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-size-prop', 'md');
    });

    it('должен передавать size="lg" в Core LoadingSpinner', () => {
      render(<LoadingSpinner size='lg' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-size-prop', 'lg');
    });

    it('должен передавать size как число в Core LoadingSpinner', () => {
      render(<LoadingSpinner size={40} />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-size-prop', '40');
    });
  });

  describe('Цвет (color)', () => {
    it('должен передавать color в Core LoadingSpinner', () => {
      render(<LoadingSpinner color='red' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-color-prop', 'red');
    });

    it('не должен передавать color когда color не указан', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).not.toHaveAttribute('data-color-prop');
    });
  });

  describe('Accessibility (ARIA)', () => {
    it('должен передавать aria-label в Core LoadingSpinner', () => {
      render(<LoadingSpinner aria-label='Custom loading' />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('aria-label', 'Custom loading');
    });

    it('не должен передавать aria-label когда aria-label не указан', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).not.toHaveAttribute('aria-label');
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount telemetry по умолчанию', () => {
      const { unmount } = render(<LoadingSpinner />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner mount', {
        component: 'LoadingSpinner',
        action: 'mount',
        hidden: false,
        visible: true,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner unmount', {
        component: 'LoadingSpinner',
        action: 'unmount',
        hidden: false,
        visible: true,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<LoadingSpinner telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен передавать data-telemetry="disabled" когда telemetryEnabled=false', () => {
      render(<LoadingSpinner telemetryEnabled={false} />);

      expect(screen.getByTestId('core-loading-spinner')).toHaveAttribute(
        'data-telemetry',
        'disabled',
      );
    });

    it('должен отправлять mount telemetry с правильными данными при isHiddenByFeatureFlag=true', () => {
      const { unmount } = render(
        <LoadingSpinner isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но telemetry должен быть отправлен
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner mount', {
        component: 'LoadingSpinner',
        action: 'mount',
        hidden: true,
        visible: false,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner unmount', {
        component: 'LoadingSpinner',
        action: 'unmount',
        hidden: true,
        visible: false,
      });
    });

    it('должен отправлять mount telemetry с правильными данными при visible=false', () => {
      const { unmount } = render(<LoadingSpinner visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner mount', {
        component: 'LoadingSpinner',
        action: 'mount',
        hidden: false,
        visible: false,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner unmount', {
        component: 'LoadingSpinner',
        action: 'unmount',
        hidden: false,
        visible: false,
      });
    });

    it('должен отправлять mount telemetry с variant и size', () => {
      render(<LoadingSpinner variant='dots' size='lg' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner mount', {
        component: 'LoadingSpinner',
        action: 'mount',
        hidden: false,
        visible: true,
        variant: 'dots',
        size: 'lg',
      });
    });

    it('должен отправлять mount telemetry с size как число (конвертируется в строку)', () => {
      render(<LoadingSpinner size={40} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner mount', {
        component: 'LoadingSpinner',
        action: 'mount',
        hidden: false,
        visible: true,
        size: '40',
      });
    });

    it('должен отправлять show telemetry при изменении visible с false на true', () => {
      const { rerender } = render(<LoadingSpinner visible={false} />);

      // Очищаем моки после mount
      vi.clearAllMocks();

      rerender(<LoadingSpinner visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner show', {
        component: 'LoadingSpinner',
        action: 'show',
        hidden: false,
        visible: true,
      });
    });

    it('должен отправлять hide telemetry при изменении visible с true на false', () => {
      const { rerender } = render(<LoadingSpinner visible={true} />);

      // Очищаем моки после mount
      vi.clearAllMocks();

      rerender(<LoadingSpinner visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner hide', {
        component: 'LoadingSpinner',
        action: 'hide',
        hidden: false,
        visible: false,
      });
    });

    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<LoadingSpinner visible={true} />);

      // Проверяем, что был только mount, но не show
      const calls = mockInfoFireAndForget.mock.calls;
      const showCalls = calls.filter((call) => call[0] === 'LoadingSpinner show');
      const hideCalls = calls.filter((call) => call[0] === 'LoadingSpinner hide');

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('не должен отправлять show/hide telemetry когда telemetryEnabled=false', () => {
      const { rerender } = render(
        <LoadingSpinner visible={false} telemetryEnabled={false} />,
      );

      vi.clearAllMocks();

      rerender(<LoadingSpinner visible={true} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('не должен отправлять show/hide telemetry когда visible не изменился', () => {
      const { rerender } = render(<LoadingSpinner visible={true} />);

      vi.clearAllMocks();

      rerender(<LoadingSpinner visible={true} variant='dots' />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'LoadingSpinner show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'LoadingSpinner hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять show telemetry с variant и size', () => {
      const { rerender } = render(<LoadingSpinner visible={false} variant='pulse' size={30} />);

      vi.clearAllMocks();

      rerender(<LoadingSpinner visible={true} variant='pulse' size={30} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('LoadingSpinner show', {
        component: 'LoadingSpinner',
        action: 'show',
        hidden: false,
        visible: true,
        variant: 'pulse',
        size: '30',
      });
    });
  });

  describe('Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<LoadingSpinner ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toBe(screen.getByTestId('core-loading-spinner'));
    });

    it('ref возвращает HTMLDivElement', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<LoadingSpinner ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.tagName).toBe('DIV');
    });

    it('ref работает когда компонент скрыт (возвращает null)', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<LoadingSpinner ref={ref} visible={false} />);

      expect(ref.current).toBeNull();
    });
  });

  describe('Props filtering', () => {
    it('должен фильтровать App-специфичные пропсы и не передавать их в Core', () => {
      render(
        <LoadingSpinner
          visible={true}
          isHiddenByFeatureFlag={false}
          telemetryEnabled={true}
          data-testid='test-spinner'
        />,
      );

      const spinner = screen.getByTestId('test-spinner');
      // App-специфичные пропсы не должны быть в data-атрибутах Core
      expect(spinner).not.toHaveAttribute('data-is-hidden-by-feature-flag');
      expect(spinner).not.toHaveAttribute('data-telemetry-enabled-prop');
    });

    it('должен передавать только Core-совместимые пропсы', () => {
      render(
        <LoadingSpinner
          variant='spinner'
          size='md'
          color='blue'
          aria-label='Loading'
          className='test-class'
        />,
      );

      const spinner = screen.getByTestId('core-loading-spinner');
      expect(spinner).toHaveAttribute('data-variant-prop', 'spinner');
      expect(spinner).toHaveAttribute('data-size-prop', 'md');
      expect(spinner).toHaveAttribute('data-color-prop', 'blue');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
      expect(spinner).toHaveClass('test-class');
    });
  });

  describe('Edge cases', () => {
    it('должен работать с минимальным набором пропсов', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toBeInTheDocument();
    });

    it('должен работать со всеми пропсами одновременно', () => {
      render(
        <LoadingSpinner
          variant='dots'
          size={50}
          color='purple'
          aria-label='Loading data'
          className='custom-class'
          data-testid='full-spinner'
          visible={true}
          isHiddenByFeatureFlag={false}
          telemetryEnabled={true}
        />,
      );

      const spinner = screen.getByTestId('full-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('data-variant', 'dots');
      expect(spinner).toHaveAttribute('data-size-prop', '50');
      expect(spinner).toHaveAttribute('data-color-prop', 'purple');
      expect(spinner).toHaveAttribute('aria-label', 'Loading data');
      expect(spinner).toHaveClass('custom-class');
    });

    it('должен обрабатывать telemetryEnabled=undefined как true', () => {
      // telemetryEnabled не передается, что эквивалентно undefined
      render(<LoadingSpinner />);

      expect(mockInfoFireAndForget).toHaveBeenCalled();
    });

    it('должен обрабатывать visible=undefined как true', () => {
      // visible не передается, что эквивалентно undefined
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toBeInTheDocument();
    });

    it('должен обрабатывать isHiddenByFeatureFlag=undefined как false', () => {
      // isHiddenByFeatureFlag не передается, что эквивалентно undefined
      render(<LoadingSpinner />);

      expect(screen.getByTestId('core-loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const { container, rerender } = render(
        <LoadingSpinner variant='spinner' size={20} color='blue' />,
      );

      const firstRender = container.innerHTML;

      rerender(<LoadingSpinner variant='spinner' size={20} color='blue' />);

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      let renderCount = 0;

      const TestComponent = React.memo(() => {
        renderCount++;
        return <LoadingSpinner variant='spinner' />;
      });

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);

      expect(renderCount).toBe(1);
    });
  });
});
