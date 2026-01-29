/**
 * @file packages/ui-core/src/components/LanguageSelector.tsx
 * ============================================================================
 * 🔵 CORE UI LANGUAGE SELECTOR — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для выбора языка интерфейса
 * - Полностью управляемый компонент (не имеет внутреннего UI-состояния)
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием выбранного языка
 * - Логику загрузки списка языков
 * - Бизнес-логику локализации
 *
 * Управление:
 * - Списком языков и выбором управляет App-слой
 */

import React, { forwardRef, memo, useCallback, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * =========================================================================== */

/**
 * Данные языка для отображения в селекторе.
 * Минимальный набор полей для базового выбора языка.
 */
export type LanguageData = Readonly<{
  /** Код языка (ISO 639-1) */
  code: string;

  /** Название языка для отображения */
  name: string;

  /** Флаг/иконка языка (опционально) */
  flag?: ReactNode;

  /** Disabled language cannot be selected */
  isDisabled?: boolean;
}>;

export type CoreLanguageSelectorProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onKeyDown'> & {
    /** Список доступных языков */
    languages: readonly LanguageData[];

    /** Код текущего выбранного языка */
    selectedLanguageCode: string;

    /** Состояние открытия dropdown */
    isOpen: boolean;

    /** Placeholder для селектора. Отображается только если selectedLanguage отсутствует. По умолчанию 'Выберите язык'. */
    placeholder?: string;

    /** Размер селектора. По умолчанию 'medium'. */
    size?: 'small' | 'medium' | 'large';

    /** Вариант отображения. По умолчанию 'default'. */
    variant?: 'default' | 'compact' | 'minimal';

    /** Показывать ли флаги языков. По умолчанию true. */
    showFlags?: boolean;

    /** Показывать ли коды языков. По умолчанию false. */
    showCodes?: boolean;

    /** Полностью блокирует селектор. По умолчанию false. */
    disabled?: boolean;

    /** Callback при выборе языка */
    onLanguageChange?: (languageCode: string) => void;

    /** Callback при клике по селектору или нажатии Enter/Space для переключения состояния */
    onToggle?: () => void;

    /** Callback при закрытии dropdown */
    onClose?: () => void;

    /** Callback для обработки клавиатурных событий (App-слой управляет навигацией) */
    onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;

    /** ID активной опции для aria-activedescendant (управляется App-слоем) */
    activeDescendantId?: string | undefined;

    /** Код языка, активного при клавиатурной навигации (управляется App-слоем) */
    navigatedLanguageCode?: string | undefined;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * =========================================================================== */

const SELECTOR_BASE_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--language-selector-border-color, #D1D5DB)',
  backgroundColor: 'var(--language-selector-bg, #FFFFFF)',
  color: 'var(--language-selector-text-color, #374151)',
  fontSize: '14px',
  fontWeight: '500',
  lineHeight: '1.5',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  outline: 'none',
  userSelect: 'none',
};

const SELECTOR_ACTIVE_STYLE: CSSProperties = {
  ...SELECTOR_BASE_STYLE,
  borderColor: 'var(--language-selector-active-border-color, #3B82F6)',
  boxShadow: '0 0 0 2px var(--language-selector-active-shadow, rgba(59, 130, 246, 0.1))',
};

const SELECTOR_DISABLED_STYLE: CSSProperties = {
  ...SELECTOR_BASE_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const SELECTOR_SMALL_STYLE: CSSProperties = {
  padding: '6px 10px',
  fontSize: '12px',
  gap: '6px',
};

const SELECTOR_LARGE_STYLE: CSSProperties = {
  padding: '12px 16px',
  fontSize: '16px',
  gap: '10px',
};

const SELECTOR_COMPACT_STYLE: CSSProperties = {
  padding: '4px 8px',
  gap: '4px',
};

const SELECTOR_MINIMAL_STYLE: CSSProperties = {
  padding: '2px 6px',
  gap: '2px',
  fontSize: '13px',
};

const DROPDOWN_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 1000,
  marginTop: '4px',
  padding: '8px 0',
  borderRadius: '6px',
  border: '1px solid var(--language-selector-dropdown-border-color, #D1D5DB)',
  backgroundColor: 'var(--language-selector-dropdown-bg, #FFFFFF)',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  maxHeight: '200px',
  overflowY: 'auto',
};

const OPTION_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  fontSize: '14px',
  fontWeight: '400',
  color: 'var(--language-selector-option-text-color, #374151)',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
};

const OPTION_ACTIVE_STYLE: CSSProperties = {
  ...OPTION_STYLE,
  backgroundColor: 'var(--language-selector-option-active-bg, #DBEAFE)',
  color: 'var(--language-selector-option-active-text-color, #1E40AF)',
  fontWeight: '600',
};

const OPTION_NAVIGATED_STYLE: CSSProperties = {
  ...OPTION_STYLE,
  backgroundColor: 'var(--language-selector-option-navigated-bg, #F3F4F6)',
  color: 'var(--language-selector-option-navigated-text-color, #374151)',
  outline: '2px solid var(--language-selector-option-navigated-outline, #3B82F6)',
  outlineOffset: '-2px',
};

const OPTION_DISABLED_STYLE: CSSProperties = {
  ...OPTION_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const FLAG_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '20px',
  height: '16px',
  borderRadius: '2px',
  overflow: 'hidden',
};

const CODE_STYLE: CSSProperties = {
  fontSize: '12px',
  fontWeight: '500',
  color: 'var(--language-selector-code-color, #6B7280)',
  textTransform: 'uppercase',
};

const FLEX_STYLE: CSSProperties = {
  flex: 1,
};

const ARROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '16px',
  height: '16px',
  color: 'currentColor',
  transition: 'transform 0.2s ease',
};

const ARROW_OPEN_STYLE: CSSProperties = {
  ...ARROW_STYLE,
  transform: 'rotate(180deg)',
};

const PLACEHOLDER_STYLE: CSSProperties = {
  color: 'var(--language-selector-placeholder-color, #9CA3AF)',
};

const SELECTED_LANGUAGE_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
};

/* ============================================================================
 * 🎨 STYLE HELPERS
 * =========================================================================== */

/** Получает стили для селектора на основе состояния и размера. */
function getSelectorStyle(
  isOpen: boolean,
  isDisabled: boolean,
  size: 'small' | 'medium' | 'large',
  variant: 'default' | 'compact' | 'minimal',
): CSSProperties {
  // Всегда начинаем с базового стиля
  const baseStyle = SELECTOR_BASE_STYLE;

  // Состояние (приоритет: disabled > active > default)
  const stateStyle = isDisabled
    ? SELECTOR_DISABLED_STYLE
    : isOpen
    ? SELECTOR_ACTIVE_STYLE
    : {};

  // Размер
  const sizeStyle = size === 'small'
    ? SELECTOR_SMALL_STYLE
    : size === 'large'
    ? SELECTOR_LARGE_STYLE
    : {};

  // Вариант
  const variantStyle = variant === 'compact'
    ? SELECTOR_COMPACT_STYLE
    : variant === 'minimal'
    ? SELECTOR_MINIMAL_STYLE
    : {};

  return {
    ...baseStyle,
    ...stateStyle,
    ...sizeStyle,
    ...variantStyle,
  };
}

/** Получает стили для опции языка. */
function getOptionStyle(
  isSelected: boolean,
  isDisabled: boolean,
  isNavigated: boolean = false,
): CSSProperties {
  if (isDisabled) return OPTION_DISABLED_STYLE;
  if (isNavigated) return OPTION_NAVIGATED_STYLE;
  if (isSelected) return OPTION_ACTIVE_STYLE;
  return OPTION_STYLE;
}

/* ============================================================================
 * 🎯 CORE LANGUAGE SELECTOR
 * =========================================================================== */

const CoreLanguageSelectorComponent = forwardRef<HTMLDivElement, CoreLanguageSelectorProps>(
  function CoreLanguageSelectorComponent(
    props: CoreLanguageSelectorProps,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) {
    const {
      languages,
      selectedLanguageCode,
      isOpen,
      placeholder = 'Выберите язык',
      size = 'medium',
      variant = 'default',
      showFlags = true,
      showCodes = false,
      disabled = false,
      onLanguageChange,
      onToggle,
      onClose,
      onKeyDown,
      activeDescendantId,
      navigatedLanguageCode,
      'data-testid': testId,
      ...rest
    } = props;

    /** Найденный выбранный язык */
    const selectedLanguage = useMemo(
      () => languages.find((lang) => lang.code === selectedLanguageCode),
      [languages, selectedLanguageCode],
    );

    /** Стили для селектора */
    const selectorStyle = useMemo<CSSProperties>(
      () => getSelectorStyle(isOpen, disabled, size, variant),
      [isOpen, disabled, size, variant],
    );

    /** Helper для создания test ID с суффиксом */
    const makeTestId = (suffix: string): string | undefined =>
      testId != null && testId !== '' ? `${testId}-${suffix}` : undefined;

    /** Обработчик выбора языка */
    const handleLanguageSelect = useCallback(
      (languageCode: string): void => {
        onLanguageChange?.(languageCode);
        onClose?.();
      },
      [onLanguageChange, onClose],
    );

    /** Обработчик взаимодействия с селектором */
    const handleSelectorInteraction = useCallback((): void => {
      if (!disabled) {
        onToggle?.();
      }
    }, [disabled, onToggle]);

    /** Обработчик клавиатуры для опций */
    const handleOptionKeyDown = useCallback(
      (languageCode: string, isDisabled: boolean, event: React.KeyboardEvent<HTMLDivElement>) => {
        const key = event.key;
        if (key === 'Enter' || key === ' ') {
          event.preventDefault();
          if (!isDisabled) {
            handleLanguageSelect(languageCode);
          }
        }
      },
      [handleLanguageSelect],
    );

    /** Создание обработчиков для опций */
    const createOptionClickHandler = useCallback(
      (languageCode: string, isDisabled: boolean): () => void => {
        return () => {
          if (!isDisabled) {
            handleLanguageSelect(languageCode);
          }
        };
      },
      [handleLanguageSelect],
    );

    const createOptionKeyDownHandler = useCallback(
      (
        languageCode: string,
        isDisabled: boolean,
      ): (event: React.KeyboardEvent<HTMLDivElement>) => void => {
        return (event: React.KeyboardEvent<HTMLDivElement>) => {
          handleOptionKeyDown(languageCode, isDisabled, event);
        };
      },
      [handleOptionKeyDown],
    );

    /** Обработчик клавиатуры для accessibility */
    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
      // Если App-слой предоставил свой обработчик клавиатуры, используем его
      if (onKeyDown != null) {
        onKeyDown(event);
        return;
      }

      // Стандартная обработка (fallback)
      const key = event.key;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        handleSelectorInteraction();
      } else if (key === 'Escape' && isOpen) {
        onClose?.();
      }
      // Arrow navigation реализована в App-слое согласно архитектуре
    }, [handleSelectorInteraction, isOpen, onClose, onKeyDown]);

    return (
      <div
        ref={ref}
        data-component='CoreLanguageSelector'
        data-size={size}
        data-variant={variant}
        {...(disabled && { 'data-disabled': 'true' })}
        {...(isOpen && { 'data-open': 'true' })}
        data-testid={testId}
        {...rest}
      >
        {/* Селектор */}
        <div
          style={selectorStyle}
          onClick={handleSelectorInteraction}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role='combobox'
          id={testId != null && testId !== '' ? makeTestId('selector') : undefined}
          aria-expanded={isOpen}
          aria-haspopup='listbox'
          aria-controls={testId != null && testId !== '' ? makeTestId('dropdown') : undefined}
          aria-activedescendant={activeDescendantId}
          aria-disabled={disabled}
          aria-label='Language selector'
          data-testid={makeTestId('selector')}
        >
          {selectedLanguage
            ? (
              <div style={SELECTED_LANGUAGE_CONTAINER_STYLE}>
                {showFlags && selectedLanguage.flag != null && (
                  <span style={FLAG_STYLE} data-testid={makeTestId('selected-flag')}>
                    {selectedLanguage.flag}
                  </span>
                )}
                <span style={FLEX_STYLE} data-testid={makeTestId('selected-name')}>
                  {selectedLanguage.name}
                </span>
                {showCodes && (
                  <span style={CODE_STYLE} data-testid={makeTestId('selected-code')}>
                    {selectedLanguage.code}
                  </span>
                )}
              </div>
            )
            : (
              <span style={PLACEHOLDER_STYLE}>
                {placeholder}
              </span>
            )}
          <span
            style={isOpen ? ARROW_OPEN_STYLE : ARROW_STYLE}
            data-testid={makeTestId('arrow')}
          >
            ▼
          </span>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div
            style={DROPDOWN_STYLE}
            role='listbox'
            id={testId != null && testId !== '' ? makeTestId('dropdown') : undefined}
            aria-labelledby={testId != null && testId !== '' ? makeTestId('selector') : undefined}
            data-testid={makeTestId('dropdown')}
          >
            {languages.map((language) => {
              const isSelected = language.code === selectedLanguageCode;
              const isDisabled = language.isDisabled === true;
              const isNavigated = !isDisabled && language.code === navigatedLanguageCode;
              const optionStyle = getOptionStyle(isSelected, isDisabled, isNavigated);

              return (
                <div
                  key={language.code}
                  id={isNavigated && testId != null && testId !== ''
                    ? makeTestId(`option-${language.code}`)
                    : undefined}
                  style={optionStyle}
                  onClick={createOptionClickHandler(language.code, isDisabled)}
                  onKeyDown={createOptionKeyDownHandler(language.code, isDisabled)}
                  role='option'
                  aria-selected={isSelected && !isDisabled}
                  aria-disabled={isDisabled}
                  tabIndex={isNavigated ? 0 : -1}
                  {...(isDisabled && { 'data-disabled': 'true' })}
                  {...(isNavigated && { 'data-navigated': 'true' })}
                  data-testid={makeTestId(`option-${language.code}`)}
                  {...(isSelected && { 'data-selected': 'true' })}
                >
                  {showFlags && language.flag != null && (
                    <span style={FLAG_STYLE} data-testid={makeTestId(`flag-${language.code}`)}>
                      {language.flag}
                    </span>
                  )}
                  <span style={FLEX_STYLE} data-testid={makeTestId(`name-${language.code}`)}>
                    {language.name}
                  </span>
                  {showCodes && (
                    <span style={CODE_STYLE} data-testid={makeTestId(`code-${language.code}`)}>
                      {language.code}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

// eslint-disable-next-line functional/immutable-data
CoreLanguageSelectorComponent.displayName = 'CoreLanguageSelector';

/**
 * Memoized CoreLanguageSelector.
 * Полностью управляемый компонент (не имеет внутреннего UI-состояния), SSR и concurrent safe.
 * Поддерживает ref forwarding. Подходит как building-block для App-слоя.
 *
 * @example
 * ```tsx
 * // Базовый селектор языков
 * <LanguageSelector
 *   languages={[
 *     { code: 'en', name: 'English' },
 *     { code: 'ru', name: 'Русский' },
 *     { code: 'es', name: 'Español' }
 *   ]}
 *   selectedLanguageCode="ru"
 *   isOpen={isDropdownOpen}
 *   onLanguageChange={(code) => console.log('Selected:', code)}
 *   onToggle={() => setIsDropdownOpen(!isDropdownOpen)}
 *   onClose={() => setIsDropdownOpen(false)}
 * />
 *
 * // Компактный селектор с кодами
 * <LanguageSelector
 *   languages={languages}
 *   selectedLanguageCode={currentLanguage}
 *   isOpen={isOpen}
 *   size="small"
 *   variant="compact"
 *   showCodes={true}
 *   onLanguageChange={handleLanguageChange}
 *   onToggle={handleToggle}
 *   onClose={handleClose}
 * />
 *
 * // Отключенный селектор
 * <LanguageSelector
 *   languages={languages}
 *   selectedLanguageCode={currentLanguage}
 *   isOpen={false}
 *   disabled={true}
 * />
 * ```
 */
export const LanguageSelector = memo(CoreLanguageSelectorComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * =========================================================================== */

/**
 * CSS Variables для кастомизации через app theme:
 * - --language-selector-border-color: цвет рамки (default: #D1D5DB)
 * - --language-selector-bg: цвет фона (default: #FFFFFF)
 * - --language-selector-text-color: цвет текста (default: #374151)
 * - --language-selector-placeholder-color: цвет placeholder (default: #9CA3AF)
 * - --language-selector-active-border-color: цвет рамки активного (default: #3B82F6)
 * - --language-selector-active-shadow: тень активного (default: rgba(59, 130, 246, 0.1))
 * - --language-selector-dropdown-border-color: цвет рамки dropdown (default: #D1D5DB)
 * - --language-selector-dropdown-bg: цвет фона dropdown (default: #FFFFFF)
 * - --language-selector-option-text-color: цвет текста опций (default: #374151)
 * - --language-selector-option-active-bg: фон активной опции (default: #DBEAFE)
 * - --language-selector-option-active-text-color: цвет текста активной опции (default: #1E40AF)
 * - --language-selector-code-color: цвет кодов языков (default: #6B7280)
 *
 * @contract Data Attributes (для QA)
 *
 * Компонент добавляет следующие data-атрибуты для тестирования и отладки.
 * Все атрибуты используют консистентную схему строковых значений.
 * QA должен использовать именно эти строковые значения для селекторов:
 *
 * - data-component="CoreLanguageSelector": идентификатор компонента
 * - data-size: строго "small" | "medium" | "large" (размер отображения)
 * - data-variant: строго "default" | "compact" | "minimal" (вариант отображения)
 * - data-disabled: "true" | отсутствует (отключенное состояние)
 * - data-open: "true" | отсутствует (открытое состояние dropdown)
 * - data-selected: "true" | отсутствует (выбранная опция)
 * - data-navigated: "true" | отсутствует (опция активная при клавиатурной навигации)
 */
