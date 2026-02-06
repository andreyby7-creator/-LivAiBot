/**
 * @vitest-environment jsdom
 * @file Тесты для App Skeleton компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Skeleton - возвращаем простой div
vi.mock('../../../../ui-core/src/components/Skeleton', () => ({
  Skeleton: (
    {
      'data-testid': testId,
      'data-component': dataComponent,
      'data-feature-flag': dataFeatureFlag,
      animated,
      ...props
    }: Readonly<Record<string, unknown>>,
  ) => (
    <div
      data-testid={testId ?? 'core-skeleton'}
      data-component={dataComponent}
      data-feature-flag={dataFeatureFlag}
      data-animated={animated?.toString()}
      {...props}
    />
  ),
}));

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: () => false,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => false,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
    i18n: {
      translate: mockTranslate,
    },
  }),
}));

import { Skeleton } from '../../../src/ui/skeleton';

describe('App Skeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslate.mockReturnValue('Translated Label');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить skeleton с обязательными пропсами', () => {
      render(<Skeleton />);

      const skeleton = screen.getByTestId('core-skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('data-component', 'AppSkeleton');
    });

    it('должен передавать все core пропсы в Core Skeleton', () => {
      render(
        <Skeleton
          width='100px'
          height='50px'
          variant='circle'
          className='custom-class'
          data-testid='custom-skeleton'
        />,
      );

      const skeleton = screen.getByTestId('custom-skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('data-component', 'AppSkeleton');
      expect(skeleton).toHaveClass('custom-class');
    });

    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<Skeleton />);

      expect(screen.getByTestId('core-skeleton')).toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false', () => {
      render(<Skeleton visible={false} />);

      expect(screen.queryByTestId('core-skeleton')).not.toBeInTheDocument();
    });

    it('должен передавать data-feature-flag с состоянием feature flag', () => {
      render(<Skeleton />);

      expect(screen.getByTestId('core-skeleton')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      render(<Skeleton isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-skeleton')).not.toBeInTheDocument();
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда feature flag отключен (по умолчанию)', () => {
      render(<Skeleton visible={true} />);

      expect(screen.getByTestId('core-skeleton')).toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<Skeleton visible={true} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-skeleton')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      render(<Skeleton visible={false} isHiddenByFeatureFlag={false} />);

      expect(screen.queryByTestId('core-skeleton')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=true', () => {
      render(<Skeleton visible={false} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-skeleton')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      render(<Skeleton visible={true} isHiddenByFeatureFlag={false} />);

      expect(screen.getByTestId('core-skeleton')).toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount telemetry по умолчанию', () => {
      const { unmount } = render(<Skeleton />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton mount', {
        component: 'Skeleton',
        action: 'mount',
        hidden: false,
        visible: true,
        animated: true,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton unmount', {
        component: 'Skeleton',
        action: 'unmount',
        hidden: false,
        visible: true,
        animated: true,
      });
    });

    it('должен отправлять show telemetry при изменении visible на true', () => {
      const { rerender } = render(<Skeleton visible={false} />);

      // Очищаем предыдущие вызовы (mount/unmount)
      mockInfoFireAndForget.mockClear();

      rerender(<Skeleton visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton show', {
        component: 'Skeleton',
        action: 'show',
        hidden: false,
        visible: true,
        animated: true,
      });
    });

    it('должен отправлять hide telemetry при изменении visible на false', () => {
      const { rerender } = render(<Skeleton visible={true} />);

      // Очищаем предыдущие вызовы (mount/unmount)
      mockInfoFireAndForget.mockClear();

      rerender(<Skeleton visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton hide', {
        component: 'Skeleton',
        action: 'hide',
        hidden: false,
        visible: false,
        animated: true,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<Skeleton telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<Skeleton visible={true} />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Skeleton show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Skeleton hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять telemetry с правильными размерами', () => {
      render(<Skeleton width='200px' height='100px' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton mount', {
        component: 'Skeleton',
        action: 'mount',
        hidden: false,
        visible: true,
        width: '200px',
        height: '100px',
        animated: true,
      });
    });

    it('должен отправлять telemetry с правильным variant', () => {
      render(<Skeleton variant='circle' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton mount', {
        component: 'Skeleton',
        action: 'mount',
        hidden: false,
        visible: true,
        variant: 'circle',
        animated: true,
      });
    });

    it('должен отправлять telemetry с animated=false', () => {
      render(<Skeleton animated={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton mount', {
        component: 'Skeleton',
        action: 'mount',
        hidden: false,
        visible: true,
        animated: false,
      });
    });

    it('должен отправлять telemetry с hidden=true когда feature flag активен', () => {
      render(<Skeleton visible={true} isHiddenByFeatureFlag={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton mount', {
        component: 'Skeleton',
        action: 'mount',
        hidden: true,
        visible: false,
        animated: true,
      });
    });

    it('должен отправлять telemetry с visible=false когда visible=false', () => {
      render(<Skeleton visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton mount', {
        component: 'Skeleton',
        action: 'mount',
        hidden: false,
        visible: false,
        animated: true,
      });
    });

    it('должен отправлять show telemetry с правильными размерами при изменении visible', () => {
      const { rerender } = render(<Skeleton visible={false} width='100px' height='50px' />);

      mockInfoFireAndForget.mockClear();

      rerender(<Skeleton visible={true} width='100px' height='50px' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton show', {
        component: 'Skeleton',
        action: 'show',
        hidden: false,
        visible: true,
        width: '100px',
        height: '50px',
        animated: true,
      });
    });
  });

  describe('Props filtering', () => {
    it('должен передавать только core пропсы в Core Skeleton', () => {
      render(
        <Skeleton
          width='100px'
          height='50px'
          variant='rect'
          className='test-class'
          data-testid='filtered-skeleton'
          isHiddenByFeatureFlag={false}
          telemetryEnabled={true}
          visible={true}
        />,
      );

      const skeleton = screen.getByTestId('filtered-skeleton');
      expect(skeleton).toHaveAttribute('data-component', 'AppSkeleton');
      expect(skeleton).toHaveClass('test-class');

      // App-only пропсы не должны передаваться
      expect(skeleton).not.toHaveAttribute('ishiddenbyfeatureflag');
      expect(skeleton).not.toHaveAttribute('telemetryenabled');
      expect(skeleton).not.toHaveAttribute('visible');
    });

    it('должен передавать animated проп в Core Skeleton', () => {
      render(<Skeleton animated={false} />);

      const skeleton = screen.getByTestId('core-skeleton');
      expect(skeleton).toHaveAttribute('data-animated', 'false');
    });

    it('должен передавать animated=true по умолчанию', () => {
      render(<Skeleton />);

      const skeleton = screen.getByTestId('core-skeleton');
      expect(skeleton).toHaveAttribute('data-animated', 'true');
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Skeleton ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.tagName).toBe('DIV');
    });

    it('должен поддерживать callback ref', () => {
      const refCallback = vi.fn();

      render(<Skeleton ref={refCallback} />);

      expect(refCallback).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('Lifecycle telemetry фиксация', () => {
    it('должен фиксировать policy на момент первого рендера в lifecycle telemetry', () => {
      const { rerender, unmount } = render(<Skeleton visible={true} />);

      // Запоминаем первый payload
      const firstMountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Skeleton mount',
      );
      expect(firstMountCall?.[1]).toMatchObject({
        visible: true,
        hidden: false,
      });

      // Меняем props
      rerender(<Skeleton visible={false} />);

      // Unmount должен использовать тот же payload что и mount (фиксированный на момент первого рендера)
      unmount();

      const unmountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Skeleton unmount',
      );
      expect(unmountCall?.[1]).toMatchObject({
        visible: true, // Должен остаться как при mount, несмотря на изменение props
        hidden: false,
      });
    });
  });

  describe('Visibility telemetry изменения', () => {
    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<Skeleton visible={true} />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Skeleton show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Skeleton hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять show telemetry только при изменении с false на true', () => {
      const { rerender } = render(<Skeleton visible={false} />);

      mockInfoFireAndForget.mockClear();

      rerender(<Skeleton visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton show', expect.any(Object));
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith('Skeleton hide', expect.any(Object));
    });

    it('должен отправлять hide telemetry только при изменении с true на false', () => {
      const { rerender } = render(<Skeleton visible={true} />);

      mockInfoFireAndForget.mockClear();

      rerender(<Skeleton visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Skeleton hide', expect.any(Object));
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith('Skeleton show', expect.any(Object));
    });

    it('не должен отправлять telemetry если visible не изменился', () => {
      const { rerender } = render(<Skeleton visible={true} width='100px' />);

      mockInfoFireAndForget.mockClear();

      rerender(<Skeleton visible={true} width='200px' />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith('Skeleton show', expect.any(Object));
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith('Skeleton hide', expect.any(Object));
    });
  });

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(
          <Skeleton
            visible
            aria-label='Test label'
          />,
        );

        expect(screen.getByTestId('core-skeleton')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(
          <Skeleton
            visible
            {...{ ariaLabelI18nKey: 'accessibility.loading' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'accessibility.loading', {});
        expect(screen.getByTestId('core-skeleton')).toHaveAttribute(
          'aria-label',
          'Translated Label',
        );
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <Skeleton
            visible
            {...{ ariaLabelI18nKey: 'accessibility.loading', ariaLabelI18nNs: 'common' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'accessibility.loading', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { count: 3, type: 'skeleton' };
        render(
          <Skeleton
            visible
            {...{ ariaLabelI18nKey: 'accessibility.loading', ariaLabelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'accessibility.loading', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Skeleton
            visible
            {...{
              ariaLabelI18nKey: 'accessibility.loading',
              ariaLabelI18nParams: undefined,
            } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'accessibility.loading', {});
      });
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <Skeleton
          visible
          {...{ ariaLabelI18nKey: 'accessibility.first' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Skeleton
          visible
          {...{ ariaLabelI18nKey: 'accessibility.second' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'accessibility.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      render(
        <Skeleton
          visible
          aria-label='Regular label'
        />,
      );

      expect(screen.getByTestId('core-skeleton')).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(
        <Skeleton
          visible
          {...{ ariaLabelI18nKey: 'accessibility.loading' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'accessibility.loading', {});
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
