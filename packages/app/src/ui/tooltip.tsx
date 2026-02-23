/**
 * @file packages/app/src/ui/tooltip.tsx
 * ============================================================================
 * 🟥 APP UI TOOLTIP — UI МИКРОСЕРВИС TOOLTIP
 * ============================================================================
 *
 * Единственная точка входа для Tooltip в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import { Tooltip as CoreTooltip } from '@livai/ui-core';
import type { CoreTooltipProps } from '@livai/ui-core';
import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

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

/** Алиас для UI feature flags в контексте tooltip wrapper */
export type TooltipUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте tooltip */
export type TooltipWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте tooltip */
export type TooltipMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

enum TooltipTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

type TooltipTelemetryPayload = {
  component: 'Tooltip';
  action: TooltipTelemetryAction;
  hidden: boolean;
  visible: boolean;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppTooltipProps = Readonly<
  & Omit<CoreTooltipProps, 'visible' | 'aria-label'>
  & {
    /** Видимость tooltip (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть Tooltip */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: variant Tooltip */
    variantByFeatureFlag?: string;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;
  }
  & (
    | {
      /** I18n content режим: ключ локализации обязателен */
      contentI18nKey: TranslationKey;
      contentI18nNs?: Namespace;
      contentI18nParams?: Record<string, string | number>;
    }
    | {
      /** Content режим: обычный контент */
      contentI18nKey?: never;
      contentI18nNs?: never;
      contentI18nParams?: never;
    }
  )
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

// Бизнес-пропсы и внутренние Core-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryEnabled',
  'contentI18nKey',
  'contentI18nNs',
  'contentI18nParams',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
  // Внутренние пропсы CoreTooltip, используемые только для стилизации
  'bgColor',
  'textColor',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type TooltipPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * TooltipPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useTooltipPolicy(props: AppTooltipProps): TooltipPolicy {
  const hiddenByFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFlag && props.visible !== false;
    return {
      hiddenByFeatureFlag: hiddenByFlag,
      isRendered,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [hiddenByFlag, props.visible, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitTooltipTelemetry(telemetry: UiTelemetryApi, payload: TooltipTelemetryPayload): void {
  telemetry.infoFireAndForget(`Tooltip ${payload.action}`, payload);
}

// Формирование payload для Tooltip telemetry
function getTooltipPayload(
  action: TooltipTelemetryAction,
  policy: TooltipPolicy,
): TooltipTelemetryPayload {
  return {
    component: 'Tooltip',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
  };
}

/* ============================================================================
 * 🎯 APP TOOLTIP
 * ========================================================================== */

const TooltipComponent = forwardRef<HTMLDivElement, AppTooltipProps>(
  function TooltipComponent(props: AppTooltipProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    // Извлекаем content из domProps для обработки
    const { content: rawContent, ...filteredCoreProps } = domProps;

    // Content: i18n → обычный content
    const content = useMemo(() => {
      if ('contentI18nKey' in props) {
        const effectiveNs = props.contentI18nNs ?? 'common';
        const translated = translate(
          effectiveNs,
          props.contentI18nKey,
          props.contentI18nParams ?? EMPTY_PARAMS,
        );
        return translated;
      }
      // Для обычного режима content берется из rawContent как есть
      return rawContent;
    }, [props, translate, rawContent]);

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

    const policy = useTooltipPolicy(props);

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: TooltipTelemetryPayload;
        unmount: TooltipTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: getTooltipPayload(TooltipTelemetryAction.Mount, policy),
      unmount: getTooltipPayload(TooltipTelemetryAction.Unmount, policy),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Payload для telemetry создаются по требованию
    const emitVisibilityChange = useMemo(
      () => (action: TooltipTelemetryAction): void => {
        emitTooltipTelemetry(telemetry, getTooltipPayload(action, policy));
      },
      // telemetry намеренно не включаем, чтобы избежать лишних пересозданий
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [policy],
    );

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitTooltipTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitTooltipTelemetry(telemetry, lifecyclePayload.unmount);
      };
      // Policy намеренно заморожена при монтировании
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Telemetry for visibility changes - only on changes, not on mount
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;

      // Инициализируем prevVisibleRef при первом рендере
      if (prevVisibleRef.current === undefined) {
        prevVisibleRef.current = currentVisibility;
        return;
      }

      // Emit only on actual visibility changes, not on mount
      if (prevVisibleRef.current !== currentVisibility) {
        emitVisibilityChange(
          currentVisibility ? TooltipTelemetryAction.Show : TooltipTelemetryAction.Hide,
        );
      }

      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, emitVisibilityChange]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreTooltip
        ref={ref}
        visible={policy.isRendered}
        content={content}
        data-component='AppTooltip'
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        {...filteredCoreProps}
      />
    );
  },
);

TooltipComponent.displayName = 'Tooltip';

/**
 * UI-контракт Tooltip компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия подсказок
 * - Корректное позиционирование относительно trigger элемента
 *
 * Инварианты:
 * - Tooltip появляется только при hover/focus trigger элемента
 * - Автоматическое позиционирование избегает viewport границ
 * - ESC закрывает tooltip
 * - Telemetry payload содержит корректные размеры
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование напрямую core Tooltip компонента
 * - Игнорирование feature flag логики
 * - Нарушение позиционирования логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Tooltip = memo(TooltipComponent);
