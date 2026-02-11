/**
 * @file packages/ui-core/src/components/Tabs.tsx
 * ============================================================================
 * 🔵 CORE UI TABS — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для отображения табов (вкладок)
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием активного таба
 * - Таймеров или анимаций
 *
 * Управление:
 * - Активным табом и событиями управляет App-слой
 */

import { forwardRef, memo, useCallback, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX, MouseEvent, ReactNode, Ref } from 'react';

import type { UIDataAttributes, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Элемент таба */
export type TabItem = Readonly<{
  /** Уникальный идентификатор таба */
  id: string;

  /** Отображаемый текст таба */
  label: string;

  /** Контент таба (панель) */
  content: ReactNode;

  /** Может быть disabled */
  disabled?: boolean;

  /** Дополнительные data-атрибуты */
  data?: UIDataAttributes;
}>;

export type CoreTabsProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> & {
    /** Список табов */
    items: readonly TabItem[];

    /** ID активного таба */
    activeTabId?: string;

    /** Callback при изменении активного таба */
    onChange?: (tabId: string, event: MouseEvent<HTMLButtonElement>) => void;

    /** Ориентация табов */
    orientation?: 'horizontal' | 'vertical';

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const TABS_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
};

const TABS_LIST_STYLE: CSSProperties = {
  display: 'flex',
  listStyle: 'none',
  padding: 0,
  margin: 0,
  borderBottom: '1px solid var(--tabs-border-color, #e0e0e0)',
};

const TABS_LIST_VERTICAL_STYLE: CSSProperties = {
  ...TABS_LIST_STYLE,
  flexDirection: 'column',
  borderBottom: 'none',
  borderRight: '1px solid var(--tabs-border-color, #e0e0e0)',
  width: '200px',
  minWidth: '200px',
};

const TAB_BUTTON_STYLE: CSSProperties = {
  padding: '12px 24px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--tabs-text-color, #666)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'normal',
  transition: 'color 0.2s ease',
  borderBottomWidth: '2px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  marginBottom: '-1px',
};

const TAB_BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...TAB_BUTTON_STYLE,
  color: 'var(--tabs-active-text-color, #111)',
  fontWeight: '600',
  borderBottomColor: 'var(--tabs-active-border-color, #007bff)',
};

const TAB_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...TAB_BUTTON_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const TAB_PANEL_STYLE: CSSProperties = {
  padding: '16px',
  flex: 1,
};

const TAB_PANEL_VERTICAL_STYLE: CSSProperties = {
  ...TAB_PANEL_STYLE,
  marginLeft: '16px',
};

/* ============================================================================
 * 🎯 CORE TABS
 * ========================================================================== */

const CoreTabsComponent = forwardRef<HTMLDivElement, CoreTabsProps>(
  function CoreTabsComponent(props, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const {
      items,
      activeTabId,
      onChange,
      orientation = 'horizontal',
      style,
      className,
      'data-testid': testId,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...rest
    } = props;

    const isVertical = orientation === 'vertical';

    const combinedContainerStyle: CSSProperties = useMemo(() => ({
      ...TABS_CONTAINER_STYLE,
      ...(isVertical && { flexDirection: 'row' }),
      ...style,
    }), [isVertical, style]);

    const tabsListStyle: CSSProperties = useMemo(() => (
      isVertical ? TABS_LIST_VERTICAL_STYLE : TABS_LIST_STYLE
    ), [isVertical]);

    const activeTabItem = useMemo(() => {
      const id = activeTabId ?? items[0]?.id;
      return items.find((item) => item.id === id) ?? items[0];
    }, [items, activeTabId]);

    const activeTab = activeTabItem?.id;
    const activeTabContent = activeTabItem?.content ?? null;

    /** Обработчик клика для всех табов - читает tabId из data-атрибута */
    const handleTabClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>): void => {
        if (onChange == null) return;
        const tabId = event.currentTarget.getAttribute('data-tab-id');
        if (tabId != null) {
          onChange(tabId, event);
        }
      },
      [onChange],
    );

    const renderedTabs = useMemo(() => {
      return items.map((item) => {
        const isActive = item.id === activeTab;
        const isDisabled = item.disabled === true;

        const buttonStyle: CSSProperties = isDisabled
          ? TAB_BUTTON_DISABLED_STYLE
          : isActive
          ? TAB_BUTTON_ACTIVE_STYLE
          : TAB_BUTTON_STYLE;

        const handleClick = !isDisabled ? handleTabClick : undefined;

        return (
          <li key={item.id} role='presentation'>
            <button
              type='button'
              role='tab'
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              aria-disabled={isDisabled}
              id={`tab-${item.id}`}
              data-tab-id={item.id}
              disabled={isDisabled}
              style={buttonStyle}
              onClick={handleClick}
              {...item.data}
            >
              {item.label}
            </button>
          </li>
        );
      });
    }, [items, activeTab, handleTabClick]);

    const panelStyle: CSSProperties = useMemo(() => (
      isVertical ? TAB_PANEL_VERTICAL_STYLE : TAB_PANEL_STYLE
    ), [isVertical]);

    return (
      <div
        ref={ref}
        aria-label={ariaLabelledBy != null ? undefined : (ariaLabel ?? 'Tabs')}
        aria-labelledby={ariaLabelledBy}
        data-component='CoreTabs'
        data-orientation={orientation}
        data-testid={testId}
        style={combinedContainerStyle}
        className={className}
        {...rest}
      >
        <ul
          role='tablist'
          aria-orientation={orientation}
          style={tabsListStyle}
        >
          {renderedTabs}
        </ul>
        {activeTabContent != null && (
          <div
            role='tabpanel'
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            style={panelStyle}
          >
            {activeTabContent}
          </div>
        )}
      </div>
    );
  },
);

CoreTabsComponent.displayName = 'CoreTabs';

/**
 * Memoized CoreTabs.
 *
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как building-block для App-слоя
 */
export const Tabs = memo(CoreTabsComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreTabs — чистый presentational primitive:
 *
 * - Не управляет состоянием активного таба
 * - Не содержит feature flags или telemetry
 * - Все клики и изменения обрабатываются App-слоем
 * - Поддерживает ref forwarding
 *
 * Любая бизнес-логика (routing, active state, tracking) реализуется в App слое.
 *
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
