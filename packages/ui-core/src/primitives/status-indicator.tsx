/**
 * @file packages/ui-core/src/primitives/status-indicator.tsx
 * ============================================================================
 * 🔵 CORE UI STATUS INDICATOR — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения статуса процесса
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием статуса
 * - Бизнес-логики определения статуса
 * Управление:
 * - Статусом и параметрами управляет App-слой
 */

import type { CSSProperties, HTMLAttributes, JSX } from 'react';
import { forwardRef, memo, useMemo } from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Статус процесса */
export type StatusIndicatorStatus = 'idle' | 'loading' | 'success' | 'error';

/** Вариант отображения индикатора */
export type StatusIndicatorVariant = 'dot' | 'icon' | 'text';

/** Размер индикатора */
export type StatusIndicatorSize = 'sm' | 'md' | 'lg';

const DEFAULT_STATUS: StatusIndicatorStatus = 'idle';
const DEFAULT_VARIANT: StatusIndicatorVariant = 'dot';
const DEFAULT_SIZE: StatusIndicatorSize = 'md';

/** Размеры для dot варианта */
const DOT_SIZES: Readonly<Record<StatusIndicatorSize, number>> = {
  sm: 8,
  md: 10,
  lg: 12,
};

/** Размеры шрифта для text варианта */
const TEXT_FONT_SIZES: Readonly<Record<StatusIndicatorSize, number>> = {
  sm: 11,
  md: 12,
  lg: 14,
};

/** Цвета для каждого статуса */
const STATUS_COLORS: Readonly<Record<StatusIndicatorStatus, string>> = {
  idle: 'var(--status-indicator-color-idle, #9CA3AF)',
  loading: 'var(--status-indicator-color-loading, #3B82F6)',
  success: 'var(--status-indicator-color-success, #22C55E)',
  error: 'var(--status-indicator-color-error, #EF4444)',
};

/** Текстовые метки для каждого статуса */
const STATUS_LABELS: Readonly<Record<StatusIndicatorStatus, string>> = {
  idle: 'Idle',
  loading: 'Loading',
  success: 'Success',
  error: 'Error',
};

/** Иконки для каждого статуса (Unicode символы) */
const STATUS_ICONS: Readonly<Record<StatusIndicatorStatus, string>> = {
  idle: '○',
  loading: '⟳',
  success: '✓',
  error: '✕',
};

export type CoreStatusIndicatorProps = Readonly<
  Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
    /** Статус процесса */
    status?: StatusIndicatorStatus;

    /** Вариант отображения */
    variant?: StatusIndicatorVariant;

    /** Размер индикатора */
    size?: StatusIndicatorSize;

    /** Кастомный цвет (переопределяет цвет статуса) */
    readonly color?: string;

    /** Кастомный текст (переопределяет текст статуса, только для variant='text') */
    readonly text?: string;

    /** Accessibility: текстовое описание для screen readers */
    'aria-label'?: string;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const CONTAINER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
};

const DOT_STYLE_BASE: CSSProperties = {
  display: 'inline-block',
  borderRadius: '50%',
  flexShrink: 0,
};

const TEXT_STYLE_BASE: CSSProperties = {
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

const ICON_STYLE_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  fontFamily: 'system-ui, sans-serif',
  flexShrink: 0,
};

/* ============================================================================
 * 🎯 CORE STATUS INDICATOR
 * ========================================================================== */

const CoreStatusIndicatorComponent = forwardRef<
  HTMLSpanElement,
  CoreStatusIndicatorProps
>(function CoreStatusIndicatorComponent(props, ref): JSX.Element {
  const {
    status = DEFAULT_STATUS,
    variant = DEFAULT_VARIANT,
    size = DEFAULT_SIZE,
    color,
    text,
    style,
    className,
    'aria-label': ariaLabel,
    'data-testid': testId,
    ...rest
  } = props;

  const dotSize = DOT_SIZES[size];
  const fontSize = TEXT_FONT_SIZES[size];

  /** Оптимизированные вычисления статуса */
  const statusColor = useMemo(
    () => color ?? STATUS_COLORS[status],
    [color, status],
  );

  /** Объединенные вычисления label и icon для компактности */
  const statusData = useMemo(
    () => ({
      label: text ?? STATUS_LABELS[status],
      icon: STATUS_ICONS[status],
    }),
    [text, status],
  );

  const statusLabel = statusData.label;
  const statusIcon = statusData.icon;

  const containerStyle: CSSProperties = useMemo(
    () => ({
      ...CONTAINER_STYLE,
      ...style,
    }),
    [style],
  );

  const dotStyle: CSSProperties = useMemo(
    () => ({
      ...DOT_STYLE_BASE,
      width: `${dotSize}px`,
      height: `${dotSize}px`,
      backgroundColor: statusColor,
    }),
    [dotSize, statusColor],
  );

  const textStyle: CSSProperties = useMemo(
    () => ({
      ...TEXT_STYLE_BASE,
      fontSize: `${fontSize}px`,
      color: statusColor,
    }),
    [fontSize, statusColor],
  );

  const iconStyle: CSSProperties = useMemo(
    () => ({
      ...ICON_STYLE_BASE,
      fontSize: `${fontSize}px`,
      color: statusColor,
    }),
    [fontSize, statusColor],
  );

  const resolvedAriaLabel = useMemo(
    () => ariaLabel ?? `Status: ${statusLabel}`,
    [ariaLabel, statusLabel],
  );

  /** Оптимизированный рендер контента */
  const content = useMemo((): JSX.Element => {
    if (variant === 'dot') {
      return <span style={dotStyle} aria-hidden='true' />;
    }

    if (variant === 'icon') {
      return (
        <span style={iconStyle} aria-hidden='true'>
          {statusIcon}
        </span>
      );
    }

    // variant === 'text'
    return (
      <span style={textStyle} aria-hidden='true'>
        {statusLabel}
      </span>
    );
  }, [variant, dotStyle, iconStyle, textStyle, statusIcon, statusLabel]);

  return (
    <span
      ref={ref}
      role='status'
      aria-label={resolvedAriaLabel}
      aria-live='polite'
      title={resolvedAriaLabel}
      data-component='CoreStatusIndicator'
      data-status={status}
      data-variant={variant}
      data-size={size}
      data-testid={testId}
      className={className}
      style={containerStyle}
      {...rest}
    >
      {content}
    </span>
  );
});

/**
 * Memoized CoreStatusIndicator.
 * Гарантии:
 * - Никаких side-effects
 * - Полная детерминированность
 * - Совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 * - SSR-safe
 * CSS переменные для темизации:
 * - --status-indicator-color-idle: цвет для статуса 'idle' (default: #9CA3AF)
 * - --status-indicator-color-loading: цвет для статуса 'loading' (default: #3B82F6)
 * - --status-indicator-color-success: цвет для статуса 'success' (default: #22C55E)
 * - --status-indicator-color-error: цвет для статуса 'error' (default: #EF4444)
 */
export const StatusIndicator = memo(CoreStatusIndicatorComponent);
