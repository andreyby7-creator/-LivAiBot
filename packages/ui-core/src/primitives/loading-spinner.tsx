/**
 * @file packages/ui-core/src/primitives/loading-spinner.tsx
 * ============================================================================
 * 🔵 CORE UI LOADING SPINNER — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для отображения индикатора загрузки
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием загрузки
 * - Таймеров или бизнес-логики
 *
 * Управление:
 * - Видимостью и параметрами управляет App-слой
 */

import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX, Ref } from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Вариант отображения спиннера */
export type LoadingSpinnerVariant = 'spinner' | 'dots' | 'pulse';

/** Размер спиннера (предустановленные значения или кастомный размер) */
export type LoadingSpinnerSize = 'sm' | 'md' | 'lg' | number;

/** Стиль точки для dots варианта */
type DotStyle = Readonly<{
  key: string;
  style: CSSProperties;
}>;

const DEFAULT_SIZE = 'md';
const DEFAULT_VARIANT: LoadingSpinnerVariant = 'spinner';
const DEFAULT_COLOR = 'var(--spinner-color, #007bff)';

/** Размеры для предустановленных вариантов */
const SIZE_MAP: Readonly<Record<'sm' | 'md' | 'lg', number>> = {
  sm: 16,
  md: 24,
  lg: 32,
};

/** Коэффициент для вычисления ширины границы спиннера */
const BORDER_WIDTH_DIVISOR = 8;

/** Коэффициент для вычисления размера точек */
const DOT_SIZE_DIVISOR = 4;

/** Минимальный размер точки */
const MIN_DOT_SIZE = 4;

/** Задержка анимации между точками (в секундах) */
const DOT_ANIMATION_DELAY = 0.2;

/** Прозрачность для pulse варианта */
const PULSE_OPACITY = 0.6;

export type CoreLoadingSpinnerProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** Видимость спиннера */
    visible?: boolean;

    /** Вариант отображения */
    variant?: LoadingSpinnerVariant;

    /** Размер спиннера */
    size?: LoadingSpinnerSize;

    /** Цвет спиннера */
    color?: string;

    /** Accessibility: текстовое описание для screen readers */
    'aria-label'?: string;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const SPINNER_CONTAINER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
};

const SPINNER_BASE_STYLE: CSSProperties = {
  display: 'inline-block',
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: '50%',
  animation: 'spinner-rotate 0.8s linear infinite',
};

const DOTS_CONTAINER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
};

const DOT_STYLE: CSSProperties = {
  display: 'inline-block',
  borderRadius: '50%',
  animation: 'spinner-pulse 1.4s ease-in-out infinite',
};

const PULSE_STYLE: CSSProperties = {
  display: 'inline-block',
  borderRadius: '50%',
  animation: 'spinner-pulse-scale 1.2s ease-in-out infinite',
};

/* ============================================================================
 * 🎯 CORE LOADING SPINNER
 * ========================================================================== */

const CoreLoadingSpinnerComponent = forwardRef<HTMLDivElement, CoreLoadingSpinnerProps>(
  function CoreLoadingSpinnerComponent(
    props,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const {
      visible = true,
      variant = DEFAULT_VARIANT,
      size = DEFAULT_SIZE,
      color = DEFAULT_COLOR,
      'aria-label': ariaLabel,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    /** Вычисляем размер в пикселях */
    const sizePx = useMemo((): number => {
      if (size === 'sm' || size === 'md' || size === 'lg') {
        return SIZE_MAP[size];
      }
      if (typeof size === 'number') {
        return size;
      }
      return SIZE_MAP[DEFAULT_SIZE];
    }, [size]);

    /**
     * Стили для spinner варианта.
     * Минимальная ширина границы: 2px (для очень маленьких размеров < 16px).
     */
    const spinnerStyle: CSSProperties = useMemo(() => {
      const borderWidth = Math.max(2, Math.floor(sizePx / BORDER_WIDTH_DIVISOR));
      return {
        ...SPINNER_BASE_STYLE,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        borderWidth: `${borderWidth}px`,
        borderTopColor: color,
        borderRightColor: color,
      };
    }, [sizePx, color]);

    /** Стили для dots варианта */
    const dotsStyle: CSSProperties = useMemo(() => {
      const dotSize = Math.max(MIN_DOT_SIZE, Math.floor(sizePx / DOT_SIZE_DIVISOR));
      return {
        width: `${dotSize}px`,
        height: `${dotSize}px`,
        backgroundColor: color,
      };
    }, [sizePx, color]);

    /** Стили для pulse варианта */
    const pulseStyle: CSSProperties = useMemo(() => {
      return {
        ...PULSE_STYLE,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        backgroundColor: color,
        opacity: PULSE_OPACITY,
      };
    }, [sizePx, color]);

    /** Контейнер стили (базовые стили + кастомные из props) */
    const containerStyle: CSSProperties = useMemo(() => ({
      ...SPINNER_CONTAINER_STYLE,
      ...style,
    }), [style]);

    /** Стили для dots контейнера (только базовые стили, без наследования containerStyle) */
    const dotsContainerStyle: CSSProperties = useMemo(() => ({
      ...DOTS_CONTAINER_STYLE,
    }), []);

    /** Стили для точек с задержкой анимации */
    const dotStyles: readonly DotStyle[] = useMemo(() => {
      return [0, 1, 2].map((index) => ({
        key: `dot-${index}`,
        style: {
          ...DOT_STYLE,
          ...dotsStyle,
          animationDelay: `${index * DOT_ANIMATION_DELAY}s`,
        },
      }));
    }, [dotsStyle]);

    /**
     * Видимость полностью контролируется App-слоем.
     * Core primitive не управляет состоянием visible.
     */
    if (!visible) return null;

    /** Рендерим spinner вариант */
    if (variant === 'spinner') {
      return (
        <div
          ref={ref}
          role='status'
          aria-label={ariaLabel ?? 'Загрузка'}
          aria-busy='true'
          data-component='CoreLoadingSpinner'
          data-variant={variant}
          data-testid={testId}
          className={className}
          style={containerStyle}
          {...rest}
        >
          <span style={spinnerStyle} />
        </div>
      );
    }

    /** Рендерим dots вариант */
    if (variant === 'dots') {
      return (
        <div
          ref={ref}
          role='status'
          aria-label={ariaLabel ?? 'Загрузка'}
          aria-busy='true'
          data-component='CoreLoadingSpinner'
          data-variant={variant}
          data-testid={testId}
          className={className}
          style={containerStyle}
          {...rest}
        >
          <div
            data-element='dots-container'
            style={dotsContainerStyle}
          >
            {dotStyles.map((dot) => (
              <span
                key={dot.key}
                style={dot.style}
              />
            ))}
          </div>
        </div>
      );
    }

    /** Рендерим pulse вариант */
    return (
      <div
        ref={ref}
        role='status'
        aria-label={ariaLabel ?? 'Загрузка'}
        aria-busy='true'
        data-component='CoreLoadingSpinner'
        data-variant={variant}
        data-testid={testId}
        className={className}
        style={containerStyle}
        {...rest}
      >
        <span style={pulseStyle} />
      </div>
    );
  },
);

// eslint-disable-next-line functional/immutable-data
CoreLoadingSpinnerComponent.displayName = 'CoreLoadingSpinner';

/**
 * Memoized CoreLoadingSpinner.
 *
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как building-block для App-слоя
 *
 * @note CSS анимации должны быть определены в глобальных стилях приложения.
 * Для ui-core библиотеки необходимо подключить CSS с keyframes:
 * ```css
 * @keyframes spinner-rotate {
 *   from { transform: rotate(0deg); }
 *   to { transform: rotate(360deg); }
 * }
 *
 * @keyframes spinner-pulse {
 *   0%, 100% { opacity: 1; }
 *   50% { opacity: 0.3; }
 * }
 *
 * @keyframes spinner-pulse-scale {
 *   0%, 100% { transform: scale(1); opacity: 0.6; }
 *   50% { transform: scale(1.1); opacity: 1; }
 * }
 * ```
 *
 * @note App-слой может добавлять BEM-модификаторы через className для кастомизации стилей.
 */
export const LoadingSpinner = memo(CoreLoadingSpinnerComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreLoadingSpinner — чистый presentational primitive:
 *
 * - Не управляет состоянием загрузки
 * - Не содержит feature flags или telemetry
 * - Все параметры передаются через props
 * - Поддерживает ref forwarding
 *
 * Любая бизнес-логика (когда показывать, telemetry, feature flags)
 * реализуется в App слое.
 *
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
