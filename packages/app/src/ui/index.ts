/**
 * @file packages/app/src/ui — UI Components
 *
 * Публичный API пакета ui.
 * Экспортирует все публичные UI компоненты и их типы.
 */

/* ============================================================================
 * 🧩 PRIMITIVES — БАЗОВЫЕ КОМПОНЕНТЫ
 * ========================================================================== */

/**
 * Button: кнопка с вариантами стилей и размерами.
 *
 * @public
 */
export {
  type AppButtonProps,
  Button,
  type ButtonMapCoreProps,
  type ButtonUiFeatureFlags,
  type ButtonWrapperProps,
} from './button.js';

/**
 * Input: текстовое поле ввода.
 *
 * @public
 */
export {
  type AppInputProps,
  Input,
  type InputMapCoreProps,
  type InputTelemetryEvent,
  type InputTelemetryPayload,
  type InputUiFeatureFlags,
  type InputWrapperProps,
} from './input.js';

/**
 * Textarea: многострочное текстовое поле ввода.
 *
 * @public
 */
export {
  type AppTextareaProps,
  Textarea,
  type TextareaMapCoreProps,
  type TextareaUiFeatureFlags,
  type TextareaWrapperProps,
} from './textarea.js';

/**
 * Select: выпадающий список.
 *
 * @public
 */
export {
  type AppSelectProps,
  Select,
  type SelectMapCoreProps,
  type SelectUiFeatureFlags,
  type SelectWrapperProps,
} from './select.js';

/**
 * Checkbox: чекбокс.
 *
 * @public
 */
export {
  type AppCheckboxProps,
  Checkbox,
  type CheckboxMapCoreProps,
  type CheckboxUiFeatureFlags,
  type CheckboxWrapperProps,
} from './checkbox.js';

/**
 * Radio: радиокнопка.
 *
 * @public
 */
export {
  type AppRadioProps,
  Radio,
  type RadioMapCoreProps,
  type RadioUiFeatureFlags,
  type RadioWrapperProps,
} from './radio.js';

/**
 * Toggle: переключатель.
 *
 * @public
 */
export {
  type AppToggleProps,
  Toggle,
  type ToggleMapCoreProps,
  type ToggleUiFeatureFlags,
  type ToggleWrapperProps,
} from './toggle.js';

/**
 * Icon: компонент для отображения иконок.
 *
 * @public
 */
export {
  type AppIconProps,
  Icon,
  type IconMapCoreProps,
  type IconUiFeatureFlags,
  type IconWrapperProps,
} from './icon.js';

/**
 * Avatar: компонент для отображения аватара.
 *
 * @public
 */
export {
  type AppAvatarProps,
  Avatar,
  type AvatarMapCoreProps,
  type AvatarUiFeatureFlags,
  type AvatarWrapperProps,
} from './avatar.js';

/**
 * Badge: компонент для отображения бейджа.
 *
 * @public
 */
export {
  type AppBadgeProps,
  Badge,
  type BadgeMapCoreProps,
  type BadgeUiFeatureFlags,
  type BadgeWrapperProps,
} from './badge.js';

/**
 * Tooltip: компонент для отображения подсказок.
 *
 * @public
 */
export {
  type AppTooltipProps,
  Tooltip,
  type TooltipMapCoreProps,
  type TooltipUiFeatureFlags,
  type TooltipWrapperProps,
} from './tooltip.js';

/**
 * Divider: компонент-разделитель.
 *
 * @public
 */
export {
  type AppDividerProps,
  Divider,
  type DividerMapCoreProps,
  type DividerUiFeatureFlags,
  type DividerWrapperProps,
} from './divider.js';

/**
 * Card: компонент карточки.
 *
 * @public
 */
export {
  type AppCardProps,
  Card,
  type CardMapCoreProps,
  type CardUiFeatureFlags,
  type CardWrapperProps,
} from './card.js';

/**
 * Dialog: компонент диалогового окна.
 *
 * @public
 */
export { type AppDialogProps, Dialog } from './dialog.js';

/**
 * Form: компонент формы.
 *
 * @public
 */
export { type AppFormProps, Form } from './form.js';

/**
 * LoadingSpinner: компонент индикатора загрузки.
 *
 * @public
 */
export {
  type AppLoadingSpinnerProps,
  LoadingSpinner,
  type LoadingSpinnerMapCoreProps,
  type LoadingSpinnerUiFeatureFlags,
  type LoadingSpinnerWrapperProps,
} from './loading-spinner.js';

/**
 * Dropdown: компонент выпадающего меню.
 *
 * @public
 */
export {
  type AppDropdownProps,
  Dropdown,
  type DropdownMapCoreProps,
  type DropdownUiFeatureFlags,
  type DropdownWrapperProps,
} from './dropdown.js';

/**
 * ContextMenu: компонент контекстного меню.
 *
 * @public
 */
export {
  type AppContextMenuProps,
  ContextMenu,
  type ContextMenuMapCoreProps,
  type ContextMenuUiFeatureFlags,
  type ContextMenuWrapperProps,
} from './context-menu.js';

/**
 * StatusIndicator: компонент индикатора статуса.
 *
 * @public
 */
export {
  type AppStatusIndicatorProps,
  StatusIndicator,
  type StatusIndicatorMapCoreProps,
  type StatusIndicatorUiFeatureFlags,
  type StatusIndicatorWrapperProps,
} from './status-indicator.js';

/* ============================================================================
 * 🧩 COMPONENTS — КОМПОЗИТНЫЕ КОМПОНЕНТЫ
 * ========================================================================== */

/**
 * Toast: компонент для отображения уведомлений.
 *
 * @public
 */
export {
  type AppToastProps,
  Toast,
  type ToastMapCoreProps,
  type ToastUiFeatureFlags,
  type ToastWrapperProps,
} from './toast.js';

/**
 * Skeleton: компонент скелетона загрузки.
 *
 * @public
 */
export {
  type AppSkeletonProps,
  Skeleton,
  type SkeletonMapCoreProps,
  type SkeletonUiFeatureFlags,
  type SkeletonWrapperProps,
} from './skeleton.js';

/**
 * SkeletonGroup: группа скелетонов.
 *
 * @public
 */
export { type AppSkeletonGroupProps, SkeletonGroup } from './skeleton-group.js';

/**
 * Modal: компонент модального окна.
 *
 * @public
 */
export {
  type AppModalProps,
  Modal,
  type ModalMapCoreProps,
  type ModalUiFeatureFlags,
  type ModalWrapperProps,
} from './modal.js';

/**
 * Breadcrumbs: компонент навигационных хлебных крошек.
 *
 * @public
 */
export {
  type AppBreadcrumbItem,
  type AppBreadcrumbsProps,
  Breadcrumbs,
  type BreadcrumbsMapCoreProps,
  type BreadcrumbsUiFeatureFlags,
  type BreadcrumbsWrapperProps,
} from './breadcrumbs.js';

/**
 * Tabs: компонент вкладок.
 *
 * @public
 */
export {
  type AppTabsProps,
  Tabs,
  type TabsMapCoreProps,
  type TabsUiFeatureFlags,
  type TabsWrapperProps,
} from './tabs.js';

/**
 * Accordion: компонент аккордеона.
 *
 * @public
 */
export {
  Accordion,
  type AccordionMapCoreProps,
  type AccordionUiFeatureFlags,
  type AccordionWrapperProps,
  type AppAccordionProps,
} from './accordion.js';

/**
 * DatePicker: компонент для выбора даты.
 *
 * @public
 */
export {
  type AppDatePickerProps,
  DatePicker,
  type DatePickerMapCoreProps,
  type DatePickerUiFeatureFlags,
  type DatePickerWrapperProps,
} from './date-picker.js';

/**
 * FileUploader: компонент для загрузки файлов.
 *
 * @public
 */
export { type AppFileUploaderProps, FileUploader } from './file-uploader.js';

/**
 * SideBar: компонент боковой панели.
 *
 * @public
 */
export {
  type AppSideBarProps,
  SideBar,
  type SidebarMapCoreProps,
  type SidebarUiFeatureFlags,
  type SidebarWrapperProps,
} from './sidebar.js';

/**
 * SearchBar: компонент поисковой строки.
 *
 * @public
 */
export { type AppSearchBarProps, SearchBar } from './search-bar.js';

/**
 * ConfirmDialog: компонент диалога подтверждения.
 *
 * @public
 */
export {
  type AppConfirmDialogProps,
  ConfirmDialog,
  type ConfirmDialogMapCoreProps,
  type ConfirmDialogUiFeatureFlags,
  type ConfirmDialogWrapperProps,
} from './confirm-dialog.js';

/**
 * ErrorBoundary: компонент границы ошибок.
 *
 * @public
 */
export {
  type AppErrorBoundaryProps,
  ErrorBoundary,
  type ErrorBoundaryMapCoreProps,
  type ErrorBoundaryUiFeatureFlags,
  type ErrorBoundaryWrapperProps,
} from './error-boundary.js';

/**
 * UserProfileDisplay: компонент для отображения профиля пользователя.
 *
 * @public
 */
export {
  type AppUserProfileDisplayProps,
  UserProfileDisplay,
  type UserProfileDisplayMapCoreProps,
  type UserProfileDisplayUiFeatureFlags,
  type UserProfileDisplayWrapperProps,
} from './user-profile-display.js';

/**
 * NavigationMenuItem: компонент элемента навигационного меню.
 *
 * @public
 */
export {
  type AppNavigationMenuItemProps,
  NavigationMenuItem,
  type NavigationMenuItemMapCoreProps,
  type NavigationMenuItemUiFeatureFlags,
  type NavigationMenuItemWrapperProps,
} from './navigation-menu-item.js';

/**
 * LanguageSelector: компонент для выбора языка.
 *
 * @public
 */
export {
  type AppLanguageSelectorProps,
  LanguageSelector,
  type LanguageSelectorMapCoreProps,
  type LanguageSelectorUiFeatureFlags,
  type LanguageSelectorWrapperProps,
} from './language-selector.js';

/**
 * SupportButton: компонент кнопки поддержки.
 *
 * @public
 */
export { type AppSupportButtonProps, SupportButton } from './support-button.js';
