/**
 * @file packages/core/tests/pipeline/facade.test.ts
 * ============================================================================
 * 🧭 CORE — Pipeline Facade Tests (100% Coverage)
 * ============================================================================
 *
 * Полное покрытие всех функций и веток исполнения (100%)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAllowAllRule,
  createAllowedCommandsRule,
  createPipelineFacade,
} from '../../src/pipeline/facade.js';
import type { ExecutionPlan, ExecutionPlanError } from '../../src/pipeline/plan.js';
import type {
  PipelineConfig,
  PipelineFailureReason,
  PipelineResult,
  StagePlugin,
} from '../../src/pipeline/plugin-api.js';

const mockExecutePipeline = vi.fn();
const mockCreateExecutionPlanSafe = vi.fn();

vi.mock('../../src/pipeline/engine.js', () => ({
  executePipeline: (...args: unknown[]) => mockExecutePipeline(...args),
}));

vi.mock('../../src/pipeline/plan.js', () => ({
  createExecutionPlanSafe: (...args: unknown[]) => mockCreateExecutionPlanSafe(...args),
}));

// Типы для тестирования
type TestSlotMap = Readonly<{
  readonly slot1: string;
  readonly slot2: number;
  readonly slot3: boolean;
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

      const slots = provides.reduce((acc, slot) => {
        switch (slot) {
          case 'slot1':
            // eslint-disable-next-line fp/no-mutation
            acc.slot1 = `result_${stageId}`;
            break;
          case 'slot2':
            // eslint-disable-next-line fp/no-mutation
            acc.slot2 = 42;
            break;
          case 'slot3':
            // eslint-disable-next-line fp/no-mutation
            acc.slot3 = true;
            break;
        }
        return acc;
      }, {} as any);
      return { ok: true, slots };
    },
  };
}

function createValidConfig(): PipelineConfig<TestSlotMap> {
  return {
    maxStages: 10,
    maxDependencies: 5,
    maxDepth: 3,
    maxFanOut: 5,
    maxFanIn: 5,
    allowParallelExecution: false,
    maxParallelStages: 1,
    maxExecutionTimeMs: 30000,
  };
}

function createValidPlan(): ExecutionPlan<TestSlotMap> {
  return {
    executionOrder: ['stage1'] as any,
    stageIndex: { stage1: 0 } as any,
    version: 'test_version',
    stages: {
      stage1: createValidPlugin('stage1'),
    } as any,
    dependencies: {} as any,
    reverseDependencies: {} as any,
  };
}

function createValidResult(): PipelineResult<TestSlotMap> {
  return {
    ok: true,
    slots: { slot1: 'result_stage1' } as any,
    executionOrder: ['stage1'],
  };
}

function createFailureResult(reason: PipelineFailureReason): PipelineResult<TestSlotMap> {
  return { ok: false, reason };
}

function createPlanError(kind: string): ExecutionPlanError {
  return { kind } as ExecutionPlanError;
}

/* ============================================================================
 * TESTS
 * ============================================================================
 */

describe('Pipeline Facade', () => {
  beforeEach(() => {
    mockExecutePipeline.mockReset();
    mockCreateExecutionPlanSafe.mockReset();
    mockExecutePipeline.mockResolvedValue(createValidResult());
    mockCreateExecutionPlanSafe.mockReturnValue(createValidPlan());
  });

  describe('createAllowAllRule', () => {
    it('должен всегда возвращать ALLOW для любой команды', () => {
      const rule = createAllowAllRule<TestSlotMap>();

      const compileCommand = {
        kind: 'COMPILE_PLAN' as const,
        plugins: [createValidPlugin('test')],
        config: createValidConfig(),
      };

      const executeCommand = {
        kind: 'EXECUTE_PLAN' as const,
        plan: createValidPlan(),
        config: createValidConfig(),
      };

      const compileAndExecuteCommand = {
        kind: 'COMPILE_AND_EXECUTE' as const,
        plugins: [createValidPlugin('test')],
        config: createValidConfig(),
      };

      expect(rule(compileCommand)).toEqual({ kind: 'ALLOW' });
      expect(rule(executeCommand)).toEqual({ kind: 'ALLOW' });
      expect(rule(compileAndExecuteCommand)).toEqual({ kind: 'ALLOW' });
    });
  });

  describe('createAllowedCommandsRule', () => {
    it('должен возвращать ALLOW для разрешенных команд', () => {
      const rule = createAllowedCommandsRule<TestSlotMap>(['COMPILE_PLAN']);

      const command = {
        kind: 'COMPILE_PLAN' as const,
        plugins: [createValidPlugin('test')],
        config: createValidConfig(),
      };

      expect(rule(command)).toEqual({ kind: 'ALLOW' });
    });

    it('должен возвращать REJECT для запрещенных команд', () => {
      const rule = createAllowedCommandsRule<TestSlotMap>(['COMPILE_PLAN']);

      const command = {
        kind: 'EXECUTE_PLAN' as const,
        plan: createValidPlan(),
        config: createValidConfig(),
      };

      expect(rule(command)).toEqual({
        kind: 'REJECT',
        reason: {
          kind: 'POLICY_REJECTED',
          code: 'COMMAND_NOT_ALLOWED',
          command: 'EXECUTE_PLAN',
        },
      });
    });

    it('должен работать с пустым списком разрешенных команд', () => {
      const rule = createAllowedCommandsRule<TestSlotMap>([]);

      const command = {
        kind: 'COMPILE_PLAN' as const,
        plugins: [createValidPlugin('test')],
        config: createValidConfig(),
      };

      expect(rule(command)).toEqual({
        kind: 'REJECT',
        reason: {
          kind: 'POLICY_REJECTED',
          code: 'COMMAND_NOT_ALLOWED',
          command: 'COMPILE_PLAN',
        },
      });
    });

    it('должен работать с несколькими разрешенными командами', () => {
      const rule = createAllowedCommandsRule<TestSlotMap>(['COMPILE_PLAN', 'EXECUTE_PLAN']);

      const compileCommand = {
        kind: 'COMPILE_PLAN' as const,
        plugins: [createValidPlugin('test')],
        config: createValidConfig(),
      };

      const executeCommand = {
        kind: 'EXECUTE_PLAN' as const,
        plan: createValidPlan(),
        config: createValidConfig(),
      };

      const compileAndExecuteCommand = {
        kind: 'COMPILE_AND_EXECUTE' as const,
        plugins: [createValidPlugin('test')],
        config: createValidConfig(),
      };

      expect(rule(compileCommand)).toEqual({ kind: 'ALLOW' });
      expect(rule(executeCommand)).toEqual({ kind: 'ALLOW' });
      expect(rule(compileAndExecuteCommand)).toEqual({
        kind: 'REJECT',
        reason: {
          kind: 'POLICY_REJECTED',
          code: 'COMMAND_NOT_ALLOWED',
          command: 'COMPILE_AND_EXECUTE',
        },
      });
    });
  });

  describe('createPipelineFacade', () => {
    describe('без опций', () => {
      it('должен использовать allow all rule по умолчанию', async () => {
        const facade = createPipelineFacade<TestSlotMap>();

        const command = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const result = await facade.run(command);
        expect(result.ok).toBe(true);
      });
    });

    describe('с кастомными правилами', () => {
      it('должен применять правила в порядке', async () => {
        const auditEvents: any[] = [];
        const onAuditEvent = vi.fn((event) => auditEvents.push(event));

        const rule1 = vi.fn(() => ({ kind: 'ALLOW' as const }));
        const rule2 = vi.fn(() => ({ kind: 'ALLOW' as const }));

        const facade = createPipelineFacade<TestSlotMap>({
          rules: [rule1, rule2],
          onAuditEvent,
        });

        const command = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        await facade.run(command);

        expect(rule1).toHaveBeenCalledWith(command);
        expect(rule2).toHaveBeenCalledWith(command);
        expect(auditEvents).toHaveLength(0);
      });

      it('должен останавливаться при REJECT', async () => {
        const auditEvents: any[] = [];
        const onAuditEvent = vi.fn((event) => auditEvents.push(event));

        const rule1 = vi.fn(() => ({ kind: 'ALLOW' as const }));
        const rule2 = vi.fn(() => ({
          kind: 'REJECT' as const,
          reason: {
            kind: 'POLICY_REJECTED' as const,
            code: 'POLICY_DENIED' as const,
            command: 'COMPILE_PLAN' as const,
          },
        }));
        const rule3 = vi.fn(() => ({ kind: 'ALLOW' as const }));

        const facade = createPipelineFacade<TestSlotMap>({
          rules: [rule1, rule2, rule3],
          onAuditEvent,
        });

        const command = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result).toEqual({
          ok: false,
          kind: 'POLICY_REJECTED',
          reason: {
            kind: 'POLICY_REJECTED',
            code: 'POLICY_DENIED',
            command: 'COMPILE_PLAN',
          },
        });

        expect(rule1).toHaveBeenCalled();
        expect(rule2).toHaveBeenCalled();
        expect(rule3).not.toHaveBeenCalled();
        expect(auditEvents).toHaveLength(1);
        expect(auditEvents[0]).toEqual({
          kind: 'RULE_REJECT',
          ruleIndex: 1,
          reason: {
            kind: 'POLICY_REJECTED',
            code: 'POLICY_DENIED',
            command: 'COMPILE_PLAN',
          },
        });
      });

      it('должен перезаписывать команду при REWRITE', async () => {
        const auditEvents: any[] = [];
        const onAuditEvent = vi.fn((event) => auditEvents.push(event));

        const rewrittenCommand = {
          kind: 'EXECUTE_PLAN' as const,
          plan: createValidPlan(),
          config: createValidConfig(),
        };

        const rule1 = vi.fn(() => ({ kind: 'ALLOW' as const }));
        const rule2 = vi.fn(() => ({
          kind: 'REWRITE' as const,
          command: rewrittenCommand,
        }));

        const facade = createPipelineFacade<TestSlotMap>({
          rules: [rule1, rule2],
          onAuditEvent,
        });

        const originalCommand = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        await facade.run(originalCommand);

        expect(auditEvents).toHaveLength(1);
        expect(auditEvents[0]).toEqual({
          kind: 'RULE_REWRITE',
          ruleIndex: 1,
          from: 'COMPILE_PLAN',
          to: 'EXECUTE_PLAN',
        });
      });
    });

    describe('с кастомными обработчиками', () => {
      it('должен использовать кастомный обработчик', async () => {
        const customHandler = vi.fn().mockResolvedValue({
          ok: true,
          kind: 'PLAN_COMPILED',
          plan: createValidPlan(),
        });

        const facade = createPipelineFacade<TestSlotMap>({
          handlers: {
            COMPILE_PLAN: customHandler,
          },
        });

        const command = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        await facade.run(command);

        expect(customHandler).toHaveBeenCalledWith(command);
        expect(mockCreateExecutionPlanSafe).not.toHaveBeenCalled();
      });
    });

    describe('run метод', () => {
      it('должен обрабатывать COMPILE_PLAN команду успешно', async () => {
        const facade = createPipelineFacade<TestSlotMap>();

        const command = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result.ok).toBe(true);
        expect(result.kind).toBe('PLAN_COMPILED');
        if (result.ok && result.kind === 'PLAN_COMPILED') {
          expect(result.plan).toBeDefined();
          expect(result.plan.executionOrder).toEqual(['stage1']);
          expect(result.plan.version).toBe('test_version');
        }
        expect(mockCreateExecutionPlanSafe).toHaveBeenCalledWith(command.plugins, command.config);
      });

      it('должен обрабатывать COMPILE_PLAN команду с ошибкой компиляции', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const error = createPlanError('INVALID_CONFIG');

        mockCreateExecutionPlanSafe.mockReturnValue(error);

        const command = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result).toEqual({
          ok: false,
          kind: 'PLAN_COMPILE_FAILED',
          error,
        });
      });

      it('должен обрабатывать EXECUTE_PLAN команду успешно', async () => {
        const facade = createPipelineFacade<TestSlotMap>();

        const command = {
          kind: 'EXECUTE_PLAN' as const,
          plan: createValidPlan(),
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result).toEqual({
          ok: true,
          kind: 'PLAN_EXECUTED',
          result: createValidResult(),
        });
        expect(mockExecutePipeline).toHaveBeenCalledWith(command.plan, command.config, undefined);
      });

      it('должен обрабатывать EXECUTE_PLAN команду с initialSlots', async () => {
        const facade = createPipelineFacade<TestSlotMap>();

        const initialSlots = { slot1: 'initial' };
        const command = {
          kind: 'EXECUTE_PLAN' as const,
          plan: createValidPlan(),
          config: createValidConfig(),
          initialSlots,
        };

        await facade.run(command);

        expect(mockExecutePipeline).toHaveBeenCalledWith(
          command.plan,
          command.config,
          initialSlots,
        );
      });

      it('должен обрабатывать EXECUTE_PLAN команду с ошибкой выполнения', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const failureReason: PipelineFailureReason = {
          kind: 'INVALID_EXECUTION_PLAN',
          reason: 'test error',
        };

        mockExecutePipeline.mockResolvedValue(createFailureResult(failureReason));

        const command = {
          kind: 'EXECUTE_PLAN' as const,
          plan: createValidPlan(),
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result).toEqual({
          ok: false,
          kind: 'PLAN_EXECUTION_FAILED',
          reason: failureReason,
        });
      });

      it('должен обрабатывать COMPILE_AND_EXECUTE команду успешно', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plan = createValidPlan();
        const pipelineResult = createValidResult();

        mockCreateExecutionPlanSafe.mockReturnValue(plan);
        mockExecutePipeline.mockResolvedValue(pipelineResult);

        const command = {
          kind: 'COMPILE_AND_EXECUTE' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result).toEqual({
          ok: true,
          kind: 'PLAN_COMPILED_AND_EXECUTED',
          plan,
          result: pipelineResult,
        });
        expect(mockCreateExecutionPlanSafe).toHaveBeenCalledWith(command.plugins, command.config);
        expect(mockExecutePipeline).toHaveBeenCalledWith(plan, command.config, undefined);
      });

      it('должен обрабатывать COMPILE_AND_EXECUTE команду с initialSlots', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plan = createValidPlan();
        const initialSlots = { slot1: 'initial' };

        mockCreateExecutionPlanSafe.mockReturnValue(plan);

        const command = {
          kind: 'COMPILE_AND_EXECUTE' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
          initialSlots,
        };

        await facade.run(command);

        expect(mockExecutePipeline).toHaveBeenCalledWith(plan, command.config, initialSlots);
      });

      it('должен обрабатывать COMPILE_AND_EXECUTE команду с ошибкой компиляции', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const error = createPlanError('INVALID_CONFIG');

        mockCreateExecutionPlanSafe.mockReturnValue(error);

        const command = {
          kind: 'COMPILE_AND_EXECUTE' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result).toEqual({
          ok: false,
          kind: 'PLAN_COMPILE_FAILED',
          error,
        });
        expect(mockExecutePipeline).not.toHaveBeenCalled();
      });

      it('должен обрабатывать COMPILE_AND_EXECUTE команду с ошибкой выполнения', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plan = createValidPlan();
        const failureReason: PipelineFailureReason = {
          kind: 'INVALID_EXECUTION_PLAN',
          reason: 'test error',
        };

        mockCreateExecutionPlanSafe.mockReturnValue(plan);
        mockExecutePipeline.mockResolvedValue(createFailureResult(failureReason));

        const command = {
          kind: 'COMPILE_AND_EXECUTE' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const result = await facade.run(command);

        expect(result).toEqual({
          ok: false,
          kind: 'PLAN_EXECUTION_FAILED',
          reason: failureReason,
        });
      });
    });

    describe('compile метод', () => {
      it('должен делегировать run методу с COMPILE_PLAN командой', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plugins = [createValidPlugin('test')];
        const config = createValidConfig();

        const result = await facade.compile(plugins, config);

        expect(result.ok).toBe(true);
        expect(result.kind).toBe('PLAN_COMPILED');
        if (result.ok && result.kind === 'PLAN_COMPILED') {
          expect(result.plan).toBeDefined();
          expect(result.plan.executionOrder).toEqual(['stage1']);
          expect(result.plan.version).toBe('test_version');
        }
      });
    });

    describe('execute метод', () => {
      it('должен делегировать run методу с EXECUTE_PLAN командой без initialSlots', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plan = createValidPlan();
        const config = createValidConfig();

        const result = await facade.execute(plan, config);

        expect(result).toEqual({
          ok: true,
          kind: 'PLAN_EXECUTED',
          result: createValidResult(),
        });
      });

      it('должен делегировать run методу с EXECUTE_PLAN командой с initialSlots', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plan = createValidPlan();
        const config = createValidConfig();
        const initialSlots = { slot1: 'initial' };

        const result = await facade.execute(plan, config, initialSlots);

        expect(result).toEqual({
          ok: true,
          kind: 'PLAN_EXECUTED',
          result: createValidResult(),
        });
      });
    });

    describe('compileAndExecute метод', () => {
      it('должен делегировать run методу с COMPILE_AND_EXECUTE командой без initialSlots', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plugins = [createValidPlugin('test')];
        const config = createValidConfig();

        const result = await facade.compileAndExecute(plugins, config);

        expect(result.ok).toBe(true);
        expect(result.kind).toBe('PLAN_COMPILED_AND_EXECUTED');
        if (result.ok && result.kind === 'PLAN_COMPILED_AND_EXECUTED') {
          expect(result.plan).toBeDefined();
          expect(result.plan.executionOrder).toEqual(['stage1']);
          expect(result.plan.version).toBe('test_version');
          expect(result.result).toBeDefined();
          expect(result.result.ok).toBe(true);
          if (result.result.ok) {
            expect(result.result.executionOrder).toEqual(['stage1']);
          }
        }
      });

      it('должен делегировать run методу с COMPILE_AND_EXECUTE командой с initialSlots', async () => {
        const facade = createPipelineFacade<TestSlotMap>();
        const plugins = [createValidPlugin('test')];
        const config = createValidConfig();
        const initialSlots = { slot1: 'initial' };

        const result = await facade.compileAndExecute(plugins, config, initialSlots);

        expect(result.ok).toBe(true);
        expect(result.kind).toBe('PLAN_COMPILED_AND_EXECUTED');
        if (result.ok && result.kind === 'PLAN_COMPILED_AND_EXECUTED') {
          expect(result.plan).toBeDefined();
          expect(result.plan.executionOrder).toEqual(['stage1']);
          expect(result.plan.version).toBe('test_version');
          expect(result.result).toBeDefined();
          expect(result.result.ok).toBe(true);
          if (result.result.ok) {
            expect(result.result.executionOrder).toEqual(['stage1']);
          }
        }
      });
    });

    describe('edge cases', () => {
      it('должен покрывать все ветки switch в dispatchHandler', async () => {
        const facade = createPipelineFacade<TestSlotMap>();

        // Тестируем все три валидные команды для покрытия switch cases
        const compileCommand = {
          kind: 'COMPILE_PLAN' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        const executeCommand = {
          kind: 'EXECUTE_PLAN' as const,
          plan: createValidPlan(),
          config: createValidConfig(),
        };

        const compileAndExecuteCommand = {
          kind: 'COMPILE_AND_EXECUTE' as const,
          plugins: [createValidPlugin('test')],
          config: createValidConfig(),
        };

        // Все команды должны обрабатываться без ошибок
        await expect(facade.run(compileCommand)).resolves.toBeDefined();
        await expect(facade.run(executeCommand)).resolves.toBeDefined();
        await expect(facade.run(compileAndExecuteCommand)).resolves.toBeDefined();
      });
    });
  });
});
