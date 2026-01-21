/**
 * @file packages/app/src/ui/form.tsx
 * ============================================================================
 * 🟥 APP UI FORM — UI МИКРОСЕРВИС ФОРМЫ
 * ============================================================================
 *
 * Единственная точка входа для Form в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 */

import React, { memo, useCallback, useEffect, useMemo } from 'react';
import type { JSX } from 'react';

import { Form as CoreForm } from '../../../ui-core/src/primitives/form.js';
import type { CoreFormProps } from '../../../ui-core/src/primitives/form.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type FormTelemetryPayload = Readonly<{
  component: 'Form';
  action: 'mount' | 'unmount' | 'submit' | 'reset';
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
}>;

export type AppFormProps = Readonly<
  & CoreFormProps
  & {
    isHiddenByFeatureFlag?: boolean;
    isDisabledByFeatureFlag?: boolean;
    variantByFeatureFlag?: string;

    telemetryEnabled?: boolean;
    telemetryOnSubmit?: boolean;
    telemetryOnReset?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type FormPolicy = Readonly<{
  hidden: boolean;
  disabled: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  telemetryOnSubmit: boolean;
  telemetryOnReset: boolean;
}>;

function useFormPolicy(props: AppFormProps): FormPolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag);
  const disabled = useFeatureFlag(props.isDisabledByFeatureFlag);

  return useMemo<FormPolicy>(() => ({
    hidden,
    disabled,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryEnabled !== false,
    telemetryOnSubmit: props.telemetryOnSubmit !== false,
    telemetryOnReset: props.telemetryOnReset !== false,
  }), [
    hidden,
    disabled,
    props.variantByFeatureFlag,
    props.telemetryEnabled,
    props.telemetryOnSubmit,
    props.telemetryOnReset,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitFormTelemetry(
  action: FormTelemetryPayload['action'],
  policy: FormPolicy,
): void {
  infoFireAndForget(`Form ${action}`, {
    component: 'Form',
    action,
    variant: policy.variant,
    hidden: policy.hidden,
    disabled: policy.disabled,
  });
}

/* ============================================================================
 * 🎯 APP FORM
 * ========================================================================== */

function FormComponent(props: AppFormProps): JSX.Element | null {
  const {
    children,
    onSubmit,
    onReset,
    ...coreProps
  } = props;

  const policy = useFormPolicy(props);

  /** жизненный цикл */
  useEffect((): (() => void) | undefined => {
    if (policy.telemetryEnabled) {
      emitFormTelemetry('mount', policy);
      return (): void => {
        emitFormTelemetry('unmount', policy);
      };
    }
    return undefined;
    // policy intentionally frozen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** обработчики */
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      if (policy.disabled) {
        return;
      }

      if (policy.telemetryEnabled && policy.telemetryOnSubmit) {
        emitFormTelemetry('submit', policy);
      }

      onSubmit?.(event);
    },
    [policy, onSubmit],
  );

  const handleReset = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      if (policy.disabled) {
        return;
      }

      if (policy.telemetryEnabled && policy.telemetryOnReset) {
        emitFormTelemetry('reset', policy);
      }

      onReset?.(event);
    },
    [policy, onReset],
  );

  if (policy.hidden) {
    return null;
  }

  return (
    <CoreForm
      {...coreProps}
      onSubmit={handleSubmit}
      onReset={handleReset}
      data-variant={policy.variant}
      data-disabled={policy.disabled || undefined}
      aria-disabled={policy.disabled || undefined}
      aria-busy={policy.disabled || undefined}
    >
      {children}
    </CoreForm>
  );
}

export const Form = Object.assign(memo(FormComponent), {
  displayName: 'Form',
});
