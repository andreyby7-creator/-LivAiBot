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

import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { Divider as CoreDivider } from '../../../ui-core/src/primitives/divider.js';
import type {
  CoreDividerProps,
  DividerOrientation,
} from '../../../ui-core/src/primitives/divider.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type DividerPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

function useDividerPolicy(props: AppDividerProps): DividerPolicy {
  const hiddenByFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => ({
    hiddenByFeatureFlag: hiddenByFlag,
    isRendered: !hiddenByFlag,
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
    hidden: policy.hiddenByFeatureFlag,
    orientation: coreProps.orientation ?? 'horizontal',
    color: coreProps.color ?? 'var(--divider-color, #E5E7EB)',
  };
}

/* ============================================================================
 * 🎯 APP DIVIDER
 * ========================================================================== */

const DividerComponent = forwardRef<HTMLElement, AppDividerProps>(
  function DividerComponent(props: AppDividerProps, ref: Ref<HTMLElement>): JSX.Element | null {
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const policy = useDividerPolicy(props);

    const lifecyclePayloadRef = useRef<
      {
        mount: DividerTelemetryPayload;
        unmount: DividerTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getDividerPayload(DividerTelemetryAction.Mount, policy, domProps),
      unmount: getDividerPayload(DividerTelemetryAction.Unmount, policy, domProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitDividerTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitDividerTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreDivider
        ref={ref}
        data-component='AppDivider'
        {...domProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
DividerComponent.displayName = 'Divider';

/**
 * UI-контракт Divider компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия разделителей
 * - Корректное применение CSS размеров (thickness)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - CSS размеры применяются корректно через thickness prop
 * - Feature flags полностью изолированы от Core логики
 * - Orientation (horizontal/vertical) работает корректно
 *
 * Не допускается:
 * - Использование напрямую core Divider компонента
 * - Переопределение размеров через CSS вместо props
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 */
export const Divider = memo(DividerComponent);
