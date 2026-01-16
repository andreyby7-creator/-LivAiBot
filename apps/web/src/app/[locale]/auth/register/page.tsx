/**
 * @file Страница регистрации (Register) — композитор ui-features.
 *
 * TODO: Реализовать реальный registration flow (api-gateway/next-auth)
 * TODO: Добавить валидацию и обработку ошибок
 * TODO: Интегрировать с Zustand store для состояния пользователя
 */

'use client';

import { RegisterForm } from '@livai/ui-features';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

import type { Locale } from '../../../../../i18n/routing.js';

/**
 * Props для компонента RegisterPage
 */
type RegisterPageProps = {
  readonly params: {
    readonly locale: Locale;
  };
};

export default function RegisterPage({
  params,
}: RegisterPageProps): JSX.Element {
  const { locale } = params;
  const t = useTranslations<'auth'>();

  return (
    <main
      className='min-h-screen grid place-items-center p-6 font-sans'
      role='main'
      aria-label={t('register.title')}
    >
      <div className='w-full max-w-sm sm:max-w-sm bg-white rounded-lg p-6 shadow'>
        <h1
          className='text-xl font-bold mb-6'
          aria-label={t('register.title')}
        >
          {t('register.title')}
        </h1>

        <RegisterForm
          t={t}
          onSubmit={() => {
            // TODO (Фаза 2): подключить реальный registration flow (api-gateway/next-auth).
            // В будущем здесь будет: await register(values.email, values.password, values.workspaceName);
            throw new Error('Registration flow not implemented yet');
          }}
          autoFocus
        />

        <div className='mt-4 text-sm text-center'>
          <Link
            href={`/${locale}/auth/login`}
            className='text-blue-600 hover:text-blue-800'
          >
            {t('register.link')}
          </Link>
        </div>
      </div>
    </main>
  );
}
