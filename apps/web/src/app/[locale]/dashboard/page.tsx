/**
 * @file Страница Dashboard - серверный контейнер
 *
 * Серверный компонент, который отключает prerendering и рендерит клиентский компонент Dashboard.
 * Это обеспечивает правильную работу интерактивных элементов dashboard без ошибок SSR.
 */

import type { JSX } from 'react';

import DashboardClient from './DashboardClient';
import type { Locale } from '../../../../i18n/routing';

// Явно отключаем prerendering для страниц с интерактивными элементами
export const dynamic = 'force-dynamic';

/**
 * Props для серверного компонента DashboardPage
 */
type DashboardPageProps = {
  readonly params: {
    readonly locale: Locale;
  };
};

/**
 * Серверный компонент страницы Dashboard
 *
 * Отключает статическую генерацию и рендерит клиентский компонент.
 * Это необходимо для страниц с useState, useEffect и другими хуками.
 */
export default function DashboardPage({
  params,
}: DashboardPageProps): JSX.Element {
  return <DashboardClient locale={params.locale} />;
}
