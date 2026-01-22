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
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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

export type AppCheckboxProps = Readonly<
  & CoreCheckboxProps
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
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type CheckboxPolicy = Readonly<{
  hidden: boolean;
  disabled: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  telemetryOnChange: boolean;
  telemetryOnFocus: boolean;
  telemetryOnBlur: boolean;
}>;

function useCheckboxPolicy(props: AppCheckboxProps): CheckboxPolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag);
  const disabled = useFeatureFlag(props.isDisabledByFeatureFlag);

  return useMemo<CheckboxPolicy>(() => ({
    hidden,
    disabled,
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
    hidden: policy.hidden,
    disabled: policy.disabled,
    ...(checked !== undefined && { checked }),
    ...(indeterminate !== undefined && { indeterminate }),
  };

  infoFireAndForget(`Checkbox ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP CHECKBOX
 * ========================================================================== */

const CheckboxComponent = forwardRef<HTMLInputElement, AppCheckboxProps>(
  function CheckboxComponent(props, ref): JSX.Element | null {
    const { onChange, onFocus, onBlur, checked = false, indeterminate = false, ...rest } = props;

    const policy = useCheckboxPolicy(props);

    /** телеметрия жизненного цикла */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitCheckboxTelemetry('mount', policy, checked, indeterminate);
        return (): void => {
          emitCheckboxTelemetry('unmount', policy, checked, indeterminate);
        };
      }
      return undefined;
      // Policy намеренно заморожена при монтировании
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** обработчики событий */
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (policy.disabled) return;

        if (policy.telemetryEnabled && policy.telemetryOnChange) {
          emitCheckboxTelemetry('change', policy, event.target.checked, indeterminate);
        }

        onChange?.(event);
      },
      [policy, onChange, indeterminate],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryEnabled && policy.telemetryOnFocus) {
          emitCheckboxTelemetry('focus', policy, event.target.checked, indeterminate);
        }

        onFocus?.(event);
      },
      [policy, onFocus, indeterminate],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryEnabled && policy.telemetryOnBlur) {
          emitCheckboxTelemetry('blur', policy, event.target.checked, indeterminate);
        }

        onBlur?.(event);
      },
      [policy, onBlur, indeterminate],
    );

    /** hidden */
    if (policy.hidden) {
      return null;
    }

    /** View */
    return (
      <CoreCheckbox
        ref={ref}
        {...rest}
        checked={checked}
        indeterminate={indeterminate}
        data-component='AppCheckbox'
        disabled={policy.disabled || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabled || undefined}
        aria-disabled={policy.disabled || undefined}
        aria-busy={policy.disabled || undefined}
        aria-checked={Boolean(checked)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * Memoized Checkbox with ref forwarding.
 *
 * Подходит для:
 * - фильтров
 * - форм ввода (react-hook-form, final-form)
 * - workflow UI
 * - программного управления (focus, scrollIntoView)
 */
export const Checkbox = Object.assign(memo(CheckboxComponent), {
  displayName: 'Checkbox',
});
