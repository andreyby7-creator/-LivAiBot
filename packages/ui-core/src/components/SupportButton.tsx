/**
 * @file packages/ui-core/src/components/SupportButton.tsx
 * ============================================================================
 * 🔵 CORE UI SUPPORT BUTTON — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для кнопки вызова поддержки
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием
 * - Логику отправки обращений
 * - Бизнес-логику поддержки
 * Управление:
 * - Видимостью и поведением управляет App-слой
 */

import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { forwardRef, memo, useMemo } from 'react';

import type { UISize, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Варианты отображения Support Button */
export type SupportButtonVariant = 'default' | 'minimal' | 'floating';

/** Размер Support Button */
export type SupportButtonSize = UISize;

export type CoreSupportButtonProps = Readonly<
  Omit<HTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> & {
    /** Callback при клике на кнопку поддержки */
    onSupportClick?: (event: MouseEvent<HTMLButtonElement>) => void;

    /** Текст кнопки. По умолчанию 'Поддержка' */
    label?: string;

    /** Иконка поддержки (ReactNode). По умолчанию '?' */
    icon?: ReactNode;

    /** Вариант отображения кнопки */
    variant?: SupportButtonVariant;

    /** Размер кнопки */
    size?: SupportButtonSize;

    /** Отключенное состояние кнопки */
    disabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const SUPPORT_BUTTON_BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: '1px solid var(--support-button-border-color, #D1D5DB)',
  borderRadius: '6px',
  backgroundColor: 'var(--support-button-bg, #FFFFFF)',
  color: 'var(--support-button-text-color, #374151)',
  fontSize: '14px',
  fontWeight: '500',
  lineHeight: '1.5',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  outline: 'none',
  userSelect: 'none',
  textDecoration: 'none',
};

// disabled на button уже полностью блокирует события, но мы добавляем визуальные стили для consistency
const SUPPORT_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...SUPPORT_BUTTON_BASE_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const SUPPORT_BUTTON_SMALL_STYLE: CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
  gap: '4px',
};

const SUPPORT_BUTTON_MEDIUM_STYLE: CSSProperties = {
  padding: '8px 12px',
};

const SUPPORT_BUTTON_LARGE_STYLE: CSSProperties = {
  padding: '12px 16px',
  fontSize: '16px',
  gap: '8px',
};

const SUPPORT_BUTTON_MINIMAL_STYLE: CSSProperties = {
  padding: '4px 8px',
  fontSize: '13px',
  gap: '4px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--support-button-minimal-text-color, #6B7280)',
};

const SUPPORT_BUTTON_FLOATING_STYLE: CSSProperties = {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 1000,
  padding: '12px 16px',
  borderRadius: '50px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  backgroundColor: 'var(--support-button-floating-bg, #3B82F6)',
  color: 'var(--support-button-floating-text-color, #FFFFFF)',
  border: 'none',
};

const ICON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '16px',
  height: '16px',
  fontSize: '16px',
};

const ICON_SMALL_STYLE: CSSProperties = {
  width: '14px',
  height: '14px',
  fontSize: '14px',
};

const ICON_LARGE_STYLE: CSSProperties = {
  width: '18px',
  height: '18px',
  fontSize: '18px',
};

/* ============================================================================
 * 🎨 STYLE HELPERS
 * ========================================================================== */

/** Получает стили для Support Button на основе состояния и размера. */
function getSupportButtonStyle(
  variant: SupportButtonVariant,
  size: SupportButtonSize,
  disabled: boolean,
): CSSProperties {
  // Базовый стиль в зависимости от варианта
  const baseStyle = disabled
    ? SUPPORT_BUTTON_DISABLED_STYLE
    : variant === 'minimal'
    ? SUPPORT_BUTTON_MINIMAL_STYLE
    : variant === 'floating'
    ? SUPPORT_BUTTON_FLOATING_STYLE
    : SUPPORT_BUTTON_BASE_STYLE;

  // Размер (только для не-floating вариантов)
  const sizeStyle = variant === 'floating'
    ? {}
    : size === 'small'
    ? SUPPORT_BUTTON_SMALL_STYLE
    : size === 'large'
    ? SUPPORT_BUTTON_LARGE_STYLE
    : SUPPORT_BUTTON_MEDIUM_STYLE;

  return {
    ...baseStyle,
    ...sizeStyle,
  };
}

/** Получает стили для иконки */
function getIconStyle(size: SupportButtonSize): CSSProperties {
  return size === 'small'
    ? { ...ICON_STYLE, ...ICON_SMALL_STYLE }
    : size === 'large'
    ? { ...ICON_STYLE, ...ICON_LARGE_STYLE }
    : ICON_STYLE;
}

/* ============================================================================
 * 🎯 CORE SUPPORT BUTTON
 * ========================================================================== */

const CoreSupportButtonComponent = forwardRef<HTMLButtonElement, CoreSupportButtonProps>(
  function CoreSupportButtonComponent(props, ref) {
    const {
      label = 'Поддержка',
      icon = '?',
      variant = 'default',
      size = 'medium',
      disabled = false,
      onSupportClick,
      'data-testid': testId,
      ...rest
    } = props;

    /** Стили для кнопки */
    const buttonStyle = useMemo<CSSProperties>(
      () => getSupportButtonStyle(variant, size, disabled),
      [variant, size, disabled],
    );

    /** Стили для иконки */
    const iconStyle = useMemo<CSSProperties>(
      () => getIconStyle(size),
      [size],
    );

    return (
      <button
        ref={ref}
        type='button'
        style={buttonStyle}
        onClick={onSupportClick}
        disabled={disabled}
        data-component='CoreSupportButton'
        data-variant={variant}
        data-size={size}
        {...(disabled && { 'data-disabled': 'true' })}
        {...(testId != null && testId !== '' && { 'data-testid': testId })}
        {...rest}
      >
        <span
          style={iconStyle}
          data-testid={testId != null && testId !== '' ? `${testId}-icon` : undefined}
        >
          {icon}
        </span>
        {variant !== 'minimal' && (
          <span data-testid={testId != null && testId !== '' ? `${testId}-label` : undefined}>
            {label}
          </span>
        )}
      </button>
    );
  },
);

CoreSupportButtonComponent.displayName = 'CoreSupportButton';

/**
 * Memoized CoreSupportButton.
 * Полностью детерминированный, side-effect free, SSR и concurrent safe.
 * Поддерживает ref forwarding. Подходит как building-block для App-слоя.
 *
 * @example
 * ```tsx
 * // Базовая кнопка поддержки
 * <SupportButton onSupportClick={() => console.log('Support clicked')} />
 * // Минимальная кнопка с кастомной иконкой
 * <SupportButton
 *   variant="minimal"
 *   icon={<HelpIcon />}
 *   onSupportClick={handleSupport}
 * />
 * // Floating кнопка поддержки
 * <SupportButton
 *   variant="floating"
 *   label="Помощь"
 *   onSupportClick={handleSupport}
 * />
 * ```
 */
export const SupportButton = memo(CoreSupportButtonComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CSS Variables для кастомизации через app theme:
 * - --support-button-border-color: цвет рамки (default: #D1D5DB)
 * - --support-button-bg: цвет фона (default: #FFFFFF)
 * - --support-button-text-color: цвет текста (default: #374151)
 * - --support-button-active-border-color: цвет рамки активного (default: #3B82F6)
 * - --support-button-active-bg: фон активного (default: #EBF4FF)
 * - --support-button-active-text-color: цвет текста активного (default: #1E40AF)
 * - --support-button-active-shadow: тень активного (default: rgba(59, 130, 246, 0.1))
 * - --support-button-minimal-text-color: цвет текста минимального варианта (default: #6B7280)
 * - --support-button-floating-bg: фон floating варианта (default: #3B82F6)
 * - --support-button-floating-text-color: цвет текста floating варианта (default: #FFFFFF)
 * @contract Data Attributes (для QA)
 * Компонент добавляет следующие data-атрибуты для тестирования и отладки.
 * Все атрибуты используют консистентную схему строковых значений.
 * QA должен использовать именно эти строковые значения для селекторов:
 * - data-component="CoreSupportButton": идентификатор компонента
 * - data-variant: строго "default" | "minimal" | "floating" (вариант отображения)
 * - data-size: строго "small" | "medium" | "large" (размер отображения)
 * - data-disabled: "true" | отсутствует (отключенное состояние)
 */
