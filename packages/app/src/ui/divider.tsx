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
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { Json } from '../types/common.js';
import type {
  AppWrapperProps,
  MapCoreProps,
  UiFeatureFlags,
  UiPrimitiveProps,
  UiTelemetryApi,
} from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте divider wrapper */
export type DividerUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте divider */
export type DividerWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте divider */
export type DividerMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppDividerProps = Readonly<
  & Omit<CoreDividerProps, 'aria-label'>
  & {
    /** Feature flag: скрыть Divider */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;
  }
  & (
    | {
      /** I18n aria-label режим */
      ariaLabelI18nKey: TranslationKey;
      ariaLabelI18nNs?: Namespace;
      ariaLabelI18nParams?: Record<string, string | number>;
      'aria-label'?: never;
    }
    | {
      /** Обычный aria-label режим */
      ariaLabelI18nKey?: never;
      ariaLabelI18nNs?: never;
      ariaLabelI18nParams?: never;
      'aria-label'?: string;
    }
  )
>;

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
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

function emitDividerTelemetry(telemetry: UiTelemetryApi, payload: DividerTelemetryPayload): void {
  telemetry.infoFireAndForget(`Divider ${payload.action}`, payload);
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
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabel = useMemo<string | undefined>(() => {
      if ('ariaLabelI18nKey' in props) {
        const effectiveNs = props.ariaLabelI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelI18nKey,
          props.ariaLabelI18nParams ?? EMPTY_PARAMS,
        );
      }
      return domProps['aria-label'];
    }, [props, translate, domProps]);

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

      emitDividerTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitDividerTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreDivider
        ref={ref}
        data-component='AppDivider'
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
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
