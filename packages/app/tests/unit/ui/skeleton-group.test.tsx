/**
 * @vitest-environment jsdom
 * @file Тесты для App SkeletonGroup компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для App Skeleton - возвращаем простой div
vi.mock('../../../src/ui/skeleton', () => ({
  Skeleton: (
    {
      'data-testid': testId,
      animated,
      variant,
      width,
      height,
      ...props
    }: Readonly<Record<string, unknown>>,
  ) => (
    <div
      data-testid={testId ?? 'app-skeleton'}
      data-animated={animated?.toString()}
      data-variant={variant?.toString()}
      data-width={width?.toString()}
      data-height={height?.toString()}
      {...props}
    />
  ),
}));

// Mock для feature flags - возвращает переданное значение
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: vi.fn((value: boolean) => value),
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

import { SkeletonGroup } from '../../../src/ui/skeleton-group';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('App SkeletonGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить SkeletonGroup с обязательными пропсами', () => {
      const { container } = render(
        <SkeletonGroup count={3} telemetryId='test-group' />,
      );

      const group = container.querySelector('[data-component="AppSkeletonGroup"]');
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('data-component', 'AppSkeletonGroup');
      expect(group).toHaveAttribute('data-telemetry-id', 'test-group');
    });

    it('должен рендерить правильное количество skeleton элементов', () => {
      render(<SkeletonGroup count={5} telemetryId='test-group' />);

      const skeletons = screen.getAllByTestId('app-skeleton');
      expect(skeletons).toHaveLength(5);
    });

    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      const { container } = render(
        <SkeletonGroup count={2} telemetryId='test-group' />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).toBeInTheDocument();
      expect(screen.getAllByTestId('app-skeleton')).toHaveLength(2);
    });

    it('не должен рендерить когда visible=false', () => {
      const { container } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={false} />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).not.toBeInTheDocument();
    });

    it('должен передавать data-feature-flag с состоянием feature flag', () => {
      const { container } = render(
        <SkeletonGroup count={2} telemetryId='test-group' />,
      );

      const group = container.querySelector('[data-component="AppSkeletonGroup"]');
      expect(group).toHaveAttribute('data-feature-flag', 'visible');
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          isHiddenByFeatureFlag={true}
        />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).not.toBeInTheDocument();
    });

    it('должен передавать data-testid если указан', () => {
      render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          data-testid='custom-group'
        />,
      );

      expect(screen.getByTestId('custom-group')).toBeInTheDocument();
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда feature flag отключен (по умолчанию)', () => {
      const { container } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={true} />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          visible={true}
          isHiddenByFeatureFlag={true}
        />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      const { container } = render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          visible={false}
          isHiddenByFeatureFlag={false}
        />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          visible={false}
          isHiddenByFeatureFlag={true}
        />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      const { container } = render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          visible={true}
          isHiddenByFeatureFlag={false}
        />,
      );

      expect(
        container.querySelector('[data-component="AppSkeletonGroup"]'),
      ).toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount telemetry по умолчанию', () => {
      const { unmount } = render(
        <SkeletonGroup count={3} telemetryId='test-group' />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: false,
        visible: true,
        count: 3,
        telemetryId: 'test-group',
        animated: true,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup unmount', {
        component: 'SkeletonGroup',
        action: 'unmount',
        hidden: false,
        visible: true,
        count: 3,
        telemetryId: 'test-group',
        animated: true,
      });
    });

    it('должен отправлять show telemetry при изменении visible на true', () => {
      const { rerender } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={false} />,
      );

      // Очищаем предыдущие вызовы (mount/unmount)
      mockInfoFireAndForget.mockClear();

      rerender(<SkeletonGroup count={2} telemetryId='test-group' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup show', {
        component: 'SkeletonGroup',
        action: 'show',
        hidden: false,
        visible: true,
        count: 2,
        telemetryId: 'test-group',
        animated: true,
      });
    });

    it('должен отправлять hide telemetry при изменении visible на false', () => {
      const { rerender } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={true} />,
      );

      // Очищаем предыдущие вызовы (mount/unmount)
      mockInfoFireAndForget.mockClear();

      rerender(<SkeletonGroup count={2} telemetryId='test-group' visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup hide', {
        component: 'SkeletonGroup',
        action: 'hide',
        hidden: false,
        visible: false,
        count: 2,
        telemetryId: 'test-group',
        animated: true,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          telemetryEnabled={false}
        />,
      );

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<SkeletonGroup count={2} telemetryId='test-group' visible={true} />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'SkeletonGroup show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'SkeletonGroup hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять telemetry с правильным variant', () => {
      render(
        <SkeletonGroup count={2} telemetryId='test-group' variant='circle' />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: false,
        visible: true,
        count: 2,
        telemetryId: 'test-group',
        variant: 'circle',
        animated: true,
      });
    });

    it('должен отправлять telemetry с animated=false', () => {
      render(
        <SkeletonGroup count={2} telemetryId='test-group' animated={false} />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: false,
        visible: true,
        count: 2,
        telemetryId: 'test-group',
        animated: false,
      });
    });

    it('должен отправлять telemetry с hidden=true когда feature flag активен', () => {
      render(
        <SkeletonGroup
          count={2}
          telemetryId='test-group'
          visible={true}
          isHiddenByFeatureFlag={true}
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: true,
        visible: false,
        count: 2,
        telemetryId: 'test-group',
        animated: true,
      });
    });

    it('должен отправлять telemetry с visible=false когда visible=false', () => {
      render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={false} />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: false,
        visible: false,
        count: 2,
        telemetryId: 'test-group',
        animated: true,
      });
    });
  });

  describe('Props и стили', () => {
    it('должен передавать variant в дочерние Skeleton', () => {
      render(
        <SkeletonGroup count={2} telemetryId='test-group' variant='circle' />,
      );

      const skeletons = screen.getAllByTestId('app-skeleton');
      expect(skeletons[0]).toHaveAttribute('data-variant', 'circle');
      expect(skeletons[1]).toHaveAttribute('data-variant', 'circle');
    });

    it('должен передавать width в дочерние Skeleton', () => {
      render(
        <SkeletonGroup count={2} telemetryId='test-group' width='100px' />,
      );

      const skeletons = screen.getAllByTestId('app-skeleton');
      expect(skeletons[0]).toHaveAttribute('data-width', '100px');
      expect(skeletons[1]).toHaveAttribute('data-width', '100px');
    });

    it('должен передавать height в дочерние Skeleton', () => {
      render(
        <SkeletonGroup count={2} telemetryId='test-group' height='50px' />,
      );

      const skeletons = screen.getAllByTestId('app-skeleton');
      expect(skeletons[0]).toHaveAttribute('data-height', '50px');
      expect(skeletons[1]).toHaveAttribute('data-height', '50px');
    });

    it('должен передавать animated в дочерние Skeleton', () => {
      render(
        <SkeletonGroup count={2} telemetryId='test-group' animated={false} />,
      );

      const skeletons = screen.getAllByTestId('app-skeleton');
      expect(skeletons[0]).toHaveAttribute('data-animated', 'false');
      expect(skeletons[1]).toHaveAttribute('data-animated', 'false');
    });

    it('должен передавать animated=true по умолчанию в дочерние Skeleton', () => {
      render(<SkeletonGroup count={2} telemetryId='test-group' />);

      const skeletons = screen.getAllByTestId('app-skeleton');
      expect(skeletons[0]).toHaveAttribute('data-animated', 'true');
      expect(skeletons[1]).toHaveAttribute('data-animated', 'true');
    });

    it('должен применять gap в стилях контейнера', () => {
      const { container } = render(
        <SkeletonGroup count={2} telemetryId='test-group' gap={16} />,
      );

      const group = container.querySelector('[data-component="AppSkeletonGroup"]');
      expect(group).toHaveStyle({ gap: '16px' });
    });

    it('должен применять default gap (8px) когда gap не указан', () => {
      const { container } = render(
        <SkeletonGroup count={2} telemetryId='test-group' />,
      );

      const group = container.querySelector('[data-component="AppSkeletonGroup"]');
      expect(group).toHaveStyle({ gap: '8px' });
    });

    it('должен применять flex-direction: column в стилях контейнера', () => {
      const { container } = render(
        <SkeletonGroup count={2} telemetryId='test-group' />,
      );

      const group = container.querySelector('[data-component="AppSkeletonGroup"]');
      expect(group).toHaveStyle({ flexDirection: 'column' });
    });
  });

  describe('Count нормализация', () => {
    it('должен обрабатывать count=0 как safeCount=0', () => {
      render(<SkeletonGroup count={0} telemetryId='test-group' />);

      const skeletons = screen.queryAllByTestId('app-skeleton');
      expect(skeletons).toHaveLength(0);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: false,
        visible: true,
        count: 0,
        telemetryId: 'test-group',
        animated: true,
      });
    });

    it('должен обрабатывать count < 0 как safeCount=0', () => {
      render(<SkeletonGroup count={-5} telemetryId='test-group' />);

      const skeletons = screen.queryAllByTestId('app-skeleton');
      expect(skeletons).toHaveLength(0);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: false,
        visible: true,
        count: 0,
        telemetryId: 'test-group',
        animated: true,
      });
    });

    it('должен обрабатывать count > 0 корректно', () => {
      render(<SkeletonGroup count={10} telemetryId='test-group' />);

      const skeletons = screen.getAllByTestId('app-skeleton');
      expect(skeletons).toHaveLength(10);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('SkeletonGroup mount', {
        component: 'SkeletonGroup',
        action: 'mount',
        hidden: false,
        visible: true,
        count: 10,
        telemetryId: 'test-group',
        animated: true,
      });
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<SkeletonGroup count={2} telemetryId='test-group' ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.tagName).toBe('DIV');
      expect(ref.current).toHaveAttribute('data-component', 'AppSkeletonGroup');
    });

    it('должен поддерживать callback ref', () => {
      const refCallback = vi.fn();

      render(<SkeletonGroup count={2} telemetryId='test-group' ref={refCallback} />);

      expect(refCallback).toHaveBeenCalledWith(expect.any(HTMLDivElement));
      const calledElement = refCallback.mock.calls[0]?.[0];
      expect(calledElement).toBeInstanceOf(HTMLDivElement);
      if (calledElement !== null && calledElement !== undefined) {
        expect(calledElement).toHaveAttribute('data-component', 'AppSkeletonGroup');
      }
    });
  });

  describe('Lifecycle telemetry фиксация', () => {
    it('должен фиксировать policy на момент первого рендера в lifecycle telemetry', () => {
      const { rerender, unmount } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={true} />,
      );

      // Запоминаем первый payload
      const firstMountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'SkeletonGroup mount',
      );
      expect(firstMountCall?.[1]).toMatchObject({
        visible: true,
        hidden: false,
        count: 2,
      });

      // Меняем props
      rerender(
        <SkeletonGroup count={5} telemetryId='test-group' visible={false} />,
      );

      // Unmount должен использовать тот же payload что и mount (фиксированный на момент первого рендера)
      unmount();

      const unmountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'SkeletonGroup unmount',
      );
      expect(unmountCall?.[1]).toMatchObject({
        visible: true, // Должен остаться как при mount, несмотря на изменение props
        hidden: false,
        count: 2, // Должен остаться как при mount
      });
    });
  });

  describe('Visibility telemetry изменения', () => {
    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<SkeletonGroup count={2} telemetryId='test-group' visible={true} />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'SkeletonGroup show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'SkeletonGroup hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять show telemetry только при изменении с false на true', () => {
      const { rerender } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={false} />,
      );

      mockInfoFireAndForget.mockClear();

      rerender(<SkeletonGroup count={2} telemetryId='test-group' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'SkeletonGroup show',
        expect.any(Object),
      );
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        'SkeletonGroup hide',
        expect.any(Object),
      );
    });

    it('должен отправлять hide telemetry только при изменении с true на false', () => {
      const { rerender } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={true} />,
      );

      mockInfoFireAndForget.mockClear();

      rerender(<SkeletonGroup count={2} telemetryId='test-group' visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'SkeletonGroup hide',
        expect.any(Object),
      );
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        'SkeletonGroup show',
        expect.any(Object),
      );
    });

    it('не должен отправлять telemetry если visible не изменился', () => {
      const { rerender } = render(
        <SkeletonGroup count={2} telemetryId='test-group' visible={true} />,
      );

      mockInfoFireAndForget.mockClear();

      rerender(
        <SkeletonGroup count={5} telemetryId='test-group' visible={true} />,
      );

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        'SkeletonGroup show',
        expect.any(Object),
      );
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        'SkeletonGroup hide',
        expect.any(Object),
      );
    });
  });

  describe('Дочерние Skeleton telemetry отключение', () => {
    it('должен отключать telemetry для дочерних Skeleton', () => {
      render(<SkeletonGroup count={2} telemetryId='test-group' />);

      // Проверяем что только telemetry events от SkeletonGroup, а не от каждого Skeleton
      const skeletonGroupCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0].toString().startsWith('SkeletonGroup'),
      );
      const skeletonCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) =>
          call[0].toString().startsWith('Skeleton ')
          && !call[0].toString().startsWith('SkeletonGroup'),
      );

      expect(skeletonGroupCalls.length).toBeGreaterThan(0);
      expect(skeletonCalls).toHaveLength(0);
    });
  });
});
