/**
 * @file packages/app/src/ui/confirm-dialog.tsx
 * ============================================================================
 * 🟥 APP UI CONFIRM DIALOG — UI МИКРОСЕРВИС CONFIRM DIALOG
 * ============================================================================
 *
 * Единственная точка входа для ConfirmDialog в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility / disabled)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 *
 * Архитектурные решения:
 * - Управление видимостью и событиями обрабатывается в App слое
 * - CoreConfirmDialog остается полностью presentational
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, ReactNode, Ref } from 'react';

import { ConfirmDialog as CoreConfirmDialog } from '../../../ui-core/src/components/ConfirmDialog.js';
import type { CoreConfirmDialogProps } from '../../../ui-core/src/components/ConfirmDialog.js';
import type { ModalVariant } from '../../../ui-core/src/components/Modal.js';
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

/** Алиас для UI feature flags в контексте confirm-dialog wrapper */
export type ConfirmDialogUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте confirm-dialog */
export type ConfirmDialogWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте confirm-dialog */
export type ConfirmDialogMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

const ConfirmDialogTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  Show: 'show',
  Hide: 'hide',
  Confirm: 'confirm',
  Cancel: 'cancel',
} as const;

type ConfirmDialogTelemetryAction =
  typeof ConfirmDialogTelemetryAction[keyof typeof ConfirmDialogTelemetryAction];

type ConfirmDialogTelemetryPayload = {
  component: 'ConfirmDialog';
  action: ConfirmDialogTelemetryAction;
  hidden: boolean;
  visible: boolean;
  disabled: boolean;
  variant: ModalVariant;
  hasTitle: boolean;
  hasMessage: boolean;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppConfirmDialogProps = Readonly<
  & Omit<
    CoreConfirmDialogProps,
    'visible' | 'onConfirm' | 'onCancel' | 'data-testid' | 'title' | 'message' | 'aria-label'
  >
  & {
    /**
     * Видимость ConfirmDialog (App policy).
     * Опционально для удобства App слоя. Если не указано, считается false.
     * Policy слой преобразует это в обязательный visible для Core компонента.
     */
    visible?: boolean;

    /** Feature flag: скрыть ConfirmDialog */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить ConfirmDialog */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при подтверждении */
    onConfirm?: () => void;

    /** Callback при отмене */
    onCancel?: () => void;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
  & (
    | {
      /** I18n title режим */
      titleI18nKey: TranslationKey;
      titleI18nNs?: Namespace;
      titleI18nParams?: Record<string, string | number>;
      title?: never;
    }
    | {
      /** Обычный title режим */
      titleI18nKey?: never;
      titleI18nNs?: never;
      titleI18nParams?: never;
      title?: string;
    }
  )
  & (
    | {
      /** I18n message режим */
      messageI18nKey: TranslationKey;
      messageI18nNs?: Namespace;
      messageI18nParams?: Record<string, string | number>;
      message?: never;
    }
    | {
      /** Обычный message режим */
      messageI18nKey?: never;
      messageI18nNs?: never;
      messageI18nParams?: never;
      message?: ReactNode;
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
  'isDisabledByFeatureFlag',
  'telemetryEnabled',
  'titleI18nKey',
  'titleI18nNs',
  'titleI18nParams',
  'messageI18nKey',
  'messageI18nNs',
  'messageI18nParams',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type ConfirmDialogPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly isDisabled: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * ConfirmDialogPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - disabled state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible,
 * props.disabled или feature flags.
 *
 * @remarks
 * isRendered всегда false, если скрыт feature flag (isHiddenByFeatureFlag),
 * независимо от значения props.visible. Это гарантирует, что feature flag
 * имеет абсолютный приоритет над видимостью.
 */
function useConfirmDialogPolicy(props: AppConfirmDialogProps): ConfirmDialogPolicy {
  return useMemo(() => {
    const hiddenByFeatureFlag = Boolean(props.isHiddenByFeatureFlag);
    const disabledByFeatureFlag = Boolean(props.isDisabledByFeatureFlag);

    const isRendered = !hiddenByFeatureFlag && props.visible !== false;
    const isDisabled = disabledByFeatureFlag || props.disabled === true;

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      isRendered,
      isDisabled,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.visible,
    props.disabled,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitConfirmDialogTelemetry(
  telemetry: UiTelemetryApi,
  payload: ConfirmDialogTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`ConfirmDialog ${payload.action}`, payload);
}

// Формирование payload для ConfirmDialog telemetry
function getConfirmDialogPayload(
  action: ConfirmDialogTelemetryAction,
  policy: ConfirmDialogPolicy,
  telemetryProps: {
    variant: ModalVariant;
    hasTitle: boolean;
    hasMessage: boolean;
  },
): ConfirmDialogTelemetryPayload {
  return {
    component: 'ConfirmDialog',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    disabled: policy.isDisabled,
    variant: telemetryProps.variant,
    hasTitle: telemetryProps.hasTitle,
    hasMessage: telemetryProps.hasMessage,
  };
}

/* ============================================================================
 * 🎯 APP CONFIRM DIALOG
 * ========================================================================== */

const ConfirmDialogComponent = forwardRef<HTMLDivElement, AppConfirmDialogProps>(
  function ConfirmDialogComponent(
    props: AppConfirmDialogProps,
    ref: Ref<HTMLDivElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    // Title: i18n → обычный title → undefined
    const title = useMemo<string | undefined>(() => {
      if ('titleI18nKey' in props) {
        const effectiveNs = props.titleI18nNs ?? 'common';
        return translate(effectiveNs, props.titleI18nKey, props.titleI18nParams ?? EMPTY_PARAMS);
      }
      return props.title;
    }, [props, translate]);

    // Message: i18n → обычный message → undefined
    const message = useMemo<ReactNode | undefined>(() => {
      if ('messageI18nKey' in props) {
        const effectiveNs = props.messageI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.messageI18nKey,
          props.messageI18nParams ?? EMPTY_PARAMS,
        );
      }
      return props.message;
    }, [props, translate]);

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
      variant = 'default',
      confirmLabel,
      cancelLabel,
      width,
      onConfirm,
      onCancel,
      'data-testid': dataTestId,
      ...filteredCoreProps
    } = domProps;
    const policy = useConfirmDialogPolicy(props);

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(
      () => ({
        variant,
        hasTitle: title != null && title !== '',
        hasMessage: message != null && (typeof message === 'string' ? message !== '' : true),
      }),
      [variant, title, message],
    );

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    const lifecyclePayloadRef = useRef<
      {
        mount: ConfirmDialogTelemetryPayload;
        unmount: ConfirmDialogTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getConfirmDialogPayload(ConfirmDialogTelemetryAction.Mount, policy, telemetryProps),
      unmount: getConfirmDialogPayload(
        ConfirmDialogTelemetryAction.Unmount,
        policy,
        telemetryProps,
      ),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getConfirmDialogPayload(ConfirmDialogTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getConfirmDialogPayload(ConfirmDialogTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    // Обработчик подтверждения с telemetry
    const handleConfirm = useCallback((): void => {
      if (policy.telemetryEnabled) {
        const confirmPayload = getConfirmDialogPayload(
          ConfirmDialogTelemetryAction.Confirm,
          policy,
          telemetryProps,
        );
        emitConfirmDialogTelemetry(telemetry, confirmPayload);
      }

      onConfirm?.();
    }, [policy, telemetryProps, onConfirm, telemetry]);

    // Обработчик отмены с telemetry
    const handleCancel = useCallback((): void => {
      if (policy.telemetryEnabled) {
        const cancelPayload = getConfirmDialogPayload(
          ConfirmDialogTelemetryAction.Cancel,
          policy,
          telemetryProps,
        );
        emitConfirmDialogTelemetry(telemetry, cancelPayload);
      }

      onCancel?.();
    }, [policy, telemetryProps, onCancel, telemetry]);

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitConfirmDialogTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitConfirmDialogTelemetry(telemetry, lifecyclePayload.unmount);
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
        emitConfirmDialogTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    // Policy: hidden
    if (!policy.isRendered) return null;

    // Props для CoreConfirmDialog, вынесены для читаемости
    const coreDialogProps = {
      ref,
      visible: policy.isRendered,
      ...(title !== undefined && { title }),
      ...(message !== undefined && { message }),
      ...(ariaLabel !== undefined && { 'aria-label': ariaLabel }),
      variant,
      ...(confirmLabel !== undefined && { confirmLabel }),
      ...(cancelLabel !== undefined && { cancelLabel }),
      ...(width !== undefined && { width }),
      disabled: policy.isDisabled,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      ...(dataTestId !== undefined && { 'data-testid': dataTestId }),
      'data-component': 'AppConfirmDialog',
      'data-state': 'visible',
      'data-disabled': policy.isDisabled || undefined,
      'data-feature-flag': policy.hiddenByFeatureFlag ? 'hidden' : 'visible',
      'data-telemetry': policy.telemetryEnabled ? 'enabled' : 'disabled',
      ...filteredCoreProps,
    } as CoreConfirmDialogProps;

    return <CoreConfirmDialog {...coreDialogProps} />;
  },
);

// eslint-disable-next-line functional/immutable-data
ConfirmDialogComponent.displayName = 'ConfirmDialog';

/**
 * UI-контракт ConfirmDialog компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Telemetry payload содержит корректные данные о диалоге
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * - Confirm telemetry отправляется при подтверждении
 * - Cancel telemetry отправляется при отмене
 *
 * Не допускается:
 * - Использование напрямую core ConfirmDialog компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 * - Использование props.visible или props.disabled напрямую вне policy
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <ConfirmDialog
 *   visible={isOpen}
 *   title="Подтверждение"
 *   message="Вы уверены, что хотите выполнить это действие?"
 *   onConfirm={() => handleConfirm()}
 *   onCancel={() => handleCancel()}
 * />
 *
 * // С feature flags и telemetry
 * <ConfirmDialog
 *   visible={isOpen}
 *   title="Удаление"
 *   message="Это действие нельзя отменить"
 *   variant="error"
 *   confirmLabel="Удалить"
 *   cancelLabel="Отмена"
 *   isHiddenByFeatureFlag={!featureFlags.confirmDialogEnabled}
 *   isDisabledByFeatureFlag={isProcessing}
 *   telemetryEnabled={true}
 *   onConfirm={handleDelete}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export const ConfirmDialog = memo(ConfirmDialogComponent);
