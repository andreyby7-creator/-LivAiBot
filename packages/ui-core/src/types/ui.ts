/**
 * @file packages/ui-core/src/types/ui.ts
 * ============================================================================
 * 🔵 CORE UI TYPES — БАЗОВЫЕ UI ТИПЫ И КОНТРАКТЫ
 * ============================================================================
 * Назначение:
 * - Единая точка истины для UI-типов в ui-core
 * - Типовой фундамент для всех UI-примитивов, компонентов и layout-ов
 * - Абсолютно side-effect free
 * Принципы:
 * - Framework-agnostic (не привязан к React напрямую)
 * - Максимально переиспользуемый
 * - Строго детерминированный
 * - Поддержка design-system, accessibility и theming
 * Этот файл:
 * - Не содержит логики
 * - Не зависит от app-слоя
 * - Не импортирует DOM напрямую (кроме стандартных TS типов)
 */

/* ============================================================================
 * 🧬 BASE PRIMITIVES
 * ========================================================================== */

/**
 * Универсальный флаг видимости UI элемента.
 * Используется во всех Core UI примитивах.
 */
export type UIVisibility = boolean;

/** Универсальный флаг интерактивности. */
export type UIInteractive = boolean;

/**
 * Универсальный тип для HTML data-* атрибутов.
 * Полезен для telemetry, тестирования и диагностики.
 */
export type UIDataAttributes = Readonly<
  Record<`data-${string}`, string | number | boolean | undefined>
>;

/** Стандартный тип для test id. */
export type UITestId = string;

/* ============================================================================
 * 🎨 DESIGN TOKENS
 * ========================================================================== */

/**
 * CSS размер.
 * Поддерживает px, %, em, rem, vh, vw и кастомные calc/var выражения.
 * Пример:
 * - "12px"
 * - "1rem"
 * - "50%"
 * - "var(--spacing-md)"
 * - "calc(100% - 16px)"
 */
export type UISize = string;

/** CSS цвет. Строка, совместимая с любым валидным CSS color. */
export type UIColor = string;

/** CSS радиус скругления. */
export type UIRadius = UISize;

/** CSS толщина (границы, divider и т.п.). */
export type UIThickness = UISize;

/** CSS z-index. */
export type UIZIndex = number;

/** CSS прозрачность (0..1). */
export type UIOpacity = number;

/** Длительность анимаций и переходов (ms, s, var). */
export type UIDuration = string;

/**
 * Семантические статусы компонентов для унификации variant по всей системе.
 * Используется в Modal, Toast, Badge и других компонентах.
 */
export type UISemanticStatus = 'default' | 'success' | 'warning' | 'error' | 'info';

/* ============================================================================
 * 📐 LAYOUT & ORIENTATION
 * ========================================================================== */

/** Базовая ориентация UI элементов. */
export type UIOrientation = 'horizontal' | 'vertical';

/** Выравнивание по главной оси. */
export type UIAlign = 'start' | 'center' | 'end' | 'stretch';

/** Распределение по оси. */
export type UIJustify = 'start' | 'center' | 'end' | 'space-between' | 'space-around';

/** Направление флекса. */
export type UIFlexDirection = 'row' | 'column';

/* ============================================================================
 * 🧩 STATE & STATUS
 * ========================================================================== */

/** Универсальное состояние UI компонента. */
export type UIState = 'idle' | 'active' | 'disabled' | 'loading';

/**
 * Статус семантического значения.
 * Используется для Toast, Badge, Alert и т.п.
 * Объединено с определением выше для полноты.
 */

/* ============================================================================
 * 🧠 ACCESSIBILITY (A11Y)
 * ========================================================================== */

/**
 * Минимальный набор ARIA атрибутов,
 * которые могут понадобиться любому UI компоненту.
 */
export type UIAriaAttributes = Readonly<{
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-hidden'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
}>;

/* ============================================================================
 * 🔗 UI COMPONENT CONTRACTS
 * ========================================================================== */

/**
 * Базовый контракт для всех UI компонентов ui-core.
 * Используется как building-block для:
 * - CoreDividerProps
 * - CoreToastProps
 * - Button
 * - Modal
 * - Tooltip
 */
export type CoreUIComponentContract = Readonly<{
  /** Управление видимостью. Никогда не содержит бизнес-логики. */
  visible?: UIVisibility;

  /** Test id для автотестов. */
  'data-testid'?: UITestId;
}>;

/* ============================================================================
 * 🧪 DIAGNOSTICS & DEBUGGING
 * ========================================================================== */

/**
 * Атрибуты для диагностики UI компонентов.
 * Используются для:
 * - DevTools
 * - Debug overlays
 * - E2E тестов
 */
export type UIDiagnosticsAttributes = Readonly<{
  'data-component'?: string;
  'data-variant'?: string;
  'data-state'?: UIState;
}>;

/* ============================================================================
 * 🏗 COMPOSITION
 * ========================================================================== */

/**
 * Композитный тип для стандартных UI атрибутов.
 * Можно использовать как базу для props любого Core UI компонента.
 */
export type CoreUIBaseProps = Readonly<
  & CoreUIComponentContract
  & UIAriaAttributes
  & UIDiagnosticsAttributes
  & UIDataAttributes
>;

/* ============================================================================
 * 📌 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * Архитектурные гарантии этого файла:
 * 1. UI типы централизованы
 * 2. Core UI не знает ничего об App уровне
 * 3. App слой может свободно расширять типы,
 *    но не модифицировать core-контракты
 * 4. Этот файл является "design contract" между всеми UI примитивами
 * Любое расширение:
 * - только через добавление новых типов
 * - без ломающих изменений
 */
