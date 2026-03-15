/**
 * @file packages/app/src/ui/date-picker.tsx
 * ============================================================================
 * 🟥 APP UI DATEPICKER — UI МИКРОСЕРВИС DATEPICKER
 * ============================================================================
 * Единственная точка входа для DatePicker в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 * - Форматирование дат (dayjs)
 * - Генерация календаря
 * - Валидация дат
 * - Управление состоянием открытия/закрытия
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 */

import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { JSX, Ref } from 'react';
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

import type {
  CalendarDay,
  CalendarMonth,
  CalendarWeek,
  CoreDatePickerProps,
} from '@livai/ui-core/components/DatePicker';
import { DatePicker as CoreDatePicker } from '@livai/ui-core/components/DatePicker';

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

/** Алиас для UI feature flags в контексте date-picker wrapper */
export type DatePickerUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте date-picker */
export type DatePickerWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте date-picker */
export type DatePickerMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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
  & Omit<CoreDatePickerProps, 'value' | 'calendar' | 'currentMonthLabel' | 'isOpen' | 'placeholder'>
  & {
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
  & (
    | {
      /** I18n режим: placeholder обязателен */
      i18nPlaceholderKey: TranslationKey;
      i18nPlaceholderNs?: Namespace;
      i18nPlaceholderParams?: Readonly<Record<string, string | number>>;
      placeholder?: never;
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

const DEFAULT_FORMAT = 'YYYY-MM-DD';

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'telemetryEnabled',
  'i18nPlaceholderKey',
  'i18nPlaceholderNs',
  'i18nPlaceholderParams',
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

function emitDatePickerTelemetry(
  telemetry: UiTelemetryApi,
  payload: DatePickerTelemetryPayload,
): void {
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
  telemetry.infoFireAndForget(`DatePicker ${payload.action}`, serializedPayload);
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
    const { i18n, telemetry } = useUnifiedUI();
    const { translate } = i18n;
    const {
      i18nPlaceholderKey: _i18nPlaceholderKey,
      i18nPlaceholderNs: _i18nPlaceholderNs,
      i18nPlaceholderParams: _i18nPlaceholderParams,
    } = props;
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
      placeholder: placeholderProp = 'Select date',
      'data-testid': testId,
      ...coreProps
    } = filteredProps;

    const policy = useDatePickerPolicy(props);
    const internalRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('div'), [
      internalRef,
    ]);

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
      return placeholderProp;
    }, [
      _i18nPlaceholderKey,
      _i18nPlaceholderNs,
      _i18nPlaceholderParams,
      placeholderProp,
      translate,
    ]);

    /** Placeholder: i18n → fallback → значение по умолчанию */
    const placeholder = useMemo<string>(getPlaceholder, [getPlaceholder]);

    // Инициализация locale для dayjs через централизованную систему
    // SSR-safe: не вызывать side-effects на сервере
    // В production использует динамический импорт для уменьшения bundle size
    useEffect(() => {
      if (locale !== undefined && typeof window !== 'undefined') {
        // Используем async версию для динамической загрузки локалей в production
        i18n.setDayjsLocale(locale).catch(() => {
          // Игнорируем ошибки загрузки локали
        });
      }
    }, [locale, i18n]);

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
      return i18n.formatDateLocalized(currentMonth, 'MMMM YYYY');
    }, [currentMonth, i18n]);

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

      emitDatePickerTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitDatePickerTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    /** Telemetry для открытия/закрытия календаря */
    const prevIsOpenRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentIsOpen = isOpen;
      const prevIsOpen = prevIsOpenRef.current;

      // Emit only on actual open/close changes, not on mount
      if (prevIsOpen !== undefined && prevIsOpen !== currentIsOpen) {
        emitDatePickerTelemetry(
          telemetry,
          currentIsOpen ? openPayload : closePayload,
        );
      }

      prevIsOpenRef.current = currentIsOpen;
    }, [policy.telemetryEnabled, isOpen, openPayload, closePayload, telemetry]);

    // Обработчики событий
    const handleToggle = useCallback((newIsOpen: boolean): void => {
      setIsOpen(newIsOpen);
    }, []);

    const handleSelectDate = useCallback((dateString: string): void => {
      const date = dayjs(dateString);
      if (date.isValid()) {
        onChange?.(date.toDate(), date.format(format));

        if (policy.telemetryEnabled) {
          emitDatePickerTelemetry(telemetry, selectPayload);
        }

        // Закрываем календарь после выбора
        // Примечание: возможен edge-case, если onChange вызывает parent rerender,
        // который меняет valueProp и пересоздает calendar на другой месяц.
        // Обычно безопасно, т.к. закрытие происходит синхронно после onChange.
        setIsOpen(false);
      }
    }, [onChange, format, policy.telemetryEnabled, selectPayload, telemetry]);

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
          emitDatePickerTelemetry(telemetry, {
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
    }, [onChange, onInvalidInput, format, policy, minDate, maxDate, changePayload, telemetry]);

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
      'data-testid': testId ?? 'core-date-picker',
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
 * @contract
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
 * Инварианты:
 * - Календарь корректно отображается для любого месяца
 * - Выбранная дата корректно подсвечивается
 * - Disabled даты не могут быть выбраны
 * - Telemetry payload содержит корректные значения
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
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
