/**
 * @file packages/ui-core/src/primitives/textarea.tsx
 * ============================================================================
 * 🔵 CORE UI TEXTAREA — BEHAVIORAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-примитив для <textarea>
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

import { memo, useEffect, useRef } from 'react';
import type { JSX, TextareaHTMLAttributes } from 'react';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type CoreTextareaProps = Readonly<
  & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'autoFocus'>
  & {
    /**
     * Автофокус при монтировании компонента.
     * Выполняется без скролла страницы.
     *
     * Default: false
     */
    autoFocus?: boolean | undefined;
  }
>;

/* ============================================================================
 * 🎯 CORE TEXTAREA
 * ========================================================================== */

function CoreTextareaComponent(props: CoreTextareaProps): JSX.Element {
  const { autoFocus = false, ...rest } = props;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasFocusedRef = useRef(false);

  /**
   * Focus management
   * Выполняется строго один раз за жизненный цикл компонента,
   * даже в React StrictMode и Concurrent Rendering.
   */
  useEffect(() => {
    if (!autoFocus) return;
    if (hasFocusedRef.current) return;
    if (!textareaRef.current) return;

    textareaRef.current.focus({ preventScroll: true });
    // Намеренная мутация:
    // useRef используется как guard жизненного цикла, а не как состояние приложения.
    // eslint-disable-next-line functional/immutable-data
    hasFocusedRef.current = true;
  }, [autoFocus]);

  return (
    <textarea
      ref={textareaRef}
      {...rest}
    />
  );
}

/**
 * Memoized CoreTextarea.
 *
 * Гарантии:
 * - Никаких скрытых side-effects
 * - Предсказуемый жизненный цикл
 * - Полная совместимость с strict-mode и concurrent rendering
 *
 * Подходит для:
 * - больших форм
 * - UI-мастеров
 * - сложных workflow-интерфейсов
 */
export const Textarea = memo(CoreTextareaComponent);
