/**
 * @file packages/app/src/ui/toggle.tsx
 * ============================================================================
 * 🟥 APP UI TOGGLE — UI МИКРОСЕРВИС TOGGLE/SWITCH
 * ============================================================================
 *
 * Единственная точка входа для Toggle в приложении.
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

import { Toggle as CoreToggle } from '../../../ui-core/src/primitives/toggle.js';
import type { CoreToggleProps } from '../../../ui-core/src/primitives/toggle.js';
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

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Бизнес-пропсы, которые не должны попадать в DOM */
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

/** Функция для фильтрации бизнес-пропсов */
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

type ToggleTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type ToggleTelemetryPayload = {
  component: 'Toggle';
  action: ToggleTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
  checked?: boolean;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppToggleProps = Readonly<
  & Omit<CoreToggleProps, 'checked' | 'aria-label'> // Исключаем checked и aria-label из CoreToggleProps
  & {
    /** Состояние toggle (controlled mode) */
    checked?: boolean;

    /** Начальное состояние toggle (uncontrolled mode) */
    defaultChecked?: boolean;

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

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type TogglePolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnChange: boolean;
  readonly telemetryOnFocus: boolean;
  readonly telemetryOnBlur: boolean;
}>;

function useTogglePolicy(props: AppToggleProps): TogglePolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<TogglePolicy>(() => ({
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

function emitToggleTelemetry(
  telemetry: UiTelemetryApi,
  action: ToggleTelemetryAction,
  policy: TogglePolicy,
  checked?: boolean,
): void {
  if (!policy.telemetryEnabled) return;

  const payload: ToggleTelemetryPayload = {
    component: 'Toggle',
    action,
    variant: policy.variant,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
    ...(checked !== undefined && { checked }),
  };

  telemetry.infoFireAndForget(`Toggle ${action}`, payload);
}

/** Алиас для UI feature flags в контексте toggle wrapper */
export type ToggleUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте toggle */
export type ToggleWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте toggle */
export type ToggleMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

/* ============================================================================
 * 🎯 APP TOGGLE
 * ========================================================================== */

const ToggleComponent = forwardRef<HTMLInputElement, AppToggleProps>(
  function ToggleComponent(props, ref): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Сначала фильтруем бизнес-пропсы
    const filteredProps = omit(props, BUSINESS_PROPS);

    const {
      onChange,
      onFocus,
      onBlur,
      checked,
      defaultChecked = false,
      indeterminate = false,
      ...coreProps
    } = filteredProps;

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

    const policy = useTogglePolicy(props);
    const internalRef = useRef<HTMLInputElement | null>(null);
    const checkedRef = useRef<boolean>(checked ?? defaultChecked);

    // Синхронизируем ref с актуальным значением checked для telemetry

    checkedRef.current = checked ?? defaultChecked;

    /** Безопасная пересылка ref */
    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('input'), [
      internalRef,
    ]);

    /** Жизненный цикл telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitToggleTelemetry(telemetry, 'mount', policy, checkedRef.current);
        return (): void => {
          emitToggleTelemetry(telemetry, 'unmount', policy, checkedRef.current);
        };
      }
      return undefined;
      // Policy намеренно frozen
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Синхронизация checked для безопасности concurrent rendering */
    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.checked = Boolean(checked);
      }
    }, [checked]);

    /** Синхронизация indeterminate для безопасности concurrent rendering */
    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    /** Обработчики событий */
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (policy.disabledByFeatureFlag) return;

        if (policy.telemetryOnChange) {
          emitToggleTelemetry(telemetry, 'change', policy, event.target.checked);
        }

        onChange?.(event);
      },
      [policy, onChange, telemetry],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnFocus) {
          emitToggleTelemetry(telemetry, 'focus', policy, event.target.checked);
        }

        onFocus?.(event);
      },
      [policy, onFocus, telemetry],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnBlur) {
          emitToggleTelemetry(telemetry, 'blur', policy, event.target.checked);
        }

        onBlur?.(event);
      },
      [policy, onBlur, telemetry],
    );

    /** hidden */
    if (policy.hiddenByFeatureFlag) return null;

    /** View */
    return (
      <CoreToggle
        ref={internalRef}
        {...coreProps}
        {...(checked !== undefined ? { checked } : { defaultChecked })}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        indeterminate={indeterminate}
        data-component='AppToggle'
        disabled={policy.disabledByFeatureFlag || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabledByFeatureFlag || undefined}
        aria-disabled={policy.disabledByFeatureFlag || undefined}
        aria-busy={policy.disabledByFeatureFlag || undefined}
        aria-checked={checked ?? defaultChecked}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * UI-контракт Toggle компонента.
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
 * - Использование напрямую core Toggle компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Toggle = Object.assign(memo(ToggleComponent), {
  displayName: 'Toggle',
});
