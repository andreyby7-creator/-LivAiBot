/**
 * @file packages/ui-core/src/components/SideBar.tsx
 * ============================================================================
 * 🔵 CORE UI SIDEBAR — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения боковой панели
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием свернутости
 * - Таймеров или анимаций
 * Управление:
 * - Состоянием свернутости и событиями управляет App-слой
 */

import type { CSSProperties, HTMLAttributes, JSX, ReactNode, Ref } from 'react';
import { forwardRef, memo, useCallback, useMemo } from 'react';

import type { UIDataAttributes, UISize, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Позиция боковой панели */
export type SideBarPosition = 'left' | 'right';

/** Состояние боковой панели */
export type SideBarState = 'collapsed' | 'expanded';

/** Элемент навигации боковой панели */
export type SideBarItem = Readonly<{
  /** Уникальный идентификатор элемента (обязательный) */
  readonly id: string;

  /** Отображаемый текст элемента (обязательный) */
  readonly label: string;

  /** Иконка элемента (ReactNode) - опциональный */
  readonly icon?: ReactNode;

  /** Может быть disabled - опциональный */
  readonly disabled?: boolean;

  /** Может быть активным (выделенным) - опциональный */
  readonly active?: boolean;

  /** Дополнительные data-атрибуты - опциональный */
  readonly data?: UIDataAttributes;
}>;

export type CoreSideBarProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /**
     * Элементы навигации боковой панели.
     * Опциональный: если не передан, sidebar будет пустым.
     * Каждый элемент должен иметь уникальный id.
     */
    items?: readonly SideBarItem[];

    /**
     * Callback при клике на элемент.
     * Опциональный: если не передан, элементы не будут интерактивными.
     * Вызывается с itemId выбранного элемента.
     */
    onItemClick?: (itemId: string) => void;

    /**
     * Свернута ли боковая панель.
     * Опциональный: по умолчанию false (развернута).
     * В свернутом состоянии отображаются только иконки.
     */
    collapsed?: boolean;

    /**
     * Позиция боковой панели.
     * Опциональный: по умолчанию 'left'.
     * Определяет, с какой стороны экрана отображается sidebar.
     */
    position?: SideBarPosition;

    /**
     * Ширина боковой панели (когда не свернута).
     * Опциональный: по умолчанию '280px'.
     * Поддерживает любые CSS единицы (px, rem, %, var() и т.д.).
     */
    width?: UISize;

    /**
     * Ширина боковой панели (когда свернута).
     * Опциональный: по умолчанию '64px'.
     * Поддерживает любые CSS единицы (px, rem, %, var() и т.д.).
     */
    collapsedWidth?: UISize;

    /**
     * Заголовок боковой панели.
     * Опциональный: если не передан, header не отображается.
     * Может содержать любой ReactNode (текст, компоненты, иконки).
     */
    header?: ReactNode;

    /**
     * Футер боковой панели.
     * Опциональный: если не передан, footer не отображается.
     * Может содержать любой ReactNode (текст, компоненты, иконки).
     */
    footer?: ReactNode;

    /**
     * Показывать ли оверлей (для мобильных устройств).
     * Опциональный: по умолчанию false.
     * Когда true, отображается полупрозрачный overlay за sidebar.
     * Оверлей имеет z-index 9998, sidebar должен иметь z-index выше.
     */
    showOverlay?: boolean;

    /**
     * Callback при клике на оверлей.
     * Опциональный: если не передан, клик на overlay не обрабатывается.
     * Обычно используется для закрытия sidebar на мобильных устройствах.
     */
    onOverlayClick?: () => void;

    /** Test ID для автотестов - опциональный */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const DEFAULT_WIDTH = '280px';
const DEFAULT_COLLAPSED_WIDTH = '64px';

const SIDEBAR_BASE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--sidebar-bg, #FFFFFF)',
  borderRight: '1px solid var(--sidebar-border-color, #E5E7EB)',
  boxSizing: 'border-box',
  height: '100%',
  overflow: 'hidden',
  transition: 'width 0.3s ease',
};

const SIDEBAR_COLLAPSED_STYLE: CSSProperties = {
  ...SIDEBAR_BASE_STYLE,
  overflow: 'visible',
};

const SIDEBAR_HEADER_STYLE: CSSProperties = {
  padding: '16px',
  borderBottom: '1px solid var(--sidebar-border-color, #E5E7EB)',
  minHeight: '64px',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
};

const SIDEBAR_CONTENT_STYLE: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '8px',
};

const SIDEBAR_FOOTER_STYLE: CSSProperties = {
  padding: '16px',
  borderTop: '1px solid var(--sidebar-border-color, #E5E7EB)',
  minHeight: '64px',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
};

const SIDEBAR_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: '8px',
  cursor: 'pointer',
  color: 'var(--sidebar-item-text-color, #333333)',
  fontSize: '14px',
  fontWeight: 'normal',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  marginBottom: '4px',
  border: 'none',
  backgroundColor: 'transparent',
  width: '100%',
  textAlign: 'left',
  boxSizing: 'border-box',
};

const SIDEBAR_ITEM_ACTIVE_STYLE: CSSProperties = {
  ...SIDEBAR_ITEM_STYLE,
  backgroundColor: 'var(--sidebar-item-active-bg, #F3F4F6)',
  color: 'var(--sidebar-item-active-text-color, #111827)',
  fontWeight: '600',
};

const SIDEBAR_ITEM_DISABLED_STYLE: CSSProperties = {
  ...SIDEBAR_ITEM_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const SIDEBAR_ITEM_ICON_STYLE: CSSProperties = {
  marginRight: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '20px',
  height: '20px',
};

const SIDEBAR_ITEM_COLLAPSED_ICON_STYLE: CSSProperties = {
  ...SIDEBAR_ITEM_ICON_STYLE,
  marginRight: 0,
};

/**
 * Стили оверлея боковой панели.
 * z-index: 9998 - оверлей должен быть ниже sidebar (sidebar должен иметь z-index >= 9999).
 * pointerEvents: 'auto' - явно гарантируем, что клики обрабатываются только на overlay.
 */
const SIDEBAR_OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  zIndex: 9998,
  pointerEvents: 'auto',
};

const SIDEBAR_ITEM_LABEL_STYLE: CSSProperties = {
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/* ============================================================================
 * 🎨 STYLE HELPERS
 * ========================================================================== */

/**
 * Получает стили для элемента sidebar на основе его состояния.
 * Используется для улучшения читаемости и централизации логики стилей.
 */
function getItemStyle(item: SideBarItem): CSSProperties {
  if (item.disabled === true) {
    return SIDEBAR_ITEM_DISABLED_STYLE;
  }
  if (item.active === true) {
    return SIDEBAR_ITEM_ACTIVE_STYLE;
  }
  return SIDEBAR_ITEM_STYLE;
}

/* ============================================================================
 * 🎯 CORE SIDEBAR
 * ========================================================================== */

const CoreSideBarComponent = forwardRef<HTMLDivElement, CoreSideBarProps>(
  function CoreSideBarComponent(props, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const {
      items = [],
      onItemClick,
      collapsed = false,
      position = 'left',
      width = DEFAULT_WIDTH,
      collapsedWidth = DEFAULT_COLLAPSED_WIDTH,
      header,
      footer,
      showOverlay = false,
      onOverlayClick,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const isCollapsed = Boolean(collapsed);

    /**
     * Мемоизация стилей sidebar для performance и детерминированности.
     * Пересчитывается только при изменении collapsed, width, collapsedWidth, position или style.
     */
    const sidebarStyle: CSSProperties = useMemo(() => {
      const baseStyle = isCollapsed ? SIDEBAR_COLLAPSED_STYLE : SIDEBAR_BASE_STYLE;
      const currentWidth = isCollapsed ? collapsedWidth : width;
      const borderStyle = position === 'right'
        ? { borderRight: 'none', borderLeft: '1px solid var(--sidebar-border-color, #E5E7EB)' }
        : {};

      return {
        ...baseStyle,
        width: currentWidth,
        ...borderStyle,
        ...style,
      };
    }, [isCollapsed, width, collapsedWidth, position, style]);

    /**
     * Callback для обработки клика на элемент.
     * Мемоизирован для performance - избегает пересоздания функции при ререндерах.
     * Проверка disabled вынесена внутрь для полной чистоты и исключения создания анонимных функций.
     */
    const handleItemClick = useCallback(
      (item: SideBarItem): void => {
        if (item.disabled !== true && onItemClick) {
          onItemClick(item.id);
        }
      },
      [onItemClick],
    );

    /**
     * Мемоизированный объект с обработчиками кликов для каждого элемента.
     * Избегает создания функций в JSX, что улучшает performance и удовлетворяет линтер.
     */
    const itemClickHandlers = useMemo(() => {
      return Object.fromEntries(
        items.map((item) => [
          item.id,
          (): void => {
            handleItemClick(item);
          },
        ]),
      ) as Record<string, () => void>;
    }, [items, handleItemClick]);

    /**
     * Динамический aria-label для nav элемента на основе наличия header.
     * Улучшает screen reader UX, предоставляя более контекстную информацию.
     */
    const navAriaLabel = useMemo(() => {
      return header != null ? 'Sidebar menu' : 'Sidebar navigation';
    }, [header]);

    /**
     * Мемоизация рендеринга элементов sidebar для performance и детерминированности.
     * Пересчитывается только при изменении items, isCollapsed или itemClickHandlers.
     */
    const renderedItems = useMemo(() => {
      return items.map((item) => {
        const isActive = item.active === true;
        const isDisabled = item.disabled === true;

        const itemStyle = getItemStyle(item);

        const iconStyle: CSSProperties = isCollapsed
          ? SIDEBAR_ITEM_COLLAPSED_ICON_STYLE
          : SIDEBAR_ITEM_ICON_STYLE;

        return (
          <button
            key={item.id}
            type='button'
            role='menuitem'
            aria-label={isCollapsed ? item.label : undefined}
            aria-current={isActive ? 'page' : undefined}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : 0}
            data-item-id={item.id}
            data-active={isActive || undefined}
            disabled={isDisabled}
            style={itemStyle}
            onClick={itemClickHandlers[item.id]}
            {...item.data}
          >
            {item.icon != null && (
              <span style={iconStyle} aria-hidden='true'>
                {item.icon}
              </span>
            )}
            {!isCollapsed && (
              <span style={SIDEBAR_ITEM_LABEL_STYLE}>
                {item.label}
              </span>
            )}
          </button>
        );
      });
    }, [items, isCollapsed, itemClickHandlers]);

    return (
      <>
        {showOverlay && (
          <div
            role='presentation'
            aria-hidden='true'
            tabIndex={-1}
            style={SIDEBAR_OVERLAY_STYLE}
            onClick={onOverlayClick}
            data-testid={testId != null && testId !== '' ? `${testId}-overlay` : undefined}
          />
        )}
        <aside
          ref={ref}
          role='navigation'
          aria-label='Sidebar navigation'
          data-component='CoreSideBar'
          data-position={position}
          data-collapsed={isCollapsed || undefined}
          data-testid={testId}
          style={sidebarStyle}
          className={className}
          {...rest}
        >
          {header != null && (
            <div
              style={SIDEBAR_HEADER_STYLE}
              data-testid={testId != null && testId !== '' ? `${testId}-header` : undefined}
            >
              {header}
            </div>
          )}
          <nav
            role='menu'
            aria-label={navAriaLabel}
            style={SIDEBAR_CONTENT_STYLE}
            data-testid={testId != null && testId !== '' ? `${testId}-content` : undefined}
          >
            {renderedItems}
          </nav>
          {footer != null && (
            <div
              style={SIDEBAR_FOOTER_STYLE}
              data-testid={testId != null && testId !== '' ? `${testId}-footer` : undefined}
            >
              {footer}
            </div>
          )}
        </aside>
      </>
    );
  },
);

CoreSideBarComponent.displayName = 'CoreSideBar';

/**
 * Memoized CoreSideBar.
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как building-block для App-слоя
 */
export const SideBar = memo(CoreSideBarComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreSideBar — чистый presentational primitive:
 * - Не управляет состоянием свернутости
 * - Не содержит feature flags или telemetry
 * - Все клики и изменения обрабатываются App-слоем
 * - Поддерживает ref forwarding
 * Любая бизнес-логика (routing, active state, tracking) реализуется в App слое.
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
