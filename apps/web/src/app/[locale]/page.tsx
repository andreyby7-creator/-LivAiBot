import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

import type { Locale } from '../../../i18n/routing.js';

/**
 * @file Главная страница с полной i18n поддержкой
 */
export default function HomePage({
  params,
}: {
  params: { locale: Locale; };
}): JSX.Element {
  const { locale } = params;
  const t = useTranslations<'home' | 'auth'>();

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans'>
      <div className='w-full max-w-md bg-white rounded-lg shadow p-8'>
        <h1 className='text-2xl font-bold text-center text-gray-900 mb-8'>
          {t('home.title')}
        </h1>

        <p className='text-gray-500 text-center mb-8'>
          {t('home.description')}
        </p>

        <div className='flex flex-col gap-4'>
          <Link
            href={`/${locale}/auth/login`}
            className='inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full'
            data-testid='login-button'
          >
            {t('auth.login.submit')}
          </Link>

          <Link
            href={`/${locale}/auth/register`}
            className='inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 w-full'
            data-testid='register-button'
          >
            {t('auth.register.submit')}
          </Link>

          <Link
            href={`/${locale}/dashboard`}
            className='inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 w-full'
            data-testid='dashboard-button'
          >
            {t('home.dashboard')}
          </Link>
        </div>

        <div className='mt-8 text-center text-sm text-gray-500'>
          {t('home.e2eStatus')}
        </div>
      </div>
    </div>
  );
}
