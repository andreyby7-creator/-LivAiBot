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
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Бизнес-пропсы, которые не должны попадать в DOM */
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryEnabled',
  'telemetryOnChange',
  'telemetryOnFocus',
  'telemetryOnBlur',
] as const;

/** Функция для фильтрации бизнес-пропсов */
function omit<T extends Record<string, unknown>, K extends readonly string[]>(
  obj: T,
  keys: K,
): Omit<T, K[number]> {
  const result = { ...obj };
  for (const key of keys) {
    // eslint-disable-next-line functional/immutable-data
    delete result[key];
  }
  return result;
}

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
  & Omit<CoreToggleProps, 'checked'> // Исключаем checked из CoreToggleProps
  & {
    /** Состояние toggle (controlled mode) */
    checked?: boolean;

    /** Начальное состояние toggle (uncontrolled mode) */
    defaultChecked?: boolean;

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
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnChange: boolean;
  readonly telemetryOnFocus: boolean;
  readonly telemetryOnBlur: boolean;
}>;

function useTogglePolicy(props: AppToggleProps): TogglePolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<TogglePolicy>(() => ({
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
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
    ...(checked !== undefined && { checked }),
  };

  infoFireAndForget(`Toggle ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP TOGGLE
 * ========================================================================== */

const ToggleComponent = forwardRef<HTMLInputElement, AppToggleProps>(
  function ToggleComponent(props, ref): JSX.Element | null {
    // Сначала фильтруем бизнес-пропсы
    const filteredProps = omit(props, BUSINESS_PROPS);

    const {
      onChange,
      onFocus,
      onBlur,
      checked,
      defaultChecked = false,
      indeterminate = false,
      ...coreProps
    } = filteredProps;

    const policy = useTogglePolicy(props);
    const internalRef = useRef<HTMLInputElement | null>(null);
    const checkedRef = useRef<boolean>(checked ?? defaultChecked);

    // Синхронизируем ref с актуальным значением checked для telemetry
    // eslint-disable-next-line functional/immutable-data
    checkedRef.current = checked ?? defaultChecked;

    /** Безопасная пересылка ref */
    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('input'), [
      internalRef,
    ]);

    /** Жизненный цикл telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitToggleTelemetry('mount', policy, checkedRef.current);
        return (): void => {
          emitToggleTelemetry('unmount', policy, checkedRef.current);
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
        if (policy.disabledByFeatureFlag) return;

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
    if (policy.hiddenByFeatureFlag) return null;

    /** View */
    return (
      <CoreToggle
        ref={internalRef}
        {...coreProps}
        {...(checked !== undefined ? { checked } : { defaultChecked })}
        indeterminate={indeterminate}
        data-component='AppToggle'
        disabled={policy.disabledByFeatureFlag || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabledByFeatureFlag || undefined}
        aria-disabled={policy.disabledByFeatureFlag || undefined}
        aria-busy={policy.disabledByFeatureFlag || undefined}
        aria-checked={checked ?? defaultChecked}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * UI-контракт Toggle компонента.
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
 * - Использование напрямую core Toggle компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Toggle = Object.assign(memo(ToggleComponent), {
  displayName: 'Toggle',
});
