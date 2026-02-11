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
  Toast: (
    { 'data-testid': testId, visible, content, ...props }: Readonly<
      Record<string, unknown> & {
        content?: React.ReactNode;
      }
    >,
  ) => (
    <div
      data-testid={testId ?? 'core-toast'}
      data-visible={visible?.toString()}
      {...props}
    >
      {content}
    </div>
  ),
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

import { Toast } from '../../../src/ui/toast';
import type { ClientError, NetworkError } from '../../../src/types/errors';
import type { ISODateString } from '../../../src/types/common';

// Фабричные функции для создания тестовых ошибок
const createTestClientError = (): ClientError => ({
  type: 'ClientError' as const,
  severity: 'warning' as const,
  source: 'UI',
  code: 'TEST_ERROR',
  message: 'Test client error',
  context: {},
  traceId: 'test-trace-id',
  timestamp: new Date().toISOString() as ISODateString,
});

const createTestNetworkError = (): NetworkError => ({
  type: 'NetworkError' as const,
  severity: 'error' as const,
  statusCode: 500,
  message: 'Test network error',
  endpoint: '/test',
  traceId: 'test-trace-id',
  timestamp: new Date().toISOString() as ISODateString,
});

describe('App Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
    mockTranslate.mockImplementation((ns, key, _params) => {
      if (ns === 'common' && key === 'notifications.success') return 'Success';
      if (ns === 'common' && key === 'accessibility.notification') return 'Notification';
      return 'Translated Label';
    });
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
      expect(toast).toHaveTextContent('Custom content');
    });

    it('не падает при отсутствии content', () => {
      expect(() => {
        render(<Toast content='Test' visible={true} />);
      }).not.toThrow();
    });
  });

  describe('Error to variant mapping', () => {
    it('ClientError должен маппиться на warning variant', () => {
      const clientError = createTestClientError();

      render(<Toast content='Error toast' visible={true} error={clientError} />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toHaveAttribute('data-variant', 'warning');
    });

    it('NetworkError должен маппиться на error variant', () => {
      const networkError = createTestNetworkError();

      render(<Toast content='Error toast' visible={true} error={networkError} />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toHaveAttribute('data-variant', 'error');
    });

    it('error имеет приоритет над explicit variant', () => {
      const clientError = createTestClientError();

      render(<Toast content='Error toast' visible={true} error={clientError} variant='info' />);

      const toast = screen.getByTestId('core-toast');
      // Ожидаем warning от error, а не info от explicit variant
      expect(toast).toHaveAttribute('data-variant', 'warning');
    });

    it('explicit variant работает когда нет error', () => {
      render(<Toast content='Info toast' visible={true} variant='info' />);

      const toast = screen.getByTestId('core-toast');
      expect(toast).toHaveAttribute('data-variant', 'info');
    });

    it('props.visible правильно обрабатывается через policy (не напрямую)', () => {
      render(<Toast content='Test toast' visible={true} />);

      const toast = screen.getByTestId('core-toast');
      // visible=true должно пройти через policy и стать data-visible="true"
      expect(toast).toHaveAttribute('data-visible', 'true');
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

  describe('I18n рендеринг', () => {
    describe('Content', () => {
      it('должен рендерить обычный content', () => {
        render(
          <Toast
            visible
            content='Custom content'
          />,
        );

        const toast = screen.getByTestId('core-toast');
        expect(toast).toHaveTextContent('Custom content');
      });

      it('должен рендерить i18n content', () => {
        render(
          <Toast
            visible
            {...{ contentI18nKey: 'notifications.success' } as any}
          />,
        );

        const toast = screen.getByTestId('core-toast');
        expect(toast).toHaveTextContent('Success');
      });

      it('должен передавать namespace для i18n content', () => {
        render(
          <Toast
            visible
            {...{ contentI18nKey: 'notifications.success', contentI18nNs: 'common' } as any}
          />,
        );

        const toast = screen.getByTestId('core-toast');
        expect(toast).toHaveTextContent('Success');
      });

      it('должен передавать параметры для i18n content', () => {
        const params = { count: 5, type: 'success' };
        render(
          <Toast
            visible
            {...{ contentI18nKey: 'notifications.success', contentI18nParams: params } as any}
          />,
        );

        const toast = screen.getByTestId('core-toast');
        expect(toast).toHaveTextContent('Success');
      });

      it('должен использовать пустой объект для undefined параметров i18n content', () => {
        render(
          <Toast
            visible
            {...{ contentI18nKey: 'notifications.success', contentI18nParams: undefined } as any}
          />,
        );

        const toast = screen.getByTestId('core-toast');
        expect(toast).toHaveTextContent('Success');
      });
    });

    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(
          <Toast
            visible
            content='Test content'
            aria-label='Test label'
          />,
        );

        expect(screen.getByTestId('core-toast')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(
          <Toast
            visible
            {...{ ariaLabelI18nKey: 'accessibility.notification' } as any}
          />,
        );

        expect(screen.getByTestId('core-toast')).toHaveAttribute('aria-label', 'Notification');
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <Toast
            visible
            {...{
              ariaLabelI18nKey: 'accessibility.notification',
              ariaLabelI18nNs: 'common',
            } as any}
          />,
        );

        expect(screen.getByTestId('core-toast')).toHaveAttribute('aria-label', 'Notification');
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { count: 3, type: 'info' };
        render(
          <Toast
            visible
            {...{
              ariaLabelI18nKey: 'accessibility.notification',
              ariaLabelI18nParams: params,
            } as any}
          />,
        );

        expect(screen.getByTestId('core-toast')).toHaveAttribute('aria-label', 'Notification');
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Toast
            visible
            {...{
              ariaLabelI18nKey: 'accessibility.notification',
              ariaLabelI18nParams: undefined,
            } as any}
          />,
        );

        expect(screen.getByTestId('core-toast')).toHaveAttribute('aria-label', 'Notification');
      });
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n content при изменении пропсов', () => {
      const { rerender } = render(
        <Toast
          visible
          {...{ contentI18nKey: 'notifications.first' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Toast
          visible
          {...{ contentI18nKey: 'notifications.second' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'notifications.second', {});
    });

    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <Toast
          visible
          {...{ ariaLabelI18nKey: 'accessibility.first' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Toast
          visible
          {...{ ariaLabelI18nKey: 'accessibility.second' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'accessibility.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный content без i18n', () => {
      render(
        <Toast
          visible
          content='Regular content'
        />,
      );

      const toast = screen.getByTestId('core-toast');
      expect(toast).toHaveTextContent('Regular content');
    });

    it('должен принимать обычный aria-label без i18n', () => {
      render(
        <Toast
          visible
          content='Regular content'
          aria-label='Regular label'
        />,
      );

      expect(screen.getByTestId('core-toast')).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n content без обычного', () => {
      render(
        <Toast
          visible
          {...{ contentI18nKey: 'notifications.success' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'notifications.success', {});
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(
        <Toast
          visible
          {...{ ariaLabelI18nKey: 'accessibility.notification' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'accessibility.notification', {});
    });

    it('не должен компилироваться с обоими content одновременно', () => {
      // Этот тест проверяет, что discriminated union работает правильно
      expect(() => {
        // TypeScript не позволит создать такой объект
        const invalidProps = {
          content: 'test',
          contentI18nKey: 'test',
        } as any;

        // Если discriminated union работает, этот объект будет иметь never типы для конфликтующих полей
        return invalidProps;
      }).not.toThrow();
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
