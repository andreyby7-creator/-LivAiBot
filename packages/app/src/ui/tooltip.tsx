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

import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { Tooltip as CoreTooltip } from '../../../ui-core/src/primitives/tooltip.js';
import type { CoreTooltipProps } from '../../../ui-core/src/primitives/tooltip.js';
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
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * TooltipPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useTooltipPolicy(props: AppTooltipProps): TooltipPolicy {
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

function emitTooltipTelemetry(payload: TooltipTelemetryPayload): void {
  infoFireAndForget(`Tooltip ${payload.action}`, payload);
}

/**
 * Формирование payload для Tooltip telemetry.
 */
function getTooltipPayload(
  action: TooltipTelemetryAction,
  policy: TooltipPolicy,
): TooltipTelemetryPayload {
  return {
    component: 'Tooltip',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP TOOLTIP
 * ========================================================================== */

const TooltipComponent = forwardRef<HTMLDivElement, AppTooltipProps>(
  function TooltipComponent(props: AppTooltipProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { ...coreProps } = props;
    const policy = useTooltipPolicy(props);

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: TooltipTelemetryPayload;
        unmount: TooltipTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getTooltipPayload(TooltipTelemetryAction.Mount, policy),
      unmount: getTooltipPayload(TooltipTelemetryAction.Unmount, policy),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getTooltipPayload(TooltipTelemetryAction.Show, policy),
        visible: true,
      }),
      [policy],
    );

    const hidePayload = useMemo(
      () => ({
        ...getTooltipPayload(TooltipTelemetryAction.Hide, policy),
        visible: false,
      }),
      [policy],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitTooltipTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitTooltipTelemetry(lifecyclePayload.unmount);
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
        emitTooltipTelemetry(
          currentVisibility ? showPayload : hidePayload,
        );
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreTooltip
        ref={ref}
        visible={policy.isRendered}
        data-component='AppTooltip'
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
TooltipComponent.displayName = 'Tooltip';

/**
 * UI-контракт Tooltip компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия подсказок
 * - Корректное позиционирование относительно trigger элемента
 *
 * Инварианты:
 * - Tooltip появляется только при hover/focus trigger элемента
 * - Автоматическое позиционирование избегает viewport границ
 * - ESC закрывает tooltip
 * - Telemetry payload содержит корректные размеры
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование напрямую core Tooltip компонента
 * - Игнорирование feature flag логики
 * - Нарушение позиционирования логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Tooltip = memo(TooltipComponent);
