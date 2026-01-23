/**
 * @file packages/app/src/ui/modal.tsx
 * ============================================================================
 * 🟥 APP UI MODAL — UI МИКРОСЕРВИС MODAL
 * ============================================================================
 *
 * Единственная точка входа для Modal в приложении.
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
 * - Анимации и transitions должны реализовываться в App слое через duration пропс
 * - CoreModal остается без анимаций для максимальной производительности и простоты
 */

import { forwardRef, memo, useEffect, useMemo } from 'react';
import type { JSX, Ref } from 'react';

import { Modal as CoreModal } from '../../../ui-core/src/components/Modal.js';
import type { CoreModalProps, ModalVariant } from '../../../ui-core/src/components/Modal.js';
import type { UIDuration } from '../../../ui-core/src/types/ui.js';
import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

const DEFAULT_VARIANT: ModalVariant = 'default';

enum ModalTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  Show = 'show',
  Hide = 'hide',
}

type ModalTelemetryPayload = {
  component: 'Modal';
  action: ModalTelemetryAction;
  hidden: boolean;
  visible: boolean;
  variant: ModalVariant;
};

export type AppModalProps = Readonly<
  Omit<CoreModalProps, 'visible'> & {
    /** Видимость модалки (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть Modal */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** ARIA: основной лейбл для модального окна */
    'aria-label'?: string;

    /** ARIA: ID элемента с описанием модального окна */
    'aria-labelledby'?: string;

    /**
     * Длительность анимаций (для будущих transition эффектов в App слое).
     * Пока не используется, но оставлено для обратной совместимости.
     */
    duration?: UIDuration;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type ModalPolicy = Readonly<{
  hidden: boolean;
  isVisible: boolean;
  telemetryEnabled: boolean;
}>;

function useModalPolicy(props: AppModalProps): ModalPolicy {
  const hiddenByFlag = useFeatureFlag(props.isHiddenByFeatureFlag ?? false);

  return useMemo(() => ({
    hidden: hiddenByFlag,
    isVisible: !hiddenByFlag,
    telemetryEnabled: props.telemetryEnabled !== false,
  }), [hiddenByFlag, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitModalTelemetry(payload: ModalTelemetryPayload): void {
  infoFireAndForget(`Modal ${payload.action}`, payload);
}

function getModalPayload(
  action: ModalTelemetryAction,
  hidden: boolean,
  variant: ModalVariant,
  visible: boolean,
): ModalTelemetryPayload {
  return {
    component: 'Modal',
    action,
    hidden,
    visible,
    variant,
  };
}

/* ============================================================================
 * 🎯 APP MODAL
 * ========================================================================== */

const ModalComponent = forwardRef<HTMLDivElement, AppModalProps>(
  function ModalComponent(props: AppModalProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const {
      visible = false,
      variant = DEFAULT_VARIANT,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      duration, // TODO: использовать для будущих transition эффектов в App слое
      ...coreProps
    } = props;
    const policy = useModalPolicy(props);

    const mountPayload = useMemo(
      () => getModalPayload(ModalTelemetryAction.Mount, policy.hidden, variant, visible),
      [policy.hidden, variant, visible],
    );

    const unmountPayload = useMemo(
      () => getModalPayload(ModalTelemetryAction.Unmount, policy.hidden, variant, visible),
      [policy.hidden, variant, visible],
    );

    const showPayload = useMemo(
      () => getModalPayload(ModalTelemetryAction.Show, policy.hidden, variant, true),
      [policy.hidden, variant],
    );

    const hidePayload = useMemo(
      () => getModalPayload(ModalTelemetryAction.Hide, policy.hidden, variant, false),
      [policy.hidden, variant],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitModalTelemetry(mountPayload);
      return (): void => {
        emitModalTelemetry(unmountPayload);
      };
    }, [policy.telemetryEnabled, mountPayload, unmountPayload]);

    /** Telemetry для видимости */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      if (visible) {
        emitModalTelemetry(showPayload);
      } else {
        emitModalTelemetry(hidePayload);
      }
    }, [visible, policy.telemetryEnabled, showPayload, hidePayload]);

    /** Policy: hidden */
    if (!policy.isVisible) return null;

    return (
      <CoreModal
        ref={ref}
        visible={visible}
        variant={variant}
        data-component='AppModal'
        data-state={visible ? 'visible' : 'hidden'}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        {...(duration !== undefined && { duration })}
        {...coreProps}
      />
    );
  },
);

// eslint-disable-next-line functional/immutable-data
ModalComponent.displayName = 'Modal';

/**
 * Memoized App Modal с ref forwarding.
 *
 * Подходит для:
 * - UI модалок
 * - workflow
 * - design-system интеграций
 *
 * Гарантии:
 * - Чёткое разделение Core и App слоёв
 * - Централизованная telemetry
 * - Управление фичефлагами в одном месте
 */
export const Modal = memo(ModalComponent);
