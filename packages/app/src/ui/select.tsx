/**
 * @file packages/app/src/ui/select.tsx
 * ============================================================================
 * 🟥 APP UI SELECT — UI МИКРОСЕРВИС ВЫПАДАЮЩЕГО СПИСКА
 * ============================================================================
 *
 * Единственная точка входа для Select в приложении.
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

import { Select as CoreSelect } from '../../../ui-core/src/primitives/select.js';
import type { CoreSelectProps } from '../../../ui-core/src/primitives/select.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type SelectTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type SelectTelemetryPayload = Readonly<{
  component: 'Select';
  action: SelectTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
}>;

export type AppSelectProps = Readonly<
  & CoreSelectProps
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

    /** Test ID for unit/e2e testing */
    'data-testid'?: string;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type SelectPolicy = Readonly<{
  hidden: boolean;
  disabled: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  telemetryOnChange: boolean;
  telemetryOnFocus: boolean;
  telemetryOnBlur: boolean;
}>;

function useSelectPolicy(props: AppSelectProps): SelectPolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag);
  const disabled = useFeatureFlag(props.isDisabledByFeatureFlag);

  return useMemo<SelectPolicy>(() => ({
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

function emitSelectTelemetry(
  action: SelectTelemetryAction,
  policy: SelectPolicy,
): void {
  const payload: SelectTelemetryPayload = {
    component: 'Select',
    action,
    variant: policy.variant,
    hidden: policy.hidden,
    disabled: policy.disabled,
  };

  infoFireAndForget(`Select ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP SELECT
 * ========================================================================== */

const SelectComponent = forwardRef<HTMLSelectElement, AppSelectProps>(
  function SelectComponent(props, ref): JSX.Element | null {
    const {
      onChange,
      onFocus,
      onBlur,
      'data-testid': dataTestId,
      ...coreProps
    } = props;

    const policy = useSelectPolicy(props);

    /** lifecycle telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitSelectTelemetry('mount', policy);
        return (): void => {
          emitSelectTelemetry('unmount', policy);
        };
      }
      return undefined;
      // Policy intentionally frozen on mount.
      // Telemetry must reflect initial rendering context.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** event handlers */
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (policy.disabled) return;

        if (policy.telemetryEnabled && policy.telemetryOnChange) {
          emitSelectTelemetry('change', policy);
        }

        onChange?.(event);
      },
      [policy, onChange],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLSelectElement>) => {
        if (policy.telemetryEnabled && policy.telemetryOnFocus) {
          emitSelectTelemetry('focus', policy);
        }

        onFocus?.(event);
      },
      [policy, onFocus],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLSelectElement>) => {
        if (policy.telemetryEnabled && policy.telemetryOnBlur) {
          emitSelectTelemetry('blur', policy);
        }

        onBlur?.(event);
      },
      [policy, onBlur],
    );

    /** hidden */
    if (policy.hidden) {
      return null;
    }

    /** View (максимально тупая) */
    /*
    Future ARIA для кастомных dropdowns (если CoreSelect станет custom dropdown):
    - role="combobox"
    - aria-expanded={isOpen}
    - aria-haspopup="listbox"
    - aria-activedescendant={activeOptionId}
    - aria-controls={listboxId}
  */
    return (
      <CoreSelect
        ref={ref}
        {...coreProps}
        {...(dataTestId != null ? { 'data-testid': dataTestId } : {})}
        data-component='AppSelect'
        disabled={policy.disabled || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabled || undefined}
        aria-disabled={policy.disabled || undefined}
        aria-busy={policy.disabled || undefined}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * Memoized Select with ref forwarding.
 *
 * Подходит для:
 * - фильтров
 * - форм ввода (react-hook-form, final-form)
 * - конфигурационных панелей
 * - workflow UI
 * - программного управления (focus, scrollIntoView)
 */
export const Select = Object.assign(memo(SelectComponent), {
  displayName: 'Select',
});
