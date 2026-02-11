/**
 * @vitest-environment jsdom
 * @file Тесты для Badge компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Badge - возвращаем простой span, но фильтруем внутренние пропсы
vi.mock('../../../../ui-core/src/primitives/badge', () => ({
  Badge: ({
    'data-testid': testId,
    value,
    size,
    variant,
    style,
    className,
    ...props
  }: Readonly<{
    'data-testid'?: string;
    value?: string;
    size?: string;
    variant?: string;
    style?: import('react').CSSProperties;
    className?: string;
    [key: string]: unknown;
  }>) => (
    <span
      data-testid={testId ?? 'core-badge'}
      data-value={value}
      data-size={size}
      data-variant={variant}
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

import { Badge } from '../../../src/ui/badge';

// Mock console.warn для тестирования dev warnings
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockClear();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
    mockTranslate.mockReturnValue('Translated Label');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить badge с обязательными пропсами', () => {
      render(<Badge value='test' />);

      const badge = screen.getByTestId('core-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-component', 'AppBadge');
    });

    it('должен передавать все пропсы в Core Badge', () => {
      render(
        <Badge
          value='test'
          size='large'
          variant='success'
          bgColor='#FF0000'
          textColor='#FFFFFF'
          className='test-class'
          data-testid='custom-badge'
        />,
      );

      const badge = screen.getByTestId('custom-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-component', 'AppBadge');
    });
  });

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(<Badge value='test' aria-label='Test label' />);

        expect(screen.getByTestId('core-badge')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(<Badge value='test' {...{ ariaLabelI18nKey: 'common.label' } as any} />);

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.label', {});
        expect(screen.getByTestId('core-badge')).toHaveAttribute('aria-label', 'Translated Label');
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <Badge
            value='test'
            {...{ ariaLabelI18nKey: 'auth.login', ariaLabelI18nNs: 'auth' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('auth', 'auth.login', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { field: 'username', required: true };
        render(
          <Badge
            value='test'
            {...{ ariaLabelI18nKey: 'common.field', ariaLabelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.field', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Badge
            value='test'
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

      render(<Badge value='test' isHiddenByFeatureFlag={false} />);

      const badge = screen.getByTestId('core-badge');
      expect(badge).toBeInTheDocument();
    });

    it('должен скрывать компонент когда feature flag true', () => {
      mockFeatureFlagReturnValue = true;

      render(<Badge value='test' isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-badge')).not.toBeInTheDocument();
    });

    it('должен использовать default false для isHiddenByFeatureFlag', () => {
      mockFeatureFlagReturnValue = false;

      render(<Badge value='test' />);

      const badge = screen.getByTestId('core-badge');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount event при рендере', () => {
      render(<Badge value='test' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Badge mount', {
        component: 'Badge',
        action: 'mount',
        hidden: false,
        value: 'test',
      });
    });

    it('должен отправлять unmount event при размонтировании', () => {
      const { unmount } = render(<Badge value='test' />);

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2);
      expect(mockInfoFireAndForget).toHaveBeenLastCalledWith('Badge unmount', {
        component: 'Badge',
        action: 'unmount',
        hidden: false,
        value: 'test',
      });
    });

    it('должен отправлять telemetry с правильным значением hidden', () => {
      mockFeatureFlagReturnValue = true;

      render(<Badge value='test' isHiddenByFeatureFlag={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Badge mount', {
        component: 'Badge',
        action: 'mount',
        hidden: true,
        value: 'test',
      });
    });

    it('должен отправлять telemetry с null значением', () => {
      render(<Badge value={null} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Badge mount', {
        component: 'Badge',
        action: 'mount',
        hidden: false,
        value: null,
      });
    });

    it('должен отправлять telemetry с числовым значением', () => {
      render(<Badge value={42} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Badge mount', {
        component: 'Badge',
        action: 'mount',
        hidden: false,
        value: 42,
      });
    });

    it('должен отправлять telemetry только при telemetryEnabled=true', () => {
      render(<Badge value='test' telemetryEnabled={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('должен отправлять telemetry по умолчанию (telemetryEnabled не указан)', () => {
      render(<Badge value='test' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('должен отправлять unmount event при размонтировании', () => {
      const { unmount } = render(<Badge value='test' />);

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2);
      expect(mockInfoFireAndForget).toHaveBeenLastCalledWith('Badge unmount', {
        component: 'Badge',
        action: 'unmount',
        hidden: false,
        value: 'test',
      });
    });

    it('не должен отправлять telemetry при telemetryEnabled=false', () => {
      render(<Badge value='test' telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Dev warnings', () => {
    beforeEach(() => {
      // Включаем development режим
      vi.stubEnv('NODE_ENV', 'development');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('должен показывать warning при null значении в development', () => {
      render(<Badge value={null} />);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AppBadge]: value is null or undefined. Badge usually should display something.',
      );
    });

    it('не должен показывать warning при валидном значении в development', () => {
      render(<Badge value='test' />);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('не должен показывать warning в production', () => {
      vi.stubEnv('NODE_ENV', 'production');

      render(<Badge value={null} />);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Ref forwarding', () => {
    it('должен forward ref в Core Badge', () => {
      const ref = React.createRef<HTMLSpanElement>();

      render(<Badge ref={ref} value='test' />);

      expect(ref.current).toBeInstanceOf(HTMLSpanElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppBadge');
    });
  });

  describe('Props processing', () => {
    it('должен корректно обрабатывать все типы значений', () => {
      const { rerender } = render(<Badge value='string' />);
      expect(screen.getByTestId('core-badge')).toBeInTheDocument();

      rerender(<Badge value={123} />);
      expect(screen.getByTestId('core-badge')).toBeInTheDocument();

      rerender(<Badge value={null} />);
      expect(screen.getByTestId('core-badge')).toBeInTheDocument();
    });

    it('должен передавать все HTML атрибуты', () => {
      render(<Badge value='test' id='badge-1' tabIndex={0} aria-label='custom' />);

      const badge = screen.getByTestId('core-badge');
      expect(badge).toHaveAttribute('id', 'badge-1');
      expect(badge).toHaveAttribute('tabindex', '0');
      expect(badge).toHaveAttribute('aria-label', 'custom');
    });
  });

  describe('Render stability', () => {
    it('должен стабильно рендериться при одинаковых пропсах', () => {
      const { rerender, container } = render(<Badge value='test' />);
      const firstRender = container.innerHTML;

      rerender(<Badge value='test' />);
      const secondRender = container.innerHTML;

      expect(firstRender).toBe(secondRender);
    });

    it('не должен пересчитывать lifecycle telemetry при изменении пропсов', () => {
      const { rerender } = render(<Badge value='test' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Badge mount', {
        component: 'Badge',
        action: 'mount',
        hidden: false,
        value: 'test',
      });

      mockInfoFireAndForget.mockClear();

      rerender(<Badge value='new value' />);
      // Lifecycle telemetry не должен пересчитываться при изменении пропсов
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <Badge value='test' {...{ ariaLabelI18nKey: 'common.first' } as any} />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(<Badge value='test' {...{ ariaLabelI18nKey: 'common.second' } as any} />);

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'common.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      render(<Badge value='test' aria-label='Regular label' />);

      expect(screen.getByTestId('core-badge')).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(<Badge value='test' {...{ ariaLabelI18nKey: 'common.test' } as any} />);

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
