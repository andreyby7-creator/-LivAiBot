/**
 * @file packages/app/src/types/ui-contracts.ts
 *
 * ============================================================================
 * 🌐 UI CONTRACTS: MAPPING CORE PRIMITIVES ↔ APP WRAPPERS
 * ============================================================================
 *
 * Этот файл описывает типы для связи базовых UI-компонентов (ui-core)
 * с приложенческими wrapper-компонентами:
 * - Контролируемые / неконтролируемые props
 * - Event handlers с типизацией по типу события
 * - Feature flag overrides
 * - UI state management с retry/refresh политикой
 * - Observability и distributed tracing
 *
 * Принципы:
 * - Строгая типизация и максимальная safety
 * - Generic + Discriminated unions для состояния и событий
 * - Feature flags строго типизированы
 * - Микросервисная архитектура: компонент ↔ app ↔ backend
 */

import type { Json } from './common.js';
import type { CoreUIBaseProps } from '../../../ui-core/src/types/ui.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';

/** Тип имени feature flag - domain-специфичный паттерн строки для типобезопасности */
export type UiFeatureFlagName =
  | `AUTH_${string}`
  | `BILLING_${string}`
  | `AI_${string}`
  | `SYSTEM_${string}`;

export type UiPrimitiveProps = CoreUIBaseProps;

/* ========================================================================== */
/* 🔧 UI FEATURE FLAGS */
/* ========================================================================== */

/** Строго типизированные feature flags для UI компонентов. */
export type UiFeatureFlags = {
  readonly experimental?: boolean;
  readonly beta?: boolean;
  readonly [key: string]: boolean | undefined;
};

/* ========================================================================== */
/* 🎛 CONTROLLED / UNCONTROLLED COMPONENTS */
/* ========================================================================== */

/** Контролируемые поля */
export type ControlledFieldProps<T> = {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  featureFlags?: UiFeatureFlags;
};

/** Неконтролируемые поля */
export type UncontrolledFieldProps<T> = {
  defaultValue?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  featureFlags?: UiFeatureFlags;
};

/* ========================================================================== */
/* 🧩 UI EVENT CONTRACTS */
/* ========================================================================== */

/** Generic типизация событий по type ↔ payload для строгого автокомплита. */
export type UiEventMap = {
  CLICK_BUTTON: { buttonId: string; };
  INPUT_CHANGE: { field: string; value: string | number; };
  FORM_SUBMIT: { formId: string; values: Json; };
  // можно добавлять новые события по мере роста приложения
};

/** Типизированный UI Event. */
export type UiEvent<TType extends keyof UiEventMap = keyof UiEventMap> = {
  readonly type: TType;
  readonly payload: TType extends keyof UiEventMap ? UiEventMap[TType] : Json;
  readonly timestamp: string;
  readonly traceId?: string; // distributed tracing
  readonly componentId?: string; // уникальный компонент
  readonly context?: {
    featureFlags?: UiFeatureFlags;
    source?: string;
  };
};

/** Обработчик событий */
export type UiEventHandler<TEvent extends UiEvent = UiEvent> = (event: TEvent) => void;

/* ========================================================================== */
/* 🔄 UI STATE MAPPING */
/* ========================================================================== */

/** Retry / refresh политика для асинхронного состояния */
export type UiStatePolicy = {
  retries?: number;
  retryDelayMs?: number;
  refreshIntervalMs?: number;
};

/** ComponentState vs FormState */
export type ComponentState<TData = Json> =
  | { status: 'idle'; }
  | { status: 'loading'; }
  | { status: 'success'; data: TData; }
  | { status: 'error'; error: string; details?: Json; };

/** Stateful Component Props */
export type UiStatefulComponentProps<TData = Json> = {
  state: ComponentState<TData>;
  onStateChange?: (state: ComponentState<TData>) => void;
  policy?: UiStatePolicy;
  featureFlags?: UiFeatureFlags;
};

/* ========================================================================== */
/* 🖥 MAPPING CORE ↔ APP WRAPPERS */
/* ========================================================================== */

/** Utility type для автоматического маппинга props core → wrapper */
export type MapCoreProps<TProps extends UiPrimitiveProps, TData = Json> = TProps & {
  state?: ComponentState<TData>;
  value?: TData;
  defaultValue?: TData;
  onChange?: (value: TData) => void;
  onEvent?: UiEventHandler;
  featureFlags?: UiFeatureFlags;
};

/** App wrapper props */
export type AppWrapperProps<
  TProps extends UiPrimitiveProps = UiPrimitiveProps,
  TData = Json,
> = MapCoreProps<TProps, TData>;

/* ========================================================================== */
/* 🔒 UI SECURITY / AUTH */
/* ========================================================================== */

export type UiAuthContext = {
  readonly isAuthenticated: boolean;
  readonly accessToken?: string;
  readonly refreshToken?: string;
};

/* ========================================================================== */
/* 📊 OBSERVABILITY / METRICS */
/* ========================================================================== */

export type UiMetrics = {
  readonly durationMs: number;
  readonly component: string;
  readonly source?: string;
  readonly traceId?: string; // distributed tracing
  readonly componentId?: string;
  readonly meta?: Json;
};

/* ========================================================================== */
/* 🎨 UNIFIED UI INFRASTRUCTURE API */
/* ========================================================================== */

/** Стабильный API для feature flags в UI инфраструктуре */
export type UiFeatureFlagsApi = {
  readonly isEnabled: (name: UiFeatureFlagName) => boolean;
  readonly setOverride: (name: UiFeatureFlagName, value: boolean) => void;
  readonly clearOverrides: () => void;
  readonly getOverride: (name: UiFeatureFlagName, defaultValue?: boolean) => boolean;
};

/** Стабильный API для telemetry в UI инфраструктуре */
export type UiTelemetryApi = {
  readonly track: (event: string, data?: Readonly<Record<string, unknown>>) => void;
  readonly infoFireAndForget: (event: string, data?: Readonly<Record<string, unknown>>) => void;
  readonly warnFireAndForget: (event: string, data?: Readonly<Record<string, unknown>>) => void;
  readonly errorFireAndForget: (event: string, data?: Readonly<Record<string, unknown>>) => void;
  readonly flush: () => void;
};

/** Стабильный API для i18n в UI инфраструктуре */
export type UiI18nContext = {
  readonly locale: string;
  readonly direction: 'ltr' | 'rtl';
  readonly translate: <N extends Namespace>(
    ns: N,
    key: TranslationKey<N>,
    params?: Record<string, string | number>,
  ) => string;
  readonly loadNamespace: (ns: Namespace) => void;
  readonly isNamespaceLoaded: (ns: Namespace) => boolean;
  readonly t: (
    key: string,
    params?: Record<string, string | number> & { default?: string; },
  ) => string;
  readonly formatDateLocalized: (date: import('dayjs').Dayjs, format: string) => string;
  readonly setDayjsLocale: (locale: string) => void;
};
