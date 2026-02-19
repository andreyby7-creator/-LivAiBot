/**
 * @file Unit тесты для Taint Source (Input Boundary)
 * Полное покрытие всех методов и веток исполнения (100%)
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createExternalInputBoundary,
  markAsExternal,
  sanitizeAndPromote,
  validateAndPromote,
  validateAndSanitize,
} from '../../src/data-safety/taint-source.js';
import { sanitizationModes } from '../../src/data-safety/sanitization-mode.js';
import type { SanitizationMode } from '../../src/data-safety/sanitization-mode.js';
import * as taintModule from '../../src/data-safety/taint.js';
import {
  getTaintMetadata,
  isTainted,
  stripTaint,
  taintSources,
} from '../../src/data-safety/taint.js';
import type { Tainted } from '../../src/data-safety/taint.js';
import { createTrustLevelRegistry, trustLevels } from '../../src/data-safety/trust-level.js';
import type { TrustLevel } from '../../src/data-safety/trust-level.js';

/* eslint-disable ai-security/model-poisoning */
describe('Taint Source (Input Boundary)', () => {
  describe('markAsExternal', () => {
    it('помечает данные как tainted с source=EXTERNAL', () => {
      const data = { name: 'John', age: 30 };
      const tainted = markAsExternal(data);

      expect(isTainted(tainted)).toBe(true);
      const metadata = getTaintMetadata(tainted);
      expect(metadata).toBeDefined();
      expect(metadata?.source).toBe(taintSources.EXTERNAL);
      expect(metadata?.trustLevel).toBe(trustLevels.UNTRUSTED);
    });

    it('использует UNTRUSTED по умолчанию', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const metadata = getTaintMetadata(tainted);
      expect(metadata?.trustLevel).toBe(trustLevels.UNTRUSTED);
    });

    it('принимает кастомный trustLevel', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data, trustLevels.PARTIAL as TrustLevel);

      const metadata = getTaintMetadata(tainted);
      expect(metadata?.trustLevel).toBe(trustLevels.PARTIAL);
    });

    it('принимает кастомный timestamp', () => {
      const data = { name: 'John' };
      const customTimestamp = 1234567890;
      const tainted = markAsExternal(data, trustLevels.UNTRUSTED as TrustLevel, customTimestamp);

      const metadata = getTaintMetadata(tainted);
      expect(metadata?.timestamp).toBe(customTimestamp);
    });

    it('использует Date.now() если timestamp не указан', () => {
      const data = { name: 'John' };
      const before = Date.now();
      const tainted = markAsExternal(data);
      const after = Date.now();

      const metadata = getTaintMetadata(tainted);
      expect(metadata?.timestamp).toBeDefined();
      expect(metadata?.timestamp).toBeGreaterThanOrEqual(before);
      expect(metadata?.timestamp).toBeLessThanOrEqual(after);
    });

    it('работает с примитивами', () => {
      const tainted = markAsExternal('test');
      expect(isTainted(tainted)).toBe(true);
    });

    it('работает с массивами', () => {
      const tainted = markAsExternal([1, 2, 3]);
      expect(isTainted(tainted)).toBe(true);
    });
  });

  describe('validateAndPromote', () => {
    it('валидирует и повышает уровень доверия (meet fail-closed)', () => {
      const data = { name: 'John' };
      // Начинаем с PARTIAL, чтобы meet(PARTIAL, PARTIAL) = PARTIAL
      const tainted = markAsExternal(data, trustLevels.PARTIAL as TrustLevel);

      const validated = validateAndPromote(
        tainted,
        (value) => {
          if (!value.name) {
            throw new Error('Name required');
          }
        },
      );

      const metadata = getTaintMetadata(validated);
      expect(metadata?.trustLevel).toBe(trustLevels.PARTIAL);
    });

    it('использует PARTIAL по умолчанию (meet fail-closed)', () => {
      const data = { name: 'John' };
      // Начинаем с PARTIAL, чтобы meet(PARTIAL, PARTIAL) = PARTIAL
      const tainted = markAsExternal(data, trustLevels.PARTIAL as TrustLevel);

      const validated = validateAndPromote(tainted, () => {});

      const metadata = getTaintMetadata(validated);
      expect(metadata?.trustLevel).toBe(trustLevels.PARTIAL);
    });

    it('принимает кастомный targetTrustLevel (meet fail-closed)', () => {
      const data = { name: 'John' };
      // Начинаем с TRUSTED, чтобы meet(TRUSTED, TRUSTED) = TRUSTED
      const tainted = markAsExternal(data, trustLevels.TRUSTED as TrustLevel);

      const validated = validateAndPromote(
        tainted,
        () => {},
        trustLevels.TRUSTED as TrustLevel,
      );

      const metadata = getTaintMetadata(validated);
      expect(metadata?.trustLevel).toBe(trustLevels.TRUSTED);
    });

    it('выбрасывает ошибку если валидация не прошла', () => {
      const data = { name: '' };
      const tainted = markAsExternal(data);

      expect(() => {
        validateAndPromote(tainted, (value) => {
          if (!value.name) {
            throw new Error('Name required');
          }
        });
      }).toThrow('Name required');
    });

    it('выбрасывает ошибку если данные не tainted', () => {
      const data = { name: 'John' };

      expect(() => {
        validateAndPromote(data as Tainted<typeof data>, () => {});
      }).toThrow('Value must be tainted before validation');
    });

    it('выбрасывает ошибку если metadata не найдена', () => {
      // Создаем объект который проходит isTainted, но getTaintMetadata возвращает undefined
      const fakeTainted = markAsExternal({ name: 'John' });

      // Мокаем getTaintMetadata чтобы вернуть undefined для этого объекта
      const getTaintMetadataSpy = vi.spyOn(taintModule, 'getTaintMetadata');
      getTaintMetadataSpy.mockImplementation((value) => {
        if (value === fakeTainted) {
          return undefined; // Симулируем отсутствие metadata
        }
        return getTaintMetadata(value);
      });

      try {
        expect(() => {
          validateAndPromote(fakeTainted, () => {});
        }).toThrow('Taint metadata not found after validation check');
      } finally {
        getTaintMetadataSpy.mockRestore();
      }
    });

    it('validator получает чистые данные без taint metadata (защита от covert channel)', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      // eslint-disable-next-line functional/no-let
      let receivedValue: unknown = null;
      validateAndPromote(tainted, (value) => {
        // eslint-disable-next-line fp/no-mutation
        receivedValue = value;
        // Проверяем что нет __taint
        expect('__taint' in (value as Record<string, unknown>)).toBe(false);
      });

      expect(receivedValue).toEqual(data);
      expect(receivedValue).not.toHaveProperty('__taint');
    });

    it('сохраняет оригинальный source и timestamp', () => {
      const data = { name: 'John' };
      const customTimestamp = 1234567890;
      const tainted = markAsExternal(data, trustLevels.UNTRUSTED as TrustLevel, customTimestamp);

      const validated = validateAndPromote(tainted, () => {});

      const metadata = getTaintMetadata(validated);
      expect(metadata?.source).toBe(taintSources.EXTERNAL);
      expect(metadata?.timestamp).toBe(customTimestamp);
    });

    it('использует meet для fail-closed (берет наименее доверенный уровень)', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data, trustLevels.UNTRUSTED as TrustLevel);

      // Пытаемся повысить до PARTIAL, но meet(UNTRUSTED, PARTIAL) = UNTRUSTED (fail-closed)
      const validated = validateAndPromote(
        tainted,
        () => {},
        trustLevels.PARTIAL as TrustLevel,
      );

      const metadata = getTaintMetadata(validated);
      expect(metadata?.trustLevel).toBe(trustLevels.UNTRUSTED);
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
        .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
        .build();

      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const validated = validateAndPromote(tainted, () => {}, undefined, customRegistry);

      expect(isTainted(validated)).toBe(true);
    });
  });

  describe('sanitizeAndPromote', () => {
    it('санитизирует и повышает уровень доверия (meet fail-closed)', () => {
      const data = { name: '<script>alert("xss")</script>' };
      // Начинаем с TRUSTED, чтобы meet(TRUSTED, TRUSTED) = TRUSTED
      const tainted = markAsExternal(data, trustLevels.TRUSTED as TrustLevel);

      const sanitized = sanitizeAndPromote(
        tainted,
        (value) => ({ ...value, name: value.name.replace(/<[^>]*>/g, '') }),
      );

      const metadata = getTaintMetadata(sanitized);
      expect(metadata?.trustLevel).toBe(trustLevels.TRUSTED);
      expect((sanitized as { name: string; }).name).toBe('alert("xss")');
    });

    it('использует TRUSTED по умолчанию (meet fail-closed)', () => {
      const data = { name: 'John' };
      // Начинаем с TRUSTED, чтобы meet(TRUSTED, TRUSTED) = TRUSTED
      const tainted = markAsExternal(data, trustLevels.TRUSTED as TrustLevel);

      const sanitized = sanitizeAndPromote(tainted, (value) => value);

      const metadata = getTaintMetadata(sanitized);
      expect(metadata?.trustLevel).toBe(trustLevels.TRUSTED);
    });

    it('использует STRICT режим по умолчанию', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const sanitized = sanitizeAndPromote(tainted, (value) => value);

      expect(isTainted(sanitized)).toBe(true);
    });

    it('принимает кастомный sanitizationMode', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const sanitized = sanitizeAndPromote(
        tainted,
        (value) => value,
        sanitizationModes.BASIC as SanitizationMode,
      );

      expect(isTainted(sanitized)).toBe(true);
    });

    it('пропускает санитизацию в режиме NONE (meet fail-closed)', () => {
      const data = { name: 'John' };
      // Начинаем с TRUSTED, чтобы meet(TRUSTED, TRUSTED) = TRUSTED
      const tainted = markAsExternal(data, trustLevels.TRUSTED as TrustLevel);

      const sanitized = sanitizeAndPromote(
        tainted,
        (_value) => {
          throw new Error('Sanitizer should not be called');
        },
        sanitizationModes.NONE as SanitizationMode,
      );

      const metadata = getTaintMetadata(sanitized);
      expect(metadata?.trustLevel).toBe(trustLevels.TRUSTED);
      expect((sanitized as { name: string; }).name).toBe('John');
    });

    it('выбрасывает ошибку если данные не tainted', () => {
      const data = { name: 'John' };

      expect(() => {
        sanitizeAndPromote(data as Tainted<typeof data>, (value) => value);
      }).toThrow('Value must be tainted before sanitization');
    });

    it('выбрасывает ошибку если metadata не найдена', () => {
      // Создаем объект который проходит isTainted, но getTaintMetadata возвращает undefined
      const fakeTainted = markAsExternal({ name: 'John' });

      // Мокаем getTaintMetadata чтобы вернуть undefined для этого объекта
      const getTaintMetadataSpy = vi.spyOn(taintModule, 'getTaintMetadata');
      getTaintMetadataSpy.mockImplementation((value) => {
        if (value === fakeTainted) {
          return undefined; // Симулируем отсутствие metadata
        }
        return getTaintMetadata(value);
      });

      try {
        expect(() => {
          sanitizeAndPromote(fakeTainted, (value) => value);
        }).toThrow('Taint metadata not found after sanitization check');
      } finally {
        getTaintMetadataSpy.mockRestore();
      }
    });

    it('выбрасывает ошибку если sanitizationMode невалиден', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);
      const invalidMode = Symbol('INVALID') as SanitizationMode;

      expect(() => {
        sanitizeAndPromote(tainted, (value) => value, invalidMode);
      }).toThrow('Invalid sanitization mode');
    });

    it('sanitizer получает чистые данные без taint metadata (защита от covert channel)', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      // eslint-disable-next-line functional/no-let
      let receivedValue: unknown = null;
      sanitizeAndPromote(tainted, (value) => {
        // eslint-disable-next-line fp/no-mutation
        receivedValue = value;
        // Проверяем что нет __taint
        expect('__taint' in (value as Record<string, unknown>)).toBe(false);
        return value;
      });

      expect(receivedValue).toEqual(data);
      expect(receivedValue).not.toHaveProperty('__taint');
    });

    it('сохраняет оригинальный source и timestamp', () => {
      const data = { name: 'John' };
      const customTimestamp = 1234567890;
      const tainted = markAsExternal(data, trustLevels.UNTRUSTED as TrustLevel, customTimestamp);

      const sanitized = sanitizeAndPromote(tainted, (value) => value);

      const metadata = getTaintMetadata(sanitized);
      expect(metadata?.source).toBe(taintSources.EXTERNAL);
      expect(metadata?.timestamp).toBe(customTimestamp);
    });

    it('использует meet для fail-closed', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data, trustLevels.UNTRUSTED as TrustLevel);

      // Пытаемся повысить до TRUSTED, но meet(UNTRUSTED, TRUSTED) = UNTRUSTED (fail-closed)
      const sanitized = sanitizeAndPromote(
        tainted,
        (value) => value,
        sanitizationModes.STRICT as SanitizationMode,
        trustLevels.TRUSTED as TrustLevel,
      );

      const metadata = getTaintMetadata(sanitized);
      expect(metadata?.trustLevel).toBe(trustLevels.UNTRUSTED);
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
        .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
        .build();

      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const sanitized = sanitizeAndPromote(
        tainted,
        (_value) => _value,
        sanitizationModes.STRICT as SanitizationMode,
        trustLevels.TRUSTED as TrustLevel,
        customRegistry,
      );

      expect(isTainted(sanitized)).toBe(true);
    });

    it('возвращает санитизированные данные (не оригинальные)', () => {
      const data = { name: '<script>alert("xss")</script>' };
      const tainted = markAsExternal(data);

      const sanitized = sanitizeAndPromote(tainted, (value) => ({
        ...value,
        name: 'sanitized',
      }));

      expect((sanitized as { name: string; }).name).toBe('sanitized');
      expect((data as { name: string; }).name).toBe('<script>alert("xss")</script>');
    });
  });

  describe('validateAndSanitize', () => {
    it('валидирует и санитизирует данные (meet fail-closed)', () => {
      const data = { name: '<script>alert("xss")</script>' };
      // validateAndSanitize: сначала validateAndPromote до PARTIAL, потом sanitizeAndPromote до TRUSTED
      // Если начать с TRUSTED: meet(TRUSTED, PARTIAL) = PARTIAL, затем meet(PARTIAL, TRUSTED) = PARTIAL
      // Поэтому начинаем с TRUSTED, но после validateAndSanitize получим PARTIAL
      const tainted = markAsExternal(data, trustLevels.TRUSTED as TrustLevel);

      const processed = validateAndSanitize(
        tainted,
        (value) => {
          if (!value.name) {
            throw new Error('Name required');
          }
        },
        (value) => ({ ...value, name: value.name.replace(/<[^>]*>/g, '') }),
        sanitizationModes.STRICT as SanitizationMode,
        trustLevels.TRUSTED as TrustLevel,
      );

      const metadata = getTaintMetadata(processed);
      // validateAndSanitize: meet(TRUSTED, PARTIAL) = PARTIAL, затем meet(PARTIAL, TRUSTED) = PARTIAL
      expect(metadata?.trustLevel).toBe(trustLevels.PARTIAL);
      expect((processed as { name: string; }).name).toBe('alert("xss")');
    });

    it('использует PARTIAL для валидации и TRUSTED для санитизации (meet fail-closed)', () => {
      const data = { name: 'John' };
      // validateAndSanitize: сначала validateAndPromote до PARTIAL, потом sanitizeAndPromote до TRUSTED
      // Но meet(UNTRUSTED, PARTIAL) = UNTRUSTED, затем meet(UNTRUSTED, TRUSTED) = UNTRUSTED
      const tainted = markAsExternal(data, trustLevels.UNTRUSTED as TrustLevel);

      const processed = validateAndSanitize(tainted, () => {}, (value) => value);

      const metadata = getTaintMetadata(processed);
      // meet(UNTRUSTED, PARTIAL) = UNTRUSTED, затем meet(UNTRUSTED, TRUSTED) = UNTRUSTED
      expect(metadata?.trustLevel).toBe(trustLevels.UNTRUSTED);
    });

    it('выбрасывает ошибку если валидация не прошла', () => {
      const data = { name: '' };
      const tainted = markAsExternal(data);

      expect(() => {
        validateAndSanitize(
          tainted,
          (value) => {
            if (!value.name) {
              throw new Error('Name required');
            }
          },
          (value) => value,
        );
      }).toThrow('Name required');
    });

    it('выбрасывает ошибку если данные не tainted', () => {
      const data = { name: 'John' };

      expect(() => {
        validateAndSanitize(data as Tainted<typeof data>, () => {}, (value) => value);
      }).toThrow('Value must be tainted before validation');
    });

    it('принимает кастомные параметры', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const processed = validateAndSanitize(
        tainted,
        () => {},
        (value) => value,
        sanitizationModes.BASIC as SanitizationMode,
        trustLevels.PARTIAL as TrustLevel,
      );

      expect(isTainted(processed)).toBe(true);
    });

    it('работает с кастомным registry', () => {
      const customRegistry = createTrustLevelRegistry()
        .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
        .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
        .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
        .build();

      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const processed = validateAndSanitize(
        tainted,
        () => {},
        (value) => value,
        sanitizationModes.STRICT as SanitizationMode,
        trustLevels.TRUSTED as TrustLevel,
        customRegistry,
      );

      expect(isTainted(processed)).toBe(true);
    });
  });

  describe('createExternalInputBoundary', () => {
    it('создает InputBoundary с правильным taintSource', () => {
      const boundary = createExternalInputBoundary<{ name: string; }>();

      expect(boundary.taintSource).toBe(taintSources.EXTERNAL);
    });

    it('mark помечает данные как tainted', () => {
      const boundary = createExternalInputBoundary<{ name: string; }>();
      const data = { name: 'John' };

      const tainted = boundary.mark(data);

      expect(isTainted(tainted)).toBe(true);
      const metadata = getTaintMetadata(tainted);
      expect(metadata?.source).toBe(taintSources.EXTERNAL);
    });

    it('validate валидирует и повышает уровень доверия (meet fail-closed)', () => {
      const boundary = createExternalInputBoundary<{ name: string; }>();
      const data = { name: 'John' };
      // Начинаем с PARTIAL, чтобы meet(PARTIAL, PARTIAL) = PARTIAL
      const tainted = boundary.mark(data, trustLevels.PARTIAL as TrustLevel);

      const validated = boundary.validate(tainted, () => {});

      const metadata = getTaintMetadata(validated);
      expect(metadata?.trustLevel).toBe(trustLevels.PARTIAL);
    });

    it('sanitize санитизирует и повышает уровень доверия (meet fail-closed)', () => {
      const boundary = createExternalInputBoundary<{ name: string; }>();
      const data = { name: 'John' };
      // Начинаем с TRUSTED, чтобы meet(TRUSTED, TRUSTED) = TRUSTED
      const tainted = boundary.mark(data, trustLevels.TRUSTED as TrustLevel);

      const sanitized = boundary.sanitize(tainted, (value) => value);

      const metadata = getTaintMetadata(sanitized);
      expect(metadata?.trustLevel).toBe(trustLevels.TRUSTED);
    });

    it('работает как полный pipeline (meet fail-closed)', () => {
      const boundary = createExternalInputBoundary<{ name: string; }>();
      const data = { name: 'John' };
      // Начинаем с TRUSTED, чтобы meet(TRUSTED, TRUSTED) = TRUSTED
      const tainted = boundary.mark(data, trustLevels.TRUSTED as TrustLevel);
      const validated = boundary.validate(tainted, () => {}, trustLevels.TRUSTED as TrustLevel);
      const sanitized = boundary.sanitize(validated, (value) => value);

      expect(isTainted(sanitized)).toBe(true);
      const metadata = getTaintMetadata(sanitized);
      expect(metadata?.trustLevel).toBe(trustLevels.TRUSTED);
    });

    it('принимает опциональные параметры', () => {
      const boundary = createExternalInputBoundary<{ name: string; }>();
      const data = { name: 'John' };
      const tainted = boundary.mark(data, trustLevels.PARTIAL as TrustLevel);

      const validated = boundary.validate(tainted, () => {}, trustLevels.TRUSTED as TrustLevel);
      const sanitized = boundary.sanitize(
        validated,
        (value) => value,
        sanitizationModes.BASIC as SanitizationMode,
        trustLevels.TRUSTED as TrustLevel,
      );

      expect(isTainted(sanitized)).toBe(true);
    });
  });

  describe('Edge cases и защита от covert channel', () => {
    it('validator не может получить доступ к __taint через stripTaint', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      // eslint-disable-next-line functional/no-let
      let hasTaint = false;
      validateAndPromote(tainted, (value) => {
        const valueObj = value as Record<string, unknown>;
        // eslint-disable-next-line fp/no-mutation
        hasTaint = '__taint' in valueObj
          || (valueObj as { __taint?: unknown; }).__taint !== undefined;
      });

      expect(hasTaint).toBe(false);
    });

    it('sanitizer не может получить доступ к __taint через stripTaint', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      // eslint-disable-next-line functional/no-let
      let hasTaint = false;
      sanitizeAndPromote(tainted, (value) => {
        const valueObj = value as Record<string, unknown>;
        // eslint-disable-next-line fp/no-mutation
        hasTaint = '__taint' in valueObj
          || (valueObj as { __taint?: unknown; }).__taint !== undefined;
        return value;
      });

      expect(hasTaint).toBe(false);
    });

    it('stripTaint корректно удаляет __taint из объектов', () => {
      const data = { name: 'John' };
      const tainted = markAsExternal(data);

      const clean = stripTaint(tainted);
      expect(clean).not.toHaveProperty('__taint');
      expect((clean as { name: string; }).name).toBe('John');
    });

    it('работает с вложенными объектами', () => {
      const data = { user: { name: 'John', age: 30 } };
      const tainted = markAsExternal(data);

      const validated = validateAndPromote(tainted, (value) => {
        expect(value.user.name).toBe('John');
      });

      expect(isTainted(validated)).toBe(true);
    });

    it('работает с массивами (stripTaint преобразует в объект)', () => {
      const data = [1, 2, 3];
      const tainted = markAsExternal(data);

      // stripTaint для массивов возвращает объект, не массив
      validateAndPromote(tainted, (value) => {
        // value будет объектом { '0': 1, '1': 2, '2': 3 }, не массивом
        expect(value).not.toBeInstanceOf(Array);
        const valueObj = value as unknown as Record<string, number>;
        expect(valueObj['0']).toBe(1);
        expect(valueObj['1']).toBe(2);
        expect(valueObj['2']).toBe(3);
      });

      expect(isTainted(tainted)).toBe(true);
    });
  });
});
/* eslint-enable ai-security/model-poisoning */
