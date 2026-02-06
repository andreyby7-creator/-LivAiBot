/**
 * @file packages/app/src/ui/toast.tsx
 * ============================================================================
 * 🟥 APP UI TOAST — UI МИКРОСЕРВИС TOAST
 * ============================================================================
 *
 * Единственная точка входа для Toast в приложении.
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

import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, ReactNode, Ref } from 'react';

import { Toast as CoreToast } from '../../../ui-core/src/components/Toast.js';
import type { CoreToastProps, ToastVariant } from '../../../ui-core/src/components/Toast.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { Json } from '../types/common.js';
import type { AppError } from '../types/errors.js';
import type {
  AppWrapperProps,
  MapCoreProps,
  UiFeatureFlags,
  UiPrimitiveProps,
  UiTelemetryApi,
} from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте toast wrapper */
export type ToastUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте toast */
export type ToastWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте toast */
export type ToastMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

const DEFAULT_VARIANT: ToastVariant = 'info';

enum ToastTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

/**
 * Определяет variant Toast на основе AppError или explicit props.
 *
 * Приоритет:
 * 1. error.severity
 * 2. explicit variant
 * 3. DEFAULT_VARIANT
 */
type ToastVariantInput = {
  readonly error?: AppError | undefined;
  readonly variant?: ToastVariant | undefined;
};

function getToastVariant(props: ToastVariantInput): ToastVariant {
  if (props.error) {
    switch (props.error.severity) {
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'error';
    }
  }
  return props.variant ?? DEFAULT_VARIANT;
}

type ToastTelemetryPayload = Readonly<{
  readonly component: 'Toast';
  readonly action: ToastTelemetryAction;
  readonly hidden: boolean;
  readonly visible: boolean;
  readonly variant: ToastVariant;
}>;

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppToastProps = Readonly<
  & Omit<CoreToastProps, 'visible' | 'aria-label'>
  & {
    /** Видимость Toast (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть Toast */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Типизированная ошибка для автоматического определения variant */
    error?: AppError;
  }
  & (
    | {
      /** I18n content режим */
      contentI18nKey: TranslationKey;
      contentI18nNs?: Namespace;
      contentI18nParams?: Record<string, string | number>;
      content?: never;
    }
    | {
      /** Обычный content режим */
      contentI18nKey?: never;
      contentI18nNs?: never;
      contentI18nParams?: never;
      content: ReactNode;
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

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'contentI18nKey',
  'contentI18nNs',
  'contentI18nParams',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type ToastPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * ToastPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useToastPolicy(
  props: AppToastProps,
): ToastPolicy {
  const hiddenByFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => {
    // NOTE: если появится анимация или отложенное скрытие, rendered и visible могут расходиться
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

function emitToastTelemetry(telemetry: UiTelemetryApi, payload: ToastTelemetryPayload): void {
  telemetry.infoFireAndForget(`Toast ${payload.action}`, payload);
}

// Формирование payload для Toast telemetry
function getToastPayload(
  action: ToastTelemetryAction,
  policy: ToastPolicy,
  telemetryProps: {
    variant: ToastVariant;
  },
): ToastTelemetryPayload {
  return {
    component: 'Toast',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    variant: telemetryProps.variant,
  };
}

/* ============================================================================
 * 🎯 APP TOAST
 * ========================================================================== */

const ToastComponent = forwardRef<HTMLDivElement, AppToastProps>(
  function ToastComponent(props: AppToastProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    // Извлекаем content из domProps для обработки
    const { error, content: rawContent, ...filteredCoreProps } = domProps;

    // Content: i18n → обычный content
    const content = useMemo(() => {
      if ('contentI18nKey' in props) {
        const effectiveNs = props.contentI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.contentI18nKey,
          props.contentI18nParams ?? EMPTY_PARAMS,
        );
      }
      // Для обычного режима content берется из rawContent как есть
      return rawContent ?? '';
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
    const policy = useToastPolicy(props);

    const variant = getToastVariant({ error, variant: props.variant });

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => ({
      variant,
    }), [variant]);

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия.
     */
    const lifecyclePayloadRef = useRef<
      {
        mount: ToastTelemetryPayload;
        unmount: ToastTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getToastPayload(ToastTelemetryAction.Mount, policy, telemetryProps),
      unmount: getToastPayload(ToastTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getToastPayload(ToastTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getToastPayload(ToastTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitToastTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitToastTelemetry(telemetry, lifecyclePayload.unmount);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Telemetry для изменений видимости - только при изменениях, не при монтировании
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      // Отправляем только при реальных изменениях видимости, не при монтировании
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitToastTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    return (
      <CoreToast
        ref={ref}
        visible={policy.isRendered}
        content={content}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        data-component='AppToast'
        data-variant={variant}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...filteredCoreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
ToastComponent.displayName = 'Toast';

/**
 * UI-контракт Toast компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия уведомлений
 * - Корректная обработка accessibility (ARIA live regions)
 * - Типизированная обработка ошибок приложения
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректный variant
 * - Feature flags полностью изолированы от Core логики
 * - ARIA атрибуты корректно проксируются в CoreToast
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование напрямую core Toast компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Нарушение accessibility контрактов
 * - Использование props.visible напрямую вне policy
 */
export const Toast = memo(ToastComponent);
