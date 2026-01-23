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

import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { Modal as CoreModal } from '../../../ui-core/src/components/Modal.js';
import type { CoreModalProps, ModalVariant } from '../../../ui-core/src/components/Modal.js';
import type { UIDuration } from '../../../ui-core/src/types/ui.js';
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
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * ModalPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useModalPolicy(props: AppModalProps): ModalPolicy {
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

function emitModalTelemetry(payload: ModalTelemetryPayload): void {
  infoFireAndForget(`Modal ${payload.action}`, payload);
}

/**
 * Формирование payload для Modal telemetry.
 */
function getModalPayload(
  action: ModalTelemetryAction,
  policy: ModalPolicy,
  telemetryProps: {
    variant: ModalVariant;
  },
): ModalTelemetryPayload {
  return {
    component: 'Modal',
    action,
    hidden: policy.hiddenByFeatureFlag,
    visible: policy.isRendered,
    variant: telemetryProps.variant,
  };
}

/* ============================================================================
 * 🎯 APP MODAL
 * ========================================================================== */

const ModalComponent = forwardRef<HTMLDivElement, AppModalProps>(
  function ModalComponent(props: AppModalProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const {
      variant = DEFAULT_VARIANT,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      duration, // TODO: использовать для будущих transition эффектов в App слое
      ...coreProps
    } = props;
    const policy = useModalPolicy(props);

    /** Минимальный набор telemetry-данных */
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
        mount: ModalTelemetryPayload;
        unmount: ModalTelemetryPayload;
      } | undefined
    >(undefined);

    // eslint-disable-next-line functional/immutable-data
    lifecyclePayloadRef.current ??= {
      mount: getModalPayload(ModalTelemetryAction.Mount, policy, telemetryProps),
      unmount: getModalPayload(ModalTelemetryAction.Unmount, policy, telemetryProps),
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    const showPayload = useMemo(
      () => ({
        ...getModalPayload(ModalTelemetryAction.Show, policy, telemetryProps),
        visible: true,
      }),
      [policy, telemetryProps],
    );

    const hidePayload = useMemo(
      () => ({
        ...getModalPayload(ModalTelemetryAction.Hide, policy, telemetryProps),
        visible: false,
      }),
      [policy, telemetryProps],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitModalTelemetry(lifecyclePayload.mount);
      return (): void => {
        emitModalTelemetry(lifecyclePayload.unmount);
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
        emitModalTelemetry(
          currentVisibility ? showPayload : hidePayload,
        );
      }

      // eslint-disable-next-line functional/immutable-data
      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload]);

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreModal
        ref={ref}
        visible={policy.isRendered}
        variant={variant}
        data-component='AppModal'
        data-state='visible'
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
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
 * UI-контракт Modal компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия модального окна
 * - Корректная обработка accessibility (focus management, ARIA)
 *
 * Инварианты:
 * - Focus trap работает корректно при открытии
 * - Overlay блокирует взаимодействие с остальным UI
 * - ESC и backdrop click закрывают модальное окно
 * - Telemetry payload содержит корректные размеры
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 *
 * Не допускается:
 * - Использование напрямую core Modal компонента
 * - Игнорирование feature flag логики
 * - Нарушение focus management контрактов
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Modal = memo(ModalComponent);
