/**
 * @vitest-environment jsdom
 * @file Unit тесты для SupportButton компонента
 */

import { cleanup, fireEvent, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportButton } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

// Полная очистка DOM между тестами
afterEach(cleanup);

// Функция для изолированного рендера
function renderIsolated(component: Readonly<React.ReactElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  return {
    ...result,
    container,
    // Локальный поиск элементов
    getByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).getByRole(role, options),
    getByTestId: (testId: Readonly<string>) => within(container).getByTestId(testId),
    queryByTestId: (testId: Readonly<string>) => within(container).queryByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getSupportButton: () => container.querySelector('button[data-component="CoreSupportButton"]')!,
    getIcon: () => container.querySelector('[data-testid*="-icon"]'),
    getLabel: () => container.querySelector('[data-testid*="-label"]'),
  };
}

describe('SupportButton', () => {
  // Mock callbacks
  const mockOnSupportClick = vi.fn();

  // Очистка mocks перед каждым тестом
  beforeEach(() => {
    mockOnSupportClick.mockClear();
  });

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLButtonElement>();

  // Вынесенные объекты для соблюдения ESLint правил
  const customIcon = <span>🎧</span>;
  const customLabel = 'Help';

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getSupportButton } = renderIsolated(
        <SupportButton onSupportClick={mockOnSupportClick} />,
      );

      expect(container).toBeInTheDocument();
      expect(getSupportButton()).toBeInTheDocument();
      expect(getSupportButton().tagName).toBe('BUTTON');
    });

    it('рендерится с полным набором пропсов', () => {
      const { container, getSupportButton } = renderIsolated(
        <SupportButton
          label='Custom Support'
          icon='💬'
          variant='floating'
          size='large'
          disabled={false}
          onSupportClick={mockOnSupportClick}
          data-testid='test-button'
          className='custom-class'
        />,
      );

      expect(container).toBeInTheDocument();
      expect(getSupportButton()).toBeInTheDocument();
    });

    it('рендерится с disabled состоянием', () => {
      const { container, getSupportButton } = renderIsolated(
        <SupportButton onSupportClick={mockOnSupportClick} disabled={true} />,
      );

      expect(container).toBeInTheDocument();
      expect(getSupportButton()).toBeInTheDocument();
      expect(getSupportButton()).toBeDisabled();
    });
  });

  describe('4.2. Базовое отображение', () => {
    describe('Текст и иконка', () => {
      it('отображает дефолтный текст "Поддержка"', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton onSupportClick={mockOnSupportClick} />,
        );

        expect(getSupportButton()).toHaveTextContent('Поддержка');
      });

      it('отображает кастомный текст', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            label={customLabel}
            onSupportClick={mockOnSupportClick}
          />,
        );

        expect(getSupportButton()).toHaveTextContent(customLabel);
      });

      it('отображает дефолтную иконку "?"', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton onSupportClick={mockOnSupportClick} />,
        );

        expect(getSupportButton()).toHaveTextContent('?');
      });

      it('отображает кастомную иконку', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            icon={customIcon}
            onSupportClick={mockOnSupportClick}
          />,
        );

        expect(getSupportButton().innerHTML).toContain('🎧');
      });

      it('не отображает текст в minimal варианте', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            variant='minimal'
            label={customLabel}
            onSupportClick={mockOnSupportClick}
          />,
        );

        expect(getSupportButton()).not.toHaveTextContent(customLabel);
        expect(getSupportButton()).toHaveTextContent('?'); // только иконка
      });
    });

    describe('Варианты (variants)', () => {
      it('применяет default вариант по умолчанию', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton onSupportClick={mockOnSupportClick} />,
        );

        const button = getSupportButton();
        expect(button).toHaveAttribute('data-variant', 'default');
      });

      it('применяет minimal вариант', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            variant='minimal'
            onSupportClick={mockOnSupportClick}
          />,
        );

        const button = getSupportButton();
        expect(button).toHaveAttribute('data-variant', 'minimal');
      });

      it('применяет floating вариант', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            variant='floating'
            onSupportClick={mockOnSupportClick}
          />,
        );

        const button = getSupportButton();
        expect(button).toHaveAttribute('data-variant', 'floating');
      });
    });

    describe('Размеры (sizes)', () => {
      it('применяет medium размер по умолчанию', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton onSupportClick={mockOnSupportClick} />,
        );

        const button = getSupportButton();
        expect(button).toHaveAttribute('data-size', 'medium');
      });

      it('применяет small размер', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            size='small'
            onSupportClick={mockOnSupportClick}
          />,
        );

        const button = getSupportButton();
        expect(button).toHaveAttribute('data-size', 'small');
      });

      it('применяет large размер', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            size='large'
            onSupportClick={mockOnSupportClick}
          />,
        );

        const button = getSupportButton();
        expect(button).toHaveAttribute('data-size', 'large');
      });
    });

    describe('Состояния', () => {
      it('применяет disabled атрибут и data-disabled', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            onSupportClick={mockOnSupportClick}
            disabled={true}
          />,
        );

        const button = getSupportButton();
        expect(button).toHaveAttribute('data-disabled', 'true');
        expect(button).toBeDisabled();
      });

      it('не применяет disabled атрибуты когда disabled=false', () => {
        const { getSupportButton } = renderIsolated(
          <SupportButton
            onSupportClick={mockOnSupportClick}
            disabled={false}
          />,
        );

        const button = getSupportButton();
        expect(button).not.toHaveAttribute('data-disabled');
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('4.3. Взаимодействия и callbacks', () => {
    it('вызывает onSupportClick при клике', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton onSupportClick={mockOnSupportClick} />,
      );

      const button = getSupportButton();
      fireEvent.click(button);

      expect(mockOnSupportClick).toHaveBeenCalledTimes(1);
      expect(mockOnSupportClick).toHaveBeenCalledWith(expect.any(Object));
    });

    it('передает правильный event в onSupportClick', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton onSupportClick={mockOnSupportClick} />,
      );

      const button = getSupportButton();
      fireEvent.click(button);

      expect(mockOnSupportClick).toHaveBeenCalledTimes(1);
      const event = mockOnSupportClick.mock.calls[0]?.[0];
      expect(event).toBeDefined();
      expect(event.type).toBe('click');
      expect(event.target).toBe(button);
    });

    it('не вызывает onSupportClick когда disabled=true', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          disabled={true}
        />,
      );

      const button = getSupportButton();
      expect(button).toBeDisabled();

      // Пытаемся кликнуть, но disabled кнопка не должна вызывать событие
      fireEvent.click(button);

      expect(mockOnSupportClick).not.toHaveBeenCalled();
    });

    it('не вызывает onSupportClick когда callback не передан', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton />,
      );

      const button = getSupportButton();
      expect(() => fireEvent.click(button)).not.toThrow();
    });
  });

  describe('4.4. Data attributes и test IDs', () => {
    it('применяет data-component', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton onSupportClick={mockOnSupportClick} />,
      );

      const button = getSupportButton();
      expect(button).toHaveAttribute('data-component', 'CoreSupportButton');
    });

    it('применяет data-testid', () => {
      const { container } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          data-testid='custom-test-id'
        />,
      );

      expect(container.querySelector('[data-testid="custom-test-id"]')).toBeInTheDocument();
    });

    it('генерирует правильные test IDs для внутренних элементов', () => {
      const { getIcon, getLabel } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          data-testid='test'
        />,
      );

      expect(getIcon()).toBeInTheDocument();
      expect(getLabel()).toBeInTheDocument();
    });

    it('не генерирует test IDs для внутренних элементов без data-testid', () => {
      const { container } = renderIsolated(
        <SupportButton onSupportClick={mockOnSupportClick} />,
      );

      expect(container.querySelector('[data-testid*="-icon"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid*="-label"]')).not.toBeInTheDocument();
    });
  });

  describe('4.5. Ref forwarding', () => {
    it('поддерживает ref forwarding', () => {
      const ref = createMockRef();
      const { getSupportButton } = renderIsolated(
        <SupportButton
          ref={ref}
          onSupportClick={mockOnSupportClick}
        />,
      );

      const button = getSupportButton();
      expect(ref.current).toBe(button);
    });
  });

  describe('4.6. Render stability', () => {
    it('не пересчитывает стили при одинаковых пропсах', () => {
      const { rerender, getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          variant='default'
          size='medium'
          disabled={false}
        />,
      );

      const initialStyle = (getSupportButton() as HTMLElement).style.cssText;

      rerender(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          variant='default'
          size='medium'
          disabled={false}
        />,
      );

      const newStyle = (getSupportButton() as HTMLElement).style.cssText;
      expect(newStyle).toBe(initialStyle);
    });

    it('пересчитывает стили при изменении variant', () => {
      const { rerender, getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          variant='default'
        />,
      );

      const initialVariant = getSupportButton().getAttribute('data-variant');

      rerender(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          variant='minimal'
        />,
      );

      const newVariant = getSupportButton().getAttribute('data-variant');
      expect(initialVariant).toBe('default');
      expect(newVariant).toBe('minimal');
    });

    it('пересчитывает стили при изменении size', () => {
      const { rerender, getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          size='medium'
        />,
      );

      const initialSize = getSupportButton().getAttribute('data-size');

      rerender(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          size='large'
        />,
      );

      const newSize = getSupportButton().getAttribute('data-size');
      expect(initialSize).toBe('medium');
      expect(newSize).toBe('large');
    });

    it('пересчитывает стили при изменении disabled', () => {
      const { rerender, getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          disabled={false}
        />,
      );

      const initialDisabled = getSupportButton().hasAttribute('data-disabled');

      rerender(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          disabled={true}
        />,
      );

      const newDisabled = getSupportButton().hasAttribute('data-disabled');
      expect(initialDisabled).toBe(false);
      expect(newDisabled).toBe(true);
    });
  });

  describe('4.7. Edge cases', () => {
    it('работает с пустым label', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          label=''
          onSupportClick={mockOnSupportClick}
        />,
      );

      expect(getSupportButton()).toBeInTheDocument();
    });

    it('работает с null icon', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          icon={null}
          onSupportClick={mockOnSupportClick}
        />,
      );

      expect(getSupportButton()).toBeInTheDocument();
    });

    it('работает с undefined icon', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          icon={undefined}
          onSupportClick={mockOnSupportClick}
        />,
      );

      expect(getSupportButton()).toBeInTheDocument();
    });

    it('работает с undefined label', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
        />,
      );

      expect(getSupportButton()).toHaveTextContent('Поддержка');
    });

    it('работает с undefined disabled', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
        />,
      );

      expect(getSupportButton()).not.toBeDisabled();
    });

    it('работает с undefined variant', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
        />,
      );

      const button = getSupportButton();
      expect(button).toHaveAttribute('data-variant', 'default');
    });

    it('работает с undefined size', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
        />,
      );

      const button = getSupportButton();
      expect(button).toHaveAttribute('data-size', 'medium');
    });

    it('работает с undefined data-testid', () => {
      const { container } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
        />,
      );

      expect(container.querySelector('[data-testid]')).toBeNull();
    });

    it('работает с пустым data-testid', () => {
      const { container } = renderIsolated(
        <SupportButton
          data-testid=''
          onSupportClick={mockOnSupportClick}
        />,
      );

      expect(container.querySelector('[data-testid]')).toBeNull();
    });

    it('применяет дополнительные HTML атрибуты', () => {
      const { getSupportButton } = renderIsolated(
        <SupportButton
          onSupportClick={mockOnSupportClick}
          title='Support button'
          aria-label='Get help'
        />,
      );

      const button = getSupportButton();
      expect(button).toHaveAttribute('title', 'Support button');
      expect(button).toHaveAttribute('aria-label', 'Get help');
    });
  });
});
