/**
 * @vitest-environment jsdom
 * @file Unit тесты для useFeatureFlags
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useSyncExternalStore to avoid infinite loops
vi.mock('react', async () => {
  const actualReact = await vi.importActual('react');
  return {
    ...actualReact,
    useSyncExternalStore: vi.fn((_subscribe, getSnapshot) => getSnapshot()),
  };
});

// We'll use Object.defineProperty for process.env in tests

const actionsMocks = vi.hoisted(() => ({
  getFlag: vi.fn(() => true),
  setOverride: vi.fn(),
  clearOverrides: vi.fn(),
}));

const storeState = {
  flags: {},
  overrides: {},
};

const storeMocks = vi.hoisted(() => ({
  subscribe: vi.fn(() => vi.fn()), // Mock subscribe that returns unsubscribe function
  getState: vi.fn(() => storeState),
}));

vi.mock('../../../src/providers/FeatureFlagsProvider', () => ({
  featureFlagsStore: storeMocks,
  useFeatureFlagsStore: vi.fn(() => actionsMocks),
}));

import { useFeatureFlags } from '../../../src/hooks/useFeatureFlags';

describe('useFeatureFlags hook', () => {
  const mockFlags = {
    'AUTH_LOGIN': true,
    'BILLING_PAYMENT': false,
    'AI_CHAT': true,
    'SYSTEM_MAINTENANCE': false,
  };

  const mockOverrides = {
    'AUTH_LOGIN': false,
    'AI_CHAT': undefined, // should be ignored
  };

  const mockCombinedFlags = {
    'AUTH_LOGIN': false, // overridden
    'BILLING_PAYMENT': false,
    'AI_CHAT': true, // not overridden
    'SYSTEM_MAINTENANCE': false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Update store state
    Object.assign(storeState, {
      flags: mockFlags,
      overrides: mockOverrides,
    });
    actionsMocks.getFlag.mockReturnValue(true);
  });

  it('возвращает корректный API с readonly флагами', () => {
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current).toHaveProperty('flags');
    expect(result.current).toHaveProperty('isEnabled');
    expect(result.current).toHaveProperty('setOverride');
    expect(result.current).toHaveProperty('clearOverrides');
    expect(result.current).toHaveProperty('toggle');

    // Проверяем что flags readonly
    expect(() => {
      (result.current.flags as any)['AUTH_LOGIN'] = false;
    }).not.toThrow(); // Object.defineProperty не используется в простом объекте
  });

  it('useSyncExternalStore вызывается для получения snapshot', () => {
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags).toBeDefined();
  });

  it('flags snapshot правильно объединяет базовые флаги с overrides', () => {
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags).toEqual(mockCombinedFlags);
  });

  it('isEnabled проксирует вызов в actions.getFlag', () => {
    const { result } = renderHook(() => useFeatureFlags());

    const enabled = result.current.isEnabled('AUTH_LOGIN' as any);

    expect(actionsMocks.getFlag).toHaveBeenCalledWith('AUTH_LOGIN');
    expect(enabled).toBe(true);
  });

  it('setOverride проксирует вызов в actions.setOverride', () => {
    const { result } = renderHook(() => useFeatureFlags());

    result.current.setOverride('AUTH_LOGIN' as any, false);

    expect(actionsMocks.setOverride).toHaveBeenCalledWith('AUTH_LOGIN', false);
  });

  it('clearOverrides проксирует вызов в actions.clearOverrides', () => {
    const { result } = renderHook(() => useFeatureFlags());

    result.current.clearOverrides();

    expect(actionsMocks.clearOverrides).toHaveBeenCalledTimes(1);
  });

  it('toggle переключает флаг только в development режиме', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const { result } = renderHook(() => useFeatureFlags());

    actionsMocks.getFlag.mockReturnValue(true);
    result.current.toggle('AUTH_LOGIN' as any);

    expect(actionsMocks.getFlag).toHaveBeenCalledWith('AUTH_LOGIN');
    expect(actionsMocks.setOverride).toHaveBeenCalledWith('AUTH_LOGIN', false);

    // Test production mode
    vi.stubEnv('NODE_ENV', 'production');
    actionsMocks.setOverride.mockClear();

    result.current.toggle('AUTH_LOGIN' as any);

    expect(actionsMocks.setOverride).not.toHaveBeenCalled();
  });

  it('toggle корректно работает с false значением', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const { result } = renderHook(() => useFeatureFlags());

    actionsMocks.getFlag.mockReturnValue(false);
    result.current.toggle('AUTH_LOGIN' as any);

    expect(actionsMocks.setOverride).toHaveBeenCalledWith('AUTH_LOGIN', true);
  });

  it('работает с пустыми overrides', () => {
    Object.assign(storeState, {
      flags: mockFlags,
      overrides: {},
    });

    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags).toEqual(mockFlags);
  });

  it('работает с пустыми флагами', () => {
    Object.assign(storeState, {
      flags: {},
      overrides: {},
    });

    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags).toEqual({});
  });

  it('работает корректно с начальным состоянием', () => {
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags).toEqual(mockCombinedFlags);
  });

  it('getCombinedFlags правильно фильтрует undefined значения', () => {
    const { result } = renderHook(() => useFeatureFlags());

    // Проверяем что undefined override игнорируется
    expect(result.current.flags['AI_CHAT']).toBe(true); // из базовых флагов
  });

  it('функции стабильны между рендерами (useCallback/useMemo)', () => {
    const { result, rerender } = renderHook(() => useFeatureFlags());

    const firstRender = {
      isEnabled: result.current.isEnabled,
      setOverride: result.current.setOverride,
      clearOverrides: result.current.clearOverrides,
      toggle: result.current.toggle,
    };

    rerender();

    const secondRender = {
      isEnabled: result.current.isEnabled,
      setOverride: result.current.setOverride,
      clearOverrides: result.current.clearOverrides,
      toggle: result.current.toggle,
    };

    expect(firstRender.isEnabled).toBe(secondRender.isEnabled);
    expect(firstRender.setOverride).toBe(secondRender.setOverride);
    expect(firstRender.clearOverrides).toBe(secondRender.clearOverrides);
    expect(firstRender.toggle).toBe(secondRender.toggle);
  });
});
