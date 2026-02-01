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
import type { FormValidationResult, ValidationSchema } from '../lib/validation.js';
import { validateForm } from '../lib/validation.js';

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
    /* feature flags */
    isHiddenByFeatureFlag?: boolean;
    isDisabledByFeatureFlag?: boolean;
    variantByFeatureFlag?: string;

    /* telemetry */
    telemetryEnabled?: boolean;
    telemetryOnSubmit?: boolean;
    telemetryOnReset?: boolean;

    /* validation */
    validationSchema?: ValidationSchema;
    onValidationError?: (result: FormValidationResult) => void;

    /* async state */
    isSubmitting?: boolean;
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
    validationSchema,
    onValidationError,
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
    // policy является неизменяемой по дизайну (снимок feature flags)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** обработчики */
  const handleSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      if (policy.disabledByFeatureFlag) {
        return;
      }

      if (validationSchema !== undefined) {
        const result = validateForm(
          event.currentTarget,
          validationSchema,
        );

        if (!result.success) {
          // при ошибке валидации submit и telemetry не выполняются
          onValidationError?.(result);
          return;
        }
      }

      if (policy.telemetryEnabled && policy.telemetryOnSubmit) {
        emitFormTelemetry('submit', policy);
      }

      onSubmit?.(event);
    },
    [policy, onSubmit, validationSchema, onValidationError],
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
      // aria-busy отражает только асинхронное состояние submit,
      // а не feature-flag или disabled policy
      aria-busy={props.isSubmitting === true || undefined}
    >
      {children}
    </CoreForm>
  );
}

/**
 * Интеграция валидации:
 * - Form делегирует проверку данных в lib/validation.ts
 * - Логика валидации отдельных полей не размещается в UI-слое
 * - Обеспечивается единая и согласованная валидация с backend и схемами
 */

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
 * - Клиентская валидация через централизованную систему
 * - Асинхронное состояние submit управляется извне (controlled)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Submit/reset events передаются корректно в callbacks
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry events отправляются только при реальных действиях
 * - Валидация выполняется до telemetry и submit callbacks
 *
 * Не допускается:
 * - Использование напрямую core Form компонента
 * - Переопределение submit/reset логики без callbacks
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 * - Валидация данных внутри UI-слоя
 */
export const Form = Object.assign(memo(FormComponent), {
  displayName: 'Form',
});
