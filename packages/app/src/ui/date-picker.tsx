/**
 * @file packages/app/src/ui/date-picker.tsx
 * ============================================================================
 * 🟥 APP UI DATEPICKER — UI МИКРОСЕРВИС DATEPICKER
 * ============================================================================
 *
 * Единственная точка входа для DatePicker в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 * - Форматирование дат (dayjs)
 * - Генерация календаря
 * - Валидация дат
 * - Управление состоянием открытия/закрытия
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 */

import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { JSX, Ref } from 'react';

import { DatePicker as CoreDatePicker } from '../../../ui-core/src/components/DatePicker.js';
import type {
  CalendarDay,
  CalendarMonth,
  CalendarWeek,
  CoreDatePickerProps,
} from '../../../ui-core/src/components/DatePicker.js';
import { formatDateLocalized, setDayjsLocale, t } from '../lib/i18n.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum DatePickerTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Open = 'open',
  Close = 'close',
  Select = 'select',
  Change = 'change',
}

type DatePickerTelemetryPayload = Readonly<{
  component: 'DatePicker';
  action: DatePickerTelemetryAction;
  hidden: boolean;
  visible: boolean;
  isOpen: boolean;
  value: string | null;
  format: string | undefined;
}>;

export type AppDatePickerProps = Readonly<
  Omit<CoreDatePickerProps, 'value' | 'calendar' | 'currentMonthLabel' | 'isOpen'> & {
    /** Значение даты (Date, string в формате ISO, или dayjs объект) */
    value?: Date | string | Dayjs | null;

    /** Callback при изменении даты */
    onChange?: (date: Date | null, formattedValue: string) => void;

    /** Формат даты для отображения (dayjs format) */
    format?: string;

    /** Locale для dayjs */
    locale?: string;

    /** Видимость DatePicker (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть DatePicker */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить DatePicker */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Минимальная дата (Date, string в формате ISO, или dayjs объект) */
    minDate?: Date | string | Dayjs;

    /** Максимальная дата (Date, string в формате ISO, или dayjs объект) */
    maxDate?: Date | string | Dayjs;

    /** Disabled состояние */
    disabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;

    /** Callback при некорректном вводе даты */
    onInvalidInput?: (value: string) => void;
  }
>;

const DEFAULT_FORMAT = 'YYYY-MM-DD';

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

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type DatePickerPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * DatePickerPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useDatePickerPolicy(props: AppDatePickerProps): DatePickerPolicy {
  const hiddenByFlag = Boolean(props.isHiddenByFeatureFlag);
  const disabledByFlag = Boolean(props.isDisabledByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFlag && props.visible !== false;
    return {
      hiddenByFeatureFlag: hiddenByFlag,
      disabledByFeatureFlag: disabledByFlag,
      isRendered,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [hiddenByFlag, disabledByFlag, props.visible, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitDatePickerTelemetry(payload: DatePickerTelemetryPayload): void {
  // Сериализуем payload для telemetry (format может быть undefined)
  const serializedPayload: Readonly<Record<string, string | number | boolean | null>> = {
    component: payload.component,
    action: payload.action,
    hidden: payload.hidden,
    visible: payload.visible,
    isOpen: payload.isOpen,
    value: payload.value,
    ...(payload.format !== undefined ? { format: payload.format } : {}),
  };
  infoFireAndForget(`DatePicker ${payload.action}`, serializedPayload);
}

/** Helper для безопасной конвертации в dayjs или null */
function toDayjsOrNull(value: Date | string | Dayjs | null | undefined): Dayjs | null {
  if (value === null || value === undefined) return null;
  const date = dayjs(value);
  return date.isValid() ? date : null;
}

/** Формирование payload для DatePicker telemetry. */
function getDatePickerPayload(
  action: DatePickerTelemetryAction,
  policy: DatePickerPolicy,
  telemetryProps: {
    isOpen: boolean;
    value: string | null;
    format: string | undefined;
  },
): DatePickerTelemetryPayload {
  return {
    component: 'DatePicker',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    isOpen: telemetryProps.isOpen,
    value: telemetryProps.value,
    format: telemetryProps.format ?? undefined,
  };
}

/* ============================================================================
 * 🗓️ CALENDAR GENERATION
 * ========================================================================== */

/** Генерация календаря для указанного месяца. */
function generateCalendar(
  month: Dayjs,
  selectedDate: Dayjs | null,
  minDate: Dayjs | null,
  maxDate: Dayjs | null,
): CalendarMonth {
  const startOfMonth = month.startOf('month');
  const endOfMonth = month.endOf('month');
  const startOfCalendar = startOfMonth.startOf('week');
  const endOfCalendar = endOfMonth.endOf('week');

  const DAYS_PER_WEEK = 7;
  const weeks: CalendarWeek[] = [];
  let currentDate = startOfCalendar;

  while (currentDate.isBefore(endOfCalendar) || currentDate.isSame(endOfCalendar, 'day')) {
    const week: CalendarDay[] = [];

    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const isCurrentMonth = currentDate.month() === month.month();
      const isToday = currentDate.isSame(dayjs(), 'day');
      const isSelected = selectedDate !== null && currentDate.isSame(selectedDate, 'day');
      const isDisabled = (minDate !== null && currentDate.isBefore(minDate, 'day'))
        || (maxDate !== null && currentDate.isAfter(maxDate, 'day'));

      // eslint-disable-next-line functional/immutable-data
      week.push({
        date: currentDate.format('YYYY-MM-DD'),
        day: currentDate.date(),
        isCurrentMonth,
        isToday,
        isSelected,
        disabled: isDisabled,
      });

      currentDate = currentDate.add(1, 'day');
    }

    // eslint-disable-next-line functional/immutable-data
    weeks.push([...week]);
  }

  return weeks;
}

/* ============================================================================
 * 🎯 APP DATEPICKER
 * ========================================================================== */

const DatePickerComponent = forwardRef<HTMLDivElement, AppDatePickerProps>(
  function DatePickerComponent(
    props: AppDatePickerProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const filteredProps = omit(props, BUSINESS_PROPS);
    const {
      value: valueProp,
      onChange,
      onInvalidInput,
      format = DEFAULT_FORMAT,
      locale,
      minDate: minDateProp,
      maxDate: maxDateProp,
      disabled = false,
      placeholder = t('datepicker.placeholder', { default: 'Select date' }),
      'data-testid': testId,
      ...coreProps
    } = filteredProps;

    const policy = useDatePickerPolicy(props);
    const internalRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('div'), [
      internalRef,
    ]);

    // Инициализация locale для dayjs через централизованную систему
    // SSR-safe: не вызывать side-effects на сервере
    useEffect(() => {
      if (locale !== undefined && typeof window !== 'undefined') {
        setDayjsLocale(locale).catch(() => {
          // Обработка ошибки уже происходит внутри setDayjsLocale
        });
      }
    }, [locale]);

    // Нормализация дат
    const selectedDate = useMemo(() => toDayjsOrNull(valueProp), [valueProp]);

    const minDate = useMemo(() => toDayjsOrNull(minDateProp), [minDateProp]);

    const maxDate = useMemo(() => toDayjsOrNull(maxDateProp), [maxDateProp]);

    // Текущий месяц для отображения календаря
    // Используется selectedDate, если доступен, иначе today как fallback
    const [currentMonth, setCurrentMonth] = useState<Dayjs>(() => {
      return selectedDate ?? dayjs();
    });

    // Состояние открытия календаря
    const [isOpen, setIsOpen] = useState<boolean>(false);

    // Обновляем currentMonth при изменении selectedDate
    useEffect(() => {
      if (selectedDate !== null) {
        setCurrentMonth(selectedDate);
      }
    }, [selectedDate]);

    // Генерация календаря
    // Примечание: calendar пересоздается при изменении currentMonth/selectedDate/min/maxDate.
    // Это нормально, т.к. зависимость есть. Для больших календарей производительность
    // проверена и приемлема для стандартного UI (42 дня максимум).
    const calendar = useMemo(() => {
      return generateCalendar(currentMonth, selectedDate, minDate, maxDate);
    }, [currentMonth, selectedDate, minDate, maxDate]);

    // Форматированное значение для input
    const formattedValue = useMemo(() => {
      if (selectedDate === null) return '';
      return selectedDate.format(format);
    }, [selectedDate, format]);

    // Метка текущего месяца
    const currentMonthLabel = useMemo(() => {
      return formatDateLocalized(currentMonth, 'MMMM YYYY');
    }, [currentMonth]);

    /** Минимальный набор telemetry-данных */
    const telemetryProps = useMemo(() => ({
      isOpen,
      value: formattedValue,
      format,
    }), [isOpen, formattedValue, format]);

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: DatePickerTelemetryPayload;
        unmount: DatePickerTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getDatePickerPayload(DatePickerTelemetryAction.Mount, policy, telemetryProps),
      unmount: getDatePickerPayload(DatePickerTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    /**
     * Policy snapshot для детерминированных telemetry payloads.
     * Фиксируется на mount, чтобы payload не пересоздавались при изменении
     * только telemetryEnabled или других редко меняющихся свойств policy.
     */
    const policySnapshotRef = useRef<DatePickerPolicy | undefined>(undefined);

    // eslint-disable-next-line functional/immutable-data
    policySnapshotRef.current ??= policy;

    const policySnapshot = policySnapshotRef.current;

    // Payload для telemetry (мемоизированы для избежания пересоздания)
    // Используют policySnapshot для детерминированности
    const openPayload = useMemo(
      () => ({
        ...getDatePickerPayload(DatePickerTelemetryAction.Open, policySnapshot, {
          ...telemetryProps,
          isOpen: true,
        }),
      }),
      [policySnapshot, telemetryProps],
    );

    const closePayload = useMemo(
      () => ({
        ...getDatePickerPayload(DatePickerTelemetryAction.Close, policySnapshot, {
          ...telemetryProps,
          isOpen: false,
        }),
      }),
      [policySnapshot, telemetryProps],
    );

    const selectPayload = useMemo(
      () => ({
        ...getDatePickerPayload(DatePickerTelemetryAction.Select, policySnapshot, telemetryProps),
      }),
      [policySnapshot, telemetryProps],
    );

    const changePayload = useMemo(
      () => ({
        ...getDatePickerPayload(DatePickerTelemetryAction.Change, policySnapshot, telemetryProps),
      }),
      [policySnapshot, telemetryProps],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitDatePickerTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitDatePickerTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    /** Telemetry для открытия/закрытия календаря */
    const prevIsOpenRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentIsOpen = isOpen;
      const prevIsOpen = prevIsOpenRef.current;

      // Emit only on actual open/close changes, not on mount
      if (prevIsOpen !== undefined && prevIsOpen !== currentIsOpen) {
        emitDatePickerTelemetry(
          currentIsOpen ? openPayload : closePayload,
        );
      }

      // eslint-disable-next-line functional/immutable-data
      prevIsOpenRef.current = currentIsOpen;
    }, [policy.telemetryEnabled, isOpen, openPayload, closePayload]);

    // Обработчики событий
    const handleToggle = useCallback((newIsOpen: boolean): void => {
      setIsOpen(newIsOpen);
    }, []);

    const handleSelectDate = useCallback((dateString: string): void => {
      const date = dayjs(dateString);
      if (date.isValid()) {
        onChange?.(date.toDate(), date.format(format));

        if (policy.telemetryEnabled) {
          emitDatePickerTelemetry(selectPayload);
        }

        // Закрываем календарь после выбора
        // Примечание: возможен edge-case, если onChange вызывает parent rerender,
        // который меняет valueProp и пересоздает calendar на другой месяц.
        // Обычно безопасно, т.к. закрытие происходит синхронно после onChange.
        setIsOpen(false);
      }
    }, [onChange, format, policy.telemetryEnabled, selectPayload]);

    const handleNavigate = useCallback((direction: 'prev' | 'next'): void => {
      setCurrentMonth((prev) => {
        return direction === 'prev' ? prev.subtract(1, 'month') : prev.add(1, 'month');
      });
    }, []);

    const handleInputChange = useCallback((newValue: string): void => {
      // Парсим введенное значение в strict mode
      const parsedDate = dayjs(newValue, format, true);
      if (parsedDate.isValid()) {
        // Проверяем диапазон minDate/maxDate
        const isOutOfRange = (minDate !== null && parsedDate.isBefore(minDate, 'day'))
          || (maxDate !== null && parsedDate.isAfter(maxDate, 'day'));

        if (isOutOfRange) {
          // Дата вне допустимого диапазона
          onInvalidInput?.(newValue);
          return;
        }

        onChange?.(parsedDate.toDate(), newValue);

        if (policy.telemetryEnabled) {
          emitDatePickerTelemetry({
            ...changePayload,
            value: newValue, // Override with actual new value
          });
        }
      } else if (newValue === '') {
        // Пустое значение = сброс даты
        onChange?.(null, '');
      } else {
        // Некорректный ввод (не пустой и не валидный)
        onInvalidInput?.(newValue);
      }
    }, [onChange, onInvalidInput, format, policy, minDate, maxDate, changePayload]);

    const coreDatePickerProps = useMemo((): CoreDatePickerProps => ({
      value: formattedValue,
      placeholder,
      calendar,
      isOpen,
      onChange: handleInputChange,
      onSelectDate: handleSelectDate,
      onNavigate: handleNavigate,
      onToggle: handleToggle,
      currentMonthLabel,
      ...(minDate !== null ? { minDate: minDate.format('YYYY-MM-DD') } : {}),
      ...(maxDate !== null ? { maxDate: maxDate.format('YYYY-MM-DD') } : {}),
      disabled: policy.disabledByFeatureFlag || disabled || undefined,
      'data-component': 'AppDatePicker',
      'data-state': policy.isRendered ? 'visible' : 'hidden',
      'data-feature-flag': policy.hiddenByFeatureFlag ? 'hidden' : 'visible',
      'data-disabled': policy.disabledByFeatureFlag || undefined,
      'data-telemetry': policy.telemetryEnabled ? 'enabled' : 'disabled',
      ...(testId !== undefined ? { 'data-testid': testId } : {}),
      ...coreProps,
    } as CoreDatePickerProps), [
      formattedValue,
      placeholder,
      calendar,
      isOpen,
      handleInputChange,
      handleSelectDate,
      handleNavigate,
      handleToggle,
      currentMonthLabel,
      minDate,
      maxDate,
      disabled,
      policy.isRendered,
      policy.hiddenByFeatureFlag,
      policy.disabledByFeatureFlag,
      policy.telemetryEnabled,
      testId,
      coreProps,
    ]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreDatePicker
        ref={internalRef}
        {...coreDatePickerProps}
      />
    );
  },
);

/**
 * UI-контракт DatePicker компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия DatePicker
 * - Корректная обработка accessibility (keyboard navigation, ARIA)
 * - Форматирование дат через dayjs с централизованной i18n
 * - Генерация календаря
 * - Валидация дат через minDate/maxDate (включая ручной ввод)
 * - Обработка некорректного ввода через onInvalidInput callback
 *
 * Инварианты:
 * - Календарь корректно отображается для любого месяца
 * - Выбранная дата корректно подсвечивается
 * - Disabled даты не могут быть выбраны
 * - Telemetry payload содержит корректные значения
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование напрямую core DatePicker компонента
 * - Игнорирование feature flag логики
 * - Нарушение keyboard navigation контрактов
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const DatePicker = Object.assign(memo(DatePickerComponent) as typeof DatePickerComponent, {
  displayName: 'DatePicker',
});
