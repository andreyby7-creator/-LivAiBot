/**
 * @file packages/app/src/ui/tabs.tsx
 * ============================================================================
 * 🟥 APP UI TABS — UI МИКРОСЕРВИС TABS
 * ============================================================================
 *
 * Единственная точка входа для Tabs в приложении.
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
 * - Управление активным табом и событиями обрабатывается в App слое
 * - CoreTabs остается полностью presentational
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, MouseEvent, Ref } from 'react';

import { Tabs as CoreTabs } from '../../../ui-core/src/components/Tabs.js';
import type { CoreTabsProps } from '../../../ui-core/src/components/Tabs.js';
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

enum TabsTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
  Change = 'change',
}

type TabsTelemetryPayload = {
  component: 'Tabs';
  action: TabsTelemetryAction;
  hidden: boolean;
  visible: boolean;
  tabsCount: number;
  activeTabId?: string;
  previousTabId?: string;
  orientation?: 'horizontal' | 'vertical';
};

export type AppTabsProps = Readonly<
  Omit<CoreTabsProps, 'onChange' | 'data-testid'> & {
    /** Видимость Tabs (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть Tabs */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при изменении активного таба */
    onChange?: (tabId: string, event: MouseEvent<HTMLButtonElement>) => void;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'visible',
  'onChange', // обрабатывается отдельно
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type TabsPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

// TabsPolicy является единственным источником истины для:
// - DOM rendering
// - telemetry
// - visibility state
//
// Ни один consumer не имеет права повторно интерпретировать props.visible
// или feature flags.
function useTabsPolicy(props: AppTabsProps): TabsPolicy {
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

function emitTabsTelemetry(payload: TabsTelemetryPayload): void {
  infoFireAndForget(`Tabs ${payload.action}`, payload);
}

// Базовое формирование payload для Tabs telemetry (без visible)
// visible добавляется явно в show/hide payload для семантической чистоты
function getTabsPayloadBase(
  action: TabsTelemetryAction,
  policy: TabsPolicy,
  telemetryProps: {
    tabsCount: number;
    activeTabId?: string;
    previousTabId?: string;
    orientation?: 'horizontal' | 'vertical';
  },
): Omit<TabsTelemetryPayload, 'visible'> {
  return {
    component: 'Tabs',
    action,
    hidden: policy.hiddenByFeatureFlag,
    tabsCount: telemetryProps.tabsCount,
    ...(telemetryProps.activeTabId !== undefined && { activeTabId: telemetryProps.activeTabId }),
    ...(telemetryProps.previousTabId !== undefined
      && { previousTabId: telemetryProps.previousTabId }),
    ...(telemetryProps.orientation !== undefined && { orientation: telemetryProps.orientation }),
  };
}

// Формирование payload для Tabs telemetry (для lifecycle events)
// Использует policy.isRendered для visible
function getTabsPayload(
  action: TabsTelemetryAction,
  policy: TabsPolicy,
  telemetryProps: {
    tabsCount: number;
    activeTabId?: string;
    previousTabId?: string;
    orientation?: 'horizontal' | 'vertical';
  },
): TabsTelemetryPayload {
  return {
    ...getTabsPayloadBase(action, policy, telemetryProps),
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP TABS
 * ========================================================================== */

const TabsComponent = forwardRef<HTMLDivElement, AppTabsProps>(
  function TabsComponent(props: AppTabsProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const policy = useTabsPolicy(props);

    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const {
      items,
      activeTabId,
      onChange,
      orientation,
    } = props;

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => ({
      tabsCount: items.length,
      ...(activeTabId !== undefined && { activeTabId }),
      ...(orientation !== undefined && { orientation }),
    }), [items.length, activeTabId, orientation]);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    const lifecyclePayloadRef = useRef<
      {
        mount: TabsTelemetryPayload;
        unmount: TabsTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getTabsPayload(TabsTelemetryAction.Mount, policy, telemetryProps),
      unmount: getTabsPayload(TabsTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getTabsPayloadBase(TabsTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getTabsPayloadBase(TabsTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    /** Предыдущий активный таб для telemetry change */
    const prevActiveTabIdRef = useRef<string | undefined>(activeTabId);

    /** Обработчик изменения таба с telemetry */
    const handleChange = useCallback(
      (tabId: string, event: MouseEvent<HTMLButtonElement>): void => {
        if (policy.telemetryEnabled) {
          const changePayload = getTabsPayload(
            TabsTelemetryAction.Change,
            policy,
            {
              tabsCount: items.length,
              activeTabId: tabId,
              ...(prevActiveTabIdRef.current !== undefined
                && { previousTabId: prevActiveTabIdRef.current }),
              ...(orientation !== undefined && { orientation }),
            },
          );
          emitTabsTelemetry(changePayload);
        }

        // eslint-disable-next-line functional/immutable-data
        prevActiveTabIdRef.current = tabId;

        onChange?.(tabId, event);
      },
      [policy, items.length, orientation, onChange],
    );

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitTabsTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitTabsTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    // Telemetry для видимости - only on changes, not on mount
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitTabsTelemetry(
          currentVisibility ? showPayload : hidePayload,
        );
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreTabs
        ref={ref}
        {...(activeTabId !== undefined && { activeTabId })}
        onChange={handleChange}
        {...(orientation !== undefined && { orientation })}
        data-component='AppTabs'
        data-state='visible'
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...domProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
TabsComponent.displayName = 'Tabs';

/**
 * UI-контракт Tabs компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия табов
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректное количество табов
 * - Feature flags применяются корректно к visibility
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Change telemetry отправляется при каждом изменении активного таба
 *
 * Не допускается:
 * - Использование напрямую core Tabs компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Tabs = memo(TabsComponent);
