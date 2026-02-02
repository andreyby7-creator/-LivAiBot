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

import { Select as CoreSelect } from '../../../ui-core/src/primitives/select.js';
import type { CoreSelectProps } from '../../../ui-core/src/primitives/select.js';
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

type SelectTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type SelectTelemetryPayload = Readonly<{
  component: 'Select';
  action: SelectTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
  value?: string; // для change событий
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
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnChange: boolean;
  readonly telemetryOnFocus: boolean;
  readonly telemetryOnBlur: boolean;
}>;

function useSelectPolicy(props: AppSelectProps): SelectPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<SelectPolicy>(() => ({
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

function emitSelectTelemetry(
  action: SelectTelemetryAction,
  policy: SelectPolicy,
  value?: string,
): void {
  const payload: SelectTelemetryPayload = {
    component: 'Select',
    action,
    variant: policy.variant,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
    ...(action === 'change' && value !== undefined && { value }),
  };

  infoFireAndForget(`Select ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP SELECT
 * ========================================================================== */

const SelectComponent = forwardRef<HTMLSelectElement, AppSelectProps>(
  function SelectComponent(props, ref): JSX.Element | null {
    // Сначала фильтруем бизнес-пропсы
    const filteredProps = omit(props, BUSINESS_PROPS);

    const {
      onChange,
      onFocus,
      onBlur,
      'data-testid': dataTestId,
      ...coreProps
    } = filteredProps;

    const policy = useSelectPolicy(props);
    const internalRef = useRef<HTMLSelectElement | null>(null);

    /** Безопасная пересылка ref */
    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('select'), [
      internalRef,
    ]);

    /** lifecycle telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitSelectTelemetry('mount', policy, String(props.value ?? ''));
        return (): void => {
          emitSelectTelemetry('unmount', policy, String(props.value ?? ''));
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
        if (policy.disabledByFeatureFlag) return;

        if (policy.telemetryEnabled && policy.telemetryOnChange) {
          emitSelectTelemetry('change', policy, event.target.value);
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
    if (policy.hiddenByFeatureFlag) {
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
        ref={internalRef}
        {...coreProps}
        {...(dataTestId != null ? { 'data-testid': dataTestId } : {})}
        data-component='AppSelect'
        disabled={policy.disabledByFeatureFlag || undefined}
        data-variant={policy.variant}
        data-disabled={policy.disabledByFeatureFlag || undefined}
        aria-disabled={policy.disabledByFeatureFlag || undefined}
        aria-busy={policy.disabledByFeatureFlag || undefined}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

/**
 * UI-контракт Select компонента.
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
 * - Состояние value синхронизировано с onChange callback
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry events отправляются только при реальных изменениях
 *
 * Не допускается:
 * - Использование напрямую core Select компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Select = Object.assign(memo(SelectComponent), {
  displayName: 'Select',
});
