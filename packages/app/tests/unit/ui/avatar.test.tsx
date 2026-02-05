/**
 * @vitest-environment jsdom
 * @file Тесты для Avatar компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Avatar - возвращаем простой div, фильтруя Core-специфичные пропсы
vi.mock('../../../../ui-core/src/primitives/avatar', () => ({
  Avatar: ({
    'data-testid': testId,
    src,
    alt,
    fallbackText,
    size,
    bgColor,
    className,
    style,
    ...domProps
  }: Readonly<Record<string, unknown>>) => (
    <div
      data-testid={testId ?? 'core-avatar'}
      data-src={src}
      data-alt={alt}
      data-fallback-text={fallbackText}
      data-size={size}
      data-bg-color={bgColor}
      className={className as string}
      style={style as React.CSSProperties}
      {...domProps}
    />
  ),
}));

// Mock для UnifiedUIProvider

// Mock для UnifiedUIProvider
let mockFeatureFlagReturnValue = false;
const mockInfoFireAndForget = vi.fn();

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
  }),
}));

import { Avatar } from '../../../src/ui/avatar';

// Mock console.warn для тестирования dev warnings
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockClear();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить avatar с обязательными пропсами', () => {
      render(<Avatar alt='Test User' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('data-component', 'AppAvatar');
    });

    it('должен передавать все пропсы в Core Avatar', () => {
      render(
        <Avatar
          alt='Test User'
          size={48}
          bgColor='#FF0000'
          className='test-class'
          data-testid='custom-avatar'
        />,
      );

      const avatar = screen.getByTestId('custom-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('data-component', 'AppAvatar');
      expect(avatar).toHaveAttribute('data-alt', 'Test User');
      expect(avatar).toHaveAttribute('data-size', '48');
      expect(avatar).toHaveAttribute('data-bg-color', '#FF0000');
      expect(avatar).toHaveClass('test-class');
    });
  });

  describe('Feature flags и видимость', () => {
    it('должен рендерить компонент когда feature flag false', () => {
      mockFeatureFlagReturnValue = false;

      render(<Avatar alt='Test User' isHiddenByFeatureFlag={false} />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toBeInTheDocument();
    });

    it('должен скрывать компонент когда feature flag true', () => {
      mockFeatureFlagReturnValue = true;

      render(<Avatar alt='Test User' isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-avatar')).not.toBeInTheDocument();
    });

    it('должен использовать false по умолчанию для feature flag', () => {
      mockFeatureFlagReturnValue = false;

      render(<Avatar alt='Test User' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount событие при рендере', () => {
      mockFeatureFlagReturnValue = false;

      render(<Avatar alt='Test User' name='John Doe' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Avatar mount', {
        component: 'Avatar',
        action: 'mount',
        hidden: false,
        name: 'John Doe',
      });
    });

    it('должен отправлять unmount событие при размонтировании', () => {
      mockFeatureFlagReturnValue = false;

      const { unmount } = render(<Avatar alt='Test User' name='John Doe' />);

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Avatar unmount', {
        component: 'Avatar',
        action: 'unmount',
        hidden: false,
        name: 'John Doe',
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      mockFeatureFlagReturnValue = false;

      render(<Avatar alt='Test User' name='John Doe' telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен использовать true по умолчанию для telemetry', () => {
      mockFeatureFlagReturnValue = false;

      render(<Avatar alt='Test User' name='John Doe' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Avatar mount', expect.any(Object));
    });

    it('должен передавать null для name когда name не указан', () => {
      mockFeatureFlagReturnValue = false;

      render(<Avatar alt='Test User' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Avatar mount', {
        component: 'Avatar',
        action: 'mount',
        hidden: false,
        name: null,
      });
    });
  });

  describe('Props processing', () => {
    it('должен вычислять alt из name с fallback на "avatar"', () => {
      render(<Avatar name='John Doe' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-alt', 'John Doe');
    });

    it('должен использовать name как alt когда name передан', () => {
      render(<Avatar name='Jane Smith' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-alt', 'Jane Smith');
    });

    it('должен использовать "avatar" как alt когда name null', () => {
      render(<Avatar name={null} />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-alt', 'avatar');
    });

    it('должен вычислять fallbackText из имени', () => {
      render(<Avatar name='John Michael Doe' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-fallback-text', 'JM');
    });

    it('должен вычислять fallbackText для односимвольного имени', () => {
      render(<Avatar name='A' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-fallback-text', 'A');
    });

    it('должен использовать пустую строку для fallbackText когда имя пустое', () => {
      render(<Avatar name='' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-fallback-text', '');
    });

    it('должен передавать src напрямую', () => {
      render(<Avatar src='/test.jpg' alt='Test User' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-src', '/test.jpg');
    });

    it('должен передавать src как undefined когда src не передан', () => {
      render(<Avatar alt='Test User' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).not.toHaveAttribute('src');
    });
  });

  describe('Dev warnings', () => {
    it('должен выбрасывать ошибку в development когда src и name отсутствуют', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(() => render(<Avatar alt='Test User' />)).toThrow(
        '[AppAvatar] Development Error: Either "src" or "name" prop must be provided. '
          + 'Avatar needs either an image source or a name to generate fallback initials. '
          + 'Example: <Avatar src="/user.jpg" alt="John" /> or <Avatar name="John Doe" />',
      );
    });

    it('не должен выбрасывать ошибку в production', () => {
      vi.stubEnv('NODE_ENV', 'production');

      expect(() => render(<Avatar alt='Test User' />)).not.toThrow();
    });

    it('не должен выбрасывать ошибку когда src присутствует', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(() => render(<Avatar src='/test.jpg' alt='Test User' />)).not.toThrow();
    });

    it('не должен выбрасывать ошибку когда name присутствует', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(() => render(<Avatar name='John Doe' />)).not.toThrow();
    });
  });

  describe('Policy computation', () => {
    it('должен вычислять policy с правильными значениями', () => {
      mockFeatureFlagReturnValue = true;

      render(
        <Avatar
          src='/test.jpg'
          alt='Test User'
          isHiddenByFeatureFlag={true}
          telemetryEnabled={false}
        />,
      );

      // Компонент должен быть скрыт
      expect(screen.queryByTestId('core-avatar')).not.toBeInTheDocument();

      // Telemetry не должен быть вызван
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен правильно комбинировать feature flag и telemetry settings', () => {
      mockFeatureFlagReturnValue = false;

      render(<Avatar src='/test.jpg' alt='Test User' telemetryEnabled={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Avatar mount', {
        component: 'Avatar',
        action: 'mount',
        hidden: false,
        name: null,
      });
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Avatar ref={ref} src='/test.jpg' alt='Test User' />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppAvatar');
    });
  });

  describe('Render stability', () => {
    it('должен быть стабилен при перерендере с одинаковыми пропсами', () => {
      const { rerender } = render(<Avatar alt='Test User' name='John Doe' />);
      const avatar1 = screen.getByTestId('core-avatar');

      rerender(<Avatar alt='Test User' name='John Doe' />);
      const avatar2 = screen.getByTestId('core-avatar');

      expect(avatar1).toBe(avatar2);
    });

    it('не должен пересчитывать lifecycle telemetry при изменении пропсов', () => {
      const { rerender } = render(<Avatar alt='Test User' name='John Doe' />);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Avatar mount', {
        component: 'Avatar',
        action: 'mount',
        hidden: false,
        name: 'John Doe',
      });

      mockInfoFireAndForget.mockClear();

      rerender(<Avatar alt='Test User' name='Jane Smith' />);
      // Lifecycle telemetry не должен пересчитываться при изменении пропсов
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('должен работать с null name', () => {
      render(<Avatar src='/test.jpg' name={null} />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-alt', 'avatar');
      expect(avatar).toHaveAttribute('data-fallback-text', '');
    });

    it('должен работать с пустой строкой name', () => {
      render(<Avatar name='' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-alt', '');
      expect(avatar).toHaveAttribute('data-fallback-text', '');
    });

    it('должен правильно обрабатывать многословные имена', () => {
      render(<Avatar name='John Jacob Jingleheimer Schmidt' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-alt', 'John Jacob Jingleheimer Schmidt');
      expect(avatar).toHaveAttribute('data-fallback-text', 'JJ');
    });

    it('должен ограничивать инициалы двумя символами максимум', () => {
      render(<Avatar name='Very Long Name Here' />);

      const avatar = screen.getByTestId('core-avatar');
      expect(avatar).toHaveAttribute('data-fallback-text', 'VL');
    });
  });
});
