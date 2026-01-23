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

import React, { forwardRef, memo, useEffect, useMemo } from 'react';
import type { JSX, Ref } from 'react';

import { Breadcrumbs as CoreBreadcrumbs } from '../../../ui-core/src/components/Breadcrumbs.js';
import type {
  BreadcrumbItem,
  CoreBreadcrumbsProps,
} from '../../../ui-core/src/components/Breadcrumbs.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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

export type AppBreadcrumbsProps = Readonly<
  Omit<CoreBreadcrumbsProps, 'data-testid'> & {
    /** Видимость Breadcrumbs (App policy). Default = false (hidden) */
    visible?: boolean;

    /** Feature flag: скрыть Breadcrumbs */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

/** Обогащенный элемент breadcrumbs с App-уровнем логики */
export type AppBreadcrumbItem = CoreBreadcrumbsProps['items'][number];

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type BreadcrumbsPolicy = Readonly<{
  hidden: boolean;
  isVisible: boolean;
  telemetryEnabled: boolean;
}>;

function useBreadcrumbsPolicy(props: AppBreadcrumbsProps): BreadcrumbsPolicy {
  const hiddenByFlag = useFeatureFlag(props.isHiddenByFeatureFlag ?? false);

  return useMemo(() => ({
    hidden: hiddenByFlag,
    isVisible: !hiddenByFlag,
    telemetryEnabled: props.telemetryEnabled !== false,
  }), [hiddenByFlag, props.telemetryEnabled]);
}

/* ============================================================================
 * 🎣 CUSTOM HOOKS
 * ========================================================================== */

function useBreadcrumbsItems(
  items: readonly BreadcrumbItem[],
  telemetryEnabled: boolean,
  hidden: boolean,
  visible: boolean,
): readonly BreadcrumbItem[] {
  // Optional optimization: если items часто меняются, можно добавить JSON.stringify(items) в зависимости
  // useMemo(() => ..., [items, telemetryEnabled, hidden, visible, JSON.stringify(items)])
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
          if (telemetryEnabled) {
            const clickPayload = getBreadcrumbsPayload(
              BreadcrumbsTelemetryAction.Click,
              hidden,
              visible,
              items.length,
              index,
              item.label,
            );
            emitBreadcrumbsTelemetry(clickPayload);
          }

          // Вызываем оригинальный обработчик
          originalOnClick(event);
        },
      };
    });
  }, [items, telemetryEnabled, hidden, visible]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitBreadcrumbsTelemetry(payload: BreadcrumbsTelemetryPayload): void {
  infoFireAndForget(`Breadcrumbs ${payload.action}`, payload);
}

function getBreadcrumbsPayload(
  action: BreadcrumbsTelemetryAction,
  hidden: boolean,
  visible: boolean,
  itemsCount: number,
  itemIndex?: number,
  itemLabel?: string,
): BreadcrumbsTelemetryPayload {
  return {
    component: 'Breadcrumbs',
    action,
    hidden,
    visible,
    itemsCount,
    ...(itemIndex !== undefined && { itemIndex }),
    ...(itemLabel !== undefined && { itemLabel }),
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
    const { visible = false, items, ...coreProps } = props;
    const policy = useBreadcrumbsPolicy(props);

    // Payload'ы вычисляются прямо в useEffect для оптимизации

    // Обогащаем items telemetry обработчиками через custom hook
    const enrichedItems = useBreadcrumbsItems(
      items,
      policy.telemetryEnabled,
      policy.hidden,
      visible,
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const mountPayload = getBreadcrumbsPayload(
        BreadcrumbsTelemetryAction.Mount,
        policy.hidden,
        visible,
        items.length,
      );
      emitBreadcrumbsTelemetry(mountPayload);

      return (): void => {
        const unmountPayload = getBreadcrumbsPayload(
          BreadcrumbsTelemetryAction.Unmount,
          policy.hidden,
          visible,
          items.length,
        );
        emitBreadcrumbsTelemetry(unmountPayload);
      };
    }, [policy.telemetryEnabled, policy.hidden, visible, items.length]);

    /** Telemetry для видимости */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      if (visible) {
        const showPayload = getBreadcrumbsPayload(
          BreadcrumbsTelemetryAction.Show,
          policy.hidden,
          true,
          items.length,
        );
        emitBreadcrumbsTelemetry(showPayload);
      } else {
        const hidePayload = getBreadcrumbsPayload(
          BreadcrumbsTelemetryAction.Hide,
          policy.hidden,
          false,
          items.length,
        );
        emitBreadcrumbsTelemetry(hidePayload);
      }
    }, [visible, policy.telemetryEnabled, policy.hidden, items]);

    /** Policy: hidden (accessibility: элемент полностью удаляется из DOM) */
    if (!policy.isVisible) return null;

    return (
      <CoreBreadcrumbs
        ref={ref}
        items={enrichedItems}
        data-component='AppBreadcrumbs'
        data-state={visible ? 'visible' : 'hidden'} // internal / telemetry & CSS hooks only, не публичное API
        data-feature-flag={policy.hidden ? 'hidden' : 'visible'} // internal / e2e-тесты only, не публичное API
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
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
 */
export const Breadcrumbs = memo(BreadcrumbsComponent);
