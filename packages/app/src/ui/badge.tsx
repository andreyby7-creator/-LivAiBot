/**
 * @file packages/app/src/ui/badge.tsx
 * ============================================================================
 * 🟥 APP UI BADGE — UI МИКРОСЕРВИС BADGE
 * ============================================================================
 *
 * Единственная точка входа для Badge в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import { forwardRef, memo, useEffect, useMemo } from 'react';
import type { JSX, Ref } from 'react';

import { Badge as CoreBadge } from '../../../ui-core/src/primitives/badge.js';
import type { CoreBadgeProps } from '../../../ui-core/src/primitives/badge.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum BadgeTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
}

type BadgeTelemetryPayload = {
  component: 'Badge';
  action: BadgeTelemetryAction;
  hidden: boolean;
  value: string | number | null;
};

export type AppBadgeProps = Readonly<
  & CoreBadgeProps
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type BadgePolicy = Readonly<{
  hidden: boolean;
  isVisible: boolean;
  telemetryEnabled: boolean;
}>;

function useBadgePolicy(props: AppBadgeProps): BadgePolicy {
  const hiddenByFlag = useFeatureFlag(props.isHiddenByFeatureFlag ?? false);

  return useMemo(
    () => ({
      hidden: hiddenByFlag,
      isVisible: !hiddenByFlag,
      telemetryEnabled: props.telemetryEnabled !== false,
    }),
    [hiddenByFlag, props.telemetryEnabled],
  );
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitBadgeTelemetry(payload: BadgeTelemetryPayload): void {
  infoFireAndForget(`Badge ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP BADGE
 * ========================================================================== */

const BadgeComponent = forwardRef<HTMLSpanElement, AppBadgeProps>(
  function BadgeComponent(props: AppBadgeProps, ref: Ref<HTMLSpanElement>): JSX.Element | null {
    const { value = null, ...coreProps } = props;

    if (process.env['NODE_ENV'] !== 'production' && value == null) {
      // eslint-disable-next-line no-console
      console.warn(
        '[AppBadge]: value is null or undefined. Badge usually should display something.',
      );
    }

    const policy = useBadgePolicy(props);

    const mountPayload = useMemo<BadgeTelemetryPayload>(
      () => ({
        component: 'Badge',
        action: BadgeTelemetryAction.Mount,
        hidden: policy.hidden,
        value,
      }),
      [policy.hidden, value],
    );

    const unmountPayload = useMemo<BadgeTelemetryPayload>(
      () => ({
        component: 'Badge',
        action: BadgeTelemetryAction.Unmount,
        hidden: policy.hidden,
        value,
      }),
      [policy.hidden, value],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitBadgeTelemetry(mountPayload);
      return (): void => {
        emitBadgeTelemetry(unmountPayload);
      };
    }, [policy.telemetryEnabled, mountPayload, unmountPayload]);

    /** Policy: hidden */
    if (!policy.isVisible) return null;

    return (
      <CoreBadge
        ref={ref}
        value={value}
        data-component='AppBadge'
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
BadgeComponent.displayName = 'Badge';

/**
 * Memoized App Badge with ref forwarding.
 *
 * Подходит для:
 * - UI-компонентов
 * - workflow
 * - design-system интеграций
 *
 * Гарантии:
 * - Чёткое разделение Core и App слоёв
 * - Централизованная telemetry
 * - Управление фичефлагами в одном месте
 */
export const Badge = memo(BadgeComponent);
