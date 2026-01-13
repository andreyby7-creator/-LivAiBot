import type { Metadata } from 'next';
import type { JSX, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'LivAi - AI Chatbot Platform',
  description: 'AI-powered chatbot platform with multi-tenant architecture',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang='en'>
      <body className='antialiased'>
        {children}
      </body>
    </html>
  );
}
