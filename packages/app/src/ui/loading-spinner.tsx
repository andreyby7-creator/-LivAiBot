/**
 * @file packages/app/src/ui/loading-spinner.tsx
 * ============================================================================
 * 🟥 APP UI LOADING SPINNER — UI МИКРОСЕРВИС LOADING SPINNER
 * ============================================================================
 * Единственная точка входа для Loading Spinner в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * Архитектурные решения:
 * - Управление видимостью и параметрами обрабатывается в App слое
 * - CoreLoadingSpinner остается полностью presentational
 */

import type { JSX, Ref } from 'react';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';

import type { CoreLoadingSpinnerProps } from '@livai/ui-core/primitives/loading-spinner';
import { LoadingSpinner as CoreLoadingSpinner } from '@livai/ui-core/primitives/loading-spinner';

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

/** Алиас для UI feature flags в контексте loading-spinner wrapper */
export type LoadingSpinnerUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте loading-spinner */
export type LoadingSpinnerWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте loading-spinner */
export type LoadingSpinnerMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum LoadingSpinnerTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

type LoadingSpinnerTelemetryPayload = {
  component: 'LoadingSpinner';
  action: LoadingSpinnerTelemetryAction;
  hidden: boolean;
  visible: boolean;
  variant?: 'spinner' | 'dots' | 'pulse';
  size?: string;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppLoadingSpinnerProps = Readonly<
  & Omit<CoreLoadingSpinnerProps, 'data-testid' | 'aria-label'>
  & {
    /** Видимость Loading Spinner (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть Loading Spinner */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
  & (
    | {
      /** I18n aria-label режим */
      ariaLabelI18nKey: TranslationKey;
      ariaLabelI18nNs?: Namespace;
      ariaLabelI18nParams?: Record<string, string | number>;
      'aria-label'?: never;
    }
    | {
      /** Обычный aria-label режим */
      ariaLabelI18nKey?: never;
      ariaLabelI18nNs?: never;
      ariaLabelI18nParams?: never;
      'aria-label'?: string;
    }
  )
>;

// Бизнес-пропсы, которые не должны попадать в DOM
// aria-label контролируется App-слоем для ARIA трансформации
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type LoadingSpinnerPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * LoadingSpinnerPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 * @note Чистая функция без side-effects. Использует только useMemo для вычислений.
 */
function useLoadingSpinnerPolicy(
  props: AppLoadingSpinnerProps,
): LoadingSpinnerPolicy {
  const hiddenByFeatureFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFeatureFlag && props.visible !== false;
    return {
      hiddenByFeatureFlag,
      isRendered,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [hiddenByFeatureFlag, props.visible, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitLoadingSpinnerTelemetry(
  telemetry: UiTelemetryApi,
  payload: LoadingSpinnerTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`LoadingSpinner ${payload.action}`, payload);
}

/**
 * Базовое формирование payload для LoadingSpinner telemetry (без visible).
 * visible добавляется явно в show/hide payload для семантической чистоты.
 */
function getLoadingSpinnerPayloadBase(
  action: LoadingSpinnerTelemetryAction,
  policy: LoadingSpinnerPolicy,
  telemetryProps: {
    variant?: 'spinner' | 'dots' | 'pulse';
    size?: string;
  },
): Omit<LoadingSpinnerTelemetryPayload, 'visible'> {
  return {
    component: 'LoadingSpinner',
    action,
    hidden: policy.hiddenByFeatureFlag,
    ...(telemetryProps.variant !== undefined && { variant: telemetryProps.variant }),
    ...(telemetryProps.size !== undefined && { size: telemetryProps.size }),
  };
}

/**
 * Формирование payload для LoadingSpinner telemetry (для lifecycle events).
 * Использует policy.isRendered для visible.
 */
function getLoadingSpinnerPayload(
  action: LoadingSpinnerTelemetryAction,
  policy: LoadingSpinnerPolicy,
  telemetryProps: {
    variant?: 'spinner' | 'dots' | 'pulse';
    size?: string;
  },
): LoadingSpinnerTelemetryPayload {
  return {
    ...getLoadingSpinnerPayloadBase(action, policy, telemetryProps),
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP LOADING SPINNER
 * ========================================================================== */

const LoadingSpinnerComponent = forwardRef<HTMLDivElement, AppLoadingSpinnerProps>(
  function LoadingSpinnerComponent(
    props: AppLoadingSpinnerProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    // data-testid обрабатывается отдельно с дефолтным значением
    const domProps = omit(props, [...BUSINESS_PROPS, 'data-testid']);

    const {
      variant,
      size,
      color,
      ...filteredCoreProps
    } = domProps;

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabelValue = useMemo<string | undefined>(() => {
      if ('ariaLabelI18nKey' in props) {
        const effectiveNs = props.ariaLabelI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelI18nKey,
          props.ariaLabelI18nParams ?? EMPTY_PARAMS,
        );
      }
      return domProps['aria-label'];
    }, [props, translate, domProps]);

    const policy = useLoadingSpinnerPolicy(props);

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => ({
      ...(variant !== undefined && { variant }),
      ...(size !== undefined && { size: typeof size === 'string' ? size : String(size) }),
    }), [variant, size]);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    // Это архитектурная гарантия
    const lifecyclePayloadRef = useRef<
      {
        mount: LoadingSpinnerTelemetryPayload;
        unmount: LoadingSpinnerTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getLoadingSpinnerPayload(
        LoadingSpinnerTelemetryAction.Mount,
        policy,
        telemetryProps,
      ),
      unmount: getLoadingSpinnerPayload(
        LoadingSpinnerTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Payload для show telemetry
    // visible=true является производной от policy, а не сырых props
    const showPayload = useMemo(
      () => ({
        ...getLoadingSpinnerPayloadBase(LoadingSpinnerTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    // Payload для hide telemetry
    // visible=false является производной от policy, а не сырых props
    const hidePayload = useMemo(
      () => ({
        ...getLoadingSpinnerPayloadBase(LoadingSpinnerTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitLoadingSpinnerTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitLoadingSpinnerTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    // Telemetry для видимости - only on changes, not on mount
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    // DRY функция для отправки visibility telemetry
    // Отправляет telemetry только при фактическом изменении видимости
    const emitVisibilityTelemetry = useCallback(
      (prevVisibility: boolean | undefined, currentVisibility: boolean): void => {
        if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
          emitLoadingSpinnerTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
        }
      },
      [showPayload, hidePayload, telemetry],
    );

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      emitVisibilityTelemetry(prevVisibility, currentVisibility);

      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, emitVisibilityTelemetry]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    const testId = props['data-testid'] ?? 'core-loading-spinner';

    /**
     * CoreLoadingSpinner получает visible={true} всегда, потому что policy
     * уже учитывает видимость на уровне App-слоя (early return выше).
     * Core primitive не должен повторно проверять visible.
     * data-component='AppLoadingSpinner' используется для telemetry и отладки,
     * позволяя идентифицировать App-обертку в DevTools и логах.
     */
    return (
      <CoreLoadingSpinner
        ref={ref}
        {...(variant !== undefined && { variant })}
        {...(size !== undefined && { size })}
        {...(color !== undefined && { color })}
        {...(ariaLabelValue !== undefined && { 'aria-label': ariaLabelValue })}
        data-component='AppLoadingSpinner'
        data-state='visible'
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-testid={testId}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(variant !== undefined && { 'data-variant': variant })}
        {...filteredCoreProps}
      />
    );
  },
);

LoadingSpinnerComponent.displayName = 'LoadingSpinner';

/**
 * UI-контракт LoadingSpinner компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия спиннера
 * - Корректная обработка accessibility (ARIA)
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректные параметры спиннера
 * - Feature flags применяются корректно к visibility
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * Не допускается:
 * - Использование напрямую core LoadingSpinner компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const LoadingSpinner = memo(LoadingSpinnerComponent);
