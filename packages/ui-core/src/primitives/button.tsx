/**
 * @file Примитив кнопки для UI.
 */

import clsx from 'clsx';
import type { ButtonHTMLAttributes, JSX } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: 'primary' | 'secondary';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly fullWidth?: boolean;
};

/**
 * Компонент кнопки с вариантами primary/secondary и размерами.
 *
 * @param variant - Визуальный стиль: 'primary' (по умолчанию) или 'secondary'
 * @param size - Размер: 'sm', 'md' (по умолчанию) или 'lg'
 * @param fullWidth - Растянуть на всю ширину контейнера
 *
 * @example
 * // Primary кнопка (по умолчанию)
 * <Button>Click me</Button>
 *
 * @example
 * // Secondary кнопка маленького размера
 * <Button variant="secondary" size="sm">Cancel</Button>
 *
 * @example
 * // Большая primary кнопка
 * <Button size="lg">Submit</Button>
 *
 * @example
 * // Отключенная кнопка
 * <Button disabled>Disabled</Button>
 *
 * @example
 * // Кнопка на всю ширину
 * <Button fullWidth>Full Width Button</Button>
 */
export function Button(props: ButtonProps): JSX.Element {
  const {
    variant = 'primary',
    size = 'md',
    className,
    type = 'button',
    disabled,
    fullWidth,
    ...rest
  } = props;

  const isDisabled = Boolean(disabled); // явное приведение к boolean
  const isFullWidth = Boolean(fullWidth); // явное приведение к boolean

  const base =
    'inline-flex items-center justify-center rounded-md border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const sizeCls = {
    sm: 'px-2.5 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  }[size];

  const variantCls = clsx(
    variant === 'secondary'
      ? 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-500'
      : 'border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    isDisabled && 'opacity-50 cursor-not-allowed',
    isDisabled && variant === 'primary' && 'bg-blue-400',
    isFullWidth && 'w-full',
  );

  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      className={clsx(base, sizeCls, variantCls, className)}
    />
  );
}
