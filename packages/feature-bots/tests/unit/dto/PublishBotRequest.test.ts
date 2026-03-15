/**
 * @file Unit тесты для dto/PublishBotRequest.ts
 * Покрывают PublishBotRequest, PublishRequest, RollbackRequest типы и type guards.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type { BotVersion } from '../../../src/domain/Bot.js';
import type {
  PublishBotRequest,
  PublishRequest,
  RollbackRequest,
} from '../../../src/dto/PublishBotRequest.js';
import { isPublishRequest, isRollbackRequest } from '../../../src/dto/PublishBotRequest.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createBotVersion = (value = 1): BotVersion => value as BotVersion;

// ============================================================================
// Тесты для PublishRequest
// ============================================================================

describe('PublishRequest', () => {
  it('создаёт запрос публикации с version', () => {
    const request: PublishRequest = {
      version: createBotVersion(5),
    };

    expect(request.version).toBe(5);
  });

  it('создаёт запрос публикации без version (пустой объект)', () => {
    const request: PublishRequest = {};

    expect(request.version).toBeUndefined();
  });

  it('создаёт запрос публикации с различными версиями', () => {
    const versions = [
      createBotVersion(1),
      createBotVersion(2),
      createBotVersion(10),
      createBotVersion(100),
    ];

    versions.forEach((version) => {
      const request: PublishRequest = {
        version,
      };

      expect(request.version).toBe(version);
    });
  });

  it('создаёт запрос публикации для публикации текущей версии', () => {
    // Пустой объект означает "publish current"
    const request: PublishRequest = {};

    expect(request.version).toBeUndefined();
    expect(Object.keys(request).length).toBe(0);
  });

  it('проверяет readonly свойства request', () => {
    const request: PublishRequest = {
      version: createBotVersion(1),
    };

    expect(request).toHaveProperty('version');
    expect(typeof request.version).toBe('number');
  });
});

// ============================================================================
// Тесты для RollbackRequest
// ============================================================================

describe('RollbackRequest', () => {
  it('создаёт запрос rollback с rollbackVersion', () => {
    const request: RollbackRequest = {
      rollbackVersion: createBotVersion(3),
    };

    expect(request.rollbackVersion).toBe(3);
  });

  it('создаёт запрос rollback с различными версиями', () => {
    const versions = [
      createBotVersion(1),
      createBotVersion(2),
      createBotVersion(5),
      createBotVersion(10),
    ];

    versions.forEach((version) => {
      const request: RollbackRequest = {
        rollbackVersion: version,
      };

      expect(request.rollbackVersion).toBe(version);
    });
  });

  it('создаёт запрос rollback с минимальной версией', () => {
    const request: RollbackRequest = {
      rollbackVersion: createBotVersion(1),
    };

    expect(request.rollbackVersion).toBe(1);
  });

  it('создаёт запрос rollback с большой версией', () => {
    const request: RollbackRequest = {
      rollbackVersion: createBotVersion(999),
    };

    expect(request.rollbackVersion).toBe(999);
  });

  it('проверяет readonly свойства request', () => {
    const request: RollbackRequest = {
      rollbackVersion: createBotVersion(1),
    };

    expect(request).toHaveProperty('rollbackVersion');
    expect(typeof request.rollbackVersion).toBe('number');
  });
});

// ============================================================================
// Тесты для PublishBotRequest (discriminated union)
// ============================================================================

describe('PublishBotRequest', () => {
  it('создаёт PublishBotRequest как PublishRequest с version', () => {
    const request: PublishBotRequest = {
      version: createBotVersion(5),
    };

    expect(request.version).toBe(5);
    expect('rollbackVersion' in request).toBe(false);
  });

  it('создаёт PublishBotRequest как PublishRequest без version', () => {
    const request: PublishBotRequest = {};

    expect(request.version).toBeUndefined();
    expect('rollbackVersion' in request).toBe(false);
  });

  it('создаёт PublishBotRequest как RollbackRequest', () => {
    const request: PublishBotRequest = {
      rollbackVersion: createBotVersion(3),
    };

    expect(request.rollbackVersion).toBe(3);
    expect('version' in request).toBe(false);
  });

  it('проверяет, что PublishRequest и RollbackRequest не могут быть смешаны', () => {
    // TypeScript должен предотвращать это на уровне типов
    // В runtime мы проверяем, что union работает корректно
    const publishRequest: PublishBotRequest = {
      version: createBotVersion(5),
    };

    const rollbackRequest: PublishBotRequest = {
      rollbackVersion: createBotVersion(3),
    };

    expect('version' in publishRequest).toBe(true);
    expect('rollbackVersion' in rollbackRequest).toBe(true);
  });
});

// ============================================================================
// Тесты для isPublishRequest type guard
// ============================================================================

describe('isPublishRequest', () => {
  it('возвращает true для PublishRequest с version', () => {
    const request: PublishBotRequest = {
      version: createBotVersion(5),
    };

    expect(isPublishRequest(request)).toBe(true);
    // Type narrowing должно работать
    void (isPublishRequest(request) && expect(request.version).toBe(5));
  });

  it('возвращает true для PublishRequest без version (пустой объект)', () => {
    const request: PublishBotRequest = {};

    expect(isPublishRequest(request)).toBe(true);
    // Type narrowing должно работать
    void (isPublishRequest(request) && expect(request.version).toBeUndefined());
  });

  it('возвращает false для RollbackRequest', () => {
    const request: PublishBotRequest = {
      rollbackVersion: createBotVersion(3),
    };

    expect(isPublishRequest(request)).toBe(false);
  });

  it('корректно определяет PublishRequest с различными версиями', () => {
    const requests: PublishBotRequest[] = [
      {},
      { version: createBotVersion(1) },
      { version: createBotVersion(10) },
    ];

    requests.forEach((req) => {
      expect(isPublishRequest(req)).toBe(true);
    });
  });

  it('проверяет type narrowing после isPublishRequest', () => {
    const request1: PublishBotRequest = {
      version: createBotVersion(5),
    };

    // После type guard TypeScript должен знать, что это PublishRequest
    void (isPublishRequest(request1) && (() => {
      expect(request1.version).toBe(5);
      // @ts-expect-error - rollbackVersion не должно существовать после narrowing
      expect(request1.rollbackVersion).toBeUndefined();
    })());
  });
});

// ============================================================================
// Тесты для isRollbackRequest type guard
// ============================================================================

describe('isRollbackRequest', () => {
  it('возвращает true для RollbackRequest', () => {
    const request: PublishBotRequest = {
      rollbackVersion: createBotVersion(3),
    };

    expect(isRollbackRequest(request)).toBe(true);
    // Type narrowing должно работать
    void (isRollbackRequest(request) && expect(request.rollbackVersion).toBe(3));
  });

  it('возвращает false для PublishRequest с version', () => {
    const request: PublishBotRequest = {
      version: createBotVersion(5),
    };

    expect(isRollbackRequest(request)).toBe(false);
  });

  it('возвращает false для PublishRequest без version (пустой объект)', () => {
    const request: PublishBotRequest = {};

    expect(isRollbackRequest(request)).toBe(false);
  });

  it('корректно определяет RollbackRequest с различными версиями', () => {
    const requests: PublishBotRequest[] = [
      { rollbackVersion: createBotVersion(1) },
      { rollbackVersion: createBotVersion(5) },
      { rollbackVersion: createBotVersion(10) },
    ];

    requests.forEach((req) => {
      expect(isRollbackRequest(req)).toBe(true);
    });
  });

  it('проверяет type narrowing после isRollbackRequest', () => {
    const request: PublishBotRequest = {
      rollbackVersion: createBotVersion(3),
    };

    // После type guard TypeScript должен знать, что это RollbackRequest
    void (isRollbackRequest(request) && (() => {
      expect(request.rollbackVersion).toBe(3);
      // @ts-expect-error - version не должно существовать после narrowing
      expect(request.version).toBeUndefined();
    })());
  });
});

// ============================================================================
// Интеграционные тесты для type guards
// ============================================================================

describe('Type guards integration', () => {
  it('isPublishRequest и isRollbackRequest взаимоисключающие', () => {
    const publishRequest: PublishBotRequest = {
      version: createBotVersion(5),
    };

    const rollbackRequest: PublishBotRequest = {
      rollbackVersion: createBotVersion(3),
    };

    expect(isPublishRequest(publishRequest)).toBe(true);
    expect(isRollbackRequest(publishRequest)).toBe(false);

    expect(isPublishRequest(rollbackRequest)).toBe(false);
    expect(isRollbackRequest(rollbackRequest)).toBe(true);
  });

  it('пустой объект определяется как PublishRequest', () => {
    const emptyRequest: PublishBotRequest = {};

    expect(isPublishRequest(emptyRequest)).toBe(true);
    expect(isRollbackRequest(emptyRequest)).toBe(false);
  });

  it('type guards работают в условных конструкциях', () => {
    const requests: PublishBotRequest[] = [
      {},
      { version: createBotVersion(5) },
      { rollbackVersion: createBotVersion(3) },
    ];

    requests.forEach((req) => {
      void (isPublishRequest(req)
        ? expect('rollbackVersion' in req).toBe(false)
        : isRollbackRequest(req) && (() => {
          expect('version' in req).toBe(false);
          expect(req.rollbackVersion).toBeDefined();
        })());
    });
  });
});
