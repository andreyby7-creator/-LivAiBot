/**
 * @file packages/ui-core/src/components/DatePicker.tsx
 * ============================================================================
 * 🔵 CORE UI DATEPICKER — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для выбора даты
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием открытия/закрытия календаря
 * - Форматирование дат (принимает уже отформатированную строку)
 * - Логику валидации дат
 *
 * Управление:
 * - Видимостью календаря и событиями управляет App-слой
 * - Форматированием дат управляет App-слой
 */

import { forwardRef, memo, useCallback, useMemo } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  FocusEvent,
  HTMLAttributes,
  JSX,
  KeyboardEvent,
  MouseEvent,
  Ref,
} from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** День недели в календаре */
export type CalendarDay = Readonly<{
  /** Дата в формате YYYY-MM-DD */
  date: string;

  /** Номер дня месяца */
  day: number;

  /** Является ли день текущим месяцем */
  isCurrentMonth: boolean;

  /** Является ли день сегодняшним */
  isToday: boolean;

  /** Является ли день выбранным */
  isSelected: boolean;

  /** Является ли день disabled */
  disabled?: boolean;
}>;

/** Неделя в календаре */
export type CalendarWeek = readonly CalendarDay[];

/** Месяц в календаре */
export type CalendarMonth = readonly CalendarWeek[];

export type CoreDatePickerProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onToggle'> & {
    /** Значение даты (отформатированная строка для отображения в input) */
    value?: string;

    /** Placeholder для input */
    placeholder?: string;

    /** Календарь для отображения (массив недель) */
    calendar: CalendarMonth;

    /** Видимость календаря */
    isOpen?: boolean;

    /** Callback при изменении значения через input */
    onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;

    /** Callback при выборе даты из календаря */
    onSelectDate?: (
      date: string,
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    ) => void;

    /** Callback при навигации по календарю (смена месяца/года) */
    onNavigate?: (direction: 'prev' | 'next', event: MouseEvent<HTMLButtonElement>) => void;

    /** Callback при открытии/закрытии календаря */
    onToggle?: (
      isOpen: boolean,
      event:
        | MouseEvent<HTMLButtonElement>
        | KeyboardEvent<HTMLInputElement>
        | FocusEvent<HTMLInputElement>,
    ) => void;

    /** Текущий месяц и год для отображения (например, "January 2024") */
    currentMonthLabel?: string;

    /** Минимальная дата (YYYY-MM-DD) */
    minDate?: string;

    /** Максимальная дата (YYYY-MM-DD) */
    maxDate?: string;

    /** Disabled состояние */
    disabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;

    /** Data state для унифицированной диагностики (App слой) */
    'data-state'?: string;
  }
>;

/* ============================================================================
 * 🎨 CONSTANTS
 * ========================================================================== */

/** Дни недели для заголовков календаря */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const CONTAINER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  width: '100%',
};

const INPUT_WRAPPER_STYLE: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  width: '100%',
};

const INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--datepicker-border-color, #d1d5db)',
  borderRadius: '6px',
  fontSize: '14px',
  lineHeight: '1.5',
  color: 'var(--datepicker-text-color, #111827)',
  backgroundColor: 'var(--datepicker-bg-color, #ffffff)',
  outline: 'none',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

const INPUT_DISABLED_STYLE: CSSProperties = {
  opacity: 0.6,
  cursor: 'not-allowed',
  backgroundColor: 'var(--datepicker-disabled-bg-color, #f3f4f6)',
};

const CALENDAR_BUTTON_STYLE: CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--datepicker-icon-color, #6b7280)',
  transition: 'color 0.2s ease',
};

const CALENDAR_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...CALENDAR_BUTTON_STYLE,
  cursor: 'not-allowed',
  opacity: 0.5,
};

const CALENDAR_POPUP_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '4px',
  backgroundColor: 'var(--datepicker-calendar-bg-color, #ffffff)',
  border: '1px solid var(--datepicker-calendar-border-color, #e5e7eb)',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  padding: '16px',
  zIndex: 1000,
  minWidth: '280px',
};

const CALENDAR_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
};

const CALENDAR_NAV_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  color: 'var(--datepicker-nav-text-color, #374151)',
  transition: 'background-color 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const CALENDAR_MONTH_LABEL_STYLE: CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: 'var(--datepicker-month-text-color, #111827)',
};

const CALENDAR_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '4px',
};

const CALENDAR_WEEKDAY_STYLE: CSSProperties = {
  padding: '8px',
  textAlign: 'center',
  fontSize: '12px',
  fontWeight: '500',
  color: 'var(--datepicker-weekday-text-color, #6b7280)',
};

const CALENDAR_DAY_BUTTON_STYLE: CSSProperties = {
  padding: '8px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '14px',
  color: 'var(--datepicker-day-text-color, #111827)',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  minWidth: '36px',
  minHeight: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  outline: 'none',
  // Focus-visible стили для клавиатурной навигации
  // Используется CSS переменная для кастомизации через тему
  // В браузере :focus-visible применяется автоматически при навигации с клавиатуры
};

const CALENDAR_DAY_OTHER_MONTH_STYLE: CSSProperties = {
  ...CALENDAR_DAY_BUTTON_STYLE,
  color: 'var(--datepicker-day-other-month-text-color, #9ca3af)',
  opacity: 0.5,
};

const CALENDAR_DAY_TODAY_STYLE: CSSProperties = {
  ...CALENDAR_DAY_BUTTON_STYLE,
  fontWeight: '600',
  border: '1px solid var(--datepicker-today-border-color, #3b82f6)',
};

const CALENDAR_DAY_SELECTED_STYLE: CSSProperties = {
  ...CALENDAR_DAY_BUTTON_STYLE,
  backgroundColor: 'var(--datepicker-selected-bg-color, #3b82f6)',
  color: 'var(--datepicker-selected-text-color, #ffffff)',
  fontWeight: '600',
};

const CALENDAR_DAY_DISABLED_STYLE: CSSProperties = {
  ...CALENDAR_DAY_BUTTON_STYLE,
  opacity: 0.4,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

/** Стиль для SVG иконок */
const SVG_ICON_STYLE: CSSProperties = {
  display: 'block',
};

/* ============================================================================
 * 🎯 CORE DATEPICKER
 * ========================================================================== */

const CoreDatePickerComponent = forwardRef<HTMLDivElement, CoreDatePickerProps>(
  function CoreDatePickerComponent(props, ref: Ref<HTMLDivElement>): JSX.Element {
    const {
      value = '',
      placeholder = 'Select date',
      calendar,
      isOpen = false,
      onChange,
      onSelectDate,
      onNavigate,
      onToggle,
      currentMonthLabel = '',
      disabled = false,
      style,
      className,
      'data-testid': testId,
      'data-state': dataState,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...rest
    } = props;

    const containerStyle: CSSProperties = useMemo(() => ({
      ...CONTAINER_STYLE,
      ...style,
    }), [style]);

    const inputStyle: CSSProperties = useMemo(() => ({
      ...INPUT_STYLE,
      ...(disabled && INPUT_DISABLED_STYLE),
    }), [disabled]);

    const calendarButtonStyle: CSSProperties = useMemo(() => ({
      ...(disabled ? CALENDAR_BUTTON_DISABLED_STYLE : CALENDAR_BUTTON_STYLE),
    }), [disabled]);

    const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggle?.(!isOpen, event);
      } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onToggle?.(false, event);
      }
    }, [isOpen, onToggle]);

    const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
      const newValue = event.target.value;
      onChange?.(newValue, event);
    }, [onChange]);

    const handleInputFocus = useCallback((e: FocusEvent<HTMLInputElement>): void => {
      if (!disabled && !isOpen) {
        onToggle?.(true, e);
      }
    }, [disabled, isOpen, onToggle]);

    const handleCalendarButtonClick = useCallback((event: MouseEvent<HTMLButtonElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        onToggle?.(!isOpen, event);
      }
    }, [disabled, isOpen, onToggle]);

    const handleDayClick = useCallback(
      (day: CalendarDay, event: MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        if (day.disabled !== true && onSelectDate !== undefined) {
          onSelectDate(day.date, event);
        }
      },
      [onSelectDate],
    );

    const handleDayKeyDown = useCallback(
      (day: CalendarDay, event: KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (day.disabled !== true && onSelectDate !== undefined) {
            onSelectDate(day.date, event);
          }
        }
      },
      [onSelectDate],
    );

    const handleNavClick = useCallback(
      (direction: 'prev' | 'next', event: MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        onNavigate?.(direction, event);
      },
      [onNavigate],
    );

    const handleNavPrev = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
      handleNavClick('prev', e);
    }, [handleNavClick]);

    const handleNavNext = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
      handleNavClick('next', e);
    }, [handleNavClick]);

    // Создаем обработчики для дней календаря
    const createDayHandlers = useCallback(
      (day: CalendarDay) => {
        const handleClick = (e: MouseEvent<HTMLButtonElement>): void => {
          handleDayClick(day, e);
        };

        const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
          handleDayKeyDown(day, e);
        };

        return { handleClick, handleKeyDown };
      },
      [handleDayClick, handleDayKeyDown],
    );

    return (
      <div
        ref={ref}
        data-component='CoreDatePicker'
        data-state={dataState ?? (isOpen ? 'open' : 'closed')}
        data-testid={testId}
        style={containerStyle}
        className={className}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        {...rest}
      >
        <div style={INPUT_WRAPPER_STYLE}>
          <input
            type='text'
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={handleInputFocus}
            style={inputStyle}
            aria-label={ariaLabel ?? 'Date picker input'}
            aria-expanded={isOpen}
            aria-haspopup='dialog'
            aria-controls={isOpen && testId !== undefined && testId !== ''
              ? `${testId}-calendar`
              : isOpen
              ? 'datepicker-calendar'
              : undefined}
            data-testid={testId !== undefined && testId !== '' ? `${testId}-input` : undefined}
          />
          <button
            type='button'
            onClick={handleCalendarButtonClick}
            disabled={disabled}
            style={calendarButtonStyle}
            aria-label='Open calendar'
            aria-expanded={isOpen}
            data-testid={testId !== undefined && testId !== '' ? `${testId}-toggle` : undefined}
          >
            <svg
              width='16'
              height='16'
              viewBox='0 0 16 16'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              style={SVG_ICON_STYLE}
            >
              <path
                d='M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                d='M2 6H14M6 2V6M10 2V6'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        </div>

        {isOpen && (
          <div
            role='dialog'
            aria-modal='false'
            aria-label='Calendar'
            id={testId !== undefined && testId !== ''
              ? `${testId}-calendar`
              : 'datepicker-calendar'}
            style={CALENDAR_POPUP_STYLE}
            data-testid={testId !== undefined && testId !== '' ? `${testId}-calendar` : undefined}
          >
            <div style={CALENDAR_HEADER_STYLE}>
              <button
                type='button'
                onClick={handleNavPrev}
                style={CALENDAR_NAV_BUTTON_STYLE}
                aria-label='Previous month'
                data-testid={testId !== undefined && testId !== ''
                  ? `${testId}-nav-prev`
                  : undefined}
              >
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 16 16'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M10 12L6 8L10 4'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
              <div style={CALENDAR_MONTH_LABEL_STYLE}>{currentMonthLabel}</div>
              <button
                type='button'
                onClick={handleNavNext}
                style={CALENDAR_NAV_BUTTON_STYLE}
                aria-label='Next month'
                data-testid={testId !== undefined && testId !== ''
                  ? `${testId}-nav-next`
                  : undefined}
              >
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 16 16'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M6 4L10 8L6 12'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
            </div>

            <div style={CALENDAR_GRID_STYLE}>
              {WEEKDAYS.map((day) => (
                <div key={day} style={CALENDAR_WEEKDAY_STYLE} aria-label={day}>
                  {day}
                </div>
              ))}
              {calendar.map((week) =>
                week.map((day) => {
                  // Оптимизация: функция возвращает ссылку на константу стиля, избегая пересоздания объекта
                  const getDayStyle = (d: CalendarDay): CSSProperties => {
                    if (Boolean(d.disabled)) return CALENDAR_DAY_DISABLED_STYLE;
                    if (Boolean(d.isSelected)) return CALENDAR_DAY_SELECTED_STYLE;
                    if (Boolean(d.isToday)) return CALENDAR_DAY_TODAY_STYLE;
                    if (!Boolean(d.isCurrentMonth)) return CALENDAR_DAY_OTHER_MONTH_STYLE;
                    return CALENDAR_DAY_BUTTON_STYLE;
                  };

                  const dayStyle = getDayStyle(day);

                  // day.date гарантированно уникален в пределах calendar (формат YYYY-MM-DD)
                  // Используется как key для React reconciliation
                  const dayDate = day.date;
                  const dayDay = day.day;
                  const { handleClick, handleKeyDown } = createDayHandlers(day);

                  return (
                    <button
                      key={dayDate}
                      type='button'
                      onClick={handleClick}
                      onKeyDown={handleKeyDown}
                      disabled={day.disabled === true}
                      style={dayStyle}
                      aria-label={`${dayDay} ${currentMonthLabel}`}
                      aria-selected={Boolean(day.isSelected)}
                      data-date={dayDate}
                      data-testid={testId !== undefined && testId !== ''
                        ? `${testId}-day-${dayDate}`
                        : undefined}
                    >
                      {dayDay}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

/**
 * Memoized CoreDatePicker.
 *
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как базовый building-block для App-слоя
 */
export const DatePicker = memo(CoreDatePickerComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreDatePicker — это чистый presentational primitive:
 *
 * - Не управляет состоянием открытия/закрытия календаря
 * - Не форматирует даты (принимает уже отформатированные строки)
 * - Не генерирует календарь (принимает готовый calendar prop)
 * - Не валидирует даты
 * - Не имеет встроенных анимаций
 * - Поддерживает ref forwarding
 *
 * Любая бизнес-логика:
 * - когда показывать календарь
 * - форматирование дат
 * - генерация календаря
 * - валидация дат
 * - управление событиями
 *
 * должна реализовываться на App-слое.
 *
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 *
 * CSS переменные для темизации:
 * - --datepicker-border-color: цвет границы input
 * - --datepicker-text-color: цвет текста input
 * - --datepicker-bg-color: фон input
 * - --datepicker-disabled-bg-color: фон disabled input
 * - --datepicker-day-text-color: цвет текста дня
 * - --datepicker-day-other-month-text-color: цвет текста дней других месяцев
 * - --datepicker-today-border-color: цвет границы сегодняшнего дня
 * - --datepicker-selected-bg-color: фон выбранного дня
 * - --datepicker-selected-text-color: цвет текста выбранного дня
 * - --datepicker-weekday-text-color: цвет текста заголовков дней недели
 *
 * Focus-visible: браузер автоматически применяет :focus-visible для клавиатурной навигации.
 * Для кастомизации можно использовать CSS переменные и глобальные стили темы.
 */
