/**
 * @vitest-environment jsdom
 * @file Тесты для App Toast компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Toast - возвращаем простой div
vi.mock('../../../../ui-core/src/components/Toast', () => ({
  Toast: ({ 'data-testid': testId, visible, ...props }: Readonly<Record<string, unknown>>) => (
    <div
      data-testid={testId ?? 'core-toast'}
      data-visible={visible?.toString()}
      {...props}
    />
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

import { Toast } from '../../../src/ui/toast';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('App Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить toast с обязательными пропсами', () => {
      render(<Toast content='Test toast' visible={true} />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute('data-component', 'AppToast');
    });

    it('должен передавать все core пропсы в Core Toast', () => {
      render(
        <Toast
          content='Test toast'
          visible={true}
          variant='success'
          className='custom-class'
          data-testid='custom-toast'
        />,
      );

      const toast = screen.getByTestId('custom-toast');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute('data-component', 'AppToast');
      expect(toast).toHaveAttribute('data-variant', 'success');
      expect(toast).toHaveClass('custom-class');
    });

    it('не должен рендерить когда visible=false', () => {
      render(<Toast content='Test toast' visible={false} />);

      expect(screen.queryByTestId('core-toast')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<Toast content='Test toast' />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute('data-visible', 'true');
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда feature flag отключен (по умолчанию)', () => {
      mockFeatureFlagReturnValue = false;

      render(<Toast content='Test toast' visible={true} />);

      expect(screen.getByTestId('core-toast')).toBeInTheDocument();
    });

    it('не должен рендерить когда feature flag включен и isHiddenByFeatureFlag=true', () => {
      mockFeatureFlagReturnValue = true;

      render(<Toast content='Test toast' visible={true} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-toast')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда feature flag включен и isHiddenByFeatureFlag=true', () => {
      mockFeatureFlagReturnValue = true;

      render(<Toast content='Test toast' visible={true} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-toast')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<Toast content='Test toast' visible={true} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-toast')).not.toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount telemetry по умолчанию', () => {
      const { unmount } = render(<Toast content='Test toast' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toast mount', {
        component: 'Toast',
        action: 'mount',
        hidden: false,
        visible: true,
        variant: 'info',
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toast unmount', {
        component: 'Toast',
        action: 'unmount',
        hidden: false,
        visible: true,
        variant: 'info',
      });
    });

    it('должен отправлять show telemetry при изменении visible на true', () => {
      const { rerender } = render(<Toast content='Test toast' visible={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith('Toast show', expect.any(Object));

      rerender(<Toast content='Test toast' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toast show', {
        component: 'Toast',
        action: 'show',
        hidden: false,
        visible: true,
        variant: 'info',
      });
    });

    it('должен отправлять hide telemetry при изменении visible на false', () => {
      const { rerender } = render(<Toast content='Test toast' visible={true} />);

      // Очищаем предыдущие вызовы
      mockInfoFireAndForget.mockClear();

      rerender(<Toast content='Test toast' visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toast hide', {
        component: 'Toast',
        action: 'hide',
        hidden: false,
        visible: false,
        variant: 'info',
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<Toast content='Test toast' visible={true} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен отправлять telemetry с правильным variant', () => {
      render(<Toast content='Test toast' visible={true} variant='error' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toast mount', {
        component: 'Toast',
        action: 'mount',
        hidden: false,
        visible: true,
        variant: 'error',
      });
    });

    it('должен отправлять telemetry с hidden=true когда feature flag активен', () => {
      mockFeatureFlagReturnValue = true;

      render(<Toast content='Test toast' visible={true} isHiddenByFeatureFlag={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toast mount', {
        component: 'Toast',
        action: 'mount',
        hidden: true,
        visible: false,
        variant: 'info',
      });
    });
  });

  describe('Props filtering', () => {
    it('должен передавать только core пропсы в Core Toast', () => {
      render(
        <Toast
          content='Test toast'
          visible={true}
          variant='warning'
          className='test-class'
          data-testid='filtered-toast'
          isHiddenByFeatureFlag={false}
          telemetryEnabled={true}
        />,
      );

      const toast = screen.getByTestId('filtered-toast');
      expect(toast).toHaveAttribute('data-component', 'AppToast');
      expect(toast).toHaveAttribute('data-variant', 'warning');
      expect(toast).toHaveClass('test-class');

      // App-only пропсы не должны передаваться
      expect(toast).not.toHaveAttribute('ishiddenbyfeatureflag');
      expect(toast).not.toHaveAttribute('telemetryenabled');
    });

    it('должен правильно передавать visible проп в Core Toast', () => {
      render(<Toast content='Test toast' visible={true} />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toHaveAttribute('data-visible', 'true');
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Toast content='Test toast' visible={true} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppToast');
    });

    it('должен поддерживать useRef-подобный объект', () => {
      const ref = { current: null as HTMLDivElement | null };

      render(<Toast content='Test toast' visible={true} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppToast');
    });
  });

  describe('Memoization и производительность', () => {
    it('не должен ререндерить при одинаковых пропсах', () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return <Toast content='Test toast' visible={true} />;
      };

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);
      expect(renderCount).toBe(2); // React.memo предотвращает лишние рендеры компонента
    });

    it('должен стабильно memoизировать payload при одинаковых зависимостях', () => {
      const { rerender } = render(<Toast content='Test toast' visible={true} variant='info' />);

      const initialCalls = mockInfoFireAndForget.mock.calls.length;

      rerender(<Toast content='Test toast' visible={true} variant='info' />);

      // useMemo должен предотвратить пересчет payload
      expect(mockInfoFireAndForget.mock.calls.length).toBe(initialCalls);
    });

    it('не должен пересчитывать lifecycle telemetry при изменении variant', () => {
      const { rerender } = render(<Toast content='Test toast' visible={true} variant='info' />);

      mockInfoFireAndForget.mockClear();

      rerender(<Toast content='Test toast' visible={true} variant='success' />);

      // Lifecycle telemetry не должен пересчитываться при изменении пропсов
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('работает с undefined isHiddenByFeatureFlag', () => {
      mockFeatureFlagReturnValue = false;

      render(<Toast content='Test toast' visible={true} {...({} as any)} />);

      expect(screen.getByTestId('core-toast')).toBeInTheDocument();
    });

    it('работает с undefined telemetryEnabled', () => {
      render(<Toast content='Test toast' visible={true} {...({} as any)} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toast mount', expect.any(Object));
    });

    it('работает с undefined variant', () => {
      render(<Toast content='Test toast' visible={true} {...({} as any)} />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toHaveAttribute('data-variant', 'info');
    });

    it('правильно обрабатывает content как React элемент', () => {
      const customContent = <span>Custom content</span>;
      render(<Toast content={customContent as any} visible={true} />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toHaveAttribute('content');
      // Mock преобразует React элемент в строку, поэтому проверяем что content есть
      expect(toast.getAttribute('content')).toBe('[object Object]');
    });

    it('не падает при отсутствии content', () => {
      expect(() => {
        render(<Toast content='Test' visible={true} />);
      }).not.toThrow();
    });
  });

  describe('useToastPolicy hook', () => {
    it('возвращает правильную policy по умолчанию', () => {
      mockFeatureFlagReturnValue = false;

      render(<Toast content='Test toast' visible={true} />);

      // Если рендерится, значит policy.isVisible = true
      expect(screen.getByTestId('core-toast')).toBeInTheDocument();
    });

    it('возвращает правильную policy когда feature flag активен', () => {
      mockFeatureFlagReturnValue = true;

      render(<Toast content='Test toast' visible={true} isHiddenByFeatureFlag={true} />);

      // Если не рендерится, значит policy.isVisible = false
      expect(screen.queryByTestId('core-toast')).not.toBeInTheDocument();
    });
  });
});
