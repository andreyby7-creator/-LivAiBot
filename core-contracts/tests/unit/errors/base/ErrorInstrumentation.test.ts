import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from 'effect';

import {
  InstrumentationSystemTag,
  logError,
  makeConsoleInstrumentation,
  makeDisabledInstrumentation,
  makeFallbackInstrumentation,
  makeOpenTelemetryInstrumentation,
  makeWinstonInstrumentation,
  mapErrorToSeverity,
  sendTelemetry,
} from '../../../../src/errors/base/ErrorInstrumentation';
import type {
  InstrumentationEffect,
  InstrumentationSystem,
  TelemetryEvent,
} from '../../../../src/errors/base/ErrorInstrumentation';

describe('ErrorInstrumentation', () => {
  describe('Типы и константы', () => {
    describe('TelemetryEvent', () => {
      it('должен поддерживать все типы telemetry событий', () => {
        const errorOccurred: TelemetryEvent = {
          _tag: 'error_occurred',
          errorName: 'TestError',
        };

        const errorHandled: TelemetryEvent = {
          _tag: 'error_handled',
          strategy: 'retry',
        };

        const errorEscalated: TelemetryEvent = {
          _tag: 'error_escalated',
          severity: 'critical',
        };

        expect(errorOccurred._tag).toBe('error_occurred');
        expect(errorHandled._tag).toBe('error_handled');
        expect(errorEscalated._tag).toBe('error_escalated');
      });

      it('должен быть type-safe для discriminated union', () => {
        const events: TelemetryEvent[] = [
          { _tag: 'error_occurred', errorName: 'Error1' },
          { _tag: 'error_handled', strategy: 'fallback' },
          { _tag: 'error_escalated', severity: 'high' },
        ];

        events.forEach((event) => {
          expect(event).toHaveProperty('_tag');
        });
      });
    });

    describe('InstrumentationSystemTag', () => {
      it('должен быть корректным Context Tag', () => {
        expect(InstrumentationSystemTag.key).toBe('InstrumentationSystem');
        expect(typeof InstrumentationSystemTag).toBe('function');
      });

      it('должен создавать тестовую систему instrumentation', async () => {
        const mockSystem: InstrumentationSystem = {
          logError: () => Effect.void,
          sendTelemetry: () => Effect.void,
          mapErrorToSeverity: () => 'low',
        };

        const effect = Effect.provideService(InstrumentationSystemTag, mockSystem)(
          Effect.succeed('test'),
        );

        const result = await Effect.runPromise(effect);
        expect(result).toBe('test');
      });
    });

    describe('InstrumentationEffect', () => {
      it('должен быть type alias для Effect с InstrumentationSystemTag', () => {
        // Type test - просто проверяем, что тип компилируется
        const effect: InstrumentationEffect<string> = Effect.succeed('test');
        expect(typeof effect).toBe('object');
      });
    });
  });

  describe('Helper функции', () => {
    const mockInstrumentation: InstrumentationSystem = {
      logError: vi.fn().mockReturnValue(Effect.void),
      sendTelemetry: vi.fn().mockReturnValue(Effect.void),
      mapErrorToSeverity: vi.fn().mockReturnValue('low'),
    };

    describe('logError', () => {
      it('должен логировать ошибку с контекстом', async () => {
        const effect = Effect.provideService(InstrumentationSystemTag, mockInstrumentation)(
          logError(new Error('Test error'), { userId: 123 }),
        );

        await Effect.runPromise(effect);

        expect(mockInstrumentation.logError).toHaveBeenCalledWith(
          new Error('Test error'),
          { userId: 123 },
        );
      });

      it('должен логировать ошибку без контекста', async () => {
        const effect = Effect.provideService(InstrumentationSystemTag, mockInstrumentation)(
          logError('String error'),
        );

        await Effect.runPromise(effect);

        expect(mockInstrumentation.logError).toHaveBeenCalledWith(
          'String error',
          undefined,
        );
      });
    });

    describe('sendTelemetry', () => {
      it('должен отправлять telemetry событие с properties', async () => {
        const event: TelemetryEvent = { _tag: 'error_occurred', errorName: 'TestError' };

        const effect = Effect.provideService(InstrumentationSystemTag, mockInstrumentation)(
          sendTelemetry(event, { severity: 'high', count: 5 }),
        );

        await Effect.runPromise(effect);

        expect(mockInstrumentation.sendTelemetry).toHaveBeenCalledWith(
          event,
          { severity: 'high', count: 5 },
        );
      });

      it('должен отправлять telemetry событие без properties', async () => {
        const event: TelemetryEvent = { _tag: 'error_handled', strategy: 'retry' };

        const effect = Effect.provideService(InstrumentationSystemTag, mockInstrumentation)(
          sendTelemetry(event),
        );

        await Effect.runPromise(effect);

        expect(mockInstrumentation.sendTelemetry).toHaveBeenCalledWith(
          event,
          undefined,
        );
      });
    });

    describe('mapErrorToSeverity', () => {
      it('должен маппить ошибку к severity', async () => {
        const mockSystem: InstrumentationSystem = {
          ...mockInstrumentation,
          mapErrorToSeverity: vi.fn().mockReturnValue('critical'),
        };

        const effect = Effect.provideService(InstrumentationSystemTag, mockSystem)(
          mapErrorToSeverity(new Error('Critical database error')),
        );

        const result = await Effect.runPromise(effect);

        expect(mockSystem.mapErrorToSeverity).toHaveBeenCalledWith(
          new Error('Critical database error'),
        );
        expect(result).toBe('critical');
      });
    });
  });

  describe('Strategy реализации', () => {
    describe('makeConsoleInstrumentation', () => {
      let instrumentation: InstrumentationSystem;

      beforeEach(async () => {
        instrumentation = await Effect.runPromise(makeConsoleInstrumentation);
      });

      describe('logError', () => {
        it('должен логировать ошибку в console.error', async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          await Effect.runPromise(instrumentation.logError(new Error('Test error')));

          expect(consoleSpy).toHaveBeenCalledWith(
            '🚨 ERROR LOG:',
            new Error('Test error'),
            undefined,
          );

          consoleSpy.mockRestore();
        });

        it('должен логировать ошибку с контекстом', async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          await Effect.runPromise(
            instrumentation.logError('String error', { userId: 123, action: 'login' }),
          );

          expect(consoleSpy).toHaveBeenCalledWith(
            '🚨 ERROR LOG:',
            'String error',
            { userId: 123, action: 'login' },
          );

          consoleSpy.mockRestore();
        });
      });

      describe('sendTelemetry', () => {
        it('должен отправлять telemetry в console.info', async () => {
          const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

          const event: TelemetryEvent = { _tag: 'error_occurred', errorName: 'TestError' };

          await Effect.runPromise(instrumentation.sendTelemetry(event));

          expect(consoleSpy).toHaveBeenCalledWith(
            '📡 TELEMETRY:',
            event,
            undefined,
          );

          consoleSpy.mockRestore();
        });

        it('должен отправлять telemetry с properties', async () => {
          const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

          const event: TelemetryEvent = { _tag: 'error_handled', strategy: 'fallback' };
          const properties = { duration: 150, retries: 2 };

          await Effect.runPromise(instrumentation.sendTelemetry(event, properties));

          expect(consoleSpy).toHaveBeenCalledWith(
            '📡 TELEMETRY:',
            event,
            properties,
          );

          consoleSpy.mockRestore();
        });
      });

      describe('mapErrorToSeverity', () => {
        it('должен возвращать critical для ошибок с critical/fatal в сообщении', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Critical system failure'))).toBe(
            'critical',
          );
          expect(instrumentation.mapErrorToSeverity(new Error('Fatal database error'))).toBe(
            'critical',
          );
        });

        it('должен возвращать high для ошибок с high/severe в сообщении', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('High priority alert'))).toBe('high');
          expect(instrumentation.mapErrorToSeverity(new Error('Severe network issue'))).toBe(
            'high',
          );
        });

        it('должен возвращать medium для ошибок с medium/warning в сообщении', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Medium risk warning'))).toBe(
            'medium',
          );
          expect(instrumentation.mapErrorToSeverity(new Error('Warning: deprecated API'))).toBe(
            'medium',
          );
        });

        it('должен возвращать low для остальных ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Minor issue'))).toBe('low');
          expect(instrumentation.mapErrorToSeverity(new Error('Unknown error type'))).toBe('low');
          expect(instrumentation.mapErrorToSeverity('String error')).toBe('low');
          expect(instrumentation.mapErrorToSeverity(null)).toBe('low');
          expect(instrumentation.mapErrorToSeverity(undefined)).toBe('low');
        });

        it('должен игнорировать регистр в сообщении ошибки', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('CRITICAL SYSTEM ERROR'))).toBe(
            'critical',
          );
          expect(instrumentation.mapErrorToSeverity(new Error('High Priority Issue'))).toBe('high');
        });
      });
    });

    describe('makeDisabledInstrumentation', () => {
      let instrumentation: InstrumentationSystem;

      beforeEach(async () => {
        instrumentation = await Effect.runPromise(makeDisabledInstrumentation);
      });

      it('logError должен быть no-op', async () => {
        const result = await Effect.runPromise(instrumentation.logError(new Error('Test')));
        expect(result).toBeUndefined();
      });

      it('sendTelemetry должен быть no-op', async () => {
        const event: TelemetryEvent = { _tag: 'error_occurred', errorName: 'Test' };
        const result = await Effect.runPromise(instrumentation.sendTelemetry(event));
        expect(result).toBeUndefined();
      });

      it('mapErrorToSeverity должен всегда возвращать low', () => {
        expect(instrumentation.mapErrorToSeverity(new Error('Critical error'))).toBe('low');
        expect(instrumentation.mapErrorToSeverity('Any error')).toBe('low');
        expect(instrumentation.mapErrorToSeverity(null)).toBe('low');
      });
    });

    describe('makeWinstonInstrumentation', () => {
      let instrumentation: InstrumentationSystem;

      beforeEach(async () => {
        instrumentation = await Effect.runPromise(makeWinstonInstrumentation);
      });

      describe('logError', () => {
        it('должен логировать через Winston (console для тестов)', async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          await Effect.runPromise(instrumentation.logError(new Error('Winston test')));

          expect(consoleSpy).toHaveBeenCalledWith(
            '📝 WINSTON LOG:',
            new Error('Winston test'),
            undefined,
          );

          consoleSpy.mockRestore();
        });
      });

      describe('sendTelemetry', () => {
        it('должен отправлять telemetry через Winston (console для тестов)', async () => {
          const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

          const event: TelemetryEvent = { _tag: 'error_handled', strategy: 'retry' };

          await Effect.runPromise(instrumentation.sendTelemetry(event));

          expect(consoleSpy).toHaveBeenCalledWith(
            '📊 WINSTON TELEMETRY:',
            event,
            undefined,
          );

          consoleSpy.mockRestore();
        });
      });

      describe('mapErrorToSeverity', () => {
        it('должен возвращать critical для database/connection ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Database connection failed'))).toBe(
            'critical',
          );
          expect(instrumentation.mapErrorToSeverity(new Error('Connection timeout'))).toBe(
            'critical',
          );
        });

        it('должен возвращать high для validation/auth ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Validation failed'))).toBe('high');
          expect(instrumentation.mapErrorToSeverity(new Error('Authentication error'))).toBe(
            'high',
          );
        });

        it('должен возвращать medium для timeout/retry ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Request timeout'))).toBe('medium');
          expect(instrumentation.mapErrorToSeverity(new Error('Retry limit exceeded'))).toBe(
            'medium',
          );
        });

        it('должен возвращать low для остальных ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Unknown error'))).toBe('low');
          expect(instrumentation.mapErrorToSeverity('String error')).toBe('low');
        });
      });
    });

    describe('makeOpenTelemetryInstrumentation', () => {
      let instrumentation: InstrumentationSystem;

      beforeEach(async () => {
        instrumentation = await Effect.runPromise(makeOpenTelemetryInstrumentation);
      });

      describe('logError', () => {
        it('должен логировать через OpenTelemetry (console для тестов)', async () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          await Effect.runPromise(instrumentation.logError(new Error('OTel test')));

          expect(consoleSpy).toHaveBeenCalledWith(
            '🔍 OTEL LOG:',
            new Error('OTel test'),
            undefined,
          );

          consoleSpy.mockRestore();
        });
      });

      describe('sendTelemetry', () => {
        it('должен отправлять telemetry через OpenTelemetry (console для тестов)', async () => {
          const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

          const event: TelemetryEvent = { _tag: 'error_escalated', severity: 'high' };

          await Effect.runPromise(instrumentation.sendTelemetry(event));

          expect(consoleSpy).toHaveBeenCalledWith(
            '📈 OTEL TELEMETRY:',
            event,
            undefined,
          );

          consoleSpy.mockRestore();
        });
      });

      describe('mapErrorToSeverity', () => {
        it('должен возвращать critical для panic/unrecoverable ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('System panic'))).toBe('critical');
          expect(instrumentation.mapErrorToSeverity(new Error('Unrecoverable state'))).toBe(
            'critical',
          );
        });

        it('должен возвращать high для error/exception ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Runtime error occurred'))).toBe(
            'high',
          );
          expect(instrumentation.mapErrorToSeverity(new Error('Exception thrown'))).toBe('high');
        });

        it('должен возвращать medium для warn/degraded ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Warning condition'))).toBe('medium');
          expect(instrumentation.mapErrorToSeverity(new Error('Service degraded'))).toBe('medium');
        });

        it('должен возвращать low для остальных ошибок', () => {
          expect(instrumentation.mapErrorToSeverity(new Error('Info message'))).toBe('low');
          expect(instrumentation.mapErrorToSeverity('String error')).toBe('low');
        });
      });
    });

    describe('makeFallbackInstrumentation', () => {
      it('должен быть алиасом для makeConsoleInstrumentation', async () => {
        const consoleInstrumentation = await Effect.runPromise(makeConsoleInstrumentation);
        const fallbackInstrumentation = await Effect.runPromise(makeFallbackInstrumentation);

        expect(fallbackInstrumentation.logError).toBe(consoleInstrumentation.logError);
        expect(fallbackInstrumentation.sendTelemetry).toBe(consoleInstrumentation.sendTelemetry);
        expect(fallbackInstrumentation.mapErrorToSeverity).toBe(
          consoleInstrumentation.mapErrorToSeverity,
        );
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен поддерживать полный цикл instrumentation', async () => {
      const instrumentation = await Effect.runPromise(makeConsoleInstrumentation);

      // Создаем эффект, который использует все методы instrumentation
      const fullCycleEffect = Effect.gen(function*() {
        // Логируем ошибку
        yield* instrumentation.logError(new Error('Integration test error'), {
          testId: 'full-cycle',
        });

        // Отправляем telemetry
        yield* instrumentation.sendTelemetry(
          { _tag: 'error_occurred', errorName: 'IntegrationTestError' },
          { severity: 'medium', source: 'test' },
        );

        // Маппим ошибку к severity
        const severity = instrumentation.mapErrorToSeverity(
          new Error('Critical integration failure'),
        );

        return severity;
      });

      const result = await Effect.runPromise(fullCycleEffect);
      expect(result).toBe('critical');
    });

    it('должен работать с Effect Context injection', async () => {
      const instrumentation = await Effect.runPromise(makeConsoleInstrumentation);

      // Создаем эффект, который получает instrumentation из контекста
      const contextEffect = Effect.gen(function*() {
        yield* logError(new Error('Context injection test'));
        yield* sendTelemetry({ _tag: 'error_handled', strategy: 'test' });
        const severity = yield* mapErrorToSeverity(new Error('Context severity test'));

        return severity;
      });

      // Предоставляем instrumentation через context
      const result = await Effect.runPromise(
        Effect.provideService(InstrumentationSystemTag, instrumentation)(contextEffect),
      );

      expect(result).toBe('low');
    });
  });

  describe('Edge cases и error handling', () => {
    it('должен корректно обрабатывать null и undefined ошибки', async () => {
      const instrumentation = await Effect.runPromise(makeConsoleInstrumentation);

      expect(instrumentation.mapErrorToSeverity(null)).toBe('low');
      expect(instrumentation.mapErrorToSeverity(undefined)).toBe('low');
    });

    it('должен корректно обрабатывать не-Error объекты', async () => {
      const instrumentation = await Effect.runPromise(makeConsoleInstrumentation);

      expect(instrumentation.mapErrorToSeverity(42)).toBe('low');
      expect(instrumentation.mapErrorToSeverity({ message: 'Object error' })).toBe('low');
      expect(instrumentation.mapErrorToSeverity([1, 2, 3])).toBe('low');
    });

    it('должен корректно обрабатывать пустые сообщения ошибок', async () => {
      const instrumentation = await Effect.runPromise(makeConsoleInstrumentation);

      expect(instrumentation.mapErrorToSeverity(new Error(''))).toBe('low');
    });

    it('disabled instrumentation должен быть полностью безопасным', async () => {
      const instrumentation = await Effect.runPromise(makeDisabledInstrumentation);

      // Все методы должны выполняться без ошибок
      await expect(Effect.runPromise(instrumentation.logError(null))).resolves.toBeUndefined();
      await expect(Effect.runPromise(instrumentation.sendTelemetry({
        _tag: 'error_occurred',
        errorName: 'Test',
      }))).resolves.toBeUndefined();
      expect(instrumentation.mapErrorToSeverity(new Error('Any error'))).toBe('low');
    });
  });
});
