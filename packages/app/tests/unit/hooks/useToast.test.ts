/**
 * @vitest-environment jsdom
 * @file Unit тесты для useToast
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const telemetryMocks = vi.hoisted(() => ({
  errorFireAndForget: vi.fn(),
  warnFireAndForget: vi.fn(),
}));

vi.mock('../../../src/lib/telemetry-runtime', () => ({
  errorFireAndForget: telemetryMocks.errorFireAndForget,
  warnFireAndForget: telemetryMocks.warnFireAndForget,
}));

const toastContextMocks = vi.hoisted(() => ({
  addToast: vi.fn(() => 'toast-id'),
  removeToast: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock('../../../src/providers/ToastProvider', () => ({
  useToast: () => toastContextMocks,
}));

import { useToast } from '../../../src/hooks/useToast';

describe('useToast hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastContextMocks.addToast.mockReturnValue('toast-id');
  });

  it('show добавляет toast и возвращает id', () => {
    const { result } = renderHook(() => useToast());

    const id = result.current.show({ type: 'success', message: 'ok' });

    expect(id).toBe('toast-id');
    expect(toastContextMocks.addToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'ok',
      duration: 4000,
    });
  });

  it('show отправляет telemetry только для warning/error и безопасен к telemetry exception', () => {
    telemetryMocks.errorFireAndForget.mockImplementation(() => {
      throw new Error('telemetry fail');
    });

    const { result } = renderHook(() => useToast());

    expect(() => result.current.show({ type: 'error', message: 'fail' })).not.toThrow();
    result.current.show({ type: 'warning', message: 'warn' });
    result.current.show({ type: 'info', message: 'info' });

    expect(telemetryMocks.errorFireAndForget).toHaveBeenCalledWith(
      'Toast error emitted',
      { type: 'error', message: 'fail' },
    );
    expect(telemetryMocks.warnFireAndForget).toHaveBeenCalledWith(
      'Toast warning emitted',
      { type: 'warning', message: 'warn' },
    );
    expect(telemetryMocks.warnFireAndForget).toHaveBeenCalledTimes(1);
  });

  it('helper методы success/error/warning/info/loading используют корректные типы и duration', () => {
    const { result } = renderHook(() => useToast());

    result.current.success('s');
    result.current.error('e', 100);
    result.current.warning('w');
    result.current.info('i', -1);
    result.current.loading('l');

    expect(toastContextMocks.addToast).toHaveBeenNthCalledWith(1, {
      type: 'success',
      message: 's',
      duration: 4000,
    });
    expect(toastContextMocks.addToast).toHaveBeenNthCalledWith(2, {
      type: 'error',
      message: 'e',
      duration: 100,
    });
    expect(toastContextMocks.addToast).toHaveBeenNthCalledWith(3, {
      type: 'warning',
      message: 'w',
      duration: 4000,
    });
    expect(toastContextMocks.addToast).toHaveBeenNthCalledWith(4, {
      type: 'info',
      message: 'i',
      duration: 4000,
    });
    expect(toastContextMocks.addToast).toHaveBeenNthCalledWith(5, {
      type: 'info',
      message: 'l',
      duration: 30000,
    });
  });

  it('dismiss и clear проксируют вызовы в context', () => {
    const { result } = renderHook(() => useToast());

    result.current.dismiss('abc');
    result.current.clear();

    expect(toastContextMocks.removeToast).toHaveBeenCalledWith('abc');
    expect(toastContextMocks.clearAll).toHaveBeenCalledTimes(1);
  });

  it('promise: loading → success и cleanup dismiss', async () => {
    const { result } = renderHook(() => useToast());

    let resolveTask: (value: number) => void;
    const task = new Promise<number>((resolve) => {
      resolveTask = resolve;
    });

    const cleanup = result.current.promise(task, {
      loading: 'loading',
      success: (value) => `done-${value}`,
      error: 'error',
    }, 555);

    expect(toastContextMocks.addToast).toHaveBeenCalledWith({
      type: 'info',
      message: 'loading',
      duration: 30000,
    });

    await act(async () => {
      resolveTask!(7);
      await Promise.resolve();
    });

    expect(toastContextMocks.removeToast).toHaveBeenCalledWith('toast-id');
    expect(toastContextMocks.addToast).toHaveBeenLastCalledWith({
      type: 'success',
      message: 'done-7',
      duration: 555,
    });

    cleanup();
    expect(toastContextMocks.removeToast).toHaveBeenCalledWith('toast-id');
  });

  it('promise: loading → error (function message) и ветка task factory', async () => {
    const { result } = renderHook(() => useToast());

    const cleanup = result.current.promise(
      () => Promise.reject(new Error('boom')),
      {
        loading: 'loading',
        success: 'ok',
        error: (err) => `err-${String((err as Error).message)}`,
      },
      777,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastContextMocks.addToast).toHaveBeenLastCalledWith({
      type: 'error',
      message: 'err-boom',
      duration: 777,
    });

    cleanup();
  });

  it('promise не обновляет UI после unmount', async () => {
    const { result, unmount } = renderHook(() => useToast());

    let resolveTask: (value: string) => void;
    const task = new Promise<string>((resolve) => {
      resolveTask = resolve;
    });

    result.current.promise(task, {
      loading: 'loading',
      success: 'ok',
      error: 'err',
    });

    unmount();

    const callsBefore = toastContextMocks.addToast.mock.calls.length;

    await act(async () => {
      resolveTask!('done');
      await Promise.resolve();
    });

    expect(toastContextMocks.addToast.mock.calls.length).toBe(callsBefore);
  });
});
