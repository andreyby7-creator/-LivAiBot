/**
 * @file packages/ui-core/src/components/ConfirmDialog.tsx
 * ============================================================================
 * 🔵 CORE UI CONFIRM DIALOG — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для диалогов подтверждения действий
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием видимости
 * - Таймеров или анимаций
 * Управление:
 * - Видимостью и поведением управляет App-слой
 */

import { forwardRef, memo, useCallback, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, JSX, ReactNode, Ref } from 'react';

import { Modal } from './Modal.js';
import type { ModalVariant } from './Modal.js';
import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type CoreConfirmDialogProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> & {
    /** Видимость диалога подтверждения. App слой всегда явно решает, показывать диалог или нет. */
    visible: boolean;

    /** Заголовок диалога */
    title?: string;

    /** Сообщение/описание в диалоге */
    message?: string | ReactNode;

    /** Текст на кнопке подтверждения. По умолчанию 'Подтвердить'. */
    confirmLabel?: string;

    /** Текст на кнопке отмены. По умолчанию 'Отменить'. */
    cancelLabel?: string;

    /** Variant диалога (семантическое значение). По умолчанию 'default'. */
    variant?: ModalVariant;

    /** Полностью блокирует все действия диалога (policy-уровневая блокировка). По умолчанию false. */
    disabled?: boolean;

    /** Ширина диалога. По умолчанию '400px'. */
    width?: string;

    /** Callback при подтверждении */
    onConfirm?: () => void;

    /** Callback при отмене */
    onCancel?: () => void;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const DIALOG_CONTENT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const DIALOG_MESSAGE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '14px',
  lineHeight: '1.5',
  color: 'var(--confirm-dialog-text-color, #374151)',
};

const DIALOG_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '8px',
};

const BUTTON_BASE_STYLE: CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  border: 'none',
  transition: 'background-color 0.2s ease, opacity 0.2s ease',
  minWidth: '80px',
};

const BUTTON_CONFIRM_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--confirm-dialog-confirm-bg, #3B82F6)',
  color: 'var(--confirm-dialog-confirm-text, #FFFFFF)',
};

const BUTTON_CONFIRM_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_CONFIRM_STYLE,
  opacity: 0.6,
  cursor: 'not-allowed',
};

const BUTTON_CANCEL_STYLE: CSSProperties = {
  ...BUTTON_BASE_STYLE,
  backgroundColor: 'var(--confirm-dialog-cancel-bg, #F3F4F6)',
  color: 'var(--confirm-dialog-cancel-text, #374151)',
};

const BUTTON_CANCEL_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_CANCEL_STYLE,
  opacity: 0.6,
  cursor: 'not-allowed',
};

/* ============================================================================
 * 🎯 CORE CONFIRM DIALOG
 * ========================================================================== */

const CoreConfirmDialogComponent = forwardRef<HTMLDivElement, CoreConfirmDialogProps>(
  function CoreConfirmDialogComponent(props, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const {
      visible,
      title,
      message,
      confirmLabel = 'Подтвердить',
      cancelLabel = 'Отменить',
      variant = 'default',
      disabled = false,
      width = '400px',
      onConfirm,
      onCancel,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    /** Helper для создания test ID с суффиксом. */
    const makeTestId = (suffix: string): string | undefined =>
      testId != null && testId !== '' ? `${testId}-${suffix}` : undefined;

    /** Обработчик подтверждения */
    const handleConfirm = useCallback((): void => {
      if (disabled) return;
      onConfirm?.();
    }, [disabled, onConfirm]);

    /** Обработчик отмены */
    const handleCancel = useCallback((): void => {
      if (disabled) return;
      onCancel?.();
    }, [disabled, onCancel]);

    /** Стили для кнопки подтверждения */
    const confirmButtonStyle: CSSProperties = useMemo(() => ({
      ...BUTTON_CONFIRM_STYLE,
      ...(disabled ? BUTTON_CONFIRM_DISABLED_STYLE : {}),
    }), [disabled]);

    /** Стили для кнопки отмены */
    const cancelButtonStyle: CSSProperties = useMemo(() => ({
      ...BUTTON_CANCEL_STYLE,
      ...(disabled ? BUTTON_CANCEL_DISABLED_STYLE : {}),
    }), [disabled]);

    /** Стили для контента диалога */
    const contentStyle: CSSProperties = useMemo(() => ({
      ...DIALOG_CONTENT_STYLE,
      ...style,
    }), [style]);

    return (
      <Modal
        ref={ref}
        visible={visible}
        variant={variant}
        width={width}
        {...(title !== undefined && { title })}
        {...(className !== undefined && { className })}
        data-component='CoreConfirmDialog'
        data-state={visible ? 'visible' : 'hidden'}
        data-disabled={disabled || undefined}
        {...(testId !== undefined && { 'data-testid': testId })}
        {...rest}
      >
        <div style={contentStyle} data-testid={makeTestId('content')}>
          {message != null && (
            <p style={DIALOG_MESSAGE_STYLE} data-testid={makeTestId('message')}>
              {message}
            </p>
          )}
          <div style={DIALOG_ACTIONS_STYLE} data-testid={makeTestId('actions')}>
            <button
              type='button'
              onClick={handleCancel}
              disabled={disabled}
              style={cancelButtonStyle}
              data-testid={makeTestId('cancel')}
            >
              {cancelLabel}
            </button>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={disabled}
              style={confirmButtonStyle}
              data-testid={makeTestId('confirm')}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </Modal>
    );
  },
);

CoreConfirmDialogComponent.displayName = 'CoreConfirmDialog';

/**
 * Memoized CoreConfirmDialog.
 * Полностью детерминированный, side-effect free, SSR и concurrent safe.
 * Поддерживает ref forwarding. Подходит как building-block для App-слоя.
 */
export const ConfirmDialog = memo(CoreConfirmDialogComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreConfirmDialog — это чистый presentational primitive:
 * - Не управляет состоянием видимости
 * - Не содержит логики закрытия или открытия
 * - Не имеет встроенных анимаций
 * - Поддерживает ref forwarding
 * Любая бизнес-логика:
 * - когда показывать диалог
 * - что делать при подтверждении/отмене
 * - управление событиями
 * должна реализовываться на App-слое.
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 * Компонент использует следующие CSS Variables для кастомизации через app theme:
 * - --confirm-dialog-text-color: цвет текста сообщения (default: #374151)
 * - --confirm-dialog-confirm-bg: цвет фона кнопки подтверждения (default: #3B82F6)
 * - --confirm-dialog-confirm-text: цвет текста кнопки подтверждения (default: #FFFFFF)
 * - --confirm-dialog-cancel-bg: цвет фона кнопки отмены (default: #F3F4F6)
 * - --confirm-dialog-cancel-text: цвет текста кнопки отмены (default: #374151)
 * Это превращает компонент в UI protocol, не просто в компонент.
 */
