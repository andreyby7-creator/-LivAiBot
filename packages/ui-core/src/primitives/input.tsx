/**
 * @file Примитив input для UI (с forwardRef).
 */
import clsx from 'clsx';
import type { InputHTMLAttributes, JSX } from 'react';
import { forwardRef } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
): JSX.Element {
  const base =
    'w-full rounded-md border border-gray-300 px-2.5 py-2 outline-none transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return <input ref={ref} {...rest} className={clsx(base, className)} />;
});
