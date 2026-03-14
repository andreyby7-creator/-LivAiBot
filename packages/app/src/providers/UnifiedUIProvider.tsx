/**
 * @file packages/app/src/providers/UnifiedUIProvider.tsx
 * ============================================================================
 * 🎨 UNIFIED UI PROVIDER — ЕДИНЫЙ ПРОВАЙДЕР UI ИНФРАСТРУКТУРЫ
 * ============================================================================
 *
 * Назначение:
 * - Единая точка доступа к UI инфраструктуре приложения
 * - Split context pattern для оптимизации производительности (отдельные контексты для featureFlags/telemetry/i18n)
 * - Автоматическая инъекция сервисов во все UI компоненты через адаптеры
 * - Микросервисная композиция без нарушения separation of concerns
 *
 * Архитектурные принципы:
 * - Split context: разделенные контексты предотвращают лишние ререндеры (компонент ререндерится только при изменении нужного контекста)
 * - Factory-функции для адаптеров: разделение ответственности (orchestration vs adaptation)
 * - SSR-safe поведение с graceful degradation (noop fallbacks)
 * - Защита telemetry: фильтрация чувствительных данных и ограничение размера payloads
 * - Готовность к rule engine: EvaluationContext для будущего расширения feature flags
 * - Детерминированная инициализация сервисов без side effects в рендере
 */

'use client';

import type { JSX, PropsWithChildren } from 'react';
import React, { memo, useMemo } from 'react';

import type { FeatureFlagName } from '@livai/core/feature-flags';
import { useFeatureFlagOverrides } from '@livai/core/feature-flags/react';
import type { TelemetryMetadata, TelemetryPrimitive } from '@livai/core-contracts';

import { formatDateLocalized, isRtlLocale, setDayjsLocale, useI18n } from '../lib/i18n.js';
import {
  errorFireAndForget,
  infoFireAndForget,
  warnFireAndForget,
} from '../lib/telemetry-runtime.js';
import type { UiFeatureFlagsApi, UiI18nContext, UiTelemetryApi } from '../types/ui-contracts.js';
import { useFeatureFlags } from './FeatureFlagsProvider.js';
import { useTelemetryContext } from './TelemetryProvider.js';

/* ============================================================================
 * 🔧 ADAPTERS & UTILITIES
 * ========================================================================== */

/** Максимальный размер значения метаданных для telemetry (защита от DoS и ingestion drop) */
const MAX_METADATA_VALUE_SIZE = 1024;

/** Список чувствительных ключей, которые должны быть отфильтрованы из telemetry */
const SENSITIVE_KEYS = Object.freeze(
  [
    'password',
    'token',
    'authorization',
    'cookie',
    'secret',
    'apiKey',
    'accessToken',
    'refreshToken',
  ] as const,
);

/** Проверяет, является ли ключ чувствительным (для фильтрации из telemetry) */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive.toLowerCase()));
}

/**
 * Преобразует Record<string, unknown> в TelemetryMetadata с защитой от:
 * - Больших payloads (обрезание до MAX_METADATA_VALUE_SIZE)
 * - Чувствительных данных (фильтрация SENSITIVE_KEYS)
 * - Несериализуемых значений (fallback на '[Non-serializable]')
 */
function convertToTelemetryMetadata(
  data: Readonly<Record<string, unknown>>,
): TelemetryMetadata {
  const result: Record<string, TelemetryPrimitive> = {};

  for (const [key, value] of Object.entries(data)) {
    // Фильтруем чувствительные ключи для защиты от metadata leakage
    if (isSensitiveKey(key)) {
      continue;
    }

    if (value === null || value === undefined) {
      result[key] = null;
    } else if (
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ) {
      result[key] = value;
    } else {
      // Преобразуем объекты и массивы в строки с ограничением размера
      try {
        const serialized = JSON.stringify(value);
        // Ограничиваем размер для защиты от DoS и ingestion drop
        result[key] = serialized.length > MAX_METADATA_VALUE_SIZE
          ? serialized.slice(0, MAX_METADATA_VALUE_SIZE)
          : serialized;
      } catch {
        result[key] = '[Non-serializable]';
      }
    }
  }

  return result;
}

/** Контекст для оценки feature flags (для будущего rule engine) */
export type EvaluationContext = Readonly<{
  userId?: string;
  sessionId?: string;
  attributes?: Readonly<Record<string, unknown>>;
}>;

/** Стабильный API для feature flags в unified provider */
export type UnifiedUiFeatureFlagsApi = UiFeatureFlagsApi;

/** Стабильный API для telemetry в unified provider */
export type UnifiedUiTelemetryApi = UiTelemetryApi;

/** Стабильный API для i18n в unified provider (без дублирования t/translate) */
export type UnifiedUiI18nContext = Omit<UiI18nContext, 't'>;

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

const NOOP_I18N: UnifiedUiI18nContext = Object.freeze({
  locale: 'en',
  direction: 'ltr' as const,
  translate: () => '',
  ensureNamespace: () => undefined,
  isNamespaceLoaded: () => false,
  formatDateLocalized: () => '',
  setDayjsLocale: () => Promise.resolve(),
});

/** SSR-safe noop контекст для graceful degradation. */
const NOOP_CONTEXT: UnifiedUIContextType & { __status: symbol; } = Object.freeze({
  __status: UNIFIED_UI_MISSING,
  featureFlags: NOOP_FEATURE_FLAGS,
  telemetry: NOOP_TELEMETRY,
  i18n: NOOP_I18N,
});

/* ============================================================================
 * 🧩 CONTEXTS (Split для оптимизации производительности)
 * ========================================================================== */

/** Контекст для feature flags. Разделен для оптимизации: ререндер только при изменении featureFlags. */
export const FeatureFlagsContext = React.createContext<UnifiedUiFeatureFlagsApi>(
  NOOP_CONTEXT.featureFlags,
);

/** Контекст для telemetry. Разделен для оптимизации: ререндер только при изменении telemetry. */
export const TelemetryContext = React.createContext<UnifiedUiTelemetryApi>(NOOP_CONTEXT.telemetry);

/** Контекст для i18n. Разделен для оптимизации: ререндер только при изменении i18n. */
export const I18nContext = React.createContext<UnifiedUiI18nContext>(NOOP_CONTEXT.i18n);

/** Единый контекст UI инфраструктуры (deprecated: используйте отдельные контексты для оптимизации). */
export const UnifiedUIContext = React.createContext<UnifiedUIContextType>(NOOP_CONTEXT);

/* ============================================================================
 * 🏭 ADAPTER FACTORIES
 * ========================================================================== */

/** Создает telemetry API адаптер с защитой от больших payloads и чувствительных данных */
function createTelemetryApi(
  telemetry: ReturnType<typeof useTelemetryContext>,
): UnifiedUiTelemetryApi {
  return {
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
  };
}

/** Создает i18n API адаптер без дублирования функций перевода (используется только translate) */
function createI18nApi(
  i18nContext: ReturnType<typeof useI18n>,
): UnifiedUiI18nContext {
  return {
    locale: i18nContext.locale,
    direction: isRtlLocale(i18nContext.locale) ? 'rtl' : 'ltr',
    translate: i18nContext.translate,
    ensureNamespace: i18nContext.ensureNamespace,
    isNamespaceLoaded: i18nContext.isNamespaceLoaded,
    formatDateLocalized,
    setDayjsLocale,
  };
}

/** Создает feature flags API адаптер с поддержкой getOverride */
function createFeatureFlagsApi(
  base: ReturnType<typeof useFeatureFlags>,
  overrides: ReturnType<typeof useFeatureFlagOverrides>,
): UnifiedUiFeatureFlagsApi {
  const getOverride = (name: FeatureFlagName, defaultValue = false): boolean => {
    return overrides[name] ?? defaultValue;
  };

  return {
    ...base,
    getOverride,
  };
}

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
  const overrides = useFeatureFlagOverrides();

  // Создаем адаптеры через factory-функции для разделения ответственности
  const featureFlags = useMemo(
    () => createFeatureFlagsApi(baseFeatureFlags, overrides),
    [baseFeatureFlags, overrides],
  );

  const telemetryApi = useMemo(
    () => createTelemetryApi(telemetry),
    [telemetry],
  );

  const i18nApi = useMemo(
    () => createI18nApi(i18nContext),
    [i18nContext],
  );

  return (
    <FeatureFlagsContext.Provider value={featureFlags}>
      <TelemetryContext.Provider value={telemetryApi}>
        <I18nContext.Provider value={i18nApi}>
          {children}
        </I18nContext.Provider>
      </TelemetryContext.Provider>
    </FeatureFlagsContext.Provider>
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
  const flags = useUnifiedFeatureFlags();
  const telemetry = useUnifiedTelemetry();
  const i18n = useUnifiedI18n();

  return useMemo(
    () => ({
      featureFlags: flags,
      telemetry,
      i18n,
    }),
    [flags, telemetry, i18n],
  );
}

/**
 * Строгий хук для доступа к единому UI контексту с fail-fast поведением.
 * В отличие от useUnifiedUI, этот хук выбрасывает ошибку если провайдер отсутствует,
 * что помогает детектировать архитектурные проблемы на ранних этапах.
 * @returns UnifiedUIContextType с доступом ко всем сервисам
 * @throws Error если UnifiedUIProvider не найден в дереве компонентов
 */
export function useRequiredUnifiedUI(): UnifiedUIContextType {
  const flags = useUnifiedFeatureFlags();
  const telemetry = useUnifiedTelemetry();
  const i18n = useUnifiedI18n();

  // Проверяем, что все контексты являются noop (провайдер отсутствует)
  if (
    flags === NOOP_CONTEXT.featureFlags
    && telemetry === NOOP_CONTEXT.telemetry
    && i18n === NOOP_CONTEXT.i18n
  ) {
    throw new Error(
      'UnifiedUIProvider является обязательным, но отсутствует в дереве компонентов. '
        + 'Убедитесь что UnifiedUIProvider обернут вокруг вашего приложения.',
    );
  }

  return useMemo(
    () => ({
      featureFlags: flags,
      telemetry,
      i18n,
    }),
    [flags, telemetry, i18n],
  );
}

/**
 * Хук для доступа только к feature flags из разделенного контекста.
 * Оптимизация: ререндер только при изменении featureFlags (не зависит от telemetry/i18n).
 * @returns FeatureFlags API
 */
export function useUnifiedFeatureFlags(): UnifiedUiFeatureFlagsApi {
  const context = React.useContext(FeatureFlagsContext);

  if (process.env['NODE_ENV'] !== 'production' && context === NOOP_CONTEXT.featureFlags) {
    // eslint-disable-next-line no-console
    console.warn(
      'UnifiedUIProvider отсутствует в дереве компонентов. '
        + 'useUnifiedFeatureFlags возвращает noop fallback. '
        + 'Убедитесь что UnifiedUIProvider обернут вокруг вашего приложения.',
    );
  }

  return context;
}

/**
 * Хук для доступа только к telemetry из разделенного контекста.
 * Оптимизация: ререндер только при изменении telemetry (не зависит от featureFlags/i18n).
 * @returns Telemetry API
 */
export function useUnifiedTelemetry(): UnifiedUiTelemetryApi {
  const context = React.useContext(TelemetryContext);

  if (process.env['NODE_ENV'] !== 'production' && context === NOOP_CONTEXT.telemetry) {
    // eslint-disable-next-line no-console
    console.warn(
      'UnifiedUIProvider отсутствует в дереве компонентов. '
        + 'useUnifiedTelemetry возвращает noop fallback. '
        + 'Убедитесь что UnifiedUIProvider обернут вокруг вашего приложения.',
    );
  }

  return context;
}

/**
 * Хук для доступа к i18n информации из разделенного контекста.
 * Оптимизация: ререндер только при изменении i18n (не зависит от featureFlags/telemetry).
 * @returns I18n context с текущей локалью и направлением текста
 */
export function useUnifiedI18n(): UnifiedUiI18nContext {
  const context = React.useContext(I18nContext);

  if (process.env['NODE_ENV'] !== 'production' && context === NOOP_CONTEXT.i18n) {
    // eslint-disable-next-line no-console
    console.warn(
      'UnifiedUIProvider отсутствует в дереве компонентов. '
        + 'useUnifiedI18n возвращает noop fallback. '
        + 'Убедитесь что UnifiedUIProvider обернут вокруг вашего приложения.',
    );
  }

  return context;
}
