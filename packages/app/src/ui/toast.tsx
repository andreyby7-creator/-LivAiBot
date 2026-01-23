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

import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { Toast as CoreToast } from '../../../ui-core/src/components/Toast.js';
import type { CoreToastProps, ToastVariant } from '../../../ui-core/src/components/Toast.js';
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
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * ToastPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useToastPolicy(
  props: AppToastProps,
): ToastPolicy {
  const hiddenByFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFlag && props.visible !== false;
    return {
      hiddenByFeatureFlag: hiddenByFlag,
      isRendered,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [hiddenByFlag, props.visible, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitToastTelemetry(payload: ToastTelemetryPayload): void {
  infoFireAndForget(`Toast ${payload.action}`, payload);
}

/**
 * Формирование payload для Toast telemetry.
 */
function getToastPayload(
  action: ToastTelemetryAction,
  policy: ToastPolicy,
  telemetryProps: {
    variant: ToastVariant;
  },
): ToastTelemetryPayload {
  return {
    component: 'Toast',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    variant: telemetryProps.variant,
  };
}

/* ============================================================================
 * 🎯 APP TOAST
 * ========================================================================== */

const ToastComponent = forwardRef<HTMLDivElement, AppToastProps>(
  function ToastComponent(props: AppToastProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { ...coreProps } = props;
    const policy = useToastPolicy(props);
    const variant = props.variant ?? DEFAULT_VARIANT;

    /** Минимальный набор telemetry-данных */
    const telemetryProps = useMemo(() => ({
      variant,
    }), [variant]);

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: ToastTelemetryPayload;
        unmount: ToastTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getToastPayload(ToastTelemetryAction.Mount, policy, telemetryProps),
      unmount: getToastPayload(ToastTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getToastPayload(ToastTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getToastPayload(ToastTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitToastTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitToastTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    /** Telemetry for visibility changes - only on changes, not on mount */
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitToastTelemetry(
          currentVisibility ? showPayload : hidePayload,
        );
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreToast
        ref={ref}
        visible={policy.isRendered}
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
 * UI-контракт Toast компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия уведомлений
 * - Корректная обработка accessibility (ARIA live regions)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректный variant
 * - Feature flags полностью изолированы от Core логики
 * - ARIA атрибуты соответствуют WCAG стандартам
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование напрямую core Toast компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Нарушение accessibility контрактов
 * - Использование props.visible напрямую вне policy
 */
export const Toast = memo(ToastComponent);
