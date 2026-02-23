/**
 * @file packages/app/src/ui/icon.tsx
 * ============================================================================
 * 🟥 APP UI ICON — UI МИКРОСЕРВИС ИКОНКИ
 * ============================================================================
 *
 * Единственная точка входа для Icon в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / variant / size / color)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import { Icon as CoreIcon } from '@livai/ui-core';
import type { CoreIconProps } from '@livai/ui-core';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

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

CoreIcon.displayName = 'CoreIcon';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type IconTelemetryAction = 'mount' | 'unmount';

type IconTelemetryPayload = {
  component: 'Icon';
  action: IconTelemetryAction;
  hidden: boolean;
  variant: string | null;
  name: string;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppIconProps = Readonly<
  & Omit<CoreIconProps, 'aria-label'>
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: визуальный вариант */
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

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type IconPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
}>;

function useIconPolicy(props: AppIconProps): IconPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);

  return useMemo<IconPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryEnabled !== false,
  }), [
    hidden,
    props.variantByFeatureFlag,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitIconTelemetry(
  telemetry: UiTelemetryApi,
  action: IconTelemetryAction,
  policy: IconPolicy,
  name: string,
): void {
  if (!policy.telemetryEnabled) return;

  const payload: IconTelemetryPayload = {
    component: 'Icon',
    action,
    hidden: policy.hiddenByFeatureFlag,
    variant: policy.variant,
    name,
  };

  telemetry.infoFireAndForget(`Icon ${action}`, payload);
}

/** Алиас для UI feature flags в контексте icon wrapper */
export type IconUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте icon */
export type IconWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте icon */
export type IconMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

/* ============================================================================
 * 🎯 APP ICON
 * ========================================================================== */

const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryEnabled',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

function omit<T extends Record<string, unknown>, K extends readonly string[]>(
  obj: T,
  keys: K,
): Omit<T, K[number]> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

const IconComponent = forwardRef<HTMLElement | null, AppIconProps>(
  function IconComponent(props: AppIconProps, ref: Ref<HTMLElement | null>): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    const filteredProps = omit(props, BUSINESS_PROPS);
    const { name, ...coreProps } = filteredProps;

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
      return filteredProps['aria-label'];
    }, [props, translate, filteredProps]);

    const policy = useIconPolicy(props);
    const internalRef = useRef<HTMLElement | null>(null);

    /** Инвариант разработки: проверка обязательного свойства name */
    if (process.env['NODE_ENV'] !== 'production' && !name) {
      // eslint-disable-next-line no-console -- Development warning для обязательного пропа name
      console.warn('[AppIcon]: name is required');
    }

    /**
     * SSR-безопасная пересылка ref с поддержкой как функциональных, так и объектных ref'ов.
     * Гарантирует корректную работу ref forwarding даже при серверном рендеринге.
     */
    const setRef = useCallback((element: HTMLElement | null) => {
      internalRef.current = element;
      if (ref) {
        if (typeof ref === 'function') {
          ref(element);
        } else {
          ref.current = element;
        }
      }
    }, [ref]);

    const debugAttributes = useMemo(
      () => (policy.hiddenByFeatureFlag ? { 'data-hidden': true } : {}),
      [policy.hiddenByFeatureFlag],
    );

    /** Жизненный цикл telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitIconTelemetry(telemetry, 'mount', policy, name);
        return (): void => {
          emitIconTelemetry(telemetry, 'unmount', policy, name);
        };
      }
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** hidden */
    if (policy.hiddenByFeatureFlag) return null;

    return (
      <CoreIcon
        ref={setRef}
        name={name}
        data-component='AppIcon'
        data-variant={policy.variant}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        {...debugAttributes}
        {...coreProps}
      />
    );
  },
);

/**
 * UI-контракт Icon компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия иконок
 * - Корректное применение CSS размеров через size prop
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Icon name соответствует существующему в системе
 * - CSS размеры применяются корректно через size prop
 * - Feature flags полностью изолированы от Core логики
 *
 * Не допускается:
 * - Использование напрямую core Icon компонента
 * - Передача несуществующих icon name
 * - Переопределение размеров через CSS вместо props
 * - Модификация telemetry payload структуры
 */
export const Icon = Object.assign(memo(IconComponent), {
  displayName: 'Icon',
});
