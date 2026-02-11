/**
 * @vitest-environment jsdom
 * @file Unit тесты для ToastProvider
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const telemetryMocks = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock('../../../src/providers/TelemetryProvider', () => ({
  useTelemetryContext: () => ({
    track: telemetryMocks.track,
  }),
}));

import { ToastProvider, useToast } from '../../../src/providers/ToastProvider';

describe('ToastProvider', () => {
  const wrapper = ({ children }: { children: React.ReactNode; }) => (
    <ToastProvider key='test-wrapper'>{children}</ToastProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('возвращает noop методы вне provider', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.addToast({ type: 'info', message: 'noop' })).toBe('');
    expect(() => result.current.removeToast('missing')).not.toThrow();
    expect(() => result.current.clearAll()).not.toThrow();
  });

  it('добавляет toast и возвращает ID', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let toastId: string;
    act(() => {
      toastId = result.current.addToast({ type: 'success', message: 'Hello' });
    });

    expect(typeof toastId!).toBe('string');
    expect(toastId!.length).toBeGreaterThan(0);
    expect(telemetryMocks.track).toHaveBeenCalledWith('Toast add', {
      id: toastId!,
      type: 'success',
    });
  });

  it('удаляет toast по ID', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    let toastId: string;
    act(() => {
      toastId = result.current.addToast({ type: 'info', message: 'Remove me' });
    });

    act(() => {
      result.current.removeToast(toastId!);
    });

    expect(telemetryMocks.track).toHaveBeenCalledWith('Toast remove', { id: toastId! });
  });

  it('очищает все toast', () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ type: 'info', message: 'One' });
      result.current.addToast({ type: 'warning', message: 'Two' });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(telemetryMocks.track).toHaveBeenCalledWith('Toast clearAll', {});
  });

  it('работает с maxToasts ограничением', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }: { children: React.ReactNode; }) => (
        <ToastProvider maxToasts={1}>{children}</ToastProvider>
      ),
    });

    let firstId: string;
    let secondId: string;

    act(() => {
      firstId = result.current.addToast({ type: 'info', message: 'First' });
      secondId = result.current.addToast({ type: 'info', message: 'Second' });
    });

    expect(typeof firstId!).toBe('string');
    expect(typeof secondId!).toBe('string');
    expect(firstId!).not.toBe(secondId!);
  });

  it('автоудаляет toast по истечении duration', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.addToast({ type: 'info', message: 'Auto', duration: 100 });
    });

    // Toast should be removed after duration
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Проверяем, что removeToast был вызван автоматически
    expect(telemetryMocks.track).toHaveBeenCalledWith('Toast remove', expect.any(Object));
  });
});
