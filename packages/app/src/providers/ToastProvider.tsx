/**
 * @file packages/app/src/providers/ToastProvider.tsx
 * ============================================================================
 * 🍞 TOAST PROVIDER — SHELL УРОВЕНЬ УВЕДОМЛЕНИЙ
 * ============================================================================
 *
 * Назначение:
 * - Централизованный менеджер Toast очереди
 * - Контекстный API для добавления/удаления уведомлений
 * - Инфраструктурная интеграция с telemetry
 *
 * Принципы:
 * - Микросервисная нейтральность (без доменной логики)
 * - Детерминированный reducer без side effects
 * - Безопасные side effects вынесены в эффекты
 */

'use client';

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { JSX, PropsWithChildren } from 'react';

import { useTelemetryContext } from './TelemetryProvider.js';
import type { ComponentState } from '../types/ui-contracts.js';

/** Алиас для состояния компонентов в контексте toast provider */
export type ToastComponentState = ComponentState<string>;

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = Readonly<{
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
  readonly duration?: number;
}>;

export type ToastContextType = Readonly<{
  /** Добавляет Toast и возвращает его ID. */
  readonly addToast: (toast: Omit<ToastItem, 'id'>) => string;
  /** Удаляет Toast по ID. */
  readonly removeToast: (id: string) => void;
  /** Очищает очередь Toast. */
  readonly clearAll: () => void;
}>;

export type AddToastParams = Readonly<{
  readonly type: ToastType;
  readonly message: string;
  readonly duration?: number;
}>;

export type ToastProviderProps = Readonly<
  PropsWithChildren<{
    /** Максимальная длина очереди (старые удаляются первыми). */
    readonly maxToasts?: number;
  }>
>;

const DEFAULT_MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 4000;
const RANDOM_ID_BASE = 36;
const RANDOM_ID_LENGTH = 9;

const NOOP_CONTEXT: ToastContextType = Object.freeze({
  addToast: () => '',
  removeToast: () => undefined,
  clearAll: () => undefined,
});

/* ============================================================================
 * 🧠 REDUCER
 * ========================================================================== */

type ToastAction =
  | { type: 'ADD'; toast: ToastItem; maxToasts: number; }
  | { type: 'REMOVE'; id: string; }
  | { type: 'CLEAR'; };

/**
 * Invariants:
 * - Toast reducer не содержит side effects
 * - Таймеры управляются исключительно эффектами
 * - Один toast = один timeout
 */
function toastReducer(state: readonly ToastItem[], action: ToastAction): readonly ToastItem[] {
  switch (action.type) {
    case 'ADD': {
      const next = [...state, action.toast];
      if (next.length <= action.maxToasts) return next;
      return next.slice(next.length - action.maxToasts);
    }
    case 'REMOVE':
      return state.filter((toast) => toast.id !== action.id);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

/* ============================================================================
 * 🧰 UTILS
 * ========================================================================== */

function createToastId(): string {
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    const cryptoObj = globalThis.crypto;
    if (typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID();
    }
  }
  return `toast_${Date.now()}_${
    Math.random().toString(RANDOM_ID_BASE).slice(2, 2 + RANDOM_ID_LENGTH)
  }`;
}

function getDuration(duration?: number): number {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return duration;
  }
  return DEFAULT_DURATION_MS;
}

/* ============================================================================
 * 🎯 PROVIDER
 * ========================================================================== */

export const ToastContext = createContext<ToastContextType>(NOOP_CONTEXT);

function ToastProviderComponent({
  children,
  maxToasts = DEFAULT_MAX_TOASTS,
}: ToastProviderProps): JSX.Element {
  const { track } = useTelemetryContext();
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timeoutMapRef = useRef<Map<string, ReturnType<typeof globalThis.setTimeout>>>(new Map());

  const removeToast = useCallback((id: string): void => {
    const currentMap = timeoutMapRef.current;
    const timeoutId = currentMap.get(id);
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);

      currentMap.delete(id);
    }
    dispatch({ type: 'REMOVE', id });
    track('Toast remove', { id });
  }, [track]);

  const addToast = useCallback((toast: AddToastParams): string => {
    const id = createToastId();
    const item: ToastItem = Object.freeze({
      id,
      type: toast.type,
      message: toast.message,
      ...(toast.duration !== undefined && { duration: toast.duration }),
    });

    dispatch({ type: 'ADD', toast: item, maxToasts });
    track('Toast add', { id, type: item.type });
    return id;
  }, [maxToasts, track]);

  const clearAll = useCallback((): void => {
    const currentMap = timeoutMapRef.current;
    currentMap.forEach((timeoutId) => {
      globalThis.clearTimeout(timeoutId);
    });

    currentMap.clear();
    dispatch({ type: 'CLEAR' });
    track('Toast clearAll', {});
  }, [track]);

  useEffect(() => {
    const currentMap = timeoutMapRef.current;

    // Очистка таймеров для удаленных тостов
    const activeIds = new Set(toasts.map((t) => t.id));
    currentMap.forEach((timeoutId, id) => {
      if (!activeIds.has(id)) {
        globalThis.clearTimeout(timeoutId);

        currentMap.delete(id);
      }
    });

    // Добавление таймеров для новых тостов
    toasts.forEach((toast) => {
      if (!currentMap.has(toast.id)) {
        const duration = getDuration(toast.duration);
        const timeoutId = globalThis.setTimeout(() => {
          removeToast(toast.id);
        }, duration);

        currentMap.set(toast.id, timeoutId);
      }
    });
  }, [removeToast, toasts]);

  useEffect((): () => void => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timeoutMapRef.current.forEach((timeoutId) => {
        globalThis.clearTimeout(timeoutId);
      });
    };
  }, []);

  const contextValue = useMemo<ToastContextType>(() => ({
    addToast,
    removeToast,
    clearAll,
  }), [addToast, clearAll, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
}

export const ToastProvider = memo(ToastProviderComponent);

/** Хук для доступа к Toast API. */
export function useToast(): ToastContextType {
  return useContext(ToastContext);
}
