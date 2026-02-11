/**
 * @file packages/app/src/ui/dropdown.tsx
 * ============================================================================
 * 🟥 APP UI DROPDOWN — UI МИКРОСЕРВИС DROPDOWN
 * ============================================================================
 *
 * Единственная точка входа для Dropdown в приложении.
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
 * - Управление открытостью меню и событиями обрабатывается в App слое
 * - CoreDropdown остается полностью presentational
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, KeyboardEvent, MouseEvent, Ref } from 'react';

import { Dropdown as CoreDropdown } from '../../../ui-core/src/primitives/dropdown.js';
import type { CoreDropdownProps } from '../../../ui-core/src/primitives/dropdown.js';
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

/** Алиас для UI feature flags в контексте dropdown wrapper */
export type DropdownUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте dropdown */
export type DropdownWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте dropdown */
export type DropdownMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

enum DropdownTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
  Toggle = 'toggle',
  Select = 'select',
}

type DropdownTelemetryPayload = {
  component: 'Dropdown';
  action: DropdownTelemetryAction;
  hidden: boolean;
  visible: boolean;
  itemsCount: number;
  isOpen?: boolean;
  selectedItemId?: string;
  placement?: 'bottom' | 'top' | 'left' | 'right';
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppDropdownProps = Readonly<
  & Omit<CoreDropdownProps, 'onToggle' | 'onSelect' | 'onClose' | 'data-testid' | 'aria-label'>
  & {
    /** Видимость Dropdown (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть Dropdown */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при изменении открытости */
    onToggle?: (
      isOpen: boolean,
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    ) => void;

    /** Callback для закрытия меню без события */
    onClose?: () => void;

    /** Callback при выборе элемента */
    onSelect?: (
      itemId: string,
      event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>,
    ) => void;

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
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type DropdownPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * DropdownPolicy является единственным источником истины
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
function useDropdownPolicy(props: AppDropdownProps): DropdownPolicy {
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

function emitDropdownTelemetry(telemetry: UiTelemetryApi, payload: DropdownTelemetryPayload): void {
  telemetry.infoFireAndForget(`Dropdown ${payload.action}`, payload);
}

// Базовое формирование payload для Dropdown telemetry (без visible)
function getDropdownPayloadBase(
  action: DropdownTelemetryAction,
  policy: DropdownPolicy,
  telemetryProps: {
    itemsCount: number;
    isOpen?: boolean;
    selectedItemId?: string;
    placement?: 'bottom' | 'top' | 'left' | 'right';
  },
): Omit<DropdownTelemetryPayload, 'visible'> {
  return {
    component: 'Dropdown',
    action,
    hidden: policy.hiddenByFeatureFlag,
    itemsCount: telemetryProps.itemsCount,
    ...(telemetryProps.isOpen !== undefined && { isOpen: telemetryProps.isOpen }),
    ...(telemetryProps.selectedItemId !== undefined
      && { selectedItemId: telemetryProps.selectedItemId }),
    ...(telemetryProps.placement !== undefined && { placement: telemetryProps.placement }),
  };
}

// Формирование payload для Dropdown telemetry (для lifecycle events)
function getDropdownPayload(
  action: DropdownTelemetryAction,
  policy: DropdownPolicy,
  telemetryProps: {
    itemsCount: number;
    isOpen?: boolean;
    selectedItemId?: string;
    placement?: 'bottom' | 'top' | 'left' | 'right';
  },
): DropdownTelemetryPayload {
  return {
    ...getDropdownPayloadBase(action, policy, telemetryProps),
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP DROPDOWN
 * ========================================================================== */

const DropdownComponent = forwardRef<HTMLDivElement, AppDropdownProps>(
  function DropdownComponent(
    props: AppDropdownProps,
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
      trigger,
      isOpen,
      onToggle,
      onSelect,
      onClose,
      placement,
      'data-component-id': componentId,
      ...filteredCoreProps
    } = domProps;
    const policy = useDropdownPolicy(props);

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => ({
      itemsCount: items.length,
      ...(isOpen !== undefined && { isOpen }),
      ...(placement !== undefined && { placement }),
    }), [items.length, isOpen, placement]);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    const lifecyclePayloadRef = useRef<
      {
        mount: DropdownTelemetryPayload;
        unmount: DropdownTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getDropdownPayload(
        DropdownTelemetryAction.Mount,
        policy,
        telemetryProps,
      ),
      unmount: getDropdownPayload(
        DropdownTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Payload для show telemetry
    const showPayload = useMemo(
      () => ({
        ...getDropdownPayloadBase(DropdownTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    // Payload для hide telemetry
    const hidePayload = useMemo(
      () => ({
        ...getDropdownPayloadBase(DropdownTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitDropdownTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitDropdownTelemetry(telemetry, lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    // Telemetry для видимости - only on changes, not on mount
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    // DRY функция для отправки visibility telemetry
    const emitVisibilityTelemetry = useCallback(
      (prevVisibility: boolean | undefined, currentVisibility: boolean): void => {
        if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
          emitDropdownTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
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

    // Обработчик toggle с telemetry
    const handleToggle = useCallback(
      (
        newIsOpen: boolean,
        event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
      ): void => {
        if (policy.telemetryEnabled) {
          const togglePayload = getDropdownPayload(
            DropdownTelemetryAction.Toggle,
            policy,
            {
              itemsCount: items.length,
              isOpen: newIsOpen,
              ...(placement !== undefined && { placement }),
            },
          );
          emitDropdownTelemetry(telemetry, togglePayload);
        }

        onToggle?.(newIsOpen, event);
      },
      [policy, items.length, placement, onToggle, telemetry],
    );

    // Обработчик select с telemetry
    const handleSelect = useCallback(
      (itemId: string, event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>): void => {
        if (policy.telemetryEnabled) {
          const selectPayload = getDropdownPayload(
            DropdownTelemetryAction.Select,
            policy,
            {
              itemsCount: items.length,
              selectedItemId: itemId,
              ...(isOpen !== undefined && { isOpen }),
              ...(placement !== undefined && { placement }),
            },
          );
          emitDropdownTelemetry(telemetry, selectPayload);
        }

        onSelect?.(itemId, event);
      },
      [policy, items.length, isOpen, placement, onSelect, telemetry],
    );

    // CoreDropdown получает все необходимые пропсы
    // Обработчик закрытия меню
    const handleClose = useCallback((): void => {
      // Только сообщаем родителю о закрытии
      // Visibility telemetry обрабатывается в visibility effect через policy.isRendered
      // Никаких synthetic events, никакой DOM манипуляции
      onClose?.();
    }, [onClose]);

    const coreDropdownProps: CoreDropdownProps = useMemo(() => ({
      items,
      trigger,
      ...(isOpen !== undefined && { isOpen }),
      ...(ariaLabel !== undefined && { 'aria-label': ariaLabel }),
      onToggle: handleToggle,
      onClose: handleClose,
      onSelect: handleSelect,
      // placement для логики компонента (позиционирование меню)
      ...(placement !== undefined && { placement }),
      ...(componentId !== undefined && { 'data-component-id': componentId }),
      'data-component': 'AppDropdown',
      'data-state': policy.isRendered ? 'visible' : 'hidden',
      'data-feature-flag': policy.hiddenByFeatureFlag ? 'hidden' : 'visible',
      'data-telemetry': policy.telemetryEnabled ? 'enabled' : 'disabled',
      // data-placement для отладки и автотестов (видимость в DOM)
      ...(placement !== undefined && { 'data-placement': placement }),
      ...filteredCoreProps,
    }), [
      items,
      trigger,
      isOpen,
      ariaLabel,
      handleToggle,
      handleClose,
      handleSelect,
      placement,
      componentId,
      policy.isRendered,
      policy.hiddenByFeatureFlag,
      policy.telemetryEnabled,
      filteredCoreProps,
    ]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreDropdown
        ref={ref}
        {...coreDropdownProps}
      />
    );
  },
);

DropdownComponent.displayName = 'Dropdown';

/**
 * UI-контракт Dropdown компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия dropdown
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректное количество элементов
 * - Feature flags применяются корректно к visibility
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Toggle и Select telemetry отправляются при каждом соответствующем событии
 *
 * Не допускается:
 * - Использование напрямую core Dropdown компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Dropdown = memo(DropdownComponent);
