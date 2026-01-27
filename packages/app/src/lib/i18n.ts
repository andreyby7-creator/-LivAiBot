/**
 * @file packages/app/src/lib/i18n.ts
 * ============================================================================
 * 🌐 ЯДРО I18N — НАДЁЖНЫЕ УТИЛИТЫ ЛОКАЛИЗАЦИИ
 * ============================================================================
 *
 * Свойства:
 * - Типизированные ключи для переводов
 * - Пространства имён для модульных локалей
 * - Функциональный, иммутабельный, безопасный для SSR/SSG
 * - Fallback локаль, traceId/service для телеметрии
 * - Готов к микросервисной архитектуре
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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

// Управляемое императивное ядро внутри функциональной оболочки

class TranslationRuntimeStore {
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

  // Возвращает новый store, инициализированный базовыми переводами
  init(core: typeof coreTranslations): TranslationRuntimeStore {
    const newStore = Object.entries(core).reduce(
      (acc, [ns, translations]) => ({
        ...acc,
        [ns as Namespace]: { ...translations },
      }),
      {} as Record<Namespace, Record<string, string>>,
    );
    return new TranslationRuntimeStore(newStore);
  }

  // Получить пространство
  get(ns: Namespace): Record<string, string> {
    return this.store[ns];
  }

  // Возвращает новый store с обновлённым namespace
  set(ns: Namespace, value: Record<string, string>): TranslationRuntimeStore {
    return new TranslationRuntimeStore({
      ...this.store,
      [ns]: value,
    });
  }

  has(ns: Namespace): boolean {
    return ns in this.store;
  }
}

class LoadedNamespaces {
  readonly namespaces: readonly Namespace[];

  constructor(initial: readonly Namespace[]) {
    this.namespaces = [...initial];
  }

  has(ns: Namespace): boolean {
    return this.namespaces.includes(ns);
  }

  // Возвращает новый объект с добавленным namespace
  add(ns: Namespace): LoadedNamespaces {
    if (this.has(ns)) return this;
    return new LoadedNamespaces([...this.namespaces, ns]);
  }
}

// Контекст для функциональной передачи store - полная чистота без глобального состояния
const I18nStoreContext = createContext<TranslationRuntimeStore | null>(null);

// Хук для доступа к store - функциональный и чистый
export const useTranslations = (): TranslationRuntimeStore => {
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

// Enum для проверки ключей переводов на этапе компиляции
export enum TranslationKeys {
  // Common
  GREETING = 'greeting',
  FAREWELL = 'farewell',

  // Auth
  LOGIN = 'login',
  LOGOUT = 'logout',
  ERROR = 'error',
}

export type Namespace = keyof typeof coreTranslations;
export type TranslationKey<N extends Namespace = Namespace> = keyof typeof coreTranslations[N];

/* ============================================================================
 * 🌍 КОНТЕКСТ I18N
 * ========================================================================== */

export type I18nContextType = {
  locale: string;
  fallbackLocale: string;
  translate: <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ) => string;
  loadNamespace: (ns: Namespace) => Promise<void>;
  isNamespaceLoaded: (ns: Namespace) => boolean;
  telemetry?:
    | ((
      data: {
        key: string;
        ns: string;
        locale: string;
        traceId?: string | undefined;
        service?: string | undefined;
        fallbackType?: 'common' | 'human-readable' | 'fallback-locale';
      },
    ) => void)
    | undefined;
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{
  locale: string;
  fallbackLocale: string;
  telemetry?: I18nContextType['telemetry'];
  children: ReactNode;
}> = ({
  locale,
  fallbackLocale,
  telemetry,
  children,
}) => {
  // Локальное состояние загрузки пространств имён - безопасное для SSR
  const [loadedNamespaces, setLoadedNamespaces] = useState(() =>
    new LoadedNamespaces(['common', 'auth'])
  );

  // Создаём store через useMemo - функциональный подход без мутаций
  const store = React.useMemo(() => {
    if (locale === 'ru') {
      return new TranslationRuntimeStore().init(coreTranslations);
    }
    return new TranslationRuntimeStore();
  }, [locale]);

  // Store готов для использования через контекст

  const loadNamespace = useCallback(async (ns: Namespace): Promise<void> => {
    if (loadedNamespaces.has(ns)) {
      return; // Already loaded
    }

    try {
      // Динамический импорт пространства имён (пример реализации)
      // const module = await import(`./locales/${locale}/${ns}.json`);
      // const currentTranslations = store.get(ns);
      // const updatedStore = store.set(ns, { ...currentTranslations, ...module.default });

      // Пока что симулируем задержку загрузки
      await new Promise((resolve) => setTimeout(resolve, 100));
      setLoadedNamespaces((current) => current.add(ns));
    } catch (error) {
      throw error;
    }
  }, [loadedNamespaces]);

  const isNamespaceLoaded = useCallback((ns: Namespace): boolean => {
    return loadedNamespaces.has(ns);
  }, [loadedNamespaces]);

  // Хелпер для поиска перевода с полной цепочкой fallback
  const findTranslation = React.useCallback((
    ns: Namespace,
    key: string,
  ): {
    result: string;
    usedFallback: boolean;
    fallbackType?: 'common' | 'human-readable' | 'fallback-locale';
  } => {
    // Сначала пробуем основную локаль (пока поддерживаем только 'ru')
    if (locale === 'ru') {
      const primaryTranslations = store.get(ns);
      if (key in primaryTranslations) {
        return { result: String(primaryTranslations[key]), usedFallback: false };
      }
    }

    // Пробуем fallback локаль если отличается
    // TODO: fallback-locale storage пока не реализован - требуется отдельное хранилище для каждой локали
    // Пока что fallback локаль не влияет на поиск переводов

    // Пробуем пространство имён common
    const commonTranslations = store.get('common');
    if (key in commonTranslations) {
      return {
        result: String(commonTranslations[key]),
        usedFallback: true,
        fallbackType: 'common',
      };
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
  }, [locale, store]);

  const translate = useMemo(() => {
    return <N extends Namespace>(
      ns: N,
      key: TranslationKey<N>,
      params?: Record<string, string | number>,
    ): string => {
      const { result, usedFallback, fallbackType } = findTranslation(ns, String(key));

      // Интерполируем параметры
      let finalResult = result;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          finalResult = finalResult.replace(new RegExp(`{${k}}`, 'g'), String(v));
        }
      }

      // Отправляем телеметрию только для случаев fallback чтобы избежать спама
      if (usedFallback && telemetry) {
        const telemetryData: Parameters<NonNullable<typeof telemetry>>[0] = {
          key: String(key),
          ns: String(ns),
          locale,
          traceId: undefined,
          service: undefined,
          ...(fallbackType && { fallbackType }),
        };

        telemetry(telemetryData);
      }

      return finalResult;
    };
  }, [locale, telemetry, findTranslation]);

  return React.createElement(
    I18nStoreContext.Provider,
    { value: store },
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
    loadNamespace(ns).catch(() => {
      // TODO: Добавить обработку ошибок загрузки переводов
    });
  }, [ns, loadNamespace]);
};

/** Хелпер для быстрой SSR/Static генерации */
export const createI18nInstance = (options: {
  locale: string;
  fallbackLocale: string;
  telemetry?: I18nContextType['telemetry'];
}): I18nContextType => {
  const { locale, fallbackLocale, telemetry } = options;

  // Локальное состояние загрузки пространств имён - безопасное для SSR
  let loadedNamespaces = new LoadedNamespaces(['common', 'auth']);
  let store = new TranslationRuntimeStore().init(coreTranslations);

  // Хелпер для поиска перевода с полной цепочкой fallback
  const findTranslation = (
    ns: Namespace,
    key: string,
  ): {
    result: string;
    usedFallback: boolean;
    fallbackType?: 'common' | 'human-readable' | 'fallback-locale';
  } => {
    // Сначала пробуем основную локаль (пока поддерживаем только 'ru')
    if (locale === 'ru') {
      const primaryTranslations = store.get(ns);
      if (key in primaryTranslations) {
        return { result: String(primaryTranslations[key]), usedFallback: false };
      }
    }

    // Пробуем fallback локаль если отличается
    // TODO: fallback-locale storage пока не реализован - требуется отдельное хранилище для каждой локали
    // Пока что fallback локаль не влияет на поиск переводов

    // Пробуем пространство имён common
    const commonTranslations = store.get('common');
    if (key in commonTranslations) {
      return {
        result: String(commonTranslations[key]),
        usedFallback: true,
        fallbackType: 'common',
      };
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
  };

  const translate = <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ): string => {
    const { result, usedFallback, fallbackType } = findTranslation(ns, String(key));

    // Интерполируем параметры
    let finalResult = result;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        finalResult = finalResult.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }

    // Отправляем телеметрию только для случаев fallback чтобы избежать спама
    if (usedFallback && telemetry) {
      const telemetryData: Parameters<NonNullable<typeof telemetry>>[0] = {
        key: String(key),
        ns: String(ns),
        locale,
        traceId: undefined,
        service: undefined,
        ...(fallbackType && { fallbackType }),
      };

      telemetry(telemetryData);
    }

    return finalResult;
  };

  const loadNamespace = async (ns: Namespace): Promise<void> => {
    if (loadedNamespaces.has(ns)) {
      return; // Already loaded
    }

    try {
      // Динамический импорт пространства имён (реализация для продакшн)
      // esbuild не может статически разрешить шаблонные динамические импорты
      // Используем переменную для обхода статического анализа esbuild
      const localePath = `./locales/${locale}/${ns}.json`;

      // Типизируем результат динамического импорта
      type LocaleModule = {
        default: Record<string, string>;
      };

      // Динамический импорт будет разрешен только в runtime
      // Используем явное приведение типа для безопасности
      const module = await import(localePath) as LocaleModule;

      const currentTranslations = store.get(ns);
      store = store.set(ns, { ...currentTranslations, ...module.default });
      loadedNamespaces = loadedNamespaces.add(ns);

      // Для обратной совместимости симулируем задержку загрузки (можно убрать в продакшн)
      // await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      throw error;
    }
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
