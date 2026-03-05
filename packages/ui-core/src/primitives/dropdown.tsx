/**
 * @file packages/ui-core/src/primitives/dropdown.tsx
 * ============================================================================
 * 🔵 CORE UI DROPDOWN — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения выпадающего меню
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием открытости меню
 * - Таймеров или анимаций
 * Управление:
 * - Открытостью меню и событиями управляет App-слой
 */

import type {
  CSSProperties,
  HTMLAttributes,
  JSX,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react';
import { forwardRef, memo, useCallback, useId, useLayoutEffect, useMemo, useRef } from 'react';

import type { UIDataAttributes, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Элемент меню dropdown */
export type DropdownItem = Readonly<{
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

export type CoreDropdownProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onSelect' | 'onToggle'> & {
    /** Список элементов меню */
    items: readonly DropdownItem[];

    /** Текст или контент триггера (кнопки открытия) */
    trigger: ReactNode;

    /** Открыто ли меню */
    isOpen?: boolean;

    /** Callback при изменении открытости (вызывается при явных действиях пользователя) */
    onToggle?: (
      isOpen: boolean,
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    ) => void;

    /** Callback для закрытия меню без события (используется после выбора элемента) */
    onClose?: () => void;

    /** Callback при выборе элемента */
    onSelect?: (
      itemId: string,
      event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>,
    ) => void;

    /** Позиция меню относительно триггера */
    placement?: 'bottom' | 'top' | 'left' | 'right';

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
 * @note CSS переменные для темизации Dropdown:
 * --dropdown-border-color: цвет границы триггера и меню (default: #e0e0e0)
 * --dropdown-bg-color: фон триггера (default: #fff)
 * --dropdown-text-color: цвет текста триггера (default: #333)
 * --dropdown-menu-bg-color: фон меню (default: #fff)
 * --dropdown-item-text-color: цвет текста элементов меню (default: #333)
 * --dropdown-item-hover-bg-color: фон элемента меню при hover (default: #f5f5f5)
 * --dropdown-divider-color: цвет разделителей (default: #e0e0e0)
 * @note Hover эффекты должны быть определены в глобальных стилях или App слое:
 * ```css
 * [data-component="CoreDropdown"] li[role="menuitem"]:hover:not([aria-disabled="true"]) {
 *   background-color: var(--dropdown-item-hover-bg-color, #f5f5f5);
 * }
 * ```
 * Core primitive не мутирует DOM для hover эффектов.
 */

const DROPDOWN_CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const TRIGGER_BUTTON_STYLE: CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--dropdown-border-color, #e0e0e0)',
  backgroundColor: 'var(--dropdown-bg-color, #fff)',
  color: 'var(--dropdown-text-color, #333)',
  cursor: 'pointer',
  fontSize: '14px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  minWidth: '120px',
};

const MENU_STYLE: CSSProperties = {
  position: 'absolute',
  zIndex: 1000,
  minWidth: '200px',
  maxHeight: '300px',
  overflowY: 'auto',
  backgroundColor: 'var(--dropdown-menu-bg-color, #fff)',
  border: '1px solid var(--dropdown-border-color, #e0e0e0)',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  padding: '4px 0',
  margin: '4px 0',
  listStyle: 'none',
};

const MENU_PLACEMENT_STYLES: Readonly<
  Record<'bottom' | 'top' | 'left' | 'right', Partial<CSSProperties>>
> = {
  bottom: {
    top: '100%',
    left: 0,
    marginTop: '4px',
  },
  top: {
    bottom: '100%',
    left: 0,
    marginBottom: '4px',
  },
  left: {
    top: 0,
    right: '100%',
    marginRight: '4px',
  },
  right: {
    top: 0,
    left: '100%',
    marginLeft: '4px',
  },
};

const MENU_ITEM_STYLE: CSSProperties = {
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--dropdown-item-text-color, #333)',
  backgroundColor: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  transition: 'background-color 0.15s ease',
};

const MENU_ITEM_DISABLED_STYLE: CSSProperties = {
  ...MENU_ITEM_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const MENU_ITEM_DIVIDER_STYLE: CSSProperties = {
  height: '1px',
  backgroundColor: 'var(--dropdown-divider-color, #e0e0e0)',
  margin: '4px 0',
  padding: 0,
  border: 'none',
};

const ARROW_STYLE: CSSProperties = {
  fontSize: '12px',
};

/* ============================================================================
 * 🎯 CORE DROPDOWN
 * ========================================================================== */

const CoreDropdownComponent = forwardRef<HTMLDivElement, CoreDropdownProps>(
  function CoreDropdownComponent(props, ref: Ref<HTMLDivElement>): JSX.Element {
    const {
      items,
      trigger,
      isOpen = false,
      onToggle,
      onSelect,
      onClose,
      placement = 'bottom',
      'data-component-id': componentId,
      style,
      className,
      'data-testid': testId,
      'aria-label': ariaLabel,
      ...rest
    } = props;

    /** Генерируем уникальные ID для ARIA */
    const fallbackId = useId();
    const dropdownId = componentId ?? fallbackId;
    const triggerId = `${dropdownId}-trigger`;
    const menuId = `${dropdownId}-menu`;

    /** Стили контейнера */
    const containerStyle: CSSProperties = useMemo(() => ({
      ...DROPDOWN_CONTAINER_STYLE,
      ...style,
    }), [style]);

    /** Стили меню с учетом placement */
    const menuStyle: CSSProperties = useMemo(() => ({
      ...MENU_STYLE,
      ...MENU_PLACEMENT_STYLES[placement],
    }), [placement]);

    /** Обработчик клика/нажатия на триггер */
    const handleTriggerClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>): void => {
        if (onToggle != null) {
          onToggle(!isOpen, event);
        }
      },
      [isOpen, onToggle],
    );

    /** Обработчик клавиатуры на триггере */
    const handleTriggerKeyDown = useCallback(
      (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          if (onToggle != null) {
            onToggle(!isOpen, event);
          }
        } else if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          if (onToggle != null) {
            onToggle(false, event);
          }
        }
      },
      [isOpen, onToggle],
    );

    /** Ref для меню для keyboard navigation */
    const menuRef = useRef<HTMLUListElement>(null);

    /** Получаем список доступных элементов меню (без dividers и disabled) */
    const getFocusableMenuItems = useCallback((): HTMLLIElement[] => {
      if (!menuRef.current) return [];
      const allItems = Array.from(
        menuRef.current.querySelectorAll<HTMLLIElement>(
          'li[role="menuitem"]:not([aria-disabled="true"])',
        ),
      );
      return allItems;
    }, []);

    /** Навигация по меню с помощью стрелок */
    const navigateMenu = useCallback(
      (direction: 'up' | 'down', currentElement: HTMLLIElement): void => {
        const focusableItems = getFocusableMenuItems();
        if (focusableItems.length === 0) return;

        const currentIndex = focusableItems.indexOf(currentElement);
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (direction === 'down') {
          nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1;
        }

        const nextItem = focusableItems[nextIndex];
        if (nextItem) {
          nextItem.focus();
        }
      },
      [getFocusableMenuItems],
    );

    /** Закрытие меню без события (используется после выбора элемента) */
    const closeMenu = useCallback((): void => {
      if (onClose != null) {
        onClose();
      }
      // Если onClose не передан, меню не закрывается автоматически
      // Родительский компонент должен управлять закрытием через onSelect или onClose
    }, [onClose]);

    /** Обработчик клика на элемент меню */
    const handleItemClick = useCallback(
      (itemId: string, event: MouseEvent<HTMLLIElement>): void => {
        if (onSelect != null) {
          onSelect(itemId, event);
        }
        // Закрываем меню после выбора
        closeMenu();
      },
      [onSelect, closeMenu],
    );

    /** Обработчик клавиатуры на элементе меню */
    const handleItemKeyDown = useCallback(
      (itemId: string, event: KeyboardEvent<HTMLLIElement>): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (onSelect != null) {
            onSelect(itemId, event);
          }
          // Закрываем меню после выбора
          closeMenu();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closeMenu();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          navigateMenu('down', event.currentTarget);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          navigateMenu('up', event.currentTarget);
        }
      },
      [onSelect, closeMenu, navigateMenu],
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

    /** Фокус на первый элемент меню при открытии */
    useLayoutEffect(() => {
      if (isOpen && menuRef.current) {
        const focusableItems = getFocusableMenuItems();
        const firstItem = focusableItems[0];
        if (firstItem) {
          // useLayoutEffect гарантирует фокус до paint для лучшего UX
          firstItem.focus();
        }
      }
    }, [isOpen, getFocusableMenuItems]);

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
        const itemStyle = isDisabled
          ? MENU_ITEM_DISABLED_STYLE
          : MENU_ITEM_STYLE;

        const itemId = `${dropdownId}-item-${item.id}`;

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
    }, [items, dropdownId, createItemClickHandler, createItemKeyDownHandler]);

    return (
      <div
        ref={ref}
        role='group'
        aria-label={ariaLabel ?? 'Dropdown menu'}
        data-component='CoreDropdown'
        data-placement={placement}
        data-testid={testId}
        style={containerStyle}
        className={className}
        {...rest}
      >
        <button
          type='button'
          id={triggerId}
          role='button'
          aria-haspopup='menu'
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
          style={TRIGGER_BUTTON_STYLE}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
        >
          {trigger}
          <span aria-hidden='true' style={ARROW_STYLE}>
            {isOpen ? '▲' : '▼'}
          </span>
        </button>
        {isOpen && (
          <ul
            ref={menuRef}
            id={menuId}
            role='menu'
            aria-labelledby={triggerId}
            style={menuStyle}
          >
            {menuItems}
          </ul>
        )}
      </div>
    );
  },
);

CoreDropdownComponent.displayName = 'CoreDropdown';

/**
 * Memoized CoreDropdown.
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как building-block для App-слоя
 * @note Keyboard navigation:
 * - Enter/Space/ArrowDown на триггере открывает меню
 * - Escape закрывает меню
 * - Enter/Space на элементе меню выбирает его
 * - ArrowUp/ArrowDown навигация по элементам меню
 * - Tab навигация работает стандартно
 * - Для сложных вложенных dropdowns можно добавить roving tabindex для полной ARIA compliance
 * @note Hover эффекты:
 * - Hover реализован через CSS :hover псевдокласс
 * - Не мутирует DOM напрямую
 * - Требует определения стилей в глобальных стилях или App слое
 * @note Закрытие меню:
 * - onToggle вызывается при явных действиях пользователя (клик на триггер, Escape)
 * - onClose вызывается после выбора элемента меню (без события)
 * - Если onClose не передан, меню не закрывается автоматически после выбора
 * - Родительский компонент должен управлять закрытием через onSelect или onClose
 */
export const Dropdown = memo(CoreDropdownComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreDropdown — чистый presentational primitive:
 * - Не управляет состоянием открытости меню
 * - Не содержит feature flags или telemetry
 * - Все клики и изменения обрабатываются App-слоем
 * - Поддерживает ref forwarding
 * - Полная поддержка ARIA для accessibility
 * Любая бизнес-логика (state management, tracking, feature flags)
 * реализуется в App слое.
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
