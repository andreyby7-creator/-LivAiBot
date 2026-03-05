/**
 * @file Unit тесты для Pipeline Engine (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPipelineEngine, executePipeline } from '../../src/pipeline/engine.js';
import type { ExecutionPlan } from '../../src/pipeline/plan.js';
import type { FallbackStage, PipelineConfig, StagePlugin } from '../../src/pipeline/plugin-api.js';

const mockCreateExecutionPlan = vi.fn();
const mockValidatePipelineConfig = vi.fn();

vi.mock('../../src/pipeline/plan.js', () => ({
  createExecutionPlan: (...args: unknown[]) => mockCreateExecutionPlan(...args),
}));

vi.mock('../../src/pipeline/plugin-api.js', () => ({
  validatePipelineConfig: (...args: unknown[]) => mockValidatePipelineConfig(...args),
}));

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
  shouldFail = false,
): StagePlugin<TestSlotMap> {
  return {
    id: stageId as any,
    provides: provides as any,
    dependsOn: dependsOn as any,
    async run() {
      if (shouldFail) {
        return { ok: false, reason: { kind: 'EXECUTION_ERROR', error: new Error('Test failure') } };
      }

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
  } as StagePlugin<TestSlotMap>;
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

function createPlan(
  plugins: readonly StagePlugin<TestSlotMap>[],
  executionOrder: readonly string[],
  dependencies: Readonly<Record<string, readonly string[]>> = {},
): ExecutionPlan<TestSlotMap> {
  const stages = Object.fromEntries(
    plugins.map((plugin) => [String(plugin.id), plugin]),
  ) as Readonly<Record<string, StagePlugin<TestSlotMap>>>;

  const stageIndex = Object.fromEntries(
    executionOrder.map((stageId, index) => [stageId, index]),
  ) as Readonly<Record<string, number>>;

  const reverseDependencies = executionOrder.reduce((acc, id) => {
    // eslint-disable-next-line fp/no-mutation
    acc[id] = [];
    return acc;
  }, {} as Record<string, readonly string[]>);

  Object.entries(dependencies).forEach(([stageId, deps]) => {
    deps.forEach((dep) => {
      // eslint-disable-next-line fp/no-mutation
      reverseDependencies[dep] = [...(reverseDependencies[dep] ?? []), stageId];
    });
  });

  return {
    executionOrder: executionOrder as any,
    stageIndex: stageIndex as any,
    version: 'test_version',
    stages: stages as any,
    dependencies: dependencies as any,
    reverseDependencies: reverseDependencies as any,
  };
}

function buildPlanFromPlugins(
  plugins: readonly StagePlugin<TestSlotMap>[],
): ExecutionPlan<TestSlotMap> {
  const executionOrder = plugins.map((plugin, index) => String(plugin.id ?? `stage_${index}`));
  const providerBySlot = new Map<string, string>();
  plugins.forEach((plugin, index) => {
    const stageId = String(plugin.id ?? `stage_${index}`);
    plugin.provides.forEach((slot) => {
      providerBySlot.set(String(slot), stageId);
    });
  });
  const dependencies = Object.fromEntries(
    plugins.map((plugin, index) => {
      const stageId = String(plugin.id ?? `stage_${index}`);
      const deps = (plugin.dependsOn ?? [])
        .map((slot) => providerBySlot.get(String(slot)))
        .filter((dep): dep is string => dep !== undefined);
      return [stageId, deps];
    }),
  ) as Readonly<Record<string, readonly string[]>>;

  return createPlan(plugins, executionOrder, dependencies);
}

/* ============================================================================
 * 🧪 TESTS
 * ============================================================================
 */

describe('Pipeline Engine', () => {
  beforeEach(() => {
    mockValidatePipelineConfig.mockReset();
    mockCreateExecutionPlan.mockReset();
    mockValidatePipelineConfig.mockReturnValue(true);
    mockCreateExecutionPlan.mockImplementation((plugins: readonly StagePlugin<TestSlotMap>[]) =>
      buildPlanFromPlugins(plugins)
    );
  });

  describe('createPipelineEngine', () => {
    it('возвращает ExecutionPlan для корректных плагинов', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();

      const result = createPipelineEngine(plugins as any, config);

      expect(result).not.toHaveProperty('ok');
      expect((result as ExecutionPlan<TestSlotMap>).executionOrder).toEqual(['stage1']);
    });

    it('возвращает INVALID_CONFIG при некорректной конфигурации', () => {
      const plugins = [createValidPlugin('stage1')];
      const invalidConfig = { maxStages: -1 };
      mockValidatePipelineConfig.mockReturnValue(false);

      const result = createPipelineEngine(plugins as any, invalidConfig as any);

      expect(result).toEqual({
        ok: false,
        reason: {
          kind: 'INVALID_CONFIG',
          reason: 'Pipeline configuration is invalid',
        },
      });
    });

    it('возвращает ошибку при дублированных провайдерах', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();
      mockCreateExecutionPlan.mockReturnValue({
        kind: 'DUPLICATE_PROVIDERS',
        slot: 'slot1',
        stageIds: ['stage1', 'stage2'],
      });

      const result = createPipelineEngine(plugins as any, config);

      expect(result).toHaveProperty('ok', false);
      expect((result as any).reason.kind).toBe('DUPLICATE_PROVIDERS');
    });

    it('работает с fallback стадией', () => {
      const plugins = [createValidPlugin('stage1')];
      const fallback = createValidFallback();
      const config = createValidConfig(fallback);
      const plan = buildPlanFromPlugins(plugins);
      mockCreateExecutionPlan.mockReturnValue({
        ...plan,
        fallbackStage: fallback,
      });

      const result = createPipelineEngine(plugins as any, config);

      expect(result).not.toHaveProperty('ok');
      expect((result as ExecutionPlan<TestSlotMap>).fallbackStage).toBeDefined();
    });

    it('возвращает NO_PLUGINS при пустом массиве плагинов', () => {
      const plugins: StagePlugin<TestSlotMap>[] = [];
      const config = createValidConfig();
      mockCreateExecutionPlan.mockReturnValue({ kind: 'NO_PLUGINS' });

      const result = createPipelineEngine(plugins as any, config);

      expect(result).toEqual({
        ok: false,
        reason: { kind: 'NO_PLUGINS' },
      });
    });

    it('возвращает UNKNOWN_SLOT при неизвестной зависимости', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();
      mockCreateExecutionPlan.mockReturnValue({
        kind: 'UNKNOWN_SLOT',
        slot: 'unknown_slot',
        stageId: 'stage1',
      });

      const result = createPipelineEngine(plugins as any, config);

      expect(result).toHaveProperty('ok', false);
      expect((result as any).reason.kind).toBe('UNKNOWN_SLOT');
    });

    it('возвращает CIRCULAR_DEPENDENCY при циклической зависимости', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();
      mockCreateExecutionPlan.mockReturnValue({
        kind: 'CIRCULAR_DEPENDENCY',
        path: ['stage1', 'stage2', 'stage1'],
      });

      const result = createPipelineEngine(plugins as any, config);

      expect(result).toHaveProperty('ok', false);
      expect((result as any).reason.kind).toBe('CIRCULAR_DEPENDENCY');
    });

    it('возвращает INVALID_PLUGIN при некорректном плагине', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();
      mockCreateExecutionPlan.mockReturnValue({
        kind: 'INVALID_PLUGIN',
        stageId: 'stage1',
        reason: 'invalid plugin',
      });

      const result = createPipelineEngine(plugins as any, config);

      expect(result).toHaveProperty('ok', false);
      expect((result as any).reason.kind).toBe('STAGE_FAILED');
    });

    it('маппит INVALID_CONFIG из plan в PipelineFailureReason', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();
      mockCreateExecutionPlan.mockReturnValue({
        kind: 'INVALID_CONFIG',
        reason: 'invalid limits',
      });

      const result = createPipelineEngine(plugins as any, config);

      expect(result).toEqual({
        ok: false,
        reason: {
          kind: 'INVALID_CONFIG',
          reason: 'invalid limits',
        },
      });
    });

    it('defensive: пробрасывает неизвестный kind из createExecutionPlan', () => {
      const plugins = [createValidPlugin('stage1')];
      const config = createValidConfig();
      mockCreateExecutionPlan.mockReturnValue({ kind: 'FUTURE_KIND' });

      const result = createPipelineEngine(plugins as any, config);
      expect((result as any).ok).toBe(false);
      expect((result as any).reason.kind).toBe('FUTURE_KIND');
    });
  });

  describe('executePipeline', () => {
    it('выполняет pipeline последовательно с корректными плагинами', async () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
        createValidPlugin('stage2', ['slot2'], ['slot1']),
      ];
      const config = createValidConfig();
      const engine = buildPlanFromPlugins(plugins);

      const result = await executePipeline(engine, config);

      expect(result.ok).toBe(true);
      expect((result as any).slots.slot1).toBe('result_stage1');
      expect((result as any).slots.slot2).toBe(42);
    });

    it('выполняет pipeline параллельно при allowParallelExecution: true', async () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
        createValidPlugin('stage2', ['slot2'], []),
        createValidPlugin('stage3', ['slot3'], ['slot1', 'slot2']),
      ];
      const config = { ...createValidConfig(), allowParallelExecution: true };
      const engine = buildPlanFromPlugins(plugins);

      const result = await executePipeline(engine, config);

      expect(result.ok).toBe(true);
      expect((result as any).slots.slot1).toBe('result_stage1');
      expect((result as any).slots.slot2).toBe(42);
      expect((result as any).slots.slot3).toBe(true);
    });

    it('выполняет pipeline параллельно батчами при maxParallelStages', async () => {
      const plugins = Array.from(
        { length: 60 },
        (_, i) => createValidPlugin(`stage_${i}`, ['slot1'], []),
      );
      const executionOrder = plugins.map((p) => String(p.id));
      const dependencies = Object.fromEntries(executionOrder.map((id) => [id, []])) as Record<
        string,
        readonly string[]
      >;
      const plan = createPlan(plugins, executionOrder, dependencies);
      const config = {
        ...createValidConfig(),
        allowParallelExecution: true,
        maxParallelStages: 10,
      };

      const result = await executePipeline(plan, config);

      expect(result.ok).toBe(true);
      expect((result as any).slots.slot1).toBeDefined();
    });

    it('возвращает ошибку при провале стадии', async () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], [], false),
        createValidPlugin('stage2', ['slot2'], ['slot1'], true), // Эта стадия падает
      ];
      const config = createValidConfig();
      const engine = buildPlanFromPlugins(plugins);

      const result = await executePipeline(engine, config);

      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('STAGE_FAILED');
    });

    it('выполняет fallbackStage в последовательном режиме при ошибке стадии', async () => {
      const fallbackRun = vi.fn(async () => ({
        ok: false,
        reason: { kind: 'CANCELLED' as const },
      }));
      const failingPlugin = createValidPlugin('seq_fail', ['slot1'], [], true);
      const plan = {
        ...createPlan([failingPlugin], ['seq_fail'], { seq_fail: [] }),
        fallbackStage: {
          provides: [] as const,
          isFallback: true as const,
          run: fallbackRun,
        } as FallbackStage<TestSlotMap>,
      } as ExecutionPlan<TestSlotMap>;

      const result = await executePipeline(plan, createValidConfig());
      expect(result.ok).toBe(false);
      expect(fallbackRun).toHaveBeenCalled();
    });

    it('использует onError recovery при исключении в run', async () => {
      const recoverPlugin: StagePlugin<TestSlotMap> = {
        id: 'recover' as any,
        provides: ['slot1'] as any,
        async run() {
          throw new Error('boom');
        },
        onError() {
          return { ok: true, slots: { slot1: 'recovered' } as any };
        },
      };
      const plan = createPlan([recoverPlugin], ['recover'], { recover: [] });

      const result = await executePipeline(plan, createValidConfig());
      expect(result.ok).toBe(true);
      expect((result as any).slots.slot1).toBe('recovered');
    });

    it('возвращает ошибку при throw без onError (unhandled path)', async () => {
      const plugin: StagePlugin<TestSlotMap> = {
        id: 'throw_no_hook' as any,
        provides: ['slot1'] as any,
        async run() {
          throw new Error('boom');
        },
      };
      const plan = createPlan([plugin], ['throw_no_hook'], { throw_no_hook: [] });
      const result = await executePipeline(plan, createValidConfig());

      expect(result.ok).toBe(false);
      expect((result as any).reason.reason.kind).toBe('EXECUTION_ERROR');
    });

    it('возвращает ошибку когда onError возвращает undefined (unhandled recovery)', async () => {
      const plugin: StagePlugin<TestSlotMap> = {
        id: 'throw_hook_undefined' as any,
        provides: ['slot1'] as any,
        async run() {
          throw new Error('boom');
        },
        onError() {
          return undefined;
        },
      };
      const plan = createPlan([plugin], ['throw_hook_undefined'], { throw_hook_undefined: [] });
      const result = await executePipeline(plan, createValidConfig());

      expect(result.ok).toBe(false);
      expect((result as any).reason.reason.kind).toBe('EXECUTION_ERROR');
    });

    it('нормализует non-Error исключения в default execution message', async () => {
      const plugin: StagePlugin<TestSlotMap> = {
        id: 'throw_string' as any,
        provides: ['slot1'] as any,
        async run() {
          throw 'string_failure';
        },
      };
      const plan = createPlan([plugin], ['throw_string'], { throw_string: [] });
      const result = await executePipeline(plan, createValidConfig());

      expect(result.ok).toBe(false);
      expect((result as any).reason.reason.error.message).toBe('Stage execution failed');
    });

    it('возвращает ошибку при исключении в onError hook', async () => {
      const failHookPlugin: StagePlugin<TestSlotMap> = {
        id: 'hook_fail' as any,
        provides: ['slot1'] as any,
        async run() {
          throw new Error('run fail');
        },
        onError() {
          throw new Error('hook fail');
        },
      };
      const plan = createPlan([failHookPlugin], ['hook_fail'], { hook_fail: [] });

      const result = await executePipeline(plan, createValidConfig());
      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('STAGE_FAILED');
      expect((result as any).reason.reason.kind).toBe('EXECUTION_ERROR');
    });

    it('валидирует strictSlotCheck и возвращает SLOT_MISMATCH для лишних слотов', async () => {
      const plugin: StagePlugin<TestSlotMap> = {
        id: 'strict' as any,
        provides: ['slot1'] as any,
        async run() {
          return { ok: true, slots: { slot1: 'ok', slot2: 1 } as any };
        },
      };
      const plan = createPlan([plugin], ['strict'], { strict: [] });
      const config = { ...createValidConfig(), strictSlotCheck: true };

      const result = await executePipeline(plan, config);
      expect(result.ok).toBe(false);
      expect((result as any).reason.reason.kind).toBe('SLOT_MISMATCH');
    });

    it('возвращает SLOT_MISMATCH, когда не возвращен declared slot', async () => {
      const plugin: StagePlugin<TestSlotMap> = {
        id: 'missing_declared' as any,
        provides: ['slot1'] as any,
        async run() {
          return { ok: true, slots: {} as any };
        },
      };
      const plan = createPlan([plugin], ['missing_declared'], { missing_declared: [] });
      const result = await executePipeline(plan, createValidConfig());

      expect(result.ok).toBe(false);
      expect((result as any).reason.reason.kind).toBe('SLOT_MISMATCH');
    });

    it('проходит strictSlotCheck при корректном наборе слотов', async () => {
      const plugin = createValidPlugin('strict_ok', ['slot1'], []);
      const plan = createPlan([plugin], ['strict_ok'], { strict_ok: [] });
      const result = await executePipeline(plan, { ...createValidConfig(), strictSlotCheck: true });

      expect(result.ok).toBe(true);
    });

    it('работает с начальными слотами', async () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
      ];
      const config = createValidConfig();
      const engine = buildPlanFromPlugins(plugins);
      const initialSlots = { slot2: 100 } as const;

      const result = await executePipeline(engine, config, initialSlots);

      expect(result.ok).toBe(true);
      expect((result as any).slots.slot1).toBe('result_stage1');
      expect((result as any).slots.slot2).toBe(100);
    });

    it('поддерживает cancellation через AbortSignal', async () => {
      const abortController = new AbortController();
      const plugins = [createValidPlugin('slow_stage')];
      const config = { ...createValidConfig(), abortSignal: abortController.signal };
      const engine = buildPlanFromPlugins(plugins);

      // Отменяем выполнение сразу
      abortController.abort();

      const result = await executePipeline(engine, config);

      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('STAGE_FAILED');
    });

    it('поддерживает AbortSignal без cancellation (контекст содержит signal)', async () => {
      const abortController = new AbortController();
      const plugins = [createValidPlugin('stage_abort_context')];
      const plan = buildPlanFromPlugins(plugins);
      const config = { ...createValidConfig(), abortSignal: abortController.signal };

      const result = await executePipeline(plan, config);
      expect(result.ok).toBe(true);
    });

    it('возвращает timeout в последовательном режиме', async () => {
      const plugins = [createValidPlugin('stage1')];
      const plan = buildPlanFromPlugins(plugins);
      const now = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValue(10_000);
      const config = { ...createValidConfig(), maxExecutionTimeMs: 1, now };

      const result = await executePipeline(plan, config);
      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('EXECUTION_TIMEOUT');
    });

    it('возвращает timeout в параллельном режиме', async () => {
      const plugins = [createValidPlugin('stage1')];
      const plan = buildPlanFromPlugins(plugins);
      const now = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValue(10_000);
      const config = {
        ...createValidConfig(),
        allowParallelExecution: true,
        maxExecutionTimeMs: 1,
        now,
      };

      const result = await executePipeline(plan, config);
      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('EXECUTION_TIMEOUT');
    });

    it('возвращает cancellation в параллельном режиме через guardChecks', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const plugins = [createValidPlugin('stage_parallel_cancel')];
      const plan = buildPlanFromPlugins(plugins);
      const config = {
        ...createValidConfig(),
        allowParallelExecution: true,
        abortSignal: abortController.signal,
      };

      const result = await executePipeline(plan, config);
      expect(result.ok).toBe(false);
      expect((result as any).reason.reason.kind).toBe('CANCELLED');
    });

    it('возвращает STAGE_FAILED если stage отсутствует в plan.stages', async () => {
      const plugin = createValidPlugin('stage1');
      const plan = createPlan([plugin], ['missing_stage'], { missing_stage: [] });
      const result = await executePipeline(plan, createValidConfig());

      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('STAGE_FAILED');
    });

    it('возвращает INVALID_EXECUTION_PLAN если executionOrder содержит undefined', async () => {
      const plugin = createValidPlugin('stage1');
      const plan = createPlan([plugin], [undefined as any], {} as any);
      const result = await executePipeline(plan, createValidConfig());

      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('INVALID_EXECUTION_PLAN');
    });

    it('в параллельном режиме обрабатывает отсутствующую стадию в graph level', async () => {
      const plugin = createValidPlugin('stage1');
      const plan = createPlan([plugin], ['missing_stage_parallel'], { missing_stage_parallel: [] });
      const result = await executePipeline(plan, {
        ...createValidConfig(),
        allowParallelExecution: true,
      });

      expect(result.ok).toBe(true);
    });

    it('в параллельном режиме использует executionIndex = -1, если stageIndex отсутствует', async () => {
      const plugin = createValidPlugin('missing_index');
      const plan = {
        ...createPlan([plugin], ['missing_index'], { missing_index: [] }),
        stageIndex: {} as any,
      } as ExecutionPlan<TestSlotMap>;

      const result = await executePipeline(plan, {
        ...createValidConfig(),
        allowParallelExecution: true,
      });
      expect(result.ok).toBe(true);
    });

    it('в parallel-level builder покрывает ветки dependencies ?? [] и split level', async () => {
      const stageA = createValidPlugin('stageA', ['slot1'], []);
      const stageB = createValidPlugin('stageB', ['slot2'], ['slot4']); // dependency никогда не будет completed
      const plan = createPlan([stageA, stageB], ['stageA', 'stageB'], {
        stageB: ['missing_stage'],
      });
      const result = await executePipeline(plan, {
        ...createValidConfig(),
        allowParallelExecution: true,
      });

      expect(result.ok).toBe(true);
      expect((result as any).slots.slot1).toBe('result_stageA');
      expect((result as any).slots.slot2).toBe(42);
    });

    it('в параллельном режиме обрабатывает отсутствие plugin в executeStageBatch', async () => {
      const plugin = createValidPlugin('vanish_stage');
      const planBase = createPlan([plugin], ['vanish_stage'], { vanish_stage: [] });
      const accessCountRef = { current: 0 };
      const plan = {
        ...planBase,
        stages: new Proxy(planBase.stages as any, {
          get(target, prop, receiver) {
            if (prop === 'vanish_stage') {
              // eslint-disable-next-line fp/no-mutation
              accessCountRef.current += 1;
              return accessCountRef.current === 1 ? Reflect.get(target, prop, receiver) : undefined;
            }
            return Reflect.get(target, prop, receiver);
          },
        }),
      } as ExecutionPlan<TestSlotMap>;

      const result = await executePipeline(plan, {
        ...createValidConfig(),
        allowParallelExecution: true,
      });
      expect(result.ok).toBe(false);
      expect((result as any).reason.kind).toBe('STAGE_FAILED');
    });

    it('вызывает fallbackStage в параллельном режиме при ошибке стадии', async () => {
      const fallbackRun = vi.fn(async () => ({
        ok: false,
        reason: { kind: 'CANCELLED' as const },
      }));
      const failingPlugin = createValidPlugin('parallel_fail', ['slot1'], [], true);
      const plan = {
        ...createPlan([failingPlugin], ['parallel_fail'], { parallel_fail: [] }),
        fallbackStage: {
          provides: [] as const,
          isFallback: true as const,
          run: fallbackRun,
        } as FallbackStage<TestSlotMap>,
      } as ExecutionPlan<TestSlotMap>;

      const result = await executePipeline(plan, {
        ...createValidConfig(),
        allowParallelExecution: true,
      });
      expect(result.ok).toBe(false);
      expect(fallbackRun).toHaveBeenCalled();
    });

    it('работает с пользовательской функцией now', async () => {
      const mockNow = vi.fn(() => 1234567890);
      const plugins = [createValidPlugin('stage1')];
      const config = { ...createValidConfig(), now: mockNow };
      const engine = buildPlanFromPlugins(plugins);

      const result = await executePipeline(engine, config);

      expect(result.ok).toBe(true);
      expect(mockNow).toHaveBeenCalled();
    });

    it('выполняет pipeline с несколькими независимыми стадиями', async () => {
      const plugins = [
        createValidPlugin('stage1', ['slot1'], []),
        createValidPlugin('stage2', ['slot2'], []),
        createValidPlugin('stage3', ['slot3'], []),
      ];
      const config = createValidConfig();
      const engine = buildPlanFromPlugins(plugins);

      const result = await executePipeline(engine, config);

      expect(result.ok).toBe(true);
      expect((result as any).slots.slot1).toBe('result_stage1');
      expect((result as any).slots.slot2).toBe(42);
      expect((result as any).slots.slot3).toBe(true);
    });
  });
});
