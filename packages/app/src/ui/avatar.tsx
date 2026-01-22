/**
 * @file packages/app/src/ui/avatar.tsx
 * ============================================================================
 * 🟥 APP UI AVATAR — UI МИКРОСЕРВИС АВАТАРА
 * ============================================================================
 *
 * Единственная точка входа для Avatar в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / size / fallback)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import { forwardRef, memo, useEffect, useMemo } from 'react';
import type { JSX, Ref } from 'react';

import { Avatar as CoreAvatar } from '../../../ui-core/src/primitives/avatar.js';
import type { CoreAvatarProps } from '../../../ui-core/src/primitives/avatar.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum AvatarTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
}

type AvatarTelemetryPayload = {
  component: 'Avatar';
  action: AvatarTelemetryAction;
  hidden: boolean;
  name: string | null;
};

export type AppAvatarProps = Readonly<
  & CoreAvatarProps
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Имя пользователя для fallback, если src нет */
    name?: string | null;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type AvatarPolicy = Readonly<{
  hidden: boolean;
  isVisible: boolean;
  telemetryEnabled: boolean;
}>;

function useAvatarPolicy(props: AppAvatarProps): AvatarPolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag ?? false);

  return useMemo<AvatarPolicy>(() => ({
    hidden,
    isVisible: !hidden,
    telemetryEnabled: props.telemetryEnabled !== false,
  }), [hidden, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitAvatarTelemetry(payload: AvatarTelemetryPayload): void {
  infoFireAndForget(`Avatar ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP AVATAR
 * ========================================================================== */

const AvatarComponent = forwardRef<HTMLDivElement, AppAvatarProps>(
  function AvatarComponent(props: AppAvatarProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { src, name, ...coreProps } = props;
    const policy = useAvatarPolicy(props);

    // Мемоизированные вычисления должны быть перед любыми условными return
    const alt = useMemo(() => name ?? 'avatar', [name]);
    const fallbackText = useMemo(() => {
      if (name == null || name === '') return '';
      return name
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase())
        .slice(0, 2) // Максимум 2 инициала
        .join('');
    }, [name]);

    // Мемоизированные telemetry payload'ы для consistency
    const mountPayload = useMemo<AvatarTelemetryPayload>(() => ({
      component: 'Avatar',
      action: AvatarTelemetryAction.Mount,
      hidden: policy.hidden,
      name: name ?? null,
    }), [policy.hidden, name]);

    const unmountPayload = useMemo<AvatarTelemetryPayload>(() => ({
      component: 'Avatar',
      action: AvatarTelemetryAction.Unmount,
      hidden: policy.hidden,
      name: name ?? null,
    }), [policy.hidden, name]);

    /** Dev invariant: strict validation for development */
    if (
      process.env['NODE_ENV'] !== 'production'
      && process.env['NODE_ENV'] !== 'test'
      && src == null
      && name == null
    ) {
      throw new Error(
        '[AppAvatar] Development Error: Either "src" or "name" prop must be provided. '
          + 'Avatar needs either an image source or a name to generate fallback initials. '
          + 'Example: <Avatar src="/user.jpg" alt="John" /> or <Avatar name="John Doe" />',
      );
    }

    /** Telemetry lifecycle */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitAvatarTelemetry(mountPayload);
        return (): void => {
          emitAvatarTelemetry(unmountPayload);
        };
      }
      return undefined;
    }, [policy.telemetryEnabled, mountPayload, unmountPayload]);

    /** hidden */
    if (!policy.isVisible) return null;

    return (
      <CoreAvatar
        ref={ref}
        {...(src != null ? { src } : {})}
        alt={alt}
        fallbackText={fallbackText}
        data-component='AppAvatar'
        {...coreProps}
      />
    );
  },
);

// Устанавливаем displayName для лучшей отладки
// eslint-disable-next-line functional/immutable-data
AvatarComponent.displayName = 'Avatar';

/**
 * Memoized App Avatar with ref forwarding.
 *
 * Подходит для:
 * - UI-компонентов
 * - workflow
 * - design-system интеграций
 */
export const Avatar = memo(AvatarComponent);
