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
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type ToggleTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type ToggleTelemetryPayload = {
  component: 'Toggle';
  action: ToggleTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
  checked?: boolean;
};

export type AppToggleProps = Readonly<
  & CoreToggleProps
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

type TogglePolicy = Readonly<{
  hidden: boolean;
  disabled: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  telemetryOnChange: boolean;
  telemetryOnFocus: boolean;
  telemetryOnBlur: boolean;
}>;

function useTogglePolicy(props: AppToggleProps): TogglePolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag);
  const disabled = useFeatureFlag(props.isDisabledByFeatureFlag);

  return useMemo<TogglePolicy>(() => ({
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

function emitToggleTelemetry(
  action: ToggleTelemetryAction,
  policy: TogglePolicy,
  checked?: boolean,
): void {
  if (!policy.telemetryEnabled) return;

  const payload: ToggleTelemetryPayload = {
    component: 'Toggle',
    action,
    variant: policy.variant,
    hidden: policy.hidden,
    disabled: policy.disabled,
    ...(checked !== undefined && { checked }),
  };

  infoFireAndForget(`Toggle ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP TOGGLE
 * ========================================================================== */

const ToggleComponent = forwardRef<HTMLInputElement, AppToggleProps>(
  function ToggleComponent(props, ref): JSX.Element | null {
    const { onChange, onFocus, onBlur, checked = false, indeterminate = false, ...coreProps } =
      props;

    const policy = useTogglePolicy(props);
    const internalRef = useRef<HTMLInputElement | null>(null);

    /** Безопасная пересылка ref */
    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('input'), [
      internalRef,
    ]);

    /** Жизненный цикл telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitToggleTelemetry('mount', policy, checked);
        return (): void => {
          emitToggleTelemetry('unmount', policy, checked);
        };
      }
      return undefined;
      // Policy намеренно frozen
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Синхронизация checked для безопасности concurrent rendering */
    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.checked = Boolean(checked); // eslint-disable-line functional/immutable-data
      }
    }, [checked]);

    /** Синхронизация indeterminate для безопасности concurrent rendering */
    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = Boolean(indeterminate); // eslint-disable-line functional/immutable-data
      }
    }, [indeterminate]);

    /** Обработчики событий */
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (policy.disabled) return;

        if (policy.telemetryOnChange) {
          emitToggleTelemetry('change', policy, event.target.checked);
        }

        onChange?.(event);
      },
      [policy, onChange],
    );

    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnFocus) {
          emitToggleTelemetry('focus', policy, event.target.checked);
        }

        onFocus?.(event);
      },
      [policy, onFocus],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (policy.telemetryOnBlur) {
          emitToggleTelemetry('blur', policy, event.target.checked);
        }

        onBlur?.(event);
      },
      [policy, onBlur],
    );

    /** hidden */
    if (policy.hidden) return null;

    /** View */
    return (
      <CoreToggle
        ref={internalRef}
        {...coreProps}
        checked={checked}
        indeterminate={indeterminate}
        data-component='AppToggle'
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
 * Memoized Toggle with ref forwarding.
 *
 * Подходит для:
 * - фильтров
 * - форм ввода (react-hook-form, final-form)
 * - workflow UI
 * - программного управления (focus, scrollIntoView)
 */
export const Toggle = Object.assign(memo(ToggleComponent), {
  displayName: 'Toggle',
});
