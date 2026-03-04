/**
 * @file packages/app/src/ui/search-bar.tsx
 * ============================================================================
 * 🟥 APP UI SEARCHBAR — UI МИКРОСЕРВИС SEARCHBAR
 * ============================================================================
 * Единственная точка входа для SearchBar в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility / disabled)
 * - Telemetry
 * - Feature flags
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * - Debounce логики (должна быть в feature слое)
 * Архитектурные решения:
 * - Управление значением и событиями обрабатывается в App слое
 * - CoreSearchBar остается полностью presentational
 */

import { SearchBar as CoreSearchBar } from '@livai/ui-core';
import type { CoreSearchBarProps } from '@livai/ui-core';
import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent, JSX, KeyboardEvent, Ref } from 'react';

import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { UiTelemetryApi } from '../types/ui-contracts.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

const SearchBarTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  Show: 'show',
  Hide: 'hide',
  Change: 'change',
  Submit: 'submit',
  Clear: 'clear',
} as const;

type SearchBarTelemetryAction =
  typeof SearchBarTelemetryAction[keyof typeof SearchBarTelemetryAction];

type SearchBarSize = 'small' | 'medium' | 'large';

type SearchBarTelemetryPayload = {
  component: 'SearchBar';
  action: SearchBarTelemetryAction;
  hidden: boolean;
  visible: boolean;
  disabled: boolean;
  valueLength: number;
  hasValue: boolean;
  size?: SearchBarSize;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppSearchBarProps = Readonly<
  & Omit<CoreSearchBarProps, 'onChange' | 'onSubmit' | 'onClear' | 'data-testid'>
  & {
    /** Видимость SearchBar (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть SearchBar */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить SearchBar */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при изменении значения */
    onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;

    /** Callback при отправке формы поиска */
    onSubmit?: (
      value: string,
      event: React.SubmitEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement>,
    ) => void;

    /** Callback при очистке значения */
    onClear?: () => void;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
  & (
    | {
      /** I18n placeholder режим */
      placeholderI18nKey: TranslationKey;
      placeholderI18nNs?: Namespace;
      placeholderI18nParams?: Record<string, string | number>;
      placeholder?: never;
    }
    | {
      /** Обычный placeholder режим */
      placeholderI18nKey?: never;
      placeholderI18nNs?: never;
      placeholderI18nParams?: never;
      placeholder?: string;
    }
  )
  & (
    | {
      /** I18n aria-label режим */
      ariaLabelI18nKey: TranslationKey;
      ariaLabelI18nNs?: Namespace;
      ariaLabelI18nParams?: Record<string, string | number>;
      'aria-label'?: never;
    }
    | {
      /** Обычный aria-label режим */
      ariaLabelI18nKey?: never;
      ariaLabelI18nNs?: never;
      ariaLabelI18nParams?: never;
      'aria-label'?: string;
    }
  )
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type SearchBarPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly isDisabled: boolean;
  readonly showClearByPolicy: boolean;
  readonly showSearchByPolicy: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * SearchBarPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - disabled state
 * Ни один consumer не имеет права повторно интерпретировать props.visible,
 * props.disabled или feature flags.
 */
function useSearchBarPolicy(props: AppSearchBarProps): SearchBarPolicy {
  return useMemo(() => {
    const hiddenByFeatureFlag = Boolean(props.isHiddenByFeatureFlag);
    const disabledByFeatureFlag = Boolean(props.isDisabledByFeatureFlag);

    const isRendered = !hiddenByFeatureFlag && props.visible !== false;
    const isDisabled = disabledByFeatureFlag || props.disabled === true;

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      isRendered,
      isDisabled,
      showClearByPolicy: props.showClearButton !== false,
      showSearchByPolicy: props.showSearchButton === true,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.visible,
    props.disabled,
    props.showClearButton,
    props.showSearchButton,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitSearchBarTelemetry(
  telemetry: UiTelemetryApi,
  payload: SearchBarTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`SearchBar ${payload.action}`, payload);
}

/**
 * Фабрика для создания telemetry props из значения и размера.
 * Обеспечивает алгебраическую чистоту telemetry слоя.
 */
function makeTelemetryValueProps(
  value: string,
  size?: SearchBarSize,
): {
  valueLength: number;
  hasValue: boolean;
  size?: SearchBarSize;
} {
  return {
    valueLength: value.length,
    hasValue: value.length > 0,
    ...(size !== undefined && { size }),
  };
}

/**
 * Базовое формирование payload для SearchBar telemetry (без visible).
 * visible добавляется явно в show/hide payload для семантической чистоты.
 */
function getSearchBarPayloadBase(
  action: SearchBarTelemetryAction,
  policy: SearchBarPolicy,
  telemetryProps: {
    valueLength: number;
    hasValue: boolean;
    size?: SearchBarSize;
  },
): Omit<SearchBarTelemetryPayload, 'visible'> {
  return {
    component: 'SearchBar',
    action,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.isDisabled,
    valueLength: telemetryProps.valueLength,
    hasValue: telemetryProps.hasValue,
    ...(telemetryProps.size !== undefined && { size: telemetryProps.size }),
  };
}

/**
 * Формирование payload для SearchBar telemetry (для lifecycle events).
 * Использует policy.isRendered для visible.
 */
function getSearchBarPayload(
  action: SearchBarTelemetryAction,
  policy: SearchBarPolicy,
  telemetryProps: {
    valueLength: number;
    hasValue: boolean;
    size?: SearchBarSize;
  },
): SearchBarTelemetryPayload {
  return {
    ...getSearchBarPayloadBase(action, policy, telemetryProps),
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP SEARCHBAR
 * ========================================================================== */

const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'telemetryEnabled',
  'placeholderI18nKey',
  'placeholderI18nNs',
  'placeholderI18nParams',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

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

const SearchBarComponent = forwardRef<HTMLInputElement, AppSearchBarProps>(
  function SearchBarComponent(
    props: AppSearchBarProps,
    ref: Ref<HTMLInputElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    const filteredProps = omit(props, BUSINESS_PROPS);

    // Placeholder: i18n → обычный placeholder → undefined
    const placeholder = useMemo<string | undefined>(() => {
      if ('placeholderI18nKey' in props) {
        const effectiveNs = props.placeholderI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.placeholderI18nKey,
          props.placeholderI18nParams ?? EMPTY_PARAMS,
        );
      }
      return props.placeholder;
    }, [props, translate]);

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabel = useMemo<string | undefined>(() => {
      if ('ariaLabelI18nKey' in props) {
        const effectiveNs = props.ariaLabelI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelI18nKey,
          props.ariaLabelI18nParams ?? EMPTY_PARAMS,
        );
      }
      return props['aria-label'];
    }, [props, translate]);
    const {
      value: valueProp,
      onChange,
      onSubmit,
      onClear,
      size,
      ...coreProps
    } = filteredProps;
    const policy = useSearchBarPolicy(props);

    const value = valueProp ?? '';

    /** Минимальный набор telemetry-данных */
    const telemetryProps = useMemo(
      () => makeTelemetryValueProps(value, size),
      [value, size],
    );

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия для детерминированности.
     * @remarks
     * Важно: При изменении policy между mount/unmount lifecycle payload может быть
     * менее информативным, так как отражает только начальное состояние.
     * Для отслеживания динамических изменений используйте show/hide telemetry.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: SearchBarTelemetryPayload;
        unmount: SearchBarTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getSearchBarPayload(SearchBarTelemetryAction.Mount, policy, telemetryProps),
      unmount: getSearchBarPayload(SearchBarTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getSearchBarPayloadBase(SearchBarTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getSearchBarPayloadBase(SearchBarTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    /** Обработчик изменения значения с telemetry */
    const handleChange = useCallback(
      (newValue: string, event: ChangeEvent<HTMLInputElement>): void => {
        if (policy.telemetryEnabled) {
          const changePayload = getSearchBarPayload(
            SearchBarTelemetryAction.Change,
            policy,
            makeTelemetryValueProps(newValue, size),
          );
          emitSearchBarTelemetry(telemetry, changePayload);
        }

        onChange?.(newValue, event);
      },
      [policy, size, onChange, telemetry],
    );

    /** Обработчик submit с telemetry */
    const handleSubmit = useCallback(
      (
        submitValue: string,
        event: React.SubmitEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement>,
      ): void => {
        if (policy.telemetryEnabled) {
          const submitPayload = getSearchBarPayload(
            SearchBarTelemetryAction.Submit,
            policy,
            makeTelemetryValueProps(submitValue, size),
          );
          emitSearchBarTelemetry(telemetry, submitPayload);
        }

        onSubmit?.(submitValue, event);
      },
      [policy, size, onSubmit, telemetry],
    );

    /** Обработчик очистки с telemetry */
    const handleClear = useCallback((): void => {
      if (policy.telemetryEnabled) {
        const clearPayload = getSearchBarPayload(
          SearchBarTelemetryAction.Clear,
          policy,
          makeTelemetryValueProps('', size),
        );
        emitSearchBarTelemetry(telemetry, clearPayload);
      }

      onClear?.();
    }, [policy, size, onClear, telemetry]);

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitSearchBarTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitSearchBarTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    /** Telemetry для видимости - only on changes, not on mount */
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitSearchBarTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreSearchBar
        ref={ref}
        value={value}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClear={handleClear}
        disabled={policy.isDisabled}
        showClearButton={policy.showClearByPolicy}
        showSearchButton={policy.showSearchByPolicy}
        {...(placeholder !== undefined && { placeholder })}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        {...(size !== undefined && { size })}
        data-component='AppSearchBar'
        data-state='visible'
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...coreProps}
      />
    );
  },
);

SearchBarComponent.displayName = 'SearchBar';

/**
 * UI-контракт SearchBar компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка accessibility (ARIA)
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректную длину значения
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Change telemetry отправляется при каждом изменении значения
 * - Submit telemetry отправляется при отправке формы поиска
 * - Clear telemetry отправляется при очистке значения
 * Не допускается:
 * - Использование напрямую core SearchBar компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible или props.disabled напрямую вне policy
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <SearchBar
 *   value={searchValue}
 *   onChange={(value) => setSearchValue(value)}
 *   onSubmit={(value) => handleSearch(value)}
 *   placeholder="Search..."
 * />
 * // С feature flags и telemetry
 * <SearchBar
 *   value={searchValue}
 *   onChange={handleChange}
 *   onSubmit={handleSubmit}
 *   visible={isSearchBarVisible}
 *   disabled={isDisabled}
 *   isHiddenByFeatureFlag={!featureFlags.searchEnabled}
 *   isDisabledByFeatureFlag={featureFlags.searchDisabled}
 *   telemetryEnabled={true}
 *   size="large"
 *   showSearchButton={true}
 * />
 * ```
 */
export const SearchBar = memo(SearchBarComponent);
