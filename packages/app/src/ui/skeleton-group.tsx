/**
 * @file packages/app/src/ui/skeleton-group.tsx
 * ============================================================================
 * 🟥 APP UI SKELETON GROUP — UI МИКРОСЕРВИС КОМПОЗИЦИИ SKELETON
 * ============================================================================
 * SkeletonGroup — эталонный композиционный UI-микросервис для массового
 * рендера Skeleton элементов как единой логической группы.
 * Архитектурное место:
 *   CoreSkeleton   → атом (ui-core)
 *   Skeleton       → одиночный UI-микросервис (app/ui)
 *   SkeletonGroup  → композиционный UI-микросервис (app/ui)
 * Назначение:
 * - Рендер N Skeleton элементов
 * - Полный централизованный контроль:
 *   - visibility / hidden policy
 *   - feature flags
 *   - shimmer-анимации
 *   - telemetry (один event вместо N)
 * Ключевые гарантии:
 * - Нет telemetry-spam
 * - Синхронная shimmer-анимация всей группы
 * - Предсказуемое поведение в SSR / Concurrent React
 * - Чёткое разделение слоёв ответственности
 * Не содержит:
 * - Бизнес-логики
 * - Таймеров
 * - Побочных эффектов, кроме fire-and-forget telemetry
 * - DOM-манипуляций вне декларативного React
 */

import type { SkeletonVariant } from '@livai/ui-core';
import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, JSX, Ref } from 'react';

import { Skeleton as AppSkeleton } from './skeleton.js';
import type { AppSkeletonProps } from './skeleton.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { UiTelemetryApi } from '../types/ui-contracts.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/**
 * Telemetry actions для SkeletonGroup.
 * В отличие от Skeleton, события агрегированы и не дублируются на каждый элемент.
 */
enum SkeletonGroupTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

/**
 * Payload для telemetry SkeletonGroup.
 * telemetryId обязателен в production:
 * это ключ агрегации метрик и анализа UX.
 * Payload всегда полностью описывает визуальное состояние.
 */
type SkeletonGroupTelemetryPayload = {
  component: 'SkeletonGroup';
  action: SkeletonGroupTelemetryAction;
  hidden: boolean;
  visible: boolean;
  count: number;
  telemetryId: string;
  variant?: SkeletonVariant;
  animated: boolean;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/**
 * App props для SkeletonGroup.
 * ⚠️ telemetryId обязателен.
 * Без него SkeletonGroup считается архитектурно неполноценным.
 */
export type AppSkeletonGroupProps = Readonly<
  & {
    /**
     * Количество Skeleton элементов.
     * Может быть любым числом, SkeletonGroup сам нормализует его в safeCount ≥ 0.
     */
    count: number;

    /** Вариант формы Skeleton */
    variant?: SkeletonVariant;

    /** Ширина Skeleton */
    width?: AppSkeletonProps['width'];

    /** Высота Skeleton */
    height?: AppSkeletonProps['height'];

    /** Расстояние между Skeleton элементами (px) */
    gap?: number;

    /** Видимость SkeletonGroup (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть всю группу Skeleton */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Включить shimmer-анимацию для всей группы */
    animated?: boolean;

    /**
     * Логический идентификатор группы для telemetry.
     * Примеры:
     * - "users-list"
     * - "products-table"
     * - "dashboard-cards"
     */
    telemetryId: string;

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

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type SkeletonGroupPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
  readonly animated: boolean;
}>;

/**
 * SkeletonGroupPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - shimmer-анимации
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useSkeletonGroupPolicy(props: AppSkeletonGroupProps): SkeletonGroupPolicy {
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
 * Отправка telemetry SkeletonGroup.
 * Fire-and-forget, без ожиданий и побочных эффектов.
 */
function emitSkeletonGroupTelemetry(
  telemetry: UiTelemetryApi,
  payload: SkeletonGroupTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`SkeletonGroup ${payload.action}`, payload);
}

/**
 * Формирование payload для SkeletonGroup telemetry.
 */
function getSkeletonGroupPayload(
  action: SkeletonGroupTelemetryAction,
  policy: SkeletonGroupPolicy,
  telemetryProps: {
    count: number;
    telemetryId: string;
    variant?: SkeletonVariant | undefined;
  },
): SkeletonGroupTelemetryPayload {
  return {
    component: 'SkeletonGroup',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    count: telemetryProps.count,
    telemetryId: telemetryProps.telemetryId,
    ...(telemetryProps.variant !== undefined && { variant: telemetryProps.variant }),
    animated: policy.animated,
  };
}

/* ============================================================================
 * 🎨 STYLES
 * ========================================================================== */

/** Default gap between skeleton elements (px) */
const DEFAULT_GAP = 8;

/**
 * Контейнер SkeletonGroup.
 * По умолчанию используется вертикальный layout,
 * так как основной use-case — списки и таблицы.
 */
function getGroupStyle(gap: number | undefined): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: gap ?? DEFAULT_GAP,
  };
}

/* ============================================================================
 * 🎯 APP SKELETON GROUP
 * ========================================================================== */

const SkeletonGroupComponent = forwardRef<HTMLDivElement, AppSkeletonGroupProps>(
  function SkeletonGroupComponent(
    props: AppSkeletonGroupProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    const {
      count,
      variant,
      width,
      height,
      gap = DEFAULT_GAP,
      telemetryId,
      ...rest
    } = props;

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
      return props['aria-label'];
    }, [props, translate]);

    const policy = useSkeletonGroupPolicy(props);

    /** Защита от count <= 0 для математической корректности */
    const safeCount = Math.max(0, count);

    /** Минимальный набор telemetry-данных */
    const telemetryProps = useMemo(() => ({
      count: safeCount,
      telemetryId,
      variant,
    }), [safeCount, telemetryId, variant]);

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: SkeletonGroupTelemetryPayload;
        unmount: SkeletonGroupTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getSkeletonGroupPayload(SkeletonGroupTelemetryAction.Mount, policy, telemetryProps),
      unmount: getSkeletonGroupPayload(
        SkeletonGroupTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    /* ---------------- TELEMETRY: VISIBILITY ---------------- */

    const showPayload = useMemo(
      () => getSkeletonGroupPayload(SkeletonGroupTelemetryAction.Show, policy, telemetryProps),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => getSkeletonGroupPayload(SkeletonGroupTelemetryAction.Hide, policy, telemetryProps),
      [policy, telemetryProps],
    );

    /* ---------------- RENDER ---------------- */

    /**
     * Критический архитектурный момент:
     * telemetry для отдельных Skeleton полностью отключена.
     * Вся telemetry агрегируется на уровне SkeletonGroup.
     * SkeletonGroup не проксирует visible/feature flags в дочерние Skeleton.
     */
    const skeletons = useMemo(() => {
      return Array.from({ length: safeCount }).map((_, index) => {
        const skeletonId = `skeleton-${telemetryId}-${index}`;
        return (
          <AppSkeleton
            key={skeletonId}
            {...(variant !== undefined && { variant })}
            {...(width !== undefined && { width })}
            {...(height !== undefined && { height })}
            animated={policy.animated}
            telemetryEnabled={false} // 🔴 строго обязательно
          />
        );
      });
    }, [safeCount, variant, width, height, policy.animated, telemetryId]);

    /* ---------------- TELEMETRY EFFECTS ---------------- */

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitSkeletonGroupTelemetry(telemetry, lifecyclePayload.mount);

      return (): void => {
        emitSkeletonGroupTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    const prevVisibilityRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibilityRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitSkeletonGroupTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      prevVisibilityRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    /* ---------------- POLICY: HIDDEN ---------------- */

    if (!policy.isRendered) return null;

    return (
      <div
        ref={ref}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        data-component='AppSkeletonGroup'
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        data-telemetry-id={telemetryId}
        data-testid={rest['data-testid']}
        style={getGroupStyle(gap)}
      >
        {skeletons}
      </div>
    );
  },
);

SkeletonGroupComponent.displayName = 'SkeletonGroup';

/**
 * UI-контракт SkeletonGroup компонента.
 * @contract
 * Гарантируется:
 * - Один telemetry event на всю группу вместо N отдельных
 * - Синхронная shimmer-анимация для всех элементов группы
 * - Централизованное управление policy и feature flags
 * - SSR-safe и concurrent rendering compatible
 * - Детерминированный рендеринг без side effects
 * - SkeletonGroupPolicy является единственным источником истины для rendering и telemetry
 * - Telemetry никогда не зависит напрямую от props
 * - SkeletonGroup не проксирует visible/feature flags в дочерние Skeleton
 * Инварианты:
 * - Все Skeleton в группе имеют одинаковые размеры и variant
 * - Telemetry payload содержит корректное количество элементов (count >= 0)
 * - Feature flags применяются ко всей группе атомарно
 * - Gap между элементами всегда консистентен
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - data-component всегда начинается с "App" и соответствует имени публичного UI микросервиса
 * - count <= 0 обрабатывается математически корректно (safeCount = Math.max(0, count))
 * Не допускается:
 * - Использование напрямую core Skeleton компонентов
 * - Передача разных variant в одну группу
 * - Игнорирование feature flag логики группы
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 * - Зависимость telemetry от всего объекта props вместо telemetryProps
 */
export const SkeletonGroup = memo(SkeletonGroupComponent);
