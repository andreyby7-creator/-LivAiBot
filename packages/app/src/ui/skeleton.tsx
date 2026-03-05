/**
 * @file packages/app/src/ui/skeleton.tsx
 * ============================================================================
 * 🟥 APP UI SKELETON — UI МИКРОСЕРВИС SKELETON
 * ============================================================================
 * Единственная точка входа для Skeleton в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (видимость / hidden)
 * - Telemetry (fire-and-forget)
 * - Feature flags (скрытие Skeleton)
 * - Контроль shimmer-анимации на App-уровне
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Таймеров или side-effects кроме telemetry
 * Архитектурные решения:
 * - CoreSkeleton остаётся полностью presentational
 * - App слой управляет видимостью, анимацией и telemetry
 */

import type { JSX, Ref } from 'react';
import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';

import type { CoreSkeletonProps, SkeletonVariant } from '@livai/ui-core';
import { Skeleton as CoreSkeleton } from '@livai/ui-core';

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

/** Алиас для UI feature flags в контексте skeleton wrapper */
export type SkeletonUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте skeleton */
export type SkeletonWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте skeleton */
export type SkeletonMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

/** Telemetry actions для Skeleton */
enum SkeletonTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

/**
 * Payload для telemetry Skeleton.
 * Payload всегда полностью описывает визуальное состояние.
 */
type SkeletonTelemetryPayload = {
  component: 'Skeleton';
  action: SkeletonTelemetryAction;
  hidden: boolean;
  visible: boolean;
  width?: string | number;
  height?: string | number;
  variant?: SkeletonVariant;
  animated: boolean;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/** App props для Skeleton */
export type AppSkeletonProps = Readonly<
  & Omit<CoreSkeletonProps, 'data-testid' | 'aria-label'>
  & {
    /** Видимость Skeleton (App policy). Default = true (visible) */
    visible?: boolean;

    /** Feature flag: скрыть Skeleton */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Отключить shimmer-анимацию на App уровне */
    animated?: boolean;

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
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'animated',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type SkeletonPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
  readonly animated: boolean;
}>;

/**
 * SkeletonPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - shimmer-анимации
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 * @param props AppSkeletonProps
 * @returns SkeletonPolicy
 */
function useSkeletonPolicy(props: AppSkeletonProps): SkeletonPolicy {
  const hiddenByFeatureFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFeatureFlag && props.visible !== false;
    return {
      hiddenByFeatureFlag,
      isRendered,
      telemetryEnabled: props.telemetryEnabled !== false,
      animated: props.animated !== false,
    };
  }, [hiddenByFeatureFlag, props.visible, props.telemetryEnabled, props.animated]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

/**
 * Отправка события telemetry Skeleton.
 * Fire-and-forget.
 * @param payload SkeletonTelemetryPayload
 */
function emitSkeletonTelemetry(telemetry: UiTelemetryApi, payload: SkeletonTelemetryPayload): void {
  telemetry.infoFireAndForget(`Skeleton ${payload.action}`, payload);
}

/**
 * Формирование payload для Skeleton telemetry.
 */
function getSkeletonPayload(
  action: SkeletonTelemetryAction,
  policy: SkeletonPolicy,
  telemetryProps: {
    width?: string | number | undefined;
    height?: string | number | undefined;
    variant?: SkeletonVariant | undefined;
  },
): SkeletonTelemetryPayload {
  return {
    component: 'Skeleton',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    ...(telemetryProps.width !== undefined && { width: telemetryProps.width }),
    ...(telemetryProps.height !== undefined && { height: telemetryProps.height }),
    ...(telemetryProps.variant !== undefined && { variant: telemetryProps.variant }),
    animated: policy.animated,
  };
}

/* ============================================================================
 * 🎯 APP SKELETON
 * ========================================================================== */

const SkeletonComponent = forwardRef<HTMLDivElement, AppSkeletonProps>(
  function SkeletonComponent(
    props: AppSkeletonProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabel = useMemo<string | undefined>(() => {
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

    const { width, height, variant, ...filteredCoreProps } = domProps;
    const policy = useSkeletonPolicy(props);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    // Это архитектурная гарантия
    const lifecyclePayloadRef = useRef<
      {
        mount: SkeletonTelemetryPayload;
        unmount: SkeletonTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getSkeletonPayload(
        SkeletonTelemetryAction.Mount,
        policy,
        { width, height, variant },
      ),
      unmount: getSkeletonPayload(
        SkeletonTelemetryAction.Unmount,
        policy,
        { width, height, variant },
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitSkeletonTelemetry(telemetry, lifecyclePayload.mount);

      return (): void => {
        emitSkeletonTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    // Visibility telemetry - only on changes, not on mount
    const showPayload = useMemo(
      () => getSkeletonPayload(SkeletonTelemetryAction.Show, policy, { width, height, variant }),
      [policy, width, height, variant],
    );
    const hidePayload = useMemo(
      () => getSkeletonPayload(SkeletonTelemetryAction.Hide, policy, { width, height, variant }),
      [policy, width, height, variant],
    );

    const prevVisibilityRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibilityRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitSkeletonTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      prevVisibilityRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    // Policy: hidden → полностью удаляем из DOM
    if (!policy.isRendered) return null;

    const testId = props['data-testid'] ?? 'core-skeleton';

    return (
      <CoreSkeleton
        ref={ref}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        data-component='AppSkeleton'
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        animated={policy.animated}
        {...filteredCoreProps}
        data-testid={testId}
      />
    );
  },
);

SkeletonComponent.displayName = 'Skeleton';

/**
 * UI-контракт Skeleton компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия компонента
 * - Контроль анимации на App-уровне
 * Инварианты:
 * - Возвращает null при policy.isRendered = false
 * - Telemetry payload содержит корректные размеры и variant
 * - Feature flags полностью изолированы от Core логики
 * - Анимация shimmer работает только при animated = true
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * Не допускается:
 * - Использование напрямую core Skeleton компонента
 * - Переопределение размеров через CSS вместо props
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Skeleton = memo(SkeletonComponent);
