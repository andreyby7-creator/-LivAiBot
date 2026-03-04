/**
 * @file packages/ui-core/src/primitives/badge.tsx
 * ============================================================================
 * 🔵 CORE UI BADGE — BEHAVIORAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-примитив для отображения Badge (метка, статус, счётчик)
 * - Детерминированный, предсказуемый и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - продуктовых решений
 */

import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX } from 'react';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'small' | 'medium' | 'large';

const BADGE_SIZES: Record<BadgeSize, number> = {
  small: 16,
  medium: 20,
  large: 24,
};

const BADGE_FONT_SIZES: Record<BadgeSize, number> = {
  small: 10,
  medium: 12,
  large: 14,
};

const BADGE_PADDING_X: Record<BadgeSize, number> = {
  small: 6,
  medium: 8,
  large: 10,
};

const DEFAULT_BG_COLORS: Record<BadgeVariant, string> = {
  default: 'var(--badge-bg-default, #E5E7EB)',
  success: 'var(--badge-bg-success, #22C55E)',
  warning: 'var(--badge-bg-warning, #F59E0B)',
  error: 'var(--badge-bg-error, #EF4444)',
  info: 'var(--badge-bg-info, #3B82F6)',
};

const DEFAULT_TEXT_COLORS: Record<BadgeVariant, string> = {
  default: 'var(--badge-text-default, #111827)',
  success: 'var(--badge-text-success, white)',
  warning: 'var(--badge-text-warning, white)',
  error: 'var(--badge-text-error, white)',
  info: 'var(--badge-text-info, white)',
};

export type CoreBadgeProps = Readonly<
  Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
    /** Текст или число, отображаемые в бейдже */
    value: string | number | null;

    /** Размер Badge */
    size?: BadgeSize;

    /** Визуальный вариант (семантика цвета) */
    variant?: BadgeVariant;

    /** Кастомный цвет фона */
    bgColor?: string;

    /** Кастомный цвет текста */
    textColor?: string;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

/* ============================================================================
 * 🎯 CORE BADGE
 * ========================================================================== */

const CoreBadgeComponent = forwardRef<HTMLSpanElement, CoreBadgeProps>(
  function CoreBadgeComponent(props, ref): JSX.Element {
    const {
      value,
      size = 'medium',
      variant = 'default',
      bgColor,
      textColor,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const height = BADGE_SIZES[size];
    const fontSize = BADGE_FONT_SIZES[size];
    const paddingX = BADGE_PADDING_X[size];

    const resolvedBgColor = bgColor ?? DEFAULT_BG_COLORS[variant];
    const resolvedTextColor = textColor ?? DEFAULT_TEXT_COLORS[variant];

    const displayValue = value == null ? '' : String(value);

    const combinedStyle: CSSProperties = useMemo(
      () => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: `${height}px`,
        padding: `0 ${paddingX}px`,
        fontSize: `${fontSize}px`,
        fontWeight: 600,
        lineHeight: 1,
        borderRadius: '9999px',
        backgroundColor: resolvedBgColor,
        color: resolvedTextColor,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        boxSizing: 'border-box',
        ...style,
      }),
      [
        height,
        paddingX,
        fontSize,
        resolvedBgColor,
        resolvedTextColor,
        style,
      ],
    );

    return (
      <span
        ref={ref}
        role='img'
        aria-label={displayValue || 'Badge'}
        aria-hidden={displayValue === ''}
        data-component='CoreBadge'
        data-testid={testId}
        className={className}
        style={combinedStyle}
        {...rest}
      >
        {displayValue}
      </span>
    );
  },
);

/**
 * Memoized CoreBadge.
 * Гарантии:
 * - Никаких side-effects
 * - Полная детерминированность
 * - Совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 */
export const Badge = memo(CoreBadgeComponent);
