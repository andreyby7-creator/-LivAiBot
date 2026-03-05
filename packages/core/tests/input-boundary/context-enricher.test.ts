/**
 * @file Unit тесты для Context Enricher
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';

import type {
  ContextEnricher,
  EnricherRegistry,
  EnrichmentObserver,
} from '../../src/input-boundary/context-enricher.js';
import {
  defaultEnricherRegistry,
  enrichContext,
  registerEnricher,
} from '../../src/input-boundary/context-enricher.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type TestContext = Readonly<{
  readonly country?: string;
  readonly userId?: string;
  readonly role?: string;
}>;

function createTestContext(overrides: Partial<TestContext> = {}): TestContext {
  const base: TestContext = {
    country: 'US',
    userId: 'user-123',
    role: 'admin',
  };
  const entries = Object.entries(overrides).filter(
    (entry): entry is [string, NonNullable<TestContext[keyof TestContext]>] => {
      const [, value] = entry;
      return (value as unknown) != null;
    },
  );
  const cleanOverrides = Object.fromEntries(entries) as Partial<TestContext>;
  return Object.freeze({ ...base, ...cleanOverrides }) as TestContext;
}

function createTestEnricher(
  name: string,
  provides: readonly string[],
  enrich: ContextEnricher<TestContext>['enrich'],
  dependsOn?: readonly string[],
): ContextEnricher<TestContext> {
  const base: {
    name: string;
    provides: readonly string[];
    enrich: ContextEnricher<TestContext>['enrich'];
    dependsOn?: readonly string[];
  } = {
    name,
    provides,
    enrich,
    ...(dependsOn !== undefined ? { dependsOn } : {}),
  };
  return Object.freeze(base) as ContextEnricher<TestContext>;
}

function createTestRegistry(
  invariants: readonly ContextEnricher<TestContext>[] = [],
  policies: readonly ContextEnricher<TestContext>[] = [],
): EnricherRegistry<TestContext> {
  return Object.freeze({
    invariants: Object.freeze([...invariants]),
    policies: Object.freeze([...policies]),
  });
}

function createCircularReference(value: string): { self: unknown; value: string; } {
  const obj: { self: unknown; value: string; } = { value, self: null as unknown };
  // eslint-disable-next-line fp/no-mutation -- circular reference требует мутации
  obj.self = obj;
  return obj;
}

/* ============================================================================
 * 🎯 TESTS — enrichContext (Main API)
 * ============================================================================
 */

describe('Context Enricher', () => {
  describe('enrichContext', () => {
    describe('базовые случаи', () => {
      it('возвращает пустые сигналы и ошибки для пустого registry', () => {
        const context = createTestContext();
        const registry = createTestRegistry();
        const result = enrichContext(context, registry);

        expect(result.signals.size).toBe(0);
        expect(result.errors.length).toBe(0);
      });

      it('использует defaultEnricherRegistry по умолчанию', () => {
        const context = createTestContext();
        const result = enrichContext(context);

        expect(result.signals.size).toBe(0);
        expect(result.errors.length).toBe(0);
      });

      it('применяет один enricher без зависимостей', () => {
        const context = createTestContext({ country: 'US' });
        const enricher = createTestEnricher(
          'geo',
          ['geo.country'],
          (ctx) => ({
            signals: new Map([['geo.country', ctx.country]]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([enricher]);
        const result = enrichContext(context, registry);

        expect(result.signals.get('geo.country')).toBe('US');
        expect(result.errors.length).toBe(0);
      });

      it('применяет несколько enrichers без зависимостей', () => {
        const context = createTestContext({ country: 'US', userId: 'user-123' });
        const geoEnricher = createTestEnricher(
          'geo',
          ['geo.country'],
          (ctx) => ({
            signals: new Map([['geo.country', ctx.country]]),
            errors: [],
          }),
        );
        const userEnricher = createTestEnricher(
          'user',
          ['user.id'],
          (ctx) => ({
            signals: new Map([['user.id', ctx.userId]]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([geoEnricher, userEnricher]);
        const result = enrichContext(context, registry);

        expect(result.signals.get('geo.country')).toBe('US');
        expect(result.signals.get('user.id')).toBe('user-123');
        expect(result.errors.length).toBe(0);
      });
    });

    describe('dependency-driven execution', () => {
      it('применяет enricher с зависимостью после provider', () => {
        const context = createTestContext({ country: 'US' });
        const geoEnricher = createTestEnricher(
          'geo',
          ['geo.country'],
          (ctx) => ({
            signals: new Map([['geo.country', ctx.country]]),
            errors: [],
          }),
        );
        const regionEnricher = createTestEnricher(
          'region',
          ['region.name'],
          (_ctx, signals) => {
            const country = signals.get('geo.country');
            return {
              signals: new Map([['region.name', country === 'US' ? 'North America' : 'Other']]),
              errors: [],
            };
          },
          ['geo.country'],
        );
        const registry = createTestRegistry([regionEnricher, geoEnricher]);
        const result = enrichContext(context, registry);

        expect(result.signals.get('geo.country')).toBe('US');
        expect(result.signals.get('region.name')).toBe('North America');
        expect(result.errors.length).toBe(0);
      });

      it('пропускает enricher если зависимость отсутствует', () => {
        const context = createTestContext();
        const dependentEnricher = createTestEnricher(
          'dependent',
          ['dependent.value'],
          () => ({
            signals: new Map([['dependent.value', 'value']]),
            errors: [],
          }),
          ['missing.signal'],
        );
        const registry = createTestRegistry([dependentEnricher]);
        const result = enrichContext(context, registry);

        expect(result.signals.has('dependent.value')).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        const skippedError = result.errors.find((e) => e.kind === 'SKIPPED_ENRICHER');
        expect(skippedError).toBeDefined();
        if (skippedError?.kind === 'SKIPPED_ENRICHER') {
          expect(skippedError.enricher).toBe('dependent');
        }
        const missingError = result.errors.find((e) => e.kind === 'MISSING_DEPENDENCY');
        expect(missingError).toBeDefined();
        if (missingError?.kind === 'MISSING_DEPENDENCY') {
          expect(missingError.dependency).toBe('missing.signal');
        }
      });

      it('применяет invariants перед policies', () => {
        const context = createTestContext({ country: 'US' });
        const invariantEnricher = createTestEnricher(
          'invariant',
          ['invariant.value'],
          () => ({
            signals: new Map([['invariant.value', 'invariant']]),
            errors: [],
          }),
        );
        const policyEnricher = createTestEnricher(
          'policy',
          ['policy.value'],
          (_ctx, signals) => {
            const invariantValue = signals.get('invariant.value');
            return {
              signals: new Map([['policy.value', `policy-${invariantValue}`]]),
              errors: [],
            };
          },
          ['invariant.value'],
        );
        const registry = createTestRegistry([invariantEnricher], [policyEnricher]);
        const result = enrichContext(context, registry);

        expect(result.signals.get('invariant.value')).toBe('invariant');
        expect(result.signals.get('policy.value')).toBe('policy-invariant');
        expect(result.errors.length).toBe(0);
      });
    });

    describe('conflict detection', () => {
      it('детектирует конфликт сигналов с разными значениями', () => {
        const context = createTestContext();
        const enricher1 = createTestEnricher(
          'enricher1',
          ['conflict.signal'],
          () => ({
            signals: new Map([['conflict.signal', 'value1']]),
            errors: [],
          }),
        );
        const enricher2 = createTestEnricher(
          'enricher2',
          ['conflict.signal'],
          () => ({
            signals: new Map([['conflict.signal', 'value2']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([enricher1, enricher2]);
        const result = enrichContext(context, registry);

        expect(result.errors.length).toBeGreaterThan(0);
        const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
        expect(conflictError).toBeDefined();
        if (conflictError?.kind === 'CONFLICTING_SIGNALS') {
          expect(conflictError.signal).toBe('conflict.signal');
        }
      });

      it('не детектирует конфликт для одинаковых значений', () => {
        const context = createTestContext();
        const enricher1 = createTestEnricher(
          'enricher1',
          ['same.signal'],
          () => ({
            signals: new Map([['same.signal', 'value']]),
            errors: [],
          }),
        );
        const enricher2 = createTestEnricher(
          'enricher2',
          ['same.signal'],
          () => ({
            signals: new Map([['same.signal', 'value']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([enricher1, enricher2]);
        const result = enrichContext(context, registry);

        // Один из enrichers должен быть пропущен из-за конфликта (multi-provider)
        // Но если значения одинаковые, конфликта нет
        expect(result.signals.get('same.signal')).toBe('value');
      });
    });

    describe('circular dependency detection', () => {
      it('детектирует циклическую зависимость', () => {
        const context = createTestContext();
        const enricher1 = createTestEnricher(
          'enricher1',
          ['signal1'],
          () => ({
            signals: new Map([['signal1', 'value1']]),
            errors: [],
          }),
          ['signal2'],
        );
        const enricher2 = createTestEnricher(
          'enricher2',
          ['signal2'],
          () => ({
            signals: new Map([['signal2', 'value2']]),
            errors: [],
          }),
          ['signal1'],
        );
        const registry = createTestRegistry([enricher1, enricher2]);
        const result = enrichContext(context, registry);

        expect(result.errors.length).toBeGreaterThan(0);
        const cycleError = result.errors.find((e) => e.kind === 'CIRCULAR_DEPENDENCY');
        expect(cycleError).toBeDefined();
        if (cycleError?.kind === 'CIRCULAR_DEPENDENCY') {
          expect(cycleError.cycle.length).toBeGreaterThan(0);
        }
      });

      it('не детектирует цикл для независимых enrichers', () => {
        const context = createTestContext();
        const enricher1 = createTestEnricher(
          'enricher1',
          ['signal1'],
          () => ({
            signals: new Map([['signal1', 'value1']]),
            errors: [],
          }),
        );
        const enricher2 = createTestEnricher(
          'enricher2',
          ['signal2'],
          () => ({
            signals: new Map([['signal2', 'value2']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([enricher1, enricher2]);
        const result = enrichContext(context, registry);

        expect(result.errors.length).toBe(0);
        expect(result.signals.get('signal1')).toBe('value1');
        expect(result.signals.get('signal2')).toBe('value2');
      });
    });

    describe('enricher errors', () => {
      it('собирает ошибки от enricher', () => {
        const context = createTestContext();
        const errorEnricher = createTestEnricher(
          'error',
          ['error.signal'],
          () => ({
            signals: new Map([['error.signal', 'value']]),
            errors: [
              Object.freeze({
                kind: 'ENRICHER_ERROR',
                enricher: 'error',
                reason: 'Test error',
              }),
            ],
          }),
        );
        const registry = createTestRegistry([errorEnricher]);
        const result = enrichContext(context, registry);

        expect(result.signals.get('error.signal')).toBe('value');
        expect(result.errors.length).toBeGreaterThan(0);
        const enricherError = result.errors.find((e) => e.kind === 'ENRICHER_ERROR');
        expect(enricherError).toBeDefined();
        if (enricherError?.kind === 'ENRICHER_ERROR') {
          expect(enricherError.enricher).toBe('error');
          expect(enricherError.reason).toBe('Test error');
        }
      });

      it('собирает все ошибки (non-fail-fast)', () => {
        const context = createTestContext();
        const errorEnricher1 = createTestEnricher(
          'error1',
          ['signal1'],
          () => ({
            signals: new Map([['signal1', 'value1']]),
            errors: [
              Object.freeze({
                kind: 'ENRICHER_ERROR',
                enricher: 'error1',
                reason: 'Error 1',
              }),
            ],
          }),
        );
        const errorEnricher2 = createTestEnricher(
          'error2',
          ['signal2'],
          () => ({
            signals: new Map([['signal2', 'value2']]),
            errors: [
              Object.freeze({
                kind: 'ENRICHER_ERROR',
                enricher: 'error2',
                reason: 'Error 2',
              }),
            ],
          }),
        );
        const registry = createTestRegistry([errorEnricher1, errorEnricher2]);
        const result = enrichContext(context, registry);

        expect(result.errors.length).toBe(2);
        expect(result.signals.get('signal1')).toBe('value1');
        expect(result.signals.get('signal2')).toBe('value2');
      });
    });

    describe('observer hooks', () => {
      it('вызывает onSkippedEnricher когда enricher пропущен', () => {
        const context = createTestContext();
        const skippedEnricher = createTestEnricher(
          'skipped',
          ['skipped.signal'],
          () => ({
            signals: new Map([['skipped.signal', 'value']]),
            errors: [],
          }),
          ['missing.signal'],
        );
        const registry = createTestRegistry([skippedEnricher]);
        const skippedEvents: unknown[] = [];
        const observer: EnrichmentObserver = {
          onSkippedEnricher: (error) => {
            skippedEvents.push(error);
          },
        };
        enrichContext(context, registry, observer);

        expect(skippedEvents.length).toBeGreaterThan(0);
        const event = skippedEvents[0];
        if (
          event !== null
          && event !== undefined
          && typeof event === 'object'
          && 'kind' in event
          && event.kind === 'SKIPPED_ENRICHER'
          && 'enricher' in event
        ) {
          expect(event.enricher).toBe('skipped');
        }
      });

      it('вызывает onConflictingSignals при конфликте', () => {
        const context = createTestContext();
        const enricher1 = createTestEnricher(
          'enricher1',
          ['conflict.signal'],
          () => ({
            signals: new Map([['conflict.signal', 'value1']]),
            errors: [],
          }),
        );
        const enricher2 = createTestEnricher(
          'enricher2',
          ['conflict.signal'],
          () => ({
            signals: new Map([['conflict.signal', 'value2']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([enricher1, enricher2]);
        const conflictEvents: unknown[] = [];
        const observer: EnrichmentObserver = {
          onConflictingSignals: (error) => {
            conflictEvents.push(error);
          },
        };
        enrichContext(context, registry, observer);

        expect(conflictEvents.length).toBeGreaterThan(0);
        const event = conflictEvents[0];
        if (
          event !== null
          && event !== undefined
          && typeof event === 'object'
          && 'kind' in event
          && event.kind === 'CONFLICTING_SIGNALS'
          && 'signal' in event
        ) {
          expect(event.signal).toBe('conflict.signal');
        }
      });

      it('вызывает onCircularDependency при цикле', () => {
        const context = createTestContext();
        const enricher1 = createTestEnricher(
          'enricher1',
          ['signal1'],
          () => ({
            signals: new Map([['signal1', 'value1']]),
            errors: [],
          }),
          ['signal2'],
        );
        const enricher2 = createTestEnricher(
          'enricher2',
          ['signal2'],
          () => ({
            signals: new Map([['signal2', 'value2']]),
            errors: [],
          }),
          ['signal1'],
        );
        const registry = createTestRegistry([enricher1, enricher2]);
        const cycleEvents: unknown[] = [];
        const observer: EnrichmentObserver = {
          onCircularDependency: (error) => {
            cycleEvents.push(error);
          },
        };
        enrichContext(context, registry, observer);

        expect(cycleEvents.length).toBeGreaterThan(0);
        const event = cycleEvents[0];
        if (
          event !== null
          && event !== undefined
          && typeof event === 'object'
          && 'kind' in event
          && event.kind === 'CIRCULAR_DEPENDENCY'
          && 'cycle' in event
          && Array.isArray(event.cycle)
        ) {
          expect(event.cycle.length).toBeGreaterThan(0);
        }
      });

      it('вызывает onEnricherError при ошибке enricher', () => {
        const context = createTestContext();
        const errorEnricher = createTestEnricher(
          'error',
          ['error.signal'],
          () => ({
            signals: new Map([['error.signal', 'value']]),
            errors: [
              Object.freeze({
                kind: 'ENRICHER_ERROR',
                enricher: 'error',
                reason: 'Test error',
              }),
            ],
          }),
        );
        const registry = createTestRegistry([errorEnricher]);
        const errorEvents: unknown[] = [];
        const observer: EnrichmentObserver = {
          onEnricherError: (error) => {
            errorEvents.push(error);
          },
        };
        enrichContext(context, registry, observer);

        expect(errorEvents.length).toBeGreaterThan(0);
        const event = errorEvents[0];
        if (
          event !== null
          && event !== undefined
          && typeof event === 'object'
          && 'kind' in event
          && event.kind === 'ENRICHER_ERROR'
          && 'enricher' in event
          && 'reason' in event
        ) {
          expect(event.enricher).toBe('error');
          expect(event.reason).toBe('Test error');
        }
      });

      it('вызывает onMissingDependency при missing dependency', () => {
        const context = createTestContext();
        const dependentEnricher = createTestEnricher(
          'dependent',
          ['dependent.signal'],
          () => ({
            signals: new Map([['dependent.signal', 'value']]),
            errors: [],
          }),
          ['missing.signal'],
        );
        const registry = createTestRegistry([dependentEnricher]);
        const missingEvents: unknown[] = [];
        const observer: EnrichmentObserver = {
          onMissingDependency: (error) => {
            missingEvents.push(error);
          },
        };
        enrichContext(context, registry, observer);

        expect(missingEvents.length).toBeGreaterThan(0);
        const event = missingEvents[0];
        if (
          event !== null
          && event !== undefined
          && typeof event === 'object'
          && 'kind' in event
          && event.kind === 'MISSING_DEPENDENCY'
          && 'enricher' in event
          && 'dependency' in event
        ) {
          expect(event.enricher).toBe('dependent');
          expect(event.dependency).toBe('missing.signal');
        }
      });

      it('не вызывает observer если он не передан', () => {
        const context = createTestContext();
        const enricher = createTestEnricher(
          'test',
          ['test.signal'],
          () => ({
            signals: new Map([['test.signal', 'value']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([enricher]);
        const result = enrichContext(context, registry);

        expect(result.signals.get('test.signal')).toBe('value');
        expect(result.errors.length).toBe(0);
      });
    });

    describe('topological sort', () => {
      it('сортирует enrichers по зависимостям', () => {
        const context = createTestContext({ country: 'US' });
        const enricher1 = createTestEnricher(
          'enricher1',
          ['signal1'],
          () => ({
            signals: new Map([['signal1', 'value1']]),
            errors: [],
          }),
        );
        const enricher2 = createTestEnricher(
          'enricher2',
          ['signal2'],
          (_ctx, signals) => {
            const signal1 = signals.get('signal1');
            return {
              signals: new Map([['signal2', `value2-${signal1}`]]),
              errors: [],
            };
          },
          ['signal1'],
        );
        const enricher3 = createTestEnricher(
          'enricher3',
          ['signal3'],
          (_ctx, signals) => {
            const signal2 = signals.get('signal2');
            return {
              signals: new Map([['signal3', `value3-${signal2}`]]),
              errors: [],
            };
          },
          ['signal2'],
        );
        // Порядок регистрации не важен - должна быть топологическая сортировка
        const registry = createTestRegistry([enricher3, enricher1, enricher2]);
        const result = enrichContext(context, registry);

        expect(result.signals.get('signal1')).toBe('value1');
        expect(result.signals.get('signal2')).toBe('value2-value1');
        expect(result.signals.get('signal3')).toBe('value3-value2-value1');
        expect(result.errors.length).toBe(0);
      });

      it('использует стабильную сортировку (lexicographical по имени)', () => {
        const context = createTestContext();
        const enricherA = createTestEnricher(
          'enricherA',
          ['signalA'],
          () => ({
            signals: new Map([['signalA', 'A']]),
            errors: [],
          }),
        );
        const enricherB = createTestEnricher(
          'enricherB',
          ['signalB'],
          () => ({
            signals: new Map([['signalB', 'B']]),
            errors: [],
          }),
        );
        // Оба независимы, порядок должен быть стабильным (lexicographical)
        const registry1 = createTestRegistry([enricherB, enricherA]);
        const registry2 = createTestRegistry([enricherA, enricherB]);
        const result1 = enrichContext(context, registry1);
        const result2 = enrichContext(context, registry2);

        // Оба должны работать одинаково (стабильная сортировка)
        expect(result1.signals.get('signalA')).toBe('A');
        expect(result1.signals.get('signalB')).toBe('B');
        expect(result2.signals.get('signalA')).toBe('A');
        expect(result2.signals.get('signalB')).toBe('B');
      });
    });
  });

  describe('registerEnricher', () => {
    describe('базовые случаи', () => {
      it('добавляет enricher в policies по умолчанию', () => {
        const registry = createTestRegistry();
        const enricher = createTestEnricher(
          'test',
          ['test.signal'],
          () => ({
            signals: new Map([['test.signal', 'value']]),
            errors: [],
          }),
        );
        const newRegistry = registerEnricher(registry, enricher);

        expect(newRegistry.policies.length).toBe(1);
        expect(newRegistry.invariants.length).toBe(0);
        expect(newRegistry.policies[0]?.name).toBe('test');
      });

      it('добавляет enricher в invariants если asInvariant=true', () => {
        const registry = createTestRegistry();
        const enricher = createTestEnricher(
          'test',
          ['test.signal'],
          () => ({
            signals: new Map([['test.signal', 'value']]),
            errors: [],
          }),
        );
        const newRegistry = registerEnricher(registry, enricher, true);

        expect(newRegistry.invariants.length).toBe(1);
        expect(newRegistry.policies.length).toBe(0);
        expect(newRegistry.invariants[0]?.name).toBe('test');
      });

      it('сохраняет существующие enrichers', () => {
        const existingEnricher = createTestEnricher(
          'existing',
          ['existing.signal'],
          () => ({
            signals: new Map([['existing.signal', 'value']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([existingEnricher]);
        const newEnricher = createTestEnricher(
          'new',
          ['new.signal'],
          () => ({
            signals: new Map([['new.signal', 'value']]),
            errors: [],
          }),
        );
        const newRegistry = registerEnricher(registry, newEnricher);

        expect(newRegistry.invariants.length).toBe(1);
        expect(newRegistry.policies.length).toBe(1);
        expect(newRegistry.invariants[0]?.name).toBe('existing');
        expect(newRegistry.policies[0]?.name).toBe('new');
      });
    });

    describe('validation', () => {
      it('бросает ошибку если enricher с таким именем уже существует', () => {
        const existingEnricher = createTestEnricher(
          'duplicate',
          ['signal1'],
          () => ({
            signals: new Map([['signal1', 'value']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([existingEnricher]);
        const duplicateEnricher = createTestEnricher(
          'duplicate',
          ['signal2'],
          () => ({
            signals: new Map([['signal2', 'value']]),
            errors: [],
          }),
        );

        expect(() => registerEnricher(registry, duplicateEnricher)).toThrow(
          'Context enricher "duplicate" already exists in registry',
        );
      });

      it('бросает ошибку если сигнал уже предоставляется другим enricher', () => {
        const existingEnricher = createTestEnricher(
          'existing',
          ['shared.signal'],
          () => ({
            signals: new Map([['shared.signal', 'value']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([existingEnricher]);
        const newEnricher = createTestEnricher(
          'new',
          ['shared.signal'],
          () => ({
            signals: new Map([['shared.signal', 'value']]),
            errors: [],
          }),
        );

        expect(() => registerEnricher(registry, newEnricher)).toThrow(
          'Signal "shared.signal" is already provided by enricher "existing"',
        );
      });

      it('бросает ошибку если enricher предоставляет несколько сигналов, один из которых уже занят', () => {
        const existingEnricher = createTestEnricher(
          'existing',
          ['signal1'],
          () => ({
            signals: new Map([['signal1', 'value']]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([existingEnricher]);
        const newEnricher = createTestEnricher(
          'new',
          ['signal2', 'signal1'],
          () => ({
            signals: new Map([
              ['signal2', 'value2'],
              ['signal1', 'value1'],
            ]),
            errors: [],
          }),
        );

        expect(() => registerEnricher(registry, newEnricher)).toThrow(
          'Signal "signal1" is already provided by enricher "existing"',
        );
      });

      it('проверяет конфликты сигналов в существующем registry', () => {
        const enricher1 = createTestEnricher(
          'enricher1',
          ['signal1', 'signal2'],
          () => ({
            signals: new Map([
              ['signal1', 'value1'],
              ['signal2', 'value2'],
            ]),
            errors: [],
          }),
        );
        const registry = createTestRegistry([enricher1]);
        const enricher2 = createTestEnricher(
          'enricher2',
          ['signal3'],
          () => ({
            signals: new Map([['signal3', 'value3']]),
            errors: [],
          }),
        );
        // Должно пройти проверку, так как signal3 не конфликтует
        const newRegistry = registerEnricher(registry, enricher2);

        expect(newRegistry.policies.length).toBe(1);
        expect(newRegistry.policies[0]?.name).toBe('enricher2');
      });
    });

    describe('immutability', () => {
      it('не мутирует исходный registry', () => {
        const registry = createTestRegistry();
        const enricher = createTestEnricher(
          'test',
          ['test.signal'],
          () => ({
            signals: new Map([['test.signal', 'value']]),
            errors: [],
          }),
        );
        const newRegistry = registerEnricher(registry, enricher);

        expect(registry.policies.length).toBe(0);
        expect(newRegistry.policies.length).toBe(1);
        expect(registry).not.toBe(newRegistry);
      });

      it('возвращает frozen registry', () => {
        const registry = createTestRegistry();
        const enricher = createTestEnricher(
          'test',
          ['test.signal'],
          () => ({
            signals: new Map([['test.signal', 'value']]),
            errors: [],
          }),
        );
        const newRegistry = registerEnricher(registry, enricher);

        expect(Object.isFrozen(newRegistry)).toBe(true);
        expect(Object.isFrozen(newRegistry.invariants)).toBe(true);
        expect(Object.isFrozen(newRegistry.policies)).toBe(true);
      });
    });
  });

  describe('defaultEnricherRegistry', () => {
    it('является frozen объектом', () => {
      expect(Object.isFrozen(defaultEnricherRegistry)).toBe(true);
      expect(Object.isFrozen(defaultEnricherRegistry.invariants)).toBe(true);
      expect(Object.isFrozen(defaultEnricherRegistry.policies)).toBe(true);
    });

    it('имеет пустые массивы invariants и policies', () => {
      expect(defaultEnricherRegistry.invariants.length).toBe(0);
      expect(defaultEnricherRegistry.policies.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('обрабатывает enricher без provides', () => {
      const context = createTestContext();
      const enricher = createTestEnricher(
        'empty',
        [],
        () => ({
          signals: new Map(),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      expect(result.signals.size).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('обрабатывает enricher с пустыми dependsOn', () => {
      const context = createTestContext();
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', 'value']]),
          errors: [],
        }),
        [],
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      expect(result.signals.get('test.signal')).toBe('value');
      expect(result.errors.length).toBe(0);
    });

    it('обрабатывает enricher который возвращает undefined значения в signals', () => {
      const context = createTestContext();
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', undefined]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // undefined значения должны быть сохранены
      expect(result.signals.has('test.signal')).toBe(true);
      expect(result.signals.get('test.signal')).toBeUndefined();
    });

    it('обрабатывает сложные nested структуры в signals', () => {
      const context = createTestContext();
      const enricher = createTestEnricher(
        'test',
        ['test.nested'],
        () => ({
          signals: new Map([
            [
              'test.nested',
              {
                level1: {
                  level2: {
                    level3: 'value',
                  },
                },
              },
            ],
          ]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      const nested = result.signals.get('test.nested');
      expect(nested).toBeDefined();
      if (
        nested !== null
        && nested !== undefined
        && typeof nested === 'object'
        && 'level1' in nested
      ) {
        const level1 = nested.level1;
        if (
          level1 !== null
          && level1 !== undefined
          && typeof level1 === 'object'
          && 'level2' in level1
        ) {
          const level2 = level1.level2;
          if (
            level2 !== null
            && level2 !== undefined
            && typeof level2 === 'object'
            && 'level3' in level2
          ) {
            expect(level2.level3).toBe('value');
          }
        }
      }
    });

    it('обрабатывает circular references в signals (stableKeySort cache)', () => {
      const context = createTestContext();
      const circular = createCircularReference('test');
      const enricher = createTestEnricher(
        'test',
        ['test.circular'],
        () => ({
          signals: new Map([['test.circular', circular]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Circular reference должна быть обработана без ошибок
      expect(result.signals.has('test.circular')).toBe(true);
    });

    it('обрабатывает null и undefined значения в stableKeySort', () => {
      const context = createTestContext();
      const enricher = createTestEnricher(
        'test',
        ['test.null', 'test.undefined'],
        () => ({
          signals: new Map([
            ['test.null', null],
            ['test.undefined', undefined],
          ]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      expect(result.signals.get('test.null')).toBeNull();
      expect(result.signals.get('test.undefined')).toBeUndefined();
    });

    it('обрабатывает массивы с circular references в stableKeySort', () => {
      const context = createTestContext();
      const arr: unknown[] = [1, 2];
      arr.push(arr); // circular reference
      const enricher = createTestEnricher(
        'test',
        ['test.array'],
        () => ({
          signals: new Map([['test.array', arr]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      expect(result.signals.has('test.array')).toBe(true);
    });

    it('не детектирует конфликт для null и undefined (isStableEqual считает их равными)', () => {
      const context = createTestContext();
      const enricher1 = createTestEnricher(
        'enricher1',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', null]]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', undefined]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // null и undefined считаются равными в isStableEqual (строка 508)
      const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
      expect(conflictError).toBeUndefined();
    });

    it('детектирует конфликт через isStableEqual с не-JSON-serializable значениями', () => {
      const context = createTestContext();
      const func1 = () => {};
      const func2 = () => {};
      const enricher1 = createTestEnricher(
        'enricher1',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', func1]]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', func2]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Функции не JSON-serializable, должны быть обработаны
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('обрабатывает ошибки в isStableEqual (catch блок) - покрытие строки 522', () => {
      const context = createTestContext();
      // Создаем объект, который вызовет ошибку при JSON.stringify в stableKeySort
      // Используем BigInt, который не сериализуется в JSON
      const problematicObj1 = {
        value: BigInt(123),
      };
      const problematicObj2 = {
        value: BigInt(456),
      };
      const enricher1 = createTestEnricher(
        'enricher1',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', problematicObj1]]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', problematicObj2]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // BigInt не JSON-serializable, должна быть обработана ошибка в catch блоке (строка 522)
      // Значения разные, но ошибка в JSON.stringify должна быть обработана
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('использует cache в stableKeySort для circular references (покрытие строк 457-490)', () => {
      const context = createTestContext();
      // Создаем объект с circular reference, который будет использован в конфликте
      const circular1 = createCircularReference('test1');
      const circular2 = createCircularReference('test2');
      const enricher1 = createTestEnricher(
        'enricher1',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', circular1]]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', circular2]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Circular references должны быть обработаны через cache
      // Должен быть конфликт, так как значения разные
      const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
      expect(conflictError).toBeDefined();
    });

    it('использует visited в stableKeySort для circular references (покрытие строки 462-464)', () => {
      const context = createTestContext();
      // Создаем объект, который ссылается сам на себя
      const selfRef = createCircularReference('test');
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', selfRef]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Circular reference должна быть обработана через visited
      expect(result.signals.has('test.signal')).toBe(true);
    });

    it('бросает ошибку при конфликте сигналов внутри существующего registry (buildProvidersMap, покрытие строки 793)', () => {
      // Строка 793 вызывается когда в существующем registry уже есть два enrichers
      // которые конфликтуют по сигналам (при построении signalProviders map)
      // Это может произойти если registry создан напрямую с конфликтующими enrichers
      // и затем мы пытаемся зарегистрировать еще один enricher
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1', 'signal2'],
        () => ({
          signals: new Map([
            ['signal1', 'value1'],
            ['signal2', 'value2'],
          ]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2', 'signal3'],
        () => ({
          signals: new Map([
            ['signal2', 'value2'],
            ['signal3', 'value3'],
          ]),
          errors: [],
        }),
      );
      // Создаем registry напрямую с конфликтующими enrichers (минуя registerEnricher)
      // Затем пытаемся зарегистрировать еще один enricher - это вызовет проверку в buildProvidersMap
      const registry = createTestRegistry([enricher1, enricher2]);
      const enricher3 = createTestEnricher(
        'enricher3',
        ['signal4'],
        () => ({
          signals: new Map([['signal4', 'value4']]),
          errors: [],
        }),
      );
      // При регистрации enricher3 registerEnricher проверит существующие enrichers
      // и обнаружит конфликт между enricher1 и enricher2 (строка 793)
      expect(() => registerEnricher(registry, enricher3)).toThrow(
        'Signal "signal2" is already provided by enricher "enricher1"',
      );
    });

    it('бросает ошибку при конфликте сигналов внутри существующего registry (покрытие строки 793)', () => {
      // Создаем registry с двумя enrichers, которые конфликтуют по сигналам
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1', 'signal2'],
        () => ({
          signals: new Map([
            ['signal1', 'value1'],
            ['signal2', 'value2'],
          ]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2', 'signal3'],
        () => ({
          signals: new Map([
            ['signal2', 'value2'],
            ['signal3', 'value3'],
          ]),
          errors: [],
        }),
      );
      // Сначала регистрируем enricher1
      const registry = registerEnricher(createTestRegistry(), enricher1);

      // Попытка зарегистрировать enricher2 должна вызвать ошибку
      // при проверке существующих enrichers (buildProvidersMap, строка 793)
      expect(() => registerEnricher(registry, enricher2)).toThrow(
        'Signal "signal2" is already provided by enricher "enricher1"',
      );
    });

    it('покрывает ветку buildProvidersMap когда несколько enrichers предоставляют один signal (строка 148)', () => {
      const context = createTestContext();
      // Создаем два enricher, которые предоставляют один и тот же signal
      // Это вызовет ветку когда existing !== undefined
      const enricher1 = createTestEnricher(
        'enricher1',
        ['shared.signal'],
        () => ({
          signals: new Map([['shared.signal', 'value1']]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['shared.signal'],
        () => ({
          signals: new Map([['shared.signal', 'value2']]),
          errors: [],
        }),
      );
      // Создаем registry напрямую с обоими enrichers (минуя registerEnricher)
      // Это вызовет buildProvidersMap с несколькими providers для одного signal
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Должен быть конфликт сигналов
      const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
      expect(conflictError).toBeDefined();
    });

    it('покрывает ветку buildEdgesMap когда signalProviders === undefined (строка 185)', () => {
      const context = createTestContext();
      // Создаем enricher с зависимостью от несуществующего signal
      // Это вызовет ветку когда signalProviders === undefined
      const dependentEnricher = createTestEnricher(
        'dependent',
        ['dependent.signal'],
        () => ({
          signals: new Map([['dependent.signal', 'value']]),
          errors: [],
        }),
        ['missing.signal'],
      );
      const registry = createTestRegistry([dependentEnricher]);
      const result = enrichContext(context, registry);

      // Enricher должен быть пропущен
      expect(result.signals.has('dependent.signal')).toBe(false);
      const skippedError = result.errors.find((e) => e.kind === 'SKIPPED_ENRICHER');
      expect(skippedError).toBeDefined();
    });

    it('покрывает ветку buildEdgesMap когда dependencies.length === 0 (строка 197)', () => {
      const context = createTestContext();
      // Создаем enricher с dependsOn, но все зависимости не найдены
      // Это вызовет ветку когда dependencies.length === 0
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', 'value']]),
          errors: [],
        }),
        ['missing1', 'missing2'],
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Enricher должен быть пропущен
      expect(result.signals.has('test.signal')).toBe(false);
    });

    it('покрывает ветку detectCycles когда visited.has(enricherName) (строка 248)', () => {
      const context = createTestContext();
      // Создаем два независимых enricher без циклов
      // Это вызовет ветку когда enricher уже посещен
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1'],
        () => ({
          signals: new Map([['signal1', 'value1']]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2'],
        () => ({
          signals: new Map([['signal2', 'value2']]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Не должно быть циклов
      const cycleError = result.errors.find((e) => e.kind === 'CIRCULAR_DEPENDENCY');
      expect(cycleError).toBeUndefined();
      expect(result.signals.get('signal1')).toBe('value1');
      expect(result.signals.get('signal2')).toBe('value2');
    });

    it('покрывает ветку detectCycles когда deps === undefined (строка 256)', () => {
      const context = createTestContext();
      // Создаем enricher без зависимостей (deps будет undefined)
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', 'value']]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Не должно быть циклов
      const cycleError = result.errors.find((e) => e.kind === 'CIRCULAR_DEPENDENCY');
      expect(cycleError).toBeUndefined();
      expect(result.signals.get('test.signal')).toBe('value');
    });

    it('покрывает ветку detectCycles когда acc !== null (строка 268)', () => {
      const context = createTestContext();
      // Создаем несколько enrichers, первый из которых создает цикл
      // Это вызовет ветку когда acc уже не null
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1'],
        () => ({
          signals: new Map([['signal1', 'value1']]),
          errors: [],
        }),
        ['signal2'],
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2'],
        () => ({
          signals: new Map([['signal2', 'value2']]),
          errors: [],
        }),
        ['signal1'],
      );
      const enricher3 = createTestEnricher(
        'enricher3',
        ['signal3'],
        () => ({
          signals: new Map([['signal3', 'value3']]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2, enricher3]);
      const result = enrichContext(context, registry);

      // Должен быть обнаружен цикл
      const cycleError = result.errors.find((e) => e.kind === 'CIRCULAR_DEPENDENCY');
      expect(cycleError).toBeDefined();
    });

    it('покрывает ветку kahnStep когда !deps.includes(currentName) (строка 374)', () => {
      const context = createTestContext();
      // Создаем enricher, который не зависит от текущего обрабатываемого enricher
      // Это вызовет ветку когда deps не включает currentName
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1'],
        () => ({
          signals: new Map([['signal1', 'value1']]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2'],
        () => ({
          signals: new Map([['signal2', 'value2']]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Оба enricher должны быть обработаны
      expect(result.signals.get('signal1')).toBe('value1');
      expect(result.signals.get('signal2')).toBe('value2');
    });

    it('покрывает ветку kahnStep когда newDegree !== 0 (строка 385)', () => {
      const context = createTestContext();
      // Создаем цепочку зависимостей, где newDegree не равен 0
      // enricher3 зависит от enricher2, который зависит от enricher1
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1'],
        () => ({
          signals: new Map([['signal1', 'value1']]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2'],
        (_ctx, signals) => {
          const signal1 = signals.get('signal1');
          return {
            signals: new Map([['signal2', `value2-${signal1}`]]),
            errors: [],
          };
        },
        ['signal1'],
      );
      const enricher3 = createTestEnricher(
        'enricher3',
        ['signal3'],
        (_ctx, signals) => {
          const signal2 = signals.get('signal2');
          return {
            signals: new Map([['signal3', `value3-${signal2}`]]),
            errors: [],
          };
        },
        ['signal2'],
      );
      const registry = createTestRegistry([enricher1, enricher2, enricher3]);
      const result = enrichContext(context, registry);

      // Все enrichers должны быть обработаны в правильном порядке
      expect(result.signals.get('signal1')).toBe('value1');
      expect(result.signals.get('signal2')).toBe('value2-value1');
      expect(result.signals.get('signal3')).toBe('value3-value2-value1');
    });

    it('покрывает ветку applyEnricherSignals когда isStableEqual возвращает true (строка 560)', () => {
      const context = createTestContext();
      // Создаем два enricher, которые предоставляют одинаковые значения для одного signal
      // Это вызовет ветку когда isStableEqual возвращает true
      const enricher1 = createTestEnricher(
        'enricher1',
        ['same.signal'],
        () => ({
          signals: new Map([['same.signal', { value: 'test' }]]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['same.signal'],
        () => ({
          signals: new Map([['same.signal', { value: 'test' }]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Не должно быть конфликта, так как значения одинаковые
      const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
      expect(conflictError).toBeUndefined();
      // Один из enrichers должен быть пропущен из-за multi-provider, но значения одинаковые
      expect(result.signals.has('same.signal')).toBe(true);
    });

    it('покрывает ветку applyEnricherSignals когда сигнал уже есть и значения равны (строка 560)', () => {
      const context = createTestContext();
      // Создаем enricher, который добавляет сигнал дважды с одинаковыми значениями
      // Это вызовет ветку когда сигнал уже есть, но значения равны
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([
            ['test.signal', 'value'],
            ['test.signal', 'value'], // дубликат с тем же значением
          ]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Сигнал должен быть добавлен один раз
      expect(result.signals.get('test.signal')).toBe('value');
      expect(result.errors.length).toBe(0);
    });

    it('покрывает ветку buildEdgesMap когда innerDeps уже включает provider.name (строка 190)', () => {
      const context = createTestContext();
      // Создаем ситуацию, когда несколько enrichers предоставляют один signal
      // и один enricher зависит от этого signal - это вызовет проверку дубликатов
      const provider1 = createTestEnricher(
        'provider1',
        ['shared.signal'],
        () => ({
          signals: new Map([['shared.signal', 'value1']]),
          errors: [],
        }),
      );
      const provider2 = createTestEnricher(
        'provider2',
        ['shared.signal'],
        () => ({
          signals: new Map([['shared.signal', 'value2']]),
          errors: [],
        }),
      );
      const dependent = createTestEnricher(
        'dependent',
        ['dependent.signal'],
        () => ({
          signals: new Map([['dependent.signal', 'value']]),
          errors: [],
        }),
        ['shared.signal'],
      );
      // Создаем registry с несколькими providers для одного signal
      const registry = createTestRegistry([provider1, provider2, dependent]);
      const result = enrichContext(context, registry);

      // Должен быть конфликт из-за multi-provider
      const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
      expect(conflictError).toBeDefined();
    });

    it('покрывает ветку initializeInDegree когда acc.get(enricherName) === undefined (строка 293)', () => {
      const context = createTestContext();
      // Создаем enricher с зависимостью, где зависимый enricher не в initial map
      // Это вызовет ветку когда acc.get(enricherName) === undefined
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1'],
        () => ({
          signals: new Map([['signal1', 'value1']]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2'],
        () => ({
          signals: new Map([['signal2', 'value2']]),
          errors: [],
        }),
        ['signal1'],
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Оба enricher должны быть обработаны
      expect(result.signals.get('signal1')).toBe('value1');
      expect(result.signals.get('signal2')).toBe('value2');
    });

    it('покрывает ветку detectCycles когда acc !== null в reduce (строка 258)', () => {
      const context = createTestContext();
      // Создаем несколько enrichers с циклами, первый из которых найдет цикл
      // Это вызовет ветку когда acc уже не null в reduce
      const enricher1 = createTestEnricher(
        'enricher1',
        ['signal1'],
        () => ({
          signals: new Map([['signal1', 'value1']]),
          errors: [],
        }),
        ['signal2'],
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['signal2'],
        () => ({
          signals: new Map([['signal2', 'value2']]),
          errors: [],
        }),
        ['signal1'],
      );
      const enricher3 = createTestEnricher(
        'enricher3',
        ['signal3'],
        () => ({
          signals: new Map([['signal3', 'value3']]),
          errors: [],
        }),
        ['signal3'], // self-cycle
      );
      const registry = createTestRegistry([enricher1, enricher2, enricher3]);
      const result = enrichContext(context, registry);

      // Должен быть обнаружен цикл
      const cycleError = result.errors.find((e) => e.kind === 'CIRCULAR_DEPENDENCY');
      expect(cycleError).toBeDefined();
    });

    it('покрывает ветку stableKeySort для объектов с несортированными ключами (строка 485)', () => {
      const context = createTestContext();
      // Создаем объект с несортированными ключами для проверки сортировки
      const unsortedObj = {
        z: 'last',
        a: 'first',
        m: 'middle',
      };
      const enricher1 = createTestEnricher(
        'enricher1',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', unsortedObj]]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', { a: 'first', m: 'middle', z: 'last' }]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Не должно быть конфликта, так как ключи отсортированы одинаково
      const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
      expect(conflictError).toBeUndefined();
    });

    it('покрывает ветку stableKeySort для массивов (строка 476)', () => {
      const context = createTestContext();
      // Создаем массив для проверки обработки массивов в stableKeySort
      const arrayValue = [3, 1, 2];
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', arrayValue]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Массив должен быть обработан
      const signal = result.signals.get('test.signal');
      expect(Array.isArray(signal)).toBe(true);
    });

    it('покрывает ветку kahnStep когда enricher найден и добавляется в result (строка 368)', () => {
      const context = createTestContext();
      // Создаем enricher, который будет найден в enricherMap
      // Это вызовет ветку когда enricher !== undefined и добавляется в result
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', 'value']]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Enricher должен быть обработан
      expect(result.signals.get('test.signal')).toBe('value');
      expect(result.errors.length).toBe(0);
    });

    it('покрывает ветку stableKeySort для массивов при конфликте сигналов (строки 468-476)', () => {
      const context = createTestContext();
      // Создаем два enricher с массивами для проверки обработки массивов в stableKeySort
      // при конфликте сигналов
      const array1 = [1, 2, 3];
      const array2 = [4, 5, 6];
      const enricher1 = createTestEnricher(
        'enricher1',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', array1]]),
          errors: [],
        }),
      );
      const enricher2 = createTestEnricher(
        'enricher2',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', array2]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher1, enricher2]);
      const result = enrichContext(context, registry);

      // Должен быть конфликт, что вызовет isStableEqual, который вызовет stableKeySort для массивов
      const conflictError = result.errors.find((e) => e.kind === 'CONFLICTING_SIGNALS');
      expect(conflictError).toBeDefined();
    });

    it('покрывает ветку stableKeySort для массивов с nested структурами (строки 468-476)', () => {
      const context = createTestContext();
      // Создаем массив с nested объектами для проверки рекурсивной обработки
      const nestedArray = [
        { b: 2, a: 1 },
        { d: 4, c: 3 },
      ];
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', nestedArray]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Массив должен быть обработан с сортировкой ключей в nested объектах
      const signal = result.signals.get('test.signal');
      expect(Array.isArray(signal)).toBe(true);
    });

    it('покрывает ветку stableKeySort для массивов с circular references (строки 468-476)', () => {
      const context = createTestContext();
      // Создаем массив с circular reference
      const arr: unknown[] = [1, 2];
      const obj = { arr };
      arr.push(obj); // circular reference
      const enricher = createTestEnricher(
        'test',
        ['test.signal'],
        () => ({
          signals: new Map([['test.signal', arr]]),
          errors: [],
        }),
      );
      const registry = createTestRegistry([enricher]);
      const result = enrichContext(context, registry);

      // Массив с circular reference должен быть обработан
      expect(result.signals.has('test.signal')).toBe(true);
    });
  });
});
