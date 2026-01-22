/**
 * @vitest-environment jsdom
 * @file Тесты для Badge компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Badge - возвращаем простой span
vi.mock('../../../../ui-core/src/primitives/badge', () => ({
  Badge: ({ 'data-testid': testId, ...props }: Readonly<Record<string, unknown>>) => (
    <span data-testid={testId ?? 'core-badge'} {...props} />
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

import { Badge } from '../../../src/ui/badge';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

// Mock console.warn для тестирования dev warnings
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockClear();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
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

    it('должен перерендериваться при изменении значимых пропсов', () => {
      const { rerender } = render(<Badge value='test' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Badge mount', {
        component: 'Badge',
        action: 'mount',
        hidden: false,
        value: 'test',
      });

      rerender(<Badge value='new value' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(3); // unmount old + mount new
      expect(mockInfoFireAndForget).toHaveBeenNthCalledWith(2, 'Badge unmount', {
        component: 'Badge',
        action: 'unmount',
        hidden: false,
        value: 'test',
      });
      expect(mockInfoFireAndForget).toHaveBeenNthCalledWith(3, 'Badge mount', {
        component: 'Badge',
        action: 'mount',
        hidden: false,
        value: 'new value',
      });
    });
  });
});
