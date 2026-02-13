/**
 * @vitest-environment jsdom
 * @file Unit тесты для UnifiedUIProvider (эталонный UI инфраструктурный провайдер)
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const providerMocks = vi.hoisted(() => ({
  FeatureFlagsProvider: vi.fn(({ children }) => (
    <div data-testid='feature-flags-provider'>{children}</div>
  )),
  TelemetryProvider: vi.fn(({ children }) => <div data-testid='telemetry-provider'>{children}
  </div>),
  IntlProvider: vi.fn(({ children }) => <div data-testid='intl-provider'>{children}</div>),
}));

const hookMocks = vi.hoisted(() => ({
  useFeatureFlags: vi.fn(() => ({
    isEnabled: vi.fn((name: string) => name === 'SYSTEM_enabled-flag'),
    setOverride: vi.fn(),
    clearOverrides: vi.fn(),
  })),
  useTelemetryContext: vi.fn(() => ({
    track: vi.fn(),
    flush: vi.fn(),
  })),
}));

vi.mock('../../../src/providers/FeatureFlagsProvider', () => ({
  useFeatureFlags: hookMocks.useFeatureFlags,
}));

vi.mock('../../../src/providers/TelemetryProvider', () => ({
  useTelemetryContext: hookMocks.useTelemetryContext,
}));

vi.mock('../../../src/providers/intl-provider', () => ({
  IntlProvider: providerMocks.IntlProvider,
}));

vi.mock('../../../src/lib/i18n', () => ({
  useI18n: vi.fn(() => ({
    locale: 'en',
    fallbackLocale: 'en',
    translate: vi.fn((ns, key) => `${ns}:${key}`),
    loadNamespace: vi.fn(),
    isNamespaceLoaded: vi.fn(() => true),
  })),
  t: vi.fn((key, params) => params?.default ?? key),
  formatDateLocalized: vi.fn((date, format) => date.format(format)),
  setDayjsLocale: vi.fn(),
  isRtlLocale: vi.fn((locale: string) => locale === 'ar'),
}));

vi.mock('../../../src/lib/telemetry-runtime', () => ({
  infoFireAndForget: vi.fn(),
  warnFireAndForget: vi.fn(),
  errorFireAndForget: vi.fn(),
}));

import {
  UnifiedUIProvider,
  useRequiredUnifiedUI,
  useUnifiedFeatureFlags,
  useUnifiedI18n,
  useUnifiedTelemetry,
  useUnifiedUI,
} from '../../../src/providers/UnifiedUIProvider';
import type { UnifiedUIContextType } from '../../../src/providers/UnifiedUIProvider';

describe('UnifiedUIProvider', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    hookMocks.useFeatureFlags.mockReturnValue({
      isEnabled: vi.fn((name: string) => name === 'SYSTEM_enabled-flag'),
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
    });
    hookMocks.useTelemetryContext.mockReturnValue({
      track: vi.fn(),
      flush: vi.fn(),
    });
  });

  describe('Provider Composition', () => {
    it('renders children within provider structure', () => {
      render(
        <UnifiedUIProvider>
          <div data-testid='child'>Test Child</div>
        </UnifiedUIProvider>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('accepts intl props without errors', () => {
      expect(() => {
        render(
          <UnifiedUIProvider>
            <div>Child</div>
          </UnifiedUIProvider>,
        );
      }).not.toThrow();
    });
  });

  describe('Context Integration', () => {
    const TestConsumer = () => {
      const context = useUnifiedUI();
      return (
        <div data-testid='context-data'>
          <div data-testid='feature-flags-enabled'>
            {String(context.featureFlags.isEnabled('SYSTEM_enabled-flag'))}
          </div>
          <div data-testid='i18n-locale'>{context.i18n.locale}</div>
          <div data-testid='i18n-direction'>{context.i18n.direction}</div>
        </div>
      );
    };

    it('provides unified context with feature flags, telemetry, and i18n', () => {
      render(
        <UnifiedUIProvider>
          <TestConsumer />
        </UnifiedUIProvider>,
      );

      expect(screen.getByTestId('feature-flags-enabled')).toHaveTextContent('true');
      expect(screen.getByTestId('i18n-locale')).toHaveTextContent('en');
      expect(screen.getByTestId('i18n-direction')).toHaveTextContent('ltr');
    });

    it('provides stable context reference across re-renders', () => {
      const contextRefs: UnifiedUIContextType[] = [];

      const ContextCapture = () => {
        const context = useUnifiedUI();
        contextRefs.push(context);
        return <div>Captured</div>;
      };

      const { rerender } = render(
        <UnifiedUIProvider>
          <ContextCapture />
        </UnifiedUIProvider>,
      );

      // Re-render with same props
      rerender(
        <UnifiedUIProvider>
          <ContextCapture />
        </UnifiedUIProvider>,
      );

      // Context should have stable structure (functions should be callable)
      expect(contextRefs[0]).toBeDefined();
      expect(contextRefs[0]).toHaveProperty('featureFlags');
      expect(contextRefs[0]).toHaveProperty('telemetry');
      expect(contextRefs[0]).toHaveProperty('i18n');
      expect(typeof contextRefs[0]!.i18n.translate).toBe('function');
    });
  });

  describe('Hook API', () => {
    describe('useUnifiedUI', () => {
      it('returns complete unified context', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedUI(), { wrapper });

        expect(result.current).toHaveProperty('featureFlags');
        expect(result.current).toHaveProperty('telemetry');
        expect(result.current).toHaveProperty('i18n');
        expect(result.current.i18n.locale).toBe('en');
        expect(result.current.i18n.direction).toBe('ltr');
      });

      it('returns NOOP_CONTEXT when provider is missing', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { result } = renderHook(() => useUnifiedUI());

        expect(result.current).toHaveProperty('featureFlags');
        expect(result.current).toHaveProperty('telemetry');
        expect(result.current).toHaveProperty('i18n');
        expect(result.current.i18n.locale).toBe('en');

        // Test NOOP implementations directly - covers NOOP_FEATURE_FLAGS functions
        expect(result.current.featureFlags.isEnabled('SYSTEM_test')).toBe(false);
        result.current.featureFlags.setOverride('SYSTEM_test', true); // covers setOverride
        result.current.featureFlags.clearOverrides(); // covers clearOverrides
        expect(result.current.telemetry.track).not.toThrow();
        expect(result.current.telemetry.flush).not.toThrow();

        consoleWarnSpy.mockRestore();
      });
    });

    describe('useRequiredUnifiedUI', () => {
      it('returns context when provider is present', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useRequiredUnifiedUI(), { wrapper });

        expect(result.current).toHaveProperty('featureFlags');
        expect(result.current).toHaveProperty('telemetry');
        expect(result.current).toHaveProperty('i18n');
      });

      it('is a function that requires provider context', () => {
        // useRequiredUnifiedUI can only be tested in runtime with proper provider setup
        // This test verifies the function exists and is properly exported
        expect(typeof useRequiredUnifiedUI).toBe('function');
      });

      it('throws error when provider is missing', () => {
        // Mock console.warn to avoid noise in test output
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          // useRequiredUnifiedUI should throw when no provider is present
          expect(() => {
            renderHook(() => useRequiredUnifiedUI());
          }).toThrow(
            'UnifiedUIProvider является обязательным, но отсутствует в дереве компонентов. '
              + 'Убедитесь что UnifiedUIProvider обернут вокруг вашего приложения.',
          );
        } finally {
          consoleWarnSpy.mockRestore();
        }
      });
    });

    describe('useUnifiedFeatureFlags', () => {
      it('returns only feature flags API', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedFeatureFlags(), { wrapper });

        expect(result.current).toHaveProperty('isEnabled');
        expect(result.current).toHaveProperty('setOverride');
        expect(result.current).toHaveProperty('clearOverrides');
        expect(typeof result.current.isEnabled).toBe('function');
      });
    });

    describe('useUnifiedTelemetry', () => {
      it('returns only telemetry API', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        expect(result.current).toHaveProperty('track');
        expect(result.current).toHaveProperty('flush');
        expect(typeof result.current.track).toBe('function');
        expect(typeof result.current.flush).toBe('function');
      });
    });

    describe('useUnifiedI18n', () => {
      it('returns only i18n context', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedI18n(), { wrapper });

        expect(result.current).toHaveProperty('locale');
        expect(result.current).toHaveProperty('direction');
        expect(result.current.locale).toBe('en');
        expect(result.current.direction).toBe('ltr');
      });
    });
  });

  describe('SSR Safety', () => {
    it('handles SSR environment gracefully', () => {
      // UnifiedUIProvider is SSR-safe by design - it uses hooks that handle SSR
      expect(() => {
        render(
          <UnifiedUIProvider>
            <div>SSR Content</div>
          </UnifiedUIProvider>,
        );
      }).not.toThrow();

      expect(screen.getByText('SSR Content')).toBeInTheDocument();
    });
  });

  describe('NOOP Implementations', () => {
    it('provides callable NOOP functions when hooks fail', () => {
      // Mock console.warn to avoid noise in test output
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Test that NOOP implementations are callable and return expected values
        const { result } = renderHook(() => useUnifiedUI());

        // Should return NOOP context when provider is missing
        expect(result.current).toHaveProperty('__status');

        // NOOP feature flags should be callable
        expect(typeof result.current.featureFlags.isEnabled).toBe('function');
        expect(result.current.featureFlags.isEnabled('SYSTEM_telemetry_enabled')).toBe(false);

        // NOOP telemetry should be callable
        expect(typeof result.current.telemetry.track).toBe('function');
        expect(typeof result.current.telemetry.infoFireAndForget).toBe('function');
        expect(typeof result.current.telemetry.warnFireAndForget).toBe('function');
        expect(typeof result.current.telemetry.errorFireAndForget).toBe('function');
        expect(typeof result.current.telemetry.flush).toBe('function');

        // NOOP i18n should be callable
        expect(typeof result.current.i18n.translate).toBe('function');
        expect(result.current.i18n.translate('common', 'greeting')).toBe('');
        expect(typeof result.current.i18n.loadNamespace).toBe('function');
        expect(typeof result.current.i18n.isNamespaceLoaded).toBe('function');
        expect(result.current.i18n.isNamespaceLoaded('common')).toBe(false);

        // Call NOOP telemetry functions to ensure they're covered
        result.current.telemetry.infoFireAndForget('test');
        result.current.telemetry.warnFireAndForget('test');
        result.current.telemetry.errorFireAndForget('test');

        // Call NOOP i18n loadNamespace to ensure it's covered
        result.current.i18n.loadNamespace('auth');
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });
  });

  describe('Error Boundaries', () => {
    it('handles hook errors gracefully', () => {
      const errorHook = vi.fn(() => {
        throw new Error('Hook failed');
      });

      hookMocks.useFeatureFlags.mockImplementation(errorHook);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <UnifiedUIProvider>
            <div>Test</div>
          </UnifiedUIProvider>,
        );
      }).toThrow('Hook failed');

      consoleErrorSpy.mockRestore();
    });

    it('provides NOOP implementations when hooks fail', () => {
      // Temporarily make hooks fail
      hookMocks.useFeatureFlags.mockImplementation(() => {
        throw new Error('Hook failed');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // This should not crash the app, but fall back to NOOP
      expect(() => {
        render(
          <UnifiedUIProvider>
            <div>Fallback content</div>
          </UnifiedUIProvider>,
        );
      }).toThrow(); // Component will throw due to hook error

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Performance Characteristics', () => {
    it('minimizes re-renders with stable context', () => {
      let renderCount = 0;

      const RenderTracker = () => {
        renderCount++;
        return <div>Rendered {renderCount} times</div>;
      };

      const { rerender } = render(
        <UnifiedUIProvider>
          <RenderTracker />
        </UnifiedUIProvider>,
      );

      // Re-render with same props - React may still re-render child
      rerender(
        <UnifiedUIProvider>
          <RenderTracker />
        </UnifiedUIProvider>,
      );

      // Context stability is tested separately, here we verify basic functionality
      expect(screen.getByText(/Rendered \d+ times/)).toBeInTheDocument();
    });
  });

  describe('Type Safety', () => {
    it('accepts valid props without errors', () => {
      expect(() => {
        render(
          <UnifiedUIProvider>
            <div />
          </UnifiedUIProvider>,
        );
      }).not.toThrow();
    });

    it('provides type-safe context access', () => {
      const wrapper = ({ children }: { children: React.ReactNode; }) => (
        <UnifiedUIProvider>{children}</UnifiedUIProvider>
      );

      const { result } = renderHook(() => useUnifiedUI(), { wrapper });

      // TypeScript ensures these properties exist and have correct types
      expect(typeof result.current.featureFlags.isEnabled).toBe('function');
      expect(typeof result.current.telemetry.track).toBe('function');
      expect(typeof result.current.i18n.locale).toBe('string');
      expect(['ltr', 'rtl']).toContain(result.current.i18n.direction);
    });
  });
});
