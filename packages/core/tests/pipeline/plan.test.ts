/**
 * @file Unit тесты для Execution Plan (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { describe, expect, it, vi } from 'vitest';

import type { ExecutionPlan, ExecutionPlanError } from '../../src/pipeline/plan.js';
import {
  createExecutionPlan,
  createExecutionPlanOrThrow,
  createExecutionPlanSafe,
} from '../../src/pipeline/plan.js';
import type { FallbackStage, PipelineConfig, StagePlugin } from '../../src/pipeline/plugin-api.js';
import {
  defineFallback,
  defineStage,
  validatePipelineConfig,
  validatePlanPlugin,
  validatePlugin,
} from '../../src/pipeline/plugin-api.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type TestSlotMap = Readonly<{
  readonly slot1: string;
  readonly slot2: number;
  readonly slot3: boolean;
  readonly slot4: string;
}>;

function createValidPlugin(
  stageId: string,
  provides: readonly (keyof TestSlotMap)[] = ['slot1'],
  dependsOn: readonly (keyof TestSlotMap)[] = [],
): StagePlugin<TestSlotMap> {
  const plugin = {
    id: stageId as any, // Используем any для упрощения тестов
    provides,
    dependsOn,
    async run() {
      const slots: any = {};
      provides.forEach((slot) => {
        switch (slot) {
          case 'slot1':
            // eslint-disable-next-line fp/no-mutation
            slots.slot1 = `result_${stageId}`;
            break;
          case 'slot2':
            // eslint-disable-next-line fp/no-mutation
            slots.slot2 = 42;
            break;
          case 'slot3':
            // eslint-disable-next-line fp/no-mutation
            slots.slot3 = true;
            break;
          case 'slot4':
            // eslint-disable-next-line fp/no-mutation
            slots.slot4 = 'fallback';
            break;
        }
      });
      return { ok: true, slots };
    },
  };
  return plugin as StagePlugin<TestSlotMap>;
}

function createValidFallback(): FallbackStage<TestSlotMap> {
  return {
    provides: [] as const,
    isFallback: true,
    async run() {
      return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Fallback') } };
    },
  } as FallbackStage<TestSlotMap>;
}

function createValidConfig(fallback?: FallbackStage<TestSlotMap>): PipelineConfig<TestSlotMap> {
  if (fallback !== undefined) {
    return { fallbackStage: fallback };
  }
  return {};
}

/* ============================================================================
 * 🧪 TESTS
 * ============================================================================
 */

describe('Execution Plan Builder', () => {
  describe('plugin-api validation helpers (loaded via plan)', () => {
    it('validatePlanPlugin валидирует структуру provides/dependsOn', () => {
      expect(validatePlanPlugin<TestSlotMap>(null)).toBe(false);
      expect(validatePlanPlugin<TestSlotMap>({ provides: 'slot1' })).toBe(false);
      expect(validatePlanPlugin<TestSlotMap>({ provides: [] })).toBe(false);
      expect(validatePlanPlugin<TestSlotMap>({ provides: ['slot1'], dependsOn: ['slot2'] })).toBe(
        true,
      );
      expect(validatePlanPlugin<TestSlotMap>({ provides: ['slot1'], dependsOn: [''] })).toBe(false);
    });

    it('validatePlugin валидирует runtime-контракт StagePlugin', () => {
      expect(validatePlugin<TestSlotMap>(null)).toBe(false);
      expect(validatePlugin<TestSlotMap>({ provides: ['slot1'] })).toBe(false);
      expect(
        validatePlugin<TestSlotMap>({
          provides: ['slot1'],
          run: async () => ({ ok: true, slots: {} }),
        }),
      ).toBe(true);
      expect(
        validatePlugin<TestSlotMap>({
          provides: ['slot1'],
          run: async () => ({ ok: true, slots: {} }),
          dependsOn: 'bad',
        }),
      ).toBe(false);
      expect(
        validatePlugin<TestSlotMap>({
          provides: ['slot1'],
          run: async () => ({ ok: true, slots: {} }),
          onError: 'bad',
        }),
      ).toBe(false);
    });

    it('validatePipelineConfig покрывает optional поля и fallback/abortSignal', () => {
      const abortController = new AbortController();
      const validFallback = defineFallback<TestSlotMap>()({
        provides: [] as const,
        async run() {
          return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('fallback') } };
        },
      });

      expect(validatePipelineConfig<TestSlotMap>({
        now: () => Date.now(),
        maxExecutionTimeMs: 1,
        maxStages: 1,
        maxDependencies: 1,
        maxDepth: 1,
        maxFanOut: 1,
        maxFanIn: 1,
        maxParallelStages: 1,
        allowParallelExecution: true,
        allowLazyEvaluation: false,
        allowPartialRecompute: true,
        strictSlotCheck: false,
        abortSignal: abortController.signal,
        fallbackStage: validFallback,
      })).toBe(true);

      expect(validatePipelineConfig<TestSlotMap>(null)).toBe(false);
      expect(validatePipelineConfig<TestSlotMap>({ fallbackStage: null })).toBe(false);
      expect(validatePipelineConfig<TestSlotMap>({ abortSignal: {} })).toBe(false);
      expect(validatePipelineConfig<TestSlotMap>({ maxStages: 0 })).toBe(false);
      expect(validatePipelineConfig<TestSlotMap>({ allowParallelExecution: 'yes' })).toBe(false);
      expect(
        validatePipelineConfig<TestSlotMap>({
          fallbackStage: {
            provides: [] as const,
            run: async () => ({ ok: false, reason: { kind: 'CANCELLED' } }),
          },
        }),
      ).toBe(false);
      expect(
        validatePipelineConfig<TestSlotMap>({
          fallbackStage: {
            provides: [] as const,
            isFallback: true as const,
            run: async () => ({ ok: false, reason: { kind: 'CANCELLED' } }),
            onError: async () => ({ ok: false, reason: { kind: 'CANCELLED' } }),
          },
        }),
      ).toBe(true);
      expect(
        validatePipelineConfig<TestSlotMap>({
          fallbackStage: {
            provides: [] as const,
            isFallback: true as const,
            run: async () => ({ ok: false, reason: { kind: 'CANCELLED' } }),
            onError: 'bad' as unknown as never,
          },
        }),
      ).toBe(false);
    });
  });

  describe('Hash Generation', () => {
    it('генерирует разные хеши для разных планов', () => {
      const plugins1 = [createValidPlugin('stage1')];
      const plugins2 = [createValidPlugin('stage2')];
      const config = createValidConfig();

      const result1 = createExecutionPlan(plugins1, config) as ExecutionPlan<TestSlotMap>;
      const result2 = createExecutionPlan(plugins2, config) as ExecutionPlan<TestSlotMap>;

      expect(result1.version).not.toBe(result2.version);
      expect(result1.version).toMatch(/^[a-z0-9_]+$/); // Хеш может содержать буквы, цифры и подчеркивания
      expect(result2.version).toMatch(/^[a-z0-9_]+$/);
    });

    it('генерирует одинаковые хеши для идентичных планов', () => {
      const plugins1 = [createValidPlugin('stage1')];
      const plugins2 = [createValidPlugin('stage1')];
      const config = createValidConfig();

      const result1 = createExecutionPlan(plugins1, config) as ExecutionPlan<TestSlotMap>;
      const result2 = createExecutionPlan(plugins2, config) as ExecutionPlan<TestSlotMap>;

      expect(result1.version).toBe(result2.version);
    });

    it('генерирует StageId по structural hash, если plugin.id не задан', () => {
      const pluginWithoutExplicitId = defineStage<TestSlotMap>()({
        provides: ['slot1' as any],
        async run() {
          return { ok: true, slots: { slot1: 'value' } as any };
        },
      });
      const result = createExecutionPlan([pluginWithoutExplicitId], createValidConfig());
      expect(result).not.toHaveProperty('kind');
      const plan = result as ExecutionPlan<TestSlotMap>;
      expect(plan.executionOrder[0]).toMatch(/^stage_[0-9a-f]{16}$/);
    });

    it('использует fallback-хеширование при недоступном crypto (defensive path)', async () => {
      vi.resetModules();
      vi.doMock('crypto', () => {
        throw new Error('crypto unavailable');
      });

      const { createExecutionPlan: createExecutionPlanWithFallback } = await import(
        '../../src/pipeline/plan.js'
      );
      const pluginWithoutExplicitId = defineStage<TestSlotMap>()({
        provides: ['slot1' as any],
        async run() {
          return { ok: true, slots: { slot1: 'value' } as any };
        },
      });

      const result = createExecutionPlanWithFallback(
        [pluginWithoutExplicitId],
        createValidConfig(),
      );
      expect(result).not.toHaveProperty('kind');
      const plan = result as ExecutionPlan<TestSlotMap>;
      expect(plan.executionOrder[0]).toMatch(/^stage_[0-9a-f]{16}$/);

      vi.doUnmock('crypto');
      vi.resetModules();
    });
  });

  describe('Limits Validation', () => {
    it('возвращает INVALID_CONFIG при превышении maxStages', () => {
      // Создаем много плагинов для превышения лимита
      const plugins = Array.from({ length: 101 }, (_, i) => createValidPlugin(`stage${i}`));
      const config = { ...createValidConfig(), maxStages: 100 };

      const result = createExecutionPlan(plugins, config);

      expect(result).toEqual({
        kind: 'INVALID_CONFIG',
        reason: 'Too many plugins: 101 exceeds maximum 100',
      });
    });

    it('работает с кастомными лимитами', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = {
        ...createValidConfig(),
        maxStages: 50,
        maxDependencies: 100,
        maxDepth: 20,
        maxFanOut: 10,
        maxFanIn: 10,
      };

      const result = createExecutionPlan(plugins, config);

      expect(result).not.toHaveProperty('kind');
    });
  });

  describe('createExecutionPlan', () => {
    it('возвращает ExecutionPlan для корректных плагинов без зависимостей', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).not.toHaveProperty('kind');
      expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toEqual(['stage1']);
      expect((result as ExecutionPlan<TestSlotMap>).stages).toHaveProperty('stage1');
    });

    it('возвращает ExecutionPlan для плагинов с зависимостями', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
        createValidPlugin('stage2', ['slot2'], ['slot1']),
      ];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).not.toHaveProperty('kind');
      expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toEqual(['stage1', 'stage2']);
    });

    it('возвращает NO_PLUGINS при пустом массиве плагинов', () => {
      const plugins: StagePlugin<TestSlotMap>[] = [];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toEqual({ kind: 'NO_PLUGINS' });
    });

    it('возвращает DUPLICATE_PROVIDERS при дублированных провайдерах', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
        createValidPlugin('stage2', ['slot1'], []),
      ];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toEqual({
        kind: 'DUPLICATE_PROVIDERS',
        slot: 'slot1' as any,
        stageIds: ['stage1' as any, 'stage2' as any],
      });
    });

    it('возвращает UNKNOWN_SLOT при неизвестной зависимости', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], ['unknown_slot' as any]),
      ];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toEqual({
        kind: 'UNKNOWN_SLOT',
        slot: 'unknown_slot',
        stageId: 'stage1',
      });
    });

    it('возвращает CIRCULAR_DEPENDENCY при циклической зависимости', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], ['slot2']),
        createValidPlugin('stage2', ['slot2'], ['slot1']),
      ];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toHaveProperty('kind', 'CIRCULAR_DEPENDENCY');
      expect((result as ExecutionPlanError).kind).toBe('CIRCULAR_DEPENDENCY');
    });
  });

  describe('createExecutionPlanSafe', () => {
    it('возвращает ExecutionPlan для корректных плагинов', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();

      const result = createExecutionPlanSafe(plugins, config);

      expect(result).not.toHaveProperty('kind');
      expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toEqual(['stage1']);
    });

    it('возвращает ExecutionPlanError при ошибке', () => {
      const plugins: StagePlugin<TestSlotMap>[] = [];
      const config = createValidConfig();

      const result = createExecutionPlanSafe(plugins, config);

      expect(result).toEqual({ kind: 'NO_PLUGINS' });
    });
  });

  describe('createExecutionPlanOrThrow', () => {
    it('возвращает ExecutionPlan для корректных плагинов', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();

      const result = createExecutionPlanOrThrow(plugins, config);

      expect(result.executionOrder).toEqual(['stage1']);
    });

    it('выбрасывает исключение при ошибке', () => {
      const plugins: StagePlugin<TestSlotMap>[] = [];
      const config = createValidConfig();

      expect(() => {
        createExecutionPlanOrThrow(plugins, config);
      }).toThrow('Построение плана выполнения не удалось: плагины не предоставлены');
    });

    it('выбрасывает исключение с правильным сообщением для DUPLICATE_PROVIDERS', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1']),
        createValidPlugin('stage2', ['slot1']),
      ];
      const config = createValidConfig();

      expect(() => {
        createExecutionPlanOrThrow(plugins, config);
      }).toThrow(
        'Построение плана выполнения не удалось: слот "slot1" предоставляется несколькими стадиями (stage1, stage2)',
      );
    });

    it('выбрасывает исключение с правильным сообщением для UNKNOWN_SLOT', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], ['unknown_slot' as keyof TestSlotMap]),
      ];
      const config = createValidConfig();

      expect(() => {
        createExecutionPlanOrThrow(plugins, config);
      }).toThrow(
        'Построение плана выполнения не удалось: стадия "stage1" зависит от неизвестного слота "unknown_slot"',
      );
    });

    it('выбрасывает исключение с правильным сообщением для CIRCULAR_DEPENDENCY', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], ['slot2']),
        createValidPlugin('stage2', ['slot2'], ['slot1']),
      ];
      const config = createValidConfig();

      expect(() => {
        createExecutionPlanOrThrow(plugins, config);
      }).toThrow(/Построение плана выполнения не удалось: обнаружена циклическая зависимость/);
    });

    it('выбрасывает исключение с правильным сообщением для INVALID_CONFIG', () => {
      const plugins = Array.from({ length: 101 }, (_, i) => createValidPlugin(`stage${i}`));
      const config = { ...createValidConfig(), maxStages: 100 };

      expect(() => {
        createExecutionPlanOrThrow(plugins, config);
      }).toThrow(
        'Построение плана выполнения не удалось: некорректная конфигурация (Too many plugins: 101 exceeds maximum 100)',
      );
    });

    it('выбрасывает исключение с правильным сообщением для INVALID_PLUGIN', () => {
      const invalidPlugin = {
        provides: [],
        async run() {
          return { ok: true, slots: {} };
        },
      } as any;
      const plugins = [invalidPlugin];
      const config = createValidConfig();

      expect(() => {
        createExecutionPlanOrThrow(plugins, config);
      }).toThrow(/Построение плана выполнения не удалось: некорректный плагин/);
    });
  });

  describe('Complex Scenarios', () => {
    it('работает с глубокими зависимостями', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
        createValidPlugin('stage2', ['slot2'], ['slot1']),
        createValidPlugin('stage3', ['slot3'], ['slot2']),
        createValidPlugin('stage4', ['slot4'], ['slot3']),
      ];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).not.toHaveProperty('kind');
      expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toEqual([
        'stage1',
        'stage2',
        'stage3',
        'stage4',
      ]);
    });

    it('работает с несколькими независимыми цепочками', () => {
      const plugins = [
        createValidPlugin('chain1_stage1', ['slot1'], []),
        createValidPlugin('chain1_stage2', ['slot2'], ['slot1']),
        createValidPlugin('chain2_stage1', ['slot3'], []),
        createValidPlugin('chain2_stage2', ['slot4'], ['slot3']),
      ];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).not.toHaveProperty('kind');
      const executionOrder = (result as ExecutionPlan<TestSlotMap>).executionOrder;
      // Порядок может варьироваться, но должен быть топологически корректным
      expect(executionOrder).toContain('chain1_stage1');
      expect(executionOrder).toContain('chain1_stage2');
      expect(executionOrder).toContain('chain2_stage1');
      expect(executionOrder).toContain('chain2_stage2');
      expect(executionOrder.indexOf('chain1_stage1' as any)).toBeLessThan(
        executionOrder.indexOf('chain1_stage2' as any),
      );
      expect(executionOrder.indexOf('chain2_stage1' as any)).toBeLessThan(
        executionOrder.indexOf('chain2_stage2' as any),
      );
    });

    it('работает с fallback стадией', () => {
      const plugins = [createValidPlugin('stage1')];
      const fallback = createValidFallback();
      const config = createValidConfig(fallback);

      const result = createExecutionPlan(plugins, config);

      expect(result).not.toHaveProperty('kind');
      expect((result as ExecutionPlan<TestSlotMap>).fallbackStage).toBeDefined();
    });

    it('работает с большим количеством плагинов', () => {
      const plugins = Array.from(
        { length: 50 },
        (_, i) =>
          createValidPlugin(`stage${i}`, [`slot${i}` as any], i > 0 ? [`slot${i - 1}` as any] : []),
      );
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).not.toHaveProperty('kind');
      expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toHaveLength(50);
    });

    it('работает с очень большим количеством стадий (ветка heap queue)', () => {
      const plugins = Array.from({ length: 1001 }, (_, index) =>
        defineStage<TestSlotMap>()({
          id: `big_${index}` as any,
          provides: [`slot_${index}` as any] as any,
          dependsOn: index === 0 ? [] : ([`slot_${index - 1}` as any] as any),
          async run() {
            return { ok: true, slots: {} as any };
          },
        }));

      const result = createExecutionPlan(plugins, { ...createValidConfig(), maxStages: 2000 });
      expect(result).not.toHaveProperty('kind');
      expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toHaveLength(1001);
    });

    it('работает с большим количеством независимых стадий (heap bubble ветки)', () => {
      const shuffledIds = Array.from({ length: 1001 }, (_, index) => `z_stage_${1000 - index}`);
      const plugins = shuffledIds.map((id, index) =>
        defineStage<TestSlotMap>()({
          id: id as any,
          provides: [`wide_slot_${index}` as any] as any,
          async run() {
            return { ok: true, slots: {} as any };
          },
        })
      );

      const result = createExecutionPlan(plugins, { ...createValidConfig(), maxStages: 2000 });
      expect(result).not.toHaveProperty('kind');
      const plan = result as ExecutionPlan<TestSlotMap>;
      expect(plan.executionOrder).toHaveLength(1001);
      expect(plan.executionOrder[0]).toBe('z_stage_0');
    });

    it('выявляет некорректный sparse-массив плагинов (defensive case)', () => {
      const sparsePlugins = new Array(2) as StagePlugin<TestSlotMap>[];
      // eslint-disable-next-line fp/no-mutation
      sparsePlugins[1] = createValidPlugin('stage_sparse', ['slot1'], []);

      expect(() => {
        createExecutionPlan(sparsePlugins, createValidConfig());
      }).toThrow();
    });

    it('работает с ограничением глубины зависимостей', () => {
      const plugins = Array.from(
        { length: 10 },
        (_, i) =>
          createValidPlugin(`stage${i}`, [`slot${i}` as any], i > 0 ? [`slot${i - 1}` as any] : []),
      );
      const config = { ...createValidConfig(), maxDepth: 5 };

      const result = createExecutionPlan(plugins, config);

      // Глубина 9 превышает maxDepth 5, должна вернуться ошибка
      expect(result).toHaveProperty('kind', 'INVALID_CONFIG');
      expect((result as any).reason).toContain('Depth limit exceeded');
    });

    it('возвращает UNKNOWN_SLOT при неизвестной зависимости в цепочке', () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
        createValidPlugin('stage2', ['slot2' as any], ['unknown_slot' as keyof TestSlotMap]),
      ];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toHaveProperty('kind', 'UNKNOWN_SLOT');
    });

    it('работает с ограничением количества зависимостей', () => {
      const plugins: StagePlugin<TestSlotMap>[] = [];
      // Создаем плагины с множественными зависимостями
      plugins.push(createValidPlugin('provider1', ['slot1'], []));
      plugins.push(createValidPlugin('provider2', ['slot2'], []));
      plugins.push(createValidPlugin('consumer', ['slot3' as any], ['slot1', 'slot2']));

      const config = { ...createValidConfig(), maxDependencies: 1 };

      const result = createExecutionPlan(plugins, config);

      // У consumer есть 2 зависимости, что превышает maxDependencies 1
      expect(result).toHaveProperty('kind', 'INVALID_CONFIG');
      if ('reason' in result) {
        expect((result as any).reason).toContain('Too many dependencies');
      }
    });

    it('работает с ограничением fan-out', () => {
      // Создаем один провайдер и много потребителей
      const plugins = [
        createValidPlugin('provider', ['slot1'], []),
        ...Array.from(
          { length: 5 },
          (_, i) => createValidPlugin(`consumer${i}`, [`slot_consumer${i}` as any], ['slot1']),
        ),
      ];

      const config = { ...createValidConfig(), maxFanOut: 2 };

      const result = createExecutionPlan(plugins, config);

      // Provider имеет fan-out 5, что превышает maxFanOut 2
      expect(result).toHaveProperty('kind', 'INVALID_CONFIG');
      if ('reason' in result) {
        expect((result as any).reason).toContain('Fan-out limit exceeded');
      }
    });

    it('работает с ограничением fan-in', () => {
      // Создаем много провайдеров и одного потребителя
      const plugins = [
        ...Array.from(
          { length: 5 },
          (_, i) => createValidPlugin(`provider${i}`, [`slot${i}` as any], []),
        ),
        createValidPlugin('consumer', ['result' as any], [
          'slot0' as any,
          'slot1' as any,
          'slot2' as any,
          'slot3' as any,
          'slot4' as any,
        ]),
      ];

      const config = { ...createValidConfig(), maxFanIn: 2 };

      const result = createExecutionPlan(plugins, config);

      // Consumer имеет fan-in 5, что превышает maxFanIn 2
      expect(result).toHaveProperty('kind', 'INVALID_CONFIG');
      if ('reason' in result) {
        expect((result as any).reason).toContain('Fan-in limit exceeded');
      }
    });

    it('возвращает ошибку при дублированных stageId', () => {
      const plugin1 = defineStage<TestSlotMap>()({
        id: 'duplicate' as any,
        provides: ['slot1' as any],
        async run() {
          return { ok: true, slots: { slot1: 'value1' } };
        },
      });
      const plugin2 = defineStage<TestSlotMap>()({
        id: 'duplicate' as any,
        provides: ['slot2' as any],
        async run() {
          return { ok: true, slots: { slot2: 42 } };
        },
      });

      const plugins = [plugin1, plugin2];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toHaveProperty('kind', 'INVALID_PLUGIN');
      if ('reason' in result) {
        expect((result as any).reason).toContain('Duplicate stageId');
      }
    });

    it('возвращает ошибку при плагине с пустым provides', () => {
      const invalidPlugin = {
        provides: [],
        run: () => ({ ok: true, slots: {} }),
      };
      const plugins = [invalidPlugin as any];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toHaveProperty('kind', 'INVALID_PLUGIN');
      if ('reason' in result) {
        expect(result.reason).toContain('has empty provides array');
      }
    });

    it('возвращает ошибку при плагине без run функции', () => {
      const invalidPlugin = {
        provides: ['slot1'],
        // нет run функции
      };
      const plugins = [invalidPlugin as any];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toHaveProperty('kind', 'INVALID_PLUGIN');
      if ('reason' in result) {
        expect(result.reason).toContain('Plugin does not match StagePlugin interface');
      }
    });

    it('возвращает ошибку при плагине с пустыми именами слотов', () => {
      const invalidPlugin = {
        provides: ['', 'slot1'],
        run: () => ({ ok: true, slots: {} }),
      };
      const plugins = [invalidPlugin as any];
      const config = createValidConfig();

      const result = createExecutionPlan(plugins, config);

      expect(result).toHaveProperty('kind', 'INVALID_PLUGIN');
      if ('reason' in result) {
        expect(result.reason).toContain('has empty slot names in provides');
      }
    });
  });

  it('возвращает ошибку при плагине с дублированными слотами', () => {
    const invalidPlugin = {
      provides: ['slot1', 'slot1'],
      run: () => ({ ok: true, slots: {} }),
    };
    const plugins = [invalidPlugin as any];
    const config = createValidConfig();

    const result = createExecutionPlan(plugins, config);

    expect(result).toHaveProperty('kind', 'INVALID_PLUGIN');
    if ('reason' in result) {
      expect(result.reason).toContain('has duplicate provides slots');
    }
  });

  it('работает с плагинами, которые предоставляют и потребляют слоты', () => {
    const plugins = [
      createValidPlugin('stage1', ['slot1'], []),
      createValidPlugin('stage2', ['slot2'], ['slot1']),
      createValidPlugin('stage3', ['slot3'], ['slot2']),
    ];
    const config = createValidConfig();

    const result = createExecutionPlan(plugins, config);

    expect(result).not.toHaveProperty('kind');
    expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toEqual([
      'stage1',
      'stage2',
      'stage3',
    ]);
  });

  // Покрытие строки 705: continue когда узел уже обработан (!unprocessed.has(dep))
  it('покрывает ветку continue для уже обработанных узлов в buildCyclePath (строка 705)', () => {
    // Создаем граф с циклом, где один из узлов уже обработан
    // stage1 -> stage2 -> stage1 (цикл)
    // stage3 -> stage1 (stage1 уже в unprocessed, но может быть обработан в другом контексте)
    const plugins = [
      createValidPlugin('stage1', ['slot1'], ['slot2']),
      createValidPlugin('stage2', ['slot2'], ['slot1']), // Цикл stage1 <-> stage2
      createValidPlugin('stage3', ['slot3'], ['slot1']), // stage3 зависит от stage1
    ];
    const config = createValidConfig();

    const result = createExecutionPlan(plugins, config);

    // Должен быть обнаружен цикл
    expect(result).toHaveProperty('kind', 'CIRCULAR_DEPENDENCY');
    if ('path' in result) {
      expect(result.path.length).toBeGreaterThan(0);
    }
  });

  // Покрытие строк 723-726: нормальное завершение DFS без цикла
  // Это происходит когда в графе есть несколько компонентов связности,
  // и один из них не имеет цикла, но buildCyclePath все равно вызывается
  it('покрывает нормальное завершение DFS без цикла в buildCyclePath (строки 723-726)', () => {
    // Создаем граф с несколькими компонентами:
    // - stage1 -> stage2 (без цикла, но будет проверен)
    // - stage3 -> stage4 -> stage3 (с циклом)
    const plugins = [
      createValidPlugin('stage1', ['slot1'], []),
      createValidPlugin('stage2', ['slot2'], ['slot1']), // Линейная цепочка без цикла
      createValidPlugin('stage3', ['slot3'], ['slot4']),
      createValidPlugin('stage4', ['slot4'], ['slot3']), // Цикл stage3 <-> stage4
    ];
    const config = createValidConfig();

    const result = createExecutionPlan(plugins, config);

    // Должен быть обнаружен цикл в stage3 <-> stage4
    expect(result).toHaveProperty('kind', 'CIRCULAR_DEPENDENCY');
    if ('path' in result) {
      expect(result.path).toContain('stage3');
      expect(result.path).toContain('stage4');
    }
  });

  // Покрытие строки 731: continue когда узел уже посещен в основном цикле
  it('покрывает ветку continue для уже посещенных узлов в buildCyclePath (строка 731)', () => {
    // Создаем граф с несколькими узлами, где некоторые уже будут посещены
    // при обходе первого узла, а затем будут пропущены в основном цикле
    const plugins = [
      createValidPlugin('stage1', ['slot1'], ['slot2']),
      createValidPlugin('stage2', ['slot2'], ['slot3']),
      createValidPlugin('stage3', ['slot3'], ['slot1']), // Цикл stage1 -> stage2 -> stage3 -> stage1
      createValidPlugin('stage4', ['slot4'], ['slot1']), // stage4 тоже зависит от stage1
    ];
    const config = createValidConfig();

    const result = createExecutionPlan(plugins, config);

    // Должен быть обнаружен цикл
    expect(result).toHaveProperty('kind', 'CIRCULAR_DEPENDENCY');
    if ('path' in result) {
      expect(result.path.length).toBeGreaterThan(0);
    }
  });
});
