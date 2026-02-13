/**
 * @file packages/app/src/hooks/useToast.ts
 * ============================================================================
 * 🍞 USE TOAST — FLUENT API ДЛЯ УВЕДОМЛЕНИЙ
 * ============================================================================
 *
 * Назначение:
 * - Тонкий orchestration-слой поверх ToastProvider
 * - Fluent API: success/error/warning/info/loading/promise
 * - Стабильные ссылки (useMemo/useCallback)
 * - Telemetry только для warning/error
 *
 * Границы ответственности:
 * - Без бизнес-логики
 * - Без optimistic/cache семантики
 * - Только управление UI-уведомлениями
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { errorFireAndForget, warnFireAndForget } from '../lib/telemetry-runtime.js';
import type { AddToastParams, ToastType } from '../providers/ToastProvider.js';
import { useToast as useToastContext } from '../providers/ToastProvider.js';
import type { ComponentState, UiEvent, UiEventMap } from '../types/ui-contracts.js';

/** Алиас для UI событий в контексте toast хуков */
export type ToastUiEvent<TType extends keyof UiEventMap = keyof UiEventMap> = UiEvent<TType>;

/** Алиас для состояния компонентов в контексте toast хуков */
export type ToastComponentState<T = unknown> = ComponentState<T>;

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type ToastInput = Readonly<{
  readonly type: ToastType;
  readonly message: string;
  readonly duration?: ToastDuration | undefined;
}>;

type ToastPromiseMessages<T> = Readonly<{
  /** Сообщение во время выполнения задачи. */
  readonly loading: string;
  /** Сообщение при успешном завершении. */
  readonly success: string | ((value: T) => string);
  /** Сообщение при ошибке. */
  readonly error: string | ((error: unknown) => string);
}>;

/** Длительность показа toast в миллисекундах */
export type ToastDuration = number;

export type UseToastApi = Readonly<{
  readonly show: (input: ToastInput) => string;
  readonly success: (message: string, duration?: ToastDuration) => string;
  readonly error: (message: string, duration?: ToastDuration) => string;
  readonly warning: (message: string, duration?: ToastDuration) => string;
  readonly info: (message: string, duration?: ToastDuration) => string;
  readonly loading: (message: string, duration?: ToastDuration) => string;
  readonly dismiss: (id: string) => void;
  readonly clear: () => void;
  /**
   * Выполняет async-задачу с авто-заменой loading → success/error.
   * Не возвращает raw Promise (fire-and-forget orchestration).
   * Возвращает cleanup-функцию отмены, которая также dismiss loading toast.
   */
  readonly promise: <T>(
    task: Promise<T> | (() => Promise<T>),
    messages: ToastPromiseMessages<T>,
    duration?: ToastDuration,
  ) => () => void;
}>;

/* ============================================================================
 * 🧰 UTILS
 * ========================================================================== */

const DEFAULT_DURATION_MS: ToastDuration = 4_000;
const LOADING_DURATION_MS: ToastDuration = 30_000;

function resolveDuration(
  duration?: ToastDuration,
  fallback: ToastDuration = DEFAULT_DURATION_MS,
): ToastDuration {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return duration;
  }
  return fallback;
}

function emitSeverityTelemetry(type: ToastType, message: string): void {
  if (type === 'error') {
    errorFireAndForget('Toast error emitted', { type, message });
  } else if (type === 'warning') {
    warnFireAndForget('Toast warning emitted', { type, message });
  }
}

/* ============================================================================
 * 🪝 HOOK
 * ========================================================================== */

/** Fluent API поверх ToastProvider context. */
export function useToast(): UseToastApi {
  const { addToast, removeToast, clearAll } = useToastContext();
  const isMountedRef = useRef(true);

  useEffect((): () => void => {
    return (): void => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Показывает уведомление заданного типа.
   * @param input - Параметры уведомления
   * @param input.duration - Длительность показа в миллисекундах (по умолчанию 4000)
   * @returns ID уведомления для управления им
   */
  const show = useCallback((input: ToastInput): string => {
    // Если provider выбросит ошибку, telemetry не будет отправлена.
    const toastParams: AddToastParams = {
      type: input.type,
      message: input.message,
      duration: resolveDuration(input.duration),
    };
    const id = addToast(toastParams);

    try {
      emitSeverityTelemetry(input.type, input.message);
    } catch {
      // Telemetry не должна влиять на UX уведомлений.
    }
    return id;
  }, [addToast]);

  /**
   * Показывает уведомление об успехе.
   * @param message - Текст уведомления
   * @param duration - Длительность показа в миллисекундах (по умолчанию 4000)
   * @returns ID уведомления
   */
  const success = useCallback((message: string, duration?: ToastDuration): string => {
    return show({ type: 'success', message, duration });
  }, [show]);

  /**
   * Показывает уведомление об ошибке.
   * @param message - Текст уведомления
   * @param duration - Длительность показа в миллисекундах (по умолчанию 4000)
   * @returns ID уведомления
   */
  const error = useCallback((message: string, duration?: ToastDuration): string => {
    return show({ type: 'error', message, duration });
  }, [show]);

  /**
   * Показывает предупреждение.
   * @param message - Текст уведомления
   * @param duration - Длительность показа в миллисекундах (по умолчанию 4000)
   * @returns ID уведомления
   */
  const warning = useCallback((message: string, duration?: ToastDuration): string => {
    return show({ type: 'warning', message, duration });
  }, [show]);

  /**
   * Показывает информационное уведомление.
   * @param message - Текст уведомления
   * @param duration - Длительность показа в миллисекундах (по умолчанию 4000)
   * @returns ID уведомления
   */
  const info = useCallback((message: string, duration?: ToastDuration): string => {
    return show({ type: 'info', message, duration });
  }, [show]);

  /**
   * Показывает уведомление о загрузке (незакрываемое по UI-паттерну).
   * @param message - Текст уведомления
   * @param duration - Длительность показа в миллисекундах (по умолчанию 30000)
   * @returns ID уведомления
   */
  const loading = useCallback((message: string, duration?: ToastDuration): string => {
    /** Семантическое уведомление о загрузке (внутри использует info, незакрываемое по UI-паттерну). */
    return show({
      type: 'info', // intentionally info
      message,
      duration: resolveDuration(duration, LOADING_DURATION_MS),
    });
  }, [show]);

  const dismiss = useCallback((id: string): void => {
    removeToast(id);
  }, [removeToast]);

  const clear = useCallback((): void => {
    clearAll();
  }, [clearAll]);

  const promise = useCallback(<T>(
    task: Promise<T> | (() => Promise<T>),
    messages: ToastPromiseMessages<T>,
    duration?: ToastDuration,
  ): () => void => {
    // Намеренная fire-and-forget оркестрация для UI уведомлений.
    let active = true;
    const loadingId = loading(messages.loading);
    const execute = typeof task === 'function' ? task : (): Promise<T> => task;

    execute()
      .then((value) => {
        if (!isMountedRef.current || !active) return;
        dismiss(loadingId);
        const successMessage = typeof messages.success === 'function'
          ? messages.success(value)
          : messages.success;
        success(successMessage, duration);
        return undefined;
      })
      .catch((err: unknown) => {
        if (!isMountedRef.current || !active) return;
        dismiss(loadingId);
        const errorMessage = typeof messages.error === 'function'
          ? messages.error(err)
          : messages.error;
        error(errorMessage, duration);
      });

    return (): void => {
      active = false;
      dismiss(loadingId);
    };
  }, [dismiss, error, loading, success]);

  return useMemo<UseToastApi>(() => ({
    show,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
    clear,
    promise,
  }), [clear, dismiss, error, info, loading, promise, show, success, warning]);
}
