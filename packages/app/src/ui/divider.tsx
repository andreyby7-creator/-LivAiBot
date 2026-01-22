/**
 * @file packages/app/src/ui/divider.tsx
 * ============================================================================
 * 🟥 APP UI DIVIDER — UI МИКРОСЕРВИС DIVIDER
 * ============================================================================
 *
 * Единственная точка входа для Divider в приложении.
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
 *
 * Пример использования:
 * <Divider orientation="vertical" thickness={2} color="red" length="50px" />
 */

import { forwardRef, memo, useEffect, useMemo } from 'react';
import type { JSX, Ref } from 'react';

import { Divider as CoreDivider } from '../../../ui-core/src/primitives/divider.js';
import type {
  CoreDividerProps,
  DividerOrientation,
} from '../../../ui-core/src/primitives/divider.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum DividerTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
}

type DividerTelemetryPayload = {
  component: 'Divider';
  action: DividerTelemetryAction;
  hidden: boolean;
  orientation: DividerOrientation;
  color: string;
};

export type AppDividerProps = Readonly<
  CoreDividerProps & {
    /** Feature flag: скрыть Divider */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type DividerPolicy = Readonly<{
  hidden: boolean;
  isVisible: boolean;
  telemetryEnabled: boolean;
}>;

function useDividerPolicy(props: AppDividerProps): DividerPolicy {
  const hiddenByFlag = useFeatureFlag(props.isHiddenByFeatureFlag ?? false);

  return useMemo(() => ({
    hidden: hiddenByFlag,
    isVisible: !hiddenByFlag,
    telemetryEnabled: props.telemetryEnabled !== false,
  }), [hiddenByFlag, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitDividerTelemetry(payload: DividerTelemetryPayload): void {
  infoFireAndForget(`Divider ${payload.action}`, payload);
}

function getDividerPayload(
  action: DividerTelemetryAction,
  policy: DividerPolicy,
  coreProps: CoreDividerProps,
): DividerTelemetryPayload {
  return {
    component: 'Divider',
    action,
    hidden: policy.hidden,
    orientation: coreProps.orientation ?? 'horizontal',
    color: coreProps.color ?? 'var(--divider-color, #E5E7EB)',
  };
}

/* ============================================================================
 * 🎯 APP DIVIDER
 * ========================================================================== */

const DividerComponent = forwardRef<HTMLElement, AppDividerProps>(
  function DividerComponent(props: AppDividerProps, ref: Ref<HTMLElement>): JSX.Element | null {
    const policy = useDividerPolicy(props);
    const { ...coreProps } = props;

    const mountPayload = useMemo<DividerTelemetryPayload>(
      () => getDividerPayload(DividerTelemetryAction.Mount, policy, coreProps),
      [policy, coreProps],
    );

    const unmountPayload = useMemo<DividerTelemetryPayload>(
      () => getDividerPayload(DividerTelemetryAction.Unmount, policy, coreProps),
      [policy, coreProps],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitDividerTelemetry(mountPayload);
      return (): void => {
        emitDividerTelemetry(unmountPayload);
      };
    }, [policy.telemetryEnabled, mountPayload, unmountPayload]);

    /** Policy: hidden */
    if (!policy.isVisible) return null;

    return (
      <CoreDivider
        ref={ref}
        data-component='AppDivider'
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
DividerComponent.displayName = 'Divider';

/**
 * Memoized App Divider with ref forwarding.
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
export const Divider = memo(DividerComponent);
