/**
 * @file @livai/ui-core — Public API для UI Core пакета
 * Публичный API пакета @livai/ui-core.
 * Экспортирует все публичные компоненты, типы и утилиты для UI примитивов и компонентов.
 * Tree-shakeable: все named exports остаются, импорты будут по нужным компонентам.
 * Принцип:
 * - только UI-компоненты и примитивы (без бизнес-логики и без контрактов API)
 * - без тяжёлых инфраструктурных зависимостей (db/sql/ai и т.п.)
 * - разделение на примитивы (primitives) и композитные компоненты (components)
 */

/* ============================================================================
 * 🧩 PRIMITIVES — UI ПРИМИТИВЫ
 * ========================================================================== */

/**
 * Primitives подпакет: базовые UI примитивы.
 * Включает Button, Input, Textarea, Select, Checkbox, Radio, Toggle, Icon,
 * Avatar, Badge, Tooltip, Divider, Card, FormField, Dialog, Form,
 * LoadingSpinner, Dropdown, ContextMenu, StatusIndicator.
 * @public
 */
export * from './primitives/index.js';

/* ============================================================================
 * 🧩 COMPONENTS — КОМПОЗИТНЫЕ UI КОМПОНЕНТЫ
 * ========================================================================== */

/**
 * Components подпакет: композитные UI компоненты.
 * Включает Toast, Skeleton, Modal, Breadcrumbs, Tabs, Accordion, DatePicker,
 * FileUploader, SideBar, SearchBar, ConfirmDialog, ErrorBoundary,
 * UserProfileDisplay, NavigationMenuItem, LanguageSelector, SupportButton.
 * @public
 */
export * from './components/index.js';

/* ============================================================================
 * 🧬 TYPES — UI ТИПЫ
 * ========================================================================== */

/**
 * Types подпакет: базовые UI типы и контракты.
 * Включает типы для видимости, интерактивности, design tokens, accessibility,
 * состояния компонентов и базовые контракты.
 * @public
 */
export * from './types/index.js';
