/**
 * @file packages/ui-core/src/primitives/form.tsx
 * ============================================================================
 * 🔵 CORE UI FORM — BEHAVIORAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Управляет DOM side-effects формы
 * - Фокусом, submit trapping, SSR-safety
 * - Accessibility и platform behavior
 *
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import type { FormHTMLAttributes, JSX } from 'react';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

export type CoreFormProps = Readonly<
  & Omit<FormHTMLAttributes<HTMLFormElement>, 'autoFocus'>
  & {
    /** Автофокус на первом интерактивном элементе */
    autoFocus?: boolean | undefined;
  }
>;

/* ============================================================================
 * 🎯 CORE FORM
 * ========================================================================== */

function CoreFormComponent(props: CoreFormProps): JSX.Element {
  const { children, autoFocus = true, onSubmit, ...rest } = props;

  const formRef = useRef<HTMLFormElement | null>(null);

  /** Управление фокусом */
  useEffect(() => {
    if (!autoFocus || !formRef.current) return;

    const firstFocusable = formRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    firstFocusable?.focus({ preventScroll: true });
  }, [autoFocus]);

  /** Перехват submit */
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit?.(event);
    },
    [onSubmit],
  );

  return (
    <form
      ref={formRef}
      {...rest}
      onSubmit={handleSubmit}
      noValidate
    >
      {children}
    </form>
  );
}

export const Form = memo(CoreFormComponent);
