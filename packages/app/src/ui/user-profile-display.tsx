/**
 * @file packages/app/src/ui/user-profile-display.tsx
 * ============================================================================
 * 🟥 APP UI USER PROFILE DISPLAY — UI МИКРОСЕРВИС USER PROFILE DISPLAY
 * ============================================================================
 *
 * Stateful UI-фасад над CoreUserProfileDisplay.
 * Единственная точка входа для UserProfileDisplay в приложении.
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
 * - Логики загрузки данных профиля
 *
 * Архитектурные решения:
 * - Управление данными профиля обрабатывается в App слое
 * - CoreUserProfileDisplay остается полностью presentational
 */

import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, JSX, ReactNode, Ref } from 'react';

import {
  UserProfileDisplay as CoreUserProfileDisplay,
} from '../../../ui-core/src/components/UserProfileDisplay.js';
import type {
  CoreUserProfileDisplayProps,
  UserProfileData,
} from '../../../ui-core/src/components/UserProfileDisplay.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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
  Omit<CoreUserProfileDisplayProps, 'data-testid'> & {
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
>;

/* ============================================================================
 * 🧠 POLICY
 * =========================================================================== */

type UserProfileDisplayPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * UserProfileDisplayPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - disabled state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useUserProfileDisplayPolicy(
  props: AppUserProfileDisplayProps,
): UserProfileDisplayPolicy {
  return useMemo(() => {
    const hiddenByFeatureFlag = props.isHiddenByFeatureFlag === true;
    const disabledByFeatureFlag = props.isDisabledByFeatureFlag === true;
    const telemetryEnabled = props.telemetryEnabled !== false;

    const isRendered = !hiddenByFeatureFlag && props.visible !== false;

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      isRendered,
      telemetryEnabled,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.visible,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * =========================================================================== */

function emitUserProfileDisplayTelemetry(
  payload: UserProfileDisplayTelemetryPayload,
): void {
  infoFireAndForget(`UserProfileDisplay ${payload.action}`, payload);
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
    hasAvatar: props.showAvatar !== false
      && (
        (profile.avatarUrl != null && profile.avatarUrl !== '')
        || props.customAvatar != null
      ),
    hasName: props.showName !== false && profile.name != null && profile.name !== '',
    hasEmail: props.showEmail !== false && profile.email !== '',
    hasAdditionalInfo: props.showAdditionalInfo === true
      && profile.additionalInfo != null
      && profile.additionalInfo !== '',
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
    const {
      profile,
      size,
      variant,
      showAvatar,
      showName,
      showEmail,
      showAdditionalInfo,
      customAvatar,
      style,
      className,
      'data-testid': dataTestId,
      ...coreProps
    } = props;

    const policy = useUserProfileDisplayPolicy(props);

    /** Telemetry props */
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

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия для детерминированности.
     */
    type LifecyclePayload = Readonly<{
      mount: UserProfileDisplayTelemetryPayload;
      unmount: UserProfileDisplayTelemetryPayload;
    }>;

    const lifecyclePayloadRef = useRef<LifecyclePayload | null>(null);

    // eslint-disable-next-line functional/immutable-data
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

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitUserProfileDisplayTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitUserProfileDisplayTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    /** Telemetry для view - только при первом рендере, если компонент видим */
    const hasEmittedViewRef = useRef<boolean>(false);

    useEffect(() => {
      if (!policy.telemetryEnabled || !policy.isRendered || hasEmittedViewRef.current) {
        return;
      }

      emitUserProfileDisplayTelemetry(
        getUserProfileDisplayPayload(
          UserProfileDisplayTelemetryAction.View,
          policy,
          telemetryProps,
        ),
      );

      // eslint-disable-next-line functional/immutable-data
      hasEmittedViewRef.current = true;
    }, [
      policy.telemetryEnabled,
      policy.isRendered,
      policy,
      telemetryProps,
    ]);

    /** Объединяем стили для disabled состояния */
    const combinedStyle = useMemo<CSSProperties | undefined>(() => {
      if (!policy.disabledByFeatureFlag) return style;

      return {
        ...(style ?? {}),
        opacity: 0.6,
        pointerEvents: 'none' as const,
      };
    }, [policy.disabledByFeatureFlag, style]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

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
        {...(customAvatar !== undefined && { customAvatar })}
        style={combinedStyle}
        className={className}
        data-component='AppUserProfileDisplay'
        data-state={policy.disabledByFeatureFlag ? 'disabled' : 'active'}
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(dataTestId !== undefined && { 'data-testid': dataTestId })}
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
UserProfileDisplayComponent.displayName = 'UserProfileDisplay';

/**
 * UI-контракт UserProfileDisplay компонента.
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
 * - Telemetry payload содержит корректную информацию о профиле
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - View telemetry отправляется только один раз при первом рендере
 * - Disabled состояние применяется через opacity и pointer-events
 *
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
 *
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
 *
 * // Компактный вариант
 * <UserProfileDisplay profile={{ email: 'user@example.com', name: 'Иван Иванов' }} size="small" variant="compact" />
 * ```
 */
export const UserProfileDisplay = memo(UserProfileDisplayComponent);
