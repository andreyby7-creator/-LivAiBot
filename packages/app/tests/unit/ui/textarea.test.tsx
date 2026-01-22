/**
 * @vitest-environment jsdom
 * @file Тесты для Textarea компонента с полным покрытием
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

import { Textarea } from '../../../src/ui/textarea';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

// Mock для feature flags - useFeatureFlag просто возвращает Boolean(flagValue)
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: (flagValue?: boolean) => Boolean(flagValue),
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

describe('Textarea', () => {
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
    it('должен рендерить textarea элемент', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('должен рендерить с контролируемым значением', () => {
      render(<Textarea value='test value' />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('test value');
    });

    it('должен рендерить с неконтролируемым значением', () => {
      render(<Textarea defaultValue='default value' />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('default value');
    });

    it('должен пробрасывать HTML атрибуты', () => {
      render(
        <Textarea
          placeholder='Test placeholder'
          rows={5}
          cols={30}
          maxLength={100}
          className='custom-class'
          id='test-id'
        />,
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', 'Test placeholder');
      expect(textarea).toHaveAttribute('rows', '5');
      expect(textarea).toHaveAttribute('cols', '30');
      expect(textarea).toHaveAttribute('maxLength', '100');
      expect(textarea).toHaveClass('custom-class');
      expect(textarea).toHaveAttribute('id', 'test-id');
    });
  });

  describe('Feature flags', () => {
    describe('isHiddenByFeatureFlag', () => {
      it('должен рендерить компонент при isHiddenByFeatureFlag=false', () => {
        render(<Textarea isHiddenByFeatureFlag={false} />);

        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      it('должен скрывать компонент при isHiddenByFeatureFlag=true', () => {
        const { container } = render(<Textarea isHiddenByFeatureFlag={true} />);

        expect(container.firstChild).toBeNull();
      });
    });

    describe('isDisabledByFeatureFlag', () => {
      it('должен быть enabled при isDisabledByFeatureFlag=false', () => {
        render(<Textarea isDisabledByFeatureFlag={false} />);

        const textarea = screen.getByRole('textbox');
        expect(textarea).not.toHaveAttribute('disabled');
        expect(textarea).not.toHaveAttribute('aria-disabled');
        expect(textarea).not.toHaveAttribute('aria-busy');
        expect(textarea).not.toHaveAttribute('data-disabled');
      });

      it('должен быть disabled при isDisabledByFeatureFlag=true', () => {
        render(<Textarea isDisabledByFeatureFlag={true} />);

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveAttribute('disabled');
        expect(textarea).toHaveAttribute('aria-disabled', 'true');
        expect(textarea).toHaveAttribute('aria-busy', 'true');
        expect(textarea).toHaveAttribute('data-disabled', 'true');
      });
    });

    describe('variantByFeatureFlag', () => {
      it('должен применять variant из feature flag', () => {
        render(<Textarea variantByFeatureFlag='premium' />);

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveAttribute('data-variant', 'premium');
      });

      it('должен использовать null если variant не указан', () => {
        render(<Textarea />);

        const textarea = screen.getByRole('textbox');
        expect(textarea).not.toHaveAttribute('data-variant');
      });
    });
  });

  describe('Telemetry', () => {
    describe('Mount/Unmount', () => {
      it('должен отправлять telemetry при mount и unmount', () => {
        const { unmount } = render(<Textarea />);

        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Textarea mount', {
          component: 'Textarea',
          action: 'mount',
          variant: null,
          hidden: false,
          disabled: false,
        });

        unmount();

        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Textarea unmount', {
          component: 'Textarea',
          action: 'unmount',
          variant: null,
          hidden: false,
          disabled: false,
        });
      });

      it('должен отправлять telemetry с правильными значениями policy', () => {
        render(
          <Textarea
            isDisabledByFeatureFlag={true}
            variantByFeatureFlag='custom'
          />,
        );

        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Textarea mount', {
          component: 'Textarea',
          action: 'mount',
          variant: 'custom',
          hidden: false,
          disabled: true,
        });
      });

      it('должен отключать telemetry при telemetryEnabled=false', () => {
        render(<Textarea telemetryEnabled={false} />);

        expect(mockInfoFireAndForget).not.toHaveBeenCalled();
      });
    });

    describe('User interactions', () => {
      it('должен отправлять telemetry при change', () => {
        render(
          <Textarea
            onChange={mockOnChange}
            telemetryOnChange={true}
          />,
        );

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'test' } });

        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Textarea change', {
          component: 'Textarea',
          action: 'change',
          variant: null,
          hidden: false,
          disabled: false,
        });
        expect(mockOnChange).toHaveBeenCalled();
      });

      it('должен отправлять telemetry при focus/blur', () => {
        render(
          <Textarea
            onFocus={mockOnFocus}
            onBlur={mockOnBlur}
            telemetryOnFocus={true}
          />,
        );

        const textarea = screen.getByRole('textbox');
        fireEvent.focus(textarea);
        fireEvent.blur(textarea);

        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Textarea focus', {
          component: 'Textarea',
          action: 'focus',
          variant: null,
          hidden: false,
          disabled: false,
        });
        expect(mockInfoFireAndForget).toHaveBeenCalledWith('Textarea blur', {
          component: 'Textarea',
          action: 'blur',
          variant: null,
          hidden: false,
          disabled: false,
        });
        expect(mockOnFocus).toHaveBeenCalled();
        expect(mockOnBlur).toHaveBeenCalled();
      });

      it('должен отключать telemetry для change при telemetryOnChange=false', () => {
        render(
          <Textarea
            onChange={mockOnChange}
            telemetryOnChange={false}
          />,
        );

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'test' } });

        expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
          expect.stringContaining('Textarea change'),
          expect.anything(),
        );
        expect(mockOnChange).toHaveBeenCalled();
      });

      it('должен отключать telemetry для focus/blur при telemetryOnFocus=false', () => {
        render(
          <Textarea
            onFocus={mockOnFocus}
            telemetryOnFocus={false}
          />,
        );

        const textarea = screen.getByRole('textbox');
        fireEvent.focus(textarea);

        expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
          expect.stringContaining('Textarea focus'),
          expect.anything(),
        );
        expect(mockOnFocus).toHaveBeenCalled();
      });
    });
  });

  describe('Event handlers', () => {
    it('должен блокировать onChange при disabled=true', () => {
      render(
        <Textarea
          isDisabledByFeatureFlag={true}
          onChange={mockOnChange}
        />,
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'test' } });

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(mockInfoFireAndForget).not.toHaveBeenCalledWith(
        expect.stringContaining('Textarea change'),
        expect.anything(),
      );
    });

    it('должен вызывать onChange при disabled=false', () => {
      render(<Textarea onChange={mockOnChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'test' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: 'test' }),
        }),
      );
    });

    it('должен вызывать onFocus и onBlur независимо от disabled', () => {
      render(
        <Textarea
          isDisabledByFeatureFlag={true}
          onFocus={mockOnFocus}
          onBlur={mockOnBlur}
        />,
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.focus(textarea);
      fireEvent.blur(textarea);

      expect(mockOnFocus).toHaveBeenCalled();
      expect(mockOnBlur).toHaveBeenCalled();
    });
  });

  describe('Policy слой', () => {
    it('должен правильно вычислять policy с дефолтными значениями', () => {
      render(<Textarea />);

      // Проверяем что компонент рендерится с дефолтной policy
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).not.toHaveAttribute('disabled');
    });

    it('должен правильно вычислять policy с кастомными значениями', () => {
      render(
        <Textarea
          isDisabledByFeatureFlag={true}
          variantByFeatureFlag='premium'
          telemetryEnabled={false}
          telemetryOnChange={false}
          telemetryOnFocus={false}
        />,
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('disabled');
      expect(textarea).toHaveAttribute('data-variant', 'premium');
      expect(textarea).toHaveAttribute('aria-disabled', 'true');
      expect(textarea).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Memo оптимизация', () => {
    it('компонент использует React.memo', () => {
      expect(Textarea).toHaveProperty('$$typeof');
      expect(Textarea.displayName).toBe('Textarea');
    });
  });

  describe('Edge cases', () => {
    it('работает с falsy значениями пропсов', () => {
      render(
        <Textarea
          placeholder=''
          disabled={false}
        />,
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', '');
      expect(textarea).not.toHaveAttribute('disabled');
      // rows не проверяем, так как 0 не пробрасывается в DOM
    });

    it('работает без event handlers', () => {
      expect(() => {
        render(<Textarea />);
      }).not.toThrow();

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });
  });
});
