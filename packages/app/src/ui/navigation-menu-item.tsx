/**
 * @file packages/app/src/ui/navigation-menu-item.tsx
 * ============================================================================
 * 🧭 APP UI NAVIGATION MENU ITEM — UI МИКРОСЕРВИС NAVIGATION MENU ITEM
 * ============================================================================
 *
 * Stateful UI-фасад над CoreNavigationMenuItem.
 * Единственная точка входа для NavigationMenuItem в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility / disabled)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * - Логики роутинга (активное состояние определяется извне)
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, JSX, MouseEvent, ReactNode, Ref } from 'react';

import {
  NavigationMenuItem as CoreNavigationMenuItem,
} from '../../../ui-core/src/components/NavigationMenuItem.js';
import type {
  CoreNavigationMenuItemProps,
  NavigationMenuItemData,
} from '../../../ui-core/src/components/NavigationMenuItem.js';
import { canAccessRoute } from '../lib/route-permissions.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/** Тип элемента, который может рендерить NavigationMenuItem - либо anchor, либо button */
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
  Omit<CoreNavigationMenuItemProps, 'data-testid'> & {
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
>;

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
 *
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
  payload: NavigationMenuItemTelemetryPayload,
): void {
  infoFireAndForget(`NavigationMenuItem ${payload.action}`, payload);
}

/**
 * Формирование payload для NavigationMenuItem telemetry.
 */
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

/**
 * Извлекает telemetry props из данных элемента меню и props компонента.
 * Чистая функция без знания App props целиком.
 */
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
      ...coreProps
    } = props;

    const policy = useNavigationMenuItemPolicy(props);

    /** Telemetry props */
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

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия для детерминированности.
     */
    type LifecyclePayload = Readonly<{
      mount: NavigationMenuItemTelemetryPayload;
      unmount: NavigationMenuItemTelemetryPayload;
    }>;

    const lifecyclePayloadRef = useRef<LifecyclePayload | null>(null);

    // eslint-disable-next-line functional/immutable-data
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

    /** Стабильные ссылки на payload для telemetry (immutable by contract) */
    const mountPayload = lifecyclePayload.mount;
    const unmountPayload = lifecyclePayload.unmount;

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitNavigationMenuItemTelemetry(mountPayload);
      return (): void => {
        emitNavigationMenuItemTelemetry(unmountPayload);
      };
      // mountPayload и unmountPayload immutable by contract (создаются один раз при первом рендере)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [policy.telemetryEnabled]);

    /** App-level disabled enhancement: добавляем визуальные стили для disabled состояний */
    const combinedStyle = useMemo<CSSProperties | undefined>(() => {
      const disabled = policy.disabledByFeatureFlag || !policy.routeAccessible;
      if (!disabled) return style;

      return {
        ...(style ?? {}),
        opacity: 0.6,
        pointerEvents: 'none' as const,
      };
    }, [policy.disabledByFeatureFlag, policy.routeAccessible, style]);

    /** Обработчик клика с telemetry */
    const handleClick = useCallback(
      (event: MouseEvent<HTMLElement>) => {
        // Не выполняем клик, если маршрут недоступен
        if (!policy.routeAccessible) return;

        if (policy.telemetryEnabled) {
          emitNavigationMenuItemTelemetry(
            getNavigationMenuItemPayload(
              NavigationMenuItemTelemetryAction.Click,
              policy,
              telemetryProps,
            ),
          );
        }

        onClick?.(item, event);
      },
      [policy, telemetryProps, onClick, item],
    );

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreNavigationMenuItem
        ref={ref}
        item={{
          ...item,
          isDisabled: item.isDisabled === true
            || policy.disabledByFeatureFlag
            || !policy.routeAccessible,
        }}
        {...(size !== undefined && { size })}
        {...(variant !== undefined && { variant })}
        {...(showIcon !== undefined && { showIcon })}
        {...(showLabel !== undefined && { showLabel })}
        {...(customIcon !== undefined && { customIcon })}
        style={combinedStyle}
        className={className}
        onClick={onClick ? handleClick : undefined}
        aria-disabled={policy.disabledByFeatureFlag || !policy.routeAccessible}
        data-component='AppNavigationMenuItem'
        data-state={policy.disabledByFeatureFlag || !policy.routeAccessible ? 'disabled' : 'active'}
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(dataTestId !== undefined && { 'data-testid': dataTestId })}
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
NavigationMenuItemComponent.displayName = 'NavigationMenuItem';

/**
 * UI-контракт NavigationMenuItem компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректную информацию о состоянии элемента меню
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - Click telemetry отправляется при каждом клике на элемент
 * - Disabled состояние применяется через opacity и pointer-events
 *
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
 *
 * // С feature flags и telemetry
 * <NavigationMenuItem
 *   item={{ label: 'Профиль', href: '/profile', icon: <UserIcon /> }}
 *   visible={isNavigationVisible}
 *   isHiddenByFeatureFlag={!featureFlags.navigationEnabled}
 *   isDisabledByFeatureFlag={isUserBlocked}
 *   telemetryEnabled={true}
 *   onClick={(item, event) => handleNavigation(item.href)}
 * />
 *
 * // Компактный для мобильного
 * <NavigationMenuItem item={{ label: 'Настройки', href: '/settings', isDisabled: !isSettingsAvailable }} size="small" variant="compact" />
 * ```
 */
export const NavigationMenuItem = memo(NavigationMenuItemComponent);
