/**
 * @file @livai/ui-core/types — UI Типы
 * Публичный API пакета types.
 * Экспортирует все публичные типы для UI компонентов и контрактов.
 */

/* ============================================================================
 * 🧬 BASE PRIMITIVES — БАЗОВЫЕ ПРИМИТИВЫ
 * ========================================================================== */

/**
 * Базовые примитивы для UI компонентов.
 * Включает типы для видимости, интерактивности, data-атрибутов, test id.
 * @public
 */
export type {
  CoreUIBaseProps,
  CoreUIComponentContract,
  UIAlign,
  UIAriaAttributes,
  UIColor,
  UIDataAttributes,
  UIDiagnosticsAttributes,
  UIDuration,
  UIFlexDirection,
  UIInteractive,
  UIJustify,
  UIOpacity,
  UIOrientation,
  UIRadius,
  UISemanticStatus,
  UISize,
  UIState,
  UITestId,
  UIThickness,
  UIVisibility,
  UIZIndex,
} from './ui.js';
