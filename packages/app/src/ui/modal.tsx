/**
 * @file packages/app/src/ui/modal.tsx
 * ============================================================================
 * 🟥 APP UI MODAL — UI МИКРОСЕРВИС MODAL
 * ============================================================================
 * Единственная точка входа для Modal в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 * Архитектурные решения:
 * - Анимации и transitions должны реализовываться в App слое через duration пропс
 * - CoreModal остается без анимаций для максимальной производительности и простоты
 */

import { AnimatePresence, motion } from 'framer-motion';
import type { JSX, Ref } from 'react';
import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';

import type { CoreModalProps, ModalVariant, UIDuration } from '@livai/ui-core';
import { Modal as CoreModal } from '@livai/ui-core';

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

/** Алиас для UI feature flags в контексте modal wrapper */
export type ModalUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте modal */
export type ModalWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте modal */
export type ModalMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

const DEFAULT_VARIANT: ModalVariant = 'default';

// Animation constants
const DEFAULT_DURATION_SECONDS = 0.2; // 200ms default
const INITIAL_SCALE = 0.95;
const CUBIC_BEZIER_P1 = 0.4;
const CUBIC_BEZIER_P2 = 0.2;
const CUBIC_BEZIER_P3 = 1;
const EASE_OUT_CUBIC_BEZIER = [CUBIC_BEZIER_P1, 0, CUBIC_BEZIER_P2, CUBIC_BEZIER_P3] as const;
const EASE_IN_CUBIC_BEZIER = [CUBIC_BEZIER_P1, 0, CUBIC_BEZIER_P3, CUBIC_BEZIER_P3] as const;

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

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppModalProps = Readonly<
  & Omit<CoreModalProps, 'visible' | 'aria-label' | 'aria-labelledby'>
  & {
    /** Видимость модалки (App policy) */
    visible?: boolean;

    /** Feature flag: скрыть Modal */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /**
     * Длительность анимаций для transition эффектов (например, '200ms', '0.5s').
     * Используется для CSS transitions overlay и Framer Motion анимаций content.
     */
    duration?: UIDuration;
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

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
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

function emitModalTelemetry(telemetry: UiTelemetryApi, payload: ModalTelemetryPayload): void {
  telemetry.infoFireAndForget(`Modal ${payload.action}`, payload);
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
      variant = DEFAULT_VARIANT,
      duration = '200ms',
      ...filteredCoreProps
    } = domProps;
    const policy = useModalPolicy(props);

    // Парсим duration для Framer Motion (конвертируем '200ms' -> 0.2, '0.5s' -> 0.5)
    const durationSeconds = useMemo(() => {
      if (!duration) return DEFAULT_DURATION_SECONDS;
      const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
      if (!match) return DEFAULT_DURATION_SECONDS;
      const value = parseFloat(match[1] ?? '200');
      const unit = match[2];
      return unit === 'ms' ? value / 1000 : value;
    }, [duration]);

    // Минимальный набор telemetry-данных
    const telemetryProps = useMemo(() => ({
      variant,
    }), [variant]);

    // Lifecycle telemetry фиксирует состояние policy на момент первого рендера
    // Не реагирует на последующие изменения props или policy
    // Это архитектурная гарантия
    const lifecyclePayloadRef = useRef<
      {
        mount: ModalTelemetryPayload;
        unmount: ModalTelemetryPayload;
      } | undefined
    >(undefined);

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

    // Telemetry lifecycle
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitModalTelemetry(telemetry, lifecyclePayload.mount);
      return (): void => {
        emitModalTelemetry(telemetry, lifecyclePayload.unmount);
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
        emitModalTelemetry(telemetry, currentVisibility ? showPayload : hidePayload);
      }

      prevVisibleRef.current = currentVisibility;
    }, [policy.telemetryEnabled, policy.isRendered, showPayload, hidePayload, telemetry]);

    const testId = props['data-testid'] ?? 'core-modal';

    // CSS transitions для overlay (opacity) - применяется через style CoreModal
    const overlayTransitionStyle = useMemo(() => ({
      transition: `opacity ${duration} ease, transform ${duration} ease`,
    }), [duration]);

    // Framer Motion variants для modal content (scale + opacity)
    const contentVariants = useMemo(() => ({
      initial: {
        opacity: 0,
        scale: INITIAL_SCALE,
      },
      animate: {
        opacity: 1,
        scale: 1,
        transition: {
          duration: durationSeconds,
          ease: EASE_OUT_CUBIC_BEZIER,
        },
      },
      exit: {
        opacity: 0,
        scale: INITIAL_SCALE,
        transition: {
          duration: durationSeconds,
          ease: EASE_IN_CUBIC_BEZIER,
        },
      },
    }), [durationSeconds]);

    return (
      <AnimatePresence mode='wait'>
        {policy.isRendered && (
          <motion.div
            key='modal-wrapper'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durationSeconds }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...overlayTransitionStyle,
            }}
          >
            <motion.div
              variants={contentVariants}
              initial='initial'
              animate='animate'
              exit='exit'
            >
              <CoreModal
                ref={ref}
                visible={true}
                variant={variant}
                data-component='AppModal'
                data-state='visible'
                data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                style={{
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  ...(filteredCoreProps.style as Record<string, unknown>),
                }}
                {...(omit(filteredCoreProps, ['style']) as typeof filteredCoreProps)}
                data-testid={testId}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

ModalComponent.displayName = 'Modal';

/**
 * UI-контракт Modal компонента.
 * @contract
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия модального окна
 * - Корректная обработка accessibility (focus management, ARIA)
 * Инварианты:
 * - Focus trap работает корректно при открытии
 * - Overlay блокирует взаимодействие с остальным UI
 * - ESC и backdrop click закрывают модальное окно
 * - Telemetry payload содержит корректные размеры
 * - Telemetry отражает состояние policy, а не сырые props
 * - visible/hidden в payload являются производными только от policy
 * Не допускается:
 * - Использование напрямую core Modal компонента
 * - Игнорирование feature flag логики
 * - Нарушение focus management контрактов
 * - Модификация telemetry payload структуры
 * - Использование props.visible напрямую вне policy
 */
export const Modal = memo(ModalComponent);
