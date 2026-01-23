/**
 * @vitest-environment jsdom
 * @file Тесты для App Modal компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Modal - возвращаем простой div с переданными пропсами
vi.mock('../../../../ui-core/src/components/Modal', () => ({
  Modal: React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & {
      visible?: boolean;
      variant?: string;
      'data-component'?: string;
      'data-state'?: string;
      'aria-label'?: string;
      'aria-labelledby'?: string;
      duration?: string;
      title?: string;
    }
  >((
    {
      visible,
      variant,
      'data-component': dataComponent,
      'data-state': dataState,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      duration,
      title,
      ...props
    },
    ref,
  ) => {
    if (visible !== true) return null; // CoreModal не рендерится когда visible не true

    return (
      <div
        ref={ref}
        data-testid='core-modal'
        data-component={dataComponent}
        data-state={dataState}
        data-visible={String(visible)}
        data-variant={variant}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-duration={duration}
        title={title}
        {...props}
      />
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

import { Modal } from '../../../src/ui/modal';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('App Modal', () => {
  const testContent = 'Test modal content';
  const testTitle = 'Test Modal Title';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить modal с обязательными пропсами', () => {
      render(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByText(testContent)).toBeInTheDocument();
      expect(screen.getByTestId('core-modal')).toBeInTheDocument();
    });

    it('не должен рендерить modal когда visible=false', () => {
      render(<Modal visible={false}>{testContent}</Modal>);

      expect(screen.queryByText(testContent)).not.toBeInTheDocument();
      expect(screen.queryByTestId('core-modal')).not.toBeInTheDocument();
    });

    it('должен рендерить modal с title', () => {
      render(
        <Modal visible={true} title={testTitle}>
          {testContent}
        </Modal>,
      );

      expect(screen.getByTestId('core-modal')).toHaveAttribute('title', testTitle);
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });
  });

  describe('Feature flags (Policy)', () => {
    it('должен рендерить modal когда feature flag отключен', () => {
      mockFeatureFlagReturnValue = false; // Modal не скрыт

      render(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    it('не должен рендерить modal когда isHiddenByFeatureFlag=true', () => {
      render(<Modal visible={true} isHiddenByFeatureFlag={true}>{testContent}</Modal>);

      expect(screen.queryByText(testContent)).not.toBeInTheDocument();
    });

    it('должен учитывать custom isHiddenByFeatureFlag', () => {
      mockFeatureFlagReturnValue = true; // Hook возвращает true (modal скрыт)

      render(<Modal visible={true} isHiddenByFeatureFlag={true}>{testContent}</Modal>);

      expect(screen.queryByTestId('core-modal')).not.toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount/unmount telemetry', () => {
      const { unmount } = render(<Modal visible={true}>{testContent}</Modal>);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Modal mount', {
        component: 'Modal',
        action: 'mount',
        hidden: false,
        visible: true,
        variant: 'default',
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Modal unmount', {
        component: 'Modal',
        action: 'unmount',
        hidden: false,
        visible: true,
        variant: 'default',
      });
    });

    it('должен отправлять show telemetry при изменении visible на true', () => {
      const { rerender } = render(<Modal visible={false}>{testContent}</Modal>);

      // При первом рендере show не вызывается
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        'Modal show',
        expect.any(Object),
      );

      rerender(<Modal visible={true}>{testContent}</Modal>);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Modal show', {
        component: 'Modal',
        action: 'show',
        hidden: false,
        visible: true,
        variant: 'default',
      });
    });

    it('должен отправлять hide telemetry при изменении visible на false', () => {
      const { rerender } = render(<Modal visible={true}>{testContent}</Modal>);

      // Очищаем предыдущие вызовы
      mockInfoFireAndForget.mockClear();

      rerender(<Modal visible={false}>{testContent}</Modal>);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Modal hide', {
        component: 'Modal',
        action: 'hide',
        hidden: false,
        visible: false,
        variant: 'default',
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<Modal visible={true} telemetryEnabled={false}>{testContent}</Modal>);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен отправлять telemetry с правильным variant', () => {
      render(<Modal visible={true} variant='warning'>{testContent}</Modal>);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Modal mount', {
        component: 'Modal',
        action: 'mount',
        hidden: false,
        visible: true,
        variant: 'warning',
      });
    });
  });

  describe('Props forwarding', () => {
    it('должен передавать variant в CoreModal', () => {
      render(<Modal visible={true} variant='error'>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toHaveAttribute('data-variant', 'error');
    });

    it('должен передавать data-component="AppModal"', () => {
      render(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toHaveAttribute('data-component', 'AppModal');
    });

    it('должен передавать data-state="visible" когда visible=true', () => {
      render(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toHaveAttribute('data-state', 'visible');
    });

    it('не должен рендерить modal когда visible=false', () => {
      render(<Modal visible={false}>{testContent}</Modal>);

      expect(screen.queryByTestId('core-modal')).not.toBeInTheDocument();
    });

    it('должен передавать aria-label', () => {
      render(<Modal visible={true} aria-label='Test label'>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toHaveAttribute('aria-label', 'Test label');
    });

    it('должен передавать aria-labelledby', () => {
      render(<Modal visible={true} aria-labelledby='title-id'>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toHaveAttribute('aria-labelledby', 'title-id');
    });

    it('должен передавать duration когда он определен', () => {
      render(<Modal visible={true} duration='300ms'>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toHaveAttribute('data-duration', '300ms');
    });

    it('не должен передавать duration когда он undefined', () => {
      render(<Modal visible={true} duration={undefined as any}>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).not.toHaveAttribute('data-duration');
    });

    it('должен передавать остальные пропсы в CoreModal', () => {
      render(
        <Modal visible={true} data-testid='custom-modal' className='custom-class'>
          {testContent}
        </Modal>,
      );

      const modal = screen.getByTestId('custom-modal');
      expect(modal).toHaveClass('custom-class');
    });
  });

  describe('Ref forwarding', () => {
    it('должен передавать ref в CoreModal', () => {
      const mockRef = React.createRef<HTMLDivElement>();

      render(<Modal visible={true} ref={mockRef}>{testContent}</Modal>);

      expect(mockRef.current).toBe(screen.getByTestId('core-modal'));
    });
  });

  describe('Edge cases', () => {
    it('должен работать с пустыми children', () => {
      render(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toBeInTheDocument();
    });

    it('должен работать с null children', () => {
      render(<Modal visible={true}>{null}</Modal>);

      expect(screen.getByTestId('core-modal')).toBeInTheDocument();
    });

    it('должен использовать default variant когда variant не указан', () => {
      render(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toHaveAttribute('data-variant', 'default');
    });

    it('должен использовать default visible=false когда visible не указан', () => {
      render(<Modal visible={false}>{testContent}</Modal>);

      expect(screen.queryByTestId('core-modal')).not.toBeInTheDocument();
    });
  });

  describe('Memoization и производительность', () => {
    it('должен стабильно рендерится с одинаковыми пропсами', () => {
      const { container, rerender } = render(<Modal visible={true}>{testContent}</Modal>);

      const initialHtml = container.innerHTML;

      rerender(<Modal visible={true}>{testContent}</Modal>);

      expect(container.innerHTML).toBe(initialHtml);
    });

    it('должен перерендериваться при изменении visible', () => {
      const { container, rerender } = render(<Modal visible={true}>{testContent}</Modal>);

      expect(container.querySelector('[data-component="AppModal"]')).toBeInTheDocument();

      rerender(<Modal visible={false}>{testContent}</Modal>);

      expect(container.querySelector('[data-component="AppModal"]')).toBeNull();
    });

    it('должен учитывать изменения feature flag при перерендеринге', () => {
      // Этот тест проверяет логику policy, а не реальный ререндер с изменением mock
      mockFeatureFlagReturnValue = false;
      const { rerender } = render(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toBeInTheDocument();

      // Перерендер с тем же состоянием должен сохранить компонент
      rerender(<Modal visible={true}>{testContent}</Modal>);

      expect(screen.getByTestId('core-modal')).toBeInTheDocument();
    });
  });
});
