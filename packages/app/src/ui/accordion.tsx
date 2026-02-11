/**
 * @file packages/app/src/ui/accordion.tsx
 * ============================================================================
 * 🟥 APP UI ACCORDION — UI МИКРОСЕРВИС ACCORDION
 * ============================================================================
 *
 * Единственная точка входа для Accordion в приложении.
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
 * - Управление открытыми элементами и событиями обрабатывается в App слое
 * - CoreAccordion остается полностью presentational
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, MouseEvent, Ref } from 'react';

import { Accordion as CoreAccordion } from '../../../ui-core/src/components/Accordion.js';
import type { CoreAccordionProps } from '../../../ui-core/src/components/Accordion.js';
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

/** Алиас для UI feature flags в контексте accordion wrapper */
export type AccordionUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте accordion */
export type AccordionWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте accordion */
export type AccordionMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

/* ============================================================================
 * 🛠️ УТИЛИТЫ
 * ========================================================================== */

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

enum AccordionTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
  Toggle = 'toggle',
}

type AccordionTelemetryPayload = {
  component: 'Accordion';
  action: AccordionTelemetryAction;
  hidden: boolean;
  visible: boolean;
  itemsCount: number;
  openItemsCount: number;
  openItemIds?: string[];
  mode?: 'single' | 'multiple';
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppAccordionProps = Readonly<
  & Omit<CoreAccordionProps, 'onChange' | 'data-testid' | 'aria-label' | 'aria-labelledby'>
  & {
    /** Видимость Accordion (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть Accordion */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при изменении открытых элементов */
    onChange?: (itemId: string, event: MouseEvent<HTMLButtonElement>) => void;

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

// 📦 Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'visible',
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

type AccordionPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * AccordionPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useAccordionPolicy(props: AppAccordionProps): AccordionPolicy {
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

function emitAccordionTelemetry(
  telemetry: UiTelemetryApi,
  payload: AccordionTelemetryPayload,
): void {
  /**
   * Преобразуем payload в формат, совместимый с telemetry API.
   * Примечание: telemetry API поддерживает только примитивные типы (string | number | boolean | null),
   * поэтому массивы (openItemIds) преобразуются в JSON-строку.
   * Если в будущем API будет поддерживать массивы напрямую, можно будет убрать JSON.stringify.
   */
  const metadata: Readonly<Record<string, string | number | boolean | null>> = {
    component: payload.component,
    action: payload.action,
    hidden: payload.hidden,
    visible: payload.visible,
    itemsCount: payload.itemsCount,
    openItemsCount: payload.openItemsCount,
    ...(payload.openItemIds !== undefined && { openItemIds: JSON.stringify(payload.openItemIds) }),
    ...(payload.mode !== undefined && { mode: payload.mode }),
  };
  telemetry.infoFireAndForget(`Accordion ${payload.action}`, metadata);
}

/**
 * Базовое формирование payload для Accordion telemetry (без visible).
 * visible добавляется явно в show/hide payload для семантической чистоты.
 */
function getAccordionPayloadBase(
  action: AccordionTelemetryAction,
  policy: AccordionPolicy,
  telemetryProps: {
    itemsCount: number;
    openItemsCount: number;
    openItemIds?: string[];
    mode?: 'single' | 'multiple';
  },
): Omit<AccordionTelemetryPayload, 'visible'> {
  return {
    component: 'Accordion',
    action,
    hidden: policy.hiddenByFeatureFlag,
    itemsCount: telemetryProps.itemsCount,
    openItemsCount: telemetryProps.openItemsCount,
    ...(telemetryProps.openItemIds !== undefined && { openItemIds: telemetryProps.openItemIds }),
    ...(telemetryProps.mode !== undefined && { mode: telemetryProps.mode }),
  };
}

/**
 * Формирование payload для Accordion telemetry (для lifecycle events).
 * Использует policy.isRendered для visible.
 */
function getAccordionPayload(
  action: AccordionTelemetryAction,
  policy: AccordionPolicy,
  telemetryProps: {
    itemsCount: number;
    openItemsCount: number;
    openItemIds?: string[];
    mode?: 'single' | 'multiple';
  },
): AccordionTelemetryPayload {
  return {
    ...getAccordionPayloadBase(action, policy, telemetryProps),
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP ACCORDION
 * ========================================================================== */

const AccordionComponent = forwardRef<HTMLDivElement, AppAccordionProps>(
  function AccordionComponent(
    props: AppAccordionProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    const policy = useAccordionPolicy(props);

    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    // onChange обрабатывается отдельно через handleChange
    const domProps = omit(props, [...BUSINESS_PROPS, 'onChange']);

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

    const {
      items,
      openItemId,
      openItemIds,
      mode,
    } = domProps;

    // onChange не является DOM-пропсом, берем из оригинальных props
    const { onChange } = props;

    // Вычисляем количество открытых элементов и их IDs
    const { openItemsCount, currentOpenItemIds } = useMemo(() => {
      if (mode === 'single' && openItemId !== undefined) {
        return { openItemsCount: 1, currentOpenItemIds: [openItemId] };
      }
      if (mode === 'multiple' && openItemIds !== undefined) {
        return { openItemsCount: openItemIds.length, currentOpenItemIds: [...openItemIds] };
      }
      return { openItemsCount: 0, currentOpenItemIds: [] };
    }, [mode, openItemId, openItemIds]);

    // Генерация snapshot'а telemetry данных
    const createTelemetrySnapshot = useCallback(() => {
      const base = {
        itemsCount: items.length,
        openItemsCount,
        ...(mode !== undefined && { mode }),
      };
      if (currentOpenItemIds.length > 0) {
        return { ...base, openItemIds: currentOpenItemIds };
      }
      return base;
    }, [items.length, openItemsCount, currentOpenItemIds, mode]);

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => createTelemetrySnapshot(), [createTelemetrySnapshot]);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    // Это архитектурная гарантия
    const lifecyclePayloadRef = useRef<
      {
        mount: AccordionTelemetryPayload;
        unmount: AccordionTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getAccordionPayload(AccordionTelemetryAction.Mount, policy, telemetryProps),
      unmount: getAccordionPayload(AccordionTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getAccordionPayloadBase(AccordionTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getAccordionPayloadBase(AccordionTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    /**
     * Обработчик изменения элемента с telemetry.
     *
     * @param itemId - ID элемента, который был кликнут
     * @param event - Mouse event
     *
     * @note Toggle telemetry фиксирует состояние ДО клика (pre-click snapshot).
     * Это означает, что openItemsCount и openItemIds отражают состояние на момент рендера,
     * а не новое состояние после обработки клика App-слоем.
     * Если требуется telemetry с новым состоянием, это должно обрабатываться в App-слое.
     */
    const handleChange = useCallback(
      (itemId: string, event: MouseEvent<HTMLButtonElement>): void => {
        if (policy.telemetryEnabled) {
          const beforeTogglePayload = getAccordionPayload(
            AccordionTelemetryAction.Toggle,
            policy,
            createTelemetrySnapshot(),
          );
          emitAccordionTelemetry(telemetry, beforeTogglePayload);
        }

        onChange?.(itemId, event);
      },
      [policy, createTelemetrySnapshot, onChange, telemetry],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitAccordionTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitAccordionTelemetry(telemetry, lifecyclePayload.unmount);
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
          emitAccordionTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
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

    // Контракт CoreAccordion
    // - В single mode используется только openItemId (имеет приоритет)
    // - В multiple mode используется только openItemIds
    // - Передача обоих props одновременно не рекомендуется, но CoreAccordion обработает корректно
    const coreAccordionProps = useMemo(() => {
      // Runtime warning в dev-mode для конфликта props
      if (
        process.env['NODE_ENV'] !== 'production' && mode === 'single' && openItemIds !== undefined
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          '[Accordion] openItemIds ignored in single mode. Use openItemId instead.',
        );
      }

      return {
        items,
        ...(openItemId !== undefined && { openItemId }),
        ...(openItemIds !== undefined && { openItemIds }),
        onChange: handleChange,
        ...(mode !== undefined && { mode }),
        'data-component': 'AppAccordion' as const,
        'data-state': 'visible' as const,
        'data-feature-flag': policy.hiddenByFeatureFlag ? 'hidden' as const : 'visible' as const,
        'data-telemetry': policy.telemetryEnabled ? 'enabled' as const : 'disabled' as const,
      };
    }, [
      items,
      openItemId,
      openItemIds,
      handleChange,
      mode,
      policy.hiddenByFeatureFlag,
      policy.telemetryEnabled,
    ]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreAccordion
        ref={ref}
        {...coreAccordionProps}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        {...domProps}
      />
    );
  },
);

AccordionComponent.displayName = 'Accordion';

/**
 * UI-контракт Accordion компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия аккордеона
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректное количество элементов
 * - Feature flags применяются корректно к visibility
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Toggle telemetry отправляется при каждом изменении открытых элементов
 *
 * Не допускается:
 * - Использование напрямую core Accordion компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Accordion = memo(AccordionComponent);
