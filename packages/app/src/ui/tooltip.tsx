/**
 * @file packages/app/src/ui/tooltip.tsx
 * ============================================================================
 * 🟥 APP UI TOOLTIP — UI МИКРОСЕРВИС TOOLTIP
 * ============================================================================
 *
 * Единственная точка входа для Tooltip в приложении.
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

import { Tooltip as CoreTooltip } from '../../../ui-core/src/primitives/tooltip.js';
import type { CoreTooltipProps } from '../../../ui-core/src/primitives/tooltip.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum TooltipTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

type TooltipTelemetryPayload = {
  component: 'Tooltip';
  action: TooltipTelemetryAction;
  hidden: boolean;
  visible: boolean;
};

export type AppTooltipProps = Readonly<
  Omit<CoreTooltipProps, 'visible'> & {
    /** Видимость tooltip (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть Tooltip */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type TooltipPolicy = Readonly<{
  hidden: boolean;
  isVisible: boolean;
  telemetryEnabled: boolean;
}>;

function useTooltipPolicy(props: AppTooltipProps): TooltipPolicy {
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

function emitTooltipTelemetry(payload: TooltipTelemetryPayload): void {
  infoFireAndForget(`Tooltip ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP TOOLTIP
 * ========================================================================== */

const TooltipComponent = forwardRef<HTMLDivElement, AppTooltipProps>(
  function TooltipComponent(props: AppTooltipProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { visible = false, ...coreProps } = props;
    const policy = useTooltipPolicy(props);

    const mountPayload = useMemo<TooltipTelemetryPayload>(
      () => ({
        component: 'Tooltip',
        action: TooltipTelemetryAction.Mount,
        hidden: policy.hidden,
        visible,
      }),
      [policy.hidden, visible],
    );

    const unmountPayload = useMemo<TooltipTelemetryPayload>(
      () => ({
        component: 'Tooltip',
        action: TooltipTelemetryAction.Unmount,
        hidden: policy.hidden,
        visible,
      }),
      [policy.hidden, visible],
    );

    const showPayload = useMemo<TooltipTelemetryPayload>(
      () => ({
        component: 'Tooltip',
        action: TooltipTelemetryAction.Show,
        hidden: policy.hidden,
        visible: true,
      }),
      [policy.hidden],
    );

    const hidePayload = useMemo<TooltipTelemetryPayload>(
      () => ({
        component: 'Tooltip',
        action: TooltipTelemetryAction.Hide,
        hidden: policy.hidden,
        visible: false,
      }),
      [policy.hidden],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitTooltipTelemetry(mountPayload);
      return (): void => {
        emitTooltipTelemetry(unmountPayload);
      };
    }, [policy.telemetryEnabled, mountPayload, unmountPayload]);

    /** Telemetry for visibility changes */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      if (visible) {
        emitTooltipTelemetry(showPayload);
      } else {
        emitTooltipTelemetry(hidePayload);
      }
    }, [visible, policy.telemetryEnabled, showPayload, hidePayload]);

    /** Policy: hidden */
    if (!policy.isVisible) return null;

    /** Don't render if not visible */
    if (!visible) return null;

    return (
      <CoreTooltip
        ref={ref}
        visible={visible}
        data-component='AppTooltip'
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
TooltipComponent.displayName = 'Tooltip';

/**
 * Memoized App Tooltip with ref forwarding.
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
export const Tooltip = memo(TooltipComponent);
