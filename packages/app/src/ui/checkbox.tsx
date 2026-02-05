/**
 * @file packages/app/src/ui/checkbox.tsx
 * ============================================================================
 * 🟥 APP UI CHECKBOX — UI МИКРОСЕРВИС ЧЕКБОКСА
 * ============================================================================
 *
 * Единственная точка входа для Checkbox в приложении.
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

import React, { forwardRef, memo, useCallback, useEffect, useMemo } from 'react';
import type { JSX } from 'react';

import { Checkbox as CoreCheckbox } from '../../../ui-core/src/primitives/checkbox.js';
import type { CoreCheckboxProps } from '../../../ui-core/src/primitives/checkbox.js';
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

type CheckboxTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type CheckboxTelemetryPayload = {
  component: 'Checkbox';
  action: CheckboxTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
  checked?: boolean;
  indeterminate?: boolean;
};

type AppCheckboxBusinessProps = {
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
};

export type AppCheckboxProps = Readonly<
  & CoreCheckboxProps
  & AppCheckboxBusinessProps
>;

/** Алиас для UI feature flags в контексте checkbox wrapper */
export type CheckboxUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте checkbox */
export type CheckboxWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте checkbox */
export type CheckboxMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

/* ============================================================================
 * 🛠️ УТИЛИТЫ
 * ========================================================================== */
function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const keySet = new Set(keys as readonly string[]);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keySet.has(key)),
  ) as Omit<T, K>;
}

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryEnabled',
  'telemetryOnChange',
  'telemetryOnFocus',
  'telemetryOnBlur',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type CheckboxPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnChange: boolean;
  readonly telemetryOnFocus: boolean;
  readonly telemetryOnBlur: boolean;
}>;

function useCheckboxPolicy(props: AppCheckboxProps): CheckboxPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<CheckboxPolicy>(() => ({
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

function emitCheckboxTelemetry(
  telemetry: UiTelemetryApi,
  action: CheckboxTelemetryAction,
  policy: CheckboxPolicy,
  checked?: boolean,
  indeterminate?: boolean,
): void {
  if (!policy.telemetryEnabled) return;

  const payload: CheckboxTelemetryPayload = {
    component: 'Checkbox',
    action,
    variant: policy.variant,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
    ...(checked !== undefined && { checked }),
    indeterminate: indeterminate ?? false, // Всегда включаем indeterminate для консистентности
  };

  telemetry.infoFireAndForget(`Checkbox ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP CHECKBOX
 * ========================================================================== */

const CheckboxComponent = forwardRef<HTMLInputElement, AppCheckboxProps>(
  function CheckboxComponent(props, ref): JSX.Element | null {
    const { telemetry } = useUnifiedUI();
    const policy = useCheckboxPolicy(props);

    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const { onChange, onFocus, onBlur, checked, indeterminate } = domProps;

    // Телеметрия жизненного цикла
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitCheckboxTelemetry(telemetry, 'mount', policy, checked, indeterminate);
        return (): void => {
          emitCheckboxTelemetry(telemetry, 'unmount', policy, checked, indeterminate);
        };
      }
      return undefined;
      // Policy намеренно заморожена при монтировании
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Обработчики событий
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (policy.disabledByFeatureFlag) return;

        if (policy.telemetryEnabled && policy.telemetryOnChange) {
          emitCheckboxTelemetry(telemetry, 'change', policy, event.target.checked, indeterminate);
        }

        onChange?.(event);
      },
      [policy, onChange, indeterminate, telemetry],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryEnabled && policy.telemetryOnFocus) {
          emitCheckboxTelemetry(telemetry, 'focus', policy, event.target.checked, indeterminate);
        }

        onFocus?.(event);
      },
      [policy, onFocus, indeterminate, telemetry],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryEnabled && policy.telemetryOnBlur) {
          emitCheckboxTelemetry(telemetry, 'blur', policy, event.target.checked, indeterminate);
        }

        onBlur?.(event);
      },
      [policy, onBlur, indeterminate, telemetry],
    );

    // Скрываем компонент по фиче-флагу
    if (policy.hiddenByFeatureFlag) {
      return null;
    }

    // Рендер
    return (
      <CoreCheckbox
        ref={ref}
        {...domProps}
        {...(checked !== undefined ? { checked } : {})}
        readOnly={checked !== undefined && !onChange ? true : undefined}
        data-component='AppCheckbox'
        disabled={policy.disabledByFeatureFlag || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabledByFeatureFlag || undefined}
        aria-disabled={policy.disabledByFeatureFlag || undefined}
        aria-checked={checked !== undefined ? Boolean(checked) : undefined}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * UI-контракт Checkbox компонента.
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
 * - Использование напрямую core Checkbox компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Checkbox = Object.assign(memo(CheckboxComponent), {
  displayName: 'Checkbox',
});
