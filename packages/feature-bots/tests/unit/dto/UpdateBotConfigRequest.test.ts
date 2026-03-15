/**
 * @file Unit тесты для dto/UpdateBotConfigRequest.ts
 * Покрывают UpdateBotConfigRequest и BotConfigurationPatch типы.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type { BotSettings } from '../../../src/domain/BotSettings.js';
import type { BotInstruction } from '../../../src/domain/BotVersion.js';
import type {
  BotConfigurationPatch,
  UpdateBotConfigRequest,
} from '../../../src/dto/UpdateBotConfigRequest.js';
import type { OperationId } from '../../../src/types/bot-commands.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createBotInstruction = (value = 'Test instruction'): BotInstruction =>
  value as BotInstruction;

const createOperationId = (value = 'op-123'): OperationId => value as OperationId;

const createTemperature = (value: number): BotSettings['temperature'] => value as any;
// eslint-disable-next-line @livai/rag/context-leakage -- локальное числовое значение для unit-теста, не используется в RAG/training
const createContextWindow = (value: number): BotSettings['contextWindow'] => value as any;

const createBotSettings = (overrides: Partial<BotSettings> = {}): BotSettings => ({
  temperature: createTemperature(0),
  // eslint-disable-next-line @livai/rag/context-leakage -- константное тестовое значение, не используемое в RAG/training
  contextWindow: createContextWindow(0),
  piiMasking: false,
  imageRecognition: false,
  unrecognizedMessage: {
    message: 'fallback',
    showSupportHint: false,
  },
  interruptionRules: {
    allowUserInterruption: true,
    // eslint-disable-next-line @livai/rag/context-leakage -- константное тестовое значение, не используемое в RAG/training
    maxConcurrentSessions: 1,
  },
  extra: {
    settingsSchemaVersion: 1,
    featureFlags: {
      handoff: false,
      analytics: false,
      advanced_memory: false,
    },
    integrationConfig: {},
  },
  ...overrides,
});

// ============================================================================
// Тесты для BotConfigurationPatch
// ============================================================================

describe('BotConfigurationPatch', () => {
  it('создаёт patch только с instruction', () => {
    const patch: BotConfigurationPatch = {
      instruction: createBotInstruction('Test instruction'),
    };

    expect(patch.instruction).toBe('Test instruction');
    expect(patch.settings).toBeUndefined();
  });

  it('создаёт patch только с settings', () => {
    const patch: BotConfigurationPatch = {
      settings: createBotSettings(),
    };

    expect(patch.settings).toBeDefined();
    expect(patch.instruction).toBeUndefined();
  });

  it('создаёт patch с instruction и settings', () => {
    const patch: BotConfigurationPatch = {
      instruction: createBotInstruction('Test instruction'),
      settings: createBotSettings(),
    };

    expect(patch.instruction).toBe('Test instruction');
    expect(patch.settings).toBeDefined();
  });

  it('создаёт patch с различными инструкциями', () => {
    const instructions = [
      'Simple instruction',
      `Long instruction ${'a'.repeat(1000)}`,
      'Instruction with special chars: !@#$%^&*()',
    ];

    instructions.forEach((instruction) => {
      const patch: BotConfigurationPatch = {
        instruction: createBotInstruction(instruction),
      };

      expect(patch.instruction).toBe(instruction);
    });
  });

  it('создаёт patch с различными settings', () => {
    const settings1: BotSettings = createBotSettings({
      temperature: createTemperature(0.7),
    });

    const settings2: BotSettings = createBotSettings({
      piiMasking: true,
      imageRecognition: true,
    });

    const patch1: BotConfigurationPatch = {
      settings: settings1,
    };

    const patch2: BotConfigurationPatch = {
      settings: settings2,
    };

    expect(patch1.settings?.temperature).toBe(0.7);
    expect(patch2.settings?.piiMasking).toBe(true);
    expect(patch2.settings?.imageRecognition).toBe(true);
  });

  it('проверяет readonly свойства patch', () => {
    const patch: BotConfigurationPatch = {
      instruction: createBotInstruction('Test'),
    };

    expect(patch).toHaveProperty('instruction');
    expect(typeof patch.instruction).toBe('string');
  });
});

// ============================================================================
// Тесты для UpdateBotConfigRequest
// ============================================================================

describe('UpdateBotConfigRequest', () => {
  it('создаёт запрос только с instruction и operationId', () => {
    const request: UpdateBotConfigRequest = {
      instruction: createBotInstruction('Test instruction'),
      operationId: createOperationId('op-1'),
    };

    expect(request.instruction).toBe('Test instruction');
    expect(request.operationId).toBe('op-1');
    expect(request.settings).toBeUndefined();
  });

  it('создаёт запрос только с settings и operationId', () => {
    const request: UpdateBotConfigRequest = {
      settings: createBotSettings(),
      operationId: createOperationId('op-2'),
    };

    expect(request.settings).toBeDefined();
    expect(request.operationId).toBe('op-2');
    expect(request.instruction).toBeUndefined();
  });

  it('создаёт запрос с instruction, settings и operationId', () => {
    const request: UpdateBotConfigRequest = {
      instruction: createBotInstruction('Complete instruction'),
      settings: createBotSettings({
        temperature: createTemperature(0.8),
        piiMasking: true,
      }),
      operationId: createOperationId('op-3'),
    };

    expect(request.instruction).toBe('Complete instruction');
    expect(request.settings?.temperature).toBe(0.8);
    expect(request.settings?.piiMasking).toBe(true);
    expect(request.operationId).toBe('op-3');
  });

  it('создаёт запрос с различными operationId', () => {
    const operationIds = [
      createOperationId('op-1'),
      createOperationId('op-abc-123'),
      createOperationId('op-xyz-456'),
    ];

    operationIds.forEach((operationId) => {
      const request: UpdateBotConfigRequest = {
        instruction: createBotInstruction('Test'),
        operationId,
      };

      expect(request.operationId).toBe(operationId);
    });
  });

  it('создаёт запрос с различными инструкциями', () => {
    const instructions = [
      'Simple instruction',
      `Long instruction ${'a'.repeat(1000)}`,
      'Instruction with special chars: !@#$%^&*()',
    ];

    instructions.forEach((instruction) => {
      const request: UpdateBotConfigRequest = {
        instruction: createBotInstruction(instruction),
        operationId: createOperationId(),
      };

      expect(request.instruction).toBe(instruction);
    });
  });

  it('создаёт запрос с различными settings', () => {
    const settings1: BotSettings = createBotSettings({
      temperature: createTemperature(0.7),
    });

    const settings2: BotSettings = createBotSettings({
      piiMasking: true,
      imageRecognition: true,
      unrecognizedMessage: {
        message: 'I did not understand',
        showSupportHint: true,
      },
      interruptionRules: {
        allowUserInterruption: false,
        maxConcurrentSessions: 5 as any,
      },
    });

    const request1: UpdateBotConfigRequest = {
      settings: settings1,
      operationId: createOperationId('op-1'),
    };

    const request2: UpdateBotConfigRequest = {
      settings: settings2,
      operationId: createOperationId('op-2'),
    };

    expect(request1.settings?.temperature).toBe(0.7);
    expect(request2.settings?.piiMasking).toBe(true);
    expect(request2.settings?.imageRecognition).toBe(true);
    expect(request2.settings!.unrecognizedMessage.message).toBe('I did not understand');
    expect(request2.settings!.unrecognizedMessage.showSupportHint).toBe(true);
    expect(request2.settings!.interruptionRules.allowUserInterruption).toBe(false);
  });

  it('создаёт запрос с минимальными settings', () => {
    const request: UpdateBotConfigRequest = {
      settings: createBotSettings(),
      operationId: createOperationId(),
    };

    expect(request.settings).toBeDefined();
    expect(request.settings?.temperature).toBe(0);
    expect(request.settings?.piiMasking).toBe(false);
    expect(request.settings?.imageRecognition).toBe(false);
  });

  it('создаёт запрос с расширенными settings', () => {
    const request: UpdateBotConfigRequest = {
      settings: createBotSettings({
        temperature: createTemperature(1.0),
        piiMasking: true,
        imageRecognition: true,
        unrecognizedMessage: {
          message: 'I did not understand',
          showSupportHint: true,
        },
        interruptionRules: {
          allowUserInterruption: false,
          maxConcurrentSessions: 5 as any,
        },
      }),
      operationId: createOperationId(),
    };

    expect(request.settings?.temperature).toBe(1.0);
    expect(request.settings?.piiMasking).toBe(true);
    expect(request.settings?.imageRecognition).toBe(true);
    expect(request.settings!.unrecognizedMessage.message).toBe('I did not understand');
    expect(request.settings!.unrecognizedMessage.showSupportHint).toBe(true);
    expect(request.settings!.interruptionRules.allowUserInterruption).toBe(false);
  });

  it('создаёт запрос с корректной структурой', () => {
    const request: UpdateBotConfigRequest = {
      instruction: createBotInstruction('Test'),
      operationId: createOperationId(),
    };

    expect(request).toHaveProperty('instruction');
    expect(request).toHaveProperty('operationId');
    expect(typeof request.instruction).toBe('string');
    expect(typeof request.operationId).toBe('string');
  });

  it('создаёт запрос для обновления только instruction', () => {
    const request: UpdateBotConfigRequest = {
      instruction: createBotInstruction('You are a helpful assistant'),
      operationId: createOperationId('op-update-instruction'),
    };

    expect(request.instruction).toBe('You are a helpful assistant');
    expect(request.operationId).toBe('op-update-instruction');
    expect(request.settings).toBeUndefined();
  });

  it('создаёт запрос для обновления только settings', () => {
    const request: UpdateBotConfigRequest = {
      settings: createBotSettings({
        temperature: createTemperature(0.9),
      }),
      operationId: createOperationId('op-update-settings'),
    };

    expect(request.settings?.temperature).toBe(0.9);
    expect(request.operationId).toBe('op-update-settings');
    expect(request.instruction).toBeUndefined();
  });

  it('создаёт запрос для обновления instruction и settings одновременно', () => {
    const request: UpdateBotConfigRequest = {
      instruction: createBotInstruction('Updated instruction'),
      settings: createBotSettings({
        temperature: createTemperature(0.8),
        piiMasking: true,
      }),
      operationId: createOperationId('op-update-both'),
    };

    expect(request.instruction).toBe('Updated instruction');
    expect(request.settings?.temperature).toBe(0.8);
    expect(request.settings?.piiMasking).toBe(true);
    expect(request.operationId).toBe('op-update-both');
  });

  it('проверяет readonly свойства request', () => {
    const request: UpdateBotConfigRequest = {
      instruction: createBotInstruction('Test'),
      operationId: createOperationId(),
    };

    expect(request).toHaveProperty('instruction');
    expect(request).toHaveProperty('operationId');
    expect(Object.isFrozen(request) || Object.isSealed(request)).toBe(false); // TypeScript readonly не делает объект frozen
  });

  it('создаёт запрос с длинными значениями', () => {
    const longInstruction = 'a'.repeat(10000);
    const request: UpdateBotConfigRequest = {
      instruction: createBotInstruction(longInstruction),
      operationId: createOperationId('op-long'),
    };

    expect(request.instruction).toBe(longInstruction);
    expect(request.instruction?.length).toBe(10000);
  });

  it('создаёт запрос с различными комбинациями полей', () => {
    // Только instruction
    const request1: UpdateBotConfigRequest = {
      instruction: createBotInstruction('Instruction 1'),
      operationId: createOperationId('op-1'),
    };

    // Только settings
    const request2: UpdateBotConfigRequest = {
      settings: createBotSettings(),
      operationId: createOperationId('op-2'),
    };

    // Оба поля
    const request3: UpdateBotConfigRequest = {
      instruction: createBotInstruction('Instruction 3'),
      settings: createBotSettings({
        temperature: createTemperature(0.5),
      }),
      operationId: createOperationId('op-3'),
    };

    expect(request1.instruction).toBe('Instruction 1');
    expect(request1.settings).toBeUndefined();

    expect(request2.settings).toBeDefined();
    expect(request2.instruction).toBeUndefined();

    expect(request3.instruction).toBe('Instruction 3');
    expect(request3.settings?.temperature).toBe(0.5);
  });
});
