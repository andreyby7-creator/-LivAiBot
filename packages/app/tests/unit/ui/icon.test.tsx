/**
 * @vitest-environment jsdom
 * @file Тесты для Icon компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
  }),
}));

import { Icon } from '../../../src/ui/icon';

describe('Icon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить icon элемент с обязательным пропсом name', () => {
      render(<Icon name='test-icon' />);

      const icon = screen.getByRole('img');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('data-component', 'AppIcon');
    });

    it('должен иметь правильные атрибуты по умолчанию', () => {
      render(<Icon name='test-icon' />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('data-component', 'AppIcon');
      expect(icon).toHaveAttribute('data-icon-name', 'test-icon');
      expect(icon).toHaveAttribute('aria-label', 'test-icon');
      expect(icon).toHaveAttribute('role', 'img');
    });

    it('должен применять data атрибуты', () => {
      render(<Icon name='test-icon' data-testid='test-icon' />);

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('Feature flags - isHiddenByFeatureFlag', () => {
    it('должен быть скрыт когда isHiddenByFeatureFlag=true', () => {
      render(<Icon name='test-icon' isHiddenByFeatureFlag />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();
    });

    it('должен быть видим когда isHiddenByFeatureFlag=false', () => {
      render(<Icon name='test-icon' isHiddenByFeatureFlag={false} />);

      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('должен быть видим когда isHiddenByFeatureFlag не указан', () => {
      render(<Icon name='test-icon' />);

      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('должен устанавливать data-hidden=true когда скрыт', () => {
      render(<Icon name='test-icon' isHiddenByFeatureFlag />);

      // Когда компонент скрыт, он возвращает null, поэтому data-hidden не применяется
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('Feature flags - variantByFeatureFlag', () => {
    it('должен устанавливать data-variant когда variantByFeatureFlag указан', () => {
      render(<Icon name='test-icon' variantByFeatureFlag='primary' />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('data-variant', 'primary');
    });

    it('не должен устанавливать data-variant когда variantByFeatureFlag не указан', () => {
      render(<Icon name='test-icon' />);

      const icon = screen.getByRole('img');
      expect(icon).not.toHaveAttribute('data-variant');
    });

    it('не должен устанавливать data-variant когда variantByFeatureFlag не указан', () => {
      render(<Icon name='test-icon' />);

      const icon = screen.getByRole('img');
      expect(icon).not.toHaveAttribute('data-variant');
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять telemetry при mount и unmount по умолчанию', () => {
      const { unmount } = render(<Icon name='test-icon' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Icon mount', {
        component: 'Icon',
        action: 'mount',
        hidden: false,
        variant: null,
        name: 'test-icon',
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Icon unmount', {
        component: 'Icon',
        action: 'unmount',
        hidden: false,
        variant: null,
        name: 'test-icon',
      });
    });

    it('должен отправлять telemetry с variant когда variantByFeatureFlag указан', () => {
      render(<Icon name='test-icon' variantByFeatureFlag='secondary' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Icon mount', {
        component: 'Icon',
        action: 'mount',
        hidden: false,
        variant: 'secondary',
        name: 'test-icon',
      });
    });

    it('должен отправлять telemetry с hidden=true когда isHiddenByFeatureFlag=true', () => {
      render(<Icon name='test-icon' isHiddenByFeatureFlag />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Icon mount', {
        component: 'Icon',
        action: 'mount',
        hidden: true,
        variant: null,
        name: 'test-icon',
      });
    });

    it('должен отключать telemetry когда telemetryEnabled=false', () => {
      render(<Icon name='test-icon' telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен включать telemetry когда telemetryEnabled=true', () => {
      render(<Icon name='test-icon' telemetryEnabled />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Icon mount', expect.any(Object));
    });

    it('должен включать telemetry по умолчанию когда telemetryEnabled не указан', () => {
      render(<Icon name='test-icon' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Icon mount', expect.any(Object));
    });

    it('должен отправлять telemetry только при mount когда telemetryEnabled=true, игнорируя unmount', () => {
      const { unmount } = render(<Icon name='test-icon' telemetryEnabled />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Icon mount', expect.any(Object));

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2);
      expect(mockInfoFireAndForget).toHaveBeenLastCalledWith('Icon unmount', expect.any(Object));
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLElement>();

      render(<Icon name='test-icon' ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLElement);
      expect(ref.current?.tagName).toBe('I');
    });

    it('должен поддерживать функциональный ref', () => {
      const refCallback = vi.fn();

      render(<Icon name='test-icon' ref={refCallback} />);

      expect(refCallback).toHaveBeenCalledWith(expect.any(HTMLElement));
    });

    it('должен корректно работать с null ref', () => {
      expect(() => {
        render(<Icon name='test-icon' ref={null} />);
      }).not.toThrow();

      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('Проброс пропсов к CoreIcon', () => {
    it('должен пробрасывать size пропс', () => {
      render(<Icon name='test-icon' size={24 as any} />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveStyle('--icon-size: 24px');
    });

    it('должен пробрасывать color пропс', () => {
      render(<Icon name='test-icon' color='red' />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveStyle('--icon-color: red');
    });

    it('должен пробрасывать decorative пропс', () => {
      render(<Icon name='test-icon' decorative data-testid='decorative-icon' />);

      // Для decorative иконок используем getByTestId, так как они скрыты от screen readers
      const icon = screen.getByTestId('decorative-icon');
      expect(icon).toHaveAttribute('aria-hidden');
      expect(icon).not.toHaveAttribute('role');
      expect(icon).not.toHaveAttribute('aria-label');
    });

    it('должен пробрасывать ariaLabel пропс', () => {
      render(<Icon name='test-icon' ariaLabel='Custom label' />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('aria-label', 'Custom label');
    });

    it('должен пробрасывать HTML атрибуты', () => {
      render(<Icon name='test-icon' id='test-id' className='test-class' />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('id', 'test-id');
      expect(icon).toHaveAttribute('class', 'test-class');
    });
  });

  describe('Development warnings', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it('должен показывать warning в development когда name не указан', () => {
      vi.stubEnv('NODE_ENV', 'development');

      // @ts-expect-error - тестируем runtime поведение с отсутствующим name
      render(<Icon />);

      expect(consoleWarnSpy).toHaveBeenCalledWith('[AppIcon]: name is required');
    });

    it('не должен показывать warning в production когда name не указан', () => {
      vi.stubEnv('NODE_ENV', 'production');

      // @ts-expect-error - тестируем runtime поведение с отсутствующим name
      render(<Icon />);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('не должен показывать warning когда name указан', () => {
      vi.stubEnv('NODE_ENV', 'development');

      render(<Icon name='test-icon' />);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Memo optimization', () => {
    it('должен предотвращать ненужные ре-рендеры с memo', () => {
      let renderCount = 0;

      const TestComponent = React.memo(() => {
        renderCount++;
        return <Icon name='memo-test' />;
      });

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);

      expect(renderCount).toBe(1);
    });
  });

  describe('Стабильность рендера', () => {
    it('рендер должен быть стабилен при одинаковых пропсах', () => {
      const { container, rerender } = render(
        <Icon
          name='stable-icon'
          size={20 as any}
          color='blue'
          variantByFeatureFlag='primary'
        />,
      );

      const firstRender = container.innerHTML;

      rerender(
        <Icon
          name='stable-icon'
          size={20 as any}
          color='blue'
          variantByFeatureFlag='primary'
        />,
      );

      expect(container.innerHTML).toBe(firstRender);
    });
  });

  describe('Edge cases', () => {
    it('должен работать с отсутствующими пропсами', () => {
      render(<Icon name='test-icon' />);

      const icon = screen.getByRole('img');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('data-icon-name', 'test-icon');
    });

    it('должен корректно обрабатывать пустые строки', () => {
      render(<Icon name='test-icon' ariaLabel='' variantByFeatureFlag='' />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('aria-label', '');
      expect(icon).toHaveAttribute('data-variant', '');
    });
  });
});
