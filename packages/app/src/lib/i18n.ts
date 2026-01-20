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

import React, { createContext, useCallback, useContext, useMemo } from 'react';
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
  private readonly store = new Map<Namespace, Record<string, string>>();

  init(core: typeof coreTranslations): void {
    Object.entries(core).forEach(([ns, translations]) => {
      this.store.set(ns as Namespace, { ...translations });
    });
  }

  get(ns: Namespace): Record<string, string> {
    return this.store.get(ns) ?? {};
  }

  set(ns: Namespace, value: Record<string, string>): void {
    this.store.set(ns, value);
  }

  has(ns: Namespace): boolean {
    return this.store.has(ns);
  }
}

class LoadedNamespaces {
  private readonly set = new Set<Namespace>();

  constructor(initial: Namespace[]) {
    initial.forEach((ns) => {
      this.set.add(ns);
    });
  }

  has(ns: Namespace): boolean {
    return this.set.has(ns);
  }

  add(ns: Namespace): void {
    this.set.add(ns);
  }
}


// Глобальный экземпляр для доступа прокси (legacy compatibility)
// NOTE: Используется только для legacy Proxy доступа. Не SSR-isolated.
// Не использовать как основной API - предпочитать локальные storeRef.
let globalRuntimeStore: TranslationRuntimeStore | null = null;

// Экспортируем для тестов - возможность сброса состояния
export const testResetGlobalRuntimeStore = (): void => {
  globalRuntimeStore = null;
};

// Публичный интерфейс - комбинирует базовые и runtime переводы (для обратной совместимости)
export const translations = new Proxy(coreTranslations, {
  get(
    target,
    prop,
  ): typeof coreTranslations[keyof typeof coreTranslations] | Record<string, string> | undefined {
    // Сначала проверяем runtime хранилище, затем fallback к базовым
    if (globalRuntimeStore?.has(prop as Namespace) === true) {
      return globalRuntimeStore.get(prop as Namespace);
    }
    return target[prop as keyof typeof target];
  },
});

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

export type Namespace = keyof typeof translations;
export type TranslationKey<N extends Namespace = Namespace> = keyof typeof translations[N];

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
  const loadedRef = React.useRef(new LoadedNamespaces(['common', 'auth']));
  const storeRef = React.useRef(new TranslationRuntimeStore());

  // Инициализируем runtime хранилище базовыми переводами только для поддерживаемых локалей
  if (locale === 'ru') {
    storeRef.current.init(coreTranslations);
    // Защищаем от перезаписи - устанавливаем только если не инициализирован
    globalRuntimeStore ??= storeRef.current;
  }

  const loadNamespace = useCallback(async (ns: Namespace): Promise<void> => {
    if (loadedRef.current.has(ns)) {
      return; // Already loaded
    }

    try {
      // Динамический импорт пространства имён (пример реализации)
      // const module = await import(`./locales/${locale}/${ns}.json`);
      // const currentTranslations = storeRef.current.get(ns);
      // storeRef.current.set(ns, { ...currentTranslations, ...module.default });

      // Пока что симулируем задержку загрузки
      await new Promise((resolve) => setTimeout(resolve, 100));
      loadedRef.current.add(ns);
    } catch (error) {
      throw error;
    }
  }, []);

  const isNamespaceLoaded = useCallback((ns: Namespace): boolean => {
    return loadedRef.current.has(ns);
  }, []);

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
      const primaryTranslations = storeRef.current.get(ns);
      if (key in primaryTranslations) {
        return { result: String(primaryTranslations[key]), usedFallback: false };
      }
    }

    // Пробуем fallback локаль если отличается
    // TODO: fallback-locale storage пока не реализован - требуется отдельное хранилище для каждой локали
    // Пока что fallback локаль не влияет на поиск переводов

    // Пробуем пространство имён common
    const commonTranslations = storeRef.current.get('common');
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
  }, [locale]);

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
    I18nContext.Provider,
    { value: { locale, fallbackLocale, translate, loadNamespace, isNamespaceLoaded, telemetry } },
    children,
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
  const loadedNamespaces = new LoadedNamespaces(['common', 'auth']);
  const localStore = new TranslationRuntimeStore();

  // Инициализируем базовыми переводами
  localStore.init(coreTranslations);

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
      const primaryTranslations = localStore.get(ns);
      if (key in primaryTranslations) {
        return { result: String(primaryTranslations[key]), usedFallback: false };
      }
    }

    // Пробуем fallback локаль если отличается
    // TODO: fallback-locale storage пока не реализован - требуется отдельное хранилище для каждой локали
    // Пока что fallback локаль не влияет на поиск переводов

    // Пробуем пространство имён common
    const commonTranslations = localStore.get('common');
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
      // Динамический импорт пространства имён (пример реализации)
      // const module = await import(`./locales/${locale}/${ns}.json`);
      // const currentTranslations = localStore.get(ns);
      // localStore.set(ns, { ...currentTranslations, ...module.default });

      // Пока что симулируем задержку загрузки
      await new Promise((resolve) => setTimeout(resolve, 100));
      loadedNamespaces.add(ns);
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
