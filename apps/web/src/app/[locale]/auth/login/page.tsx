import type { JSX } from 'react';

import { LoginClient } from './LoginClient';
import type { Locale } from '../../../../../i18n/routing.js';

// Отключаем prerendering для динамической страницы с формами
export const dynamic = 'force-dynamic';

/**
 * Props для компонента LoginPage
 */
type LoginPageProps = {
  readonly params: {
    readonly locale: Locale;
  };
};

/**
 * @file Страница входа (Login) — композитор ui-features.
 *
 * Серверный компонент, который отключает prerendering и рендерит клиентский компонент.
 * Это обеспечивает правильную работу форм и интерактивных элементов.
 */
export default function LoginPage({
  params,
}: LoginPageProps): JSX.Element {
  const { locale } = params;

  return <LoginClient locale={locale} />;
}
