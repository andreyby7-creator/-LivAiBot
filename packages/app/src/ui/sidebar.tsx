/**
 * @file packages/app/src/ui/sidebar.tsx
 * ============================================================================
 * 🟥 APP UI SIDEBAR — UI МИКРОСЕРВИС SIDEBAR
 * ============================================================================
 * Единственная точка входа для SideBar в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility / collapsed)
 * - Telemetry
 * - Feature flags
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * Архитектурные решения:
 * - Управление состоянием свернутости и событиями обрабатывается в App слое
 * - CoreSideBar остается полностью presentational
 */

import type { JSX, Ref } from 'react';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';

import type { CoreSideBarProps } from '@livai/ui-core';
import { SideBar as CoreSideBar } from '@livai/ui-core';

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

/** Алиас для UI feature flags в контексте sidebar wrapper */
export type SidebarUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте sidebar */
export type SidebarWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте sidebar */
export type SidebarMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

const SideBarTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  Show: 'show',
  Hide: 'hide',
  Toggle: 'toggle',
  ItemClick: 'itemClick',
} as const;

type SideBarTelemetryAction = typeof SideBarTelemetryAction[keyof typeof SideBarTelemetryAction];

/** Позиции sidebar для telemetry payload с максимальной type-safety */
const SideBarPosition = ['left', 'right'] as const;
type SideBarPosition = typeof SideBarPosition[number];

type SideBarTelemetryPayload = {
  component: 'SideBar';
  action: SideBarTelemetryAction;
  hidden: boolean;
  visible: boolean;
  collapsed: boolean;
  itemsCount: number;
  position?: SideBarPosition;
  itemId?: string;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppSideBarProps = Readonly<
  & Omit<CoreSideBarProps, 'onItemClick' | 'data-testid' | 'aria-label'>
  & {
    /** Видимость SideBar (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть SideBar */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: свернуть SideBar */
    isCollapsedByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при клике на элемент */
    onItemClick?: (itemId: string) => void;

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
  'isCollapsedByFeatureFlag',
  'telemetryEnabled',
  'collapsedWidth',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type SideBarPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly collapsedByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly isCollapsed: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * SideBarPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - collapsed state
 * Ни один consumer не имеет права повторно интерпретировать props.visible,
 * props.collapsed или feature flags.
 */
function useSideBarPolicy(props: AppSideBarProps): SideBarPolicy {
  const hiddenByFeatureFlag = Boolean(props.isHiddenByFeatureFlag);
  const collapsedByFeatureFlag = Boolean(props.isCollapsedByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFeatureFlag && props.visible !== false;
    const isCollapsed = collapsedByFeatureFlag || props.collapsed === true;
    return {
      hiddenByFeatureFlag,
      collapsedByFeatureFlag,
      isRendered,
      isCollapsed,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [
    hiddenByFeatureFlag,
    collapsedByFeatureFlag,
    props.visible,
    props.collapsed,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitSideBarTelemetry(telemetry: UiTelemetryApi, payload: SideBarTelemetryPayload): void {
  telemetry.infoFireAndForget(`SideBar ${payload.action}`, payload);
}

/**
 * Базовое формирование payload для SideBar telemetry (без visible).
 * visible добавляется явно в show/hide payload для семантической чистоты.
 */
function getSideBarPayloadBase(
  action: SideBarTelemetryAction,
  policy: SideBarPolicy,
  telemetryProps: {
    itemsCount: number;
    position: SideBarPosition;
    itemId?: string;
  },
): Omit<SideBarTelemetryPayload, 'visible'> {
  return {
    component: 'SideBar',
    action,
    hidden: policy.hiddenByFeatureFlag,
    collapsed: policy.isCollapsed,
    itemsCount: telemetryProps.itemsCount,
    position: telemetryProps.position,
    ...(telemetryProps.itemId !== undefined && { itemId: telemetryProps.itemId }),
  };
}

/**
 * Формирование payload для SideBar telemetry (для lifecycle events).
 * Использует policy.isRendered для visible.
 */
function getSideBarPayload(
  action: SideBarTelemetryAction,
  policy: SideBarPolicy,
  telemetryProps: {
    itemsCount: number;
    position: SideBarPosition;
    itemId?: string;
  },
): SideBarTelemetryPayload {
  return {
    ...getSideBarPayloadBase(action, policy, telemetryProps),
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP SIDEBAR
 * ========================================================================== */

const SideBarComponent = forwardRef<HTMLDivElement, AppSideBarProps>(
  function SideBarComponent(props: AppSideBarProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    const policy = useSideBarPolicy(props);

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
      return props['aria-label'];
    }, [props, translate]);

    const {
      items: itemsProp,
      onItemClick,
      position = 'left',
      ...additionalProps
    } = domProps;
    const items = itemsProp ?? [];

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => ({
      itemsCount: items.length,
      position,
    }), [items.length, position]);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    const lifecyclePayloadRef = useRef<
      {
        mount: SideBarTelemetryPayload;
        unmount: SideBarTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getSideBarPayload(SideBarTelemetryAction.Mount, policy, telemetryProps),
      unmount: getSideBarPayload(SideBarTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getSideBarPayloadBase(SideBarTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getSideBarPayloadBase(SideBarTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    // Предыдущее состояние свернутости для telemetry toggle
    const prevCollapsedRef = useRef<boolean | undefined>(policy.isCollapsed);

    // Обработчик клика на элемент с telemetry
    const handleItemClick = useCallback(
      (itemId: string): void => {
        if (policy.telemetryEnabled) {
          const itemClickPayload = getSideBarPayload(
            SideBarTelemetryAction.ItemClick,
            policy,
            {
              itemsCount: items.length,
              position,
              itemId,
            },
          );
          emitSideBarTelemetry(telemetry, itemClickPayload);
        }

        onItemClick?.(itemId);
      },
      [policy, items.length, position, onItemClick, telemetry],
    );

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitSideBarTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitSideBarTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    // Telemetry для видимости - only on changes, not on mount
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitSideBarTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    // Telemetry для свернутости - only on changes, not on mount
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentCollapsed = policy.isCollapsed;
      const prevCollapsed = prevCollapsedRef.current;

      // Emit only on actual collapsed changes, not on mount
      if (prevCollapsed !== undefined && prevCollapsed !== currentCollapsed) {
        const togglePayload = getSideBarPayload(
          SideBarTelemetryAction.Toggle,
          policy,
          telemetryProps,
        );
        emitSideBarTelemetry(telemetry, togglePayload);
      }

      prevCollapsedRef.current = currentCollapsed;
    }, [policy, telemetryProps, telemetry]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    const testId = props['data-testid'] ?? 'core-sidebar';

    return (
      <CoreSideBar
        ref={ref}
        items={items}
        onItemClick={handleItemClick}
        collapsed={policy.isCollapsed}
        position={position}
        data-component='AppSideBar'
        data-state='visible'
        data-position={position}
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        aria-label={ariaLabel}
        {...additionalProps}
        data-testid={testId}
      />
    );
  },
);

SideBarComponent.displayName = 'SideBar';

/**
 * UI-контракт SideBar компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и свертывания
 * - Корректная обработка accessibility (ARIA)
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректное количество элементов
 * - Feature flags применяются корректно к visibility и collapsed
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - ItemClick telemetry отправляется при каждом клике на элемент
 * - Toggle telemetry отправляется при изменении состояния свернутости
 * Не допускается:
 * - Использование напрямую core SideBar компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible или props.collapsed напрямую вне policy
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <SideBar
 *   items={[
 *     { id: '1', label: 'Dashboard', icon: <Icon /> },
 *     { id: '2', label: 'Settings', icon: <Icon /> },
 *   ]}
 *   onItemClick={(id) => console.log('Clicked:', id)}
 * />
 * // С feature flags и telemetry
 * <SideBar
 *   items={items}
 *   onItemClick={handleItemClick}
 *   visible={isSidebarVisible}
 *   collapsed={isCollapsed}
 *   isHiddenByFeatureFlag={!featureFlags.sidebarEnabled}
 *   isCollapsedByFeatureFlag={featureFlags.sidebarCollapsed}
 *   telemetryEnabled={true}
 *   position="left"
 * />
 * ```
 */
export const SideBar = memo(SideBarComponent);
