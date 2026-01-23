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

import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { Badge as CoreBadge } from '../../../ui-core/src/primitives/badge.js';
import type { CoreBadgeProps } from '../../../ui-core/src/primitives/badge.js';
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
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

function useBadgePolicy(props: AppBadgeProps): BadgePolicy {
  const hiddenByFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(
    () => ({
      hiddenByFeatureFlag: hiddenByFlag,
      isRendered: !hiddenByFlag,
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

    const lifecyclePayloadRef = useRef<
      {
        mount: BadgeTelemetryPayload;
        unmount: BadgeTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: {
        component: 'Badge' as const,
        action: BadgeTelemetryAction.Mount,
        hidden: policy.hiddenByFeatureFlag,
        value,
      },
      unmount: {
        component: 'Badge' as const,
        action: BadgeTelemetryAction.Unmount,
        hidden: policy.hiddenByFeatureFlag,
        value,
      },
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitBadgeTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitBadgeTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

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
 * UI-контракт Badge компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия бейджей
 * - Корректное отображение числовых значений
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Числовые значения отображаются корректно
 * - Feature flags полностью изолированы от Core логики
 * - Telemetry payload содержит корректное значение
 *
 * Не допускается:
 * - Использование напрямую core Badge компонента
 * - Передача невалидных числовых значений
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 */
export const Badge = memo(BadgeComponent);
