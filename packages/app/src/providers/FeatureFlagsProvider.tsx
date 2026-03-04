/**
 * @file packages/app/src/providers/FeatureFlagsProvider.tsx
 * ============================================================================
 * 🚩 FEATURE FLAGS PROVIDER — SHELL УРОВЕНЬ УПРАВЛЕНИЯ ФЛАГАМИ
 * ============================================================================
 * Назначение:
 * - Единый источник правды для feature flags на уровне приложения
 * - Runtime overrides (без перетирания базовых флагов)
 * - SSR-safe гидрация initialFlags
 * Принципы:
 * - Zustand как стабильное хранилище без side effects
 * - Микросервисная изоляция (никакой доменной логики)
 * - Детерминированность и предсказуемость
 */

'use client';

import { memo, useEffect, useMemo } from 'react';
import type { JSX, PropsWithChildren } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { FeatureFlagName } from '../lib/feature-flags.js';
import type { FeatureFlags } from '../types/common.js';
import type { UiFeatureFlags } from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте provider */
export type UiFeatureFlagsAlias = UiFeatureFlags;

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

/** Состояние flags без методов (для persistence). */
export type FeatureFlagsState = Readonly<{
  /** Базовые значения feature flags (server-provided). */
  readonly flags: FeatureFlags;
  /** Runtime overrides (не персистятся за пределами клиента). */
  readonly overrides: Partial<FeatureFlags>;
}>;

/** Действия над feature flags. */
export type FeatureFlagsActions = Readonly<{
  /** Обновляет базовые flags (shallow-merge, без сброса существующих). */
  readonly setFlags: (flags: FeatureFlags) => void;
  /** Устанавливает runtime override для флага. */
  readonly setOverride: (name: FeatureFlagName, value: boolean) => void;
  /** Сбрасывает все runtime overrides. */
  readonly clearOverrides: () => void;
  /** Синхронно возвращает текущее значение флага. */
  readonly getFlag: (name: FeatureFlagName) => boolean;
}>;

/** Полный контракт store. */
export type FeatureFlagsStore =
  & FeatureFlagsState
  & Readonly<{
    readonly actions: FeatureFlagsActions;
  }>;

/** Props FeatureFlagsProvider. */
export type FeatureFlagsProviderProps = Readonly<
  PropsWithChildren<{
    /** Базовые flags (например, из SSR или bootstrap). */
    readonly initialFlags?: FeatureFlags;
  }>
>;

const STORE_NAME = 'feature-flags-overrides';
const STORE_VERSION = 1;

const EMPTY_FLAGS: FeatureFlags = Object.freeze({});
const EMPTY_OVERRIDES: Partial<FeatureFlags> = Object.freeze({});

/* ============================================================================
 * 🏗️ STORE
 * ========================================================================== */

/**
 * Инварианты:
 * - overrides всегда имеют приоритет над базовыми flags
 * - flags являются неизменяемыми значениями, полученными от сервера
 */
export const useFeatureFlagsStore = create<FeatureFlagsStore>()(
  persist(
    (set, get) => ({
      flags: EMPTY_FLAGS,
      overrides: EMPTY_OVERRIDES,

      actions: {
        setFlags: (flags: FeatureFlags): void => {
          set((state) => ({
            flags: {
              ...state.flags,
              ...flags,
            },
          }));
        },

        setOverride: (name: FeatureFlagName, value: boolean): void => {
          set((state) => ({
            overrides: {
              ...state.overrides,
              [name]: value,
            },
          }));
        },

        clearOverrides: (): void => {
          set({ overrides: EMPTY_OVERRIDES });
        },

        getFlag: (name: FeatureFlagName): boolean => {
          const { overrides, flags } = get();
          return overrides[name] ?? flags[name] ?? false;
        },
      },
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      partialize: (state) => ({ overrides: state.overrides }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<FeatureFlagsStore>),
        actions: currentState.actions,
      }),
    },
  ),
);

/* ============================================================================
 * 🎯 PROVIDER
 * ========================================================================== */

function FeatureFlagsProviderComponent({
  children,
  initialFlags,
}: FeatureFlagsProviderProps): JSX.Element {
  useEffect(() => {
    if (!initialFlags || Object.keys(initialFlags).length === 0) return;

    const { flags } = useFeatureFlagsStore.getState();
    let changed = false;
    for (const key of Object.keys(initialFlags)) {
      const typedKey = key as FeatureFlagName;
      if (flags[typedKey] !== initialFlags[typedKey]) {
        changed = true;
        break;
      }
    }

    if (!changed) return;

    useFeatureFlagsStore.setState(
      (state) => ({
        flags: {
          ...state.flags,
          ...initialFlags,
        },
      }),
      false,
    );
  }, [initialFlags]);

  return children as JSX.Element;
}

export const FeatureFlagsProvider = memo(FeatureFlagsProviderComponent);

/** Тестовый хук для прямого доступа к store. */
export const featureFlagsStore = useFeatureFlagsStore;

/* ============================================================================
 * 🎣 HOOKS
 * ========================================================================== */

/** Хук для доступа к feature flags. */
export function useFeatureFlags(): Readonly<{
  readonly isEnabled: (name: FeatureFlagName) => boolean;
  readonly setOverride: (name: FeatureFlagName, value: boolean) => void;
  readonly clearOverrides: () => void;
}> {
  const actions = useFeatureFlagsStore((state) => state.actions);

  return useMemo(
    () => ({
      isEnabled: actions.getFlag,
      setOverride: actions.setOverride,
      clearOverrides: actions.clearOverrides,
    }),
    [actions],
  );
}
