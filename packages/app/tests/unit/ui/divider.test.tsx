/**
 * @vitest-environment jsdom
 * @file Тесты для App Divider компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Divider - возвращаем простой div
vi.mock('../../../../ui-core/src/primitives/divider', () => ({
  Divider: ({ 'data-testid': testId, ...props }: Readonly<Record<string, unknown>>) => (
    <div data-testid={testId ?? 'core-divider'} {...props} />
  ),
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

import { Divider } from '../../../src/ui/divider';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('App Divider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить divider с обязательными пропсами', () => {
      render(<Divider />);

      const divider = screen.getByTestId('core-divider');
      expect(divider).toBeInTheDocument();
      expect(divider).toHaveAttribute('data-component', 'AppDivider');
    });

    it('должен передавать все пропсы в Core Divider', () => {
      render(
        <Divider
          orientation='vertical'
          thickness={5}
          color='blue'
          length='100px'
          className='custom-class'
          data-testid='custom-divider'
        />,
      );

      const divider = screen.getByTestId('custom-divider');
      expect(divider).toBeInTheDocument();
      expect(divider).toHaveAttribute('orientation', 'vertical');
      expect(divider).toHaveAttribute('thickness', '5');
      expect(divider).toHaveAttribute('color', 'blue');
      expect(divider).toHaveAttribute('length', '100px');
      expect(divider).toHaveClass('custom-class');
    });

    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLElement>();
      render(<Divider ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Feature flags (policy)', () => {
    it('должен рендерить divider когда feature flag отключен', () => {
      mockFeatureFlagReturnValue = false;

      render(<Divider />);

      const divider = screen.getByTestId('core-divider');
      expect(divider).toBeInTheDocument();
    });

    it('должен скрывать divider когда feature flag включен', () => {
      mockFeatureFlagReturnValue = true;

      render(<Divider isHiddenByFeatureFlag={true} />);

      const divider = screen.queryByTestId('core-divider');
      expect(divider).not.toBeInTheDocument();
    });

    it('должен учитывать isHiddenByFeatureFlag пропс в policy', () => {
      mockFeatureFlagReturnValue = false;

      render(<Divider isHiddenByFeatureFlag={false} />);
      expect(screen.getByTestId('core-divider')).toBeInTheDocument();

      cleanup();

      mockFeatureFlagReturnValue = true;
      render(<Divider isHiddenByFeatureFlag={true} />);
      expect(screen.queryByTestId('core-divider')).not.toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять telemetry при mount когда telemetry включен', () => {
      mockFeatureFlagReturnValue = false;

      render(<Divider telemetryEnabled={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Divider mount', {
        component: 'Divider',
        action: 'mount',
        hidden: false,
        orientation: 'horizontal',
        color: 'var(--divider-color, #E5E7EB)',
      });
    });

    it('должен отправлять telemetry при unmount когда telemetry включен', () => {
      mockFeatureFlagReturnValue = false;

      const { unmount } = render(<Divider telemetryEnabled={true} />);

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2);
      expect(mockInfoFireAndForget).toHaveBeenNthCalledWith(1, 'Divider mount', expect.any(Object));
      expect(mockInfoFireAndForget).toHaveBeenNthCalledWith(2, 'Divider unmount', {
        component: 'Divider',
        action: 'unmount',
        hidden: false,
        orientation: 'horizontal',
        color: 'var(--divider-color, #E5E7EB)',
      });
    });

    it('не должен отправлять telemetry когда telemetry отключен', () => {
      mockFeatureFlagReturnValue = false;

      render(<Divider telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен отправлять telemetry с правильными данными когда divider скрыт', () => {
      mockFeatureFlagReturnValue = true;

      render(<Divider isHiddenByFeatureFlag={true} telemetryEnabled={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Divider mount', {
        component: 'Divider',
        action: 'mount',
        hidden: true,
        orientation: 'horizontal',
        color: 'var(--divider-color, #E5E7EB)',
      });
    });

    it('должен отправлять telemetry с кастомными пропсами', () => {
      mockFeatureFlagReturnValue = false;

      render(
        <Divider
          telemetryEnabled={true}
          orientation='vertical'
          color='red'
          thickness={3}
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Divider mount', {
        component: 'Divider',
        action: 'mount',
        hidden: false,
        orientation: 'vertical',
        color: 'red',
      });
    });
  });

  describe('Policy логика', () => {
    it('должен правильно рассчитывать policy когда feature flag false', () => {
      mockFeatureFlagReturnValue = false;

      render(<Divider telemetryEnabled={true} />);
      expect(screen.getByTestId('core-divider')).toBeInTheDocument();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'Divider mount',
        expect.objectContaining({
          hidden: false,
        }),
      );
    });

    it('должен правильно рассчитывать policy когда feature flag true', () => {
      mockFeatureFlagReturnValue = true;

      render(<Divider isHiddenByFeatureFlag={true} telemetryEnabled={true} />);
      expect(screen.queryByTestId('core-divider')).not.toBeInTheDocument();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'Divider mount',
        expect.objectContaining({
          hidden: true,
        }),
      );
    });

    it('должен правильно рассчитывать telemetryEnabled по умолчанию', () => {
      mockFeatureFlagReturnValue = false;

      render(<Divider />);
      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // telemetryEnabled !== false
    });

    it('должен правильно рассчитывать telemetryEnabled когда явно отключен', () => {
      mockFeatureFlagReturnValue = false;

      render(<Divider telemetryEnabled={false} />);
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Props разделение', () => {
    it('должен передавать только core пропсы в Core Divider', () => {
      render(
        <Divider
          orientation='horizontal'
          thickness={2}
          isHiddenByFeatureFlag={false}
          telemetryEnabled={true}
        />,
      );

      const divider = screen.getByTestId('core-divider');
      expect(divider).toHaveAttribute('orientation', 'horizontal');
      expect(divider).toHaveAttribute('thickness', '2');

      // App-specific пропсы не должны передаваться
      expect(divider).not.toHaveAttribute('isHiddenByFeatureFlag');
      expect(divider).not.toHaveAttribute('telemetryEnabled');
    });
  });

  describe('Memoization и производительность', () => {
    it('должен стабильно рендерится с одинаковыми пропсами', () => {
      const { container: container1 } = render(<Divider orientation='vertical' />);
      const { container: container2 } = render(<Divider orientation='vertical' />);

      expect(container1.innerHTML).toBe(container2.innerHTML);
    });

    it('должен перерендериваться при изменении пропсов', () => {
      const { rerender } = render(<Divider orientation='horizontal' />);

      expect(screen.getByTestId('core-divider')).toHaveAttribute('orientation', 'horizontal');

      rerender(<Divider orientation='vertical' />);
      expect(screen.getByTestId('core-divider')).toHaveAttribute('orientation', 'vertical');
    });
  });

  describe('Edge cases', () => {
    it('должен работать без пропсов (дефолтные значения)', () => {
      render(<Divider />);

      const divider = screen.getByTestId('core-divider');
      expect(divider).toBeInTheDocument();
    });

    it('должен работать без пропсов', () => {
      render(<Divider />);

      const divider = screen.getByTestId('core-divider');
      expect(divider).toBeInTheDocument();
      expect(divider).toHaveAttribute('data-component', 'AppDivider');
    });

    it('должен корректно обрабатывать boolean пропсы', () => {
      // isHiddenByFeatureFlag как true
      mockFeatureFlagReturnValue = true;
      render(<Divider isHiddenByFeatureFlag={true} />);
      expect(screen.queryByTestId('core-divider')).not.toBeInTheDocument();

      cleanup();

      // isHiddenByFeatureFlag как false
      mockFeatureFlagReturnValue = false;
      render(<Divider isHiddenByFeatureFlag={false} />);
      expect(screen.getByTestId('core-divider')).toBeInTheDocument();
    });
  });
});
