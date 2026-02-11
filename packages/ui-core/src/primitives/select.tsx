/**
 * @file packages/ui-core/src/primitives/select.tsx
 * ============================================================================
 * 🔵 CORE UI SELECT — BEHAVIORAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-примитив для <select>
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
import type { JSX, SelectHTMLAttributes } from 'react';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type CoreSelectProps = Readonly<
  & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'autoFocus'>
  & {
    /**
     * Автофокус при монтировании компонента.
     * Выполняется без скролла страницы.
     *
     * @default false
     */
    autoFocus?: boolean;
  }
>;

/* ============================================================================
 * 🎯 CORE SELECT
 * ========================================================================== */

const CoreSelectComponent = forwardRef<HTMLSelectElement, CoreSelectProps>(
  function CoreSelectComponent(props, ref): JSX.Element {
    const { autoFocus = false, ...rest } = props;

    const internalRef = useRef<HTMLSelectElement | null>(null);
    const hasFocusedRef = useRef(false);

    /** Ref forwarding без мутации объекта */
    useImperativeHandle(ref, () => internalRef.current as HTMLSelectElement, [internalRef]);

    /** Focus management */
    useEffect(() => {
      if (!autoFocus || hasFocusedRef.current || !internalRef.current) return;

      internalRef.current.focus({ preventScroll: true });

      hasFocusedRef.current = true;
    }, [autoFocus]);

    return <select ref={internalRef} data-component='CoreSelect' {...rest} />;
  },
);

/**
 * Memoized CoreSelect.
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
 * - конфигурационных панелей
 * - design-system интеграций
 */
export const Select = memo(CoreSelectComponent);
