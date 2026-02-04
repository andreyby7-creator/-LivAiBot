/**
 * @vitest-environment jsdom
 * @file Unit тесты для bootstrap
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const rootMocks = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => rootMocks),
}));

const providersMocks = vi.hoisted(() => ({
  AppProviders: vi.fn(({ children }) => <div data-testid='app-providers'>{children}</div>),
}));

vi.mock('../../src/providers/AppProviders', () => ({
  AppProviders: providersMocks.AppProviders,
}));

import { bootstrap } from '../../src/bootstrap';

describe('bootstrap', () => {
  const element = document.createElement('div');
  const app = React.createElement('div', { 'data-testid': 'app' }, 'App');
  const providers = {
    intl: { locale: 'en', messages: {}, children: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when called outside browser environment', async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    // @ts-expect-error test override
    globalThis.window = undefined;
    // @ts-expect-error test override
    globalThis.document = undefined;

    await expect(bootstrap({ element, app, providers })).rejects.toThrow(
      'bootstrap() must be called in a browser environment.',
    );

    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('throws when element is invalid', async () => {
    // @ts-expect-error intentional invalid input
    await expect(bootstrap({ element: null, app, providers })).rejects.toThrow(
      'bootstrap(): element must be a valid HTMLElement.',
    );
  });

  it('runs validate/prefetch, registers SW, renders and emits lifecycle events', async () => {
    const events: string[] = [];
    const onEvent = [(event: Readonly<{ type: string; }>) => events.push(event.type)];
    const validateEnvironment = vi.fn();
    const prefetch = vi.fn();
    const onRegistered = vi.fn();
    const register = vi.fn().mockResolvedValue({ scope: '/' });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    });

    const result = await bootstrap({
      element,
      app,
      providers,
      validateEnvironment,
      prefetch,
      serviceWorker: { enabled: true, onRegistered },
      onEvent,
    });

    expect(validateEnvironment).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
    expect(onRegistered).toHaveBeenCalledWith({ scope: '/' });
    expect(rootMocks.render).toHaveBeenCalledTimes(1);
    expect(events).toContain('init:start');
    expect(events).toContain('render:done');

    result.unmount();
    expect(rootMocks.unmount).toHaveBeenCalledTimes(1);
    expect(events).toContain('unmount:done');
  });

  it('emits errors from event handlers and SW failures', async () => {
    const onEventError = vi.fn();
    const onError = vi.fn();
    const onEvent = [
      () => {
        throw new Error('handler error');
      },
    ];

    const register = vi.fn().mockRejectedValue(new Error('sw error'));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    });

    await bootstrap({
      element,
      app,
      providers,
      serviceWorker: { enabled: true, onError },
      onEvent,
      onEventError,
      prefetch: vi.fn(),
    });

    expect(onEventError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it('throws when validateEnvironment fails (critical)', async () => {
    const onError = vi.fn();

    await expect(bootstrap({
      element,
      app,
      providers,
      validateEnvironment: () => {
        throw new Error('bad env');
      },
      onError,
    })).rejects.toThrow('bad env');

    expect(onError).toHaveBeenCalled();
  });

  it('rerenders with lifecycle events', async () => {
    const events: string[] = [];
    const onEvent = [(event: Readonly<{ type: string; }>) => events.push(event.type)];

    const result = await bootstrap({
      element,
      app,
      providers,
      onEvent,
    });

    result.rerender(React.createElement('div', {}, 'Next'));
    expect(events.filter((event) => event === 'render:start')).toHaveLength(2);
    expect(events.filter((event) => event === 'render:done')).toHaveLength(2);
  });
});
