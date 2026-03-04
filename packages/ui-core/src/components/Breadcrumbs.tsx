/**
 * @file packages/ui-core/src/components/Breadcrumbs.tsx
 * ============================================================================
 * 🔵 CORE UI BREADCRUMBS — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения хлебных крошек (Breadcrumbs)
 * - Полностью детерминированный, side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление навигацией или состояниями
 * Управление:
 * - Контентом и событиями управляет App-слой
 */

import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX, MouseEvent, ReactNode, Ref } from 'react';

import type { UIDataAttributes, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/**
 * Дефолтный разделитель для breadcrumbs.
 * Используется когда separator не передан явно.
 * Содержит aria-hidden для accessibility.
 */
export const DefaultSeparator: ReactNode = <span aria-hidden='true'>›</span>;

/** Элемент хлебных крошек */
export type BreadcrumbItem = Readonly<{
  /** Отображаемый текст */
  label: string;

  /** Ссылка / href элемента */
  href?: string;

  /** Опциональная callback-функция при клике */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;

  /** Может быть disabled */
  disabled?: boolean;

  /** Уникальный идентификатор для React key */
  id?: string;

  /** Дополнительные data-атрибуты */
  data?: UIDataAttributes;
}>;

export type CoreBreadcrumbsProps = Readonly<
  Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    /** Список элементов крошек */
    items: readonly BreadcrumbItem[];

    /**
     * Разделитель между элементами.
     * Если передана строка — автоматически оборачивается в span с SEPARATOR_STYLE.
     * Если передан JSX — используется как есть и должен сам включать стили (SEPARATOR_STYLE не применяется).
     */
    separator?: ReactNode;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
    /**
     * Вспомогательные атрибуты для тестирования (не часть публичного API).
     * data-index: индекс элемента в массиве items (для e2e-тестов).
     */
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const BREADCRUMBS_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  listStyle: 'none',
  padding: 0,
  margin: 0,
};

const BREADCRUMB_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const BREADCRUMB_LINK_STYLE: CSSProperties = {
  color: 'var(--text-color, #111)',
  textDecoration: 'none',
  cursor: 'pointer',
  opacity: 1,
};

const BREADCRUMB_SPAN_STYLE: CSSProperties = {
  color: 'var(--text-color, #111)',
  cursor: 'default',
  opacity: 1,
};

const BREADCRUMB_DISABLED_STYLE: CSSProperties = {
  opacity: 0.5,
  cursor: 'default',
  pointerEvents: 'none',
};

const SEPARATOR_STYLE: CSSProperties = {
  margin: '0 8px',
  userSelect: 'none',
  color: 'var(--breadcrumb-separator-color, #666)',
};

const ORDERED_LIST_STYLE: CSSProperties = {
  display: 'flex',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

/* ============================================================================
 * 🎯 CORE BREADCRUMBS
 * ========================================================================== */

const CoreBreadcrumbsComponent = forwardRef<HTMLElement, CoreBreadcrumbsProps>(
  function CoreBreadcrumbsComponent(props, ref: Ref<HTMLElement>): JSX.Element | null {
    const {
      items,
      separator = DefaultSeparator,
      style,
      className,
      'data-testid': testId,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...rest
    } = props;

    const combinedContainerStyle: CSSProperties = useMemo(() => ({
      ...BREADCRUMBS_CONTAINER_STYLE,
      ...style,
    }), [style]);

    const renderedItems = useMemo(() => {
      return items.map((item, index) => {
        const isLast = index === items.length - 1;

        const linkStyle: CSSProperties = item.disabled === true
          ? { ...BREADCRUMB_LINK_STYLE, ...BREADCRUMB_DISABLED_STYLE }
          : BREADCRUMB_LINK_STYLE;

        const spanStyle: CSSProperties = item.disabled === true
          ? { ...BREADCRUMB_SPAN_STYLE, ...BREADCRUMB_DISABLED_STYLE }
          : BREADCRUMB_SPAN_STYLE;

        const shouldRenderAsLink = item.href != null && item.href !== '' && item.disabled !== true;
        const handleClick = item.disabled === true ? undefined : item.onClick;

        // Оборачиваем строковый separator в span с SEPARATOR_STYLE
        const separatorContent = typeof separator === 'string'
          ? <span style={SEPARATOR_STYLE} aria-hidden='true'>{separator}</span>
          : separator;

        const content = shouldRenderAsLink
          ? (
            <a
              href={item.href}
              style={linkStyle}
              onClick={handleClick}
              aria-current={isLast ? 'page' : undefined}
              {...item.data}
            >
              {item.label}
            </a>
          )
          : (
            <span
              style={spanStyle}
              aria-current={isLast ? 'page' : undefined}
              {...item.data}
            >
              {item.label}
            </span>
          );

        const key = item.id ?? `${item.label}-${index}`;

        return (
          <li
            key={key}
            style={BREADCRUMB_ITEM_STYLE}
            data-index={index} // Для удобства e2e-тестов: индекс элемента в массиве
          >
            {content}
            {!isLast && separatorContent}
          </li>
        );
      });
    }, [items, separator]);

    return (
      <nav
        ref={ref}
        aria-label={ariaLabelledBy != null ? undefined : (ariaLabel ?? 'Breadcrumb')}
        aria-labelledby={ariaLabelledBy}
        data-component='CoreBreadcrumbs'
        data-testid={testId}
        style={combinedContainerStyle}
        className={className}
        {...rest}
      >
        <ol style={ORDERED_LIST_STYLE}>
          {renderedItems}
        </ol>
      </nav>
    );
  },
);

CoreBreadcrumbsComponent.displayName = 'CoreBreadcrumbs';

/**
 * Memoized CoreBreadcrumbs.
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как building-block для App-слоя
 */
export const Breadcrumbs = memo(CoreBreadcrumbsComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreBreadcrumbs — чистый presentational primitive:
 * - Не управляет навигацией
 * - Не содержит feature flags или telemetry
 * - Все клики и href обрабатываются App-слоем
 * - Поддерживает ref forwarding
 * Любая бизнес-логика (routing, active state, tracking) реализуется в App слое.
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
