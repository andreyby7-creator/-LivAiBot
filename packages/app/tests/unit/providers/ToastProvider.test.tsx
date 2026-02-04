/**
 * @vitest-environment jsdom
 * @file Unit тесты для ToastProvider
 */

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const telemetryMocks = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock('../../../src/providers/TelemetryProvider', () => ({
  useTelemetryContext: () => ({
    track: telemetryMocks.track,
  }),
}));

const coreToastMocks = vi.hoisted(() => ({
  Toast: vi.fn((props) => (
    <div
      data-testid={props['data-testid'] ?? 'core-toast'}
      data-variant={props.variant}
    >
      {props.content}
    </div>
  )),
}));

vi.mock('../../../../ui-core/src/components/Toast', () => ({
  Toast: coreToastMocks.Toast,
}));

import { ToastProvider, useToast } from '../../../src/providers/ToastProvider';

// Suppress React key warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: readonly any[]) => {
    if (
      typeof args[0] === 'string'
      && args[0].includes('Each child in a list should have a unique "key" prop')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

describe('ToastProvider', () => {
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  const wrapper = ({ children }: { children: React.ReactNode; }) => (
    <ToastProvider key='test-wrapper'>{children}</ToastProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('возвращает noop методы вне provider', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.addToast({ type: 'info', message: 'noop' })).toBe('');
    expect(() => result.current.removeToast('missing')).not.toThrow();
    expect(() => result.current.clearAll()).not.toThrow();
  });

  it('добавляет toast, использует randomUUID и вызывает telemetry', () => {
    const randomUUID = vi.fn(() => 'toast-uuid');
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID },
      configurable: true,
    });

    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ type: 'success', message: 'Hello' });
    });

    expect(screen.getByTestId('toast-toast-uuid')).toBeInTheDocument();
    expect(telemetryMocks.track).toHaveBeenCalledWith('Toast add', {
      id: 'toast-uuid',
      type: 'success',
    });
  });

  it('удаляет toast и отправляет telemetry', () => {
    const randomUUID = vi.fn(() => 'toast-remove');
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID },
      configurable: true,
    });

    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ type: 'info', message: 'Remove me' });
    });

    expect(screen.getByTestId('toast-toast-remove')).toBeInTheDocument();

    act(() => {
      result.current.removeToast('toast-remove');
    });

    expect(screen.queryByTestId('toast-toast-remove')).not.toBeInTheDocument();
    expect(telemetryMocks.track).toHaveBeenCalledWith('Toast remove', { id: 'toast-remove' });
  });

  it('очищает все toast и сбрасывает очередь', () => {
    const randomUUID = vi.fn()
      .mockReturnValueOnce('toast-1')
      .mockReturnValueOnce('toast-2');
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID },
      configurable: true,
    });

    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ type: 'info', message: 'One' });
      result.current.addToast({ type: 'warning', message: 'Two' });
    });

    expect(screen.getByTestId('toast-toast-1')).toBeInTheDocument();
    expect(screen.getByTestId('toast-toast-2')).toBeInTheDocument();

    act(() => {
      result.current.clearAll();
    });

    expect(screen.queryByTestId('toast-toast-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toast-toast-2')).not.toBeInTheDocument();
    expect(telemetryMocks.track).toHaveBeenCalledWith('Toast clearAll', {});
  });

  it('обрезает очередь по maxToasts', () => {
    const { result } = renderHook(() => useToast(), {
      // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
      wrapper: ({ children }: { children: React.ReactNode; }) => (
        <ToastProvider maxToasts={1}>{children}</ToastProvider>
      ),
    });

    act(() => {
      result.current.addToast({ type: 'info', message: 'First' });
      result.current.addToast({ type: 'info', message: 'Second' });
    });

    const toasts = screen.getAllByTestId(/toast-/);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toHaveTextContent('Second');
  });

  it('автоудаление с дефолтной длительностью и позиционирование контейнера', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useToast(), {
      // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
      wrapper: ({ children }: { children: React.ReactNode; }) => (
        <ToastProvider position='top-left'>{children}</ToastProvider>
      ),
    });

    act(() => {
      result.current.addToast({ type: 'info', message: 'Auto', duration: 100 });
    });

    const container = document.querySelector('[data-component="ToastContainer"]');
    expect(container).toBeInTheDocument();
    expect(container).toHaveStyle({ top: '16px', left: '16px' });

    // Toast should still be visible after 50ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId(/toast-/)).toBeInTheDocument();

    // Toast should be removed after full duration
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.queryByTestId(/toast-/)).not.toBeInTheDocument();
  });

  it('рендерит container когда есть toast и скрывает когда пусто', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ type: 'success', message: 'Visible' });
    });

    // Container should appear with toast
    expect(document.querySelector('[data-component="ToastContainer"]')).toBeInTheDocument();
    expect(screen.getByTestId(/toast-/)).toBeInTheDocument();

    // Clear all toasts instead of removing by ID
    act(() => {
      result.current.clearAll();
    });

    // Container should disappear when no toasts
    expect(document.querySelector('[data-component="ToastContainer"]')).toBeNull();
  });
});
