/**
 * @file @livai/ui-core — атомарные UI компоненты и примитивы.
 *
 * Принцип:
 * - только UI-компоненты и примитивы (без бизнес-логики и без контрактов API)
 * - без тяжёлых инфраструктурных зависимостей (db/sql/ai и т.п.)
 * - разделение на примитивы (primitives) и композитные компоненты (components)
 */

/* ============================================================================
 * 🧩 PRIMITIVES — UI ПРИМИТИВЫ
 * ========================================================================== */

export * from './primitives/avatar.js';
export * from './primitives/badge.js';
export * from './primitives/button.js';
export * from './primitives/checkbox.js';
export * from './primitives/context-menu.js';
export * from './primitives/dialog.js';
export * from './primitives/divider.js';
export * from './primitives/dropdown.js';
export * from './primitives/form-field.js';
export * from './primitives/form.js';
export * from './primitives/icon.js';
export * from './primitives/input.js';
export * from './primitives/loading-spinner.js';
export * from './primitives/radio.js';
export * from './primitives/select.js';
export * from './primitives/status-indicator.js';
export * from './primitives/textarea.js';
export * from './primitives/toggle.js';
export * from './primitives/tooltip.js';

/* ============================================================================
 * 🧩 COMPONENTS — КОМПОЗИТНЫЕ UI КОМПОНЕНТЫ
 * ========================================================================== */

export * from './components/Accordion.js';
export * from './components/Breadcrumbs.js';
export * from './components/DatePicker.js';
export * from './components/Modal.js';
export * from './components/Skeleton.js';
export * from './components/Tabs.js';
export * from './components/Toast.js';

/* ============================================================================
 * 🧬 TYPES — UI ТИПЫ
 * ========================================================================== */

export * from './types/ui.js';
