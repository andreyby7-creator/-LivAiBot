/**
 * @file RegisterForm — React Hook Form + Zod resolver.
 */

'use client';

import type { RegisterValues } from '@livai/feature-auth';
import { registerSchema } from '@livai/feature-auth';
import { Button, FormField, Input } from '@livai/ui-core';
import type { TFunction } from '@livai/ui-shared';
import { translateZodMessage, zodResolver as rhfZodResolver } from '@livai/ui-shared';
import React, { useCallback, useId } from 'react';
import type { JSX } from 'react';
import type { FieldError } from 'react-hook-form';
import { useForm } from 'react-hook-form';

export type RegisterFormProps = {
  readonly t?: TFunction;
  readonly onSubmit: (values: RegisterValues) => Promise<void> | void;
  readonly isLoading?: boolean;
  readonly onError?: (error: unknown) => void;
  readonly autoFocus?: boolean;
};

// Определение полей формы
const getFormFields = (t?: TFunction, autoFocusEmail?: boolean): {
  name: 'email' | 'password' | 'workspace_name';
  label: string;
  type: 'email' | 'password' | 'text';
  autoComplete: string;
  autoFocus?: boolean | undefined;
  error?: string;
  errorId?: string;
}[] => [
  {
    name: 'email' as const,
    label: t?.('auth.email.label') ?? 'Email',
    type: 'email' as const,
    autoComplete: 'email' as const,
    autoFocus: autoFocusEmail,
  },
  {
    name: 'password' as const,
    label: t?.('auth.password.label') ?? 'Password',
    type: 'password' as const,
    autoComplete: 'new-password' as const,
  },
  {
    name: 'workspace_name' as const,
    label: t?.('auth.workspaceName.label') ?? 'Workspace name',
    type: 'text' as const,
    autoComplete: 'organization' as const,
  },
];

export function RegisterForm(props: RegisterFormProps): JSX.Element {
  const { onSubmit, t, isLoading, onError, autoFocus = true } = props;

  // Уникальные IDs для accessibility
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const workspaceErrorId = useId();

  const form = useForm<RegisterValues>({
    resolver: rhfZodResolver(registerSchema),
    defaultValues: { email: '', password: '', workspace_name: '' },
    mode: 'onSubmit',
  });

  const errors = form.formState.errors;

  // Helper для безопасного получения ошибок полей
  const getFieldError = (field?: FieldError): string =>
    typeof field?.message === 'string' ? translateZodMessage(field.message, t) : '';

  const emailError = getFieldError(errors.email);
  const passwordError = getFieldError(errors.password);
  const workspaceNameError = getFieldError(errors.workspace_name);

  const onFormSubmit = useCallback(
    (e: React.SubmitEvent<HTMLFormElement>) => {
      form.handleSubmit(async (values) => {
        try {
          await onSubmit(values);
        } catch (error) {
          // Вызываем кастомный обработчик ошибок (например, для toast notifications)
          // Если onError не предоставлен, ошибки будут "проглочены" без side effects
          onError?.(error);
        }
      })(e).catch(() => {
        // Подавляем ошибки RHF form validation - они уже обработаны выше
        // или будут отображены через form state
      });
    },
    [form, onSubmit, onError],
  );

  // Получаем поля формы с учетом переводов
  const baseFields = getFormFields(t, autoFocus);
  const errorMap = {
    email: emailError,
    password: passwordError,
    workspace_name: workspaceNameError,
  } as const;

  const errorIdMap = {
    email: emailErrorId,
    password: passwordErrorId,
    workspace_name: workspaceErrorId,
  } as const;

  const fields = baseFields.map((field) => ({
    ...field,
    error: errorMap[field.name],
    errorId: errorIdMap[field.name],
  }));

  return (
    <form
      onSubmit={onFormSubmit}
      className='flex flex-col gap-3.5'
      noValidate
    >
      {fields.map((field) => (
        <FormField
          key={field.name}
          label={field.label}
          htmlFor={field.name}
          error={field.error}
          errorId={field.errorId}
        >
          <Input
            id={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            aria-invalid={Boolean(field.error)}
            aria-describedby={field.error ? field.errorId : undefined}
            autoFocus={field.autoFocus}
            {...form.register(field.name)}
          />
        </FormField>
      ))}

      <Button type='submit' disabled={isLoading} aria-busy={isLoading}>
        {isLoading === true
          ? (t?.('common.loading') ?? 'Loading…')
          : t?.('auth.register.submit') ?? 'Sign Up'}
      </Button>
    </form>
  );
}
