/**
 * @file Клиентский компонент Register - форма регистрации
 *
 * Содержит форму регистрации с использованием React хуков.
 * Рендерится только на клиенте для избежания ошибок SSR.
 */

'use client';

import { RegisterForm } from '@livai/ui-features/auth/register-form.js';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

import type { Locale } from '../../../../../i18n/routing.js';

/**
 * Props для клиентского компонента Register
 */
type RegisterClientProps = {
  readonly locale: Locale;
};

/**
 * Клиентский компонент Register
 *
 * Отвечает за форму регистрации, включая:
 * - Валидацию данных
 * - Обработку отправки формы
 * - Переходы между страницами
 */
export function RegisterClient({ locale }: RegisterClientProps): JSX.Element {
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
