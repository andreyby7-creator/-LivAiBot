/**
 * @file packages/app/src/lib/i18n.ts
 * ============================================================================
 * 🌐 I18N ENGINE — ПРОИЗВОДСТВЕННАЯ СИСТЕМА ЛОКАЛИЗАЦИИ
 * ============================================================================
 *
 * Production-ready архитектура локализации с разделением на слои:
 * - Domain Layer: I18nEngine (locale, translations, rules, опциональный emitFallback callback)
 * - Runtime Layer: Global API (t(), initGlobalI18n)
 * - UI Layer: React Provider + hooks
 * - Date Localization: отдельная подсистема (dayjs)
 *
 * Возможности: SSR-safe, rule-based fallback, типобезопасные ключи,
 * ensureNamespace для namespaces, fallback observability (опционально).
 *
 * Подходит для: SSR/SSG, SPA, Edge runtime, backend сервисов.
 */

import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat.js';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useMemo } from 'react';

import 'dayjs/locale/en.js';

// Инициализация dayjs плагинов
dayjs.extend(localizedFormat);

/* ============================================================================
 * 🏷️ БАЗОВЫЕ ТИПЫ
 * ========================================================================== */

/** Типы fallback для телеметрии. Можно расширять при добавлении новых правил (tenant, experiment, feature-flag и т.д.) */
export type FallbackType = 'common' | 'human-readable' | 'fallback-locale';

/** Данные для телеметрии fallback. Контекст (traceId, service) должен обогащаться снаружи. */
export type FallbackTelemetry = {
  key: string;
  ns: string;
  locale: string;
  fallbackType: FallbackType;
};

/** Пространства имён переводов */
export type Namespace = 'common' | 'auth';

/** Словарь переводов */
export type Translations = Record<string, string>;

/** Параметры интерполяции */
type Params = Record<string, string | number>;

/** Хранилище локалей */
type LocaleStore = Record<string, Record<Namespace, Translations>>;

/* ============================================================================
 * 🌍 БАЗОВЫЕ ПЕРЕВОДЫ (SOURCE OF TRUTH)
 * ========================================================================== */

/** Базовые переводы. Используются как fallback и source для типизации ключей. */
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

type CoreTranslations = typeof coreTranslations;

/** Типобезопасные ключи переводов */
export type TranslationKey<N extends Namespace = Namespace> = keyof CoreTranslations[N];

/* ============================================================================
 * 🔧 ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ
 * ========================================================================== */

/** Интерполяция параметров в строке.
 * Пример: "Hello {name}" + {name:"John"} → "Hello John".
 * Используется split/join вместо RegExp для защиты от regex injection.
 * Сортирует параметры по длине ключа (от большего к меньшему) для предотвращения коллизий:
 * {nameFull} не будет заменён внутри {name}. */
function interpolate(str: string, params?: Params): string {
  if (!params) return str;

  let result = str;

  // Сортируем параметры по длине ключа (от большего к меньшему) для предотвращения коллизий
  const sortedEntries = Object.entries(params).sort(([a], [b]) => b.length - a.length);

  for (const [k, v] of sortedEntries) {
    result = result.split(`{${k}}`).join(String(v));
  }

  return result;
}

/** Генерирует человеко-читаемый текст из ключа.
 * Пример: "userLoginError" → "User login error". */
function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/* ============================================================================
 * 📅 DATE LOCALIZATION (SEPARATE SUBSYSTEM)
 * ============================================================================
 *
 * ВАЖНО: Это отдельная подсистема от i18n engine.
 * I18n engine не должен знать о date formatting.
 * ========================================================================== */

/**
 * Устанавливает локаль для dayjs. Использует динамический импорт для bundle splitting.
 * @param locale - код локали (например, 'ru', 'en', 'de')
 */
async function loadDayjsLocale(locale: string): Promise<void> {
  if (process.env['NODE_ENV'] !== 'production' || locale === 'en') {
    return;
  }

  try {
    await import(`dayjs/locale/${locale}.js`);
  } catch {
    // Если локаль не найдена, пробуем базовую (например, 'ru' вместо 'ru-RU')
    const baseLocale = locale.split('-')[0];
    if (baseLocale !== locale) {
      try {
        await import(`dayjs/locale/${baseLocale}.js`);
      } catch {
        // Игнорируем ошибки импорта, fallback на en
      }
    }
  }
}

export async function setDayjsLocale(locale: string): Promise<void> {
  try {
    // В production используем динамический импорт для уменьшения bundle size
    await loadDayjsLocale(locale);

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

/** Получает текущую установленную локаль dayjs. */
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

/** Проверяет доступна ли локаль для dayjs. @param locale - код локали для проверки */
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
 * Форматирует дату в локализованном формате. Удобная обертка над dayjs с текущей локалью.
 * @param date - дата для форматирования
 * @param format - формат dayjs (например, 'MMMM YYYY')
 */
export function formatDateLocalized(date: Date | dayjs.Dayjs | string, format: string): string {
  return dayjs(date).format(format);
}

/* ============================================================================
 * 🧠 RULE-BASED FALLBACK ENGINE
 * ========================================================================== */

/** Контекст выполнения fallback правил */
type RuleContext = {
  locale: string;
  fallbackLocale: string;
  ns: Namespace;
  key: string;
};

/** Тип fallback правила. Возвращает перевод или null если правило не сработало.
 * Правила могут использовать params для plural, gender, experiment и других правил. */
type Rule = (
  store: LocaleStore,
  ctx: RuleContext,
  params?: Params,
) => {
  result: string | null;
  fallbackType?: FallbackType;
};

/** Правило: основная локаль */
const primaryRule: Rule = (store, ctx) => {
  const translation = store[ctx.locale]?.[ctx.ns]?.[ctx.key];
  return translation !== undefined ? { result: translation } : { result: null };
};

/** Правило: fallback локаль */
const fallbackLocaleRule: Rule = (store, ctx) => {
  if (ctx.locale === ctx.fallbackLocale) {
    return { result: null };
  }

  const translation = store[ctx.fallbackLocale]?.[ctx.ns]?.[ctx.key];
  return translation !== undefined
    ? { result: translation, fallbackType: 'fallback-locale' }
    : { result: null };
};

/** Правило: namespace common */
const commonNamespaceRule: Rule = (store, ctx) => {
  if (ctx.ns === 'common') {
    return { result: null };
  }

  const localeStore = store[ctx.locale];
  const translation = localeStore?.common[ctx.key];
  return translation !== undefined
    ? { result: translation, fallbackType: 'common' }
    : { result: null };
};

/** Правило: человеко-читаемый fallback */
const humanReadableRule: Rule = (_store, ctx) => ({
  result: humanize(ctx.key),
  fallbackType: 'human-readable',
});

/**
 * Дефолтные правила для fallback pipeline.
 * Правила применяются последовательно до первого успешного результата.
 */
const defaultRules: Rule[] = [
  primaryRule,
  fallbackLocaleRule,
  commonNamespaceRule,
  humanReadableRule,
];

/* ============================================================================
 * ⚙️ I18N ENGINE (DOMAIN LAYER)
 * ========================================================================== */

/** Создаёт пустое хранилище локали со всеми namespaces. */
function createEmptyLocale(): Record<Namespace, Translations> {
  return {
    common: {},
    auth: {},
  };
}

class I18nEngine {
  locale: string;
  fallbackLocale: string;

  /** Хранилище локалей */
  private readonly store: LocaleStore = {};

  /** Загруженные namespaces */
  private readonly loaded = new Set<Namespace>();

  /** Fallback правила. Принадлежат instance, не модулю (SSR/multi-tenant safe). */
  private readonly rules: Rule[];

  /** Callback для отправки телеметрии fallback. Контекст (traceId, service) обогащается снаружи. */
  private readonly emitFallback: ((data: FallbackTelemetry) => void) | undefined;

  constructor(
    locale: string,
    fallbackLocale: string,
    options?: {
      /** Fallback правила. По умолчанию используются defaultRules. */
      rules?: Rule[];
      /** Callback для отправки телеметрии fallback. */
      emitFallback?: (data: FallbackTelemetry) => void;
    },
  ) {
    this.locale = locale;
    this.fallbackLocale = fallbackLocale;
    this.rules = options?.rules ?? [...defaultRules];
    this.emitFallback = options?.emitFallback ?? undefined;

    // Инициализация базовых переводов
    if (locale === 'ru') {
      this.store[locale] = { ...coreTranslations };
    } else {
      this.store[locale] = createEmptyLocale();
    }

    if (locale !== fallbackLocale) {
      if (fallbackLocale === 'ru') {
        this.store[fallbackLocale] = { ...coreTranslations };
      } else {
        this.store[fallbackLocale] = createEmptyLocale();
      }
    }

    // Помечаем базовые namespaces как загруженные
    this.loaded.add('common');
    this.loaded.add('auth');
  }

  // Основная функция перевода
  translate<N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Params,
  ): string {
    const ctx: RuleContext = {
      locale: this.locale,
      fallbackLocale: this.fallbackLocale,
      ns,
      key: String(key),
    };

    let result: string | null = null;
    let fallbackType: FallbackType | undefined;

    // Последовательно применяем fallback правила
    for (const rule of this.rules) {
      const ruleResult = rule(this.store, ctx, params);
      if (ruleResult.result !== null) {
        result = ruleResult.result;
        fallbackType = ruleResult.fallbackType;
        break;
      }
    }

    result ??= String(key);

    // Отправляем телеметрию только для случаев fallback (исключая human-readable для уменьшения шума)
    if (
      fallbackType !== undefined
      && fallbackType !== 'human-readable'
      && this.emitFallback !== undefined
    ) {
      this.emitFallback({
        key: String(key),
        ns: String(ns),
        locale: this.locale,
        fallbackType,
      });
    }

    return interpolate(result, params);
  }

  /** Обеспечивает наличие namespace в хранилище. В shared package сообщения не загружаются динамически (должно делаться в конкретном приложении через next-intl). */
  ensureNamespace(ns: Namespace): void {
    if (this.loaded.has(ns)) {
      return; // Уже загружено
    }

    this.store[this.locale] ??= createEmptyLocale();

    const localeStore = this.store[this.locale];
    if (localeStore && !(ns in localeStore)) {
      localeStore[ns] = {};
    }

    // Если fallback локаль отличается, тоже имитируем
    if (this.fallbackLocale !== this.locale) {
      this.store[this.fallbackLocale] ??= createEmptyLocale();

      const fallbackStore = this.store[this.fallbackLocale];
      if (fallbackStore && !(ns in fallbackStore)) {
        fallbackStore[ns] = {};
      }
    }

    this.loaded.add(ns);
  }

  /** Проверка загрузки namespace */
  isNamespaceLoaded(ns: Namespace): boolean {
    return this.loaded.has(ns);
  }
}

/* ============================================================================
 * 🌐 GLOBAL API (RUNTIME LAYER)
 * ========================================================================== */

/** Глобальный singleton только для browser runtime. SSR-safe: не используется на сервере. */
let globalI18n: I18nEngine | null = null;

/** Инициализация глобального i18n. Вызывается в AppProviders.
 * Устанавливает globalI18n только в browser runtime (SSR-safe). */
export function initGlobalI18n(
  locale: string,
  fallbackLocale: string,
  options?: {
    rules?: Rule[];
    emitFallback?: (data: FallbackTelemetry) => void;
  },
): void {
  // SSR-safe: глобальный singleton только для browser runtime
  if (typeof window !== 'undefined') {
    globalI18n = new I18nEngine(locale, fallbackLocale, options);
  }
}

/** Парсинг ключа перевода (поддерживает формат "namespace:key" или просто "key").
 * Использует indexOf вместо split для корректной обработки ключей с несколькими двоеточиями. */
function parseKey(key: string): [Namespace, string] {
  const idx = key.indexOf(':');
  if (idx !== -1) {
    const ns = key.substring(0, idx);
    const k = key.substring(idx + 1);
    const namespace = (ns === 'common' || ns === 'auth' ? ns : 'common') as Namespace;
    return [namespace, k || key];
  }

  return ['common', key];
}

/* ============================================================================
 * 🌍 ГЛОБАЛЬНАЯ ФУНКЦИЯ ПЕРЕВОДА (GLOBAL API)
 * ========================================================================== */

/** Глобальный перевод. Работает в React, вне React и на сервере.
 * Ограничение типовой безопасности: TypeScript не может гарантировать корректность
 * строковых ключей на этапе компиляции для динамических значений.
 * Для полной типобезопасности используйте engine.translate() напрямую.
 *
 * @param key - ключ перевода в формате "namespace:key" или просто "key"
 * @param params - параметры интерполяции
 */
export function t(
  key: string,
  params?: Record<string, string | number> & { default?: string; },
): string {
  if (!globalI18n) {
    // Fallback на default или ключ если глобальный i18n не инициализирован
    if (params?.default !== undefined && params.default !== '') {
      return params.default;
    }
    if (!params || Object.keys(params).length === 0) {
      return key;
    }
    return interpolate(key, params);
  }

  const [ns, k] = parseKey(key);
  // Type assertion необходим из-за ограничений TypeScript для динамических строковых ключей
  return globalI18n.translate(ns, k as TranslationKey<typeof ns>, params);
}

/* ============================================================================
 * ⚛️ REACT ADAPTER (UI LAYER)
 * ========================================================================== */

const I18nContext = createContext<I18nEngine | null>(null);

/** React Provider */
export const I18nProvider: React.FC<{
  locale: string;
  fallbackLocale: string;
  rules?: Rule[];
  emitFallback?: (data: FallbackTelemetry) => void;
  children: ReactNode;
}> = ({
  locale,
  fallbackLocale,
  rules,
  emitFallback,
  children,
}) => {
  const engine = useMemo(
    () => {
      const instance = new I18nEngine(locale, fallbackLocale, {
        ...(rules !== undefined && { rules }),
        ...(emitFallback !== undefined && { emitFallback }),
      });

      // Устанавливаем globalI18n синхронно в useMemo для предотвращения race condition
      // SSR-safe: только в browser runtime
      if (typeof window !== 'undefined') {
        globalI18n = instance;
      }

      return instance;
    },
    [locale, fallbackLocale, rules, emitFallback],
  );

  return React.createElement(
    I18nContext.Provider,
    { value: engine },
    children,
  );
};

/** React hook доступа к i18n */
export function useI18n(): I18nContextType {
  const engine = useContext(I18nContext);

  if (!engine) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return {
    locale: engine.locale,
    fallbackLocale: engine.fallbackLocale,
    translate: engine.translate.bind(engine),
    ensureNamespace: engine.ensureNamespace.bind(engine),
    isNamespaceLoaded: engine.isNamespaceLoaded.bind(engine),
    emitFallback: engine['emitFallback'] as ((data: FallbackTelemetry) => void) | undefined,
  };
}

/** Тип контекста i18n */
export type I18nContextType = {
  locale: string;
  fallbackLocale: string;
  translate: <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ) => string;
  ensureNamespace: (ns: Namespace) => void;
  isNamespaceLoaded: (ns: Namespace) => boolean;
  emitFallback: ((data: FallbackTelemetry) => void) | undefined;
};

/* ============================================================================
 * 🧩 SSR / BACKEND INSTANCE
 * ========================================================================== */

/** Создание изолированного i18n instance. Используется для SSR, backend и тестов. */
export function createI18nInstance(options: {
  locale: string;
  fallbackLocale: string;
  rules?: Rule[];
  emitFallback?: (data: FallbackTelemetry) => void;
}): I18nContextType {
  const { locale, fallbackLocale, rules, emitFallback } = options;

  const engine = new I18nEngine(locale, fallbackLocale, {
    ...(rules !== undefined && { rules }),
    ...(emitFallback !== undefined && { emitFallback }),
  });

  return {
    locale: engine.locale,
    fallbackLocale: engine.fallbackLocale,
    translate: engine.translate.bind(engine),
    ensureNamespace: engine.ensureNamespace.bind(engine),
    isNamespaceLoaded: engine.isNamespaceLoaded.bind(engine),
    emitFallback: engine['emitFallback'] as ((data: FallbackTelemetry) => void) | undefined,
  };
}
