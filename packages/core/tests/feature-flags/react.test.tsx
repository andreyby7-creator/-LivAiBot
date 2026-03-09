// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import type { FeatureFlagName, FeatureFlagOverrides } from '../../src/feature-flags/core.js';
import {
  FeatureFlagOverrideProvider,
  useFeatureFlagOverride,
  useFeatureFlagOverrides,
} from '../../src/feature-flags/react.js';

const FLAG_A = 'AUTH_flagA' as const satisfies FeatureFlagName;

const makeWrapper =
  (overrides: Readonly<FeatureFlagOverrides>) =>
  ({ children }: { readonly children: React.ReactNode; }) => (
    <FeatureFlagOverrideProvider overrides={overrides}>
      {children}
    </FeatureFlagOverrideProvider>
  );

describe('feature-flags/react.tsx', () => {
  it('useFeatureFlagOverrides: без Provider возвращает frozen EMPTY_OVERRIDES', () => {
    const { result } = renderHook(() => useFeatureFlagOverrides());
    expect(result.current).toEqual({});
    expect(Object.isFrozen(result.current)).toBe(true);
  });

  it('useFeatureFlagOverrides: с Provider возвращает overrides из контекста', () => {
    const overrides: Readonly<FeatureFlagOverrides> = Object.freeze({ [FLAG_A]: true });
    const wrapper = makeWrapper(overrides);

    const { result } = renderHook(() => useFeatureFlagOverrides(), { wrapper });
    expect(result.current).toBe(overrides);
  });

  it('useFeatureFlagOverride: приоритет override > defaultValue', () => {
    const overrides: Readonly<FeatureFlagOverrides> = Object.freeze({ [FLAG_A]: false });
    const wrapper = makeWrapper(overrides);

    const { result } = renderHook(() => useFeatureFlagOverride(FLAG_A, true), { wrapper });
    expect(result.current).toBe(false);
  });

  it('useFeatureFlagOverride: без override возвращает defaultValue; без defaultValue возвращает false', () => {
    const overrides: Readonly<FeatureFlagOverrides> = Object.freeze({});
    const wrapper = makeWrapper(overrides);

    const withDefault = renderHook(() => useFeatureFlagOverride(FLAG_A, true), { wrapper });
    expect(withDefault.result.current).toBe(true);

    const withoutDefault = renderHook(() => useFeatureFlagOverride(FLAG_A), { wrapper });
    expect(withoutDefault.result.current).toBe(false);
  });

  it('useFeatureFlagOverride: без Provider работает от defaultValue', () => {
    expect(renderHook(() => useFeatureFlagOverride(FLAG_A, true)).result.current).toBe(true);
    expect(renderHook(() => useFeatureFlagOverride(FLAG_A)).result.current).toBe(false);
  });
});
