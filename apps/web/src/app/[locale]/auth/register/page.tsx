import type { JSX } from 'react';

import type { Locale } from '../../../../../i18n/routing';
import { RegisterClient } from './RegisterClient';

// Отключаем prerendering для динамической страницы с формами
export const dynamic = 'force-dynamic';

/**
 * Props для компонента RegisterPage
 */
type RegisterPageProps = {
  readonly params: {
    readonly locale: Locale;
  };
};

/**
 * @file Страница регистрации (Register) — композитор ui-features.
 * Серверный компонент, который отключает prerendering и рендерит клиентский компонент.
 * Это обеспечивает правильную работу форм и интерактивных элементов.
 */
export default function RegisterPage({
  params,
}: RegisterPageProps): JSX.Element {
  const { locale } = params;

  return <RegisterClient locale={locale} />;
}
