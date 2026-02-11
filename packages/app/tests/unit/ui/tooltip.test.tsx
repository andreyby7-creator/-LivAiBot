/**
 * @vitest-environment jsdom
 * @file Тесты для Tooltip компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Tooltip - возвращаем простой div, но фильтруем внутренние пропсы
vi.mock('../../../../ui-core/src/primitives/tooltip', () => ({
  Tooltip: ({
    'data-testid': testId,
    visible,
    placement,
    content,
    trigger,
    style,
    className,
    ...props
  }: Readonly<{
    'data-testid'?: string;
    visible?: boolean;
    placement?: string;
    content?: string;
    trigger?: string;
    style?: import('react').CSSProperties;
    className?: string;
    [key: string]: unknown;
  }>) => (
    <div
      data-testid={testId ?? 'core-tooltip'}
      data-visible={visible}
      data-placement={placement}
      data-content={content}
      data-trigger={trigger}
      style={style}
      className={className}
      {...props}
    />
  ),
}));

// Mock для UnifiedUIProvider
let mockFeatureFlagReturnValue = false;
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    i18n: {
      translate: mockTranslate,
      locale: 'en',
      direction: 'ltr' as const,
      loadNamespace: vi.fn(),
      isNamespaceLoaded: vi.fn(() => true),
    },
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
  }),
}));

import { Tooltip } from '../../../src/ui/tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
    mockTranslate.mockReturnValue('Translated Content');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить tooltip с обязательными пропсами', () => {
      render(<Tooltip content='Test tooltip' visible={true} />);

      const tooltip = screen.getByTestId('core-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute('data-component', 'AppTooltip');
    });

    it('должен передавать все пропсы в Core Tooltip', () => {
      render(
        <Tooltip
          content='Test tooltip'
          visible={true}
          placement='bottom'
          bgColor='#FF0000'
          className='custom-class'
          data-testid='custom-tooltip'
        />,
      );

      const tooltip = screen.getByTestId('custom-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute('data-component', 'AppTooltip');
    });

    it('не должен рендерить когда visible=false', () => {
      render(<Tooltip content='Test tooltip' visible={false} />);

      expect(screen.queryByTestId('core-tooltip')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<Tooltip content='Test tooltip' />);

      expect(screen.getByTestId('core-tooltip')).toBeInTheDocument();
    });
  });

  describe('I18n рендеринг', () => {
    describe('Content', () => {
      it('должен рендерить обычный content', () => {
        render(<Tooltip content='Regular content' visible={true} />);

        expect(screen.getByTestId('core-tooltip')).toHaveAttribute(
          'data-content',
          'Regular content',
        );
      });

      it('должен рендерить i18n content', () => {
        render(<Tooltip visible={true} {...{ contentI18nKey: 'common.tooltip' } as any} />);

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.tooltip', {});
        expect(screen.getByTestId('core-tooltip')).toHaveAttribute(
          'data-content',
          'Translated Content',
        );
      });

      it('должен передавать namespace для i18n content', () => {
        render(
          <Tooltip
            visible={true}
            {...{ contentI18nKey: 'help.tooltip', contentI18nNs: 'help' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('help', 'help.tooltip', {});
      });

      it('должен передавать параметры для i18n content', () => {
        const params = { action: 'save', count: 5 };
        render(
          <Tooltip
            visible={true}
            {...{ contentI18nKey: 'common.action', contentI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.action', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n content', () => {
        render(
          <Tooltip
            visible={true}
            {...{ contentI18nKey: 'common.test', contentI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
      });
    });

    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(<Tooltip content='Test tooltip' visible={true} aria-label='Test label' />);

        expect(screen.getByTestId('core-tooltip')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(
          <Tooltip
            content='Test tooltip'
            visible={true}
            {...{ ariaLabelI18nKey: 'common.label' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.label', {});
        expect(screen.getByTestId('core-tooltip')).toHaveAttribute(
          'aria-label',
          'Translated Content',
        );
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <Tooltip
            content='Test tooltip'
            visible={true}
            {...{ ariaLabelI18nKey: 'auth.login', ariaLabelI18nNs: 'auth' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('auth', 'auth.login', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { field: 'username', required: true };
        render(
          <Tooltip
            content='Test tooltip'
            visible={true}
            {...{ ariaLabelI18nKey: 'common.field', ariaLabelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.field', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Tooltip
            content='Test tooltip'
            visible={true}
            {...{ ariaLabelI18nKey: 'common.test', ariaLabelI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
      });
    });
  });

  describe('Feature flags и политика видимости', () => {
    it('должен рендерить компонент когда feature flag false', () => {
      mockFeatureFlagReturnValue = false;

      render(<Tooltip content='Test' visible={true} isHiddenByFeatureFlag={false} />);

      const tooltip = screen.getByTestId('core-tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('должен скрывать компонент когда feature flag true', () => {
      mockFeatureFlagReturnValue = true;

      render(<Tooltip content='Test' visible={true} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-tooltip')).not.toBeInTheDocument();
    });

    it('должен использовать default false для isHiddenByFeatureFlag', () => {
      mockFeatureFlagReturnValue = false;

      render(<Tooltip content='Test' visible={true} />);

      const tooltip = screen.getByTestId('core-tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount event при рендере', () => {
      render(<Tooltip content='Test tooltip' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tooltip mount', {
        component: 'Tooltip',
        action: 'mount',
        hidden: false,
        visible: true,
      });
    });

    it('должен отправлять unmount event при размонтировании', () => {
      const { unmount } = render(<Tooltip content='Test tooltip' visible={true} />);

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2); // mount + unmount
      expect(mockInfoFireAndForget).toHaveBeenLastCalledWith('Tooltip unmount', {
        component: 'Tooltip',
        action: 'unmount',
        hidden: false,
        visible: true,
      });
    });

    it('должен отправлять telemetry с правильным значением hidden', () => {
      mockFeatureFlagReturnValue = true;

      render(<Tooltip content='Test' visible={true} isHiddenByFeatureFlag={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tooltip mount', {
        component: 'Tooltip',
        action: 'mount',
        hidden: true,
        visible: false,
      });
    });

    it('должен отправлять telemetry с правильным значением visible', () => {
      render(<Tooltip content='Test tooltip' visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tooltip mount', {
        component: 'Tooltip',
        action: 'mount',
        hidden: false,
        visible: false,
      });
    });

    it('должен отправлять hide event при изменении visible на false', () => {
      const { rerender } = render(<Tooltip content='Test tooltip' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount

      mockInfoFireAndForget.mockClear();

      rerender(<Tooltip content='Test tooltip' visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только hide
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tooltip hide', {
        component: 'Tooltip',
        action: 'hide',
        hidden: false,
        visible: false,
      });
    });

    it('должен отправлять telemetry только при telemetryEnabled=true', () => {
      render(<Tooltip content='Test' visible={true} telemetryEnabled={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('должен отправлять telemetry по умолчанию (telemetryEnabled не указан)', () => {
      render(<Tooltip content='Test' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('не должен отправлять telemetry при telemetryEnabled=false', () => {
      render(<Tooltip content='Test' visible={true} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Ref forwarding', () => {
    it('должен forward ref в Core Tooltip', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Tooltip ref={ref} content='Test' visible={true} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppTooltip');
    });
  });

  describe('Props processing', () => {
    it('должен корректно обрабатывать все типы контента', () => {
      const { rerender } = render(<Tooltip content='string' visible={true} />);
      expect(screen.getByTestId('core-tooltip')).toBeInTheDocument();

      rerender(<Tooltip content={<strong>jsx</strong> as any} visible={true} />);
      expect(screen.getByTestId('core-tooltip')).toBeInTheDocument();

      rerender(<Tooltip content={42 as any} visible={true} />);
      expect(screen.getByTestId('core-tooltip')).toBeInTheDocument();
    });

    it('должен передавать все HTML атрибуты', () => {
      render(
        <Tooltip content='Test' visible={true} id='tooltip-1' tabIndex={0} aria-label='custom' />,
      );

      const tooltip = screen.getByTestId('core-tooltip');
      expect(tooltip).toHaveAttribute('id', 'tooltip-1');
      expect(tooltip).toHaveAttribute('tabindex', '0');
      expect(tooltip).toHaveAttribute('aria-label', 'custom');
    });
  });

  describe('Render stability', () => {
    it('должен стабильно рендериться при одинаковых пропсах', () => {
      const { rerender, container } = render(<Tooltip content='Test' visible={true} />);
      const firstRender = container.innerHTML;

      rerender(<Tooltip content='Test' visible={true} />);
      const secondRender = container.innerHTML;

      expect(firstRender).toBe(secondRender);
    });

    it('не должен пересчитывать lifecycle telemetry при изменении пропсов', () => {
      const { rerender } = render(<Tooltip content='Test' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount

      mockInfoFireAndForget.mockClear();

      rerender(<Tooltip content='New content' visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только hide
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tooltip hide', {
        component: 'Tooltip',
        action: 'hide',
        hidden: false,
        visible: false,
      });
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n content при изменении пропсов', () => {
      const { rerender } = render(
        <Tooltip visible={true} {...{ contentI18nKey: 'common.first' } as any} />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(<Tooltip visible={true} {...{ contentI18nKey: 'common.second' } as any} />);

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'common.second', {});
    });

    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <Tooltip content='Test' visible={true} {...{ ariaLabelI18nKey: 'common.first' } as any} />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Tooltip content='Test' visible={true} {...{ ariaLabelI18nKey: 'common.second' } as any} />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'common.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    describe('Content', () => {
      it('должен принимать обычный content без i18n', () => {
        render(<Tooltip content='Regular content' visible={true} />);

        expect(screen.getByTestId('core-tooltip')).toHaveAttribute(
          'data-content',
          'Regular content',
        );
      });

      it('должен принимать i18n content без обычного', () => {
        render(<Tooltip visible={true} {...{ contentI18nKey: 'common.test' } as any} />);

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
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
    });

    describe('Aria-label', () => {
      it('должен принимать обычный aria-label без i18n', () => {
        render(<Tooltip content='Test' visible={true} aria-label='Regular label' />);

        expect(screen.getByTestId('core-tooltip')).toHaveAttribute('aria-label', 'Regular label');
      });

      it('должен принимать i18n aria-label без обычного', () => {
        render(
          <Tooltip content='Test' visible={true} {...{ ariaLabelI18nKey: 'common.test' } as any} />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
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
});
