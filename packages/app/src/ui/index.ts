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
  Button,
  type ButtonUiFeatureFlags,
  type ButtonWrapperProps,
  type ButtonMapCoreProps,
  type AppButtonProps,
} from './button.js';

/**
 * Input: текстовое поле ввода.
 *
 * @public
 */
export {
  Input,
  type InputUiFeatureFlags,
  type InputWrapperProps,
  type InputMapCoreProps,
  type InputTelemetryPayload,
  type InputTelemetryEvent,
  type AppInputProps,
} from './input.js';

/**
 * Textarea: многострочное текстовое поле ввода.
 *
 * @public
 */
export {
  Textarea,
  type TextareaUiFeatureFlags,
  type TextareaWrapperProps,
  type TextareaMapCoreProps,
  type AppTextareaProps,
} from './textarea.js';

/**
 * Select: выпадающий список.
 *
 * @public
 */
export {
  Select,
  type SelectUiFeatureFlags,
  type SelectWrapperProps,
  type SelectMapCoreProps,
  type AppSelectProps,
} from './select.js';

/**
 * Checkbox: чекбокс.
 *
 * @public
 */
export {
  Checkbox,
  type CheckboxUiFeatureFlags,
  type CheckboxWrapperProps,
  type CheckboxMapCoreProps,
  type AppCheckboxProps,
} from './checkbox.js';

/**
 * Radio: радиокнопка.
 *
 * @public
 */
export {
  Radio,
  type RadioUiFeatureFlags,
  type RadioWrapperProps,
  type RadioMapCoreProps,
  type AppRadioProps,
} from './radio.js';

/**
 * Toggle: переключатель.
 *
 * @public
 */
export {
  Toggle,
  type ToggleUiFeatureFlags,
  type ToggleWrapperProps,
  type ToggleMapCoreProps,
  type AppToggleProps,
} from './toggle.js';

/**
 * Icon: компонент для отображения иконок.
 *
 * @public
 */
export {
  Icon,
  type IconUiFeatureFlags,
  type IconWrapperProps,
  type IconMapCoreProps,
  type AppIconProps,
} from './icon.js';

/**
 * Avatar: компонент для отображения аватара.
 *
 * @public
 */
export {
  Avatar,
  type AvatarUiFeatureFlags,
  type AvatarWrapperProps,
  type AvatarMapCoreProps,
  type AppAvatarProps,
} from './avatar.js';

/**
 * Badge: компонент для отображения бейджа.
 *
 * @public
 */
export {
  Badge,
  type BadgeUiFeatureFlags,
  type BadgeWrapperProps,
  type BadgeMapCoreProps,
  type AppBadgeProps,
} from './badge.js';

/**
 * Tooltip: компонент для отображения подсказок.
 *
 * @public
 */
export {
  Tooltip,
  type TooltipUiFeatureFlags,
  type TooltipWrapperProps,
  type TooltipMapCoreProps,
  type AppTooltipProps,
} from './tooltip.js';

/**
 * Divider: компонент-разделитель.
 *
 * @public
 */
export {
  Divider,
  type DividerUiFeatureFlags,
  type DividerWrapperProps,
  type DividerMapCoreProps,
  type AppDividerProps,
} from './divider.js';

/**
 * Card: компонент карточки.
 *
 * @public
 */
export {
  Card,
  type CardUiFeatureFlags,
  type CardWrapperProps,
  type CardMapCoreProps,
  type AppCardProps,
} from './card.js';

/**
 * Dialog: компонент диалогового окна.
 *
 * @public
 */
export {
  Dialog,
  type AppDialogProps,
} from './dialog.js';

/**
 * Form: компонент формы.
 *
 * @public
 */
export {
  Form,
  type AppFormProps,
} from './form.js';

/**
 * LoadingSpinner: компонент индикатора загрузки.
 *
 * @public
 */
export {
  LoadingSpinner,
  type LoadingSpinnerUiFeatureFlags,
  type LoadingSpinnerWrapperProps,
  type LoadingSpinnerMapCoreProps,
  type AppLoadingSpinnerProps,
} from './loading-spinner.js';

/**
 * Dropdown: компонент выпадающего меню.
 *
 * @public
 */
export {
  Dropdown,
  type DropdownUiFeatureFlags,
  type DropdownWrapperProps,
  type DropdownMapCoreProps,
  type AppDropdownProps,
} from './dropdown.js';

/**
 * ContextMenu: компонент контекстного меню.
 *
 * @public
 */
export {
  ContextMenu,
  type ContextMenuUiFeatureFlags,
  type ContextMenuWrapperProps,
  type ContextMenuMapCoreProps,
  type AppContextMenuProps,
} from './context-menu.js';

/**
 * StatusIndicator: компонент индикатора статуса.
 *
 * @public
 */
export {
  StatusIndicator,
  type StatusIndicatorUiFeatureFlags,
  type StatusIndicatorWrapperProps,
  type StatusIndicatorMapCoreProps,
  type AppStatusIndicatorProps,
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
  Toast,
  type ToastUiFeatureFlags,
  type ToastWrapperProps,
  type ToastMapCoreProps,
  type AppToastProps,
} from './toast.js';

/**
 * Skeleton: компонент скелетона загрузки.
 *
 * @public
 */
export {
  Skeleton,
  type SkeletonUiFeatureFlags,
  type SkeletonWrapperProps,
  type SkeletonMapCoreProps,
  type AppSkeletonProps,
} from './skeleton.js';

/**
 * SkeletonGroup: группа скелетонов.
 *
 * @public
 */
export {
  SkeletonGroup,
  type AppSkeletonGroupProps,
} from './skeleton-group.js';

/**
 * Modal: компонент модального окна.
 *
 * @public
 */
export {
  Modal,
  type ModalUiFeatureFlags,
  type ModalWrapperProps,
  type ModalMapCoreProps,
  type AppModalProps,
} from './modal.js';

/**
 * Breadcrumbs: компонент навигационных хлебных крошек.
 *
 * @public
 */
export {
  Breadcrumbs,
  type BreadcrumbsUiFeatureFlags,
  type BreadcrumbsWrapperProps,
  type BreadcrumbsMapCoreProps,
  type AppBreadcrumbsProps,
  type AppBreadcrumbItem,
} from './breadcrumbs.js';

/**
 * Tabs: компонент вкладок.
 *
 * @public
 */
export {
  Tabs,
  type TabsUiFeatureFlags,
  type TabsWrapperProps,
  type TabsMapCoreProps,
  type AppTabsProps,
} from './tabs.js';

/**
 * Accordion: компонент аккордеона.
 *
 * @public
 */
export {
  Accordion,
  type AccordionUiFeatureFlags,
  type AccordionWrapperProps,
  type AccordionMapCoreProps,
  type AppAccordionProps,
} from './accordion.js';

/**
 * DatePicker: компонент для выбора даты.
 *
 * @public
 */
export {
  DatePicker,
  type DatePickerUiFeatureFlags,
  type DatePickerWrapperProps,
  type DatePickerMapCoreProps,
  type AppDatePickerProps,
} from './date-picker.js';

/**
 * FileUploader: компонент для загрузки файлов.
 *
 * @public
 */
export {
  FileUploader,
  type AppFileUploaderProps,
} from './file-uploader.js';

/**
 * SideBar: компонент боковой панели.
 *
 * @public
 */
export {
  SideBar,
  type SidebarUiFeatureFlags,
  type SidebarWrapperProps,
  type SidebarMapCoreProps,
  type AppSideBarProps,
} from './sidebar.js';

/**
 * SearchBar: компонент поисковой строки.
 *
 * @public
 */
export {
  SearchBar,
  type AppSearchBarProps,
} from './search-bar.js';

/**
 * ConfirmDialog: компонент диалога подтверждения.
 *
 * @public
 */
export {
  ConfirmDialog,
  type ConfirmDialogUiFeatureFlags,
  type ConfirmDialogWrapperProps,
  type ConfirmDialogMapCoreProps,
  type AppConfirmDialogProps,
} from './confirm-dialog.js';

/**
 * ErrorBoundary: компонент границы ошибок.
 *
 * @public
 */
export {
  ErrorBoundary,
  type ErrorBoundaryUiFeatureFlags,
  type ErrorBoundaryWrapperProps,
  type ErrorBoundaryMapCoreProps,
  type AppErrorBoundaryProps,
} from './error-boundary.js';

/**
 * UserProfileDisplay: компонент для отображения профиля пользователя.
 *
 * @public
 */
export {
  UserProfileDisplay,
  type UserProfileDisplayUiFeatureFlags,
  type UserProfileDisplayWrapperProps,
  type UserProfileDisplayMapCoreProps,
  type AppUserProfileDisplayProps,
} from './user-profile-display.js';

/**
 * NavigationMenuItem: компонент элемента навигационного меню.
 *
 * @public
 */
export {
  NavigationMenuItem,
  type NavigationMenuItemUiFeatureFlags,
  type NavigationMenuItemWrapperProps,
  type NavigationMenuItemMapCoreProps,
  type AppNavigationMenuItemProps,
} from './navigation-menu-item.js';

/**
 * LanguageSelector: компонент для выбора языка.
 *
 * @public
 */
export {
  LanguageSelector,
  type LanguageSelectorUiFeatureFlags,
  type LanguageSelectorWrapperProps,
  type LanguageSelectorMapCoreProps,
  type AppLanguageSelectorProps,
} from './language-selector.js';

/**
 * SupportButton: компонент кнопки поддержки.
 *
 * @public
 */
export {
  SupportButton,
  type AppSupportButtonProps,
} from './support-button.js';
