/**
 * @file packages/app/src/ui/user-profile-display.tsx
 * ============================================================================
 * 🟥 APP UI USER PROFILE DISPLAY — UI МИКРОСЕРВИС USER PROFILE DISPLAY
 * ============================================================================
 * Stateful UI-фасад над CoreUserProfileDisplay.
 * Единственная точка входа для UserProfileDisplay в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility / disabled)
 * - Telemetry
 * - Feature flags
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * - Логики загрузки данных профиля
 * Архитектурные решения:
 * - Управление данными профиля обрабатывается в App слое
 * - CoreUserProfileDisplay остается полностью presentational
 */

import type { CSSProperties, JSX, ReactNode, Ref } from 'react';
import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';

import { useAuthGuardContext } from '@livai/core/access-control';
import type { CoreUserProfileDisplayProps, UserProfileData } from '@livai/ui-core';
import { UserProfileDisplay as CoreUserProfileDisplay } from '@livai/ui-core';

import type { Namespace, TranslationKey } from '../lib/i18n.js';
import type { RoutePermissionContext } from '../lib/route-permissions.js';
import { checkRoutePermission } from '../lib/route-permissions.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { Json } from '../types/common.js';
import type {
  AppWrapperProps,
  MapCoreProps,
  UiFeatureFlags,
  UiPrimitiveProps,
  UiTelemetryApi,
} from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте user-profile-display wrapper */
export type UserProfileDisplayUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте user-profile-display */
export type UserProfileDisplayWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте user-profile-display */
export type UserProfileDisplayMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * =========================================================================== */

const UserProfileDisplayTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  View: 'view',
} as const;

type UserProfileDisplayTelemetryAction =
  typeof UserProfileDisplayTelemetryAction[keyof typeof UserProfileDisplayTelemetryAction];

type UserProfileDisplaySize = 'small' | 'medium' | 'large';
type UserProfileDisplayVariant = 'default' | 'compact' | 'detailed';

type UserProfileDisplayTelemetryPayload = {
  component: 'UserProfileDisplay';
  action: UserProfileDisplayTelemetryAction;
  hidden: boolean;
  visible: boolean;
  disabled: boolean;
  size?: UserProfileDisplaySize;
  variant?: UserProfileDisplayVariant;
  hasAvatar: boolean;
  hasName: boolean;
  hasEmail: boolean;
  hasAdditionalInfo: boolean;
};

export type AppUserProfileDisplayProps = Readonly<
  & Omit<CoreUserProfileDisplayProps, 'data-testid' | 'aria-label'>
  & {
    /** Видимость UserProfileDisplay (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть UserProfileDisplay */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить UserProfileDisplay */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
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
// style исключается из domProps, так как комбинируется policy-слоем
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'telemetryEnabled',
  'visible',
  'style',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/* ============================================================================
 * 🧠 POLICY
 * =========================================================================== */

type UserProfileDisplayPolicy =
  & Readonly<{
    readonly hiddenByFeatureFlag: boolean;
    readonly disabledByFeatureFlag: boolean;
    readonly isAuthorized: boolean;
    readonly isRendered: boolean;
    readonly telemetryEnabled: boolean;
  }>
  & { readonly __brand: 'UserProfileDisplayPolicy'; };

/**
 * UserProfileDisplayPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - disabled state
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useUserProfileDisplayPolicy(
  props: AppUserProfileDisplayProps,
): UserProfileDisplayPolicy {
  const authContext = useAuthGuardContext();
  const { roles, permissions } = authContext;

  return useMemo(() => {
    const hiddenByFeatureFlag = props.isHiddenByFeatureFlag === true;
    const disabledByFeatureFlag = props.isDisabledByFeatureFlag === true;
    const telemetryEnabled = props.telemetryEnabled !== false;

    // Проверяем права доступа к профилю через route-permissions
    const canViewProfile = checkRoutePermission(
      { type: 'profile', path: '/profile' },
      {
        ...authContext,
        userRoles: new Set(roles),
        userPermissions: new Set(permissions),
      } as RoutePermissionContext,
    );

    const isAuthorized = canViewProfile.allowed;

    // Видимость по policy: учитывает feature flags и explicit visible
    const isVisibleByPolicy = props.visible !== false && !hiddenByFeatureFlag;

    // Финальная видимость: policy + authorization
    const isRendered = isVisibleByPolicy && isAuthorized;

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      isAuthorized,
      isRendered,
      telemetryEnabled,
      __brand: 'UserProfileDisplayPolicy' as const,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.visible,
    props.telemetryEnabled,
    roles,
    permissions,
    authContext,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * =========================================================================== */

function emitUserProfileDisplayTelemetry(
  telemetry: UiTelemetryApi,
  payload: UserProfileDisplayTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`UserProfileDisplay ${payload.action}`, payload);
}

/** Формирование payload для UserProfileDisplay telemetry. */
function getUserProfileDisplayPayload(
  action: UserProfileDisplayTelemetryAction,
  policy: UserProfileDisplayPolicy,
  telemetryProps: {
    size?: UserProfileDisplaySize;
    variant?: UserProfileDisplayVariant;
    hasAvatar: boolean;
    hasName: boolean;
    hasEmail: boolean;
    hasAdditionalInfo: boolean;
  },
): UserProfileDisplayTelemetryPayload {
  return {
    component: 'UserProfileDisplay',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    disabled: policy.disabledByFeatureFlag,
    ...(telemetryProps.size !== undefined && { size: telemetryProps.size }),
    ...(telemetryProps.variant !== undefined && { variant: telemetryProps.variant }),
    hasAvatar: telemetryProps.hasAvatar,
    hasName: telemetryProps.hasName,
    hasEmail: telemetryProps.hasEmail,
    hasAdditionalInfo: telemetryProps.hasAdditionalInfo,
  };
}

/**
 * Извлекает telemetry props из данных профиля и props компонента.
 * Чистая функция без знания App props целиком.
 */
function extractTelemetryProps(
  profile: UserProfileData,
  props: {
    size?: UserProfileDisplaySize;
    variant?: UserProfileDisplayVariant;
    showAvatar?: boolean;
    showName?: boolean;
    showEmail?: boolean;
    showAdditionalInfo?: boolean;
    customAvatar?: ReactNode;
  },
): {
  size?: UserProfileDisplaySize;
  variant?: UserProfileDisplayVariant;
  hasAvatar: boolean;
  hasName: boolean;
  hasEmail: boolean;
  hasAdditionalInfo: boolean;
} {
  return {
    ...(props.size !== undefined && { size: props.size }),
    ...(props.variant !== undefined && { variant: props.variant }),
    hasAvatar: Boolean(
      props.showAvatar !== false
        && (
          Boolean(profile.avatarUrl?.trim())
          || Boolean(props.customAvatar)
        ),
    ),
    hasName: Boolean(props.showName !== false && Boolean(profile.name?.trim())),
    hasEmail: Boolean(props.showEmail !== false && Boolean(profile.email.trim())),
    hasAdditionalInfo: Boolean(
      props.showAdditionalInfo === true
        && Boolean(profile.additionalInfo?.trim()),
    ),
  };
}

/* ============================================================================
 * 🎯 APP USER PROFILE DISPLAY
 * =========================================================================== */

const UserProfileDisplayComponent = forwardRef<HTMLDivElement, AppUserProfileDisplayProps>(
  function UserProfileDisplayComponent(
    props: AppUserProfileDisplayProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    const policy = useUserProfileDisplayPolicy(props);

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

    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const {
      profile,
      size,
      variant,
      showAvatar,
      showName,
      showEmail,
      showAdditionalInfo,
      customAvatar,
      className,
      'data-testid': dataTestId,
      ...restCoreProps // остаток CoreUserProfileDisplayProps после явного извлечения
    } = omit(props, BUSINESS_PROPS);

    // style берем из оригинальных props, чтобы правильно комбинировать с disabled стилем
    const { style } = props;

    // Telemetry props
    const telemetryProps = useMemo(
      () =>
        extractTelemetryProps(profile, {
          ...(size !== undefined && { size }),
          ...(variant !== undefined && { variant }),
          ...(showAvatar !== undefined && { showAvatar }),
          ...(showName !== undefined && { showName }),
          ...(showEmail !== undefined && { showEmail }),
          ...(showAdditionalInfo !== undefined && { showAdditionalInfo }),
          ...(customAvatar !== undefined && { customAvatar }),
        }),
      [
        profile,
        size,
        variant,
        showAvatar,
        showName,
        showEmail,
        showAdditionalInfo,
        customAvatar,
      ],
    );

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    // Это архитектурная гарантия для детерминированности
    type LifecyclePayload = Readonly<{
      mount: UserProfileDisplayTelemetryPayload;
      unmount: UserProfileDisplayTelemetryPayload;
    }>;

    const lifecyclePayloadRef = useRef<LifecyclePayload | null>(null);

    lifecyclePayloadRef.current ??= {
      mount: getUserProfileDisplayPayload(
        UserProfileDisplayTelemetryAction.Mount,
        policy,
        telemetryProps,
      ),
      unmount: getUserProfileDisplayPayload(
        UserProfileDisplayTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitUserProfileDisplayTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitUserProfileDisplayTelemetry(telemetry, lifecyclePayload.unmount);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [policy.telemetryEnabled, lifecyclePayload]);

    // Telemetry для view - только при первом рендере, если компонент видим
    const hasEmittedViewRef = useRef<boolean>(false);

    useEffect(() => {
      if (
        !policy.telemetryEnabled
        || !policy.isRendered
        || !policy.isAuthorized
        || hasEmittedViewRef.current
      ) {
        return;
      }

      emitUserProfileDisplayTelemetry(
        telemetry,
        getUserProfileDisplayPayload(
          UserProfileDisplayTelemetryAction.View,
          policy,
          telemetryProps,
        ),
      );

      hasEmittedViewRef.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      policy.telemetryEnabled,
      policy.isRendered,
      policy.isAuthorized,
      policy,
      telemetryProps,
    ]);

    // Объединяем стили для disabled состояния
    const combinedStyle = useMemo<CSSProperties | undefined>(() => {
      if (!policy.disabledByFeatureFlag) return style;

      return {
        ...(style ?? {}),
        opacity: 0.6,
        pointerEvents: 'none' as const,
      };
    }, [policy.disabledByFeatureFlag, style]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    const testId = dataTestId ?? 'core-user-profile-display';

    return (
      <CoreUserProfileDisplay
        ref={ref}
        profile={profile}
        {...(size !== undefined && { size })}
        {...(variant !== undefined && { variant })}
        {...(showAvatar !== undefined && { showAvatar })}
        {...(showName !== undefined && { showName })}
        {...(showEmail !== undefined && { showEmail })}
        {...(showAdditionalInfo !== undefined && { showAdditionalInfo })}
        customAvatar={customAvatar}
        style={combinedStyle}
        className={className}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        data-component='AppUserProfileDisplay'
        data-state={policy.disabledByFeatureFlag ? 'disabled' : 'active'}
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        data-testid={testId}
        {...restCoreProps}
      />
    );
  },
);

UserProfileDisplayComponent.displayName = 'UserProfileDisplay';

/**
 * UI-контракт UserProfileDisplay компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка accessibility (ARIA)
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректную информацию о профиле
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - View telemetry отправляется только один раз при первом рендере
 * - Disabled состояние применяется через opacity и pointer-events
 * Не допускается:
 * - Использование напрямую core UserProfileDisplay компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <UserProfileDisplay profile={{ email: 'user@example.com', name: 'Иван Иванов' }} />
 * // С feature flags и telemetry
 * <UserProfileDisplay
 *   profile={{ email: 'user@example.com', name: 'Иван Иванов', avatarUrl: '/avatars/user.jpg', additionalInfo: 'Разработчик' }}
 *   visible={isProfileVisible}
 *   isHiddenByFeatureFlag={!featureFlags.profileEnabled}
 *   isDisabledByFeatureFlag={featureFlags.profileDisabled}
 *   telemetryEnabled={true}
 *   size="large"
 *   variant="detailed"
 *   showAdditionalInfo={true}
 * />
 * // Компактный вариант
 * <UserProfileDisplay profile={{ email: 'user@example.com', name: 'Иван Иванов' }} size="small" variant="compact" />
 * ```
 */
export const UserProfileDisplay = memo(UserProfileDisplayComponent);
