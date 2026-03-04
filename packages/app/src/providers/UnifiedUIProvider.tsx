/**
 * @file packages/app/src/providers/UnifiedUIProvider.tsx
 * ============================================================================
 * 🎨 UNIFIED UI PROVIDER — ЕДИНЫЙ ПРОВАЙДЕР UI ИНФРАСТРУКТУРЫ
 * ============================================================================
 * Назначение:
 * - Единая точка доступа к UI инфраструктуре приложения
 * - Комбинированный context для featureFlags + telemetry + i18n
 * - Автоматическая инъекция сервисов во все UI компоненты
 * - Микросервисная композиция без нарушения separation of concerns
 * Архитектурные принципы:
 * - Context composition без side effects в рендере
 * - SSR-safe поведение с graceful degradation
 * - Детерминированная инициализация сервисов
 * - Thin API для потребителей (композиция существующих hooks)
 */

'use client';

import React, { memo, useMemo } from 'react';
import type { JSX, PropsWithChildren } from 'react';

import { useFeatureFlags } from './FeatureFlagsProvider.js';
import { useTelemetryContext } from './TelemetryProvider.js';
import { useFeatureFlagOverride } from '../lib/feature-flags.js';
import { formatDateLocalized, isRtlLocale, setDayjsLocale, t, useI18n } from '../lib/i18n.js';
import {
  errorFireAndForget,
  infoFireAndForget,
  warnFireAndForget,
} from '../lib/telemetry-runtime.js';
import type { TelemetryMetadata, TelemetryPrimitive } from '../types/telemetry.js';
import type { UiFeatureFlagsApi, UiI18nContext, UiTelemetryApi } from '../types/ui-contracts.js';

/**
 * Преобразует Record<string, unknown> в TelemetryMetadata, конвертируя объекты и массивы в строки.
 */
function convertToTelemetryMetadata(
  data: Readonly<Record<string, unknown>>,
): TelemetryMetadata {
  const result: Record<string, TelemetryPrimitive> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      result[key] = null;
    } else if (
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ) {
      result[key] = value;
    } else {
      // Преобразуем объекты и массивы в строки
      try {
        result[key] = JSON.stringify(value);
      } catch {
        result[key] = '[Non-serializable]';
      }
    }
  }

  return result;
}

/** Стабильный API для feature flags в unified provider */
export type UnifiedUiFeatureFlagsApi = UiFeatureFlagsApi;

/** Стабильный API для telemetry в unified provider */
export type UnifiedUiTelemetryApi = UiTelemetryApi;

/** Стабильный API для i18n в unified provider */
export type UnifiedUiI18nContext = UiI18nContext;

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Единый UI контекст для доступа ко всем инфраструктурным сервисам. */
export type UnifiedUIContextType = Readonly<{
  /** Feature flags API. */
  readonly featureFlags: UnifiedUiFeatureFlagsApi;
  /** Telemetry API. */
  readonly telemetry: UnifiedUiTelemetryApi;
  /** I18n context с поддержкой direction. */
  readonly i18n: UnifiedUiI18nContext;
}>;

/** Props UnifiedUIProvider. */
export type UnifiedUIProviderProps = PropsWithChildren;

/** Sentinel symbol для детекции отсутствия провайдера. */
const UNIFIED_UI_MISSING = Symbol('UNIFIED_UI_MISSING');

/** Явно типизированные noop реализации для корректности. */
const NOOP_FEATURE_FLAGS: UnifiedUiFeatureFlagsApi = Object.freeze({
  isEnabled: () => false,
  setOverride: () => undefined,
  clearOverrides: () => undefined,
  getOverride: (_name, defaultValue = false) => defaultValue,
});

const NOOP_TELEMETRY: UnifiedUiTelemetryApi = Object.freeze({
  track: () => undefined,
  infoFireAndForget: () => undefined,
  warnFireAndForget: () => undefined,
  errorFireAndForget: () => undefined,
  flush: () => undefined,
});

/** SSR-safe noop контекст для graceful degradation. */
const NOOP_CONTEXT: UnifiedUIContextType & { __status: symbol; } = Object.freeze({
  __status: UNIFIED_UI_MISSING,
  featureFlags: NOOP_FEATURE_FLAGS,
  telemetry: NOOP_TELEMETRY,
  i18n: Object.freeze({
    locale: 'en',
    direction: 'ltr' as const,
    translate: () => '',
    loadNamespace: () => undefined,
    isNamespaceLoaded: () => false,
    t: () => '',
    formatDateLocalized: () => '',
    setDayjsLocale: () => undefined,
  }),
});

/* ============================================================================
 * 🧩 CONTEXT
 * ========================================================================== */

/** Единый контекст UI инфраструктуры. */
export const UnifiedUIContext = React.createContext<UnifiedUIContextType>(NOOP_CONTEXT);

/* ============================================================================
 * 🎯 PROVIDER
 * ========================================================================== */

/**
 * UnifiedUIProvider — композиционный провайдер для UI инфраструктуры.
 * Автоматически предоставляет доступ к:
 * - Feature flags через FeatureFlagsProvider
 * - Telemetry через TelemetryProvider
 * - I18n через IntlProvider
 * Все сервисы инициализируются детерминированно в правильном порядке.
 */
function UnifiedUIProviderComponent({
  children,
}: UnifiedUIProviderProps): JSX.Element {
  // Инициализируем сервисы с satisfies для type safety
  const baseFeatureFlags = useFeatureFlags();
  const telemetry = useTelemetryContext();
  const i18nContext = useI18n();

  // Обертываем feature flags с getOverride
  const featureFlags = useMemo(() => ({
    ...baseFeatureFlags,
    getOverride: useFeatureFlagOverride,
  }), [baseFeatureFlags]);

  // Создаем единый контекст с мемоизацией для предотвращения лишних ререндеров
  const contextValue = useMemo<UnifiedUIContextType>(
    () => ({
      featureFlags,
      telemetry: {
        track: telemetry.track,
        infoFireAndForget: (event: string, data?: Readonly<Record<string, unknown>>): void => {
          const metadata = data ? convertToTelemetryMetadata(data) : undefined;
          infoFireAndForget(event, metadata);
        },
        warnFireAndForget: (event: string, data?: Readonly<Record<string, unknown>>): void => {
          const metadata = data ? convertToTelemetryMetadata(data) : undefined;
          warnFireAndForget(event, metadata);
        },
        errorFireAndForget: (event: string, data?: Readonly<Record<string, unknown>>): void => {
          const metadata = data ? convertToTelemetryMetadata(data) : undefined;
          errorFireAndForget(event, metadata);
        },
        flush: telemetry.flush,
      },
      i18n: {
        locale: i18nContext.locale,
        direction: isRtlLocale(i18nContext.locale) ? 'rtl' : 'ltr',
        translate: i18nContext.translate,
        loadNamespace: i18nContext.loadNamespace,
        isNamespaceLoaded: i18nContext.isNamespaceLoaded,
        t,
        formatDateLocalized,
        setDayjsLocale,
      },
    }),
    [
      featureFlags,
      telemetry,
      i18nContext.locale,
      i18nContext.translate,
      i18nContext.loadNamespace,
      i18nContext.isNamespaceLoaded,
    ],
  );

  return (
    <UnifiedUIContext.Provider value={contextValue}>
      {children}
    </UnifiedUIContext.Provider>
  );
}

export const UnifiedUIProvider = Object.assign(memo(UnifiedUIProviderComponent), {
  displayName: 'UnifiedUIProvider',
});

export default UnifiedUIProvider;

/* ============================================================================
 * 🎣 HOOKS
 * ========================================================================== */

/**
 * Хук для доступа к единому UI контексту.
 * Предоставляет тонкий API для всех UI инфраструктурных сервисов:
 * - featureFlags: управление feature flags
 * - telemetry: трекинг событий и метрик
 * - i18n: информация о текущей локали и направлении текста
 * @returns UnifiedUIContextType с доступом ко всем сервисам
 */
export function useUnifiedUI(): UnifiedUIContextType {
  const context = React.useContext(UnifiedUIContext);

  if (process.env['NODE_ENV'] !== 'production' && '__status' in context) {
    // eslint-disable-next-line no-console
    console.warn(
      'UnifiedUIProvider отсутствует в дереве компонентов. '
        + 'useUnifiedUI возвращает noop fallback. '
        + 'Убедитесь что UnifiedUIProvider обернут вокруг вашего приложения.',
    );
  }

  return context;
}

/**
 * Строгий хук для доступа к единому UI контексту с fail-fast поведением.
 * В отличие от useUnifiedUI, этот хук выбрасывает ошибку если провайдер отсутствует,
 * что помогает детектировать архитектурные проблемы на ранних этапах.
 * @returns UnifiedUIContextType с доступом ко всем сервисам
 * @throws Error если UnifiedUIProvider не найден в дереве компонентов
 */
export function useRequiredUnifiedUI(): UnifiedUIContextType {
  const context = useUnifiedUI();

  if ('__status' in context) {
    throw new Error(
      'UnifiedUIProvider является обязательным, но отсутствует в дереве компонентов. '
        + 'Убедитесь что UnifiedUIProvider обернут вокруг вашего приложения.',
    );
  }

  return context;
}

/**
 * Удобный хук для доступа только к feature flags из единого контекста.
 * @returns FeatureFlags API
 */
export function useUnifiedFeatureFlags(): UnifiedUIContextType['featureFlags'] {
  const { featureFlags } = useUnifiedUI();
  return featureFlags;
}

/**
 * Удобный хук для доступа только к telemetry из единого контекста.
 * @returns Telemetry API
 */
export function useUnifiedTelemetry(): UnifiedUIContextType['telemetry'] {
  const { telemetry } = useUnifiedUI();
  return telemetry;
}

/**
 * Удобный хук для доступа к i18n информации из единого контекста.
 * @returns I18n context с текущей локалью и направлением текста
 */
export function useUnifiedI18n(): UnifiedUIContextType['i18n'] {
  const { i18n } = useUnifiedUI();
  return i18n;
}

// TODO: заменить на context selector (use-context-selector / signals)
// при необходимости оптимизации производительности
