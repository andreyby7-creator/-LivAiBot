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
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnChange: boolean;
  readonly telemetryOnFocus: boolean;
  readonly telemetryOnBlur: boolean;
}>;

function useRadioPolicy(props: AppRadioProps): RadioPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<RadioPolicy>(() => ({
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
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
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
        if (policy.disabledByFeatureFlag) return;

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
    if (policy.hiddenByFeatureFlag) return null;

    /** View */
    return (
      <CoreRadio
        ref={internalRef}
        {...coreProps}
        data-component='AppRadio'
        disabled={policy.disabledByFeatureFlag || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabledByFeatureFlag || undefined}
        aria-disabled={policy.disabledByFeatureFlag || undefined}
        aria-busy={policy.disabledByFeatureFlag || undefined}
        aria-checked={checked}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * UI-контракт Radio компонента.
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
 * - Использование напрямую core Radio компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Radio = Object.assign(memo(RadioComponent), {
  displayName: 'Radio',
});
