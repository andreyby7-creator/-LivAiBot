/**
 * @file Страница входа (Login) — композитор ui-features.
 *
 * TODO: Реализовать реальный auth flow (api-gateway/next-auth)
 * TODO: Добавить валидацию и обработку ошибок
 * TODO: Интегрировать с Zustand store для состояния пользователя
 */

'use client';

import { LoginForm } from '@livai/ui-features';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

import type { Locale } from '../../../../../i18n/routing.js';

/**
 * Props для компонента LoginPage
 */
type LoginPageProps = {
  readonly params: {
    readonly locale: Locale;
  };
};

export default function LoginPage({
  params,
}: LoginPageProps): JSX.Element {
  const { locale } = params;
  const t = useTranslations<'auth'>();

  return (
    <main
      className='min-h-screen grid place-items-center p-6 font-sans'
      role='main'
    >
      <div className='w-full max-w-sm sm:max-w-sm bg-white rounded-lg p-6 shadow'>
        <h1
          className='text-xl font-bold mb-6'
          aria-label={t('login.title')}
        >
          {t('login.title')}
        </h1>

        <LoginForm
          t={t}
          onSubmit={() => {
            // TODO (Фаза 2): подключить реальный auth flow (api-gateway/next-auth).
            // В будущем здесь будет: await login(values.email, values.password);
            throw new Error('Auth flow not implemented yet');
          }}
        />

        <div className='mt-4 text-sm text-center'>
          <Link
            href={`/${locale}/auth/register`}
            className='text-blue-600 hover:text-blue-800'
          >
            {t('register.link')}
          </Link>
        </div>
      </div>
    </main>
  );
}
