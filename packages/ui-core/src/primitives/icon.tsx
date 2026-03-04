/**
 * @file packages/ui-core/src/primitives/icon.tsx
 * ============================================================================
 * 🔵 CORE UI ICON — BEHAVIORAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-примитив для отображения иконок
 * - Детерминированный и side-effect isolated
 * - SSR-safe
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - продуктовых решений
 */

import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX } from 'react';

import type { UISize } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

const DEFAULT_ICON_SIZE = 16;

export type CoreIconProps = Readonly<
  HTMLAttributes<HTMLElementTagNameMap['i']> & {
    /** Имя иконки (ключ из дизайн-системы) */
    name: string;

    /** Размер иконки */
    size?: UISize;

    /** Цвет иконки */
    color?: string;

    /** Accessibility: иконка декоративная (скрыта от screen readers) */
    decorative?: boolean;

    /** Accessibility: текстовое описание для смысловых иконок */
    ariaLabel?: string;
  }
>;

/* ============================================================================
 * 🎯 CORE ICON
 * ========================================================================== */

const CoreIconComponent = forwardRef<HTMLElementTagNameMap['i'], CoreIconProps>(
  function CoreIconComponent(props, ref): JSX.Element {
    const {
      name,
      size = DEFAULT_ICON_SIZE,
      color = 'currentColor',
      decorative = false,
      ariaLabel,
      ...rest
    } = props;

    const iconStyle = useMemo(() => ({
      '--icon-size': typeof size === 'number' ? `${size}px` : size,
      '--icon-color': color,
      fontSize: 'var(--icon-size, 16px)',
      color: 'var(--icon-color, currentColor)',
    } as CSSProperties), [size, color]);

    if (decorative) {
      return (
        <i
          ref={ref}
          data-component='CoreIcon'
          data-icon-name={name}
          style={iconStyle}
          aria-hidden
          {...rest}
        />
      );
    }

    return (
      <i
        ref={ref}
        data-component='CoreIcon'
        data-icon-name={name}
        style={iconStyle}
        role='img'
        aria-label={ariaLabel ?? name}
        {...rest}
      />
    );
  },
);

/**
 * Memoized CoreIcon.
 * Гарантии:
 * - Никаких скрытых side-effects
 * - Предсказуемый жизненный цикл
 * - Полная совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding для UI интеграций
 * - Доступность: декоративные и смысловые иконки
 * - CSS variables: --icon-size, --icon-color для theme overrides
 * CSS Variables (рекомендуется добавить):
 * ```css
 * [data-component="CoreIcon"] {
 *   font-size: var(--icon-size, 16px);
 *   color: var(--icon-color, currentColor);
 * }
 * ```
 * Подходит для:
 * - UI-компонентов
 * - workflow
 * - design-system
 */
export const Icon = memo(CoreIconComponent);
