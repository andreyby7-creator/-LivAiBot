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
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnSubmit: boolean;
  readonly telemetryOnReset: boolean;
}>;

function useFormPolicy(props: AppFormProps): FormPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<FormPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    disabledByFeatureFlag: disabled,
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
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
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
    (event: React.SubmitEvent<HTMLFormElement>) => {
      if (policy.disabledByFeatureFlag) {
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
    (event: React.SyntheticEvent<HTMLFormElement>) => {
      if (policy.disabledByFeatureFlag) {
        return;
      }

      if (policy.telemetryEnabled && policy.telemetryOnReset) {
        emitFormTelemetry('reset', policy);
      }

      onReset?.(event);
    },
    [policy, onReset],
  );

  if (policy.hiddenByFeatureFlag) {
    return null;
  }

  return (
    <CoreForm
      {...coreProps}
      onSubmit={handleSubmit}
      onReset={handleReset}
      data-variant={policy.variant}
      data-disabled={policy.disabledByFeatureFlag || undefined}
      aria-disabled={policy.disabledByFeatureFlag || undefined}
      aria-busy={policy.disabledByFeatureFlag || undefined}
    >
      {children}
    </CoreForm>
  );
}

/**
 * UI-контракт Form компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка submit/reset событий
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Submit/reset events передаются корректно в callbacks
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry events отправляются только при реальных действиях
 *
 * Не допускается:
 * - Использование напрямую core Form компонента
 * - Переопределение submit/reset логики без callbacks
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Form = Object.assign(memo(FormComponent), {
  displayName: 'Form',
});
