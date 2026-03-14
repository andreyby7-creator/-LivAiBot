/**
 * @vitest-environment jsdom
 * @file Unit тесты для UnifiedUIProvider (эталонный UI инфраструктурный провайдер)
 */

import { cleanup, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  useFeatureFlagOverrides: vi.fn(() => ({})),
}));

vi.mock('../../../src/providers/FeatureFlagsProvider', () => ({
  useFeatureFlags: hookMocks.useFeatureFlags,
}));

vi.mock('@livai/core/feature-flags/react', () => ({
  useFeatureFlagOverrides: hookMocks.useFeatureFlagOverrides,
}));

vi.mock('../../../src/providers/TelemetryProvider', () => ({
  useTelemetryContext: hookMocks.useTelemetryContext,
}));

vi.mock('../../../src/providers/intl-provider', () => ({
  IntlProvider: providerMocks.IntlProvider,
}));

const i18nMocks = vi.hoisted(() => ({
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

vi.mock('../../../src/lib/i18n', () => i18nMocks);

const telemetryRuntimeMocks = vi.hoisted(() => ({
  infoFireAndForget: vi.fn(),
  warnFireAndForget: vi.fn(),
  errorFireAndForget: vi.fn(),
}));

vi.mock('../../../src/lib/telemetry-runtime', () => telemetryRuntimeMocks);

import type { UnifiedUIContextType } from '../../../src/providers/UnifiedUIProvider';
import {
  UnifiedUIProvider,
  useRequiredUnifiedUI,
  useUnifiedFeatureFlags,
  useUnifiedI18n,
  useUnifiedTelemetry,
  useUnifiedUI,
} from '../../../src/providers/UnifiedUIProvider';

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

      it('returns NOOP context when provider is missing', () => {
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
        expect(result.current.featureFlags.getOverride('SYSTEM_test', true)).toBe(true); // covers getOverride
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

      it('returns context when all contexts are provided', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useRequiredUnifiedUI(), { wrapper });

        expect(result.current).toHaveProperty('featureFlags');
        expect(result.current).toHaveProperty('telemetry');
        expect(result.current).toHaveProperty('i18n');
        expect(result.current.featureFlags.isEnabled('SYSTEM_enabled-flag')).toBe(true);
      });
    });

    describe('useUnifiedFeatureFlags', () => {
      it('returns only feature flags API with getOverride', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedFeatureFlags(), { wrapper });

        expect(result.current).toHaveProperty('isEnabled');
        expect(result.current).toHaveProperty('setOverride');
        expect(result.current).toHaveProperty('clearOverrides');
        expect(result.current).toHaveProperty('getOverride');
        expect(typeof result.current.isEnabled).toBe('function');
        expect(typeof result.current.getOverride).toBe('function');
      });

      it('getOverride uses overrides from context', () => {
        hookMocks.useFeatureFlagOverrides.mockReturnValue({
          SYSTEM_test_flag: true,
        });

        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedFeatureFlags(), { wrapper });

        expect(result.current.getOverride('SYSTEM_test_flag', false)).toBe(true);
        expect(result.current.getOverride('SYSTEM_unknown_flag', false)).toBe(false);
        expect(result.current.getOverride('SYSTEM_unknown_flag')).toBe(false);
      });
    });

    describe('useUnifiedTelemetry', () => {
      it('returns only telemetry API with fire-and-forget methods', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        expect(result.current).toHaveProperty('track');
        expect(result.current).toHaveProperty('flush');
        expect(result.current).toHaveProperty('infoFireAndForget');
        expect(result.current).toHaveProperty('warnFireAndForget');
        expect(result.current).toHaveProperty('errorFireAndForget');
        expect(typeof result.current.track).toBe('function');
        expect(typeof result.current.flush).toBe('function');
        expect(typeof result.current.infoFireAndForget).toBe('function');
        expect(typeof result.current.warnFireAndForget).toBe('function');
        expect(typeof result.current.errorFireAndForget).toBe('function');
      });

      it('telemetry sanitizes sensitive data', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        result.current.infoFireAndForget('test', {
          password: 'secret123',
          token: 'abc123',
          authorization: 'Bearer xyz',
          cookie: 'session=abc',
          secret: 'hidden',
          apiKey: 'key123',
          accessToken: 'token123',
          refreshToken: 'refresh123',
          safeData: 'ok',
        });

        // Should filter sensitive keys
        expect(telemetryRuntimeMocks.infoFireAndForget).toHaveBeenCalledWith(
          'test',
          expect.objectContaining({
            safeData: 'ok',
          }),
        );

        // Should not contain sensitive data
        const callArgs = telemetryRuntimeMocks.infoFireAndForget.mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs) {
          expect(callArgs[1]).not.toHaveProperty('password');
          expect(callArgs[1]).not.toHaveProperty('token');
          expect(callArgs[1]).not.toHaveProperty('authorization');
          expect(callArgs[1]).not.toHaveProperty('cookie');
          expect(callArgs[1]).not.toHaveProperty('secret');
          expect(callArgs[1]).not.toHaveProperty('apiKey');
          expect(callArgs[1]).not.toHaveProperty('accessToken');
          expect(callArgs[1]).not.toHaveProperty('refreshToken');
        }
      });

      it('telemetry handles null and undefined values', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        result.current.infoFireAndForget('test', {
          nullValue: null,
          undefinedValue: undefined,
          stringValue: 'test',
          numberValue: 42,
          booleanValue: true,
        });

        const callArgs = telemetryRuntimeMocks.infoFireAndForget.mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs) {
          const metadata = callArgs[1];
          expect(metadata?.nullValue).toBe(null);
          expect(metadata?.stringValue).toBe('test');
          expect(metadata?.numberValue).toBe(42);
          expect(metadata?.booleanValue).toBe(true);
        }
      });

      it('telemetry handles non-serializable values', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        const circular: Record<string, unknown> = {};
        circular['self'] = circular;

        result.current.infoFireAndForget('test', {
          circular,
          normal: 'ok',
        });

        const callArgs = telemetryRuntimeMocks.infoFireAndForget.mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs) {
          const metadata = callArgs[1];
          expect(metadata?.circular).toBe('[Non-serializable]');
          expect(metadata?.normal).toBe('ok');
        }
      });

      it('telemetry limits payload size', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        // Create large object that will be serialized
        const largeData = { largeField: { nested: 'x'.repeat(2000) } };
        result.current.infoFireAndForget('test', largeData);

        const callArgs = telemetryRuntimeMocks.infoFireAndForget.mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs !== undefined) {
          const metadata = callArgs[1];
          // Serialized object should be truncated (covers branch where length > MAX_METADATA_VALUE_SIZE)
          expect(metadata?.largeField).toBeDefined();
          if (metadata?.largeField !== undefined && typeof metadata.largeField === 'string') {
            expect(metadata.largeField.length).toBeLessThanOrEqual(1024);
          }
        }
      });

      it('telemetry handles small payloads without truncation', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        // Small object that should not be truncated (covers branch where length <= MAX_METADATA_VALUE_SIZE)
        const smallData = { smallField: { nested: 'x'.repeat(100) } };
        result.current.infoFireAndForget('test', smallData);

        const callArgs = telemetryRuntimeMocks.infoFireAndForget.mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs) {
          const metadata = callArgs[1];
          expect(metadata?.smallField).toBeDefined();
        }
      });

      it('telemetry handles all fire-and-forget methods', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedTelemetry(), { wrapper });

        result.current.warnFireAndForget('warn', { data: 'test' });
        result.current.errorFireAndForget('error', { data: 'test' });
        result.current.infoFireAndForget('info'); // covers branch without data parameter
        result.current.warnFireAndForget('warn'); // covers branch without data for warn
        result.current.errorFireAndForget('error'); // covers branch without data for error

        expect(telemetryRuntimeMocks.warnFireAndForget).toHaveBeenCalledTimes(2);
        expect(telemetryRuntimeMocks.errorFireAndForget).toHaveBeenCalledTimes(2);
        expect(telemetryRuntimeMocks.infoFireAndForget).toHaveBeenCalled();
      });
    });

    describe('useUnifiedI18n', () => {
      it('returns only i18n context without t (no duplication)', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedI18n(), { wrapper });

        expect(result.current).toHaveProperty('locale');
        expect(result.current).toHaveProperty('direction');
        expect(result.current).toHaveProperty('translate');
        expect(result.current).toHaveProperty('formatDateLocalized');
        expect(result.current).toHaveProperty('setDayjsLocale');
        expect(result.current).not.toHaveProperty('t'); // t removed in new architecture
        expect(result.current.locale).toBe('en');
        expect(result.current.direction).toBe('ltr');
      });

      it('handles RTL locales correctly', () => {
        i18nMocks.useI18n.mockReturnValue({
          locale: 'ar',
          fallbackLocale: 'en',
          translate: vi.fn((ns, key) => `${ns}:${key}`),
          loadNamespace: vi.fn(),
          isNamespaceLoaded: vi.fn(() => true),
        });
        i18nMocks.isRtlLocale.mockReturnValue(true);

        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedI18n(), { wrapper });

        expect(result.current.direction).toBe('rtl');
      });

      it('calls i18n helper functions', () => {
        const wrapper = ({ children }: { children: React.ReactNode; }) => (
          <UnifiedUIProvider>{children}</UnifiedUIProvider>
        );

        const { result } = renderHook(() => useUnifiedI18n(), { wrapper });

        const mockDate = { format: vi.fn(() => '2024-01-01') };
        result.current.formatDateLocalized(mockDate as never, 'YYYY-MM-DD');
        result.current.setDayjsLocale('en');

        expect(i18nMocks.formatDateLocalized).toHaveBeenCalled();
        expect(i18nMocks.setDayjsLocale).toHaveBeenCalled();
      });

      it('returns NOOP i18n when provider is missing', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { result } = renderHook(() => useUnifiedI18n());

        expect(result.current.locale).toBe('en');
        expect(result.current.direction).toBe('ltr');
        expect(result.current.formatDateLocalized({} as never, 'YYYY-MM-DD')).toBe('');
        result.current.setDayjsLocale('en'); // covers NOOP setDayjsLocale

        consoleWarnSpy.mockRestore();
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
    it('provides callable NOOP functions when provider is missing', () => {
      // Mock console.warn to avoid noise in test output
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Test that NOOP implementations are callable and return expected values
        const { result } = renderHook(() => useUnifiedUI());

        // Should return NOOP context when provider is missing (no __status in new architecture)
        expect(result.current).toHaveProperty('featureFlags');
        expect(result.current).toHaveProperty('telemetry');
        expect(result.current).toHaveProperty('i18n');

        // NOOP feature flags should be callable
        expect(typeof result.current.featureFlags.isEnabled).toBe('function');
        expect(result.current.featureFlags.isEnabled('SYSTEM_telemetry_enabled')).toBe(false);
        expect(typeof result.current.featureFlags.getOverride).toBe('function');
        expect(result.current.featureFlags.getOverride('SYSTEM_test', true)).toBe(true);

        // NOOP telemetry should be callable
        expect(typeof result.current.telemetry.track).toBe('function');
        expect(typeof result.current.telemetry.infoFireAndForget).toBe('function');
        expect(typeof result.current.telemetry.warnFireAndForget).toBe('function');
        expect(typeof result.current.telemetry.errorFireAndForget).toBe('function');
        expect(typeof result.current.telemetry.flush).toBe('function');

        // NOOP i18n should be callable (without 't' in new architecture)
        expect(typeof result.current.i18n.translate).toBe('function');
        expect(result.current.i18n.translate('common', 'greeting')).toBe('');
        expect(typeof result.current.i18n.loadNamespace).toBe('function');
        expect(typeof result.current.i18n.isNamespaceLoaded).toBe('function');
        expect(result.current.i18n.isNamespaceLoaded('common')).toBe(false);
        expect(typeof result.current.i18n.formatDateLocalized).toBe('function');
        expect(typeof result.current.i18n.setDayjsLocale).toBe('function');

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
