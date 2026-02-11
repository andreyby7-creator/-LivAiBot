/**
 * @file packages/ui-core/src/primitives/toggle.tsx
 * ============================================================================
 * 🔵 CORE UI TOGGLE — BEHAVIORAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-примитив для Toggle/Switch
 * - Управляет DOM side-effects:
 *   - autoFocus (без прокрутки страницы)
 *   - platform-поведением
 * - Полностью deterministic, SSR-safe и side-effect isolated
 *
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - продуктовых решений
 */

import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { InputHTMLAttributes, JSX } from 'react';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type CoreToggleProps = Readonly<
  & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'autoFocus' | 'indeterminate'>
  & {
    /**
     * Автофокус при монтировании компонента.
     * Выполняется без скролла страницы.
     *
     * @default false
     */
    autoFocus?: boolean;

    /**
     * Состояние toggle.
     *
     * @important Всегда используйте контролируемое состояние (checked) для предсказуемости
     * в concurrent rendering. defaultChecked НЕ ИСПОЛЬЗУЙТЕ - может вызывать расхождения
     * между DOM и React state, особенно в strict mode и concurrent features.
     */
    checked?: boolean;

    /**
     * Неопределённое состояние toggle (indeterminate).
     * Используется для частично выбранных состояний.
     *
     * @default false
     */
    indeterminate?: boolean;
  }
>;

/* ============================================================================
 * 🎯 CORE TOGGLE
 * ========================================================================== */

const CoreToggleComponent = forwardRef<HTMLInputElement, CoreToggleProps>(
  function CoreToggleComponent(props, ref): JSX.Element {
    const { autoFocus = false, indeterminate, ...rest } = props;

    const internalRef = useRef<HTMLInputElement | null>(null);
    const hasFocusedRef = useRef(false);
    const fallbackRef = useRef(document.createElement('input'));

    /** Ref forwarding без мутаций */
    useImperativeHandle(ref, () => internalRef.current ?? fallbackRef.current, [internalRef]);

    /** Focus management */
    useEffect(() => {
      if (!autoFocus) return;
      const node = internalRef.current;
      if (!node || hasFocusedRef.current) return;

      const id = setTimeout(() => {
        node.focus({ preventScroll: true });
      }, 0);

      hasFocusedRef.current = true;
      return (): void => {
        clearTimeout(id);
      };
    }, [autoFocus]);

    /** Indeterminate state management */
    useEffect(() => {
      if (internalRef.current && 'indeterminate' in internalRef.current) {
        internalRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    return (
      <input
        type='checkbox'
        role='switch'
        ref={internalRef}
        data-component='CoreToggle'
        aria-checked={rest.checked ?? false}
        aria-pressed={rest.checked ?? false}
        aria-disabled={rest.disabled ?? undefined}
        aria-busy={rest.disabled ?? undefined}
        {...rest}
      />
    );
  },
);

/**
 * Memoized CoreToggle.
 *
 * Гарантии:
 * - Никаких скрытых side-effects
 * - Предсказуемый жизненный цикл
 * - Полная совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding для form-libs и программного доступа
 *
 * Подходит для:
 * - форм
 * - фильтров
 * - workflow UI
 * - design-system интеграций
 */
export const Toggle = memo(CoreToggleComponent);
