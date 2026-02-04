import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { JSX, ReactNode } from 'react';

import { locales } from '../../../next-intl.config.js';
import '../globals.css';

/**
 * Генерирует статические параметры для всех поддерживаемых локалей
 */
export function generateStaticParams(): { locale: string; }[] {
  return locales.map((locale) => ({ locale }));
}

/**
 * Type guard для валидации поддерживаемой локали
 */
function isLocale(value: string): value is (typeof locales)[number] {
  return locales.includes(value as (typeof locales)[number]);
}

/**
 * Генерирует viewport настройки
 */
export function generateViewport(): Viewport {
  return {
    themeColor: '#2563eb',
  };
}

/**
 * Генерирует метаданные с локализацией
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; }>;
}): Promise<Metadata> {
  const { locale } = await params;

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
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'LivAi',
    },
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
  params: Promise<{ locale: string; }>;
}): Promise<JSX.Element> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className='antialiased'>
        {children}
      </body>
    </html>
  );
}
