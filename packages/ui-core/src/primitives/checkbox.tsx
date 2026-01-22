/**
 * @file packages/ui-core/src/primitives/checkbox.tsx
 * ============================================================================
 * 🔵 CORE UI CHECKBOX — BEHAVIORAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-примитив для <input type="checkbox">
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

export type CoreCheckboxProps = Readonly<
  & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'autoFocus' | 'indeterminate'>
  & {
    /**
     * Автофокус при монтировании компонента.
     * Выполняется без скролла страницы.
     *
     * @default false
     */
    autoFocus?: boolean | undefined;

    /**
     * Неопределённое состояние checkbox (indeterminate).
     * Используется для частично выбранных состояний.
     *
     * @default false
     */
    indeterminate?: boolean;
  }
>;

/* ============================================================================
 * 🎯 CORE CHECKBOX
 * ========================================================================== */

const CoreCheckboxComponent = forwardRef<HTMLInputElement, CoreCheckboxProps>(
  function CoreCheckboxComponent(props, ref): JSX.Element {
    const { autoFocus = false, ...rest } = props;

    const internalRef = useRef<HTMLInputElement | null>(null);
    const hasFocusedRef = useRef(false);

    /** Ref forwarding без мутации объекта */
    useImperativeHandle(ref, () => internalRef.current ?? document.createElement('input'), [
      internalRef,
    ]);

    /** Focus management */
    useEffect(() => {
      if (!autoFocus) return;
      const node = internalRef.current;
      if (!node) return;
      if (hasFocusedRef.current) return;

      // Focus в следующем макротаске для полной совместимости
      const id = setTimeout(() => {
        node.focus({ preventScroll: true });
      }, 0);

      hasFocusedRef.current = true; // eslint-disable-line functional/immutable-data
      return (): void => {
        clearTimeout(id);
      };
    }, [autoFocus]);

    /** Indeterminate state management */
    useEffect(() => {
      if (internalRef.current && 'indeterminate' in internalRef.current) {
        internalRef.current.indeterminate = Boolean(rest.indeterminate); // eslint-disable-line functional/immutable-data
      }
    }, [rest.indeterminate]);

    return (
      <input
        ref={internalRef}
        type='checkbox'
        aria-checked={Boolean(rest.checked)}
        aria-busy={rest.disabled ?? undefined}
        data-component='CoreCheckbox'
        {...rest}
      />
    );
  },
);

/**
 * Memoized CoreCheckbox.
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
export const Checkbox = memo(CoreCheckboxComponent);
