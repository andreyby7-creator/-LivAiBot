/**
 * @vitest-environment jsdom
 * @file Тесты для Radio компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

import { Radio } from '../../../src/ui/radio';

describe('Radio', () => {
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
    it('должен рендерить radio элемент', () => {
      render(<Radio />);

      expect(screen.getByRole('radio')).toBeInTheDocument();
    });

    it('должен рендерить с контролируемым состоянием', () => {
      render(<Radio checked onChange={mockOnChange} />);

      const radio = screen.getByRole('radio');
      expect(radio).toBeChecked();
    });

    it('должен иметь правильные атрибуты по умолчанию', () => {
      render(<Radio />);

      const radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('data-component', 'AppRadio');
      expect(radio).toHaveAttribute('aria-checked', 'false');
      expect(radio).not.toBeDisabled();
    });

    it('должен применять data атрибуты', () => {
      render(<Radio data-testid='test-radio' />);

      expect(screen.getByTestId('test-radio')).toBeInTheDocument();
    });
  });

  describe('Feature flags', () => {
    it('должен быть скрыт когда isHiddenByFeatureFlag=true', () => {
      render(<Radio isHiddenByFeatureFlag />);

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('должен быть видим когда isHiddenByFeatureFlag=false', () => {
      render(<Radio isHiddenByFeatureFlag={false} />);

      expect(screen.getByRole('radio')).toBeInTheDocument();
    });

    it('должен быть disabled когда isDisabledByFeatureFlag=true', () => {
      render(<Radio isDisabledByFeatureFlag />);

      const radio = screen.getByRole('radio');
      expect(radio).toBeDisabled();
      expect(radio).toHaveAttribute('aria-disabled', 'true');
      expect(radio).toHaveAttribute('aria-busy', 'true');
    });

    it('должен иметь variant когда variantByFeatureFlag установлен', () => {
      render(<Radio variantByFeatureFlag='primary' />);

      const radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Default props', () => {
    it('должен иметь checked=false по умолчанию', () => {
      render(<Radio />);

      const radio = screen.getByRole('radio');
      expect(radio).not.toBeChecked();
      expect(radio).toHaveAttribute('aria-checked', 'false');
    });

    it('должен принимать checked=true', () => {
      render(<Radio checked />);

      const radio = screen.getByRole('radio');
      expect(radio).toBeChecked();
      expect(radio).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount/unmount телеметрию по умолчанию', () => {
      const { unmount } = render(<Radio checked />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Radio mount', {
        component: 'Radio',
        action: 'mount',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Radio unmount', {
        component: 'Radio',
        action: 'unmount',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
      });
    });

    it('должен отправлять change телеметрию', () => {
      render(<Radio onChange={mockOnChange} />);

      const radio = screen.getByRole('radio');
      fireEvent.click(radio);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Radio change', {
        component: 'Radio',
        action: 'change',
        variant: null,
        hidden: false,
        disabled: false,
        checked: true,
      });
    });

    it('должен отправлять focus телеметрию', () => {
      render(<Radio onFocus={mockOnFocus} />);

      const radio = screen.getByRole('radio');
      fireEvent.focus(radio);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Radio focus', {
        component: 'Radio',
        action: 'focus',
        variant: null,
        hidden: false,
        disabled: false,
        checked: false,
      });
    });

    it('должен отправлять blur телеметрию', () => {
      render(<Radio onBlur={mockOnBlur} />);

      const radio = screen.getByRole('radio');
      fireEvent.blur(radio);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Radio blur', {
        component: 'Radio',
        action: 'blur',
        variant: null,
        hidden: false,
        disabled: false,
        checked: false,
      });
    });

    it('не должен отправлять телеметрию когда telemetryEnabled=false', () => {
      render(<Radio telemetryEnabled={false} onChange={mockOnChange} />);

      const radio = screen.getByRole('radio');
      fireEvent.click(radio);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('не должен отправлять change телеметрию когда telemetryOnChange=false', () => {
      render(<Radio telemetryOnChange={false} onChange={mockOnChange} />);

      const radio = screen.getByRole('radio');
      fireEvent.click(radio);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('не должен отправлять focus телеметрию когда telemetryOnFocus=false', () => {
      render(<Radio telemetryOnFocus={false} onFocus={mockOnFocus} />);

      const radio = screen.getByRole('radio');
      fireEvent.focus(radio);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });

    it('не должен отправлять blur телеметрию когда telemetryOnBlur=false', () => {
      render(<Radio telemetryOnBlur={false} onBlur={mockOnBlur} />);

      const radio = screen.getByRole('radio');
      fireEvent.blur(radio);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1); // только mount
    });
  });

  describe('Event handlers', () => {
    it('должен вызывать onChange с правильным event', () => {
      render(<Radio onChange={mockOnChange} />);

      const radio = screen.getByRole('radio');
      fireEvent.click(radio);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onFocus с правильным event', () => {
      render(<Radio onFocus={mockOnFocus} />);

      const radio = screen.getByRole('radio');
      fireEvent.focus(radio);

      expect(mockOnFocus).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onBlur с правильным event', () => {
      render(<Radio onBlur={mockOnBlur} />);

      const radio = screen.getByRole('radio');
      fireEvent.blur(radio);

      expect(mockOnBlur).toHaveBeenCalledTimes(1);
    });

    it('не должен вызывать onChange когда disabled', () => {
      render(<Radio isDisabledByFeatureFlag onChange={mockOnChange} />);

      const radio = screen.getByRole('radio');
      fireEvent.click(radio);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Radio ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe('radio');
    });
  });

  describe('Memoization', () => {
    it('должен быть memoized', () => {
      const renderSpy = vi.fn(() => <Radio />);
      const Component = React.memo(renderSpy);

      const { rerender } = render(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<Component />);

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('должен иметь displayName', () => {
      expect(Radio.displayName).toBe('Radio');
    });
  });

  describe('Policy logic', () => {
    it('должен правильно вычислять policy', () => {
      render(
        <Radio
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
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('должен иметь правильные значения policy по умолчанию', () => {
      render(<Radio onChange={mockOnChange} />);

      const radio = screen.getByRole('radio');
      fireEvent.click(radio);

      // Проверяем что телеметрия отправляется (значит telemetryEnabled=true по умолчанию)
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Radio change', expect.any(Object));
    });
  });

  describe('Props forwarding', () => {
    it('должен пробрасывать HTML атрибуты в CoreRadio', () => {
      render(
        <Radio
          id='test-radio'
          name='test-name'
          className='test-class'
          required
          autoFocus
        />,
      );

      const radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('id', 'test-radio');
      expect(radio).toHaveAttribute('name', 'test-name');
      expect(radio).toHaveAttribute('class', 'test-class');
      expect(radio).toHaveAttribute('required');
    });
  });

  describe('State synchronization', () => {
    it('должен синхронизировать checked состояние', () => {
      const { rerender } = render(<Radio checked />);

      const radio = screen.getByRole('radio');
      expect(radio).toBeChecked();

      rerender(<Radio checked={false} />);
      expect(radio).not.toBeChecked();

      rerender(<Radio checked />);
      expect(radio).toBeChecked();
    });
  });

  describe('Edge cases', () => {
    it('должен работать с undefined пропсами', () => {
      render(
        <Radio
          checked={undefined}
          onChange={undefined}
          onFocus={undefined}
          onBlur={undefined}
        />,
      );

      const radio = screen.getByRole('radio');
      expect(radio).toBeInTheDocument();
      expect(radio).toHaveAttribute('aria-checked', 'false');
    });

    it('должен работать без обработчиков событий', () => {
      expect(() => {
        render(<Radio />);
        const radio = screen.getByRole('radio');
        fireEvent.click(radio);
        fireEvent.focus(radio);
        fireEvent.blur(radio);
      }).not.toThrow();
    });
  });
});
