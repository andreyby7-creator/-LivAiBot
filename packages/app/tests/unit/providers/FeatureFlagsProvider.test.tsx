/**
 * @vitest-environment jsdom
 * @file Unit тесты для FeatureFlagsProvider
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';

import {
  FeatureFlagsProvider,
  featureFlagsStore,
  useFeatureFlags,
} from '../../../src/providers/FeatureFlagsProvider';
import type { FeatureFlagName } from '../../../src/lib/feature-flags';

const FLAG_A = 'SYSTEM_feature_a' as FeatureFlagName;
const FLAG_B = 'SYSTEM_feature_b' as FeatureFlagName;

describe('FeatureFlagsProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    featureFlagsStore.persist.clearStorage();
    featureFlagsStore.setState(
      (state: any) => ({
        ...state,
        flags: {},
        overrides: {},
      }),
      false,
    );
  });

  it('hydrates initial flags once when values are unchanged', () => {
    const setStateSpy = vi.spyOn(featureFlagsStore, 'setState');
    setStateSpy.mockClear();

    const initialFlags = { [FLAG_A]: true };
    const { rerender } = render(
      <FeatureFlagsProvider initialFlags={initialFlags}>
        <div />
      </FeatureFlagsProvider>,
    );

    const hydrationCalls = setStateSpy.mock.calls.filter(
      (call: any) => call[2] === 'hydrate/initialFlags',
    );
    expect(hydrationCalls).toHaveLength(0); // Since we removed the third parameter

    rerender(
      <FeatureFlagsProvider initialFlags={{ [FLAG_A]: true }}>
        <div />
      </FeatureFlagsProvider>,
    );

    const hydrationCallsAfterRerender = setStateSpy.mock.calls.filter(
      (call: any) => call[2] === 'hydrate/initialFlags',
    );
    expect(hydrationCallsAfterRerender).toHaveLength(0); // Since we removed the third parameter
  });

  it('returns overridden value and clears overrides', () => {
    const wrapper = ({ children }: { children: React.ReactNode; }) => (
      <FeatureFlagsProvider initialFlags={{ [FLAG_A]: true }}>
        {children}
      </FeatureFlagsProvider>
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isEnabled(FLAG_A)).toBe(true);

    act(() => {
      result.current.setOverride(FLAG_A, false);
    });

    expect(result.current.isEnabled(FLAG_A)).toBe(false);

    act(() => {
      result.current.clearOverrides();
    });

    expect(result.current.isEnabled(FLAG_A)).toBe(true);
  });

  it('setFlags performs shallow merge without resetting existing flags', () => {
    act(() => {
      featureFlagsStore.getState().actions.setFlags({ [FLAG_A]: true });
      featureFlagsStore.getState().actions.setFlags({ [FLAG_B]: true });
    });

    const { flags } = featureFlagsStore.getState();
    expect(flags[FLAG_A]).toBe(true);
    expect(flags[FLAG_B]).toBe(true);
  });
});
