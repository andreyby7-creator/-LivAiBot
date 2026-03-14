/**
 * @file Unit тесты для dto/CreateBotRequest.ts
 * Покрывают CreateBotRequest типы.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type { ID } from '@livai/core-contracts';

import type { BotSettings } from '../../../src/domain/BotSettings.js';
import type { BotTemplateId } from '../../../src/domain/BotTemplate.js';
import type { BotInstruction } from '../../../src/domain/BotVersion.js';
import type { CreateBotRequest } from '../../../src/dto/CreateBotRequest.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createBotInstruction = (value = 'Test instruction'): BotInstruction =>
  value as BotInstruction;
const createBotTemplateId = (value = 'template-1'): BotTemplateId => value as ID<'BotTemplate'>;
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
// Тесты для CreateBotRequest
// ============================================================================

describe('CreateBotRequest', () => {
  it('создаёт минимальный CreateBotRequest без templateId', () => {
    const request: CreateBotRequest = {
      name: 'Test Bot',
      instruction: createBotInstruction('Test instruction'),
      settings: createBotSettings(),
    };

    expect(request.name).toBe('Test Bot');
    expect(request.instruction).toBe('Test instruction');
    expect(request.settings).toBeDefined();
    expect(request.templateId).toBeUndefined();
  });

  it('создаёт CreateBotRequest с templateId', () => {
    const request: CreateBotRequest = {
      name: 'Bot from Template',
      instruction: createBotInstruction('Template instruction'),
      settings: createBotSettings(),
      templateId: createBotTemplateId('template-123'),
    };

    expect(request.name).toBe('Bot from Template');
    expect(request.instruction).toBe('Template instruction');
    expect(request.settings).toBeDefined();
    expect(request.templateId).toBe('template-123');
  });

  it('создаёт CreateBotRequest с различными именами', () => {
    const names = ['Bot 1', 'My Bot', 'Test Bot Name', 'a'.repeat(100)];

    names.forEach((name) => {
      const request: CreateBotRequest = {
        name,
        instruction: createBotInstruction('Instruction'),
        settings: createBotSettings(),
      };

      expect(request.name).toBe(name);
    });
  });

  it('создаёт CreateBotRequest с различными инструкциями', () => {
    const instructions = [
      'Simple instruction',
      `Long instruction ${'a'.repeat(1000)}`,
      'Instruction with special chars: !@#$%^&*()',
    ];

    instructions.forEach((instruction) => {
      const request: CreateBotRequest = {
        name: 'Test Bot',
        instruction: createBotInstruction(instruction),
        settings: createBotSettings(),
      };

      expect(request.instruction).toBe(instruction);
    });
  });

  it('создаёт CreateBotRequest с различными settings', () => {
    const settings1: BotSettings = createBotSettings({
      temperature: createTemperature(0.7),
    });

    const settings2: BotSettings = createBotSettings({
      piiMasking: true,
      imageRecognition: true,
    });

    const request1: CreateBotRequest = {
      name: 'Bot 1',
      instruction: createBotInstruction('Instruction 1'),
      settings: settings1,
    };

    const request2: CreateBotRequest = {
      name: 'Bot 2',
      instruction: createBotInstruction('Instruction 2'),
      settings: settings2,
    };

    expect(request1.settings.temperature).toBe(0.7);
    expect(request2.settings.piiMasking).toBe(true);
    expect(request2.settings.imageRecognition).toBe(true);
  });

  it('создаёт CreateBotRequest с различными templateId', () => {
    const templateIds = [
      createBotTemplateId('template-1'),
      createBotTemplateId('template-2'),
      createBotTemplateId('template-abc-123'),
    ];

    templateIds.forEach((templateId) => {
      const request: CreateBotRequest = {
        name: 'Bot from Template',
        instruction: createBotInstruction('Instruction'),
        settings: createBotSettings(),
        templateId,
      };

      expect(request.templateId).toBe(templateId);
    });
  });

  it('создаёт CreateBotRequest с полным набором полей', () => {
    const request: CreateBotRequest = {
      name: 'Complete Bot',
      instruction: createBotInstruction('Complete instruction'),
      settings: createBotSettings({
        temperature: createTemperature(0.8),
        piiMasking: true,
      }),
      templateId: createBotTemplateId('template-complete'),
    };

    expect(request.name).toBe('Complete Bot');
    expect(request.instruction).toBe('Complete instruction');
    expect(request.settings.temperature).toBe(0.8);
    expect(request.settings.piiMasking).toBe(true);
    expect(request.templateId).toBe('template-complete');
  });

  it('создаёт CreateBotRequest для создания бота с нуля (без templateId)', () => {
    const request: CreateBotRequest = {
      name: 'New Bot',
      instruction: createBotInstruction('You are a helpful assistant'),
      settings: createBotSettings(),
    };

    expect(request.templateId).toBeUndefined();
    expect(request.name).toBe('New Bot');
    expect(request.instruction).toBe('You are a helpful assistant');
  });

  it('создаёт CreateBotRequest для создания бота из шаблона', () => {
    const request: CreateBotRequest = {
      name: 'Bot from Template',
      instruction: createBotInstruction('Template-based instruction'),
      settings: createBotSettings(),
      templateId: createBotTemplateId('customer-support-template'),
    };

    expect(request.templateId).toBe('customer-support-template');
    expect(request.name).toBe('Bot from Template');
  });

  it('создаёт CreateBotRequest с переопределением полей шаблона', () => {
    const request: CreateBotRequest = {
      name: 'Custom Bot Name',
      instruction: createBotInstruction('Custom instruction override'),
      settings: createBotSettings({
        temperature: createTemperature(0.9),
      }),
      templateId: createBotTemplateId('base-template'),
    };

    expect(request.templateId).toBe('base-template');
    expect(request.name).toBe('Custom Bot Name');
    expect(request.instruction).toBe('Custom instruction override');
    expect(request.settings.temperature).toBe(0.9);
  });

  it('создаёт CreateBotRequest с минимальными settings', () => {
    const request: CreateBotRequest = {
      name: 'Minimal Bot',
      instruction: createBotInstruction('Minimal instruction'),
      settings: createBotSettings(),
    };

    expect(request.settings).toBeDefined();
    expect(request.settings.temperature).toBe(0);
    expect(request.settings.piiMasking).toBe(false);
    expect(request.settings.imageRecognition).toBe(false);
  });

  it('создаёт CreateBotRequest с расширенными settings', () => {
    const request: CreateBotRequest = {
      name: 'Advanced Bot',
      instruction: createBotInstruction('Advanced instruction'),
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
    };

    expect(request.settings.temperature).toBe(1.0);
    expect(request.settings.piiMasking).toBe(true);
    expect(request.settings.imageRecognition).toBe(true);
    expect(request.settings.unrecognizedMessage.message).toBe('I did not understand');
    expect(request.settings.unrecognizedMessage.showSupportHint).toBe(true);
    expect(request.settings.interruptionRules.allowUserInterruption).toBe(false);
  });

  it('создаёт CreateBotRequest с корректной структурой', () => {
    const request: CreateBotRequest = {
      name: 'Structure Test',
      instruction: createBotInstruction('Test'),
      settings: createBotSettings(),
    };

    expect(request).toHaveProperty('name');
    expect(request).toHaveProperty('instruction');
    expect(request).toHaveProperty('settings');
    expect(typeof request.name).toBe('string');
    expect(typeof request.instruction).toBe('string');
    expect(typeof request.settings).toBe('object');
  });
});
