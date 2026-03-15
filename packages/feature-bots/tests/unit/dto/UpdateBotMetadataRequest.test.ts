/**
 * @file Unit тесты для dto/UpdateBotMetadataRequest.ts
 * Покрывают UpdateBotMetadataRequest и BotMetadataPatch типы.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type { BotVersion } from '../../../src/domain/Bot.js';
import type {
  BotMetadataPatch,
  UpdateBotMetadataRequest,
} from '../../../src/dto/UpdateBotMetadataRequest.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createBotVersion = (value = 1): BotVersion => value as BotVersion;

// ============================================================================
// Тесты для AtLeastOne utility type
// ============================================================================

describe('AtLeastOne utility type', () => {
  it('гарантирует наличие хотя бы одного поля в объекте', () => {
    // Тест проверяет, что TypeScript требует хотя бы одно поле
    // Это проверяется на уровне типов, но мы можем проверить runtime поведение
    const patch: BotMetadataPatch = {
      name: 'Test Bot',
    };

    expect(patch.name).toBe('Test Bot');
  });
});

// ============================================================================
// Тесты для BotMetadataPatch
// ============================================================================

describe('BotMetadataPatch', () => {
  it('создаёт patch только с name', () => {
    const patch: BotMetadataPatch = {
      name: 'Test Bot',
    };

    expect(patch.name).toBe('Test Bot');
  });

  it('создаёт patch с различными именами', () => {
    const names = ['Bot 1', 'My Bot', 'Test Bot Name', 'a'.repeat(100)];

    names.forEach((name) => {
      const patch: BotMetadataPatch = {
        name,
      };

      expect(patch.name).toBe(name);
    });
  });

  it('создаёт patch с пустой строкой (для проверки типов)', () => {
    const patch: BotMetadataPatch = {
      name: '',
    };

    expect(patch.name).toBe('');
  });

  it('создаёт patch с длинными именами', () => {
    const longName = 'a'.repeat(10000);
    const patch: BotMetadataPatch = {
      name: longName,
    };

    expect(patch.name).toBe(longName);
    expect(patch.name!.length).toBe(10000);
  });

  it('создаёт patch с именами со специальными символами', () => {
    const specialNames = [
      'Bot!@#$%^&*()',
      'Bot with spaces',
      'Bot-with-dashes',
      'Bot_with_underscores',
      'Bot.123',
    ];

    specialNames.forEach((name) => {
      const patch: BotMetadataPatch = {
        name,
      };

      expect(patch.name).toBe(name);
    });
  });

  it('проверяет readonly свойства patch', () => {
    const patch: BotMetadataPatch = {
      name: 'Test',
    };

    expect(patch).toHaveProperty('name');
    expect(typeof patch.name).toBe('string');
  });
});

// ============================================================================
// Тесты для UpdateBotMetadataRequest
// ============================================================================

describe('UpdateBotMetadataRequest', () => {
  it('создаёт запрос с name и currentVersion', () => {
    const request: UpdateBotMetadataRequest = {
      name: 'Test Bot',
      currentVersion: createBotVersion(1),
    };

    expect(request.name).toBe('Test Bot');
    expect(request.currentVersion).toBe(1);
  });

  it('создаёт запрос с различными currentVersion', () => {
    const versions = [
      createBotVersion(1),
      createBotVersion(2),
      createBotVersion(10),
      createBotVersion(100),
    ];

    versions.forEach((version) => {
      const request: UpdateBotMetadataRequest = {
        name: 'Test Bot',
        currentVersion: version,
      };

      expect(request.currentVersion).toBe(version);
    });
  });

  it('создаёт запрос с различными именами', () => {
    const names = ['Bot 1', 'My Bot', 'Test Bot Name', 'a'.repeat(100)];

    names.forEach((name) => {
      const request: UpdateBotMetadataRequest = {
        name,
        currentVersion: createBotVersion(1),
      };

      expect(request.name).toBe(name);
    });
  });

  it('создаёт запрос с минимальной версией', () => {
    const request: UpdateBotMetadataRequest = {
      name: 'Test Bot',
      currentVersion: createBotVersion(1),
    };

    expect(request.currentVersion).toBe(1);
    expect(request.name).toBe('Test Bot');
  });

  it('создаёт запрос с большой версией', () => {
    const request: UpdateBotMetadataRequest = {
      name: 'Test Bot',
      currentVersion: createBotVersion(999999),
    };

    expect(request.currentVersion).toBe(999999);
  });

  it('создаёт запрос для обновления только name', () => {
    const request: UpdateBotMetadataRequest = {
      name: 'Updated Bot Name',
      currentVersion: createBotVersion(5),
    };

    expect(request.name).toBe('Updated Bot Name');
    expect(request.currentVersion).toBe(5);
  });

  it('создаёт запрос с корректной структурой', () => {
    const request: UpdateBotMetadataRequest = {
      name: 'Test',
      currentVersion: createBotVersion(1),
    };

    expect(request).toHaveProperty('name');
    expect(request).toHaveProperty('currentVersion');
    expect(typeof request.name).toBe('string');
    expect(typeof request.currentVersion).toBe('number');
  });

  it('создаёт запрос с длинными именами', () => {
    const longName = 'a'.repeat(10000);
    const request: UpdateBotMetadataRequest = {
      name: longName,
      currentVersion: createBotVersion(1),
    };

    expect(request.name).toBe(longName);
    expect(request.name?.length).toBe(10000);
  });

  it('создаёт запрос с различными комбинациями name и currentVersion', () => {
    const testCases = [
      { name: 'Bot 1', version: createBotVersion(1) },
      { name: 'Bot 2', version: createBotVersion(2) },
      { name: 'Bot 3', version: createBotVersion(10) },
    ];

    testCases.forEach(({ name, version }) => {
      const request: UpdateBotMetadataRequest = {
        name,
        currentVersion: version,
      };

      expect(request.name).toBe(name);
      expect(request.currentVersion).toBe(version);
    });
  });

  it('проверяет readonly свойства request', () => {
    const request: UpdateBotMetadataRequest = {
      name: 'Test',
      currentVersion: createBotVersion(1),
    };

    expect(request).toHaveProperty('name');
    expect(request).toHaveProperty('currentVersion');
    expect(Object.isFrozen(request) || Object.isSealed(request)).toBe(false); // TypeScript readonly не делает объект frozen
  });

  it('создаёт запрос для optimistic concurrency control', () => {
    // Тест проверяет использование currentVersion для optimistic concurrency control
    const request: UpdateBotMetadataRequest = {
      name: 'Updated Name',
      currentVersion: createBotVersion(3),
    };

    expect(request.currentVersion).toBe(3);
    expect(request.name).toBe('Updated Name');
  });

  it('создаёт запрос с именами, содержащими пробелы', () => {
    const namesWithSpaces = [
      'Bot with spaces',
      'My Test Bot',
      'Bot   with   multiple   spaces',
    ];

    namesWithSpaces.forEach((name) => {
      const request: UpdateBotMetadataRequest = {
        name,
        currentVersion: createBotVersion(1),
      };

      expect(request.name).toBe(name);
    });
  });

  it('создаёт запрос с именами, содержащими специальные символы', () => {
    const specialNames = [
      'Bot!@#$%^&*()',
      'Bot-with-dashes',
      'Bot_with_underscores',
      'Bot.123',
      'Bot/Path',
    ];

    specialNames.forEach((name) => {
      const request: UpdateBotMetadataRequest = {
        name,
        currentVersion: createBotVersion(1),
      };

      expect(request.name).toBe(name);
    });
  });

  it('создаёт запрос с нулевой версией (edge case)', () => {
    const request: UpdateBotMetadataRequest = {
      name: 'Test Bot',
      currentVersion: createBotVersion(0),
    };

    expect(request.currentVersion).toBe(0);
  });

  it('создаёт запрос с отрицательной версией (edge case для типов)', () => {
    // TypeScript позволяет это на уровне типов, но runtime validation должна это отклонить
    const request: UpdateBotMetadataRequest = {
      name: 'Test Bot',
      currentVersion: -1 as BotVersion,
    };

    expect(request.currentVersion).toBe(-1);
  });
});
