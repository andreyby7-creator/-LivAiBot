/**
 * @file packages/ui-core/src/components/Accordion.tsx
 * ============================================================================
 * 🔵 CORE UI ACCORDION — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для отображения аккордеона
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием открытых элементов
 * - Таймеров или анимаций
 *
 * Управление:
 * - Открытыми элементами и событиями управляет App-слой
 */

import { forwardRef, memo, useCallback, useId, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX, MouseEvent, ReactNode, Ref } from 'react';

import type { UIDataAttributes, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Элемент аккордеона */
export type AccordionItem = Readonly<{
  /** Уникальный идентификатор элемента */
  id: string;

  /** Заголовок элемента */
  header: string;

  /** Контент элемента (панель) */
  content: ReactNode;

  /** Может быть disabled */
  disabled?: boolean;

  /** Дополнительные data-атрибуты */
  data?: UIDataAttributes;
}>;

export type CoreAccordionProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> & {
    /** Список элементов аккордеона */
    items: readonly AccordionItem[];

    /** ID открытых элементов (multiple mode) */
    openItemIds?: readonly string[];

    /** ID открытого элемента (single mode, имеет приоритет над openItemIds) */
    openItemId?: string;

    /** Callback при изменении открытых элементов */
    onChange?: (itemId: string, event: MouseEvent<HTMLButtonElement>) => void;

    /** Режим: single (только один открыт) или multiple (несколько открыты) */
    mode?: 'single' | 'multiple';

    /** Test ID для автотестов */
    'data-testid'?: UITestId;

    /** Уникальный идентификатор компонента для генерации уникальных IDs */
    'data-component-id'?: string;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const ACCORDION_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
};

const ACCORDION_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderBottom: '1px solid var(--accordion-border-color, #e0e0e0)',
};

const ACCORDION_HEADER_STYLE: CSSProperties = {
  padding: '16px 24px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--accordion-text-color, #333)',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: '500',
  textAlign: 'left',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
};

const ACCORDION_HEADER_OPEN_STYLE: CSSProperties = {
  ...ACCORDION_HEADER_STYLE,
  color: 'var(--accordion-active-text-color, #007bff)',
  backgroundColor: 'var(--accordion-active-bg-color, #f8f9fa)',
};

const ACCORDION_HEADER_DISABLED_STYLE: CSSProperties = {
  ...ACCORDION_HEADER_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const ACCORDION_PANEL_STYLE: CSSProperties = {
  padding: '16px 24px',
  color: 'var(--accordion-content-color, #666)',
  fontSize: '14px',
  lineHeight: '1.5',
};

const ACCORDION_ICON_STYLE: CSSProperties = {
  marginLeft: '12px',
  transition: 'transform 0.2s ease',
  fontSize: '12px',
  color: 'inherit',
};

const ACCORDION_ICON_OPEN_STYLE: CSSProperties = {
  ...ACCORDION_ICON_STYLE,
  transform: 'rotate(180deg)',
};

/* ============================================================================
 * 🎯 CORE ACCORDION
 * ========================================================================== */

const CoreAccordionComponent = forwardRef<HTMLDivElement, CoreAccordionProps>(
  function CoreAccordionComponent(props, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const {
      items,
      openItemId,
      openItemIds,
      onChange,
      mode = 'single',
      style,
      className,
      'data-testid': testId,
      'data-component-id': componentId,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...rest
    } = props;

    /** Определяем открытые элементы */
    const openIdsSet = useMemo(() => {
      if (mode === 'single' && openItemId !== undefined) {
        return new Set([openItemId]);
      }
      if (mode === 'multiple' && openItemIds !== undefined) {
        return new Set(openItemIds);
      }
      return new Set<string>();
    }, [mode, openItemId, openItemIds]);

    /** SSR-safe уникальный ID для fallback (если нет componentId/testId) */
    const fallbackId = useId();

    /** Префикс для уникальных IDs (используется componentId, testId или fallbackId) */
    const idPrefix = useMemo(() => {
      return componentId ?? testId ?? fallbackId;
    }, [componentId, testId, fallbackId]);

    /** Обработчик клика для всех элементов - читает itemId из data-атрибута */
    const handleItemClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>): void => {
        if (onChange == null) return;
        const itemId = event.currentTarget.getAttribute('data-accordion-item-id');
        if (itemId != null) {
          onChange(itemId, event);
        }
      },
      [onChange],
    );

    const renderedItems = useMemo(() => {
      return items.map((item) => {
        const isOpen = openIdsSet.has(item.id);
        const isDisabled = item.disabled === true;

        const headerStyle: CSSProperties = isDisabled
          ? ACCORDION_HEADER_DISABLED_STYLE
          : isOpen
          ? ACCORDION_HEADER_OPEN_STYLE
          : ACCORDION_HEADER_STYLE;

        const iconStyle: CSSProperties = isOpen
          ? ACCORDION_ICON_OPEN_STYLE
          : ACCORDION_ICON_STYLE;

        const handleClick = !isDisabled ? handleItemClick : undefined;

        const headerId = `${idPrefix}-header-${item.id}`;
        const panelId = `${idPrefix}-panel-${item.id}`;

        return (
          <div key={item.id} style={ACCORDION_ITEM_STYLE}>
            <button
              type='button'
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-disabled={isDisabled}
              id={headerId}
              data-accordion-item-id={item.id}
              disabled={isDisabled}
              style={headerStyle}
              onClick={handleClick}
              {...item.data}
            >
              <span>{item.header}</span>
              <span style={iconStyle}>▼</span>
            </button>
            {isOpen && (
              <div
                role='region'
                id={panelId}
                aria-labelledby={headerId}
                tabIndex={0}
                style={ACCORDION_PANEL_STYLE}
              >
                {item.content}
              </div>
            )}
          </div>
        );
      });
    }, [items, openIdsSet, handleItemClick, idPrefix]);

    const combinedContainerStyle: CSSProperties = useMemo(() => ({
      ...ACCORDION_CONTAINER_STYLE,
      ...style,
    }), [style]);

    return (
      <div
        ref={ref}
        role='region'
        aria-label={ariaLabelledBy != null ? undefined : (ariaLabel ?? 'Accordion')}
        aria-labelledby={ariaLabelledBy}
        data-component='CoreAccordion'
        data-mode={mode}
        data-testid={testId}
        {...(componentId !== undefined && { 'data-component-id': componentId })}
        style={combinedContainerStyle}
        className={className}
        {...rest}
      >
        {renderedItems}
      </div>
    );
  },
);

CoreAccordionComponent.displayName = 'CoreAccordion';

/**
 * Memoized CoreAccordion.
 *
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как building-block для App-слоя
 */
export const Accordion = memo(CoreAccordionComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreAccordion — чистый presentational primitive:
 *
 * - Не управляет состоянием открытых элементов
 * - Не содержит feature flags или telemetry
 * - Все клики и изменения обрабатываются App-слоем
 * - Поддерживает ref forwarding
 *
 * Любая бизнес-логика (routing, open state, tracking) реализуется в App слое.
 *
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
