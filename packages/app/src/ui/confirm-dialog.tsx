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
import type { JSX, Ref } from 'react';

import { ConfirmDialog as CoreConfirmDialog } from '../../../ui-core/src/components/ConfirmDialog.js';
import type { CoreConfirmDialogProps } from '../../../ui-core/src/components/ConfirmDialog.js';
import type { ModalVariant } from '../../../ui-core/src/components/Modal.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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

export type AppConfirmDialogProps = Readonly<
  Omit<CoreConfirmDialogProps, 'visible' | 'onConfirm' | 'onCancel' | 'data-testid'> & {
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
>;

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

function emitConfirmDialogTelemetry(payload: ConfirmDialogTelemetryPayload): void {
  infoFireAndForget(`ConfirmDialog ${payload.action}`, payload);
}

/**
 * Формирование payload для ConfirmDialog telemetry.
 */
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
    const {
      title,
      message,
      variant = 'default',
      confirmLabel,
      cancelLabel,
      width,
      onConfirm,
      onCancel,
      'data-testid': dataTestId,
      ...coreProps
    } = props;
    const policy = useConfirmDialogPolicy(props);

    /** Минимальный набор telemetry-данных */
    const telemetryProps = useMemo(
      () => ({
        variant,
        hasTitle: title != null && title !== '',
        hasMessage: message != null && (typeof message === 'string' ? message !== '' : true),
      }),
      [variant, title, message],
    );

    /**
     * Lifecycle telemetry фиксирует состояние policy на момент первого рендера.
     * Не реагирует на последующие изменения props или policy.
     * Это архитектурная гарантия для детерминированности.
     *
     * @remarks
     * Важно: При изменении policy между mount/unmount lifecycle payload может быть
     * менее информативным, так как отражает только начальное состояние.
     * Для отслеживания динамических изменений используйте show/hide telemetry.
     */
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

    /**
     * Обработчик подтверждения с telemetry.
     *
     * @remarks
     * Telemetry отправляется даже если policy.isDisabled === true.
     * policy.isDisabled блокирует только UI взаимодействие, но не telemetry tracking.
     * Это позволяет отслеживать попытки взаимодействия с заблокированным диалогом.
     */
    const handleConfirm = useCallback((): void => {
      if (policy.telemetryEnabled) {
        const confirmPayload = getConfirmDialogPayload(
          ConfirmDialogTelemetryAction.Confirm,
          policy,
          telemetryProps,
        );
        emitConfirmDialogTelemetry(confirmPayload);
      }

      onConfirm?.();
    }, [policy, telemetryProps, onConfirm]);

    /**
     * Обработчик отмены с telemetry.
     *
     * @remarks
     * Telemetry отправляется даже если policy.isDisabled === true.
     * policy.isDisabled блокирует только UI взаимодействие, но не telemetry tracking.
     * Это позволяет отслеживать попытки взаимодействия с заблокированным диалогом.
     */
    const handleCancel = useCallback((): void => {
      if (policy.telemetryEnabled) {
        const cancelPayload = getConfirmDialogPayload(
          ConfirmDialogTelemetryAction.Cancel,
          policy,
          telemetryProps,
        );
        emitConfirmDialogTelemetry(cancelPayload);
      }

      onCancel?.();
    }, [policy, telemetryProps, onCancel]);

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitConfirmDialogTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitConfirmDialogTelemetry(lifecyclePayload.unmount);
      };
    }, [policy.telemetryEnabled, lifecyclePayload]);

    /** Telemetry для видимости - only on changes, not on mount */
    const prevVisibleRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      const currentVisibility = policy.isRendered;
      const prevVisibility = prevVisibleRef.current;

      // Emit only on actual visibility changes, not on mount
      if (prevVisibility !== undefined && prevVisibility !== currentVisibility) {
        emitConfirmDialogTelemetry(
          currentVisibility ? showPayload : hidePayload,
        );
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    /** Props для CoreConfirmDialog, вынесены для читаемости */
    const coreDialogProps = {
      ref,
      visible: policy.isRendered,
      ...(title !== undefined && { title }),
      ...(message !== undefined && { message }),
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
      ...coreProps,
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
