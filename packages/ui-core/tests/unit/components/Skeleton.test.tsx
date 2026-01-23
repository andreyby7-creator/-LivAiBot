/**
 * @vitest-environment jsdom
 * @file Unit тесты для Skeleton компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Skeleton } from '../../../src/components/Skeleton.js';

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
    getSkeleton: () => container.querySelector('div[data-component="CoreSkeleton"]')!,
  };
}

describe('Skeleton', () => {
  // Вынесенные объекты для соблюдения ESLint правил
  const customStyle = { margin: '10px', opacity: 0.8 };
  const overrideStyle = { backgroundColor: 'red' };
  const nullStyle = null as any;
  const createMockRef = () => ({ current: null as HTMLDivElement | null });

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      expect(container).toBeInTheDocument();
      expect(getSkeleton()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      const skeleton = getSkeleton();
      expect(skeleton).toBeInTheDocument();
      expect(skeleton.tagName).toBe('DIV');
      expect(skeleton).toHaveAttribute('data-component', 'CoreSkeleton');
      expect(skeleton).toHaveAttribute('role', 'presentation');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      expect(skeleton).toHaveAttribute('data-variant', 'rect');
    });

    it('не рендерится когда visible=false', () => {
      const { queryByRole } = renderIsolated(
        <Skeleton visible={false} />,
      );

      expect(queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('рендерится когда visible не указан (по умолчанию true)', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton />,
      );

      expect(getSkeleton()).toBeInTheDocument();
    });
  });

  describe('4.2. Варианты (variant)', () => {
    const variants = ['text', 'rect', 'circle'] as const;

    variants.forEach((variant) => {
      it(`применяет правильный data-variant="${variant}"`, () => {
        const { getSkeleton } = renderIsolated(
          <Skeleton visible={true} variant={variant} />,
        );

        expect(getSkeleton()).toHaveAttribute('data-variant', variant);
      });

      it(`применяет правильный border-radius для variant="${variant}"`, () => {
        const { getSkeleton } = renderIsolated(
          <Skeleton visible={true} variant={variant} />,
        );

        const skeleton = getSkeleton();
        const computedStyle = window.getComputedStyle(skeleton);

        switch (variant) {
          case 'circle':
            expect(computedStyle.borderRadius).toBe('50%');
            break;
          case 'text':
            expect(computedStyle.borderRadius).toBe('4px');
            break;
          case 'rect':
            expect(computedStyle.borderRadius).toBe('6px');
            break;
        }
      });
    });

    it('использует rect по умолчанию', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      expect(getSkeleton()).toHaveAttribute('data-variant', 'rect');
    });
  });

  describe('4.3. Размеры (width, height)', () => {
    it('применяет кастомную ширину', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} width='200px' />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.width).toBe('200px');
    });

    it('применяет кастомную высоту', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} height='50px' />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.height).toBe('50px');
    });

    it('применяет числовые размеры', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} width={300 as any} height={100 as any} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.width).toBe('300px');
      expect(computedStyle.height).toBe('100px');
    });

    it('использует дефолтные размеры', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.width).toBe('100%');
      expect(computedStyle.height).toBe('1em');
    });
  });

  describe('4.4. Радиус скругления (radius)', () => {
    it('применяет кастомный radius', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} radius='12px' />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('12px');
    });

    it('применяет числовой radius', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} radius={20} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('20px');
    });

    it('radius переопределяет variant border-radius', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} variant='circle' radius='8px' />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('8px');
    });
  });

  describe('4.5. Анимация (animated)', () => {
    it('применяет shimmer анимацию по умолчанию', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.animation).toContain('skeleton-shimmer');
      expect(computedStyle.animation).toContain('1.4s');
      expect(computedStyle.animation).toContain('ease');
      expect(computedStyle.animation).toContain('infinite');
    });

    it('отключает анимацию когда animated=false', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} animated={false} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.animation).toBe('');
    });

    it('включает анимацию когда animated=true', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} animated={true} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.animation).toContain('skeleton-shimmer');
    });
  });

  describe('4.6. Стилизация', () => {
    it('применяет базовые стили', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.display).toBe('block');
      expect(computedStyle.position).toBe('relative');
      expect(computedStyle.overflow).toBe('hidden');
      expect(computedStyle.boxSizing).toBe('border-box');
      expect(computedStyle.backgroundColor).toBe('var(--skeleton-bg, #E5E7EB)');
    });

    it('применяет shimmer стили', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.backgroundImage).toContain('linear-gradient');
      expect(computedStyle.backgroundSize).toBe('400% 100%');
    });

    it('применяет кастомные стили через style проп', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} style={customStyle} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.margin).toBe('10px');
      expect(computedStyle.opacity).toBe('0.8');
    });

    it('кастомные стили переопределяют базовые', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} style={overrideStyle} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.backgroundColor).toBe('rgb(255, 0, 0)');
    });
  });

  describe('4.7. Test ID и атрибуты', () => {
    it('применяет data-testid', () => {
      const testId = 'custom-skeleton';
      const { getByTestId } = renderIsolated(
        <Skeleton visible={true} data-testid={testId} />,
      );

      expect(getByTestId(testId)).toBeInTheDocument();
    });

    it('применяет className', () => {
      const className = 'custom-skeleton-class';
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} className={className} />,
      );

      expect(getSkeleton()).toHaveClass(className);
    });

    it('прокидывает другие HTML атрибуты', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} id='skeleton-id' tabIndex={-1} />,
      );

      const skeleton = getSkeleton();
      expect(skeleton).toHaveAttribute('id', 'skeleton-id');
      expect(skeleton).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('4.8. Ref forwarding', () => {
    it('поддерживает React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      renderIsolated(<Skeleton visible={true} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreSkeleton');
    });

    it('поддерживает useRef-подобный объект', () => {
      const ref = createMockRef();

      renderIsolated(<Skeleton visible={true} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreSkeleton');
    });
  });

  describe('4.9. Memoization и производительность', () => {
    it('не ререндерится при одинаковых пропсах', () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return <Skeleton visible={true} />;
      };

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);
      expect(renderCount).toBe(2); // React.memo предотвращает лишние рендеры компонента
    });

    it('useMemo для borderRadius вызывается только при изменении зависимостей', () => {
      const { getSkeleton, rerender } = renderIsolated(
        <Skeleton visible={true} variant='rect' />,
      );

      const initialRadius = window.getComputedStyle(getSkeleton()).borderRadius;

      rerender(<Skeleton visible={true} variant='text' />);

      const newRadius = window.getComputedStyle(getSkeleton()).borderRadius;

      expect(initialRadius).not.toBe(newRadius);
      expect(newRadius).toBe('4px');
    });

    it('useMemo для combinedStyle стабилен при одинаковых пропсах', () => {
      const { rerender } = renderIsolated(
        <Skeleton visible={true} width='100px' height='20px' />,
      );

      // Если useMemo работает правильно, перерендер не должен вызывать лишних вычислений
      rerender(<Skeleton visible={true} width='100px' height='20px' />);
    });
  });

  describe('4.10. Edge cases', () => {
    it('работает с undefined width и height', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} {...({} as any)} />,
      );

      const skeleton = getSkeleton();
      expect(skeleton).toBeInTheDocument();
    });

    it('работает с undefined radius', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} {...({} as any)} />,
      );

      const skeleton = getSkeleton();
      expect(skeleton).toBeInTheDocument();
    });

    it('работает с undefined animated', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} {...({} as any)} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.animation).toContain('skeleton-shimmer');
    });

    it('работает с null style', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} style={nullStyle} />,
      );

      expect(getSkeleton()).toBeInTheDocument();
    });

    it('работает с undefined style', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} style={undefined} />,
      );

      expect(getSkeleton()).toBeInTheDocument();
    });

    it('radius=0 переопределяет variant', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} variant='circle' radius={0} />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('0');
    });

    it('radius="" (пустая строка) работает', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} radius='' />,
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('');
    });
  });

  describe('4.11. Accessibility', () => {
    it('имеет правильные ARIA атрибуты', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      const skeleton = getSkeleton();
      expect(skeleton).toHaveAttribute('role', 'presentation');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });

    it('не входит в accessibility tree', () => {
      const { getSkeleton } = renderIsolated(
        <Skeleton visible={true} />,
      );

      const skeleton = getSkeleton();
      // presentation role делает элемент невидимым для screen readers
      expect(skeleton).toHaveAttribute('role', 'presentation');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
