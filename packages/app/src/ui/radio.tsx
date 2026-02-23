/**
 * @file packages/app/src/ui/radio.tsx
 * ============================================================================
 * 🟥 APP UI RADIO — UI МИКРОСЕРВИС РАДИО-КНОПКИ
 * ============================================================================
 *
 * Единственная точка входа для Radio в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (disabled / hidden / variant)
 * - Telemetry
 * - Feature flags
 * - Accessibility контекст
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import { Radio as CoreRadio } from '@livai/ui-core';
import type { CoreRadioProps } from '@livai/ui-core';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { JSX } from 'react';

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

/** Алиас для UI feature flags в контексте radio wrapper */
export type RadioUiFeatureFlags = UiFeatureFlags;

/** Алиас для props wrapper'а radio */
export type RadioWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга props core radio */
export type RadioMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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
 * 🧬 TYPES
 * ========================================================================== */

type RadioTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type RadioTelemetryPayload = {
  component: 'Radio';
  action: RadioTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
  checked?: boolean;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppRadioProps = Readonly<
  & Omit<CoreRadioProps, 'aria-label'>
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить интерактивность */
    isDisabledByFeatureFlag?: boolean;

    /** Feature flag: визуальный вариант */
    variantByFeatureFlag?: string;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Telemetry for value change */
    telemetryOnChange?: boolean;

    /** Telemetry for focus events */
    telemetryOnFocus?: boolean;

    /** Telemetry for blur events */
    telemetryOnBlur?: boolean;
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
  'isDisabledByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryEnabled',
  'telemetryOnChange',
  'telemetryOnFocus',
  'telemetryOnBlur',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type RadioPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnChange: boolean;
  readonly telemetryOnFocus: boolean;
  readonly telemetryOnBlur: boolean;
}>;

function useRadioPolicy(props: AppRadioProps): RadioPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<RadioPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    disabledByFeatureFlag: disabled,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryEnabled !== false,
    telemetryOnChange: props.telemetryOnChange !== false,
    telemetryOnFocus: props.telemetryOnFocus !== false,
    telemetryOnBlur: props.telemetryOnBlur !== false,
  }), [
    hidden,
    disabled,
    props.variantByFeatureFlag,
    props.telemetryEnabled,
    props.telemetryOnChange,
    props.telemetryOnFocus,
    props.telemetryOnBlur,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitRadioTelemetry(
  telemetry: UiTelemetryApi,
  action: RadioTelemetryAction,
  policy: RadioPolicy,
  checked?: boolean,
): void {
  if (!policy.telemetryEnabled) return;

  const payload: RadioTelemetryPayload = {
    component: 'Radio',
    action,
    variant: policy.variant,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
    ...(checked !== undefined && { checked }),
  };

  telemetry.infoFireAndForget(`Radio ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP RADIO
 * ========================================================================== */

const RadioComponent = forwardRef<HTMLInputElement, AppRadioProps>(
  function RadioComponent(props, ref): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const { onChange, onFocus, onBlur, checked = false, ...filteredCoreProps } = domProps;

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

    const policy = useRadioPolicy(props);
    const internalRef = useRef<HTMLInputElement | null>(null);

    // Безопасная пересылка ref
    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('input'), [
      internalRef,
    ]); // Fallback для случаев, когда компонент скрыт или ref не инициализирован

    // Жизненный цикл telemetry
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitRadioTelemetry(telemetry, 'mount', policy, checked);
        return (): void => {
          emitRadioTelemetry(telemetry, 'unmount', policy, checked);
        };
      }
      return undefined;
      // Policy намеренно frozen
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Синхронизация checked для безопасного concurrent rendering
    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.checked = Boolean(checked);
      }
    }, [checked]);

    // Обработчики событий
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (policy.disabledByFeatureFlag) return;

        if (policy.telemetryOnChange) {
          emitRadioTelemetry(telemetry, 'change', policy, event.target.checked);
        }

        onChange?.(event);
      },
      [policy, onChange, telemetry],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnFocus) {
          emitRadioTelemetry(telemetry, 'focus', policy, event.target.checked);
        }

        onFocus?.(event);
      },
      [policy, onFocus, telemetry],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnBlur) {
          emitRadioTelemetry(telemetry, 'blur', policy, event.target.checked);
        }

        onBlur?.(event);
      },
      [policy, onBlur, telemetry],
    );

    // hidden
    if (policy.hiddenByFeatureFlag) return null;

    // View
    return (
      <CoreRadio
        ref={internalRef}
        {...filteredCoreProps}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        data-component='AppRadio'
        disabled={policy.disabledByFeatureFlag}
        data-variant={policy.variant}
        data-disabled={policy.disabledByFeatureFlag || undefined}
        aria-disabled={policy.disabledByFeatureFlag || undefined}
        aria-busy={policy.disabledByFeatureFlag || undefined}
        aria-checked={checked}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * UI-контракт Radio компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка controlled/uncontrolled состояния
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Состояние checked синхронизировано с onChange callback
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry events отправляются только при реальных изменениях
 *
 * Не допускается:
 * - Использование напрямую core Radio компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Radio = Object.assign(memo(RadioComponent), {
  displayName: 'Radio',
});
