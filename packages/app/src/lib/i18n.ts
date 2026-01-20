/**
 * @file packages/app/src/lib/i18n.ts
 * ============================================================================
 * 🌐 I18N CORE — УСТОЙЧИВЫЕ УТИЛИТЫ ЛОКАЛИЗАЦИИ
 * ============================================================================
 *
 * Свойства:
 * - Typed keys для переводов
 * - Namespaces для модульных локалей
 * - Функциональный, immutable, безопасный для SSR/SSG
 * - Fallback locale, traceId/service для telemetry
 * - Готов к микросервисной архитектуре
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

/* ============================================================================
 * 🏷️ TYPED TRANSLATIONS
 * ========================================================================== */

export const translations = {
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

export type Namespace = keyof typeof translations;
export type TranslationKey<N extends Namespace = Namespace> = keyof typeof translations[N];

/* ============================================================================
 * 🌍 I18N CONTEXT
 * ========================================================================== */

export type I18nContextType = {
  locale: string;
  fallbackLocale: string;
  translate: <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ) => string;
  telemetry?:
    | ((
      data: {
        key: string;
        ns: string;
        locale: string;
        traceId?: string | undefined;
        service?: string | undefined;
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
  const translate = useMemo(() => {
    return <N extends Namespace>(
      ns: N,
      key: TranslationKey<N>,
      params?: Record<string, string | number>,
    ): string => {
      const nsTranslations = translations[ns];
      const template = ns in translations && key in nsTranslations
        ? String(nsTranslations[key as keyof typeof nsTranslations])
        : `[missing ${String(ns)}.${String(key)}]`;

      let result = template;

      // interpolate params
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(new RegExp(`{${k}}`, 'g'), String(v));
        }
      }

      telemetry?.({
        key: String(key),
        ns: String(ns),
        locale,
        traceId: undefined,
        service: undefined,
      });

      return result;
    };
  }, [locale, telemetry]);

  return React.createElement(
    I18nContext.Provider,
    { value: { locale, fallbackLocale, translate, telemetry } },
    children,
  );
};

/* ============================================================================
 * 🔧 HOOKS
 * ========================================================================== */

export const useI18n = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
};

/** Хелпер для быстрого SSR/Static generation */
export const createI18nInstance = (options: {
  locale: string;
  fallbackLocale: string;
  telemetry?: I18nContextType['telemetry'];
}): I18nContextType => {
  const { locale, fallbackLocale, telemetry } = options;

  const translate = <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ): string => {
    const nsTranslations = translations[ns];
    const template = ns in translations && key in nsTranslations
      ? String(nsTranslations[key as keyof typeof nsTranslations])
      : `[missing ${String(ns)}.${String(key)}]`;

    let result = template;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }

    telemetry?.({
      key: String(key),
      ns: String(ns),
      locale,
      traceId: undefined,
      service: undefined,
    });

    return result;
  };

  return { locale, fallbackLocale, translate, telemetry } as I18nContextType;
};
