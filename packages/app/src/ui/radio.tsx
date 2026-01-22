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

import { Radio as CoreRadio } from '../../../ui-core/src/primitives/radio.js';
import type { CoreRadioProps } from '../../../ui-core/src/primitives/radio.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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

export type AppRadioProps = Readonly<
  & CoreRadioProps
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

type RadioPolicy = Readonly<{
  hidden: boolean;
  disabled: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  telemetryOnChange: boolean;
  telemetryOnFocus: boolean;
  telemetryOnBlur: boolean;
}>;

function useRadioPolicy(props: AppRadioProps): RadioPolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag);
  const disabled = useFeatureFlag(props.isDisabledByFeatureFlag);

  return useMemo<RadioPolicy>(() => ({
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

function emitRadioTelemetry(
  action: RadioTelemetryAction,
  policy: RadioPolicy,
  checked?: boolean,
): void {
  if (!policy.telemetryEnabled) return;

  const payload: RadioTelemetryPayload = {
    component: 'Radio',
    action,
    variant: policy.variant,
    hidden: policy.hidden,
    disabled: policy.disabled,
    ...(checked !== undefined && { checked }),
  };

  infoFireAndForget(`Radio ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP RADIO
 * ========================================================================== */

const RadioComponent = forwardRef<HTMLInputElement, AppRadioProps>(
  function RadioComponent(props, ref): JSX.Element | null {
    const { onChange, onFocus, onBlur, checked = false, ...coreProps } = props;

    const policy = useRadioPolicy(props);
    const internalRef = useRef<HTMLInputElement | null>(null);

    /** Безопасная пересылка ref */
    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('input'), [
      internalRef,
    ]);

    /** Жизненный цикл telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitRadioTelemetry('mount', policy, checked);
        return (): void => {
          emitRadioTelemetry('unmount', policy, checked);
        };
      }
      return undefined;
      // Policy намеренно frozen
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Синхронизация checked для безопасного concurrent rendering */
    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.checked = Boolean(checked); // eslint-disable-line functional/immutable-data
      }
    }, [checked]);

    /** Обработчики событий */
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (policy.disabled) return;

        if (policy.telemetryOnChange) {
          emitRadioTelemetry('change', policy, event.target.checked);
        }

        onChange?.(event);
      },
      [policy, onChange],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnFocus) {
          emitRadioTelemetry('focus', policy, event.target.checked);
        }

        onFocus?.(event);
      },
      [policy, onFocus],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnBlur) {
          emitRadioTelemetry('blur', policy, event.target.checked);
        }

        onBlur?.(event);
      },
      [policy, onBlur],
    );

    /** hidden */
    if (policy.hidden) return null;

    /** View */
    return (
      <CoreRadio
        ref={internalRef}
        {...coreProps}
        data-component='AppRadio'
        disabled={policy.disabled || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabled || undefined}
        aria-disabled={policy.disabled || undefined}
        aria-busy={policy.disabled || undefined}
        aria-checked={checked}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * Memoized Radio with ref forwarding.
 *
 * Подходит для:
 * - форм ввода
 * - фильтров
 * - workflow UI
 * - программного управления (focus, scrollIntoView)
 */
export const Radio = Object.assign(memo(RadioComponent), {
  displayName: 'Radio',
});
