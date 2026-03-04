/**
 * @file packages/ui-core/src/components/NavigationMenuItem.tsx
 * ============================================================================
 * 🔵 CORE UI NAVIGATION MENU ITEM — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для элементов навигационного меню
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием активного элемента
 * - Логику роутинга
 * - Бизнес-логику
 * Управление:
 * - Активным состоянием и навигацией управляет App-слой
 */

import React, { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * =========================================================================== */

/**
 * Данные элемента навигационного меню.
 * Минимальный набор полей для базового отображения элемента меню.
 */
export type NavigationMenuItemData = Readonly<{
  /** Текст элемента меню */
  label: string;

  /** URL для навигации (опционально, если это кнопка) */
  href?: string;

  /** Иконка элемента меню (опционально) */
  icon?: ReactNode;

  /** Признак активности элемента */
  isActive?: boolean;

  /** Признак отключения элемента */
  isDisabled?: boolean;
}>;

export type CoreNavigationMenuItemProps = Readonly<
  Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    /** Данные элемента меню */
    item: NavigationMenuItemData;

    /** Размер элемента меню. По умолчанию 'medium'. */
    size?: 'small' | 'medium' | 'large';

    /** Вариант отображения. По умолчанию 'default'. */
    variant?: 'default' | 'compact' | 'minimal';

    /** Показывать ли иконку. По умолчанию true. */
    showIcon?: boolean;

    /** Показывать ли текст. По умолчанию true. */
    showLabel?: boolean;

    /** Кастомный компонент иконки (ReactNode). Если передан, заменяет стандартную иконку. */
    customIcon?: ReactNode;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * =========================================================================== */

const ITEM_BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '500',
  lineHeight: '1.5',
  textDecoration: 'none',
  color: 'var(--navigation-menu-item-text-color, #374151)',
  backgroundColor: 'var(--navigation-menu-item-bg, transparent)',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  outline: 'none',
  userSelect: 'none',
};

const ITEM_ACTIVE_STYLE: CSSProperties = {
  backgroundColor: 'var(--navigation-menu-item-active-bg, #DBEAFE)',
  color: 'var(--navigation-menu-item-active-text-color, #1E40AF)',
  fontWeight: '600',
};

const ITEM_DISABLED_STYLE: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const ITEM_SMALL_STYLE: CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
  gap: '6px',
};

const ITEM_LARGE_STYLE: CSSProperties = {
  padding: '12px 16px',
  fontSize: '16px',
  gap: '10px',
};

const ITEM_COMPACT_STYLE: CSSProperties = {
  padding: '4px 8px',
  gap: '4px',
};

const ITEM_MINIMAL_STYLE: CSSProperties = {
  padding: '2px 4px',
  gap: '2px',
  fontSize: '13px',
};

const ICON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '16px',
  height: '16px',
  color: 'currentColor',
};

const ICON_SMALL_STYLE: CSSProperties = {
  width: '14px',
  height: '14px',
};

const ICON_LARGE_STYLE: CSSProperties = {
  width: '18px',
  height: '18px',
};

const LABEL_STYLE: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/* ============================================================================
 * 🎨 STYLE HELPERS
 * =========================================================================== */

/** Получает стили для элемента меню на основе состояния и размера. */
function getItemStyle(
  isActive: boolean,
  isDisabled: boolean,
  size: 'small' | 'medium' | 'large',
  variant: 'default' | 'compact' | 'minimal',
): CSSProperties {
  // Состояние (приоритет: disabled > active > hover)
  let stateStyle: CSSProperties = {};
  if (isDisabled) {
    stateStyle = ITEM_DISABLED_STYLE;
  } else if (isActive) {
    stateStyle = ITEM_ACTIVE_STYLE;
  }

  // Размер
  let sizeStyle: CSSProperties = {};
  if (size === 'small') {
    sizeStyle = ITEM_SMALL_STYLE;
  } else if (size === 'large') {
    sizeStyle = ITEM_LARGE_STYLE;
  }

  // Вариант
  let variantStyle: CSSProperties = {};
  if (variant === 'compact') {
    variantStyle = ITEM_COMPACT_STYLE;
  } else if (variant === 'minimal') {
    variantStyle = ITEM_MINIMAL_STYLE;
  }

  return {
    ...ITEM_BASE_STYLE,
    ...stateStyle,
    ...sizeStyle,
    ...variantStyle,
  };
}

/** Получает стили для иконки на основе размера. */
function getIconStyle(size: 'small' | 'medium' | 'large'): CSSProperties {
  if (size === 'small') return { ...ICON_STYLE, ...ICON_SMALL_STYLE };
  if (size === 'large') return { ...ICON_STYLE, ...ICON_LARGE_STYLE };
  return ICON_STYLE;
}

/* ============================================================================
 * 🎯 CORE NAVIGATION MENU ITEM
 * =========================================================================== */

const CoreNavigationMenuItemComponent = forwardRef<HTMLElement, CoreNavigationMenuItemProps>(
  function CoreNavigationMenuItemComponent(
    props: CoreNavigationMenuItemProps,
    ref: React.ForwardedRef<HTMLElement>,
  ) {
    const {
      item,
      size = 'medium',
      variant = 'default',
      showIcon = true,
      showLabel = true,
      customIcon,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const { label, href, icon, isActive = false, isDisabled = false } = item;

    /** Определяем, использовать ли ссылку или кнопку */
    const isLink = href != null && href !== '' && !isDisabled;

    /** Стили для элемента */
    const itemStyle = useMemo<CSSProperties>(() => ({
      ...getItemStyle(isActive, isDisabled, size, variant),
      ...style,
    }), [isActive, isDisabled, size, variant, style]);

    /** Стили для иконки */
    const iconStyle = useMemo(() => getIconStyle(size), [size]);

    /** Helper для создания test ID с суффиксом */
    const makeTestId = useMemo(
      (): (suffix: string) => string | undefined =>
      (
        suffix: string,
      ) => (testId != null && testId !== '' ? `${testId}-${suffix}` : undefined),
      [testId],
    );

    /** Общие пропсы для обоих элементов */
    const commonProps = {
      ref,
      style: itemStyle,
      className,
      'data-component': 'CoreNavigationMenuItem',
      'data-size': size,
      'data-variant': variant,
      ...(isActive && { 'data-active': 'true' }),
      ...(isDisabled && { 'data-disabled': 'true' }),
      'data-testid': testId,
      ...(isActive && { 'aria-current': 'page' as const }),
      ...rest,
    };

    /** Рендер иконки */
    const renderIcon = (): ReactNode => {
      if (!showIcon) return null;

      if (customIcon != null) {
        return (
          <span style={iconStyle} data-testid={makeTestId('icon')}>
            {customIcon}
          </span>
        );
      }

      if (icon != null) {
        return (
          <span style={iconStyle} data-testid={makeTestId('icon')}>
            {icon}
          </span>
        );
      }

      return null;
    };

    if (isLink) {
      return (
        <a
          {...commonProps}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          href={href}
          data-testid={testId}
        >
          {renderIcon()}
          {showLabel && (
            <span style={LABEL_STYLE} data-testid={makeTestId('label')}>
              {label}
            </span>
          )}
        </a>
      );
    }

    return (
      <button
        {...commonProps}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        type='button'
        disabled={isDisabled}
        data-testid={testId}
      >
        {renderIcon()}
        {showLabel && (
          <span style={LABEL_STYLE} data-testid={makeTestId('label')}>
            {label}
          </span>
        )}
      </button>
    );
  },
);

CoreNavigationMenuItemComponent.displayName = 'CoreNavigationMenuItem';

/**
 * Memoized CoreNavigationMenuItem.
 * Полностью детерминированный, side-effect free, SSR и concurrent safe.
 * Поддерживает ref forwarding. Подходит как building-block для App-слоя.
 *
 * @example
 * ```tsx
 * // Базовый
 * <NavigationMenuItem item={{ label: 'Главная', href: '/' }} />
 * // Активный с иконкой
 * <NavigationMenuItem item={{ label: 'Профиль', href: '/profile', icon: <UserIcon />, isActive: true }} />
 * // Отключенный с размерами
 * <NavigationMenuItem item={{ label: 'Настройки', href: '/settings', isDisabled: true }} size="large" variant="compact" />
 * // Минимальный без текста
 * <NavigationMenuItem item={{ label: 'Поиск', icon: <SearchIcon /> }} variant="minimal" showLabel={false} />
 * ```
 */
export const NavigationMenuItem = memo(CoreNavigationMenuItemComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * =========================================================================== */

/**
 * CSS Variables для кастомизации через app theme:
 * - --navigation-menu-item-text-color: цвет текста (default: #374151)
 * - --navigation-menu-item-bg: цвет фона (default: transparent)
 * - --navigation-menu-item-hover-bg: цвет фона при hover (default: #F3F4F6)
 * - --navigation-menu-item-hover-text-color: цвет текста при hover (default: #111827)
 * - --navigation-menu-item-active-bg: цвет фона активного элемента (default: #DBEAFE)
 * - --navigation-menu-item-active-text-color: цвет текста активного элемента (default: #1E40AF)
 * @contract Data Attributes (для QA)
 * Компонент добавляет следующие data-атрибуты для тестирования и отладки.
 * Все атрибуты используют консистентную схему строковых значений.
 * QA должен использовать именно эти строковые значения для селекторов:
 * - data-component="CoreNavigationMenuItem": идентификатор компонента
 * - data-size: строго "small" | "medium" | "large" (размер отображения)
 * - data-variant: строго "default" | "compact" | "minimal" (вариант отображения)
 * - data-active: "true" | отсутствует (активное состояние)
 * - data-disabled: "true" | отсутствует (отключенное состояние)
 */
