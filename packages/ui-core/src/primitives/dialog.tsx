/**
 * @file packages/ui-core/src/components/Dialog.tsx
 * ============================================================================
 * 🔵 CORE UI DIALOG — МОДАЛЬНЫЙ ПРИМИТИВ
 * ============================================================================
 *
 * Роль:
 * - Абстракция модального окна для всех UI wrapper'ов приложения
 * - Управляет backdrop, фокусом, escape/backdrop закрытием
 * - Полностью platform- и accessibility-ready
 *
 * Интеграции:
 * - accessibility ✓ (role=dialog, aria-modal, focus trap)
 * - layering ✓ (zIndex, portal)
 * - side-effects изолированы (focus, scroll lock)
 * - performance ✓ (memo, useMemo, useCallback)
 *
 * Принципы:
 * - DOM и визуальные эффекты внутри core
 * - Wrapper проксирует policy и handlers
 * - JSX максимально «тупой» для wrapper
 */

import React, { memo, useCallback, useLayoutEffect, useRef } from 'react';
import type { JSX } from 'react';
import ReactDOM from 'react-dom';

export type CoreDialogProps = Readonly<{
  /** Открыт ли диалог */
  open: boolean;

  /** Обработчик клика на backdrop */
  onBackdropClick?: () => void;

  /** Обработчик нажатия Escape */
  onEscape?: () => void;

  /** Вариант / data атрибут */
  'data-variant'?: string | null;

  /** Состояние отключения */
  'data-disabled'?: boolean;

  /** Z-index для слоев */
  zIndex?: number;

  /** Дочерние элементы — контент диалога */
  children: React.ReactNode;

  /** Опциональные id / тестовые атрибуты */
  id?: string;
  'data-testid'?: string;

  /** Accessibility: ID элемента с заголовком диалога */
  'aria-labelledby'?: string;

  /** Accessibility: ID элемента с описанием диалога */
  'aria-describedby'?: string;

  /** Контейнер для портала (по умолчанию document.body) */
  container?: HTMLElement | null;
}>;

/* ============================================================================
 * 🎯 CORE DIALOG
 * ========================================================================== */

/** Глобальный счетчик модальных окон для управления scroll lock */
let modalCount = 0;

function CoreDialogComponent(props: Readonly<CoreDialogProps>): JSX.Element | null {
  const {
    open,
    onBackdropClick,
    onEscape,
    zIndex = 1000,
    container,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    children,
    ...rest
  } = props;

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  /** Обновить кеш фокусируемых элементов */
  const updateFocusableElements = useCallback((): void => {

    /*
      Intentional side-effect для кеширования focusable элементов.
      Это необходимо для focus trap в UI primitive Dialog.
    */

    if (!panelRef.current) {
      // eslint-disable-next-line functional/immutable-data
      focusableElementsRef.current = []; // intentional side-effect для кеширования
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    focusableElementsRef.current = Array.from(panelRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )); // intentional side-effect для кеширования


  }, []);

  /** Получить закешированные фокусируемые элементы */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    return focusableElementsRef.current;
  }, []);

  const focusFirstElement = useCallback((): void => {
    const focusable = getFocusableElements();
    if (focusable.length > 0 && focusable[0]) {
      focusable[0].focus();
    }
  }, [getFocusableElements]);

  /** Обработка клавиши Escape */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      // Focus trap
      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (!firstElement || !lastElement) return;

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else if (document.activeElement === lastElement) {
          // Tab
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [onEscape, getFocusableElements],
  );

  /** Настройка фокуса и scroll lock */
  useLayoutEffect(() => {

    /*
      Разрешаем intentional side-effects для UI primitive Dialog:
      - focus management: сохранение/восстановление фокуса
      - scroll lock: блокировка прокрутки body
      - MutationObserver: отслеживание динамических изменений контента
      Эти эффекты изолированы внутри UI primitive и не нарушают FP принципы
    */

    if (!open) {
      return;
    }

    // Сохранить текущий фокус (intentional side-effect для focus management)
    // eslint-disable-next-line functional/immutable-data
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Предотвратить прокрутку body (со счетчиком модальных окон)
    modalCount++; // intentional side-effect для scroll lock management
    const originalOverflow = document.body.style.overflow;
    if (modalCount === 1) {
      // eslint-disable-next-line functional/immutable-data
      document.body.style.overflow = 'hidden'; // intentional side-effect для scroll lock
    }

    // Добавить слушатель клавиатуры
    document.addEventListener('keydown', handleKeyDown);

    // Обновить кеш фокусируемых элементов
    updateFocusableElements();

    // Настроить MutationObserver для динамических изменений контента
    if (panelRef.current && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        updateFocusableElements();
      });

      observer.observe(panelRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['tabindex', 'disabled', 'hidden', 'aria-hidden'],
      });


      // eslint-disable-next-line functional/immutable-data
      mutationObserverRef.current = observer; // intentional side-effect для dynamic content tracking
    }

    // Установить фокус на первый элемент синхронно после layout
    focusFirstElement();

    return (): void => {
      // Восстановить прокрутку body (со счетчиком модальных окон)
      modalCount = Math.max(0, modalCount - 1);
      if (modalCount === 0) {
        // eslint-disable-next-line functional/immutable-data
        document.body.style.overflow = originalOverflow;
      }

      // Удалить слушатель клавиатуры
      document.removeEventListener('keydown', handleKeyDown);

      // Остановить MutationObserver
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();

        // eslint-disable-next-line functional/immutable-data
        mutationObserverRef.current = null; // intentional side-effect для cleanup
      }

      // Восстановить фокус с fallback
      if (previousFocusRef.current?.focus) {
        try {
          previousFocusRef.current.focus();
        } catch {
          // Fallback: если предыдущий элемент disabled/скрыт/недоступен,
          // переносим фокус на document.body для корректного состояния
          document.body.focus();
        }
      }
    };

  }, [open, handleKeyDown, focusFirstElement, updateFocusableElements]);

  /** SSR безопасность и проверка открытия */
  if (typeof document === 'undefined' || !open) {
    return null;
  }

  /** Контейнер для портала (с fallback на document.body) */
  const portalContainer = container ?? document.body;

  /** Portal + backdrop + панель */
  return ReactDOM.createPortal(
    <div
      className='core-dialog-root'
      role='dialog'
      aria-modal
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      style={{ '--dialog-z-index': zIndex } as React.CSSProperties}
      {...rest}
    >
      {/* Backdrop */}
      <div
        className='core-dialog-backdrop'
        onClick={onBackdropClick}
        aria-hidden='true'
        role='presentation'
        aria-label='Dialog backdrop'
      />

      {/* Панель / контент */}
      <div ref={panelRef} className='core-dialog-panel'>
        {children}
      </div>
    </div>,
    portalContainer,
  );
}

/** Мемоизированный core dialog */
export const Dialog = memo(CoreDialogComponent);
