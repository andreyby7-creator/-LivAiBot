/**
 * @file Корневая страница - перенаправляет на локализованную версию
 *
 * Для приложений с next-intl и App Router корневая страница /
 * должна перенаправлять на страницу с локалью по умолчанию.
 *
 * Это необходимо для E2E тестов, которые проверяют доступность сервера
 * по корневому URL.
 */

import { redirect } from 'next/navigation';

import { defaultLocale } from '../../i18n/routing.js';

/**
 * Корневая страница перенаправляет на локализованную версию
 */
export default function RootPage(): never {
  redirect(`/${defaultLocale}`);
}
