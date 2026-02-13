'use client';

/**
 * @file Client Component wrapper для IntlProvider из @livai/app
 *
 * Next.js видит 'use client' только в исходниках внутри app/,
 * а не в node_modules. Поэтому нужен wrapper для Client Components из библиотек.
 */

export { IntlProvider, type IntlProviderProps } from '@livai/app/providers/intl-provider.js';
