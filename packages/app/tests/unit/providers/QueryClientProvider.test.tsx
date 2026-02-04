/**
 * @vitest-environment jsdom
 * @file Unit тесты для QueryClientProvider
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient } from '@tanstack/react-query';

const reactQueryMocks = vi.hoisted(() => ({
  QueryClientProvider: vi.fn(({ children }) =>
    React.createElement('div', { 'data-testid': 'rq-provider' }, children)
  ),
  QueryClient: vi.fn().mockImplementation(function(this: any) {
    this.id = 'mock-query-client';
    return this;
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: reactQueryMocks.QueryClientProvider,
  QueryClient: reactQueryMocks.QueryClient,
}));

const queryClientMocks = vi.hoisted(() => ({
  createQueryClient: vi.fn(() => ({ id: 'mock-client' })),
}));

vi.mock('../../../src/state/query/query-client', () => ({
  createQueryClient: queryClientMocks.createQueryClient,
}));

import { AppQueryClientProvider } from '../../../src/providers/QueryClientProvider';

describe('AppQueryClientProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders children without provider when disabled', () => {
    render(
      <AppQueryClientProvider enabled={false}>
        <div data-testid='child'>child</div>
      </AppQueryClientProvider>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('rq-provider')).not.toBeInTheDocument();
    expect(queryClientMocks.createQueryClient).not.toHaveBeenCalled();
  });

  it('uses provided client over options', () => {
    const externalClient = new QueryClient();

    render(
      <AppQueryClientProvider client={externalClient} options={{ staleTimeMs: 123 }}>
        <div data-testid='child'>child</div>
      </AppQueryClientProvider>,
    );

    expect(screen.getByTestId('rq-provider')).toBeInTheDocument();
    expect(queryClientMocks.createQueryClient).not.toHaveBeenCalled();
  });

  it('creates client from options when client is not provided', () => {
    render(
      <AppQueryClientProvider options={{ staleTimeMs: 456 }}>
        <div data-testid='child'>child</div>
      </AppQueryClientProvider>,
    );

    expect(screen.getByTestId('rq-provider')).toBeInTheDocument();
    expect(queryClientMocks.createQueryClient).toHaveBeenCalledTimes(1);
    expect(queryClientMocks.createQueryClient).toHaveBeenCalledWith({ staleTimeMs: 456 });
  });

  it('renders children inside QueryClientProvider when enabled', () => {
    render(
      <AppQueryClientProvider>
        <div data-testid='child'>child</div>
      </AppQueryClientProvider>,
    );

    expect(screen.getByTestId('rq-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
