/**
 * @file packages/app/src/ui/textarea.tsx
 * ============================================================================
 * 🟥 APP UI TEXTAREA — UI МИКРОСЕРВИС ТЕКСТОВОГО ПОЛЯ
 * ============================================================================
 *
 * Единственная точка входа для Textarea в приложении.
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

import React, { memo, useCallback, useEffect, useMemo } from 'react';
import type { JSX } from 'react';

import { Textarea as CoreTextarea } from '../../../ui-core/src/primitives/textarea.js';
import type { CoreTextareaProps } from '../../../ui-core/src/primitives/textarea.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type TextareaTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type TextareaTelemetryPayload = Readonly<{
  component: 'Textarea';
  action: TextareaTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
}>;

export type AppTextareaProps = Readonly<
  & CoreTextareaProps
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить интерактивность */
    isDisabledByFeatureFlag?: boolean;

    /** Feature flag: визуальный вариант */
    variantByFeatureFlag?: string;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Telemetry for user input */
    telemetryOnChange?: boolean;

    /** Telemetry for focus/blur */
    telemetryOnFocus?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type TextareaPolicy = Readonly<{
  hidden: boolean;
  disabled: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  telemetryOnChange: boolean;
  telemetryOnFocus: boolean;
}>;

function useTextareaPolicy(props: AppTextareaProps): TextareaPolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag);
  const disabled = useFeatureFlag(props.isDisabledByFeatureFlag);

  return useMemo<TextareaPolicy>(() => ({
    hidden,
    disabled,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryEnabled !== false,
    telemetryOnChange: props.telemetryOnChange !== false,
    telemetryOnFocus: props.telemetryOnFocus !== false,
  }), [
    hidden,
    disabled,
    props.variantByFeatureFlag,
    props.telemetryEnabled,
    props.telemetryOnChange,
    props.telemetryOnFocus,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitTextareaTelemetry(
  action: TextareaTelemetryAction,
  policy: TextareaPolicy,
): void {
  const payload: TextareaTelemetryPayload = {
    component: 'Textarea',
    action,
    variant: policy.variant,
    hidden: policy.hidden,
    disabled: policy.disabled,
  };

  infoFireAndForget(`Textarea ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP TEXTAREA
 * ========================================================================== */

function TextareaComponent(props: AppTextareaProps): JSX.Element | null {
  const {
    onChange,
    onFocus,
    onBlur,
    ...coreProps
  } = props;

  const policy = useTextareaPolicy(props);

  /** lifecycle telemetry */
  useEffect(() => {
    if (policy.telemetryEnabled) {
      emitTextareaTelemetry('mount', policy);
      return (): void => {
        emitTextareaTelemetry('unmount', policy);
      };
    }
    return undefined;
    // Policy намеренно заморожена при монтировании.
    // Telemetry должна отражать начальный контекст рендеринга.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** event handlers */
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (policy.disabled) return;

      if (policy.telemetryEnabled && policy.telemetryOnChange) {
        emitTextareaTelemetry('change', policy);
      }

      onChange?.(event);
    },
    [policy, onChange],
  );

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      if (policy.telemetryEnabled && policy.telemetryOnFocus) {
        emitTextareaTelemetry('focus', policy);
      }

      onFocus?.(event);
    },
    [policy, onFocus],
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      if (policy.telemetryEnabled && policy.telemetryOnFocus) {
        emitTextareaTelemetry('blur', policy);
      }

      onBlur?.(event);
    },
    [policy, onBlur],
  );

  /** скрыт */
  if (policy.hidden) {
    return null;
  }

  /** View (максимально тупая) */
  return (
    <CoreTextarea
      {...coreProps}
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
}

/**
 * Memoized Textarea.
 *
 * Подходит для:
 * - форм ввода
 * - чат-интерфейсов
 * - мастеров и workflow UI
 */
export const Textarea = Object.assign(memo(TextareaComponent), {
  displayName: 'Textarea',
});
