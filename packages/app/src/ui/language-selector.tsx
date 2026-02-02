/**
 * @file packages/app/src/ui/language-selector.tsx
 * ============================================================================
 * 🌐 APP UI LANGUAGE SELECTOR — UI МИКРОСЕРВИС LANGUAGE SELECTOR
 * ============================================================================
 *
 * Stateful UI-фасад над CoreLanguageSelector.
 * Единственная точка входа для LanguageSelector в приложении.
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
 * - Логики загрузки списка языков
 * - Логики сохранения выбранного языка
 *
 * Архитектурные решения:
 * - Управление списком языков и выбором обрабатывается в App слое
 * - CoreLanguageSelector остается полностью presentational
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, KeyboardEvent, Ref } from 'react';

import {
  LanguageSelector as CoreLanguageSelector,
} from '../../../ui-core/src/components/LanguageSelector.js';
import type {
  CoreLanguageSelectorProps,
  LanguageData,
} from '../../../ui-core/src/components/LanguageSelector.js';
import { useI18n } from '../lib/i18n.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🛠️ УТИЛИТЫ
 * ========================================================================== */

// Фильтрует указанные ключи из объекта
function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const keySet = new Set(keys as readonly string[]);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keySet.has(key)),
  ) as Omit<T, K>;
}

/** Тип элемента, который может рендерить LanguageSelector */
type LanguageSelectorElement = HTMLDivElement;

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * =========================================================================== */

const LanguageSelectorTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  Open: 'open',
  Close: 'close',
  Change: 'change',
} as const;

type LanguageSelectorTelemetryAction =
  typeof LanguageSelectorTelemetryAction[keyof typeof LanguageSelectorTelemetryAction];

type LanguageSelectorSize = 'small' | 'medium' | 'large';
type LanguageSelectorVariant = 'default' | 'compact' | 'minimal';

/** Поддерживаемые клавиши для клавиатурной навигации */
type NavigationKey = 'Escape' | 'Enter' | ' ' | 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

type LanguageSelectorTelemetryPayload = {
  component: 'LanguageSelector';
  action: LanguageSelectorTelemetryAction;
  timestamp: number;
  hidden: boolean;
  visible: boolean;
  disabled: boolean;
  size?: LanguageSelectorSize;
  variant?: LanguageSelectorVariant;
  selectedLanguageCode: string;
  availableLanguagesCount: number;
  showFlags: boolean;
  showCodes: boolean;
  locale: string;
};

export type AppLanguageSelectorProps = Readonly<
  Omit<CoreLanguageSelectorProps, 'data-testid'> & {
    /** Видимость LanguageSelector (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть LanguageSelector */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить LanguageSelector */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при выборе языка (App уровень) */
    onLanguageSelect?: (language: LanguageData) => void;

    /** Controlled open state - если передан, App полностью контролирует открытие dropdown */
    isOpen?: boolean;

    /** Callback при изменении состояния открытия (для controlled mode) */
    onOpenChange?: (isOpen: boolean) => void;

    /** ARIA label для компонента */
    ariaLabel?: string;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

// Бизнес-пропсы, которые не должны попадать в DOM
// style исключается из domProps, так как комбинируется policy-слоем
// ariaLabel трансформируется в aria-label, не должен протекать в Core
// languages, selectedLanguageCode, isOpen указываются явно в JSX
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'telemetryEnabled',
  'visible',
  'style',
  'onLanguageSelect',
  'ariaLabel',
  'onToggle',
  'onClose',
  'languages',
  'selectedLanguageCode',
  'isOpen',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * =========================================================================== */

type LanguageSelectorPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * LanguageSelectorPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - disabled state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useLanguageSelectorPolicy(
  props: AppLanguageSelectorProps,
): LanguageSelectorPolicy {
  return useMemo(() => {
    const hiddenByFeatureFlag = props.isHiddenByFeatureFlag === true;
    const disabledByFeatureFlag = props.isDisabledByFeatureFlag === true;
    const telemetryEnabled = props.telemetryEnabled !== false;

    const isRendered = !hiddenByFeatureFlag && props.visible !== false;

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      isRendered,
      telemetryEnabled,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.visible,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * =========================================================================== */

function emitLanguageSelectorTelemetry(
  payload: LanguageSelectorTelemetryPayload,
): void {
  infoFireAndForget(`LanguageSelector ${payload.action}`, payload);
}

/**
 * Формирование payload для LanguageSelector telemetry.
 */
function getLanguageSelectorPayload(
  action: LanguageSelectorTelemetryAction,
  policy: LanguageSelectorPolicy,
  telemetryProps: {
    size?: LanguageSelectorSize;
    variant?: LanguageSelectorVariant;
    selectedLanguageCode: string;
    availableLanguagesCount: number;
    showFlags: boolean;
    showCodes: boolean;
    locale: string;
  },
): LanguageSelectorTelemetryPayload {
  return {
    component: 'LanguageSelector',
    action,
    timestamp: Date.now(),
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    disabled: policy.disabledByFeatureFlag,
    ...(telemetryProps.size !== undefined && { size: telemetryProps.size }),
    ...(telemetryProps.variant !== undefined && { variant: telemetryProps.variant }),
    selectedLanguageCode: telemetryProps.selectedLanguageCode,
    availableLanguagesCount: telemetryProps.availableLanguagesCount,
    showFlags: telemetryProps.showFlags,
    showCodes: telemetryProps.showCodes,
    locale: telemetryProps.locale,
  };
}

/**
 * Извлекает telemetry props из данных компонента.
 * Чистая функция без знания App props целиком.
 */
function extractLanguageSelectorTelemetryProps(
  props: {
    size?: LanguageSelectorSize;
    variant?: LanguageSelectorVariant;
    selectedLanguageCode: string;
    languages: readonly LanguageData[];
    showFlags?: boolean;
    showCodes?: boolean;
    locale: string;
  },
): {
  size?: LanguageSelectorSize;
  variant?: LanguageSelectorVariant;
  selectedLanguageCode: string;
  availableLanguagesCount: number;
  showFlags: boolean;
  showCodes: boolean;
  locale: string;
} {
  return {
    ...(props.size !== undefined && { size: props.size }),
    ...(props.variant !== undefined && { variant: props.variant }),
    selectedLanguageCode: props.selectedLanguageCode,
    availableLanguagesCount: props.languages.length,
    showFlags: props.showFlags !== false,
    showCodes: props.showCodes === true,
    locale: props.locale,
  };
}

/* ============================================================================
 * 🎯 APP LANGUAGE SELECTOR
 * =========================================================================== */

const LanguageSelectorComponent = forwardRef<LanguageSelectorElement, AppLanguageSelectorProps>(
  // eslint-disable-next-line sonarjs/cognitive-complexity
  function LanguageSelectorComponent(
    props: AppLanguageSelectorProps,
    ref: Ref<LanguageSelectorElement>,
  ): JSX.Element | null {
    // Сначала извлекаем все нужные props
    const {
      languages,
      selectedLanguageCode,
      size,
      variant,
      showFlags,
      showCodes,
      placeholder,
      disabled,
      onLanguageChange,
      isOpen: controlledIsOpen,
      onOpenChange,
      'data-testid': dataTestId,
    } = props;

    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    // ariaLabel - бизнес-проп, берем из оригинальных props
    const { ariaLabel } = props;

    // onLanguageSelect - бизнес-проп, берем из оригинальных props
    const { onLanguageSelect } = props;

    // i18n интеграция для locale в telemetry и переводов
    const { locale, translate } = useI18n();

    // Хелпер для динамических переводов языков
    const translateLanguageName = useCallback(
      (languageCode: string, defaultName: string): string => {
        try {
          // Пробуем перевести через обход строгой типизации для динамических ключей
          return (translate as (
            ns: string,
            key: string,
            params?: Record<string, unknown>,
          ) => string)(
            'common',
            `language.${languageCode}`,
            { default: defaultName },
          );
        } catch {
          // Fallback на оригинальное имя
          return defaultName;
        }
      },
      [translate],
    );

    /** Состояние открытия dropdown в App слое */
    const policy = useLanguageSelectorPolicy(props);

    /** Telemetry props */
    const telemetryProps = useMemo(
      () =>
        extractLanguageSelectorTelemetryProps({
          ...(size !== undefined && { size }),
          ...(variant !== undefined && { variant }),
          selectedLanguageCode,
          languages,
          ...(showFlags !== undefined && { showFlags }),
          ...(showCodes !== undefined && { showCodes }),
          locale,
        }),
      [
        size,
        variant,
        selectedLanguageCode,
        languages,
        showFlags,
        showCodes,
        locale,
      ],
    );

    const [internalIsOpen, setInternalIsOpen] = useState(false);

    /** Определяем режим: controlled или uncontrolled */
    const isControlled = typeof controlledIsOpen === 'boolean';
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    // Ref для стабильного сравнения isOpen (избегает false positives в controlled mode)
    const lastIsOpenRef = useRef<boolean>(isOpen);

    /** Функция для изменения состояния открытия с поддержкой controlled mode */
    const setIsOpen = useCallback((newIsOpen: boolean | ((prev: boolean) => boolean)) => {
      const nextIsOpen = typeof newIsOpen === 'function' ? newIsOpen(isOpen) : newIsOpen;

      if (isControlled) {
        onOpenChange?.(nextIsOpen);
      } else {
        setInternalIsOpen(nextIsOpen);
      }

      // Telemetry для открытия/закрытия dropdown
      if (policy.telemetryEnabled && nextIsOpen !== lastIsOpenRef.current) {
        emitLanguageSelectorTelemetry(
          getLanguageSelectorPayload(
            nextIsOpen
              ? LanguageSelectorTelemetryAction.Open
              : LanguageSelectorTelemetryAction.Close,
            policy,
            telemetryProps,
          ),
        );
      }

      // Обновляем ref для стабильного сравнения
      // eslint-disable-next-line functional/immutable-data
      lastIsOpenRef.current = nextIsOpen;
    }, [isOpen, isControlled, onOpenChange, setInternalIsOpen, policy, telemetryProps]);

    /** Переведенные имена языков для отображения */
    const translatedLanguages = useMemo(
      () =>
        languages.map((lang) => ({
          ...lang,
          name: translateLanguageName(lang.code, lang.name),
        })),
      [languages, translateLanguageName],
    );

    /** Доступные (не отключенные) языки для навигации */
    const navigableLanguages = useMemo(
      () => translatedLanguages.filter((lang) => lang.isDisabled !== true),
      [translatedLanguages],
    );

    /** Состояние активного индекса для клавиатурной навигации */
    const [activeIndex, setActiveIndex] = useState(-1);

    /** Индекс выбранного языка в списке доступных языков */
    const selectedNavigableIndex = useMemo(() => {
      if (!selectedLanguageCode) return -1;
      const selectedLanguage = translatedLanguages.find((lang) =>
        lang.code === selectedLanguageCode
      );
      if (!selectedLanguage || selectedLanguage.isDisabled === true) return -1;
      return navigableLanguages.findIndex((lang) => lang.code === selectedLanguage.code);
    }, [translatedLanguages, selectedLanguageCode, navigableLanguages]);

    // Props для передачи в Core компонент (уже отфильтрованы от бизнес-пропсов)
    const filteredCoreProps = domProps;

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    // Это архитектурная гарантия для детерминированности
    type LifecyclePayload = Readonly<{
      mount: LanguageSelectorTelemetryPayload;
      unmount: LanguageSelectorTelemetryPayload;
    }>;

    const lifecyclePayloadRef = useRef<LifecyclePayload | null>(null);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getLanguageSelectorPayload(
        LanguageSelectorTelemetryAction.Mount,
        policy,
        telemetryProps,
      ),
      unmount: getLanguageSelectorPayload(
        LanguageSelectorTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Стабильные ссылки на payload для useEffect dependencies (immutable by contract)
    const mountPayload = lifecyclePayload.mount;
    const unmountPayload = lifecyclePayload.unmount;

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitLanguageSelectorTelemetry(mountPayload);
      return (): void => {
        emitLanguageSelectorTelemetry(unmountPayload);
      };
    }, [policy.telemetryEnabled, mountPayload, unmountPayload]);

    // Объединяем стили для disabled состояния
    const combinedDisabled = useMemo<boolean>(
      () => disabled === true || policy.disabledByFeatureFlag,
      [disabled, policy.disabledByFeatureFlag],
    );

    // Отправка telemetry для выбора языка
    const emitLanguageChangeTelemetry = useCallback(() => {
      if (policy.telemetryEnabled) {
        emitLanguageSelectorTelemetry(
          getLanguageSelectorPayload(
            LanguageSelectorTelemetryAction.Change,
            policy,
            telemetryProps,
          ),
        );
      }
    }, [policy, telemetryProps]);

    // Обработчик выбора языка с App-level логикой
    const handleLanguageChange = useCallback(
      (languageCode: string) => {
        emitLanguageChangeTelemetry();

        // Найти выбранный язык для callback
        const selectedLanguage = languages.find((lang) => lang.code === languageCode);
        if (selectedLanguage) {
          onLanguageSelect?.(selectedLanguage);
        }

        onLanguageChange?.(languageCode);
        setIsOpen(false); // Закрываем dropdown после выбора
      },
      [emitLanguageChangeTelemetry, languages, onLanguageSelect, onLanguageChange, setIsOpen],
    );

    // Обработчик переключения состояния открытия
    const handleToggle = useCallback((): void => {
      setIsOpen((prev) => !prev);
    }, [setIsOpen]);

    // Обработчик закрытия dropdown
    const handleClose = useCallback((): void => {
      setIsOpen(false);
    }, [setIsOpen]);

    // Вспомогательные функции для клавиатурной навигации
    const navigateToIndex = useCallback((index: number) => {
      if (navigableLanguages.length === 0) return;
      const clampedIndex = Math.max(0, Math.min(index, navigableLanguages.length - 1));
      setActiveIndex(clampedIndex);
    }, [navigableLanguages.length]);

    const navigateNext = useCallback(() => {
      navigateToIndex(activeIndex + 1);
    }, [activeIndex, navigateToIndex]);

    const navigatePrev = useCallback(() => {
      navigateToIndex(activeIndex - 1);
    }, [activeIndex, navigateToIndex]);

    const navigateFirst = useCallback(() => {
      navigateToIndex(0);
    }, [navigateToIndex]);

    const navigateLast = useCallback(() => {
      navigateToIndex(navigableLanguages.length - 1);
    }, [navigateToIndex, navigableLanguages.length]);

    const selectActiveLanguage = useCallback(() => {
      if (activeIndex >= 0 && activeIndex < navigableLanguages.length) {
        const language = navigableLanguages[activeIndex];
        if (language) {
          handleLanguageChange(language.code);
        }
      }
    }, [activeIndex, navigableLanguages, handleLanguageChange]);

    const openDropdownIfNeeded = useCallback(() => {
      if (!isOpen) {
        setIsOpen(true);
      }
    }, [isOpen, setIsOpen]);

    // Инициализация активного индекса при открытии дропдауна
    useEffect(() => {
      if (isOpen) {
        // При открытии устанавливаем активный индекс на выбранный язык (если есть доступные языки)
        if (navigableLanguages.length > 0) {
          setActiveIndex(selectedNavigableIndex >= 0 ? selectedNavigableIndex : 0);
        }
      } else {
        // При закрытии сбрасываем активный индекс
        setActiveIndex(-1);
      }
    }, [isOpen, selectedNavigableIndex, navigableLanguages.length]);

    // Вспомогательная функция для обработки клавиш
    // eslint-disable-next-line sonarjs/cognitive-complexity
    const processKey = useCallback((key: NavigationKey, event: KeyboardEvent) => {
      switch (key) {
        case 'Escape':
          if (Boolean(isOpen)) {
            event.preventDefault();
            handleClose();
          }
          return;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen && activeIndex >= 0) {
            selectActiveLanguage();
          } else {
            handleToggle();
          }
          return;

        case 'ArrowDown':
          event.preventDefault();
          if (Boolean(isOpen)) {
            navigateNext();
          } else {
            openDropdownIfNeeded();
          }
          return;

        case 'ArrowUp':
          event.preventDefault();
          if (Boolean(isOpen)) {
            navigatePrev();
          } else {
            openDropdownIfNeeded();
          }
          return;

        case 'Home':
          if (Boolean(isOpen)) {
            event.preventDefault();
            navigateFirst();
          }
          return;

        case 'End':
          if (Boolean(isOpen)) {
            event.preventDefault();
            navigateLast();
          }
          break;
      }
    }, [
      isOpen,
      activeIndex,
      handleClose,
      selectActiveLanguage,
      handleToggle,
      navigateNext,
      navigatePrev,
      navigateFirst,
      navigateLast,
      openDropdownIfNeeded,
    ]);

    // Обработчик клавиатуры для навигации (App-слой управляет навигацией)
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
      const key = event.key as NavigationKey;
      if (['Escape', 'Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
        processKey(key, event);
      }
    }, [processKey]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreLanguageSelector
        ref={ref}
        languages={translatedLanguages}
        selectedLanguageCode={selectedLanguageCode}
        isOpen={isOpen}
        onToggle={handleToggle}
        onClose={handleClose}
        onKeyDown={handleKeyDown}
        role='listbox'
        aria-expanded={isOpen}
        aria-activedescendant={isOpen
            && activeIndex >= 0
            && activeIndex < navigableLanguages.length
            && dataTestId != null
            && dataTestId !== ''
          ? `${dataTestId}-option-${navigableLanguages[activeIndex]?.code}`
          : undefined}
        navigatedLanguageCode={isOpen && activeIndex >= 0 && activeIndex < navigableLanguages.length
          ? navigableLanguages[activeIndex]?.code
          : undefined}
        {...(size !== undefined && { size })}
        {...(variant !== undefined && { variant })}
        {...(showFlags !== undefined && { showFlags })}
        {...(showCodes !== undefined && { showCodes })}
        {...(placeholder !== undefined && { placeholder })}
        disabled={combinedDisabled}
        onLanguageChange={handleLanguageChange}
        data-component='AppLanguageSelector'
        data-state={policy.disabledByFeatureFlag ? 'disabled' : 'active'}
        data-disabled={combinedDisabled || undefined}
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(ariaLabel != null && ariaLabel !== '' && { 'aria-label': ariaLabel })}
        {...(dataTestId != null && dataTestId !== '' && { 'data-testid': dataTestId })}
        {...filteredCoreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
LanguageSelectorComponent.displayName = 'LanguageSelector';

/**
 * UI-контракт LanguageSelector компонента.
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
 * - Telemetry payload содержит корректную информацию о состоянии селектора языков
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - Change telemetry отправляется при каждом выборе языка
 * - Disabled состояние применяется через disabled prop
 *
 * Не допускается:
 * - Использование напрямую core LanguageSelector компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <LanguageSelector
 *   languages={[
 *     { code: 'en', name: 'English', flag: <UKFlag /> },
 *     { code: 'ru', name: 'Русский', flag: <RUFlag />, isActive: true },
 *     { code: 'es', name: 'Español', flag: <ESFlag /> }
 *   ]}
 *   selectedLanguageCode="ru"
 *   onLanguageSelect={(language) => setCurrentLanguage(language.code)}
 * />
 *
 * // С feature flags и telemetry
 * <LanguageSelector
 *   languages={availableLanguages}
 *   selectedLanguageCode={currentLanguageCode}
 *   visible={isLanguageSelectorVisible}
 *   isHiddenByFeatureFlag={!featureFlags.languageSelectorEnabled}
 *   isDisabledByFeatureFlag={isUserBlocked}
 *   telemetryEnabled={true}
 *   size="small"
 *   variant="compact"
 *   showCodes={true}
 *   onLanguageSelect={handleLanguageChange}
 * />
 *
 * // Минимальный вариант
 * <LanguageSelector
 *   languages={languages}
 *   selectedLanguageCode={currentLanguage}
 *   variant="minimal"
 *   showFlags={false}
 * />
 * ```
 */
export const LanguageSelector = memo(LanguageSelectorComponent);
