import { IntlProvider } from '@livai/app';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { JSX, ReactNode } from 'react';

import { locales } from '../../../i18n/routing.js';
import '../globals.css';

/**
 * Type guard для валидации поддерживаемой локали
 */
function isLocale(value: string): value is (typeof locales)[number] {
  return locales.includes(value as (typeof locales)[number]);
}

/**
 * Генерирует метаданные с локализацией
 */
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string; };
}): Promise<Metadata> {
  if (!isLocale(locale)) {
    return {
      title: 'LivAi - AI Chatbot Platform',
      description: 'AI-powered chatbot platform with multi-tenant architecture',
    };
  }

  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

/**
 * @file Root layout с i18n (next-intl) для App Router.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string; };
}): Promise<JSX.Element> {
  const { locale } = params;

  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className='antialiased'>
        <IntlProvider locale={locale} messages={messages}>
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
