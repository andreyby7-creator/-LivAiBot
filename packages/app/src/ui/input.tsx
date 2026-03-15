/**
 * @file packages/app/src/ui/input.tsx
 * ============================================================================
 * 🔘 APP UI INPUT — КОНТЕЙНЕРНЫЙ WRAPPER ПОЛЯ ВВОДА ПРИЛОЖЕНИЯ
 * ============================================================================
 * Роль:
 * - Единственная точка входа для input-полей во всем приложении
 * - Интеграция:
 *   • i18n (lazy, fallback, типизировано)
 *   • telemetry (batch-ready, feature-flags aware)
 *   • feature flags (disabled, hidden, variant)
 *   • accessibility (aria-label, aria-invalid, aria-required, label)
 *   • performance (memo, useMemo, useCallback)
 * Архитектура:
 * - ui-core → только визуал
 * - app/ui → адаптация под бизнес-контекст
 * - feature/* → используют ТОЛЬКО app/ui
 */

import type { JSX } from 'react';
import React, { memo, useCallback, useEffect, useId, useMemo, useRef } from 'react';

import type { InputProps as CoreInputProps } from '@livai/ui-core/primitives/input';
import { Input as CoreInput } from '@livai/ui-core/primitives/input';

import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { Json } from '../types/common.js';
import type {
  AppWrapperProps,
  MapCoreProps,
  UiFeatureFlags,
  UiPrimitiveProps,
  UiTelemetryApi,
} from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте input wrapper */
export type InputUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте input */
export type InputWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте input */
export type InputMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

// Фильтруем бизнес-пропсы от DOM-пропсов
function omit<T extends Record<string, unknown>, K extends readonly string[]>(
  obj: T,
  keys: K,
): Omit<T, K[number]> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'variantByFeatureFlag',
  'hasError',
  'isRequired',
  'label',
  'errorId',
  'i18nPlaceholderKey',
  'i18nPlaceholderNs',
  'i18nPlaceholderParams',
] as const;

/** Compile-time гарантия: безопасные props для input элемента */
type SafeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'value' // обрабатывается отдельно
  | 'defaultValue' // обрабатывается отдельно
  | 'disabled' // обрабатывается отдельно
  | 'placeholder' // обрабатывается отдельно
  | 'onChange' // обрабатывается отдельно
  | 'onFocus' // обрабатывается отдельно
  | 'onBlur' // обрабатывается отдельно
  | 'aria-label' // обрабатывается отдельно
  | 'aria-required' // обрабатывается отдельно
  | 'aria-invalid' // обрабатывается отдельно
  | 'aria-describedby' // обрабатывается отдельно
  | 'aria-live' // обрабатывается отдельно
  | 'data-variant' // обрабатывается отдельно
  | 'type' // type уже задан в CoreInput
  | 'name' // может конфликтовать с form handling
  | 'form' // может конфликтовать с form handling
>;

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
const useDebouncedTelemetry = (
  telemetry: UiTelemetryApi,
): (message: string, data: InputTelemetryPayload) => void => {
  const timeoutRef = useRef<number | undefined>(undefined);

  const debouncedInfoFireAndForget = useCallback(
    (
      message: string,
      data: InputTelemetryPayload,
      delay = TELEMETRY_DEBOUNCE_DELAY,
    ): void => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        telemetry.infoFireAndForget(message, data);

        timeoutRef.current = undefined;
      }, delay);
    },
    [telemetry],
  );

  useEffect(() => {
    return (): void => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedInfoFireAndForget;
};

function InputComponent<T extends HTMLInputElement['value'] = string>(
  props: AppInputProps<T>,
): JSX.Element | null {
  // Извлекаем бизнес-пропсы из оригинальных пропсов
  const {
    isDisabledByFeatureFlag,
    isRequired = false,
    hasError = false,
    label,
    isHiddenByFeatureFlag,
    variantByFeatureFlag,
    errorId,
    i18nPlaceholderKey: _i18nPlaceholderKey,
    i18nPlaceholderNs: _i18nPlaceholderNs,
    i18nPlaceholderParams: _i18nPlaceholderParams,
  } = props;

  // Фильтруем бизнес-пропсы от DOM-пропсов
  const domProps = omit(props, BUSINESS_PROPS);

  const {
    onChange,
    onFocus,
    onBlur,
    disabled = false,
    value,
    defaultValue,
    ...rest
  } = domProps;

  // Compile-time гарантия: rest содержит только безопасные props для input
  const safeRest = rest as SafeInputProps;

  // Controlled / Uncontrolled handling: value имеет приоритет над defaultValue
  // В production режиме value выигрывает, в development - кидаем ошибку
  if (value !== undefined && defaultValue !== undefined) {
    if (process.env['NODE_ENV'] === 'development') {
      throw new Error(
        'Input не должен одновременно иметь value и defaultValue. Используйте только одно из свойств.',
      );
    }
    // В production режиме игнорируем defaultValue, если есть value
  }

  // Определяем финальные пропсы для CoreInput
  const coreProps = {
    value,
    ...(value === undefined ? { defaultValue } : {}),
  };

  const { i18n, featureFlags, telemetry } = useUnifiedUI();
  const { translate } = i18n;
  const inputId = useId();
  const telemetryEnabled = featureFlags.getOverride('SYSTEM_telemetry_enabled', true);

  // Runtime overrides для A/B тестирования
  // Позволяет динамически переключать флаги через featureFlags.getOverride()
  // Приоритет: runtime override > пропс компонента
  // Используем стандартные SYSTEM_ флаги для runtime overrides
  // Для A/B тестирования можно использовать setOverride() для динамического переключения
  const runtimeDisabledFlag: 'SYSTEM_input_disabled' = 'SYSTEM_input_disabled';
  const runtimeHiddenFlag: 'SYSTEM_input_hidden' = 'SYSTEM_input_hidden';
  const runtimeVariantEnabledFlag: 'SYSTEM_input_variant_enabled' = 'SYSTEM_input_variant_enabled';

  // Проверяем runtime overrides, если они есть - используем их, иначе используем пропсы
  const flagDisabledOverride = featureFlags.getOverride(
    runtimeDisabledFlag,
    isDisabledByFeatureFlag ?? false,
  );
  const flagHiddenOverride = featureFlags.getOverride(
    runtimeHiddenFlag,
    isHiddenByFeatureFlag ?? false,
  );
  // Для variant: если runtime override включен, используем значение из пропса
  const variantOverrideEnabled = featureFlags.getOverride(
    runtimeVariantEnabledFlag,
    variantByFeatureFlag !== undefined,
  );
  const variantOverride = variantOverrideEnabled ? variantByFeatureFlag : undefined;

  const effectiveDisabled = disabled || flagDisabledOverride;
  const effectiveHidden = flagHiddenOverride;
  const hasLabel = Boolean(label?.trim());
  const debouncedTelemetry = useDebouncedTelemetry(telemetry);

  /** Получить финальный placeholder с i18n fallback */
  const getPlaceholder = useCallback((): string => {
    // Используем i18n если ключ определен, иначе обычный placeholder
    const key = _i18nPlaceholderKey;
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition
    if (key) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const ns = _i18nPlaceholderNs || 'common';
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const params = _i18nPlaceholderParams || EMPTY_PARAMS;
      const i18nText = translate(ns, key, params);
      // Если i18n вернул пустую строку или undefined, используем обычный placeholder
      if (i18nText) {
        return i18nText;
      }
    }
    return (domProps as { placeholder?: string; }).placeholder ?? '';
  }, [_i18nPlaceholderKey, _i18nPlaceholderNs, _i18nPlaceholderParams, domProps, translate]);

  /** Placeholder: i18n → fallback → пустая строка */
  const placeholder = useMemo<string>(getPlaceholder, [getPlaceholder]);

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

    telemetry.infoFireAndForget('Input focused', {
      component: 'Input',
      action: 'focus',
      disabled: effectiveDisabled,
      value: event.currentTarget.value,
    });
    onFocus?.(event);
  }, [telemetryEnabled, effectiveDisabled, onFocus, telemetry]);

  /** Blur handler с telemetry */
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (!telemetryEnabled || effectiveDisabled) {
      onBlur?.(event);
      return;
    }

    telemetry.infoFireAndForget('Input blurred', {
      component: 'Input',
      action: 'blur',
      disabled: effectiveDisabled,
      value: event.currentTarget.value,
    });
    onBlur?.(event);
  }, [telemetryEnabled, effectiveDisabled, onBlur, telemetry]);

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
        {...coreProps}
        disabled={effectiveDisabled}
        placeholder={placeholder}
        aria-label={hasLabel ? label : placeholder || undefined} // accessibility: label имеет приоритет над placeholder
        aria-required={isRequired} // accessibility: обязательное поле
        aria-invalid={hasError} // accessibility: состояние ошибки валидации
        aria-describedby={errorId} // accessibility: связь с элементом ошибки
        aria-live={hasError ? 'polite' : undefined} // accessibility: оповещение об ошибках
        {...(variantOverride !== undefined ? { 'data-variant': variantOverride } : {})}
        // feature flag: вариант компонента для стилизации (с runtime override для A/B тестирования)
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...safeRest}
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
 * Он:
 * - Защищает core UI от бизнес-логики
 * - Защищает бизнес-логику от UI деталей
 * - Делает проект масштабируемым
 * - Оптимизирован для производительности (React.memo)
 * Любая новая:
 * - аналитика
 * - A/B тест
 * - feature flag
 * - security audit
 * добавляется сюда без изменения feature-кода.
 */
