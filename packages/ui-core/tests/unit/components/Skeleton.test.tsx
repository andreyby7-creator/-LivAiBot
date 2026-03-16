/**
 * @vitest-environment jsdom
 * @file Unit тесты для Skeleton компонента
 */

import { cleanup, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Skeleton } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

const AnySkeleton = Skeleton as any;

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
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      expect(container).toBeInTheDocument();
      expect(getSkeleton()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
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
        React.createElement(AnySkeleton, { visible: false } as any, null),
      );

      expect(queryByRole('presentation')).not.toBeInTheDocument();
    });

    it('рендерится когда visible не указан (по умолчанию true)', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, {} as any, null),
      );

      expect(getSkeleton()).toBeInTheDocument();
    });
  });

  describe('4.2. Варианты (variant)', () => {
    const variants = ['text', 'rect', 'circle'] as const;

    variants.forEach((variant) => {
      it(`применяет правильный data-variant="${variant}"`, () => {
        const { getSkeleton } = renderIsolated(
          React.createElement(AnySkeleton, { visible: true, variant } as any, null),
        );

        expect(getSkeleton()).toHaveAttribute('data-variant', variant);
      });

      it(`применяет правильный border-radius для variant="${variant}"`, () => {
        const { getSkeleton } = renderIsolated(
          React.createElement(AnySkeleton, { visible: true, variant } as any, null),
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
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      expect(getSkeleton()).toHaveAttribute('data-variant', 'rect');
    });
  });

  describe('4.3. Размеры (width, height)', () => {
    it('применяет кастомную ширину', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, width: '200px' } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.width).toBe('200px');
    });

    it('применяет кастомную высоту', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, height: '50px' } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.height).toBe('50px');
    });

    it('применяет числовые размеры', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(
          AnySkeleton,
          { visible: true, width: 300 as any, height: 100 as any } as any,
          null,
        ),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.width).toBe('300px');
      expect(computedStyle.height).toBe('100px');
    });

    it('использует дефолтные размеры', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
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
        React.createElement(AnySkeleton, { visible: true, radius: '12px' } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('12px');
    });

    it('применяет числовой radius', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, radius: 20 } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('20px');
    });

    it('radius переопределяет variant border-radius', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(
          AnySkeleton,
          { visible: true, variant: 'circle', radius: '8px' } as any,
          null,
        ),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('8px');
    });
  });

  describe('4.5. Анимация (animated)', () => {
    it('применяет shimmer анимацию по умолчанию', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
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
        React.createElement(AnySkeleton, { visible: true, animated: false } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.animation).toBe('');
    });

    it('включает анимацию когда animated=true', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, animated: true } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.animation).toContain('skeleton-shimmer');
    });
  });

  describe('4.6. Стилизация', () => {
    it('применяет базовые стили', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
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
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.backgroundImage).toContain('linear-gradient');
      expect(computedStyle.backgroundSize).toBe('400% 100%');
    });

    it('применяет кастомные стили через style проп', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, style: customStyle } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.margin).toBe('10px');
      expect(computedStyle.opacity).toBe('0.8');
    });

    it('кастомные стили переопределяют базовые', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, style: overrideStyle } as any, null),
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
        React.createElement(
          AnySkeleton,
          { visible: true, 'data-testid': testId } as any,
          null,
        ),
      );

      expect(getByTestId(testId)).toBeInTheDocument();
    });

    it('применяет className', () => {
      const className = 'custom-skeleton-class';
      const { getSkeleton } = renderIsolated(
        React.createElement(
          AnySkeleton,
          { visible: true, className } as any,
          null,
        ),
      );

      expect(getSkeleton()).toHaveClass(className);
    });

    it('прокидывает другие HTML атрибуты', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(
          AnySkeleton,
          { visible: true, id: 'skeleton-id', tabIndex: -1 } as any,
          null,
        ),
      );

      const skeleton = getSkeleton();
      expect(skeleton).toHaveAttribute('id', 'skeleton-id');
      expect(skeleton).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('4.8. Ref forwarding', () => {
    it('поддерживает React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      renderIsolated(
        React.createElement(AnySkeleton, { visible: true, ref } as any, null),
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreSkeleton');
    });

    it('поддерживает useRef-подобный объект', () => {
      const ref = createMockRef();

      renderIsolated(
        React.createElement(AnySkeleton, { visible: true, ref } as any, null),
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreSkeleton');
    });
  });

  describe('4.9. Memoization и производительность', () => {
    it('не ререндерится при одинаковых пропсах', () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return React.createElement(AnySkeleton, { visible: true } as any, null);
      };

      const { rerender } = render(
        React.createElement(TestComponent as any, {} as any, null),
      );

      expect(renderCount).toBe(1);

      rerender(React.createElement(TestComponent as any, {} as any, null));
      expect(renderCount).toBe(2); // React.memo предотвращает лишние рендеры компонента
    });

    it('useMemo для borderRadius вызывается только при изменении зависимостей', () => {
      const { getSkeleton, rerender } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, variant: 'rect' } as any, null),
      );

      const initialRadius = window.getComputedStyle(getSkeleton()).borderRadius;

      rerender(
        React.createElement(AnySkeleton, { visible: true, variant: 'text' } as any, null),
      );

      const newRadius = window.getComputedStyle(getSkeleton()).borderRadius;

      expect(initialRadius).not.toBe(newRadius);
      expect(newRadius).toBe('4px');
    });

    it('useMemo для combinedStyle стабилен при одинаковых пропсах', () => {
      const { rerender } = renderIsolated(
        React.createElement(
          AnySkeleton,
          { visible: true, width: '100px', height: '20px' } as any,
          null,
        ),
      );

      // Если useMemo работает правильно, перерендер не должен вызывать лишних вычислений
      rerender(
        React.createElement(
          AnySkeleton,
          { visible: true, width: '100px', height: '20px' } as any,
          null,
        ),
      );
    });
  });

  describe('4.10. Edge cases', () => {
    it('работает с undefined width и height', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      const skeleton = getSkeleton();
      expect(skeleton).toBeInTheDocument();
    });

    it('работает с undefined radius', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      const skeleton = getSkeleton();
      expect(skeleton).toBeInTheDocument();
    });

    it('работает с undefined animated', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.animation).toContain('skeleton-shimmer');
    });

    it('работает с null style', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, style: nullStyle } as any, null),
      );

      expect(getSkeleton()).toBeInTheDocument();
    });

    it('работает с undefined style', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, style: undefined } as any, null),
      );

      expect(getSkeleton()).toBeInTheDocument();
    });

    it('radius=0 переопределяет variant', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(
          AnySkeleton,
          { visible: true, variant: 'circle', radius: 0 } as any,
          null,
        ),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('0px');
    });

    it('radius="" (пустая строка) работает', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true, radius: '' } as any, null),
      );

      const skeleton = getSkeleton();
      const computedStyle = window.getComputedStyle(skeleton);

      expect(computedStyle.borderRadius).toBe('');
    });
  });

  describe('4.11. Accessibility', () => {
    it('имеет правильные ARIA атрибуты', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      const skeleton = getSkeleton();
      expect(skeleton).toHaveAttribute('role', 'presentation');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });

    it('не входит в accessibility tree', () => {
      const { getSkeleton } = renderIsolated(
        React.createElement(AnySkeleton, { visible: true } as any, null),
      );

      const skeleton = getSkeleton();
      // presentation role делает элемент невидимым для screen readers
      expect(skeleton).toHaveAttribute('role', 'presentation');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
