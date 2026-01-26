/**
 * @file packages/ui-core/src/primitives/context-menu.tsx
 * ============================================================================
 * 🔵 CORE UI CONTEXT MENU — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для отображения контекстного меню
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление позиционированием (App-слой передает готовый style)
 * - Таймеров или анимаций
 * - Автоматической фокусировки (App-слой управляет фокусом)
 * - Автоматического закрытия (App-слой решает когда закрывать)
 *
 * Управление:
 * - Позицией меню управляет App-слой через style prop
 * - Открытость меню контролируется через isOpen prop (только для ARIA)
 * - Все события (onSelect, onEscape) эмитятся в App-слой
 * - App-слой решает, когда закрывать меню и когда фокусировать элементы
 */

import { forwardRef, memo, useCallback, useEffect, useId, useMemo, useRef } from 'react';
import type {
  CSSProperties,
  HTMLAttributes,
  JSX,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react';

import type { UIDataAttributes, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Элемент контекстного меню */
export type ContextMenuItem = Readonly<{
  /** Уникальный идентификатор элемента */
  id: string;

  /** Отображаемый текст или контент элемента */
  label: ReactNode;

  /** Может быть disabled */
  disabled?: boolean;

  /** Разделитель перед элементом */
  divider?: boolean;

  /** Дополнительные data-атрибуты */
  data?: UIDataAttributes;
}>;

/** Ref объект для меню, содержащий ul элемент и массив доступных элементов */
export type ContextMenuRef = Readonly<{
  /** Элемент <ul> меню */
  readonly element: HTMLUListElement;
  /** Массив доступных элементов меню (без dividers и disabled) */
  readonly items: readonly HTMLLIElement[];
}>;

export type CoreContextMenuProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onSelect' | 'onKeyDown'> & {
    /** Список элементов меню */
    items: readonly ContextMenuItem[];

    /**
     * Открыто ли меню (используется только для ARIA атрибутов и UX state).
     * @note isOpen не влияет на реальный DOM render - компонент всегда рендерится.
     * @note isOpen влияет только на aria-hidden, aria-expanded и data-state для accessibility.
     * @note Реальное управление видимостью (DOM rendering) контролируется App-слоем через policy.isRendered.
     */
    isOpen?: boolean;

    /** Callback при выборе элемента (App-слой решает, закрывать ли меню) */
    onSelect?: (
      itemId: string,
      event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>,
    ) => void;

    /** Callback при нажатии Escape (App-слой решает, закрывать ли меню) */
    onEscape?: (event: KeyboardEvent<HTMLLIElement>) => void;

    /** Callback при нажатии ArrowUp/ArrowDown (App-слой управляет навигацией) */
    onArrowNavigation?: (
      direction: 'up' | 'down',
      event: KeyboardEvent<HTMLLIElement>,
    ) => void;

    /** Ref для меню (для App-слоя: keyboard navigation и фокусировка) */
    menuRef?: Ref<ContextMenuRef>;

    /** Уникальный идентификатор компонента для ARIA */
    'data-component-id'?: string;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

/**
 * @note CSS переменные для темизации ContextMenu:
 *
 * --context-menu-border-color: цвет границы меню (default: #e0e0e0)
 * --context-menu-bg-color: фон меню (default: #fff)
 * --context-menu-text-color: цвет текста меню (default: #333)
 * --context-menu-item-text-color: цвет текста элементов меню (default: #333)
 * --context-menu-item-hover-bg-color: фон элемента меню при hover (default: #f5f5f5)
 * --context-menu-divider-color: цвет разделителей (default: #e0e0e0)
 * --context-menu-shadow: тень меню (default: 0 2px 8px rgba(0, 0, 0, 0.15))
 *
 * Hover эффекты должны быть определены в глобальных стилях:
 * ```css
 * [data-component="CoreContextMenu"] li[role="menuitem"]:hover:not([aria-disabled="true"]) {
 *   background-color: var(--context-menu-item-hover-bg-color, #f5f5f5);
 * }
 * ```
 */

const CONTEXT_MENU_STYLE: Readonly<CSSProperties> = {
  position: 'fixed',
  zIndex: 1000,
  minWidth: '200px',
  maxHeight: '300px',
  overflowY: 'auto',
  backgroundColor: 'var(--context-menu-bg-color, #fff)',
  border: '1px solid var(--context-menu-border-color, #e0e0e0)',
  borderRadius: '4px',
  boxShadow: 'var(--context-menu-shadow, 0 2px 8px rgba(0, 0, 0, 0.15))',
  padding: '4px 0px',
  listStyle: 'none',
  margin: 0,
} as const;

const MENU_ITEM_STYLE: Readonly<CSSProperties> = {
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--context-menu-item-text-color, #333)',
  backgroundColor: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  transition: 'background-color 0.15s ease',
} as const;

const MENU_ITEM_DISABLED_STYLE: Readonly<CSSProperties> = {
  ...MENU_ITEM_STYLE,
  cursor: 'not-allowed',
  opacity: 0.5,
} as const;

const MENU_ITEM_DIVIDER_STYLE: Readonly<CSSProperties> = {
  height: '1px',
  backgroundColor: 'var(--context-menu-divider-color, #e0e0e0)',
  margin: '4px 0px',
  border: 'none',
  padding: 0,
} as const;

/* ============================================================================
 * 🎯 CORE CONTEXT MENU
 * ========================================================================== */

const CoreContextMenuComponent = forwardRef<HTMLDivElement, CoreContextMenuProps>(
  function CoreContextMenuComponent(
    props: CoreContextMenuProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element {
    const {
      items,
      isOpen = false,
      onSelect,
      onEscape,
      onArrowNavigation,
      menuRef,
      'data-component-id': componentId,
      'data-testid': testId,
      style,
      className,
      ...rest
    } = props;

    const contextMenuId = useId();
    const menuId = componentId !== undefined && componentId !== ''
      ? `${componentId}-menu`
      : `${contextMenuId}-menu`;

    /** Внутренний ref для ul элемента */
    const ulRef = useRef<HTMLUListElement>(null);

    /** Обновляем menuRef с объектом, содержащим ul и доступные элементы */
    useEffect(() => {
      if (menuRef === null || menuRef === undefined) return;
      if (ulRef.current === null) return;

      const focusableItems = Array.from(
        ulRef.current.querySelectorAll<HTMLLIElement>(
          'li[role="menuitem"]:not([aria-disabled="true"])',
        ),
      );

      const refValue: ContextMenuRef = {
        element: ulRef.current,
        items: focusableItems,
      };

      if (typeof menuRef === 'function') {
        menuRef(refValue);
      } else if ('current' in menuRef) {
        // eslint-disable-next-line functional/immutable-data
        (menuRef as { current: ContextMenuRef; }).current = refValue;
      }
    }, [menuRef, items, menuId]);

    /** Обработчик клика на элемент меню */
    const handleItemClick = useCallback(
      (itemId: string, event: MouseEvent<HTMLLIElement>): void => {
        event.preventDefault();
        event.stopPropagation();

        if (onSelect != null) {
          onSelect(itemId, event);
        }
      },
      [onSelect],
    );

    /** Обработчик клавиатуры на элементе меню */
    const handleItemKeyDown = useCallback(
      (itemId: string, event: KeyboardEvent<HTMLLIElement>): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();

          if (onSelect != null) {
            onSelect(itemId, event);
          }
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();

          if (onEscape != null) {
            onEscape(event);
          }
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.stopPropagation();

          if (onArrowNavigation != null) {
            onArrowNavigation(event.key === 'ArrowDown' ? 'down' : 'up', event);
          }
        }
      },
      [onSelect, onEscape, onArrowNavigation],
    );

    /** Обработчик клика на элемент меню (обертка) */
    const createItemClickHandler = useCallback(
      (itemId: string) => (event: MouseEvent<HTMLLIElement>): void => {
        handleItemClick(itemId, event);
      },
      [handleItemClick],
    );

    /** Обработчик клавиатуры на элементе меню (обертка) */
    const createItemKeyDownHandler = useCallback(
      (itemId: string) => (event: KeyboardEvent<HTMLLIElement>): void => {
        handleItemKeyDown(itemId, event);
      },
      [handleItemKeyDown],
    );

    /** Рендерим элементы меню */
    const menuItems = useMemo(() => {
      return items.map((item) => {
        if (item.divider === true) {
          return (
            <li
              key={`divider-${item.id}`}
              role='separator'
              aria-orientation='horizontal'
              style={MENU_ITEM_DIVIDER_STYLE}
            />
          );
        }

        const isDisabled = item.disabled === true;
        const itemStyle = isDisabled ? MENU_ITEM_DISABLED_STYLE : MENU_ITEM_STYLE;

        const itemId = `${menuId}-item-${item.id}`;

        return (
          <li
            key={item.id}
            role='menuitem'
            id={itemId}
            data-item-id={item.id}
            aria-disabled={isDisabled}
            style={itemStyle}
            onClick={!isDisabled ? createItemClickHandler(item.id) : undefined}
            onKeyDown={!isDisabled ? createItemKeyDownHandler(item.id) : undefined}
            tabIndex={isDisabled ? -1 : 0}
            {...item.data}
          >
            {item.label}
          </li>
        );
      });
    }, [items, menuId, createItemClickHandler, createItemKeyDownHandler]);

    /** Стили контейнера */
    const containerStyle: CSSProperties = useMemo(() => ({
      ...CONTEXT_MENU_STYLE,
      ...style,
    }), [style]);

    /** Стили для ul элемента */
    const ulStyle: CSSProperties = useMemo(() => ({
      margin: 0,
      padding: 0,
      listStyle: 'none',
    }), []);

    return (
      <div
        ref={ref}
        role='group'
        aria-hidden={!isOpen}
        aria-expanded={isOpen}
        aria-controls={menuId}
        data-component='CoreContextMenu'
        data-state={isOpen ? 'open' : 'closed'}
        data-testid={testId}
        style={containerStyle}
        className={className}
        {...rest}
      >
        <ul
          ref={ulRef}
          role='menu'
          id={menuId}
          aria-labelledby={componentId !== undefined && componentId !== ''
            ? componentId
            : undefined}
          style={ulStyle}
        >
          {menuItems}
        </ul>
      </div>
    );
  },
);

/**
 * Memoized CoreContextMenu.
 *
 * Гарантии:
 * - Никаких скрытых side-effects
 * - Предсказуемый жизненный цикл
 * - Полная совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding для программного доступа
 * - Полная поддержка ARIA атрибутов для accessibility
 * - Эмитит события (onSelect, onEscape) для обработки в App-слое
 *
 * @note Core не управляет фокусом, позиционированием или закрытием меню.
 * @note Все поведенческие решения принимаются в App-слое.
 * @note App-слой передает готовый style для позиционирования.
 * @note App-слой управляет фокусом через refs и useLayoutEffect.
 *
 * Подходит для:
 * - контекстных меню по правому клику
 * - меню действий для элементов списка
 * - всплывающих меню в определенной позиции
 */
export const ContextMenu = memo(CoreContextMenuComponent);
