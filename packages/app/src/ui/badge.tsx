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

/** Алиас для UI feature flags в контексте badge wrapper */
export type BadgeUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте badge */
export type BadgeWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте badge */
export type BadgeMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppBadgeProps = Readonly<
  & Omit<CoreBadgeProps, 'aria-label'>
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: variant компонента */
    variantByFeatureFlag?: string;

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

// Бизнес-пропсы и внутренние Core-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryEnabled',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
  // Внутренние пропсы CoreBadge, используемые только для стилизации
  'bgColor',
  'textColor',
] as const;

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

function emitBadgeTelemetry(telemetry: UiTelemetryApi, payload: BadgeTelemetryPayload): void {
  telemetry.infoFireAndForget(`Badge ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP BADGE
 * ========================================================================== */

const BadgeComponent = forwardRef<HTMLSpanElement, AppBadgeProps>(
  function BadgeComponent(props: AppBadgeProps, ref: Ref<HTMLSpanElement>): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const { value = null, ...filteredCoreProps } = domProps;

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

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitBadgeTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitBadgeTelemetry(telemetry, lifecyclePayload.unmount);
      };
      // Policy намеренно заморожена при монтировании
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreBadge
        ref={ref}
        value={value}
        data-component='AppBadge'
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        {...filteredCoreProps}
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
