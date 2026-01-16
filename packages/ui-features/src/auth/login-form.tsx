/**
 * @file LoginForm — React Hook Form + Zod resolver.
 */

'use client';

import type { LoginValues } from '@livai/feature-auth';
import { loginSchema } from '@livai/feature-auth';
import { Button, FormField, Input } from '@livai/ui-core';
import type { TFunction } from '@livai/ui-shared';
import { translateZodMessage, zodResolver as rhfZodResolver } from '@livai/ui-shared';
import type { FormEventHandler, JSX } from 'react';
import { useCallback, useId } from 'react';
import type { FieldError } from 'react-hook-form';
import { useForm } from 'react-hook-form';

export type LoginFormProps = {
  readonly t?: TFunction;
  readonly onSubmit: (values: LoginValues) => Promise<void> | void;
  readonly isLoading?: boolean;
};

export function LoginForm(props: LoginFormProps): JSX.Element {
  const { onSubmit, t, isLoading } = props;

  // Уникальные IDs для accessibility
  const emailErrorId = useId();
  const passwordErrorId = useId();

  const form = useForm<LoginValues>({
    resolver: rhfZodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  const errors = form.formState.errors;

  // Helper для безопасного получения ошибок полей
  const getFieldError = (field?: FieldError): string =>
    typeof field?.message === 'string' ? translateZodMessage(field.message, t) : '';

  const emailError = getFieldError(errors.email);
  const passwordError = getFieldError(errors.password);

  const onFormSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    (e) => {
      form.handleSubmit(async (values) => {
        try {
          await onSubmit(values);
        } catch {
          // Ошибки логина обрабатываются в onSubmit callback
          // Можно добавить toast notification или другой UI feedback здесь
        }
      })(e).catch(() => undefined);
    },
    [form, onSubmit],
  );

  return (
    <form
      onSubmit={onFormSubmit}
      className='flex flex-col gap-3.5'
      noValidate
    >
      <FormField
        label={t?.('auth.email.label') ?? 'Email'}
        htmlFor='email'
        error={emailError}
        errorId={emailErrorId}
      >
        <Input
          id='email'
          type='email'
          autoComplete='email'
          aria-invalid={!!emailError}
          aria-describedby={emailError ? emailErrorId : undefined}
          autoFocus
          {...form.register('email')}
        />
      </FormField>

      <FormField
        label={t?.('auth.password.label') ?? 'Password'}
        htmlFor='password'
        error={passwordError}
        errorId={passwordErrorId}
      >
        <Input
          id='password'
          type='password'
          autoComplete='current-password'
          aria-invalid={!!passwordError}
          aria-describedby={passwordError ? passwordErrorId : undefined}
          {...form.register('password')}
        />
      </FormField>

      <Button type='submit' disabled={isLoading} aria-busy={isLoading}>
        {isLoading === true
          ? (t?.('common.loading') ?? 'Loading…')
          : t?.('auth.login.submit') ?? 'Sign In'}
      </Button>
    </form>
  );
}
