/**
 * @file @livai/ui-core/components — Композитные UI Компоненты
 * Публичный API пакета components.
 * Экспортирует все публичные компоненты и типы для композитных UI компонентов.
 */

/* ============================================================================
 * 🔔 TOAST — УВЕДОМЛЕНИЯ
 * ========================================================================== */

/**
 * Toast: компонент для отображения уведомлений.
 * Presentational primitive, управление жизненным циклом в App-слое.
 * @public
 */
export { type CoreToastProps, Toast, type ToastVariant } from './Toast.js';

/* ============================================================================
 * 💀 SKELETON — СКЕЛЕТОН ЗАГРУЗКИ
 * ========================================================================== */

/**
 * Skeleton: компонент скелетона для отображения состояния загрузки.
 * @public
 */
export { type CoreSkeletonProps, Skeleton, type SkeletonVariant } from './Skeleton.js';

/* ============================================================================
 * 🪟 MODAL — МОДАЛЬНОЕ ОКНО
 * ========================================================================== */

/**
 * Modal: компонент модального окна.
 * @public
 */
export { type CoreModalProps, Modal, type ModalVariant } from './Modal.js';

/* ============================================================================
 * 🍞 BREADCRUMBS — ХЛЕБНЫЕ КРОШКИ
 * ========================================================================== */

/**
 * Breadcrumbs: компонент навигационных хлебных крошек.
 * @public
 */
export {
  type BreadcrumbItem,
  Breadcrumbs,
  type CoreBreadcrumbsProps,
  DefaultSeparator,
} from './Breadcrumbs.js';

/* ============================================================================
 * 📑 TABS — ВКЛАДКИ
 * ========================================================================== */

/**
 * Tabs: компонент вкладок для переключения между разделами.
 * @public
 */
export { type CoreTabsProps, type TabItem, Tabs } from './Tabs.js';

/* ============================================================================
 * 📖 ACCORDION — АККОРДЕОН
 * ========================================================================== */

/**
 * Accordion: компонент аккордеона для раскрывающихся секций.
 * @public
 */
export { Accordion, type AccordionItem, type CoreAccordionProps } from './Accordion.js';

/* ============================================================================
 * 📅 DATE PICKER — ВЫБОР ДАТЫ
 * ========================================================================== */

/**
 * DatePicker: компонент для выбора даты.
 * @public
 */
export {
  type CalendarDay,
  type CalendarMonth,
  type CalendarWeek,
  type CoreDatePickerProps,
  DatePicker,
} from './DatePicker.js';

/* ============================================================================
 * 📎 FILE UPLOADER — ЗАГРУЗКА ФАЙЛОВ
 * ========================================================================== */

/**
 * FileUploader: компонент для загрузки файлов.
 * @public
 */
export {
  type CoreFileUploaderProps,
  type FileInfo,
  type FileStatus,
  FileUploader,
} from './FileUploader.js';

/* ============================================================================
 * 📊 SIDEBAR — БОКОВАЯ ПАНЕЛЬ
 * ========================================================================== */

/**
 * SideBar: компонент боковой панели навигации.
 * @public
 */
export {
  type CoreSideBarProps,
  SideBar,
  type SideBarItem,
  type SideBarPosition,
  type SideBarState,
} from './SideBar.js';

/* ============================================================================
 * 🔍 SEARCH BAR — ПОИСКОВАЯ СТРОКА
 * ========================================================================== */

/**
 * SearchBar: компонент поисковой строки.
 * @public
 */
export { type CoreSearchBarProps, SearchBar } from './SearchBar.js';

/* ============================================================================
 * ✅ CONFIRM DIALOG — ДИАЛОГ ПОДТВЕРЖДЕНИЯ
 * ========================================================================== */

/**
 * ConfirmDialog: компонент диалога подтверждения действия.
 * @public
 */
export { ConfirmDialog, type CoreConfirmDialogProps } from './ConfirmDialog.js';

/* ============================================================================
 * 🛡️ ERROR BOUNDARY — ГРАНИЦА ОШИБОК
 * ========================================================================== */

/**
 * ErrorBoundary: компонент границы ошибок для обработки ошибок React.
 * @public
 */
export {
  CoreErrorBoundary as ErrorBoundary,
  type CoreErrorBoundaryProps,
} from './ErrorBoundary.js';

/* ============================================================================
 * 👤 USER PROFILE DISPLAY — ОТОБРАЖЕНИЕ ПРОФИЛЯ
 * ========================================================================== */

/**
 * UserProfileDisplay: компонент для отображения профиля пользователя.
 * @public
 */
export {
  type CoreUserProfileDisplayProps,
  type UserProfileData,
  UserProfileDisplay,
} from './UserProfileDisplay.js';

/* ============================================================================
 * 🧭 NAVIGATION MENU ITEM — ЭЛЕМЕНТ НАВИГАЦИИ
 * ========================================================================== */

/**
 * NavigationMenuItem: компонент элемента навигационного меню.
 * @public
 */
export {
  type CoreNavigationMenuItemProps,
  NavigationMenuItem,
  type NavigationMenuItemData,
} from './NavigationMenuItem.js';

/* ============================================================================
 * 🌐 LANGUAGE SELECTOR — ВЫБОР ЯЗЫКА
 * ========================================================================== */

/**
 * LanguageSelector: компонент для выбора языка интерфейса.
 * @public
 */
export {
  type CoreLanguageSelectorProps,
  type LanguageData,
  LanguageSelector,
} from './LanguageSelector.js';

/* ============================================================================
 * 💬 SUPPORT BUTTON — КНОПКА ПОДДЕРЖКИ
 * ========================================================================== */

/**
 * SupportButton: компонент кнопки поддержки.
 * @public
 */
export {
  type CoreSupportButtonProps,
  SupportButton,
  type SupportButtonSize,
  type SupportButtonVariant,
} from './SupportButton.js';
