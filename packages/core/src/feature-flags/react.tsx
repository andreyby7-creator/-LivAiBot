/**
 * @file packages/core/src/feature-flags/react.tsx
 * ============================================================================
 * 🚩 CORE — Feature Flags (React Parts)
 * ============================================================================
 *
 * React-специфичные части feature flags.
 * Client-only модуль (`'use client'`): override context/provider/hooks для UI.
 * Изолированы от core engine: не импортировать в backend/не-React runtime.
 * Важно: если overrides приходят из query/localStorage/remote config — whitelist/политики безопасности должны быть на уровне consumer/app.
 */

'use client';

import type { JSX } from 'react';
import React from 'react';

import type { FeatureFlagName, FeatureFlagOverrides } from './core.js';

/* ============================================================================
 * 🎭 RUNTIME FLAG OVERRIDE CONTEXT
 * ========================================================================== */

/**
 * Context для runtime переопределения feature flags.
 * Позволяет динамически изменять состояние флагов без перезапуска приложения.
 */
export const FeatureFlagOverrideContext = React.createContext<
  Readonly<FeatureFlagOverrides> | null
>(null);

export interface FeatureFlagOverrideProviderProps {
  readonly overrides: Readonly<FeatureFlagOverrides>;
  readonly children: React.ReactNode;
}

/**
 * Provider для runtime переопределения feature flags.
 * Используется для A/B тестирования и динамических изменений.
 */
export const FeatureFlagOverrideProvider = ({
  overrides,
  children,
}: FeatureFlagOverrideProviderProps): JSX.Element => (
  <FeatureFlagOverrideContext.Provider value={overrides}>
    {children}
  </FeatureFlagOverrideContext.Provider>
);

const EMPTY_OVERRIDES: Readonly<FeatureFlagOverrides> = Object.freeze({});

/**
 * Hook для получения всех overrides из контекста.
 * Удобно для debug panels / dev tools / UI экспериментов.
 */
export function useFeatureFlagOverrides(): Readonly<FeatureFlagOverrides> {
  return React.useContext(FeatureFlagOverrideContext) ?? EMPTY_OVERRIDES;
}

/**
 * Hook для получения переопределенных значений feature flags.
 * Приоритет: override > defaultValue.
 */
export function useFeatureFlagOverride(
  flagName: FeatureFlagName,
  defaultValue?: boolean,
): boolean {
  const overrides = React.useContext(FeatureFlagOverrideContext);
  return overrides?.[flagName] ?? defaultValue ?? false;
}
