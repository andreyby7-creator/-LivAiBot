/**
 * @file packages/app/src/ui/navigation-menu-item.tsx
 * ============================================================================
 * 🧭 APP UI NAVIGATION MENU ITEM — UI МИКРОСЕРВИС NAVIGATION MENU ITEM
 * ============================================================================
 * Stateful UI-фасад над CoreNavigationMenuItem.
 * Единственная точка входа для NavigationMenuItem в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility / disabled)
 * - Telemetry
 * - Feature flags
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * - Логики роутинга (активное состояние определяется извне)
 */

import { NavigationMenuItem as CoreNavigationMenuItem } from '@livai/ui-core';
import type { CoreNavigationMenuItemProps, NavigationMenuItemData } from '@livai/ui-core';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, JSX, MouseEvent, ReactNode, Ref } from 'react';

import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { canAccessRoute } from '../lib/route-permissions.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { Json } from '../types/common.js';
import type {
  AppWrapperProps,
  MapCoreProps,
  UiFeatureFlags,
  UiPrimitiveProps,
  UiTelemetryApi,
} from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте navigation-menu-item wrapper */
export type NavigationMenuItemUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте navigation-menu-item */
export type NavigationMenuItemWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте navigation-menu-item */
export type NavigationMenuItemMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

/* ============================================================================
 * 🛠️ УТИЛИТЫ
 * ========================================================================== */

// Фильтрует указанные ключи из объекта
function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const keySet = new Set(keys as readonly string[]);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keySet.has(key)),
  ) as Omit<T, K>;
}

// Тип элемента, который может рендерить NavigationMenuItem - либо anchor, либо button
type NavigationMenuItemElement = HTMLAnchorElement | HTMLButtonElement;

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * =========================================================================== */

const NavigationMenuItemTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  Click: 'click',
} as const;

type NavigationMenuItemTelemetryAction =
  typeof NavigationMenuItemTelemetryAction[keyof typeof NavigationMenuItemTelemetryAction];

type NavigationMenuItemSize = 'small' | 'medium' | 'large';
type NavigationMenuItemVariant = 'default' | 'compact' | 'minimal';

type NavigationMenuItemTelemetryPayload = {
  component: 'NavigationMenuItem';
  action: NavigationMenuItemTelemetryAction;
  hidden: boolean;
  visible: boolean;
  disabled: boolean;
  routeAccessible: boolean;
  size?: NavigationMenuItemSize;
  variant?: NavigationMenuItemVariant;
  hasIcon: boolean;
  hasLabel: boolean;
  isActive: boolean;
  isLink: boolean;
};

export type AppNavigationMenuItemProps = Readonly<
  & Omit<CoreNavigationMenuItemProps, 'data-testid' | 'aria-label'>
  & {
    /** Видимость NavigationMenuItem (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть NavigationMenuItem */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить NavigationMenuItem */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при клике на элемент меню */
    onClick?: (item: NavigationMenuItemData, event: MouseEvent<HTMLElement>) => void;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
  & (
    | {
      /** I18n label режим */
      labelI18nKey: TranslationKey;
      labelI18nNs?: Namespace;
      labelI18nParams?: Record<string, string | number>;
      label?: never;
    }
    | {
      /** Обычный label режим */
      labelI18nKey?: never;
      labelI18nNs?: never;
      labelI18nParams?: never;
      label?: string;
    }
  )
  & (
    | {
      /** I18n aria-label режим */
      ariaLabelI18nKey: TranslationKey;
      ariaLabelI18nNs?: Namespace;
      ariaLabelI18nParams?: Record<string, string | number>;
      'aria-label'?: never;
    }
    | {
      /** Обычный aria-label режим */
      ariaLabelI18nKey?: never;
      ariaLabelI18nNs?: never;
      ariaLabelI18nParams?: never;
      'aria-label'?: string;
    }
  )
>;

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'telemetryEnabled',
  'labelI18nKey',
  'labelI18nNs',
  'labelI18nParams',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/* ============================================================================
 * 🧠 POLICY
 * =========================================================================== */

type NavigationMenuItemPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
  readonly routeAccessible: boolean;
}>;

/**
 * NavigationMenuItemPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - disabled state
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useNavigationMenuItemPolicy(
  props: AppNavigationMenuItemProps,
): NavigationMenuItemPolicy {
  return useMemo(() => {
    const hiddenByFeatureFlag = props.isHiddenByFeatureFlag === true;
    const disabledByFeatureFlag = props.isDisabledByFeatureFlag === true;
    const telemetryEnabled = props.telemetryEnabled !== false;

    // Проверяем доступ к маршруту (если есть href)
    // SSR-safe: canAccessRoute возвращает консервативный результат в серверном окружении
    const routeAccessible = props.item.href !== undefined && props.item.href !== ''
      ? canAccessRoute(props.item.href)
      : true;

    const isRendered = !hiddenByFeatureFlag && props.visible !== false && routeAccessible;

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      isRendered,
      telemetryEnabled,
      routeAccessible,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.visible,
    props.telemetryEnabled,
    props.item.href,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * =========================================================================== */

function emitNavigationMenuItemTelemetry(
  telemetry: UiTelemetryApi,
  payload: NavigationMenuItemTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`NavigationMenuItem ${payload.action}`, payload);
}

// Формирование payload для NavigationMenuItem telemetry
function getNavigationMenuItemPayload(
  action: NavigationMenuItemTelemetryAction,
  policy: NavigationMenuItemPolicy,
  telemetryProps: {
    size?: NavigationMenuItemSize;
    variant?: NavigationMenuItemVariant;
    hasIcon: boolean;
    hasLabel: boolean;
    isActive: boolean;
    isDisabledFromItem: boolean;
    isLinkCandidate: boolean;
  },
): NavigationMenuItemTelemetryPayload {
  return {
    component: 'NavigationMenuItem',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    disabled: policy.disabledByFeatureFlag,
    routeAccessible: policy.routeAccessible,
    ...(telemetryProps.size !== undefined && { size: telemetryProps.size }),
    ...(telemetryProps.variant !== undefined && { variant: telemetryProps.variant }),
    hasIcon: telemetryProps.hasIcon,
    hasLabel: telemetryProps.hasLabel,
    isActive: telemetryProps.isActive,
    isLink: telemetryProps.isLinkCandidate
      && !(telemetryProps.isDisabledFromItem
        || policy.disabledByFeatureFlag
        || !policy.routeAccessible),
  };
}

// Извлекает telemetry props из данных элемента меню и props компонента
function extractNavigationMenuItemTelemetryProps(
  item: NavigationMenuItemData,
  props: {
    size?: NavigationMenuItemSize;
    variant?: NavigationMenuItemVariant;
    showIcon?: boolean;
    showLabel?: boolean;
    customIcon?: ReactNode;
  },
): {
  size?: NavigationMenuItemSize;
  variant?: NavigationMenuItemVariant;
  hasIcon: boolean;
  hasLabel: boolean;
  isActive: boolean;
  isDisabledFromItem: boolean;
  isLinkCandidate: boolean;
} {
  return {
    ...(props.size !== undefined && { size: props.size }),
    ...(props.variant !== undefined && { variant: props.variant }),
    hasIcon: props.showIcon !== false
      && (item.icon != null || props.customIcon != null),
    hasLabel: props.showLabel !== false && item.label !== '',
    isActive: item.isActive === true,
    isDisabledFromItem: item.isDisabled === true,
    isLinkCandidate: item.href != null && item.href !== '',
  };
}

/* ============================================================================
 * 🎯 APP NAVIGATION MENU ITEM
 * =========================================================================== */

const NavigationMenuItemComponent = forwardRef<
  NavigationMenuItemElement,
  AppNavigationMenuItemProps
>(
  function NavigationMenuItemComponent(
    props: AppNavigationMenuItemProps,
    ref: Ref<NavigationMenuItemElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const {
      item,
      size,
      variant,
      showIcon,
      showLabel,
      customIcon,
      style,
      className,
      onClick,
      'data-testid': dataTestId,
      ...filteredCoreProps
    } = domProps;

    // Label: i18n → обычный label → item.label
    const label = useMemo<string>(() => {
      if ('labelI18nKey' in props) {
        const effectiveNs = props.labelI18nNs ?? 'common';
        return translate(effectiveNs, props.labelI18nKey, props.labelI18nParams ?? EMPTY_PARAMS);
      }
      return props.label ?? item.label;
    }, [props, translate, item.label]);

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabel = useMemo<string | undefined>(() => {
      if ('ariaLabelI18nKey' in props) {
        const effectiveNs = props.ariaLabelI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelI18nKey,
          props.ariaLabelI18nParams ?? EMPTY_PARAMS,
        );
      }
      return props['aria-label'];
    }, [props, translate]);

    // Создаем обновленный item с i18n label
    const translatedItem = useMemo<NavigationMenuItemData>(() => ({
      ...item,
      label,
    }), [item, label]);

    const policy = useNavigationMenuItemPolicy(props);

    // Telemetry props
    const telemetryProps = useMemo(
      () =>
        extractNavigationMenuItemTelemetryProps(item, {
          ...(size !== undefined && { size }),
          ...(variant !== undefined && { variant }),
          ...(showIcon !== undefined && { showIcon }),
          ...(showLabel !== undefined && { showLabel }),
          ...(customIcon !== undefined && { customIcon }),
        }),
      [
        item,
        size,
        variant,
        showIcon,
        showLabel,
        customIcon,
      ],
    );

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    type LifecyclePayload = Readonly<{
      mount: NavigationMenuItemTelemetryPayload;
      unmount: NavigationMenuItemTelemetryPayload;
    }>;

    const lifecyclePayloadRef = useRef<LifecyclePayload | null>(null);

    lifecyclePayloadRef.current ??= {
      mount: getNavigationMenuItemPayload(
        NavigationMenuItemTelemetryAction.Mount,
        policy,
        telemetryProps,
      ),
      unmount: getNavigationMenuItemPayload(
        NavigationMenuItemTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Стабильные ссылки на payload для telemetry (immutable by contract)
    const mountPayload = lifecyclePayload.mount;
    const unmountPayload = lifecyclePayload.unmount;

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitNavigationMenuItemTelemetry(telemetry, mountPayload);
      return (): void => {
        emitNavigationMenuItemTelemetry(telemetry, unmountPayload);
      };
      // mountPayload и unmountPayload immutable by contract (создаются один раз при первом рендере)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [policy.telemetryEnabled]);

    // App-level disabled enhancement: добавляем визуальные стили для disabled состояний
    const combinedStyle = useMemo<CSSProperties | undefined>(() => {
      const disabled = policy.disabledByFeatureFlag || !policy.routeAccessible;
      if (!disabled) return style;

      return {
        ...(style ?? {}),
        opacity: 0.6,
        pointerEvents: 'none' as const,
      };
    }, [policy.disabledByFeatureFlag, policy.routeAccessible, style]);

    // Обработчик клика с telemetry
    const handleClick = useCallback(
      (event: MouseEvent<HTMLElement>) => {
        // Не выполняем клик, если маршрут недоступен
        if (!policy.routeAccessible) return;

        if (policy.telemetryEnabled) {
          emitNavigationMenuItemTelemetry(
            telemetry,
            getNavigationMenuItemPayload(
              NavigationMenuItemTelemetryAction.Click,
              policy,
              telemetryProps,
            ),
          );
        }

        onClick?.(item, event);
      },
      [policy, telemetryProps, onClick, item, telemetry],
    );

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreNavigationMenuItem
        ref={ref}
        item={{
          ...translatedItem,
          isDisabled: translatedItem.isDisabled === true
            || policy.disabledByFeatureFlag
            || !policy.routeAccessible,
        }}
        {...(size !== undefined && { size })}
        {...(variant !== undefined && { variant })}
        {...(showIcon !== undefined && { showIcon })}
        showLabel={showLabel ?? true}
        {...(customIcon !== undefined && { customIcon })}
        style={combinedStyle}
        className={className}
        onClick={onClick ? handleClick : undefined}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        aria-disabled={policy.disabledByFeatureFlag || !policy.routeAccessible}
        data-component='AppNavigationMenuItem'
        data-state={policy.disabledByFeatureFlag || !policy.routeAccessible ? 'disabled' : 'active'}
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(dataTestId !== undefined && { 'data-testid': dataTestId })}
        {...filteredCoreProps}
      />
    );
  },
);

NavigationMenuItemComponent.displayName = 'NavigationMenuItem';

/**
 * UI-контракт NavigationMenuItem компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка accessibility (ARIA)
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректную информацию о состоянии элемента меню
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - Click telemetry отправляется при каждом клике на элемент
 * - Disabled состояние применяется через opacity и pointer-events
 * Не допускается:
 * - Использование напрямую core NavigationMenuItem компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 *
 * @example
 * ```tsx
 * // Базовый
 * <NavigationMenuItem item={{ label: 'Главная', href: '/', icon: <HomeIcon />, isActive: currentPath === '/' }} />
 * // С feature flags и telemetry
 * <NavigationMenuItem
 *   item={{ label: 'Профиль', href: '/profile', icon: <UserIcon /> }}
 *   visible={isNavigationVisible}
 *   isHiddenByFeatureFlag={!featureFlags.navigationEnabled}
 *   isDisabledByFeatureFlag={isUserBlocked}
 *   telemetryEnabled={true}
 *   onClick={(item, event) => handleNavigation(item.href)}
 * />
 * // Компактный для мобильного
 * <NavigationMenuItem item={{ label: 'Настройки', href: '/settings', isDisabled: !isSettingsAvailable }} size="small" variant="compact" />
 * ```
 */
export const NavigationMenuItem = memo(NavigationMenuItemComponent);
