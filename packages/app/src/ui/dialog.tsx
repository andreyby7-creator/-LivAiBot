/**
 * @file packages/app/src/ui/dialog.tsx
 * ============================================================================
 * 🔴 APP UI DIALOG — UI МИКРОСЕРВИС МОДАЛЬНОГО ВЗАИМОДЕЙСТВИЯ
 * ============================================================================
 *
 * Роль:
 * - Единственная точка входа для Dialog во всём приложении
 * - UI boundary между ui-core/Dialog и бизнес-логикой
 * - Контроллер пользовательских модальных процессов
 *
 * Интеграции:
 * - telemetry ✓ (edge-based, fire-and-forget, lifecycle-aware)
 * - feature flags ✓ (hidden / disabled / variant / behavior)
 * - accessibility ✓ (aria-modal, role=dialog, escape/backdrop policy)
 * - performance ✓ (memo, useMemo, useCallback)
 *
 * Принципы:
 * - props → policy → handlers → view
 * - policy = единственный источник истины
 * - Side-effects строго изолированы
 * - JSX максимально «тупой»
 * - Компонент детерминированный, SSR-safe и platform-ready
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';

import { Dialog as CoreDialog } from '../../../ui-core/src/primitives/dialog.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { UiTelemetryApi } from '../types/ui-contracts.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Telemetry payload для Dialog. Типы не экспортируются наружу. */
type DialogTelemetryPayload = Readonly<{
  component: 'Dialog';
  action: 'mount' | 'unmount' | 'open' | 'close';
  open: boolean;
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
}>;

/** App-уровневые пропсы Dialog. */
export type AppDialogProps = Readonly<{
  /** Controlled mode: внешнее управление открытием */
  isOpen?: boolean;

  /** Uncontrolled mode: начальное состояние */
  defaultOpen?: boolean;

  /** Feature flag: скрыть диалог полностью */
  isHiddenByFeatureFlag?: boolean;

  /** Feature flag: запретить интерактивность */
  isDisabledByFeatureFlag?: boolean;

  /** Feature flag: вариант диалога (data-variant) */
  variantByFeatureFlag?: string;

  /** Поведение: закрывать по клику на backdrop */
  closeOnBackdropClick?: boolean;

  /** Поведение: закрывать по Escape */
  closeOnEscape?: boolean;

  /** Telemetry: включена ли аналитика (по умолчанию true) */
  telemetryEnabled?: boolean;

  /** Callback: диалог открылся */
  onOpen?: () => void;

  /** Callback: диалог закрылся */
  onClose?: () => void;

  /** Children — контент диалога */
  children: React.ReactNode;

  /** Optional id / test attributes */
  id?: string;
  'data-testid'?: string;

  /** Accessibility: ID элемента с заголовком диалога */
  'aria-labelledby'?: string;

  /** Accessibility: ID элемента с описанием диалога */
  'aria-describedby'?: string;
}>;

/* ============================================================================
 * 🧠 POLICY LAYER
 * ========================================================================== */

/** DialogPolicy — контракт поведения Dialog. Это и есть «микросервисный API» модального взаимодействия. */
type DialogPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  open: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  closeOnBackdropClick: boolean;
  closeOnEscape: boolean;
}>;

/** DialogPolicyController — контроллер управления Dialog с разделением данных и управления. */
type DialogPolicyController = Readonly<{
  policy: DialogPolicy;
  setOpen: (value: boolean) => void;
}>;

/**
 * Resolve policy из props + feature flags.
 * Единственное место, где UI знает про:
 * - feature flags
 * - controlled / uncontrolled логику
 */
function useDialogPolicy(props: AppDialogProps): DialogPolicyController {
  const {
    isOpen,
    defaultOpen,
    isHiddenByFeatureFlag,
    isDisabledByFeatureFlag,
    variantByFeatureFlag,
    telemetryEnabled,
    closeOnBackdropClick = true,
    closeOnEscape = true,
  } = props;

  const hidden = Boolean(isHiddenByFeatureFlag);
  const disabled = Boolean(isDisabledByFeatureFlag);

  /** Uncontrolled state */
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen ?? false);

  /** Controlled vs Uncontrolled */
  const isControlled = isOpen !== undefined;

  if (
    process.env['NODE_ENV'] === 'development'
    && isControlled
    && props.defaultOpen !== undefined
  ) {
    throw new Error(
      '[Dialog] Нельзя одновременно использовать isOpen (controlled) и defaultOpen (uncontrolled). Выберите один режим.',
    );
  }

  const effectiveOpen = isControlled ? Boolean(isOpen) : internalOpen;

  /** Expose setter only in uncontrolled mode */
  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setInternalOpen(value);
      }
    },
    [isControlled],
  );

  /** Policy = единственный источник истины */
  const policy = useMemo<DialogPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    disabledByFeatureFlag: disabled,
    open: effectiveOpen,
    variant: variantByFeatureFlag ?? null,
    telemetryEnabled: telemetryEnabled !== false,
    closeOnBackdropClick,
    closeOnEscape,
  }), [
    hidden,
    disabled,
    effectiveOpen,
    variantByFeatureFlag,
    telemetryEnabled,
    closeOnBackdropClick,
    closeOnEscape,
  ]);

  return { policy, setOpen };
}

/* ============================================================================
 * 📡 TELEMETRY EFFECTS
 * ========================================================================== */

function emitDialogTelemetry(
  telemetry: UiTelemetryApi,
  action: DialogTelemetryPayload['action'],
  policy: DialogPolicy,
): void {
  // Асинхронная telemetry для минимизации blocking при heavy logging
  queueMicrotask(() => {
    telemetry.infoFireAndForget(`Dialog ${action}`, {
      component: 'Dialog',
      action,
      open: policy.open,
      variant: policy.variant,
      hidden: policy.hiddenByFeatureFlag,
      disabled: policy.disabledByFeatureFlag,
    });
  });
}

/* ============================================================================
 * 🎯 APP DIALOG
 * ========================================================================== */

function DialogComponent(props: AppDialogProps): JSX.Element | null {
  const { telemetry } = useUnifiedUI();
  const {
    children,
    onOpen,
    onClose,
    id,
    'data-testid': dataTestId,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
  } = props;

  const controller = useDialogPolicy(props);
  const { policy, setOpen } = controller;

  /** Lifecycle telemetry */
  useEffect(() => {
    emitDialogTelemetry(telemetry, 'mount', policy);
    return (): void => {
      emitDialogTelemetry(telemetry, 'unmount', policy);
    };
    // policy фиксируется на mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry]);

  /** Edge-based open/close telemetry */
  const prevOpenRef = useRef<boolean | null>(null);

  useEffect(() => {
    /*
      Intentional side-effect для отслеживания состояния Dialog.
      Необходимо для корректной телеметрии при открытии/закрытии.
    */

    if (prevOpenRef.current === null) {
      // eslint-disable-next-line functional/immutable-data
      prevOpenRef.current = policy.open; // intentional side-effect для telemetry
      return;
    }

    if (policy.open !== prevOpenRef.current) {
      emitDialogTelemetry(telemetry, policy.open ? 'open' : 'close', policy);

      // eslint-disable-next-line functional/immutable-data
      prevOpenRef.current = policy.open; // intentional side-effect для telemetry

      if (policy.open) {
        onOpen?.();
      } else {
        onClose?.();
      }
    }
  }, [policy.open, policy, onOpen, onClose, telemetry]);

  /** Handlers (effects isolated here) */
  const handleClose = useCallback(() => {
    if (policy.disabledByFeatureFlag) return;
    setOpen(false);
  }, [policy.disabledByFeatureFlag, setOpen]);

  const handleBackdropClick = useCallback(() => {
    if (!policy.closeOnBackdropClick) return;
    handleClose();
  }, [policy.closeOnBackdropClick, handleClose]);

  const handleEscape = useCallback(() => {
    if (!policy.closeOnEscape) return;
    handleClose();
  }, [policy.closeOnEscape, handleClose]);

  /** Hidden / Closed state. JSX знает только policy */
  if (policy.hiddenByFeatureFlag || !policy.open) {
    return null;
  }

  /** View (максимально «тупая») */
  return (
    <CoreDialog
      open={policy.open}
      onBackdropClick={handleBackdropClick}
      onEscape={handleEscape}
      data-variant={policy.variant}
      {...(policy.disabledByFeatureFlag && { 'data-disabled': policy.disabledByFeatureFlag })}
      {...(id != null ? { id } : {})}
      {...(dataTestId != null ? { 'data-testid': dataTestId } : {})}
      {...(ariaLabelledBy != null ? { 'aria-labelledby': ariaLabelledBy } : {})}
      {...(ariaDescribedBy != null ? { 'aria-describedby': ariaDescribedBy } : {})}
    >
      {children}
    </CoreDialog>
  );
}

/**
 * UI-контракт Dialog компонента.
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
 * - Focus trap активируется при открытии
 * - Overlay блокирует взаимодействие с фоном
 * - Feature flags применяются корректно к visibility и disabled
 *
 * Не допускается:
 * - Использование напрямую core Dialog компонента
 * - Смешивание controlled и uncontrolled режимов
 * - Игнорирование focus management контрактов
 * - Модификация telemetry payload структуры
 */
export const Dialog = Object.assign(memo(DialogComponent), {
  displayName: 'Dialog',
});

/* ============================================================================
 * 🧩 ARCHITECTURAL CONTRACT
 * ========================================================================== */
/**
 * Этот файл — UI boundary и UI-микросервис управления модальными процессами.
 *
 * Dialog теперь:
 * - имеет один источник истины (policy)
 * - поддерживает controlled / uncontrolled режимы корректно
 * - использует edge-based telemetry
 * - полностью изолирует side-effects
 * - готов к:
 *   - A/B тестам
 *   - security audit
 *   - platform overrides
 *   - продуктовой аналитике
 *
 * Любые изменения поведения:
 * - добавляются ТОЛЬКО здесь
 *
 * Feature-код не меняется.
 * ui-core не меняется.
 */
