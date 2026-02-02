/**
 * @file packages/app/src/ui/loading-spinner.tsx
 * ============================================================================
 * 🟥 APP UI LOADING SPINNER — UI МИКРОСЕРВИС LOADING SPINNER
 * ============================================================================
 *
 * Единственная точка входа для Loading Spinner в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 *
 * Архитектурные решения:
 * - Управление видимостью и параметрами обрабатывается в App слое
 * - CoreLoadingSpinner остается полностью presentational
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { LoadingSpinner as CoreLoadingSpinner } from '../../../ui-core/src/primitives/loading-spinner.js';
import type { CoreLoadingSpinnerProps } from '../../../ui-core/src/primitives/loading-spinner.js';
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

export type AppLoadingSpinnerProps = Readonly<
  Omit<CoreLoadingSpinnerProps, 'data-testid'> & {
    /** Видимость Loading Spinner (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть Loading Spinner */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

// Бизнес-пропсы, которые не должны попадать в DOM
// aria-label контролируется App-слоем для ARIA трансформации
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'aria-label',
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
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 *
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

function emitLoadingSpinnerTelemetry(payload: LoadingSpinnerTelemetryPayload): void {
  infoFireAndForget(`LoadingSpinner ${payload.action}`, payload);
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
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const {
      variant,
      size,
      color,
      ...filteredCoreProps
    } = domProps;

    // aria-label - бизнес-проп, берем из оригинальных props
    const { 'aria-label': ariaLabel } = props;
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

    // eslint-disable-next-line functional/immutable-data
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

      emitLoadingSpinnerTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitLoadingSpinnerTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    // Telemetry для видимости - only on changes, not on mount
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    // DRY функция для отправки visibility telemetry
    // Отправляет telemetry только при фактическом изменении видимости
    const emitVisibilityTelemetry = useCallback(
      (prevVisibility: boolean | undefined, currentVisibility: boolean): void => {
        if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
          emitLoadingSpinnerTelemetry(
            currentVisibility ? showPayload : hidePayload,
          );
        }
      },
      [showPayload, hidePayload],
    );

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      emitVisibilityTelemetry(prevVisibility, currentVisibility);

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, emitVisibilityTelemetry]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    /**
     * CoreLoadingSpinner получает visible={true} всегда, потому что policy
     * уже учитывает видимость на уровне App-слоя (early return выше).
     * Core primitive не должен повторно проверять visible.
     *
     * data-component='AppLoadingSpinner' используется для telemetry и отладки,
     * позволяя идентифицировать App-обертку в DevTools и логах.
     */
    return (
      <CoreLoadingSpinner
        ref={ref}
        {...(variant !== undefined && { variant })}
        {...(size !== undefined && { size })}
        {...(color !== undefined && { color })}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        data-component='AppLoadingSpinner'
        data-state='visible'
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(variant !== undefined && { 'data-variant': variant })}
        {...filteredCoreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
LoadingSpinnerComponent.displayName = 'LoadingSpinner';

/**
 * UI-контракт LoadingSpinner компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия спиннера
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректные параметры спиннера
 * - Feature flags применяются корректно к visibility
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование напрямую core LoadingSpinner компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const LoadingSpinner = memo(LoadingSpinnerComponent);
