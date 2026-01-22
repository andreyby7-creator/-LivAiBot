/**
 * @file packages/ui-core/src/primitives/tooltip.tsx
 * ============================================================================
 * 🔵 CORE UI TOOLTIP — BEHAVIORAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-примитив для отображения Tooltip (подсказка)
 * - Детерминированный, предсказуемый и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - продуктовых решений
 */

import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX, ReactNode } from 'react';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

const DEFAULT_BG_COLOR = 'var(--tooltip-bg, #111827)';
const DEFAULT_TEXT_COLOR = 'var(--tooltip-text, white)';
const DEFAULT_BORDER_RADIUS = 6;
const DEFAULT_FONT_SIZE = 12;
const DEFAULT_PADDING = '6px 8px';
const OFFSET_PX = 6;

function resolvePlacementStyle(placement: TooltipPlacement): CSSProperties {
  switch (placement) {
    case 'top':
      return {
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: OFFSET_PX,
      };
    case 'right':
      return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: OFFSET_PX };
    case 'bottom':
      return { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: OFFSET_PX };
    case 'left':
      return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: OFFSET_PX };
    default:
      return {};
  }
}

const baseStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 1000,
  borderRadius: `${DEFAULT_BORDER_RADIUS}px`,
  fontSize: `${DEFAULT_FONT_SIZE}px`,
  padding: DEFAULT_PADDING,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  boxSizing: 'border-box',
};

export type CoreTooltipProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** ID tooltip для aria-describedby связи с якорем */
    id?: string;

    /** Контент tooltip */
    content: ReactNode;

    /** Позиция относительно якоря */
    placement?: TooltipPlacement;

    /** Видимость tooltip (управляется App слоем) */
    visible?: boolean;

    /** Цвет фона */
    bgColor?: string;

    /** Цвет текста */
    textColor?: string;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

/* ============================================================================
 * 🎯 CORE TOOLTIP
 * ========================================================================== */

const CoreTooltipComponent = forwardRef<HTMLDivElement, CoreTooltipProps>(
  function CoreTooltipComponent(props, ref): JSX.Element | null {
    const {
      id,
      content,
      placement = 'top',
      visible = false,
      bgColor = DEFAULT_BG_COLOR,
      textColor = DEFAULT_TEXT_COLOR,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const placementStyle = resolvePlacementStyle(placement);

    const combinedStyle = useMemo(() => ({
      ...baseStyle,
      backgroundColor: bgColor,
      color: textColor,
      ...placementStyle,
      ...style,
    }), [bgColor, textColor, placementStyle, style]);

    if (content == null || !visible) return null;

    return (
      <div
        ref={ref}
        id={id}
        role='tooltip'
        data-component='CoreTooltip'
        data-placement={placement}
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
 * Memoized CoreTooltip.
 *
 * Гарантии:
 * - Никаких side-effects
 * - Полная детерминированность
 * - Совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 */
export const Tooltip = memo(CoreTooltipComponent);

export { resolvePlacementStyle };
