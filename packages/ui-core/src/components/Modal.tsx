/**
 * @file packages/ui-core/src/components/Modal.tsx
 * ============================================================================
 * 🔵 CORE UI MODAL — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения модальных окон
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием (открыт/закрыт)
 * - Таймеров или анимаций
 * Управление:
 * - Видимостью и поведением управляет App-слой
 */

import type { CSSProperties, HTMLAttributes, JSX, ReactNode, Ref } from 'react';
import { forwardRef, memo, useMemo } from 'react';

import type { UIDuration, UISemanticStatus, UISize } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Типы модального окна: может расширяться в App-слое */
/** Визуальный вариант Modal (семантическое значение). */
export type ModalVariant = UISemanticStatus;

/** Дефолтный z-index для оверлея модального окна */
const DEFAULT_OVERLAY_Z_INDEX = 9999;

export type CoreModalProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** Видимость модального окна */
    visible?: boolean;

    /** Контент модального окна */
    children: ReactNode;

    /** Variant модального окна (визуальное семантическое значение) */
    variant?: ModalVariant;

    /** Заголовок модального окна */
    title?: string;

    /** Ширина модального окна */
    width?: UISize;

    /** Высота модального окна */
    height?: UISize;

    /** Z-index оверлея модального окна */
    overlayZIndex?: number;

    /**
     * Длительность анимаций (для будущих transition эффектов).
     * Пока не используется, но оставлено для обратной совместимости.
     */
    duration?: UIDuration;

    /** Test ID для автотестов */
    'data-testid'?: string;

    /** Data state для унифицированной диагностики (App слой) */
    'data-state'?: string;

    /**
     * ARIA метки для модального окна.
     * aria-label имеет больший приоритет, чем aria-labelledby
     */
    'aria-label'?: string | undefined;
    'aria-labelledby'?: string | undefined;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

/**
 * Базовые стили оверлея модального окна.
 * Создает полупрозрачный фон и центрирует контент.
 */
const OVERLAY_BASE_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Базовые стили контейнера модального окна.
 * Определяет внешний вид, размеры и layout модалки.
 */
const MODAL_BASE_STYLE: CSSProperties = {
  backgroundColor: 'white',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  boxSizing: 'border-box',
  maxWidth: '90%',
  maxHeight: '90%',
  overflow: 'auto',
  padding: '16px 24px',
  display: 'flex',
  flexDirection: 'column',
};

/**
 * Стили для заголовка модального окна.
 * Добавляет отступ снизу для разделения от контента.
 */
const TITLE_STYLE: CSSProperties = {
  margin: '0 0 12px 0',
};

/* ============================================================================
 * 🎯 CORE MODAL
 * ========================================================================== */

const CoreModalComponent = forwardRef<HTMLDivElement, CoreModalProps>(
  function CoreModalComponent(props, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const {
      visible = false,
      children,
      variant = 'default',
      title,
      width,
      height,
      overlayZIndex,
      // duration: оставлено в типе для будущих transition эффектов
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const overlayStyle: CSSProperties = useMemo(() => ({
      ...OVERLAY_BASE_STYLE,
      zIndex: overlayZIndex ?? DEFAULT_OVERLAY_Z_INDEX,
    }), [overlayZIndex]);

    const combinedModalStyle: CSSProperties = useMemo(() => ({
      ...MODAL_BASE_STYLE,
      width,
      height,
      border: variant !== 'default' ? `1px solid var(--modal-${variant}-border, #ccc)` : undefined,
      ...style,
    }), [width, height, variant, style]);

    if (!visible) return null;

    return (
      <div
        role='dialog'
        aria-modal='true'
        data-component='CoreModal'
        data-variant={variant}
        data-state='visible'
        data-testid={testId}
        style={overlayStyle}
        {...rest}
      >
        <div
          ref={ref}
          className={className}
          style={combinedModalStyle}
        >
          {title != null && title !== '' && <h2 style={TITLE_STYLE}>{title}</h2>}
          {children}
        </div>
      </div>
    );
  },
);

/**
 * Memoized CoreModal.
 * Гарантии:
 * - Полностью детерминированный
 * - Side-effect free
 * - SSR и concurrent safe
 * - Поддержка ref forwarding
 * - Подходит как базовый building-block для App-слоя
 */
export const Modal = memo(CoreModalComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreModal — это чистый presentational primitive:
 * - Не управляет состоянием видимости
 * - Не содержит логики закрытия или открытия
 * - Не имеет встроенных анимаций
 * - Поддерживает ref forwarding
 * Любая бизнес-логика:
 * - когда показывать модалку
 * - что внутри (children)
 * - управление событиями
 * должна реализовываться на App-слое.
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 */
