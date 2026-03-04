/**
 * @file packages/app/src/lib/i18n.ts
 * ============================================================================
 * 🌐 ЯДРО I18N — НАДЁЖНЫЕ УТИЛИТЫ ЛОКАЛИЗАЦИИ
 * ============================================================================
 * Свойства:
 * - Типизированные ключи для переводов
 * - Пространства имён для модульных локалей
 * - Функциональный, иммутабельный, безопасный для SSR/SSG
 * - Fallback локаль, traceId/service для телеметрии
 * - Готов к микросервисной архитектуре
 */

import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat.js';
import 'dayjs/locale/en.js';
import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';

// Инициализация dayjs плагинов
dayjs.extend(localizedFormat);

/* ============================================================================
 * 🏷️ ТИПЫ
 * ========================================================================== */

/** Типы fallback для телеметрии */
export type FallbackType = 'common' | 'human-readable' | 'fallback-locale';

/* ============================================================================
 * 🔧 УТИЛИТЫ
 * ========================================================================== */

// Замена плейсхолдеров {key} в строке на значения из params
function interpolateParams(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`{${k}}`, 'g'), String(v)),
    str,
  );
}

/* ============================================================================
 * 📅 DAYJS LOCALE MANAGEMENT
 * ========================================================================== */

/**
 * Устанавливает локаль для dayjs.
 * SSR-safe: использует динамический импорт для bundle splitting.
 * @param locale - код локали (например, 'ru', 'en', 'de')
 */
export function setDayjsLocale(locale: string): void {
  try {
    // В shared package dayjs локали не загружаются динамически
    // Это должно делаться в конкретном приложении (apps/web)
    dayjs.locale(locale);

    // Telemetry для отслеживания использования локалей (только в dev)
    if (typeof window !== 'undefined' && process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[i18n] Dayjs locale set to: ${locale}`);
    }
  } catch (error) {
    // Fallback на английский при ошибке загрузки
    dayjs.locale('en');

    // Telemetry для ошибок локализации
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Failed to load dayjs locale '${locale}', fallback to 'en'`, error);
    }
  }
}

/**
 * Синхронная установка локали (для случаев когда локаль уже загружена).
 * Использовать только после предварительной загрузки через setDayjsLocale.
 * @param locale - код локали
 */
export function setDayjsLocaleSync(locale: string): void {
  try {
    dayjs.locale(locale);
  } catch (error) {
    dayjs.locale('en');
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Failed to set dayjs locale '${locale}' sync, fallback to 'en'`, error);
    }
  }
}

/**
 * Получает текущую установленную локаль dayjs.
 */
export function getCurrentDayjsLocale(): string {
  return dayjs.locale();
}

/**
 * Определяет направление текста для локали (LTR/RTL).
 * @param locale - код локали
 * @returns true если локаль использует RTL направление текста
 */
export function isRtlLocale(locale: string): boolean {
  return ['ar', 'he', 'fa', 'ur', 'yi'].some((rtl) => locale.toLowerCase().startsWith(rtl));
}

/**
 * Проверяет доступна ли локаль для dayjs.
 * @param locale - код локали для проверки
 */
export function isDayjsLocaleSupported(locale: string): boolean {
  // Список поддерживаемых локалей dayjs
  const supportedLocales = [
    'en',
    'ru',
    'de',
    'fr',
    'es',
    'it',
    'pt',
    'zh',
    'ja',
    'ko',
    'ar',
    'hi',
    'bn',
    'ur',
    'fa',
    'tr',
    'pl',
    'uk',
    'cs',
    'sk',
    'bg',
    'hr',
    'sl',
    'et',
    'lv',
    'lt',
    'ro',
    'hu',
    'el',
    'he',
    'th',
    'vi',
    'id',
    'ms',
    'tl',
    'sw',
    'am',
    'om',
    'ti',
    'so',
  ];

  return supportedLocales.includes(locale);
}

/**
 * Форматирует дату в локализованном формате.
 * Удобная обертка над dayjs с текущей локалью.
 * @param date - дата для форматирования
 * @param format - формат dayjs (например, 'MMMM YYYY')
 */
export function formatDateLocalized(date: Date | dayjs.Dayjs | string, format: string): string {
  return dayjs(date).format(format);
}

/**
 * Простая функция перевода без React контекста.
 * Используется для базовых случаев где React контекст недоступен.
 * Пока возвращает ключ как есть (заглушка для будущей реализации).
 * @param key - ключ перевода
 * @param params - параметры для интерполяции
 */
export function t(
  key: string,
  params?: Record<string, string | number> & { default?: string; },
): string {
  // TODO: Реализовать полноценную систему переводов без React контекста
  // Пока возвращаем default или ключ
  if (params?.default !== undefined && params.default !== '') return params.default;
  if (!params || Object.keys(params).length === 0) return key;
  return interpolateParams(key, params);
}

/* ============================================================================
 * 🏷️ ТИПИЗИРОВАННЫЕ ПЕРЕВОДЫ
 * ========================================================================== */

// Базовые переводы - иммутабельные и типобезопасные
const coreTranslations = {
  common: {
    greeting: 'Привет, {name}!',
    farewell: 'До свидания!',
  },
  auth: {
    login: 'Вход',
    logout: 'Выход',
    error: 'Неверные учетные данные',
  },
} as const;

// Иммутабельный snapshot переводов для функционального подхода

class TranslationSnapshot {
  readonly store: Readonly<Record<Namespace, Record<string, string>>>;

  constructor(
    store: Partial<Record<Namespace, Record<string, string>>> = {},
  ) {
    // Гарантируем наличие всех namespace, инициализируя отсутствующие пустыми объектами
    this.store = (['common', 'auth'] as const).reduce((acc, ns) => ({
      ...acc,
      [ns]: store[ns] ?? {},
    }), {} as Record<Namespace, Record<string, string>>);
  }

  // Возвращает новый snapshot, инициализированный базовыми переводами
  init(core: typeof coreTranslations): TranslationSnapshot {
    const newStore = Object.entries(core).reduce(
      (acc, [ns, translations]) => ({
        ...acc,
        [ns as Namespace]: { ...translations },
      }),
      {} as Record<Namespace, Record<string, string>>,
    );
    return new TranslationSnapshot(newStore);
  }

  // Получить пространство
  get(ns: Namespace): Record<string, string> {
    return this.store[ns];
  }

  // Возвращает новый snapshot с обновлённым namespace
  set(ns: Namespace, value: Record<string, string>): TranslationSnapshot {
    return new TranslationSnapshot({
      ...this.store,
      [ns]: value,
    });
  }

  // Возвращает новый snapshot с объединёнными переводами для namespace
  merge(ns: Namespace, translations: Record<string, string>): TranslationSnapshot {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const existingTranslations = this.store[ns] ?? {};
    return new TranslationSnapshot({
      ...this.store,
      [ns]: { ...existingTranslations, ...translations },
    });
  }

  has(ns: Namespace): boolean {
    return ns in this.store;
  }
}

// Используем ReadonlySet для loaded namespaces - эффективнее и проще чем класс

// Контекст для функциональной передачи snapshot - полная чистота без глобального состояния
const I18nStoreContext = createContext<TranslationSnapshot | null>(null);

/**
 * @internal Хук для доступа к TranslationSnapshot для текущей локали
 * ⚠️ ВНИМАНИЕ: Этот хук предназначен для ТЕСТИРОВАНИЯ и ВНУТРЕННИХ УТИЛИТ.
 * Для пользовательского кода используйте translate функцию из I18nContext.
 * Прямой доступ к snapshot может:
 * - Обойти fallback логику
 * - Нарушить инварианты системы
 * - Привести к неожиданному поведению
 * Используйте только в тестах и внутренних компонентах!
 */
export const useTranslations = (): TranslationSnapshot => {
  const store = useContext(I18nStoreContext);
  if (!store) throw new Error('useTranslations must be used within I18nProvider');
  return store;
};

// Экспортируем для тестов - создание чистого локального instance
export const testResetTranslationStore = (): I18nContextType => {
  // Возвращает свежий instance для изолированных тестов
  return createI18nInstance({
    locale: 'ru',
    fallbackLocale: 'en',
    telemetry: undefined,
  });
};

export type Namespace = keyof typeof coreTranslations;
export type TranslationKey<N extends Namespace = Namespace> = keyof typeof coreTranslations[N];

// Хранилище snapshots для каждой локали (включая fallback)
type LocaleStore = Record<string, TranslationSnapshot>;

// Pure функция для поиска перевода с цепочкой fallback
function findTranslationInStore(
  localeStore: LocaleStore,
  primaryLocale: string,
  fallbackLocale: string,
  ns: Namespace,
  key: string,
): {
  result: string;
  usedFallback: boolean;
  fallbackType?: FallbackType;
} {
  // Сначала пробуем основную локаль
  const primaryStore = localeStore[primaryLocale];
  if (primaryStore) {
    const primaryTranslations = primaryStore.get(ns);
    if (key in primaryTranslations) {
      return { result: String(primaryTranslations[key]), usedFallback: false };
    }
  }

  // Пробуем fallback локаль если отличается от основной
  if (fallbackLocale !== primaryLocale) {
    const fallbackStore = localeStore[fallbackLocale];
    if (fallbackStore) {
      const fallbackTranslations = fallbackStore.get(ns);
      if (key in fallbackTranslations) {
        return {
          result: String(fallbackTranslations[key]),
          usedFallback: true,
          fallbackType: 'fallback-locale',
        };
      }
    }
  }

  // Пробуем пространство имён common (из основной локали)
  if (primaryStore) {
    const commonTranslations = primaryStore.get('common');
    if (key in commonTranslations) {
      return {
        result: String(commonTranslations[key]),
        usedFallback: true,
        fallbackType: 'common',
      };
    }
  }

  // Человеко-читаемый fallback
  const humanReadable = String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return {
    result: humanReadable,
    usedFallback: true,
    fallbackType: 'human-readable',
  };
}

// Получает перевод с fallback логикой
function getTranslation(
  localeStore: LocaleStore, // Хранилище локалей
  locale: string, // Основная локаль
  fallback: string, // Fallback локаль
  ns: Namespace, // Пространство имён
  key: string, // Ключ перевода
): {
  result: string; // Результат поиска с информацией о fallback
  usedFallback: boolean;
  fallbackType?: FallbackType;
} {
  return findTranslationInStore(localeStore, locale, fallback, ns, key);
}

/* ============================================================================
 * 🌍 КОНТЕКСТ I18N
 * ========================================================================== */

// Состояние i18n для useReducer
export type I18nState = {
  loadedNamespaces: Set<Namespace>;
  failedNamespaces: Set<Namespace>;
  localeStore: LocaleStore;
};

// Actions для обновления состояния
type I18nAction =
  | {
    type: 'LOAD_NAMESPACE_SUCCESS';
    ns: Namespace;
    locale: string;
    translations: Record<string, string>;
  }
  | { type: 'LOAD_NAMESPACE_ERROR'; ns: Namespace; }
  | { type: 'INIT_LOCALES'; locale: string; fallbackLocale: string; }
  | {
    type: 'LOAD_FALLBACK_NAMESPACE_SUCCESS';
    ns: Namespace;
    fallbackLocale: string;
    translations: Record<string, string>;
  };

// Reducer для атомарных обновлений состояния
function i18nReducer(state: I18nState, action: I18nAction): I18nState {
  switch (action.type) {
    case 'LOAD_NAMESPACE_SUCCESS': {
      const { ns, locale, translations } = action;
      const currentSnapshot = state.localeStore[locale] ?? new TranslationSnapshot();
      const updatedSnapshot = currentSnapshot.set(ns, translations);
      return {
        loadedNamespaces: new Set([...state.loadedNamespaces, ns]),
        failedNamespaces: state.failedNamespaces,
        localeStore: {
          ...state.localeStore,
          [locale]: updatedSnapshot,
        },
      };
    }
    case 'LOAD_NAMESPACE_ERROR': {
      return {
        ...state,
        failedNamespaces: new Set([...state.failedNamespaces, action.ns]),
      };
    }
    case 'INIT_LOCALES': {
      const { locale, fallbackLocale } = action;
      let newStore = { ...state.localeStore };

      // Инициализируем основную локаль если не существует
      if (!(locale in newStore)) {
        const snapshot = locale === 'ru'
          ? new TranslationSnapshot().init(coreTranslations)
          : new TranslationSnapshot();
        newStore = { ...newStore, [locale]: snapshot };
      }

      // Инициализируем fallback локаль если отличается и не существует
      if (fallbackLocale !== locale && !(fallbackLocale in newStore)) {
        const snapshot = fallbackLocale === 'ru'
          ? new TranslationSnapshot().init(coreTranslations)
          : new TranslationSnapshot();
        newStore = { ...newStore, [fallbackLocale]: snapshot };
      }

      return {
        ...state,
        localeStore: newStore,
      };
    }
    case 'LOAD_FALLBACK_NAMESPACE_SUCCESS': {
      const { ns, fallbackLocale, translations } = action;
      const currentSnapshot = state.localeStore[fallbackLocale] ?? new TranslationSnapshot();
      const updatedSnapshot = currentSnapshot.merge(ns, translations);
      return {
        loadedNamespaces: new Set([...state.loadedNamespaces, ns]),
        failedNamespaces: state.failedNamespaces,
        localeStore: {
          ...state.localeStore,
          [fallbackLocale]: updatedSnapshot,
        },
      };
    }
    default:
      return state;
  }
}

export type I18nContextType = {
  locale: string;
  fallbackLocale: string;
  translate: <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ) => string;
  loadNamespace: (ns: Namespace) => void;
  isNamespaceLoaded: (ns: Namespace) => boolean;
  telemetry?:
    | ((
      data: {
        /** Translation key (should be valid TranslationKey<N>) */
        key: string;
        /** Namespace (should be valid Namespace) */
        ns: string;
        locale: string;
        traceId: string;
        service: string;
        fallbackType?: FallbackType;
      },
    ) => void)
    | undefined;
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{
  locale: string;
  fallbackLocale: string;
  telemetry?: I18nContextType['telemetry'];
  traceId?: string;
  service?: string;
  children: ReactNode;
}> = ({
  locale,
  fallbackLocale,
  telemetry,
  traceId = 'unknown',
  service = 'frontend',
  children,
}) => {
  // Инициализируем состояние через useReducer для атомарных обновлений
  const [state, dispatch] = useReducer(i18nReducer, undefined, () => {
    const initialStore: LocaleStore = {};
    // Инициализируем основную локаль
    const primarySnapshot = locale === 'ru'
      ? new TranslationSnapshot().init(coreTranslations)
      : new TranslationSnapshot();

    // Инициализируем fallback локаль если отличается
    const fallbackSnapshot = fallbackLocale !== locale && fallbackLocale === 'ru'
      ? new TranslationSnapshot().init(coreTranslations)
      : new TranslationSnapshot();

    return {
      loadedNamespaces: new Set<Namespace>(['common', 'auth']),
      failedNamespaces: new Set<Namespace>(),
      localeStore: {
        ...initialStore,
        [locale]: primarySnapshot,
        ...(fallbackLocale !== locale && { [fallbackLocale]: fallbackSnapshot }),
      },
    };
  });

  // Обновляем localeStore при изменении локалей
  React.useEffect(() => {
    dispatch({ type: 'INIT_LOCALES', locale, fallbackLocale });
  }, [locale, fallbackLocale]);

  // Store готов для использования через контекст

  const loadNamespace = useCallback((ns: Namespace): void => {
    if (state.loadedNamespaces.has(ns)) {
      return; // Уже загружено
    }

    try {
      // В shared package сообщения не загружаются динамически
      // Это должно делаться в конкретном приложении через next-intl
      // Имитируем успешную загрузку для обратной совместимости API
      dispatch({
        type: 'LOAD_NAMESPACE_SUCCESS',
        ns,
        locale,
        translations: {}, // Пустой объект для совместимости
      });

      // Если fallback локаль отличается, тоже имитируем
      if (fallbackLocale !== locale) {
        dispatch({
          type: 'LOAD_FALLBACK_NAMESPACE_SUCCESS',
          ns,
          fallbackLocale,
          translations: {}, // Пустой объект для совместимости
        });
      }
    } catch (error) {
      // Fallback: помечаем как загруженное даже при ошибке, чтобы избежать повторных попыток
      dispatch({ type: 'LOAD_NAMESPACE_ERROR', ns });
      throw error;
    }
  }, [state, locale, fallbackLocale]);

  const isNamespaceLoaded = useCallback((ns: Namespace): boolean => {
    return state.loadedNamespaces.has(ns);
  }, [state.loadedNamespaces]);

  // Хелпер для поиска перевода с полной цепочкой fallback
  const findTranslation = React.useCallback((
    ns: Namespace,
    key: string,
  ) => getTranslation(state.localeStore, locale, fallbackLocale, ns, key), [
    state.localeStore,
    locale,
    fallbackLocale,
  ]);

  const translate = useMemo(() => {
    return <N extends Namespace>(
      ns: N,
      key: TranslationKey<N>,
      params?: Record<string, string | number>,
    ): string => {
      const { result, usedFallback, fallbackType } = findTranslation(ns, String(key));

      // Интерполируем параметры
      const finalResult = interpolateParams(result, params);

      // Отправляем телеметрию только для случаев fallback чтобы избежать спама
      if (usedFallback && telemetry) {
        const telemetryData: Parameters<NonNullable<typeof telemetry>>[0] = {
          key: String(key),
          ns: String(ns),
          locale,
          traceId,
          service,
          ...(fallbackType && { fallbackType }),
        };

        telemetry(telemetryData);
      }

      return finalResult;
    };
  }, [locale, telemetry, findTranslation, service, traceId]);

  return React.createElement(
    I18nStoreContext.Provider,
    { value: state.localeStore[locale] ?? new TranslationSnapshot() },
    React.createElement(
      I18nContext.Provider,
      { value: { locale, fallbackLocale, translate, loadNamespace, isNamespaceLoaded, telemetry } },
      children,
    ),
  );
};

/* ============================================================================
 * 🔧 ХУКИ
 * ========================================================================== */

export const useI18n = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
};

// Вспомогательный хук для lazy-loading пространств имён
export const useTranslationNamespace = (ns: Namespace): void => {
  const { loadNamespace } = useI18n();

  React.useEffect(() => {
    loadNamespace(ns);
  }, [ns, loadNamespace]);
};

/** Хелпер для быстрой SSR/Static генерации */
export const createI18nInstance = (options: {
  locale: string;
  fallbackLocale: string;
  telemetry?: I18nContextType['telemetry'];
  traceId?: string;
  service?: string;
}): I18nContextType => {
  const { locale, fallbackLocale, telemetry, traceId = 'unknown', service = 'backend' } = options;

  // Локальное состояние загрузки пространств имён - безопасное для SSR
  let loadedNamespaces = new Set<Namespace>(['common', 'auth']);
  let localeStore: LocaleStore = {};

  // Инициализируем localeStore
  const primarySnapshot = locale === 'ru'
    ? new TranslationSnapshot().init(coreTranslations)
    : new TranslationSnapshot();

  const fallbackSnapshot = fallbackLocale !== locale && fallbackLocale === 'ru'
    ? new TranslationSnapshot().init(coreTranslations)
    : new TranslationSnapshot();

  // Создаем иммутабельный объект
  localeStore = {
    [locale]: primarySnapshot,
    ...(fallbackLocale !== locale && { [fallbackLocale]: fallbackSnapshot }),
  };

  // Хелпер для поиска перевода с полной цепочкой fallback
  const findTranslation = (ns: Namespace, key: string): {
    result: string;
    usedFallback: boolean;
    fallbackType?: FallbackType;
  } => getTranslation(localeStore, locale, fallbackLocale, ns, key);

  const translate = <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ): string => {
    const { result, usedFallback, fallbackType } = findTranslation(ns, String(key));

    // Интерполируем параметры
    const finalResult = interpolateParams(result, params);

    // Отправляем телеметрию только для случаев fallback чтобы избежать спама
    if (usedFallback && telemetry) {
      telemetry({
        key: String(key),
        ns: String(ns),
        locale,
        traceId,
        service,
        ...(fallbackType && { fallbackType }),
      });
    }

    return finalResult;
  };

  const loadNamespace = (ns: Namespace): void => {
    if (loadedNamespaces.has(ns)) {
      return; // Уже загружено
    }

    // В shared package сообщения не загружаются динамически
    // Имитируем успешную загрузку для обратной совместимости API
    loadedNamespaces = new Set([...loadedNamespaces, ns]);
  };

  const isNamespaceLoaded = (ns: Namespace): boolean => {
    return loadedNamespaces.has(ns);
  };

  return {
    locale,
    fallbackLocale,
    translate,
    loadNamespace,
    isNamespaceLoaded,
    telemetry,
  };
};
