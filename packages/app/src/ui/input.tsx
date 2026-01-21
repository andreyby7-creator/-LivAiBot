/**
 * @file packages/app/src/ui/input.tsx
 * ============================================================================
 * 🔘 APP UI INPUT — КОНТЕЙНЕРНЫЙ WRAPPER ПОЛЯ ВВОДА ПРИЛОЖЕНИЯ
 * ============================================================================
 *
 * Роль:
 * - Единственная точка входа для input-полей во всем приложении
 * - Интеграция:
 *   • i18n (lazy, fallback, типизировано)
 *   • telemetry (batch-ready, feature-flags aware)
 *   • feature flags (disabled, hidden, variant)
 *   • accessibility (aria-label, aria-invalid, aria-required, label)
 *   • performance (memo, useMemo, useCallback)
 *
 * Архитектура:
 * - ui-core → только визуал
 * - app/ui → адаптация под бизнес-контекст
 * - feature/* → используют ТОЛЬКО app/ui
 */

import React, { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { JSX } from 'react';

import { Input as CoreInput } from '../../../ui-core/src/index.js';
import type { InputProps as CoreInputProps } from '../../../ui-core/src/index.js';
import { useFeatureFlag, useFeatureFlagOverride } from '../lib/feature-flags.js';
import { useI18n } from '../lib/i18n.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Telemetry payload для Input компонента */
export type InputTelemetryPayload = Readonly<{
  component: 'Input';
  action: 'focus' | 'blur' | 'change';
  disabled: boolean;
  value: string;
}>;

/** Telemetry событие input (legacy, используем InputTelemetryPayload) */
export type InputTelemetryEvent<T = string> = Readonly<{
  component: 'Input';
  action: 'focus' | 'blur' | 'change';
  disabled: boolean;
  value: T;
}>;

/** App-уровневые пропсы Input */
export type AppInputProps<T extends HTMLInputElement['value'] = string> = Readonly<
  & Omit<CoreInputProps, 'value' | 'defaultValue'>
  & {
    /** Feature flag отключения поля */
    isDisabledByFeatureFlag?: boolean;

    /** Контролируемое значение */
    value?: T;

    /** Неконтролируемое значение */
    defaultValue?: T;

    /** Поле обязательно для заполнения (aria-required) */
    isRequired?: boolean;

    /** Есть ли ошибка валидации (aria-invalid) */
    hasError?: boolean;

    /** Текст label для поля (опционально рендерится внутри компонента с htmlFor) */
    label?: string;

    /** Feature flag скрытия поля (компонент не рендерится) */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag для варианта компонента (data-variant атрибут для стилизации) */
    variantByFeatureFlag?: string;

    /** ID элемента с описанием ошибки для aria-describedby */
    errorId?: string;
  }
  & (
    | {
      /** I18n режим: placeholder обязателен */
      i18nPlaceholderKey: TranslationKey;
      i18nPlaceholderNs?: Namespace;
      i18nPlaceholderParams?: Readonly<Record<string, string | number>>;
    }
    | {
      /** Без i18n */
      i18nPlaceholderKey?: never;
      i18nPlaceholderNs?: never;
      i18nPlaceholderParams?: never;
      placeholder?: string;
    }
  )
>;

/* ============================================================================
 * 🎯 APP INPUT
 * ========================================================================== */

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/** Debounce delay for telemetry (ms) */
const TELEMETRY_DEBOUNCE_DELAY = 300;

/** Debounced telemetry hook для оптимизации сетевого трафика */
const useDebouncedTelemetry = (): (
  message: string,
  data: InputTelemetryPayload,
) => void => {
  const [timeoutId, setTimeoutId] = useState<number | undefined>(undefined);

  const debouncedInfoFireAndForget = useCallback(
    (
      message: string,
      data: InputTelemetryPayload,
      delay = TELEMETRY_DEBOUNCE_DELAY,
    ): void => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      const newTimeoutId = window.setTimeout(() => {
        infoFireAndForget(message, data);
      }, delay);

      setTimeoutId(newTimeoutId);
    },
    [timeoutId],
  );

  useEffect(() => {
    return (): void => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedInfoFireAndForget;
};

function InputComponent<T extends HTMLInputElement['value'] = string>(
  props: AppInputProps<T>,
): JSX.Element | null {
  const {
    onChange,
    onFocus,
    onBlur,
    disabled = false,
    value,
    defaultValue,
    isDisabledByFeatureFlag,
    isRequired = false,
    hasError = false,
    label,
    isHiddenByFeatureFlag,
    variantByFeatureFlag,
    errorId,
    ...rest
  } = props;

  // Controlled / Uncontrolled invariant check
  if (
    process.env['NODE_ENV'] === 'development' && value !== undefined && defaultValue !== undefined
  ) {
    throw new Error(
      'Input не должен одновременно иметь value и defaultValue. Используйте только одно из свойств.',
    );
  }

  const { translate } = useI18n();
  const flagDisabled = useFeatureFlag(isDisabledByFeatureFlag);
  const flagHidden = useFeatureFlag(isHiddenByFeatureFlag);
  const telemetryEnabled = useFeatureFlagOverride('telemetry.enabled', true);

  // TODO: Runtime overrides для A/B тестирования (нужен context provider)

  const effectiveDisabled = disabled || flagDisabled;
  const effectiveHidden = flagHidden;
  const inputId = useId();
  const hasLabel = Boolean(label?.trim());
  const debouncedTelemetry = useDebouncedTelemetry();

  /** Placeholder: i18n → fallback → undefined */
  const placeholder = useMemo<string | undefined>(() => {
    if ('i18nPlaceholderKey' in props) {
      const ns = props.i18nPlaceholderNs ?? 'common';
      return translate(ns, props.i18nPlaceholderKey, props.i18nPlaceholderParams ?? EMPTY_PARAMS);
    }
    return (rest as { placeholder?: string; }).placeholder;
  }, [props, rest, translate]);

  /** Change handler с telemetry (debounced для оптимизации) */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!telemetryEnabled || effectiveDisabled) {
      onChange?.(event);
      return;
    }

    // Debounced telemetry для оптимизации сетевого трафика при быстром наборе
    debouncedTelemetry('Input changed', {
      component: 'Input',
      action: 'change',
      disabled: effectiveDisabled,
      value: event.target.value,
    });
    onChange?.(event);
  }, [telemetryEnabled, effectiveDisabled, onChange, debouncedTelemetry]);

  /** Focus handler с telemetry */
  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (!telemetryEnabled || effectiveDisabled) {
      onFocus?.(event);
      return;
    }

    infoFireAndForget('Input focused', {
      component: 'Input',
      action: 'focus',
      disabled: effectiveDisabled,
      value: event.currentTarget.value,
    });
    onFocus?.(event);
  }, [telemetryEnabled, effectiveDisabled, onFocus]);

  /** Blur handler с telemetry */
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (!telemetryEnabled || effectiveDisabled) {
      onBlur?.(event);
      return;
    }

    infoFireAndForget('Input blurred', {
      component: 'Input',
      action: 'blur',
      disabled: effectiveDisabled,
      value: event.currentTarget.value,
    });
    onBlur?.(event);
  }, [telemetryEnabled, effectiveDisabled, onBlur]);

  // Feature flag: скрываем компонент полностью (с учетом runtime overrides)
  if (effectiveHidden) {
    return null;
  }

  return (
    <>
      {hasLabel && (
        <label htmlFor={inputId} className='block text-sm font-medium text-gray-700 mb-1'>
          {label}
          {isRequired && <span className='text-red-500 ml-1' aria-label='обязательно'>*</span>}
        </label>
      )}
      <CoreInput
        id={inputId}
        value={value}
        defaultValue={defaultValue}
        disabled={effectiveDisabled}
        placeholder={placeholder}
        aria-label={hasLabel ? label : placeholder} // accessibility: label имеет приоритет над placeholder
        aria-required={isRequired} // accessibility: обязательное поле
        aria-invalid={hasError} // accessibility: состояние ошибки валидации
        aria-describedby={errorId} // accessibility: связь с элементом ошибки
        aria-live={hasError ? 'polite' : undefined} // accessibility: оповещение об ошибках
        data-variant={variantByFeatureFlag} // feature flag: вариант компонента для стилизации
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      />
    </>
  );
}

/**
 * Memoized Input component для оптимизации производительности
 * Предотвращает лишние ререндеры при использовании в списках или формах
 */
export const Input = Object.assign(memo(InputComponent) as typeof InputComponent, {
  displayName: 'Input',
});

/* ============================================================================
 * 🧩 ARCHITECTURAL CONTRACT
 * ========================================================================== */
/**
 * Этот файл — UI boundary.
 *
 * Он:
 * - Защищает core UI от бизнес-логики
 * - Защищает бизнес-логику от UI деталей
 * - Делает проект масштабируемым
 * - Оптимизирован для производительности (React.memo)
 *
 * Любая новая:
 * - аналитика
 * - A/B тест
 * - feature flag
 * - security audit
 *
 * добавляется сюда без изменения feature-кода.
 */
