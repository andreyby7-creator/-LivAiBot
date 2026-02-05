/**
 * @file packages/app/src/ui/textarea.tsx
 * ============================================================================
 * 🟥 APP UI TEXTAREA — UI МИКРОСЕРВИС ТЕКСТОВОГО ПОЛЯ
 * ============================================================================
 *
 * Единственная точка входа для Textarea в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (disabled / hidden / variant)
 * - Telemetry
 * - Feature flags
 * - Accessibility контекст
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import React, { memo, useCallback, useEffect, useMemo } from 'react';
import type { JSX } from 'react';

import { Textarea as CoreTextarea } from '../../../ui-core/src/primitives/textarea.js';
import type { CoreTextareaProps } from '../../../ui-core/src/primitives/textarea.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { Json } from '../types/common.js';
import type {
  AppWrapperProps,
  MapCoreProps,
  UiFeatureFlags,
  UiPrimitiveProps,
  UiTelemetryApi,
} from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте textarea wrapper */
export type TextareaUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте textarea */
export type TextareaWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте textarea */
export type TextareaMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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
 * 🧬 TYPES
 * ========================================================================== */

type TextareaTelemetryAction = 'mount' | 'unmount' | 'change' | 'focus' | 'blur';

type TextareaTelemetryPayload = Readonly<{
  component: 'Textarea';
  action: TextareaTelemetryAction;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
}>;

export type AppTextareaProps = Readonly<
  & CoreTextareaProps
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить интерактивность */
    isDisabledByFeatureFlag?: boolean;

    /** Feature flag: визуальный вариант */
    variantByFeatureFlag?: string;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Telemetry for user input */
    telemetryOnChange?: boolean;

    /** Telemetry for focus/blur */
    telemetryOnFocus?: boolean;
  }
>;

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryEnabled',
  'telemetryOnChange',
  'telemetryOnFocus',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type TextareaPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  readonly telemetryOnChange: boolean;
  readonly telemetryOnFocus: boolean;
}>;

function useTextareaPolicy(props: AppTextareaProps): TextareaPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<TextareaPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    disabledByFeatureFlag: disabled,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryEnabled !== false,
    telemetryOnChange: props.telemetryOnChange !== false,
    telemetryOnFocus: props.telemetryOnFocus !== false,
  }), [
    hidden,
    disabled,
    props.variantByFeatureFlag,
    props.telemetryEnabled,
    props.telemetryOnChange,
    props.telemetryOnFocus,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitTextareaTelemetry(
  telemetry: UiTelemetryApi,
  action: TextareaTelemetryAction,
  policy: TextareaPolicy,
): void {
  const payload: TextareaTelemetryPayload = {
    component: 'Textarea',
    action,
    variant: policy.variant,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
  };

  telemetry.infoFireAndForget(`Textarea ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP TEXTAREA
 * ========================================================================== */

function TextareaComponent(props: AppTextareaProps): JSX.Element | null {
  // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
  const domProps = omit(props, BUSINESS_PROPS);

  const {
    onChange,
    onFocus,
    onBlur,
    ...filteredCoreProps
  } = domProps;

  const policy = useTextareaPolicy(props);
  const { telemetry } = useUnifiedUI();

  // lifecycle telemetry
  useEffect(() => {
    if (policy.telemetryEnabled) {
      emitTextareaTelemetry(telemetry, 'mount', policy);
      return (): void => {
        emitTextareaTelemetry(telemetry, 'unmount', policy);
      };
    }
    return undefined;
    // Policy намеренно заморожена при монтировании.
    // Telemetry должна отражать начальный контекст рендеринга.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // event handlers
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (policy.disabledByFeatureFlag) return;

      if (policy.telemetryEnabled && policy.telemetryOnChange) {
        emitTextareaTelemetry(telemetry, 'change', policy);
      }

      onChange?.(event);
    },
    [policy, onChange, telemetry],
  );

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      if (policy.telemetryEnabled && policy.telemetryOnFocus) {
        emitTextareaTelemetry(telemetry, 'focus', policy);
      }

      onFocus?.(event);
    },
    [policy, onFocus, telemetry],
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      if (policy.telemetryEnabled && policy.telemetryOnFocus) {
        emitTextareaTelemetry(telemetry, 'blur', policy);
      }

      onBlur?.(event);
    },
    [policy, onBlur, telemetry],
  );

  // скрыт
  if (policy.hiddenByFeatureFlag) {
    return null;
  }

  // View (максимально тупая)
  return (
    <CoreTextarea
      {...filteredCoreProps}
      disabled={policy.disabledByFeatureFlag || undefined}
      data-variant={policy.variant}
      data-disabled={policy.disabledByFeatureFlag || undefined}
      aria-disabled={policy.disabledByFeatureFlag || undefined}
      aria-busy={policy.disabledByFeatureFlag || undefined}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

/**
 * UI-контракт Textarea компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка controlled/uncontrolled состояния
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Состояние value синхронизировано с onChange callback
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry events отправляются только при реальных изменениях
 *
 * Не допускается:
 * - Использование напрямую core Textarea компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование accessibility атрибутов
 * - Модификация telemetry payload структуры
 */
export const Textarea = Object.assign(memo(TextareaComponent), {
  displayName: 'Textarea',
});
