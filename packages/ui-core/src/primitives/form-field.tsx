/**
 * @file UI примитив для формы: Label + Control + ErrorText.
 */

import type { JSX, ReactNode } from 'react';

export type FormFieldProps = {
  readonly label: string;
  readonly htmlFor: string;
  readonly children: ReactNode;
  readonly error?: string | undefined;
  readonly errorId?: string | undefined;
};

export function FormField(props: FormFieldProps): JSX.Element {
  const { label, htmlFor, children, error, errorId } = props;

  const hasError = typeof error === 'string' && error.length > 0;

  return (
    <div className='flex flex-col gap-1.5'>
      <label htmlFor={htmlFor} className='text-sm font-semibold text-gray-900'>
        {label}
      </label>

      {children}

      {hasError && (
        <div
          id={errorId}
          className='text-xs text-red-600'
          role='alert'
          aria-live='polite'
          data-ui='form-field-error'
        >
          {error}
        </div>
      )}
    </div>
  );
}
