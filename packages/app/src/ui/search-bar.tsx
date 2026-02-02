/**
 * @file packages/app/src/ui/search-bar.tsx
 * ============================================================================
 * 🟥 APP UI SEARCHBAR — UI МИКРОСЕРВИС SEARCHBAR
 * ============================================================================
 *
 * Единственная точка входа для SearchBar в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility / disabled)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * - Debounce логики (должна быть в feature слое)
 *
 * Архитектурные решения:
 * - Управление значением и событиями обрабатывается в App слое
 * - CoreSearchBar остается полностью presentational
 */

import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent, JSX, KeyboardEvent, Ref } from 'react';

import { SearchBar as CoreSearchBar } from '../../../ui-core/src/components/SearchBar.js';
import type { CoreSearchBarProps } from '../../../ui-core/src/components/SearchBar.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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

export type AppSearchBarProps = Readonly<
  Omit<CoreSearchBarProps, 'onChange' | 'onSubmit' | 'onClear' | 'data-testid'> & {
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
 *
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

function emitSearchBarTelemetry(payload: SearchBarTelemetryPayload): void {
  infoFireAndForget(`SearchBar ${payload.action}`, payload);
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
] as const;

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

const SearchBarComponent = forwardRef<HTMLInputElement, AppSearchBarProps>(
  function SearchBarComponent(
    props: AppSearchBarProps,
    ref: Ref<HTMLInputElement>,
  ): JSX.Element | null {
    const filteredProps = omit(props, BUSINESS_PROPS);
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
     *
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

    // eslint-disable-next-line functional/immutable-data
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
          emitSearchBarTelemetry(changePayload);
        }

        onChange?.(newValue, event);
      },
      [policy, size, onChange],
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
          emitSearchBarTelemetry(submitPayload);
        }

        onSubmit?.(submitValue, event);
      },
      [policy, size, onSubmit],
    );

    /** Обработчик очистки с telemetry */
    const handleClear = useCallback((): void => {
      if (policy.telemetryEnabled) {
        const clearPayload = getSearchBarPayload(
          SearchBarTelemetryAction.Clear,
          policy,
          makeTelemetryValueProps('', size),
        );
        emitSearchBarTelemetry(clearPayload);
      }

      onClear?.();
    }, [policy, size, onClear]);

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitSearchBarTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitSearchBarTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    /** Telemetry для видимости - only on changes, not on mount */
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitSearchBarTelemetry(
          currentVisibility ? showPayload : hidePayload,
        );
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload]);

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

// eslint-disable-next-line functional/immutable-data
SearchBarComponent.displayName = 'SearchBar';

/**
 * UI-контракт SearchBar компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректную длину значения
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Change telemetry отправляется при каждом изменении значения
 * - Submit telemetry отправляется при отправке формы поиска
 * - Clear telemetry отправляется при очистке значения
 *
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
 *
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
