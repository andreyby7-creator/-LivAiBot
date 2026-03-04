/**
 * @file packages/ui-core/src/components/Skeleton.tsx
 * ============================================================================
 * 🔵 CORE UI SKELETON — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения Skeleton (заглушка загрузки)
 * - Используется как placeholder для контента в состоянии loading
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - автоматического управления состояниями
 * Управление:
 * - Видимостью и параметрами управляет App-слой
 */

import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX } from 'react';

import type { UISize } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type SkeletonVariant = 'text' | 'rect' | 'circle';

const BORDER_RADIUS_TEXT = 4;
const BORDER_RADIUS_RECT = 6;
const DEFAULT_SHIMMER_DURATION = '1.4s';

export type CoreSkeletonProps = Readonly<
  /**
   * Skeleton не принимает children.
   * Это строго визуальная заглушка.
   */
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** Видимость Skeleton */
    visible?: boolean;

    /** Вариант формы Skeleton */
    variant?: SkeletonVariant;

    /** Ширина Skeleton (CSS размер) */
    width?: UISize;

    /** Высота Skeleton (CSS размер) */
    height?: UISize;

    /** Радиус скругления (переопределяет variant) */
    radius?: string | number;

    /** Включить shimmer-анимацию */
    animated?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

const BASE_STYLE: CSSProperties = {
  display: 'block',
  position: 'relative',
  overflow: 'hidden',
  boxSizing: 'border-box',
  backgroundColor: 'var(--skeleton-bg, #E5E7EB)',
};

/**
 * Стили shimmer-анимации.
 * Без side-effects: анимация задаётся исключительно через inline style.
 */
const SHIMMER_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(90deg, var(--skeleton-bg, #E5E7EB) 25%, var(--skeleton-shimmer, #F3F4F6) 37%, var(--skeleton-bg, #E5E7EB) 63%)',
  backgroundSize: '400% 100%',
  animation: `skeleton-shimmer ${DEFAULT_SHIMMER_DURATION} ease infinite`,
};

/* ============================================================================
 * 🎯 CORE SKELETON
 * ========================================================================== */

const CoreSkeletonComponent = forwardRef<HTMLDivElement, CoreSkeletonProps>(
  function CoreSkeletonComponent(props, ref): JSX.Element | null {
    const {
      visible = true,
      variant = 'rect',
      width = '100%',
      height = '1em',
      radius,
      animated = true,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const borderRadius = useMemo((): CSSProperties['borderRadius'] => {
      if (radius != null) return radius;

      switch (variant) {
        case 'circle':
          return '50%';
        case 'text':
          return BORDER_RADIUS_TEXT;
        case 'rect':
        default:
          return BORDER_RADIUS_RECT;
      }
    }, [variant, radius]);

    const combinedStyle: CSSProperties = useMemo(
      () => ({
        ...BASE_STYLE,
        width,
        height,
        borderRadius,
        ...(animated ? SHIMMER_STYLE : null),
        ...style,
      }),
      [width, height, borderRadius, animated, style],
    );

    if (!visible) return null;

    return (
      <div
        ref={ref}
        // Skeleton — чисто декоративный элемент, не входит в дерево доступности
        role='presentation'
        aria-hidden='true'
        data-component='CoreSkeleton'
        data-variant={variant}
        data-testid={testId}
        className={className}
        style={combinedStyle}
        {...rest}
      />
    );
  },
);

/**
 * Memoized CoreSkeleton.
 * Гарантии:
 * - Никаких side-effects
 * - Полная детерминированность
 * - Совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 * - Подходит как атом design-system
 */
export const Skeleton = memo(CoreSkeletonComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * Skeleton реализован как чистый presentational primitive:
 * - Нет таймеров
 * - Нет lifecycle эффектов
 * - Нет knowledge о загрузке данных
 * Любая логика:
 * - когда показывать
 * - сколько Skeleton рендерить
 * - в каких состояниях
 * всегда должна жить в App-слое.
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
