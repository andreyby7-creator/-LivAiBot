/**
 * @file packages/ui-core/src/primitives/divider.tsx
 * ============================================================================
 * 🔵 CORE UI DIVIDER — BEHAVIORAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-примитив для отображения Divider (разделитель)
 * - Детерминированный, предсказуемый и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - продуктовых решений
 * Пример использования:
 * <Divider orientation="horizontal" />
 * <Divider orientation="vertical" thickness={2} color="red" length="50px" />
 */

import type { CSSProperties, HTMLAttributes, JSX } from 'react';
import { forwardRef, memo, useMemo } from 'react';

import type { UISize } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type DividerOrientation = 'horizontal' | 'vertical';

export type CoreDividerProps = Readonly<
  Omit<HTMLAttributes<HTMLHRElement | HTMLDivElement>, 'children'> & {
    /** Ориентация разделителя */
    orientation?: DividerOrientation;

    /** Толщина линии в px */
    thickness?: number | string;

    /** Цвет линии */
    color?: string;

    /** Длина divider (для горизонтального: width, для вертикального: height) */
    length?: UISize;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

const BASE_STYLE: CSSProperties = {
  display: 'block',
  flexShrink: 0,
};

/* ============================================================================
 * 🎯 CORE DIVIDER
 * ========================================================================== */

const CoreDividerComponent = forwardRef<HTMLElement, CoreDividerProps>(
  function CoreDividerComponent(props, ref): JSX.Element {
    const {
      orientation = 'horizontal',
      thickness = 1,
      color = 'var(--divider-color, #E5E7EB)',
      length = '100%',
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const orientationStyle = useMemo<CSSProperties>(() => (
      orientation === 'horizontal'
        ? {
          width: length,
          height: typeof thickness === 'number' ? `${thickness}px` : thickness,
          backgroundColor: color,
        }
        : {
          width: typeof thickness === 'number' ? `${thickness}px` : thickness,
          height: length,
          backgroundColor: color,
        }
    ), [orientation, thickness, color, length]);

    const combinedStyle: CSSProperties = useMemo(() => ({
      ...BASE_STYLE,
      ...orientationStyle,
      ...style,
    }), [orientationStyle, style]);

    const callbackRef = (element: HTMLHRElement | HTMLDivElement | null): void => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(element);
        } else {
          ref.current = element;
        }
      }
    };

    if (orientation === 'horizontal') {
      return (
        <hr
          ref={callbackRef}
          aria-orientation={orientation}
          data-component='CoreDivider'
          data-testid={testId}
          className={className}
          style={combinedStyle}
          {...rest}
        />
      );
    } else {
      return (
        <div
          ref={callbackRef}
          role='separator'
          aria-orientation={orientation}
          data-component='CoreDivider'
          data-testid={testId}
          className={className}
          style={combinedStyle}
          {...rest}
        />
      );
    }
  },
);

/**
 * Memoized CoreDivider.
 * Гарантии:
 * - Никаких side-effects
 * - Полная детерминированность
 * - Совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 */
export const Divider = memo(CoreDividerComponent);
