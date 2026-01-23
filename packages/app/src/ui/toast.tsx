/**
 * @file packages/app/src/ui/toast.tsx
 * ============================================================================
 * 🟥 APP UI TOAST — UI МИКРОСЕРВИС TOAST
 * ============================================================================
 *
 * Единственная точка входа для Toast в приложении.
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

import { Toast as CoreToast } from '../../../ui-core/src/components/Toast.js';
import type { CoreToastProps, ToastVariant } from '../../../ui-core/src/components/Toast.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

const DEFAULT_VARIANT: ToastVariant = 'info';

enum ToastTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

type ToastTelemetryPayload = {
  component: 'Toast';
  action: ToastTelemetryAction;
  hidden: boolean;
  visible: boolean;
  variant: ToastVariant;
};

export type AppToastProps = Readonly<
  Omit<CoreToastProps, 'visible'> & {
    /** Видимость Toast (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть Toast */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type ToastPolicy = Readonly<{
  hidden: boolean;
  isVisible: boolean;
  telemetryEnabled: boolean;
}>;

function useToastPolicy(
  isHiddenByFeatureFlag: boolean | undefined,
  telemetryEnabled: boolean | undefined,
): ToastPolicy {
  const hiddenByFlag = useFeatureFlag(isHiddenByFeatureFlag ?? false);

  return useMemo(() => ({
    hidden: hiddenByFlag,
    isVisible: !hiddenByFlag,
    telemetryEnabled: telemetryEnabled !== false,
  }), [hiddenByFlag, telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitToastTelemetry(payload: ToastTelemetryPayload): void {
  infoFireAndForget(`Toast ${payload.action}`, payload);
}

function getToastPayload(
  action: ToastTelemetryAction,
  hidden: boolean,
  variant: ToastVariant,
  visible: boolean,
): ToastTelemetryPayload {
  return {
    component: 'Toast',
    action,
    hidden,
    visible,
    variant,
  };
}

/* ============================================================================
 * 🎯 APP TOAST
 * ========================================================================== */

const ToastComponent = forwardRef<HTMLDivElement, AppToastProps>(
  function ToastComponent(props: AppToastProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { visible = false, ...coreProps } = props;
    const policy = useToastPolicy(props.isHiddenByFeatureFlag, props.telemetryEnabled);
    const variant = props.variant ?? DEFAULT_VARIANT;

    const mountPayload = useMemo(
      () => getToastPayload(ToastTelemetryAction.Mount, policy.hidden, variant, visible),
      [policy.hidden, variant, visible],
    );

    const unmountPayload = useMemo(
      () => getToastPayload(ToastTelemetryAction.Unmount, policy.hidden, variant, visible),
      [policy.hidden, variant, visible],
    );

    const showPayload = useMemo(
      () => getToastPayload(ToastTelemetryAction.Show, policy.hidden, variant, true),
      [policy.hidden, variant],
    );

    const hidePayload = useMemo(
      () => getToastPayload(ToastTelemetryAction.Hide, policy.hidden, variant, false),
      [policy.hidden, variant],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitToastTelemetry(mountPayload);
      return (): void => {
        emitToastTelemetry(unmountPayload);
      };
    }, [policy.telemetryEnabled, mountPayload, unmountPayload]);

    /** Telemetry for visibility changes */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      if (visible) {
        emitToastTelemetry(showPayload);
      } else {
        emitToastTelemetry(hidePayload);
      }
    }, [visible, policy.telemetryEnabled, showPayload, hidePayload]);

    /** Policy: hidden */
    if (!policy.isVisible) return null;

    return (
      <CoreToast
        ref={ref}
        visible={visible}
        data-component='AppToast'
        data-variant={variant}
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
ToastComponent.displayName = 'Toast';

/**
 * Memoized App Toast with ref forwarding.
 *
 * Подходит для:
 * - UI уведомлений
 * - workflow
 * - design-system интеграций
 *
 * Гарантии:
 * - Чёткое разделение Core и App слоёв
 * - Централизованная telemetry
 * - Управление фичефлагами в одном месте
 */
export const Toast = memo(ToastComponent);
