/**
 * @file packages/app/src/ui/support-button.tsx
 * ============================================================================
 * 🟥 APP UI SUPPORT BUTTON — UI МИКРОСЕРВИС SUPPORT BUTTON
 * ============================================================================
 *
 * Единственная точка входа для SupportButton в приложении.
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
 * - Логики отправки обращений в поддержку
 * - Бизнес-логики обработки поддержки
 *
 * Архитектурные решения:
 * - Видимость кнопки поддержки контролируется App-слоем
 * - CoreSupportButton остается полностью presentational
 */

import { forwardRef, memo, useCallback, useEffect, useMemo } from 'react';
import type { JSX, MouseEvent, Ref } from 'react';

import { SupportButton as CoreSupportButton } from '../../../ui-core/src/components/SupportButton.js';
import type {
  CoreSupportButtonProps,
  SupportButtonVariant,
} from '../../../ui-core/src/components/SupportButton.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { UiTelemetryApi } from '../types/ui-contracts.js';

/* ============================================================================
 * 🧰 UTILITY FUNCTIONS
 * ========================================================================== */

function omit<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly string[],
): Partial<T> {
  const keySet = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keySet.has(key)),
  ) as Partial<T>;
}

/** Тип элемента, который может рендерить SupportButton */
type SupportButtonElement = HTMLButtonElement;

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

const SupportButtonTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  Click: 'click',
} as const;

type SupportButtonTelemetryAction =
  typeof SupportButtonTelemetryAction[keyof typeof SupportButtonTelemetryAction];

type SupportButtonTelemetryPayload = {
  component: 'SupportButton';
  action: SupportButtonTelemetryAction;
  timestamp: number;
  hidden: boolean;
  visible: boolean;
  disabled: boolean;
  variant: SupportButtonVariant;
  size: string;
};

const DEFAULT_VARIANT: SupportButtonVariant = 'default';

const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

const BUSINESS_PROPS = [
  'visible',
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'telemetryEnabled',
  'onSupportRequest',
  'labelI18nKey',
  'labelI18nNs',
  'labelI18nParams',
] as const;

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitSupportButtonTelemetry(
  telemetry: UiTelemetryApi,
  payload: SupportButtonTelemetryPayload,
): void {
  telemetry.infoFireAndForget(`SupportButton ${payload.action}`, payload);
}

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type SupportButtonPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * SupportButtonPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 * - disabled state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 */
function useSupportButtonPolicy(props: {
  visible?: boolean | undefined;
  isHiddenByFeatureFlag?: boolean | undefined;
  isDisabledByFeatureFlag?: boolean | undefined;
  telemetryEnabled?: boolean | undefined;
}): SupportButtonPolicy {
  return useMemo(() => {
    const hiddenByFeatureFlag = props.isHiddenByFeatureFlag === true;
    const disabledByFeatureFlag = props.isDisabledByFeatureFlag === true;
    const telemetryEnabled = props.telemetryEnabled !== false;

    const isRendered = !hiddenByFeatureFlag && props.visible !== false;

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      isRendered,
      telemetryEnabled,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.visible,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 🎯 APP SUPPORT BUTTON
 * ========================================================================== */

export type AppSupportButtonProps = Readonly<
  & Omit<CoreSupportButtonProps, 'data-testid' | 'label'>
  & {
    /** Видимость SupportButton (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть SupportButton */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить SupportButton */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Callback при клике на кнопку поддержки (App уровень) */
    onSupportRequest?: () => void;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
  & (
    | {
      /** I18n label режим */
      labelI18nKey: TranslationKey;
      labelI18nNs?: Namespace;
      labelI18nParams?: Record<string, string | number>;
      label?: never;
    }
    | {
      /** Обычный label режим */
      labelI18nKey?: never;
      labelI18nNs?: never;
      labelI18nParams?: never;
      label?: string;
    }
  )
>;

const AppSupportButtonComponent = forwardRef<SupportButtonElement, AppSupportButtonProps>(
  function AppSupportButtonComponent(
    props: AppSupportButtonProps,
    ref: Ref<SupportButtonElement>,
  ): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;

    const {
      visible: _visible, // used in policy
      isHiddenByFeatureFlag: _isHiddenByFeatureFlag, // used in policy
      isDisabledByFeatureFlag: _isDisabledByFeatureFlag, // used in policy
      telemetryEnabled: _telemetryEnabled, // used in policy
      onSupportClick,
      onSupportRequest,
      variant = DEFAULT_VARIANT,
      size = 'medium',
      'data-testid': dataTestId,
      ...domProps
    } = props;

    // Label: i18n → обычный label → undefined
    const label = useMemo<string | undefined>(() => {
      if ('labelI18nKey' in props) {
        const effectiveNs = props.labelI18nNs ?? 'common';
        return translate(effectiveNs, props.labelI18nKey, props.labelI18nParams ?? EMPTY_PARAMS);
      }
      return domProps.label;
    }, [props, translate, domProps.label]);

    const policy = useSupportButtonPolicy({
      visible: _visible,
      isHiddenByFeatureFlag: _isHiddenByFeatureFlag,
      isDisabledByFeatureFlag: _isDisabledByFeatureFlag,
      telemetryEnabled: _telemetryEnabled,
    });

    /** Telemetry props */
    const telemetryProps = useMemo(
      () => ({
        variant,
        size,
      }),
      [variant, size],
    );

    /** Lifecycle telemetry payload - реактивный, обновляется при изменении зависимостей */
    const lifecyclePayload = useMemo(
      () => ({
        mount: {
          component: 'SupportButton' as const,
          action: SupportButtonTelemetryAction.Mount,
          hidden: policy.hiddenByFeatureFlag,
          visible: policy.isRendered,
          disabled: policy.disabledByFeatureFlag,
          ...telemetryProps,
        },
        unmount: {
          component: 'SupportButton' as const,
          action: SupportButtonTelemetryAction.Unmount,
          hidden: policy.hiddenByFeatureFlag,
          visible: policy.isRendered,
          disabled: policy.disabledByFeatureFlag,
          ...telemetryProps,
        },
      }),
      [
        policy.hiddenByFeatureFlag,
        policy.isRendered,
        policy.disabledByFeatureFlag,
        telemetryProps,
      ],
    );

    /** Telemetry lifecycle */
    useEffect(() => {
      if (!policy.telemetryEnabled) return;

      emitSupportButtonTelemetry(telemetry, {
        ...lifecyclePayload.mount,
        timestamp: Date.now(),
      });

      return (): void => {
        emitSupportButtonTelemetry(telemetry, {
          ...lifecyclePayload.unmount,
          timestamp: Date.now(),
        });
      };
    }, [policy.telemetryEnabled, lifecyclePayload, telemetry]);

    /** Объединяем стили для disabled состояния */
    const combinedDisabled = useMemo(
      () => props.disabled === true || policy.disabledByFeatureFlag,
      [props.disabled, policy.disabledByFeatureFlag],
    );

    /** Обработчик клика с App-level логикой */
    const handleSupportClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        // Telemetry для клика
        if (policy.telemetryEnabled) {
          emitSupportButtonTelemetry(telemetry, {
            component: 'SupportButton' as const,
            action: SupportButtonTelemetryAction.Click,
            timestamp: Date.now(),
            hidden: policy.hiddenByFeatureFlag,
            visible: policy.isRendered,
            disabled: combinedDisabled,
            ...telemetryProps,
          });
        }

        // Вызываем App-level callback
        onSupportRequest?.();

        // Вызываем Core callback
        onSupportClick?.(event);
      },
      [
        policy.telemetryEnabled,
        policy.hiddenByFeatureFlag,
        policy.isRendered,
        combinedDisabled,
        telemetryProps,
        onSupportRequest,
        onSupportClick,
        telemetry,
      ],
    );

    /** Policy: hidden */
    if (!policy.isRendered) return null;

    return (
      <CoreSupportButton
        ref={ref}
        variant={variant}
        size={size}
        disabled={combinedDisabled}
        onSupportClick={handleSupportClick}
        {...(label !== undefined && { label })}
        data-component='AppSupportButton'
        data-state={policy.disabledByFeatureFlag ? 'disabled' : 'active'}
        data-feature-flag={policy.hiddenByFeatureFlag ? 'hidden' : 'visible'}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(dataTestId != null && dataTestId !== '' && { 'data-testid': dataTestId })}
        {...omit(domProps, BUSINESS_PROPS)}
      />
    );
  },
);

AppSupportButtonComponent.displayName = 'SupportButton';

/**
 * UI-контракт SupportButton компонента.
 *
 * Stateful UI-фасад над CoreSupportButton.
 * Управляет policy, telemetry и feature flags.
 *
 * @example
 * ```tsx
 * // Базовая кнопка поддержки
 * <SupportButton onSupportRequest={() => openSupportChat()} />
 *
 * // Floating кнопка с кастомным текстом
 * <SupportButton
 *   variant="floating"
 *   label="Нужна помощь?"
 *   onSupportRequest={handleSupport}
 * />
 *
 * // Отключенная кнопка через feature flag
 * <SupportButton
 *   isDisabledByFeatureFlag={true}
 *   onSupportRequest={handleSupport}
 * />
 * ```
 */
export const SupportButton = memo(AppSupportButtonComponent);
