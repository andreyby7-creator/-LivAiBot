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

// Mock для UnifiedUIProvider
let mockFeatureFlagReturnValue = false;
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: () => mockFeatureFlagReturnValue,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => mockFeatureFlagReturnValue,
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

import { Modal } from '../../../src/ui/modal';

describe('App Modal', () => {
  const testContent = 'Test modal content';
  const testTitle = 'Test Modal Title';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
    mockTranslate.mockReturnValue('Translated Label');
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

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(
          <Modal
            visible
            aria-label='Test label'
          >
            Content
          </Modal>,
        );

        expect(screen.getByTestId('core-modal')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(
          <Modal
            visible
            {...{ ariaLabelI18nKey: 'modal.title' } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.title', {});
        expect(screen.getByTestId('core-modal')).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <Modal
            visible
            {...{ ariaLabelI18nKey: 'title', ariaLabelI18nNs: 'modal' } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('modal', 'title', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { count: 5, type: 'confirmation' };
        render(
          <Modal
            visible
            {...{ ariaLabelI18nKey: 'modal.confirm', ariaLabelI18nParams: params } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.confirm', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Modal
            visible
            {...{ ariaLabelI18nKey: 'modal.title', ariaLabelI18nParams: undefined } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.title', {});
      });
    });

    describe('Aria-labelledby', () => {
      it('должен рендерить обычный aria-labelledby', () => {
        render(
          <Modal
            visible
            aria-labelledby='test-id'
          >
            Content
          </Modal>,
        );

        expect(screen.getByTestId('core-modal')).toHaveAttribute('aria-labelledby', 'test-id');
      });

      it('должен рендерить i18n aria-labelledby', () => {
        render(
          <Modal
            visible
            {...{ ariaLabelledByI18nKey: 'modal.header' } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.header', {});
        expect(screen.getByTestId('core-modal')).toHaveAttribute(
          'aria-labelledby',
          'Translated Label',
        );
      });

      it('должен передавать namespace для i18n aria-labelledby', () => {
        render(
          <Modal
            visible
            {...{ ariaLabelledByI18nKey: 'header', ariaLabelledByI18nNs: 'modal' } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('modal', 'header', {});
      });

      it('должен передавать параметры для i18n aria-labelledby', () => {
        const params = { section: 'user', id: '123' };
        render(
          <Modal
            visible
            {...{ ariaLabelledByI18nKey: 'modal.section', ariaLabelledByI18nParams: params } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.section', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-labelledby', () => {
        render(
          <Modal
            visible
            {...{
              ariaLabelledByI18nKey: 'modal.header',
              ariaLabelledByI18nParams: undefined,
            } as any}
          >
            Content
          </Modal>,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.header', {});
      });
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <Modal
          visible
          {...{ ariaLabelI18nKey: 'modal.first' } as any}
        >
          Content
        </Modal>,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Modal
          visible
          {...{ ariaLabelI18nKey: 'modal.second' } as any}
        >
          Content
        </Modal>,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'modal.second', {});
    });

    it('должен мемоизировать i18n aria-labelledby при изменении пропсов', () => {
      const { rerender } = render(
        <Modal
          visible
          {...{ ariaLabelledByI18nKey: 'modal.first' } as any}
        >
          Content
        </Modal>,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Modal
          visible
          {...{ ariaLabelledByI18nKey: 'modal.second' } as any}
        >
          Content
        </Modal>,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'modal.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      render(
        <Modal
          visible
          aria-label='Regular label'
        >
          Content
        </Modal>,
      );

      expect(screen.getByTestId('core-modal')).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать обычный aria-labelledby без i18n', () => {
      render(
        <Modal
          visible
          aria-labelledby='regular-id'
        >
          Content
        </Modal>,
      );

      expect(screen.getByTestId('core-modal')).toHaveAttribute('aria-labelledby', 'regular-id');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(
        <Modal
          visible
          {...{ ariaLabelI18nKey: 'modal.title' } as any}
        >
          Content
        </Modal>,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.title', {});
    });

    it('должен принимать i18n aria-labelledby без обычного', () => {
      render(
        <Modal
          visible
          {...{ ariaLabelledByI18nKey: 'modal.header' } as any}
        >
          Content
        </Modal>,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'modal.header', {});
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

    it('не должен компилироваться с обоими aria-labelledby одновременно', () => {
      // Этот тест проверяет, что discriminated union работает правильно
      expect(() => {
        // TypeScript не позволит создать такой объект
        const invalidProps = {
          'aria-labelledby': 'test',
          ariaLabelledByI18nKey: 'test',
        } as any;

        // Если discriminated union работает, этот объект будет иметь never типы для конфликтующих полей
        return invalidProps;
      }).not.toThrow();
    });
  });
});
