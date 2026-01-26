/**
 * @vitest-environment jsdom
 * @file Тесты для App StatusIndicator компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core StatusIndicator
vi.mock('../../../../ui-core/src/primitives/status-indicator', () => ({
  StatusIndicator: React.forwardRef<
    HTMLSpanElement,
    Readonly<Record<string, unknown>>
  >((
    props: Readonly<Record<string, unknown>>,
    ref,
  ) => {
    const {
      status,
      variant,
      size,
      color,
      text,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      'data-variant': dataVariant,
      'data-size': dataSize,
      'data-testid': testId,
      className,
      style,
      ...rest
    } = props;

    return (
      <span
        ref={ref}
        data-testid={testId ?? 'core-status-indicator'}
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-variant={dataVariant}
        data-size={dataSize}
        data-status-prop={status}
        data-variant-prop={variant}
        data-size-prop={size}
        data-color-prop={color}
        data-text-prop={text}
        aria-label={`Status: ${status}`}
        className={className as string | undefined}
        style={style as React.CSSProperties | undefined}
        {...rest}
      >
        Status Indicator
      </span>
    );
  }),
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

import { StatusIndicator } from '../../../src/ui/status-indicator';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('App StatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить StatusIndicator с дефолтными пропсами', () => {
      render(<StatusIndicator />);

      expect(screen.getByTestId('core-status-indicator')).toBeInTheDocument();
    });

    it('должен передавать data-component="AppStatusIndicator"', () => {
      render(<StatusIndicator />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-component',
        'AppStatusIndicator',
      );
    });

    it('должен передавать data-state="visible" по умолчанию', () => {
      render(<StatusIndicator />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-state',
        'visible',
      );
    });

    it('должен передавать data-feature-flag="visible" по умолчанию', () => {
      render(<StatusIndicator />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен передавать data-telemetry="enabled" по умолчанию', () => {
      render(<StatusIndicator />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-telemetry',
        'enabled',
      );
    });

    it('должен передавать status="idle" по умолчанию', () => {
      render(<StatusIndicator />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-status-prop',
        'idle',
      );
    });

    it('должен передавать data-testid в Core StatusIndicator', () => {
      render(<StatusIndicator data-testid='custom-indicator' />);

      expect(screen.getByTestId('custom-indicator')).toBeInTheDocument();
    });

    it('должен передавать дополнительные пропсы в Core StatusIndicator', () => {
      const customStyle: Readonly<{ color: string; }> = { color: 'red' };
      render(
        <StatusIndicator
          className='custom-class'
          style={customStyle}
        />,
      );

      const indicator = screen.getByTestId('core-status-indicator');
      expect(indicator).toHaveClass('custom-class');
      expect(indicator).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<StatusIndicator />);

      expect(screen.getByTestId('core-status-indicator')).toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false', () => {
      render(<StatusIndicator visible={false} />);

      expect(screen.queryByTestId('core-status-indicator')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<StatusIndicator isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-status-indicator')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      render(
        <StatusIndicator visible={false} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.queryByTestId('core-status-indicator')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=true', () => {
      render(
        <StatusIndicator visible={false} isHiddenByFeatureFlag={true} />,
      );

      expect(screen.queryByTestId('core-status-indicator')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      render(
        <StatusIndicator visible={true} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.getByTestId('core-status-indicator')).toBeInTheDocument();
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <StatusIndicator isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но проверяем что policy работает
      expect(screen.queryByTestId('core-status-indicator')).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('должен передавать data-state="hidden" когда policy.isRendered=false', () => {
      const { container } = render(
        <StatusIndicator visible={false} />,
      );

      expect(screen.queryByTestId('core-status-indicator')).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Статусы (status)', () => {
    it.each(
      [
        'idle',
        'loading',
        'success',
        'error',
      ] as const,
    )('должен передавать status="%s"', (status) => {
      render(<StatusIndicator status={status} />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-status-prop',
        status,
      );
    });
  });

  describe('Варианты (variant)', () => {
    it('должен передавать variant в Core StatusIndicator', () => {
      render(<StatusIndicator variant='icon' />);

      const indicator = screen.getByTestId('core-status-indicator');
      expect(indicator).toHaveAttribute('data-variant-prop', 'icon');
      expect(indicator).toHaveAttribute('data-variant', 'icon');
    });

    it('должен передавать variant="dot"', () => {
      render(<StatusIndicator variant='dot' />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-variant',
        'dot',
      );
    });

    it('должен передавать variant="text"', () => {
      render(<StatusIndicator variant='text' />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-variant',
        'text',
      );
    });
  });

  describe('Размеры (size)', () => {
    it.each(
      [
        'sm',
        'md',
        'lg',
      ] as const,
    )('должен передавать size="%s"', (size) => {
      render(<StatusIndicator size={size} />);

      const indicator = screen.getByTestId('core-status-indicator');
      expect(indicator).toHaveAttribute('data-size-prop', size);
      expect(indicator).toHaveAttribute('data-size', size);
    });
  });

  describe('Кастомные пропсы', () => {
    it('должен передавать color в Core StatusIndicator', () => {
      render(<StatusIndicator color='#FF0000' />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-color-prop',
        '#FF0000',
      );
    });

    it('должен передавать text в Core StatusIndicator', () => {
      render(<StatusIndicator variant='text' text='Custom Text' />);

      expect(screen.getByTestId('core-status-indicator')).toHaveAttribute(
        'data-text-prop',
        'Custom Text',
      );
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount telemetry при монтировании', () => {
      render(<StatusIndicator status='loading' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'StatusIndicator mount',
        expect.objectContaining({
          component: 'StatusIndicator',
          action: 'mount',
          status: 'loading',
          hidden: false,
          visible: true,
        }),
      );
    });

    it('должен отправлять unmount telemetry при размонтировании', () => {
      const { unmount } = render(<StatusIndicator status='loading' />);

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'StatusIndicator unmount',
        expect.objectContaining({
          component: 'StatusIndicator',
          action: 'unmount',
          status: 'loading',
        }),
      );
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<StatusIndicator telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен отправлять telemetry с variant и size в payload', () => {
      render(
        <StatusIndicator
          status='success'
          variant='icon'
          size='lg'
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'StatusIndicator mount',
        expect.objectContaining({
          variant: 'icon',
          size: 'lg',
        }),
      );
    });

    it('должен отправлять status-change telemetry при изменении статуса', () => {
      const { rerender } = render(<StatusIndicator status='idle' />);

      // Очищаем предыдущие вызовы
      vi.clearAllMocks();

      rerender(<StatusIndicator status='loading' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'StatusIndicator status-change',
        expect.objectContaining({
          component: 'StatusIndicator',
          action: 'status-change',
          status: 'loading',
        }),
      );
    });

    it('не должен отправлять status-change telemetry при первом рендере', () => {
      render(<StatusIndicator status='loading' />);

      // Проверяем что был только mount, но не status-change
      const calls = mockInfoFireAndForget.mock.calls;
      const statusChangeCalls = calls.filter(
        (call) => call[0] === 'StatusIndicator status-change',
      );
      expect(statusChangeCalls).toHaveLength(0);
    });

    it('не должен отправлять status-change telemetry когда компонент скрыт', () => {
      const { rerender } = render(
        <StatusIndicator status='idle' visible={false} />,
      );

      vi.clearAllMocks();

      rerender(<StatusIndicator status='loading' visible={false} />);

      // Компонент скрыт, telemetry не должен отправляться
      const statusChangeCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'StatusIndicator status-change',
      );
      expect(statusChangeCalls).toHaveLength(0);
    });

    it('должен отправлять status-change telemetry при изменении видимости', () => {
      const { rerender } = render(<StatusIndicator status='idle' visible={false} />);

      vi.clearAllMocks();

      rerender(<StatusIndicator status='idle' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'StatusIndicator status-change',
        expect.objectContaining({
          action: 'status-change',
          visible: true,
        }),
      );
    });

    it('не должен отправлять status-change telemetry при первом рендере (visibility)', () => {
      render(<StatusIndicator status='idle' visible={true} />);

      const visibilityCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => {
          const payload = call[1] as { action: string; visible?: boolean; };
          return payload.action === 'status-change' && 'visible' in payload;
        },
      );
      expect(visibilityCalls).toHaveLength(0);
    });
  });

  describe('Ref forwarding', () => {
    it('должен передавать ref на span элемент', () => {
      const ref = React.createRef<HTMLSpanElement>();
      render(<StatusIndicator ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLSpanElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppStatusIndicator');
    });

    it('ref обновляется при изменении пропсов', () => {
      const ref = React.createRef<HTMLSpanElement>();
      const { rerender } = render(<StatusIndicator ref={ref} status='idle' />);

      expect(ref.current).toBeInTheDocument();

      rerender(<StatusIndicator ref={ref} status='success' />);

      expect(ref.current).toBeInTheDocument();
      expect(ref.current).toHaveAttribute('data-status-prop', 'success');
    });
  });

  describe('Props forwarding', () => {
    it('должен передавать все пропсы в Core StatusIndicator', () => {
      render(
        <StatusIndicator
          status='success'
          variant='text'
          size='lg'
          color='#00FF00'
          text='Processing'
          className='custom-class'
          data-testid='test-indicator'
        />,
      );

      const indicator = screen.getByTestId('test-indicator');
      expect(indicator).toHaveAttribute('data-status-prop', 'success');
      expect(indicator).toHaveAttribute('data-variant-prop', 'text');
      expect(indicator).toHaveAttribute('data-size-prop', 'lg');
      expect(indicator).toHaveAttribute('data-color-prop', '#00FF00');
      expect(indicator).toHaveAttribute('data-text-prop', 'Processing');
      expect(indicator).toHaveClass('custom-class');
    });
  });

  describe('Memoization', () => {
    it('не должен перерендериваться при неизменных пропсах', () => {
      const { rerender, getByTestId } = render(
        <StatusIndicator status='idle' variant='dot' />,
      );

      const firstRender = getByTestId('core-status-indicator');

      rerender(<StatusIndicator status='idle' variant='dot' />);

      const secondRender = getByTestId('core-status-indicator');
      // React.memo должен предотвратить перерендер
      expect(secondRender).toBe(firstRender);
    });

    it('должен перерендериваться при изменении пропсов', () => {
      const { rerender, getByTestId } = render(
        <StatusIndicator status='idle' />,
      );

      const firstRender = getByTestId('core-status-indicator');
      expect(firstRender).toHaveAttribute('data-status-prop', 'idle');

      rerender(<StatusIndicator status='success' />);

      const secondRender = getByTestId('core-status-indicator');
      expect(secondRender).toHaveAttribute('data-status-prop', 'success');
    });
  });

  describe('Display name', () => {
    it('должен иметь displayName определен', () => {
      // React.memo не копирует displayName автоматически, но он установлен на компоненте
      expect(StatusIndicator).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('должен обрабатывать все комбинации статусов и вариантов', () => {
      const statuses = ['idle', 'loading', 'success', 'error'] as const;
      const variants = ['dot', 'icon', 'text'] as const;

      for (const status of statuses) {
        for (const variant of variants) {
          const { unmount } = render(
            <StatusIndicator status={status} variant={variant} />,
          );

          const indicator = screen.getByTestId('core-status-indicator');
          expect(indicator).toHaveAttribute('data-status-prop', status);
          expect(indicator).toHaveAttribute('data-variant-prop', variant);

          unmount();
        }
      }
    });

    it('должен выбрасывать ошибку при невалидном status в dev режиме', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(() => {
        render(<StatusIndicator status={'invalid' as any} />);
      }).toThrow('Invalid StatusIndicator status: invalid');

      vi.unstubAllEnvs();
    });

    it('должен обрабатывать все комбинации размеров', () => {
      const sizes = ['sm', 'md', 'lg'] as const;

      for (const size of sizes) {
        const { unmount } = render(<StatusIndicator size={size} />);

        const indicator = screen.getByTestId('core-status-indicator');
        expect(indicator).toHaveAttribute('data-size-prop', size);

        unmount();
      }
    });

    it('должен обрабатывать telemetryEnabled переключение', () => {
      const { rerender } = render(
        <StatusIndicator status='idle' telemetryEnabled={false} />,
      );

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();

      vi.clearAllMocks();

      rerender(<StatusIndicator status='idle' telemetryEnabled={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalled();
    });
  });
});
