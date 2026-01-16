import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import '@testing-library/jest-dom';

/**
 * Setup файл для @livai/web
 *
 * Специфические моки для Next.js приложения.
 * Cleanup DOM уже включен в базовый package.setup.js
 */

// Мокирование Next.js App Router
vi.mock('next/navigation', () => ({
  useRouter: (): {
    push: Mock;
    replace: Mock;
    back: Mock;
    forward: Mock;
    refresh: Mock;
    prefetch: Mock;
  } => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
  usePathname: (): string => '/',
}));

// Мокирование переменных окружения
vi.mock('./env', () => ({
  env: {
    NEXT_PUBLIC_API_URL: 'http://localhost:8000',
    NEXTAUTH_SECRET: 'test-secret',
    NEXTAUTH_URL: 'http://localhost:3000',
  },
}));

// Мокирование ErrorBoundary
vi.mock('react-error-boundary', () => ({
  ErrorBoundary: (props: unknown): ReactElement =>
    (props as { readonly children: ReactNode; }).children as ReactElement,
  useErrorBoundary: (): {
    showBoundary: Mock;
    resetBoundary: Mock;
  } => ({
    showBoundary: vi.fn(),
    resetBoundary: vi.fn(),
  }),
}));
