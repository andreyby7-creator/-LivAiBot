/**
 * @file Next-intl провайдер для App Router.
 */

'use client';

import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import type { JSX, ReactNode } from 'react';
import { memo } from 'react';

export type IntlProviderProps = {
  readonly locale: string;
  readonly messages: AbstractIntlMessages;
  readonly children: ReactNode;
};

export const IntlProvider = memo(function IntlProvider({
  locale,
  messages,
  children,
}: IntlProviderProps): JSX.Element {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
});
