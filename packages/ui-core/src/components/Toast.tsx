/**
 * @file packages/ui-core/src/components/Toast.tsx
 * ============================================================================
 * 🔵 CORE UI TOAST — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для отображения Toast уведомлений
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - автоматического управления временем жизни
 *
 * Управление:
 * - Видимостью и жизненным циклом управляет App-слой
 */

import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX, ReactNode } from 'react';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

const VARIANT_COLORS: Record<ToastVariant, string> = {
  info: 'var(--toast-info, #2563EB)',
  success: 'var(--toast-success, #16A34A)',
  warning: 'var(--toast-warning, #D97706)',
  error: 'var(--toast-error, #DC2626)',
};

const DEFAULT_VARIANT: ToastVariant = 'info';
const ROLE = 'status';

export type CoreToastProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** Контент Toast */
    content: ReactNode;

    /** Тип Toast */
    variant?: ToastVariant;

    /** Видимость Toast (управляется App-слоем, Core не хранит состояния) */
    visible?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

const BASE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 200,
  maxWidth: 420,
  padding: '10px 14px',
  borderRadius: 8,
  color: 'white',
  fontSize: 14,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  boxSizing: 'border-box',
  pointerEvents: 'auto',
};

/* ============================================================================
 * 🎯 CORE TOAST
 * ========================================================================== */

const CoreToastComponent = forwardRef<HTMLDivElement, CoreToastProps>(
  function CoreToastComponent(props, ref): JSX.Element | null {
    const {
      content,
      variant = DEFAULT_VARIANT,
      visible = false,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const combinedStyle: CSSProperties = useMemo(() => ({
      ...BASE_STYLE,
      backgroundColor: VARIANT_COLORS[variant],
      ...style,
    }), [variant, style]);

    if (!visible || content == null) return null;

    return (
      <div
        ref={ref}
        role={ROLE}
        aria-live='polite'
        aria-atomic='true'
        data-component='CoreToast'
        data-variant={variant}
        data-testid={testId}
        className={className}
        style={combinedStyle}
        {...rest}
      >
        {content}
      </div>
    );
  },
);

/**
 * Memoized CoreToast.
 *
 * Гарантии:
 * - Никаких side-effects
 * - Полная детерминированность
 * - Совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 */
export const Toast = memo(CoreToastComponent);
