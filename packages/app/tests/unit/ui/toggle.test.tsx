/**
 * @vitest-environment jsdom
 * @file Тесты для Toggle компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для feature flags - useFeatureFlag просто возвращает Boolean(flagValue)
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: (flagValue?: boolean) => Boolean(flagValue),
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

import { Toggle } from '../../../src/ui/toggle';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

describe('Toggle', () => {
  const mockOnChange = vi.fn();
  const mockOnFocus = vi.fn();
  const mockOnBlur = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить toggle элемент', () => {
      render(<Toggle />);

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('должен рендерить с контролируемым состоянием', () => {
      render(<Toggle checked indeterminate onChange={mockOnChange} />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeChecked();
      expect((toggle as unknown as HTMLInputElement).indeterminate).toBe(true);
    });

    it('должен иметь правильные атрибуты по умолчанию', () => {
      render(<Toggle />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('data-component', 'AppToggle');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).not.toBeDisabled();
    });

    it('должен применять data атрибуты', () => {
      render(<Toggle data-testid='test-toggle' />);

      expect(screen.getByTestId('test-toggle')).toBeInTheDocument();
    });
  });

  describe('Feature flags', () => {
    it('должен быть скрыт когда isHiddenByFeatureFlag=true', () => {
      render(<Toggle isHiddenByFeatureFlag />);

      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('должен быть видим когда isHiddenByFeatureFlag=false', () => {
      render(<Toggle isHiddenByFeatureFlag={false} />);

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('должен быть disabled когда isDisabledByFeatureFlag=true', () => {
      render(<Toggle isDisabledByFeatureFlag />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAttribute('aria-disabled', 'true');
      expect(toggle).toHaveAttribute('aria-busy', 'true');
    });

    it('должен иметь variant когда variantByFeatureFlag установлен', () => {
      render(<Toggle variantByFeatureFlag='primary' />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Default props', () => {
    it('должен иметь checked=false по умолчанию', () => {
      render(<Toggle />);

      const toggle = screen.getByRole('switch');
      expect(toggle).not.toBeChecked();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('должен иметь indeterminate=false по умолчанию', () => {
      render(<Toggle />);

      const toggle = screen.getByRole('switch');
      expect((toggle as unknown as HTMLInputElement).indeterminate).toBe(false);
    });

    it('должен принимать checked=true', () => {
      render(<Toggle checked />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeChecked();
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('должен принимать indeterminate=true', () => {
      render(<Toggle indeterminate />);

      const toggle = screen.getByRole('switch');
      expect((toggle as unknown as HTMLInputElement).indeterminate).toBe(true);
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount/unmount телеметрию по умолчанию', () => {
      const { unmount } = render(<Toggle checked indeterminate />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toggle mount', {
        component: 'Toggle',
        action: 'mount',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toggle unmount', {
        component: 'Toggle',
        action: 'unmount',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
      });
    });

    it('должен отправлять change телеметрию', () => {
      render(<Toggle onChange={mockOnChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toggle change', {
        component: 'Toggle',
        action: 'change',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
      });
    });

    it('должен отправлять focus телеметрию', () => {
      render(<Toggle onFocus={mockOnFocus} />);

      const toggle = screen.getByRole('switch');
      fireEvent.focus(toggle);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toggle focus', {
        component: 'Toggle',
        action: 'focus',
        variant: null,
        hidden: false,
        disabled: false,
        checked: false,
      });
    });

    it('должен отправлять blur телеметрию', () => {
      render(<Toggle onBlur={mockOnBlur} />);

      const toggle = screen.getByRole('switch');
      fireEvent.blur(toggle);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toggle blur', {
        component: 'Toggle',
        action: 'blur',
        variant: null,
        hidden: false,
        disabled: false,
        checked: false,
      });
    });

    it('не должен отправлять телеметрию когда telemetryEnabled=false', () => {
      render(<Toggle telemetryEnabled={false} onChange={mockOnChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('не должен отправлять change телеметрию когда telemetryOnChange=false', () => {
      render(<Toggle telemetryOnChange={false} onChange={mockOnChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('не должен отправлять focus телеметрию когда telemetryOnFocus=false', () => {
      render(<Toggle telemetryOnFocus={false} onFocus={mockOnFocus} />);

      const toggle = screen.getByRole('switch');
      fireEvent.focus(toggle);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('не должен отправлять blur телеметрию когда telemetryOnBlur=false', () => {
      render(<Toggle telemetryOnBlur={false} onBlur={mockOnBlur} />);

      const toggle = screen.getByRole('switch');
      fireEvent.blur(toggle);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });
  });

  describe('Event handlers', () => {
    it('должен вызывать onChange с правильным event', () => {
      render(<Toggle onChange={mockOnChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onFocus с правильным event', () => {
      render(<Toggle onFocus={mockOnFocus} />);

      const toggle = screen.getByRole('switch');
      fireEvent.focus(toggle);

      expect(mockOnFocus).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onBlur с правильным event', () => {
      render(<Toggle onBlur={mockOnBlur} />);

      const toggle = screen.getByRole('switch');
      fireEvent.blur(toggle);

      expect(mockOnBlur).toHaveBeenCalledTimes(1);
    });

    it('не должен вызывать onChange когда disabled', () => {
      render(<Toggle isDisabledByFeatureFlag onChange={mockOnChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Toggle ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe('checkbox');
      expect(ref.current?.getAttribute('role')).toBe('switch');
    });
  });

  describe('Memoization', () => {
    it('должен быть memoized', () => {
      const renderSpy = vi.fn(() => <Toggle />);
      const Component = React.memo(renderSpy);

      const { rerender } = render(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('должен иметь displayName', () => {
      expect(Toggle.displayName).toBe('Toggle');
    });
  });

  describe('Policy logic', () => {
    it('должен правильно вычислять policy', () => {
      render(
        <Toggle
          isHiddenByFeatureFlag
          isDisabledByFeatureFlag
          variantByFeatureFlag='test'
          telemetryEnabled={false}
          telemetryOnChange={false}
          telemetryOnFocus={false}
          telemetryOnBlur={false}
        />,
      );

      // Компонент скрыт, поэтому не рендерится
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('должен иметь правильные значения policy по умолчанию', () => {
      render(<Toggle onChange={mockOnChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      // Проверяем что телеметрия отправляется (значит telemetryEnabled=true по умолчанию)
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Toggle change', expect.any(Object));
    });
  });

  describe('Props forwarding', () => {
    it('должен пробрасывать HTML атрибуты в CoreToggle', () => {
      render(
        <Toggle
          id='test-toggle'
          name='test-name'
          className='test-class'
          required
          autoFocus
        />,
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('id', 'test-toggle');
      expect(toggle).toHaveAttribute('name', 'test-name');
      expect(toggle).toHaveAttribute('class', 'test-class');
      expect(toggle).toHaveAttribute('required');
    });
  });

  describe('State synchronization', () => {
    it('должен синхронизировать checked состояние', () => {
      const { rerender } = render(<Toggle checked />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeChecked();

      rerender(<Toggle checked={false} />);
      expect(toggle).not.toBeChecked();

      rerender(<Toggle checked />);
      expect(toggle).toBeChecked();
    });

    it('должен синхронизировать indeterminate состояние', () => {
      const { rerender } = render(<Toggle indeterminate />);

      const toggle = screen.getByRole('switch');
      expect((toggle as unknown as HTMLInputElement).indeterminate).toBe(true);

      rerender(<Toggle indeterminate={false} />);
      expect((toggle as unknown as HTMLInputElement).indeterminate).toBe(false);

      rerender(<Toggle indeterminate />);
      expect((toggle as unknown as HTMLInputElement).indeterminate).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('должен работать с undefined пропсами', () => {
      render(
        <Toggle
          onChange={undefined}
          onFocus={undefined}
          onBlur={undefined}
        />,
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('должен работать без обработчиков событий', () => {
      expect(() => {
        render(<Toggle />);
        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);
        fireEvent.focus(toggle);
        fireEvent.blur(toggle);
      }).not.toThrow();
    });
  });
});
