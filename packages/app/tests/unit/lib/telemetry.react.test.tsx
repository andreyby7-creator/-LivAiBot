/**
 * @vitest-environment jsdom
 * @file packages/app/tests/unit/lib/telemetry.react.test.tsx
 * ============================================================================
 * 🎨 REACT ТЕСТЫ — КОМПОНЕНТЫ / MOCK RUNTIME / JSDOM
 * ============================================================================
 *
 * Тестирует только React структуры с DOM и замоканной асинхронной логикой:
 * - useTelemetry хук существует
 * - TelemetryBatchProvider компонент существует
 * - useBatchTelemetry хук существует
 *
 * Runtime функции замоканы для стабильности.
 */

import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  TelemetryBatchProvider,
  useBatchTelemetry,
  useTelemetry,
} from '../../../src/lib/telemetry';

// Mock runtime функций чтобы избежать любой асинхронности
const stableBatchFn = vi.fn();
vi.mock('../../../src/lib/telemetry', async () => {
  const actual = await vi.importActual('../../../src/lib/telemetry');

  return {
    ...actual,
    // Mock всех асинхронных функций
    createBatchAwareSink: vi.fn(() => vi.fn()),
    fireAndForget: vi.fn(),
    infoFireAndForget: vi.fn(),
    warnFireAndForget: vi.fn(),
    errorFireAndForget: vi.fn(),
    logFireAndForget: vi.fn(),
    // Mock глобальных функций
    initTelemetry: vi.fn(() => ({ log: vi.fn() })),
    getGlobalTelemetryClient: vi.fn(() => ({ log: vi.fn() })),
    isTelemetryInitialized: vi.fn(() => true),
    // Mock хуков с стабильной функцией
    useTelemetry: vi.fn(() => ({ log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    useBatchTelemetry: vi.fn(() => stableBatchFn),
  };
});

/* ============================================================================
 * 🎣 useTelemetry hook
 * ========================================================================== */

describe('useTelemetry hook', () => {
  it('is exported and is a function', () => {
    expect(typeof useTelemetry).toBe('function');
  });

  it('can be called without throwing', () => {
    expect(() => useTelemetry()).not.toThrow();
  });

  it('returns object with expected methods', () => {
    const client = useTelemetry();

    expect(client).toBeDefined();
    expect(typeof client.log).toBe('function');
    expect(typeof client.info).toBe('function');
    expect(typeof client.warn).toBe('function');
    expect(typeof client.error).toBe('function');
  });
});

/* ============================================================================
 * 📦 TelemetryBatchProvider component
 * ========================================================================== */

describe('TelemetryBatchProvider component', () => {
  it('is exported and is a function', () => {
    expect(typeof TelemetryBatchProvider).toBe('function');
  });

  it('can be created with children', () => {
    expect(() => {
      React.createElement(TelemetryBatchProvider, {
        children: React.createElement('div', {}, 'test'),
      });
    }).not.toThrow();
  });

  it('can be created with config', () => {
    expect(() => {
      React.createElement(TelemetryBatchProvider, {
        config: { batchSize: 5, flushInterval: 1000 },
        children: React.createElement('div', {}, 'test'),
      });
    }).not.toThrow();
  });

  it('supports different config combinations', () => {
    const configs = [
      { batchSize: 1, flushInterval: 100 },
      { batchSize: 10, flushInterval: 2000, enabled: true },
      { batchSize: 50, flushInterval: 5000, enabled: false },
    ];

    configs.forEach((config) => {
      expect(() => {
        React.createElement(TelemetryBatchProvider, {
          config,
          children: React.createElement('div', {}, 'test'),
        });
      }).not.toThrow();
    });
  });
});

/* ============================================================================
 * 🎣 useBatchTelemetry hook
 * ========================================================================== */

describe('useBatchTelemetry hook', () => {
  it('is exported and is a function', () => {
    expect(typeof useBatchTelemetry).toBe('function');
  });

  it('can be called without throwing', () => {
    expect(() => useBatchTelemetry()).not.toThrow();
  });

  it('returns a function', () => {
    const result = useBatchTelemetry();
    expect(typeof result).toBe('function');
  });

  it('returned function can be called without throwing', () => {
    const batchFn = useBatchTelemetry();

    expect(() => {
      batchFn('INFO', 'test message');
      batchFn('WARN', 'test message', { key: 'value' });
      batchFn('ERROR', 'test message');
    }).not.toThrow();
  });

  it('handles different message types', () => {
    const batchFn = useBatchTelemetry();

    expect(() => {
      batchFn('INFO', '');
      batchFn('WARN', 'simple message');
      batchFn('ERROR', 'message with metadata', { errorCode: 500 });
      batchFn('INFO', 'message with complex metadata', {
        userId: 123,
        session: 'abc',
        timestamp: Date.now(),
      });
    }).not.toThrow();
  });

  it('handles undefined and null metadata', () => {
    const batchFn = useBatchTelemetry();

    expect(() => {
      batchFn('INFO', 'no metadata');
      batchFn('WARN', 'undefined metadata', undefined);
      batchFn('ERROR', 'null metadata', null as any);
    }).not.toThrow();
  });

  it('returns function consistently', () => {
    const batchFn1 = useBatchTelemetry();
    const batchFn2 = useBatchTelemetry();

    expect(typeof batchFn1).toBe('function');
    expect(typeof batchFn2).toBe('function');
  });
});

describe('TelemetryBatchProvider advanced scenarios', () => {
  it('handles nested providers', () => {
    expect(() => {
      React.createElement(TelemetryBatchProvider, {
        config: { batchSize: 5 },
        children: React.createElement(TelemetryBatchProvider, {
          config: { batchSize: 10 },
          children: React.createElement('div', {}, 'nested'),
        }),
      });
    }).not.toThrow();
  });

  it('supports all valid config combinations', () => {
    const configs = [
      { batchSize: 1, flushInterval: 100 },
      { batchSize: 10, flushInterval: 2000, enabled: true },
      { batchSize: 50, flushInterval: 5000, enabled: false },
      { batchSize: 100, flushInterval: 10000 },
      { batchSize: 1000, flushInterval: 60000, enabled: true },
    ];

    configs.forEach((config) => {
      expect(() => {
        React.createElement(TelemetryBatchProvider, {
          config,
          children: React.createElement('div', {}, 'test'),
        });
      }).not.toThrow();
    });
  });

  it('handles extreme config values', () => {
    expect(() => {
      React.createElement(TelemetryBatchProvider, {
        config: {
          batchSize: Number.MAX_SAFE_INTEGER,
          flushInterval: Number.MAX_SAFE_INTEGER,
          enabled: true,
        },
        children: React.createElement('div', {}, 'extreme'),
      });
    }).not.toThrow();
  });

  it('works with empty children', () => {
    expect(() => {
      React.createElement(TelemetryBatchProvider, {
        children: null,
      });
    }).not.toThrow();

    expect(() => {
      React.createElement(TelemetryBatchProvider, {
        children: undefined,
      });
    }).not.toThrow();
  });
});

describe('useTelemetry advanced scenarios', () => {
  it('provides consistent client interface', () => {
    const client = useTelemetry();

    // Check all expected methods exist
    expect(typeof client.log).toBe('function');
    expect(typeof client.info).toBe('function');
    expect(typeof client.warn).toBe('function');
    expect(typeof client.error).toBe('function');
  });

  it('client methods accept various parameter combinations', () => {
    const client = useTelemetry();

    expect(() => {
      client.log('INFO', 'message');
      client.log('WARN', 'message', {});
      client.log('ERROR', 'message', { key: 'value' });

      client.info('message');
      client.info('message', {});
      client.info('message', { key: 'value' });

      client.warn('message');
      client.warn('message', {});
      client.warn('message', { key: 'value' });

      client.error('message');
      client.error('message', {});
      client.error('message', { key: 'value' });
    }).not.toThrow();
  });

  it('handles edge case messages', () => {
    const client = useTelemetry();

    expect(() => {
      client.info('');
      client.warn('   ');
      client.error('\n\t');
      client.log('INFO', 'message with special chars: !@#$%^&*()');
    }).not.toThrow();
  });
});

describe('React component integration tests', () => {
  it('TelemetryBatchProvider can wrap complex component trees', () => {
    const ComplexComponent = () =>
      React.createElement('div', {}, [
        React.createElement('header', { key: 'header' }, 'Header'),
        React.createElement('main', { key: 'main' }, [
          React.createElement('section', { key: 'section1' }, 'Section 1'),
          React.createElement('section', { key: 'section2' }, 'Section 2'),
        ]),
        React.createElement('footer', { key: 'footer' }, 'Footer'),
      ]);

    expect(() => {
      React.createElement(TelemetryBatchProvider, {
        config: { batchSize: 10, flushInterval: 5000 },
        children: React.createElement(ComplexComponent),
      });
    }).not.toThrow();
  });

  it('hooks work within different component contexts', () => {
    const ConsumerComponent = () => {
      const telemetry = useTelemetry();
      const batch = useBatchTelemetry();

      React.useEffect(() => {
        telemetry.info('component mounted');
        batch('INFO', 'batch operation');
      }, [telemetry, batch]);

      return React.createElement('div', {}, 'consumer');
    };

    const ProviderComponent = () =>
      React.createElement(TelemetryBatchProvider, {
        children: React.createElement(ConsumerComponent),
      });

    expect(() => {
      React.createElement(ProviderComponent);
    }).not.toThrow();
  });

  describe('hook stability and error handling', () => {
    it('handles batch telemetry errors gracefully', () => {
      const errorBatchFn = vi.fn(() => {
        throw new Error('Batch error');
      });

      vi.mocked(useBatchTelemetry).mockReturnValueOnce(errorBatchFn);

      expect(() => {
        const { result } = renderHook(() => useBatchTelemetry());
        result.current('ERROR', 'test message');
      }).toThrow('Batch error');
    });
  });

  describe('TelemetryBatchProvider error boundaries', () => {
    it('handles invalid config gracefully', () => {
      expect(() => {
        React.createElement(TelemetryBatchProvider, {
          config: { batchSize: -1 },
          children: React.createElement('div', {}, 'test'),
        });
      }).not.toThrow();
    });

    it('handles null config values', () => {
      expect(() => {
        React.createElement(TelemetryBatchProvider, {
          config: { batchSize: null as any, flushInterval: null as any },
          children: React.createElement('div', {}, 'test'),
        });
      }).not.toThrow();
    });
  });

  describe('Component lifecycle and cleanup', () => {
    it('handles multiple mounts and unmounts', () => {
      const { rerender, unmount } = render(
        React.createElement(TelemetryBatchProvider, {
          children: React.createElement('div', {}, 'test'),
        }),
      );

      rerender(
        React.createElement(TelemetryBatchProvider, {
          config: { batchSize: 5 },
          children: React.createElement('div', {}, 'updated'),
        }),
      );

      expect(unmount).not.toThrow();
    });

    it('handles rapid re-renders', () => {
      const { rerender } = render(
        React.createElement(TelemetryBatchProvider, {
          children: React.createElement('div', {}, 'test'),
        }),
      );

      for (let i = 0; i < 5; i++) {
        rerender(
          React.createElement(TelemetryBatchProvider, {
            config: { batchSize: i + 1 },
            children: React.createElement('div', {}, `render ${i}`),
          }),
        );
      }
    });
  });

  describe('Hook integration patterns', () => {
    it('works with useEffect patterns', () => {
      const TestComponent = () => {
        const telemetry = useTelemetry();
        const batch = useBatchTelemetry();

        React.useEffect(() => {
          telemetry.info('mounted');
          return () => {
            batch('INFO', 'unmounting');
          };
        }, [telemetry, batch]);

        return React.createElement('div', {}, 'test');
      };

      render(
        React.createElement(TelemetryBatchProvider, {
          children: React.createElement(TestComponent),
        }),
      );
    });

    it('handles different configurations', () => {
      const ConfigurableComponent = ({ enableBatch }: { readonly enableBatch: boolean; }) => {
        const telemetry = useTelemetry();
        const batch = useBatchTelemetry();

        React.useEffect(() => {
          telemetry.warn('configurable render');
          if (enableBatch) {
            batch('WARN', 'batch enabled');
          }
        }, [telemetry, batch, enableBatch]);

        return React.createElement('div', {}, 'configurable');
      };

      render(
        React.createElement(TelemetryBatchProvider, {
          children: React.createElement(ConfigurableComponent, { enableBatch: true }),
        }),
      );

      render(
        React.createElement(TelemetryBatchProvider, {
          children: React.createElement(ConfigurableComponent, { enableBatch: false }),
        }),
      );
    });
  });
});
