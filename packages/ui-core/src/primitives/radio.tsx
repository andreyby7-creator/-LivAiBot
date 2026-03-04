/**
 * @file packages/ui-core/src/primitives/radio.tsx
 * ============================================================================
 * 🔵 CORE UI RADIO — BEHAVIORAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-примитив для <input type="radio">
 * - Управляет DOM side-effects:
 *   - autoFocus (без прокрутки страницы)
 *   - platform-поведением
 * - Полностью deterministic, SSR-safe и side-effect isolated
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

export type CoreRadioProps = Readonly<
  & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'autoFocus'>
  & {
    /**
     * Автофокус при монтировании компонента.
     * Выполняется без скролла страницы.
     * @default false
     */
    autoFocus?: boolean;
  }
>;

/* ============================================================================
 * 🎯 CORE RADIO
 * ========================================================================== */

const CoreRadioComponent = forwardRef<HTMLInputElement, CoreRadioProps>(
  function CoreRadioComponent(props, ref): JSX.Element {
    const { autoFocus = false, ...rest } = props;

    const internalRef = useRef<HTMLInputElement | null>(null);
    const hasFocusedRef = useRef(false);
    const fallbackRef = useRef(document.createElement('input'));

    /** Ref forwarding без мутации объекта */
    useImperativeHandle(ref, () => internalRef.current ?? fallbackRef.current, [internalRef]);

    /** Focus management */
    useEffect(() => {
      if (!autoFocus) return;
      const node = internalRef.current;
      if (!node) return;
      if (hasFocusedRef.current) return;

      const id = setTimeout(() => {
        node.focus({ preventScroll: true });
      }, 0);

      hasFocusedRef.current = true;
      return (): void => {
        clearTimeout(id);
      };
    }, [autoFocus]);

    return (
      <input
        type='radio'
        ref={internalRef}
        data-component='CoreRadio'
        aria-checked={rest.checked ?? false}
        aria-busy={rest.disabled ?? undefined}
        {...rest}
      />
    );
  },
);

/**
 * Memoized CoreRadio.
 * Гарантии:
 * - Никаких скрытых side-effects
 * - Предсказуемый жизненный цикл
 * - Полная совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding для form-libs и программного доступа
 * Подходит для:
 * - форм
 * - фильтров
 * - workflow UI
 * - design-system интеграций
 */
export const Radio = memo(CoreRadioComponent);
