/**
 * @file packages/app/src/ui/breadcrumbs.tsx
 * ============================================================================
 * 🟥 APP UI BREADCRUMBS — UI МИКРОСЕРВИС BREADCRUMBS
 * ============================================================================
 *
 * Единственная точка входа для Breadcrumbs в приложении.
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
 * - Навигация, routing и клики обрабатываются в App слое
 * - CoreBreadcrumbs остается полностью presentational
 */

import React, { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { Breadcrumbs as CoreBreadcrumbs } from '../../../ui-core/src/components/Breadcrumbs.js';
import type {
  BreadcrumbItem,
  CoreBreadcrumbsProps,
} from '../../../ui-core/src/components/Breadcrumbs.js';
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

/** Алиас для UI feature flags в контексте breadcrumbs wrapper */
export type BreadcrumbsUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте breadcrumbs */
export type BreadcrumbsWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте breadcrumbs */
export type BreadcrumbsMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

enum BreadcrumbsTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
  Click = 'click',
}

type BreadcrumbsTelemetryPayload = {
  component: 'Breadcrumbs';
  action: BreadcrumbsTelemetryAction;
  hidden: boolean;
  visible: boolean;
  itemsCount: number;
  itemIndex?: number;
  itemLabel?: string;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppBreadcrumbsProps = Readonly<
  & Omit<CoreBreadcrumbsProps, 'data-testid' | 'aria-label' | 'aria-labelledby'>
  & {
    /** Видимость Breadcrumbs (App policy). Default = false (hidden) */
    visible?: boolean;

    /** Feature flag: скрыть Breadcrumbs */
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
  & (
    | {
      /** I18n aria-labelledby режим */
      ariaLabelledByI18nKey: TranslationKey;
      ariaLabelledByI18nNs?: Namespace;
      ariaLabelledByI18nParams?: Record<string, string | number>;
      'aria-labelledby'?: never;
    }
    | {
      /** Обычный aria-labelledby режим */
      ariaLabelledByI18nKey?: never;
      ariaLabelledByI18nNs?: never;
      ariaLabelledByI18nParams?: never;
      'aria-labelledby'?: string;
    }
  )
>;

/** Обогащенный элемент breadcrumbs с App-уровнем логики */
export type AppBreadcrumbItem = CoreBreadcrumbsProps['items'][number];

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
  'ariaLabelledByI18nKey',
  'ariaLabelledByI18nNs',
  'ariaLabelledByI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type BreadcrumbsPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * BreadcrumbsPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useBreadcrumbsPolicy(props: AppBreadcrumbsProps): BreadcrumbsPolicy {
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
 * 🎣 CUSTOM HOOKS
 * ========================================================================== */

function useBreadcrumbsItems(
  items: readonly BreadcrumbItem[],
  policy: BreadcrumbsPolicy,
  telemetry: UiTelemetryApi,
): readonly BreadcrumbItem[] {
  // Optional optimization: если items часто меняются, можно добавить JSON.stringify(items) в зависимости
  // useMemo(() => ..., [items, policy, JSON.stringify(items)])
  return useMemo(() => {
    return items.map((item, index): BreadcrumbItem => {
      const originalOnClick = item.onClick;
      if (!originalOnClick || item.disabled === true) {
        return item; // Возвращаем без изменений если нет обработчика или disabled
      }

      return {
        ...item,
        onClick: (event: React.MouseEvent<HTMLAnchorElement>): void => {
          // Telemetry для кликов
          if (policy.telemetryEnabled) {
            const clickPayload = getBreadcrumbsPayload(
              BreadcrumbsTelemetryAction.Click,
              policy,
              {
                itemsCount: items.length,
                itemIndex: index,
                itemLabel: item.label,
              },
            );
            emitBreadcrumbsTelemetry(telemetry, clickPayload);
          }

          // Вызываем оригинальный обработчик
          originalOnClick(event);
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, policy]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitBreadcrumbsTelemetry(
  telemetry: UiTelemetryApi,
  payload: BreadcrumbsTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`Breadcrumbs ${payload.action}`, payload);
}

/**
 * Формирование payload для Breadcrumbs telemetry.
 */
function getBreadcrumbsPayload(
  action: BreadcrumbsTelemetryAction,
  policy: BreadcrumbsPolicy,
  telemetryProps: {
    itemsCount: number;
    itemIndex?: number;
    itemLabel?: string;
  },
): BreadcrumbsTelemetryPayload {
  return {
    component: 'Breadcrumbs',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    itemsCount: telemetryProps.itemsCount,
    ...(telemetryProps.itemIndex !== undefined && { itemIndex: telemetryProps.itemIndex }),
    ...(telemetryProps.itemLabel !== undefined && { itemLabel: telemetryProps.itemLabel }),
  };
}

/* ============================================================================
 * 🎯 APP BREADCRUMBS
 * ========================================================================== */

const BreadcrumbsComponent = forwardRef<HTMLElement, AppBreadcrumbsProps>(
  function BreadcrumbsComponent(
    props: AppBreadcrumbsProps,
    ref: Ref<HTMLElement>,
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

    // Aria-labelledby: i18n → обычный aria-labelledby → undefined
    const ariaLabelledBy = useMemo<string | undefined>(() => {
      if ('ariaLabelledByI18nKey' in props) {
        const effectiveNs = props.ariaLabelledByI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelledByI18nKey,
          props.ariaLabelledByI18nParams ?? EMPTY_PARAMS,
        );
      }
      return domProps['aria-labelledby'];
    }, [props, translate, domProps]);

    const { items, ...filteredCoreProps } = domProps;
    const policy = useBreadcrumbsPolicy(props);

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => ({
      itemsCount: items.length,
    }), [items.length]);

    // Обогащаем items telemetry обработчиками через custom hook
    const enrichedItems = useBreadcrumbsItems(items, policy, telemetry);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    // Это архитектурная гарантия
    const lifecyclePayloadRef = useRef<
      {
        mount: BreadcrumbsTelemetryPayload;
        unmount: BreadcrumbsTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getBreadcrumbsPayload(
        BreadcrumbsTelemetryAction.Mount,
        policy,
        telemetryProps,
      ),
      unmount: getBreadcrumbsPayload(
        BreadcrumbsTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitBreadcrumbsTelemetry(telemetry, lifecyclePayload.mount);

      return (): void => {
        emitBreadcrumbsTelemetry(telemetry, lifecyclePayload.unmount);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Visibility telemetry - only on changes, not on mount
    const showPayload = useMemo(
      () => ({
        ...getBreadcrumbsPayload(
          BreadcrumbsTelemetryAction.Show,
          policy,
          telemetryProps,
        ),
        visible: true,
      }),
      [policy, telemetryProps],
    );
    const hidePayload = useMemo(
      () => ({
        ...getBreadcrumbsPayload(
          BreadcrumbsTelemetryAction.Hide,
          policy,
          telemetryProps,
        ),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    const prevVisibilityRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibilityRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitBreadcrumbsTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      prevVisibilityRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    // Policy: hidden (accessibility: элемент полностью удаляется из DOM)
    if (!policy.isRendered) return null;

    return (
      <CoreBreadcrumbs
        ref={ref}
        items={enrichedItems}
        data-component='AppBreadcrumbs'
        data-state='visible' // internal / telemetry & CSS hooks only, не публичное API
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'} // internal / e2e-тесты only, не публичное API
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        {...filteredCoreProps}
      />
    );
  },
);

BreadcrumbsComponent.displayName = 'Breadcrumbs';

/**
 * Memoized App Breadcrumbs с ref forwarding.
 *
 * Подходит для:
 * - UI хлебных крошек
 * - workflow
 * - design-system интеграций
 *
 * Гарантии:
 * - Чёткое разделение Core и App слоёв
 * - Централизованная telemetry
 * - Управление feature flags в одном месте
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование props.visible напрямую вне policy
 */
export const Breadcrumbs = memo(BreadcrumbsComponent);
