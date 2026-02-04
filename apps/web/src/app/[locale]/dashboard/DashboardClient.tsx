/**
 * @file Клиентский компонент Dashboard - интерактивный интерфейс
 *
 * Содержит всю логику dashboard с использованием React хуков.
 * Рендерится только на клиенте для избежания ошибок SSR.
 */

'use client';

import type { JSX } from 'react';

import type { Locale } from '../../../../i18n/routing';

/**
 * Props для клиентского компонента Dashboard
 */
type Props = {
  locale: Locale;
};

/**
 * Клиентский компонент Dashboard
 *
 * Отвечает за интерактивные элементы dashboard, включая:
 * - Загрузку данных
 * - Управление состоянием
 * - Обработку пользовательских событий
 */
export default function DashboardClient({ locale }: Props): JSX.Element {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Locale: {locale}</p>
    </div>
  );
}
