/**
 * @file packages/app/src/hooks/useFeatureFlags.ts
 * ============================================================================
 * 🚩 USE FEATURE FLAGS — FLUENT API ДЛЯ ФЛАГОВ
 * ============================================================================
 *
 * Назначение:
 * - Typed доступ к feature flags через Zustand selectors
 * - Dev-only toggle для локальной отладки
 * - SSR-safe snapshot чтение через useSyncExternalStore
 * - Стабильный и чистый API через useMemo/useCallback
 *
 * Границы ответственности:
 * - Чтение и управление флагами
 * - Dev-only toggle и overrides
 * - Без бизнес-логики
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { FeatureFlagName } from '../lib/feature-flags.js';
import { featureFlagsStore, useFeatureFlagsStore } from '../providers/FeatureFlagsProvider.js';
import type { FeatureFlags } from '../types/common.js';
import type { UiFeatureFlags } from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте feature flags хуков */
export type UseFeatureFlagsUi = UiFeatureFlags;

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Ключ флага как строка */
export type FeatureFlagKey = FeatureFlagName;

/** Публичный API хука useFeatureFlags */
export type UseFeatureFlagsApi = Readonly<{
  /** Текущий snapshot всех флагов с учётом overrides */
  readonly flags: Readonly<FeatureFlags>;
  /** Проверяет включён ли флаг */
  readonly isEnabled: <K extends FeatureFlagKey>(key: K) => boolean;
  /** Устанавливает override для конкретного флага */
  readonly setOverride: <K extends FeatureFlagKey>(key: K, value: boolean) => void;
  /** Сбрасывает все overrides */
  readonly clearOverrides: () => void;
  /** Toggle флага (только для development) */
  readonly toggle: <K extends FeatureFlagKey>(key: K) => void;
}>;

/* ============================================================================
 * 🧰 UTILS
 * ========================================================================== */

/** Пустой snapshot флагов для SSR fallback */
const EMPTY_FLAGS: Readonly<FeatureFlags> = Object.freeze({} as FeatureFlags);

/** Проверка development режима */
function isDevelopmentMode(): boolean {
  return process.env['NODE_ENV'] === 'development';
}

/** Создает snapshot флагов с учётом overrides */
function getCombinedFlags(state: ReturnType<typeof featureFlagsStore.getState>): FeatureFlags {
  // Фильтруем undefined значения и создаем объект overrides
  const overrides = Object.fromEntries(
    Object.entries(state.overrides)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value as boolean]),
  );
  return { ...state.flags, ...overrides };
}

/* ============================================================================
 * 🪝 HOOK
 * ========================================================================== */

/**
 * SSR-safe hook для чтения и управления feature flags.
 *
 * Использует:
 * - Zustand selectors для локальных изменений и overrides
 * - useSyncExternalStore для согласованного snapshot в SSR/CSR
 * - useMemo/useCallback для стабильного API
 *
 * ⚠️ Snapshot — readonly, любые изменения только через `actions`.
 */
export function useFeatureFlags(): UseFeatureFlagsApi {
  const actions = useFeatureFlagsStore((state) => state.actions);

  /** SSR-safe snapshot всех флагов с учётом overrides (readonly, мутации только через actions) */
  const flagsSnapshot = useSyncExternalStore(
    featureFlagsStore.subscribe,
    () => getCombinedFlags(featureFlagsStore.getState()),
    () => EMPTY_FLAGS,
  );

  /** Проверка включённости флага */
  const isEnabled = useCallback(<K extends FeatureFlagKey>(key: K): boolean => {
    return actions.getFlag(key);
  }, [actions]);

  /** Установка override для конкретного флага */
  const setOverride = useCallback(<K extends FeatureFlagKey>(key: K, value: boolean): void => {
    actions.setOverride(key, value);
  }, [actions]);

  /** Сброс всех overrides */
  const clearOverrides = useCallback((): void => {
    actions.clearOverrides();
  }, [actions]);

  /** Toggle флага (только для development) */
  const toggle = useCallback(<K extends FeatureFlagKey>(key: K): void => {
    if (!isDevelopmentMode()) return;
    const current = actions.getFlag(key);
    actions.setOverride(key, !current);
  }, [actions]);

  /** Стабильный публичный API */
  return useMemo<UseFeatureFlagsApi>(() => ({
    flags: flagsSnapshot,
    isEnabled,
    setOverride,
    clearOverrides,
    toggle,
  } as const), [flagsSnapshot, isEnabled, setOverride, clearOverrides, toggle]);
}
