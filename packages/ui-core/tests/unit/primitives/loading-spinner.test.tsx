/**
 * @vitest-environment jsdom
 * @file Unit тесты для LoadingSpinner компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LoadingSpinner } from '../../../src/primitives/loading-spinner.js';

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
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getSpinner: () =>
      container.querySelector('div[data-component="CoreLoadingSpinner"]') as HTMLElement,
    getSpinnerElement: () =>
      container.querySelector('div[data-component="CoreLoadingSpinner"] > span') as HTMLElement,
    getDotsContainer: () =>
      container.querySelector('div[data-element="dots-container"]') as HTMLElement,
    getDots: () => container.querySelectorAll('div[data-element="dots-container"] > span'),
  };
}

describe('LoadingSpinner', () => {
  // Вынесенные константы для соблюдения ESLint правил
  const customStyle: Readonly<{ margin: string; padding: string; }> = {
    margin: '10px',
    padding: '5px',
  };

  describe('1.1. Рендер без падений', () => {
    it('рендерится с дефолтными пропсами', () => {
      const { container, getSpinner } = renderIsolated(<LoadingSpinner />);

      expect(container).toBeInTheDocument();
      expect(getSpinner()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner />);

      const spinner = getSpinner();
      expect(spinner).toBeInTheDocument();
      expect(spinner.tagName).toBe('DIV');
      expect(spinner).toHaveAttribute('data-component', 'CoreLoadingSpinner');
      expect(spinner).toHaveAttribute('data-variant', 'spinner');
      expect(spinner).toHaveAttribute('role', 'status');
      expect(spinner).toHaveAttribute('aria-busy', 'true');
      expect(spinner).toHaveAttribute('aria-label', 'Загрузка');
    });
  });

  describe('1.2. Видимость (visible)', () => {
    it('по умолчанию visible=true рендерит компонент', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner />);

      expect(getSpinner()).toBeInTheDocument();
    });

    it('visible=true рендерит компонент', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner visible />);

      expect(getSpinner()).toBeInTheDocument();
    });

    it('visible=false возвращает null', () => {
      const { container, getSpinner } = renderIsolated(<LoadingSpinner visible={false} />);

      expect(getSpinner()).not.toBeInTheDocument();
      expect(container.querySelector('div[data-component="CoreLoadingSpinner"]')).toBeNull();
    });
  });

  describe('1.3. Варианты (variant)', () => {
    it('variant="spinner" (по умолчанию) рендерит spinner', () => {
      const { getSpinner, getSpinnerElement } = renderIsolated(
        <LoadingSpinner variant='spinner' />,
      );

      const spinner = getSpinner();
      expect(spinner).toHaveAttribute('data-variant', 'spinner');
      expect(getSpinnerElement()).toBeInTheDocument();
    });

    it('variant="dots" рендерит dots контейнер с тремя точками', () => {
      const { getSpinner, getDotsContainer, getDots } = renderIsolated(
        <LoadingSpinner variant='dots' />,
      );

      const spinner = getSpinner();
      expect(spinner).toHaveAttribute('data-variant', 'dots');

      const dotsContainer = getDotsContainer();
      expect(dotsContainer).toBeInTheDocument();

      const dots = getDots();
      expect(dots).toHaveLength(3);
    });

    it('variant="pulse" рендерит pulse элемент', () => {
      const { getSpinner, getSpinnerElement } = renderIsolated(<LoadingSpinner variant='pulse' />);

      const spinner = getSpinner();
      expect(spinner).toHaveAttribute('data-variant', 'pulse');
      expect(getSpinnerElement()).toBeInTheDocument();
    });
  });

  describe('1.4. Размеры (size)', () => {
    it('по умолчанию size="md" (24px)', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '24px',
        height: '24px',
      });
    });

    it('size="sm" устанавливает 16px', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner size='sm' />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '16px',
        height: '16px',
      });
    });

    it('size="md" устанавливает 24px', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner size='md' />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '24px',
        height: '24px',
      });
    });

    it('size="lg" устанавливает 32px', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner size='lg' />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '32px',
        height: '32px',
      });
    });

    it('size как число устанавливает кастомный размер', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner size={40} />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '40px',
        height: '40px',
      });
    });

    it('size как невалидная строка использует DEFAULT_SIZE fallback', () => {
      // Тестируем fallback для случая, когда size не является 'sm'/'md'/'lg' и не число
      const { getSpinnerElement } = renderIsolated(
        <LoadingSpinner size={'invalid' as any} />,
      );

      const spinnerElement = getSpinnerElement();
      // Должен использоваться DEFAULT_SIZE = 'md' = 24px
      expect(spinnerElement).toHaveStyle({
        width: '24px',
        height: '24px',
      });
    });

    it('size работает для dots варианта', () => {
      const { getDots } = renderIsolated(<LoadingSpinner variant='dots' size='lg' />);

      const dots = getDots();
      expect(dots).toHaveLength(3);
      // Для lg (32px) размер точки = max(4, 32/4) = 8px
      expect(dots[0]).toHaveStyle({
        width: '8px',
        height: '8px',
      });
    });

    it('size работает для pulse варианта', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner variant='pulse' size={50} />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '50px',
        height: '50px',
      });
    });
  });

  describe('1.5. Цвет (color)', () => {
    it('по умолчанию color="var(--spinner-color, #007bff)"', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        borderTopColor: 'var(--spinner-color, #007bff)',
        borderRightColor: 'var(--spinner-color, #007bff)',
      });
    });

    it('color пробрасывается для spinner варианта', () => {
      const { getSpinnerElement } = renderIsolated(
        <LoadingSpinner variant='spinner' color='red' />,
      );

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement.style.borderTopColor).toBe('red');
      expect(spinnerElement.style.borderRightColor).toBe('red');
    });

    it('color пробрасывается для dots варианта', () => {
      const { getDots } = renderIsolated(<LoadingSpinner variant='dots' color='blue' />);

      const dots = getDots();
      expect(dots[0]).toBeDefined();
      if (dots[0]) {
        expect((dots[0] as HTMLElement).style.backgroundColor).toBe('blue');
      }
    });

    it('color пробрасывается для pulse варианта', () => {
      const { getSpinnerElement } = renderIsolated(
        <LoadingSpinner variant='pulse' color='green' />,
      );

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement.style.backgroundColor).toBe('green');
    });
  });

  describe('1.6. Accessibility (ARIA)', () => {
    it('по умолчанию aria-label="Загрузка"', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner />);

      const spinner = getSpinner();
      expect(spinner).toHaveAttribute('aria-label', 'Загрузка');
      expect(spinner).toHaveAttribute('aria-busy', 'true');
      expect(spinner).toHaveAttribute('role', 'status');
    });

    it('кастомный aria-label пробрасывается', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner aria-label='Custom loading' />);

      const spinner = getSpinner();
      expect(spinner).toHaveAttribute('aria-label', 'Custom loading');
    });

    it('aria-label работает для всех вариантов', () => {
      const { getSpinner: getSpinner1 } = renderIsolated(
        <LoadingSpinner variant='spinner' aria-label='Spinner loading' />,
      );
      expect(getSpinner1()).toHaveAttribute('aria-label', 'Spinner loading');

      const { getSpinner: getSpinner2 } = renderIsolated(
        <LoadingSpinner variant='dots' aria-label='Dots loading' />,
      );
      expect(getSpinner2()).toHaveAttribute('aria-label', 'Dots loading');

      const { getSpinner: getSpinner3 } = renderIsolated(
        <LoadingSpinner variant='pulse' aria-label='Pulse loading' />,
      );
      expect(getSpinner3()).toHaveAttribute('aria-label', 'Pulse loading');
    });
  });

  describe('1.7. Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLDivElement>();

      const { getSpinner } = renderIsolated(<LoadingSpinner ref={ref} />);

      const spinner = getSpinner();
      expect(ref.current).toBe(spinner);
    });

    it('ref возвращает HTMLDivElement', () => {
      const ref = React.createRef<HTMLDivElement>();

      renderIsolated(<LoadingSpinner ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.tagName).toBe('DIV');
    });

    it('ref работает для всех вариантов', () => {
      const ref1 = React.createRef<HTMLDivElement>();
      renderIsolated(<LoadingSpinner variant='spinner' ref={ref1} />);
      expect(ref1.current).toBeInstanceOf(HTMLDivElement);

      const ref2 = React.createRef<HTMLDivElement>();
      renderIsolated(<LoadingSpinner variant='dots' ref={ref2} />);
      expect(ref2.current).toBeInstanceOf(HTMLDivElement);

      const ref3 = React.createRef<HTMLDivElement>();
      renderIsolated(<LoadingSpinner variant='pulse' ref={ref3} />);
      expect(ref3.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('1.8. HTML атрибуты пробрасываются', () => {
    it('стандартные HTML атрибуты пробрасываются корректно', () => {
      const { getSpinner } = renderIsolated(
        <LoadingSpinner
          id='test-id'
          className='test-class'
          title='Test title'
          data-testid='test-spinner'
        />,
      );

      const spinner = getSpinner();
      expect(spinner).toHaveAttribute('id', 'test-id');
      expect(spinner).toHaveAttribute('class', 'test-class');
      expect(spinner).toHaveAttribute('title', 'Test title');
      expect(spinner).toHaveAttribute('data-testid', 'test-spinner');
    });

    it('style пробрасывается и объединяется с базовыми стилями', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner style={customStyle} />);

      const spinner = getSpinner();
      expect(spinner).toHaveStyle({
        display: 'inline-flex',
        margin: '10px',
        padding: '5px',
      });
    });
  });

  describe('1.9. Стили для разных вариантов', () => {
    it('spinner вариант имеет правильные стили границы', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner variant='spinner' size={24} />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement.style.borderStyle).toBe('solid');
      // borderColor не устанавливается напрямую, используются borderTopColor и borderRightColor
      expect(spinnerElement.style.borderTopColor).toBeTruthy();
      expect(spinnerElement.style.borderRightColor).toBeTruthy();
      expect(spinnerElement.style.borderRadius).toBe('50%');
      // Для 24px: borderWidth = max(2, 24/8) = 3px
      expect(spinnerElement.style.borderWidth).toBe('3px');
    });

    it('spinner вариант с маленьким размером имеет минимальную ширину границы 2px', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner variant='spinner' size={8} />);

      const spinnerElement = getSpinnerElement();
      // Для 8px: borderWidth = max(2, 8/8) = max(2, 1) = 2px
      expect(spinnerElement).toHaveStyle({
        borderWidth: '2px',
      });
    });

    it('dots вариант имеет правильные стили контейнера', () => {
      const { getDotsContainer } = renderIsolated(<LoadingSpinner variant='dots' />);

      const dotsContainer = getDotsContainer();
      expect(dotsContainer).toHaveStyle({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      });
    });

    it('dots вариант имеет правильные стили точек', () => {
      const { getDots } = renderIsolated(<LoadingSpinner variant='dots' size={24} />);

      const dots = getDots();
      expect(dots).toHaveLength(3);

      // Для 24px: dotSize = max(4, 24/4) = 6px
      dots.forEach((dot) => {
        expect(dot).toHaveStyle({
          borderRadius: '50%',
          width: '6px',
          height: '6px',
        });
      });
    });

    it('dots вариант имеет правильные задержки анимации', () => {
      const { getDots } = renderIsolated(<LoadingSpinner variant='dots' />);

      const dots = getDots();
      expect(dots[0]).toHaveStyle({
        animationDelay: '0s',
      });
      expect(dots[1]).toHaveStyle({
        animationDelay: '0.2s',
      });
      expect(dots[2]).toHaveStyle({
        animationDelay: '0.4s',
      });
    });

    it('dots вариант с маленьким размером имеет минимальный размер точки 4px', () => {
      const { getDots } = renderIsolated(<LoadingSpinner variant='dots' size={8} />);

      const dots = getDots();
      // Для 8px: dotSize = max(4, 8/4) = max(4, 2) = 4px
      expect(dots[0]).toHaveStyle({
        width: '4px',
        height: '4px',
      });
    });

    it('pulse вариант имеет правильные стили', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner variant='pulse' size={24} />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        borderRadius: '50%',
        opacity: '0.6',
      });
    });
  });

  describe('1.10. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const { container, rerender } = renderIsolated(
        <LoadingSpinner variant='spinner' size={20} color='blue' />,
      );

      const firstRender = container.innerHTML;

      rerender(<LoadingSpinner variant='spinner' size={20} color='blue' />);

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      let renderCount = 0;

      const TestComponent = React.memo(() => {
        renderCount++;
        return <LoadingSpinner variant='spinner' />;
      });

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);

      expect(renderCount).toBe(1);
    });
  });

  describe('1.11. Edge cases', () => {
    it('работает с отсутствующими пропсами', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner />);

      const spinner = getSpinner();
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('data-variant', 'spinner');
      expect(spinner).toHaveAttribute('aria-label', 'Загрузка');
    });

    it('работает с пустой строкой aria-label', () => {
      const { getSpinner } = renderIsolated(<LoadingSpinner aria-label='' />);

      const spinner = getSpinner();
      expect(spinner).toHaveAttribute('aria-label', '');
    });

    it('размер 0 работает корректно', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner size={0} />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '0px',
        height: '0px',
      });
    });

    it('очень маленький размер для spinner (borderWidth минимум 2px)', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner variant='spinner' size={4} />);

      const spinnerElement = getSpinnerElement();
      // Для 4px: borderWidth = max(2, 4/8) = max(2, 0.5) = 2px
      expect(spinnerElement).toHaveStyle({
        borderWidth: '2px',
      });
    });

    it('очень маленький размер для dots (dotSize минимум 4px)', () => {
      const { getDots } = renderIsolated(<LoadingSpinner variant='dots' size={4} />);

      const dots = getDots();
      // Для 4px: dotSize = max(4, 4/4) = max(4, 1) = 4px
      expect(dots[0]).toHaveStyle({
        width: '4px',
        height: '4px',
      });
    });

    it('большой размер работает корректно', () => {
      const { getSpinnerElement } = renderIsolated(<LoadingSpinner size={100} />);

      const spinnerElement = getSpinnerElement();
      expect(spinnerElement).toHaveStyle({
        width: '100px',
        height: '100px',
      });
    });

    it('комбинация всех пропсов работает', () => {
      const { getSpinner } = renderIsolated(
        <LoadingSpinner
          variant='dots'
          size={30}
          color='purple'
          aria-label='Loading data'
          className='custom-class'
          id='spinner-id'
          data-testid='custom-testid'
        />,
      );

      const spinner = getSpinner();
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('data-variant', 'dots');
      expect(spinner).toHaveAttribute('aria-label', 'Loading data');
      expect(spinner).toHaveAttribute('class', 'custom-class');
      expect(spinner).toHaveAttribute('id', 'spinner-id');
      expect(spinner).toHaveAttribute('data-testid', 'custom-testid');
    });
  });

  describe('1.12. Комбинации вариантов и размеров', () => {
    it('spinner с разными размерами', () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      const expectedPixels = [16, 24, 32];

      sizes.forEach((size, index) => {
        const { getSpinnerElement } = renderIsolated(
          <LoadingSpinner variant='spinner' size={size} />,
        );
        expect(getSpinnerElement()).toHaveStyle({
          width: `${expectedPixels[index]}px`,
          height: `${expectedPixels[index]}px`,
        });
      });
    });

    it('dots с разными размерами', () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      // Для sm (16px): dotSize = max(4, 16/4) = 4px
      // Для md (24px): dotSize = max(4, 24/4) = 6px
      // Для lg (32px): dotSize = max(4, 32/4) = 8px
      const expectedDotSizes = [4, 6, 8];

      sizes.forEach((size, index) => {
        const { getDots } = renderIsolated(<LoadingSpinner variant='dots' size={size} />);
        expect(getDots()[0]).toHaveStyle({
          width: `${expectedDotSizes[index]}px`,
          height: `${expectedDotSizes[index]}px`,
        });
      });
    });

    it('pulse с разными размерами', () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      const expectedPixels = [16, 24, 32];

      sizes.forEach((size, index) => {
        const { getSpinnerElement } = renderIsolated(
          <LoadingSpinner variant='pulse' size={size} />,
        );
        expect(getSpinnerElement()).toHaveStyle({
          width: `${expectedPixels[index]}px`,
          height: `${expectedPixels[index]}px`,
        });
      });
    });
  });
});
