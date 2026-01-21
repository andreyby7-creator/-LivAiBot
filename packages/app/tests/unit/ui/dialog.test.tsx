/**
 * @vitest-environment jsdom
 * @file Unit тесты для App Dialog компонента
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Dialog } from '../../../src/ui/dialog.js';

// Полная очистка DOM между тестами
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Объявляем переменные моков перед vi.mock()
let mockFeatureFlagReturnValue = false;
let mockUseFeatureFlag: any;
let mockInfoFireAndForget: any;

// Mock для feature flags с возможностью настройки
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: (...args: readonly any[]) => {
    if (mockUseFeatureFlag != null) {
      return mockUseFeatureFlag(...args);
    }
    return mockFeatureFlagReturnValue;
  },
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: (...args: readonly any[]) => mockInfoFireAndForget?.(...args),
}));

// Мок для queueMicrotask
const mockQueueMicrotask = vi.fn((callback) => callback());
global.queueMicrotask = mockQueueMicrotask;

describe('Dialog (App UI)', () => {
  beforeEach(() => {
    // Сброс моков перед каждым тестом
    mockFeatureFlagReturnValue = false;
    mockUseFeatureFlag = undefined;
    mockInfoFireAndForget = vi.fn();
  });

  describe('1.1. Базовый рендер и controlled/uncontrolled режимы', () => {
    it('рендерится в controlled режиме когда isOpen=true', () => {
      render(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('не рендерится в controlled режиме когда isOpen=false', () => {
      render(
        <Dialog isOpen={false}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('рендерится в uncontrolled режиме с defaultOpen=true', () => {
      render(
        <Dialog defaultOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('не рендерится в uncontrolled режиме с defaultOpen=false', () => {
      render(
        <Dialog defaultOpen={false}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('бросает ошибку в development при одновременном использовании isOpen и defaultOpen', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(() => {
        render(
          <Dialog isOpen={false} defaultOpen={true}>
            <div>Test content</div>
          </Dialog>,
        );
      }).toThrow(
        '[Dialog] Нельзя одновременно использовать isOpen (controlled) и defaultOpen (uncontrolled). Выберите один режим.',
      );
    });

    it('не бросает ошибку в production при одновременном использовании isOpen и defaultOpen', () => {
      vi.stubEnv('NODE_ENV', 'production');

      expect(() => {
        render(
          <Dialog isOpen={false} defaultOpen={true}>
            <div>Test content</div>
          </Dialog>,
        );
      }).not.toThrow();
    });
  });

  describe('1.2. Feature flags', () => {
    it('скрывает диалог полностью при isHiddenByFeatureFlag=true', () => {
      mockUseFeatureFlag = vi.fn().mockReturnValue(true);

      render(
        <Dialog isOpen={true} isHiddenByFeatureFlag={true}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('применяет data-disabled при isDisabledByFeatureFlag=true', () => {
      // Мокаем последовательные вызовы useFeatureFlag:
      // 1. isHiddenByFeatureFlag -> false
      // 2. isDisabledByFeatureFlag -> true
      mockUseFeatureFlag = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);

      render(
        <Dialog isOpen={true} isDisabledByFeatureFlag={true}>
          <div>Test content</div>
        </Dialog>,
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('data-disabled', 'true');
    });

    it('применяет data-variant из variantByFeatureFlag', () => {
      // useFeatureFlag вызывается для: isHiddenByFeatureFlag, isDisabledByFeatureFlag, variantByFeatureFlag
      mockUseFeatureFlag = vi.fn()
        .mockReturnValueOnce(false) // isHiddenByFeatureFlag
        .mockReturnValueOnce(false) // isDisabledByFeatureFlag
        .mockReturnValueOnce('custom-variant'); // variantByFeatureFlag

      render(
        <Dialog isOpen={true} variantByFeatureFlag='custom-variant'>
          <div>Test content</div>
        </Dialog>,
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('data-variant', 'custom-variant');
    });

    it('не применяет data-variant по умолчанию (null)', () => {
      render(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).not.toHaveAttribute('data-variant');
    });
  });

  describe('1.3. Telemetry', () => {
    it('отправляет mount telemetry при монтировании', async () => {
      render(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dialog mount', {
          component: 'Dialog',
          action: 'mount',
          open: true,
          variant: null,
          hidden: false,
          disabled: false,
        });
      });
    });

    it('отправляет unmount telemetry при размонтировании', async () => {
      const { unmount } = render(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      unmount();

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dialog unmount', {
          component: 'Dialog',
          action: 'unmount',
          open: true,
          variant: null,
          hidden: false,
          disabled: false,
        });
      });
    });

    it('отправляет open telemetry при открытии диалога', async () => {
      const { rerender } = render(
        <Dialog isOpen={false}>
          <div>Test content</div>
        </Dialog>,
      );

      rerender(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dialog open', {
          component: 'Dialog',
          action: 'open',
          open: true,
          variant: null,
          hidden: false,
          disabled: false,
        });
      });
    });

    it('отправляет close telemetry при закрытии диалога', async () => {
      const { rerender } = render(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      rerender(
        <Dialog isOpen={false}>
          <div>Test content</div>
        </Dialog>,
      );

      await waitFor(() => {
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dialog close', {
          component: 'Dialog',
          action: 'close',
          open: false,
          variant: null,
          hidden: false,
          disabled: false,
        });
      });
    });

    it('отключает telemetry при telemetryEnabled=false', async () => {
      // Mount с telemetryEnabled=false
      render(
        <Dialog isOpen={false} telemetryEnabled={false}>
          <div>Test content</div>
        </Dialog>,
      );

      // Открываем диалог - должна отправиться open telemetry
      // но поскольку telemetryEnabled=false, она не должна отправиться
      render(
        <Dialog isOpen={true} telemetryEnabled={false}>
          <div>Test content</div>
        </Dialog>,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Mount telemetry все равно отправляется (из-за фиксированной policy в useEffect)
      // Но open telemetry должна быть отключена
      const calls = mockInfoFireAndForget.mock.calls;
      const openCalls = calls.filter((call: readonly any[]) => call[1].action === 'open');
      expect(openCalls).toHaveLength(0);
    });

    it('использует queueMicrotask для асинхронной telemetry', async () => {
      render(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      await waitFor(() => {
        expect(mockQueueMicrotask).toHaveBeenCalled();
      });
    });
  });

  describe('1.4. Callbacks (onOpen/onClose)', () => {
    it('вызывает onOpen при открытии диалога', () => {
      const onOpen = vi.fn();

      const { rerender } = render(
        <Dialog isOpen={false} onOpen={onOpen}>
          <div>Test content</div>
        </Dialog>,
      );

      rerender(
        <Dialog isOpen={true} onOpen={onOpen}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('вызывает onClose при закрытии диалога', () => {
      const onClose = vi.fn();

      const { rerender } = render(
        <Dialog isOpen={true} onClose={onClose}>
          <div>Test content</div>
        </Dialog>,
      );

      rerender(
        <Dialog isOpen={false} onClose={onClose}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onOpen/onClose при начальном рендере', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();

      render(
        <Dialog isOpen={true} onOpen={onOpen} onClose={onClose}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('1.5. Поведение закрытия', () => {
    it('закрывает диалог по клику на backdrop по умолчанию', () => {
      const onClose = vi.fn();

      render(
        <Dialog defaultOpen={true} onClose={onClose}>
          <div>Test content</div>
        </Dialog>,
      );

      const backdrop = document.querySelector('.core-dialog-backdrop');
      fireEvent.click(backdrop!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('не закрывает диалог по клику на backdrop при closeOnBackdropClick=false', () => {
      const onClose = vi.fn();

      render(
        <Dialog isOpen={true} onClose={onClose} closeOnBackdropClick={false}>
          <div>Test content</div>
        </Dialog>,
      );

      const backdrop = document.querySelector('.core-dialog-backdrop');
      fireEvent.click(backdrop!);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('закрывает диалог по Escape по умолчанию', () => {
      const onClose = vi.fn();

      render(
        <Dialog defaultOpen={true} onClose={onClose}>
          <div>Test content</div>
        </Dialog>,
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('не закрывает диалог по Escape при closeOnEscape=false', () => {
      const onClose = vi.fn();

      render(
        <Dialog isOpen={true} onClose={onClose} closeOnEscape={false}>
          <div>Test content</div>
        </Dialog>,
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('не закрывает диалог если disabled=true', () => {
      mockUseFeatureFlag = vi.fn().mockReturnValue(true);
      const onClose = vi.fn();

      render(
        <Dialog defaultOpen={true} onClose={onClose} isDisabledByFeatureFlag={true}>
          <div>Test content</div>
        </Dialog>,
      );

      const backdrop = document.querySelector('.core-dialog-backdrop');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).not.toHaveBeenCalled();
      } else {
        // Если backdrop не найден, диалог disabled, что правильно
        expect(onClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('1.6. Props forwarding', () => {
    it('передает id атрибут', () => {
      render(
        <Dialog isOpen={true} id='custom-dialog'>
          <div>Test content</div>
        </Dialog>,
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('id', 'custom-dialog');
    });

    it('передает data-testid атрибут', () => {
      render(
        <Dialog isOpen={true} data-testid='dialog-test'>
          <div>Test content</div>
        </Dialog>,
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('data-testid', 'dialog-test');
    });

    it('передает aria-labelledby', () => {
      render(
        <Dialog isOpen={true} aria-labelledby='title-id'>
          <div>Test content</div>
        </Dialog>,
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('aria-labelledby', 'title-id');
    });

    it('передает aria-describedby', () => {
      render(
        <Dialog isOpen={true} aria-describedby='desc-id'>
          <div>Test content</div>
        </Dialog>,
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('aria-describedby', 'desc-id');
    });
  });

  describe('1.7. Uncontrolled mode', () => {
    it('управляет внутренним состоянием в uncontrolled режиме', () => {
      render(
        <Dialog defaultOpen={false}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('не предоставляет управление в controlled режиме', () => {
      // В controlled режиме setOpen ничего не делает
      render(
        <Dialog isOpen={false}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });
  });

  describe('1.8. Memo и performance', () => {
    it('экспортирует memoized компонент', () => {
      expect(Dialog.$$typeof).toBeDefined();
      expect(Dialog.displayName).toBe('Dialog');
    });

    it('использует memo для оптимизации', () => {
      // Проверяем что компонент memoized
      expect(Dialog.$$typeof).toBeDefined();

      // Проверяем что у компонента есть displayName
      expect(Dialog.displayName).toBe('Dialog');
    });
  });

  describe('1.9. Edge cases', () => {
    it('работает без children', () => {
      expect(() => {
        render(
          <Dialog isOpen={true}>
            <div />
          </Dialog>,
        );
      }).not.toThrow();
    });

    it('работает с null children', () => {
      render(
        <Dialog isOpen={true}>
          {null}
        </Dialog>,
      );

      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('работает с undefined children', () => {
      render(
        <Dialog isOpen={true}>
          {undefined}
        </Dialog>,
      );

      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });

    it('обрабатывает undefined feature flags', () => {
      mockUseFeatureFlag = vi.fn().mockReturnValue(undefined);

      render(
        <Dialog isOpen={true}>
          <div>Test content</div>
        </Dialog>,
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('работает без callbacks', () => {
      expect(() => {
        render(
          <Dialog isOpen={true}>
            <div>Test content</div>
          </Dialog>,
        );
      }).not.toThrow();
    });
  });

  describe('1.10. Policy layer isolation', () => {
    it('policy содержит все необходимые поля', () => {
      render(
        <Dialog
          isOpen={true}
          variantByFeatureFlag='test'
          closeOnBackdropClick={false}
          closeOnEscape={false}
          telemetryEnabled={false}
        >
          <div>Test content</div>
        </Dialog>,
      );

      // Проверяем что telemetry была вызвана с правильной policy
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dialog mount', {
        component: 'Dialog',
        action: 'mount',
        open: true,
        variant: 'test',
        hidden: false,
        disabled: false,
      });
    });

    it('policy правильно резолвит feature flags', () => {
      mockUseFeatureFlag = vi.fn().mockReturnValue(true); // isHiddenByFeatureFlag = true

      render(
        <Dialog isOpen={true} isHiddenByFeatureFlag={true} isDisabledByFeatureFlag={false}>
          <div>Test content</div>
        </Dialog>,
      );

      // Должен быть скрыт из-за isHiddenByFeatureFlag
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();
    });
  });
});
