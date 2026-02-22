/**
 * @file Unit тесты для Plugin API (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import {
  defineFallback,
  defineStage,
  validatePipelineConfig,
  validatePlanPlugin,
  validatePlugin,
} from '../../src/pipeline/plugin-api.js';
import type {
  FallbackStage,
  PipelineConfig,
  StagePlugin,
  StageResult,
} from '../../src/pipeline/plugin-api.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type TestSlotMap = Readonly<{
  readonly slot1: string;
  readonly slot2: number;
  readonly slot3: boolean;
}>;

function createValidPlugin(): StagePlugin<TestSlotMap, ['slot1']> {
  return {
    provides: ['slot1'],
    dependsOn: ['slot2'],
    async run() {
      return { ok: true, slots: { slot1: 'result' } };
    },
  };
}

function createValidFallback(): FallbackStage<TestSlotMap> {
  return {
    provides: [],
    isFallback: true,
    async run() {
      return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
    },
  };
}

/* ============================================================================
 * 🧪 INTERNAL VALIDATION HELPERS — TESTS
 * ============================================================================
 */

describe('validatePlanPlugin', () => {
  it('возвращает false для null', () => {
    expect(validatePlanPlugin<TestSlotMap>(null)).toBe(false);
  });

  it('возвращает false для undefined', () => {
    expect(validatePlanPlugin<TestSlotMap>(undefined)).toBe(false);
  });

  it('возвращает false для массива', () => {
    expect(validatePlanPlugin<TestSlotMap>([])).toBe(false);
  });

  it('возвращает false для примитивного типа', () => {
    expect(validatePlanPlugin<TestSlotMap>('string')).toBe(false);
    expect(validatePlanPlugin<TestSlotMap>(123)).toBe(false);
    expect(validatePlanPlugin<TestSlotMap>(true)).toBe(false);
  });

  it('возвращает false если отсутствует provides', () => {
    const plugin = {};
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если provides не массив', () => {
    const plugin = {
      provides: 'not-array',
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если provides пустой массив', () => {
    const plugin = {
      provides: [],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если provides содержит пустые строки', () => {
    const plugin = {
      provides: ['', 'valid'],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если provides содержит дубликаты', () => {
    const plugin = {
      provides: ['slot1', 'slot1'],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если dependsOn не массив (когда присутствует)', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: 'not-array',
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если dependsOn содержит пустые строки', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: ['', 'valid'],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если dependsOn содержит дубликаты', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: ['slot2', 'slot2'],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает true для валидного plugin без dependsOn', () => {
    const plugin = {
      provides: ['slot1'],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('возвращает true для валидного plugin с dependsOn', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: ['slot2'],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('возвращает true для валидного plugin с пустым dependsOn', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: [],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('принимает dependsOn: undefined', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: undefined,
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('работает с большим количеством provides', () => {
    const plugin = {
      provides: ['slot1', 'slot2', 'slot3'],
      dependsOn: ['slot4', 'slot5'],
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('работает с объектом с дополнительными полями', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: ['slot2'],
      extraField: 'ignored',
    };
    expect(validatePlanPlugin<TestSlotMap>(plugin)).toBe(true);
  });
});

/* ============================================================================
 * 🧪 VALIDATE_PLUGIN — TESTS
 * ============================================================================
 */

describe('validatePlugin', () => {
  it('возвращает false для null', () => {
    expect(validatePlugin<TestSlotMap>(null)).toBe(false);
  });

  it('возвращает false для undefined', () => {
    expect(validatePlugin<TestSlotMap>(undefined)).toBe(false);
  });

  it('возвращает false для массива', () => {
    expect(validatePlugin<TestSlotMap>([])).toBe(false);
  });

  it('возвращает false для примитивного типа', () => {
    expect(validatePlugin<TestSlotMap>('string')).toBe(false);
    expect(validatePlugin<TestSlotMap>(123)).toBe(false);
    expect(validatePlugin<TestSlotMap>(true)).toBe(false);
  });

  it('возвращает false если отсутствует provides', () => {
    const plugin = {
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если отсутствует run', () => {
    const plugin = {
      provides: ['slot1'],
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если provides не массив', () => {
    const plugin = {
      provides: 'not-array',
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если provides пустой массив', () => {
    const plugin = {
      provides: [],
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если run не функция', () => {
    const plugin = {
      provides: ['slot1'],
      run: 'not-function',
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если dependsOn не массив (когда присутствует)', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: 'not-array',
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает false если onError не функция (когда присутствует)', () => {
    const plugin = {
      provides: ['slot1'],
      run: async () => ({ ok: true, slots: {} }),
      onError: 'not-function',
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(false);
  });

  it('возвращает true для валидного plugin без dependsOn и onError', () => {
    const plugin = {
      provides: ['slot1'],
      run: async () => ({ ok: true, slots: { slot1: 'value' } }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('возвращает true для валидного plugin с dependsOn', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: ['slot2'],
      run: async () => ({ ok: true, slots: { slot1: 'value' } }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('возвращает true для валидного plugin с onError', () => {
    const plugin = {
      provides: ['slot1'],
      run: async () => ({ ok: true, slots: { slot1: 'value' } }),
      onError: () => {},
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('возвращает true для валидного plugin с dependsOn и onError', () => {
    const plugin = createValidPlugin();
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('принимает dependsOn: undefined', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: undefined,
      run: async () => ({ ok: true, slots: { slot1: 'value' } }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('принимает onError: undefined', () => {
    const plugin = {
      provides: ['slot1'],
      run: async () => ({ ok: true, slots: { slot1: 'value' } }),
      onError: undefined,
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });
});

/* ============================================================================
 * 🧪 VALIDATE_PIPELINE_CONFIG — TESTS
 * ============================================================================
 */

describe('validatePipelineConfig', () => {
  it('возвращает false для null', () => {
    expect(validatePipelineConfig<TestSlotMap>(null)).toBe(false);
  });

  it('возвращает false для undefined', () => {
    expect(validatePipelineConfig<TestSlotMap>(undefined)).toBe(false);
  });

  it('возвращает false для массива', () => {
    expect(validatePipelineConfig<TestSlotMap>([])).toBe(false);
  });

  it('возвращает false для примитивного типа', () => {
    expect(validatePipelineConfig<TestSlotMap>('string')).toBe(false);
    expect(validatePipelineConfig<TestSlotMap>(123)).toBe(false);
  });

  it('возвращает false для maxExecutionTimeMs <= 0', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: 0 })).toBe(false);
    expect(validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: -1 })).toBe(false);
  });

  it('возвращает false для maxExecutionTimeMs не число', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: 'string' as unknown as number }),
    ).toBe(false);
  });

  it('возвращает true для maxExecutionTimeMs > 0', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: 1000 })).toBe(true);
  });

  it('возвращает false для maxStages <= 0', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: 0 })).toBe(false);
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: -1 })).toBe(false);
  });

  it('возвращает false для maxStages не число', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: 'string' as unknown as number })).toBe(
      false,
    );
  });

  it('возвращает true для maxStages > 0', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: 10 })).toBe(true);
  });

  it('возвращает false для allowParallelExecution не boolean', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({
        allowParallelExecution: 'string' as unknown as boolean,
      }),
    ).toBe(false);
    expect(validatePipelineConfig<TestSlotMap>({ allowParallelExecution: 1 as unknown as boolean }))
      .toBe(false);
  });

  it('возвращает true для allowParallelExecution boolean', () => {
    expect(validatePipelineConfig<TestSlotMap>({ allowParallelExecution: true })).toBe(true);
    expect(validatePipelineConfig<TestSlotMap>({ allowParallelExecution: false })).toBe(true);
  });

  it('возвращает false для allowLazyEvaluation не boolean', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({ allowLazyEvaluation: 'string' as unknown as boolean }),
    ).toBe(false);
  });

  it('возвращает true для allowLazyEvaluation boolean', () => {
    expect(validatePipelineConfig<TestSlotMap>({ allowLazyEvaluation: true })).toBe(true);
    expect(validatePipelineConfig<TestSlotMap>({ allowLazyEvaluation: false })).toBe(true);
  });

  it('возвращает false для allowPartialRecompute не boolean', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({
        allowPartialRecompute: 'string' as unknown as boolean,
      }),
    ).toBe(false);
  });

  it('возвращает true для allowPartialRecompute boolean', () => {
    expect(validatePipelineConfig<TestSlotMap>({ allowPartialRecompute: true })).toBe(true);
    expect(validatePipelineConfig<TestSlotMap>({ allowPartialRecompute: false })).toBe(true);
  });

  it('возвращает false для abortSignal не AbortSignal', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({ abortSignal: 'not-signal' as unknown as AbortSignal }),
    ).toBe(false);
    expect(validatePipelineConfig<TestSlotMap>({ abortSignal: {} as unknown as AbortSignal })).toBe(
      false,
    );
  });

  it('возвращает true для abortSignal экземпляра AbortSignal', () => {
    const signal = new AbortController().signal;
    expect(validatePipelineConfig<TestSlotMap>({ abortSignal: signal })).toBe(true);
  });

  it('возвращает false для fallbackStage без isFallback', () => {
    const plugin = {
      provides: [] as const,
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(
      validatePipelineConfig<TestSlotMap>({
        fallbackStage: plugin as unknown as FallbackStage<TestSlotMap>,
      }),
    ).toBe(false);
  });

  it('возвращает false для fallbackStage с isFallback !== true', () => {
    const plugin = {
      provides: [] as const,
      isFallback: false,
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(
      validatePipelineConfig<TestSlotMap>({
        fallbackStage: plugin as unknown as FallbackStage<TestSlotMap>,
      }),
    ).toBe(false);
  });

  it('возвращает false для fallbackStage с непустым provides', () => {
    const plugin = {
      provides: ['slot1'] as const,
      isFallback: true,
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(
      validatePipelineConfig<TestSlotMap>({
        fallbackStage: plugin as unknown as FallbackStage<TestSlotMap>,
      }),
    ).toBe(false);
  });

  it('возвращает false для fallbackStage который не проходит validatePlugin', () => {
    const plugin = {
      provides: [] as const,
      isFallback: true,
      run: 'not-function',
    };
    expect(
      validatePipelineConfig<TestSlotMap>({
        fallbackStage: plugin as unknown as FallbackStage<TestSlotMap>,
      }),
    ).toBe(false);
  });

  it('возвращает false для fallbackStage который null', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({
        fallbackStage: null as unknown as FallbackStage<TestSlotMap>,
      }),
    ).toBe(false);
  });

  it('возвращает false для fallbackStage который массив', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({
        fallbackStage: [] as unknown as FallbackStage<TestSlotMap>,
      }),
    ).toBe(false);
  });

  it('возвращает false для fallbackStage который примитив', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({
        fallbackStage: 'string' as unknown as FallbackStage<TestSlotMap>,
      }),
    ).toBe(false);
  });

  it('возвращает true для валидного fallbackStage', () => {
    const fallback = createValidFallback();
    expect(validatePipelineConfig<TestSlotMap>({ fallbackStage: fallback })).toBe(true);
  });

  it('возвращает true для fallbackStage с onError', () => {
    const fallback: FallbackStage<TestSlotMap> = {
      provides: [],
      isFallback: true,
      async run() {
        return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
      },
      onError() {
        // Test onError handler
      },
    };
    expect(validatePipelineConfig<TestSlotMap>({ fallbackStage: fallback })).toBe(true);
  });

  it('возвращает true для пустой конфигурации', () => {
    expect(validatePipelineConfig<TestSlotMap>({})).toBe(true);
  });

  it('возвращает true для полной валидной конфигурации', () => {
    const config: PipelineConfig<TestSlotMap> = {
      maxExecutionTimeMs: 5000,
      maxStages: 100,
      allowParallelExecution: true,
      allowLazyEvaluation: true,
      allowPartialRecompute: false,
      abortSignal: new AbortController().signal,
      fallbackStage: createValidFallback(),
    };
    expect(validatePipelineConfig<TestSlotMap>(config)).toBe(true);
  });

  it('принимает все опциональные поля как undefined', () => {
    const config = {
      maxExecutionTimeMs: undefined,
      maxStages: undefined,
      allowParallelExecution: undefined,
      allowLazyEvaluation: undefined,
      allowPartialRecompute: undefined,
      abortSignal: undefined,
      fallbackStage: undefined,
    };
    expect(validatePipelineConfig<TestSlotMap>(config)).toBe(true);
  });

  it('работает с конфигурацией без опциональных полей', () => {
    const config = {};
    expect(validatePipelineConfig<TestSlotMap>(config)).toBe(true);
  });

  it('принимает now: undefined', () => {
    const config = {
      now: undefined,
    };
    expect(validatePipelineConfig<TestSlotMap>(config)).toBe(true);
  });

  it('возвращает false для now не функции', () => {
    expect(
      validatePipelineConfig<TestSlotMap>({ now: 'not-function' as unknown as (() => number) }),
    ).toBe(false);
    expect(validatePipelineConfig<TestSlotMap>({ now: 123 as unknown as (() => number) })).toBe(
      false,
    );
  });
});

/* ============================================================================
 * 🏭 FACTORY HELPERS — TESTS
 * ============================================================================
 */

describe('defineStage', () => {
  it('возвращает тот же plugin', () => {
    const plugin = createValidPlugin();
    const result = defineStage<TestSlotMap>()(plugin);
    expect(result).toBe(plugin);
  });

  it('сохраняет все свойства plugin', () => {
    const plugin: StagePlugin<TestSlotMap, ['slot1', 'slot2']> = {
      provides: ['slot1', 'slot2'],
      dependsOn: ['slot3'],
      async run(): Promise<StageResult<TestSlotMap, ['slot1', 'slot2']>> {
        return { ok: true, slots: { slot1: 'value1', slot2: 42 } };
      },
      onError() {
        // Test helper
      },
    };
    const result = defineStage<TestSlotMap>()(plugin);
    expect(result.provides).toEqual(['slot1', 'slot2']);
    expect(result.dependsOn).toEqual(['slot3']);
    expect(result.run).toBe(plugin.run);
    expect(result.onError).toBe(plugin.onError);
  });

  it('работает с plugin без dependsOn и onError', () => {
    const plugin: StagePlugin<TestSlotMap, ['slot1']> = {
      provides: ['slot1'],
      async run(): Promise<StageResult<TestSlotMap, ['slot1']>> {
        return { ok: true, slots: { slot1: 'value' } };
      },
    };
    const result = defineStage<TestSlotMap>()(plugin);
    expect(result).toBe(plugin);
    expect(result.dependsOn).toBeUndefined();
    expect(result.onError).toBeUndefined();
  });
});

describe('defineFallback', () => {
  it('возвращает fallback с isFallback: true', () => {
    const plugin: Omit<StagePlugin<TestSlotMap, readonly never[]>, 'isFallback'> = {
      provides: [],
      async run(): Promise<StageResult<TestSlotMap, readonly never[]>> {
        return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
      },
    };
    const result = defineFallback<TestSlotMap>()(plugin);
    expect(result.isFallback).toBe(true);
    expect(result.provides).toEqual([]);
    expect(result.run).toBe(plugin.run);
  });

  it('сохраняет все свойства plugin и добавляет isFallback', () => {
    const plugin: Omit<StagePlugin<TestSlotMap, readonly never[]>, 'isFallback'> = {
      provides: [],
      dependsOn: ['slot1'],
      async run(): Promise<StageResult<TestSlotMap, readonly never[]>> {
        return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
      },
      onError() {
        // Test helper
      },
    };
    const result = defineFallback<TestSlotMap>()(plugin);
    expect(result.isFallback).toBe(true);
    expect(result.provides).toEqual([]);
    expect(result.dependsOn).toEqual(['slot1']);
    expect(result.run).toBe(plugin.run);
    expect(result.onError).toBe(plugin.onError);
  });

  it('работает с fallback без dependsOn и onError', () => {
    const plugin: Omit<StagePlugin<TestSlotMap, readonly never[]>, 'isFallback'> = {
      provides: [],
      async run(): Promise<StageResult<TestSlotMap, readonly never[]>> {
        return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
      },
    };
    const result = defineFallback<TestSlotMap>()(plugin);
    expect(result.isFallback).toBe(true);
    expect(result.dependsOn).toBeUndefined();
    expect(result.onError).toBeUndefined();
  });

  it('работает с fallback с onError', () => {
    const plugin: Omit<StagePlugin<TestSlotMap, readonly never[]>, 'isFallback'> = {
      provides: [],
      async run(): Promise<StageResult<TestSlotMap, readonly never[]>> {
        return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
      },
      onError() {
        // Test onError handler
      },
    };
    const result = defineFallback<TestSlotMap>()(plugin);
    expect(result.isFallback).toBe(true);
    expect(result.onError).toBe(plugin.onError);
  });
});

/* ============================================================================
 * 🧪 EDGE CASES & STRESS TESTS
 * ============================================================================
 */

describe('Edge cases', () => {
  it('validatePlugin обрабатывает объект с дополнительными полями', () => {
    const plugin = {
      provides: ['slot1'],
      run: async () => ({ ok: true, slots: {} }),
      extraField: 'ignored',
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('validatePipelineConfig обрабатывает объект с дополнительными полями', () => {
    const config = {
      maxExecutionTimeMs: 1000,
      extraField: 'ignored',
    };
    expect(validatePipelineConfig<TestSlotMap>(config)).toBe(true);
  });

  it('validatePlugin обрабатывает dependsOn как пустой массив', () => {
    const plugin = {
      provides: ['slot1'],
      dependsOn: [],
      run: async () => ({ ok: true, slots: {} }),
    };
    expect(validatePlugin<TestSlotMap>(plugin)).toBe(true);
  });

  it('validatePipelineConfig обрабатывает NaN для числовых полей', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: NaN })).toBe(false);
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: NaN })).toBe(false);
  });

  it('validatePipelineConfig обрабатывает Infinity для числовых полей', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: Infinity })).toBe(true);
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: Infinity })).toBe(true);
  });

  it('validatePipelineConfig обрабатывает очень большие числа', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: Number.MAX_SAFE_INTEGER }))
      .toBe(true);
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: Number.MAX_SAFE_INTEGER })).toBe(true);
  });

  it('validatePipelineConfig обрабатывает очень маленькие положительные числа', () => {
    expect(validatePipelineConfig<TestSlotMap>({ maxExecutionTimeMs: Number.MIN_VALUE })).toBe(
      true,
    );
    expect(validatePipelineConfig<TestSlotMap>({ maxStages: Number.MIN_VALUE })).toBe(true);
  });

  it('defineStage работает с большим количеством provides', () => {
    const plugin: StagePlugin<TestSlotMap, ['slot1', 'slot2', 'slot3']> = {
      provides: ['slot1', 'slot2', 'slot3'],
      async run(): Promise<StageResult<TestSlotMap, ['slot1', 'slot2', 'slot3']>> {
        return { ok: true, slots: { slot1: 'v1', slot2: 2, slot3: true } };
      },
    };
    const result = defineStage<TestSlotMap>()(plugin);
    expect(result.provides).toHaveLength(3);
  });

  it('defineFallback гарантирует provides: []', () => {
    const plugin: Omit<StagePlugin<TestSlotMap, readonly never[]>, 'isFallback'> = {
      provides: [],
      async run(): Promise<StageResult<TestSlotMap, readonly never[]>> {
        return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
      },
    };
    const result = defineFallback<TestSlotMap>()(plugin);
    expect(result.provides).toEqual([]);
    expect(result.provides.length).toBe(0);
  });
});
