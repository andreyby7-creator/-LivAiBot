/**
 * @file packages/ui-core/src/components/SearchBar.tsx
 * ============================================================================
 * 🔵 CORE UI SEARCHBAR — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения поисковой строки
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием значения
 * - Debounce логики
 * - Таймеров или анимаций
 * Управление:
 * - Значением и событиями управляет App-слой
 */

import React, { forwardRef, memo, useCallback, useMemo } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  HTMLAttributes,
  JSX,
  KeyboardEvent,
  ReactNode,
  Ref,
} from 'react';

import type { UISize, UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type CoreSearchBarProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onSubmit'> & {
    /**
     * Значение поискового запроса. Управляется извне через controlled component pattern.
     */
    value?: string;

    /**
     * Callback при изменении значения. Если не передан, поле будет read-only.
     */
    onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;

    /**
     * Callback при отправке формы (Enter или клик на кнопку поиска).
     */
    onSubmit?: (
      value: string,
      event: React.SubmitEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement>,
    ) => void;

    /** Placeholder текст для input поля. */
    placeholder?: string;

    /**
     * Показывать ли кнопку очистки. По умолчанию true.
     * Кнопка отображается только когда есть значение.
     */
    showClearButton?: boolean;

    /** Показывать ли кнопку поиска. По умолчанию false. */
    showSearchButton?: boolean;

    /**
     * Текст на кнопке поиска. По умолчанию 'Search'.
     * Используется только если showSearchButton === true.
     */
    searchButtonLabel?: string;

    /** Иконка поиска (ReactNode). Обычно отображается слева от input поля. */
    searchIcon?: ReactNode;

    /**
     * Иконка очистки (ReactNode). По умолчанию '×'.
     */
    clearIcon?: ReactNode;

    /** Может быть disabled. По умолчанию false. */
    disabled?: boolean;

    /** Размер поисковой строки. По умолчанию 'medium'. */
    size?: 'small' | 'medium' | 'large';

    /**
     * Ширина поисковой строки. По умолчанию '100%'.
     * Поддерживает любые CSS единицы (px, rem, %, var() и т.д.).
     */
    width?: UISize;

    /**
     * Callback при клике на кнопку очистки.
     * Если не передан, используется onChange('').
     */
    onClear?: () => void;

    /** ARIA: ID элемента с описанием поисковой строки (для ошибок или подсказок). */
    'aria-describedby'?: string;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const DEFAULT_WIDTH = '100%';

const SEARCHBAR_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  position: 'relative',
};

const SEARCHBAR_FORM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  position: 'relative',
};

const SEARCHBAR_INPUT_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  position: 'relative',
};

const SEARCHBAR_INPUT_BASE_STYLE: CSSProperties = {
  width: '100%',
  border: '1px solid var(--searchbar-border-color, #E5E7EB)',
  borderRadius: '8px',
  fontSize: '14px',
  lineHeight: '1.5',
  color: 'var(--searchbar-text-color, #111827)',
  backgroundColor: 'var(--searchbar-bg, #FFFFFF)',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

const SEARCHBAR_INPUT_SMALL_STYLE: CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
};

const SEARCHBAR_INPUT_MEDIUM_STYLE: CSSProperties = {
  padding: '8px 12px',
};

const SEARCHBAR_INPUT_LARGE_STYLE: CSSProperties = {
  padding: '12px 16px',
  fontSize: '16px',
};

/** Padding справа для размещения кнопки очистки. Зависит от размера input поля. */
const SEARCHBAR_PADDING_RIGHT: Record<'small' | 'medium' | 'large', string> = {
  small: '28px',
  medium: '32px',
  large: '40px',
};

/** Padding слева для размещения иконки поиска. */
const ICON_PADDING_STYLE: CSSProperties = { paddingLeft: '36px' };

const SEARCHBAR_ICON_STYLE: CSSProperties = {
  position: 'absolute',
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--searchbar-icon-color, #6B7280)',
  pointerEvents: 'none',
  width: '16px',
  height: '16px',
};

/* ============================================================================
 * 🎨 STYLE HELPERS
 * ========================================================================== */

/**
 * Получает стили для input поля на основе размера, состояния disabled и наличия иконки.
 * @param customStyle - Кастомные стили, применяются последними и могут переопределить любые предыдущие.
 * @remarks
 * Порядок применения: baseStyle → sizeStyle → iconPaddingStyle → disabledStyle → customStyle
 */
function getInputStyle(
  size: 'small' | 'medium' | 'large',
  disabled: boolean,
  hasIcon: boolean,
  customStyle?: CSSProperties,
): CSSProperties {
  const baseStyle = SEARCHBAR_INPUT_BASE_STYLE;

  const sizeStyle = {
    ...(size === 'small'
      ? SEARCHBAR_INPUT_SMALL_STYLE
      : size === 'medium'
      ? SEARCHBAR_INPUT_MEDIUM_STYLE
      : SEARCHBAR_INPUT_LARGE_STYLE),
    paddingRight: SEARCHBAR_PADDING_RIGHT[size],
  };

  const disabledStyle = disabled
    ? {
      opacity: 0.6,
      cursor: 'not-allowed',
      backgroundColor: 'var(--searchbar-disabled-bg, #F9FAFB)',
    }
    : {};

  return {
    ...baseStyle,
    ...sizeStyle,
    ...(hasIcon && ICON_PADDING_STYLE),
    ...disabledStyle,
    ...customStyle,
  };
}

const SEARCHBAR_CLEAR_BUTTON_STYLE: CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--searchbar-clear-color, #6B7280)',
  cursor: 'pointer',
  padding: 0,
  borderRadius: '4px',
  transition: 'background-color 0.2s ease, color 0.2s ease',
};

const SEARCHBAR_SEARCH_BUTTON_STYLE: CSSProperties = {
  marginLeft: '8px',
  padding: '8px 16px',
  border: '1px solid var(--searchbar-button-border-color, #3B82F6)',
  borderRadius: '8px',
  backgroundColor: 'var(--searchbar-button-bg, #3B82F6)',
  color: 'var(--searchbar-button-text-color, #FFFFFF)',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease, border-color 0.2s ease',
  whiteSpace: 'nowrap',
};

const SEARCHBAR_SEARCH_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...SEARCHBAR_SEARCH_BUTTON_STYLE,
  opacity: 0.6,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

/* ============================================================================
 * 🎯 EVENT HANDLERS (Pure Functions)
 * ========================================================================== */

/**
 * Обработчик submit или нажатия Enter.
 * Чистая функция для unit тестирования без рендера.
 */
function handleSubmitOrEnter(
  value: string,
  disabled: boolean,
  onSubmit?: (
    value: string,
    event: React.SubmitEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement>,
  ) => void,
  event?: React.SubmitEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement>,
): void {
  if (disabled || !onSubmit || !event) return;

  if ('preventDefault' in event) {
    event.preventDefault();
  }

  onSubmit(value, event);
}

/**
 * Создает синтетическое ChangeEvent для onChange callback.
 * Используется при программном изменении значения (например, при очистке через кнопку clear).
 */
function createSyntheticChangeEvent(value: string): ChangeEvent<HTMLInputElement> {
  return {
    target: { value },
    currentTarget: { value },
    // Минимальные поля для совместимости с ChangeEvent
    bubbles: false,
    cancelable: false,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: false,
    nativeEvent: {} as Event,
    preventDefault: (): void => {},
    stopPropagation: (): void => {},
    isDefaultPrevented: (): boolean => false,
    isPropagationStopped: (): boolean => false,
    persist: (): void => {},
    timeStamp: Date.now(),
    type: 'change',
  } as ChangeEvent<HTMLInputElement>;
}

/**
 * Обработчик очистки значения.
 * Если передан onClear, вызывается он напрямую, иначе используется onChange('') с синтетическим событием.
 */
function handleClearValue(
  disabled: boolean,
  onClear?: () => void,
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void,
): void {
  if (disabled) return;

  if (onClear) {
    onClear();
  } else if (onChange) {
    onChange('', createSyntheticChangeEvent(''));
  }
}

/* ============================================================================
 * 🎯 CORE SEARCHBAR
 * ========================================================================== */

const CoreSearchBarComponent = forwardRef<HTMLInputElement, CoreSearchBarProps>(
  function CoreSearchBarComponent(props, ref: Ref<HTMLInputElement>): JSX.Element {
    const {
      value = '',
      onChange,
      onSubmit,
      placeholder,
      showClearButton = true,
      showSearchButton = false,
      searchButtonLabel = 'Search',
      searchIcon,
      clearIcon = '×',
      disabled = false,
      size = 'medium',
      width = DEFAULT_WIDTH,
      onClear,
      style,
      className,
      'aria-describedby': ariaDescribedBy,
      'data-testid': testId,
      ...rest
    } = props;

    const hasValue = value.length > 0;
    const hasIcon = useMemo(() => searchIcon != null, [searchIcon]);
    const showClear = useMemo(
      () => showClearButton && hasValue && !disabled,
      [showClearButton, hasValue, disabled],
    );

    const inputStyle: CSSProperties = useMemo(() => {
      return getInputStyle(size, disabled, hasIcon, style);
    }, [size, disabled, hasIcon, style]);

    const containerStyle: CSSProperties = useMemo(() => ({
      ...SEARCHBAR_CONTAINER_STYLE,
      width,
    }), [width]);

    /** Helper для создания test ID с суффиксом. */
    const makeTestId = useCallback(
      (suffix: string): string | undefined => {
        return testId != null && testId !== '' ? `${testId}-${suffix}` : undefined;
      },
      [testId],
    );

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>): void => {
        if (disabled) return;
        onChange?.(event.target.value, event);
      },
      [disabled, onChange],
    );

    const handleClear = useCallback((): void => {
      handleClearValue(disabled, onClear, onChange);
    }, [disabled, onClear, onChange]);

    /** Обрабатывает submit формы или нажатие Enter в input поле. */
    const handleSubmitOrEnterKey = useCallback(
      (
        event: React.SubmitEvent<HTMLFormElement> | KeyboardEvent<HTMLInputElement>,
      ): void => {
        // Для KeyboardEvent проверяем, что нажата клавиша Enter
        if ('key' in event && event.key !== 'Enter') {
          return;
        }
        handleSubmitOrEnter(value, disabled, onSubmit, event);
      },
      [disabled, onSubmit, value],
    );

    return (
      <div
        aria-label='Search container'
        data-component='CoreSearchBar'
        data-size={size}
        data-disabled={disabled || undefined}
        data-testid={testId}
        style={containerStyle}
        className={className}
        {...rest}
      >
        <form
          role='search'
          aria-label='Search form'
          onSubmit={handleSubmitOrEnterKey}
          style={SEARCHBAR_FORM_STYLE}
          data-testid={makeTestId('form')}
        >
          <div
            style={SEARCHBAR_INPUT_WRAPPER_STYLE}
            data-testid={makeTestId('wrapper')}
          >
            {hasIcon && (
              <span
                style={SEARCHBAR_ICON_STYLE}
                aria-hidden='true'
                data-testid={makeTestId('icon')}
              >
                {searchIcon}
              </span>
            )}
            <input
              ref={ref}
              type='text'
              role='searchbox'
              aria-label='Search input'
              aria-required={false}
              aria-describedby={ariaDescribedBy}
              value={value}
              onChange={handleChange}
              onKeyDown={handleSubmitOrEnterKey}
              placeholder={placeholder}
              disabled={disabled}
              style={inputStyle}
              data-testid={makeTestId('input')}
            />
            {showClear && (
              <button
                type='button'
                aria-label='Clear search'
                tabIndex={0}
                onClick={handleClear}
                style={SEARCHBAR_CLEAR_BUTTON_STYLE}
                data-testid={makeTestId('clear')}
              >
                {clearIcon}
              </button>
            )}
          </div>
          {showSearchButton && (
            <button
              type='submit'
              aria-label={searchButtonLabel}
              disabled={disabled}
              style={disabled
                ? SEARCHBAR_SEARCH_BUTTON_DISABLED_STYLE
                : SEARCHBAR_SEARCH_BUTTON_STYLE}
              data-testid={makeTestId('search-button')}
            >
              {searchButtonLabel}
            </button>
          )}
        </form>
      </div>
    );
  },
);

CoreSearchBarComponent.displayName = 'CoreSearchBar';

/**
 * Memoized CoreSearchBar.
 * Полностью детерминированный, side-effect free, SSR и concurrent safe.
 * Поддерживает ref forwarding. Подходит как building-block для App-слоя.
 */
export const SearchBar = memo(CoreSearchBarComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CSS Variables для кастомизации через app theme:
 * - --searchbar-border-color: цвет границы input (default: #E5E7EB)
 * - --searchbar-text-color: цвет текста (default: #111827)
 * - --searchbar-bg: цвет фона input (default: #FFFFFF)
 * - --searchbar-disabled-bg: цвет фона в disabled состоянии (default: #F9FAFB)
 * - --searchbar-icon-color: цвет иконки поиска (default: #6B7280)
 * - --searchbar-clear-color: цвет кнопки очистки (default: #6B7280)
 * - --searchbar-button-border-color: цвет границы кнопки поиска (default: #3B82F6)
 * - --searchbar-button-bg: цвет фона кнопки поиска (default: #3B82F6)
 * - --searchbar-button-text-color: цвет текста кнопки поиска (default: #FFFFFF)
 */
