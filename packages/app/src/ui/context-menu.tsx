/**
 * @file packages/app/src/ui/context-menu.tsx
 * ============================================================================
 * 🟥 APP UI CONTEXT MENU — UI МИКРОСЕРВИС КОНТЕКСТНОГО МЕНЮ
 * ============================================================================
 * Единственная точка входа для ContextMenu в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * Архитектурные решения:
 * - Управление позицией меню и событиями обрабатывается в App слое
 * - CoreContextMenu остается полностью presentational
 * - Используется useIsomorphicLayoutEffect для SSR-safe фокусировки
 * - menuRef передается в Core для прямого доступа к <ul> без DOM querying
 * - Разделение ответственности: policy.isRendered → DOM rendering, isOpen → UX state
 */

import type { CSSProperties, JSX, KeyboardEvent, MouseEvent, Ref } from 'react';
import { forwardRef, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import type { ContextMenuRef, CoreContextMenuProps } from '@livai/ui-core/primitives/context-menu';
import { ContextMenu as CoreContextMenu } from '@livai/ui-core/primitives/context-menu';

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

/**
 * Isomorphic layout effect hook для SSR-safe использования.
 * В SSR использует useEffect, в браузере - useLayoutEffect.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Алиас для UI feature flags в контексте context-menu wrapper */
export type ContextMenuUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте context-menu */
export type ContextMenuWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте context-menu */
export type ContextMenuMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

enum ContextMenuTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
  Select = 'select',
}

type ContextMenuTelemetryPayload = {
  component: 'ContextMenu';
  action: ContextMenuTelemetryAction;
  hidden: boolean;
  visible: boolean;
  itemsCount: number;
  isOpen?: boolean;
  selectedItemId?: string;
  positionX?: number;
  positionY?: number;
};

export type AppContextMenuProps = Readonly<
  & Omit<CoreContextMenuProps, 'onSelect' | 'onEscape' | 'data-testid' | 'style'>
  & {
    /** Видимость ContextMenu (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть ContextMenu */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Позиция меню (x, y координаты) - App-слой управляет позиционированием */
    position?: Readonly<{ x: number; y: number; }>;

    /** Callback для закрытия меню */
    onClose?: () => void;

    /** Callback при выборе элемента */
    onSelect?: (
      itemId: string,
      event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>,
    ) => void;

    /** Test ID для автотестов */
    'data-testid'?: string;

    /** Дополнительные стили (позиционирование передается через position prop) */
    style?: CSSProperties;
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
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type ContextMenuPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * ContextMenuPolicy является единственным источником истины
 * для:
 * - DOM rendering (policy.isRendered определяет, рендерится ли компонент в DOM)
 * - telemetry
 * - visibility state
 * @note policy.isRendered отвечает за видимость компонента (feature flags + visible prop).
 * @note isOpen - это отдельное UI-состояние для управления открытостью меню внутри Core.
 * @note Разделение ответственности: policy.isRendered → DOM rendering, isOpen → UX state.
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 * @note Чистая функция без side-effects. Использует только useMemo для вычислений.
 */
function useContextMenuPolicy(props: AppContextMenuProps): ContextMenuPolicy {
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

function emitContextMenuTelemetry(
  telemetry: UiTelemetryApi,
  payload: ContextMenuTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`ContextMenu ${payload.action}`, payload);
}

/**
 * Базовое формирование payload для ContextMenu telemetry (без visible).
 * visible добавляется явно в show/hide payload для семантической чистоты.
 */
function getContextMenuPayloadBase(
  action: ContextMenuTelemetryAction,
  policy: ContextMenuPolicy,
  telemetryProps: {
    itemsCount: number;
    isOpen?: boolean;
    selectedItemId?: string;
    position?: { x: number; y: number; };
  },
): Omit<ContextMenuTelemetryPayload, 'visible'> {
  return {
    component: 'ContextMenu',
    action,
    hidden: policy.hiddenByFeatureFlag,
    itemsCount: telemetryProps.itemsCount,
    ...(telemetryProps.isOpen !== undefined && { isOpen: telemetryProps.isOpen }),
    ...(telemetryProps.selectedItemId !== undefined
      && { selectedItemId: telemetryProps.selectedItemId }),
    ...(telemetryProps.position !== undefined && {
      positionX: telemetryProps.position.x,
      positionY: telemetryProps.position.y,
    }),
  };
}

/**
 * Формирование payload для ContextMenu telemetry (для lifecycle events).
 * Использует policy.isRendered для visible.
 */
function getContextMenuPayload(
  action: ContextMenuTelemetryAction,
  policy: ContextMenuPolicy,
  telemetryProps: {
    itemsCount: number;
    isOpen?: boolean;
    selectedItemId?: string;
    position?: { x: number; y: number; };
  },
): ContextMenuTelemetryPayload {
  return {
    ...getContextMenuPayloadBase(action, policy, telemetryProps),
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP CONTEXT MENU
 * ========================================================================== */

const ContextMenuComponent = forwardRef<HTMLDivElement, AppContextMenuProps>(
  function ContextMenuComponent(
    props: AppContextMenuProps,
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

    const {
      items,
      isOpen,
      position,
      onSelect,
      onClose,
      'data-component-id': componentId,
      style,
      ...filteredCoreProps
    } = domProps;
    const policy = useContextMenuPolicy(props);

    /** Ref для меню для keyboard navigation и фокусировки */
    const menuRef = useRef<ContextMenuRef | null>(null);

    /** Получаем список доступных элементов меню (без dividers и disabled) */
    const getFocusableMenuItems = useCallback((): HTMLLIElement[] => {
      if (menuRef.current === null) return [];
      // Используем ref-map из Core - 100% без DOM querying, работаем через контракт
      return Array.from(menuRef.current.items);
    }, []);

    /** Навигация по меню с помощью стрелок (App-слой управляет навигацией) */
    const navigateMenu = useCallback(
      (direction: 'up' | 'down', currentElement: HTMLLIElement): void => {
        const focusableItems = getFocusableMenuItems();
        if (focusableItems.length === 0) return;

        const currentIndex = focusableItems.indexOf(currentElement);
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (direction === 'down') {
          nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1;
        }

        const nextItem = focusableItems[nextIndex];
        if (nextItem) {
          nextItem.focus();
        }
      },
      [getFocusableMenuItems],
    );

    /** Минимальный набор telemetry-данных */
    const telemetryProps = useMemo(() => ({
      itemsCount: items.length,
      ...(isOpen !== undefined && { isOpen }),
      ...(position !== undefined && { position }),
    }), [items.length, isOpen, position]);

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: ContextMenuTelemetryPayload;
        unmount: ContextMenuTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getContextMenuPayload(
        ContextMenuTelemetryAction.Mount,
        policy,
        telemetryProps,
      ),
      unmount: getContextMenuPayload(
        ContextMenuTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    /**
     * Payload для show telemetry.
     * visible=true является производной от policy, а не сырых props.
     */
    const showPayload = useMemo(
      () => ({
        ...getContextMenuPayloadBase(ContextMenuTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    /**
     * Payload для hide telemetry.
     * visible=false является производной от policy, а не сырых props.
     */
    const hidePayload = useMemo(
      () => ({
        ...getContextMenuPayloadBase(ContextMenuTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitContextMenuTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitContextMenuTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    /** Telemetry для видимости - only on changes, not on mount */
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    /**
     * DRY функция для отправки visibility telemetry.
     * Отправляет telemetry только при фактическом изменении видимости.
     */
    const emitVisibilityTelemetry = useCallback(
      (prevVisibility: boolean | undefined, currentVisibility: boolean): void => {
        if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
          emitContextMenuTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
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

    /** Обработчик select с telemetry и закрытием меню */
    const handleSelect = useCallback(
      (itemId: string, event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>): void => {
        if (policy.telemetryEnabled) {
          const selectPayload = getContextMenuPayload(
            ContextMenuTelemetryAction.Select,
            policy,
            {
              itemsCount: items.length,
              selectedItemId: itemId,
              ...(isOpen !== undefined && { isOpen }),
              ...(position !== undefined && { position }),
            },
          );
          emitContextMenuTelemetry(telemetry, selectPayload);
        }

        onSelect?.(itemId, event);
        // App-слой решает закрывать ли меню после выбора
        onClose?.();
      },
      [policy, items.length, isOpen, position, onSelect, onClose, telemetry],
    );

    /** Обработчик Escape с закрытием меню */
    const handleEscape = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (_event: KeyboardEvent<HTMLLIElement>): void => {
        // App-слой решает закрывать ли меню при Escape
        onClose?.();
      },
      [onClose],
    );

    /** Обработчик ArrowUp/ArrowDown навигации (App-слой управляет навигацией) */
    const handleArrowNavigation = useCallback(
      (direction: 'up' | 'down', event: KeyboardEvent<HTMLLIElement>): void => {
        navigateMenu(direction, event.currentTarget);
      },
      [navigateMenu],
    );

    /** Фокус на первый элемент меню при открытии (App-слой управляет фокусом) */
    useIsomorphicLayoutEffect(() => {
      if (isOpen === true && menuRef.current !== null) {
        const focusableItems = getFocusableMenuItems();
        const firstItem = focusableItems[0];
        if (firstItem !== undefined) {
          // useIsomorphicLayoutEffect гарантирует SSR-safe поведение
          // В браузере работает как useLayoutEffect (фокус до paint)
          // В SSR работает как useEffect (без предупреждений)
          firstItem.focus();
        }
      }
    }, [isOpen, getFocusableMenuItems]);

    /** Вычисляем стили позиционирования (App-слой управляет позиционированием) */
    const positionStyle: CSSProperties = useMemo(() => {
      if (!position) {
        return {};
      }
      return {
        left: `${position.x}px`,
        top: `${position.y}px`,
      };
    }, [position]);

    /** Стили контейнера с позиционированием */
    const containerStyle: CSSProperties = useMemo(() => ({
      ...positionStyle,
      ...style,
    }), [positionStyle, style]);

    /**
     * CoreContextMenu получает все необходимые пропсы.
     * data-component='AppContextMenu' используется для telemetry и отладки,
     * позволяя идентифицировать App-обертку в DevTools и логах.
     */
    const coreContextMenuProps: CoreContextMenuProps = useMemo(() => ({
      items,
      ...(isOpen !== undefined && { isOpen }),
      ...(ariaLabel !== undefined && { 'aria-label': ariaLabel }),
      onSelect: handleSelect,
      onEscape: handleEscape,
      onArrowNavigation: handleArrowNavigation,
      menuRef,
      ...(componentId !== undefined && { 'data-component-id': componentId }),
      'data-component': 'AppContextMenu',
      'data-state': policy.isRendered ? 'visible' : 'hidden',
      'data-feature-flag': policy.hiddenByFeatureFlag ? 'hidden' : 'visible',
      'data-telemetry': policy.telemetryEnabled ? 'enabled' : 'disabled',
      style: containerStyle,
      ...filteredCoreProps,
    }), [
      items,
      isOpen,
      ariaLabel,
      handleSelect,
      handleEscape,
      handleArrowNavigation,
      menuRef,
      componentId,
      policy.isRendered,
      policy.hiddenByFeatureFlag,
      policy.telemetryEnabled,
      containerStyle,
      filteredCoreProps,
    ]);

    /**
     * Policy: DOM rendering контролируется policy.isRendered.
     * isOpen - это отдельное UI-состояние для управления открытостью меню внутри Core.
     * Разделение: policy.isRendered → рендеринг компонента, isOpen → UX state меню.
     */
    if (!policy.isRendered) return null;

    const testId = props['data-testid'] ?? 'core-context-menu';

    return (
      <CoreContextMenu
        ref={ref}
        {...coreContextMenuProps}
        data-testid={testId}
      />
    );
  },
);

ContextMenuComponent.displayName = 'ContextMenu';

/**
 * UI-контракт ContextMenu компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия context menu
 * - Корректная обработка accessibility (ARIA)
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректное количество элементов
 * - Feature flags применяются корректно к visibility
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Select telemetry отправляется при каждом соответствующем событии
 * Не допускается:
 * - Использование напрямую core ContextMenu компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const ContextMenu = memo(ContextMenuComponent);
